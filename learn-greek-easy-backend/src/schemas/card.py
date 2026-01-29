"""Card-related Pydantic schemas for API request/response validation.

This module contains schemas for:
- Card management (CRUD operations)
- Card study sessions
- Card statistics tracking
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from src.db.models import DeckLevel, PartOfSpeech

# ============================================================================
# Example Schema
# ============================================================================


class Example(BaseModel):
    """Structured example for a vocabulary card.

    Stores example sentences in multiple languages with optional tense info.
    """

    greek: str = Field(..., min_length=1, max_length=1000, description="Example in Greek")
    english: str = Field(default="", max_length=1000, description="English translation")
    russian: str = Field(default="", max_length=1000, description="Russian translation")
    tense: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Verb tense (present, past, future, etc.) - for verbs only",
    )


# ============================================================================
# Card Schemas
# ============================================================================


class CardBase(BaseModel):
    """Base card schema with common fields."""

    front_text: str = Field(..., min_length=1)
    back_text_en: str = Field(..., min_length=1)
    back_text_ru: Optional[str] = Field(None, min_length=1)
    example_sentence: Optional[str] = None
    pronunciation: Optional[str] = Field(None, max_length=255)
    part_of_speech: Optional[PartOfSpeech] = None
    level: Optional[DeckLevel] = None
    examples: Optional[list[Example]] = Field(
        default=None,
        description="Structured examples with multilingual translations",
    )


class CardCreate(CardBase):
    """Schema for creating a new card (admin only)."""

    deck_id: UUID


class CardUpdate(BaseModel):
    """Schema for updating a card (admin only)."""

    front_text: Optional[str] = Field(None, min_length=1)
    back_text_en: Optional[str] = Field(None, min_length=1)
    back_text_ru: Optional[str] = Field(None, min_length=1)
    example_sentence: Optional[str] = None
    pronunciation: Optional[str] = Field(None, max_length=255)
    part_of_speech: Optional[PartOfSpeech] = None
    level: Optional[DeckLevel] = None
    examples: Optional[list[Example]] = Field(
        default=None,
        description="Structured examples with multilingual translations",
    )


class CardResponse(CardBase):
    """Schema for card response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    deck_id: UUID
    created_at: datetime
    updated_at: datetime


class CardStudyResponse(BaseModel):
    """Schema for card in study session (limited info before answer)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    deck_id: UUID
    front_text: str
    pronunciation: Optional[str]


class CardStudyResultResponse(CardResponse):
    """Schema for card after answer is revealed."""

    pass


class CardWithStatisticsResponse(CardResponse):
    """Schema for card with user statistics."""

    statistics: Optional["CardStatisticsResponse"] = None


class CardListResponse(BaseModel):
    """Schema for paginated card list by deck."""

    total: int
    page: int
    page_size: int
    deck_id: UUID
    cards: list[CardResponse]


class CardSearchResponse(BaseModel):
    """Schema for card search results."""

    total: int
    page: int
    page_size: int
    query: str
    deck_id: UUID | None
    cards: list[CardResponse]


# ============================================================================
# Bulk Card Schemas
# ============================================================================


class CardBulkItemCreate(BaseModel):
    """Single card in bulk create (without deck_id)."""

    front_text: str = Field(..., min_length=1)
    back_text_en: str = Field(..., min_length=1)
    back_text_ru: Optional[str] = Field(None, min_length=1)
    example_sentence: Optional[str] = None
    pronunciation: Optional[str] = Field(None, max_length=255)
    part_of_speech: Optional[PartOfSpeech] = None
    level: Optional[DeckLevel] = None
    examples: Optional[list[Example]] = Field(
        default=None,
        description="Structured examples with multilingual translations",
    )


class CardBulkCreateRequest(BaseModel):
    """Request body for bulk card creation."""

    deck_id: UUID
    cards: list[CardBulkItemCreate] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Array of cards to create (1-100)",
    )


class CardBulkCreateResponse(BaseModel):
    """Response for bulk card creation."""

    deck_id: UUID
    created_count: int
    cards: list[CardResponse]


# Import at the end to avoid circular dependencies
from src.schemas.progress import CardStatisticsResponse  # noqa: E402

# Update forward references
CardWithStatisticsResponse.model_rebuild()
