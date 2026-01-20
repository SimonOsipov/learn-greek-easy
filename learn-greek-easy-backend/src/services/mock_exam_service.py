"""Mock Exam Service for managing mock citizenship exam sessions.

This service handles the business logic for mock exams:
- Creating exam sessions with random questions
- Processing answers with SM-2 and XP integration
- Completing exams with pass/fail determination
- Statistics aggregation

Key Features:
- 25 random questions from all active culture decks
- 60% pass threshold (16/25 correct)
- SM-2 spaced repetition integration
- XP awards for answers

Example Usage:
    async with get_db_session() as db:
        service = MockExamService(db)

        # Create a new exam
        exam = await service.create_mock_exam(user_id)

        # Submit an answer
        result = await service.submit_answer(
            user_id=user_id,
            session_id=exam.session.id,
            question_id=question_id,
            selected_option=2,
            time_taken_seconds=15,
        )

        # Complete the exam
        completed = await service.complete_exam(
            user_id=user_id,
            session_id=exam.session.id,
            total_time_seconds=1200,
        )
"""

from datetime import date
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import MockExamNotFoundException, MockExamSessionExpiredException
from src.core.logging import get_logger
from src.core.sm2 import DEFAULT_EASINESS_FACTOR, calculate_next_review_date, calculate_sm2
from src.db.models import (
    CardStatus,
    CultureQuestion,
    CultureQuestionStats,
    MockExamSession,
    MockExamStatus,
)
from src.repositories.mock_exam import MockExamRepository
from src.services.s3_service import S3Service, get_s3_service
from src.services.xp_service import XPService

logger = get_logger(__name__)

# Pass threshold: 60% (16 out of 25)
PASS_THRESHOLD_PERCENTAGE = 60
PERFECT_RECALL_THRESHOLD_SECONDS = 2


