"""Integration tests for XP and Achievements API endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories.xp_achievements import UserAchievementFactory, UserXPFactory


@pytest.mark.integration
class TestXPStatsEndpoint:
    """Tests for GET /api/v1/xp/stats endpoint."""

    @pytest.mark.asyncio
    async def test_stats_requires_authentication(
        self,
        client: AsyncClient,
    ):
        """Stats endpoint should return 401 without authentication."""
        response = await client.get("/api/v1/xp/stats")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_stats_new_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """New user should get stats with level 1 and zero XP."""
        response = await client.get(
            "/api/v1/xp/stats",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["total_xp"] == 0
        assert data["current_level"] == 1
        assert data["level_name_greek"] == "Αρχάριος"
        assert data["level_name_english"] == "Beginner"
        assert data["xp_in_level"] == 0
        assert data["xp_for_next_level"] == 100
        assert data["progress_percentage"] == 0.0

    @pytest.mark.asyncio
    async def test_stats_with_xp(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """User with XP should show correct level and progress."""
        # Create UserXP with some XP
        await UserXPFactory.create_async(
            db_session,
            user_id=test_user.id,
            total_xp=500,
            current_level=3,
        )
        await db_session.commit()

        response = await client.get(
            "/api/v1/xp/stats",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["total_xp"] == 500
        assert data["current_level"] == 3
        assert data["level_name_greek"] == "Σπουδαστής"
        assert data["level_name_english"] == "Learner"


@pytest.mark.integration
class TestAchievementsEndpoint:
    """Tests for GET /api/v1/xp/achievements endpoint."""

    @pytest.mark.asyncio
    async def test_achievements_requires_authentication(
        self,
        client: AsyncClient,
    ):
        """Achievements endpoint should return 401 without authentication."""
        response = await client.get("/api/v1/xp/achievements")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_achievements_returns_all(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Should return all achievements with progress info."""
        response = await client.get(
            "/api/v1/xp/achievements",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert "achievements" in data
        assert "total_count" in data
        assert "unlocked_count" in data
        assert "total_xp_earned" in data

        # Should have achievements defined
        assert data["total_count"] > 0
        assert len(data["achievements"]) == data["total_count"]

        # Check achievement structure
        if data["achievements"]:
            ach = data["achievements"][0]
            assert "id" in ach
            assert "name" in ach
            assert "description" in ach
            assert "category" in ach
            assert "icon" in ach
            assert "threshold" in ach
            assert "xp_reward" in ach
            assert "unlocked" in ach
            assert "progress" in ach


@pytest.mark.integration
class TestUnnotifiedAchievementsEndpoint:
    """Tests for GET /api/v1/xp/achievements/unnotified endpoint."""

    @pytest.mark.asyncio
    async def test_unnotified_requires_authentication(
        self,
        client: AsyncClient,
    ):
        """Unnotified endpoint should return 401 without authentication."""
        response = await client.get("/api/v1/xp/achievements/unnotified")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_unnotified_empty_for_new_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """New user should have no unnotified achievements."""
        response = await client.get(
            "/api/v1/xp/achievements/unnotified",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["achievements"] == []
        assert data["count"] == 0

    @pytest.mark.asyncio
    async def test_unnotified_returns_unlocked(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Should return unnotified achievements."""
        # Create an unnotified achievement
        from src.db.models import Achievement, AchievementCategory

        # First ensure the achievement exists in DB
        achievement = Achievement(
            id="streak_3",
            name="Getting Started",
            description="Maintain a 3-day study streak",
            category=AchievementCategory.STREAK,
            icon="flame",
            threshold=3,
            xp_reward=50,
            sort_order=1,
        )
        db_session.add(achievement)
        await db_session.flush()

        await UserAchievementFactory.create_async(
            db_session,
            user_id=test_user.id,
            achievement_id="streak_3",
            notified=False,
        )
        await db_session.commit()

        response = await client.get(
            "/api/v1/xp/achievements/unnotified",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        assert data["count"] == 1
        assert len(data["achievements"]) == 1
        assert data["achievements"][0]["id"] == "streak_3"


@pytest.mark.integration
class TestMarkNotifiedEndpoint:
    """Tests for POST /api/v1/xp/achievements/notified endpoint."""

    @pytest.mark.asyncio
    async def test_notified_requires_authentication(
        self,
        client: AsyncClient,
    ):
        """Notified endpoint should return 401 without authentication."""
        response = await client.post(
            "/api/v1/xp/achievements/notified",
            json={"achievement_ids": ["streak_3"]},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_notified_requires_achievement_ids(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Should require achievement_ids in request body."""
        response = await client.post(
            "/api/v1/xp/achievements/notified",
            headers=auth_headers,
            json={},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_notified_empty_list_rejected(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Empty achievement_ids list should be rejected."""
        response = await client.post(
            "/api/v1/xp/achievements/notified",
            headers=auth_headers,
            json={"achievement_ids": []},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_notified_marks_achievements(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Should mark achievements as notified."""
        # Create an unnotified achievement
        from src.db.models import Achievement, AchievementCategory

        achievement = Achievement(
            id="streak_7",
            name="Week Warrior",
            description="Maintain a 7-day study streak",
            category=AchievementCategory.STREAK,
            icon="medal",
            threshold=7,
            xp_reward=100,
            sort_order=2,
        )
        db_session.add(achievement)
        await db_session.flush()

        await UserAchievementFactory.create_async(
            db_session,
            user_id=test_user.id,
            achievement_id="streak_7",
            notified=False,
        )
        await db_session.commit()

        # Mark as notified
        response = await client.post(
            "/api/v1/xp/achievements/notified",
            headers=auth_headers,
            json={"achievement_ids": ["streak_7"]},
        )
        assert response.status_code == 200
        data = response.json()

        assert data["marked_count"] == 1
        assert data["success"] is True

        # Verify it's no longer in unnotified list
        response = await client.get(
            "/api/v1/xp/achievements/unnotified",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 0
