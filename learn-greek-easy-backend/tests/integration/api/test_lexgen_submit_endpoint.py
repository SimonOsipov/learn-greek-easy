"""RED integration tests for LEXGEN-14-02: POST /api/v1/admin/lexgen/proposals.

Mode A — Test-Spec (pre-implementation).  These tests are authored RED before
the endpoint exists.  They target the observable HTTP contract ONLY, following
the established pattern of test_admin_lexgen_inbox.py and
test_lexgen_review_endpoints.py.

SEAM CONTRACT (pinned by these RED tests):
  POST /api/v1/admin/lexgen/proposals
    Body: LexgenSubmitRequest { lemma: str, pos: str = "noun" }
    Auth: get_current_superuser (403 for non-superuser, 401 for unauthenticated)
    Response: 2xx (201 or 200) with LexgenSubmitResponse {
        id: UUID,
        status: Literal["needs_review", "rejected"],
        rejection_reason: str | None,
    }

  IMPORTANT — 2xx for BOTH paths (Decisions §3 / never-invent):
  - Attested lemma  → status="needs_review", id set, no rejection_reason
  - Never-invent    → status="rejected", id set, rejection_reason contains
                       "never_invent"
  The endpoint must NOT return 400/422 for a semantically-rejected lemma.

Regression guard endpoints (Tests A4/A5) verify the OLD endpoints are removed
and the KEPT endpoints remain functional.

DB REQUIREMENT
--------------
Requires a real Postgres db_session.  The seeding pattern mirrors
test_lexgen_pipeline_service.py: WiktionaryMorphology rows are seeded
directly for the attested path; the never-invent path relies on no reference
rows being present.

FAKE LLM INJECTION
------------------
The new submit endpoint calls LexgenPipelineService(db).run_for_lemma(), which
exposes a module-level _get_openrouter() following the same pattern as the
existing pipeline/review services.  We monkeypatch at
"src.services.lexgen_pipeline_service._get_openrouter" to inject FakeOpenRouter.

Normalization is patched via the same helper used in
test_lexgen_pipeline_service.py so test lemma strings pass through unchanged.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import WiktionaryMorphology, WordProposalState
from src.schemas.nlp import NormalizedLemma
from src.services.lexgen_fake_openrouter import FakeOpenRouter

# ---------------------------------------------------------------------------
# Endpoint path — the new submit endpoint lives under the lexgen proposals base.
# Admin router is mounted at /admin under /api/v1 prefix (router.py:195).
# ---------------------------------------------------------------------------

SUBMIT_URL = "/api/v1/admin/lexgen/proposals"

# Old endpoints that must be GONE after the cutover (AC: old routes removed).
OLD_GENERATE_URL = "/api/v1/admin/word-entries/generate"
OLD_STREAM_URL = "/api/v1/admin/word-entries/generate/stream"

# Kept endpoints that must still work after the cutover (regression guard).
# generate-cards requires a real word_entry_id so we only do a 404 probe
# (route is registered, but the word_entry_id doesn't exist → 404 not 405).
KEPT_CARDS_URL_TEMPLATE = "/api/v1/admin/word-entries/{word_entry_id}/generate-cards"
KEPT_AUDIO_URL_TEMPLATE = "/api/v1/admin/word-entries/{word_entry_id}/generate-audio/stream"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_normalized(lemma: str) -> NormalizedLemma:
    return NormalizedLemma(
        input_word=lemma,
        lemma=lemma,
        gender=None,
        article=None,
        pos="NOUN",
        confidence=1.0,
    )


def _patch_normalize(lemma_out: str):
    """Patch get_lemma_normalization_service so normalize() returns lemma_out verbatim.

    Identical to the helper in test_lexgen_pipeline_service.py.
    """
    normalized = _make_normalized(lemma_out)
    mock_norm_svc = MagicMock()
    mock_norm_svc.normalize = MagicMock(return_value=normalized)
    return patch(
        "src.services.evidence_assembly_service.get_lemma_normalization_service",
        return_value=mock_norm_svc,
    )


async def _seed_wiktionary_row(
    db_session: AsyncSession,
    *,
    lemma: str,
    gender: str = "neuter",
    glosses_en: str = "book",
) -> WiktionaryMorphology:
    """Seed a WiktionaryMorphology row so the lemma is attested.

    Identical to the seeding helper in test_lexgen_pipeline_service.py.
    """
    row = WiktionaryMorphology(
        lemma=lemma,
        pos="noun",
        gender=gender,
        forms=[],
        glosses_en=glosses_en,
    )
    db_session.add(row)
    await db_session.flush()
    return row


# ---------------------------------------------------------------------------
# A1 — Attested lemma → needs_review proposal created
# ---------------------------------------------------------------------------


class TestSubmitAttestedLemma:
    """POST /api/v1/admin/lexgen/proposals with an attested lemma.

    Test Spec A1: superuser; attested lemma (seeded Wiktionary row) + fake
    LLM on → POST → 2xx; body status == "needs_review", id present; a
    word_proposal row exists at needs_review state.
    """

    @pytest.mark.asyncio
    async def test_submit_lemma_attested_creates_needs_review_proposal(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """Attested lemma → 2xx, status='needs_review', id is a UUID.

        The FakeOpenRouter is injected so CI cannot hang on a live LLM call.
        Normalization is stubbed so the test string bypasses spaCy.
        """
        lemma = "βιβλίο_submit_test_a1"

        # Seed reference row so the never-invent gate passes.
        await _seed_wiktionary_row(db_session, lemma=lemma, gender="neuter", glosses_en="book")

        # Inject fake LLM at the pipeline service's seam.
        monkeypatch.setattr(
            "src.services.lexgen_pipeline_service._get_openrouter",
            lambda: FakeOpenRouter(),
        )

        with _patch_normalize(lemma):
            response = await client.post(
                SUBMIT_URL,
                json={"lemma": lemma, "pos": "noun"},
                headers=superuser_auth_headers,
            )

        # Must be 2xx — both 200 and 201 are acceptable per spec.
        assert response.status_code in (
            200,
            201,
        ), f"Expected 2xx for attested lemma; got {response.status_code}: {response.text}"

        data = response.json()

        # Response must carry an id (UUID) and status == "needs_review".
        assert "id" in data, f"Response must have 'id'; got keys: {list(data.keys())}"
        assert "status" in data, f"Response must have 'status'; got keys: {list(data.keys())}"
        assert (
            data["status"] == "needs_review"
        ), f"Attested lemma must return status='needs_review'; got {data['status']!r}"

        # id must be a valid UUID string.
        from uuid import UUID  # noqa: PLC0415

        try:
            UUID(data["id"])
        except (ValueError, AttributeError) as exc:
            pytest.fail(f"'id' in submit response is not a valid UUID: {data['id']!r} ({exc})")

        # Verify the word_proposal row was created at needs_review.
        from sqlalchemy import select  # noqa: PLC0415

        from src.db.models import WordProposal  # noqa: PLC0415

        result = await db_session.execute(
            select(WordProposal).where(
                WordProposal.lemma_input == lemma,
                WordProposal.status == WordProposalState.NEEDS_REVIEW,
            )
        )
        proposal = result.scalar_one_or_none()
        assert proposal is not None, (
            f"A word_proposal row with lemma={lemma!r} and status=needs_review "
            "must exist after a successful submit."
        )

        # Returned id must match the word_proposal.id.
        assert (
            str(proposal.id) == data["id"]
        ), f"Response 'id' ({data['id']}) must match the word_proposal.id ({proposal.id})"


# ---------------------------------------------------------------------------
# A2 — Never-invent path → rejected response (still 2xx, status="rejected")
# ---------------------------------------------------------------------------


class TestSubmitNeverInventLemma:
    """POST with a lemma absent from all references → 2xx, status="rejected".

    Test Spec A2: lemma absent from all refs → POST → 2xx; body
    status == "rejected" with rejection_reason containing "never_invent";
    proposal row is rejected; no card/word_entry created.
    """

    @pytest.mark.asyncio
    async def test_submit_lemma_never_invent_surfaces_rejection(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """Lemma absent from all references → 2xx, status='rejected' with reason.

        CRITICAL: Must NOT be 400/422/4xx — semantic rejection is surfaced via
        the response body, not an HTTP error status (Decisions §3).
        """
        lemma = "ξψζ_never_invent_submit_a2"  # no Wiktionary/frequency rows seeded

        with _patch_normalize(lemma):
            response = await client.post(
                SUBMIT_URL,
                json={"lemma": lemma, "pos": "noun"},
                headers=superuser_auth_headers,
            )

        # Must be 2xx — NOT 400/422 (Decisions §3: never-invent is a 2xx rejection).
        assert response.status_code in (200, 201), (
            f"Expected 2xx for never-invent lemma (semantic rejection in body, "
            f"not HTTP error); got {response.status_code}: {response.text}"
        )

        data = response.json()

        assert "status" in data, f"Response must have 'status'; got keys: {list(data.keys())}"
        assert (
            data["status"] == "rejected"
        ), f"Never-invent lemma must return status='rejected'; got {data['status']!r}"

        assert "id" in data, f"Response must have 'id' even for rejected; got: {list(data.keys())}"

        # Rejection reason must contain "never_invent".
        assert (
            "rejection_reason" in data
        ), f"Response must have 'rejection_reason' for rejected; got: {list(data.keys())}"
        assert (
            data["rejection_reason"] is not None
        ), "rejection_reason must not be None for a rejected lemma"
        assert (
            "never_invent" in data["rejection_reason"]
        ), f"rejection_reason must contain 'never_invent'; got {data['rejection_reason']!r}"

        # Verify the word_proposal row exists and is in rejected state.
        from uuid import UUID  # noqa: PLC0415

        from sqlalchemy import select  # noqa: PLC0415

        from src.db.models import WordProposal  # noqa: PLC0415

        proposal_id = UUID(data["id"])
        result = await db_session.execute(
            select(WordProposal).where(WordProposal.id == proposal_id)
        )
        proposal = result.scalar_one_or_none()
        assert proposal is not None, "word_proposal row must exist for rejected submission"
        assert proposal.status == WordProposalState.REJECTED, (
            f"word_proposal.status must be REJECTED for never-invent lemma; "
            f"got {proposal.status!r}"
        )

        # No word_entry or card should have been created.
        # The word_entry id on the proposal must be None.
        assert proposal.shipped_word_entry_id is None, (
            "shipped_word_entry_id must be None for rejected proposals — "
            "no WordEntry was shipped."
        )


# ---------------------------------------------------------------------------
# A3 — Auth gating: non-superuser → 403
# ---------------------------------------------------------------------------


class TestSubmitAuth:
    """POST /api/v1/admin/lexgen/proposals requires superuser.

    Test Spec A3.
    """

    @pytest.mark.asyncio
    async def test_submit_lemma_requires_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Non-superuser token → 403.

        Auth guard fires before DB lookup; any lemma value works here.
        """
        response = await client.post(
            SUBMIT_URL,
            json={"lemma": "σπίτι", "pos": "noun"},
            headers=auth_headers,
        )
        assert response.status_code == 403, (
            f"Expected 403 for non-superuser on {SUBMIT_URL}; "
            f"got {response.status_code}: {response.text}"
        )

    @pytest.mark.asyncio
    async def test_submit_unauthenticated_returns_401(
        self,
        client: AsyncClient,
    ):
        """No Authorization header → 401."""
        response = await client.post(
            SUBMIT_URL,
            json={"lemma": "σπίτι", "pos": "noun"},
        )
        assert response.status_code == 401, (
            f"Expected 401 for unauthenticated request on {SUBMIT_URL}; "
            f"got {response.status_code}: {response.text}"
        )


