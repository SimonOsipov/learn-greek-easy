"""Unit tests for subscription enforcement module (src/core/subscription.py).

Tests cover:
- get_effective_access_level: Status-to-tier mapping logic, superuser override
- require_premium: FastAPI dependency raising 403 for FREE users
- check_premium_deck_access: Per-deck premium enforcement, no-op for free decks
- PremiumRequiredException: Structured extra payload

Acceptance Criteria tested:
- AC-1: Module exists with docstring and __all__ exports
- AC-2: get_effective_access_level implemented as pure function
- AC-3: Status-to-access matrix (ACTIVE/TRIALING/PAST_DUE -> PREMIUM; others -> FREE)
- AC-4: Superuser override always returns PREMIUM
- AC-5: require_premium raises HTTP 403 with PremiumRequiredException for FREE users
- AC-6: check_premium_deck_access raises 403 if deck.is_premium and user is FREE
- AC-7: PremiumRequiredException carries required_tier, current_tier, trial_eligible in extra
- AC-8: trial_eligible is True when subscription_status == NONE, False otherwise
- AC-9: PostHog premium_gate_blocked event fired with correct properties
- AC-10: require_premium is NOT applied to any endpoint
- AC-11: Existing tests still pass
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from src.core.exceptions import PremiumRequiredException
from src.core.subscription import (
    _PREMIUM_STATUSES,
    check_premium_deck_access,
    get_effective_access_level,
    require_premium,
)
from src.db.models import SubscriptionStatus, SubscriptionTier

# =============================================================================
# Helpers
# =============================================================================


def _make_user(
    subscription_status: SubscriptionStatus = SubscriptionStatus.NONE,
    is_superuser: bool = False,
    subscription_tier: SubscriptionTier = SubscriptionTier.FREE,
    trial_end_date: datetime | None = None,
) -> MagicMock:
    """Create a minimal User mock with subscription fields."""
    user = MagicMock()
    user.id = uuid4()
    user.email = "user@example.com"
    user.subscription_status = subscription_status
    user.subscription_tier = subscription_tier
    user.is_superuser = is_superuser
    user.trial_end_date = trial_end_date
    return user


def _make_deck(is_premium: bool = False) -> MagicMock:
    """Create a minimal Deck mock."""
    deck = MagicMock()
    deck.id = uuid4()
    deck.is_premium = is_premium
    return deck


# =============================================================================
# AC-1: Module structure
# =============================================================================


@pytest.mark.unit
@pytest.mark.stripe
class TestModuleStructure:
    """Verify module-level declarations required by AC-1."""

    def test_module_has_docstring(self):
        """Module-level docstring must mention its purpose."""
        import src.core.subscription as subscription_module

        assert subscription_module.__doc__ is not None
        assert len(subscription_module.__doc__.strip()) > 0

    def test_all_exports_declared(self):
        """__all__ must export the three public symbols."""
        from src.core.subscription import __all__

        assert "get_effective_access_level" in __all__
        assert "require_premium" in __all__
        assert "check_premium_deck_access" in __all__

    def test_exactly_three_public_symbols(self):
        """__all__ must contain exactly three entries."""
        from src.core.subscription import __all__

        assert len(__all__) == 3

    def test_premium_statuses_frozenset(self):
        """_PREMIUM_STATUSES must be a frozenset."""
        assert isinstance(_PREMIUM_STATUSES, frozenset)

    def test_premium_statuses_contains_exactly_two(self):
        """_PREMIUM_STATUSES must contain ACTIVE, PAST_DUE only (TRIALING handled separately)."""
        assert _PREMIUM_STATUSES == frozenset(
            {
                SubscriptionStatus.ACTIVE,
                SubscriptionStatus.PAST_DUE,
            }
        )

    def test_core_init_exports_get_effective_access_level(self):
        """src.core.__init__ must re-export get_effective_access_level."""
        from src.core import get_effective_access_level as fn

        assert fn is not None

    def test_core_init_exports_require_premium(self):
        """src.core.__init__ must re-export require_premium."""
        from src.core import require_premium as fn

        assert fn is not None

    def test_core_init_exports_check_premium_deck_access(self):
        """src.core.__init__ must re-export check_premium_deck_access."""
        from src.core import check_premium_deck_access as fn

        assert fn is not None


# =============================================================================
# AC-2 & AC-3: get_effective_access_level - status-to-tier matrix
# =============================================================================


@pytest.mark.unit
@pytest.mark.stripe
class TestGetEffectiveAccessLevelPremiumStatuses:
    """AC-3: ACTIVE, TRIALING, PAST_DUE statuses yield PREMIUM tier."""

    def test_active_returns_premium(self):
        """ACTIVE subscription status yields PREMIUM access."""
        user = _make_user(subscription_status=SubscriptionStatus.ACTIVE)
        assert get_effective_access_level(user) == SubscriptionTier.PREMIUM

    def test_trialing_returns_premium(self):
        """TRIALING subscription status with active trial yields PREMIUM access."""
        user = _make_user(
            subscription_status=SubscriptionStatus.TRIALING,
            trial_end_date=datetime.now(timezone.utc) + timedelta(days=7),
        )
        assert get_effective_access_level(user) == SubscriptionTier.PREMIUM

    def test_past_due_returns_premium(self):
        """PAST_DUE subscription status yields PREMIUM access."""
        user = _make_user(subscription_status=SubscriptionStatus.PAST_DUE)
        assert get_effective_access_level(user) == SubscriptionTier.PREMIUM


@pytest.mark.unit
@pytest.mark.stripe
class TestGetEffectiveAccessLevelFreeStatuses:
    """AC-3: NONE, CANCELED, INCOMPLETE, UNPAID statuses yield FREE tier."""

    def test_none_returns_free(self):
        """NONE subscription status yields FREE access."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE)
        assert get_effective_access_level(user) == SubscriptionTier.FREE

    def test_canceled_returns_free(self):
        """CANCELED subscription status yields FREE access."""
        user = _make_user(subscription_status=SubscriptionStatus.CANCELED)
        assert get_effective_access_level(user) == SubscriptionTier.FREE

    def test_incomplete_returns_free(self):
        """INCOMPLETE subscription status yields FREE access."""
        user = _make_user(subscription_status=SubscriptionStatus.INCOMPLETE)
        assert get_effective_access_level(user) == SubscriptionTier.FREE

    def test_unpaid_returns_free(self):
        """UNPAID subscription status yields FREE access."""
        user = _make_user(subscription_status=SubscriptionStatus.UNPAID)
        assert get_effective_access_level(user) == SubscriptionTier.FREE


