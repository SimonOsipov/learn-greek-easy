"""Billing endpoints for checkout and subscription management."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.dependencies import get_current_user
from src.core.exceptions import AlreadyPremiumException, BillingNotConfiguredException
from src.core.posthog import capture_event
from src.db.dependencies import get_db
from src.db.models import SubscriptionStatus, SubscriptionTier, User
from src.schemas.billing import CheckoutRequest, CheckoutResponse
from src.services.checkout_service import CheckoutService

router = APIRouter(
    tags=["Billing"],
    responses={
        401: {"description": "Not authenticated"},
        422: {"description": "Validation error"},
    },
)


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
        current_user, body.billing_cycle
    )

    capture_event(
        distinct_id=str(current_user.id),
        event="checkout_session_created",
        properties={
            "billing_cycle": body.billing_cycle.value,
            "is_trialing": current_user.subscription_status == SubscriptionStatus.TRIALING,
            "user_id": str(current_user.id),
        },
        user_email=current_user.email,
    )

    return CheckoutResponse(checkout_url=checkout_url, session_id=session_id)
