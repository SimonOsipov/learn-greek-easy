"""News Item Pydantic schemas for API request/response validation.

This module contains schemas for:
- News item CRUD operations
- Paginated news item listings
- Input validation with bilingual content
"""

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class NewsItemCreate(BaseModel):
    """Schema for creating a news item.

    Admin provides source image URL; backend downloads and uploads to S3.
    """

    title_el: str = Field(..., min_length=1, max_length=500)
    title_en: str = Field(..., min_length=1, max_length=500)
    title_ru: str = Field(..., min_length=1, max_length=500)
    description_el: str = Field(..., min_length=1, max_length=1000)
    description_en: str = Field(..., min_length=1, max_length=1000)
    description_ru: str = Field(..., min_length=1, max_length=1000)
    publication_date: date
    original_article_url: HttpUrl = Field(..., max_length=500)
    source_image_url: HttpUrl = Field(..., description="URL to download the image from")


class NewsItemUpdate(BaseModel):
    """Schema for updating a news item (all fields optional).

    If source_image_url is provided, backend downloads new image and
    replaces the existing one in S3.
    """

    title_el: Optional[str] = Field(None, min_length=1, max_length=500)
    title_en: Optional[str] = Field(None, min_length=1, max_length=500)
    title_ru: Optional[str] = Field(None, min_length=1, max_length=500)
    description_el: Optional[str] = Field(None, min_length=1, max_length=1000)
    description_en: Optional[str] = Field(None, min_length=1, max_length=1000)
    description_ru: Optional[str] = Field(None, min_length=1, max_length=1000)
    publication_date: Optional[date] = None
    original_article_url: Optional[HttpUrl] = Field(None, max_length=500)
    source_image_url: Optional[HttpUrl] = Field(
        None, description="New image URL to download (replaces existing)"
    )


class NewsItemResponse(BaseModel):
    """Schema for news item API response.

    Includes presigned S3 URL for the image.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title_el: str
    title_en: str
    title_ru: str
    description_el: str
    description_en: str
    description_ru: str
    publication_date: date
    original_article_url: str
    image_url: Optional[str] = Field(None, description="Presigned S3 URL for the image")
    created_at: datetime
    updated_at: datetime


class NewsItemListResponse(BaseModel):
    """Paginated list of news items."""

    total: int = Field(..., ge=0)
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1, le=50)
    items: list[NewsItemResponse]


# ============================================================================
# Module Exports
# ============================================================================

__all__ = [
    "NewsItemCreate",
    "NewsItemUpdate",
    "NewsItemResponse",
    "NewsItemListResponse",
]
