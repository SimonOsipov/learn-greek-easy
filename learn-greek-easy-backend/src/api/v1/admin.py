"""Admin API endpoints.

This module provides HTTP endpoints for admin operations including:
- Dashboard statistics (deck and card counts)
- Unified deck listing with search and pagination
- Feedback management (list and update)

All endpoints require superuser authentication.
"""

import asyncio
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Any, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import case, delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import StreamingResponse

from src.config import settings
from src.core.dependencies import SSEAuthResult, get_current_superuser, get_sse_auth
from src.core.event_bus import audio_event_bus, news_audio_event_bus
from src.core.exceptions import (
    ConflictException,
    NotFoundException,
    NounGenerationError,
    OpenRouterError,
)
from src.core.logging import get_logger
from src.db.dependencies import get_db
from src.db.models import (
    AudioStatus,
    Card,
    CardErrorCardType,
    CardErrorStatus,
    CardRecord,
    CardSystemVersion,
    CultureDeck,
    CultureQuestion,
    Deck,
    DeckWordEntry,
    FeedbackCategory,
    FeedbackStatus,
    NewsItem,
    PartOfSpeech,
    User,
    WordEntry,
)
from src.db.session import get_session_factory
from src.repositories.deck import DeckRepository
from src.repositories.word_entry import WordEntryRepository
from src.schemas.admin import (
    AdminCultureQuestionItem,
    AdminCultureQuestionsResponse,
    AdminDeckListResponse,
    AdminStatsResponse,
    ArticleCheckResponse,
    GenerateCardsRequest,
    GenerateCardsResponse,
    GenerateWordEntryAudioRequest,
    GenerateWordEntryRequest,
    GenerateWordEntryResponse,
    NormalizationStageResult,
    PendingQuestionItem,
    PendingQuestionsResponse,
    QuestionApproveRequest,
    QuestionApproveResponse,
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
from src.schemas.feedback import (
    AdminFeedbackListResponse,
    AdminFeedbackResponse,
    AdminFeedbackUpdate,
    AuthorBriefResponse,
)
from src.schemas.news_item import (
    NewsItemResponse,
    NewsItemUpdate,
    NewsItemWithCardResponse,
    NewsItemWithQuestionCreate,
)
from src.schemas.nlp import (
    CrossAIVerificationResult,
    GeneratedNounData,
    NormalizedLemma,
    VerificationSummary,
)
from src.schemas.word_entry import WordEntryResponse
from src.services.announcement_service import AnnouncementService
from src.services.card_error_admin_service import CardErrorAdminService
from src.services.card_generator_service import CardGeneratorService
from src.services.changelog_service import ChangelogService
from src.services.cross_ai_verification_service import get_cross_ai_verification_service
from src.services.duplicate_detection_service import DuplicateDetectionService
from src.services.feedback_admin_service import FeedbackAdminService
from src.services.lemma_normalization_service import detect_article, get_lemma_normalization_service
from src.services.lexicon_service import LexiconService
from src.services.local_verification_service import get_local_verification_service
from src.services.news_item_service import NewsItemService
from src.services.noun_data_generation_service import get_noun_data_generation_service
from src.services.s3_service import get_s3_service
from src.services.translation_service import TranslationLookupService
from src.services.verification_tier import compute_combined_tier
from src.services.word_entry_response import word_entry_to_response
from src.tasks import (
    create_announcement_notifications_task,
    generate_a2_audio_for_news_item_task,
    generate_audio_for_news_item_task,
    generate_word_entry_part_audio_task,
    is_background_tasks_enabled,
)
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

    # Count cards in active vocabulary decks (V1 + V2)
    v1_card_count_result = await db.execute(
        select(func.count(Card.id))
        .join(Deck, Card.deck_id == Deck.id)
        .where(Deck.is_active.is_(True))
        .where(Deck.card_system == CardSystemVersion.V1)
    )
    v1_count = v1_card_count_result.scalar() or 0

    v2_word_count_result = await db.execute(
        select(func.count(WordEntry.id))
        .join(DeckWordEntry, DeckWordEntry.word_entry_id == WordEntry.id)
        .join(Deck, DeckWordEntry.deck_id == Deck.id)
        .where(Deck.is_active.is_(True))
        .where(Deck.card_system == CardSystemVersion.V2)
        .where(WordEntry.is_active.is_(True))
    )
    v2_count = v2_word_count_result.scalar() or 0

    total_vocabulary_cards = v1_count + v2_count

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
        # Count V1 cards per vocabulary deck
        v1_card_count_subquery = (
            select(Card.deck_id, func.count(Card.id).label("card_count"))
            .group_by(Card.deck_id)
            .subquery()
        )

        # Count V2 active word entries per vocabulary deck
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
                Deck.card_system,
                User.full_name.label("owner_name"),
                case(
                    (
                        Deck.card_system == CardSystemVersion.V2,
                        func.coalesce(v2_word_count_subquery.c.word_count, 0),
                    ),
                    else_=func.coalesce(v1_card_count_subquery.c.card_count, 0),
                ).label("item_count"),
                # Trilingual fields for edit forms
                Deck.name_el,
                Deck.name_en,
                Deck.name_ru,
                Deck.description_el,
                Deck.description_en,
                Deck.description_ru,
            )
            .outerjoin(v1_card_count_subquery, Deck.id == v1_card_count_subquery.c.deck_id)
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
                    card_system=row.card_system.value,
                    # Trilingual fields for edit forms
                    name_el=row.name_el,
                    name_en=row.name_en,
                    name_ru=row.name_ru,
                    description_el=row.description_el,
                    description_en=row.description_en,
                    description_ru=row.description_ru,
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

        for row in culture_rows:
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

    # Data query with LEFT JOIN for A2 audio
    data_query = (
        select(
            CultureQuestion,
            NewsItem.audio_a2_s3_key.label("news_item_audio_a2_s3_key"),
        )
        .outerjoin(NewsItem, CultureQuestion.news_item_id == NewsItem.id)
        .where(*base_conditions)
        .order_by(order_expr)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(data_query)

    items = []
    for row in result.all():
        question = row[0]
        news_audio = row[1]
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
                news_item_id=question.news_item_id,
                original_article_url=question.original_article_url,
                order_index=question.order_index,
                news_item_audio_a2_s3_key=news_audio,
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
    response_model=NewsItemWithCardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create news item with optional question",
    description="Create a new news item, optionally with a linked culture question. Requires superuser privileges.",
    responses={
        201: {
            "description": "News item created successfully",
            "content": {
                "application/json": {
                    "example": {
                        "news_item": {
                            "id": "550e8400-e29b-41d4-a716-446655440000",
                            "title_el": "Ελληνικός Τίτλος",
                            "title_en": "English Title",
                            "title_ru": "Русский заголовок",
                            "description_el": "Ελληνική περιγραφή",
                            "description_en": "English description",
                            "description_ru": "Русское описание",
                            "publication_date": "2024-01-15",
                            "original_article_url": "https://example.com/article",
                            "image_url": "https://s3.amazonaws.com/...",
                            "created_at": "2024-01-15T10:30:00Z",
                            "updated_at": "2024-01-15T10:30:00Z",
                        },
                        "card": {
                            "id": "660e8400-e29b-41d4-a716-446655440001",
                            "deck_id": "770e8400-e29b-41d4-a716-446655440002",
                            "question_text": {"el": "Ερώτηση", "en": "Question"},
                        },
                        "message": "News item and question created successfully",
                    }
                }
            },
        },
        400: {"description": "Invalid request (image download failed, invalid question data)"},
        409: {"description": "News item with this URL already exists"},
    },
)
async def create_news_item(
    data: NewsItemWithQuestionCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> NewsItemWithCardResponse:
    """Create a new news item with optional question (admin only).

    Downloads the image from source_image_url, uploads to S3, and creates
    the news item in the database. If question data is provided, creates
    a linked CultureQuestion in the specified deck. Schedules background
    audio generation for the Greek description.

    Args:
        data: News item creation data with optional question
        background_tasks: FastAPI background tasks handler
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Returns:
        NewsItemWithCardResponse with news item, optional card, and message

    Raises:
        400: If image download fails or question validation error
        409: If original_article_url already exists
    """
    service = NewsItemService(db)
    try:
        result = await service.create_with_question(data)
    except ValueError as e:
        error_msg = str(e)
        if "already exists" in error_msg:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

    # Schedule audio generation in background (DB commit already happened inside service)
    background_tasks.add_task(
        generate_audio_for_news_item_task,
        news_item_id=result.news_item.id,
        description_el=data.description_el,
        db_url=settings.database_url,
    )

    description_el_a2 = (data.description_el_a2 or "").strip()
    if description_el_a2:
        background_tasks.add_task(
            generate_a2_audio_for_news_item_task,
            news_item_id=result.news_item.id,
            description_el_a2=description_el_a2,
            db_url=settings.database_url,
        )

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
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> NewsItemResponse:
    """Update an existing news item (admin only).

    If source_image_url is provided, downloads the new image and replaces
    the existing one in S3. If description_el is updated, schedules background
    audio regeneration.

    Args:
        news_item_id: UUID of the news item to update
        data: Fields to update (all optional)
        background_tasks: FastAPI background tasks handler
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
        result = await service.update(news_item_id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if data.description_el is not None:
        background_tasks.add_task(
            generate_audio_for_news_item_task,
            news_item_id=news_item_id,
            description_el=data.description_el,
            db_url=settings.database_url,
        )

    _description_el_a2 = (data.description_el_a2 or "").strip()
    if _description_el_a2:
        background_tasks.add_task(
            generate_a2_audio_for_news_item_task,
            news_item_id=news_item_id,
            description_el_a2=_description_el_a2,
            db_url=settings.database_url,
        )

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


@router.post(
    "/news/{news_item_id}/regenerate-audio",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Regenerate audio for news item",
    description="Trigger audio regeneration for a news item's Greek description. Requires superuser privileges.",
    responses={
        202: {
            "description": "Audio regeneration started",
            "content": {"application/json": {"example": {"message": "Audio regeneration started"}}},
        },
        400: {"description": "News item has no Greek description"},
        404: {"description": "News item not found"},
        503: {"description": "Audio service unavailable"},
    },
)
async def regenerate_news_audio(
    news_item_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> dict:
    # Gate check: both background tasks and ElevenLabs must be available
    if not is_background_tasks_enabled() or not settings.elevenlabs_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Audio generation is not available",
        )

    # Fetch news item directly
    result = await db.execute(select(NewsItem).where(NewsItem.id == news_item_id))
    news_item = result.scalar_one_or_none()
    if news_item is None:
        raise NotFoundException(
            resource="News item",
            detail=f"News item with ID '{news_item_id}' not found",
        )

    # Validate Greek description exists
    if not news_item.description_el or not news_item.description_el.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="News item has no Greek description for audio generation",
        )

    # Schedule background audio generation
    background_tasks.add_task(
        generate_audio_for_news_item_task,
        news_item_id=news_item_id,
        description_el=news_item.description_el,
        db_url=settings.database_url,
    )

    logger.info(
        "Audio regeneration scheduled for news item",
        extra={
            "news_item_id": str(news_item_id),
            "triggered_by": str(current_user.id),
            "text_length": len(news_item.description_el),
        },
    )

    return {"message": "Audio regeneration started"}


@router.post(
    "/news/{news_item_id}/regenerate-a2-audio",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Regenerate A2 audio for news item",
    description="Trigger A2-level audio regeneration for a news item's simplified Greek description. Requires superuser privileges.",
    responses={
        202: {
            "description": "A2 audio regeneration started",
            "content": {
                "application/json": {"example": {"message": "A2 audio regeneration started"}}
            },
        },
        404: {"description": "News item not found or no A2 Greek description"},
        503: {"description": "Audio service unavailable"},
    },
)
async def regenerate_a2_news_audio(
    news_item_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> dict:
    if not is_background_tasks_enabled() or not settings.elevenlabs_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Audio generation is not available",
        )

    result = await db.execute(select(NewsItem).where(NewsItem.id == news_item_id))
    news_item = result.scalar_one_or_none()
    if news_item is None:
        raise NotFoundException(
            resource="News item",
            detail=f"News item with ID '{news_item_id}' not found",
        )

    if not news_item.description_el_a2 or not news_item.description_el_a2.strip():
        raise NotFoundException(
            resource="A2 description",
            detail=f"News item with ID '{news_item_id}' has no A2 Greek description",
        )

    background_tasks.add_task(
        generate_a2_audio_for_news_item_task,
        news_item_id=news_item_id,
        description_el_a2=news_item.description_el_a2,
        db_url=settings.database_url,
    )

    logger.info(
        "A2 audio regeneration scheduled for news item",
        extra={
            "news_item_id": str(news_item_id),
            "triggered_by": str(current_user.id),
            "text_length": len(news_item.description_el_a2),
        },
    )

    return {"message": "A2 audio regeneration started"}


async def _fetch_news_item_for_sse(news_item_id: UUID) -> NewsItem | None:
    """Load a NewsItem using a short-lived session (DB-free generator pattern)."""
    factory = get_session_factory()
    async with factory.begin() as db:
        stmt = select(NewsItem).where(NewsItem.id == news_item_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()


_NEWS_AUDIO_TERMINAL_EVENTS = {"audio_completed", "audio_failed"}
_NEWS_AUDIO_SAFETY_TIMEOUT = 300.0  # 5 minutes


async def _wait_for_news_audio_event(
    queue: asyncio.Queue,
    deadline: float,
) -> dict | None:
    """Wait for the next event respecting the 5-minute deadline.

    Returns the event dict, or None if the overall deadline has been exceeded.
    Uses 30s sub-timeouts to keep the loop responsive without breaking early.
    """
    while True:
        remaining = deadline - asyncio.get_event_loop().time()
        if remaining <= 0:
            return None
        try:
            return await asyncio.wait_for(queue.get(), timeout=min(remaining, 30.0))
        except (asyncio.TimeoutError, TimeoutError):
            # 30s slice elapsed; re-check overall deadline before retrying.
            if asyncio.get_event_loop().time() >= deadline:
                return None


async def _news_audio_queue_generator(
    queue: asyncio.Queue,
    bus_key: str,
) -> AsyncGenerator[str, None]:
    """Read from news_audio_event_bus until all started levels are terminal or timeout."""
    started_levels: set[str] = set()
    terminal_levels: set[str] = set()
    deadline = asyncio.get_event_loop().time() + _NEWS_AUDIO_SAFETY_TIMEOUT

    try:
        while True:
            event_data = await _wait_for_news_audio_event(queue, deadline)
            if event_data is None:
                break

            level = event_data.get("level") or event_data.get("data", {}).get("level")
            event_type = event_data.get("type", "audio_progress")

            if level:
                started_levels.add(level)
                if event_type in _NEWS_AUDIO_TERMINAL_EVENTS:
                    terminal_levels.add(level)

            yield format_sse_event(event_data, event=event_type)

            if started_levels and terminal_levels >= started_levels:
                break
    except asyncio.CancelledError:
        pass
    finally:
        await news_audio_event_bus.unsubscribe(bus_key, queue)


async def _news_audio_event_generator(news_item_id: UUID) -> AsyncGenerator[str, None]:
    """Yield a connected event then stream news audio progress events from the bus."""
    yield format_sse_event({}, event="connected")

    bus_key = f"news_audio:{news_item_id}"
    queue = await news_audio_event_bus.subscribe(bus_key)
    async for chunk in sse_stream(_news_audio_queue_generator(queue, bus_key)):
        yield chunk


@router.get(
    "/news/{news_item_id}/audio/stream",
    summary="Stream news audio generation progress via SSE",
    responses={200: {"content": {"text/event-stream": {}}}},
)
async def stream_news_audio(
    news_item_id: UUID,
    sse_auth: SSEAuthResult = Depends(get_sse_auth),
) -> StreamingResponse:
    """SSE stream for news item audio generation progress. Admin only."""
    if not sse_auth.is_authenticated:
        return _sse_single_error(
            sse_auth.error_code or "auth_required",
            sse_auth.error_message or "Authentication required",
        )

    assert sse_auth.user is not None
    if not sse_auth.user.is_superuser:
        return _sse_single_error("forbidden", "Superuser privileges required")

    news_item = await asyncio.shield(_fetch_news_item_for_sse(news_item_id))
    if news_item is None:
        return _sse_single_error("not_found", f"News item {news_item_id} not found")

    return create_sse_response(_news_audio_event_generator(news_item_id))


@router.get(
    "/news/questions/{question_id}",
    response_model=PendingQuestionItem,
    summary="Get culture question for news item",
)
async def get_news_question(
    question_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> PendingQuestionItem:
    """Fetch any culture question by ID regardless of pending status."""
    result = await db.execute(select(CultureQuestion).where(CultureQuestion.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise NotFoundException(resource="Question", detail=f"Question '{question_id}' not found")
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


@router.post(
    "/word-entries/{word_entry_id}/generate-audio",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Generate audio for a word entry part",
)
async def generate_word_entry_audio(
    word_entry_id: UUID,
    request: GenerateWordEntryAudioRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> dict:
    if not is_background_tasks_enabled() or not settings.elevenlabs_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Audio generation is not available",
        )

    result = await db.execute(select(WordEntry).where(WordEntry.id == word_entry_id))
    word_entry = result.scalar_one_or_none()
    if word_entry is None:
        raise NotFoundException(
            resource="Word entry",
            detail=f"Word entry with ID '{word_entry_id}' not found",
        )

    if request.part == "lemma":
        text = resolve_tts_text(
            word_entry.lemma, word_entry.part_of_speech.value, word_entry.grammar_data
        )
        word_entry.audio_status = AudioStatus.GENERATING
        word_entry.audio_generating_since = datetime.now(timezone.utc)
    else:
        examples = word_entry.examples or []
        example_dict = None
        example_index = None
        for idx, ex in enumerate(examples):
            if ex.get("id") == request.example_id:
                example_dict = ex
                example_index = idx
                break
        if example_dict is None or example_index is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Example with ID '{request.example_id}' not found",
            )
        text = example_dict.get("greek", "")
        updated_examples = list(examples)
        updated_examples[example_index] = {
            **example_dict,
            "audio_status": "generating",
            "audio_generating_since": datetime.now(timezone.utc).isoformat(),
        }
        word_entry.examples = updated_examples

    await db.commit()

    background_tasks.add_task(
        generate_word_entry_part_audio_task,
        word_entry_id=word_entry_id,
        part=request.part,
        example_id=request.example_id,
        text=text,
        db_url=settings.database_url,
    )

    logger.info(
        "Word entry audio generation scheduled",
        extra={
            "word_entry_id": str(word_entry_id),
            "part": request.part,
            "example_id": request.example_id,
            "triggered_by": str(current_user.id),
        },
    )
    return {"message": "Audio generation started"}


# ============================================================
# Audio SSE helpers
# ============================================================

_TERMINAL_AUDIO_STATUSES = {"ready", "failed", "missing"}


def _build_audio_status_event(
    word_entry_id: UUID,
    part: str,
    example_id: str | None,
    audio_status: str,
    audio_key: str | None,
) -> dict:
    """Build a single audio status event payload."""
    s3 = get_s3_service()
    audio_url = (
        s3.generate_presigned_url(audio_key) if audio_status == "ready" and audio_key else None
    )
    return {
        "word_entry_id": str(word_entry_id),
        "part": part,
        "example_id": example_id,
        "status": audio_status,
        "audio_url": audio_url,
    }


def _collect_initial_audio_events(word_entry: Any) -> list[dict]:
    """Collect current audio status for lemma and all examples."""
    events: list[dict] = []

    # Lemma
    lemma_status = (
        word_entry.audio_status.value
        if hasattr(word_entry.audio_status, "value")
        else str(word_entry.audio_status)
    )
    events.append(
        _build_audio_status_event(
            word_entry_id=word_entry.id,
            part="lemma",
            example_id=None,
            audio_status=lemma_status,
            audio_key=word_entry.audio_key,
        )
    )

    # Examples
    for ex in word_entry.examples or []:
        ex_id = ex.get("id")
        if not ex_id:
            continue
        ex_status = ex.get("audio_status") or "missing"
        events.append(
            _build_audio_status_event(
                word_entry_id=word_entry.id,
                part="example",
                example_id=str(ex_id),
                audio_status=ex_status,
                audio_key=ex.get("audio_key"),
            )
        )

    return events


# ============================================================
# Audio SSE endpoint
# ============================================================


def _sse_single_error(code: str, message: str) -> StreamingResponse:
    """Return an SSE response containing a single error event."""

    async def _gen() -> AsyncGenerator[str, None]:
        yield format_sse_error(code, message)

    return create_sse_response(_gen())


async def _fetch_word_entry_for_sse(word_entry_id: UUID) -> WordEntry | None:
    """Load a WordEntry using a short-lived session (DB-free generator pattern)."""
    factory = get_session_factory()
    async with factory.begin() as db:
        stmt = select(WordEntry).where(WordEntry.id == word_entry_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()


async def _word_audio_event_generator(
    word_entry_id: UUID,
    initial_events: list[dict],
    all_terminal: bool,
) -> AsyncGenerator[str, None]:
    """Yield initial status events, then subscribe to the bus until all parts are terminal."""
    bus_key = f"word_audio:{word_entry_id}"

    if not all_terminal:
        # Subscribe BEFORE yielding initial events so no ready/failed update
        # published in the gap between the DB snapshot and subscribe is missed.
        queue = await audio_event_bus.subscribe(bus_key)

    for ev in initial_events:
        yield format_sse_event(ev, event="audio_status_changed")

    if all_terminal:
        return

    terminal_parts: set[tuple[str, str | None]] = {
        (ev["part"], ev.get("example_id"))
        for ev in initial_events
        if ev["status"] in _TERMINAL_AUDIO_STATUSES
    }
    all_part_keys: set[tuple[str, str | None]] = {
        (ev["part"], ev.get("example_id")) for ev in initial_events
    }

    try:
        async for chunk in sse_stream(
            _audio_queue_generator(queue, all_part_keys, terminal_parts),
        ):
            yield chunk
    finally:
        await audio_event_bus.unsubscribe(bus_key, queue)


@router.get(
    "/word-entries/{word_entry_id}/audio/stream",
    summary="Stream word entry audio generation status via SSE",
    responses={200: {"content": {"text/event-stream": {}}}},
)
async def stream_word_entry_audio(
    word_entry_id: UUID,
    sse_auth: SSEAuthResult = Depends(get_sse_auth),
) -> StreamingResponse:
    """SSE stream for real-time audio generation status updates. Admin only."""
    if not sse_auth.is_authenticated:
        return _sse_single_error(
            sse_auth.error_code or "auth_required",
            sse_auth.error_message or "Authentication required",
        )

    assert sse_auth.user is not None
    if not sse_auth.user.is_superuser:
        return _sse_single_error("forbidden", "Superuser privileges required")

    word_entry = await asyncio.shield(_fetch_word_entry_for_sse(word_entry_id))
    if word_entry is None:
        return _sse_single_error("not_found", f"Word entry {word_entry_id} not found")

    initial_events = _collect_initial_audio_events(word_entry)
    all_terminal = all(ev["status"] in _TERMINAL_AUDIO_STATUSES for ev in initial_events)

    return create_sse_response(
        _word_audio_event_generator(word_entry_id, initial_events, all_terminal)
    )


async def _audio_queue_generator(
    queue: asyncio.Queue,
    all_part_keys: set[tuple[str, str | None]],
    terminal_parts: set[tuple[str, str | None]],
) -> AsyncGenerator[str, None]:
    """Inner generator that reads from the audio event bus queue until all parts are terminal."""
    while True:
        payload: dict = await queue.get()
        pk = (payload.get("part", ""), payload.get("example_id"))
        yield format_sse_event(payload, event="audio_status_changed")
        if payload.get("status") in _TERMINAL_AUDIO_STATUSES:
            terminal_parts.add(pk)
        if terminal_parts >= all_part_keys:
            break


def _validate_meaning_eligibility(word_entry: "WordEntry") -> None:
    if not word_entry.translation_en or not word_entry.translation_ru:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Meaning cards require both translation_en and translation_ru",
        )


def _validate_plural_form_noun(gd: dict) -> None:
    sg = (gd.get("cases") or {}).get("singular", {}).get("nominative")
    pl = (gd.get("cases") or {}).get("plural", {}).get("nominative")
    if not sg or not pl:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Plural form cards for nouns require singular and plural nominative in grammar_data.cases",
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
    nom_sg = (gd.get("cases") or {}).get("singular", {}).get("nominative")
    if not gender or not nom_sg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Article cards require gender and singular nominative in grammar_data",
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


async def _run_verification_stage(
    generated_data: GeneratedNounData,
    normalized_lemma: NormalizedLemma,
    lexicon_svc: LexiconService | None,
    lemma: str,
    secondary_data: GeneratedNounData | None = None,
    translation_lookup: TranslationLookupStageResult | None = None,
) -> VerificationSummary:
    """Run local + cross-AI verification and compute combined tier."""
    local_svc = get_local_verification_service()
    cross_svc = get_cross_ai_verification_service()

    # morphology_source: check if lexicon has declension data
    if lexicon_svc is not None:
        lexicon_declensions = await lexicon_svc.get_declensions(lemma, pos="NOUN")
    else:
        factory = get_session_factory()
        async with factory.begin() as _db:
            _lex_svc = LexiconService(_db)
            lexicon_declensions = await _lex_svc.get_declensions(lemma, pos="NOUN")
    morphology_source: Literal["lexicon", "llm"] = "lexicon" if lexicon_declensions else "llm"

    # Run local verification (sync service, wrapped in executor)
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

    # Cross-AI: compare if secondary_data available, otherwise error result
    if secondary_data is not None:
        cross_result = cross_svc.compare(generated_data, secondary_data)
    else:
        cross_result = CrossAIVerificationResult(error="Secondary generation failed or skipped")

    # Combined tier logic
    if cross_result.error is None and cross_result.overall_agreement is not None:
        combined_tier = compute_combined_tier(local_result.tier, cross_result.overall_agreement)
    else:
        combined_tier = local_result.tier

    return VerificationSummary(
        local=local_result,
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
async def generate_word_entry(
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

    # Validate deck is V2
    if deck.card_system != CardSystemVersion.V2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Word generation is only supported for V2 vocabulary decks",
        )

    # Stage 0.5: Lexicon lookup (async DB query)
    _, bare_word = detect_article(request.word)
    lexicon_svc = LexiconService(db)
    lexicon_entry = await lexicon_svc.lookup(bare_word, pos="NOUN")

    # Stage 1: Normalization (synchronous -- CPU-bound NLP)
    svc = get_lemma_normalization_service()
    try:
        smart_result = svc.normalize_smart(
            request.word, expected_pos="NOUN", lexicon_entry=lexicon_entry
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
    _ARTICLE_GENDER_OVERRIDE = {"ο": "masculine", "η": "feminine", "το": "neuter"}
    detected_art = smart_result.detected_article
    if detected_art in _ARTICLE_GENDER_OVERRIDE:
        primary_gender = _ARTICLE_GENDER_OVERRIDE[detected_art]
        primary_article = detected_art

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

    _ARTICLE_GENDER_OVERRIDE = {"ο": "masculine", "η": "feminine", "το": "neuter"}
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

        if deck.card_system != CardSystemVersion.V2:
            yield format_sse_event(
                {
                    "error": "Word generation is only supported for V2 vocabulary decks",
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
    _, bare_word = detect_article(request.word)
    factory = get_session_factory()
    async with factory.begin() as _db:
        result = await _db.execute(select(Deck).where(Deck.id == request.deck_id))
        deck = result.scalar_one_or_none()
        lexicon_entry = None
        if deck is not None and deck.is_active and deck.card_system == CardSystemVersion.V2:
            lexicon_svc_inner = LexiconService(_db)
            try:
                lexicon_entry = await lexicon_svc_inner.lookup(bare_word, pos="NOUN")
            except Exception:
                lexicon_entry = None

    if deck is None or not deck.is_active:
        yield format_sse_event(
            {"error": f"Active deck with ID '{request.deck_id}' not found", "stage": "validation"},
            event="pipeline_failed",
        )
        return

    if deck.card_system != CardSystemVersion.V2:
        yield format_sse_event(
            {
                "error": "Word generation is only supported for V2 vocabulary decks",
                "stage": "validation",
            },
            event="pipeline_failed",
        )
        return

    # Stage 1: Normalization
    svc = get_lemma_normalization_service()
    try:
        smart_result = svc.normalize_smart(
            request.word, expected_pos="NOUN", lexicon_entry=lexicon_entry
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

    # Validate deck is active and V2 (word entries are only for V2 decks)
    if not deck.is_active or deck.card_system != CardSystemVersion.V2:
        raise ConflictException(
            detail=f"Deck '{deck_id}' is not an active V2 deck. Word entries can only be linked to active V2 decks."
        )

    # Validate word entry exists and is active
    word_entry = await word_entry_repo.get(word_entry_id)
    if word_entry is None or not word_entry.is_active:
        raise NotFoundException(
            resource="WordEntry",
            detail=f"Word entry with id '{word_entry_id}' not found or inactive",
        )

    # Check if deck already has a word entry with same lemma+POS (via junction)
    duplicate_check = await db.execute(
        select(WordEntry.id)
        .join(DeckWordEntry, DeckWordEntry.word_entry_id == WordEntry.id)
        .where(
            DeckWordEntry.deck_id == deck_id,
            WordEntry.lemma == word_entry.lemma,
            WordEntry.part_of_speech == word_entry.part_of_speech,
            WordEntry.id != word_entry_id,
        )
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
