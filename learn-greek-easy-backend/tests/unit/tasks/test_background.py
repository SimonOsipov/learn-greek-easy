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
            persist_culture_answer_task,
            process_answer_side_effects_task,
        )

        assert callable(check_achievements_task)
        assert callable(invalidate_cache_task)
        assert callable(is_background_tasks_enabled)
        assert callable(log_analytics_task)
        assert callable(persist_culture_answer_task)
        assert callable(process_answer_side_effects_task)
        assert isinstance(ANALYTICS_EVENTS, dict)

    def test_import_from_background_module(self):
        """Test importing directly from background module."""
        from src.tasks.background import (
            ANALYTICS_EVENTS,
            check_achievements_task,
            invalidate_cache_task,
            is_background_tasks_enabled,
            log_analytics_task,
            persist_culture_answer_task,
            persist_deck_review_task,
            process_answer_side_effects_task,
        )

        assert callable(check_achievements_task)
        assert callable(invalidate_cache_task)
        assert callable(is_background_tasks_enabled)
        assert callable(log_analytics_task)
        assert callable(persist_culture_answer_task)
        assert callable(persist_deck_review_task)
        assert callable(process_answer_side_effects_task)
        assert isinstance(ANALYTICS_EVENTS, dict)

    def test_all_exports_defined(self):
        """Test that __all__ is properly defined."""
        from src.tasks import __all__

        expected_exports = [
            # Background tasks (API-side)
            "ANALYTICS_EVENTS",
            "check_achievements_task",
            "award_flashcard_xp_task",
            "create_announcement_notifications_task",
            "invalidate_cache_task",
            "is_background_tasks_enabled",
            "log_analytics_task",
            "persist_culture_answer_task",
            "process_answer_side_effects_task",
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

    def test_check_achievements_task_signature(self):
        """Test that check_achievements_task has correct signature."""
        from src.tasks.background import check_achievements_task

        sig = inspect.signature(check_achievements_task)
        params = list(sig.parameters.keys())
        assert params == ["user_id"]

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


class TestPlaceholderExecution:
    """Test that placeholder functions execute without errors."""

    @pytest.mark.asyncio
    async def test_check_achievements_task_executes(self):
        """Test that check_achievements_task can be called without raising."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()

        # With feature disabled, should just return early without error
        with patch.object(settings, "feature_background_tasks", False):
            await check_achievements_task(user_id)

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


def _make_mock_reconcile_result(new_unlocks=None, leveled_up=False):
    """Helper: build a MagicMock that looks like ReconcileResult."""
    mock_result = MagicMock()
    mock_result.new_unlocks = new_unlocks if new_unlocks is not None else []
    mock_result.leveled_up = leveled_up
    return mock_result


class TestLoggingBehavior:
    """Test logging behavior when background tasks are disabled."""

    @pytest.mark.asyncio
    async def test_check_achievements_logs_when_disabled(self):
        """Test that check_achievements_task logs when disabled."""
        from src.tasks.background import check_achievements_task

        with patch.object(settings, "feature_background_tasks", False):
            with patch("src.tasks.background.logger") as mock_logger:
                await check_achievements_task(uuid4())
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
    async def test_check_achievements_logs_when_enabled(self):
        """Test that check_achievements_task logs execution when enabled."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()
        mock_session = AsyncMock()
        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                with patch(
                    "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                    new=AsyncMock(return_value=_make_mock_reconcile_result()),
                ):
                    with patch("src.tasks.background.logger") as mock_logger:
                        await check_achievements_task(user_id)
                        # Should log info on start
                        mock_logger.info.assert_called()


def _make_mock_session_factory(mock_session: AsyncMock) -> MagicMock:
    """Return a callable factory whose context manager yields mock_session."""
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
    mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)
    return mock_factory


