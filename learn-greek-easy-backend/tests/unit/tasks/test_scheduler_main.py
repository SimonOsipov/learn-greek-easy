"""Unit tests for scheduler_main.py - standalone scheduler service entry point."""

import asyncio
import signal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


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
        import src.scheduler_main as scheduler_main_module

        # Reset the shutdown event
        scheduler_main_module.shutdown_event = asyncio.Event()
        assert not scheduler_main_module.shutdown_event.is_set()

        # Call the handler
        scheduler_main_module.handle_shutdown(signal.SIGTERM, None)

        # Event should be set
        assert scheduler_main_module.shutdown_event.is_set()

    def test_handle_shutdown_logs_signal_name(self, caplog):
        """Test that handle_shutdown logs the signal name."""
        import src.scheduler_main as scheduler_main_module

        # Reset the shutdown event
        scheduler_main_module.shutdown_event = asyncio.Event()

        with caplog.at_level("INFO"):
            scheduler_main_module.handle_shutdown(signal.SIGINT, None)

        assert "SIGINT" in caplog.text
        assert "graceful shutdown" in caplog.text.lower()

    def test_handle_shutdown_with_sigterm(self, caplog):
        """Test handle_shutdown with SIGTERM signal."""
        import src.scheduler_main as scheduler_main_module

        # Reset the shutdown event
        scheduler_main_module.shutdown_event = asyncio.Event()

        with caplog.at_level("INFO"):
            scheduler_main_module.handle_shutdown(signal.SIGTERM, None)

        assert "SIGTERM" in caplog.text


class TestMainFeatureFlag:
    """Test main() behavior with feature flag."""

    @pytest.mark.asyncio
    async def test_main_exits_when_feature_disabled(self, caplog):
        """Test that main() exits early when feature flag is disabled."""
        import src.scheduler_main as scheduler_main_module

        # Reset the shutdown event
        scheduler_main_module.shutdown_event = asyncio.Event()

        with patch.object(scheduler_main_module, "settings") as mock_settings:
            mock_settings.feature_background_tasks = False
            mock_settings.log_level = "INFO"

            with patch.object(
                scheduler_main_module, "init_redis", new_callable=AsyncMock
            ) as mock_init_redis:
                with caplog.at_level("WARNING"):
                    await scheduler_main_module.main()

                # Redis should NOT be initialized when feature is disabled
                mock_init_redis.assert_not_called()

        assert "Background tasks disabled" in caplog.text
        assert "FEATURE_BACKGROUND_TASKS=false" in caplog.text

    @pytest.mark.asyncio
    async def test_main_continues_when_feature_enabled(self):
        """Test that main() continues when feature flag is enabled."""
        import src.scheduler_main as scheduler_main_module

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
        import src.scheduler_main as scheduler_main_module

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
        import src.scheduler_main as scheduler_main_module

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
    async def test_main_logs_registered_jobs(self, caplog):
        """Test that main() logs registered jobs on startup."""
        import src.scheduler_main as scheduler_main_module

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

                                with caplog.at_level("INFO"):
                                    await asyncio.gather(
                                        scheduler_main_module.main(),
                                        trigger_shutdown(),
                                    )

                                assert "test_job" in caplog.text
                                assert "Test Job" in caplog.text


class TestMainSchedulerFailure:
    """Test main() behavior when scheduler fails to start."""

    @pytest.mark.asyncio
    async def test_main_exits_when_scheduler_not_running(self, caplog):
        """Test that main() exits when scheduler fails to start."""
        import src.scheduler_main as scheduler_main_module

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

                                with caplog.at_level("ERROR"):
                                    await scheduler_main_module.main()

                                assert "Scheduler failed to start" in caplog.text

    @pytest.mark.asyncio
    async def test_main_exits_when_scheduler_is_none(self, caplog):
        """Test that main() exits when get_scheduler returns None."""
        import src.scheduler_main as scheduler_main_module

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

                                with caplog.at_level("ERROR"):
                                    await scheduler_main_module.main()

                                assert "Scheduler failed to start" in caplog.text


class TestMainCleanup:
    """Test main() cleanup sequence on shutdown."""

    @pytest.mark.asyncio
    async def test_main_cleanup_on_shutdown(self):
        """Test that main() performs cleanup on shutdown."""
        import src.scheduler_main as scheduler_main_module

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
        import src.scheduler_main as scheduler_main_module

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
    async def test_main_cleanup_logs_messages(self, caplog):
        """Test that main() logs cleanup messages."""
        import src.scheduler_main as scheduler_main_module

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

                                with caplog.at_level("INFO"):
                                    await asyncio.gather(
                                        scheduler_main_module.main(),
                                        trigger_shutdown(),
                                    )

                                assert "Shutting down scheduler" in caplog.text
                                assert "Closing Redis connection" in caplog.text
                                assert "Scheduler service stopped" in caplog.text


class TestMainSignalHandlers:
    """Test signal handler registration in main()."""

    @pytest.mark.asyncio
    async def test_main_registers_signal_handlers(self):
        """Test that main() registers SIGTERM and SIGINT handlers."""
        import src.scheduler_main as scheduler_main_module

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
        import src.scheduler_main as scheduler_main_module

        # Create fresh event
        scheduler_main_module.shutdown_event = asyncio.Event()
        assert not scheduler_main_module.shutdown_event.is_set()
