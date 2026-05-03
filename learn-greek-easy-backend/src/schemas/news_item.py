"""News Item Pydantic schemas for API request/response validation.

This module contains schemas for:
- News item CRUD operations
- Paginated news item listings
- Input validation with bilingual content
"""

from datetime import date, datetime
from typing import Optional, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, computed_field, model_validator

from src.db.models import NewsCountry


class CountryCounts(BaseModel):
    """Count of news items per country."""

    cyprus: int = 0
    greece: int = 0
    world: int = 0


class NewsItemCreate(BaseModel):
    """Schema for creating a news item with Situation-aligned field names.

    Admin provides source image URL; backend downloads and uploads to S3.
    """

    scenario_el: str = Field(..., min_length=1, max_length=500)
    scenario_en: str = Field(..., min_length=1, max_length=500)
    scenario_ru: str = Field(..., min_length=1, max_length=500)
    scenario_el_a2: Optional[str] = Field(None, max_length=500)
    text_el: str = Field(..., min_length=1)
    text_el_a2: Optional[str] = None
    scene_en: Optional[str] = Field(None, max_length=1000)
    scene_el: Optional[str] = Field(None, max_length=1000)
    style_en: Optional[str] = Field(None, max_length=1000)
    country: NewsCountry = Field(..., description="Country/region: cyprus, greece, or world")
    publication_date: date
    original_article_url: HttpUrl = Field(..., max_length=500)
    source_image_url: HttpUrl = Field(..., description="URL to download the image from")

    @model_validator(mode="after")
    def validate_a2_pair(self) -> Self:
        """If one A2 field is set, the other must also be set."""
        has_scenario = self.scenario_el_a2 is not None
        has_text = self.text_el_a2 is not None
        if has_scenario != has_text:
            raise ValueError("scenario_el_a2 and text_el_a2 must both be provided or both omitted")
        return self

    @model_validator(mode="after")
    def validate_scene_pair(self) -> Self:
        """If one scene_* field is set, the other must also be set.

        Trimmed-empty strings are treated as null, mirroring the frontend
        convention in newsJsonValidation.ts.
        """
        has_en = bool(self.scene_en and self.scene_en.strip())
        has_el = bool(self.scene_el and self.scene_el.strip())
        if has_en != has_el:
            raise ValueError("scene_en and scene_el must both be provided or both omitted")
        return self


class NewsItemUpdate(BaseModel):
    """Schema for updating a news item (all fields optional).

    Uses Situation-aligned field names. No A2 pair validation —
    fields can be updated independently.
    """

    scenario_el: Optional[str] = Field(None, min_length=1, max_length=500)
    scenario_en: Optional[str] = Field(None, min_length=1, max_length=500)
    scenario_ru: Optional[str] = Field(None, min_length=1, max_length=500)
    scenario_el_a2: Optional[str] = Field(None, max_length=500)
    text_el: Optional[str] = Field(None, min_length=1)
    text_el_a2: Optional[str] = None
    country: Optional[NewsCountry] = Field(
        None, description="Country/region: cyprus, greece, or world"
    )
    publication_date: Optional[date] = None
    original_article_url: Optional[HttpUrl] = Field(None, max_length=500)
    source_image_url: Optional[HttpUrl] = Field(
        None, description="New image URL to download (replaces existing)"
    )


class NewsItemResponse(BaseModel):
    """Schema for news item API response.

    Includes presigned S3 URLs for the image and audio narration.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    situation_id: UUID
    title_el: str
    title_en: str
    title_ru: str
    description_el: str
    description_en: Optional[str] = None
    description_ru: Optional[str] = None
    publication_date: date
    original_article_url: str
    country: str = Field(..., description="Country/region this news item belongs to")
    image_url: Optional[str] = Field(None, description="Presigned S3 URL for the image")
    audio_url: Optional[str] = Field(None, description="Presigned S3 URL for the audio narration")
    audio_generated_at: Optional[datetime] = Field(
        None, description="Timestamp when audio was generated via TTS"
    )
    audio_duration_seconds: Optional[float] = Field(
        None, description="Duration of audio narration in seconds"
    )
    audio_file_size_bytes: Optional[int] = Field(None, description="Size of audio file in bytes")

    # A2 text content
    title_el_a2: Optional[str] = None
    description_el_a2: Optional[str] = None

    # A2 audio metadata (read-only, populated by NLVL-02)
    audio_a2_url: Optional[str] = Field(None, description="Presigned S3 URL for A2 audio narration")
    audio_a2_generated_at: Optional[datetime] = Field(
        None, description="Timestamp when A2 audio was generated via TTS"
    )
    audio_a2_duration_seconds: Optional[float] = Field(
        None, description="Duration of A2 audio narration in seconds"
    )
    audio_a2_file_size_bytes: Optional[int] = Field(
        None, description="Size of A2 audio file in bytes"
    )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def has_a2_content(self) -> bool:
        """Whether this news item has A2-level content."""
        return bool(self.title_el_a2 and self.description_el_a2)

    created_at: datetime
    updated_at: datetime


class NewsItemListResponse(BaseModel):
    """Paginated list of news items."""

    total: int = Field(..., ge=0)
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1, le=50)
    items: list[NewsItemResponse]
    country_counts: CountryCounts = Field(
        default_factory=CountryCounts, description="Count of news items per country"
    )
    audio_count: int = Field(0, ge=0, description="Total number of news items with audio")


# ============================================================================
# Module Exports
# ============================================================================

__all__ = [
    "CountryCounts",
    "NewsItemCreate",
    "NewsItemUpdate",
    "NewsItemResponse",
    "NewsItemListResponse",
]
