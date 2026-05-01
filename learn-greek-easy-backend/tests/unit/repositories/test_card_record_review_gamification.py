"""Unit tests for CardRecordReviewRepository gamification methods.

Covers:
- get_session_aggregates: empty user, single review, 29-min (same session) vs
  31-min (new session) boundary, multi-card sessions
- get_max_inactive_gap_days: empty, single date, multi-day with trailing gap
- get_consecutive_correct_streak: empty, all correct, break in stream
- get_weekly_accuracy: empty, mixed correct/wrong in range
- get_daily_review_counts: empty, multi-day distribution
"""

from datetime import datetime, timedelta, timezone

import pytest
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

# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
async def review_deck(db_session: AsyncSession) -> Deck:
    deck = Deck(
        name_en="Gamif Test Deck",
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


@pytest.fixture
async def review_word(db_session: AsyncSession, review_deck: Deck) -> WordEntry:
    entry = WordEntry(
        owner_id=None,
        lemma="λόγος",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="word",
        is_active=True,
    )
    db_session.add(entry)
    await db_session.flush()
    db_session.add(DeckWordEntry(deck_id=review_deck.id, word_entry_id=entry.id))
    await db_session.flush()
    await db_session.refresh(entry)
    return entry


@pytest.fixture
async def review_card(
    db_session: AsyncSession, review_deck: Deck, review_word: WordEntry
) -> CardRecord:
    record = CardRecord(
        word_entry_id=review_word.id,
        deck_id=review_deck.id,
        card_type=CardType.MEANING_EL_TO_EN,
        variant_key="gamif_default",
        front_content={"prompt": "test"},
        back_content={"answer": "test"},
    )
    db_session.add(record)
    await db_session.flush()
    await db_session.refresh(record)
    return record


def _review(
    user_id,
    card_record_id,
    *,
    quality: int = 4,
    time_taken: int = 10,
    reviewed_at: datetime,
) -> CardRecordReview:
    return CardRecordReview(
        user_id=user_id,
        card_record_id=card_record_id,
        quality=quality,
        time_taken=time_taken,
        reviewed_at=reviewed_at,
    )


# =============================================================================
# get_session_aggregates
# =============================================================================


class TestGetSessionAggregates:
    @pytest.mark.asyncio
    async def test_empty_user_returns_empty_list(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        repo = CardRecordReviewRepository(db_session)
        result = await repo.get_session_aggregates(sample_user.id)
        assert result == []

    @pytest.mark.asyncio
    async def test_single_review_creates_one_session(
        self,
        db_session: AsyncSession,
        sample_user: User,
        review_card: CardRecord,
    ) -> None:
        ts = datetime(2024, 1, 10, 9, 0, 0, tzinfo=timezone.utc)
        db_session.add(_review(sample_user.id, review_card.id, reviewed_at=ts, time_taken=15))
        await db_session.flush()

        repo = CardRecordReviewRepository(db_session)
        sessions = await repo.get_session_aggregates(sample_user.id)

        assert len(sessions) == 1
        s = sessions[0]
        assert s.card_count == 1
        assert s.correct_count == 1  # quality=4 >= 3
        assert s.total_time_seconds == 15
        assert s.min_hour_utc == 9
        assert s.max_hour_utc == 9

    @pytest.mark.asyncio
    async def test_29_min_gap_is_same_session(
        self,
        db_session: AsyncSession,
        sample_user: User,
        review_card: CardRecord,
    ) -> None:
        """Two reviews 29 minutes apart → exactly 1 session."""
        base = datetime(2024, 1, 10, 10, 0, 0, tzinfo=timezone.utc)
        db_session.add(_review(sample_user.id, review_card.id, reviewed_at=base, time_taken=5))
        db_session.add(
            _review(
                sample_user.id,
                review_card.id,
                reviewed_at=base + timedelta(minutes=29),
                time_taken=5,
            )
        )
        await db_session.flush()

        repo = CardRecordReviewRepository(db_session)
        sessions = await repo.get_session_aggregates(sample_user.id)

        assert len(sessions) == 1
        assert sessions[0].card_count == 2

    @pytest.mark.asyncio
    async def test_30_min_gap_exactly_is_same_session(
        self,
        db_session: AsyncSession,
        sample_user: User,
        review_card: CardRecord,
    ) -> None:
        """Gap of exactly 30 min → same session (strict > boundary)."""
        base = datetime(2024, 1, 10, 10, 0, 0, tzinfo=timezone.utc)
        db_session.add(_review(sample_user.id, review_card.id, reviewed_at=base, time_taken=5))
        db_session.add(
            _review(
                sample_user.id,
                review_card.id,
                reviewed_at=base + timedelta(minutes=30),
                time_taken=5,
            )
        )
        await db_session.flush()

        repo = CardRecordReviewRepository(db_session)
        sessions = await repo.get_session_aggregates(sample_user.id)

        assert len(sessions) == 1
        assert sessions[0].card_count == 2

    @pytest.mark.asyncio
    async def test_31_min_gap_starts_new_session(
        self,
        db_session: AsyncSession,
        sample_user: User,
        review_card: CardRecord,
    ) -> None:
        """Gap > 30 min → 2 sessions."""
        base = datetime(2024, 1, 10, 10, 0, 0, tzinfo=timezone.utc)
        db_session.add(
            _review(sample_user.id, review_card.id, reviewed_at=base, time_taken=10, quality=4)
        )
        db_session.add(
            _review(
                sample_user.id,
                review_card.id,
                reviewed_at=base + timedelta(minutes=31),
                time_taken=20,
                quality=2,
            )
        )
        await db_session.flush()

        repo = CardRecordReviewRepository(db_session)
        sessions = await repo.get_session_aggregates(sample_user.id)

        assert len(sessions) == 2
        s1, s2 = sessions
        assert s1.card_count == 1
        assert s1.correct_count == 1
        assert s1.total_time_seconds == 10
        assert s2.card_count == 1
        assert s2.correct_count == 0  # quality=2 < 3
        assert s2.total_time_seconds == 20

    @pytest.mark.asyncio
    async def test_correct_count_only_counts_quality_gte_3(
        self,
        db_session: AsyncSession,
        sample_user: User,
        review_card: CardRecord,
    ) -> None:
        base = datetime(2024, 1, 15, 8, 0, 0, tzinfo=timezone.utc)
        for quality in [0, 1, 2, 3, 4, 5]:
            db_session.add(
                _review(
                    sample_user.id,
                    review_card.id,
                    reviewed_at=base + timedelta(minutes=quality),
                    quality=quality,
                    time_taken=5,
                )
            )
        await db_session.flush()

        repo = CardRecordReviewRepository(db_session)
        sessions = await repo.get_session_aggregates(sample_user.id)

        assert len(sessions) == 1
        assert sessions[0].card_count == 6
        assert sessions[0].correct_count == 3  # quality 3, 4, 5


# =============================================================================
# get_max_inactive_gap_days
# =============================================================================


class TestGetMaxInactiveGapDays:
    @pytest.mark.asyncio
    async def test_empty_user_returns_zero(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        repo = CardRecordReviewRepository(db_session)
        assert await repo.get_max_inactive_gap_days(sample_user.id) == 0

    @pytest.mark.asyncio
    async def test_single_review_date_returns_zero(
        self,
        db_session: AsyncSession,
        sample_user: User,
        review_card: CardRecord,
    ) -> None:
        ts = datetime(2024, 1, 5, 10, 0, 0, tzinfo=timezone.utc)
        db_session.add(_review(sample_user.id, review_card.id, reviewed_at=ts))
        await db_session.flush()

        repo = CardRecordReviewRepository(db_session)
        assert await repo.get_max_inactive_gap_days(sample_user.id) == 0

    @pytest.mark.asyncio
    async def test_two_reviews_same_day_returns_zero(
        self,
        db_session: AsyncSession,
        sample_user: User,
        review_card: CardRecord,
    ) -> None:
        base = datetime(2024, 1, 5, 9, 0, 0, tzinfo=timezone.utc)
        db_session.add(_review(sample_user.id, review_card.id, reviewed_at=base))
        db_session.add(
            _review(sample_user.id, review_card.id, reviewed_at=base + timedelta(hours=3))
        )
        await db_session.flush()

        repo = CardRecordReviewRepository(db_session)
        assert await repo.get_max_inactive_gap_days(sample_user.id) == 0

    @pytest.mark.asyncio
    async def test_internal_gaps_detected_excluding_trailing(
        self,
        db_session: AsyncSession,
        sample_user: User,
        review_card: CardRecord,
    ) -> None:
        """Reviews on Jan 1, Jan 5 (gap=4), Jan 7 (gap=2). Trailing gap excluded."""
        for offset_days in [0, 4, 6]:
            ts = datetime(2024, 1, 1, 10, 0, 0, tzinfo=timezone.utc) + timedelta(days=offset_days)
            db_session.add(_review(sample_user.id, review_card.id, reviewed_at=ts))
        await db_session.flush()

        repo = CardRecordReviewRepository(db_session)
        # Gaps: Jan1→Jan5 = 4 days, Jan5→Jan7 = 2 days. Trailing gap to today is excluded.
        assert await repo.get_max_inactive_gap_days(sample_user.id) == 4

    @pytest.mark.asyncio
    async def test_trailing_gap_excluded(
        self,
        db_session: AsyncSession,
        sample_user: User,
        review_card: CardRecord,
    ) -> None:
        """Only one internal gap; recent review + large trailing gap does not count."""
        # Two reviews 1 day apart a long time ago — trailing gap to today could be huge
        ts1 = datetime(2024, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
        ts2 = datetime(2024, 1, 2, 10, 0, 0, tzinfo=timezone.utc)
        db_session.add(_review(sample_user.id, review_card.id, reviewed_at=ts1))
        db_session.add(_review(sample_user.id, review_card.id, reviewed_at=ts2))
        await db_session.flush()

        repo = CardRecordReviewRepository(db_session)
        # Internal gap is 1 day; trailing gap (Jan 2 → today) is excluded
        assert await repo.get_max_inactive_gap_days(sample_user.id) == 1


# =============================================================================
# get_consecutive_correct_streak
# =============================================================================


class TestGetConsecutiveCorrectStreak:
    @pytest.mark.asyncio
    async def test_empty_user_returns_zero(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        repo = CardRecordReviewRepository(db_session)
        assert await repo.get_consecutive_correct_streak(sample_user.id) == 0

    @pytest.mark.asyncio
    async def test_all_correct_streak_equals_count(
        self,
        db_session: AsyncSession,
        sample_user: User,
        review_card: CardRecord,
    ) -> None:
        base = datetime(2024, 3, 1, 10, 0, 0, tzinfo=timezone.utc)
        for i in range(5):
            db_session.add(
                _review(
                    sample_user.id,
                    review_card.id,
                    reviewed_at=base + timedelta(minutes=i),
                    quality=4,
                )
            )
        await db_session.flush()

        repo = CardRecordReviewRepository(db_session)
        assert await repo.get_consecutive_correct_streak(sample_user.id) == 5

    @pytest.mark.asyncio
    async def test_break_in_streak_stops_count(
        self,
        db_session: AsyncSession,
        sample_user: User,
        review_card: CardRecord,
    ) -> None:
        """Pattern (oldest→newest): wrong, correct, correct, correct → streak=3."""
        base = datetime(2024, 3, 1, 10, 0, 0, tzinfo=timezone.utc)
        qualities = [2, 4, 4, 5]  # First is wrong; rest correct
        for i, q in enumerate(qualities):
            db_session.add(
                _review(
                    sample_user.id,
                    review_card.id,
                    reviewed_at=base + timedelta(minutes=i),
                    quality=q,
                )
            )
        await db_session.flush()

        repo = CardRecordReviewRepository(db_session)
        assert await repo.get_consecutive_correct_streak(sample_user.id) == 3

    @pytest.mark.asyncio
    async def test_most_recent_wrong_returns_zero(
        self,
        db_session: AsyncSession,
        sample_user: User,
        review_card: CardRecord,
    ) -> None:
        """If the most recent review is incorrect, streak is 0."""
        base = datetime(2024, 3, 1, 10, 0, 0, tzinfo=timezone.utc)
        db_session.add(_review(sample_user.id, review_card.id, reviewed_at=base, quality=4))
        db_session.add(
            _review(
                sample_user.id,
                review_card.id,
                reviewed_at=base + timedelta(minutes=5),
                quality=1,
            )
        )
        await db_session.flush()

        repo = CardRecordReviewRepository(db_session)
        assert await repo.get_consecutive_correct_streak(sample_user.id) == 0


# =============================================================================
# get_weekly_accuracy
# =============================================================================


class TestGetWeeklyAccuracy:
    @pytest.mark.asyncio
    async def test_empty_user_returns_zeros(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        repo = CardRecordReviewRepository(db_session)
        correct, total = await repo.get_weekly_accuracy(sample_user.id)
        assert correct == 0
        assert total == 0

    @pytest.mark.asyncio
    async def test_counts_last_7_days_only(
        self,
        db_session: AsyncSession,
        sample_user: User,
        review_card: CardRecord,
    ) -> None:
        now = datetime.now(tz=timezone.utc)
        # In range (3 days ago): correct + wrong
        db_session.add(
            _review(
                sample_user.id,
                review_card.id,
                reviewed_at=now - timedelta(days=3),
                quality=5,
            )
        )
        db_session.add(
            _review(
                sample_user.id,
                review_card.id,
                reviewed_at=now - timedelta(days=3, hours=1),
                quality=1,
            )
        )
        # Out of range (8 days ago): should not count
        db_session.add(
            _review(
                sample_user.id,
                review_card.id,
                reviewed_at=now - timedelta(days=8),
                quality=5,
            )
        )
        await db_session.flush()

        repo = CardRecordReviewRepository(db_session)
        correct, total = await repo.get_weekly_accuracy(sample_user.id)
        assert total == 2
        assert correct == 1


# =============================================================================
# get_daily_review_counts
# =============================================================================


class TestGetDailyReviewCounts:
    @pytest.mark.asyncio
    async def test_empty_user_returns_empty_list(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        repo = CardRecordReviewRepository(db_session)
        result = await repo.get_daily_review_counts(sample_user.id)
        assert result == []

    @pytest.mark.asyncio
    async def test_multi_day_counts(
        self,
        db_session: AsyncSession,
        sample_user: User,
        review_card: CardRecord,
    ) -> None:
        """3 reviews on day 1, 1 on day 2, 2 on day 3."""
        base = datetime(2024, 2, 1, 10, 0, 0, tzinfo=timezone.utc)
        # Day 1: 3 reviews
        for i in range(3):
            db_session.add(
                _review(
                    sample_user.id,
                    review_card.id,
                    reviewed_at=base + timedelta(minutes=i),
                )
            )
        # Day 2: 1 review
        db_session.add(
            _review(sample_user.id, review_card.id, reviewed_at=base + timedelta(days=1))
        )
        # Day 3: 2 reviews
        for i in range(2):
            db_session.add(
                _review(
                    sample_user.id,
                    review_card.id,
                    reviewed_at=base + timedelta(days=2, minutes=i),
                )
            )
        await db_session.flush()

        repo = CardRecordReviewRepository(db_session)
        counts = await repo.get_daily_review_counts(sample_user.id)

        assert len(counts) == 3
        dates = [d for d, _ in counts]
        cnts = [c for _, c in counts]
        # Ascending order
        assert dates == sorted(dates)
        assert cnts == [3, 1, 2]
