"""Announcement Service for managing admin announcement campaigns."""

from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging import get_logger
from src.db.models import AnnouncementCampaign, User
from src.repositories.announcement import AnnouncementCampaignRepository

logger = get_logger(__name__)


class AnnouncementService:
    """Service for announcement campaign operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = AnnouncementCampaignRepository(db)

    async def create_campaign(
        self,
        title: str,
        message: str,
        created_by: UUID,
        link_url: Optional[str] = None,
    ) -> AnnouncementCampaign:
        """Create a new announcement campaign."""
        campaign = AnnouncementCampaign(
            title=title,
            message=message,
            link_url=link_url,
            created_by=created_by,
            total_recipients=0,
            read_count=0,
        )
        self.db.add(campaign)
        await self.db.flush()

        logger.info(
            "Announcement campaign created",
            extra={
                "campaign_id": str(campaign.id),
                "created_by": str(created_by),
                "title": title[:50],
            },
        )

        return campaign

    async def get_campaign(self, campaign_id: UUID) -> AnnouncementCampaign | None:
        """Get announcement campaign by ID with creator loaded."""
        return await self.repo.get_with_creator(campaign_id)

    async def get_campaign_list(
        self,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AnnouncementCampaign], int]:
        """Get paginated list of announcement campaigns."""
        skip = (page - 1) * page_size
        campaigns = await self.repo.list_with_creator(skip=skip, limit=page_size)
        total = await self.repo.count()
        return campaigns, total

    async def get_active_user_count(self) -> int:
        """Get count of active users for notification targeting."""
        query = select(func.count()).select_from(User).where(User.is_active.is_(True))
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def get_active_user_ids(self) -> list[UUID]:
        """Get all active user IDs for bulk notification creation."""
        query = select(User.id).where(User.is_active.is_(True))
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_recipient_count(
        self,
        campaign_id: UUID,
        total_recipients: int,
    ) -> None:
        """Update the total_recipients count on a campaign."""
        campaign = await self.repo.get(campaign_id)
        if campaign:
            campaign.total_recipients = total_recipients
            await self.db.flush()

    async def refresh_read_count(self, campaign_id: UUID) -> int:
        """Refresh read_count from notifications table."""
        read_count = await self.repo.get_read_count_from_notifications(campaign_id)
        campaign = await self.repo.get(campaign_id)
        if campaign:
            campaign.read_count = read_count
            await self.db.flush()
        return read_count

    @staticmethod
    def calculate_read_percentage(total_recipients: int, read_count: int) -> float:
        """Calculate read percentage for campaign stats."""
        if total_recipients == 0:
            return 0.0
        return round((read_count / total_recipients) * 100, 1)
