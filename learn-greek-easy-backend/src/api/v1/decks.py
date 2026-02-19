"""Deck API endpoints.

This module provides HTTP endpoints for deck operations including
listing decks with pagination and filtering.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.dependencies import get_current_user, get_locale_from_header
from src.core.exceptions import DeckNotFoundException, ForbiddenException
from src.core.localization import get_localized_deck_content
from src.db.dependencies import get_db
from src.db.models import CardSystemVersion, DeckLevel, PartOfSpeech, User
from src.repositories.deck import DeckRepository
from src.repositories.word_entry import WordEntryRepository
from src.schemas.deck import (
    DeckCreate,
    DeckDetailResponse,
    DeckListResponse,
    DeckResponse,
    DeckSearchResponse,
    DeckUpdate,
    DeckWordEntriesResponse,
)
from src.services.word_entry_response import word_entry_to_response
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
    description="""Get a paginated list of all active decks with optional level filtering.

**Localization**: Content is returned in the language specified by the
Accept-Language header. Supported languages: en (English), el (Greek), ru (Russian).
Falls back to English if the requested language is not supported.
""",
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
    locale: str = Depends(get_locale_from_header),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeckListResponse:
    """List all active decks with pagination and optional filtering.

    Requires authentication. Returns only active decks.
    Content is localized based on Accept-Language header.
    Use the level parameter to filter by CEFR proficiency level.

    Args:
        page: Page number starting from 1
        page_size: Number of items per page (1-100)
        level: Optional CEFR level filter
        locale: Locale from Accept-Language header
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

    # Get card counts for all decks in batch
    deck_ids = [deck.id for deck in decks]
    card_counts = await repo.get_batch_card_counts(deck_ids)

    # Build localized response with card counts
    deck_responses = []
    for deck in decks:
        name, description = get_localized_deck_content(deck, locale)
        deck_responses.append(
            DeckResponse(
                id=deck.id,
                name=name,
                description=description,
                name_en=deck.name_en,
                name_ru=deck.name_ru,
                description_en=deck.description_en,
                description_ru=deck.description_ru,
                level=deck.level,
                is_active=deck.is_active,
                is_premium=deck.is_premium,
                card_system=deck.card_system,
                card_count=card_counts.get(deck.id, 0),
                created_at=deck.created_at,
                updated_at=deck.updated_at,
            )
        )

    return DeckListResponse(
        total=total,
        page=page,
        page_size=page_size,
        decks=deck_responses,
    )


