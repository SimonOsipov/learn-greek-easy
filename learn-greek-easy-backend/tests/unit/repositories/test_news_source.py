"""Unit tests for NewsSourceRepository.

This module tests:
- list_all: List sources with optional is_active filter
- count_all: Count sources with optional is_active filter
- get_by_url: Get source by URL
- url_exists: Check URL uniqueness with optional exclude_id

Tests use real database fixtures to verify SQL queries work correctly.
"""

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import NewsSource
from src.repositories.news_source import NewsSourceRepository

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def news_source(db_session: AsyncSession) -> NewsSource:
    """Create an active news source for testing."""
    source = NewsSource(
        name="Kathimerini",
        url="https://www.kathimerini.gr",
        is_active=True,
    )
    db_session.add(source)
    await db_session.flush()
    await db_session.refresh(source)
    return source


@pytest.fixture
async def inactive_news_source(db_session: AsyncSession) -> NewsSource:
    """Create an inactive news source for testing."""
    source = NewsSource(
        name="Archived Source",
        url="https://archived.example.com",
        is_active=False,
    )
    db_session.add(source)
    await db_session.flush()
    await db_session.refresh(source)
    return source


@pytest.fixture
async def second_news_source(db_session: AsyncSession) -> NewsSource:
    """Create a second active news source for testing."""
    source = NewsSource(
        name="Proto Thema",
        url="https://www.protothema.gr",
        is_active=True,
    )
    db_session.add(source)
    await db_session.flush()
    await db_session.refresh(source)
    return source


# =============================================================================
# Test list_all
# =============================================================================


class TestListAll:
    """Tests for list_all method."""

    @pytest.mark.asyncio
    async def test_returns_all_sources_when_no_filter(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
        inactive_news_source: NewsSource,
    ):
        """Should return all sources when is_active is None."""
        repo = NewsSourceRepository(db_session)
        result = await repo.list_all()
        source_ids = [s.id for s in result]
        assert news_source.id in source_ids
        assert inactive_news_source.id in source_ids

    @pytest.mark.asyncio
    async def test_filters_active_only(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
        inactive_news_source: NewsSource,
    ):
        """Should return only active sources when is_active=True."""
        repo = NewsSourceRepository(db_session)
        result = await repo.list_all(is_active=True)
        assert all(s.is_active for s in result)
        source_ids = [s.id for s in result]
        assert news_source.id in source_ids
        assert inactive_news_source.id not in source_ids

    @pytest.mark.asyncio
    async def test_filters_inactive_only(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
        inactive_news_source: NewsSource,
    ):
        """Should return only inactive sources when is_active=False."""
        repo = NewsSourceRepository(db_session)
        result = await repo.list_all(is_active=False)
        assert all(not s.is_active for s in result)
        source_ids = [s.id for s in result]
        assert news_source.id not in source_ids
        assert inactive_news_source.id in source_ids

    @pytest.mark.asyncio
    async def test_respects_pagination_limit(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
        second_news_source: NewsSource,
    ):
        """Should respect limit parameter."""
        repo = NewsSourceRepository(db_session)
        result = await repo.list_all(skip=0, limit=1)
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_respects_pagination_skip(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
        second_news_source: NewsSource,
    ):
        """Should skip sources correctly."""
        repo = NewsSourceRepository(db_session)
        result_all = await repo.list_all()
        result_skip = await repo.list_all(skip=1, limit=10)
        assert len(result_skip) == len(result_all) - 1

    @pytest.mark.asyncio
    async def test_orders_by_created_at_desc(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
        second_news_source: NewsSource,
    ):
        """Should order by created_at descending (newest first)."""
        repo = NewsSourceRepository(db_session)
        result = await repo.list_all()
        if len(result) > 1:
            assert result[0].created_at >= result[1].created_at


# =============================================================================
# Test count_all
# =============================================================================


class TestCountAll:
    """Tests for count_all method."""

    @pytest.mark.asyncio
    async def test_counts_all_when_no_filter(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
        inactive_news_source: NewsSource,
    ):
        """Should count all sources when no filter."""
        repo = NewsSourceRepository(db_session)
        result = await repo.count_all()
        assert result >= 2

    @pytest.mark.asyncio
    async def test_counts_active_only(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
        inactive_news_source: NewsSource,
    ):
        """Should count only active sources."""
        repo = NewsSourceRepository(db_session)
        result = await repo.count_all(is_active=True)
        assert result >= 1

    @pytest.mark.asyncio
    async def test_counts_inactive_only(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
        inactive_news_source: NewsSource,
    ):
        """Should count only inactive sources."""
        repo = NewsSourceRepository(db_session)
        result = await repo.count_all(is_active=False)
        assert result >= 1


# =============================================================================
# Test get_by_url
# =============================================================================


class TestGetByUrl:
    """Tests for get_by_url method."""

    @pytest.mark.asyncio
    async def test_returns_source_when_found(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
    ):
        """Should return source when URL exists."""
        repo = NewsSourceRepository(db_session)
        result = await repo.get_by_url("https://www.kathimerini.gr")
        assert result is not None
        assert result.id == news_source.id

    @pytest.mark.asyncio
    async def test_returns_none_for_nonexistent_url(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
    ):
        """Should return None for non-existent URL."""
        repo = NewsSourceRepository(db_session)
        result = await repo.get_by_url("https://nonexistent.example.com")
        assert result is None


# =============================================================================
# Test url_exists
# =============================================================================


class TestUrlExists:
    """Tests for url_exists method."""

    @pytest.mark.asyncio
    async def test_returns_true_when_url_exists(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
    ):
        """Should return True when URL exists."""
        repo = NewsSourceRepository(db_session)
        result = await repo.url_exists("https://www.kathimerini.gr")
        assert result is True

    @pytest.mark.asyncio
    async def test_returns_false_when_url_not_exists(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
    ):
        """Should return False when URL doesn't exist."""
        repo = NewsSourceRepository(db_session)
        result = await repo.url_exists("https://nonexistent.example.com")
        assert result is False

    @pytest.mark.asyncio
    async def test_excludes_specified_id(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
    ):
        """Should return False when URL exists but ID is excluded (update scenario)."""
        repo = NewsSourceRepository(db_session)
        result = await repo.url_exists("https://www.kathimerini.gr", exclude_id=news_source.id)
        assert result is False

    @pytest.mark.asyncio
    async def test_returns_true_when_url_exists_different_id(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
    ):
        """Should return True when URL exists on different record."""
        repo = NewsSourceRepository(db_session)
        different_id = uuid4()
        result = await repo.url_exists("https://www.kathimerini.gr", exclude_id=different_id)
        assert result is True
