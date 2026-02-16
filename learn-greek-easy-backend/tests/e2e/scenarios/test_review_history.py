"""E2E tests for review history endpoint.

These tests verify the review history API through real HTTP requests,
covering:
- GET /api/v1/reviews
- Pagination (page, page_size)
- Date filtering (start_date, end_date)
- Response structure validation
- Authentication requirements

Run with:
    pytest tests/e2e/scenarios/test_review_history.py -v
"""

from datetime import date, timedelta

import pytest
from httpx import AsyncClient

from tests.e2e.conftest import E2ETestCase, UserSession


class TestReviewHistoryBasic(E2ETestCase):
    """E2E tests for basic review history functionality."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_review_history_empty_user(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that new user has empty review history."""
        response = await client.get(
            "/api/v1/reviews",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["reviews"] == []

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_review_history_response_structure(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that response has correct structure."""
        response = await client.get(
            "/api/v1/reviews",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Required fields
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "reviews" in data
        assert isinstance(data["reviews"], list)


class TestReviewHistoryPagination(E2ETestCase):
    """E2E tests for review history pagination."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_review_history_default_pagination(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test default pagination values."""
        response = await client.get(
            "/api/v1/reviews",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 50  # Default

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_review_history_custom_page_size(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test custom page_size parameter."""
        response = await client.get(
            "/api/v1/reviews",
            params={"page_size": 10},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page_size"] == 10

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_review_history_page_parameter(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test page parameter."""
        response = await client.get(
            "/api/v1/reviews",
            params={"page": 2},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 2

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_review_history_page_zero_returns_422(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that page=0 returns 422 validation error."""
        response = await client.get(
            "/api/v1/reviews",
            params={"page": 0},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_review_history_negative_page_returns_422(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that negative page returns 422 validation error."""
        response = await client.get(
            "/api/v1/reviews",
            params={"page": -1},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_review_history_page_size_exceeds_max_returns_422(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that page_size > 100 returns 422 validation error."""
        response = await client.get(
            "/api/v1/reviews",
            params={"page_size": 150},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_review_history_page_size_zero_returns_422(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that page_size=0 returns 422 validation error."""
        response = await client.get(
            "/api/v1/reviews",
            params={"page_size": 0},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 422


class TestReviewHistoryDateFilters(E2ETestCase):
    """E2E tests for review history date filtering."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_review_history_start_date_filter(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test filtering by start_date."""
        start_date = (date.today() - timedelta(days=7)).isoformat()

        response = await client.get(
            "/api/v1/reviews",
            params={"start_date": start_date},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_review_history_end_date_filter(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test filtering by end_date."""
        end_date = date.today().isoformat()

        response = await client.get(
            "/api/v1/reviews",
            params={"end_date": end_date},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_review_history_date_range_filter(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test filtering by both start_date and end_date."""
        start_date = (date.today() - timedelta(days=30)).isoformat()
        end_date = date.today().isoformat()

        response = await client.get(
            "/api/v1/reviews",
            params={"start_date": start_date, "end_date": end_date},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_review_history_invalid_date_format_returns_422(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that invalid date format returns 422."""
        response = await client.get(
            "/api/v1/reviews",
            params={"start_date": "not-a-date"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_review_history_partial_date_format_returns_422(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that partial date format returns 422."""
        response = await client.get(
            "/api/v1/reviews",
            params={"start_date": "2024-01"},  # Missing day
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_review_history_future_date_filter(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test filtering with future date (should return empty)."""
        future_date = (date.today() + timedelta(days=30)).isoformat()

        response = await client.get(
            "/api/v1/reviews",
            params={"start_date": future_date},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0


class TestReviewHistoryAuthentication(E2ETestCase):
    """E2E tests for review history authentication."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_review_history_unauthenticated_returns_401(self, client: AsyncClient) -> None:
        """Test that unauthenticated request returns 401."""
        response = await client.get("/api/v1/reviews")

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_review_history_invalid_token_returns_401(self, client: AsyncClient) -> None:
        """Test that invalid token returns 401."""
        headers = {"Authorization": "Bearer invalid_token"}

        response = await client.get(
            "/api/v1/reviews",
            headers=headers,
        )

        assert response.status_code == 401


class TestReviewHistoryHttpMethods(E2ETestCase):
    """E2E tests for review history HTTP method handling."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_review_history_put_method_not_allowed(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that PUT method returns 405."""
        response = await client.put(
            "/api/v1/reviews",
            json={},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 405

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_review_history_delete_method_not_allowed(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that DELETE method returns 405."""
        response = await client.delete(
            "/api/v1/reviews",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 405

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_review_history_patch_method_not_allowed(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that PATCH method returns 405."""
        response = await client.patch(
            "/api/v1/reviews",
            json={},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 405


class TestReviewHistoryResponseFormat(E2ETestCase):
    """E2E tests for review history response formatting."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_review_history_response_is_json(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that response is JSON formatted."""
        response = await client.get(
            "/api/v1/reviews",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        assert "application/json" in response.headers.get("content-type", "")

        # Should be valid JSON
        data = response.json()
        assert isinstance(data, dict)

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_review_history_total_is_integer(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that total field is an integer."""
        response = await client.get(
            "/api/v1/reviews",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["total"], int)
        assert data["total"] >= 0
