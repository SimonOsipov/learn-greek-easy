"""Unit tests for NewsItemService.

This module tests:
- get_by_id: Get news item with content from JOIN
- get_list: Paginated news items

Tests use mocked S3 and real DB session.
"""

from datetime import date, timedelta
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import NewsItemNotFoundException
from src.db.models import NewsItem as NewsItemModel
from src.db.models import Situation as SituationModel
from src.schemas.news_item import NewsItemCreate
from src.services.news_item_service import NewsItemService
from tests.factories.news import NewsItemFactory

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def mock_s3_service():
    """Mock S3 service for tests."""
    mock = MagicMock()
    mock.upload_object.return_value = True
    mock.delete_object.return_value = True
    mock.generate_presigned_url.return_value = "https://s3.example.com/presigned-url"
    return mock


@pytest.fixture
async def sample_news_item(db_session: AsyncSession):
    """Create a sample news item in the database."""
    return await NewsItemFactory.create(session=db_session)


@pytest.fixture
async def multiple_news_items(db_session: AsyncSession):
    """Create multiple news items."""
    items = []
    base_date = date.today()

    for i in range(5):
        item = await NewsItemFactory.create(
            session=db_session,
            publication_date=base_date - timedelta(days=i),
        )
        items.append(item)

    return items


# =============================================================================
# Test Get By ID
# =============================================================================


