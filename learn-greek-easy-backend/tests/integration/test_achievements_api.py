"""Integration tests for the Achievements API.

This module tests the achievements endpoint with real database transactions.

Test Classes:
- TestAchievementsEndpoint: Basic endpoint tests (auth, response structure)
- TestAchievementsProgress: Verify achievement progress calculation with real data
"""

import pytest
from httpx import AsyncClient

from src.services.achievements import ACHIEVEMENTS


@pytest.mark.integration
class TestAchievementsEndpoint:
    """Basic tests for the /progress/achievements endpoint."""

    @pytest.mark.asyncio
    async def test_achievements_endpoint_authenticated(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """Authenticated users should be able to access achievements."""
        response = await client.get(
            f"{progress_url}/achievements",
            headers=auth_headers,
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_achievements_endpoint_unauthenticated(
        self,
        client: AsyncClient,
        progress_url: str,
    ):
        """Unauthenticated requests should return 401."""
        response = await client.get(f"{progress_url}/achievements")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_achievement_response_structure(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """Response should have correct structure."""
        response = await client.get(
            f"{progress_url}/achievements",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Check top-level fields
        assert "achievements" in data
        assert "total_points" in data
        assert "next_milestone" in data

        # Check achievements is a list
        assert isinstance(data["achievements"], list)

        # Check total_points is non-negative
        assert isinstance(data["total_points"], int)
        assert data["total_points"] >= 0

    @pytest.mark.asyncio
    async def test_achievement_item_structure(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """Each achievement should have correct structure."""
        response = await client.get(
            f"{progress_url}/achievements",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Should have at least one achievement
        assert len(data["achievements"]) > 0

        # Check first achievement structure
        achievement = data["achievements"][0]
        assert "id" in achievement
        assert "name" in achievement
        assert "description" in achievement
        assert "icon" in achievement
        assert "unlocked" in achievement
        assert "unlocked_at" in achievement
        assert "progress" in achievement
        assert "points" in achievement

        # Validate types
        assert isinstance(achievement["id"], str)
        assert isinstance(achievement["name"], str)
        assert isinstance(achievement["unlocked"], bool)
        assert isinstance(achievement["progress"], (int, float))
        assert isinstance(achievement["points"], int)

    @pytest.mark.asyncio
    async def test_all_defined_achievements_returned(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """Should return all defined achievements."""
        response = await client.get(
            f"{progress_url}/achievements",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Count should match ACHIEVEMENTS definition
        assert len(data["achievements"]) == len(ACHIEVEMENTS)

        # All IDs should be present
        returned_ids = {a["id"] for a in data["achievements"]}
        expected_ids = {a.id for a in ACHIEVEMENTS}
        assert returned_ids == expected_ids


@pytest.mark.integration
class TestAchievementsNewUser:
    """Tests for new user with no activity."""

    @pytest.mark.asyncio
    async def test_new_user_no_unlocked_achievements(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """New user should have no unlocked achievements."""
        response = await client.get(
            f"{progress_url}/achievements",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # All achievements should be locked
        unlocked_count = sum(1 for a in data["achievements"] if a["unlocked"])
        assert unlocked_count == 0

    @pytest.mark.asyncio
    async def test_new_user_zero_points(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """New user should have 0 total points."""
        response = await client.get(
            f"{progress_url}/achievements",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["total_points"] == 0

    @pytest.mark.asyncio
    async def test_new_user_has_next_milestone(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """New user should have a next milestone to achieve."""
        response = await client.get(
            f"{progress_url}/achievements",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Should have a next milestone (since none are unlocked)
        assert data["next_milestone"] is not None
        milestone = data["next_milestone"]
        assert "id" in milestone
        assert "name" in milestone
        assert "progress" in milestone
        assert "remaining" in milestone

    @pytest.mark.asyncio
    async def test_achievement_progress_is_zero_for_new_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """New user should have 0% progress on achievements."""
        response = await client.get(
            f"{progress_url}/achievements",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # All achievements should have 0% progress
        for achievement in data["achievements"]:
            assert achievement["progress"] == 0.0
            assert achievement["points"] == 0  # No points until unlocked


@pytest.mark.integration
class TestAchievementsNextMilestone:
    """Tests for next milestone calculation."""

    @pytest.mark.asyncio
    async def test_next_milestone_structure(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """Next milestone should have correct structure."""
        response = await client.get(
            f"{progress_url}/achievements",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        if data["next_milestone"]:
            milestone = data["next_milestone"]
            assert isinstance(milestone["id"], str)
            assert isinstance(milestone["name"], str)
            assert isinstance(milestone["progress"], (int, float))
            assert isinstance(milestone["remaining"], int)
            assert milestone["remaining"] >= 0

    @pytest.mark.asyncio
    async def test_next_milestone_is_not_unlocked(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """Next milestone should reference an unlocked achievement."""
        response = await client.get(
            f"{progress_url}/achievements",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        if data["next_milestone"]:
            milestone_id = data["next_milestone"]["id"]
            # Find this achievement in the list
            matching = [a for a in data["achievements"] if a["id"] == milestone_id]
            assert len(matching) == 1
            # Should not be unlocked
            assert matching[0]["unlocked"] is False


@pytest.mark.integration
class TestAchievementsProgress:
    """Tests for achievement progress calculation logic."""

    @pytest.mark.asyncio
    async def test_progress_bounded_0_to_100(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """Progress should be between 0 and 100."""
        response = await client.get(
            f"{progress_url}/achievements",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        for achievement in data["achievements"]:
            assert 0 <= achievement["progress"] <= 100

    @pytest.mark.asyncio
    async def test_unlocked_achievements_have_100_progress(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """Unlocked achievements should have 100% progress."""
        response = await client.get(
            f"{progress_url}/achievements",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        for achievement in data["achievements"]:
            if achievement["unlocked"]:
                assert achievement["progress"] == 100.0

    @pytest.mark.asyncio
    async def test_points_only_for_unlocked(
        self,
        client: AsyncClient,
        auth_headers: dict,
        progress_url: str,
    ):
        """Only unlocked achievements should contribute points."""
        response = await client.get(
            f"{progress_url}/achievements",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        for achievement in data["achievements"]:
            if not achievement["unlocked"]:
                assert achievement["points"] == 0
