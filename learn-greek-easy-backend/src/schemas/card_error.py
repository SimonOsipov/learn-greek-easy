"""Card error report Pydantic schemas for API request/response validation.

This module contains schemas for:
- Card error report creation (user-facing)
- Card error report responses (user and admin)
- Admin operations (status updates, pagination)
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.db.models import CardErrorCardType, CardErrorStatus

# ============================================================================
# Card and Deck Snapshot Schemas (CER-43)
# ============================================================================


class CardErrorCardSnapshot(BaseModel):
    """Polymorphic card content snapshot for an admin error report.

    All fields are optional. WORD reports populate the word-* fields
    (word, gender, translation_en, translation_ru, ipa, article, plural).
    CULTURE reports populate the question-* fields (question_en, question_el,
    options, correct_index, level). Both sets are null when the underlying
    card has been hard-deleted.
    """

    # WORD variant (from WordEntry model)
    word: Optional[str] = None  # WordEntry.lemma
    article: Optional[str] = None  # from grammar_data, if present
    gender: Optional[str] = None  # WordEntry.gender
    translation_en: Optional[str] = None  # WordEntry.translation_en
    translation_ru: Optional[str] = None  # WordEntry.translation_ru
    plural: Optional[str] = None  # from grammar_data, if present
    ipa: Optional[str] = None  # WordEntry.pronunciation

    # CULTURE variant (from CultureQuestion model)
    question_en: Optional[str] = None  # CultureQuestion.question_text['en']
    question_el: Optional[str] = None  # CultureQuestion.question_text['el']
    options: Optional[list[str]] = None  # English option texts [a, b, c?, d?]
    correct_index: Optional[int] = None  # correct_option - 1 (0-indexed)
    level: Optional[str] = None  # deck level, if available


class CardErrorDeckSnapshot(BaseModel):
    """Deck context snapshot for an admin error report."""

    id: UUID
    name: str  # Deck name_en (vocab) or CultureDeck name_en (culture)
    level: Optional[str] = None  # DeckLevel value, if applicable


# ============================================================================
# Reporter Schema (Brief User Info)
# ============================================================================


class ReporterBriefResponse(BaseModel):
    """Brief reporter information for error report items."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: Optional[str] = None


# ============================================================================
# Card Error Report Schemas
# ============================================================================


class CardErrorReportCreate(BaseModel):
    """Schema for creating a new card error report.

    Users submit this when reporting an error on a flashcard or culture question.
    """

    card_id: UUID = Field(
        ...,
        description="ID of the card being reported",
    )
    card_type: CardErrorCardType = Field(
        ...,
        description="Type of card: WORD or CULTURE",
    )
    description: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Description of the error (1-1000 chars)",
    )

    @field_validator("description")
    @classmethod
    def strip_description(cls, v: str) -> str:
        """Strip whitespace from description."""
        return v.strip()


class CardErrorReportResponse(BaseModel):
    """Schema for card error report response (user-facing)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    card_id: UUID
    card_type: CardErrorCardType
    description: str
    status: CardErrorStatus
    admin_notes: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class CardErrorReportListResponse(BaseModel):
    """Schema for paginated card error report list (user's own reports)."""

    total: int = Field(..., ge=0)
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1, le=100)
    items: list[CardErrorReportResponse]


# ============================================================================
# Admin Schemas
# ============================================================================


class AdminCardErrorReportUpdate(BaseModel):
    """Schema for admin updating a card error report."""

    status: Optional[CardErrorStatus] = None
    admin_notes: Optional[str] = Field(
        None,
        max_length=1000,
        description="Admin notes about the resolution (max 1000 chars)",
    )

    @field_validator("admin_notes")
    @classmethod
    def strip_admin_notes(cls, v: Optional[str]) -> Optional[str]:
        """Strip whitespace and convert empty strings to None."""
        if v is None:
            return None
        stripped = v.strip()
        return stripped if stripped else None


class AdminCardErrorReportResponse(BaseModel):
    """Schema for admin card error report response with full details."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    card_id: UUID
    card_type: CardErrorCardType
    user_id: UUID
    description: str
    status: CardErrorStatus
    admin_notes: Optional[str] = None
    resolved_by: Optional[UUID] = None
    resolved_at: Optional[datetime] = None
    reporter: ReporterBriefResponse
    # CER-44: resolver brief (populated when resolved_by is set)
    resolver: Optional[ReporterBriefResponse] = None
    # CER-43: polymorphic card content + deck context
    card: Optional[CardErrorCardSnapshot] = None
    deck: Optional[CardErrorDeckSnapshot] = None
    created_at: datetime
    updated_at: datetime


class AdminCardErrorReportListResponse(BaseModel):
    """Schema for paginated admin card error report list."""

    total: int = Field(..., ge=0)
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1, le=1000)
    items: list[AdminCardErrorReportResponse]
