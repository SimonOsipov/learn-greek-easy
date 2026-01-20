"""Unit tests for UserProgressResetService.

Tests cover:
- reset_all_progress: Coordinated deletion of all user progress data
- Cache invalidation after reset
- Handling of empty user data
- Correct deletion counts in result

These tests use mocked repositories to verify the service
coordinates deletions correctly without touching the database.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.schemas.danger_zone import ResetProgressResult
from src.services.user_progress_reset_service import UserProgressResetService


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    session = MagicMock()
    session.execute = AsyncMock()
    return session


@pytest.fixture
def service(mock_db_session):
    """Create a UserProgressResetService with mocked db session."""
    return UserProgressResetService(mock_db_session)


@pytest.mark.unit
class TestResetAllProgress:
    """Tests for UserProgressResetService.reset_all_progress method."""

    @pytest.mark.asyncio
    async def test_reset_deletes_all_data_types(self, service, mock_db_session):
        """Test that reset calls delete methods on all repositories."""
        user_id = uuid4()

        # Mock all repository delete methods
        service.review_repo.delete_all_by_user_id = AsyncMock(return_value=10)
        service.card_stats_repo.delete_all_by_user_id = AsyncMock(return_value=5)
        service.deck_progress_repo.delete_all_by_user_id = AsyncMock(return_value=2)
        service.culture_history_repo.delete_all_by_user_id = AsyncMock(return_value=15)
        service.culture_stats_repo.delete_all_by_user_id = AsyncMock(return_value=3)
        service.mock_exam_repo.delete_all_by_user_id = AsyncMock(return_value=(2, 8))
        service.notification_repo.delete_all_by_user = AsyncMock(return_value=5)

        # Mock direct SQLAlchemy deletes (XP transactions and achievements)
        mock_result = MagicMock()
        mock_result.rowcount = 7
        mock_db_session.execute.return_value = mock_result

        # Mock cache
        with patch("src.services.user_progress_reset_service.get_cache") as mock_get_cache:
            mock_cache = MagicMock()
            mock_cache.invalidate_all_user_data = AsyncMock(return_value=5)
            mock_get_cache.return_value = mock_cache

            result = await service.reset_all_progress(user_id)

        # Verify all repository methods were called with correct user_id
        service.review_repo.delete_all_by_user_id.assert_awaited_once_with(user_id)
        service.card_stats_repo.delete_all_by_user_id.assert_awaited_once_with(user_id)
        service.deck_progress_repo.delete_all_by_user_id.assert_awaited_once_with(user_id)
        service.culture_history_repo.delete_all_by_user_id.assert_awaited_once_with(user_id)
        service.culture_stats_repo.delete_all_by_user_id.assert_awaited_once_with(user_id)
        service.mock_exam_repo.delete_all_by_user_id.assert_awaited_once_with(user_id)
        service.notification_repo.delete_all_by_user.assert_awaited_once_with(user_id)

        # Verify direct SQLAlchemy executes were called (for XP, achievements, and XP reset)
        assert mock_db_session.execute.await_count >= 2  # At least XP transactions + achievements

        assert isinstance(result, ResetProgressResult)

    @pytest.mark.asyncio
    async def test_reset_returns_correct_counts(self, service, mock_db_session):
        """Test that returned counts match actual deletions."""
        user_id = uuid4()

        # Mock specific deletion counts
        service.review_repo.delete_all_by_user_id = AsyncMock(return_value=10)
        service.card_stats_repo.delete_all_by_user_id = AsyncMock(return_value=5)
        service.deck_progress_repo.delete_all_by_user_id = AsyncMock(return_value=2)
        service.culture_history_repo.delete_all_by_user_id = AsyncMock(return_value=15)
        service.culture_stats_repo.delete_all_by_user_id = AsyncMock(return_value=3)
        service.mock_exam_repo.delete_all_by_user_id = AsyncMock(return_value=(2, 8))
        service.notification_repo.delete_all_by_user = AsyncMock(return_value=5)

        # Mock XP transactions and achievements deletions
        xp_result = MagicMock()
        xp_result.rowcount = 7
        achievements_result = MagicMock()
        achievements_result.rowcount = 4
        xp_reset_result = MagicMock()
        xp_reset_result.rowcount = 1
        mock_db_session.execute.side_effect = [xp_result, achievements_result, xp_reset_result]

        with patch("src.services.user_progress_reset_service.get_cache") as mock_get_cache:
            mock_cache = MagicMock()
            mock_cache.invalidate_all_user_data = AsyncMock(return_value=5)
            mock_get_cache.return_value = mock_cache

            result = await service.reset_all_progress(user_id)

        # Verify counts
        assert result.reviews_deleted == 10
        assert result.card_statistics_deleted == 5
        assert result.user_deck_progress_deleted == 2
        assert result.culture_answer_history_deleted == 15
        assert result.culture_question_stats_deleted == 3
        assert result.mock_exam_sessions_deleted == 2
        assert result.mock_exam_answers_deleted == 8
        assert result.notifications_deleted == 5
        assert result.xp_transactions_deleted == 7
        assert result.user_achievements_deleted == 4
        assert result.user_xp_reset is True

    @pytest.mark.asyncio
    async def test_reset_calls_cache_invalidation(self, service, mock_db_session):
        """Test that cache is invalidated after successful reset."""
        user_id = uuid4()

        # Mock all repository methods to return 0
        service.review_repo.delete_all_by_user_id = AsyncMock(return_value=0)
        service.card_stats_repo.delete_all_by_user_id = AsyncMock(return_value=0)
        service.deck_progress_repo.delete_all_by_user_id = AsyncMock(return_value=0)
        service.culture_history_repo.delete_all_by_user_id = AsyncMock(return_value=0)
        service.culture_stats_repo.delete_all_by_user_id = AsyncMock(return_value=0)
        service.mock_exam_repo.delete_all_by_user_id = AsyncMock(return_value=(0, 0))
        service.notification_repo.delete_all_by_user = AsyncMock(return_value=0)

        mock_result = MagicMock()
        mock_result.rowcount = 0
        mock_db_session.execute.return_value = mock_result

        with patch("src.services.user_progress_reset_service.get_cache") as mock_get_cache:
            mock_cache = MagicMock()
            mock_cache.invalidate_all_user_data = AsyncMock(return_value=3)
            mock_get_cache.return_value = mock_cache

            await service.reset_all_progress(user_id)

            # Verify cache invalidation was called
            mock_cache.invalidate_all_user_data.assert_awaited_once_with(user_id)

    @pytest.mark.asyncio
    async def test_reset_handles_empty_user(self, service, mock_db_session):
        """Test reset for user with no existing data returns zeros."""
        user_id = uuid4()

        # Mock all methods to return 0 (no data to delete)
        service.review_repo.delete_all_by_user_id = AsyncMock(return_value=0)
        service.card_stats_repo.delete_all_by_user_id = AsyncMock(return_value=0)
        service.deck_progress_repo.delete_all_by_user_id = AsyncMock(return_value=0)
        service.culture_history_repo.delete_all_by_user_id = AsyncMock(return_value=0)
        service.culture_stats_repo.delete_all_by_user_id = AsyncMock(return_value=0)
        service.mock_exam_repo.delete_all_by_user_id = AsyncMock(return_value=(0, 0))
        service.notification_repo.delete_all_by_user = AsyncMock(return_value=0)

        mock_result = MagicMock()
        mock_result.rowcount = 0
        mock_db_session.execute.return_value = mock_result

        with patch("src.services.user_progress_reset_service.get_cache") as mock_get_cache:
            mock_cache = MagicMock()
            mock_cache.invalidate_all_user_data = AsyncMock(return_value=0)
            mock_get_cache.return_value = mock_cache

            result = await service.reset_all_progress(user_id)

        # Verify all counts are zero
        assert result.reviews_deleted == 0
        assert result.card_statistics_deleted == 0
        assert result.user_deck_progress_deleted == 0
        assert result.culture_answer_history_deleted == 0
        assert result.culture_question_stats_deleted == 0
        assert result.mock_exam_sessions_deleted == 0
        assert result.mock_exam_answers_deleted == 0
        assert result.notifications_deleted == 0
        assert result.xp_transactions_deleted == 0
        assert result.user_achievements_deleted == 0
        assert result.total_deleted == 0

    @pytest.mark.asyncio
    async def test_reset_continues_on_cache_failure(self, service, mock_db_session):
        """Test that cache failure is logged but doesn't fail the operation."""
        user_id = uuid4()

        # Mock successful deletions
        service.review_repo.delete_all_by_user_id = AsyncMock(return_value=5)
        service.card_stats_repo.delete_all_by_user_id = AsyncMock(return_value=3)
        service.deck_progress_repo.delete_all_by_user_id = AsyncMock(return_value=1)
        service.culture_history_repo.delete_all_by_user_id = AsyncMock(return_value=0)
        service.culture_stats_repo.delete_all_by_user_id = AsyncMock(return_value=0)
        service.mock_exam_repo.delete_all_by_user_id = AsyncMock(return_value=(0, 0))
        service.notification_repo.delete_all_by_user = AsyncMock(return_value=0)

        mock_result = MagicMock()
        mock_result.rowcount = 0
        mock_db_session.execute.return_value = mock_result

        with patch("src.services.user_progress_reset_service.get_cache") as mock_get_cache:
            mock_cache = MagicMock()
            # Simulate cache failure
            mock_cache.invalidate_all_user_data = AsyncMock(side_effect=Exception("Redis error"))
            mock_get_cache.return_value = mock_cache

            # Should not raise, just log warning
            result = await service.reset_all_progress(user_id)

            # Verify deletion still succeeded
            assert result.reviews_deleted == 5
            assert result.card_statistics_deleted == 3

    @pytest.mark.asyncio
    async def test_reset_total_deleted_property(self, service, mock_db_session):
        """Test that total_deleted property sums all counts correctly."""
        user_id = uuid4()

        # Mock specific counts that sum to a known total
        service.review_repo.delete_all_by_user_id = AsyncMock(return_value=10)
        service.card_stats_repo.delete_all_by_user_id = AsyncMock(return_value=5)
        service.deck_progress_repo.delete_all_by_user_id = AsyncMock(return_value=2)
        service.culture_history_repo.delete_all_by_user_id = AsyncMock(return_value=8)
        service.culture_stats_repo.delete_all_by_user_id = AsyncMock(return_value=4)
        service.mock_exam_repo.delete_all_by_user_id = AsyncMock(return_value=(3, 12))
        service.notification_repo.delete_all_by_user = AsyncMock(return_value=6)

        xp_result = MagicMock()
        xp_result.rowcount = 7
        achievements_result = MagicMock()
        achievements_result.rowcount = 3
        xp_reset_result = MagicMock()
        xp_reset_result.rowcount = 1
        mock_db_session.execute.side_effect = [xp_result, achievements_result, xp_reset_result]

        with patch("src.services.user_progress_reset_service.get_cache") as mock_get_cache:
            mock_cache = MagicMock()
            mock_cache.invalidate_all_user_data = AsyncMock(return_value=0)
            mock_get_cache.return_value = mock_cache

            result = await service.reset_all_progress(user_id)

        # Total: 10 + 5 + 2 + 8 + 4 + 3 + 12 + 6 + 7 + 3 = 60
        expected_total = 10 + 5 + 2 + 8 + 4 + 3 + 12 + 6 + 7 + 3
        assert result.total_deleted == expected_total
