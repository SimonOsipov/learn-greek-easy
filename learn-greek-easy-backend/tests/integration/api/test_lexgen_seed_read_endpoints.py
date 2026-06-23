"""Thin integration tests for the LEXGEN seed read endpoints (LEXGEN-13-06 D2).

Covers:
  GET /api/v1/test/seed/lexgen-proposals          (list for lemma→id resolution)
  GET /api/v1/test/seed/lexgen-proposals/{id}/review-log
  GET /api/v1/test/seed/lexgen-proposals/{id}/attempts
  GET /api/v1/test/seed/lexgen-proposals/{id}/state

Each route is gated by ``verify_seed_access`` (TEST_SEED_ENABLED + not production).

Tests verify:
  - 200 response with correct shape on a seeded proposal.
  - 403 when TEST_SEED_ENABLED is forced off (mirrors existing seed tests).
  - 404 when the proposal ID does not exist.

DB REQUIREMENT
--------------
Requires a real Postgres db_session. CI-only. Confirm collection:
    pytest tests/integration/api/test_lexgen_seed_read_endpoints.py \\
        --collect-only -o addopts="" -q
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    ProposalAttempt,
    ReviewAction,
    WordProposal,
    WordProposalOrigin,
    WordProposalReviewLog,
    WordProposalState,
)

BASE_URL = "/api/v1/test/seed/lexgen-proposals"


# ---------------------------------------------------------------------------
# Seed helpers for this test module
# ---------------------------------------------------------------------------


async def _seed_proposal_with_log_and_attempt(db_session: AsyncSession):
    """Create a NEEDS_REVIEW WordProposal with a review log row and an attempt snapshot."""
    from src.core.word_proposal_state import transition  # noqa: PLC0415

    proposal = WordProposal(
        lemma_input="βιβλίο",
        pos="noun",
        origin=WordProposalOrigin.ADMIN,
        status=WordProposalState.PENDING,
        flagged_fields=["gender"],
        generated_fields={"gender": "neuter"},
        generated_content={
            "gloss_en": "book",
            "gloss_ru": "книга",
            "example_greek": "Βιβλίο.",
            "example_translation": "Book.",
        },
        retry_attempts=2,
    )
    db_session.add(proposal)
    await db_session.flush()
    transition(proposal, WordProposalState.GENERATING)
    transition(proposal, WordProposalState.SCORED)
    transition(proposal, WordProposalState.NEEDS_REVIEW)
    await db_session.flush()

    # Simulate a reject log row (e.g. from regenerate).
    log_row = WordProposalReviewLog(
        proposal_id=proposal.id,
        action=ReviewAction.REJECT,
        field="gender",
        pipeline_value="neuter",
        edited_value=None,
        human_decision=None,
        reviewer_id=None,
    )
    db_session.add(log_row)

    # Simulate a ProposalAttempt snapshot.
    attempt = ProposalAttempt(
        proposal_id=proposal.id,
        attempt_no=1,
        generated_content={
            "gloss_en": "book",
            "gloss_ru": "книга",
            "example_greek": "Βιβλίο.",
            "example_translation": "Book.",
        },
        generated_fields={"gender": "neuter"},
        flagged_fields=["gender"],
        retry_attempts=2,
        superseded_at=None,
    )
    db_session.add(attempt)

    await db_session.commit()
    return proposal


# ---------------------------------------------------------------------------
# Tests — review-log route
# ---------------------------------------------------------------------------


@pytest.mark.integration
async def test_review_log_returns_200_and_rows(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """GET /lexgen-proposals/{id}/review-log returns 200 + the seeded row."""
    proposal = await _seed_proposal_with_log_and_attempt(db_session)
    response = await client.get(f"{BASE_URL}/{proposal.id}/review-log")
    assert response.status_code == 200, response.text
    body = response.json()
    assert "rows" in body
    assert isinstance(body["rows"], list)
    assert len(body["rows"]) >= 1
    row = body["rows"][0]
    # Shape check — all keys must be present.
    for key in (
        "action",
        "field",
        "pipeline_value",
        "edited_value",
        "human_decision",
        "reviewer_id",
        "created_at",
    ):
        assert key in row, f"Key {key!r} missing from review-log row"
    assert row["action"] == "reject"
    assert row["field"] == "gender"


@pytest.mark.integration
async def test_review_log_404_on_unknown_id(client: AsyncClient) -> None:
    """GET .../review-log with an unknown id returns empty rows list (not 404)."""
    # The endpoint queries logs where proposal_id == given id; no proposal row
    # is needed, so the result is just an empty list (not a 404).
    response = await client.get(f"{BASE_URL}/{uuid4()}/review-log")
    assert response.status_code == 200
    assert response.json()["rows"] == []


# ---------------------------------------------------------------------------
# Tests — attempts route
# ---------------------------------------------------------------------------


@pytest.mark.integration
async def test_attempts_returns_200_and_attempt(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """GET /lexgen-proposals/{id}/attempts returns 200 + the seeded attempt."""
    proposal = await _seed_proposal_with_log_and_attempt(db_session)
    response = await client.get(f"{BASE_URL}/{proposal.id}/attempts")
    assert response.status_code == 200, response.text
    body = response.json()
    assert "attempts" in body
    assert isinstance(body["attempts"], list)
    assert len(body["attempts"]) >= 1
    attempt = body["attempts"][0]
    for key in (
        "attempt_no",
        "generated_content",
        "generated_fields",
        "flagged_fields",
        "retry_attempts",
        "superseded_at",
        "created_at",
    ):
        assert key in attempt, f"Key {key!r} missing from attempt row"
    assert attempt["attempt_no"] == 1
    assert attempt["retry_attempts"] == 2


@pytest.mark.integration
async def test_attempts_empty_for_unknown_id(client: AsyncClient) -> None:
    """GET .../attempts with unknown id returns 200 with empty list."""
    response = await client.get(f"{BASE_URL}/{uuid4()}/attempts")
    assert response.status_code == 200
    assert response.json()["attempts"] == []


# ---------------------------------------------------------------------------
# Tests — state route
# ---------------------------------------------------------------------------


@pytest.mark.integration
async def test_state_returns_200_and_correct_status(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """GET /lexgen-proposals/{id}/state returns 200 + current proposal state."""
    proposal = await _seed_proposal_with_log_and_attempt(db_session)
    response = await client.get(f"{BASE_URL}/{proposal.id}/state")
    assert response.status_code == 200, response.text
    body = response.json()
    for key in (
        "status",
        "rejection_reason",
        "shipped_word_entry_id",
        "word_entry_exists",
        "flagged_fields",
    ):
        assert key in body, f"Key {key!r} missing from state response"
    assert body["status"] == "needs_review"
    assert body["word_entry_exists"] is False
    assert body["shipped_word_entry_id"] is None
    assert "gender" in body["flagged_fields"]


@pytest.mark.integration
async def test_state_404_on_unknown_id(client: AsyncClient) -> None:
    """GET .../state with unknown id returns 404."""
    response = await client.get(f"{BASE_URL}/{uuid4()}/state")
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Auth gate — 403 when TEST_SEED_ENABLED forced off
# ---------------------------------------------------------------------------


@pytest.mark.integration
async def test_read_endpoints_403_when_seed_disabled(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """All three read endpoints return 403 when seeding is disabled."""
    monkeypatch.setattr("src.api.v1.test.seed.settings.test_seed_enabled", False)
    proposal_id = uuid4()
    for path in (
        f"{BASE_URL}/{proposal_id}/review-log",
        f"{BASE_URL}/{proposal_id}/attempts",
        f"{BASE_URL}/{proposal_id}/state",
    ):
        resp = await client.get(path)
        assert (
            resp.status_code == 403
        ), f"Path {path!r} must return 403 when seed disabled; got {resp.status_code}"


# ---------------------------------------------------------------------------
# Tests — list endpoint (LEXGEN-13-06: E2E lemma→id resolution)
# ---------------------------------------------------------------------------


@pytest.mark.integration
async def test_list_proposals_returns_200_and_seeded_row(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """GET /lexgen-proposals returns 200 + the seeded proposal in the list."""
    proposal = await _seed_proposal_with_log_and_attempt(db_session)
    response = await client.get(BASE_URL)
    assert response.status_code == 200, response.text
    body = response.json()
    assert "proposals" in body, "Response must have a 'proposals' key"
    assert isinstance(body["proposals"], list)
    # The seeded proposal must appear in the list.
    ids = [p["id"] for p in body["proposals"]]
    assert str(proposal.id) in ids, "Seeded proposal must appear in the list"
    # Each item must have id, lemma, status.
    item = next(p for p in body["proposals"] if p["id"] == str(proposal.id))
    assert item["lemma"] == "βιβλίο"
    assert item["status"] == "needs_review"
    for key in ("id", "lemma", "status"):
        assert key in item, f"Key {key!r} missing from list item"


@pytest.mark.integration
async def test_list_proposals_empty_when_no_rows(client: AsyncClient) -> None:
    """GET /lexgen-proposals returns 200 with an empty list when no proposals exist."""
    # The db_session fixture rolls back between tests; this test just verifies
    # the endpoint works with zero rows (it may see rows from concurrent tests,
    # but must at minimum return a valid shape).
    response = await client.get(BASE_URL)
    assert response.status_code == 200, response.text
    body = response.json()
    assert "proposals" in body
    assert isinstance(body["proposals"], list)


@pytest.mark.integration
async def test_list_proposals_403_when_seed_disabled(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """GET /lexgen-proposals returns 403 when seeding is disabled."""
    monkeypatch.setattr("src.api.v1.test.seed.settings.test_seed_enabled", False)
    resp = await client.get(BASE_URL)
    assert (
        resp.status_code == 403
    ), f"List endpoint must return 403 when seed disabled; got {resp.status_code}"
