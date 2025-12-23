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
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user, get_current_user_optional
from src.db.dependencies import get_db
from src.db.models import User
from src.schemas.culture import (
    CultureAnswerRequest,
    CultureAnswerResponseWithSM2,
    CultureDeckDetailResponse,
    CultureDeckListResponse,
    CultureProgressResponse,
    CultureQuestionQueue,
)
from src.services import CultureDeckService, CultureQuestionService

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
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> CultureDeckListResponse:
    """List all active culture decks with pagination and optional filtering.

    This endpoint supports both authenticated and anonymous access:
    - Authenticated users receive personalized progress for each deck
    - Anonymous users receive deck information without progress

    Args:
        page: Page number starting from 1
        page_size: Number of items per page (1-100)
        category: Optional category filter
        db: Database session (injected)
        current_user: Optional authenticated user (injected)

    Returns:
        CultureDeckListResponse with total count and paginated deck list

    Example:
        GET /api/v1/culture/decks?page=1&page_size=10&category=history
    """
    service = CultureDeckService(db)
    user_id = current_user.id if current_user else None

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
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> CultureDeckDetailResponse:
    """Get a specific culture deck by ID with question count.

    This endpoint supports both authenticated and anonymous access.
    Inactive decks return 404.

    Args:
        deck_id: UUID of the deck to retrieve
        db: Database session (injected)
        current_user: Optional authenticated user (injected)

    Returns:
        CultureDeckDetailResponse with deck details

    Raises:
        CultureDeckNotFoundException: If deck doesn't exist or is inactive

    Example:
        GET /api/v1/culture/decks/550e8400-e29b-41d4-a716-446655440000
    """
    service = CultureDeckService(db)
    user_id = current_user.id if current_user else None

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
) -> list[str]:
    """Get all available culture deck categories.

    Returns categories that have at least one active deck.

    Args:
        db: Database session (injected)

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
    response_model=CultureAnswerResponseWithSM2,
    summary="Submit answer with SM-2 scheduling",
    description="""
    Submit an answer to a culture question and apply SM-2 spaced repetition.

    **Authentication**: Required

    **SM-2 Quality Mapping**:
    - Correct answer: quality = 3 (Good) - normal interval progression
    - Wrong answer: quality = 1 (Again) - reset to learning phase

    **Response includes**:
    - Correctness and correct answer
    - XP earned (integrated in future subtask)
    - Full SM-2 result with next review date
    - Feedback message for UI
    """,
    responses={
        200: {
            "description": "Answer processed successfully",
            "content": {
                "application/json": {
                    "example": {
                        "is_correct": True,
                        "correct_option": 2,
                        "xp_earned": 10,
                        "sm2_result": {
                            "success": True,
                            "question_id": "...",
                            "previous_status": "new",
                            "new_status": "learning",
                            "easiness_factor": 2.5,
                            "interval": 1,
                            "repetitions": 1,
                            "next_review_date": "2024-01-16",
                        },
                        "message": "Good start!",
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CultureAnswerResponseWithSM2:
    """Submit an answer to a culture question.

    Processes the answer through the SM-2 algorithm and updates the user's
    statistics for this question. Creates statistics on first answer.

    Args:
        question_id: UUID of the question being answered
        request: Answer request with selected_option and time_taken
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        CultureAnswerResponseWithSM2 with correctness and SM-2 result

    Raises:
        CultureQuestionNotFoundException: If question doesn't exist
        ValueError: If selected_option not in range 1-4

    Example:
        POST /api/v1/culture/questions/{question_id}/answer
        {"selected_option": 2, "time_taken": 15}
    """
    service = CultureQuestionService(db)

    return await service.process_answer(
        user_id=current_user.id,
        question_id=question_id,
        selected_option=request.selected_option,
        time_taken=request.time_taken,
    )


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
