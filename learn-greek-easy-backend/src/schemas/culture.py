"""Culture Exam Simulator Pydantic schemas for API request/response validation.

This module contains schemas for:
- Culture deck listing and detail
- Culture question responses
- Answer submission and feedback
- Culture-specific progress tracking
"""

from datetime import date, datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from src.constants import MAX_ANSWER_TIME_SECONDS

# ============================================================================
# Multilingual Content Type
# ============================================================================


class MultilingualText(BaseModel):
    """Multilingual text with Greek, English, and Russian translations."""

    el: str = Field(..., min_length=1, description="Greek text")
    en: str = Field(..., min_length=1, description="English text")
    ru: str = Field(..., min_length=1, description="Russian text")


class GeneratedQuestionResponse(BaseModel):
    """Response schema for AI-generated culture question from Claude."""

    question_text: MultilingualText = Field(..., description="The question in all three languages")
    options: list[MultilingualText] = Field(..., description="Answer options (2 or 4)")
    correct_option: int = Field(..., ge=1, le=4, description="Correct answer index (1-based)")
    category: Literal["history", "geography", "politics", "culture", "traditions", "practical"] = (
        Field(..., description="Question category")
    )
    difficulty: Literal["easy", "medium", "hard"] = Field(..., description="Difficulty level")
    explanation: MultilingualText = Field(..., description="Explanation of the correct answer")
    source_context: str = Field(..., description="Brief context about the source article used")

    @field_validator("options")
    @classmethod
    def validate_options_count(cls, v: list[MultilingualText]) -> list[MultilingualText]:
        """Ensure exactly 2 or 4 options are provided."""
        if len(v) not in (2, 4):
            raise ValueError(
                f"Options must be exactly 2 (True/False) or 4 (multiple choice), got {len(v)}"
            )
        return v

    @model_validator(mode="after")
    def validate_correct_option_range(self) -> "GeneratedQuestionResponse":
        """Ensure correct_option is within options range."""
        if self.correct_option > len(self.options):
            raise ValueError(
                f"correct_option ({self.correct_option}) exceeds option count ({len(self.options)})"
            )
        return self


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
    """Response schema for culture deck listing (localized).

    Returns deck name and description in the user's preferred language
    based on Accept-Language header. The API endpoint is responsible for
    selecting the appropriate language variant before returning this response.

    Language selection priority:
    1. Exact match (e.g., "el" -> Greek)
    2. Fallback to English if requested language unavailable
    3. Default to English if Accept-Language not provided
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Deck unique identifier")
    name: str = Field(..., min_length=1, max_length=255, description="Deck name (localized)")
    description: Optional[str] = Field(None, description="Deck description (localized)")

    # All-language fields for client-side locale resolution
    name_en: Optional[str] = Field(None, max_length=255, description="Deck name in English")
    name_ru: Optional[str] = Field(None, max_length=255, description="Deck name in Russian")
    description_en: Optional[str] = Field(None, description="Deck description in English")
    description_ru: Optional[str] = Field(None, description="Deck description in Russian")

    category: str = Field(
        ...,
        max_length=50,
        description="Category: history, geography, politics, culture, traditions",
    )
    question_count: int = Field(..., ge=0, description="Total questions in deck")
    is_premium: bool = Field(
        default=False, description="Whether deck requires premium subscription"
    )
    progress: Optional[CultureDeckProgress] = Field(
        None, description="User progress (null for unauthenticated)"
    )


class CultureDeckDetailResponse(CultureDeckResponse):
    """Extended deck response with additional metadata (localized).

    Inherits localized name and description from CultureDeckResponse.
    Used for single deck detail views in the public API.
    """

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
        min_length=2,
        max_length=4,
        description="2-4 answer options, each with {el, en, ru}",
    )
    option_count: int = Field(..., ge=2, le=4, description="Number of answer options (2, 3, or 4)")
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
    time_taken: int = Field(
        ...,
        ge=0,
        le=MAX_ANSWER_TIME_SECONDS,
        description=f"Time taken in seconds (max {MAX_ANSWER_TIME_SECONDS}s)",
    )
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
# Motivation Message Schema
# ============================================================================


class MotivationMessage(BaseModel):
    """Motivational message based on user's progress delta and readiness level."""

    message_key: str = Field(..., description="i18n translation key")
    params: dict[str, Any] = Field(..., description="Interpolation parameters")
    delta_direction: Literal["improving", "stagnant", "declining", "new_user"] = Field(
        ..., description="Direction of progress change"
    )
    delta_percentage: float = Field(..., description="Signed delta from last week")


