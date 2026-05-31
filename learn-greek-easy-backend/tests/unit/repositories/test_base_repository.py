"""Unit tests for BaseRepository (generic CRUD).

BaseRepository is inherited by every concrete repository, so its generic CRUD
behavior is exercised here through a real concrete subclass (ChangelogRepository
over the ChangelogEntry model) against a real database session.

This module tests:
- create: from a dict and from a Pydantic model instance (fields persisted)
- create: Pydantic exclude_unset semantics (unset optional fields fall back to
  DB default / NULL rather than being forced)
- update: retains un-patched fields when given a partial dict
- update: from a Pydantic model only writes set fields (exclude_unset semantics)
- get_or_404: raises NotFoundException carrying the model name
- exists / filter_by: match semantics

Tests use real database fixtures to verify SQL queries work correctly, mirroring
the sibling repository tests in this directory.
"""

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import NotFoundException
from src.db.models import ChangelogEntry, ChangelogTag
from src.repositories.changelog import ChangelogRepository
from src.schemas.changelog import ChangelogEntryCreate, ChangelogEntryUpdate

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def single_entry(db_session: AsyncSession) -> ChangelogEntry:
    """Create a single persisted changelog entry for testing."""
    entry = ChangelogEntry(
        title_en="Original English Title",
        title_ru="Original Russian Title",
        content_en="Original English content",
        content_ru="Original Russian content",
        tag=ChangelogTag.NEW_FEATURE,
        version="v1.0.0",
    )
    db_session.add(entry)
    await db_session.flush()
    await db_session.refresh(entry)
    return entry


# =============================================================================
# Test create
# =============================================================================


class TestCreate:
    """Tests for create method (BaseRepository)."""

    @pytest.mark.asyncio
    async def test_create_from_dict_persists_fields(
        self,
        db_session: AsyncSession,
    ):
        """Should create a record from a dict and persist all fields."""
        repo = ChangelogRepository(db_session)

        result = await repo.create(
            {
                "title_en": "Dict English Title",
                "title_ru": "Dict Russian Title",
                "content_en": "Dict English content",
                "content_ru": "Dict Russian content",
                "tag": ChangelogTag.BUG_FIX,
                "version": "v2.0.0",
            }
        )

        # ID assigned by flush, fields persisted
        assert result.id is not None
        assert result.title_en == "Dict English Title"
        assert result.title_ru == "Dict Russian Title"
        assert result.content_en == "Dict English content"
        assert result.content_ru == "Dict Russian content"
        assert result.tag == ChangelogTag.BUG_FIX
        assert result.version == "v2.0.0"

        # Round-trips through the DB (proves it was flushed, not just constructed)
        fetched = await repo.get(result.id)
        assert fetched is not None
        assert fetched.title_en == "Dict English Title"

    @pytest.mark.asyncio
    async def test_create_from_model_instance_persists_fields(
        self,
        db_session: AsyncSession,
    ):
        """Should create a record from a Pydantic model and persist set fields."""
        repo = ChangelogRepository(db_session)

        schema = ChangelogEntryCreate(
            title_en="Schema English Title",
            title_ru="Schema Russian Title",
            content_en="Schema English content",
            content_ru="Schema Russian content",
            tag=ChangelogTag.ANNOUNCEMENT,
            version="v3.0.0",
        )

        result = await repo.create(schema)

        assert result.id is not None
        assert result.title_en == "Schema English Title"
        assert result.title_ru == "Schema Russian Title"
        assert result.content_en == "Schema English content"
        assert result.content_ru == "Schema Russian content"
        assert result.tag == ChangelogTag.ANNOUNCEMENT
        assert result.version == "v3.0.0"

        fetched = await repo.get(result.id)
        assert fetched is not None
        assert fetched.tag == ChangelogTag.ANNOUNCEMENT

    @pytest.mark.asyncio
    async def test_create_from_model_excludes_unset_fields(
        self,
        db_session: AsyncSession,
    ):
        """Should not pass unset optional fields to the model constructor.

        ``version`` is optional with a None default. When not provided to the
        schema, ``model_dump(exclude_unset=True)`` omits it entirely, so the
        column falls back to its DB-level default (NULL) rather than being
        explicitly forced.
        """
        repo = ChangelogRepository(db_session)

        schema = ChangelogEntryCreate(
            title_en="No Version English",
            title_ru="No Version Russian",
            content_en="Content EN",
            content_ru="Content RU",
            tag=ChangelogTag.BUG_FIX,
            # version intentionally omitted
        )

        result = await repo.create(schema)
        await db_session.refresh(result)

        assert result.version is None


# =============================================================================
# Test update
# =============================================================================


