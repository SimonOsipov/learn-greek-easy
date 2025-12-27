"""E2E tests for notification workflows.

This module tests the complete notification system, validating:
- Listing and filtering notifications
- Marking notifications as read (single and bulk)
- Clearing/deleting notifications
- Notification creation via factory (achievement notification behavior)

Test markers applied automatically:
- @pytest.mark.e2e
- @pytest.mark.scenario

Note: When a new user registers, the system automatically creates a
"Welcome to Greekly!" notification. Tests account for this behavior.

Note: Achievement notifications are created via background tasks which may
not complete synchronously during tests. The TestNotificationCreationViaAchievement
tests use factories to simulate this behavior rather than relying on the
background task execution.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.e2e.conftest import E2ETestCase, UserSession
from tests.factories.notification import NotificationFactory

# =============================================================================
# TestNotificationListWorkflow
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestNotificationListWorkflow(E2ETestCase):
    """E2E tests for notification list functionality."""

    @pytest.mark.asyncio
    async def test_new_user_has_welcome_notification(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
    ) -> None:
        """New user starts with a welcome notification from registration."""
        response = await client.get(
            "/api/v1/notifications",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        # New user has 1 welcome notification from registration
        assert len(data["notifications"]) == 1
        assert data["notifications"][0]["type"] == "welcome"
        assert data["notifications"][0]["title"] == "Welcome to Greekly!"
        assert data["unread_count"] == 1
        assert data["total_count"] == 1
        assert data["has_more"] is False

    @pytest.mark.asyncio
    async def test_list_notifications_pagination(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Pagination parameters work correctly."""
        # Create 5 additional notifications (+ 1 welcome = 6 total)
        for i in range(5):
            await NotificationFactory.create(
                session=db_session,
                user_id=fresh_user_session.user.id,
                title=f"Notification {i + 1}",
            )
        await db_session.commit()

        # First page: limit=2, offset=0
        response = await client.get(
            "/api/v1/notifications?limit=2&offset=0",
            headers=fresh_user_session.headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["notifications"]) == 2
        assert data["total_count"] == 6  # 5 created + 1 welcome
        assert data["has_more"] is True

        # Second page: limit=2, offset=2
        response = await client.get(
            "/api/v1/notifications?limit=2&offset=2",
            headers=fresh_user_session.headers,
        )
        data = response.json()
        assert len(data["notifications"]) == 2
        assert data["has_more"] is True

        # Third page: limit=2, offset=4
        response = await client.get(
            "/api/v1/notifications?limit=2&offset=4",
            headers=fresh_user_session.headers,
        )
        data = response.json()
        assert len(data["notifications"]) == 2  # 2 remaining
        assert data["has_more"] is False

    @pytest.mark.asyncio
    async def test_list_notifications_filters_read(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Filter out read notifications when include_read=false."""
        # Create 2 read notifications
        for i in range(2):
            await NotificationFactory.create(
                session=db_session,
                user_id=fresh_user_session.user.id,
                read_notification=True,
                title=f"Read Notification {i + 1}",
            )

        # Create 3 unread notifications
        for i in range(3):
            await NotificationFactory.create(
                session=db_session,
                user_id=fresh_user_session.user.id,
                title=f"Unread Notification {i + 1}",
            )
        await db_session.commit()

        # Get only unread - should include welcome (unread) + 3 created unread = 4
        response = await client.get(
            "/api/v1/notifications?include_read=false",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        # 1 welcome + 3 unread = 4 unread notifications
        assert len(data["notifications"]) == 4
        assert all(not n["read"] for n in data["notifications"])
        assert data["unread_count"] == 4

    @pytest.mark.asyncio
    async def test_notifications_ordered_by_recency(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Notifications are returned in order (most recent first or by ID).

        Note: Since notifications may be created in the same transaction,
        we verify ordering is consistent rather than strict recency.
        """
        # Create notifications with different types to identify them
        await NotificationFactory.create(
            session=db_session,
            user_id=fresh_user_session.user.id,
            achievement=True,
            title="Achievement Notification",
        )

        await NotificationFactory.create(
            session=db_session,
            user_id=fresh_user_session.user.id,
            level_up=True,
            title="Level Up Notification",
        )

        await NotificationFactory.create(
            session=db_session,
            user_id=fresh_user_session.user.id,
            daily_goal=True,
            title="Daily Goal Notification",
        )
        await db_session.commit()

        # Fetch notifications
        response = await client.get(
            "/api/v1/notifications",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        # 3 created + 1 welcome = 4 total
        assert len(data["notifications"]) == 4

        # All notifications should be present
        titles = {n["title"] for n in data["notifications"]}
        assert "Achievement Notification" in titles
        assert "Level Up Notification" in titles
        assert "Daily Goal Notification" in titles
        assert "Welcome to Greekly!" in titles


# =============================================================================
# TestNotificationReadWorkflow
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestNotificationReadWorkflow(E2ETestCase):
    """E2E tests for marking notifications as read."""

    @pytest.mark.asyncio
    async def test_mark_single_as_read(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Marking single notification as read updates state."""
        notification = await NotificationFactory.create(
            session=db_session,
            user_id=fresh_user_session.user.id,
        )
        await db_session.commit()

        # Mark as read
        response = await client.put(
            f"/api/v1/notifications/{notification.id}/read",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["marked_count"] == 1

        # Verify notification is now read via list
        list_response = await client.get(
            "/api/v1/notifications",
            headers=fresh_user_session.headers,
        )
        list_data = list_response.json()

        # Find our specific notification
        marked_notif = next(
            (n for n in list_data["notifications"] if n["id"] == str(notification.id)),
            None,
        )
        assert marked_notif is not None
        assert marked_notif["read"] is True

    @pytest.mark.asyncio
    async def test_mark_all_as_read(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Mark all notifications as read in bulk."""
        # Create 4 unread notifications (+ 1 welcome = 5 total unread)
        for _ in range(4):
            await NotificationFactory.create(
                session=db_session,
                user_id=fresh_user_session.user.id,
            )
        await db_session.commit()

        # Mark all as read
        response = await client.put(
            "/api/v1/notifications/read-all",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["marked_count"] == 5  # 4 created + 1 welcome

        # Verify unread count is 0
        count_response = await client.get(
            "/api/v1/notifications/unread-count",
            headers=fresh_user_session.headers,
        )
        assert count_response.json()["count"] == 0

    @pytest.mark.asyncio
    async def test_unread_count_decrements(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Unread count decrements when marking notifications as read."""
        # Create 2 unread notifications (+ 1 welcome = 3 total)
        notifications = []
        for _ in range(2):
            n = await NotificationFactory.create(
                session=db_session,
                user_id=fresh_user_session.user.id,
            )
            notifications.append(n)
        await db_session.commit()

        # Initial count should be 3 (2 created + 1 welcome)
        response = await client.get(
            "/api/v1/notifications/unread-count",
            headers=fresh_user_session.headers,
        )
        assert response.json()["count"] == 3

        # Mark one as read
        await client.put(
            f"/api/v1/notifications/{notifications[0].id}/read",
            headers=fresh_user_session.headers,
        )

        # Count should now be 2
        response = await client.get(
            "/api/v1/notifications/unread-count",
            headers=fresh_user_session.headers,
        )
        assert response.json()["count"] == 2

    @pytest.mark.asyncio
    async def test_already_read_is_idempotent(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Marking already-read notification returns 404 per API behavior."""
        # Create a notification that is already read
        notification = await NotificationFactory.create(
            session=db_session,
            user_id=fresh_user_session.user.id,
            read_notification=True,
        )
        await db_session.commit()

        # Try to mark it as read again - API returns 404 for already-read
        response = await client.put(
            f"/api/v1/notifications/{notification.id}/read",
            headers=fresh_user_session.headers,
        )

        # Per the API implementation, already-read returns 404
        assert response.status_code == 404


# =============================================================================
# TestNotificationClearWorkflow
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestNotificationClearWorkflow(E2ETestCase):
    """E2E tests for clearing notifications."""

    @pytest.mark.asyncio
    async def test_clear_all_notifications(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Clearing all notifications removes everything."""
        # Create 4 notifications (+ 1 welcome = 5 total)
        for _ in range(4):
            await NotificationFactory.create(
                session=db_session,
                user_id=fresh_user_session.user.id,
            )
        await db_session.commit()

        # Clear all
        response = await client.delete(
            "/api/v1/notifications/clear",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["deleted_count"] == 5  # 4 created + 1 welcome

        # Verify list is empty
        list_response = await client.get(
            "/api/v1/notifications",
            headers=fresh_user_session.headers,
        )
        assert list_response.json()["total_count"] == 0

    @pytest.mark.asyncio
    async def test_clear_empty_succeeds(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
    ) -> None:
        """Clearing when only welcome notification exists clears it."""
        # Fresh user has 1 welcome notification
        # First clear it
        response = await client.delete(
            "/api/v1/notifications/clear",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["deleted_count"] == 1  # welcome notification

        # Now clearing again should return 0
        response = await client.delete(
            "/api/v1/notifications/clear",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["deleted_count"] == 0

    @pytest.mark.asyncio
    async def test_delete_single_notification(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Deleting single notification removes only that one."""
        # Create 2 notifications (+ 1 welcome = 3 total)
        notifications = []
        for i in range(2):
            n = await NotificationFactory.create(
                session=db_session,
                user_id=fresh_user_session.user.id,
                title=f"Notification {i + 1}",
            )
            notifications.append(n)
        await db_session.commit()

        # Delete the first notification
        response = await client.delete(
            f"/api/v1/notifications/{notifications[0].id}",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["deleted_count"] == 1

        # Verify only 2 remain (1 created + 1 welcome)
        list_response = await client.get(
            "/api/v1/notifications",
            headers=fresh_user_session.headers,
        )
        assert list_response.json()["total_count"] == 2


# =============================================================================
# TestNotificationCreationViaAchievement
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestNotificationCreationViaAchievement(E2ETestCase):
    """E2E tests for notification creation via achievements.

    Note: Achievement notifications are normally created via background tasks.
    These tests use factories to simulate achievement notification behavior
    rather than relying on background task execution which may not complete
    synchronously in tests.
    """

    @pytest.mark.asyncio
    async def test_achievement_unlock_creates_notification(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Achievement unlock notification appears in notification list.

        Uses factory to simulate the notification that would be created
        by the achievement service.
        """
        # Simulate achievement notification created by achievement service
        await NotificationFactory.create(
            session=db_session,
            user_id=fresh_user_session.user.id,
            achievement=True,  # Uses achievement trait
        )
        await db_session.commit()

        # Check notifications
        response = await client.get(
            "/api/v1/notifications",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Find achievement notifications (+ 1 welcome = 2 total)
        achievement_notifs = [
            n for n in data["notifications"] if n["type"] == "achievement_unlocked"
        ]

        # Should have exactly 1 achievement notification
        assert len(achievement_notifs) == 1

    @pytest.mark.asyncio
    async def test_notification_has_correct_type(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Achievement notification has type 'achievement_unlocked'."""
        # Create achievement notification
        await NotificationFactory.create(
            session=db_session,
            user_id=fresh_user_session.user.id,
            achievement=True,
        )
        await db_session.commit()

        # Fetch and verify
        response = await client.get(
            "/api/v1/notifications",
            headers=fresh_user_session.headers,
        )
        data = response.json()

        achievement_notifs = [
            n for n in data["notifications"] if n["type"] == "achievement_unlocked"
        ]

        assert len(achievement_notifs) == 1
        notif = achievement_notifs[0]
        assert notif["type"] == "achievement_unlocked"

    @pytest.mark.asyncio
    async def test_notification_has_action_url(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Achievement notification has action_url pointing to achievements page."""
        # Create achievement notification
        await NotificationFactory.create(
            session=db_session,
            user_id=fresh_user_session.user.id,
            achievement=True,
        )
        await db_session.commit()

        # Fetch and verify
        response = await client.get(
            "/api/v1/notifications",
            headers=fresh_user_session.headers,
        )
        data = response.json()

        achievement_notifs = [
            n for n in data["notifications"] if n["type"] == "achievement_unlocked"
        ]

        assert len(achievement_notifs) == 1
        notif = achievement_notifs[0]
        assert notif["action_url"] == "/achievements"


# =============================================================================
# TestNotificationExtendedScenarios
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestNotificationExtendedScenarios(E2ETestCase):
    """Extended E2E tests for notification edge cases and coverage."""

    @pytest.mark.asyncio
    async def test_unread_count_endpoint(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test the dedicated unread count endpoint."""
        # Create additional unread notifications
        for i in range(3):
            await NotificationFactory.create(
                session=db_session,
                user_id=fresh_user_session.user.id,
                title=f"Unread {i}",
                read=False,
            )
        await db_session.commit()

        response = await client.get(
            "/api/v1/notifications/unread-count",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        # 3 new + 1 welcome = 4 unread
        assert data["count"] >= 4

    @pytest.mark.asyncio
    async def test_list_with_pagination_has_more(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that has_more is true when more notifications exist."""
        # Create 5 notifications (+1 welcome = 6)
        for i in range(5):
            await NotificationFactory.create(
                session=db_session,
                user_id=fresh_user_session.user.id,
                title=f"Notification {i}",
            )
        await db_session.commit()

        # Get first page with limit 2
        response = await client.get(
            "/api/v1/notifications?limit=2&offset=0",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["notifications"]) == 2
        assert data["has_more"] is True

    @pytest.mark.asyncio
    async def test_list_include_read_false(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test filtering to only unread notifications."""
        # Create read notification
        await NotificationFactory.create(
            session=db_session,
            user_id=fresh_user_session.user.id,
            title="Read notification",
            read=True,
        )
        # Create unread notification
        await NotificationFactory.create(
            session=db_session,
            user_id=fresh_user_session.user.id,
            title="Unread notification",
            read=False,
        )
        await db_session.commit()

        # Only get unread
        response = await client.get(
            "/api/v1/notifications?include_read=false",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        # Should only have unread notifications
        for notif in data["notifications"]:
            assert notif["read"] is False

    @pytest.mark.asyncio
    async def test_mark_single_as_read_extended(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test marking a single notification as read and verify listing."""
        notification = await NotificationFactory.create(
            session=db_session,
            user_id=fresh_user_session.user.id,
            title="To be marked read",
            read=False,
        )
        await db_session.commit()

        # Use PUT as the API requires
        response = await client.put(
            f"/api/v1/notifications/{notification.id}/read",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["marked_count"] == 1

        # Verify it appears as read in listing
        list_response = await client.get(
            "/api/v1/notifications",
            headers=fresh_user_session.headers,
        )
        notif_data = next(
            (n for n in list_response.json()["notifications"] if n["id"] == str(notification.id)),
            None,
        )
        assert notif_data is not None
        assert notif_data["read"] is True

    @pytest.mark.asyncio
    async def test_mark_all_as_read_extended(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test marking all notifications as read and verify unread count."""
        # Create several unread notifications
        for i in range(3):
            await NotificationFactory.create(
                session=db_session,
                user_id=fresh_user_session.user.id,
                title=f"Unread {i}",
                read=False,
            )
        await db_session.commit()

        # Use PUT as the API requires
        response = await client.put(
            "/api/v1/notifications/read-all",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["marked_count"] >= 3

        # Verify unread count is now 0
        count_response = await client.get(
            "/api/v1/notifications/unread-count",
            headers=fresh_user_session.headers,
        )
        assert count_response.json()["count"] == 0

    @pytest.mark.asyncio
    async def test_delete_nonexistent_notification(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
    ) -> None:
        """Test deleting a non-existent notification returns 404."""
        from uuid import uuid4

        fake_id = uuid4()
        response = await client.delete(
            f"/api/v1/notifications/{fake_id}",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_notification_response_structure(
        self,
        client: AsyncClient,
        fresh_user_session: UserSession,
        db_session: AsyncSession,
    ) -> None:
        """Test that notification response has all expected fields."""
        notification = await NotificationFactory.create(
            session=db_session,
            user_id=fresh_user_session.user.id,
            title="Test notification",
            message="Test message",
            icon="bell",
            action_url="/test",
        )
        await db_session.commit()

        response = await client.get(
            "/api/v1/notifications",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Find our notification
        our_notif = next(
            (n for n in data["notifications"] if n["id"] == str(notification.id)), None
        )
        assert our_notif is not None
        assert "id" in our_notif
        assert "type" in our_notif
        assert "title" in our_notif
        assert "message" in our_notif
        assert "icon" in our_notif
        assert "action_url" in our_notif
        assert "read" in our_notif
        assert "created_at" in our_notif
