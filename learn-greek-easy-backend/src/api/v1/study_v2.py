"""Study V2 API endpoint for the V2 SM2 study queue.

This module provides the HTTP endpoint for V2 study session operations,
allowing users to retrieve study queues using the V2 SM2 card system
(CardRecord-based multi-variant system).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user
from src.core.exceptions import DeckNotFoundException
from src.core.subscription import check_premium_deck_access, get_effective_access_level
from src.db.dependencies import get_db
from src.db.models import CardType, SubscriptionTier, User
from src.repositories.deck import DeckRepository
from src.schemas.v2_sm2 import V2StudyQueue
from src.services.v2_sm2_service import V2SM2Service

router = APIRouter(
    # Note: prefix is set by parent router in v1/router.py
    # This router is mounted at /study under the /api/v1 prefix
    tags=["Study V2"],
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Premium subscription required"},
        404: {"description": "Deck not found"},
        422: {"description": "Validation error"},
    },
)


@router.get("/queue/v2", response_model=V2StudyQueue)
async def get_v2_study_queue(
    deck_id: UUID | None = Query(default=None, description="Optional deck to scope queue to"),
    card_type: CardType | None = Query(default=None, description="Optional card type filter"),
    word_entry_id: UUID | None = Query(default=None, description="Optional word entry filter"),
    limit: int = Query(default=20, ge=1, le=100, description="Max cards to return"),
    include_new: bool = Query(default=True, description="Include unstudied cards"),
    new_cards_limit: int = Query(default=10, ge=0, le=50, description="Max new cards"),
    include_early_practice: bool = Query(default=False, description="Include not-yet-due cards"),
    early_practice_limit: int = Query(
        default=10, ge=0, le=50, description="Max early practice cards"
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> V2StudyQueue:
    """Get V2 study queue with cards from the V2 SM2 card system.

    Supports both deck-scoped and cross-deck modes via the optional deck_id parameter.
    At least one of deck_id or card_type must be provided.

    In deck-scoped mode (deck_id provided):
    - Validates deck exists, is active, and uses V2 card system
    - Checks premium access for the deck

    In cross-deck mode (no deck_id):
    - Requires card_type to be provided
    - Free-tier users have premium decks excluded automatically

    Args:
        deck_id: Optional UUID to scope queue to a specific deck
        card_type: Optional card type filter
        limit: Maximum cards to return (1-100, default 20)
        include_new: Whether to include unstudied cards (default True)
        new_cards_limit: Maximum new cards to include (0-50, default 10)
        include_early_practice: Whether to include cards not yet due (default False)
        early_practice_limit: Maximum early practice cards to include (0-50, default 10)
        current_user: Authenticated user (injected)
        db: Database session (injected)

    Returns:
        V2StudyQueue with counts and list of cards to study

    Raises:
        HTTPException 400: If neither deck_id nor card_type is provided
        HTTPException 400: If deck_id is provided and deck uses V1 card system
        DeckNotFoundException 404: If deck_id is provided but deck not found or inactive
        HTTPException 403: If deck is premium and user is on free tier

    Example:
        GET /api/v1/study/queue/v2?card_type=vocabulary&limit=10
        GET /api/v1/study/queue/v2?deck_id=660e8400-e29b-41d4-a716-446655440001&limit=10
    """
    if deck_id is None and card_type is None and word_entry_id is None:
        raise HTTPException(
            status_code=400,
            detail="At least one of deck_id, card_type, or word_entry_id must be provided",
        )

    if deck_id is not None:
        deck = await DeckRepository(db).get(deck_id)
        if not deck or not deck.is_active:
            raise DeckNotFoundException(deck_id=str(deck_id))
        check_premium_deck_access(current_user, deck)
        exclude_premium = False
    else:
        effective = get_effective_access_level(current_user)
        exclude_premium = effective == SubscriptionTier.FREE

    service = V2SM2Service(db)
    return await service.get_study_queue(
        user_id=current_user.id,
        deck_id=deck_id,
        card_type=card_type,
        word_entry_id=word_entry_id,
        limit=limit,
        include_new=include_new,
        new_cards_limit=new_cards_limit,
        include_early_practice=include_early_practice,
        early_practice_limit=early_practice_limit,
        exclude_premium_decks=exclude_premium,
    )
