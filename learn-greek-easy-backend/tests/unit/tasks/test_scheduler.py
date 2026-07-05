"""Unit tests for APScheduler configuration module."""

import asyncio
from unittest.mock import MagicMock, patch

import pytest

from src.tasks.scheduler import get_scheduler, job_listener, setup_scheduler, shutdown_scheduler


class TestSchedulerImports:
    """Test that scheduler functions can be imported correctly."""

    def test_import_from_tasks_package(self):
        """Test importing scheduler functions from src.tasks package."""
        from src.tasks import get_scheduler, setup_scheduler, shutdown_scheduler

        assert callable(setup_scheduler)
        assert callable(shutdown_scheduler)
        assert callable(get_scheduler)

    def test_import_from_scheduler_module(self):
        """Test importing directly from scheduler module."""
        from src.tasks.scheduler import (
            get_scheduler,
            job_listener,
            setup_scheduler,
            shutdown_scheduler,
        )

        assert callable(setup_scheduler)
        assert callable(shutdown_scheduler)
        assert callable(get_scheduler)
        assert callable(job_listener)


class TestSchedulerSetup:
    """Test scheduler setup and initialization."""

    def test_disabled_when_feature_flag_false(self):
        """Test that scheduler doesn't start when feature flag is disabled."""
        import src.tasks.scheduler as scheduler_module

        # Reset global state
        scheduler_module._scheduler = None

        with patch.object(scheduler_module, "settings") as mock_settings:
            mock_settings.feature_background_tasks = False

            setup_scheduler()

            # Scheduler should not be created
            assert get_scheduler() is None

    def test_starts_when_feature_flag_true(self):
        """Test that scheduler starts when feature flag is enabled."""
        import src.tasks.scheduler as scheduler_module

        # Reset global state
        scheduler_module._scheduler = None

        with (
            patch.object(scheduler_module, "settings") as mock_settings,
            patch("src.tasks.scheduler.AsyncIOScheduler") as mock_scheduler_class,
        ):
            mock_settings.feature_background_tasks = True
            mock_settings.streak_reset_hour_utc = 0

            mock_scheduler_instance = MagicMock()
            mock_scheduler_instance.get_jobs.return_value = []
            mock_scheduler_class.return_value = mock_scheduler_instance

            setup_scheduler()

            # Scheduler should be created and started
            mock_scheduler_class.assert_called_once()
            mock_scheduler_instance.start.assert_called_once()

    def test_registers_all_jobs(self):
        """Test that all scheduled jobs are registered."""
        import src.tasks.scheduler as scheduler_module

        # Reset global state
        scheduler_module._scheduler = None

        with (
            patch.object(scheduler_module, "settings") as mock_settings,
            patch("src.tasks.scheduler.AsyncIOScheduler") as mock_scheduler_class,
        ):
            mock_settings.feature_background_tasks = True
            mock_settings.streak_reset_hour_utc = 0

            mock_scheduler_instance = MagicMock()
            mock_scheduler_instance.get_jobs.return_value = []
            mock_scheduler_class.return_value = mock_scheduler_instance

            setup_scheduler()

            # Should have 6 add_job calls (4 original + gamification reconcile + heartbeat)
            # OPS-01-02: heartbeat_task added on IntervalTrigger(minutes=5) → 5 → 6.
            assert mock_scheduler_instance.add_job.call_count == 6

            # Verify all job IDs are registered
            job_ids = [call[1]["id"] for call in mock_scheduler_instance.add_job.call_args_list]
            assert "streak_reset" in job_ids
            assert "session_cleanup" in job_ids
            assert "stats_aggregate" in job_ids
            assert "trial_expiration" in job_ids
            assert "gamification_reconcile_active_users" in job_ids

            # Verify the new gamification job uses CronTrigger(hour=3, minute=0)
            from apscheduler.triggers.cron import CronTrigger

            gamif_call = next(
                call
                for call in mock_scheduler_instance.add_job.call_args_list
                if call[1]["id"] == "gamification_reconcile_active_users"
            )
            trigger_arg = gamif_call[0][1]  # second positional arg is the trigger
            assert isinstance(trigger_arg, CronTrigger)
            trigger_repr = str(trigger_arg)
            assert "hour='3'" in trigger_repr, f"Expected hour='3' in trigger repr: {trigger_repr}"
            assert (
                "minute='0'" in trigger_repr
            ), f"Expected minute='0' in trigger repr: {trigger_repr}"

    def test_scheduler_configuration(self):
        """Test that scheduler is configured with correct defaults."""
        import src.tasks.scheduler as scheduler_module

        # Reset global state
        scheduler_module._scheduler = None

        with (
            patch.object(scheduler_module, "settings") as mock_settings,
            patch("src.tasks.scheduler.AsyncIOScheduler") as mock_scheduler_class,
        ):
            mock_settings.feature_background_tasks = True
            mock_settings.streak_reset_hour_utc = 0

            mock_scheduler_instance = MagicMock()
            mock_scheduler_instance.get_jobs.return_value = []
            mock_scheduler_class.return_value = mock_scheduler_instance

            setup_scheduler()

            # Verify scheduler configuration
            call_kwargs = mock_scheduler_class.call_args[1]
            assert call_kwargs["timezone"] == "UTC"
            assert call_kwargs["job_defaults"]["coalesce"] is True
            assert call_kwargs["job_defaults"]["max_instances"] == 1
            assert call_kwargs["job_defaults"]["misfire_grace_time"] == 300


