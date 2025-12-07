"""Unit tests for validation utilities.

Tests cover:
- EMAIL_REGEX pattern matching
- UUID_REGEX pattern matching
- validate_pagination() function with valid and invalid inputs
- sanitize_search_query() function with various edge cases

Target coverage: 95%+
"""

import pytest

from src.utils.validation import EMAIL_REGEX, UUID_REGEX, sanitize_search_query, validate_pagination


class TestEmailRegex:
    """Tests for EMAIL_REGEX pattern."""

    @pytest.mark.parametrize(
        "email",
        [
            "user@example.com",
            "user.name@example.com",
            "user+tag@example.com",
            "user@sub.domain.com",
            "user@example.co.uk",
            "user123@example.com",
            "user.name+tag@sub.domain.co.uk",
        ],
    )
    def test_valid_emails_match(self, email: str) -> None:
        """Test that valid emails match the pattern."""
        assert EMAIL_REGEX.match(email) is not None

    @pytest.mark.parametrize(
        "email",
        [
            "",
            "not-an-email",
            "@example.com",
            "user@",
            "user@.com",
            "user@example",
            "user @example.com",
            "user@ example.com",
            "user@example .com",
        ],
    )
    def test_invalid_emails_do_not_match(self, email: str) -> None:
        """Test that invalid emails do not match the pattern."""
        assert EMAIL_REGEX.match(email) is None


