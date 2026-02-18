"""Unit tests for subscription-related enums.

Tests the three enums used for Stripe billing integration:
- SubscriptionTier: FREE, PREMIUM (2 members, lowercase values)
- SubscriptionStatus: NONE, TRIALING, ACTIVE, PAST_DUE, CANCELED, INCOMPLETE, UNPAID (7 members)
- BillingCycle: MONTHLY, QUARTERLY, SEMI_ANNUAL, LIFETIME (4 members)

CRITICAL: Enum values are lowercase ('free', 'premium', 'none', etc.)
"""

import pytest

from src.db.models import BillingCycle, SubscriptionStatus, SubscriptionTier

# ---------------------------------------------------------------------------
# SubscriptionTier
# ---------------------------------------------------------------------------


class TestSubscriptionTierEnumValues:
    """Tests for SubscriptionTier enum values."""

    def test_free_value_is_lowercase(self):
        """FREE.value should equal 'free' (lowercase)."""
        assert SubscriptionTier.FREE.value == "free"

    def test_premium_value_is_lowercase(self):
        """PREMIUM.value should equal 'premium' (lowercase)."""
        assert SubscriptionTier.PREMIUM.value == "premium"

    def test_all_values_exactly_two(self):
        """SubscriptionTier should have exactly 2 members."""
        values = [e.value for e in SubscriptionTier]
        assert len(values) == 2
        assert "free" in values
        assert "premium" in values

    def test_all_values_are_lowercase(self):
        """All enum values should be lowercase strings."""
        for member in SubscriptionTier:
            assert member.value == member.value.lower(), f"{member.name} value should be lowercase"


class TestSubscriptionTierStringSubclass:
    """Tests for SubscriptionTier being a str subclass."""

    def test_free_is_str_instance(self):
        """FREE should be an instance of str."""
        assert isinstance(SubscriptionTier.FREE, str)

    def test_premium_is_str_instance(self):
        """PREMIUM should be an instance of str."""
        assert isinstance(SubscriptionTier.PREMIUM, str)

    def test_enum_inherits_from_str(self):
        """SubscriptionTier should inherit from str."""
        assert issubclass(SubscriptionTier, str)


class TestSubscriptionTierStringComparison:
    """Tests for string comparison behavior."""

    def test_free_equals_string_free(self):
        """FREE enum should compare equal to string 'free'."""
        assert SubscriptionTier.FREE == "free"

    def test_premium_equals_string_premium(self):
        """PREMIUM enum should compare equal to string 'premium'."""
        assert SubscriptionTier.PREMIUM == "premium"

    def test_free_not_equals_uppercase(self):
        """FREE enum should NOT compare equal to uppercase 'FREE'."""
        assert SubscriptionTier.FREE != "FREE"

    def test_premium_not_equals_uppercase(self):
        """PREMIUM enum should NOT compare equal to uppercase 'PREMIUM'."""
        assert SubscriptionTier.PREMIUM != "PREMIUM"

    def test_can_use_in_string_operations(self):
        """Enum values can be used in string operations via .value."""
        assert f"tier={SubscriptionTier.FREE.value}" == "tier=free"
        assert f"tier={SubscriptionTier.PREMIUM.value}" == "tier=premium"

    def test_can_concatenate_as_string(self):
        """Enum values can be concatenated with strings."""
        assert "tier_" + SubscriptionTier.FREE == "tier_free"
        assert "tier_" + SubscriptionTier.PREMIUM == "tier_premium"