@pytest.mark.unit
@pytest.mark.stripe
class TestGetEffectiveAccessLevelReturnType:
    """AC-2: get_effective_access_level is a pure function returning SubscriptionTier."""

    def test_returns_subscription_tier_instance(self):
        """Return value must be a SubscriptionTier enum member."""
        user = _make_user(subscription_status=SubscriptionStatus.ACTIVE)
        result = get_effective_access_level(user)
        assert isinstance(result, SubscriptionTier)

    def test_is_pure_function_same_input_same_output(self):
        """Calling twice with same user produces same result (pure function)."""
        user = _make_user(subscription_status=SubscriptionStatus.ACTIVE)
        assert get_effective_access_level(user) == get_effective_access_level(user)

    def test_does_not_modify_user(self):
        """Function must not modify the user object."""
        user = _make_user(subscription_status=SubscriptionStatus.ACTIVE)
        original_status = user.subscription_status
        original_superuser = user.is_superuser
        get_effective_access_level(user)
        assert user.subscription_status == original_status
        assert user.is_superuser == original_superuser


# =============================================================================
# AC-4: Superuser override
# =============================================================================


@pytest.mark.unit
@pytest.mark.stripe
class TestGetEffectiveAccessLevelSuperuserOverride:
    """AC-4: is_superuser == True always returns PREMIUM regardless of status."""

    def test_superuser_with_none_status_returns_premium(self):
        """Superuser with NONE status still gets PREMIUM."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE, is_superuser=True)
        assert get_effective_access_level(user) == SubscriptionTier.PREMIUM

    def test_superuser_with_canceled_status_returns_premium(self):
        """Superuser with CANCELED status still gets PREMIUM."""
        user = _make_user(subscription_status=SubscriptionStatus.CANCELED, is_superuser=True)
        assert get_effective_access_level(user) == SubscriptionTier.PREMIUM

    def test_superuser_with_unpaid_status_returns_premium(self):
        """Superuser with UNPAID status still gets PREMIUM."""
        user = _make_user(subscription_status=SubscriptionStatus.UNPAID, is_superuser=True)
        assert get_effective_access_level(user) == SubscriptionTier.PREMIUM

    def test_superuser_with_incomplete_status_returns_premium(self):
        """Superuser with INCOMPLETE status still gets PREMIUM."""
        user = _make_user(subscription_status=SubscriptionStatus.INCOMPLETE, is_superuser=True)
        assert get_effective_access_level(user) == SubscriptionTier.PREMIUM

    def test_superuser_with_active_status_returns_premium(self):
        """Superuser with ACTIVE status still returns PREMIUM."""
        user = _make_user(subscription_status=SubscriptionStatus.ACTIVE, is_superuser=True)
        assert get_effective_access_level(user) == SubscriptionTier.PREMIUM

    def test_non_superuser_with_none_status_returns_free(self):
        """is_superuser == False with NONE status correctly returns FREE."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE, is_superuser=False)
        assert get_effective_access_level(user) == SubscriptionTier.FREE


