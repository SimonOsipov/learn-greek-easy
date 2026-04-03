"""Unit tests for NewsItemRepository.

This module tests:
- get_list: Get news items with pagination ordered by date (INNER JOIN)
- exists_by_url: Check for duplicate article URLs
- count_all: Count news items (excludes orphans via INNER JOIN)

Tests use real database fixtures to verify SQL queries work correctly.
"""

from datetime import date, timedelta
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import NewsItem
from src.repositories.news_item import NewsItemRepository
from tests.factories.news import NewsItemFactory

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def news_items(db_session: AsyncSession):
    """Create multiple news items with different publication dates."""
    items = []
    base_date = date.today()

    for i in range(5):
        item = await NewsItemFactory.create(
            session=db_session,
            publication_date=base_date - timedelta(days=i),
        )
        items.append(item)

    return items


@pytest.fixture
async def single_news_item(db_session: AsyncSession):
    """Create a single news item for testing."""
    return await NewsItemFactory.create(session=db_session)


# =============================================================================
# Test get_list
# =============================================================================


class TestGetList:
    """Tests for get_list method."""

    @pytest.mark.asyncio
    async def test_returns_items_ordered_by_date(
        self,
        db_session: AsyncSession,
        news_items,
    ):
        """Should return news items ordered by publication_date DESC."""
        repo = NewsItemRepository(db_session)

        result = await repo.get_list()

        assert len(result) == len(news_items)
        # Verify descending order by publication_date
        for i in range(len(result) - 1):
            assert result[i][0].publication_date >= result[i + 1][0].publication_date

    @pytest.mark.asyncio
    async def test_respects_skip_parameter(
        self,
        db_session: AsyncSession,
        news_items,
    ):
        """Should skip items correctly."""
        repo = NewsItemRepository(db_session)

        result = await repo.get_list(skip=2)

        assert len(result) == len(news_items) - 2

    @pytest.mark.asyncio
    async def test_respects_limit_parameter(
        self,
        db_session: AsyncSession,
        news_items,
    ):
        """Should limit results correctly."""
        repo = NewsItemRepository(db_session)

        result = await repo.get_list(limit=2)

        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_skip_and_limit_combined(
        self,
        db_session: AsyncSession,
        news_items,
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
# Test get (by id)
# =============================================================================


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


# =============================================================================
# Test delete
# =============================================================================


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


# =============================================================================
# Test count_all
# =============================================================================


class TestCountAll:
    """Tests for count_all method."""

    @pytest.mark.asyncio
    async def test_counts_all_items(
        self,
        db_session: AsyncSession,
        news_items,
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


# =============================================================================
# Test INNER JOIN behavior (orphan exclusion)
# =============================================================================


class TestInnerJoinBehavior:
    """Repository INNER JOIN excludes orphaned NewsItems."""

    @pytest.mark.asyncio
    async def test_orphaned_news_item_excluded(self, db_session: AsyncSession):
        """NewsItem with situation_id=None is excluded from get_list."""
        # Create valid news item (has situation+description via factory)
        await NewsItemFactory.create(session=db_session)
        # Create orphan (no situation)
        orphan = NewsItem(
            publication_date=date.today(),
            original_article_url="https://example.com/orphan",
        )
        db_session.add(orphan)
        await db_session.flush()

        repo = NewsItemRepository(db_session)
        result = await repo.get_list()
        # Only the valid item should appear
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_count_excludes_orphaned(self, db_session: AsyncSession):
        """count_all() excludes orphaned NewsItems."""
        await NewsItemFactory.create(session=db_session)
        orphan = NewsItem(
            publication_date=date.today(),
            original_article_url="https://example.com/orphan-count",
        )
        db_session.add(orphan)
        await db_session.flush()

        repo = NewsItemRepository(db_session)
        count = await repo.count_all()
        assert count == 1
