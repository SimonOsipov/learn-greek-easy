from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from src.constants import MAX_ANSWER_TIME_SECONDS
from src.db.models import CardStatus


class V2StudyQueueCard(BaseModel):
    """Card in the V2 study queue with scheduling metadata.

    Uses CardRecord-based multi-variant system. Each card represents
    a specific variant (e.g., meaning, spelling, listening) of a word entry.
    """

    model_config = ConfigDict(from_attributes=True)

    card_record_id: UUID = Field(
        ...,
        description="CardRecord UUID",
    )
    word_entry_id: UUID = Field(
        ...,
        description="Associated WordEntry UUID",
    )
    deck_id: UUID = Field(
        ...,
        description="Deck UUID the card belongs to",
    )
    deck_name: str = Field(
        ...,
        description="Deck display name",
    )
    card_type: str = Field(
        ...,
        description="Card type identifier (e.g., 'vocabulary')",
    )
    variant_key: str = Field(
        ...,
        description="Variant key (e.g., 'meaning', 'spelling', 'listening')",
    )
    front_content: dict = Field(
        ...,
        description="Front side content as structured data",
    )
    back_content: dict = Field(
        ...,
        description="Back side content as structured data",
    )
    status: CardStatus = Field(
        default=CardStatus.NEW,
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
    due_date: date | None = Field(
        default=None,
        description="Scheduled review date (None for new cards)",
    )
    easiness_factor: float | None = Field(
        default=None,
        description="Current EF (None for new cards)",
    )
    interval: int | None = Field(
        default=None,
        description="Current interval in days (None for new cards)",
    )
    audio_url: str | None = Field(
        default=None,
        description="Presigned URL for word pronunciation audio",
    )
    example_audio_url: str | None = Field(
        default=None,
        description="Presigned URL for example sentence audio",
    )


class V2StudyQueue(BaseModel):
    """V2 study session queue response.

    Cross-deck queue containing cards from multiple decks.
    No deck_id/deck_name at top level (unlike V1 StudyQueue).
    """

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
    cards: list[V2StudyQueueCard] = Field(
        default_factory=list,
        description="Cards to study (due cards first, then new, then early practice)",
    )


class V2ReviewRequest(BaseModel):
    """Request payload for submitting a single V2 card review."""

    card_record_id: UUID
    quality: int = Field(..., ge=0, le=5, description="Quality rating (0-5)")
    time_taken: int = Field(
        ...,
        ge=0,
        le=MAX_ANSWER_TIME_SECONDS,
        description=f"Time taken in seconds (max {MAX_ANSWER_TIME_SECONDS}s)",
    )


class V2ReviewResult(BaseModel):
    """Result of processing a single V2 card review."""

    model_config = ConfigDict(from_attributes=True)

    card_record_id: UUID
    quality: int = Field(..., ge=0, le=5)
    previous_status: CardStatus
    new_status: CardStatus
    easiness_factor: float = Field(..., ge=1.3)
    interval: int = Field(..., ge=0)
    repetitions: int = Field(..., ge=0)
    next_review_date: date
    message: str | None = None
