"""Unit tests for Stripe client integration.

Tests cover:
- get_stripe_client: Client initialization, caching, error handling
- is_stripe_configured: Configuration status checks
- reset_stripe_client: Client reset and re-initialization

Acceptance Criteria tested:
- AC #1: Client initializes with correct API key from config
- AC #2: Clear error when stripe_secret_key not set
- AC #3: is_stripe_configured returns True/False correctly
- AC #4-6: Already tested in test_health_service.py
- AC #10-11: Already tested in test_health_service.py
- AC #13: Already tested in test_health_service.py
"""

from unittest.mock import patch

import pytest
from stripe import StripeClient

import src.core.stripe as stripe_module
from src.core.stripe import get_stripe_client, is_stripe_configured, reset_stripe_client


@pytest.fixture(autouse=True)
def reset_stripe_state():
    """Reset Stripe module state before and after each test."""
    stripe_module._stripe_client = None
    yield
    stripe_module._stripe_client = None


@pytest.mark.unit
@pytest.mark.stripe
class TestGetStripeClient:
    """Tests for get_stripe_client function."""

    @patch("src.core.stripe.settings")
    def test_initializes_with_correct_api_key(self, mock_settings):
        """Test that get_stripe_client initializes with the correct API key."""
        mock_settings.stripe_secret_key = "sk_test_123"
        client = get_stripe_client()
        assert isinstance(client, StripeClient)
        assert client._requestor.api_key == "sk_test_123"

    @patch("src.core.stripe.settings")
    def test_caches_client_instance(self, mock_settings):
        """Test that calling get_stripe_client twice returns the same instance."""
        mock_settings.stripe_secret_key = "sk_test_123"
        client1 = get_stripe_client()
        client2 = get_stripe_client()
        assert client1 is client2

    @patch("src.core.stripe.settings")
    def test_raises_runtime_error_when_not_configured(self, mock_settings):
        """Test that get_stripe_client raises RuntimeError when stripe_secret_key is None."""
        mock_settings.stripe_secret_key = None
        with pytest.raises(RuntimeError, match="Stripe is not configured"):
            get_stripe_client()

    @patch("src.core.stripe.settings")
    def test_raises_runtime_error_with_clear_message(self, mock_settings):
        """Test that the RuntimeError message is clear and helpful."""
        mock_settings.stripe_secret_key = None
        with pytest.raises(RuntimeError, match="Set STRIPE_SECRET_KEY environment variable"):
            get_stripe_client()


@pytest.mark.unit
@pytest.mark.stripe
class TestIsStripeConfigured:
    """Tests for is_stripe_configured function."""

    @patch("src.core.stripe.settings")
    def test_returns_true_when_configured(self, mock_settings):
        """Test that is_stripe_configured returns True when stripe_secret_key is set."""
        mock_settings.stripe_configured = True
        assert is_stripe_configured() is True

    @patch("src.core.stripe.settings")
    def test_returns_false_when_not_configured(self, mock_settings):
        """Test that is_stripe_configured returns False when stripe_secret_key is None."""
        mock_settings.stripe_configured = False
        assert is_stripe_configured() is False


@pytest.mark.unit
@pytest.mark.stripe
class TestResetStripeClient:
    """Tests for reset_stripe_client function."""

    @patch("src.core.stripe.settings")
    def test_clears_cached_client(self, mock_settings):
        """Test that reset_stripe_client clears the cached client."""
        mock_settings.stripe_secret_key = "sk_test_123"
        # Create a client (cached)
        get_stripe_client()
        assert stripe_module._stripe_client is not None

        # Reset should clear the cache
        reset_stripe_client()
        assert stripe_module._stripe_client is None

    @patch("src.core.stripe.settings")
    def test_allows_reinitialization_after_reset(self, mock_settings):
        """Test that a new client can be created after reset."""
        mock_settings.stripe_secret_key = "sk_test_123"
        client1 = get_stripe_client()
        reset_stripe_client()

        mock_settings.stripe_secret_key = "sk_test_456"
        client2 = get_stripe_client()

        assert client1 is not client2
        assert client2._requestor.api_key == "sk_test_456"

    def test_reset_when_no_client_exists(self):
        """Test that reset_stripe_client doesn't error when no client exists."""
        assert stripe_module._stripe_client is None
        reset_stripe_client()  # Should not raise
        assert stripe_module._stripe_client is None

    @patch("src.core.stripe.settings")
    def test_reset_idempotent(self, mock_settings):
        """Test that calling reset multiple times is safe."""
        mock_settings.stripe_secret_key = "sk_test_123"
        get_stripe_client()

        reset_stripe_client()
        reset_stripe_client()
        reset_stripe_client()

        assert stripe_module._stripe_client is None
