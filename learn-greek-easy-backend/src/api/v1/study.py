"""Study API endpoints for queue and statistics.

This module provides HTTP endpoints for study session operations,
allowing users to retrieve study queues with cards due for review
and new cards to learn using the SM-2 spaced repetition algorithm.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user
from src.core.exceptions import DeckNotFoundException
from src.core.subscription import check_premium_deck_access, get_effective_access_level
from src.db.dependencies import get_db
from src.db.models import SubscriptionTier, User
from src.repositories.deck import DeckRepository
from src.repositories.review import ReviewRepository
from src.schemas.sm2 import (
    CardInitializationRequest,
    CardInitializationResult,
    StudyQueue,
    StudyQueueRequest,
    StudyStatsResponse,
)
from src.services.sm2_service import SM2Service

router = APIRouter(
    # Note: prefix is set by parent router in v1/router.py
    # This router is mounted at /study under the /api/v1 prefix
    tags=["Study"],
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Premium subscription required"},
        404: {"description": "Deck not found"},
        422: {"description": "Validation error"},
    },
)


@router.get(
    "/queue",
    response_model=StudyQueue,
    summary="Get study queue across all decks",
    description="Retrieve cards due for review and new cards to learn from all active decks.",
    responses={
        200: {
            "description": "Study queue retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "deck_id": "00000000-0000-0000-0000-000000000000",
                        "deck_name": "All Decks",
                        "total_due": 5,
                        "total_new": 3,
                        "total_in_queue": 8,
                        "cards": [
                            {
                                "card_id": "550e8400-e29b-41d4-a716-446655440000",
                                "front_text": "kalimera",
                                "back_text": "good morning",
                                "example_sentence": "Kalimera, ti kaneis?",
                                "pronunciation": "kah-lee-MEH-rah",
                                "difficulty": "beginner",
                                "status": "review",
                                "is_new": False,
                                "due_date": "2024-01-15",
                                "easiness_factor": 2.5,
                                "interval": 6,
                            }
                        ],
                    }
                }
            },
        },
        401: {"description": "Not authenticated - missing or invalid token"},
        422: {"description": "Validation error - invalid query parameters"},
    },
)
async def get_study_queue(
    limit: int = Query(
        default=20,
        ge=1,
        le=100,
        description="Maximum number of cards to return in the queue",
    ),
    include_new: bool = Query(
        default=True,
        description="Include new (unstudied) cards in the queue",
    ),
    new_cards_limit: int = Query(
        default=10,
        ge=0,
        le=50,
        description="Maximum number of new cards to include",
    ),
    include_early_practice: bool = Query(
        default=False,
        description="Include cards not yet due as 'early practice' for extra study",
    ),
    early_practice_limit: int = Query(
        default=10,
        ge=0,
        le=50,
        description="Maximum number of early practice cards to include",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StudyQueue:
    """Get study queue with cards from all decks.

    This endpoint retrieves a prioritized queue of cards for study:
    1. Due cards (past their next_review_date) - ordered oldest first
    2. Cards due today - ordered by next_review_date
    3. New cards (if include_new=True) - up to new_cards_limit
    4. Early practice cards (if include_early_practice=True) - up to early_practice_limit

    The queue respects the total limit parameter, filling with due cards
    first before adding new cards.

    Args:
        limit: Maximum cards to return (1-100, default 20)
        include_new: Whether to include unstudied cards (default True)
        new_cards_limit: Maximum new cards to include (0-50, default 10)
        include_early_practice: Whether to include cards not yet due (default False)
        early_practice_limit: Maximum early practice cards to include (0-50, default 10)
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        StudyQueue with deck info, counts, and list of cards to study

    Example:
        GET /api/v1/study/queue?limit=10&include_new=true&new_cards_limit=5&include_early_practice=true
    """
    effective = get_effective_access_level(current_user)
    exclude_premium = effective == SubscriptionTier.FREE
    service = SM2Service(db)
    request = StudyQueueRequest(
        deck_id=None,  # None indicates all decks
        limit=limit,
        include_new=include_new,
        new_cards_limit=new_cards_limit,
        include_early_practice=include_early_practice,
        early_practice_limit=early_practice_limit,
        exclude_premium_decks=exclude_premium,
    )
    return await service.get_study_queue(current_user.id, request)


@router.get(
    "/queue/{deck_id}",
    response_model=StudyQueue,
    summary="Get study queue for a specific deck",
    description="Retrieve cards due for review and new cards to learn from a specific deck.",
    responses={
        200: {
            "description": "Study queue retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "deck_id": "660e8400-e29b-41d4-a716-446655440001",
                        "deck_name": "Greek Basics A1",
                        "total_due": 3,
                        "total_new": 2,
                        "total_in_queue": 5,
                        "cards": [
                            {
                                "card_id": "550e8400-e29b-41d4-a716-446655440000",
                                "front_text": "efcharisto",
                                "back_text": "thank you",
                                "example_sentence": "Efcharisto poli!",
                                "pronunciation": "ef-hah-ree-STOH",
                                "difficulty": "beginner",
                                "status": "learning",
                                "is_new": False,
                                "due_date": "2024-01-15",
                                "easiness_factor": 2.36,
                                "interval": 3,
                            }
                        ],
                    }
                }
            },
        },
        401: {"description": "Not authenticated - missing or invalid token"},
        404: {"description": "Deck not found or inactive"},
        422: {"description": "Validation error - invalid deck_id or query parameters"},
    },
)
async def get_deck_study_queue(
    deck_id: UUID,
    limit: int = Query(
        default=20,
        ge=1,
        le=100,
        description="Maximum number of cards to return in the queue",
    ),
    include_new: bool = Query(
        default=True,
        description="Include new (unstudied) cards in the queue",
    ),
    new_cards_limit: int = Query(
        default=10,
        ge=0,
        le=50,
        description="Maximum number of new cards to include",
    ),
    include_early_practice: bool = Query(
        default=False,
        description="Include cards not yet due as 'early practice' for extra study",
    ),
    early_practice_limit: int = Query(
        default=10,
        ge=0,
        le=50,
        description="Maximum number of early practice cards to include",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StudyQueue:
    """Get study queue with cards from a specific deck.

    This endpoint retrieves a prioritized queue of cards for study
    from a specific deck:
    1. Due cards (past their next_review_date) - ordered oldest first
    2. Cards due today - ordered by next_review_date
    3. New cards (if include_new=True) - up to new_cards_limit
    4. Early practice cards (if include_early_practice=True) - up to early_practice_limit

    The queue respects the total limit parameter, filling with due cards
    first before adding new cards.

    Args:
        deck_id: UUID of the deck to get queue for
        limit: Maximum cards to return (1-100, default 20)
        include_new: Whether to include unstudied cards (default True)
        new_cards_limit: Maximum new cards to include (0-50, default 10)
        include_early_practice: Whether to include cards not yet due (default False)
        early_practice_limit: Maximum early practice cards to include (0-50, default 10)
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        StudyQueue with deck info, counts, and list of cards to study

    Raises:
        DeckNotFoundException (404): If deck doesn't exist or is inactive

    Example:
        GET /api/v1/study/queue/660e8400-e29b-41d4-a716-446655440001?limit=10&include_early_practice=true
    """
    deck_repo = DeckRepository(db)
    deck = await deck_repo.get(deck_id)
    if not deck or not deck.is_active:
        raise DeckNotFoundException(deck_id=str(deck_id))
    check_premium_deck_access(current_user, deck)
    service = SM2Service(db)
    request = StudyQueueRequest(
        deck_id=deck_id,
        limit=limit,
        include_new=include_new,
        new_cards_limit=new_cards_limit,
        include_early_practice=include_early_practice,
        early_practice_limit=early_practice_limit,
    )
    return await service.get_study_queue(current_user.id, request)


@router.get(
    "/stats",
    response_model=StudyStatsResponse,
    summary="Get study statistics",
    description="Retrieve study statistics for the current user with optional deck filter.",
    responses={
        200: {
            "description": "Study statistics retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "by_status": {
                            "new": 50,
                            "learning": 25,
                            "review": 100,
                            "mastered": 75,
                            "due": 15,
                        },
                        "reviews_today": 42,
                        "current_streak": 7,
                        "due_today": 15,
                        "total_reviews": 1250,
                        "total_study_time": 18500,
                        "average_quality": 3.8,
                    }
                }
            },
        },
        401: {"description": "Not authenticated - missing or invalid token"},
        404: {"description": "Deck not found (if deck_id specified)"},
        422: {"description": "Validation error - invalid deck_id format"},
    },
)
async def get_study_stats(
    deck_id: Optional[UUID] = Query(
        default=None,
        description="Optional deck ID to filter statistics by specific deck",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StudyStatsResponse:
    """Get study statistics for the current user.

    This endpoint retrieves comprehensive study statistics including:
    - Card counts by status (new, learning, review, mastered, due)
    - Reviews completed today
    - Current study streak (consecutive days)
    - Total lifetime reviews
    - Total study time in seconds
    - Average review quality rating

    Args:
        deck_id: Optional UUID to filter stats by specific deck
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        StudyStatsResponse with all statistics

    Example:
        GET /api/v1/study/stats
        GET /api/v1/study/stats?deck_id=660e8400-e29b-41d4-a716-446655440001
    """
    service = SM2Service(db)
    review_repo = ReviewRepository(db)

    # Get base stats from SM2Service (by_status, reviews_today, current_streak, due_today)
    stats = await service.get_study_stats(current_user.id, deck_id)

    # Get additional review analytics from ReviewRepository
    total_reviews = await review_repo.get_total_reviews(current_user.id)
    total_time = await review_repo.get_total_study_time(current_user.id)
    avg_quality = await review_repo.get_average_quality(current_user.id)

    return StudyStatsResponse(
        by_status=stats["by_status"],
        reviews_today=stats["reviews_today"],
        current_streak=stats["current_streak"],
        due_today=stats["due_today"],
        total_reviews=total_reviews,
        total_study_time=total_time,
        average_quality=avg_quality,
    )


@router.post(
    "/initialize",
    response_model=CardInitializationResult,
    summary="Initialize specific cards for study",
    description="Initialize CardStatistics records for specific cards in a deck. "
    "Creates records for cards that haven't been studied yet.",
    responses={
        200: {
            "description": "Cards initialized successfully",
            "content": {
                "application/json": {
                    "example": {
                        "initialized_count": 5,
                        "already_exists_count": 2,
                        "card_ids": [
                            "550e8400-e29b-41d4-a716-446655440000",
                            "550e8400-e29b-41d4-a716-446655440001",
                        ],
                    }
                }
            },
        },
        401: {"description": "Not authenticated - missing or invalid token"},
        404: {"description": "Deck not found or inactive"},
        422: {"description": "Validation error - invalid deck_id or card_ids"},
    },
)
async def initialize_cards(
    request: CardInitializationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CardInitializationResult:
    """Initialize specific cards for study.

    This endpoint creates CardStatistics records for cards that haven't been
    studied yet. Use this when:
    1. User starts a new deck
    2. New cards are added to a deck they're studying
    3. Frontend explicitly requests initialization

    The service validates that:
    - The deck exists and is active
    - All card_ids belong to the specified deck
    - Cards that already have statistics are skipped (not errors)

    Args:
        request: CardInitializationRequest with deck_id and list of card_ids
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        CardInitializationResult with counts of initialized and already-existing cards

    Raises:
        DeckNotFoundException (404): If deck doesn't exist or is inactive

    Example:
        POST /api/v1/study/initialize
        {
            "deck_id": "660e8400-e29b-41d4-a716-446655440001",
            "card_ids": ["550e8400-e29b-41d4-a716-446655440000"]
        }
    """
    deck_repo = DeckRepository(db)
    deck = await deck_repo.get(request.deck_id)
    if not deck or not deck.is_active:
        raise DeckNotFoundException(deck_id=str(request.deck_id))
    check_premium_deck_access(current_user, deck)
    service = SM2Service(db)
    return await service.initialize_cards_for_user(
        user_id=current_user.id,
        request=request,
    )


@router.post(
    "/initialize/{deck_id}",
    response_model=CardInitializationResult,
    summary="Initialize all cards in a deck for study",
    description="Convenience endpoint to initialize all cards in a deck at once. "
    "Creates CardStatistics records for all cards the user hasn't studied.",
    responses={
        200: {
            "description": "Deck cards initialized successfully",
            "content": {
                "application/json": {
                    "example": {
                        "initialized_count": 50,
                        "already_exists_count": 10,
                        "card_ids": [
                            "550e8400-e29b-41d4-a716-446655440000",
                            "550e8400-e29b-41d4-a716-446655440001",
                        ],
                    }
                }
            },
        },
        401: {"description": "Not authenticated - missing or invalid token"},
        404: {"description": "Deck not found or inactive"},
        422: {"description": "Validation error - invalid deck_id format"},
    },
)
async def initialize_deck(
    deck_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CardInitializationResult:
    """Initialize all cards in a deck for study.

    This is a convenience endpoint that initializes all cards in a deck
    at once. Use this when a user wants to start studying an entire deck.

    For decks with many cards, consider using the specific card initialization
    endpoint to control which cards are initialized.

    Args:
        deck_id: UUID of the deck to initialize
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        CardInitializationResult with counts of initialized and already-existing cards

    Raises:
        DeckNotFoundException (404): If deck doesn't exist or is inactive

    Example:
        POST /api/v1/study/initialize/660e8400-e29b-41d4-a716-446655440001
    """
    deck_repo = DeckRepository(db)
    deck = await deck_repo.get(deck_id)
    if deck:
        check_premium_deck_access(current_user, deck)
    service = SM2Service(db)
    return await service.initialize_deck_for_user(
        user_id=current_user.id,
        deck_id=deck_id,
    )
