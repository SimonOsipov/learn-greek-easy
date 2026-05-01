"""GamificationProjection — pure, read-only snapshot computation.

Reads raw activity data concurrently from multiple repositories, derives all
27 metric values, resolves unlocked achievements, computes total XP, and
returns an immutable GamificationSnapshot.

Zero DB writes — this module never calls add(), flush(), commit(), or delete().
"""

import asyncio
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import DeckLevel, UserSettings
from src.repositories.card_record_review import CardRecordReviewRepository, SessionAgg
from src.repositories.card_record_statistics import CardRecordStatisticsRepository
from src.repositories.culture_answer_history import CultureAnswerHistoryRepository
from src.repositories.culture_question_stats import CultureQuestionStatsRepository
from src.services.achievement_definitions import ACHIEVEMENTS, AchievementMetric
from src.services.gamification.streak import compute_aggregated_streak
from src.services.gamification.types import GamificationSnapshot, MetricValues
from src.services.gamification.version import GAMIFICATION_PROJECTION_VERSION
from src.services.xp_constants import (
    XP_CORRECT_ANSWER,
    XP_CULTURE_WRONG,
    XP_DAILY_GOAL,
    XP_FLASHCARD_CORRECT,
    XP_FLASHCARD_WRONG,
    XP_SESSION_COMPLETE,
    XP_STREAK_MULTIPLIER,
    get_level_from_xp,
)

# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _compute_session_accuracy(sessions: list[SessionAgg]) -> int:
    """Max session accuracy (%) across sessions with >= 20 cards; else 0."""
    eligible = [s for s in sessions if s.card_count >= 20]
    if not eligible:
        return 0
    return max(round(s.correct_count / s.card_count * 100) for s in eligible)


def _compute_session_speed_cpm(sessions: list[SessionAgg]) -> int:
    """Max cards-per-minute across sessions with >= 20 cards; else 0."""
    eligible = [s for s in sessions if s.card_count >= 20 and s.total_time_seconds > 0]
    if not eligible:
        return 0
    return max(int(s.card_count / (s.total_time_seconds / 60)) for s in eligible)


def _compute_earliest_hour_inverted(sessions: list[SessionAgg]) -> int:
    """Return ``24 - min_hour_utc`` across all sessions; 0 when no sessions.

    Smaller actual hour → larger stored value, so the standard ``>= threshold``
    comparator works for early-morning achievements.
    """
    if not sessions:
        return 0
    min_hour = min(s.min_hour_utc for s in sessions)
    return 24 - min_hour


def _compute_weekly_accuracy(correct: int, total: int) -> int:
    """Weekly accuracy %; returns 0 when fewer than 50 reviews (min cardinality)."""
    if total < 50:
        return 0
    return round(correct / total * 100)


def _is_cefr_complete(cefr_completion: dict[DeckLevel, tuple[int, int]], level: DeckLevel) -> int:
    """Return 1 if ``total > 0`` and ``mastered == total`` for this CEFR level; else 0."""
    mastered, total = cefr_completion.get(level, (0, 0))
    return 1 if total > 0 and mastered == total else 0


def _compute_daily_goal_streak(
    vocab_daily: list[tuple[date, int]],
    culture_daily: list[tuple[date, int]],
    daily_goal: int,
) -> int:
    """Count consecutive days ending today (or yesterday) where combined count >= daily_goal."""
    # Merge per-day counts into a single dict
    combined: dict[date, int] = {}
    for d, cnt in vocab_daily:
        combined[d] = combined.get(d, 0) + cnt
    for d, cnt in culture_daily:
        combined[d] = combined.get(d, 0) + cnt

    if not combined:
        return 0

    today = datetime.now(timezone.utc).date()
    # Grace: allow yesterday to anchor if today has no activity
    most_recent = max(combined)
    start = today if most_recent == today else today - timedelta(days=1)
    if most_recent > start or combined.get(start, 0) < daily_goal:
        if combined.get(start, 0) < daily_goal:
            return 0

    streak = 0
    expected = start
    while True:
        if combined.get(expected, 0) >= daily_goal:
            streak += 1
            expected = expected - timedelta(days=1)
        else:
            break
    return streak


def _compute_daily_goal_exceeded(
    vocab_daily: list[tuple[date, int]],
    culture_daily: list[tuple[date, int]],
    daily_goal: int,
) -> int:
    """Max ``(combined_count / daily_goal * 100)`` across all days; 0 if no days."""
    combined: dict[date, int] = {}
    for d, cnt in vocab_daily:
        combined[d] = combined.get(d, 0) + cnt
    for d, cnt in culture_daily:
        combined[d] = combined.get(d, 0) + cnt

    if not combined or daily_goal <= 0:
        return 0
    return max(int(cnt / daily_goal * 100) for cnt in combined.values())


