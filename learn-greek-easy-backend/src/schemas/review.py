"""Review-related Pydantic schemas for API request/response validation.

This module contains schemas for:
- Review submission (single and bulk)
- Review responses with SM-2 algorithm results
- Review history tracking
"""

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.db.models import ReviewRating

# ============================================================================
# Review Schemas
# ============================================================================


class ReviewSubmit(BaseModel):
    """Schema for submitting a card review."""

    card_id: UUID
    quality: int = Field(..., ge=0, le=5)
    time_taken: int = Field(..., ge=0, le=300)  # Max 5 minutes (300 seconds)

    @field_validator("quality")
    @classmethod
    def validate_quality(cls, v: int) -> int:
        """Ensure quality matches ReviewRating enum values."""
        valid_values = [rating.value for rating in ReviewRating]
        if v not in valid_values:
            raise ValueError(f"Quality must be one of {valid_values}")
        return v


class ReviewResponse(BaseModel):
    """Schema for review submission response."""

    success: bool
    card_id: UUID
    new_status: str  # CardStatus as string
    next_review_date: date
    easiness_factor: float
    interval: int
    message: Optional[str] = None


class ReviewHistoryResponse(BaseModel):
    """Schema for historical review data."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    card_id: UUID
    quality: int
    time_taken: int
    reviewed_at: datetime


class BulkReviewSubmit(BaseModel):
    """Schema for submitting multiple reviews at once."""

    deck_id: UUID
    session_id: str
    reviews: list[ReviewSubmit] = Field(..., min_length=1, max_length=100)


class BulkReviewResponse(BaseModel):
    """Schema for bulk review response."""

    session_id: str
    total_reviews: int
    successful_reviews: int
    failed_reviews: int
    results: list[ReviewResponse]


class ReviewHistoryListResponse(BaseModel):
    """Paginated review history response.

    Used by the GET /api/v1/reviews endpoint to return a paginated
    list of user reviews with metadata for pagination.
    """

    total: int = Field(..., ge=0, description="Total number of reviews matching criteria")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Items per page")
    reviews: list[ReviewHistoryResponse] = Field(
        ..., description="List of reviews for current page"
    )
