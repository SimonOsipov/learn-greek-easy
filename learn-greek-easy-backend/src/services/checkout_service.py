from datetime import datetime, timezone
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging import get_logger
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
