"""Admin-related Pydantic schemas for API request/response validation.

This module contains schemas for:
- Admin dashboard statistics
- Content management operations
- Unified deck listing with search and pagination

"""

from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator

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
    is_premium: bool = Field(..., description="Whether deck requires premium subscription")
    created_at: datetime = Field(..., description="Creation timestamp")


class AdminDeckListResponse(BaseModel):
    """Response schema for paginated deck listing."""

    decks: List[UnifiedDeckItem] = Field(..., description="List of decks")
    total: int = Field(..., ge=0, description="Total number of matching decks")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Number of items per page")


# ============================================================================
# News Source Schemas
# ============================================================================


class NewsSourceCreate(BaseModel):
    """Request schema for creating a news source."""

    name: str = Field(..., min_length=1, max_length=255, description="Display name")
    url: HttpUrl = Field(..., description="Base URL (must be unique)")
    is_active: bool = Field(default=True, description="Whether source is active")


class NewsSourceUpdate(BaseModel):
    """Request schema for updating a news source."""

    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Display name")
    url: Optional[HttpUrl] = Field(None, description="Base URL (must be unique)")
    is_active: Optional[bool] = Field(None, description="Whether source is active")


class NewsSourceResponse(BaseModel):
    """Response schema for a news source."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Source UUID")
    name: str = Field(..., description="Display name")
    url: str = Field(..., description="Base URL")
    is_active: bool = Field(..., description="Whether source is active")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


class NewsSourceListResponse(BaseModel):
    """Response schema for paginated news source listing."""

    sources: list[NewsSourceResponse] = Field(..., description="List of sources")
    total: int = Field(..., ge=0, description="Total number of sources")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Items per page")


# ============================================================================
# Source Fetch History Schemas
# ============================================================================


class DiscoveredArticle(BaseModel):
    """Schema for an article discovered by AI analysis."""

    url: str = Field(..., description="URL of the discovered article")
    title: str = Field(..., description="Title/headline of the article")
    reasoning: str = Field(..., description="AI's reasoning for including this article")


class SourceFetchHistoryItem(BaseModel):
    """Fetch history item (without HTML content)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="History entry UUID")
    fetched_at: datetime = Field(..., description="When fetch occurred")
    status: str = Field(..., description="'success' or 'error'")
    html_size_bytes: Optional[int] = Field(None, description="Size of HTML content")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    trigger_type: str = Field(..., description="'manual' or 'scheduled'")
    final_url: Optional[str] = Field(None, description="Final URL after redirects")
    # AI Analysis fields
    analysis_status: Optional[str] = Field(
        None, description="Analysis status: pending, completed, failed"
    )
    analysis_error: Optional[str] = Field(None, description="Error message if analysis failed")
    analysis_tokens_used: Optional[int] = Field(
        None, description="Number of tokens used for analysis"
    )
    analyzed_at: Optional[datetime] = Field(None, description="When analysis completed")


class SourceFetchHistoryListResponse(BaseModel):
    """Response for fetch history list."""

    items: list[SourceFetchHistoryItem] = Field(..., description="History entries")
    total: int = Field(..., ge=0, description="Total count")


class SourceFetchHistoryDetailResponse(BaseModel):
    """Detailed response for a fetch history entry including discovered articles."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="History entry UUID")
    source_id: UUID = Field(..., description="Source UUID")
    fetched_at: datetime = Field(..., description="When fetch occurred")
    status: str = Field(..., description="'success' or 'error'")
    html_size_bytes: Optional[int] = Field(None, description="Size of HTML content")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    trigger_type: str = Field(..., description="'manual' or 'scheduled'")
    final_url: Optional[str] = Field(None, description="Final URL after redirects")
    # AI Analysis fields
    analysis_status: Optional[str] = Field(
        None, description="Analysis status: pending, completed, failed"
    )
    discovered_articles: Optional[List[DiscoveredArticle]] = Field(
        None, description="List of articles discovered by AI analysis"
    )
    analysis_error: Optional[str] = Field(None, description="Error message if analysis failed")
    analysis_tokens_used: Optional[int] = Field(
        None, description="Number of tokens used for analysis"
    )
    analyzed_at: Optional[datetime] = Field(None, description="When analysis completed")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    @field_validator("discovered_articles", mode="before")
    @classmethod
    def validate_discovered_articles(cls, v: Any) -> Optional[List[DiscoveredArticle]]:
        """Convert raw JSONB data to DiscoveredArticle objects."""
        if v is None:
            return None
        if isinstance(v, list):
            articles: List[DiscoveredArticle] = [
                DiscoveredArticle(**item) if isinstance(item, dict) else item for item in v
            ]
            return articles
        # Pydantic will handle validation errors for unexpected types
        return None


class SourceFetchHtmlResponse(BaseModel):
    """Response for HTML content retrieval."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="History entry UUID")
    html_content: str = Field(..., description="Raw HTML content")
    fetched_at: datetime = Field(..., description="When fetch occurred")
    final_url: Optional[str] = Field(None, description="Final URL")


class AnalysisStartedResponse(BaseModel):
    """Response when AI analysis is triggered."""

    message: str = Field(..., description="Status message")
    history_id: UUID = Field(..., description="History entry UUID being analyzed")
