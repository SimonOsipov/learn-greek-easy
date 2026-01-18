"""Mock Exam Pydantic schemas for API request/response validation.

This module contains schemas for:
- Mock exam session management
- Answer submission and feedback
- Statistics and history tracking

Key Features:
- 25 random questions from all active culture decks
- 80% pass threshold (20/25 correct)
- SM-2 spaced repetition integration
- XP awards for answers
"""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# ============================================================================
# Question Schemas
# ============================================================================


class MockExamQuestionResponse(BaseModel):
    """Question data for mock exam session."""

    id: UUID = Field(..., description="Question unique identifier")
    question_text: dict[str, str] = Field(..., description="Multilingual question {el, en, ru}")
    options: list[dict[str, str]] = Field(
        ...,
        min_length=2,
        max_length=4,
        description="2-4 answer options, each with {el, en, ru}",
    )
    option_count: int = Field(..., ge=2, le=4, description="Number of answer options (2, 3, or 4)")
    image_url: Optional[str] = Field(None, description="Pre-signed S3 URL for question image")
    order_index: int = Field(..., ge=0, description="Question order within deck")


# ============================================================================
# Session Schemas
# ============================================================================


class MockExamSessionResponse(BaseModel):
    """Mock exam session details."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Session unique identifier")
    user_id: UUID = Field(..., description="User who owns this session")
    started_at: datetime = Field(..., description="When the exam was started")
    completed_at: Optional[datetime] = Field(None, description="When the exam was completed")
    score: int = Field(..., ge=0, description="Number of correct answers")
    total_questions: int = Field(..., ge=0, description="Total questions in exam")
    passed: bool = Field(..., description="Whether the exam was passed (>= 80%)")
    time_taken_seconds: int = Field(..., ge=0, description="Total time taken in seconds")
    status: str = Field(..., description="Session status: active, completed, abandoned")


class MockExamCreateResponse(BaseModel):
    """Response for creating/resuming a mock exam session."""

    session: MockExamSessionResponse = Field(..., description="The mock exam session")
    questions: list[MockExamQuestionResponse] = Field(..., description="Questions for the exam")
    is_resumed: bool = Field(..., description="True if resuming an existing active session")


# ============================================================================
# Queue Schemas
# ============================================================================


class MockExamQueueResponse(BaseModel):
    """Response for question queue preview endpoint."""

    total_questions: int = Field(
        ..., ge=0, description="Total available questions across all decks"
    )
    available_questions: int = Field(..., ge=0, description="Questions available for exam (min 25)")
    can_start_exam: bool = Field(..., description="True if at least 25 questions available")
    sample_questions: list[MockExamQuestionResponse] = Field(
        ..., description="Preview of 5 random sample questions"
    )


# ============================================================================
# Answer Schemas
# ============================================================================


class MockExamAnswerRequest(BaseModel):
    """Request for submitting an answer during a mock exam."""

    question_id: UUID = Field(..., description="Question UUID being answered")
    selected_option: int = Field(..., ge=1, le=4, description="Selected answer option (1-4)")
    time_taken_seconds: int = Field(..., ge=0, description="Time taken to answer in seconds")


class MockExamAnswerResponse(BaseModel):
    """Response after submitting an answer."""

    is_correct: Optional[bool] = Field(
        ..., description="Whether the answer was correct (None if duplicate)"
    )
    correct_option: Optional[int] = Field(
        ..., ge=1, le=4, description="The correct answer option (None if duplicate)"
    )
    xp_earned: int = Field(..., ge=0, description="XP awarded for this answer")
    current_score: int = Field(..., ge=0, description="Current correct answers in session")
    answers_count: int = Field(..., ge=0, description="Total questions answered in session")
    duplicate: bool = Field(..., description="True if this question was already answered")


# ============================================================================
# Complete Exam Schemas
# ============================================================================


class MockExamCompleteRequest(BaseModel):
    """Request for completing a mock exam."""

    total_time_seconds: int = Field(
        ..., ge=0, description="Total time taken for the exam in seconds"
    )


class MockExamCompleteResponse(BaseModel):
    """Response after completing a mock exam."""

    session: MockExamSessionResponse = Field(..., description="The completed session")
    passed: bool = Field(..., description="Whether the exam was passed (>= 80%)")
    score: int = Field(..., ge=0, description="Number of correct answers")
    total_questions: int = Field(..., ge=0, description="Total questions in exam")
    percentage: float = Field(..., ge=0, le=100, description="Score percentage")
    pass_threshold: int = Field(..., ge=0, le=100, description="Required percentage to pass (80)")


# ============================================================================
# Statistics Schemas
# ============================================================================


class MockExamHistoryItem(BaseModel):
    """Single exam in history list."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Session unique identifier")
    started_at: datetime = Field(..., description="When the exam was started")
    completed_at: Optional[datetime] = Field(None, description="When the exam was completed")
    score: int = Field(..., ge=0, description="Number of correct answers")
    total_questions: int = Field(..., ge=0, description="Total questions in exam")
    passed: bool = Field(..., description="Whether the exam was passed")
    time_taken_seconds: int = Field(..., ge=0, description="Total time taken in seconds")


class MockExamStatisticsResponse(BaseModel):
    """Response for user's mock exam statistics."""

    stats: dict[str, Any] = Field(
        ...,
        description="Aggregated statistics: total_exams, passed_exams, pass_rate, average_score, best_score, total_questions_answered, average_time_seconds",
    )
    recent_exams: list[MockExamHistoryItem] = Field(
        ..., description="List of recent completed exams (up to 10)"
    )


# ============================================================================
# Module Exports
# ============================================================================

__all__ = [
    "MockExamQuestionResponse",
    "MockExamSessionResponse",
    "MockExamCreateResponse",
    "MockExamQueueResponse",
    "MockExamAnswerRequest",
    "MockExamAnswerResponse",
    "MockExamCompleteRequest",
    "MockExamCompleteResponse",
    "MockExamHistoryItem",
    "MockExamStatisticsResponse",
]
