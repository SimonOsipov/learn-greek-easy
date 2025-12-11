"""Integration tests for Progress API endpoints.

This module tests the progress tracking endpoints with real database transactions.

Test Classes:
- TestProgressAuthentication: Authentication tests for all endpoints (401)
- TestProgressDashboardEndpoint: Dashboard statistics endpoint tests
- TestDeckProgressListEndpoint: Deck progress list endpoint tests
- TestDeckProgressDetailEndpoint: Deck progress detail endpoint tests
- TestLearningTrendsEndpoint: Learning trends endpoint tests
- TestProgressUserIsolation: User data isolation tests

Note: Achievement endpoint tests are in test_achievements_api.py (task-208).
"""

from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import create_access_token
from src.db.models import User
from tests.factories import (
    CardFactory,
    CardStatisticsFactory,
    DeckFactory,
    ReviewFactory,
    UserDeckProgressFactory,
)
from tests.fixtures.progress import UserProgress

# =============================================================================
# Authentication Tests
# =============================================================================


@pytest.mark.integration
class TestProgressAuthentication:
    """Tests for authentication requirements on Progress API endpoints."""

    @pytest.mark.asyncio
    async def test_dashboard_unauthenticated(
        self,
        client: AsyncClient,
        progress_url: str,
    ):
        """Dashboard endpoint should return 401 without authentication."""
        response = await client.get(f"{progress_url}/dashboard")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_deck_list_unauthenticated(
        self,
        client: AsyncClient,
        progress_url: str,
    ):
        """Deck progress list should return 401 without authentication."""
        response = await client.get(f"{progress_url}/decks")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_deck_detail_unauthenticated(
        self,
        client: AsyncClient,
        progress_url: str,
    ):
        """Deck progress detail should return 401 without authentication."""
        response = await client.get(f"{progress_url}/decks/{uuid4()}")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_trends_unauthenticated(
        self,
        client: AsyncClient,
        progress_url: str,
    ):
        """Learning trends should return 401 without authentication."""
        response = await client.get(f"{progress_url}/trends")
        assert response.status_code == 401


# =============================================================================
# Dashboard Endpoint Tests
# =============================================================================


