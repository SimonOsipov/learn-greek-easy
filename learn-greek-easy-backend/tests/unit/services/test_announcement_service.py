"""Unit tests for AnnouncementService.

Tests for static methods and utility functions that don't require database.
Note: calculate_read_percentage was removed in ADMIN2-20 (read_percentage field
dropped from API responses). This file is kept as a placeholder for future
service-level unit tests.
"""

from src.services.announcement_service import AnnouncementService


class TestAnnouncementServiceImport:
    """Verify AnnouncementService can be imported."""

    def test_service_importable(self):
        """Test that AnnouncementService class is importable."""
        assert AnnouncementService is not None
