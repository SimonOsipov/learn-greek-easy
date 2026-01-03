"""Achievement Service for tracking and unlocking achievements.

This service handles:
- Achievement unlock logic (idempotent)
- Progress tracking for achievements
- XP rewards on unlock
- Notification tracking for celebration UI
- Culture exam achievement checking
"""

from typing import Optional, TypedDict
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging import get_logger
from src.db.models import (
    Achievement,
    CardStatistics,
    CardStatus,
    CultureAnswerHistory,
    CultureDeck,
    CultureQuestion,
    CultureQuestionStats,
    Review,
    UserAchievement,
)
from src.services.achievement_definitions import (
    ACHIEVEMENTS,
    AchievementDef,
    AchievementMetric,
    get_achievement_by_id,
    get_achievements_by_metric,
)
from src.services.xp_service import XPService

logger = get_logger(__name__)


class UnlockedAchievement(TypedDict):
    """Result of unlocking an achievement."""

    id: str
    name: str
    icon: str
    xp_reward: int


class AchievementProgress(TypedDict):
    """Achievement with progress information."""

    id: str
    name: str
    description: str
    category: str
    icon: str
    hint: str
    threshold: int
    xp_reward: int
    unlocked: bool
    unlocked_at: Optional[str]
    progress: float
    current_value: int


