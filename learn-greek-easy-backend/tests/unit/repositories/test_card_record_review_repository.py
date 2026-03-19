"""Unit tests for CardRecordReviewRepository."""

from datetime import date, datetime, timedelta, timezone

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


class TestGetDailyStats:
    @pytest.mark.asyncio
    async def test_returns_daily_aggregates(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
    ) -> None:
        now = datetime.now(tz=timezone.utc)
        yesterday = now - timedelta(days=1)
        await db_session.flush()
        db_session.add(
            _make_review(test_user.id, card_record.id, quality=4, time_taken=10, reviewed_at=now)
        )
        db_session.add(
            _make_review(
                test_user.id, card_record.id, quality=2, time_taken=20, reviewed_at=yesterday
            )
        )
        await db_session.flush()
        repo = CardRecordReviewRepository(db_session)
        start = (now - timedelta(days=2)).date()
        end = now.date()
        result = await repo.get_daily_stats(test_user.id, start, end)
        assert len(result) == 2
        today_stats = next(r for r in result if r["date"] == now.date())
        assert today_stats["reviews_count"] == 1
        assert today_stats["total_time"] == 10

    @pytest.mark.asyncio
    async def test_returns_empty_for_no_reviews(
        self,
        db_session: AsyncSession,
        test_user: User,
    ) -> None:
        repo = CardRecordReviewRepository(db_session)
        result = await repo.get_daily_stats(test_user.id, date.today(), date.today())
        assert result == []


class TestGetStudyTimeToday:
    @pytest.mark.asyncio
    async def test_sums_todays_time(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
    ) -> None:
        await db_session.flush()
        now = datetime.now(tz=timezone.utc)
        db_session.add(
            _make_review(test_user.id, card_record.id, quality=3, time_taken=15, reviewed_at=now)
        )
        db_session.add(
            _make_review(test_user.id, card_record.id, quality=3, time_taken=25, reviewed_at=now)
        )
        await db_session.flush()
        repo = CardRecordReviewRepository(db_session)
        result = await repo.get_study_time_today(test_user.id)
        assert result == 40

    @pytest.mark.asyncio
    async def test_returns_zero_for_no_reviews(
        self,
        db_session: AsyncSession,
        test_user: User,
    ) -> None:
        repo = CardRecordReviewRepository(db_session)
        result = await repo.get_study_time_today(test_user.id)
        assert result == 0


class TestGetTotalReviews:
    @pytest.mark.asyncio
    async def test_counts_all_reviews(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
    ) -> None:
        await db_session.flush()
        now = datetime.now(tz=timezone.utc)
        for i in range(3):
            db_session.add(
                _make_review(
                    test_user.id,
                    card_record.id,
                    quality=3,
                    time_taken=5,
                    reviewed_at=now - timedelta(days=i),
                )
            )
        await db_session.flush()
        repo = CardRecordReviewRepository(db_session)
        result = await repo.get_total_reviews(test_user.id)
        assert result == 3

    @pytest.mark.asyncio
    async def test_returns_zero_for_no_reviews(
        self,
        db_session: AsyncSession,
        test_user: User,
    ) -> None:
        repo = CardRecordReviewRepository(db_session)
        result = await repo.get_total_reviews(test_user.id)
        assert result == 0


class TestGetTotalStudyTime:
    @pytest.mark.asyncio
    async def test_sums_all_time(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
    ) -> None:
        await db_session.flush()
        now = datetime.now(tz=timezone.utc)
        db_session.add(
            _make_review(
                test_user.id,
                card_record.id,
                quality=3,
                time_taken=100,
                reviewed_at=now - timedelta(days=5),
            )
        )
        db_session.add(
            _make_review(test_user.id, card_record.id, quality=3, time_taken=200, reviewed_at=now)
        )
        await db_session.flush()
        repo = CardRecordReviewRepository(db_session)
        result = await repo.get_total_study_time(test_user.id)
        assert result == 300

    @pytest.mark.asyncio
    async def test_returns_zero_for_no_reviews(
        self,
        db_session: AsyncSession,
        test_user: User,
    ) -> None:
        repo = CardRecordReviewRepository(db_session)
        result = await repo.get_total_study_time(test_user.id)
        assert result == 0


class TestGetAccuracyStats:
    @pytest.mark.asyncio
    async def test_counts_correct_and_total(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
    ) -> None:
        await db_session.flush()
        now = datetime.now(tz=timezone.utc)
        db_session.add(
            _make_review(test_user.id, card_record.id, quality=5, time_taken=5, reviewed_at=now)
        )
        db_session.add(
            _make_review(test_user.id, card_record.id, quality=3, time_taken=5, reviewed_at=now)
        )
        db_session.add(
            _make_review(test_user.id, card_record.id, quality=1, time_taken=5, reviewed_at=now)
        )
        await db_session.flush()
        repo = CardRecordReviewRepository(db_session)
        result = await repo.get_accuracy_stats(test_user.id, days=30)
        assert result["total"] == 3
        assert result["correct"] == 2  # quality >= 3

    @pytest.mark.asyncio
    async def test_returns_zeros_for_no_reviews(
        self,
        db_session: AsyncSession,
        test_user: User,
    ) -> None:
        repo = CardRecordReviewRepository(db_session)
        result = await repo.get_accuracy_stats(test_user.id, days=30)
        assert result == {"correct": 0, "total": 0}


