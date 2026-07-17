"""Integration tests for Stripe API connectivity.

Tests verify that Stripe client can reach the Stripe API and retrieve
account information, confirming proper SDK configuration and network access.

These tests run in the `stripe_live` lane against a REAL Stripe test-mode
account (never mocked). The lane's autouse guard fixture
(`tests/integration/conftest.py`) hard-fails -- rather than skipping -- if
`STRIPE_SECRET_KEY` is missing or not a test-mode key, so this file no
longer needs its own conditional skip.
"""

import pytest

from src.core.stripe import get_stripe_client, reset_stripe_client


@pytest.fixture(autouse=True)
def cleanup_stripe():
    """Reset Stripe client after each test."""
    yield
    reset_stripe_client()


@pytest.mark.integration
@pytest.mark.stripe_live
@pytest.mark.asyncio
class TestStripeIntegration:
    """Integration tests for Stripe API connectivity."""

    async def test_stripe_api_connectivity(self):
        """Integration test: verify Stripe API is reachable.

        Runs in the stripe_live lane; the lane's guard fixture ensures this
        only executes with a configured Stripe test-mode key.
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
