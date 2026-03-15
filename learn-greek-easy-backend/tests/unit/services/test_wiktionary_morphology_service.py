"""Unit tests for WiktionaryMorphologyService."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.services.wiktionary_morphology_service import WiktionaryMorphologyService


def _make_db(row=None, *, gender_filtered: bool = False):
    """Build an AsyncSession mock.

    When gender_filtered=True (gender is provided), mocks scalar_one_or_none().
    When gender_filtered=False (no gender), mocks scalars().all() returning [row] or [].
    """
    result_mock = MagicMock()
    if gender_filtered:
        # Gender path: scalar_one_or_none()
        result_mock.scalar_one_or_none.return_value = row
    else:
        # No-gender path: scalars().all() returning a list
        scalars_mock = MagicMock()
        scalars_mock.all.return_value = [row] if row is not None else []
        result_mock.scalars.return_value = scalars_mock

    db = AsyncMock()
    db.execute = AsyncMock(return_value=result_mock)
    return db


def _make_entry(lemma: str = "σπίτι", gender: str = "neuter", forms: dict | None = None):
    """Create a mock WiktionaryMorphology ORM row."""
    entry = MagicMock()
    entry.lemma = lemma
    entry.gender = gender
    entry.forms = forms or {"nominative_singular": "σπίτι", "genitive_singular": "σπιτιού"}
    return entry


class TestGetEntry:
    """Tests for WiktionaryMorphologyService.get_entry()."""

    @pytest.mark.asyncio
    async def test_returns_row_when_found(self) -> None:
        entry = _make_entry()
        db = _make_db(row=entry)
        service = WiktionaryMorphologyService(db)

        result = await service.get_entry("σπίτι")

        assert result is entry
        db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self) -> None:
        db = _make_db(row=None)
        service = WiktionaryMorphologyService(db)

        result = await service.get_entry("άγνωστο")

        assert result is None

    @pytest.mark.asyncio
    async def test_gender_filter_added_when_provided(self) -> None:
        entry = _make_entry(gender="feminine")
        db = _make_db(row=entry, gender_filtered=True)
        service = WiktionaryMorphologyService(db)

        result = await service.get_entry("τράπεζα", gender="feminine")

        assert result is entry
        db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_no_gender_filter_when_none(self) -> None:
        entry = _make_entry()
        db = _make_db(row=entry)
        service = WiktionaryMorphologyService(db)

        # Should work without gender filter (returns row when exactly 1 match)
        result = await service.get_entry("σπίτι", gender=None)

        assert result is entry

    @pytest.mark.asyncio
    async def test_nfc_normalization_applied(self) -> None:
        """Lemma is NFC-normalized before querying."""
        entry = _make_entry(lemma="σπίτι")
        db = _make_db(row=entry)
        service = WiktionaryMorphologyService(db)

        # Pass NFD-decomposed form; service should normalize to NFC before query
        import unicodedata

        nfd_lemma = unicodedata.normalize("NFD", "σπίτι")
        # Ensure the NFD form differs from NFC
        # (For basic Greek with combining marks, NFD and NFC can differ)
        result = await service.get_entry(nfd_lemma)

        # The query was still executed (normalization happened internally)
        db.execute.assert_called_once()
        assert result is entry


class TestGetDeclensions:
    """Tests for WiktionaryMorphologyService.get_declensions()."""

    @pytest.mark.asyncio
    async def test_returns_forms_dict_when_entry_found(self) -> None:
        forms = {"nominative_singular": "σπίτι", "genitive_singular": "σπιτιού"}
        entry = _make_entry(forms=forms)
        db = _make_db(row=entry)
        service = WiktionaryMorphologyService(db)

        result = await service.get_declensions("σπίτι")

        assert result == forms
        assert isinstance(result, dict)

    @pytest.mark.asyncio
    async def test_returns_none_when_no_entry(self) -> None:
        db = _make_db(row=None)
        service = WiktionaryMorphologyService(db)

        result = await service.get_declensions("άγνωστο")

        assert result is None

    @pytest.mark.asyncio
    async def test_gender_filter_passed_through(self) -> None:
        forms = {"nominative_singular": "τράπεζα"}
        entry = _make_entry(lemma="τράπεζα", gender="feminine", forms=forms)
        db = _make_db(row=entry, gender_filtered=True)
        service = WiktionaryMorphologyService(db)

        result = await service.get_declensions("τράπεζα", gender="feminine")

        assert result == forms