# ============================================================================
# Culture Exam Readiness Schema
# ============================================================================

ReadinessVerdict = Literal["not_ready", "getting_there", "ready", "thoroughly_prepared"]


class CategoryReadiness(BaseModel):
    """Readiness data for a single logical culture category."""

    category: str = Field(
        ..., description="Logical category key: history, geography, politics, culture"
    )
    readiness_percentage: float = Field(..., ge=0, le=100, description="Weighted readiness 0-100")
    questions_mastered: int = Field(..., ge=0, description="Questions with MASTERED status")
    questions_total: int = Field(..., ge=0, description="Total questions in this category")
    deck_ids: list[str] = Field(
        default_factory=list, description="UUIDs of decks in this logical category"
    )


class CultureReadinessResponse(BaseModel):
    """Response schema for culture exam readiness assessment.

    Calculates a weighted readiness score based on SRS card stages
    across exam-relevant categories and maps it to a verdict.
    """

    readiness_percentage: float = Field(
        ..., ge=0, le=100, description="Weighted readiness score (0-100)"
    )
    verdict: ReadinessVerdict = Field(..., description="Human-readable readiness verdict")
    questions_learned: int = Field(..., ge=0, description="Questions with MASTERED status")
    questions_total: int = Field(
        ..., ge=0, description="Total questions across included categories"
    )
    accuracy_percentage: Optional[float] = Field(
        None, ge=0, le=100, description="Overall answer accuracy (null if no answers)"
    )
    total_answers: int = Field(
        ..., ge=0, description="Total answers submitted across included categories"
    )
    categories: list[CategoryReadiness] = Field(
        default_factory=list,
        description="Per-category readiness breakdown, sorted ascending by readiness_percentage",
    )
    motivation: Optional[MotivationMessage] = Field(
        None, description="Motivational message (null when no content exists)"
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
        min_length=2,
        max_length=4,
        description="2-4 answer options, each with {el, en, ru}",
    )
    option_count: int = Field(..., ge=2, le=4, description="Number of answer options (2, 3, or 4)")
    image_url: Optional[str] = Field(None, description="Pre-signed S3 URL for question image")
    audio_url: Optional[str] = Field(None, description="Pre-signed S3 URL for question audio")
    order_index: int = Field(..., ge=0, description="Question order within deck")
    correct_option: int = Field(..., ge=1, le=4, description="Correct answer option (1-based)")
    is_new: bool = Field(..., description="True if user hasn't studied this question yet")
    due_date: Optional[date] = Field(None, description="Next review date (null for new questions)")
    status: str = Field(..., description="Card status: new, learning, review, mastered")
    original_article_url: Optional[str] = Field(None, description="Source news article URL")


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
    has_studied_questions: bool = Field(
        default=False,
        description="Whether the user has studied any questions in this deck before",
    )
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
    """Schema for creating a new culture deck (admin only).

    Requires name and description in all three supported languages (el, en, ru).
    """

    # Multilingual name fields (all required)
    name_el: str = Field(..., min_length=1, max_length=255, description="Deck name in Greek")
    name_en: str = Field(..., min_length=1, max_length=255, description="Deck name in English")
    name_ru: str = Field(..., min_length=1, max_length=255, description="Deck name in Russian")

    # Multilingual description fields (all optional)
    description_el: Optional[str] = Field(None, description="Deck description in Greek")
    description_en: Optional[str] = Field(None, description="Deck description in English")
    description_ru: Optional[str] = Field(None, description="Deck description in Russian")

    # Non-localized fields (unchanged)
    category: str = Field(
        ...,
        max_length=50,
        description="Category: history, geography, politics, culture, traditions",
    )
    order_index: int = Field(default=0, ge=0, description="Display order within category")
    is_premium: bool = Field(
        default=False, description="Whether deck requires premium subscription"
    )


