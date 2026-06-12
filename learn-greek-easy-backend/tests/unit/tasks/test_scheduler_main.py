"""Unit tests for scheduler_main.py - standalone scheduler service entry point."""

import asyncio
import signal
from io import StringIO
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from loguru import logger

# Import scheduler_main at module level to ensure setup_logging() runs
# BEFORE any test fixtures add their handlers. This prevents test pollution
# where setup_logging() removes the fixture's log capture handler.
import src.scheduler_main as scheduler_main_module  # noqa: E402


@pytest.fixture
def loguru_caplog():
    """Capture loguru logs to a StringIO for test assertions.

    This fixture patches setup_logging() to prevent it from removing the
    test's capture handler. Without this patch, setup_logging() calls
    logger.remove() which removes ALL handlers including our StringIO,
    causing logs to go to stderr instead of being captured.

    Yields:
        StringIO: A StringIO object containing captured log messages.
    """
    output = StringIO()

    # Patch setup_logging to prevent it from removing our capture handler
    with patch.object(scheduler_main_module, "setup_logging"):
        handler_id = logger.add(output, format="{level} {message}", level="DEBUG")
        try:
            yield output
        finally:
            try:
                logger.remove(handler_id)
            except ValueError:
                # Handler was already removed (shouldn't happen with patch, but safe)
                pass


class TestSchedulerMainImports:
    """Test that scheduler_main module can be imported correctly."""

    def test_import_scheduler_main(self):
        """Test importing scheduler_main module."""
        from src import scheduler_main

        assert hasattr(scheduler_main, "main")
        assert hasattr(scheduler_main, "handle_shutdown")
        assert hasattr(scheduler_main, "shutdown_event")
        assert hasattr(scheduler_main, "logger")

    def test_main_is_async_function(self):
        """Test that main() is an async function."""
        from src.scheduler_main import main

        assert asyncio.iscoroutinefunction(main)

    def test_handle_shutdown_is_callable(self):
        """Test that handle_shutdown is a callable function."""
        from src.scheduler_main import handle_shutdown

        assert callable(handle_shutdown)


class TestHandleShutdown:
    """Test the handle_shutdown signal handler."""

    def test_handle_shutdown_sets_event(self):
        """Test that handle_shutdown sets the shutdown_event."""
        # Reset the shutdown event
        scheduler_main_module.shutdown_event = asyncio.Event()
        assert not scheduler_main_module.shutdown_event.is_set()

        # Call the handler
        scheduler_main_module.handle_shutdown(signal.SIGTERM, None)

        # Event should be set
        assert scheduler_main_module.shutdown_event.is_set()

    def test_handle_shutdown_logs_signal_name(self, loguru_caplog):
        """Test that handle_shutdown logs the signal name."""
        # Reset the shutdown event
        scheduler_main_module.shutdown_event = asyncio.Event()

        scheduler_main_module.handle_shutdown(signal.SIGINT, None)

        log_output = loguru_caplog.getvalue()
        assert "SIGINT" in log_output
        assert "graceful shutdown" in log_output.lower()

    def test_handle_shutdown_with_sigterm(self, loguru_caplog):
        """Test handle_shutdown with SIGTERM signal."""
        # Reset the shutdown event
        scheduler_main_module.shutdown_event = asyncio.Event()

        scheduler_main_module.handle_shutdown(signal.SIGTERM, None)

        log_output = loguru_caplog.getvalue()
        assert "SIGTERM" in log_output


