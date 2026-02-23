"""Integration tests for DELETE /api/v1/admin/announcements/{id} endpoint.

Tests cover:
- 401 without authentication
- 403 for regular (non-superuser) user
- 204 on successful delete
- 404 when announcement does not exist
- Campaign is actually removed from DB after delete
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories.announcement import AnnouncementCampaignFactory


class TestDeleteAnnouncementEndpoint:
    """Integration tests for DELETE /api/v1/admin/announcements/{id}."""

    # =========================================================================
    # Authentication / Authorization Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_delete_returns_401_without_auth(
        self,
        client: AsyncClient,
    ):
        """Unauthenticated requests must return 401."""
        response = await client.delete(f"/api/v1/admin/announcements/{uuid4()}")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_delete_returns_403_for_regular_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Non-superuser requests must return 403 Forbidden."""
        response = await client.delete(
            f"/api/v1/admin/announcements/{uuid4()}",
            headers=auth_headers,
        )

        assert response.status_code == 403
        error = response.json()
        assert error.get("success") is False
        assert error.get("error", {}).get("code") == "FORBIDDEN"

    # =========================================================================
    # Not-Found Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_delete_returns_404_for_nonexistent(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Request for unknown ID must return 404 Not Found."""
        response = await client.delete(
            f"/api/v1/admin/announcements/{uuid4()}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404

    # =========================================================================
    # Success Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_delete_returns_204_on_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        test_superuser,
        db_session: AsyncSession,
    ):
        """Successful delete must return 204 No Content with empty body."""
        campaign = await AnnouncementCampaignFactory.create(
            session=db_session,
            created_by=test_superuser.id,
            title="Campaign to Delete",
            message="This will be deleted",
        )

        response = await client.delete(
            f"/api/v1/admin/announcements/{campaign.id}",
            headers=superuser_auth_headers,
        )

        assert response.status_code == 204
        assert response.content == b""

    @pytest.mark.asyncio
    async def test_delete_removes_campaign_from_database(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        test_superuser,
        db_session: AsyncSession,
    ):
        """After delete, campaign must no longer be retrievable via GET."""
        campaign = await AnnouncementCampaignFactory.create(
            session=db_session,
            created_by=test_superuser.id,
            title="Gone Campaign",
            message="This will disappear",
        )
        campaign_id = campaign.id

        # Delete the campaign
        delete_response = await client.delete(
            f"/api/v1/admin/announcements/{campaign_id}",
            headers=superuser_auth_headers,
        )
        assert delete_response.status_code == 204

        # Verify it's gone via GET
        get_response = await client.get(
            f"/api/v1/admin/announcements/{campaign_id}",
            headers=superuser_auth_headers,
        )
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_does_not_remove_other_campaigns(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        test_superuser,
        db_session: AsyncSession,
    ):
        """Deleting one campaign must not affect other campaigns."""
        campaign_a = await AnnouncementCampaignFactory.create(
            session=db_session,
            created_by=test_superuser.id,
            title="Campaign A - Keep",
            message="Keep this one",
        )
        campaign_b = await AnnouncementCampaignFactory.create(
            session=db_session,
            created_by=test_superuser.id,
            title="Campaign B - Delete",
            message="Delete this one",
        )

        # Delete campaign B
        await client.delete(
            f"/api/v1/admin/announcements/{campaign_b.id}",
            headers=superuser_auth_headers,
        )

        # Campaign A must still exist
        get_response = await client.get(
            f"/api/v1/admin/announcements/{campaign_a.id}",
            headers=superuser_auth_headers,
        )
        assert get_response.status_code == 200
        assert get_response.json()["title"] == "Campaign A - Keep"

    @pytest.mark.asyncio
    async def test_delete_twice_returns_404_on_second_attempt(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        test_superuser,
        db_session: AsyncSession,
    ):
        """Deleting an already-deleted campaign must return 404."""
        campaign = await AnnouncementCampaignFactory.create(
            session=db_session,
            created_by=test_superuser.id,
            title="Double-Delete Test",
            message="Test idempotency",
        )

        # First delete succeeds
        first = await client.delete(
            f"/api/v1/admin/announcements/{campaign.id}",
            headers=superuser_auth_headers,
        )
        assert first.status_code == 204

        # Second delete returns 404 (already gone)
        second = await client.delete(
            f"/api/v1/admin/announcements/{campaign.id}",
            headers=superuser_auth_headers,
        )
        assert second.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_reduces_list_count(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        test_superuser,
        db_session: AsyncSession,
    ):
        """List total should decrease by 1 after successful delete."""
        # Create 3 campaigns
        campaigns = []
        for i in range(3):
            c = await AnnouncementCampaignFactory.create(
                session=db_session,
                created_by=test_superuser.id,
                title=f"Campaign {i}",
                message=f"Message {i}",
            )
            campaigns.append(c)

        # Verify initial count
        list_before = await client.get(
            "/api/v1/admin/announcements",
            headers=superuser_auth_headers,
        )
        assert list_before.json()["total"] == 3

        # Delete one
        await client.delete(
            f"/api/v1/admin/announcements/{campaigns[0].id}",
            headers=superuser_auth_headers,
        )

        # Verify count decreased
        list_after = await client.get(
            "/api/v1/admin/announcements",
            headers=superuser_auth_headers,
        )
        assert list_after.json()["total"] == 2
