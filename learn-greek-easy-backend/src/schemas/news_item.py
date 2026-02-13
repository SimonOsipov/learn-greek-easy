"""News Item Pydantic schemas for API request/response validation.

This module contains schemas for:
- News item CRUD operations
- Paginated news item listings
- Input validation with bilingual content
"""

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


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

    Includes presigned S3 URLs for the image and audio narration.
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
    audio_url: Optional[str] = Field(None, description="Presigned S3 URL for the audio narration")
    audio_generated_at: Optional[datetime] = Field(
        None, description="Timestamp when audio was generated via TTS"
    )
    audio_duration_seconds: Optional[float] = Field(
        None, description="Duration of audio narration in seconds"
    )
    audio_file_size_bytes: Optional[int] = Field(None, description="Size of audio file in bytes")
    created_at: datetime
    updated_at: datetime


class NewsItemListResponse(BaseModel):
    """Paginated list of news items."""

    total: int = Field(..., ge=0)
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1, le=50)
    items: list[NewsItemResponse]


# ============================================================================
# News Item with Question Schemas
# ============================================================================


class QuestionOption(BaseModel):
    """Single option for a multiple-choice question."""

    text_el: str = Field(..., min_length=1)
    text_en: str = Field(..., min_length=1)
    text_ru: str = Field(..., min_length=1)


class QuestionCreate(BaseModel):
    """Question data for creating a culture question from news."""

    deck_id: UUID
    question_el: str = Field(..., min_length=1)
    question_en: str = Field(..., min_length=1)
    question_ru: str = Field(..., min_length=1)
    options: list[QuestionOption] = Field(..., min_length=4, max_length=4)
    correct_answer_index: int = Field(..., ge=0, le=3)

    @field_validator("options")
    @classmethod
    def validate_unique_options(cls, v: list[QuestionOption]) -> list[QuestionOption]:
        """Ensure all options are unique within each language."""
        el_texts = [opt.text_el for opt in v]
        en_texts = [opt.text_en for opt in v]
        ru_texts = [opt.text_ru for opt in v]
        if len(el_texts) != len(set(el_texts)):
            raise ValueError("All Greek options must be unique")
        if len(en_texts) != len(set(en_texts)):
            raise ValueError("All English options must be unique")
        if len(ru_texts) != len(set(ru_texts)):
            raise ValueError("All Russian options must be unique")
        return v


class NewsItemWithQuestionCreate(NewsItemCreate):
    """Extended news item creation with optional question."""

    question: QuestionCreate | None = None


class CardBrief(BaseModel):
    """Brief card info for news creation response."""

    id: UUID
    deck_id: UUID
    question_text: dict


class NewsItemWithCardResponse(BaseModel):
    """Response for news creation with optional card."""

    news_item: NewsItemResponse
    card: CardBrief | None = None
    message: str


# ============================================================================
# News Card Lookup Schemas
# ============================================================================


class NewsCardInfo(BaseModel):
    """Card info associated with a news item."""

    card_id: UUID
    deck_id: UUID | None  # Can be None for pending review cards


class NewsItemWithCardInfo(NewsItemResponse):
    """News item response with optional card association."""

    card_id: UUID | None = None
    deck_id: UUID | None = None


class NewsItemListWithCardsResponse(BaseModel):
    """Paginated list of news items with card info."""

    total: int = Field(..., ge=0)
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1, le=50)
    items: list[NewsItemWithCardInfo]


# ============================================================================
# Module Exports
# ============================================================================

__all__ = [
    "NewsItemCreate",
    "NewsItemUpdate",
    "NewsItemResponse",
    "NewsItemListResponse",
    "QuestionOption",
    "QuestionCreate",
    "NewsItemWithQuestionCreate",
    "CardBrief",
    "NewsItemWithCardResponse",
    "NewsCardInfo",
    "NewsItemWithCardInfo",
    "NewsItemListWithCardsResponse",
]
