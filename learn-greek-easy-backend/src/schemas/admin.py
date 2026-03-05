"""Admin-related Pydantic schemas for API request/response validation.

This module contains schemas for:
- Admin dashboard statistics
- Content management operations
- Unified deck listing with search and pagination
- Culture question review

"""

from datetime import datetime
from typing import Any, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.db.models import DeckLevel
from src.schemas.nlp import DuplicateCheckResult

# ============================================================================
# Admin Stats Schemas
# ============================================================================


class AdminStatsResponse(BaseModel):
    """Response schema for admin dashboard statistics.

    Provides overview of content statistics including:
    - Total count of active decks (vocabulary + culture)
    - Total count of items (vocabulary cards + culture questions)
    - Breakdown by deck type
    """

    total_decks: int = Field(
        ..., ge=0, description="Total number of active decks (vocabulary + culture)"
    )
    total_cards: int = Field(
        ..., ge=0, description="Total number of items (vocabulary cards + culture questions)"
    )
    total_vocabulary_decks: int = Field(
        ..., ge=0, description="Total number of active vocabulary decks"
    )
    total_vocabulary_cards: int = Field(..., ge=0, description="Total vocabulary cards")
    total_culture_decks: int = Field(..., ge=0, description="Total number of active culture decks")
    total_culture_questions: int = Field(
        ..., ge=0, description="Total number of approved culture questions"
    )


# ============================================================================
# Admin Deck List Schemas
# ============================================================================


class UnifiedDeckItem(BaseModel):
    """Unified deck item for combined vocabulary and culture deck listing."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Deck UUID")
    name: str = Field(..., description="Deck name (English for display)")
    type: str = Field(..., description="Deck type: 'vocabulary' or 'culture'")
    level: Optional[DeckLevel] = Field(None, description="CEFR level (vocabulary decks only)")
    category: Optional[str] = Field(None, description="Category (culture decks only)")
    item_count: int = Field(..., ge=0, description="Number of cards/questions")
    is_active: bool = Field(..., description="Whether deck is active")
    is_premium: bool = Field(..., description="Whether deck requires premium subscription")
    card_system: Optional[str] = Field(
        None, description="Card system version (V1 or V2, vocabulary decks only)"
    )
    created_at: datetime = Field(..., description="Creation timestamp")
    owner_id: Optional[UUID] = Field(None, description="Owner user ID (None for system decks)")
    owner_name: Optional[str] = Field(
        None, description="Owner display name (None for system decks)"
    )
    # Trilingual fields for edit forms
    name_el: Optional[str] = Field(None, description="Greek deck name")
    name_en: Optional[str] = Field(None, description="English deck name")
    name_ru: Optional[str] = Field(None, description="Russian deck name")
    description_el: Optional[str] = Field(None, description="Greek description")
    description_en: Optional[str] = Field(None, description="English description")
    description_ru: Optional[str] = Field(None, description="Russian description")


class AdminDeckListResponse(BaseModel):
    """Response schema for paginated deck listing."""

    decks: List[UnifiedDeckItem] = Field(..., description="List of decks")
    total: int = Field(..., ge=0, description="Total number of matching decks")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Number of items per page")


# ============================================================================
# Culture Question Review Schemas
# ============================================================================


class ArticleCheckResponse(BaseModel):
    """Response schema for article usage check."""

    used: bool = Field(..., description="Whether article has been used")
    question_id: Optional[UUID] = Field(None, description="ID of existing question if used")


class PendingQuestionItem(BaseModel):
    """Single pending review question."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    question_text: dict[str, str]
    option_a: dict[str, str]
    option_b: dict[str, str]
    option_c: Optional[dict[str, str]] = None
    option_d: Optional[dict[str, str]] = None
    correct_option: int
    source_article_url: Optional[str] = None
    created_at: datetime


class PendingQuestionsResponse(BaseModel):
    """Response schema for listing pending questions."""

    questions: list[PendingQuestionItem]
    total: int
    page: int
    page_size: int


class QuestionApproveRequest(BaseModel):
    """Request schema for approving a pending question."""

    deck_id: UUID = Field(..., description="Target culture deck ID")


class QuestionApproveResponse(BaseModel):
    """Response schema for question approval."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    deck_id: UUID
    is_pending_review: bool = False
    message: str = "Question approved successfully"


# ============================================================================
# Admin Deck Questions Schemas
# ============================================================================


class AdminCultureQuestionItem(BaseModel):
    """Culture question item for admin deck detail view."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    question_text: dict[str, str]
    option_a: dict[str, str]
    option_b: dict[str, str]
    option_c: Optional[dict[str, str]] = None
    option_d: Optional[dict[str, str]] = None
    correct_option: int
    source_article_url: Optional[str] = None
    is_pending_review: bool = False
    created_at: datetime


class AdminCultureQuestionsResponse(BaseModel):
    """Response schema for listing culture questions in a deck."""

    questions: list[AdminCultureQuestionItem]
    total: int
    page: int
    page_size: int
    deck_id: UUID


# ============================================================================
# Word Entry Inline Update Schemas
# ============================================================================


