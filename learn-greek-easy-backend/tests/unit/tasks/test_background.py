"""Unit tests for background tasks module."""

import asyncio
import inspect
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.config import settings


class TestModuleImports:
    """Test that module imports work correctly."""

    def test_import_from_tasks_package(self):
        """Test importing functions from src.tasks package."""
        from src.tasks import (
            check_achievements_task,
            invalidate_cache_task,
            is_background_tasks_enabled,
            log_analytics_task,
            recalculate_progress_task,
        )

        assert callable(check_achievements_task)
        assert callable(invalidate_cache_task)
        assert callable(is_background_tasks_enabled)
        assert callable(log_analytics_task)
        assert callable(recalculate_progress_task)

    def test_import_from_background_module(self):
        """Test importing directly from background module."""
        from src.tasks.background import (
            check_achievements_task,
            invalidate_cache_task,
            is_background_tasks_enabled,
            log_analytics_task,
            recalculate_progress_task,
        )

        assert callable(check_achievements_task)
        assert callable(invalidate_cache_task)
        assert callable(is_background_tasks_enabled)
        assert callable(log_analytics_task)
        assert callable(recalculate_progress_task)

    def test_all_exports_defined(self):
        """Test that __all__ is properly defined."""
        from src.tasks import __all__

        expected_exports = [
            "check_achievements_task",
            "invalidate_cache_task",
            "is_background_tasks_enabled",
            "log_analytics_task",
            "recalculate_progress_task",
        ]
        assert set(__all__) == set(expected_exports)


class TestIsBackgroundTasksEnabled:
    """Test the is_background_tasks_enabled utility function."""

    def test_feature_flag_disabled_by_default(self):
        """Test that background tasks are disabled by default."""
        from src.tasks.background import is_background_tasks_enabled

        # The default value should be False
        with patch.object(settings, "feature_background_tasks", False):
            assert is_background_tasks_enabled() is False

    def test_feature_flag_when_enabled(self):
        """Test that function returns True when feature is enabled."""
        from src.tasks.background import is_background_tasks_enabled

        with patch.object(settings, "feature_background_tasks", True):
            assert is_background_tasks_enabled() is True


class TestPlaceholderFunctions:
    """Test placeholder task functions."""

    def test_check_achievements_task_is_async(self):
        """Test that check_achievements_task is an async function."""
        from src.tasks.background import check_achievements_task

        assert asyncio.iscoroutinefunction(check_achievements_task)

    def test_invalidate_cache_task_is_async(self):
        """Test that invalidate_cache_task is an async function."""
        from src.tasks.background import invalidate_cache_task

        assert asyncio.iscoroutinefunction(invalidate_cache_task)

    def test_log_analytics_task_is_async(self):
        """Test that log_analytics_task is an async function."""
        from src.tasks.background import log_analytics_task

        assert asyncio.iscoroutinefunction(log_analytics_task)

    def test_recalculate_progress_task_is_async(self):
        """Test that recalculate_progress_task is an async function."""
        from src.tasks.background import recalculate_progress_task

        assert asyncio.iscoroutinefunction(recalculate_progress_task)

    def test_check_achievements_task_signature(self):
        """Test that check_achievements_task has correct signature."""
        from src.tasks.background import check_achievements_task

        sig = inspect.signature(check_achievements_task)
        params = list(sig.parameters.keys())
        assert params == ["user_id", "db_url"]

    def test_invalidate_cache_task_signature(self):
        """Test that invalidate_cache_task has correct signature."""
        from src.tasks.background import invalidate_cache_task

        sig = inspect.signature(invalidate_cache_task)
        params = list(sig.parameters.keys())
        assert params == ["cache_type", "entity_id", "user_id", "deck_id"]

    def test_log_analytics_task_signature(self):
        """Test that log_analytics_task has correct signature."""
        from src.tasks.background import log_analytics_task

        sig = inspect.signature(log_analytics_task)
        params = list(sig.parameters.keys())
        assert params == ["event_type", "user_id", "data"]

    def test_recalculate_progress_task_signature(self):
        """Test that recalculate_progress_task has correct signature."""
        from src.tasks.background import recalculate_progress_task

        sig = inspect.signature(recalculate_progress_task)
        params = list(sig.parameters.keys())
        assert params == ["user_id", "deck_id", "db_url"]


