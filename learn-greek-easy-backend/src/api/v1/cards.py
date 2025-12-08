"""Card API endpoints.

This module provides HTTP endpoints for card operations including
listing cards by deck with pagination and optional difficulty filtering.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import CardNotFoundException, DeckNotFoundException
from src.db.dependencies import get_db
from src.db.models import CardDifficulty
from src.repositories.card import CardRepository
from src.repositories.deck import DeckRepository
from src.schemas.card import CardListResponse, CardResponse

router = APIRouter(
    # Note: prefix is set by parent router in v1/router.py
    # This router is mounted at /cards under the /api/v1 prefix
    tags=["Cards"],
    responses={
        422: {"description": "Validation error"},
    },
)


@router.get(
    "",
    response_model=CardListResponse,
    summary="List cards by deck",
    description="Get paginated list of cards for a specific deck with optional difficulty filtering.",
    responses={
        200: {
            "description": "Paginated list of cards",
            "content": {
                "application/json": {
                    "example": {
                        "total": 150,
                        "page": 1,
                        "page_size": 50,
                        "deck_id": "550e8400-e29b-41d4-a716-446655440000",
                        "cards": [
                            {
                                "id": "660e8400-e29b-41d4-a716-446655440001",
                                "deck_id": "550e8400-e29b-41d4-a716-446655440000",
                                "front_text": "Hello",
                                "back_text": "Geia sou",
                                "example_sentence": "Geia sou, ti kaneis?",
                                "pronunciation": "YAH-soo",
                                "difficulty": "easy",
                                "order_index": 0,
                                "created_at": "2024-01-15T10:30:00Z",
                                "updated_at": "2024-01-15T10:30:00Z",
                            }
                        ],
                    }
                }
            },
        },
        404: {"description": "Deck not found"},
    },
)
async def list_cards(
    deck_id: UUID = Query(..., description="Deck UUID (required)"),
    difficulty: Optional[CardDifficulty] = Query(
        default=None, description="Filter by difficulty (easy, medium, hard)"
    ),
    page: int = Query(default=1, ge=1, description="Page number (starting from 1)"),
    page_size: int = Query(default=50, ge=1, le=100, description="Items per page (max 100)"),
    db: AsyncSession = Depends(get_db),
) -> CardListResponse:
    """List cards for a specific deck with pagination and optional filtering.

    This is a public endpoint that returns cards for active decks.
    Use the difficulty parameter to filter by card difficulty level.

    Args:
        deck_id: UUID of the deck to get cards from (required)
        difficulty: Optional difficulty filter (easy, medium, hard)
        page: Page number starting from 1
        page_size: Number of items per page (1-100)
        db: Database session (injected)

    Returns:
        CardListResponse with total count, pagination info, and card list

    Raises:
        DeckNotFoundException: If deck doesn't exist or is inactive

    Example:
        GET /api/v1/cards?deck_id=550e8400-...&page=1&page_size=50
        GET /api/v1/cards?deck_id=550e8400-...&difficulty=easy
    """
    # Validate deck exists and is active
    deck_repo = DeckRepository(db)
    deck = await deck_repo.get(deck_id)
    if deck is None or not deck.is_active:
        raise DeckNotFoundException(deck_id=str(deck_id))

    card_repo = CardRepository(db)
    skip = (page - 1) * page_size

    # Get cards with optional difficulty filter
    if difficulty:
        # For difficulty filter, we need to get all matching cards first
        # then apply pagination (since get_by_difficulty doesn't support pagination)
        all_cards = await card_repo.get_by_difficulty(deck_id, difficulty)
        total = len(all_cards)
        cards = all_cards[skip : skip + page_size]
    else:
        # Without difficulty filter, use optimized paginated query
        cards = await card_repo.get_by_deck(deck_id, skip=skip, limit=page_size)
        total = await card_repo.count_by_deck(deck_id)

    return CardListResponse(
        total=total,
        page=page,
        page_size=page_size,
        deck_id=deck_id,
        cards=[CardResponse.model_validate(card) for card in cards],
    )


# NOTE: When adding the /search endpoint (task-151), it MUST be placed
# BEFORE this /{card_id} endpoint to avoid route conflicts.
# FastAPI matches routes in order, so /search must come before /{card_id}.


@router.get(
    "/{card_id}",
    response_model=CardResponse,
    summary="Get card by ID",
    description="Get a single card by its UUID.",
    responses={
        200: {
            "description": "Card details",
            "content": {
                "application/json": {
                    "example": {
                        "id": "660e8400-e29b-41d4-a716-446655440001",
                        "deck_id": "550e8400-e29b-41d4-a716-446655440000",
                        "front_text": "kalimera",
                        "back_text": "good morning",
                        "example_sentence": "Kalimera! Pos eisai?",
                        "pronunciation": "kalimera",
                        "difficulty": "easy",
                        "order_index": 1,
                        "created_at": "2024-01-15T10:30:00Z",
                        "updated_at": "2024-01-15T10:30:00Z",
                    }
                }
            },
        },
        404: {"description": "Card not found"},
    },
)
async def get_card(
    card_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> CardResponse:
    """Get a specific card by ID.

    This is a public endpoint that returns full card details.

    Args:
        card_id: UUID of the card to retrieve
        db: Database session (injected)

    Returns:
        CardResponse with card details

    Raises:
        CardNotFoundException: If card doesn't exist
    """
    repo = CardRepository(db)

    card = await repo.get(card_id)
    if card is None:
        raise CardNotFoundException(card_id=str(card_id))

    return CardResponse.model_validate(card)
