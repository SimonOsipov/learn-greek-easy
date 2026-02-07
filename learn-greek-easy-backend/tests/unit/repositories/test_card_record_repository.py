"""Unit tests for CardRecordRepository.

This module tests:
- get: Retrieve card record by ID (inherited from BaseRepository)
- get_by_word_entry: Get all records for a word entry
- get_by_deck: Get records for a deck with filters (card_type, is_active, pagination)
- count_by_deck: Count records in a deck with filters
- bulk_upsert: Create/update records with ON CONFLICT handling
- deactivate_by_word_entry: Soft-delete records by word entry
- Unique constraint: (word_entry_id, card_type, variant_key)

Tests use real database fixtures to verify SQL queries work correctly.
"""

from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    CardRecord,
    CardSystemVersion,
    CardType,
    Deck,
    DeckLevel,
    PartOfSpeech,
    WordEntry,
)
from src.repositories.card_record import CardRecordRepository

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def v2_deck(db_session: AsyncSession) -> Deck:
    """Create a V2 deck for card record testing."""
    deck = Deck(
        name_en="Test V2 Deck",
        name_el="Τεστ Deck",
        name_ru="Тест Deck",
        description_en="test",
        description_el="test",
        description_ru="test",
        level=DeckLevel.A1,
        card_system=CardSystemVersion.V2,
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def second_deck(db_session: AsyncSession) -> Deck:
    """Create a second V2 deck for isolation testing."""
    deck = Deck(
        name_en="Second V2 Deck",
        name_el="Δεύτερο Deck",
        name_ru="Второй Deck",
        description_en="second",
        description_el="second",
        description_ru="second",
        level=DeckLevel.A2,
        card_system=CardSystemVersion.V2,
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def word_entry(db_session: AsyncSession, v2_deck: Deck) -> WordEntry:
    """Create a word entry for card record testing."""
    entry = WordEntry(
        deck_id=v2_deck.id,
        lemma="σπίτι",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="house",
        is_active=True,
    )
    db_session.add(entry)
    await db_session.flush()
    await db_session.refresh(entry)
    return entry


@pytest.fixture
async def second_word_entry(db_session: AsyncSession, v2_deck: Deck) -> WordEntry:
    """Create a second word entry for testing multi-entry scenarios."""
    entry = WordEntry(
        deck_id=v2_deck.id,
        lemma="τρέχω",
        part_of_speech=PartOfSpeech.VERB,
        translation_en="to run",
        is_active=True,
    )
    db_session.add(entry)
    await db_session.flush()
    await db_session.refresh(entry)
    return entry


# =============================================================================
# Test get (inherited from BaseRepository)
# =============================================================================


class TestCardRecordRepositoryGet:
    """Tests for get() and get_by_word_entry() methods."""

    @pytest.mark.asyncio
    async def test_get_by_id_returns_record(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        word_entry: WordEntry,
    ):
        """Should return a card record when given a valid ID."""
        record = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Translate",
                "main": "σπίτι",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "house"},
        )
        db_session.add(record)
        await db_session.flush()
        await db_session.refresh(record)

        repo = CardRecordRepository(db_session)
        result = await repo.get(record.id)

        assert result is not None
        assert result.id == record.id
        assert result.word_entry_id == word_entry.id
        assert result.deck_id == v2_deck.id
        assert result.card_type == CardType.MEANING_EL_TO_EN
        assert result.variant_key == "default"
        assert result.is_active is True

    @pytest.mark.asyncio
    async def test_get_by_id_returns_none_for_nonexistent(
        self,
        db_session: AsyncSession,
    ):
        """Should return None for a random UUID that does not exist."""
        repo = CardRecordRepository(db_session)
        result = await repo.get(uuid4())
        assert result is None

    @pytest.mark.asyncio
    async def test_get_by_word_entry_returns_records(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        word_entry: WordEntry,
    ):
        """Should return all records for a given word entry."""
        record1 = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Translate",
                "main": "σπίτι",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "house"},
        )
        record2 = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EN_TO_EL,
            variant_key="default",
            front_content={
                "card_type": "meaning_en_to_el",
                "prompt": "Say in Greek",
                "main": "house",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_en_to_el", "answer": "σπίτι"},
        )
        db_session.add_all([record1, record2])
        await db_session.flush()

        repo = CardRecordRepository(db_session)
        results = await repo.get_by_word_entry(word_entry.id)

        assert len(results) == 2

    @pytest.mark.asyncio
    async def test_get_by_word_entry_returns_empty_for_nonexistent(
        self,
        db_session: AsyncSession,
    ):
        """Should return empty list for a nonexistent word entry ID."""
        repo = CardRecordRepository(db_session)
        results = await repo.get_by_word_entry(uuid4())
        assert results == []

    @pytest.mark.asyncio
    async def test_get_by_word_entry_filters_by_word_entry(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        word_entry: WordEntry,
        second_word_entry: WordEntry,
    ):
        """Records for word_entry_A should not be returned when querying word_entry_B."""
        record_a = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Translate",
                "main": "σπίτι",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "house"},
        )
        record_b = CardRecord(
            word_entry_id=second_word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Translate",
                "main": "τρέχω",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "to run"},
        )
        db_session.add_all([record_a, record_b])
        await db_session.flush()

        repo = CardRecordRepository(db_session)
        results = await repo.get_by_word_entry(word_entry.id)

        assert len(results) == 1
        assert results[0].word_entry_id == word_entry.id


