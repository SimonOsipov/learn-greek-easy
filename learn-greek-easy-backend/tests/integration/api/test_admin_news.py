"""Integration tests for admin news API endpoints.

This module tests the admin news endpoints:
- POST /api/v1/admin/news - Create news item
- PUT /api/v1/admin/news/{id} - Update news item
- DELETE /api/v1/admin/news/{id} - Delete news item

Tests cover:
- Authentication requirements (401 without auth)
- Authorization (403 for non-superusers)
- Success cases (201, 200, 204)
- Validation errors (400, 409, 404)
"""

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import NewsItemFactory

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def mock_s3_service():
    """Mock S3 service for tests."""
    with patch("src.services.news_item_service.get_s3_service") as mock_get:
        mock_s3 = MagicMock()
        mock_s3.upload_object.return_value = True
        mock_s3.delete_object.return_value = True
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/test.jpg"
        mock_get.return_value = mock_s3
        yield mock_s3


@pytest.fixture
def mock_image_download():
    """Mock image download for tests."""
    with patch(
        "src.services.news_item_service.NewsItemService._download_image",
        new_callable=AsyncMock,
    ) as mock_download:
        # Return mock image data and content type
        mock_download.return_value = (b"fake-image-data", "image/jpeg")
        yield mock_download


@pytest.fixture
def valid_news_create_data():
    """Valid data for creating a news item."""
    return {
        "title_el": "Ελληνικός Τίτλος Δοκιμής",
        "title_en": "Test English Title",
        "title_ru": "Тестовый Русский Заголовок",
        "description_el": "Ελληνική περιγραφή για δοκιμή",
        "description_en": "English description for testing",
        "description_ru": "Русское описание для тестирования",
        "publication_date": str(date.today()),
        "original_article_url": f"https://example.com/article-{uuid4().hex[:8]}",
        "source_image_url": "https://example.com/image.jpg",
    }


# =============================================================================
# Create News Item Endpoint Tests
# =============================================================================


