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

from src.core.dependencies import get_current_superuser
from src.core.exceptions import NotFoundException
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
    AdminDeckListResponse,
    AdminStatsResponse,
    AnalysisStartedResponse,
    CultureDeckStatsItem,
    DeckStatsItem,
    NewsSourceCreate,
    NewsSourceListResponse,
    NewsSourceResponse,
    NewsSourceUpdate,
    SourceFetchHistoryDetailResponse,
    SourceFetchHistoryItem,
    SourceFetchHistoryListResponse,
    SourceFetchHtmlResponse,
    UnifiedDeckItem,
)
from src.schemas.feedback import (
    AdminFeedbackListResponse,
    AdminFeedbackResponse,
    AdminFeedbackUpdate,
    AuthorBriefResponse,
)
from src.services.feedback_admin_service import FeedbackAdminService
from src.services.news_source_service import DuplicateURLException, NewsSourceService
from src.services.source_fetch_service import SourceFetchService

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
                        "total_cards": 450,
                        "total_vocabulary_decks": 6,
                        "total_culture_decks": 2,
                        "total_vocabulary_cards": 360,
                        "total_culture_questions": 90,
                        "decks": [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440000",
                                "name": "A1 Vocabulary",
                                "level": "A1",
                                "card_count": 60,
                            }
                        ],
                        "culture_decks": [
                            {
                                "id": "660e8400-e29b-41d4-a716-446655440000",
                                "name": "History",
                                "category": "history",
                                "question_count": 45,
                            }
                        ],
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
    - Total number of items across all active decks (cards + questions)
    - Per-deck breakdown with counts

    Only active decks are included in the statistics.

    Args:
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Returns:
        AdminStatsResponse with deck and card counts

    Raises:
        401: If not authenticated
        403: If authenticated but not superuser
    """
    # ========================================
    # Vocabulary Decks Statistics
    # ========================================

    # Subquery to count cards per vocabulary deck
    card_count_subquery = (
        select(Card.deck_id, func.count(Card.id).label("card_count"))
        .group_by(Card.deck_id)
        .subquery()
    )

    # Main query: get active vocabulary decks with card counts
    vocab_query = (
        select(
            Deck.id,
            Deck.name,
            Deck.level,
            func.coalesce(card_count_subquery.c.card_count, 0).label("card_count"),
        )
        .outerjoin(card_count_subquery, Deck.id == card_count_subquery.c.deck_id)
        .where(Deck.is_active.is_(True))
        .order_by(Deck.level, Deck.name)
    )

    vocab_result = await db.execute(vocab_query)
    vocab_rows = vocab_result.all()

    # Build vocabulary deck stats list
    deck_stats = [
        DeckStatsItem(
            id=row.id,
            name=row.name,
            level=row.level,
            card_count=row.card_count,
        )
        for row in vocab_rows
    ]

    # Calculate vocabulary totals
    total_vocabulary_decks = len(deck_stats)
    total_vocabulary_cards = sum(deck.card_count for deck in deck_stats)

    # ========================================
    # Culture Decks Statistics
    # ========================================

    # Subquery to count questions per culture deck (only from active decks)
    question_count_subquery = (
        select(
            CultureQuestion.deck_id,
            func.count(CultureQuestion.id).label("question_count"),
        )
        .join(CultureDeck, CultureQuestion.deck_id == CultureDeck.id)
        .where(CultureDeck.is_active.is_(True))
        .group_by(CultureQuestion.deck_id)
        .subquery()
    )

    # Main query: get active culture decks with question counts
    culture_query = (
        select(
            CultureDeck.id,
            CultureDeck.name,
            CultureDeck.category,
            func.coalesce(question_count_subquery.c.question_count, 0).label("question_count"),
        )
        .outerjoin(question_count_subquery, CultureDeck.id == question_count_subquery.c.deck_id)
        .where(CultureDeck.is_active.is_(True))
        .order_by(CultureDeck.category, CultureDeck.order_index)
    )

    culture_result = await db.execute(culture_query)
    culture_rows = culture_result.all()

    # Build culture deck stats list
    culture_deck_stats = [
        CultureDeckStatsItem(
            id=row.id,
            name=row.name,
            category=row.category,
            question_count=row.question_count,
        )
        for row in culture_rows
    ]

    # Calculate culture totals
    total_culture_decks = len(culture_deck_stats)
    total_culture_questions = sum(deck.question_count for deck in culture_deck_stats)

    # ========================================
    # Combined Totals
    # ========================================
    total_decks = total_vocabulary_decks + total_culture_decks
    total_cards = total_vocabulary_cards + total_culture_questions

    return AdminStatsResponse(
        total_decks=total_decks,
        total_cards=total_cards,
        total_vocabulary_decks=total_vocabulary_decks,
        total_culture_decks=total_culture_decks,
        total_vocabulary_cards=total_vocabulary_cards,
        total_culture_questions=total_culture_questions,
        decks=deck_stats,
        culture_decks=culture_deck_stats,
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
                Deck.name,
                Deck.level,
                Deck.is_active,
                Deck.is_premium,
                Deck.created_at,
                func.coalesce(vocab_card_count_subquery.c.card_count, 0).label("item_count"),
            )
            .outerjoin(vocab_card_count_subquery, Deck.id == vocab_card_count_subquery.c.deck_id)
            .where(Deck.is_active.is_(True))
        )

        # Apply search filter
        if search:
            vocab_query = vocab_query.where(Deck.name.ilike(f"%{search}%"))

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

        culture_query = (
            select(
                CultureDeck.id,
                CultureDeck.name,
                CultureDeck.category,
                CultureDeck.is_active,
                CultureDeck.is_premium,
                CultureDeck.created_at,
                func.coalesce(culture_question_count_subquery.c.question_count, 0).label(
                    "item_count"
                ),
            )
            .outerjoin(
                culture_question_count_subquery,
                CultureDeck.id == culture_question_count_subquery.c.deck_id,
            )
            .where(CultureDeck.is_active.is_(True))
        )

        # Apply search filter
        if search:
            culture_query = culture_query.where(CultureDeck.name.ilike(f"%{search}%"))

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
# News Source Endpoints
# ============================================================================


@router.get(
    "/culture/sources",
    response_model=NewsSourceListResponse,
    summary="List all news sources",
    description="Get a paginated list of news sources with optional active filter.",
    responses={
        200: {"description": "Paginated source list"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
    },
)
async def list_news_sources(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
) -> NewsSourceListResponse:
    """List all news sources with pagination."""
    service = NewsSourceService(db)
    return await service.list_sources(
        page=page,
        page_size=page_size,
        is_active=is_active,
    )


@router.post(
    "/culture/sources",
    response_model=NewsSourceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a news source",
    description="Create a new news source. URL must be unique.",
    responses={
        201: {"description": "Source created"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        409: {"description": "URL already exists"},
    },
)
async def create_news_source(
    data: NewsSourceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> NewsSourceResponse:
    """Create a new news source."""
    service = NewsSourceService(db)

    try:
        result = await service.create_source(data)
        await db.commit()
        return result
    except DuplicateURLException as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"URL already exists: {e.url}",
        )


@router.get(
    "/culture/sources/{source_id}",
    response_model=NewsSourceResponse,
    summary="Get a news source",
    description="Get details for a specific news source.",
    responses={
        200: {"description": "Source details"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        404: {"description": "Source not found"},
    },
)
async def get_news_source(
    source_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> NewsSourceResponse:
    """Get a news source by ID."""
    service = NewsSourceService(db)
    return await service.get_source(source_id)


@router.patch(
    "/culture/sources/{source_id}",
    response_model=NewsSourceResponse,
    summary="Update a news source",
    description="Update news source details. URL must remain unique.",
    responses={
        200: {"description": "Source updated"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        404: {"description": "Source not found"},
        409: {"description": "URL already exists"},
    },
)
async def update_news_source(
    source_id: UUID,
    data: NewsSourceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> NewsSourceResponse:
    """Update a news source."""
    service = NewsSourceService(db)

    try:
        result = await service.update_source(source_id, data)
        await db.commit()
        return result
    except DuplicateURLException as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"URL already exists: {e.url}",
        )


@router.delete(
    "/culture/sources/{source_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a news source",
    description="Permanently delete a news source.",
    responses={
        204: {"description": "Source deleted"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        404: {"description": "Source not found"},
    },
)
async def delete_news_source(
    source_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> None:
    """Delete a news source."""
    service = NewsSourceService(db)
    await service.delete_source(source_id)
    await db.commit()


# ============================================================================
# Source Fetch History Endpoints
# ============================================================================


@router.post(
    "/culture/sources/{source_id}/fetch",
    response_model=SourceFetchHistoryItem,
    status_code=status.HTTP_201_CREATED,
    summary="Trigger manual fetch for a source",
    description="Fetch HTML from a news source immediately. Works on both active and inactive sources. On success, automatically triggers AI analysis.",
    responses={
        201: {"description": "Fetch completed (success or error recorded)"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        404: {"description": "Source not found"},
    },
)
async def trigger_fetch(
    source_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> SourceFetchHistoryItem:
    """Trigger manual HTML fetch for a news source.

    On successful fetch, automatically triggers AI analysis in the background
    to discover articles suitable for Cypriot culture exam questions.
    """
    from src.tasks import trigger_article_analysis

    service = SourceFetchService(db)
    history = await service.fetch_source(source_id, trigger_type="manual")
    await db.commit()

    # Auto-trigger analysis on successful fetch
    if history.status == "success":
        trigger_article_analysis(history.id, background_tasks)

    return SourceFetchHistoryItem.model_validate(history)


@router.get(
    "/culture/sources/{source_id}/history",
    response_model=SourceFetchHistoryListResponse,
    summary="Get fetch history for a source",
    description="Get paginated fetch history for a news source.",
    responses={
        200: {"description": "Fetch history"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        404: {"description": "Source not found"},
    },
)
async def get_fetch_history(
    source_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
    limit: int = Query(10, ge=1, le=50, description="Max results"),
) -> SourceFetchHistoryListResponse:
    """Get fetch history for a news source."""
    service = SourceFetchService(db)
    items, total = await service.get_history(source_id, limit=limit)
    return SourceFetchHistoryListResponse(
        items=[SourceFetchHistoryItem.model_validate(item) for item in items],
        total=total,
    )


@router.get(
    "/culture/sources/history/{history_id}/html",
    response_model=SourceFetchHtmlResponse,
    summary="Get HTML content from fetch history",
    description="Get the raw HTML content from a successful fetch.",
    responses={
        200: {"description": "HTML content"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        404: {"description": "History entry not found or has no HTML"},
    },
)
async def get_fetch_html(
    history_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> SourceFetchHtmlResponse:
    """Get raw HTML content from a fetch history entry."""
    service = SourceFetchService(db)
    history = await service.get_history_html(history_id)
    return SourceFetchHtmlResponse.model_validate(history)


# ============================================================================
# Article Analysis Endpoints
# ============================================================================


@router.post(
    "/culture/sources/history/{history_id}/analyze",
    response_model=AnalysisStartedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger AI analysis",
    description="Manually trigger AI analysis for a fetch history record. Useful if automatic analysis failed or needs to be re-run.",
    responses={
        202: {"description": "Analysis started"},
        400: {"description": "No HTML content available for analysis"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        404: {"description": "Fetch history not found"},
    },
)
async def trigger_analysis(
    history_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> AnalysisStartedResponse:
    """Trigger manual AI analysis of fetched HTML.

    Manually triggers AI analysis for a fetch history record. This is useful when:
    - Automatic analysis failed due to transient errors
    - You want to re-analyze content with updated AI logic
    - Analysis was never triggered for older fetch records

    The analysis runs asynchronously in the background. Use the
    GET /culture/sources/history/{history_id}/articles endpoint to check
    the status and retrieve discovered articles.

    Args:
        history_id: UUID of the fetch history record to analyze
        background_tasks: FastAPI background tasks (injected)
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Returns:
        AnalysisStartedResponse with confirmation message

    Raises:
        404: If fetch history record not found
        400: If no HTML content available for analysis
    """
    from src.db.models import SourceFetchHistory
    from src.tasks import trigger_article_analysis

    result = await db.execute(select(SourceFetchHistory).where(SourceFetchHistory.id == history_id))
    history = result.scalar_one_or_none()

    if not history:
        raise NotFoundException(
            resource="Fetch history", detail=f"Fetch history with ID '{history_id}' not found"
        )

    if not history.html_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No HTML content available for analysis",
        )

    # Mark as pending and clear any previous error
    history.analysis_status = "pending"
    history.analysis_error = None
    await db.commit()

    # Queue the background analysis task
    trigger_article_analysis(history_id, background_tasks)

    return AnalysisStartedResponse(
        message="Analysis started",
        history_id=history_id,
    )


@router.get(
    "/culture/sources/history/{history_id}/articles",
    response_model=SourceFetchHistoryDetailResponse,
    summary="Get analysis results",
    description="Retrieve discovered articles from AI analysis of a fetch history record.",
    responses={
        200: {"description": "Analysis results with discovered articles"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        404: {"description": "Fetch history not found"},
    },
)
async def get_analysis_results(
    history_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> SourceFetchHistoryDetailResponse:
    """Get discovered articles from AI analysis.

    Retrieves the results of AI analysis for a fetch history record, including:
    - Analysis status (pending, completed, failed)
    - Discovered articles with URLs, titles, and AI reasoning
    - Token usage and timing information
    - Error details if analysis failed

    Args:
        history_id: UUID of the fetch history record
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Returns:
        SourceFetchHistoryDetailResponse with analysis status and articles

    Raises:
        404: If fetch history record not found
    """
    from sqlalchemy.orm import selectinload

    from src.db.models import SourceFetchHistory

    result = await db.execute(
        select(SourceFetchHistory)
        .options(selectinload(SourceFetchHistory.source))
        .where(SourceFetchHistory.id == history_id)
    )
    history = result.scalar_one_or_none()

    if not history:
        raise NotFoundException(
            resource="Fetch history", detail=f"Fetch history with ID '{history_id}' not found"
        )

    return SourceFetchHistoryDetailResponse.model_validate(history)
