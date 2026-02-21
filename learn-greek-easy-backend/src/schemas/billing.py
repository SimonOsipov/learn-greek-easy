"""Billing schemas for checkout and subscription management."""

from datetime import datetime
from typing import Literal

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


class PricingPlan(BaseModel):
    billing_cycle: str = Field(..., description="Billing cycle: monthly, quarterly, semi_annual")
    price_amount: int = Field(..., description="Price in smallest currency unit (e.g., cents)")
    price_formatted: str = Field(..., description="Human-readable price string (e.g., '29.00')")
    currency: str = Field(..., description="Currency code (e.g., 'eur')")
    interval: str = Field(..., description="Stripe interval (e.g., 'month')")
    interval_count: int = Field(..., description="Stripe interval count (1, 3, 6)")
    savings_percent: int | None = Field(
        None, description="Savings vs monthly, None if monthly or not computable"
    )


class BillingStatusResponse(BaseModel):
    subscription_status: str
    subscription_tier: str
    trial_end_date: datetime | None = None
    trial_days_remaining: int | None = None
    billing_cycle: str | None = None
    is_premium: bool
    pricing: list[PricingPlan] = Field(default_factory=list)
    # Subscription period and price fields (BP-10)
    current_period_end: datetime | None = None
    cancel_at_period_end: bool = False
    current_price_amount: int | None = None
    current_price_formatted: str | None = None
    current_price_currency: str | None = None


class ChangePlanRequest(BaseModel):
    billing_cycle: Literal["monthly", "quarterly", "semi_annual"]
