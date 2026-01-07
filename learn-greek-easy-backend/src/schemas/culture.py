"""Culture Exam Simulator Pydantic schemas for API request/response validation.

This module contains schemas for:
- Culture deck listing and detail
- Culture question responses
- Answer submission and feedback
- Culture-specific progress tracking
"""

from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ============================================================================
# Multilingual Content Type
# ============================================================================


class MultilingualText(BaseModel):
    """Multilingual text with Greek, English, and Russian translations."""

    el: str = Field(..., min_length=1, description="Greek text")
    en: str = Field(..., min_length=1, description="English text")
    ru: str = Field(..., min_length=1, description="Russian text")


# ============================================================================
# Culture Deck Progress Schemas
# ============================================================================


class CultureDeckProgress(BaseModel):
    """Progress statistics for a culture deck."""

    questions_total: int = Field(..., ge=0, description="Total questions in deck")
    questions_mastered: int = Field(..., ge=0, description="Questions with mastered status")
    questions_learning: int = Field(..., ge=0, description="Questions currently learning")
    questions_new: int = Field(..., ge=0, description="Questions not yet attempted")
    last_practiced_at: Optional[datetime] = Field(
        None, description="Last practice session timestamp"
    )


# ============================================================================
# Culture Deck Schemas
# ============================================================================


class CultureDeckResponse(BaseModel):
    """Response schema for culture deck listing."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Deck unique identifier")
    name: str = Field(..., min_length=1, max_length=255, description="Deck name")
    description: Optional[str] = Field(None, description="Deck description")
    icon: str = Field(..., max_length=50, description="Icon identifier (e.g., 'book-open', 'map')")
    color_accent: str = Field(
        ..., pattern=r"^#[0-9A-Fa-f]{6}$", description="Hex color (e.g., '#4F46E5')"
    )
    category: str = Field(
        ...,
        max_length=50,
        description="Category: history, geography, politics, culture, traditions",
    )
    question_count: int = Field(..., ge=0, description="Total questions in deck")
    progress: Optional[CultureDeckProgress] = Field(
        None, description="User progress (null for unauthenticated)"
    )


class CultureDeckDetailResponse(CultureDeckResponse):
    """Extended deck response with additional metadata."""

    is_active: bool = Field(..., description="Whether deck is active")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


class CultureDeckListResponse(BaseModel):
    """Paginated list of culture decks."""

    total: int = Field(..., ge=0, description="Total deck count")
    decks: list[CultureDeckResponse] = Field(..., description="List of decks")


# ============================================================================
# Culture Question Schemas
# ============================================================================


class CultureQuestionResponse(BaseModel):
    """Response schema for culture question in practice session."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Question unique identifier")
    question_text: dict[str, str] = Field(..., description="Multilingual question {el, en, ru}")
    options: list[dict[str, str]] = Field(
        ...,
        min_length=4,
        max_length=4,
        description="Four answer options, each with {el, en, ru}",
    )
    image_url: Optional[str] = Field(None, description="Pre-signed S3 URL for question image")
    order_index: int = Field(..., ge=0, description="Question order within deck")


class CultureQuestionListResponse(BaseModel):
    """Response for question list endpoint."""

    deck_id: UUID = Field(..., description="Deck these questions belong to")
    total: int = Field(..., ge=0, description="Total questions available")
    questions: list[CultureQuestionResponse] = Field(..., description="Questions for session")


# ============================================================================
# Culture Question Stats Schemas
# ============================================================================


class CultureQuestionStatsResponse(BaseModel):
    """SM-2 statistics for a culture question."""

    model_config = ConfigDict(from_attributes=True)

    easiness_factor: float = Field(..., ge=1.3, le=2.5, description="SM-2 easiness factor")
    interval: int = Field(..., ge=0, description="Days until next review")
    repetitions: int = Field(..., ge=0, description="Successful repetition count")
    next_review_date: date = Field(..., description="Scheduled review date")
    status: str = Field(..., description="Card status: new, learning, review, mastered")


# ============================================================================
# Answer Submission Schemas
# ============================================================================


