"""Aggregated streak computation for the gamification system.

Canonical streak logic owned by the gamification module. ``progress_service``
imports ``compute_aggregated_streak`` from here rather than maintaining its
own copy, keeping streak semantics in one place.
"""

from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.repositories.card_record_review import CardRecordReviewRepository
from src.repositories.culture_answer_history import CultureAnswerHistoryRepository
from src.repositories.exercise_review import ExerciseReviewRepository
from src.repositories.mock_exam import MockExamRepository

# Lookback window for streak aggregation. Must exceed the largest streak-day
# threshold in any AchievementDef so 60/100/365-day streak achievements are
# reachable through the projection. Bound the query by ~1y of activity.
MAX_STREAK_LOOKBACK_DAYS = 366


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

    Combines unique dates from all three activity sources, applies a one-day
    grace period (yesterday counts as "today" if today has no activity), and
    walks consecutive days from the most recent.

    Args:
        db: Async database session.
        user_id: User UUID.

    Returns:
        Current consecutive-day streak (0 if no activity).
    """
    import asyncio

    card_review_repo = CardRecordReviewRepository(db)
    culture_repo = CultureAnswerHistoryRepository(db)
    mock_exam_repo = MockExamRepository(db)

    vocab_dates, culture_dates, mock_dates = await asyncio.gather(
        card_review_repo.get_unique_dates(user_id, days=MAX_STREAK_LOOKBACK_DAYS),
        culture_repo.get_unique_dates(user_id, days=MAX_STREAK_LOOKBACK_DAYS),
        mock_exam_repo.get_unique_dates(user_id, days=MAX_STREAK_LOOKBACK_DAYS),
    )

    all_dates = sorted(
        set(vocab_dates) | set(culture_dates) | set(mock_dates),
        reverse=True,
    )

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

    Args:
        db: Async database session.
        user_id: User UUID.

    Returns:
        Current consecutive-day streak (0 if no activity).
    """
    import asyncio

    culture_repo = CultureAnswerHistoryRepository(db)
    mock_exam_repo = MockExamRepository(db)

    culture_dates, mock_dates = await asyncio.gather(
        culture_repo.get_unique_dates(user_id, days=MAX_STREAK_LOOKBACK_DAYS),
        mock_exam_repo.get_unique_dates(user_id, days=MAX_STREAK_LOOKBACK_DAYS),
    )

    all_dates = sorted(set(culture_dates) | set(mock_dates), reverse=True)
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
