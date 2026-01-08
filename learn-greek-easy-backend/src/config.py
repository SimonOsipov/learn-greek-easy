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
    testing: bool = Field(default=False, description="Testing mode (disables rate limiting)")
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
        default=720,
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

    # Auth0
    auth0_domain: Optional[str] = Field(
        default=None,
        description="Auth0 domain (e.g., your-tenant.us.auth0.com)",
    )
    auth0_audience: Optional[str] = Field(
        default=None,
        description="Auth0 API audience/identifier",
    )
    auth0_algorithms: str = Field(
        default="RS256",
        description="Auth0 JWT signing algorithm",
    )
    auth0_jwks_cache_ttl: int = Field(
        default=3600,
        description="JWKS cache TTL in seconds",
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
    cors_expose_headers_raw: str = Field(
        default="X-Request-ID,X-RateLimit-Limit,X-RateLimit-Remaining,X-RateLimit-Reset",
        alias="cors_expose_headers",
        description="Headers exposed to browser JavaScript (comma-separated or JSON array)",
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

    @property
    def cors_expose_headers(self) -> List[str]:
        """Get exposed headers as a list."""
        return self._parse_list_from_string(self.cors_expose_headers_raw)

    def validate_cors_for_production(self) -> List[str]:
        """Validate CORS configuration for production safety.

        Returns:
            List of warning messages (empty if configuration is valid)
        """
        warnings: List[str] = []
        origins = self.cors_origins

        # Check for wildcard with credentials (security risk)
        if "*" in origins and self.cors_allow_credentials:
            warnings.append(
                "CORS_ORIGINS contains '*' with CORS_ALLOW_CREDENTIALS=true - "
                "browsers will reject this configuration"
            )

        # Check for empty origins in production
        if self.is_production and not origins:
            warnings.append("CORS_ORIGINS is empty in production")

        # Check for HTTP origins in production (should be HTTPS, except localhost)
        if self.is_production:
            http_origins = [o for o in origins if o.startswith("http://") and "localhost" not in o]
            if http_origins:
                warnings.append(f"Non-localhost HTTP origins in production: {http_origins}")

        return warnings

    # =========================================================================
    # Rate Limiting
    # =========================================================================
    rate_limit_enabled: bool = Field(default=True, description="Enable rate limiting")
    rate_limit_per_minute: int = Field(
        default=100,
        description="General API rate limit per minute",
    )
    rate_limit_auth_per_minute: int = Field(
        default=10,
        description="Auth endpoint rate limit per minute (stricter for brute force protection)",
    )

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
    sentry_traces_sample_rate: float = Field(default=0.2, description="Sentry trace sample rate")
    sentry_profiles_sample_rate: float = Field(
        default=0.2,
        description="Sentry profiling sample rate (requires tracing enabled)",
    )
    sentry_send_default_pii: bool = Field(
        default=False,
        description="Include PII (emails, IPs) in Sentry events",
    )
    sentry_debug: bool = Field(
        default=False,
        description="Enable Sentry SDK debug logging",
    )

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
    # E2E Test Seeding
    # =========================================================================
    test_seed_enabled: bool = Field(
        default=False,
        description="Enable E2E test database seeding endpoints and functionality",
    )
    test_seed_secret: Optional[str] = Field(
        default=None,
        description="Optional secret for additional seed endpoint protection (X-Test-Seed-Secret header)",
    )
    seed_on_deploy: bool = Field(
        default=False,
        description="Auto-seed database on application startup (for local dev only)",
    )

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
    # S3-Compatible Storage Configuration (Railway Buckets / AWS S3)
    # =========================================================================
    # Railway provides: BUCKET, ACCESS_KEY_ID, SECRET_ACCESS_KEY, REGION, ENDPOINT
    # AWS S3 uses: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME, AWS_S3_REGION
    # We support both naming conventions with aliases

    # Access credentials (Railway: ACCESS_KEY_ID, AWS: AWS_ACCESS_KEY_ID)
    s3_access_key_id: Optional[str] = Field(
        default=None,
        alias="ACCESS_KEY_ID",
        description="S3 access key ID (Railway: ACCESS_KEY_ID, AWS: set directly)",
    )
    aws_access_key_id: Optional[str] = Field(
        default=None,
        description="AWS access key ID (fallback if s3_access_key_id not set)",
    )

    # Secret key (Railway: SECRET_ACCESS_KEY, AWS: AWS_SECRET_ACCESS_KEY)
    s3_secret_access_key: Optional[str] = Field(
        default=None,
        alias="SECRET_ACCESS_KEY",
        description="S3 secret access key (Railway: SECRET_ACCESS_KEY, AWS: set directly)",
    )
    aws_secret_access_key: Optional[str] = Field(
        default=None,
        description="AWS secret access key (fallback if s3_secret_access_key not set)",
    )

    # Bucket name (Railway: BUCKET, AWS: AWS_S3_BUCKET_NAME)
    s3_bucket_name: Optional[str] = Field(
        default=None,
        alias="BUCKET",
        description="S3 bucket name (Railway: BUCKET, AWS: set directly)",
    )
    aws_s3_bucket_name: Optional[str] = Field(
        default=None,
        description="AWS S3 bucket name (fallback if s3_bucket_name not set)",
    )

    # Region (Railway: REGION, AWS: AWS_S3_REGION)
    s3_region: Optional[str] = Field(
        default=None,
        alias="REGION",
        description="S3 region (Railway: REGION, AWS: set directly)",
    )
    aws_s3_region: str = Field(
        default="eu-central-1",
        description="AWS S3 region (fallback if s3_region not set)",
    )

    # Endpoint URL (Railway: ENDPOINT, AWS: not needed - uses default)
    s3_endpoint_url: Optional[str] = Field(
        default=None,
        alias="ENDPOINT",
        description="S3 endpoint URL (Railway: https://storage.railway.app, AWS: None)",
    )

    # Pre-signed URL expiry
    s3_presigned_url_expiry: int = Field(
        default=3600,
        description="Pre-signed URL expiry in seconds (default 1 hour)",
    )

    @property
    def s3_configured(self) -> bool:
        """Check if S3 is properly configured."""
        return bool(
            self.effective_s3_access_key_id
            and self.effective_s3_secret_access_key
            and self.effective_s3_bucket_name
        )

    @property
    def effective_s3_access_key_id(self) -> Optional[str]:
        """Get effective S3 access key (Railway or AWS)."""
        return self.s3_access_key_id or self.aws_access_key_id

    @property
    def effective_s3_secret_access_key(self) -> Optional[str]:
        """Get effective S3 secret key (Railway or AWS)."""
        return self.s3_secret_access_key or self.aws_secret_access_key

    @property
    def effective_s3_bucket_name(self) -> Optional[str]:
        """Get effective S3 bucket name (Railway or AWS)."""
        return self.s3_bucket_name or self.aws_s3_bucket_name

    @property
    def effective_s3_region(self) -> str:
        """Get effective S3 region (Railway or AWS)."""
        return self.s3_region or self.aws_s3_region

    @property
    def effective_s3_endpoint_url(self) -> Optional[str]:
        """Get effective S3 endpoint URL (Railway or None for AWS)."""
        return self.s3_endpoint_url

    # =========================================================================
    # PostHog Analytics
    # =========================================================================
    posthog_api_key: Optional[str] = Field(
        default=None,
        description="PostHog project API key for server-side analytics",
    )
    posthog_host: str = Field(
        default="https://us.i.posthog.com",
        description="PostHog API host URL",
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
    # Background Tasks
    # =========================================================================
    background_task_timeout: int = Field(
        default=30,
        description="Background task timeout in seconds",
    )

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
        return self.app_env == "testing" or self.testing

    @property
    def sentry_enabled(self) -> bool:
        """Check if Sentry is configured and should be enabled."""
        return bool(self.sentry_dsn) and not self.is_testing

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
    def auth0_configured(self) -> bool:
        """Check if Auth0 is properly configured.

        Returns True only if both the Auth0 domain and audience are set.
        This is used to determine whether to accept Auth0 login requests.
        """
        return bool(self.auth0_domain and self.auth0_audience)

    @property
    def auth0_issuer(self) -> Optional[str]:
        """Get Auth0 issuer URL.

        Returns the issuer URL for token validation, or None if Auth0 is not configured.
        """
        if self.auth0_domain:
            return f"https://{self.auth0_domain}/"
        return None

    @property
    def auth0_jwks_uri(self) -> Optional[str]:
        """Get Auth0 JWKS URI.

        Returns the JWKS URI for fetching public keys, or None if Auth0 is not configured.
        """
        if self.auth0_domain:
            return f"https://{self.auth0_domain}/.well-known/jwks.json"
        return None

    @property
    def database_url_sync(self) -> str:
        """Get synchronous database URL (for Alembic)."""
        return self.database_url.replace("+asyncpg", "")

    # =========================================================================
    # Seed Validation Methods
    # =========================================================================
    def can_seed_database(self) -> bool:
        """Check if database seeding is allowed (enabled AND not production)."""
        return self.test_seed_enabled and not self.is_production

    def validate_seed_secret(self, provided_secret: Optional[str]) -> bool:
        """Validate provided secret against configured secret."""
        if not self.test_seed_secret:
            return True
        return provided_secret == self.test_seed_secret

    def get_seed_validation_errors(self) -> List[str]:
        """Get list of errors preventing seeding."""
        errors: List[str] = []
        if self.is_production:
            errors.append("Seeding is disabled in production environment")
        if not self.test_seed_enabled:
            errors.append("TEST_SEED_ENABLED is not set to true")
        return errors

    @property
    def seed_requires_secret(self) -> bool:
        """Check if seed operations require a secret."""
        return bool(self.test_seed_secret)


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Global settings instance
settings = get_settings()
