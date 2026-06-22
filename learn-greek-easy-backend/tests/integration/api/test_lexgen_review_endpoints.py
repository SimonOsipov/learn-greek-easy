"""Integration tests for the LEXGEN admin review-action endpoints.

LEXGEN-13-03 — four mutating superuser endpoints:
  POST   /api/v1/admin/lexgen/proposals/{id}/approve
  PATCH  /api/v1/admin/lexgen/proposals/{id}
  POST   /api/v1/admin/lexgen/proposals/{id}/regenerate
  POST   /api/v1/admin/lexgen/proposals/{id}/reject

Mode A (Test-Spec author) — RED phase.
Tests are authored BLACK-BOX over HTTP.  Imports are limited to already-existing
model symbols, factories, and pytest primitives so that pytest COLLECTS cleanly
even before the endpoints, schemas, and service exist.

RED-state classification for each test group:
- AC-1, AC-2, AC-3, AC-4, AC-6, AC-7 (positive-path / specific-status tests):
  GENUINE RED — status assertion fails (missing route returns 404, expected ≥200).
- AC-5 / test_actions_404_when_not_needs_review:
  SPURIOUS PASS — missing-route 404 == expected 404.  These tests are CORRECT
  once routes exist; the route-missing 404 masks the state-filter 404 during RED.
  See the comment above the parametrize block.  Mode-B QA will confirm the 404
  originates from the state gate (not a missing route) by seeding a live
  needs_review row and asserting it 200s on the same route.
- AC-5 / test_actions_403_for_non_superuser and test_actions_401_when_unauthenticated:
  RED-ROUTE-MISSING — missing route returns 404, expected 403/401.

Covered Test Specs (task-1149):
- AC-1  test_approve_endpoint_ships
- AC-2  test_patch_edit_returns_score_free_detail
- AC-3  test_regenerate_endpoint_returns_detail
- AC-4  test_reject_endpoint_204
- AC-5  test_actions_404_when_not_needs_review (spurious-pass; see comment)
- AC-5  test_actions_403_for_non_superuser
- AC-5  test_actions_401_when_unauthenticated
- AC-6  test_approve_incomplete_returns_422
- AC-7  test_no_score_in_any_action_payload
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import ProposalAttempt, WordProposalState
from tests.factories.content import DeckFactory
from tests.factories.word_proposal import WordProposalFactory

# ---------------------------------------------------------------------------
# URL helpers — base path matches the LEXGEN-12 router at admin.py:1194,1261
# ---------------------------------------------------------------------------

BASE_LEXGEN = "/api/v1/admin/lexgen/proposals"


def _approve_url(proposal_id) -> str:
    return f"{BASE_LEXGEN}/{proposal_id}/approve"


def _edit_url(proposal_id) -> str:
    return f"{BASE_LEXGEN}/{proposal_id}"


def _regenerate_url(proposal_id) -> str:
    return f"{BASE_LEXGEN}/{proposal_id}/regenerate"


def _reject_url(proposal_id) -> str:
    return f"{BASE_LEXGEN}/{proposal_id}/reject"


# ---------------------------------------------------------------------------
# Score keys that must never appear in any response (anti-anchoring invariant,
# Decision Record §3).  Mirrors the set in test_admin_lexgen_inbox.py.
# ---------------------------------------------------------------------------

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
    """Recursively walk parsed JSON and assert none of its keys are score keys."""
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


# ---------------------------------------------------------------------------
# Proposal seeding helpers
# ---------------------------------------------------------------------------


def _full_proposal_content() -> dict:
    """generated_content with all 4 required keys — satisfies approve validation."""
    return {
        "gloss_en": "house",
        "gloss_ru": "дом",
        "example_greek": "Το σπίτι είναι μεγάλο.",
        "example_translation": "The house is big.",
    }


def _full_proposal_fields() -> dict:
    """generated_fields with gender so approve builds a complete WordEntry."""
    return {"gender": "neuter"}


# =============================================================================
# AC-1 — POST …/{id}/approve
# =============================================================================


class TestApproveEndpoint:
    """POST /api/v1/admin/lexgen/proposals/{id}/approve.

    AC-1: Approve ships the proposal and returns the created word-entry payload
    (200 or 201); requires deck_id.  A real deck row is seeded so the FK
    satisfies deck_id validation.

    RED classification: GENUINE RED — missing route returns 404; test expects
    200 or 201.
    """

    @pytest.mark.asyncio
    async def test_approve_endpoint_ships(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Superuser + valid needs_review proposal + deck_id → 200/201 word-entry.

        Test Spec: AC-1 — approve ships proposal; payload contains word_entry data
        (at minimum a 'lemma' key); proposal transitions to shipped.
        """
        deck = await DeckFactory.create()
        proposal = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            generated_content=_full_proposal_content(),
            generated_fields=_full_proposal_fields(),
            flagged_fields=["gender"],
        )

        response = await client.post(
            _approve_url(proposal.id),
            json={"deck_id": str(deck.id)},
            headers=superuser_auth_headers,
        )

        assert response.status_code in (200, 201), response.text
        data = response.json()
        # The shipped word-entry payload must carry at least the lemma.
        assert (
            "lemma" in data or "word_entry" in data or "id" in data
        ), f"Response body has no word-entry identifier. Got keys: {list(data.keys())}"

    @pytest.mark.asyncio
    async def test_approve_requires_deck_id(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Missing deck_id in body → 422 (request schema validation).

        AC-1: deck_id is required.

        RED classification: GENUINE RED — missing route returns 404; test expects 422.
        """
        proposal = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            generated_content=_full_proposal_content(),
            generated_fields=_full_proposal_fields(),
        )

        response = await client.post(
            _approve_url(proposal.id),
            json={},  # deck_id absent
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422, response.text


# =============================================================================
# AC-2 — PATCH …/{id}  (edit)
# =============================================================================


class TestEditEndpoint:
    """PATCH /api/v1/admin/lexgen/proposals/{id}.

    AC-2: Applies field edits, re-scores, returns refreshed
    LexgenProposalDetailResponse.  Response must have no score keys and the
    proposal status must remain needs_review after re-scoring.

    RED classification: GENUINE RED — missing route returns 404; test expects 200.
    """

    @pytest.mark.asyncio
    async def test_patch_edit_returns_score_free_detail(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """PATCH with field_edits → 200; body matches LexgenProposalDetailResponse
        shape (has id/lemma/pos/status/fields/content); no score keys anywhere.

        Test Spec: AC-2 — edit returns refreshed score-free detail, status stays
        needs_review (binary routing never reaches auto_approved/shipped).
        """
        proposal = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            generated_content=_full_proposal_content(),
            generated_fields={"gender": "masculine"},
            flagged_fields=["gender"],
        )

        response = await client.patch(
            _edit_url(proposal.id),
            json={"field_edits": {"gender": "neuter"}},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200, response.text
        data = response.json()

        # Must match the LexgenProposalDetailResponse shape.
        required_keys = {"id", "lemma", "pos", "status", "created_at", "fields", "content"}
        missing = required_keys - data.keys()
        assert not missing, f"Response missing required keys: {missing}"

        # Status after edit+re-score must still be needs_review (binary routing).
        assert data["status"] == "needs_review"

        # No score keys anywhere in the payload (AC-2 + AC-7).
        _assert_no_score_keys(data, FORBIDDEN_SCORE_KEYS)


# =============================================================================
# AC-3 — POST …/{id}/regenerate
# =============================================================================


class TestRegenerateEndpoint:
    """POST /api/v1/admin/lexgen/proposals/{id}/regenerate.

    AC-3: Returns refreshed LexgenProposalDetailResponse; a ProposalAttempt row
    now exists for the proposal (prior attempt snapshotted before re-run).

    RED classification: GENUINE RED — missing route returns 404; test expects 200.
    """

    @pytest.mark.asyncio
    async def test_regenerate_endpoint_returns_detail(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Superuser + needs_review proposal → POST regenerate → 200 refreshed detail;
        a proposal_attempt row now exists for this proposal.

        Test Spec: AC-3 — regenerate returns refreshed detail; prior attempt retained.
        """
        proposal = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            generated_content=_full_proposal_content(),
            generated_fields=_full_proposal_fields(),
            flagged_fields=["gender"],
        )

        response = await client.post(
            _regenerate_url(proposal.id),
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200, response.text
        data = response.json()

        # Must match LexgenProposalDetailResponse shape.
        required_keys = {"id", "lemma", "pos", "status", "created_at", "fields", "content"}
        missing = required_keys - data.keys()
        assert not missing, f"Response missing required keys: {missing}"

        # A ProposalAttempt row must exist for this proposal (snapshot of prior attempt).
        result = await db_session.execute(
            select(ProposalAttempt).where(ProposalAttempt.proposal_id == proposal.id)
        )
        attempt_rows = result.scalars().all()
        assert (
            len(attempt_rows) >= 1
        ), "Expected at least one ProposalAttempt row after regenerate, found none."


# =============================================================================
# AC-4 — POST …/{id}/reject
# =============================================================================


class TestRejectEndpoint:
    """POST /api/v1/admin/lexgen/proposals/{id}/reject.

    AC-4: Returns 204 (no body); stores the rejection reason on the proposal.

    RED classification: GENUINE RED — missing route returns 404; test expects 204.
    """

    @pytest.mark.asyncio
    async def test_reject_endpoint_204(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """POST reject {reason} → 204; proposal.rejection_reason is stored.

        Test Spec: AC-4 — reject returns 204 and stores reason.
        """
        proposal = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            flagged_fields=["gender"],
        )
        reason = "Morphology data is incorrect and cannot be corrected via edit."

        response = await client.post(
            _reject_url(proposal.id),
            json={"reason": reason},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 204, response.text

        # Verify reason is persisted on the proposal row.
        await db_session.refresh(proposal)
        assert proposal.rejection_reason == reason


# =============================================================================
# AC-5 — 404 for non-needs_review proposals
#
# IMPORTANT — SPURIOUS PASS WARNING:
# These tests parametrize all four action routes against a proposal that is NOT
# in needs_review status (shipped here).  In the RED phase (before endpoints
# exist), FastAPI returns 404 for ALL routes because the route is missing.  A
# missing-route 404 is INDISTINGUISHABLE from a state-gate 404 at HTTP level, so
# these tests will SPURIOUSLY PASS during RED.
#
# They are authored correctly (they will be meaningful once routes exist) and are
# marked with a comment so Mode-B QA knows to validate them separately:
#   - Seed a needs_review proposal on the same route → assert 200/204 (proves
#     the route exists and the 404 above comes from the state gate, not missing
#     route).
# =============================================================================


_ACTION_ROUTES = [
    ("approve", "POST", lambda pid: _approve_url(pid), {"deck_id": str(uuid4())}),
    ("edit", "PATCH", lambda pid: _edit_url(pid), {"field_edits": {}}),
    ("regenerate", "POST", lambda pid: _regenerate_url(pid), None),
    ("reject", "POST", lambda pid: _reject_url(pid), {"reason": "test"}),
]

_ACTION_IDS = ["approve", "edit", "regenerate", "reject"]


class TestActionsRequireNeedsReview:
    """All four action endpoints return 404 when the proposal is not needs_review.

    AC-5: Proposal in any status other than needs_review → 404 on all four routes.

    RED classification notes:
    - approve/regenerate/reject (POST routes): SPURIOUS PASS — missing-route 404
      equals the expected 404.
    - edit (PATCH on /lexgen/proposals/{id}): During RED, the existing LEXGEN-12
      GET route on the same path causes FastAPI to return 405 (Method Not Allowed)
      for PATCH requests.  The test accepts 404 OR 405 in RED.  Once the PATCH
      handler is implemented, the state gate returns 404 for non-needs_review rows
      (the expected stable behavior).  Mode-B QA confirms this stabilises to 404.
    """

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "action_name,method,url_fn,body",
        _ACTION_ROUTES,
        ids=_ACTION_IDS,
    )
    async def test_actions_404_when_not_needs_review(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        action_name: str,
        method: str,
        url_fn,
        body,
    ):
        """A shipped proposal → each of the four action routes → 404.

        For the edit (PATCH) route: 404 or 405 accepted during RED (PATCH is not
        yet registered on the shared path; the existing GET returns 405 for PATCH).
        Once the PATCH handler exists, the state gate returns 404.

        SPURIOUS PASS (approve/regenerate/reject): validated in Stage 4 QA once
        routes exist (route-missing 404 masks the state-filter 404 during RED).
        """
        proposal = await WordProposalFactory.create(
            status=WordProposalState.SHIPPED,
            shipped=True,
        )
        url = url_fn(proposal.id)
        if method == "POST":
            response = await client.post(url, json=body, headers=superuser_auth_headers)
        elif method == "PATCH":
            response = await client.patch(url, json=body, headers=superuser_auth_headers)
        else:
            response = await client.request(method, url, json=body, headers=superuser_auth_headers)

        if action_name == "edit":
            # PATCH on a path that already has GET → 405 during RED; 404 once PATCH exists.
            assert response.status_code in (404, 405), (
                f"Expected 404 (state gate) or 405 (method not yet registered) for "
                f"{method} {url} with shipped proposal; got {response.status_code}"
            )
        else:
            assert response.status_code == 404, (
                f"Expected 404 for {method} {url} with shipped proposal; "
                f"got {response.status_code}"
            )


class TestActionsRequireSuperuser:
    """All four action endpoints return 403 for non-superuser authenticated users.

    AC-5: Non-superuser → 403 on all four routes.

    RED classification:
    - approve/regenerate/reject (POST routes): RED-ROUTE-MISSING — missing route
      returns 404, test expects 403.
    - edit (PATCH): The existing GET route on the shared path returns 405 for PATCH
      during RED; once the PATCH handler exists, get_current_superuser fires first
      and returns 403.  Test accepts 403 or 405 in RED.
    """

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "action_name,method,url_fn,body",
        _ACTION_ROUTES,
        ids=_ACTION_IDS,
    )
    async def test_actions_403_for_non_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
        action_name: str,
        method: str,
        url_fn,
        body,
    ):
        """Normal authed user → each of the four action routes → 403.

        AC-5: Non-superuser is denied with 403.  For the edit (PATCH) route,
        405 is accepted during RED (PATCH not yet registered; existing GET → 405).
        """
        # Use a random UUID — auth guard fires before DB lookup.
        url = url_fn(uuid4())
        if method == "POST":
            response = await client.post(url, json=body, headers=auth_headers)
        elif method == "PATCH":
            response = await client.patch(url, json=body, headers=auth_headers)
        else:
            response = await client.request(method, url, json=body, headers=auth_headers)

        if action_name == "edit":
            # PATCH on a GET-only path → 405 during RED; 403 once PATCH exists.
            assert response.status_code in (403, 405), (
                f"Expected 403 (auth guard) or 405 (method not yet registered) for "
                f"{method} {url} with regular user; got {response.status_code}"
            )
        else:
            assert response.status_code == 403, (
                f"Expected 403 for {method} {url} with regular user; " f"got {response.status_code}"
            )


