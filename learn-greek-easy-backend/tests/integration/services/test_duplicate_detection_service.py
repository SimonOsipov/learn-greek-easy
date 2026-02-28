"""Integration tests for DuplicateDetectionService.

Tests cover:
- Exact lemma+POS match across decks
- Different POS same lemma is NOT a duplicate
- Accent-insensitive matching (PostgreSQL unaccent)
- exclude_deck_id skips target deck, finds other decks
- Inactive entries are excluded
- Oldest entry wins when multiple matches exist
- Empty database returns is_duplicate=False
"""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import PartOfSpeech, WordEntry
from src.services.duplicate_detection_service import DuplicateDetectionService
from tests.factories import DeckFactory

# ============================================================================
# Helpers
# ============================================================================


async def _create_word_entry(
    db_session: AsyncSession,
    deck_id,
    lemma: str,
    part_of_speech: PartOfSpeech = PartOfSpeech.NOUN,
    translation_en: str = "test translation",
    is_active: bool = True,
) -> WordEntry:
    """Create and persist a WordEntry, return the refreshed instance."""
    entry = WordEntry(
        deck_id=deck_id,
        lemma=lemma,
        part_of_speech=part_of_speech,
        translation_en=translation_en,
        is_active=is_active,
    )
    db_session.add(entry)
    await db_session.flush()
    await db_session.refresh(entry)
    return entry


# ============================================================================
# DuplicateDetectionService Integration Tests
# ============================================================================


@pytest.mark.asyncio
class TestDuplicateDetectionExactMatch:
    """Tests for exact lemma+POS matching."""

    async def test_exact_match_same_lemma_pos(self, db_session: AsyncSession):
        """Same lemma and POS in any deck → is_duplicate=True."""
        deck = await DeckFactory.create(session=db_session)
        await _create_word_entry(db_session, deck.id, "σπίτι", PartOfSpeech.NOUN)

        service = DuplicateDetectionService(db_session)
        result = await service.check("σπίτι", PartOfSpeech.NOUN)

        assert result.is_duplicate is True
        assert result.existing_entry is not None
        assert result.existing_entry.lemma == "σπίτι"
        assert result.matched_deck_id == deck.id
        assert result.matched_deck_name == deck.name_en

    async def test_no_match_different_pos(self, db_session: AsyncSession):
        """Same lemma but different POS is NOT a duplicate."""
        deck = await DeckFactory.create(session=db_session)
        await _create_word_entry(db_session, deck.id, "σπίτι", PartOfSpeech.NOUN)

        service = DuplicateDetectionService(db_session)
        result = await service.check("σπίτι", PartOfSpeech.VERB)

        assert result.is_duplicate is False

    async def test_no_entries_at_all(self, db_session: AsyncSession):
        """Empty database returns is_duplicate=False."""
        service = DuplicateDetectionService(db_session)
        result = await service.check("σπίτι", PartOfSpeech.NOUN)

        assert result.is_duplicate is False


@pytest.mark.asyncio
class TestDuplicateDetectionAccentInsensitive:
    """Tests for accent-insensitive matching via PostgreSQL unaccent."""

    async def test_accent_insensitive_match(self, db_session: AsyncSession):
        """Insert accented σπίτι, search unaccented σπιτι → is_duplicate=True."""
        deck = await DeckFactory.create(session=db_session)
        await _create_word_entry(db_session, deck.id, "σπίτι", PartOfSpeech.NOUN)

        service = DuplicateDetectionService(db_session)
        result = await service.check("σπιτι", PartOfSpeech.NOUN)

        assert result.is_duplicate is True

    async def test_accent_insensitive_reverse(self, db_session: AsyncSession):
        """Insert unaccented σπιτι, search accented σπίτι → is_duplicate=True."""
        deck = await DeckFactory.create(session=db_session)
        await _create_word_entry(db_session, deck.id, "σπιτι", PartOfSpeech.NOUN)

        service = DuplicateDetectionService(db_session)
        result = await service.check("σπίτι", PartOfSpeech.NOUN)

        assert result.is_duplicate is True


@pytest.mark.asyncio
class TestDuplicateDetectionExcludeDeck:
    """Tests for exclude_deck_id parameter."""

    async def test_exclude_deck_id_skips_target(self, db_session: AsyncSession):
        """Entry in deck A, exclude A → is_duplicate=False."""
        deck_a = await DeckFactory.create(session=db_session)
        await _create_word_entry(db_session, deck_a.id, "σπίτι", PartOfSpeech.NOUN)

        service = DuplicateDetectionService(db_session)
        result = await service.check("σπίτι", PartOfSpeech.NOUN, exclude_deck_id=deck_a.id)

        assert result.is_duplicate is False

    async def test_exclude_deck_id_finds_other_decks(self, db_session: AsyncSession):
        """Entries in deck A and B, exclude A → finds entry in B → is_duplicate=True."""
        deck_a = await DeckFactory.create(session=db_session)
        deck_b = await DeckFactory.create(session=db_session)
        await _create_word_entry(db_session, deck_a.id, "σπίτι", PartOfSpeech.NOUN)
        await _create_word_entry(db_session, deck_b.id, "σπίτι", PartOfSpeech.NOUN)

        service = DuplicateDetectionService(db_session)
        result = await service.check("σπίτι", PartOfSpeech.NOUN, exclude_deck_id=deck_a.id)

        assert result.is_duplicate is True
        assert result.matched_deck_id == deck_b.id


@pytest.mark.asyncio
class TestDuplicateDetectionInactiveEntries:
    """Tests for inactive entry filtering."""

    async def test_inactive_entry_excluded(self, db_session: AsyncSession):
        """is_active=False entry is not treated as a duplicate."""
        deck = await DeckFactory.create(session=db_session)
        await _create_word_entry(db_session, deck.id, "σπίτι", PartOfSpeech.NOUN, is_active=False)

        service = DuplicateDetectionService(db_session)
        result = await service.check("σπίτι", PartOfSpeech.NOUN)

        assert result.is_duplicate is False


@pytest.mark.asyncio
class TestDuplicateDetectionOldestWins:
    """Tests for ordering: oldest entry is returned when multiple matches exist."""

    async def test_oldest_match_wins(self, db_session: AsyncSession):
        """Two entries in different decks — the one with older created_at is returned."""
        deck_a = await DeckFactory.create(session=db_session)
        deck_b = await DeckFactory.create(session=db_session)

        await _create_word_entry(db_session, deck_a.id, "σπίτι", PartOfSpeech.NOUN)
        entry_b = await _create_word_entry(db_session, deck_b.id, "σπίτι", PartOfSpeech.NOUN)

        # Make entry_b older by setting created_at to 1 day ago
        entry_b.created_at = datetime.now(UTC) - timedelta(days=1)
        await db_session.flush()

        service = DuplicateDetectionService(db_session)
        result = await service.check("σπίτι", PartOfSpeech.NOUN)

        assert result.is_duplicate is True
        assert result.existing_entry is not None
        assert result.existing_entry.id == entry_b.id
        assert result.matched_deck_id == deck_b.id
