"""Unit tests for CardRecordReviewRepository."""

from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    CardRecord,
    CardRecordReview,
    CardType,
    Deck,
    DeckLevel,
    DeckWordEntry,
    PartOfSpeech,
    User,
    WordEntry,
)
from src.repositories.card_record_review import CardRecordReviewRepository


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


def _make_review(
    user_id,
    card_record_id,
    *,
    quality: int = 3,
    time_taken: int = 5,
    reviewed_at: datetime,
) -> CardRecordReview:
    return CardRecordReview(
        user_id=user_id,
        card_record_id=card_record_id,
        quality=quality,
        time_taken=time_taken,
        reviewed_at=reviewed_at,
    )


class TestCountReviewsToday:
    @pytest.mark.asyncio
    async def test_count_reviews_today_returns_count(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
    ) -> None:
        now = datetime.now(tz=timezone.utc)
        for _ in range(3):
            db_session.add(_make_review(test_user.id, card_record.id, reviewed_at=now))
        await db_session.flush()

        repo = CardRecordReviewRepository(db_session)
        count = await repo.count_reviews_today(test_user.id)

        assert count == 3

    @pytest.mark.asyncio
    async def test_count_reviews_today_excludes_yesterday(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
    ) -> None:
        yesterday = datetime.now(tz=timezone.utc) - timedelta(days=1)
        db_session.add(_make_review(test_user.id, card_record.id, reviewed_at=yesterday))
        await db_session.flush()

        repo = CardRecordReviewRepository(db_session)
        count = await repo.count_reviews_today(test_user.id)

        assert count == 0


class TestGetStreak:
    @pytest.mark.asyncio
    async def test_get_streak_consecutive_days(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
    ) -> None:
        now = datetime.now(tz=timezone.utc)
        for days_ago in range(3):
            db_session.add(
                _make_review(
                    test_user.id,
                    card_record.id,
                    reviewed_at=now - timedelta(days=days_ago),
                )
            )
        await db_session.flush()

        repo = CardRecordReviewRepository(db_session)
        streak = await repo.get_streak(test_user.id)

        assert streak == 3

    @pytest.mark.asyncio
    async def test_get_streak_broken(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
    ) -> None:
        now = datetime.now(tz=timezone.utc)
        for days_ago in [2, 3]:
            db_session.add(
                _make_review(
                    test_user.id,
                    card_record.id,
                    reviewed_at=now - timedelta(days=days_ago),
                )
            )
        await db_session.flush()

        repo = CardRecordReviewRepository(db_session)
        streak = await repo.get_streak(test_user.id)

        assert streak == 0

    @pytest.mark.asyncio
    async def test_get_streak_no_reviews(
        self,
        db_session: AsyncSession,
        test_user: User,
    ) -> None:
        repo = CardRecordReviewRepository(db_session)
        streak = await repo.get_streak(test_user.id)

        assert streak == 0


class TestDeleteAllByUserId:
    @pytest.mark.asyncio
    async def test_delete_all_by_user_id(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
    ) -> None:
        now = datetime.now(tz=timezone.utc)
        for _ in range(3):
            db_session.add(_make_review(test_user.id, card_record.id, reviewed_at=now))
        await db_session.flush()

        repo = CardRecordReviewRepository(db_session)
        deleted = await repo.delete_all_by_user_id(test_user.id)

        assert deleted == 3
        count = await repo.count_reviews_today(test_user.id)
        assert count == 0


class TestCheckConstraint:
    @pytest.mark.asyncio
    async def test_check_constraint_rejects_quality_below_0(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
    ) -> None:
        review = _make_review(
            test_user.id,
            card_record.id,
            quality=-1,
            reviewed_at=datetime.now(tz=timezone.utc),
        )
        db_session.add(review)

        with pytest.raises(IntegrityError):
            await db_session.flush()

        await db_session.rollback()

    @pytest.mark.asyncio
    async def test_check_constraint_rejects_quality_above_5(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
    ) -> None:
        review = _make_review(
            test_user.id,
            card_record.id,
            quality=6,
            reviewed_at=datetime.now(tz=timezone.utc),
        )
        db_session.add(review)

        with pytest.raises(IntegrityError):
            await db_session.flush()

        await db_session.rollback()

    @pytest.mark.asyncio
    async def test_check_constraint_accepts_quality_0_and_5(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
    ) -> None:
        now = datetime.now(tz=timezone.utc)
        review_0 = _make_review(test_user.id, card_record.id, quality=0, reviewed_at=now)
        review_5 = _make_review(test_user.id, card_record.id, quality=5, reviewed_at=now)
        db_session.add_all([review_0, review_5])
        await db_session.flush()

        assert review_0.quality == 0
        assert review_5.quality == 5
