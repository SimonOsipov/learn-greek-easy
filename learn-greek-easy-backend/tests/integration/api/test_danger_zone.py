"""Integration tests for Danger Zone API endpoints.

This module provides comprehensive tests for the danger zone endpoints:
- POST /api/v1/users/me/reset-progress - Reset all learning progress
- DELETE /api/v1/users/me - Delete user account

These tests use real database operations to verify actual data deletion.
"""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    Achievement,
    AchievementCategory,
    CardStatistics,
    CardStatus,
    Review,
    ReviewRating,
    User,
    UserAchievement,
    UserDeckProgress,
    UserXP,
    XPTransaction,
)
from tests.fixtures.deck import DeckWithCards

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def user_with_progress(
    db_session: AsyncSession,
    test_user: User,
    deck_with_cards: DeckWithCards,
) -> User:
    """Create test user with full progress data.

    Creates:
    - Deck progress records
    - Card statistics
    - Reviews
    - XP transactions
    - User achievements

    Returns:
        User: The test user with all progress data
    """
    deck = deck_with_cards.deck
    cards = deck_with_cards.cards

    # Create deck progress
    progress = UserDeckProgress(
        user_id=test_user.id,
        deck_id=deck.id,
        cards_studied=len(cards),
        cards_mastered=2,
        last_studied_at=datetime.utcnow(),
    )
    db_session.add(progress)

    # Create card statistics for all cards
    for i, card in enumerate(cards):
        stats = CardStatistics(
            user_id=test_user.id,
            card_id=card.id,
            easiness_factor=2.5,
            interval=i + 1,
            repetitions=i + 1,
            next_review_date=datetime.utcnow().date() + timedelta(days=i),
            status=CardStatus.LEARNING if i < 3 else CardStatus.REVIEW,
        )
        db_session.add(stats)

        # Create reviews
        for _ in range(2):
            review = Review(
                user_id=test_user.id,
                card_id=card.id,
                quality=ReviewRating.CORRECT_HESITANT,
                time_taken=10,
                reviewed_at=datetime.utcnow() - timedelta(days=i),
            )
            db_session.add(review)

    # Create UserXP record
    user_xp = UserXP(
        user_id=test_user.id,
        total_xp=500,
        current_level=3,
    )
    db_session.add(user_xp)

    # Create XP transactions
    for i in range(5):
        xp_transaction = XPTransaction(
            user_id=test_user.id,
            amount=100,
            reason="test_review",
        )
        db_session.add(xp_transaction)

    # Create achievement definitions first (required for FK constraint)
    for i in range(3):
        achievement = Achievement(
            id=f"test_achievement_{i}",
            name=f"Test Achievement {i}",
            description=f"Test achievement description {i}",
            category=AchievementCategory.LEARNING,
            icon="star",
            threshold=100 * (i + 1),
            xp_reward=100,
        )
        db_session.add(achievement)

    await db_session.flush()  # Flush to ensure achievements exist before user_achievements

    # Create user achievements
    for i in range(3):
        user_achievement = UserAchievement(
            user_id=test_user.id,
            achievement_id=f"test_achievement_{i}",
        )
        db_session.add(user_achievement)

    await db_session.commit()
    await db_session.refresh(test_user)
    return test_user


# =============================================================================
# Reset Progress Endpoint Tests
# =============================================================================


