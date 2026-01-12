"""Unit tests for NotificationService.

Tests cover:
- Create notification
- Get notifications with pagination
- Mark as read (single and all)
- Clear all notifications
- Notification trigger helpers (achievement, level up, etc.)
"""

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from src.db.models import FeedbackStatus, NotificationType
from src.services.notification_service import NotificationService


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    session = MagicMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.execute = AsyncMock()
    return session


@pytest.fixture
def mock_repo():
    """Create a mock NotificationRepository."""
    repo = MagicMock()
    repo.get_by_user = AsyncMock(return_value=[])
    repo.get_unread_count = AsyncMock(return_value=0)
    repo.count_by_user = AsyncMock(return_value=0)
    repo.mark_as_read = AsyncMock(return_value=True)
    repo.mark_all_as_read = AsyncMock(return_value=5)
    repo.delete_by_id = AsyncMock(return_value=True)
    repo.delete_all_by_user = AsyncMock(return_value=10)
    repo.delete_older_than = AsyncMock(return_value=100)
    return repo


@pytest.fixture
def service(mock_db_session, mock_repo):
    """Create service instance with mocked repo."""
    svc = NotificationService(mock_db_session)
    svc.repo = mock_repo
    return svc


@pytest.mark.unit
class TestCreateNotification:
    """Tests for creating notifications."""

    @pytest.mark.asyncio
    async def test_create_notification_success(self, mock_db_session):
        """Should create a notification with all fields."""
        service = NotificationService(mock_db_session)
        user_id = uuid4()

        notification = await service.create_notification(
            user_id=user_id,
            type=NotificationType.WELCOME,
            title="Welcome!",
            message="Hello there",
            icon="wave",
            action_url="/decks",
            extra_data={"key": "value"},
        )

        assert notification is not None
        assert notification.user_id == user_id
        assert notification.type == NotificationType.WELCOME
        assert notification.title == "Welcome!"
        assert notification.message == "Hello there"
        assert notification.icon == "wave"
        assert notification.action_url == "/decks"
        assert notification.extra_data == {"key": "value"}
        # read is False by default, but may be None in unit test since DB default not applied
        assert notification.read in (False, None)
        mock_db_session.add.assert_called_once()
        mock_db_session.flush.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_create_notification_minimal(self, mock_db_session):
        """Should create notification with minimal required fields."""
        service = NotificationService(mock_db_session)
        user_id = uuid4()

        notification = await service.create_notification(
            user_id=user_id,
            type=NotificationType.WELCOME,
            title="Title",
            message="Message",
        )

        assert notification.icon == "info"  # Default
        assert notification.action_url is None
        assert notification.extra_data is None


@pytest.mark.unit
class TestGetNotifications:
    """Tests for getting notifications."""

    @pytest.mark.asyncio
    async def test_get_notifications_returns_tuple(self, service, mock_repo):
        """Should return notifications, unread_count, total_count."""
        mock_repo.get_by_user.return_value = []
        mock_repo.get_unread_count.return_value = 5
        mock_repo.count_by_user.return_value = 10

        user_id = uuid4()
        notifications, unread_count, total_count = await service.get_notifications(
            user_id=user_id, limit=20, offset=0
        )

        assert notifications == []
        assert unread_count == 5
        assert total_count == 10
        mock_repo.get_by_user.assert_awaited_once_with(user_id, 20, 0, True)

    @pytest.mark.asyncio
    async def test_get_notifications_exclude_read(self, service, mock_repo):
        """Should pass include_read=False to repo."""
        user_id = uuid4()
        await service.get_notifications(user_id=user_id, include_read=False)

        mock_repo.get_by_user.assert_awaited_once_with(user_id, 20, 0, False)


