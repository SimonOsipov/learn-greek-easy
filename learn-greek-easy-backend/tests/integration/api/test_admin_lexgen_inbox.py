"""Integration tests for the read-only LEXGEN verification inbox admin API.

LEXGEN-12-01 — two read-only superuser endpoints:
- GET /api/v1/admin/lexgen/proposals          (paginated needs_review queue)
- GET /api/v1/admin/lexgen/proposals/{id}     (proposal detail)

These tests are authored RED before the endpoints exist (Test-first: yes). They
are intentionally BLACK-BOX over HTTP: they import ONLY the model/enums/factory
(which already resolve), never any not-yet-created app symbol (schemas /
serializer). The RED failures must therefore be behavioral — 404 (endpoint
unimplemented), 403 (auth), or assertion — NOT import/collection errors.

Covered Test Specs (task-1143):
- filter            test_list_returns_only_needs_review
- order             test_list_orders_by_flagged_then_fifo
- row-shape         test_list_item_has_no_score_keys
- pagination        test_list_pagination
- empty-state       test_list_empty_state  (additive — story "empty state" AC)
- detail-provenance test_detail_returns_value_source_flagged
- content (F1/F2)   test_detail_includes_glosses_and_example
- score-exclusion   test_detail_excludes_all_numeric_scores
- not-found         test_detail_404_for_non_needs_review (+ random UUID)
- auth              test_endpoints_require_superuser (403) + unauthenticated 401
"""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import WordProposalState
from tests.factories.word_proposal import WordProposalFactory

# Endpoint paths (verified against the story System Design — effective base
# /api/v1/admin, router mounted at /admin under /api/v1).
LIST_URL = "/api/v1/admin/lexgen/proposals"


def _detail_url(proposal_id) -> str:
    return f"/api/v1/admin/lexgen/proposals/{proposal_id}"


# The score keys that must NEVER appear anywhere in a response (anti-anchoring,
# Decision Record §3). Includes top-level columns + nested judge rubric dims.
FORBIDDEN_SCORE_KEYS = {
    "judge_scores",
    "trust_score",
    "confidence",
    "naturalness",
    "sense_fit",
    "translation_faith_en",
    "translation_faith_ru",
    "a2_appropriateness",
}


def _assert_no_score_keys(obj, forbidden_keys: set[str]) -> None:
    """Recursively walk a parsed-JSON structure and assert that none of its
    dict KEYS (at any depth) is in ``forbidden_keys``.

    Asserts absence of score *keys*, not digit substrings — a legitimate lemma
    or example sentence could legally contain a 1–5 digit, so substring checks
    would be brittle (Decision Record D-SCORE-EXCLUSION).
    """
    if isinstance(obj, dict):
        for key, value in obj.items():
            assert key not in forbidden_keys, (
                f"Forbidden score key {key!r} leaked into the response "
                f"(anti-anchoring invariant, Decision Record §3)."
            )
            _assert_no_score_keys(value, forbidden_keys)
    elif isinstance(obj, list):
        for item in obj:
            _assert_no_score_keys(item, forbidden_keys)


def _reconciliation_log(lemma: str, fields: dict) -> dict:
    """Build a schema-v1 reconciliation_log with the given fields block.

    Each field carries value/source plus the score-bearing keys (confidence,
    flags, cross_checks) that the API must NOT surface.
    """
    return {
        "schema_version": "lexgen.reconciliation.v1",
        "pos": "noun",
        "lemma": lemma,
        "fields": fields,
        "gaps": [],
    }


def _field_entry(value: str, source: str) -> dict:
    return {
        "value": value,
        "source": source,
        "confidence": None,
        "flags": [],
        "cross_checks": [],
    }


# =============================================================================
# GET /api/v1/admin/lexgen/proposals  — queue list
# =============================================================================