class ExampleSentenceUpdate(BaseModel):
    """Example sentence for inline word entry update.

    Requires id + greek (minimum). System fields (audio_key, audio_status)
    are preserved from existing data during merge.
    """

    id: str = Field(..., min_length=1, max_length=50)
    greek: str = Field(..., min_length=1, max_length=1000)
    english: Optional[str] = Field(default=None, max_length=1000)
    russian: Optional[str] = Field(default=None, max_length=1000)
    context: Optional[str] = Field(default=None, max_length=200)


class WordEntryInlineUpdate(BaseModel):
    """Schema for admin inline word entry update (PATCH).

    Only exposes fields that are safe to edit inline.
    Explicitly excludes: lemma, part_of_speech, is_active,
    audio_key, audio_status.
    """

    translation_en: Optional[str] = Field(default=None, min_length=1, max_length=500)
    translation_en_plural: Optional[str] = Field(default=None, max_length=500)
    translation_ru: Optional[str] = Field(default=None, max_length=500)
    translation_ru_plural: Optional[str] = Field(default=None, max_length=500)
    pronunciation: Optional[str] = Field(default=None, max_length=200)
    grammar_data: Optional[dict[str, Any]] = Field(default=None)
    examples: Optional[list[ExampleSentenceUpdate]] = None

    @model_validator(mode="after")
    def check_at_least_one_field(self) -> "WordEntryInlineUpdate":
        if not self.model_dump(exclude_unset=True):
            raise ValueError("At least one field must be provided")
        return self


class GenerateWordEntryAudioRequest(BaseModel):
    """Request schema for generating audio for a specific part of a word entry."""

    part: Literal["lemma", "example"] = Field(
        ..., description="Which part to generate audio for: 'lemma' or 'example'"
    )
    example_id: Optional[str] = Field(
        default=None,
        description="UUID of the example sentence. Required when part='example'.",
    )

    @model_validator(mode="after")
    def validate_example_id(self) -> "GenerateWordEntryAudioRequest":
        if self.part == "example" and not self.example_id:
            raise ValueError("example_id is required when part is 'example'")
        return self


class GenerateCardsRequest(BaseModel):
    """Request schema for generating flashcards from a word entry."""

    card_type: Literal["meaning", "plural_form", "article", "sentence_translation"] = Field(
        ..., description="Type of flashcard to generate"
    )


class GenerateCardsResponse(BaseModel):
    """Response schema for card generation results."""

    card_type: str = Field(..., description="Type of card that was generated")
    created: int = Field(..., ge=0, description="Number of new cards created")
    updated: int = Field(..., ge=0, description="Number of existing cards updated")


# ============================================================================
# Word Entry Generation Pipeline Schemas
# ============================================================================


class GenerateWordEntryRequest(BaseModel):
    """Request to run the noun generation pipeline (progressive stages)."""

    word: str = Field(..., min_length=1, max_length=50, description="Greek word (any form)")
    deck_id: UUID = Field(..., description="Target V2 vocabulary deck UUID")


class NormalizationStageResult(BaseModel):
    """Normalization result with confidence tier for frontend display."""

    input_word: str = Field(..., description="Original word submitted")
    lemma: str = Field(..., description="Normalized lemma (dictionary form)")
    gender: str | None = Field(None, description='Gender: "masculine"/"feminine"/"neuter"/None')
    article: str | None = Field(None, description='Article: "ο"/"η"/"το"/None')
    pos: str = Field(..., description="Universal POS tag (NOUN, VERB, ADJ, etc.)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score 0.0-1.0")
    confidence_tier: Literal["high", "medium", "low"] = Field(
        ..., description="Display tier derived from confidence score"
    )
    strategy: str | None = Field(
        None,
        description='Normalization strategy used: "lexicon", "direct", "spellcheck", or "article_prefix"',
    )
    corrected_from: str | None = Field(
        None, description="Original misspelled form if spellcheck corrected the input"
    )
    corrected_to: str | None = Field(
        None, description="Spellcheck-corrected form (before lemmatization), null if no correction"
    )


class SuggestionItem(BaseModel):
    """Alternative normalization suggestion for the frontend to display."""

    lemma: str = Field(..., description="Suggested lemma (dictionary form)")
    pos: str = Field(..., description="Universal POS tag")
    gender: str | None = Field(None, description="Gender if detected")
    article: str | None = Field(None, description="Article if detected")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score")
    confidence_tier: Literal["high", "medium", "low"] = Field(..., description="Display tier")
    strategy: str = Field(
        ..., description='Strategy: "lexicon", "direct", "spellcheck", or "article_prefix"'
    )


class GenerateWordEntryResponse(BaseModel):
    """Progressive response envelope for the noun generation pipeline."""

    stage: str = Field(..., description="Last completed pipeline stage")
    normalization: NormalizationStageResult | None = None
    suggestions: list[SuggestionItem] = Field(
        default_factory=list,
        description="Alternative normalization suggestions (max 3, confidence >= 0.40)",
    )
    duplicate_check: DuplicateCheckResult | None = None
    generation: None = None  # NGEN-08-04
    local_verification: None = None  # NGEN-08-05
    cross_verification: None = None  # NGEN-08-05
    persist: None = None  # NGEN-08-06
