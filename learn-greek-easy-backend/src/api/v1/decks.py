"""Deck API endpoints.

This module provides HTTP endpoints for deck operations including
listing decks with pagination and filtering.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.dependencies import get_current_user
from src.core.exceptions import DeckNotFoundException, ForbiddenException
from src.db.dependencies import get_db
from src.db.models import DeckLevel, User
from src.repositories.deck import DeckRepository
from src.schemas.deck import (
    DeckCreate,
    DeckDetailResponse,
    DeckListResponse,
    DeckResponse,
    DeckSearchResponse,
    DeckUpdate,
)
from src.tasks.background import invalidate_cache_task

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
    current_user: User = Depends(get_current_user),
) -> DeckListResponse:
    """List all active decks with pagination and optional filtering.

    Requires authentication. Returns only active decks.
    Use the level parameter to filter by CEFR proficiency level.

    Args:
        page: Page number starting from 1
        page_size: Number of items per page (1-100)
        level: Optional CEFR level filter
        db: Database session (injected)
        current_user: Authenticated user (injected)

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


@router.post(
    "",
    response_model=DeckResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new deck",
    description=(
        "Create a new deck. Regular users create personal decks (owner_id set to their ID, "
        "is_active=True, is_premium=False). Superusers create system decks (owner_id=None) by default."
    ),
    responses={
        201: {
            "description": "Deck created successfully",
            "content": {
                "application/json": {
                    "example": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "name": "Greek B1 Grammar",
                        "description": "Intermediate grammar concepts",
                        "level": "B1",
                        "is_active": True,
                        "is_premium": False,
                        "created_at": "2024-01-15T10:30:00Z",
                        "updated_at": "2024-01-15T10:30:00Z",
                    }
                }
            },
        },
        401: {"description": "Not authenticated"},
    },
)
async def create_deck(
    deck_data: DeckCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeckResponse:
    """Create a new deck.

    Any authenticated user can create a deck:
    - Regular users: Deck is automatically owned by the user (owner_id=current_user.id),
      is_active=True, is_premium=False. The deck will appear in /mine endpoint.
    - Superusers: Deck is a system deck (owner_id=None) with full control over
      is_active and is_premium values.

    Args:
        deck_data: Deck creation data (name, description, level)
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        DeckResponse: The created deck

    Raises:
        401: If not authenticated
        422: If validation fails
    """
    repo = DeckRepository(db)

    # Build the creation data dictionary
    create_data = deck_data.model_dump(exclude_unset=True)

    # Apply ownership rules based on user type
    if not current_user.is_superuser:
        # Regular users: force owner_id, is_active, is_premium
        create_data["owner_id"] = current_user.id
        create_data["is_active"] = True
        create_data["is_premium"] = False
    # Superusers: create system deck (owner_id=None by default)
    # They can set is_active and is_premium as needed (defaults apply from model)

    # Create the deck using BaseRepository.create()
    # Note: BaseRepository.create() uses flush, not commit
    deck = await repo.create(create_data)

    # Commit the transaction
    await db.commit()
    await db.refresh(deck)

    return DeckResponse.model_validate(deck)


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
    current_user: User = Depends(get_current_user),
) -> DeckSearchResponse:
    """Search decks by name or description.

    Requires authentication. Performs case-insensitive partial matching on
    deck names and descriptions. Only active decks are included in search results.

    Args:
        q: Search query (required, 1-100 characters)
        page: Page number starting from 1
        page_size: Number of items per page (1-50)
        db: Database session (injected)
        current_user: Authenticated user (injected)

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
    "/mine",
    response_model=DeckListResponse,
    summary="List user's own decks",
    description="Get paginated list of decks owned by the current user.",
    responses={
        200: {
            "description": "Paginated list of user's own decks",
            "content": {
                "application/json": {
                    "example": {
                        "total": 3,
                        "page": 1,
                        "page_size": 20,
                        "decks": [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440000",
                                "name": "My Custom Vocabulary",
                                "description": "My personal Greek vocabulary deck",
                                "level": "A1",
                                "is_active": True,
                                "is_premium": False,
                                "created_at": "2024-01-15T10:30:00Z",
                                "updated_at": "2024-01-15T10:30:00Z",
                            }
                        ],
                    }
                }
            },
        },
        401: {"description": "Not authenticated"},
    },
)
async def list_my_decks(
    page: int = Query(default=1, ge=1, description="Page number (starting from 1)"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page (max 100)"),
    level: Optional[DeckLevel] = Query(
        default=None, description="Filter by CEFR level (A1, A2, B1, B2, C1, C2)"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeckListResponse:
    """List all decks owned by the current authenticated user.

    Requires authentication. Returns only active decks owned by the user.
    Use the level parameter to filter by CEFR proficiency level.

    Args:
        page: Page number starting from 1
        page_size: Number of items per page (1-100)
        level: Optional CEFR level filter
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        DeckListResponse with total count and paginated deck list

    Example:
        GET /api/v1/decks/mine?page=1&page_size=10&level=A1
    """
    repo = DeckRepository(db)

    # Calculate offset from page number
    skip = (page - 1) * page_size

    # Get user's decks and total count
    decks = await repo.list_user_owned(
        user_id=current_user.id, skip=skip, limit=page_size, level=level
    )
    total = await repo.count_user_owned(user_id=current_user.id, level=level)

    return DeckListResponse(
        total=total,
        page=page,
        page_size=page_size,
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
        403: {"description": "Not authorized to access this deck"},
        404: {"description": "Deck not found"},
    },
)
async def get_deck(
    deck_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeckDetailResponse:
    """Get a specific deck by ID with card count.

    Requires authentication. Returns deck details including
    the number of cards. Inactive decks return 404.

    Args:
        deck_id: UUID of the deck to retrieve
        db: Database session (injected)
        current_user: Authenticated user (injected)

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

    # Authorization check: user-created decks can only be accessed by their owner
    # System decks (owner_id=NULL) are accessible to all authenticated users
    if deck.owner_id is not None and deck.owner_id != current_user.id:
        raise ForbiddenException(detail="You do not have permission to access this deck")

    # Get card count
    card_count = await repo.count_cards(deck_id)

    # Build response with card_count
    return DeckDetailResponse(
        id=deck.id,
        name=deck.name,
        description=deck.description,
        level=deck.level,
        is_active=deck.is_active,
        is_premium=deck.is_premium,
        created_at=deck.created_at,
        updated_at=deck.updated_at,
        card_count=card_count,
    )


