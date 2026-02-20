"""PostHog analytics client management.

This module provides a wrapper around the PostHog Python SDK with:
- Automatic initialization on app startup
- Graceful degradation when API key is missing
- Test user filtering (e2e_*, test_*, *@test.*)
- Environment tagging on all events
- Proper shutdown with event flushing

Example:
    from src.core.posthog import capture_event, identify_user

    # Track an event
    capture_event(
        distinct_id=str(user.id),
        event="user_login",
        properties={"method": "email"},
        user_email=user.email,
    )

    # Identify a user
    identify_user(
        distinct_id=str(user.id),
        properties={"subscription_tier": "free"},
        user_email=user.email,
    )
"""

import re
from typing import Any, Dict, Optional

import posthog

from src.config import settings
from src.core.logging import get_logger

logger = get_logger(__name__)

# Global PostHog client state
_posthog_initialized: bool = False


def _is_test_user(distinct_id: Optional[str], email: Optional[str]) -> bool:
    """Check if the user is a test user that should be filtered from analytics.

    Test users are identified by:
    - distinct_id starting with 'e2e_' or 'test_' (case-insensitive)
    - email matching '*@test.*' pattern (case-insensitive)

    Args:
        distinct_id: The user's distinct ID (usually user UUID)
        email: The user's email address

    Returns:
        True if the user should be filtered from analytics
    """
    if distinct_id:
        distinct_id_lower = distinct_id.lower()
        if distinct_id_lower.startswith("e2e_") or distinct_id_lower.startswith("test_"):
            return True

    if email:
        email_lower = email.lower()
        # Match patterns like user@test.com, user@test.example.com
        if re.search(r"@test\.", email_lower):
            return True

    return False


def _get_default_properties() -> Dict[str, Any]:
    """Get default properties to include with all events.

    Returns:
        Dictionary with environment and app version
    """
    return {
        "environment": settings.app_env,
        "app_version": settings.app_version,
    }


def init_posthog() -> None:
    """Initialize PostHog client on application startup.

    Should be called in FastAPI lifespan startup event, after Redis initialization.
    If API key is not configured, PostHog will be disabled silently.
    """
    global _posthog_initialized

    if _posthog_initialized:
        logger.warning("PostHog client already initialized")
        return

    # Skip initialization if in test mode
    if settings.is_testing:
        logger.info("PostHog analytics disabled (testing mode)")
        return

    # Skip initialization if API key is not configured
    if not settings.posthog_api_key:
        logger.info("PostHog analytics disabled (no API key configured)")
        return

    try:
        # Configure the PostHog SDK
        posthog.project_api_key = settings.posthog_api_key
        posthog.host = settings.posthog_host

        # Enable debug logging in development
        posthog.debug = settings.debug

        # Disable PostHog's default capture of exceptions
        # (we handle errors ourselves via middleware)
        posthog.disabled = False

        _posthog_initialized = True
        logger.info(
            "PostHog analytics initialized",
            extra={
                "host": settings.posthog_host,
                "environment": settings.app_env,
            },
        )

    except Exception as e:
        logger.error(f"Failed to initialize PostHog: {e}", exc_info=True)
        _posthog_initialized = False


def shutdown_posthog() -> None:
    """Shutdown PostHog client and flush pending events.

    Should be called in FastAPI lifespan shutdown event, BEFORE Redis/DB close.
    This ensures all events are flushed while connections are still available.
    """
    global _posthog_initialized

    if not _posthog_initialized:
        return

    logger.info("Shutting down PostHog analytics...")

    try:
        # Flush all pending events
        posthog.flush()
        # Shutdown the client (joins background threads)
        posthog.shutdown()
        logger.info("PostHog analytics shutdown complete")

    except Exception as e:
        logger.error(f"Error shutting down PostHog: {e}", exc_info=True)

    finally:
        _posthog_initialized = False


def flush_posthog() -> None:
    """Flush pending PostHog events without shutting down the client.

    Use this in long-running processes (e.g. scheduled tasks) to ensure
    events are sent while keeping the PostHog client alive for future calls.
    """
    if not _posthog_initialized:
        return
    try:
        posthog.flush()
    except Exception as e:
        logger.error(f"Error flushing PostHog events: {e}", exc_info=True)


def is_posthog_enabled() -> bool:
    """Check if PostHog analytics is enabled and initialized.

    Returns:
        True if PostHog is ready to capture events
    """
    return _posthog_initialized


def get_posthog_client() -> Optional[Any]:
    """Get the PostHog module for direct access.

    Returns:
        The posthog module if initialized, None otherwise

    Note:
        Prefer using capture_event() and identify_user() instead of
        direct client access for consistent behavior.
    """
    if not _posthog_initialized:
        return None
    return posthog


def capture_event(
    distinct_id: str,
    event: str,
    properties: Optional[Dict[str, Any]] = None,
    user_email: Optional[str] = None,
) -> None:
    """Capture an analytics event.

    Events are automatically tagged with environment and app version.
    Test users are filtered out silently.

    Args:
        distinct_id: Unique identifier for the user (usually user UUID)
        event: Name of the event to capture
        properties: Additional properties to include with the event
        user_email: User's email for test user filtering

    Example:
        capture_event(
            distinct_id=str(user.id),
            event="card_reviewed",
            properties={"quality": 4, "deck_id": str(deck.id)},
            user_email=user.email,
        )
    """
    if not _posthog_initialized:
        return

    # Filter test users
    if _is_test_user(distinct_id, user_email):
        logger.debug(f"Skipping event '{event}' for test user")
        return

    # Validate distinct_id
    if not distinct_id:
        logger.warning(f"Cannot capture event '{event}': empty distinct_id")
        return

    try:
        # Merge default properties with event-specific properties
        merged_properties = _get_default_properties()
        if properties:
            merged_properties.update(properties)

        posthog.capture(
            distinct_id=distinct_id,
            event=event,
            properties=merged_properties,
        )

        logger.debug(f"Captured event '{event}' for user {distinct_id[:8]}...")

    except Exception as e:
        # Log but don't raise - analytics should never break the app
        logger.error(f"Failed to capture event '{event}': {e}", exc_info=True)


def identify_user(
    distinct_id: str,
    properties: Optional[Dict[str, Any]] = None,
    user_email: Optional[str] = None,
) -> None:
    """Identify a user with their properties.

    Use this to set user properties that persist across events.
    Test users are filtered out silently.

    Args:
        distinct_id: Unique identifier for the user (usually user UUID)
        properties: User properties to set (e.g., email, name, plan)
        user_email: User's email for test user filtering

    Example:
        identify_user(
            distinct_id=str(user.id),
            properties={
                "email": user.email,
                "created_at": user.created_at.isoformat(),
                "subscription_tier": "free",
            },
            user_email=user.email,
        )
    """
    if not _posthog_initialized:
        return

    # Filter test users
    if _is_test_user(distinct_id, user_email):
        logger.debug("Skipping identify for test user")
        return

    # Validate distinct_id
    if not distinct_id:
        logger.warning("Cannot identify user: empty distinct_id")
        return

    try:
        # Merge default properties with user-specific properties
        merged_properties = _get_default_properties()
        if properties:
            merged_properties.update(properties)

        posthog.identify(
            distinct_id=distinct_id,
            properties=merged_properties,
        )

        logger.debug(f"Identified user {distinct_id[:8]}...")

    except Exception as e:
        # Log but don't raise - analytics should never break the app
        logger.error(f"Failed to identify user: {e}", exc_info=True)
