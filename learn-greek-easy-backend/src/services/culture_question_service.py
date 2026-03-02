"""Culture Question Service for SM-2 spaced repetition.

This service handles question retrieval, answer processing, and progress tracking
for culture exam practice sessions. It integrates with the SM-2 algorithm for
spaced repetition scheduling.

Key Features:
- Question queue retrieval with due + new question logic
- Answer processing with SM-2 calculation
- Progress tracking across categories
- Pre-signed S3 URL generation for images
- XP integration with daily goal tracking
- Admin CRUD operations for questions (create, bulk create, update, delete)

Example Usage:
    async with get_db_session() as db:
        service = CultureQuestionService(db)
        queue = await service.get_question_queue(
            user_id=user.id,
            deck_id=deck.id,
            limit=10,
        )
        print(f"Queue has {queue.total_in_queue} questions")

        # Admin operations
        question = await service.create_question(question_data)
        response = await service.bulk_create_questions(deck_id, questions)
"""

import hashlib
from datetime import date, datetime, timedelta
from typing import Optional
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import case, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.constants import (
    ACCURACY_WINDOW_DAYS,
    LOGICAL_CATEGORIES,
    MOTIVATION_DELTA_DAYS,
    MOTIVATION_DELTA_DECLINING_THRESHOLD,
    MOTIVATION_DELTA_IMPROVING_THRESHOLD,
    MOTIVATION_NEW_USER_TEMPLATES,
    MOTIVATION_TEMPLATES,
    REINFORCEMENT_ACCURACY_THRESHOLD,
    REINFORCEMENT_MASTERY_THRESHOLD,
    ReadinessConstants,
)
from src.core.exceptions import CultureDeckNotFoundException, CultureQuestionNotFoundException
from src.core.logging import get_logger
from src.core.sm2 import DEFAULT_EASINESS_FACTOR, calculate_next_review_date, calculate_sm2
from src.db.models import (
    CardStatus,
    CultureAnswerHistory,
    CultureDeck,
    CultureQuestion,
    CultureQuestionStats,
)
from src.repositories import CultureQuestionRepository
from src.repositories.culture_question_stats import CultureQuestionStatsRepository
from src.schemas.culture import (
    CategoryReadiness,
    CultureAnswerResponseFast,
    CultureAnswerResponseWithSM2,
    CultureDeckProgress,
    CultureOverallProgress,
    CultureProgressResponse,
    CultureQuestionAdminResponse,
    CultureQuestionBrowseItem,
    CultureQuestionBrowseResponse,
    CultureQuestionBulkCreateRequest,
    CultureQuestionBulkCreateResponse,
    CultureQuestionCreate,
    CultureQuestionQueue,
    CultureQuestionQueueItem,
    CultureQuestionUpdate,
    CultureReadinessResponse,
    MotivationMessage,
    SM2QuestionResult,
)
from src.services.s3_service import S3Service, get_s3_service
from src.services.xp_constants import (
    PERFECT_RECALL_THRESHOLD_SECONDS,
    XP_CORRECT_ANSWER,
    XP_CULTURE_WRONG,
    XP_FIRST_REVIEW,
    XP_PERFECT_ANSWER,
)
from src.services.xp_service import XPService

