"""Integration tests for AnnouncementService.

Tests cover:
- Campaign creation with database persistence
- Campaign retrieval with creator loading
- Paginated list retrieval
- Active user count for notification targeting
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.announcement_service import AnnouncementService
from tests.factories import AnnouncementCampaignFactory, UserFactory


@pytest.mark.asyncio
class TestAnnouncementServiceCreateCampaign:
    """Tests for AnnouncementService.create_campaign."""

    async def test_create_campaign_persists_to_database(self, db_session: AsyncSession):
        """create_campaign should persist campaign to database."""
        admin = await UserFactory.create(session=db_session, is_superuser=True)

        service = AnnouncementService(db_session)
        campaign = await service.create_campaign(
            title="System Update",
            message="New features have been released.",
            created_by=admin.id,
            link_url="https://example.com/changelog",
        )
        await db_session.commit()

        assert campaign.id is not None
        assert campaign.title == "System Update"
        assert campaign.message == "New features have been released."
        assert campaign.link_url == "https://example.com/changelog"
        assert campaign.created_by == admin.id
        assert campaign.total_recipients == 0
        assert campaign.read_count == 0

    async def test_create_campaign_without_link_url(self, db_session: AsyncSession):
        """create_campaign should allow None link_url."""
        admin = await UserFactory.create(session=db_session, is_superuser=True)

        service = AnnouncementService(db_session)
        campaign = await service.create_campaign(
            title="Quick Note",
            message="Just a quick update.",
            created_by=admin.id,
        )
        await db_session.commit()

        assert campaign.id is not None
        assert campaign.link_url is None

    async def test_create_campaign_assigns_created_at(self, db_session: AsyncSession):
        """create_campaign should assign created_at timestamp."""
        admin = await UserFactory.create(session=db_session, is_superuser=True)

        service = AnnouncementService(db_session)
        campaign = await service.create_campaign(
            title="Test",
            message="Test message",
            created_by=admin.id,
        )
        await db_session.commit()
        await db_session.refresh(campaign)

        assert campaign.created_at is not None


@pytest.mark.asyncio
class TestAnnouncementServiceGetCampaign:
    """Tests for AnnouncementService.get_campaign."""

    async def test_get_campaign_returns_campaign_with_creator(self, db_session: AsyncSession):
        """get_campaign should return campaign with creator loaded."""
        admin = await UserFactory.create(
            session=db_session,
            is_superuser=True,
            full_name="Admin User",
        )
        campaign = await AnnouncementCampaignFactory.create(
            session=db_session,
            created_by=admin.id,
            title="Test Announcement",
        )

        service = AnnouncementService(db_session)
        result = await service.get_campaign(campaign.id)

        assert result is not None
        assert result.id == campaign.id
        assert result.title == "Test Announcement"
        assert result.creator is not None
        assert result.creator.id == admin.id
        assert result.creator.full_name == "Admin User"

    async def test_get_campaign_returns_none_for_nonexistent(self, db_session: AsyncSession):
        """get_campaign should return None for nonexistent ID."""
        from uuid import uuid4

        service = AnnouncementService(db_session)
        result = await service.get_campaign(uuid4())

        assert result is None


@pytest.mark.asyncio
class TestAnnouncementServiceGetCampaignList:
    """Tests for AnnouncementService.get_campaign_list."""

    async def test_get_campaign_list_with_pagination(self, db_session: AsyncSession):
        """get_campaign_list should return paginated campaigns."""
        admin = await UserFactory.create(session=db_session, is_superuser=True)

        # Create 5 campaigns
        for i in range(5):
            await AnnouncementCampaignFactory.create(
                session=db_session,
                created_by=admin.id,
                title=f"Announcement {i}",
            )

        service = AnnouncementService(db_session)

        # Get first page with page_size=2
        campaigns, total = await service.get_campaign_list(page=1, page_size=2)

        assert total == 5
        assert len(campaigns) == 2

    async def test_get_campaign_list_second_page(self, db_session: AsyncSession):
        """get_campaign_list should return correct second page."""
        admin = await UserFactory.create(session=db_session, is_superuser=True)

        # Create 5 campaigns
        for i in range(5):
            await AnnouncementCampaignFactory.create(
                session=db_session,
                created_by=admin.id,
            )

        service = AnnouncementService(db_session)

        # Get second page with page_size=2
        campaigns, total = await service.get_campaign_list(page=2, page_size=2)

        assert total == 5
        assert len(campaigns) == 2

    async def test_get_campaign_list_ordered_by_created_at_desc(self, db_session: AsyncSession):
        """get_campaign_list should return campaigns ordered by created_at DESC."""
        from datetime import datetime, timedelta, timezone

        admin = await UserFactory.create(session=db_session, is_superuser=True)

        # Create campaigns with explicit timestamps to ensure ordering
        now = datetime.now(timezone.utc)
        older_time = now - timedelta(hours=1)

        # Create older campaign first
        campaign1 = await AnnouncementCampaignFactory.create(
            session=db_session,
            created_by=admin.id,
            title="First (older)",
        )
        # Manually set created_at to older time
        campaign1.created_at = older_time
        await db_session.flush()

        # Create newer campaign
        campaign2 = await AnnouncementCampaignFactory.create(
            session=db_session,
            created_by=admin.id,
            title="Second (newer)",
        )
        # Leave created_at as default (now)

        service = AnnouncementService(db_session)
        campaigns, _ = await service.get_campaign_list(page=1, page_size=10)

        # Most recent (campaign2) should be first
        assert campaigns[0].id == campaign2.id
        assert campaigns[1].id == campaign1.id

    async def test_get_campaign_list_empty(self, db_session: AsyncSession):
        """get_campaign_list should return empty list when no campaigns."""
        service = AnnouncementService(db_session)
        campaigns, total = await service.get_campaign_list(page=1, page_size=20)

        assert total == 0
        assert len(campaigns) == 0

    async def test_get_campaign_list_loads_creator(self, db_session: AsyncSession):
        """get_campaign_list should load creator relationship."""
        admin = await UserFactory.create(
            session=db_session,
            is_superuser=True,
            full_name="Test Admin",
        )
        await AnnouncementCampaignFactory.create(
            session=db_session,
            created_by=admin.id,
        )

        service = AnnouncementService(db_session)
        campaigns, _ = await service.get_campaign_list(page=1, page_size=10)

        assert len(campaigns) == 1
        assert campaigns[0].creator is not None
        assert campaigns[0].creator.full_name == "Test Admin"


@pytest.mark.asyncio
class TestAnnouncementServiceGetActiveUserCount:
    """Tests for AnnouncementService.get_active_user_count."""

    async def test_get_active_user_count(self, db_session: AsyncSession):
        """get_active_user_count should return count of active users."""
        # Create 3 active users
        await UserFactory.create(session=db_session, is_active=True)
        await UserFactory.create(session=db_session, is_active=True)
        await UserFactory.create(session=db_session, is_active=True)
        # Create 1 inactive user
        await UserFactory.create(session=db_session, is_active=False)

        service = AnnouncementService(db_session)
        count = await service.get_active_user_count()

        assert count == 3

    async def test_get_active_user_count_no_users(self, db_session: AsyncSession):
        """get_active_user_count should return 0 when no users."""
        service = AnnouncementService(db_session)
        count = await service.get_active_user_count()

        assert count == 0


@pytest.mark.asyncio
class TestAnnouncementServiceGetActiveUserIds:
    """Tests for AnnouncementService.get_active_user_ids."""

    async def test_get_active_user_ids(self, db_session: AsyncSession):
        """get_active_user_ids should return IDs of active users only."""
        user1 = await UserFactory.create(session=db_session, is_active=True)
        user2 = await UserFactory.create(session=db_session, is_active=True)
        inactive_user = await UserFactory.create(session=db_session, is_active=False)

        service = AnnouncementService(db_session)
        user_ids = await service.get_active_user_ids()

        assert len(user_ids) == 2
        assert user1.id in user_ids
        assert user2.id in user_ids
        assert inactive_user.id not in user_ids


@pytest.mark.asyncio
class TestAnnouncementServiceUpdateRecipientCount:
    """Tests for AnnouncementService.update_recipient_count."""

    async def test_update_recipient_count(self, db_session: AsyncSession):
        """update_recipient_count should update total_recipients."""
        admin = await UserFactory.create(session=db_session, is_superuser=True)
        campaign = await AnnouncementCampaignFactory.create(
            session=db_session,
            created_by=admin.id,
        )

        service = AnnouncementService(db_session)
        await service.update_recipient_count(campaign.id, 150)
        await db_session.commit()
        await db_session.refresh(campaign)

        assert campaign.total_recipients == 150
