"""Aggregated streak computation for the gamification system.

Canonical streak logic owned by the gamification module. ``progress_service``
imports ``compute_aggregated_streak`` from here rather than maintaining its
own copy, keeping streak semantics in one place.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import Select, func, literal, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardRecordReview, CultureAnswerHistory, MockExamSession
from src.repositories.card_record_review import CardRecordReviewRepository
from src.repositories.exercise_review import ExerciseReviewRepository

# Lookback window for streak aggregation. Must exceed the largest streak-day
# threshold in any AchievementDef so 60/100/365-day streak achievements are
# reachable through the projection. Bound the query by ~1y of activity.
MAX_STREAK_LOOKBACK_DAYS = 366


def _date_branch(model: Any, ts_col: Any, source: str, user_id: UUID, cutoff: datetime) -> Select:
    """Build a single SELECT branch for a UNION ALL streak query.

    Each branch projects ``func.date(<ts_col>)`` grouped per calendar day, with
    a ``source`` label for debuggability.  The GROUP BY per-branch deduplicates
    multiple events on the same day within one table; the outer Python ``set()``
    handles cross-table overlap after the UNION ALL.

    Args:
        model: SQLAlchemy ORM model class.
        ts_col: The timestamp column attribute (e.g. ``CardRecordReview.reviewed_at``).
        source: Short string tag (e.g. ``"card"``), kept in the result for debugging.
        user_id: Filters rows to this user.
        cutoff: Standardized ``datetime`` lower bound (midnight at lookback window start).

    Returns:
        A SQLAlchemy ``Select`` statement projecting ``(d DATE, source TEXT)``.
    """
    return (
        select(func.date(ts_col).label("d"), literal(source).label("source"))
        .where(model.user_id == user_id, ts_col >= cutoff)
        .group_by(func.date(ts_col))
    )


def _compute_streak_from_dates(dates: list[date]) -> int:
    """Current consecutive-day streak with a 1-day grace period.

    ``dates`` must be descending-sorted unique dates. Returns 0 if empty.
    """
    if not dates:
        return 0
    today = datetime.now(timezone.utc).date()
    # Grace period: allow yesterday to anchor the streak if nothing today
    start = today if dates[0] == today else today - timedelta(days=1)
    if dates[0] > start:
        return 0
    streak = 0
    expected = start
    for d in dates:
        if d == expected:
            streak += 1
            expected = d - timedelta(days=1)
        elif d < expected:
            break
    return streak


def _longest_streak_from_dates(dates: list[date]) -> int:
    """Longest consecutive run. ``dates`` must be ascending-sorted.

    Returns 1 for a single date, 0 for an empty list.
    """
    if not dates:
        return 0
    longest = 1
    current = 1
    for i in range(1, len(dates)):
        if dates[i] == dates[i - 1] + timedelta(days=1):
            current += 1
            longest = max(longest, current)
        else:
            current = 1
    return longest


async def compute_aggregated_streak(db: AsyncSession, user_id: UUID) -> int:
    """Compute combined study streak across vocab, culture, and mock exams.

    Issues a single UNION ALL query spanning card_record_reviews,
    culture_answer_history, and mock_exam_sessions (3→1 round-trip).
    Cross-table overlap on the same calendar day is resolved by the Python
    ``set()`` after the UNION ALL fetch; per-source GROUP BY deduplicates
    within each table before the union.

    Args:
        db: Async database session.
        user_id: User UUID.

    Returns:
        Current consecutive-day streak (0 if no activity).
    """
    # Standardized cutoff: midnight at the start of the lookback window.
    # datetime.combine ensures consistent comparison against timezone-aware
    # timestamp columns (both card_record_review and mock_exam_sessions use
    # TIMESTAMP WITH TIME ZONE; midnight datetime is value-equivalent to a
    # bare date() cutoff for a UTC session — and standardizing avoids the
    # per-repo asymmetry where card used datetime.combine and the others used
    # bare date).
    cutoff = datetime.combine(
        date.today() - timedelta(days=MAX_STREAK_LOOKBACK_DAYS),
        datetime.min.time(),
    )

    card_branch = _date_branch(
        CardRecordReview, CardRecordReview.reviewed_at, "card", user_id, cutoff
    )
    culture_branch = _date_branch(
        CultureAnswerHistory, CultureAnswerHistory.created_at, "culture", user_id, cutoff
    )
    mock_branch = _date_branch(MockExamSession, MockExamSession.started_at, "mock", user_id, cutoff)

    result = await db.execute(union_all(card_branch, culture_branch, mock_branch))
    all_dates = sorted({row.d for row in result.all()}, reverse=True)

    return _compute_streak_from_dates(all_dates)


async def compute_vocabulary_streak(db: AsyncSession, user_id: UUID) -> int:
    """Compute current study streak for vocabulary (card reviews only).

    Args:
        db: Async database session.
        user_id: User UUID.

    Returns:
        Current consecutive-day streak (0 if no activity).
    """
    card_review_repo = CardRecordReviewRepository(db)
    vocab_dates = await card_review_repo.get_unique_dates(user_id, days=MAX_STREAK_LOOKBACK_DAYS)
    all_dates = sorted(set(vocab_dates), reverse=True)
    return _compute_streak_from_dates(all_dates)


async def compute_culture_streak(db: AsyncSession, user_id: UUID) -> int:
    """Compute current study streak for culture (culture answers + mock exams).

    Mock exam activity folds into the culture streak — locked product decision.
    Issues a single UNION ALL query spanning culture_answer_history and
    mock_exam_sessions (2→1 round-trip).

    Args:
        db: Async database session.
        user_id: User UUID.

    Returns:
        Current consecutive-day streak (0 if no activity).
    """
    cutoff = datetime.combine(
        date.today() - timedelta(days=MAX_STREAK_LOOKBACK_DAYS),
        datetime.min.time(),
    )

    culture_branch = _date_branch(
        CultureAnswerHistory, CultureAnswerHistory.created_at, "culture", user_id, cutoff
    )
    mock_branch = _date_branch(MockExamSession, MockExamSession.started_at, "mock", user_id, cutoff)

    result = await db.execute(union_all(culture_branch, mock_branch))
    all_dates = sorted({row.d for row in result.all()}, reverse=True)

    return _compute_streak_from_dates(all_dates)


async def compute_exercise_streak(db: AsyncSession, user_id: UUID) -> int:
    """Compute current study streak for exercises.

    Args:
        db: Async database session.
        user_id: User UUID.

    Returns:
        Current consecutive-day streak (0 if no activity).
    """
    exercise_review_repo = ExerciseReviewRepository(db)
    exercise_dates = await exercise_review_repo.get_unique_dates(
        user_id, days=MAX_STREAK_LOOKBACK_DAYS
    )
    all_dates = sorted(set(exercise_dates), reverse=True)
    return _compute_streak_from_dates(all_dates)


__all__ = [
    "compute_aggregated_streak",
    "compute_vocabulary_streak",
    "compute_culture_streak",
    "compute_exercise_streak",
]