# =============================================================================
# Test get_by_deck
# =============================================================================


class TestCardRecordRepositoryGetByDeck:
    """Tests for get_by_deck() with filters."""

    @pytest.mark.asyncio
    async def test_get_by_deck_returns_all_records(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        word_entry: WordEntry,
    ):
        """Should return all records in a deck."""
        record1 = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Translate",
                "main": "σπίτι",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "house"},
        )
        record2 = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EN_TO_EL,
            variant_key="default",
            front_content={
                "card_type": "meaning_en_to_el",
                "prompt": "Say in Greek",
                "main": "house",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_en_to_el", "answer": "σπίτι"},
        )
        db_session.add_all([record1, record2])
        await db_session.flush()

        repo = CardRecordRepository(db_session)
        results = await repo.get_by_deck(v2_deck.id)

        assert len(results) == 2

    @pytest.mark.asyncio
    async def test_get_by_deck_active_only(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        word_entry: WordEntry,
    ):
        """Should return only active records when is_active=True."""
        active_record = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            is_active=True,
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Translate",
                "main": "σπίτι",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "house"},
        )
        inactive_record = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EN_TO_EL,
            variant_key="default",
            is_active=False,
            front_content={
                "card_type": "meaning_en_to_el",
                "prompt": "Say in Greek",
                "main": "house",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_en_to_el", "answer": "σπίτι"},
        )
        db_session.add_all([active_record, inactive_record])
        await db_session.flush()

        repo = CardRecordRepository(db_session)
        results = await repo.get_by_deck(v2_deck.id, is_active=True)

        assert len(results) == 1
        assert results[0].is_active is True

    @pytest.mark.asyncio
    async def test_get_by_deck_with_card_type_filter(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        word_entry: WordEntry,
    ):
        """Should filter records by card_type."""
        meaning_record = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Translate",
                "main": "σπίτι",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "house"},
        )
        cloze_record = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.CLOZE,
            variant_key="ex_1",
            front_content={
                "card_type": "cloze",
                "prompt": "Fill in",
                "main": "Αυτό είναι ___",
                "badge": "A1",
                "missing_word": "σπίτι",
                "example_index": 0,
            },
            back_content={
                "card_type": "cloze",
                "answer": "σπίτι",
                "full_sentence": {"greek": "Αυτό είναι σπίτι", "english": "This is a house"},
            },
        )
        db_session.add_all([meaning_record, cloze_record])
        await db_session.flush()

        repo = CardRecordRepository(db_session)
        results = await repo.get_by_deck(v2_deck.id, card_type=CardType.CLOZE)

        assert len(results) == 1
        assert results[0].card_type == CardType.CLOZE

    @pytest.mark.asyncio
    async def test_get_by_deck_with_pagination(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        word_entry: WordEntry,
        second_word_entry: WordEntry,
    ):
        """Should respect skip and limit for pagination."""
        records = []
        for i, ct in enumerate(
            [
                CardType.MEANING_EL_TO_EN,
                CardType.MEANING_EN_TO_EL,
                CardType.CLOZE,
                CardType.SENTENCE_TRANSLATION,
            ]
        ):
            we = word_entry if i < 2 else second_word_entry
            records.append(
                CardRecord(
                    word_entry_id=we.id,
                    deck_id=v2_deck.id,
                    card_type=ct,
                    variant_key="default",
                    front_content={
                        "card_type": ct.value,
                        "prompt": "Test",
                        "main": "test",
                        "badge": "A1",
                    },
                    back_content={"card_type": ct.value, "answer": "test"},
                )
            )
        db_session.add_all(records)
        await db_session.flush()

        repo = CardRecordRepository(db_session)
        results = await repo.get_by_deck(v2_deck.id, skip=1, limit=2)

        assert len(results) == 2

    @pytest.mark.asyncio
    async def test_get_by_deck_returns_empty_for_other_deck(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        second_deck: Deck,
        word_entry: WordEntry,
    ):
        """Records in one deck should not be returned when querying another deck."""
        record = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Translate",
                "main": "σπίτι",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "house"},
        )
        db_session.add(record)
        await db_session.flush()

        repo = CardRecordRepository(db_session)
        results = await repo.get_by_deck(second_deck.id)

        assert results == []


