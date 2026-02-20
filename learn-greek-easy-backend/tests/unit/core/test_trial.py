"""Unit tests for trial activation and trial expiration task.

Tests cover:
- Trial activation on signup via get_or_create_user (using real test DB)
- Trial expiration background task (fully mocked)
"""

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.supabase_auth import SupabaseUserClaims
from src.db.models import SubscriptionStatus

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def signup_claims():
    """Fresh Supabase claims for a user that does not yet exist in DB."""
    return SupabaseUserClaims(
        supabase_id=str(uuid4()),
        email=f"trial_{uuid4().hex[:8]}@example.com",
        full_name="Trial Test User",
    )


# ---------------------------------------------------------------------------
# TestTrialActivationOnSignup
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.stripe
class TestTrialActivationOnSignup:
    """Trial fields set on new users in get_or_create_user().

    Uses the real test database because get_or_create_user performs complex
    ORM operations (SELECT with selectinload, INSERT, flush, refresh) that
    would be extremely brittle to mock. PostHog capture_event is patched.
    """

    @pytest.mark.asyncio
    async def test_new_user_gets_trialing_status(self, db_session: AsyncSession, signup_claims):
        """New user created by get_or_create_user gets subscription_status=TRIALING."""
        from src.core.dependencies import get_or_create_user

        with patch("src.core.dependencies.capture_event"):
            user = await get_or_create_user(db_session, signup_claims)

        assert user.subscription_status == SubscriptionStatus.TRIALING

    @pytest.mark.asyncio
    async def test_new_user_gets_trial_start_date(self, db_session: AsyncSession, signup_claims):
        """New user has trial_start_date set to approximately now."""
        from src.core.dependencies import get_or_create_user

        before = datetime.now(timezone.utc)
        with patch("src.core.dependencies.capture_event"):
            user = await get_or_create_user(db_session, signup_claims)
        after = datetime.now(timezone.utc)

        assert user.trial_start_date is not None
        assert before <= user.trial_start_date <= after

    @pytest.mark.asyncio
    async def test_new_user_gets_trial_end_date_14_days(
        self, db_session: AsyncSession, signup_claims
    ):
        """New user has trial_end_date approximately 14 days after trial_start_date."""
        from src.core.dependencies import get_or_create_user

        with patch("src.core.dependencies.capture_event"):
            user = await get_or_create_user(db_session, signup_claims)

        assert user.trial_end_date is not None
        assert user.trial_start_date is not None
        diff = user.trial_end_date - user.trial_start_date
        assert 13 <= diff.days <= 14

    @pytest.mark.asyncio
    async def test_trial_dates_are_timezone_aware(self, db_session: AsyncSession, signup_claims):
        """Trial dates returned from get_or_create_user are timezone-aware."""
        from src.core.dependencies import get_or_create_user

        with patch("src.core.dependencies.capture_event"):
            user = await get_or_create_user(db_session, signup_claims)

        assert user.trial_start_date.tzinfo is not None
        assert user.trial_end_date.tzinfo is not None

    @pytest.mark.asyncio
    async def test_trial_started_posthog_event_fired(self, db_session: AsyncSession, signup_claims):
        """trial_started PostHog event is fired exactly once for new user."""
        from src.core.dependencies import get_or_create_user

        with patch("src.core.dependencies.capture_event") as mock_capture:
            await get_or_create_user(db_session, signup_claims)

        mock_capture.assert_called_once()
        call_kwargs = mock_capture.call_args
        assert call_kwargs.kwargs.get("event") == "trial_started" or (
            len(call_kwargs.args) > 1 and call_kwargs.args[1] == "trial_started"
        )

    @pytest.mark.asyncio
    async def test_trial_started_event_properties(self, db_session: AsyncSession, signup_claims):
        """trial_started event contains required properties."""
        from src.core.dependencies import get_or_create_user

        with patch("src.core.dependencies.capture_event") as mock_capture:
            await get_or_create_user(db_session, signup_claims)

        call_kwargs = mock_capture.call_args
        props = call_kwargs.kwargs.get("properties") or call_kwargs.args[2]
        assert props["trial_duration_days"] == 14
        assert "trial_start_date" in props
        assert "trial_end_date" in props

    @pytest.mark.asyncio
    async def test_trial_started_event_distinct_id(self, db_session: AsyncSession, signup_claims):
        """trial_started event uses str(user.id) as distinct_id."""
        from src.core.dependencies import get_or_create_user

        with patch("src.core.dependencies.capture_event") as mock_capture:
            user = await get_or_create_user(db_session, signup_claims)

        call_kwargs = mock_capture.call_args
        distinct_id = call_kwargs.kwargs.get("distinct_id") or call_kwargs.args[0]
        assert distinct_id == str(user.id)

    @pytest.mark.asyncio
    async def test_existing_user_no_trial_event(self, db_session: AsyncSession, signup_claims):
        """capture_event is NOT called when an existing user is returned."""
        from src.core.dependencies import get_or_create_user

        # Create the user first
        with patch("src.core.dependencies.capture_event"):
            await get_or_create_user(db_session, signup_claims)

        # Second call should return existing user -- no event
        with patch("src.core.dependencies.capture_event") as mock_capture:
            await get_or_create_user(db_session, signup_claims)

        mock_capture.assert_not_called()