class TestGetDailyAccuracyStats:
    @pytest.mark.asyncio
    async def test_groups_by_day(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
    ) -> None:
        await db_session.flush()
        now = datetime.now(tz=timezone.utc)
        db_session.add(
            _make_review(test_user.id, card_record.id, quality=5, time_taken=5, reviewed_at=now)
        )
        db_session.add(
            _make_review(test_user.id, card_record.id, quality=1, time_taken=5, reviewed_at=now)
        )
        await db_session.flush()
        repo = CardRecordReviewRepository(db_session)
        result = await repo.get_daily_accuracy_stats(test_user.id, date.today(), date.today())
        assert len(result) == 1
        assert result[0]["total"] == 2
        assert result[0]["correct"] == 1

    @pytest.mark.asyncio
    async def test_returns_empty_for_no_reviews(
        self,
        db_session: AsyncSession,
        test_user: User,
    ) -> None:
        repo = CardRecordReviewRepository(db_session)
        result = await repo.get_daily_accuracy_stats(test_user.id, date.today(), date.today())
        assert result == []


class TestGetAverageQuality:
    @pytest.mark.asyncio
    async def test_returns_average(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
    ) -> None:
        await db_session.flush()
        now = datetime.now(tz=timezone.utc)
        db_session.add(
            _make_review(test_user.id, card_record.id, quality=5, time_taken=5, reviewed_at=now)
        )
        db_session.add(
            _make_review(test_user.id, card_record.id, quality=3, time_taken=5, reviewed_at=now)
        )
        await db_session.flush()
        repo = CardRecordReviewRepository(db_session)
        result = await repo.get_average_quality(test_user.id)
        assert result == 4.0

    @pytest.mark.asyncio
    async def test_returns_zero_for_no_reviews(
        self,
        db_session: AsyncSession,
        test_user: User,
    ) -> None:
        repo = CardRecordReviewRepository(db_session)
        result = await repo.get_average_quality(test_user.id)
        assert result == 0.0


class TestGetUniqueDates:
    @pytest.mark.asyncio
    async def test_returns_distinct_dates_within_days(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
    ) -> None:
        await db_session.flush()
        now = datetime.now(tz=timezone.utc)
        # Two reviews on same day, one on yesterday
        db_session.add(
            _make_review(test_user.id, card_record.id, quality=3, time_taken=5, reviewed_at=now)
        )
        db_session.add(
            _make_review(test_user.id, card_record.id, quality=3, time_taken=5, reviewed_at=now)
        )
        db_session.add(
            _make_review(
                test_user.id,
                card_record.id,
                quality=3,
                time_taken=5,
                reviewed_at=now - timedelta(days=1),
            )
        )
        await db_session.flush()
        repo = CardRecordReviewRepository(db_session)
        result = await repo.get_unique_dates(test_user.id, days=30)
        assert len(result) == 2  # today + yesterday

    @pytest.mark.asyncio
    async def test_returns_empty_for_no_reviews(
        self,
        db_session: AsyncSession,
        test_user: User,
    ) -> None:
        repo = CardRecordReviewRepository(db_session)
        result = await repo.get_unique_dates(test_user.id, days=30)
        assert result == []


class TestGetAllUniqueDates:
    @pytest.mark.asyncio
    async def test_returns_all_dates_ascending(
        self,
        db_session: AsyncSession,
        test_user: User,
        card_record: CardRecord,
    ) -> None:
        await db_session.flush()
        now = datetime.now(tz=timezone.utc)
        db_session.add(
            _make_review(test_user.id, card_record.id, quality=3, time_taken=5, reviewed_at=now)
        )
        db_session.add(
            _make_review(
                test_user.id,
                card_record.id,
                quality=3,
                time_taken=5,
                reviewed_at=now - timedelta(days=30),
            )
        )
        await db_session.flush()
        repo = CardRecordReviewRepository(db_session)
        result = await repo.get_all_unique_dates(test_user.id)
        assert len(result) == 2
        assert result[0] < result[1]  # ascending order

    @pytest.mark.asyncio
    async def test_returns_empty_for_no_reviews(
        self,
        db_session: AsyncSession,
        test_user: User,
    ) -> None:
        repo = CardRecordReviewRepository(db_session)
        result = await repo.get_all_unique_dates(test_user.id)
        assert result == []
