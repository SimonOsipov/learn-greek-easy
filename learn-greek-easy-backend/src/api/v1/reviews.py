"""Review API endpoints.

This module provides HTTP endpoints for flashcard review operations,
allowing users to submit card reviews and receive SM-2 algorithm results.
"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user
from src.core.exceptions import CardNotFoundException
from src.db.dependencies import get_db
from src.db.models import User
from src.repositories.card import CardRepository
from src.repositories.review import ReviewRepository
from src.schemas.review import (
    BulkReviewSubmit,
    ReviewHistoryListResponse,
    ReviewHistoryResponse,
    ReviewSubmit,
)
from src.schemas.sm2 import SM2BulkReviewResult, SM2ReviewResult
from src.services.sm2_service import SM2Service

router = APIRouter(
    # Note: prefix is set by parent router in v1/router.py
    # This router is mounted at /reviews under the /api/v1 prefix
    tags=["Reviews"],
    responses={
        401: {"description": "Not authenticated"},
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

    # Process the review using SM2Service
    service = SM2Service(db)
    return await service.process_review(
        user_id=current_user.id,
        card_id=review.card_id,
        quality=review.quality,
        time_taken=review.time_taken,
    )


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
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        SM2BulkReviewResult: Summary with total_submitted, successful, failed counts
            and individual SM2ReviewResult for each card

    Raises:
        UnauthorizedException (401): If not authenticated
        ValidationError (422): If request body validation fails (e.g., >100 reviews)
    """
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

    return await service.process_bulk_reviews(
        user_id=current_user.id,
        reviews=reviews_data,
        session_id=request.session_id,
    )
