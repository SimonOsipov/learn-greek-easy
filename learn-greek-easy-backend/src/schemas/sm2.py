"""SM-2 Algorithm Pydantic schemas.

These schemas define the data structures for SM-2 calculations,
review processing results, and study queue responses.

This module provides:
- SM2CalculationResponse: Pure algorithm output
- SM2ReviewResult: Single card review result
- SM2BulkReviewResult: Batch review results
- StudyQueueCard: Card with scheduling metadata
- StudyQueue: Study session response
- StudyQueueRequest: Queue request parameters
- CardInitializationRequest/Result: Card initialization schemas
"""

from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from src.db.models import CardDifficulty, CardStatus

# ============================================================================
# SM-2 Calculation Schemas
# ============================================================================


class SM2CalculationResponse(BaseModel):
    """Result of SM-2 algorithm calculation.

    This is the pure algorithm output, without database context.
    """

    new_easiness_factor: float = Field(
        ...,
        ge=1.3,
        description="New easiness factor (minimum 1.3)",
    )
    new_interval: int = Field(
        ...,
        ge=0,
        description="New interval in days until next review",
    )
    new_repetitions: int = Field(
        ...,
        ge=0,
        description="New successful repetition count",
    )
    new_status: CardStatus = Field(
        ...,
        description="New card learning status",
    )


# ============================================================================
# Review Result Schemas
# ============================================================================


class SM2ReviewResult(BaseModel):
    """Result of processing a single card review.

    Returned after submitting a review to show the updated state.
    """

    model_config = ConfigDict(from_attributes=True)

    success: bool = Field(
        default=True,
        description="Whether the review was processed successfully",
    )
    card_id: UUID = Field(
        ...,
        description="ID of the reviewed card",
    )
    quality: int = Field(
        ...,
        ge=0,
        le=5,
        description="Quality rating submitted (0-5)",
    )
    previous_status: CardStatus = Field(
        ...,
        description="Card status before this review",
    )
    new_status: CardStatus = Field(
        ...,
        description="Card status after this review",
    )
    easiness_factor: float = Field(
        ...,
        ge=1.3,
        description="Updated easiness factor",
    )
    interval: int = Field(
        ...,
        ge=0,
        description="New interval in days",
    )
    repetitions: int = Field(
        ...,
        ge=0,
        description="Updated repetition count",
    )
    next_review_date: date = Field(
        ...,
        description="Next scheduled review date",
    )
    message: Optional[str] = Field(
        default=None,
        description="Optional message (e.g., 'Card mastered!')",
    )


class SM2BulkReviewResult(BaseModel):
    """Result of processing multiple reviews in bulk."""

    session_id: str = Field(
        ...,
        description="Study session identifier",
    )
    total_submitted: int = Field(
        ...,
        ge=0,
        description="Total reviews submitted",
    )
    successful: int = Field(
        ...,
        ge=0,
        description="Successfully processed reviews",
    )
    failed: int = Field(
        ...,
        ge=0,
        description="Failed reviews",
    )
    results: list[SM2ReviewResult] = Field(
        default_factory=list,
        description="Individual review results",
    )


# ============================================================================
# Study Queue Schemas
# ============================================================================


class StudyQueueCard(BaseModel):
    """Card in the study queue with scheduling metadata.

    Includes both card content and SM-2 scheduling information.
    """

    model_config = ConfigDict(from_attributes=True)

    card_id: UUID = Field(
        ...,
        description="Card UUID",
    )
    front_text: str = Field(
        ...,
        description="Greek text (front of card)",
    )
    back_text: str = Field(
        ...,
        description="English translation (back of card)",
    )
    example_sentence: Optional[str] = Field(
        default=None,
        description="Example sentence using the word",
    )
    pronunciation: Optional[str] = Field(
        default=None,
        description="Pronunciation guide",
    )
    difficulty: CardDifficulty = Field(
        ...,
        description="Card difficulty level",
    )
    status: CardStatus = Field(
        ...,
        description="Current learning status",
    )
    is_new: bool = Field(
        ...,
        description="True if card has never been reviewed",
    )
    is_early_practice: bool = Field(
        default=False,
        description="True if card is being practiced before its due date",
    )
    due_date: Optional[date] = Field(
        default=None,
        description="Scheduled review date (None for new cards)",
    )
    easiness_factor: Optional[float] = Field(
        default=None,
        description="Current EF (None for new cards)",
    )
    interval: Optional[int] = Field(
        default=None,
        description="Current interval (None for new cards)",
    )


