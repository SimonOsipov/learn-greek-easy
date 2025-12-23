"""Unit tests for progress API endpoints.

Tests cover:
- Dashboard statistics (GET /api/v1/progress/dashboard)
- Deck progress list (GET /api/v1/progress/decks)
- Deck progress detail (GET /api/v1/progress/decks/{deck_id})
- Learning trends (GET /api/v1/progress/trends)
- Achievements (GET /api/v1/progress/achievements)

These tests mock the ProgressService to test endpoint logic in isolation.
For full integration tests, see tests/integration/test_progress_api.py
"""

from datetime import date, datetime, timedelta
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient

from src.core.exceptions import DeckNotFoundException
from src.schemas.progress import (
    Achievement,
    AchievementsResponse,
    DailyStats,
    DashboardStatsResponse,
    DeckProgressDetailResponse,
    DeckProgressListResponse,
    DeckProgressMetrics,
    DeckProgressSummary,
    DeckStatistics,
    DeckTimeline,
    LearningTrendsResponse,
    NextMilestone,
    OverviewStats,
    RecentActivity,
    StreakStats,
    TodayStats,
    TrendsSummary,
)

# =============================================================================
# Helper Functions
# =============================================================================


def create_mock_dashboard_response(
    total_studied: int = 100,
    total_mastered: int = 50,
    total_decks: int = 3,
    reviews_today: int = 10,
    cards_due: int = 5,
    current_streak: int = 7,
    longest_streak: int = 14,
    study_time_seconds: int = 1800,
) -> DashboardStatsResponse:
    """Create a mock DashboardStatsResponse for testing."""
    return DashboardStatsResponse(
        overview=OverviewStats(
            total_cards_studied=total_studied,
            total_cards_mastered=total_mastered,
            total_decks_started=total_decks,
            overall_mastery_percentage=50.0 if total_studied > 0 else 0.0,
        ),
        today=TodayStats(
            reviews_completed=reviews_today,
            cards_due=cards_due,
            daily_goal=20,
            goal_progress_percentage=50.0,
            study_time_seconds=study_time_seconds,
        ),
        streak=StreakStats(
            current_streak=current_streak,
            longest_streak=longest_streak,
            last_study_date=date.today(),
        ),
        cards_by_status={
            "new": 20,
            "learning": 30,
            "review": 30,
            "mastered": 50,
            "due": cards_due,
        },
        recent_activity=[
            RecentActivity(
                date=date.today(),
                reviews_count=reviews_today,
                average_quality=4.2,
            ),
        ],
    )


def create_mock_deck_progress_list(
    total: int = 3,
    page: int = 1,
    page_size: int = 20,
    decks: list[DeckProgressSummary] | None = None,
) -> DeckProgressListResponse:
    """Create a mock DeckProgressListResponse for testing."""
    if decks is None:
        decks = [
            DeckProgressSummary(
                deck_id=uuid4(),
                deck_name="Greek A1 Vocabulary",
                deck_level="A1",
                total_cards=100,
                cards_studied=75,
                cards_mastered=30,
                cards_due=15,
                mastery_percentage=40.0,
                completion_percentage=75.0,
                last_studied_at=datetime.utcnow(),
                average_easiness_factor=2.35,
                estimated_review_time_minutes=8,
            )
        ]
    return DeckProgressListResponse(
        total=total,
        page=page,
        page_size=page_size,
        decks=decks,
    )


def create_mock_deck_progress_detail(
    deck_id=None,
    deck_name: str = "Greek A1 Vocabulary",
    mastery_percentage: float = 40.0,
) -> DeckProgressDetailResponse:
    """Create a mock DeckProgressDetailResponse for testing."""
    return DeckProgressDetailResponse(
        deck_id=deck_id or uuid4(),
        deck_name=deck_name,
        deck_level="A1",
        deck_description="Essential Greek vocabulary for beginners",
        progress=DeckProgressMetrics(
            total_cards=100,
            cards_studied=75,
            cards_mastered=30,
            cards_due=15,
            cards_new=25,
            cards_learning=20,
            cards_review=25,
            mastery_percentage=mastery_percentage,
            completion_percentage=75.0,
        ),
        statistics=DeckStatistics(
            total_reviews=250,
            total_study_time_seconds=7500,
            average_quality=3.8,
            average_easiness_factor=2.35,
            average_interval_days=4.5,
        ),
        timeline=DeckTimeline(
            first_studied_at=datetime.utcnow() - timedelta(days=15),
            last_studied_at=datetime.utcnow(),
            days_active=15,
            estimated_completion_days=10,
        ),
    )