class TestMainFeatureFlag:
    """Test main() behavior with feature flag."""

    @pytest.mark.asyncio
    async def test_main_exits_when_feature_disabled(self, loguru_caplog):
        """Test that main() exits early when feature flag is disabled."""
        # Reset the shutdown event
        scheduler_main_module.shutdown_event = asyncio.Event()

        with patch.object(scheduler_main_module, "settings") as mock_settings:
            mock_settings.feature_background_tasks = False
            mock_settings.log_level = "INFO"

            with patch.object(
                scheduler_main_module, "init_redis", new_callable=AsyncMock
            ) as mock_init_redis:
                await scheduler_main_module.main()

                # Redis should NOT be initialized when feature is disabled
                mock_init_redis.assert_not_called()

        log_output = loguru_caplog.getvalue()
        assert "Background tasks disabled" in log_output
        assert "FEATURE_BACKGROUND_TASKS=false" in log_output

    @pytest.mark.asyncio
    async def test_main_continues_when_feature_enabled(self):
        """Test that main() continues when feature flag is enabled."""
        # Create a new event that we can control
        test_event = asyncio.Event()
        scheduler_main_module.shutdown_event = test_event

        with patch.object(scheduler_main_module, "settings") as mock_settings:
            mock_settings.feature_background_tasks = True
            mock_settings.log_level = "INFO"

            with patch.object(
                scheduler_main_module, "init_redis", new_callable=AsyncMock
            ) as mock_init_redis:
                with patch.object(scheduler_main_module, "setup_scheduler") as mock_setup:
                    with patch.object(scheduler_main_module, "get_scheduler") as mock_get_scheduler:
                        with patch.object(scheduler_main_module, "shutdown_scheduler"):
                            with patch.object(
                                scheduler_main_module, "close_redis", new_callable=AsyncMock
                            ):
                                # Create a mock scheduler
                                mock_scheduler = MagicMock()
                                mock_scheduler.running = True
                                mock_scheduler.get_jobs.return_value = []
                                mock_get_scheduler.return_value = mock_scheduler

                                # Signal shutdown after a short delay
                                async def trigger_shutdown():
                                    await asyncio.sleep(0.01)
                                    test_event.set()

                                # Run main and shutdown trigger concurrently
                                await asyncio.gather(
                                    scheduler_main_module.main(),
                                    trigger_shutdown(),
                                )

                                # Verify initialization was called
                                mock_init_redis.assert_called_once()
                                mock_setup.assert_called_once()


class TestMainInitialization:
    """Test main() initialization sequence."""

    @pytest.mark.asyncio
    async def test_main_initializes_redis(self):
        """Test that main() initializes Redis connection."""
        test_event = asyncio.Event()
        scheduler_main_module.shutdown_event = test_event

        with patch.object(scheduler_main_module, "settings") as mock_settings:
            mock_settings.feature_background_tasks = True
            mock_settings.log_level = "INFO"

            with patch.object(
                scheduler_main_module, "init_redis", new_callable=AsyncMock
            ) as mock_init_redis:
                with patch.object(scheduler_main_module, "setup_scheduler"):
                    with patch.object(scheduler_main_module, "get_scheduler") as mock_get_scheduler:
                        with patch.object(scheduler_main_module, "shutdown_scheduler"):
                            with patch.object(
                                scheduler_main_module, "close_redis", new_callable=AsyncMock
                            ):
                                mock_scheduler = MagicMock()
                                mock_scheduler.running = True
                                mock_scheduler.get_jobs.return_value = []
                                mock_get_scheduler.return_value = mock_scheduler

                                async def trigger_shutdown():
                                    await asyncio.sleep(0.01)
                                    test_event.set()

                                await asyncio.gather(
                                    scheduler_main_module.main(),
                                    trigger_shutdown(),
                                )

                                mock_init_redis.assert_called_once()

    @pytest.mark.asyncio
    async def test_main_starts_scheduler(self):
        """Test that main() starts the scheduler."""
        test_event = asyncio.Event()
        scheduler_main_module.shutdown_event = test_event

        with patch.object(scheduler_main_module, "settings") as mock_settings:
            mock_settings.feature_background_tasks = True
            mock_settings.log_level = "INFO"

            with patch.object(scheduler_main_module, "init_redis", new_callable=AsyncMock):
                with patch.object(scheduler_main_module, "setup_scheduler") as mock_setup:
                    with patch.object(scheduler_main_module, "get_scheduler") as mock_get_scheduler:
                        with patch.object(scheduler_main_module, "shutdown_scheduler"):
                            with patch.object(
                                scheduler_main_module, "close_redis", new_callable=AsyncMock
                            ):
                                mock_scheduler = MagicMock()
                                mock_scheduler.running = True
                                mock_scheduler.get_jobs.return_value = []
                                mock_get_scheduler.return_value = mock_scheduler

                                async def trigger_shutdown():
                                    await asyncio.sleep(0.01)
                                    test_event.set()

                                await asyncio.gather(
                                    scheduler_main_module.main(),
                                    trigger_shutdown(),
                                )

                                mock_setup.assert_called_once()

    @pytest.mark.asyncio
    async def test_main_logs_registered_jobs(self, loguru_caplog):
        """Test that main() logs registered jobs on startup."""
        test_event = asyncio.Event()
        scheduler_main_module.shutdown_event = test_event

        with patch.object(scheduler_main_module, "settings") as mock_settings:
            mock_settings.feature_background_tasks = True
            mock_settings.log_level = "INFO"

            with patch.object(scheduler_main_module, "init_redis", new_callable=AsyncMock):
                with patch.object(scheduler_main_module, "setup_scheduler"):
                    with patch.object(scheduler_main_module, "get_scheduler") as mock_get_scheduler:
                        with patch.object(scheduler_main_module, "shutdown_scheduler"):
                            with patch.object(
                                scheduler_main_module, "close_redis", new_callable=AsyncMock
                            ):
                                # Create mock jobs
                                mock_job = MagicMock()
                                mock_job.id = "test_job"
                                mock_job.name = "Test Job"
                                mock_job.next_run_time = "2024-01-01 00:00:00"

                                mock_scheduler = MagicMock()
                                mock_scheduler.running = True
                                mock_scheduler.get_jobs.return_value = [mock_job]
                                mock_get_scheduler.return_value = mock_scheduler

                                async def trigger_shutdown():
                                    await asyncio.sleep(0.01)
                                    test_event.set()

                                await asyncio.gather(
                                    scheduler_main_module.main(),
                                    trigger_shutdown(),
                                )

                                log_output = loguru_caplog.getvalue()
                                assert "test_job" in log_output
                                assert "Test Job" in log_output


