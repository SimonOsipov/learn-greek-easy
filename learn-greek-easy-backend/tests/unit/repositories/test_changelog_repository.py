"""Unit tests for ChangelogRepository.

This module tests:
- get_list: Get changelog entries with pagination ordered by date
- count_all: Count total changelog entries
- Inherited CRUD operations from BaseRepository
    - get(id): Returns None if not found
    - create(dict): Creates entry
    - update(db_obj, dict): Partial update
    - delete(db_obj): Deletes entry

Tests use real database fixtures to verify SQL queries work correctly.
"""

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import ChangelogEntry, ChangelogTag
from src.repositories.changelog import ChangelogRepository

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def changelog_entries(db_session: AsyncSession) -> list[ChangelogEntry]:
    """Create multiple changelog entries for testing."""
    entries = []

    for i in range(5):
        entry = ChangelogEntry(
            title_en=f"English Title {i + 1}",
            title_el=f"Greek Title {i + 1}",
            title_ru=f"Russian Title {i + 1}",
            content_en=f"English content for entry {i + 1}",
            content_el=f"Greek content for entry {i + 1}",
            content_ru=f"Russian content for entry {i + 1}",
            tag=ChangelogTag.NEW_FEATURE if i % 3 == 0 else ChangelogTag.BUG_FIX,
        )
        db_session.add(entry)
        entries.append(entry)

    await db_session.flush()
    for entry in entries:
        await db_session.refresh(entry)

    return entries


@pytest.fixture
async def single_changelog_entry(db_session: AsyncSession) -> ChangelogEntry:
    """Create a single changelog entry for testing."""
    entry = ChangelogEntry(
        title_en="Test English Title",
        title_el="Test Greek Title",
        title_ru="Test Russian Title",
        content_en="Test English content",
        content_el="Test Greek content",
        content_ru="Test Russian content",
        tag=ChangelogTag.ANNOUNCEMENT,
    )
    db_session.add(entry)
    await db_session.flush()
    await db_session.refresh(entry)
    return entry


# =============================================================================
# Test get_list
# =============================================================================


class TestGetList:
    """Tests for get_list method."""

    @pytest.mark.asyncio
    async def test_returns_entries_ordered_by_created_at_desc(
        self,
        db_session: AsyncSession,
        changelog_entries: list[ChangelogEntry],
    ):
        """Should return changelog entries ordered by created_at DESC."""
        repo = ChangelogRepository(db_session)

        result = await repo.get_list()

        assert len(result) == len(changelog_entries)
        # Verify descending order by created_at
        for i in range(len(result) - 1):
            assert result[i].created_at >= result[i + 1].created_at

    @pytest.mark.asyncio
    async def test_respects_skip_parameter(
        self,
        db_session: AsyncSession,
        changelog_entries: list[ChangelogEntry],
    ):
        """Should skip entries correctly."""
        repo = ChangelogRepository(db_session)

        result = await repo.get_list(skip=2)

        assert len(result) == len(changelog_entries) - 2

    @pytest.mark.asyncio
    async def test_respects_limit_parameter(
        self,
        db_session: AsyncSession,
        changelog_entries: list[ChangelogEntry],
    ):
        """Should limit results correctly."""
        repo = ChangelogRepository(db_session)

        result = await repo.get_list(limit=2)

        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_skip_and_limit_combined(
        self,
        db_session: AsyncSession,
        changelog_entries: list[ChangelogEntry],
    ):
        """Should handle skip and limit together for pagination."""
        repo = ChangelogRepository(db_session)

        result = await repo.get_list(skip=1, limit=2)

        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_no_entries(
        self,
        db_session: AsyncSession,
    ):
        """Should return empty list when no changelog entries exist."""
        repo = ChangelogRepository(db_session)

        result = await repo.get_list()

        assert result == []


# =============================================================================
# Test count_all
# =============================================================================


class TestCountAll:
    """Tests for count_all method."""

    @pytest.mark.asyncio
    async def test_counts_all_entries(
        self,
        db_session: AsyncSession,
        changelog_entries: list[ChangelogEntry],
    ):
        """Should return correct count of all changelog entries."""
        repo = ChangelogRepository(db_session)

        result = await repo.count_all()

        assert result == len(changelog_entries)

    @pytest.mark.asyncio
    async def test_returns_zero_when_empty(
        self,
        db_session: AsyncSession,
    ):
        """Should return 0 when no changelog entries exist."""
        repo = ChangelogRepository(db_session)

        result = await repo.count_all()

        assert result == 0


# =============================================================================
# Test get (inherited from BaseRepository)
# =============================================================================


