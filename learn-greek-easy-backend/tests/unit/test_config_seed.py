"""Unit tests for E2E seed configuration settings.

Tests cover:
- test_seed_enabled setting
- test_seed_secret setting
- seed_on_deploy setting
- can_seed_database() validation method
- validate_seed_secret() method
- get_seed_validation_errors() method
- seed_requires_secret property
"""

import os
from unittest.mock import patch


class TestSeedConfigurationDefaults:
    """Tests for seed configuration default values."""

    def test_seed_disabled_by_default(self, monkeypatch):
        """Seeding should be disabled by default."""
        from src.config import Settings

        # Remove TEST_SEED_ENABLED to test the true default
        monkeypatch.delenv("TEST_SEED_ENABLED", raising=False)
        settings = Settings()
        assert settings.test_seed_enabled is False

    def test_seed_secret_empty_by_default(self, monkeypatch):
        """Seed secret should be empty string by default."""
        from src.config import Settings

        # Remove TEST_SEED_SECRET to test the true default
        monkeypatch.delenv("TEST_SEED_SECRET", raising=False)
        settings = Settings()
        assert settings.test_seed_secret == ""

    def test_seed_on_deploy_disabled_by_default(self):
        """Seed on deploy should be disabled by default."""
        from src.config import Settings

        settings = Settings()
        assert settings.seed_on_deploy is False


class TestCanSeedDatabase:
    """Tests for can_seed_database() method."""

    def test_can_seed_database_disabled_by_default(self, monkeypatch):
        """Seeding should be disabled by default."""
        from src.config import Settings

        # Remove TEST_SEED_ENABLED to test the true default
        monkeypatch.delenv("TEST_SEED_ENABLED", raising=False)
        settings = Settings()
        assert settings.can_seed_database() is False

    def test_can_seed_database_enabled_in_dev(self):
        """Seeding should work when enabled in development."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {"TEST_SEED_ENABLED": "true", "APP_ENV": "development"},
            clear=False,
        ):
            settings = Settings()
            assert settings.can_seed_database() is True

    def test_can_seed_database_blocked_in_production(self):
        """Seeding must be blocked in production even if enabled."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {"TEST_SEED_ENABLED": "true", "APP_ENV": "production"},
            clear=False,
        ):
            settings = Settings()
            assert settings.can_seed_database() is False

    def test_can_seed_database_enabled_in_staging(self):
        """Seeding should work when enabled in staging."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {"TEST_SEED_ENABLED": "true", "APP_ENV": "staging"},
            clear=False,
        ):
            settings = Settings()
            assert settings.can_seed_database() is True

    def test_can_seed_database_disabled_when_not_enabled(self):
        """Seeding should be disabled when test_seed_enabled is false."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {"TEST_SEED_ENABLED": "false", "APP_ENV": "development"},
            clear=False,
        ):
            settings = Settings()
            assert settings.can_seed_database() is False


class TestValidateSeedSecret:
    """Tests for validate_seed_secret() method."""

    def test_validate_seed_secret_no_secret_configured(self):
        """When no secret configured, any value should pass."""
        from src.config import Settings

        settings = Settings()
        assert settings.validate_seed_secret(None) is True
        assert settings.validate_seed_secret("anything") is True
        assert settings.validate_seed_secret("") is True

    def test_validate_seed_secret_with_secret_configured_correct(self):
        """When secret configured, correct secret should pass."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {"TEST_SEED_SECRET": "my-secret-123"},
            clear=False,
        ):
            settings = Settings()
            assert settings.validate_seed_secret("my-secret-123") is True

    def test_validate_seed_secret_with_secret_configured_wrong(self):
        """When secret configured, wrong secret should fail."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {"TEST_SEED_SECRET": "my-secret-123"},
            clear=False,
        ):
            settings = Settings()
            assert settings.validate_seed_secret("wrong-secret") is False

    def test_validate_seed_secret_with_secret_configured_none(self):
        """When secret configured, None should fail."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {"TEST_SEED_SECRET": "my-secret-123"},
            clear=False,
        ):
            settings = Settings()
            assert settings.validate_seed_secret(None) is False

    def test_validate_seed_secret_with_secret_configured_empty(self):
        """When secret configured, empty string should fail."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {"TEST_SEED_SECRET": "my-secret-123"},
            clear=False,
        ):
            settings = Settings()
            assert settings.validate_seed_secret("") is False


class TestGetSeedValidationErrors:
    """Tests for get_seed_validation_errors() method."""

    def test_get_seed_validation_errors_production(self):
        """Should return production error in production env."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {"APP_ENV": "production"},
            clear=False,
        ):
            settings = Settings()
            errors = settings.get_seed_validation_errors()
            assert any("production" in e.lower() for e in errors)

    def test_get_seed_validation_errors_not_enabled(self):
        """Should return not-enabled error when disabled."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {"APP_ENV": "development", "TEST_SEED_ENABLED": "false"},
            clear=False,
        ):
            settings = Settings()
            errors = settings.get_seed_validation_errors()
            assert any("TEST_SEED_ENABLED" in e for e in errors)

    def test_get_seed_validation_errors_both_errors(self):
        """Should return both errors when in production and not enabled."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {"APP_ENV": "production", "TEST_SEED_ENABLED": "false"},
            clear=False,
        ):
            settings = Settings()
            errors = settings.get_seed_validation_errors()
            assert len(errors) == 2
            assert any("production" in e.lower() for e in errors)
            assert any("TEST_SEED_ENABLED" in e for e in errors)

    def test_get_seed_validation_errors_empty_when_valid(self):
        """Should return empty list when seeding is allowed."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {"APP_ENV": "development", "TEST_SEED_ENABLED": "true"},
            clear=False,
        ):
            settings = Settings()
            errors = settings.get_seed_validation_errors()
            assert errors == []


class TestSeedRequiresSecret:
    """Tests for seed_requires_secret property."""

    def test_seed_requires_secret_false_by_default(self):
        """seed_requires_secret should be False when no secret configured."""
        from src.config import Settings

        settings = Settings()
        assert settings.seed_requires_secret is False

    def test_seed_requires_secret_true_when_configured(self):
        """seed_requires_secret should be True when secret is configured."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {"TEST_SEED_SECRET": "my-secret"},
            clear=False,
        ):
            settings = Settings()
            assert settings.seed_requires_secret is True

    def test_seed_requires_secret_false_when_empty_string(self):
        """seed_requires_secret should be False when secret is empty string."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {"TEST_SEED_SECRET": ""},
            clear=False,
        ):
            settings = Settings()
            assert settings.seed_requires_secret is False


class TestSeedOnDeploy:
    """Tests for seed_on_deploy setting."""

    def test_seed_on_deploy_from_env_true(self):
        """seed_on_deploy should be True when SEED_ON_DEPLOY=true."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {"SEED_ON_DEPLOY": "true"},
            clear=False,
        ):
            settings = Settings()
            assert settings.seed_on_deploy is True

    def test_seed_on_deploy_from_env_false(self):
        """seed_on_deploy should be False when SEED_ON_DEPLOY=false."""
        from src.config import Settings

        with patch.dict(
            os.environ,
            {"SEED_ON_DEPLOY": "false"},
            clear=False,
        ):
            settings = Settings()
            assert settings.seed_on_deploy is False
