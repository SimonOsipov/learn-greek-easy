"""Admin API endpoints.

This module provides HTTP endpoints for admin operations including:
- Dashboard statistics (deck and card counts)
- Unified deck listing with search and pagination
- Feedback management (list and update)

All endpoints require superuser authentication.
"""

import asyncio
import json
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Any, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy import Select, delete, func, or_, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from starlette.responses import StreamingResponse

from src.config import settings
from src.core.dependencies import SSEAuthResult, get_current_superuser, get_sse_auth
from src.core.exceptions import (
    ConflictException,
    DeckNotFoundException,
    ElevenLabsAPIError,
    ElevenLabsAuthenticationError,
    ElevenLabsNotConfiguredError,
    ElevenLabsNoVoicesError,
    ElevenLabsRateLimitError,
    NotFoundException,
    NounGenerationError,
    OpenRouterError,
)
from src.core.logging import get_logger
from src.db.dependencies import get_db
from src.db.models import (
    AudioStatus,
    CardErrorCardType,
    CardErrorStatus,
    CardRecord,
    CultureDeck,
    CultureQuestion,
    Deck,
    DeckLevel,
    DeckWordEntry,
    DescriptionExercise,
    DescriptionStatus,
    DialogExercise,
    DialogLine,
    DialogSpeaker,
    DialogStatus,
    ExerciseItem,
    ExerciseModality,
    ExerciseSourceType,
    ExerciseStatus,
    ExerciseType,
    FeedbackCategory,
    FeedbackStatus,
    ListeningDialog,
    PartOfSpeech,
    PictureExercise,
    Situation,
    SituationDescription,
    SituationPicture,
    SituationStatus,
    User,
    UserXP,
    WiktionaryMorphology,
    WordEntry,
)
from src.db.session import get_session_factory
from src.repositories.deck import DeckRepository
from src.repositories.exercise import ExerciseRepository
from src.repositories.word_entry import WordEntryRepository
from src.schemas.admin import (
    AdminCultureQuestionItem,
    AdminCultureQuestionsResponse,
    AdminDeckListResponse,
    AdminStatsResponse,
    ArticleCheckResponse,
    DialogLineDetail,
    DialogSpeakerDetail,
    GenerateCardsRequest,
    GenerateCardsResponse,
    GenerateWordEntryRequest,
    GenerateWordEntryResponse,
    ListeningDialogCreateFromJSON,
    ListeningDialogDetail,
    ListeningDialogListItem,
    ListeningDialogListResponse,
    NormalizationStageResult,
    PendingQuestionItem,
    PendingQuestionsResponse,
    QuestionApproveRequest,
    QuestionApproveResponse,
    ReconcileDiffResponse,
    ReverseLookupItem,
    ReverseLookupResponse,
    SuggestionItem,
    TranslationLookupStageResult,
    TranslationSourceInfo,
    UnifiedDeckItem,
    WordEntryInlineUpdate,
)
from src.schemas.announcement import (
    AnnouncementCreate,
    AnnouncementCreateResponse,
    AnnouncementDetailResponse,
    AnnouncementListResponse,
    AnnouncementWithCreatorResponse,
    CreatorBriefResponse,
)
from src.schemas.card_error import (
    AdminCardErrorReportListResponse,
    AdminCardErrorReportResponse,
    AdminCardErrorReportUpdate,
    ReporterBriefResponse,
)
from src.schemas.changelog import (
    ChangelogAdminListResponse,
    ChangelogEntryAdminResponse,
    ChangelogEntryCreate,
    ChangelogEntryUpdate,
)
from src.schemas.deck import DeckAdminResponse
from src.schemas.feedback import (
    AdminFeedbackListResponse,
    AdminFeedbackResponse,
    AdminFeedbackUpdate,
    AuthorBriefResponse,
)
from src.schemas.news_item import NewsItemCreate, NewsItemResponse, NewsItemUpdate
from src.schemas.nlp import GeneratedNounData, NormalizedLemma, VerificationSummary
from src.schemas.situation import (
    AdminExerciseListItem,
    AdminExerciseListResponse,
    SituationCreate,
    SituationDetailResponse,
    SituationExerciseGroupResponse,
    SituationExerciseItemResponse,
    SituationExerciseResponse,
    SituationExercisesResponse,
    SituationListItem,
    SituationListResponse,
    SituationResponse,
    SituationUpdate,
)
from src.schemas.word_entry import (
    AdminWordEntryCreateRequest,
    AdminWordEntryCreateResponse,
    WordEntryResponse,
)
from src.services.announcement_service import AnnouncementService
from src.services.audio_generation_service import (
    AudioWithTimestampsResult,
    DialogInput,
    get_audio_generation_service,
)
from src.services.card_error_admin_service import CardErrorAdminService
from src.services.card_generator_service import CardGeneratorService
from src.services.changelog_service import ChangelogService
from src.services.cross_ai_verification_service import get_cross_ai_verification_service
from src.services.duplicate_detection_service import DuplicateDetectionService
from src.services.feedback_admin_service import FeedbackAdminService
from src.services.gamification import ReconcileMode
from src.services.gamification.reconciler import GamificationReconciler
from src.services.lemma_normalization_service import detect_article, get_lemma_normalization_service
from src.services.lexicon_service import LexiconEntry, LexiconService
from src.services.local_verification_service import get_local_verification_service
from src.services.news_item_service import NewsItemService
from src.services.noun_data_generation_service import get_noun_data_generation_service
from src.services.reverse_lookup_service import ReverseLookupService
from src.services.s3_service import (
    ALLOWED_DECK_IMAGE_CONTENT_TYPES,
    MAX_DECK_IMAGE_SIZE_BYTES,
    S3Service,
    get_s3_service,
)
from src.services.translation_service import TranslationLookupService
from src.services.verification_tier import compute_combined_tier_v2
from src.services.wiktionary_morphology_service import WiktionaryMorphologyService
from src.services.wiktionary_verification_service import WiktionaryVerificationService
from src.services.word_entry_response import word_entry_to_response
from src.tasks import create_announcement_notifications_task
from src.utils.greek_text import resolve_tts_text
from src.utils.sse import create_sse_response, format_sse_error, format_sse_event, sse_stream

logger = get_logger(__name__)

router = APIRouter(
    tags=["Admin"],
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        422: {"description": "Validation error"},
    },
)


def _sse_single_error(code: str, message: str) -> StreamingResponse:
    """Return an SSE response containing a single error event."""

    async def _gen() -> AsyncGenerator[str, None]:
        yield format_sse_error(code, message)

    return create_sse_response(_gen())


WORD_AUDIO_S3_PREFIX = "word-audio"
WORD_AUDIO_VOICE_ID = "n0vzWypeCK1NlWPVwhOc"


@router.get(
    "/stats",
    response_model=AdminStatsResponse,
    summary="Get admin dashboard statistics",
    description="Get content statistics including deck and card counts. Requires superuser privileges.",
    responses={
        200: {
            "description": "Admin statistics",
            "content": {
                "application/json": {
                    "example": {
                        "total_decks": 8,
                        "total_cards": 410,
                        "total_vocabulary_decks": 6,
                        "total_vocabulary_cards": 360,
                        "total_culture_decks": 2,
                        "total_culture_questions": 50,
                    }
                }
            },
        },
    },
)
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> AdminStatsResponse:
    """Get admin dashboard statistics.

    Returns content statistics for the admin dashboard including:
    - Total number of active decks (vocabulary + culture)
    - Total number of items (vocabulary cards + culture questions)
    - Breakdown by deck type

    Only active decks are included in the statistics.
    Only approved (non-pending) culture questions are counted.

    Args:
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Returns:
        AdminStatsResponse with deck and card counts

    Raises:
        401: If not authenticated
        403: If authenticated but not superuser
    """
    # Count active vocabulary decks
    deck_count_result = await db.execute(
        select(func.count(Deck.id)).where(Deck.is_active.is_(True))
    )
    total_vocabulary_decks = deck_count_result.scalar() or 0

    # Count active word entries in active vocabulary decks
    v2_word_count_result = await db.execute(
        select(func.count(WordEntry.id))
        .join(DeckWordEntry, DeckWordEntry.word_entry_id == WordEntry.id)
        .join(Deck, DeckWordEntry.deck_id == Deck.id)
        .where(Deck.is_active.is_(True))
        .where(WordEntry.is_active.is_(True))
    )
    total_vocabulary_cards = v2_word_count_result.scalar() or 0

    # Count active culture decks
    culture_deck_result = await db.execute(
        select(func.count(CultureDeck.id)).where(CultureDeck.is_active.is_(True))
    )
    total_culture_decks = culture_deck_result.scalar() or 0

    # Count approved questions in active culture decks
    culture_question_result = await db.execute(
        select(func.count(CultureQuestion.id))
        .join(CultureDeck, CultureQuestion.deck_id == CultureDeck.id)
        .where(CultureDeck.is_active.is_(True))
        .where(CultureQuestion.is_pending_review.is_(False))
    )
    total_culture_questions = culture_question_result.scalar() or 0

    return AdminStatsResponse(
        total_decks=total_vocabulary_decks + total_culture_decks,
        total_cards=total_vocabulary_cards + total_culture_questions,
        total_vocabulary_decks=total_vocabulary_decks,
        total_vocabulary_cards=total_vocabulary_cards,
        total_culture_decks=total_culture_decks,
        total_culture_questions=total_culture_questions,
    )


@router.get(
    "/decks",
    response_model=AdminDeckListResponse,
    summary="List all decks with search and pagination",
    description="Get a paginated list of all decks (vocabulary and culture) with optional search and filtering.",
    responses={
        200: {
            "description": "Paginated deck list",
            "content": {
                "application/json": {
                    "example": {
                        "decks": [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440000",
                                "name": "A1 Vocabulary",
                                "type": "vocabulary",
                                "level": "A1",
                                "category": None,
                                "item_count": 60,
                                "is_active": True,
                                "created_at": "2024-01-15T10:30:00Z",
                            }
                        ],
                        "total": 8,
                        "page": 1,
                        "page_size": 10,
                    }
                }
            },
        },
    },
)
async def list_decks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term for deck name"),
    type: Optional[str] = Query(
        None,
        description="Filter by type: 'vocabulary' or 'culture'",
        regex="^(vocabulary|culture)$",
    ),
) -> AdminDeckListResponse:
    """List all decks with search and pagination.

    Returns a paginated list of all decks (vocabulary and culture) with optional
    filtering by type and case-insensitive search by name.

    Args:
        db: Database session (injected)
        current_user: Authenticated superuser (injected)
        page: Page number (1-indexed)
        page_size: Number of items per page (max 100)
        search: Optional search term for deck name (case-insensitive)
        type: Optional filter by deck type ('vocabulary' or 'culture')

    Returns:
        AdminDeckListResponse with paginated deck list

    Raises:
        401: If not authenticated
        403: If authenticated but not superuser
    """
    unified_decks: list[UnifiedDeckItem] = []
    vocab_count = 0
    culture_count = 0

    # ========================================
    # Vocabulary Decks Query
    # ========================================
    if type is None or type == "vocabulary":
        # Count active word entries per vocabulary deck
        v2_word_count_subquery = (
            select(DeckWordEntry.deck_id, func.count(WordEntry.id).label("word_count"))
            .join(WordEntry, WordEntry.id == DeckWordEntry.word_entry_id)
            .where(WordEntry.is_active.is_(True))
            .group_by(DeckWordEntry.deck_id)
            .subquery()
        )

        vocab_query = (
            select(
                Deck.id,
                Deck.name_en.label("name"),
                Deck.level,
                Deck.is_active,
                Deck.is_premium,
                Deck.created_at,
                Deck.owner_id,
                Deck.cover_image_s3_key,
                User.full_name.label("owner_name"),
                func.coalesce(v2_word_count_subquery.c.word_count, 0).label("item_count"),
                # Trilingual fields for edit forms
                Deck.name_el,
                Deck.name_en,
                Deck.name_ru,
                Deck.description_el,
                Deck.description_en,
                Deck.description_ru,
            )
            .outerjoin(v2_word_count_subquery, Deck.id == v2_word_count_subquery.c.deck_id)
            .outerjoin(User, Deck.owner_id == User.id)
        )

        # Apply search filter (search across all language name fields)
        if search:
            vocab_query = vocab_query.where(
                Deck.name_en.ilike(f"%{search}%")
                | Deck.name_el.ilike(f"%{search}%")
                | Deck.name_ru.ilike(f"%{search}%")
            )

        # Get total count for vocabulary
        vocab_count_query = select(func.count()).select_from(vocab_query.subquery())
        vocab_count_result = await db.execute(vocab_count_query)
        vocab_count = vocab_count_result.scalar() or 0

        vocab_result = await db.execute(vocab_query.order_by(Deck.created_at.desc()))
        vocab_rows = vocab_result.all()

        s3 = get_s3_service()
        for row in vocab_rows:
            unified_decks.append(
                UnifiedDeckItem(
                    id=row.id,
                    name=row.name,
                    type="vocabulary",
                    level=row.level,
                    category=None,
                    item_count=row.item_count,
                    is_active=row.is_active,
                    is_premium=row.is_premium,
                    created_at=row.created_at,
                    owner_id=row.owner_id,
                    owner_name=row.owner_name,
                    # Trilingual fields for edit forms
                    name_el=row.name_el,
                    name_en=row.name_en,
                    name_ru=row.name_ru,
                    description_el=row.description_el,
                    description_en=row.description_en,
                    description_ru=row.description_ru,
                    cover_image_url=(
                        s3.generate_presigned_url(row.cover_image_s3_key)
                        if row.cover_image_s3_key
                        else None
                    ),
                )
            )

    # ========================================
    # Culture Decks Query
    # ========================================
    if type is None or type == "culture":
        # Count questions per culture deck
        culture_question_count_subquery = (
            select(
                CultureQuestion.deck_id,
                func.count(CultureQuestion.id).label("question_count"),
            )
            .group_by(CultureQuestion.deck_id)
            .subquery()
        )

        culture_query = select(
            CultureDeck.id,
            CultureDeck.name_en.label("name"),
            CultureDeck.category,
            CultureDeck.is_active,
            CultureDeck.is_premium,
            CultureDeck.created_at,
            func.coalesce(culture_question_count_subquery.c.question_count, 0).label("item_count"),
            # Trilingual fields for edit forms
            CultureDeck.name_el,
            CultureDeck.name_en,
            CultureDeck.name_ru,
            CultureDeck.description_el,
            CultureDeck.description_en,
            CultureDeck.description_ru,
            CultureDeck.cover_image_s3_key,
        ).outerjoin(
            culture_question_count_subquery,
            CultureDeck.id == culture_question_count_subquery.c.deck_id,
        )

        # Apply search filter (search across all language name fields)
        if search:
            culture_query = culture_query.where(
                CultureDeck.name_en.ilike(f"%{search}%")
                | CultureDeck.name_el.ilike(f"%{search}%")
                | CultureDeck.name_ru.ilike(f"%{search}%")
            )

        # Get total count for culture
        culture_count_query = select(func.count()).select_from(culture_query.subquery())
        culture_count_result = await db.execute(culture_count_query)
        culture_count = culture_count_result.scalar() or 0

        culture_result = await db.execute(culture_query.order_by(CultureDeck.created_at.desc()))
        culture_rows = culture_result.all()

        culture_s3 = get_s3_service()
        for row in culture_rows:
            culture_cover_url = (
                culture_s3.generate_presigned_url(row.cover_image_s3_key)
                if row.cover_image_s3_key
                else None
            )
            unified_decks.append(
                UnifiedDeckItem(
                    id=row.id,
                    name=row.name,
                    type="culture",
                    level=None,
                    category=row.category,
                    item_count=row.item_count,
                    is_active=row.is_active,
                    is_premium=row.is_premium,
                    created_at=row.created_at,
                    owner_id=None,
                    owner_name=None,
                    # Trilingual fields for edit forms
                    name_el=row.name_el,
                    name_en=row.name_en,
                    name_ru=row.name_ru,
                    description_el=row.description_el,
                    description_en=row.description_en,
                    description_ru=row.description_ru,
                    cover_image_url=culture_cover_url,
                )
            )

    # ========================================
    # Sort and Paginate Combined Results
    # ========================================
    # Sort by created_at DESC
    unified_decks.sort(key=lambda d: d.created_at, reverse=True)

    total = vocab_count + culture_count
    offset = (page - 1) * page_size
    paginated_decks = unified_decks[offset : offset + page_size]

    return AdminDeckListResponse(
        decks=paginated_decks,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/decks/{deck_id}/cover-image",
    response_model=DeckAdminResponse,
    summary="Upload deck cover image",
)
async def upload_deck_cover_image(
    deck_id: UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> DeckAdminResponse:
    """Upload or replace the cover image for a vocabulary deck."""
    if file.content_type not in ALLOWED_DECK_IMAGE_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid content type. Allowed: image/jpeg, image/png, image/webp",
        )
    data = await file.read()
    if len(data) > MAX_DECK_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail="File too large. Maximum size: 3MB",
        )
    deck_repo = DeckRepository(db)
    deck = await deck_repo.get(deck_id)
    if deck is None:
        raise DeckNotFoundException(str(deck_id))

    s3 = get_s3_service()
    ext = S3Service.get_extension_for_content_type(file.content_type) or "jpg"
    s3_key = f"deck-images/{deck_id}.{ext}"

    old_key = deck.cover_image_s3_key if deck.cover_image_s3_key != s3_key else None

    uploaded = s3.upload_object(s3_key, data, file.content_type)
    if not uploaded:
        raise HTTPException(status_code=500, detail="Failed to upload cover image")

    # Delete old key only after successful upload (avoid data loss if upload fails)
    if old_key:
        s3.delete_object(old_key)

    deck.cover_image_s3_key = s3_key
    await db.commit()
    await db.refresh(deck)

    cover_url = s3.generate_presigned_url(s3_key)
    card_count = await deck_repo.count_cards(deck_id)
    return DeckAdminResponse.model_validate(deck, from_attributes=True).model_copy(
        update={"cover_image_url": cover_url, "card_count": card_count}
    )


