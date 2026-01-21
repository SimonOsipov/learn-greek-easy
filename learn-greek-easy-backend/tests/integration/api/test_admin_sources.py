"""Integration tests for admin news sources API endpoints.

This module tests the admin news sources endpoints:
- GET /api/v1/admin/culture/sources - List all news sources (paginated)
- POST /api/v1/admin/culture/sources - Create a news source
- GET /api/v1/admin/culture/sources/{id} - Get a news source
- PATCH /api/v1/admin/culture/sources/{id} - Update a news source
- DELETE /api/v1/admin/culture/sources/{id} - Delete a news source

Tests cover:
- Authentication requirements (401 without auth)
- Authorization (403 for non-superusers)
- Success cases with proper response structures
- Error handling (404 not found, 409 duplicate URL)
- Pagination and filtering functionality
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import NewsSourceFactory

# =============================================================================
# List News Sources Endpoint Tests
# =============================================================================


class TestListNewsSourcesEndpoint:
    """Test suite for GET /api/v1/admin/culture/sources endpoint."""

    @pytest.mark.asyncio
    async def test_list_sources_returns_401_without_auth(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated request returns 401 Unauthorized."""
        response = await client.get("/api/v1/admin/culture/sources")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_sources_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that non-superuser gets 403 Forbidden."""
        response = await client.get(
            "/api/v1/admin/culture/sources",
            headers=auth_headers,
        )

        assert response.status_code == 403
        error = response.json()
        assert error.get("success") is False
        assert error.get("error", {}).get("code") == "FORBIDDEN"

    @pytest.mark.asyncio
    async def test_list_sources_success_for_superuser(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that superuser can access news sources list successfully."""
        response = await client.get(
            "/api/v1/admin/culture/sources",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "sources" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert isinstance(data["sources"], list)

    @pytest.mark.asyncio
    async def test_list_sources_with_test_data(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test list endpoint returns created sources."""
        # Arrange - Create test sources
        source1 = await NewsSourceFactory.create(name="Source One")
        source2 = await NewsSourceFactory.create(name="Source Two")

        # Act
        response = await client.get(
            "/api/v1/admin/culture/sources",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 2

        source_ids = [s["id"] for s in data["sources"]]
        assert str(source1.id) in source_ids
        assert str(source2.id) in source_ids

    @pytest.mark.asyncio
    async def test_list_sources_pagination_works(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test pagination parameters work correctly."""
        # Arrange - Create 5 sources
        for i in range(5):
            await NewsSourceFactory.create(name=f"Pagination Source {i}")

        # Act - Get first page of 2
        response = await client.get(
            "/api/v1/admin/culture/sources?page=1&page_size=2",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert len(data["sources"]) == 2
        assert data["total"] >= 5

    @pytest.mark.asyncio
    async def test_list_sources_pagination_page_2(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test getting second page of results."""
        # Arrange - Create 5 sources
        for i in range(5):
            await NewsSourceFactory.create(name=f"Page Test Source {i}")

        # Act - Get second page of 2
        response = await client.get(
            "/api/v1/admin/culture/sources?page=2&page_size=2",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 2
        assert data["page_size"] == 2
        # Should have items (at least 2 on page 2 if 5+ total)
        assert len(data["sources"]) >= 1

    @pytest.mark.asyncio
    async def test_list_sources_filter_by_is_active_true(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test filtering sources by is_active=true."""
        # Arrange - Create active and inactive sources
        active_source = await NewsSourceFactory.create(name="Active Source")
        await NewsSourceFactory.create(name="Inactive Source", inactive=True)

        # Act
        response = await client.get(
            "/api/v1/admin/culture/sources?is_active=true",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        # All returned sources should be active
        for source in data["sources"]:
            assert source["is_active"] is True
        # Our active source should be in the list
        source_ids = [s["id"] for s in data["sources"]]
        assert str(active_source.id) in source_ids

    @pytest.mark.asyncio
    async def test_list_sources_filter_by_is_active_false(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test filtering sources by is_active=false."""
        # Arrange - Create active and inactive sources
        await NewsSourceFactory.create(name="Active Source 2")
        inactive_source = await NewsSourceFactory.create(name="Inactive Source 2", inactive=True)

        # Act
        response = await client.get(
            "/api/v1/admin/culture/sources?is_active=false",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        # All returned sources should be inactive
        for source in data["sources"]:
            assert source["is_active"] is False
        # Our inactive source should be in the list
        source_ids = [s["id"] for s in data["sources"]]
        assert str(inactive_source.id) in source_ids

    @pytest.mark.asyncio
    async def test_list_sources_response_structure(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that response matches expected schema structure."""
        # Arrange - Create a source
        source = await NewsSourceFactory.create(name="Schema Test Source")

        # Act
        response = await client.get(
            "/api/v1/admin/culture/sources",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()

        # Find our source and verify structure
        source_data = next(
            (s for s in data["sources"] if s["id"] == str(source.id)),
            None,
        )
        assert source_data is not None
        assert "id" in source_data
        assert "name" in source_data
        assert "url" in source_data
        assert "is_active" in source_data
        assert "created_at" in source_data
        assert "updated_at" in source_data


# =============================================================================
# Create News Source Endpoint Tests
# =============================================================================


class TestCreateNewsSourceEndpoint:
    """Test suite for POST /api/v1/admin/culture/sources endpoint."""

    @pytest.mark.asyncio
    async def test_create_source_returns_401_without_auth(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated request returns 401 Unauthorized."""
        response = await client.post(
            "/api/v1/admin/culture/sources",
            json={
                "name": "Test Source",
                "url": "https://test.example.com",
            },
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_source_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that non-superuser gets 403 Forbidden."""
        response = await client.post(
            "/api/v1/admin/culture/sources",
            json={
                "name": "Test Source",
                "url": "https://test.example.com",
            },
            headers=auth_headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_create_source_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that superuser can create a news source."""
        # Act
        response = await client.post(
            "/api/v1/admin/culture/sources",
            json={
                "name": "Test Greek News",
                "url": "https://greek-news.example.com",
                "is_active": True,
            },
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Greek News"
        assert "greek-news.example.com" in data["url"]
        assert data["is_active"] is True
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data

    @pytest.mark.asyncio
    async def test_create_source_default_is_active(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that is_active defaults to True."""
        # Act
        response = await client.post(
            "/api/v1/admin/culture/sources",
            json={
                "name": "Default Active Source",
                "url": "https://default-active.example.com",
            },
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 201
        data = response.json()
        assert data["is_active"] is True

    @pytest.mark.asyncio
    async def test_create_source_duplicate_url_returns_409(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that creating source with duplicate URL returns 409 Conflict."""
        # Arrange - Create first source
        # Note: Pydantic HttpUrl normalizes URLs, adding trailing slash
        existing_url = "https://duplicate-test.example.com/"
        await NewsSourceFactory.create(url=existing_url)

        # Act - Try to create second source with same URL
        response = await client.post(
            "/api/v1/admin/culture/sources",
            json={
                "name": "Duplicate Source",
                "url": existing_url,
            },
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 409
        error = response.json()
        # Error response uses structured format: {success: false, error: {code, message}}
        error_message = error.get("error", {}).get("message", "") or error.get("detail", "")
        assert "URL already exists" in error_message

    @pytest.mark.asyncio
    async def test_create_source_invalid_url_returns_422(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that invalid URL format returns 422 Validation Error."""
        # Act
        response = await client.post(
            "/api/v1/admin/culture/sources",
            json={
                "name": "Invalid URL Source",
                "url": "not-a-valid-url",
            },
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_source_empty_name_returns_422(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that empty name returns 422 Validation Error."""
        # Act
        response = await client.post(
            "/api/v1/admin/culture/sources",
            json={
                "name": "",
                "url": "https://empty-name.example.com",
            },
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 422


# =============================================================================
# Get News Source Endpoint Tests
# =============================================================================


class TestGetNewsSourceEndpoint:
    """Test suite for GET /api/v1/admin/culture/sources/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_source_returns_401_without_auth(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated request returns 401 Unauthorized."""
        fake_id = uuid4()
        response = await client.get(f"/api/v1/admin/culture/sources/{fake_id}")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_source_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that non-superuser gets 403 Forbidden."""
        fake_id = uuid4()
        response = await client.get(
            f"/api/v1/admin/culture/sources/{fake_id}",
            headers=auth_headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_get_source_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that superuser can get a news source by ID."""
        # Arrange - Create a source
        source = await NewsSourceFactory.create(name="Get Test Source")

        # Act
        response = await client.get(
            f"/api/v1/admin/culture/sources/{source.id}",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(source.id)
        assert data["name"] == "Get Test Source"
        assert data["url"] == source.url
        assert data["is_active"] == source.is_active

    @pytest.mark.asyncio
    async def test_get_source_not_found_returns_404(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that getting non-existent source returns 404."""
        fake_id = uuid4()
        response = await client.get(
            f"/api/v1/admin/culture/sources/{fake_id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404


# =============================================================================
# Update News Source Endpoint Tests
# =============================================================================


class TestUpdateNewsSourceEndpoint:
    """Test suite for PATCH /api/v1/admin/culture/sources/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_update_source_returns_401_without_auth(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated request returns 401 Unauthorized."""
        fake_id = uuid4()
        response = await client.patch(
            f"/api/v1/admin/culture/sources/{fake_id}",
            json={"name": "Updated"},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_update_source_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that non-superuser gets 403 Forbidden."""
        fake_id = uuid4()
        response = await client.patch(
            f"/api/v1/admin/culture/sources/{fake_id}",
            json={"name": "Updated"},
            headers=auth_headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_update_source_name_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that superuser can update source name."""
        # Arrange - Create a source
        source = await NewsSourceFactory.create(name="Original Name")

        # Act
        response = await client.patch(
            f"/api/v1/admin/culture/sources/{source.id}",
            json={"name": "Updated Name"},
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["url"] == source.url  # URL unchanged

    @pytest.mark.asyncio
    async def test_update_source_url_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that superuser can update source URL."""
        # Arrange - Create a source
        source = await NewsSourceFactory.create(name="URL Update Test")

        # Act
        new_url = "https://updated-url.example.com"
        response = await client.patch(
            f"/api/v1/admin/culture/sources/{source.id}",
            json={"url": new_url},
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "updated-url.example.com" in data["url"]
        assert data["name"] == source.name  # Name unchanged

    @pytest.mark.asyncio
    async def test_update_source_is_active_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that superuser can update source is_active status."""
        # Arrange - Create an active source
        source = await NewsSourceFactory.create(name="Active Status Test")

        # Act - Deactivate
        response = await client.patch(
            f"/api/v1/admin/culture/sources/{source.id}",
            json={"is_active": False},
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False

    @pytest.mark.asyncio
    async def test_update_source_not_found_returns_404(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that updating non-existent source returns 404."""
        fake_id = uuid4()
        response = await client.patch(
            f"/api/v1/admin/culture/sources/{fake_id}",
            json={"name": "Updated"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_source_duplicate_url_returns_409(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that updating with duplicate URL returns 409 Conflict."""
        # Arrange - Create two sources
        # Note: Pydantic HttpUrl normalizes URLs, adding trailing slash
        existing_url = "https://existing-url.example.com/"
        await NewsSourceFactory.create(url=existing_url)
        source_to_update = await NewsSourceFactory.create(name="Source To Update")

        # Act - Try to update with existing URL
        response = await client.patch(
            f"/api/v1/admin/culture/sources/{source_to_update.id}",
            json={"url": existing_url},
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 409
        error = response.json()
        # Error response uses structured format: {success: false, error: {code, message}}
        error_message = error.get("error", {}).get("message", "") or error.get("detail", "")
        assert "URL already exists" in error_message

    @pytest.mark.asyncio
    async def test_update_source_multiple_fields(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test updating multiple fields at once."""
        # Arrange - Create a source
        source = await NewsSourceFactory.create(
            name="Multi Update Test",
            is_active=True,
        )

        # Act - Update multiple fields
        response = await client.patch(
            f"/api/v1/admin/culture/sources/{source.id}",
            json={
                "name": "New Multi Name",
                "is_active": False,
            },
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Multi Name"
        assert data["is_active"] is False


# =============================================================================
# Delete News Source Endpoint Tests
# =============================================================================


class TestDeleteNewsSourceEndpoint:
    """Test suite for DELETE /api/v1/admin/culture/sources/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_delete_source_returns_401_without_auth(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated request returns 401 Unauthorized."""
        fake_id = uuid4()
        response = await client.delete(f"/api/v1/admin/culture/sources/{fake_id}")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_delete_source_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that non-superuser gets 403 Forbidden."""
        fake_id = uuid4()
        response = await client.delete(
            f"/api/v1/admin/culture/sources/{fake_id}",
            headers=auth_headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_source_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that superuser can delete a news source."""
        # Arrange - Create a source
        source = await NewsSourceFactory.create(name="Delete Test Source")
        source_id = source.id

        # Act
        response = await client.delete(
            f"/api/v1/admin/culture/sources/{source_id}",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 204

        # Verify source is gone
        get_response = await client.get(
            f"/api/v1/admin/culture/sources/{source_id}",
            headers=superuser_auth_headers,
        )
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_source_not_found_returns_404(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that deleting non-existent source returns 404."""
        fake_id = uuid4()
        response = await client.delete(
            f"/api/v1/admin/culture/sources/{fake_id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_source_idempotent(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that deleting already-deleted source returns 404."""
        # Arrange - Create and delete a source
        source = await NewsSourceFactory.create(name="Idempotent Delete Test")
        source_id = source.id

        # Delete once
        response = await client.delete(
            f"/api/v1/admin/culture/sources/{source_id}",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 204

        # Try to delete again
        response = await client.delete(
            f"/api/v1/admin/culture/sources/{source_id}",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404
