"""Billing endpoints for checkout and subscription management."""

from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.billing_utils import _build_price_to_cycle_map
from src.core.dependencies import get_current_user
from src.core.exceptions import AlreadyPremiumException, BillingNotConfiguredException
from src.core.logging import get_logger
from src.core.posthog import capture_event
from src.core.stripe import get_stripe_client, is_stripe_configured
from src.core.subscription import get_effective_access_level
from src.db.dependencies import get_db
from src.db.models import BillingCycle, SubscriptionStatus, SubscriptionTier, User
from src.schemas.billing import (
    BillingStatusResponse,
    CheckoutRequest,
    CheckoutResponse,
    PricingPlan,
    VerifyCheckoutRequest,
    VerifyCheckoutResponse,
)
from src.services.checkout_service import CheckoutService

router = APIRouter(
    tags=["Billing"],
    responses={
        401: {"description": "Not authenticated"},
        422: {"description": "Validation error"},
    },
)

logger = get_logger(__name__)

_INTERVAL_COUNT_MAP = {
    BillingCycle.MONTHLY: 1,
    BillingCycle.QUARTERLY: 3,
    BillingCycle.SEMI_ANNUAL: 6,
}


@router.post(
    "/checkout/premium",
    response_model=CheckoutResponse,
    status_code=status.HTTP_200_OK,
)
async def create_checkout_session(
    body: CheckoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CheckoutResponse:
    """Create a Stripe checkout session for premium subscription."""
    if not settings.stripe_configured:
        raise BillingNotConfiguredException()

    if (
        current_user.subscription_tier == SubscriptionTier.PREMIUM
        and current_user.subscription_status
        in (SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE)
    ):
        raise AlreadyPremiumException()

    service = CheckoutService(db)
    checkout_url, session_id = await service.create_checkout_session(
        current_user, body.billing_cycle, promo_code=body.promo_code
    )

    capture_event(
        distinct_id=str(current_user.id),
        event="checkout_session_created",
        properties={
            "billing_cycle": body.billing_cycle.value,
            "is_trialing": current_user.subscription_status == SubscriptionStatus.TRIALING,
            "user_id": str(current_user.id),
            "has_promo_code": bool(body.promo_code),
            "promo_code": body.promo_code or None,
        },
        user_email=current_user.email,
    )

    return CheckoutResponse(checkout_url=checkout_url, session_id=session_id)


@router.post(
    "/checkout/verify",
    response_model=VerifyCheckoutResponse,
    status_code=status.HTTP_200_OK,
)
async def verify_checkout(
    body: VerifyCheckoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VerifyCheckoutResponse:
    """Verify a Stripe checkout session and activate subscription."""
    if not settings.stripe_configured:
        raise BillingNotConfiguredException()

    service = CheckoutService(db)
    try:
        result = await service.verify_and_activate(current_user, body.session_id)
    except stripe.StripeError as e:
        logger.error(
            "Stripe API error during checkout verification",
            error=str(e),
            session_id=body.session_id,
            user_id=str(current_user.id),
        )
        capture_event(
            distinct_id=str(current_user.id),
            event="checkout_verify_failed",
            properties={
                "error_type": "stripe_api_error",
                "session_id": body.session_id,
            },
            user_email=current_user.email,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify checkout session",
        )

    return VerifyCheckoutResponse(**result)


def _compute_savings(
    unit_amount: int, cycle: BillingCycle, monthly_unit_amount: int | None
) -> int | None:
    """Compute savings percentage vs monthly price. Returns None for monthly or when not computable."""
    if cycle == BillingCycle.MONTHLY or not monthly_unit_amount or monthly_unit_amount <= 0:
        return None
    count = _INTERVAL_COUNT_MAP.get(cycle, 1)
    per_month = unit_amount / count
    return round((1 - per_month / monthly_unit_amount) * 100)


async def _fetch_stripe_prices(
    client: stripe.StripeClient, price_to_cycle: dict[str, BillingCycle]
) -> tuple[dict[str, tuple], int | None]:
    """Fetch Stripe prices and return (fetched mapping, monthly_unit_amount)."""
    fetched: dict[str, tuple] = {}
    monthly_unit_amount: int | None = None
    for price_id, cycle in price_to_cycle.items():
        try:
            stripe_price = await client.v1.prices.retrieve_async(price_id)
            fetched[price_id] = (stripe_price, cycle)
            if cycle == BillingCycle.MONTHLY:
                monthly_unit_amount = stripe_price.unit_amount
        except Exception:
            logger.warning("Failed to fetch Stripe price", price_id=price_id, cycle=cycle.value)
    return fetched, monthly_unit_amount


async def _fetch_pricing() -> list[PricingPlan]:
    if not is_stripe_configured():
        return []
    try:
        client = get_stripe_client()
    except RuntimeError:
        return []
    price_to_cycle = _build_price_to_cycle_map()
    if not price_to_cycle:
        return []
    fetched, monthly_unit_amount = await _fetch_stripe_prices(client, price_to_cycle)
    plans: list[PricingPlan] = []
    for _price_id, (stripe_price, cycle) in fetched.items():
        plans.append(
            PricingPlan(
                billing_cycle=cycle.value,
                price_amount=stripe_price.unit_amount,
                price_formatted=f"{stripe_price.unit_amount / 100:.2f}",
                currency=stripe_price.currency,
                interval=stripe_price.recurring.interval,
                interval_count=stripe_price.recurring.interval_count,
                savings_percent=_compute_savings(
                    stripe_price.unit_amount, cycle, monthly_unit_amount
                ),
            )
        )
    return plans


@router.get("/status", response_model=BillingStatusResponse, status_code=status.HTTP_200_OK)
async def get_billing_status(
    current_user: User = Depends(get_current_user),
) -> BillingStatusResponse:
    trial_days_remaining: int | None = None
    if current_user.trial_end_date:
        remaining = (current_user.trial_end_date - datetime.now(timezone.utc)).days
        trial_days_remaining = max(0, remaining)
    effective_tier = get_effective_access_level(current_user)
    pricing = await _fetch_pricing()
    return BillingStatusResponse(
        subscription_status=current_user.subscription_status.value,
        subscription_tier=current_user.subscription_tier.value,
        trial_end_date=current_user.trial_end_date,
        trial_days_remaining=trial_days_remaining,
        billing_cycle=current_user.billing_cycle.value if current_user.billing_cycle else None,
        is_premium=(effective_tier == SubscriptionTier.PREMIUM),
        pricing=pricing,
    )