class CultureAnswerRequest(BaseModel):
    """Request schema for submitting an answer."""

    selected_option: int = Field(..., ge=1, le=4, description="Selected option (1-4)")
    time_taken: int = Field(..., ge=0, description="Time taken in seconds")
    language: str = Field(
        default="en",
        pattern=r"^(el|en|ru)$",
        description="Language used for the question (el, en, ru)",
    )

    @field_validator("selected_option")
    @classmethod
    def validate_option_range(cls, v: int) -> int:
        """Ensure option is within valid range."""
        if v < 1 or v > 4:
            raise ValueError("selected_option must be between 1 and 4")
        return v

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: str) -> str:
        """Ensure language is valid."""
        if v not in ("el", "en", "ru"):
            raise ValueError("language must be one of: el, en, ru")
        return v


class CultureAnswerResponse(BaseModel):
    """Response schema for answer submission."""

    is_correct: bool = Field(..., description="Whether the answer was correct")
    correct_option: int = Field(..., ge=1, le=4, description="The correct answer (1-4)")
    xp_earned: int = Field(..., ge=0, description="XP awarded for this answer")
    new_stats: CultureQuestionStatsResponse = Field(..., description="Updated SM-2 statistics")


# ============================================================================
# Culture Progress Schemas
# ============================================================================


class CultureOverallProgress(BaseModel):
    """Overall culture learning progress."""

    total_questions: int = Field(..., ge=0, description="Total questions across all decks")
    questions_mastered: int = Field(..., ge=0, description="Total mastered")
    questions_learning: int = Field(..., ge=0, description="Total in learning")
    questions_new: int = Field(..., ge=0, description="Total not attempted")
    decks_started: int = Field(..., ge=0, description="Decks with at least one attempt")
    decks_completed: int = Field(..., ge=0, description="Decks with all questions mastered")
    accuracy_percentage: float = Field(..., ge=0, le=100, description="Overall accuracy rate")
    total_practice_sessions: int = Field(..., ge=0, description="Total sessions completed")


class CultureProgressResponse(BaseModel):
    """Response for culture progress endpoint."""

    overall: CultureOverallProgress = Field(..., description="Overall progress stats")
    by_category: dict[str, CultureDeckProgress] = Field(
        ..., description="Progress by category (history, geography, etc.)"
    )
    recent_sessions: list[dict[str, Any]] = Field(
        default_factory=list, description="Last 5 practice sessions"
    )


# ============================================================================
# Session Summary Schema (Reuse pattern from existing)
# ============================================================================


class CultureSessionSummary(BaseModel):
    """Summary of a completed practice session."""

    session_id: str = Field(..., description="Session identifier")
    deck_id: UUID = Field(..., description="Deck practiced")
    deck_name: str = Field(..., description="Deck name")
    questions_answered: int = Field(..., ge=0, description="Total questions answered")
    correct_count: int = Field(..., ge=0, description="Correct answers")
    incorrect_count: int = Field(..., ge=0, description="Incorrect answers")
    accuracy_percentage: float = Field(..., ge=0, le=100, description="Session accuracy")
    xp_earned: int = Field(..., ge=0, description="Total XP earned in session")
    duration_seconds: int = Field(..., ge=0, description="Session duration")
    started_at: datetime = Field(..., description="Session start time")
    ended_at: datetime = Field(..., description="Session end time")


# ============================================================================
# Question Queue Schemas (SM-2 practice sessions)
# ============================================================================


