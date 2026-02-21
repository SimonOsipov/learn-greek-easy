"""Billing utility functions for Stripe price and status mapping.

Pure-mapping functions for converting Stripe price IDs and subscription
statuses to internal enum values. No I/O or side effects beyond logging.
"""

from src.config import settings
from src.core.logging import get_logger
from src.db.models import BillingCycle, SubscriptionStatus

logger = get_logger(__name__)

# Known Stripe statuses that intentionally map to None (no warning logged)
_KNOWN_UNMAPPED_STATUSES = frozenset({"incomplete_expired", "paused"})

_STRIPE_STATUS_MAP: dict[str, SubscriptionStatus] = {
    "trialing": SubscriptionStatus.TRIALING,
    "active": SubscriptionStatus.ACTIVE,
    "past_due": SubscriptionStatus.PAST_DUE,
    "canceled": SubscriptionStatus.CANCELED,
    "incomplete": SubscriptionStatus.INCOMPLETE,
    "unpaid": SubscriptionStatus.UNPAID,
}


def _build_price_to_cycle_map() -> dict[str, BillingCycle]:
    """Build mapping from Stripe Price ID to BillingCycle from current settings.

    Called fresh each time to pick up settings changes (useful in tests).
    Filters out price IDs that are None (not configured).

    Returns:
        dict mapping configured Price ID strings to BillingCycle enum values.
    """
    mapping: dict[str, BillingCycle] = {}
    if settings.stripe_price_premium_monthly:
        mapping[settings.stripe_price_premium_monthly] = BillingCycle.MONTHLY
    if settings.stripe_price_premium_quarterly:
        mapping[settings.stripe_price_premium_quarterly] = BillingCycle.QUARTERLY
    if settings.stripe_price_premium_semi_annual:
        mapping[settings.stripe_price_premium_semi_annual] = BillingCycle.SEMI_ANNUAL
    return mapping


def price_id_to_billing_cycle(price_id: str | None) -> BillingCycle | None:
    """Map a Stripe Price ID to a BillingCycle enum value.

    Reads stripe_price_premium_monthly, stripe_price_premium_quarterly,
    and stripe_price_premium_semi_annual from settings. Returns None and
    logs a warning for unrecognized price IDs.

    Args:
        price_id: Stripe price ID string (e.g., "price_xxx"), or None.

    Returns:
        BillingCycle enum value, or None if input is None/empty/unrecognized.
    """
    if not price_id:
        return None

    mapping = _build_price_to_cycle_map()
    result = mapping.get(price_id)

    if result is None:
        logger.warning(
            "Unknown Stripe Price ID",
            price_id=price_id,
            configured_ids=list(mapping.keys()),
        )

    return result


def billing_cycle_to_price_id(cycle: BillingCycle) -> str | None:
    """Convert a BillingCycle enum to its configured Stripe Price ID.

    Returns None if the cycle has no configured price (e.g. LIFETIME)
    or if the corresponding setting is not set.
    """
    cycle_to_price: dict[BillingCycle, str | None] = {
        BillingCycle.MONTHLY: settings.stripe_price_premium_monthly,
        BillingCycle.QUARTERLY: settings.stripe_price_premium_quarterly,
        BillingCycle.SEMI_ANNUAL: settings.stripe_price_premium_semi_annual,
    }
    return cycle_to_price.get(cycle)


def stripe_status_to_subscription_status(
    stripe_status: str | None,
) -> SubscriptionStatus | None:
    """Map a Stripe subscription status string to a SubscriptionStatus enum.

    Maps the 6 tracked statuses:
        trialing  -> TRIALING
        active    -> ACTIVE
        past_due  -> PAST_DUE
        canceled  -> CANCELED
        incomplete -> INCOMPLETE
        unpaid    -> UNPAID

    Returns None silently for known unmapped statuses (incomplete_expired,
    paused). Returns None with a warning for truly unknown statuses.

    Args:
        stripe_status: Stripe subscription status string, or None.

    Returns:
        SubscriptionStatus enum value, or None if unmapped/unknown/empty.
    """
    if not stripe_status:
        return None

    result = _STRIPE_STATUS_MAP.get(stripe_status)

    if result is None and stripe_status not in _KNOWN_UNMAPPED_STATUSES:
        logger.warning(
            "Unknown Stripe subscription status",
            stripe_status=stripe_status,
        )

    return result
