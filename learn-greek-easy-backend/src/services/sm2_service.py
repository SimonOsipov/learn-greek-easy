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
from typing import TYPE_CHECKING, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import DeckNotFoundException
from src.core.posthog import capture_event
from src.core.sm2 import calculate_next_review_date, calculate_sm2
from src.db.models import Card, CardStatus, Review

if TYPE_CHECKING:
    from src.db.models import CardStatistics
from src.repositories import (
    CardRepository,
    CardStatisticsRepository,
    ReviewRepository,
    UserDeckProgressRepository,
)
from src.repositories.deck import DeckRepository
from src.schemas.sm2 import (
    CardInitializationRequest,
    CardInitializationResult,
    SM2BulkReviewResult,
    SM2ReviewResult,
    StudyQueue,
    StudyQueueCard,
    StudyQueueRequest,
)

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
        deck_repo: Repository for Deck operations
        card_repo: Repository for Card operations
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
        self.deck_repo = DeckRepository(db)
        self.card_repo = CardRepository(db)

    async def process_review(
        self,
        user_id: UUID,
        card_id: UUID,
        quality: int,
        time_taken: int,
        user_email: Optional[str] = None,
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
            user_email: User's email for PostHog tracking (optional)

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
            user_email=user_email,
            stats=stats,
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

    # =========================================================================
    # Study Queue Methods
    # =========================================================================

    async def get_study_queue(
        self,
        user_id: UUID,
        request: StudyQueueRequest,
    ) -> StudyQueue:
        """Get study queue with due cards and optional new cards.

        The queue prioritizes:
        1. Overdue cards (past next_review_date) - ordered oldest first
        2. Cards due today - ordered by next_review_date
        3. New cards (if include_new=True)

        Args:
            user_id: User requesting study queue
            request: Queue parameters (deck_id, limits, etc.)

        Returns:
            StudyQueue with cards to study

        Raises:
            DeckNotFoundException: If deck_id specified but not found or inactive
        """
        deck_name = "All Decks"

        # Validate deck if specified
        if request.deck_id:
            deck = await self.deck_repo.get(request.deck_id)
            if not deck or not deck.is_active:
                raise DeckNotFoundException(deck_id=str(request.deck_id))
            deck_name = deck.name

        logger.debug(
            "Building study queue",
            extra={
                "user_id": str(user_id),
                "deck_id": str(request.deck_id) if request.deck_id else "all",
                "limit": request.limit,
                "include_new": request.include_new,
                "include_early_practice": request.include_early_practice,
            },
        )

        # Get due cards (already ordered by next_review_date - oldest first)
        due_cards = await self.stats_repo.get_due_cards(
            user_id=user_id,
            deck_id=request.deck_id,
            limit=request.limit,
        )

        logger.debug(
            "Found due cards",
            extra={
                "user_id": str(user_id),
                "due_count": len(due_cards),
            },
        )

        # Get new cards if requested and there's room
        new_cards: list[Card] = []
        if request.include_new and len(due_cards) < request.limit:
            remaining_slots = min(
                request.new_cards_limit,
                request.limit - len(due_cards),
            )
            if remaining_slots > 0:
                new_cards = await self._get_new_cards(
                    user_id=user_id,
                    deck_id=request.deck_id,
                    limit=remaining_slots,
                )

                logger.debug(
                    "Added new cards to queue",
                    extra={
                        "user_id": str(user_id),
                        "new_count": len(new_cards),
                    },
                )

        # Get early practice cards if requested
        early_practice_cards: list["CardStatistics"] = []
        if request.include_early_practice:
            current_count = len(due_cards) + len(new_cards)
            remaining_slots = request.limit - current_count
            if remaining_slots > 0:
                ep_limit = min(request.early_practice_limit, remaining_slots)
                early_practice_cards = await self.stats_repo.get_early_practice_cards(
                    user_id=user_id,
                    deck_id=request.deck_id,
                    limit=ep_limit,
                )

                logger.debug(
                    "Added early practice cards to queue",
                    extra={
                        "user_id": str(user_id),
                        "early_practice_count": len(early_practice_cards),
                    },
                )

        # Build queue cards list
        queue_cards: list[StudyQueueCard] = []

        # Add due cards first (have statistics) - AC #1
        for stats in due_cards:
            card = stats.card  # Eager loaded
            queue_cards.append(
                StudyQueueCard(
                    card_id=card.id,
                    front_text=card.front_text,
                    back_text=card.back_text,
                    example_sentence=card.example_sentence,
                    pronunciation=card.pronunciation,
                    difficulty=card.difficulty,
                    status=stats.status,
                    is_new=False,
                    is_early_practice=False,
                    due_date=stats.next_review_date,
                    easiness_factor=stats.easiness_factor,
                    interval=stats.interval,
                )
            )

        # Add new cards (no statistics yet) - AC #1
        for card in new_cards:
            queue_cards.append(
                StudyQueueCard(
                    card_id=card.id,
                    front_text=card.front_text,
                    back_text=card.back_text,
                    example_sentence=card.example_sentence,
                    pronunciation=card.pronunciation,
                    difficulty=card.difficulty,
                    status=CardStatus.NEW,
                    is_new=True,
                    is_early_practice=False,
                    due_date=None,
                    easiness_factor=None,
                    interval=None,
                )
            )

        # Add early practice cards (not due yet, but requested for practice)
        for stats in early_practice_cards:
            card = stats.card  # Eager loaded
            queue_cards.append(
                StudyQueueCard(
                    card_id=card.id,
                    front_text=card.front_text,
                    back_text=card.back_text,
                    example_sentence=card.example_sentence,
                    pronunciation=card.pronunciation,
                    difficulty=card.difficulty,
                    status=stats.status,
                    is_new=False,
                    is_early_practice=True,
                    due_date=stats.next_review_date,
                    easiness_factor=stats.easiness_factor,
                    interval=stats.interval,
                )
            )

        logger.info(
            "Study queue built successfully",
            extra={
                "user_id": str(user_id),
                "deck_id": str(request.deck_id) if request.deck_id else "all",
                "total_due": len(due_cards),
                "total_new": len(new_cards),
                "total_early_practice": len(early_practice_cards),
                "total_in_queue": len(queue_cards),
            },
        )

        # Use a zero UUID as placeholder for "all decks" if no deck_id specified
        # This matches the schema expectation for deck_id being required
        return StudyQueue(
            deck_id=request.deck_id or UUID(int=0),
            deck_name=deck_name,
            total_due=len(due_cards),
            total_new=len(new_cards),
            total_early_practice=len(early_practice_cards),
            total_in_queue=len(queue_cards),
            cards=queue_cards,
        )

    async def _get_new_cards(
        self,
        user_id: UUID,
        deck_id: UUID | None,
        limit: int,
    ) -> list[Card]:
        """Get cards the user hasn't studied yet.

        Finds cards that don't have CardStatistics records for this user.
        Cards are returned ordered by order_index, then created_at.

        Args:
            user_id: User ID
            deck_id: Optional deck filter
            limit: Maximum cards to return

        Returns:
            List of Card objects not yet studied by user
        """
        return await self.stats_repo.get_new_cards_for_deck(
            user_id=user_id,
            deck_id=deck_id,
            limit=limit,
        )

    async def get_study_stats(
        self,
        user_id: UUID,
        deck_id: UUID | None = None,
    ) -> dict:
        """Get study statistics for a user.

        Returns counts by status, reviews today, streak, and due count.

        Args:
            user_id: User ID
            deck_id: Optional deck filter

        Returns:
            Dict with counts by status, due today, streak, etc.
            {
                "by_status": {"new": int, "learning": int, "review": int, "mastered": int, "due": int},
                "reviews_today": int,
                "current_streak": int,
                "due_today": int,
            }
        """
        logger.debug(
            "Getting study stats",
            extra={
                "user_id": str(user_id),
                "deck_id": str(deck_id) if deck_id else "all",
            },
        )

        # Count by status (includes "due" count)
        status_counts = await self.stats_repo.count_by_status(
            user_id=user_id,
            deck_id=deck_id,
        )

        # Get reviews today
        reviews_today = await self.review_repo.count_reviews_today(user_id)

        # Get streak
        streak = await self.review_repo.get_streak(user_id)

        return {
            "by_status": status_counts,
            "reviews_today": reviews_today,
            "current_streak": streak,
            "due_today": status_counts.get("due", 0),
        }

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
        user_email: Optional[str] = None,
        stats: Optional["CardStatistics"] = None,
    ) -> None:
        """Update UserDeckProgress metrics after a review.

        Updates:
        - cards_studied: +1 on first review (NEW -> anything)
        - cards_mastered: +1 when newly mastered, -1 when losing mastery

        Also tracks card_mastered event to PostHog when a card is newly mastered.

        Args:
            user_id: UUID of the user
            card_id: UUID of the reviewed card
            is_first_review: True if card was NEW before this review
            was_mastered: True if card was MASTERED before this review
            is_now_mastered: True if card is now MASTERED after this review
            user_email: User's email for PostHog tracking (optional)
            stats: CardStatistics for tracking metrics (optional)
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

            # Track card mastery event to PostHog
            if stats is not None:
                days_to_master = 0
                if stats.created_at:
                    # Handle timezone-aware datetime
                    created_at = stats.created_at
                    if created_at.tzinfo is not None:
                        created_at = created_at.replace(tzinfo=None)
                    days_to_master = (datetime.utcnow() - created_at).days

                capture_event(
                    distinct_id=str(user_id),
                    event="card_mastered",
                    properties={
                        "deck_id": str(deck_id),
                        "card_id": str(card_id),
                        "reviews_to_master": stats.repetitions,
                        "days_to_master": days_to_master,
                    },
                    user_email=user_email,
                )

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

    # =========================================================================
    # Card Initialization Methods
    # =========================================================================

    async def initialize_cards_for_user(
        self,
        user_id: UUID,
        request: CardInitializationRequest,
    ) -> CardInitializationResult:
        """Initialize CardStatistics for specified cards.

        Creates CardStatistics records for cards the user hasn't studied.
        This is called when:
        1. User starts a new deck
        2. New cards are added to a deck they're studying
        3. Frontend explicitly requests initialization

        Args:
            user_id: User ID
            request: Contains deck_id and list of card_ids

        Returns:
            CardInitializationResult with counts and IDs

        Raises:
            DeckNotFoundException: If deck doesn't exist
        """
        # Step 1: Validate deck exists
        deck = await self.deck_repo.get(request.deck_id)
        if not deck:
            raise DeckNotFoundException(deck_id=str(request.deck_id))

        # Step 2: Validate cards belong to deck
        valid_card_ids = await self._validate_cards_in_deck(
            card_ids=request.card_ids,
            deck_id=request.deck_id,
        )

        # Step 3: Bulk create statistics (efficient - skips existing)
        new_stats = await self.stats_repo.bulk_create_statistics(
            user_id=user_id,
            card_ids=valid_card_ids,
        )

        # Step 4: Calculate already_exists_count
        initialized_ids = [s.card_id for s in new_stats]
        already_exists_count = len(valid_card_ids) - len(initialized_ids)

        # Step 5: Ensure deck progress record exists
        await self.progress_repo.get_or_create(user_id, request.deck_id)

        logger.info(
            "Cards initialized for user",
            extra={
                "user_id": str(user_id),
                "deck_id": str(request.deck_id),
                "initialized": len(initialized_ids),
                "already_existed": already_exists_count,
            },
        )

        return CardInitializationResult(
            initialized_count=len(initialized_ids),
            already_exists_count=already_exists_count,
            card_ids=initialized_ids,
        )

    async def initialize_deck_for_user(
        self,
        user_id: UUID,
        deck_id: UUID,
    ) -> CardInitializationResult:
        """Initialize all cards in a deck for a user.

        Convenience method to start studying an entire deck.

        Args:
            user_id: User ID
            deck_id: Deck to initialize

        Returns:
            CardInitializationResult
        """
        # Get all card IDs in the deck
        cards = await self.card_repo.get_by_deck(deck_id, skip=0, limit=1000)
        card_ids = [card.id for card in cards]

        # Handle empty deck
        if not card_ids:
            return CardInitializationResult(
                initialized_count=0,
                already_exists_count=0,
                card_ids=[],
            )

        # Delegate to main method
        return await self.initialize_cards_for_user(
            user_id=user_id,
            request=CardInitializationRequest(
                deck_id=deck_id,
                card_ids=card_ids,
            ),
        )

    async def _validate_cards_in_deck(
        self,
        card_ids: list[UUID],
        deck_id: UUID,
    ) -> list[UUID]:
        """Validate that cards belong to the specified deck.

        Args:
            card_ids: Card IDs to validate
            deck_id: Expected deck ID

        Returns:
            List of valid card IDs (belong to deck)
        """
        valid_ids = []
        for card_id in card_ids:
            card = await self.card_repo.get(card_id)
            if card and card.deck_id == deck_id:
                valid_ids.append(card_id)
        return valid_ids


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["SM2Service"]
