"""Unit tests for AnnouncementCampaign model."""

from src.db.models import AnnouncementCampaign, NotificationType


class TestNotificationType:
    """Tests for NotificationType enum."""

    def test_admin_announcement_exists(self):
        """ADMIN_ANNOUNCEMENT should be a valid enum value."""
        assert NotificationType.ADMIN_ANNOUNCEMENT == "admin_announcement"

    def test_admin_announcement_in_enum_values(self):
        """ADMIN_ANNOUNCEMENT should be in enum values list."""
        values = [e.value for e in NotificationType]
        assert "admin_announcement" in values


class TestAnnouncementCampaignModel:
    """Tests for AnnouncementCampaign model."""

    def test_tablename(self):
        """Model should use correct table name."""
        assert AnnouncementCampaign.__tablename__ == "announcement_campaigns"

    def test_has_required_columns(self):
        """Model should have all required columns."""
        columns = AnnouncementCampaign.__table__.columns.keys()
        assert "id" in columns
        assert "title" in columns
        assert "message" in columns
        assert "link_url" in columns
        assert "created_by" in columns
        assert "total_recipients" in columns
        assert "read_count" in columns
        assert "created_at" in columns
        assert "updated_at" in columns

    def test_title_max_length(self):
        """Title column should have max length of 100."""
        title_column = AnnouncementCampaign.__table__.columns["title"]
        assert title_column.type.length == 100

    def test_link_url_max_length(self):
        """Link URL column should have max length of 500."""
        link_url_column = AnnouncementCampaign.__table__.columns["link_url"]
        assert link_url_column.type.length == 500

    def test_link_url_nullable(self):
        """Link URL column should be nullable."""
        link_url_column = AnnouncementCampaign.__table__.columns["link_url"]
        assert link_url_column.nullable is True

    def test_created_by_not_nullable(self):
        """Created by column should not be nullable."""
        created_by_column = AnnouncementCampaign.__table__.columns["created_by"]
        assert created_by_column.nullable is False

    def test_statistics_defaults(self):
        """Statistics columns should have default value of 0."""
        total_recipients = AnnouncementCampaign.__table__.columns["total_recipients"]
        read_count = AnnouncementCampaign.__table__.columns["read_count"]
        # Check server_default exists (it's a text representation)
        assert total_recipients.server_default is not None
        assert read_count.server_default is not None
