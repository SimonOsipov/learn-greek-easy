"""Deck API endpoints.

This module provides HTTP endpoints for deck operations including
listing decks with pagination and filtering.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import DeckNotFoundException
from src.db.dependencies import get_db
from src.db.models import DeckLevel
from src.repositories.deck import DeckRepository
from src.schemas.deck import DeckDetailResponse, DeckListResponse, DeckResponse, DeckSearchResponse

router = APIRouter(
    # Note: prefix is set by parent router in v1/router.py
    # This router is mounted at /decks under the /api/v1 prefix
    tags=["Decks"],
    responses={
        422: {"description": "Validation error"},
    },
)


@router.get(
    "",
    response_model=DeckListResponse,
    summary="List active decks",
    description="Get a paginated list of all active decks with optional level filtering.",
    responses={
        200: {
            "description": "Paginated list of active decks",
            "content": {
                "application/json": {
                    "example": {
                        "total": 42,
                        "page": 1,
                        "page_size": 20,
                        "decks": [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440000",
                                "name": "Greek A1 Vocabulary",
                                "description": "Essential beginner vocabulary",
                                "level": "A1",
                                "is_active": True,
                                "created_at": "2024-01-15T10:30:00Z",
                                "updated_at": "2024-01-15T10:30:00Z",
                            }
                        ],
                    }
                }
            },
        },
    },
)
async def list_decks(
    page: int = Query(default=1, ge=1, description="Page number (starting from 1)"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page (max 100)"),
    level: Optional[DeckLevel] = Query(
        default=None, description="Filter by CEFR level (A1, A2, B1, B2, C1, C2)"
    ),
    db: AsyncSession = Depends(get_db),
) -> DeckListResponse:
    """List all active decks with pagination and optional filtering.

    This is a public endpoint that returns only active decks.
    Use the level parameter to filter by CEFR proficiency level.

    Args:
        page: Page number starting from 1
        page_size: Number of items per page (1-100)
        level: Optional CEFR level filter
        db: Database session (injected)

    Returns:
        DeckListResponse with total count and paginated deck list

    Example:
        GET /api/v1/decks?page=1&page_size=10&level=A1
    """
    repo = DeckRepository(db)

    # Calculate offset from page number
    skip = (page - 1) * page_size

    # Get decks and total count
    decks = await repo.list_active(skip=skip, limit=page_size, level=level)
    total = await repo.count_active(level=level)

    return DeckListResponse(
        total=total,
        page=page,
        page_size=page_size,
        decks=[DeckResponse.model_validate(deck) for deck in decks],
    )


@router.get(
    "/search",
    response_model=DeckSearchResponse,
    summary="Search decks",
    description="Search for decks by name or description with case-insensitive partial matching.",
    responses={
        200: {
            "description": "Search results with pagination",
            "content": {
                "application/json": {
                    "example": {
                        "total": 5,
                        "page": 1,
                        "page_size": 20,
                        "query": "vocabulary",
                        "decks": [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440000",
                                "name": "Greek A1 Vocabulary",
                                "description": "Essential beginner vocabulary",
                                "level": "A1",
                                "is_active": True,
                                "created_at": "2024-01-15T10:30:00Z",
                                "updated_at": "2024-01-15T10:30:00Z",
                            }
                        ],
                    }
                }
            },
        },
        422: {"description": "Validation error (missing or invalid query parameter)"},
    },
)
async def search_decks(
    q: str = Query(
        ...,  # Required parameter
        min_length=1,
        max_length=100,
        description="Search query (searches name and description)",
    ),
    page: int = Query(default=1, ge=1, description="Page number (starting from 1)"),
    page_size: int = Query(default=20, ge=1, le=50, description="Items per page (max 50)"),
    db: AsyncSession = Depends(get_db),
) -> DeckSearchResponse:
    """Search decks by name or description.

    Performs case-insensitive partial matching on deck names and descriptions.
    Only active decks are included in search results.

    Args:
        q: Search query (required, 1-100 characters)
        page: Page number starting from 1
        page_size: Number of items per page (1-50)
        db: Database session (injected)

    Returns:
        DeckSearchResponse with total count, pagination info, query, and matching decks

    Example:
        GET /api/v1/decks/search?q=vocabulary&page=1&page_size=10
    """
    repo = DeckRepository(db)

    # Calculate offset from page number
    skip = (page - 1) * page_size

    # Search decks and get total count
    decks = await repo.search(query_text=q, skip=skip, limit=page_size)
    total = await repo.count_search(query_text=q)

    return DeckSearchResponse(
        total=total,
        page=page,
        page_size=page_size,
        query=q,
        decks=[DeckResponse.model_validate(deck) for deck in decks],
    )


@router.get(
    "/{deck_id}",
    response_model=DeckDetailResponse,
    summary="Get deck by ID",
    description="Get a single deck by its UUID, including the card count.",
    responses={
        200: {
            "description": "Deck details with card count",
            "content": {
                "application/json": {
                    "example": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "name": "Greek A1 Vocabulary",
                        "description": "Essential beginner vocabulary",
                        "level": "A1",
                        "is_active": True,
                        "card_count": 50,
                        "created_at": "2024-01-15T10:30:00Z",
                        "updated_at": "2024-01-15T10:30:00Z",
                    }
                }
            },
        },
        404: {"description": "Deck not found"},
    },
)
async def get_deck(
    deck_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> DeckDetailResponse:
    """Get a specific deck by ID with card count.

    This is a public endpoint that returns deck details including
    the number of cards. Inactive decks return 404.

    Args:
        deck_id: UUID of the deck to retrieve
        db: Database session (injected)

    Returns:
        DeckDetailResponse with deck details and card count

    Raises:
        DeckNotFoundException: If deck doesn't exist or is inactive

    Example:
        GET /api/v1/decks/550e8400-e29b-41d4-a716-446655440000
    """
    repo = DeckRepository(db)

    # Get deck (returns None if not found)
    deck = await repo.get(deck_id)

    # Return 404 for non-existent or inactive decks
    if deck is None or not deck.is_active:
        raise DeckNotFoundException(deck_id=str(deck_id))

    # Get card count
    card_count = await repo.count_cards(deck_id)

    # Build response with card_count
    return DeckDetailResponse(
        id=deck.id,
        name=deck.name,
        description=deck.description,
        level=deck.level,
        is_active=deck.is_active,
        created_at=deck.created_at,
        updated_at=deck.updated_at,
        card_count=card_count,
    )