class CultureDeckUpdate(BaseModel):
    """Schema for updating a culture deck (admin only). All fields optional.

    Supports partial updates - only provided fields are updated.
    Language fields can be updated independently.
    """

    # Multilingual name fields (all optional for partial updates)
    name_el: Optional[str] = Field(
        None, min_length=1, max_length=255, description="Deck name in Greek"
    )
    name_en: Optional[str] = Field(
        None, min_length=1, max_length=255, description="Deck name in English"
    )
    name_ru: Optional[str] = Field(
        None, min_length=1, max_length=255, description="Deck name in Russian"
    )

    # Multilingual description fields (all optional)
    description_el: Optional[str] = Field(None, description="Deck description in Greek")
    description_en: Optional[str] = Field(None, description="Deck description in English")
    description_ru: Optional[str] = Field(None, description="Deck description in Russian")

    # Non-localized fields (unchanged)
    category: Optional[str] = Field(
        None,
        max_length=50,
        description="Category: history, geography, politics, culture, traditions",
    )
    order_index: Optional[int] = Field(None, ge=0, description="Display order within category")
    is_active: Optional[bool] = Field(None, description="Whether deck is active")
    is_premium: Optional[bool] = Field(
        None, description="Whether deck requires premium subscription"
    )


class CultureDeckAdminResponse(BaseModel):
    """Admin response schema for culture deck (all language variants).

    Used by admin endpoints to display and edit deck content in all languages.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Deck unique identifier")

    # Multilingual name fields
    name_el: str = Field(..., description="Deck name in Greek")
    name_en: str = Field(..., description="Deck name in English")
    name_ru: str = Field(..., description="Deck name in Russian")

    # Multilingual description fields
    description_el: Optional[str] = Field(None, description="Deck description in Greek")
    description_en: Optional[str] = Field(None, description="Deck description in English")
    description_ru: Optional[str] = Field(None, description="Deck description in Russian")

    # Non-localized fields
    category: str = Field(
        ...,
        max_length=50,
        description="Category: history, geography, politics, culture, traditions",
    )
    question_count: int = Field(..., ge=0, description="Total questions in deck")
    is_active: bool = Field(..., description="Whether deck is active")
    is_premium: bool = Field(
        default=False, description="Whether deck requires premium subscription"
    )
    order_index: int = Field(..., ge=0, description="Display order within category")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


class CultureDeckAdminListResponse(BaseModel):
    """Paginated list of culture decks for admin API."""

    total: int = Field(..., ge=0, description="Total deck count")
    decks: list[CultureDeckAdminResponse] = Field(
        ..., description="List of decks with all language variants"
    )


# ============================================================================
# Culture Question CRUD Schemas (Admin)
# ============================================================================


class CultureQuestionCreate(BaseModel):
    """Schema for creating a new culture question (admin only).

    Supports 2, 3, or 4 answer options:
    - option_a and option_b are always required
    - option_c is optional (required for 3-4 option questions)
    - option_d is optional (required for 4 option questions)
    - correct_option must be within the range of available options
    """

    deck_id: UUID = Field(..., description="Deck UUID this question belongs to")
    question_text: MultilingualText = Field(
        ..., description="Multilingual question text {el, en, ru}"
    )
    option_a: MultilingualText = Field(..., description="Option A: {el, en, ru} (required)")
    option_b: MultilingualText = Field(..., description="Option B: {el, en, ru} (required)")
    option_c: Optional[MultilingualText] = Field(
        None, description="Option C: {el, en, ru} (optional, for 3-4 option questions)"
    )
    option_d: Optional[MultilingualText] = Field(
        None, description="Option D: {el, en, ru} (optional, for 4 option questions)"
    )
    correct_option: int = Field(..., ge=1, le=4, description="Correct answer (1=A, 2=B, 3=C, 4=D)")
    image_key: Optional[str] = Field(
        None, max_length=500, description="S3 key for question image (optional)"
    )
    order_index: int = Field(default=0, ge=0, description="Display order within deck")

    @model_validator(mode="after")
    def validate_options_and_correct_answer(self) -> "CultureQuestionCreate":
        """Validate that correct_option is within available options and no gaps exist."""
        option_count = 2  # A and B always required
        if self.option_c is not None:
            option_count += 1
        if self.option_d is not None:
            option_count += 1

        if self.option_d is not None and self.option_c is None:
            raise ValueError("option_d requires option_c to be present (no gaps allowed)")

        if self.correct_option > option_count:
            raise ValueError(
                f"correct_option ({self.correct_option}) exceeds available options ({option_count})"
            )

        return self


class CultureQuestionUpdate(BaseModel):
    """Schema for updating a culture question (admin only). All fields optional.

    Supports variable answer options (2, 3, or 4):
    - Set option_c to None to remove it (converts 4->3 or 3->2 option question)
    - Set option_d to None to remove it (converts 4->3 option question)
    - Validation of correct_option range happens in the service layer
      since it requires knowledge of existing options for partial updates
    """

    question_text: Optional[MultilingualText] = Field(
        None, description="Multilingual question text {el, en, ru}"
    )
    option_a: Optional[MultilingualText] = Field(None, description="Option A: {el, en, ru}")
    option_b: Optional[MultilingualText] = Field(None, description="Option B: {el, en, ru}")
    option_c: Optional[MultilingualText] = Field(
        None, description="Option C: {el, en, ru} (set to null to remove)"
    )
    option_d: Optional[MultilingualText] = Field(
        None, description="Option D: {el, en, ru} (set to null to remove)"
    )
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
    option_c: Optional[dict[str, str]] = Field(
        None, description="Option C: {el, en, ru} (null for 2-option questions)"
    )
    option_d: Optional[dict[str, str]] = Field(
        None, description="Option D: {el, en, ru} (null for 2-3 option questions)"
    )
    correct_option: int = Field(..., ge=1, le=4, description="Correct answer (1=A, 2=B, 3=C, 4=D)")
    option_count: int = Field(..., ge=2, le=4, description="Number of answer options (2, 3, or 4)")
    image_key: Optional[str] = Field(None, description="S3 key for question image")
    order_index: int = Field(..., ge=0, description="Display order within deck")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


# ============================================================================
# Bulk Question Create Schemas
# ============================================================================


class CultureQuestionBulkItem(BaseModel):
    """Single question in bulk create (without deck_id).

    Supports 2, 3, or 4 answer options:
    - option_a and option_b are always required
    - option_c is optional (required for 3-4 option questions)
    - option_d is optional (required for 4 option questions)
    - correct_option must be within the range of available options
    """

    question_text: MultilingualText = Field(
        ..., description="Multilingual question text {el, en, ru}"
    )
    option_a: MultilingualText = Field(..., description="Option A: {el, en, ru} (required)")
    option_b: MultilingualText = Field(..., description="Option B: {el, en, ru} (required)")
    option_c: Optional[MultilingualText] = Field(
        None, description="Option C: {el, en, ru} (optional, for 3-4 option questions)"
    )
    option_d: Optional[MultilingualText] = Field(
        None, description="Option D: {el, en, ru} (optional, for 4 option questions)"
    )
    correct_option: int = Field(..., ge=1, le=4, description="Correct answer (1=A, 2=B, 3=C, 4=D)")
    image_key: Optional[str] = Field(
        None, max_length=500, description="S3 key for question image (optional)"
    )
    order_index: int = Field(default=0, ge=0, description="Display order within deck")

    @model_validator(mode="after")
    def validate_options_and_correct_answer(self) -> "CultureQuestionBulkItem":
        """Validate that correct_option is within available options and no gaps exist."""
        option_count = 2  # A and B always required
        if self.option_c is not None:
            option_count += 1
        if self.option_d is not None:
            option_count += 1

        if self.option_d is not None and self.option_c is None:
            raise ValueError("option_d requires option_c to be present (no gaps allowed)")

        if self.correct_option > option_count:
            raise ValueError(
                f"correct_option ({self.correct_option}) exceeds available options ({option_count})"
            )

        return self


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
