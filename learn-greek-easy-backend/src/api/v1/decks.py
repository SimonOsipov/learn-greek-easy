"""Deck API endpoints.

This module provides HTTP endpoints for deck operations including
listing decks with pagination and filtering.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.dependencies import get_db
from src.db.models import DeckLevel
from src.repositories.deck import DeckRepository
from src.schemas.deck import DeckListResponse, DeckResponse

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
