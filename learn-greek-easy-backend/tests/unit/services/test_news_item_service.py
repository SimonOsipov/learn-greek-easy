"""Unit tests for NewsItemService.

This module tests:
- create: Download image, upload to S3, create news item
- get_by_id: Get news item with presigned URL
- get_list: Paginated news items
- get_recent: Recent news items for widget
- update: Update fields and optionally replace image
- delete: Delete news item and S3 image

Tests use mocked S3 and HTTP to isolate service logic.
"""

from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import NewsItemNotFoundException
from src.db.models import CultureDeck, NewsItem
from src.schemas.news_item import (
    NewsItemCreate,
    NewsItemUpdate,
    NewsItemWithQuestionCreate,
    QuestionCreate,
    QuestionOption,
)
from src.services.news_item_service import NewsItemService

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
def mock_httpx_response():
    """Create a mock HTTP response for image download."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.headers = {"content-type": "image/jpeg"}
    # 1KB test image
    mock_response.content = b"\xff\xd8\xff" + b"\x00" * 1024
    return mock_response


@pytest.fixture
async def sample_news_item(db_session: AsyncSession) -> NewsItem:
    """Create a sample news item in the database."""
    item = NewsItem(
        title_el="Test Greek Title",
        title_en="Test English Title",
        title_ru="Test Russian Title",
        description_el="Test Greek description",
        description_en="Test English description",
        description_ru="Test Russian description",
        publication_date=date.today(),
        original_article_url="https://example.com/test-article",
        image_s3_key="news-images/test-uuid.jpg",
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item


@pytest.fixture
async def multiple_news_items(db_session: AsyncSession) -> list[NewsItem]:
    """Create multiple news items."""
    items = []
    base_date = date.today()

    for i in range(5):
        item = NewsItem(
            title_el=f"Greek Title {i}",
            title_en=f"English Title {i}",
            title_ru=f"Russian Title {i}",
            description_el=f"Greek description {i}",
            description_en=f"English description {i}",
            description_ru=f"Russian description {i}",
            publication_date=base_date - timedelta(days=i),
            original_article_url=f"https://example.com/article-{i}",
            image_s3_key=f"news-images/test-{i}.jpg",
        )
        db_session.add(item)
        items.append(item)

    await db_session.commit()
    for item in items:
        await db_session.refresh(item)

    return items


# =============================================================================
# Test Create
# =============================================================================


class TestCreate:
    """Tests for create method."""

    @pytest.mark.asyncio
    async def test_downloads_and_uploads_image(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        mock_httpx_response: MagicMock,
    ):
        """Should download image from URL and upload to S3."""
        with patch("src.services.news_item_service.httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_httpx_response)
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            service = NewsItemService(db_session, s3_service=mock_s3_service)

            create_data = NewsItemCreate(
                title_el="Greek Title",
                title_en="English Title",
                title_ru="Russian Title",
                description_el="Greek description",
                description_en="English description",
                description_ru="Russian description",
                publication_date=date.today(),
                original_article_url="https://example.com/new-article",
                source_image_url="https://example.com/image.jpg",
            )

            result = await service.create(create_data)

            # Verify HTTP call was made
            mock_client_instance.get.assert_called_once_with("https://example.com/image.jpg")

            # Verify S3 upload was called
            mock_s3_service.upload_object.assert_called_once()
            call_args = mock_s3_service.upload_object.call_args
            assert call_args[0][0].startswith("news-images/")
            assert call_args[0][0].endswith(".jpg")
            assert call_args[0][2] == "image/jpeg"

            # Verify result
            assert result.title_el == "Greek Title"
            assert result.image_url == "https://s3.example.com/presigned-url"

    @pytest.mark.asyncio
    async def test_rejects_duplicate_url(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        sample_news_item: NewsItem,
    ):
        """Should reject news items with duplicate article URLs."""
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        create_data = NewsItemCreate(
            title_el="Greek Title",
            title_en="English Title",
            title_ru="Russian Title",
            description_el="Greek description",
            description_en="English description",
            description_ru="Russian description",
            publication_date=date.today(),
            original_article_url=sample_news_item.original_article_url,
            source_image_url="https://example.com/image.jpg",
        )

        with pytest.raises(ValueError, match="already exists"):
            await service.create(create_data)

    @pytest.mark.asyncio
    async def test_validates_image_content_type(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """Should reject invalid image content types."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {"content-type": "text/html"}
        mock_response.content = b"<html>Not an image</html>"

        with patch("src.services.news_item_service.httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            service = NewsItemService(db_session, s3_service=mock_s3_service)

            create_data = NewsItemCreate(
                title_el="Greek Title",
                title_en="English Title",
                title_ru="Russian Title",
                description_el="Greek description",
                description_en="English description",
                description_ru="Russian description",
                publication_date=date.today(),
                original_article_url="https://example.com/new-article",
                source_image_url="https://example.com/fake-image.html",
            )

            with pytest.raises(ValueError, match="Invalid image content-type"):
                await service.create(create_data)

    @pytest.mark.asyncio
    async def test_rejects_oversized_image(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """Should reject images exceeding 5MB size limit."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {"content-type": "image/jpeg"}
        # 6MB image (exceeds 5MB limit)
        mock_response.content = b"\xff\xd8\xff" + b"\x00" * (6 * 1024 * 1024)

        with patch("src.services.news_item_service.httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            service = NewsItemService(db_session, s3_service=mock_s3_service)

            create_data = NewsItemCreate(
                title_el="Greek Title",
                title_en="English Title",
                title_ru="Russian Title",
                description_el="Greek description",
                description_en="English description",
                description_ru="Russian description",
                publication_date=date.today(),
                original_article_url="https://example.com/new-article",
                source_image_url="https://example.com/huge-image.jpg",
            )

            with pytest.raises(ValueError, match="exceeds maximum"):
                await service.create(create_data)


# =============================================================================
# Test Get By ID
# =============================================================================


class TestGetById:
    """Tests for get_by_id method."""

    @pytest.mark.asyncio
    async def test_returns_with_presigned_url(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        sample_news_item: NewsItem,
    ):
        """Should return news item with presigned S3 URL."""
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        result = await service.get_by_id(sample_news_item.id)

        assert result.id == sample_news_item.id
        assert result.title_el == sample_news_item.title_el
        assert result.image_url == "https://s3.example.com/presigned-url"
        mock_s3_service.generate_presigned_url.assert_called_with(sample_news_item.image_s3_key)

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
        multiple_news_items: list[NewsItem],
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
        multiple_news_items: list[NewsItem],
    ):
        """Should respect page and page_size parameters."""
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        result = await service.get_list(page=2, page_size=2)

        assert result.page == 2
        assert len(result.items) == 2


# =============================================================================
# Test Get Recent
# =============================================================================


class TestGetRecent:
    """Tests for get_recent method."""

    @pytest.mark.asyncio
    async def test_returns_recent_items(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        multiple_news_items: list[NewsItem],
    ):
        """Should return most recent news items."""
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        result = await service.get_recent(limit=3)

        assert len(result) == 3
        # All should have presigned URLs
        for item in result:
            assert item.image_url == "https://s3.example.com/presigned-url"


# =============================================================================
# Test Update
# =============================================================================


class TestUpdate:
    """Tests for update method."""

    @pytest.mark.asyncio
    async def test_replaces_image_on_s3(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        mock_httpx_response: MagicMock,
        sample_news_item: NewsItem,
    ):
        """Should replace S3 image when source_image_url provided."""
        old_s3_key = sample_news_item.image_s3_key

        with patch("src.services.news_item_service.httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_httpx_response)
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            service = NewsItemService(db_session, s3_service=mock_s3_service)

            update_data = NewsItemUpdate(source_image_url="https://example.com/new-image.jpg")

            result = await service.update(sample_news_item.id, update_data)

            # Verify new image was uploaded
            mock_s3_service.upload_object.assert_called_once()

            # Verify old image was deleted
            mock_s3_service.delete_object.assert_called_once_with(old_s3_key)

            # Verify result has presigned URL
            assert result.image_url == "https://s3.example.com/presigned-url"

    @pytest.mark.asyncio
    async def test_partial_update_without_image(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        sample_news_item: NewsItem,
    ):
        """Should update text fields without touching image."""
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        update_data = NewsItemUpdate(
            title_en="Updated English Title",
            description_en="Updated English description",
        )

        result = await service.update(sample_news_item.id, update_data)

        assert result.title_en == "Updated English Title"
        assert result.description_en == "Updated English description"
        # S3 should not be called
        mock_s3_service.upload_object.assert_not_called()
        mock_s3_service.delete_object.assert_not_called()

    @pytest.mark.asyncio
    async def test_raises_not_found(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """Should raise NewsItemNotFoundException for non-existent ID."""
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        update_data = NewsItemUpdate(title_en="New Title")

        with pytest.raises(NewsItemNotFoundException):
            await service.update(uuid4(), update_data)


# =============================================================================
# Test Delete
# =============================================================================


class TestDelete:
    """Tests for delete method."""

    @pytest.mark.asyncio
    async def test_removes_s3_image(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        sample_news_item: NewsItem,
    ):
        """Should delete S3 image when deleting news item."""
        s3_key = sample_news_item.image_s3_key
        item_id = sample_news_item.id

        service = NewsItemService(db_session, s3_service=mock_s3_service)

        await service.delete(item_id)

        # Verify S3 delete was called
        mock_s3_service.delete_object.assert_called_once_with(s3_key)

        # Verify item is deleted from database
        with pytest.raises(NewsItemNotFoundException):
            await service.get_by_id(item_id)

    @pytest.mark.asyncio
    async def test_raises_not_found(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """Should raise NewsItemNotFoundException for non-existent ID."""
        service = NewsItemService(db_session, s3_service=mock_s3_service)

        with pytest.raises(NewsItemNotFoundException):
            await service.delete(uuid4())


# =============================================================================
# Test Create With Question
# =============================================================================


@pytest.fixture
async def active_culture_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an active culture deck for testing."""
    deck = CultureDeck(
        name="Culture",
        description="Culture questions",
        category="culture",
        is_active=True,
        order_index=1,
    )
    db_session.add(deck)
    await db_session.commit()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def inactive_culture_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an inactive culture deck for testing."""
    deck = CultureDeck(
        name="Old Culture",
        description="Inactive culture questions",
        category="culture",
        is_active=False,
        order_index=2,
    )
    db_session.add(deck)
    await db_session.commit()
    await db_session.refresh(deck)
    return deck


def make_question_create(deck_id: UUID) -> QuestionCreate:
    """Helper to create QuestionCreate with valid options."""
    return QuestionCreate(
        deck_id=deck_id,
        question_el="Ποια είναι η πρωτεύουσα της Ελλάδας;",
        question_en="What is the capital of Greece?",
        options=[
            QuestionOption(text_el="Αθήνα", text_en="Athens"),
            QuestionOption(text_el="Θεσσαλονίκη", text_en="Thessaloniki"),
            QuestionOption(text_el="Πάτρα", text_en="Patras"),
            QuestionOption(text_el="Ηράκλειο", text_en="Heraklion"),
        ],
        correct_answer_index=0,
    )


class TestCreateWithQuestion:
    """Tests for create_with_question method."""

    @pytest.mark.asyncio
    async def test_creates_news_and_question_with_valid_deck(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        mock_httpx_response: MagicMock,
        active_culture_deck: CultureDeck,
    ):
        """Should create news item and linked question when deck is valid."""
        with patch("src.services.news_item_service.httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_httpx_response)
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            service = NewsItemService(db_session, s3_service=mock_s3_service)

            create_data = NewsItemWithQuestionCreate(
                title_el="Ελληνικά νέα",
                title_en="Greek News",
                title_ru="Греческие новости",
                description_el="Περιγραφή στα ελληνικά",
                description_en="Description in English",
                description_ru="Описание на русском",
                publication_date=date.today(),
                original_article_url="https://example.com/news-with-question",
                source_image_url="https://example.com/image.jpg",
                question=make_question_create(active_culture_deck.id),
            )

            result = await service.create_with_question(create_data)

            # Verify news item created
            assert result.news_item.title_el == "Ελληνικά νέα"
            assert result.news_item.title_en == "Greek News"

            # Verify card was created
            assert result.card is not None
            assert result.card.deck_id == active_culture_deck.id

            # Verify success message
            assert result.message == "News item and question created successfully"

    @pytest.mark.asyncio
    async def test_raises_error_for_nonexistent_deck(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        mock_httpx_response: MagicMock,
    ):
        """Should raise ValueError when deck_id does not exist."""
        with patch("src.services.news_item_service.httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_httpx_response)
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            service = NewsItemService(db_session, s3_service=mock_s3_service)

            nonexistent_deck_id = uuid4()
            create_data = NewsItemWithQuestionCreate(
                title_el="Ελληνικά νέα",
                title_en="Greek News",
                title_ru="Греческие новости",
                description_el="Περιγραφή στα ελληνικά",
                description_en="Description in English",
                description_ru="Описание на русском",
                publication_date=date.today(),
                original_article_url="https://example.com/news-nonexistent-deck",
                source_image_url="https://example.com/image.jpg",
                question=make_question_create(nonexistent_deck_id),
            )

            with pytest.raises(ValueError, match="not found or is inactive"):
                await service.create_with_question(create_data)

    @pytest.mark.asyncio
    async def test_raises_error_for_inactive_deck(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        mock_httpx_response: MagicMock,
        inactive_culture_deck: CultureDeck,
    ):
        """Should raise ValueError when deck is inactive."""
        with patch("src.services.news_item_service.httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_httpx_response)
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            service = NewsItemService(db_session, s3_service=mock_s3_service)

            create_data = NewsItemWithQuestionCreate(
                title_el="Ελληνικά νέα",
                title_en="Greek News",
                title_ru="Греческие новости",
                description_el="Περιγραφή στα ελληνικά",
                description_en="Description in English",
                description_ru="Описание на русском",
                publication_date=date.today(),
                original_article_url="https://example.com/news-inactive-deck",
                source_image_url="https://example.com/image.jpg",
                question=make_question_create(inactive_culture_deck.id),
            )

            with pytest.raises(ValueError, match="not found or is inactive"):
                await service.create_with_question(create_data)

    @pytest.mark.asyncio
    async def test_creates_news_without_question_when_no_question_provided(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        mock_httpx_response: MagicMock,
    ):
        """Should create news item only when no question data provided."""
        with patch("src.services.news_item_service.httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_httpx_response)
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            service = NewsItemService(db_session, s3_service=mock_s3_service)

            create_data = NewsItemWithQuestionCreate(
                title_el="Ελληνικά νέα",
                title_en="Greek News",
                title_ru="Греческие новости",
                description_el="Περιγραφή στα ελληνικά",
                description_en="Description in English",
                description_ru="Описание на русском",
                publication_date=date.today(),
                original_article_url="https://example.com/news-no-question",
                source_image_url="https://example.com/image.jpg",
                question=None,  # No question
            )

            result = await service.create_with_question(create_data)

            # Verify news item created
            assert result.news_item.title_el == "Ελληνικά νέα"

            # Verify no card was created
            assert result.card is None

            # Verify success message without question
            assert result.message == "News item created successfully"


# =============================================================================
# Test Get List With Cards
# =============================================================================


class TestGetListWithCards:
    """Tests for get_list_with_cards method."""

    @pytest.mark.asyncio
    async def test_returns_single_item_when_multiple_questions_match(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        active_culture_deck: CultureDeck,
    ):
        """Should return one news item even when multiple questions share same URL."""
        from src.db.models import CultureQuestion

        # Create a single news item
        news_item = NewsItem(
            title_el="Greek News",
            title_en="English News",
            title_ru="Russian News",
            description_el="Greek description",
            description_en="English description",
            description_ru="Russian description",
            publication_date=date.today(),
            original_article_url="https://example.com/article-with-many-questions",
            image_s3_key="news-images/test.jpg",
        )
        db_session.add(news_item)
        await db_session.flush()

        # Create 3 CultureQuestions that share the same original_article_url
        for i in range(3):
            question = CultureQuestion(
                deck_id=active_culture_deck.id,
                question_text={"el": f"Question {i}", "en": f"Question {i}"},
                option_a={"el": "A", "en": "A"},
                option_b={"el": "B", "en": "B"},
                option_c={"el": "C", "en": "C"},
                option_d={"el": "D", "en": "D"},
                correct_option=1,
                original_article_url="https://example.com/article-with-many-questions",
            )
            db_session.add(question)

        await db_session.commit()

        service = NewsItemService(db_session, s3_service=mock_s3_service)

        result = await service.get_list_with_cards(page=1, page_size=10)

        # Should return exactly 1 item, not 3 duplicates
        assert len(result.items) == 1
        assert result.total == 1
        assert result.items[0].title_en == "English News"

    @pytest.mark.asyncio
    async def test_returns_card_info_for_linked_questions(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        active_culture_deck: CultureDeck,
    ):
        """Should include card_id and deck_id when questions are linked."""
        from src.db.models import CultureQuestion

        # Create news item
        news_item = NewsItem(
            title_el="Greek News",
            title_en="English News",
            title_ru="Russian News",
            description_el="Greek description",
            description_en="English description",
            description_ru="Russian description",
            publication_date=date.today(),
            original_article_url="https://example.com/article-with-card",
            image_s3_key="news-images/test.jpg",
        )
        db_session.add(news_item)
        await db_session.flush()

        # Create linked question
        question = CultureQuestion(
            deck_id=active_culture_deck.id,
            question_text={"el": "Question", "en": "Question"},
            option_a={"el": "A", "en": "A"},
            option_b={"el": "B", "en": "B"},
            option_c={"el": "C", "en": "C"},
            option_d={"el": "D", "en": "D"},
            correct_option=1,
            original_article_url="https://example.com/article-with-card",
        )
        db_session.add(question)
        await db_session.commit()
        await db_session.refresh(question)

        service = NewsItemService(db_session, s3_service=mock_s3_service)

        result = await service.get_list_with_cards(page=1, page_size=10)

        assert len(result.items) == 1
        assert result.items[0].card_id == question.id
        assert result.items[0].deck_id == active_culture_deck.id

    @pytest.mark.asyncio
    async def test_returns_none_card_info_when_no_linked_questions(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
    ):
        """Should return card_id=None when no questions are linked."""
        # Create news item without any linked questions
        news_item = NewsItem(
            title_el="Greek News",
            title_en="English News",
            title_ru="Russian News",
            description_el="Greek description",
            description_en="English description",
            description_ru="Russian description",
            publication_date=date.today(),
            original_article_url="https://example.com/article-no-questions",
            image_s3_key="news-images/test.jpg",
        )
        db_session.add(news_item)
        await db_session.commit()

        service = NewsItemService(db_session, s3_service=mock_s3_service)

        result = await service.get_list_with_cards(page=1, page_size=10)

        assert len(result.items) == 1
        assert result.items[0].card_id is None
        assert result.items[0].deck_id is None

    @pytest.mark.asyncio
    async def test_pagination_total_matches_unique_items(
        self,
        db_session: AsyncSession,
        mock_s3_service: MagicMock,
        active_culture_deck: CultureDeck,
    ):
        """Should report total matching unique NewsItems, not JOIN rows."""
        from src.db.models import CultureQuestion

        # Create 3 distinct news items
        for i in range(3):
            news_item = NewsItem(
                title_el=f"Greek News {i}",
                title_en=f"English News {i}",
                title_ru=f"Russian News {i}",
                description_el="Greek description",
                description_en="English description",
                description_ru="Russian description",
                publication_date=date.today(),
                original_article_url=f"https://example.com/article-{i}",
                image_s3_key=f"news-images/test-{i}.jpg",
            )
            db_session.add(news_item)

        await db_session.flush()

        # Create multiple questions for the first news item (to test JOIN doesn't inflate count)
        for j in range(5):
            question = CultureQuestion(
                deck_id=active_culture_deck.id,
                question_text={"el": f"Question {j}", "en": f"Question {j}"},
                option_a={"el": "A", "en": "A"},
                option_b={"el": "B", "en": "B"},
                option_c={"el": "C", "en": "C"},
                option_d={"el": "D", "en": "D"},
                correct_option=1,
                original_article_url="https://example.com/article-0",
            )
            db_session.add(question)

        await db_session.commit()

        service = NewsItemService(db_session, s3_service=mock_s3_service)

        result = await service.get_list_with_cards(page=1, page_size=10)

        # Should have exactly 3 items (not 3 + 4 extra from JOIN)
        assert len(result.items) == 3
        # Total should match the number of unique news items
        assert result.total == 3
