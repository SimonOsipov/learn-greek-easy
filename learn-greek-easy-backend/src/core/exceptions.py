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

    def __init__(
        self,
        detail: str = "Premium subscription required",
        current_tier: str = "free",
        required_tier: str = "premium",
        trial_eligible: bool = False,
        gate_type: str = "require_premium",
        deck_id: str | None = None,
    ) -> None:
        extra = {
            "required_tier": required_tier,
            "current_tier": current_tier,
            "trial_eligible": trial_eligible,
        }
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
            error_code="PREMIUM_REQUIRED",
            extra=extra,
        )
        self._gate_type = gate_type
        self._deck_id = deck_id


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


class ConflictException(BaseAPIException):
    """Resource conflict - duplicate or conflicting state."""

    def __init__(self, resource: str = "Resource", detail: Optional[str] = None) -> None:
        detail = detail or f"{resource} already exists"
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
            error_code="CONFLICT",
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
# Supabase Exceptions
# ============================================================================


class SupabaseAdminError(BaseAPIException):
    """Supabase Admin API operation failed."""

    def __init__(
        self,
        detail: str = "Supabase Admin API operation failed",
    ) -> None:
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
            error_code="SUPABASE_ADMIN_ERROR",
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


# ── Billing Exceptions ──────────────────────────────────────────────


class BillingNotConfiguredException(BaseAPIException):
    """Stripe billing is not configured."""

    def __init__(self, detail: str = "Stripe billing is not configured") -> None:
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
            error_code="BILLING_NOT_CONFIGURED",
        )


class AlreadyPremiumException(BaseAPIException):
    """User already has an active premium subscription."""

    def __init__(self, detail: str = "You already have an active premium subscription") -> None:
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
            error_code="ALREADY_PREMIUM",
        )


class CheckoutNotPaidException(BaseAPIException):
    """Checkout session payment is not complete."""

    def __init__(self, detail: str = "Payment has not been completed") -> None:
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
            error_code="CHECKOUT_NOT_PAID",
        )


class CheckoutUserMismatchException(BaseAPIException):
    """Checkout session user does not match authenticated user."""

    def __init__(self, detail: str = "Checkout session does not belong to this user") -> None:
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
            error_code="CHECKOUT_USER_MISMATCH",
        )


class SubscriptionNotActiveException(BaseAPIException):
    def __init__(self, detail: str = "User does not have an active subscription") -> None:
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
            error_code="SUBSCRIPTION_NOT_ACTIVE",
        )


class PlanChangeNotAllowedException(BaseAPIException):
    def __init__(self, detail: str = "Plan change is not allowed for this subscription") -> None:
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
            error_code="PLAN_CHANGE_NOT_ALLOWED",
        )


class SubscriptionAlreadyCancelingException(BaseAPIException):
    def __init__(self, detail: str = "Subscription is already scheduled for cancellation") -> None:
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
            error_code="SUBSCRIPTION_ALREADY_CANCELING",
        )


# ============================================================================
# ElevenLabs Service Exceptions
# ============================================================================


class ElevenLabsError(Exception):
    """Base exception for all ElevenLabs-related errors."""

    pass


class ElevenLabsNotConfiguredError(ElevenLabsError):
    """ElevenLabs API key is not configured."""

    def __init__(self, detail: str = "ElevenLabs API key is not configured") -> None:
        self.detail = detail
        super().__init__(detail)


class ElevenLabsAuthenticationError(ElevenLabsError):
    """ElevenLabs authentication failed (401 - invalid API key)."""

    def __init__(self, detail: str = "ElevenLabs authentication failed") -> None:
        self.detail = detail
        super().__init__(detail)


class ElevenLabsRateLimitError(ElevenLabsError):
    """ElevenLabs rate limit exceeded (429 - quota exceeded)."""

    def __init__(self, detail: str = "ElevenLabs rate limit exceeded") -> None:
        self.detail = detail
        super().__init__(detail)


class ElevenLabsNoVoicesError(ElevenLabsError):
    """No voices available from ElevenLabs."""

    def __init__(self, detail: str = "No voices available from ElevenLabs") -> None:
        self.detail = detail
        super().__init__(detail)


class ElevenLabsVoiceNotFoundError(ElevenLabsError):
    """Voice not found on ElevenLabs (404 - voice_id invalid or deleted)."""

    def __init__(self, voice_id: str, detail: str = "Voice not found") -> None:
        self.voice_id = voice_id
        self.detail = detail
        super().__init__(f"{detail}: {voice_id}")


class ElevenLabsAPIError(ElevenLabsError):
    """Generic ElevenLabs API error with status code and detail."""

    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"ElevenLabs API error {status_code}: {detail}")


# ============================================================================
# OpenRouter Service Exceptions
# ============================================================================


class OpenRouterError(Exception):
    """Base exception for all OpenRouter-related errors."""

    pass


class OpenRouterNotConfiguredError(OpenRouterError):
    """OpenRouter API key is not configured."""

    def __init__(self, detail: str = "OpenRouter API key is not configured") -> None:
        self.detail = detail
        super().__init__(detail)


class OpenRouterAuthenticationError(OpenRouterError):
    """OpenRouter authentication failed (401 - invalid API key)."""

    def __init__(self, detail: str = "OpenRouter authentication failed") -> None:
        self.detail = detail
        super().__init__(detail)


class OpenRouterRateLimitError(OpenRouterError):
    """OpenRouter rate limit exceeded (429)."""

    def __init__(self, detail: str = "OpenRouter rate limit exceeded") -> None:
        self.detail = detail
        super().__init__(detail)


class OpenRouterAPIError(OpenRouterError):
    """Generic OpenRouter API error with status code and detail."""

    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"OpenRouter API error {status_code}: {detail}")


class OpenRouterTimeoutError(OpenRouterError):
    """OpenRouter request timed out."""

    def __init__(self, detail: str = "OpenRouter request timed out") -> None:
        self.detail = detail
        super().__init__(detail)
