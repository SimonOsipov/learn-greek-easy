"""Unit tests for background tasks module."""

import asyncio
import inspect
import re
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.config import settings
from src.tasks.background import ANALYTICS_EVENTS


class TestModuleImports:
    """Test that module imports work correctly."""

    def test_import_from_tasks_package(self):
        """Test importing functions from src.tasks package."""
        from src.tasks import (
            ANALYTICS_EVENTS,
            check_achievements_task,
            invalidate_cache_task,
            is_background_tasks_enabled,
            log_analytics_task,
            process_answer_side_effects_task,
            process_culture_answer_full_async,
            recalculate_progress_task,
        )

        assert callable(check_achievements_task)
        assert callable(invalidate_cache_task)
        assert callable(is_background_tasks_enabled)
        assert callable(log_analytics_task)
        assert callable(process_answer_side_effects_task)
        assert callable(process_culture_answer_full_async)
        assert callable(recalculate_progress_task)
        assert isinstance(ANALYTICS_EVENTS, dict)

    def test_import_from_background_module(self):
        """Test importing directly from background module."""
        from src.tasks.background import (
            ANALYTICS_EVENTS,
            check_achievements_task,
            invalidate_cache_task,
            is_background_tasks_enabled,
            log_analytics_task,
            process_answer_side_effects_task,
            process_culture_answer_full_async,
            recalculate_progress_task,
        )

        assert callable(check_achievements_task)
        assert callable(invalidate_cache_task)
        assert callable(is_background_tasks_enabled)
        assert callable(log_analytics_task)
        assert callable(process_answer_side_effects_task)
        assert callable(process_culture_answer_full_async)
        assert callable(recalculate_progress_task)
        assert isinstance(ANALYTICS_EVENTS, dict)

    def test_all_exports_defined(self):
        """Test that __all__ is properly defined."""
        from src.tasks import __all__

        expected_exports = [
            # Background tasks (API-side)
            "ANALYTICS_EVENTS",
            "check_achievements_task",
            "check_culture_achievements_task",
            "create_announcement_notifications_task",
            "generate_audio_for_news_item_task",
            "invalidate_cache_task",
            "is_background_tasks_enabled",
            "log_analytics_task",
            "process_answer_side_effects_task",
            "process_culture_answer_full_async",
            "recalculate_progress_task",
            # Scheduler (dedicated service)
            "get_scheduler",
            "setup_scheduler",
            "shutdown_scheduler",
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
                    mock_session_factory = MagicMock(return_value=mock_session)
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


class TestLogAnalyticsTaskImplementation:
    """Test the full implementation of log_analytics_task."""

    @pytest.mark.asyncio
    async def test_log_analytics_review_completed(self):
        """Test logging a review_completed analytics event."""
        from src.tasks.background import log_analytics_task

        user_id = uuid4()
        data = {
            "card_id": str(uuid4()),
            "deck_id": str(uuid4()),
            "quality": 4,
            "time_taken": 15,
            "previous_status": "learning",
            "new_status": "review",
        }

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.logger") as mock_logger:
                await log_analytics_task("review_completed", user_id, data)

                mock_logger.info.assert_called_once()
                call_args = mock_logger.info.call_args
                assert "ANALYTICS: review_completed" in call_args[0][0]
                assert call_args[1]["extra"]["analytics"] is True
                assert call_args[1]["extra"]["event_type"] == "review_completed"
                assert call_args[1]["extra"]["user_id"] == str(user_id)
                assert call_args[1]["extra"]["event_data"] == data

    @pytest.mark.asyncio
    async def test_log_analytics_unknown_event_warns(self):
        """Test that unknown event types log a warning but still log the event."""
        from src.tasks.background import log_analytics_task

        user_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.logger") as mock_logger:
                await log_analytics_task("unknown_event", user_id, {})

                # Should log warning for unknown event type
                mock_logger.warning.assert_called_once()
                warning_call = mock_logger.warning.call_args
                assert "Unknown analytics event type" in warning_call[0][0]
                assert warning_call[1]["extra"]["event_type"] == "unknown_event"

                # Should still log the analytics event
                mock_logger.info.assert_called_once()

    @pytest.mark.asyncio
    async def test_log_analytics_all_event_types_defined(self):
        """Test that all expected event types are defined in ANALYTICS_EVENTS."""
        expected_events = [
            "review_completed",
            "bulk_review_completed",
            "session_started",
            "session_ended",
            "deck_started",
            "achievement_unlocked",
            "streak_milestone",
            "mastery_milestone",
        ]

        for event in expected_events:
            assert event in ANALYTICS_EVENTS, f"Missing event type: {event}"

        # Verify total count matches expected
        assert len(ANALYTICS_EVENTS) == 8

    @pytest.mark.asyncio
    async def test_log_analytics_timestamp_utc_format(self):
        """Test that timestamp is in UTC ISO format."""
        from src.tasks.background import log_analytics_task

        user_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.logger") as mock_logger:
                await log_analytics_task("review_completed", user_id, {})

                call_args = mock_logger.info.call_args
                timestamp = call_args[1]["extra"]["timestamp"]

                # Verify it's a valid ISO format timestamp with UTC timezone
                # ISO format: 2024-01-15T10:30:00.123456+00:00
                iso_pattern = r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?\+00:00"
                assert re.match(iso_pattern, timestamp), f"Invalid timestamp format: {timestamp}"

    @pytest.mark.asyncio
    async def test_log_analytics_bulk_review_completed(self):
        """Test logging a bulk_review_completed analytics event."""
        from src.tasks.background import log_analytics_task

        user_id = uuid4()
        data = {
            "session_id": "session123",
            "deck_id": str(uuid4()),
            "total_reviews": 10,
            "successful": 10,
            "failed": 0,
            "total_time_seconds": 150,
        }

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.logger") as mock_logger:
                await log_analytics_task("bulk_review_completed", user_id, data)

                mock_logger.info.assert_called_once()
                call_args = mock_logger.info.call_args
                assert "ANALYTICS: bulk_review_completed" in call_args[0][0]
                assert call_args[1]["extra"]["event_data"]["total_reviews"] == 10

    @pytest.mark.asyncio
    async def test_log_analytics_session_events(self):
        """Test logging session_started and session_ended events."""
        from src.tasks.background import log_analytics_task

        user_id = uuid4()
        deck_id = str(uuid4())

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.logger") as mock_logger:
                # Test session_started
                await log_analytics_task("session_started", user_id, {"deck_id": deck_id})

                mock_logger.info.assert_called_once()
                call_args = mock_logger.info.call_args
                assert "ANALYTICS: session_started" in call_args[0][0]

                mock_logger.reset_mock()

                # Test session_ended
                session_data = {
                    "deck_id": deck_id,
                    "duration_seconds": 600,
                    "cards_reviewed": 20,
                    "average_quality": 3.8,
                }
                await log_analytics_task("session_ended", user_id, session_data)

                mock_logger.info.assert_called_once()
                call_args = mock_logger.info.call_args
                assert "ANALYTICS: session_ended" in call_args[0][0]
                assert call_args[1]["extra"]["event_data"]["duration_seconds"] == 600

    @pytest.mark.asyncio
    async def test_log_analytics_achievement_unlocked(self):
        """Test logging achievement_unlocked event."""
        from src.tasks.background import log_analytics_task

        user_id = uuid4()
        data = {
            "achievement_id": "streak_7",
            "achievement_name": "Week Warrior",
            "points_earned": 50,
            "total_points": 150,
        }

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.logger") as mock_logger:
                await log_analytics_task("achievement_unlocked", user_id, data)

                mock_logger.info.assert_called_once()
                call_args = mock_logger.info.call_args
                assert "ANALYTICS: achievement_unlocked" in call_args[0][0]
                assert call_args[1]["extra"]["event_data"]["achievement_id"] == "streak_7"

    @pytest.mark.asyncio
    async def test_log_analytics_milestone_events(self):
        """Test logging streak_milestone and mastery_milestone events."""
        from src.tasks.background import log_analytics_task

        user_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.logger") as mock_logger:
                # Test streak_milestone
                streak_data = {"streak_days": 30, "milestone": "30_days"}
                await log_analytics_task("streak_milestone", user_id, streak_data)

                mock_logger.info.assert_called_once()
                assert "ANALYTICS: streak_milestone" in mock_logger.info.call_args[0][0]

                mock_logger.reset_mock()

                # Test mastery_milestone
                mastery_data = {"deck_id": str(uuid4()), "mastery_percentage": 100}
                await log_analytics_task("mastery_milestone", user_id, mastery_data)

                mock_logger.info.assert_called_once()
                assert "ANALYTICS: mastery_milestone" in mock_logger.info.call_args[0][0]

    @pytest.mark.asyncio
    async def test_log_analytics_skipped_when_disabled(self):
        """Test that analytics logging is skipped when background tasks are disabled."""
        from src.tasks.background import log_analytics_task

        user_id = uuid4()

        with patch.object(settings, "feature_background_tasks", False):
            with patch("src.tasks.background.logger") as mock_logger:
                await log_analytics_task("review_completed", user_id, {})

                # Should only log debug message about being disabled
                mock_logger.debug.assert_called_once()
                assert "disabled" in mock_logger.debug.call_args[0][0].lower()

                # Should NOT log info (the analytics event)
                mock_logger.info.assert_not_called()

    @pytest.mark.asyncio
    async def test_log_analytics_deck_started(self):
        """Test logging deck_started event."""
        from src.tasks.background import log_analytics_task

        user_id = uuid4()
        data = {
            "deck_id": str(uuid4()),
            "deck_name": "Greek Basics A1",
            "total_cards": 50,
        }

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.logger") as mock_logger:
                await log_analytics_task("deck_started", user_id, data)

                mock_logger.info.assert_called_once()
                call_args = mock_logger.info.call_args
                assert "ANALYTICS: deck_started" in call_args[0][0]
                assert call_args[1]["extra"]["event_data"]["deck_name"] == "Greek Basics A1"

    @pytest.mark.asyncio
    async def test_log_analytics_with_empty_data(self):
        """Test logging analytics event with empty data dictionary."""
        from src.tasks.background import log_analytics_task

        user_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.logger") as mock_logger:
                await log_analytics_task("session_started", user_id, {})

                mock_logger.info.assert_called_once()
                call_args = mock_logger.info.call_args
                assert call_args[1]["extra"]["event_data"] == {}

    @pytest.mark.asyncio
    async def test_log_analytics_user_id_converted_to_string(self):
        """Test that user_id UUID is properly converted to string."""
        from src.tasks.background import log_analytics_task

        user_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.logger") as mock_logger:
                await log_analytics_task("review_completed", user_id, {})

                call_args = mock_logger.info.call_args
                logged_user_id = call_args[1]["extra"]["user_id"]

                # Should be a string representation of UUID
                assert isinstance(logged_user_id, str)
                assert logged_user_id == str(user_id)


class TestAnalyticsEventsConstant:
    """Test the ANALYTICS_EVENTS constant."""

    def test_analytics_events_is_dict(self):
        """Test that ANALYTICS_EVENTS is a dictionary."""
        assert isinstance(ANALYTICS_EVENTS, dict)

    def test_analytics_events_has_descriptions(self):
        """Test that all event types have string descriptions."""
        for event_type, description in ANALYTICS_EVENTS.items():
            assert isinstance(event_type, str)
            assert isinstance(description, str)
            assert len(description) > 0

    def test_analytics_events_keys_are_snake_case(self):
        """Test that all event type keys are snake_case."""
        for event_type in ANALYTICS_EVENTS:
            assert (
                "_" in event_type or event_type.islower()
            ), f"Event type '{event_type}' should be snake_case"
            assert (
                event_type == event_type.lower()
            ), f"Event type '{event_type}' should be lowercase"


class TestRecalculateProgressTaskImplementation:
    """Test the full implementation of recalculate_progress_task."""

    @pytest.mark.asyncio
    async def test_recalculate_progress_with_changes(self):
        """Test that progress is updated when values differ."""
        from src.tasks.background import recalculate_progress_task

        user_id = uuid4()
        deck_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    mock_session = AsyncMock()
                    mock_session_factory = MagicMock(return_value=mock_session)
                    mock_sessionmaker.return_value = mock_session_factory

                    with patch("src.repositories.CardStatisticsRepository") as mock_stats_class:
                        mock_stats_repo = AsyncMock()
                        # Mock status counts
                        mock_stats_repo.count_by_status.return_value = {
                            "learning": 5,
                            "review": 10,
                            "mastered": 3,
                        }
                        mock_stats_class.return_value = mock_stats_repo

                        with patch(
                            "src.repositories.UserDeckProgressRepository"
                        ) as mock_progress_class:
                            mock_progress_repo = AsyncMock()
                            # Mock progress record with different values
                            mock_progress = MagicMock()
                            mock_progress.cards_studied = 10  # Old value
                            mock_progress.cards_mastered = 1  # Old value
                            mock_progress_repo.get_or_create.return_value = mock_progress
                            mock_progress_class.return_value = mock_progress_repo

                            await recalculate_progress_task(
                                user_id, deck_id, "postgresql+asyncpg://test:test@localhost/test"
                            )

                            # Should update to new values (5 + 10 + 3 = 18)
                            assert mock_progress.cards_studied == 18
                            assert mock_progress.cards_mastered == 3

                            # Verify session.commit was called
                            mock_session.commit.assert_awaited_once()

                            # Verify engine was disposed
                            mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_recalculate_progress_no_changes(self):
        """Test that progress is not updated when values match."""
        from src.tasks.background import recalculate_progress_task

        user_id = uuid4()
        deck_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    mock_session = AsyncMock()
                    mock_session_factory = MagicMock(return_value=mock_session)
                    mock_sessionmaker.return_value = mock_session_factory

                    with patch("src.repositories.CardStatisticsRepository") as mock_stats_class:
                        mock_stats_repo = AsyncMock()
                        # Mock status counts
                        mock_stats_repo.count_by_status.return_value = {
                            "mastered": 5,
                        }
                        mock_stats_class.return_value = mock_stats_repo

                        with patch(
                            "src.repositories.UserDeckProgressRepository"
                        ) as mock_progress_class:
                            mock_progress_repo = AsyncMock()
                            # Progress already matches (0 + 0 + 5 = 5)
                            mock_progress = MagicMock()
                            mock_progress.cards_studied = 5
                            mock_progress.cards_mastered = 5
                            mock_progress_repo.get_or_create.return_value = mock_progress
                            mock_progress_class.return_value = mock_progress_repo

                            await recalculate_progress_task(
                                user_id, deck_id, "postgresql+asyncpg://test:test@localhost/test"
                            )

                            # Should not change
                            assert mock_progress.cards_studied == 5
                            assert mock_progress.cards_mastered == 5

                            # Verify session.commit was NOT called (no changes)
                            mock_session.commit.assert_not_awaited()

                            # Verify engine was disposed
                            mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_recalculate_progress_handles_database_error(self):
        """Test that database errors are handled gracefully."""
        from src.tasks.background import recalculate_progress_task

        user_id = uuid4()
        deck_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine_creator.side_effect = Exception("Connection failed")

                with patch("src.tasks.background.logger") as mock_logger:
                    # Should not raise - errors are caught and logged
                    await recalculate_progress_task(
                        user_id, deck_id, "postgresql+asyncpg://test:test@localhost/test"
                    )

                    # Should log the error
                    mock_logger.error.assert_called()
                    error_call = mock_logger.error.call_args
                    assert "Progress recalculation failed" in error_call[0][0]

    @pytest.mark.asyncio
    async def test_recalculate_progress_disposes_engine_on_success(self):
        """Test that engine is properly disposed after successful execution."""
        from src.tasks.background import recalculate_progress_task

        user_id = uuid4()
        deck_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    mock_session = AsyncMock()
                    mock_session_factory = MagicMock(return_value=mock_session)
                    mock_sessionmaker.return_value = mock_session_factory

                    with patch("src.repositories.CardStatisticsRepository") as mock_stats_class:
                        mock_stats_repo = AsyncMock()
                        mock_stats_repo.count_by_status.return_value = {}
                        mock_stats_class.return_value = mock_stats_repo

                        with patch(
                            "src.repositories.UserDeckProgressRepository"
                        ) as mock_progress_class:
                            mock_progress_repo = AsyncMock()
                            mock_progress = MagicMock()
                            mock_progress.cards_studied = 0
                            mock_progress.cards_mastered = 0
                            mock_progress_repo.get_or_create.return_value = mock_progress
                            mock_progress_class.return_value = mock_progress_repo

                            await recalculate_progress_task(
                                user_id, deck_id, "postgresql+asyncpg://test:test@localhost/test"
                            )

                            # Verify engine.dispose() was called
                            mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_recalculate_progress_disposes_engine_on_error(self):
        """Test that engine is disposed even when an error occurs."""
        from src.tasks.background import recalculate_progress_task

        user_id = uuid4()
        deck_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    # Make session factory raise an error
                    mock_sessionmaker.side_effect = Exception("Session creation failed")

                    await recalculate_progress_task(
                        user_id, deck_id, "postgresql+asyncpg://test:test@localhost/test"
                    )

                    # Engine should still be disposed even after error
                    mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_recalculate_progress_creates_engine_with_pool_pre_ping(self):
        """Test that engine is created with pool_pre_ping=True."""
        from src.tasks.background import recalculate_progress_task

        user_id = uuid4()
        deck_id = uuid4()
        db_url = "postgresql+asyncpg://test:test@localhost/test"

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    mock_session = AsyncMock()
                    mock_session_factory = MagicMock(return_value=mock_session)
                    mock_sessionmaker.return_value = mock_session_factory

                    with patch("src.repositories.CardStatisticsRepository") as mock_stats_class:
                        mock_stats_repo = AsyncMock()
                        mock_stats_repo.count_by_status.return_value = {}
                        mock_stats_class.return_value = mock_stats_repo

                        with patch(
                            "src.repositories.UserDeckProgressRepository"
                        ) as mock_progress_class:
                            mock_progress_repo = AsyncMock()
                            mock_progress = MagicMock()
                            mock_progress.cards_studied = 0
                            mock_progress.cards_mastered = 0
                            mock_progress_repo.get_or_create.return_value = mock_progress
                            mock_progress_class.return_value = mock_progress_repo

                            await recalculate_progress_task(user_id, deck_id, db_url)

                            # Verify create_async_engine was called with pool_pre_ping=True
                            mock_engine_creator.assert_called_once_with(db_url, pool_pre_ping=True)

    @pytest.mark.asyncio
    async def test_recalculate_progress_logs_old_vs_new_values(self):
        """Test that old and new values are logged when changes are made."""
        from src.tasks.background import recalculate_progress_task

        user_id = uuid4()
        deck_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    mock_session = AsyncMock()
                    mock_session_factory = MagicMock(return_value=mock_session)
                    mock_sessionmaker.return_value = mock_session_factory

                    with patch("src.repositories.CardStatisticsRepository") as mock_stats_class:
                        mock_stats_repo = AsyncMock()
                        mock_stats_repo.count_by_status.return_value = {
                            "learning": 5,
                            "review": 10,
                            "mastered": 3,
                        }
                        mock_stats_class.return_value = mock_stats_repo

                        with patch(
                            "src.repositories.UserDeckProgressRepository"
                        ) as mock_progress_class:
                            mock_progress_repo = AsyncMock()
                            mock_progress = MagicMock()
                            mock_progress.cards_studied = 10  # Old value
                            mock_progress.cards_mastered = 1  # Old value
                            mock_progress_repo.get_or_create.return_value = mock_progress
                            mock_progress_class.return_value = mock_progress_repo

                            with patch("src.tasks.background.logger") as mock_logger:
                                await recalculate_progress_task(
                                    user_id,
                                    deck_id,
                                    "postgresql+asyncpg://test:test@localhost/test",
                                )

                                # Find the "Progress recalculated with changes" log call
                                change_log_call = None
                                for call in mock_logger.info.call_args_list:
                                    if "Progress recalculated with changes" in call[0][0]:
                                        change_log_call = call
                                        break

                                assert change_log_call is not None
                                extra = change_log_call[1]["extra"]
                                assert extra["old_studied"] == 10
                                assert extra["new_studied"] == 18
                                assert extra["old_mastered"] == 1
                                assert extra["new_mastered"] == 3

    @pytest.mark.asyncio
    async def test_recalculate_progress_skipped_when_disabled(self):
        """Test that progress recalculation is skipped when background tasks are disabled."""
        from src.tasks.background import recalculate_progress_task

        user_id = uuid4()
        deck_id = uuid4()

        with patch.object(settings, "feature_background_tasks", False):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                await recalculate_progress_task(
                    user_id, deck_id, "postgresql+asyncpg://test:test@localhost/test"
                )

                # Engine should not be created when disabled
                mock_engine_creator.assert_not_called()

    @pytest.mark.asyncio
    async def test_recalculate_progress_logs_start_and_completion(self):
        """Test that progress recalculation logs start and completion."""
        from src.tasks.background import recalculate_progress_task

        user_id = uuid4()
        deck_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    mock_session = AsyncMock()
                    mock_session_factory = MagicMock(return_value=mock_session)
                    mock_sessionmaker.return_value = mock_session_factory

                    with patch("src.repositories.CardStatisticsRepository") as mock_stats_class:
                        mock_stats_repo = AsyncMock()
                        mock_stats_repo.count_by_status.return_value = {}
                        mock_stats_class.return_value = mock_stats_repo

                        with patch(
                            "src.repositories.UserDeckProgressRepository"
                        ) as mock_progress_class:
                            mock_progress_repo = AsyncMock()
                            mock_progress = MagicMock()
                            mock_progress.cards_studied = 0
                            mock_progress.cards_mastered = 0
                            mock_progress_repo.get_or_create.return_value = mock_progress
                            mock_progress_class.return_value = mock_progress_repo

                            with patch("src.tasks.background.logger") as mock_logger:
                                await recalculate_progress_task(
                                    user_id,
                                    deck_id,
                                    "postgresql+asyncpg://test:test@localhost/test",
                                )

                                # Should have at least 3 info logs (start, no changes, completion)
                                assert mock_logger.info.call_count >= 3

                                # Check start log
                                start_call = mock_logger.info.call_args_list[0]
                                assert "Starting progress recalculation" in start_call[0][0]
                                assert start_call[1]["extra"]["task"] == "recalculate_progress"

                                # Check completion log
                                completion_call = mock_logger.info.call_args_list[-1]
                                assert "Progress recalculation complete" in completion_call[0][0]
                                assert "duration_ms" in completion_call[1]["extra"]

    @pytest.mark.asyncio
    async def test_recalculate_progress_handles_missing_status_counts(self):
        """Test that missing status counts default to zero."""
        from src.tasks.background import recalculate_progress_task

        user_id = uuid4()
        deck_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    mock_session = AsyncMock()
                    mock_session_factory = MagicMock(return_value=mock_session)
                    mock_sessionmaker.return_value = mock_session_factory

                    with patch("src.repositories.CardStatisticsRepository") as mock_stats_class:
                        mock_stats_repo = AsyncMock()
                        # Empty status counts (no cards have statistics yet)
                        mock_stats_repo.count_by_status.return_value = {}
                        mock_stats_class.return_value = mock_stats_repo

                        with patch(
                            "src.repositories.UserDeckProgressRepository"
                        ) as mock_progress_class:
                            mock_progress_repo = AsyncMock()
                            mock_progress = MagicMock()
                            mock_progress.cards_studied = 5  # Has old values
                            mock_progress.cards_mastered = 2
                            mock_progress_repo.get_or_create.return_value = mock_progress
                            mock_progress_class.return_value = mock_progress_repo

                            await recalculate_progress_task(
                                user_id,
                                deck_id,
                                "postgresql+asyncpg://test:test@localhost/test",
                            )

                            # Should reset to zeros when no status counts exist
                            assert mock_progress.cards_studied == 0
                            assert mock_progress.cards_mastered == 0

    @pytest.mark.asyncio
    async def test_recalculate_progress_creates_progress_record_if_missing(self):
        """Test that progress record is created if it doesn't exist."""
        from src.tasks.background import recalculate_progress_task

        user_id = uuid4()
        deck_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    mock_session = AsyncMock()
                    mock_session_factory = MagicMock(return_value=mock_session)
                    mock_sessionmaker.return_value = mock_session_factory

                    with patch("src.repositories.CardStatisticsRepository") as mock_stats_class:
                        mock_stats_repo = AsyncMock()
                        mock_stats_repo.count_by_status.return_value = {
                            "learning": 2,
                            "review": 3,
                            "mastered": 1,
                        }
                        mock_stats_class.return_value = mock_stats_repo

                        with patch(
                            "src.repositories.UserDeckProgressRepository"
                        ) as mock_progress_class:
                            mock_progress_repo = AsyncMock()
                            # Simulate get_or_create returning a new record
                            mock_progress = MagicMock()
                            mock_progress.cards_studied = 0  # New record starts at 0
                            mock_progress.cards_mastered = 0
                            mock_progress_repo.get_or_create.return_value = mock_progress
                            mock_progress_class.return_value = mock_progress_repo

                            await recalculate_progress_task(
                                user_id,
                                deck_id,
                                "postgresql+asyncpg://test:test@localhost/test",
                            )

                            # Verify get_or_create was called with correct params
                            mock_progress_repo.get_or_create.assert_awaited_once_with(
                                user_id, deck_id
                            )

                            # Should update to calculated values (2 + 3 + 1 = 6)
                            assert mock_progress.cards_studied == 6
                            assert mock_progress.cards_mastered == 1


class TestProcessCultureAnswerFullAsync:
    """Test the process_culture_answer_full_async task (early response pattern)."""

    def test_process_culture_answer_full_async_is_async(self):
        """Test that process_culture_answer_full_async is an async function."""
        from src.tasks.background import process_culture_answer_full_async

        assert asyncio.iscoroutinefunction(process_culture_answer_full_async)

    def test_process_culture_answer_full_async_signature(self):
        """Test that process_culture_answer_full_async has correct signature."""
        from src.tasks.background import process_culture_answer_full_async

        sig = inspect.signature(process_culture_answer_full_async)
        params = list(sig.parameters.keys())
        expected_params = [
            "user_id",
            "question_id",
            "selected_option",
            "time_taken",
            "language",
            "is_correct",
            "is_perfect",
            "deck_category",
            "db_url",
        ]
        assert params == expected_params

    @pytest.mark.asyncio
    async def test_process_culture_answer_full_async_skipped_when_disabled(self):
        """Test that task is skipped when background tasks are disabled."""
        from src.tasks.background import process_culture_answer_full_async

        with patch.object(settings, "feature_background_tasks", False):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                await process_culture_answer_full_async(
                    user_id=uuid4(),
                    question_id=uuid4(),
                    selected_option=1,
                    time_taken=5,
                    language="en",
                    is_correct=True,
                    is_perfect=False,
                    deck_category="history",
                    db_url="postgresql+asyncpg://test:test@localhost/test",
                )

                # Engine should not be created when disabled
                mock_engine_creator.assert_not_called()

    @pytest.mark.asyncio
    async def test_process_culture_answer_full_async_logs_when_disabled(self):
        """Test that task logs debug message when disabled."""
        from src.tasks.background import process_culture_answer_full_async

        with patch.object(settings, "feature_background_tasks", False):
            with patch("src.tasks.background.logger") as mock_logger:
                await process_culture_answer_full_async(
                    user_id=uuid4(),
                    question_id=uuid4(),
                    selected_option=1,
                    time_taken=5,
                    language="en",
                    is_correct=True,
                    is_perfect=False,
                    deck_category="history",
                    db_url="postgresql+asyncpg://test:test@localhost/test",
                )

                mock_logger.debug.assert_called_once()
                assert "disabled" in mock_logger.debug.call_args[0][0].lower()

    @pytest.mark.asyncio
    async def test_process_culture_answer_full_async_handles_database_error(self):
        """Test that database connection errors are handled gracefully."""
        from src.tasks.background import process_culture_answer_full_async

        user_id = uuid4()
        question_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine_creator.side_effect = Exception("Connection failed")

                with patch("src.tasks.background.logger") as mock_logger:
                    # Should not raise - errors are caught and logged
                    await process_culture_answer_full_async(
                        user_id=user_id,
                        question_id=question_id,
                        selected_option=1,
                        time_taken=5,
                        language="en",
                        is_correct=True,
                        is_perfect=False,
                        deck_category="history",
                        db_url="postgresql+asyncpg://test:test@localhost/test",
                    )

                    # Should log the error
                    mock_logger.error.assert_called()
                    error_call = mock_logger.error.call_args
                    assert "Full culture answer processing failed" in error_call[0][0]

    @pytest.mark.asyncio
    async def test_process_culture_answer_full_async_disposes_engine_on_error(self):
        """Test that engine is disposed even when an error occurs."""
        from src.tasks.background import process_culture_answer_full_async

        user_id = uuid4()
        question_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    # Make session factory raise an error
                    mock_sessionmaker.side_effect = Exception("Session creation failed")

                    await process_culture_answer_full_async(
                        user_id=user_id,
                        question_id=question_id,
                        selected_option=1,
                        time_taken=5,
                        language="en",
                        is_correct=True,
                        is_perfect=False,
                        deck_category="history",
                        db_url="postgresql+asyncpg://test:test@localhost/test",
                    )

                    # Engine should still be disposed even after error
                    mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_process_culture_answer_full_async_creates_engine_with_pool_pre_ping(self):
        """Test that engine is created with pool_pre_ping=True."""
        from src.tasks.background import process_culture_answer_full_async

        user_id = uuid4()
        question_id = uuid4()
        db_url = "postgresql+asyncpg://test:test@localhost/test"

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    # Make session factory raise an error to exit quickly
                    mock_sessionmaker.side_effect = Exception("Session creation failed")

                    await process_culture_answer_full_async(
                        user_id=user_id,
                        question_id=question_id,
                        selected_option=1,
                        time_taken=5,
                        language="en",
                        is_correct=True,
                        is_perfect=False,
                        deck_category="history",
                        db_url=db_url,
                    )

                    # Verify create_async_engine was called with pool_pre_ping=True
                    mock_engine_creator.assert_called_once_with(db_url, pool_pre_ping=True)

    @pytest.mark.asyncio
    async def test_process_culture_answer_full_async_logs_start(self):
        """Test that task logs start message with correct extra fields."""
        from src.tasks.background import process_culture_answer_full_async

        user_id = uuid4()
        question_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    # Make session factory raise an error to exit quickly
                    mock_sessionmaker.side_effect = Exception("Session creation failed")

                    with patch("src.tasks.background.logger") as mock_logger:
                        await process_culture_answer_full_async(
                            user_id=user_id,
                            question_id=question_id,
                            selected_option=1,
                            time_taken=5,
                            language="en",
                            is_correct=True,
                            is_perfect=False,
                            deck_category="history",
                            db_url="postgresql+asyncpg://test:test@localhost/test",
                        )

                        # Check start log was called
                        start_call = mock_logger.info.call_args_list[0]
                        assert "Starting full culture answer processing" in start_call[0][0]
                        assert start_call[1]["extra"]["user_id"] == str(user_id)
                        assert start_call[1]["extra"]["question_id"] == str(question_id)
                        assert start_call[1]["extra"]["is_correct"] is True
                        assert start_call[1]["extra"]["task"] == "process_culture_answer_full"


class TestSessionCleanupOrder:
    """Test that session is closed before engine is disposed.

    This is critical to avoid InvalidRequestError: "Method 'close()' can't
    be called here; method '_connection_for_bind()' is already in progress".
    """

    @pytest.mark.asyncio
    async def test_check_achievements_closes_session_before_engine_dispose(self):
        """Test that check_achievements_task closes session before engine dispose."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()
        call_order = []

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()

                async def mock_dispose():
                    call_order.append("engine.dispose")

                mock_engine.dispose = mock_dispose
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    mock_session = AsyncMock()

                    async def mock_close():
                        call_order.append("session.close")

                    mock_session.close = mock_close
                    mock_session_factory = MagicMock(return_value=mock_session)
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

                        # Verify session.close is called before engine.dispose
                        assert call_order == ["session.close", "engine.dispose"]

    @pytest.mark.asyncio
    async def test_check_achievements_closes_session_before_engine_on_error(self):
        """Test that session is closed before engine dispose even on error."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()
        call_order = []

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()

                async def mock_dispose():
                    call_order.append("engine.dispose")

                mock_engine.dispose = mock_dispose
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    mock_session = AsyncMock()

                    async def mock_close():
                        call_order.append("session.close")

                    mock_session.close = mock_close
                    mock_session_factory = MagicMock(return_value=mock_session)
                    mock_sessionmaker.return_value = mock_session_factory

                    with patch(
                        "src.services.progress_service.ProgressService"
                    ) as mock_service_class:
                        mock_service = AsyncMock()
                        mock_service.get_achievements.side_effect = Exception("Service error")
                        mock_service_class.return_value = mock_service

                        await check_achievements_task(
                            user_id, "postgresql+asyncpg://test:test@localhost/test"
                        )

                        # Session close should still happen before engine dispose
                        assert call_order == ["session.close", "engine.dispose"]

    @pytest.mark.asyncio
    async def test_recalculate_progress_closes_session_before_engine_dispose(self):
        """Test that recalculate_progress_task closes session before engine dispose."""
        from src.tasks.background import recalculate_progress_task

        user_id = uuid4()
        deck_id = uuid4()
        call_order = []

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()

                async def mock_dispose():
                    call_order.append("engine.dispose")

                mock_engine.dispose = mock_dispose
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    mock_session = AsyncMock()

                    async def mock_close():
                        call_order.append("session.close")

                    mock_session.close = mock_close
                    mock_session_factory = MagicMock(return_value=mock_session)
                    mock_sessionmaker.return_value = mock_session_factory

                    with patch("src.repositories.CardStatisticsRepository") as mock_stats_class:
                        mock_stats_repo = AsyncMock()
                        mock_stats_repo.count_by_status.return_value = {}
                        mock_stats_class.return_value = mock_stats_repo

                        with patch(
                            "src.repositories.UserDeckProgressRepository"
                        ) as mock_progress_class:
                            mock_progress_repo = AsyncMock()
                            mock_progress = MagicMock()
                            mock_progress.cards_studied = 0
                            mock_progress.cards_mastered = 0
                            mock_progress_repo.get_or_create.return_value = mock_progress
                            mock_progress_class.return_value = mock_progress_repo

                            await recalculate_progress_task(
                                user_id, deck_id, "postgresql+asyncpg://test:test@localhost/test"
                            )

                            assert call_order == ["session.close", "engine.dispose"]

    @pytest.mark.asyncio
    async def test_process_answer_side_effects_closes_session_before_engine_dispose(self):
        """Test that process_answer_side_effects_task closes session before engine dispose."""
        from src.tasks.background import process_answer_side_effects_task

        user_id = uuid4()
        question_id = uuid4()
        call_order = []

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()

                async def mock_dispose():
                    call_order.append("engine.dispose")

                mock_engine.dispose = mock_dispose
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    mock_session = AsyncMock()

                    async def mock_close():
                        call_order.append("session.close")

                    mock_session.close = mock_close
                    mock_session_factory = MagicMock(return_value=mock_session)
                    mock_sessionmaker.return_value = mock_session_factory

                    with patch(
                        "src.tasks.background._check_and_notify_daily_goal", new_callable=AsyncMock
                    ):
                        await process_answer_side_effects_task(
                            user_id=user_id,
                            question_id=question_id,
                            language="en",
                            is_correct=True,
                            selected_option=1,
                            time_taken_seconds=5,
                            deck_category="history",
                            culture_answers_before=0,
                            db_url="postgresql+asyncpg://test:test@localhost/test",
                        )

                        assert call_order == ["session.close", "engine.dispose"]

    @pytest.mark.asyncio
    async def test_process_culture_answer_full_closes_session_before_engine_dispose(self):
        """Test that process_culture_answer_full_async closes session before engine dispose."""
        from src.tasks.background import process_culture_answer_full_async

        user_id = uuid4()
        question_id = uuid4()
        call_order = []

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()

                async def mock_dispose():
                    call_order.append("engine.dispose")

                mock_engine.dispose = mock_dispose
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    mock_session = AsyncMock()

                    async def mock_close():
                        call_order.append("session.close")

                    mock_session.close = mock_close

                    # Mock execute to raise an error to trigger session close
                    mock_session.execute.side_effect = Exception("DB error")

                    mock_session_factory = MagicMock(return_value=mock_session)
                    mock_sessionmaker.return_value = mock_session_factory

                    await process_culture_answer_full_async(
                        user_id=user_id,
                        question_id=question_id,
                        selected_option=1,
                        time_taken=5,
                        language="en",
                        is_correct=True,
                        is_perfect=False,
                        deck_category="history",
                        db_url="postgresql+asyncpg://test:test@localhost/test",
                    )

                    assert call_order == ["session.close", "engine.dispose"]

    @pytest.mark.asyncio
    async def test_check_culture_achievements_closes_session_before_engine_dispose(self):
        """Test that check_culture_achievements_task closes session before engine dispose."""
        from src.tasks.background import check_culture_achievements_task

        user_id = uuid4()
        question_id = uuid4()
        call_order = []

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()

                async def mock_dispose():
                    call_order.append("engine.dispose")

                mock_engine.dispose = mock_dispose
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    mock_session = AsyncMock()

                    async def mock_close():
                        call_order.append("session.close")

                    mock_session.close = mock_close
                    mock_session_factory = MagicMock(return_value=mock_session)
                    mock_sessionmaker.return_value = mock_session_factory

                    with patch(
                        "src.services.achievement_service.AchievementService"
                    ) as mock_service_class:
                        mock_service = AsyncMock()
                        mock_service.check_culture_achievements.return_value = []
                        mock_service_class.return_value = mock_service

                        await check_culture_achievements_task(
                            user_id=user_id,
                            question_id=question_id,
                            is_correct=True,
                            language="en",
                            deck_category="history",
                            db_url="postgresql+asyncpg://test:test@localhost/test",
                        )

                        assert call_order == ["session.close", "engine.dispose"]

    @pytest.mark.asyncio
    async def test_create_announcement_notifications_closes_session_before_engine_dispose(self):
        """Test that create_announcement_notifications_task closes session before engine dispose."""
        from src.tasks.background import create_announcement_notifications_task

        campaign_id = uuid4()
        call_order = []

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.create_async_engine") as mock_engine_creator:
                mock_engine = AsyncMock()

                async def mock_dispose():
                    call_order.append("engine.dispose")

                mock_engine.dispose = mock_dispose
                mock_engine_creator.return_value = mock_engine

                with patch("src.tasks.background.async_sessionmaker") as mock_sessionmaker:
                    mock_session = AsyncMock()

                    async def mock_close():
                        call_order.append("session.close")

                    mock_session.close = mock_close

                    # Mock execute to return empty user list
                    mock_result = MagicMock()
                    mock_result.scalars.return_value.all.return_value = []
                    mock_session.execute.return_value = mock_result

                    mock_session_factory = MagicMock(return_value=mock_session)
                    mock_sessionmaker.return_value = mock_session_factory

                    with patch(
                        "src.repositories.announcement.AnnouncementCampaignRepository"
                    ) as mock_repo_class:
                        mock_repo = AsyncMock()
                        mock_repo.get.return_value = None
                        mock_repo_class.return_value = mock_repo

                        await create_announcement_notifications_task(
                            campaign_id=campaign_id,
                            campaign_title="Test",
                            campaign_message="Test message",
                            link_url=None,
                            db_url="postgresql+asyncpg://test:test@localhost/test",
                        )

                        assert call_order == ["session.close", "engine.dispose"]