class TestUpdate:
    """Tests for update method (BaseRepository)."""

    @pytest.mark.asyncio
    async def test_update_from_dict_retains_unpatched_fields(
        self,
        db_session: AsyncSession,
        single_entry: ChangelogEntry,
    ):
        """Should only change patched fields, leaving the rest intact."""
        repo = ChangelogRepository(db_session)

        original_title_ru = single_entry.title_ru
        original_content_en = single_entry.content_en
        original_version = single_entry.version

        result = await repo.update(single_entry, {"title_en": "Patched English Title"})

        assert result.title_en == "Patched English Title"
        # Un-patched fields preserved
        assert result.title_ru == original_title_ru
        assert result.content_en == original_content_en
        assert result.version == original_version

    @pytest.mark.asyncio
    async def test_update_from_model_excludes_unset_fields(
        self,
        db_session: AsyncSession,
        single_entry: ChangelogEntry,
    ):
        """Should only write fields explicitly set on the Pydantic model.

        ChangelogEntryUpdate has all-optional fields defaulting to None.
        ``exclude_unset=True`` means an un-touched field (``version``) is NOT
        written, so its existing value survives — even though the field's
        declared default is None.
        """
        repo = ChangelogRepository(db_session)

        original_version = single_entry.version
        original_title_ru = single_entry.title_ru
        assert original_version is not None  # guard: fixture sets a version

        # Only set content_en; everything else (including version) left unset.
        schema = ChangelogEntryUpdate(content_en="Only content updated")

        result = await repo.update(single_entry, schema)

        assert result.content_en == "Only content updated"
        # version was unset -> excluded -> existing value retained (not nulled)
        assert result.version == original_version
        assert result.title_ru == original_title_ru

    @pytest.mark.asyncio
    async def test_update_explicit_none_is_written(
        self,
        db_session: AsyncSession,
        single_entry: ChangelogEntry,
    ):
        """Explicitly setting a field to None on the model should null it out.

        Distinguishes "unset" (excluded) from "set to None" (written). When
        ``version`` is passed explicitly as None, exclude_unset keeps it and the
        column is overwritten to NULL.
        """
        repo = ChangelogRepository(db_session)
        assert single_entry.version is not None

        schema = ChangelogEntryUpdate(version=None)

        result = await repo.update(single_entry, schema)

        assert result.version is None


# =============================================================================
# Test get_or_404
# =============================================================================


class TestGetOr404:
    """Tests for get_or_404 method (BaseRepository)."""

    @pytest.mark.asyncio
    async def test_returns_entry_when_exists(
        self,
        db_session: AsyncSession,
        single_entry: ChangelogEntry,
    ):
        """Should return the record when it exists."""
        repo = ChangelogRepository(db_session)

        result = await repo.get_or_404(single_entry.id)

        assert result.id == single_entry.id

    @pytest.mark.asyncio
    async def test_raises_not_found_with_model_name(
        self,
        db_session: AsyncSession,
    ):
        """Should raise NotFoundException carrying the model class name."""
        repo = ChangelogRepository(db_session)
        missing_id = uuid4()

        with pytest.raises(NotFoundException) as exc_info:
            await repo.get_or_404(missing_id)

        exc = exc_info.value
        # NotFoundException is a 404 HTTPException with the model name in the detail
        assert exc.status_code == 404
        assert exc.error_code == "NOT_FOUND"
        assert "ChangelogEntry" in exc.detail
        assert str(missing_id) in exc.detail


# =============================================================================
# Test exists
# =============================================================================


class TestExists:
    """Tests for exists method (BaseRepository)."""

    @pytest.mark.asyncio
    async def test_returns_true_when_match(
        self,
        db_session: AsyncSession,
        single_entry: ChangelogEntry,
    ):
        """Should return True when at least one record matches the filters."""
        repo = ChangelogRepository(db_session)

        assert await repo.exists(title_en=single_entry.title_en) is True

    @pytest.mark.asyncio
    async def test_returns_false_when_no_match(
        self,
        db_session: AsyncSession,
        single_entry: ChangelogEntry,
    ):
        """Should return False when no record matches the filters."""
        repo = ChangelogRepository(db_session)

        assert await repo.exists(title_en="Nonexistent Title") is False

    @pytest.mark.asyncio
    async def test_multiple_filters_combined_with_and(
        self,
        db_session: AsyncSession,
        single_entry: ChangelogEntry,
    ):
        """Multiple filters should be ANDed together."""
        repo = ChangelogRepository(db_session)

        # Both match -> True
        assert (
            await repo.exists(
                title_en=single_entry.title_en,
                tag=single_entry.tag,
            )
            is True
        )
        # One field mismatches -> False (AND semantics)
        assert (
            await repo.exists(
                title_en=single_entry.title_en,
                tag=ChangelogTag.BUG_FIX,
            )
            is False
        )


# =============================================================================
# Test filter_by
# =============================================================================


class TestFilterBy:
    """Tests for filter_by method (BaseRepository)."""

    @pytest.mark.asyncio
    async def test_returns_matching_records(
        self,
        db_session: AsyncSession,
    ):
        """Should return all records matching a single field filter."""
        repo = ChangelogRepository(db_session)

        for i in range(3):
            await repo.create(
                {
                    "title_en": f"Feature {i}",
                    "title_ru": f"Функция {i}",
                    "content_en": "EN",
                    "content_ru": "RU",
                    "tag": ChangelogTag.NEW_FEATURE,
                }
            )
        await repo.create(
            {
                "title_en": "A Fix",
                "title_ru": "Исправление",
                "content_en": "EN",
                "content_ru": "RU",
                "tag": ChangelogTag.BUG_FIX,
            }
        )

        new_features = await repo.filter_by(tag=ChangelogTag.NEW_FEATURE)

        assert len(new_features) == 3
        assert all(e.tag == ChangelogTag.NEW_FEATURE for e in new_features)

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_match(
        self,
        db_session: AsyncSession,
        single_entry: ChangelogEntry,
    ):
        """Should return an empty list when nothing matches."""
        repo = ChangelogRepository(db_session)

        result = await repo.filter_by(title_en="No Such Title")

        assert result == []

    @pytest.mark.asyncio
    async def test_multiple_filters_combined_with_and(
        self,
        db_session: AsyncSession,
        single_entry: ChangelogEntry,
    ):
        """Multiple filters should be ANDed together."""
        repo = ChangelogRepository(db_session)

        matched = await repo.filter_by(
            title_en=single_entry.title_en,
            tag=single_entry.tag,
        )
        assert len(matched) == 1
        assert matched[0].id == single_entry.id

        unmatched = await repo.filter_by(
            title_en=single_entry.title_en,
            tag=ChangelogTag.BUG_FIX,
        )
        assert unmatched == []
