"""Review API endpoints.

This module provides HTTP endpoints for flashcard review operations,
allowing users to submit card reviews and receive SM-2 algorithm results.
"""

from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.dependencies import get_current_user
from src.core.exceptions import CardNotFoundException, DeckNotFoundException
from src.core.logging import get_logger
from src.core.posthog import capture_event
from src.core.redis import get_redis
from src.core.subscription import check_premium_deck_access
from src.db.dependencies import get_db
from src.db.models import User, UserSettings
from src.repositories.card import CardRepository
from src.repositories.deck import DeckRepository
from src.repositories.review import ReviewRepository
from src.schemas.review import (
    BulkReviewSubmit,
    ReviewHistoryListResponse,
    ReviewHistoryResponse,
    ReviewSubmit,
)
from src.schemas.sm2 import SM2BulkReviewResult, SM2ReviewResult
from src.services.sm2_service import SM2Service
from src.tasks.background import check_achievements_task, invalidate_cache_task, log_analytics_task

logger = get_logger(__name__)

# Streak milestones to track
STREAK_MILESTONES = [3, 7, 14, 30, 60, 90, 180, 365]


def _check_streak_milestone(
    user_id: UUID,
    user_email: str,
    new_streak: int,
    previous_streak: int,
) -> None:
    """Check if user crossed a streak milestone and track if so.

    This function fires a streak_achieved event when the user crosses
    one of the predefined milestones (3, 7, 14, 30, 60, 90, 180, 365 days).
    Only the highest milestone crossed in a single review is tracked.

    Args:
        user_id: UUID of the user
        user_email: User's email for PostHog tracking
        new_streak: Current streak after review
        previous_streak: Streak before the review
    """
    for milestone in STREAK_MILESTONES:
        if new_streak >= milestone and previous_streak < milestone:
            capture_event(
                distinct_id=str(user_id),
                event="streak_achieved",
                properties={
                    "streak_days": new_streak,
                    "milestone": milestone,
                },
                user_email=user_email,
            )
            break  # Only track highest milestone crossed


async def _check_daily_goal_notification(
    db: AsyncSession,
    user_id: UUID,
    reviews_before: int,
) -> None:
    """Check if daily goal was just completed and create notification.

    Uses Redis to prevent duplicate notifications on same day.
    Only triggers when user crosses the threshold (not on subsequent reviews).

    Args:
        db: Database session for notification creation
        user_id: User's UUID
        reviews_before: Number of reviews BEFORE the current review was processed
    """
    try:
        # Get user's daily goal setting
        result = await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
        user_settings = result.scalar_one_or_none()
        daily_goal = user_settings.daily_goal if user_settings else 20  # Default

        # Check if we just crossed the threshold
        # reviews_before < daily_goal AND reviews_after >= daily_goal
        reviews_after = reviews_before + 1

        if reviews_before >= daily_goal:
            # Already completed goal before this review
            return

        if reviews_after < daily_goal:
            # Still haven't reached goal
            return

        # We just crossed the threshold! Check Redis for duplicate prevention
        redis = get_redis()
        if redis:
            cache_key = f"daily_goal_notified:{user_id}:{date.today().isoformat()}"

            # Use SETNX (set if not exists) for atomic check-and-set
            was_set = await redis.setnx(cache_key, "1")
            if not was_set:
                # Already notified today
                return

            # Set expiry (24 hours to be safe, will auto-cleanup)
            await redis.expire(cache_key, 86400)

        # Create notification (late import to avoid circular deps)
        from src.services.notification_service import NotificationService

        notification_service = NotificationService(db)
        await notification_service.notify_daily_goal_complete(
            user_id=user_id,
            reviews_completed=reviews_after,
        )

        logger.info(
            "Daily goal notification created",
            extra={"user_id": str(user_id), "reviews": reviews_after},
        )

    except Exception as e:
        logger.warning(
            "Failed to check/create daily goal notification",
            extra={"user_id": str(user_id), "error": str(e)},
        )
        # Don't fail the review if notification fails


router = APIRouter(
    # Note: prefix is set by parent router in v1/router.py
    # This router is mounted at /reviews under the /api/v1 prefix
    tags=["Reviews"],
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Premium subscription required"},
        422: {"description": "Validation error"},
    },
)