class AchievementService:
    """Service for achievement operations."""

    def __init__(self, db: AsyncSession):
        """Initialize achievement service with database session.

        Args:
            db: Async database session
        """
        self.db = db
        self.xp_service = XPService(db)

    async def get_user_achievements(self, user_id: UUID) -> list[AchievementProgress]:
        """Get all achievements with user's unlock status and progress.

        Args:
            user_id: The user's UUID

        Returns:
            List of all achievements with progress information
        """
        # Get user's unlocked achievements
        result = await self.db.execute(
            select(UserAchievement).where(UserAchievement.user_id == user_id)
        )
        unlocked = {ua.achievement_id: ua for ua in result.scalars().all()}

        # Get user stats for progress calculation
        stats = await self._get_user_stats(user_id)

        achievements: list[AchievementProgress] = []
        for ach_def in ACHIEVEMENTS:
            is_unlocked = ach_def.id in unlocked
            user_ach = unlocked.get(ach_def.id)

            # Calculate progress
            current_value = self._get_metric_value(ach_def.metric, stats)
            progress = 0.0
            if ach_def.threshold > 0:
                progress = min((current_value / ach_def.threshold) * 100, 100.0)

            achievements.append(
                AchievementProgress(
                    id=ach_def.id,
                    name=ach_def.name,
                    description=ach_def.description,
                    category=ach_def.category.value,
                    icon=ach_def.icon,
                    hint=ach_def.hint,
                    threshold=ach_def.threshold,
                    xp_reward=ach_def.xp_reward,
                    unlocked=is_unlocked,
                    unlocked_at=(user_ach.unlocked_at.isoformat() if user_ach else None),
                    progress=round(progress, 1),
                    current_value=current_value,
                )
            )

        return achievements

    async def check_and_unlock_achievements(
        self,
        user_id: UUID,
        metric: AchievementMetric,
        value: int,
    ) -> list[UnlockedAchievement]:
        """Check if any achievements should be unlocked based on metric.

        This method is idempotent - calling it multiple times with the same
        values will not create duplicate unlocks.

        Args:
            user_id: The user's UUID
            metric: The metric that triggered the check
            value: The current value for that metric

        Returns:
            List of newly unlocked achievements
        """
        newly_unlocked: list[UnlockedAchievement] = []

        # Get achievements that use this metric
        relevant_achievements = get_achievements_by_metric(metric)

        for ach_def in relevant_achievements:
            if value >= ach_def.threshold:
                unlocked = await self._try_unlock_achievement(user_id, ach_def)
                if unlocked:
                    newly_unlocked.append(
                        UnlockedAchievement(
                            id=ach_def.id,
                            name=ach_def.name,
                            icon=ach_def.icon,
                            xp_reward=ach_def.xp_reward,
                        )
                    )

        return newly_unlocked

    async def _try_unlock_achievement(
        self,
        user_id: UUID,
        ach_def: AchievementDef,
    ) -> bool:
        """Try to unlock an achievement. Returns True if newly unlocked.

        This method is idempotent - it checks if the achievement is already
        unlocked before creating a new record.

        Args:
            user_id: The user's UUID
            ach_def: The achievement definition to unlock

        Returns:
            True if newly unlocked, False if already unlocked
        """
        # Check if already unlocked
        result = await self.db.execute(
            select(UserAchievement).where(
                UserAchievement.user_id == user_id,
                UserAchievement.achievement_id == ach_def.id,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            return False  # Already unlocked

        # Ensure achievement exists in the database
        await self._ensure_achievement_exists(ach_def)

        # Unlock it
        user_achievement = UserAchievement(
            user_id=user_id,
            achievement_id=ach_def.id,
            notified=False,
        )
        self.db.add(user_achievement)

        # Award XP
        if ach_def.xp_reward > 0:
            await self.xp_service.award_xp(
                user_id,
                ach_def.xp_reward,
                f"achievement_{ach_def.id}",
            )

        await self.db.flush()

        # Create achievement notification (late import to avoid circular deps)
        try:
            from src.services.notification_service import NotificationService

            notification_service = NotificationService(self.db)
            await notification_service.notify_achievement_unlocked(
                user_id=user_id,
                achievement_id=ach_def.id,
                achievement_name=ach_def.name,
                icon=ach_def.icon,
                xp_reward=ach_def.xp_reward,
            )
        except Exception as e:
            logger.warning(
                "Failed to create achievement notification",
                extra={
                    "user_id": str(user_id),
                    "achievement_id": ach_def.id,
                    "error": str(e),
                },
            )
            # Don't fail achievement unlock if notification fails

        logger.info(
            "Achievement unlocked",
            extra={
                "user_id": str(user_id),
                "achievement_id": ach_def.id,
                "xp_reward": ach_def.xp_reward,
            },
        )

        return True

    async def _ensure_achievement_exists(self, ach_def: AchievementDef) -> None:
        """Ensure the achievement exists in the database.

        Creates the achievement record if it doesn't exist.

        Args:
            ach_def: The achievement definition
        """
        result = await self.db.execute(select(Achievement).where(Achievement.id == ach_def.id))
        existing = result.scalar_one_or_none()

        if not existing:
            achievement = Achievement(
                id=ach_def.id,
                name=ach_def.name,
                description=ach_def.description,
                category=ach_def.category,
                icon=ach_def.icon,
                threshold=ach_def.threshold,
                xp_reward=ach_def.xp_reward,
            )
            self.db.add(achievement)
            await self.db.flush()

    async def _get_user_stats(self, user_id: UUID) -> dict:
        """Get user statistics for progress calculation.

        Args:
            user_id: The user's UUID

        Returns:
            Dictionary of user stats
        """
        # Cards learned (any status beyond NEW)
        result = await self.db.execute(
            select(func.count()).where(
                CardStatistics.user_id == user_id,
                CardStatistics.status != CardStatus.NEW,
            )
        )
        cards_learned = result.scalar() or 0

        # Cards mastered
        result = await self.db.execute(
            select(func.count()).where(
                CardStatistics.user_id == user_id,
                CardStatistics.status == CardStatus.MASTERED,
            )
        )
        cards_mastered = result.scalar() or 0

        # Total reviews
        result = await self.db.execute(select(func.count()).where(Review.user_id == user_id))
        total_reviews = result.scalar() or 0

        return {
            "cards_learned": cards_learned,
            "cards_mastered": cards_mastered,
            "total_reviews": total_reviews,
            "current_streak": 0,  # Will be calculated by caller if needed
            "longest_streak": 0,
        }

    def _get_metric_value(self, metric: AchievementMetric, stats: dict) -> int:
        """Get current value for a metric from stats.

        Args:
            metric: The achievement metric
            stats: Dictionary of user stats

        Returns:
            Current value for the metric (0 if not found)
        """
        metric_map: dict[AchievementMetric, str] = {
            AchievementMetric.STREAK_DAYS: "current_streak",
            AchievementMetric.CARDS_LEARNED: "cards_learned",
            AchievementMetric.CARDS_MASTERED: "cards_mastered",
            AchievementMetric.TOTAL_REVIEWS: "total_reviews",
        }
        stat_key = metric_map.get(metric, "")
        value: int = stats.get(stat_key, 0)
        return value

    async def get_unnotified_achievements(self, user_id: UUID) -> list[UnlockedAchievement]:
        """Get achievements that user hasn't been notified about yet.

        Used by the frontend to show celebration animations.

        Args:
            user_id: The user's UUID

        Returns:
            List of unnotified achievements
        """
        result = await self.db.execute(
            select(UserAchievement).where(
                UserAchievement.user_id == user_id,
                UserAchievement.notified == False,  # noqa: E712
            )
        )
        unnotified = result.scalars().all()

        achievements: list[UnlockedAchievement] = []
        for ua in unnotified:
            ach_def = get_achievement_by_id(ua.achievement_id)
            if ach_def:
                achievements.append(
                    UnlockedAchievement(
                        id=ach_def.id,
                        name=ach_def.name,
                        icon=ach_def.icon,
                        xp_reward=ach_def.xp_reward,
                    )
                )

        return achievements

    async def mark_achievements_notified(self, user_id: UUID, achievement_ids: list[str]) -> None:
        """Mark achievements as notified.

        Called after the frontend has shown the celebration animation.

        Args:
            user_id: The user's UUID
            achievement_ids: List of achievement IDs to mark as notified
        """
        for ach_id in achievement_ids:
            result = await self.db.execute(
                select(UserAchievement).where(
                    UserAchievement.user_id == user_id,
                    UserAchievement.achievement_id == ach_id,
                )
            )
            ua = result.scalar_one_or_none()
            if ua:
                ua.notified = True

        await self.db.flush()

    async def unlock_achievement_by_id(
        self, user_id: UUID, achievement_id: str
    ) -> Optional[UnlockedAchievement]:
        """Unlock a specific achievement by ID.

        Useful for manually triggering achievements or for special achievements.

        Args:
            user_id: The user's UUID
            achievement_id: The achievement ID to unlock

        Returns:
            The unlocked achievement, or None if already unlocked or not found
        """
        ach_def = get_achievement_by_id(achievement_id)
        if not ach_def:
            return None

        unlocked = await self._try_unlock_achievement(user_id, ach_def)
        if unlocked:
            return UnlockedAchievement(
                id=ach_def.id,
                name=ach_def.name,
                icon=ach_def.icon,
                xp_reward=ach_def.xp_reward,
            )

        return None

    # =========================================================================
    # Culture Achievement Methods
    # =========================================================================

    async def check_culture_achievements(
        self,
        user_id: UUID,
        question_id: UUID,
        is_correct: bool,
        language: str,
        deck_category: str,
    ) -> list[UnlockedAchievement]:
        """Check and unlock culture-specific achievements after a culture answer.

        Checks all 12 culture achievement types:
        - Milestone: total questions answered (10, 50, 100, 500)
        - Accuracy: consecutive correct (10), overall accuracy (90%+)
        - Category mastery: history, geography, politics, all categories
        - Language: Greek questions (50), polyglot (3 languages)

        Args:
            user_id: The user's UUID
            question_id: The answered question's UUID
            is_correct: Whether the answer was correct
            language: Language used for the question (el, en, ru)
            deck_category: The deck's category

        Returns:
            List of newly unlocked achievements
        """
        newly_unlocked: list[UnlockedAchievement] = []

        # Get culture stats for this user (queries CultureAnswerHistory)
        stats = await self._get_culture_stats(user_id)

        logger.debug(
            "Culture achievement check starting",
            extra={
                "user_id": str(user_id),
                "total_answered": stats["total_answered"],
                "current_streak": stats["current_streak"],
                "languages_used": list(stats["languages_used"]),
            },
        )

        # Check milestone achievements (10, 50, 100, 500 questions)
        milestone_unlocks = await self._check_culture_milestone_achievements(user_id, stats)
        newly_unlocked.extend(milestone_unlocks)

        # Check accuracy achievements (streak, accuracy %)
        accuracy_unlocks = await self._check_culture_accuracy_achievements(user_id, stats)
        newly_unlocked.extend(accuracy_unlocks)

        # Check category mastery achievements
        mastery_unlocks = await self._check_culture_mastery_achievements(user_id, stats)
        newly_unlocked.extend(mastery_unlocks)

        # Check language achievements (Greek questions, polyglot)
        language_unlocks = await self._check_culture_language_achievements(user_id, stats)
        newly_unlocked.extend(language_unlocks)

        # Track PostHog events for each unlock
        for achievement in newly_unlocked:
            await self._track_culture_achievement_unlock(user_id, achievement)

        if newly_unlocked:
            logger.info(
                "Culture achievements unlocked",
                extra={
                    "user_id": str(user_id),
                    "unlocked_count": len(newly_unlocked),
                    "achievement_ids": [a["id"] for a in newly_unlocked],
                },
            )

        return newly_unlocked

    async def _get_culture_stats(self, user_id: UUID) -> dict:
        """Get culture question statistics for achievement checking.

        Queries CultureAnswerHistory for accurate language and streak tracking.

        Returns:
            Dictionary with keys:
            - total_answered: int
            - total_correct: int
            - accuracy_percent: float
            - current_streak: int (consecutive correct)
            - history_mastered: bool
            - geography_mastered: bool
            - politics_mastered: bool
            - culture_mastered: bool
            - traditions_mastered: bool
            - all_mastered: bool
            - questions_in_greek: int (from CultureAnswerHistory)
            - questions_in_english: int
            - questions_in_russian: int
            - languages_used: set[str] (unique languages from history)
        """
        # === Query CultureAnswerHistory for accurate stats ===

        # Total answered and correct (from history)
        result = await self.db.execute(
            select(
                func.count(CultureAnswerHistory.id).label("total"),
                func.sum(case((CultureAnswerHistory.is_correct.is_(True), 1), else_=0)).label(
                    "correct"
                ),
            ).where(CultureAnswerHistory.user_id == user_id)
        )
        row = result.one()
        total_answered = row.total or 0
        total_correct = row.correct or 0

        # Accuracy calculation
        accuracy_percent = (total_correct / total_answered * 100) if total_answered > 0 else 0.0

        # === Language counts from CultureAnswerHistory ===
        result = await self.db.execute(
            select(
                CultureAnswerHistory.language, func.count(CultureAnswerHistory.id).label("count")
            )
            .where(CultureAnswerHistory.user_id == user_id)
            .group_by(CultureAnswerHistory.language)
        )
        language_counts = {row.language: row.count for row in result.all()}

        questions_in_greek = language_counts.get("el", 0)
        questions_in_english = language_counts.get("en", 0)
        questions_in_russian = language_counts.get("ru", 0)
        languages_used = set(language_counts.keys())

        # === Consecutive streak from CultureAnswerHistory ===
        # Get recent answers ordered by time, count consecutive correct from most recent
        result = await self.db.execute(
            select(CultureAnswerHistory.is_correct)
            .where(CultureAnswerHistory.user_id == user_id)
            .order_by(CultureAnswerHistory.created_at.desc())
            .limit(100)  # Check last 100 answers max
        )
        recent_answers = [row.is_correct for row in result.all()]

        current_streak = 0
        for is_correct in recent_answers:
            if is_correct:
                current_streak += 1
            else:
                break  # Streak broken

        # === Category mastery checks (from CultureQuestionStats) ===
        history_mastered = await self._is_category_mastered(user_id, "history")
        geography_mastered = await self._is_category_mastered(user_id, "geography")
        politics_mastered = await self._is_category_mastered(user_id, "politics")
        culture_mastered = await self._is_category_mastered(user_id, "culture")
        traditions_mastered = await self._is_category_mastered(user_id, "traditions")

        all_mastered = all(
            [
                history_mastered,
                geography_mastered,
                politics_mastered,
                culture_mastered,
                traditions_mastered,
            ]
        )

        return {
            "total_answered": total_answered,
            "total_correct": total_correct,
            "accuracy_percent": accuracy_percent,
            "current_streak": current_streak,
            "history_mastered": history_mastered,
            "geography_mastered": geography_mastered,
            "politics_mastered": politics_mastered,
            "culture_mastered": culture_mastered,
            "traditions_mastered": traditions_mastered,
            "all_mastered": all_mastered,
            "questions_in_greek": questions_in_greek,
            "questions_in_english": questions_in_english,
            "questions_in_russian": questions_in_russian,
            "languages_used": languages_used,
        }

    async def _is_category_mastered(self, user_id: UUID, category: str) -> bool:
        """Check if user has mastered all questions in a category.

        A category is mastered when all questions in decks of that category
        have been answered and have MASTERED status.

        Args:
            user_id: User to check
            category: Category name (history, geography, politics, culture, traditions)

        Returns:
            True if all questions in category are mastered
        """
        # Get total questions in category
        total_query = (
            select(func.count(CultureQuestion.id))
            .join(CultureDeck, CultureQuestion.deck_id == CultureDeck.id)
            .where(
                CultureDeck.category == category,
                CultureDeck.is_active == True,  # noqa: E712
            )
        )
        total_result = await self.db.execute(total_query)
        total_questions = total_result.scalar_one() or 0

        if total_questions == 0:
            return False  # No questions in category

        # Get mastered questions in category
        mastered_query = (
            select(func.count(CultureQuestionStats.id))
            .join(CultureQuestion, CultureQuestionStats.question_id == CultureQuestion.id)
            .join(CultureDeck, CultureQuestion.deck_id == CultureDeck.id)
            .where(
                CultureQuestionStats.user_id == user_id,
                CultureDeck.category == category,
                CultureDeck.is_active == True,  # noqa: E712
                CultureQuestionStats.status == CardStatus.MASTERED,
            )
        )
        mastered_result = await self.db.execute(mastered_query)
        mastered_count = mastered_result.scalar_one() or 0

        return mastered_count >= total_questions

    async def _check_culture_milestone_achievements(
        self, user_id: UUID, stats: dict
    ) -> list[UnlockedAchievement]:
        """Check milestone achievements (10, 50, 100, 500 questions answered).

        Args:
            user_id: User to check
            stats: Culture stats dictionary

        Returns:
            List of newly unlocked achievements
        """
        unlocked: list[UnlockedAchievement] = []
        total = stats["total_answered"]

        # Culture Curious: 10 questions
        if total >= 10:
            ach = await self._try_unlock_culture_achievement(user_id, "culture_curious")
            if ach:
                unlocked.append(ach)

        # Culture Explorer: 50 questions
        if total >= 50:
            ach = await self._try_unlock_culture_achievement(user_id, "culture_explorer")
            if ach:
                unlocked.append(ach)

        # Culture Scholar: 100 questions
        if total >= 100:
            ach = await self._try_unlock_culture_achievement(user_id, "culture_scholar")
            if ach:
                unlocked.append(ach)

        # Culture Master: 500 questions
        if total >= 500:
            ach = await self._try_unlock_culture_achievement(user_id, "culture_master")
            if ach:
                unlocked.append(ach)

        return unlocked

    async def _check_culture_accuracy_achievements(
        self, user_id: UUID, stats: dict
    ) -> list[UnlockedAchievement]:
        """Check accuracy achievements (consecutive correct, overall accuracy).

        Args:
            user_id: User to check
            stats: Culture stats dictionary

        Returns:
            List of newly unlocked achievements
        """
        unlocked: list[UnlockedAchievement] = []

        # Perfect Culture Score: 10 consecutive correct
        if stats["current_streak"] >= 10:
            ach = await self._try_unlock_culture_achievement(user_id, "perfect_culture_score")
            if ach:
                unlocked.append(ach)

        # Culture Sharp Mind: 90% accuracy (with at least 20 answers)
        if stats["total_answered"] >= 20 and stats["accuracy_percent"] >= 90:
            ach = await self._try_unlock_culture_achievement(user_id, "culture_sharp_mind")
            if ach:
                unlocked.append(ach)

        return unlocked

    async def _check_culture_mastery_achievements(
        self, user_id: UUID, stats: dict
    ) -> list[UnlockedAchievement]:
        """Check category mastery achievements.

        Args:
            user_id: User to check
            stats: Culture stats dictionary

        Returns:
            List of newly unlocked achievements
        """
        unlocked: list[UnlockedAchievement] = []

        # Historian: Master all history questions
        if stats["history_mastered"]:
            ach = await self._try_unlock_culture_achievement(user_id, "culture_historian")
            if ach:
                unlocked.append(ach)

        # Geographer: Master all geography questions
        if stats["geography_mastered"]:
            ach = await self._try_unlock_culture_achievement(user_id, "culture_geographer")
            if ach:
                unlocked.append(ach)

        # Civic Expert: Master all politics questions
        if stats["politics_mastered"]:
            ach = await self._try_unlock_culture_achievement(user_id, "culture_civic_expert")
            if ach:
                unlocked.append(ach)

        # Culture Champion: Master ALL categories
        if stats["all_mastered"]:
            ach = await self._try_unlock_culture_achievement(user_id, "culture_champion")
            if ach:
                unlocked.append(ach)

        return unlocked

    async def _check_culture_language_achievements(
        self, user_id: UUID, stats: dict
    ) -> list[UnlockedAchievement]:
        """Check language-based achievements.

        - native_speaker: 50 questions answered in Greek
        - polyglot_learner: Used all 3 languages (el, en, ru)

        Args:
            user_id: User to check
            stats: Culture stats dictionary

        Returns:
            List of newly unlocked achievements
        """
        unlocked: list[UnlockedAchievement] = []

        # Native Speaker: 50 questions in Greek
        if stats["questions_in_greek"] >= 50:
            ach = await self._try_unlock_culture_achievement(user_id, "culture_native_speaker")
            if ach:
                unlocked.append(ach)

        # Polyglot Learner: All 3 languages used
        if len(stats["languages_used"]) >= 3:
            ach = await self._try_unlock_culture_achievement(user_id, "culture_polyglot_learner")
            if ach:
                unlocked.append(ach)

        return unlocked

    async def _try_unlock_culture_achievement(
        self, user_id: UUID, achievement_id: str
    ) -> Optional[UnlockedAchievement]:
        """Try to unlock a culture achievement by ID.

        Args:
            user_id: User to unlock for
            achievement_id: Achievement ID to unlock

        Returns:
            UnlockedAchievement if newly unlocked, None otherwise
        """
        ach_def = get_achievement_by_id(achievement_id)
        if not ach_def:
            logger.warning(
                "Culture achievement not found",
                extra={"achievement_id": achievement_id},
            )
            return None

        unlocked = await self._try_unlock_achievement(user_id, ach_def)
        if unlocked:
            return UnlockedAchievement(
                id=ach_def.id,
                name=ach_def.name,
                icon=ach_def.icon,
                xp_reward=ach_def.xp_reward,
            )

        return None

    async def _track_culture_achievement_unlock(
        self, user_id: UUID, achievement: UnlockedAchievement
    ) -> None:
        """Track PostHog event for culture achievement unlock.

        Event: culture_achievement_unlocked
        Properties:
            - achievement_id: str
            - xp_reward: int
        """
        try:
            from src.core.posthog import capture_event

            capture_event(
                distinct_id=str(user_id),
                event="culture_achievement_unlocked",
                properties={
                    "achievement_id": achievement["id"],
                    "xp_reward": achievement["xp_reward"],
                },
            )
        except Exception as e:
            logger.warning(
                "Failed to track culture achievement PostHog event",
                extra={
                    "user_id": str(user_id),
                    "achievement_id": achievement["id"],
                    "error": str(e),
                },
            )
