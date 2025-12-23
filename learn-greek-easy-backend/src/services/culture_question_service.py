"""Culture Question Service for SM-2 spaced repetition.

This service handles question retrieval, answer processing, and progress tracking
for culture exam practice sessions. It integrates with the SM-2 algorithm for
spaced repetition scheduling.

Key Features:
- Question queue retrieval with due + new question logic
- Answer processing with SM-2 calculation
- Progress tracking across categories
- Pre-signed S3 URL generation for images

Example Usage:
    async with get_db_session() as db:
        service = CultureQuestionService(db)
        queue = await service.get_question_queue(
            user_id=user.id,
            deck_id=deck.id,
            limit=10,
        )
        print(f"Queue has {queue.total_in_queue} questions")
"""

import logging
from datetime import date
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.exceptions import CultureDeckNotFoundException, CultureQuestionNotFoundException
from src.core.sm2 import DEFAULT_EASINESS_FACTOR, calculate_next_review_date, calculate_sm2
from src.db.models import CardStatus, CultureDeck, CultureQuestion, CultureQuestionStats
from src.schemas.culture import (
    CultureAnswerResponseWithSM2,
    CultureDeckProgress,
    CultureOverallProgress,
    CultureProgressResponse,
    CultureQuestionQueue,
    CultureQuestionQueueItem,
    SM2QuestionResult,
)
from src.services.s3_service import S3Service, get_s3_service

logger = logging.getLogger(__name__)