# =============================================================================
# AC-5: require_premium FastAPI dependency
# =============================================================================


@pytest.mark.unit
@pytest.mark.stripe
class TestRequirePremiumRaisesForFreeUsers:
    """AC-5: require_premium raises HTTP 403 PremiumRequiredException for FREE users."""

    @pytest.mark.asyncio
    async def test_free_user_raises_403(self):
        """FREE user triggers PremiumRequiredException."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE)
        with patch("src.core.subscription.capture_event"):
            with pytest.raises(PremiumRequiredException) as exc_info:
                await require_premium(current_user=user)
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_canceled_user_raises_403(self):
        """User with CANCELED status gets blocked at the gate."""
        user = _make_user(subscription_status=SubscriptionStatus.CANCELED)
        with patch("src.core.subscription.capture_event"):
            with pytest.raises(PremiumRequiredException):
                await require_premium(current_user=user)

    @pytest.mark.asyncio
    async def test_incomplete_user_raises_403(self):
        """User with INCOMPLETE status gets blocked at the gate."""
        user = _make_user(subscription_status=SubscriptionStatus.INCOMPLETE)
        with patch("src.core.subscription.capture_event"):
            with pytest.raises(PremiumRequiredException):
                await require_premium(current_user=user)

    @pytest.mark.asyncio
    async def test_unpaid_user_raises_403(self):
        """User with UNPAID status gets blocked at the gate."""
        user = _make_user(subscription_status=SubscriptionStatus.UNPAID)
        with patch("src.core.subscription.capture_event"):
            with pytest.raises(PremiumRequiredException):
                await require_premium(current_user=user)

    @pytest.mark.asyncio
    async def test_exception_error_code_is_premium_required(self):
        """Raised exception must carry error_code PREMIUM_REQUIRED."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE)
        with patch("src.core.subscription.capture_event"):
            with pytest.raises(PremiumRequiredException) as exc_info:
                await require_premium(current_user=user)
        assert exc_info.value.error_code == "PREMIUM_REQUIRED"