class TestGetById:
    """Tests for get_by_id method."""

    @pytest.mark.asyncio
    async def test_returns_response_with_correct_id(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        sample_news_item,
    ):
        """Should return news item response with matching id."""
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        result = await service.get_by_id(sample_news_item.id)

        assert result.id == sample_news_item.id

    @pytest.mark.asyncio
    async def test_description_en_ru_are_none(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        sample_news_item,
    ):
        """description_en and description_ru are None (content from SituationDescription)."""
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        result = await service.get_by_id(sample_news_item.id)

        assert result.description_en is None
        assert result.description_ru is None

    @pytest.mark.asyncio
    async def test_raises_not_found(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """Should raise NewsItemNotFoundException for non-existent ID."""
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        with pytest.raises(NewsItemNotFoundException):
            await service.get_by_id(uuid4())


# =============================================================================
# Test Get List
# =============================================================================


class TestGetList:
    """Tests for get_list method."""

    @pytest.mark.asyncio
    async def test_returns_paginated_items(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        multiple_news_items,
    ):
        """Should return paginated news items."""
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        result = await service.get_list(page=1, page_size=3)

        assert result.total == 5
        assert result.page == 1
        assert result.page_size == 3
        assert len(result.items) == 3

    @pytest.mark.asyncio
    async def test_respects_pagination(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        multiple_news_items,
    ):
        """Should respect page and page_size parameters."""
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        result = await service.get_list(page=2, page_size=2)

        assert result.page == 2
        assert len(result.items) == 2

    @pytest.mark.asyncio
    async def test_items_description_en_ru_are_none(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        multiple_news_items,
    ):
        """Items in list response have description_en=None, description_ru=None."""
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        result = await service.get_list(page=1, page_size=10)

        for item in result.items:
            assert item.description_en is None
            assert item.description_ru is None


# =============================================================================
# Test A2 Schema Validation (Pydantic-only, no DB)
# =============================================================================


class TestA2Content:
    """Tests for A2-level content paired validation."""

    def test_paired_validation_title_without_description(self):
        """Should raise ValidationError when scenario_el_a2 set but text_el_a2 omitted."""
        from pydantic import ValidationError

        with pytest.raises(ValidationError, match="must both be provided or both omitted"):
            NewsItemCreate(
                scenario_el="Τίτλος",
                scenario_en="Title",
                scenario_ru="Title",
                text_el="Περιγραφή",
                publication_date=date.today(),
                original_article_url="https://example.com/article",
                source_image_url="https://example.com/image.jpg",
                country="cyprus",
                scenario_el_a2="Απλός τίτλος",
                # text_el_a2 omitted
            )

    def test_paired_validation_description_without_title(self):
        """Should raise ValidationError when text_el_a2 set but scenario_el_a2 omitted."""
        from pydantic import ValidationError

        with pytest.raises(ValidationError, match="must both be provided or both omitted"):
            NewsItemCreate(
                scenario_el="Τίτλος",
                scenario_en="Title",
                scenario_ru="Title",
                text_el="Περιγραφή",
                publication_date=date.today(),
                original_article_url="https://example.com/article",
                source_image_url="https://example.com/image.jpg",
                country="cyprus",
                # scenario_el_a2 omitted
                text_el_a2="Απλή περιγραφή",
            )


# =============================================================================
# Test Delete
# =============================================================================


class TestDelete:
    """Tests for delete() method."""

    @pytest.mark.asyncio
    async def test_delete_existing_item(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        sample_news_item,
    ):
        """delete() removes the NewsItem row."""
        news_item_id = sample_news_item.id
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        await service.delete(news_item_id)
        await db_session.flush()

        result = await db_session.get(NewsItemModel, news_item_id)
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_nonexistent_raises_not_found(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """delete() raises NewsItemNotFoundException for unknown ID."""
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        with pytest.raises(NewsItemNotFoundException):
            await service.delete(uuid4())

    @pytest.mark.asyncio
    async def test_delete_preserves_situation(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        sample_news_item,
    ):
        """delete() preserves the linked Situation row."""
        situation_id = sample_news_item.situation_id
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        await service.delete(sample_news_item.id)
        await db_session.flush()

        situation = await db_session.get(SituationModel, situation_id)
        assert situation is not None


# =============================================================================
# Test Create
# =============================================================================


class TestCreate:
    """Tests for create() method."""

    def _make_create_data(self, url: str | None = None) -> NewsItemCreate:
        return NewsItemCreate(
            scenario_el="Τίτλος ειδήσεων",
            scenario_en="News Title",
            scenario_ru="Заголовок новости",
            text_el="Κείμενο περιγραφής.",
            country="cyprus",
            publication_date=date.today(),
            original_article_url=url or f"https://example.com/article-{uuid4().hex[:8]}",
            source_image_url="https://example.com/image.jpg",
        )

    @pytest.mark.asyncio
    async def test_create_returns_response_with_correct_fields(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """create() returns NewsItemResponse with correct fields when image download succeeds."""
        from unittest.mock import AsyncMock, MagicMock, patch

        mock_response = MagicMock()
        mock_response.content = b"fake_image"
        mock_response.headers = {"content-type": "image/jpeg"}
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        mock_httpx_cls = MagicMock()
        mock_httpx_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_httpx_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        data = self._make_create_data()
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        with patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls):
            result = await service.create(data)

        assert result.title_el == data.scenario_el
        assert result.title_en == data.scenario_en
        assert result.publication_date == data.publication_date

    @pytest.mark.asyncio
    async def test_create_duplicate_url_raises_value_error(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        sample_news_item,
    ):
        """create() raises ValueError when original_article_url already exists."""
        service = NewsItemService(db_session, s3_service=mock_s3_service)
        data = self._make_create_data(url=sample_news_item.original_article_url)

        with pytest.raises(ValueError, match="already exists"):
            await service.create(data)


# =============================================================================
# Test Update
# =============================================================================


class TestUpdate:
    """Tests for update() method."""

    @pytest.mark.asyncio
    async def test_update_returns_updated_response(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        sample_news_item,
    ):
        """update() returns updated NewsItemResponse."""
        from src.schemas.news_item import NewsItemUpdate

        service = NewsItemService(db_session, s3_service=mock_s3_service)
        update_data = NewsItemUpdate(scenario_el="Ενημερωμένος τίτλος")

        result = await service.update(sample_news_item.id, update_data)

        assert result.title_el == "Ενημερωμένος τίτλος"

    @pytest.mark.asyncio
    async def test_update_nonexistent_raises_not_found(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """update() raises NewsItemNotFoundException for unknown ID."""
        from src.schemas.news_item import NewsItemUpdate

        service = NewsItemService(db_session, s3_service=mock_s3_service)
        update_data = NewsItemUpdate(scenario_el="Τίτλος")

        with pytest.raises(NewsItemNotFoundException):
            await service.update(uuid4(), update_data)
