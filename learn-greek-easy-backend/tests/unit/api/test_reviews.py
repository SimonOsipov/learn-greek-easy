"""Unit tests for review API endpoints.

These tests mock the ReviewRepository to test endpoint logic in isolation.
For full integration tests, see tests/integration/api/test_reviews_integration.py
"""

from datetime import date, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient

from src.db.models import CardStatus, Review
from src.schemas.sm2 import SM2BulkReviewResult, SM2ReviewResult


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

    @pytest.mark.asyncio
    async def test_submit_review_success(self, client: AsyncClient, auth_headers: dict, test_user):
        """Test successful review submission."""
        card_id = uuid4()
        mock_result = SM2ReviewResult(
            success=True,
            card_id=card_id,
            quality=4,
            previous_status=CardStatus.NEW,
            new_status=CardStatus.LEARNING,
            easiness_factor=2.5,
            interval=1,
            repetitions=1,
            next_review_date=date.today() + timedelta(days=1),
        )

        with (
            patch("src.api.v1.reviews.CardRepository") as mock_card_repo_class,
            patch("src.api.v1.reviews.SM2Service") as mock_service_class,
        ):
            mock_card = MagicMock()
            mock_card.deck.is_premium = False
            mock_card_repo = AsyncMock()
            mock_card_repo.get.return_value = mock_card
            mock_card_repo_class.return_value = mock_card_repo

            mock_service = AsyncMock()
            mock_service.process_review.return_value = mock_result
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/reviews",
                json={"card_id": str(card_id), "quality": 4, "time_taken": 10},
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["card_id"] == str(card_id)
            assert data["quality"] == 4
            assert data["new_status"] == "learning"

    @pytest.mark.asyncio
    async def test_submit_review_card_not_found_returns_404(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that non-existent card returns 404."""
        with patch("src.api.v1.reviews.CardRepository") as mock_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = None
            mock_class.return_value = mock_repo

            response = await client.post(
                "/api/v1/reviews",
                json={"card_id": str(uuid4()), "quality": 4, "time_taken": 10},
                headers=auth_headers,
            )

            assert response.status_code == 404
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_submit_review_invalid_quality_too_high_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that quality > 5 returns 422."""
        response = await client.post(
            "/api/v1/reviews",
            json={"card_id": str(uuid4()), "quality": 6, "time_taken": 10},
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_submit_review_invalid_quality_negative_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that quality < 0 returns 422."""
        response = await client.post(
            "/api/v1/reviews",
            json={"card_id": str(uuid4()), "quality": -1, "time_taken": 10},
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_submit_review_time_taken_at_max_accepted(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that time_taken at max (180 seconds) is accepted."""
        card_id = uuid4()
        mock_result = SM2ReviewResult(
            success=True,
            card_id=card_id,
            quality=4,
            previous_status=CardStatus.NEW,
            new_status=CardStatus.LEARNING,
            easiness_factor=2.5,
            interval=1,
            repetitions=1,
            next_review_date=date.today() + timedelta(days=1),
        )

        with (
            patch("src.api.v1.reviews.CardRepository") as mock_card_repo_class,
            patch("src.api.v1.reviews.SM2Service") as mock_service_class,
        ):
            mock_card = MagicMock()
            mock_card.deck.is_premium = False
            mock_card_repo = AsyncMock()
            mock_card_repo.get.return_value = mock_card
            mock_card_repo_class.return_value = mock_card_repo

            mock_service = AsyncMock()
            mock_service.process_review.return_value = mock_result
            mock_service_class.return_value = mock_service

            # Test with 180 seconds (3 minutes - max allowed)
            response = await client.post(
                "/api/v1/reviews",
                json={"card_id": str(card_id), "quality": 4, "time_taken": 180},
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True

    @pytest.mark.asyncio
    async def test_submit_review_invalid_time_negative_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that negative time_taken returns 422."""
        response = await client.post(
            "/api/v1/reviews",
            json={"card_id": str(uuid4()), "quality": 4, "time_taken": -1},
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"


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

    @pytest.mark.asyncio
    async def test_bulk_review_success(self, client: AsyncClient, auth_headers: dict):
        """Test successful bulk review submission."""
        card_id_1 = uuid4()
        card_id_2 = uuid4()
        deck_id = uuid4()

        mock_result = SM2BulkReviewResult(
            session_id="test-session",
            total_submitted=2,
            successful=2,
            failed=0,
            results=[
                SM2ReviewResult(
                    success=True,
                    card_id=card_id_1,
                    quality=4,
                    previous_status=CardStatus.NEW,
                    new_status=CardStatus.LEARNING,
                    easiness_factor=2.5,
                    interval=1,
                    repetitions=1,
                    next_review_date=date.today() + timedelta(days=1),
                ),
                SM2ReviewResult(
                    success=True,
                    card_id=card_id_2,
                    quality=5,
                    previous_status=CardStatus.LEARNING,
                    new_status=CardStatus.REVIEW,
                    easiness_factor=2.6,
                    interval=6,
                    repetitions=2,
                    next_review_date=date.today() + timedelta(days=6),
                ),
            ],
        )

        with patch("src.api.v1.reviews.SM2Service") as mock_class:
            mock_service = AsyncMock()
            mock_service.process_bulk_reviews.return_value = mock_result
            mock_class.return_value = mock_service

            response = await client.post(
                "/api/v1/reviews/bulk",
                json={
                    "deck_id": str(deck_id),
                    "session_id": "test-session",
                    "reviews": [
                        {"card_id": str(card_id_1), "quality": 4, "time_taken": 10},
                        {"card_id": str(card_id_2), "quality": 5, "time_taken": 8},
                    ],
                },
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["session_id"] == "test-session"
            assert data["total_submitted"] == 2
            assert data["successful"] == 2
            assert data["failed"] == 0
            assert len(data["results"]) == 2

    @pytest.mark.asyncio
    async def test_bulk_review_partial_failure(self, client: AsyncClient, auth_headers: dict):
        """Test bulk review with partial failures."""
        card_id_1 = uuid4()
        card_id_2 = uuid4()
        deck_id = uuid4()

        mock_result = SM2BulkReviewResult(
            session_id="test-session",
            total_submitted=2,
            successful=1,
            failed=1,
            results=[
                SM2ReviewResult(
                    success=True,
                    card_id=card_id_1,
                    quality=4,
                    previous_status=CardStatus.NEW,
                    new_status=CardStatus.LEARNING,
                    easiness_factor=2.5,
                    interval=1,
                    repetitions=1,
                    next_review_date=date.today() + timedelta(days=1),
                ),
            ],
        )

        with patch("src.api.v1.reviews.SM2Service") as mock_class:
            mock_service = AsyncMock()
            mock_service.process_bulk_reviews.return_value = mock_result
            mock_class.return_value = mock_service

            response = await client.post(
                "/api/v1/reviews/bulk",
                json={
                    "deck_id": str(deck_id),
                    "session_id": "test-session",
                    "reviews": [
                        {"card_id": str(card_id_1), "quality": 4, "time_taken": 10},
                        {"card_id": str(card_id_2), "quality": 5, "time_taken": 8},
                    ],
                },
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["successful"] == 1
            assert data["failed"] == 1

    @pytest.mark.asyncio
    async def test_bulk_review_empty_reviews_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that empty reviews array returns 422."""
        response = await client.post(
            "/api/v1/reviews/bulk",
            json={
                "deck_id": str(uuid4()),
                "session_id": "test-session",
                "reviews": [],
            },
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_bulk_review_too_many_reviews_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that more than 100 reviews returns 422."""
        reviews = [{"card_id": str(uuid4()), "quality": 4, "time_taken": 10} for _ in range(101)]

        response = await client.post(
            "/api/v1/reviews/bulk",
            json={
                "deck_id": str(uuid4()),
                "session_id": "test-session",
                "reviews": reviews,
            },
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_bulk_review_invalid_quality_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that invalid quality in bulk review returns 422."""
        response = await client.post(
            "/api/v1/reviews/bulk",
            json={
                "deck_id": str(uuid4()),
                "session_id": "test-session",
                "reviews": [{"card_id": str(uuid4()), "quality": 6, "time_taken": 10}],
            },
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_bulk_review_time_taken_at_max_accepted(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that time_taken at max (180 seconds) in bulk review is accepted."""
        card_id = uuid4()
        deck_id = uuid4()

        mock_result = SM2BulkReviewResult(
            session_id="test-session",
            total_submitted=1,
            successful=1,
            failed=0,
            results=[
                SM2ReviewResult(
                    success=True,
                    card_id=card_id,
                    quality=4,
                    previous_status=CardStatus.NEW,
                    new_status=CardStatus.LEARNING,
                    easiness_factor=2.5,
                    interval=1,
                    repetitions=1,
                    next_review_date=date.today() + timedelta(days=1),
                ),
            ],
        )

        with patch("src.api.v1.reviews.SM2Service") as mock_class:
            mock_service = AsyncMock()
            mock_service.process_bulk_reviews.return_value = mock_result
            mock_class.return_value = mock_service

            response = await client.post(
                "/api/v1/reviews/bulk",
                json={
                    "deck_id": str(deck_id),
                    "session_id": "test-session",
                    "reviews": [{"card_id": str(card_id), "quality": 4, "time_taken": 180}],
                },
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["successful"] == 1
