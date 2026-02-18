"""Integration tests for Stripe API connectivity.

Tests verify that Stripe client can reach the Stripe API and retrieve
account information, confirming proper SDK configuration and network access.

These tests require STRIPE_SECRET_KEY to be set in the environment.
They will be skipped in CI unless Stripe test credentials are configured.
"""

import os

import pytest

from src.core.stripe import get_stripe_client, reset_stripe_client


@pytest.fixture(autouse=True)
def cleanup_stripe():
    """Reset Stripe client after each test."""
    yield
    reset_stripe_client()


@pytest.mark.integration
@pytest.mark.stripe
@pytest.mark.asyncio
@pytest.mark.skipif(
    not os.getenv("STRIPE_SECRET_KEY"),
    reason="STRIPE_SECRET_KEY environment variable not set",
)
class TestStripeIntegration:
    """Integration tests for Stripe API connectivity."""

    async def test_stripe_api_connectivity(self):
        """Integration test: verify Stripe API is reachable.

        This test requires STRIPE_SECRET_KEY to be set in the environment.
        It will be skipped in CI unless Stripe test credentials are configured.
        """
        client = get_stripe_client()

        # Call Stripe API to verify connectivity
        # Use the v1 namespace to match production code (avoid deprecation warnings)
        account = await client.v1.accounts.retrieve_current_async()

        # Verify we got a valid account object
        assert account is not None
        assert hasattr(account, "id")
        assert account.id is not None
        assert isinstance(account.id, str)

        # Verify it's a test account (safety check)
        # Stripe test accounts start with "acct_" but we just verify the format
        assert account.id.startswith("acct_")
