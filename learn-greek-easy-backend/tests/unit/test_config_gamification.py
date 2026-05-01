"""Unit tests for gamification shadow-mode configuration setting.

Tests cover:
- gamification_shadow_mode default value (False)
- gamification_shadow_mode enabled via GAMIFICATION_SHADOW_MODE=true
- gamification_shadow_mode disabled via GAMIFICATION_SHADOW_MODE=false
"""

import os
from unittest.mock import patch


class TestGamificationShadowModeConfig:
    """Tests for gamification_shadow_mode configuration."""

    def test_shadow_mode_disabled_by_default(self, monkeypatch):
        """Shadow mode should be disabled by default."""
        from src.config import Settings

        # Remove GAMIFICATION_SHADOW_MODE to test the true default
        monkeypatch.delenv("GAMIFICATION_SHADOW_MODE", raising=False)
        settings = Settings()
        assert settings.gamification_shadow_mode is False

    def test_shadow_mode_enabled_via_env(self):
        """Shadow mode should be True when GAMIFICATION_SHADOW_MODE=true."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {"GAMIFICATION_SHADOW_MODE": "true"},
            clear=False,
        ):
            settings = Settings()
            assert settings.gamification_shadow_mode is True

    def test_shadow_mode_disabled_via_env(self):
        """Shadow mode should be False when GAMIFICATION_SHADOW_MODE=false."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {"GAMIFICATION_SHADOW_MODE": "false"},
            clear=False,
        ):
            settings = Settings()
            assert settings.gamification_shadow_mode is False
