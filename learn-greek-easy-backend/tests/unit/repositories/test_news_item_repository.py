"""Unit tests for NewsItemRepository.

This module tests:
- get_list: Get news items with pagination ordered by date
- get_recent: Get most recent news items
- exists_by_url: Check for duplicate article URLs
- CRUD operations inherited from BaseRepository

Tests use real database fixtures to verify SQL queries work correctly.
"""

from datetime import date, timedelta
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import NewsItem
from src.repositories.news_item import NewsItemRepository

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def news_items(db_session: AsyncSession) -> list[NewsItem]:
    """Create multiple news items with different publication dates."""
    items = []
    base_date = date.today()

    for i in range(5):
        item = NewsItem(
            title_el=f"Greek Title {i + 1}",
            title_en=f"English Title {i + 1}",
            description_el=f"Greek description for news item {i + 1}",
            description_en=f"English description for news item {i + 1}",
            publication_date=base_date - timedelta(days=i),  # Newest first
            original_article_url=f"https://example.com/article-{i + 1}",
            image_s3_key=f"news-images/{uuid4()}.jpg",
        )
        db_session.add(item)
        items.append(item)

    await db_session.flush()
    for item in items:
        await db_session.refresh(item)

    return items


@pytest.fixture
async def single_news_item(db_session: AsyncSession) -> NewsItem:
    """Create a single news item for testing."""
    item = NewsItem(
        title_el="Test Greek Title",
        title_en="Test English Title",
        description_el="Test Greek description",
        description_en="Test English description",
        publication_date=date.today(),
        original_article_url="https://example.com/test-article",
        image_s3_key=f"news-images/{uuid4()}.jpg",
    )
    db_session.add(item)
    await db_session.flush()
    await db_session.refresh(item)
    return item


# =============================================================================
# Test get_list
# =============================================================================


class TestGetList:
    """Tests for get_list method."""

    @pytest.mark.asyncio
    async def test_returns_items_ordered_by_date(
        self,
        db_session: AsyncSession,
        news_items: list[NewsItem],
    ):
        """Should return news items ordered by publication_date DESC."""
        repo = NewsItemRepository(db_session)

        result = await repo.get_list()

        assert len(result) == len(news_items)
        # Verify descending order by publication_date
        for i in range(len(result) - 1):
            assert result[i].publication_date >= result[i + 1].publication_date

    @pytest.mark.asyncio
    async def test_respects_skip_parameter(
        self,
        db_session: AsyncSession,
        news_items: list[NewsItem],
    ):
        """Should skip items correctly."""
        repo = NewsItemRepository(db_session)

        result = await repo.get_list(skip=2)

        assert len(result) == len(news_items) - 2

    @pytest.mark.asyncio
    async def test_respects_limit_parameter(
        self,
        db_session: AsyncSession,
        news_items: list[NewsItem],
    ):
        """Should limit results correctly."""
        repo = NewsItemRepository(db_session)

        result = await repo.get_list(limit=2)

        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_skip_and_limit_combined(
        self,
        db_session: AsyncSession,
        news_items: list[NewsItem],
    ):
        """Should handle skip and limit together for pagination."""
        repo = NewsItemRepository(db_session)

        result = await repo.get_list(skip=1, limit=2)

        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_no_items(
        self,
        db_session: AsyncSession,
    ):
        """Should return empty list when no news items exist."""
        repo = NewsItemRepository(db_session)

        result = await repo.get_list()

        assert result == []


# =============================================================================
# Test get_recent
# =============================================================================


class TestGetRecent:
    """Tests for get_recent method."""

    @pytest.mark.asyncio
    async def test_returns_limited_items(
        self,
        db_session: AsyncSession,
        news_items: list[NewsItem],
    ):
        """Should return limited number of recent items."""
        repo = NewsItemRepository(db_session)

        result = await repo.get_recent(limit=3)

        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_returns_most_recent(
        self,
        db_session: AsyncSession,
        news_items: list[NewsItem],
    ):
        """Should return the most recent items by publication_date."""
        repo = NewsItemRepository(db_session)

        result = await repo.get_recent(limit=3)

        # Verify these are the newest items
        for i in range(len(result) - 1):
            assert result[i].publication_date >= result[i + 1].publication_date

    @pytest.mark.asyncio
    async def test_default_limit_is_3(
        self,
        db_session: AsyncSession,
        news_items: list[NewsItem],
    ):
        """Should default to 3 items when no limit specified."""
        repo = NewsItemRepository(db_session)

        result = await repo.get_recent()

        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_returns_all_when_fewer_than_limit(
        self,
        db_session: AsyncSession,
        single_news_item: NewsItem,
    ):
        """Should return all items when fewer exist than limit."""
        repo = NewsItemRepository(db_session)

        result = await repo.get_recent(limit=10)

        assert len(result) == 1