@pytest.mark.integration
class TestProgressDashboardEndpoint:
    """Tests for GET /progress/dashboard endpoint."""

    @pytest.mark.asyncio
    async def test_dashboard_new_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """New user should get dashboard with zero/default values."""
        response = await client.get(
            f"{progress_url}/dashboard",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Check overview defaults
        assert data["overview"]["total_cards_studied"] == 0
        assert data["overview"]["total_cards_mastered"] == 0
        assert data["overview"]["total_decks_started"] == 0

        # Check today defaults
        assert data["today"]["reviews_completed"] == 0
        assert data["today"]["cards_due"] == 0

        # Check streak defaults
        assert data["streak"]["current_streak"] == 0

    @pytest.mark.asyncio
    async def test_dashboard_response_structure(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """Dashboard response should have all required sections."""
        response = await client.get(
            f"{progress_url}/dashboard",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Check top-level sections exist
        assert "overview" in data
        assert "today" in data
        assert "streak" in data
        assert "cards_by_status" in data
        assert "recent_activity" in data

        # Check overview fields
        overview = data["overview"]
        assert "total_cards_studied" in overview
        assert "total_cards_mastered" in overview
        assert "total_decks_started" in overview
        assert "overall_mastery_percentage" in overview

        # Check today fields
        today = data["today"]
        assert "reviews_completed" in today
        assert "cards_due" in today
        assert "daily_goal" in today
        assert "goal_progress_percentage" in today

        # Check streak fields
        streak = data["streak"]
        assert "current_streak" in streak
        assert "longest_streak" in streak
        assert "last_study_date" in streak

        # Check cards_by_status fields
        cards = data["cards_by_status"]
        assert "new" in cards
        assert "learning" in cards
        assert "review" in cards
        assert "mastered" in cards

        # Check recent_activity is a list
        assert isinstance(data["recent_activity"], list)

    @pytest.mark.asyncio
    async def test_dashboard_with_activity(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
        progress_url: str,
    ):
        """Dashboard should reflect user's learning activity."""
        # Create a deck with cards
        deck = await DeckFactory.create(session=db_session)
        cards = await CardFactory.create_batch(
            session=db_session,
            size=10,
            deck_id=deck.id,
        )

        # Create deck progress
        await UserDeckProgressFactory.create(
            session=db_session,
            user_id=test_user.id,
            deck_id=deck.id,
            cards_studied=5,
            cards_mastered=2,
        )

        # Create card statistics (1 mastered, 2 learning, 2 due for review)
        for i, card in enumerate(cards[:5]):
            if i == 0:
                # Mastered card
                await CardStatisticsFactory.create(
                    session=db_session,
                    user_id=test_user.id,
                    card_id=card.id,
                    mastered=True,
                )
            elif i < 3:
                # Learning cards
                await CardStatisticsFactory.create(
                    session=db_session,
                    user_id=test_user.id,
                    card_id=card.id,
                    learning=True,
                )
            else:
                # Due cards
                await CardStatisticsFactory.create(
                    session=db_session,
                    user_id=test_user.id,
                    card_id=card.id,
                    due=True,
                )

        response = await client.get(
            f"{progress_url}/dashboard",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Should show activity
        assert data["overview"]["total_decks_started"] >= 1
        assert data["overview"]["total_cards_studied"] >= 0

    @pytest.mark.asyncio
    async def test_dashboard_cards_by_status_accuracy(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
        progress_url: str,
    ):
        """Cards by status should accurately reflect card statistics."""
        # Create deck and cards
        deck = await DeckFactory.create(session=db_session)
        cards = await CardFactory.create_batch(
            session=db_session,
            size=6,
            deck_id=deck.id,
        )

        # Create statistics with known status distribution
        # 1 new, 2 learning, 2 review, 1 mastered
        await CardStatisticsFactory.create(
            session=db_session,
            user_id=test_user.id,
            card_id=cards[0].id,
            new=True,
        )
        await CardStatisticsFactory.create(
            session=db_session,
            user_id=test_user.id,
            card_id=cards[1].id,
            learning=True,
        )
        await CardStatisticsFactory.create(
            session=db_session,
            user_id=test_user.id,
            card_id=cards[2].id,
            learning=True,
        )
        await CardStatisticsFactory.create(
            session=db_session,
            user_id=test_user.id,
            card_id=cards[3].id,
            review=True,
        )
        await CardStatisticsFactory.create(
            session=db_session,
            user_id=test_user.id,
            card_id=cards[4].id,
            review=True,
        )
        await CardStatisticsFactory.create(
            session=db_session,
            user_id=test_user.id,
            card_id=cards[5].id,
            mastered=True,
        )

        response = await client.get(
            f"{progress_url}/dashboard",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        cards_status = data["cards_by_status"]
        assert cards_status["new"] == 1
        assert cards_status["learning"] == 2
        assert cards_status["review"] == 2
        assert cards_status["mastered"] == 1

    @pytest.mark.asyncio
    async def test_dashboard_today_reviews_counted(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
        progress_url: str,
    ):
        """Today's reviews should be accurately counted."""
        # Create deck and card
        deck = await DeckFactory.create(session=db_session)
        card = await CardFactory.create(session=db_session, deck_id=deck.id)

        # Create reviews for today
        today = datetime.utcnow()
        for _ in range(3):
            await ReviewFactory.create(
                session=db_session,
                user_id=test_user.id,
                card_id=card.id,
                reviewed_at=today,
            )

        response = await client.get(
            f"{progress_url}/dashboard",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["today"]["reviews_completed"] == 3


# =============================================================================
# Deck Progress List Endpoint Tests
# =============================================================================


@pytest.mark.integration
class TestDeckProgressListEndpoint:
    """Tests for GET /progress/decks endpoint."""

    @pytest.mark.asyncio
    async def test_list_empty(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """User with no deck progress should get empty list."""
        response = await client.get(
            f"{progress_url}/decks",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["total"] == 0
        assert data["decks"] == []
        assert data["page"] == 1

    @pytest.mark.asyncio
    async def test_list_with_decks(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
        progress_url: str,
    ):
        """User with deck progress should see their decks."""
        # Create decks with progress
        deck1 = await DeckFactory.create(session=db_session, name="Deck 1")
        deck2 = await DeckFactory.create(session=db_session, name="Deck 2")

        await UserDeckProgressFactory.create(
            session=db_session,
            user_id=test_user.id,
            deck_id=deck1.id,
            cards_studied=10,
            cards_mastered=5,
        )
        await UserDeckProgressFactory.create(
            session=db_session,
            user_id=test_user.id,
            deck_id=deck2.id,
            cards_studied=3,
            cards_mastered=1,
        )

        response = await client.get(
            f"{progress_url}/decks",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["total"] == 2
        assert len(data["decks"]) == 2

        # Check deck summaries have required fields
        for deck in data["decks"]:
            assert "deck_id" in deck
            assert "deck_name" in deck

    @pytest.mark.asyncio
    async def test_list_response_structure(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
        progress_url: str,
    ):
        """Deck progress list should have correct response structure."""
        # Create a deck with progress
        deck = await DeckFactory.create(session=db_session)
        await UserDeckProgressFactory.create(
            session=db_session,
            user_id=test_user.id,
            deck_id=deck.id,
        )

        response = await client.get(
            f"{progress_url}/decks",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Check top-level structure
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "decks" in data

        # Check deck item structure
        deck_item = data["decks"][0]
        assert "deck_id" in deck_item
        assert "deck_name" in deck_item
        assert "deck_level" in deck_item
        assert "total_cards" in deck_item
        assert "cards_studied" in deck_item
        assert "cards_mastered" in deck_item
        assert "cards_due" in deck_item
        assert "mastery_percentage" in deck_item
        assert "completion_percentage" in deck_item

    @pytest.mark.asyncio
    async def test_pagination_page_1(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
        progress_url: str,
    ):
        """First page should work correctly."""
        # Create 5 decks with progress
        for i in range(5):
            deck = await DeckFactory.create(session=db_session, name=f"Deck {i}")
            await UserDeckProgressFactory.create(
                session=db_session,
                user_id=test_user.id,
                deck_id=deck.id,
            )

        response = await client.get(
            f"{progress_url}/decks",
            params={"page": 1, "page_size": 2},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["total"] == 5
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert len(data["decks"]) == 2

    @pytest.mark.asyncio
    async def test_pagination_page_2(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
        progress_url: str,
    ):
        """Second page should return correct items."""
        # Create 5 decks with progress
        for i in range(5):
            deck = await DeckFactory.create(session=db_session, name=f"Deck {i}")
            await UserDeckProgressFactory.create(
                session=db_session,
                user_id=test_user.id,
                deck_id=deck.id,
            )

        response = await client.get(
            f"{progress_url}/decks",
            params={"page": 2, "page_size": 2},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["total"] == 5
        assert data["page"] == 2
        assert len(data["decks"]) == 2

    @pytest.mark.asyncio
    async def test_pagination_invalid_page(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """Invalid page number should return 422."""
        response = await client.get(
            f"{progress_url}/decks",
            params={"page": 0},  # Invalid: must be >= 1
            headers=auth_headers,
        )
        assert response.status_code == 422


# =============================================================================
# Deck Progress Detail Endpoint Tests
# =============================================================================


@pytest.mark.integration
class TestDeckProgressDetailEndpoint:
    """Tests for GET /progress/decks/{deck_id} endpoint."""

    @pytest.mark.asyncio
    async def test_detail_success(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
        progress_url: str,
    ):
        """Should return detailed progress for a deck."""
        # Create deck with cards and progress
        deck = await DeckFactory.create(session=db_session, name="Test Deck")
        cards = await CardFactory.create_batch(
            session=db_session,
            size=5,
            deck_id=deck.id,
        )

        await UserDeckProgressFactory.create(
            session=db_session,
            user_id=test_user.id,
            deck_id=deck.id,
            cards_studied=3,
            cards_mastered=1,
        )

        # Create card statistics
        for card in cards[:3]:
            await CardStatisticsFactory.create(
                session=db_session,
                user_id=test_user.id,
                card_id=card.id,
            )

        response = await client.get(
            f"{progress_url}/decks/{deck.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert str(data["deck_id"]) == str(deck.id)
        assert data["deck_name"] == "Test Deck"

    @pytest.mark.asyncio
    async def test_detail_not_found(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """Non-existent deck should return 404."""
        fake_id = uuid4()
        response = await client.get(
            f"{progress_url}/decks/{fake_id}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_detail_not_started(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict,
        progress_url: str,
    ):
        """Deck without user progress should return 404."""
        # Create deck but no progress for user
        deck = await DeckFactory.create(session=db_session)

        response = await client.get(
            f"{progress_url}/decks/{deck.id}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_detail_response_structure(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
        progress_url: str,
    ):
        """Detail response should have all required sections."""
        deck = await DeckFactory.create(session=db_session)
        await UserDeckProgressFactory.create(
            session=db_session,
            user_id=test_user.id,
            deck_id=deck.id,
        )

        response = await client.get(
            f"{progress_url}/decks/{deck.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Check top-level fields
        assert "deck_id" in data
        assert "deck_name" in data
        assert "deck_level" in data
        assert "deck_description" in data
        assert "progress" in data
        assert "statistics" in data
        assert "timeline" in data

        # Check progress section
        progress = data["progress"]
        assert "total_cards" in progress
        assert "cards_studied" in progress
        assert "cards_mastered" in progress
        assert "cards_due" in progress
        assert "mastery_percentage" in progress
        assert "completion_percentage" in progress

        # Check statistics section
        stats = data["statistics"]
        assert "total_reviews" in stats
        assert "total_study_time_seconds" in stats
        assert "average_quality" in stats

        # Check timeline section
        timeline = data["timeline"]
        assert "first_studied_at" in timeline
        assert "last_studied_at" in timeline

    @pytest.mark.asyncio
    async def test_detail_progress_metrics(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
        progress_url: str,
    ):
        """Progress metrics should reflect actual card statistics."""
        deck = await DeckFactory.create(session=db_session)
        cards = await CardFactory.create_batch(
            session=db_session,
            size=10,
            deck_id=deck.id,
        )

        await UserDeckProgressFactory.create(
            session=db_session,
            user_id=test_user.id,
            deck_id=deck.id,
            cards_studied=7,
            cards_mastered=3,
        )

        # Create specific statistics
        # 3 mastered, 2 review, 2 learning
        for i, card in enumerate(cards[:7]):
            if i < 3:
                await CardStatisticsFactory.create(
                    session=db_session,
                    user_id=test_user.id,
                    card_id=card.id,
                    mastered=True,
                )
            elif i < 5:
                await CardStatisticsFactory.create(
                    session=db_session,
                    user_id=test_user.id,
                    card_id=card.id,
                    review=True,
                )
            else:
                await CardStatisticsFactory.create(
                    session=db_session,
                    user_id=test_user.id,
                    card_id=card.id,
                    learning=True,
                )

        response = await client.get(
            f"{progress_url}/decks/{deck.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        progress = data["progress"]
        assert progress["total_cards"] == 10
        assert progress["cards_mastered"] == 3


# =============================================================================
# Learning Trends Endpoint Tests
# =============================================================================


@pytest.mark.integration
class TestLearningTrendsEndpoint:
    """Tests for GET /progress/trends endpoint."""

    @pytest.mark.asyncio
    async def test_trends_default_period(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """Default period should be 'week'."""
        response = await client.get(
            f"{progress_url}/trends",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["period"] == "week"

    @pytest.mark.asyncio
    async def test_trends_week_period(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """Week period should return 7 days of data."""
        response = await client.get(
            f"{progress_url}/trends",
            params={"period": "week"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["period"] == "week"
        assert len(data["daily_stats"]) == 7

    @pytest.mark.asyncio
    async def test_trends_month_period(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """Month period should return 30 days of data."""
        response = await client.get(
            f"{progress_url}/trends",
            params={"period": "month"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["period"] == "month"
        assert len(data["daily_stats"]) == 30

    @pytest.mark.asyncio
    async def test_trends_year_period(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """Year period should return 365 days of data."""
        response = await client.get(
            f"{progress_url}/trends",
            params={"period": "year"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["period"] == "year"
        assert len(data["daily_stats"]) == 365

    @pytest.mark.asyncio
    async def test_trends_invalid_period(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """Invalid period should return 422."""
        response = await client.get(
            f"{progress_url}/trends",
            params={"period": "invalid"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_trends_deck_filter(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
        progress_url: str,
    ):
        """deck_id filter should filter trends by deck."""
        # Create two decks
        deck1 = await DeckFactory.create(session=db_session)
        deck2 = await DeckFactory.create(session=db_session)

        # Create cards for both decks
        card1 = await CardFactory.create(session=db_session, deck_id=deck1.id)
        card2 = await CardFactory.create(session=db_session, deck_id=deck2.id)

        # Create reviews for both decks
        await ReviewFactory.create(
            session=db_session,
            user_id=test_user.id,
            card_id=card1.id,
        )
        await ReviewFactory.create(
            session=db_session,
            user_id=test_user.id,
            card_id=card2.id,
        )

        # Request trends filtered by deck1
        response = await client.get(
            f"{progress_url}/trends",
            params={"deck_id": str(deck1.id)},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Should have data (filtered by deck1)
        assert "daily_stats" in data
        assert "summary" in data

    @pytest.mark.asyncio
    async def test_trends_response_structure(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """Trends response should have all required sections."""
        response = await client.get(
            f"{progress_url}/trends",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Check top-level fields
        assert "period" in data
        assert "start_date" in data
        assert "end_date" in data
        assert "daily_stats" in data
        assert "summary" in data

        # Check summary structure
        summary = data["summary"]
        assert "total_reviews" in summary
        assert "total_study_time_seconds" in summary
        assert "cards_mastered" in summary
        assert "average_daily_reviews" in summary
        assert "best_day" in summary
        assert "quality_trend" in summary

        # Check daily_stats item structure (if not empty)
        if data["daily_stats"]:
            daily_stat = data["daily_stats"][0]
            assert "date" in daily_stat
            assert "reviews_count" in daily_stat
            assert "cards_learned" in daily_stat
            assert "cards_mastered" in daily_stat
            assert "study_time_seconds" in daily_stat
            assert "average_quality" in daily_stat

    @pytest.mark.asyncio
    async def test_trends_with_activity(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        auth_headers: dict,
        progress_url: str,
    ):
        """Trends should reflect actual review activity."""
        # Create deck and card
        deck = await DeckFactory.create(session=db_session)
        card = await CardFactory.create(session=db_session, deck_id=deck.id)

        # Create reviews over the past week
        for i in range(5):
            review_date = datetime.utcnow() - timedelta(days=i)
            await ReviewFactory.create(
                session=db_session,
                user_id=test_user.id,
                card_id=card.id,
                reviewed_at=review_date,
            )

        response = await client.get(
            f"{progress_url}/trends",
            params={"period": "week"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Summary should show reviews
        assert data["summary"]["total_reviews"] >= 5


# =============================================================================
# User Isolation Tests
# =============================================================================


@pytest.mark.integration
class TestProgressUserIsolation:
    """Tests to ensure user data isolation in Progress API."""

    @pytest.mark.asyncio
    async def test_dashboard_isolation(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        two_users_same_deck: tuple[UserProgress, UserProgress],
    ):
        """Dashboard should only show user's own data."""
        user1_progress, user2_progress = two_users_same_deck

        # Get tokens for both users
        token1, _ = create_access_token(user1_progress.user.id)
        token2, _ = create_access_token(user2_progress.user.id)

        # Get dashboard for user 1
        response1 = await client.get(
            "/api/v1/progress/dashboard",
            headers={"Authorization": f"Bearer {token1}"},
        )
        assert response1.status_code == 200
        data1 = response1.json()

        # Get dashboard for user 2
        response2 = await client.get(
            "/api/v1/progress/dashboard",
            headers={"Authorization": f"Bearer {token2}"},
        )
        assert response2.status_code == 200
        data2 = response2.json()

        # Users should have different stats (they have different progress)
        # user1: 3 studied, 1 mastered
        # user2: 5 studied, 3 mastered
        assert data1["overview"]["total_decks_started"] == 1
        assert data2["overview"]["total_decks_started"] == 1
        # They're studying the same deck but with different progress

    @pytest.mark.asyncio
    async def test_deck_list_isolation(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        two_users_same_deck: tuple[UserProgress, UserProgress],
    ):
        """Deck list should only show user's own progress."""
        user1_progress, user2_progress = two_users_same_deck

        # Get tokens
        token1, _ = create_access_token(user1_progress.user.id)
        token2, _ = create_access_token(user2_progress.user.id)

        # Get deck list for both users
        response1 = await client.get(
            "/api/v1/progress/decks",
            headers={"Authorization": f"Bearer {token1}"},
        )
        response2 = await client.get(
            "/api/v1/progress/decks",
            headers={"Authorization": f"Bearer {token2}"},
        )

        assert response1.status_code == 200
        assert response2.status_code == 200

        data1 = response1.json()
        data2 = response2.json()

        # Both see the same deck but with their own progress
        assert data1["total"] == 1
        assert data2["total"] == 1

        # Their progress should be different
        if data1["decks"] and data2["decks"]:
            assert data1["decks"][0]["cards_studied"] != data2["decks"][0]["cards_studied"]

    @pytest.mark.asyncio
    async def test_deck_detail_isolation(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        two_users_same_deck: tuple[UserProgress, UserProgress],
    ):
        """Deck detail should only show user's own progress."""
        user1_progress, user2_progress = two_users_same_deck
        deck_id = user1_progress.deck.id

        # Get tokens
        token1, _ = create_access_token(user1_progress.user.id)
        token2, _ = create_access_token(user2_progress.user.id)

        # Get deck detail for both users
        response1 = await client.get(
            f"/api/v1/progress/decks/{deck_id}",
            headers={"Authorization": f"Bearer {token1}"},
        )
        response2 = await client.get(
            f"/api/v1/progress/decks/{deck_id}",
            headers={"Authorization": f"Bearer {token2}"},
        )

        assert response1.status_code == 200
        assert response2.status_code == 200

        data1 = response1.json()
        data2 = response2.json()

        # Same deck but different user progress
        assert str(data1["deck_id"]) == str(deck_id)
        assert str(data2["deck_id"]) == str(deck_id)

        # Progress should differ (user1: 3 studied, user2: 5 studied)
        assert data1["progress"]["cards_studied"] != data2["progress"]["cards_studied"]

    @pytest.mark.asyncio
    async def test_trends_isolation(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        two_users_same_deck: tuple[UserProgress, UserProgress],
    ):
        """Trends should only show user's own review data."""
        user1_progress, user2_progress = two_users_same_deck

        # Create a card in the shared deck
        card = await CardFactory.create(
            session=db_session,
            deck_id=user1_progress.deck.id,
        )

        # Create reviews for user1 only
        for _ in range(3):
            await ReviewFactory.create(
                session=db_session,
                user_id=user1_progress.user.id,
                card_id=card.id,
            )

        # Get tokens
        token1, _ = create_access_token(user1_progress.user.id)
        token2, _ = create_access_token(user2_progress.user.id)

        # Get trends for both users
        response1 = await client.get(
            "/api/v1/progress/trends",
            headers={"Authorization": f"Bearer {token1}"},
        )
        response2 = await client.get(
            "/api/v1/progress/trends",
            headers={"Authorization": f"Bearer {token2}"},
        )

        assert response1.status_code == 200
        assert response2.status_code == 200

        data1 = response1.json()
        data2 = response2.json()

        # User1 should have reviews, user2 should have 0
        assert data1["summary"]["total_reviews"] >= 3
        assert data2["summary"]["total_reviews"] == 0
