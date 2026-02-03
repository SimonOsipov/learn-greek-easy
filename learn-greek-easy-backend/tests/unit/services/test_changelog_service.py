"""Unit tests for ChangelogService.

This module tests:
- get_public_list: Localized content for en, ru with fallback
- get_admin_list: Returns all language fields
- get_by_id: Returns entry or raises NotFoundException
- create: Creates entry with all fields
- update: Partial update, raises NotFoundException
- delete: Deletes entry, raises NotFoundException

Tests use real database fixtures for service integration.
"""

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import NotFoundException
from src.db.models import ChangelogEntry, ChangelogTag
from src.schemas.changelog import ChangelogEntryCreate, ChangelogEntryUpdate
from src.services.changelog_service import ChangelogService

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def changelog_entries(db_session: AsyncSession) -> list[ChangelogEntry]:
    """Create multiple changelog entries with distinct content per language."""
    entries = []

    for i in range(5):
        entry = ChangelogEntry(
            title_en=f"English Title {i + 1}",
            title_ru=f"Русский Заголовок {i + 1}",
            content_en=f"English content for entry {i + 1}",
            content_ru=f"Русское содержание {i + 1}",
            tag=ChangelogTag.NEW_FEATURE if i % 2 == 0 else ChangelogTag.BUG_FIX,
        )
        db_session.add(entry)
        entries.append(entry)

    await db_session.commit()
    for entry in entries:
        await db_session.refresh(entry)

    return entries


@pytest.fixture
async def single_changelog_entry(db_session: AsyncSession) -> ChangelogEntry:
    """Create a single changelog entry with bilingual content."""
    entry = ChangelogEntry(
        title_en="Feature: Dark Mode",
        title_ru="Функция: Темный режим",
        content_en="We've added dark mode support to the app.",
        content_ru="Мы добавили поддержку темного режима в приложение.",
        tag=ChangelogTag.NEW_FEATURE,
    )
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)
    return entry


# =============================================================================
# Test get_public_list - Localization
# =============================================================================


class TestGetPublicListLocalization:
    """Tests for get_public_list method localization behavior."""

    @pytest.mark.asyncio
    async def test_returns_english_content(
        self,
        db_session: AsyncSession,
        single_changelog_entry: ChangelogEntry,
    ):
        """Should return English content when locale is 'en'."""
        service = ChangelogService(db_session)

        result = await service.get_public_list(page=1, page_size=10, locale="en")

        assert len(result.items) == 1
        assert result.items[0].title == "Feature: Dark Mode"
        assert result.items[0].content == "We've added dark mode support to the app."

    @pytest.mark.asyncio
    async def test_greek_locale_falls_back_to_english(
        self,
        db_session: AsyncSession,
        single_changelog_entry: ChangelogEntry,
    ):
        """Should fall back to English when Greek (el) locale is requested."""
        service = ChangelogService(db_session)

        result = await service.get_public_list(page=1, page_size=10, locale="el")

        assert len(result.items) == 1
        # Greek locale should now return English content as fallback
        assert result.items[0].title == "Feature: Dark Mode"
        assert "We've added dark mode" in result.items[0].content

    @pytest.mark.asyncio
    async def test_returns_russian_content(
        self,
        db_session: AsyncSession,
        single_changelog_entry: ChangelogEntry,
    ):
        """Should return Russian content when locale is 'ru'."""
        service = ChangelogService(db_session)

        result = await service.get_public_list(page=1, page_size=10, locale="ru")

        assert len(result.items) == 1
        assert result.items[0].title == "Функция: Темный режим"
        assert "Мы добавили" in result.items[0].content

    @pytest.mark.asyncio
    async def test_unknown_locale_falls_back_to_english(
        self,
        db_session: AsyncSession,
        single_changelog_entry: ChangelogEntry,
    ):
        """Should fall back to English for unsupported locale."""
        service = ChangelogService(db_session)

        result = await service.get_public_list(page=1, page_size=10, locale="fr")

        assert result.items[0].title == "Feature: Dark Mode"

    @pytest.mark.asyncio
    async def test_empty_locale_falls_back_to_english(
        self,
        db_session: AsyncSession,
        single_changelog_entry: ChangelogEntry,
    ):
        """Should fall back to English for empty locale."""
        service = ChangelogService(db_session)

        result = await service.get_public_list(page=1, page_size=10, locale="")

        assert result.items[0].title == "Feature: Dark Mode"

    @pytest.mark.asyncio
    async def test_default_locale_is_english(
        self,
        db_session: AsyncSession,
        single_changelog_entry: ChangelogEntry,
    ):
        """Should default to English when no locale specified."""
        service = ChangelogService(db_session)

        # Default locale is "en"
        result = await service.get_public_list(page=1, page_size=10)

        assert result.items[0].title == "Feature: Dark Mode"


