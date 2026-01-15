"""Culture Deck API endpoints.

This module provides HTTP endpoints for culture exam deck operations including
listing decks with pagination and filtering, retrieving deck details,
fetching due questions, and submitting answers with SM-2 integration.

Endpoints:
- GET /culture/decks - List culture decks with optional category filter
- GET /culture/decks/{deck_id} - Get culture deck details
- GET /culture/decks/{deck_id}/questions - Get question queue for practice
- POST /culture/questions/{question_id}/answer - Submit answer with SM-2
- GET /culture/progress - Get overall culture learning progress
- GET /culture/categories - Get available categories

Admin Endpoints (superuser only):
- POST /culture/decks - Create a new culture deck
- PATCH /culture/decks/{deck_id} - Update a culture deck
- DELETE /culture/decks/{deck_id} - Soft delete a culture deck
- POST /culture/questions - Create a single question
- POST /culture/questions/bulk - Bulk create questions
- PATCH /culture/questions/{question_id} - Update a question
- DELETE /culture/questions/{question_id} - Delete a question
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.dependencies import get_current_superuser, get_current_user
from src.core.exceptions import ValidationException
from src.db.dependencies import get_db
from src.db.models import User
from src.schemas.culture import (
    CultureAnswerRequest,
    CultureAnswerResponseFast,
    CultureDeckCreate,
    CultureDeckDetailResponse,
    CultureDeckListResponse,
    CultureDeckUpdate,
    CultureProgressResponse,
    CultureQuestionAdminResponse,
    CultureQuestionBulkCreateRequest,
    CultureQuestionBulkCreateResponse,
    CultureQuestionCreate,
    CultureQuestionQueue,
    CultureQuestionUpdate,
)
from src.services import CultureDeckService, CultureQuestionService
from src.tasks import is_background_tasks_enabled, process_culture_answer_full_async

router = APIRouter(
    # Note: prefix is set by parent router in v1/router.py
    # This router is mounted at /culture under the /api/v1 prefix
    tags=["Culture"],
    responses={
        422: {"description": "Validation error"},
    },
)


@router.get(
    "/decks",
    response_model=CultureDeckListResponse,
    summary="List culture decks",
    description="""
    Get a paginated list of all active culture decks with optional category filtering.

    **Authentication**: Optional
    - Authenticated users receive progress data for each deck
    - Anonymous users receive decks without progress

    **Categories**: history, geography, politics, culture, traditions

    **Response includes**:
    - Deck name and description (multilingual JSON)
    - Icon and color accent
    - Category
    - Question count
    - Progress (for authenticated users)
    """,
    responses={
        200: {
            "description": "Paginated list of active culture decks",
            "content": {
                "application/json": {
                    "example": {
                        "total": 5,
                        "decks": [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440000",
                                "name": {
                                    "el": "Ελληνική Ιστορία",
                                    "en": "Greek History",
                                    "ru": "Греческая история",
                                },
                                "description": {"el": "...", "en": "...", "ru": "..."},
                                "icon": "book-open",
                                "color_accent": "#4F46E5",
                                "category": "history",
                                "question_count": 50,
                                "progress": None,
                            }
                        ],
                    }
                }
            },
        },
    },
)
async def list_culture_decks(
    page: int = Query(default=1, ge=1, description="Page number (starting from 1)"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page (max 100)"),
    category: Optional[str] = Query(
        default=None,
        description="Filter by category (history, geography, politics, culture, traditions)",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CultureDeckListResponse:
    """List all active culture decks with pagination and optional filtering.

    Requires authentication. Returns personalized progress for each deck.

    Args:
        page: Page number starting from 1
        page_size: Number of items per page (1-100)
        category: Optional category filter
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        CultureDeckListResponse with total count and paginated deck list

    Example:
        GET /api/v1/culture/decks?page=1&page_size=10&category=history
    """
    service = CultureDeckService(db)
    user_id = current_user.id

    return await service.list_decks(
        page=page,
        page_size=page_size,
        category=category,
        user_id=user_id,
    )


@router.get(
    "/decks/{deck_id}",
    response_model=CultureDeckDetailResponse,
    summary="Get culture deck by ID",
    description="""
    Get a single culture deck by its UUID, including question count and metadata.

    **Authentication**: Optional
    - Authenticated users receive progress data
    - Anonymous users receive deck details without progress

    **Response includes**:
    - All deck information (name, description, icon, color, category)
    - Question count
    - Active status
    - Timestamps (created_at, updated_at)
    - Progress (for authenticated users)
    """,
    responses={
        200: {
            "description": "Culture deck details",
            "content": {
                "application/json": {
                    "example": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "name": {
                            "el": "Ελληνική Ιστορία",
                            "en": "Greek History",
                            "ru": "Греческая история",
                        },
                        "description": {"el": "...", "en": "...", "ru": "..."},
                        "icon": "book-open",
                        "color_accent": "#4F46E5",
                        "category": "history",
                        "question_count": 50,
                        "progress": {
                            "questions_total": 50,
                            "questions_mastered": 25,
                            "questions_learning": 10,
                            "questions_new": 15,
                            "last_practiced_at": "2024-01-15T10:30:00Z",
                        },
                        "is_active": True,
                        "created_at": "2024-01-01T00:00:00Z",
                        "updated_at": "2024-01-15T00:00:00Z",
                    }
                }
            },
        },
        404: {
            "description": "Culture deck not found",
            "content": {
                "application/json": {
                    "example": {
                        "success": False,
                        "error": {
                            "code": "NOT_FOUND",
                            "message": "Culture deck with ID '...' not found",
                        },
                    }
                }
            },
        },
    },
)
async def get_culture_deck(
    deck_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CultureDeckDetailResponse:
    """Get a specific culture deck by ID with question count.

    Requires authentication. Inactive decks return 404.

    Args:
        deck_id: UUID of the deck to retrieve
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        CultureDeckDetailResponse with deck details

    Raises:
        CultureDeckNotFoundException: If deck doesn't exist or is inactive

    Example:
        GET /api/v1/culture/decks/550e8400-e29b-41d4-a716-446655440000
    """
    service = CultureDeckService(db)
    user_id = current_user.id

    return await service.get_deck(
        deck_id=deck_id,
        user_id=user_id,
    )


@router.get(
    "/categories",
    response_model=list[str],
    summary="Get culture deck categories",
    description="""
    Get all available culture deck categories that have active decks.

    **Use Case**: Populate category filter dropdown in the UI.

    **Possible categories**: history, geography, politics, culture, traditions
    """,
    responses={
        200: {
            "description": "List of available categories",
            "content": {
                "application/json": {
                    "example": ["culture", "geography", "history", "politics", "traditions"]
                }
            },
        },
    },
)
async def get_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[str]:
    """Get all available culture deck categories.

    Requires authentication. Returns categories that have at least one active deck.

    Args:
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        List of unique category names

    Example:
        GET /api/v1/culture/categories
    """
    service = CultureDeckService(db)
    return await service.get_categories()


# ============================================================================
# Question Queue & Answer Submission Endpoints
# ============================================================================


@router.get(
    "/decks/{deck_id}/questions",
    response_model=CultureQuestionQueue,
    summary="Get question queue for practice",
    description="""
    Get questions due for review plus optional new questions for a practice session.

    **Authentication**: Required

    **Question Ordering**:
    1. Overdue questions (past due date) - oldest first
    2. Questions due today
    3. New questions (if include_new=True)

    **Response includes**:
    - Deck metadata (id, name)
    - Queue statistics (total_due, total_new, total_in_queue)
    - Questions with SM-2 metadata and pre-signed image URLs
    """,
    responses={
        200: {
            "description": "Question queue for practice session",
            "content": {
                "application/json": {
                    "example": {
                        "deck_id": "550e8400-e29b-41d4-a716-446655440000",
                        "deck_name": {"el": "...", "en": "Greek History", "ru": "..."},
                        "total_due": 5,
                        "total_new": 3,
                        "total_in_queue": 8,
                        "questions": [
                            {
                                "id": "...",
                                "question_text": {"el": "...", "en": "...", "ru": "..."},
                                "options": [{"el": "...", "en": "...", "ru": "..."}],
                                "image_url": "https://...",
                                "order_index": 1,
                                "is_new": False,
                                "due_date": "2024-01-15",
                                "status": "learning",
                            }
                        ],
                    }
                }
            },
        },
        401: {"description": "Not authenticated"},
        404: {"description": "Deck not found or inactive"},
    },
)
async def get_question_queue(
    deck_id: UUID,
    limit: int = Query(default=10, ge=1, le=50, description="Max questions to return"),
    include_new: bool = Query(default=True, description="Include new (unstudied) questions"),
    new_questions_limit: int = Query(
        default=5, ge=0, le=20, description="Max new questions if include_new=True"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CultureQuestionQueue:
    """Get questions due for review plus new questions for a practice session.

    This endpoint returns a queue of questions for the user to practice:
    - Due questions are prioritized (oldest overdue first)
    - New questions fill remaining slots if include_new=True
    - Questions include pre-signed S3 URLs for images

    Args:
        deck_id: UUID of the deck to get questions from
        limit: Maximum total questions to return (1-50)
        include_new: Whether to include new questions
        new_questions_limit: Maximum new questions (0-20)
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        CultureQuestionQueue with questions for practice

    Raises:
        CultureDeckNotFoundException: If deck doesn't exist or is inactive

    Example:
        GET /api/v1/culture/decks/{deck_id}/questions?limit=10&include_new=true
    """
    service = CultureQuestionService(db)

    return await service.get_question_queue(
        user_id=current_user.id,
        deck_id=deck_id,
        limit=limit,
        include_new=include_new,
        new_questions_limit=new_questions_limit,
    )


@router.post(
    "/questions/{question_id}/answer",
    response_model=CultureAnswerResponseFast,
    summary="Submit answer with SM-2 scheduling (fast response)",
    description="""
    Submit an answer to a culture question with early response pattern.

    **Authentication**: Required

    **Performance**: This endpoint returns immediately (~23ms) with essential
    information while deferring SM-2 calculations, XP persistence, and
    achievement checks to background processing (~134ms saved).

    **Response includes**:
    - Correctness and correct answer
    - Estimated XP (calculated from constants, persisted in background)
    - Feedback message for UI
    - Deck category for achievement tracking

    **Note**: SM-2 details are processed in background and not included
    in the response. Use the progress endpoint to see updated stats.
    """,
    responses={
        200: {
            "description": "Answer processed successfully (fast response)",
            "content": {
                "application/json": {
                    "example": {
                        "is_correct": True,
                        "correct_option": 2,
                        "xp_earned": 30,
                        "message": "Correct!",
                        "deck_category": "history",
                    }
                }
            },
        },
        400: {"description": "Invalid selected_option (must be 1-4)"},
        401: {"description": "Not authenticated"},
        404: {"description": "Question not found"},
    },
)
async def submit_answer(
    question_id: UUID,
    request: CultureAnswerRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CultureAnswerResponseFast:
    """Submit an answer to a culture question (fast response pattern).

    Uses the early response pattern for optimal performance:
    1. Fast path: Single DB query to get question + validate correctness
    2. Return immediately with essential information
    3. Background task handles: SM-2 calculation, XP award, stats update,
       answer history, daily goal check, and achievement checks

    This reduces perceived latency by ~83% (134ms -> 23ms).

    When background tasks are disabled (e.g., in E2E tests), uses synchronous
    processing to ensure stats are created immediately.

    Args:
        question_id: UUID of the question being answered
        request: Answer request with selected_option, time_taken, and language
        background_tasks: FastAPI background tasks for async operations
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        CultureAnswerResponseFast with correctness and estimated XP

    Raises:
        CultureQuestionNotFoundException: If question doesn't exist
        ValidationException: If selected_option exceeds question's available options

    Example:
        POST /api/v1/culture/questions/{question_id}/answer
        {"selected_option": 2, "time_taken": 15, "language": "en"}
    """
    service = CultureQuestionService(db)

    try:
        if is_background_tasks_enabled():
            # Production: Fast path + background processing
            response, context = await service.process_answer_fast(
                user_id=current_user.id,
                question_id=question_id,
                selected_option=request.selected_option,
                time_taken=request.time_taken,
                language=request.language,
            )

            # Queue comprehensive background task for all deferred operations
            background_tasks.add_task(
                process_culture_answer_full_async,
                user_id=current_user.id,
                question_id=question_id,
                selected_option=request.selected_option,
                time_taken=request.time_taken,
                language=request.language,
                is_correct=context["is_correct"],
                is_perfect=context["is_perfect"],
                deck_category=context["deck_category"],
                db_url=settings.database_url,
            )

            return response
        else:
            # Testing/fallback: Synchronous processing (stats created immediately)
            full_response = await service.process_answer(
                user_id=current_user.id,
                question_id=question_id,
                selected_option=request.selected_option,
                time_taken=request.time_taken,
                language=request.language,
            )

            return CultureAnswerResponseFast(
                is_correct=full_response.is_correct,
                correct_option=full_response.correct_option,
                xp_earned=full_response.xp_earned,
                message=full_response.message,
                deck_category=full_response.deck_category,
            )
    except ValueError as e:
        # Convert ValueError from service (e.g., selected_option exceeds option_count)
        # to a proper HTTP validation error
        raise ValidationException(detail=str(e), field="selected_option")


@router.get(
    "/progress",
    response_model=CultureProgressResponse,
    summary="Get overall culture learning progress",
    description="""
    Get the user's overall culture learning progress across all decks.

    **Authentication**: Required

    **Response includes**:
    - Overall statistics (total, mastered, learning, new)
    - Progress broken down by category
    - Recent practice sessions (future enhancement)
    """,
    responses={
        200: {
            "description": "Culture learning progress",
            "content": {
                "application/json": {
                    "example": {
                        "overall": {
                            "total_questions": 150,
                            "questions_mastered": 45,
                            "questions_learning": 30,
                            "questions_new": 75,
                            "decks_started": 3,
                            "decks_completed": 1,
                            "accuracy_percentage": 85.5,
                            "total_practice_sessions": 25,
                        },
                        "by_category": {
                            "history": {"questions_total": 50, "questions_mastered": 15},
                            "geography": {"questions_total": 40, "questions_mastered": 10},
                        },
                        "recent_sessions": [],
                    }
                }
            },
        },
        401: {"description": "Not authenticated"},
    },
)
async def get_culture_progress(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CultureProgressResponse:
    """Get overall culture learning progress.

    Returns aggregate statistics across all culture decks including:
    - Total questions by status
    - Progress by category
    - Recent practice sessions

    Args:
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        CultureProgressResponse with progress statistics

    Example:
        GET /api/v1/culture/progress
    """
    service = CultureQuestionService(db)

    return await service.get_culture_progress(user_id=current_user.id)


# ============================================================================
# Admin CRUD Endpoints (Superuser Only)
# ============================================================================


@router.post(
    "/decks",
    response_model=CultureDeckDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new culture deck",
    description="""
    Create a new culture deck.

    **Authentication**: Required (Superuser only)

    **Required fields**:
    - name: Multilingual deck name {el, en, ru}
    - description: Multilingual description {el, en, ru}
    - icon: Icon identifier (e.g., 'book-open')
    - color_accent: Hex color (e.g., '#4F46E5')
    - category: history, geography, politics, culture, traditions
    """,
    responses={
        201: {"description": "Culture deck created successfully"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        422: {"description": "Validation error"},
    },
)
async def create_culture_deck(
    deck_data: CultureDeckCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> CultureDeckDetailResponse:
    """Create a new culture deck.

    Requires superuser privileges.

    Args:
        deck_data: Deck creation data with multilingual fields
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Returns:
        CultureDeckDetailResponse with created deck details

    Example:
        POST /api/v1/culture/decks
        {
            "name": {"el": "...", "en": "Greek History", "ru": "..."},
            "description": {"el": "...", "en": "...", "ru": "..."},
            "icon": "book-open",
            "color_accent": "#4F46E5",
            "category": "history"
        }
    """
    service = CultureDeckService(db)
    deck = await service.create_deck(deck_data)

    # Commit the transaction
    await db.commit()

    return deck


@router.patch(
    "/decks/{deck_id}",
    response_model=CultureDeckDetailResponse,
    summary="Update a culture deck",
    description="""
    Update an existing culture deck. All fields are optional.

    **Authentication**: Required (Superuser only)
    """,
    responses={
        200: {"description": "Culture deck updated successfully"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        404: {"description": "Culture deck not found"},
        422: {"description": "Validation error"},
    },
)
async def update_culture_deck(
    deck_id: UUID,
    deck_data: CultureDeckUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> CultureDeckDetailResponse:
    """Update an existing culture deck.

    Requires superuser privileges. Only provided fields will be updated.

    Args:
        deck_id: UUID of the deck to update
        deck_data: Fields to update (all optional)
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Returns:
        CultureDeckDetailResponse with updated deck details

    Raises:
        404: If deck doesn't exist

    Example:
        PATCH /api/v1/culture/decks/{deck_id}
        {"category": "geography"}
    """
    service = CultureDeckService(db)
    updated_deck = await service.update_deck(deck_id, deck_data)

    # Commit the transaction and refresh
    await db.commit()
    await db.refresh(updated_deck)

    # Get question count for response
    question_count = await service.deck_repo.count_questions(deck_id)

    return CultureDeckDetailResponse(
        id=updated_deck.id,
        name=updated_deck.name,
        description=updated_deck.description,
        icon=updated_deck.icon,
        color_accent=updated_deck.color_accent,
        category=updated_deck.category,
        question_count=question_count,
        is_premium=updated_deck.is_premium,
        progress=None,
        is_active=updated_deck.is_active,
        created_at=updated_deck.created_at,
        updated_at=updated_deck.updated_at,
    )


@router.delete(
    "/decks/{deck_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft delete a culture deck",
    description="""
    Soft delete a culture deck by setting is_active to False.

    **Authentication**: Required (Superuser only)

    Note: This does NOT physically delete the deck. Data is preserved.
    """,
    responses={
        204: {"description": "Culture deck deleted successfully"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        404: {"description": "Culture deck not found"},
    },
)
async def delete_culture_deck(
    deck_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> Response:
    """Soft delete a culture deck.

    Requires superuser privileges. Sets is_active=False.
    Idempotent: deleting already-inactive deck is allowed.

    Args:
        deck_id: UUID of the deck to delete
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Returns:
        Empty response with 204 status

    Raises:
        404: If deck doesn't exist

    Example:
        DELETE /api/v1/culture/decks/{deck_id}
    """
    service = CultureDeckService(db)
    await service.soft_delete_deck(deck_id)

    # Commit the transaction
    await db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/questions",
    response_model=CultureQuestionAdminResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a single culture question",
    description="""
    Create a new culture question in a deck.

    **Authentication**: Required (Superuser only)

    **Required fields**:
    - deck_id: UUID of the deck
    - question_text: Multilingual question {el, en, ru}
    - option_a through option_d: Multilingual options {el, en, ru}
    - correct_option: 1=A, 2=B, 3=C, 4=D
    """,
    responses={
        201: {"description": "Culture question created successfully"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        404: {"description": "Deck not found"},
        422: {"description": "Validation error"},
    },
)
async def create_culture_question(
    question_data: CultureQuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> CultureQuestionAdminResponse:
    """Create a new culture question.

    Requires superuser privileges.

    Args:
        question_data: Question creation data with multilingual fields
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Returns:
        CultureQuestionAdminResponse with created question details

    Raises:
        404: If deck doesn't exist

    Example:
        POST /api/v1/culture/questions
        {
            "deck_id": "...",
            "question_text": {"el": "...", "en": "Who was...", "ru": "..."},
            "option_a": {"el": "...", "en": "Option A", "ru": "..."},
            ...
            "correct_option": 2
        }
    """
    service = CultureQuestionService(db)
    question = await service.create_question(question_data)

    # Commit the transaction
    await db.commit()

    return question


@router.post(
    "/questions/bulk",
    response_model=CultureQuestionBulkCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Bulk create culture questions",
    description="""
    Create multiple culture questions in one request.

    **Authentication**: Required (Superuser only)

    **Limits**: 1-100 questions per request

    **Transactional**: If any question fails validation, entire request is rejected.
    """,
    responses={
        201: {"description": "Questions created successfully"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        404: {"description": "Deck not found"},
        422: {"description": "Validation error (empty array, >100 questions, invalid data)"},
    },
)
async def bulk_create_culture_questions(
    request: CultureQuestionBulkCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> CultureQuestionBulkCreateResponse:
    """Create multiple culture questions in one request.

    Requires superuser privileges. All-or-nothing semantics.

    Args:
        request: Deck ID and array of questions to create
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Returns:
        CultureQuestionBulkCreateResponse with created questions

    Raises:
        404: If deck doesn't exist
        422: If validation fails

    Example:
        POST /api/v1/culture/questions/bulk
        {
            "deck_id": "...",
            "questions": [
                {"question_text": {...}, "option_a": {...}, ..., "correct_option": 1},
                {"question_text": {...}, "option_a": {...}, ..., "correct_option": 3}
            ]
        }
    """
    service = CultureQuestionService(db)
    response = await service.bulk_create_questions(request)

    # Commit the transaction
    await db.commit()

    # Refresh all questions to get generated fields
    for question in response.questions:
        # Note: questions are already Pydantic models, no refresh needed
        pass

    return response


@router.patch(
    "/questions/{question_id}",
    response_model=CultureQuestionAdminResponse,
    summary="Update a culture question",
    description="""
    Update an existing culture question. All fields are optional.

    **Authentication**: Required (Superuser only)

    Note: deck_id cannot be changed.
    """,
    responses={
        200: {"description": "Question updated successfully"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        404: {"description": "Question not found"},
        422: {"description": "Validation error"},
    },
)
async def update_culture_question(
    question_id: UUID,
    question_data: CultureQuestionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> CultureQuestionAdminResponse:
    """Update an existing culture question.

    Requires superuser privileges. Only provided fields will be updated.

    Args:
        question_id: UUID of the question to update
        question_data: Fields to update (all optional)
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Returns:
        CultureQuestionAdminResponse with updated question details

    Raises:
        404: If question doesn't exist

    Example:
        PATCH /api/v1/culture/questions/{question_id}
        {"correct_option": 3}
    """
    service = CultureQuestionService(db)
    updated_question = await service.update_question(question_id, question_data)

    # Commit the transaction and refresh
    await db.commit()
    await db.refresh(updated_question)

    return CultureQuestionAdminResponse.model_validate(updated_question)


@router.delete(
    "/questions/{question_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a culture question",
    description="""
    Hard delete a culture question.

    **Authentication**: Required (Superuser only)

    **WARNING**: This is a HARD DELETE. The question and all associated
    statistics will be permanently removed.
    """,
    responses={
        204: {"description": "Question deleted successfully"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (requires superuser)"},
        404: {"description": "Question not found"},
    },
)
async def delete_culture_question(
    question_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
) -> Response:
    """Hard delete a culture question.

    Requires superuser privileges.

    WARNING: Permanently removes question and all associated statistics.

    Args:
        question_id: UUID of the question to delete
        db: Database session (injected)
        current_user: Authenticated superuser (injected)

    Returns:
        Empty response with 204 status

    Raises:
        404: If question doesn't exist

    Example:
        DELETE /api/v1/culture/questions/{question_id}
    """
    service = CultureQuestionService(db)
    await service.delete_question(question_id)

    # Commit the transaction
    await db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
