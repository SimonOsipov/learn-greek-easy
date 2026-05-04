"""Unit tests for src/services/picture_prompt.py."""

from src.config import settings
from src.services.picture_prompt import get_default_picture_style_en, resolve_picture_style_en


class TestGetDefaultPictureStyleEn:
    def test_returns_settings_value(self, monkeypatch):
        """Default tracks settings.picture_house_style_default at call time."""
        monkeypatch.setattr(settings, "picture_house_style_default", "MY_HOUSE_STYLE")
        assert get_default_picture_style_en() == "MY_HOUSE_STYLE"

    def test_tracks_monkeypatched_value(self, monkeypatch):
        """Changing the settings attribute is reflected immediately (not frozen at import)."""
        monkeypatch.setattr(settings, "picture_house_style_default", "FIRST")
        assert get_default_picture_style_en() == "FIRST"
        monkeypatch.setattr(settings, "picture_house_style_default", "SECOND")
        assert get_default_picture_style_en() == "SECOND"


class TestResolvePictureStyleEn:
    def test_provided_non_empty_wins(self, monkeypatch):
        """When provided is a non-empty string, it is returned as-is."""
        monkeypatch.setattr(settings, "picture_house_style_default", "HOUSE_DEFAULT")
        assert resolve_picture_style_en("Custom style") == "Custom style"

    def test_provided_empty_string_falls_back(self, monkeypatch):
        """Empty string falls back to the house-style default."""
        monkeypatch.setattr(settings, "picture_house_style_default", "HOUSE_DEFAULT")
        assert resolve_picture_style_en("") == "HOUSE_DEFAULT"

    def test_provided_whitespace_only_falls_back(self, monkeypatch):
        """Whitespace-only string falls back to the house-style default."""
        monkeypatch.setattr(settings, "picture_house_style_default", "HOUSE_DEFAULT")
        assert resolve_picture_style_en("   ") == "HOUSE_DEFAULT"

    def test_provided_none_falls_back(self, monkeypatch):
        """None falls back to the house-style default."""
        monkeypatch.setattr(settings, "picture_house_style_default", "HOUSE_DEFAULT")
        assert resolve_picture_style_en(None) == "HOUSE_DEFAULT"

    def test_default_tracks_settings_via_monkeypatch(self, monkeypatch):
        """Fallback value reflects monkeypatched settings (not a frozen import-time copy)."""
        monkeypatch.setattr(settings, "picture_house_style_default", "PATCHED_VALUE")
        assert resolve_picture_style_en(None) == "PATCHED_VALUE"