class TestMainSchedulerFailure:
    """Test main() behavior when scheduler fails to start."""

    @pytest.mark.asyncio
    async def test_main_exits_when_scheduler_not_running(self, loguru_caplog):
        """Test that main() exits when scheduler fails to start."""
        test_event = asyncio.Event()
        scheduler_main_module.shutdown_event = test_event

        with patch.object(scheduler_main_module, "settings") as mock_settings:
            mock_settings.feature_background_tasks = True
            mock_settings.log_level = "INFO"

            with patch.object(scheduler_main_module, "init_redis", new_callable=AsyncMock):
                with patch.object(scheduler_main_module, "setup_scheduler"):
                    with patch.object(scheduler_main_module, "get_scheduler") as mock_get_scheduler:
                        with patch.object(scheduler_main_module, "shutdown_scheduler"):
                            with patch.object(
                                scheduler_main_module, "close_redis", new_callable=AsyncMock
                            ):
                                # Scheduler not running
                                mock_scheduler = MagicMock()
                                mock_scheduler.running = False
                                mock_get_scheduler.return_value = mock_scheduler

                                await scheduler_main_module.main()

                                log_output = loguru_caplog.getvalue()
                                assert "Scheduler failed to start" in log_output

    @pytest.mark.asyncio
    async def test_main_exits_when_scheduler_is_none(self, loguru_caplog):
        """Test that main() exits when get_scheduler returns None."""
        test_event = asyncio.Event()
        scheduler_main_module.shutdown_event = test_event

        with patch.object(scheduler_main_module, "settings") as mock_settings:
            mock_settings.feature_background_tasks = True
            mock_settings.log_level = "INFO"

            with patch.object(scheduler_main_module, "init_redis", new_callable=AsyncMock):
                with patch.object(scheduler_main_module, "setup_scheduler"):
                    with patch.object(scheduler_main_module, "get_scheduler") as mock_get_scheduler:
                        with patch.object(scheduler_main_module, "shutdown_scheduler"):
                            with patch.object(
                                scheduler_main_module, "close_redis", new_callable=AsyncMock
                            ):
                                # Scheduler is None
                                mock_get_scheduler.return_value = None

                                await scheduler_main_module.main()

                                log_output = loguru_caplog.getvalue()
                                assert "Scheduler failed to start" in log_output


