"""CultureQuestionStats repository for SM-2 spaced repetition tracking."""

from datetime import date, datetime, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardStatus, CultureAnswerHistory, CultureQuestion, CultureQuestionStats
from src.repositories.base import BaseRepository


class CultureQuestionStatsRepository(BaseRepository[CultureQuestionStats]):
    """Repository for CultureQuestionStats model with progress tracking.

    Provides database operations for culture question SM-2 statistics:
    - Get user stats for a question
    - Count questions by status
    - Get due questions for review
    - Calculate progress statistics
    """

    def __init__(self, db: AsyncSession):
        """Initialize the CultureQuestionStats repository.

        Args:
            db: Async database session for persistence operations
        """
        super().__init__(CultureQuestionStats, db)

    async def get_by_user_and_question(
        self,
        user_id: UUID,
        question_id: UUID,
    ) -> Optional[CultureQuestionStats]:
        """Get statistics for a specific user-question pair.

        Args:
            user_id: User UUID
            question_id: Question UUID

        Returns:
            CultureQuestionStats if exists, None otherwise

        Use Case:
            Check if user has attempted a question before
        """
        query = select(CultureQuestionStats).where(
            CultureQuestionStats.user_id == user_id,
            CultureQuestionStats.question_id == question_id,
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def count_by_status_for_deck(
        self,
        user_id: UUID,
        deck_id: UUID,
    ) -> dict[str, int]:
        """Count questions by SM-2 status for a specific deck.

        Args:
            user_id: User UUID
            deck_id: Deck UUID

        Returns:
            Dict with counts: {new, learning, review, mastered}

        Use Case:
            Deck progress breakdown for UI
        """
        # Get all questions in the deck
        total_questions_query = select(func.count(CultureQuestion.id)).where(
            CultureQuestion.deck_id == deck_id
        )
        total_result = await self.db.execute(total_questions_query)
        total_questions = total_result.scalar_one()

        # Get counts by status for this user
        status_query = (
            select(
                CultureQuestionStats.status,
                func.count(CultureQuestionStats.id).label("count"),
            )
            .join(CultureQuestion, CultureQuestionStats.question_id == CultureQuestion.id)
            .where(
                CultureQuestionStats.user_id == user_id,
                CultureQuestion.deck_id == deck_id,
            )
            .group_by(CultureQuestionStats.status)
        )
        status_result = await self.db.execute(status_query)
        status_counts: dict[str, int] = {}
        for row in status_result:
            status_counts[row.status.value] = row.count  # type: ignore[assignment]

        # Calculate counts
        learning_count: int = status_counts.get(CardStatus.LEARNING.value, 0)
        review_count: int = status_counts.get(CardStatus.REVIEW.value, 0)
        mastered_count: int = status_counts.get(CardStatus.MASTERED.value, 0)
        in_progress_count: int = learning_count + review_count + mastered_count
        new_count: int = total_questions - in_progress_count

        return {
            "new": new_count,
            "learning": learning_count,
            "review": review_count,
            "mastered": mastered_count,
        }

    async def get_deck_progress(
        self,
        user_id: UUID,
        deck_id: UUID,
    ) -> dict[str, int]:
        """Get progress statistics for a culture deck.

        Args:
            user_id: User UUID
            deck_id: Deck UUID

        Returns:
            Dict with: {questions_total, questions_mastered, questions_learning, questions_new}

        Use Case:
            Deck progress display in deck list
        """
        counts = await self.count_by_status_for_deck(user_id, deck_id)

        # Get total questions in deck
        total_query = select(func.count(CultureQuestion.id)).where(
            CultureQuestion.deck_id == deck_id
        )
        total_result = await self.db.execute(total_query)
        total = total_result.scalar_one()

        return {
            "questions_total": total,
            "questions_mastered": counts.get("mastered", 0),
            "questions_learning": counts.get("learning", 0) + counts.get("review", 0),
            "questions_new": counts.get("new", 0),
        }

    async def get_last_practiced_at(
        self,
        user_id: UUID,
        deck_id: UUID,
    ) -> Optional[datetime]:
        """Get the last practice timestamp for a deck.

        Args:
            user_id: User UUID
            deck_id: Deck UUID

        Returns:
            Last updated_at timestamp from user's question stats for this deck

        Use Case:
            Show "last practiced" in deck list
        """
        query = (
            select(CultureQuestionStats.updated_at)
            .join(CultureQuestion, CultureQuestionStats.question_id == CultureQuestion.id)
            .where(
                CultureQuestionStats.user_id == user_id,
                CultureQuestion.deck_id == deck_id,
            )
            .order_by(CultureQuestionStats.updated_at.desc())
            .limit(1)
        )
        result = await self.db.execute(query)
        timestamp = result.scalar_one_or_none()
        return timestamp

    async def has_user_started_deck(
        self,
        user_id: UUID,
        deck_id: UUID,
    ) -> bool:
        """Check if user has any stats for questions in this deck.

        Args:
            user_id: User UUID
            deck_id: Deck UUID

        Returns:
            True if user has at least one question stat for this deck

        Use Case:
            Determine if deck should show progress vs "Start"
        """
        query = (
            select(func.count(CultureQuestionStats.id))
            .join(CultureQuestion, CultureQuestionStats.question_id == CultureQuestion.id)
            .where(
                CultureQuestionStats.user_id == user_id,
                CultureQuestion.deck_id == deck_id,
            )
        )
        result = await self.db.execute(query)
        count = result.scalar_one()
        return count > 0

    async def count_answers_today(self, user_id: UUID) -> int:
        """Count culture questions answered today.

        Counts stats records where updated_at is today, indicating the user
        answered the question today. This method is used for daily goal tracking.

        Args:
            user_id: User UUID

        Returns:
            Number of culture questions answered today

        Use Case:
            Daily goal tracking - culture answers count toward combined goal
            with flashcard reviews
        """
        today_start = datetime.combine(date.today(), datetime.min.time())
        query = select(func.count(CultureQuestionStats.id)).where(
            CultureQuestionStats.user_id == user_id,
            CultureQuestionStats.updated_at >= today_start,
        )
        result = await self.db.execute(query)
        return result.scalar_one() or 0

    async def count_due_questions(self, user_id: UUID) -> int:
        """Count culture questions due for review (today or overdue).

        Args:
            user_id: User UUID

        Returns:
            Number of culture questions due for review

        Use Case:
            Dashboard stats - combined due cards count
        """
        today = date.today()
        query = select(func.count(CultureQuestionStats.id)).where(
            CultureQuestionStats.user_id == user_id,
            CultureQuestionStats.next_review_date <= today,
        )
        result = await self.db.execute(query)
        return result.scalar_one() or 0

    async def count_mastered_questions(self, user_id: UUID) -> int:
        """Count culture questions with MASTERED status.

        Args:
            user_id: User UUID

        Returns:
            Number of mastered culture questions

        Use Case:
            Dashboard stats - combined mastered count
        """
        query = select(func.count(CultureQuestionStats.id)).where(
            CultureQuestionStats.user_id == user_id,
            CultureQuestionStats.status == CardStatus.MASTERED,
        )
        result = await self.db.execute(query)
        return result.scalar_one() or 0

    async def get_culture_study_time_seconds(
        self,
        user_id: UUID,
        today_only: bool = False,
    ) -> int:
        """Get total study time from CultureAnswerHistory.

        Args:
            user_id: User UUID
            today_only: If True, only count today's study time

        Returns:
            Total study time in seconds

        Use Case:
            Dashboard stats - combined study time
        """
        query = select(func.coalesce(func.sum(CultureAnswerHistory.time_taken_seconds), 0)).where(
            CultureAnswerHistory.user_id == user_id
        )

        if today_only:
            today = date.today()
            query = query.where(func.date(CultureAnswerHistory.created_at) == today)

        result = await self.db.execute(query)
        return result.scalar_one() or 0

    async def get_culture_accuracy_stats(
        self,
        user_id: UUID,
        days: int = 30,
    ) -> dict[str, int]:
        """Get correct/total for accuracy calculation.

        Args:
            user_id: User UUID
            days: Number of days to look back

        Returns:
            Dict with 'correct' and 'total' counts

        Use Case:
            Dashboard stats - combined accuracy percentage
        """
        cutoff_date = date.today() - timedelta(days=days)

        # Count total answers
        total_query = select(func.count(CultureAnswerHistory.id)).where(
            CultureAnswerHistory.user_id == user_id,
            func.date(CultureAnswerHistory.created_at) >= cutoff_date,
        )
        total_result = await self.db.execute(total_query)
        total = total_result.scalar_one() or 0

        # Count correct answers
        correct_query = select(func.count(CultureAnswerHistory.id)).where(
            CultureAnswerHistory.user_id == user_id,
            CultureAnswerHistory.is_correct == True,  # noqa: E712
            func.date(CultureAnswerHistory.created_at) >= cutoff_date,
        )
        correct_result = await self.db.execute(correct_query)
        correct = correct_result.scalar_one() or 0

        return {"correct": correct, "total": total}

    async def get_dates_with_culture_activity(
        self,
        user_id: UUID,
        days: int = 30,
    ) -> list[date]:
        """Get unique dates with culture activity for streak calculation.

        Args:
            user_id: User UUID
            days: Number of days to look back

        Returns:
            List of dates with culture activity, ordered descending

        Use Case:
            Dashboard stats - combined streak calculation
        """
        cutoff_date = date.today() - timedelta(days=days)

        query = (
            select(func.date(CultureAnswerHistory.created_at).label("activity_date"))
            .where(
                CultureAnswerHistory.user_id == user_id,
                func.date(CultureAnswerHistory.created_at) >= cutoff_date,
            )
            .group_by(func.date(CultureAnswerHistory.created_at))
            .order_by(func.date(CultureAnswerHistory.created_at).desc())
        )

        result = await self.db.execute(query)
        return [row[0] for row in result.all()]

    async def count_cards_by_status_per_day(
        self,
        user_id: UUID,
        start_date: date,
        end_date: date,
    ) -> dict[date, dict[str, int]]:
        """Count culture questions in each status per day based on updated_at.

        Groups questions by the date they were last updated and their current status.
        Learning includes both LEARNING and REVIEW statuses.

        Args:
            user_id: User UUID
            start_date: Start date (inclusive)
            end_date: End date (inclusive)

        Returns:
            Dict of {date: {learning: count, mastered: count}}

        Use Case:
            Progress Over Time chart - show learning/mastered counts per day
        """
        result = await self.db.execute(
            select(
                cast(CultureQuestionStats.updated_at, Date).label("day"),
                CultureQuestionStats.status,
                func.count(CultureQuestionStats.id).label("count"),
            )
            .where(CultureQuestionStats.user_id == user_id)
            .where(cast(CultureQuestionStats.updated_at, Date) >= start_date)
            .where(cast(CultureQuestionStats.updated_at, Date) <= end_date)
            .group_by(cast(CultureQuestionStats.updated_at, Date), CultureQuestionStats.status)
        )
        rows = result.all()

        counts: dict[date, dict[str, int]] = {}
        for row in rows:
            day = row.day
            if day not in counts:
                counts[day] = {"learning": 0, "mastered": 0}
            if row.status == CardStatus.LEARNING or row.status == CardStatus.REVIEW:
                counts[day]["learning"] += row.count
            elif row.status == CardStatus.MASTERED:
                counts[day]["mastered"] += row.count
        return counts

    async def get_daily_culture_accuracy_stats(
        self,
        user_id: UUID,
        start_date: date,
        end_date: date,
    ) -> dict[date, dict]:
        """Get daily accuracy statistics for culture questions.

        Args:
            user_id: User UUID
            start_date: Start date (inclusive)
            end_date: End date (inclusive)

        Returns:
            Dict of {date: {correct_count, total_count, accuracy}}

        Use Case:
            Accuracy Trend chart - culture accuracy per day
        """
        result = await self.db.execute(
            select(
                cast(CultureAnswerHistory.created_at, Date).label("day"),
                func.count().filter(CultureAnswerHistory.is_correct == True).label(  # noqa: E712
                    "correct"
                ),
                func.count().label("total"),
            )
            .where(CultureAnswerHistory.user_id == user_id)
            .where(cast(CultureAnswerHistory.created_at, Date) >= start_date)
            .where(cast(CultureAnswerHistory.created_at, Date) <= end_date)
            .group_by(cast(CultureAnswerHistory.created_at, Date))
        )
        rows = result.all()

        return {
            row.day: {
                "correct_count": row.correct,
                "total_count": row.total,
                "accuracy": (row.correct / row.total * 100) if row.total > 0 else 0.0,
            }
            for row in rows
        }


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["CultureQuestionStatsRepository"]
