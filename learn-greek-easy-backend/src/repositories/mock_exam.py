"""MockExam repository for mock exam session and answer management.

This repository handles database operations for mock exam functionality:
- Session creation and lifecycle management
- Answer recording and retrieval
- Random question selection from active culture decks
- User statistics aggregation
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import (
    CultureDeck,
    CultureQuestion,
    MockExamAnswer,
    MockExamSession,
    MockExamStatus,
)
from src.repositories.base import BaseRepository


class MockExamRepository(BaseRepository[MockExamSession]):
    """Repository for MockExamSession model with exam management.

    Provides database operations for mock exams including:
    - Session creation and status management
    - Answer recording
    - Statistics aggregation
    - Random question selection from active culture decks
    """

    def __init__(self, db: AsyncSession):
        """Initialize the MockExam repository.

        Args:
            db: Async database session for persistence operations
        """
        super().__init__(MockExamSession, db)

    async def create_session(
        self,
        user_id: UUID,
        total_questions: int = 25,
    ) -> MockExamSession:
        """Create a new ACTIVE mock exam session.

        Args:
            user_id: User UUID
            total_questions: Number of questions in the exam (default 25)

        Returns:
            Created MockExamSession with ACTIVE status

        Use Case:
            Starting a new mock exam
        """
        session = MockExamSession(
            user_id=user_id,
            total_questions=total_questions,
            status=MockExamStatus.ACTIVE,
            score=0,
            passed=False,
            time_taken_seconds=0,
        )
        self.db.add(session)
        await self.db.flush()
        return session

    async def get_session(
        self,
        session_id: UUID,
        user_id: Optional[UUID] = None,
    ) -> Optional[MockExamSession]:
        """Get a mock exam session with answers loaded.

        Args:
            session_id: Session UUID
            user_id: Optional user UUID for ownership validation

        Returns:
            MockExamSession with answers if found, None otherwise

        Use Case:
            Retrieving session details with all answers
        """
        query = (
            select(MockExamSession)
            .options(selectinload(MockExamSession.answers))
            .where(MockExamSession.id == session_id)
        )

        if user_id is not None:
            query = query.where(MockExamSession.user_id == user_id)

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_active_session(self, user_id: UUID) -> Optional[MockExamSession]:
        """Get user's active mock exam session if any.

        Only one active session is allowed per user.

        Args:
            user_id: User UUID

        Returns:
            Active MockExamSession if exists, None otherwise

        Use Case:
            Checking for existing exam before creating new one
        """
        query = (
            select(MockExamSession)
            .options(selectinload(MockExamSession.answers))
            .where(
                MockExamSession.user_id == user_id,
                MockExamSession.status == MockExamStatus.ACTIVE,
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def save_answer(
        self,
        session_id: UUID,
        question_id: UUID,
        selected_option: int,
        is_correct: bool,
        time_taken_seconds: int,
    ) -> MockExamAnswer:
        """Save an answer for a mock exam session.

        Args:
            session_id: Session UUID
            question_id: Question UUID
            selected_option: Selected answer option (1-4)
            is_correct: Whether the answer is correct
            time_taken_seconds: Time taken to answer

        Returns:
            Created MockExamAnswer

        Use Case:
            Recording user's answer during exam
        """
        answer = MockExamAnswer(
            session_id=session_id,
            question_id=question_id,
            selected_option=selected_option,
            is_correct=is_correct,
            time_taken_seconds=time_taken_seconds,
        )
        self.db.add(answer)
        await self.db.flush()
        return answer

    async def get_session_answers(self, session_id: UUID) -> list[MockExamAnswer]:
        """Get all answers for a mock exam session.

        Args:
            session_id: Session UUID

        Returns:
            List of MockExamAnswer records

        Use Case:
            Retrieving all answers for scoring or review
        """
        query = (
            select(MockExamAnswer)
            .where(MockExamAnswer.session_id == session_id)
            .order_by(MockExamAnswer.answered_at)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def complete_session(
        self,
        session_id: UUID,
        score: int,
        passed: bool,
        time_taken_seconds: int,
    ) -> Optional[MockExamSession]:
        """Mark a mock exam session as completed.

        Args:
            session_id: Session UUID
            score: Number of correct answers
            passed: Whether the exam was passed (>= 80%)
            time_taken_seconds: Total time taken for the exam

        Returns:
            Updated MockExamSession if found, None otherwise

        Use Case:
            Finishing an exam
        """
        session = await self.get(session_id)
        if session is None:
            return None

        session.status = MockExamStatus.COMPLETED
        session.completed_at = datetime.utcnow()
        session.score = score
        session.passed = passed
        session.time_taken_seconds = time_taken_seconds
        await self.db.flush()
        return session

    async def abandon_session(self, session_id: UUID) -> Optional[MockExamSession]:
        """Mark a mock exam session as abandoned.

        Args:
            session_id: Session UUID

        Returns:
            Updated MockExamSession if found, None otherwise

        Use Case:
            User quits exam before completion
        """
        session = await self.get(session_id)
        if session is None:
            return None

        session.status = MockExamStatus.ABANDONED
        session.completed_at = datetime.utcnow()
        await self.db.flush()
        return session

    async def get_user_statistics(self, user_id: UUID) -> dict:
        """Get aggregated mock exam statistics for a user.

        Args:
            user_id: User UUID

        Returns:
            Dict with:
            - total_exams: Total number of completed exams
            - passed_exams: Number of passed exams
            - pass_rate: Percentage of exams passed (0-100)
            - average_score: Average score across all exams
            - best_score: Highest score achieved
            - total_questions_answered: Total questions answered
            - average_time_seconds: Average time per exam

        Use Case:
            Dashboard statistics display
        """
        # Base query for completed exams
        completed_query = select(MockExamSession).where(
            MockExamSession.user_id == user_id,
            MockExamSession.status == MockExamStatus.COMPLETED,
        )
        completed_result = await self.db.execute(completed_query)
        completed_sessions = list(completed_result.scalars().all())

        total_exams = len(completed_sessions)

        if total_exams == 0:
            return {
                "total_exams": 0,
                "passed_exams": 0,
                "pass_rate": 0.0,
                "average_score": 0.0,
                "best_score": 0,
                "total_questions_answered": 0,
                "average_time_seconds": 0,
            }

        passed_exams = sum(1 for s in completed_sessions if s.passed)
        total_questions = sum(s.total_questions for s in completed_sessions)
        total_time = sum(s.time_taken_seconds for s in completed_sessions)

        # Calculate percentages based on actual questions per exam
        total_percentage = sum((s.score / s.total_questions) * 100 for s in completed_sessions)
        average_percentage = round(total_percentage / total_exams, 1)
        best_percentage = round(
            max((s.score / s.total_questions) * 100 for s in completed_sessions), 1
        )

        return {
            "total_exams": total_exams,
            "passed_exams": passed_exams,
            "pass_rate": round((passed_exams / total_exams) * 100, 1),
            "average_score": average_percentage,
            "best_score": best_percentage,
            "total_questions_answered": total_questions,
            "average_time_seconds": round(total_time / total_exams),
        }

    async def get_recent_exams(
        self,
        user_id: UUID,
        limit: int = 10,
    ) -> list[MockExamSession]:
        """Get recent completed mock exams for a user.

        Args:
            user_id: User UUID
            limit: Maximum number of exams to return (default 10)

        Returns:
            List of recent MockExamSession records ordered by completion date

        Use Case:
            Displaying exam history
        """
        query = (
            select(MockExamSession)
            .where(
                MockExamSession.user_id == user_id,
                MockExamSession.status == MockExamStatus.COMPLETED,
            )
            .order_by(MockExamSession.completed_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_random_questions(
        self,
        count: int = 25,
        exclude_question_ids: Optional[list[UUID]] = None,
    ) -> list[CultureQuestion]:
        """Get random questions from all active culture decks.

        Uses PostgreSQL func.random() for random selection across all
        active (non-premium for now) culture decks.

        Args:
            count: Number of questions to select (default 25)
            exclude_question_ids: Optional list of question IDs to exclude

        Returns:
            List of random CultureQuestion records

        Use Case:
            Selecting questions for a new mock exam
        """
        # Build query for questions from active culture decks
        query = (
            select(CultureQuestion)
            .join(CultureDeck, CultureQuestion.deck_id == CultureDeck.id)
            .where(CultureDeck.is_active == True)  # noqa: E712
        )

        # Exclude specific questions if provided
        if exclude_question_ids:
            query = query.where(~CultureQuestion.id.in_(exclude_question_ids))

        # Order by random and limit
        query = query.order_by(func.random()).limit(count)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_session_question_ids(self, session_id: UUID) -> list[UUID]:
        """Get question IDs for an existing session.

        Args:
            session_id: Session UUID

        Returns:
            List of question UUIDs already in the session

        Use Case:
            Checking which questions are assigned to a session
        """
        query = select(MockExamAnswer.question_id).where(MockExamAnswer.session_id == session_id)
        result = await self.db.execute(query)
        return [row[0] for row in result.all()]

    async def answer_exists(self, session_id: UUID, question_id: UUID) -> bool:
        """Check if an answer already exists for a question in a session.

        Args:
            session_id: Session UUID
            question_id: Question UUID

        Returns:
            True if answer exists, False otherwise

        Use Case:
            Preventing duplicate answers
        """
        query = select(func.count(MockExamAnswer.id)).where(
            MockExamAnswer.session_id == session_id,
            MockExamAnswer.question_id == question_id,
        )
        result = await self.db.execute(query)
        count = result.scalar_one()
        return count > 0


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["MockExamRepository"]
