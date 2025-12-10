"""SM-2 Spaced Repetition Service.

This service orchestrates review processing, combining the pure SM-2 algorithm
with database operations for card statistics, review history, and progress tracking.

The service handles:
1. Processing individual reviews with SM-2 calculations
2. Creating review history records
3. Updating user progress metrics
4. Managing card statistics lifecycle
5. Bulk review processing with partial failure handling

Example Usage:
    async with get_db_session() as db:
        service = SM2Service(db)
        result = await service.process_review(
            user_id=user.id,
            card_id=card.id,
            quality=4,
            time_taken=15,
        )
        print(f"Next review: {result.next_review_date}")
"""

import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.sm2 import calculate_next_review_date, calculate_sm2
from src.db.models import Card, CardStatus, Review
from src.repositories import CardStatisticsRepository, ReviewRepository, UserDeckProgressRepository
from src.schemas.sm2 import SM2BulkReviewResult, SM2ReviewResult

logger = logging.getLogger(__name__)


class SM2Service:
    """Service for SM-2 spaced repetition algorithm operations.

    This service orchestrates the full review flow:
    1. Get or create CardStatistics for user-card pair
    2. Calculate new SM-2 values using the pure algorithm
    3. Update CardStatistics with new values
    4. Create Review record for history
    5. Update UserDeckProgress metrics

    Attributes:
        db: Async database session
        stats_repo: Repository for CardStatistics operations
        review_repo: Repository for Review operations
        progress_repo: Repository for UserDeckProgress operations
    """

    def __init__(self, db: AsyncSession):
        """Initialize the SM-2 service.

        Args:
            db: Async database session for persistence operations
        """
        self.db = db
        self.stats_repo = CardStatisticsRepository(db)
        self.review_repo = ReviewRepository(db)
        self.progress_repo = UserDeckProgressRepository(db)

    async def process_review(
        self,
        user_id: UUID,
        card_id: UUID,
        quality: int,
        time_taken: int,
    ) -> SM2ReviewResult:
        """Process a single card review and update all related data.

        This method orchestrates the full review flow:
        1. Gets or creates CardStatistics for the user-card pair
        2. Calculates new SM-2 values using the pure algorithm
        3. Updates CardStatistics with the new values
        4. Creates a Review record for history
        5. Updates UserDeckProgress (cards_studied, cards_mastered)

        Args:
            user_id: UUID of the reviewing user
            card_id: UUID of the card being reviewed
            quality: Quality rating (0-5) from the review
            time_taken: Time spent on review in seconds

        Returns:
            SM2ReviewResult containing all updated values and next review date

        Raises:
            ValueError: If quality is not in range 0-5
            HTTPException: If card is not found (from repository)
        """
        if not 0 <= quality <= 5:
            raise ValueError(f"Quality must be 0-5, got {quality}")

        # Step 1: Get or create CardStatistics
        stats = await self.stats_repo.get_or_create(user_id, card_id)

        # Track previous state for progress updates
        previous_status = stats.status
        is_first_review = stats.status == CardStatus.NEW
        was_mastered = stats.status == CardStatus.MASTERED

        logger.debug(
            "Processing review",
            extra={
                "user_id": str(user_id),
                "card_id": str(card_id),
                "quality": quality,
                "previous_status": previous_status.value,
                "previous_ef": stats.easiness_factor,
                "previous_interval": stats.interval,
            },
        )

        # Step 2: Calculate new SM-2 values
        sm2_result = calculate_sm2(
            current_ef=stats.easiness_factor,
            current_interval=stats.interval,
            current_repetitions=stats.repetitions,
            quality=quality,
        )

        # Step 3: Calculate next review date
        next_review_date = calculate_next_review_date(sm2_result.new_interval)

        # Step 4: Update CardStatistics
        await self.stats_repo.update_sm2_data(
            stats_id=stats.id,
            easiness_factor=sm2_result.new_easiness_factor,
            interval=sm2_result.new_interval,
            repetitions=sm2_result.new_repetitions,
            next_review_date=next_review_date,
            status=sm2_result.new_status,
        )

        # Step 5: Create Review record
        review = Review(
            user_id=user_id,
            card_id=card_id,
            quality=quality,
            time_taken=time_taken,
            reviewed_at=datetime.utcnow(),
        )
        self.db.add(review)
        await self.db.flush()

        # Step 6: Update UserDeckProgress
        await self._update_deck_progress(
            user_id=user_id,
            card_id=card_id,
            is_first_review=is_first_review,
            was_mastered=was_mastered,
            is_now_mastered=sm2_result.new_status == CardStatus.MASTERED,
        )

        # Step 7: Commit transaction
        await self.db.commit()

        # Generate message for the result
        message = self._get_review_message(
            quality=quality,
            is_first_review=is_first_review,
            was_mastered=was_mastered,
            is_now_mastered=sm2_result.new_status == CardStatus.MASTERED,
        )

        logger.info(
            "Review processed successfully",
            extra={
                "user_id": str(user_id),
                "card_id": str(card_id),
                "quality": quality,
                "previous_status": previous_status.value,
                "new_status": sm2_result.new_status.value,
                "next_review_date": str(next_review_date),
                "new_ef": sm2_result.new_easiness_factor,
                "new_interval": sm2_result.new_interval,
            },
        )

        return SM2ReviewResult(
            success=True,
            card_id=card_id,
            quality=quality,
            previous_status=previous_status,
            new_status=sm2_result.new_status,
            easiness_factor=sm2_result.new_easiness_factor,
            interval=sm2_result.new_interval,
            repetitions=sm2_result.new_repetitions,
            next_review_date=next_review_date,
            message=message,
        )

    async def process_bulk_reviews(
        self,
        user_id: UUID,
        reviews: list[dict],
        session_id: str,
    ) -> SM2BulkReviewResult:
        """Process multiple reviews in a single transaction.

        Handles partial failures - if some reviews fail, the successful ones
        are still committed and the failed ones are tracked in the result.

        Each review dict should contain:
        - card_id: UUID of the card
        - quality: int (0-5)
        - time_taken: int (seconds)

        Args:
            user_id: UUID of the reviewing user
            reviews: List of review dictionaries with card_id, quality, time_taken
            session_id: Identifier for the study session

        Returns:
            SM2BulkReviewResult with summary and individual results
        """
        results: list[SM2ReviewResult] = []
        successful_count = 0
        failed_count = 0

        logger.info(
            "Starting bulk review processing",
            extra={
                "user_id": str(user_id),
                "session_id": session_id,
                "total_reviews": len(reviews),
            },
        )

        for review_data in reviews:
            result = await self._process_single_review_safe(
                user_id=user_id,
                card_id=review_data["card_id"],
                quality=review_data["quality"],
                time_taken=review_data.get("time_taken", 0),
            )
            results.append(result)

            if result.success:
                successful_count += 1
            else:
                failed_count += 1

        # Commit all successful reviews
        await self.db.commit()

        logger.info(
            "Bulk review processing completed",
            extra={
                "user_id": str(user_id),
                "session_id": session_id,
                "total": len(reviews),
                "successful": successful_count,
                "failed": failed_count,
            },
        )

        return SM2BulkReviewResult(
            session_id=session_id,
            total_submitted=len(reviews),
            successful=successful_count,
            failed=failed_count,
            results=results,
        )

    async def _process_single_review_safe(
        self,
        user_id: UUID,
        card_id: UUID,
        quality: int,
        time_taken: int,
    ) -> SM2ReviewResult:
        """Process a single review without committing, catching exceptions.

        Used by bulk processing to handle partial failures gracefully.

        Args:
            user_id: UUID of the reviewing user
            card_id: UUID of the card being reviewed
            quality: Quality rating (0-5)
            time_taken: Time spent in seconds

        Returns:
            SM2ReviewResult with success=False if an error occurred
        """
        try:
            # Validate quality
            if not 0 <= quality <= 5:
                raise ValueError(f"Quality must be 0-5, got {quality}")

            # Step 1: Get or create CardStatistics
            stats = await self.stats_repo.get_or_create(user_id, card_id)

            # Track previous state
            previous_status = stats.status
            is_first_review = stats.status == CardStatus.NEW
            was_mastered = stats.status == CardStatus.MASTERED

            # Step 2: Calculate SM-2 values
            sm2_result = calculate_sm2(
                current_ef=stats.easiness_factor,
                current_interval=stats.interval,
                current_repetitions=stats.repetitions,
                quality=quality,
            )

            # Step 3: Calculate next review date
            next_review_date = calculate_next_review_date(sm2_result.new_interval)

            # Step 4: Update CardStatistics (no commit)
            await self.stats_repo.update_sm2_data(
                stats_id=stats.id,
                easiness_factor=sm2_result.new_easiness_factor,
                interval=sm2_result.new_interval,
                repetitions=sm2_result.new_repetitions,
                next_review_date=next_review_date,
                status=sm2_result.new_status,
            )

            # Step 5: Create Review record (no commit)
            review = Review(
                user_id=user_id,
                card_id=card_id,
                quality=quality,
                time_taken=time_taken,
                reviewed_at=datetime.utcnow(),
            )
            self.db.add(review)
            await self.db.flush()

            # Step 6: Update deck progress (no commit)
            await self._update_deck_progress(
                user_id=user_id,
                card_id=card_id,
                is_first_review=is_first_review,
                was_mastered=was_mastered,
                is_now_mastered=sm2_result.new_status == CardStatus.MASTERED,
            )

            # Generate message
            message = self._get_review_message(
                quality=quality,
                is_first_review=is_first_review,
                was_mastered=was_mastered,
                is_now_mastered=sm2_result.new_status == CardStatus.MASTERED,
            )

            return SM2ReviewResult(
                success=True,
                card_id=card_id,
                quality=quality,
                previous_status=previous_status,
                new_status=sm2_result.new_status,
                easiness_factor=sm2_result.new_easiness_factor,
                interval=sm2_result.new_interval,
                repetitions=sm2_result.new_repetitions,
                next_review_date=next_review_date,
                message=message,
            )

        except Exception as e:
            logger.error(
                "Failed to process review",
                extra={
                    "user_id": str(user_id),
                    "card_id": str(card_id),
                    "quality": quality,
                    "error": str(e),
                },
                exc_info=True,
            )

            # Return a failed result with minimal data
            # We need to provide required fields even for failed reviews
            from datetime import date

            return SM2ReviewResult(
                success=False,
                card_id=card_id,
                quality=quality,
                previous_status=CardStatus.NEW,  # Default for error case
                new_status=CardStatus.NEW,  # Default for error case
                easiness_factor=2.5,  # Default
                interval=0,  # Default
                repetitions=0,  # Default
                next_review_date=date.today(),  # Default
                message=f"Error processing review: {str(e)}",
            )

    async def _update_deck_progress(
        self,
        user_id: UUID,
        card_id: UUID,
        is_first_review: bool,
        was_mastered: bool,
        is_now_mastered: bool,
    ) -> None:
        """Update UserDeckProgress metrics after a review.

        Updates:
        - cards_studied: +1 on first review (NEW -> anything)
        - cards_mastered: +1 when newly mastered, -1 when losing mastery

        Args:
            user_id: UUID of the user
            card_id: UUID of the reviewed card
            is_first_review: True if card was NEW before this review
            was_mastered: True if card was MASTERED before this review
            is_now_mastered: True if card is now MASTERED after this review
        """
        # Get deck_id from card
        query = select(Card.deck_id).where(Card.id == card_id)
        result = await self.db.execute(query)
        deck_id = result.scalar_one_or_none()

        if deck_id is None:
            logger.warning(
                "Could not find deck for card",
                extra={"card_id": str(card_id)},
            )
            return

        # Get or create progress record
        progress = await self.progress_repo.get_or_create(user_id, deck_id)

        # Calculate deltas
        cards_studied_delta = 1 if is_first_review else 0
        cards_mastered_delta = 0

        if is_now_mastered and not was_mastered:
            # Card newly mastered
            cards_mastered_delta = 1
        elif was_mastered and not is_now_mastered:
            # Card lost mastery (failed review)
            cards_mastered_delta = -1

        # Update progress metrics
        if cards_studied_delta != 0 or cards_mastered_delta != 0:
            await self.progress_repo.update_progress_metrics(
                progress_id=progress.id,
                cards_studied_delta=cards_studied_delta,
                cards_mastered_delta=cards_mastered_delta,
            )

            logger.debug(
                "Updated deck progress",
                extra={
                    "user_id": str(user_id),
                    "deck_id": str(deck_id),
                    "cards_studied_delta": cards_studied_delta,
                    "cards_mastered_delta": cards_mastered_delta,
                },
            )

    def _get_review_message(
        self,
        quality: int,
        is_first_review: bool,
        was_mastered: bool,
        is_now_mastered: bool,
    ) -> Optional[str]:
        """Generate a feedback message for the review result.

        Args:
            quality: Quality rating (0-5)
            is_first_review: True if this was the first review
            was_mastered: True if card was mastered before
            is_now_mastered: True if card is now mastered

        Returns:
            Feedback message or None if no special message
        """
        # Mastery transitions take priority
        if is_now_mastered and not was_mastered:
            return "Congratulations! Card mastered!"

        if was_mastered and not is_now_mastered:
            return "Card needs more practice."

        # Quality-based messages
        if quality == 5:
            return "Perfect!"

        if is_first_review and quality >= 3:
            return "Good start!"

        return None


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["SM2Service"]