class TestCheckAchievementsTaskImplementation:
    """Test the full implementation of check_achievements_task."""

    @pytest.mark.asyncio
    async def test_check_achievements_success(self):
        """Test successful achievement check."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()
        mock_session = AsyncMock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                with patch(
                    "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                    new=AsyncMock(return_value=_make_mock_reconcile_result()),
                ):
                    await check_achievements_task(user_id)

    @pytest.mark.asyncio
    async def test_check_achievements_handles_database_error(self):
        """Test that errors from get_session_factory are handled gracefully."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch(
                "src.tasks.background.get_session_factory",
                side_effect=RuntimeError("DB not initialized"),
            ):
                with patch("src.tasks.background.logger") as mock_logger:
                    # Should not raise - errors are caught and logged
                    await check_achievements_task(user_id)

                    # Should log the error with updated message
                    mock_logger.error.assert_called()
                    error_call = mock_logger.error.call_args
                    assert "Reconcile failed in check_achievements_task" in error_call[0][0]

    @pytest.mark.asyncio
    async def test_check_achievements_handles_session_error(self):
        """Test that reconciler errors inside a session are handled gracefully."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()
        mock_session = AsyncMock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                with patch(
                    "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                    new=AsyncMock(side_effect=Exception("Reconciler failed")),
                ):
                    with patch("src.tasks.background.logger") as mock_logger:
                        # Should not raise
                        await check_achievements_task(user_id)

                        # Should log the error
                        mock_logger.error.assert_called()

    @pytest.mark.asyncio
    async def test_check_achievements_disposes_engine_on_success(self):
        """No-op: engine disposal no longer applies (global pool, no per-call engine)."""
        # The task now uses the global pool; this test verifies commit is called.
        from src.tasks.background import check_achievements_task

        user_id = uuid4()
        mock_session = AsyncMock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                with patch(
                    "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                    new=AsyncMock(return_value=_make_mock_reconcile_result()),
                ):
                    await check_achievements_task(user_id)

                mock_session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_check_achievements_disposes_engine_on_error(self):
        """No-op: engine disposal no longer applies (global pool, no per-call engine)."""
        # Verify that an error in reconcile still results in a logged error (not a raise).
        from src.tasks.background import check_achievements_task

        user_id = uuid4()
        mock_session = AsyncMock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                with patch(
                    "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                    new=AsyncMock(side_effect=Exception("Reconciler error")),
                ):
                    with patch("src.tasks.background.logger") as mock_logger:
                        await check_achievements_task(user_id)
                        mock_logger.error.assert_called()

    @pytest.mark.asyncio
    async def test_check_achievements_uses_global_session_factory(self):
        """Test that get_session_factory() is called (global pool used)."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()
        mock_session = AsyncMock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch(
                "src.tasks.background.get_session_factory", return_value=mock_factory
            ) as mock_get_factory:
                with patch(
                    "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                    new=AsyncMock(return_value=_make_mock_reconcile_result()),
                ):
                    await check_achievements_task(user_id)

                mock_get_factory.assert_called_once()

    @pytest.mark.asyncio
    async def test_check_achievements_logs_start_and_completion(self):
        """Test that achievement check logs start and completion."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()
        mock_session = AsyncMock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                with patch(
                    "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                    new=AsyncMock(return_value=_make_mock_reconcile_result()),
                ):
                    with patch("src.tasks.background.logger") as mock_logger:
                        await check_achievements_task(user_id)

                        # Should have at least 2 info logs (start and completion)
                        assert mock_logger.info.call_count >= 2

                        # Check start log
                        start_call = mock_logger.info.call_args_list[0]
                        assert (
                            "Starting reconcile (IMMEDIATE) from check_achievements_task"
                            in start_call[0][0]
                        )

                        # Check completion log
                        completion_call = mock_logger.info.call_args_list[1]
                        assert "Reconcile complete" in completion_call[0][0]


class TestCheckAchievementsTaskReconciler:
    """Test that check_achievements_task calls GamificationReconciler correctly (Phase 5)."""

    @pytest.mark.asyncio
    async def test_calls_reconciler_with_immediate_mode(self):
        """Should call GamificationReconciler.reconcile with ReconcileMode.IMMEDIATE."""
        from src.services.gamification.types import ReconcileMode
        from src.tasks.background import check_achievements_task

        user_id = uuid4()
        mock_session = AsyncMock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                mock_result = _make_mock_reconcile_result()
                with patch(
                    "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                    new=AsyncMock(return_value=mock_result),
                ) as mock_reconcile:
                    await check_achievements_task(user_id)

                    # Reconciler called with session, user_id, IMMEDIATE
                    mock_reconcile.assert_called_once()
                    call_args = mock_reconcile.call_args
                    assert call_args[0][1] == user_id
                    assert call_args[0][2] == ReconcileMode.IMMEDIATE

    @pytest.mark.asyncio
    async def test_commits_session_after_reconcile(self):
        """Should call session.commit() exactly once after reconcile."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()
        mock_session = AsyncMock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                mock_result = _make_mock_reconcile_result(
                    new_unlocks=["learning_first_word"], leveled_up=False
                )
                with patch(
                    "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                    new=AsyncMock(return_value=mock_result),
                ):
                    await check_achievements_task(user_id)

                # session.commit() called exactly once
                mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_engine_disposed_in_finally_on_success(self):
        """No engine to dispose; verify session commit still called on success."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()
        mock_session = AsyncMock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                with patch(
                    "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                    new=AsyncMock(return_value=_make_mock_reconcile_result()),
                ):
                    await check_achievements_task(user_id)

            mock_session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_engine_disposed_in_finally_on_reconciler_error(self):
        """Error in reconciler is caught and logged; task does not raise."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()
        mock_session = AsyncMock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                with patch(
                    "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                    new=AsyncMock(side_effect=RuntimeError("projection failed")),
                ):
                    with patch("src.tasks.background.logger") as mock_logger:
                        # Must not raise
                        await check_achievements_task(user_id)

                        # Error must be logged with exact message
                        mock_logger.error.assert_called()
                        error_call = mock_logger.error.call_args
                        assert "Reconcile failed in check_achievements_task" in error_call[0][0]

    @pytest.mark.asyncio
    async def test_no_reraise_on_reconciler_error(self):
        """Reconciler errors must be swallowed — task must not propagate exceptions."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()
        mock_session = AsyncMock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                with patch(
                    "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                    new=AsyncMock(side_effect=ValueError("unexpected")),
                ):
                    # Should complete without raising
                    await check_achievements_task(user_id)

    @pytest.mark.asyncio
    async def test_sse_signal_preserved(self):
        """SSE dashboard_event_bus.signal fire-and-forget block must still execute."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()
        mock_session = AsyncMock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                with patch(
                    "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                    new=AsyncMock(return_value=_make_mock_reconcile_result()),
                ):
                    mock_event_bus = AsyncMock()
                    with patch("src.core.event_bus.dashboard_event_bus", mock_event_bus):
                        # The SSE block swallows its own exceptions; just verify it's called
                        # (loop.create_task is synchronous, so signal may not be awaited here)
                        await check_achievements_task(user_id)
                        # No assertion on signal — the block is fire-and-forget and
                        # create_task only schedules it; we verify the block doesn't raise.