class TestSchedulerShutdown:
    """Test scheduler shutdown functionality."""

    def test_shutdown_does_nothing_when_not_initialized(self):
        """Test that shutdown handles None scheduler gracefully."""
        import src.tasks.scheduler as scheduler_module

        # Reset global state
        scheduler_module._scheduler = None

        # Should not raise any exception
        shutdown_scheduler()

        assert get_scheduler() is None

    def test_shutdown_waits_for_jobs(self):
        """Test that shutdown waits for running jobs to complete."""
        import src.tasks.scheduler as scheduler_module

        mock_scheduler = MagicMock()
        scheduler_module._scheduler = mock_scheduler

        shutdown_scheduler()

        mock_scheduler.shutdown.assert_called_once_with(wait=True)
        assert scheduler_module._scheduler is None

    def test_shutdown_clears_global_instance(self):
        """Test that shutdown clears the global scheduler instance."""
        import src.tasks.scheduler as scheduler_module

        mock_scheduler = MagicMock()
        scheduler_module._scheduler = mock_scheduler

        shutdown_scheduler()

        assert get_scheduler() is None


class TestGetScheduler:
    """Test get_scheduler function."""

    def test_returns_none_when_not_initialized(self):
        """Test that get_scheduler returns None before initialization."""
        import src.tasks.scheduler as scheduler_module

        scheduler_module._scheduler = None

        assert get_scheduler() is None

    def test_returns_scheduler_when_initialized(self):
        """Test that get_scheduler returns the scheduler instance."""
        import src.tasks.scheduler as scheduler_module

        mock_scheduler = MagicMock()
        scheduler_module._scheduler = mock_scheduler

        result = get_scheduler()

        assert result is mock_scheduler


class TestJobListener:
    """Test job execution listener."""

    def test_logs_successful_job(self, caplog_loguru):
        """Test that successful job execution is logged."""
        mock_event = MagicMock()
        mock_event.job_id = "test_job"
        mock_event.exception = None

        with caplog_loguru.at_level("INFO"):
            job_listener(mock_event)

        assert "test_job" in caplog_loguru.text
        assert "completed successfully" in caplog_loguru.text

    def test_logs_failed_job(self, caplog_loguru):
        """Test that failed job execution is logged as error."""
        mock_event = MagicMock()
        mock_event.job_id = "test_job"
        mock_event.exception = ValueError("Test error")

        with caplog_loguru.at_level("ERROR"):
            job_listener(mock_event)

        assert "test_job" in caplog_loguru.text
        assert "failed" in caplog_loguru.text


