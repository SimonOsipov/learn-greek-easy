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


# ============================================================================
# lookup() gender filter Tests
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
class TestLexiconServiceLookupGender:
    """Tests for LexiconService.lookup() with gender parameter."""

    async def test_lookup_with_gender_masc_returns_entry(self):
        """When gender='Masc' is provided, returns a masculine LexiconEntry."""
        mock_row = _make_mock_row(
            form="σύζυγος",
            lemma="σύζυγος",
            pos="NOUN",
            gender="Masc",
            ptosi="Nom",
            number="Sing",
        )
        mock_session = _make_mock_session_for_lookup(row=mock_row)
        service = LexiconService(mock_session)

        result = await service.lookup("σύζυγος", pos="NOUN", gender="Masc")

        assert result is not None
        assert result.gender == "Masc"
        assert result.form == "σύζυγος"
        mock_session.execute.assert_called_once()

    async def test_lookup_with_gender_fem_returns_entry(self):
        """When gender='Fem' is provided, returns a feminine LexiconEntry."""
        mock_row = _make_mock_row(
            form="σύζυγος",
            lemma="σύζυγος",
            pos="NOUN",
            gender="Fem",
            ptosi="Nom",
            number="Sing",
        )
        mock_session = _make_mock_session_for_lookup(row=mock_row)
        service = LexiconService(mock_session)

        result = await service.lookup("σύζυγος", pos="NOUN", gender="Fem")

        assert result is not None
        assert result.gender == "Fem"
        mock_session.execute.assert_called_once()

    async def test_lookup_without_gender_backward_compatible(self):
        """Omitting gender parameter behaves the same as before."""
        mock_row = _make_mock_row(form="σύζυγος", gender="Masc")
        mock_session = _make_mock_session_for_lookup(row=mock_row)
        service = LexiconService(mock_session)

        result = await service.lookup("σύζυγος", pos="NOUN")

        assert result is not None
        mock_session.execute.assert_called_once()

    async def test_lookup_with_gender_no_match_returns_none(self):
        """When gender filter matches nothing, returns None."""
        mock_session = _make_mock_session_for_lookup(row=None)
        service = LexiconService(mock_session)

        result = await service.lookup("σύζυγος", pos="NOUN", gender="Neut")

        assert result is None


# ============================================================================
# get_declensions() gender filter Tests
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
class TestLexiconServiceGetDeclensionsGender:
    """Tests for LexiconService.get_declensions() with gender parameter."""

    async def test_gender_filter_returns_single_gender_rows(self):
        """When gender='Masc', only masculine rows are returned."""
        masc_rows = [
            _make_mock_row(
                form="σύζυγος", lemma="σύζυγος", gender="Masc", ptosi="Nom", number="Sing"
            ),
            _make_mock_row(
                form="συζύγου", lemma="σύζυγος", gender="Masc", ptosi="Gen", number="Sing"
            ),
            _make_mock_row(
                form="σύζυγο", lemma="σύζυγος", gender="Masc", ptosi="Acc", number="Sing"
            ),
            _make_mock_row(
                form="σύζυγε", lemma="σύζυγος", gender="Masc", ptosi="Voc", number="Sing"
            ),
            _make_mock_row(
                form="σύζυγοι", lemma="σύζυγος", gender="Masc", ptosi="Nom", number="Plur"
            ),
            _make_mock_row(
                form="συζύγων", lemma="σύζυγος", gender="Masc", ptosi="Gen", number="Plur"
            ),
            _make_mock_row(
                form="συζύγους", lemma="σύζυγος", gender="Masc", ptosi="Acc", number="Plur"
            ),
            _make_mock_row(
                form="σύζυγοι", lemma="σύζυγος", gender="Masc", ptosi="Voc", number="Plur"
            ),
        ]
        mock_session = _make_mock_session_for_declensions(rows=masc_rows)
        service = LexiconService(mock_session)

        result = await service.get_declensions("σύζυγος", pos="NOUN", gender="Masc")

        assert len(result) == 8
        assert all(e.gender == "Masc" for e in result)
        mock_session.execute.assert_called_once()

    async def test_get_declensions_without_gender_backward_compatible(self):
        """Omitting gender parameter returns all rows as before."""
        rows = [
            _make_mock_row(form="σπίτι", ptosi="Nom", number="Sing"),
            _make_mock_row(form="σπίτια", ptosi="Nom", number="Plur"),
        ]
        mock_session = _make_mock_session_for_declensions(rows=rows)
        service = LexiconService(mock_session)

        result = await service.get_declensions("σπίτι")

        assert len(result) == 2
        mock_session.execute.assert_called_once()


