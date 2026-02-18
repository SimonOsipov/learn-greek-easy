"""Stripe client module for payment processing.

This module provides a lazy-initialized Stripe client instance following
the instance-based StripeClient API (Stripe SDK v14+).
"""

from stripe import StripeClient

from src.config import settings
from src.core.logging import get_logger

logger = get_logger(__name__)

# Module-level Stripe client instance (lazy-initialized)
_stripe_client: StripeClient | None = None


def get_stripe_client() -> StripeClient:
    """Get the Stripe client instance with lazy initialization.

    Returns:
        StripeClient: The initialized Stripe client instance.

    Raises:
        RuntimeError: If Stripe secret key is not configured.
    """
    global _stripe_client

    if _stripe_client is not None:
        return _stripe_client

    if not settings.stripe_secret_key:
        error_msg = (
            "Stripe is not configured. Set STRIPE_SECRET_KEY environment variable "
            "to enable Stripe integration."
        )
        logger.error(error_msg)
        raise RuntimeError(error_msg)

    logger.info("Initializing Stripe client")
    _stripe_client = StripeClient(api_key=settings.stripe_secret_key)
    logger.info("Stripe client initialized successfully")

    return _stripe_client


def is_stripe_configured() -> bool:
    """Check if Stripe is properly configured.

    Returns:
        bool: True if Stripe secret key is configured, False otherwise.
    """
    return settings.stripe_configured


def reset_stripe_client() -> None:
    """Reset the Stripe client instance.

    This is primarily used for testing to clear the cached client
    and allow re-initialization with different settings.
    """
    global _stripe_client
    logger.debug("Resetting Stripe client")
    _stripe_client = None
