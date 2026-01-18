"""E2E tests for XP and Achievements API endpoints.

These tests verify the XP and Achievements API through real HTTP requests,
covering:
- GET /api/v1/xp/stats - XP statistics
- GET /api/v1/xp/achievements - All achievements with progress

Run with:
    pytest tests/e2e/scenarios/test_xp_endpoints.py -v
"""

import pytest
from httpx import AsyncClient

from tests.e2e.conftest import E2ETestCase, UserSession


class TestXPStatsEndpoint(E2ETestCase):
    """E2E tests for GET /api/v1/xp/stats endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    @pytest.mark.scenario
    async def test_xp_stats_new_user(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that new user has default XP stats."""
        response = await client.get(
            "/api/v1/xp/stats",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # New user should start at level 1 with 0 XP
        assert data["total_xp"] == 0
        assert data["current_level"] == 1
        assert data["xp_in_level"] == 0
        assert data["progress_percentage"] == 0.0

    @pytest.mark.asyncio
    @pytest.mark.e2e
    @pytest.mark.scenario
    async def test_xp_stats_response_structure(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that XP stats response has correct structure."""
        response = await client.get(
            "/api/v1/xp/stats",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # All required fields should be present
        assert "total_xp" in data
        assert "current_level" in data
        assert "level_name_greek" in data
        assert "level_name_english" in data
        assert "xp_in_level" in data
        assert "xp_for_next_level" in data
        assert "progress_percentage" in data

    @pytest.mark.asyncio
    @pytest.mark.e2e
    @pytest.mark.scenario
    async def test_xp_stats_field_types(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that XP stats field types are correct."""
        response = await client.get(
            "/api/v1/xp/stats",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Verify field types
        assert isinstance(data["total_xp"], int)
        assert isinstance(data["current_level"], int)
        assert isinstance(data["level_name_greek"], str)
        assert isinstance(data["level_name_english"], str)
        assert isinstance(data["xp_in_level"], int)
        assert isinstance(data["xp_for_next_level"], int)
        assert isinstance(data["progress_percentage"], (int, float))

    @pytest.mark.asyncio
    @pytest.mark.e2e
    @pytest.mark.scenario
    async def test_xp_stats_unauthenticated_returns_401(self, client: AsyncClient) -> None:
        """Test that unauthenticated request returns 401."""
        response = await client.get("/api/v1/xp/stats")

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    @pytest.mark.scenario
    async def test_xp_stats_invalid_token_returns_401(self, client: AsyncClient) -> None:
        """Test that invalid token returns 401."""
        headers = {"Authorization": "Bearer invalid_token"}

        response = await client.get(
            "/api/v1/xp/stats",
            headers=headers,
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    @pytest.mark.scenario
    async def test_xp_stats_level_bounds(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that level is within valid bounds (1-15)."""
        response = await client.get(
            "/api/v1/xp/stats",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert 1 <= data["current_level"] <= 15
        assert 0 <= data["progress_percentage"] <= 100


class TestAchievementsEndpoint(E2ETestCase):
    """E2E tests for GET /api/v1/xp/achievements endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    @pytest.mark.scenario
    async def test_achievements_response_structure(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that achievements response has correct structure."""
        response = await client.get(
            "/api/v1/xp/achievements",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Top-level structure
        assert "achievements" in data
        assert "total_count" in data
        assert "unlocked_count" in data
        assert "total_xp_earned" in data

        # Type checks
        assert isinstance(data["achievements"], list)
        assert isinstance(data["total_count"], int)
        assert isinstance(data["unlocked_count"], int)
        assert isinstance(data["total_xp_earned"], int)

    @pytest.mark.asyncio
    @pytest.mark.e2e
    @pytest.mark.scenario
    async def test_achievements_item_structure(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that each achievement has required fields."""
        response = await client.get(
            "/api/v1/xp/achievements",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Should have at least some achievements defined
        assert len(data["achievements"]) > 0

        # Check first achievement has all required fields
        achievement = data["achievements"][0]
        required_fields = [
            "id",
            "name",
            "description",
            "category",
            "icon",
            "hint",
            "threshold",
            "xp_reward",
            "unlocked",
            "unlocked_at",
            "progress",
            "current_value",
        ]
        for field in required_fields:
            assert field in achievement, f"Missing field: {field}"

    @pytest.mark.asyncio
    @pytest.mark.e2e
    @pytest.mark.scenario
    async def test_achievements_new_user_none_unlocked(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that new user has no achievements unlocked."""
        response = await client.get(
            "/api/v1/xp/achievements",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # New user should have 0 unlocked
        assert data["unlocked_count"] == 0
        assert data["total_xp_earned"] == 0

        # All achievements should have unlocked=False
        for achievement in data["achievements"]:
            assert achievement["unlocked"] is False

    @pytest.mark.asyncio
    @pytest.mark.e2e
    @pytest.mark.scenario
    async def test_achievements_unauthenticated_returns_401(self, client: AsyncClient) -> None:
        """Test that unauthenticated request returns 401."""
        response = await client.get("/api/v1/xp/achievements")

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    @pytest.mark.scenario
    async def test_achievements_categories_present(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that achievements include expected categories."""
        response = await client.get(
            "/api/v1/xp/achievements",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Collect unique categories (lowercase as returned by API)
        categories = {a["category"].lower() for a in data["achievements"]}

        # Should have at least some categories
        assert len(categories) > 0

        # Check for expected categories (based on achievement_definitions.py)
        expected_categories = {"streak", "learning", "session", "accuracy"}
        # At least some of the expected categories should be present
        assert len(categories & expected_categories) > 0


class TestXPEndpointsHTTPMethods(E2ETestCase):
    """E2E tests for HTTP method handling on XP endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    @pytest.mark.scenario
    async def test_xp_stats_post_not_allowed(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that POST to stats returns 405."""
        response = await client.post(
            "/api/v1/xp/stats",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 405

    @pytest.mark.asyncio
    @pytest.mark.e2e
    @pytest.mark.scenario
    async def test_achievements_post_not_allowed(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that POST to achievements returns 405."""
        response = await client.post(
            "/api/v1/xp/achievements",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 405


class TestXPEndpointsResponseFormat(E2ETestCase):
    """E2E tests for XP endpoints response formatting."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    @pytest.mark.scenario
    async def test_xp_stats_response_is_json(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that XP stats response is JSON formatted."""
        response = await client.get(
            "/api/v1/xp/stats",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        assert "application/json" in response.headers.get("content-type", "")

        # Should be valid JSON
        data = response.json()
        assert isinstance(data, dict)

    @pytest.mark.asyncio
    @pytest.mark.e2e
    @pytest.mark.scenario
    async def test_achievements_response_is_json(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that achievements response is JSON formatted."""
        response = await client.get(
            "/api/v1/xp/achievements",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        assert "application/json" in response.headers.get("content-type", "")

        # Should be valid JSON
        data = response.json()
        assert isinstance(data, dict)
