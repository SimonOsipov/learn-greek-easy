"""Subscription enforcement for premium feature gating.

Single source of truth for: "Does this user have premium access?"
Exports: get_effective_access_level, require_premium, check_premium_deck_access
"""

from datetime import datetime, timezone

from fastapi import Depends

from src.core.dependencies import get_current_user
from src.core.exceptions import PremiumRequiredException
from src.core.posthog import capture_event
from src.db.models import Deck, SubscriptionStatus, SubscriptionTier, User

__all__ = ["check_premium_deck_access", "get_effective_access_level", "require_premium"]

_PREMIUM_STATUSES = frozenset(
    {
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.PAST_DUE,
    }
)


def get_effective_access_level(user: User) -> SubscriptionTier:
    """Derive effective access from subscription_status + superuser flag.

    NOTE: subscription_tier column is NOT checked. A trialing user has
    tier=free in the DB but gets PREMIUM access via this function.
    """
    if user.is_superuser:
        return SubscriptionTier.PREMIUM

    if user.subscription_status == SubscriptionStatus.TRIALING:
        if user.trial_end_date is not None and user.trial_end_date < datetime.now(timezone.utc):
            return SubscriptionTier.FREE
        return SubscriptionTier.PREMIUM

    if user.subscription_status in _PREMIUM_STATUSES:
        return SubscriptionTier.PREMIUM
    return SubscriptionTier.FREE


async def require_premium(
    current_user: User = Depends(get_current_user),
) -> User:
    """FastAPI dependency that enforces premium access.

    Use as: current_user: User = Depends(require_premium)
    Raises HTTP 403 with PremiumRequiredException for FREE users.
    """
    effective = get_effective_access_level(current_user)
    if effective == SubscriptionTier.FREE:
        trial_eligible = current_user.subscription_status == SubscriptionStatus.NONE
        capture_event(
            distinct_id=str(current_user.id),
            event="premium_gate_blocked",
            properties={
                "gate_type": "require_premium",
                "deck_id": None,
                "current_tier": SubscriptionTier.FREE.value,
                "subscription_status": current_user.subscription_status.value,
                "trial_eligible": trial_eligible,
            },
            user_email=current_user.email,
        )
        raise PremiumRequiredException(
            detail="Premium subscription required for this feature",
            current_tier=SubscriptionTier.FREE.value,
            trial_eligible=trial_eligible,
            gate_type="require_premium",
        )
    return current_user


def check_premium_deck_access(user: User, deck: Deck) -> None:
    """Check if user can access a premium deck.

    No-op if the deck is not premium. Raises HTTP 403 if deck is
    premium and user does not have premium access.
    """
    if not deck.is_premium:
        return
    effective = get_effective_access_level(user)
    if effective == SubscriptionTier.FREE:
        trial_eligible = user.subscription_status == SubscriptionStatus.NONE
        capture_event(
            distinct_id=str(user.id),
            event="premium_gate_blocked",
            properties={
                "gate_type": "premium_deck",
                "deck_id": str(deck.id),
                "current_tier": SubscriptionTier.FREE.value,
                "subscription_status": user.subscription_status.value,
                "trial_eligible": trial_eligible,
            },
            user_email=user.email,
        )
        raise PremiumRequiredException(
            detail="This deck requires a Premium subscription",
            current_tier=SubscriptionTier.FREE.value,
            trial_eligible=trial_eligible,
            gate_type="premium_deck",
            deck_id=str(deck.id),
        )