@pytest.mark.unit
class TestGetUnreadCount:
    """Tests for getting unread count."""

    @pytest.mark.asyncio
    async def test_get_unread_count(self, service, mock_repo):
        """Should return unread count from repo."""
        mock_repo.get_unread_count.return_value = 5
        user_id = uuid4()

        count = await service.get_unread_count(user_id)

        assert count == 5
        mock_repo.get_unread_count.assert_awaited_once_with(user_id)


@pytest.mark.unit
class TestMarkAsRead:
    """Tests for marking notifications as read."""

    @pytest.mark.asyncio
    async def test_mark_as_read_success(self, service, mock_repo):
        """Should mark single notification as read."""
        mock_repo.mark_as_read.return_value = True
        notification_id = uuid4()
        user_id = uuid4()

        result = await service.mark_as_read(notification_id, user_id)

        assert result is True
        mock_repo.mark_as_read.assert_awaited_once_with(notification_id, user_id)

    @pytest.mark.asyncio
    async def test_mark_as_read_not_found(self, service, mock_repo):
        """Should return False when notification not found."""
        mock_repo.mark_as_read.return_value = False
        notification_id = uuid4()
        user_id = uuid4()

        result = await service.mark_as_read(notification_id, user_id)

        assert result is False

    @pytest.mark.asyncio
    async def test_mark_all_as_read(self, service, mock_repo):
        """Should mark all notifications as read."""
        mock_repo.mark_all_as_read.return_value = 5
        user_id = uuid4()

        count = await service.mark_all_as_read(user_id)

        assert count == 5
        mock_repo.mark_all_as_read.assert_awaited_once_with(user_id)


@pytest.mark.unit
class TestClearNotifications:
    """Tests for clearing notifications."""

    @pytest.mark.asyncio
    async def test_clear_all(self, service, mock_repo):
        """Should clear all user notifications."""
        mock_repo.delete_all_by_user.return_value = 10
        user_id = uuid4()

        count = await service.clear_all(user_id)

        assert count == 10
        mock_repo.delete_all_by_user.assert_awaited_once_with(user_id)

    @pytest.mark.asyncio
    async def test_delete_notification(self, service, mock_repo):
        """Should delete single notification."""
        mock_repo.delete_by_id.return_value = True
        notification_id = uuid4()
        user_id = uuid4()

        result = await service.delete_notification(notification_id, user_id)

        assert result is True


