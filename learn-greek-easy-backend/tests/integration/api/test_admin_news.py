"""Integration tests for admin news API endpoints.

This module tests the admin news delete endpoint auth/authz
and the 501 Not Implemented response now that admin writes are disabled.
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient

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
    async def test_delete_returns_501_not_implemented(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Delete endpoint returns 501 while admin writes are disabled."""
        fake_id = uuid4()
        response = await client.delete(
            f"/api/v1/admin/news/{fake_id}",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 501
