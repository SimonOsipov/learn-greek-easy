"""Card API endpoints.

This module provides HTTP endpoints for card operations including
listing cards by deck with pagination and optional difficulty filtering.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.dependencies import get_current_superuser, get_current_user
from src.core.exceptions import CardNotFoundException, DeckNotFoundException, ForbiddenException
from src.db.dependencies import get_db
from src.db.models import User
from src.repositories.card import CardRepository
from src.repositories.deck import DeckRepository
from src.schemas.card import (
    CardBulkCreateRequest,
    CardBulkCreateResponse,
    CardCreate,
    CardListResponse,
    CardResponse,
    CardSearchResponse,
    CardUpdate,
)
from src.tasks.background import invalidate_cache_task

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
    description="Get paginated list of cards for a specific deck.",
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
    page: int = Query(default=1, ge=1, description="Page number (starting from 1)"),
    page_size: int = Query(default=50, ge=1, le=100, description="Items per page (max 100)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CardListResponse:
    """List cards for a specific deck with pagination.

    Requires authentication. Returns cards for active decks.

    Args:
        deck_id: UUID of the deck to get cards from (required)
        page: Page number starting from 1
        page_size: Number of items per page (1-100)
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        CardListResponse with total count, pagination info, and card list

    Raises:
        DeckNotFoundException: If deck doesn't exist or is inactive

    Example:
        GET /api/v1/cards?deck_id=550e8400-...&page=1&page_size=50
    """
    # Validate deck exists and is active
    deck_repo = DeckRepository(db)
    deck = await deck_repo.get(deck_id)
    if deck is None or not deck.is_active:
        raise DeckNotFoundException(deck_id=str(deck_id))

    card_repo = CardRepository(db)
    skip = (page - 1) * page_size

    # Get cards with pagination
    cards = await card_repo.get_by_deck(deck_id, skip=skip, limit=page_size)
    total = await card_repo.count_by_deck(deck_id)

    return CardListResponse(
        total=total,
        page=page,
        page_size=page_size,
        deck_id=deck_id,
        cards=[CardResponse.model_validate(card) for card in cards],
    )


@router.post(
    "",
    response_model=CardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new card",
    description="Create a new card in a deck. Requires deck ownership or superuser privileges.",
    responses={
        201: {
            "description": "Card created successfully",
            "content": {
                "application/json": {
                    "example": {
                        "id": "660e8400-e29b-41d4-a716-446655440002",
                        "deck_id": "550e8400-e29b-41d4-a716-446655440000",
                        "front_text": "efharisto",
                        "back_text": "thank you",
                        "example_sentence": "Efharisto poly!",
                        "pronunciation": "efharisto",
                        "created_at": "2024-01-15T10:30:00Z",
                        "updated_at": "2024-01-15T10:30:00Z",
                    }
                }
            },
        },
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized to create cards in this deck"},
        404: {"description": "Deck not found"},
        422: {"description": "Validation error"},
    },
)
async def create_card(
    card_data: CardCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CardResponse:
    """Create a new card.

    Requires deck ownership or superuser privileges.

    Args:
        card_data: Card creation data
        background_tasks: FastAPI BackgroundTasks for scheduling async operations
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        CardResponse: The created card

    Raises:
        401: If not authenticated
        403: If not authorized to create cards in this deck
        404: If deck doesn't exist
        422: If validation fails
    """
    # Validate deck exists
    deck_repo = DeckRepository(db)
    deck = await deck_repo.get(card_data.deck_id)
    if deck is None:
        raise DeckNotFoundException(deck_id=str(card_data.deck_id))

    # Authorization: user must own the deck OR be superuser
    if deck.owner_id != current_user.id and not current_user.is_superuser:
        raise ForbiddenException(detail="Not authorized to create cards in this deck")

    # Create the card using BaseRepository.create() pattern
    card_repo = CardRepository(db)
    card = await card_repo.create(card_data)

    # Commit the transaction
    await db.commit()
    await db.refresh(card)

    # Schedule background tasks if enabled
    if settings.feature_background_tasks:  # pragma: no cover
        background_tasks.add_task(
            invalidate_cache_task,
            cache_type="card",
            entity_id=card.id,
            deck_id=card.deck_id,
        )

    return CardResponse.model_validate(card)


@router.post(
    "/bulk",
    response_model=CardBulkCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Bulk create cards",
    description="Create multiple cards in one request. Requires superuser privileges. Maximum 100 cards per request.",
    responses={
        201: {
            "description": "Cards created successfully",
            "content": {
                "application/json": {
                    "example": {
                        "deck_id": "550e8400-e29b-41d4-a716-446655440000",
                        "created_count": 2,
                        "cards": [
                            {
                                "id": "660e8400-e29b-41d4-a716-446655440001",
                                "deck_id": "550e8400-e29b-41d4-a716-446655440000",
                                "front_text": "kalimera",
                                "back_text": "good morning",
                            }
                        ],
                    }
                }
            },
        },
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        404: {"description": "Deck not found"},
        422: {"description": "Validation error (empty array, >100 cards, invalid data)"},
    },
)
async def bulk_create_cards(
    request: CardBulkCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> CardBulkCreateResponse:
    """Create multiple cards in one request.

    Requires superuser privileges.

    This endpoint uses transactional semantics - if any card fails
    validation, the entire request is rejected (all-or-nothing).

    Args:
        request: Deck ID and array of cards to create
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Returns:
        CardBulkCreateResponse: Created cards with count

    Raises:
        401: If not authenticated
        403: If authenticated but not superuser
        404: If deck doesn't exist
        422: If validation fails (empty array, >100 cards, invalid card data)
    """
    # Validate deck exists
    deck_repo = DeckRepository(db)
    deck = await deck_repo.get(request.deck_id)
    if deck is None:
        raise DeckNotFoundException(deck_id=str(request.deck_id))

    # Prepare cards data with deck_id
    cards_data = [{"deck_id": request.deck_id, **card.model_dump()} for card in request.cards]

    # Bulk create using repository
    card_repo = CardRepository(db)
    created_cards = await card_repo.bulk_create(cards_data)

    # Commit the transaction
    await db.commit()

    # Refresh all cards to get generated fields (id, timestamps)
    for card in created_cards:
        await db.refresh(card)

    return CardBulkCreateResponse(
        deck_id=request.deck_id,
        created_count=len(created_cards),
        cards=[CardResponse.model_validate(card) for card in created_cards],
    )


@router.get(
    "/search",
    response_model=CardSearchResponse,
    summary="Search cards",
    description="Search cards by Greek or English text with optional deck filtering.",
    responses={
        200: {
            "description": "Search results with pagination",
            "content": {
                "application/json": {
                    "example": {
                        "total": 5,
                        "page": 1,
                        "page_size": 20,
                        "query": "morning",
                        "deck_id": None,
                        "cards": [],
                    }
                }
            },
        },
        404: {"description": "Deck not found (if deck_id provided)"},
        422: {"description": "Validation error"},
    },
)
async def search_cards(
    q: str = Query(
        ...,
        min_length=1,
        max_length=100,
        description="Search query (searches front_text, back_text, example_sentence)",
    ),
    deck_id: Optional[UUID] = Query(
        default=None, description="Optional: limit search to specific deck"
    ),
    page: int = Query(default=1, ge=1, description="Page number (starting from 1)"),
    page_size: int = Query(default=20, ge=1, le=50, description="Items per page (max 50)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CardSearchResponse:
    """Search cards by text content.

    Requires authentication. Performs case-insensitive partial matching on
    card text fields (front_text, back_text, example_sentence). Optionally
    filter by deck to narrow results.

    Args:
        q: Search query string (min 1 char, max 100 chars)
        deck_id: Optional deck UUID to limit search scope
        page: Page number starting from 1
        page_size: Number of items per page (1-50)
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        CardSearchResponse with total count, pagination info, and matching cards

    Raises:
        DeckNotFoundException: If deck_id is provided but deck doesn't exist

    Example:
        GET /api/v1/cards/search?q=morning
        GET /api/v1/cards/search?q=hello&deck_id=550e8400-...&page=1&page_size=10
    """
    # Validate deck exists if provided
    if deck_id:
        deck_repo = DeckRepository(db)
        deck = await deck_repo.get(deck_id)
        if deck is None:
            raise DeckNotFoundException(deck_id=str(deck_id))

    card_repo = CardRepository(db)
    skip = (page - 1) * page_size

    cards = await card_repo.search(query_text=q, deck_id=deck_id, skip=skip, limit=page_size)
    total = await card_repo.count_search(query_text=q, deck_id=deck_id)

    return CardSearchResponse(
        total=total,
        page=page,
        page_size=page_size,
        query=q,
        deck_id=deck_id,
        cards=[CardResponse.model_validate(card) for card in cards],
    )


# NOTE: The /search endpoint above MUST stay BEFORE this /{card_id} endpoint
# to avoid route conflicts. FastAPI matches routes in order.


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
    current_user: User = Depends(get_current_user),
) -> CardResponse:
    """Get a specific card by ID.

    Requires authentication. Returns full card details.

    Args:
        card_id: UUID of the card to retrieve
        db: Database session (injected)
        current_user: Authenticated user (injected)

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