class StudyQueue(BaseModel):
    """Study session queue response.

    Contains cards due for review plus new cards to learn.
    """

    deck_id: UUID = Field(
        ...,
        description="Deck UUID",
    )
    deck_name: str = Field(
        ...,
        description="Deck display name",
    )
    total_due: int = Field(
        ...,
        ge=0,
        description="Number of cards due for review",
    )
    total_new: int = Field(
        ...,
        ge=0,
        description="Number of new cards available",
    )
    total_early_practice: int = Field(
        default=0,
        ge=0,
        description="Number of early practice cards in queue",
    )
    total_in_queue: int = Field(
        ...,
        ge=0,
        description="Total cards in this queue",
    )
    cards: list[StudyQueueCard] = Field(
        default_factory=list,
        description="Cards to study (due cards first, then new, then early practice)",
    )


class StudyQueueRequest(BaseModel):
    """Request parameters for getting study queue."""

    deck_id: Optional[UUID] = Field(
        default=None,
        description="Filter by deck (optional)",
    )
    limit: int = Field(
        default=20,
        ge=1,
        le=100,
        description="Maximum cards to return",
    )
    include_new: bool = Field(
        default=True,
        description="Include new (unstudied) cards",
    )
    new_cards_limit: int = Field(
        default=10,
        ge=0,
        le=50,
        description="Maximum new cards to include",
    )
    include_early_practice: bool = Field(
        default=False,
        description="Include cards not yet due as 'early practice'",
    )
    early_practice_limit: int = Field(
        default=10,
        ge=0,
        le=50,
        description="Maximum early practice cards to include",
    )


# ============================================================================
# Card Initialization Schemas
# ============================================================================


class CardInitializationRequest(BaseModel):
    """Request to initialize cards for a user."""

    deck_id: UUID = Field(
        ...,
        description="Deck containing the cards",
    )
    card_ids: list[UUID] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Card IDs to initialize",
    )


class CardInitializationResult(BaseModel):
    """Result of card initialization."""

    initialized_count: int = Field(
        ...,
        ge=0,
        description="Number of cards initialized",
    )
    already_exists_count: int = Field(
        ...,
        ge=0,
        description="Cards that already had statistics",
    )
    card_ids: list[UUID] = Field(
        default_factory=list,
        description="IDs of newly initialized cards",
    )


# ============================================================================
# Study Statistics Schemas
# ============================================================================


class StudyStatsResponse(BaseModel):
    """Study statistics response for dashboard and analytics.

    This schema provides comprehensive study statistics including card
    status counts, review metrics, and streak information.
    """

    by_status: dict[str, int] = Field(
        ...,
        description="Card counts by status (new, learning, review, mastered, due)",
    )
    reviews_today: int = Field(
        ...,
        ge=0,
        description="Number of reviews completed today",
    )
    current_streak: int = Field(
        ...,
        ge=0,
        description="Current consecutive days study streak",
    )
    due_today: int = Field(
        ...,
        ge=0,
        description="Number of cards due for review today",
    )
    total_reviews: int = Field(
        default=0,
        ge=0,
        description="Total lifetime reviews",
    )
    total_study_time: int = Field(
        default=0,
        ge=0,
        description="Total study time in seconds",
    )
    average_quality: float = Field(
        default=0.0,
        ge=0.0,
        le=5.0,
        description="Average review quality rating",
    )