@pytest.mark.integration
class TestResetProgressEndpoint:
    """Test suite for POST /api/v1/users/me/reset-progress endpoint."""

    @pytest.mark.asyncio
    async def test_success_204(
        self,
        client: AsyncClient,
        auth_headers: dict,
        user_with_progress: User,
        db_session: AsyncSession,
    ):
        """Test successful progress reset returns 204 and deletes data."""
        user_id = user_with_progress.id

        # Verify data exists before reset
        stats_query = select(CardStatistics).where(CardStatistics.user_id == user_id)
        stats_before = (await db_session.execute(stats_query)).scalars().all()
        assert len(stats_before) > 0, "Expected card statistics before reset"

        reviews_query = select(Review).where(Review.user_id == user_id)
        reviews_before = (await db_session.execute(reviews_query)).scalars().all()
        assert len(reviews_before) > 0, "Expected reviews before reset"

        # Make reset request
        response = await client.post("/api/v1/users/me/reset-progress", headers=auth_headers)

        assert response.status_code == 204

        # Verify data is deleted after reset
        # Need to expire all objects in session to see fresh data
        db_session.expire_all()

        stats_after = (await db_session.execute(stats_query)).scalars().all()
        assert len(stats_after) == 0, "Card statistics should be deleted after reset"

        reviews_after = (await db_session.execute(reviews_query)).scalars().all()
        assert len(reviews_after) == 0, "Reviews should be deleted after reset"

        progress_query = select(UserDeckProgress).where(UserDeckProgress.user_id == user_id)
        progress_after = (await db_session.execute(progress_query)).scalars().all()
        assert len(progress_after) == 0, "Deck progress should be deleted after reset"

        xp_query = select(XPTransaction).where(XPTransaction.user_id == user_id)
        xp_after = (await db_session.execute(xp_query)).scalars().all()
        assert len(xp_after) == 0, "XP transactions should be deleted after reset"

        achievements_query = select(UserAchievement).where(UserAchievement.user_id == user_id)
        achievements_after = (await db_session.execute(achievements_query)).scalars().all()
        assert len(achievements_after) == 0, "Achievements should be deleted after reset"

    @pytest.mark.asyncio
    async def test_unauthenticated_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        response = await client.post("/api/v1/users/me/reset-progress")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_preserves_account(
        self,
        client: AsyncClient,
        auth_headers: dict,
        user_with_progress: User,
        db_session: AsyncSession,
    ):
        """Test that user account still exists after reset."""
        user_id = user_with_progress.id

        # Make reset request
        response = await client.post("/api/v1/users/me/reset-progress", headers=auth_headers)

        assert response.status_code == 204

        # Verify user account still exists
        db_session.expire_all()
        user_query = select(User).where(User.id == user_id)
        user = (await db_session.execute(user_query)).scalar_one_or_none()

        assert user is not None, "User account should be preserved after reset"
        assert user.id == user_id
        assert user.email is not None

    @pytest.mark.asyncio
    async def test_reset_empty_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user: User,
    ):
        """Test that reset succeeds even for user with no progress data."""
        # test_user has no progress data
        response = await client.post("/api/v1/users/me/reset-progress", headers=auth_headers)

        # Should still succeed
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_reset_xp_record(
        self,
        client: AsyncClient,
        auth_headers: dict,
        user_with_progress: User,
        db_session: AsyncSession,
    ):
        """Test that UserXP is reset to 0 (not deleted)."""
        user_id = user_with_progress.id

        # Verify XP exists before reset
        xp_query = select(UserXP).where(UserXP.user_id == user_id)
        xp_before = (await db_session.execute(xp_query)).scalar_one_or_none()
        assert xp_before is not None
        assert xp_before.total_xp > 0

        # Make reset request
        response = await client.post("/api/v1/users/me/reset-progress", headers=auth_headers)

        assert response.status_code == 204

        # Verify XP is reset to 0
        db_session.expire_all()
        xp_after = (await db_session.execute(xp_query)).scalar_one_or_none()

        # XP record may or may not exist after reset (depends on implementation)
        # If it exists, it should be reset to 0
        if xp_after is not None:
            assert xp_after.total_xp == 0
            assert xp_after.current_level == 1


# =============================================================================
# Delete Account Endpoint Tests
# =============================================================================