@pytest.mark.unit
@pytest.mark.stripe
class TestRequirePremiumAllowsPremiumUsers:
    """AC-5: require_premium returns user when access is PREMIUM."""

    @pytest.mark.asyncio
    async def test_active_user_passes_through(self):
        """ACTIVE user is returned from require_premium."""
        user = _make_user(subscription_status=SubscriptionStatus.ACTIVE)
        result = await require_premium(current_user=user)
        assert result is user

    @pytest.mark.asyncio
    async def test_trialing_user_passes_through(self):
        """TRIALING user with active trial is returned from require_premium."""
        user = _make_user(
            subscription_status=SubscriptionStatus.TRIALING,
            trial_end_date=datetime.now(timezone.utc) + timedelta(days=7),
        )
        result = await require_premium(current_user=user)
        assert result is user

    @pytest.mark.asyncio
    async def test_past_due_user_passes_through(self):
        """PAST_DUE user is returned from require_premium."""
        user = _make_user(subscription_status=SubscriptionStatus.PAST_DUE)
        result = await require_premium(current_user=user)
        assert result is user

    @pytest.mark.asyncio
    async def test_superuser_passes_through_with_none_status(self):
        """Superuser with NONE status is returned from require_premium."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE, is_superuser=True)
        result = await require_premium(current_user=user)
        assert result is user


# =============================================================================
# AC-7 & AC-8: PremiumRequiredException extra payload
# =============================================================================


@pytest.mark.unit
@pytest.mark.stripe
class TestPremiumRequiredExceptionPayload:
    """AC-7: extra dict carries required_tier, current_tier, trial_eligible."""

    def test_extra_contains_required_tier(self):
        """extra['required_tier'] must be 'premium'."""
        exc = PremiumRequiredException()
        assert exc.extra["required_tier"] == "premium"

    def test_extra_contains_current_tier(self):
        """extra['current_tier'] must be set from constructor arg."""
        exc = PremiumRequiredException(current_tier="free")
        assert exc.extra["current_tier"] == "free"

    def test_extra_contains_trial_eligible(self):
        """extra['trial_eligible'] must be present."""
        exc = PremiumRequiredException(trial_eligible=True)
        assert exc.extra["trial_eligible"] is True

    def test_extra_trial_eligible_default_false(self):
        """trial_eligible defaults to False."""
        exc = PremiumRequiredException()
        assert exc.extra["trial_eligible"] is False

    def test_extra_has_exactly_three_keys(self):
        """extra dict must have exactly required_tier, current_tier, trial_eligible."""
        exc = PremiumRequiredException()
        assert set(exc.extra.keys()) == {"required_tier", "current_tier", "trial_eligible"}

    def test_status_code_is_403(self):
        """PremiumRequiredException must produce HTTP 403."""
        exc = PremiumRequiredException()
        assert exc.status_code == 403

    def test_error_code_is_premium_required(self):
        """error_code must equal PREMIUM_REQUIRED."""
        exc = PremiumRequiredException()
        assert exc.error_code == "PREMIUM_REQUIRED"

    def test_gate_type_stored_on_private_attr(self):
        """gate_type kwarg is stored as _gate_type (not in extra)."""
        exc = PremiumRequiredException(gate_type="premium_deck")
        assert exc._gate_type == "premium_deck"
        assert "gate_type" not in exc.extra

    def test_deck_id_stored_on_private_attr(self):
        """deck_id kwarg is stored as _deck_id (not in extra)."""
        deck_id = str(uuid4())
        exc = PremiumRequiredException(deck_id=deck_id)
        assert exc._deck_id == deck_id
        assert "deck_id" not in exc.extra

    def test_deck_id_defaults_to_none(self):
        """deck_id defaults to None."""
        exc = PremiumRequiredException()
        assert exc._deck_id is None


@pytest.mark.unit
@pytest.mark.stripe
class TestTrialEligible:
    """AC-8: trial_eligible logic - True only when subscription_status == NONE."""

    @pytest.mark.asyncio
    async def test_require_premium_trial_eligible_true_when_none(self):
        """require_premium sets trial_eligible=True for NONE status (never subscribed)."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE)
        with patch("src.core.subscription.capture_event"):
            with pytest.raises(PremiumRequiredException) as exc_info:
                await require_premium(current_user=user)
        assert exc_info.value.extra["trial_eligible"] is True

    @pytest.mark.asyncio
    async def test_require_premium_trial_eligible_false_when_canceled(self):
        """require_premium sets trial_eligible=False for CANCELED (previously subscribed)."""
        user = _make_user(subscription_status=SubscriptionStatus.CANCELED)
        with patch("src.core.subscription.capture_event"):
            with pytest.raises(PremiumRequiredException) as exc_info:
                await require_premium(current_user=user)
        assert exc_info.value.extra["trial_eligible"] is False

    @pytest.mark.asyncio
    async def test_require_premium_trial_eligible_false_when_incomplete(self):
        """require_premium sets trial_eligible=False for INCOMPLETE."""
        user = _make_user(subscription_status=SubscriptionStatus.INCOMPLETE)
        with patch("src.core.subscription.capture_event"):
            with pytest.raises(PremiumRequiredException) as exc_info:
                await require_premium(current_user=user)
        assert exc_info.value.extra["trial_eligible"] is False

    @pytest.mark.asyncio
    async def test_require_premium_trial_eligible_false_when_unpaid(self):
        """require_premium sets trial_eligible=False for UNPAID."""
        user = _make_user(subscription_status=SubscriptionStatus.UNPAID)
        with patch("src.core.subscription.capture_event"):
            with pytest.raises(PremiumRequiredException) as exc_info:
                await require_premium(current_user=user)
        assert exc_info.value.extra["trial_eligible"] is False

    def test_check_premium_deck_trial_eligible_true_when_none(self):
        """check_premium_deck_access sets trial_eligible=True for NONE status."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE)
        deck = _make_deck(is_premium=True)
        with patch("src.core.subscription.capture_event"):
            with pytest.raises(PremiumRequiredException) as exc_info:
                check_premium_deck_access(user, deck)
        assert exc_info.value.extra["trial_eligible"] is True

    def test_check_premium_deck_trial_eligible_false_when_canceled(self):
        """check_premium_deck_access sets trial_eligible=False for CANCELED."""
        user = _make_user(subscription_status=SubscriptionStatus.CANCELED)
        deck = _make_deck(is_premium=True)
        with patch("src.core.subscription.capture_event"):
            with pytest.raises(PremiumRequiredException) as exc_info:
                check_premium_deck_access(user, deck)
        assert exc_info.value.extra["trial_eligible"] is False


# =============================================================================
# AC-6: check_premium_deck_access
# =============================================================================


@pytest.mark.unit
@pytest.mark.stripe
class TestCheckPremiumDeckAccessNonPremiumDeck:
    """AC-6 / AC-7 in spec: check_premium_deck_access is no-op for non-premium decks."""

    def test_free_deck_free_user_no_exception(self):
        """Non-premium deck with FREE user raises no exception."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE)
        deck = _make_deck(is_premium=False)
        # Should return None without raising
        result = check_premium_deck_access(user, deck)
        assert result is None

    def test_free_deck_premium_user_no_exception(self):
        """Non-premium deck with PREMIUM user raises no exception."""
        user = _make_user(subscription_status=SubscriptionStatus.ACTIVE)
        deck = _make_deck(is_premium=False)
        result = check_premium_deck_access(user, deck)
        assert result is None

    def test_free_deck_no_posthog_event_fired(self):
        """PostHog must NOT be called for non-premium decks."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE)
        deck = _make_deck(is_premium=False)
        with patch("src.core.subscription.capture_event") as mock_capture:
            check_premium_deck_access(user, deck)
        mock_capture.assert_not_called()


@pytest.mark.unit
@pytest.mark.stripe
class TestCheckPremiumDeckAccessPremiumDeckFreeUser:
    """AC-6: premium deck + FREE user raises HTTP 403."""

    def test_premium_deck_free_user_raises_403(self):
        """Premium deck with FREE user raises PremiumRequiredException."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE)
        deck = _make_deck(is_premium=True)
        with patch("src.core.subscription.capture_event"):
            with pytest.raises(PremiumRequiredException) as exc_info:
                check_premium_deck_access(user, deck)
        assert exc_info.value.status_code == 403

    def test_premium_deck_canceled_user_raises_403(self):
        """Premium deck with CANCELED user raises 403."""
        user = _make_user(subscription_status=SubscriptionStatus.CANCELED)
        deck = _make_deck(is_premium=True)
        with patch("src.core.subscription.capture_event"):
            with pytest.raises(PremiumRequiredException):
                check_premium_deck_access(user, deck)

    def test_premium_deck_free_user_exception_includes_deck_id(self):
        """Raised exception must carry deck_id on _deck_id attribute."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE)
        deck = _make_deck(is_premium=True)
        with patch("src.core.subscription.capture_event"):
            with pytest.raises(PremiumRequiredException) as exc_info:
                check_premium_deck_access(user, deck)
        assert exc_info.value._deck_id == str(deck.id)

    def test_premium_deck_free_user_exception_gate_type_is_premium_deck(self):
        """Raised exception _gate_type must be 'premium_deck'."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE)
        deck = _make_deck(is_premium=True)
        with patch("src.core.subscription.capture_event"):
            with pytest.raises(PremiumRequiredException) as exc_info:
                check_premium_deck_access(user, deck)
        assert exc_info.value._gate_type == "premium_deck"


