"""Application configuration management using Pydantic Settings."""

import json
from functools import lru_cache
from typing import List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        env_prefix="",
        env_nested_delimiter="__",
        populate_by_name=True,  # Allow using aliases (CORS_ORIGINS -> cors_origins_raw)
    )

    # =========================================================================
    # Application
    # =========================================================================
    app_name: str = Field(default="Learn Greek Easy API", description="Application name")
    app_version: str = Field(default="0.1.0", description="Application version")
    app_env: str = Field(default="development", description="Environment (dev/staging/prod)")
    debug: bool = Field(default=False, description="Debug mode")
    api_v1_prefix: str = Field(default="/api/v1", description="API v1 prefix")

    # Server
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=8000, description="Server port")
    reload: bool = Field(default=False, description="Auto-reload on code changes")

    # =========================================================================
    # Database
    # =========================================================================
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/learn_greek_easy",
        description="Database connection URL",
    )
    database_pool_size: int = Field(default=20, description="Database connection pool size")
    database_max_overflow: int = Field(default=10, description="Max overflow connections")
    database_pool_timeout: int = Field(default=30, description="Pool connection timeout")

    # =========================================================================
    # Redis
    # =========================================================================
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL",
    )
    cache_ttl_seconds: int = Field(default=300, description="Default cache TTL")
    session_ttl_seconds: int = Field(default=1800, description="Session TTL")

    # Session Storage Configuration
    session_storage_backend: str = Field(
        default="redis",
        description="Session storage backend: 'redis' (primary) or 'postgres' (fallback)",
    )
    session_key_prefix: str = Field(
        default="refresh:",
        description="Redis key prefix for refresh token sessions",
    )
    session_ttl_days: int = Field(
        default=30,
        description="Session TTL in days (should match jwt_refresh_token_expire_days)",
    )

    # Cache Configuration
    cache_enabled: bool = Field(
        default=True,
        description="Enable Redis caching for application data",
    )
    cache_key_prefix: str = Field(
        default="cache",
        description="Redis key prefix for cached data (separate from sessions)",
    )
    cache_default_ttl: int = Field(
        default=300,
        description="Default cache TTL in seconds (5 minutes)",
    )
    cache_deck_list_ttl: int = Field(
        default=300,
        description="Deck list cache TTL in seconds (5 minutes)",
    )
    cache_deck_detail_ttl: int = Field(
        default=600,
        description="Individual deck cache TTL in seconds (10 minutes)",
    )
    cache_cards_by_deck_ttl: int = Field(
        default=300,
        description="Cards by deck cache TTL in seconds (5 minutes)",
    )
    cache_user_progress_ttl: int = Field(
        default=60,
        description="User progress cache TTL in seconds (1 minute)",
    )
    cache_due_cards_ttl: int = Field(
        default=30,
        description="Due cards cache TTL in seconds (30 seconds - must be fresh)",
    )
    cache_user_stats_ttl: int = Field(
        default=120,
        description="User statistics cache TTL in seconds (2 minutes)",
    )

    # =========================================================================
    # Authentication & Security
    # =========================================================================
    jwt_secret_key: str = Field(
        default="change-this-secret-key-in-production",
        description="JWT secret key",
    )
    jwt_algorithm: str = Field(default="HS256", description="JWT algorithm")
    jwt_access_token_expire_minutes: int = Field(
        default=30,
        description="JWT access token expiry (minutes)",
    )
    jwt_refresh_token_expire_days: int = Field(
        default=30,
        description="JWT refresh token expiry (days)",
    )
    bcrypt_rounds: int = Field(default=12, description="Bcrypt hashing rounds")

    # Google OAuth
    google_client_id: Optional[str] = Field(default=None, description="Google OAuth client ID")
    google_client_secret: Optional[str] = Field(
        default=None,
        description="Google OAuth client secret",
    )
    google_redirect_uri: Optional[str] = Field(
        default=None,
        description="Google OAuth redirect URI",
    )

    # =========================================================================
    # Email (Future)
    # =========================================================================
    smtp_host: str = Field(default="smtp.gmail.com", description="SMTP server host")
    smtp_port: int = Field(default=587, description="SMTP server port")
    smtp_user: Optional[str] = Field(default=None, description="SMTP username")
    smtp_password: Optional[str] = Field(default=None, description="SMTP password")
    smtp_from_email: str = Field(
        default="noreply@learngreekeasy.com",
        description="From email address",
    )
    smtp_from_name: str = Field(default="Learn Greek Easy", description="From name")

    # =========================================================================
    # CORS
    # =========================================================================
    # Raw string fields - pydantic_settings tries to JSON-parse List[str] fields
    # BEFORE validators run, causing failures with comma-separated values.
    # We store as strings and parse via computed properties.
    cors_origins_raw: str = Field(
        default="http://localhost:5173,http://localhost:3000",
        alias="cors_origins",
        description="Allowed CORS origins (comma-separated or JSON array)",
    )
    cors_allow_credentials: bool = Field(default=True, description="Allow credentials")
    cors_allow_methods_raw: str = Field(
        default="GET,POST,PUT,DELETE,PATCH,OPTIONS",
        alias="cors_allow_methods",
        description="Allowed HTTP methods (comma-separated or JSON array)",
    )
    cors_allow_headers_raw: str = Field(
        default="*",
        alias="cors_allow_headers",
        description="Allowed headers (comma-separated or JSON array)",
    )

    @staticmethod
    def _parse_list_from_string(value: str) -> List[str]:
        """Parse a list from either JSON array or comma-separated string."""
        value = value.strip()
        if value.startswith("["):
            try:
                parsed: List[str] = json.loads(value)
                return parsed
            except json.JSONDecodeError:
                pass
        return [item.strip() for item in value.split(",") if item.strip()]

    @property
    def cors_origins(self) -> List[str]:
        """Get CORS origins as a list."""
        return self._parse_list_from_string(self.cors_origins_raw)

    @property
    def cors_allow_methods(self) -> List[str]:
        """Get allowed methods as a list."""
        return self._parse_list_from_string(self.cors_allow_methods_raw)

    @property
    def cors_allow_headers(self) -> List[str]:
        """Get allowed headers as a list."""
        return self._parse_list_from_string(self.cors_allow_headers_raw)

    # =========================================================================
    # Rate Limiting
    # =========================================================================
    rate_limit_enabled: bool = Field(default=True, description="Enable rate limiting")
    rate_limit_per_minute: int = Field(default=60, description="General rate limit")
    rate_limit_auth_per_minute: int = Field(default=5, description="Auth endpoint rate limit")

    # =========================================================================
    # Logging
    # =========================================================================
    log_level: str = Field(default="INFO", description="Log level")
    log_format: str = Field(default="json", description="Log format (json/text)")
    log_file: str = Field(default="logs/app.log", description="Log file path")
    log_max_bytes: int = Field(default=10485760, description="Max log file size")
    log_backup_count: int = Field(default=5, description="Number of log backups")

    # Sentry
    sentry_dsn: Optional[str] = Field(default=None, description="Sentry DSN")
    sentry_environment: str = Field(default="development", description="Sentry environment")
    sentry_traces_sample_rate: float = Field(default=0.1, description="Sentry trace sample rate")

    # =========================================================================
    # Frontend Integration
    # =========================================================================
    frontend_url: str = Field(
        default="http://localhost:5173",
        description="Frontend application URL",
    )

    # =========================================================================
    # Feature Flags
    # =========================================================================
    feature_google_oauth: bool = Field(default=False, description="Enable Google OAuth")
    feature_email_notifications: bool = Field(
        default=False,
        description="Enable email notifications",
    )
    feature_rate_limiting: bool = Field(default=True, description="Enable rate limiting")
    feature_background_tasks: bool = Field(default=False, description="Enable background tasks")

    # =========================================================================
    # Health Checks
    # =========================================================================
    health_check_db_timeout: int = Field(
        default=5,
        description="Database health check timeout in seconds",
    )
    health_check_redis_timeout: int = Field(
        default=3,
        description="Redis health check timeout in seconds",
    )
    health_check_memory_warning_percent: int = Field(
        default=80,
        description="Memory usage warning threshold percentage",
    )

    # =========================================================================
    # Business Logic
    # =========================================================================
    srs_initial_ease_factor: float = Field(default=2.5, description="Initial ease factor")
    srs_min_ease_factor: float = Field(default=1.3, description="Minimum ease factor")
    srs_mastered_threshold_days: int = Field(
        default=21,
        description="Days until card is mastered",
    )

    default_page_size: int = Field(default=20, description="Default pagination size")
    max_page_size: int = Field(default=100, description="Maximum pagination size")

    streak_reset_hour_utc: int = Field(default=0, description="Hour to reset daily streaks")

    # =========================================================================
    # Helper Properties
    # =========================================================================
    @property
    def is_production(self) -> bool:
        """Check if running in production."""
        return self.app_env == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development."""
        return self.app_env == "development"

    @property
    def is_testing(self) -> bool:
        """Check if running tests."""
        return self.app_env == "testing"

    @property
    def google_oauth_configured(self) -> bool:
        """Check if Google OAuth is properly configured.

        Returns True only if both the feature flag is enabled AND
        the Google client ID is set. This is used to determine
        whether to accept Google OAuth login requests.
        """
        return (
            self.feature_google_oauth
            and self.google_client_id is not None
            and len(self.google_client_id) > 0
        )

    @property
    def database_url_sync(self) -> str:
        """Get synchronous database URL (for Alembic)."""
        return self.database_url.replace("+asyncpg", "")


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Global settings instance
settings = get_settings()
