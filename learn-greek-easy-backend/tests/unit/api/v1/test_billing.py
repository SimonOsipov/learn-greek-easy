"""Unit tests for /api/v1/billing endpoints.

Tests cover:
- POST /api/v1/billing/checkout/premium endpoint behavior
- Stripe not configured (400)
- Already premium user (403)
- Successful checkout session creation (200)
- Stripe customer get-or-create logic
- Trialing users can proceed to checkout
"""

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
) -> MagicMock:
    """Create a mock User object for billing tests."""
    mock = MagicMock(spec=User)
    mock.id = uuid4()
    mock.email = "test@example.com"
    mock.subscription_tier = subscription_tier
    mock.subscription_status = subscription_status
    mock.stripe_customer_id = stripe_customer_id
    mock.supabase_id = supabase_id or str(uuid4())
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
