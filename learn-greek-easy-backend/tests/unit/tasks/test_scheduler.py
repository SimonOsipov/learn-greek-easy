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

            # Should have 4 add_job calls
            assert mock_scheduler_instance.add_job.call_count == 4

            # Verify job IDs
            job_ids = [call[1]["id"] for call in mock_scheduler_instance.add_job.call_args_list]
            assert "streak_reset" in job_ids
            assert "session_cleanup" in job_ids
            assert "stats_aggregate" in job_ids
            assert "fetch_news_sources" in job_ids

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
        from unittest.mock import AsyncMock, MagicMock, patch

        from src.tasks.scheduled import streak_reset_task

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                mock_result = MagicMock()
                mock_result.fetchall.return_value = []
                mock_session.execute.return_value = mock_result

                with caplog_loguru.at_level("INFO"):
                    await streak_reset_task()

        assert "streak reset" in caplog_loguru.text.lower()

    @pytest.mark.asyncio
    async def test_session_cleanup_task_runs_without_error(self, caplog_loguru):
        """Test that session_cleanup_task runs without error (with mocked Redis)."""
        from unittest.mock import AsyncMock, patch

        from src.tasks.scheduled import session_cleanup_task

        with patch("src.core.redis.init_redis", new_callable=AsyncMock) as mock_init:
            with patch("src.core.redis.get_redis") as mock_get_redis:
                with patch("src.core.redis.close_redis", new_callable=AsyncMock) as mock_close:
                    # Return None to trigger the "Redis not available" branch
                    mock_get_redis.return_value = None

                    with caplog_loguru.at_level("INFO"):
                        await session_cleanup_task()

                    # Verify Redis functions were called
                    mock_init.assert_called_once()
                    mock_get_redis.assert_called_once()
                    mock_close.assert_called_once()

        assert "session cleanup" in caplog_loguru.text.lower()

    @pytest.mark.asyncio
    async def test_stats_aggregate_task_runs_without_error(self, caplog_loguru):
        """Test that stats_aggregate_task runs without error (with mocked DB)."""
        from unittest.mock import AsyncMock, MagicMock, patch

        from src.tasks.scheduled import stats_aggregate_task

        with patch("src.tasks.scheduled.create_async_engine") as mock_engine_creator:
            mock_engine = AsyncMock()
            mock_engine_creator.return_value = mock_engine

            with patch("src.tasks.scheduled.async_sessionmaker") as mock_sessionmaker:
                mock_session = AsyncMock()
                mock_context = MagicMock()
                mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                mock_context.__aexit__ = AsyncMock(return_value=False)
                mock_session_factory = MagicMock(return_value=mock_context)
                mock_sessionmaker.return_value = mock_session_factory

                # Mock empty results for both queries
                review_result = MagicMock()
                review_result.fetchall.return_value = []
                mastery_result = MagicMock()
                mastery_result.fetchall.return_value = []
                mock_session.execute.side_effect = [review_result, mastery_result]

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