class TestGet:
    """Tests for get method (inherited from BaseRepository)."""

    @pytest.mark.asyncio
    async def test_returns_entry_when_exists(
        self,
        db_session: AsyncSession,
        single_changelog_entry: ChangelogEntry,
    ):
        """Should return changelog entry when it exists."""
        repo = ChangelogRepository(db_session)

        result = await repo.get(single_changelog_entry.id)

        assert result is not None
        assert result.id == single_changelog_entry.id
        assert result.title_en == single_changelog_entry.title_en

    @pytest.mark.asyncio
    async def test_returns_none_when_not_exists(
        self,
        db_session: AsyncSession,
    ):
        """Should return None when changelog entry doesn't exist."""
        repo = ChangelogRepository(db_session)

        result = await repo.get(uuid4())

        assert result is None


# =============================================================================
# Test create (inherited from BaseRepository)
# =============================================================================


class TestCreate:
    """Tests for create method (inherited from BaseRepository)."""

    @pytest.mark.asyncio
    async def test_creates_changelog_entry(
        self,
        db_session: AsyncSession,
    ):
        """Should create a changelog entry successfully."""
        repo = ChangelogRepository(db_session)

        entry_data = {
            "title_en": "New English Title",
            "title_el": "New Greek Title",
            "title_ru": "New Russian Title",
            "content_en": "New English content",
            "content_el": "New Greek content",
            "content_ru": "New Russian content",
            "tag": ChangelogTag.NEW_FEATURE,
        }

        result = await repo.create(entry_data)

        assert result.id is not None
        assert result.title_en == "New English Title"
        assert result.title_el == "New Greek Title"
        assert result.title_ru == "New Russian Title"
        assert result.content_en == "New English content"
        assert result.tag == ChangelogTag.NEW_FEATURE
        assert result.created_at is not None

    @pytest.mark.asyncio
    async def test_creates_with_all_tags(
        self,
        db_session: AsyncSession,
    ):
        """Should create entries with all supported tag types."""
        repo = ChangelogRepository(db_session)

        for tag in ChangelogTag:
            entry_data = {
                "title_en": f"Title for {tag.value}",
                "title_el": f"Greek {tag.value}",
                "title_ru": f"Russian {tag.value}",
                "content_en": f"Content for {tag.value}",
                "content_el": f"Greek content {tag.value}",
                "content_ru": f"Russian content {tag.value}",
                "tag": tag,
            }

            result = await repo.create(entry_data)

            assert result.tag == tag


# =============================================================================
# Test update (inherited from BaseRepository)
# =============================================================================


class TestUpdate:
    """Tests for update method (inherited from BaseRepository)."""

    @pytest.mark.asyncio
    async def test_updates_changelog_entry(
        self,
        db_session: AsyncSession,
        single_changelog_entry: ChangelogEntry,
    ):
        """Should update changelog entry fields."""
        repo = ChangelogRepository(db_session)

        update_data = {
            "title_en": "Updated English Title",
        }

        result = await repo.update(single_changelog_entry, update_data)

        assert result.title_en == "Updated English Title"
        # Other fields should remain unchanged
        assert result.title_el == single_changelog_entry.title_el
        assert result.title_ru == single_changelog_entry.title_ru

    @pytest.mark.asyncio
    async def test_partial_update_preserves_other_fields(
        self,
        db_session: AsyncSession,
        single_changelog_entry: ChangelogEntry,
    ):
        """Should preserve unchanged fields during partial update."""
        repo = ChangelogRepository(db_session)

        original_content_el = single_changelog_entry.content_el
        original_content_ru = single_changelog_entry.content_ru

        update_data = {"content_en": "Only English content updated"}

        result = await repo.update(single_changelog_entry, update_data)

        assert result.content_en == "Only English content updated"
        assert result.content_el == original_content_el
        assert result.content_ru == original_content_ru

    @pytest.mark.asyncio
    async def test_updates_tag(
        self,
        db_session: AsyncSession,
        single_changelog_entry: ChangelogEntry,
    ):
        """Should update tag field."""
        repo = ChangelogRepository(db_session)

        update_data = {"tag": ChangelogTag.BUG_FIX}

        result = await repo.update(single_changelog_entry, update_data)

        assert result.tag == ChangelogTag.BUG_FIX


# =============================================================================
# Test delete (inherited from BaseRepository)
# =============================================================================


class TestDelete:
    """Tests for delete method (inherited from BaseRepository)."""

    @pytest.mark.asyncio
    async def test_deletes_changelog_entry(
        self,
        db_session: AsyncSession,
        single_changelog_entry: ChangelogEntry,
    ):
        """Should delete changelog entry successfully."""
        repo = ChangelogRepository(db_session)
        entry_id = single_changelog_entry.id

        # Delete returns None, not bool
        await repo.delete(single_changelog_entry)
        await db_session.flush()

        # Verify it's deleted
        result = await repo.get(entry_id)
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_removes_from_list(
        self,
        db_session: AsyncSession,
        changelog_entries: list[ChangelogEntry],
    ):
        """Should remove entry from list after deletion."""
        repo = ChangelogRepository(db_session)

        # Get initial count
        initial_count = await repo.count_all()

        # Delete one entry
        await repo.delete(changelog_entries[0])
        await db_session.flush()

        # Count should decrease by 1
        new_count = await repo.count_all()
        assert new_count == initial_count - 1
