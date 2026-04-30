"""Aggregated streak computation for the gamification system.

Free function that mirrors ``progress_service._get_aggregated_streak`` but
instantiates repositories directly from ``db`` — no import of progress_service
to avoid a circular dependency when Phase 6 inverts the dependency.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.repositories.card_record_review import CardRecordReviewRepository
from src.repositories.culture_answer_history import CultureAnswerHistoryRepository
from src.repositories.mock_exam import MockExamRepository

# Lookback window for streak aggregation. Must exceed the largest streak-day
# threshold in any AchievementDef so 60/100/365-day streak achievements are
# reachable through the projection. Bound the query by ~1y of activity.
MAX_STREAK_LOOKBACK_DAYS = 366


async def compute_aggregated_streak(db: AsyncSession, user_id: UUID) -> int:
    """Compute combined study streak across vocab, culture, and mock exams.

    Combines unique dates from all three activity sources, applies a one-day
    grace period (yesterday counts as "today" if today has no activity), and
    walks consecutive days from the most recent.

    In Phase 6 (GAMIF-06-07), progress_service will import this canonical
    version and drop its own copy.

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

    if not all_dates:
        return 0

    today = datetime.now(timezone.utc).date()
    # Grace period: allow yesterday to anchor the streak if nothing today
    start = today if all_dates[0] == today else today - timedelta(days=1)
    if all_dates[0] > start:
        return 0

    streak = 0
    expected = start
    for d in all_dates:
        if d == expected:
            streak += 1
            expected = d - timedelta(days=1)
        elif d < expected:
            break

    return streak


__all__ = ["compute_aggregated_streak"]