@router.patch(
    "/{deck_id}",
    response_model=DeckResponse,
    summary="Update a deck",
    description=(
        "Update an existing deck. Deck owners can update their own decks. "
        "Superusers can update any deck including system decks."
    ),
    responses={
        200: {
            "description": "Deck updated successfully",
            "content": {
                "application/json": {
                    "example": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "name": "Updated Greek B1 Grammar",
                        "description": "Updated description",
                        "level": "B1",
                        "is_active": True,
                        "created_at": "2024-01-15T10:30:00Z",
                        "updated_at": "2024-01-16T14:00:00Z",
                    }
                }
            },
        },
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized to edit this deck"},
        404: {"description": "Deck not found"},
    },
)
async def update_deck(
    deck_id: UUID,
    deck_data: DeckUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeckResponse:
    """Update an existing deck.

    Authorization rules:
    - Deck owners can update their own decks (deck.owner_id == current_user.id)
    - Superusers can update any deck (including system decks with owner_id=None)

    Only provided fields will be updated (partial update).

    Args:
        deck_id: UUID of the deck to update
        deck_data: Fields to update (all optional)
        background_tasks: FastAPI BackgroundTasks for scheduling async operations
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        DeckResponse: The updated deck

    Raises:
        401: If not authenticated
        403: If not authorized to edit this deck
        404: If deck doesn't exist
        422: If validation fails
    """
    repo = DeckRepository(db)

    # Get existing deck (include inactive - owners/admins can update any deck state)
    deck = await repo.get(deck_id)
    if deck is None:
        raise DeckNotFoundException(deck_id=str(deck_id))

    # Authorization check: owner can update their deck, superuser can update any deck
    if deck.owner_id != current_user.id and not current_user.is_superuser:
        raise ForbiddenException(detail="Not authorized to edit this deck")

    # Update using BaseRepository.update() pattern
    updated_deck = await repo.update(deck, deck_data)

    # Commit the transaction
    await db.commit()
    await db.refresh(updated_deck)

    # Schedule background tasks if enabled
    if settings.feature_background_tasks:
        background_tasks.add_task(
            invalidate_cache_task,
            cache_type="deck",
            entity_id=deck_id,
        )

    return DeckResponse.model_validate(updated_deck)


@router.delete(
    "/{deck_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a deck",
    description=(
        "Soft delete a deck by setting is_active to False. "
        "Deck owners can delete their own decks. Superusers can delete any deck."
    ),
    responses={
        204: {"description": "Deck deleted successfully"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized to delete this deck"},
        404: {"description": "Deck not found"},
    },
)
async def delete_deck(
    deck_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Soft delete a deck.

    Authorization rules:
    - Deck owners can delete their own decks (deck.owner_id == current_user.id)
    - Superusers can delete any deck (including system decks with owner_id=None)

    This does NOT physically delete the deck from the database.
    Instead, it sets is_active=False, making the deck invisible
    to public endpoints while preserving the data.

    Note: Deleting an already-inactive deck is idempotent (returns 204).

    Args:
        deck_id: UUID of the deck to delete
        background_tasks: FastAPI BackgroundTasks for scheduling async operations
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        Empty response with 204 status

    Raises:
        401: If not authenticated
        403: If not authorized to delete this deck
        404: If deck doesn't exist
    """
    repo = DeckRepository(db)

    # Get existing deck (don't filter by is_active - allow re-deleting)
    deck = await repo.get(deck_id)
    if deck is None:
        raise DeckNotFoundException(deck_id=str(deck_id))

    # Authorization check: owner can delete their deck, superuser can delete any deck
    if deck.owner_id != current_user.id and not current_user.is_superuser:
        raise ForbiddenException(detail="Not authorized to delete this deck")

    # Soft delete by setting is_active to False
    deck.is_active = False

    # Commit changes
    await db.commit()

    # Schedule background tasks if enabled
    if settings.feature_background_tasks:
        background_tasks.add_task(
            invalidate_cache_task,
            cache_type="deck",
            entity_id=deck_id,
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
