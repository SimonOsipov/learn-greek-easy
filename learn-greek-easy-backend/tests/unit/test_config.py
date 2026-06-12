"""Unit tests for picture generation configuration."""

import logging

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


class TestOpenRouterImageSettings:
    """Tests for OPENROUTER_IMAGE_MODEL and OPENROUTER_IMAGE_ASPECT_RATIO (SIT-08)."""

    def test_settings_image_model_default(self, monkeypatch):
        """openrouter_image_model falls back to documented default when env var is unset."""
        from src.config import Settings

        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
        monkeypatch.setenv("PICTURE_HOUSE_STYLE_DEFAULT", "style")
        monkeypatch.delenv("OPENROUTER_IMAGE_MODEL", raising=False)

        settings = Settings()
        assert settings.openrouter_image_model == "google/gemini-3.1-flash-image-preview"

    def test_settings_image_aspect_ratio_default(self, monkeypatch):
        """openrouter_image_aspect_ratio falls back to documented default when env var is unset."""
        from src.config import Settings

        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
        monkeypatch.setenv("PICTURE_HOUSE_STYLE_DEFAULT", "style")
        monkeypatch.delenv("OPENROUTER_IMAGE_ASPECT_RATIO", raising=False)

        settings = Settings()
        assert settings.openrouter_image_aspect_ratio == "16:9"

    def test_settings_image_model_from_env(self, monkeypatch):
        """openrouter_image_model reads custom value from env var."""
        from src.config import Settings

        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
        monkeypatch.setenv("PICTURE_HOUSE_STYLE_DEFAULT", "style")
        monkeypatch.setenv("OPENROUTER_IMAGE_MODEL", "openai/dall-e-3")

        settings = Settings()
        assert settings.openrouter_image_model == "openai/dall-e-3"

    def test_settings_image_aspect_ratio_from_env(self, monkeypatch):
        """openrouter_image_aspect_ratio reads custom value from env var."""
        from src.config import Settings

        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
        monkeypatch.setenv("PICTURE_HOUSE_STYLE_DEFAULT", "style")
        monkeypatch.setenv("OPENROUTER_IMAGE_ASPECT_RATIO", "1:1")

        settings = Settings()
        assert settings.openrouter_image_aspect_ratio == "1:1"


class TestDatabasePoolWarmMin:
    """Tests for database_pool_warm_min config setting (PERF-07-01)."""

    def test_database_pool_warm_min_defaults_to_5(self, monkeypatch):
        """database_pool_warm_min defaults to 5 when DATABASE_POOL_WARM_MIN env var is unset."""
        from src.config import Settings

        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
        monkeypatch.delenv("DATABASE_POOL_WARM_MIN", raising=False)

        settings = Settings()
        assert settings.database_pool_warm_min == 5

    def test_database_pool_warm_min_env_override(self, monkeypatch):
        """database_pool_warm_min reads value from DATABASE_POOL_WARM_MIN env var when set."""
        from src.config import Settings

        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
        monkeypatch.setenv("DATABASE_POOL_WARM_MIN", "10")

        settings = Settings()
        assert settings.database_pool_warm_min == 10

    def test_database_pool_warm_min_exceeding_pool_size_clamps_to_pool_size(
        self, monkeypatch, caplog
    ):
        """When warm_min > pool_size, Settings() must clamp warm_min to pool_size and log a warning — not raise."""
        from src.config import Settings

        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
        monkeypatch.setenv("DATABASE_POOL_SIZE", "5")
        monkeypatch.setenv("DATABASE_POOL_WARM_MIN", "6")

        with caplog.at_level(logging.WARNING):
            settings = Settings()

        assert settings.database_pool_warm_min == 5
        assert "6" in caplog.text
        assert "5" in caplog.text

    def test_database_pool_warm_min_below_pool_size_unchanged_no_warning(self, monkeypatch, caplog):
        """When warm_min < pool_size, Settings() must not clamp and must not emit a clamp warning."""
        from src.config import Settings

        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
        monkeypatch.setenv("DATABASE_POOL_SIZE", "15")
        monkeypatch.setenv("DATABASE_POOL_WARM_MIN", "3")

        with caplog.at_level(logging.WARNING):
            settings = Settings()

        assert settings.database_pool_warm_min == 3
        # No clamp warning should be present
        assert (
            "database_pool_warm_min" not in caplog.text.lower()
            or "clamp" not in caplog.text.lower()
        )

    def test_database_pool_warm_min_equal_to_pool_size_accepted(self, monkeypatch):
        """warm_min == pool_size is valid — the validator uses strict >, not >=."""
        from src.config import Settings

        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
        monkeypatch.setenv("DATABASE_POOL_SIZE", "5")
        monkeypatch.setenv("DATABASE_POOL_WARM_MIN", "5")

        settings = Settings()
        assert settings.database_pool_warm_min == 5
        assert settings.database_pool_size == 5

    def test_database_pool_warm_min_zero_accepted(self, monkeypatch):
        """warm_min=0 disables warming; the validator must not reject it."""
        from src.config import Settings

        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
        monkeypatch.setenv("DATABASE_POOL_WARM_MIN", "0")

        settings = Settings()
        assert settings.database_pool_warm_min == 0
