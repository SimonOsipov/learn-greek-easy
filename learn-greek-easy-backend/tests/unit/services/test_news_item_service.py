"""Unit tests for NewsItemService.

This module tests:
- get_by_id: Get news item with content from JOIN
- get_list: Paginated news items
- delete: Raises NotImplementedError (admin writes disabled)

Tests use mocked S3 and real DB session.
"""

from datetime import date, timedelta
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import NewsItemNotFoundException
from src.schemas.news_item import NewsItemCreate, NewsItemUpdate
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
# Test Delete
# =============================================================================


class TestDelete:
    """Tests for delete method — raises NotImplementedError."""

    @pytest.mark.asyncio
    async def test_delete_raises_not_implemented(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """delete() should raise NotImplementedError during thin-news migration."""
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        with pytest.raises(NotImplementedError):
            await service.delete(uuid4())


# =============================================================================
# Test A2 Schema Validation (Pydantic-only, no DB)
# =============================================================================


class TestA2Content:
    """Tests for A2-level content paired validation."""

    def test_paired_validation_title_without_description(self):
        """Should raise ValidationError when title_el_a2 set but description_el_a2 omitted."""
        from pydantic import ValidationError

        with pytest.raises(ValidationError, match="must both be provided or both omitted"):
            NewsItemCreate(
                title_el="Τίτλος",
                title_en="Title",
                title_ru="Title",
                description_el="Περιγραφή",
                description_en="Description",
                description_ru="Description",
                publication_date=date.today(),
                original_article_url="https://example.com/article",
                source_image_url="https://example.com/image.jpg",
                country="cyprus",
                title_el_a2="Απλός τίτλος",
                # description_el_a2 omitted
            )

    def test_paired_validation_description_without_title(self):
        """Should raise ValidationError when description_el_a2 set but title_el_a2 omitted."""
        from pydantic import ValidationError

        with pytest.raises(ValidationError, match="must both be provided or both omitted"):
            NewsItemCreate(
                title_el="Τίτλος",
                title_en="Title",
                title_ru="Title",
                description_el="Περιγραφή",
                description_en="Description",
                description_ru="Description",
                publication_date=date.today(),
                original_article_url="https://example.com/article",
                source_image_url="https://example.com/image.jpg",
                country="cyprus",
                # title_el_a2 omitted
                description_el_a2="Απλή περιγραφή",
            )

    def test_paired_validation_on_update_schema(self):
        """Should raise ValidationError on NewsItemUpdate when A2 pair is incomplete."""
        from pydantic import ValidationError

        with pytest.raises(ValidationError, match="must both be provided or both omitted"):
            NewsItemUpdate(
                title_el_a2="Απλός τίτλος",
                # description_el_a2 omitted
            )