@pytest.mark.unit
@pytest.mark.stripe
class TestCheckPremiumDeckAccessPremiumDeckPremiumUser:
    """AC-6: premium deck + PREMIUM user raises no exception."""

    def test_premium_deck_active_user_no_exception(self):
        """Premium deck with ACTIVE user raises no exception."""
        user = _make_user(subscription_status=SubscriptionStatus.ACTIVE)
        deck = _make_deck(is_premium=True)
        result = check_premium_deck_access(user, deck)
        assert result is None

    def test_premium_deck_trialing_user_no_exception(self):
        """Premium deck with TRIALING user (active trial) raises no exception."""
        user = _make_user(
            subscription_status=SubscriptionStatus.TRIALING,
            trial_end_date=datetime.now(timezone.utc) + timedelta(days=7),
        )
        deck = _make_deck(is_premium=True)
        result = check_premium_deck_access(user, deck)
        assert result is None

    def test_premium_deck_past_due_user_no_exception(self):
        """Premium deck with PAST_DUE user raises no exception."""
        user = _make_user(subscription_status=SubscriptionStatus.PAST_DUE)
        deck = _make_deck(is_premium=True)
        result = check_premium_deck_access(user, deck)
        assert result is None

    def test_premium_deck_superuser_no_exception(self):
        """Premium deck with superuser (NONE status) raises no exception."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE, is_superuser=True)
        deck = _make_deck(is_premium=True)
        result = check_premium_deck_access(user, deck)
        assert result is None


# =============================================================================
# AC-9: PostHog event properties
# =============================================================================


@pytest.mark.unit
@pytest.mark.stripe
class TestPostHogEventRequirePremium:
    """AC-9: require_premium fires premium_gate_blocked with correct properties."""

    @pytest.mark.asyncio
    async def test_event_name_is_premium_gate_blocked(self):
        """Event name must be 'premium_gate_blocked'."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE)
        with patch("src.core.subscription.capture_event") as mock_capture:
            with pytest.raises(PremiumRequiredException):
                await require_premium(current_user=user)
        mock_capture.assert_called_once()
        _, kwargs = mock_capture.call_args
        assert kwargs["event"] == "premium_gate_blocked"

    @pytest.mark.asyncio
    async def test_event_distinct_id_is_user_id(self):
        """distinct_id property must be str(user.id)."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE)
        with patch("src.core.subscription.capture_event") as mock_capture:
            with pytest.raises(PremiumRequiredException):
                await require_premium(current_user=user)
        _, kwargs = mock_capture.call_args
        assert kwargs["distinct_id"] == str(user.id)

    @pytest.mark.asyncio
    async def test_event_user_email_passed(self):
        """user_email must be passed to capture_event."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE)
        with patch("src.core.subscription.capture_event") as mock_capture:
            with pytest.raises(PremiumRequiredException):
                await require_premium(current_user=user)
        _, kwargs = mock_capture.call_args
        assert kwargs["user_email"] == user.email

    @pytest.mark.asyncio
    async def test_event_properties_gate_type_require_premium(self):
        """properties['gate_type'] must be 'require_premium'."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE)
        with patch("src.core.subscription.capture_event") as mock_capture:
            with pytest.raises(PremiumRequiredException):
                await require_premium(current_user=user)
        _, kwargs = mock_capture.call_args
        props = kwargs["properties"]
        assert props["gate_type"] == "require_premium"

    @pytest.mark.asyncio
    async def test_event_properties_deck_id_is_none(self):
        """properties['deck_id'] must be None for require_premium gate."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE)
        with patch("src.core.subscription.capture_event") as mock_capture:
            with pytest.raises(PremiumRequiredException):
                await require_premium(current_user=user)
        _, kwargs = mock_capture.call_args
        props = kwargs["properties"]
        assert props["deck_id"] is None

    @pytest.mark.asyncio
    async def test_event_properties_current_tier_is_free(self):
        """properties['current_tier'] must be 'free'."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE)
        with patch("src.core.subscription.capture_event") as mock_capture:
            with pytest.raises(PremiumRequiredException):
                await require_premium(current_user=user)
        _, kwargs = mock_capture.call_args
        props = kwargs["properties"]
        assert props["current_tier"] == SubscriptionTier.FREE.value

    @pytest.mark.asyncio
    async def test_event_properties_subscription_status_value(self):
        """properties['subscription_status'] must be the status value string."""
        user = _make_user(subscription_status=SubscriptionStatus.CANCELED)
        with patch("src.core.subscription.capture_event") as mock_capture:
            with pytest.raises(PremiumRequiredException):
                await require_premium(current_user=user)
        _, kwargs = mock_capture.call_args
        props = kwargs["properties"]
        assert props["subscription_status"] == SubscriptionStatus.CANCELED.value

    @pytest.mark.asyncio
    async def test_event_properties_trial_eligible_matches_exception(self):
        """properties['trial_eligible'] must match exception extra['trial_eligible']."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE)
        with patch("src.core.subscription.capture_event") as mock_capture:
            with pytest.raises(PremiumRequiredException) as exc_info:
                await require_premium(current_user=user)
        _, kwargs = mock_capture.call_args
        props = kwargs["properties"]
        assert props["trial_eligible"] == exc_info.value.extra["trial_eligible"]

    @pytest.mark.asyncio
    async def test_event_not_fired_for_premium_user(self):
        """PostHog must NOT be called when user passes the premium gate."""
        user = _make_user(subscription_status=SubscriptionStatus.ACTIVE)
        with patch("src.core.subscription.capture_event") as mock_capture:
            await require_premium(current_user=user)
        mock_capture.assert_not_called()


