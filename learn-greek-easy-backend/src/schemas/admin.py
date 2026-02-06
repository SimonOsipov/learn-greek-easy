"""Admin-related Pydantic schemas for API request/response validation.

This module contains schemas for:
- Admin dashboard statistics
- Content management operations
- Unified deck listing with search and pagination
- Culture question review

"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from src.db.models import DeckLevel

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