class TestSubscriptionTierEnumConstruction:
    """Tests for constructing SubscriptionTier from strings."""

    def test_create_from_string_free(self):
        """Can create FREE enum from string 'free'."""
        tier = SubscriptionTier("free")
        assert tier == SubscriptionTier.FREE

    def test_create_from_string_premium(self):
        """Can create PREMIUM enum from string 'premium'."""
        tier = SubscriptionTier("premium")
        assert tier == SubscriptionTier.PREMIUM

    def test_invalid_value_raises_error(self):
        """Invalid string should raise ValueError."""
        with pytest.raises(ValueError):
            SubscriptionTier("invalid")

    def test_uppercase_free_raises_error(self):
        """Uppercase 'FREE' should raise ValueError (not valid)."""
        with pytest.raises(ValueError):
            SubscriptionTier("FREE")

    def test_uppercase_premium_raises_error(self):
        """Uppercase 'PREMIUM' should raise ValueError (not valid)."""
        with pytest.raises(ValueError):
            SubscriptionTier("PREMIUM")

    def test_empty_string_raises_error(self):
        """Empty string should raise ValueError."""
        with pytest.raises(ValueError):
            SubscriptionTier("")

    def test_none_raises_error(self):
        """None should raise appropriate error."""
        with pytest.raises((ValueError, TypeError)):
            SubscriptionTier(None)  # type: ignore


class TestSubscriptionTierEnumMembers:
    """Tests for enum member access patterns."""

    def test_access_by_name_free(self):
        """Can access FREE by name."""
        assert SubscriptionTier["FREE"] == SubscriptionTier.FREE

    def test_access_by_name_premium(self):
        """Can access PREMIUM by name."""
        assert SubscriptionTier["PREMIUM"] == SubscriptionTier.PREMIUM

    def test_invalid_name_raises_keyerror(self):
        """Invalid name should raise KeyError."""
        with pytest.raises(KeyError):
            SubscriptionTier["INVALID"]

    def test_enum_name_attribute(self):
        """Enum members should have correct name attribute."""
        assert SubscriptionTier.FREE.name == "FREE"
        assert SubscriptionTier.PREMIUM.name == "PREMIUM"

    def test_enum_iteration_order(self):
        """Enum members should iterate in definition order."""
        members = list(SubscriptionTier)
        assert members[0] == SubscriptionTier.FREE
        assert members[1] == SubscriptionTier.PREMIUM


# ---------------------------------------------------------------------------
# SubscriptionStatus
# ---------------------------------------------------------------------------


class TestSubscriptionStatusEnumValues:
    """Tests for SubscriptionStatus enum values."""

    def test_none_value(self):
        """NONE.value should equal 'none'."""
        assert SubscriptionStatus.NONE.value == "none"

    def test_trialing_value(self):
        """TRIALING.value should equal 'trialing'."""
        assert SubscriptionStatus.TRIALING.value == "trialing"

    def test_active_value(self):
        """ACTIVE.value should equal 'active'."""
        assert SubscriptionStatus.ACTIVE.value == "active"

    def test_past_due_value(self):
        """PAST_DUE.value should equal 'past_due'."""
        assert SubscriptionStatus.PAST_DUE.value == "past_due"

    def test_canceled_value(self):
        """CANCELED.value should equal 'canceled'."""
        assert SubscriptionStatus.CANCELED.value == "canceled"

    def test_incomplete_value(self):
        """INCOMPLETE.value should equal 'incomplete'."""
        assert SubscriptionStatus.INCOMPLETE.value == "incomplete"

    def test_unpaid_value(self):
        """UNPAID.value should equal 'unpaid'."""
        assert SubscriptionStatus.UNPAID.value == "unpaid"

    def test_all_values_exactly_seven(self):
        """SubscriptionStatus should have exactly 7 members."""
        values = [e.value for e in SubscriptionStatus]
        assert len(values) == 7
        assert "none" in values
        assert "trialing" in values
        assert "active" in values
        assert "past_due" in values
        assert "canceled" in values
        assert "incomplete" in values
        assert "unpaid" in values


class TestSubscriptionStatusStringSubclass:
    """Tests for SubscriptionStatus being a str subclass."""

    def test_none_is_str_instance(self):
        """NONE should be an instance of str."""
        assert isinstance(SubscriptionStatus.NONE, str)

    def test_active_is_str_instance(self):
        """ACTIVE should be an instance of str."""
        assert isinstance(SubscriptionStatus.ACTIVE, str)

    def test_enum_inherits_from_str(self):
        """SubscriptionStatus should inherit from str."""
        assert issubclass(SubscriptionStatus, str)