# =============================================================================
# Test get_public_list - Pagination
# =============================================================================


class TestGetPublicListPagination:
    """Tests for get_public_list pagination behavior."""

    @pytest.mark.asyncio
    async def test_returns_correct_total(
        self,
        db_session: AsyncSession,
        changelog_entries: list[ChangelogEntry],
    ):
        """Should return correct total count."""
        service = ChangelogService(db_session)

        result = await service.get_public_list(page=1, page_size=10, locale="en")

        assert result.total == len(changelog_entries)

    @pytest.mark.asyncio
    async def test_respects_page_size(
        self,
        db_session: AsyncSession,
        changelog_entries: list[ChangelogEntry],
    ):
        """Should respect page_size parameter."""
        service = ChangelogService(db_session)

        result = await service.get_public_list(page=1, page_size=2, locale="en")

        assert len(result.items) == 2
        assert result.page_size == 2

    @pytest.mark.asyncio
    async def test_respects_page_number(
        self,
        db_session: AsyncSession,
        changelog_entries: list[ChangelogEntry],
    ):
        """Should respect page number for pagination."""
        service = ChangelogService(db_session)

        result = await service.get_public_list(page=2, page_size=2, locale="en")

        assert result.page == 2
        assert len(result.items) == 2

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_entries(
        self,
        db_session: AsyncSession,
    ):
        """Should return empty list when no entries exist."""
        service = ChangelogService(db_session)

        result = await service.get_public_list(page=1, page_size=10, locale="en")

        assert result.items == []
        assert result.total == 0


# =============================================================================
# Test get_admin_list
# =============================================================================


class TestGetAdminList:
    """Tests for get_admin_list method."""

    @pytest.mark.asyncio
    async def test_returns_all_language_fields(
        self,
        db_session: AsyncSession,
        single_changelog_entry: ChangelogEntry,
    ):
        """Should return all language fields for admin."""
        service = ChangelogService(db_session)

        result = await service.get_admin_list(page=1, page_size=10)

        assert len(result.items) == 1
        item = result.items[0]
        assert item.title_en == "Feature: Dark Mode"
        assert item.title_ru == "Функция: Темный режим"
        assert item.content_en is not None
        assert item.content_ru is not None

    @pytest.mark.asyncio
    async def test_returns_correct_total(
        self,
        db_session: AsyncSession,
        changelog_entries: list[ChangelogEntry],
    ):
        """Should return correct total for admin list."""
        service = ChangelogService(db_session)

        result = await service.get_admin_list(page=1, page_size=10)

        assert result.total == len(changelog_entries)

    @pytest.mark.asyncio
    async def test_respects_pagination(
        self,
        db_session: AsyncSession,
        changelog_entries: list[ChangelogEntry],
    ):
        """Should respect pagination parameters."""
        service = ChangelogService(db_session)

        result = await service.get_admin_list(page=1, page_size=2)

        assert len(result.items) == 2
        assert result.page == 1
        assert result.page_size == 2


# =============================================================================
# Test get_by_id
# =============================================================================


class TestGetById:
    """Tests for get_by_id method."""

    @pytest.mark.asyncio
    async def test_returns_entry_when_exists(
        self,
        db_session: AsyncSession,
        single_changelog_entry: ChangelogEntry,
    ):
        """Should return entry when it exists."""
        service = ChangelogService(db_session)

        result = await service.get_by_id(single_changelog_entry.id)

        assert result.id == single_changelog_entry.id
        assert result.title_en == single_changelog_entry.title_en

    @pytest.mark.asyncio
    async def test_raises_not_found_exception(
        self,
        db_session: AsyncSession,
    ):
        """Should raise NotFoundException for non-existent ID."""
        service = ChangelogService(db_session)

        with pytest.raises(NotFoundException) as exc_info:
            await service.get_by_id(uuid4())

        assert "not found" in str(exc_info.value.detail).lower()


# =============================================================================
# Test create
# =============================================================================


