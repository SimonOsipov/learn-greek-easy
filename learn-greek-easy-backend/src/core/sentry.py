"""Sentry error tracking and performance monitoring.

This module provides a wrapper around the Sentry SDK with:
- Automatic initialization on app startup
- Graceful degradation when DSN is missing
- Test user filtering (e2e_*, test_*, *@test.*)
- Environment tagging on all events
- Request ID correlation
- Proper shutdown with event flushing

Example:
    from src.core.sentry import init_sentry, capture_exception_if_needed

    # Initialize in lifespan
    init_sentry()

    # Capture an exception (filters test users)
    capture_exception_if_needed(exc, user_email=user.email)
"""

import os
import re
from typing import Any, Dict, Optional

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.loguru import LoggingLevels, LoguruIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from src.config import settings
from src.core.logging import get_logger

logger = get_logger(__name__)

# Global Sentry state
_sentry_initialized: bool = False


def _is_test_user(email: Optional[str]) -> bool:
    """Check if user should be filtered from Sentry.

    Test users are identified by:
    - Email starting with 'e2e_' or 'test_' (case-insensitive)
    - Email matching '*@test.*' pattern (case-insensitive)

    Args:
        email: User's email address

    Returns:
        True if the user should be filtered from Sentry
    """
    if not email:
        return False

    email_lower = email.lower()

    # Match e2e_user@example.com, test_user@example.com
    if email_lower.startswith("e2e_") or email_lower.startswith("test_"):
        return True

    # Match user@test.com, user@test.example.com
    if re.search(r"@test\.", email_lower):
        return True

    return False


def _before_send(event: Any, hint: Any) -> Any:
    """Filter and sanitize events before sending to Sentry.

    Args:
        event: The Sentry event dict
        hint: Additional context about the event

    Returns:
        The event to send, or None to drop it
    """
    # Check if user is a test user
    user = event.get("user", {})
    user_email = user.get("email")

    if _is_test_user(user_email):
        logger.debug("Filtering Sentry event for test user")
        return None

    # Sanitize sensitive headers
    if "request" in event and "headers" in event["request"]:
        headers = event["request"]["headers"]
        sensitive_headers = [
            "authorization",
            "cookie",
            "x-api-key",
            "x-test-seed-secret",
        ]
        for header in sensitive_headers:
            if header in headers:
                headers[header] = "[Filtered]"

    return event


def _before_send_transaction(
    event: Any,
    hint: Any,
) -> Any:
    """Filter transactions before sending to Sentry.

    Args:
        event: The Sentry transaction event dict
        hint: Additional context

    Returns:
        The event to send, or None to drop it
    """
    # Check if user is a test user
    user = event.get("user", {})
    user_email = user.get("email")

    if _is_test_user(user_email):
        logger.debug("Filtering Sentry transaction for test user")
        return None

    return event


def init_sentry() -> None:
    """Initialize Sentry SDK on application startup.

    Should be called in FastAPI lifespan startup event.
    If DSN is not configured, Sentry will be disabled silently.
    """
    global _sentry_initialized

    if _sentry_initialized:
        logger.warning("Sentry SDK already initialized")
        return

    # Skip initialization in test mode
    if settings.is_testing:
        logger.info("Sentry disabled (testing mode)")
        return

    # Skip initialization if DSN not configured
    if not settings.sentry_dsn:
        logger.info("Sentry disabled (no DSN configured)")
        return

    try:
        # Get release from Railway environment or fallback
        release = os.environ.get("RAILWAY_GIT_COMMIT_SHA", os.environ.get("GITHUB_SHA", "local"))

        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.sentry_environment,
            release=release,
            # Enable Sentry Logs for centralized log observability
            enable_logs=True,
            # Performance monitoring
            traces_sample_rate=settings.sentry_traces_sample_rate,
            profiles_sample_rate=settings.sentry_profiles_sample_rate,
            # Privacy
            send_default_pii=settings.sentry_send_default_pii,
            # Debug mode
            debug=settings.sentry_debug,
            # Event filtering
            before_send=_before_send,
            before_send_transaction=_before_send_transaction,
            # Integrations
            integrations=[
                StarletteIntegration(transaction_style="endpoint"),
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
                RedisIntegration(),
                LoguruIntegration(
                    sentry_logs_level=LoggingLevels.INFO.value,  # INFO+ to Sentry Logs
                    level=LoggingLevels.INFO.value,  # INFO+ as breadcrumbs
                    event_level=LoggingLevels.ERROR.value,  # ERROR+ creates events
                ),
            ],
            # Additional settings
            attach_stacktrace=True,
            max_breadcrumbs=50,
        )

        _sentry_initialized = True
        logger.info(
            "Sentry SDK initialized",
            extra={
                "environment": settings.sentry_environment,
                "release": release[:8] if len(release) > 8 else release,
                "traces_sample_rate": settings.sentry_traces_sample_rate,
            },
        )

    except Exception as e:
        logger.error(f"Failed to initialize Sentry: {e}", exc_info=True)
        _sentry_initialized = False


