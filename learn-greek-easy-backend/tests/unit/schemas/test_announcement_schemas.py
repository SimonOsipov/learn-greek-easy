"""Unit tests for announcement schema validation.

Tests for AnnouncementCreate, AnnouncementResponse, and related schemas,
including field validation, URL validation, and whitespace handling.
"""

from datetime import datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from src.schemas.announcement import (
    AnnouncementCreate,
    AnnouncementCreateResponse,
    AnnouncementDetailResponse,
    AnnouncementListResponse,
    AnnouncementResponse,
    AnnouncementWithCreatorResponse,
    CreatorBriefResponse,
)


class TestAnnouncementCreate:
    """Test AnnouncementCreate schema validation."""

    def test_valid_announcement_all_fields(self):
        """Test valid announcement with all fields."""
        announcement = AnnouncementCreate(
            title="Important Update",
            message="We have released new features for vocabulary practice.",
            link_url="https://example.com/features",
        )
        assert announcement.title == "Important Update"
        assert announcement.message == "We have released new features for vocabulary practice."
        assert announcement.link_url == "https://example.com/features"

    def test_valid_announcement_without_link(self):
        """Test valid announcement without optional link_url."""
        announcement = AnnouncementCreate(
            title="Welcome Message",
            message="Welcome to our platform!",
        )
        assert announcement.title == "Welcome Message"
        assert announcement.message == "Welcome to our platform!"
        assert announcement.link_url is None

    def test_title_max_length_valid(self):
        """Test title at max length (100 chars) is valid."""
        title = "A" * 100
        announcement = AnnouncementCreate(
            title=title,
            message="Test message",
        )
        assert len(announcement.title) == 100

    def test_title_max_length_exceeded_rejected(self):
        """Test title over 100 characters is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            AnnouncementCreate(
                title="A" * 101,
                message="Test message",
            )
        assert "string_too_long" in str(exc_info.value).lower()

    def test_message_max_length_valid(self):
        """Test message at max length (500 chars) is valid."""
        message = "A" * 500
        announcement = AnnouncementCreate(
            title="Test",
            message=message,
        )
        assert len(announcement.message) == 500

    def test_message_max_length_exceeded_rejected(self):
        """Test message over 500 characters is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            AnnouncementCreate(
                title="Test",
                message="A" * 501,
            )
        assert "string_too_long" in str(exc_info.value).lower()

    def test_title_min_length_rejected(self):
        """Test empty title is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            AnnouncementCreate(
                title="",
                message="Test message",
            )
        assert "too_short" in str(exc_info.value).lower()

    def test_message_min_length_rejected(self):
        """Test empty message is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            AnnouncementCreate(
                title="Test",
                message="",
            )
        assert "too_short" in str(exc_info.value).lower()

    def test_whitespace_stripping_title(self):
        """Test leading/trailing whitespace is stripped from title."""
        announcement = AnnouncementCreate(
            title="  Important Update  ",
            message="Test message",
        )
        assert announcement.title == "Important Update"

    def test_whitespace_stripping_message(self):
        """Test leading/trailing whitespace is stripped from message."""
        announcement = AnnouncementCreate(
            title="Test",
            message="  Welcome to our platform!  ",
        )
        assert announcement.message == "Welcome to our platform!"

    def test_whitespace_only_title_rejected(self):
        """Test whitespace-only title is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            AnnouncementCreate(
                title="   ",
                message="Test message",
            )
        assert "empty" in str(exc_info.value).lower() or "whitespace" in str(exc_info.value).lower()

    def test_invalid_url_format_rejected(self):
        """Test invalid URL format (no protocol) is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            AnnouncementCreate(
                title="Test",
                message="Test message",
                link_url="example.com/features",
            )
        assert "http://" in str(exc_info.value) or "https://" in str(exc_info.value)

    def test_url_must_start_with_http(self):
        """Test URL must start with http:// or https://."""
        with pytest.raises(ValidationError) as exc_info:
            AnnouncementCreate(
                title="Test",
                message="Test message",
                link_url="ftp://example.com",
            )
        assert "http://" in str(exc_info.value) or "https://" in str(exc_info.value)

    def test_http_url_valid(self):
        """Test http:// URL is valid."""
        announcement = AnnouncementCreate(
            title="Test",
            message="Test message",
            link_url="http://example.com/page",
        )
        assert announcement.link_url == "http://example.com/page"

    def test_https_url_valid(self):
        """Test https:// URL is valid."""
        announcement = AnnouncementCreate(
            title="Test",
            message="Test message",
            link_url="https://example.com/page",
        )
        assert announcement.link_url == "https://example.com/page"

    def test_url_whitespace_stripped(self):
        """Test URL whitespace is stripped."""
        announcement = AnnouncementCreate(
            title="Test",
            message="Test message",
            link_url="  https://example.com  ",
        )
        assert announcement.link_url == "https://example.com"

    def test_empty_url_converted_to_none(self):
        """Test empty/whitespace URL is converted to None."""
        announcement = AnnouncementCreate(
            title="Test",
            message="Test message",
            link_url="   ",
        )
        assert announcement.link_url is None


class TestCreatorBriefResponse:
    """Test CreatorBriefResponse schema."""

    def test_valid_creator_response(self):
        """Test valid creator brief response."""
        creator_id = uuid4()
        creator = CreatorBriefResponse(
            id=creator_id,
            display_name="Admin User",
        )
        assert creator.id == creator_id
        assert creator.display_name == "Admin User"

    def test_creator_without_display_name(self):
        """Test creator without display_name."""
        creator_id = uuid4()
        creator = CreatorBriefResponse(
            id=creator_id,
        )
        assert creator.id == creator_id
        assert creator.display_name is None


