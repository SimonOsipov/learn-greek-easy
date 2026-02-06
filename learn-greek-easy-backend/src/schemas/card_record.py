"""CardRecord-related Pydantic schemas for API request/response validation.

This module contains schemas for:
- Context sub-schemas (ExampleContext, ConjugationRow/Table, DeclensionRow/Table, FullSentence)
- Front content schemas (6 card types with discriminated union)
- Back content schemas (6 card types with discriminated union)
- CardRecord CRUD operations (Create, Update, Response, ListResponse)
"""

from datetime import datetime
from typing import Annotated, Literal, Optional, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.db.models import CardType

# ============================================================================
# Context Sub-Schemas
# ============================================================================


class ExampleContext(BaseModel):
    """Context for an example sentence used in card back content."""

    label: str
    greek: str
    english: str
    tense: Optional[str] = None


class ConjugationRow(BaseModel):
    """Single row in a conjugation table."""

    person: str
    form: str
    highlight: bool


class ConjugationTable(BaseModel):
    """Conjugation table for verb cards."""

    tense: str
    rows: list[ConjugationRow]


class DeclensionRow(BaseModel):
    """Single row in a declension table."""

    case: str
    singular: str
    plural: str
    highlight_singular: bool
    highlight_plural: bool


class DeclensionTable(BaseModel):
    """Declension table for noun/adjective cards."""

    gender: str
    rows: list[DeclensionRow]


class FullSentence(BaseModel):
    """Full sentence pair for cloze card back content."""

    greek: str
    english: str


# ============================================================================
# Front Content Schemas
# ============================================================================


class FrontContentBase(BaseModel):
    """Base schema for card front content."""

    prompt: str
    main: str
    sub: Optional[str] = None
    badge: str
    hint: Optional[str] = None


class MeaningElToEnFront(FrontContentBase):
    """Front content for meaning (Greek to English) cards."""

    card_type: Literal["meaning_el_to_en"]


class MeaningEnToElFront(FrontContentBase):
    """Front content for meaning (English to Greek) cards."""

    card_type: Literal["meaning_en_to_el"]


class ConjugationFront(FrontContentBase):
    """Front content for conjugation cards."""

    card_type: Literal["conjugation"]
    tense: str
    person: str = Field(..., pattern=r"^[123][sp]$")


class DeclensionFront(FrontContentBase):
    """Front content for declension cards."""

    card_type: Literal["declension"]
    case: str
    number: Literal["singular", "plural"]


class ClozeFront(FrontContentBase):
    """Front content for cloze cards."""

    card_type: Literal["cloze"]
    missing_word: str
    example_index: int = Field(..., ge=0)


class SentenceTranslationFront(FrontContentBase):
    """Front content for sentence translation cards."""

    card_type: Literal["sentence_translation"]
    example_index: int = Field(..., ge=0)


FrontContent = Annotated[
    Union[
        MeaningElToEnFront,
        MeaningEnToElFront,
        ConjugationFront,
        DeclensionFront,
        ClozeFront,
        SentenceTranslationFront,
    ],
    Field(discriminator="card_type"),
]

# ============================================================================
# Back Content Schemas
# ============================================================================


class BackContentBase(BaseModel):
    """Base schema for card back content."""

    answer: str
    answer_sub: Optional[str] = None


class MeaningElToEnBack(BackContentBase):
    """Back content for meaning (Greek to English) cards."""

    card_type: Literal["meaning_el_to_en"]
    context: Optional[ExampleContext] = None


class MeaningEnToElBack(BackContentBase):
    """Back content for meaning (English to Greek) cards."""

    card_type: Literal["meaning_en_to_el"]
    context: Optional[ExampleContext] = None


class ConjugationBack(BackContentBase):
    """Back content for conjugation cards."""

    card_type: Literal["conjugation"]
    conjugation_table: ConjugationTable


class DeclensionBack(BackContentBase):
    """Back content for declension cards."""

    card_type: Literal["declension"]
    declension_table: DeclensionTable


class ClozeBack(BackContentBase):
    """Back content for cloze cards."""

    card_type: Literal["cloze"]
    full_sentence: FullSentence


class SentenceTranslationBack(BackContentBase):
    """Back content for sentence translation cards."""

    card_type: Literal["sentence_translation"]
    context: Optional[ExampleContext] = None


BackContent = Annotated[
    Union[
        MeaningElToEnBack,
        MeaningEnToElBack,
        ConjugationBack,
        DeclensionBack,
        ClozeBack,
        SentenceTranslationBack,
    ],
    Field(discriminator="card_type"),
]

# ============================================================================
# CardRecord Create Schema
# ============================================================================


class CardRecordCreate(BaseModel):
    """Schema for creating a new CardRecord."""

    word_entry_id: UUID = Field(
        ...,
        description="UUID of the word entry this card is generated from",
    )
    deck_id: UUID = Field(
        ...,
        description="UUID of the deck this card belongs to",
    )
    card_type: CardType = Field(
        ...,
        description="Type of flashcard exercise",
    )
    tier: Optional[int] = Field(
        default=None,
        ge=1,
        description="Difficulty tier (1 = easiest)",
    )
    front_content: FrontContent = Field(
        ...,
        description="Card front content (discriminated by card_type)",
    )
    back_content: BackContent = Field(
        ...,
        description="Card back content (discriminated by card_type)",
    )
    is_active: bool = Field(
        default=True,
        description="Whether this card is active",
    )


# ============================================================================
# CardRecord Update Schema
# ============================================================================


class CardRecordUpdate(BaseModel):
    """Schema for updating a CardRecord (partial update).

    All fields are optional - only provided fields will be updated.
    At least one field must be provided.
    """

    card_type: Optional[CardType] = None
    tier: Optional[int] = Field(default=None, ge=1)
    front_content: Optional[FrontContent] = None
    back_content: Optional[BackContent] = None
    is_active: Optional[bool] = None

    @model_validator(mode="after")
    def check_at_least_one_field(self) -> "CardRecordUpdate":
        """Ensure at least one field is provided for update."""
        values = self.model_dump(exclude_unset=True)
        if not values:
            raise ValueError("At least one field must be provided for update")
        return self


# ============================================================================
# CardRecord Response Schema
# ============================================================================


class CardRecordResponse(BaseModel):
    """Schema for CardRecord API response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    word_entry_id: UUID
    deck_id: UUID
    card_type: CardType
    tier: Optional[int] = None
    front_content: dict = Field(
        ...,
        description="Card front content as raw dict",
    )
    back_content: dict = Field(
        ...,
        description="Card back content as raw dict",
    )
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ============================================================================
# CardRecord List Response Schema
# ============================================================================


class CardRecordListResponse(BaseModel):
    """Schema for paginated CardRecord list response."""

    total: int = Field(..., ge=0, description="Total number of matching records")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Items per page")
    items: list[CardRecordResponse] = Field(
        default_factory=list,
        description="List of card records for current page",
    )
