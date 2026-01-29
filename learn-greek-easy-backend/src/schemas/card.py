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
# Grammar Data Schemas
# ============================================================================


class NounData(BaseModel):
    """Noun grammar data with gender and case forms."""

    gender: str = Field(..., pattern="^(masculine|feminine|neuter)$")
    nominative_singular: str = Field(default="")
    genitive_singular: str = Field(default="")
    accusative_singular: str = Field(default="")
    vocative_singular: str = Field(default="")
    nominative_plural: str = Field(default="")
    genitive_plural: str = Field(default="")
    accusative_plural: str = Field(default="")
    vocative_plural: str = Field(default="")


class VerbData(BaseModel):
    """Verb grammar data with voice and conjugations."""

    voice: str = Field(..., pattern="^(active|passive)$")
    # Present tense
    present_1s: str = Field(default="")
    present_2s: str = Field(default="")
    present_3s: str = Field(default="")
    present_1p: str = Field(default="")
    present_2p: str = Field(default="")
    present_3p: str = Field(default="")
    # Imperfect tense
    imperfect_1s: str = Field(default="")
    imperfect_2s: str = Field(default="")
    imperfect_3s: str = Field(default="")
    imperfect_1p: str = Field(default="")
    imperfect_2p: str = Field(default="")
    imperfect_3p: str = Field(default="")
    # Past (aorist) tense
    past_1s: str = Field(default="")
    past_2s: str = Field(default="")
    past_3s: str = Field(default="")
    past_1p: str = Field(default="")
    past_2p: str = Field(default="")
    past_3p: str = Field(default="")
    # Future tense
    future_1s: str = Field(default="")
    future_2s: str = Field(default="")
    future_3s: str = Field(default="")
    future_1p: str = Field(default="")
    future_2p: str = Field(default="")
    future_3p: str = Field(default="")
    # Perfect tense
    perfect_1s: str = Field(default="")
    perfect_2s: str = Field(default="")
    perfect_3s: str = Field(default="")
    perfect_1p: str = Field(default="")
    perfect_2p: str = Field(default="")
    perfect_3p: str = Field(default="")
    # Imperative
    imperative_2s: str = Field(default="")
    imperative_2p: str = Field(default="")


class AdjectiveData(BaseModel):
    """Adjective grammar data with declensions and comparison forms."""

    # Masculine forms
    masculine_nom_sg: str = Field(default="")
    masculine_gen_sg: str = Field(default="")
    masculine_acc_sg: str = Field(default="")
    masculine_voc_sg: str = Field(default="")
    masculine_nom_pl: str = Field(default="")
    masculine_gen_pl: str = Field(default="")
    masculine_acc_pl: str = Field(default="")
    masculine_voc_pl: str = Field(default="")
    # Feminine forms
    feminine_nom_sg: str = Field(default="")
    feminine_gen_sg: str = Field(default="")
    feminine_acc_sg: str = Field(default="")
    feminine_voc_sg: str = Field(default="")
    feminine_nom_pl: str = Field(default="")
    feminine_gen_pl: str = Field(default="")
    feminine_acc_pl: str = Field(default="")
    feminine_voc_pl: str = Field(default="")
    # Neuter forms
    neuter_nom_sg: str = Field(default="")
    neuter_gen_sg: str = Field(default="")
    neuter_acc_sg: str = Field(default="")
    neuter_voc_sg: str = Field(default="")
    neuter_nom_pl: str = Field(default="")
    neuter_gen_pl: str = Field(default="")
    neuter_acc_pl: str = Field(default="")
    neuter_voc_pl: str = Field(default="")
    # Comparison forms
    comparative: str = Field(default="")
    superlative: str = Field(default="")


class AdverbData(BaseModel):
    """Adverb grammar data with comparison forms."""

    comparative: str = Field(default="")
    superlative: str = Field(default="")


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
    # Grammar data fields
    noun_data: Optional[NounData] = None
    verb_data: Optional[VerbData] = None
    adjective_data: Optional[AdjectiveData] = None
    adverb_data: Optional[AdverbData] = None
    # Search fields
    searchable_forms: Optional[list[str]] = None
    searchable_forms_normalized: Optional[list[str]] = None


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
    # Grammar data fields
    noun_data: Optional[NounData] = None
    verb_data: Optional[VerbData] = None
    adjective_data: Optional[AdjectiveData] = None
    adverb_data: Optional[AdverbData] = None
    # Search fields
    searchable_forms: Optional[list[str]] = None
    searchable_forms_normalized: Optional[list[str]] = None


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
    # Grammar data fields
    noun_data: Optional[NounData] = None
    verb_data: Optional[VerbData] = None
    adjective_data: Optional[AdjectiveData] = None
    adverb_data: Optional[AdverbData] = None
    # Search fields
    searchable_forms: Optional[list[str]] = None
    searchable_forms_normalized: Optional[list[str]] = None


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
