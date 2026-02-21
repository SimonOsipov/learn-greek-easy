"""Unit tests for /api/v1/billing endpoints.

Tests cover:
- POST /api/v1/billing/checkout/premium endpoint behavior
- Stripe not configured (400)
- Already premium user (403)
- Successful checkout session creation (200)
- Stripe customer get-or-create logic
- Trialing users can proceed to checkout
- GET /api/v1/billing/status endpoint behavior
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient

from src.db.models import BillingCycle, SubscriptionStatus, SubscriptionTier, User

# =============================================================================
# Helper Functions
# =============================================================================


def create_mock_user(
    subscription_tier: SubscriptionTier = SubscriptionTier.FREE,
    subscription_status: SubscriptionStatus = SubscriptionStatus.NONE,
    stripe_customer_id: str | None = None,
    supabase_id: str | None = None,
    trial_end_date: datetime | None = None,
    billing_cycle: BillingCycle | None = None,
) -> MagicMock:
    """Create a mock User object for billing tests."""
    mock = MagicMock(spec=User)
    mock.id = uuid4()
    mock.email = "test@example.com"
    mock.subscription_tier = subscription_tier
    mock.subscription_status = subscription_status
    mock.stripe_customer_id = stripe_customer_id
    mock.supabase_id = supabase_id or str(uuid4())
    mock.trial_end_date = trial_end_date
    mock.billing_cycle = billing_cycle
    return mock


# =============================================================================
# TestCheckoutEndpoint - Tests for POST /api/v1/billing/checkout/premium
# =============================================================================


class TestCheckoutEndpoint:
    """Unit tests for POST /api/v1/billing/checkout/premium endpoint."""

    @pytest.mark.asyncio
    async def test_returns_400_when_stripe_not_configured(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that 400 is returned when Stripe is not configured."""
        with patch("src.api.v1.billing.settings") as mock_settings:
            mock_settings.stripe_configured = False

            response = await client.post(
                "/api/v1/billing/checkout/premium",
                json={"billing_cycle": "monthly"},
                headers=auth_headers,
            )

        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "BILLING_NOT_CONFIGURED"

    @pytest.mark.asyncio
    async def test_returns_403_when_user_is_premium_active(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user: User,
        db_session,
    ):
        """Test that 403 is returned when user already has an active premium subscription."""
        # Set the test_user to PREMIUM/ACTIVE in the database
        test_user.subscription_tier = SubscriptionTier.PREMIUM
        test_user.subscription_status = SubscriptionStatus.ACTIVE
        await db_session.flush()

        with patch("src.api.v1.billing.settings") as mock_settings:
            mock_settings.stripe_configured = True

            response = await client.post(
                "/api/v1/billing/checkout/premium",
                json={"billing_cycle": "monthly"},
                headers=auth_headers,
            )

        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "ALREADY_PREMIUM"

    @pytest.mark.asyncio
    async def test_returns_403_when_user_is_premium_past_due(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user: User,
        db_session,
    ):
        """Test that 403 is returned when user has premium subscription in past_due state."""
        # Set the test_user to PREMIUM/PAST_DUE in the database
        test_user.subscription_tier = SubscriptionTier.PREMIUM
        test_user.subscription_status = SubscriptionStatus.PAST_DUE
        await db_session.flush()

        with patch("src.api.v1.billing.settings") as mock_settings:
            mock_settings.stripe_configured = True

            response = await client.post(
                "/api/v1/billing/checkout/premium",
                json={"billing_cycle": "monthly"},
                headers=auth_headers,
            )

        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "ALREADY_PREMIUM"

    @pytest.mark.asyncio
    async def test_returns_200_with_checkout_url_for_free_user(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that 200 with checkout_url and session_id is returned for a free user."""
        with (
            patch("src.api.v1.billing.settings") as mock_settings,
            patch("src.api.v1.billing.get_current_user") as mock_get_user,
            patch("src.api.v1.billing.CheckoutService") as mock_service_class,
            patch("src.api.v1.billing.capture_event"),
        ):
            mock_settings.stripe_configured = True
            mock_user = create_mock_user(
                subscription_tier=SubscriptionTier.FREE,
                subscription_status=SubscriptionStatus.NONE,
            )
            mock_get_user.return_value = mock_user

            mock_service = AsyncMock()
            mock_service.create_checkout_session.return_value = (
                "https://checkout.stripe.com/pay/cs_test_abc123",
                "cs_test_abc123",
            )
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/billing/checkout/premium",
                json={"billing_cycle": "monthly"},
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["checkout_url"] == "https://checkout.stripe.com/pay/cs_test_abc123"
        assert data["session_id"] == "cs_test_abc123"

    @pytest.mark.asyncio
    async def test_trialing_user_can_proceed_to_checkout(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that a trialing user (not yet PREMIUM) can create a checkout session."""
        with (
            patch("src.api.v1.billing.settings") as mock_settings,
            patch("src.api.v1.billing.get_current_user") as mock_get_user,
            patch("src.api.v1.billing.CheckoutService") as mock_service_class,
            patch("src.api.v1.billing.capture_event"),
        ):
            mock_settings.stripe_configured = True
            mock_user = create_mock_user(
                subscription_tier=SubscriptionTier.FREE,
                subscription_status=SubscriptionStatus.TRIALING,
            )
            mock_get_user.return_value = mock_user

            mock_service = AsyncMock()
            mock_service.create_checkout_session.return_value = (
                "https://checkout.stripe.com/pay/cs_test_trial",
                "cs_test_trial",
            )
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/billing/checkout/premium",
                json={"billing_cycle": "quarterly"},
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["checkout_url"] == "https://checkout.stripe.com/pay/cs_test_trial"
        assert data["session_id"] == "cs_test_trial"

    @pytest.mark.asyncio
    async def test_returns_422_for_invalid_billing_cycle(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that 422 is returned for an invalid billing_cycle value."""
        with patch("src.api.v1.billing.settings") as mock_settings:
            mock_settings.stripe_configured = True

            response = await client.post(
                "/api/v1/billing/checkout/premium",
                json={"billing_cycle": "invalid_cycle"},
                headers=auth_headers,
            )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_returns_401_when_unauthenticated(
        self,
        client: AsyncClient,
    ):
        """Test that 401 is returned for unauthenticated requests."""
        response = await client.post(
            "/api/v1/billing/checkout/premium",
            json={"billing_cycle": "monthly"},
        )

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_checkout_service_called_with_correct_billing_cycle(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that CheckoutService.create_checkout_session is called with the correct billing cycle."""
        with (
            patch("src.api.v1.billing.settings") as mock_settings,
            patch("src.api.v1.billing.get_current_user") as mock_get_user,
            patch("src.api.v1.billing.CheckoutService") as mock_service_class,
            patch("src.api.v1.billing.capture_event"),
        ):
            mock_settings.stripe_configured = True
            mock_user = create_mock_user()
            mock_get_user.return_value = mock_user

            mock_service = AsyncMock()
            mock_service.create_checkout_session.return_value = (
                "https://checkout.stripe.com/pay/cs_semi",
                "cs_semi",
            )
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/billing/checkout/premium",
                json={"billing_cycle": "semi_annual"},
                headers=auth_headers,
            )

        assert response.status_code == 200
        mock_service.create_checkout_session.assert_awaited_once()
        call_args = mock_service.create_checkout_session.call_args
        assert call_args.args[1] == BillingCycle.SEMI_ANNUAL

    @pytest.mark.asyncio
    async def test_checkout_accepts_promo_code(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that the checkout endpoint accepts an optional promo_code field."""
        with (
            patch("src.api.v1.billing.settings") as mock_settings,
            patch("src.api.v1.billing.get_current_user") as mock_get_user,
            patch("src.api.v1.billing.CheckoutService") as mock_service_class,
            patch("src.api.v1.billing.capture_event"),
        ):
            mock_settings.stripe_configured = True
            mock_user = create_mock_user(
                subscription_tier=SubscriptionTier.FREE,
                subscription_status=SubscriptionStatus.NONE,
            )
            mock_get_user.return_value = mock_user

            mock_service = AsyncMock()
            mock_service.create_checkout_session.return_value = (
                "https://checkout.stripe.com/pay/cs_promo",
                "cs_promo",
            )
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/billing/checkout/premium",
                json={"billing_cycle": "monthly", "promo_code": "SAVE20"},
                headers=auth_headers,
            )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_checkout_backward_compat_no_promo(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that the checkout endpoint remains compatible when promo_code is omitted."""
        with (
            patch("src.api.v1.billing.settings") as mock_settings,
            patch("src.api.v1.billing.get_current_user") as mock_get_user,
            patch("src.api.v1.billing.CheckoutService") as mock_service_class,
            patch("src.api.v1.billing.capture_event"),
        ):
            mock_settings.stripe_configured = True
            mock_user = create_mock_user(
                subscription_tier=SubscriptionTier.FREE,
                subscription_status=SubscriptionStatus.NONE,
            )
            mock_get_user.return_value = mock_user

            mock_service = AsyncMock()
            mock_service.create_checkout_session.return_value = (
                "https://checkout.stripe.com/pay/cs_nopromo",
                "cs_nopromo",
            )
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/billing/checkout/premium",
                json={"billing_cycle": "monthly"},
                headers=auth_headers,
            )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_checkout_promo_code_max_length(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that 422 is returned when promo_code exceeds 50 characters."""
        with patch("src.api.v1.billing.settings") as mock_settings:
            mock_settings.stripe_configured = True

            response = await client.post(
                "/api/v1/billing/checkout/premium",
                json={"billing_cycle": "monthly", "promo_code": "x" * 51},
                headers=auth_headers,
            )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_checkout_passes_promo_code_to_service(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that promo_code is passed through to the CheckoutService."""
        with (
            patch("src.api.v1.billing.settings") as mock_settings,
            patch("src.api.v1.billing.get_current_user") as mock_get_user,
            patch("src.api.v1.billing.CheckoutService") as mock_service_class,
            patch("src.api.v1.billing.capture_event"),
        ):
            mock_settings.stripe_configured = True
            mock_user = create_mock_user(
                subscription_tier=SubscriptionTier.FREE,
                subscription_status=SubscriptionStatus.NONE,
            )
            mock_get_user.return_value = mock_user

            mock_service = AsyncMock()
            mock_service.create_checkout_session.return_value = (
                "https://checkout.stripe.com/pay/cs_promo",
                "cs_promo",
            )
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/billing/checkout/premium",
                json={"billing_cycle": "monthly", "promo_code": "SAVE20"},
                headers=auth_headers,
            )

        assert response.status_code == 200
        assert mock_service.create_checkout_session.call_args.kwargs["promo_code"] == "SAVE20"

    @pytest.mark.asyncio
    async def test_create_checkout_posthog_has_promo_code_true(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that PostHog event has has_promo_code=True and promo_code set when provided."""
        with (
            patch("src.api.v1.billing.settings") as mock_settings,
            patch("src.api.v1.billing.get_current_user") as mock_get_user,
            patch("src.api.v1.billing.CheckoutService") as mock_service_class,
            patch("src.api.v1.billing.capture_event") as mock_capture,
        ):
            mock_settings.stripe_configured = True
            mock_user = create_mock_user(
                subscription_tier=SubscriptionTier.FREE,
                subscription_status=SubscriptionStatus.NONE,
            )
            mock_get_user.return_value = mock_user

            mock_service = AsyncMock()
            mock_service.create_checkout_session.return_value = (
                "https://checkout.stripe.com/pay/cs_promo",
                "cs_promo",
            )
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/billing/checkout/premium",
                json={"billing_cycle": "monthly", "promo_code": "SAVE20"},
                headers=auth_headers,
            )

        assert response.status_code == 200
        assert mock_capture.call_args.kwargs["properties"]["has_promo_code"] is True
        assert mock_capture.call_args.kwargs["properties"]["promo_code"] == "SAVE20"

    @pytest.mark.asyncio
    async def test_create_checkout_posthog_has_promo_code_false(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that PostHog event has has_promo_code=False and promo_code=None when not provided."""
        with (
            patch("src.api.v1.billing.settings") as mock_settings,
            patch("src.api.v1.billing.get_current_user") as mock_get_user,
            patch("src.api.v1.billing.CheckoutService") as mock_service_class,
            patch("src.api.v1.billing.capture_event") as mock_capture,
        ):
            mock_settings.stripe_configured = True
            mock_user = create_mock_user(
                subscription_tier=SubscriptionTier.FREE,
                subscription_status=SubscriptionStatus.NONE,
            )
            mock_get_user.return_value = mock_user

            mock_service = AsyncMock()
            mock_service.create_checkout_session.return_value = (
                "https://checkout.stripe.com/pay/cs_nopromo",
                "cs_nopromo",
            )
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/billing/checkout/premium",
                json={"billing_cycle": "monthly"},
                headers=auth_headers,
            )

        assert response.status_code == 200
        assert mock_capture.call_args.kwargs["properties"]["has_promo_code"] is False
        assert mock_capture.call_args.kwargs["properties"]["promo_code"] is None

    @pytest.mark.asyncio
    async def test_trialing_user_checkout_with_promo(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Trialing user (FREE tier, TRIALING status) can checkout with promo_code — returns 200."""
        with (
            patch("src.api.v1.billing.settings") as mock_settings,
            patch("src.api.v1.billing.get_current_user") as mock_get_user,
            patch("src.api.v1.billing.CheckoutService") as mock_service_class,
            patch("src.api.v1.billing.capture_event"),
        ):
            mock_settings.stripe_configured = True
            mock_user = create_mock_user(
                subscription_tier=SubscriptionTier.FREE,
                subscription_status=SubscriptionStatus.TRIALING,
            )
            mock_get_user.return_value = mock_user

            mock_service = AsyncMock()
            mock_service.create_checkout_session.return_value = (
                "https://checkout.stripe.com/pay/cs_test_abc",
                "cs_test_abc",
            )
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/billing/checkout/premium",
                json={"billing_cycle": "monthly", "promo_code": "WELCOME20"},
                headers=auth_headers,
            )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_expired_trial_user_checkout_with_promo(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """User with expired trial can checkout with promo_code — returns 200."""
        with (
            patch("src.api.v1.billing.settings") as mock_settings,
            patch("src.api.v1.billing.get_current_user") as mock_get_user,
            patch("src.api.v1.billing.CheckoutService") as mock_service_class,
            patch("src.api.v1.billing.capture_event"),
        ):
            mock_settings.stripe_configured = True
            mock_user = create_mock_user(
                subscription_tier=SubscriptionTier.FREE,
                subscription_status=SubscriptionStatus.TRIALING,
            )
            mock_user.trial_end_date = datetime(2025, 1, 1, tzinfo=timezone.utc)
            mock_get_user.return_value = mock_user

            mock_service = AsyncMock()
            mock_service.create_checkout_session.return_value = (
                "https://checkout.stripe.com/pay/cs_test_def",
                "cs_test_def",
            )
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/billing/checkout/premium",
                json={"billing_cycle": "monthly", "promo_code": "WELCOME20"},
                headers=auth_headers,
            )

        assert response.status_code == 200


# =============================================================================
# TestCheckoutServiceCustomerLogic - Tests for get-or-create customer logic
# =============================================================================


class TestCheckoutServiceCustomerLogic:
    """Unit tests for CheckoutService.create_checkout_session customer handling."""

    @pytest.mark.asyncio
    async def test_creates_stripe_customer_when_none_exists(self):
        """Test that a new Stripe customer is created if user has no stripe_customer_id."""
        from unittest.mock import AsyncMock, MagicMock, patch

        from src.services.checkout_service import CheckoutService

        mock_db = MagicMock()
        service = CheckoutService(mock_db)

        mock_user = MagicMock(spec=User)
        mock_user.id = uuid4()
        mock_user.email = "new@example.com"
        mock_user.stripe_customer_id = None
        mock_user.supabase_id = str(uuid4())

        mock_customer = MagicMock()
        mock_customer.id = "cus_new123"

        mock_session = MagicMock()
        mock_session.id = "cs_test_new"
        mock_session.url = "https://checkout.stripe.com/pay/cs_test_new"

        with (
            patch("src.services.checkout_service.billing_cycle_to_price_id") as mock_price,
            patch("src.services.checkout_service.get_stripe_client") as mock_get_client,
            patch("src.services.checkout_service.settings") as mock_settings,
        ):
            mock_price.return_value = "price_monthly_test"
            mock_settings.frontend_url = "https://app.example.com"

            mock_client = MagicMock()
            mock_client.v1.customers.create_async = AsyncMock(return_value=mock_customer)
            mock_client.v1.checkout.sessions.create_async = AsyncMock(return_value=mock_session)
            mock_get_client.return_value = mock_client

            checkout_url, session_id = await service.create_checkout_session(
                mock_user, BillingCycle.MONTHLY
            )

        assert checkout_url == "https://checkout.stripe.com/pay/cs_test_new"
        assert session_id == "cs_test_new"
        assert mock_user.stripe_customer_id == "cus_new123"
        mock_client.v1.customers.create_async.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_reuses_existing_stripe_customer_id(self):
        """Test that an existing stripe_customer_id is reused without creating a new customer."""
        from unittest.mock import AsyncMock, MagicMock, patch

        from src.services.checkout_service import CheckoutService

        mock_db = MagicMock()
        service = CheckoutService(mock_db)

        mock_user = MagicMock(spec=User)
        mock_user.id = uuid4()
        mock_user.email = "existing@example.com"
        mock_user.stripe_customer_id = "cus_existing456"
        mock_user.supabase_id = str(uuid4())

        mock_session = MagicMock()
        mock_session.id = "cs_test_existing"
        mock_session.url = "https://checkout.stripe.com/pay/cs_test_existing"

        with (
            patch("src.services.checkout_service.billing_cycle_to_price_id") as mock_price,
            patch("src.services.checkout_service.get_stripe_client") as mock_get_client,
            patch("src.services.checkout_service.settings") as mock_settings,
        ):
            mock_price.return_value = "price_quarterly_test"
            mock_settings.frontend_url = "https://app.example.com"

            mock_client = MagicMock()
            mock_client.v1.customers.create_async = AsyncMock()
            mock_client.v1.checkout.sessions.create_async = AsyncMock(return_value=mock_session)
            mock_get_client.return_value = mock_client

            checkout_url, session_id = await service.create_checkout_session(
                mock_user, BillingCycle.QUARTERLY
            )

        assert checkout_url == "https://checkout.stripe.com/pay/cs_test_existing"
        assert session_id == "cs_test_existing"
        # Customer creation should NOT be called
        mock_client.v1.customers.create_async.assert_not_awaited()
        # Verify session was created with the existing customer ID
        session_call_params = mock_client.v1.checkout.sessions.create_async.call_args.kwargs[
            "params"
        ]
        assert session_call_params["customer"] == "cus_existing456"

    @pytest.mark.asyncio
    async def test_raises_value_error_when_price_not_configured(self):
        """Test that ValueError is raised when no price is configured for the billing cycle."""
        from unittest.mock import MagicMock, patch

        from src.services.checkout_service import CheckoutService

        mock_db = MagicMock()
        service = CheckoutService(mock_db)

        mock_user = MagicMock(spec=User)
        mock_user.id = uuid4()
        mock_user.email = "test@example.com"
        mock_user.stripe_customer_id = None

        with patch("src.services.checkout_service.billing_cycle_to_price_id") as mock_price:
            mock_price.return_value = None

            with pytest.raises(ValueError, match="No price configured for"):
                await service.create_checkout_session(mock_user, BillingCycle.MONTHLY)


# =============================================================================
# TestVerifyCheckoutEndpoint - Tests for POST /api/v1/billing/checkout/verify
# =============================================================================


class TestVerifyCheckoutEndpoint:
    """Unit tests for POST /api/v1/billing/checkout/verify endpoint."""

    @pytest.mark.asyncio
    async def test_returns_200_with_subscription_details_on_valid_paid_session(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that 200 with subscription details is returned for a valid paid session."""
        with (
            patch("src.api.v1.billing.settings") as mock_settings,
            patch("src.api.v1.billing.get_current_user") as mock_get_user,
            patch("src.api.v1.billing.CheckoutService") as mock_service_class,
            patch("src.api.v1.billing.capture_event"),
        ):
            mock_settings.stripe_configured = True
            mock_user = create_mock_user(
                subscription_tier=SubscriptionTier.PREMIUM,
                subscription_status=SubscriptionStatus.ACTIVE,
            )
            mock_get_user.return_value = mock_user

            mock_service = AsyncMock()
            mock_service.verify_and_activate.return_value = {
                "status": "activated",
                "subscription_tier": "premium",
                "billing_cycle": "monthly",
                "subscription_status": "active",
            }
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/billing/checkout/verify",
                json={"session_id": "cs_test_abc123"},
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "activated"
        assert data["subscription_tier"] == "premium"
        assert data["billing_cycle"] == "monthly"
        assert data["subscription_status"] == "active"

    @pytest.mark.asyncio
    async def test_returns_400_when_payment_not_paid(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that 400 is returned when payment_status is not paid."""
        from src.core.exceptions import CheckoutNotPaidException

        with (
            patch("src.api.v1.billing.settings") as mock_settings,
            patch("src.api.v1.billing.get_current_user") as mock_get_user,
            patch("src.api.v1.billing.CheckoutService") as mock_service_class,
            patch("src.api.v1.billing.capture_event"),
        ):
            mock_settings.stripe_configured = True
            mock_user = create_mock_user()
            mock_get_user.return_value = mock_user

            mock_service = AsyncMock()
            mock_service.verify_and_activate.side_effect = CheckoutNotPaidException()
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/billing/checkout/verify",
                json={"session_id": "cs_test_unpaid"},
                headers=auth_headers,
            )

        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "CHECKOUT_NOT_PAID"

    @pytest.mark.asyncio
    async def test_returns_400_when_user_mismatch(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that 400 is returned when session metadata user_id doesn't match."""
        from src.core.exceptions import CheckoutUserMismatchException

        with (
            patch("src.api.v1.billing.settings") as mock_settings,
            patch("src.api.v1.billing.get_current_user") as mock_get_user,
            patch("src.api.v1.billing.CheckoutService") as mock_service_class,
            patch("src.api.v1.billing.capture_event"),
        ):
            mock_settings.stripe_configured = True
            mock_user = create_mock_user()
            mock_get_user.return_value = mock_user

            mock_service = AsyncMock()
            mock_service.verify_and_activate.side_effect = CheckoutUserMismatchException()
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/billing/checkout/verify",
                json={"session_id": "cs_test_mismatch"},
                headers=auth_headers,
            )

        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "CHECKOUT_USER_MISMATCH"

    @pytest.mark.asyncio
    async def test_returns_500_on_stripe_api_error(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that 500 is returned when Stripe API raises a StripeError."""
        import stripe as stripe_lib

        with (
            patch("src.api.v1.billing.settings") as mock_settings,
            patch("src.api.v1.billing.get_current_user") as mock_get_user,
            patch("src.api.v1.billing.CheckoutService") as mock_service_class,
            patch("src.api.v1.billing.capture_event"),
        ):
            mock_settings.stripe_configured = True
            mock_user = create_mock_user()
            mock_get_user.return_value = mock_user

            mock_service = AsyncMock()
            mock_service.verify_and_activate.side_effect = stripe_lib.StripeError("API error")
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/billing/checkout/verify",
                json={"session_id": "cs_test_error"},
                headers=auth_headers,
            )

        assert response.status_code == 500
        data = response.json()
        assert data["success"] is False
        assert "verify checkout session" in data["error"]["message"].lower()

    @pytest.mark.asyncio
    async def test_returns_already_active_status_for_idempotent_call(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that already_active status is returned for an idempotent verification."""
        with (
            patch("src.api.v1.billing.settings") as mock_settings,
            patch("src.api.v1.billing.get_current_user") as mock_get_user,
            patch("src.api.v1.billing.CheckoutService") as mock_service_class,
            patch("src.api.v1.billing.capture_event"),
        ):
            mock_settings.stripe_configured = True
            mock_user = create_mock_user(
                subscription_tier=SubscriptionTier.PREMIUM,
                subscription_status=SubscriptionStatus.ACTIVE,
            )
            mock_get_user.return_value = mock_user

            mock_service = AsyncMock()
            mock_service.verify_and_activate.return_value = {
                "status": "already_active",
                "subscription_tier": "premium",
                "billing_cycle": "monthly",
                "subscription_status": "active",
            }
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/billing/checkout/verify",
                json={"session_id": "cs_test_already_active"},
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "already_active"

    @pytest.mark.asyncio
    async def test_posthog_checkout_completed_fired_on_activation(self):
        """Test that checkout_completed PostHog event is fired on successful activation."""
        from src.services.checkout_service import CheckoutService

        mock_db = MagicMock()
        service = CheckoutService(mock_db)

        user_id = uuid4()
        mock_user = MagicMock(spec=User)
        mock_user.id = user_id
        mock_user.email = "test@example.com"
        mock_user.subscription_tier = SubscriptionTier.PREMIUM
        mock_user.subscription_status = SubscriptionStatus.ACTIVE
        mock_user.billing_cycle = BillingCycle.MONTHLY

        mock_session = MagicMock()
        mock_session.payment_status = "paid"
        mock_session.metadata = {
            "user_id": str(user_id),
            "billing_cycle": "monthly",
        }
        mock_session.subscription = "sub_test123"
        mock_session.customer = "cus_test123"

        with (
            patch("src.services.checkout_service.get_stripe_client") as mock_get_client,
            patch("src.services.checkout_service.capture_event") as mock_capture,
        ):
            mock_client = MagicMock()
            mock_client.v1.checkout.sessions.retrieve_async = AsyncMock(return_value=mock_session)
            mock_get_client.return_value = mock_client

            service.activate_premium_subscription = AsyncMock(return_value="activated")

            await service.verify_and_activate(mock_user, "cs_test_abc123")

        mock_capture.assert_called_once_with(
            distinct_id=str(user_id),
            event="checkout_completed",
            properties={
                "session_id": "cs_test_abc123",
                "billing_cycle": "monthly",
                "subscription_tier": SubscriptionTier.PREMIUM.value,
            },
            user_email="test@example.com",
        )

    @pytest.mark.asyncio
    async def test_posthog_checkout_verify_failed_fired_on_payment_not_paid(self):
        """Test that checkout_verify_failed PostHog event is fired when payment is not paid."""
        from src.core.exceptions import CheckoutNotPaidException
        from src.services.checkout_service import CheckoutService

        mock_db = MagicMock()
        service = CheckoutService(mock_db)

        user_id = uuid4()
        mock_user = MagicMock(spec=User)
        mock_user.id = user_id
        mock_user.email = "test@example.com"

        mock_session = MagicMock()
        mock_session.payment_status = "unpaid"
        mock_session.metadata = {}

        with (
            patch("src.services.checkout_service.get_stripe_client") as mock_get_client,
            patch("src.services.checkout_service.capture_event") as mock_capture,
        ):
            mock_client = MagicMock()
            mock_client.v1.checkout.sessions.retrieve_async = AsyncMock(return_value=mock_session)
            mock_get_client.return_value = mock_client

            with pytest.raises(CheckoutNotPaidException):
                await service.verify_and_activate(mock_user, "cs_test_unpaid")

        mock_capture.assert_called_once_with(
            distinct_id=str(user_id),
            event="checkout_verify_failed",
            properties={
                "error_type": "payment_not_paid",
                "session_id": "cs_test_unpaid",
                "payment_status": "unpaid",
            },
            user_email="test@example.com",
        )

    @pytest.mark.asyncio
    async def test_returns_400_when_stripe_not_configured(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that 400 is returned when Stripe is not configured."""
        with patch("src.api.v1.billing.settings") as mock_settings:
            mock_settings.stripe_configured = False

            response = await client.post(
                "/api/v1/billing/checkout/verify",
                json={"session_id": "cs_test_abc123"},
                headers=auth_headers,
            )

        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "BILLING_NOT_CONFIGURED"


# =============================================================================
# TestBillingStatusEndpoint - Tests for GET /api/v1/billing/status
# =============================================================================


def _make_stripe_price(
    unit_amount: int, currency: str = "eur", interval: str = "month", interval_count: int = 1
) -> MagicMock:
    """Build a mock Stripe price object."""
    price = MagicMock()
    price.unit_amount = unit_amount
    price.currency = currency
    price.recurring = MagicMock()
    price.recurring.interval = interval
    price.recurring.interval_count = interval_count
    return price


class TestBillingStatusEndpoint:
    """Unit tests for GET /api/v1/billing/status endpoint.

    Uses the real test_user from the database (via auth_headers fixture)
    rather than mocking get_current_user, because the auth_headers fixture
    sets app.dependency_overrides which takes precedence over module patches.
    """

    @pytest.mark.asyncio
    async def test_returns_200_with_free_user_status(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Free user with Stripe not configured returns basic status with empty pricing."""
        with (
            patch("src.api.v1.billing.is_stripe_configured", return_value=False),
            patch(
                "src.api.v1.billing.get_effective_access_level", return_value=SubscriptionTier.FREE
            ),
        ):
            response = await client.get("/api/v1/billing/status", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["subscription_status"] == "none"
        assert data["is_premium"] is False
        assert data["pricing"] == []

    @pytest.mark.asyncio
    async def test_returns_200_with_trialing_user_status(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user: User,
        db_session,
    ):
        """Trialing user with future trial_end_date reports positive trial_days_remaining."""
        test_user.subscription_status = SubscriptionStatus.TRIALING
        test_user.trial_end_date = datetime.now(timezone.utc) + timedelta(days=5)
        await db_session.flush()

        with (
            patch("src.api.v1.billing.is_stripe_configured", return_value=False),
            patch(
                "src.api.v1.billing.get_effective_access_level",
                return_value=SubscriptionTier.PREMIUM,
            ),
        ):
            response = await client.get("/api/v1/billing/status", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["trial_days_remaining"] is not None
        assert data["trial_days_remaining"] > 0
        assert data["is_premium"] is True

    @pytest.mark.asyncio
    async def test_returns_200_with_expired_trial_status(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user: User,
        db_session,
    ):
        """User with expired trial_end_date gets trial_days_remaining=0 and is_premium=False."""
        test_user.subscription_status = SubscriptionStatus.TRIALING
        test_user.trial_end_date = datetime.now(timezone.utc) - timedelta(days=3)
        await db_session.flush()

        with (
            patch("src.api.v1.billing.is_stripe_configured", return_value=False),
            patch(
                "src.api.v1.billing.get_effective_access_level",
                return_value=SubscriptionTier.FREE,
            ),
        ):
            response = await client.get("/api/v1/billing/status", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["trial_days_remaining"] == 0
        assert data["is_premium"] is False

    @pytest.mark.asyncio
    async def test_returns_200_with_active_premium_status(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user: User,
        db_session,
    ):
        """Active premium user returns is_premium=True."""
        test_user.subscription_tier = SubscriptionTier.PREMIUM
        test_user.subscription_status = SubscriptionStatus.ACTIVE
        test_user.billing_cycle = BillingCycle.MONTHLY
        await db_session.flush()

        with (
            patch("src.api.v1.billing.is_stripe_configured", return_value=False),
            patch(
                "src.api.v1.billing.get_effective_access_level",
                return_value=SubscriptionTier.PREMIUM,
            ),
        ):
            response = await client.get("/api/v1/billing/status", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["is_premium"] is True
        assert data["subscription_status"] == "active"

    @pytest.mark.asyncio
    async def test_returns_200_with_pricing_when_stripe_configured(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """When Stripe is configured and prices are fetched, pricing list is populated."""
        mock_client = MagicMock()
        monthly_price = _make_stripe_price(
            unit_amount=2900, currency="eur", interval="month", interval_count=1
        )
        mock_client.v1.prices.retrieve_async = AsyncMock(return_value=monthly_price)

        with (
            patch("src.api.v1.billing.is_stripe_configured", return_value=True),
            patch("src.api.v1.billing.get_stripe_client", return_value=mock_client),
            patch(
                "src.api.v1.billing._build_price_to_cycle_map",
                return_value={"price_monthly_test": BillingCycle.MONTHLY},
            ),
            patch(
                "src.api.v1.billing.get_effective_access_level",
                return_value=SubscriptionTier.FREE,
            ),
        ):
            response = await client.get("/api/v1/billing/status", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data["pricing"]) == 1
        plan = data["pricing"][0]
        assert plan["billing_cycle"] == "monthly"
        assert plan["price_amount"] == 2900
        assert plan["price_formatted"] == "29.00"
        assert plan["currency"] == "eur"

    @pytest.mark.asyncio
    async def test_returns_200_with_empty_pricing_when_stripe_not_configured(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """When Stripe is not configured, pricing is an empty list."""
        with (
            patch("src.api.v1.billing.is_stripe_configured", return_value=False),
            patch(
                "src.api.v1.billing.get_effective_access_level",
                return_value=SubscriptionTier.FREE,
            ),
        ):
            response = await client.get("/api/v1/billing/status", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["pricing"] == []

    @pytest.mark.asyncio
    async def test_returns_200_with_empty_pricing_on_stripe_error(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """When Stripe price retrieval raises an exception, pricing is empty and still 200."""
        mock_client = MagicMock()
        mock_client.v1.prices.retrieve_async = AsyncMock(side_effect=Exception("Stripe error"))

        with (
            patch("src.api.v1.billing.is_stripe_configured", return_value=True),
            patch("src.api.v1.billing.get_stripe_client", return_value=mock_client),
            patch(
                "src.api.v1.billing._build_price_to_cycle_map",
                return_value={"price_monthly_test": BillingCycle.MONTHLY},
            ),
            patch(
                "src.api.v1.billing.get_effective_access_level",
                return_value=SubscriptionTier.FREE,
            ),
        ):
            response = await client.get("/api/v1/billing/status", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["pricing"] == []

    @pytest.mark.asyncio
    async def test_savings_percent_computed_correctly(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Quarterly plan savings_percent is computed correctly vs monthly price."""
        mock_client = MagicMock()

        monthly_price = _make_stripe_price(
            unit_amount=2900, currency="eur", interval="month", interval_count=1
        )
        quarterly_price = _make_stripe_price(
            unit_amount=7500, currency="eur", interval="month", interval_count=3
        )

        async def retrieve_price(price_id, **kwargs):
            if price_id == "price_monthly":
                return monthly_price
            return quarterly_price

        mock_client.v1.prices.retrieve_async = AsyncMock(side_effect=retrieve_price)

        with (
            patch("src.api.v1.billing.is_stripe_configured", return_value=True),
            patch("src.api.v1.billing.get_stripe_client", return_value=mock_client),
            patch(
                "src.api.v1.billing._build_price_to_cycle_map",
                return_value={
                    "price_monthly": BillingCycle.MONTHLY,
                    "price_quarterly": BillingCycle.QUARTERLY,
                },
            ),
            patch(
                "src.api.v1.billing.get_effective_access_level",
                return_value=SubscriptionTier.FREE,
            ),
        ):
            response = await client.get("/api/v1/billing/status", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data["pricing"]) == 2
        quarterly = next(p for p in data["pricing"] if p["billing_cycle"] == "quarterly")
        # per_month = 7500 / 3 = 2500; savings = round((1 - 2500/2900) * 100) = round(13.79) = 14
        assert quarterly["savings_percent"] == 14

    @pytest.mark.asyncio
    async def test_unconfigured_price_ids_omitted(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Only configured price IDs appear in pricing; unconfigured ones are omitted."""
        mock_client = MagicMock()
        monthly_price = _make_stripe_price(
            unit_amount=2900, currency="eur", interval="month", interval_count=1
        )
        mock_client.v1.prices.retrieve_async = AsyncMock(return_value=monthly_price)

        with (
            patch("src.api.v1.billing.is_stripe_configured", return_value=True),
            patch("src.api.v1.billing.get_stripe_client", return_value=mock_client),
            patch(
                "src.api.v1.billing._build_price_to_cycle_map",
                return_value={"price_monthly_only": BillingCycle.MONTHLY},
            ),
            patch(
                "src.api.v1.billing.get_effective_access_level",
                return_value=SubscriptionTier.FREE,
            ),
        ):
            response = await client.get("/api/v1/billing/status", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data["pricing"]) == 1
        assert data["pricing"][0]["billing_cycle"] == "monthly"

    @pytest.mark.asyncio
    async def test_returns_401_when_unauthenticated(
        self,
        client: AsyncClient,
    ):
        """Unauthenticated request to /status returns 401."""
        response = await client.get("/api/v1/billing/status")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False
