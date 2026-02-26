"""Unit tests for multi-country news feature.

Tests cover:
- NewsCountry enum values
- Question skip logic for non-Cyprus news
- Question creation for Cyprus news
- Country filter on list endpoints
- country_counts aggregation
- Schema validation
- Response serialization
"""

import enum
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CultureDeck, NewsCountry, NewsItem
from src.schemas.news_item import (
    CountryCounts,
    NewsItemCreate,
    NewsItemUpdate,
    NewsItemWithQuestionCreate,
    QuestionCreate,
    QuestionOption,
)
from src.services.news_item_service import NewsItemService

# =============================================================================
# Shared fixtures and helpers
# =============================================================================


@pytest.fixture
def mock_s3_service():
    """Mock S3 service."""
    mock = MagicMock()
    mock.upload_object.return_value = True
    mock.delete_object.return_value = True
    mock.generate_presigned_url.return_value = "https://s3.example.com/presigned-url"
    return mock


@pytest.fixture
def mock_httpx_response():
    """Mock HTTP response for image download."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.headers = {"content-type": "image/jpeg"}
    mock_response.content = b"\xff\xd8\xff" + b"\x00" * 1024
    return mock_response


@pytest.fixture
async def active_culture_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an active culture deck for question tests."""
    deck = CultureDeck(
        name_en="Country Test Deck",
        name_el="Country Test Deck",
        name_ru="Country Test Deck",
        description_en="Deck for country testing",
        description_el="Deck for country testing",
        description_ru="Deck for country testing",
        category="culture",
        is_active=True,
        order_index=99,
    )
    db_session.add(deck)
    await db_session.commit()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def news_items_mixed_countries(db_session: AsyncSession) -> list[NewsItem]:
    """Create 6 news items with mixed countries: 2 Cyprus, 3 Greece, 1 World."""
    items = []
    configs = [
        ("cy1", "cyprus"),
        ("cy2", "cyprus"),
        ("gr1", "greece"),
        ("gr2", "greece"),
        ("gr3", "greece"),
        ("wo1", "world"),
    ]
    for suffix, country in configs:
        item = NewsItem(
            title_el=f"Τίτλος {suffix}",
            title_en=f"Title {suffix}",
            title_ru=f"Заголовок {suffix}",
            description_el=f"Περιγραφή {suffix}",
            description_en=f"Description {suffix}",
            description_ru=f"Описание {suffix}",
            publication_date=date.today(),
            original_article_url=f"https://example.com/mcnews-test-{suffix}-{uuid4().hex[:8]}",
            image_s3_key=f"news-images/mcnews-test-{suffix}.jpg",
            country=country,
        )
        db_session.add(item)
        items.append(item)
    await db_session.flush()
    for item in items:
        await db_session.refresh(item)
    return items


def make_question_create(deck_id: UUID) -> QuestionCreate:
    """Helper to create QuestionCreate with valid options."""
    return QuestionCreate(
        deck_id=deck_id,
        question_el="Ποια είναι η πρωτεύουσα;",
        question_en="What is the capital?",
        question_ru="Какая столица?",
        options=[
            QuestionOption(text_el="Αθήνα", text_en="Athens", text_ru="Афины"),
            QuestionOption(text_el="Θεσσαλονίκη", text_en="Thessaloniki", text_ru="Салоники"),
            QuestionOption(text_el="Πάτρα", text_en="Patras", text_ru="Патры"),
            QuestionOption(text_el="Ηράκλειο", text_en="Heraklion", text_ru="Ираклион"),
        ],
        correct_answer_index=0,
    )


# =============================================================================
# TestNewsCountryEnum
# =============================================================================


class TestNewsCountryEnum:
    """Tests for the NewsCountry enum."""

    def test_has_exactly_three_values(self):
        """NewsCountry should have exactly 3 values."""
        assert len(NewsCountry) == 3

    def test_cyprus_value(self):
        """CYPRUS should have value 'cyprus'."""
        assert NewsCountry.CYPRUS.value == "cyprus"

    def test_greece_value(self):
        """GREECE should have value 'greece'."""
        assert NewsCountry.GREECE.value == "greece"

    def test_world_value(self):
        """WORLD should have value 'world'."""
        assert NewsCountry.WORLD.value == "world"

    def test_is_str_enum(self):
        """NewsCountry should be a str Enum subclass."""
        assert issubclass(NewsCountry, str)
        assert issubclass(NewsCountry, enum.Enum)

    def test_string_comparison(self):
        """NewsCountry values should compare equal to their string equivalents."""
        assert NewsCountry.CYPRUS == "cyprus"
        assert NewsCountry.GREECE == "greece"
        assert NewsCountry.WORLD == "world"


# =============================================================================
# TestQuestionSkipNonCyprus
# =============================================================================


