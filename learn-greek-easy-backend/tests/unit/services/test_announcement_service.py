"""Unit tests for AnnouncementService.

Tests for static methods and utility functions that don't require database.
"""

from src.services.announcement_service import AnnouncementService


class TestCalculateReadPercentage:
    """Test AnnouncementService.calculate_read_percentage static method."""

    def test_zero_recipients_returns_zero(self):
        """Test zero total_recipients returns 0.0 percentage."""
        result = AnnouncementService.calculate_read_percentage(
            total_recipients=0,
            read_count=0,
        )
        assert result == 0.0

    def test_zero_recipients_with_read_count_returns_zero(self):
        """Test zero total_recipients with read_count still returns 0.0 (edge case)."""
        # This shouldn't happen in practice, but test the safeguard
        result = AnnouncementService.calculate_read_percentage(
            total_recipients=0,
            read_count=10,
        )
        assert result == 0.0

    def test_full_read_returns_100(self):
        """Test all recipients read returns 100.0 percentage."""
        result = AnnouncementService.calculate_read_percentage(
            total_recipients=100,
            read_count=100,
        )
        assert result == 100.0

    def test_partial_read_percentage(self):
        """Test partial read returns correct percentage."""
        result = AnnouncementService.calculate_read_percentage(
            total_recipients=100,
            read_count=25,
        )
        assert result == 25.0

    def test_percentage_rounded_to_one_decimal(self):
        """Test percentage is rounded to one decimal place."""
        # 33/100 = 33.33333... should round to 33.3
        result = AnnouncementService.calculate_read_percentage(
            total_recipients=100,
            read_count=33,
        )
        assert result == 33.0

        # 1/3 = 33.333... should round to 33.3
        result = AnnouncementService.calculate_read_percentage(
            total_recipients=3,
            read_count=1,
        )
        assert result == 33.3

    def test_small_numbers(self):
        """Test with small recipient counts."""
        result = AnnouncementService.calculate_read_percentage(
            total_recipients=1,
            read_count=1,
        )
        assert result == 100.0

        result = AnnouncementService.calculate_read_percentage(
            total_recipients=2,
            read_count=1,
        )
        assert result == 50.0

    def test_large_numbers(self):
        """Test with large recipient counts."""
        result = AnnouncementService.calculate_read_percentage(
            total_recipients=10000,
            read_count=7523,
        )
        assert result == 75.2

    def test_no_reads_returns_zero(self):
        """Test zero read_count returns 0.0 percentage."""
        result = AnnouncementService.calculate_read_percentage(
            total_recipients=1000,
            read_count=0,
        )
        assert result == 0.0

    def test_very_small_percentage(self):
        """Test very small percentage is calculated correctly."""
        # 1/1000 = 0.1%
        result = AnnouncementService.calculate_read_percentage(
            total_recipients=1000,
            read_count=1,
        )
        assert result == 0.1

    def test_rounding_behavior(self):
        """Test rounding behavior for edge cases."""
        # 2/3 = 66.666... should round to 66.7
        result = AnnouncementService.calculate_read_percentage(
            total_recipients=3,
            read_count=2,
        )
        assert result == 66.7

        # 5/6 = 83.333... should round to 83.3
        result = AnnouncementService.calculate_read_percentage(
            total_recipients=6,
            read_count=5,
        )
        assert result == 83.3