class TestLexgenProposalListEndpoint:
    """GET /api/v1/admin/lexgen/proposals (needs_review queue)."""

    @pytest.mark.asyncio
    async def test_list_returns_only_needs_review(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Only status=needs_review rows are returned; total matches their count.

        Test Spec: filter — proposals across pending/scored/needs_review/shipped.
        """
        await WordProposalFactory.create(status=WordProposalState.PENDING)
        await WordProposalFactory.create(status=WordProposalState.SCORED)
        await WordProposalFactory.create(status=WordProposalState.SHIPPED, shipped=True)
        nr1 = await WordProposalFactory.create(status=WordProposalState.NEEDS_REVIEW)
        nr2 = await WordProposalFactory.create(status=WordProposalState.NEEDS_REVIEW)

        response = await client.get(LIST_URL, headers=superuser_auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        returned_ids = {item["id"] for item in data["items"]}
        assert returned_ids == {str(nr1.id), str(nr2.id)}

    @pytest.mark.asyncio
    async def test_list_orders_by_flagged_then_fifo(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Order = most-flagged DESC, then created_at ASC (FIFO), then id ASC.

        Test Spec: order — A(2 flags, newest), B(2 flags, older), C(0 flags)
        → expected order B, A, C.
        """
        base = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        # B: 2 flags, older
        b = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            flagged_fields=["gender", "ipa"],
            created_at=base,
        )
        # A: 2 flags, newest
        a = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            flagged_fields=["gender", "ipa"],
            created_at=base + timedelta(hours=1),
        )
        # C: 0 flags
        c = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            flagged_fields=[],
            created_at=base + timedelta(hours=2),
        )

        response = await client.get(LIST_URL, headers=superuser_auth_headers)

        assert response.status_code == 200
        order = [item["id"] for item in response.json()["items"]]
        assert order == [str(b.id), str(a.id), str(c.id)]

    @pytest.mark.asyncio
    async def test_list_item_has_no_score_keys(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Each list item's key set is EXACTLY the 5 score-free keys.

        Test Spec: row-shape — one needs_review row with judge_scores set.
        """
        proposal = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            flagged_fields=["gender"],
            judge_scores={
                "schema_version": "lexgen.judge.v1",
                "judges": [
                    {
                        "rubric": {
                            "naturalness": 5,
                            "sense_fit": 4,
                            "translation_faith_en": 5,
                            "translation_faith_ru": 4,
                            "a2_appropriateness": 5,
                        }
                    }
                ],
                "disagreement": None,
            },
            trust_score=0.91,
        )

        response = await client.get(LIST_URL, headers=superuser_auth_headers)

        assert response.status_code == 200
        items = response.json()["items"]
        item = next((i for i in items if i["id"] == str(proposal.id)), None)
        assert item is not None
        assert set(item.keys()) == {
            "id",
            "lemma",
            "pos",
            "flagged_field_count",
            "created_at",
        }
        assert item["lemma"] == proposal.lemma_input
        assert item["pos"] == proposal.pos
        assert item["flagged_field_count"] == 1
        # Defense in depth: no score key anywhere in the list payload.
        _assert_no_score_keys(response.json(), FORBIDDEN_SCORE_KEYS)

    @pytest.mark.asyncio
    async def test_list_pagination(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """page=2&page_size=20 over 25 rows → 5 items, page=2, total=25.

        Test Spec: pagination.
        """
        for _ in range(25):
            await WordProposalFactory.create(status=WordProposalState.NEEDS_REVIEW)

        response = await client.get(
            f"{LIST_URL}?page=2&page_size=20",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 2
        assert data["page_size"] == 20
        assert data["total"] == 25
        assert len(data["items"]) == 5

    @pytest.mark.asyncio
    async def test_list_empty_state(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """No needs_review rows → empty items, total 0 (story empty-state AC)."""
        # Seed only non-review rows so the queue is empty.
        await WordProposalFactory.create(status=WordProposalState.PENDING)
        await WordProposalFactory.create(status=WordProposalState.SHIPPED, shipped=True)

        response = await client.get(LIST_URL, headers=superuser_auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["items"] == []

    @pytest.mark.asyncio
    async def test_list_requires_auth(
        self,
        client: AsyncClient,
    ):
        """Unauthenticated list request returns 401."""
        response = await client.get(LIST_URL)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_forbidden_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Non-superuser list request returns 403 (no reviewer role, DR §D2)."""
        response = await client.get(LIST_URL, headers=auth_headers)
        assert response.status_code == 403


# =============================================================================
# GET /api/v1/admin/lexgen/proposals/{id}  — detail
# =============================================================================


class TestLexgenProposalDetailEndpoint:
    """GET /api/v1/admin/lexgen/proposals/{id}."""

    @pytest.mark.asyncio
    async def test_detail_returns_value_source_flagged(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Detail fields carry value + source (provenance) + flagged.

        Test Spec: detail-provenance — reconciliation_log fields +
        flagged_fields=["gender"]; gender flagged=true, a non-flagged field
        flagged=false.
        """
        proposal = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            flagged_fields=["gender"],
            generated_fields={"gender": "neuter", "declension_group": "neut-i"},
            reconciliation_log=_reconciliation_log(
                "σπίτι",
                {
                    "gender": _field_entry("neuter", "greek_lexicon"),
                    "declension_group": _field_entry("neut-i", "triantafyllidis"),
                },
            ),
        )

        response = await client.get(_detail_url(proposal.id), headers=superuser_auth_headers)

        assert response.status_code == 200
        data = response.json()
        fields = {f["field"]: f for f in data["fields"]}

        assert "gender" in fields
        assert fields["gender"]["value"] == "neuter"
        assert fields["gender"]["source"] == "greek_lexicon"
        assert fields["gender"]["flagged"] is True

        assert "declension_group" in fields
        assert fields["declension_group"]["source"] == "triantafyllidis"
        assert fields["declension_group"]["flagged"] is False

    @pytest.mark.asyncio
    async def test_detail_includes_glosses_and_example(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """content is a LIST of the 4 fixed keys, each value/source/flagged.

        Test Spec: content (F1/F2) — generated_content populated; the example_greek
        item is flagged (flagged_fields=["example_greek"]), a non-flagged content
        item is not; source constant "lexgen_generator"; fixed key order.
        """
        proposal = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            flagged_fields=["example_greek"],
            generated_content={
                "gloss_en": "house",
                "gloss_ru": "дом",
                "example_greek": "Το σπίτι είναι μεγάλο.",
                "example_translation": "The house is big.",
            },
        )

        response = await client.get(_detail_url(proposal.id), headers=superuser_auth_headers)

        assert response.status_code == 200
        content = response.json()["content"]
        assert isinstance(content, list)

        # Fixed order of the 4 content keys.
        assert [c["field"] for c in content] == [
            "gloss_en",
            "gloss_ru",
            "example_greek",
            "example_translation",
        ]

        by_field = {c["field"]: c for c in content}
        for item in content:
            assert set(item.keys()) == {"field", "value", "source", "flagged"}
            assert item["source"] == "lexgen_generator"
            assert isinstance(item["flagged"], bool)

        assert by_field["gloss_en"]["value"] == "house"
        assert by_field["example_greek"]["value"] == "Το σπίτι είναι μεγάλο."
        # Flagged matches the JUDGE content field name example_greek.
        assert by_field["example_greek"]["flagged"] is True
        assert by_field["gloss_en"]["flagged"] is False

    @pytest.mark.asyncio
    async def test_detail_excludes_all_numeric_scores(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Recursive key walk over the WHOLE detail response finds NO score key.

        Test Spec: score-exclusion (F6) — judge_scores (rubric 1–5), trust_score,
        and a confidence in reconciliation_log are all present on the row; none of
        judge_scores/trust_score/confidence/naturalness/sense_fit/
        translation_faith_en/translation_faith_ru/a2_appropriateness may appear.
        """
        recon = _reconciliation_log(
            "σπίτι",
            {
                "gender": {
                    "value": "neuter",
                    "source": "greek_lexicon",
                    # A real confidence value that must NOT be surfaced.
                    "confidence": 0.87,
                    "flags": ["disagreement"],
                    "cross_checks": [{"source": "wiktionary", "confidence": 0.9}],
                },
            },
        )
        proposal = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            flagged_fields=["gender"],
            generated_fields={"gender": "neuter"},
            reconciliation_log=recon,
            generated_content={
                "gloss_en": "house",
                "gloss_ru": "дом",
                "example_greek": "Το σπίτι είναι μεγάλο.",
                "example_translation": "The house is big.",
            },
            judge_scores={
                "schema_version": "lexgen.judge.v1",
                "judges": [
                    {
                        "slug": "openai/gpt-4.1-mini",
                        "rubric": {
                            "naturalness": 5,
                            "sense_fit": 4,
                            "translation_faith_en": 5,
                            "translation_faith_ru": 4,
                            "a2_appropriateness": 3,
                        },
                        "blocking_issues": [],
                    }
                ],
                "disagreement": None,
            },
            trust_score=0.91,
        )

        response = await client.get(_detail_url(proposal.id), headers=superuser_auth_headers)

        assert response.status_code == 200
        _assert_no_score_keys(response.json(), FORBIDDEN_SCORE_KEYS)

    @pytest.mark.asyncio
    async def test_detail_404_for_non_needs_review(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """A row whose status != needs_review 404s (D-DETAIL-404).

        Test Spec: not-found — a shipped proposal id → 404.
        """
        shipped = await WordProposalFactory.create(status=WordProposalState.SHIPPED, shipped=True)

        response = await client.get(_detail_url(shipped.id), headers=superuser_auth_headers)

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_detail_404_for_unknown_id(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """An unknown id 404s."""
        response = await client.get(_detail_url(uuid4()), headers=superuser_auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_detail_requires_auth(
        self,
        client: AsyncClient,
    ):
        """Unauthenticated detail request returns 401."""
        response = await client.get(_detail_url(uuid4()))
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_detail_forbidden_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Non-superuser detail request returns 403 (no reviewer role, DR §D2)."""
        response = await client.get(_detail_url(uuid4()), headers=auth_headers)
        assert response.status_code == 403


# =============================================================================
# Auth gating (combined spec row) — superuser 200, regular 403, none 401
# =============================================================================


class TestLexgenInboxAuthGating:
    """Test Spec: auth — both endpoints require superuser."""

    @pytest.mark.asyncio
    async def test_endpoints_require_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """A regular authed user gets 403 on BOTH list and detail; a superuser
        gets 200 (list) / a non-403 on a seeded needs_review detail."""
        proposal = await WordProposalFactory.create(status=WordProposalState.NEEDS_REVIEW)

        # Regular user → 403 on both.
        list_regular = await client.get(LIST_URL, headers=auth_headers)
        assert list_regular.status_code == 403
        detail_regular = await client.get(_detail_url(proposal.id), headers=auth_headers)
        assert detail_regular.status_code == 403

        # Superuser → 200 on list; detail is not auth-blocked (200, not 401/403).
        list_super = await client.get(LIST_URL, headers=superuser_auth_headers)
        assert list_super.status_code == 200
        detail_super = await client.get(_detail_url(proposal.id), headers=superuser_auth_headers)
        assert detail_super.status_code not in (401, 403)


# =============================================================================
# QA adversarial / edge coverage (LEXGEN-12-01) — appended by QA (Mode B).
#
# These tests target gaps the AC suite did NOT isolate:
#   - the JSONB JSON-null vs SQL-NULL vs array ordering crash path (the
#     jsonb_typeof CASE guard regression),
#   - a SECOND, independent API-level score poison-pill (different field set),
#   - the content list when generated_content is None,
#   - flagged on a morphological field vs a phantom rubric-dimension name,
#   - a pagination page beyond the last,
#   - both detail 404 branches now that the route exists.
# They do NOT modify the AC tests above and remain black-box over HTTP.
# =============================================================================


class TestLexgenInboxOrderingEdgeCases:
    """Ordering must not crash on JSON-null / SQL-NULL flagged_fields and must
    sort every non-array as length 0 (jsonb_typeof CASE guard)."""

    @pytest.mark.asyncio
    async def test_list_ordering_handles_json_null_and_sql_null(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Mix JSON-null (factory default None → JSONB scalar 'null'), an empty
        array, a 1-flag array and a 2-flag array.

        Regression guard: the factory persists flagged_fields=None as a JSONB
        JSON-null SCALAR, so a naive coalesce(...,'[]') + jsonb_array_length
        throws "cannot get array length of a scalar". The CASE WHEN
        jsonb_typeof='array' guard must treat JSON-null / SQL-NULL / empty-array
        all as length 0.

        Expected order: 2-flag, 1-flag, then the two 0-equivalents by
        created_at ASC (empty-array seeded older than json-null). No 500.
        """
        base = datetime(2026, 2, 1, 9, 0, 0, tzinfo=timezone.utc)
        # two_flag — highest flag count, seeded newest so it can ONLY come first
        # by the flag-count DESC term (isolates that term vs created_at ASC).
        two_flag = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            flagged_fields=["gender", "ipa"],
            created_at=base + timedelta(hours=3),
        )
        one_flag = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            flagged_fields=["gender"],
            created_at=base + timedelta(hours=2),
        )
        # empty_array — 0 flags, OLDER of the two zero-equivalents.
        empty_array = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            flagged_fields=[],
            created_at=base,
        )
        # json_null — factory default flagged_fields=None → JSONB JSON-null
        # scalar (NOT SQL NULL). Newer than empty_array.
        json_null = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            created_at=base + timedelta(hours=1),
        )

        response = await client.get(LIST_URL, headers=superuser_auth_headers)

        # The headline regression assert: this must be 200, never a 500 from
        # jsonb_array_length over a scalar.
        assert response.status_code == 200, response.text
        data = response.json()
        order = [item["id"] for item in data["items"]]
        assert order == [
            str(two_flag.id),
            str(one_flag.id),
            str(empty_array.id),
            str(json_null.id),
        ]
        # The two zero-equivalents both report a 0 count regardless of storage.
        by_id = {item["id"]: item for item in data["items"]}
        assert by_id[str(empty_array.id)]["flagged_field_count"] == 0
        assert by_id[str(json_null.id)]["flagged_field_count"] == 0


