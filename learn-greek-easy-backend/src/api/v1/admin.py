"""Admin API endpoints.

This module provides HTTP endpoints for admin operations including:
- Dashboard statistics (deck and card counts)
- Unified deck listing with search and pagination
- Feedback management (list and update)

All endpoints require superuser authentication.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.dependencies import get_current_superuser
from src.core.exceptions import NotFoundException
from src.core.logging import get_logger
from src.db.dependencies import get_db
from src.db.models import (
    Card,
    CultureDeck,
    CultureQuestion,
    Deck,
    FeedbackCategory,
    FeedbackStatus,
    User,
)
from src.schemas.admin import (
    AdminCultureQuestionItem,
    AdminCultureQuestionsResponse,
    AdminDeckListResponse,
    AdminStatsResponse,
    ArticleCheckResponse,
    PendingQuestionItem,
    PendingQuestionsResponse,
    QuestionApproveRequest,
    QuestionApproveResponse,
    UnifiedDeckItem,
)
from src.schemas.announcement import (
    AnnouncementCreate,
    AnnouncementCreateResponse,
    AnnouncementDetailResponse,
    AnnouncementListResponse,
    AnnouncementWithCreatorResponse,
    CreatorBriefResponse,
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
from src.services.announcement_service import AnnouncementService
from src.services.changelog_service import ChangelogService
from src.services.feedback_admin_service import FeedbackAdminService
from src.services.news_item_service import NewsItemService
from src.tasks import create_announcement_notifications_task

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

    # Count cards in active vocabulary decks
    card_count_result = await db.execute(
        select(func.count(Card.id))
        .join(Deck, Card.deck_id == Deck.id)
        .where(Deck.is_active.is_(True))
    )
    total_vocabulary_cards = card_count_result.scalar() or 0

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
        # Count cards per vocabulary deck
        vocab_card_count_subquery = (
            select(Card.deck_id, func.count(Card.id).label("card_count"))
            .group_by(Card.deck_id)
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
                User.full_name.label("owner_name"),
                func.coalesce(vocab_card_count_subquery.c.card_count, 0).label("item_count"),
            )
            .outerjoin(vocab_card_count_subquery, Deck.id == vocab_card_count_subquery.c.deck_id)
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
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
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

    Returns:
        AdminCultureQuestionsResponse with paginated questions

    Raises:
        404: If deck not found
    """
    # Verify deck exists
    deck_result = await db.execute(select(CultureDeck).where(CultureDeck.id == deck_id))
    deck = deck_result.scalar_one_or_none()

    if not deck:
        raise NotFoundException(
            resource="Culture deck", detail=f"Culture deck with ID '{deck_id}' not found"
        )

    # Count total questions in deck (including pending)
    count_result = await db.execute(
        select(func.count(CultureQuestion.id)).where(CultureQuestion.deck_id == deck_id)
    )
    total = count_result.scalar() or 0

    # Get paginated questions
    offset = (page - 1) * page_size
    result = await db.execute(
        select(CultureQuestion)
        .where(CultureQuestion.deck_id == deck_id)
        .order_by(CultureQuestion.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    questions = result.scalars().all()

    return AdminCultureQuestionsResponse(
        questions=[
            AdminCultureQuestionItem(
                id=q.id,
                question_text=q.question_text,
                option_a=q.option_a,
                option_b=q.option_b,
                option_c=q.option_c,
                option_d=q.option_d,
                correct_option=q.correct_option,
                source_article_url=q.source_article_url,
                is_pending_review=q.is_pending_review,
                created_at=q.created_at,
            )
            for q in questions
        ],
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> NewsItemWithCardResponse:
    """Create a new news item with optional question (admin only).

    Downloads the image from source_image_url, uploads to S3, and creates
    the news item in the database. If question data is provided, creates
    a linked CultureQuestion in the specified deck.

    Args:
        data: News item creation data with optional question
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
        return await service.create_with_question(data)
    except ValueError as e:
        error_msg = str(e)
        if "already exists" in error_msg:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)


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
        return await service.update(news_item_id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


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