# ---------------------------------------------------------------------------
# A4 — Old generate_word_entry endpoints removed
# ---------------------------------------------------------------------------


class TestOldEndpointsGone:
    """POST /admin/word-entries/generate and /admin/word-entries/generate/stream
    must return 404 or 405 after the cutover — these routes are unregistered.

    Test Spec A4.

    Note: before the cutover, these routes exist and return 2xx. After the
    cutover they are removed. These tests are RED now (the routes exist and
    return non-404/405) and GREEN after the cutover.
    """

    @pytest.mark.asyncio
    async def test_old_generate_word_entry_endpoint_gone(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """POST /api/v1/admin/word-entries/generate → 404 or 405 (unregistered).

        RED now (route returns 200 while it still exists).
        GREEN after: route deleted → 404 (or 405 from FastAPI method-not-found
        if the path still matches another route).
        """
        response = await client.post(
            OLD_GENERATE_URL,
            json={"lemma": "σπίτι", "deck_id": "00000000-0000-0000-0000-000000000000"},
            headers=superuser_auth_headers,
        )
        assert response.status_code in (404, 405), (
            f"Expected 404/405 for removed {OLD_GENERATE_URL}; "
            f"got {response.status_code} — route still registered (pre-cutover)."
        )

    @pytest.mark.asyncio
    async def test_old_generate_word_entry_stream_endpoint_gone(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """POST /api/v1/admin/word-entries/generate/stream → 404 or 405 (unregistered).

        RED now (route returns 200/streaming while it still exists).
        GREEN after: route deleted → 404/405.
        """
        response = await client.post(
            OLD_STREAM_URL,
            json={"lemma": "σπίτι", "deck_id": "00000000-0000-0000-0000-000000000000"},
            headers=superuser_auth_headers,
        )
        assert response.status_code in (404, 405), (
            f"Expected 404/405 for removed {OLD_STREAM_URL}; "
            f"got {response.status_code} — route still registered (pre-cutover)."
        )


# ---------------------------------------------------------------------------
# A5 — Kept endpoints unaffected (regression guard)
# ---------------------------------------------------------------------------


class TestKeptEndpointsUnaffected:
    """generate-cards and audio-stream routes must remain registered after cutover.

    Test Spec A5: these routes are on a different path
    (/word-entries/{id}/generate-cards and /word-entries/{id}/generate-audio/stream)
    and are NOT removed.

    Strategy: probe with a random word_entry_id. If the route is registered the
    response is 404 (word entry not found) or 401/403 (auth gate). If the route
    is NOT registered FastAPI returns 405 (Method Not Allowed) or a different
    404 variant.  We accept all non-405 responses for the generate-cards route
    (which is synchronous + superuser-gated → 404 from service).  For the audio
    stream (SSE route that uses a different auth mechanism), we accept any
    non-405 response — the important thing is the route is registered.
    """

    @pytest.mark.asyncio
    async def test_generate_cards_route_still_registered(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """POST /word-entries/{id}/generate-cards → 422 (route is registered, invalid UUID).

        Probing with "not-a-uuid" rather than a random valid UUID ensures the
        response is a 422 validation error (FastAPI rejects the path param) when
        the route IS registered.  A 404 or 405 would indicate the route was
        accidentally removed, since an unregistered path returns 404/405 regardless
        of the path-param value.
        """
        url = KEPT_CARDS_URL_TEMPLATE.format(word_entry_id="not-a-uuid")
        response = await client.post(
            url,
            json={"card_type": "meaning"},
            headers=superuser_auth_headers,
        )
        assert response.status_code not in (404, 405), (
            f"Generate-cards route {url} returned {response.status_code} — "
            "route registration is ambiguous/possibly removed. "
            "Expected 422 (invalid UUID path param) when the route is registered."
        )

    @pytest.mark.asyncio
    async def test_audio_stream_route_still_registered(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """POST /word-entries/{id}/generate-audio/stream → 422 (route registered, invalid UUID).

        Probing with "not-a-uuid" ensures a registered route returns 422 (path-param
        validation failure).  A 404 or 405 would indicate the route was accidentally
        removed or is unreachable.
        """
        url = KEPT_AUDIO_URL_TEMPLATE.format(word_entry_id="not-a-uuid")
        response = await client.post(
            url,
            headers=superuser_auth_headers,
        )
        assert response.status_code not in (404, 405), (
            f"Audio-stream route {url} returned {response.status_code} — "
            "route registration is ambiguous/possibly removed. "
            "Expected 422 (invalid UUID path param) when the route is registered."
        )
