"""Billing schemas for checkout and subscription management."""

from pydantic import BaseModel, Field

from src.db.models import BillingCycle


class CheckoutRequest(BaseModel):
    """Schema for creating a checkout session."""

    billing_cycle: BillingCycle = Field(..., description="Billing cycle for the subscription")
    promo_code: str | None = Field(None, max_length=50, description="Optional promotion code")


class CheckoutResponse(BaseModel):
    """Schema for checkout session response."""

    checkout_url: str = Field(..., description="Stripe checkout session URL")
    session_id: str = Field(..., description="Stripe checkout session ID")


class VerifyCheckoutRequest(BaseModel):
    """Schema for verifying a checkout session."""

    session_id: str = Field(
        ..., min_length=1, max_length=255, description="Stripe checkout session ID"
    )


class VerifyCheckoutResponse(BaseModel):
    """Schema for checkout verification response."""

    status: str = Field(..., description="Verification status: activated or already_active")
    subscription_tier: str = Field(..., description="Subscription tier after verification")
    billing_cycle: str = Field(..., description="Billing cycle for the subscription")
    subscription_status: str = Field(..., description="Current subscription status")
