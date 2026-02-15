"""E2E tests for study statistics endpoint.

These tests verify the study stats API through real HTTP requests,
covering:
- GET /api/v1/study/stats
- Deck filtering
- Response structure validation
- Authentication requirements

Run with:
    pytest tests/e2e/scenarios/test_study_stats.py -v
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.e2e.conftest import E2ETestCase, StudyEnvironment, UserSession


class TestStudyStatsBasic(E2ETestCase):
    """E2E tests for basic study stats functionality."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_study_stats_new_user(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that new user has default stats."""
        response = await client.get(
            "/api/v1/study/stats",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # New user should have zero values
        assert data["reviews_today"] == 0
        assert data["total_reviews"] == 0
        assert data["total_study_time"] == 0

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_study_stats_response_structure(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that response has correct structure."""
        response = await client.get(
            "/api/v1/study/stats",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Required fields
        assert "by_status" in data
        assert "reviews_today" in data
        assert "current_streak" in data
        assert "due_today" in data
        assert "total_reviews" in data
        assert "total_study_time" in data
        assert "average_quality" in data

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_study_stats_by_status_structure(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that by_status has correct structure."""
        response = await client.get(
            "/api/v1/study/stats",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        by_status = data["by_status"]
        # Required status categories
        assert "new" in by_status
        assert "learning" in by_status
        assert "review" in by_status
        assert "mastered" in by_status
        assert "due" in by_status


class TestStudyStatsDeckFilter(E2ETestCase):
    """E2E tests for study stats with deck filtering."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_study_stats_with_deck_filter(
        self, client: AsyncClient, populated_study_environment: StudyEnvironment
    ) -> None:
        """Test stats endpoint with deck_id filter."""
        # Use the pre-populated deck from the fixture
        deck_id = str(populated_study_environment.deck.id)
        headers = populated_study_environment.headers

        response = await client.get(
            "/api/v1/study/stats",
            params={"deck_id": deck_id},
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "by_status" in data

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_study_stats_with_nonexistent_deck(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test stats with non-existent deck_id."""
        fake_deck_id = str(uuid4())

        response = await client.get(
            "/api/v1/study/stats",
            params={"deck_id": fake_deck_id},
            headers=fresh_user_session.headers,
        )

        # Should return 200 with zero stats or 404
        assert response.status_code in [200, 404]

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_study_stats_with_invalid_deck_id_format(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test stats with invalid deck_id format returns 422."""
        response = await client.get(
            "/api/v1/study/stats",
            params={"deck_id": "not-a-valid-uuid"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 422


class TestStudyStatsAuthentication(E2ETestCase):
    """E2E tests for study stats authentication."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_study_stats_unauthenticated_returns_401(self, client: AsyncClient) -> None:
        """Test that unauthenticated request returns 401."""
        response = await client.get("/api/v1/study/stats")

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_study_stats_invalid_token_returns_401(self, client: AsyncClient) -> None:
        """Test that invalid token returns 401."""
        headers = {"Authorization": "Bearer invalid_token"}

        response = await client.get(
            "/api/v1/study/stats",
            headers=headers,
        )

        assert response.status_code == 401


class TestStudyStatsDataValues(E2ETestCase):
    """E2E tests for study stats data values."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_study_stats_numeric_values_are_valid(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that numeric values are valid (non-negative)."""
        response = await client.get(
            "/api/v1/study/stats",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # All counts should be non-negative
        assert data["reviews_today"] >= 0
        assert data["current_streak"] >= 0
        assert data["due_today"] >= 0
        assert data["total_reviews"] >= 0
        assert data["total_study_time"] >= 0

        # Quality is 0-5 or 0 if no reviews
        assert 0 <= data["average_quality"] <= 5

        # Status counts should be non-negative
        for status, count in data["by_status"].items():
            assert count >= 0, f"Status {status} should be non-negative"

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_study_stats_streak_is_integer(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that streak is an integer."""
        response = await client.get(
            "/api/v1/study/stats",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["current_streak"], int)


class TestStudyStatsHttpMethods(E2ETestCase):
    """E2E tests for study stats HTTP method handling."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_study_stats_post_method_not_allowed(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that POST method returns 405."""
        response = await client.post(
            "/api/v1/study/stats",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 405

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_study_stats_put_method_not_allowed(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that PUT method returns 405."""
        response = await client.put(
            "/api/v1/study/stats",
            json={},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 405

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_study_stats_delete_method_not_allowed(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that DELETE method returns 405."""
        response = await client.delete(
            "/api/v1/study/stats",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 405


class TestStudyStatsResponseFormat(E2ETestCase):
    """E2E tests for study stats response formatting."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_study_stats_response_is_json(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that response is JSON formatted."""
        response = await client.get(
            "/api/v1/study/stats",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        assert "application/json" in response.headers.get("content-type", "")

        # Should be valid JSON
        data = response.json()
        assert isinstance(data, dict)
