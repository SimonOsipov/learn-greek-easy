"""User-related Pydantic schemas for API request/response validation.

This module contains schemas for:
- User authentication (registration, login, JWT tokens)
- User profile management
- User settings
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


class UserCreate(UserBase):
    """Schema for user registration."""

    password: str = Field(..., min_length=8, max_length=100)
    full_name: str = Field(..., min_length=1, max_length=255)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password strength."""
        if not any(char.isdigit() for char in v):
            raise ValueError("Password must contain at least one digit")
        if not any(char.isalpha() for char in v):
            raise ValueError("Password must contain at least one letter")
        return v


class UserLogin(BaseModel):
    """Schema for user login."""

    email: EmailStr
    password: str = Field(..., min_length=1)


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
# Google OAuth Schemas
# ============================================================================


class GoogleAuthRequest(BaseModel):
    """Schema for Google OAuth authentication request.

    The frontend obtains this token from Google Sign-In SDK
    and sends it to the backend for verification.
    """

    id_token: str = Field(
        ...,
        min_length=100,  # Google ID tokens are ~1000+ chars
        description="Google ID token (JWT) from Google Sign-In",
    )


class GoogleUserInfo(BaseModel):
    """Internal schema for parsed Google user information.

    Extracted from verified Google ID token payload.
    Not used in API responses.
    """

    model_config = ConfigDict(frozen=True)  # Immutable

    google_id: str = Field(..., description="Google's unique user identifier (sub claim)")
    email: EmailStr = Field(..., description="User's email from Google")
    email_verified: bool = Field(..., description="Whether Google has verified the email")
    full_name: Optional[str] = Field(None, description="User's full name from Google")
    picture_url: Optional[str] = Field(None, description="Profile picture URL")
