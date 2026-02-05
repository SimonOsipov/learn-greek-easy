"""Unit tests for CardSystemVersion enum.

Tests the CardSystemVersion enum used for the Dual Card System feature:
- V1: Legacy cards table (original system)
- V2: New word_entries system (WENTRY feature)

CRITICAL: Enum values are UPPERCASE: 'V1', 'V2' (not lowercase)
"""

import pytest

from src.db.models import CardSystemVersion


class TestCardSystemVersionEnumValues:
    """Tests for CardSystemVersion enum values."""

    def test_v1_value_is_uppercase(self):
        """V1.value should equal 'V1' (uppercase)."""
        assert CardSystemVersion.V1.value == "V1"

    def test_v2_value_is_uppercase(self):
        """V2.value should equal 'V2' (uppercase)."""
        assert CardSystemVersion.V2.value == "V2"

    def test_all_values_exactly_two(self):
        """CardSystemVersion should have exactly 2 values."""
        values = [e.value for e in CardSystemVersion]
        assert len(values) == 2
        assert "V1" in values
        assert "V2" in values

    def test_all_values_are_uppercase(self):
        """All enum values should be uppercase strings."""
        for member in CardSystemVersion:
            assert member.value == member.value.upper(), f"{member.name} value should be uppercase"


class TestCardSystemVersionEnumStringSubclass:
    """Tests for CardSystemVersion being a str subclass."""

    def test_v1_is_str_instance(self):
        """V1 should be an instance of str."""
        assert isinstance(CardSystemVersion.V1, str)

    def test_v2_is_str_instance(self):
        """V2 should be an instance of str."""
        assert isinstance(CardSystemVersion.V2, str)

    def test_enum_inherits_from_str(self):
        """CardSystemVersion should inherit from str."""
        assert issubclass(CardSystemVersion, str)


class TestCardSystemVersionStringComparison:
    """Tests for string comparison behavior."""

    def test_v1_equals_string_v1(self):
        """V1 enum should compare equal to string 'V1'."""
        assert CardSystemVersion.V1 == "V1"

    def test_v2_equals_string_v2(self):
        """V2 enum should compare equal to string 'V2'."""
        assert CardSystemVersion.V2 == "V2"

    def test_v1_not_equals_lowercase(self):
        """V1 enum should NOT compare equal to lowercase 'v1'."""
        assert CardSystemVersion.V1 != "v1"

    def test_v2_not_equals_lowercase(self):
        """V2 enum should NOT compare equal to lowercase 'v2'."""
        assert CardSystemVersion.V2 != "v2"

    def test_can_use_in_string_operations(self):
        """Enum values can be used in string operations via .value."""
        # Note: f-strings use __str__ which shows the enum class name
        # Use .value explicitly for string interpolation
        assert f"card_system={CardSystemVersion.V1.value}" == "card_system=V1"
        assert f"card_system={CardSystemVersion.V2.value}" == "card_system=V2"

    def test_can_concatenate_as_string(self):
        """Enum values can be concatenated with strings."""
        # Since CardSystemVersion inherits from str, it can be concatenated
        assert "version_" + CardSystemVersion.V1 == "version_V1"
        assert "version_" + CardSystemVersion.V2 == "version_V2"


class TestCardSystemVersionEnumConstruction:
    """Tests for constructing CardSystemVersion from strings."""

    def test_create_from_string_v1(self):
        """Can create V1 enum from string 'V1'."""
        version = CardSystemVersion("V1")
        assert version == CardSystemVersion.V1

    def test_create_from_string_v2(self):
        """Can create V2 enum from string 'V2'."""
        version = CardSystemVersion("V2")
        assert version == CardSystemVersion.V2

    def test_invalid_value_raises_error(self):
        """Invalid string should raise ValueError."""
        with pytest.raises(ValueError):
            CardSystemVersion("invalid")

    def test_lowercase_value_raises_error(self):
        """Lowercase 'v1' should raise ValueError (not valid)."""
        with pytest.raises(ValueError):
            CardSystemVersion("v1")

    def test_lowercase_v2_raises_error(self):
        """Lowercase 'v2' should raise ValueError (not valid)."""
        with pytest.raises(ValueError):
            CardSystemVersion("v2")

    def test_empty_string_raises_error(self):
        """Empty string should raise ValueError."""
        with pytest.raises(ValueError):
            CardSystemVersion("")

    def test_none_raises_error(self):
        """None should raise appropriate error."""
        with pytest.raises((ValueError, TypeError)):
            CardSystemVersion(None)  # type: ignore


class TestCardSystemVersionEnumMembers:
    """Tests for enum member access patterns."""

    def test_access_by_name_v1(self):
        """Can access V1 by name."""
        assert CardSystemVersion["V1"] == CardSystemVersion.V1

    def test_access_by_name_v2(self):
        """Can access V2 by name."""
        assert CardSystemVersion["V2"] == CardSystemVersion.V2

    def test_invalid_name_raises_keyerror(self):
        """Invalid name should raise KeyError."""
        with pytest.raises(KeyError):
            CardSystemVersion["INVALID"]

    def test_enum_name_attribute(self):
        """Enum members should have correct name attribute."""
        assert CardSystemVersion.V1.name == "V1"
        assert CardSystemVersion.V2.name == "V2"

    def test_enum_iteration_order(self):
        """Enum members should iterate in definition order."""
        members = list(CardSystemVersion)
        assert members[0] == CardSystemVersion.V1
        assert members[1] == CardSystemVersion.V2
