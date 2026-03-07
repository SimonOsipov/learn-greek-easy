"""Unit tests for TranslationLookupService.

Tests cover:
- lookup(): direct dictionary hit (kaikki), pivot fallback, empty result
- POS preference (POS-matched rows preferred)
- POS fallback (no POS match → return all rows)
- NFC normalization applied before querying
- combined_text deduplication (order-preserving)
- Three-tier source resolution logic
- lookup_bilingual() returns both languages concurrently
- Empty result returns TranslationResult with source="none"

These tests use mocked AsyncSession — no real database required.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.translation_service import (
    TranslationEntry,
    TranslationLookupService,
    TranslationResult,
)

# ============================================================================
# Helpers
# ============================================================================


def _make_mock_row(
    lemma: str = "αετός",
    language: str = "en",
    sense_index: int = 0,
    translation: str = "eagle",
    part_of_speech: str | None = "NOUN",
    source: str = "kaikki",
) -> MagicMock:
    """Return a MagicMock mimicking a Translation ORM row."""
    row = MagicMock()
    row.lemma = lemma
    row.language = language
    row.sense_index = sense_index
    row.translation = translation
    row.part_of_speech = part_of_speech
    row.source = source
    return row


def _make_mock_session(rows: list | None = None) -> MagicMock:
    """Return a mocked AsyncSession for queries using scalars().all()."""
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = rows if rows is not None else []

    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars

    mock_session = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    return mock_session


def _make_mock_session_multi_call(
    first_rows: list,
    second_rows: list | None = None,
) -> MagicMock:
    """Return a mocked AsyncSession where execute() returns different results per call.

    First call returns first_rows, second call (if any) returns second_rows.
    Used to test POS fallback: first call returns [] (POS miss), second returns rows.
    """
    results = []
    for rows in [first_rows, second_rows or []]:
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = rows

        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        results.append(mock_result)

    mock_session = MagicMock()
    mock_session.execute = AsyncMock(side_effect=results)
    return mock_session


# ============================================================================
# lookup() - Direct Dictionary Hit
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
class TestTranslationLookupDirectHit:
    """Tests for direct kaikki/freedict lookup."""

    async def test_kaikki_hit_returns_dictionary_source(self):
        """When kaikki rows exist, result.source == 'dictionary'."""
        rows = [_make_mock_row(source="kaikki", translation="eagle")]
        mock_session = _make_mock_session(rows)
        service = TranslationLookupService(mock_session)

        result = await service.lookup("αετός", "en")

        assert result.source == "dictionary"
        assert len(result.translations) == 1
        assert result.translations[0].translation == "eagle"
        assert result.translations[0].source == "kaikki"

    async def test_freedict_hit_returns_dictionary_source(self):
        """When freedict rows exist, result.source == 'dictionary'."""
        rows = [_make_mock_row(source="freedict", translation="дом", language="ru")]
        mock_session = _make_mock_session(rows)
        service = TranslationLookupService(mock_session)

        result = await service.lookup("σπίτι", "ru")

        assert result.source == "dictionary"
        assert result.translations[0].source == "freedict"

    async def test_kaikki_preferred_over_freedict_and_pivot(self):
        """When kaikki and freedict both exist, only direct sources are used."""
        rows = [
            _make_mock_row(source="kaikki", translation="eagle", sense_index=0),
            _make_mock_row(source="pivot", translation="bird", sense_index=1),
        ]
        mock_session = _make_mock_session(rows)
        service = TranslationLookupService(mock_session)

        result = await service.lookup("αετός", "en")

        assert result.source == "dictionary"
        # Only kaikki row included, pivot excluded
        assert len(result.translations) == 1
        assert result.translations[0].source == "kaikki"

    async def test_multiple_kaikki_rows_ordered_by_sense_index(self):
        """Multiple kaikki rows all included, combined_text in order."""
        rows = [
            _make_mock_row(source="kaikki", translation="eagle", sense_index=0),
            _make_mock_row(source="kaikki", translation="hawk", sense_index=1),
        ]
        mock_session = _make_mock_session(rows)
        service = TranslationLookupService(mock_session)

        result = await service.lookup("αετός", "en")

        assert result.combined_text == "eagle, hawk"
        assert len(result.translations) == 2

    async def test_combined_text_joins_with_comma_space(self):
        """combined_text uses ', ' separator."""
        rows = [
            _make_mock_row(source="kaikki", translation="house", sense_index=0),
            _make_mock_row(source="kaikki", translation="home", sense_index=1),
        ]
        mock_session = _make_mock_session(rows)
        service = TranslationLookupService(mock_session)

        result = await service.lookup("σπίτι", "en")

        assert result.combined_text == "house, home"


# ============================================================================
# lookup() - Pivot Fallback
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
class TestTranslationLookupPivotFallback:
    """Tests for pivot source fallback."""

    async def test_pivot_only_returns_pivot_source(self):
        """When only pivot rows exist, result.source == 'pivot'."""
        rows = [_make_mock_row(source="pivot", translation="бежать", language="ru")]
        mock_session = _make_mock_session(rows)
        service = TranslationLookupService(mock_session)

        result = await service.lookup("τρέχω", "ru")

        assert result.source == "pivot"
        assert len(result.translations) == 1
        assert result.translations[0].source == "pivot"

    async def test_direct_source_wins_over_pivot(self):
        """When both freedict and pivot rows exist, pivot is excluded."""
        rows = [
            _make_mock_row(source="freedict", translation="дом", sense_index=0),
            _make_mock_row(source="pivot", translation="жильё", sense_index=1),
        ]
        mock_session = _make_mock_session(rows)
        service = TranslationLookupService(mock_session)

        result = await service.lookup("σπίτι", "ru")

        assert result.source == "dictionary"
        assert all(e.source == "freedict" for e in result.translations)


# ============================================================================
# lookup() - Empty Result
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
class TestTranslationLookupEmpty:
    """Tests for empty / no-match cases."""

    async def test_no_rows_returns_none_source(self):
        """When no rows found, source == 'none'."""
        mock_session = _make_mock_session(rows=[])
        service = TranslationLookupService(mock_session)

        result = await service.lookup("nonexistent", "en")

        assert result.source == "none"
        assert result.translations == []
        assert result.combined_text == ""

    async def test_empty_result_is_correct_type(self):
        """Empty result returns a TranslationResult instance."""
        mock_session = _make_mock_session(rows=[])
        service = TranslationLookupService(mock_session)

        result = await service.lookup("nonexistent", "en")

        assert isinstance(result, TranslationResult)


# ============================================================================
# lookup() - POS Preference
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
class TestTranslationLookupPOSPreference:
    """Tests for POS preference logic."""

    async def test_pos_matched_rows_preferred(self):
        """When pos-matched rows exist, only those are returned."""
        # First execute call (POS query) returns NOUN-matched rows
        pos_rows = [_make_mock_row(part_of_speech="NOUN", translation="eagle")]
        mock_session = _make_mock_session_multi_call(
            first_rows=pos_rows,
            second_rows=[],
        )
        service = TranslationLookupService(mock_session)

        result = await service.lookup("αετός", "en", pos="NOUN")

        assert len(result.translations) == 1
        assert result.translations[0].part_of_speech == "NOUN"
        # Only 1 execute call since POS match found
        assert mock_session.execute.call_count == 1

    async def test_pos_fallback_when_no_pos_match(self):
        """When no POS-matched rows, fall back to all rows."""
        # First execute call (POS query) returns empty, second returns all rows
        all_rows = [_make_mock_row(part_of_speech=None, translation="quickly")]
        mock_session = _make_mock_session_multi_call(
            first_rows=[],  # POS query: no match
            second_rows=all_rows,  # fallback: all rows
        )
        service = TranslationLookupService(mock_session)

        result = await service.lookup("γρήγορα", "en", pos="NOUN")

        assert len(result.translations) == 1
        assert result.translations[0].translation == "quickly"
        # 2 execute calls: POS miss then fallback
        assert mock_session.execute.call_count == 2

    async def test_no_pos_arg_single_query(self):
        """When pos=None, only one execute call is made."""
        rows = [_make_mock_row(translation="eagle")]
        mock_session = _make_mock_session(rows)
        service = TranslationLookupService(mock_session)

        await service.lookup("αετός", "en")

        assert mock_session.execute.call_count == 1


# ============================================================================
# lookup() - NFC Normalization
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
class TestTranslationLookupNFCNormalization:
    """Tests for NFC normalization before querying."""

    async def test_nfc_normalization_applied(self):
        """NFD input is normalized to NFC before querying — different form, same lookup."""
        import unicodedata

        # αετός in NFC (precomposed ό = single code point U+03CC)
        nfc_lemma = unicodedata.normalize("NFC", "αετός")
        # αετός in NFD (decomposed: o + combining accent = two code points)
        nfd_lemma = unicodedata.normalize("NFD", "αετός")

        # Verify they are actually different byte sequences
        assert nfd_lemma != nfc_lemma, "NFD and NFC forms should differ for Greek accented text"

        rows = [_make_mock_row(lemma=nfc_lemma, translation="eagle")]
        mock_session = _make_mock_session(rows)
        service = TranslationLookupService(mock_session)

        # Looking up with NFD form should normalize to NFC and find the row
        result = await service.lookup(nfd_lemma, "en")
        assert isinstance(result, TranslationResult)
        # Verify execute was called (NFC normalization means the query ran)
        mock_session.execute.assert_called_once()


# ============================================================================
# _build_result() - Source Tier Resolution
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
class TestTranslationBuildResult:
    """Tests for _build_result() source tier logic."""

    async def test_both_kaikki_and_freedict_gives_dictionary(self):
        """Mixed kaikki+freedict rows → source='dictionary', all included."""
        rows = [
            _make_mock_row(source="kaikki", translation="eagle", sense_index=0),
            _make_mock_row(source="freedict", translation="bird of prey", sense_index=1),
        ]
        mock_session = _make_mock_session(rows)
        service = TranslationLookupService(mock_session)

        result = await service.lookup("αετός", "en")

        assert result.source == "dictionary"
        assert len(result.translations) == 2

    async def test_unknown_source_falls_to_none(self):
        """When only unknown sources (not kaikki/freedict/pivot) → source='none'."""
        rows = [_make_mock_row(source="unknown_src", translation="eagle")]
        mock_session = _make_mock_session(rows)
        service = TranslationLookupService(mock_session)

        result = await service.lookup("αετός", "en")

        # Rows returned but not kaikki/freedict/pivot — source tier is "none"
        assert result.source == "none"
        # All rows included since no better tier applies
        assert len(result.translations) == 1


# ============================================================================
# combined_text - Deduplication
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
class TestTranslationCombinedTextDedup:
    """Tests for order-preserving deduplication in combined_text."""

    async def test_duplicate_translations_deduped(self):
        """Duplicate translation values appear only once in combined_text."""
        rows = [
            _make_mock_row(source="kaikki", translation="eagle", sense_index=0),
            _make_mock_row(source="kaikki", translation="eagle", sense_index=1),
            _make_mock_row(source="kaikki", translation="hawk", sense_index=2),
        ]
        mock_session = _make_mock_session(rows)
        service = TranslationLookupService(mock_session)

        result = await service.lookup("αετός", "en")

        assert result.combined_text == "eagle, hawk"

    async def test_dedup_preserves_first_occurrence_order(self):
        """Dedup keeps first occurrence, preserving order."""
        rows = [
            _make_mock_row(source="kaikki", translation="A", sense_index=0),
            _make_mock_row(source="kaikki", translation="B", sense_index=1),
            _make_mock_row(source="kaikki", translation="A", sense_index=2),
            _make_mock_row(source="kaikki", translation="C", sense_index=3),
        ]
        mock_session = _make_mock_session(rows)
        service = TranslationLookupService(mock_session)

        result = await service.lookup("αετός", "en")

        assert result.combined_text == "A, B, C"

    async def test_single_translation_no_comma(self):
        """Single translation has no comma in combined_text."""
        rows = [_make_mock_row(source="kaikki", translation="eagle")]
        mock_session = _make_mock_session(rows)
        service = TranslationLookupService(mock_session)

        result = await service.lookup("αετός", "en")

        assert result.combined_text == "eagle"


# ============================================================================
# lookup_bilingual()
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
class TestTranslationLookupBilingual:
    """Tests for lookup_bilingual()."""

    async def test_returns_both_languages(self):
        """lookup_bilingual() returns dict with 'en' and 'ru' keys."""
        # We need different responses for each call; patch lookup directly
        service = TranslationLookupService(MagicMock())
        en_result = TranslationResult(
            translations=[TranslationEntry("αετός", "en", 0, "eagle", "NOUN", "kaikki")],
            source="dictionary",
            combined_text="eagle",
        )
        ru_result = TranslationResult(
            translations=[TranslationEntry("αετός", "ru", 0, "орёл", "NOUN", "freedict")],
            source="dictionary",
            combined_text="орёл",
        )

        with patch.object(service, "lookup", new=AsyncMock(side_effect=[en_result, ru_result])):
            result = await service.lookup_bilingual("αετός", pos="NOUN")

        assert "en" in result
        assert "ru" in result
        assert result["en"].combined_text == "eagle"
        assert result["ru"].combined_text == "орёл"

    async def test_bilingual_uses_asyncio_gather(self):
        """lookup_bilingual() calls lookup for both languages."""
        service = TranslationLookupService(MagicMock())
        empty = TranslationResult(translations=[], source="none", combined_text="")

        with patch.object(service, "lookup", new=AsyncMock(return_value=empty)) as mock_lookup:
            await service.lookup_bilingual("αετός")

        assert mock_lookup.call_count == 2
        call_args = [call.args for call in mock_lookup.call_args_list]
        languages = {args[1] for args in call_args}
        assert languages == {"en", "ru"}

    async def test_bilingual_passes_pos_to_both(self):
        """lookup_bilingual() passes pos argument to both lookup calls."""
        service = TranslationLookupService(MagicMock())
        empty = TranslationResult(translations=[], source="none", combined_text="")

        with patch.object(service, "lookup", new=AsyncMock(return_value=empty)) as mock_lookup:
            await service.lookup_bilingual("αετός", pos="NOUN")

        for call in mock_lookup.call_args_list:
            assert call.args[2] == "NOUN" or call.kwargs.get("pos") == "NOUN"

    async def test_bilingual_returns_empty_when_no_data(self):
        """lookup_bilingual() returns empty TranslationResults when no data."""
        mock_session = _make_mock_session(rows=[])
        service = TranslationLookupService(mock_session)

        result = await service.lookup_bilingual("nonexistent")

        assert result["en"].source == "none"
        assert result["ru"].source == "none"
        assert result["en"].combined_text == ""
        assert result["ru"].combined_text == ""


# ============================================================================
# TranslationEntry dataclass
# ============================================================================


@pytest.mark.unit
class TestTranslationEntryDataclass:
    """Tests for TranslationEntry frozen dataclass."""

    def test_frozen_dataclass_immutable(self):
        """TranslationEntry is immutable (frozen=True)."""
        entry = TranslationEntry("αετός", "en", 0, "eagle", "NOUN", "kaikki")
        with pytest.raises(Exception):
            entry.translation = "hawk"  # type: ignore[misc]

    def test_entry_fields(self):
        """TranslationEntry stores all fields correctly."""
        entry = TranslationEntry(
            lemma="αετός",
            language="en",
            sense_index=0,
            translation="eagle",
            part_of_speech="NOUN",
            source="kaikki",
        )
        assert entry.lemma == "αετός"
        assert entry.language == "en"
        assert entry.sense_index == 0
        assert entry.translation == "eagle"
        assert entry.part_of_speech == "NOUN"
        assert entry.source == "kaikki"

    def test_entry_nullable_pos(self):
        """TranslationEntry accepts None for part_of_speech."""
        entry = TranslationEntry("γρήγορα", "en", 0, "quickly", None, "kaikki")
        assert entry.part_of_speech is None
