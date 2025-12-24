"""Admin-related Pydantic schemas for API request/response validation.

This module contains schemas for:
- Admin dashboard statistics
- Content management operations

"""

from typing import List
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from src.db.models import DeckLevel

# ============================================================================
# Admin Stats Schemas
# ============================================================================


class DeckStatsItem(BaseModel):
    """Statistics for a single deck."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Deck UUID")
    name: str = Field(..., description="Deck name")
    level: DeckLevel = Field(..., description="CEFR level (A1-C2)")
    card_count: int = Field(..., ge=0, description="Number of cards in deck")


class AdminStatsResponse(BaseModel):
    """Response schema for admin dashboard statistics.

    Provides overview of content statistics including:
    - Total count of active decks
    - Total count of cards across all active decks
    - Per-deck breakdown with card counts
    """

    total_decks: int = Field(..., ge=0, description="Total number of active decks")
    total_cards: int = Field(..., ge=0, description="Total number of cards in all decks")
    decks: List[DeckStatsItem] = Field(
        ...,
        description="List of deck statistics sorted by level",
    )
