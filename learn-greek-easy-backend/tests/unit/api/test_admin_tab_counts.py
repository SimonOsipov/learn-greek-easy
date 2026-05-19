"""Unit tests for GET /api/v1/admin/tab-counts endpoint.

Tests cover:
- Seeded counts: verifies each badge count reflects inserted rows.
- Empty-DB baseline: all nine fields return 0 when no content rows exist.
- Authentication requirement: 401 without token.
- Authorization requirement: 403 for non-superuser, with correct error shape.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardErrorStatus, ChangelogEntry, ChangelogTag, FeedbackStatus, User
from tests.factories.announcement import AnnouncementCampaignFactory
from tests.factories.card_error import CardErrorReportFactory
from tests.factories.feedback import FeedbackFactory
from tests.factories.news import NewsItemFactory

_ENDPOINT = "/api/v1/admin/tab-counts"


class TestAdminTabCounts:
    """Tests for GET /api/v1/admin/tab-counts endpoint."""

    @pytest.mark.asyncio
    async def test_returns_seeded_counts(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        test_superuser: User,
    ):
        """Seeded rows are reflected in badge counts."""
        # 2 announcement campaigns
        await AnnouncementCampaignFactory.create(session=db_session, created_by=test_superuser.id)
        await AnnouncementCampaignFactory.create(session=db_session, created_by=test_superuser.id)

        # 1 changelog entry — use raw ORM; no ChangelogEntryFactory detected
        db_session.add(
            ChangelogEntry(
                title_en="Test entry",
                content_en="Test content",
                title_ru="Тест",
                content_ru="Тест содержимое",
                tag=ChangelogTag.NEW_FEATURE,
            )
        )

        # 2 feedback rows: one NEW, one COMPLETED
        await FeedbackFactory.create(
            session=db_session,
            user_id=test_superuser.id,
            status=FeedbackStatus.NEW,
        )
        await FeedbackFactory.create(
            session=db_session,
            user_id=test_superuser.id,
            status=FeedbackStatus.COMPLETED,
        )

        # 2 card error reports: one PENDING, one FIXED
        await CardErrorReportFactory.create(
            session=db_session,
            user_id=test_superuser.id,
            status=CardErrorStatus.PENDING,
        )
        await CardErrorReportFactory.create(
            session=db_session,
            user_id=test_superuser.id,
            status=CardErrorStatus.FIXED,
        )

        # 1 news item (auto-creates Situation + SituationDescription)
        await NewsItemFactory.create(session=db_session)

        await db_session.commit()

        response = await client.get(_ENDPOINT, headers=superuser_auth_headers)

        assert response.status_code == 200
        data = response.json()

        # inbox = 1 new feedback + 1 pending error = 2
        assert data["inbox"] == 2
        # feedback = total rows = 2
        assert data["feedback"] == 2
        # errors = pending only = 1
        assert data["errors"] == 1
        # announcements = 2
        assert data["announcements"] == 2
        # changelog = 1
        assert data["changelog"] == 1
        # news = 1
        assert data["news"] == 1
        # situations: NewsItemFactory auto-creates one Situation
        assert data["situations"] >= 1

    @pytest.mark.asyncio
    async def test_returns_zeros_on_empty_db(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """All badge counts are 0 when no content rows exist."""
        response = await client.get(_ENDPOINT, headers=superuser_auth_headers)

        assert response.status_code == 200
        data = response.json()

        assert data["inbox"] == 0
        assert data["decks"] == 0
        assert data["news"] == 0
        assert data["situations"] == 0
        assert data["exercises"] == 0
        assert data["errors"] == 0
        assert data["feedback"] == 0
        assert data["changelog"] == 0
        assert data["announcements"] == 0

    @pytest.mark.asyncio
    async def test_returns_401_unauthenticated(
        self,
        client: AsyncClient,
    ):
        """Endpoint returns 401 without authentication."""
        response = await client.get(_ENDPOINT)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_returns_403_for_non_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Endpoint returns 403 for authenticated non-superuser with correct error shape."""
        response = await client.get(_ENDPOINT, headers=auth_headers)
        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "FORBIDDEN"
        assert "superuser" in data["error"]["message"].lower()
