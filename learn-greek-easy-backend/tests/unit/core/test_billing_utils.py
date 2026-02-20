"""Unit tests for billing utility functions.

Tests cover:
- price_id_to_billing_cycle: price ID to BillingCycle mapping
- stripe_status_to_subscription_status: Stripe status to SubscriptionStatus mapping
"""

from unittest.mock import patch

import pytest

from src.core.billing_utils import (
    billing_cycle_to_price_id,
    price_id_to_billing_cycle,
    stripe_status_to_subscription_status,
)
from src.db.models import BillingCycle, SubscriptionStatus


@pytest.mark.unit
@pytest.mark.stripe
class TestPriceIdToBillingCycle:
    """Tests for price_id_to_billing_cycle function."""

    @patch("src.core.billing_utils.settings")
    def test_monthly_price_id_maps_to_monthly(self, mock_settings):
        """Monthly price ID should map to BillingCycle.MONTHLY."""
        mock_settings.stripe_price_premium_monthly = "price_monthly_123"
        mock_settings.stripe_price_premium_quarterly = "price_quarterly_456"
        mock_settings.stripe_price_premium_semi_annual = "price_semi_789"

        result = price_id_to_billing_cycle("price_monthly_123")

        assert result == BillingCycle.MONTHLY

    @patch("src.core.billing_utils.settings")
    def test_quarterly_price_id_maps_to_quarterly(self, mock_settings):
        """Quarterly price ID should map to BillingCycle.QUARTERLY."""
        mock_settings.stripe_price_premium_monthly = "price_monthly_123"
        mock_settings.stripe_price_premium_quarterly = "price_quarterly_456"
        mock_settings.stripe_price_premium_semi_annual = "price_semi_789"

        result = price_id_to_billing_cycle("price_quarterly_456")

        assert result == BillingCycle.QUARTERLY

    @patch("src.core.billing_utils.settings")
    def test_semi_annual_price_id_maps_to_semi_annual(self, mock_settings):
        """Semi-annual price ID should map to BillingCycle.SEMI_ANNUAL."""
        mock_settings.stripe_price_premium_monthly = "price_monthly_123"
        mock_settings.stripe_price_premium_quarterly = "price_quarterly_456"
        mock_settings.stripe_price_premium_semi_annual = "price_semi_789"

        result = price_id_to_billing_cycle("price_semi_789")

        assert result == BillingCycle.SEMI_ANNUAL

    @patch("src.core.billing_utils.settings")
    def test_unknown_price_id_returns_none(self, mock_settings):
        """Unknown price ID should return None."""
        mock_settings.stripe_price_premium_monthly = "price_monthly_123"
        mock_settings.stripe_price_premium_quarterly = "price_quarterly_456"
        mock_settings.stripe_price_premium_semi_annual = "price_semi_789"

        result = price_id_to_billing_cycle("price_unknown_999")

        assert result is None

    @patch("src.core.billing_utils.settings")
    def test_none_price_id_returns_none(self, mock_settings):
        """None price ID should return None without hitting settings."""
        mock_settings.stripe_price_premium_monthly = "price_monthly_123"
        mock_settings.stripe_price_premium_quarterly = "price_quarterly_456"
        mock_settings.stripe_price_premium_semi_annual = "price_semi_789"

        result = price_id_to_billing_cycle(None)

        assert result is None

    @patch("src.core.billing_utils.settings")
    def test_empty_string_price_id_returns_none(self, mock_settings):
        """Empty string price ID should return None."""
        mock_settings.stripe_price_premium_monthly = "price_monthly_123"
        mock_settings.stripe_price_premium_quarterly = "price_quarterly_456"
        mock_settings.stripe_price_premium_semi_annual = "price_semi_789"

        result = price_id_to_billing_cycle("")

        assert result is None


