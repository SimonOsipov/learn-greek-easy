"""Word Entry API endpoints.

This module provides HTTP endpoints for word entry operations including:
- Get word entry by ID (authenticated users)
"""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user
from src.core.exceptions import ForbiddenException, NotFoundException
from src.db.dependencies import get_db
from src.db.models import Deck, DeckWordEntry, User
from src.repositories.card_record import CardRecordRepository
from src.repositories.word_entry import WordEntryRepository
from src.schemas.card_record import CardRecordResponse
from src.schemas.word_entry import WordEntryResponse
from src.services.word_entry_response import word_entry_to_response

router = APIRouter(
    # Note: prefix is set by parent router in v1/router.py
    # This router is mounted at /word-entries under the /api/v1 prefix
    tags=["Word Entries"],
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        422: {"description": "Validation error"},
    },
)


@router.get(
    "/{word_entry_id}",
    response_model=WordEntryResponse,
    summary="Get word entry by ID",
    description="Retrieve a word entry by its ID. "
    "User must be authenticated and have access to the deck (owner or system deck).",
    responses={
        200: {
            "description": "Word entry retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "id": "660e8400-e29b-41d4-a716-446655440001",
                        "deck_id": "550e8400-e29b-41d4-a716-446655440000",
                        "lemma": "σπίτι",
                        "part_of_speech": "noun",
                        "translation_en": "house, home",
                        "translation_ru": "дом",
                        "pronunciation": "/spí·ti/",
                        "grammar_data": {
                            "gender": "neuter",
                            "nominative_singular": "σπίτι",
                            "genitive_singular": "σπιτιού",
                        },
                        "examples": [
                            {
                                "greek": "Το σπίτι μου είναι μικρό.",
                                "english": "My house is small.",
                            }
                        ],
                        "audio_key": None,
                        "is_active": True,
                        "created_at": "2024-01-15T10:30:00Z",
                        "updated_at": "2024-01-15T10:30:00Z",
                    }
                }
            },
        },
        403: {"description": "Access denied - user does not own the deck"},
        404: {"description": "Word entry not found or inactive"},
    },
)
async def get_word_entry(
    word_entry_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WordEntryResponse:
    """Get a word entry by its ID.

    Retrieves the word entry with full grammar data and examples.
    Authorization: User must have access to the deck (system decks are accessible to all,
    user-created decks require ownership).

    Args:
        word_entry_id: UUID of the word entry to retrieve
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        WordEntryResponse with full word entry data

    Raises:
        401: If not authenticated
        403: If user doesn't own the deck (for user-created decks)
        404: If word entry not found or inactive
    """
    # Fetch word entry with deck loaded for authorization check
    word_entry_repo = WordEntryRepository(db)
    word_entry = await word_entry_repo.get(word_entry_id)

    # Check if word entry exists and is active
    if word_entry is None or not word_entry.is_active:
        raise NotFoundException(
            resource="WordEntry",
            detail=f"Word entry with id '{word_entry_id}' not found",
        )

    # Find all decks linked to this word entry
    deck_links_result = await db.execute(
        select(Deck)
        .join(DeckWordEntry, DeckWordEntry.deck_id == Deck.id)
        .where(DeckWordEntry.word_entry_id == word_entry.id)
    )
    linked_decks = list(deck_links_result.scalars().all())

    if not linked_decks:
        raise NotFoundException(
            resource="WordEntry",
            detail=f"Word entry with id '{word_entry_id}' not found",
        )

    # Authorization: user must own a linked deck, or a system deck must be linked
    user_deck = None
    system_deck = None
    for d in linked_decks:
        if d.owner_id is None:
            system_deck = d
        elif d.owner_id == current_user.id:
            user_deck = d

    if user_deck is None and system_deck is None:
        raise ForbiddenException(detail="You don't have permission to access this word entry")

    # For response: prefer user's deck, fall back to system deck
    # At this point at least one of user_deck or system_deck is non-None
    context_deck: Deck = user_deck or system_deck  # type: ignore[assignment]

    return word_entry_to_response(word_entry, s3_service=None, deck_id=context_deck.id)


@router.get(
    "/{word_entry_id}/cards",
    response_model=list[CardRecordResponse],
    summary="Get cards for a word entry",
    description="Retrieve all active card records for a word entry. "
    "User must be authenticated and have access to the deck.",
    responses={
        200: {"description": "Card records retrieved successfully"},
        403: {"description": "Access denied - user does not own the deck"},
        404: {"description": "Word entry not found or inactive"},
    },
)
async def get_word_entry_cards(
    word_entry_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CardRecordResponse]:
    """Get card records for a word entry.

    Retrieves all active card records for the given word entry.
    Authorization: User must have access to the deck (system decks are accessible to all,
    user-created decks require ownership).

    Args:
        word_entry_id: UUID of the word entry
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        List of CardRecordResponse for active cards

    Raises:
        401: If not authenticated
        403: If user doesn't own the deck (for user-created decks)
        404: If word entry not found or inactive
    """
    # 1. Fetch and validate word entry
    word_entry_repo = WordEntryRepository(db)
    word_entry = await word_entry_repo.get(word_entry_id)

    if word_entry is None or not word_entry.is_active:
        raise NotFoundException(
            resource="WordEntry",
            detail=f"Word entry with id '{word_entry_id}' not found",
        )

    # 2. Find all decks linked to this word entry
    deck_links_result = await db.execute(
        select(Deck)
        .join(DeckWordEntry, DeckWordEntry.deck_id == Deck.id)
        .where(DeckWordEntry.word_entry_id == word_entry.id)
    )
    linked_decks = list(deck_links_result.scalars().all())

    if not linked_decks:
        raise NotFoundException(
            resource="WordEntry",
            detail=f"Word entry with id '{word_entry_id}' not found",
        )

    # 3. Authorization: user must own a linked deck, or a system deck must be linked
    user_deck = None
    system_deck = None
    for d in linked_decks:
        if d.owner_id is None:
            system_deck = d
        elif d.owner_id == current_user.id:
            user_deck = d

    if user_deck is None and system_deck is None:
        raise ForbiddenException(detail="You don't have permission to access this word entry")

    # 4. Fetch card records and filter to active only
    card_record_repo = CardRecordRepository(db)
    card_records = await card_record_repo.get_by_word_entry(word_entry_id)
    active_cards = [cr for cr in card_records if cr.is_active]

    return [CardRecordResponse.model_validate(cr) for cr in active_cards]