# ============================================================================
# lookup_all_genders() Tests
# ============================================================================


def _make_mock_session_for_all_genders(rows: list | None = None) -> MagicMock:
    """Return a mocked AsyncSession for lookup_all_genders (scalars().all())."""
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = rows or []

    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars

    mock_session = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    return mock_session


@pytest.mark.unit
@pytest.mark.asyncio
class TestLexiconServiceLookupAllGenders:
    """Tests for LexiconService.lookup_all_genders()."""

    async def test_common_gender_noun_returns_two_entries(self):
        """For a common-gender noun (Masc + Fem), returns 2 entries."""
        rows = [
            _make_mock_row(
                form="σύζυγος", lemma="σύζυγος", gender="Fem", ptosi="Nom", number="Sing"
            ),
            _make_mock_row(
                form="σύζυγος", lemma="σύζυγος", gender="Masc", ptosi="Nom", number="Sing"
            ),
        ]
        mock_session = _make_mock_session_for_all_genders(rows=rows)
        service = LexiconService(mock_session)

        result = await service.lookup_all_genders("σύζυγος", pos="NOUN")

        assert len(result) == 2
        assert all(isinstance(e, LexiconEntry) for e in result)
        genders = {e.gender for e in result}
        assert genders == {"Masc", "Fem"}
        mock_session.execute.assert_called_once()

    async def test_single_gender_noun_returns_one_entry(self):
        """For a single-gender noun, returns exactly 1 entry."""
        rows = [
            _make_mock_row(form="γάτα", lemma="γάτα", gender="Fem", ptosi="Nom", number="Sing"),
        ]
        mock_session = _make_mock_session_for_all_genders(rows=rows)
        service = LexiconService(mock_session)

        result = await service.lookup_all_genders("γάτα", pos="NOUN")

        assert len(result) == 1
        assert result[0].gender == "Fem"

    async def test_nonexistent_form_returns_empty_list(self):
        """When no rows match, returns empty list."""
        mock_session = _make_mock_session_for_all_genders(rows=[])
        service = LexiconService(mock_session)

        result = await service.lookup_all_genders("nonexistent")

        assert result == []

    async def test_without_pos_filter_returns_entries(self):
        """When pos is None, no POS filter is applied."""
        rows = [
            _make_mock_row(form="σύζυγος", gender="Masc", ptosi="Nom", number="Sing"),
        ]
        mock_session = _make_mock_session_for_all_genders(rows=rows)
        service = LexiconService(mock_session)

        result = await service.lookup_all_genders("σύζυγος")

        assert len(result) == 1
        mock_session.execute.assert_called_once()

    async def test_with_pos_filter_returns_entries(self):
        """When pos is provided, the filter is included in the query."""
        rows = [
            _make_mock_row(form="σύζυγος", gender="Fem", ptosi="Nom", number="Sing"),
            _make_mock_row(form="σύζυγος", gender="Masc", ptosi="Nom", number="Sing"),
        ]
        mock_session = _make_mock_session_for_all_genders(rows=rows)
        service = LexiconService(mock_session)

        result = await service.lookup_all_genders("σύζυγος", pos="NOUN")

        assert len(result) == 2
        mock_session.execute.assert_called_once()

    async def test_entry_fields_mapped_correctly(self):
        """All LexiconEntry fields are populated from the row."""
        rows = [
            _make_mock_row(
                form="σύζυγος",
                lemma="σύζυγος",
                pos="NOUN",
                gender="Masc",
                ptosi="Nom",
                number="Sing",
            )
        ]
        mock_session = _make_mock_session_for_all_genders(rows=rows)
        service = LexiconService(mock_session)

        result = await service.lookup_all_genders("σύζυγος")

        assert len(result) == 1
        entry = result[0]
        assert entry.form == "σύζυγος"
        assert entry.lemma == "σύζυγος"
        assert entry.pos == "NOUN"
        assert entry.gender == "Masc"
        assert entry.ptosi == "Nom"
        assert entry.number == "Sing"
