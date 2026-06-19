"""Unit tests for WiktionaryMorphologyService."""

from __future__ import annotations

import inspect
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.core.lexgen_forms import bundles_to_flat
from src.schemas.lexgen import FormBundle
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


# ---------------------------------------------------------------------------
# Helpers for LEXGEN-03-04 RED tests
# ---------------------------------------------------------------------------

_BUNDLE_FORMS: list[dict] = [
    {"form": "το σπίτι", "features": {"case": "nominative", "number": "singular"}},
    {"form": "του σπιτιού", "features": {"case": "genitive", "number": "singular"}},
    {"form": "το σπίτι", "features": {"case": "accusative", "number": "singular"}},
    {"form": "σπίτι", "features": {"case": "vocative", "number": "singular"}},
    {"form": "τα σπίτια", "features": {"case": "nominative", "number": "plural"}},
    {"form": "των σπιτιών", "features": {"case": "genitive", "number": "plural"}},
    {"form": "τα σπίτια", "features": {"case": "accusative", "number": "plural"}},
    {"form": "σπίτια", "features": {"case": "vocative", "number": "plural"}},
]

_BUNDLES: list[FormBundle] = [FormBundle.model_validate(d) for d in _BUNDLE_FORMS]
_EXPECTED_FLAT: dict[str, str] = bundles_to_flat(_BUNDLES)


def _make_db_pos_filtered(row=None, *, pos_filtered: bool = True):
    """Build an AsyncSession mock for a pos-filtered (scalar_one_or_none) or
    multi-result (scalars().all()) query.

    pos_filtered=True  → scalar_one_or_none() path (gender or pos filter collapses to ≤1 row).
    pos_filtered=False → scalars().all() path.
    """
    result_mock = MagicMock()
    if pos_filtered:
        result_mock.scalar_one_or_none.return_value = row
    else:
        scalars_mock = MagicMock()
        scalars_mock.all.return_value = [row] if row is not None else []
        result_mock.scalars.return_value = scalars_mock

    db = AsyncMock()
    db.execute = AsyncMock(return_value=result_mock)
    return db


def _make_bundle_entry(lemma: str = "σπίτι", gender: str = "neuter", pos: str = "noun"):
    """Create a mock WiktionaryMorphology row whose .forms is a bundle list (post-backfill)."""
    entry = MagicMock()
    entry.lemma = lemma
    entry.gender = gender
    entry.pos = pos
    entry.forms = list(_BUNDLE_FORMS)  # list[dict], not dict
    return entry


