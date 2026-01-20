"""User Progress Reset Service for Danger Zone operations.

Provides atomic deletion of all user progress data while preserving the user account.
This service is used by both the "Reset Progress" and "Delete Account" flows.

IMPORTANT: All deletions happen in a single transaction for atomicity.
"""

import logging
from uuid import UUID

from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import UserAchievement, UserXP, XPTransaction
from src.repositories import (
    CardStatisticsRepository,
    CultureAnswerHistoryRepository,
    CultureQuestionStatsRepository,
    MockExamRepository,
    NotificationRepository,
    ReviewRepository,
    UserDeckProgressRepository,
)
from src.schemas.danger_zone import ResetProgressResult

logger = logging.getLogger(__name__)


class UserProgressResetService:
    """Service for resetting all user progress data.

    This service coordinates deletion across multiple repositories to reset
    a user's progress while preserving their account. It is designed to be
    reused by both Reset Progress and Delete Account flows.

    All operations are atomic - if any deletion fails, the entire transaction
    is rolled back.

    Usage:
        async with async_session() as db:
            service = UserProgressResetService(db)
            result = await service.reset_all_progress(user_id)
            await db.commit()  # Caller commits the transaction
    """

    def __init__(self, db: AsyncSession):
        """Initialize the service with database session and repositories.

        Args:
            db: Async database session for persistence operations
        """
        self.db = db

        # Initialize repositories
        self.deck_progress_repo = UserDeckProgressRepository(db)
        self.card_stats_repo = CardStatisticsRepository(db)
        self.review_repo = ReviewRepository(db)
        self.culture_stats_repo = CultureQuestionStatsRepository(db)
        self.culture_history_repo = CultureAnswerHistoryRepository(db)
        self.mock_exam_repo = MockExamRepository(db)
        self.notification_repo = NotificationRepository(db)

    async def reset_all_progress(self, user_id: UUID) -> ResetProgressResult:
        """Reset all progress data for a user.

        This method deletes all progress-related data while preserving the user
        account, settings, and refresh tokens. The operation is atomic.

        Deletion order matters for foreign key constraints:
        1. Reviews (references cards)
        2. Card statistics (references cards)
        3. User deck progress (references decks)
        4. Culture answer history (references questions)
        5. Culture question stats (references questions)
        6. Mock exam sessions (cascades to answers)
        7. XP transactions (no FK constraints)
        8. User achievements (no FK constraints)
        9. Notifications (no FK constraints)
        10. Reset UserXP to 0 (UPDATE, not delete)

        Args:
            user_id: UUID of the user whose progress to reset

        Returns:
            ResetProgressResult with counts of deleted records
        """
        logger.info(f"Starting progress reset for user {user_id}")

        # 1. Delete reviews
        reviews_deleted = await self.review_repo.delete_all_by_user_id(user_id)
        logger.debug(f"Deleted {reviews_deleted} reviews for user {user_id}")

        # 2. Delete card statistics
        card_stats_deleted = await self.card_stats_repo.delete_all_by_user_id(user_id)
        logger.debug(f"Deleted {card_stats_deleted} card statistics for user {user_id}")

        # 3. Delete user deck progress
        deck_progress_deleted = await self.deck_progress_repo.delete_all_by_user_id(user_id)
        logger.debug(f"Deleted {deck_progress_deleted} deck progress records for user {user_id}")

        # 4. Delete culture answer history
        culture_history_deleted = await self.culture_history_repo.delete_all_by_user_id(user_id)
        logger.debug(f"Deleted {culture_history_deleted} culture answer history for user {user_id}")

        # 5. Delete culture question stats
        culture_stats_deleted = await self.culture_stats_repo.delete_all_by_user_id(user_id)
        logger.debug(f"Deleted {culture_stats_deleted} culture question stats for user {user_id}")

        # 6. Delete mock exam sessions (cascades to answers)
        sessions_deleted, answers_deleted = await self.mock_exam_repo.delete_all_by_user_id(user_id)
        logger.debug(
            f"Deleted {sessions_deleted} mock exam sessions and "
            f"{answers_deleted} answers for user {user_id}"
        )

        # 7. Delete XP transactions (direct SQLAlchemy - no dedicated repo)
        xp_transactions_result = await self.db.execute(
            delete(XPTransaction).where(XPTransaction.user_id == user_id)
        )
        # CursorResult from DELETE has rowcount, but Result[Any] type doesn't expose it
        xp_transactions_deleted = (
            int(xp_transactions_result.rowcount)  # type: ignore[attr-defined]
            if xp_transactions_result.rowcount  # type: ignore[attr-defined]
            else 0
        )
        logger.debug(f"Deleted {xp_transactions_deleted} XP transactions for user {user_id}")

        # 8. Delete user achievements (direct SQLAlchemy - no dedicated repo)
        achievements_result = await self.db.execute(
            delete(UserAchievement).where(UserAchievement.user_id == user_id)
        )
        # CursorResult from DELETE has rowcount, but Result[Any] type doesn't expose it
        achievements_deleted = (
            int(achievements_result.rowcount)  # type: ignore[attr-defined]
            if achievements_result.rowcount  # type: ignore[attr-defined]
            else 0
        )
        logger.debug(f"Deleted {achievements_deleted} achievements for user {user_id}")

        # 9. Delete notifications
        notifications_deleted = await self.notification_repo.delete_all_by_user(user_id)
        logger.debug(f"Deleted {notifications_deleted} notifications for user {user_id}")

        # 10. Reset UserXP to 0 (UPDATE, not delete - preserve the record)
        xp_reset_result = await self.db.execute(
            update(UserXP)
            .where(UserXP.user_id == user_id)
            .values(total_xp=0, current_level=1, last_daily_bonus_date=None)
        )
        # CursorResult from UPDATE has rowcount, but Result[Any] type doesn't expose it
        xp_was_reset = bool(
            xp_reset_result.rowcount and xp_reset_result.rowcount > 0  # type: ignore[attr-defined]
        )
        logger.debug(f"XP reset for user {user_id}: {xp_was_reset}")

        result = ResetProgressResult(
            user_deck_progress_deleted=deck_progress_deleted,
            card_statistics_deleted=card_stats_deleted,
            reviews_deleted=reviews_deleted,
            user_xp_reset=xp_was_reset,
            xp_transactions_deleted=xp_transactions_deleted,
            user_achievements_deleted=achievements_deleted,
            culture_question_stats_deleted=culture_stats_deleted,
            culture_answer_history_deleted=culture_history_deleted,
            mock_exam_sessions_deleted=sessions_deleted,
            mock_exam_answers_deleted=answers_deleted,
            notifications_deleted=notifications_deleted,
        )

        logger.info(
            f"Progress reset complete for user {user_id}. "
            f"Total records deleted: {result.total_deleted}"
        )

        return result


__all__ = ["UserProgressResetService"]
