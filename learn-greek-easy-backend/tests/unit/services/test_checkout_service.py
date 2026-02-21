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


def _make_checkout_mocks(promo_code=None):
    """Helper to build standard mocks for create_checkout_session tests."""
    from unittest.mock import MagicMock
    from uuid import uuid4

    mock_user = MagicMock()
    mock_user.id = uuid4()
    mock_user.email = "test@example.com"
    mock_user.stripe_customer_id = "cus_existing"
    mock_user.supabase_id = str(uuid4())

    mock_session = MagicMock()
    mock_session.id = "cs_test_promo"
    mock_session.url = "https://checkout.stripe.com/pay/cs_test_promo"

    return mock_user, mock_session


@pytest.mark.unit
@pytest.mark.stripe
class TestCreateCheckoutSessionPromoCode:
    """Tests for promo code handling in CheckoutService.create_checkout_session."""

    @pytest.mark.asyncio
    async def test_no_promo_code_allows_promotion_codes(self):
        """When no promo_code is passed, checkout_params should have allow_promotion_codes=True."""
        from unittest.mock import AsyncMock, MagicMock, patch

        mock_db = MagicMock()
        service = CheckoutService(mock_db)
        mock_user, mock_session = _make_checkout_mocks()

        with (
            patch("src.services.checkout_service.billing_cycle_to_price_id") as mock_price,
            patch("src.services.checkout_service.get_stripe_client") as mock_get_client,
            patch("src.services.checkout_service.settings") as mock_settings,
        ):
            mock_price.return_value = "price_monthly_test"
            mock_settings.frontend_url = "https://app.example.com"

            mock_client = MagicMock()
            mock_client.v1.checkout.sessions.create_async = AsyncMock(return_value=mock_session)
            mock_get_client.return_value = mock_client

            await service.create_checkout_session(mock_user, BillingCycle.MONTHLY)

        params = mock_client.v1.checkout.sessions.create_async.call_args.kwargs["params"]
        assert params["allow_promotion_codes"] is True
        assert "discounts" not in params

    @pytest.mark.asyncio
    async def test_resolved_promo_code_sets_discounts(self):
        """When promo_code resolves successfully, checkout_params should have discounts set."""
        from unittest.mock import AsyncMock, MagicMock, patch

        mock_db = MagicMock()
        service = CheckoutService(mock_db)
        mock_user, mock_session = _make_checkout_mocks()

        mock_promo = MagicMock()
        mock_promo.id = "promo_abc123"
        mock_promo_result = MagicMock()
        mock_promo_result.data = [mock_promo]

        with (
            patch("src.services.checkout_service.billing_cycle_to_price_id") as mock_price,
            patch("src.services.checkout_service.get_stripe_client") as mock_get_client,
            patch("src.services.checkout_service.settings") as mock_settings,
        ):
            mock_price.return_value = "price_monthly_test"
            mock_settings.frontend_url = "https://app.example.com"

            mock_client = MagicMock()
            mock_client.v1.promotion_codes.list_async = AsyncMock(return_value=mock_promo_result)
            mock_client.v1.checkout.sessions.create_async = AsyncMock(return_value=mock_session)
            mock_get_client.return_value = mock_client

            await service.create_checkout_session(
                mock_user, BillingCycle.MONTHLY, promo_code="SAVE20"
            )

        params = mock_client.v1.checkout.sessions.create_async.call_args.kwargs["params"]
        assert params["discounts"] == [{"promotion_code": "promo_abc123"}]
        assert "allow_promotion_codes" not in params

    @pytest.mark.asyncio
    async def test_promo_code_not_found_falls_back(self):
        """When promo_code lookup returns empty data, fall back to allow_promotion_codes=True."""
        from unittest.mock import AsyncMock, MagicMock, patch

        mock_db = MagicMock()
        service = CheckoutService(mock_db)
        mock_user, mock_session = _make_checkout_mocks()

        mock_promo_result = MagicMock()
        mock_promo_result.data = []

        with (
            patch("src.services.checkout_service.billing_cycle_to_price_id") as mock_price,
            patch("src.services.checkout_service.get_stripe_client") as mock_get_client,
            patch("src.services.checkout_service.settings") as mock_settings,
        ):
            mock_price.return_value = "price_monthly_test"
            mock_settings.frontend_url = "https://app.example.com"

            mock_client = MagicMock()
            mock_client.v1.promotion_codes.list_async = AsyncMock(return_value=mock_promo_result)
            mock_client.v1.checkout.sessions.create_async = AsyncMock(return_value=mock_session)
            mock_get_client.return_value = mock_client

            await service.create_checkout_session(
                mock_user, BillingCycle.MONTHLY, promo_code="BADCODE"
            )

        params = mock_client.v1.checkout.sessions.create_async.call_args.kwargs["params"]
        assert params["allow_promotion_codes"] is True
        assert "discounts" not in params

    @pytest.mark.asyncio
    async def test_stripe_error_falls_back(self):
        """When promo code lookup raises an exception, fall back to allow_promotion_codes=True and checkout is NOT blocked."""
        from unittest.mock import AsyncMock, MagicMock, patch

        mock_db = MagicMock()
        service = CheckoutService(mock_db)
        mock_user, mock_session = _make_checkout_mocks()

        with (
            patch("src.services.checkout_service.billing_cycle_to_price_id") as mock_price,
            patch("src.services.checkout_service.get_stripe_client") as mock_get_client,
            patch("src.services.checkout_service.settings") as mock_settings,
        ):
            mock_price.return_value = "price_monthly_test"
            mock_settings.frontend_url = "https://app.example.com"

            mock_client = MagicMock()
            mock_client.v1.promotion_codes.list_async = AsyncMock(
                side_effect=Exception("stripe error")
            )
            mock_client.v1.checkout.sessions.create_async = AsyncMock(return_value=mock_session)
            mock_get_client.return_value = mock_client

            # Should NOT raise — checkout proceeds despite promo lookup failure
            result = await service.create_checkout_session(
                mock_user, BillingCycle.MONTHLY, promo_code="ERRCODE"
            )

        assert result == ("https://checkout.stripe.com/pay/cs_test_promo", "cs_test_promo")
        params = mock_client.v1.checkout.sessions.create_async.call_args.kwargs["params"]
        assert params["allow_promotion_codes"] is True
        assert "discounts" not in params

    @pytest.mark.asyncio
    async def test_promo_code_stored_in_metadata(self):
        """When promo_code is provided, it should be stored in checkout session metadata."""
        from unittest.mock import AsyncMock, MagicMock, patch

        mock_db = MagicMock()
        service = CheckoutService(mock_db)
        mock_user, mock_session = _make_checkout_mocks()

        mock_promo = MagicMock()
        mock_promo.id = "promo_xyz"
        mock_promo_result = MagicMock()
        mock_promo_result.data = [mock_promo]

        with (
            patch("src.services.checkout_service.billing_cycle_to_price_id") as mock_price,
            patch("src.services.checkout_service.get_stripe_client") as mock_get_client,
            patch("src.services.checkout_service.settings") as mock_settings,
        ):
            mock_price.return_value = "price_monthly_test"
            mock_settings.frontend_url = "https://app.example.com"

            mock_client = MagicMock()
            mock_client.v1.promotion_codes.list_async = AsyncMock(return_value=mock_promo_result)
            mock_client.v1.checkout.sessions.create_async = AsyncMock(return_value=mock_session)
            mock_get_client.return_value = mock_client

            await service.create_checkout_session(
                mock_user, BillingCycle.MONTHLY, promo_code="SAVE20"
            )

        params = mock_client.v1.checkout.sessions.create_async.call_args.kwargs["params"]
        assert params["metadata"]["promo_code"] == "SAVE20"

    @pytest.mark.asyncio
    async def test_empty_promo_code_treated_as_none(self):
        """Empty string promo_code should not trigger promo resolution and falls back to allow_promotion_codes=True."""
        from unittest.mock import AsyncMock, MagicMock, patch

        mock_db = MagicMock()
        service = CheckoutService(mock_db)
        mock_user, mock_session = _make_checkout_mocks()

        with (
            patch("src.services.checkout_service.billing_cycle_to_price_id") as mock_price,
            patch("src.services.checkout_service.get_stripe_client") as mock_get_client,
            patch("src.services.checkout_service.settings") as mock_settings,
        ):
            mock_price.return_value = "price_monthly_test"
            mock_settings.frontend_url = "https://app.example.com"

            mock_client = MagicMock()
            mock_client.v1.promotion_codes.list_async = AsyncMock()
            mock_client.v1.checkout.sessions.create_async = AsyncMock(return_value=mock_session)
            mock_get_client.return_value = mock_client

            await service.create_checkout_session(mock_user, BillingCycle.MONTHLY, promo_code="")

        # Empty string is falsy — no promo resolution should be attempted
        mock_client.v1.promotion_codes.list_async.assert_not_awaited()
        params = mock_client.v1.checkout.sessions.create_async.call_args.kwargs["params"]
        assert params["allow_promotion_codes"] is True
        assert params["metadata"]["promo_code"] == ""