@router.delete(
    "/decks/{deck_id}/cover-image",
    response_model=DeckAdminResponse,
    summary="Delete deck cover image",
)
async def delete_deck_cover_image(
    deck_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> DeckAdminResponse:
    """Delete the cover image for a vocabulary deck."""
    deck_repo = DeckRepository(db)
    deck = await deck_repo.get(deck_id)
    if deck is None:
        raise DeckNotFoundException(str(deck_id))

    if deck.cover_image_s3_key is None:
        raise HTTPException(status_code=404, detail="Deck has no cover image")

    s3 = get_s3_service()
    deleted = s3.delete_object(deck.cover_image_s3_key)
    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete cover image")

    deck.cover_image_s3_key = None
    await db.commit()
    await db.refresh(deck)

    card_count = await deck_repo.count_cards(deck_id)
    return DeckAdminResponse.model_validate(deck, from_attributes=True).model_copy(
        update={"cover_image_url": None, "card_count": card_count}
    )


# ============================================================================
# Feedback Management Endpoints
# ============================================================================


@router.get(
    "/feedback",
    response_model=AdminFeedbackListResponse,
    summary="List all feedback for admin",
    description="Get a paginated list of all feedback with optional filtering. NEW status items are sorted first.",
    responses={
        200: {
            "description": "Paginated feedback list",
            "content": {
                "application/json": {
                    "example": {
                        "total": 15,
                        "page": 1,
                        "page_size": 10,
                        "items": [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440000",
                                "title": "Add dark mode",
                                "description": "Please add dark mode support...",
                                "category": "feature_request",
                                "status": "new",
                                "vote_count": 5,
                                "admin_response": None,
                                "admin_response_at": None,
                                "author": {
                                    "id": "660e8400-e29b-41d4-a716-446655440000",
                                    "full_name": "John Doe",
                                },
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
async def list_feedback(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    status_filter: Optional[FeedbackStatus] = Query(
        None, alias="status", description="Filter by status"
    ),
    category: Optional[FeedbackCategory] = Query(None, description="Filter by category"),
) -> AdminFeedbackListResponse:
    """List all feedback for admin with pagination and filters.

    Returns feedback sorted with NEW status items first, then by created_at DESC.

    Args:
        db: Database session (injected)
        current_user: Authenticated superuser (injected)
        page: Page number (1-indexed)
        page_size: Number of items per page (max 100)
        status_filter: Optional filter by feedback status
        category: Optional filter by feedback category

    Returns:
        AdminFeedbackListResponse with paginated feedback list

    Raises:
        401: If not authenticated
        403: If authenticated but not superuser
    """
    service = FeedbackAdminService(db)
    items, total = await service.get_feedback_list_for_admin(
        status=status_filter,
        category=category,
        page=page,
        page_size=page_size,
    )

    # Convert to response schema
    response_items = [
        AdminFeedbackResponse(
            id=item.id,
            title=item.title,
            description=item.description,
            category=item.category,
            status=item.status,
            vote_count=item.vote_count,
            admin_response=item.admin_response,
            admin_response_at=item.admin_response_at,
            author=AuthorBriefResponse(
                id=item.user.id,
                full_name=item.user.full_name,
            ),
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item in items
    ]

    return AdminFeedbackListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=response_items,
    )


@router.patch(
    "/feedback/{feedback_id}",
    response_model=AdminFeedbackResponse,
    summary="Update feedback status and/or admin response",
    description="Update feedback item with new status and/or admin response. If admin_response is provided without status and current status is NEW, it auto-changes to UNDER_REVIEW.",
    responses={
        200: {
            "description": "Updated feedback",
            "content": {
                "application/json": {
                    "example": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "title": "Add dark mode",
                        "description": "Please add dark mode support...",
                        "category": "feature_request",
                        "status": "under_review",
                        "vote_count": 5,
                        "admin_response": "Thank you for your feedback!",
                        "admin_response_at": "2024-01-16T14:00:00Z",
                        "author": {
                            "id": "660e8400-e29b-41d4-a716-446655440000",
                            "full_name": "John Doe",
                        },
                        "created_at": "2024-01-15T10:30:00Z",
                        "updated_at": "2024-01-16T14:00:00Z",
                    }
                }
            },
        },
        404: {"description": "Feedback not found"},
        422: {"description": "Validation error (empty update)"},
    },
)
async def update_feedback(
    feedback_id: UUID,
    update_data: AdminFeedbackUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> AdminFeedbackResponse:
    """Update feedback status and/or admin response.

    Business logic:
    - If admin_response is provided without status, and current status is NEW,
      status auto-changes to UNDER_REVIEW
    - admin_response_at timestamp is set when response is added/updated

    Args:
        feedback_id: ID of feedback to update
        update_data: Fields to update (status and/or admin_response)
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Returns:
        Updated AdminFeedbackResponse

    Raises:
        401: If not authenticated
        403: If authenticated but not superuser
        404: If feedback not found
        422: If neither status nor admin_response is provided
    """
    # Validate that at least one field is provided
    if update_data.status is None and update_data.admin_response is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one of 'status' or 'admin_response' must be provided",
        )

    service = FeedbackAdminService(db)

    try:
        feedback = await service.update_feedback_admin(
            feedback_id=feedback_id,
            status=update_data.status,
            admin_response=update_data.admin_response,
        )
    except ValueError:
        raise NotFoundException(
            resource="Feedback", detail=f"Feedback with ID '{feedback_id}' not found"
        )

    await db.commit()

    return AdminFeedbackResponse(
        id=feedback.id,
        title=feedback.title,
        description=feedback.description,
        category=feedback.category,
        status=feedback.status,
        vote_count=feedback.vote_count,
        admin_response=feedback.admin_response,
        admin_response_at=feedback.admin_response_at,
        author=AuthorBriefResponse(
            id=feedback.user.id,
            full_name=feedback.user.full_name,
        ),
        created_at=feedback.created_at,
        updated_at=feedback.updated_at,
    )


# ============================================================================
# Culture Question Review Endpoints
# ============================================================================


@router.get(
    "/culture/questions/check-article",
    response_model=ArticleCheckResponse,
    summary="Check if article URL is already used",
)
async def check_article_usage(
    url: str = Query(..., description="URL of the article to check"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> ArticleCheckResponse:
    """Check if an article URL has been used for question generation."""
    result = await db.execute(
        select(CultureQuestion.id).where(CultureQuestion.source_article_url == url)
    )
    question_id = result.scalar_one_or_none()

    return ArticleCheckResponse(
        used=question_id is not None,
        question_id=question_id,
    )


@router.get(
    "/culture/questions/pending",
    response_model=PendingQuestionsResponse,
    summary="List pending review questions",
)
async def list_pending_questions(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> PendingQuestionsResponse:
    """Get a paginated list of AI-generated questions awaiting admin review."""
    # Count total
    count_result = await db.execute(
        select(func.count(CultureQuestion.id)).where(CultureQuestion.is_pending_review.is_(True))
    )
    total = count_result.scalar() or 0

    # Get paginated results
    offset = (page - 1) * page_size
    result = await db.execute(
        select(CultureQuestion)
        .where(CultureQuestion.is_pending_review.is_(True))
        .order_by(CultureQuestion.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    questions = result.scalars().all()

    return PendingQuestionsResponse(
        questions=[
            PendingQuestionItem(
                id=q.id,
                question_text=q.question_text,
                option_a=q.option_a,
                option_b=q.option_b,
                option_c=q.option_c,
                option_d=q.option_d,
                correct_option=q.correct_option,
                source_article_url=q.source_article_url,
                created_at=q.created_at,
            )
            for q in questions
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/culture/questions/{question_id}",
    response_model=PendingQuestionItem,
    summary="Get a single pending question",
    responses={
        200: {"description": "Pending question details"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        404: {"description": "Question not found or not pending"},
    },
)
async def get_pending_question(
    question_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> PendingQuestionItem:
    """Get a single pending question by ID."""
    result = await db.execute(
        select(CultureQuestion).where(
            CultureQuestion.id == question_id,
            CultureQuestion.is_pending_review.is_(True),
        )
    )
    question = result.scalar_one_or_none()

    if not question:
        raise NotFoundException(
            resource="Question",
            detail=f"Pending question with ID '{question_id}' not found",
        )

    return PendingQuestionItem(
        id=question.id,
        question_text=question.question_text,
        option_a=question.option_a,
        option_b=question.option_b,
        option_c=question.option_c,
        option_d=question.option_d,
        correct_option=question.correct_option,
        source_article_url=question.source_article_url,
        created_at=question.created_at,
    )


@router.post(
    "/culture/questions/{question_id}/approve",
    response_model=QuestionApproveResponse,
    summary="Approve a pending question and assign to deck",
    responses={
        200: {"description": "Question approved successfully"},
        400: {"description": "Invalid deck_id or deck not active"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        404: {"description": "Question not found or already approved"},
    },
)
async def approve_question(
    question_id: UUID,
    request: QuestionApproveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> QuestionApproveResponse:
    """Approve a pending question and assign to a deck."""
    # Verify deck exists and is active
    deck_result = await db.execute(
        select(CultureDeck).where(
            CultureDeck.id == request.deck_id,
            CultureDeck.is_active.is_(True),
        )
    )
    deck = deck_result.scalar_one_or_none()
    if not deck:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid deck_id or deck is not active",
        )

    # Get question
    result = await db.execute(
        select(CultureQuestion).where(
            CultureQuestion.id == question_id,
            CultureQuestion.is_pending_review.is_(True),
        )
    )
    question = result.scalar_one_or_none()

    if not question:
        raise NotFoundException(
            resource="Question",
            detail=f"Pending question with ID '{question_id}' not found",
        )

    # Update question
    question.deck_id = request.deck_id
    question.is_pending_review = False

    await db.commit()

    return QuestionApproveResponse(
        id=question.id,
        deck_id=question.deck_id,
        is_pending_review=False,
        message="Question approved successfully",
    )


# ============================================================================
# Admin Deck Questions Endpoint
# ============================================================================


@router.get(
    "/culture/decks/{deck_id}/questions",
    response_model=AdminCultureQuestionsResponse,
    summary="List culture questions in a deck",
    description="Get a paginated list of all culture questions in a specific deck for admin management.",
    responses={
        200: {"description": "Paginated list of questions"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        404: {"description": "Deck not found"},
    },
)
async def list_deck_questions(
    deck_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, max_length=200),
    sort_by: str = Query("order_index", pattern="^(order_index|created_at)$"),
    sort_order: str = Query("asc", pattern="^(asc|desc)$"),
) -> AdminCultureQuestionsResponse:
    """List all culture questions in a deck for admin management.

    Returns a paginated list of all questions (not just active/approved) in the deck.
    Used for admin deck detail view to enable card/question deletion.

    Args:
        deck_id: UUID of the culture deck
        db: Database session (injected)
        current_user: Authenticated superuser (injected)
        page: Page number (1-indexed)
        page_size: Number of items per page (max 100)
        search: Optional search term to filter by question text
        sort_by: Field to sort by (order_index or created_at)
        sort_order: Sort direction (asc or desc)

    Returns:
        AdminCultureQuestionsResponse with paginated questions

    Raises:
        404: If deck not found
    """
    deck = await db.get(CultureDeck, deck_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    # Build base WHERE conditions
    base_conditions = [CultureQuestion.deck_id == deck_id]
    if search:
        search_term = f"%{search}%"
        base_conditions.append(
            or_(
                CultureQuestion.question_text.op("->>")("el").ilike(search_term),
                CultureQuestion.question_text.op("->>")("en").ilike(search_term),
                CultureQuestion.question_text.op("->>")("ru").ilike(search_term),
            )
        )

    # Count query
    count_query = select(func.count()).select_from(CultureQuestion).where(*base_conditions)
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Sort column
    sort_col = getattr(CultureQuestion, sort_by)
    order_expr = sort_col.asc() if sort_order == "asc" else sort_col.desc()

    # Data query
    data_query = (
        select(CultureQuestion)
        .where(*base_conditions)
        .order_by(order_expr)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(data_query)

    items = []
    for question in result.scalars().all():
        items.append(
            AdminCultureQuestionItem(
                id=question.id,
                question_text=question.question_text,
                option_a=question.option_a,
                option_b=question.option_b,
                option_c=question.option_c,
                option_d=question.option_d,
                correct_option=question.correct_option,
                source_article_url=question.source_article_url,
                is_pending_review=question.is_pending_review,
                audio_s3_key=question.audio_s3_key,
                original_article_url=question.original_article_url,
                order_index=question.order_index,
                created_at=question.created_at,
            )
        )

    return AdminCultureQuestionsResponse(
        questions=items,
        total=total,
        page=page,
        page_size=page_size,
        deck_id=deck_id,
    )


# ============================================================================
# News Admin Endpoints
# ============================================================================


@router.post(
    "/news",
    response_model=NewsItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create news item with optional question",
    description="Create a new news item, optionally with a linked culture question. Requires superuser privileges.",
    responses={
        201: {"description": "News item created successfully"},
        400: {"description": "Invalid request (image download failed)"},
        409: {"description": "News item with this URL already exists"},
    },
)
async def create_news_item(
    data: NewsItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> NewsItemResponse:
    """Create a new news item with optional question (admin only).

    Downloads the image from source_image_url, uploads to S3, and creates
    the news item in the database. If question data is provided, creates
    a linked CultureQuestion in the specified deck.

    Args:
        data: News item creation data with optional question
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Returns:
        NewsItemResponse with created news item

    Raises:
        400: If image download fails or question validation error
        409: If original_article_url already exists
    """
    service = NewsItemService(db)
    try:
        result: NewsItemResponse = await service.create(data)
    except ValueError as e:
        error_msg = str(e)
        if "already exists" in error_msg:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)
    return result


@router.put(
    "/news/{news_item_id}",
    response_model=NewsItemResponse,
    summary="Update news item",
    description="Update an existing news item. Requires superuser privileges.",
    responses={
        200: {"description": "News item updated successfully"},
        400: {"description": "Invalid request (image download failed, etc.)"},
        404: {"description": "News item not found"},
    },
)
async def update_news_item(
    news_item_id: UUID,
    data: NewsItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> NewsItemResponse:
    """Update an existing news item (admin only).

    If source_image_url is provided, downloads the new image and replaces
    the existing one in S3.

    Args:
        news_item_id: UUID of the news item to update
        data: Fields to update (all optional)
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Returns:
        Updated NewsItemResponse

    Raises:
        400: If new image download fails
        404: If news item not found
    """
    service = NewsItemService(db)
    try:
        result: NewsItemResponse = await service.update(news_item_id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return result


@router.delete(
    "/news/{news_item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete news item",
    description="Delete a news item and its S3 image. Requires superuser privileges.",
    responses={
        204: {"description": "News item deleted successfully"},
        404: {"description": "News item not found"},
    },
)
async def delete_news_item(
    news_item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> None:
    """Delete a news item and its S3 image (admin only).

    Args:
        news_item_id: UUID of the news item to delete
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Raises:
        404: If news item not found
    """
    service = NewsItemService(db)
    await service.delete(news_item_id)


# ============================================================================
# Announcement Admin Endpoints
# ============================================================================


@router.post(
    "/announcements",
    response_model=AnnouncementCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new announcement",
    description="Create a new announcement campaign and broadcast to all active users. Requires superuser privileges.",
    responses={
        201: {
            "description": "Announcement created successfully",
            "content": {
                "application/json": {
                    "example": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "title": "New Feature Released",
                        "total_recipients": 0,
                        "message": "Announcement created and notifications are being sent",
                    }
                }
            },
        },
        400: {"description": "Invalid request"},
        422: {"description": "Validation error"},
    },
)
async def create_announcement(
    data: AnnouncementCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> AnnouncementCreateResponse:
    """Create a new announcement campaign (admin only).

    Creates an announcement campaign record and schedules background task
    to create notification records for all active users.

    Args:
        data: Announcement creation data (title, message, optional link)
        background_tasks: FastAPI background tasks handler
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Returns:
        AnnouncementCreateResponse with campaign ID and initial stats

    Raises:
        400: If creation fails
        422: If validation fails
    """
    service = AnnouncementService(db)

    # Create the campaign
    campaign = await service.create_campaign(
        title=data.title,
        message=data.message,
        created_by=current_user.id,
        link_url=data.link_url,
    )

    # Commit the transaction before scheduling background task
    await db.commit()

    # Schedule background task to create notifications for all users
    background_tasks.add_task(
        create_announcement_notifications_task,
        campaign_id=campaign.id,
        campaign_title=campaign.title,
        campaign_message=campaign.message,
        link_url=campaign.link_url,
        db_url=settings.database_url,
    )

    logger.info(
        "Announcement campaign created, notifications scheduled",
        extra={
            "campaign_id": str(campaign.id),
            "created_by": str(current_user.id),
            "title": campaign.title[:50],
        },
    )

    return AnnouncementCreateResponse(
        id=campaign.id,
        title=campaign.title,
        total_recipients=campaign.total_recipients,
    )


@router.get(
    "/announcements",
    response_model=AnnouncementListResponse,
    summary="List all announcements",
    description="Get a paginated list of all announcement campaigns. Requires superuser privileges.",
    responses={
        200: {
            "description": "Paginated announcement list",
            "content": {
                "application/json": {
                    "example": {
                        "total": 5,
                        "page": 1,
                        "page_size": 20,
                        "items": [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440000",
                                "title": "New Feature Released",
                                "message": "We've added new vocabulary decks!",
                                "link_url": "https://example.com/features",
                                "total_recipients": 150,
                                "read_count": 75,
                                "created_at": "2024-01-15T10:30:00Z",
                                "creator": {
                                    "id": "660e8400-e29b-41d4-a716-446655440000",
                                    "display_name": "Admin User",
                                },
                            }
                        ],
                    }
                }
            },
        },
    },
)
async def list_announcements(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
) -> AnnouncementListResponse:
    """List all announcement campaigns with pagination (admin only).

    Returns a paginated list of all announcements with creator info.

    Args:
        db: Database session (injected)
        current_user: Authenticated superuser (injected)
        page: Page number (1-indexed)
        page_size: Number of items per page (max 100)

    Returns:
        AnnouncementListResponse with paginated campaign list

    Raises:
        401: If not authenticated
        403: If authenticated but not superuser
    """
    service = AnnouncementService(db)
    campaigns, total = await service.get_campaign_list(page=page, page_size=page_size)

    # Convert to response schema with creator info
    items = [
        AnnouncementWithCreatorResponse(
            id=campaign.id,
            title=campaign.title,
            message=campaign.message,
            link_url=campaign.link_url,
            total_recipients=campaign.total_recipients,
            read_count=campaign.read_count,
            created_at=campaign.created_at,
            creator=(
                CreatorBriefResponse(
                    id=campaign.creator.id,
                    display_name=campaign.creator.full_name,
                )
                if campaign.creator
                else None
            ),
        )
        for campaign in campaigns
    ]

    return AnnouncementListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=items,
    )


@router.get(
    "/announcements/{announcement_id}",
    response_model=AnnouncementDetailResponse,
    summary="Get announcement details",
    description="Get detailed information about a specific announcement including read statistics. Requires superuser privileges.",
    responses={
        200: {
            "description": "Announcement details with read stats",
            "content": {
                "application/json": {
                    "example": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "title": "New Feature Released",
                        "message": "We've added new vocabulary decks!",
                        "link_url": "https://example.com/features",
                        "total_recipients": 150,
                        "read_count": 75,
                        "read_percentage": 50.0,
                        "created_at": "2024-01-15T10:30:00Z",
                        "creator": {
                            "id": "660e8400-e29b-41d4-a716-446655440000",
                            "display_name": "Admin User",
                        },
                    }
                }
            },
        },
        404: {"description": "Announcement not found"},
    },
)
async def get_announcement(
    announcement_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> AnnouncementDetailResponse:
    """Get announcement details with read statistics (admin only).

    Refreshes the read count from notifications table and returns
    detailed campaign information including read percentage.

    Args:
        announcement_id: UUID of the announcement campaign
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Returns:
        AnnouncementDetailResponse with full campaign details and stats

    Raises:
        401: If not authenticated
        403: If authenticated but not superuser
        404: If announcement not found
    """
    service = AnnouncementService(db)

    # Refresh read count from notifications table
    await service.refresh_read_count(announcement_id)
    await db.commit()

    # Get campaign with updated stats
    campaign = await service.get_campaign(announcement_id)

    if not campaign:
        raise NotFoundException(
            resource="Announcement",
            detail=f"Announcement with ID '{announcement_id}' not found",
        )

    # Calculate read percentage
    read_percentage = service.calculate_read_percentage(
        total_recipients=campaign.total_recipients,
        read_count=campaign.read_count,
    )

    return AnnouncementDetailResponse(
        id=campaign.id,
        title=campaign.title,
        message=campaign.message,
        link_url=campaign.link_url,
        total_recipients=campaign.total_recipients,
        read_count=campaign.read_count,
        read_percentage=read_percentage,
        created_at=campaign.created_at,
        creator=(
            CreatorBriefResponse(
                id=campaign.creator.id,
                display_name=campaign.creator.full_name,
            )
            if campaign.creator
            else None
        ),
    )


@router.delete(
    "/announcements/{announcement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete announcement campaign",
    description="Delete an announcement campaign. Already-sent notifications are NOT recalled. Requires superuser privileges.",
    responses={
        204: {"description": "Announcement deleted successfully"},
        404: {"description": "Announcement not found"},
    },
)
async def delete_announcement(
    announcement_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> None:
    """Delete an announcement campaign (admin only).

    Args:
        announcement_id: UUID of the announcement to delete
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Raises:
        404: If announcement not found
    """
    service = AnnouncementService(db)
    await service.delete_campaign(announcement_id)


# ============================================================================
# Changelog Admin Endpoints
# ============================================================================


@router.get(
    "/changelog",
    response_model=ChangelogAdminListResponse,
    summary="List all changelog entries (admin)",
    description="Get a paginated list of all changelog entries with all languages. Requires superuser privileges.",
)
async def admin_list_changelog(
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=10, ge=1, le=50, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> ChangelogAdminListResponse:
    """Get all changelog entries with all language fields for admin management."""
    service = ChangelogService(db)
    return await service.get_admin_list(page=page, page_size=page_size)


@router.get(
    "/changelog/{entry_id}",
    response_model=ChangelogEntryAdminResponse,
    summary="Get single changelog entry (admin)",
    description="Get a single changelog entry with all languages. Requires superuser privileges.",
)
async def admin_get_changelog(
    entry_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> ChangelogEntryAdminResponse:
    """Get a single changelog entry with all fields."""
    service = ChangelogService(db)
    return await service.get_by_id(entry_id)


@router.post(
    "/changelog",
    response_model=ChangelogEntryAdminResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create changelog entry",
    description="Create a new changelog entry with multilingual content. Requires superuser privileges.",
)
async def admin_create_changelog(
    data: ChangelogEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> ChangelogEntryAdminResponse:
    """Create a new changelog entry. All language fields required."""
    service = ChangelogService(db)
    return await service.create(data)


@router.put(
    "/changelog/{entry_id}",
    response_model=ChangelogEntryAdminResponse,
    summary="Update changelog entry",
    description="Update an existing changelog entry. All fields optional. Requires superuser privileges.",
)
async def admin_update_changelog(
    entry_id: UUID,
    data: ChangelogEntryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> ChangelogEntryAdminResponse:
    """Update an existing changelog entry. Only provided fields are updated."""
    service = ChangelogService(db)
    return await service.update(entry_id, data)


@router.delete(
    "/changelog/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete changelog entry",
    description="Delete a changelog entry permanently. Requires superuser privileges.",
)
async def admin_delete_changelog(
    entry_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> None:
    """Delete a changelog entry permanently."""
    service = ChangelogService(db)
    await service.delete(entry_id)


# ============================================================================
# Card Error Admin Endpoints
# ============================================================================


@router.get(
    "/card-errors",
    response_model=AdminCardErrorReportListResponse,
    summary="List card error reports for admin",
    description="Get paginated list of all card error reports with filters. PENDING status items are sorted first.",
    responses={
        200: {
            "description": "Paginated card error report list",
            "content": {
                "application/json": {
                    "example": {
                        "total": 15,
                        "page": 1,
                        "page_size": 20,
                        "items": [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440000",
                                "card_id": "660e8400-e29b-41d4-a716-446655440001",
                                "card_type": "WORD",
                                "user_id": "770e8400-e29b-41d4-a716-446655440002",
                                "description": "Typo in translation...",
                                "status": "PENDING",
                                "admin_notes": None,
                                "resolved_by": None,
                                "resolved_at": None,
                                "reporter": {
                                    "id": "770e8400-e29b-41d4-a716-446655440002",
                                    "full_name": "John Doe",
                                },
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
async def list_card_errors(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    status_filter: Optional[CardErrorStatus] = Query(
        None, alias="status", description="Filter by status"
    ),
    card_type: Optional[CardErrorCardType] = Query(None, description="Filter by card type"),
) -> AdminCardErrorReportListResponse:
    """List all card error reports for admin with pagination and filters.

    Returns reports sorted with PENDING status items first, then by created_at DESC.

    Args:
        db: Database session (injected)
        current_user: Authenticated superuser (injected)
        page: Page number (1-indexed)
        page_size: Number of items per page (max 100)
        status_filter: Optional filter by report status
        card_type: Optional filter by card type (WORD or CULTURE)

    Returns:
        AdminCardErrorReportListResponse with paginated report list

    Raises:
        401: If not authenticated
        403: If authenticated but not superuser
    """
    service = CardErrorAdminService(db)
    items, total = await service.get_list_for_admin(
        status=status_filter,
        card_type=card_type,
        page=page,
        page_size=page_size,
    )

    # Convert to response schema with null-safe reporter mapping
    response_items = [
        AdminCardErrorReportResponse(
            id=item.id,
            card_id=item.card_id,
            card_type=item.card_type,
            user_id=item.user_id,
            description=item.description,
            status=item.status,
            admin_notes=item.admin_notes,
            resolved_by=item.resolved_by,
            resolved_at=item.resolved_at,
            reporter=(
                ReporterBriefResponse(
                    id=item.user.id,
                    full_name=item.user.full_name,
                )
                if item.user
                else ReporterBriefResponse(id=item.user_id, full_name=None)
            ),
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item in items
    ]

    return AdminCardErrorReportListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=response_items,
    )


@router.get(
    "/card-errors/{report_id}",
    response_model=AdminCardErrorReportResponse,
    summary="Get card error report details",
    description="Get detailed view of a single card error report.",
    responses={
        200: {
            "description": "Card error report details",
            "content": {
                "application/json": {
                    "example": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "card_id": "660e8400-e29b-41d4-a716-446655440001",
                        "card_type": "WORD",
                        "user_id": "770e8400-e29b-41d4-a716-446655440002",
                        "description": "Typo in translation...",
                        "status": "PENDING",
                        "admin_notes": None,
                        "resolved_by": None,
                        "resolved_at": None,
                        "reporter": {
                            "id": "770e8400-e29b-41d4-a716-446655440002",
                            "full_name": "John Doe",
                        },
                        "created_at": "2024-01-15T10:30:00Z",
                        "updated_at": "2024-01-15T10:30:00Z",
                    }
                }
            },
        },
        404: {"description": "Report not found"},
    },
)
async def get_card_error(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> AdminCardErrorReportResponse:
    """Get detailed card error report by ID.

    Args:
        report_id: UUID of the error report
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Returns:
        AdminCardErrorReportResponse with full report details

    Raises:
        401: If not authenticated
        403: If authenticated but not superuser
        404: If report not found
    """
    service = CardErrorAdminService(db)
    report = await service.get_report_for_admin(report_id)

    # Map to response with null-safe reporter
    return AdminCardErrorReportResponse(
        id=report.id,
        card_id=report.card_id,
        card_type=report.card_type,
        user_id=report.user_id,
        description=report.description,
        status=report.status,
        admin_notes=report.admin_notes,
        resolved_by=report.resolved_by,
        resolved_at=report.resolved_at,
        reporter=(
            ReporterBriefResponse(
                id=report.user.id,
                full_name=report.user.full_name,
            )
            if report.user
            else ReporterBriefResponse(id=report.user_id, full_name=None)
        ),
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


@router.patch(
    "/card-errors/{report_id}",
    response_model=AdminCardErrorReportResponse,
    summary="Update card error report",
    description="Update card error report status and/or admin notes. At least one field must be provided.",
    responses={
        200: {
            "description": "Updated card error report",
            "content": {
                "application/json": {
                    "example": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "card_id": "660e8400-e29b-41d4-a716-446655440001",
                        "card_type": "WORD",
                        "user_id": "770e8400-e29b-41d4-a716-446655440002",
                        "description": "Typo in translation...",
                        "status": "FIXED",
                        "admin_notes": "Fixed in version 2.3.1",
                        "resolved_by": "880e8400-e29b-41d4-a716-446655440003",
                        "resolved_at": "2024-01-16T14:00:00Z",
                        "reporter": {
                            "id": "770e8400-e29b-41d4-a716-446655440002",
                            "full_name": "John Doe",
                        },
                        "created_at": "2024-01-15T10:30:00Z",
                        "updated_at": "2024-01-16T14:00:00Z",
                    }
                }
            },
        },
        404: {"description": "Report not found"},
        422: {"description": "Validation error (empty update)"},
    },
)
async def update_card_error(
    report_id: UUID,
    update_data: AdminCardErrorReportUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> AdminCardErrorReportResponse:
    """Update card error report status and/or admin notes.

    Business logic:
    - At least one field (status or admin_notes) must be provided
    - When status changes to FIXED/REVIEWED/DISMISSED, sets resolved_by and resolved_at
    - When status changes back to PENDING, clears resolved_by and resolved_at

    Args:
        report_id: UUID of the report to update
        update_data: Fields to update (status and/or admin_notes)
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Returns:
        Updated AdminCardErrorReportResponse

    Raises:
        401: If not authenticated
        403: If authenticated but not superuser
        404: If report not found
        422: If neither status nor admin_notes is provided
    """
    # Validate that at least one field is provided
    if update_data.status is None and update_data.admin_notes is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one of 'status' or 'admin_notes' must be provided",
        )

    service = CardErrorAdminService(db)
    report = await service.update_report_for_admin(
        report_id=report_id,
        admin_user_id=current_user.id,
        data=update_data,
    )

    # Commit the transaction
    await db.commit()

    # Map to response with null-safe reporter
    return AdminCardErrorReportResponse(
        id=report.id,
        card_id=report.card_id,
        card_type=report.card_type,
        user_id=report.user_id,
        description=report.description,
        status=report.status,
        admin_notes=report.admin_notes,
        resolved_by=report.resolved_by,
        resolved_at=report.resolved_at,
        reporter=(
            ReporterBriefResponse(
                id=report.user.id,
                full_name=report.user.full_name,
            )
            if report.user
            else ReporterBriefResponse(id=report.user_id, full_name=None)
        ),
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


# ============================================================================
# Word Entry Inline Edit Endpoint
# ============================================================================


@router.patch(
    "/word-entries/{word_entry_id}",
    response_model=WordEntryResponse,
    summary="Update word entry inline fields",
    description="Partial update of word entry for admin inline editing.",
)
async def update_word_entry_inline(
    word_entry_id: UUID,
    update_data: WordEntryInlineUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> WordEntryResponse:
    repo = WordEntryRepository(db)
    word_entry = await repo.get(word_entry_id)
    if word_entry is None:
        raise NotFoundException(detail=f"Word entry {word_entry_id} not found")

    provided = update_data.model_dump(exclude_unset=True)
    grammar_data = provided.pop("grammar_data", None)
    examples = provided.pop("examples", None)

    for field, value in provided.items():
        setattr(word_entry, field, value)

    if grammar_data is not None:
        word_entry.grammar_data = grammar_data

    if examples is not None:
        existing_by_id = {ex["id"]: ex for ex in (word_entry.examples or []) if "id" in ex}
        merged = []
        for ex_update in examples:
            ex_dict = ex_update if isinstance(ex_update, dict) else ex_update.model_dump()
            existing = existing_by_id.get(ex_dict["id"], {})
            merged_ex = {**existing, **{k: v for k, v in ex_dict.items() if v is not None}}
            merged.append(merged_ex)
        word_entry.examples = merged

    await db.commit()
    await db.refresh(word_entry)

    logger.info(
        "Word entry updated inline",
        extra={
            "word_entry_id": str(word_entry_id),
            "updated_fields": list(update_data.model_dump(exclude_unset=True).keys()),
            "triggered_by": str(current_user.id),
        },
    )
    return word_entry_to_response(word_entry)


async def _word_audio_set_examples_generating(
    session: Any,
    word_entry_id: UUID,
    examples_data: list[dict],
) -> None:
    """Set generating status on all examples in the JSONB array."""
    gen_since = datetime.now(timezone.utc).isoformat()
    for example in examples_data:
        ex_patch = json.dumps({"audio_status": "generating", "audio_generating_since": gen_since})
        await session.execute(
            text(
                """
                UPDATE word_entries
                SET examples = (
                    SELECT coalesce(json_agg(
                        CASE
                            WHEN elem->>'id' = :example_id
                            THEN (elem || CAST(:patch AS jsonb))
                            ELSE elem
                        END
                        ORDER BY ordinality
                    ), '[]'::json)
                    FROM jsonb_array_elements(examples::jsonb)
                        WITH ORDINALITY AS arr(elem, ordinality)
                ), updated_at = NOW()
                WHERE id = :word_entry_id AND examples IS NOT NULL
            """
            ),
            {
                "example_id": example["id"],
                "patch": ex_patch,
                "word_entry_id": str(word_entry_id),
            },
        )


async def _word_audio_persist_ready(
    factory: Any,
    word_entry_id: UUID,
    part_name: str,
    example_id: str | None,
    s3_key: str,
) -> None:
    """Persist a successfully processed audio part to the database."""
    async with factory.begin() as session:
        if part_name == "lemma":
            await session.execute(
                text(
                    """
                    UPDATE word_entries
                    SET audio_key = :s3_key,
                        audio_status = 'READY'::audiostatus,
                        audio_generating_since = NULL,
                        updated_at = NOW()
                    WHERE id = :word_entry_id
                """
                ),
                {"s3_key": s3_key, "word_entry_id": str(word_entry_id)},
            )
        else:
            ex_patch = json.dumps({"audio_key": s3_key, "audio_status": "ready"})
            await session.execute(
                text(
                    """
                    UPDATE word_entries
                    SET examples = (
                        SELECT coalesce(json_agg(
                            CASE
                                WHEN elem->>'id' = :example_id
                                THEN (elem - 'audio_generating_since') || CAST(:patch AS jsonb)
                                ELSE elem
                            END
                            ORDER BY ordinality
                        ), '[]'::json)
                        FROM jsonb_array_elements(examples::jsonb)
                            WITH ORDINALITY AS arr(elem, ordinality)
                    ), updated_at = NOW()
                    WHERE id = :word_entry_id AND examples IS NOT NULL
                """
                ),
                {
                    "example_id": example_id,
                    "patch": ex_patch,
                    "word_entry_id": str(word_entry_id),
                },
            )


async def _word_audio_persist_failed(
    factory: Any,
    word_entry_id: UUID,
    part_name: str,
    example_id: str | None,
) -> None:
    """Persist a failed audio part status to the database (best-effort)."""
    async with factory.begin() as session:
        if part_name == "lemma":
            await session.execute(
                text(
                    """
                    UPDATE word_entries
                    SET audio_status = 'FAILED'::audiostatus,
                        audio_generating_since = NULL,
                        updated_at = NOW()
                    WHERE id = :word_entry_id
                """
                ),
                {"word_entry_id": str(word_entry_id)},
            )
        else:
            ex_patch = json.dumps({"audio_status": "failed"})
            await session.execute(
                text(
                    """
                    UPDATE word_entries
                    SET examples = (
                        SELECT coalesce(json_agg(
                            CASE
                                WHEN elem->>'id' = :example_id
                                THEN (elem - 'audio_generating_since') || CAST(:patch AS jsonb)
                                ELSE elem
                            END
                            ORDER BY ordinality
                        ), '[]'::json)
                        FROM jsonb_array_elements(examples::jsonb)
                            WITH ORDINALITY AS arr(elem, ordinality)
                    ), updated_at = NOW()
                    WHERE id = :word_entry_id AND examples IS NOT NULL
                """
                ),
                {
                    "example_id": example_id,
                    "patch": ex_patch,
                    "word_entry_id": str(word_entry_id),
                },
            )


async def _word_audio_sse_pipeline(
    word_entry_id: UUID,
) -> AsyncGenerator[str, None]:
    """SSE pipeline for word entry audio generation.

    Generates TTS audio for the word entry lemma and all examples,
    uploading each to S3 and persisting the audio key to the database.
    Emits SSE events for each stage of the pipeline per part.
    """
    yield format_sse_event("", event="connected")

    factory = get_session_factory()

    # Stage 1: Load word entry and set GENERATING status (single session)
    async with factory.begin() as session:
        result = await session.execute(select(WordEntry).where(WordEntry.id == word_entry_id))
        word_entry = result.scalar_one_or_none()
        if word_entry is None:
            yield format_sse_event(
                {
                    "stage": "load",
                    "error": "Word entry not found",
                    "word_entry_id": str(word_entry_id),
                },
                event="word_audio:error",
            )
            return

        # Extract plain Python values before session closes
        lemma = word_entry.lemma
        part_of_speech_value = word_entry.part_of_speech.value if word_entry.part_of_speech else ""
        grammar_data = word_entry.grammar_data
        examples_data = [
            {"id": ex["id"], "greek": ex["greek"]}
            for ex in (word_entry.examples or [])
            if ex.get("id") and ex.get("greek")
        ]

        # Build parts list: lemma first, then examples
        parts = [{"part": "lemma", "example_id": None}] + [
            {"part": "example", "example_id": ex["id"]} for ex in examples_data
        ]

        # Set GENERATING status on word entry
        await session.execute(
            update(WordEntry)
            .where(WordEntry.id == word_entry_id)
            .values(
                audio_status=AudioStatus.GENERATING,
                audio_generating_since=datetime.now(timezone.utc),
            )
        )

        # Set generating status on examples in JSONB array
        if examples_data:
            await _word_audio_set_examples_generating(session, word_entry_id, examples_data)

    yield format_sse_event(
        {"word_entry_id": str(word_entry_id), "part_count": len(parts)},
        event="word_audio:start",
    )

    # Stage 2: Per-part TTS + S3 upload + DB persist loop
    audio_service = get_audio_generation_service()
    parts_completed = 0

    for part_index, part_info in enumerate(parts):
        part_name = part_info["part"]  # "lemma" or "example"
        example_id = part_info["example_id"]  # None for lemma
        current_stage = "tts"

        try:
            yield format_sse_event(
                {
                    "part": part_name,
                    "example_id": example_id,
                    "part_index": part_index,
                    "total_parts": len(parts),
                },
                event="word_audio:tts",
            )

            # Resolve TTS text
            if part_name == "lemma":
                tts_text = resolve_tts_text(lemma, part_of_speech_value, grammar_data)
            else:
                tts_text = next(ex["greek"] for ex in examples_data if ex["id"] == example_id)

            # Compute S3 key
            s3_key = (
                f"{WORD_AUDIO_S3_PREFIX}/{word_entry_id}.mp3"
                if part_name == "lemma"
                else f"{WORD_AUDIO_S3_PREFIX}/{word_entry_id}/{example_id}.mp3"
            )

            async def _on_progress(stage: str, **_kwargs: object) -> None:
                nonlocal current_stage
                current_stage = stage

            audio_result = await audio_service.generate_single(
                text=tts_text,
                s3_key=s3_key,
                voice_id=WORD_AUDIO_VOICE_ID,
                on_progress=_on_progress,
            )

            current_stage = "persist"
            yield format_sse_event(
                {"part": part_name, "example_id": example_id, "s3_key": audio_result.s3_key},
                event="word_audio:upload",
            )
            yield format_sse_event(
                {"part": part_name, "example_id": example_id},
                event="word_audio:persist",
            )

            await _word_audio_persist_ready(
                factory, word_entry_id, part_name, example_id, audio_result.s3_key
            )

            parts_completed += 1
            yield format_sse_event(
                {
                    "part": part_name,
                    "example_id": example_id,
                    "part_index": part_index,
                    "total_parts": len(parts),
                },
                event="word_audio:part_complete",
            )

        except Exception as exc:
            # Per-part error: set FAILED in DB, emit error event, continue to next part
            try:
                await _word_audio_persist_failed(factory, word_entry_id, part_name, example_id)
            except Exception:
                pass  # Best-effort DB update on error path

            yield format_sse_event(
                {
                    "part": part_name,
                    "example_id": example_id,
                    "stage": current_stage,
                    "error": str(exc),
                    "word_entry_id": str(word_entry_id),
                },
                event="word_audio:error",
            )
            continue  # CRITICAL: continue to next part

    yield format_sse_event(
        {"word_entry_id": str(word_entry_id), "parts_completed": parts_completed},
        event="word_audio:complete",
    )


@router.post(
    "/word-entries/{word_entry_id}/generate-audio/stream",
    summary="Generate word entry audio via ElevenLabs TTS as SSE stream",
    response_class=StreamingResponse,
)
async def generate_word_entry_audio_stream(
    word_entry_id: UUID,
    sse_auth: SSEAuthResult = Depends(get_sse_auth),
) -> StreamingResponse:
    """Stream word entry audio generation pipeline stages as SSE events."""
    if not sse_auth.is_authenticated:
        return _sse_single_error(
            sse_auth.error_code or "auth_required",
            sse_auth.error_message or "Authentication required",
        )
    assert sse_auth.user is not None
    if not sse_auth.user.is_superuser:
        return _sse_single_error("forbidden", "Admin access required")
    if not settings.elevenlabs_configured:
        return _sse_single_error("service_unavailable", "ElevenLabs is not configured")
    return create_sse_response(
        sse_stream(_word_audio_sse_pipeline(word_entry_id), heartbeat_interval=15)
    )


async def _culture_question_audio_sse_pipeline(
    question_id: UUID,
) -> AsyncGenerator[str, None]:
    """SSE pipeline for culture question audio generation."""
    yield format_sse_event("", event="connected")
    factory = get_session_factory()

    # Stage 1 — Load & validate
    async with factory.begin() as session:
        result = await session.execute(
            select(CultureQuestion).where(CultureQuestion.id == question_id)
        )
        question = result.scalar_one_or_none()
        if question is None:
            yield format_sse_event(
                {
                    "question_id": str(question_id),
                    "stage": "load",
                    "error": "Culture question not found",
                },
                event="culture_audio:error",
            )
            return
        question_text: dict = question.question_text or {}

    greek_text = question_text.get("el", "").strip()
    if not greek_text:
        yield format_sse_event(
            {
                "question_id": str(question_id),
                "stage": "load",
                "error": "Question has no Greek text for audio generation",
            },
            event="culture_audio:error",
        )
        return

    yield format_sse_event(
        {"question_id": str(question_id), "text_length": len(greek_text)},
        event="culture_audio:start",
    )

    current_stage = "tts"
    try:
        # Stage 2 — TTS + upload
        audio_service = get_audio_generation_service()
        s3_key = f"culture/audio/{question_id}.mp3"
        yield format_sse_event(
            {"question_id": str(question_id)},
            event="culture_audio:tts",
        )

        async def _on_progress_cq(stage: str, **kwargs: Any) -> None:
            nonlocal current_stage
            current_stage = stage

        await audio_service.generate_single(
            text=greek_text,
            s3_key=s3_key,
            on_progress=_on_progress_cq,
        )

        yield format_sse_event(
            {"question_id": str(question_id), "s3_key": s3_key},
            event="culture_audio:upload",
        )

        # Stage 4 — DB persist
        current_stage = "persist"
        yield format_sse_event(
            {"question_id": str(question_id)},
            event="culture_audio:persist",
        )
        async with factory.begin() as session:
            await session.execute(
                update(CultureQuestion)
                .where(CultureQuestion.id == question_id)
                .values(audio_s3_key=s3_key)
            )

        # Stage 5 — Complete
        yield format_sse_event(
            {"question_id": str(question_id), "s3_key": s3_key},
            event="culture_audio:complete",
        )

    except Exception as exc:
        yield format_sse_event(
            {
                "question_id": str(question_id),
                "stage": current_stage,
                "error": str(exc),
            },
            event="culture_audio:error",
        )


@router.post(
    "/culture-questions/{question_id}/generate-audio/stream",
    summary="Generate culture question audio via ElevenLabs TTS as SSE stream",
    response_class=StreamingResponse,
)
async def generate_culture_question_audio_stream(
    question_id: UUID,
    sse_auth: SSEAuthResult = Depends(get_sse_auth),
) -> StreamingResponse:
    if not sse_auth.is_authenticated:
        return _sse_single_error(
            sse_auth.error_code or "auth_required",
            sse_auth.error_message or "Authentication required",
        )
    assert sse_auth.user is not None
    if not sse_auth.user.is_superuser:
        return _sse_single_error("forbidden", "Admin access required")
    if not settings.elevenlabs_configured:
        return _sse_single_error("service_unavailable", "ElevenLabs is not configured")
    return create_sse_response(
        sse_stream(_culture_question_audio_sse_pipeline(question_id), heartbeat_interval=15)
    )


def _validate_meaning_eligibility(word_entry: "WordEntry") -> None:
    if not word_entry.translation_en or not word_entry.translation_ru:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Meaning cards require both translation_en and translation_ru",
        )


def _validate_plural_form_noun(gd: dict) -> None:
    sg = gd.get("nominative_singular")
    pl = gd.get("nominative_plural")
    if not sg or not pl:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Plural form cards for nouns require nominative_singular and nominative_plural in grammar_data",
        )


def _validate_plural_form_adjective(gd: dict) -> None:
    forms = gd.get("forms") or {}
    has_any = any(
        (forms.get(g) or {}).get("singular", {}).get("nominative")
        and (forms.get(g) or {}).get("plural", {}).get("nominative")
        for g in ("masculine", "feminine", "neuter")
    )
    if not has_any:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Plural form cards for adjectives require at least one gender with singular and plural nominative in grammar_data.forms",
        )


def _validate_plural_form_eligibility(word_entry: "WordEntry") -> None:
    gd = word_entry.grammar_data or {}
    if word_entry.part_of_speech == PartOfSpeech.NOUN:
        _validate_plural_form_noun(gd)
    elif word_entry.part_of_speech == PartOfSpeech.ADJECTIVE:
        _validate_plural_form_adjective(gd)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Plural form cards are not supported for part of speech '{word_entry.part_of_speech.value}'",
        )


def _validate_article_eligibility(word_entry: "WordEntry") -> None:
    if word_entry.part_of_speech != PartOfSpeech.NOUN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Article cards are only supported for nouns",
        )
    gd = word_entry.grammar_data or {}
    gender = gd.get("gender")
    nom_sg = gd.get("nominative_singular")
    if not gender or not nom_sg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Article cards require gender and nominative_singular in grammar_data",
        )


def _validate_declension_eligibility(word_entry: "WordEntry") -> None:
    if word_entry.part_of_speech != PartOfSpeech.NOUN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Declension cards are only supported for nouns",
        )
    gd = word_entry.grammar_data or {}
    gender = gd.get("gender")
    nom_sg = gd.get("nominative_singular")
    if gender not in ("masculine", "feminine", "neuter") or not nom_sg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Declension cards require gender and nominative_singular in grammar_data",
        )
    has_non_nom = any(
        gd.get(f"{c}_{num}")
        for num in ("singular", "plural")
        for c in ("genitive", "accusative", "vocative")
    )
    if not has_non_nom:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Declension cards require at least one non-nominative case form in grammar_data",
        )


def _validate_sentence_translation_eligibility(word_entry: "WordEntry") -> None:
    examples = word_entry.examples or []
    has_valid = any(ex.get("id") and ex.get("greek") and ex.get("english") for ex in examples)
    if not has_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sentence translation cards require at least one example with id, greek, and english",
        )


def _validate_card_type_eligibility(word_entry: "WordEntry", card_type: str) -> None:
    """Validate that a word entry has the required data for a given card type.

    Raises HTTPException(400) with a descriptive message if the word entry
    is missing required fields for the requested card type.
    """
    validators = {
        "meaning": _validate_meaning_eligibility,
        "plural_form": _validate_plural_form_eligibility,
        "article": _validate_article_eligibility,
        "sentence_translation": _validate_sentence_translation_eligibility,
        "declension": _validate_declension_eligibility,
    }
    validators[card_type](word_entry)


@router.post(
    "/word-entries/{word_entry_id}/generate-cards",
    response_model=GenerateCardsResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate flashcards for a word entry",
)
async def generate_word_entry_cards(
    word_entry_id: UUID,
    request: GenerateCardsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> GenerateCardsResponse:
    """Generate or regenerate flashcard records for a specific word entry.

    Validates that the word entry has the required data for the requested
    card type, then delegates to CardGeneratorService for card creation/update.
    """
    repo = WordEntryRepository(db)
    word_entry = await repo.get(word_entry_id)
    if word_entry is None:
        raise NotFoundException(
            resource="Word entry",
            detail=f"Word entry with ID '{word_entry_id}' not found",
        )

    _validate_card_type_eligibility(word_entry, request.card_type)

    service = CardGeneratorService(db)
    method_map = {
        "meaning": service.generate_meaning_cards,
        "plural_form": service.generate_plural_form_cards,
        "article": service.generate_article_cards,
        "sentence_translation": service.generate_sentence_translation_cards,
        "declension": service.generate_declension_cards,
    }
    generate_fn = method_map[request.card_type]
    # Look up deck_id via junction table (WordEntry no longer has deck_id)
    deck_id_result = await db.execute(
        select(DeckWordEntry.deck_id).where(DeckWordEntry.word_entry_id == word_entry_id).limit(1)
    )
    resolved_deck_id = deck_id_result.scalar_one_or_none()
    if resolved_deck_id is None:
        raise NotFoundException(
            resource="Deck link",
            detail=f"Word entry '{word_entry_id}' is not linked to any deck",
        )
    created, updated = await generate_fn([word_entry], resolved_deck_id)

    await db.commit()

    logger.info(
        "Cards generated for word entry",
        extra={
            "word_entry_id": str(word_entry_id),
            "card_type": request.card_type,
            "created": created,
            "updated": updated,
            "triggered_by": str(current_user.id),
        },
    )

    return GenerateCardsResponse(
        card_type=request.card_type,
        created=created,
        updated=updated,
    )


def _confidence_tier(confidence: float) -> Literal["high", "medium", "low"]:
    """Map raw confidence score to a display tier."""
    if confidence >= 0.8:
        return "high"
    if confidence >= 0.5:
        return "medium"
    return "low"


_SPACY_GENDER_MAP = {"Masc": "masculine", "Fem": "feminine", "Neut": "neuter"}
_GENDER_TO_ARTICLE = {"masculine": "ο", "feminine": "η", "neuter": "το"}
_APP_GENDER_TO_LEXICON: dict[str, str] = {v: k for k, v in _SPACY_GENDER_MAP.items()}
_ARTICLE_GENDER_OVERRIDE: dict[str, str] = {"ο": "masculine", "η": "feminine", "το": "neuter"}


def _extract_gender_article(
    morph_features: dict[str, str],
) -> tuple[str | None, str | None]:
    """Extract gender and article from spaCy morphology features."""
    gender_raw = morph_features.get("Gender")
    gender = _SPACY_GENDER_MAP.get(gender_raw) if gender_raw else None
    article = _GENDER_TO_ARTICLE.get(gender) if gender else None
    return gender, article


async def _run_generation_stage(
    normalized_lemma: NormalizedLemma,
    translation_lookup: TranslationLookupStageResult | None,
) -> GeneratedNounData:
    """Run LLM noun data generation, passing TDICT pre-filled translations."""
    pre_filled_en = (
        translation_lookup.en.combined_text
        if translation_lookup and translation_lookup.en and translation_lookup.en.source != "none"
        else None
    )
    pre_filled_ru = (
        translation_lookup.ru.combined_text
        if translation_lookup and translation_lookup.ru and translation_lookup.ru.source != "none"
        else None
    )

    try:
        gen_svc = get_noun_data_generation_service()
        return await gen_svc.generate(
            normalized_lemma,
            pre_filled_en=pre_filled_en,
            pre_filled_ru=pre_filled_ru,
        )
    except NounGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Noun generation failed: {exc.detail}",
        ) from exc
    except OpenRouterError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM provider error: {exc}",
        ) from exc


def _get_morphology_source(
    has_lexicon: bool, has_wiktionary: bool
) -> Literal["lexicon", "wiktionary", "both", "llm"]:
    """Determine morphology_source from available data sources."""
    if has_lexicon and has_wiktionary:
        return "both"
    if has_lexicon:
        return "lexicon"
    if has_wiktionary:
        return "wiktionary"
    return "llm"


async def _fetch_wiktionary_entry(
    lemma: str, generated_gender: str | None
) -> WiktionaryMorphology | None:
    """Fetch wiktionary morphology entry with gender-filtered lookup and fallback."""
    try:
        factory = get_session_factory()
        async with factory.begin() as _db:
            wikt_svc = WiktionaryMorphologyService(_db)
            entry = None
            if generated_gender:
                entry = await wikt_svc.get_entry(lemma, gender=generated_gender)
            if entry is None:
                entry = await wikt_svc.get_entry(lemma, gender=None)
            return entry
    except Exception as exc:
        logger.warning(f"Wiktionary lookup failed for '{lemma}': {exc}")
        return None


async def _run_verification_stage(
    generated_data: GeneratedNounData,
    normalized_lemma: NormalizedLemma,
    lexicon_svc: LexiconService | None,
    lemma: str,
    secondary_data: GeneratedNounData | None = None,
    translation_lookup: TranslationLookupStageResult | None = None,
) -> VerificationSummary:
    """Run local + wiktionary + cross-AI verification and compute combined tier."""
    local_svc = get_local_verification_service()
    cross_svc = get_cross_ai_verification_service()

    # Step 1: Lexicon declensions
    lex_gender = (
        _APP_GENDER_TO_LEXICON.get(normalized_lemma.gender) if normalized_lemma.gender else None
    )
    if lexicon_svc is not None:
        lexicon_declensions = await lexicon_svc.get_declensions(
            lemma, pos="NOUN", gender=lex_gender
        )
    else:
        factory = get_session_factory()
        async with factory.begin() as _db:
            _lex_svc = LexiconService(_db)
            lexicon_declensions = await _lex_svc.get_declensions(
                lemma, pos="NOUN", gender=lex_gender
            )

    # Step 2: Wiktionary entry (gender-filtered with fallback)
    # Use normalized_lemma.gender (from NLP pipeline) not generated_data.grammar_data.gender
    # (which is under verification and may be wrong, causing a spurious miss).
    wiktionary_entry = await _fetch_wiktionary_entry(lemma, normalized_lemma.gender)

    # morphology_source determination
    has_lexicon = bool(lexicon_declensions)
    has_wiktionary = bool(wiktionary_entry)
    morphology_source = _get_morphology_source(has_lexicon, has_wiktionary)

    # Step 3: Run local (L1) verification (sync service, wrapped in executor)
    loop = asyncio.get_running_loop()
    try:
        local_result = await loop.run_in_executor(
            None,
            lambda: local_svc.verify(
                generated_data,
                tdict_translations=translation_lookup,
                lexicon_declensions=lexicon_declensions,
            ),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Local verification pipeline failed") from exc

    # Step 4: Run Wiktionary (L2) verification (soft failure)
    wiktionary_result = None
    if wiktionary_entry is not None:
        try:
            wiktionary_result = await loop.run_in_executor(
                None,
                lambda: WiktionaryVerificationService().verify(
                    generated_data,
                    wiktionary_forms=dict(wiktionary_entry.forms),
                    wiktionary_gender=wiktionary_entry.gender,
                    wiktionary_pronunciation=wiktionary_entry.pronunciation,
                    wiktionary_glosses=wiktionary_entry.glosses_en,
                ),
            )
        except Exception as exc:
            logger.warning(f"Wiktionary verification failed for '{lemma}': {exc}")

    # Step 5: Cross-AI verification (unchanged)
    if secondary_data is not None:
        cross_result = cross_svc.compare(generated_data, secondary_data)
    else:
        cross_result = cross_svc.primary_only_result(
            generated_data, error="Secondary generation failed or skipped"
        )

    # Step 6: Combined tier using v2 (considers L1 + L2)
    l2_tier = wiktionary_result.tier if wiktionary_result is not None else None
    cross_ai_agreement = (
        cross_result.overall_agreement
        if cross_result.error is None and cross_result.overall_agreement is not None
        else None
    )
    combined_tier = compute_combined_tier_v2(local_result.tier, l2_tier, cross_ai_agreement)

    return VerificationSummary(
        local=local_result,
        wiktionary_local=wiktionary_result,
        cross_ai=cross_result,
        morphology_source=morphology_source,
        combined_tier=combined_tier,
    )


async def _run_generation_with_secondary(
    normalized_lemma: NormalizedLemma,
    translation_lookup: TranslationLookupStageResult | None,
) -> tuple[GeneratedNounData, GeneratedNounData | None]:
    """Run primary generation and cross-AI secondary LLM call concurrently.

    Returns (generated_data, secondary_data). Raises on primary failure; secondary
    failure is soft — returns None for secondary_data and logs a warning.
    """
    cross_svc = get_cross_ai_verification_service()
    gen_coro = _run_generation_stage(
        normalized_lemma=normalized_lemma,
        translation_lookup=translation_lookup,
    )
    cross_coro = cross_svc.generate_secondary(normalized_lemma)

    results = await asyncio.gather(gen_coro, cross_coro, return_exceptions=True)
    generated_data_or_exc, secondary_data_or_exc = results

    # Primary generation failure is a hard error — re-raise
    if isinstance(generated_data_or_exc, BaseException):
        raise generated_data_or_exc
    generated_data: GeneratedNounData = generated_data_or_exc

    # Cross-AI secondary failure is soft — proceed without
    secondary_data: GeneratedNounData | None = None
    if isinstance(secondary_data_or_exc, BaseException):
        logger.warning("Cross-AI secondary generation failed: %s", secondary_data_or_exc)
    else:
        secondary_data = secondary_data_or_exc

    return generated_data, secondary_data


def _build_translation_lookup_stage_result(
    bilingual: dict[str, Any],
) -> TranslationLookupStageResult:
    """Build TranslationLookupStageResult from lookup_bilingual() result."""

    def _to_info(result: Any) -> TranslationSourceInfo:
        return TranslationSourceInfo(
            translations=[e.translation for e in result.translations],
            combined_text=result.combined_text,
            source=result.source,
            sense_count=len(result.translations),
        )

    return TranslationLookupStageResult(
        en=_to_info(bilingual["en"]),
        ru=_to_info(bilingual["ru"]),
    )


@router.post(
    "/word-entries/generate",
    response_model=GenerateWordEntryResponse,
    status_code=status.HTTP_200_OK,
    summary="Run noun generation pipeline (progressive stages)",
)
async def generate_word_entry(  # noqa: C901
    request: GenerateWordEntryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> GenerateWordEntryResponse:
    """Run the noun generation pipeline for a Greek word.

    Currently executes only the normalization stage.
    Future subtasks will add duplicate check, generation,
    verification, and persistence stages.
    """
    # Validate deck exists and is active
    result = await db.execute(select(Deck).where(Deck.id == request.deck_id))
    deck = result.scalar_one_or_none()
    if deck is None or not deck.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Active deck with ID '{request.deck_id}' not found",
        )

    # Stage 0.5: Lexicon lookup (async DB query)
    detected_art, bare_word = detect_article(request.word)
    lexicon_svc = LexiconService(db)

    lexicon_entry: LexiconEntry | None = None
    lexicon_entries: list[LexiconEntry] | None = None

    if detected_art is None:
        # Bare word — fetch all gender variants for suggestions
        lexicon_entries = await lexicon_svc.lookup_all_genders(bare_word, pos="NOUN")
    else:
        # Article specified — map to lexicon-level gender code and do targeted lookup
        art_gender = _ARTICLE_GENDER_OVERRIDE.get(detected_art)
        lex_gender_rest = _APP_GENDER_TO_LEXICON.get(art_gender) if art_gender else None
        if lex_gender_rest:
            lexicon_entry = await lexicon_svc.lookup(bare_word, pos="NOUN", gender=lex_gender_rest)
        else:
            lexicon_entry = await lexicon_svc.lookup(bare_word, pos="NOUN")

    # Stage 1: Normalization (synchronous -- CPU-bound NLP)
    svc = get_lemma_normalization_service()
    try:
        smart_result = svc.normalize_smart(
            request.word,
            expected_pos="NOUN",
            lexicon_entry=lexicon_entry,
            lexicon_entries=lexicon_entries,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    primary = smart_result.primary
    primary_gender, primary_article = _extract_gender_article(primary.morphology.morph_features)

    # Article-based gender override: when user provided a nominative singular article,
    # use it as ground-truth gender (overrides spaCy's morphological analysis)
    if smart_result.detected_article in _ARTICLE_GENDER_OVERRIDE:
        primary_gender = _ARTICLE_GENDER_OVERRIDE[smart_result.detected_article]
        primary_article = smart_result.detected_article

    suggestions = [
        SuggestionItem(
            lemma=s.morphology.lemma,
            pos=s.morphology.pos,
            gender=_extract_gender_article(s.morphology.morph_features)[0],
            article=_extract_gender_article(s.morphology.morph_features)[1],
            confidence=s.confidence,
            confidence_tier=_confidence_tier(s.confidence),
            strategy=s.strategy,
        )
        for s in smart_result.suggestions
    ]

    # Stage 2: Duplicate check
    dup_svc = DuplicateDetectionService(db)
    dup_result = await dup_svc.check(
        lemma=primary.morphology.lemma,
        part_of_speech=PartOfSpeech.NOUN,
        gender=primary_gender,
    )
    if dup_result.is_duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "Duplicate word entry found",
                "duplicate_check": dup_result.model_dump(mode="json"),
            },
        )

    # Stage 2.5: Translation lookup
    translation_lookup: TranslationLookupStageResult | None = None
    try:
        tl_svc = TranslationLookupService(db)
        tl_bilingual = await tl_svc.lookup_bilingual(
            lemma=primary.morphology.lemma,
            pos="NOUN",
        )
        translation_lookup = _build_translation_lookup_stage_result(tl_bilingual)
    except Exception as e:
        logger.warning(f"Translation lookup failed (non-blocking): {e}")

    # Stage 3: Generation
    normalized_lemma = NormalizedLemma(
        input_word=primary.input_form,
        lemma=primary.morphology.lemma,
        gender=primary_gender,
        article=primary_article,
        pos=primary.morphology.pos,
        confidence=primary.confidence,
    )

    # Stage 3 + Cross-AI LLM (concurrent)
    generated_data, secondary_data = await _run_generation_with_secondary(
        normalized_lemma=normalized_lemma,
        translation_lookup=translation_lookup,
    )

    # Stage 4: Verification (local + cross-AI comparison)
    verification_summary: VerificationSummary | None = None
    if generated_data is not None:
        verification_summary = await _run_verification_stage(
            generated_data=generated_data,
            normalized_lemma=normalized_lemma,
            lexicon_svc=lexicon_svc,
            lemma=primary.morphology.lemma,
            secondary_data=secondary_data,
            translation_lookup=translation_lookup,
        )

    last_stage = (
        "verification"
        if verification_summary
        else (
            "generation"
            if generated_data
            else ("translation_lookup" if translation_lookup else "duplicate_check")
        )
    )

    return GenerateWordEntryResponse(
        stage=last_stage,
        normalization=NormalizationStageResult(
            input_word=primary.input_form,
            lemma=primary.morphology.lemma,
            gender=primary_gender,
            article=primary_article,
            pos=primary.morphology.pos,
            confidence=primary.confidence,
            confidence_tier=_confidence_tier(primary.confidence),
            strategy=primary.strategy,
            corrected_from=primary.corrected_from,
            corrected_to=primary.corrected_to,
        ),
        suggestions=suggestions,
        duplicate_check=dup_result,
        translation_lookup=translation_lookup,
        generation=generated_data,
        verification=verification_summary,
    )


async def _sse_generation_and_verification(
    normalized_lemma: NormalizedLemma,
    translation_lookup: TranslationLookupStageResult | None,
    lemma: str,
) -> AsyncGenerator[str, None]:
    """Emit SSE events for stages 3 (generation) and 4 (verification)."""
    yield format_sse_event({"message": "Generating with AI..."}, event="generation_started")
    try:
        generated_data, secondary_data = await _run_generation_with_secondary(
            normalized_lemma=normalized_lemma,
            translation_lookup=translation_lookup,
        )
        yield format_sse_event(generated_data, event="generation_complete")
    except HTTPException as exc:
        yield format_sse_event(
            {"error": exc.detail, "status_code": exc.status_code},
            event="generation_failed",
        )
        yield format_sse_event(
            {"error": exc.detail, "stage": "generation"},
            event="pipeline_failed",
        )
        return

    yield format_sse_event({"message": "Running verification..."}, event="verification_started")
    verification_summary: VerificationSummary | None = None
    try:
        verification_summary = await _run_verification_stage(
            generated_data=generated_data,
            normalized_lemma=normalized_lemma,
            lexicon_svc=None,
            lemma=lemma,
            secondary_data=secondary_data,
            translation_lookup=translation_lookup,
        )
        yield format_sse_event(verification_summary, event="verification_complete")
    except Exception as exc:
        logger.warning("Verification failed (non-fatal): %s", exc)
        yield format_sse_event({"error": str(exc)}, event="verification_failed")

    last_stage = "verification" if verification_summary else "generation"
    yield format_sse_event({"stage": last_stage}, event="pipeline_complete")


def _build_normalization_sse_event(
    smart_result: Any,
) -> tuple[str, str | None, str | None]:
    """Extract gender/article from smart result and return (sse_event_str, gender, article)."""
    primary = smart_result.primary
    primary_gender, primary_article = _extract_gender_article(primary.morphology.morph_features)

    if smart_result.detected_article in _ARTICLE_GENDER_OVERRIDE:
        primary_gender = _ARTICLE_GENDER_OVERRIDE[smart_result.detected_article]
        primary_article = smart_result.detected_article

    suggestions = [
        SuggestionItem(
            lemma=s.morphology.lemma,
            pos=s.morphology.pos,
            gender=_extract_gender_article(s.morphology.morph_features)[0],
            article=_extract_gender_article(s.morphology.morph_features)[1],
            confidence=s.confidence,
            confidence_tier=_confidence_tier(s.confidence),
            strategy=s.strategy,
        )
        for s in smart_result.suggestions
    ]
    event_str = format_sse_event(
        {
            "normalization": NormalizationStageResult(
                input_word=primary.input_form,
                lemma=primary.morphology.lemma,
                gender=primary_gender,
                article=primary_article,
                pos=primary.morphology.pos,
                confidence=primary.confidence,
                confidence_tier=_confidence_tier(primary.confidence),
                strategy=primary.strategy,
                corrected_from=primary.corrected_from,
                corrected_to=primary.corrected_to,
            ).model_dump(),
            "suggestions": [s.model_dump() for s in suggestions],
        },
        event="normalization_complete",
    )
    return event_str, primary_gender, primary_article


async def _generate_word_entry_sse_pipeline(  # noqa: C901
    request: GenerateWordEntryRequest,
    from_stage: str | None = None,
) -> AsyncGenerator[str, None]:
    """Async generator that emits SSE events for each noun generation pipeline stage."""
    yield format_sse_event("", event="connected")

    # Validate from_stage param
    if from_stage is not None and from_stage != "generation":
        yield format_sse_error(
            "invalid_param", f"Invalid from_stage: '{from_stage}'. Only 'generation' is supported."
        )
        return

    if from_stage == "generation":
        if not request.lemma:
            yield format_sse_error(
                "missing_field", "'lemma' is required when from_stage=generation"
            )
            return

        # Validate deck (active + V2)
        factory = get_session_factory()
        async with factory.begin() as _db:
            result = await _db.execute(select(Deck).where(Deck.id == request.deck_id))
            deck = result.scalar_one_or_none()

        if deck is None or not deck.is_active:
            yield format_sse_event(
                {
                    "error": f"Active deck with ID '{request.deck_id}' not found",
                    "stage": "validation",
                },
                event="pipeline_failed",
            )
            return

        # Build NormalizedLemma from pre-resolved fields in the request
        normalized_lemma = NormalizedLemma(
            input_word=request.word,
            lemma=request.lemma,
            gender=request.gender,
            article=request.article,
            pos="NOUN",
            confidence=1.0,
        )
        async for event in _sse_generation_and_verification(
            normalized_lemma=normalized_lemma,
            translation_lookup=request.translation_lookup,
            lemma=request.lemma,
        ):
            yield event
        return

    # Validate deck (active + V2) and lexicon lookup — share one session
    detected_art_sse, bare_word = detect_article(request.word)
    factory = get_session_factory()
    lexicon_entry_sse: LexiconEntry | None = None
    lexicon_entries_sse: list[LexiconEntry] | None = None
    async with factory.begin() as _db:
        result = await _db.execute(select(Deck).where(Deck.id == request.deck_id))
        deck = result.scalar_one_or_none()
        if deck is not None and deck.is_active:
            lexicon_svc_inner = LexiconService(_db)
            try:
                if detected_art_sse is None:
                    lexicon_entries_sse = await lexicon_svc_inner.lookup_all_genders(
                        bare_word, pos="NOUN"
                    )
                else:
                    art_gender_sse = _ARTICLE_GENDER_OVERRIDE.get(detected_art_sse)
                    lex_gender_sse = (
                        _APP_GENDER_TO_LEXICON.get(art_gender_sse) if art_gender_sse else None
                    )
                    if lex_gender_sse:
                        lexicon_entry_sse = await lexicon_svc_inner.lookup(
                            bare_word, pos="NOUN", gender=lex_gender_sse
                        )
                    else:
                        lexicon_entry_sse = await lexicon_svc_inner.lookup(bare_word, pos="NOUN")
            except Exception:
                lexicon_entry_sse = None
                lexicon_entries_sse = None

    if deck is None or not deck.is_active:
        yield format_sse_event(
            {"error": f"Active deck with ID '{request.deck_id}' not found", "stage": "validation"},
            event="pipeline_failed",
        )
        return

    # Stage 1: Normalization
    svc = get_lemma_normalization_service()
    try:
        smart_result = svc.normalize_smart(
            request.word,
            expected_pos="NOUN",
            lexicon_entry=lexicon_entry_sse,
            lexicon_entries=lexicon_entries_sse,
        )
    except ValueError as exc:
        yield format_sse_event(
            {"error": str(exc), "stage": "normalization"},
            event="pipeline_failed",
        )
        return

    norm_event, primary_gender, primary_article = _build_normalization_sse_event(smart_result)
    yield norm_event
    primary = smart_result.primary

    # Stage 2: Duplicate check
    dup_result = None
    dup_exc = None
    try:
        async with factory.begin() as _db:
            dup_svc = DuplicateDetectionService(_db)
            dup_result = await dup_svc.check(
                lemma=primary.morphology.lemma,
                part_of_speech=PartOfSpeech.NOUN,
                gender=primary_gender,
            )
    except Exception as exc:
        dup_exc = exc
        logger.warning("Duplicate check failed: %s", exc)

    if dup_exc is not None:
        yield format_sse_event(
            {"error": str(dup_exc), "stage": "duplicate_check"},
            event="duplicates_checked",
        )
    elif dup_result is not None:
        yield format_sse_event(dup_result, event="duplicates_checked")
        if dup_result.is_duplicate:
            yield format_sse_event(
                {
                    "error": "Duplicate word entry found",
                    "stage": "duplicate_check",
                    "existing_entry": (
                        dup_result.existing_entry.model_dump(mode="json")
                        if dup_result.existing_entry
                        else None
                    ),
                },
                event="pipeline_stopped",
            )
            return

    # Stage 2.5: Translation lookup (non-fatal)
    translation_lookup: TranslationLookupStageResult | None = None
    try:
        async with factory.begin() as _db:
            tl_svc = TranslationLookupService(_db)
            tl_bilingual = await tl_svc.lookup_bilingual(
                lemma=primary.morphology.lemma,
                pos="NOUN",
            )
        translation_lookup = _build_translation_lookup_stage_result(tl_bilingual)
        yield format_sse_event(
            {"data": translation_lookup.model_dump()}, event="translations_found"
        )
    except Exception as exc:
        logger.opt(exception=True).warning("Translation lookup failed (non-blocking): {}", exc)
        yield format_sse_event({"data": None}, event="translations_found")

    # Build NormalizedLemma and run stages 3+4 via sub-generator
    normalized_lemma = NormalizedLemma(
        input_word=primary.input_form,
        lemma=primary.morphology.lemma,
        gender=primary_gender,
        article=primary_article,
        pos=primary.morphology.pos,
        confidence=primary.confidence,
    )
    async for event in _sse_generation_and_verification(
        normalized_lemma=normalized_lemma,
        translation_lookup=translation_lookup,
        lemma=primary.morphology.lemma,
    ):
        yield event


@router.post(
    "/word-entries/generate/stream",
    summary="Run noun generation pipeline as SSE stream",
    response_class=StreamingResponse,
)
async def generate_word_entry_stream(
    request: GenerateWordEntryRequest,
    sse_auth: SSEAuthResult = Depends(get_sse_auth),
    from_stage: str | None = Query(
        None, description="Pipeline stage to start from. Only 'generation' is supported."
    ),
) -> StreamingResponse:
    """Stream noun generation pipeline stages as SSE events.

    Returns events in sequence:
    connected → normalization_complete → duplicates_checked → translations_found
    → generation_started → generation_complete → verification_started
    → verification_complete → pipeline_complete

    On failure: pipeline_failed (normalization/generation) or verification_failed (non-fatal).
    The existing sync endpoint POST /generate remains unchanged.
    """
    if not sse_auth.is_authenticated:
        return _sse_single_error(
            sse_auth.error_code or "auth_required",
            sse_auth.error_message or "Authentication required",
        )

    assert sse_auth.user is not None
    if not sse_auth.user.is_superuser:
        return _sse_single_error("forbidden", "Superuser privileges required")

    return create_sse_response(
        sse_stream(
            _generate_word_entry_sse_pipeline(request, from_stage=from_stage),
            heartbeat_interval=15,
        )
    )


# ============================================================================
# Word Entry Create-and-Link Endpoint
# ============================================================================


@router.post(
    "/word-entries",
    response_model=AdminWordEntryCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create and link a word entry to a deck",
    description=(
        "Create (or upsert) a word entry and link it to the specified deck. "
        "Generates all card types automatically."
    ),
    responses={
        201: {"description": "Word entry created/updated and linked to deck"},
        404: {"description": "Deck not found"},
        409: {"description": "Deck is not an active V2 deck"},
    },
)
async def create_and_link_word_entry(
    body: AdminWordEntryCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> AdminWordEntryCreateResponse:
    """Create or upsert a word entry, link it to a deck, and generate all cards."""
    deck_repo = DeckRepository(db)
    word_entry_repo = WordEntryRepository(db)

    # Validate deck exists
    deck = await deck_repo.get(body.deck_id)
    if deck is None:
        raise NotFoundException(resource="Deck", detail=f"Deck with id '{body.deck_id}' not found")

    # Validate deck is active
    if not deck.is_active:
        raise ConflictException(
            detail=f"Deck '{body.deck_id}' is not active. Word entries can only be linked to active decks."
        )

    # Build entry data dict from the request schema
    entry_data = body.word_entry.model_dump()

    # Upsert the word entry (owner_id=None for admin/shared entries)
    entries, created_count, _updated_count = await word_entry_repo.bulk_upsert(
        owner_id=None,
        entries_data=[entry_data],
    )
    word_entry = entries[0]
    is_new = created_count > 0

    # Link to deck (idempotent via on_conflict_do_nothing)
    await word_entry_repo.link_to_deck(word_entry.id, body.deck_id)

    # Generate all card types
    card_service = CardGeneratorService(db)
    results = await asyncio.gather(
        card_service.generate_meaning_cards([word_entry], body.deck_id),
        card_service.generate_plural_form_cards([word_entry], body.deck_id),
        card_service.generate_sentence_translation_cards([word_entry], body.deck_id),
        card_service.generate_article_cards([word_entry], body.deck_id),
        card_service.generate_declension_cards([word_entry], body.deck_id),
    )
    cards_created = sum(r[0] for r in results)

    await db.commit()
    await db.refresh(word_entry)

    return AdminWordEntryCreateResponse(
        word_entry=word_entry_to_response(word_entry, deck_id=body.deck_id),
        cards_created=cards_created,
        is_new=is_new,
    )


# ============================================================================
# Word Entry Link/Unlink Endpoints
# ============================================================================


@router.post(
    "/decks/{deck_id}/word-entries/{word_entry_id}/link",
    response_model=WordEntryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Link word entry to deck",
    description=(
        "Link an existing shared word entry to a deck. "
        "Generates card records for the deck automatically."
    ),
    responses={
        201: {"description": "Word entry linked and cards generated"},
        404: {"description": "Deck or word entry not found"},
        409: {"description": "Duplicate lemma+POS in deck or already linked"},
    },
)
async def link_word_entry_to_deck(
    deck_id: UUID,
    word_entry_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> WordEntryResponse:
    """Link an existing word entry to a deck and generate its card records."""
    deck_repo = DeckRepository(db)
    word_entry_repo = WordEntryRepository(db)

    # Validate deck exists
    deck = await deck_repo.get(deck_id)
    if deck is None:
        raise NotFoundException(resource="Deck", detail=f"Deck with id '{deck_id}' not found")

    # Validate deck is active
    if not deck.is_active:
        raise ConflictException(
            detail=f"Deck '{deck_id}' is not active. Word entries can only be linked to active decks."
        )

    # Validate word entry exists and is active
    word_entry = await word_entry_repo.get(word_entry_id)
    if word_entry is None or not word_entry.is_active:
        raise NotFoundException(
            resource="WordEntry",
            detail=f"Word entry with id '{word_entry_id}' not found or inactive",
        )

    # Check if deck already has a word entry with same lemma+POS (via junction)
    link_dup_filters = [
        DeckWordEntry.deck_id == deck_id,
        WordEntry.lemma == word_entry.lemma,
        WordEntry.part_of_speech == word_entry.part_of_speech,
        WordEntry.id != word_entry_id,
    ]
    if word_entry.gender is not None:
        link_dup_filters.append(WordEntry.gender == word_entry.gender)

    duplicate_check = await db.execute(
        select(WordEntry.id)
        .join(DeckWordEntry, DeckWordEntry.word_entry_id == WordEntry.id)
        .where(*link_dup_filters)
        .limit(1)
    )
    if duplicate_check.scalar_one_or_none() is not None:
        raise ConflictException(
            detail=f"Deck already has a word entry for '{word_entry.lemma}' ({word_entry.part_of_speech})"
        )

    # Check if already linked (since link_to_deck uses on_conflict_do_nothing)
    already_linked = await word_entry_repo.is_linked_to_deck(word_entry_id, deck_id)
    if already_linked:
        raise ConflictException(detail="Word entry is already linked to this deck")

    # Insert junction row
    try:
        await word_entry_repo.link_to_deck(word_entry_id, deck_id)
    except IntegrityError:
        await db.rollback()
        raise ConflictException(detail="Word entry is already linked to this deck")

    # Generate card records for this deck
    card_service = CardGeneratorService(db)
    await card_service.generate_meaning_cards([word_entry], deck_id)
    await card_service.generate_plural_form_cards([word_entry], deck_id)
    await card_service.generate_sentence_translation_cards([word_entry], deck_id)
    await card_service.generate_article_cards([word_entry], deck_id)
    await card_service.generate_declension_cards([word_entry], deck_id)

    await db.commit()
    await db.refresh(word_entry)

    return word_entry_to_response(word_entry, deck_id=deck_id)


@router.delete(
    "/decks/{deck_id}/word-entries/{word_entry_id}/link",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Unlink word entry from deck",
    description=(
        "Remove a word entry's link to a deck. "
        "Deletes associated card records but preserves the word entry."
    ),
    responses={
        204: {"description": "Link removed successfully"},
        404: {"description": "Link not found"},
    },
)
async def unlink_word_entry_from_deck(
    deck_id: UUID,
    word_entry_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> None:
    """Remove a word entry from a deck, deleting its card records."""
    word_entry_repo = WordEntryRepository(db)

    # Check link exists
    linked = await word_entry_repo.is_linked_to_deck(word_entry_id, deck_id)
    if not linked:
        raise NotFoundException(
            resource="Link",
            detail=f"Word entry '{word_entry_id}' is not linked to deck '{deck_id}'",
        )

    # Delete card records for (deck_id, word_entry_id)
    await db.execute(
        delete(CardRecord).where(
            CardRecord.deck_id == deck_id,
            CardRecord.word_entry_id == word_entry_id,
        )
    )

    # Remove junction row
    await word_entry_repo.unlink_from_deck(word_entry_id, deck_id)

    await db.commit()


@router.delete(
    "/word-entries/{word_entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete word entry",
    description="Permanently delete a word entry, its card records, deck links, and S3 audio. Requires superuser privileges.",
    responses={
        204: {"description": "Word entry deleted successfully"},
        404: {"description": "Word entry not found"},
    },
)
async def delete_word_entry(
    word_entry_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> None:
    """Delete a word entry permanently (admin only).

    Deletes the word entry from DB and best-effort deletes S3 audio files.
    CardRecords are cascade-deleted by ORM. DeckWordEntry rows are cascade-deleted by DB FK.

    Args:
        word_entry_id: UUID of the word entry to delete
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Raises:
        404: If word entry not found
    """
    result = await db.execute(select(WordEntry).where(WordEntry.id == word_entry_id))
    word_entry = result.scalar_one_or_none()
    if word_entry is None:
        raise NotFoundException(
            resource="WordEntry", detail=f"Word entry '{word_entry_id}' not found"
        )

    # Collect S3 keys before deletion
    s3_keys: list[str] = []
    if word_entry.audio_key:
        s3_keys.append(word_entry.audio_key)
    for example in word_entry.examples or []:
        audio_key = example.get("audio_key")
        if audio_key:
            s3_keys.append(audio_key)

    logger.info(
        "Deleting word entry",
        extra={
            "word_entry_id": str(word_entry_id),
            "lemma": word_entry.lemma,
            "s3_keys_count": len(s3_keys),
        },
    )

    # Best-effort S3 cleanup (do NOT await — synchronous method)
    s3 = get_s3_service()
    for key in s3_keys:
        try:
            s3.delete_object(key)
        except Exception:
            logger.warning(
                "Failed to delete S3 audio during word entry deletion",
                extra={"s3_key": key, "word_entry_id": str(word_entry_id)},
            )

    await db.delete(word_entry)
    await db.commit()


# ========================
# Listening Dialogs Admin Endpoints
# ========================


@router.get(
    "/listening-dialogs",
    response_model=ListeningDialogListResponse,
    summary="List listening dialogs (admin)",
)
async def list_listening_dialogs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: DialogStatus | None = Query(default=None),
    cefr_level: DeckLevel | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> ListeningDialogListResponse:
    count_query = select(func.count(ListeningDialog.id))
    if status is not None:
        count_query = count_query.where(ListeningDialog.status == status)
    if cefr_level is not None:
        count_query = count_query.where(ListeningDialog.cefr_level == cefr_level)
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    data_query = (
        select(ListeningDialog)
        .order_by(ListeningDialog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    if status is not None:
        data_query = data_query.where(ListeningDialog.status == status)
    if cefr_level is not None:
        data_query = data_query.where(ListeningDialog.cefr_level == cefr_level)
    result = await db.execute(data_query)
    dialogs = result.scalars().all()

    items = [ListeningDialogListItem.model_validate(d) for d in dialogs]
    return ListeningDialogListResponse(items=items, total=total, page=page, page_size=page_size)


@router.delete(
    "/listening-dialogs/{dialog_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a listening dialog (admin)",
    description="Permanently delete a listening dialog and its S3 audio. Requires superuser privileges.",
    responses={
        204: {"description": "Listening dialog deleted successfully"},
        404: {"description": "Listening dialog not found"},
    },
)
async def delete_listening_dialog(
    dialog_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> None:
    result = await db.execute(select(ListeningDialog).where(ListeningDialog.id == dialog_id))
    dialog = result.scalar_one_or_none()
    if dialog is None:
        raise HTTPException(status_code=404, detail="Listening dialog not found")

    # Best-effort S3 cleanup
    if dialog.audio_s3_key:
        logger.info(
            "Deleting dialog audio from S3",
            extra={
                "dialog_id": str(dialog_id),
                "s3_key": dialog.audio_s3_key,
            },
        )
        s3 = get_s3_service()
        try:
            s3.delete_object(dialog.audio_s3_key)
        except Exception:
            logger.warning(
                "Failed to delete S3 audio during dialog deletion",
                extra={"s3_key": dialog.audio_s3_key, "dialog_id": str(dialog_id)},
            )

    await db.delete(dialog)
    await db.commit()


@router.post("/listening-dialogs", response_model=ListeningDialogListItem, status_code=201)
async def create_listening_dialog(  # noqa: C901
    data: ListeningDialogCreateFromJSON,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> ListeningDialogListItem:
    """Create a new listening dialog from JSON payload."""
    if not settings.elevenlabs_configured:
        raise HTTPException(
            status_code=503, detail="ElevenLabs is not configured — cannot validate voice IDs"
        )
    from src.services.elevenlabs_service import get_elevenlabs_service

    try:
        voices = await get_elevenlabs_service().list_voices()
        valid_voice_ids = {v["voice_id"] for v in voices}
        invalid = [s.voice_id for s in data.speakers if s.voice_id not in valid_voice_ids]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Invalid voice IDs: {', '.join(invalid)}")
    except ElevenLabsNotConfiguredError as exc:
        raise HTTPException(
            status_code=503, detail="ElevenLabs is not configured — cannot validate voice IDs"
        ) from exc
    except (
        ElevenLabsAuthenticationError,
        ElevenLabsRateLimitError,
        ElevenLabsNoVoicesError,
        ElevenLabsAPIError,
    ) as exc:
        raise HTTPException(status_code=503, detail="Voice validation is unavailable") from exc

    try:
        dialog = ListeningDialog(
            scenario_el=data.scenario_el,
            scenario_en=data.scenario_en,
            scenario_ru=data.scenario_ru,
            cefr_level=data.cefr_level,
            num_speakers=len(data.speakers),
            created_by=current_user.id,
        )
        db.add(dialog)
        await db.flush()

        speaker_map: dict[int, UUID] = {}
        for s in data.speakers:
            speaker = DialogSpeaker(
                dialog_id=dialog.id,
                speaker_index=s.speaker_index,
                character_name=s.character_name,
                voice_id=s.voice_id,
            )
            db.add(speaker)
            await db.flush()
            speaker_map[s.speaker_index] = speaker.id

        for idx, line in enumerate(data.lines):
            db.add(
                DialogLine(
                    dialog_id=dialog.id,
                    speaker_id=speaker_map[line.speaker_index],
                    line_index=idx,
                    text=line.text,
                )
            )

        if data.exercises is not None:
            type_map: list[tuple[ExerciseType, list[Any]]] = [
                (ExerciseType.FILL_GAPS, data.exercises.fill_gaps),
                (ExerciseType.SELECT_HEARD, data.exercises.select_heard),
                (ExerciseType.TRUE_FALSE, data.exercises.true_false),
            ]
            for ex_type, items in type_map:
                exercise = DialogExercise(
                    dialog_id=dialog.id,
                    exercise_type=ex_type,
                    status=ExerciseStatus.DRAFT,
                )
                db.add(exercise)
                await db.flush()
                exercise_repo = ExerciseRepository(db)
                await exercise_repo.create_for_dialog(exercise.id)
                for idx, item in enumerate(items):
                    db.add(
                        ExerciseItem(
                            exercise_id=exercise.id,
                            item_index=idx,
                            payload=item.model_dump(),
                        )
                    )

        await db.commit()
        await db.refresh(dialog)
        return ListeningDialogListItem.model_validate(dialog)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Dialog could not be created due to a conflict")


@router.get(
    "/listening-dialogs/{dialog_id}",
    response_model=ListeningDialogDetail,
    summary="Get listening dialog detail",
)
async def get_listening_dialog_detail(
    dialog_id: UUID,
    session: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_superuser),
) -> ListeningDialogDetail:
    result = await session.execute(
        select(ListeningDialog)
        .options(
            selectinload(ListeningDialog.speakers),
            selectinload(ListeningDialog.lines),
        )
        .where(ListeningDialog.id == dialog_id)
    )
    dialog = result.scalar_one_or_none()
    if dialog is None:
        raise HTTPException(status_code=404, detail="Dialog not found")

    s3 = get_s3_service()
    audio_url = s3.generate_presigned_url(dialog.audio_s3_key) if dialog.audio_s3_key else None

    speakers_sorted = sorted(dialog.speakers, key=lambda s: s.speaker_index)
    lines_sorted = sorted(dialog.lines, key=lambda ln: ln.line_index)

    degenerate_line_count = sum(
        1
        for ln in dialog.lines
        if ln.start_time_ms is not None and ln.start_time_ms == ln.end_time_ms
    )

    return ListeningDialogDetail(
        id=dialog.id,
        scenario_el=dialog.scenario_el,
        scenario_en=dialog.scenario_en,
        scenario_ru=dialog.scenario_ru,
        cefr_level=dialog.cefr_level,
        num_speakers=dialog.num_speakers,
        status=dialog.status,
        created_at=dialog.created_at,
        audio_url=audio_url,
        audio_duration_seconds=dialog.audio_duration_seconds,
        audio_generated_at=dialog.audio_generated_at,
        audio_file_size_bytes=dialog.audio_file_size_bytes,
        speakers=[DialogSpeakerDetail.model_validate(s) for s in speakers_sorted],
        lines=[DialogLineDetail.model_validate(ln) for ln in lines_sorted],
        degenerate_line_count=degenerate_line_count,
    )


_ALLOWED_AUDIO_GEN_STATUSES = {
    DialogStatus.DRAFT,
    DialogStatus.AUDIO_READY,
    DialogStatus.EXERCISES_READY,
}


async def _dialog_audio_sse_pipeline(dialog_id: UUID) -> AsyncGenerator[str, None]:  # noqa: C901
    """SSE generator for dialog audio generation pipeline."""
    try:
        yield format_sse_event("", event="connected")

        # Stage 1 — Load
        factory = get_session_factory()
        dialog_data: dict = {}
        lines_data: list[dict] = []
        speakers_data: dict = {}

        async with factory.begin() as session:
            result = await session.execute(
                select(ListeningDialog)
                .options(
                    selectinload(ListeningDialog.speakers),
                    selectinload(ListeningDialog.lines),
                )
                .where(ListeningDialog.id == dialog_id)
            )
            dialog = result.scalar_one_or_none()

            if dialog is None:
                yield format_sse_event(
                    {"stage": "load", "error": "Dialog not found", "dialog_id": str(dialog_id)},
                    event="dialog_audio:error",
                )
                return

            if dialog.status not in _ALLOWED_AUDIO_GEN_STATUSES:
                yield format_sse_event(
                    {
                        "stage": "load",
                        "error": f"Dialog status is {dialog.status.value}, expected one of: {', '.join(s.value for s in _ALLOWED_AUDIO_GEN_STATUSES)}",
                        "dialog_id": str(dialog_id),
                    },
                    event="dialog_audio:error",
                )
                return

            # Extract all data before session closes (ORM objects become detached)
            dialog_data = {"id": str(dialog.id), "status": dialog.status}
            lines_data = [
                {
                    "id": str(line.id),
                    "line_index": line.line_index,
                    "text": line.text,
                    "speaker_id": str(line.speaker_id),
                }
                for line in dialog.lines
            ]
            speakers_data = {str(speaker.id): speaker.voice_id for speaker in dialog.speakers}

        yield format_sse_event({"dialog_id": dialog_data["id"]}, event="dialog_audio:start")

        # Stage 2 — Build inputs
        sorted_lines = sorted(lines_data, key=lambda ln: ln["line_index"])
        inputs = [
            {"text": line["text"], "voice_id": speakers_data[line["speaker_id"]]}
            for line in sorted_lines
        ]
        speaker_ids = {line["speaker_id"] for line in lines_data}

        yield format_sse_event(
            {"line_count": len(inputs), "speaker_count": len(speaker_ids)},
            event="dialog_audio:elevenlabs",
        )

        audio_service = get_audio_generation_service()
        dialog_inputs = [
            DialogInput(text=line["text"], voice_id=speakers_data[line["speaker_id"]])
            for line in sorted_lines
        ]

        try:
            audio_result = await audio_service.generate_dialog(
                inputs=dialog_inputs,
                s3_key=f"dialog-audio/{dialog_id}.mp3",
            )
        except Exception as e:
            yield format_sse_event(
                {"stage": "elevenlabs", "error": str(e), "dialog_id": dialog_data["id"]},
                event="dialog_audio:error",
            )
            return

        yield format_sse_event(
            {
                "segments_count": len(audio_result.line_timings),
                "alignment_source": audio_result.alignment_source,
            },
            event="dialog_audio:timing",
        )

        yield format_sse_event(
            {"s3_key": audio_result.s3_key, "audio_size_bytes": audio_result.file_size_bytes},
            event="dialog_audio:upload",
        )

        # Stage 6 — Persist
        async with factory.begin() as session:
            exercise_item_count = await session.scalar(
                select(func.count())
                .select_from(ExerciseItem)
                .join(DialogExercise, ExerciseItem.exercise_id == DialogExercise.id)
                .where(DialogExercise.dialog_id == dialog_id)
            )
            has_exercises = bool(exercise_item_count)
            target_status = (
                DialogStatus.EXERCISES_READY
                if has_exercises or dialog_data["status"] == DialogStatus.EXERCISES_READY
                else DialogStatus.AUDIO_READY
            )
            await session.execute(
                update(ListeningDialog)
                .where(ListeningDialog.id == dialog_id)
                .values(
                    audio_s3_key=audio_result.s3_key,
                    audio_generated_at=datetime.now(timezone.utc),
                    audio_file_size_bytes=audio_result.file_size_bytes,
                    audio_duration_seconds=audio_result.duration_seconds,
                    status=target_status,
                )
            )
            for i, line in enumerate(sorted_lines):
                start_ms, end_ms = audio_result.line_timings[i]
                await session.execute(
                    update(DialogLine)
                    .where(DialogLine.id == UUID(line["id"]))
                    .values(
                        start_time_ms=start_ms,
                        end_time_ms=end_ms,
                        word_timestamps=audio_result.word_timestamps_map.get(i),
                    )
                )

        yield format_sse_event(
            {
                "dialog_id": dialog_data["id"],
                "s3_key": audio_result.s3_key,
                "duration_seconds": audio_result.duration_seconds,
                "audio_size_bytes": audio_result.file_size_bytes,
                "has_exercises": has_exercises,
                "degenerate_line_count": audio_result.degenerate_line_count,
                "alignment_source": audio_result.alignment_source,
            },
            event="dialog_audio:complete",
        )

    except Exception as e:
        yield format_sse_event(
            {"stage": "unknown", "error": str(e), "dialog_id": str(dialog_id)},
            event="dialog_audio:error",
        )


@router.post(
    "/listening-dialogs/{dialog_id}/generate-audio/stream",
    summary="Generate dialog audio via ElevenLabs text-to-dialogue as SSE stream",
    response_class=StreamingResponse,
)
async def generate_dialog_audio_stream(
    dialog_id: UUID,
    sse_auth: SSEAuthResult = Depends(get_sse_auth),
) -> StreamingResponse:
    """Stream dialog audio generation pipeline stages as SSE events."""
    if not sse_auth.is_authenticated:
        return _sse_single_error(
            sse_auth.error_code or "auth_required",
            sse_auth.error_message or "Authentication required",
        )

    assert sse_auth.user is not None

    if not sse_auth.user.is_superuser:
        return _sse_single_error("forbidden", "Admin access required")

    if not settings.elevenlabs_configured:
        return _sse_single_error("service_unavailable", "ElevenLabs is not configured")

    return create_sse_response(
        sse_stream(_dialog_audio_sse_pipeline(dialog_id), heartbeat_interval=15)
    )


async def _description_audio_sse_pipeline(
    situation_id: UUID, level: str
) -> AsyncGenerator[str, None]:
    """SSE pipeline for situation description audio generation."""
    yield format_sse_event("", event="connected")
    factory = get_session_factory()

    # Validate level
    if level not in ("b1", "a2"):
        yield format_sse_event(
            {
                "situation_id": str(situation_id),
                "stage": "load",
                "error": f"Invalid level: {level}. Must be 'b1' or 'a2'",
            },
            event="description_audio:error",
        )
        return

    # Load description
    async with factory.begin() as session:
        db_result = await session.execute(
            select(SituationDescription).where(SituationDescription.situation_id == situation_id)
        )
        description = db_result.scalar_one_or_none()
        if description is None:
            yield format_sse_event(
                {
                    "situation_id": str(situation_id),
                    "stage": "load",
                    "error": "No description found for this situation",
                },
                event="description_audio:error",
            )
            return
        description_id = description.id
        text = description.text_el if level == "b1" else description.text_el_a2

    if not text or not text.strip():
        yield format_sse_event(
            {
                "situation_id": str(situation_id),
                "stage": "load",
                "error": f"No text for level {level}",
            },
            event="description_audio:error",
        )
        return

    s3_key = (
        f"situation-description-audio/{description_id}.mp3"
        if level == "b1"
        else f"situation-description-audio/a2/{description_id}.mp3"
    )

    yield format_sse_event(
        {"situation_id": str(situation_id), "level": level},
        event="description_audio:start",
    )

    current_stage = "tts"
    try:
        audio_service = get_audio_generation_service()

        yield format_sse_event(
            {"situation_id": str(situation_id)},
            event="description_audio:tts",
        )

        async def _on_progress(stage: str, **kwargs: Any) -> None:
            nonlocal current_stage
            current_stage = stage

        audio_result = await audio_service.generate_single(
            text=text.strip(),
            s3_key=s3_key,
            with_timestamps=True,
            on_progress=_on_progress,
        )

        word_timestamps = (
            audio_result.word_timestamps
            if isinstance(audio_result, AudioWithTimestampsResult)
            else []
        )

        yield format_sse_event(
            {"situation_id": str(situation_id)},
            event="description_audio:alignment",
        )
        yield format_sse_event(
            {"situation_id": str(situation_id), "s3_key": s3_key},
            event="description_audio:upload",
        )

        current_stage = "persist"
        yield format_sse_event(
            {"situation_id": str(situation_id)},
            event="description_audio:persist",
        )

        async with factory.begin() as session:
            if level == "b1":
                values: dict = {
                    "audio_s3_key": s3_key,
                    "audio_duration_seconds": audio_result.duration_seconds,
                    "word_timestamps": word_timestamps,
                    "status": DescriptionStatus.AUDIO_READY,
                }
            else:
                values = {
                    "audio_a2_s3_key": s3_key,
                    "audio_a2_duration_seconds": audio_result.duration_seconds,
                    "word_timestamps_a2": word_timestamps,
                    "status": DescriptionStatus.AUDIO_READY,
                }
            await session.execute(
                update(SituationDescription)
                .where(SituationDescription.id == description_id)
                .values(**values)
            )

        audio_url = audio_service.generate_presigned_url(s3_key)

        yield format_sse_event(
            {
                "situation_id": str(situation_id),
                "level": level,
                "audio_url": audio_url,
                "duration_seconds": audio_result.duration_seconds,
            },
            event="description_audio:complete",
        )

    except Exception as exc:
        yield format_sse_event(
            {
                "situation_id": str(situation_id),
                "stage": current_stage,
                "error": str(exc),
            },
            event="description_audio:error",
        )


@router.post(
    "/situations/{situation_id}/description-audio/stream",
    summary="Generate situation description audio via ElevenLabs TTS as SSE stream",
    response_class=StreamingResponse,
)
async def generate_description_audio_stream(
    situation_id: UUID,
    level: str = Query(..., description="Audio level: 'b1' or 'a2'"),
    sse_auth: SSEAuthResult = Depends(get_sse_auth),
) -> StreamingResponse:
    if not sse_auth.is_authenticated:
        return _sse_single_error(
            sse_auth.error_code or "auth_required",
            sse_auth.error_message or "Authentication required",
        )
    assert sse_auth.user is not None
    if not sse_auth.user.is_superuser:
        return _sse_single_error("forbidden", "Admin access required")
    if not settings.elevenlabs_configured:
        return _sse_single_error("service_unavailable", "ElevenLabs is not configured")
    return create_sse_response(
        sse_stream(_description_audio_sse_pipeline(situation_id, level), heartbeat_interval=15)
    )


@router.get(
    "/reverse-lookup",
    response_model=ReverseLookupResponse,
    summary="Reverse lookup Greek lemmas by translation",
)
async def reverse_lookup(
    q: str = Query(..., min_length=1, max_length=100),
    lang: Literal["en", "ru"] = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> ReverseLookupResponse:
    """Look up Greek lemmas by their English or Russian translation."""
    service = ReverseLookupService(db)
    results = await service.search(q, lang)
    return ReverseLookupResponse(
        query=q,
        language=lang,
        results=[
            ReverseLookupItem(
                lemma=r.lemma,
                pos=r.pos,
                gender=r.gender,
                article=r.article,
                translations=r.translations,
                actionable=r.actionable,
                match_type=r.match_type,
                score=r.score,
                inferred_gender=r.inferred_gender,
            )
            for r in results
        ],
    )


@router.post("/situations", response_model=SituationResponse, status_code=201)
async def create_situation(
    data: SituationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> SituationResponse:
    try:
        situation = Situation(
            scenario_el=data.scenario_el,
            scenario_en=data.scenario_en,
            scenario_ru=data.scenario_ru,
        )
        db.add(situation)
        await db.commit()
        await db.refresh(situation)
        return SituationResponse.model_validate(situation)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409, detail="Situation could not be created due to a conflict"
        )


@router.patch("/situations/{situation_id}", response_model=SituationResponse)
async def update_situation(
    situation_id: UUID,
    data: SituationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> SituationResponse:
    result = await db.execute(select(Situation).where(Situation.id == situation_id))
    situation = result.scalar_one_or_none()
    if situation is None:
        raise HTTPException(status_code=404, detail="Situation not found")
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(situation, field, value)
    await db.commit()
    await db.refresh(situation)
    return SituationResponse.model_validate(situation)


@router.delete(
    "/situations/{situation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        204: {"description": "Situation deleted successfully"},
        404: {"description": "Situation not found"},
    },
)
async def delete_situation(
    situation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> None:
    result = await db.execute(
        select(Situation)
        .options(
            selectinload(Situation.dialog),
            selectinload(Situation.description),
            selectinload(Situation.picture),
        )
        .where(Situation.id == situation_id)
    )
    situation = result.scalar_one_or_none()
    if situation is None:
        raise HTTPException(status_code=404, detail="Situation not found")

    keys: list[str] = []
    if situation.dialog and situation.dialog.audio_s3_key:
        keys.append(situation.dialog.audio_s3_key)
    if situation.description and situation.description.audio_s3_key:
        keys.append(situation.description.audio_s3_key)
    if situation.description and situation.description.audio_a2_s3_key:
        keys.append(situation.description.audio_a2_s3_key)
    if situation.picture and situation.picture.image_s3_key:
        keys.append(situation.picture.image_s3_key)

    await db.delete(situation)
    await db.commit()

    if keys:
        s3 = get_s3_service()
        for key in keys:
            try:
                s3.delete_object(key)
            except Exception:
                logger.warning(
                    "Failed to delete S3 object during situation deletion",
                    extra={"s3_key": key, "situation_id": str(situation_id)},
                )


@router.get("/situations", response_model=SituationListResponse)
async def list_situations(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: SituationStatus | None = Query(default=None),
    search: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> SituationListResponse:
    # Global status counts (no filters applied) — all buckets always present
    counts_query = select(Situation.status, func.count(Situation.id)).group_by(Situation.status)
    counts_result = await db.execute(counts_query)
    status_counts = {status_enum.value: 0 for status_enum in SituationStatus}
    status_counts.update({status_enum.value: count for status_enum, count in counts_result.all()})

    count_query = select(func.count(Situation.id))
    if status is not None:
        count_query = count_query.where(Situation.status == status)
    if search:
        pattern = f"%{search}%"
        search_filter = or_(
            Situation.scenario_el.ilike(pattern),
            Situation.scenario_en.ilike(pattern),
            Situation.scenario_ru.ilike(pattern),
        )
        count_query = count_query.where(search_filter)
    total = (await db.execute(count_query)).scalar_one()

    dialog_ex_count_sq = (
        select(func.count(DialogExercise.id))
        .join(ListeningDialog, DialogExercise.dialog_id == ListeningDialog.id)
        .where(ListeningDialog.situation_id == Situation.id)
        .correlate(Situation)
        .scalar_subquery()
    )
    desc_ex_count_sq = (
        select(func.count(DescriptionExercise.id))
        .join(SituationDescription, DescriptionExercise.description_id == SituationDescription.id)
        .where(SituationDescription.situation_id == Situation.id)
        .correlate(Situation)
        .scalar_subquery()
    )
    pic_ex_count_sq = (
        select(func.count(PictureExercise.id))
        .join(SituationPicture, PictureExercise.picture_id == SituationPicture.id)
        .where(SituationPicture.situation_id == Situation.id)
        .correlate(Situation)
        .scalar_subquery()
    )

    data_query = (
        select(Situation, dialog_ex_count_sq, desc_ex_count_sq, pic_ex_count_sq)
        .options(
            selectinload(Situation.dialog),
            selectinload(Situation.description),
            selectinload(Situation.picture),
        )
        .order_by(Situation.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    if status is not None:
        data_query = data_query.where(Situation.status == status)
    if search:
        data_query = data_query.where(search_filter)

    result = await db.execute(data_query)
    rows = result.all()

    items = [
        SituationListItem(
            id=s.id,
            scenario_el=s.scenario_el,
            scenario_en=s.scenario_en,
            scenario_ru=s.scenario_ru,
            status=s.status,
            created_at=s.created_at,
            has_dialog=s.dialog is not None,
            has_description=s.description is not None,
            has_picture=s.picture is not None,
            has_dialog_audio=s.dialog is not None and s.dialog.audio_s3_key is not None,
            has_description_audio=s.description is not None
            and s.description.audio_s3_key is not None,
            description_timestamps_count=(
                (1 if s.description.word_timestamps else 0)
                + (1 if s.description.word_timestamps_a2 else 0)
                if s.description is not None
                else 0
            ),
            dialog_exercises_count=dlg_count,
            description_exercises_count=dsc_count,
            picture_exercises_count=pic_count,
        )
        for s, dlg_count, dsc_count, pic_count in rows
    ]
    return SituationListResponse(
        items=items, total=total, page=page, page_size=page_size, status_counts=status_counts
    )


@router.get("/situations/{situation_id}", response_model=SituationDetailResponse)
async def get_situation(
    situation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> SituationDetailResponse:
    result = await db.execute(
        select(Situation)
        .options(
            selectinload(Situation.dialog).selectinload(ListeningDialog.speakers),
            selectinload(Situation.dialog).selectinload(ListeningDialog.lines),
            selectinload(Situation.description),
            selectinload(Situation.picture),
        )
        .where(Situation.id == situation_id)
    )
    situation = result.scalar_one_or_none()
    if situation is None:
        raise HTTPException(status_code=404, detail="Situation not found")
    if situation.dialog:
        situation.dialog.speakers.sort(key=lambda s: s.speaker_index)
        situation.dialog.lines.sort(key=lambda ln: ln.line_index)
    response = SituationDetailResponse.model_validate(situation)
    if response.dialog and situation.dialog and situation.dialog.audio_s3_key:
        s3 = get_s3_service()
        response.dialog.audio_url = s3.generate_presigned_url(situation.dialog.audio_s3_key)
    if response.description and situation.description:
        s3 = get_s3_service()
        if situation.description.audio_s3_key:
            response.description.audio_url = s3.generate_presigned_url(
                situation.description.audio_s3_key
            )
        if situation.description.audio_a2_s3_key:
            response.description.audio_a2_url = s3.generate_presigned_url(
                situation.description.audio_a2_s3_key
            )
    return response


@router.get(
    "/situations/{situation_id}/exercises",
    response_model=SituationExercisesResponse,
)
async def get_situation_exercises(
    situation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> SituationExercisesResponse:
    result = await db.execute(
        select(Situation)
        .options(
            selectinload(Situation.dialog)
            .selectinload(ListeningDialog.exercises)
            .selectinload(DialogExercise.items),
            selectinload(Situation.description)
            .selectinload(SituationDescription.exercises)
            .selectinload(DescriptionExercise.items),
            selectinload(Situation.picture)
            .selectinload(SituationPicture.exercises)
            .selectinload(PictureExercise.items),
        )
        .where(Situation.id == situation_id)
    )
    situation = result.scalar_one_or_none()
    if situation is None:
        raise HTTPException(status_code=404, detail="Situation not found")

    def _build_exercise_responses(
        exercises: list,
        description: SituationDescription | None = None,
    ) -> list[SituationExerciseResponse]:
        s3 = get_s3_service() if description else None
        result = []
        for ex in exercises:
            audio_level = getattr(ex, "audio_level", None)
            modality = getattr(ex, "modality", None)
            audio_url = None
            reading_text = None
            if description and modality == ExerciseModality.LISTENING and s3:
                s3_key = (
                    description.audio_a2_s3_key
                    if audio_level == DeckLevel.A2
                    else description.audio_s3_key
                )
                if s3_key:
                    audio_url = s3.generate_presigned_url(s3_key)
            elif description and modality == ExerciseModality.READING:
                reading_text = (
                    description.text_el_a2
                    if audio_level == DeckLevel.A2 and description.text_el_a2
                    else description.text_el
                )
            resp = SituationExerciseResponse(
                id=ex.id,
                exercise_type=ex.exercise_type,
                status=ex.status,
                items=[SituationExerciseItemResponse.model_validate(item) for item in ex.items],
                audio_level=audio_level,
                modality=modality,
                audio_url=audio_url,
                reading_text=reading_text,
            )
            result.append(resp)
        return result

    groups = []

    dialog_exercises: list[SituationExerciseResponse] = []
    if situation.dialog:
        dialog_exercises = _build_exercise_responses(situation.dialog.exercises)
    groups.append(
        SituationExerciseGroupResponse(
            source_type=ExerciseSourceType.DIALOG,
            exercises=dialog_exercises,
            exercise_count=len(dialog_exercises),
        )
    )

    desc_exercises: list[SituationExerciseResponse] = []
    if situation.description:
        desc_exercises = _build_exercise_responses(
            situation.description.exercises, description=situation.description
        )
    groups.append(
        SituationExerciseGroupResponse(
            source_type=ExerciseSourceType.DESCRIPTION,
            exercises=desc_exercises,
            exercise_count=len(desc_exercises),
        )
    )

    pic_exercises: list[SituationExerciseResponse] = []
    if situation.picture:
        pic_exercises = _build_exercise_responses(situation.picture.exercises)
    groups.append(
        SituationExerciseGroupResponse(
            source_type=ExerciseSourceType.PICTURE,
            exercises=pic_exercises,
            exercise_count=len(pic_exercises),
        )
    )

    total = sum(g.exercise_count for g in groups)
    return SituationExercisesResponse(groups=groups, total_count=total)


def _apply_exercise_search_filter(stmt: Select, search: str | None) -> Select:
    """Apply situation title search filter to an exercise query that joins Situation."""
    if search:
        stmt = stmt.where(
            or_(
                Situation.scenario_el.ilike(f"%{search}%"),
                Situation.scenario_en.ilike(f"%{search}%"),
            )
        )
    return stmt


async def _query_description_exercises(
    db: AsyncSession,
    s3: S3Service,
    modality: ExerciseModality,
    exercise_type: ExerciseType | None,
    status: ExerciseStatus | None,
    search: str | None,
) -> list[AdminExerciseListItem]:
    """Query description exercises filtered by modality."""
    stmt = (
        select(DescriptionExercise, SituationDescription, Situation)
        .join(SituationDescription, DescriptionExercise.description_id == SituationDescription.id)
        .join(Situation, SituationDescription.situation_id == Situation.id)
        .options(selectinload(DescriptionExercise.items))
        .where(DescriptionExercise.modality == modality)
    )
    if exercise_type is not None:
        stmt = stmt.where(DescriptionExercise.exercise_type == exercise_type)
    if status is not None:
        stmt = stmt.where(DescriptionExercise.status == status)
    stmt = _apply_exercise_search_filter(stmt, search)

    rows = (await db.execute(stmt)).all()
    items: list[AdminExerciseListItem] = []
    for ex, description, situation in rows:
        audio_url = None
        reading_text = None
        if modality == ExerciseModality.LISTENING:
            s3_key = (
                description.audio_a2_s3_key
                if ex.audio_level == DeckLevel.A2
                else description.audio_s3_key
            )
            if s3_key:
                audio_url = s3.generate_presigned_url(s3_key)
        elif modality == ExerciseModality.READING:
            reading_text = (
                description.text_el_a2
                if ex.audio_level == DeckLevel.A2 and description.text_el_a2
                else description.text_el
            )
        items.append(
            AdminExerciseListItem(
                id=ex.id,
                exercise_type=ex.exercise_type,
                status=ex.status,
                source_type=ExerciseSourceType.DESCRIPTION,
                modality=modality,
                audio_level=ex.audio_level,
                situation_id=situation.id,
                situation_title_el=situation.scenario_el,
                situation_title_en=situation.scenario_en,
                audio_url=audio_url,
                reading_text=reading_text,
                item_count=len(ex.items),
                items=[SituationExerciseItemResponse.model_validate(item) for item in ex.items],
            )
        )
    return items


async def _query_listening_exercises(
    db: AsyncSession,
    s3: S3Service,
    exercise_type: ExerciseType | None,
    status: ExerciseStatus | None,
    search: str | None,
) -> list[AdminExerciseListItem]:
    """Query dialog and picture exercises (always listening modality)."""
    items: list[AdminExerciseListItem] = []

    # Dialog exercises
    dialog_stmt = (
        select(DialogExercise, ListeningDialog, Situation)
        .join(ListeningDialog, DialogExercise.dialog_id == ListeningDialog.id)
        .join(Situation, ListeningDialog.situation_id == Situation.id)
        .options(selectinload(DialogExercise.items))
    )
    if exercise_type is not None:
        dialog_stmt = dialog_stmt.where(DialogExercise.exercise_type == exercise_type)
    if status is not None:
        dialog_stmt = dialog_stmt.where(DialogExercise.status == status)
    dialog_stmt = _apply_exercise_search_filter(dialog_stmt, search)

    for ex, dialog, situation in (await db.execute(dialog_stmt)).all():
        audio_url = None
        if dialog.audio_s3_key:
            audio_url = s3.generate_presigned_url(dialog.audio_s3_key)
        items.append(
            AdminExerciseListItem(
                id=ex.id,
                exercise_type=ex.exercise_type,
                status=ex.status,
                source_type=ExerciseSourceType.DIALOG,
                modality=ExerciseModality.LISTENING,
                audio_level=None,
                situation_id=situation.id,
                situation_title_el=situation.scenario_el,
                situation_title_en=situation.scenario_en,
                audio_url=audio_url,
                reading_text=None,
                item_count=len(ex.items),
                items=[SituationExerciseItemResponse.model_validate(item) for item in ex.items],
            )
        )

    # Picture exercises
    pic_stmt = (
        select(PictureExercise, SituationPicture, Situation)
        .join(SituationPicture, PictureExercise.picture_id == SituationPicture.id)
        .join(Situation, SituationPicture.situation_id == Situation.id)
        .options(selectinload(PictureExercise.items))
    )
    if exercise_type is not None:
        pic_stmt = pic_stmt.where(PictureExercise.exercise_type == exercise_type)
    if status is not None:
        pic_stmt = pic_stmt.where(PictureExercise.status == status)
    pic_stmt = _apply_exercise_search_filter(pic_stmt, search)

    for ex, _picture, situation in (await db.execute(pic_stmt)).all():
        items.append(
            AdminExerciseListItem(
                id=ex.id,
                exercise_type=ex.exercise_type,
                status=ex.status,
                source_type=ExerciseSourceType.PICTURE,
                modality=ExerciseModality.LISTENING,
                audio_level=None,
                situation_id=situation.id,
                situation_title_el=situation.scenario_el,
                situation_title_en=situation.scenario_en,
                audio_url=None,
                reading_text=None,
                item_count=len(ex.items),
                items=[SituationExerciseItemResponse.model_validate(item) for item in ex.items],
            )
        )
    return items


_SOURCE_TYPE_ORDER = {
    ExerciseSourceType.DESCRIPTION: 0,
    ExerciseSourceType.DIALOG: 1,
    ExerciseSourceType.PICTURE: 2,
}


@router.get("/exercises", response_model=AdminExerciseListResponse)
async def list_admin_exercises(
    modality: ExerciseModality = Query(...),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    exercise_type: ExerciseType | None = Query(default=None),
    status: ExerciseStatus | None = Query(default=None),
    search: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> AdminExerciseListResponse:
    s3 = get_s3_service()

    all_items = await _query_description_exercises(db, s3, modality, exercise_type, status, search)

    if modality == ExerciseModality.LISTENING:
        all_items.extend(await _query_listening_exercises(db, s3, exercise_type, status, search))

    all_items.sort(
        key=lambda item: (
            item.situation_title_el,
            _SOURCE_TYPE_ORDER.get(item.source_type, 99),
            item.exercise_type.value,
        )
    )

    total = len(all_items)
    offset = (page - 1) * page_size
    page_items = all_items[offset : offset + page_size]

    return AdminExerciseListResponse(
        items=page_items,
        total=total,
        page=page,
        page_size=page_size,
    )


# ============================================================================
# Gamification Admin Endpoints
# ============================================================================


@router.post(
    "/users/{user_id}/recompute-gamification",
    response_model=ReconcileDiffResponse,
    summary="Force-recompute gamification state for a user (ops self-heal)",
    description=(
        "Runs GamificationReconciler in QUIET mode (no notifications) for the "
        "target user and returns the resulting diff (XP delta, level delta, "
        "newly-unlocked achievements). Use when a user reports stuck "
        "achievements or incorrect XP. Idempotent: running twice on a "
        "converged user returns an empty diff."
    ),
    responses={
        200: {"description": "Reconcile completed; diff payload returned (may be empty)."},
        404: {"description": "User not found."},
    },
)
async def recompute_user_gamification(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> ReconcileDiffResponse:
    # 1. Confirm user exists (404 otherwise)
    user_exists = await db.scalar(select(User.id).where(User.id == user_id))
    if user_exists is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found",
        )

    # 2. Capture pre-state level (reconciler returns total_xp_before but NOT level_before)
    level_before: int = (
        await db.scalar(select(UserXP.current_level).where(UserXP.user_id == user_id))
    ) or 1

    # 3. Run reconciler (QUIET = zero notifications). Reconciler flushes; we own commit.
    result = await GamificationReconciler.reconcile(db, user_id, mode=ReconcileMode.QUIET)
    await db.commit()

    # 4. Build diff payload
    diff = ReconcileDiffResponse(
        user_id=user_id,
        xp_before=result.total_xp_before,
        xp_after=result.total_xp_after,
        xp_delta=result.total_xp_after - result.total_xp_before,
        level_before=level_before,
        level_after=result.snapshot.current_level,
        level_delta=result.snapshot.current_level - level_before,
        leveled_up=result.leveled_up,
        newly_unlocked_ids=result.new_unlocks,
        newly_locked_ids=[],  # QUIET mode never locks; reserved for symmetry
        projection_version=result.snapshot.projection_version,
        computed_at=result.snapshot.computed_at,
    )

    # 5. Audit log (UUIDs only — never emails or PII per CLAUDE.md)
    logger.info(
        "admin_recompute_gamification",
        admin_user_id=str(current_user.id),
        target_user_id=str(user_id),
        xp_delta=diff.xp_delta,
        level_delta=diff.level_delta,
        leveled_up=diff.leveled_up,
        newly_unlocked_count=len(diff.newly_unlocked_ids),
        newly_unlocked_ids=diff.newly_unlocked_ids,
    )

    return diff
