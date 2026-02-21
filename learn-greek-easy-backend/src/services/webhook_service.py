"""Stripe webhook service for processing webhook events.

Handles idempotency, event dispatch, user subscription updates,
and PostHog analytics for all Stripe webhook event types.
"""

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.billing_utils import price_id_to_billing_cycle, stripe_status_to_subscription_status
from src.core.logging import get_logger
from src.core.posthog import capture_event
from src.db.models import BillingCycle, SubscriptionStatus, SubscriptionTier, User
from src.repositories.user import UserRepository
from src.repositories.webhook_event import WebhookEventRepository
from src.services.checkout_service import CheckoutService

logger = get_logger(__name__)


class WebhookService:
    """Service for processing Stripe webhook events.

    Handles idempotency via WebhookEventRepository, dispatches events
    to handlers, updates User subscription fields, and fires PostHog events.
    Always returns True from process_event to prevent Stripe retries.
    """

    _EVENT_HANDLERS: dict[str, str] = {
        "checkout.session.completed": "_handle_checkout_session_completed",
        "invoice.paid": "_handle_invoice_paid",
        "invoice.payment_failed": "_handle_invoice_payment_failed",
        "invoice.payment_action_required": "_handle_invoice_payment_action_required",
        "customer.subscription.updated": "_handle_subscription_updated",
        "customer.subscription.deleted": "_handle_subscription_deleted",
    }

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.user_repo = UserRepository(db)
        self.webhook_repo = WebhookEventRepository(db)

    async def process_event(self, event: dict) -> bool:
        """Process a Stripe webhook event.

        Performs idempotency check, records event, dispatches to handler,
        and always returns True to prevent Stripe retries.

        Args:
            event: Verified Stripe event dict.

        Returns:
            Always True.
        """
        event_id = event.get("id")
        event_type = event.get("type")

        if not event_id or not event_type:
            logger.warning("Received webhook event with missing id or type")
            return True

        # Idempotency check
        existing = await self.webhook_repo.get_by_event_id(event_id)
        if existing:
            logger.info(
                "Duplicate webhook event, skipping",
                event_id=event_id,
                event_type=event_type,
                existing_status=existing.processing_status,
            )
            return True

        # Record the event as PROCESSING
        webhook_event = await self.webhook_repo.create_processing(
            event_id=event_id,
            event_type=event_type,
            raw_payload=event,
        )

        # Dispatch to handler
        handler_name = self._EVENT_HANDLERS.get(event_type)
        if not handler_name:
            logger.info("No handler for webhook event type, skipping", event_type=event_type)
            await self.webhook_repo.mark_completed(webhook_event)
            return True

        try:
            handler = getattr(self, handler_name)
            await handler(event)
            await self.webhook_repo.mark_completed(webhook_event)
        except Exception as e:
            logger.error(
                "Webhook handler failed",
                event_id=event_id,
                event_type=event_type,
                error=str(e),
            )
            await self.webhook_repo.mark_failed(webhook_event, str(e))

        return True

    # =========================================================================
    # Handlers
    # =========================================================================

    async def _handle_checkout_session_completed(self, event: dict) -> None:
        """Handle checkout.session.completed — activate premium subscription."""
        session = event.get("data", {}).get("object", {})
        supabase_id = session.get("client_reference_id")
        if not supabase_id:
            logger.warning("checkout.session.completed missing client_reference_id")
            return

        user = await self.user_repo.get_by_supabase_id(supabase_id)
        if not user:
            logger.warning("checkout.session.completed user not found", supabase_id=supabase_id)
            return

        # Extract billing cycle from metadata
        metadata = session.get("metadata") or {}
        price_id = metadata.get("price_id")
        billing_cycle = price_id_to_billing_cycle(price_id) if price_id else None

        # Extract promo code from metadata (stored during checkout session creation)
        promo_code_str = metadata.get("promo_code") or None

        # Extract discount details from Stripe event payload
        discount_data = self._extract_discount_data(session)

        # Delegate activation to CheckoutService
        checkout_service = CheckoutService(self.db)
        result = await checkout_service.activate_premium_subscription(
            user=user,
            stripe_customer_id=session.get("customer", ""),
            stripe_subscription_id=session.get("subscription", ""),
            billing_cycle=billing_cycle,
        )

        if result == "activated":
            has_promo = bool(discount_data or promo_code_str)
            self._track_event(
                user,
                "subscription_created",
                {
                    "subscription_tier": SubscriptionTier.PREMIUM.value,
                    "subscription_status": SubscriptionStatus.ACTIVE.value,
                    "billing_cycle": billing_cycle.value if billing_cycle else None,
                    "stripe_customer_id": session.get("customer"),
                    "stripe_subscription_id": session.get("subscription"),
                    "currency": session.get("currency"),
                    "has_promo_code": has_promo,
                    "promo_code": promo_code_str,
                    "discount_percent_off": discount_data["percent_off"] if discount_data else None,
                    "coupon_name": discount_data["coupon_name"] if discount_data else None,
                },
            )

            # Fire promo_code_applied only when a discount was actually applied
            if discount_data:
                self._track_event(
                    user,
                    "promo_code_applied",
                    {
                        "promo_code": promo_code_str,
                        "coupon_id": discount_data["coupon_id"],
                        "coupon_name": discount_data["coupon_name"],
                        "percent_off": discount_data["percent_off"],
                        "billing_cycle": billing_cycle.value if billing_cycle else None,
                        "subscription_id": session.get("subscription"),
                    },
                )

    async def _handle_invoice_paid(self, event: dict) -> None:
        """Handle invoice.paid event.

        Sets status=ACTIVE, updates period_end, billing_cycle, subscription_created_at.
        Fires subscription_renewed PostHog event for non-first invoices.
        """
        invoice = event.get("data", {}).get("object", {})
        customer_id = invoice.get("customer")

        user = await self._find_user_by_stripe_customer_id(customer_id, "invoice.paid")
        if user is None:
            return

        is_first_invoice = user.subscription_created_at is None
        now = datetime.now(timezone.utc)

        user.subscription_status = SubscriptionStatus.ACTIVE

        # Get period_end from first line item
        lines_data = (invoice.get("lines") or {}).get("data") or []
        if lines_data:
            period_end_ts = (lines_data[0].get("period") or {}).get("end")
            if period_end_ts:
                user.subscription_current_period_end = datetime.fromtimestamp(
                    period_end_ts, tz=timezone.utc
                )

            price_id = (lines_data[0].get("price") or {}).get("id")
            if price_id:
                cycle = price_id_to_billing_cycle(price_id)
                if cycle is not None:
                    user.billing_cycle = cycle

        if user.subscription_created_at is None:
            user.subscription_created_at = now

        # Only fire renewal event for subsequent invoices
        if not is_first_invoice:
            self._track_event(
                user,
                "subscription_renewed",
                {
                    "tier": user.subscription_tier.value if user.subscription_tier else None,
                    "billing_cycle": user.billing_cycle.value if user.billing_cycle else None,
                    "amount": invoice.get("amount_paid"),
                },
            )

    async def _handle_invoice_payment_failed(self, event: dict) -> None:
        """Handle invoice.payment_failed event. Sets status=PAST_DUE."""
        invoice = event.get("data", {}).get("object", {})
        customer_id = invoice.get("customer")

        user = await self._find_user_by_stripe_customer_id(customer_id, "invoice.payment_failed")
        if user is None:
            return

        user.subscription_status = SubscriptionStatus.PAST_DUE

        self._track_event(
            user,
            "payment_failed",
            {
                "tier": user.subscription_tier.value if user.subscription_tier else None,
                "billing_cycle": user.billing_cycle.value if user.billing_cycle else None,
            },
        )

    async def _handle_invoice_payment_action_required(self, event: dict) -> None:
        """Handle invoice.payment_action_required event. Sets status=PAST_DUE."""
        invoice = event.get("data", {}).get("object", {})
        customer_id = invoice.get("customer")

        user = await self._find_user_by_stripe_customer_id(
            customer_id, "invoice.payment_action_required"
        )
        if user is None:
            return

        user.subscription_status = SubscriptionStatus.PAST_DUE

        self._track_event(
            user,
            "payment_action_required",
            {
                "tier": user.subscription_tier.value if user.subscription_tier else None,
            },
        )

    async def _handle_subscription_updated(self, event: dict) -> None:
        """Handle customer.subscription.updated event.

        Syncs status, period_end, cancel_at_period_end, billing_cycle,
        stripe_subscription_id. Detects changes for PostHog events.
        """
        subscription = event.get("data", {}).get("object", {})
        customer_id = subscription.get("customer")

        user = await self._find_user_by_stripe_customer_id(
            customer_id, "customer.subscription.updated"
        )
        if user is None:
            return

        # Capture old state for change detection
        old_billing_cycle = user.billing_cycle
        old_cancel_at_period_end = user.subscription_cancel_at_period_end

        # Sync Stripe subscription ID
        user.stripe_subscription_id = subscription.get("id")

        # Sync status
        stripe_status = subscription.get("status")
        new_status = stripe_status_to_subscription_status(stripe_status)
        if new_status is not None:
            user.subscription_status = new_status

        # Sync period end
        current_period_end_ts = subscription.get("current_period_end")
        if current_period_end_ts:
            user.subscription_current_period_end = datetime.fromtimestamp(
                current_period_end_ts, tz=timezone.utc
            )

        # Sync cancel_at_period_end
        new_cancel_at_period_end = subscription.get("cancel_at_period_end", False)
        user.subscription_cancel_at_period_end = new_cancel_at_period_end

        # Sync billing cycle from first item price
        items_data = (subscription.get("items") or {}).get("data") or []
        new_billing_cycle: BillingCycle | None = None
        if items_data:
            price_id = (items_data[0].get("price") or {}).get("id")
            if price_id:
                new_billing_cycle = price_id_to_billing_cycle(price_id)
                if new_billing_cycle is not None:
                    user.billing_cycle = new_billing_cycle

        # Fire PostHog change events
        if (
            old_billing_cycle is not None
            and new_billing_cycle is not None
            and old_billing_cycle != new_billing_cycle
        ):
            self._track_event(
                user,
                "subscription_plan_changed",
                {
                    "old_billing_cycle": old_billing_cycle.value,
                    "new_billing_cycle": new_billing_cycle.value,
                },
            )

        if not old_cancel_at_period_end and new_cancel_at_period_end:
            self._track_event(
                user,
                "subscription_cancel_scheduled",
                {
                    "tier": user.subscription_tier.value if user.subscription_tier else None,
                },
            )

        if old_cancel_at_period_end and not new_cancel_at_period_end:
            self._track_event(
                user,
                "subscription_reactivated",
                {
                    "tier": user.subscription_tier.value if user.subscription_tier else None,
                },
            )

    async def _handle_subscription_deleted(self, event: dict) -> None:
        """Handle customer.subscription.deleted event.

        Downgrades to FREE/CANCELED. Clears subscription fields.
        Does NOT clear stripe_customer_id (reused for resubscription).
        """
        subscription = event.get("data", {}).get("object", {})
        customer_id = subscription.get("customer")

        user = await self._find_user_by_stripe_customer_id(
            customer_id, "customer.subscription.deleted"
        )
        if user is None:
            return

        was_billing_cycle = user.billing_cycle

        # Downgrade to FREE
        user.subscription_tier = SubscriptionTier.FREE
        user.subscription_status = SubscriptionStatus.CANCELED
        user.stripe_subscription_id = None
        user.subscription_current_period_end = None
        user.billing_cycle = None
        user.subscription_cancel_at_period_end = False
        # Do NOT clear stripe_customer_id

        self._track_event(
            user,
            "subscription_canceled",
            {
                "tier": SubscriptionTier.FREE.value,
                "was_billing_cycle": was_billing_cycle.value if was_billing_cycle else None,
            },
        )

    # =========================================================================
    # Helpers
    # =========================================================================

    def _extract_discount_data(self, session: dict) -> dict | None:
        """Extract discount/coupon data from checkout session payload.

        Returns dict with coupon_id, coupon_name, percent_off, promotion_code_id
        or None if no discount was applied.
        """
        total_details = session.get("total_details") or {}
        breakdown = total_details.get("breakdown") or {}
        discounts = breakdown.get("discounts") or []

        if not discounts:
            return None

        first_discount = discounts[0]
        discount_obj = first_discount.get("discount") or {}
        coupon = discount_obj.get("coupon") or {}

        return {
            "coupon_id": coupon.get("id"),
            "coupon_name": coupon.get("name"),
            "percent_off": coupon.get("percent_off"),
            "promotion_code_id": discount_obj.get("promotion_code"),
        }

    async def _find_user_by_supabase_id(
        self, supabase_id: str | None, event_type: str
    ) -> User | None:
        """Find user by Supabase ID. Logs warning if not found."""
        if not supabase_id:
            logger.warning("No supabase_id in webhook event", event_type=event_type)
            return None

        user = await self.user_repo.get_by_supabase_id(supabase_id)
        if user is None:
            logger.warning(
                "User not found by supabase_id",
                supabase_id=supabase_id,
                event_type=event_type,
            )
        return user

    async def _find_user_by_stripe_customer_id(
        self, customer_id: str | None, event_type: str
    ) -> User | None:
        """Find user by Stripe customer ID. Logs warning if not found."""
        if not customer_id:
            logger.warning("No customer_id in webhook event", event_type=event_type)
            return None

        users: list[User] = await self.user_repo.filter_by(stripe_customer_id=customer_id)
        if not users:
            logger.warning(
                "User not found by stripe_customer_id",
                customer_id=customer_id,
                event_type=event_type,
            )
            return None

        return users[0]

    def _track_event(self, user: User, event_name: str, properties: dict[str, Any]) -> None:
        """Fire a PostHog analytics event. Swallows exceptions."""
        try:
            capture_event(
                distinct_id=str(user.id),
                event=event_name,
                properties=properties,
                user_email=user.email,
            )
        except Exception as e:
            logger.warning(
                "PostHog event tracking failed",
                event_name=event_name,
                error=str(e),
            )
