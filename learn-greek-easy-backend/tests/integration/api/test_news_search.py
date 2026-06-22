"""RED tests for NWS8-01 — optional `q` search param on GET /api/v1/news.

These tests are authored RED before the feature is implemented.
They exercise `immutable_unaccent`+`ilike` across title_el, description_el,
description_el_a2, and source URL; AND-combination with the `country` filter;
pagination/count correctness; blank-q noop; and wildcard-safety.

All tests require a live PostgreSQL test DB (immutable_unaccent is a Postgres
function).  They must FAIL until NWS8-01 is implemented.

Factories/fixtures reused:
- SituationFactory (tests/factories/situation.py)
- SituationDescriptionFactory (tests/factories/situation_description.py)
- SituationPictureFactory (tests/factories/situation_picture.py)
- client / db_session  (tests/conftest.py)

Note: NewsItem is created directly (not via NewsItemFactory) to avoid the factory's
else-branch creating a duplicate SituationDescription, which violates unique=True.
"""

import datetime
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import DescriptionSourceType, NewsCountry, NewsItem, NewsItemStatus
from tests.factories import (
    SituationDescriptionFactory,
    SituationFactory,
    SituationPictureFactory,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _make_news_item(
    db_session: AsyncSession,
    *,
    title_el: str,
    text_el: str,
    text_el_a2: str = "",
    url_suffix: str | None = None,
    country: NewsCountry = NewsCountry.CYPRUS,
    published: bool = True,
) -> NewsItem:
    """Seed a published (or draft) news item with specific searchable content.

    Creates: Situation (scenario_el=title_el) → SituationDescription (text_el,
    text_el_a2, country) → SituationPicture → NewsItem with the given URL.

    NOTE: Creates NewsItem directly (not via NewsItemFactory.create) to avoid
    the factory's else-branch creating a second SituationDescription.
    SituationDescription.situation_id has a unique=True constraint — two inserts
    for the same situation_id would raise IntegrityError.

    Returns the NewsItem ORM instance.
    """
    situation = await SituationFactory.create(session=db_session, ready=True, scenario_el=title_el)
    await SituationDescriptionFactory.create(
        session=db_session,
        situation_id=situation.id,
        text_el=text_el,
        text_el_a2=text_el_a2 or f"A2 περίληψη {uuid4().hex[:4]}",
        country=country,
        source_type=DescriptionSourceType.NEWS,
    )
    await SituationPictureFactory.create(session=db_session, situation_id=situation.id)

    suffix = url_suffix or uuid4().hex[:8]
    url = f"https://test-source-{suffix}.example.com/article-{uuid4().hex[:4]}"

    news_item = NewsItem(
        situation_id=situation.id,
        publication_date=datetime.date.today(),
        original_article_url=url,
        status=NewsItemStatus.PUBLISHED if published else NewsItemStatus.DRAFT,
    )
    db_session.add(news_item)
    await db_session.flush()
    return news_item


# ---------------------------------------------------------------------------
# CA1 — match-by-title (accent-insensitive)
# ---------------------------------------------------------------------------


class TestNewsSearchByTitle:
    """GET ?q= matches Situation.scenario_el (= response title_el), accent-insensitive."""

    @pytest.mark.asyncio
    async def test_news_search_matches_title_accent_insensitive(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Given title_el 'Κυπριακές ειδήσεις', ?q=ειδησεις (no accents, lowercase) returns item.

        RED: passes only after immutable_unaccent+ilike is applied to scenario_el.
        """
        await _make_news_item(
            db_session,
            title_el="Κυπριακές ειδήσεις",
            text_el="Κάποιο άρθρο.",
        )

        response = await client.get("/api/v1/news?q=ειδησεις")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1, (
            "Expected at least 1 result for accent-stripped title query, got 0. "
            "Feature not yet implemented: immutable_unaccent+ilike on scenario_el."
        )
        titles = [item["title_el"] for item in data["items"]]
        assert any(
            "ειδ" in t.lower() for t in titles
        ), f"Item with 'Κυπριακές ειδήσεις' not in results. Got titles: {titles}"

    @pytest.mark.asyncio
    async def test_news_search_matches_title_case_insensitive(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Query uppercase term matches lowercase title content."""
        await _make_news_item(
            db_session,
            title_el="ελληνικές εκλογές",
            text_el="Άρθρο για εκλογές.",
        )

        response = await client.get("/api/v1/news?q=ΕΚΛΟΓΕΣ")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1, (
            "Case-insensitive title search returned 0 results. " "Feature not yet implemented."
        )


# ---------------------------------------------------------------------------
# CA1 — match-by-body (text_el → description_el)
# ---------------------------------------------------------------------------


class TestNewsSearchByBody:
    """GET ?q= matches SituationDescription.text_el (= response description_el)."""

    @pytest.mark.asyncio
    async def test_news_search_matches_body_el(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Given body text_el containing 'Περιγραφή', ?q=περιγραφη returns item.

        RED: passes only after immutable_unaccent+ilike is applied to text_el.
        """
        await _make_news_item(
            db_session,
            title_el="Γενικό άρθρο",
            text_el="Αυτή είναι η κύρια Περιγραφή του άρθρου.",
        )

        response = await client.get("/api/v1/news?q=περιγραφη")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1, (
            "Expected match on body text_el for accent-stripped 'περιγραφη'. "
            "Feature not yet implemented."
        )


# ---------------------------------------------------------------------------
# CA1 — match-by-a2 body (text_el_a2 → description_el_a2)
# ---------------------------------------------------------------------------


class TestNewsSearchByA2Body:
    """GET ?q= matches SituationDescription.text_el_a2 (= response description_el_a2)."""

    @pytest.mark.asyncio
    async def test_news_search_matches_a2_body(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Given item with text_el_a2 containing unique term, ?q=<term> returns it.

        The term is only in the A2 body — NOT in title or B1 body — so the search
        must include text_el_a2 to find it.

        RED: passes only after immutable_unaccent+ilike is applied to text_el_a2.
        """
        unique_word = "χαρακτηριστικός"  # accented form — query will be unaccented
        await _make_news_item(
            db_session,
            title_el="Άλλο άρθρο",
            text_el="Γενικό κείμενο χωρίς τη λέξη.",
            text_el_a2=f"Απλοποιημένο: {unique_word} κείμενο.",
        )
        # decoy item without the word
        await _make_news_item(
            db_session,
            title_el="Άσχετο άρθρο",
            text_el="Τίποτα το ιδιαίτερο.",
            text_el_a2="Απλό κείμενο.",
        )

        response = await client.get("/api/v1/news?q=χαρακτηριστικος")  # no accent

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1, (
            "Expected match in text_el_a2 for 'χαρακτηριστικος'. " "Feature not yet implemented."
        )
        # total must not include the decoy
        assert data["total"] == 1, (
            f"Expected exactly 1 match for unique A2 term, got {data['total']}. "
            "The decoy item should not match."
        )


# ---------------------------------------------------------------------------
# CA1 — match-by-source-hostname (D3: original_article_url)
# ---------------------------------------------------------------------------


class TestNewsSearchBySourceURL:
    """GET ?q= matches NewsItem.original_article_url substring (hostname + path)."""

    @pytest.mark.asyncio
    async def test_news_search_matches_source_hostname(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Given url 'https://uniquenewssite.gr/article', ?q=uniquenewssite.gr returns item.

        RED: passes only after immutable_unaccent+ilike is applied to original_article_url.
        """
        unique_host = f"uniquenewssite-{uuid4().hex[:6]}.gr"
        situation = await SituationFactory.create(session=db_session, ready=True)
        await SituationDescriptionFactory.create(
            session=db_session,
            situation_id=situation.id,
            country=NewsCountry.CYPRUS,
            source_type=DescriptionSourceType.NEWS,
        )
        await SituationPictureFactory.create(session=db_session, situation_id=situation.id)
        # Create NewsItem directly — NewsItemFactory.create(situation_id=...) would create
        # a second SituationDescription, violating the unique=True constraint.
        target = NewsItem(
            situation_id=situation.id,
            publication_date=datetime.date.today(),
            original_article_url=f"https://{unique_host}/some-article",
            status=NewsItemStatus.PUBLISHED,
        )
        db_session.add(target)
        await db_session.flush()

        # Also create a decoy with a different hostname
        await _make_news_item(
            db_session,
            title_el="Άρθρο decoy",
            text_el="Κείμενο χωρίς σχέση.",
        )

        response = await client.get(f"/api/v1/news?q={unique_host}")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1, (
            f"Expected match for hostname '{unique_host}' in original_article_url. "
            "Feature not yet implemented (D3)."
        )
        ids = {item["id"] for item in data["items"]}
        assert (
            str(target.id) in ids
        ), f"Target news item {target.id} not in search results for query '{unique_host}'."


# ---------------------------------------------------------------------------
# CA1 — no-match excludes (total=0, country_counts all 0)
# ---------------------------------------------------------------------------


class TestNewsSearchNoMatch:
    """When q matches nothing, items=[], total=0, all country_counts=0."""

    @pytest.mark.asyncio
    async def test_news_search_no_match_excludes(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """GET ?q=ζζζnomatchζζζ → empty items, total=0, country_counts all 0.

        RED: without q filtering, total ≥ 1 (the seeded item) and country_counts
        will be non-zero. Only after q filtering lands will both be 0.
        """
        await _make_news_item(
            db_session,
            title_el="Υπάρχον άρθρο",
            text_el="Κείμενο που δεν περιέχει τίποτα σχετικό.",
        )

        response = await client.get("/api/v1/news?q=ζζζnomatchζζζ")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0, (
            f"Expected total=0 for no-match query, got {data['total']}. "
            "Feature not yet implemented."
        )
        assert data["items"] == [], "Expected empty items list for no-match query."
        country_counts = data["country_counts"]
        for country_key, count in country_counts.items():
            assert count == 0, (
                f"Expected country_counts['{country_key}']=0 for no-match query, got {count}. "
                "count_by_country must also be filtered by q."
            )


# ---------------------------------------------------------------------------
# CA1 — AND-combination with country filter
# ---------------------------------------------------------------------------


class TestNewsSearchAndCountry:
    """q AND-combines with the existing country filter."""

    @pytest.mark.asyncio
    async def test_news_search_and_combines_country(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Two items share the same title term but differ in country.
        ?q=<term>&country=greece returns only the greece item.

        RED: the `q` param doesn't exist yet, so the country filter works but
        the q predicate has no effect → both items would be returned (if the
        country filter matches) or the endpoint returns 422 (unknown param).
        Either way the assertion fails until NWS8-01 is implemented.
        """
        shared_term = f"κοινόθεμα{uuid4().hex[:4]}"

        await _make_news_item(
            db_session,
            title_el=f"Άρθρο {shared_term} Κύπρου",
            text_el="Κυπριακό περιεχόμενο.",
            country=NewsCountry.CYPRUS,
        )
        await _make_news_item(
            db_session,
            title_el=f"Άρθρο {shared_term} Ελλάδας",
            text_el="Ελληνικό περιεχόμενο.",
            country=NewsCountry.GREECE,
        )

        response = await client.get(f"/api/v1/news?q={shared_term}&country=greece")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1, (
            f"Expected exactly 1 result for q+country=greece, got {data['total']}. "
            "Feature not yet implemented."
        )
        assert data["items"][0]["title_el"] is not None
        # The returned item must be for Greece, not Cyprus
        assert (
            data["items"][0]["country"] == "greece"
        ), "Returned item is not the Greece item — country filter or q not AND-combined."


# ---------------------------------------------------------------------------
# CA1 — pagination total reflects q-filtered set
# ---------------------------------------------------------------------------


class TestNewsSearchPagination:
    """Pagination total and pages are derived from the q-filtered set."""

    @pytest.mark.asyncio
    async def test_news_search_pagination_total_filtered(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """15 items match term; page_size=10 → page 1 has 10 items, total=15, page 2 has 5.

        RED: without q, total = total published count (≥ 15 matching + possibly others).
        After q is implemented, total reflects only the 15 matching items.
        """
        unique_term = f"πagination{uuid4().hex[:4]}"

        for i in range(15):
            await _make_news_item(
                db_session,
                title_el=f"Άρθρο {unique_term} αριθμός {i}",
                text_el=f"Περιγραφή {i}.",
            )
        # 3 decoy items that do NOT contain the term
        for i in range(3):
            await _make_news_item(
                db_session,
                title_el=f"Άσχετο άρθρο {i}",
                text_el="Τίποτα σχετικό.",
            )

        response_p1 = await client.get(f"/api/v1/news?q={unique_term}&page=1&page_size=10")
        response_p2 = await client.get(f"/api/v1/news?q={unique_term}&page=2&page_size=10")

        assert response_p1.status_code == 200
        assert response_p2.status_code == 200

        data_p1 = response_p1.json()
        data_p2 = response_p2.json()

        assert data_p1["total"] == 15, (
            f"Expected total=15 for q-filtered set, got {data_p1['total']}. "
            "Feature not yet implemented."
        )
        assert (
            len(data_p1["items"]) == 10
        ), f"Expected 10 items on page 1, got {len(data_p1['items'])}."
        assert data_p2["total"] == 15
        assert (
            len(data_p2["items"]) == 5
        ), f"Expected 5 items on page 2, got {len(data_p2['items'])}."

        # All items on both pages must contain the term
        all_items = data_p1["items"] + data_p2["items"]
        assert len(all_items) == 15
        p1_ids = {item["id"] for item in data_p1["items"]}
        p2_ids = {item["id"] for item in data_p2["items"]}
        assert p1_ids.isdisjoint(p2_ids), "Page 1 and page 2 must not overlap."


# ---------------------------------------------------------------------------
# CA1/CA4 — blank/absent q is a noop (no regression)
# ---------------------------------------------------------------------------


class TestNewsSearchBlankQ:
    """Omitting q or passing blank/whitespace q is identical to the unfiltered feed."""

    @pytest.mark.asyncio
    async def test_news_list_without_q_unchanged(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """GET /api/v1/news (no q) returns the full set of published items — unchanged.

        This test verifies the no-regression contract (CA4): adding the q param
        must not alter behavior when q is absent.
        """
        await _make_news_item(db_session, title_el="Άρθρο Α", text_el="Κείμενο Α.")
        await _make_news_item(db_session, title_el="Άρθρο Β", text_el="Κείμενο Β.")

        response = await client.get("/api/v1/news")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 2
        assert "items" in data
        assert "country_counts" in data

    @pytest.mark.asyncio
    async def test_news_search_blank_q_is_noop(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """?q= (empty string) and ?q=%20 (whitespace) behave as unfiltered.

        RED: The endpoint currently ignores q entirely (it doesn't exist), so both
        return everything. Once q is implemented, blank/whitespace-only q must also
        return everything (no predicate added when q.strip() == '').
        This test seeds 2 items and asserts both are returned with an empty q.
        """
        await _make_news_item(db_session, title_el="Άρθρο Γ", text_el="Κείμενο Γ.")
        await _make_news_item(db_session, title_el="Άρθρο Δ", text_el="Κείμενο Δ.")

        response_empty = await client.get("/api/v1/news?q=")
        response_space = await client.get("/api/v1/news?q=%20")

        assert response_empty.status_code == 200
        assert response_space.status_code == 200

        total_empty = response_empty.json()["total"]
        total_space = response_space.json()["total"]

        assert total_empty >= 2, f"?q= should return unfiltered feed (≥2 items), got {total_empty}."
        assert (
            total_space >= 2
        ), f"?q=%20 should return unfiltered feed (≥2 items), got {total_space}."

        # Both must equal the base unfiltered total
        base_response = await client.get("/api/v1/news")
        base_total = base_response.json()["total"]
        assert total_empty == base_total, f"?q= total ({total_empty}) != base total ({base_total})."
        assert (
            total_space == base_total
        ), f"?q=%20 total ({total_space}) != base total ({base_total})."


# ---------------------------------------------------------------------------
# F5 — percent-literal: `%` in q must NOT match everything (wildcard-safety)
# ---------------------------------------------------------------------------


class TestNewsSearchWildcardSafety:
    """F5: a literal `%` in q must not act as a SQL LIKE wildcard."""

    @pytest.mark.asyncio
    async def test_news_search_percent_literal_not_wildcard(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """?q=%25 (URL-encoded literal %) must return only items that actually contain '%'.

        Without wildcard escaping, a raw % in an ILIKE pattern matches everything
        (every character sequence), which would return ALL items.  After proper
        escaping (sqlalchemy `%` → `\\%`), it only matches a literal percent sign
        in the stored content, which no factory-created item contains → total=0.

        RED: Once implemented WITHOUT escaping, this test fails because the %
        matches all items.  The test is designed to catch that exact defect.
        The correct implementation must escape `%` and `_` before passing to ILIKE.
        """
        # Seed 3 items with no '%' in any searchable field
        for i in range(3):
            await _make_news_item(
                db_session,
                title_el=f"Κανονικό άρθρο {i}",
                text_el=f"Κανονικό κείμενο {i}.",
            )

        # ?q=%25 → the HTTP client sends the literal `%` (percent-sign) to FastAPI
        response = await client.get("/api/v1/news", params={"q": "%"})

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0, (
            f"Literal '%' in q should return 0 items (no stored content has a % sign), "
            f"but got {data['total']}. The `%` was treated as a SQL LIKE wildcard — "
            "escaping is missing in the ILIKE implementation."
        )


# ---------------------------------------------------------------------------
# F2 — country_counts filtered by q only (NOT by selected country)
# ---------------------------------------------------------------------------


class TestNewsSearchCountryCounts:
    """F2: country_counts reflects the q-filtered set only, not the selected country.

    When ?q=<term>&country=greece is requested:
    - items  → only greece items that match q
    - total  → only greece items that match q
    - country_counts → ALL countries' q-filtered counts (so cyprus count still
                       shows how many cyprus items match q, not 0)

    This is the key pill-count contract: switching country does NOT zero out
    the other pills' q-counts.
    """

    @pytest.mark.asyncio
    async def test_country_counts_reflect_q_not_selected_country(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Seed 2 Cyprus items + 1 Greece item all containing the search term.
        ?q=<term>&country=greece must return:
          - items: 1 (the greece item)
          - total: 1 (greece only)
          - country_counts["cyprus"]: 2  ← q-filtered but NOT country-filtered
          - country_counts["greece"]: 1
          - country_counts["world"]: 0

        RED: Without F2 contract, count_by_country ignores q → cyprus=2+N
        (all cyprus items regardless of q), which is also wrong.  Or with a
        naive AND(country, q) it returns cyprus=0, which is the other bug.
        """
        shared_term = f"F2test{uuid4().hex[:4]}"

        await _make_news_item(
            db_session,
            title_el=f"Κυπριακό {shared_term} Α",
            text_el="Κείμενο κυπριακό.",
            country=NewsCountry.CYPRUS,
        )
        await _make_news_item(
            db_session,
            title_el=f"Κυπριακό {shared_term} Β",
            text_el="Άλλο κυπριακό κείμενο.",
            country=NewsCountry.CYPRUS,
        )
        await _make_news_item(
            db_session,
            title_el=f"Ελληνικό {shared_term}",
            text_el="Ελληνικό κείμενο.",
            country=NewsCountry.GREECE,
        )
        # Decoy: Cyprus item that does NOT contain the term
        await _make_news_item(
            db_session,
            title_el="Άσχετο κυπριακό άρθρο",
            text_el="Τίποτα σχετικό.",
            country=NewsCountry.CYPRUS,
        )

        response = await client.get(f"/api/v1/news?q={shared_term}&country=greece")

        assert response.status_code == 200
        data = response.json()

        # items/total reflect AND(q, country=greece)
        assert data["total"] == 1, (
            f"Expected total=1 (only greece matches q), got {data['total']}. "
            "Feature not yet implemented."
        )
        assert len(data["items"]) == 1

        # country_counts must reflect q only (NOT AND-ed with country=greece)
        country_counts = data["country_counts"]
        assert country_counts.get("cyprus", -1) == 2, (
            f"Expected country_counts['cyprus']=2 (q-filtered only), "
            f"got {country_counts.get('cyprus')}. "
            "F2: count_by_country must be filtered by q but NOT by the selected country."
        )
        assert (
            country_counts.get("greece", -1) == 1
        ), f"Expected country_counts['greece']=1, got {country_counts.get('greece')}."
        assert (
            country_counts.get("world", -1) == 0
        ), f"Expected country_counts['world']=0, got {country_counts.get('world')}."

    @pytest.mark.asyncio
    async def test_country_counts_not_affected_by_country_filter_without_q(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Baseline: ?country=greece (no q) → country_counts shows ALL countries' totals.

        This is the existing behaviour (already implemented); the test confirms it
        is NOT broken by the NWS8-01 change.
        """
        await _make_news_item(
            db_session,
            title_el="Κυπριακό βασικό",
            text_el="Κείμενο.",
            country=NewsCountry.CYPRUS,
        )
        await _make_news_item(
            db_session,
            title_el="Ελληνικό βασικό",
            text_el="Κείμενο.",
            country=NewsCountry.GREECE,
        )

        response = await client.get("/api/v1/news?country=greece")

        assert response.status_code == 200
        data = response.json()
        country_counts = data["country_counts"]
        # Existing behaviour: count_by_country is NOT filtered by country param
        assert country_counts.get("cyprus", 0) >= 1, (
            "country_counts['cyprus'] should be ≥1 even when ?country=greece "
            "(count_by_country is not AND-ed with country filter)."
        )
        assert country_counts.get("greece", 0) >= 1


# ---------------------------------------------------------------------------
# Mode B adversarial / edge cases
# ---------------------------------------------------------------------------


class TestNewsSearchAdversarial:
    """Adversarial and edge cases added in Mode B QA verification."""

    @pytest.mark.asyncio
    async def test_multi_column_match_no_double_count(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """A term matching BOTH scenario_el AND text_el of the same item returns it once, not twice.

        The OR predicate spans 4 columns — if the JOIN produces duplicate rows for a
        multi-column match, count_all / total would over-count.  This test pins that
        a single item matching on multiple columns is counted exactly once.
        """
        unique_term = f"dup{uuid4().hex[:6]}"
        # Item where term appears in both title (scenario_el) AND body (text_el)
        await _make_news_item(
            db_session,
            title_el=f"Τίτλος με {unique_term}",
            text_el=f"Κείμενο που περιέχει επίσης {unique_term}.",
        )

        response = await client.get(f"/api/v1/news?q={unique_term}")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1, (
            f"Expected exactly 1 item for a term matching multiple columns of the same item, "
            f"got {data['total']}. The OR predicate must not double-count a row."
        )
        assert len(data["items"]) == 1

    @pytest.mark.asyncio
    async def test_underscore_in_q_not_wildcard(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """F5: a literal `_` in q must match only items containing `_`, not any single char.

        Without escaping, `_` in ILIKE is a single-character wildcard.
        This test seeds items with no `_` in any searchable field — a literal `_`
        query should return 0 items, not all items.
        """
        for i in range(3):
            await _make_news_item(
                db_session,
                title_el=f"Τίτλος χωρίς κάτω παύλα {i}",
                text_el=f"Κείμενο χωρίς κάτω παύλα {i}.",
            )

        response = await client.get("/api/v1/news", params={"q": "_"})

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0, (
            f"Literal '_' in q should return 0 items (no stored content has a bare underscore), "
            f"but got {data['total']}. The `_` was treated as a SQL LIKE single-char wildcard — "
            "escaping is missing in the ILIKE implementation."
        )

    @pytest.mark.asyncio
    async def test_q_plus_country_plus_pagination(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Combined q + country + pagination: total/pages are AND-filtered correctly.

        Seeds: 8 Cyprus + 3 Greece items sharing a term; 2 decoy items without the term.
        ?q=<term>&country=cyprus&page_size=5 →
          - page 1: 5 items, total=8
          - page 2: 3 items, total=8
          - all items are Cyprus only
        """
        shared_term = f"combo{uuid4().hex[:4]}"

        for i in range(8):
            await _make_news_item(
                db_session,
                title_el=f"Κυπριακό {shared_term} {i}",
                text_el="Κείμενο.",
                country=NewsCountry.CYPRUS,
            )
        for i in range(3):
            await _make_news_item(
                db_session,
                title_el=f"Ελληνικό {shared_term} {i}",
                text_el="Κείμενο.",
                country=NewsCountry.GREECE,
            )
        # Decoys: no term
        for i in range(2):
            await _make_news_item(
                db_session,
                title_el=f"Άσχετο {i}",
                text_el="Τίποτα.",
                country=NewsCountry.CYPRUS,
            )

        resp1 = await client.get(f"/api/v1/news?q={shared_term}&country=cyprus&page=1&page_size=5")
        resp2 = await client.get(f"/api/v1/news?q={shared_term}&country=cyprus&page=2&page_size=5")

        assert resp1.status_code == 200
        assert resp2.status_code == 200
        d1 = resp1.json()
        d2 = resp2.json()

        assert d1["total"] == 8, f"Expected total=8 (8 cyprus items matching q), got {d1['total']}."
        assert len(d1["items"]) == 5, f"Expected 5 items on page 1, got {len(d1['items'])}."
        assert len(d2["items"]) == 3, f"Expected 3 items on page 2, got {len(d2['items'])}."
        assert d2["total"] == 8

        # No page overlap
        p1_ids = {item["id"] for item in d1["items"]}
        p2_ids = {item["id"] for item in d2["items"]}
        assert p1_ids.isdisjoint(p2_ids), "Pages must not overlap."

        # country_counts must still show the q-filtered TOTAL per country (F2)
        cc = d1["country_counts"]
        assert (
            cc.get("cyprus", -1) == 8
        ), f"country_counts['cyprus'] should be 8 (all cyprus q-matches), got {cc.get('cyprus')}."
        assert cc.get("greece", -1) == 3, (
            f"country_counts['greece'] should be 3 (greece q-matches, not 0), "
            f"got {cc.get('greece')}."
        )