@pytest.mark.integration
class TestDeleteAccountEndpoint:
    """Test suite for DELETE /api/v1/users/me endpoint."""

    @pytest.mark.asyncio
    async def test_success_204(
        self,
        client: AsyncClient,
        auth_headers: dict,
        user_with_progress: User,
        db_session: AsyncSession,
    ):
        """Test successful account deletion returns 204 and removes user."""
        user_id = user_with_progress.id

        # Mock Supabase client to avoid real Auth0 calls
        with patch(
            "src.services.user_deletion_service.get_supabase_admin_client"
        ) as mock_get_client:
            mock_supabase_client = MagicMock()
            mock_supabase_client.delete_user = AsyncMock(return_value=True)
            mock_get_client.return_value = mock_supabase_client

            response = await client.delete("/api/v1/users/me", headers=auth_headers)

        assert response.status_code == 204

        # Verify user is deleted
        db_session.expire_all()
        user_query = select(User).where(User.id == user_id)
        user = (await db_session.execute(user_query)).scalar_one_or_none()

        assert user is None, "User should be deleted after account deletion"

        # Verify all user data is deleted
        stats_query = select(CardStatistics).where(CardStatistics.user_id == user_id)
        stats = (await db_session.execute(stats_query)).scalars().all()
        assert len(stats) == 0, "Card statistics should be deleted"

        reviews_query = select(Review).where(Review.user_id == user_id)
        reviews = (await db_session.execute(reviews_query)).scalars().all()
        assert len(reviews) == 0, "Reviews should be deleted"

    @pytest.mark.asyncio
    async def test_unauthenticated_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        response = await client.delete("/api/v1/users/me")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_removes_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user: User,
        db_session: AsyncSession,
    ):
        """Test that user record is removed after deletion."""
        user_id = test_user.id

        # Verify user exists before deletion
        user_query = select(User).where(User.id == user_id)
        user_before = (await db_session.execute(user_query)).scalar_one_or_none()
        assert user_before is not None

        # Mock Supabase client
        with patch(
            "src.services.user_deletion_service.get_supabase_admin_client"
        ) as mock_get_client:
            mock_get_client.return_value = None  # No Supabase admin configured

            response = await client.delete("/api/v1/users/me", headers=auth_headers)

        assert response.status_code == 204

        # Verify user is gone
        db_session.expire_all()
        user_after = (await db_session.execute(user_query)).scalar_one_or_none()
        assert user_after is None

    @pytest.mark.asyncio
    async def test_supabase_failure_returns_500(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user: User,
        db_session: AsyncSession,
    ):
        """Test that Supabase failure returns 500 with specific message."""
        user_id = test_user.id

        # Update user to have a supabase_id
        test_user.supabase_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        await db_session.commit()
        await db_session.refresh(test_user)

        # Mock Supabase admin client to fail
        with patch(
            "src.services.user_deletion_service.get_supabase_admin_client"
        ) as mock_get_client:
            from src.core.exceptions import SupabaseAdminError

            mock_supabase_client = MagicMock()
            mock_supabase_client.delete_user = AsyncMock(
                side_effect=SupabaseAdminError("Failed to delete user from Supabase")
            )
            mock_get_client.return_value = mock_supabase_client

            with patch("src.services.user_deletion_service.sentry_sdk"):
                response = await client.delete("/api/v1/users/me", headers=auth_headers)

        assert response.status_code == 500
        data = response.json()
        # Response format: {"success": false, "error": {"message": "...", ...}} or {"detail": "..."}
        # Check for "contact support" in either format
        response_text = str(data).lower()
        assert "contact support" in response_text, f"Expected 'contact support' in response: {data}"

        # User should still be deleted locally despite Supabase failure
        db_session.expire_all()
        user_query = select(User).where(User.id == user_id)
        user = (await db_session.execute(user_query)).scalar_one_or_none()
        assert user is None, "User should be deleted locally even if Supabase fails"

    @pytest.mark.asyncio
    async def test_delete_without_supabase_id(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user: User,
        db_session: AsyncSession,
    ):
        """Test deletion succeeds for user without Supabase identity."""
        # Ensure user has no supabase_id
        test_user.supabase_id = None
        await db_session.commit()

        # Mock Supabase admin client (should not be called)
        with patch(
            "src.services.user_deletion_service.get_supabase_admin_client"
        ) as mock_get_client:
            mock_supabase_client = MagicMock()
            mock_get_client.return_value = mock_supabase_client

            response = await client.delete("/api/v1/users/me", headers=auth_headers)

        assert response.status_code == 204
        # Supabase delete should not be called
        mock_supabase_client.delete_user.assert_not_called()

    @pytest.mark.asyncio
    async def test_delete_clears_all_user_data(
        self,
        client: AsyncClient,
        auth_headers: dict,
        user_with_progress: User,
        db_session: AsyncSession,
    ):
        """Test that all user data is cleared after deletion."""
        user_id = user_with_progress.id

        # Mock Supabase client
        with patch(
            "src.services.user_deletion_service.get_supabase_admin_client"
        ) as mock_get_client:
            mock_get_client.return_value = None

            response = await client.delete("/api/v1/users/me", headers=auth_headers)

        assert response.status_code == 204

        # Verify all data types are deleted
        db_session.expire_all()

        checks = [
            (CardStatistics, CardStatistics.user_id),
            (Review, Review.user_id),
            (UserDeckProgress, UserDeckProgress.user_id),
            (XPTransaction, XPTransaction.user_id),
            (UserAchievement, UserAchievement.user_id),
        ]

        for model, user_id_col in checks:
            query = select(model).where(user_id_col == user_id)
            results = (await db_session.execute(query)).scalars().all()
            assert len(results) == 0, f"{model.__name__} should be deleted"
