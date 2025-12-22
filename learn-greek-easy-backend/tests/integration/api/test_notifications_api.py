"""Integration tests for Notification API endpoints.

Tests cover:
- GET /api/v1/notifications - List notifications
- GET /api/v1/notifications/unread-count - Get unread count
- PUT /api/v1/notifications/read-all - Mark all as read
- PUT /api/v1/notifications/{id}/read - Mark single as read
- DELETE /api/v1/notifications/clear - Clear all
- DELETE /api/v1/notifications/{id} - Delete single
- Authentication requirements for all endpoints
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories.auth import UserFactory
from tests.factories.notification import NotificationFactory


@pytest.mark.integration
class TestListNotificationsEndpoint:
    """Tests for GET /api/v1/notifications endpoint."""

    @pytest.mark.asyncio
    async def test_requires_authentication(self, client: AsyncClient):
        """Should return 401 without authentication."""
        response = await client.get("/api/v1/notifications")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_empty(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Should return empty list for user with no notifications."""
        response = await client.get(
            "/api/v1/notifications",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["notifications"] == []
        assert data["unread_count"] == 0
        assert data["total_count"] == 0
        assert data["has_more"] is False

    @pytest.mark.asyncio
    async def test_list_with_notifications(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Should return notifications for user."""
        # Create notifications
        await NotificationFactory.create(session=db_session, user_id=test_user.id, welcome=True)
        await NotificationFactory.create(session=db_session, user_id=test_user.id, achievement=True)
        await db_session.commit()

        response = await client.get(
            "/api/v1/notifications",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["notifications"]) == 2
        assert data["unread_count"] == 2
        assert data["total_count"] == 2

        # Verify notification structure
        notif = data["notifications"][0]
        assert "id" in notif
        assert "type" in notif
        assert "title" in notif
        assert "message" in notif
        assert "icon" in notif
        assert "read" in notif
        assert "created_at" in notif

    @pytest.mark.asyncio
    async def test_list_pagination(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Should support pagination."""
        # Create 5 notifications
        for _ in range(5):
            await NotificationFactory.create(session=db_session, user_id=test_user.id)
        await db_session.commit()

        # Get first page
        response = await client.get(
            "/api/v1/notifications?limit=2&offset=0",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["notifications"]) == 2
        assert data["total_count"] == 5
        assert data["has_more"] is True

        # Get second page
        response = await client.get(
            "/api/v1/notifications?limit=2&offset=2",
            headers=auth_headers,
        )

        data = response.json()
        assert len(data["notifications"]) == 2
        assert data["has_more"] is True

    @pytest.mark.asyncio
    async def test_exclude_read_notifications(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Should filter out read notifications when requested."""
        # Create read and unread notifications
        await NotificationFactory.create(
            session=db_session, user_id=test_user.id, read_notification=True
        )
        await NotificationFactory.create(session=db_session, user_id=test_user.id)
        await db_session.commit()

        response = await client.get(
            "/api/v1/notifications?include_read=false",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["notifications"]) == 1
        assert data["notifications"][0]["read"] is False


@pytest.mark.integration
class TestUnreadCountEndpoint:
    """Tests for GET /api/v1/notifications/unread-count endpoint."""

    @pytest.mark.asyncio
    async def test_requires_authentication(self, client: AsyncClient):
        """Should return 401 without authentication."""
        response = await client.get("/api/v1/notifications/unread-count")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_unread_count_zero(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Should return 0 for user with no notifications."""
        response = await client.get(
            "/api/v1/notifications/unread-count",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 0

    @pytest.mark.asyncio
    async def test_unread_count_with_notifications(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Should return correct unread count."""
        # Create 3 unread, 2 read
        for _ in range(3):
            await NotificationFactory.create(session=db_session, user_id=test_user.id)
        for _ in range(2):
            await NotificationFactory.create(
                session=db_session, user_id=test_user.id, read_notification=True
            )
        await db_session.commit()

        response = await client.get(
            "/api/v1/notifications/unread-count",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 3


@pytest.mark.integration
class TestMarkAllAsReadEndpoint:
    """Tests for PUT /api/v1/notifications/read-all endpoint."""

    @pytest.mark.asyncio
    async def test_requires_authentication(self, client: AsyncClient):
        """Should return 401 without authentication."""
        response = await client.put("/api/v1/notifications/read-all")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_mark_all_as_read(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Should mark all notifications as read."""
        # Create unread notifications
        for _ in range(3):
            await NotificationFactory.create(session=db_session, user_id=test_user.id)
        await db_session.commit()

        response = await client.put(
            "/api/v1/notifications/read-all",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["marked_count"] == 3

        # Verify unread count is now 0
        response = await client.get(
            "/api/v1/notifications/unread-count",
            headers=auth_headers,
        )
        assert response.json()["count"] == 0


@pytest.mark.integration
class TestMarkSingleAsReadEndpoint:
    """Tests for PUT /api/v1/notifications/{id}/read endpoint."""

    @pytest.mark.asyncio
    async def test_requires_authentication(self, client: AsyncClient):
        """Should return 401 without authentication."""
        fake_id = uuid4()
        response = await client.put(f"/api/v1/notifications/{fake_id}/read")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_mark_single_as_read(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Should mark single notification as read."""
        notification = await NotificationFactory.create(session=db_session, user_id=test_user.id)
        await db_session.commit()

        response = await client.put(
            f"/api/v1/notifications/{notification.id}/read",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["marked_count"] == 1

    @pytest.mark.asyncio
    async def test_mark_nonexistent_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Should return 404 for non-existent notification."""
        fake_id = uuid4()
        response = await client.put(
            f"/api/v1/notifications/{fake_id}/read",
            headers=auth_headers,
        )

        assert response.status_code == 404


@pytest.mark.integration
class TestClearAllEndpoint:
    """Tests for DELETE /api/v1/notifications/clear endpoint."""

    @pytest.mark.asyncio
    async def test_requires_authentication(self, client: AsyncClient):
        """Should return 401 without authentication."""
        response = await client.delete("/api/v1/notifications/clear")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_clear_all(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Should delete all notifications."""
        # Create notifications
        for _ in range(5):
            await NotificationFactory.create(session=db_session, user_id=test_user.id)
        await db_session.commit()

        response = await client.delete(
            "/api/v1/notifications/clear",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["deleted_count"] == 5

        # Verify list is empty
        response = await client.get(
            "/api/v1/notifications",
            headers=auth_headers,
        )
        assert response.json()["total_count"] == 0


@pytest.mark.integration
class TestDeleteSingleEndpoint:
    """Tests for DELETE /api/v1/notifications/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_requires_authentication(self, client: AsyncClient):
        """Should return 401 without authentication."""
        fake_id = uuid4()
        response = await client.delete(f"/api/v1/notifications/{fake_id}")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_delete_single(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Should delete single notification."""
        notification = await NotificationFactory.create(session=db_session, user_id=test_user.id)
        await db_session.commit()

        response = await client.delete(
            f"/api/v1/notifications/{notification.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["deleted_count"] == 1

    @pytest.mark.asyncio
    async def test_delete_nonexistent_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Should return 404 for non-existent notification."""
        fake_id = uuid4()
        response = await client.delete(
            f"/api/v1/notifications/{fake_id}",
            headers=auth_headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_cannot_delete_other_users_notification(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Should not allow deleting another user's notification."""
        # Create another user and their notification
        other_user = await UserFactory.create(session=db_session)
        notification = await NotificationFactory.create(session=db_session, user_id=other_user.id)
        await db_session.commit()

        response = await client.delete(
            f"/api/v1/notifications/{notification.id}",
            headers=auth_headers,
        )

        assert response.status_code == 404