class CultureQuestionService:
    """Service for culture question operations with SM-2 integration.

    This service orchestrates the full practice session flow:
    1. Get question queue with due + new questions
    2. Process answers with SM-2 calculation
    3. Track progress across categories and decks

    Attributes:
        db: Async database session
        s3_service: S3 service for pre-signed URL generation
    """

    def __init__(
        self,
        db: AsyncSession,
        s3_service: Optional[S3Service] = None,
    ):
        """Initialize the Culture Question service.

        Args:
            db: Async database session for persistence operations
            s3_service: Optional S3 service for image URLs (defaults to singleton)
        """
        self.db = db
        self.s3_service = s3_service or get_s3_service()

    # =========================================================================
    # Question Queue Methods
    # =========================================================================

    async def get_question_queue(
        self,
        user_id: UUID,
        deck_id: UUID,
        limit: int = 10,
        include_new: bool = True,
        new_questions_limit: int = 5,
    ) -> CultureQuestionQueue:
        """Get questions due for review plus new questions.

        Prioritizes:
        1. Overdue questions (past next_review_date) - oldest first
        2. Questions due today
        3. New questions (if include_new=True)

        Args:
            user_id: User requesting the queue
            deck_id: Deck to get questions from
            limit: Maximum total questions to return (1-50)
            include_new: Whether to include new (unstudied) questions
            new_questions_limit: Maximum new questions if include_new=True

        Returns:
            CultureQuestionQueue with questions for practice

        Raises:
            CultureDeckNotFoundException: If deck doesn't exist or is inactive
        """
        # Step 1: Validate deck exists and is active
        deck = await self._get_active_deck(deck_id)

        logger.debug(
            "Building question queue",
            extra={
                "user_id": str(user_id),
                "deck_id": str(deck_id),
                "limit": limit,
                "include_new": include_new,
            },
        )

        # Step 2: Get due questions (ordered by next_review_date - oldest first)
        due_stats = await self._get_due_questions(user_id, deck_id, limit)

        logger.debug(
            "Found due questions",
            extra={
                "user_id": str(user_id),
                "due_count": len(due_stats),
            },
        )

        # Step 3: Get new questions if requested and room available
        new_questions: list[CultureQuestion] = []
        if include_new and len(due_stats) < limit:
            remaining_slots = min(new_questions_limit, limit - len(due_stats))
            if remaining_slots > 0:
                new_questions = await self._get_new_questions(user_id, deck_id, remaining_slots)

                logger.debug(
                    "Added new questions to queue",
                    extra={
                        "user_id": str(user_id),
                        "new_count": len(new_questions),
                    },
                )

        # Step 4: Build queue items with presigned image URLs
        queue_items: list[CultureQuestionQueueItem] = []

        # Add due questions first (have statistics)
        for stats in due_stats:
            question = stats.question  # Eager loaded
            queue_items.append(self._build_queue_item(question, stats))

        # Add new questions (no statistics yet)
        for question in new_questions:
            queue_items.append(self._build_queue_item(question, stats=None))

        logger.info(
            "Question queue built successfully",
            extra={
                "user_id": str(user_id),
                "deck_id": str(deck_id),
                "total_due": len(due_stats),
                "total_new": len(new_questions),
                "total_in_queue": len(queue_items),
            },
        )

        return CultureQuestionQueue(
            deck_id=deck_id,
            deck_name=deck.name,
            total_due=len(due_stats),
            total_new=len(new_questions),
            total_in_queue=len(queue_items),
            questions=queue_items,
        )

    # =========================================================================
    # Answer Processing Methods
    # =========================================================================

    async def process_answer(
        self,
        user_id: UUID,
        question_id: UUID,
        selected_option: int,
        time_taken: int,
    ) -> CultureAnswerResponseWithSM2:
        """Process answer submission with SM-2 algorithm.

        Quality mapping:
        - Correct answer: quality = 3 (Good)
        - Wrong answer: quality = 1 (Again)

        Args:
            user_id: User submitting the answer
            question_id: Question being answered
            selected_option: Selected answer option (1-4)
            time_taken: Time taken in seconds (0-300)

        Returns:
            CultureAnswerResponseWithSM2 with correctness and SM-2 result

        Raises:
            CultureQuestionNotFoundException: If question doesn't exist
            ValueError: If selected_option not in range 1-4
        """
        # Validate selected_option
        if selected_option < 1 or selected_option > 4:
            raise ValueError(f"selected_option must be between 1 and 4, got {selected_option}")

        # Step 1: Get question
        question = await self._get_question(question_id)

        # Step 2: Determine correctness
        is_correct = selected_option == question.correct_option
        quality = 3 if is_correct else 1  # SM-2: 3=Good, 1=Again

        logger.debug(
            "Processing culture answer",
            extra={
                "user_id": str(user_id),
                "question_id": str(question_id),
                "selected_option": selected_option,
                "correct_option": question.correct_option,
                "is_correct": is_correct,
                "quality": quality,
            },
        )

        # Step 3: Get or create stats
        stats = await self._get_or_create_stats(user_id, question_id)
        previous_status = stats.status

        # Step 4: Calculate SM-2
        sm2_result = calculate_sm2(
            current_ef=stats.easiness_factor,
            current_interval=stats.interval,
            current_repetitions=stats.repetitions,
            quality=quality,
        )

        next_review = calculate_next_review_date(sm2_result.new_interval)

        # Step 5: Update stats
        stats.easiness_factor = sm2_result.new_easiness_factor
        stats.interval = sm2_result.new_interval
        stats.repetitions = sm2_result.new_repetitions
        stats.next_review_date = next_review
        stats.status = sm2_result.new_status

        await self.db.flush()

        # Step 6: Generate feedback message
        message = self._get_feedback_message(
            is_correct=is_correct,
            is_first=previous_status == CardStatus.NEW,
            is_mastered=sm2_result.new_status == CardStatus.MASTERED,
            was_mastered=previous_status == CardStatus.MASTERED,
        )

        # Step 7: Commit transaction
        await self.db.commit()

        logger.info(
            "Culture answer processed successfully",
            extra={
                "user_id": str(user_id),
                "question_id": str(question_id),
                "is_correct": is_correct,
                "previous_status": previous_status.value,
                "new_status": sm2_result.new_status.value,
                "next_review_date": str(next_review),
            },
        )

        return CultureAnswerResponseWithSM2(
            is_correct=is_correct,
            correct_option=question.correct_option,
            xp_earned=0,  # XP integration in CULTURE-06
            sm2_result=SM2QuestionResult(
                success=True,
                question_id=question_id,
                previous_status=previous_status.value,
                new_status=sm2_result.new_status.value,
                easiness_factor=sm2_result.new_easiness_factor,
                interval=sm2_result.new_interval,
                repetitions=sm2_result.new_repetitions,
                next_review_date=next_review,
            ),
            message=message,
        )

    # =========================================================================
    # Progress Methods
    # =========================================================================

    async def get_culture_progress(self, user_id: UUID) -> CultureProgressResponse:
        """Get overall culture learning progress.

        Args:
            user_id: User to get progress for

        Returns:
            CultureProgressResponse with overall stats and category breakdown
        """
        logger.debug(
            "Getting culture progress",
            extra={"user_id": str(user_id)},
        )

        # Get total questions across all active decks
        total_query = (
            select(func.count(CultureQuestion.id))
            .join(CultureDeck, CultureQuestion.deck_id == CultureDeck.id)
            .where(CultureDeck.is_active == True)  # noqa: E712
        )
        total_result = await self.db.execute(total_query)
        total_questions = total_result.scalar_one()

        # Count by status for this user
        status_query = (
            select(
                CultureQuestionStats.status,
                func.count(CultureQuestionStats.id).label("count"),
            )
            .where(CultureQuestionStats.user_id == user_id)
            .group_by(CultureQuestionStats.status)
        )
        status_result = await self.db.execute(status_query)
        status_counts: dict[str, int] = {}
        for row in status_result:
            # Access named tuple columns: (status, count)
            status_counts[row[0].value] = row[1]

        mastered = status_counts.get(CardStatus.MASTERED.value, 0)
        learning = status_counts.get(CardStatus.LEARNING.value, 0)
        review = status_counts.get(CardStatus.REVIEW.value, 0)
        in_progress = mastered + learning + review
        new_count = total_questions - in_progress

        # Count due questions
        due_query = select(func.count(CultureQuestionStats.id)).where(
            CultureQuestionStats.user_id == user_id,
            CultureQuestionStats.next_review_date <= date.today(),
        )
        due_result = await self.db.execute(due_query)
        due_count = due_result.scalar_one()

        # Count decks started (at least one question answered)
        decks_started_query = (
            select(func.count(func.distinct(CultureQuestion.deck_id)))
            .join(CultureQuestionStats, CultureQuestionStats.question_id == CultureQuestion.id)
            .where(CultureQuestionStats.user_id == user_id)
        )
        decks_started_result = await self.db.execute(decks_started_query)
        decks_started = decks_started_result.scalar_one()

        # Get progress by category
        by_category = await self._get_progress_by_category(user_id)

        # Count completed decks (all questions mastered) - simplified version
        decks_completed = 0  # Would require more complex query

        overall = CultureOverallProgress(
            total_questions=total_questions,
            questions_mastered=mastered,
            questions_learning=learning + review,
            questions_new=new_count,
            decks_started=decks_started,
            decks_completed=decks_completed,
            accuracy_percentage=0.0,  # Would need answer history
            total_practice_sessions=0,  # Would need session tracking
        )

        logger.info(
            "Culture progress retrieved",
            extra={
                "user_id": str(user_id),
                "total_questions": total_questions,
                "mastered": mastered,
                "due": due_count,
            },
        )

        return CultureProgressResponse(
            overall=overall,
            by_category=by_category,
            recent_sessions=[],  # Session tracking in future subtask
        )

    # =========================================================================
    # Private Helper Methods
    # =========================================================================

    async def _get_active_deck(self, deck_id: UUID) -> CultureDeck:
        """Get deck or raise 404.

        Args:
            deck_id: Deck UUID to retrieve

        Returns:
            CultureDeck if found and active

        Raises:
            CultureDeckNotFoundException: If deck doesn't exist or is inactive
        """
        query = select(CultureDeck).where(
            CultureDeck.id == deck_id,
            CultureDeck.is_active == True,  # noqa: E712
        )
        result = await self.db.execute(query)
        deck = result.scalar_one_or_none()

        if not deck:
            raise CultureDeckNotFoundException(deck_id=str(deck_id))

        return deck

    async def _get_question(self, question_id: UUID) -> CultureQuestion:
        """Get question or raise 404.

        Args:
            question_id: Question UUID to retrieve

        Returns:
            CultureQuestion if found

        Raises:
            CultureQuestionNotFoundException: If question doesn't exist
        """
        query = select(CultureQuestion).where(CultureQuestion.id == question_id)
        result = await self.db.execute(query)
        question = result.scalar_one_or_none()

        if not question:
            raise CultureQuestionNotFoundException(question_id=str(question_id))

        return question

    async def _get_due_questions(
        self,
        user_id: UUID,
        deck_id: UUID,
        limit: int,
    ) -> list[CultureQuestionStats]:
        """Get questions due for review, ordered by next_review_date.

        Args:
            user_id: User ID
            deck_id: Deck to filter by
            limit: Maximum number of questions

        Returns:
            List of CultureQuestionStats with question eager loaded
        """
        query = (
            select(CultureQuestionStats)
            .join(CultureQuestion, CultureQuestionStats.question_id == CultureQuestion.id)
            .where(
                CultureQuestionStats.user_id == user_id,
                CultureQuestion.deck_id == deck_id,
                CultureQuestionStats.next_review_date <= date.today(),
            )
            .options(selectinload(CultureQuestionStats.question))
            .order_by(CultureQuestionStats.next_review_date)
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def _get_new_questions(
        self,
        user_id: UUID,
        deck_id: UUID,
        limit: int,
    ) -> list[CultureQuestion]:
        """Get questions user hasn't studied yet.

        Args:
            user_id: User ID
            deck_id: Deck to filter by
            limit: Maximum number of questions

        Returns:
            List of CultureQuestion not yet studied by user
        """
        # Subquery: questions with stats for this user
        studied_subq = (
            select(CultureQuestionStats.question_id)
            .where(CultureQuestionStats.user_id == user_id)
            .scalar_subquery()
        )

        query = (
            select(CultureQuestion)
            .where(
                CultureQuestion.deck_id == deck_id,
                ~CultureQuestion.id.in_(studied_subq),
            )
            .order_by(CultureQuestion.order_index)
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def _get_or_create_stats(
        self,
        user_id: UUID,
        question_id: UUID,
    ) -> CultureQuestionStats:
        """Get existing stats or create new with SM-2 defaults.

        Args:
            user_id: User ID
            question_id: Question ID

        Returns:
            CultureQuestionStats record (existing or new)
        """
        query = select(CultureQuestionStats).where(
            CultureQuestionStats.user_id == user_id,
            CultureQuestionStats.question_id == question_id,
        )
        result = await self.db.execute(query)
        stats = result.scalar_one_or_none()

        if not stats:
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

        return stats

    def _build_queue_item(
        self,
        question: CultureQuestion,
        stats: Optional[CultureQuestionStats],
    ) -> CultureQuestionQueueItem:
        """Build queue item with presigned image URL.

        Args:
            question: The culture question
            stats: Optional statistics (None for new questions)

        Returns:
            CultureQuestionQueueItem with all fields populated
        """
        # Generate presigned URL if image exists
        image_url = None
        if question.image_key:
            image_url = self.s3_service.generate_presigned_url(question.image_key)

        return CultureQuestionQueueItem(
            id=question.id,
            question_text=question.question_text,
            options=[
                question.option_a,
                question.option_b,
                question.option_c,
                question.option_d,
            ],
            image_url=image_url,
            order_index=question.order_index,
            is_new=stats is None,
            due_date=stats.next_review_date if stats else None,
            status=stats.status.value if stats else CardStatus.NEW.value,
        )

    def _get_feedback_message(
        self,
        is_correct: bool,
        is_first: bool,
        is_mastered: bool,
        was_mastered: bool,
    ) -> Optional[str]:
        """Generate feedback message for UI.

        Args:
            is_correct: Whether the answer was correct
            is_first: Whether this was the first time answering
            is_mastered: Whether the question is now mastered
            was_mastered: Whether the question was previously mastered

        Returns:
            Feedback message string or None
        """
        if is_mastered and not was_mastered:
            return "Excellent! Question mastered!"
        if was_mastered and not is_mastered:
            return "Keep practicing this one."
        if is_correct and is_first:
            return "Good start!"
        if is_correct:
            return "Correct!"
        return "Not quite. Review this question."

    async def _get_progress_by_category(self, user_id: UUID) -> dict[str, CultureDeckProgress]:
        """Get progress statistics broken down by deck category.

        Args:
            user_id: User ID

        Returns:
            Dict mapping category to CultureDeckProgress objects
        """
        # Get all active decks with their categories
        decks_query = select(CultureDeck.id, CultureDeck.category).where(
            CultureDeck.is_active == True  # noqa: E712
        )
        decks_result = await self.db.execute(decks_query)
        decks_by_category: dict[str, list[UUID]] = {}
        for row in decks_result:
            if row.category not in decks_by_category:
                decks_by_category[row.category] = []
            decks_by_category[row.category].append(row.id)

        progress: dict[str, CultureDeckProgress] = {}

        for category, deck_ids in decks_by_category.items():
            # Count total questions in this category
            total_query = select(func.count(CultureQuestion.id)).where(
                CultureQuestion.deck_id.in_(deck_ids)
            )
            total_result = await self.db.execute(total_query)
            total = total_result.scalar_one()

            # Count mastered in this category
            mastered_query = (
                select(func.count(CultureQuestionStats.id))
                .join(CultureQuestion, CultureQuestionStats.question_id == CultureQuestion.id)
                .where(
                    CultureQuestionStats.user_id == user_id,
                    CultureQuestion.deck_id.in_(deck_ids),
                    CultureQuestionStats.status == CardStatus.MASTERED,
                )
            )
            mastered_result = await self.db.execute(mastered_query)
            mastered = mastered_result.scalar_one()

            progress[category] = CultureDeckProgress(
                questions_total=total,
                questions_mastered=mastered,
                questions_learning=0,  # Simplified for now
                questions_new=total - mastered,
                last_practiced_at=None,
            )

        return progress


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["CultureQuestionService"]
