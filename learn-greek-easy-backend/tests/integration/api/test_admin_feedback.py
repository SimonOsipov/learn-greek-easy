"""Integration tests for admin feedback API endpoints.

This module tests the admin feedback endpoints:
- GET /api/v1/admin/feedback - List all feedback for admin
- PATCH /api/v1/admin/feedback/{id} - Update feedback status/response

Tests cover:
- Authentication requirements (401 without auth)
- Authorization (403 for non-superusers)
- Success cases (200/404)
- Validation errors (422)
- Sorting, filtering, and pagination
- Auto-status logic and admin response handling
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import FeedbackStatus
from tests.factories import FeedbackFactory, UserFactory

# =============================================================================
# Admin List Feedback Endpoint Tests
# =============================================================================


class TestAdminListFeedbackEndpoint:
    """Test suite for GET /api/v1/admin/feedback endpoint."""

    @pytest.mark.asyncio
    async def test_list_feedback_returns_401_without_auth(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated request returns 401 Unauthorized."""
        response = await client.get("/api/v1/admin/feedback")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_feedback_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that non-superuser gets 403 Forbidden."""
        response = await client.get(
            "/api/v1/admin/feedback",
            headers=auth_headers,
        )

        assert response.status_code == 403
        error = response.json()
        assert error.get("success") is False
        assert error.get("error", {}).get("code") == "FORBIDDEN"

    @pytest.mark.asyncio
    async def test_list_feedback_success_for_superuser(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that superuser can access admin feedback list successfully."""
        response = await client.get(
            "/api/v1/admin/feedback",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "items" in data
        assert isinstance(data["items"], list)

    @pytest.mark.asyncio
    async def test_get_feedback_list_sorted_new_first(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that NEW status items appear first in the list."""
        # Create a user for feedback
        user = await UserFactory.create()

        # Create feedback with different statuses to test sorting
        # These seed the database for the API test
        await FeedbackFactory.create(user_id=user.id, status=FeedbackStatus.PLANNED)
        await FeedbackFactory.create(user_id=user.id, status=FeedbackStatus.NEW)
        await FeedbackFactory.create(user_id=user.id, status=FeedbackStatus.UNDER_REVIEW)

        response = await client.get(
            "/api/v1/admin/feedback",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        items = data["items"]

        # Find positions of our created feedback
        new_positions = [i for i, item in enumerate(items) if item["status"] == "new"]
        other_positions = [i for i, item in enumerate(items) if item["status"] != "new"]

        # NEW items should appear before other statuses
        if new_positions and other_positions:
            assert max(new_positions) < min(other_positions)

    @pytest.mark.asyncio
    async def test_get_feedback_list_with_status_filter(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test filtering feedback by status."""
        user = await UserFactory.create()

        # Create feedback with different statuses
        await FeedbackFactory.create(user_id=user.id, status=FeedbackStatus.NEW)
        await FeedbackFactory.create(user_id=user.id, status=FeedbackStatus.PLANNED)
        await FeedbackFactory.create(user_id=user.id, status=FeedbackStatus.PLANNED)

        response = await client.get(
            "/api/v1/admin/feedback?status=planned",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # All items should have PLANNED status
        for item in data["items"]:
            assert item["status"] == "planned"

    @pytest.mark.asyncio
    async def test_get_feedback_list_pagination(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test pagination works correctly."""
        user = await UserFactory.create()

        # Create 5 feedback items
        for _ in range(5):
            await FeedbackFactory.create(user_id=user.id)

        # Get first page of 2
        response = await client.get(
            "/api/v1/admin/feedback?page=1&page_size=2",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert len(data["items"]) == 2
        assert data["total"] >= 5


# =============================================================================
# Admin Update Feedback Endpoint Tests
# =============================================================================


class TestAdminUpdateFeedbackEndpoint:
    """Test suite for PATCH /api/v1/admin/feedback/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_patch_feedback_returns_401_without_auth(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated request returns 401 Unauthorized."""
        fake_id = uuid4()
        response = await client.patch(
            f"/api/v1/admin/feedback/{fake_id}",
            json={"status": "planned"},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_patch_feedback_non_admin_forbidden(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that non-superuser gets 403 Forbidden."""
        fake_id = uuid4()
        response = await client.patch(
            f"/api/v1/admin/feedback/{fake_id}",
            json={"status": "planned"},
            headers=auth_headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_patch_feedback_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test successful status update by superuser."""
        user = await UserFactory.create()
        feedback = await FeedbackFactory.create(
            user_id=user.id,
            status=FeedbackStatus.NEW,
        )

        response = await client.patch(
            f"/api/v1/admin/feedback/{feedback.id}",
            json={"status": "under_review"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(feedback.id)
        assert data["status"] == "under_review"

    @pytest.mark.asyncio
    async def test_patch_feedback_with_admin_response(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test adding admin response to feedback."""
        user = await UserFactory.create()
        feedback = await FeedbackFactory.create(
            user_id=user.id,
            status=FeedbackStatus.UNDER_REVIEW,
        )

        response = await client.patch(
            f"/api/v1/admin/feedback/{feedback.id}",
            json={"admin_response": "Thank you for your feedback! We are working on this."},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["admin_response"] == "Thank you for your feedback! We are working on this."
        assert data["admin_response_at"] is not None

    @pytest.mark.asyncio
    async def test_patch_feedback_auto_status_change(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that adding response without status auto-changes NEW to UNDER_REVIEW."""
        user = await UserFactory.create()
        feedback = await FeedbackFactory.create(
            user_id=user.id,
            status=FeedbackStatus.NEW,
        )

        response = await client.patch(
            f"/api/v1/admin/feedback/{feedback.id}",
            json={"admin_response": "We've received your feedback and are reviewing it."},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        # Should auto-change from NEW to UNDER_REVIEW
        assert data["status"] == "under_review"
        assert data["admin_response"] is not None

    @pytest.mark.asyncio
    async def test_patch_feedback_not_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that updating non-existent feedback returns 404."""
        fake_id = uuid4()
        response = await client.patch(
            f"/api/v1/admin/feedback/{fake_id}",
            json={"status": "planned"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_patch_feedback_response_too_long(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that admin_response exceeding max length returns 422."""
        user = await UserFactory.create()
        feedback = await FeedbackFactory.create(user_id=user.id)

        # Create a response that's too long (over 1000 characters)
        long_response = "x" * 1001

        response = await client.patch(
            f"/api/v1/admin/feedback/{feedback.id}",
            json={"admin_response": long_response},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_patch_feedback_empty_body_returns_422(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that PATCH with neither status nor admin_response returns 422."""
        user = await UserFactory.create()
        feedback = await FeedbackFactory.create(user_id=user.id)

        response = await client.patch(
            f"/api/v1/admin/feedback/{feedback.id}",
            json={},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        error = response.json()
        assert error.get("success") is False
        assert error.get("error", {}).get("code") == "HTTP_422"
        assert "status" in error.get("error", {}).get(
            "message", ""
        ) or "admin_response" in error.get("error", {}).get("message", "")


# =============================================================================
# Admin Feedback Response Structure Tests
# =============================================================================


class TestAdminFeedbackResponseStructure:
    """Test suite for verifying admin feedback response field structure."""

    @pytest.mark.asyncio
    async def test_admin_feedback_response_has_all_fields(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that admin feedback response includes all expected fields."""
        user = await UserFactory.create()
        feedback = await FeedbackFactory.create(
            user_id=user.id,
            title="Test Feedback Title",
            description="Test feedback description with enough content.",
        )

        response = await client.get(
            "/api/v1/admin/feedback",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1

        # Find our feedback item
        item = next((i for i in data["items"] if i["id"] == str(feedback.id)), None)
        assert item is not None

        # Check all expected fields
        assert "id" in item
        assert "title" in item
        assert "description" in item
        assert "category" in item
        assert "status" in item
        assert "vote_count" in item
        assert "admin_response" in item
        assert "admin_response_at" in item
        assert "author" in item
        assert "created_at" in item
        assert "updated_at" in item

        # Check author fields
        assert "id" in item["author"]
        assert "full_name" in item["author"]