class TestSubscriptionStatusStringComparison:
    """Tests for string comparison behavior."""

    def test_none_equals_string_none(self):
        """NONE enum should compare equal to string 'none'."""
        assert SubscriptionStatus.NONE == "none"

    def test_active_equals_string_active(self):
        """ACTIVE enum should compare equal to string 'active'."""
        assert SubscriptionStatus.ACTIVE == "active"

    def test_past_due_equals_string_past_due(self):
        """PAST_DUE enum should compare equal to string 'past_due'."""
        assert SubscriptionStatus.PAST_DUE == "past_due"

    def test_none_not_equals_uppercase(self):
        """NONE enum should NOT compare equal to uppercase 'NONE'."""
        assert SubscriptionStatus.NONE != "NONE"

    def test_active_not_equals_uppercase(self):
        """ACTIVE enum should NOT compare equal to uppercase 'ACTIVE'."""
        assert SubscriptionStatus.ACTIVE != "ACTIVE"

    def test_can_use_in_string_operations(self):
        """Enum values can be used in string operations via .value."""
        assert f"status={SubscriptionStatus.ACTIVE.value}" == "status=active"
        assert f"status={SubscriptionStatus.NONE.value}" == "status=none"

    def test_can_concatenate_as_string(self):
        """Enum values can be concatenated with strings."""
        assert "status_" + SubscriptionStatus.ACTIVE == "status_active"
        assert "status_" + SubscriptionStatus.TRIALING == "status_trialing"


class TestSubscriptionStatusEnumConstruction:
    """Tests for constructing SubscriptionStatus from strings."""

    def test_create_from_string_none(self):
        """Can create NONE enum from string 'none'."""
        status = SubscriptionStatus("none")
        assert status == SubscriptionStatus.NONE

    def test_create_from_string_active(self):
        """Can create ACTIVE enum from string 'active'."""
        status = SubscriptionStatus("active")
        assert status == SubscriptionStatus.ACTIVE

    def test_create_from_string_past_due(self):
        """Can create PAST_DUE enum from string 'past_due'."""
        status = SubscriptionStatus("past_due")
        assert status == SubscriptionStatus.PAST_DUE

    def test_invalid_value_raises_error(self):
        """Invalid string should raise ValueError."""
        with pytest.raises(ValueError):
            SubscriptionStatus("invalid")

    def test_uppercase_active_raises_error(self):
        """Uppercase 'ACTIVE' should raise ValueError (not valid)."""
        with pytest.raises(ValueError):
            SubscriptionStatus("ACTIVE")

    def test_uppercase_none_raises_error(self):
        """Uppercase 'NONE' should raise ValueError (not valid)."""
        with pytest.raises(ValueError):
            SubscriptionStatus("NONE")

    def test_empty_string_raises_error(self):
        """Empty string should raise ValueError."""
        with pytest.raises(ValueError):
            SubscriptionStatus("")

    def test_none_raises_error(self):
        """None should raise appropriate error."""
        with pytest.raises((ValueError, TypeError)):
            SubscriptionStatus(None)  # type: ignore


