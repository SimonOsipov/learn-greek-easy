"""E2E tests for learning trends endpoint.

These tests verify the learning trends API through real HTTP requests,
covering:
- GET /api/v1/progress/trends
- Different time periods (week, month, year)
- Deck filtering
- Response structure validation
- Authentication requirements

Run with:
    pytest tests/e2e/scenarios/test_learning_trends.py -v
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.e2e.conftest import E2ETestCase, StudyEnvironment, UserSession


class TestLearningTrendsPeriods(E2ETestCase):
    """E2E tests for learning trends time period handling."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_trends_default_period_is_week(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that default period is 'week' when no period specified."""
        response = await client.get(
            "/api/v1/progress/trends",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "week"

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_trends_week_period_returns_7_days(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that week period returns 7 days of data."""
        response = await client.get(
            "/api/v1/progress/trends",
            params={"period": "week"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "week"
        # Should have daily_stats array with 7 entries (one per day)
        assert "daily_stats" in data
        assert len(data["daily_stats"]) == 7

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_trends_month_period_returns_30_days(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that month period returns 30 days of data."""
        response = await client.get(
            "/api/v1/progress/trends",
            params={"period": "month"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "month"
        # Should have 30 daily stats entries
        assert "daily_stats" in data
        assert len(data["daily_stats"]) == 30

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_trends_year_period_returns_365_days(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that year period returns 365 days of data."""
        response = await client.get(
            "/api/v1/progress/trends",
            params={"period": "year"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "year"
        # Should have 365 daily stats entries
        assert "daily_stats" in data
        assert len(data["daily_stats"]) == 365

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_trends_invalid_period_returns_422(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that invalid period value returns 422."""
        response = await client.get(
            "/api/v1/progress/trends",
            params={"period": "invalid_period"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 422


class TestLearningTrendsResponseStructure(E2ETestCase):
    """E2E tests for learning trends response structure."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_trends_response_has_required_fields(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that response has all required fields."""
        response = await client.get(
            "/api/v1/progress/trends",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Required top-level fields
        assert "period" in data
        assert "start_date" in data
        assert "end_date" in data
        assert "daily_stats" in data
        assert "summary" in data

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_trends_daily_stats_structure(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that daily_stats entries have correct structure."""
        response = await client.get(
            "/api/v1/progress/trends",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Check at least one daily stat entry
        assert len(data["daily_stats"]) > 0
        daily_stat = data["daily_stats"][0]

        # Required fields in daily stat
        assert "date" in daily_stat
        assert "reviews_count" in daily_stat
        assert "cards_learned" in daily_stat
        assert "cards_mastered" in daily_stat
        assert "study_time_seconds" in daily_stat
        assert "average_quality" in daily_stat

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_trends_summary_structure(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that summary has correct structure."""
        response = await client.get(
            "/api/v1/progress/trends",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        summary = data["summary"]

        # Required fields in summary
        assert "total_reviews" in summary
        assert "total_study_time_seconds" in summary
        assert "cards_mastered" in summary
        assert "average_daily_reviews" in summary
        assert "quality_trend" in summary

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_trends_quality_trend_valid_values(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that quality_trend has valid value."""
        response = await client.get(
            "/api/v1/progress/trends",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        quality_trend = data["summary"]["quality_trend"]
        # Quality trend should be one of these values
        assert quality_trend in ["improving", "stable", "declining"]


class TestLearningTrendsDeckFilter(E2ETestCase):
    """E2E tests for learning trends with deck filtering."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_trends_with_deck_filter(
        self, client: AsyncClient, populated_study_environment: StudyEnvironment
    ) -> None:
        """Test trends endpoint with deck_id filter."""
        # Use the pre-populated deck from the fixture
        deck_id = str(populated_study_environment.deck.id)
        headers = populated_study_environment.headers

        response = await client.get(
            "/api/v1/progress/trends",
            params={"deck_id": deck_id},
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "daily_stats" in data
        assert "summary" in data

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_trends_with_deck_filter_and_period(
        self, client: AsyncClient, populated_study_environment: StudyEnvironment
    ) -> None:
        """Test trends endpoint with both deck_id and period filters."""
        # Use the pre-populated deck from the fixture
        deck_id = str(populated_study_environment.deck.id)
        headers = populated_study_environment.headers

        response = await client.get(
            "/api/v1/progress/trends",
            params={"deck_id": deck_id, "period": "month"},
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "month"
        assert len(data["daily_stats"]) == 30

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_trends_with_nonexistent_deck_returns_empty_data(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test trends with non-existent deck_id returns valid response."""
        # Use a random UUID that doesn't exist
        fake_deck_id = str(uuid4())

        response = await client.get(
            "/api/v1/progress/trends",
            params={"deck_id": fake_deck_id},
            headers=fresh_user_session.headers,
        )

        # Should still return 200 with zero stats
        # or 404 depending on implementation
        assert response.status_code in [200, 404]

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_trends_with_invalid_deck_id_format(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test trends with invalid deck_id format returns 422."""
        response = await client.get(
            "/api/v1/progress/trends",
            params={"deck_id": "not-a-valid-uuid"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 422


class TestLearningTrendsAuthentication(E2ETestCase):
    """E2E tests for learning trends authentication."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_trends_unauthenticated_returns_401(self, client: AsyncClient) -> None:
        """Test that unauthenticated request returns 401."""
        response = await client.get("/api/v1/progress/trends")

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_trends_invalid_token_returns_401(self, client: AsyncClient) -> None:
        """Test that invalid token returns 401."""
        headers = {"Authorization": "Bearer invalid_token"}

        response = await client.get(
            "/api/v1/progress/trends",
            headers=headers,
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_trends_expired_token_returns_401(
        self, client: AsyncClient, expired_access_token: str
    ) -> None:
        """Test that expired token returns 401."""
        headers = {"Authorization": f"Bearer {expired_access_token}"}

        response = await client.get(
            "/api/v1/progress/trends",
            headers=headers,
        )

        assert response.status_code == 401


class TestLearningTrendsDataValues(E2ETestCase):
    """E2E tests for learning trends data values."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_trends_dates_are_sorted(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that daily_stats dates are sorted (ascending - oldest first)."""
        response = await client.get(
            "/api/v1/progress/trends",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        dates = [stat["date"] for stat in data["daily_stats"]]
        # Dates should be in ascending order (oldest first)
        assert dates == sorted(dates)

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_trends_new_user_has_zero_stats(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that new user has zero values in stats."""
        response = await client.get(
            "/api/v1/progress/trends",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # New user should have all zeros in summary
        summary = data["summary"]
        assert summary["total_reviews"] == 0
        assert summary["total_study_time_seconds"] == 0
        assert summary["cards_mastered"] == 0
        assert summary["average_daily_reviews"] == 0

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_trends_numeric_values_are_valid(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that numeric values are valid (non-negative)."""
        response = await client.get(
            "/api/v1/progress/trends",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Check summary values
        summary = data["summary"]
        assert summary["total_reviews"] >= 0
        assert summary["total_study_time_seconds"] >= 0
        assert summary["cards_mastered"] >= 0
        assert summary["average_daily_reviews"] >= 0

        # Check daily stat values
        for stat in data["daily_stats"]:
            assert stat["reviews_count"] >= 0
            assert stat["cards_learned"] >= 0
            assert stat["cards_mastered"] >= 0
            assert stat["study_time_seconds"] >= 0
            assert stat["average_quality"] >= 0


class TestLearningTrendsHttpMethods(E2ETestCase):
    """E2E tests for learning trends HTTP method handling."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_trends_post_method_not_allowed(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that POST method returns 405."""
        response = await client.post(
            "/api/v1/progress/trends",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 405

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_trends_put_method_not_allowed(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that PUT method returns 405."""
        response = await client.put(
            "/api/v1/progress/trends",
            json={},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 405

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_trends_delete_method_not_allowed(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that DELETE method returns 405."""
        response = await client.delete(
            "/api/v1/progress/trends",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 405
