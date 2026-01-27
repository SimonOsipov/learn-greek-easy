"""Announcement campaign test factories.

This module provides factories for announcement-related models:
- AnnouncementCampaignFactory: Announcement campaigns for admin broadcasts

Usage:
    # Create an announcement campaign
    campaign = await AnnouncementCampaignFactory.create(
        session=db_session, created_by=admin.id
    )

    # Create campaign with link
    campaign = await AnnouncementCampaignFactory.create(
        session=db_session, created_by=admin.id, with_link=True
    )

    # Create campaign with recipients
    campaign = await AnnouncementCampaignFactory.create(
        session=db_session, created_by=admin.id, with_recipients=True
    )
"""

from __future__ import annotations

import factory

from src.db.models import AnnouncementCampaign

from .base import BaseFactory


class AnnouncementCampaignFactory(BaseFactory):
    """Factory for AnnouncementCampaign model.

    Creates announcement campaign records for admin broadcasts.

    Traits:
        with_link: Include a link URL
        with_recipients: Include recipient count (simulates sent announcement)

    Example:
        campaign = await AnnouncementCampaignFactory.create(
            session=db_session, created_by=admin.id
        )
    """

    class Meta:
        model = AnnouncementCampaign

    # Required: Must be provided
    created_by = None  # Must be set explicitly

    # Content
    title = factory.Sequence(lambda n: f"Announcement {n}")
    message = factory.Faker("paragraph", nb_sentences=3)
    link_url = None

    # Statistics (default: not sent yet)
    total_recipients = 0
    read_count = 0

    class Params:
        """Factory traits."""

        # Include a link URL
        with_link = factory.Trait(
            link_url=factory.Faker("url"),
        )

        # Simulate sent announcement with recipients
        with_recipients = factory.Trait(
            total_recipients=100,
            read_count=25,
        )
