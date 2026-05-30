"""Integration tests for per-surface streak computation.

Validates source-mapping correctness and the UNION logic for compute_culture_streak,
compute_vocabulary_streak, compute_exercise_streak, and compute_aggregated_streak.

All tests require a real PostgreSQL session (db_session fixture). They are skipped
automatically if the DB is unavailable (connection error bubbles through pytest).

Coverage:
- Exercise source: exercise_reviews → compute_exercise_streak
- Mock-exam folds into culture: MockExamSession.started_at counts for culture streak
- Culture union: culture answers + mock exam dates span the union
- Vocabulary isolation: only card reviews count for vocab streak
- Aggregated regression: exercise-only user has aggregated=0 but exercise>0
- ExerciseReviewRepository.get_unique_dates / get_all_unique_dates ordering
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    CultureAnswerHistory,
    CultureDeck,
    CultureQuestion,
    MockExamSession,
    MockExamStatus,
    User,
)
from src.repositories.exercise_review import ExerciseReviewRepository
from src.services.gamification.streak import (
    compute_aggregated_streak,
    compute_culture_streak,
    compute_exercise_streak,
    compute_vocabulary_streak,
)
from tests.factories import ExerciseReviewFactory, UserFactory

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _utc(days_ago: int = 0) -> datetime:
    """Return a UTC datetime N days in the past (noon, to avoid timezone edge cases)."""
    return datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    ) - timedelta(days=days_ago)


async def _make_user(db_session: AsyncSession) -> User:
    user = User(email=f"streak_intg_{uuid4().hex[:8]}@example.com", is_active=True)
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


async def _make_culture_question(db_session: AsyncSession) -> CultureQuestion:
    deck = CultureDeck(
        name_en="Streak Test Deck",
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
    days_ago: int = 0,
) -> None:
    record = CultureAnswerHistory(
        user_id=user_id,
        question_id=question_id,
        language="en",
        is_correct=True,
        selected_option=1,
        time_taken_seconds=10,
        deck_category="history",
        created_at=_utc(days_ago),
    )
    db_session.add(record)
    await db_session.flush()


async def _add_mock_session(
    db_session: AsyncSession,
    user_id,
    *,
    days_ago: int = 0,
) -> None:
    session = MockExamSession(
        user_id=user_id,
        started_at=_utc(days_ago),
        status=MockExamStatus.ACTIVE,
        score=0,
        total_questions=25,
        passed=False,
        time_taken_seconds=0,
    )
    db_session.add(session)
    await db_session.flush()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestExerciseStreakSource:
    """compute_exercise_streak reads from ExerciseReview rows."""

    async def test_exercise_reviews_consecutive_days_give_streak(
        self, db_session: AsyncSession
    ) -> None:
        """Reviews on 3 consecutive days ending today → exercise streak = 3."""
        user = await UserFactory.create(session=db_session)

        for days_ago in range(3):
            await ExerciseReviewFactory.create(
                session=db_session,
                user_id=user.id,
                reviewed_at=_utc(days_ago),
            )

        streak = await compute_exercise_streak(db_session, user.id)
        assert streak == 3

    async def test_no_exercise_activity_returns_zero(self, db_session: AsyncSession) -> None:
        """User with no exercise reviews → exercise streak = 0."""
        user = await UserFactory.create(session=db_session)
        streak = await compute_exercise_streak(db_session, user.id)
        assert streak == 0

    async def test_exercise_streak_is_independent_of_culture(
        self, db_session: AsyncSession
    ) -> None:
        """Culture answers do not inflate exercise streak."""
        user = await UserFactory.create(session=db_session)
        question = await _make_culture_question(db_session)

        # Add culture answers for 5 consecutive days
        for days_ago in range(5):
            await _add_culture_answer(db_session, user.id, question.id, days_ago=days_ago)

        # No exercise reviews → exercise streak stays 0
        exercise_streak = await compute_exercise_streak(db_session, user.id)
        assert exercise_streak == 0


@pytest.mark.asyncio
class TestMockExamFoldsIntoCultureStreak:
    """MockExamSession.started_at counts toward compute_culture_streak."""

    async def test_mock_exam_session_today_gives_culture_streak_gte_one(
        self, db_session: AsyncSession
    ) -> None:
        """An active mock session started today (no culture answers) → culture streak ≥ 1."""
        user = await UserFactory.create(session=db_session)
        await _add_mock_session(db_session, user.id, days_ago=0)

        streak = await compute_culture_streak(db_session, user.id)
        assert streak >= 1

    async def test_mock_exam_uses_started_at_not_completed_at(
        self, db_session: AsyncSession
    ) -> None:
        """An abandoned session (no completed_at) started today still counts."""
        user = await UserFactory.create(session=db_session)

        # Session is ACTIVE (no completed_at) — started today
        session = MockExamSession(
            user_id=user.id,
            started_at=_utc(0),
            completed_at=None,  # explicitly not completed
            status=MockExamStatus.ACTIVE,
            score=0,
            total_questions=25,
            passed=False,
            time_taken_seconds=0,
        )
        db_session.add(session)
        await db_session.flush()

        streak = await compute_culture_streak(db_session, user.id)
        assert streak >= 1

    async def test_culture_union_spans_mock_and_answers(self, db_session: AsyncSession) -> None:
        """Culture answers day 0,-1 + mock session day -2 → streak = 3 (union)."""
        user = await UserFactory.create(session=db_session)
        question = await _make_culture_question(db_session)

        await _add_culture_answer(db_session, user.id, question.id, days_ago=0)
        await _add_culture_answer(db_session, user.id, question.id, days_ago=1)
        await _add_mock_session(db_session, user.id, days_ago=2)

        streak = await compute_culture_streak(db_session, user.id)
        assert streak == 3


@pytest.mark.asyncio
class TestVocabularyIsolation:
    """compute_vocabulary_streak only counts CardRecordReview rows."""

    async def test_culture_and_exercise_activity_do_not_give_vocab_streak(
        self, db_session: AsyncSession
    ) -> None:
        """User with only culture/mock/exercise activity → vocab streak = 0."""
        user = await UserFactory.create(session=db_session)
        question = await _make_culture_question(db_session)

        await _add_culture_answer(db_session, user.id, question.id, days_ago=0)
        await _add_mock_session(db_session, user.id, days_ago=0)
        await ExerciseReviewFactory.create(session=db_session, user_id=user.id, reviewed_at=_utc(0))

        vocab_streak = await compute_vocabulary_streak(db_session, user.id)
        assert vocab_streak == 0


@pytest.mark.asyncio
class TestAggregatedStreakRegression:
    """compute_aggregated_streak does NOT include exercise activity."""

    async def test_exercise_only_user_has_aggregated_zero_but_exercise_positive(
        self, db_session: AsyncSession
    ) -> None:
        """Exercise-only user: aggregated streak = 0, exercise streak > 0."""
        user = await UserFactory.create(session=db_session)

        # Reviews on consecutive days
        for days_ago in range(3):
            await ExerciseReviewFactory.create(
                session=db_session, user_id=user.id, reviewed_at=_utc(days_ago)
            )

        aggregated = await compute_aggregated_streak(db_session, user.id)
        exercise = await compute_exercise_streak(db_session, user.id)

        assert aggregated == 0, "Exercise activity must not inflate aggregated streak"
        assert exercise >= 3


@pytest.mark.asyncio
class TestExerciseReviewRepositoryQueries:
    """ExerciseReviewRepository.get_unique_dates and get_all_unique_dates ordering."""

    async def test_get_unique_dates_returns_descending(self, db_session: AsyncSession) -> None:
        """get_unique_dates returns dates in descending order."""
        user = await UserFactory.create(session=db_session)

        for days_ago in [3, 1, 0]:
            await ExerciseReviewFactory.create(
                session=db_session, user_id=user.id, reviewed_at=_utc(days_ago)
            )

        repo = ExerciseReviewRepository(db_session)
        dates = await repo.get_unique_dates(user.id, days=30)

        assert dates == sorted(dates, reverse=True), "get_unique_dates must be descending"
        assert len(dates) == 3

    async def test_get_all_unique_dates_returns_ascending(self, db_session: AsyncSession) -> None:
        """get_all_unique_dates returns dates in ascending order."""
        user = await UserFactory.create(session=db_session)

        for days_ago in [5, 2, 0]:
            await ExerciseReviewFactory.create(
                session=db_session, user_id=user.id, reviewed_at=_utc(days_ago)
            )

        repo = ExerciseReviewRepository(db_session)
        dates = await repo.get_all_unique_dates(user.id)

        assert dates == sorted(dates), "get_all_unique_dates must be ascending"
        assert len(dates) == 3

    async def test_get_unique_dates_deduplicates_same_day(self, db_session: AsyncSession) -> None:
        """Multiple reviews on the same day count as one date."""
        user = await UserFactory.create(session=db_session)

        # Three reviews today at different times
        for hour_offset in range(3):
            ts = _utc(0).replace(hour=hour_offset + 9)
            await ExerciseReviewFactory.create(session=db_session, user_id=user.id, reviewed_at=ts)

        repo = ExerciseReviewRepository(db_session)
        dates = await repo.get_unique_dates(user.id, days=30)

        assert len(dates) == 1, "Multiple reviews on same day must deduplicate to one date"

    async def test_get_unique_dates_respects_cutoff_window(self, db_session: AsyncSession) -> None:
        """get_unique_dates(days=5) excludes reviews older than 5 days."""
        user = await UserFactory.create(session=db_session)

        await ExerciseReviewFactory.create(session=db_session, user_id=user.id, reviewed_at=_utc(0))
        await ExerciseReviewFactory.create(
            session=db_session, user_id=user.id, reviewed_at=_utc(10)
        )

        repo = ExerciseReviewRepository(db_session)
        dates = await repo.get_unique_dates(user.id, days=5)

        assert len(dates) == 1, "Review 10 days ago must be excluded when window is 5 days"
