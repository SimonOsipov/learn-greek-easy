"""Unit tests for study API endpoints.

These tests mock the SM2Service and ReviewRepository to test endpoint logic in isolation.
For full integration tests, see tests/integration/api/test_study.py
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient


class TestGetStudyStatsUnit:
    """Unit tests for GET /api/v1/study/stats endpoint."""

    @pytest.mark.asyncio
    async def test_get_study_stats_unauthenticated_returns_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        response = await client.get("/api/v1/study/stats")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_get_study_stats_returns_correct_structure(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that endpoint returns correct response structure."""
        mock_stats = {
            "by_status": {"new": 10, "learning": 5, "review": 20, "mastered": 15, "due": 8},
            "reviews_today": 12,
            "current_streak": 5,
            "due_today": 8,
        }

        with (
            patch("src.api.v1.study.SM2Service") as mock_service_class,
            patch("src.api.v1.study.ReviewRepository") as mock_repo_class,
        ):
            mock_service = AsyncMock()
            mock_service.get_study_stats.return_value = mock_stats
            mock_service_class.return_value = mock_service

            mock_repo = AsyncMock()
            mock_repo.get_total_reviews.return_value = 150
            mock_repo.get_total_study_time.return_value = 3600
            mock_repo.get_average_quality.return_value = 3.8
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/study/stats", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            assert "by_status" in data
            assert "reviews_today" in data
            assert "current_streak" in data
            assert "due_today" in data
            assert "total_reviews" in data
            assert "total_study_time" in data
            assert "average_quality" in data
            assert data["total_reviews"] == 150
            assert data["total_study_time"] == 3600
            assert data["average_quality"] == 3.8

    @pytest.mark.asyncio
    async def test_get_study_stats_with_deck_id_filter(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that deck_id filter is passed to service."""
        deck_id = uuid4()
        mock_stats = {
            "by_status": {"new": 5, "learning": 3, "review": 10, "mastered": 7, "due": 4},
            "reviews_today": 5,
            "current_streak": 3,
            "due_today": 4,
        }

        with (
            patch("src.api.v1.study.SM2Service") as mock_service_class,
            patch("src.api.v1.study.ReviewRepository") as mock_repo_class,
        ):
            mock_service = AsyncMock()
            mock_service.get_study_stats.return_value = mock_stats
            mock_service_class.return_value = mock_service

            mock_repo = AsyncMock()
            mock_repo.get_total_reviews.return_value = 50
            mock_repo.get_total_study_time.return_value = 1200
            mock_repo.get_average_quality.return_value = 4.0
            mock_repo_class.return_value = mock_repo

            response = await client.get(
                f"/api/v1/study/stats?deck_id={deck_id}",
                headers=auth_headers,
            )

            assert response.status_code == 200
            mock_service.get_study_stats.assert_called_once()
            call_args = mock_service.get_study_stats.call_args
            assert call_args[0][1] == deck_id  # Second positional arg is deck_id

    @pytest.mark.asyncio
    async def test_get_study_stats_invalid_deck_id_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that invalid deck_id format returns 422."""
        response = await client.get(
            "/api/v1/study/stats?deck_id=invalid-uuid",
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_get_study_stats_calls_repository_methods(
        self, client: AsyncClient, auth_headers: dict, test_user
    ):
        """Test that repository analytics methods are called with correct user_id."""
        mock_stats = {
            "by_status": {"new": 10, "learning": 5, "review": 20, "mastered": 15, "due": 8},
            "reviews_today": 12,
            "current_streak": 5,
            "due_today": 8,
        }

        with (
            patch("src.api.v1.study.SM2Service") as mock_service_class,
            patch("src.api.v1.study.ReviewRepository") as mock_repo_class,
        ):
            mock_service = AsyncMock()
            mock_service.get_study_stats.return_value = mock_stats
            mock_service_class.return_value = mock_service

            mock_repo = AsyncMock()
            mock_repo.get_total_reviews.return_value = 100
            mock_repo.get_total_study_time.return_value = 5000
            mock_repo.get_average_quality.return_value = 4.2
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/study/stats", headers=auth_headers)

            assert response.status_code == 200

            # Verify all repository methods were called with user_id
            mock_repo.get_total_reviews.assert_called_once_with(test_user.id)
            mock_repo.get_total_study_time.assert_called_once_with(test_user.id)
            mock_repo.get_average_quality.assert_called_once_with(test_user.id)

    @pytest.mark.asyncio
    async def test_get_study_stats_empty_stats_returns_zeros(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that empty stats return zero values."""
        mock_stats = {
            "by_status": {"new": 0, "learning": 0, "review": 0, "mastered": 0, "due": 0},
            "reviews_today": 0,
            "current_streak": 0,
            "due_today": 0,
        }

        with (
            patch("src.api.v1.study.SM2Service") as mock_service_class,
            patch("src.api.v1.study.ReviewRepository") as mock_repo_class,
        ):
            mock_service = AsyncMock()
            mock_service.get_study_stats.return_value = mock_stats
            mock_service_class.return_value = mock_service

            mock_repo = AsyncMock()
            mock_repo.get_total_reviews.return_value = 0
            mock_repo.get_total_study_time.return_value = 0
            mock_repo.get_average_quality.return_value = 0.0
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/study/stats", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            assert data["reviews_today"] == 0
            assert data["current_streak"] == 0
            assert data["due_today"] == 0
            assert data["total_reviews"] == 0
            assert data["total_study_time"] == 0
            assert data["average_quality"] == 0.0


class TestGetStudyQueueUnit:
    """Unit tests for GET /api/v1/study/queue endpoint."""

    @pytest.mark.asyncio
    async def test_get_study_queue_unauthenticated_returns_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        response = await client.get("/api/v1/study/queue")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False


class TestGetDeckStudyQueueUnit:
    """Unit tests for GET /api/v1/study/queue/{deck_id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_deck_study_queue_unauthenticated_returns_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        deck_id = uuid4()
        response = await client.get(f"/api/v1/study/queue/{deck_id}")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False
