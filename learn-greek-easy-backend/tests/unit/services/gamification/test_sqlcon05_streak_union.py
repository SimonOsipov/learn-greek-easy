"""SQLCON-05: golden/parity tests for streak.py cross-table UNION consolidation.

Strategy
--------
We assert **value-identity** for the two consolidated functions:

1. ``compute_aggregated_streak`` (3→1 round-trips):
   UNION of card_record_review + culture_answer_history + mock_exam_sessions.
   Must produce the same integer as the pre-consolidation set-union of three
   separate ``get_unique_dates`` calls.

2. ``compute_culture_streak`` (2→1 round-trips):
   UNION of culture_answer_history + mock_exam_sessions.
   Must produce the same integer as the pre-consolidation set-union of two
   separate ``get_unique_dates`` calls.

Cases covered
-------------
- all-empty → 0 (no activity for user)
- single active source (card only, culture only, mock only)
- multi-source with overlapping dates (same date from two sources collapses to 1)
- grace-period (yesterday-only activity → streak == 1)
- lookback-edge (record right at the MAX_STREAK_LOOKBACK_DAYS boundary)
- round-trip count == 1 per consolidated function (AsyncSession.execute spy)

Parity method
-------------
"pre" values are computed by calling each repo's ``get_unique_dates`` individually
and set-unioning, then applying ``_compute_streak_from_dates``.  The consolidated
path replaces those N calls with a single UNION execute; the result must be ==.

All tests require a real PostgreSQL session (db_session fixture). Tests are
marked ``integration`` and ``db`` so they run in the standard integration suite.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    CardRecord,
    CardRecordReview,
    CardRecordStatistics,
    CardStatus,
    CardType,
    CultureAnswerHistory,
    CultureDeck,
    CultureQuestion,
    MockExamSession,
    MockExamStatus,
    PartOfSpeech,
    ReviewRating,
    User,
    WordEntry,
)
from src.repositories.card_record_review import CardRecordReviewRepository
from src.repositories.culture_answer_history import CultureAnswerHistoryRepository
from src.repositories.mock_exam import MockExamRepository
from src.services.gamification.streak import (
    MAX_STREAK_LOOKBACK_DAYS,
    _compute_streak_from_dates,
    compute_aggregated_streak,
    compute_culture_streak,
)
from tests.factories.content import DeckFactory

# =============================================================================
# Helpers
# =============================================================================


def _utc_noon(days_ago: int = 0) -> datetime:
    """Return a UTC datetime N days in the past at noon (avoids timezone edge cases)."""
    return datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    ) - timedelta(days=days_ago)


async def _make_user(db_session: AsyncSession) -> User:
    user = User(email=f"sqlcon05_{uuid4().hex[:8]}@example.com", is_active=True)
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


async def _make_culture_context(db_session: AsyncSession) -> CultureQuestion:
    """Minimal CultureDeck + CultureQuestion for FK requirements."""
    deck = CultureDeck(
        name_en=f"SQLCON05 Deck {uuid4().hex[:6]}",
        name_el="Δεκ",
        name_ru="Дек",
        description_en="test",
        description_el="test",
        description_ru="test",
        category="history",
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()

    question = CultureQuestion(
        deck_id=deck.id,
        question_text={"en": "Q?", "el": "Ε;"},
        option_a={"en": "A", "el": "Α"},
        option_b={"en": "B", "el": "Β"},
        option_c={"en": "C", "el": "Γ"},
        option_d={"en": "D", "el": "Δ"},
        correct_option=1,
    )
    db_session.add(question)
    await db_session.flush()
    await db_session.refresh(question)
    return question


async def _add_culture_answer(
    db_session: AsyncSession,
    user_id,
    question_id,
    *,
    ts: datetime,
) -> None:
    record = CultureAnswerHistory(
        user_id=user_id,
        question_id=question_id,
        language="en",
        is_correct=True,
        selected_option=1,
        time_taken_seconds=10,
        deck_category="history",
        created_at=ts,
    )
    db_session.add(record)
    await db_session.flush()


async def _add_mock_session(
    db_session: AsyncSession,
    user_id,
    *,
    ts: datetime,
) -> None:
    session = MockExamSession(
        user_id=user_id,
        started_at=ts,
        status=MockExamStatus.ACTIVE,
        score=0,
        total_questions=25,
        passed=False,
        time_taken_seconds=0,
    )
    db_session.add(session)
    await db_session.flush()


async def _add_vocab_review(
    db_session: AsyncSession,
    user_id,
    *,
    ts: datetime,
) -> None:
    """Insert a CardRecordReview; creates all required FK parents inline."""
    word_entry = WordEntry(
        owner_id=None,
        lemma=f"λέξη_{uuid4().hex[:6]}",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="word",
        is_active=True,
    )
    db_session.add(word_entry)
    await db_session.flush()
    await db_session.refresh(word_entry)

    deck = await DeckFactory.create(session=db_session)

    card_record = CardRecord(
        word_entry_id=word_entry.id,
        deck_id=deck.id,
        card_type=CardType.MEANING_EL_TO_EN,
        variant_key=f"sqlcon05_{uuid4().hex[:6]}",
        is_active=True,
        front_content={"card_type": "meaning_el_to_en", "main": "λέξη"},
        back_content={"card_type": "meaning_el_to_en", "answer": "word"},
    )
    db_session.add(card_record)
    await db_session.flush()
    await db_session.refresh(card_record)

    stats = CardRecordStatistics(
        user_id=user_id,
        card_record_id=card_record.id,
        easiness_factor=2.5,
        interval=1,
        repetitions=1,
        status=CardStatus.LEARNING,
    )
    db_session.add(stats)
    await db_session.flush()

    review = CardRecordReview(
        user_id=user_id,
        card_record_id=card_record.id,
        quality=ReviewRating.CORRECT_HESITANT,
        time_taken=5,
        reviewed_at=ts,
    )
    db_session.add(review)
    await db_session.flush()


async def _parity_aggregated(db_session: AsyncSession, user_id) -> int:
    """Pre-consolidation path: 3 separate get_unique_dates calls, Python set-union."""
    card_repo = CardRecordReviewRepository(db_session)
    culture_repo = CultureAnswerHistoryRepository(db_session)
    mock_repo = MockExamRepository(db_session)

    vocab_dates = await card_repo.get_unique_dates(user_id, days=MAX_STREAK_LOOKBACK_DAYS)
    culture_dates = await culture_repo.get_unique_dates(user_id, days=MAX_STREAK_LOOKBACK_DAYS)
    mock_dates = await mock_repo.get_unique_dates(user_id, days=MAX_STREAK_LOOKBACK_DAYS)

    all_dates = sorted(
        set(vocab_dates) | set(culture_dates) | set(mock_dates),
        reverse=True,
    )
    return _compute_streak_from_dates(all_dates)


async def _parity_culture(db_session: AsyncSession, user_id) -> int:
    """Pre-consolidation path: 2 separate get_unique_dates calls, Python set-union."""
    culture_repo = CultureAnswerHistoryRepository(db_session)
    mock_repo = MockExamRepository(db_session)

    culture_dates = await culture_repo.get_unique_dates(user_id, days=MAX_STREAK_LOOKBACK_DAYS)
    mock_dates = await mock_repo.get_unique_dates(user_id, days=MAX_STREAK_LOOKBACK_DAYS)

    all_dates = sorted(set(culture_dates) | set(mock_dates), reverse=True)
    return _compute_streak_from_dates(all_dates)


# =============================================================================
# Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def empty_user(db_session: AsyncSession) -> User:
    """A user with no activity in any source."""
    return await _make_user(db_session)


@pytest_asyncio.fixture
async def multi_source_user(db_session: AsyncSession):
    """User with data across all 3 sources with overlapping dates.

    Day 0 (today):  vocab review
    Day 0 (today):  culture answer  ← same date as vocab (overlapping)
    Day 1 (yesterday): mock session
    Day 2 (2 days ago): culture answer

    Streak from the parity path: today(-0), yesterday(-1), day-2 = 3.
    The UNION must deduplicate day-0 to 1 distinct date (not 2).
    """
    user = await _make_user(db_session)
    question = await _make_culture_context(db_session)

    await _add_vocab_review(db_session, user.id, ts=_utc_noon(0))
    await _add_culture_answer(db_session, user.id, question.id, ts=_utc_noon(0))
    await _add_mock_session(db_session, user.id, ts=_utc_noon(1))
    await _add_culture_answer(db_session, user.id, question.id, ts=_utc_noon(2))

    return user


# =============================================================================
# Tests: compute_aggregated_streak
# =============================================================================


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.db
class TestComputeAggregatedStreakParity:
    """compute_aggregated_streak (3→1) value-identical to pre-consolidation path."""

    async def test_all_empty_returns_zero(self, db_session: AsyncSession, empty_user: User) -> None:
        """No activity → aggregated streak == 0."""
        result = await compute_aggregated_streak(db_session, empty_user.id)
        expected = await _parity_aggregated(db_session, empty_user.id)
        assert result == expected == 0

    async def test_vocab_only_source(self, db_session: AsyncSession) -> None:
        """Card reviews only, no culture/mock → matches parity, streak >= 1."""
        user = await _make_user(db_session)
        await _add_vocab_review(db_session, user.id, ts=_utc_noon(0))
        await _add_vocab_review(db_session, user.id, ts=_utc_noon(1))

        result = await compute_aggregated_streak(db_session, user.id)
        expected = await _parity_aggregated(db_session, user.id)

        assert result == expected
        assert result >= 2, f"Expected streak ≥ 2, got {result}"

    async def test_culture_only_source(self, db_session: AsyncSession) -> None:
        """Culture answers only, no card reviews/mock → matches parity, streak >= 1."""
        user = await _make_user(db_session)
        question = await _make_culture_context(db_session)
        await _add_culture_answer(db_session, user.id, question.id, ts=_utc_noon(0))

        result = await compute_aggregated_streak(db_session, user.id)
        expected = await _parity_aggregated(db_session, user.id)

        assert result == expected
        assert result >= 1, f"Expected streak ≥ 1, got {result}"

    async def test_mock_only_source(self, db_session: AsyncSession) -> None:
        """Mock exam session only → matches parity, streak >= 1."""
        user = await _make_user(db_session)
        await _add_mock_session(db_session, user.id, ts=_utc_noon(0))

        result = await compute_aggregated_streak(db_session, user.id)
        expected = await _parity_aggregated(db_session, user.id)

        assert result == expected
        assert result >= 1, f"Expected streak ≥ 1, got {result}"

    async def test_multi_source_overlapping_dates(
        self, db_session: AsyncSession, multi_source_user: User
    ) -> None:
        """Overlapping dates across sources collapse to 1; streak matches parity."""
        result = await compute_aggregated_streak(db_session, multi_source_user.id)
        expected = await _parity_aggregated(db_session, multi_source_user.id)

        assert result == expected
        assert result == 3, f"Expected 3-day streak (today/yesterday/day-2), got {result}"

    async def test_grace_period_yesterday_only(self, db_session: AsyncSession) -> None:
        """Activity only yesterday (nothing today) → streak == 1 via grace period."""
        user = await _make_user(db_session)
        await _add_vocab_review(db_session, user.id, ts=_utc_noon(1))  # yesterday

        result = await compute_aggregated_streak(db_session, user.id)
        expected = await _parity_aggregated(db_session, user.id)

        assert result == expected == 1

    async def test_lookback_edge_record_at_boundary(self, db_session: AsyncSession) -> None:
        """A record right at MAX_STREAK_LOOKBACK_DAYS boundary is included.

        We add activity today (to produce a nonzero streak) and a record at
        the exact lookback edge.  The edge record doesn't affect the current
        streak (there's a gap), but both paths must handle the cutoff uniformly.
        The key assertion is value-identity between the two paths.
        """
        user = await _make_user(db_session)
        # Activity today → streak = 1 (also means parity path is non-trivial)
        await _add_vocab_review(db_session, user.id, ts=_utc_noon(0))
        # Record right at lookback boundary — included in window
        await _add_mock_session(db_session, user.id, ts=_utc_noon(MAX_STREAK_LOOKBACK_DAYS - 1))

        result = await compute_aggregated_streak(db_session, user.id)
        expected = await _parity_aggregated(db_session, user.id)

        assert result == expected
        # Today has activity → current streak is at least 1
        assert result >= 1


# =============================================================================
# Tests: compute_culture_streak
# =============================================================================


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.db
class TestComputeCultureStreakParity:
    """compute_culture_streak (2→1) value-identical to pre-consolidation path."""

    async def test_all_empty_returns_zero(self, db_session: AsyncSession, empty_user: User) -> None:
        """No activity → culture streak == 0."""
        result = await compute_culture_streak(db_session, empty_user.id)
        expected = await _parity_culture(db_session, empty_user.id)
        assert result == expected == 0

    async def test_culture_only_source(self, db_session: AsyncSession) -> None:
        """Culture answers only, no mock exams → matches parity, streak >= 1."""
        user = await _make_user(db_session)
        question = await _make_culture_context(db_session)
        await _add_culture_answer(db_session, user.id, question.id, ts=_utc_noon(0))
        await _add_culture_answer(db_session, user.id, question.id, ts=_utc_noon(1))

        result = await compute_culture_streak(db_session, user.id)
        expected = await _parity_culture(db_session, user.id)

        assert result == expected
        assert result >= 2, f"Expected streak ≥ 2, got {result}"

    async def test_mock_only_source(self, db_session: AsyncSession) -> None:
        """Mock exam session only (no culture answers) → matches parity, streak >= 1."""
        user = await _make_user(db_session)
        await _add_mock_session(db_session, user.id, ts=_utc_noon(0))

        result = await compute_culture_streak(db_session, user.id)
        expected = await _parity_culture(db_session, user.id)

        assert result == expected
        assert result >= 1, f"Expected streak ≥ 1, got {result}"

    async def test_overlapping_dates_collapse(self, db_session: AsyncSession) -> None:
        """Same day from culture + mock collapses to 1 date; streak matches parity."""
        user = await _make_user(db_session)
        question = await _make_culture_context(db_session)

        # Both sources on day 0 and day 1 → 2 distinct days = streak 2
        await _add_culture_answer(db_session, user.id, question.id, ts=_utc_noon(0))
        await _add_mock_session(db_session, user.id, ts=_utc_noon(0))  # same day
        await _add_culture_answer(db_session, user.id, question.id, ts=_utc_noon(1))
        await _add_mock_session(db_session, user.id, ts=_utc_noon(1))  # same day

        result = await compute_culture_streak(db_session, user.id)
        expected = await _parity_culture(db_session, user.id)

        assert result == expected
        assert result == 2, f"Expected 2-day streak (today + yesterday), got {result}"

    async def test_culture_union_spans_both_sources(self, db_session: AsyncSession) -> None:
        """Culture answers day 0,-1 + mock session day -2 → streak = 3 (union bridges gap)."""
        user = await _make_user(db_session)
        question = await _make_culture_context(db_session)

        await _add_culture_answer(db_session, user.id, question.id, ts=_utc_noon(0))
        await _add_culture_answer(db_session, user.id, question.id, ts=_utc_noon(1))
        await _add_mock_session(db_session, user.id, ts=_utc_noon(2))

        result = await compute_culture_streak(db_session, user.id)
        expected = await _parity_culture(db_session, user.id)

        assert result == expected
        assert result == 3, f"Expected 3-day streak, got {result}"

    async def test_grace_period_yesterday_only(self, db_session: AsyncSession) -> None:
        """Activity only yesterday → culture streak == 1 via grace period."""
        user = await _make_user(db_session)
        await _add_mock_session(db_session, user.id, ts=_utc_noon(1))  # yesterday

        result = await compute_culture_streak(db_session, user.id)
        expected = await _parity_culture(db_session, user.id)

        assert result == expected == 1

    async def test_vocab_reviews_excluded_from_culture_streak(
        self, db_session: AsyncSession
    ) -> None:
        """Vocabulary card reviews do NOT contribute to culture streak.

        User with only vocab activity → culture streak must be 0.
        (Parity: culture get_unique_dates + mock get_unique_dates both return [])
        """
        user = await _make_user(db_session)
        await _add_vocab_review(db_session, user.id, ts=_utc_noon(0))

        result = await compute_culture_streak(db_session, user.id)
        expected = await _parity_culture(db_session, user.id)

        assert result == expected == 0


# =============================================================================
# Tests: single round-trip verification (execute spy)
# =============================================================================


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.db
class TestSingleRoundTrip:
    """Verify each consolidated function issues exactly 1 DB round-trip.

    Strategy: wrap AsyncSession.execute with a counting shim, call the
    function, assert call_count == 1.
    """

    async def test_aggregated_streak_single_execute(self, db_session: AsyncSession) -> None:
        """compute_aggregated_streak must call db.execute exactly once (3→1)."""
        user = await _make_user(db_session)

        original_execute = db_session.execute
        call_count = 0

        async def counting_execute(statement, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            return await original_execute(statement, *args, **kwargs)

        db_session.execute = counting_execute  # type: ignore[method-assign]
        try:
            await compute_aggregated_streak(db_session, user.id)
        finally:
            db_session.execute = original_execute  # type: ignore[method-assign]

        assert (
            call_count == 1
        ), f"compute_aggregated_streak issued {call_count} execute call(s), expected 1"

    async def test_culture_streak_single_execute(self, db_session: AsyncSession) -> None:
        """compute_culture_streak must call db.execute exactly once (2→1)."""
        user = await _make_user(db_session)

        original_execute = db_session.execute
        call_count = 0

        async def counting_execute(statement, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            return await original_execute(statement, *args, **kwargs)

        db_session.execute = counting_execute  # type: ignore[method-assign]
        try:
            await compute_culture_streak(db_session, user.id)
        finally:
            db_session.execute = original_execute  # type: ignore[method-assign]

        assert (
            call_count == 1
        ), f"compute_culture_streak issued {call_count} execute call(s), expected 1"

    async def test_vocabulary_streak_unchanged_execute_count(
        self, db_session: AsyncSession
    ) -> None:
        """compute_vocabulary_streak (out of scope) still issues 1 execute (unchanged)."""
        from src.services.gamification.streak import compute_vocabulary_streak

        user = await _make_user(db_session)

        original_execute = db_session.execute
        call_count = 0

        async def counting_execute(statement, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            return await original_execute(statement, *args, **kwargs)

        db_session.execute = counting_execute  # type: ignore[method-assign]
        try:
            await compute_vocabulary_streak(db_session, user.id)
        finally:
            db_session.execute = original_execute  # type: ignore[method-assign]

        assert (
            call_count == 1
        ), f"compute_vocabulary_streak issued {call_count} execute call(s), expected 1 (unchanged)"
