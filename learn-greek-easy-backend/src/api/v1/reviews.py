"""Review API endpoints.

This module provides HTTP endpoints for flashcard review operations,
allowing users to submit card reviews and receive SM-2 algorithm results.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user
from src.core.exceptions import CardNotFoundException
from src.db.dependencies import get_db
from src.db.models import User
from src.repositories.card import CardRepository
from src.schemas.review import ReviewSubmit
from src.schemas.sm2 import SM2ReviewResult
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