@pytest.mark.unit
class TestNotificationTriggerHelpers:
    """Tests for notification trigger helper methods."""

    @pytest.mark.asyncio
    async def test_notify_achievement_unlocked(self, mock_db_session):
        """Should create achievement notification with correct data."""
        service = NotificationService(mock_db_session)
        user_id = uuid4()

        notification = await service.notify_achievement_unlocked(
            user_id=user_id,
            achievement_id="streak_first_flame",
            achievement_name="First Flame",
            icon="fire",
            xp_reward=50,
        )

        assert notification.type == NotificationType.ACHIEVEMENT_UNLOCKED
        assert "First Flame" in notification.title
        assert "50 XP" in notification.message
        assert notification.action_url == "/achievements"
        assert notification.extra_data["achievement_id"] == "streak_first_flame"
        assert notification.extra_data["xp_reward"] == 50

    @pytest.mark.asyncio
    async def test_notify_level_up(self, mock_db_session):
        """Should create level up notification."""
        service = NotificationService(mock_db_session)
        user_id = uuid4()

        notification = await service.notify_level_up(
            user_id=user_id,
            new_level=5,
            level_name="Intermediate",
        )

        assert notification.type == NotificationType.LEVEL_UP
        assert "Level 5" in notification.message
        assert "Intermediate" in notification.message
        assert notification.action_url == "/profile"

    @pytest.mark.asyncio
    async def test_notify_daily_goal_complete(self, mock_db_session):
        """Should create daily goal notification."""
        service = NotificationService(mock_db_session)
        user_id = uuid4()

        notification = await service.notify_daily_goal_complete(
            user_id=user_id,
            reviews_completed=20,
        )

        assert notification.type == NotificationType.DAILY_GOAL_COMPLETE
        assert "20 cards" in notification.message

    @pytest.mark.asyncio
    async def test_notify_streak_at_risk(self, mock_db_session):
        """Should create streak at risk notification."""
        service = NotificationService(mock_db_session)
        user_id = uuid4()

        notification = await service.notify_streak_at_risk(
            user_id=user_id,
            streak_days=7,
        )

        assert notification.type == NotificationType.STREAK_AT_RISK
        assert "7-day streak" in notification.message

    @pytest.mark.asyncio
    async def test_notify_streak_lost(self, mock_db_session):
        """Should create streak lost notification."""
        service = NotificationService(mock_db_session)
        user_id = uuid4()

        notification = await service.notify_streak_lost(
            user_id=user_id,
            lost_streak=14,
        )

        assert notification.type == NotificationType.STREAK_LOST
        assert "14-day streak" in notification.message

    @pytest.mark.asyncio
    async def test_notify_welcome(self, mock_db_session):
        """Should create welcome notification."""
        service = NotificationService(mock_db_session)
        user_id = uuid4()

        notification = await service.notify_welcome(user_id=user_id)

        assert notification.type == NotificationType.WELCOME
        assert "Welcome" in notification.title
        assert notification.action_url == "/decks"

    @pytest.mark.asyncio
    async def test_notify_feedback_response(self, mock_db_session):
        """Should create feedback response notification with correct data."""
        service = NotificationService(mock_db_session)
        user_id = uuid4()
        feedback_id = uuid4()

        notification = await service.notify_feedback_response(
            user_id=user_id,
            feedback_id=feedback_id,
            feedback_title="Add dark mode",
        )

        assert notification.type == NotificationType.FEEDBACK_RESPONSE
        assert "Response" in notification.title
        assert notification.icon == "message-circle"
        assert f"highlight={feedback_id}" in notification.action_url
        assert notification.extra_data["feedback_id"] == str(feedback_id)
        assert notification.extra_data["feedback_title"] == "Add dark mode"

    @pytest.mark.asyncio
    async def test_notify_feedback_status_change(self, mock_db_session):
        """Should create feedback status change notification with human-readable status."""
        service = NotificationService(mock_db_session)
        user_id = uuid4()
        feedback_id = uuid4()

        notification = await service.notify_feedback_status_change(
            user_id=user_id,
            feedback_id=feedback_id,
            feedback_title="Bug report",
            new_status=FeedbackStatus.IN_PROGRESS,
        )

        assert notification.type == NotificationType.FEEDBACK_STATUS_CHANGE
        assert "Status Updated" in notification.title
        assert "In Progress" in notification.message  # Human-readable status
        assert f"highlight={feedback_id}" in notification.action_url
        assert notification.extra_data["feedback_id"] == str(feedback_id)
        assert notification.extra_data["feedback_title"] == "Bug report"
        assert notification.extra_data["new_status"] == "in_progress"

    @pytest.mark.asyncio
    async def test_notify_feedback_status_change_completed(self, mock_db_session):
        """Should show 'Completed' as human-readable status."""
        service = NotificationService(mock_db_session)
        user_id = uuid4()
        feedback_id = uuid4()

        notification = await service.notify_feedback_status_change(
            user_id=user_id,
            feedback_id=feedback_id,
            feedback_title="Feature request",
            new_status=FeedbackStatus.COMPLETED,
        )

        assert "Completed" in notification.message


@pytest.mark.unit
class TestCleanupOldNotifications:
    """Tests for cleanup job."""

    @pytest.mark.asyncio
    async def test_cleanup_old_notifications(self, service, mock_repo):
        """Should delete notifications older than N days."""
        mock_repo.delete_older_than.return_value = 100

        count = await service.cleanup_old_notifications(days=30)

        assert count == 100
        mock_repo.delete_older_than.assert_awaited_once_with(30)
