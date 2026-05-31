"""Unit tests for AnnouncementCampaignRepository.

This module tests:
- get_read_count_from_notifications: Count read notifications for a campaign
  using the PostgreSQL JSONB ->> operator against extra_data.campaign_id

Tests use real database fixtures to verify SQL queries work correctly.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import AnnouncementCampaign, NotificationType
from src.repositories.announcement import AnnouncementCampaignRepository
from tests.factories import AnnouncementCampaignFactory, NotificationFactory, UserFactory

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def admin_user(db_session: AsyncSession):
    """Create an admin user who can author announcement campaigns."""
    return await UserFactory.create(session=db_session, is_superuser=True)


@pytest.fixture
async def campaign(db_session: AsyncSession, admin_user):
    """Create an announcement campaign authored by the admin user."""
    return await AnnouncementCampaignFactory.create(
        session=db_session,
        created_by=admin_user.id,
    )


# =============================================================================
# Test get_read_count_from_notifications
# =============================================================================


class TestGetReadCountFromNotifications:
    """Tests for get_read_count_from_notifications method.

    The method uses the PostgreSQL JSONB ->> operator to extract campaign_id
    from extra_data and counts notifications where:
    - type == ADMIN_ANNOUNCEMENT
    - extra_data->>'campaign_id' == str(campaign_id)
    - read IS TRUE
    """

    @pytest.mark.asyncio
    async def test_returns_zero_when_no_notifications_exist(
        self,
        db_session: AsyncSession,
        campaign: AnnouncementCampaign,
    ):
        """Should return 0 when no notification rows exist for the campaign."""
        repo = AnnouncementCampaignRepository(db_session)

        result = await repo.get_read_count_from_notifications(campaign.id)

        assert result == 0

    @pytest.mark.asyncio
    async def test_counts_only_read_notifications(
        self,
        db_session: AsyncSession,
        admin_user,
        campaign: AnnouncementCampaign,
    ):
        """Should count only read=True notifications linked to the campaign."""
        user1 = await UserFactory.create(session=db_session)
        user2 = await UserFactory.create(session=db_session)
        user3 = await UserFactory.create(session=db_session)

        campaign_extra = {"campaign_id": str(campaign.id)}

        # Read notification for user1
        await NotificationFactory.create(
            session=db_session,
            user_id=user1.id,
            type=NotificationType.ADMIN_ANNOUNCEMENT,
            extra_data=campaign_extra,
            read=True,
        )
        # Read notification for user2
        await NotificationFactory.create(
            session=db_session,
            user_id=user2.id,
            type=NotificationType.ADMIN_ANNOUNCEMENT,
            extra_data=campaign_extra,
            read=True,
        )
        # Unread notification for user3 — must NOT be counted
        await NotificationFactory.create(
            session=db_session,
            user_id=user3.id,
            type=NotificationType.ADMIN_ANNOUNCEMENT,
            extra_data=campaign_extra,
            read=False,
        )

        repo = AnnouncementCampaignRepository(db_session)
        result = await repo.get_read_count_from_notifications(campaign.id)

        assert result == 2

    @pytest.mark.asyncio
    async def test_ignores_notifications_for_other_campaigns(
        self,
        db_session: AsyncSession,
        admin_user,
        campaign: AnnouncementCampaign,
    ):
        """Should not count read notifications that belong to a different campaign."""
        other_campaign = await AnnouncementCampaignFactory.create(
            session=db_session,
            created_by=admin_user.id,
        )
        user = await UserFactory.create(session=db_session)

        # Read notification for the *other* campaign — must NOT affect our campaign's count
        await NotificationFactory.create(
            session=db_session,
            user_id=user.id,
            type=NotificationType.ADMIN_ANNOUNCEMENT,
            extra_data={"campaign_id": str(other_campaign.id)},
            read=True,
        )

        repo = AnnouncementCampaignRepository(db_session)
        result = await repo.get_read_count_from_notifications(campaign.id)

        assert result == 0

    @pytest.mark.asyncio
    async def test_ignores_non_announcement_notification_types(
        self,
        db_session: AsyncSession,
        admin_user,
        campaign: AnnouncementCampaign,
    ):
        """Should not count read notifications whose type is not ADMIN_ANNOUNCEMENT."""
        user = await UserFactory.create(session=db_session)

        # A read notification with the correct campaign_id but wrong type
        await NotificationFactory.create(
            session=db_session,
            user_id=user.id,
            type=NotificationType.WELCOME,
            extra_data={"campaign_id": str(campaign.id)},
            read=True,
        )

        repo = AnnouncementCampaignRepository(db_session)
        result = await repo.get_read_count_from_notifications(campaign.id)

        assert result == 0