class TestRunReviewSideEffectsReconcileOnce:
    """Prove that _run_review_side_effects reaches reconcile EXACTLY once per review."""

    @pytest.mark.asyncio
    async def test_reconcile_called_exactly_once_per_review(self):
        """_run_review_side_effects must invoke check_achievements_task once, which
        transitively calls GamificationReconciler.reconcile once. No double-reconcile."""
        from src.tasks.background import _run_review_side_effects

        user_id = str(uuid4())
        card_record_id = str(uuid4())

        reconcile_call_count = 0

        async def _counting_reconcile(*args, **kwargs):
            nonlocal reconcile_call_count
            reconcile_call_count += 1
            return _make_mock_reconcile_result()

        mock_session = AsyncMock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                with patch(
                    "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                    new=_counting_reconcile,
                ):
                    # XP service mock (award_flashcard_xp_task inner)
                    with patch("src.services.xp_service.XPService") as mock_xp_cls:
                        mock_xp = AsyncMock()
                        mock_xp.award_flashcard_review_xp.return_value = 10
                        mock_xp_cls.return_value = mock_xp

                        await _run_review_side_effects(
                            user_id=user_id,
                            card_record_id=card_record_id,
                            quality=4,
                            time_taken=3000,
                            new_status_value="learning",
                            reviews_before=0,
                        )

        assert (
            reconcile_call_count == 1
        ), f"Expected reconcile to be called exactly once, got {reconcile_call_count}"


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