class TestMainCleanup:
    """Test main() cleanup sequence on shutdown."""

    @pytest.mark.asyncio
    async def test_main_cleanup_on_shutdown(self):
        """Test that main() performs cleanup on shutdown."""
        test_event = asyncio.Event()
        scheduler_main_module.shutdown_event = test_event

        with patch.object(scheduler_main_module, "settings") as mock_settings:
            mock_settings.feature_background_tasks = True
            mock_settings.log_level = "INFO"

            with patch.object(scheduler_main_module, "init_redis", new_callable=AsyncMock):
                with patch.object(scheduler_main_module, "setup_scheduler"):
                    with patch.object(scheduler_main_module, "get_scheduler") as mock_get_scheduler:
                        with patch.object(
                            scheduler_main_module, "shutdown_scheduler"
                        ) as mock_shutdown:
                            with patch.object(
                                scheduler_main_module, "close_redis", new_callable=AsyncMock
                            ) as mock_close_redis:
                                mock_scheduler = MagicMock()
                                mock_scheduler.running = True
                                mock_scheduler.get_jobs.return_value = []
                                mock_get_scheduler.return_value = mock_scheduler

                                async def trigger_shutdown():
                                    await asyncio.sleep(0.01)
                                    test_event.set()

                                await asyncio.gather(
                                    scheduler_main_module.main(),
                                    trigger_shutdown(),
                                )

                                # Verify cleanup was called
                                mock_shutdown.assert_called_once()
                                mock_close_redis.assert_called_once()

    @pytest.mark.asyncio
    async def test_main_cleanup_on_exception(self):
        """Test that main() performs cleanup even when exception occurs."""
        test_event = asyncio.Event()
        scheduler_main_module.shutdown_event = test_event

        with patch.object(scheduler_main_module, "settings") as mock_settings:
            mock_settings.feature_background_tasks = True
            mock_settings.log_level = "INFO"

            with patch.object(
                scheduler_main_module, "init_redis", new_callable=AsyncMock
            ) as mock_init_redis:
                # Make init_redis raise an exception
                mock_init_redis.side_effect = Exception("Redis connection failed")

                with patch.object(scheduler_main_module, "shutdown_scheduler") as mock_shutdown:
                    with patch.object(
                        scheduler_main_module, "close_redis", new_callable=AsyncMock
                    ) as mock_close_redis:
                        with pytest.raises(Exception, match="Redis connection failed"):
                            await scheduler_main_module.main()

                        # Cleanup should still be called
                        mock_shutdown.assert_called_once()
                        mock_close_redis.assert_called_once()

    @pytest.mark.asyncio
    async def test_main_cleanup_logs_messages(self, loguru_caplog):
        """Test that main() logs cleanup messages."""
        test_event = asyncio.Event()
        scheduler_main_module.shutdown_event = test_event

        with patch.object(scheduler_main_module, "settings") as mock_settings:
            mock_settings.feature_background_tasks = True
            mock_settings.log_level = "INFO"

            with patch.object(scheduler_main_module, "init_redis", new_callable=AsyncMock):
                with patch.object(scheduler_main_module, "setup_scheduler"):
                    with patch.object(scheduler_main_module, "get_scheduler") as mock_get_scheduler:
                        with patch.object(scheduler_main_module, "shutdown_scheduler"):
                            with patch.object(
                                scheduler_main_module, "close_redis", new_callable=AsyncMock
                            ):
                                mock_scheduler = MagicMock()
                                mock_scheduler.running = True
                                mock_scheduler.get_jobs.return_value = []
                                mock_get_scheduler.return_value = mock_scheduler

                                async def trigger_shutdown():
                                    await asyncio.sleep(0.01)
                                    test_event.set()

                                await asyncio.gather(
                                    scheduler_main_module.main(),
                                    trigger_shutdown(),
                                )

                                log_output = loguru_caplog.getvalue()
                                assert "Shutting down scheduler" in log_output
                                assert "Closing Redis connection" in log_output
                                assert "Scheduler service stopped" in log_output


