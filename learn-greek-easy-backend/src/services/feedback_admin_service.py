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

        # Track what's being updated for logging
        updates = []

        # Handle status update
        if status is not None:
            old_status = feedback.status
            feedback.status = status
            updates.append(f"status: {old_status.value} -> {status.value}")

        # Handle admin response
        if admin_response is not None:
            feedback.admin_response = admin_response
            feedback.admin_response_at = datetime.now(timezone.utc)
            updates.append("admin_response added")

            # Auto-transition: if response provided without explicit status change
            # and current status is NEW, change to UNDER_REVIEW
            if status is None and feedback.status == FeedbackStatus.NEW:
                feedback.status = FeedbackStatus.UNDER_REVIEW
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

        return feedback
