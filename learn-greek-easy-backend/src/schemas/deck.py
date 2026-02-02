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


class DeckResponse(BaseModel):
    """Schema for deck response (localized based on user preference).

    Returns single name/description in the user's preferred language.
    Language selection happens in the service layer.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID

    # Single localized fields (populated by service based on user language)
    name: str
    description: str | None = None

    # Common fields
    level: DeckLevel
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


# ============================================================================
# Admin Schemas (All languages)
# ============================================================================


class DeckAdminCreate(BaseModel):
    """Schema for creating a localized deck (admin only).

    Admin creates system decks with trilingual name/description.
    All language fields are required for system decks.
    """

    # Trilingual name fields (all required for system decks)
    name_el: str = Field(..., min_length=1, max_length=255, description="Greek name")
    name_en: str = Field(..., min_length=1, max_length=255, description="English name")
    name_ru: str = Field(..., min_length=1, max_length=255, description="Russian name")

    # Trilingual description fields (optional)
    description_el: str | None = Field(None, max_length=2000, description="Greek description")
    description_en: str | None = Field(None, max_length=2000, description="English description")
    description_ru: str | None = Field(None, max_length=2000, description="Russian description")

    # Common fields
    level: DeckLevel
    is_active: bool = True
    is_premium: bool = False


class DeckAdminUpdate(BaseModel):
    """Schema for updating a localized deck (admin only).

    All fields optional for partial updates.
    """

    # Trilingual name fields (optional for partial update)
    name_el: str | None = Field(None, min_length=1, max_length=255)
    name_en: str | None = Field(None, min_length=1, max_length=255)
    name_ru: str | None = Field(None, min_length=1, max_length=255)

    # Trilingual description fields
    description_el: str | None = Field(None, max_length=2000)
    description_en: str | None = Field(None, max_length=2000)
    description_ru: str | None = Field(None, max_length=2000)

    # Common fields
    level: DeckLevel | None = None
    is_active: bool | None = None
    is_premium: bool | None = None


class DeckAdminResponse(BaseModel):
    """Schema for deck response in admin API (all languages)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID

    # All language fields visible to admin
    name_el: str
    name_en: str
    name_ru: str
    description_el: str | None
    description_en: str | None
    description_ru: str | None

    # Common fields
    level: DeckLevel
    is_active: bool
    is_premium: bool
    card_count: int = Field(0, ge=0, description="Number of cards in the deck")
    owner_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class DeckAdminListResponse(BaseModel):
    """Paginated list of decks for admin API."""

    total: int
    page: int
    page_size: int
    decks: list[DeckAdminResponse]


# Import at the end to avoid circular dependencies
from src.schemas.progress import UserDeckProgressResponse  # noqa: E402

# Update forward references
DeckWithProgressResponse.model_rebuild()
