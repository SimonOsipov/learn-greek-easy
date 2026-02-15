"""User-related Pydantic schemas for API request/response validation.

This module contains schemas for:
- User profile management
- User settings
- Logout acknowledgments

Authentication is handled via Supabase Auth JWT tokens validated by the dependency layer.
"""

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# ============================================================================
# Supported Languages
# ============================================================================

# Supported interface languages (Greek UI removed - only EN/RU supported)
SupportedLanguage = Literal["en", "ru"]

# ============================================================================
# User Schemas
# ============================================================================


class UserBase(BaseModel):
    """Base user schema with common fields."""

    email: EmailStr
    full_name: Optional[str] = Field(None, max_length=255)


class UserUpdate(BaseModel):
    """Schema for updating user profile."""

    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    avatar_url: Optional[str] = Field(
        None,
        max_length=500,
        description="S3 key for user avatar",
    )


class UserResponse(UserBase):
    """Schema for user response (public data)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    is_active: bool
    is_superuser: bool
    email_verified_at: Optional[datetime]
    avatar_url: Optional[str] = None
    auth_provider: Optional[str] = Field(
        None,
        description="Authentication provider (always 'supabase')",
    )
    created_at: datetime
    updated_at: datetime


class UserProfileResponse(UserResponse):
    """Schema for user profile with settings."""

    settings: "UserSettingsResponse"


# ============================================================================
# User Settings Schemas
# ============================================================================


class UserSettingsUpdate(BaseModel):
    """Schema for updating user settings."""

    daily_goal: Optional[int] = Field(None, ge=1, le=200)
    email_notifications: Optional[bool] = None
    preferred_language: Optional[SupportedLanguage] = Field(
        None,
        description="ISO 639-1 language code for interface language",
    )
    theme: Optional[str] = Field(
        None,
        pattern="^(light|dark)$",
        description="User's preferred theme: 'light' or 'dark'",
    )

    @field_validator("preferred_language", mode="before")
    @classmethod
    def validate_language(cls, v: str | None) -> str | None:
        """Allow None to clear the language preference."""
        if v is None or v == "":
            return None
        return v


class UserSettingsResponse(BaseModel):
    """Schema for user settings response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    daily_goal: int
    email_notifications: bool
    preferred_language: Optional[str] = None
    theme: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class UserWithSettingsUpdate(BaseModel):
    """Schema for updating user profile AND settings in one request."""

    # User fields
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    avatar_url: Optional[str] = Field(
        None,
        max_length=500,
        description="S3 key for user avatar",
    )

    # Settings fields (flattened for convenience)
    daily_goal: Optional[int] = Field(None, ge=1, le=200)
    email_notifications: Optional[bool] = None
    preferred_language: Optional[SupportedLanguage] = Field(
        None,
        description="ISO 639-1 language code for interface language",
    )
    theme: Optional[str] = Field(
        None,
        pattern="^(light|dark)$",
        description="User's preferred theme: 'light' or 'dark'",
    )


# ============================================================================
# Authentication Schemas
# ============================================================================


class TokenResponse(BaseModel):
    """Schema for JWT token response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class TokenPayload(BaseModel):
    """Schema for JWT token payload."""

    sub: UUID  # user_id
    exp: datetime
    iat: datetime


# ============================================================================
# Logout Schemas
# ============================================================================


class LogoutResponse(BaseModel):
    """Schema for logout response."""

    success: bool
    message: str


class LogoutAllResponse(BaseModel):
    """Schema for logout all sessions response."""

    success: bool
    message: str


# ============================================================================
# Avatar Upload Schemas
# ============================================================================


class AvatarUploadRequest(BaseModel):
    """Request schema for avatar upload URL generation."""

    content_type: str = Field(
        ...,
        description="MIME type of the image (image/jpeg, image/png, image/webp)",
    )
    file_size: int = Field(
        ...,
        gt=0,
        le=5 * 1024 * 1024,  # 5MB
        description="File size in bytes (max 5MB)",
    )


class AvatarUploadResponse(BaseModel):
    """Response schema for avatar upload URL."""

    upload_url: str = Field(..., description="Presigned S3 PUT URL")
    avatar_key: str = Field(..., description="S3 key to use in PATCH /me")
    expires_in: int = Field(..., description="URL expiry in seconds")


class AvatarDeleteResponse(BaseModel):
    """Response schema for avatar deletion."""

    success: bool
    message: str
