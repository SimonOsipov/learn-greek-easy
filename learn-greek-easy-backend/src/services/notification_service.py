"""Notification Service for managing user notifications."""

from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging import get_logger
from src.db.models import FeedbackStatus, Notification, NotificationType
from src.repositories.notification import NotificationRepository

logger = get_logger(__name__)

# Human-readable display names for feedback status values
STATUS_DISPLAY_NAMES: dict[FeedbackStatus, str] = {
    FeedbackStatus.NEW: "New",
    FeedbackStatus.UNDER_REVIEW: "Under Review",
    FeedbackStatus.PLANNED: "Planned",
    FeedbackStatus.IN_PROGRESS: "In Progress",
    FeedbackStatus.COMPLETED: "Completed",
    FeedbackStatus.CANCELLED: "Cancelled",
}


class NotificationService:
    """Service for notification operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = NotificationRepository(db)

    # =========================================================================
    # Core CRUD Operations
    # =========================================================================

    async def create_notification(
        self,
        user_id: UUID,
        type: NotificationType,
        title: str,
        message: str,
        icon: str = "info",
        action_url: Optional[str] = None,
        extra_data: Optional[dict] = None,
    ) -> Notification:
        """Create a new notification for user."""
        notification = Notification(
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            icon=icon,
            action_url=action_url,
            extra_data=extra_data,
        )
        self.db.add(notification)
        await self.db.flush()

        logger.info(
            "Notification created",
            extra={
                "user_id": str(user_id),
                "type": type.value,
                "notification_id": str(notification.id),
            },
        )

        return notification

    async def get_notifications(
        self,
        user_id: UUID,
        limit: int = 20,
        offset: int = 0,
        include_read: bool = True,
    ) -> tuple[list[Notification], int, int]:
        """Get paginated notifications for user.

        Returns: (notifications, unread_count, total_count)
        """
        notifications = await self.repo.get_by_user(user_id, limit, offset, include_read)
        unread_count = await self.repo.get_unread_count(user_id)
        total_count = await self.repo.count_by_user(user_id, include_read)

        return notifications, unread_count, total_count

    async def get_unread_count(self, user_id: UUID) -> int:
        """Get count of unread notifications."""
        return await self.repo.get_unread_count(user_id)

    async def mark_as_read(self, notification_id: UUID, user_id: UUID) -> bool:
        """Mark a single notification as read."""
        updated = await self.repo.mark_as_read(notification_id, user_id)
        if updated:
            logger.debug(
                "Notification marked as read",
                extra={"notification_id": str(notification_id)},
            )
        return updated

    async def mark_all_as_read(self, user_id: UUID) -> int:
        """Mark all notifications as read. Returns count marked."""
        count = await self.repo.mark_all_as_read(user_id)
        logger.info(
            "All notifications marked as read",
            extra={"user_id": str(user_id), "count": count},
        )
        return count

    async def delete_notification(self, notification_id: UUID, user_id: UUID) -> bool:
        """Delete a notification."""
        return await self.repo.delete_by_id(notification_id, user_id)

    async def clear_all(self, user_id: UUID) -> int:
        """Clear all notifications. Returns count deleted."""
        count = await self.repo.delete_all_by_user(user_id)
        logger.info(
            "All notifications cleared",
            extra={"user_id": str(user_id), "count": count},
        )
        return count

    async def cleanup_old_notifications(self, days: int = 30) -> int:
        """Delete notifications older than N days. For scheduled task."""
        count = await self.repo.delete_older_than(days)
        logger.info(
            "Old notifications cleaned up",
            extra={"count": count, "days": days},
        )
        return count

    # =========================================================================
    # Notification Trigger Helpers
    # =========================================================================

    async def notify_achievement_unlocked(
        self,
        user_id: UUID,
        achievement_id: str,
        achievement_name: str,
        icon: str,
        xp_reward: int,
    ) -> Notification:
        """Create notification for achievement unlock."""
        return await self.create_notification(
            user_id=user_id,
            type=NotificationType.ACHIEVEMENT_UNLOCKED,
            title=f"Achievement Unlocked: {achievement_name}",
            message=f"You earned {xp_reward} XP!",
            icon=icon,
            action_url="/achievements",
            extra_data={"achievement_id": achievement_id, "xp_reward": xp_reward},
        )

    async def notify_daily_goal_complete(
        self,
        user_id: UUID,
        reviews_completed: int,
    ) -> Notification:
        """Create notification for daily goal completion."""
        return await self.create_notification(
            user_id=user_id,
            type=NotificationType.DAILY_GOAL_COMPLETE,
            title="Daily Goal Complete!",
            message=f"You reviewed {reviews_completed} cards today. Great job!",
            icon="check-circle",
            action_url="/",
            extra_data={"reviews_completed": reviews_completed},
        )

    async def notify_level_up(
        self,
        user_id: UUID,
        new_level: int,
        level_name: str,
    ) -> Notification:
        """Create notification for level up."""
        return await self.create_notification(
            user_id=user_id,
            type=NotificationType.LEVEL_UP,
            title="Level Up!",
            message=f"You reached Level {new_level}: {level_name}",
            icon="arrow-up",
            action_url="/achievements",
            extra_data={"new_level": new_level, "level_name": level_name},
        )

    async def notify_streak_at_risk(
        self,
        user_id: UUID,
        streak_days: int,
    ) -> Notification:
        """Create notification for streak at risk."""
        return await self.create_notification(
            user_id=user_id,
            type=NotificationType.STREAK_AT_RISK,
            title="Streak at Risk!",
            message=f"Study now to keep your {streak_days}-day streak going!",
            icon="flame",
            action_url="/decks",
            extra_data={"streak_days": streak_days},
        )

    async def notify_streak_lost(
        self,
        user_id: UUID,
        lost_streak: int,
    ) -> Notification:
        """Create notification for streak lost."""
        return await self.create_notification(
            user_id=user_id,
            type=NotificationType.STREAK_LOST,
            title="Streak Lost",
            message=f"Your {lost_streak}-day streak has ended. Start a new one today!",
            icon="broken-heart",
            action_url="/",
            extra_data={"lost_streak": lost_streak},
        )

    async def notify_welcome(self, user_id: UUID) -> Notification:
        """Create welcome notification for new user."""
        return await self.create_notification(
            user_id=user_id,
            type=NotificationType.WELCOME,
            title="Welcome to Greekly!",
            message="Start your Greek learning journey today. Choose a deck to begin!",
            icon="wave",
            action_url="/decks",
        )

    async def notify_feedback_response(
        self,
        user_id: UUID,
        feedback_id: UUID,
        feedback_title: str,
    ) -> Notification:
        """Create notification when admin responds to user's feedback."""
        return await self.create_notification(
            user_id=user_id,
            type=NotificationType.FEEDBACK_RESPONSE,
            title="New Response to Your Feedback",
            message="Your feedback received a response from the developers",
            icon="message-circle",
            action_url=f"/feedback?highlight={feedback_id}",
            extra_data={
                "feedback_id": str(feedback_id),
                "feedback_title": feedback_title,
            },
        )

    async def notify_feedback_status_change(
        self,
        user_id: UUID,
        feedback_id: UUID,
        feedback_title: str,
        new_status: FeedbackStatus,
    ) -> Notification:
        """Create notification when feedback status changes."""
        human_readable_status = STATUS_DISPLAY_NAMES.get(new_status, new_status.value)
        return await self.create_notification(
            user_id=user_id,
            type=NotificationType.FEEDBACK_STATUS_CHANGE,
            title="Feedback Status Updated",
            message=f"Your feedback status changed to: {human_readable_status}",
            icon="info",
            action_url=f"/feedback?highlight={feedback_id}",
            extra_data={
                "feedback_id": str(feedback_id),
                "feedback_title": feedback_title,
                "new_status": new_status.value,
            },
        )