class CultureQuestionQueueItem(BaseModel):
    """A single question in the practice queue with SM-2 metadata."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Question unique identifier")
    question_text: dict[str, str] = Field(..., description="Multilingual question {el, en, ru}")
    options: list[dict[str, str]] = Field(
        ...,
        min_length=4,
        max_length=4,
        description="Four answer options, each with {el, en, ru}",
    )
    image_url: Optional[str] = Field(None, description="Pre-signed S3 URL for question image")
    order_index: int = Field(..., ge=0, description="Question order within deck")
    is_new: bool = Field(..., description="True if user hasn't studied this question yet")
    due_date: Optional[date] = Field(None, description="Next review date (null for new questions)")
    status: str = Field(..., description="Card status: new, learning, review, mastered")


class CultureQuestionQueue(BaseModel):
    """Response for question queue endpoint (practice session)."""

    deck_id: UUID = Field(..., description="Deck these questions belong to")
    deck_name: str = Field(..., description="Deck name")
    category: str = Field(
        ...,
        max_length=50,
        description="Deck category: history, geography, politics, culture, traditions, practical",
    )
    total_due: int = Field(..., ge=0, description="Number of due questions in queue")
    total_new: int = Field(..., ge=0, description="Number of new questions in queue")
    total_in_queue: int = Field(..., ge=0, description="Total questions in this queue")
    questions: list[CultureQuestionQueueItem] = Field(..., description="Questions for practice")


class CultureQuestionQueueRequest(BaseModel):
    """Request parameters for fetching question queue."""

    limit: int = Field(default=10, ge=1, le=50, description="Max questions to return")
    include_new: bool = Field(default=True, description="Include new (unstudied) questions")
    new_questions_limit: int = Field(
        default=5, ge=0, le=20, description="Max new questions if include_new=True"
    )


# ============================================================================
# SM-2 Answer Result Schema
# ============================================================================


class SM2QuestionResult(BaseModel):
    """SM-2 algorithm result after processing an answer."""

    success: bool = Field(..., description="Whether the SM-2 calculation succeeded")
    question_id: UUID = Field(..., description="Question that was answered")
    previous_status: str = Field(..., description="Status before this answer")
    new_status: str = Field(..., description="Status after SM-2 calculation")
    easiness_factor: float = Field(..., ge=1.3, description="Updated easiness factor")
    interval: int = Field(..., ge=0, description="Days until next review")
    repetitions: int = Field(..., ge=0, description="Consecutive successful repetitions")
    next_review_date: date = Field(..., description="Calculated next review date")


class CultureAnswerResponseWithSM2(BaseModel):
    """Enhanced response schema for answer submission with SM-2 details."""

    is_correct: bool = Field(..., description="Whether the answer was correct")
    correct_option: int = Field(..., ge=1, le=4, description="The correct answer (1-4)")
    xp_earned: int = Field(..., ge=0, description="XP awarded for this answer")
    sm2_result: SM2QuestionResult = Field(..., description="SM-2 algorithm result")
    message: Optional[str] = Field(None, description="Feedback message for UI")
    deck_category: str = Field(
        ...,
        description="Deck category for achievement tracking (history, geography, politics, culture, traditions, practical)",
    )


class CultureAnswerResponseFast(BaseModel):
    """Fast response - returns immediately before SM-2 processing.

    This schema is used for the early response pattern where we return
    to the client immediately with basic information while deferring
    SM-2 calculations, XP awards, and achievement checks to background tasks.

    The xp_earned is an optimistic estimate based on constants, not actual
    DB state. The sm2_result field is intentionally omitted as it requires
    DB queries that are deferred to background processing.
    """

    is_correct: bool = Field(..., description="Whether the answer was correct")
    correct_option: int = Field(..., ge=1, le=4, description="The correct answer (1-4)")
    xp_earned: int = Field(..., ge=0, description="XP awarded (calculated, not persisted yet)")
    message: Optional[str] = Field(None, description="Feedback message for UI")
    deck_category: str = Field(..., description="Deck category for achievement tracking")
    # Note: sm2_result intentionally omitted - not available in fast path


# ============================================================================
# Culture Deck CRUD Schemas (Admin)
# ============================================================================


class CultureDeckCreate(BaseModel):
    """Schema for creating a new culture deck (admin only)."""

    name: str = Field(..., min_length=1, max_length=255, description="Deck name")
    description: Optional[str] = Field(None, description="Deck description")
    icon: str = Field(..., max_length=50, description="Icon identifier (e.g., 'book-open', 'map')")
    color_accent: str = Field(
        ..., pattern=r"^#[0-9A-Fa-f]{6}$", description="Hex color (e.g., '#4F46E5')"
    )
    category: str = Field(
        ...,
        max_length=50,
        description="Category: history, geography, politics, culture, traditions",
    )
    order_index: int = Field(default=0, ge=0, description="Display order within category")


class CultureDeckUpdate(BaseModel):
    """Schema for updating a culture deck (admin only). All fields optional."""

    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Deck name")
    description: Optional[str] = Field(None, description="Deck description")
    icon: Optional[str] = Field(
        None, max_length=50, description="Icon identifier (e.g., 'book-open', 'map')"
    )
    color_accent: Optional[str] = Field(
        None, pattern=r"^#[0-9A-Fa-f]{6}$", description="Hex color (e.g., '#4F46E5')"
    )
    category: Optional[str] = Field(
        None,
        max_length=50,
        description="Category: history, geography, politics, culture, traditions",
    )
    order_index: Optional[int] = Field(None, ge=0, description="Display order within category")
    is_active: Optional[bool] = Field(None, description="Whether deck is active")


# ============================================================================
# Culture Question CRUD Schemas (Admin)
# ============================================================================


class CultureQuestionCreate(BaseModel):
    """Schema for creating a new culture question (admin only)."""

    deck_id: UUID = Field(..., description="Deck UUID this question belongs to")
    question_text: MultilingualText = Field(
        ..., description="Multilingual question text {el, en, ru}"
    )
    option_a: MultilingualText = Field(..., description="Option A: {el, en, ru}")
    option_b: MultilingualText = Field(..., description="Option B: {el, en, ru}")
    option_c: MultilingualText = Field(..., description="Option C: {el, en, ru}")
    option_d: MultilingualText = Field(..., description="Option D: {el, en, ru}")
    correct_option: int = Field(..., ge=1, le=4, description="Correct answer (1=A, 2=B, 3=C, 4=D)")
    image_key: Optional[str] = Field(
        None, max_length=500, description="S3 key for question image (optional)"
    )
    order_index: int = Field(default=0, ge=0, description="Display order within deck")


class CultureQuestionUpdate(BaseModel):
    """Schema for updating a culture question (admin only). All fields optional."""

    question_text: Optional[MultilingualText] = Field(
        None, description="Multilingual question text {el, en, ru}"
    )
    option_a: Optional[MultilingualText] = Field(None, description="Option A: {el, en, ru}")
    option_b: Optional[MultilingualText] = Field(None, description="Option B: {el, en, ru}")
    option_c: Optional[MultilingualText] = Field(None, description="Option C: {el, en, ru}")
    option_d: Optional[MultilingualText] = Field(None, description="Option D: {el, en, ru}")
    correct_option: Optional[int] = Field(
        None, ge=1, le=4, description="Correct answer (1=A, 2=B, 3=C, 4=D)"
    )
    image_key: Optional[str] = Field(
        None, max_length=500, description="S3 key for question image (optional)"
    )
    order_index: Optional[int] = Field(None, ge=0, description="Display order within deck")


class CultureQuestionAdminResponse(BaseModel):
    """Admin response schema for culture question (includes correct_option)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Question unique identifier")
    deck_id: UUID = Field(..., description="Deck UUID")
    question_text: dict[str, str] = Field(..., description="Multilingual question {el, en, ru}")
    option_a: dict[str, str] = Field(..., description="Option A: {el, en, ru}")
    option_b: dict[str, str] = Field(..., description="Option B: {el, en, ru}")
    option_c: dict[str, str] = Field(..., description="Option C: {el, en, ru}")
    option_d: dict[str, str] = Field(..., description="Option D: {el, en, ru}")
    correct_option: int = Field(..., ge=1, le=4, description="Correct answer (1=A, 2=B, 3=C, 4=D)")
    image_key: Optional[str] = Field(None, description="S3 key for question image")
    order_index: int = Field(..., ge=0, description="Display order within deck")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


