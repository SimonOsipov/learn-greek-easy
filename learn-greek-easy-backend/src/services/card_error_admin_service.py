"""Admin Card Error Service for managing card error reports.

This service handles admin-only operations for card error reports:
- Listing reports with PENDING-first sorting
- Retrieving single report details
- Updating report status and admin notes

All methods require admin/superuser authentication at the API layer.
"""

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import NotFoundException
from src.core.logging import get_logger
from src.db.models import CardErrorCardType, CardErrorReport, CardErrorStatus
from src.repositories.card_error import CardErrorReportRepository
from src.schemas.card_error import AdminCardErrorReportUpdate

logger = get_logger(__name__)


class CardErrorAdminService:
    """Service for admin card error report operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CardErrorReportRepository(db)

    async def get_list_for_admin(
        self,
        *,
        card_type: Optional[CardErrorCardType] = None,
        status: Optional[CardErrorStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[CardErrorReport], int]:
        """Get paginated list of card error reports for admin dashboard.

        Returns reports sorted with PENDING status first, then by created_at DESC.

        Args:
            card_type: Filter by card type (WORD or CULTURE)
            status: Filter by report status
            page: Page number (1-indexed)
            page_size: Number of items per page (max 100)

        Returns:
            Tuple of (list of reports with relations, total count)
        """
        skip = (page - 1) * page_size

        reports = await self.repo.list_for_admin(
            card_type=card_type,
            status=status,
            skip=skip,
            limit=page_size,
        )

        total_count = await self.repo.count_with_filters(
            card_type=card_type,
            status=status,
        )

        logger.debug(
            "Admin card error list retrieved",
            extra={
                "count": len(reports),
                "total": total_count,
                "page": page,
                "page_size": page_size,
                "card_type_filter": card_type.value if card_type else None,
                "status_filter": status.value if status else None,
            },
        )

        return reports, total_count

    async def get_report_for_admin(self, report_id: UUID) -> CardErrorReport:
        """Get a single card error report by ID for admin view.

        Args:
            report_id: UUID of the report to retrieve

        Returns:
            CardErrorReport with user and resolver relations loaded

        Raises:
            NotFoundException: If report with given ID does not exist
        """
        report = await self.repo.get_with_relations(report_id)
        if report is None:
            raise NotFoundException(resource="CardErrorReport")
        return report

    async def update_report_for_admin(
        self,
        report_id: UUID,
        admin_user_id: UUID,
        data: AdminCardErrorReportUpdate,
    ) -> CardErrorReport:
        """Update a card error report (admin action).

        Handles resolution tracking: when status changes to REVIEWED, FIXED,
        or DISMISSED, sets resolved_by and resolved_at if not already set.

        Args:
            report_id: UUID of the report to update
            admin_user_id: UUID of the admin performing the update (trusted from API layer)
            data: Update data (status and/or admin_notes)

        Returns:
            Updated CardErrorReport with relations loaded

        Raises:
            NotFoundException: If report with given ID does not exist
        """
        # 1. Fetch existing report
        report = await self.repo.get_with_relations(report_id)
        if report is None:
            raise NotFoundException(resource="CardErrorReport")

        # 2. Build update dict
        update_data: dict[str, Any] = {}

        if data.admin_notes is not None:
            update_data["admin_notes"] = data.admin_notes

        if data.status is not None:
            update_data["status"] = data.status

            # 3. Handle resolution tracking
            resolved_statuses = {
                CardErrorStatus.REVIEWED,
                CardErrorStatus.FIXED,
                CardErrorStatus.DISMISSED,
            }

            if data.status in resolved_statuses and report.resolved_at is None:
                # First time resolving - set resolver info
                update_data["resolved_by"] = admin_user_id
                update_data["resolved_at"] = datetime.now(timezone.utc)
            elif data.status == CardErrorStatus.PENDING:
                # Re-opening: clear resolution info
                update_data["resolved_by"] = None
                update_data["resolved_at"] = None

        # 4. Apply update if any changes
        if update_data:
            await self.repo.update(report, update_data)

        # 5. Log the action
        logger.info(
            "Card error report updated by admin",
            extra={
                "report_id": str(report_id),
                "admin_user_id": str(admin_user_id),
                "new_status": data.status.value if data.status else None,
                "has_admin_notes": data.admin_notes is not None,
            },
        )

        # 6. Return refreshed report with relations
        return await self.repo.get_with_relations(report_id)  # type: ignore[return-value]