@router.patch(
    "/{card_id}",
    response_model=CardResponse,
    summary="Update a card",
    description="Update an existing card. Requires deck ownership or superuser privileges.",
    responses={
        200: {
            "description": "Card updated successfully",
            "content": {
                "application/json": {
                    "example": {
                        "id": "660e8400-e29b-41d4-a716-446655440001",
                        "deck_id": "550e8400-e29b-41d4-a716-446655440000",
                        "front_text": "Updated Greek text",
                        "back_text": "Updated English text",
                        "example_sentence": "Updated example",
                        "pronunciation": "updated",
                        "created_at": "2024-01-15T10:30:00Z",
                        "updated_at": "2024-01-16T14:00:00Z",
                    }
                }
            },
        },
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized to edit this card"},
        404: {"description": "Card not found"},
        422: {"description": "Validation error"},
    },
)
async def update_card(
    card_id: UUID,
    card_data: CardUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CardResponse:
    """Update an existing card.

    Requires deck ownership or superuser privileges.
    Only provided fields will be updated (partial update).
    Note: deck_id cannot be changed.

    Args:
        card_id: UUID of the card to update
        card_data: Fields to update (all optional)
        background_tasks: FastAPI BackgroundTasks for scheduling async operations
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        CardResponse: The updated card

    Raises:
        401: If not authenticated
        403: If not authorized to edit this card
        404: If card doesn't exist
        422: If validation fails
    """
    repo = CardRepository(db)

    # Get existing card
    card = await repo.get(card_id)
    if card is None:
        raise CardNotFoundException(card_id=str(card_id))

    # Authorization: user must own the deck OR be superuser
    deck_repo = DeckRepository(db)
    deck = await deck_repo.get(card.deck_id)
    if deck is None or (deck.owner_id != current_user.id and not current_user.is_superuser):
        raise ForbiddenException(detail="Not authorized to edit this card")

    # Update card
    updated_card = await repo.update(card, card_data)

    # Commit the transaction
    await db.commit()
    await db.refresh(updated_card)

    # Schedule background tasks if enabled
    if settings.feature_background_tasks:  # pragma: no cover
        background_tasks.add_task(
            invalidate_cache_task,
            cache_type="card",
            entity_id=card_id,
            deck_id=updated_card.deck_id,
        )

    return CardResponse.model_validate(updated_card)


@router.delete(
    "/{card_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a card",
    description="Delete a card. Requires superuser privileges. This is a hard delete.",
    responses={
        204: {"description": "Card deleted successfully"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        404: {"description": "Card not found"},
    },
)
async def delete_card(
    card_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> Response:
    """Delete a card.

    Requires superuser privileges.

    WARNING: This is a HARD DELETE. The card and all associated
    statistics/reviews will be permanently removed.

    Args:
        card_id: UUID of the card to delete
        background_tasks: FastAPI BackgroundTasks for scheduling async operations
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Returns:
        Empty response with 204 status

    Raises:
        401: If not authenticated
        403: If authenticated but not superuser
        404: If card doesn't exist
    """
    repo = CardRepository(db)

    # Get existing card
    card = await repo.get(card_id)
    if card is None:
        raise CardNotFoundException(card_id=str(card_id))

    # Store deck_id before deletion for cache invalidation
    deck_id = card.deck_id

    # Hard delete the card
    await repo.delete(card)

    # Commit the transaction
    await db.commit()

    # Schedule background tasks if enabled
    if settings.feature_background_tasks:  # pragma: no cover
        background_tasks.add_task(
            invalidate_cache_task,
            cache_type="card",
            entity_id=card_id,
            deck_id=deck_id,
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