# =============================================================================
# Test exists_by_url
# =============================================================================


class TestExistsByUrl:
    """Tests for exists_by_url method."""

    @pytest.mark.asyncio
    async def test_returns_true_when_exists(
        self,
        db_session: AsyncSession,
        single_news_item: NewsItem,
    ):
        """Should return True when URL exists."""
        repo = NewsItemRepository(db_session)

        result = await repo.exists_by_url(single_news_item.original_article_url)

        assert result is True

    @pytest.mark.asyncio
    async def test_returns_false_when_not_exists(
        self,
        db_session: AsyncSession,
    ):
        """Should return False when URL doesn't exist."""
        repo = NewsItemRepository(db_session)

        result = await repo.exists_by_url("https://example.com/nonexistent-article")

        assert result is False


# =============================================================================
# Test CRUD operations
# =============================================================================


class TestCreate:
    """Tests for create method (inherited from BaseRepository)."""

    @pytest.mark.asyncio
    async def test_creates_news_item(
        self,
        db_session: AsyncSession,
    ):
        """Should create a news item successfully."""
        repo = NewsItemRepository(db_session)

        news_item_data = {
            "title_el": "New Greek Title",
            "title_en": "New English Title",
            "description_el": "New Greek description",
            "description_en": "New English description",
            "publication_date": date.today(),
            "original_article_url": "https://example.com/new-article",
            "image_s3_key": f"news-images/{uuid4()}.jpg",
        }

        result = await repo.create(news_item_data)

        assert result.id is not None
        assert result.title_el == "New Greek Title"
        assert result.title_en == "New English Title"


class TestGetById:
    """Tests for get method (inherited from BaseRepository)."""

    @pytest.mark.asyncio
    async def test_returns_item_when_exists(
        self,
        db_session: AsyncSession,
        single_news_item: NewsItem,
    ):
        """Should return news item when it exists."""
        repo = NewsItemRepository(db_session)

        result = await repo.get(single_news_item.id)

        assert result is not None
        assert result.id == single_news_item.id

    @pytest.mark.asyncio
    async def test_returns_none_when_not_exists(
        self,
        db_session: AsyncSession,
    ):
        """Should return None when news item doesn't exist."""
        repo = NewsItemRepository(db_session)

        result = await repo.get(uuid4())

        assert result is None


class TestUpdate:
    """Tests for update method (inherited from BaseRepository)."""

    @pytest.mark.asyncio
    async def test_updates_news_item(
        self,
        db_session: AsyncSession,
        single_news_item: NewsItem,
    ):
        """Should update news item fields."""
        repo = NewsItemRepository(db_session)

        update_data = {
            "title_en": "Updated English Title",
        }

        result = await repo.update(single_news_item, update_data)

        assert result.title_en == "Updated English Title"
        # Other fields should remain unchanged
        assert result.title_el == single_news_item.title_el


class TestDelete:
    """Tests for delete method (inherited from BaseRepository)."""

    @pytest.mark.asyncio
    async def test_deletes_news_item(
        self,
        db_session: AsyncSession,
        single_news_item: NewsItem,
    ):
        """Should delete news item successfully."""
        repo = NewsItemRepository(db_session)
        item_id = single_news_item.id

        await repo.delete(single_news_item)
        await db_session.flush()

        # Verify it's deleted
        result = await repo.get(item_id)
        assert result is None


class TestCountAll:
    """Tests for count_all method."""

    @pytest.mark.asyncio
    async def test_counts_all_items(
        self,
        db_session: AsyncSession,
        news_items: list[NewsItem],
    ):
        """Should return correct count of all news items."""
        repo = NewsItemRepository(db_session)

        result = await repo.count_all()

        assert result == len(news_items)

    @pytest.mark.asyncio
    async def test_returns_zero_when_empty(
        self,
        db_session: AsyncSession,
    ):
        """Should return 0 when no news items exist."""
        repo = NewsItemRepository(db_session)

        result = await repo.count_all()

        assert result == 0