class TestCreate:
    """Tests for create method."""

    @pytest.mark.asyncio
    async def test_creates_entry_with_all_fields(
        self,
        db_session: AsyncSession,
    ):
        """Should create entry with all language fields."""
        service = ChangelogService(db_session)

        create_data = ChangelogEntryCreate(
            title_en="New Feature Title",
            title_ru="Новая Функция",
            content_en="New feature description in English.",
            content_ru="Описание новой функции.",
            tag=ChangelogTag.NEW_FEATURE,
        )

        result = await service.create(create_data)

        assert result.id is not None
        assert result.title_en == "New Feature Title"
        assert result.title_ru == "Новая Функция"
        assert result.tag == ChangelogTag.NEW_FEATURE

    @pytest.mark.asyncio
    async def test_creates_with_bug_fix_tag(
        self,
        db_session: AsyncSession,
    ):
        """Should create entry with bug_fix tag."""
        service = ChangelogService(db_session)

        create_data = ChangelogEntryCreate(
            title_en="Bug Fix",
            title_ru="Исправление ошибки",
            content_en="Fixed a critical bug.",
            content_ru="Исправлена критическая ошибка.",
            tag=ChangelogTag.BUG_FIX,
        )

        result = await service.create(create_data)

        assert result.tag == ChangelogTag.BUG_FIX

    @pytest.mark.asyncio
    async def test_creates_with_announcement_tag(
        self,
        db_session: AsyncSession,
    ):
        """Should create entry with announcement tag."""
        service = ChangelogService(db_session)

        create_data = ChangelogEntryCreate(
            title_en="Announcement",
            title_ru="Объявление",
            content_en="Important announcement.",
            content_ru="Важное объявление.",
            tag=ChangelogTag.ANNOUNCEMENT,
        )

        result = await service.create(create_data)

        assert result.tag == ChangelogTag.ANNOUNCEMENT


# =============================================================================
# Test update
# =============================================================================


class TestUpdate:
    """Tests for update method."""

    @pytest.mark.asyncio
    async def test_updates_single_field(
        self,
        db_session: AsyncSession,
        single_changelog_entry: ChangelogEntry,
    ):
        """Should update only the specified field."""
        service = ChangelogService(db_session)

        update_data = ChangelogEntryUpdate(title_en="Updated Title")

        result = await service.update(single_changelog_entry.id, update_data)

        assert result.title_en == "Updated Title"
        # Other fields should remain unchanged
        assert result.title_ru == single_changelog_entry.title_ru

    @pytest.mark.asyncio
    async def test_partial_update_preserves_other_fields(
        self,
        db_session: AsyncSession,
        single_changelog_entry: ChangelogEntry,
    ):
        """Should preserve unchanged fields during partial update."""
        service = ChangelogService(db_session)

        original_content_ru = single_changelog_entry.content_ru

        update_data = ChangelogEntryUpdate(content_en="Only English updated")

        result = await service.update(single_changelog_entry.id, update_data)

        assert result.content_en == "Only English updated"
        assert result.content_ru == original_content_ru

    @pytest.mark.asyncio
    async def test_updates_multiple_fields(
        self,
        db_session: AsyncSession,
        single_changelog_entry: ChangelogEntry,
    ):
        """Should update multiple fields at once."""
        service = ChangelogService(db_session)

        update_data = ChangelogEntryUpdate(
            title_en="New English Title",
            title_ru="Новый Русский Заголовок",
            tag=ChangelogTag.BUG_FIX,
        )

        result = await service.update(single_changelog_entry.id, update_data)

        assert result.title_en == "New English Title"
        assert result.title_ru == "Новый Русский Заголовок"
        assert result.tag == ChangelogTag.BUG_FIX

    @pytest.mark.asyncio
    async def test_raises_not_found_exception(
        self,
        db_session: AsyncSession,
    ):
        """Should raise NotFoundException for non-existent ID."""
        service = ChangelogService(db_session)

        update_data = ChangelogEntryUpdate(title_en="Update attempt")

        with pytest.raises(NotFoundException) as exc_info:
            await service.update(uuid4(), update_data)

        assert "not found" in str(exc_info.value.detail).lower()


# =============================================================================
# Test delete
# =============================================================================


class TestDelete:
    """Tests for delete method."""

    @pytest.mark.asyncio
    async def test_deletes_entry(
        self,
        db_session: AsyncSession,
        single_changelog_entry: ChangelogEntry,
    ):
        """Should delete entry successfully."""
        service = ChangelogService(db_session)
        entry_id = single_changelog_entry.id

        await service.delete(entry_id)

        # Verify it's deleted by checking get_by_id raises
        with pytest.raises(NotFoundException):
            await service.get_by_id(entry_id)

    @pytest.mark.asyncio
    async def test_raises_not_found_exception(
        self,
        db_session: AsyncSession,
    ):
        """Should raise NotFoundException for non-existent ID."""
        service = ChangelogService(db_session)

        with pytest.raises(NotFoundException) as exc_info:
            await service.delete(uuid4())

        assert "not found" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_reduces_total_count(
        self,
        db_session: AsyncSession,
        changelog_entries: list[ChangelogEntry],
    ):
        """Should reduce total count after deletion."""
        service = ChangelogService(db_session)

        # Get initial count
        initial_result = await service.get_admin_list(page=1, page_size=10)
        initial_count = initial_result.total

        # Delete one entry
        await service.delete(changelog_entries[0].id)

        # Check new count
        new_result = await service.get_admin_list(page=1, page_size=10)
        assert new_result.total == initial_count - 1