def _compute_culture_accuracy(correct: int, total: int) -> int:
    """Culture accuracy %; returns 0 when fewer than 20 answers (min cardinality)."""
    if total < 20:
        return 0
    return round(correct / total * 100)


def _is_culture_category_mastered(
    category_counts: dict[str, tuple[int, int]], category: str
) -> int:
    """Return 1 if the category has total > 0 and all questions are mastered; else 0."""
    mastered, total = category_counts.get(category, (0, 0))
    return 1 if total > 0 and mastered == total else 0


def _is_culture_all_mastered(category_counts: dict[str, tuple[int, int]]) -> int:
    """Return 1 if every category with total > 0 has mastered == total.

    Dynamic interpretation: does not hardcode a category list.  At least one
    category must have total > 0 (an empty DB should not grant the achievement).

    Documented behaviour: CULTURE_ALL_MASTERED uses whichever categories are
    present in the database at compute time, not a fixed enum list.
    """
    active = [(m, t) for m, t in category_counts.values() if t > 0]
    if not active:
        return 0
    return 1 if all(m == t for m, t in active) else 0


def _compute_action_xp(
    *,
    total_reviews: int,
    weekly_correct: int,
    weekly_total: int,
    culture_total: int,
    culture_correct: int,
    streak_days: int,
    sessions: list[SessionAgg],
    vocab_daily: list[tuple[date, int]],
    culture_daily: list[tuple[date, int]],
    daily_goal: int,
) -> int:
    """Compute XP earned from individual actions (not from achievement unlocks).

    Terms included:
    - Flashcard reviews: correct get XP_FLASHCARD_CORRECT, wrong get XP_FLASHCARD_WRONG
    - Culture answers: correct get XP_CORRECT_ANSWER, wrong get XP_CULTURE_WRONG
    - Daily goal hits: XP_DAILY_GOAL per day the goal was hit
    - Session completions: XP_SESSION_COMPLETE per session
    - Streak bonus: XP_STREAK_MULTIPLIER * streak_days (additive, not multiplicative)

    Note: All correct culture answers use XP_CORRECT_ANSWER as the base rate.
    Phase 2 shadow mode will surface any mismatches with legacy XP paths.
    """
    xp = 0

    # Flashcard reviews: approximate split by weekly accuracy ratio (or 50/50 when no data)
    if weekly_total > 0:
        correct_ratio = weekly_correct / weekly_total
    else:
        correct_ratio = 0.5
    flashcard_correct = round(total_reviews * correct_ratio)
    flashcard_wrong = total_reviews - flashcard_correct
    xp += flashcard_correct * XP_FLASHCARD_CORRECT  # correct flashcard reviews
    xp += flashcard_wrong * XP_FLASHCARD_WRONG  # wrong flashcard reviews (encouragement)

    # Culture answers
    xp += culture_correct * XP_CORRECT_ANSWER  # correct culture answers
    culture_wrong = culture_total - culture_correct
    xp += culture_wrong * XP_CULTURE_WRONG  # wrong culture answers (encouragement)

    # Daily goal hits
    combined: dict[date, int] = {}
    for d, cnt in vocab_daily:
        combined[d] = combined.get(d, 0) + cnt
    for d, cnt in culture_daily:
        combined[d] = combined.get(d, 0) + cnt
    days_goal_hit = sum(1 for cnt in combined.values() if cnt >= daily_goal)
    xp += days_goal_hit * XP_DAILY_GOAL  # daily goal completions

    # Session completions
    xp += len(sessions) * XP_SESSION_COMPLETE  # one per detected session

    # Streak bonus (additive multiplier)
    xp += streak_days * XP_STREAK_MULTIPLIER  # streak day bonus

    return xp