# =============================================================================
# Test count_by_deck
# =============================================================================


class TestCardRecordRepositoryCountByDeck:
    """Tests for count_by_deck() method."""

    @pytest.mark.asyncio
    async def test_count_by_deck(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        word_entry: WordEntry,
    ):
        """Should return correct count of records in a deck."""
        record1 = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Translate",
                "main": "σπίτι",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "house"},
        )
        record2 = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EN_TO_EL,
            variant_key="default",
            front_content={
                "card_type": "meaning_en_to_el",
                "prompt": "Say in Greek",
                "main": "house",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_en_to_el", "answer": "σπίτι"},
        )
        db_session.add_all([record1, record2])
        await db_session.flush()

        repo = CardRecordRepository(db_session)
        count = await repo.count_by_deck(v2_deck.id)

        assert count == 2

    @pytest.mark.asyncio
    async def test_count_by_deck_active_only(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        word_entry: WordEntry,
    ):
        """Should count only active records when is_active=True."""
        active = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            is_active=True,
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Translate",
                "main": "σπίτι",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "house"},
        )
        inactive = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EN_TO_EL,
            variant_key="default",
            is_active=False,
            front_content={
                "card_type": "meaning_en_to_el",
                "prompt": "Say in Greek",
                "main": "house",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_en_to_el", "answer": "σπίτι"},
        )
        db_session.add_all([active, inactive])
        await db_session.flush()

        repo = CardRecordRepository(db_session)
        count = await repo.count_by_deck(v2_deck.id, is_active=True)

        assert count == 1

    @pytest.mark.asyncio
    async def test_count_by_deck_empty(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
    ):
        """Should return 0 for a deck with no records."""
        repo = CardRecordRepository(db_session)
        count = await repo.count_by_deck(v2_deck.id)

        assert count == 0


# =============================================================================
# Test bulk_upsert
# =============================================================================