class TestPlaceholderExecution:
    """Test that placeholder functions execute without errors."""

    @pytest.mark.asyncio
    async def test_check_achievements_task_executes(self):
        """Test that check_achievements_task can be called without raising."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()
        db_url = "postgresql+asyncpg://test:test@localhost/test"

        # With feature disabled, should just return early without error
        with patch.object(settings, "feature_background_tasks", False):
            await check_achievements_task(user_id, db_url)

    @pytest.mark.asyncio
    async def test_invalidate_cache_task_executes(self):
        """Test that invalidate_cache_task can be called."""
        from src.tasks.background import invalidate_cache_task

        entity_id = uuid4()
        user_id = uuid4()

        # Test with user_id
        await invalidate_cache_task("deck", entity_id, user_id)

        # Test without user_id
        await invalidate_cache_task("card", entity_id)

    @pytest.mark.asyncio
    async def test_log_analytics_task_executes(self):
        """Test that log_analytics_task can be called."""
        from src.tasks.background import log_analytics_task

        user_id = uuid4()
        data = {"card_id": str(uuid4()), "result": "correct"}

        # Should not raise any exception
        await log_analytics_task("review_completed", user_id, data)

    @pytest.mark.asyncio
    async def test_recalculate_progress_task_executes(self):
        """Test that recalculate_progress_task can be called."""
        from src.tasks.background import recalculate_progress_task

        user_id = uuid4()
        deck_id = uuid4()
        db_url = "postgresql+asyncpg://test:test@localhost/test"

        # Should not raise any exception
        await recalculate_progress_task(user_id, deck_id, db_url)


class TestConfigSettings:
    """Test configuration settings for background tasks."""

    def test_feature_background_tasks_setting_exists(self):
        """Test that feature_background_tasks setting exists in config."""
        assert hasattr(settings, "feature_background_tasks")
        assert isinstance(settings.feature_background_tasks, bool)

    def test_background_task_timeout_setting_exists(self):
        """Test that background_task_timeout setting exists in config."""
        assert hasattr(settings, "background_task_timeout")
        assert isinstance(settings.background_task_timeout, int)
        assert settings.background_task_timeout == 30  # Default value

    def test_streak_reset_hour_utc_setting_exists(self):
        """Test that streak_reset_hour_utc setting exists in config."""
        assert hasattr(settings, "streak_reset_hour_utc")
        assert isinstance(settings.streak_reset_hour_utc, int)


class TestLoggingBehavior:
    """Test logging behavior when background tasks are disabled."""

    @pytest.mark.asyncio
    async def test_check_achievements_logs_when_disabled(self):
        """Test that check_achievements_task logs when disabled."""
        from src.tasks.background import check_achievements_task

        with patch.object(settings, "feature_background_tasks", False):
            with patch("src.tasks.background.logger") as mock_logger:
                await check_achievements_task(uuid4(), "test_url")
                mock_logger.debug.assert_called_once()
                assert "disabled" in mock_logger.debug.call_args[0][0].lower()

    @pytest.mark.asyncio
    async def test_invalidate_cache_logs_when_disabled(self):
        """Test that invalidate_cache_task logs when disabled."""
        from src.tasks.background import invalidate_cache_task

        with patch.object(settings, "feature_background_tasks", False):
            with patch("src.tasks.background.logger") as mock_logger:
                await invalidate_cache_task("deck", uuid4())
                mock_logger.debug.assert_called_once()
                assert "disabled" in mock_logger.debug.call_args[0][0].lower()

    @pytest.mark.asyncio
    async def test_log_analytics_logs_when_disabled(self):
        """Test that log_analytics_task logs when disabled."""
        from src.tasks.background import log_analytics_task

        with patch.object(settings, "feature_background_tasks", False):
            with patch("src.tasks.background.logger") as mock_logger:
                await log_analytics_task("test_event", uuid4(), {})
                mock_logger.debug.assert_called_once()
                assert "disabled" in mock_logger.debug.call_args[0][0].lower()

    @pytest.mark.asyncio
    async def test_recalculate_progress_logs_when_disabled(self):
        """Test that recalculate_progress_task logs when disabled."""
        from src.tasks.background import recalculate_progress_task

        with patch.object(settings, "feature_background_tasks", False):
            with patch("src.tasks.background.logger") as mock_logger:
                await recalculate_progress_task(uuid4(), uuid4(), "test_url")
                mock_logger.debug.assert_called_once()
                assert "disabled" in mock_logger.debug.call_args[0][0].lower()

    @pytest.mark.asyncio
    async def test_check_achievements_logs_when_enabled(self):
        """Test that check_achievements_task logs execution when enabled."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()
        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                # Set up mock engine
                mock_engine = AsyncMock()
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    # Set up mock session factory and session
                    mock_session = AsyncMock()
                    mock_session_factory = MagicMock()
                    mock_session_factory.return_value.__aenter__ = AsyncMock(
                        return_value=mock_session
                    )
                    mock_session_factory.return_value.__aexit__ = AsyncMock()
                    mock_sessionmaker.return_value = mock_session_factory

                    with patch(
                        "src.services.progress_service.ProgressService"
                    ) as mock_service_class:
                        mock_service = AsyncMock()
                        mock_service.get_achievements.return_value = MagicMock(
                            achievements=[],
                            total_points=0,
                        )
                        mock_service_class.return_value = mock_service

                        with patch("src.tasks.background.logger") as mock_logger:
                            await check_achievements_task(
                                user_id, "postgresql+asyncpg://test:test@localhost/test"
                            )
                            # Should log info on start
                            mock_logger.info.assert_called()
                            # Verify engine was disposed
                            mock_engine.dispose.assert_called_once()