# ---------------------------------------------------------------------------
# TestTrialExpirationTask
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.stripe
class TestTrialExpirationTask:
    """Unit tests for the trial_expiration_task background job.

    Uses fully mocked DB engine and session -- no real database required.
    Follows the test_streak_reset.py pattern exactly.
    """

    def _make_expired_user_row(self):
        """Return a fake expired user row tuple."""
        trial_start = datetime.now(timezone.utc) - timedelta(days=15)
        trial_end = trial_start + timedelta(days=14)
        return (uuid4(), "user@example.com", trial_start, trial_end)

    def _setup_mock_session_with_results(self, expired_rows):
        """Create a mock session that returns expired_rows on the SELECT execute."""
        mock_session = AsyncMock()
        mock_select_result = MagicMock()
        mock_select_result.fetchall.return_value = expired_rows
        mock_update_result = MagicMock()
        if expired_rows:
            mock_session.execute.side_effect = [mock_select_result, mock_update_result]
        else:
            mock_session.execute.return_value = mock_select_result
        return mock_session

    def test_import_and_is_async(self):
        """trial_expiration_task is importable and is a coroutine function."""
        from src.tasks.scheduled import trial_expiration_task

        assert asyncio.iscoroutinefunction(trial_expiration_task)

    @pytest.mark.asyncio
    async def test_no_expired_users_skips_update(self, caplog_loguru):
        """When no users have expired trials, only one execute call (SELECT) is made."""
        from src.tasks.scheduled import trial_expiration_task

        mock_session = self._setup_mock_session_with_results([])

        with (
            patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator,
            patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker,
            patch("src.tasks.scheduled.init_posthog"),
            patch("src.tasks.scheduled.is_posthog_enabled", return_value=False),
        ):
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine
            mock_sessionmaker.return_value = MagicMock(return_value=mock_session)

            await trial_expiration_task()

        # Only SELECT, no UPDATE
        assert mock_session.execute.call_count == 1
        mock_session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_expired_users_triggers_update(self, caplog_loguru):
        """When expired users exist, both SELECT and UPDATE are executed."""
        from src.tasks.scheduled import trial_expiration_task

        row = self._make_expired_user_row()
        mock_session = self._setup_mock_session_with_results([row])

        with (
            patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator,
            patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker,
            patch("src.tasks.scheduled.init_posthog"),
            patch("src.tasks.scheduled.is_posthog_enabled", return_value=False),
        ):
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine
            mock_sessionmaker.return_value = MagicMock(return_value=mock_session)

            await trial_expiration_task()

        # SELECT + UPDATE
        assert mock_session.execute.call_count == 2
        mock_session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_posthog_event_fired_per_expired_user(self, caplog_loguru):
        """capture_event is called once per expired user."""
        from src.tasks.scheduled import trial_expiration_task

        rows = [self._make_expired_user_row(), self._make_expired_user_row()]
        mock_session = self._setup_mock_session_with_results(rows)

        with (
            patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator,
            patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker,
            patch("src.tasks.scheduled.init_posthog"),
            patch("src.tasks.scheduled.is_posthog_enabled", return_value=True),
            patch("src.tasks.scheduled.capture_event") as mock_capture,
            patch("src.tasks.scheduled.flush_posthog"),
        ):
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine
            mock_sessionmaker.return_value = MagicMock(return_value=mock_session)

            await trial_expiration_task()

        assert mock_capture.call_count == 2

    @pytest.mark.asyncio
    async def test_posthog_event_properties(self, caplog_loguru):
        """trial_expired event has correct properties."""
        from src.tasks.scheduled import trial_expiration_task

        row = self._make_expired_user_row()
        user_id, email, trial_start, trial_end = row
        mock_session = self._setup_mock_session_with_results([row])

        with (
            patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator,
            patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker,
            patch("src.tasks.scheduled.init_posthog"),
            patch("src.tasks.scheduled.is_posthog_enabled", return_value=True),
            patch("src.tasks.scheduled.capture_event") as mock_capture,
            patch("src.tasks.scheduled.flush_posthog"),
        ):
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine
            mock_sessionmaker.return_value = MagicMock(return_value=mock_session)

            await trial_expiration_task()

        call_kwargs = mock_capture.call_args
        assert (
            call_kwargs.kwargs.get("event") == "trial_expired"
            or call_kwargs.args[1] == "trial_expired"
        )
        props = call_kwargs.kwargs.get("properties") or call_kwargs.args[2]
        assert props["trial_duration_days"] == 14
        assert props["converted"] is False
        assert "trial_start_date" in props
        assert "trial_end_date" in props

    @pytest.mark.asyncio
    async def test_posthog_flush_called(self, caplog_loguru):
        """posthog.flush() is called after firing events."""
        from src.tasks.scheduled import trial_expiration_task

        row = self._make_expired_user_row()
        mock_session = self._setup_mock_session_with_results([row])

        with (
            patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator,
            patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker,
            patch("src.tasks.scheduled.init_posthog"),
            patch("src.tasks.scheduled.is_posthog_enabled", return_value=True),
            patch("src.tasks.scheduled.capture_event"),
            patch("src.tasks.scheduled.flush_posthog") as mock_flush,
        ):
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine
            mock_sessionmaker.return_value = MagicMock(return_value=mock_session)

            await trial_expiration_task()

        mock_flush.assert_called_once()

    @pytest.mark.asyncio
    async def test_posthog_disabled_skips_events(self, caplog_loguru):
        """When PostHog is disabled, capture_event is not called."""
        from src.tasks.scheduled import trial_expiration_task

        row = self._make_expired_user_row()
        mock_session = self._setup_mock_session_with_results([row])

        with (
            patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator,
            patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker,
            patch("src.tasks.scheduled.init_posthog"),
            patch("src.tasks.scheduled.is_posthog_enabled", return_value=False),
            patch("src.tasks.scheduled.capture_event") as mock_capture,
            patch("src.tasks.scheduled.flush_posthog") as mock_flush,
        ):
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine
            mock_sessionmaker.return_value = MagicMock(return_value=mock_session)

            await trial_expiration_task()

        mock_capture.assert_not_called()
        mock_flush.assert_not_called()

    @pytest.mark.asyncio
    async def test_session_closed_on_completion(self, caplog_loguru):
        """Session is closed and engine is disposed on successful completion."""
        from src.tasks.scheduled import trial_expiration_task

        mock_session = self._setup_mock_session_with_results([])

        with (
            patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator,
            patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker,
            patch("src.tasks.scheduled.init_posthog"),
            patch("src.tasks.scheduled.is_posthog_enabled", return_value=False),
        ):
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine
            mock_sessionmaker.return_value = MagicMock(return_value=mock_session)

            await trial_expiration_task()

        mock_session.close.assert_awaited_once()
        mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_engine_disposed_on_error(self, caplog_loguru):
        """Engine is disposed even when an exception occurs."""
        from src.tasks.scheduled import trial_expiration_task

        with (
            patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator,
            patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker,
            patch("src.tasks.scheduled.init_posthog"),
            patch("src.tasks.scheduled.is_posthog_enabled", return_value=False),
        ):
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine
            mock_session = AsyncMock()
            mock_session.execute.side_effect = RuntimeError("DB connection failed")
            mock_sessionmaker.return_value = MagicMock(return_value=mock_session)

            with pytest.raises(RuntimeError):
                await trial_expiration_task()

        mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_error_logged_and_reraised(self, caplog_loguru):
        """Exception during task is logged with logger.error and re-raised."""
        from src.tasks.scheduled import trial_expiration_task

        with (
            patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator,
            patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker,
            patch("src.tasks.scheduled.init_posthog"),
            patch("src.tasks.scheduled.is_posthog_enabled", return_value=False),
        ):
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine
            mock_session = AsyncMock()
            mock_session.execute.side_effect = RuntimeError("DB error")
            mock_sessionmaker.return_value = MagicMock(return_value=mock_session)

            with caplog_loguru.at_level("ERROR"):
                with pytest.raises(RuntimeError):
                    await trial_expiration_task()

        assert "failed" in caplog_loguru.text.lower()

    @pytest.mark.asyncio
    async def test_completed_task_logs_expired_count(self, caplog_loguru):
        """Completed task logs expired_count in structured log output."""
        from src.tasks.scheduled import trial_expiration_task

        mock_session = self._setup_mock_session_with_results([])

        with (
            patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator,
            patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker,
            patch("src.tasks.scheduled.init_posthog"),
            patch("src.tasks.scheduled.is_posthog_enabled", return_value=False),
        ):
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine
            mock_sessionmaker.return_value = MagicMock(return_value=mock_session)

            with caplog_loguru.at_level("INFO"):
                await trial_expiration_task()

        assert "trial expiration" in caplog_loguru.text.lower()
