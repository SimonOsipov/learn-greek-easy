"""Unit tests for projection_version column on UserXP and UserAchievement models."""

import sqlalchemy as sa

from src.db.models import UserAchievement, UserXP


class TestUserXPProjectionVersion:
    """Schema tests for projection_version column on UserXP."""

    def test_column_exists(self):
        """projection_version column should exist on user_xp table."""
        assert "projection_version" in UserXP.__table__.columns

    def test_column_type_is_integer(self):
        """projection_version column should be INTEGER type."""
        col = UserXP.__table__.columns["projection_version"]
        assert isinstance(col.type, sa.Integer)

    def test_column_not_nullable(self):
        """projection_version column should be NOT NULL."""
        col = UserXP.__table__.columns["projection_version"]
        assert col.nullable is False

    def test_column_server_default_is_zero(self):
        """projection_version column should have server_default of '0'."""
        col = UserXP.__table__.columns["projection_version"]
        assert col.server_default is not None
        assert str(col.server_default.arg) == "0"

    def test_column_python_default_is_zero(self):
        """projection_version column should have Python-side default of 0."""
        col = UserXP.__table__.columns["projection_version"]
        assert col.default is not None
        assert col.default.arg == 0


class TestUserAchievementProjectionVersion:
    """Schema tests for projection_version column on UserAchievement."""

    def test_column_exists(self):
        """projection_version column should exist on user_achievements table."""
        assert "projection_version" in UserAchievement.__table__.columns

    def test_column_type_is_integer(self):
        """projection_version column should be INTEGER type."""
        col = UserAchievement.__table__.columns["projection_version"]
        assert isinstance(col.type, sa.Integer)

    def test_column_not_nullable(self):
        """projection_version column should be NOT NULL."""
        col = UserAchievement.__table__.columns["projection_version"]
        assert col.nullable is False

    def test_column_server_default_is_zero(self):
        """projection_version column should have server_default of '0'."""
        col = UserAchievement.__table__.columns["projection_version"]
        assert col.server_default is not None
        assert str(col.server_default.arg) == "0"

    def test_column_python_default_is_zero(self):
        """projection_version column should have Python-side default of 0."""
        col = UserAchievement.__table__.columns["projection_version"]
        assert col.default is not None
        assert col.default.arg == 0
