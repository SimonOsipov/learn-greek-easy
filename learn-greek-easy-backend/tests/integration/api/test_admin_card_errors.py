"""Integration tests for admin card error API endpoints.

This module tests the admin card error endpoints:
- GET /api/v1/admin/card-errors - List all card error reports for admin
- GET /api/v1/admin/card-errors/{id} - Get single card error report
- PATCH /api/v1/admin/card-errors/{id} - Update card error report

Tests cover:
- Authentication requirements (401 without auth)
- Authorization (403 for non-superusers)
- Success cases (200/404)
- Validation errors (422)
- Sorting, filtering, and pagination
- Resolution tracking logic
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardErrorStatus
from tests.factories import CardErrorReportFactory, UserFactory

# =============================================================================
# Admin List Card Errors Endpoint Tests
# =============================================================================


class TestAdminListCardErrorsEndpoint:
    """Test suite for GET /api/v1/admin/card-errors endpoint."""

    @pytest.mark.asyncio
    async def test_list_card_errors_returns_401_without_auth(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated request returns 401 Unauthorized."""
        response = await client.get("/api/v1/admin/card-errors")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_card_errors_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that non-superuser gets 403 Forbidden."""
        response = await client.get(
            "/api/v1/admin/card-errors",
            headers=auth_headers,
        )

        assert response.status_code == 403
        error = response.json()
        assert error.get("success") is False
        assert error.get("error", {}).get("code") == "FORBIDDEN"

    @pytest.mark.asyncio
    async def test_list_card_errors_success_for_superuser(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that superuser can access admin card error list successfully."""
        response = await client.get(
            "/api/v1/admin/card-errors",
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
    async def test_list_card_errors_sorted_pending_first(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that PENDING status items appear first in the list."""
        # Create a user for reports
        user = await UserFactory.create()

        # Create reports with different statuses to test sorting
        await CardErrorReportFactory.create(user_id=user.id, fixed=True, resolved_by=user.id)
        await CardErrorReportFactory.create(user_id=user.id)  # PENDING by default
        await CardErrorReportFactory.create(user_id=user.id, reviewed=True, resolved_by=user.id)

        response = await client.get(
            "/api/v1/admin/card-errors",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        items = data["items"]

        # Find positions of our created reports
        pending_positions = [i for i, item in enumerate(items) if item["status"] == "PENDING"]
        other_positions = [i for i, item in enumerate(items) if item["status"] != "PENDING"]

        # PENDING items should appear before other statuses
        if pending_positions and other_positions:
            assert max(pending_positions) < min(other_positions)

    @pytest.mark.asyncio
    async def test_list_card_errors_with_status_filter(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test filtering card errors by status."""
        user = await UserFactory.create()

        # Create reports with different statuses
        await CardErrorReportFactory.create(user_id=user.id)  # PENDING
        await CardErrorReportFactory.create(user_id=user.id, fixed=True, resolved_by=user.id)
        await CardErrorReportFactory.create(user_id=user.id, fixed=True, resolved_by=user.id)

        response = await client.get(
            "/api/v1/admin/card-errors?status=FIXED",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # All items should have FIXED status
        for item in data["items"]:
            assert item["status"] == "FIXED"

    @pytest.mark.asyncio
    async def test_list_card_errors_with_card_type_filter(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test filtering card errors by card type."""
        user = await UserFactory.create()

        # Create reports with different card types
        await CardErrorReportFactory.create(user_id=user.id)  # VOCABULARY by default
        await CardErrorReportFactory.create(user_id=user.id, culture=True)
        await CardErrorReportFactory.create(user_id=user.id, culture=True)

        response = await client.get(
            "/api/v1/admin/card-errors?card_type=CULTURE",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # All items should have CULTURE card type
        for item in data["items"]:
            assert item["card_type"] == "CULTURE"

    @pytest.mark.asyncio
    async def test_list_card_errors_pagination(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test pagination works correctly."""
        user = await UserFactory.create()

        # Create 5 reports
        for _ in range(5):
            await CardErrorReportFactory.create(user_id=user.id)

        # Get first page of 2
        response = await client.get(
            "/api/v1/admin/card-errors?page=1&page_size=2",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert len(data["items"]) == 2
        assert data["total"] >= 5


# =============================================================================
# Admin Get Card Error Endpoint Tests
# =============================================================================


class TestAdminGetCardErrorEndpoint:
    """Test suite for GET /api/v1/admin/card-errors/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_card_error_returns_401_without_auth(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated request returns 401 Unauthorized."""
        fake_id = uuid4()
        response = await client.get(f"/api/v1/admin/card-errors/{fake_id}")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_card_error_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that non-superuser gets 403 Forbidden."""
        fake_id = uuid4()
        response = await client.get(
            f"/api/v1/admin/card-errors/{fake_id}",
            headers=auth_headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_get_card_error_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test successful retrieval of a card error report."""
        user = await UserFactory.create()
        report = await CardErrorReportFactory.create(user_id=user.id)

        response = await client.get(
            f"/api/v1/admin/card-errors/{report.id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(report.id)
        assert data["card_id"] == str(report.card_id)
        assert data["user_id"] == str(report.user_id)
        assert data["description"] == report.description
        assert "reporter" in data
        assert data["reporter"]["id"] == str(user.id)

    @pytest.mark.asyncio
    async def test_get_card_error_not_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that getting non-existent report returns 404."""
        fake_id = uuid4()
        response = await client.get(
            f"/api/v1/admin/card-errors/{fake_id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404


# =============================================================================
# Admin Update Card Error Endpoint Tests
# =============================================================================


class TestAdminUpdateCardErrorEndpoint:
    """Test suite for PATCH /api/v1/admin/card-errors/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_patch_card_error_returns_401_without_auth(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated request returns 401 Unauthorized."""
        fake_id = uuid4()
        response = await client.patch(
            f"/api/v1/admin/card-errors/{fake_id}",
            json={"status": "FIXED"},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_patch_card_error_non_admin_forbidden(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that non-superuser gets 403 Forbidden."""
        fake_id = uuid4()
        response = await client.patch(
            f"/api/v1/admin/card-errors/{fake_id}",
            json={"status": "FIXED"},
            headers=auth_headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_patch_card_error_status_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test successful status update by superuser."""
        user = await UserFactory.create()
        report = await CardErrorReportFactory.create(
            user_id=user.id,
            status=CardErrorStatus.PENDING,
        )

        response = await client.patch(
            f"/api/v1/admin/card-errors/{report.id}",
            json={"status": "FIXED"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(report.id)
        assert data["status"] == "FIXED"
        assert data["resolved_by"] is not None
        assert data["resolved_at"] is not None

    @pytest.mark.asyncio
    async def test_patch_card_error_with_admin_notes(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test adding admin notes to a card error report."""
        user = await UserFactory.create()
        report = await CardErrorReportFactory.create(
            user_id=user.id,
            status=CardErrorStatus.PENDING,
        )

        response = await client.patch(
            f"/api/v1/admin/card-errors/{report.id}",
            json={"admin_notes": "Fixed the typo in the translation."},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["admin_notes"] == "Fixed the typo in the translation."

    @pytest.mark.asyncio
    async def test_patch_card_error_status_and_notes(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test updating both status and admin notes simultaneously."""
        user = await UserFactory.create()
        report = await CardErrorReportFactory.create(
            user_id=user.id,
            status=CardErrorStatus.PENDING,
        )

        response = await client.patch(
            f"/api/v1/admin/card-errors/{report.id}",
            json={
                "status": "REVIEWED",
                "admin_notes": "Issue confirmed, will be fixed in next release.",
            },
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "REVIEWED"
        assert data["admin_notes"] == "Issue confirmed, will be fixed in next release."
        assert data["resolved_by"] is not None
        assert data["resolved_at"] is not None

    @pytest.mark.asyncio
    async def test_patch_card_error_reopen_clears_resolution(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that changing status back to PENDING clears resolution info."""
        user = await UserFactory.create()
        admin = await UserFactory.create(admin=True)
        report = await CardErrorReportFactory.create(
            user_id=user.id,
            fixed=True,
            resolved_by=admin.id,
        )

        response = await client.patch(
            f"/api/v1/admin/card-errors/{report.id}",
            json={"status": "PENDING"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "PENDING"
        assert data["resolved_by"] is None
        assert data["resolved_at"] is None

    @pytest.mark.asyncio
    async def test_patch_card_error_not_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that updating non-existent report returns 404."""
        fake_id = uuid4()
        response = await client.patch(
            f"/api/v1/admin/card-errors/{fake_id}",
            json={"status": "FIXED"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_patch_card_error_notes_too_long(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that admin_notes exceeding max length returns 422."""
        user = await UserFactory.create()
        report = await CardErrorReportFactory.create(user_id=user.id)

        # Create notes that are too long (over 1000 characters)
        long_notes = "x" * 1001

        response = await client.patch(
            f"/api/v1/admin/card-errors/{report.id}",
            json={"admin_notes": long_notes},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_patch_card_error_empty_body_returns_422(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that PATCH with neither status nor admin_notes returns 422."""
        user = await UserFactory.create()
        report = await CardErrorReportFactory.create(user_id=user.id)

        response = await client.patch(
            f"/api/v1/admin/card-errors/{report.id}",
            json={},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        error = response.json()
        assert error.get("success") is False
        assert error.get("error", {}).get("code") == "HTTP_422"
        assert "status" in error.get("error", {}).get("message", "") or "admin_notes" in error.get(
            "error", {}
        ).get("message", "")


# =============================================================================
# Admin Card Error Response Structure Tests
# =============================================================================


class TestAdminCardErrorResponseStructure:
    """Test suite for verifying admin card error response field structure."""

    @pytest.mark.asyncio
    async def test_admin_card_error_response_has_all_fields(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that admin card error response includes all expected fields."""
        user = await UserFactory.create()
        report = await CardErrorReportFactory.create(
            user_id=user.id,
            description="Test error description for field validation.",
        )

        response = await client.get(
            "/api/v1/admin/card-errors",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1

        # Find our report item
        item = next((i for i in data["items"] if i["id"] == str(report.id)), None)
        assert item is not None

        # Check all expected fields
        assert "id" in item
        assert "card_id" in item
        assert "card_type" in item
        assert "user_id" in item
        assert "description" in item
        assert "status" in item
        assert "admin_notes" in item
        assert "resolved_by" in item
        assert "resolved_at" in item
        assert "reporter" in item
        assert "created_at" in item
        assert "updated_at" in item

        # Check reporter fields
        assert "id" in item["reporter"]
        assert "full_name" in item["reporter"]