class TestMainSignalHandlers:
    """Test signal handler registration in main()."""

    @pytest.mark.asyncio
    async def test_main_registers_signal_handlers(self):
        """Test that main() registers SIGTERM and SIGINT handlers."""
        test_event = asyncio.Event()
        scheduler_main_module.shutdown_event = test_event

        with patch.object(scheduler_main_module, "settings") as mock_settings:
            mock_settings.feature_background_tasks = True
            mock_settings.log_level = "INFO"

            with patch.object(scheduler_main_module, "init_redis", new_callable=AsyncMock):
                with patch.object(scheduler_main_module, "setup_scheduler"):
                    with patch.object(scheduler_main_module, "get_scheduler") as mock_get_scheduler:
                        with patch.object(scheduler_main_module, "shutdown_scheduler"):
                            with patch.object(
                                scheduler_main_module, "close_redis", new_callable=AsyncMock
                            ):
                                with patch("signal.signal") as mock_signal:
                                    mock_scheduler = MagicMock()
                                    mock_scheduler.running = True
                                    mock_scheduler.get_jobs.return_value = []
                                    mock_get_scheduler.return_value = mock_scheduler

                                    async def trigger_shutdown():
                                        await asyncio.sleep(0.01)
                                        test_event.set()

                                    await asyncio.gather(
                                        scheduler_main_module.main(),
                                        trigger_shutdown(),
                                    )

                                    # Verify signal handlers were registered
                                    signal_calls = mock_signal.call_args_list
                                    signals_registered = [call[0][0] for call in signal_calls]
                                    assert signal.SIGTERM in signals_registered
                                    assert signal.SIGINT in signals_registered


class TestShutdownEventGlobal:
    """Test shutdown_event global behavior."""

    def test_shutdown_event_is_asyncio_event(self):
        """Test that shutdown_event is an asyncio.Event instance."""
        from src.scheduler_main import shutdown_event

        assert isinstance(shutdown_event, asyncio.Event)

    def test_shutdown_event_initially_not_set(self):
        """Test that shutdown_event is not initially set."""
        # Create fresh event
        scheduler_main_module.shutdown_event = asyncio.Event()
        assert not scheduler_main_module.shutdown_event.is_set()


# =============================================================================
# INFRA-06: RED tests for Sentry init ordering in scheduler_main.main()
# =============================================================================


def _make_scheduler_mock() -> MagicMock:
    """Return a mock scheduler that appears running with no jobs."""
    m = MagicMock()
    m.running = True
    m.get_jobs.return_value = []
    return m


