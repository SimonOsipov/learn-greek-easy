"""Integration tests for admin fetch history API endpoints.

This module tests the admin fetch history endpoints:
- POST /api/v1/admin/culture/sources/{id}/fetch - Trigger manual fetch
- GET /api/v1/admin/culture/sources/{id}/history - Get fetch history
- GET /api/v1/admin/culture/sources/history/{id}/html - Get HTML content

Tests cover:
- Authentication requirements (401 without auth)
- Authorization (403 for non-superusers)
- Success cases with proper response structures
- Error handling (404 not found)
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import NewsSourceFactory, SourceFetchHistoryFactory

# =============================================================================
# Trigger Fetch Endpoint Tests
# =============================================================================


class TestTriggerFetchEndpoint:
    """Test suite for POST /api/v1/admin/culture/sources/{id}/fetch endpoint."""

    @pytest.mark.asyncio
    async def test_trigger_fetch_returns_401_without_auth(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated request returns 401 Unauthorized."""
        fake_id = uuid4()
        response = await client.post(f"/api/v1/admin/culture/sources/{fake_id}/fetch")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_trigger_fetch_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that non-superuser gets 403 Forbidden."""
        fake_id = uuid4()
        response = await client.post(
            f"/api/v1/admin/culture/sources/{fake_id}/fetch",
            headers=auth_headers,
        )

        assert response.status_code == 403
        error = response.json()
        assert error.get("success") is False
        assert error.get("error", {}).get("code") == "FORBIDDEN"

    @pytest.mark.asyncio
    async def test_trigger_fetch_source_not_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that fetching non-existent source returns 404."""
        fake_id = uuid4()
        response = await client.post(
            f"/api/v1/admin/culture/sources/{fake_id}/fetch",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_trigger_fetch_success_creates_history(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that manual fetch creates a history entry."""
        # Arrange - Create a source (URL will fail but history entry should be created)
        source = await NewsSourceFactory.create(
            name="Test Fetch Source",
            url="https://httpbin.org/status/200",  # This will work in tests
        )

        # Act
        response = await client.post(
            f"/api/v1/admin/culture/sources/{source.id}/fetch",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["trigger_type"] == "manual"
        assert data["status"] in ["success", "error"]
        assert "fetched_at" in data

    @pytest.mark.asyncio
    async def test_trigger_fetch_response_structure(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that response matches expected schema structure."""
        # Arrange - Create a source
        source = await NewsSourceFactory.create(name="Structure Test Source")

        # Act
        response = await client.post(
            f"/api/v1/admin/culture/sources/{source.id}/fetch",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 201
        data = response.json()

        # Verify all expected fields are present
        assert "id" in data
        assert "fetched_at" in data
        assert "status" in data
        assert "trigger_type" in data
        # Optional fields
        assert "html_size_bytes" in data
        assert "error_message" in data
        assert "final_url" in data


# =============================================================================
# Get Fetch History Endpoint Tests
# =============================================================================


class TestGetFetchHistoryEndpoint:
    """Test suite for GET /api/v1/admin/culture/sources/{id}/history endpoint."""

    @pytest.mark.asyncio
    async def test_get_history_returns_401_without_auth(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated request returns 401 Unauthorized."""
        fake_id = uuid4()
        response = await client.get(f"/api/v1/admin/culture/sources/{fake_id}/history")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_history_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that non-superuser gets 403 Forbidden."""
        fake_id = uuid4()
        response = await client.get(
            f"/api/v1/admin/culture/sources/{fake_id}/history",
            headers=auth_headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_get_history_source_not_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that getting history for non-existent source returns 404."""
        fake_id = uuid4()
        response = await client.get(
            f"/api/v1/admin/culture/sources/{fake_id}/history",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_history_empty(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test getting history for source with no fetches."""
        # Arrange - Create a source with no history
        source = await NewsSourceFactory.create(name="Empty History Source")

        # Act
        response = await client.get(
            f"/api/v1/admin/culture/sources/{source.id}/history",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_get_history_with_entries(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test getting history for source with fetch entries."""
        # Arrange - Create a source with history entries
        source = await NewsSourceFactory.create(name="History Test Source")
        history1 = await SourceFetchHistoryFactory.create(source_id=source.id)
        history2 = await SourceFetchHistoryFactory.create(source_id=source.id, error=True)

        # Act
        response = await client.get(
            f"/api/v1/admin/culture/sources/{source.id}/history",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

        # Verify both entries are present
        history_ids = [item["id"] for item in data["items"]]
        assert str(history1.id) in history_ids
        assert str(history2.id) in history_ids

    @pytest.mark.asyncio
    async def test_get_history_limit_parameter(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that limit parameter works correctly."""
        # Arrange - Create a source with multiple history entries
        source = await NewsSourceFactory.create(name="Limit Test Source")
        for _ in range(5):
            await SourceFetchHistoryFactory.create(source_id=source.id)

        # Act - Request with limit=2
        response = await client.get(
            f"/api/v1/admin/culture/sources/{source.id}/history?limit=2",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["total"] == 5  # Total count shows all entries

    @pytest.mark.asyncio
    async def test_get_history_response_structure(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that response matches expected schema structure."""
        # Arrange - Create a source with a history entry
        source = await NewsSourceFactory.create(name="Schema Test Source")
        await SourceFetchHistoryFactory.create(
            source_id=source.id,
            final_url="https://example.com/final",
        )

        # Act
        response = await client.get(
            f"/api/v1/admin/culture/sources/{source.id}/history",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()

        assert "items" in data
        assert "total" in data
        assert len(data["items"]) == 1

        item = data["items"][0]
        assert "id" in item
        assert "fetched_at" in item
        assert "status" in item
        assert "html_size_bytes" in item
        assert "error_message" in item
        assert "trigger_type" in item
        assert "final_url" in item


# =============================================================================
# Get Fetch HTML Endpoint Tests
# =============================================================================


class TestGetFetchHtmlEndpoint:
    """Test suite for GET /api/v1/admin/culture/sources/history/{id}/html endpoint."""

    @pytest.mark.asyncio
    async def test_get_html_returns_401_without_auth(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated request returns 401 Unauthorized."""
        fake_id = uuid4()
        response = await client.get(f"/api/v1/admin/culture/sources/history/{fake_id}/html")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_html_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that non-superuser gets 403 Forbidden."""
        fake_id = uuid4()
        response = await client.get(
            f"/api/v1/admin/culture/sources/history/{fake_id}/html",
            headers=auth_headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_get_html_not_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that getting HTML for non-existent history returns 404."""
        fake_id = uuid4()
        response = await client.get(
            f"/api/v1/admin/culture/sources/history/{fake_id}/html",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_html_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test getting HTML content from successful fetch."""
        # Arrange - Create a source with successful fetch history
        source = await NewsSourceFactory.create(name="HTML Test Source")
        html_content = (
            "<html><head><title>Test Page</title></head><body><h1>Hello</h1></body></html>"
        )
        history = await SourceFetchHistoryFactory.create(
            source_id=source.id,
            html_content=html_content,
            final_url="https://example.com/page",
        )

        # Act
        response = await client.get(
            f"/api/v1/admin/culture/sources/history/{history.id}/html",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(history.id)
        assert data["html_content"] == html_content
        assert data["final_url"] == "https://example.com/page"
        assert "fetched_at" in data

    @pytest.mark.asyncio
    async def test_get_html_error_entry_returns_404(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that getting HTML from error entry returns 404."""
        # Arrange - Create a source with error fetch history (no HTML)
        source = await NewsSourceFactory.create(name="Error HTML Test Source")
        history = await SourceFetchHistoryFactory.create(
            source_id=source.id,
            error=True,  # This sets html_content to None
        )

        # Act
        response = await client.get(
            f"/api/v1/admin/culture/sources/history/{history.id}/html",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_html_response_structure(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that response matches expected schema structure."""
        # Arrange - Create a source with successful fetch
        source = await NewsSourceFactory.create(name="Schema HTML Test Source")
        history = await SourceFetchHistoryFactory.create(source_id=source.id)

        # Act
        response = await client.get(
            f"/api/v1/admin/culture/sources/history/{history.id}/html",
            headers=superuser_auth_headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()

        # Verify all expected fields
        assert "id" in data
        assert "html_content" in data
        assert "fetched_at" in data
        assert "final_url" in data
