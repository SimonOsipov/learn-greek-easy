"""Service for managing subscription lifecycle: plan changes, cancellation, reactivation."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.billing_utils import billing_cycle_to_price_id
from src.core.exceptions import (
    PlanChangeNotAllowedException,
    SubscriptionAlreadyCancelingException,
    SubscriptionNotActiveException,
)
from src.core.posthog import capture_event
from src.core.stripe import get_stripe_client
from src.db.models import BillingCycle, SubscriptionStatus, SubscriptionTier, User


class SubscriptionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def _require_active_subscription(self, user: User) -> None:
        """Verify user has an active premium subscription with a Stripe subscription ID."""
        if not user.stripe_subscription_id:
            raise SubscriptionNotActiveException()
        if user.subscription_tier != SubscriptionTier.PREMIUM:
            raise SubscriptionNotActiveException("User does not have a premium subscription")

    async def change_plan(self, user: User, new_billing_cycle: BillingCycle) -> None:
        """Change the subscription billing cycle. Raises on guard failures."""
        self._require_active_subscription(user)

        # Must be ACTIVE (not PAST_DUE, TRIALING, etc.)
        if user.subscription_status != SubscriptionStatus.ACTIVE:
            raise PlanChangeNotAllowedException(
                "Plan change requires an active subscription (not past_due or trialing)"
            )

        # Cannot change plan if already scheduled for cancellation
        if user.subscription_cancel_at_period_end:
            raise PlanChangeNotAllowedException(
                "Cannot change plan while subscription is scheduled for cancellation"
            )

        # Must be a different billing cycle
        if user.billing_cycle == new_billing_cycle:
            raise PlanChangeNotAllowedException("Already on this billing cycle")

        # Retrieve current subscription from Stripe to get item ID
        client = get_stripe_client()
        subscription = await client.v1.subscriptions.retrieve_async(user.stripe_subscription_id)
        current_item_id = subscription.items.data[0].id

        # Get the new price ID
        new_price_id = billing_cycle_to_price_id(new_billing_cycle)
        if not new_price_id:
            raise PlanChangeNotAllowedException(
                "No price configured for the requested billing cycle"
            )

        # Capture previous billing cycle before updating
        previous_billing_cycle = user.billing_cycle.value if user.billing_cycle else None

        # Update subscription on Stripe
        await client.v1.subscriptions.update_async(
            user.stripe_subscription_id,
            params={
                "items": [{"id": current_item_id, "price": new_price_id}],
                "proration_behavior": "create_prorations",
            },
        )

        # Optimistic DB update
        user.billing_cycle = new_billing_cycle

        # Fire PostHog event
        capture_event(
            distinct_id=str(user.id),
            event="plan_change_completed",
            properties={
                "user_id": str(user.id),
                "new_billing_cycle": new_billing_cycle.value,
                "previous_billing_cycle": previous_billing_cycle,
            },
            user_email=user.email,
        )

    async def cancel(self, user: User) -> None:
        """Schedule subscription cancellation at period end. Raises on guard failures."""
        self._require_active_subscription(user)

        # Allow ACTIVE or PAST_DUE for cancel
        if user.subscription_status not in (SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE):
            raise SubscriptionNotActiveException(
                "Subscription must be active or past_due to cancel"
            )

        # Cannot cancel if already scheduled for cancellation
        if user.subscription_cancel_at_period_end:
            raise SubscriptionAlreadyCancelingException()

        # Update Stripe subscription
        client = get_stripe_client()
        await client.v1.subscriptions.update_async(
            user.stripe_subscription_id,
            params={"cancel_at_period_end": True},
        )

        # Optimistic DB update
        user.subscription_cancel_at_period_end = True

        # Fire PostHog event
        capture_event(
            distinct_id=str(user.id),
            event="cancel_scheduled",
            properties={
                "user_id": str(user.id),
                "subscription_status": user.subscription_status.value,
            },
            user_email=user.email,
        )

    async def reactivate(self, user: User) -> None:
        """Reactivate a subscription that is scheduled for cancellation. Raises on guard failures."""
        self._require_active_subscription(user)

        # Must be scheduled for cancellation to reactivate
        if not user.subscription_cancel_at_period_end:
            raise SubscriptionNotActiveException("Subscription is not scheduled for cancellation")

        # Must be ACTIVE (not expired/cancelled)
        if user.subscription_status != SubscriptionStatus.ACTIVE:
            raise SubscriptionNotActiveException(
                "Cannot reactivate a subscription that is not active"
            )

        # Update Stripe subscription
        client = get_stripe_client()
        await client.v1.subscriptions.update_async(
            user.stripe_subscription_id,
            params={"cancel_at_period_end": False},
        )

        # Optimistic DB update
        user.subscription_cancel_at_period_end = False

        # Fire PostHog event
        capture_event(
            distinct_id=str(user.id),
            event="reactivate_completed",
            properties={
                "user_id": str(user.id),
            },
            user_email=user.email,
        )
