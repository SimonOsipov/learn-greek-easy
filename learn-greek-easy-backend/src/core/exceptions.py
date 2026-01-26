"""Custom exception classes for the application."""

from typing import Any, Dict, Optional

from fastapi import HTTPException, status


class BaseAPIException(HTTPException):
    """Base exception for all API errors."""

    def __init__(
        self,
        status_code: int,
        detail: str,
        error_code: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        extra: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Initialize API exception."""
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.error_code = error_code or self.__class__.__name__
        self.extra = extra or {}


# ============================================================================
# Authentication Exceptions
# ============================================================================


class InvalidCredentialsException(BaseAPIException):
    """Invalid email or password."""

    def __init__(self, detail: str = "Invalid email or password") -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            error_code="INVALID_CREDENTIALS",
        )


class TokenExpiredException(BaseAPIException):
    """JWT token has expired."""

    def __init__(self, detail: str = "Token has expired") -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            error_code="TOKEN_EXPIRED",
        )


class TokenInvalidException(BaseAPIException):
    """JWT token is invalid."""

    def __init__(self, detail: str = "Invalid token") -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            error_code="TOKEN_INVALID",
        )


class UnauthorizedException(BaseAPIException):
    """User is not authenticated."""

    def __init__(self, detail: str = "Authentication required") -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            error_code="UNAUTHORIZED",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ============================================================================
# Authorization Exceptions
# ============================================================================


class ForbiddenException(BaseAPIException):
    """User does not have permission."""

    def __init__(self, detail: str = "Access forbidden") -> None:
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
            error_code="FORBIDDEN",
        )


class PremiumRequiredException(BaseAPIException):
    """Premium subscription required."""

    def __init__(self, detail: str = "Premium subscription required") -> None:
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
            error_code="PREMIUM_REQUIRED",
        )


# ============================================================================
# Resource Exceptions
# ============================================================================


class NotFoundException(BaseAPIException):
    """Resource not found."""

    def __init__(self, resource: str = "Resource", detail: Optional[str] = None) -> None:
        detail = detail or f"{resource} not found"
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
            error_code="NOT_FOUND",
        )


class UserNotFoundException(NotFoundException):
    """User not found."""

    def __init__(self, user_id: Optional[str] = None) -> None:
        detail = f"User with ID '{user_id}' not found" if user_id else "User not found"
        super().__init__(resource="User", detail=detail)


class DeckNotFoundException(NotFoundException):
    """Deck not found."""

    def __init__(self, deck_id: Optional[str] = None) -> None:
        detail = f"Deck with ID '{deck_id}' not found" if deck_id else "Deck not found"
        super().__init__(resource="Deck", detail=detail)


class CardNotFoundException(NotFoundException):
    """Card not found."""

    def __init__(self, card_id: Optional[str] = None) -> None:
        detail = f"Card with ID '{card_id}' not found" if card_id else "Card not found"
        super().__init__(resource="Card", detail=detail)


class CultureDeckNotFoundException(NotFoundException):
    """Culture deck not found."""

    def __init__(self, deck_id: Optional[str] = None) -> None:
        detail = (
            f"Culture deck with ID '{deck_id}' not found" if deck_id else "Culture deck not found"
        )
        super().__init__(resource="CultureDeck", detail=detail)


class CultureQuestionNotFoundException(NotFoundException):
    """Culture question not found."""

    def __init__(self, question_id: Optional[str] = None) -> None:
        detail = (
            f"Culture question with ID '{question_id}' not found"
            if question_id
            else "Culture question not found"
        )
        super().__init__(resource="CultureQuestion", detail=detail)


# ============================================================================
# Validation Exceptions
# ============================================================================


class ValidationException(BaseAPIException):
    """Validation error."""

    def __init__(self, detail: str, field: Optional[str] = None) -> None:
        extra = {"field": field} if field else {}
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail,
            error_code="VALIDATION_ERROR",
            extra=extra,
        )


class EmailAlreadyExistsException(ValidationException):
    """Email address is already registered."""

    def __init__(self, email: str) -> None:
        super().__init__(
            detail=f"Email '{email}' is already registered",
            field="email",
        )


class WeakPasswordException(ValidationException):
    """Password does not meet requirements."""

    def __init__(
        self,
        detail: str = "Password must be at least 8 characters with uppercase, lowercase, and number",
    ) -> None:
        super().__init__(detail=detail, field="password")


# ============================================================================
# Business Logic Exceptions
# ============================================================================


class ReviewSubmissionException(BaseAPIException):
    """Error submitting review."""

    def __init__(self, detail: str = "Failed to submit review") -> None:
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
            error_code="REVIEW_SUBMISSION_ERROR",
        )


class DeckAlreadyStartedException(BaseAPIException):
    """Deck has already been started."""

    def __init__(self, deck_id: str) -> None:
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Deck '{deck_id}' has already been started",
            error_code="DECK_ALREADY_STARTED",
        )


# ============================================================================
# Rate Limiting
# ============================================================================


class RateLimitException(BaseAPIException):
    """Rate limit exceeded."""

    def __init__(self, detail: str = "Too many requests, please try again later") -> None:
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            error_code="RATE_LIMIT_EXCEEDED",
            headers={"Retry-After": "60"},
        )


# ============================================================================
# Google OAuth Exceptions
# ============================================================================


class GoogleOAuthDisabledException(BaseAPIException):
    """Google OAuth is not enabled or configured."""

    def __init__(
        self,
        detail: str = "Google OAuth is not enabled. Please use email/password authentication.",
    ) -> None:
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail,
            error_code="GOOGLE_OAUTH_DISABLED",
        )


class GoogleTokenInvalidException(BaseAPIException):
    """Google ID token is invalid or could not be verified."""

    def __init__(self, detail: str = "Invalid or expired Google token") -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            error_code="GOOGLE_TOKEN_INVALID",
        )


class AccountLinkingConflictException(BaseAPIException):
    """Account linking conflict - email exists with different Google ID."""

    def __init__(
        self,
        detail: str = "This email is already registered. Please login with your password to link your Google account.",
    ) -> None:
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
            error_code="ACCOUNT_LINKING_CONFLICT",
        )


# ============================================================================
# Auth0 Exceptions
# ============================================================================


class Auth0DisabledException(BaseAPIException):
    """Auth0 authentication is not enabled or configured."""

    def __init__(
        self,
        detail: str = "Auth0 authentication is not enabled",
    ) -> None:
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail,
            error_code="AUTH0_DISABLED",
        )


class Auth0TokenExpiredException(BaseAPIException):
    """Auth0 token has expired."""

    def __init__(
        self,
        detail: str = "Auth0 token has expired",
    ) -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            error_code="AUTH0_TOKEN_EXPIRED",
        )


class Auth0TokenInvalidException(BaseAPIException):
    """Auth0 token is invalid or could not be verified."""

    def __init__(
        self,
        detail: str = "Invalid Auth0 token",
    ) -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            error_code="AUTH0_TOKEN_INVALID",
        )


class Auth0ManagementError(BaseAPIException):
    """Auth0 Management API operation failed."""

    def __init__(
        self,
        detail: str = "Auth0 Management API operation failed",
    ) -> None:
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
            error_code="AUTH0_MANAGEMENT_ERROR",
        )


# ============================================================================
# Seed API Exceptions
# ============================================================================


class SeedForbiddenException(BaseAPIException):
    """Seeding is forbidden in production environment."""

    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Database seeding is forbidden in production environment",
            error_code="SEED_FORBIDDEN",
        )


class SeedDisabledException(BaseAPIException):
    """Seeding feature is disabled via configuration."""

    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Database seeding is disabled. Set TEST_SEED_ENABLED=true to enable",
            error_code="SEED_DISABLED",
        )


class SeedUnauthorizedException(BaseAPIException):
    """Invalid or missing seed secret header."""

    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Test-Seed-Secret header",
            error_code="SEED_UNAUTHORIZED",
        )


# ============================================================================
# Mock Exam Exceptions
# ============================================================================


class MockExamNotFoundException(NotFoundException):
    """Mock exam session not found."""

    def __init__(self, session_id: str) -> None:
        super().__init__(
            resource="MockExamSession",
            detail=f"Mock exam session {session_id} not found",
        )


class MockExamSessionExpiredException(BaseAPIException):
    """Mock exam session is no longer active."""

    def __init__(self, session_id: str) -> None:
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Mock exam session {session_id} is no longer active",
            error_code="MOCK_EXAM_SESSION_EXPIRED",
        )


# ============================================================================
# News Item Exceptions
# ============================================================================


class NewsItemNotFoundException(NotFoundException):
    """Raised when a news item is not found."""

    def __init__(self, news_item_id: Optional[str] = None) -> None:
        detail = (
            f"News item with ID '{news_item_id}' not found"
            if news_item_id
            else "News item not found"
        )
        super().__init__(resource="NewsItem", detail=detail)
