"""Unit tests for WordEntryRepository."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Deck, DeckLevel, PartOfSpeech, WordEntry
from src.repositories.word_entry import WordEntryRepository


@pytest.fixture
async def sample_deck(db_session: AsyncSession) -> Deck:
    """Create a sample deck for testing."""
    deck = Deck(
        name_en="Test Deck",
        name_el="Test Deck",
        name_ru="Test Deck",
        description_en="Test deck for word entries",
        description_el="Test deck for word entries",
        description_ru="Test deck for word entries",
        level=DeckLevel.A1,
        is_active=True,
    )
    db_session.add(deck)
    await db_session.commit()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def sample_word_entries(db_session: AsyncSession, sample_deck: Deck) -> list[WordEntry]:
    """Create sample word entries for testing."""
    entries = [
        WordEntry(
            deck_id=sample_deck.id,
            lemma="house",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="house",
            is_active=True,
        ),
        WordEntry(
            deck_id=sample_deck.id,
            lemma="run",
            part_of_speech=PartOfSpeech.VERB,
            translation_en="to run",
            is_active=True,
        ),
    ]
    db_session.add_all(entries)
    await db_session.commit()
    for entry in entries:
        await db_session.refresh(entry)
    return entries


class TestWordEntryRepositoryBasic:
    """Test basic repository operations."""

    @pytest.mark.asyncio
    async def test_get_by_deck(
        self,
        db_session: AsyncSession,
        sample_deck: Deck,
        sample_word_entries: list[WordEntry],
    ):
        """Test getting word entries by deck."""
        repo = WordEntryRepository(db_session)
        entries = await repo.get_by_deck(sample_deck.id)

        assert len(entries) == 2
        lemmas = {e.lemma for e in entries}
        assert "house" in lemmas
        assert "run" in lemmas

    @pytest.mark.asyncio
    async def test_get_by_deck_with_pagination(
        self,
        db_session: AsyncSession,
        sample_deck: Deck,
        sample_word_entries: list[WordEntry],
    ):
        """Test getting word entries by deck with pagination."""
        repo = WordEntryRepository(db_session)

        # Get first page
        entries = await repo.get_by_deck(sample_deck.id, skip=0, limit=1)
        assert len(entries) == 1

        # Get second page
        entries = await repo.get_by_deck(sample_deck.id, skip=1, limit=1)
        assert len(entries) == 1

    @pytest.mark.asyncio
    async def test_get_by_deck_active_only(
        self,
        db_session: AsyncSession,
        sample_deck: Deck,
        sample_word_entries: list[WordEntry],
    ):
        """Test filtering word entries by active status."""
        repo = WordEntryRepository(db_session)

        # Deactivate one entry
        sample_word_entries[0].is_active = False
        await db_session.commit()

        # Should only get active entry
        entries = await repo.get_by_deck(sample_deck.id, active_only=True)
        assert len(entries) == 1
        assert entries[0].lemma == "run"

        # Should get all entries
        entries = await repo.get_by_deck(sample_deck.id, active_only=False)
        assert len(entries) == 2

    @pytest.mark.asyncio
    async def test_count_by_deck(
        self,
        db_session: AsyncSession,
        sample_deck: Deck,
        sample_word_entries: list[WordEntry],
    ):
        """Test counting word entries by deck."""
        repo = WordEntryRepository(db_session)
        count = await repo.count_by_deck(sample_deck.id)

        assert count == 2

    @pytest.mark.asyncio
    async def test_count_by_deck_active_only(
        self,
        db_session: AsyncSession,
        sample_deck: Deck,
        sample_word_entries: list[WordEntry],
    ):
        """Test counting word entries with active filter."""
        repo = WordEntryRepository(db_session)

        # Deactivate one entry
        sample_word_entries[0].is_active = False
        await db_session.commit()

        # Count active only
        count = await repo.count_by_deck(sample_deck.id, active_only=True)
        assert count == 1

        # Count all
        count = await repo.count_by_deck(sample_deck.id, active_only=False)
        assert count == 2

    @pytest.mark.asyncio
    async def test_get_by_lemma_pos(
        self,
        db_session: AsyncSession,
        sample_deck: Deck,
        sample_word_entries: list[WordEntry],
    ):
        """Test getting entry by lemma and part of speech."""
        repo = WordEntryRepository(db_session)

        entry = await repo.get_by_lemma_pos(sample_deck.id, "house", PartOfSpeech.NOUN)
        assert entry is not None
        assert entry.lemma == "house"
        assert entry.translation_en == "house"

    @pytest.mark.asyncio
    async def test_get_by_lemma_pos_not_found(
        self,
        db_session: AsyncSession,
        sample_deck: Deck,
    ):
        """Test getting non-existent entry returns None."""
        repo = WordEntryRepository(db_session)

        entry = await repo.get_by_lemma_pos(sample_deck.id, "nonexistent", PartOfSpeech.NOUN)
        assert entry is None


class TestWordEntryRepositoryBulkUpsert:
    """Test bulk upsert functionality."""

    @pytest.mark.asyncio
    async def test_bulk_upsert_create_new(self, db_session: AsyncSession, sample_deck: Deck):
        """Test bulk upsert creates new entries."""
        repo = WordEntryRepository(db_session)

        entries_data = [
            {
                "lemma": "good",
                "part_of_speech": PartOfSpeech.ADJECTIVE,
                "translation_en": "good",
            },
            {
                "lemma": "quickly",
                "part_of_speech": PartOfSpeech.ADVERB,
                "translation_en": "quickly",
            },
        ]

        entries, created, updated = await repo.bulk_upsert(sample_deck.id, entries_data)
        await db_session.commit()

        assert len(entries) == 2
        assert created == 2
        assert updated == 0

    @pytest.mark.asyncio
    async def test_bulk_upsert_update_existing(
        self,
        db_session: AsyncSession,
        sample_deck: Deck,
        sample_word_entries: list[WordEntry],
    ):
        """Test bulk upsert updates existing entries."""
        repo = WordEntryRepository(db_session)

        entries_data = [
            {
                "lemma": "house",
                "part_of_speech": PartOfSpeech.NOUN,
                "translation_en": "house, home",
            },
        ]

        entries, created, updated = await repo.bulk_upsert(sample_deck.id, entries_data)
        await db_session.commit()

        assert len(entries) == 1
        assert created == 0
        assert updated == 1
        assert entries[0].translation_en == "house, home"

    @pytest.mark.asyncio
    async def test_bulk_upsert_mixed(
        self,
        db_session: AsyncSession,
        sample_deck: Deck,
        sample_word_entries: list[WordEntry],
    ):
        """Test bulk upsert with mix of creates and updates."""
        repo = WordEntryRepository(db_session)

        entries_data = [
            # Update existing
            {
                "lemma": "house",
                "part_of_speech": PartOfSpeech.NOUN,
                "translation_en": "house, home",
            },
            # Create new
            {
                "lemma": "water",
                "part_of_speech": PartOfSpeech.NOUN,
                "translation_en": "water",
            },
        ]

        entries, created, updated = await repo.bulk_upsert(sample_deck.id, entries_data)
        await db_session.commit()

        assert len(entries) == 2
        assert created == 1
        assert updated == 1

    @pytest.mark.asyncio
    async def test_bulk_upsert_preserves_is_active(
        self, db_session: AsyncSession, sample_deck: Deck
    ):
        """Test that bulk upsert preserves is_active flag."""
        repo = WordEntryRepository(db_session)

        # Create an inactive entry
        inactive_entry = WordEntry(
            deck_id=sample_deck.id,
            lemma="old",
            part_of_speech=PartOfSpeech.ADJECTIVE,
            translation_en="old",
            is_active=False,
        )
        db_session.add(inactive_entry)
        await db_session.commit()

        # Update it via bulk upsert
        entries_data = [
            {
                "lemma": "old",
                "part_of_speech": PartOfSpeech.ADJECTIVE,
                "translation_en": "old, ancient",
            },
        ]

        entries, created, updated = await repo.bulk_upsert(sample_deck.id, entries_data)
        await db_session.commit()

        # Verify is_active was preserved as False
        await db_session.refresh(inactive_entry)
        assert inactive_entry.is_active is False
        assert inactive_entry.translation_en == "old, ancient"

    @pytest.mark.asyncio
    async def test_bulk_upsert_empty_list(self, db_session: AsyncSession, sample_deck: Deck):
        """Test bulk upsert with empty list returns empty results."""
        repo = WordEntryRepository(db_session)

        entries, created, updated = await repo.bulk_upsert(sample_deck.id, [])

        assert entries == []
        assert created == 0
        assert updated == 0

    @pytest.mark.asyncio
    async def test_bulk_upsert_with_optional_fields(
        self, db_session: AsyncSession, sample_deck: Deck
    ):
        """Test bulk upsert with all optional fields."""
        repo = WordEntryRepository(db_session)

        entries_data = [
            {
                "lemma": "full",
                "part_of_speech": PartOfSpeech.ADJECTIVE,
                "translation_en": "full",
                "translation_ru": "polnyj",
                "pronunciation": "full",
                "grammar_data": {"comparative": "fuller"},
                "examples": [{"greek": "example", "english": "example"}],
            },
        ]

        entries, created, updated = await repo.bulk_upsert(sample_deck.id, entries_data)
        await db_session.commit()

        assert len(entries) == 1
        assert created == 1
        assert entries[0].translation_ru == "polnyj"
        assert entries[0].pronunciation == "full"
        assert entries[0].grammar_data == {"comparative": "fuller"}
        assert len(entries[0].examples) == 1

    @pytest.mark.asyncio
    async def test_bulk_upsert_updates_timestamp(
        self,
        db_session: AsyncSession,
        sample_deck: Deck,
        sample_word_entries: list[WordEntry],
    ):
        """Test that bulk upsert updates the updated_at timestamp."""
        repo = WordEntryRepository(db_session)

        original_updated_at = sample_word_entries[0].updated_at

        entries_data = [
            {
                "lemma": "house",
                "part_of_speech": PartOfSpeech.NOUN,
                "translation_en": "house updated",
            },
        ]

        entries, _, _ = await repo.bulk_upsert(sample_deck.id, entries_data)
        await db_session.commit()

        # The updated_at should be newer
        assert entries[0].updated_at >= original_updated_at


class TestBulkUpsertAudioKeyMerge:
    """Test audio_key preservation during bulk upsert."""

    @pytest.mark.asyncio
    async def test_preserves_existing_audio_key(self, db_session: AsyncSession, sample_deck: Deck):
        """Test that existing audio_key is preserved when incoming example has no audio_key."""
        repo = WordEntryRepository(db_session)

        # Create a WordEntry with an example that has an audio_key
        existing_entry = WordEntry(
            deck_id=sample_deck.id,
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="house",
            examples=[
                {"id": "ex1", "greek": "Το σπίτι είναι μεγάλο.", "audio_key": "audio/ex1.mp3"}
            ],
        )
        db_session.add(existing_entry)
        await db_session.commit()

        # Upsert the same lemma/pos with example ex1 but NO audio_key
        entries_data = [
            {
                "lemma": "σπίτι",
                "part_of_speech": PartOfSpeech.NOUN,
                "translation_en": "house",
                "examples": [{"id": "ex1", "greek": "Το σπίτι είναι μεγάλο."}],
            }
        ]

        entries, _, _ = await repo.bulk_upsert(sample_deck.id, entries_data)
        await db_session.commit()

        assert len(entries) == 1
        assert len(entries[0].examples) == 1
        assert entries[0].examples[0]["audio_key"] == "audio/ex1.mp3"

    @pytest.mark.asyncio
    async def test_new_example_has_null_audio_key(
        self, db_session: AsyncSession, sample_deck: Deck
    ):
        """Test that a new example (different id) gets no audio_key carried over."""
        repo = WordEntryRepository(db_session)

        # Create a WordEntry with an example that has an audio_key
        existing_entry = WordEntry(
            deck_id=sample_deck.id,
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="house",
            examples=[
                {"id": "ex1", "greek": "Το σπίτι είναι μεγάλο.", "audio_key": "audio/ex1.mp3"}
            ],
        )
        db_session.add(existing_entry)
        await db_session.commit()

        # Upsert with a NEW example id (ex2) that has no audio_key
        entries_data = [
            {
                "lemma": "σπίτι",
                "part_of_speech": PartOfSpeech.NOUN,
                "translation_en": "house",
                "examples": [{"id": "ex2", "greek": "Το σπίτι μου."}],
            }
        ]

        entries, _, _ = await repo.bulk_upsert(sample_deck.id, entries_data)
        await db_session.commit()

        assert len(entries) == 1
        assert len(entries[0].examples) == 1
        assert entries[0].examples[0]["id"] == "ex2"
        assert entries[0].examples[0].get("audio_key") is None

    @pytest.mark.asyncio
    async def test_explicit_audio_key_not_overwritten(
        self, db_session: AsyncSession, sample_deck: Deck
    ):
        """Test that an incoming audio_key is not overwritten by the existing one."""
        repo = WordEntryRepository(db_session)

        # Create a WordEntry with an old audio_key
        existing_entry = WordEntry(
            deck_id=sample_deck.id,
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="house",
            examples=[{"id": "ex1", "greek": "Το σπίτι είναι μεγάλο.", "audio_key": "old_key.mp3"}],
        )
        db_session.add(existing_entry)
        await db_session.commit()

        # Upsert with an explicit new audio_key on the same example id
        entries_data = [
            {
                "lemma": "σπίτι",
                "part_of_speech": PartOfSpeech.NOUN,
                "translation_en": "house",
                "examples": [
                    {"id": "ex1", "greek": "Το σπίτι είναι μεγάλο.", "audio_key": "new_key.mp3"}
                ],
            }
        ]

        entries, _, _ = await repo.bulk_upsert(sample_deck.id, entries_data)
        await db_session.commit()

        assert len(entries) == 1
        assert len(entries[0].examples) == 1
        assert entries[0].examples[0]["audio_key"] == "new_key.mp3"

    @pytest.mark.asyncio
    async def test_removed_example_loses_audio_key(
        self, db_session: AsyncSession, sample_deck: Deck
    ):
        """Test that an example not included in the upsert is replaced (not preserved)."""
        repo = WordEntryRepository(db_session)

        # Create a WordEntry with two examples, each with an audio_key
        existing_entry = WordEntry(
            deck_id=sample_deck.id,
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="house",
            examples=[
                {"id": "ex1", "greek": "Το σπίτι είναι μεγάλο.", "audio_key": "audio/ex1.mp3"},
                {"id": "ex2", "greek": "Το σπίτι μου.", "audio_key": "audio/ex2.mp3"},
            ],
        )
        db_session.add(existing_entry)
        await db_session.commit()

        # Upsert with only ex1 (ex2 is omitted)
        entries_data = [
            {
                "lemma": "σπίτι",
                "part_of_speech": PartOfSpeech.NOUN,
                "translation_en": "house",
                "examples": [{"id": "ex1", "greek": "Το σπίτι είναι μεγάλο."}],
            }
        ]

        entries, _, _ = await repo.bulk_upsert(sample_deck.id, entries_data)
        await db_session.commit()

        assert len(entries) == 1
        assert len(entries[0].examples) == 1
        assert entries[0].examples[0]["id"] == "ex1"
        assert entries[0].examples[0]["audio_key"] == "audio/ex1.mp3"