class TestScheduledTaskStubs:
    """Test scheduled task placeholder functions."""

    def test_streak_reset_task_is_async(self):
        """Test that streak_reset_task is an async function."""
        from src.tasks.scheduled import streak_reset_task

        assert asyncio.iscoroutinefunction(streak_reset_task)

    def test_session_cleanup_task_is_async(self):
        """Test that session_cleanup_task is an async function."""
        from src.tasks.scheduled import session_cleanup_task

        assert asyncio.iscoroutinefunction(session_cleanup_task)

    def test_stats_aggregate_task_is_async(self):
        """Test that stats_aggregate_task is an async function."""
        from src.tasks.scheduled import stats_aggregate_task

        assert asyncio.iscoroutinefunction(stats_aggregate_task)

    @pytest.mark.asyncio
    async def test_streak_reset_task_runs_without_error(self, caplog_loguru):
        """Test that streak_reset_task runs without error (with mocked DB)."""
        from contextlib import asynccontextmanager
        from unittest.mock import AsyncMock, MagicMock, patch

        from src.tasks.scheduled import streak_reset_task

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.fetchall.return_value = []
        mock_session.execute.return_value = mock_result

        @asynccontextmanager
        async def _ctx():
            yield mock_session

        mock_factory = MagicMock(return_value=_ctx())

        with patch("src.tasks.scheduled.get_session_factory", return_value=mock_factory):
            with caplog_loguru.at_level("INFO"):
                await streak_reset_task()

        assert "streak reset" in caplog_loguru.text.lower()

    @pytest.mark.asyncio
    async def test_session_cleanup_task_runs_without_error(self, caplog_loguru):
        """Test that session_cleanup_task runs without error (with mocked Redis)."""
        from unittest.mock import AsyncMock, patch

        from src.tasks.scheduled import session_cleanup_task

        with patch("src.core.redis.init_redis", new_callable=AsyncMock):
            with patch("src.core.redis.get_redis") as mock_get_redis:
                with patch("src.core.redis.close_redis", new_callable=AsyncMock):
                    # Return None to trigger the "Redis not available" branch
                    mock_get_redis.return_value = None

                    with caplog_loguru.at_level("INFO"):
                        await session_cleanup_task()

                    mock_get_redis.assert_called_once()

        assert "session cleanup" in caplog_loguru.text.lower()

    @pytest.mark.asyncio
    async def test_stats_aggregate_task_runs_without_error(self, caplog_loguru):
        """Test that stats_aggregate_task runs without error (with mocked DB)."""
        from contextlib import asynccontextmanager
        from unittest.mock import AsyncMock, MagicMock, patch

        from src.tasks.scheduled import stats_aggregate_task

        mock_session = AsyncMock()
        # Mock empty results for both queries
        review_result = MagicMock()
        review_result.fetchall.return_value = []
        mastery_result = MagicMock()
        mastery_result.fetchall.return_value = []
        mock_session.execute.side_effect = [review_result, mastery_result]

        @asynccontextmanager
        async def _ctx():
            yield mock_session

        mock_factory = MagicMock(return_value=_ctx())

        with patch("src.tasks.scheduled.get_session_factory", return_value=mock_factory):
            with caplog_loguru.at_level("INFO"):
                await stats_aggregate_task()

        assert "stats aggregation" in caplog_loguru.text.lower()


class TestEventListenerRegistration:
    """Test that event listener is properly registered."""

    def test_event_listener_registered(self):
        """Test that job listener is added to scheduler."""
        import src.tasks.scheduler as scheduler_module

        # Reset global state
        scheduler_module._scheduler = None

        with (
            patch.object(scheduler_module, "settings") as mock_settings,
            patch("src.tasks.scheduler.AsyncIOScheduler") as mock_scheduler_class,
        ):
            mock_settings.feature_background_tasks = True
            mock_settings.streak_reset_hour_utc = 0

            mock_scheduler_instance = MagicMock()
            mock_scheduler_instance.get_jobs.return_value = []
            mock_scheduler_class.return_value = mock_scheduler_instance

            setup_scheduler()

            # Verify add_listener was called
            mock_scheduler_instance.add_listener.assert_called_once()

            # Verify the listener function was passed
            call_args = mock_scheduler_instance.add_listener.call_args
            assert call_args[0][0] == job_listener


# =============================================================================
# INFRA-06: RED test D — job_listener must produce a Sentry event with a
# real exception payload (not just a bare log message).
# =============================================================================


