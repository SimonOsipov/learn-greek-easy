"""Integration tests for AnnouncementCampaign model."""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import AnnouncementCampaign
from tests.factories import AnnouncementCampaignFactory, UserFactory


@pytest.mark.asyncio
class TestAnnouncementCampaignDatabase:
    """Database integration tests for AnnouncementCampaign."""

    async def test_create_announcement_campaign(self, db_session: AsyncSession):
        """Should create announcement campaign in database."""
        admin = await UserFactory.create(session=db_session, is_superuser=True)

        campaign = AnnouncementCampaign(
            title="System Maintenance",
            message="The system will be down for maintenance on Sunday.",
            link_url="https://example.com/status",
            created_by=admin.id,
        )
        db_session.add(campaign)
        await db_session.commit()
        await db_session.refresh(campaign)

        assert campaign.id is not None
        assert campaign.title == "System Maintenance"
        assert campaign.message == "The system will be down for maintenance on Sunday."
        assert campaign.link_url == "https://example.com/status"
        assert campaign.created_by == admin.id
        assert campaign.total_recipients == 0
        assert campaign.read_count == 0
        assert campaign.created_at is not None
        assert campaign.updated_at is not None

    async def test_create_campaign_without_link_url(self, db_session: AsyncSession):
        """Should allow null link_url."""
        admin = await UserFactory.create(session=db_session, is_superuser=True)

        campaign = AnnouncementCampaign(
            title="Quick Update",
            message="Just a quick note.",
            created_by=admin.id,
        )
        db_session.add(campaign)
        await db_session.commit()
        await db_session.refresh(campaign)

        assert campaign.link_url is None

    async def test_factory_creates_campaign(self, db_session: AsyncSession):
        """Factory should create valid campaign."""
        admin = await UserFactory.create(session=db_session, is_superuser=True)
        campaign = await AnnouncementCampaignFactory.create(
            session=db_session,
            created_by=admin.id,
        )

        assert campaign.id is not None
        assert campaign.title is not None
        assert campaign.message is not None
        assert campaign.created_by == admin.id

    async def test_factory_with_link_trait(self, db_session: AsyncSession):
        """Factory with_link trait should create campaign with link."""
        admin = await UserFactory.create(session=db_session, is_superuser=True)
        campaign = await AnnouncementCampaignFactory.create(
            session=db_session,
            created_by=admin.id,
            with_link=True,
        )

        assert campaign.link_url is not None
        assert campaign.link_url.startswith("http")

    async def test_factory_with_recipients_trait(self, db_session: AsyncSession):
        """Factory with_recipients trait should set recipient counts."""
        admin = await UserFactory.create(session=db_session, is_superuser=True)
        campaign = await AnnouncementCampaignFactory.create(
            session=db_session,
            created_by=admin.id,
            with_recipients=True,
        )

        assert campaign.total_recipients == 100
        assert campaign.read_count == 25

    async def test_cascade_delete_on_user_deletion(self, db_session: AsyncSession):
        """Campaign should be deleted when creator user is deleted."""
        admin = await UserFactory.create(session=db_session, is_superuser=True)
        campaign = await AnnouncementCampaignFactory.create(
            session=db_session,
            created_by=admin.id,
        )
        campaign_id = campaign.id

        # Delete the user
        await db_session.delete(admin)
        await db_session.commit()

        # Verify campaign is also deleted
        result = await db_session.execute(
            select(AnnouncementCampaign).where(AnnouncementCampaign.id == campaign_id)
        )
        assert result.scalar_one_or_none() is None

    async def test_creator_relationship(self, db_session: AsyncSession):
        """Should load creator relationship."""
        admin = await UserFactory.create(session=db_session, is_superuser=True)
        campaign = await AnnouncementCampaignFactory.create(
            session=db_session,
            created_by=admin.id,
        )

        # Refresh to load relationship
        await db_session.refresh(campaign)

        assert campaign.creator is not None
        assert campaign.creator.id == admin.id
        assert campaign.creator.email == admin.email

    async def test_repr(self, db_session: AsyncSession):
        """Should have correct string representation."""
        admin = await UserFactory.create(session=db_session, is_superuser=True)
        campaign = await AnnouncementCampaignFactory.create(
            session=db_session,
            created_by=admin.id,
            title="Test Announcement",
        )

        repr_str = repr(campaign)
        assert "AnnouncementCampaign" in repr_str
        assert "Test Announcement" in repr_str