class TestUuidRegex:
    """Tests for UUID_REGEX pattern."""

    @pytest.mark.parametrize(
        "uuid_str",
        [
            "550e8400-e29b-41d4-a716-446655440000",
            "550E8400-E29B-41D4-A716-446655440000",
            "00000000-0000-0000-0000-000000000000",
            "ffffffff-ffff-ffff-ffff-ffffffffffff",
            "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF",
            "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        ],
    )
    def test_valid_uuids_match(self, uuid_str: str) -> None:
        """Test that valid UUIDs match the pattern."""
        assert UUID_REGEX.match(uuid_str) is not None

    @pytest.mark.parametrize(
        "uuid_str",
        [
            "",
            "not-a-uuid",
            "550e8400e29b41d4a716446655440000",  # Missing dashes
            "550e8400-e29b-41d4-a716-44665544000",  # Too short
            "550e8400-e29b-41d4-a716-4466554400000",  # Too long
            "550e8400-e29b-41d4-a716",  # Incomplete
            "g50e8400-e29b-41d4-a716-446655440000",  # Invalid char
            "550e8400-e29b-41d4-a716-446655440000-extra",  # Extra segment
        ],
    )
    def test_invalid_uuids_do_not_match(self, uuid_str: str) -> None:
        """Test that invalid UUIDs do not match the pattern."""
        assert UUID_REGEX.match(uuid_str) is None


class TestValidatePagination:
    """Tests for validate_pagination function."""

    def test_first_page(self) -> None:
        """Test pagination for first page."""
        offset, limit = validate_pagination(page=1, page_size=20)
        assert offset == 0
        assert limit == 20

    def test_second_page(self) -> None:
        """Test pagination for second page."""
        offset, limit = validate_pagination(page=2, page_size=20)
        assert offset == 20
        assert limit == 20

    def test_third_page(self) -> None:
        """Test pagination for third page."""
        offset, limit = validate_pagination(page=3, page_size=50)
        assert offset == 100
        assert limit == 50

    def test_large_page_number(self) -> None:
        """Test pagination with large page number."""
        offset, limit = validate_pagination(page=100, page_size=10)
        assert offset == 990
        assert limit == 10

    def test_page_size_capped_at_max(self) -> None:
        """Test that page_size is capped at max_page_size."""
        offset, limit = validate_pagination(page=1, page_size=500, max_page_size=100)
        assert offset == 0
        assert limit == 100

    def test_custom_max_page_size(self) -> None:
        """Test custom max_page_size."""
        offset, limit = validate_pagination(page=1, page_size=50, max_page_size=25)
        assert offset == 0
        assert limit == 25

    def test_page_size_at_max(self) -> None:
        """Test page_size exactly at max is not capped."""
        offset, limit = validate_pagination(page=1, page_size=100, max_page_size=100)
        assert offset == 0
        assert limit == 100

    def test_page_less_than_one_raises_error(self) -> None:
        """Test that page < 1 raises ValueError."""
        with pytest.raises(ValueError, match="Page must be >= 1"):
            validate_pagination(page=0, page_size=20)

    def test_page_negative_raises_error(self) -> None:
        """Test that negative page raises ValueError."""
        with pytest.raises(ValueError, match="Page must be >= 1"):
            validate_pagination(page=-1, page_size=20)

    def test_page_size_less_than_one_raises_error(self) -> None:
        """Test that page_size < 1 raises ValueError."""
        with pytest.raises(ValueError, match="Page size must be >= 1"):
            validate_pagination(page=1, page_size=0)

    def test_page_size_negative_raises_error(self) -> None:
        """Test that negative page_size raises ValueError."""
        with pytest.raises(ValueError, match="Page size must be >= 1"):
            validate_pagination(page=1, page_size=-5)

    def test_default_max_page_size_is_100(self) -> None:
        """Test that default max_page_size is 100."""
        offset, limit = validate_pagination(page=1, page_size=150)
        assert limit == 100

    def test_returns_tuple(self) -> None:
        """Test that function returns a tuple."""
        result = validate_pagination(page=1, page_size=20)
        assert isinstance(result, tuple)
        assert len(result) == 2


class TestSanitizeSearchQuery:
    """Tests for sanitize_search_query function."""

    def test_strips_whitespace(self) -> None:
        """Test that leading/trailing whitespace is stripped."""
        assert sanitize_search_query("  hello  ") == "hello"

    def test_preserves_internal_whitespace(self) -> None:
        """Test that internal whitespace is preserved."""
        assert sanitize_search_query("hello world") == "hello world"

    def test_removes_percent_sign(self) -> None:
        """Test that % is removed."""
        assert sanitize_search_query("search%term") == "searchterm"

    def test_removes_underscore(self) -> None:
        """Test that _ is removed."""
        assert sanitize_search_query("user_name") == "username"

    def test_removes_backslash(self) -> None:
        """Test that \\ is removed."""
        assert sanitize_search_query("test\\query") == "testquery"

    def test_removes_multiple_special_chars(self) -> None:
        """Test removal of multiple special characters."""
        assert sanitize_search_query("%user_name\\%") == "username"

    def test_truncates_to_max_length(self) -> None:
        """Test that query is truncated to max_length."""
        long_query = "a" * 200
        result = sanitize_search_query(long_query, max_length=100)
        assert len(result) == 100
        assert result == "a" * 100

    def test_custom_max_length(self) -> None:
        """Test custom max_length."""
        result = sanitize_search_query("hello world", max_length=5)
        assert result == "hello"

    def test_empty_string(self) -> None:
        """Test empty string input."""
        assert sanitize_search_query("") == ""

    def test_whitespace_only_returns_empty(self) -> None:
        """Test that whitespace-only input returns empty string."""
        assert sanitize_search_query("   ") == ""

    def test_special_chars_only_returns_empty(self) -> None:
        """Test that special-chars-only input returns empty string."""
        assert sanitize_search_query("%_\\") == ""

    def test_unicode_characters_preserved(self) -> None:
        """Test that unicode characters (Greek) are preserved."""
        # Greek word "Γειά σου" (Hello)
        assert sanitize_search_query("Γειά σου") == "Γειά σου"
        # Greek word "καλημέρα" (good morning)
        assert sanitize_search_query("καλημέρα") == "καλημέρα"
        # Mixed Greek and special chars - special chars removed, Greek preserved
        assert sanitize_search_query("Ελληνικά%test_") == "Ελληνικάtest"

    def test_numbers_preserved(self) -> None:
        """Test that numbers are preserved."""
        assert sanitize_search_query("test123") == "test123"

    def test_default_max_length_is_100(self) -> None:
        """Test that default max_length is 100."""
        long_query = "a" * 150
        result = sanitize_search_query(long_query)
        assert len(result) == 100

    def test_strips_then_truncates(self) -> None:
        """Test that whitespace is stripped before truncation."""
        # 5 spaces + 100 a's = 105 chars
        # After strip: 100 a's
        # No truncation needed
        query = "     " + "a" * 100
        result = sanitize_search_query(query, max_length=100)
        assert result == "a" * 100

    def test_returns_string(self) -> None:
        """Test that function returns a string."""
        result = sanitize_search_query("test")
        assert isinstance(result, str)
