"""Unit tests for DuplicateDetectionService.

Tests cover:
- No match (entry not found) returns is_duplicate=False
- Entry found but no decks → is_duplicate=False
- Match returns is_duplicate=True with full WordEntrySnapshot and matched_decks
- exclude_deck_id filters decks (entry found but only deck excluded → is_duplicate=False)
- Multiple decks returned in matched_decks

These tests use mocked AsyncSession — no real database required.
The service now performs TWO queries: first to find the WordEntry, second to find
all Decks that contain it (via DeckWordEntry junction).
"""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.db.models import PartOfSpeech
from src.schemas.nlp import DeckSummary, DuplicateCheckResult, WordEntrySnapshot
from src.services.duplicate_detection_service import DuplicateDetectionService

# ============================================================================
# Helpers
# ============================================================================


def _make_mock_entry(
    lemma: str = "σπίτι",
    translation_en: str = "house",
) -> MagicMock:
    """Return a MagicMock that mimics a WordEntry ORM object."""
    entry = MagicMock()
    entry.id = uuid.uuid4()
    entry.lemma = lemma
    entry.part_of_speech.value = PartOfSpeech.NOUN.value
    entry.translation_en = translation_en
    entry.translation_ru = None
    entry.pronunciation = None
    entry.grammar_data = None
    entry.examples = None
    return entry


def _make_mock_session(entry=None, deck_rows=None) -> MagicMock:
    """Return a mocked AsyncSession that handles the two-step query pattern.

    First execute() returns the entry result (scalar_one_or_none()).
    Second execute() returns the decks result (.all()).

    Args:
        entry: WordEntry mock to return from scalar_one_or_none(), or None.
        deck_rows: list of (deck_id, deck_name) tuples for .all(), or None for [].
    """
    if deck_rows is None:
        deck_rows = []

    entry_result = MagicMock()
    entry_result.scalar_one_or_none.return_value = entry

    decks_result = MagicMock()
    decks_result.all.return_value = deck_rows

    mock_session = MagicMock()
    mock_session.execute = AsyncMock(side_effect=[entry_result, decks_result])
    return mock_session


# ============================================================================
# DuplicateDetectionService Unit Tests
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
class TestDuplicateDetectionServiceNoMatch:
    """Tests for the no-match (is_duplicate=False) code path."""

    async def test_no_entry_found_returns_not_duplicate(self):
        """When entry query returns None, result is not a duplicate (single execute)."""
        mock_session = _make_mock_session(entry=None)
        service = DuplicateDetectionService(mock_session)

        result = await service.check("σπίτι", PartOfSpeech.NOUN)

        assert isinstance(result, DuplicateCheckResult)
        assert result.is_duplicate is False
        assert result.existing_entry is None
        assert result.matched_decks == []
        # Only first query runs when no entry found
        mock_session.execute.assert_awaited_once()

    async def test_entry_found_no_decks_returns_not_duplicate(self):
        """When entry exists but has no deck associations, result is not a duplicate."""
        mock_entry = _make_mock_entry(lemma="σπίτι", translation_en="house")
        mock_session = _make_mock_session(entry=mock_entry, deck_rows=[])
        service = DuplicateDetectionService(mock_session)

        result = await service.check("σπίτι", PartOfSpeech.NOUN)

        assert isinstance(result, DuplicateCheckResult)
        assert result.is_duplicate is False
        assert result.matched_decks == []


@pytest.mark.unit
@pytest.mark.asyncio
class TestDuplicateDetectionServiceMatch:
    """Tests for the match (is_duplicate=True) code path."""

    async def test_match_returns_duplicate_with_snapshot(self):
        """When entry + decks found, result is duplicate with full snapshot."""
        mock_entry = _make_mock_entry(lemma="σπίτι", translation_en="house")
        deck_id = uuid.uuid4()
        deck_name = "Test Deck"
        mock_session = _make_mock_session(entry=mock_entry, deck_rows=[(deck_id, deck_name)])
        service = DuplicateDetectionService(mock_session)

        result = await service.check("σπίτι", PartOfSpeech.NOUN)

        assert result.is_duplicate is True
        assert len(result.matched_decks) == 1
        assert result.matched_decks[0].deck_id == deck_id
        assert result.matched_decks[0].deck_name == deck_name
        assert isinstance(result.matched_decks[0], DeckSummary)

        assert result.existing_entry is not None
        assert isinstance(result.existing_entry, WordEntrySnapshot)
        assert result.existing_entry.id == mock_entry.id
        assert result.existing_entry.lemma == "σπίτι"
        assert result.existing_entry.part_of_speech == PartOfSpeech.NOUN.value
        assert result.existing_entry.translation_en == "house"
        assert result.existing_entry.translation_ru is None
        assert result.existing_entry.pronunciation is None
        assert result.existing_entry.grammar_data is None
        assert result.existing_entry.examples is None

    async def test_match_returns_multiple_decks(self):
        """When entry belongs to multiple decks, all are returned."""
        mock_entry = _make_mock_entry(lemma="σπίτι", translation_en="house")
        deck_id_1 = uuid.uuid4()
        deck_id_2 = uuid.uuid4()
        mock_session = _make_mock_session(
            entry=mock_entry,
            deck_rows=[(deck_id_1, "Deck A"), (deck_id_2, "Deck B")],
        )
        service = DuplicateDetectionService(mock_session)

        result = await service.check("σπίτι", PartOfSpeech.NOUN)

        assert result.is_duplicate is True
        assert len(result.matched_decks) == 2
        deck_ids = {d.deck_id for d in result.matched_decks}
        assert deck_id_1 in deck_ids
        assert deck_id_2 in deck_ids


@pytest.mark.unit
@pytest.mark.asyncio
class TestDuplicateDetectionServiceExcludeDeckId:
    """Tests for the exclude_deck_id parameter code paths."""

    async def test_exclude_deck_id_no_entry_found(self):
        """Passing exclude_deck_id with no entry found → is_duplicate=False."""
        mock_session = _make_mock_session(entry=None)
        service = DuplicateDetectionService(mock_session)
        some_uuid = uuid.uuid4()

        result = await service.check("σπίτι", PartOfSpeech.NOUN, exclude_deck_id=some_uuid)

        assert isinstance(result, DuplicateCheckResult)
        assert result.is_duplicate is False
        # Only first query runs when no entry found
        mock_session.execute.assert_awaited_once()

    async def test_exclude_deck_id_filters_out_all_decks(self):
        """When exclude_deck_id filters out the only deck, result is not a duplicate."""
        mock_entry = _make_mock_entry(lemma="σπίτι", translation_en="house")
        # The decks query returns empty because excluded deck was the only one
        mock_session = _make_mock_session(entry=mock_entry, deck_rows=[])
        service = DuplicateDetectionService(mock_session)
        some_uuid = uuid.uuid4()

        result = await service.check("σπίτι", PartOfSpeech.NOUN, exclude_deck_id=some_uuid)

        assert isinstance(result, DuplicateCheckResult)
        assert result.is_duplicate is False
        # Both queries run (entry found, then decks query)
        assert mock_session.execute.await_count == 2

    async def test_exclude_deck_id_not_passed(self):
        """Omitting exclude_deck_id (None default) runs without error."""
        mock_session = _make_mock_session(entry=None)
        service = DuplicateDetectionService(mock_session)

        result = await service.check("σπίτι", PartOfSpeech.NOUN)

        assert isinstance(result, DuplicateCheckResult)
        assert result.is_duplicate is False
        mock_session.execute.assert_awaited_once()