# ============================================================================
# Bulk Question Create Schemas
# ============================================================================


class CultureQuestionBulkItem(BaseModel):
    """Single question in bulk create (without deck_id)."""

    question_text: MultilingualText = Field(
        ..., description="Multilingual question text {el, en, ru}"
    )
    option_a: MultilingualText = Field(..., description="Option A: {el, en, ru}")
    option_b: MultilingualText = Field(..., description="Option B: {el, en, ru}")
    option_c: MultilingualText = Field(..., description="Option C: {el, en, ru}")
    option_d: MultilingualText = Field(..., description="Option D: {el, en, ru}")
    correct_option: int = Field(..., ge=1, le=4, description="Correct answer (1=A, 2=B, 3=C, 4=D)")
    image_key: Optional[str] = Field(
        None, max_length=500, description="S3 key for question image (optional)"
    )
    order_index: int = Field(default=0, ge=0, description="Display order within deck")


class CultureQuestionBulkCreateRequest(BaseModel):
    """Request body for bulk question creation."""

    deck_id: UUID = Field(..., description="Deck UUID to add questions to")
    questions: list[CultureQuestionBulkItem] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Array of questions to create (1-100)",
    )


class CultureQuestionBulkCreateResponse(BaseModel):
    """Response for bulk question creation."""

    deck_id: UUID = Field(..., description="Deck UUID")
    created_count: int = Field(..., ge=0, description="Number of questions created")
    questions: list[CultureQuestionAdminResponse] = Field(
        ..., description="List of created questions"
    )
