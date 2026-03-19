"""Unit tests for CardRecordStatisticsRepository."""

from datetime import date, timedelta

import pytest
import pytest_asyncio
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    CardRecord,
    CardRecordStatistics,
    CardStatus,
    CardType,
    Deck,
    DeckLevel,
    DeckWordEntry,
    PartOfSpeech,
    User,
    WordEntry,
)
from src.repositories.card_record_statistics import CardRecordStatisticsRepository


@pytest_asyncio.fixture
async def v2_deck(db_session: AsyncSession) -> Deck:
    deck = Deck(
        name_en="Test V2 Deck",
        name_el="Τεστ Deck",
        name_ru="Тест Deck",
        description_en="test",
        description_el="test",
        description_ru="test",
        level=DeckLevel.A1,
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest_asyncio.fixture
async def word_entry(db_session: AsyncSession, v2_deck: Deck) -> WordEntry:
    entry = WordEntry(
        owner_id=None,
        lemma="σπίτι",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="house",
        is_active=True,
    )
    db_session.add(entry)
    await db_session.flush()
    db_session.add(DeckWordEntry(deck_id=v2_deck.id, word_entry_id=entry.id))
    await db_session.flush()
    await db_session.refresh(entry)
    return entry


@pytest_asyncio.fixture
async def card_record(db_session: AsyncSession, v2_deck: Deck, word_entry: WordEntry) -> CardRecord:
    record = CardRecord(
        word_entry_id=word_entry.id,
        deck_id=v2_deck.id,
        card_type=CardType.MEANING_EL_TO_EN,
        variant_key="default",
        front_content={"card_type": "meaning_el_to_en", "prompt": "Translate", "main": "σπίτι"},
        back_content={"card_type": "meaning_el_to_en", "answer": "house"},
    )
    db_session.add(record)
    await db_session.flush()
    await db_session.refresh(record)
    return record


@pytest_asyncio.fixture
async def second_card_record(
    db_session: AsyncSession, v2_deck: Deck, word_entry: WordEntry
) -> CardRecord:
    record = CardRecord(
        word_entry_id=word_entry.id,
        deck_id=v2_deck.id,
        card_type=CardType.MEANING_EN_TO_EL,
        variant_key="default",
        front_content={"card_type": "meaning_en_to_el", "prompt": "Translate", "main": "house"},
        back_content={"card_type": "meaning_en_to_el", "answer": "σπίτι"},
    )
    db_session.add(record)
    await db_session.flush()
    await db_session.refresh(record)
    return record


class TestGetOrCreate:
    @pytest.mark.asyncio
    async def test_get_or_create_creates_with_defaults(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
    ) -> None:
        repo = CardRecordStatisticsRepository(db_session)
        stats = await repo.get_or_create(test_user.id, card_record.id)

        assert stats.user_id == test_user.id
        assert stats.card_record_id == card_record.id
        assert stats.easiness_factor == 2.5
        assert stats.interval == 0
        assert stats.repetitions == 0
        assert stats.status == CardStatus.NEW
        assert stats.next_review_date == date.today()

    @pytest.mark.asyncio
    async def test_get_or_create_returns_existing(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
    ) -> None:
        repo = CardRecordStatisticsRepository(db_session)
        first = await repo.get_or_create(test_user.id, card_record.id)
        second = await repo.get_or_create(test_user.id, card_record.id)

        assert first.id == second.id


class TestGetDueCards:
    @pytest.mark.asyncio
    async def test_get_due_cards_returns_due(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
    ) -> None:
        stats = CardRecordStatistics(
            user_id=test_user.id,
            card_record_id=card_record.id,
            easiness_factor=2.5,
            interval=0,
            repetitions=0,
            next_review_date=date.today(),
            status=CardStatus.NEW,
        )
        db_session.add(stats)
        await db_session.flush()

        repo = CardRecordStatisticsRepository(db_session)
        due = await repo.get_due_cards(test_user.id)

        assert len(due) == 1
        assert due[0].id == stats.id

    @pytest.mark.asyncio
    async def test_get_due_cards_excludes_future(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
    ) -> None:
        stats = CardRecordStatistics(
            user_id=test_user.id,
            card_record_id=card_record.id,
            easiness_factor=2.5,
            interval=5,
            repetitions=1,
            next_review_date=date.today() + timedelta(days=3),
            status=CardStatus.REVIEW,
        )
        db_session.add(stats)
        await db_session.flush()

        repo = CardRecordStatisticsRepository(db_session)
        due = await repo.get_due_cards(test_user.id)

        assert len(due) == 0

    @pytest.mark.asyncio
    async def test_get_due_cards_filters_inactive_cards(
        self,
        db_session: AsyncSession,
        test_user: User,
        v2_deck: Deck,
        word_entry: WordEntry,
    ) -> None:
        inactive_record = CardRecord(
            word_entry_id=word_entry.id,
            deck_id=v2_deck.id,
            card_type=CardType.CLOZE,
            variant_key="default",
            front_content={"card_type": "cloze", "prompt": "Fill"},
            back_content={"card_type": "cloze", "answer": "σπίτι"},
            is_active=False,
        )
        db_session.add(inactive_record)
        await db_session.flush()

        stats = CardRecordStatistics(
            user_id=test_user.id,
            card_record_id=inactive_record.id,
            easiness_factor=2.5,
            interval=0,
            repetitions=0,
            next_review_date=date.today(),
            status=CardStatus.NEW,
        )
        db_session.add(stats)
        await db_session.flush()

        repo = CardRecordStatisticsRepository(db_session)
        due = await repo.get_due_cards(test_user.id)

        assert len(due) == 0


class TestUpdateSm2Data:
    @pytest.mark.asyncio
    async def test_update_sm2_data(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
    ) -> None:
        repo = CardRecordStatisticsRepository(db_session)
        stats = await repo.get_or_create(test_user.id, card_record.id)

        new_date = date.today() + timedelta(days=6)
        updated = await repo.update_sm2_data(
            stats_id=stats.id,
            easiness_factor=2.6,
            interval=6,
            repetitions=3,
            next_review_date=new_date,
            status=CardStatus.REVIEW,
        )

        assert updated.easiness_factor == 2.6
        assert updated.interval == 6
        assert updated.repetitions == 3
        assert updated.next_review_date == new_date
        assert updated.status == CardStatus.REVIEW


class TestCountByStatus:
    @pytest.mark.asyncio
    async def test_count_by_status(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
        second_card_record: CardRecord,
    ) -> None:
        stats_new = CardRecordStatistics(
            user_id=test_user.id,
            card_record_id=card_record.id,
            easiness_factor=2.5,
            interval=0,
            repetitions=0,
            next_review_date=date.today(),
            status=CardStatus.NEW,
        )
        stats_learning = CardRecordStatistics(
            user_id=test_user.id,
            card_record_id=second_card_record.id,
            easiness_factor=2.5,
            interval=1,
            repetitions=1,
            next_review_date=date.today() + timedelta(days=5),
            status=CardStatus.LEARNING,
        )
        db_session.add_all([stats_new, stats_learning])
        await db_session.flush()

        repo = CardRecordStatisticsRepository(db_session)
        counts = await repo.count_by_status(test_user.id)

        assert counts["new"] == 1
        assert counts["learning"] == 1
        assert counts["review"] == 0
        assert counts["mastered"] == 0
        assert counts["due"] == 1


class TestDeleteAllByUserId:
    @pytest.mark.asyncio
    async def test_delete_all_by_user_id(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
        second_card_record: CardRecord,
    ) -> None:
        repo = CardRecordStatisticsRepository(db_session)
        await repo.get_or_create(test_user.id, card_record.id)
        await repo.get_or_create(test_user.id, second_card_record.id)

        deleted = await repo.delete_all_by_user_id(test_user.id)

        assert deleted == 2
        counts = await repo.count_by_status(test_user.id)
        assert counts["new"] == 0


class TestUniqueConstraint:
    @pytest.mark.asyncio
    async def test_unique_constraint_violation(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
    ) -> None:
        stats1 = CardRecordStatistics(
            user_id=test_user.id,
            card_record_id=card_record.id,
            easiness_factor=2.5,
            interval=0,
            repetitions=0,
            next_review_date=date.today(),
            status=CardStatus.NEW,
        )
        db_session.add(stats1)
        await db_session.flush()

        stats2 = CardRecordStatistics(
            user_id=test_user.id,
            card_record_id=card_record.id,
            easiness_factor=2.5,
            interval=0,
            repetitions=0,
            next_review_date=date.today(),
            status=CardStatus.NEW,
        )
        db_session.add(stats2)

        with pytest.raises(IntegrityError):
            await db_session.flush()

        await db_session.rollback()