class TestCardRecordRepositoryBulkUpsert:
    """Tests for bulk_upsert() method.

    bulk_upsert uses PostgreSQL ON CONFLICT (word_entry_id, card_type, variant_key)
    DO UPDATE. Returns (records, created_count, updated_count).
    Does NOT commit -- caller must commit.
    """

    @pytest.mark.asyncio
    async def test_bulk_upsert_create_new(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        word_entry: WordEntry,
    ):
        """Should create new records and return created_count > 0, updated_count == 0."""
        repo = CardRecordRepository(db_session)

        records_data = [
            {
                "word_entry_id": word_entry.id,
                "deck_id": v2_deck.id,
                "card_type": CardType.MEANING_EL_TO_EN,
                "variant_key": "default",
                "front_content": {
                    "card_type": "meaning_el_to_en",
                    "prompt": "Translate",
                    "main": "σπίτι",
                    "badge": "A1",
                },
                "back_content": {"card_type": "meaning_el_to_en", "answer": "house"},
            },
            {
                "word_entry_id": word_entry.id,
                "deck_id": v2_deck.id,
                "card_type": CardType.MEANING_EN_TO_EL,
                "variant_key": "default",
                "front_content": {
                    "card_type": "meaning_en_to_el",
                    "prompt": "Say in Greek",
                    "main": "house",
                    "badge": "A1",
                },
                "back_content": {"card_type": "meaning_en_to_el", "answer": "σπίτι"},
            },
        ]

        records, created, updated = await repo.bulk_upsert(records_data)
        await db_session.commit()

        assert len(records) == 2
        assert created == 2
        assert updated == 0

    @pytest.mark.asyncio
    async def test_bulk_upsert_update_existing(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        word_entry: WordEntry,
    ):
        """Should update existing records matching (word_entry_id, card_type, variant_key)."""
        # First, create the record
        original = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Translate",
                "main": "σπίτι",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "house"},
        )
        db_session.add(original)
        await db_session.commit()

        repo = CardRecordRepository(db_session)

        # Upsert with same constraint key but different content
        records_data = [
            {
                "word_entry_id": word_entry.id,
                "deck_id": v2_deck.id,
                "card_type": CardType.MEANING_EL_TO_EN,
                "variant_key": "default",
                "front_content": {
                    "card_type": "meaning_el_to_en",
                    "prompt": "Translate",
                    "main": "σπίτι",
                    "badge": "A1",
                },
                "back_content": {"card_type": "meaning_el_to_en", "answer": "house, home"},
            },
        ]

        records, created, updated = await repo.bulk_upsert(records_data)
        await db_session.commit()

        assert len(records) == 1
        assert created == 0
        assert updated == 1
        assert records[0].back_content["answer"] == "house, home"

    @pytest.mark.asyncio
    async def test_bulk_upsert_mixed_create_and_update(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        word_entry: WordEntry,
    ):
        """Should handle a mix of new and existing records in one call."""
        # Create existing record
        existing = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Translate",
                "main": "σπίτι",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "house"},
        )
        db_session.add(existing)
        await db_session.commit()

        repo = CardRecordRepository(db_session)

        records_data = [
            # Update existing
            {
                "word_entry_id": word_entry.id,
                "deck_id": v2_deck.id,
                "card_type": CardType.MEANING_EL_TO_EN,
                "variant_key": "default",
                "front_content": {
                    "card_type": "meaning_el_to_en",
                    "prompt": "Translate",
                    "main": "σπίτι",
                    "badge": "A1",
                },
                "back_content": {"card_type": "meaning_el_to_en", "answer": "house, home"},
            },
            # Create new
            {
                "word_entry_id": word_entry.id,
                "deck_id": v2_deck.id,
                "card_type": CardType.MEANING_EN_TO_EL,
                "variant_key": "default",
                "front_content": {
                    "card_type": "meaning_en_to_el",
                    "prompt": "Say in Greek",
                    "main": "house",
                    "badge": "A1",
                },
                "back_content": {"card_type": "meaning_en_to_el", "answer": "σπίτι"},
            },
        ]

        records, created, updated = await repo.bulk_upsert(records_data)
        await db_session.commit()

        assert len(records) == 2
        assert created == 1
        assert updated == 1

    @pytest.mark.asyncio
    async def test_bulk_upsert_different_variant_key_creates_new(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        word_entry: WordEntry,
    ):
        """Same (word_entry_id, card_type) but different variant_key should create a new record."""
        # Create existing with variant_key="present_1s"
        existing = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.CONJUGATION,
            variant_key="present_1s",
            front_content={
                "card_type": "conjugation",
                "prompt": "Conjugate",
                "main": "τρέχω",
                "badge": "A1",
                "tense": "present",
                "person": "1s",
            },
            back_content={
                "card_type": "conjugation",
                "answer": "τρέχω",
                "conjugation_table": {"tense": "present", "rows": []},
            },
        )
        db_session.add(existing)
        await db_session.commit()

        repo = CardRecordRepository(db_session)

        records_data = [
            # Different variant_key => new record
            {
                "word_entry_id": word_entry.id,
                "deck_id": v2_deck.id,
                "card_type": CardType.CONJUGATION,
                "variant_key": "present_2s",
                "front_content": {
                    "card_type": "conjugation",
                    "prompt": "Conjugate",
                    "main": "τρέχω",
                    "badge": "A1",
                    "tense": "present",
                    "person": "2s",
                },
                "back_content": {
                    "card_type": "conjugation",
                    "answer": "τρέχεις",
                    "conjugation_table": {"tense": "present", "rows": []},
                },
            },
        ]

        records, created, updated = await repo.bulk_upsert(records_data)
        await db_session.commit()

        assert created == 1
        assert updated == 0

    @pytest.mark.asyncio
    async def test_bulk_upsert_empty_list(
        self,
        db_session: AsyncSession,
    ):
        """Empty input should return ([], 0, 0)."""
        repo = CardRecordRepository(db_session)

        records, created, updated = await repo.bulk_upsert([])

        assert records == []
        assert created == 0
        assert updated == 0

    @pytest.mark.asyncio
    async def test_bulk_upsert_updates_content_on_conflict(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        word_entry: WordEntry,
    ):
        """Should actually change front_content and back_content on conflict."""
        original = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Translate",
                "main": "σπίτι",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "house"},
        )
        db_session.add(original)
        await db_session.commit()
        original_id = original.id

        repo = CardRecordRepository(db_session)

        new_front = {
            "card_type": "meaning_el_to_en",
            "prompt": "What does this mean?",
            "main": "σπίτι",
            "badge": "A1",
        }
        new_back = {"card_type": "meaning_el_to_en", "answer": "house, home, dwelling"}

        records_data = [
            {
                "word_entry_id": word_entry.id,
                "deck_id": v2_deck.id,
                "card_type": CardType.MEANING_EL_TO_EN,
                "variant_key": "default",
                "front_content": new_front,
                "back_content": new_back,
            },
        ]

        records, created, updated = await repo.bulk_upsert(records_data)
        await db_session.commit()

        # Refresh to get the latest data
        await db_session.refresh(original)

        assert original.front_content["prompt"] == "What does this mean?"
        assert original.back_content["answer"] == "house, home, dwelling"
        assert original.id == original_id  # Same record was updated, not a new one

    @pytest.mark.asyncio
    async def test_bulk_upsert_updates_timestamp(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        word_entry: WordEntry,
    ):
        """Should update updated_at when upserting existing records."""
        original = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Translate",
                "main": "σπίτι",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "house"},
        )
        db_session.add(original)
        await db_session.commit()
        await db_session.refresh(original)
        original_updated_at = original.updated_at

        repo = CardRecordRepository(db_session)

        records_data = [
            {
                "word_entry_id": word_entry.id,
                "deck_id": v2_deck.id,
                "card_type": CardType.MEANING_EL_TO_EN,
                "variant_key": "default",
                "front_content": {
                    "card_type": "meaning_el_to_en",
                    "prompt": "New prompt",
                    "main": "σπίτι",
                    "badge": "A1",
                },
                "back_content": {"card_type": "meaning_el_to_en", "answer": "house, home"},
            },
        ]

        await repo.bulk_upsert(records_data)
        await db_session.commit()
        await db_session.refresh(original)

        assert original.updated_at >= original_updated_at