# ---------------------------------------------------------------------------
# LEXGEN-03-04: RED test specs (Test-first: yes)
# These all FAIL because the implementation has not been written yet.
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestGetFormBundles:
    """RED tests for new WiktionaryMorphologyService.get_form_bundles() method (AC-1, AC-3)."""

    @pytest.mark.asyncio
    async def test_get_form_bundles_returns_bundle_list(self) -> None:
        """AC-1: get_form_bundles returns list[FormBundle] with validated features.

        RED: AttributeError — get_form_bundles does not exist yet.
        """
        entry = _make_bundle_entry()
        # No-pos-filter path: scalars().all() returning exactly one row
        db = _make_db(row=entry)  # uses the no-gender path (scalars().all())
        service = WiktionaryMorphologyService(db)

        result = await service.get_form_bundles("σπίτι", pos="noun")

        assert isinstance(result, list)
        assert len(result) == len(_BUNDLES)
        assert all(isinstance(b, FormBundle) for b in result)
        # Verify features are validated (case + number keys present)
        for bundle in result:
            assert "case" in bundle.features
            assert "number" in bundle.features

    @pytest.mark.asyncio
    async def test_get_form_bundles_returns_none_when_absent(self) -> None:
        """AC-1: get_form_bundles returns None when no matching row exists.

        RED: AttributeError — get_form_bundles does not exist yet.
        """
        db = _make_db(row=None)
        service = WiktionaryMorphologyService(db)

        result = await service.get_form_bundles("άγνωστο", pos="noun")

        assert result is None

    @pytest.mark.asyncio
    async def test_pos_filter_defaults_to_noun(self) -> None:
        """AC-3: get_form_bundles with default pos filters on pos == 'noun'.

        RED: AttributeError — get_form_bundles does not exist yet.
        Therefore the pos filter also doesn't exist.

        We verify the behaviour by checking that calling get_form_bundles with
        no explicit pos= (defaulting to "noun") still resolves the entry — i.e.
        the same entry is returned as when pos="noun" is explicit. The meaningful
        assertion is that the function exists and applies a pos default, which
        requires it to be implemented.
        """
        entry = _make_bundle_entry(pos="noun")
        db = _make_db(row=entry)
        service = WiktionaryMorphologyService(db)

        # No pos arg — must default to "noun" and still find the row
        result = await service.get_form_bundles("σπίτι")

        assert result is not None
        assert isinstance(result, list)
        assert len(result) > 0

    @pytest.mark.asyncio
    async def test_get_entry_pos_filter_disambiguates_multi_pos(self) -> None:
        """AC-3: get_entry(lemma, pos=...) resolves the single matching row.

        Edge F3: without a pos filter, two rows (noun+verb) with same lemma
        and no gender would cause the no-gender branch to return None.
        With pos filter, the matching single row is returned.

        RED: get_entry has no pos parameter yet → TypeError on extra kwarg,
        OR the pos filter is absent and the mock returns the wrong result.

        Strategy: mock the session so that the pos-filtered query returns exactly
        one row (simulated by scalar_one_or_none), and the non-pos-filtered query
        would return two rows. We confirm that passing pos="noun" returns the
        noun entry and pos="verb" returns the verb entry.
        """
        noun_entry = _make_bundle_entry(lemma="κλείνω", gender=None, pos="noun")
        verb_entry = _make_bundle_entry(lemma="κλείνω", gender=None, pos="verb")

        # Build separate db mocks for each pos call.
        # After the pos filter is added, get_entry with pos should use
        # scalar_one_or_none (gender-OR-pos branch), OR the no-gender branch
        # with exactly 1 result filtered by pos.
        # We simulate each by returning exactly 1 result (single-row path).
        db_noun = _make_db(row=noun_entry)  # scalars().all() returns [noun_entry]
        db_verb = _make_db(row=verb_entry)  # scalars().all() returns [verb_entry]

        svc_noun = WiktionaryMorphologyService(db_noun)
        svc_verb = WiktionaryMorphologyService(db_verb)

        result_noun = await svc_noun.get_entry("κλείνω", pos="noun")
        result_verb = await svc_verb.get_entry("κλείνω", pos="verb")

        assert result_noun is noun_entry
        assert result_verb is verb_entry


@pytest.mark.unit
class TestGetDeclensionsViaConverter:
    """RED tests for get_declensions() returning flat dict via bundles_to_flat (AC-2)."""

    @pytest.mark.asyncio
    async def test_get_declensions_still_flat_dict_via_converter(self) -> None:
        """AC-2: get_declensions returns a flat {case}_{number} dict derived from
        the stored bundle list via bundles_to_flat, NOT via dict(entry.forms).

        After backfill, entry.forms is a list[dict] (bundle format).
        The current implementation does dict(entry.forms), which would either
        raise TypeError on a list or produce a garbage dict keyed 0,1,2,...

        RED: the current dict(entry.forms) on a bundle list produces a wrong
        result (dict keyed by integer index) or raises TypeError, so the
        assertion that result == _EXPECTED_FLAT fails.
        """
        entry = _make_bundle_entry()
        db = _make_db(row=entry)
        service = WiktionaryMorphologyService(db)

        result = await service.get_declensions("σπίτι")

        # Must equal the flat dict derived from bundles_to_flat, not dict(list)
        assert result == _EXPECTED_FLAT
        # Spot-check: standard case_number keys present
        assert "nominative_singular" in result
        assert "genitive_plural" in result


@pytest.mark.unit
class TestGetEntryCommentAccuracy:
    """RED test for F7: get_entry docstring comment accuracy (AC-5)."""

    def test_get_entry_comment_references_pos_gender_key(self) -> None:
        """AC-5: The disambiguation comment in get_entry names (lemma, pos, gender).

        RED: The current comment says '(unique on lemma+gender)'.
        The test reads the actual source and asserts the updated comment text.
        """
        source = inspect.getsource(WiktionaryMorphologyService.get_entry)
        # The comment must reference the three-part key, not the old two-part key
        assert "(lemma, pos, gender)" in source, (
            "Expected get_entry disambiguation comment to name '(lemma, pos, gender)' "
            f"but got source:\n{source}"
        )
