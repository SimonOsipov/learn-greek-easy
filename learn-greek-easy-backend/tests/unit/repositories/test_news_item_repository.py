"""Unit tests for NewsItemRepository.

This module tests:
- get_list: Get news items with pagination ordered by date (INNER JOIN)
- exists_by_url: Check for duplicate article URLs
- count_all: Count news items (excludes orphans via INNER JOIN)
- count_with_b1_audio: B1 audio count aggregate
- count_b1_pending_regen: B1 pending regen count aggregate

Tests use real database fixtures to verify SQL queries work correctly.
"""

from datetime import date, timedelta
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import DescriptionSourceType, NewsItem
from src.repositories.news_item import NewsItemRepository
from tests.factories.news import NewsItemFactory
from tests.factories.situation import SituationFactory
from tests.factories.situation_description import SituationDescriptionFactory

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
# Test count_with_b1_audio
# =============================================================================


async def _make_news_item_with_b1(
    db_session: AsyncSession,
    *,
    has_b1: bool,
    has_audio: bool,
) -> NewsItem:
    """Helper: create a NewsItem whose Situation.levels optionally contains 'B1'
    and whose SituationDescription.audio_s3_key is optionally set."""
    levels = ["B1"] if has_b1 else []
    situation = await SituationFactory.create(session=db_session, ready=True)
    situation.levels = levels
    await db_session.flush()

    url = f"https://example.com/b1-article-{uuid4().hex[:8]}"
    desc = await SituationDescriptionFactory.create(
        session=db_session,
        situation_id=situation.id,
        source_type=DescriptionSourceType.NEWS,
        source_url=url,
    )
    if has_audio:
        desc.audio_s3_key = f"audio/{uuid4().hex}.mp3"
        await db_session.flush()

    news_item = NewsItem(
        situation_id=situation.id,
        publication_date=date.today(),
        original_article_url=url,
    )
    db_session.add(news_item)
    await db_session.flush()
    return news_item


class TestCountWithB1Audio:
    """Tests for count_with_b1_audio method — three fixture states."""

    @pytest.mark.asyncio
    async def test_all_absent_returns_zero(self, db_session: AsyncSession):
        """No B1 items at all → b1_audio_count == 0."""
        # Create an item with B1 levels but NO audio
        await _make_news_item_with_b1(db_session, has_b1=True, has_audio=False)
        # Create an item with audio but NOT B1
        await _make_news_item_with_b1(db_session, has_b1=False, has_audio=True)

        repo = NewsItemRepository(db_session)
        result = await repo.count_with_b1_audio()

        assert result == 0

    @pytest.mark.asyncio
    async def test_all_present_returns_correct_count(self, db_session: AsyncSession):
        """All three items have B1 + audio → b1_audio_count == 3."""
        for _ in range(3):
            await _make_news_item_with_b1(db_session, has_b1=True, has_audio=True)

        repo = NewsItemRepository(db_session)
        result = await repo.count_with_b1_audio()

        assert result == 3

    @pytest.mark.asyncio
    async def test_mixed_returns_partial_count(self, db_session: AsyncSession):
        """2 with B1+audio, 1 with B1 but no audio → b1_audio_count == 2."""
        await _make_news_item_with_b1(db_session, has_b1=True, has_audio=True)
        await _make_news_item_with_b1(db_session, has_b1=True, has_audio=True)
        await _make_news_item_with_b1(db_session, has_b1=True, has_audio=False)

        repo = NewsItemRepository(db_session)
        result = await repo.count_with_b1_audio()

        assert result == 2


# =============================================================================
# Test count_b1_pending_regen
# =============================================================================


class TestCountB1PendingRegen:
    """Tests for count_b1_pending_regen method — three fixture states."""

    @pytest.mark.asyncio
    async def test_all_absent_returns_zero(self, db_session: AsyncSession):
        """No B1 items at all → b1_pending_regen_count == 0."""
        # Non-B1 item with no audio — should NOT count
        await _make_news_item_with_b1(db_session, has_b1=False, has_audio=False)
        # B1 item with audio already generated — should NOT count as pending
        await _make_news_item_with_b1(db_session, has_b1=True, has_audio=True)

        repo = NewsItemRepository(db_session)
        result = await repo.count_b1_pending_regen()

        assert result == 0

    @pytest.mark.asyncio
    async def test_all_present_returns_correct_count(self, db_session: AsyncSession):
        """Three B1 items without audio → b1_pending_regen_count == 3."""
        for _ in range(3):
            await _make_news_item_with_b1(db_session, has_b1=True, has_audio=False)

        repo = NewsItemRepository(db_session)
        result = await repo.count_b1_pending_regen()

        assert result == 3

    @pytest.mark.asyncio
    async def test_mixed_returns_partial_count(self, db_session: AsyncSession):
        """1 B1 with audio (done) + 2 B1 without audio (pending) → pending == 2."""
        await _make_news_item_with_b1(db_session, has_b1=True, has_audio=True)
        await _make_news_item_with_b1(db_session, has_b1=True, has_audio=False)
        await _make_news_item_with_b1(db_session, has_b1=True, has_audio=False)

        repo = NewsItemRepository(db_session)
        result = await repo.count_b1_pending_regen()

        assert result == 2