class TestSentryInitOrdering:
    """
    RED tests (INFRA-06 Test A): assert init_sentry is called BEFORE
    init_redis and init_db, and shutdown_sentry before close_redis/close_db.

    All tests in this class will FAIL until the executor wires init_sentry /
    shutdown_sentry into scheduler_main.main().
    """

    @pytest.mark.asyncio
    async def test_main_calls_init_sentry_before_redis_and_db(self):
        """
        init_sentry must be called exactly once, and its call index in the
        parent mock's call list must be strictly less than both init_redis
        and init_db.

        RED REASON: scheduler_main.main() does not call init_sentry at all yet,
        so init_sentry.assert_called_once() will fail with AssertionError.
        """
        test_event = asyncio.Event()
        scheduler_main_module.shutdown_event = test_event

        # Parent mock records all child calls in order via attach_mock.
        parent = MagicMock()

        mock_init_sentry = MagicMock(name="init_sentry")
        mock_shutdown_sentry = MagicMock(name="shutdown_sentry")
        mock_init_redis = AsyncMock(name="init_redis")
        mock_init_db = AsyncMock(name="init_db")
        mock_close_redis = AsyncMock(name="close_redis")
        mock_close_db = AsyncMock(name="close_db")

        parent.attach_mock(mock_init_sentry, "init_sentry")
        parent.attach_mock(mock_init_redis, "init_redis")
        parent.attach_mock(mock_init_db, "init_db")

        async def trigger_shutdown():
            await asyncio.sleep(0.01)
            test_event.set()

        with (
            patch.object(scheduler_main_module, "settings") as mock_settings,
            patch.object(scheduler_main_module, "init_sentry", mock_init_sentry, create=True),
            patch.object(
                scheduler_main_module, "shutdown_sentry", mock_shutdown_sentry, create=True
            ),
            patch.object(scheduler_main_module, "init_redis", mock_init_redis),
            patch.object(scheduler_main_module, "init_db", mock_init_db),
            patch.object(scheduler_main_module, "close_redis", mock_close_redis),
            patch.object(scheduler_main_module, "close_db", mock_close_db),
            patch.object(scheduler_main_module, "setup_scheduler"),
            patch.object(scheduler_main_module, "get_scheduler") as mock_get_scheduler,
            patch.object(scheduler_main_module, "shutdown_scheduler"),
        ):
            mock_settings.feature_background_tasks = True
            mock_settings.log_level = "INFO"
            mock_get_scheduler.return_value = _make_scheduler_mock()

            await asyncio.gather(scheduler_main_module.main(), trigger_shutdown())

        # init_sentry must have been called exactly once
        mock_init_sentry.assert_called_once()

        # Determine call order from the parent's recorded mock_calls
        call_names = [str(c) for c in parent.mock_calls]

        def index_of(name: str) -> int:
            for i, c in enumerate(call_names):
                if name in c:
                    return i
            return 99999  # sentinel – not found → ordering assert fails

        idx_sentry = index_of("init_sentry")
        idx_redis = index_of("init_redis")
        idx_db = index_of("init_db")

        assert (
            idx_sentry < idx_redis
        ), f"init_sentry (idx={idx_sentry}) must precede init_redis (idx={idx_redis})"
        assert (
            idx_sentry < idx_db
        ), f"init_sentry (idx={idx_sentry}) must precede init_db (idx={idx_db})"

    @pytest.mark.asyncio
    async def test_main_calls_shutdown_sentry_in_finally_before_close(self):
        """
        shutdown_sentry must be called in the finally block, before
        close_redis and close_db.

        RED REASON: shutdown_sentry is not called by main() yet.
        """
        test_event = asyncio.Event()
        scheduler_main_module.shutdown_event = test_event

        parent = MagicMock()

        mock_shutdown_sentry = MagicMock(name="shutdown_sentry")
        mock_close_redis = AsyncMock(name="close_redis")
        mock_close_db = AsyncMock(name="close_db")

        parent.attach_mock(mock_shutdown_sentry, "shutdown_sentry")
        parent.attach_mock(mock_close_redis, "close_redis")
        parent.attach_mock(mock_close_db, "close_db")

        async def trigger_shutdown():
            await asyncio.sleep(0.01)
            test_event.set()

        with (
            patch.object(scheduler_main_module, "settings") as mock_settings,
            patch.object(scheduler_main_module, "init_sentry", MagicMock(), create=True),
            patch.object(
                scheduler_main_module, "shutdown_sentry", mock_shutdown_sentry, create=True
            ),
            patch.object(scheduler_main_module, "init_redis", new_callable=AsyncMock),
            patch.object(scheduler_main_module, "init_db", new_callable=AsyncMock),
            patch.object(scheduler_main_module, "close_redis", mock_close_redis),
            patch.object(scheduler_main_module, "close_db", mock_close_db),
            patch.object(scheduler_main_module, "setup_scheduler"),
            patch.object(scheduler_main_module, "get_scheduler") as mock_get_scheduler,
            patch.object(scheduler_main_module, "shutdown_scheduler"),
        ):
            mock_settings.feature_background_tasks = True
            mock_settings.log_level = "INFO"
            mock_get_scheduler.return_value = _make_scheduler_mock()

            await asyncio.gather(scheduler_main_module.main(), trigger_shutdown())

        mock_shutdown_sentry.assert_called_once()

        call_names = [str(c) for c in parent.mock_calls]

        def index_of(name: str) -> int:
            for i, c in enumerate(call_names):
                if name in c:
                    return i
            return 99999

        idx_sentry_down = index_of("shutdown_sentry")
        idx_close_redis = index_of("close_redis")
        idx_close_db = index_of("close_db")

        assert (
            idx_sentry_down < idx_close_redis
        ), f"shutdown_sentry (idx={idx_sentry_down}) must precede close_redis (idx={idx_close_redis})"
        assert (
            idx_sentry_down < idx_close_db
        ), f"shutdown_sentry (idx={idx_sentry_down}) must precede close_db (idx={idx_close_db})"


