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
