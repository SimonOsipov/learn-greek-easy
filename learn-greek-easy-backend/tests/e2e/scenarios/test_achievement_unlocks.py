"""E2E tests for achievement unlock workflows.

This module tests the complete achievement system, validating:
- Achievement progress updates after user activity
- Streak-based achievements (3-day, 7-day)
- Mastery achievements (mastered_10, etc.)
- Achievement persistence across sessions
- Points calculation and non-duplication

Test markers applied automatically:
- @pytest.mark.e2e
- @pytest.mark.scenario
"""

from uuid import UUID, uuid4

import pytest
from freezegun import freeze_time
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardStatus, User
from tests.e2e.conftest import E2ETestCase
from tests.factories import CardFactory, CardStatisticsFactory, DeckFactory, UserDeckProgressFactory


def find_achievement(achievements: list[dict], achievement_id: str) -> dict | None:
    """Helper to find achievement by ID in API response."""
    return next((a for a in achievements if a["id"] == achievement_id), None)


@pytest.mark.e2e
@pytest.mark.scenario
class TestFirstReviewAchievement(E2ETestCase):
    """Test achievement progress after first review activity."""

    @pytest.mark.asyncio
    async def test_first_review_updates_achievement_progress(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """First review updates reviews_100 achievement progress.

        Flow:
        1. Register new user
        2. Check initial achievements (all 0%)
        3. Submit one review
        4. Verify reviews_100 progress = 1.0 (1/100)
        """
        # Setup deck with cards
        deck = await DeckFactory.create(session=db_session)
        await CardFactory.create_batch(session=db_session, size=5, deck_id=deck.id)

        # Register new user
        session = await self.register_and_login(client)

        # Check initial state - all achievements at 0
        initial = await client.get("/api/v1/progress/achievements", headers=session.headers)
        assert initial.status_code == 200
        reviews_100 = find_achievement(initial.json()["achievements"], "reviews_100")
        assert reviews_100["progress"] == 0.0
        assert initial.json()["total_points"] == 0

        # Initialize study and submit one review
        await client.post(f"/api/v1/study/initialize/{deck.id}", headers=session.headers)
        queue = await client.get(
            f"/api/v1/study/queue/{deck.id}?include_new=true", headers=session.headers
        )
        card_id = queue.json()["cards"][0]["card_id"]
        await client.post(
            "/api/v1/reviews",
            json={"card_id": card_id, "quality": 4, "time_taken": 5},  # seconds
            headers=session.headers,
        )

        # Verify progress updated
        after = await client.get("/api/v1/progress/achievements", headers=session.headers)
        assert after.status_code == 200
        reviews_100_after = find_achievement(after.json()["achievements"], "reviews_100")
        assert reviews_100_after["progress"] == 1.0  # 1/100 * 100

    @pytest.mark.asyncio
    async def test_study_time_achievement_progress(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Study time achievement tracks time_taken from reviews.

        Submits reviews with time_taken values and verifies
        time_1hr (3600 seconds) achievement progress updates.
        """
        deck = await DeckFactory.create(session=db_session)
        await CardFactory.create_batch(session=db_session, size=5, deck_id=deck.id)

        session = await self.register_and_login(client)
        await client.post(f"/api/v1/study/initialize/{deck.id}", headers=session.headers)

        # Submit review with 60 seconds (60000ms) study time
        queue = await client.get(
            f"/api/v1/study/queue/{deck.id}?include_new=true", headers=session.headers
        )
        card_id = queue.json()["cards"][0]["card_id"]
        await client.post(
            "/api/v1/reviews",
            json={"card_id": card_id, "quality": 4, "time_taken": 60},  # 60 seconds
            headers=session.headers,
        )

        # Check time_1hr achievement progress (60/3600 * 100 ≈ 1.67%)
        achievements = await client.get("/api/v1/progress/achievements", headers=session.headers)
        time_1hr = find_achievement(achievements.json()["achievements"], "time_1hr")
        # Progress should be > 0 (time_taken is in ms, so 60000ms = 60s)
        assert time_1hr["progress"] > 0


@pytest.mark.e2e
@pytest.mark.scenario
class TestStreakAchievements(E2ETestCase):
    """Test streak-based achievement unlocks using time simulation."""

    @pytest.mark.asyncio
    async def test_streak_achievement_3_day(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """3-day streak achievement unlocks after studying 3 consecutive days.

        Uses freeze_time to simulate reviews on consecutive days.
        """
        # Setup
        deck = await DeckFactory.create(session=db_session)
        await CardFactory.create_batch(session=db_session, size=10, deck_id=deck.id)

        session = await self.register_and_login(client)
        await client.post(f"/api/v1/study/initialize/{deck.id}", headers=session.headers)
        queue = await client.get(
            f"/api/v1/study/queue/{deck.id}?include_new=true", headers=session.headers
        )
        card_ids = [c["card_id"] for c in queue.json()["cards"]]

        # Submit reviews on 3 consecutive days
        for day in range(3):
            with freeze_time(f"2024-01-{day + 1:02d} 10:00:00"):
                await client.post(
                    "/api/v1/reviews",
                    json={
                        "card_id": card_ids[day],
                        "quality": 4,
                        "time_taken": 3,  # seconds
                    },
                    headers=session.headers,
                )

        # Verify streak_3 achievement on day 3
        with freeze_time("2024-01-03 11:00:00"):
            achievements = await client.get(
                "/api/v1/progress/achievements", headers=session.headers
            )
            streak_3 = find_achievement(achievements.json()["achievements"], "streak_3")
            assert streak_3["unlocked"] is True
            assert streak_3["points"] == 25

    @pytest.mark.asyncio
    async def test_streak_achievement_7_day(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """7-day streak achievement unlocks after 7 consecutive days."""
        # Setup
        deck = await DeckFactory.create(session=db_session)
        await CardFactory.create_batch(session=db_session, size=10, deck_id=deck.id)

        session = await self.register_and_login(client)
        await client.post(f"/api/v1/study/initialize/{deck.id}", headers=session.headers)
        queue = await client.get(
            f"/api/v1/study/queue/{deck.id}?include_new=true", headers=session.headers
        )
        card_ids = [c["card_id"] for c in queue.json()["cards"]]

        # Submit reviews on 7 consecutive days
        for day in range(7):
            with freeze_time(f"2024-01-{day + 1:02d} 10:00:00"):
                await client.post(
                    "/api/v1/reviews",
                    json={
                        "card_id": card_ids[day % len(card_ids)],
                        "quality": 4,
                        "time_taken": 3,  # seconds
                    },
                    headers=session.headers,
                )

        # Verify both streak achievements
        with freeze_time("2024-01-07 11:00:00"):
            achievements = await client.get(
                "/api/v1/progress/achievements", headers=session.headers
            )
            streak_7 = find_achievement(achievements.json()["achievements"], "streak_7")
            streak_3 = find_achievement(achievements.json()["achievements"], "streak_3")

            assert streak_7["unlocked"] is True
            assert streak_7["points"] == 50
            assert streak_3["unlocked"] is True  # Also unlocked


@pytest.mark.e2e
@pytest.mark.scenario
class TestMasteryAchievements(E2ETestCase):
    """Test card mastery achievement unlocks."""

    @pytest.mark.asyncio
    async def test_deck_mastery_achievement(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
    ) -> None:
        """mastered_10 achievement unlocks when 10 cards are mastered.

        Sets up 10 mastered cards via database and verifies achievement.
        """
        deck = await DeckFactory.create(session=db_session)

        # Create 10 mastered cards
        for _ in range(10):
            card = await CardFactory.create(session=db_session, deck_id=deck.id)
            await CardStatisticsFactory.create(
                session=db_session,
                user_id=test_user.id,
                card_id=card.id,
                status=CardStatus.MASTERED,
                interval=21,
                repetitions=5,
                easiness_factor=2.7,
            )

        # Create progress record
        await UserDeckProgressFactory.create(
            session=db_session,
            user_id=test_user.id,
            deck_id=deck.id,
            cards_studied=10,
            cards_mastered=10,
        )
        await db_session.commit()

        # Verify mastered_10 achievement
        achievements = await client.get("/api/v1/progress/achievements", headers=auth_headers)
        assert achievements.status_code == 200
        mastered_10 = find_achievement(achievements.json()["achievements"], "mastered_10")
        assert mastered_10["unlocked"] is True
        assert mastered_10["points"] == 20

    @pytest.mark.asyncio
    async def test_decks_achievement_with_multiple_decks(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
    ) -> None:
        """decks_3 achievement unlocks when user studies 3 different decks."""
        # Create 3 decks with progress
        for i in range(3):
            deck = await DeckFactory.create(
                session=db_session, name=f"Achievement Test Deck {i + 1}"
            )
            await UserDeckProgressFactory.create(
                session=db_session,
                user_id=test_user.id,
                deck_id=deck.id,
                cards_studied=5,
            )
        await db_session.commit()

        # Verify decks_3 achievement
        achievements = await client.get("/api/v1/progress/achievements", headers=auth_headers)
        decks_3 = find_achievement(achievements.json()["achievements"], "decks_3")
        assert decks_3["unlocked"] is True
        assert decks_3["points"] == 30


@pytest.mark.e2e
@pytest.mark.scenario
class TestAchievementPersistence(E2ETestCase):
    """Test achievement state persistence."""

    @pytest.mark.asyncio
    async def test_achievement_persistence_across_sessions(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Unlocked achievements persist after re-login.

        Creates mastered cards, verifies achievement, logs out and back in,
        and confirms achievement still shows as unlocked.
        """
        deck = await DeckFactory.create(session=db_session)
        email = f"persist_{uuid4().hex[:8]}@example.com"
        password = "SecurePass123!"

        # Register user
        reg = await client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": password, "full_name": "Test User"},
        )
        assert reg.status_code == 201

        # Get user profile to get user ID
        auth_headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
        me = await client.get("/api/v1/auth/me", headers=auth_headers)
        user_id = UUID(me.json()["id"])

        # Create 10 mastered cards
        for _ in range(10):
            card = await CardFactory.create(session=db_session, deck_id=deck.id)
            await CardStatisticsFactory.create(
                session=db_session,
                user_id=user_id,
                card_id=card.id,
                status=CardStatus.MASTERED,
                interval=21,
            )
        await UserDeckProgressFactory.create(
            session=db_session,
            user_id=user_id,
            deck_id=deck.id,
            cards_mastered=10,
        )
        await db_session.commit()

        # Session 1: Verify achievement unlocked
        ach1 = await client.get("/api/v1/progress/achievements", headers=auth_headers)
        assert find_achievement(ach1.json()["achievements"], "mastered_10")["unlocked"] is True

        # Session 2: Login again and verify persistence
        login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
        new_auth = {"Authorization": f"Bearer {login.json()['access_token']}"}
        ach2 = await client.get("/api/v1/progress/achievements", headers=new_auth)
        assert find_achievement(ach2.json()["achievements"], "mastered_10")["unlocked"] is True

    @pytest.mark.asyncio
    async def test_achievement_not_duplicated(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
    ) -> None:
        """Same achievement doesn't award duplicate points.

        With 15 mastered cards (exceeding 10 threshold), points should
        still be 20 (not 40 for double counting).
        """
        deck = await DeckFactory.create(session=db_session)

        # Create 15 mastered cards (exceeds mastered_10 threshold of 10)
        for _ in range(15):
            card = await CardFactory.create(session=db_session, deck_id=deck.id)
            await CardStatisticsFactory.create(
                session=db_session,
                user_id=test_user.id,
                card_id=card.id,
                status=CardStatus.MASTERED,
                interval=21,
            )
        await UserDeckProgressFactory.create(
            session=db_session,
            user_id=test_user.id,
            deck_id=deck.id,
            cards_mastered=15,
        )
        await db_session.commit()

        # Verify points calculation
        achievements = await client.get("/api/v1/progress/achievements", headers=auth_headers)
        data = achievements.json()
        mastered_10 = find_achievement(data["achievements"], "mastered_10")
        mastered_50 = find_achievement(data["achievements"], "mastered_50")

        assert mastered_10["points"] == 20  # Not 40
        assert mastered_50["unlocked"] is False
        assert mastered_50["progress"] == 30.0  # 15/50 * 100


@pytest.mark.e2e
@pytest.mark.scenario
class TestAchievementEdgeCases(E2ETestCase):
    """Test edge cases in achievement calculation."""

    @pytest.mark.asyncio
    async def test_streak_gap_resets_calculation(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Gap in streak resets longest streak calculation.

        Reviews on days 1, 2, 4 (skipping 3) results in longest_streak=2.
        """
        deck = await DeckFactory.create(session=db_session)
        await CardFactory.create_batch(session=db_session, size=5, deck_id=deck.id)

        session = await self.register_and_login(client)
        await client.post(f"/api/v1/study/initialize/{deck.id}", headers=session.headers)
        queue = await client.get(
            f"/api/v1/study/queue/{deck.id}?include_new=true", headers=session.headers
        )
        card_ids = [c["card_id"] for c in queue.json()["cards"]]

        # Day 1
        with freeze_time("2024-01-01 10:00:00"):
            await client.post(
                "/api/v1/reviews",
                json={"card_id": card_ids[0], "quality": 4, "time_taken": 3},
                headers=session.headers,
            )

        # Day 2
        with freeze_time("2024-01-02 10:00:00"):
            await client.post(
                "/api/v1/reviews",
                json={"card_id": card_ids[1], "quality": 4, "time_taken": 3},
                headers=session.headers,
            )

        # Skip day 3

        # Day 4
        with freeze_time("2024-01-04 10:00:00"):
            await client.post(
                "/api/v1/reviews",
                json={"card_id": card_ids[2], "quality": 4, "time_taken": 3},
                headers=session.headers,
            )

        # Verify streak_3 is NOT unlocked (longest streak is 2)
        with freeze_time("2024-01-04 11:00:00"):
            achievements = await client.get(
                "/api/v1/progress/achievements", headers=session.headers
            )
            streak_3 = find_achievement(achievements.json()["achievements"], "streak_3")
            assert streak_3["unlocked"] is False
            # Progress should be 66.7% (2/3 * 100)
            assert 60 <= streak_3["progress"] <= 70

    @pytest.mark.asyncio
    async def test_multiple_reviews_same_day_counts_once(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ) -> None:
        """Multiple reviews on same day count as 1 day for streak.

        Three reviews on the same day still equals a 1-day streak.
        """
        deck = await DeckFactory.create(session=db_session)
        await CardFactory.create_batch(session=db_session, size=5, deck_id=deck.id)

        session = await self.register_and_login(client)
        await client.post(f"/api/v1/study/initialize/{deck.id}", headers=session.headers)
        queue = await client.get(
            f"/api/v1/study/queue/{deck.id}?include_new=true", headers=session.headers
        )
        card_ids = [c["card_id"] for c in queue.json()["cards"]]

        # Submit 3 reviews on the same day
        with freeze_time("2024-01-01 10:00:00"):
            for i in range(3):
                await client.post(
                    "/api/v1/reviews",
                    json={"card_id": card_ids[i], "quality": 4, "time_taken": 3},
                    headers=session.headers,
                )

        # Verify streak is 1, not 3
        with freeze_time("2024-01-01 11:00:00"):
            achievements = await client.get(
                "/api/v1/progress/achievements", headers=session.headers
            )
            streak_3 = find_achievement(achievements.json()["achievements"], "streak_3")
            assert streak_3["unlocked"] is False
            # Progress should be 33.3% (1/3 * 100)
            assert 30 <= streak_3["progress"] <= 35

    @pytest.mark.asyncio
    async def test_exactly_at_threshold_unlocks(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
    ) -> None:
        """Achievement unlocks exactly at threshold (not above).

        Exactly 10 mastered cards should unlock mastered_10.
        """
        deck = await DeckFactory.create(session=db_session)

        # Create exactly 10 mastered cards
        for _ in range(10):
            card = await CardFactory.create(session=db_session, deck_id=deck.id)
            await CardStatisticsFactory.create(
                session=db_session,
                user_id=test_user.id,
                card_id=card.id,
                status=CardStatus.MASTERED,
                interval=21,
            )
        await UserDeckProgressFactory.create(
            session=db_session,
            user_id=test_user.id,
            deck_id=deck.id,
            cards_mastered=10,
        )
        await db_session.commit()

        achievements = await client.get("/api/v1/progress/achievements", headers=auth_headers)
        mastered_10 = find_achievement(achievements.json()["achievements"], "mastered_10")
        assert mastered_10["unlocked"] is True
        assert mastered_10["progress"] == 100.0

    @pytest.mark.asyncio
    async def test_just_below_threshold_not_unlocked(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
    ) -> None:
        """Achievement NOT unlocked when just below threshold.

        9 mastered cards should not unlock mastered_10.
        """
        deck = await DeckFactory.create(session=db_session)

        # Create only 9 mastered cards
        for _ in range(9):
            card = await CardFactory.create(session=db_session, deck_id=deck.id)
            await CardStatisticsFactory.create(
                session=db_session,
                user_id=test_user.id,
                card_id=card.id,
                status=CardStatus.MASTERED,
                interval=21,
            )
        await UserDeckProgressFactory.create(
            session=db_session,
            user_id=test_user.id,
            deck_id=deck.id,
            cards_mastered=9,
        )
        await db_session.commit()

        achievements = await client.get("/api/v1/progress/achievements", headers=auth_headers)
        mastered_10 = find_achievement(achievements.json()["achievements"], "mastered_10")
        assert mastered_10["unlocked"] is False
        assert mastered_10["progress"] == 90.0  # 9/10 * 100
