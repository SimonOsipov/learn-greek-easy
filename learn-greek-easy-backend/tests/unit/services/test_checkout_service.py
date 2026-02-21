from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from src.db.models import BillingCycle, SubscriptionStatus, SubscriptionTier, User
from src.services.checkout_service import CheckoutService


def _make_user(**overrides) -> MagicMock:
    """Create a mock User with sensible defaults."""
    defaults = {
        "id": 1,
        "email": "test@example.com",
        "subscription_tier": SubscriptionTier.FREE,
        "subscription_status": SubscriptionStatus.NONE,
        "subscription_created_at": None,
        "subscription_resubscribed_at": None,
        "billing_cycle": None,
        "stripe_customer_id": None,
        "stripe_subscription_id": None,
        "trial_start_date": None,
        "trial_end_date": None,
    }
    defaults.update(overrides)
    user = MagicMock(spec=User)
    for key, value in defaults.items():
        setattr(user, key, value)
    return user


@pytest.mark.unit
@pytest.mark.stripe
class TestActivatePremiumSubscription:
    """Tests for CheckoutService.activate_premium_subscription."""

    @pytest.mark.asyncio
    async def test_activates_new_subscription(self):
        user = _make_user()
        db = MagicMock()
        service = CheckoutService(db)

        result = await service.activate_premium_subscription(
            user=user,
            stripe_customer_id="cus_123",
            stripe_subscription_id="sub_456",
            billing_cycle=BillingCycle.MONTHLY,
        )

        assert result == "activated"
        assert user.stripe_customer_id == "cus_123"
        assert user.stripe_subscription_id == "sub_456"
        assert user.subscription_tier == SubscriptionTier.PREMIUM
        assert user.subscription_status == SubscriptionStatus.ACTIVE
        assert user.billing_cycle == BillingCycle.MONTHLY
        assert user.subscription_created_at is not None
        assert user.trial_start_date is None
        assert user.trial_end_date is None

    @pytest.mark.asyncio
    async def test_idempotent_returns_already_active(self):
        user = _make_user(
            stripe_subscription_id="sub_456",
            subscription_tier=SubscriptionTier.PREMIUM,
            subscription_status=SubscriptionStatus.ACTIVE,
        )
        db = MagicMock()
        service = CheckoutService(db)

        result = await service.activate_premium_subscription(
            user=user,
            stripe_customer_id="cus_123",
            stripe_subscription_id="sub_456",
            billing_cycle=BillingCycle.MONTHLY,
        )

        assert result == "already_active"

    @pytest.mark.asyncio
    async def test_clears_trial_dates(self):
        trial_start = datetime(2024, 1, 1, tzinfo=timezone.utc)
        trial_end = datetime(2024, 1, 8, tzinfo=timezone.utc)
        user = _make_user(
            trial_start_date=trial_start,
            trial_end_date=trial_end,
        )
        db = MagicMock()
        service = CheckoutService(db)

        result = await service.activate_premium_subscription(
            user=user,
            stripe_customer_id="cus_123",
            stripe_subscription_id="sub_456",
            billing_cycle=BillingCycle.MONTHLY,
        )

        assert result == "activated"
        assert user.trial_start_date is None
        assert user.trial_end_date is None

    @pytest.mark.asyncio
    async def test_sets_resubscribed_at_for_canceled_user(self):
        user = _make_user(
            subscription_status=SubscriptionStatus.CANCELED,
        )
        db = MagicMock()
        service = CheckoutService(db)

        result = await service.activate_premium_subscription(
            user=user,
            stripe_customer_id="cus_123",
            stripe_subscription_id="sub_456",
            billing_cycle=BillingCycle.MONTHLY,
        )

        assert result == "activated"
        assert user.subscription_resubscribed_at is not None

    @pytest.mark.asyncio
    async def test_does_not_set_resubscribed_at_for_new_user(self):
        user = _make_user(
            subscription_status=SubscriptionStatus.NONE,
        )
        db = MagicMock()
        service = CheckoutService(db)

        await service.activate_premium_subscription(
            user=user,
            stripe_customer_id="cus_123",
            stripe_subscription_id="sub_456",
            billing_cycle=BillingCycle.MONTHLY,
        )

        assert user.subscription_resubscribed_at is None

    @pytest.mark.asyncio
    async def test_sets_created_at_only_when_none(self):
        existing_date = datetime(2023, 6, 1, tzinfo=timezone.utc)
        user = _make_user(
            subscription_created_at=existing_date,
        )
        db = MagicMock()
        service = CheckoutService(db)

        await service.activate_premium_subscription(
            user=user,
            stripe_customer_id="cus_123",
            stripe_subscription_id="sub_456",
            billing_cycle=BillingCycle.MONTHLY,
        )

        assert user.subscription_created_at == existing_date

    @pytest.mark.asyncio
    async def test_billing_cycle_not_set_when_none(self):
        user = _make_user(billing_cycle=BillingCycle.QUARTERLY)
        db = MagicMock()
        service = CheckoutService(db)

        await service.activate_premium_subscription(
            user=user,
            stripe_customer_id="cus_123",
            stripe_subscription_id="sub_456",
            billing_cycle=None,
        )

        # Should remain QUARTERLY since billing_cycle param was None
        assert user.billing_cycle == BillingCycle.QUARTERLY


@pytest.mark.unit
@pytest.mark.stripe
class TestCheckoutRaceConditions:
    """Verify idempotency when verify and webhook race to activate subscription."""

    @pytest.mark.asyncio
    async def test_verify_then_webhook_is_idempotent(self) -> None:
        """First call activates, second call with same sub_id returns already_active."""
        user = _make_user()
        db = MagicMock()
        service = CheckoutService(db)

        result1 = await service.activate_premium_subscription(
            user=user,
            stripe_customer_id="cus_123",
            stripe_subscription_id="sub_456",
            billing_cycle=BillingCycle.MONTHLY,
        )
        assert result1 == "activated"

        # Second call (e.g., webhook fires after verify already activated)
        result2 = await service.activate_premium_subscription(
            user=user,
            stripe_customer_id="cus_123",
            stripe_subscription_id="sub_456",
            billing_cycle=BillingCycle.MONTHLY,
        )
        assert result2 == "already_active"

    @pytest.mark.asyncio
    async def test_webhook_then_verify_returns_already_active(self) -> None:
        """Webhook activates first; subsequent verify call returns already_active."""
        # Pre-set user as if webhook already activated
        user = _make_user(
            stripe_subscription_id="sub_456",
            subscription_tier=SubscriptionTier.PREMIUM,
            subscription_status=SubscriptionStatus.ACTIVE,
        )
        db = MagicMock()
        service = CheckoutService(db)

        result = await service.activate_premium_subscription(
            user=user,
            stripe_customer_id="cus_123",
            stripe_subscription_id="sub_456",
            billing_cycle=BillingCycle.MONTHLY,
        )
        assert result == "already_active"