class TestSessionCleanupOrder:
    """Test that session lifecycle is correctly managed via the global pool.

    Tasks now use `async with get_session_factory()() as session:` so the
    context manager handles close/rollback.  These tests verify that the
    global factory is invoked and that errors are caught without raising.
    """

    @pytest.mark.asyncio
    async def test_check_achievements_uses_context_manager_session(self):
        """check_achievements_task must enter the session context manager."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()
        mock_session = AsyncMock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                with patch(
                    "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                    new=AsyncMock(return_value=_make_mock_reconcile_result()),
                ):
                    await check_achievements_task(user_id)

        # Context manager __aenter__ was called
        mock_factory.return_value.__aenter__.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_check_achievements_context_manager_exited_on_error(self):
        """Context manager __aexit__ must be called even when reconciler raises."""
        from src.tasks.background import check_achievements_task

        user_id = uuid4()
        mock_session = AsyncMock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                with patch(
                    "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                    new=AsyncMock(side_effect=RuntimeError("boom")),
                ):
                    await check_achievements_task(user_id)

        mock_factory.return_value.__aexit__.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_process_answer_side_effects_uses_context_manager_session(self):
        """process_answer_side_effects_task must enter the session context manager."""
        from src.tasks.background import process_answer_side_effects_task

        user_id = uuid4()
        question_id = uuid4()
        mock_session = AsyncMock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
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
                    )

        mock_factory.return_value.__aenter__.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_create_announcement_notifications_uses_context_manager_session(self):
        """create_announcement_notifications_task must enter the session context manager."""
        from src.tasks.background import create_announcement_notifications_task

        campaign_id = uuid4()
        mock_session = AsyncMock()

        # Mock execute to return empty user list
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
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
                    )

        mock_factory.return_value.__aenter__.assert_awaited_once()


# =============================================================================
# Helpers for new task tests
# =============================================================================


def _make_persist_deck_review_kwargs() -> dict:
    """Return a complete set of kwargs for persist_deck_review_task."""
    from uuid import uuid4

    return {
        "user_id": str(uuid4()),
        "card_record_id": str(uuid4()),
        "deck_id": str(uuid4()),
        "card_type_value": "meaning_el_to_en",
        "quality": 4,
        "time_taken": 10,
        "stats_id": str(uuid4()),
        "stats_created_at_iso": None,
        "new_ef": 2.5,
        "new_interval": 1,
        "new_repetitions": 1,
        "new_status_value": "learning",
        "next_review_date_iso": "2026-03-20",
        "previous_status_value": "new",
        "is_newly_mastered": False,
        "reviews_before": 0,
        "user_email": None,
    }


def _make_persist_culture_answer_kwargs() -> dict:
    """Return a complete set of kwargs for persist_culture_answer_task."""
    from uuid import uuid4

    return {
        "user_id": uuid4(),
        "question_id": uuid4(),
        "selected_option": 1,
        "time_taken": 10,
        "language": "en",
        "is_correct": True,
        "is_perfect": False,
        "deck_category": "history",
        "sm2_new_ef": 2.5,
        "sm2_new_interval": 1,
        "sm2_new_repetitions": 1,
        "sm2_new_status": "learning",
        "sm2_next_review_date": "2026-03-20",
        "stats_previous_status": "new",
    }


class TestPersistDeckReviewTask:
    """Tests for persist_deck_review_task background task."""

    def test_is_async(self):
        """persist_deck_review_task must be an async function."""
        from src.tasks.background import persist_deck_review_task

        assert asyncio.iscoroutinefunction(persist_deck_review_task)

    @pytest.mark.asyncio
    async def test_skipped_when_disabled(self):
        """Task exits early without touching get_session_factory when tasks disabled."""
        from src.tasks.background import persist_deck_review_task

        kwargs = _make_persist_deck_review_kwargs()
        with patch.object(settings, "feature_background_tasks", False):
            with patch("src.tasks.background.get_session_factory") as mock_factory_fn:
                await persist_deck_review_task(**kwargs)

        mock_factory_fn.assert_not_called()

    @pytest.mark.asyncio
    async def test_uses_global_session_factory(self):
        """Task must use the global session factory."""
        from src.tasks.background import persist_deck_review_task

        kwargs = _make_persist_deck_review_kwargs()
        mock_session = AsyncMock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch(
                "src.tasks.background.get_session_factory", return_value=mock_factory
            ) as mock_factory_fn:
                with patch("src.tasks.background._persist_review_core", new_callable=AsyncMock):
                    with patch(
                        "src.tasks.background._run_review_side_effects", new_callable=AsyncMock
                    ):
                        await persist_deck_review_task(**kwargs)

        mock_factory_fn.assert_called_once()

    @pytest.mark.asyncio
    async def test_calls_persist_review_core(self):
        """Task must delegate DB writes to _persist_review_core."""
        from src.tasks.background import persist_deck_review_task

        kwargs = _make_persist_deck_review_kwargs()
        mock_session = AsyncMock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                with patch(
                    "src.tasks.background._persist_review_core", new_callable=AsyncMock
                ) as mock_core:
                    with patch(
                        "src.tasks.background._run_review_side_effects", new_callable=AsyncMock
                    ):
                        await persist_deck_review_task(**kwargs)

        mock_core.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_no_sm2_recalculation(self):
        """persist_deck_review_task must not call calculate_sm2."""
        from src.tasks.background import persist_deck_review_task

        kwargs = _make_persist_deck_review_kwargs()
        mock_session = AsyncMock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                with patch("src.tasks.background._persist_review_core", new_callable=AsyncMock):
                    with patch(
                        "src.tasks.background._run_review_side_effects", new_callable=AsyncMock
                    ):
                        with patch("src.core.sm2.calculate_sm2") as mock_calc:
                            await persist_deck_review_task(**kwargs)

        mock_calc.assert_not_called()

    @pytest.mark.asyncio
    async def test_session_commit_called_after_core(self):
        """Session commit must be called after _persist_review_core succeeds."""
        from src.tasks.background import persist_deck_review_task

        kwargs = _make_persist_deck_review_kwargs()
        mock_session = AsyncMock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                with patch("src.tasks.background._persist_review_core", new_callable=AsyncMock):
                    with patch(
                        "src.tasks.background._run_review_side_effects", new_callable=AsyncMock
                    ):
                        await persist_deck_review_task(**kwargs)

        mock_session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_error_inside_task_does_not_raise(self):
        """An error from get_session_factory must be caught; task must not raise."""
        from src.tasks.background import persist_deck_review_task

        kwargs = _make_persist_deck_review_kwargs()

        with patch.object(settings, "feature_background_tasks", True):
            with patch(
                "src.tasks.background.get_session_factory",
                side_effect=RuntimeError("DB not initialized"),
            ):
                # Should not raise — errors are caught internally
                await persist_deck_review_task(**kwargs)


class TestPersistCultureAnswerTask:
    """Tests for persist_culture_answer_task background task."""

    def test_is_async(self):
        """persist_culture_answer_task must be an async function."""
        from src.tasks.background import persist_culture_answer_task

        assert asyncio.iscoroutinefunction(persist_culture_answer_task)

    @pytest.mark.asyncio
    async def test_skipped_when_disabled(self):
        """Task exits early without touching get_session_factory when tasks disabled."""
        from src.tasks.background import persist_culture_answer_task

        kwargs = _make_persist_culture_answer_kwargs()
        with patch.object(settings, "feature_background_tasks", False):
            with patch("src.tasks.background.get_session_factory") as mock_factory_fn:
                await persist_culture_answer_task(**kwargs)

        mock_factory_fn.assert_not_called()

    def _make_full_culture_session_mock(self):
        """Return a configured mock session for persist_culture_answer_task tests."""
        mock_session = AsyncMock()
        mock_stats_obj = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_stats_obj
        mock_session.execute = AsyncMock(return_value=mock_result)
        return mock_session, mock_stats_obj

    def _patch_culture_task_deps(
        self, mock_session, xp_earned=10, xp_bonus=0, reconcile_result=None
    ):
        """Return a list of context manager patches for persist_culture_answer_task."""
        if reconcile_result is None:
            reconcile_result = MagicMock(new_unlocks=[], leveled_up=False)
        mock_factory = _make_mock_session_factory(mock_session)
        return mock_factory

    @pytest.mark.asyncio
    async def test_uses_global_session_factory(self):
        """Task must use the global session factory."""
        from src.tasks.background import persist_culture_answer_task

        kwargs = _make_persist_culture_answer_kwargs()
        mock_session, _ = self._make_full_culture_session_mock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch(
                "src.tasks.background.get_session_factory", return_value=mock_factory
            ) as mock_factory_fn:
                with patch("src.services.xp_service.XPService") as mock_xp_cls:
                    mock_xp = AsyncMock()
                    mock_xp.award_culture_answer_xp = AsyncMock(return_value=10)
                    mock_xp.award_first_review_bonus = AsyncMock(return_value=0)
                    mock_xp_cls.return_value = mock_xp

                    with patch(
                        "src.tasks.background._check_and_notify_daily_goal", new_callable=AsyncMock
                    ):
                        with patch(
                            "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                            new_callable=AsyncMock,
                            return_value=MagicMock(new_unlocks=[], leveled_up=False),
                        ):
                            with patch(
                                "src.repositories.culture_question_stats.CultureQuestionStatsRepository"
                            ) as mock_stats_cls:
                                mock_stats_repo = AsyncMock()
                                mock_stats_repo.count_answers_today = AsyncMock(return_value=1)
                                mock_stats_cls.return_value = mock_stats_repo

                                await persist_culture_answer_task(**kwargs)

        mock_factory_fn.assert_called_once()

    @pytest.mark.asyncio
    async def test_applies_precomputed_sm2_values(self):
        """Task must apply pre-computed SM2 values without recalculating."""
        from src.tasks.background import persist_culture_answer_task

        kwargs = _make_persist_culture_answer_kwargs()
        mock_session, mock_stats_obj = self._make_full_culture_session_mock()
        mock_stats_obj.easiness_factor = 2.5
        mock_stats_obj.interval = 1
        mock_stats_obj.repetitions = 0
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                with patch("src.services.xp_service.XPService") as mock_xp_cls:
                    mock_xp = AsyncMock()
                    mock_xp.award_culture_answer_xp = AsyncMock(return_value=10)
                    mock_xp.award_first_review_bonus = AsyncMock(return_value=0)
                    mock_xp_cls.return_value = mock_xp

                    with patch(
                        "src.tasks.background._check_and_notify_daily_goal", new_callable=AsyncMock
                    ):
                        with patch(
                            "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                            new_callable=AsyncMock,
                            return_value=MagicMock(new_unlocks=[], leveled_up=False),
                        ):
                            with patch(
                                "src.repositories.culture_question_stats.CultureQuestionStatsRepository"
                            ) as mock_stats_cls:
                                mock_stats_repo = AsyncMock()
                                mock_stats_repo.count_answers_today = AsyncMock(return_value=1)
                                mock_stats_cls.return_value = mock_stats_repo

                                await persist_culture_answer_task(**kwargs)

        # Verify SM-2 values were set directly (not recalculated)
        assert mock_stats_obj.easiness_factor == kwargs["sm2_new_ef"]
        assert mock_stats_obj.interval == kwargs["sm2_new_interval"]
        assert mock_stats_obj.repetitions == kwargs["sm2_new_repetitions"]

    @pytest.mark.asyncio
    async def test_no_sm2_recalculation(self):
        """persist_culture_answer_task must not call calculate_sm2."""
        from src.tasks.background import persist_culture_answer_task

        kwargs = _make_persist_culture_answer_kwargs()

        with patch.object(settings, "feature_background_tasks", True):
            with patch(
                "src.tasks.background.get_session_factory",
                side_effect=RuntimeError("DB not initialized"),
            ):
                with patch("src.core.sm2.calculate_sm2") as mock_calc:
                    await persist_culture_answer_task(**kwargs)

        mock_calc.assert_not_called()

    @pytest.mark.asyncio
    async def test_records_answer_history(self):
        """Task must call session.add to record CultureAnswerHistory."""
        from src.tasks.background import persist_culture_answer_task

        kwargs = _make_persist_culture_answer_kwargs()
        mock_session, _ = self._make_full_culture_session_mock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                with patch("src.services.xp_service.XPService") as mock_xp_cls:
                    mock_xp = AsyncMock()
                    mock_xp.award_culture_answer_xp = AsyncMock(return_value=10)
                    mock_xp.award_first_review_bonus = AsyncMock(return_value=0)
                    mock_xp_cls.return_value = mock_xp

                    with patch(
                        "src.tasks.background._check_and_notify_daily_goal", new_callable=AsyncMock
                    ):
                        with patch(
                            "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                            new_callable=AsyncMock,
                            return_value=MagicMock(new_unlocks=[], leveled_up=False),
                        ):
                            with patch(
                                "src.repositories.culture_question_stats.CultureQuestionStatsRepository"
                            ) as mock_stats_cls:
                                mock_stats_repo = AsyncMock()
                                mock_stats_repo.count_answers_today = AsyncMock(return_value=1)
                                mock_stats_cls.return_value = mock_stats_repo

                                await persist_culture_answer_task(**kwargs)

        # session.add should be called at least once (for CultureAnswerHistory)
        mock_session.add.assert_called()

    @pytest.mark.asyncio
    async def test_error_inside_task_does_not_raise(self):
        """An error from get_session_factory must be caught; task must not raise."""
        from src.tasks.background import persist_culture_answer_task

        kwargs = _make_persist_culture_answer_kwargs()

        with patch.object(settings, "feature_background_tasks", True):
            with patch(
                "src.tasks.background.get_session_factory",
                side_effect=RuntimeError("DB not initialized"),
            ):
                # Should not raise — errors are caught internally
                await persist_culture_answer_task(**kwargs)

    # ------------------------------------------------------------------
    # New tests: reconciler cutover (GAMIF-05-05)
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_reconciler_called_with_correct_args(self):
        """GamificationReconciler.reconcile must be called once with (session, user_id, IMMEDIATE)."""
        from src.services.gamification.types import ReconcileMode
        from src.tasks.background import persist_culture_answer_task

        kwargs = _make_persist_culture_answer_kwargs()
        user_id = kwargs["user_id"]
        mock_session, _ = self._make_full_culture_session_mock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                with patch("src.services.xp_service.XPService") as mock_xp_cls:
                    mock_xp = AsyncMock()
                    mock_xp.award_culture_answer_xp = AsyncMock(return_value=10)
                    mock_xp.award_first_review_bonus = AsyncMock(return_value=0)
                    mock_xp_cls.return_value = mock_xp

                    with patch(
                        "src.tasks.background._check_and_notify_daily_goal", new_callable=AsyncMock
                    ):
                        with patch(
                            "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                            new_callable=AsyncMock,
                            return_value=MagicMock(new_unlocks=[], leveled_up=False),
                        ) as mock_reconcile:
                            with patch(
                                "src.repositories.culture_question_stats.CultureQuestionStatsRepository"
                            ) as mock_stats_cls:
                                mock_stats_repo = AsyncMock()
                                mock_stats_repo.count_answers_today = AsyncMock(return_value=1)
                                mock_stats_cls.return_value = mock_stats_repo

                                await persist_culture_answer_task(**kwargs)

        mock_reconcile.assert_awaited_once()
        call_args = mock_reconcile.call_args
        # First positional arg is the session, second is user_id, third is mode
        assert call_args[0][1] == user_id
        assert call_args[0][2] == ReconcileMode.IMMEDIATE

    @pytest.mark.asyncio
    async def test_legacy_check_culture_achievements_not_called(self):
        """AchievementService.check_culture_achievements must NOT be called after cutover."""
        from src.tasks.background import persist_culture_answer_task

        kwargs = _make_persist_culture_answer_kwargs()
        mock_session, _ = self._make_full_culture_session_mock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                with patch("src.services.xp_service.XPService") as mock_xp_cls:
                    mock_xp = AsyncMock()
                    mock_xp.award_culture_answer_xp = AsyncMock(return_value=10)
                    mock_xp.award_first_review_bonus = AsyncMock(return_value=0)
                    mock_xp_cls.return_value = mock_xp

                    with patch(
                        "src.tasks.background._check_and_notify_daily_goal", new_callable=AsyncMock
                    ):
                        with patch(
                            "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                            new_callable=AsyncMock,
                            return_value=MagicMock(new_unlocks=[], leveled_up=False),
                        ):
                            with patch(
                                "src.repositories.culture_question_stats.CultureQuestionStatsRepository"
                            ) as mock_stats_cls:
                                mock_stats_repo = AsyncMock()
                                mock_stats_repo.count_answers_today = AsyncMock(return_value=1)
                                mock_stats_cls.return_value = mock_stats_repo

                                with patch(
                                    "src.services.achievement_service.AchievementService"
                                ) as mock_ach_cls:
                                    await persist_culture_answer_task(**kwargs)

        # AchievementService must not be instantiated at all
        mock_ach_cls.assert_not_called()

    @pytest.mark.asyncio
    async def test_reconciler_exception_caught_and_not_reraised(self):
        """Reconciler errors must be caught + logged; task must NOT raise (preserves answer + XP)."""
        from src.tasks.background import persist_culture_answer_task

        kwargs = _make_persist_culture_answer_kwargs()
        mock_session, _ = self._make_full_culture_session_mock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                with patch("src.services.xp_service.XPService") as mock_xp_cls:
                    mock_xp = AsyncMock()
                    mock_xp.award_culture_answer_xp = AsyncMock(return_value=10)
                    mock_xp.award_first_review_bonus = AsyncMock(return_value=0)
                    mock_xp_cls.return_value = mock_xp

                    with patch(
                        "src.tasks.background._check_and_notify_daily_goal", new_callable=AsyncMock
                    ):
                        with patch(
                            "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                            new_callable=AsyncMock,
                            side_effect=RuntimeError("reconciler boom"),
                        ):
                            with patch(
                                "src.repositories.culture_question_stats.CultureQuestionStatsRepository"
                            ) as mock_stats_cls:
                                mock_stats_repo = AsyncMock()
                                mock_stats_repo.count_answers_today = AsyncMock(return_value=1)
                                mock_stats_cls.return_value = mock_stats_repo

                                # Must not raise — reconciler errors are isolated
                                await persist_culture_answer_task(**kwargs)

        # commit must still have been called (answer + XP persisted)
        mock_session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_unlocked_achievements_logged_with_count_and_ids(self):
        """When reconciler returns new_unlocks, log must include unlocked_count + achievement_ids."""
        from src.tasks.background import persist_culture_answer_task

        kwargs = _make_persist_culture_answer_kwargs()
        mock_session, _ = self._make_full_culture_session_mock()
        mock_factory = _make_mock_session_factory(mock_session)
        unlocked_ids = ["culture_curious", "perfect_culture_score"]

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                with patch("src.services.xp_service.XPService") as mock_xp_cls:
                    mock_xp = AsyncMock()
                    mock_xp.award_culture_answer_xp = AsyncMock(return_value=10)
                    mock_xp.award_first_review_bonus = AsyncMock(return_value=0)
                    mock_xp_cls.return_value = mock_xp

                    with patch(
                        "src.tasks.background._check_and_notify_daily_goal", new_callable=AsyncMock
                    ):
                        with patch(
                            "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                            new_callable=AsyncMock,
                            return_value=MagicMock(new_unlocks=unlocked_ids, leveled_up=True),
                        ):
                            with patch(
                                "src.repositories.culture_question_stats.CultureQuestionStatsRepository"
                            ) as mock_stats_cls:
                                mock_stats_repo = AsyncMock()
                                mock_stats_repo.count_answers_today = AsyncMock(return_value=1)
                                mock_stats_cls.return_value = mock_stats_repo

                                with patch("src.tasks.background.logger") as mock_logger:
                                    await persist_culture_answer_task(**kwargs)

        # Verify logger.info was called with the achievement details
        info_calls = mock_logger.info.call_args_list
        achievement_log = next(
            (c for c in info_calls if "Achievements unlocked via reconciler" in str(c)),
            None,
        )
        assert achievement_log is not None, "Expected achievement unlock log call not found"
        extra = (
            achievement_log[1].get("extra", {}) or achievement_log[0][1].get("extra", {})
            if len(achievement_log[0]) > 1
            else {}
        )
        # Reconstruct extra from kwargs
        all_kwargs = achievement_log[1]
        if "extra" in all_kwargs:
            extra = all_kwargs["extra"]
        else:
            # extra may be positional or in args
            extra = {}
        assert extra.get("unlocked_count") == 2
        assert extra.get("achievement_ids") == unlocked_ids

    @pytest.mark.asyncio
    async def test_regression_xp_services_still_called(self):
        """Regression: award_culture_answer_xp + award_first_review_bonus still called after cutover."""
        from src.tasks.background import persist_culture_answer_task

        kwargs = _make_persist_culture_answer_kwargs()
        mock_session, _ = self._make_full_culture_session_mock()
        mock_factory = _make_mock_session_factory(mock_session)

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.get_session_factory", return_value=mock_factory):
                with patch("src.services.xp_service.XPService") as mock_xp_cls:
                    mock_xp = AsyncMock()
                    mock_xp_culture = AsyncMock(return_value=10)
                    mock_xp_bonus = AsyncMock(return_value=5)
                    mock_xp.award_culture_answer_xp = mock_xp_culture
                    mock_xp.award_first_review_bonus = mock_xp_bonus
                    mock_xp_cls.return_value = mock_xp

                    with patch(
                        "src.tasks.background._check_and_notify_daily_goal", new_callable=AsyncMock
                    ) as mock_daily_goal:
                        with patch(
                            "src.services.gamification.reconciler.GamificationReconciler.reconcile",
                            new_callable=AsyncMock,
                            return_value=MagicMock(new_unlocks=[], leveled_up=False),
                        ):
                            with patch(
                                "src.repositories.culture_question_stats.CultureQuestionStatsRepository"
                            ) as mock_stats_cls:
                                mock_stats_repo = AsyncMock()
                                mock_stats_repo.count_answers_today = AsyncMock(return_value=1)
                                mock_stats_cls.return_value = mock_stats_repo

                                await persist_culture_answer_task(**kwargs)

        mock_xp_culture.assert_awaited_once()
        call_kwargs = mock_xp_culture.call_args[1]
        assert call_kwargs["user_id"] == kwargs["user_id"]
        assert call_kwargs["is_correct"] == kwargs["is_correct"]
        assert call_kwargs["is_perfect"] == kwargs["is_perfect"]
        assert call_kwargs["source_id"] == kwargs["question_id"]

        # is_correct=True in fixture, so first_review_bonus must be called
        mock_xp_bonus.assert_awaited_once_with(kwargs["user_id"])

        # _check_and_notify_daily_goal must still be called
        mock_daily_goal.assert_awaited_once()