class TestLexgenInboxScorePoisonPill:
    """A second, independent API-level score poison-pill with a DIFFERENT field
    set than the AC test — defense in depth, not a copy of AC F6."""

    @pytest.mark.asyncio
    async def test_detail_never_leaks_scores_with_distinct_field_set(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """reconciliation_log.fields carries a confidence (on a different field
        than the AC test) AND judge_scores has a full rubric across TWO judges.
        A recursive key walk over the whole detail response must find none of
        the 8 forbidden score keys."""
        recon = _reconciliation_log(
            "νερό",
            {
                # Different field than the AC F6 test (which used "gender").
                "declension_group": {
                    "value": "neut-o",
                    "source": "triantafyllidis",
                    "confidence": 0.42,
                    "flags": ["low_confidence"],
                    "cross_checks": [
                        {"source": "wiktionary", "confidence": 0.55},
                        {"source": "greek_lexicon", "confidence": 0.61},
                    ],
                },
                "ipa": {
                    "value": "neˈro",
                    "source": "g2p",
                    "confidence": 0.99,
                    "flags": [],
                    "cross_checks": [],
                },
            },
        )
        proposal = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            flagged_fields=["declension_group"],
            generated_fields={"declension_group": "neut-o", "ipa": "neˈro"},
            reconciliation_log=recon,
            generated_content={
                "gloss_en": "water",
                "gloss_ru": "вода",
                "example_greek": "Το νερό είναι κρύο.",
                "example_translation": "The water is cold.",
            },
            judge_scores={
                "schema_version": "lexgen.judge.v1",
                "judges": [
                    {
                        "slug": "openai/gpt-4.1-mini",
                        "rubric": {
                            "naturalness": 4,
                            "sense_fit": 5,
                            "translation_faith_en": 4,
                            "translation_faith_ru": 5,
                            "a2_appropriateness": 4,
                        },
                        "blocking_issues": [],
                    },
                    {
                        "slug": "anthropic/claude-haiku-4.5",
                        "rubric": {
                            "naturalness": 5,
                            "sense_fit": 5,
                            "translation_faith_en": 5,
                            "translation_faith_ru": 4,
                            "a2_appropriateness": 5,
                        },
                        "blocking_issues": [],
                    },
                ],
                "disagreement": None,
            },
            trust_score=0.77,
        )

        response = await client.get(_detail_url(proposal.id), headers=superuser_auth_headers)

        assert response.status_code == 200
        data = response.json()
        _assert_no_score_keys(data, FORBIDDEN_SCORE_KEYS)
        # Sanity: the non-score provenance survived the projection.
        fields = {f["field"]: f for f in data["fields"]}
        assert fields["declension_group"]["value"] == "neut-o"
        assert fields["declension_group"]["source"] == "triantafyllidis"
        assert fields["declension_group"]["flagged"] is True
        assert fields["ipa"]["flagged"] is False