@pytest.mark.unit
@pytest.mark.stripe
class TestStripeStatusToSubscriptionStatus:
    """Tests for stripe_status_to_subscription_status function."""

    def test_trialing_maps_to_trialing(self):
        """'trialing' should map to SubscriptionStatus.TRIALING."""
        result = stripe_status_to_subscription_status("trialing")
        assert result == SubscriptionStatus.TRIALING

    def test_active_maps_to_active(self):
        """'active' should map to SubscriptionStatus.ACTIVE."""
        result = stripe_status_to_subscription_status("active")
        assert result == SubscriptionStatus.ACTIVE

    def test_past_due_maps_to_past_due(self):
        """'past_due' should map to SubscriptionStatus.PAST_DUE."""
        result = stripe_status_to_subscription_status("past_due")
        assert result == SubscriptionStatus.PAST_DUE

    def test_canceled_maps_to_canceled(self):
        """'canceled' should map to SubscriptionStatus.CANCELED."""
        result = stripe_status_to_subscription_status("canceled")
        assert result == SubscriptionStatus.CANCELED

    def test_incomplete_maps_to_incomplete(self):
        """'incomplete' should map to SubscriptionStatus.INCOMPLETE."""
        result = stripe_status_to_subscription_status("incomplete")
        assert result == SubscriptionStatus.INCOMPLETE

    def test_unpaid_maps_to_unpaid(self):
        """'unpaid' should map to SubscriptionStatus.UNPAID."""
        result = stripe_status_to_subscription_status("unpaid")
        assert result == SubscriptionStatus.UNPAID

    def test_incomplete_expired_returns_none(self):
        """'incomplete_expired' is a known unmapped status and should return None."""
        result = stripe_status_to_subscription_status("incomplete_expired")
        assert result is None

    def test_paused_returns_none(self):
        """'paused' is a known unmapped status and should return None."""
        result = stripe_status_to_subscription_status("paused")
        assert result is None

    def test_unknown_status_returns_none(self):
        """Unknown status strings should return None."""
        result = stripe_status_to_subscription_status("totally_unknown")
        assert result is None

    def test_empty_string_returns_none(self):
        """Empty string should return None."""
        result = stripe_status_to_subscription_status("")
        assert result is None

    def test_none_returns_none(self):
        """None input should return None."""
        result = stripe_status_to_subscription_status(None)
        assert result is None


@pytest.mark.unit
@pytest.mark.stripe
class TestBillingCycleToPriceId:
    """Tests for billing_cycle_to_price_id."""

    @patch("src.core.billing_utils.settings")
    def test_monthly_returns_monthly_price_id(self, mock_settings):
        mock_settings.stripe_price_premium_monthly = "price_monthly_123"
        mock_settings.stripe_price_premium_quarterly = "price_quarterly_456"
        mock_settings.stripe_price_premium_semi_annual = "price_semi_789"

        result = billing_cycle_to_price_id(BillingCycle.MONTHLY)
        assert result == "price_monthly_123"

    @patch("src.core.billing_utils.settings")
    def test_quarterly_returns_quarterly_price_id(self, mock_settings):
        mock_settings.stripe_price_premium_monthly = "price_monthly_123"
        mock_settings.stripe_price_premium_quarterly = "price_quarterly_456"
        mock_settings.stripe_price_premium_semi_annual = "price_semi_789"

        result = billing_cycle_to_price_id(BillingCycle.QUARTERLY)
        assert result == "price_quarterly_456"

    @patch("src.core.billing_utils.settings")
    def test_semi_annual_returns_semi_annual_price_id(self, mock_settings):
        mock_settings.stripe_price_premium_monthly = "price_monthly_123"
        mock_settings.stripe_price_premium_quarterly = "price_quarterly_456"
        mock_settings.stripe_price_premium_semi_annual = "price_semi_789"

        result = billing_cycle_to_price_id(BillingCycle.SEMI_ANNUAL)
        assert result == "price_semi_789"

    @patch("src.core.billing_utils.settings")
    def test_lifetime_returns_none(self, mock_settings):
        mock_settings.stripe_price_premium_monthly = "price_monthly_123"
        mock_settings.stripe_price_premium_quarterly = "price_quarterly_456"
        mock_settings.stripe_price_premium_semi_annual = "price_semi_789"

        result = billing_cycle_to_price_id(BillingCycle.LIFETIME)
        assert result is None

    @patch("src.core.billing_utils.settings")
    def test_unconfigured_setting_returns_none(self, mock_settings):
        mock_settings.stripe_price_premium_monthly = None
        mock_settings.stripe_price_premium_quarterly = "price_quarterly_456"
        mock_settings.stripe_price_premium_semi_annual = "price_semi_789"

        result = billing_cycle_to_price_id(BillingCycle.MONTHLY)
        assert result is None
