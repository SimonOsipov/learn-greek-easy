"""Deck-related Pydantic schemas for API request/response validation.

This module contains schemas for:
- Deck management (CRUD operations)
- Deck progress tracking
- Paginated deck listings
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from src.db.models import DeckLevel

# ============================================================================
# Deck Schemas
# ============================================================================


class DeckBase(BaseModel):
    """Base deck schema with common fields."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    level: DeckLevel


class DeckCreate(DeckBase):
    """Schema for creating a new deck.

    Any authenticated user can create a deck:
    - Regular users: The endpoint automatically sets owner_id=current_user.id,
      is_active=True, is_premium=False. User-created decks appear in /mine.
    - Superusers: By default, create personal decks (owner_id=current_user.id).
      Set is_system_deck=True to create system decks (owner_id=None).

    The is_system_deck flag explicitly controls whether the deck is a system
    deck (visible to all users in /decks) or a personal deck (visible only
    to the creator in /mine).
    """

    is_system_deck: bool = False


class DeckUpdate(BaseModel):
    """Schema for updating a deck (admin only)."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    level: Optional[DeckLevel] = None
    is_active: Optional[bool] = None
    is_premium: Optional[bool] = None


class DeckResponse(DeckBase):
    """Schema for deck response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    is_active: bool
    is_premium: bool
    card_count: int = Field(0, ge=0, description="Number of cards in the deck")
    created_at: datetime
    updated_at: datetime


class DeckDetailResponse(DeckResponse):
    """Schema for single deck response with card count."""

    card_count: int = Field(..., ge=0, description="Number of cards in the deck")


class DeckWithProgressResponse(DeckResponse):
    """Schema for deck with user progress."""

    progress: Optional["UserDeckProgressResponse"] = None


class DeckListResponse(BaseModel):
    """Schema for paginated deck list."""

    total: int
    page: int
    page_size: int
    decks: list[DeckResponse]


class DeckSearchResponse(BaseModel):
    """Schema for deck search results with query echo."""

    total: int
    page: int
    page_size: int
    query: str = Field(..., description="The search query that was used")
    decks: list[DeckResponse]


# Import at the end to avoid circular dependencies
from src.schemas.progress import UserDeckProgressResponse  # noqa: E402

# Update forward references
DeckWithProgressResponse.model_rebuild()
