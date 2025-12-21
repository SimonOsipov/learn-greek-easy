"""XP Service for managing user experience points."""

import logging
from datetime import date
from typing import Optional, TypedDict
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import UserXP, XPTransaction
from src.services.xp_constants import (
    XP_CORRECT_ANSWER,
    XP_DAILY_GOAL,
    XP_FIRST_REVIEW,
    XP_PERFECT_ANSWER,
    XP_SESSION_COMPLETE,
    XP_STREAK_MULTIPLIER,
    get_level_definition,
    get_level_from_xp,
    get_xp_progress_in_level,
)

logger = logging.getLogger(__name__)


class XPAwardResult(TypedDict):
    """Result of an XP award operation."""

    new_total_xp: int
    did_level_up: bool
    new_level: int


class UserXPStats(TypedDict):
    """Comprehensive XP stats for a user."""

    total_xp: int
    current_level: int
    level_name_greek: str
    level_name_english: str
    xp_in_level: int
    xp_for_next_level: int
    progress_percentage: float


class XPService:
    """Service for XP operations."""

    def __init__(self, db: AsyncSession):
        """Initialize XP service with database session.

        Args:
            db: Async database session
        """
        self.db = db

    async def get_or_create_user_xp(self, user_id: UUID) -> UserXP:
        """Get user's XP record, creating if needed.

        Args:
            user_id: The user's UUID

        Returns:
            The UserXP record for the user
        """
        result = await self.db.execute(select(UserXP).where(UserXP.user_id == user_id))
        user_xp = result.scalar_one_or_none()

        if not user_xp:
            user_xp = UserXP(
                user_id=user_id,
                total_xp=0,
                current_level=1,
            )
            self.db.add(user_xp)
            await self.db.flush()

        return user_xp

    async def award_xp(
        self,
        user_id: UUID,
        amount: int,
        reason: str,
        source_id: Optional[UUID] = None,
    ) -> tuple[int, bool]:
        """Award XP to user.

        Args:
            user_id: The user's UUID
            amount: The amount of XP to award (must be > 0)
            reason: The reason for the XP award (e.g., "correct_answer")
            source_id: Optional reference to source entity (e.g., card_id)

        Returns:
            Tuple of (new_total_xp, did_level_up)

        Raises:
            ValueError: If amount is <= 0
        """
        if amount <= 0:
            raise ValueError("XP amount must be greater than 0")

        user_xp = await self.get_or_create_user_xp(user_id)
        old_level = user_xp.current_level

        # Add XP
        user_xp.total_xp += amount

        # Recalculate level
        new_level = get_level_from_xp(user_xp.total_xp)
        user_xp.current_level = new_level

        # Record transaction
        transaction = XPTransaction(
            user_id=user_id,
            amount=amount,
            reason=reason,
            source_id=source_id,
        )
        self.db.add(transaction)

        await self.db.flush()

        did_level_up = new_level > old_level

        logger.info(
            "XP awarded",
            extra={
                "user_id": str(user_id),
                "amount": amount,
                "reason": reason,
                "new_total": user_xp.total_xp,
                "level_up": did_level_up,
            },
        )

        return (user_xp.total_xp, did_level_up)

    async def award_correct_answer_xp(
        self,
        user_id: UUID,
        is_perfect: bool,
        source_id: Optional[UUID] = None,
    ) -> int:
        """Award XP for correct answer.

        Args:
            user_id: The user's UUID
            is_perfect: Whether the recall was perfect (< 2 seconds)
            source_id: Optional card ID

        Returns:
            XP amount awarded
        """
        if is_perfect:
            amount = XP_PERFECT_ANSWER
            reason = "perfect_recall"
        else:
            amount = XP_CORRECT_ANSWER
            reason = "correct_answer"

        await self.award_xp(user_id, amount, reason, source_id=source_id)
        return amount

    async def award_daily_goal_xp(self, user_id: UUID) -> int:
        """Award XP for completing daily goal. Idempotent - once per day.

        Args:
            user_id: The user's UUID

        Returns:
            XP awarded (0 if already claimed today)
        """
        user_xp = await self.get_or_create_user_xp(user_id)
        today = date.today()

        # Check if already claimed today
        if user_xp.last_daily_bonus_date == today:
            return 0

        # Award and update date
        await self.award_xp(user_id, XP_DAILY_GOAL, "daily_goal")
        user_xp.last_daily_bonus_date = today
        await self.db.flush()

        return XP_DAILY_GOAL

    async def award_first_review_bonus(self, user_id: UUID) -> int:
        """Award first review of day bonus. Idempotent - once per day.

        CRITICAL: Updates last_daily_bonus_date AFTER awarding to track
        that the bonus was claimed today.

        Args:
            user_id: The user's UUID

        Returns:
            XP awarded (0 if already claimed today)
        """
        user_xp = await self.get_or_create_user_xp(user_id)
        today = date.today()

        # Check if already claimed today
        if user_xp.last_daily_bonus_date == today:
            return 0

        # Award XP first
        await self.award_xp(user_id, XP_FIRST_REVIEW, "first_review_bonus")

        # CRITICAL: Update the date AFTER awarding to mark it as claimed
        user_xp.last_daily_bonus_date = today
        await self.db.flush()

        return XP_FIRST_REVIEW

    async def award_session_complete_xp(self, user_id: UUID) -> int:
        """Award XP for completing a review session.

        Args:
            user_id: The user's UUID

        Returns:
            XP amount awarded
        """
        await self.award_xp(user_id, XP_SESSION_COMPLETE, "session_complete")
        return XP_SESSION_COMPLETE

    async def award_streak_bonus(self, user_id: UUID, streak_days: int) -> int:
        """Award streak bonus XP.

        Args:
            user_id: The user's UUID
            streak_days: Number of consecutive days (must be > 0)

        Returns:
            XP awarded

        Raises:
            ValueError: If streak_days <= 0
        """
        if streak_days <= 0:
            raise ValueError("Streak days must be greater than 0")

        amount = XP_STREAK_MULTIPLIER * streak_days
        await self.award_xp(user_id, amount, "streak_bonus")
        return amount

    async def get_user_xp_stats(self, user_id: UUID) -> UserXPStats:
        """Get comprehensive XP stats for user.

        Args:
            user_id: The user's UUID

        Returns:
            UserXPStats with all XP information
        """
        user_xp = await self.get_or_create_user_xp(user_id)
        level_def = get_level_definition(user_xp.current_level)
        progress, needed = get_xp_progress_in_level(user_xp.total_xp, user_xp.current_level)

        progress_percent = 0.0
        if needed > 0:
            progress_percent = (progress / needed) * 100

        return UserXPStats(
            total_xp=user_xp.total_xp,
            current_level=user_xp.current_level,
            level_name_greek=level_def.name_greek,
            level_name_english=level_def.name_english,
            xp_in_level=progress,
            xp_for_next_level=needed,
            progress_percentage=round(progress_percent, 1),
        )