def shutdown_sentry() -> None:
    """Shutdown Sentry SDK and flush pending events.

    Should be called in FastAPI lifespan shutdown event,
    BEFORE closing database and Redis connections.
    """
    global _sentry_initialized

    if not _sentry_initialized:
        return

    logger.info("Shutting down Sentry SDK...")

    try:
        # Flush pending events with timeout
        sentry_sdk.flush(timeout=5.0)
        logger.info("Sentry SDK shutdown complete")

    except Exception as e:
        logger.error(f"Error shutting down Sentry: {e}", exc_info=True)

    finally:
        _sentry_initialized = False


def is_sentry_enabled() -> bool:
    """Check if Sentry is enabled and initialized.

    Returns:
        True if Sentry is ready to capture events
    """
    return _sentry_initialized


def capture_exception_if_needed(
    exc: Exception,
    user_email: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """Capture an exception to Sentry if conditions are met.

    Filters out test users and only captures if Sentry is initialized.

    Args:
        exc: The exception to capture
        user_email: User's email for test user filtering
        extra: Additional context to attach to the event

    Returns:
        Sentry event ID if captured, None otherwise
    """
    if not _sentry_initialized:
        return None

    # Filter test users
    if _is_test_user(user_email):
        logger.debug("Skipping Sentry capture for test user")
        return None

    try:
        with sentry_sdk.push_scope() as scope:
            if extra:
                for key, value in extra.items():
                    scope.set_extra(key, value)

            event_id: Optional[str] = sentry_sdk.capture_exception(exc)
            return event_id

    except Exception as e:
        # Never let Sentry break the app
        logger.error(f"Failed to capture exception: {e}", exc_info=True)
        return None


def set_user_context(
    user_id: str,
    email: Optional[str] = None,
    username: Optional[str] = None,
) -> None:
    """Set user context for Sentry events.

    Args:
        user_id: User's unique identifier
        email: User's email (only included if send_default_pii is True)
        username: User's display name
    """
    if not _sentry_initialized:
        return

    # Filter test users - don't set context for them
    if _is_test_user(email):
        return

    user_context: Dict[str, Any] = {"id": user_id}

    if username:
        user_context["username"] = username

    # Only include email if PII is enabled
    if email and settings.sentry_send_default_pii:
        user_context["email"] = email

    sentry_sdk.set_user(user_context)


def set_request_context(request_id: str, endpoint: str) -> None:
    """Set request context for Sentry events.

    Args:
        request_id: Unique request identifier from middleware
        endpoint: The API endpoint path
    """
    if not _sentry_initialized:
        return

    sentry_sdk.set_tag("request_id", request_id)
    sentry_sdk.set_tag("endpoint", endpoint)


def add_breadcrumb(
    category: str,
    message: str,
    level: str = "info",
    data: Optional[Dict[str, Any]] = None,
) -> None:
    """Add a breadcrumb to the current Sentry scope.

    Args:
        category: Breadcrumb category (e.g., "auth", "database")
        message: Human-readable message
        level: Severity level (debug, info, warning, error)
        data: Additional data to attach
    """
    if not _sentry_initialized:
        return

    sentry_sdk.add_breadcrumb(
        category=category,
        message=message,
        level=level,
        data=data,
    )
