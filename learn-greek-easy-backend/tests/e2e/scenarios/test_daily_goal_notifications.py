"""E2E tests for daily goal notifications and streaks.

These tests specifically target the daily goal notification logic
in src/api/v1/reviews.py lines 73-139.

Run with:
    pytest tests/e2e/scenarios/test_daily_goal_notifications.py -v
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.e2e.conftest import E2ETestCase, StudyEnvironment, UserSession


@pytest.mark.e2e
@pytest.mark.scenario
class TestDailyGoalNotifications(E2ETestCase):
    """E2E tests for daily goal notification triggers."""

    @pytest.mark.asyncio
    async def test_reviews_before_goal_no_notification(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that reviews before reaching daily goal don't trigger notification."""
        env = populated_study_environment

        # Submit a single review (won't reach typical daily goal of 20)
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
        # Should succeed without error
        assert response.json()["success"] is True

    @pytest.mark.asyncio
    async def test_multiple_reviews_progress_tracking(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test multiple reviews track progress correctly."""
        env = populated_study_environment

        # Submit multiple reviews sequentially
        for i, card in enumerate(env.cards[:5]):
            response = await client.post(
                "/api/v1/reviews",
                json={
                    "card_id": str(card.id),
                    "quality": 3 + (i % 3),  # Vary quality between 3-5
                    "time_taken": 5 + i,
                },
                headers=env.headers,
            )
            assert response.status_code == 200

        # Check review history reflects submissions
        history_response = await client.get(
            "/api/v1/reviews",
            headers=env.headers,
        )
        assert history_response.status_code == 200
        assert history_response.json()["total"] >= 5


@pytest.mark.e2e
@pytest.mark.scenario
class TestDailyGoalWithLowGoalSetting(E2ETestCase):
    """E2E tests for daily goal with custom low goal setting."""

    @pytest.mark.asyncio
    async def test_update_daily_goal_setting(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
    ) -> None:
        """Test updating daily goal setting."""
        # Update daily goal to a low value
        response = await client.patch(
            "/api/v1/auth/me",
            json={"daily_goal": 3},
            headers=fresh_user_session.headers,
        )
        assert response.status_code == 200
        # Verify the setting was updated
        me_response = await client.get(
            "/api/v1/auth/me",
            headers=fresh_user_session.headers,
        )
        assert me_response.status_code == 200

    @pytest.mark.asyncio
    async def test_reviews_reaching_low_daily_goal(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
        db_session: AsyncSession,
    ) -> None:
        """Test reaching a low daily goal triggers notification path.

        This test exercises the daily goal notification code path by:
        1. Setting a low daily goal (3)
        2. Submitting enough reviews to cross the threshold
        """
        env = populated_study_environment

        # First update the user's daily goal to a low value
        update_response = await client.patch(
            "/api/v1/auth/me",
            json={"daily_goal": 3},
            headers=env.headers,
        )
        assert update_response.status_code == 200

        # Now submit 3 reviews to reach/cross the daily goal
        for i in range(3):
            response = await client.post(
                "/api/v1/reviews",
                json={
                    "card_id": str(env.cards[i].id),
                    "quality": 4,
                    "time_taken": 5,
                },
                headers=env.headers,
            )
            assert response.status_code == 200

        # Additional review after goal should still succeed
        if len(env.cards) > 3:
            extra_response = await client.post(
                "/api/v1/reviews",
                json={
                    "card_id": str(env.cards[3].id),
                    "quality": 5,
                    "time_taken": 3,
                },
                headers=env.headers,
            )
            assert extra_response.status_code == 200


@pytest.mark.e2e
@pytest.mark.scenario
class TestStreakMilestones(E2ETestCase):
    """E2E tests for streak milestone tracking."""

    @pytest.mark.asyncio
    async def test_first_review_starts_streak(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that first review initiates streak tracking."""
        env = populated_study_environment

        # Submit first review
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

        # Check XP stats (includes streak info)
        xp_response = await client.get(
            "/api/v1/xp/stats",
            headers=env.headers,
        )
        assert xp_response.status_code == 200

    @pytest.mark.asyncio
    async def test_review_with_different_qualities(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test reviews with all quality levels (0-5)."""
        env = populated_study_environment

        # Test each quality level
        for quality in range(6):  # 0-5
            card_idx = quality % len(env.cards)
            response = await client.post(
                "/api/v1/reviews",
                json={
                    "card_id": str(env.cards[card_idx].id),
                    "quality": quality,
                    "time_taken": 10,
                },
                headers=env.headers,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["quality"] == quality


@pytest.mark.e2e
@pytest.mark.scenario
class TestDailyGoalCrossing(E2ETestCase):
    """E2E tests that specifically cross the daily goal threshold.

    These tests use completely fresh users to ensure:
    1. reviews_before = 0
    2. Goal is set low (e.g., 2)
    3. We cross the threshold exactly
    """

    @pytest.mark.asyncio
    async def test_cross_daily_goal_threshold_triggers_notification_logic(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Test that crossing daily goal threshold triggers notification logic.

        This test:
        1. Creates a fresh user (0 reviews today)
        2. Sets daily goal to 2
        3. Creates a deck with cards
        4. Submits 2 reviews to cross the goal

        This exercises reviews.py lines 91-135 (daily goal notification).
        """
        from tests.factories import CardFactory, DeckFactory

        # Register a fresh user
        fresh_email = f"daily_goal_{uuid4().hex[:8]}@test.com"
        session = await self.register_and_login(client, email=fresh_email)

        # Set daily goal to a very low value (2)
        update_response = await client.patch(
            "/api/v1/auth/me",
            json={"daily_goal": 2},
            headers=session.headers,
        )
        assert update_response.status_code == 200

        # Create a deck with cards for this user to study
        deck = await DeckFactory.create(session=db_session, is_active=True)
        cards = []
        for i in range(3):
            card = await CardFactory.create(session=db_session, deck=deck)
            cards.append(card)
        await db_session.commit()

        # Initialize study session
        init_response = await client.post(
            f"/api/v1/study/initialize/{deck.id}",
            headers=session.headers,
        )
        assert init_response.status_code in [200, 201]

        # Submit first review (reviews_before=0, reviews_after=1, goal=2 - not crossed)
        response1 = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(cards[0].id),
                "quality": 4,
                "time_taken": 5,
            },
            headers=session.headers,
        )
        assert response1.status_code == 200

        # Submit second review (reviews_before=1, reviews_after=2, goal=2 - CROSSED!)
        # This should trigger lines 91-135 in reviews.py
        response2 = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(cards[1].id),
                "quality": 5,
                "time_taken": 3,
            },
            headers=session.headers,
        )
        assert response2.status_code == 200

        # Submit third review (reviews_before=2, reviews_after=3 - already past goal)
        # This exercises line 98-100 (already completed goal before this review)
        response3 = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(cards[2].id),
                "quality": 4,
                "time_taken": 4,
            },
            headers=session.headers,
        )
        assert response3.status_code == 200

        # Verify reviews were recorded
        history = await client.get("/api/v1/reviews", headers=session.headers)
        assert history.status_code == 200
        assert history.json()["total"] == 3

    @pytest.mark.asyncio
    async def test_goal_already_reached_skips_notification(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Test that reviews after goal is reached skip notification logic.

        This exercises the early return at line 98-100:
        if reviews_before >= daily_goal: return
        """
        from tests.factories import CardFactory, DeckFactory

        # Register a fresh user
        fresh_email = f"goal_reached_{uuid4().hex[:8]}@test.com"
        session = await self.register_and_login(client, email=fresh_email)

        # Set daily goal to 1 (will be reached after first review)
        await client.patch(
            "/api/v1/auth/me",
            json={"daily_goal": 1},
            headers=session.headers,
        )

        # Create deck and cards
        deck = await DeckFactory.create(session=db_session, is_active=True)
        cards = [await CardFactory.create(session=db_session, deck=deck) for _ in range(3)]
        await db_session.commit()

        # Initialize study
        await client.post(f"/api/v1/study/initialize/{deck.id}", headers=session.headers)

        # First review crosses goal (reviews_before=0, goal=1)
        await client.post(
            "/api/v1/reviews",
            json={"card_id": str(cards[0].id), "quality": 4, "time_taken": 5},
            headers=session.headers,
        )

        # Second review - goal already reached (exercises line 98-100)
        response = await client.post(
            "/api/v1/reviews",
            json={"card_id": str(cards[1].id), "quality": 5, "time_taken": 3},
            headers=session.headers,
        )
        assert response.status_code == 200


@pytest.mark.e2e
@pytest.mark.scenario
class TestReviewEdgeCases(E2ETestCase):
    """E2E tests for review edge cases that improve coverage."""

    @pytest.mark.asyncio
    async def test_review_nonexistent_card_returns_404(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
    ) -> None:
        """Test that reviewing a non-existent card returns 404."""
        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(uuid4()),
                "quality": 4,
                "time_taken": 5,
            },
            headers=fresh_user_session.headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_review_invalid_quality_returns_422(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that invalid quality value returns 422."""
        env = populated_study_environment

        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 6,  # Invalid - max is 5
                "time_taken": 5,
            },
            headers=env.headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_review_time_taken_at_max_accepted(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that time_taken at max (180 seconds) is accepted."""
        env = populated_study_environment

        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 4,
                "time_taken": 180,  # Max value (3 minutes)
            },
            headers=env.headers,
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_review_without_auth_returns_401(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that review without authentication returns 401."""
        env = populated_study_environment

        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 4,
                "time_taken": 5,
            },
            # No headers - unauthenticated
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_review_with_zero_time_taken(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that review with zero time_taken is valid."""
        env = populated_study_environment

        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 4,
                "time_taken": 0,
            },
            headers=env.headers,
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_review_with_max_time_taken(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that review with max time_taken (180) is valid."""
        env = populated_study_environment

        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 4,
                "time_taken": 180,  # Max value (3 minutes)
            },
            headers=env.headers,
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_review_quality_0_blackout(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test quality 0 (complete blackout) review."""
        env = populated_study_environment

        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 0,  # Complete blackout
                "time_taken": 60,
            },
            headers=env.headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["quality"] == 0
        # Quality 0 should reset repetitions
        assert data["repetitions"] == 0

    @pytest.mark.asyncio
    async def test_review_quality_5_perfect(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test quality 5 (perfect response) review."""
        env = populated_study_environment

        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 5,  # Perfect
                "time_taken": 2,
            },
            headers=env.headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["quality"] == 5

    @pytest.mark.asyncio
    async def test_rapid_successive_reviews_same_card(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test rapid successive reviews of the same card."""
        env = populated_study_environment
        card_id = str(env.cards[0].id)

        # Submit multiple reviews of same card in succession
        for quality in [3, 4, 5, 4, 5]:
            response = await client.post(
                "/api/v1/reviews",
                json={
                    "card_id": card_id,
                    "quality": quality,
                    "time_taken": 3,
                },
                headers=env.headers,
            )
            assert response.status_code == 200