def create_mock_learning_trends(
    period: str = "week",
    total_reviews: int = 150,
    cards_mastered: int = 12,
    daily_stats: list[DailyStats] | None = None,
) -> LearningTrendsResponse:
    """Create a mock LearningTrendsResponse for testing."""
    days = 7 if period == "week" else (30 if period == "month" else 365)
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)

    if daily_stats is None:
        daily_stats = [
            DailyStats(
                date=end_date - timedelta(days=i),
                reviews_count=20 if i < 5 else 0,
                cards_learned=3 if i < 5 else 0,
                cards_mastered=2 if i < 5 else 0,
                study_time_seconds=1200 if i < 5 else 0,
                average_quality=4.0 if i < 5 else 0.0,
            )
            for i in range(days)
        ]

    return LearningTrendsResponse(
        period=period,
        start_date=start_date,
        end_date=end_date,
        daily_stats=daily_stats,
        summary=TrendsSummary(
            total_reviews=total_reviews,
            total_study_time_seconds=10800,
            cards_mastered=cards_mastered,
            average_daily_reviews=21.4,
            best_day=end_date - timedelta(days=2),
            quality_trend="improving",
        ),
    )


def create_mock_achievements(
    total_points: int = 145,
    achievements: list[Achievement] | None = None,
) -> AchievementsResponse:
    """Create a mock AchievementsResponse for testing."""
    if achievements is None:
        achievements = [
            Achievement(
                id="streak_7",
                name="Week Warrior",
                description="Maintain a 7-day study streak",
                icon="flame",
                unlocked=True,
                unlocked_at=None,
                progress=100.0,
                points=50,
            ),
            Achievement(
                id="mastered_100",
                name="Century Club",
                description="Master 100 flashcards",
                icon="medal",
                unlocked=False,
                unlocked_at=None,
                progress=45.0,
                points=0,
            ),
        ]

    return AchievementsResponse(
        achievements=achievements,
        total_points=total_points,
        next_milestone=NextMilestone(
            id="mastered_100",
            name="Century Club",
            progress=45.0,
            remaining=55,
        ),
    )


# =============================================================================
# TestDashboardEndpoint - Tests for GET /api/v1/progress/dashboard
# =============================================================================


