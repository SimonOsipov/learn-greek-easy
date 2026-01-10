"""Admin Feedback Service for managing user feedback submissions."""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging import get_logger
from src.db.models import Feedback, FeedbackCategory, FeedbackStatus
from src.repositories.feedback import FeedbackRepository

logger = get_logger(__name__)


class FeedbackAdminService:
    """Service for admin feedback operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = FeedbackRepository(db)

    async def get_feedback_list_for_admin(
        self,
        status: Optional[FeedbackStatus] = None,
        category: Optional[FeedbackCategory] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Feedback], int]:
        """Get paginated feedback list for admin.

        Returns feedback sorted with NEW status first, then by created_at DESC.

        Args:
            status: Optional status filter
            category: Optional category filter
            page: Page number (1-indexed)
            page_size: Items per page

        Returns:
            Tuple of (feedback items, total count)
        """
        skip = (page - 1) * page_size

        items = await self.repo.list_for_admin(
            status=status,
            category=category,
            skip=skip,
            limit=page_size,
        )

        total = await self.repo.count_with_filters(
            status=status,
            category=category,
        )

        logger.debug(
            "Admin feedback list retrieved",
            extra={
                "count": len(items),
                "total": total,
                "page": page,
                "page_size": page_size,
                "status_filter": status.value if status else None,
                "category_filter": category.value if category else None,
            },
        )

        return items, total

    async def update_feedback_admin(
        self,
        feedback_id: UUID,
        status: Optional[FeedbackStatus] = None,
        admin_response: Optional[str] = None,
    ) -> Feedback:
        """Update feedback status and/or admin response.

        Business logic:
        - If admin_response is provided without status, and current status is NEW,
          auto-change status to UNDER_REVIEW
        - Set admin_response_at timestamp when response is added/updated
        - Send notification to user when response is added or status changes

        Args:
            feedback_id: ID of feedback to update
            status: New status (optional)
            admin_response: Admin's response text (optional)

        Returns:
            Updated Feedback object

        Raises:
            ValueError: If feedback not found
        """
        feedback = await self.repo.get_with_user(feedback_id)

        if feedback is None:
            raise ValueError(f"Feedback with ID '{feedback_id}' not found")

        # Track original status BEFORE any modifications
        old_status = feedback.status

        # Track what's being updated for logging and notifications
        updates = []
        admin_response_changed = False
        status_changed = False

        # Handle status update
        if status is not None and status != feedback.status:
            feedback.status = status
            status_changed = True
            updates.append(f"status: {old_status.value} -> {status.value}")

        # Handle admin response
        if admin_response is not None:
            feedback.admin_response = admin_response
            feedback.admin_response_at = datetime.now(timezone.utc)
            admin_response_changed = True
            updates.append("admin_response added")

            # Auto-transition: if response provided without explicit status change
            # and current status is NEW, change to UNDER_REVIEW
            if status is None and feedback.status == FeedbackStatus.NEW:
                feedback.status = FeedbackStatus.UNDER_REVIEW
                status_changed = True
                updates.append("auto-transition: new -> under_review")

        await self.db.flush()
        await self.db.refresh(feedback)

        logger.info(
            "Admin updated feedback",
            extra={
                "feedback_id": str(feedback_id),
                "updates": updates,
            },
        )

        # Send notification to user (response takes priority over status change)
        await self._send_feedback_notification(
            feedback=feedback,
            old_status=old_status,
            admin_response_changed=admin_response_changed,
            status_changed=status_changed,
        )

        return feedback

    async def _send_feedback_notification(
        self,
        feedback: Feedback,
        old_status: FeedbackStatus,
        admin_response_changed: bool,
        status_changed: bool,
    ) -> None:
        """Send notification to user about feedback updates.

        Deduplication logic: if both response and status changed,
        only send response notification (more important).
        """
        if not admin_response_changed and not status_changed:
            return

        try:
            # Late import to avoid circular dependencies
            from src.services.notification_service import NotificationService

            notification_service = NotificationService(self.db)

            # Response notification takes priority (deduplication)
            if admin_response_changed:
                await notification_service.notify_feedback_response(
                    user_id=feedback.user_id,
                    feedback_id=feedback.id,
                    feedback_title=feedback.title,
                )
                logger.debug(
                    "Feedback response notification sent",
                    extra={"feedback_id": str(feedback.id)},
                )
            elif status_changed:
                # Only send status change if no response was added
                await notification_service.notify_feedback_status_change(
                    user_id=feedback.user_id,
                    feedback_id=feedback.id,
                    feedback_title=feedback.title,
                    new_status=feedback.status,
                )
                logger.debug(
                    "Feedback status change notification sent",
                    extra={
                        "feedback_id": str(feedback.id),
                        "old_status": old_status.value,
                        "new_status": feedback.status.value,
                    },
                )
        except Exception as e:
            # Log error but don't fail the main operation
            logger.error(
                "Failed to send feedback notification",
                extra={
                    "feedback_id": str(feedback.id),
                    "error": str(e),
                },
                exc_info=True,
            )
