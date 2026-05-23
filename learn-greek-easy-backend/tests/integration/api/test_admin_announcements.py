"""Integration tests for admin announcement API endpoints.

This module tests the admin announcement endpoints with real database operations:
- POST /api/v1/admin/announcements - Create announcement
- GET /api/v1/admin/announcements - List announcements
- GET /api/v1/admin/announcements/{id} - Get announcement details

Tests cover:
- Authentication requirements (401 without auth, 403 for non-superusers)
- Authorization (only superusers can access)
- Successful CRUD operations
- Validation error handling
- Pagination
- Read statistics calculation
"""

from unittest.mock import patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories.announcement import AnnouncementCampaignFactory


class TestCreateAnnouncementEndpoint:
    """Integration tests for POST /api/v1/admin/announcements endpoint."""

    # =========================================================================
    # Authentication Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_create_returns_401_without_auth(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated requests return 401 Unauthorized."""
        response = await client.post(
            "/api/v1/admin/announcements",
            json={
                "title": "Test Announcement",
                "message": "This is a test message",
            },
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that non-superuser gets 403 Forbidden."""
        response = await client.post(
            "/api/v1/admin/announcements",
            json={
                "title": "Test Announcement",
                "message": "This is a test message",
            },
            headers=auth_headers,
        )

        assert response.status_code == 403
        error = response.json()
        assert error.get("success") is False
        assert error.get("error", {}).get("code") == "FORBIDDEN"

    # =========================================================================
    # Success Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_create_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test successful announcement creation with mocked background task."""
        with patch("src.api.v1.admin.create_announcement_notifications_task"):
            response = await client.post(
                "/api/v1/admin/announcements",
                json={
                    "title": "New Feature Alert",
                    "message": "We have released exciting new features!",
                    "link_url": "https://example.com/features",
                },
                headers=superuser_auth_headers,
            )

        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["title"] == "New Feature Alert"
        assert data["total_recipients"] == 0  # Initially 0, updated by background task
        assert "message" in data  # Response message field

    @pytest.mark.asyncio
    async def test_create_without_link(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test announcement creation without optional link_url."""
        with patch("src.api.v1.admin.create_announcement_notifications_task"):
            response = await client.post(
                "/api/v1/admin/announcements",
                json={
                    "title": "Simple Announcement",
                    "message": "Just a simple message without a link.",
                },
                headers=superuser_auth_headers,
            )

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Simple Announcement"

    # =========================================================================
    # Validation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_create_validation_error_missing_title(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that missing title returns 422 validation error."""
        response = await client.post(
            "/api/v1/admin/announcements",
            json={
                "message": "Message without title",
            },
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_validation_error_empty_title(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that empty title returns 422 validation error."""
        response = await client.post(
            "/api/v1/admin/announcements",
            json={
                "title": "   ",  # Whitespace only
                "message": "Message with empty title",
            },
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_validation_error_invalid_url(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that invalid URL returns 422 validation error."""
        response = await client.post(
            "/api/v1/admin/announcements",
            json={
                "title": "Announcement",
                "message": "Message with invalid URL",
                "link_url": "not-a-valid-url",
            },
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422


class TestListAnnouncementsEndpoint:
    """Integration tests for GET /api/v1/admin/announcements endpoint."""

    # =========================================================================
    # Authentication Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_list_returns_401_without_auth(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated requests return 401 Unauthorized."""
        response = await client.get("/api/v1/admin/announcements")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that non-superuser gets 403 Forbidden."""
        response = await client.get(
            "/api/v1/admin/announcements",
            headers=auth_headers,
        )

        assert response.status_code == 403
        error = response.json()
        assert error.get("success") is False
        assert error.get("error", {}).get("code") == "FORBIDDEN"

    # =========================================================================
    # Success Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_list_success_empty(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test listing announcements when none exist."""
        response = await client.get(
            "/api/v1/admin/announcements",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["page"] == 1
        assert data["page_size"] == 20
        assert data["items"] == []

    @pytest.mark.asyncio
    async def test_list_success_with_data(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        test_superuser,
        db_session: AsyncSession,
    ):
        """Test listing announcements with data."""
        # Create test announcements
        await AnnouncementCampaignFactory.create(
            session=db_session,
            created_by=test_superuser.id,
            title="First Announcement",
            message="First message",
        )
        await AnnouncementCampaignFactory.create(
            session=db_session,
            created_by=test_superuser.id,
            title="Second Announcement",
            message="Second message",
            with_link=True,
        )

        response = await client.get(
            "/api/v1/admin/announcements",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

        # Check structure of items
        for item in data["items"]:
            assert "id" in item
            assert "title" in item
            assert "message" in item
            assert "total_recipients" in item
            assert "read_count" in item
            assert "created_at" in item

    @pytest.mark.asyncio
    async def test_list_pagination(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        test_superuser,
        db_session: AsyncSession,
    ):
        """Test pagination of announcements list."""
        # Create 5 announcements
        for i in range(5):
            await AnnouncementCampaignFactory.create(
                session=db_session,
                created_by=test_superuser.id,
                title=f"Announcement {i}",
                message=f"Message {i}",
            )

        # Get first page with page_size=2
        response = await client.get(
            "/api/v1/admin/announcements?page=1&page_size=2",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert len(data["items"]) == 2

        # Get second page
        response = await client.get(
            "/api/v1/admin/announcements?page=2&page_size=2",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert data["page"] == 2
        assert len(data["items"]) == 2

    @pytest.mark.asyncio
    async def test_list_item_shape(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        test_superuser,
        db_session: AsyncSession,
    ):
        """Test that list items have the expected shape (no creator field)."""
        await AnnouncementCampaignFactory.create(
            session=db_session,
            created_by=test_superuser.id,
            title="Announcement with Creator",
            message="Test message",
        )

        response = await client.get(
            "/api/v1/admin/announcements",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1

        item = data["items"][0]
        assert "creator" not in item
        assert item["title"] == "Announcement with Creator"

    @pytest.mark.asyncio
    async def test_list_items_omit_creator(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        test_superuser,
        db_session: AsyncSession,
    ):
        """Test that all list items omit creator field."""
        for i in range(3):
            await AnnouncementCampaignFactory.create(
                session=db_session,
                created_by=test_superuser.id,
                title=f"Omit Creator Test {i}",
                message="Test message",
            )

        response = await client.get(
            "/api/v1/admin/announcements",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 3
        for item in data["items"]:
            assert "creator" not in item


class TestGetAnnouncementEndpoint:
    """Integration tests for GET /api/v1/admin/announcements/{id} endpoint."""

    # =========================================================================
    # Authentication Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_get_returns_401_without_auth(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated requests return 401 Unauthorized."""
        response = await client.get(f"/api/v1/admin/announcements/{uuid4()}")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that non-superuser gets 403 Forbidden."""
        response = await client.get(
            f"/api/v1/admin/announcements/{uuid4()}",
            headers=auth_headers,
        )

        assert response.status_code == 403
        error = response.json()
        assert error.get("success") is False
        assert error.get("error", {}).get("code") == "FORBIDDEN"

    # =========================================================================
    # Not Found Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_get_returns_404_for_nonexistent(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that nonexistent announcement returns 404."""
        response = await client.get(
            f"/api/v1/admin/announcements/{uuid4()}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404

    # =========================================================================
    # Success Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_get_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        test_superuser,
        db_session: AsyncSession,
    ):
        """Test successful retrieval of announcement details."""
        campaign = await AnnouncementCampaignFactory.create(
            session=db_session,
            created_by=test_superuser.id,
            title="Test Campaign",
            message="Test message for details",
            with_link=True,
        )

        response = await client.get(
            f"/api/v1/admin/announcements/{campaign.id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(campaign.id)
        assert data["title"] == "Test Campaign"
        assert data["message"] == "Test message for details"
        assert data["link_url"] is not None
        assert "total_recipients" in data
        assert "read_count" in data
        assert "created_at" in data
        assert "creator" not in data

    @pytest.mark.asyncio
    async def test_get_response_omits_creator_and_read_percentage(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        test_superuser,
        db_session: AsyncSession,
    ):
        """Test that detail response does not include creator or read_percentage fields."""
        campaign = await AnnouncementCampaignFactory.create(
            session=db_session,
            created_by=test_superuser.id,
            title="Slim Response Test",
            message="Checking omitted fields",
        )

        response = await client.get(
            f"/api/v1/admin/announcements/{campaign.id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        body = response.json()
        assert "creator" not in body
        assert "read_percentage" not in body
