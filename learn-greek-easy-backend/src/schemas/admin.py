"""Admin-related Pydantic schemas for API request/response validation.

This module contains schemas for:
- Admin dashboard statistics
- Content management operations
- Unified deck listing with search and pagination

"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from src.db.models import DeckLevel

# ============================================================================
# Admin Stats Schemas
# ============================================================================


class DeckStatsItem(BaseModel):
    """Statistics for a single vocabulary deck."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Deck UUID")
    name: str = Field(..., description="Deck name")
    level: DeckLevel = Field(..., description="CEFR level (A1-C2)")
    card_count: int = Field(..., ge=0, description="Number of cards in deck")


class CultureDeckStatsItem(BaseModel):
    """Statistics for a single culture deck."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Culture deck UUID")
    name: str = Field(..., description="Deck name")
    category: str = Field(..., description="Deck category (history, geography, etc.)")
    question_count: int = Field(..., ge=0, description="Number of questions in deck")


class AdminStatsResponse(BaseModel):
    """Response schema for admin dashboard statistics.

    Provides overview of content statistics including:
    - Total count of active decks (vocabulary + culture)
    - Total count of items across all active decks (cards + questions)
    - Per-deck breakdown with counts
    """

    total_decks: int = Field(
        ..., ge=0, description="Total number of active decks (vocabulary + culture)"
    )
    total_cards: int = Field(..., ge=0, description="Total number of items (cards + questions)")
    total_vocabulary_decks: int = Field(
        ..., ge=0, description="Total number of active vocabulary decks"
    )
    total_culture_decks: int = Field(..., ge=0, description="Total number of active culture decks")
    total_vocabulary_cards: int = Field(..., ge=0, description="Total vocabulary cards")
    total_culture_questions: int = Field(..., ge=0, description="Total culture questions")
    decks: List[DeckStatsItem] = Field(
        ...,
        description="List of vocabulary deck statistics sorted by level",
    )
    culture_decks: List[CultureDeckStatsItem] = Field(
        ...,
        description="List of culture deck statistics sorted by category",
    )


# ============================================================================
# Admin Deck List Schemas
# ============================================================================


class UnifiedDeckItem(BaseModel):
    """Unified deck item for combined vocabulary and culture deck listing."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Deck UUID")
    name: str = Field(..., description="Deck name")
    type: str = Field(..., description="Deck type: 'vocabulary' or 'culture'")
    level: Optional[DeckLevel] = Field(None, description="CEFR level (vocabulary decks only)")
    category: Optional[str] = Field(None, description="Category (culture decks only)")
    item_count: int = Field(..., ge=0, description="Number of cards/questions")
    is_active: bool = Field(..., description="Whether deck is active")
    created_at: datetime = Field(..., description="Creation timestamp")


class AdminDeckListResponse(BaseModel):
    """Response schema for paginated deck listing."""

    decks: List[UnifiedDeckItem] = Field(..., description="List of decks")
    total: int = Field(..., ge=0, description="Total number of matching decks")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Number of items per page")
