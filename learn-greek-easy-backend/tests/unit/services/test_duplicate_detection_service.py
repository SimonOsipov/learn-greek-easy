"""Unit tests for DuplicateDetectionService.

Tests cover:
- No match returns is_duplicate=False
- Match returns is_duplicate=True with full WordEntrySnapshot
- exclude_deck_id parameter is accepted and code path works
- Missing exclude_deck_id (None) code path works

These tests use mocked AsyncSession — no real database required.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.db.models import PartOfSpeech
from src.schemas.nlp import DuplicateCheckResult, WordEntrySnapshot
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
    entry.deck_id = uuid.uuid4()
    return entry


def _make_mock_session(row=None) -> MagicMock:
    """Return a mocked AsyncSession whose execute().first() returns row."""
    mock_result = MagicMock()
    mock_result.first.return_value = row

    mock_session = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    return mock_session


# ============================================================================
# DuplicateDetectionService Unit Tests
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
class TestDuplicateDetectionServiceNoMatch:
    """Tests for the no-match (is_duplicate=False) code path."""

    async def test_no_match_returns_not_duplicate(self):
        """When execute().first() returns None, result is not a duplicate."""
        mock_session = _make_mock_session(row=None)
        service = DuplicateDetectionService(mock_session)

        result = await service.check("σπίτι", PartOfSpeech.NOUN)

        assert isinstance(result, DuplicateCheckResult)
        assert result.is_duplicate is False
        assert result.existing_entry is None
        assert result.matched_deck_id is None
        assert result.matched_deck_name is None


@pytest.mark.unit
@pytest.mark.asyncio
class TestDuplicateDetectionServiceMatch:
    """Tests for the match (is_duplicate=True) code path."""

    async def test_match_returns_duplicate_with_snapshot(self):
        """When a row is returned, result is duplicate with full snapshot."""
        mock_entry = _make_mock_entry(lemma="σπίτι", translation_en="house")
        deck_name = "Test Deck"
        mock_session = _make_mock_session(row=(mock_entry, deck_name))
        service = DuplicateDetectionService(mock_session)

        result = await service.check("σπίτι", PartOfSpeech.NOUN)

        assert result.is_duplicate is True
        assert result.matched_deck_name == deck_name
        assert result.matched_deck_id == mock_entry.deck_id

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


@pytest.mark.unit
@pytest.mark.asyncio
class TestDuplicateDetectionServiceExcludeDeckId:
    """Tests for the exclude_deck_id parameter code paths."""

    async def test_exclude_deck_id_passed_in_query(self):
        """Passing exclude_deck_id runs without error; no match → is_duplicate=False."""
        mock_session = _make_mock_session(row=None)
        service = DuplicateDetectionService(mock_session)
        some_uuid = uuid.uuid4()

        result = await service.check("σπίτι", PartOfSpeech.NOUN, exclude_deck_id=some_uuid)

        assert isinstance(result, DuplicateCheckResult)
        assert result.is_duplicate is False
        # Confirm execute was called (the where clause branch executed)
        mock_session.execute.assert_awaited_once()

    async def test_exclude_deck_id_not_passed(self):
        """Omitting exclude_deck_id (None default) runs without error."""
        mock_session = _make_mock_session(row=None)
        service = DuplicateDetectionService(mock_session)

        result = await service.check("σπίτι", PartOfSpeech.NOUN)

        assert isinstance(result, DuplicateCheckResult)
        assert result.is_duplicate is False
        mock_session.execute.assert_awaited_once()
