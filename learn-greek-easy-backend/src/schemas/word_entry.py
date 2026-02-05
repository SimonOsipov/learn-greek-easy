"""WordEntry-related Pydantic schemas for API request/response validation.

This module contains schemas for:
- WordEntry management (CRUD operations)
- Grammar data structures (flexible JSONB)
- Example sentences with multilingual support
- Paginated word entry listings

Grammar Data Structure:
-----------------------
The grammar_data field stores part-of-speech specific grammatical information.
Structure varies by part_of_speech:

For NOUN:
    {
        "gender": "masculine|feminine|neuter",
        "nominative_singular": "...",
        "genitive_singular": "...",
        "accusative_singular": "...",
        "vocative_singular": "...",
        "nominative_plural": "...",
        "genitive_plural": "...",
        "accusative_plural": "...",
        "vocative_plural": "..."
    }

For VERB:
    {
        "voice": "active|passive",
        "present_1s": "...", "present_2s": "...", ...
        "past_1s": "...", "past_2s": "...", ...
        "future_1s": "...", "future_2s": "...", ...
        "imperative_2s": "...", "imperative_2p": "..."
    }

For ADJECTIVE:
    {
        "masculine_nom_sg": "...", "masculine_gen_sg": "...", ...
        "feminine_nom_sg": "...", "feminine_gen_sg": "...", ...
        "neuter_nom_sg": "...", "neuter_gen_sg": "...", ...
        "comparative": "...",
        "superlative": "..."
    }

For ADVERB:
    {
        "comparative": "...",
        "superlative": "..."
    }
"""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from src.db.models import DeckLevel, PartOfSpeech

# ============================================================================
# Example Sentence Schema
# ============================================================================


class ExampleSentence(BaseModel):
    """Structured example sentence with multilingual translations.

    Used within WordEntry to provide contextual usage examples.
    Greek is required; English and Russian are optional.
    """

    greek: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Example sentence in Greek (required)",
    )
    english: str = Field(
        default="",
        max_length=1000,
        description="English translation",
    )
    russian: str = Field(
        default="",
        max_length=1000,
        description="Russian translation",
    )
    context: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Optional context (e.g., 'formal', 'colloquial')",
    )


# ============================================================================
# Grammar Data Schema
# ============================================================================


class GrammarData(BaseModel):
    """Flexible grammar data container for part-of-speech specific information.

    This schema allows arbitrary keys to support different grammar structures
    for nouns, verbs, adjectives, and adverbs. See module docstring for
    expected structure per part of speech.

    All values should be strings. Keys should follow snake_case convention.
    """

    model_config = ConfigDict(extra="allow")  # Allow arbitrary fields

    # Common optional fields that may appear across multiple POS types
    gender: Optional[str] = Field(
        default=None,
        pattern="^(masculine|feminine|neuter)$",
        description="Grammatical gender (nouns)",
    )
    voice: Optional[str] = Field(
        default=None,
        pattern="^(active|passive)$",
        description="Verb voice",
    )
    comparative: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Comparative form (adjectives, adverbs)",
    )
    superlative: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Superlative form (adjectives, adverbs)",
    )


# ============================================================================
# WordEntry Base Schema
# ============================================================================


class WordEntryBase(BaseModel):
    """Base schema with common fields for WordEntry create/update operations.

    Contains all content fields without id, deck_id, and timestamps.
    """

    lemma: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Dictionary form (base form) of the word in Greek",
    )
    part_of_speech: PartOfSpeech = Field(
        ...,
        description="Part of speech classification",
    )
    cefr_level: Optional[DeckLevel] = Field(
        default=None,
        description="CEFR level (A1-C2), overrides deck level if set",
    )
    translation_en: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="English translation(s)",
    )
    translation_ru: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Russian translation(s)",
    )
    pronunciation: Optional[str] = Field(
        default=None,
        max_length=200,
        description="IPA or phonetic pronunciation guide",
    )
    grammar_data: Optional[GrammarData] = Field(
        default=None,
        description="Part-of-speech specific grammar information (JSONB)",
    )
    examples: Optional[list[ExampleSentence]] = Field(
        default=None,
        description="Usage examples with translations",
    )
    audio_key: Optional[str] = Field(
        default=None,
        max_length=500,
        description="S3 key for audio pronunciation file",
    )
    is_active: bool = Field(
        default=True,
        description="Whether this entry is active (soft delete flag)",
    )

    @field_validator("lemma", mode="before")
    @classmethod
    def strip_and_validate_lemma(cls, v: str) -> str:
        """Strip whitespace and validate non-empty lemma."""
        if isinstance(v, str):
            v = v.strip()
            if not v:
                raise ValueError("lemma cannot be empty or whitespace only")
        return v

    @field_validator("translation_ru", mode="before")
    @classmethod
    def strip_translation_ru(cls, v: str | None) -> str | None:
        """Strip whitespace from Russian translation if provided."""
        if v is None:
            return None
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return None
        return v