class MockExamService:
    """Service for mock exam operations with SM-2 and XP integration.

    This service orchestrates the full mock exam flow:
    1. Create exam with 25 random questions
    2. Process answers with SM-2 calculation and XP awards
    3. Complete exam with pass/fail determination
    4. Aggregate statistics for dashboard display

    Attributes:
        db: Async database session
        s3_service: S3 service for pre-signed URL generation
    """

    def __init__(
        self,
        db: AsyncSession,
        s3_service: Optional[S3Service] = None,
    ):
        """Initialize the Mock Exam service.

        Args:
            db: Async database session for persistence operations
            s3_service: Optional S3 service for image URLs (defaults to singleton)
        """
        self.db = db
        self.s3_service = s3_service or get_s3_service()
        self.repository = MockExamRepository(db)
        self.xp_service = XPService(db)

    async def create_mock_exam(self, user_id: UUID) -> dict[str, Any]:
        """Create a new mock exam session with 25 random questions.

        If the user already has an active session, returns that session instead
        of creating a new one.

        Args:
            user_id: User UUID

        Returns:
            Dict with:
            - session: MockExamSession object
            - questions: List of question data with presigned image URLs
            - is_resumed: True if returning an existing active session

        Raises:
            ValueError: If not enough questions available

        Use Case:
            Starting a new mock exam or resuming an existing one
        """
        logger.debug(
            "Creating mock exam",
            extra={"user_id": str(user_id)},
        )

        # Check for existing active session
        existing_session = await self.repository.get_active_session(user_id)
        if existing_session:
            logger.info(
                "Returning existing active session",
                extra={
                    "user_id": str(user_id),
                    "session_id": str(existing_session.id),
                },
            )

            # Get questions for the existing session
            existing_questions = await self._get_session_questions(existing_session)

            return {
                "session": existing_session,
                "questions": existing_questions,
                "is_resumed": True,
            }

        # Get 25 random questions from active culture decks
        random_questions = await self.repository.get_random_questions(count=25)

        if len(random_questions) < 25:
            logger.warning(
                "Not enough questions available for mock exam",
                extra={
                    "user_id": str(user_id),
                    "available": len(random_questions),
                    "required": 25,
                },
            )
            # Allow partial exam if fewer questions available
            if len(random_questions) == 0:
                raise ValueError("No questions available for mock exam")

        # Create session
        session = await self.repository.create_session(
            user_id=user_id,
            total_questions=len(random_questions),
        )

        # Build question data with presigned URLs
        question_data: list[dict[str, Any]] = []
        for question in random_questions:
            question_data.append(self._build_question_data(question))

        await self.db.commit()

        logger.info(
            "Mock exam created",
            extra={
                "user_id": str(user_id),
                "session_id": str(session.id),
                "question_count": len(random_questions),
            },
        )

        return {
            "session": session,
            "questions": question_data,
            "is_resumed": False,
        }

    async def submit_answer(
        self,
        user_id: UUID,
        session_id: UUID,
        question_id: UUID,
        selected_option: int,
        time_taken_seconds: int,
    ) -> dict[str, Any]:
        """Process an answer submission with SM-2 and XP integration.

        Updates the user's SM-2 statistics for the question and awards XP:
        - Correct: 10 XP (15 XP if answered in < 2 seconds)
        - Wrong: 2 XP (encouragement)

        Args:
            user_id: User UUID
            session_id: Mock exam session UUID
            question_id: Question UUID
            selected_option: Selected answer option (1-4)
            time_taken_seconds: Time taken to answer

        Returns:
            Dict with:
            - is_correct: Whether the answer was correct
            - correct_option: The correct option number
            - xp_earned: XP awarded for this answer
            - current_score: Updated score in session
            - answers_count: Number of questions answered

        Raises:
            MockExamNotFoundException: If session not found
            MockExamSessionExpiredException: If session is not active
            ValueError: If question not valid for this session

        Use Case:
            Processing each answer during the exam
        """
        logger.debug(
            "Processing mock exam answer",
            extra={
                "user_id": str(user_id),
                "session_id": str(session_id),
                "question_id": str(question_id),
            },
        )

        # Get and validate session
        session = await self.repository.get_session(session_id, user_id)
        if session is None:
            raise MockExamNotFoundException(str(session_id))

        if session.status != MockExamStatus.ACTIVE:
            raise MockExamSessionExpiredException(str(session_id))

        # Check if already answered
        if await self.repository.answer_exists(session_id, question_id):
            logger.warning(
                "Duplicate answer submission",
                extra={
                    "session_id": str(session_id),
                    "question_id": str(question_id),
                },
            )
            # Return existing state without re-processing
            answers = await self.repository.get_session_answers(session_id)
            return {
                "is_correct": None,
                "correct_option": None,
                "xp_earned": 0,
                "current_score": sum(1 for a in answers if a.is_correct),
                "answers_count": len(answers),
                "duplicate": True,
            }

        # Get the question
        question = await self._get_question(question_id)
        if question is None:
            raise ValueError(f"Question {question_id} not found")

        # Determine correctness
        is_correct = selected_option == question.correct_option
        is_perfect = time_taken_seconds <= PERFECT_RECALL_THRESHOLD_SECONDS

        # Save the answer
        await self.repository.save_answer(
            session_id=session_id,
            question_id=question_id,
            selected_option=selected_option,
            is_correct=is_correct,
            time_taken_seconds=time_taken_seconds,
        )

        # Update session score if correct
        if is_correct:
            session.score += 1

        # Update SM-2 statistics for the question
        await self._update_sm2_stats(
            user_id=user_id,
            question_id=question_id,
            is_correct=is_correct,
        )

        # Award XP
        xp_earned = await self.xp_service.award_culture_answer_xp(
            user_id=user_id,
            is_correct=is_correct,
            is_perfect=is_perfect,
            source_id=question_id,
        )

        await self.db.commit()

        # Get answer count for response (required by API contract)
        answers = await self.repository.get_session_answers(session_id)

        logger.info(
            "Mock exam answer processed",
            extra={
                "user_id": str(user_id),
                "session_id": str(session_id),
                "is_correct": is_correct,
                "xp_earned": xp_earned,
                "current_score": session.score,
            },
        )

        return {
            "is_correct": is_correct,
            "correct_option": question.correct_option,
            "xp_earned": xp_earned,
            "current_score": session.score,
            "answers_count": len(answers),
            "duplicate": False,
        }

    async def submit_all_answers(
        self,
        user_id: UUID,
        session_id: UUID,
        answers: list[dict],
        total_time_seconds: int,
    ) -> dict[str, Any]:
        """Submit all exam answers at once and complete the session atomically.

        This method processes all answers in a single transaction:
        - Validates session is active and owned by user
        - Detects and handles duplicate answers (idempotency)
        - For each new answer: determines correctness, saves to DB, updates SM-2, awards XP
        - Calculates final score and pass/fail
        - Completes the session

        Args:
            user_id: User UUID
            session_id: Mock exam session UUID
            answers: List of answer dicts with question_id, selected_option, time_taken_seconds
            total_time_seconds: Total time taken for the exam

        Returns:
            Dict with:
            - session: Updated MockExamSession
            - passed: Whether the exam was passed
            - score: Number of correct answers
            - total_questions: Total questions in exam
            - percentage: Score percentage
            - pass_threshold: Required percentage to pass
            - answer_results: List of per-answer results
            - total_xp_earned: Total XP earned from all answers
            - new_answers_count: Number of new answers processed
            - duplicate_answers_count: Number of duplicate answers skipped

        Raises:
            MockExamNotFoundException: If session not found
            MockExamSessionExpiredException: If session is not active

        Use Case:
            Submitting all answers and completing the exam in one request
        """
        logger.debug(
            "Processing submit-all for mock exam",
            extra={
                "user_id": str(user_id),
                "session_id": str(session_id),
                "answer_count": len(answers),
            },
        )

        # Get and validate session
        session = await self.repository.get_session(session_id, user_id)
        if session is None:
            raise MockExamNotFoundException(str(session_id))

        if session.status != MockExamStatus.ACTIVE:
            raise MockExamSessionExpiredException(str(session_id))

        # Get existing answers to detect duplicates
        existing_answers = await self.repository.get_session_answers(session_id)
        existing_question_ids = {a.question_id for a in existing_answers}

        # Process each answer
        answer_results: list[dict[str, Any]] = []
        total_xp_earned = 0
        new_answers_count = 0
        duplicate_answers_count = 0

        for answer in answers:
            question_id = answer["question_id"]
            selected_option = answer["selected_option"]
            time_taken_seconds = answer["time_taken_seconds"]

            # Check if already answered (duplicate)
            if question_id in existing_question_ids:
                logger.debug(
                    "Duplicate answer in submit-all",
                    extra={
                        "session_id": str(session_id),
                        "question_id": str(question_id),
                    },
                )
                # Find the existing answer to get correct_option
                question = await self._get_question(question_id)
                correct_option = question.correct_option if question else selected_option

                answer_results.append(
                    {
                        "question_id": question_id,
                        "is_correct": False,  # Not re-processed
                        "correct_option": correct_option,
                        "selected_option": selected_option,
                        "xp_earned": 0,
                        "was_duplicate": True,
                    }
                )
                duplicate_answers_count += 1
                continue

            # Get the question
            question = await self._get_question(question_id)
            if question is None:
                logger.warning(
                    "Question not found in submit-all",
                    extra={
                        "session_id": str(session_id),
                        "question_id": str(question_id),
                    },
                )
                # Skip invalid questions but log
                continue

            # Determine correctness
            is_correct = selected_option == question.correct_option
            is_perfect = time_taken_seconds <= PERFECT_RECALL_THRESHOLD_SECONDS

            # Save the answer
            await self.repository.save_answer(
                session_id=session_id,
                question_id=question_id,
                selected_option=selected_option,
                is_correct=is_correct,
                time_taken_seconds=time_taken_seconds,
            )

            # Update session score if correct
            if is_correct:
                session.score += 1

            # Update SM-2 statistics for the question
            await self._update_sm2_stats(
                user_id=user_id,
                question_id=question_id,
                is_correct=is_correct,
            )

            # Award XP
            xp_earned = await self.xp_service.award_culture_answer_xp(
                user_id=user_id,
                is_correct=is_correct,
                is_perfect=is_perfect,
                source_id=question_id,
            )

            total_xp_earned += xp_earned
            new_answers_count += 1

            # Add to existing set to prevent duplicates within same request
            existing_question_ids.add(question_id)

            answer_results.append(
                {
                    "question_id": question_id,
                    "is_correct": is_correct,
                    "correct_option": question.correct_option,
                    "selected_option": selected_option,
                    "xp_earned": xp_earned,
                    "was_duplicate": False,
                }
            )

        # Calculate final score from all answers (existing + new)
        all_answers = await self.repository.get_session_answers(session_id)
        final_score = sum(1 for a in all_answers if a.is_correct)

        # Calculate pass/fail
        percentage = (final_score / session.total_questions) * 100
        passed = percentage >= PASS_THRESHOLD_PERCENTAGE

        # Store total_questions before updating session
        total_questions = session.total_questions

        # Complete the session
        updated_session = await self.repository.complete_session(
            session_id=session_id,
            score=final_score,
            passed=passed,
            time_taken_seconds=total_time_seconds,
        )

        await self.db.commit()

        logger.info(
            "Mock exam submit-all completed",
            extra={
                "user_id": str(user_id),
                "session_id": str(session_id),
                "score": final_score,
                "total_questions": total_questions,
                "percentage": percentage,
                "passed": passed,
                "new_answers": new_answers_count,
                "duplicates": duplicate_answers_count,
                "total_xp": total_xp_earned,
            },
        )

        return {
            "session": updated_session,
            "passed": passed,
            "score": final_score,
            "total_questions": total_questions,
            "percentage": round(percentage, 1),
            "pass_threshold": PASS_THRESHOLD_PERCENTAGE,
            "answer_results": answer_results,
            "total_xp_earned": total_xp_earned,
            "new_answers_count": new_answers_count,
            "duplicate_answers_count": duplicate_answers_count,
        }

    async def complete_exam(
        self,
        user_id: UUID,
        session_id: UUID,
        total_time_seconds: int,
    ) -> dict[str, Any]:
        """Complete a mock exam session and calculate final results.

        Pass threshold: 60% (16/25 correct)

        Args:
            user_id: User UUID
            session_id: Mock exam session UUID
            total_time_seconds: Total time taken for the exam

        Returns:
            Dict with:
            - session: Updated MockExamSession
            - passed: Whether the exam was passed
            - score: Number of correct answers
            - total_questions: Total questions in exam
            - percentage: Score percentage
            - pass_threshold: Required percentage to pass

        Raises:
            MockExamNotFoundException: If session not found
            MockExamSessionExpiredException: If session is not active

        Use Case:
            Finishing the exam
        """
        logger.debug(
            "Completing mock exam",
            extra={
                "user_id": str(user_id),
                "session_id": str(session_id),
            },
        )

        # Get and validate session
        session = await self.repository.get_session(session_id, user_id)
        if session is None:
            raise MockExamNotFoundException(str(session_id))

        if session.status != MockExamStatus.ACTIVE:
            raise MockExamSessionExpiredException(str(session_id))

        # Calculate final score from answers
        answers = await self.repository.get_session_answers(session_id)
        final_score = sum(1 for a in answers if a.is_correct)

        # Calculate pass/fail
        percentage = (final_score / session.total_questions) * 100
        passed = percentage >= PASS_THRESHOLD_PERCENTAGE

        # Store total_questions before updating session
        total_questions = session.total_questions

        # Complete the session
        updated_session = await self.repository.complete_session(
            session_id=session_id,
            score=final_score,
            passed=passed,
            time_taken_seconds=total_time_seconds,
        )

        await self.db.commit()

        logger.info(
            "Mock exam completed",
            extra={
                "user_id": str(user_id),
                "session_id": str(session_id),
                "score": final_score,
                "total_questions": total_questions,
                "percentage": percentage,
                "passed": passed,
            },
        )

        return {
            "session": updated_session,
            "passed": passed,
            "score": final_score,
            "total_questions": total_questions,
            "percentage": round(percentage, 1),
            "pass_threshold": PASS_THRESHOLD_PERCENTAGE,
        }

    async def get_statistics(self, user_id: UUID) -> dict[str, Any]:
        """Get aggregated mock exam statistics with recent exams.

        Args:
            user_id: User UUID

        Returns:
            Dict with:
            - stats: Aggregated statistics (total, passed, pass_rate, etc.)
            - recent_exams: List of recent completed exams

        Use Case:
            Dashboard statistics display
        """
        logger.debug(
            "Getting mock exam statistics",
            extra={"user_id": str(user_id)},
        )

        stats = await self.repository.get_user_statistics(user_id)
        recent_exams = await self.repository.get_recent_exams(user_id, limit=10)

        logger.info(
            "Mock exam statistics retrieved",
            extra={
                "user_id": str(user_id),
                "total_exams": stats["total_exams"],
                "pass_rate": stats["pass_rate"],
            },
        )

        return {
            "stats": stats,
            "recent_exams": recent_exams,
        }

    async def get_active_exam(self, user_id: UUID) -> Optional[dict[str, Any]]:
        """Get user's active mock exam session with questions.

        Args:
            user_id: User UUID

        Returns:
            Dict with session and questions if active exam exists, None otherwise

        Use Case:
            Resuming an in-progress exam
        """
        session = await self.repository.get_active_session(user_id)
        if session is None:
            return None

        questions = await self._get_session_questions(session)

        return {
            "session": session,
            "questions": questions,
            "answers_count": len(session.answers),
        }

    async def abandon_exam(
        self,
        user_id: UUID,
        session_id: UUID,
    ) -> Optional[MockExamSession]:
        """Abandon a mock exam session.

        Args:
            user_id: User UUID
            session_id: Session UUID

        Returns:
            Updated MockExamSession if found and abandoned, None otherwise

        Raises:
            MockExamNotFoundException: If session not found
            MockExamSessionExpiredException: If session is not active

        Use Case:
            User quits exam before completion
        """
        logger.debug(
            "Abandoning mock exam",
            extra={
                "user_id": str(user_id),
                "session_id": str(session_id),
            },
        )

        # Get and validate session
        session = await self.repository.get_session(session_id, user_id)
        if session is None:
            raise MockExamNotFoundException(str(session_id))

        if session.status != MockExamStatus.ACTIVE:
            raise MockExamSessionExpiredException(str(session_id))

        # Abandon the session
        updated_session = await self.repository.abandon_session(session_id)
        await self.db.commit()

        logger.info(
            "Mock exam abandoned",
            extra={
                "user_id": str(user_id),
                "session_id": str(session_id),
            },
        )

        return updated_session

    # =========================================================================
    # Private Helper Methods
    # =========================================================================

    def _build_question_data(self, question: CultureQuestion) -> dict[str, Any]:
        """Build question data dict with presigned image URL.

        Args:
            question: CultureQuestion model

        Returns:
            Dict with question data for API response
        """
        image_url = None
        if question.image_key:
            image_url = self.s3_service.generate_presigned_url(question.image_key)

        # Build options array
        options = [question.option_a, question.option_b]
        if question.option_c is not None:
            options.append(question.option_c)
        if question.option_d is not None:
            options.append(question.option_d)

        return {
            "id": question.id,
            "question_text": question.question_text,
            "options": options,
            "option_count": question.option_count,
            "image_url": image_url,
            "order_index": question.order_index,
        }

    async def _get_question(self, question_id: UUID) -> Optional[CultureQuestion]:
        """Get a question by ID.

        Args:
            question_id: Question UUID

        Returns:
            CultureQuestion if found, None otherwise
        """
        query = select(CultureQuestion).where(CultureQuestion.id == question_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def _get_session_questions(
        self,
        session: MockExamSession,
    ) -> list[dict[str, Any]]:
        """Get questions for an existing session with presigned URLs.

        For resumed sessions, we need to get the questions that were
        originally selected. Since we don't store the question selection
        separately, we use the answers to determine which questions
        were asked, plus get additional random questions if needed.

        Args:
            session: MockExamSession with answers loaded

        Returns:
            List of question data dicts
        """
        # Get question IDs from existing answers
        answered_question_ids = [a.question_id for a in session.answers]

        # If all questions answered, just return those questions
        if len(answered_question_ids) >= session.total_questions:
            questions = await self._get_questions_by_ids(answered_question_ids)
            return [self._build_question_data(q) for q in questions]

        # Get the questions that were answered
        answered_questions = await self._get_questions_by_ids(answered_question_ids)

        # Get additional random questions for remaining slots
        remaining = session.total_questions - len(answered_question_ids)
        if remaining > 0:
            additional = await self.repository.get_random_questions(
                count=remaining,
                exclude_question_ids=answered_question_ids if answered_question_ids else None,
            )
            answered_questions.extend(additional)

        return [self._build_question_data(q) for q in answered_questions]

    async def _get_questions_by_ids(
        self,
        question_ids: list[UUID],
    ) -> list[CultureQuestion]:
        """Get questions by their IDs.

        Args:
            question_ids: List of question UUIDs

        Returns:
            List of CultureQuestion models
        """
        if not question_ids:
            return []

        query = select(CultureQuestion).where(CultureQuestion.id.in_(question_ids))
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def _update_sm2_stats(
        self,
        user_id: UUID,
        question_id: UUID,
        is_correct: bool,
    ) -> None:
        """Update SM-2 statistics for a question.

        Args:
            user_id: User UUID
            question_id: Question UUID
            is_correct: Whether the answer was correct
        """
        # Get or create stats
        query = select(CultureQuestionStats).where(
            CultureQuestionStats.user_id == user_id,
            CultureQuestionStats.question_id == question_id,
        )
        result = await self.db.execute(query)
        stats = result.scalar_one_or_none()

        if stats is None:
            stats = CultureQuestionStats(
                user_id=user_id,
                question_id=question_id,
                easiness_factor=DEFAULT_EASINESS_FACTOR,
                interval=0,
                repetitions=0,
                next_review_date=date.today(),
                status=CardStatus.NEW,
            )
            self.db.add(stats)
            await self.db.flush()

        # Calculate SM-2
        quality = 3 if is_correct else 1  # 3=Good, 1=Again
        sm2_result = calculate_sm2(
            current_ef=stats.easiness_factor,
            current_interval=stats.interval,
            current_repetitions=stats.repetitions,
            quality=quality,
        )

        next_review = calculate_next_review_date(sm2_result.new_interval)

        # Update stats
        stats.easiness_factor = sm2_result.new_easiness_factor
        stats.interval = sm2_result.new_interval
        stats.repetitions = sm2_result.new_repetitions
        stats.next_review_date = next_review
        stats.status = sm2_result.new_status


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["MockExamService"]
