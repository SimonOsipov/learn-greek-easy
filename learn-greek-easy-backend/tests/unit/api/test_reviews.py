"""Unit tests for review API endpoints.

These tests mock the ReviewRepository to test endpoint logic in isolation.
For full integration tests, see tests/integration/api/test_reviews_integration.py
"""

from datetime import date, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient

from src.db.models import Review


class TestGetReviewHistoryUnit:
    """Unit tests for GET /api/v1/reviews endpoint."""

    @pytest.mark.asyncio
    async def test_get_review_history_unauthenticated_returns_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        response = await client.get("/api/v1/reviews")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_get_review_history_returns_paginated_response(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that endpoint returns correct paginated response structure."""
        # Create mock reviews
        mock_review = MagicMock(spec=Review)
        mock_review.id = uuid4()
        mock_review.user_id = uuid4()
        mock_review.card_id = uuid4()
        mock_review.quality = 4
        mock_review.time_taken = 15
        mock_review.reviewed_at = datetime.utcnow()

        with patch("src.api.v1.reviews.ReviewRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get_user_reviews.return_value = [mock_review]
            mock_repo.count_user_reviews.return_value = 1
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/reviews", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            assert "total" in data
            assert "page" in data
            assert "page_size" in data
            assert "reviews" in data
            assert data["total"] == 1
            assert data["page"] == 1
            assert data["page_size"] == 50  # Default
            assert len(data["reviews"]) == 1

    @pytest.mark.asyncio
    async def test_get_review_history_with_date_filters(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that date filters are passed to repository."""
        with patch("src.api.v1.reviews.ReviewRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get_user_reviews.return_value = []
            mock_repo.count_user_reviews.return_value = 0
            mock_repo_class.return_value = mock_repo

            response = await client.get(
                "/api/v1/reviews?start_date=2024-01-01&end_date=2024-01-31",
                headers=auth_headers,
            )

            assert response.status_code == 200

            # Verify repository was called with date filters
            mock_repo.get_user_reviews.assert_called_once()
            call_kwargs = mock_repo.get_user_reviews.call_args.kwargs
            assert call_kwargs["start_date"] == date(2024, 1, 1)
            assert call_kwargs["end_date"] == date(2024, 1, 31)

            # Verify count was called with same filters
            mock_repo.count_user_reviews.assert_called_once()
            count_call_kwargs = mock_repo.count_user_reviews.call_args.kwargs
            assert count_call_kwargs["start_date"] == date(2024, 1, 1)
            assert count_call_kwargs["end_date"] == date(2024, 1, 31)

    @pytest.mark.asyncio
    async def test_get_review_history_pagination_params(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that pagination parameters are passed correctly."""
        with patch("src.api.v1.reviews.ReviewRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get_user_reviews.return_value = []
            mock_repo.count_user_reviews.return_value = 100
            mock_repo_class.return_value = mock_repo

            response = await client.get(
                "/api/v1/reviews?page=3&page_size=20",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["page"] == 3
            assert data["page_size"] == 20

            # Verify skip and limit are calculated correctly
            mock_repo.get_user_reviews.assert_called_once()
            call_kwargs = mock_repo.get_user_reviews.call_args.kwargs
            assert call_kwargs["skip"] == 40  # (page 3 - 1) * page_size 20
            assert call_kwargs["limit"] == 20

    @pytest.mark.asyncio
    async def test_get_review_history_invalid_page_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that invalid page number returns 422."""
        response = await client.get("/api/v1/reviews?page=0", headers=auth_headers)
        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_get_review_history_negative_page_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that negative page number returns 422."""
        response = await client.get("/api/v1/reviews?page=-1", headers=auth_headers)
        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_get_review_history_invalid_page_size_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that invalid page size returns 422."""
        # page_size > 100
        response = await client.get("/api/v1/reviews?page_size=101", headers=auth_headers)
        assert response.status_code == 422

        # page_size = 0
        response = await client.get("/api/v1/reviews?page_size=0", headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_review_history_invalid_date_format_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that invalid date format returns 422."""
        response = await client.get(
            "/api/v1/reviews?start_date=invalid-date",
            headers=auth_headers,
        )
        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_get_review_history_empty_returns_empty_list(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that empty review history returns empty list with correct structure."""
        with patch("src.api.v1.reviews.ReviewRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get_user_reviews.return_value = []
            mock_repo.count_user_reviews.return_value = 0
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/reviews", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 0
            assert data["reviews"] == []

    @pytest.mark.asyncio
    async def test_get_review_history_calls_repository_with_user_id(
        self, client: AsyncClient, auth_headers: dict, test_user
    ):
        """Test that repository is called with correct user ID from token."""
        with patch("src.api.v1.reviews.ReviewRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get_user_reviews.return_value = []
            mock_repo.count_user_reviews.return_value = 0
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/reviews", headers=auth_headers)

            assert response.status_code == 200

            # Verify user_id from authenticated user is passed to repository
            mock_repo.get_user_reviews.assert_called_once()
            call_kwargs = mock_repo.get_user_reviews.call_args.kwargs
            assert call_kwargs["user_id"] == test_user.id

            mock_repo.count_user_reviews.assert_called_once()
            count_call_kwargs = mock_repo.count_user_reviews.call_args.kwargs
            assert count_call_kwargs["user_id"] == test_user.id

    @pytest.mark.asyncio
    async def test_get_review_history_response_contains_review_fields(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that response includes all expected review fields."""
        review_id = uuid4()
        user_id = uuid4()
        card_id = uuid4()
        reviewed_at = datetime.utcnow()

        mock_review = MagicMock(spec=Review)
        mock_review.id = review_id
        mock_review.user_id = user_id
        mock_review.card_id = card_id
        mock_review.quality = 5
        mock_review.time_taken = 20
        mock_review.reviewed_at = reviewed_at

        with patch("src.api.v1.reviews.ReviewRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get_user_reviews.return_value = [mock_review]
            mock_repo.count_user_reviews.return_value = 1
            mock_repo_class.return_value = mock_repo

            response = await client.get("/api/v1/reviews", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            review = data["reviews"][0]

            assert review["id"] == str(review_id)
            assert review["user_id"] == str(user_id)
            assert review["card_id"] == str(card_id)
            assert review["quality"] == 5
            assert review["time_taken"] == 20
            assert "reviewed_at" in review


class TestSubmitReviewUnit:
    """Unit tests for POST /api/v1/reviews endpoint."""

    @pytest.mark.asyncio
    async def test_submit_review_unauthorized_returns_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        review_data = {"card_id": str(uuid4()), "quality": 4, "time_taken": 10}

        response = await client.post("/api/v1/reviews", json=review_data)

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False


class TestBulkReviewUnit:
    """Unit tests for POST /api/v1/reviews/bulk endpoint."""

    @pytest.mark.asyncio
    async def test_bulk_review_unauthorized_returns_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        bulk_data = {
            "deck_id": str(uuid4()),
            "session_id": "test-session",
            "reviews": [{"card_id": str(uuid4()), "quality": 4, "time_taken": 10}],
        }

        response = await client.post("/api/v1/reviews/bulk", json=bulk_data)

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False