# =============================================================================
# Test deactivate_by_word_entry
# =============================================================================


class TestCardRecordRepositoryDeactivate:
    """Tests for deactivate_by_word_entry() method."""

    @pytest.mark.asyncio
    async def test_deactivate_by_word_entry(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        word_entry: WordEntry,
    ):
        """Should set is_active=False for all active records of the word entry."""
        record1 = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            is_active=True,
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Translate",
                "main": "σπίτι",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "house"},
        )
        record2 = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EN_TO_EL,
            variant_key="default",
            is_active=True,
            front_content={
                "card_type": "meaning_en_to_el",
                "prompt": "Say in Greek",
                "main": "house",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_en_to_el", "answer": "σπίτι"},
        )
        db_session.add_all([record1, record2])
        await db_session.flush()

        repo = CardRecordRepository(db_session)
        count = await repo.deactivate_by_word_entry(word_entry.id)
        await db_session.commit()

        await db_session.refresh(record1)
        await db_session.refresh(record2)

        assert count == 2
        assert record1.is_active is False
        assert record2.is_active is False

    @pytest.mark.asyncio
    async def test_deactivate_by_word_entry_only_affects_target(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        word_entry: WordEntry,
        second_word_entry: WordEntry,
    ):
        """Should not deactivate records belonging to other word entries."""
        target_record = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            is_active=True,
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Translate",
                "main": "σπίτι",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "house"},
        )
        other_record = CardRecord(
            word_entry_id=second_word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            is_active=True,
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Translate",
                "main": "τρέχω",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "to run"},
        )
        db_session.add_all([target_record, other_record])
        await db_session.flush()

        repo = CardRecordRepository(db_session)
        await repo.deactivate_by_word_entry(word_entry.id)
        await db_session.commit()

        await db_session.refresh(target_record)
        await db_session.refresh(other_record)

        assert target_record.is_active is False
        assert other_record.is_active is True

    @pytest.mark.asyncio
    async def test_deactivate_by_word_entry_returns_count(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        word_entry: WordEntry,
    ):
        """Should return the number of deactivated records."""
        for i, ct in enumerate(
            [CardType.MEANING_EL_TO_EN, CardType.MEANING_EN_TO_EL, CardType.CLOZE]
        ):
            record = CardRecord(
                word_entry_id=word_entry.id,
                deck_id=v2_deck.id,
                card_type=ct,
                variant_key="default",
                is_active=True,
                front_content={
                    "card_type": ct.value,
                    "prompt": "Test",
                    "main": "test",
                    "badge": "A1",
                },
                back_content={"card_type": ct.value, "answer": "test"},
            )
            db_session.add(record)
        await db_session.flush()

        repo = CardRecordRepository(db_session)
        count = await repo.deactivate_by_word_entry(word_entry.id)

        assert count == 3

    @pytest.mark.asyncio
    async def test_deactivate_by_word_entry_skips_already_inactive(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        word_entry: WordEntry,
    ):
        """Already inactive records should not be counted."""
        active_record = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            is_active=True,
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Translate",
                "main": "σπίτι",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "house"},
        )
        inactive_record = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EN_TO_EL,
            variant_key="default",
            is_active=False,
            front_content={
                "card_type": "meaning_en_to_el",
                "prompt": "Say in Greek",
                "main": "house",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_en_to_el", "answer": "σπίτι"},
        )
        db_session.add_all([active_record, inactive_record])
        await db_session.flush()

        repo = CardRecordRepository(db_session)
        count = await repo.deactivate_by_word_entry(word_entry.id)

        assert count == 1

    @pytest.mark.asyncio
    async def test_deactivate_by_word_entry_returns_zero_for_no_records(
        self,
        db_session: AsyncSession,
    ):
        """Should return 0 when no records match the word entry ID."""
        repo = CardRecordRepository(db_session)
        count = await repo.deactivate_by_word_entry(uuid4())

        assert count == 0


