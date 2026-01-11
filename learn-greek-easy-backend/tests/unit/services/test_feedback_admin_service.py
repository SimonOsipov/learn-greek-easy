"""Unit tests for FeedbackAdminService.

Tests cover:
- Auto-status logic when adding admin response
- Timestamp setting on admin_response_at
- Notification deduplication (response takes priority over status)
- Get feedback list for admin
- Error handling when feedback not found

All tests use mocked dependencies for isolation.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.db.models import Feedback, FeedbackCategory, FeedbackStatus, User
from src.services.feedback_admin_service import FeedbackAdminService

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    session = MagicMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    return session


@pytest.fixture
def mock_repo():
    """Create a mock FeedbackRepository."""
    repo = MagicMock()
    repo.get_with_user = AsyncMock()
    repo.list_for_admin = AsyncMock(return_value=[])
    repo.count_with_filters = AsyncMock(return_value=0)
    return repo


@pytest.fixture
def mock_user():
    """Create a mock user for feedback."""
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.full_name = "Test User"
    return user


@pytest.fixture
def mock_feedback(mock_user):
    """Create a mock feedback object with NEW status."""
    feedback = MagicMock(spec=Feedback)
    feedback.id = uuid4()
    feedback.title = "Test Feedback"
    feedback.description = "Test description with enough length."
    feedback.category = FeedbackCategory.FEATURE_REQUEST
    feedback.status = FeedbackStatus.NEW
    feedback.vote_count = 0
    feedback.admin_response = None
    feedback.admin_response_at = None
    feedback.user_id = mock_user.id
    feedback.user = mock_user
    feedback.created_at = datetime.now(timezone.utc)
    feedback.updated_at = datetime.now(timezone.utc)
    return feedback


@pytest.fixture
def service(mock_db_session, mock_repo):
    """Create service instance with mocked repo."""
    svc = FeedbackAdminService(mock_db_session)
    svc.repo = mock_repo
    return svc


# =============================================================================
# Test Update Feedback Admin - Auto Status
# =============================================================================


@pytest.mark.unit
class TestUpdateFeedbackAdminAutoStatus:
    """Tests for auto-status logic when adding admin response."""

    @pytest.mark.asyncio
    async def test_update_with_response_auto_changes_status_from_new(
        self, service, mock_repo, mock_feedback
    ):
        """When admin_response is provided without explicit status and status is NEW,
        should auto-change status to UNDER_REVIEW.
        """
        # Arrange
        mock_feedback.status = FeedbackStatus.NEW
        mock_repo.get_with_user.return_value = mock_feedback

        # Patch NotificationService where it's imported (inside the method)
        with patch(
            "src.services.notification_service.NotificationService"
        ) as mock_notification_cls:
            mock_notification = MagicMock()
            mock_notification.notify_feedback_response = AsyncMock()
            mock_notification_cls.return_value = mock_notification

            # Act
            result = await service.update_feedback_admin(
                feedback_id=mock_feedback.id,
                admin_response="Thank you for your feedback!",
            )

            # Assert
            assert result.status == FeedbackStatus.UNDER_REVIEW
            assert result.admin_response == "Thank you for your feedback!"

    @pytest.mark.asyncio
    async def test_update_with_response_keeps_explicit_status(
        self, service, mock_repo, mock_feedback
    ):
        """When both admin_response and explicit status are provided,
        should use the explicit status and not auto-change.
        """
        # Arrange
        mock_feedback.status = FeedbackStatus.NEW
        mock_repo.get_with_user.return_value = mock_feedback

        with patch(
            "src.services.notification_service.NotificationService"
        ) as mock_notification_cls:
            mock_notification = MagicMock()
            mock_notification.notify_feedback_response = AsyncMock()
            mock_notification_cls.return_value = mock_notification

            # Act
            result = await service.update_feedback_admin(
                feedback_id=mock_feedback.id,
                status=FeedbackStatus.PLANNED,
                admin_response="We're planning to implement this.",
            )

            # Assert
            assert result.status == FeedbackStatus.PLANNED
            assert result.admin_response == "We're planning to implement this."

    @pytest.mark.asyncio
    async def test_update_response_no_auto_change_if_not_new(
        self, service, mock_repo, mock_feedback
    ):
        """When admin_response is provided and status is not NEW,
        should NOT auto-change status.
        """
        # Arrange
        mock_feedback.status = FeedbackStatus.UNDER_REVIEW
        mock_repo.get_with_user.return_value = mock_feedback

        with patch(
            "src.services.notification_service.NotificationService"
        ) as mock_notification_cls:
            mock_notification = MagicMock()
            mock_notification.notify_feedback_response = AsyncMock()
            mock_notification_cls.return_value = mock_notification

            # Act
            result = await service.update_feedback_admin(
                feedback_id=mock_feedback.id,
                admin_response="Still reviewing this.",
            )

            # Assert - status should remain UNDER_REVIEW
            assert result.status == FeedbackStatus.UNDER_REVIEW


# =============================================================================
# Test Update Feedback Admin - Timestamp
# =============================================================================


@pytest.mark.unit
class TestUpdateFeedbackAdminTimestamp:
    """Tests for admin_response_at timestamp setting."""

    @pytest.mark.asyncio
    async def test_update_sets_admin_response_at_timestamp(self, service, mock_repo, mock_feedback):
        """When admin_response is provided, should set admin_response_at timestamp."""
        # Arrange
        mock_feedback.admin_response_at = None
        mock_repo.get_with_user.return_value = mock_feedback
        before_update = datetime.now(timezone.utc)

        with patch(
            "src.services.notification_service.NotificationService"
        ) as mock_notification_cls:
            mock_notification = MagicMock()
            mock_notification.notify_feedback_response = AsyncMock()
            mock_notification_cls.return_value = mock_notification

            # Act
            await service.update_feedback_admin(
                feedback_id=mock_feedback.id,
                admin_response="Response text",
            )

            # Assert
            assert mock_feedback.admin_response_at is not None
            assert mock_feedback.admin_response_at >= before_update


# =============================================================================
# Test Notification Deduplication
# =============================================================================


@pytest.mark.unit
class TestNotificationDeduplication:
    """Tests for notification deduplication logic."""

    @pytest.mark.asyncio
    async def test_notification_deduplication_prioritizes_response(
        self, service, mock_repo, mock_feedback
    ):
        """When both response and status change, only response notification is sent."""
        # Arrange
        mock_feedback.status = FeedbackStatus.NEW
        mock_repo.get_with_user.return_value = mock_feedback

        with patch(
            "src.services.notification_service.NotificationService"
        ) as mock_notification_cls:
            mock_notification = MagicMock()
            mock_notification.notify_feedback_response = AsyncMock()
            mock_notification.notify_feedback_status_change = AsyncMock()
            mock_notification_cls.return_value = mock_notification

            # Act - both response and status change
            await service.update_feedback_admin(
                feedback_id=mock_feedback.id,
                status=FeedbackStatus.PLANNED,
                admin_response="We're implementing this feature.",
            )

            # Assert - only response notification, not status change
            mock_notification.notify_feedback_response.assert_awaited_once()
            mock_notification.notify_feedback_status_change.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_notification_sent_for_status_only_change(
        self, service, mock_repo, mock_feedback
    ):
        """When only status changes (no response), status change notification is sent."""
        # Arrange
        mock_feedback.status = FeedbackStatus.NEW
        mock_repo.get_with_user.return_value = mock_feedback

        with patch(
            "src.services.notification_service.NotificationService"
        ) as mock_notification_cls:
            mock_notification = MagicMock()
            mock_notification.notify_feedback_response = AsyncMock()
            mock_notification.notify_feedback_status_change = AsyncMock()
            mock_notification_cls.return_value = mock_notification

            # Act - only status change, no response
            await service.update_feedback_admin(
                feedback_id=mock_feedback.id,
                status=FeedbackStatus.UNDER_REVIEW,
            )

            # Assert - only status change notification
            mock_notification.notify_feedback_status_change.assert_awaited_once()
            mock_notification.notify_feedback_response.assert_not_awaited()


# =============================================================================
# Test Get Feedback List for Admin
# =============================================================================


@pytest.mark.unit
class TestGetFeedbackListForAdmin:
    """Tests for get_feedback_list_for_admin method."""

    @pytest.mark.asyncio
    async def test_returns_items_and_total(self, service, mock_repo, mock_feedback):
        """Should return tuple of items and total count."""
        # Arrange
        mock_repo.list_for_admin.return_value = [mock_feedback]
        mock_repo.count_with_filters.return_value = 1

        # Act
        items, total = await service.get_feedback_list_for_admin(
            page=1,
            page_size=10,
        )

        # Assert
        assert len(items) == 1
        assert total == 1
        mock_repo.list_for_admin.assert_awaited_once()
        mock_repo.count_with_filters.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_calculates_skip_from_page(self, service, mock_repo):
        """Should calculate correct skip value from page number."""
        # Arrange
        mock_repo.list_for_admin.return_value = []
        mock_repo.count_with_filters.return_value = 0

        # Act
        await service.get_feedback_list_for_admin(
            page=3,
            page_size=20,
        )

        # Assert - page 3 with page_size 20 = skip 40
        mock_repo.list_for_admin.assert_awaited_once_with(
            status=None,
            category=None,
            skip=40,  # (3-1) * 20 = 40
            limit=20,
        )


# =============================================================================
# Test Update Feedback Admin - Not Found
# =============================================================================


@pytest.mark.unit
class TestUpdateFeedbackAdminNotFound:
    """Tests for error handling when feedback not found."""

    @pytest.mark.asyncio
    async def test_raises_valueerror_when_not_found(self, service, mock_repo):
        """Should raise ValueError when feedback ID doesn't exist."""
        # Arrange
        mock_repo.get_with_user.return_value = None
        fake_id = uuid4()

        # Act & Assert
        with pytest.raises(ValueError, match=f"Feedback with ID '{fake_id}' not found"):
            await service.update_feedback_admin(
                feedback_id=fake_id,
                status=FeedbackStatus.PLANNED,
            )
