"""Announcement campaign repository for database operations."""

from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import AnnouncementCampaign, Notification, NotificationType
from src.repositories.base import BaseRepository


class AnnouncementCampaignRepository(BaseRepository[AnnouncementCampaign]):
    """Repository for AnnouncementCampaign model operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(AnnouncementCampaign, db)

    async def list_with_creator(
        self,
        *,
        skip: int = 0,
        limit: int = 20,
    ) -> list[AnnouncementCampaign]:
        """List announcements with creator loaded, ordered by created_at DESC."""
        query = (
            select(AnnouncementCampaign)
            .options(selectinload(AnnouncementCampaign.creator))
            .order_by(desc(AnnouncementCampaign.created_at))
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_with_creator(self, campaign_id: UUID) -> AnnouncementCampaign | None:
        """Get announcement by ID with creator loaded."""
        query = (
            select(AnnouncementCampaign)
            .options(selectinload(AnnouncementCampaign.creator))
            .where(AnnouncementCampaign.id == campaign_id)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_read_count_from_notifications(self, campaign_id: UUID) -> int:
        """Calculate read count from notifications table.

        Uses PostgreSQL ->> operator to extract text value from JSONB extra_data,
        which returns the value without JSON quotes for proper string comparison.
        """
        query = (
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.type == NotificationType.ADMIN_ANNOUNCEMENT,
                Notification.extra_data.op("->>")("campaign_id") == str(campaign_id),
                Notification.read.is_(True),
            )
        )
        result = await self.db.execute(query)
        return result.scalar() or 0
