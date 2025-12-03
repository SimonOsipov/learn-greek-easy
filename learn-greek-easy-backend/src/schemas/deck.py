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
    """Schema for creating a new deck (admin only)."""

    pass


class DeckUpdate(BaseModel):
    """Schema for updating a deck (admin only)."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    level: Optional[DeckLevel] = None
    is_active: Optional[bool] = None


class DeckResponse(DeckBase):
    """Schema for deck response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime


class DeckWithProgressResponse(DeckResponse):
    """Schema for deck with user progress."""

    progress: Optional["UserDeckProgressResponse"] = None


class DeckListResponse(BaseModel):
    """Schema for paginated deck list."""

    total: int
    page: int
    page_size: int
    decks: list[DeckResponse]


# Import at the end to avoid circular dependencies
from src.schemas.progress import UserDeckProgressResponse  # noqa: E402

# Update forward references
DeckWithProgressResponse.model_rebuild()
