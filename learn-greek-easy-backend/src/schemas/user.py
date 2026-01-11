"""User-related Pydantic schemas for API request/response validation.

This module contains schemas for:
- User authentication (Auth0, JWT tokens)
- User profile management
- User settings

Legacy email/password registration and Google OAuth schemas have been removed.
All authentication now flows through Auth0.
"""

from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# ============================================================================
# Supported Languages
# ============================================================================

# Supported interface languages - extend as needed
SupportedLanguage = Literal["en", "el"]

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


class UserResponse(UserBase):
    """Schema for user response (public data)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    is_active: bool
    is_superuser: bool
    email_verified_at: Optional[datetime]
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
    created_at: datetime
    updated_at: datetime


class UserWithSettingsUpdate(BaseModel):
    """Schema for updating user profile AND settings in one request."""

    # User fields
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)

    # Settings fields (flattened for convenience)
    daily_goal: Optional[int] = Field(None, ge=1, le=200)
    email_notifications: Optional[bool] = None
    preferred_language: Optional[SupportedLanguage] = Field(
        None,
        description="ISO 639-1 language code for interface language",
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


class Auth0LoginResponse(BaseModel):
    """Schema for Auth0 login response with user profile.

    Combines token information with user profile data for efficient
    frontend initialization after login.
    """

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user: "UserProfileResponse"


class TokenRefresh(BaseModel):
    """Schema for refresh token request."""

    refresh_token: str = Field(..., min_length=1)


class TokenPayload(BaseModel):
    """Schema for JWT token payload."""

    sub: UUID  # user_id
    exp: datetime
    iat: datetime


# ============================================================================
# Session Management Schemas
# ============================================================================


class SessionInfo(BaseModel):
    """Schema for session information.

    Represents a single user session (refresh token) without exposing
    the actual token value for security.
    """

    id: UUID
    created_at: datetime
    expires_at: datetime


class SessionListResponse(BaseModel):
    """Schema for listing user sessions."""

    sessions: List[SessionInfo]
    total: int


class LogoutResponse(BaseModel):
    """Schema for logout response."""

    success: bool
    message: str
    token_revoked: bool


class LogoutAllResponse(BaseModel):
    """Schema for logout all sessions response."""

    success: bool
    message: str
    sessions_revoked: int


# ============================================================================
# Auth0 OAuth Schemas
# ============================================================================


class Auth0AuthRequest(BaseModel):
    """Schema for Auth0 authentication request.

    The frontend obtains this token from Auth0 SDK/Universal Login
    and sends it to the backend for verification.
    """

    access_token: str = Field(
        ...,
        min_length=10,
        description="Auth0 access token (JWT)",
    )