@pytest.mark.unit
@pytest.mark.stripe
class TestCheckoutSessionCancelUrl:
    """Tests for cancel_url pointing to /upgrade."""

    @pytest.mark.asyncio
    async def test_checkout_session_cancel_url_points_to_upgrade(self):
        """Verify cancel_url equals {frontend_url}/upgrade."""
        from unittest.mock import AsyncMock, MagicMock, patch

        mock_db = MagicMock()
        service = CheckoutService(mock_db)
        mock_user, mock_session = _make_checkout_mocks()

        with (
            patch("src.services.checkout_service.billing_cycle_to_price_id") as mock_price,
            patch("src.services.checkout_service.get_stripe_client") as mock_get_client,
            patch("src.services.checkout_service.settings") as mock_settings,
        ):
            mock_price.return_value = "price_monthly_test"
            mock_settings.frontend_url = "https://app.example.com"

            mock_client = MagicMock()
            mock_client.v1.checkout.sessions.create_async = AsyncMock(return_value=mock_session)
            mock_get_client.return_value = mock_client

            await service.create_checkout_session(mock_user, BillingCycle.MONTHLY)

        params = mock_client.v1.checkout.sessions.create_async.call_args.kwargs["params"]
        assert params["cancel_url"] == "https://app.example.com/upgrade"
