"""Mock Exam API endpoints.

This module provides HTTP endpoints for mock citizenship exam operations including
creating/resuming exam sessions, submitting answers, completing exams, and
retrieving statistics.

Endpoints:
- GET /mock-exam/queue - Preview available questions and check exam availability
- POST /mock-exam/sessions - Create or resume a mock exam session
- POST /mock-exam/sessions/{session_id}/answers - Submit an answer
- POST /mock-exam/sessions/{session_id}/complete - Complete the exam
- GET /mock-exam/statistics - Get user's exam statistics and history
- DELETE /mock-exam/sessions/{session_id} - Abandon an active session

All endpoints require authentication.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user
from src.db.dependencies import get_db
from src.db.models import User
from src.schemas.mock_exam import (
    MockExamAnswerRequest,
    MockExamAnswerResponse,
    MockExamCompleteRequest,
    MockExamCompleteResponse,
    MockExamCreateResponse,
    MockExamHistoryItem,
    MockExamQuestionResponse,
    MockExamQueueResponse,
    MockExamSessionResponse,
    MockExamStatisticsResponse,
)
from src.services import MockExamService

router = APIRouter(
    prefix="/mock-exam",
    tags=["Mock Exam"],
    responses={
        401: {"description": "Not authenticated"},
        422: {"description": "Validation error"},
    },
)


@router.get(
    "/queue",
    response_model=MockExamQueueResponse,
    summary="Preview mock exam questions",
    description="""
    Get a preview of available questions and check if an exam can be started.

    **Authentication**: Required

    **Response includes**:
    - Total questions available across all active culture decks
    - Whether an exam can be started (requires at least 25 questions)
    - Sample of 5 random questions as preview

    **Use Case**: Display exam landing page with question preview
    """,
    responses={
        200: {
            "description": "Question preview and availability status",
            "content": {
                "application/json": {
                    "example": {
                        "total_questions": 150,
                        "available_questions": 150,
                        "can_start_exam": True,
                        "sample_questions": [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440000",
                                "question_text": {"el": "...", "en": "What is...?", "ru": "..."},
                                "options": [
                                    {"el": "...", "en": "Option A", "ru": "..."},
                                    {"el": "...", "en": "Option B", "ru": "..."},
                                ],
                                "option_count": 4,
                                "image_url": None,
                                "order_index": 0,
                            }
                        ],
                    }
                }
            },
        },
    },
)
async def get_mock_exam_queue(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MockExamQueueResponse:
    """Get preview of available questions for mock exam.

    This endpoint provides a preview of questions and checks availability
    without starting an actual exam session.

    Args:
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        MockExamQueueResponse with availability status and sample questions

    Example:
        GET /api/v1/culture/mock-exam/queue
    """
    service = MockExamService(db)

    # Get random sample of questions for preview
    sample_questions = await service.repository.get_random_questions(count=5)
    total_available = len(await service.repository.get_random_questions(count=1000))

    # Build sample question responses
    sample_data = [
        MockExamQuestionResponse(
            id=q.id,
            question_text=q.question_text,
            options=[q.option_a, q.option_b]
            + ([q.option_c] if q.option_c else [])
            + ([q.option_d] if q.option_d else []),
            option_count=q.option_count,
            image_url=(
                service.s3_service.generate_presigned_url(q.image_key) if q.image_key else None
            ),
            order_index=q.order_index,
        )
        for q in sample_questions
    ]

    return MockExamQueueResponse(
        total_questions=total_available,
        available_questions=total_available,
        can_start_exam=total_available >= 25,
        sample_questions=sample_data,
    )


@router.post(
    "/sessions",
    response_model=MockExamCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create or resume mock exam session",
    description="""
    Create a new mock exam session or resume an existing active session.

    **Authentication**: Required

    **Behavior**:
    - If user has an active (incomplete) session, returns that session with is_resumed=True
    - Otherwise creates a new session with 25 random questions

    **Response includes**:
    - Session details (id, started_at, score, etc.)
    - List of 25 questions with multilingual text and options
    - is_resumed flag indicating if this is a resumed session

    **Use Case**: Starting or continuing a mock exam
    """,
    responses={
        201: {
            "description": "Mock exam session created or resumed",
            "content": {
                "application/json": {
                    "example": {
                        "session": {
                            "id": "550e8400-e29b-41d4-a716-446655440000",
                            "user_id": "660e8400-e29b-41d4-a716-446655440001",
                            "started_at": "2024-01-15T10:30:00Z",
                            "completed_at": None,
                            "score": 0,
                            "total_questions": 25,
                            "passed": False,
                            "time_taken_seconds": 0,
                            "status": "active",
                        },
                        "questions": [],
                        "is_resumed": False,
                    }
                }
            },
        },
        400: {
            "description": "Not enough questions available",
            "content": {
                "application/json": {
                    "example": {
                        "success": False,
                        "error": {
                            "code": "VALIDATION_ERROR",
                            "message": "No questions available for mock exam",
                        },
                    }
                }
            },
        },
    },
)
async def create_mock_exam_session(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MockExamCreateResponse:
    """Create a new mock exam session or resume an existing one.

    If the user has an active session, returns that session.
    Otherwise creates a new session with 25 random questions.

    Args:
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        MockExamCreateResponse with session details and questions

    Raises:
        ValueError: If not enough questions available (< 25)

    Example:
        POST /api/v1/culture/mock-exam/sessions
    """
    service = MockExamService(db)

    result = await service.create_mock_exam(user_id=current_user.id)

    # Convert session to response format
    session = result["session"]
    session_response = MockExamSessionResponse(
        id=session.id,
        user_id=session.user_id,
        started_at=session.started_at,
        completed_at=session.completed_at,
        score=session.score,
        total_questions=session.total_questions,
        passed=session.passed,
        time_taken_seconds=session.time_taken_seconds,
        status=session.status.value,
    )

    # Convert questions to response format
    questions_response = [
        MockExamQuestionResponse(
            id=q["id"],
            question_text=q["question_text"],
            options=q["options"],
            option_count=q["option_count"],
            image_url=q["image_url"],
            order_index=q["order_index"],
        )
        for q in result["questions"]
    ]

    return MockExamCreateResponse(
        session=session_response,
        questions=questions_response,
        is_resumed=result["is_resumed"],
    )


@router.post(
    "/sessions/{session_id}/answers",
    response_model=MockExamAnswerResponse,
    summary="Submit an answer during mock exam",
    description="""
    Submit an answer to a question during an active mock exam session.

    **Authentication**: Required

    **Behavior**:
    - Validates the session is active and owned by user
    - Checks answer correctness
    - Updates SM-2 statistics for the question
    - Awards XP (10 XP correct, 15 XP perfect, 2 XP incorrect)
    - Returns feedback with correct answer and current score

    **Duplicate Handling**: If the same question is answered twice,
    returns is_correct=None and duplicate=True without re-processing.

    **Use Case**: Processing each answer during the exam
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
                        "current_score": 15,
                        "answers_count": 20,
                        "duplicate": False,
                    }
                }
            },
        },
        400: {
            "description": "Session is not active",
            "content": {
                "application/json": {
                    "example": {
                        "success": False,
                        "error": {
                            "code": "MOCK_EXAM_SESSION_EXPIRED",
                            "message": "Mock exam session ... is no longer active",
                        },
                    }
                }
            },
        },
        404: {
            "description": "Session not found",
            "content": {
                "application/json": {
                    "example": {
                        "success": False,
                        "error": {
                            "code": "NOT_FOUND",
                            "message": "Mock exam session ... not found",
                        },
                    }
                }
            },
        },
    },
)
async def submit_mock_exam_answer(
    session_id: UUID,
    request: MockExamAnswerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MockExamAnswerResponse:
    """Submit an answer during a mock exam session.

    Processes the answer, updates SM-2 statistics, and awards XP.

    Args:
        session_id: UUID of the mock exam session
        request: Answer request with question_id, selected_option, time_taken
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        MockExamAnswerResponse with correctness and score update

    Raises:
        MockExamNotFoundException: If session doesn't exist or not owned by user
        MockExamSessionExpiredException: If session is not active

    Example:
        POST /api/v1/culture/mock-exam/sessions/{session_id}/answers
        {"question_id": "...", "selected_option": 2, "time_taken_seconds": 15}
    """
    service = MockExamService(db)

    result = await service.submit_answer(
        user_id=current_user.id,
        session_id=session_id,
        question_id=request.question_id,
        selected_option=request.selected_option,
        time_taken_seconds=request.time_taken_seconds,
    )

    return MockExamAnswerResponse(
        is_correct=result["is_correct"],
        correct_option=result["correct_option"],
        xp_earned=result["xp_earned"],
        current_score=result["current_score"],
        answers_count=result["answers_count"],
        duplicate=result["duplicate"],
    )


@router.post(
    "/sessions/{session_id}/complete",
    response_model=MockExamCompleteResponse,
    summary="Complete a mock exam session",
    description="""
    Complete a mock exam session and get final results.

    **Authentication**: Required

    **Pass Threshold**: 80% (20/25 correct answers)

    **Response includes**:
    - Final session details
    - Pass/fail status
    - Score and percentage
    - Pass threshold for reference

    **Use Case**: Finishing the exam and displaying results
    """,
    responses={
        200: {
            "description": "Exam completed successfully",
            "content": {
                "application/json": {
                    "example": {
                        "session": {
                            "id": "...",
                            "status": "completed",
                            "score": 22,
                            "total_questions": 25,
                            "passed": True,
                        },
                        "passed": True,
                        "score": 22,
                        "total_questions": 25,
                        "percentage": 88.0,
                        "pass_threshold": 80,
                    }
                }
            },
        },
        400: {
            "description": "Session is not active",
            "content": {
                "application/json": {
                    "example": {
                        "success": False,
                        "error": {
                            "code": "MOCK_EXAM_SESSION_EXPIRED",
                            "message": "Mock exam session ... is no longer active",
                        },
                    }
                }
            },
        },
        404: {
            "description": "Session not found",
            "content": {
                "application/json": {
                    "example": {
                        "success": False,
                        "error": {
                            "code": "NOT_FOUND",
                            "message": "Mock exam session ... not found",
                        },
                    }
                }
            },
        },
    },
)
async def complete_mock_exam_session(
    session_id: UUID,
    request: MockExamCompleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MockExamCompleteResponse:
    """Complete a mock exam session and calculate final results.

    Marks the session as completed and determines pass/fail status.

    Args:
        session_id: UUID of the mock exam session
        request: Complete request with total_time_seconds
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        MockExamCompleteResponse with final results

    Raises:
        MockExamNotFoundException: If session doesn't exist or not owned by user
        MockExamSessionExpiredException: If session is not active

    Example:
        POST /api/v1/culture/mock-exam/sessions/{session_id}/complete
        {"total_time_seconds": 1200}
    """
    service = MockExamService(db)

    result = await service.complete_exam(
        user_id=current_user.id,
        session_id=session_id,
        total_time_seconds=request.total_time_seconds,
    )

    # Convert session to response format
    session = result["session"]
    session_response = MockExamSessionResponse(
        id=session.id,
        user_id=session.user_id,
        started_at=session.started_at,
        completed_at=session.completed_at,
        score=session.score,
        total_questions=session.total_questions,
        passed=session.passed,
        time_taken_seconds=session.time_taken_seconds,
        status=session.status.value,
    )

    return MockExamCompleteResponse(
        session=session_response,
        passed=result["passed"],
        score=result["score"],
        total_questions=result["total_questions"],
        percentage=result["percentage"],
        pass_threshold=result["pass_threshold"],
    )


@router.get(
    "/statistics",
    response_model=MockExamStatisticsResponse,
    summary="Get mock exam statistics",
    description="""
    Get the user's aggregated mock exam statistics and recent exam history.

    **Authentication**: Required

    **Statistics include**:
    - total_exams: Total completed exams
    - passed_exams: Number of passed exams
    - pass_rate: Percentage of exams passed
    - average_score: Average score across all exams
    - best_score: Highest score achieved
    - total_questions_answered: Sum of questions from all exams
    - average_time_seconds: Average time per exam

    **Recent History**: Up to 10 most recent completed exams

    **Use Case**: Dashboard statistics display
    """,
    responses={
        200: {
            "description": "User statistics retrieved",
            "content": {
                "application/json": {
                    "example": {
                        "stats": {
                            "total_exams": 5,
                            "passed_exams": 3,
                            "pass_rate": 60.0,
                            "average_score": 19.5,
                            "best_score": 24,
                            "total_questions_answered": 125,
                            "average_time_seconds": 1100,
                        },
                        "recent_exams": [
                            {
                                "id": "...",
                                "started_at": "2024-01-15T10:30:00Z",
                                "completed_at": "2024-01-15T11:00:00Z",
                                "score": 22,
                                "total_questions": 25,
                                "passed": True,
                                "time_taken_seconds": 1200,
                            }
                        ],
                    }
                }
            },
        },
    },
)
async def get_mock_exam_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MockExamStatisticsResponse:
    """Get user's mock exam statistics and history.

    Returns aggregated statistics and list of recent completed exams.

    Args:
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        MockExamStatisticsResponse with stats and recent exams

    Example:
        GET /api/v1/culture/mock-exam/statistics
    """
    service = MockExamService(db)

    result = await service.get_statistics(user_id=current_user.id)

    # Convert recent exams to response format
    recent_exams_response = [
        MockExamHistoryItem(
            id=exam.id,
            started_at=exam.started_at,
            completed_at=exam.completed_at,
            score=exam.score,
            total_questions=exam.total_questions,
            passed=exam.passed,
            time_taken_seconds=exam.time_taken_seconds,
        )
        for exam in result["recent_exams"]
    ]

    return MockExamStatisticsResponse(
        stats=result["stats"],
        recent_exams=recent_exams_response,
    )


@router.delete(
    "/sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Abandon a mock exam session",
    description="""
    Abandon an active mock exam session.

    **Authentication**: Required

    **Behavior**:
    - Marks the session as abandoned
    - Session cannot be resumed after abandonment

    **Use Case**: User quits exam before completion
    """,
    responses={
        204: {"description": "Session abandoned successfully"},
        400: {
            "description": "Session is not active",
            "content": {
                "application/json": {
                    "example": {
                        "success": False,
                        "error": {
                            "code": "MOCK_EXAM_SESSION_EXPIRED",
                            "message": "Mock exam session ... is no longer active",
                        },
                    }
                }
            },
        },
        404: {
            "description": "Session not found",
            "content": {
                "application/json": {
                    "example": {
                        "success": False,
                        "error": {
                            "code": "NOT_FOUND",
                            "message": "Mock exam session ... not found",
                        },
                    }
                }
            },
        },
    },
)
async def abandon_mock_exam_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Abandon an active mock exam session.

    Marks the session as abandoned. Cannot be undone.

    Args:
        session_id: UUID of the mock exam session
        db: Database session (injected)
        current_user: Authenticated user (injected)

    Returns:
        Empty response with 204 status

    Raises:
        MockExamNotFoundException: If session doesn't exist or not owned by user
        MockExamSessionExpiredException: If session is not active

    Example:
        DELETE /api/v1/culture/mock-exam/sessions/{session_id}
    """
    service = MockExamService(db)

    await service.abandon_exam(
        user_id=current_user.id,
        session_id=session_id,
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
