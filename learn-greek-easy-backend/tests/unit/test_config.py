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


class TestLexgenJudgeSettings:
    """Tests for the LEXGEN ensemble-judge config defaults (LEXGEN-11-03)."""

    def test_lexgen_judge_models_default(self, monkeypatch):
        """lexgen_judge_models falls back to the two documented judge slugs when unset."""
        from src.config import Settings

        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
        monkeypatch.setenv("PICTURE_HOUSE_STYLE_DEFAULT", "style")
        monkeypatch.delenv("LEXGEN_JUDGE_MODELS", raising=False)

        settings = Settings()
        assert settings.lexgen_judge_models == [
            "openai/gpt-4.1-mini",
            "anthropic/claude-haiku-4.5",
        ]

    def test_lexgen_judge_models_differ_from_generator_and_each_other(self, monkeypatch):
        """Both judge slugs differ from the generator default and from each other."""
        from src.config import Settings

        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
        monkeypatch.setenv("PICTURE_HOUSE_STYLE_DEFAULT", "style")

        settings = Settings()
        judges = settings.lexgen_judge_models
        # Different model families from the generator (google/gemini-2.5-flash-lite)...
        assert all(slug != settings.openrouter_default_model for slug in judges)
        # ...and from each other (ensemble requires two distinct judges).
        assert len(judges) == 2
        assert judges[0] != judges[1]

    def test_lexgen_judge_max_attempts_default(self, monkeypatch):
        """lexgen_judge_max_attempts defaults to the documented retry cap (3)."""
        from src.config import Settings

        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
        monkeypatch.setenv("PICTURE_HOUSE_STYLE_DEFAULT", "style")
        monkeypatch.delenv("LEXGEN_JUDGE_MAX_ATTEMPTS", raising=False)

        settings = Settings()
        assert settings.lexgen_judge_max_attempts == 3

    def test_lexgen_judge_max_tokens_default(self, monkeypatch):
        """lexgen_judge_max_tokens defaults to the documented per-call cap (1024)."""
        from src.config import Settings

        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
        monkeypatch.setenv("PICTURE_HOUSE_STYLE_DEFAULT", "style")
        monkeypatch.delenv("LEXGEN_JUDGE_MAX_TOKENS", raising=False)

        settings = Settings()
        assert settings.lexgen_judge_max_tokens == 1024

    def test_lexgen_judge_models_exactly_two_distinct_family_slugs(self, monkeypatch):
        """Exactly two judge slugs; both from distinct families and distinct from the generator.

        Checks prefix (provider token before '/') so a future swap of one slug to a
        second openai/ or google/ model would be caught even if the full slugs differ.
        The generator default is google/...; judges must be openai/... and anthropic/...
        """
        from src.config import Settings

        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
        monkeypatch.setenv("PICTURE_HOUSE_STYLE_DEFAULT", "style")

        settings = Settings()
        judges = settings.lexgen_judge_models
        generator = settings.openrouter_default_model

        assert len(judges) == 2, f"Ensemble requires exactly two judges, got {len(judges)}"

        judge_families = [slug.split("/")[0] for slug in judges]
        generator_family = generator.split("/")[0]

        # The two judge families must be distinct from each other.
        assert judge_families[0] != judge_families[1], (
            f"Both judges share the same provider family '{judge_families[0]}'; "
            "ensemble must use distinct families"
        )
        # Neither judge family may match the generator's family.
        for family, slug in zip(judge_families, judges):
            assert family != generator_family, (
                f"Judge '{slug}' shares the generator family '{generator_family}'; "
                "judges must come from different model families than the generator"
            )


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

    # -------------------------------------------------------------------------
    # INFRA-05 adversarial / edge coverage
    # -------------------------------------------------------------------------

    def test_clamp_emits_warning_level_not_error_or_info(self, monkeypatch, caplog):
        """The log record emitted during a clamp must be at WARNING level specifically."""
        from src.config import Settings

        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
        monkeypatch.setenv("DATABASE_POOL_SIZE", "5")
        monkeypatch.setenv("DATABASE_POOL_WARM_MIN", "6")

        with caplog.at_level(logging.WARNING, logger="src.config"):
            Settings()

        clamp_records = [r for r in caplog.records if "clamping" in r.getMessage().lower()]
        assert clamp_records, "Expected at least one log record mentioning 'clamping'"
        assert all(
            r.levelno == logging.WARNING for r in clamp_records
        ), "Clamp log must be WARNING, not ERROR or INFO"

    def test_clamp_log_message_contains_both_values(self, monkeypatch, caplog):
        """The warning message must name the original warm_min AND pool_size values."""
        from src.config import Settings

        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
        monkeypatch.setenv("DATABASE_POOL_SIZE", "7")
        monkeypatch.setenv("DATABASE_POOL_WARM_MIN", "20")

        with caplog.at_level(logging.WARNING, logger="src.config"):
            settings = Settings()

        assert settings.database_pool_warm_min == 7
        # Both the input value (20) and the pool_size (7) must appear in the log.
        assert "20" in caplog.text, "Log must name the original warm_min (20)"
        assert "7" in caplog.text, "Log must name the pool_size (7)"

    def test_clamp_far_above_pool_size_clamps_to_exactly_pool_size(self, monkeypatch):
        """warm_min far above pool_size (999 vs 5) must clamp to exactly pool_size, not pool_size-1."""
        from src.config import Settings

        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
        monkeypatch.setenv("DATABASE_POOL_SIZE", "5")
        monkeypatch.setenv("DATABASE_POOL_WARM_MIN", "999")

        settings = Settings()
        assert (
            settings.database_pool_warm_min == 5
        ), f"Expected 5 (pool_size), got {settings.database_pool_warm_min}"
        assert (
            settings.database_pool_warm_min == settings.database_pool_size
        ), "Clamped value must equal pool_size exactly"

    def test_no_warning_emitted_when_warm_min_below_pool_size(self, monkeypatch, caplog):
        """When warm_min < pool_size no clamp-related log record must be emitted at any level."""
        from src.config import Settings

        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
        monkeypatch.setenv("DATABASE_POOL_SIZE", "15")
        monkeypatch.setenv("DATABASE_POOL_WARM_MIN", "3")

        with caplog.at_level(logging.DEBUG, logger="src.config"):
            settings = Settings()

        assert settings.database_pool_warm_min == 3
        clamp_records = [r for r in caplog.records if "clamping" in r.getMessage().lower()]
        assert (
            not clamp_records
        ), f"No clamp log expected when warm_min < pool_size, got: {[r.getMessage() for r in clamp_records]}"

    def test_no_warning_emitted_when_warm_min_equals_pool_size(self, monkeypatch, caplog):
        """When warm_min == pool_size no clamp-related log record must be emitted."""
        from src.config import Settings

        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
        monkeypatch.setenv("DATABASE_POOL_SIZE", "10")
        monkeypatch.setenv("DATABASE_POOL_WARM_MIN", "10")

        with caplog.at_level(logging.DEBUG, logger="src.config"):
            settings = Settings()

        assert settings.database_pool_warm_min == 10
        clamp_records = [r for r in caplog.records if "clamping" in r.getMessage().lower()]
        assert (
            not clamp_records
        ), f"No clamp log expected when warm_min == pool_size, got: {[r.getMessage() for r in clamp_records]}"

    def test_field_defaults_not_regressed(self, monkeypatch):
        """database_pool_warm_min Field default is 5; database_pool_size Field default is 15.

        Verifies the Field(default=...) declarations haven't been changed.  We read the defaults
        directly from the model fields so the test is immune to .env overrides.
        """
        from src.config import Settings

        warm_min_default = Settings.model_fields["database_pool_warm_min"].default
        pool_size_default = Settings.model_fields["database_pool_size"].default

        assert warm_min_default == 5, f"Expected Field default warm_min=5, got {warm_min_default}"
        assert (
            pool_size_default == 15
        ), f"Expected Field default pool_size=15, got {pool_size_default}"


class TestCacheUserIdentityTTLDefault:
    """PERF-16-02: identity cache TTL raised from 20s (PERF-05-05) to 900s (15 min).

    A 20s TTL meant the supabase_id->identity cache expired almost immediately,
    forcing a DB read on nearly every authenticated request (PERF-16 root cause).
    Reading the Field default directly (not instantiating Settings()) makes this
    immune to .env overrides, matching test_field_defaults_not_regressed above.

    RED reason: src/config.py currently declares cache_user_identity_ttl with
    default=20; this test pins the new default=900.
    """

    def test_identity_ttl_default_is_900(self):
        from src.config import Settings

        ttl_default = Settings.model_fields["cache_user_identity_ttl"].default
        assert (
            ttl_default == 900
        ), f"Expected Field default cache_user_identity_ttl=900, got {ttl_default}"
