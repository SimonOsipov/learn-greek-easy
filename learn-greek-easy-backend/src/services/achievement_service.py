"""Achievement Service for tracking and unlocking achievements.

This service handles:
- Achievement unlock logic (idempotent)
- Progress tracking for achievements
- XP rewards on unlock
- Notification tracking for celebration UI
"""

from typing import Optional, TypedDict
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging import get_logger
from src.db.models import Achievement, UserAchievement
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

        Progress and current_value are derived from GamificationProjection,
        the single source of truth for gamification state.
        """
        # Late import to avoid circular dependency
        from src.services.gamification.projection import GamificationProjection

        # Fetch unlocked rows then projection snapshot (sequential — AsyncSession is not
        # safe to share across concurrent coroutines; gather would raise IllegalStateChangeError)
        unlocked_result = await self.db.execute(
            select(UserAchievement).where(UserAchievement.user_id == user_id)
        )
        snapshot = await GamificationProjection.compute(self.db, user_id)
        unlocked = {ua.achievement_id: ua for ua in unlocked_result.scalars().all()}

        achievements: list[AchievementProgress] = []
        for ach_def in ACHIEVEMENTS:
            is_unlocked = ach_def.id in unlocked
            user_ach = unlocked.get(ach_def.id)

            # Read current metric value directly from snapshot
            current_value = snapshot.metrics[ach_def.metric]

            progress = 0.0
            if ach_def.threshold > 0:
                progress = min((current_value / ach_def.threshold) * 100, 100.0)

            # Preserve unlocked => progress=100 invariant (GAMIF-06-06)
            if is_unlocked:
                progress = 100.0

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
