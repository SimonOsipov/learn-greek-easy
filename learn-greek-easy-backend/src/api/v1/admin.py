"""Admin API endpoints.

This module provides HTTP endpoints for admin operations including:
- Dashboard statistics (deck and card counts)
- Unified deck listing with search and pagination
- Feedback management (list and update)

All endpoints require superuser authentication.
"""

from typing import Optional
from uuid import UUID

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

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
    QuestionGenerationLog,
    User,
)
from src.schemas.admin import (
    AdminDeckListResponse,
    AdminStatsResponse,
    AnalysisStartedResponse,
    ArticleCheckResponse,
    NewsSourceCreate,
    NewsSourceListResponse,
    NewsSourceResponse,
    NewsSourceUpdate,
    PendingQuestionItem,
    PendingQuestionsResponse,
    QuestionApproveRequest,
    QuestionApproveResponse,
    QuestionGenerateRequest,
    QuestionGenerateResponse,
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
from src.services import HTMLContentExtractorError, html_extractor
from src.services.claude_service import ClaudeServiceError, claude_service
from src.services.feedback_admin_service import FeedbackAdminService
from src.services.news_source_service import DuplicateURLException, NewsSourceService
from src.services.source_fetch_service import SourceFetchService

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
                        "total_decks": 6,
                        "total_cards": 360,
                        "total_vocabulary_decks": 6,
                        "total_vocabulary_cards": 360,
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
    - Total number of active vocabulary decks
    - Total number of vocabulary cards

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

    return AdminStatsResponse(
        total_decks=total_vocabulary_decks,
        total_cards=total_vocabulary_cards,
        total_vocabulary_decks=total_vocabulary_decks,
        total_vocabulary_cards=total_vocabulary_cards,
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
                Deck.owner_id,
                User.full_name.label("owner_name"),
                func.coalesce(vocab_card_count_subquery.c.card_count, 0).label("item_count"),
            )
            .outerjoin(vocab_card_count_subquery, Deck.id == vocab_card_count_subquery.c.deck_id)
            .outerjoin(User, Deck.owner_id == User.id)
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


@router.delete(
    "/culture/sources/history/{history_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a fetch history record",
    description="Delete a fetch history record and its HTML content.",
    responses={
        204: {"description": "History record deleted"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        404: {"description": "History entry not found"},
    },
)
async def delete_fetch_history(
    history_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> None:
    """Delete a fetch history record and its HTML content."""
    service = SourceFetchService(db)
    await service.delete_history(history_id)
    await db.commit()


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


# ============================================================================
# Culture Question Generation Endpoints
# ============================================================================


@router.post(
    "/culture/questions/generate",
    response_model=QuestionGenerateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a culture question from an article",
    responses={
        201: {"description": "Question generated successfully"},
        400: {"description": "Failed to fetch article HTML"},
        409: {"description": "Article already used for question generation"},
        500: {"description": "AI generation failed"},
    },
)
async def generate_culture_question(
    request: QuestionGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> QuestionGenerateResponse:
    """Generate a culture exam question from an article using AI."""
    from datetime import datetime, timezone

    article_url_str = str(request.article_url)
    started_at = datetime.now(timezone.utc)

    # Check if article already used (before calling Claude to save tokens)
    existing = await db.execute(
        select(CultureQuestion).where(CultureQuestion.source_article_url == article_url_str)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A question has already been generated from this article",
        )

    # Fetch article HTML
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(article_url_str)
            response.raise_for_status()
            raw_html = response.text
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch article: {str(e)}",
        )

    # Extract clean content from HTML
    try:
        extracted = html_extractor.extract(
            html_content=raw_html,
            source_url=article_url_str,
        )

        # Log extraction statistics
        logger.info(
            "Article content extracted",
            extra={
                "article_url": article_url_str,
                "extraction_method": extracted.extraction_method,
                "estimated_tokens": extracted.estimated_tokens,
                "title_from_extraction": extracted.title[:100] if extracted.title else None,
                "raw_html_size_kb": round(len(raw_html.encode("utf-8")) / 1024, 2),
                "extracted_text_size_kb": round(len(extracted.main_text.encode("utf-8")) / 1024, 2),
            },
        )

        # Use extracted text instead of raw HTML
        content_for_claude = extracted.main_text

        # Validate extraction produced sufficient content (at least 100 chars)
        if not content_for_claude or len(content_for_claude.strip()) < 100:
            logger.warning(
                "Extraction produced minimal content, using raw HTML fallback",
                extra={
                    "article_url": article_url_str,
                    "extracted_length": len(content_for_claude) if content_for_claude else 0,
                },
            )
            content_for_claude = raw_html

    except HTMLContentExtractorError as e:
        logger.warning(
            "HTML extraction failed, using raw HTML",
            extra={
                "article_url": article_url_str,
                "error": str(e),
            },
        )
        content_for_claude = raw_html

    # Create log entry (in_progress)
    log_entry = QuestionGenerationLog(
        source_fetch_history_id=request.fetch_history_id,
        article_url=article_url_str,
        article_title=request.article_title,
        status="in_progress",
        started_at=started_at,
    )
    db.add(log_entry)
    await db.flush()

    try:
        # Generate question using Claude
        result, tokens_used = claude_service.generate_culture_question(
            html_content=content_for_claude,
            article_url=article_url_str,
            article_title=request.article_title,
        )

        # Build options from result
        options = [opt.model_dump() for opt in result.options]

        # Create CultureQuestion
        question = CultureQuestion(
            deck_id=None,
            question_text=result.question_text.model_dump(),
            option_a=options[0] if len(options) > 0 else {"el": "", "en": "", "ru": ""},
            option_b=options[1] if len(options) > 1 else {"el": "", "en": "", "ru": ""},
            option_c=options[2] if len(options) > 2 else None,
            option_d=options[3] if len(options) > 3 else None,
            correct_option=result.correct_option,
            is_pending_review=True,
            source_article_url=article_url_str,
        )
        db.add(question)
        await db.flush()

        # Update log entry (success)
        log_entry.status = "success"
        log_entry.question_id = question.id
        log_entry.tokens_used = tokens_used
        log_entry.completed_at = datetime.now(timezone.utc)

        await db.commit()

        return QuestionGenerateResponse(
            question_id=question.id,
            message="Question generated successfully",
        )

    except ClaudeServiceError as e:
        # Update log entry (failed)
        log_entry.status = "failed"
        log_entry.error_message = str(e)
        log_entry.completed_at = datetime.now(timezone.utc)
        await db.commit()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate question: {str(e)}",
        )


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
