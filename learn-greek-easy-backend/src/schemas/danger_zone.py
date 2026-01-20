"""Danger Zone schemas for reset progress and delete account operations.

These schemas define the response types for destructive account operations.
"""

from dataclasses import dataclass


@dataclass
class ResetProgressResult:
    """Result of resetting all progress for a user.

    Contains counts of deleted records for audit trail and user feedback.
    """

    user_deck_progress_deleted: int
    card_statistics_deleted: int
    reviews_deleted: int
    user_xp_reset: bool
    xp_transactions_deleted: int
    user_achievements_deleted: int
    culture_question_stats_deleted: int
    culture_answer_history_deleted: int
    mock_exam_sessions_deleted: int
    mock_exam_answers_deleted: int
    notifications_deleted: int

    @property
    def total_deleted(self) -> int:
        """Calculate total number of records deleted."""
        return (
            self.user_deck_progress_deleted
            + self.card_statistics_deleted
            + self.reviews_deleted
            + self.xp_transactions_deleted
            + self.user_achievements_deleted
            + self.culture_question_stats_deleted
            + self.culture_answer_history_deleted
            + self.mock_exam_sessions_deleted
            + self.mock_exam_answers_deleted
            + self.notifications_deleted
        )


__all__ = ["ResetProgressResult"]