@router.post(
    "",
    response_model=DeckResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new deck",
    description=(
        "Create a new deck. Regular users create personal decks (owner_id set to their ID, "
        "is_active=True, is_premium=False). Superusers create personal decks by default; "
        "set is_system_deck=True to create system decks (owner_id=None)."
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
    - Superusers: By default, create personal decks. Set is_system_deck=True to
      create system decks (owner_id=None) with full control over is_active and is_premium.

    Args:
        deck_data: Deck creation data (name, description, level, is_system_deck)
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        DeckResponse: The created deck

    Raises:
        401: If not authenticated
        403: If regular user tries to create a system deck
        422: If validation fails
    """
    repo = DeckRepository(db)

    # Build the creation data dictionary, excluding the is_system_deck flag
    # which is only used for logic, not stored in the database
    create_data = deck_data.model_dump(exclude_unset=True, exclude={"is_system_deck"})

    # Map name/description to trilingual fields
    # Bilingual fields (name_en, name_ru) take priority over single name field
    if "name_en" in create_data or "name_ru" in create_data:
        # Bilingual fields provided — use them directly, default name_el to name_en
        name_en = create_data.get("name_en") or create_data.get("name", "")
        create_data["name_en"] = name_en
        create_data["name_el"] = name_en  # Greek mirrors English
        if "name_ru" not in create_data:
            create_data["name_ru"] = name_en
        create_data.pop("name", None)
    elif "name" in create_data:
        # Legacy single-name field — copy to all columns
        name = create_data.pop("name")
        create_data["name_en"] = name
        create_data["name_el"] = name  # Same as English for user-created decks
        create_data["name_ru"] = name  # Same as English for user-created decks
    if "description_en" in create_data or "description_ru" in create_data:
        # Bilingual description fields — use directly
        desc_en = create_data.get("description_en") or create_data.get("description")
        create_data["description_en"] = desc_en
        create_data["description_el"] = desc_en  # Greek mirrors English
        if "description_ru" not in create_data:
            create_data["description_ru"] = desc_en
        create_data.pop("description", None)
    elif "description" in create_data:
        description = create_data.pop("description")
        create_data["description_en"] = description
        create_data["description_el"] = description  # Same as English for user-created decks
        create_data["description_ru"] = description  # Same as English for user-created decks

    # Determine deck ownership based on is_system_deck flag and user permissions
    if deck_data.is_system_deck:
        # Only superusers can create system decks
        if not current_user.is_superuser:
            raise ForbiddenException(detail="Only administrators can create system decks")
        # System deck: owner_id remains None (not set)
        # Superusers can control is_active and is_premium (defaults from model)
    else:
        # Personal deck: owned by the current user
        create_data["owner_id"] = current_user.id
        # Non-superusers have forced values for safety
        if not current_user.is_superuser:
            create_data["is_active"] = True
            create_data["is_premium"] = False

    # Set card_system to V1 since this endpoint pairs with POST /api/v1/cards (V1 Card table)
    # V2 decks are created via the admin API with word entries
    create_data["card_system"] = CardSystemVersion.V1

    # Create the deck using BaseRepository.create()
    # Note: BaseRepository.create() uses flush, not commit
    deck = await repo.create(create_data)

    # Commit the transaction
    await db.commit()
    await db.refresh(deck)

    # Return response with localized fields (default to English for created deck)
    return DeckResponse(
        id=deck.id,
        name=deck.name_en,
        description=deck.description_en,
        name_en=deck.name_en,
        name_ru=deck.name_ru,
        description_en=deck.description_en,
        description_ru=deck.description_ru,
        level=deck.level,
        is_active=deck.is_active,
        is_premium=deck.is_premium,
        card_system=deck.card_system,
        card_count=0,  # New deck has no cards
        created_at=deck.created_at,
        updated_at=deck.updated_at,
    )


@router.get(
    "/search",
    response_model=DeckSearchResponse,
    summary="Search decks",
    description="""Search for decks by name or description with case-insensitive partial matching.

**Localization**: Content is returned in the language specified by the
Accept-Language header. Supported languages: en (English), el (Greek), ru (Russian).
Falls back to English if the requested language is not supported.
""",
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
    locale: str = Depends(get_locale_from_header),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeckSearchResponse:
    """Search decks by name or description.

    Requires authentication. Performs case-insensitive partial matching on
    deck names and descriptions. Only active decks are included in search results.
    Content is localized based on Accept-Language header.

    Args:
        q: Search query (required, 1-100 characters)
        page: Page number starting from 1
        page_size: Number of items per page (1-50)
        locale: Locale from Accept-Language header
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

    # Get card counts for all decks in batch
    deck_ids = [deck.id for deck in decks]
    card_counts = await repo.get_batch_card_counts(deck_ids)

    # Build localized response with card counts
    deck_responses = []
    for deck in decks:
        name, description = get_localized_deck_content(deck, locale)
        deck_responses.append(
            DeckResponse(
                id=deck.id,
                name=name,
                description=description,
                name_en=deck.name_en,
                name_ru=deck.name_ru,
                description_en=deck.description_en,
                description_ru=deck.description_ru,
                level=deck.level,
                is_active=deck.is_active,
                is_premium=deck.is_premium,
                card_system=deck.card_system,
                card_count=card_counts.get(deck.id, 0),
                created_at=deck.created_at,
                updated_at=deck.updated_at,
            )
        )

    return DeckSearchResponse(
        total=total,
        page=page,
        page_size=page_size,
        query=q,
        decks=deck_responses,
    )


@router.get(
    "/mine",
    response_model=DeckListResponse,
    summary="List user's own decks",
    description="""Get paginated list of decks owned by the current user.

**Localization**: Content is returned in the language specified by the
Accept-Language header. Supported languages: en (English), el (Greek), ru (Russian).
Falls back to English if the requested language is not supported.
""",
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
    locale: str = Depends(get_locale_from_header),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeckListResponse:
    """List all decks owned by the current authenticated user.

    Requires authentication. Returns only active decks owned by the user.
    Content is localized based on Accept-Language header.
    Use the level parameter to filter by CEFR proficiency level.

    Args:
        page: Page number starting from 1
        page_size: Number of items per page (1-100)
        level: Optional CEFR level filter
        locale: Locale from Accept-Language header
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

    # Get card counts for all decks in batch
    deck_ids = [deck.id for deck in decks]
    card_counts = await repo.get_batch_card_counts(deck_ids)

    # Build localized response with card counts
    deck_responses = []
    for deck in decks:
        name, description = get_localized_deck_content(deck, locale)
        deck_responses.append(
            DeckResponse(
                id=deck.id,
                name=name,
                description=description,
                name_en=deck.name_en,
                name_ru=deck.name_ru,
                description_en=deck.description_en,
                description_ru=deck.description_ru,
                level=deck.level,
                is_active=deck.is_active,
                is_premium=deck.is_premium,
                card_system=deck.card_system,
                card_count=card_counts.get(deck.id, 0),
                created_at=deck.created_at,
                updated_at=deck.updated_at,
            )
        )

    return DeckListResponse(
        total=total,
        page=page,
        page_size=page_size,
        decks=deck_responses,
    )


@router.get(
    "/{deck_id}",
    response_model=DeckDetailResponse,
    summary="Get deck by ID",
    description="""Get a single deck by its UUID, including the card count.

**Localization**: Content is returned in the language specified by the
Accept-Language header. Supported languages: en (English), el (Greek), ru (Russian).
Falls back to English if the requested language is not supported.
""",
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
    locale: str = Depends(get_locale_from_header),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeckDetailResponse:
    """Get a specific deck by ID with card count.

    Requires authentication. Returns deck details including
    the number of cards. Content is localized based on Accept-Language header.
    Inactive decks return 404.

    Args:
        deck_id: UUID of the deck to retrieve
        locale: Locale from Accept-Language header
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

    # Get localized content
    name, description = get_localized_deck_content(deck, locale)

    # Build response with localized content and card_count
    return DeckDetailResponse(
        id=deck.id,
        name=name,
        description=description,
        name_en=deck.name_en,
        name_ru=deck.name_ru,
        description_en=deck.description_en,
        description_ru=deck.description_ru,
        level=deck.level,
        is_active=deck.is_active,
        is_premium=deck.is_premium,
        card_system=deck.card_system,
        created_at=deck.created_at,
        updated_at=deck.updated_at,
        card_count=card_count,
    )


@router.get(
    "/{deck_id}/word-entries",
    response_model=DeckWordEntriesResponse,
    summary="List word entries for a deck",
    description="""Get paginated word entries for a specific deck.

This endpoint powers the V2 deck word browser. For V1 decks (which don't have
word entries), this returns an empty list with total=0.

**Features**:
- Pagination with page/page_size
- Search by lemma, translations, or pronunciation
- Filter by part of speech
- Sort by lemma (alphabetical) or created_at (newest/oldest)
""",
    responses={
        200: {
            "description": "Paginated list of word entries",
            "content": {
                "application/json": {
                    "example": {
                        "deck_id": "550e8400-e29b-41d4-a716-446655440000",
                        "total": 42,
                        "page": 1,
                        "page_size": 20,
                        "word_entries": [
                            {
                                "id": "660e8400-e29b-41d4-a716-446655440001",
                                "deck_id": "550e8400-e29b-41d4-a716-446655440000",
                                "lemma": "spiti",
                                "part_of_speech": "noun",
                                "translation_en": "house, home",
                                "translation_ru": "dom",
                                "pronunciation": "spiti",
                                "is_active": True,
                                "created_at": "2024-01-15T10:30:00Z",
                                "updated_at": "2024-01-15T10:30:00Z",
                            }
                        ],
                    }
                }
            },
        },
        403: {"description": "Not authorized to access this deck"},
        404: {"description": "Deck not found"},
    },
)
async def list_deck_word_entries(
    deck_id: UUID,
    page: int = Query(default=1, ge=1, description="Page number (starting from 1)"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page (max 100)"),
    search: Optional[str] = Query(
        default=None,
        max_length=100,
        description="Search by lemma, translation, or pronunciation",
    ),
    part_of_speech: Optional[PartOfSpeech] = Query(
        default=None,
        description="Filter by part of speech (noun, verb, adjective, adverb, phrase)",
    ),
    sort_by: str = Query(
        default="lemma",
        pattern="^(lemma|created_at)$",
        description="Sort field: 'lemma' or 'created_at'",
    ),
    sort_order: str = Query(
        default="asc",
        pattern="^(asc|desc)$",
        description="Sort direction: 'asc' or 'desc'",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeckWordEntriesResponse:
    """List word entries for a specific deck.

    Requires authentication. Returns active word entries only.
    For V1 decks (no word entries), returns empty list.

    Authorization:
    - System decks (owner_id=NULL): accessible to all authenticated users
    - User-created decks: only accessible to the owner

    Args:
        deck_id: UUID of the deck
        page: Page number starting from 1
        page_size: Number of items per page (1-100)
        search: Optional search term
        part_of_speech: Optional part of speech filter
        sort_by: Sort field ('lemma' or 'created_at')
        sort_order: Sort direction ('asc' or 'desc')
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        DeckWordEntriesResponse with paginated word entries

    Raises:
        DeckNotFoundException: If deck doesn't exist or is inactive
        ForbiddenException: If not authorized to access the deck
    """
    # Validate deck exists and user has access
    deck_repo = DeckRepository(db)
    deck = await deck_repo.get(deck_id)

    if deck is None or not deck.is_active:
        raise DeckNotFoundException(deck_id=str(deck_id))

    # Authorization: user-created decks only accessible by owner
    if deck.owner_id is not None and deck.owner_id != current_user.id:
        raise ForbiddenException(detail="You do not have permission to access this deck")

    # Calculate offset
    skip = (page - 1) * page_size

    # Query word entries
    word_entry_repo = WordEntryRepository(db)
    word_entries = await word_entry_repo.search_by_deck(
        deck_id=deck_id,
        skip=skip,
        limit=page_size,
        search=search,
        part_of_speech=part_of_speech,
        sort_by=sort_by,
        sort_order=sort_order,
        active_only=True,
    )
    total = await word_entry_repo.count_by_deck_filtered(
        deck_id=deck_id,
        search=search,
        part_of_speech=part_of_speech,
        active_only=True,
    )

    return DeckWordEntriesResponse(
        deck_id=deck_id,
        total=total,
        page=page,
        page_size=page_size,
        word_entries=[word_entry_to_response(entry) for entry in word_entries],
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

    # Map name/description to trilingual fields for update
    # Bilingual fields (name_en, name_ru) take priority over single name field
    update_data = deck_data.model_dump(exclude_unset=True)
    if "name_en" in update_data or "name_ru" in update_data:
        # Bilingual fields provided — use them directly
        # Set name_el to name_en (Greek not user-editable)
        if "name_en" in update_data:
            update_data["name_el"] = update_data["name_en"]
        update_data.pop("name", None)
    elif "name" in update_data:
        # Legacy single-name field — copy to all columns
        name = update_data.pop("name")
        update_data["name_en"] = name
        update_data["name_el"] = name  # For user updates, set all to same value
        update_data["name_ru"] = name
    if "description_en" in update_data or "description_ru" in update_data:
        # Bilingual description fields — use directly
        if "description_en" in update_data:
            update_data["description_el"] = update_data["description_en"]
        update_data.pop("description", None)
    elif "description" in update_data:
        description = update_data.pop("description")
        update_data["description_en"] = description
        update_data["description_el"] = description
        update_data["description_ru"] = description

    # Update using BaseRepository.update() pattern
    updated_deck = await repo.update(deck, update_data)

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

    # Return response with localized fields (default to English for updated deck)
    card_count = await repo.count_cards(deck_id)
    return DeckResponse(
        id=updated_deck.id,
        name=updated_deck.name_en,
        description=updated_deck.description_en,
        name_en=updated_deck.name_en,
        name_ru=updated_deck.name_ru,
        description_en=updated_deck.description_en,
        description_ru=updated_deck.description_ru,
        level=updated_deck.level,
        is_active=updated_deck.is_active,
        is_premium=updated_deck.is_premium,
        card_system=updated_deck.card_system,
        card_count=card_count,
        created_at=updated_deck.created_at,
        updated_at=updated_deck.updated_at,
    )


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
