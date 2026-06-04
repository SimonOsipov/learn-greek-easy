from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from src.constants import MAX_ANSWER_TIME_SECONDS
from src.db.models import CardStatus


class V2RatingPreview(BaseModel):
    """Projected SM-2 outcome for a single UI rating (pure read-only; no DB writes)."""

    rating: int = Field(..., description="UI rating (1=Forgot, 2=Tough, 3=OK, 4=Easy)")
    quality: int = Field(..., description="SM-2 quality value (0, 2, 4, or 5)")
    interval: int = Field(..., description="Projected next interval in days")
    next_review_date: date = Field(..., description="Projected next review date")
    new_status: CardStatus = Field(..., description="Projected card status after this rating")


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
    translation_ru: str | None = Field(
        default=None,
        description="Russian translation of the word",
    )
    translation_ru_plural: str | None = Field(
        default=None,
        description="Russian plural translation of the word",
    )
    sentence_ru: str | None = Field(
        default=None,
        description="Russian translation of the example sentence (sentence_translation target_to_el only)",
    )
    example_el: str | None = Field(
        default=None,
        description="Greek example sentence text (from WordEntry.examples[n].greek). "
        "Populated for sentence_translation and cloze cards where an example exists.",
    )
    example_en: str | None = Field(
        default=None,
        description="English gloss of the example sentence (from WordEntry.examples[n].english). "
        "Populated for sentence_translation and cloze cards where an example exists.",
    )
    rating_previews: list[V2RatingPreview] = Field(
        default_factory=list,
        description="Projected SM-2 outcome for each UI rating (1–4). Pure projection — no DB writes.",
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