# =============================================================================
# Test unique constraint (word_entry_id, card_type, variant_key)
# =============================================================================


class TestCardRecordUniqueConstraint:
    """Tests for the uq_card_record_entry_type_variant constraint."""

    @pytest.mark.asyncio
    async def test_duplicate_raises_integrity_error(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        word_entry: WordEntry,
    ):
        """Inserting duplicate (word_entry_id, card_type, variant_key) raises IntegrityError."""
        record1 = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Translate",
                "main": "σπίτι",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "house"},
        )
        db_session.add(record1)
        await db_session.flush()

        record2 = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",  # same constraint columns
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Other prompt",
                "main": "σπίτι",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "house, home"},
        )
        db_session.add(record2)

        with pytest.raises(IntegrityError):
            await db_session.flush()

        await db_session.rollback()

    @pytest.mark.asyncio
    async def test_different_variant_key_succeeds(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        word_entry: WordEntry,
    ):
        """Same (word_entry_id, card_type) with different variant_key should succeed."""
        record1 = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.CONJUGATION,
            variant_key="present_1s",
            front_content={
                "card_type": "conjugation",
                "prompt": "Conjugate",
                "main": "γράφω",
                "badge": "B1",
                "tense": "present",
                "person": "1s",
            },
            back_content={
                "card_type": "conjugation",
                "answer": "γράφω",
                "conjugation_table": {"tense": "present", "rows": []},
            },
        )
        record2 = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.CONJUGATION,
            variant_key="present_2s",  # different variant_key
            front_content={
                "card_type": "conjugation",
                "prompt": "Conjugate",
                "main": "γράφω",
                "badge": "B1",
                "tense": "present",
                "person": "2s",
            },
            back_content={
                "card_type": "conjugation",
                "answer": "γράφεις",
                "conjugation_table": {"tense": "present", "rows": []},
            },
        )
        db_session.add_all([record1, record2])
        await db_session.flush()

        # Both should exist
        await db_session.refresh(record1)
        await db_session.refresh(record2)
        assert record1.id is not None
        assert record2.id is not None
        assert record1.id != record2.id

    @pytest.mark.asyncio
    async def test_different_card_type_succeeds(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        word_entry: WordEntry,
    ):
        """Same (word_entry_id, variant_key) with different card_type should succeed."""
        record1 = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Translate",
                "main": "σπίτι",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "house"},
        )
        record2 = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EN_TO_EL,  # different card_type
            variant_key="default",
            front_content={
                "card_type": "meaning_en_to_el",
                "prompt": "Say in Greek",
                "main": "house",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_en_to_el", "answer": "σπίτι"},
        )
        db_session.add_all([record1, record2])
        await db_session.flush()

        await db_session.refresh(record1)
        await db_session.refresh(record2)
        assert record1.id is not None
        assert record2.id is not None
        assert record1.id != record2.id

    @pytest.mark.asyncio
    async def test_tier_not_in_constraint(
        self,
        db_session: AsyncSession,
        v2_deck: Deck,
        word_entry: WordEntry,
    ):
        """Same (word_entry_id, card_type, variant_key) with different tier should still conflict."""
        record1 = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            tier=1,
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Translate",
                "main": "σπίτι",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "house"},
        )
        db_session.add(record1)
        await db_session.flush()

        record2 = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            tier=2,  # different tier, but tier is NOT in the unique constraint
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Other",
                "main": "σπίτι",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "house"},
        )
        db_session.add(record2)

        with pytest.raises(IntegrityError):
            await db_session.flush()

        await db_session.rollback()
