"""Unit tests for AnnouncementService.delete_campaign.

Tests cover:
- delete_campaign raises NotFoundException for nonexistent campaign
- Static method behaviour (no DB calls needed for those paths)

Note: Integration-level delete tests (that actually commit to DB) live in
tests/integration/services/test_announcement_service_delete.py
"""

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from src.core.exceptions import NotFoundException
from src.services.announcement_service import AnnouncementService


class TestDeleteCampaignNotFound:
    """AnnouncementService.delete_campaign raises NotFoundException when not found."""

    @pytest.mark.asyncio
    async def test_delete_campaign_raises_not_found_when_missing(self):
        """delete_campaign should raise NotFoundException for unknown ID."""
        db = MagicMock()
        db.commit = AsyncMock()

        service = AnnouncementService(db)
        # Patch repo.get to return None (campaign not found)
        service.repo = MagicMock()
        service.repo.get = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await service.delete_campaign(uuid4())

    @pytest.mark.asyncio
    async def test_delete_campaign_calls_repo_delete_when_found(self):
        """delete_campaign should call repo.delete and db.commit when campaign exists."""
        from src.db.models import AnnouncementCampaign

        db = MagicMock()
        db.commit = AsyncMock()

        campaign = MagicMock(spec=AnnouncementCampaign)
        campaign.id = uuid4()

        service = AnnouncementService(db)
        service.repo = MagicMock()
        service.repo.get = AsyncMock(return_value=campaign)
        service.repo.delete = AsyncMock()

        await service.delete_campaign(campaign.id)

        service.repo.delete.assert_awaited_once_with(campaign)
        db.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_delete_campaign_does_not_commit_when_not_found(self):
        """delete_campaign should NOT commit when campaign is missing."""
        db = MagicMock()
        db.commit = AsyncMock()

        service = AnnouncementService(db)
        service.repo = MagicMock()
        service.repo.get = AsyncMock(return_value=None)
        service.repo.delete = AsyncMock()

        with pytest.raises(NotFoundException):
            await service.delete_campaign(uuid4())

        db.commit.assert_not_awaited()
        service.repo.delete.assert_not_awaited()