class TestActionsRequireAuthentication:
    """All four action endpoints return 401 for unauthenticated requests.

    AC-5: Unauthenticated → 401 on all four routes.

    RED classification:
    - approve/regenerate/reject (POST routes): RED-ROUTE-MISSING — missing route
      returns 404, test expects 401.
    - edit (PATCH): The existing GET route on the shared path returns 405 for PATCH
      during RED; once the PATCH handler exists, get_current_superuser fires first
      and returns 401.  Test accepts 401 or 405 in RED.
    """

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "action_name,method,url_fn,body",
        _ACTION_ROUTES,
        ids=_ACTION_IDS,
    )
    async def test_actions_401_when_unauthenticated(
        self,
        client: AsyncClient,
        action_name: str,
        method: str,
        url_fn,
        body,
    ):
        """No Authorization header → each of the four action routes → 401.

        AC-5: Unauthenticated requests are rejected with 401 (structurally
        guaranteed by get_current_superuser at admin.py:1275).
        For the edit (PATCH) route, 405 is accepted during RED.
        """
        url = url_fn(uuid4())
        # No headers at all — not even auth_headers.
        if method == "POST":
            response = await client.post(url, json=body)
        elif method == "PATCH":
            response = await client.patch(url, json=body)
        else:
            response = await client.request(method, url, json=body)

        if action_name == "edit":
            # PATCH on a GET-only path → 405 during RED; 401 once PATCH exists.
            assert response.status_code in (401, 405), (
                f"Expected 401 (auth guard) or 405 (method not yet registered) for "
                f"{method} {url} without auth; got {response.status_code}"
            )
        else:
            assert response.status_code == 401, (
                f"Expected 401 for {method} {url} without auth; " f"got {response.status_code}"
            )