class TestDashboardEndpoint:
    """Unit tests for GET /api/v1/progress/dashboard endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_dashboard_unauthenticated_returns_401(
        self,
        client: AsyncClient,
    ) -> None:
        """Dashboard requires authentication."""
        response = await client.get("/api/v1/progress/dashboard")
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_dashboard_new_user_returns_zeros(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """New user with no progress returns zero values."""
        mock_response = create_mock_dashboard_response(
            total_studied=0,
            total_mastered=0,
            total_decks=0,
            reviews_today=0,
            cards_due=0,
            current_streak=0,
            longest_streak=0,
            study_time_seconds=0,
        )
        # Update the mastery percentage for zero case
        mock_response.overview.overall_mastery_percentage = 0.0
        mock_response.today.goal_progress_percentage = 0.0
        mock_response.recent_activity = []

        with patch("src.api.v1.progress.ProgressService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_dashboard_stats.return_value = mock_response
            mock_service_class.return_value = mock_service

            response = await client.get(
                "/api/v1/progress/dashboard",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["overview"]["total_cards_studied"] == 0
            assert data["overview"]["total_cards_mastered"] == 0
            assert data["overview"]["total_decks_started"] == 0
            assert data["streak"]["current_streak"] == 0
            assert data["today"]["reviews_completed"] == 0

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_dashboard_response_structure(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """Dashboard returns all required sections."""
        mock_response = create_mock_dashboard_response()

        with patch("src.api.v1.progress.ProgressService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_dashboard_stats.return_value = mock_response
            mock_service_class.return_value = mock_service

            response = await client.get(
                "/api/v1/progress/dashboard",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()

            # Verify all sections exist
            assert "overview" in data
            assert "today" in data
            assert "streak" in data
            assert "cards_by_status" in data
            assert "recent_activity" in data

            # Verify overview fields
            assert "total_cards_studied" in data["overview"]
            assert "total_cards_mastered" in data["overview"]
            assert "total_decks_started" in data["overview"]
            assert "overall_mastery_percentage" in data["overview"]

            # Verify today fields
            assert "reviews_completed" in data["today"]
            assert "cards_due" in data["today"]
            assert "daily_goal" in data["today"]
            assert "goal_progress_percentage" in data["today"]
            assert "study_time_seconds" in data["today"]

            # Verify streak fields
            assert "current_streak" in data["streak"]
            assert "longest_streak" in data["streak"]
            assert "last_study_date" in data["streak"]

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_dashboard_calculates_streak(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """Streak values returned correctly."""
        mock_response = create_mock_dashboard_response(
            current_streak=7,
            longest_streak=14,
        )

        with patch("src.api.v1.progress.ProgressService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_dashboard_stats.return_value = mock_response
            mock_service_class.return_value = mock_service

            response = await client.get(
                "/api/v1/progress/dashboard",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["streak"]["current_streak"] == 7
            assert data["streak"]["longest_streak"] == 14

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_dashboard_counts_today_reviews(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """Today's reviews counted correctly."""
        mock_response = create_mock_dashboard_response(
            reviews_today=25,
            cards_due=10,
            study_time_seconds=3600,
        )

        with patch("src.api.v1.progress.ProgressService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_dashboard_stats.return_value = mock_response
            mock_service_class.return_value = mock_service

            response = await client.get(
                "/api/v1/progress/dashboard",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["today"]["reviews_completed"] == 25
            assert data["today"]["cards_due"] == 10
            assert data["today"]["study_time_seconds"] == 3600


# =============================================================================
# TestDeckProgressListEndpoint - Tests for GET /api/v1/progress/decks
# =============================================================================


class TestDeckProgressListEndpoint:
    """Unit tests for GET /api/v1/progress/decks endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_list_unauthenticated_returns_401(
        self,
        client: AsyncClient,
    ) -> None:
        """Deck progress list requires authentication."""
        response = await client.get("/api/v1/progress/decks")
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_list_empty_for_new_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """New user returns empty deck list."""
        mock_response = create_mock_deck_progress_list(
            total=0,
            decks=[],
        )

        with patch("src.api.v1.progress.ProgressService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_deck_progress_list.return_value = mock_response
            mock_service_class.return_value = mock_service

            response = await client.get(
                "/api/v1/progress/decks",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 0
            assert data["decks"] == []

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_list_pagination_works(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """Pagination parameters are passed correctly."""
        mock_response = create_mock_deck_progress_list(
            total=50,
            page=2,
            page_size=10,
            decks=[],
        )

        with patch("src.api.v1.progress.ProgressService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_deck_progress_list.return_value = mock_response
            mock_service_class.return_value = mock_service

            response = await client.get(
                "/api/v1/progress/decks?page=2&page_size=10",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["page"] == 2
            assert data["page_size"] == 10

            # Verify service was called with correct parameters
            mock_service.get_deck_progress_list.assert_called_once()
            call_kwargs = mock_service.get_deck_progress_list.call_args.kwargs
            assert call_kwargs["page"] == 2
            assert call_kwargs["page_size"] == 10

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_list_response_structure(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """Response has all required fields."""
        mock_response = create_mock_deck_progress_list()

        with patch("src.api.v1.progress.ProgressService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_deck_progress_list.return_value = mock_response
            mock_service_class.return_value = mock_service

            response = await client.get(
                "/api/v1/progress/decks",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()

            # Verify pagination fields
            assert "total" in data
            assert "page" in data
            assert "page_size" in data
            assert "decks" in data

            # Verify deck fields
            assert len(data["decks"]) > 0
            deck = data["decks"][0]
            assert "deck_id" in deck
            assert "deck_name" in deck
            assert "deck_level" in deck
            assert "total_cards" in deck
            assert "cards_studied" in deck
            assert "cards_mastered" in deck
            assert "cards_due" in deck
            assert "mastery_percentage" in deck
            assert "completion_percentage" in deck


# =============================================================================
# TestDeckProgressDetailEndpoint - Tests for GET /api/v1/progress/decks/{deck_id}
# =============================================================================


class TestDeckProgressDetailEndpoint:
    """Unit tests for GET /api/v1/progress/decks/{deck_id} endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_detail_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """Valid deck returns progress details."""
        deck_id = uuid4()
        mock_response = create_mock_deck_progress_detail(deck_id=deck_id)

        with patch("src.api.v1.progress.ProgressService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_deck_progress_detail.return_value = mock_response
            mock_service_class.return_value = mock_service

            response = await client.get(
                f"/api/v1/progress/decks/{deck_id}",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["deck_id"] == str(deck_id)
            assert "progress" in data
            assert "statistics" in data
            assert "timeline" in data

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_detail_not_found_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """Non-existent deck returns 404."""
        deck_id = uuid4()

        with patch("src.api.v1.progress.ProgressService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_deck_progress_detail.side_effect = DeckNotFoundException(
                deck_id=str(deck_id)
            )
            mock_service_class.return_value = mock_service

            response = await client.get(
                f"/api/v1/progress/decks/{deck_id}",
                headers=auth_headers,
            )

            assert response.status_code == 404
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_detail_includes_mastery_percentage(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """Mastery percentage is included in response."""
        deck_id = uuid4()
        mock_response = create_mock_deck_progress_detail(
            deck_id=deck_id,
            mastery_percentage=65.5,
        )

        with patch("src.api.v1.progress.ProgressService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_deck_progress_detail.return_value = mock_response
            mock_service_class.return_value = mock_service

            response = await client.get(
                f"/api/v1/progress/decks/{deck_id}",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert "mastery_percentage" in data["progress"]
            assert data["progress"]["mastery_percentage"] == 65.5


# =============================================================================
# TestLearningTrendsEndpoint - Tests for GET /api/v1/progress/trends
# =============================================================================


class TestLearningTrendsEndpoint:
    """Unit tests for GET /api/v1/progress/trends endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_trends_unauthenticated_returns_401(
        self,
        client: AsyncClient,
    ) -> None:
        """Learning trends requires authentication."""
        response = await client.get("/api/v1/progress/trends")
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_trends_default_period(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """Default period is 'week'."""
        mock_response = create_mock_learning_trends(period="week")

        with patch("src.api.v1.progress.ProgressService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_learning_trends.return_value = mock_response
            mock_service_class.return_value = mock_service

            response = await client.get(
                "/api/v1/progress/trends",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["period"] == "week"

            # Verify default period was passed to service
            mock_service.get_learning_trends.assert_called_once()
            call_kwargs = mock_service.get_learning_trends.call_args.kwargs
            assert call_kwargs["period"] == "week"

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_trends_week_period(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """Week period returns 7 days of data."""
        mock_response = create_mock_learning_trends(period="week")

        with patch("src.api.v1.progress.ProgressService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_learning_trends.return_value = mock_response
            mock_service_class.return_value = mock_service

            response = await client.get(
                "/api/v1/progress/trends?period=week",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["period"] == "week"
            assert len(data["daily_stats"]) == 7

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_trends_month_period(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """Month period returns 30 days of data."""
        mock_response = create_mock_learning_trends(period="month")

        with patch("src.api.v1.progress.ProgressService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_learning_trends.return_value = mock_response
            mock_service_class.return_value = mock_service

            response = await client.get(
                "/api/v1/progress/trends?period=month",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["period"] == "month"
            # Verify service was called with month period
            call_kwargs = mock_service.get_learning_trends.call_args.kwargs
            assert call_kwargs["period"] == "month"

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_trends_year_period(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """Year period is accepted."""
        mock_response = create_mock_learning_trends(period="year")

        with patch("src.api.v1.progress.ProgressService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_learning_trends.return_value = mock_response
            mock_service_class.return_value = mock_service

            response = await client.get(
                "/api/v1/progress/trends?period=year",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["period"] == "year"
            # Verify service was called with year period
            call_kwargs = mock_service.get_learning_trends.call_args.kwargs
            assert call_kwargs["period"] == "year"

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_trends_invalid_period_returns_422(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """Invalid period parameter returns 422."""
        response = await client.get(
            "/api/v1/progress/trends?period=invalid",
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_trends_deck_filter(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """deck_id filter is passed to service."""
        deck_id = uuid4()
        mock_response = create_mock_learning_trends(period="week")

        with patch("src.api.v1.progress.ProgressService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_learning_trends.return_value = mock_response
            mock_service_class.return_value = mock_service

            response = await client.get(
                f"/api/v1/progress/trends?deck_id={deck_id}",
                headers=auth_headers,
            )

            assert response.status_code == 200

            # Verify deck_id was passed to service
            mock_service.get_learning_trends.assert_called_once()
            call_kwargs = mock_service.get_learning_trends.call_args.kwargs
            assert call_kwargs["deck_id"] == deck_id

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_trends_response_structure(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """Response has all required fields."""
        mock_response = create_mock_learning_trends()

        with patch("src.api.v1.progress.ProgressService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_learning_trends.return_value = mock_response
            mock_service_class.return_value = mock_service

            response = await client.get(
                "/api/v1/progress/trends",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()

            # Verify top-level fields
            assert "period" in data
            assert "start_date" in data
            assert "end_date" in data
            assert "daily_stats" in data
            assert "summary" in data

            # Verify daily_stats structure
            assert len(data["daily_stats"]) > 0
            day_stat = data["daily_stats"][0]
            assert "date" in day_stat
            assert "reviews_count" in day_stat
            assert "cards_learned" in day_stat
            assert "cards_mastered" in day_stat
            assert "study_time_seconds" in day_stat
            assert "average_quality" in day_stat

            # Verify summary fields
            assert "total_reviews" in data["summary"]
            assert "total_study_time_seconds" in data["summary"]
            assert "cards_mastered" in data["summary"]
            assert "average_daily_reviews" in data["summary"]
            assert "best_day" in data["summary"]
            assert "quality_trend" in data["summary"]


# =============================================================================
# TestAchievementsEndpoint - Tests for GET /api/v1/progress/achievements
# =============================================================================


class TestAchievementsEndpoint:
    """Unit tests for GET /api/v1/progress/achievements endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_achievements_unauthenticated_returns_401(
        self,
        client: AsyncClient,
    ) -> None:
        """Achievements requires authentication."""
        response = await client.get("/api/v1/progress/achievements")
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_achievements_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """Achievements returns successfully with achievements list."""
        mock_response = create_mock_achievements(total_points=145)

        with patch("src.api.v1.progress.ProgressService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_achievements.return_value = mock_response
            mock_service_class.return_value = mock_service

            response = await client.get(
                "/api/v1/progress/achievements",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert "achievements" in data
            assert "total_points" in data
            assert data["total_points"] == 145
            assert len(data["achievements"]) == 2

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_achievements_response_structure(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """Achievements response has required fields."""
        mock_response = create_mock_achievements()

        with patch("src.api.v1.progress.ProgressService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_achievements.return_value = mock_response
            mock_service_class.return_value = mock_service

            response = await client.get(
                "/api/v1/progress/achievements",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()

            # Verify top-level fields
            assert "achievements" in data
            assert "total_points" in data
            assert "next_milestone" in data

            # Verify achievement structure
            assert len(data["achievements"]) > 0
            achievement = data["achievements"][0]
            assert "id" in achievement
            assert "name" in achievement
            assert "description" in achievement
            assert "icon" in achievement
            assert "unlocked" in achievement
            assert "progress" in achievement
            assert "points" in achievement

            # Verify next_milestone structure
            assert data["next_milestone"] is not None
            assert "id" in data["next_milestone"]
            assert "name" in data["next_milestone"]
            assert "progress" in data["next_milestone"]
            assert "remaining" in data["next_milestone"]