class TestLexgenInboxContentEdgeCases:
    """Detail content list when generated_content is absent, and flagged
    semantics for morphological fields vs phantom rubric-dimension names."""

    @pytest.mark.asyncio
    async def test_detail_content_when_generated_content_none(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """generated_content=None → all 4 content items still present, in fixed
        order, value=None, source='lexgen_generator', flagged computed from
        flagged_fields (example_greek flagged here)."""
        proposal = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            flagged_fields=["example_greek"],
            # generated_content left at factory default (None).
        )

        response = await client.get(_detail_url(proposal.id), headers=superuser_auth_headers)

        assert response.status_code == 200
        content = response.json()["content"]
        assert [c["field"] for c in content] == [
            "gloss_en",
            "gloss_ru",
            "example_greek",
            "example_translation",
        ]
        by_field = {c["field"]: c for c in content}
        for item in content:
            assert set(item.keys()) == {"field", "value", "source", "flagged"}
            assert item["value"] is None
            assert item["source"] == "lexgen_generator"
        assert by_field["example_greek"]["flagged"] is True
        assert by_field["gloss_en"]["flagged"] is False

    @pytest.mark.asyncio
    async def test_detail_flagged_morphological_field_no_phantom_rubric_entry(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """A morphological field present in BOTH reconciliation_log.fields and
        flagged_fields → flagged=true. A rubric-dimension name ("naturalness")
        also sitting in flagged_fields must NOT create a phantom field/content
        entry and must NOT appear anywhere in the response (D-CONTENT-PROVENANCE
        fall-through)."""
        proposal = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            # "naturalness" is a judge rubric dimension that can legitimately
            # land in flagged_fields but has no matching field/content key.
            flagged_fields=["gender", "naturalness"],
            generated_fields={"gender": "neuter"},
            reconciliation_log=_reconciliation_log(
                "σπίτι",
                {"gender": _field_entry("neuter", "greek_lexicon")},
            ),
            generated_content={
                "gloss_en": "house",
                "gloss_ru": "дом",
                "example_greek": "Το σπίτι είναι μεγάλο.",
                "example_translation": "The house is big.",
            },
        )

        response = await client.get(_detail_url(proposal.id), headers=superuser_auth_headers)

        assert response.status_code == 200
        data = response.json()

        # The morphological field is flagged.
        fields = {f["field"]: f for f in data["fields"]}
        assert fields["gender"]["flagged"] is True
        # No phantom "naturalness" field row.
        assert "naturalness" not in fields

        # No content row named "naturalness" either; content stays the 4 keys.
        content_fields = [c["field"] for c in data["content"]]
        assert content_fields == [
            "gloss_en",
            "gloss_ru",
            "example_greek",
            "example_translation",
        ]

        # "naturalness" must not appear as a VALUE anywhere either (it is a
        # rubric dimension name; surfacing it would re-introduce anchoring).
        def _walk_strings(obj):
            if isinstance(obj, dict):
                for v in obj.values():
                    yield from _walk_strings(v)
            elif isinstance(obj, list):
                for v in obj:
                    yield from _walk_strings(v)
            elif isinstance(obj, str):
                yield obj

        assert "naturalness" not in set(_walk_strings(data))