class GamificationProjection:
    """Pure read-only snapshot computation.

    Usage::

        snapshot = await GamificationProjection.compute(db, user_id)

    The returned GamificationSnapshot is immutable.  This class never writes
    to the database.
    """

    @classmethod
    async def compute(cls, db: AsyncSession, user_id: UUID) -> GamificationSnapshot:
        """Compute a complete GamificationSnapshot for a user.

        Reads all required data concurrently, derives all 27 metric values,
        resolves unlocked achievements, computes XP and level, and returns an
        immutable snapshot.

        Zero DB writes: no add(), flush(), commit(), or delete() calls.

        Args:
            db: Async database session (read-only usage).
            user_id: User UUID.

        Returns:
            Immutable GamificationSnapshot with all metrics populated.
        """
        # ----------------------------------------------------------------
        # 1. Instantiate repositories
        # ----------------------------------------------------------------
        card_review_repo = CardRecordReviewRepository(db)
        card_stats_repo = CardRecordStatisticsRepository(db)
        culture_history_repo = CultureAnswerHistoryRepository(db)
        culture_stats_repo = CultureQuestionStatsRepository(db)

        # ----------------------------------------------------------------
        # 2. Concurrent reads via asyncio.gather
        # ----------------------------------------------------------------
        results = await asyncio.gather(
            compute_aggregated_streak(db, user_id),
            card_stats_repo.count_by_status(user_id),
            card_review_repo.get_total_reviews(user_id),
            card_review_repo.get_session_aggregates(user_id),
            card_review_repo.get_weekly_accuracy(user_id),
            card_review_repo.get_consecutive_correct_streak(user_id),
            card_stats_repo.get_cefr_completion(user_id),
            card_review_repo.get_max_inactive_gap_days(user_id),
            card_review_repo.get_daily_review_counts(user_id),
            culture_history_repo.get_total_answers(user_id),
            culture_history_repo.get_correct_answers_count(user_id),
            culture_history_repo.get_consecutive_correct_streak(user_id),
            culture_stats_repo.get_category_mastery_counts(user_id),
            culture_history_repo.count_by_language(user_id, "el"),
            culture_history_repo.count_distinct_languages(user_id),
            culture_history_repo.get_daily_answer_counts(user_id),
        )

        # Unpack with explicit types so mypy can track them
        streak_days: int = results[0]  # type: ignore[assignment]
        count_by_status: dict[str, int] = results[1]  # type: ignore[assignment]
        total_reviews: int = results[2]  # type: ignore[assignment]
        sessions: list[SessionAgg] = results[3]  # type: ignore[assignment]
        weekly_correct_total: tuple[int, int] = results[4]  # type: ignore[assignment]
        consecutive_correct: int = results[5]  # type: ignore[assignment]
        cefr_completion: dict[DeckLevel, tuple[int, int]] = results[6]  # type: ignore[assignment]
        max_inactive_gap: int = results[7]  # type: ignore[assignment]
        vocab_daily: list[tuple[date, int]] = results[8]  # type: ignore[assignment]
        culture_total: int = results[9]  # type: ignore[assignment]
        culture_correct: int = results[10]  # type: ignore[assignment]
        culture_consec: int = results[11]  # type: ignore[assignment]
        culture_categories: dict[str, tuple[int, int]] = results[12]  # type: ignore[assignment]
        culture_greek: int = results[13]  # type: ignore[assignment]
        culture_languages: int = results[14]  # type: ignore[assignment]
        culture_daily: list[tuple[date, int]] = results[15]  # type: ignore[assignment]

        # ----------------------------------------------------------------
        # 3. Fetch daily_goal inline (UserSettings may be absent for new users)
        # ----------------------------------------------------------------
        settings_result = await db.execute(
            select(UserSettings).where(UserSettings.user_id == user_id)
        )
        settings_row = settings_result.scalar_one_or_none()
        daily_goal: int = getattr(settings_row, "daily_goal", None) or 20

        # ----------------------------------------------------------------
        # 4. Unpack derived values
        # ----------------------------------------------------------------
        weekly_correct, weekly_total = weekly_correct_total

        # CARDS_LEARNED = non-NEW buckets (LEARNING + REVIEW + MASTERED)
        cards_learned = (
            count_by_status.get("learning", 0)
            + count_by_status.get("review", 0)
            + count_by_status.get("mastered", 0)
        )
        cards_mastered = count_by_status.get("mastered", 0)

        # ----------------------------------------------------------------
        # 5. Build MetricValues — explicit assignment for all 27 metrics
        # ----------------------------------------------------------------
        metrics = MetricValues(
            {
                # Core
                AchievementMetric.STREAK_DAYS: streak_days,
                AchievementMetric.CARDS_LEARNED: cards_learned,
                AchievementMetric.CARDS_MASTERED: cards_mastered,
                AchievementMetric.TOTAL_REVIEWS: total_reviews,
                # Session
                AchievementMetric.SESSION_CARDS: max((s.card_count for s in sessions), default=0),
                AchievementMetric.SESSION_ACCURACY: _compute_session_accuracy(sessions),
                AchievementMetric.SESSION_SPEED_CPM: _compute_session_speed_cpm(sessions),
                AchievementMetric.SESSION_HOUR_LATEST: max(
                    (s.max_hour_utc for s in sessions), default=0
                ),
                AchievementMetric.SESSION_HOUR_EARLIEST: _compute_earliest_hour_inverted(sessions),
                # Accuracy
                AchievementMetric.WEEKLY_ACCURACY: _compute_weekly_accuracy(
                    weekly_correct, weekly_total
                ),
                AchievementMetric.CONSECUTIVE_CORRECT: consecutive_correct,
                # CEFR
                AchievementMetric.CEFR_A1_COMPLETE: _is_cefr_complete(
                    cefr_completion, DeckLevel.A1
                ),
                AchievementMetric.CEFR_A2_COMPLETE: _is_cefr_complete(
                    cefr_completion, DeckLevel.A2
                ),
                AchievementMetric.CEFR_B1_COMPLETE: _is_cefr_complete(
                    cefr_completion, DeckLevel.B1
                ),
                AchievementMetric.CEFR_B2_COMPLETE: _is_cefr_complete(
                    cefr_completion, DeckLevel.B2
                ),
                # Special
                AchievementMetric.FIRST_REVIEW: 1 if total_reviews > 0 else 0,
                AchievementMetric.INACTIVE_RETURN: max_inactive_gap,
                AchievementMetric.DAILY_GOAL_STREAK: _compute_daily_goal_streak(
                    vocab_daily, culture_daily, daily_goal
                ),
                AchievementMetric.DAILY_GOAL_EXCEEDED: _compute_daily_goal_exceeded(
                    vocab_daily, culture_daily, daily_goal
                ),
                # Culture
                AchievementMetric.CULTURE_QUESTIONS_ANSWERED: culture_total,
                AchievementMetric.CULTURE_CONSECUTIVE_CORRECT: culture_consec,
                AchievementMetric.CULTURE_ACCURACY: _compute_culture_accuracy(
                    culture_correct, culture_total
                ),
                AchievementMetric.CULTURE_HISTORY_MASTERED: _is_culture_category_mastered(
                    culture_categories, "history"
                ),
                AchievementMetric.CULTURE_GEOGRAPHY_MASTERED: _is_culture_category_mastered(
                    culture_categories, "geography"
                ),
                AchievementMetric.CULTURE_POLITICS_MASTERED: _is_culture_category_mastered(
                    culture_categories, "politics"
                ),
                AchievementMetric.CULTURE_ALL_MASTERED: _is_culture_all_mastered(
                    culture_categories
                ),
                AchievementMetric.CULTURE_GREEK_QUESTIONS: culture_greek,
                AchievementMetric.CULTURE_LANGUAGES_USED: culture_languages,
            }
        )

        # ----------------------------------------------------------------
        # 6. Resolve unlocked achievements
        # ----------------------------------------------------------------
        unlocked: frozenset[str] = frozenset(
            a.id for a in ACHIEVEMENTS if metrics[a.metric] >= a.threshold
        )

        # ----------------------------------------------------------------
        # 7. Compute total XP = unlock rewards + action XP
        # ----------------------------------------------------------------
        xp_from_unlocks = sum(a.xp_reward for a in ACHIEVEMENTS if a.id in unlocked)
        xp_from_actions = _compute_action_xp(
            total_reviews=total_reviews,
            weekly_correct=weekly_correct,
            weekly_total=weekly_total,
            culture_total=culture_total,
            culture_correct=culture_correct,
            streak_days=streak_days,
            sessions=sessions,
            vocab_daily=vocab_daily,
            culture_daily=culture_daily,
            daily_goal=daily_goal,
        )
        total_xp = xp_from_unlocks + xp_from_actions

        # ----------------------------------------------------------------
        # 8. Compute level
        # ----------------------------------------------------------------
        current_level = get_level_from_xp(total_xp)

        # ----------------------------------------------------------------
        # 9. Return snapshot
        # ----------------------------------------------------------------
        return GamificationSnapshot(
            user_id=user_id,
            metrics=metrics,
            unlocked=unlocked,
            total_xp=total_xp,
            current_level=current_level,
            projection_version=GAMIFICATION_PROJECTION_VERSION,
            computed_at=datetime.now(timezone.utc),
        )


__all__ = ["GamificationProjection"]
