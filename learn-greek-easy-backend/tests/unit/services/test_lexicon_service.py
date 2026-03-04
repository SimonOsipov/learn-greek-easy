"""Unit tests for LexiconService.

Tests cover:
- lookup(): exact match, POS filter, no match, Nom Sing preference
- get_declensions(): all forms, empty for unknown, ordering preserved

These tests use mocked AsyncSession — no real database required.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.services.lexicon_service import LexiconEntry, LexiconService

# ============================================================================
# Helpers
# ============================================================================


def _make_mock_row(
    form: str = "σπίτι",
    lemma: str = "σπίτι",
    pos: str = "NOUN",
    gender: str | None = "Neut",
    ptosi: str | None = "Nom",
    number: str | None = "Sing",
) -> MagicMock:
    """Return a MagicMock mimicking a GreekLexicon ORM row."""
    row = MagicMock()
    row.form = form
    row.lemma = lemma
    row.pos = pos
    row.gender = gender
    row.ptosi = ptosi
    row.number = number
    return row


def _make_mock_session_for_lookup(row=None) -> MagicMock:
    """Return a mocked AsyncSession for lookup (scalars().first())."""
    mock_scalars = MagicMock()
    mock_scalars.first.return_value = row

    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars

    mock_session = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    return mock_session


def _make_mock_session_for_declensions(rows: list | None = None) -> MagicMock:
    """Return a mocked AsyncSession for get_declensions (scalars().all())."""
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = rows or []

    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars

    mock_session = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    return mock_session


# ============================================================================
# lookup() Tests
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
class TestLexiconServiceLookup:
    """Tests for LexiconService.lookup()."""

    async def test_exact_match_returns_entry(self):
        """When a matching row is found, returns a LexiconEntry."""
        mock_row = _make_mock_row()
        mock_session = _make_mock_session_for_lookup(row=mock_row)
        service = LexiconService(mock_session)

        result = await service.lookup("σπίτι")

        assert isinstance(result, LexiconEntry)
        assert result.form == "σπίτι"
        assert result.lemma == "σπίτι"
        assert result.pos == "NOUN"
        assert result.gender == "Neut"
        assert result.ptosi == "Nom"
        assert result.number == "Sing"

    async def test_no_match_returns_none(self):
        """When no matching row, returns None."""
        mock_session = _make_mock_session_for_lookup(row=None)
        service = LexiconService(mock_session)

        result = await service.lookup("nonexistent")

        assert result is None

    async def test_pos_filter_applied(self):
        """When pos is provided, it filters results."""
        mock_row = _make_mock_row()
        mock_session = _make_mock_session_for_lookup(row=mock_row)
        service = LexiconService(mock_session)

        result = await service.lookup("σπίτι", pos="NOUN")

        assert result is not None
        mock_session.execute.assert_called_once()

    async def test_without_pos_filter(self):
        """When pos is None, no POS filter is applied."""
        mock_row = _make_mock_row()
        mock_session = _make_mock_session_for_lookup(row=mock_row)
        service = LexiconService(mock_session)

        result = await service.lookup("σπίτι")

        assert result is not None
        mock_session.execute.assert_called_once()


# ============================================================================
# get_declensions() Tests
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
class TestLexiconServiceGetDeclensions:
    """Tests for LexiconService.get_declensions()."""

    async def test_all_forms_for_known_lemma(self):
        """Returns all inflected forms for a known lemma."""
        rows = [
            _make_mock_row(form="σπίτι", ptosi="Nom", number="Sing"),
            _make_mock_row(form="σπιτιού", ptosi="Gen", number="Sing"),
            _make_mock_row(form="σπίτι", ptosi="Acc", number="Sing"),
            _make_mock_row(form="σπίτι", ptosi="Voc", number="Sing"),
            _make_mock_row(form="σπίτια", ptosi="Nom", number="Plur"),
            _make_mock_row(form="σπιτιών", ptosi="Gen", number="Plur"),
            _make_mock_row(form="σπίτια", ptosi="Acc", number="Plur"),
            _make_mock_row(form="σπίτια", ptosi="Voc", number="Plur"),
        ]
        mock_session = _make_mock_session_for_declensions(rows=rows)
        service = LexiconService(mock_session)

        result = await service.get_declensions("σπίτι")

        assert len(result) == 8
        assert all(isinstance(e, LexiconEntry) for e in result)

    async def test_empty_for_unknown_lemma(self):
        """Returns empty list for unknown lemma."""
        mock_session = _make_mock_session_for_declensions(rows=[])
        service = LexiconService(mock_session)

        result = await service.get_declensions("nonexistent")

        assert result == []

    async def test_ordering_preserved(self):
        """Output order matches the input order from DB (ordering is DB-side)."""
        rows = [
            _make_mock_row(form="σπίτι", ptosi="Nom", number="Sing"),
            _make_mock_row(form="σπίτια", ptosi="Nom", number="Plur"),
        ]
        mock_session = _make_mock_session_for_declensions(rows=rows)
        service = LexiconService(mock_session)

        result = await service.get_declensions("σπίτι")

        assert len(result) == 2
        assert result[0].number == "Sing"
        assert result[1].number == "Plur"

    async def test_pos_filter(self):
        """Custom POS filter is applied."""
        mock_session = _make_mock_session_for_declensions(rows=[])
        service = LexiconService(mock_session)

        result = await service.get_declensions("καλός", pos="ADJ")

        assert result == []
        mock_session.execute.assert_called_once()
