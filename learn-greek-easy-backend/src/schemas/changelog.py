"""Changelog entry Pydantic schemas for API request/response validation.

This module contains schemas for:
- Public changelog endpoint (localized content)
- Admin CRUD operations (all languages)
- Paginated listing responses
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from src.db.models import ChangelogTag

# ============================================================================
# Public Schemas (Localized - single language based on Accept-Language)
# ============================================================================


class ChangelogItemResponse(BaseModel):
    """Single changelog entry for public API (localized)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    content: str
    tag: ChangelogTag
    created_at: datetime
    updated_at: datetime


class ChangelogListResponse(BaseModel):
    """Paginated list of changelog entries (public)."""

    total: int = Field(..., ge=0)
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1, le=50)
    items: list[ChangelogItemResponse]


# ============================================================================
# Admin Schemas (All languages)
# ============================================================================


class ChangelogEntryCreate(BaseModel):
    """Schema for creating a changelog entry (admin)."""

    title_en: str = Field(..., min_length=1, max_length=500)
    title_ru: str = Field(..., min_length=1, max_length=500)
    content_en: str = Field(..., min_length=1)
    content_ru: str = Field(..., min_length=1)
    tag: ChangelogTag


class ChangelogEntryUpdate(BaseModel):
    """Schema for updating a changelog entry (admin). All fields optional."""

    title_en: Optional[str] = Field(None, min_length=1, max_length=500)
    title_ru: Optional[str] = Field(None, min_length=1, max_length=500)
    content_en: Optional[str] = Field(None, min_length=1)
    content_ru: Optional[str] = Field(None, min_length=1)
    tag: Optional[ChangelogTag] = None


class ChangelogEntryAdminResponse(BaseModel):
    """Full changelog entry for admin API (all languages)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title_en: str
    title_ru: str
    content_en: str
    content_ru: str
    tag: ChangelogTag
    created_at: datetime
    updated_at: datetime


class ChangelogAdminListResponse(BaseModel):
    """Paginated list of changelog entries (admin)."""

    total: int = Field(..., ge=0)
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1, le=50)
    items: list[ChangelogEntryAdminResponse]
