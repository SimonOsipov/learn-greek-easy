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
from pydantic import ValidationError
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
# Test Scene Pair Schema Validation (Pydantic-only, no DB)
# =============================================================================

_SCENE_BASE = dict(
    scenario_el="Τίτλος",
    scenario_en="Title",
    scenario_ru="Title",
    text_el="Περιγραφή",
    publication_date=date.today(),
    original_article_url="https://example.com/article",
    source_image_url="https://example.com/image.jpg",
    country="cyprus",
)


class TestScenePair:
    """Tests for scene_en/scene_el/scene_ru trilingual validation and field constraints."""

    # ------------------------------------------------------------------
    # Parametrized: all 6 incomplete permutations must raise
    # ------------------------------------------------------------------

    @pytest.mark.parametrize(
        "kwargs",
        [
            # only one field present
            {"scene_en": "x"},
            {"scene_el": "y"},
            {"scene_ru": "z"},
            # two out of three
            {"scene_en": "x", "scene_el": "y"},
            {"scene_en": "x", "scene_ru": "z"},
            {"scene_el": "y", "scene_ru": "z"},
        ],
    )
    def test_incomplete_scene_triple_raises(self, kwargs):
        """Any incomplete subset of scene_en/scene_el/scene_ru must raise ValidationError."""
        with pytest.raises(
            ValidationError,
            match="scene_en, scene_el and scene_ru must all be provided or all omitted",
        ):
            NewsItemCreate(**_SCENE_BASE, **kwargs)

    # ------------------------------------------------------------------
    # Valid states
    # ------------------------------------------------------------------

    def test_all_three_scene_fields_present_ok(self):
        """All three scene fields provided should not raise."""
        NewsItemCreate(**_SCENE_BASE, scene_en="x", scene_el="y", scene_ru="z")

    def test_all_scene_fields_absent_ok(self):
        """No scene fields provided should not raise."""
        NewsItemCreate(**_SCENE_BASE)

    # ------------------------------------------------------------------
    # Whitespace handling
    # ------------------------------------------------------------------

    def test_whitespace_only_treated_as_absent(self):
        """scene_en with only whitespace is treated as absent, making the triple incomplete."""
        with pytest.raises(
            ValidationError,
            match="scene_en, scene_el and scene_ru must all be provided or all omitted",
        ):
            NewsItemCreate(**_SCENE_BASE, scene_en="   ", scene_el="y", scene_ru="z")

    def test_style_en_independent_ok(self):
        """style_en alone (no scene pair) should not raise."""
        NewsItemCreate(**_SCENE_BASE, style_en="z")

    def test_scene_en_max_length_boundary(self):
        """scene_en of 1000 chars is valid; 1001 raises."""
        NewsItemCreate(**_SCENE_BASE, scene_en="a" * 1000, scene_el="b" * 1000, scene_ru="c" * 1000)
        with pytest.raises(ValidationError):
            NewsItemCreate(**_SCENE_BASE, scene_en="a" * 1001, scene_el="b", scene_ru="c")

    def test_scene_el_max_length_boundary(self):
        """scene_el of 1000 chars is valid; 1001 raises."""
        NewsItemCreate(**_SCENE_BASE, scene_en="a", scene_el="b" * 1000, scene_ru="c")
        with pytest.raises(ValidationError):
            NewsItemCreate(**_SCENE_BASE, scene_en="a", scene_el="b" * 1001, scene_ru="c")

    def test_scene_ru_max_length_boundary(self):
        """scene_ru of 1000 chars is valid; 1001 raises."""
        NewsItemCreate(**_SCENE_BASE, scene_en="a", scene_el="b", scene_ru="c" * 1000)
        with pytest.raises(ValidationError):
            NewsItemCreate(**_SCENE_BASE, scene_en="a", scene_el="b", scene_ru="c" * 1001)

    def test_style_en_max_length_boundary(self):
        """style_en of 1000 chars is valid; 1001 raises."""
        NewsItemCreate(**_SCENE_BASE, style_en="z" * 1000)
        with pytest.raises(ValidationError):
            NewsItemCreate(**_SCENE_BASE, style_en="z" * 1001)


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

    def _make_create_data(self, url: str | None = None, **kwargs) -> NewsItemCreate:
        return NewsItemCreate(
            scenario_el="Τίτλος ειδήσεων",
            scenario_en="News Title",
            scenario_ru="Заголовок новости",
            text_el="Κείμενο περιγραφής.",
            country="cyprus",
            publication_date=date.today(),
            original_article_url=url or f"https://example.com/article-{uuid4().hex[:8]}",
            source_image_url="https://example.com/image.jpg",
            **kwargs,
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

    # -------------------------------------------------------------------------
    # Helpers for scene/style tests
    # -------------------------------------------------------------------------

    @staticmethod
    def _make_httpx_patch():
        """Return (mock_httpx_cls, patch context) for faking image download."""
        from unittest.mock import AsyncMock, MagicMock

        mock_response = MagicMock()
        mock_response.content = b"fake_image"
        mock_response.headers = {"content-type": "image/jpeg"}
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response

        mock_httpx_cls = MagicMock()
        mock_httpx_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_httpx_cls.return_value.__aexit__ = AsyncMock(return_value=False)
        return mock_httpx_cls

    # -------------------------------------------------------------------------
    # scene_* / style_en field-resolution tests
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_create_uses_provided_scene_and_style(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """When scene_en/scene_el/style_en are provided they are written verbatim
        and image_prompt is composed as f"{scene_en}\\n\\n{style_en}"."""
        from unittest.mock import patch

        from src.db.models import SituationPicture

        scene_en = "A sunny day in Athens"
        scene_el = "Μια ηλιόλουστη μέρα στην Αθήνα"
        scene_ru = "Солнечный день в Афинах"
        style_en = "Oil painting, warm tones"
        data = self._make_create_data(
            scene_en=scene_en, scene_el=scene_el, scene_ru=scene_ru, style_en=style_en
        )
        service = NewsItemService(db_session, s3_service=mock_s3_service)
        mock_httpx_cls = self._make_httpx_patch()

        with patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls):
            result = await service.create(data)

        from sqlalchemy import select

        row = (
            await db_session.execute(
                select(SituationPicture).where(SituationPicture.situation_id == result.situation_id)
            )
        ).scalar_one()

        assert row.scene_en == scene_en
        assert row.scene_el == scene_el
        assert row.style_en == style_en
        assert row.image_prompt == f"{scene_en}\n\n{style_en}"

    @pytest.mark.asyncio
    async def test_create_falls_back_to_scenario_for_scene_pair(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """When scene_en/scene_el are omitted, scenario_en/scenario_el are used instead."""
        from unittest.mock import patch

        from src.db.models import SituationPicture

        style_en = "Watercolour sketch"
        data = self._make_create_data(style_en=style_en)
        service = NewsItemService(db_session, s3_service=mock_s3_service)
        mock_httpx_cls = self._make_httpx_patch()

        with patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls):
            result = await service.create(data)

        from sqlalchemy import select

        row = (
            await db_session.execute(
                select(SituationPicture).where(SituationPicture.situation_id == result.situation_id)
            )
        ).scalar_one()

        assert row.scene_en == data.scenario_en
        assert row.scene_el == data.scenario_el

    @pytest.mark.asyncio
    async def test_create_falls_back_to_env_for_style(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        monkeypatch,
    ):
        """When style_en is omitted, settings.picture_house_style_default is used."""
        from unittest.mock import patch

        from src.config import settings
        from src.db.models import SituationPicture

        monkeypatch.setattr(settings, "picture_house_style_default", "TEST_STYLE")
        data = self._make_create_data(scene_en="A scene", scene_el="Μια σκηνή", scene_ru="Сцена")
        service = NewsItemService(db_session, s3_service=mock_s3_service)
        mock_httpx_cls = self._make_httpx_patch()

        with patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls):
            result = await service.create(data)

        from sqlalchemy import select

        row = (
            await db_session.execute(
                select(SituationPicture).where(SituationPicture.situation_id == result.situation_id)
            )
        ).scalar_one()

        assert row.style_en == "TEST_STYLE"

    @pytest.mark.asyncio
    async def test_create_image_prompt_composition_format(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        monkeypatch,
    ):
        """image_prompt is exactly f"{scenario_en}\\n\\nTEST_STYLE" when all optional
        scene/style fields are omitted (double-newline, no trailing whitespace)."""
        from unittest.mock import patch

        from src.config import settings
        from src.db.models import SituationPicture

        monkeypatch.setattr(settings, "picture_house_style_default", "TEST_STYLE")
        data = self._make_create_data()
        service = NewsItemService(db_session, s3_service=mock_s3_service)
        mock_httpx_cls = self._make_httpx_patch()

        with patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls):
            result = await service.create(data)

        from sqlalchemy import select

        row = (
            await db_session.execute(
                select(SituationPicture).where(SituationPicture.situation_id == result.situation_id)
            )
        ).scalar_one()

        assert row.image_prompt == f"{data.scenario_en}\n\nTEST_STYLE"

    @pytest.mark.asyncio
    async def test_create_falls_back_to_scenario_for_scene_ru(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """When scene_ru is omitted, scenario_ru is used instead."""
        from unittest.mock import patch

        from sqlalchemy import select

        from src.db.models import SituationPicture

        data = self._make_create_data()
        service = NewsItemService(db_session, s3_service=mock_s3_service)
        mock_httpx_cls = self._make_httpx_patch()

        with patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls):
            result = await service.create(data)

        row = (
            await db_session.execute(
                select(SituationPicture).where(SituationPicture.situation_id == result.situation_id)
            )
        ).scalar_one()

        assert row.scene_ru == data.scenario_ru

    @pytest.mark.asyncio
    async def test_create_persists_scene_ru_verbatim(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """When scene_ru is provided, it is persisted verbatim (no fallback)."""
        from unittest.mock import patch

        from sqlalchemy import select

        from src.db.models import SituationPicture

        scene_ru = "Солнечный день в Афинах"
        data = self._make_create_data(scene_ru=scene_ru)
        service = NewsItemService(db_session, s3_service=mock_s3_service)
        mock_httpx_cls = self._make_httpx_patch()

        with patch("src.services.news_item_service.httpx.AsyncClient", mock_httpx_cls):
            result = await service.create(data)

        row = (
            await db_session.execute(
                select(SituationPicture).where(SituationPicture.situation_id == result.situation_id)
            )
        ).scalar_one()

        assert row.scene_ru == scene_ru
        # image_prompt must NOT include scene_ru
        assert scene_ru not in row.image_prompt


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
