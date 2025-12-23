"""Culture Deck API endpoints.

This module provides HTTP endpoints for culture exam deck operations including
listing decks with pagination and filtering, and retrieving deck details.

Endpoints:
- GET /culture/decks - List culture decks with optional category filter
- GET /culture/decks/{deck_id} - Get culture deck details
- GET /culture/categories - Get available categories
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user_optional
from src.db.dependencies import get_db
from src.db.models import User
from src.schemas.culture import CultureDeckDetailResponse, CultureDeckListResponse
from src.services import CultureDeckService

router = APIRouter(
    # Note: prefix is set by parent router in v1/router.py
    # This router is mounted at /culture under the /api/v1 prefix
    tags=["Culture"],
    responses={
        422: {"description": "Validation error"},
    },
)


@router.get(
    "/decks",
    response_model=CultureDeckListResponse,
    summary="List culture decks",
    description="""
    Get a paginated list of all active culture decks with optional category filtering.

    **Authentication**: Optional
    - Authenticated users receive progress data for each deck
    - Anonymous users receive decks without progress

    **Categories**: history, geography, politics, culture, traditions

    **Response includes**:
    - Deck name and description (multilingual JSON)
    - Icon and color accent
    - Category
    - Question count
    - Progress (for authenticated users)
    """,
    responses={
        200: {
            "description": "Paginated list of active culture decks",
            "content": {
                "application/json": {
                    "example": {
                        "total": 5,
                        "decks": [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440000",
                                "name": {
                                    "el": "Ελληνική Ιστορία",
                                    "en": "Greek History",
                                    "ru": "Греческая история",
                                },
                                "description": {"el": "...", "en": "...", "ru": "..."},
                                "icon": "book-open",
                                "color_accent": "#4F46E5",
                                "category": "history",
                                "question_count": 50,
                                "progress": None,
                            }
                        ],
                    }
                }
            },
        },
    },
)
async def list_culture_decks(
    page: int = Query(default=1, ge=1, description="Page number (starting from 1)"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page (max 100)"),
    category: Optional[str] = Query(
        default=None,
        description="Filter by category (history, geography, politics, culture, traditions)",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> CultureDeckListResponse:
    """List all active culture decks with pagination and optional filtering.

    This endpoint supports both authenticated and anonymous access:
    - Authenticated users receive personalized progress for each deck
    - Anonymous users receive deck information without progress

    Args:
        page: Page number starting from 1
        page_size: Number of items per page (1-100)
        category: Optional category filter
        db: Database session (injected)
        current_user: Optional authenticated user (injected)

    Returns:
        CultureDeckListResponse with total count and paginated deck list

    Example:
        GET /api/v1/culture/decks?page=1&page_size=10&category=history
    """
    service = CultureDeckService(db)
    user_id = current_user.id if current_user else None

    return await service.list_decks(
        page=page,
        page_size=page_size,
        category=category,
        user_id=user_id,
    )


@router.get(
    "/decks/{deck_id}",
    response_model=CultureDeckDetailResponse,
    summary="Get culture deck by ID",
    description="""
    Get a single culture deck by its UUID, including question count and metadata.

    **Authentication**: Optional
    - Authenticated users receive progress data
    - Anonymous users receive deck details without progress

    **Response includes**:
    - All deck information (name, description, icon, color, category)
    - Question count
    - Active status
    - Timestamps (created_at, updated_at)
    - Progress (for authenticated users)
    """,
    responses={
        200: {
            "description": "Culture deck details",
            "content": {
                "application/json": {
                    "example": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "name": {
                            "el": "Ελληνική Ιστορία",
                            "en": "Greek History",
                            "ru": "Греческая история",
                        },
                        "description": {"el": "...", "en": "...", "ru": "..."},
                        "icon": "book-open",
                        "color_accent": "#4F46E5",
                        "category": "history",
                        "question_count": 50,
                        "progress": {
                            "questions_total": 50,
                            "questions_mastered": 25,
                            "questions_learning": 10,
                            "questions_new": 15,
                            "last_practiced_at": "2024-01-15T10:30:00Z",
                        },
                        "is_active": True,
                        "created_at": "2024-01-01T00:00:00Z",
                        "updated_at": "2024-01-15T00:00:00Z",
                    }
                }
            },
        },
        404: {
            "description": "Culture deck not found",
            "content": {
                "application/json": {
                    "example": {
                        "success": False,
                        "error": {
                            "code": "NOT_FOUND",
                            "message": "Culture deck with ID '...' not found",
                        },
                    }
                }
            },
        },
    },
)
async def get_culture_deck(
    deck_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> CultureDeckDetailResponse:
    """Get a specific culture deck by ID with question count.

    This endpoint supports both authenticated and anonymous access.
    Inactive decks return 404.

    Args:
        deck_id: UUID of the deck to retrieve
        db: Database session (injected)
        current_user: Optional authenticated user (injected)

    Returns:
        CultureDeckDetailResponse with deck details

    Raises:
        CultureDeckNotFoundException: If deck doesn't exist or is inactive

    Example:
        GET /api/v1/culture/decks/550e8400-e29b-41d4-a716-446655440000
    """
    service = CultureDeckService(db)
    user_id = current_user.id if current_user else None

    return await service.get_deck(
        deck_id=deck_id,
        user_id=user_id,
    )


@router.get(
    "/categories",
    response_model=list[str],
    summary="Get culture deck categories",
    description="""
    Get all available culture deck categories that have active decks.

    **Use Case**: Populate category filter dropdown in the UI.

    **Possible categories**: history, geography, politics, culture, traditions
    """,
    responses={
        200: {
            "description": "List of available categories",
            "content": {
                "application/json": {
                    "example": ["culture", "geography", "history", "politics", "traditions"]
                }
            },
        },
    },
)
async def get_categories(
    db: AsyncSession = Depends(get_db),
) -> list[str]:
    """Get all available culture deck categories.

    Returns categories that have at least one active deck.

    Args:
        db: Database session (injected)

    Returns:
        List of unique category names

    Example:
        GET /api/v1/culture/categories
    """
    service = CultureDeckService(db)
    return await service.get_categories()