# ============================================================================
# WordEntry Create Schema
# ============================================================================


class WordEntryCreate(WordEntryBase):
    """Schema for creating a new WordEntry.

    All required fields must be provided. Inherits from WordEntryBase.
    Adds deck_id which is required for creation.
    """

    deck_id: UUID = Field(
        ...,
        description="UUID of the deck this word entry belongs to",
    )


# ============================================================================
# WordEntry Update Schema
# ============================================================================


class WordEntryUpdate(BaseModel):
    """Schema for updating a WordEntry (partial update).

    All fields are optional - only provided fields will be updated.
    At least one field must be provided.
    """

    lemma: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
        description="Dictionary form (base form) of the word in Greek",
    )
    part_of_speech: Optional[PartOfSpeech] = Field(
        default=None,
        description="Part of speech classification",
    )
    cefr_level: Optional[DeckLevel] = Field(
        default=None,
        description="CEFR level (A1-C2)",
    )
    translation_en: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=500,
        description="English translation(s)",
    )
    translation_ru: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Russian translation(s)",
    )
    pronunciation: Optional[str] = Field(
        default=None,
        max_length=200,
        description="IPA or phonetic pronunciation guide",
    )
    grammar_data: Optional[GrammarData] = Field(
        default=None,
        description="Part-of-speech specific grammar information (JSONB)",
    )
    examples: Optional[list[ExampleSentence]] = Field(
        default=None,
        description="Usage examples with translations",
    )
    audio_key: Optional[str] = Field(
        default=None,
        max_length=500,
        description="S3 key for audio pronunciation file",
    )
    is_active: Optional[bool] = Field(
        default=None,
        description="Whether this entry is active (soft delete flag)",
    )

    @field_validator("lemma", mode="before")
    @classmethod
    def strip_and_validate_lemma(cls, v: str | None) -> str | None:
        """Strip whitespace and validate non-empty lemma if provided."""
        if v is None:
            return None
        if isinstance(v, str):
            v = v.strip()
            if not v:
                raise ValueError("lemma cannot be empty or whitespace only")
        return v

    @model_validator(mode="after")
    def check_at_least_one_field(self) -> "WordEntryUpdate":
        """Ensure at least one field is provided for update."""
        values = self.model_dump(exclude_unset=True)
        if not values:
            raise ValueError("At least one field must be provided for update")
        return self


# ============================================================================
# WordEntry Response Schema
# ============================================================================


class WordEntryResponse(BaseModel):
    """Schema for WordEntry API response.

    Includes all fields plus id, deck_id, and timestamps.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    deck_id: UUID
    lemma: str
    part_of_speech: PartOfSpeech
    cefr_level: Optional[DeckLevel] = None
    translation_en: str
    translation_ru: Optional[str] = None
    pronunciation: Optional[str] = None
    grammar_data: Optional[dict[str, Any]] = None  # Raw dict for response
    examples: Optional[list[ExampleSentence]] = None
    audio_key: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ============================================================================
# WordEntry List Response Schema
# ============================================================================


class WordEntryListResponse(BaseModel):
    """Schema for paginated WordEntry list response."""

    total: int = Field(..., ge=0, description="Total number of matching entries")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Items per page")
    items: list[WordEntryResponse] = Field(
        default_factory=list,
        description="List of word entries for current page",
    )


# ============================================================================
# WordEntry Search Response Schema
# ============================================================================


class WordEntrySearchResponse(BaseModel):
    """Schema for WordEntry search results with query echo."""

    total: int = Field(..., ge=0, description="Total matching results")
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1, le=100)
    query: str = Field(..., description="Search query that was executed")
    part_of_speech_filter: Optional[PartOfSpeech] = Field(
        default=None,
        description="Part of speech filter applied",
    )
    items: list[WordEntryResponse]
