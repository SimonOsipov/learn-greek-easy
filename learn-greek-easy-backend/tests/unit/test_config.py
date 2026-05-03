"""Unit tests for picture generation configuration."""

import pytest
from pydantic import ValidationError


class TestPictureHouseStyleDefault:
    """Tests for the required PICTURE_HOUSE_STYLE_DEFAULT env var."""

    def test_settings_raises_when_picture_house_style_default_missing(self, monkeypatch):
        """Settings() must raise ValidationError if PICTURE_HOUSE_STYLE_DEFAULT is unset."""
        from src.config import Settings

        # Ensure DATABASE_URL is set (conftest sets it, but be explicit for isolation).
        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
        # Remove the var under test.
        monkeypatch.delenv("PICTURE_HOUSE_STYLE_DEFAULT", raising=False)

        with pytest.raises(ValidationError) as exc_info:
            Settings()

        assert "picture_house_style_default" in str(exc_info.value).lower()

    def test_settings_accepts_picture_house_style_default(self, monkeypatch):
        """Settings() reads PICTURE_HOUSE_STYLE_DEFAULT from env when set."""
        from src.config import Settings

        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
        monkeypatch.setenv("PICTURE_HOUSE_STYLE_DEFAULT", "expected_style_value")

        settings = Settings()
        assert settings.picture_house_style_default == "expected_style_value"