class TestJobListenerSentryCapturesException:
    """
    RED test (INFRA-06 Test D): verify that when job_listener is called with
    an event whose .exception is set, a Sentry event is captured AND the
    captured event carries a non-empty 'exception' payload (type + value +
    stacktrace).

    Why this is RED now
    -------------------
    Current job_listener code (scheduler.py:64-68):
        logger.error(f"... {event.exception}", exc_info=event.exception)

    The architect proved empirically that Sentry's LoguruIntegration turns the
    loguru exc_info=<instance> path into a bare error EVENT (level=error) but
    WITHOUT an 'exception' key — because the stdlib logging EventHandler
    expects record.exc_info as a (type, value, traceback) 3-tuple, not a bare
    instance.  So ``'exception' in captured_event`` is False today.

    After the executor adds ``sentry_sdk.capture_exception(event.exception)``
    inside the ``if event.exception:`` branch of job_listener, this test turns
    GREEN because capture_exception reads instance.__traceback__ and produces a
    full exception payload regardless of whether we are inside an except block.
    """

    def test_job_listener_captures_real_exception_event(self):
        """
        Initialize the real sentry_sdk in-process (dropping all events via
        before_send), fire job_listener with a real exception, flush, and
        assert that:
          1. At least one event was captured (init_sentry was called → SDK live).
          2. The captured event contains an 'exception' key with populated data
             (has 'values' list with at least one entry carrying 'type' and
             'value').

        RED REASON: captured[-1] will have 'exception' == False with current
        code because logger.error(exc_info=<instance>) does not produce an
        exception payload.
        """
        import sentry_sdk
        from apscheduler.events import EVENT_JOB_ERROR, JobExecutionEvent

        from src.tasks.scheduler import job_listener

        captured_events: list = []

        def _capture_and_drop(event, hint):
            """Capture the event for assertion, then drop it (never send)."""
            captured_events.append(event)
            return None  # returning None drops the event

        # Raise a real exception so it has a real __traceback__
        try:
            raise ValueError("synthetic scheduler job failure")
        except ValueError as exc:
            real_exc = exc

        # Initialize real SDK with our capturing before_send.
        # Use LoguruIntegration so we replicate the production integration stack.
        # dsn uses the sentry-sdk's built-in noop DSN that never makes network calls.
        from sentry_sdk.integrations.loguru import LoggingLevels, LoguruIntegration

        sentry_sdk.init(
            # noop DSN: SDK parses it, stores=valid, but no HTTP transport fires
            dsn="https://key@o0.ingest.sentry.io/0",
            before_send=_capture_and_drop,
            integrations=[
                LoguruIntegration(
                    sentry_logs_level=LoggingLevels.INFO.value,
                    level=LoggingLevels.INFO.value,
                    event_level=LoggingLevels.ERROR.value,
                ),
            ],
            traces_sample_rate=0.0,
            debug=False,
        )

        try:
            # Build a real JobExecutionEvent with .exception set.
            # APScheduler's JobExecutionEvent.__init__ signature:
            #   (code, job_id, jobstore, scheduled_run_time, retval=None, exception=None, traceback=None)
            import datetime

            event = JobExecutionEvent(
                code=EVENT_JOB_ERROR,
                job_id="test_job_sentry",
                jobstore="default",
                scheduled_run_time=datetime.datetime.now(datetime.timezone.utc),
                exception=real_exc,
                traceback=None,
            )

            # Call the listener — this is the code under test
            job_listener(event)

            # Flush to ensure any pending events are delivered to before_send
            sentry_sdk.flush(timeout=2.0)

            # ---- ASSERTIONS ----
            assert len(captured_events) >= 1, (
                "No Sentry events were captured at all. "
                "Expected at least one event from job_listener(event) with a set exception."
            )

            last_event = captured_events[-1]

            assert "exception" in last_event, (
                "Captured Sentry event has no 'exception' key. "
                "The logger.error(exc_info=<instance>) path produces a bare message event, "
                "NOT an exception event. "
                "Fix: add sentry_sdk.capture_exception(event.exception) in job_listener."
            )

            # Verify the exception payload is meaningful (not empty)
            exc_data = last_event["exception"]
            values = exc_data.get("values", [])
            assert len(values) >= 1, f"'exception.values' is empty in captured event: {last_event}"
            exc_entry = values[0]
            assert (
                exc_entry.get("type") == "ValueError"
            ), f"Expected type='ValueError', got: {exc_entry.get('type')}"
            assert "synthetic scheduler job failure" in str(
                exc_entry.get("value", "")
            ), f"Expected exception value to contain error message, got: {exc_entry.get('value')}"

        finally:
            # Always close the SDK so it doesn't bleed into other tests
            sentry_sdk.init(dsn=None)  # type: ignore[call-overload]


# =============================================================================
# INFRA-06 (QA Mode B): adversarial coverage for job_listener branches
# =============================================================================


class TestJobListenerAdversarial:
    """
    QA Mode B adversarial coverage for the job_listener function.

    These tests verify:
    - The SUCCESS branch (no exception) does NOT call capture_exception —
      only the error branch should fire Sentry.
    """

    def test_job_listener_success_branch_does_not_call_capture_exception(self):
        """
        When job_listener is called with event.exception = None (successful
        job execution), sentry_sdk.capture_exception must NOT be called.

        This guards against accidentally placing capture_exception outside
        the `if event.exception:` branch, which would flood Sentry with
        false-positive events on every successful job run.
        """
        import sentry_sdk

        from src.tasks.scheduler import job_listener

        mock_event = MagicMock()
        mock_event.job_id = "test_successful_job"
        mock_event.exception = None  # successful execution

        with patch.object(sentry_sdk, "capture_exception") as mock_capture:
            job_listener(mock_event)

        mock_capture.assert_not_called(), (
            "capture_exception must NOT be called for successful job executions "
            "(event.exception is None). Only the error branch should fire Sentry."
        )

    def test_job_listener_error_branch_calls_capture_exception_exactly_once(self):
        """
        When job_listener is called with a real exception, capture_exception
        must be called exactly once — not zero times (the pre-fix bug) and
        not multiple times (a future regression).
        """
        import sentry_sdk

        from src.tasks.scheduler import job_listener

        try:
            raise RuntimeError("scheduled job kaboom")
        except RuntimeError as exc:
            real_exc = exc

        mock_event = MagicMock()
        mock_event.job_id = "test_failed_job"
        mock_event.exception = real_exc

        with patch.object(sentry_sdk, "capture_exception") as mock_capture:
            job_listener(mock_event)

        mock_capture.assert_called_once_with(real_exc), (
            "capture_exception must be called exactly once with the exception "
            "instance when job_listener detects event.exception is set."
        )