logger = get_logger(__name__)


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
        self.xp_service = XPService(db)
        self.stats_repo = CultureQuestionStatsRepository(db)
        self.question_repo = CultureQuestionRepository(db)

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
        force_practice: bool = False,
    ) -> CultureQuestionQueue:
        """Get questions due for review plus new questions.

        Prioritizes:
        1. Overdue questions (past next_review_date) - oldest first
        2. Questions due today
        3. New questions (if include_new=True)
        4. Weakest questions (if force_practice=True and no due/new available)

        Args:
            user_id: User requesting the queue
            deck_id: Deck to get questions from
            limit: Maximum total questions to return (1-50)
            include_new: Whether to include new (unstudied) questions
            new_questions_limit: Maximum new questions if include_new=True
            force_practice: If True and no due/new questions, return weakest studied questions

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

        # Step 3.5: Check if user has studied any questions in this deck
        has_studied = await self._has_studied_questions(user_id, deck_id)

        # Step 3.6: Get weakest questions if force_practice and no due/new available
        weakest_stats: list[CultureQuestionStats] = []
        if force_practice and len(due_stats) == 0 and len(new_questions) == 0 and has_studied:
            weakest_stats = await self._get_weakest_questions(user_id, deck_id, limit)

            logger.debug(
                "Force practice mode: fetched weakest questions",
                extra={
                    "user_id": str(user_id),
                    "weakest_count": len(weakest_stats),
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

        # Add weakest questions (for force_practice mode)
        for stats in weakest_stats:
            question = stats.question  # Eager loaded
            queue_items.append(self._build_queue_item(question, stats))

        logger.info(
            "Question queue built successfully",
            extra={
                "user_id": str(user_id),
                "deck_id": str(deck_id),
                "total_due": len(due_stats),
                "total_new": len(new_questions),
                "total_in_queue": len(queue_items),
                "force_practice": force_practice,
                "has_studied": has_studied,
            },
        )

        return CultureQuestionQueue(
            deck_id=deck_id,
            deck_name=deck.name_en,
            category=deck.category,
            total_due=len(due_stats),
            total_new=len(new_questions),
            total_in_queue=len(queue_items),
            has_studied_questions=has_studied,
            questions=queue_items,
        )

    async def browse_questions(
        self, user_id: UUID, deck_id: UUID, offset: int = 0, limit: int = 100
    ) -> CultureQuestionBrowseResponse:
        """Browse all questions in a deck with per-user status."""
        deck = await self._get_active_deck(deck_id)

        count_query = select(func.count(CultureQuestion.id)).where(
            CultureQuestion.deck_id == deck_id,
            CultureQuestion.is_pending_review == False,  # noqa: E712
        )
        count_result = await self.db.execute(count_query)
        total = count_result.scalar_one()

        query = (
            select(CultureQuestion, CultureQuestionStats.status)
            .outerjoin(
                CultureQuestionStats,
                sa.and_(
                    CultureQuestionStats.question_id == CultureQuestion.id,
                    CultureQuestionStats.user_id == user_id,
                ),
            )
            .where(
                CultureQuestion.deck_id == deck_id,
                CultureQuestion.is_pending_review == False,  # noqa: E712
            )
            .order_by(CultureQuestion.order_index)
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(query)
        rows = result.all()

        items = []
        for question, status in rows:
            items.append(
                CultureQuestionBrowseItem(
                    id=question.id,
                    question_text=question.question_text,
                    option_count=question.option_count,
                    order_index=question.order_index,
                    status=status.value if status else CardStatus.NEW.value,
                )
            )

        return CultureQuestionBrowseResponse(
            deck_id=deck_id,
            deck_name=deck.name_en,
            total=total,
            offset=offset,
            limit=limit,
            questions=items,
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
        language: str = "en",
    ) -> CultureAnswerResponseWithSM2:
        """Process answer submission with SM-2 algorithm and XP integration.

        Quality mapping:
        - Correct answer: quality = 3 (Good)
        - Wrong answer: quality = 1 (Again)

        XP Awards (synchronous - critical path):
        - Correct answer: 10 XP (or 15 XP if < 2 seconds response time)
        - Wrong answer: 2 XP (encouragement - MANDATORY)
        - First review of day bonus: +20 XP (once per day)

        Note: Answer history recording and daily goal check/notification are
        handled in background tasks for faster response time.

        Args:
            user_id: User submitting the answer
            question_id: Question being answered
            selected_option: Selected answer option (1-4)
            time_taken: Time taken in seconds (0-300)
            language: Language used for the question (el, en, ru)

        Returns:
            CultureAnswerResponseWithSM2 with correctness, SM-2 result, and XP earned

        Raises:
            CultureQuestionNotFoundException: If question doesn't exist
            ValueError: If selected_option not in valid range for question
        """
        # Step 1: Get question with deck category in single JOIN query
        question, deck_category = await self._get_question_with_deck_category(question_id)

        # Validate selected_option against question's option count
        if selected_option < 1 or selected_option > question.option_count:
            raise ValueError(
                f"selected_option must be between 1 and {question.option_count}, got {selected_option}"
            )

        # Step 2: Determine correctness
        is_correct = selected_option == question.correct_option
        quality = 3 if is_correct else 1  # SM-2: 3=Good, 1=Again
        is_perfect = time_taken <= PERFECT_RECALL_THRESHOLD_SECONDS

        logger.debug(
            "Processing culture answer",
            extra={
                "user_id": str(user_id),
                "question_id": str(question_id),
                "selected_option": selected_option,
                "correct_option": question.correct_option,
                "is_correct": is_correct,
                "is_perfect": is_perfect,
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

        # Note: Answer history recording moved to background task for faster response

        # Step 6: Award XP for the answer (critical path - must be synchronous)
        xp_earned = await self.xp_service.award_culture_answer_xp(
            user_id=user_id,
            is_correct=is_correct,
            is_perfect=is_perfect,
            source_id=question_id,
        )

        # Step 7: Award first review of day bonus (once per day) - only for correct answers
        if is_correct:
            first_review_bonus = await self.xp_service.award_first_review_bonus(user_id)
            xp_earned += first_review_bonus

        # Note: Daily goal check/notification moved to background task

        # Step 8: Generate feedback message
        message = self._get_feedback_message(
            is_correct=is_correct,
            is_first=previous_status == CardStatus.NEW,
            is_mastered=sm2_result.new_status == CardStatus.MASTERED,
            was_mastered=previous_status == CardStatus.MASTERED,
        )

        # Step 9: Commit transaction
        await self.db.commit()

        logger.info(
            "Culture answer processed successfully",
            extra={
                "user_id": str(user_id),
                "question_id": str(question_id),
                "is_correct": is_correct,
                "xp_earned": xp_earned,
                "previous_status": previous_status.value,
                "new_status": sm2_result.new_status.value,
                "next_review_date": str(next_review),
            },
        )

        return CultureAnswerResponseWithSM2(
            is_correct=is_correct,
            correct_option=question.correct_option,
            xp_earned=xp_earned,
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
            deck_category=deck_category,
        )

    async def process_answer_fast(
        self,
        user_id: UUID,
        question_id: UUID,
        selected_option: int,
        time_taken: int,
        language: str = "en",
    ) -> tuple[CultureAnswerResponseFast, dict]:
        """Process answer submission with minimal DB queries for fast response.

        This method implements the early response pattern - it returns immediately
        with the essential information (correctness, XP estimate, feedback) while
        deferring SM-2 calculations, XP persistence, and achievement checks to
        background tasks.

        Performance: ~23ms vs ~134ms for full process_answer() - 83% reduction.

        XP Calculation (from constants, NO DB queries):
        - Correct answer: XP_CORRECT_ANSWER (10) or XP_PERFECT_ANSWER (15)
        - Wrong answer: XP_CULTURE_WRONG (2)
        - First review bonus: XP_FIRST_REVIEW (20) - optimistically included

        Args:
            user_id: User submitting the answer
            question_id: Question being answered
            selected_option: Selected answer option (1-4)
            time_taken: Time taken in seconds (0-300)
            language: Language used for the question (el, en, ru)

        Returns:
            Tuple of (CultureAnswerResponseFast, context_dict) where context_dict
            contains all data needed by the background task to complete processing.

        Raises:
            CultureQuestionNotFoundException: If question doesn't exist
            ValueError: If selected_option not in valid range for question
        """
        # Step 1: Get question with deck category in single JOIN query
        # This is the ONLY DB query in the fast path
        question, deck_category = await self._get_question_with_deck_category(question_id)

        # Validate selected_option against question's option count
        if selected_option < 1 or selected_option > question.option_count:
            raise ValueError(
                f"selected_option must be between 1 and {question.option_count}, got {selected_option}"
            )

        # Step 2: Determine correctness (no DB needed)
        is_correct = selected_option == question.correct_option
        is_perfect = time_taken <= PERFECT_RECALL_THRESHOLD_SECONDS

        logger.debug(
            "Processing culture answer (fast path)",
            extra={
                "user_id": str(user_id),
                "question_id": str(question_id),
                "is_correct": is_correct,
                "is_perfect": is_perfect,
            },
        )

        # Step 3: Calculate XP from constants (NO DB query)
        # This is an optimistic estimate - includes first review bonus for correct answers only
        if is_correct:
            base_xp = XP_PERFECT_ANSWER if is_perfect else XP_CORRECT_ANSWER
        else:
            base_xp = XP_CULTURE_WRONG

        # Optimistically include first review bonus for correct answers only
        # Wrong answers don't get the first review bonus
        # The background task will handle deduplication
        estimated_xp = base_xp + XP_FIRST_REVIEW if is_correct else base_xp

        # Step 4: Generate feedback message (no DB needed)
        # For fast path, we don't know previous status, so use simplified logic
        if is_correct:
            message = "Correct!"
        else:
            message = "Not quite. Review this question."

        logger.info(
            "Culture answer processed (fast path)",
            extra={
                "user_id": str(user_id),
                "question_id": str(question_id),
                "is_correct": is_correct,
                "estimated_xp": estimated_xp,
                "deck_category": deck_category,
            },
        )

        # Build response
        response = CultureAnswerResponseFast(
            is_correct=is_correct,
            correct_option=question.correct_option,
            xp_earned=estimated_xp,
            message=message,
            deck_category=deck_category,
        )

        # Build context for background task
        context = {
            "user_id": user_id,
            "question_id": question_id,
            "selected_option": selected_option,
            "time_taken": time_taken,
            "language": language,
            "is_correct": is_correct,
            "is_perfect": is_perfect,
            "deck_category": deck_category,
            "correct_option": question.correct_option,
        }

        return response, context

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

    async def get_culture_readiness(self, user_id: UUID) -> CultureReadinessResponse:  # noqa: C901
        """Get culture exam readiness assessment.

        Computes a weighted readiness score across exam-relevant categories
        (history, geography, politics, culture, practical) based on SRS card stages.

        Args:
            user_id: User to assess readiness for

        Returns:
            CultureReadinessResponse with readiness percentage, verdict, and stats
        """
        logger.debug("Getting culture readiness")

        # Map DB categories to logical categories at SQL level
        logical_category = case(
            (CultureDeck.category == "practical", literal("culture")),
            else_=CultureDeck.category,
        )

        category_query = (
            select(
                logical_category.label("logical_category"),
                func.count(CultureQuestion.id).label("questions_total"),
                func.count(
                    case(
                        (
                            CultureQuestionStats.status == CardStatus.LEARNING,
                            CultureQuestionStats.id,
                        )
                    )
                ).label("count_learning"),
                func.count(
                    case(
                        (CultureQuestionStats.status == CardStatus.REVIEW, CultureQuestionStats.id)
                    )
                ).label("count_review"),
                func.count(
                    case(
                        (
                            CultureQuestionStats.status == CardStatus.MASTERED,
                            CultureQuestionStats.id,
                        )
                    )
                ).label("count_mastered"),
                func.array_agg(func.distinct(CultureDeck.id.cast(sa.String))).label("deck_ids"),
            )
            .select_from(CultureQuestion)
            .join(CultureDeck, CultureQuestion.deck_id == CultureDeck.id)
            .outerjoin(
                CultureQuestionStats,
                (CultureQuestionStats.question_id == CultureQuestion.id)
                & (CultureQuestionStats.user_id == user_id),
            )
            .where(
                CultureDeck.is_active == True,  # noqa: E712
                CultureDeck.category.in_(ReadinessConstants.INCLUDED_CATEGORIES),
                CultureQuestion.deck_id.isnot(None),
            )
            .group_by(logical_category)
        )
        result = await self.db.execute(category_query)
        rows = result.all()

        # Build lookup from query results
        category_data: dict[str, dict] = {}
        for row in rows:
            cat = row.logical_category
            qt = row.questions_total
            cm = row.count_mastered

            if qt == 0:
                readiness_pct = 0.0
            else:
                weighted_sum = (
                    row.count_learning * ReadinessConstants.WEIGHT_LEARNING
                    + row.count_review * ReadinessConstants.WEIGHT_REVIEW
                    + cm * ReadinessConstants.WEIGHT_MASTERED
                )
                readiness_pct = (weighted_sum / qt) * 100

            deck_ids = [d for d in (row.deck_ids or []) if d is not None]
            category_data[cat] = {
                "category": cat,
                "readiness_percentage": round(readiness_pct, 1),
                "questions_mastered": cm,
                "questions_total": qt,
                "deck_ids": deck_ids,
            }

        # Zero-fill all 4 logical categories
        categories_list: list[CategoryReadiness] = []
        for cat in LOGICAL_CATEGORIES:
            if cat in category_data:
                categories_list.append(CategoryReadiness(**category_data[cat]))
            else:
                categories_list.append(
                    CategoryReadiness(
                        category=cat,
                        readiness_percentage=0.0,
                        questions_mastered=0,
                        questions_total=0,
                        deck_ids=[],
                    )
                )

        # Sort ascending: weakest categories first, alphabetical tie-break
        categories_list.sort(key=lambda c: (c.readiness_percentage, c.category))

        # Per-category accuracy from last 30 days
        accuracy_cutoff = datetime.utcnow() - timedelta(days=ACCURACY_WINDOW_DAYS)

        logical_cat_acc = case(
            (CultureAnswerHistory.deck_category == "practical", literal("culture")),
            else_=CultureAnswerHistory.deck_category,
        )

        cat_accuracy_query = (
            select(
                logical_cat_acc.label("logical_category"),
                func.count().label("total_answers"),
                func.sum(
                    case(
                        (CultureAnswerHistory.is_correct == True, literal(1)),  # noqa: E712
                        else_=literal(0),
                    )
                ).label("correct_answers"),
            )
            .where(
                CultureAnswerHistory.user_id == user_id,
                CultureAnswerHistory.created_at >= accuracy_cutoff,
                CultureAnswerHistory.deck_category.in_(ReadinessConstants.INCLUDED_CATEGORIES),
            )
            .group_by(logical_cat_acc)
        )
        cat_accuracy_result = await self.db.execute(cat_accuracy_query)
        cat_accuracy_rows = cat_accuracy_result.all()

        # Build accuracy lookup
        cat_accuracy_map: dict[str, dict] = {}
        for acc_row in cat_accuracy_rows:
            total = acc_row.total_answers
            correct = acc_row.correct_answers or 0
            cat_accuracy_map[acc_row.logical_category] = {
                "accuracy_percentage": round(correct / total * 100, 1) if total > 0 else None,
                "total_answers": total,
            }

        # Merge accuracy into categories list
        categories_list = [
            cat.model_copy(
                update={
                    "accuracy_percentage": cat_accuracy_map.get(cat.category, {}).get(
                        "accuracy_percentage"
                    ),
                    "needs_reinforcement": (
                        (
                            acc_pct := cat_accuracy_map.get(cat.category, {}).get(
                                "accuracy_percentage"
                            )
                        )
                        is not None
                        and acc_pct < REINFORCEMENT_ACCURACY_THRESHOLD
                        and cat.readiness_percentage >= REINFORCEMENT_MASTERY_THRESHOLD
                    ),
                }
            )
            for cat in categories_list
        ]

        # Overall totals from per-category aggregates
        questions_total = sum(c.questions_total for c in categories_list)
        count_mastered = sum(c.questions_mastered for c in categories_list)

        # Overall weighted readiness (weighted average, not simple average)
        overall_weighted_sum = 0.0
        for row in rows:
            overall_weighted_sum += (
                row.count_learning * ReadinessConstants.WEIGHT_LEARNING
                + row.count_review * ReadinessConstants.WEIGHT_REVIEW
                + row.count_mastered * ReadinessConstants.WEIGHT_MASTERED
            )

        if questions_total == 0:
            readiness_percentage = 0.0
        else:
            readiness_percentage = (overall_weighted_sum / questions_total) * 100

        # Accuracy query: from culture_answer_history filtered by included categories
        accuracy_query = select(
            func.count().label("total_answers"),
            func.sum(
                case((CultureAnswerHistory.is_correct == True, 1), else_=0)  # noqa: E712
            ).label("correct_answers"),
        ).where(
            CultureAnswerHistory.user_id == user_id,
            CultureAnswerHistory.deck_category.in_(ReadinessConstants.INCLUDED_CATEGORIES),
        )
        accuracy_result = await self.db.execute(accuracy_query)
        accuracy_row = accuracy_result.one()
        total_answers = accuracy_row.total_answers or 0
        correct_answers = accuracy_row.correct_answers or 0

        accuracy_percentage: Optional[float] = None
        if total_answers > 0:
            accuracy_percentage = (correct_answers / total_answers) * 100

        # Determine verdict from thresholds
        verdict = ReadinessConstants.VERDICT_THRESHOLDS[-1][1]  # default lowest
        for threshold, label in sorted(
            ReadinessConstants.VERDICT_THRESHOLDS, key=lambda t: t[0], reverse=True
        ):
            if readiness_percentage >= threshold:
                verdict = label
                break

        # For has_stats: check if user has any stats at all
        total_count_learning = sum(row.count_learning for row in rows)
        total_count_review = sum(row.count_review for row in rows)
        has_stats = (count_mastered + total_count_review + total_count_learning) > 0

        logger.info(
            "Culture readiness retrieved",
            extra={
                "readiness_percentage": readiness_percentage,
                "verdict": verdict,
                "questions_total": questions_total,
                "count_mastered": count_mastered,
            },
        )

        # Compute motivational message
        motivation = await self._compute_motivation(
            user_id=user_id,
            current_readiness=readiness_percentage,
            current_verdict=verdict,
            questions_total=questions_total,
            questions_learned=count_mastered,
            has_stats=has_stats,
        )

        return CultureReadinessResponse(
            readiness_percentage=round(readiness_percentage, 1),
            verdict=verdict,
            questions_total=questions_total,
            questions_learned=count_mastered,
            accuracy_percentage=(
                round(accuracy_percentage, 1) if accuracy_percentage is not None else None
            ),
            total_answers=total_answers,
            categories=categories_list,
            motivation=motivation,
        )

    # =========================================================================
    # Private Helper Methods
    # =========================================================================

    async def _compute_motivation(
        self,
        user_id: UUID,
        current_readiness: float,
        current_verdict: str,
        questions_total: int,
        questions_learned: int,
        has_stats: bool,
    ) -> Optional[MotivationMessage]:
        """Compute weekly motivational message based on readiness trend."""
        # Guard: no questions means no message
        if questions_total == 0:
            return None

        # New user: no historical stats
        if not has_stats:
            iso_week = date.today().isocalendar()[1]
            seed = f"{user_id}{iso_week}"
            variant_index = int(hashlib.sha256(seed.encode()).hexdigest(), 16) % len(
                MOTIVATION_NEW_USER_TEMPLATES
            )
            return MotivationMessage(
                message_key=MOTIVATION_NEW_USER_TEMPLATES[variant_index],
                params={"questionsTotal": questions_total},
                delta_direction="new_user",
                delta_percentage=0.0,
            )

        # Past readiness: stats with status counts from > MOTIVATION_DELTA_DAYS ago
        cutoff = datetime.utcnow() - timedelta(days=MOTIVATION_DELTA_DAYS)
        past_stats_query = (
            select(
                func.count(
                    case(
                        (
                            CultureQuestionStats.status == CardStatus.LEARNING,
                            CultureQuestionStats.id,
                        )
                    )
                ).label("count_learning"),
                func.count(
                    case(
                        (CultureQuestionStats.status == CardStatus.REVIEW, CultureQuestionStats.id)
                    )
                ).label("count_review"),
                func.count(
                    case(
                        (
                            CultureQuestionStats.status == CardStatus.MASTERED,
                            CultureQuestionStats.id,
                        )
                    )
                ).label("count_mastered"),
            )
            .select_from(CultureQuestion)
            .join(CultureDeck, CultureQuestion.deck_id == CultureDeck.id)
            .outerjoin(
                CultureQuestionStats,
                (CultureQuestionStats.question_id == CultureQuestion.id)
                & (CultureQuestionStats.user_id == user_id)
                & (CultureQuestionStats.updated_at <= cutoff),
            )
            .where(
                CultureDeck.category.in_(ReadinessConstants.INCLUDED_CATEGORIES),
                CultureDeck.is_active == True,  # noqa: E712
            )
        )
        past_result = await self.db.execute(past_stats_query)
        past_row = past_result.one()

        if questions_total == 0:
            past_readiness = 0.0
        else:
            past_weighted = (
                past_row.count_learning * ReadinessConstants.WEIGHT_LEARNING
                + past_row.count_review * ReadinessConstants.WEIGHT_REVIEW
                + past_row.count_mastered * ReadinessConstants.WEIGHT_MASTERED
            )
            past_readiness = (past_weighted / questions_total) * 100

        delta = current_readiness - past_readiness
        if delta > MOTIVATION_DELTA_IMPROVING_THRESHOLD:
            direction = "improving"
        elif delta < MOTIVATION_DELTA_DECLINING_THRESHOLD:
            direction = "declining"
        else:
            direction = "stagnant"

        templates = MOTIVATION_TEMPLATES.get((direction, current_verdict), [])
        if not templates:
            return None

        iso_week = date.today().isocalendar()[1]
        seed = f"{user_id}{iso_week}"
        variant_index = int(hashlib.sha256(seed.encode()).hexdigest(), 16) % len(templates)

        return MotivationMessage(
            message_key=templates[variant_index],
            params={
                "currentPercent": round(current_readiness, 1),
                "previousPercent": round(past_readiness, 1),
                "delta": round(abs(delta), 1),
                "questionsTotal": questions_total,
                "questionsLearned": questions_learned,
            },
            delta_direction=direction,
            delta_percentage=round(delta, 1),
        )

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

    async def _get_question_with_deck_category(
        self, question_id: UUID
    ) -> tuple[CultureQuestion, str]:
        """Get question with its deck category in a single JOIN query.

        This method optimizes the common pattern of fetching a question and
        then needing its deck category for achievements or history tracking.

        Args:
            question_id: Question UUID to retrieve

        Returns:
            Tuple of (CultureQuestion, deck_category string)

        Raises:
            CultureQuestionNotFoundException: If question doesn't exist
        """
        query = (
            select(CultureQuestion, CultureDeck.category)
            .join(CultureDeck, CultureQuestion.deck_id == CultureDeck.id)
            .where(CultureQuestion.id == question_id)
        )
        result = await self.db.execute(query)
        row = result.one_or_none()

        if not row:
            raise CultureQuestionNotFoundException(question_id=str(question_id))

        return row[0], row[1]

    async def get_question_deck_category(self, question_id: UUID) -> str:
        """Get the deck category for a question.

        Args:
            question_id: Question UUID

        Returns:
            Category string (history, geography, politics, culture, traditions)

        Raises:
            CultureQuestionNotFoundException: If question doesn't exist
        """
        query = (
            select(CultureDeck.category)
            .join(CultureQuestion, CultureQuestion.deck_id == CultureDeck.id)
            .where(CultureQuestion.id == question_id)
        )
        result = await self.db.execute(query)
        category = result.scalar_one_or_none()

        if not category:
            raise CultureQuestionNotFoundException(question_id=str(question_id))

        return category

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

    async def _has_studied_questions(self, user_id: UUID, deck_id: UUID) -> bool:
        """Check if user has any stats records for questions in this deck.

        Used to determine whether to show "Practice Anyway" option when
        no questions are due for review.

        Args:
            user_id: User ID
            deck_id: Deck to check

        Returns:
            True if user has studied at least one question in this deck
        """
        query = (
            select(func.count())
            .select_from(CultureQuestionStats)
            .join(CultureQuestion, CultureQuestionStats.question_id == CultureQuestion.id)
            .where(
                CultureQuestionStats.user_id == user_id,
                CultureQuestion.deck_id == deck_id,
            )
        )
        result = await self.db.execute(query)
        count = result.scalar() or 0
        return count > 0

    async def _get_weakest_questions(
        self,
        user_id: UUID,
        deck_id: UUID,
        limit: int,
    ) -> list[CultureQuestionStats]:
        """Get user's weakest (hardest) questions ordered by ease factor.

        Returns questions the user has studied, sorted by easiness_factor ascending
        (lowest = most difficult). Excludes questions that are already due.

        Used for "Practice Anyway" feature when no questions are due for review.

        Args:
            user_id: User ID
            deck_id: Deck to filter by
            limit: Maximum number of questions

        Returns:
            List of CultureQuestionStats with question eager loaded, ordered by
            easiness_factor ascending (weakest first)
        """
        query = (
            select(CultureQuestionStats)
            .join(CultureQuestion, CultureQuestionStats.question_id == CultureQuestion.id)
            .where(
                CultureQuestionStats.user_id == user_id,
                CultureQuestion.deck_id == deck_id,
                CultureQuestionStats.next_review_date > date.today(),  # Exclude already due
            )
            .options(selectinload(CultureQuestionStats.question))
            .order_by(CultureQuestionStats.easiness_factor.asc())
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
        """Build queue item with presigned image and audio URLs.

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

        # Generate presigned URL if audio exists
        audio_url = None
        if question.audio_s3_key:
            audio_url = self.s3_service.generate_presigned_url(question.audio_s3_key)

        # Build dynamic options array (2-4 options)
        options = [question.option_a, question.option_b]
        if question.option_c is not None:
            options.append(question.option_c)
        if question.option_d is not None:
            options.append(question.option_d)

        return CultureQuestionQueueItem(
            id=question.id,
            question_text=question.question_text,
            options=options,
            option_count=question.option_count,
            image_url=image_url,
            audio_url=audio_url,
            order_index=question.order_index,
            correct_option=question.correct_option,
            is_new=stats is None,
            due_date=stats.next_review_date if stats else None,
            status=stats.status.value if stats else CardStatus.NEW.value,
            original_article_url=question.original_article_url,
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

    # =========================================================================
    # Admin CRUD Methods
    # =========================================================================

    async def create_question(
        self,
        question_data: CultureQuestionCreate,
    ) -> CultureQuestionAdminResponse:
        """Create a new culture question.

        Args:
            question_data: Question creation data with multilingual fields

        Returns:
            CultureQuestionAdminResponse with created question details

        Raises:
            CultureDeckNotFoundException: If deck doesn't exist

        Note:
            - Requires superuser privileges (enforced in router)
            - Transaction commit must be done by caller
        """
        logger.info(
            "Creating culture question",
            extra={
                "deck_id": str(question_data.deck_id),
                "correct_option": question_data.correct_option,
            },
        )

        # Validate deck exists
        deck = await self._get_deck_or_none(question_data.deck_id)
        if deck is None:
            raise CultureDeckNotFoundException(deck_id=str(question_data.deck_id))

        # Convert Pydantic model to dict, converting MultilingualText to dict
        # Handle nullable option_c and option_d for 2-3 option questions
        question_dict = {
            "deck_id": question_data.deck_id,
            "question_text": question_data.question_text.model_dump(),
            "option_a": question_data.option_a.model_dump(),
            "option_b": question_data.option_b.model_dump(),
            "option_c": question_data.option_c.model_dump() if question_data.option_c else None,
            "option_d": question_data.option_d.model_dump() if question_data.option_d else None,
            "correct_option": question_data.correct_option,
            "image_key": question_data.image_key,
            "order_index": question_data.order_index,
        }

        # Create question using repository
        question = await self.question_repo.create(question_dict)

        logger.info(
            "Culture question created",
            extra={
                "question_id": str(question.id),
                "deck_id": str(question.deck_id),
            },
        )

        return CultureQuestionAdminResponse.model_validate(question)

    async def bulk_create_questions(
        self,
        request: CultureQuestionBulkCreateRequest,
    ) -> CultureQuestionBulkCreateResponse:
        """Create multiple questions in one transaction.

        Args:
            request: Bulk create request with deck_id and questions array

        Returns:
            CultureQuestionBulkCreateResponse with created questions

        Raises:
            CultureDeckNotFoundException: If deck doesn't exist

        Note:
            - Requires superuser privileges (enforced in router)
            - All-or-nothing: if any question fails, entire request is rejected
            - Limit: 1-100 questions per request
        """
        logger.info(
            "Bulk creating culture questions",
            extra={
                "deck_id": str(request.deck_id),
                "question_count": len(request.questions),
            },
        )

        # Validate deck exists
        deck = await self._get_deck_or_none(request.deck_id)
        if deck is None:
            raise CultureDeckNotFoundException(deck_id=str(request.deck_id))

        # Convert questions to dict format
        # Handle nullable option_c and option_d for 2-3 option questions
        questions_data = []
        for q in request.questions:
            questions_data.append(
                {
                    "deck_id": request.deck_id,
                    "question_text": q.question_text.model_dump(),
                    "option_a": q.option_a.model_dump(),
                    "option_b": q.option_b.model_dump(),
                    "option_c": q.option_c.model_dump() if q.option_c else None,
                    "option_d": q.option_d.model_dump() if q.option_d else None,
                    "correct_option": q.correct_option,
                    "image_key": q.image_key,
                    "order_index": q.order_index,
                }
            )

        # Bulk create using repository
        created_questions = await self.question_repo.bulk_create(questions_data)

        logger.info(
            "Culture questions bulk created",
            extra={
                "deck_id": str(request.deck_id),
                "created_count": len(created_questions),
            },
        )

        return CultureQuestionBulkCreateResponse(
            deck_id=request.deck_id,
            created_count=len(created_questions),
            questions=[CultureQuestionAdminResponse.model_validate(q) for q in created_questions],
        )

    async def update_question(
        self,
        question_id: UUID,
        question_data: CultureQuestionUpdate,
    ) -> CultureQuestion:
        """Update an existing culture question.

        Args:
            question_id: UUID of question to update
            question_data: Fields to update (all optional)

        Returns:
            Updated CultureQuestion SQLAlchemy model (not committed)

        Raises:
            CultureQuestionNotFoundException: If question doesn't exist

        Note:
            - Requires superuser privileges (enforced in router)
            - deck_id cannot be changed
            - Caller must commit and refresh
        """
        logger.debug(
            "Updating culture question",
            extra={"question_id": str(question_id)},
        )

        # Get existing question
        question = await self.question_repo.get(question_id)
        if question is None:
            raise CultureQuestionNotFoundException(question_id=str(question_id))

        # Build update dict, converting MultilingualText to dict
        update_dict = {}
        for field, value in question_data.model_dump(exclude_unset=True).items():
            if field in ("question_text", "option_a", "option_b", "option_c", "option_d"):
                if value is not None:
                    # Already a dict from model_dump
                    update_dict[field] = value
            else:
                update_dict[field] = value

        # Update question using repository
        updated_question = await self.question_repo.update(question, update_dict)

        logger.info(
            "Culture question updated",
            extra={
                "question_id": str(question_id),
                "updated_fields": list(update_dict.keys()),
            },
        )

        return updated_question

    async def delete_question(self, question_id: UUID) -> None:
        """Hard delete a culture question.

        Args:
            question_id: UUID of question to delete

        Raises:
            CultureQuestionNotFoundException: If question doesn't exist

        Note:
            - Requires superuser privileges (enforced in router)
            - HARD DELETE: permanently removes question and all statistics
        """
        logger.debug(
            "Deleting culture question",
            extra={"question_id": str(question_id)},
        )

        # Get existing question
        question = await self.question_repo.get(question_id)
        if question is None:
            raise CultureQuestionNotFoundException(question_id=str(question_id))

        # Hard delete the question
        await self.question_repo.delete(question)

        logger.info(
            "Culture question deleted",
            extra={"question_id": str(question_id)},
        )

    async def _get_deck_or_none(self, deck_id: UUID) -> Optional[CultureDeck]:
        """Get deck by ID without raising exception.

        Args:
            deck_id: Deck UUID

        Returns:
            CultureDeck if found, None otherwise
        """
        query = select(CultureDeck).where(CultureDeck.id == deck_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["CultureQuestionService"]
