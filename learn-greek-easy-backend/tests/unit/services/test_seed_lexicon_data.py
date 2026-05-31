"""Unit tests for LEXICON_SEED_DATA in seed_lexicon_data.py.

Tests cover:
- Every entry has exactly the required SQL column keys
- Non-noun entries set None (not absent) for noun-only fields
- The dataset produces the expected total row count (20 entries)
- No duplicate (form, lemma, pos) composite key
- seed_lexicon() passes each entry dict to db.execute correctly
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.seed_lexicon_data import LEXICON_SEED_DATA

# The six columns that map directly to the INSERT in seed_service.seed_lexicon()
_REQUIRED_KEYS = {"form", "lemma", "pos", "gender", "ptosi", "number"}


# ============================================================================
# Data-structure invariant tests (pure Python, no DB needed)
# ============================================================================


@pytest.mark.unit
class TestLexiconSeedDataKeys:
    """Every dict in LEXICON_SEED_DATA must have exactly the required keys."""

    def test_dataset_is_non_empty(self):
        """LEXICON_SEED_DATA must contain at least one entry."""
        assert len(LEXICON_SEED_DATA) > 0

    def test_every_entry_has_exactly_required_keys(self):
        """Each entry must have exactly the six SQL column keys, no extras, no missing."""
        for i, entry in enumerate(LEXICON_SEED_DATA):
            actual_keys = set(entry.keys())
            missing = _REQUIRED_KEYS - actual_keys
            extra = actual_keys - _REQUIRED_KEYS
            assert not missing, f"Entry {i} ({entry.get('form', '?')!r}) is missing keys: {missing}"
            assert not extra, f"Entry {i} ({entry.get('form', '?')!r}) has unexpected keys: {extra}"

    def test_form_and_lemma_are_non_empty_strings(self):
        """form and lemma must be non-empty strings for every entry."""
        for i, entry in enumerate(LEXICON_SEED_DATA):
            assert (
                isinstance(entry["form"], str) and entry["form"]
            ), f"Entry {i}: 'form' must be a non-empty string, got {entry['form']!r}"
            assert (
                isinstance(entry["lemma"], str) and entry["lemma"]
            ), f"Entry {i}: 'lemma' must be a non-empty string, got {entry['lemma']!r}"

    def test_pos_is_non_empty_string(self):
        """pos must be a non-empty string for every entry."""
        for i, entry in enumerate(LEXICON_SEED_DATA):
            assert (
                isinstance(entry["pos"], str) and entry["pos"]
            ), f"Entry {i}: 'pos' must be a non-empty string, got {entry['pos']!r}"


@pytest.mark.unit
class TestLexiconSeedDataNounOnlyFields:
    """Non-noun entries must set noun-only fields to None (not omit them)."""

    def test_verb_entry_has_none_for_all_noun_fields(self):
        """VERB entries must have gender=None, ptosi=None, number=None."""
        verb_entries = [e for e in LEXICON_SEED_DATA if e["pos"] == "VERB"]
        assert verb_entries, "Expected at least one VERB entry in LEXICON_SEED_DATA"
        for entry in verb_entries:
            assert (
                entry["gender"] is None
            ), f"VERB entry {entry['form']!r}: expected gender=None, got {entry['gender']!r}"
            assert (
                entry["ptosi"] is None
            ), f"VERB entry {entry['form']!r}: expected ptosi=None, got {entry['ptosi']!r}"
            assert (
                entry["number"] is None
            ), f"VERB entry {entry['form']!r}: expected number=None, got {entry['number']!r}"

    def test_verb_entry_keys_are_present_not_absent(self):
        """Noun-only fields must be explicitly present as None, not omitted entirely.

        This matters because SQLAlchemy text() INSERT with :param bindings
        requires the key to exist in the params dict — a missing key raises
        a StatementError at runtime.
        """
        verb_entries = [e for e in LEXICON_SEED_DATA if e["pos"] == "VERB"]
        for entry in verb_entries:
            assert (
                "gender" in entry
            ), f"VERB entry {entry['form']!r}: 'gender' key is absent (should be None)"
            assert (
                "ptosi" in entry
            ), f"VERB entry {entry['form']!r}: 'ptosi' key is absent (should be None)"
            assert (
                "number" in entry
            ), f"VERB entry {entry['form']!r}: 'number' key is absent (should be None)"

    def test_adj_entry_has_none_for_ptosi_and_number(self):
        """ADJ entries must have ptosi=None and number=None (keys must be present)."""
        adj_entries = [e for e in LEXICON_SEED_DATA if e["pos"] == "ADJ"]
        assert adj_entries, "Expected at least one ADJ entry in LEXICON_SEED_DATA"
        for entry in adj_entries:
            assert (
                "ptosi" in entry
            ), f"ADJ entry {entry['form']!r}: 'ptosi' key is absent (should be None)"
            assert (
                "number" in entry
            ), f"ADJ entry {entry['form']!r}: 'number' key is absent (should be None)"
            assert (
                entry["ptosi"] is None
            ), f"ADJ entry {entry['form']!r}: expected ptosi=None, got {entry['ptosi']!r}"
            assert (
                entry["number"] is None
            ), f"ADJ entry {entry['form']!r}: expected number=None, got {entry['number']!r}"

    def test_noun_entries_have_non_none_gender_ptosi_number(self):
        """NOUN entries must have non-None values for gender, ptosi, and number."""
        noun_entries = [e for e in LEXICON_SEED_DATA if e["pos"] == "NOUN"]
        assert noun_entries, "Expected at least one NOUN entry in LEXICON_SEED_DATA"
        for entry in noun_entries:
            assert (
                entry["gender"] is not None
            ), f"NOUN entry {entry['form']!r}: expected non-None gender"
            assert (
                entry["ptosi"] is not None
            ), f"NOUN entry {entry['form']!r}: expected non-None ptosi"
            assert (
                entry["number"] is not None
            ), f"NOUN entry {entry['form']!r}: expected non-None number"


@pytest.mark.unit
class TestLexiconSeedDataRowCount:
    """The dataset should have the expected number of entries."""

    def test_total_entry_count_is_twenty(self):
        """LEXICON_SEED_DATA must contain exactly 20 entries (per module docstring)."""
        assert (
            len(LEXICON_SEED_DATA) == 20
        ), f"Expected 20 lexicon seed entries, got {len(LEXICON_SEED_DATA)}"

    def test_contains_three_noun_paradigms(self):
        """There should be noun entries for all three genders (Masc, Fem, Neut)."""
        noun_entries = [e for e in LEXICON_SEED_DATA if e["pos"] == "NOUN"]
        genders = {e["gender"] for e in noun_entries}
        assert "Masc" in genders, "Missing masculine noun paradigm"
        assert "Fem" in genders, "Missing feminine noun paradigm"
        assert "Neut" in genders, "Missing neuter noun paradigm"

    def test_contains_verb_entry(self):
        """There should be at least one VERB entry."""
        assert any(e["pos"] == "VERB" for e in LEXICON_SEED_DATA)

    def test_contains_adj_entry(self):
        """There should be at least one ADJ entry."""
        assert any(e["pos"] == "ADJ" for e in LEXICON_SEED_DATA)


@pytest.mark.unit
class TestLexiconSeedDataUniqueness:
    """Each paradigm slot must be a unique row across all entries."""

    def test_no_duplicate_paradigm_slots(self):
        """No two entries may be identical across the full paradigm-slot key.

        (form, lemma, pos) alone is NOT unique: Greek case syncretism means a
        single surface form serves multiple cases (e.g. ``σπίτι`` is both
        nominative and accusative singular of ``σπίτι``). The genuinely unique
        row key therefore includes ``ptosi``/``number`` (the morphological slot),
        which catches accidental copy-paste duplicates without rejecting valid
        syncretic forms.
        """
        seen: set[tuple] = set()
        duplicates: list[tuple] = []
        for entry in LEXICON_SEED_DATA:
            key = (
                entry["form"],
                entry["lemma"],
                entry["pos"],
                entry.get("ptosi"),
                entry.get("number"),
            )
            if key in seen:
                duplicates.append(key)
            else:
                seen.add(key)
        assert not duplicates, f"Duplicate paradigm-slot entries found: {duplicates}"

    def test_noun_paradigm_has_unique_case_number_pairs(self):
        """Within each noun lemma, (ptosi, number) pairs must be unique."""
        from collections import defaultdict

        by_lemma: dict[str, list[dict]] = defaultdict(list)
        for entry in LEXICON_SEED_DATA:
            if entry["pos"] == "NOUN":
                by_lemma[entry["lemma"]].append(entry)

        for lemma, entries in by_lemma.items():
            case_number_pairs: set[tuple[str | None, str | None]] = set()
            duplicates: list[tuple[str | None, str | None]] = []
            for entry in entries:
                pair = (entry["ptosi"], entry["number"])
                if pair in case_number_pairs:
                    duplicates.append(pair)
                else:
                    case_number_pairs.add(pair)
            assert (
                not duplicates
            ), f"Noun lemma {lemma!r} has duplicate (ptosi, number) pairs: {duplicates}"


# ============================================================================
# seed_lexicon() insert simulation tests
# ============================================================================


@pytest.mark.unit
class TestSeedLexiconIntegration:
    """Verify seed_lexicon() passes each LEXICON_SEED_DATA entry to db.execute."""

    @pytest.fixture
    def mock_db(self):
        """Mock async DB session that tracks execute calls and returns scalar count."""
        db = AsyncMock()

        # The final SELECT COUNT(*) call returns the expected count
        select_result = MagicMock()
        select_result.scalar_one.return_value = len(LEXICON_SEED_DATA)

        # TRUNCATE and INSERT calls: return a no-op result
        noop_result = MagicMock()

        # Total execute calls: 1 TRUNCATE + N INSERTs + 1 SELECT COUNT(*)
        db.execute = AsyncMock(
            side_effect=[noop_result] + [noop_result] * len(LEXICON_SEED_DATA) + [select_result]
        )
        return db

    @pytest.fixture
    def mock_settings_can_seed(self):
        """Mock settings to allow seeding."""
        with patch("src.services.seed_service.settings") as mock_settings:
            mock_settings.can_seed_database.return_value = True
            mock_settings.get_seed_validation_errors.return_value = []
            yield mock_settings

    @pytest.mark.asyncio
    async def test_seed_lexicon_returns_correct_entry_count(self, mock_db, mock_settings_can_seed):
        """seed_lexicon() result must report lexicon_entries_created == len(LEXICON_SEED_DATA)."""
        from src.services.seed_service import SeedService

        service = SeedService(mock_db)
        result = await service.seed_lexicon()

        assert result["success"] is True
        assert result["lexicon_entries_created"] == len(LEXICON_SEED_DATA)

    @pytest.mark.asyncio
    async def test_seed_lexicon_executes_one_insert_per_entry(
        self, mock_db, mock_settings_can_seed
    ):
        """seed_lexicon() must call db.execute once per LEXICON_SEED_DATA entry (plus TRUNCATE + COUNT)."""
        from src.services.seed_service import SeedService

        service = SeedService(mock_db)
        await service.seed_lexicon()

        # Total: 1 TRUNCATE + len(LEXICON_SEED_DATA) INSERTs + 1 SELECT COUNT(*)
        expected_call_count = 1 + len(LEXICON_SEED_DATA) + 1
        assert mock_db.execute.call_count == expected_call_count

    @pytest.mark.asyncio
    async def test_seed_lexicon_passes_entry_dicts_as_params(self, mock_db, mock_settings_can_seed):
        """Each INSERT execute call must receive the corresponding entry dict as params."""
        from src.services.seed_service import SeedService

        service = SeedService(mock_db)
        await service.seed_lexicon()

        # Skip the first call (TRUNCATE) and last call (SELECT COUNT)
        insert_calls = mock_db.execute.call_args_list[1:-1]
        assert len(insert_calls) == len(LEXICON_SEED_DATA)

        for i, (execute_call, expected_entry) in enumerate(
            zip(insert_calls, LEXICON_SEED_DATA, strict=True)
        ):
            # execute(text(...), entry_dict) — second positional arg is the params dict
            actual_params = execute_call[0][1]
            assert (
                actual_params == expected_entry
            ), f"INSERT call {i}: expected params {expected_entry!r}, got {actual_params!r}"

    @pytest.mark.asyncio
    async def test_seed_lexicon_truncates_table_first(self, mock_db, mock_settings_can_seed):
        """seed_lexicon() must issue a TRUNCATE as the very first execute call."""
        from src.services.seed_service import SeedService

        service = SeedService(mock_db)
        await service.seed_lexicon()

        first_call = mock_db.execute.call_args_list[0]
        first_statement = str(first_call[0][0])
        assert (
            "TRUNCATE" in first_statement.upper()
        ), f"Expected TRUNCATE as first execute call, got: {first_statement!r}"
        assert (
            "greek_lexicon" in first_statement
        ), f"TRUNCATE did not target greek_lexicon: {first_statement!r}"

    @pytest.mark.asyncio
    async def test_seed_lexicon_blocked_in_production(self, mock_db):
        """seed_lexicon() must raise RuntimeError when seeding is not allowed."""
        from src.services.seed_service import SeedService

        with patch("src.services.seed_service.settings") as mock_settings:
            mock_settings.can_seed_database.return_value = False
            mock_settings.get_seed_validation_errors.return_value = [
                "Seeding is disabled in production environment"
            ]
            service = SeedService(mock_db)
            with pytest.raises(RuntimeError, match="Database seeding not allowed"):
                await service.seed_lexicon()