class TestAnnouncementResponse:
    """Test AnnouncementResponse schema."""

    def test_valid_announcement_response(self):
        """Test valid announcement response with all fields."""
        now = datetime.now()
        announcement_id = uuid4()
        response = AnnouncementResponse(
            id=announcement_id,
            title="Test Announcement",
            message="This is a test message",
            link_url="https://example.com",
            total_recipients=100,
            read_count=25,
            created_at=now,
        )
        assert response.id == announcement_id
        assert response.title == "Test Announcement"
        assert response.total_recipients == 100
        assert response.read_count == 25

    def test_announcement_response_defaults(self):
        """Test announcement response with defaults."""
        now = datetime.now()
        response = AnnouncementResponse(
            id=uuid4(),
            title="Test",
            message="Test message",
            created_at=now,
        )
        assert response.link_url is None
        assert response.total_recipients == 0
        assert response.read_count == 0

    def test_negative_recipients_rejected(self):
        """Test negative total_recipients is rejected."""
        now = datetime.now()
        with pytest.raises(ValidationError):
            AnnouncementResponse(
                id=uuid4(),
                title="Test",
                message="Test message",
                total_recipients=-1,
                created_at=now,
            )


class TestAnnouncementWithCreatorResponse:
    """Test AnnouncementWithCreatorResponse schema."""

    def test_with_creator(self):
        """Test announcement with creator info."""
        now = datetime.now()
        creator_id = uuid4()
        response = AnnouncementWithCreatorResponse(
            id=uuid4(),
            title="Test",
            message="Test message",
            created_at=now,
            creator=CreatorBriefResponse(
                id=creator_id,
                display_name="Admin",
            ),
        )
        assert response.creator is not None
        assert response.creator.display_name == "Admin"

    def test_without_creator(self):
        """Test announcement without creator (deleted user)."""
        now = datetime.now()
        response = AnnouncementWithCreatorResponse(
            id=uuid4(),
            title="Test",
            message="Test message",
            created_at=now,
        )
        assert response.creator is None


class TestAnnouncementDetailResponse:
    """Test AnnouncementDetailResponse schema."""

    def test_with_read_percentage(self):
        """Test announcement detail with read percentage."""
        now = datetime.now()
        response = AnnouncementDetailResponse(
            id=uuid4(),
            title="Test",
            message="Test message",
            total_recipients=100,
            read_count=25,
            created_at=now,
            read_percentage=25.0,
        )
        assert response.read_percentage == 25.0

    def test_read_percentage_bounds(self):
        """Test read_percentage within valid bounds."""
        now = datetime.now()
        # Test 0%
        response_zero = AnnouncementDetailResponse(
            id=uuid4(),
            title="Test",
            message="Test message",
            created_at=now,
            read_percentage=0.0,
        )
        assert response_zero.read_percentage == 0.0

        # Test 100%
        response_full = AnnouncementDetailResponse(
            id=uuid4(),
            title="Test",
            message="Test message",
            created_at=now,
            read_percentage=100.0,
        )
        assert response_full.read_percentage == 100.0

    def test_read_percentage_out_of_bounds_rejected(self):
        """Test read_percentage over 100 is rejected."""
        now = datetime.now()
        with pytest.raises(ValidationError):
            AnnouncementDetailResponse(
                id=uuid4(),
                title="Test",
                message="Test message",
                created_at=now,
                read_percentage=101.0,
            )


class TestAnnouncementListResponse:
    """Test AnnouncementListResponse schema."""

    def test_valid_list_response(self):
        """Test valid paginated list response."""
        now = datetime.now()
        item = AnnouncementWithCreatorResponse(
            id=uuid4(),
            title="Test",
            message="Test message",
            created_at=now,
        )
        response = AnnouncementListResponse(
            total=1,
            page=1,
            page_size=20,
            items=[item],
        )
        assert response.total == 1
        assert response.page == 1
        assert response.page_size == 20
        assert len(response.items) == 1

    def test_empty_list_response(self):
        """Test empty list response."""
        response = AnnouncementListResponse(
            total=0,
            page=1,
            page_size=20,
            items=[],
        )
        assert response.total == 0
        assert len(response.items) == 0

    def test_page_must_be_positive(self):
        """Test page must be >= 1."""
        with pytest.raises(ValidationError):
            AnnouncementListResponse(
                total=0,
                page=0,
                page_size=20,
                items=[],
            )

    def test_page_size_max_limit(self):
        """Test page_size max is 100."""
        with pytest.raises(ValidationError):
            AnnouncementListResponse(
                total=0,
                page=1,
                page_size=101,
                items=[],
            )


class TestAnnouncementCreateResponse:
    """Test AnnouncementCreateResponse schema."""

    def test_valid_create_response(self):
        """Test valid announcement creation response."""
        announcement_id = uuid4()
        response = AnnouncementCreateResponse(
            id=announcement_id,
            title="New Announcement",
            total_recipients=50,
        )
        assert response.id == announcement_id
        assert response.title == "New Announcement"
        assert response.total_recipients == 50
        assert "notifications" in response.message.lower()

    def test_create_response_default_message(self):
        """Test create response has default message."""
        response = AnnouncementCreateResponse(
            id=uuid4(),
            title="Test",
        )
        assert response.message == "Announcement created and notifications are being sent"
        assert response.total_recipients == 0
