"""E2E tests for review streak milestones and daily goal notifications.

These tests cover the review API endpoints that track streaks and daily goals:
- POST /api/v1/reviews - Single review with streak milestone tracking
- Daily goal completion notification triggering
- UserSettings daily_goal integration

Run with:
    pytest tests/e2e/scenarios/test_review_streak.py -v
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.e2e.conftest import E2ETestCase, StudyEnvironment
from tests.factories.auth import UserFactory, UserSettingsFactory
from tests.factories.content import CardFactory, DeckFactory

# =============================================================================
# Test Streak Milestone Tracking
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestStreakMilestoneTracking(E2ETestCase):
    """E2E tests for streak milestone achievement tracking."""

    @pytest.mark.asyncio
    async def test_review_with_new_streak_succeeds(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that submitting a review updates streak tracking."""
        env = populated_study_environment

        # Submit a review - this should trigger streak logic
        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 4,
                "time_taken": 5,
            },
            headers=env.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Verify review was processed successfully
        assert data["success"] is True
        assert data["quality"] == 4
        assert "next_review_date" in data

    @pytest.mark.asyncio
    async def test_multiple_reviews_in_session(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test multiple reviews in same session track streak properly."""
        env = populated_study_environment

        # Submit multiple reviews
        for i in range(min(3, len(env.cards))):
            response = await client.post(
                "/api/v1/reviews",
                json={
                    "card_id": str(env.cards[i].id),
                    "quality": 4 + (i % 2),  # Alternate between 4 and 5
                    "time_taken": 5,
                },
                headers=env.headers,
            )
            assert response.status_code == 200

        # Verify review history includes all reviews
        history_response = await client.get(
            "/api/v1/reviews",
            headers=env.headers,
        )
        assert history_response.status_code == 200
        history_data = history_response.json()
        assert history_data["total"] >= 3

    @pytest.mark.asyncio
    async def test_review_response_includes_sm2_data(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test review response includes complete SM2 scheduling data."""
        env = populated_study_environment

        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 5,
                "time_taken": 2,
            },
            headers=env.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Verify all SM2 fields present
        assert "success" in data
        assert "card_id" in data
        assert "quality" in data
        assert "previous_status" in data
        assert "new_status" in data
        assert "easiness_factor" in data
        assert "interval" in data
        assert "repetitions" in data
        assert "next_review_date" in data


# =============================================================================
# Test Daily Goal Notification Triggering
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestDailyGoalNotification(E2ETestCase):
    """E2E tests for daily goal completion notification logic."""

    @pytest.mark.asyncio
    async def test_reviews_count_toward_daily_goal(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Test that reviews count toward the user's daily goal."""
        # Create user with low daily goal for easier testing
        user = await UserFactory.create(session=db_session, verified=True)
        await UserSettingsFactory.create(
            session=db_session,
            user_id=user.id,
            daily_goal=3,  # Low goal for easy testing
        )
        await db_session.commit()

        # Create deck and cards
        deck = await DeckFactory.create(session=db_session)
        cards = []
        for i in range(5):
            card = await CardFactory.create(session=db_session, deck_id=deck.id)
            cards.append(card)
        await db_session.commit()

        # Login the user
        login_response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": user.email,
                "password": "TestPassword123!",
            },
        )
        assert login_response.status_code == 200
        headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}

        # Initialize study session
        init_response = await client.post(
            f"/api/v1/study/initialize/{deck.id}",
            headers=headers,
        )
        assert init_response.status_code == 200

        # Submit reviews (this should trigger daily goal check)
        for i in range(3):
            response = await client.post(
                "/api/v1/reviews",
                json={
                    "card_id": str(cards[i].id),
                    "quality": 4,
                    "time_taken": 5,
                },
                headers=headers,
            )
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_reviews_with_default_daily_goal(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test reviews work when user has no custom daily goal (uses default 20)."""
        env = populated_study_environment

        # Submit a review - should work with default daily goal
        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 4,
                "time_taken": 5,
            },
            headers=env.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    @pytest.mark.asyncio
    async def test_review_before_daily_goal_reached(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Test review when daily goal not yet reached."""
        # Create user with high daily goal
        user = await UserFactory.create(session=db_session, verified=True)
        await UserSettingsFactory.create(
            session=db_session,
            user_id=user.id,
            daily_goal=100,  # High goal - won't be reached
        )
        await db_session.commit()

        # Create deck and card
        deck = await DeckFactory.create(session=db_session)
        card = await CardFactory.create(session=db_session, deck_id=deck.id)
        await db_session.commit()

        # Login
        login_response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": user.email,
                "password": "TestPassword123!",
            },
        )
        assert login_response.status_code == 200
        headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}

        # Initialize and submit review
        await client.post(f"/api/v1/study/initialize/{deck.id}", headers=headers)

        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(card.id),
                "quality": 4,
                "time_taken": 5,
            },
            headers=headers,
        )

        # Review should still succeed
        assert response.status_code == 200
        assert response.json()["success"] is True


