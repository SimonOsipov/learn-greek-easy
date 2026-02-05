"""Word Entry API endpoints.

This module provides HTTP endpoints for word entry operations including:
- Bulk upload of word entries with upsert behavior (superuser only)
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_superuser
from src.core.exceptions import DeckNotFoundException
from src.db.dependencies import get_db
from src.db.models import User
from src.repositories.deck import DeckRepository
from src.repositories.word_entry import WordEntryRepository
from src.schemas.word_entry import WordEntryBulkRequest, WordEntryBulkResponse, WordEntryResponse

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
                                "pronunciation": "spiti",
                                "cefr_level": "A1",
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

    # Commit the transaction
    await db.commit()

    return WordEntryBulkResponse(
        deck_id=request.deck_id,
        created_count=created_count,
        updated_count=updated_count,
        word_entries=[WordEntryResponse.model_validate(entry) for entry in entries],
    )