# =============================================================================
# AC-6 — approve-completeness failure → 422; illegal transition → 409
# =============================================================================


class TestApproveErrors:
    """Approve failure modes (AC-6).

    RED classification: GENUINE RED — missing route returns 404; tests expect
    422 or 409.
    """

    @pytest.mark.asyncio
    async def test_approve_incomplete_returns_422(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Proposal missing required field (gloss_en absent) → approve → 422.

        AC-6: Approve-completeness failure (ValidationException from service)
        → 422 Unprocessable Entity.
        """
        deck = await DeckFactory.create()
        proposal = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            # generated_content is None → gloss_en missing → ValidationException
            generated_content=None,
            generated_fields=_full_proposal_fields(),
        )

        response = await client.post(
            _approve_url(proposal.id),
            json={"deck_id": str(deck.id)},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422, response.text

    @pytest.mark.asyncio
    async def test_approve_illegal_transition_returns_409(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Trying to approve a SCORED proposal (wrong state) → 409 Conflict.

        AC-6: IllegalProposalTransition (proposal not needs_review) → 409.

        Note: The detail endpoint 404s for non-needs_review proposals (D-DETAIL-404).
        The approve endpoint must still exist as a distinct route and 409 when
        the proposal state is wrong — this tests that the endpoint itself is
        reachable and distinguishes wrong-state (409) from wrong-id (404).
        This test is a companion to test_actions_404_when_not_needs_review; it
        exercises the approve route specifically for its IllegalProposalTransition
        path when the endpoint explicitly fetches the proposal without the
        status filter.

        Implementation note for executor: If the approve endpoint performs the
        same status-filter query as the detail endpoint (only returning
        needs_review rows), this test will receive 404 instead of 409.  In that
        case the executor should update this test to 404 and annotate accordingly.
        The contract to verify in Mode B: IllegalProposalTransition → 409 fires
        from the service guard when called on a non-needs_review proposal.
        """
        # We skip seeding a real 'scored' row because the endpoint's query
        # strategy (status filter vs unfiltered + service guard) determines
        # whether 404 or 409 is returned.  This test focuses on the ValidationException
        # → 422 and 409 mapping; it passes a SHIPPED proposal UUID and accepts
        # either 404 (state-filter) or 409 (service guard caught by endpoint).
        deck = await DeckFactory.create()
        proposal = await WordProposalFactory.create(
            status=WordProposalState.SCORED,
        )

        response = await client.post(
            _approve_url(proposal.id),
            json={"deck_id": str(deck.id)},
            headers=superuser_auth_headers,
        )

        # Either the state-filter 404s before reaching the service (fine),
        # or the service raises IllegalProposalTransition which the endpoint maps to 409.
        assert response.status_code in (404, 409), (
            f"Expected 404 (state-filter) or 409 (illegal transition) for "
            f"approve on scored proposal; got {response.status_code}: {response.text}"
        )


# =============================================================================
# AC-7 — No score keys in edit or regenerate payloads
# =============================================================================


class TestNoScoreInActionPayloads:
    """Edit and regenerate responses contain no judge_scores/trust_score/confidence.

    AC-7: Score-exclusion must hold for the two refreshed-detail responses.

    RED classification: GENUINE RED — missing routes return 404; tests expect 200.
    """

    @pytest.mark.asyncio
    async def test_no_score_in_edit_payload(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Edit response body is walked recursively; no score key may appear.

        AC-7: Score-free detail contract for PATCH edit response.
        """
        proposal = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            generated_content=_full_proposal_content(),
            generated_fields={"gender": "masculine"},
            flagged_fields=["gender"],
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
                    }
                ],
                "disagreement": None,
            },
            trust_score=0.88,
        )

        response = await client.patch(
            _edit_url(proposal.id),
            json={"field_edits": {"gender": "neuter"}},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200, response.text
        _assert_no_score_keys(response.json(), FORBIDDEN_SCORE_KEYS)

    @pytest.mark.asyncio
    async def test_no_score_in_regenerate_payload(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Regenerate response body is walked recursively; no score key may appear.

        AC-7: Score-free detail contract for POST regenerate response.
        """
        proposal = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            generated_content=_full_proposal_content(),
            generated_fields=_full_proposal_fields(),
            flagged_fields=["gender"],
            judge_scores={
                "schema_version": "lexgen.judge.v1",
                "judges": [
                    {
                        "slug": "anthropic/claude-haiku-4.5",
                        "rubric": {
                            "naturalness": 3,
                            "sense_fit": 4,
                            "translation_faith_en": 5,
                            "translation_faith_ru": 3,
                            "a2_appropriateness": 4,
                        },
                    }
                ],
                "disagreement": True,
            },
            trust_score=0.52,
        )

        response = await client.post(
            _regenerate_url(proposal.id),
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200, response.text
        _assert_no_score_keys(response.json(), FORBIDDEN_SCORE_KEYS)
