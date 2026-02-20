from datetime import datetime, timezone
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.billing_utils import billing_cycle_to_price_id
from src.core.logging import get_logger
from src.core.posthog import capture_event
from src.core.stripe import get_stripe_client
from src.db.models import BillingCycle, SubscriptionStatus, SubscriptionTier, User

logger = get_logger(__name__)


class CheckoutService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def activate_premium_subscription(
        self,
        user: User,
        stripe_customer_id: str,
        stripe_subscription_id: str,
        billing_cycle: BillingCycle | None,
    ) -> Literal["activated", "already_active"]:
        """Activate a premium subscription for a user.

        Sets all subscription fields and clears trial dates.
        Does NOT commit — caller handles commit.

        Returns "already_active" if the user already has this exact subscription active.
        Returns "activated" on successful activation.
        """
        # Idempotency check
        if (
            user.stripe_subscription_id == stripe_subscription_id
            and user.subscription_tier == SubscriptionTier.PREMIUM
            and user.subscription_status == SubscriptionStatus.ACTIVE
        ):
            logger.info(
                "Subscription already active",
                user_id=str(user.id),
                stripe_subscription_id=stripe_subscription_id,
            )
            return "already_active"

        now = datetime.now(timezone.utc)

        # Capture pre-mutation state
        was_previously_canceled = user.subscription_status == SubscriptionStatus.CANCELED

        # Set core subscription fields
        user.stripe_customer_id = stripe_customer_id
        user.stripe_subscription_id = stripe_subscription_id
        user.subscription_tier = SubscriptionTier.PREMIUM
        user.subscription_status = SubscriptionStatus.ACTIVE

        # Set billing cycle only if provided
        if billing_cycle is not None:
            user.billing_cycle = billing_cycle

        # Set subscription_created_at only for first-time subscribers
        if user.subscription_created_at is None:
            user.subscription_created_at = now

        # Set resubscribed_at for previously canceled users
        if was_previously_canceled:
            user.subscription_resubscribed_at = now

        # Clear trial dates
        user.trial_start_date = None
        user.trial_end_date = None

        logger.info(
            "Premium subscription activated",
            user_id=str(user.id),
            stripe_customer_id=stripe_customer_id,
            stripe_subscription_id=stripe_subscription_id,
            billing_cycle=billing_cycle.value if billing_cycle else None,
            was_resubscription=was_previously_canceled,
        )

        return "activated"

    async def create_checkout_session(
        self,
        user: User,
        billing_cycle: BillingCycle,
    ) -> tuple[str, str]:
        """Create a Stripe checkout session for premium subscription.

        Returns (checkout_url, session_id).
        Does NOT commit — caller handles commit.
        """
        price_id = billing_cycle_to_price_id(billing_cycle)
        if not price_id:
            raise ValueError(f"No price configured for {billing_cycle.value} billing cycle")

        client = get_stripe_client()

        # Get or create Stripe customer
        customer_id = user.stripe_customer_id
        if not customer_id:
            customer = await client.v1.customers.create_async(
                params={
                    "email": user.email,
                    "metadata": {"user_id": str(user.id)},
                },
            )
            customer_id = customer.id
            user.stripe_customer_id = customer_id

        success_url = f"{settings.frontend_url}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{settings.frontend_url}/checkout/cancel"

        session = await client.v1.checkout.sessions.create_async(
            params={
                "mode": "subscription",
                "customer": customer_id,
                "client_reference_id": user.supabase_id,
                "line_items": [{"price": price_id, "quantity": 1}],
                "success_url": success_url,
                "cancel_url": cancel_url,
                "metadata": {
                    "user_id": str(user.id),
                    "billing_cycle": billing_cycle.value,
                    "price_id": price_id,
                },
            },
        )

        logger.info(
            "Checkout session created",
            user_id=str(user.id),
            billing_cycle=billing_cycle.value,
            session_id=session.id,
        )

        return session.url, session.id

    async def verify_and_activate(
        self,
        user: User,
        session_id: str,
    ) -> dict:
        """Verify a Stripe checkout session and activate subscription.

        Returns dict with status and subscription details.
        Raises stripe.StripeError on Stripe API failure.
        Raises CheckoutNotPaidException if payment not complete.
        Raises CheckoutUserMismatchException if session doesn't belong to user.
        """
        from src.core.exceptions import CheckoutNotPaidException, CheckoutUserMismatchException

        client = get_stripe_client()
        # Let StripeError propagate — caller catches and handles
        session = await client.v1.checkout.sessions.retrieve_async(session_id)

        # Validate payment status
        if session.payment_status != "paid":
            capture_event(
                distinct_id=str(user.id),
                event="checkout_verify_failed",
                properties={
                    "error_type": "payment_not_paid",
                    "session_id": session_id,
                    "payment_status": session.payment_status,
                },
                user_email=user.email,
            )
            raise CheckoutNotPaidException()

        # Validate user ownership
        metadata = session.metadata or {}
        if metadata.get("user_id") != str(user.id):
            capture_event(
                distinct_id=str(user.id),
                event="checkout_verify_failed",
                properties={
                    "error_type": "user_mismatch",
                    "session_id": session_id,
                },
                user_email=user.email,
            )
            raise CheckoutUserMismatchException()

        # Extract subscription details
        stripe_subscription_id = session.subscription
        stripe_customer_id = session.customer
        billing_cycle_str = metadata.get("billing_cycle")
        billing_cycle = BillingCycle(billing_cycle_str) if billing_cycle_str else None

        # Activate subscription (handles idempotency internally)
        result = await self.activate_premium_subscription(
            user=user,
            stripe_customer_id=stripe_customer_id or "",
            stripe_subscription_id=stripe_subscription_id or "",
            billing_cycle=billing_cycle,
        )

        if result == "activated":
            capture_event(
                distinct_id=str(user.id),
                event="checkout_completed",
                properties={
                    "session_id": session_id,
                    "billing_cycle": billing_cycle_str,
                    "subscription_tier": SubscriptionTier.PREMIUM.value,
                },
                user_email=user.email,
            )

        return {
            "status": result,
            "subscription_tier": user.subscription_tier.value,
            "billing_cycle": user.billing_cycle.value if user.billing_cycle else "",
            "subscription_status": user.subscription_status.value,
        }