class TestSubscriptionStatusEnumMembers:
    """Tests for enum member access patterns."""

    def test_access_by_name_none(self):
        """Can access NONE by name."""
        assert SubscriptionStatus["NONE"] == SubscriptionStatus.NONE

    def test_access_by_name_active(self):
        """Can access ACTIVE by name."""
        assert SubscriptionStatus["ACTIVE"] == SubscriptionStatus.ACTIVE

    def test_invalid_name_raises_keyerror(self):
        """Invalid name should raise KeyError."""
        with pytest.raises(KeyError):
            SubscriptionStatus["INVALID"]

    def test_enum_name_attribute(self):
        """Enum members should have correct name attribute."""
        assert SubscriptionStatus.NONE.name == "NONE"
        assert SubscriptionStatus.ACTIVE.name == "ACTIVE"
        assert SubscriptionStatus.PAST_DUE.name == "PAST_DUE"

    def test_enum_iteration_order(self):
        """Enum members should iterate in definition order."""
        members = list(SubscriptionStatus)
        assert members[0] == SubscriptionStatus.NONE
        assert members[1] == SubscriptionStatus.TRIALING
        assert members[2] == SubscriptionStatus.ACTIVE
        assert members[3] == SubscriptionStatus.PAST_DUE
        assert members[4] == SubscriptionStatus.CANCELED
        assert members[5] == SubscriptionStatus.INCOMPLETE
        assert members[6] == SubscriptionStatus.UNPAID


# ---------------------------------------------------------------------------
# BillingCycle
# ---------------------------------------------------------------------------


class TestBillingCycleEnumValues:
    """Tests for BillingCycle enum values."""

    def test_monthly_value(self):
        """MONTHLY.value should equal 'monthly'."""
        assert BillingCycle.MONTHLY.value == "monthly"

    def test_quarterly_value(self):
        """QUARTERLY.value should equal 'quarterly'."""
        assert BillingCycle.QUARTERLY.value == "quarterly"

    def test_semi_annual_value(self):
        """SEMI_ANNUAL.value should equal 'semi_annual'."""
        assert BillingCycle.SEMI_ANNUAL.value == "semi_annual"

    def test_lifetime_value(self):
        """LIFETIME.value should equal 'lifetime'."""
        assert BillingCycle.LIFETIME.value == "lifetime"

    def test_all_values_exactly_four(self):
        """BillingCycle should have exactly 4 members."""
        values = [e.value for e in BillingCycle]
        assert len(values) == 4
        assert "monthly" in values
        assert "quarterly" in values
        assert "semi_annual" in values
        assert "lifetime" in values


class TestBillingCycleStringSubclass:
    """Tests for BillingCycle being a str subclass."""

    def test_monthly_is_str_instance(self):
        """MONTHLY should be an instance of str."""
        assert isinstance(BillingCycle.MONTHLY, str)

    def test_lifetime_is_str_instance(self):
        """LIFETIME should be an instance of str."""
        assert isinstance(BillingCycle.LIFETIME, str)

    def test_enum_inherits_from_str(self):
        """BillingCycle should inherit from str."""
        assert issubclass(BillingCycle, str)


class TestBillingCycleStringComparison:
    """Tests for string comparison behavior."""

    def test_monthly_equals_string_monthly(self):
        """MONTHLY enum should compare equal to string 'monthly'."""
        assert BillingCycle.MONTHLY == "monthly"

    def test_quarterly_equals_string_quarterly(self):
        """QUARTERLY enum should compare equal to string 'quarterly'."""
        assert BillingCycle.QUARTERLY == "quarterly"

    def test_semi_annual_equals_string_semi_annual(self):
        """SEMI_ANNUAL enum should compare equal to string 'semi_annual'."""
        assert BillingCycle.SEMI_ANNUAL == "semi_annual"

    def test_lifetime_equals_string_lifetime(self):
        """LIFETIME enum should compare equal to string 'lifetime'."""
        assert BillingCycle.LIFETIME == "lifetime"

    def test_monthly_not_equals_uppercase(self):
        """MONTHLY enum should NOT compare equal to uppercase 'MONTHLY'."""
        assert BillingCycle.MONTHLY != "MONTHLY"

    def test_semi_annual_not_equals_uppercase(self):
        """SEMI_ANNUAL enum should NOT compare equal to uppercase 'SEMI_ANNUAL'."""
        assert BillingCycle.SEMI_ANNUAL != "SEMI_ANNUAL"

    def test_can_use_in_string_operations(self):
        """Enum values can be used in string operations via .value."""
        assert f"cycle={BillingCycle.MONTHLY.value}" == "cycle=monthly"
        assert f"cycle={BillingCycle.LIFETIME.value}" == "cycle=lifetime"

    def test_can_concatenate_as_string(self):
        """Enum values can be concatenated with strings."""
        assert "cycle_" + BillingCycle.MONTHLY == "cycle_monthly"
        assert "cycle_" + BillingCycle.LIFETIME == "cycle_lifetime"