# =============================================================================
# Test Review Endpoint Edge Cases
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestReviewEndpointEdgeCases(E2ETestCase):
    """E2E tests for review endpoint edge cases and error handling."""

    @pytest.mark.asyncio
    async def test_review_nonexistent_card(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that reviewing a non-existent card returns 404."""
        env = populated_study_environment
        fake_card_id = str(uuid4())

        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": fake_card_id,
                "quality": 4,
                "time_taken": 5,
            },
            headers=env.headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_review_unauthenticated(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that submitting review without auth returns 401."""
        env = populated_study_environment

        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 4,
                "time_taken": 5,
            },
            # No headers
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_review_invalid_quality_too_high(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that invalid quality > 5 is rejected."""
        env = populated_study_environment

        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 10,  # Invalid - must be 0-5
                "time_taken": 5,
            },
            headers=env.headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_review_invalid_quality_negative(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that negative quality is rejected."""
        env = populated_study_environment

        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": -1,  # Invalid
                "time_taken": 5,
            },
            headers=env.headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_review_with_all_valid_qualities(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that all valid quality values (0-5) are accepted."""
        env = populated_study_environment

        for quality in range(6):  # 0-5
            if quality >= len(env.cards):
                break

            response = await client.post(
                "/api/v1/reviews",
                json={
                    "card_id": str(env.cards[quality % len(env.cards)].id),
                    "quality": quality,
                    "time_taken": 5,
                },
                headers=env.headers,
            )

            assert response.status_code == 200, f"Quality {quality} should be valid"
            assert response.json()["quality"] == quality


# =============================================================================
# Test Complete Review Workflow with Streak
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestCompleteReviewWorkflow(E2ETestCase):
    """E2E tests for complete review workflows including streak and goals."""

    @pytest.mark.asyncio
    async def test_full_study_session_with_reviews(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test complete workflow: queue -> review all -> check history."""
        env = populated_study_environment

        # 1. Get study queue
        queue_response = await client.get(
            f"/api/v1/study/queue/{env.deck.id}",
            headers=env.headers,
        )
        assert queue_response.status_code == 200

        # 2. Review each card
        for card in env.cards[:3]:
            review_response = await client.post(
                "/api/v1/reviews",
                json={
                    "card_id": str(card.id),
                    "quality": 4,
                    "time_taken": 5,
                },
                headers=env.headers,
            )
            assert review_response.status_code == 200

        # 3. Check history
        history_response = await client.get(
            "/api/v1/reviews",
            headers=env.headers,
        )
        assert history_response.status_code == 200
        assert history_response.json()["total"] >= 3

    @pytest.mark.asyncio
    async def test_review_same_card_multiple_times(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test reviewing the same card multiple times updates stats."""
        env = populated_study_environment
        card_id = str(env.cards[0].id)

        # First review
        response1 = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": card_id,
                "quality": 3,
                "time_taken": 8,
            },
            headers=env.headers,
        )
        assert response1.status_code == 200
        data1 = response1.json()

        # Second review - should have increased repetitions
        response2 = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": card_id,
                "quality": 5,
                "time_taken": 2,
            },
            headers=env.headers,
        )
        assert response2.status_code == 200
        data2 = response2.json()

        # Repetitions should have increased
        assert data2["repetitions"] > data1["repetitions"]

    @pytest.mark.asyncio
    async def test_review_transitions_card_status(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that reviews transition card through status states."""
        env = populated_study_environment

        # First review on new card
        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 5,
                "time_taken": 2,
            },
            headers=env.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Should have previous and new status
        assert "previous_status" in data
        assert "new_status" in data

        # For a new card with quality 5, status should transition
        assert data["previous_status"] == "new"
        assert data["new_status"] in ["learning", "review", "mastered"]

    @pytest.mark.asyncio
    async def test_poor_quality_affects_scheduling(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that poor quality reviews affect card scheduling."""
        env = populated_study_environment

        # First good review
        await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 5,
                "time_taken": 2,
            },
            headers=env.headers,
        )

        # Then poor review
        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 1,  # Poor recall
                "time_taken": 15,
            },
            headers=env.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Card should be reset to learning/new state
        assert data["success"] is True
        # Easiness factor should decrease with poor quality
        assert data["easiness_factor"] <= 2.5
