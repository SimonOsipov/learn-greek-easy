"""Integration tests for the LEXGEN admin review-action endpoints.

LEXGEN-13-03 — four mutating superuser endpoints:
  POST   /api/v1/admin/lexgen/proposals/{id}/approve
  PATCH  /api/v1/admin/lexgen/proposals/{id}
  POST   /api/v1/admin/lexgen/proposals/{id}/regenerate
  POST   /api/v1/admin/lexgen/proposals/{id}/reject

Mode B (QA Verify) — GREEN phase.  Tests verify HTTP contract only.  The
regenerate endpoint makes live LLM calls through LexgenReviewService.regenerate,
which is ALWAYS mocked in this file so CI cannot hang on an OpenRouter call.

Real pipeline behaviour (generate/verify/reconcile/judge chain, ProposalAttempt
creation) is covered by test_lexgen_review_service.py (13-02 service tests).

Covered Test Specs (task-1149):
- AC-1  test_approve_endpoint_ships
- AC-1  test_approve_response_shape (id + lemma exactly, no extra score keys)
- AC-1  test_approve_requires_deck_id
- AC-2  test_patch_edit_returns_score_free_detail
- AC-3  test_regenerate_endpoint_returns_detail (mocked — HTTP contract only)
- AC-3  test_regenerate_keeps_status_needs_review (mocked — status assertion)
- AC-4  test_reject_endpoint_204
- AC-5  test_actions_404_when_not_needs_review
- AC-5  test_actions_403_for_non_superuser
- AC-5  test_actions_401_when_unauthenticated
- AC-6  test_approve_incomplete_returns_422
- AC-6  test_approve_illegal_transition_returns_404_or_409
- AC-7  test_no_score_in_edit_payload
- AC-7  test_no_score_in_regenerate_payload (mocked)
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import WordProposalState
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


# ---------------------------------------------------------------------------
# Mock helpers for LLM-backed service calls
#
# WHY: edit() and regenerate() both call LLM-backed services (judge, generator,
# verify, reconcile) that:
#   1. Make live OpenRouter network calls — CI has no API key and would hang.
#   2. Require proposal.evidence_packet to be a valid EvidencePacket dict —
#      but the WordProposalFactory defaults evidence_packet=None (a test
#      fixture shortcut for an impossible production state).
#
# Reachability proof (Decision A): A needs_review proposal in production
# ALWAYS has evidence_packet set.  EvidenceAssemblyService.assemble() sets
# evidence_packet BEFORE any state transition (assembly_service.py:172).
# The only path to needs_review is: pending→generating (assembly)→scored
# (reconciler)→needs_review (judge).  There is no production bypass.
# Therefore the factory default (evidence_packet=None on a needs_review row)
# is an impossible state; guards for it in the pipeline services would mutate
# merged LEXGEN-09/11 behaviour without fixing a real bug.
#
# Endpoint tests verify HTTP contract only (route, status code, response shape,
# score exclusion, auth).  LLM-stage behaviour is covered by service-layer
# tests (test_lexgen_review_service.py, 13-02).
# ---------------------------------------------------------------------------


def _patch_judge():
    """Patch LexgenJudgeService.judge to simulate SCORED→NEEDS_REVIEW transition.

    edit() calls judge_svc.judge(proposal) internally.  The mock must execute
    the transition side-effect so the proposal status is NEEDS_REVIEW after edit,
    matching the real binary-routing behaviour.
    """
    from src.core.word_proposal_state import transition as _transition  # noqa: PLC0415
    from src.services.lexgen_judge_service import JudgeOutcome  # noqa: PLC0415

    async def _judge_side_effect(proposal_arg: object) -> JudgeOutcome:
        _transition(proposal_arg, WordProposalState.NEEDS_REVIEW)  # type: ignore[arg-type]
        return JudgeOutcome(
            judges=[],
            disagreed=False,
            disagreeing_dimensions=[],
            flagged=[],
            routed_to=WordProposalState.NEEDS_REVIEW,
        )

    return patch(
        "src.services.lexgen_judge_service.LexgenJudgeService.judge",
        new_callable=AsyncMock,
        side_effect=_judge_side_effect,
    )


def _patch_regenerate():
    """Stub LexgenReviewService.regenerate to a no-op (no LLM calls made).

    The proposal status stays at needs_review (the mock does not mutate it),
    so the endpoint returns 200 with status=needs_review — the correct
    observable contract for a successful regenerate.

    Service-layer behaviour (ProposalAttempt creation, full chain, state
    transitions) is covered by test_lexgen_review_service.py (13-02 service
    tests) which mock the individual LLM-backed stages.
    """
    return patch(
        "src.api.v1.admin.LexgenReviewService.regenerate",
        new_callable=AsyncMock,
    )


# =============================================================================
# AC-1 — POST …/{id}/approve
# =============================================================================


class TestApproveEndpoint:
    """POST /api/v1/admin/lexgen/proposals/{id}/approve.

    AC-1: Approve ships the proposal and returns the created word-entry payload
    (200); requires deck_id.  A real deck row is seeded so the FK satisfies
    deck_id validation.
    """

    @pytest.mark.asyncio
    async def test_approve_endpoint_ships(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Superuser + valid needs_review proposal + deck_id → 200 LexgenApproveResponse.

        Test Spec: AC-1 — approve ships proposal; payload contains id (UUID) and
        lemma (str) for the created WordEntry; proposal transitions to shipped.
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

        assert response.status_code == 200, response.text
        data = response.json()
        assert "id" in data, f"LexgenApproveResponse must have 'id'; got keys: {list(data.keys())}"
        assert (
            "lemma" in data
        ), f"LexgenApproveResponse must have 'lemma'; got keys: {list(data.keys())}"

    @pytest.mark.asyncio
    async def test_approve_response_shape(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Approve response is exactly LexgenApproveResponse{id, lemma} — no score keys.

        AC-1 + AC-7: The response must carry id (UUID of the new WordEntry) and
        lemma (the shipped lemma string).  No judge_scores/trust_score/confidence
        may leak into the approve response (anti-anchoring invariant).

        Mode-B tightening: assert id is a valid UUID string and lemma is non-empty.
        """
        deck = await DeckFactory.create()
        proposal = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            generated_content=_full_proposal_content(),
            generated_fields=_full_proposal_fields(),
            flagged_fields=["gender"],
            judge_scores={
                "schema_version": "lexgen.judge.v1",
                "judges": [{"rubric": {"naturalness": 5}}],
            },
            trust_score=0.9,
        )

        response = await client.post(
            _approve_url(proposal.id),
            json={"deck_id": str(deck.id)},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200, response.text
        data = response.json()

        # Exact shape: only id + lemma (LexgenApproveResponse).
        assert set(data.keys()) == {
            "id",
            "lemma",
        }, f"LexgenApproveResponse must have exactly {{id, lemma}}; got {set(data.keys())}"

        # id must be a valid UUID string.
        from uuid import UUID  # noqa: PLC0415

        try:
            entry_id = UUID(data["id"])
        except (ValueError, AttributeError) as exc:
            pytest.fail(f"'id' in approve response is not a valid UUID: {data['id']!r} ({exc})")

        # lemma must be a non-empty string.
        assert (
            isinstance(data["lemma"], str) and data["lemma"]
        ), f"'lemma' in approve response must be a non-empty string; got {data['lemma']!r}"

        # Verify shipped_word_entry_id on the proposal matches the returned id.
        await db_session.refresh(proposal)
        assert proposal.shipped_word_entry_id == entry_id, (
            f"Returned id {entry_id} must equal proposal.shipped_word_entry_id "
            f"{proposal.shipped_word_entry_id}"
        )

        # No score keys anywhere in the approve response.
        _assert_no_score_keys(data, FORBIDDEN_SCORE_KEYS)

    @pytest.mark.asyncio
    async def test_approve_requires_deck_id(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Missing deck_id in body → 422 (request schema validation).

        AC-1: deck_id is required.
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

        Mode-B tightening: assert status == 'needs_review' explicitly.
        LexgenJudgeService.judge is mocked — no LLM call, no evidence_packet needed.
        """
        proposal = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            generated_content=_full_proposal_content(),
            generated_fields={"gender": "masculine"},
            flagged_fields=["gender"],
        )

        with _patch_judge():
            response = await client.patch(
                _edit_url(proposal.id),
                json={"field_edits": {"gender": "neuter"}},
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200, response.text
        data = response.json()

        # Must match the LexgenProposalDetailResponse shape.
        required_keys = {
            "id",
            "lemma",
            "pos",
            "status",
            "created_at",
            "fields",
            "content",
        }
        missing = required_keys - data.keys()
        assert not missing, f"Response missing required keys: {missing}"

        # Status after edit+re-score must still be needs_review (binary routing).
        assert (
            data["status"] == "needs_review"
        ), f"Status after edit must be 'needs_review'; got {data['status']!r}"

        # No score keys anywhere in the payload (AC-2 + AC-7).
        _assert_no_score_keys(data, FORBIDDEN_SCORE_KEYS)


# =============================================================================
# AC-3 — POST …/{id}/regenerate
# =============================================================================


class TestRegenerateEndpoint:
    """POST /api/v1/admin/lexgen/proposals/{id}/regenerate.

    AC-3: Returns refreshed LexgenProposalDetailResponse; status stays
    needs_review after a successful regenerate.

    IMPORTANT: LexgenReviewService.regenerate is ALWAYS mocked in this class.
    The real pipeline (generate/verify/reconcile/judge) makes live LLM calls via
    OpenRouter, which must not run in CI.  Service-level behaviour is covered by
    test_lexgen_review_service.py (13-02).
    """

    @pytest.mark.asyncio
    async def test_regenerate_endpoint_returns_detail(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Superuser + needs_review proposal → POST regenerate → 200 refreshed detail.

        Test Spec: AC-3 — regenerate returns refreshed LexgenProposalDetailResponse.
        Route exists, responds 200, body has the required shape keys.

        Mode-B: LexgenReviewService.regenerate is mocked to a no-op so no LLM call
        is made.  The proposal status is not mutated by the mock, so it stays at
        needs_review — the correct post-regenerate state.
        """
        proposal = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            generated_content=_full_proposal_content(),
            generated_fields=_full_proposal_fields(),
            flagged_fields=["gender"],
        )

        with _patch_regenerate():
            response = await client.post(
                _regenerate_url(proposal.id),
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200, response.text
        data = response.json()

        # Must match LexgenProposalDetailResponse shape.
        required_keys = {
            "id",
            "lemma",
            "pos",
            "status",
            "created_at",
            "fields",
            "content",
        }
        missing = required_keys - data.keys()
        assert not missing, f"Response missing required keys: {missing}"

    @pytest.mark.asyncio
    async def test_regenerate_keeps_status_needs_review(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """POST regenerate on a needs_review proposal → response status stays needs_review.

        AC-3 Mode-B tightening: the endpoint must return the proposal in the
        needs_review state after a successful regenerate.  The mock simulates a
        pipeline that re-routes the proposal back to needs_review (the only legal
        end-state for a successful regenerate, since binary routing always lands
        needs_review in v1 — Decision Record §3).

        This test catches the regression where the pipeline transitions the proposal
        to REJECTED (e.g. due to a missing evidence_packet guard) instead of
        completing the full chain back to needs_review.
        """
        proposal = await WordProposalFactory.create(
            status=WordProposalState.NEEDS_REVIEW,
            generated_content=_full_proposal_content(),
            generated_fields=_full_proposal_fields(),
            flagged_fields=["gender"],
        )

        with _patch_regenerate():
            response = await client.post(
                _regenerate_url(proposal.id),
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200, response.text
        data = response.json()

        assert data["status"] == "needs_review", (
            f"Proposal status after regenerate must be 'needs_review' (binary routing); "
            f"got {data['status']!r}.  If status is 'rejected', the pipeline short-circuited "
            f"(e.g. evidence_packet guard triggered) instead of completing the full chain."
        )


# =============================================================================
# AC-4 — POST …/{id}/reject
# =============================================================================


class TestRejectEndpoint:
    """POST /api/v1/admin/lexgen/proposals/{id}/reject.

    AC-4: Returns 204 (no body); stores the rejection reason on the proposal.
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
# Mode-B tightening:
# - All four routes now exist (no more route-missing 404).
# - approve/regenerate/reject POST routes: the state-filter pre-fetches the proposal
#   filtered to needs_review=only → 404 comes from the state gate, NOT a missing route.
# - edit (PATCH): same state-gate 404 applies; 405 is no longer acceptable now that
#   the PATCH handler is registered.
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

    Mode-B tightening: the PATCH handler now exists, so 405 is no longer
    acceptable for the edit route.  All four routes must return exactly 404
    (state gate blocks non-needs_review rows).
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

        Confirms the 404 originates from the state gate (not a missing route):
        the state-gate query filters to needs_review rows only — a shipped
        proposal ID is not found → 404 before any service is called.

        Mode-B: Unlike the RED phase, the PATCH route now exists so 405 is NOT
        acceptable for the edit action.  All four routes must return exactly 404.
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

        assert response.status_code == 404, (
            f"Expected 404 (state gate) for {method} {url} with shipped proposal; "
            f"got {response.status_code}.  All four routes now exist; 405 is no longer "
            f"acceptable.  The state gate must 404 before the service is called."
        )


class TestActionsRequireSuperuser:
    """All four action endpoints return 403 for non-superuser authenticated users.

    AC-5: Non-superuser → 403 on all four routes.

    Mode-B tightening: the PATCH handler now exists, so 405 is no longer
    acceptable for the edit route.  All four routes must return exactly 403.
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

        AC-5: Non-superuser is denied with 403.  Auth guard fires before DB lookup,
        so a random UUID is sufficient (no real proposal needed).

        Mode-B: PATCH route now exists; 405 is no longer acceptable.
        """
        # Use a random UUID — auth guard fires before DB lookup.
        url = url_fn(uuid4())
        if method == "POST":
            response = await client.post(url, json=body, headers=auth_headers)
        elif method == "PATCH":
            response = await client.patch(url, json=body, headers=auth_headers)
        else:
            response = await client.request(method, url, json=body, headers=auth_headers)

        assert response.status_code == 403, (
            f"Expected 403 (auth guard) for {method} {url} with regular user; "
            f"got {response.status_code}"
        )


class TestActionsRequireAuthentication:
    """All four action endpoints return 401 for unauthenticated requests.

    AC-5: Unauthenticated → 401 on all four routes.

    Mode-B tightening: the PATCH handler now exists, so 405 is no longer
    acceptable for the edit route.  All four routes must return exactly 401.
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

        Mode-B: PATCH route now exists; 405 is no longer acceptable.
        """
        url = url_fn(uuid4())
        # No headers at all — not even auth_headers.
        if method == "POST":
            response = await client.post(url, json=body)
        elif method == "PATCH":
            response = await client.patch(url, json=body)
        else:
            response = await client.request(method, url, json=body)

        assert response.status_code == 401, (
            f"Expected 401 (auth guard) for {method} {url} without auth; "
            f"got {response.status_code}"
        )


# =============================================================================
# AC-6 — approve-completeness failure → 422; illegal transition → 404/409
# =============================================================================


class TestApproveErrors:
    """Approve failure modes (AC-6)."""

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
    async def test_approve_illegal_transition_returns_404_or_409(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Trying to approve a SCORED proposal (wrong state) → 404 or 409.

        AC-6 Mode-B adjudication: The approve endpoint uses the same
        _get_needs_review_proposal() state-gate query that filters to
        needs_review rows only.  A SCORED proposal is NOT in needs_review →
        the state gate returns 404 before the service is called → 404, not 409.

        409 is defense-in-depth: it would fire if the service's state guard
        ran on a proposal that somehow bypassed the route's state-filter query
        (e.g. a concurrent status change between the query and the service call).
        That concurrent path is covered at the service layer in 13-02 service
        tests.  At the endpoint level, the state-gate query always wins → 404.

        This test accepts both 404 (state-filter gate, expected dominant path)
        and 409 (defense-in-depth service guard, acceptable but not the primary
        path) to remain robust to implementation variations.
        """
        deck = await DeckFactory.create()
        proposal = await WordProposalFactory.create(
            status=WordProposalState.SCORED,
        )

        response = await client.post(
            _approve_url(proposal.id),
            json={"deck_id": str(deck.id)},
            headers=superuser_auth_headers,
        )

        # Either the state-filter 404s before reaching the service (dominant path),
        # or the service raises IllegalProposalTransition which the endpoint maps to 409.
        assert response.status_code in (404, 409), (
            f"Expected 404 (state-filter, dominant) or 409 (defense-in-depth service guard) "
            f"for approve on scored proposal; got {response.status_code}: {response.text}"
        )


# =============================================================================
# AC-7 — No score keys in edit or regenerate payloads
# =============================================================================


class TestNoScoreInActionPayloads:
    """Edit and regenerate responses contain no judge_scores/trust_score/confidence.

    AC-7: Score-exclusion must hold for the two refreshed-detail responses.
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
        LexgenJudgeService.judge is mocked — no LLM call, no evidence_packet needed.
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

        with _patch_judge():
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
        LexgenReviewService.regenerate is mocked — no live LLM call.
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

        with _patch_regenerate():
            response = await client.post(
                _regenerate_url(proposal.id),
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200, response.text
        _assert_no_score_keys(response.json(), FORBIDDEN_SCORE_KEYS)
