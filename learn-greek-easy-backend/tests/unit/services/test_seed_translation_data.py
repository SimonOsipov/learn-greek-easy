"""Unit tests for seed_translation_data.py and SeedService.seed_translations().

Tests cover:
- Each entry in SEED_TRANSLATIONS has the 6 required keys
- (lemma, language, sense_index) tuples are unique across all entries
- source field is constrained to {kaikki, freedict, pivot}
- Both languages (en, ru) are represented
- seed_translations() insert count matches SEED_TRANSLATIONS length
- seed_translations() is blocked in production
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.seed_service import SeedService
from src.services.seed_translation_data import SEED_TRANSLATIONS

# ============================================================================
# Shared fixtures (mirror test_seed_service.py style exactly)
# ============================================================================


@pytest.fixture
def mock_db():
    """Create a mock async database session."""
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.execute = AsyncMock()
    return db


@pytest.fixture
def seed_service(mock_db):
    """Create SeedService instance with mock database."""
    return SeedService(mock_db)


@pytest.fixture
def mock_settings_can_seed():
    """Mock settings to allow seeding."""
    with patch("src.services.seed_service.settings") as mock_settings:
        mock_settings.can_seed_database.return_value = True
        mock_settings.get_seed_validation_errors.return_value = []
        yield mock_settings


@pytest.fixture
def mock_settings_cannot_seed():
    """Mock settings to block seeding."""
    with patch("src.services.seed_service.settings") as mock_settings:
        mock_settings.can_seed_database.return_value = False
        mock_settings.get_seed_validation_errors.return_value = [
            "Seeding is disabled in production environment",
            "TEST_SEED_ENABLED is not set to true",
        ]
        yield mock_settings


# ============================================================================
# SEED_TRANSLATIONS constant — data integrity tests
# ============================================================================


class TestSeedTranslationsConstant:
    """Tests for the SEED_TRANSLATIONS data constant."""

    REQUIRED_KEYS = {"lemma", "language", "sense_index", "translation", "part_of_speech", "source"}
    VALID_SOURCES = {"kaikki", "freedict", "pivot"}

    def test_seed_translations_is_non_empty_list(self):
        """SEED_TRANSLATIONS must be a non-empty list."""
        assert isinstance(SEED_TRANSLATIONS, list)
        assert len(SEED_TRANSLATIONS) > 0

    def test_every_entry_has_required_keys(self):
        """Each entry must have all 6 required keys."""
        for i, entry in enumerate(SEED_TRANSLATIONS):
            missing = self.REQUIRED_KEYS - set(entry.keys())
            assert (
                not missing
            ), f"Entry {i} (lemma={entry.get('lemma')!r}) is missing keys: {missing}"

    def test_no_extra_keys_in_entries(self):
        """Each entry must not carry unexpected extra keys."""
        for i, entry in enumerate(SEED_TRANSLATIONS):
            extra = set(entry.keys()) - self.REQUIRED_KEYS
            assert (
                not extra
            ), f"Entry {i} (lemma={entry.get('lemma')!r}) has unexpected keys: {extra}"

    def test_lemma_language_sense_index_are_unique(self):
        """(lemma, language, sense_index) composite key must be unique.

        A duplicate would cause a DB unique-constraint violation when seed_translations()
        is called, crashing the E2E seeding pipeline.
        """
        seen: set[tuple] = set()
        for i, entry in enumerate(SEED_TRANSLATIONS):
            key = (entry["lemma"], entry["language"], entry["sense_index"])
            assert key not in seen, f"Duplicate (lemma, language, sense_index) at entry {i}: {key}"
            seen.add(key)

    def test_source_values_are_valid(self):
        """source must be one of {kaikki, freedict, pivot}."""
        for i, entry in enumerate(SEED_TRANSLATIONS):
            assert entry["source"] in self.VALID_SOURCES, (
                f"Entry {i} (lemma={entry.get('lemma')!r}) has invalid source: {entry['source']!r}. "
                f"Allowed: {self.VALID_SOURCES}"
            )

    def test_all_three_sources_are_represented(self):
        """The seed data should include all three source types for representative coverage."""
        sources = {entry["source"] for entry in SEED_TRANSLATIONS}
        assert (
            sources == self.VALID_SOURCES
        ), f"Not all sources represented. Present: {sources}, Expected: {self.VALID_SOURCES}"

    def test_both_languages_are_present(self):
        """Both 'en' and 'ru' language entries must be present."""
        languages = {entry["language"] for entry in SEED_TRANSLATIONS}
        assert "en" in languages, "No English ('en') entries found in SEED_TRANSLATIONS"
        assert "ru" in languages, "No Russian ('ru') entries found in SEED_TRANSLATIONS"

    def test_sense_index_is_integer(self):
        """sense_index must be an integer for each entry."""
        for i, entry in enumerate(SEED_TRANSLATIONS):
            assert isinstance(entry["sense_index"], int), (
                f"Entry {i} (lemma={entry.get('lemma')!r}) has non-integer sense_index: "
                f"{entry['sense_index']!r}"
            )

    def test_sense_index_is_non_negative(self):
        """sense_index must be >= 0."""
        for i, entry in enumerate(SEED_TRANSLATIONS):
            assert entry["sense_index"] >= 0, (
                f"Entry {i} (lemma={entry.get('lemma')!r}) has negative sense_index: "
                f"{entry['sense_index']}"
            )

    def test_lemma_is_non_empty_string(self):
        """lemma must be a non-empty string."""
        for i, entry in enumerate(SEED_TRANSLATIONS):
            assert (
                isinstance(entry["lemma"], str) and len(entry["lemma"]) > 0
            ), f"Entry {i} has invalid lemma: {entry.get('lemma')!r}"

    def test_translation_is_non_empty_string(self):
        """translation must be a non-empty string."""
        for i, entry in enumerate(SEED_TRANSLATIONS):
            assert isinstance(entry["translation"], str) and len(entry["translation"]) > 0, (
                f"Entry {i} (lemma={entry.get('lemma')!r}) has invalid translation: "
                f"{entry.get('translation')!r}"
            )

    def test_language_values_are_expected(self):
        """language values must be 'en' or 'ru' (the two supported languages)."""
        allowed_languages = {"en", "ru"}
        for i, entry in enumerate(SEED_TRANSLATIONS):
            assert entry["language"] in allowed_languages, (
                f"Entry {i} (lemma={entry.get('lemma')!r}) has unexpected language: "
                f"{entry['language']!r}"
            )

    def test_part_of_speech_is_string_or_none(self):
        """part_of_speech must be a string or None (nullable column)."""
        for i, entry in enumerate(SEED_TRANSLATIONS):
            pos = entry["part_of_speech"]
            assert pos is None or isinstance(pos, str), (
                f"Entry {i} (lemma={entry.get('lemma')!r}) has invalid part_of_speech type: "
                f"{type(pos)}"
            )

    def test_total_entry_count(self):
        """SEED_TRANSLATIONS should have exactly 10 entries (5 lemmas × 2 languages)."""
        assert len(SEED_TRANSLATIONS) == 10, f"Expected 10 entries, got {len(SEED_TRANSLATIONS)}"

    def test_english_and_russian_entry_counts(self):
        """Both 'en' and 'ru' entries should be present with at least one each."""
        en_entries = [e for e in SEED_TRANSLATIONS if e["language"] == "en"]
        ru_entries = [e for e in SEED_TRANSLATIONS if e["language"] == "ru"]
        assert len(en_entries) >= 1, "No English entries found"
        assert len(ru_entries) >= 1, "No Russian entries found"


# ============================================================================
# SeedService.seed_translations() — behaviour tests
# ============================================================================


class TestSeedTranslationsMethod:
    """Tests for SeedService.seed_translations() method."""

    @pytest.fixture
    def mock_db_with_count(self):
        """Mock DB that returns SEED_TRANSLATIONS count from SELECT COUNT(*)."""
        db = AsyncMock()
        db.add = MagicMock()
        db.flush = AsyncMock()
        db.commit = AsyncMock()

        # All execute calls return the same mock; scalar_one() returns the expected count.
        # The last execute() is SELECT COUNT(*) — the same mock object works because
        # scalar_one() is only called on the final result.
        expected_count = len(SEED_TRANSLATIONS)
        count_result = MagicMock()
        count_result.scalar_one.return_value = expected_count
        db.execute = AsyncMock(return_value=count_result)

        return db

    @pytest.mark.asyncio
    async def test_seed_translations_blocked_in_production(
        self, seed_service, mock_settings_cannot_seed
    ):
        """seed_translations should raise RuntimeError in production."""
        with pytest.raises(RuntimeError) as exc_info:
            await seed_service.seed_translations()

        assert "Database seeding not allowed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_seed_translations_returns_success(
        self, mock_db_with_count, mock_settings_can_seed
    ):
        """seed_translations should return success=True."""
        svc = SeedService(mock_db_with_count)

        result = await svc.seed_translations()

        assert result["success"] is True

    @pytest.mark.asyncio
    async def test_seed_translations_insert_count_matches_data(
        self, mock_db_with_count, mock_settings_can_seed
    ):
        """translation_entries_created should equal len(SEED_TRANSLATIONS)."""
        svc = SeedService(mock_db_with_count)

        result = await svc.seed_translations()

        assert result["translation_entries_created"] == len(SEED_TRANSLATIONS)

    @pytest.mark.asyncio
    async def test_seed_translations_executes_truncate_first(
        self, mock_db_with_count, mock_settings_can_seed
    ):
        """seed_translations should TRUNCATE the table before inserting."""
        svc = SeedService(mock_db_with_count)

        await svc.seed_translations()

        # First execute call must be the TRUNCATE
        first_call_args = mock_db_with_count.execute.call_args_list[0]
        stmt = first_call_args[0][0]  # positional arg — a sqlalchemy text() object
        assert "TRUNCATE" in str(stmt).upper()
        assert "translations" in str(stmt).lower()

    @pytest.mark.asyncio
    async def test_seed_translations_execute_call_count(
        self, mock_db_with_count, mock_settings_can_seed
    ):
        """execute should be called once for TRUNCATE, once per entry, once for SELECT COUNT."""
        svc = SeedService(mock_db_with_count)

        await svc.seed_translations()

        # Total calls = 1 (TRUNCATE) + len(SEED_TRANSLATIONS) (INSERTs) + 1 (SELECT COUNT)
        expected_calls = 1 + len(SEED_TRANSLATIONS) + 1
        assert mock_db_with_count.execute.call_count == expected_calls

    @pytest.mark.asyncio
    async def test_seed_translations_passes_correct_params(
        self, mock_db_with_count, mock_settings_can_seed
    ):
        """Each INSERT execute call should pass the full entry dict as parameters."""
        svc = SeedService(mock_db_with_count)

        await svc.seed_translations()

        # Calls: index 0 = TRUNCATE, indices 1..N = INSERTs, last = SELECT COUNT
        insert_calls = mock_db_with_count.execute.call_args_list[1 : 1 + len(SEED_TRANSLATIONS)]

        for i, (entry, call_args) in enumerate(zip(SEED_TRANSLATIONS, insert_calls)):
            # The entry dict is passed as the second positional argument to execute()
            passed_params = call_args[0][1]
            assert (
                passed_params == entry
            ), f"INSERT call {i}: expected params {entry!r}, got {passed_params!r}"

    @pytest.mark.asyncio
    async def test_seed_translations_inserts_cover_both_languages(
        self, mock_db_with_count, mock_settings_can_seed
    ):
        """Inserted entries must include both 'en' and 'ru' languages."""
        svc = SeedService(mock_db_with_count)

        await svc.seed_translations()

        insert_calls = mock_db_with_count.execute.call_args_list[1 : 1 + len(SEED_TRANSLATIONS)]
        inserted_languages = {call_args[0][1]["language"] for call_args in insert_calls}

        assert "en" in inserted_languages, "No English entries inserted"
        assert "ru" in inserted_languages, "No Russian entries inserted"

    @pytest.mark.asyncio
    async def test_seed_translations_result_key_name(
        self, mock_db_with_count, mock_settings_can_seed
    ):
        """Result dict must use 'translation_entries_created' as the count key."""
        svc = SeedService(mock_db_with_count)

        result = await svc.seed_translations()

        assert "translation_entries_created" in result
