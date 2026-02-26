"""Word Entry API endpoints.

This module provides HTTP endpoints for word entry operations including:
- Get word entry by ID (authenticated users)
- Bulk upload of word entries with upsert behavior (superuser only)
"""

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.dependencies import get_current_superuser, get_current_user
from src.core.exceptions import DeckNotFoundException, ForbiddenException, NotFoundException
from src.db.dependencies import get_db
from src.db.models import User
from src.repositories.card_record import CardRecordRepository
from src.repositories.deck import DeckRepository
from src.repositories.word_entry import WordEntryRepository
from src.schemas.card_record import CardRecordResponse
from src.schemas.word_entry import WordEntryBulkRequest, WordEntryBulkResponse, WordEntryResponse
from src.services.card_generator_service import CardGeneratorService
from src.services.word_entry_response import word_entry_to_response
from src.tasks import generate_word_entry_audio_task, is_background_tasks_enabled
from src.utils.greek_text import resolve_tts_text

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

    # Load deck for authorization check
    deck_repo = DeckRepository(db)
    deck = await deck_repo.get(word_entry.deck_id)

    if deck is None:
        raise NotFoundException(
            resource="WordEntry",
            detail=f"Word entry with id '{word_entry_id}' not found",
        )

    # Authorization: system decks (owner_id=None) are accessible to all authenticated users
    # User-created decks require ownership
    if deck.owner_id is not None and deck.owner_id != current_user.id:
        raise ForbiddenException(detail="You don't have permission to access this word entry")

    return word_entry_to_response(word_entry)


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

    # 2. Load deck for authorization
    deck_repo = DeckRepository(db)
    deck = await deck_repo.get(word_entry.deck_id)

    if deck is None:
        raise NotFoundException(
            resource="WordEntry",
            detail=f"Word entry with id '{word_entry_id}' not found",
        )

    # 3. Authorization check (system decks accessible to all, user decks require ownership)
    if deck.owner_id is not None and deck.owner_id != current_user.id:
        raise ForbiddenException(detail="You don't have permission to access this word entry")

    # 4. Fetch card records and filter to active only
    card_record_repo = CardRecordRepository(db)
    card_records = await card_record_repo.get_by_word_entry(word_entry_id)
    active_cards = [cr for cr in card_records if cr.is_active]

    return [CardRecordResponse.model_validate(cr) for cr in active_cards]


@router.post(
    "/bulk",
    response_model=WordEntryBulkResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Bulk upload word entries",
    description="Upload multiple word entries to a deck with upsert behavior. "
    "Entries matching by lemma + part_of_speech are updated; new entries are created. "
    "Requires superuser privileges. Maximum 100 entries per request.",
    responses={
        201: {
            "description": "Word entries created/updated successfully",
            "content": {
                "application/json": {
                    "example": {
                        "deck_id": "550e8400-e29b-41d4-a716-446655440000",
                        "created_count": 2,
                        "updated_count": 1,
                        "word_entries": [
                            {
                                "id": "660e8400-e29b-41d4-a716-446655440001",
                                "deck_id": "550e8400-e29b-41d4-a716-446655440000",
                                "lemma": "spiti",
                                "part_of_speech": "noun",
                                "translation_en": "house, home",
                                "translation_ru": "dom",
                                "pronunciation": "/spí·ti/",
                                "grammar_data": {"gender": "neuter"},
                                "examples": [],
                                "audio_key": None,
                                "is_active": True,
                                "created_at": "2024-01-15T10:30:00Z",
                                "updated_at": "2024-01-15T10:30:00Z",
                            }
                        ],
                    }
                }
            },
        },
        404: {"description": "Deck not found"},
        422: {
            "description": "Validation error",
            "content": {
                "application/json": {
                    "examples": {
                        "empty_array": {
                            "summary": "Empty word entries array",
                            "value": {
                                "detail": [
                                    {
                                        "type": "value_error",
                                        "loc": ["body", "word_entries"],
                                        "msg": "List should have at least 1 item after validation, not 0",
                                    }
                                ]
                            },
                        },
                        "too_many_entries": {
                            "summary": "More than 100 entries",
                            "value": {
                                "detail": [
                                    {
                                        "type": "value_error",
                                        "loc": ["body", "word_entries"],
                                        "msg": "List should have at most 100 items after validation, not 150",
                                    }
                                ]
                            },
                        },
                        "duplicate_lemma_pos": {
                            "summary": "Duplicate lemma + part_of_speech",
                            "value": {
                                "detail": [
                                    {
                                        "type": "value_error",
                                        "loc": ["body"],
                                        "msg": "Value error, Duplicate entry for lemma 'spiti' with part_of_speech 'noun'",
                                    }
                                ]
                            },
                        },
                    }
                }
            },
        },
    },
)
async def bulk_upload_word_entries(
    request: WordEntryBulkRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> WordEntryBulkResponse:
    """Bulk upload word entries with upsert behavior.

    Requires superuser privileges.

    This endpoint performs an upsert operation:
    - Entries matching by (deck_id, lemma, part_of_speech) are UPDATED
    - New entries are CREATED

    The operation is atomic - all entries are processed in a single transaction.
    If any entry fails validation, the entire request is rejected.

    Args:
        request: Bulk upload request with deck_id and word_entries array
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Returns:
        WordEntryBulkResponse with created_count, updated_count, and all entries

    Raises:
        401: If not authenticated
        403: If authenticated but not superuser
        404: If deck doesn't exist
        422: If validation fails (empty array, >100 entries, duplicate lemma+pos, invalid data)
    """
    # Validate deck exists
    deck_repo = DeckRepository(db)
    deck = await deck_repo.get(request.deck_id)
    if deck is None:
        raise DeckNotFoundException(deck_id=str(request.deck_id))

    # Prepare entries data for repository
    entries_data = [entry.model_dump() for entry in request.word_entries]

    # Perform bulk upsert using repository
    word_entry_repo = WordEntryRepository(db)
    entries, created_count, updated_count = await word_entry_repo.bulk_upsert(
        deck_id=request.deck_id,
        entries_data=entries_data,
    )

    # Generate meaning cards for all upserted word entries
    card_gen = CardGeneratorService(db)
    meaning_created, meaning_updated = await card_gen.generate_meaning_cards(
        entries, request.deck_id
    )

    # Generate plural form cards for eligible noun entries
    plural_created, plural_updated = await card_gen.generate_plural_form_cards(
        entries, request.deck_id
    )

    # Generate sentence translation cards for entries with examples
    sentence_created, sentence_updated = await card_gen.generate_sentence_translation_cards(
        entries, request.deck_id
    )

    # Generate article cards for eligible noun entries
    article_created, article_updated = await card_gen.generate_article_cards(
        entries, request.deck_id
    )

    cards_created = meaning_created + plural_created + sentence_created + article_created
    cards_updated = meaning_updated + plural_updated + sentence_updated + article_updated

    # Commit the transaction
    await db.commit()

    if is_background_tasks_enabled():
        for entry in entries:
            background_tasks.add_task(
                generate_word_entry_audio_task,
                word_entry_id=entry.id,
                lemma=resolve_tts_text(entry.lemma, entry.part_of_speech.value, entry.grammar_data),
                examples=[
                    {"id": ex.get("id"), "greek": ex.get("greek")} for ex in (entry.examples or [])
                ],
                db_url=settings.database_url,
            )

    return WordEntryBulkResponse(
        deck_id=request.deck_id,
        created_count=created_count,
        updated_count=updated_count,
        cards_created=cards_created,
        cards_updated=cards_updated,
        word_entries=[word_entry_to_response(entry) for entry in entries],
    )