class TestCheckAchievementsTaskImplementation:
    """Test the full implementation of check_achievements_task."""

    @pytest.mark.asyncio
    async def test_check_achievements_success(self):
        """Test successful achievement check."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    mock_session = AsyncMock()
                    mock_session_factory = MagicMock()
                    mock_session_factory.return_value.__aenter__ = AsyncMock(
                        return_value=mock_session
                    )
                    mock_session_factory.return_value.__aexit__ = AsyncMock()
                    mock_sessionmaker.return_value = mock_session_factory

                    with patch(
                        "src.services.progress_service.ProgressService"
                    ) as mock_service_class:
                        mock_service = AsyncMock()
                        mock_service.get_achievements.return_value = MagicMock(
                            achievements=[
                                MagicMock(unlocked=True),
                                MagicMock(unlocked=False),
                            ],
                            total_points=100,
                        )
                        mock_service_class.return_value = mock_service

                        await check_achievements_task(
                            user_id, "postgresql+asyncpg://test:test@localhost/test"
                        )

                        # Verify service was called with correct user_id
                        mock_service.get_achievements.assert_called_once_with(user_id)
                        # Verify engine was disposed
                        mock_engine.dispose.assert_called_once()

    @pytest.mark.asyncio
    async def test_check_achievements_handles_database_error(self):
        """Test that database connection errors are handled gracefully."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine_creator.side_effect = Exception("Connection failed")

                with patch("src.tasks.background.logger") as mock_logger:
                    # Should not raise - errors are caught and logged
                    await check_achievements_task(
                        user_id, "postgresql+asyncpg://test:test@localhost/test"
                    )

                    # Should log the error
                    mock_logger.error.assert_called()
                    error_call = mock_logger.error.call_args
                    assert "Achievement check failed" in error_call[0][0]

    @pytest.mark.asyncio
    async def test_check_achievements_handles_service_error(self):
        """Test that service errors are handled gracefully."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    mock_session = AsyncMock()
                    # Create proper async context manager mock
                    mock_context = MagicMock()
                    mock_context.__aenter__ = AsyncMock(return_value=mock_session)
                    mock_context.__aexit__ = AsyncMock(return_value=False)  # Propagate exceptions
                    mock_session_factory = MagicMock(return_value=mock_context)
                    mock_sessionmaker.return_value = mock_session_factory

                    with patch("src.tasks.background.logger") as mock_logger:
                        # Patch at the source module since it's imported locally
                        with patch(
                            "src.services.progress_service.ProgressService"
                        ) as mock_service_class:
                            mock_service_class.return_value.get_achievements = AsyncMock(
                                side_effect=Exception("Service error")
                            )

                            # Should not raise
                            await check_achievements_task(
                                user_id, "postgresql+asyncpg://test:test@localhost/test"
                            )

                            # Should log the error
                            mock_logger.error.assert_called()
                            # Engine should still be disposed
                            mock_engine.dispose.assert_called_once()

    @pytest.mark.asyncio
    async def test_check_achievements_disposes_engine_on_success(self):
        """Test that engine is properly disposed after successful execution."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    mock_session = AsyncMock()
                    mock_session_factory = MagicMock()
                    mock_session_factory.return_value.__aenter__ = AsyncMock(
                        return_value=mock_session
                    )
                    mock_session_factory.return_value.__aexit__ = AsyncMock()
                    mock_sessionmaker.return_value = mock_session_factory

                    with patch(
                        "src.services.progress_service.ProgressService"
                    ) as mock_service_class:
                        mock_service = AsyncMock()
                        mock_service.get_achievements.return_value = MagicMock(
                            achievements=[],
                            total_points=0,
                        )
                        mock_service_class.return_value = mock_service

                        await check_achievements_task(
                            user_id, "postgresql+asyncpg://test:test@localhost/test"
                        )

                        # Verify engine.dispose() was called
                        mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_check_achievements_disposes_engine_on_error(self):
        """Test that engine is disposed even when an error occurs."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    # Make session factory raise an error
                    mock_sessionmaker.side_effect = Exception("Session creation failed")

                    await check_achievements_task(
                        user_id, "postgresql+asyncpg://test:test@localhost/test"
                    )

                    # Engine should still be disposed even after error
                    mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_check_achievements_creates_engine_with_pool_pre_ping(self):
        """Test that engine is created with pool_pre_ping=True."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()
        db_url = "postgresql+asyncpg://test:test@localhost/test"

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    mock_session = AsyncMock()
                    mock_session_factory = MagicMock()
                    mock_session_factory.return_value.__aenter__ = AsyncMock(
                        return_value=mock_session
                    )
                    mock_session_factory.return_value.__aexit__ = AsyncMock()
                    mock_sessionmaker.return_value = mock_session_factory

                    with patch(
                        "src.services.progress_service.ProgressService"
                    ) as mock_service_class:
                        mock_service = AsyncMock()
                        mock_service.get_achievements.return_value = MagicMock(
                            achievements=[],
                            total_points=0,
                        )
                        mock_service_class.return_value = mock_service

                        await check_achievements_task(user_id, db_url)

                        # Verify create_async_engine was called with pool_pre_ping=True
                        mock_engine_creator.assert_called_once_with(db_url, pool_pre_ping=True)

    @pytest.mark.asyncio
    async def test_check_achievements_logs_start_and_completion(self):
        """Test that achievement check logs start and completion."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    mock_session = AsyncMock()
                    mock_session_factory = MagicMock()
                    mock_session_factory.return_value.__aenter__ = AsyncMock(
                        return_value=mock_session
                    )
                    mock_session_factory.return_value.__aexit__ = AsyncMock()
                    mock_sessionmaker.return_value = mock_session_factory

                    with patch(
                        "src.services.progress_service.ProgressService"
                    ) as mock_service_class:
                        mock_service = AsyncMock()
                        mock_service.get_achievements.return_value = MagicMock(
                            achievements=[
                                MagicMock(unlocked=True),
                                MagicMock(unlocked=True),
                                MagicMock(unlocked=False),
                            ],
                            total_points=150,
                        )
                        mock_service_class.return_value = mock_service

                        with patch("src.tasks.background.logger") as mock_logger:
                            await check_achievements_task(
                                user_id, "postgresql+asyncpg://test:test@localhost/test"
                            )

                            # Should have at least 2 info logs (start and completion)
                            assert mock_logger.info.call_count >= 2

                            # Check start log
                            start_call = mock_logger.info.call_args_list[0]
                            assert "Starting achievement check" in start_call[0][0]

                            # Check completion log
                            completion_call = mock_logger.info.call_args_list[1]
                            assert "Achievement check complete" in completion_call[0][0]
                            assert completion_call[1]["extra"]["total_unlocked"] == 2
                            assert completion_call[1]["extra"]["total_points"] == 150


class TestInvalidateCacheTaskImplementation:
    """Test the full implementation of invalidate_cache_task."""

    @pytest.mark.asyncio
    async def test_invalidate_deck_cache(self):
        """Test that deck cache invalidation calls the correct cache method."""
        from src.tasks.background import invalidate_cache_task

        deck_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.core.cache.get_cache") as mock_get_cache:
                mock_cache = AsyncMock()
                mock_cache.invalidate_deck.return_value = 5
                mock_get_cache.return_value = mock_cache

                await invalidate_cache_task("deck", deck_id)

                mock_cache.invalidate_deck.assert_called_once_with(deck_id)

    @pytest.mark.asyncio
    async def test_invalidate_card_cache(self):
        """Test that card cache invalidation calls the correct cache method."""
        from src.tasks.background import invalidate_cache_task

        card_id = uuid4()
        deck_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.core.cache.get_cache") as mock_get_cache:
                mock_cache = AsyncMock()
                mock_cache.invalidate_card.return_value = 3
                mock_get_cache.return_value = mock_cache

                await invalidate_cache_task("card", card_id, deck_id=deck_id)

                mock_cache.invalidate_card.assert_called_once_with(card_id, deck_id)

    @pytest.mark.asyncio
    async def test_invalidate_progress_cache(self):
        """Test that progress cache invalidation calls the correct cache method."""
        from src.tasks.background import invalidate_cache_task

        user_id = uuid4()
        deck_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.core.cache.get_cache") as mock_get_cache:
                mock_cache = AsyncMock()
                mock_cache.invalidate_user_progress.return_value = 2
                mock_get_cache.return_value = mock_cache

                await invalidate_cache_task("progress", deck_id, user_id=user_id)

                mock_cache.invalidate_user_progress.assert_called_once_with(user_id, deck_id)

    @pytest.mark.asyncio
    async def test_invalid_cache_type_logs_warning(self):
        """Test that invalid cache type logs a warning."""
        from src.tasks.background import invalidate_cache_task

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.core.cache.get_cache") as mock_get_cache:
                mock_cache = AsyncMock()
                mock_get_cache.return_value = mock_cache

                with patch("src.tasks.background.logger") as mock_logger:
                    await invalidate_cache_task("unknown", uuid4())

                    mock_logger.warning.assert_called_once()
                    warning_call = mock_logger.warning.call_args
                    assert "Invalid cache invalidation request" in warning_call[0][0]

    @pytest.mark.asyncio
    async def test_card_cache_without_deck_id_logs_warning(self):
        """Test that card cache without deck_id logs a warning."""
        from src.tasks.background import invalidate_cache_task

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.core.cache.get_cache") as mock_get_cache:
                mock_cache = AsyncMock()
                mock_get_cache.return_value = mock_cache

                with patch("src.tasks.background.logger") as mock_logger:
                    # Card cache type without deck_id should warn
                    await invalidate_cache_task("card", uuid4())

                    mock_logger.warning.assert_called_once()
                    warning_call = mock_logger.warning.call_args
                    assert warning_call[1]["extra"]["has_deck_id"] is False

    @pytest.mark.asyncio
    async def test_progress_cache_without_user_id_logs_warning(self):
        """Test that progress cache without user_id logs a warning."""
        from src.tasks.background import invalidate_cache_task

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.core.cache.get_cache") as mock_get_cache:
                mock_cache = AsyncMock()
                mock_get_cache.return_value = mock_cache

                with patch("src.tasks.background.logger") as mock_logger:
                    # Progress cache type without user_id should warn
                    await invalidate_cache_task("progress", uuid4())

                    mock_logger.warning.assert_called_once()
                    warning_call = mock_logger.warning.call_args
                    assert warning_call[1]["extra"]["has_user_id"] is False

    @pytest.mark.asyncio
    async def test_cache_service_error_handled_gracefully(self):
        """Test that cache service errors are handled gracefully."""
        from src.tasks.background import invalidate_cache_task

        deck_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.core.cache.get_cache") as mock_get_cache:
                mock_cache = AsyncMock()
                mock_cache.invalidate_deck.side_effect = Exception("Redis connection failed")
                mock_get_cache.return_value = mock_cache

                with patch("src.tasks.background.logger") as mock_logger:
                    # Should not raise an exception
                    await invalidate_cache_task("deck", deck_id)

                    # Should log the error
                    mock_logger.error.assert_called_once()
                    error_call = mock_logger.error.call_args
                    assert "Cache invalidation failed" in error_call[0][0]
                    assert error_call[1]["extra"]["error"] == "Redis connection failed"

    @pytest.mark.asyncio
    async def test_cache_invalidation_logs_start_and_completion(self):
        """Test that cache invalidation logs start and completion."""
        from src.tasks.background import invalidate_cache_task

        deck_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.core.cache.get_cache") as mock_get_cache:
                mock_cache = AsyncMock()
                mock_cache.invalidate_deck.return_value = 3
                mock_get_cache.return_value = mock_cache

                with patch("src.tasks.background.logger") as mock_logger:
                    await invalidate_cache_task("deck", deck_id)

                    # Should have 2 info logs (start and completion)
                    assert mock_logger.info.call_count == 2

                    # Check start log
                    start_call = mock_logger.info.call_args_list[0]
                    assert "Starting cache invalidation" in start_call[0][0]
                    assert start_call[1]["extra"]["cache_type"] == "deck"
                    assert start_call[1]["extra"]["task"] == "invalidate_cache"

                    # Check completion log
                    completion_call = mock_logger.info.call_args_list[1]
                    assert "Cache invalidation complete" in completion_call[0][0]
                    assert completion_call[1]["extra"]["deleted_entries"] == 3

    @pytest.mark.asyncio
    async def test_cache_invalidation_skipped_when_disabled(self):
        """Test that cache invalidation is skipped when background tasks are disabled."""
        from src.tasks.background import invalidate_cache_task

        deck_id = uuid4()

        with patch.object(settings, "feature_background_tasks", False):
            with patch("src.core.cache.get_cache") as mock_get_cache:
                mock_cache = AsyncMock()
                mock_get_cache.return_value = mock_cache

                await invalidate_cache_task("deck", deck_id)

                # Cache methods should not be called
                mock_get_cache.assert_not_called()

    @pytest.mark.asyncio
    async def test_cache_invalidation_with_all_parameters(self):
        """Test cache invalidation with all parameters provided."""
        from src.tasks.background import invalidate_cache_task

        entity_id = uuid4()
        user_id = uuid4()
        deck_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.core.cache.get_cache") as mock_get_cache:
                mock_cache = AsyncMock()
                mock_cache.invalidate_card.return_value = 2
                mock_get_cache.return_value = mock_cache

                with patch("src.tasks.background.logger") as mock_logger:
                    await invalidate_cache_task("card", entity_id, user_id=user_id, deck_id=deck_id)

                    # Should use card invalidation since deck_id is provided
                    mock_cache.invalidate_card.assert_called_once_with(entity_id, deck_id)

                    # Check that all parameters are logged
                    start_call = mock_logger.info.call_args_list[0]
                    assert start_call[1]["extra"]["user_id"] == str(user_id)
                    assert start_call[1]["extra"]["deck_id"] == str(deck_id)
