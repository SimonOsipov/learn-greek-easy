"""Unit tests for reconcile_active_users_task scheduled task.

Tests use mock-everything approach (no real DB) to validate:
- Batching logic for large user populations
- Per-user error isolation (rollback + Sentry capture + continue)
- Kill-switch behaviour (settings.gamification_reconcile_on_read = False)
- Empty active-user list no-op
- Fatal engine/fetch failure: re-raise + Sentry capture

Markers: unit, asyncio
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

# NOTE: All src imports are inside test functions to avoid the Python 3.14 /
# spaCy incompatibility triggered by module-level imports that traverse
# src/services/__init__.py → morphology_service → spacy.
# settings is patched as a MagicMock (not monkeypatched per-attribute) because
# settings.is_production is a @property without a setter.


# ---------------------------------------------------------------------------
# Helper: fake async context manager for "async with sm() as session"
# ---------------------------------------------------------------------------


def _make_session_ctx(session: AsyncMock):
    """Return an async context manager that yields session."""

    @asynccontextmanager
    async def _ctx():
        yield session

    return _ctx()


def _make_sessionmaker(sessions: list[AsyncMock]):
    """Return a callable that hands out sessions from the list in order."""
    index = {"i": 0}

    def _sm():
        s = sessions[index["i"]]
        index["i"] += 1
        return _make_session_ctx(s)

    return _sm


def _mock_settings(*, reconcile_on_read: bool = True) -> MagicMock:
    """Build a settings mock with the fields the task reads."""
    m = MagicMock()
    m.gamification_reconcile_on_read = reconcile_on_read
    m.database_url = "postgresql+asyncpg://test/test"
    m.is_production = False
    return m


# ---------------------------------------------------------------------------
# Test 1: 250 users → reconcile called 250 times with SUMMARY mode
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
async def test_batching_processes_all_users():
    """250 users split across 3 batches → reconcile called exactly 250 times."""
    from src.services.gamification.types import ReconcileMode
    from src.tasks.scheduled_gamification import reconcile_active_users_task

    user_ids = [uuid4() for _ in range(250)]
    mock_reconcile_result = MagicMock()
    mock_reconcile_result.new_unlocks = []

    mock_reconcile = AsyncMock(return_value=mock_reconcile_result)

    # 1 fetch session + 3 batch sessions (ceil(250/100) = 3)
    sessions = [AsyncMock() for _ in range(4)]
    mock_engine = AsyncMock()
    mock_sm = _make_sessionmaker(sessions)

    with (
        patch("src.tasks.scheduled_gamification.settings", _mock_settings()),
        patch("src.tasks.scheduled_gamification.create_async_engine", return_value=mock_engine),
        patch("src.tasks.scheduled_gamification.async_sessionmaker", return_value=mock_sm),
        patch("src.tasks.scheduled_gamification._fetch_active_user_ids", return_value=user_ids),
        patch("src.tasks.scheduled_gamification.GamificationReconciler.reconcile", mock_reconcile),
    ):
        await reconcile_active_users_task()

    assert mock_reconcile.call_count == 250
    # All calls used ReconcileMode.SUMMARY
    for c in mock_reconcile.call_args_list:
        assert c.args[2] == ReconcileMode.SUMMARY


# ---------------------------------------------------------------------------
# Test 2: 250 users → 4 total session contexts (1 fetch + 3 batches)
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
async def test_batches_open_correct_number_of_sessions_for_250_users():
    """250 users: 1 fetch session + 3 batch sessions = 4 total session ctx entries."""
    from src.tasks.scheduled_gamification import reconcile_active_users_task

    user_ids = [uuid4() for _ in range(250)]
    mock_reconcile_result = MagicMock()
    mock_reconcile_result.new_unlocks = []

    call_count = {"n": 0}
    sessions = [AsyncMock() for _ in range(4)]

    def _counting_sm():
        s = sessions[call_count["n"]]
        call_count["n"] += 1
        return _make_session_ctx(s)

    mock_engine = AsyncMock()

    with (
        patch("src.tasks.scheduled_gamification.settings", _mock_settings()),
        patch("src.tasks.scheduled_gamification.create_async_engine", return_value=mock_engine),
        patch("src.tasks.scheduled_gamification.async_sessionmaker", return_value=_counting_sm),
        patch("src.tasks.scheduled_gamification._fetch_active_user_ids", return_value=user_ids),
        patch(
            "src.tasks.scheduled_gamification.GamificationReconciler.reconcile",
            AsyncMock(return_value=mock_reconcile_result),
        ),
    ):
        await reconcile_active_users_task()

    # 1 fetch + 3 batches = 4
    assert call_count["n"] == 4


# ---------------------------------------------------------------------------
# Test 3: per-user error isolation
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
async def test_per_user_error_isolation():
    """Middle user raises → only that user rolled back; others committed; Sentry called once."""
    from src.tasks.scheduled_gamification import reconcile_active_users_task

    user_ids = [uuid4(), uuid4(), uuid4()]

    ok_result = MagicMock()
    ok_result.new_unlocks = []

    reconcile_mock = AsyncMock(side_effect=[ok_result, RuntimeError("boom"), ok_result])

    # 1 fetch session + 1 batch session (3 users fit in 1 batch of 100)
    fetch_session = AsyncMock()
    batch_session = AsyncMock()
    sessions = [fetch_session, batch_session]

    mock_engine = AsyncMock()
    mock_sm = _make_sessionmaker(sessions)

    with (
        patch("src.tasks.scheduled_gamification.settings", _mock_settings()),
        patch("src.tasks.scheduled_gamification.create_async_engine", return_value=mock_engine),
        patch("src.tasks.scheduled_gamification.async_sessionmaker", return_value=mock_sm),
        patch("src.tasks.scheduled_gamification._fetch_active_user_ids", return_value=user_ids),
        patch("src.tasks.scheduled_gamification.GamificationReconciler.reconcile", reconcile_mock),
        patch("src.tasks.scheduled_gamification.sentry_sdk") as mock_sentry,
    ):
        await reconcile_active_users_task()

    # All three users attempted
    assert reconcile_mock.call_count == 3

    # First and third user committed; second user rolled back
    assert batch_session.commit.await_count == 2
    assert batch_session.rollback.await_count == 1

    # Sentry captured exactly once (the failing user)
    mock_sentry.capture_exception.assert_called_once()

    # Engine disposed in finally block
    mock_engine.dispose.assert_awaited_once()


# ---------------------------------------------------------------------------
# Test 4: kill-switch off → returns early
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
async def test_kill_switch_off_returns_early():
    """When gamification_reconcile_on_read is False, fetch and reconcile are NOT called."""
    from src.tasks.scheduled_gamification import reconcile_active_users_task

    mock_fetch = AsyncMock()
    mock_reconcile = AsyncMock()

    with (
        patch("src.tasks.scheduled_gamification.settings", _mock_settings(reconcile_on_read=False)),
        patch("src.tasks.scheduled_gamification._fetch_active_user_ids", mock_fetch),
        patch("src.tasks.scheduled_gamification.GamificationReconciler.reconcile", mock_reconcile),
        patch("src.tasks.scheduled_gamification.create_async_engine") as mock_engine_fn,
    ):
        await reconcile_active_users_task()

    mock_fetch.assert_not_called()
    mock_reconcile.assert_not_called()
    mock_engine_fn.assert_not_called()


# ---------------------------------------------------------------------------
# Test 5: empty active-user list → no batches, task completes cleanly
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
async def test_no_active_users_is_noop():
    """Empty user list: no reconcile calls, task logs and exits cleanly."""
    from src.tasks.scheduled_gamification import reconcile_active_users_task

    fetch_session = AsyncMock()
    mock_engine = AsyncMock()
    call_count = {"n": 0}

    def _sm():
        call_count["n"] += 1
        return _make_session_ctx(fetch_session)

    mock_reconcile = AsyncMock()

    with (
        patch("src.tasks.scheduled_gamification.settings", _mock_settings()),
        patch("src.tasks.scheduled_gamification.create_async_engine", return_value=mock_engine),
        patch("src.tasks.scheduled_gamification.async_sessionmaker", return_value=_sm),
        patch("src.tasks.scheduled_gamification._fetch_active_user_ids", return_value=[]),
        patch("src.tasks.scheduled_gamification.GamificationReconciler.reconcile", mock_reconcile),
    ):
        await reconcile_active_users_task()

    mock_reconcile.assert_not_called()
    # Only the fetch session was opened (1 call to sm())
    assert call_count["n"] == 1
    mock_engine.dispose.assert_awaited_once()


# ---------------------------------------------------------------------------
# Test 6: fatal engine-creation failure → Sentry capture + re-raise
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
async def test_fatal_engine_failure_reraises_and_captures():
    """create_async_engine raises → exception captured to Sentry and re-raised."""
    from src.tasks.scheduled_gamification import reconcile_active_users_task

    fatal_exc = RuntimeError("engine creation failed")

    with (
        patch("src.tasks.scheduled_gamification.settings", _mock_settings()),
        patch(
            "src.tasks.scheduled_gamification.create_async_engine",
            side_effect=fatal_exc,
        ),
        patch("src.tasks.scheduled_gamification.sentry_sdk") as mock_sentry,
    ):
        with pytest.raises(RuntimeError, match="engine creation failed"):
            await reconcile_active_users_task()

    mock_sentry.capture_exception.assert_called_once_with(fatal_exc)
