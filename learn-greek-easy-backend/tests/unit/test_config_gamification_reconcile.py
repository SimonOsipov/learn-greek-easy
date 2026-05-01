"""Unit tests for gamification reconcile-on-read configuration settings.

Tests cover:
- gamification_reconcile_on_read default value (False)
- gamification_reconcile_on_read enabled via GAMIFICATION_RECONCILE_ON_READ=true
- gamification_reconcile_on_read disabled via GAMIFICATION_RECONCILE_ON_READ=false
- gamification_reconcile_rollout_percent default value (0)
- gamification_reconcile_rollout_percent parsed from env
- gamification_reconcile_rollout_percent clamped when > 100
- gamification_reconcile_rollout_percent clamped when < 0
"""

import os
from unittest.mock import patch


class TestGamificationReconcileOnReadConfig:
    """Tests for gamification_reconcile_on_read configuration."""

    def test_reconcile_on_read_disabled_by_default(self, monkeypatch):
        """Reconcile-on-read should be disabled by default."""
        from src.config import Settings

        monkeypatch.delenv("GAMIFICATION_RECONCILE_ON_READ", raising=False)
        settings = Settings()
        assert settings.gamification_reconcile_on_read is False

    def test_reconcile_on_read_enabled_via_env(self):
        """Reconcile-on-read should be True when GAMIFICATION_RECONCILE_ON_READ=true."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {"GAMIFICATION_RECONCILE_ON_READ": "true"},
            clear=False,
        ):
            settings = Settings()
            assert settings.gamification_reconcile_on_read is True

    def test_reconcile_on_read_disabled_via_env(self):
        """Reconcile-on-read should be False when GAMIFICATION_RECONCILE_ON_READ=false."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {"GAMIFICATION_RECONCILE_ON_READ": "false"},
            clear=False,
        ):
            settings = Settings()
            assert settings.gamification_reconcile_on_read is False


class TestGamificationReconcileRolloutPercentConfig:
    """Tests for gamification_reconcile_rollout_percent configuration."""

    def test_rollout_percent_default_zero(self, monkeypatch):
        """Rollout percent should default to 0."""
        from src.config import Settings

        monkeypatch.delenv("GAMIFICATION_RECONCILE_ROLLOUT_PERCENT", raising=False)
        settings = Settings()
        assert settings.gamification_reconcile_rollout_percent == 0

    def test_rollout_percent_parsed_from_env(self):
        """Rollout percent should be parsed from env when set to 50."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {"GAMIFICATION_RECONCILE_ROLLOUT_PERCENT": "50"},
            clear=False,
        ):
            settings = Settings()
            assert settings.gamification_reconcile_rollout_percent == 50

    def test_rollout_percent_clamped_high(self):
        """Rollout percent above 100 should be clamped to 100."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {"GAMIFICATION_RECONCILE_ROLLOUT_PERCENT": "150"},
            clear=False,
        ):
            settings = Settings()
            assert settings.gamification_reconcile_rollout_percent == 100

    def test_rollout_percent_clamped_low(self):
        """Rollout percent below 0 should be clamped to 0."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {"GAMIFICATION_RECONCILE_ROLLOUT_PERCENT": "-5"},
            clear=False,
        ):
            settings = Settings()
            assert settings.gamification_reconcile_rollout_percent == 0