class TestQuestionSkipNonCyprus:
    """Tests for silent question skip when country != CYPRUS."""

    @pytest.mark.asyncio
    async def test_greece_news_skips_question(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        mock_httpx_response: MagicMock,
        active_culture_deck: CultureDeck,
    ):
        """Creating Greece news with question payload should skip question silently."""
        with patch("src.services.news_item_service.httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_httpx_response)
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            service = NewsItemService(db_session, s3_service=mock_s3_service)

            create_data = NewsItemWithQuestionCreate(
                title_el="Ελληνικά νέα από Ελλάδα",
                title_en="Greek News from Greece",
                title_ru="Греческие новости из Греции",
                description_el="Περιγραφή",
                description_en="Description",
                description_ru="Описание",
                publication_date=date.today(),
                original_article_url=f"https://example.com/greece-skip-{uuid4().hex[:8]}",
                source_image_url="https://example.com/image.jpg",
                country="greece",
                question=make_question_create(active_culture_deck.id),
            )

            result = await service.create_with_question(create_data)

            # Card should be None (question was skipped)
            assert result.card is None
            # Message should mention the skip
            assert "Question skipped" in result.message
            assert "only supported for Cyprus news" in result.message

    @pytest.mark.asyncio
    async def test_world_news_skips_question(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        mock_httpx_response: MagicMock,
        active_culture_deck: CultureDeck,
    ):
        """Creating World news with question payload should skip question silently."""
        with patch("src.services.news_item_service.httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_httpx_response)
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            service = NewsItemService(db_session, s3_service=mock_s3_service)

            create_data = NewsItemWithQuestionCreate(
                title_el="Παγκόσμια νέα",
                title_en="World News",
                title_ru="Мировые новости",
                description_el="Περιγραφή",
                description_en="Description",
                description_ru="Описание",
                publication_date=date.today(),
                original_article_url=f"https://example.com/world-skip-{uuid4().hex[:8]}",
                source_image_url="https://example.com/image.jpg",
                country="world",
                question=make_question_create(active_culture_deck.id),
            )

            result = await service.create_with_question(create_data)

            assert result.card is None
            assert "Question skipped" in result.message

    @pytest.mark.asyncio
    async def test_skip_message_is_exact(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        mock_httpx_response: MagicMock,
        active_culture_deck: CultureDeck,
    ):
        """The skip message should match the exact expected string."""
        with patch("src.services.news_item_service.httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_httpx_response)
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            service = NewsItemService(db_session, s3_service=mock_s3_service)

            create_data = NewsItemWithQuestionCreate(
                title_el="Νέα",
                title_en="News",
                title_ru="Новости",
                description_el="Περιγραφή",
                description_en="Description",
                description_ru="Описание",
                publication_date=date.today(),
                original_article_url=f"https://example.com/skip-msg-{uuid4().hex[:8]}",
                source_image_url="https://example.com/image.jpg",
                country="greece",
                question=make_question_create(active_culture_deck.id),
            )

            result = await service.create_with_question(create_data)

            expected_msg = (
                "News item created successfully. Question skipped (only supported for Cyprus news)."
            )
            assert result.message == expected_msg


# =============================================================================
# TestQuestionCreationCyprus
# =============================================================================


class TestQuestionCreationCyprus:
    """Tests for normal question creation when country == CYPRUS."""

    @pytest.mark.asyncio
    async def test_cyprus_news_creates_question(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        mock_httpx_response: MagicMock,
        active_culture_deck: CultureDeck,
    ):
        """Creating Cyprus news with question payload should create question."""
        with patch("src.services.news_item_service.httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_httpx_response)
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            service = NewsItemService(db_session, s3_service=mock_s3_service)

            create_data = NewsItemWithQuestionCreate(
                title_el="Κυπριακά νέα",
                title_en="Cyprus News",
                title_ru="Новости Кипра",
                description_el="Περιγραφή κυπριακής ειδήσης",
                description_en="Cyprus news description",
                description_ru="Описание кипрской новости",
                publication_date=date.today(),
                original_article_url=f"https://example.com/cyprus-question-{uuid4().hex[:8]}",
                source_image_url="https://example.com/image.jpg",
                country="cyprus",
                question=make_question_create(active_culture_deck.id),
            )

            result = await service.create_with_question(create_data)

            # Card should be created
            assert result.card is not None
            assert result.card.deck_id == active_culture_deck.id
            assert result.message == "News item and question created successfully"


# =============================================================================
# TestCountryFilter
# =============================================================================


class TestCountryFilter:
    """Tests for country filter on list endpoint."""

    @pytest.mark.asyncio
    async def test_filter_by_greece(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        news_items_mixed_countries: list[NewsItem],
    ):
        """get_list with country=greece should return only Greece items."""
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        result = await service.get_list(page=1, page_size=20, country=NewsCountry.GREECE)

        assert result.total == 3
        for item in result.items:
            assert item.country == "greece"

    @pytest.mark.asyncio
    async def test_filter_by_cyprus(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        news_items_mixed_countries: list[NewsItem],
    ):
        """get_list with country=cyprus should return only Cyprus items."""
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        result = await service.get_list(page=1, page_size=20, country=NewsCountry.CYPRUS)

        assert result.total == 2
        for item in result.items:
            assert item.country == "cyprus"

    @pytest.mark.asyncio
    async def test_filter_by_world(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        news_items_mixed_countries: list[NewsItem],
    ):
        """get_list with country=world should return only World items."""
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        result = await service.get_list(page=1, page_size=20, country=NewsCountry.WORLD)

        assert result.total == 1
        for item in result.items:
            assert item.country == "world"

    @pytest.mark.asyncio
    async def test_no_filter_returns_all(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        news_items_mixed_countries: list[NewsItem],
    ):
        """get_list with no country filter should return all items."""
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        result = await service.get_list(page=1, page_size=20)

        assert result.total == 6


# =============================================================================
# TestCountryCounts
# =============================================================================


class TestCountryCounts:
    """Tests for country_counts in list responses."""

    @pytest.mark.asyncio
    async def test_counts_sum_correctly(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        news_items_mixed_countries: list[NewsItem],
    ):
        """country_counts should reflect actual item distribution."""
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        result = await service.get_list(page=1, page_size=20)

        assert result.country_counts.cyprus == 2
        assert result.country_counts.greece == 3
        assert result.country_counts.world == 1

    @pytest.mark.asyncio
    async def test_counts_with_empty_countries(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """country_counts should return 0 for countries with no items."""
        # Create only Cyprus items
        for i in range(2):
            item = NewsItem(
                title_el=f"Κυπριακά νέα {i}",
                title_en=f"Cyprus News {i}",
                title_ru=f"Новости Кипра {i}",
                description_el="Περιγραφή",
                description_en="Description",
                description_ru="Описание",
                publication_date=date.today(),
                original_article_url=f"https://example.com/cy-only-{i}-{uuid4().hex[:8]}",
                image_s3_key=f"news-images/cy-only-{i}.jpg",
                country="cyprus",
            )
            db_session.add(item)
        await db_session.flush()

        service = NewsItemService(db_session, s3_service=mock_s3_service)
        result = await service.get_list(page=1, page_size=20)

        assert result.country_counts.greece == 0
        assert result.country_counts.world == 0
        assert result.country_counts.cyprus == 2

    @pytest.mark.asyncio
    async def test_counts_present_when_filter_applied(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        news_items_mixed_countries: list[NewsItem],
    ):
        """country_counts should reflect total distribution even when filter is applied."""
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        result = await service.get_list(page=1, page_size=20, country=NewsCountry.GREECE)

        # Filter applied: total and items reflect only Greece
        assert result.total == 3
        # country_counts shows all countries (global distribution)
        assert result.country_counts.cyprus == 2
        assert result.country_counts.greece == 3
        assert result.country_counts.world == 1


# =============================================================================
# TestSchemaValidation
# =============================================================================


class TestSchemaValidation:
    """Tests for schema validation with country field."""

    def test_create_accepts_cyprus(self):
        """NewsItemCreate should accept 'cyprus' as country."""
        data = NewsItemCreate(
            title_el="Τίτλος",
            title_en="Title",
            title_ru="Заголовок",
            description_el="Περιγραφή",
            description_en="Description",
            description_ru="Описание",
            publication_date=date.today(),
            original_article_url="https://example.com/article",
            source_image_url="https://example.com/image.jpg",
            country="cyprus",
        )
        assert data.country.value == "cyprus"

    def test_create_accepts_greece(self):
        """NewsItemCreate should accept 'greece' as country."""
        data = NewsItemCreate(
            title_el="Τίτλος",
            title_en="Title",
            title_ru="Заголовок",
            description_el="Περιγραφή",
            description_en="Description",
            description_ru="Описание",
            publication_date=date.today(),
            original_article_url="https://example.com/article2",
            source_image_url="https://example.com/image.jpg",
            country="greece",
        )
        assert data.country.value == "greece"

    def test_create_accepts_world(self):
        """NewsItemCreate should accept 'world' as country."""
        data = NewsItemCreate(
            title_el="Τίτλος",
            title_en="Title",
            title_ru="Заголовок",
            description_el="Περιγραφή",
            description_en="Description",
            description_ru="Описание",
            publication_date=date.today(),
            original_article_url="https://example.com/article3",
            source_image_url="https://example.com/image.jpg",
            country="world",
        )
        assert data.country.value == "world"

    def test_create_rejects_invalid_country(self):
        """NewsItemCreate should reject invalid country values."""
        with pytest.raises(ValidationError):
            NewsItemCreate(
                title_el="Τίτλος",
                title_en="Title",
                title_ru="Заголовок",
                description_el="Περιγραφή",
                description_en="Description",
                description_ru="Описание",
                publication_date=date.today(),
                original_article_url="https://example.com/article4",
                source_image_url="https://example.com/image.jpg",
                country="england",  # invalid
            )

    def test_update_country_optional(self):
        """NewsItemUpdate should allow None country (no update)."""
        data = NewsItemUpdate()
        assert data.country is None

    def test_update_country_accepts_valid_value(self):
        """NewsItemUpdate should accept valid country value."""
        data = NewsItemUpdate(country="greece")
        assert data.country.value == "greece"

    def test_update_rejects_invalid_country(self):
        """NewsItemUpdate should reject invalid country values."""
        with pytest.raises(ValidationError):
            NewsItemUpdate(country="invalid_country")

    def test_country_counts_defaults_to_zero(self):
        """CountryCounts default values should all be 0."""
        counts = CountryCounts()
        assert counts.cyprus == 0
        assert counts.greece == 0
        assert counts.world == 0

    def test_country_counts_can_be_set(self):
        """CountryCounts should accept explicit values."""
        counts = CountryCounts(cyprus=5, greece=3, world=2)
        assert counts.cyprus == 5
        assert counts.greece == 3
        assert counts.world == 2


# =============================================================================
# TestCountryResponseSerialization
# =============================================================================


class TestCountryResponseSerialization:
    """Tests for country field in API responses."""

    @pytest.mark.asyncio
    async def test_country_in_get_by_id_response(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """get_by_id should include country in response."""
        item = NewsItem(
            title_el="Ελληνικά νέα",
            title_en="Greek News",
            title_ru="Греческие новости",
            description_el="Περιγραφή",
            description_en="Description",
            description_ru="Описание",
            publication_date=date.today(),
            original_article_url=f"https://example.com/serial-test-{uuid4().hex[:8]}",
            image_s3_key="news-images/serial-test.jpg",
            country="greece",
        )
        db_session.add(item)
        await db_session.commit()
        await db_session.refresh(item)

        service = NewsItemService(db_session, s3_service=mock_s3_service)
        response = await service.get_by_id(item.id)

        assert response.country == "greece"

    @pytest.mark.asyncio
    async def test_country_in_list_response_items(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        news_items_mixed_countries: list[NewsItem],
    ):
        """Each item in list response should include country field."""
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        result = await service.get_list(page=1, page_size=20)

        assert len(result.items) > 0
        for item_response in result.items:
            assert hasattr(item_response, "country")
            assert item_response.country in ("cyprus", "greece", "world")

    @pytest.mark.asyncio
    async def test_country_preserved_after_update(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """Country should be preserved after updating other fields."""
        item = NewsItem(
            title_el="Τίτλος",
            title_en="Original Title",
            title_ru="Заголовок",
            description_el="Περιγραφή",
            description_en="Description",
            description_ru="Описание",
            publication_date=date.today(),
            original_article_url=f"https://example.com/update-country-{uuid4().hex[:8]}",
            image_s3_key="news-images/update-country.jpg",
            country="world",
        )
        db_session.add(item)
        await db_session.commit()
        await db_session.refresh(item)

        service = NewsItemService(db_session, s3_service=mock_s3_service)
        from src.schemas.news_item import NewsItemUpdate

        updated = await service.update(item.id, NewsItemUpdate(title_en="Updated Title"))

        assert updated.country == "world"
        assert updated.title_en == "Updated Title"


# =============================================================================
# TestNewsItemFactory
# =============================================================================


class TestNewsItemFactory:
    """Tests for NewsItemFactory country field."""

    def test_factory_default_country(self):
        """NewsItemFactory should default to country='cyprus'."""
        from tests.factories.news import NewsItemFactory

        item = NewsItemFactory.build()
        assert item.country == "cyprus"

    def test_factory_greece_trait(self):
        """NewsItemFactory greece trait should set country='greece'."""
        from tests.factories.news import NewsItemFactory

        item = NewsItemFactory.build(greece=True)
        assert item.country == "greece"

    def test_factory_world_trait(self):
        """NewsItemFactory world trait should set country='world'."""
        from tests.factories.news import NewsItemFactory

        item = NewsItemFactory.build(world=True)
        assert item.country == "world"

    def test_factory_explicit_country(self):
        """NewsItemFactory should accept explicit country value."""
        from tests.factories.news import NewsItemFactory

        item = NewsItemFactory.build(country="world")
        assert item.country == "world"