class TestSentryInitOnException:
    """
    RED tests (INFRA-06 Test B): init_sentry still runs when a later step
    raises, and shutdown_sentry runs in finally before close_redis/close_db.
    """

    @pytest.mark.asyncio
    async def test_init_sentry_called_even_when_init_redis_raises(self):
        """
        When init_redis raises, init_sentry must still have been called (it
        ran before init_redis), and shutdown_sentry must run in finally
        before close_redis and close_db.

        RED REASON: init_sentry is not wired into main() yet.
        """
        scheduler_main_module.shutdown_event = asyncio.Event()

        parent = MagicMock()

        mock_init_sentry = MagicMock(name="init_sentry")
        mock_shutdown_sentry = MagicMock(name="shutdown_sentry")
        mock_init_redis = AsyncMock(name="init_redis")
        mock_close_redis = AsyncMock(name="close_redis")
        mock_close_db = AsyncMock(name="close_db")

        mock_init_redis.side_effect = Exception("Redis connection failed")

        parent.attach_mock(mock_init_sentry, "init_sentry")
        parent.attach_mock(mock_shutdown_sentry, "shutdown_sentry")
        parent.attach_mock(mock_close_redis, "close_redis")
        parent.attach_mock(mock_close_db, "close_db")

        with (
            patch.object(scheduler_main_module, "settings") as mock_settings,
            patch.object(scheduler_main_module, "init_sentry", mock_init_sentry, create=True),
            patch.object(
                scheduler_main_module, "shutdown_sentry", mock_shutdown_sentry, create=True
            ),
            patch.object(scheduler_main_module, "init_redis", mock_init_redis),
            patch.object(scheduler_main_module, "init_db", new_callable=AsyncMock),
            patch.object(scheduler_main_module, "close_redis", mock_close_redis),
            patch.object(scheduler_main_module, "close_db", mock_close_db),
            patch.object(scheduler_main_module, "shutdown_scheduler"),
        ):
            mock_settings.feature_background_tasks = True
            mock_settings.log_level = "INFO"

            with pytest.raises(Exception, match="Redis connection failed"):
                await scheduler_main_module.main()

        # init_sentry must have been called even though init_redis raised
        mock_init_sentry.assert_called_once()

        # shutdown_sentry must have run in finally
        mock_shutdown_sentry.assert_called_once()

        # And shutdown_sentry must precede close_redis / close_db
        call_names = [str(c) for c in parent.mock_calls]

        def index_of(name: str) -> int:
            for i, c in enumerate(call_names):
                if name in c:
                    return i
            return 99999

        idx_sentry_down = index_of("shutdown_sentry")
        idx_close_redis = index_of("close_redis")
        idx_close_db = index_of("close_db")

        assert (
            idx_sentry_down < idx_close_redis
        ), f"shutdown_sentry (idx={idx_sentry_down}) must precede close_redis (idx={idx_close_redis})"
        assert (
            idx_sentry_down < idx_close_db
        ), f"shutdown_sentry (idx={idx_sentry_down}) must precede close_db (idx={idx_close_db})"


class TestSentryNoDsnNoOp:
    """
    Test C (INFRA-06): calling the real init_sentry() with no DSN (or in
    testing mode) is a silent no-op: no raise, Sentry stays disabled.

    Expected to be GREEN already (init_sentry() gates on is_testing / no DSN).
    Documents the contract so regressions are caught.
    """

    def test_no_dsn_init_sentry_is_silent_noop(self):
        """
        With TESTING=true (set by global conftest), init_sentry() exits early
        at the is_testing guard without raising and without setting
        _sentry_initialized.

        This test is GREEN from day one — it validates the existing safe-init
        contract and will catch regressions if the guard is accidentally removed.
        """
        import src.core.sentry as sentry_module
        from src.core.sentry import init_sentry, is_sentry_enabled

        # Baseline: reset state in case a previous test left it set
        original_state = sentry_module._sentry_initialized
        sentry_module._sentry_initialized = False

        try:
            # settings.is_testing is True because conftest set TESTING=true
            # init_sentry() should exit silently at line 141 (is_testing guard)
            init_sentry()  # must not raise

            assert (
                not is_sentry_enabled()
            ), "is_sentry_enabled() must be False when init_sentry() no-ops (testing mode)"
        finally:
            # Restore global state so other tests are unaffected
            sentry_module._sentry_initialized = original_state