@router.get(
    "",
    response_model=ReviewHistoryListResponse,
    summary="Get review history",
    description="Retrieve paginated review history for the current user with optional date filtering.",
    responses={
        200: {
            "description": "Review history retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "total": 150,
                        "page": 1,
                        "page_size": 50,
                        "reviews": [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440000",
                                "user_id": "660e8400-e29b-41d4-a716-446655440001",
                                "card_id": "770e8400-e29b-41d4-a716-446655440002",
                                "quality": 4,
                                "time_taken": 15,
                                "reviewed_at": "2024-01-15T10:30:00Z",
                            }
                        ],
                    }
                }
            },
        },
        401: {"description": "Not authenticated - missing or invalid token"},
        422: {"description": "Validation error - invalid date format or pagination parameters"},
    },
)
async def get_review_history(
    start_date: Optional[date] = Query(
        default=None,
        description="Filter reviews from this date (inclusive, ISO format: YYYY-MM-DD)",
    ),
    end_date: Optional[date] = Query(
        default=None,
        description="Filter reviews until this date (inclusive, ISO format: YYYY-MM-DD)",
    ),
    page: int = Query(
        default=1,
        ge=1,
        description="Page number (starting from 1)",
    ),
    page_size: int = Query(
        default=50,
        ge=1,
        le=100,
        description="Items per page (max 100)",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReviewHistoryListResponse:
    """Get paginated review history for the current user.

    This endpoint retrieves the user's review history with optional date
    filtering and pagination support. Reviews are returned in reverse
    chronological order (most recent first).

    Date Filtering:
    - Use start_date to filter reviews from a specific date
    - Use end_date to filter reviews until a specific date
    - Both filters are inclusive
    - Dates should be in ISO format (YYYY-MM-DD)

    Args:
        start_date: Optional start date filter (inclusive)
        end_date: Optional end date filter (inclusive)
        page: Page number starting from 1
        page_size: Number of items per page (1-100)
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        ReviewHistoryListResponse with total count and paginated review list

    Example:
        GET /api/v1/reviews?start_date=2024-01-01&end_date=2024-01-31&page=1&page_size=50
    """
    repo = ReviewRepository(db)

    # Calculate offset from page number
    skip = (page - 1) * page_size

    # Get reviews and total count with same filters
    reviews = await repo.get_user_reviews(
        user_id=current_user.id,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=page_size,
    )

    total = await repo.count_user_reviews(
        user_id=current_user.id,
        start_date=start_date,
        end_date=end_date,
    )

    return ReviewHistoryListResponse(
        total=total,
        page=page,
        page_size=page_size,
        reviews=[ReviewHistoryResponse.model_validate(r) for r in reviews],
    )


@router.post(
    "",
    response_model=SM2ReviewResult,
    summary="Submit a card review",
    description="Submit a single card review with quality rating and time taken. Returns updated SM-2 scheduling data.",
    responses={
        200: {
            "description": "Review processed successfully",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "card_id": "660e8400-e29b-41d4-a716-446655440001",
                        "quality": 4,
                        "previous_status": "new",
                        "new_status": "learning",
                        "easiness_factor": 2.5,
                        "interval": 1,
                        "repetitions": 1,
                        "next_review_date": "2024-01-16",
                        "message": "Good start!",
                    }
                }
            },
        },
        401: {"description": "Not authenticated - missing or invalid token"},
        404: {"description": "Card not found"},
        422: {"description": "Validation error - invalid quality (0-5) or time_taken (0-300)"},
    },
)
async def submit_review(
    review: ReviewSubmit,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SM2ReviewResult:
    """Submit a single card review.

    This endpoint processes a flashcard review using the SM-2 spaced repetition
    algorithm. It updates the card's scheduling data and returns the new state.

    The quality rating determines how well the user recalled the card:
    - 0: Complete blackout, no recognition
    - 1: Incorrect, but upon seeing answer, remembered
    - 2: Incorrect, but answer seemed easy to recall
    - 3: Correct with serious difficulty
    - 4: Correct with some hesitation
    - 5: Perfect response, no hesitation

    Args:
        review: Review submission data containing card_id, quality (0-5), and time_taken (0-300 seconds)
        background_tasks: FastAPI BackgroundTasks for scheduling async operations
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        SM2ReviewResult: Updated scheduling data including next review date,
            easiness factor, interval, repetitions, and status change message

    Raises:
        UnauthorizedException (401): If not authenticated
        CardNotFoundException (404): If card doesn't exist
        ValidationError (422): If request body validation fails
    """
    # Verify card exists before processing
    card_repo = CardRepository(db)
    card = await card_repo.get(review.card_id)
    if card is None:
        raise CardNotFoundException(card_id=str(review.card_id))

    # Enforce premium deck access
    check_premium_deck_access(current_user, card.deck)

    # Get streak BEFORE processing review (for milestone tracking)
    review_repo = ReviewRepository(db)
    previous_streak = await review_repo.get_streak(current_user.id)

    # Get reviews count BEFORE processing (for daily goal detection)
    reviews_before = await review_repo.count_reviews_today(current_user.id)

    # Process the review using SM2Service
    service = SM2Service(db)
    result = await service.process_review(
        user_id=current_user.id,
        card_id=review.card_id,
        quality=review.quality,
        time_taken=review.time_taken,
        user_email=current_user.email,
    )

    # Get streak AFTER processing review
    new_streak = await review_repo.get_streak(current_user.id)

    # Check for streak milestone achievement
    if new_streak > previous_streak:
        _check_streak_milestone(
            user_id=current_user.id,
            user_email=current_user.email,
            new_streak=new_streak,
            previous_streak=previous_streak,
        )

    # Check for daily goal completion notification
    await _check_daily_goal_notification(
        db=db,
        user_id=current_user.id,
        reviews_before=reviews_before,
    )

    # Schedule background tasks if enabled
    if settings.feature_background_tasks:
        # Check for new achievements
        background_tasks.add_task(
            check_achievements_task,
            user_id=current_user.id,
            db_url=settings.database_url,
        )

        # Invalidate progress cache
        background_tasks.add_task(
            invalidate_cache_task,
            cache_type="progress",
            entity_id=review.card_id,
            user_id=current_user.id,
        )

        # Log analytics event
        background_tasks.add_task(
            log_analytics_task,
            event_type="review_completed",
            user_id=current_user.id,
            data={
                "card_id": str(review.card_id),
                "quality": review.quality,
                "time_taken": review.time_taken,
                "new_status": result.new_status.value,
            },
        )

    return result


@router.post(
    "/bulk",
    response_model=SM2BulkReviewResult,
    summary="Submit multiple card reviews",
    description="Submit multiple card reviews in a single request. Handles partial failures gracefully - individual card failures don't affect other reviews in the batch.",
    responses={
        200: {
            "description": "Bulk review processed (may include partial failures)",
            "content": {
                "application/json": {
                    "example": {
                        "session_id": "study-session-123",
                        "total_submitted": 10,
                        "successful": 9,
                        "failed": 1,
                        "results": [
                            {
                                "success": True,
                                "card_id": "660e8400-e29b-41d4-a716-446655440001",
                                "quality": 4,
                                "previous_status": "new",
                                "new_status": "learning",
                                "easiness_factor": 2.5,
                                "interval": 1,
                                "repetitions": 1,
                                "next_review_date": "2024-01-16",
                                "message": "Good start!",
                            }
                        ],
                    }
                }
            },
        },
        401: {"description": "Not authenticated - missing or invalid token"},
        422: {
            "description": "Validation error - invalid request body, max 100 reviews exceeded, or invalid quality/time_taken values"
        },
    },
)
async def submit_bulk_reviews(
    request: BulkReviewSubmit,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SM2BulkReviewResult:
    """Submit multiple card reviews in bulk.

    This endpoint processes multiple flashcard reviews in a single request using
    the SM-2 spaced repetition algorithm. It handles partial failures gracefully -
    if some reviews fail (e.g., card not found), the successful ones are still
    processed and committed.

    The request must include:
    - deck_id: UUID of the deck containing the cards
    - session_id: Client-provided identifier for the study session
    - reviews: Array of 1-100 review objects, each with card_id, quality, and time_taken

    Quality rating scale (same as single review):
    - 0: Complete blackout, no recognition
    - 1: Incorrect, but upon seeing answer, remembered
    - 2: Incorrect, but answer seemed easy to recall
    - 3: Correct with serious difficulty
    - 4: Correct with some hesitation
    - 5: Perfect response, no hesitation

    Args:
        request: Bulk review submission containing deck_id, session_id, and reviews array
        background_tasks: FastAPI BackgroundTasks for scheduling async operations
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        SM2BulkReviewResult: Summary with total_submitted, successful, failed counts
            and individual SM2ReviewResult for each card

    Raises:
        UnauthorizedException (401): If not authenticated
        ValidationError (422): If request body validation fails (e.g., >100 reviews)
    """
    # Enforce premium deck access
    deck_repo = DeckRepository(db)
    deck = await deck_repo.get(request.deck_id)
    if not deck or not deck.is_active:
        raise DeckNotFoundException(deck_id=str(request.deck_id))
    check_premium_deck_access(current_user, deck)

    service = SM2Service(db)

    # Convert Pydantic models to dictionaries for the service
    reviews_data = [
        {
            "card_id": review.card_id,
            "quality": review.quality,
            "time_taken": review.time_taken,
        }
        for review in request.reviews
    ]

    result = await service.process_bulk_reviews(
        user_id=current_user.id,
        reviews=reviews_data,
        session_id=request.session_id,
    )

    # Schedule background tasks if enabled
    if settings.feature_background_tasks:
        # Check achievements after bulk reviews
        background_tasks.add_task(
            check_achievements_task,
            user_id=current_user.id,
            db_url=settings.database_url,
        )

        # Log bulk review analytics
        background_tasks.add_task(
            log_analytics_task,
            event_type="bulk_review_completed",
            user_id=current_user.id,
            data={
                "session_id": request.session_id,
                "deck_id": str(request.deck_id),
                "total_reviews": result.total_submitted,
                "successful": result.successful,
                "failed": result.failed,
            },
        )

    return result