@pytest.mark.unit
@pytest.mark.stripe
class TestPostHogEventCheckPremiumDeck:
    """AC-9: check_premium_deck_access fires premium_gate_blocked with correct properties."""

    def test_event_name_is_premium_gate_blocked(self):
        """Event name must be 'premium_gate_blocked'."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE)
        deck = _make_deck(is_premium=True)
        with patch("src.core.subscription.capture_event") as mock_capture:
            with pytest.raises(PremiumRequiredException):
                check_premium_deck_access(user, deck)
        mock_capture.assert_called_once()
        _, kwargs = mock_capture.call_args
        assert kwargs["event"] == "premium_gate_blocked"

    def test_event_properties_gate_type_is_premium_deck(self):
        """properties['gate_type'] must be 'premium_deck'."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE)
        deck = _make_deck(is_premium=True)
        with patch("src.core.subscription.capture_event") as mock_capture:
            with pytest.raises(PremiumRequiredException):
                check_premium_deck_access(user, deck)
        _, kwargs = mock_capture.call_args
        props = kwargs["properties"]
        assert props["gate_type"] == "premium_deck"

    def test_event_properties_deck_id_matches_deck(self):
        """properties['deck_id'] must be str(deck.id)."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE)
        deck = _make_deck(is_premium=True)
        with patch("src.core.subscription.capture_event") as mock_capture:
            with pytest.raises(PremiumRequiredException):
                check_premium_deck_access(user, deck)
        _, kwargs = mock_capture.call_args
        props = kwargs["properties"]
        assert props["deck_id"] == str(deck.id)

    def test_event_properties_current_tier_is_free(self):
        """properties['current_tier'] must be 'free'."""
        user = _make_user(subscription_status=SubscriptionStatus.NONE)
        deck = _make_deck(is_premium=True)
        with patch("src.core.subscription.capture_event") as mock_capture:
            with pytest.raises(PremiumRequiredException):
                check_premium_deck_access(user, deck)
        _, kwargs = mock_capture.call_args
        props = kwargs["properties"]
        assert props["current_tier"] == SubscriptionTier.FREE.value

    def test_event_properties_subscription_status_value(self):
        """properties['subscription_status'] must be the status value string."""
        user = _make_user(subscription_status=SubscriptionStatus.UNPAID)
        deck = _make_deck(is_premium=True)
        with patch("src.core.subscription.capture_event") as mock_capture:
            with pytest.raises(PremiumRequiredException):
                check_premium_deck_access(user, deck)
        _, kwargs = mock_capture.call_args
        props = kwargs["properties"]
        assert props["subscription_status"] == SubscriptionStatus.UNPAID.value

    def test_event_not_fired_for_premium_user(self):
        """PostHog must NOT be called when premium user accesses premium deck."""
        user = _make_user(subscription_status=SubscriptionStatus.ACTIVE)
        deck = _make_deck(is_premium=True)
        with patch("src.core.subscription.capture_event") as mock_capture:
            check_premium_deck_access(user, deck)
        mock_capture.assert_not_called()


# =============================================================================
# AC-10: require_premium not applied to any endpoint
# =============================================================================


@pytest.mark.unit
@pytest.mark.stripe
class TestRequirePremiumNotAppliedToEndpoints:
    """AC-10: require_premium must not be used as a Depends() in any router."""

    def test_require_premium_not_in_api_routes(self):
        """Search all router files for Depends(require_premium) usage."""
        import os

        src_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "src", "api")
        src_dir = os.path.normpath(src_dir)

        found_usages = []
        for root, _dirs, files in os.walk(src_dir):
            for fname in files:
                if not fname.endswith(".py"):
                    continue
                fpath = os.path.join(root, fname)
                with open(fpath) as f:
                    content = f.read()
                if "Depends(require_premium)" in content:
                    found_usages.append(fpath)

        assert found_usages == [], (
            f"require_premium is applied to endpoints in: {found_usages}. "
            "AC-10 requires it NOT be applied yet."
        )


# =============================================================================
# Trial expiration check
# =============================================================================


@pytest.mark.unit
@pytest.mark.stripe
class TestTrialExpirationCheck:
    """Trial expiration logic in get_effective_access_level."""

    def test_expired_trial_returns_free(self):
        """TRIALING user with trial_end_date in the past gets FREE."""
        user = _make_user(
            subscription_status=SubscriptionStatus.TRIALING,
            trial_end_date=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        assert get_effective_access_level(user) == SubscriptionTier.FREE

    def test_active_trial_returns_premium(self):
        """TRIALING user with trial_end_date in the future gets PREMIUM."""
        user = _make_user(
            subscription_status=SubscriptionStatus.TRIALING,
            trial_end_date=datetime.now(timezone.utc) + timedelta(days=7),
        )
        assert get_effective_access_level(user) == SubscriptionTier.PREMIUM

    def test_null_trial_end_date_returns_premium(self):
        """TRIALING user with NULL trial_end_date gets PREMIUM (defensive)."""
        user = _make_user(
            subscription_status=SubscriptionStatus.TRIALING,
            trial_end_date=None,
        )
        assert get_effective_access_level(user) == SubscriptionTier.PREMIUM

    def test_trial_expired_just_now_returns_free(self):
        """TRIALING user with trial_end_date 1 second in the past gets FREE."""
        user = _make_user(
            subscription_status=SubscriptionStatus.TRIALING,
            trial_end_date=datetime.now(timezone.utc) - timedelta(seconds=1),
        )
        assert get_effective_access_level(user) == SubscriptionTier.FREE

    def test_trial_expiring_in_one_second_returns_premium(self):
        """TRIALING user with trial_end_date 1 second in the future gets PREMIUM."""
        user = _make_user(
            subscription_status=SubscriptionStatus.TRIALING,
            trial_end_date=datetime.now(timezone.utc) + timedelta(seconds=1),
        )
        assert get_effective_access_level(user) == SubscriptionTier.PREMIUM

    def test_superuser_with_expired_trial_returns_premium(self):
        """Superuser bypass takes precedence over expired trial."""
        user = _make_user(
            subscription_status=SubscriptionStatus.TRIALING,
            is_superuser=True,
            trial_end_date=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        assert get_effective_access_level(user) == SubscriptionTier.PREMIUM

    def test_active_status_not_affected_by_trial_end_date(self):
        """ACTIVE status ignores trial_end_date entirely."""
        user = _make_user(
            subscription_status=SubscriptionStatus.ACTIVE,
            trial_end_date=datetime.now(timezone.utc) - timedelta(days=30),
        )
        assert get_effective_access_level(user) == SubscriptionTier.PREMIUM

    def test_past_due_status_not_affected_by_trial_end_date(self):
        """PAST_DUE status ignores trial_end_date entirely."""
        user = _make_user(
            subscription_status=SubscriptionStatus.PAST_DUE,
            trial_end_date=datetime.now(timezone.utc) - timedelta(days=30),
        )
        assert get_effective_access_level(user) == SubscriptionTier.PREMIUM

    @pytest.mark.asyncio
    async def test_expired_trial_blocked_by_require_premium(self):
        """TRIALING user with expired trial is blocked by require_premium."""
        user = _make_user(
            subscription_status=SubscriptionStatus.TRIALING,
            trial_end_date=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        with patch("src.core.subscription.capture_event"):
            with pytest.raises(PremiumRequiredException):
                await require_premium(current_user=user)

    def test_expired_trial_blocked_by_check_premium_deck_access(self):
        """TRIALING user with expired trial cannot access premium deck."""
        user = _make_user(
            subscription_status=SubscriptionStatus.TRIALING,
            trial_end_date=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        deck = _make_deck(is_premium=True)
        with patch("src.core.subscription.capture_event"):
            with pytest.raises(PremiumRequiredException):
                check_premium_deck_access(user, deck)
