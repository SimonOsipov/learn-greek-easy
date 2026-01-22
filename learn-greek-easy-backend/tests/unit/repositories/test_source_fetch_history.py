"""Unit tests for SourceFetchHistoryRepository.

This module tests:
- list_by_source: List history for a source with ordering and limit
- count_by_source: Count history entries for a source
- get_latest_by_source: Get the most recent fetch for a source

Tests use real database fixtures to verify SQL queries work correctly.
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import NewsSource, SourceFetchHistory
from src.repositories.source_fetch_history import SourceFetchHistoryRepository

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def news_source(db_session: AsyncSession) -> NewsSource:
    """Create a news source for testing."""
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
async def second_news_source(db_session: AsyncSession) -> NewsSource:
    """Create a second news source for testing isolation."""
    source = NewsSource(
        name="Proto Thema",
        url="https://www.protothema.gr",
        is_active=True,
    )
    db_session.add(source)
    await db_session.flush()
    await db_session.refresh(source)
    return source


@pytest.fixture
async def fetch_history_success(
    db_session: AsyncSession, news_source: NewsSource
) -> SourceFetchHistory:
    """Create a successful fetch history entry."""
    history = SourceFetchHistory(
        source_id=news_source.id,
        fetched_at=datetime.now(timezone.utc) - timedelta(hours=1),
        status="success",
        html_content="<html><body>Test content</body></html>",
        html_size_bytes=42,
        trigger_type="manual",
        final_url="https://www.kathimerini.gr",
    )
    db_session.add(history)
    await db_session.flush()
    await db_session.refresh(history)
    return history


@pytest.fixture
async def fetch_history_error(
    db_session: AsyncSession, news_source: NewsSource
) -> SourceFetchHistory:
    """Create a failed fetch history entry."""
    history = SourceFetchHistory(
        source_id=news_source.id,
        fetched_at=datetime.now(timezone.utc) - timedelta(hours=2),
        status="error",
        error_message="Connection timeout after 30.0s",
        trigger_type="scheduled",
    )
    db_session.add(history)
    await db_session.flush()
    await db_session.refresh(history)
    return history


@pytest.fixture
async def fetch_history_recent(
    db_session: AsyncSession, news_source: NewsSource
) -> SourceFetchHistory:
    """Create the most recent fetch history entry."""
    history = SourceFetchHistory(
        source_id=news_source.id,
        fetched_at=datetime.now(timezone.utc),
        status="success",
        html_content="<html><body>Most recent content</body></html>",
        html_size_bytes=50,
        trigger_type="manual",
        final_url="https://www.kathimerini.gr",
    )
    db_session.add(history)
    await db_session.flush()
    await db_session.refresh(history)
    return history


@pytest.fixture
async def other_source_history(
    db_session: AsyncSession, second_news_source: NewsSource
) -> SourceFetchHistory:
    """Create a fetch history for a different source (isolation test)."""
    history = SourceFetchHistory(
        source_id=second_news_source.id,
        fetched_at=datetime.now(timezone.utc),
        status="success",
        html_content="<html><body>Other source content</body></html>",
        html_size_bytes=48,
        trigger_type="manual",
        final_url="https://www.protothema.gr",
    )
    db_session.add(history)
    await db_session.flush()
    await db_session.refresh(history)
    return history


# =============================================================================
# Test list_by_source
# =============================================================================


class TestListBySource:
    """Tests for list_by_source method."""

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_no_history(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
    ):
        """Should return empty list when source has no fetch history."""
        repo = SourceFetchHistoryRepository(db_session)
        result = await repo.list_by_source(news_source.id)
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_history_for_source(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
        fetch_history_success: SourceFetchHistory,
    ):
        """Should return history entries for the source."""
        repo = SourceFetchHistoryRepository(db_session)
        result = await repo.list_by_source(news_source.id)
        assert len(result) == 1
        assert result[0].id == fetch_history_success.id

    @pytest.mark.asyncio
    async def test_returns_multiple_entries(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
        fetch_history_success: SourceFetchHistory,
        fetch_history_error: SourceFetchHistory,
        fetch_history_recent: SourceFetchHistory,
    ):
        """Should return multiple history entries."""
        repo = SourceFetchHistoryRepository(db_session)
        result = await repo.list_by_source(news_source.id)
        assert len(result) == 3
        history_ids = [h.id for h in result]
        assert fetch_history_success.id in history_ids
        assert fetch_history_error.id in history_ids
        assert fetch_history_recent.id in history_ids

    @pytest.mark.asyncio
    async def test_orders_by_fetched_at_desc(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
        fetch_history_success: SourceFetchHistory,
        fetch_history_error: SourceFetchHistory,
        fetch_history_recent: SourceFetchHistory,
    ):
        """Should order by fetched_at descending (most recent first)."""
        repo = SourceFetchHistoryRepository(db_session)
        result = await repo.list_by_source(news_source.id)

        # Most recent should be first
        assert result[0].id == fetch_history_recent.id
        # Verify descending order
        for i in range(len(result) - 1):
            assert result[i].fetched_at >= result[i + 1].fetched_at

    @pytest.mark.asyncio
    async def test_respects_limit_parameter(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
        fetch_history_success: SourceFetchHistory,
        fetch_history_error: SourceFetchHistory,
        fetch_history_recent: SourceFetchHistory,
    ):
        """Should respect the limit parameter."""
        repo = SourceFetchHistoryRepository(db_session)
        result = await repo.list_by_source(news_source.id, limit=2)
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_filters_by_source_id(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
        second_news_source: NewsSource,
        fetch_history_success: SourceFetchHistory,
        other_source_history: SourceFetchHistory,
    ):
        """Should only return history for the specified source."""
        repo = SourceFetchHistoryRepository(db_session)

        # Get history for first source
        result = await repo.list_by_source(news_source.id)
        assert len(result) == 1
        assert result[0].id == fetch_history_success.id

        # Get history for second source
        result2 = await repo.list_by_source(second_news_source.id)
        assert len(result2) == 1
        assert result2[0].id == other_source_history.id


# =============================================================================
# Test count_by_source
# =============================================================================


class TestCountBySource:
    """Tests for count_by_source method."""

    @pytest.mark.asyncio
    async def test_returns_zero_when_no_history(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
    ):
        """Should return 0 when source has no fetch history."""
        repo = SourceFetchHistoryRepository(db_session)
        result = await repo.count_by_source(news_source.id)
        assert result == 0

    @pytest.mark.asyncio
    async def test_counts_single_entry(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
        fetch_history_success: SourceFetchHistory,
    ):
        """Should count a single history entry."""
        repo = SourceFetchHistoryRepository(db_session)
        result = await repo.count_by_source(news_source.id)
        assert result == 1

    @pytest.mark.asyncio
    async def test_counts_multiple_entries(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
        fetch_history_success: SourceFetchHistory,
        fetch_history_error: SourceFetchHistory,
        fetch_history_recent: SourceFetchHistory,
    ):
        """Should count all history entries for the source."""
        repo = SourceFetchHistoryRepository(db_session)
        result = await repo.count_by_source(news_source.id)
        assert result == 3

    @pytest.mark.asyncio
    async def test_counts_only_specified_source(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
        second_news_source: NewsSource,
        fetch_history_success: SourceFetchHistory,
        other_source_history: SourceFetchHistory,
    ):
        """Should only count history for the specified source."""
        repo = SourceFetchHistoryRepository(db_session)

        count1 = await repo.count_by_source(news_source.id)
        count2 = await repo.count_by_source(second_news_source.id)

        assert count1 == 1
        assert count2 == 1


# =============================================================================
# Test get_latest_by_source
# =============================================================================


class TestGetLatestBySource:
    """Tests for get_latest_by_source method."""

    @pytest.mark.asyncio
    async def test_returns_none_when_no_history(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
    ):
        """Should return None when source has no fetch history."""
        repo = SourceFetchHistoryRepository(db_session)
        result = await repo.get_latest_by_source(news_source.id)
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_single_entry(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
        fetch_history_success: SourceFetchHistory,
    ):
        """Should return the only history entry."""
        repo = SourceFetchHistoryRepository(db_session)
        result = await repo.get_latest_by_source(news_source.id)
        assert result is not None
        assert result.id == fetch_history_success.id

    @pytest.mark.asyncio
    async def test_returns_most_recent_entry(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
        fetch_history_success: SourceFetchHistory,
        fetch_history_error: SourceFetchHistory,
        fetch_history_recent: SourceFetchHistory,
    ):
        """Should return the most recent fetch history entry."""
        repo = SourceFetchHistoryRepository(db_session)
        result = await repo.get_latest_by_source(news_source.id)
        assert result is not None
        assert result.id == fetch_history_recent.id

    @pytest.mark.asyncio
    async def test_returns_latest_for_correct_source(
        self,
        db_session: AsyncSession,
        news_source: NewsSource,
        second_news_source: NewsSource,
        fetch_history_success: SourceFetchHistory,
        other_source_history: SourceFetchHistory,
    ):
        """Should return latest entry for the specified source only."""
        repo = SourceFetchHistoryRepository(db_session)

        result1 = await repo.get_latest_by_source(news_source.id)
        assert result1 is not None
        assert result1.id == fetch_history_success.id

        result2 = await repo.get_latest_by_source(second_news_source.id)
        assert result2 is not None
        assert result2.id == other_source_history.id
