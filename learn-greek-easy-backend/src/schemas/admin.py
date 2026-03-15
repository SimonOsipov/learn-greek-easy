"""Admin-related Pydantic schemas for API request/response validation.

This module contains schemas for:
- Admin dashboard statistics
- Content management operations
- Unified deck listing with search and pagination
- Culture question review

"""

from datetime import datetime
from typing import Any, ClassVar, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.db.models import DeckLevel, DialogStatus
from src.schemas.exercise_payload import ExercisesPayload
from src.schemas.nlp import DuplicateCheckResult, GeneratedNounData, VerificationSummary

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
    audio_s3_key: Optional[str] = None
    news_item_id: Optional[UUID] = None
    original_article_url: Optional[str] = None
    order_index: int = 0
    news_item_audio_a2_s3_key: Optional[str] = None
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


class GenerateCardsRequest(BaseModel):
    """Request schema for generating flashcards from a word entry."""

    card_type: Literal[
        "meaning", "plural_form", "article", "sentence_translation", "declension"
    ] = Field(..., description="Type of flashcard to generate")


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
    # Optional fields for from_stage=generation (suggestion swap)
    lemma: str | None = Field(None, description="Pre-resolved lemma for partial re-generation")
    gender: str | None = Field(None, description="Pre-resolved gender")
    article: str | None = Field(None, description="Pre-resolved article")
    translation_lookup: "TranslationLookupStageResult | None" = Field(
        None, description="Cached translation data"
    )


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


class TranslationSourceInfo(BaseModel):
    """Translation data from a single language lookup."""

    translations: list[str] = Field(..., description="Individual translation strings")
    combined_text: str = Field(..., description="Comma-joined translation text for LLM prompt")
    source: Literal["dictionary", "pivot", "none"] = Field(
        ..., description="Where translations came from"
    )
    sense_count: int = Field(..., ge=0, description="Number of dictionary senses found")


class TranslationLookupStageResult(BaseModel):
    """Stage 2.5 result: bilingual translation lookup."""

    en: TranslationSourceInfo | None = None
    ru: TranslationSourceInfo | None = None


class GenerateWordEntryResponse(BaseModel):
    """Progressive response envelope for the noun generation pipeline."""

    stage: str = Field(..., description="Last completed pipeline stage")
    normalization: NormalizationStageResult | None = None
    suggestions: list[SuggestionItem] = Field(
        default_factory=list,
        description="Alternative normalization suggestions (max 3, confidence >= 0.40)",
    )
    duplicate_check: DuplicateCheckResult | None = None
    translation_lookup: TranslationLookupStageResult | None = None
    generation: GeneratedNounData | None = None  # NGEN-08-04
    verification: VerificationSummary | None = None  # VRES-01
    persist: None = None  # NGEN-08-06


# Resolve forward references (GenerateWordEntryRequest references TranslationLookupStageResult)
GenerateWordEntryRequest.model_rebuild()


# ========================
# Listening Dialog Admin Schemas
# ========================


class ListeningDialogListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    scenario_el: str
    scenario_en: str
    scenario_ru: str
    cefr_level: DeckLevel
    num_speakers: int
    status: DialogStatus
    audio_duration_seconds: float | None = None
    created_at: datetime


class ListeningDialogListResponse(BaseModel):
    items: list[ListeningDialogListItem]
    total: int
    page: int
    page_size: int


class DialogSpeakerCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    speaker_index: int = Field(ge=0, lt=4)
    character_name: str = Field(min_length=1, max_length=100)
    voice_id: str = Field(min_length=1, max_length=255)


class DialogLineCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    speaker_index: int = Field(ge=0, lt=4)
    text: str = Field(min_length=1, max_length=1000)


class ListeningDialogCreateFromJSON(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    scenario_el: str = Field(min_length=1, max_length=500)
    scenario_en: str = Field(min_length=1, max_length=500)
    scenario_ru: str = Field(min_length=1, max_length=500)
    cefr_level: DeckLevel
    speakers: list[DialogSpeakerCreate] = Field(min_length=2, max_length=4)
    lines: list[DialogLineCreate] = Field(min_length=1, max_length=50)
    exercises: ExercisesPayload | None = None

    ALLOWED_CEFR_LEVELS: ClassVar[set[DeckLevel]] = {
        DeckLevel.A1,
        DeckLevel.A2,
        DeckLevel.B1,
        DeckLevel.B2,
    }

    @model_validator(mode="after")
    def validate_cefr_level(self) -> "ListeningDialogCreateFromJSON":
        if self.cefr_level not in self.ALLOWED_CEFR_LEVELS:
            raise ValueError(
                f"cefr_level must be one of {sorted(lv.value for lv in self.ALLOWED_CEFR_LEVELS)}, got {self.cefr_level.value}"
            )
        return self

    @model_validator(mode="after")
    def validate_speaker_indices(self) -> "ListeningDialogCreateFromJSON":
        indices = [s.speaker_index for s in self.speakers]
        expected = list(range(len(self.speakers)))
        if sorted(indices) != expected:
            raise ValueError(f"speaker_index values must be sequential 0-based: got {indices}")
        return self

    @model_validator(mode="after")
    def validate_line_speaker_refs(self) -> "ListeningDialogCreateFromJSON":
        valid_indices = {s.speaker_index for s in self.speakers}
        for i, line in enumerate(self.lines):
            if line.speaker_index not in valid_indices:
                raise ValueError(
                    f"lines[{i}].speaker_index {line.speaker_index} does not reference a defined speaker"
                )
        return self

    @model_validator(mode="after")
    def validate_exercise_line_indices(self) -> "ListeningDialogCreateFromJSON":
        if self.exercises is None:
            return self
        line_count = len(self.lines)
        for i, item in enumerate(self.exercises.fill_gaps):
            if item.line_index >= line_count:
                raise ValueError(
                    f"exercises.fill_gaps[{i}].line_index {item.line_index} is out of range (dialog has {line_count} lines)"
                )
        return self


class DialogSpeakerDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    speaker_index: int
    character_name: str
    voice_id: str


class WordTimestamp(BaseModel):
    word: str
    start_ms: int
    end_ms: int


class DialogLineDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    line_index: int
    speaker_id: UUID
    text: str
    start_time_ms: int | None
    end_time_ms: int | None
    word_timestamps: list[WordTimestamp] | None = None


class ListeningDialogDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    scenario_el: str
    scenario_en: str
    scenario_ru: str
    cefr_level: DeckLevel
    num_speakers: int
    status: DialogStatus
    created_at: datetime
    audio_url: str | None = None
    audio_duration_seconds: float | None = None
    audio_generated_at: datetime | None = None
    audio_file_size_bytes: int | None = None
    speakers: list[DialogSpeakerDetail]
    lines: list[DialogLineDetail]


# ============================================================================
# Reverse Lookup
# ============================================================================


class ReverseLookupItem(BaseModel):
    """A single reverse lookup result."""

    lemma: str
    pos: str
    gender: str | None = None
    article: str | None = None
    translations: list[str]
    actionable: bool
    match_type: str
    score: float
    inferred_gender: bool = False


class ReverseLookupResponse(BaseModel):
    """Response for reverse translation lookup."""

    query: str
    language: str
    results: list[ReverseLookupItem]
