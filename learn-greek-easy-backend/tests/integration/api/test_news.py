"""Integration tests for public news API endpoints.

This module tests the public news endpoints:
- GET /api/v1/news - List news items with pagination
- GET /api/v1/news/{id} - Get a single news item

Tests cover:
- Success cases (200)
- Not found cases (404)
- Validation errors (422)
- Pagination
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import NewsItemFactory

# =============================================================================
# List News Items Endpoint Tests
# =============================================================================


class TestListNewsEndpoint:
    """Test suite for GET /api/v1/news endpoint."""

    @pytest.mark.asyncio
    async def test_list_news_returns_200(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Test that listing news items returns 200 OK."""
        # Create a news item
        await NewsItemFactory.create()

        response = await client.get("/api/v1/news")

        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "items" in data
        assert isinstance(data["items"], list)
        assert len(data["items"]) >= 1

    @pytest.mark.asyncio
    async def test_list_news_pagination(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Test pagination works correctly."""
        # Create 5 news items
        for _ in range(5):
            await NewsItemFactory.create()

        # Get first page of 2
        response = await client.get("/api/v1/news?page=1&page_size=2")

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert len(data["items"]) == 2
        assert data["total"] >= 5

        # Get second page
        response2 = await client.get("/api/v1/news?page=2&page_size=2")

        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["page"] == 2
        assert len(data2["items"]) == 2

        # Verify different items on each page
        page1_ids = {item["id"] for item in data["items"]}
        page2_ids = {item["id"] for item in data2["items"]}
        assert page1_ids.isdisjoint(page2_ids)

    @pytest.mark.asyncio
    async def test_list_news_empty(
        self,
        client: AsyncClient,
    ):
        """Test listing returns empty list when no news items exist."""
        response = await client.get("/api/v1/news")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["items"] == []

    @pytest.mark.asyncio
    async def test_list_news_response_structure(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Test that response has all expected fields including card info."""
        await NewsItemFactory.create()

        response = await client.get("/api/v1/news")

        assert response.status_code == 200
        data = response.json()
        item = data["items"][0]

        # Check all expected fields
        assert "id" in item
        assert "title_el" in item
        assert "title_en" in item
        assert "title_ru" in item
        assert "description_el" in item
        assert "description_en" in item
        assert "description_ru" in item
        assert "publication_date" in item
        assert "original_article_url" in item
        assert "image_url" in item
        assert "created_at" in item
        assert "updated_at" in item
        # Card info fields (may be null if no associated card)
        assert "card_id" in item
        assert "deck_id" in item

    @pytest.mark.asyncio
    async def test_list_news_page_size_validation(
        self,
        client: AsyncClient,
    ):
        """Test that page_size > 50 returns 422."""
        response = await client.get("/api/v1/news?page_size=51")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_news_page_validation(
        self,
        client: AsyncClient,
    ):
        """Test that page < 1 returns 422."""
        response = await client.get("/api/v1/news?page=0")

        assert response.status_code == 422


# =============================================================================
# Get News Item Endpoint Tests
# =============================================================================


class TestGetNewsItemEndpoint:
    """Test suite for GET /api/v1/news/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_news_item_returns_200(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Test that getting a news item by ID returns 200 OK."""
        news_item = await NewsItemFactory.create()

        response = await client.get(f"/api/v1/news/{news_item.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(news_item.id)
        assert data["title_el"] == news_item.title_el
        assert data["title_en"] == news_item.title_en

    @pytest.mark.asyncio
    async def test_get_news_item_not_found_returns_404(
        self,
        client: AsyncClient,
    ):
        """Test that getting non-existent news item returns 404."""
        fake_id = uuid4()

        response = await client.get(f"/api/v1/news/{fake_id}")

        assert response.status_code == 404
        error = response.json()
        assert error.get("success") is False
        assert error.get("error", {}).get("code") == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_get_news_item_invalid_uuid_returns_422(
        self,
        client: AsyncClient,
    ):
        """Test that invalid UUID returns 422."""
        response = await client.get("/api/v1/news/not-a-uuid")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_news_item_response_structure(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Test that response has all expected fields."""
        news_item = await NewsItemFactory.create()

        response = await client.get(f"/api/v1/news/{news_item.id}")

        assert response.status_code == 200
        data = response.json()

        # Check all expected fields
        assert "id" in data
        assert "title_el" in data
        assert "title_en" in data
        assert "title_ru" in data
        assert "description_el" in data
        assert "description_en" in data
        assert "description_ru" in data
        assert "publication_date" in data
        assert "original_article_url" in data
        assert "image_url" in data
        assert "created_at" in data
        assert "updated_at" in data