class TestLexgenInboxPaginationBoundary:
    """Page beyond the last returns an empty page with the correct total."""

    @pytest.mark.asyncio
    async def test_list_page_beyond_last_is_empty(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """5 rows, page_size=2 → page 4 (offset 6 > 5) is empty, total stays 5."""
        for _ in range(5):
            await WordProposalFactory.create(status=WordProposalState.NEEDS_REVIEW)

        response = await client.get(
            f"{LIST_URL}?page=4&page_size=2",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert data["page"] == 4
        assert data["page_size"] == 2
        assert data["items"] == []


class TestLexgenInboxDetail404Branches:
    """Both 404 branches genuinely exercised now that the route exists."""

    @pytest.mark.asyncio
    async def test_detail_404_for_scored_proposal(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """A 'scored' (pre-routing) proposal id → 404 (status != needs_review),
        not because the route is missing — a seeded needs_review row resolves
        200, proving the route is live."""
        scored = await WordProposalFactory.create(status=WordProposalState.SCORED)
        live = await WordProposalFactory.create(status=WordProposalState.NEEDS_REVIEW)

        scored_resp = await client.get(_detail_url(scored.id), headers=superuser_auth_headers)
        assert scored_resp.status_code == 404

        # Same route, a needs_review id → 200 (route exists; the 404 above is
        # the status gate, not a missing endpoint).
        live_resp = await client.get(_detail_url(live.id), headers=superuser_auth_headers)
        assert live_resp.status_code == 200

    @pytest.mark.asyncio
    async def test_detail_404_for_unknown_uuid(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """A random unknown UUID → 404."""
        response = await client.get(_detail_url(uuid4()), headers=superuser_auth_headers)
        assert response.status_code == 404