class TestCreateNewsItemEndpoint:
    """Test suite for POST /api/v1/admin/news endpoint."""

    @pytest.mark.asyncio
    async def test_create_news_returns_401_without_auth(
        self,
        client: AsyncClient,
        valid_news_create_data: dict,
    ):
        """Test that unauthenticated request returns 401 Unauthorized."""
        response = await client.post(
            "/api/v1/admin/news",
            json=valid_news_create_data,
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_news_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
        valid_news_create_data: dict,
    ):
        """Test that non-superuser gets 403 Forbidden."""
        response = await client.post(
            "/api/v1/admin/news",
            json=valid_news_create_data,
            headers=auth_headers,
        )

        assert response.status_code == 403
        error = response.json()
        assert error.get("success") is False
        assert error.get("error", {}).get("code") == "FORBIDDEN"

    @pytest.mark.asyncio
    async def test_create_news_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        mock_image_download: AsyncMock,
        valid_news_create_data: dict,
    ):
        """Test successful news item creation."""
        response = await client.post(
            "/api/v1/admin/news",
            json=valid_news_create_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()

        # Verify response structure (NewsItemWithCardResponse)
        assert "news_item" in data
        assert "card" in data
        assert data["message"] == "News item created successfully"

        # Verify news_item fields
        news_item = data["news_item"]
        assert news_item["title_el"] == valid_news_create_data["title_el"]
        assert news_item["title_en"] == valid_news_create_data["title_en"]
        assert news_item["description_el"] == valid_news_create_data["description_el"]
        assert news_item["description_en"] == valid_news_create_data["description_en"]
        assert "id" in news_item
        assert "image_url" in news_item
        assert "created_at" in news_item

        # Verify S3 upload was called
        mock_s3_service.upload_object.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_news_duplicate_url_returns_409(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        mock_image_download: AsyncMock,
    ):
        """Test that duplicate original_article_url returns 409 Conflict."""
        # Create an existing news item
        existing = await NewsItemFactory.create()

        # Try to create another with the same URL
        data = {
            "title_el": "Νέος Τίτλος",
            "title_en": "New Title",
            "title_ru": "Новый Заголовок",
            "description_el": "Νέα περιγραφή",
            "description_en": "New description",
            "description_ru": "Новое описание",
            "publication_date": str(date.today()),
            "original_article_url": existing.original_article_url,
            "source_image_url": "https://example.com/new-image.jpg",
        }

        response = await client.post(
            "/api/v1/admin/news",
            json=data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 409
        error = response.json()
        assert "already exists" in error.get("error", {}).get("message", "").lower()

    @pytest.mark.asyncio
    async def test_create_news_missing_fields_returns_422(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that missing required fields returns 422."""
        response = await client.post(
            "/api/v1/admin/news",
            json={"title_el": "Only Greek Title"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422


# =============================================================================
# Update News Item Endpoint Tests
# =============================================================================


class TestUpdateNewsItemEndpoint:
    """Test suite for PUT /api/v1/admin/news/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_update_news_returns_401_without_auth(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated request returns 401 Unauthorized."""
        fake_id = uuid4()
        response = await client.put(
            f"/api/v1/admin/news/{fake_id}",
            json={"title_en": "Updated Title"},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_update_news_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that non-superuser gets 403 Forbidden."""
        fake_id = uuid4()
        response = await client.put(
            f"/api/v1/admin/news/{fake_id}",
            json={"title_en": "Updated Title"},
            headers=auth_headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_update_news_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """Test successful news item update."""
        news_item = await NewsItemFactory.create()

        response = await client.put(
            f"/api/v1/admin/news/{news_item.id}",
            json={"title_en": "Updated English Title"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(news_item.id)
        assert data["title_en"] == "Updated English Title"
        # Other fields unchanged
        assert data["title_el"] == news_item.title_el

    @pytest.mark.asyncio
    async def test_update_news_with_new_image(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        mock_image_download: AsyncMock,
    ):
        """Test updating news item with a new image."""
        news_item = await NewsItemFactory.create()

        response = await client.put(
            f"/api/v1/admin/news/{news_item.id}",
            json={
                "title_en": "Updated Title",
                "source_image_url": "https://example.com/new-image.jpg",
            },
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title_en"] == "Updated Title"

        # Verify image operations were called
        mock_image_download.assert_called_once()
        mock_s3_service.upload_object.assert_called_once()
        mock_s3_service.delete_object.assert_called_once()  # Delete old image

    @pytest.mark.asyncio
    async def test_update_news_not_found_returns_404(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        """Test that updating non-existent news item returns 404."""
        fake_id = uuid4()

        response = await client.put(
            f"/api/v1/admin/news/{fake_id}",
            json={"title_en": "Updated Title"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404


# =============================================================================
# Delete News Item Endpoint Tests
# =============================================================================


class TestDeleteNewsItemEndpoint:
    """Test suite for DELETE /api/v1/admin/news/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_delete_news_returns_401_without_auth(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated request returns 401 Unauthorized."""
        fake_id = uuid4()
        response = await client.delete(f"/api/v1/admin/news/{fake_id}")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_delete_news_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that non-superuser gets 403 Forbidden."""
        fake_id = uuid4()
        response = await client.delete(
            f"/api/v1/admin/news/{fake_id}",
            headers=auth_headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_news_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """Test successful news item deletion."""
        news_item = await NewsItemFactory.create()

        response = await client.delete(
            f"/api/v1/admin/news/{news_item.id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 204

        # Verify S3 delete was called
        mock_s3_service.delete_object.assert_called_once()

        # Verify item is deleted (should return 404 now)
        get_response = await client.get(f"/api/v1/news/{news_item.id}")
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_news_not_found_returns_404(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        """Test that deleting non-existent news item returns 404."""
        fake_id = uuid4()

        response = await client.delete(
            f"/api/v1/admin/news/{fake_id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404
