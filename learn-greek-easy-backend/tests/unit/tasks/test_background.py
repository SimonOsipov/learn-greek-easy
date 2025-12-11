"""Unit tests for background tasks module."""

import asyncio
import inspect
from unittest.mock import patch
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
        assert params == ["cache_type", "entity_id", "user_id"]

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
        """Test that check_achievements_task can be called."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()
        db_url = "postgresql+asyncpg://test:test@localhost/test"

        # Should not raise any exception
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
            with patch("src.tasks.background.logger") as mock_logger:
                await check_achievements_task(user_id, "test_url")
                mock_logger.debug.assert_called()
                # Should log the actual execution, not "disabled"
                call_args = mock_logger.debug.call_args[0][0]
                assert str(user_id) in call_args
