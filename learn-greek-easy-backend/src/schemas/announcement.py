"""Announcement-related Pydantic schemas for API request/response validation."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AnnouncementCreate(BaseModel):
    """Schema for creating a new announcement campaign."""

    title: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Announcement title (max 100 chars)",
    )
    message: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Announcement message content (max 500 chars)",
    )
    link_url: Optional[str] = Field(
        None,
        max_length=500,
        description="Optional URL for users to click",
    )

    @field_validator("title", "message")
    @classmethod
    def strip_and_validate_whitespace(cls, v: str) -> str:
        """Strip leading/trailing whitespace and reject empty strings."""
        stripped = v.strip()
        if not stripped:
            raise ValueError("Field cannot be empty or whitespace only")
        return stripped

    @field_validator("link_url")
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        """Validate URL format if provided."""
        if v is None:
            return v
        v = v.strip()
        if not v:
            return None
        if not v.startswith(("http://", "https://")):
            raise ValueError("Link must start with http:// or https://")
        return v


class CreatorBriefResponse(BaseModel):
    """Brief creator information for announcement items."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    display_name: Optional[str] = None


class AnnouncementResponse(BaseModel):
    """Schema for announcement response (list item)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    message: str
    link_url: Optional[str] = None
    total_recipients: int = Field(default=0, ge=0)
    read_count: int = Field(default=0, ge=0)
    created_at: datetime


class AnnouncementWithCreatorResponse(AnnouncementResponse):
    """Schema for announcement with creator info."""

    creator: Optional[CreatorBriefResponse] = None


class AnnouncementDetailResponse(AnnouncementWithCreatorResponse):
    """Schema for announcement detail with computed stats."""

    read_percentage: float = Field(default=0.0, ge=0.0, le=100.0)


class AnnouncementListResponse(BaseModel):
    """Schema for paginated announcement list."""

    total: int = Field(..., ge=0)
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1, le=100)
    items: list[AnnouncementWithCreatorResponse]


class AnnouncementCreateResponse(BaseModel):
    """Schema for announcement creation response."""

    id: UUID
    title: str
    total_recipients: int = Field(default=0, ge=0)
    message: str = "Announcement created and notifications are being sent"