class TestBillingCycleEnumConstruction:
    """Tests for constructing BillingCycle from strings."""

    def test_create_from_string_monthly(self):
        """Can create MONTHLY enum from string 'monthly'."""
        cycle = BillingCycle("monthly")
        assert cycle == BillingCycle.MONTHLY

    def test_create_from_string_quarterly(self):
        """Can create QUARTERLY enum from string 'quarterly'."""
        cycle = BillingCycle("quarterly")
        assert cycle == BillingCycle.QUARTERLY

    def test_create_from_string_semi_annual(self):
        """Can create SEMI_ANNUAL enum from string 'semi_annual'."""
        cycle = BillingCycle("semi_annual")
        assert cycle == BillingCycle.SEMI_ANNUAL

    def test_create_from_string_lifetime(self):
        """Can create LIFETIME enum from string 'lifetime'."""
        cycle = BillingCycle("lifetime")
        assert cycle == BillingCycle.LIFETIME

    def test_invalid_value_raises_error(self):
        """Invalid string should raise ValueError."""
        with pytest.raises(ValueError):
            BillingCycle("invalid")

    def test_uppercase_monthly_raises_error(self):
        """Uppercase 'MONTHLY' should raise ValueError (not valid)."""
        with pytest.raises(ValueError):
            BillingCycle("MONTHLY")

    def test_uppercase_lifetime_raises_error(self):
        """Uppercase 'LIFETIME' should raise ValueError (not valid)."""
        with pytest.raises(ValueError):
            BillingCycle("LIFETIME")

    def test_empty_string_raises_error(self):
        """Empty string should raise ValueError."""
        with pytest.raises(ValueError):
            BillingCycle("")

    def test_none_raises_error(self):
        """None should raise appropriate error."""
        with pytest.raises((ValueError, TypeError)):
            BillingCycle(None)  # type: ignore


class TestBillingCycleEnumMembers:
    """Tests for enum member access patterns."""

    def test_access_by_name_monthly(self):
        """Can access MONTHLY by name."""
        assert BillingCycle["MONTHLY"] == BillingCycle.MONTHLY

    def test_access_by_name_semi_annual(self):
        """Can access SEMI_ANNUAL by name."""
        assert BillingCycle["SEMI_ANNUAL"] == BillingCycle.SEMI_ANNUAL

    def test_access_by_name_lifetime(self):
        """Can access LIFETIME by name."""
        assert BillingCycle["LIFETIME"] == BillingCycle.LIFETIME

    def test_invalid_name_raises_keyerror(self):
        """Invalid name should raise KeyError."""
        with pytest.raises(KeyError):
            BillingCycle["INVALID"]

    def test_enum_name_attribute(self):
        """Enum members should have correct name attribute."""
        assert BillingCycle.MONTHLY.name == "MONTHLY"
        assert BillingCycle.QUARTERLY.name == "QUARTERLY"
        assert BillingCycle.SEMI_ANNUAL.name == "SEMI_ANNUAL"
        assert BillingCycle.LIFETIME.name == "LIFETIME"

    def test_enum_iteration_order(self):
        """Enum members should iterate in definition order."""
        members = list(BillingCycle)
        assert members[0] == BillingCycle.MONTHLY
        assert members[1] == BillingCycle.QUARTERLY
        assert members[2] == BillingCycle.SEMI_ANNUAL
        assert members[3] == BillingCycle.LIFETIME
