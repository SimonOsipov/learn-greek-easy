# Backend Task 01: Project Setup & Environment Configuration

**Project:** Learn Greek Easy - Greek Language Learning Application
**Phase:** MVP - Backend Development
**Task ID:** 01
**Created:** 2025-11-20
**Completed:** 2025-11-20
**Status:** ✅ COMPLETED
**Actual Duration:** 2 hours
**Priority:** Critical Path
**Dependencies:** Python 3.14+, Poetry 2.2+

---

## Table of Contents

1. [Overview](#overview)
2. [Objectives](#objectives)
3. [Project Structure](#project-structure)
4. [Dependency Management](#dependency-management)
5. [Environment Configuration](#environment-configuration)
6. [Logging Setup](#logging-setup)
7. [Error Handling](#error-handling)
8. [FastAPI Application](#fastapi-application)
9. [Development Scripts](#development-scripts)
10. [Documentation](#documentation)
11. [Implementation Steps](#implementation-steps)
12. [Integration Points](#integration-points)
13. [Success Criteria](#success-criteria)
14. [Troubleshooting](#troubleshooting)
15. [Appendices](#appendices)

---

## Overview

This task establishes the foundation for the Learn Greek Easy backend API. We'll create a professional FastAPI project with proper configuration management, logging, error handling, and development tooling. This setup will support all subsequent backend tasks (Tasks 2-15).

### Key Technologies
- **Python 3.14**: Latest stable Python release with performance improvements
- **Poetry 2.2**: Modern dependency and package management
- **FastAPI 0.115+**: Modern async web framework
- **Pydantic v2**: Data validation and settings management
- **Uvicorn**: ASGI server for development
- **SQLAlchemy 2.0**: ORM (prepared for Task 2)
- **Alembic**: Database migrations (prepared for Task 2)
- **Redis**: Caching and sessions (prepared for Task 11)
- **Celery**: Background tasks (prepared for Task 11)

---

## Objectives

By the end of this task, we will have:

1. ✅ Professional FastAPI project structure following best practices
2. ✅ Type-safe configuration management with Pydantic Settings
3. ✅ Production-ready logging with structured JSON output
4. ✅ Comprehensive error handling with custom exceptions
5. ✅ Development environment with hot reload
6. ✅ Code quality tools (Black, isort, mypy, flake8)
7. ✅ Testing framework setup (pytest)
8. ✅ Complete documentation (README, API docs)
9. ✅ Development scripts for common tasks
10. ✅ Frontend integration preparation (CORS, response formats)

---

## Project Structure

### Complete Directory Tree

```
learn-greek-easy-backend/
├── .env.example                    # Environment variables template
├── .gitignore                      # Git ignore patterns
├── README.md                       # Backend documentation
├── pyproject.toml                  # Poetry dependencies, build, tools config
├── poetry.lock                     # Locked dependencies for reproducibility
├── pytest.ini                      # Pytest configuration
├── .flake8                         # Flake8 configuration
├── run.py                          # Development server script
│
├── alembic/                        # Database migrations (Task 2)
│   ├── versions/                   # Migration scripts
│   ├── env.py                      # Alembic environment
│   └── alembic.ini                 # Alembic configuration
│
├── src/                            # Application source code
│   ├── __init__.py
│   ├── main.py                     # FastAPI application entry
│   ├── config.py                   # Configuration management
│   ├── constants.py                # Application constants
│   │
│   ├── api/                        # API routes (Tasks 3-8)
│   │   ├── __init__.py
│   │   ├── v1/                     # API version 1
│   │   │   ├── __init__.py
│   │   │   ├── router.py           # Main API router
│   │   │   ├── auth.py             # Auth endpoints (Task 3)
│   │   │   ├── decks.py            # Deck endpoints (Task 5)
│   │   │   ├── cards.py            # Card endpoints (Task 6)
│   │   │   ├── reviews.py          # Review endpoints (Task 7)
│   │   │   └── progress.py         # Progress endpoints (Task 8)
│   │   └── dependencies.py         # Shared dependencies
│   │
│   ├── core/                       # Core functionality
│   │   ├── __init__.py
│   │   ├── exceptions.py           # Custom exceptions
│   │   ├── logging.py              # Logging configuration
│   │   ├── security.py             # Auth helpers (Task 3)
│   │   └── middleware.py           # Custom middleware (Task 4)
│   │
│   ├── db/                         # Database (Task 2)
│   │   ├── __init__.py
│   │   ├── session.py              # Database sessions
│   │   └── base.py                 # Base model class
│   │
│   ├── models/                     # SQLAlchemy models (Task 2)
│   │   ├── __init__.py
│   │   ├── user.py                 # User model
│   │   ├── deck.py                 # Deck model
│   │   ├── card.py                 # Card model
│   │   ├── review.py               # Review model
│   │   └── progress.py             # Progress tracking
│   │
│   ├── schemas/                    # Pydantic schemas (Tasks 3-8)
│   │   ├── __init__.py
│   │   ├── user.py                 # User schemas
│   │   ├── auth.py                 # Auth schemas
│   │   ├── deck.py                 # Deck schemas
│   │   ├── card.py                 # Card schemas
│   │   ├── review.py               # Review schemas
│   │   └── progress.py             # Progress schemas
│   │
│   ├── services/                   # Business logic (Tasks 7-11)
│   │   ├── __init__.py
│   │   ├── auth.py                 # Auth service (Task 3)
│   │   ├── deck.py                 # Deck service (Task 5)
│   │   ├── review.py               # Review service (Task 7)
│   │   ├── progress.py             # Progress service (Task 8)
│   │   ├── spaced_repetition.py   # SM-2 algorithm (Task 9)
│   │   └── content.py              # Content management (Task 10)
│   │
│   ├── tasks/                      # Celery tasks (Task 11)
│   │   ├── __init__.py
│   │   ├── celery_app.py           # Celery configuration
│   │   ├── streak.py               # Streak tracking
│   │   └── notifications.py        # Email notifications (future)
│   │
│   └── utils/                      # Utility functions
│       ├── __init__.py
│       ├── datetime.py             # Date/time helpers
│       ├── validators.py           # Custom validators
│       └── responses.py            # Response formatters
│
└── tests/                          # Test suite (Tasks 12-13)
    ├── __init__.py
    ├── conftest.py                 # Pytest fixtures
    ├── unit/                       # Unit tests
    │   ├── __init__.py
    │   ├── test_spaced_repetition.py
    │   ├── test_auth.py
    │   └── test_models.py
    ├── integration/                # Integration tests
    │   ├── __init__.py
    │   ├── test_auth_api.py
    │   ├── test_deck_api.py
    │   └── test_review_api.py
    └── fixtures/                   # Test data
        ├── __init__.py
        ├── database.py
        ├── users.py
        └── cards.py
```

### Directory Purpose

- **`src/`**: All application source code
- **`src/api/`**: FastAPI route handlers organized by version
- **`src/core/`**: Core functionality (exceptions, logging, security)
- **`src/db/`**: Database connection and session management
- **`src/models/`**: SQLAlchemy ORM models
- **`src/schemas/`**: Pydantic schemas for validation and serialization
- **`src/services/`**: Business logic layer (separated from routes)
- **`src/tasks/`**: Background tasks with Celery
- **`src/utils/`**: Shared utility functions
- **`tests/`**: Test suite with unit and integration tests
- **`alembic/`**: Database migration management

**Note**: Utility scripts for development and deployment are located in the root `scripts/` directory (shared across frontend and backend).

---

## Dependency Management

### Poetry Configuration (pyproject.toml)

Poetry manages all dependencies in a single `pyproject.toml` file with automatic dependency resolution and a `poetry.lock` file for reproducible builds.

**Key Benefits:**
- Single configuration file for dependencies, build, and tools
- Automatic virtual environment management
- Dependency resolution (no version conflicts)
- Reproducible builds with poetry.lock
- Easy dependency group management (dev, test, docs)

### Complete pyproject.toml with Poetry

```toml
[tool.poetry]
name = "learn-greek-easy-backend"
version = "0.1.0"
description = "Backend API for Learn Greek Easy - Greek Language Learning Application"
authors = ["Learn Greek Easy Team"]
license = "MIT"
readme = "README.md"
python = "^3.14"

[tool.poetry.dependencies]
python = "^3.14"
fastapi = "^0.115.0"
uvicorn = {extras = ["standard"], version = "^0.30.0"}
python-multipart = "^0.0.9"
pydantic = "^2.9.0"
pydantic-settings = "^2.5.0"
email-validator = "^2.2.0"
sqlalchemy = "^2.0.35"
alembic = "^1.13.2"
psycopg2-binary = "^2.9.9"
asyncpg = "^0.29.0"
python-jose = {extras = ["cryptography"], version = "^3.3.0"}
passlib = {extras = ["bcrypt"], version = "^1.7.4"}
bcrypt = "^4.2.0"
redis = "^5.0.8"
celery = "^5.4.0"
python-dateutil = "^2.9.0"
pytz = "^2024.1"
httpx = "^0.27.0"
aiohttp = "^3.10.0"
gunicorn = "^22.0.0"

[tool.poetry.group.dev.dependencies]
pytest = "^8.3.0"
pytest-asyncio = "^0.23.0"
pytest-cov = "^5.0.0"
pytest-mock = "^3.14.0"
faker = "^26.0.0"
black = "^24.8.0"
isort = "^5.13.2"
flake8 = "^7.1.0"
mypy = "^1.11.0"
pylint = "^3.2.0"
types-python-dateutil = "^2.9.0"
types-pytz = "^2024.1.0"
types-redis = "^4.6.0"
ipython = "^8.26.0"
ipdb = "^0.13.13"
watchdog = "^4.0.0"
mkdocs = "^1.6.0"
mkdocs-material = "^9.5.0"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"

[tool.black]
line-length = 100
target-version = ['py313']  # Black doesn't support py314 yet, using py313 (compatible)
include = '\.pyi?$'
extend-exclude = '''
/(
  # directories
  \.eggs
  | \.git
  | \.mypy_cache
  | \.tox
  | \.venv
  | build
  | dist
  | alembic/versions
)/
'''

[tool.isort]
profile = "black"
line_length = 100
multi_line_output = 3
include_trailing_comma = true
force_grid_wrap = 0
use_parentheses = true
ensure_newline_before_comments = true
skip_glob = ["*/alembic/versions/*"]

[tool.mypy]
python_version = "3.14"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
disallow_incomplete_defs = true
check_untyped_defs = true
disallow_untyped_calls = true
disallow_untyped_decorators = false
no_implicit_optional = true
warn_redundant_casts = true
warn_unused_ignores = true
warn_no_return = true
follow_imports = "normal"
ignore_missing_imports = true
plugins = ["pydantic.mypy"]

[[tool.mypy.overrides]]
module = "alembic.*"
ignore_errors = true

[tool.pytest.ini_options]
minversion = "8.0"
testpaths = ["tests"]
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
addopts = [
    "--strict-markers",
    "--cov=src",
    "--cov-report=term-missing",
    "--cov-report=html",
    "--cov-report=xml",
    "-v",
]
markers = [
    "unit: Unit tests",
    "integration: Integration tests",
    "slow: Slow running tests",
]
asyncio_mode = "auto"

[tool.coverage.run]
source = ["src"]
omit = [
    "*/tests/*",
    "*/alembic/*",
    "*/__pycache__/*",
]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "raise AssertionError",
    "raise NotImplementedError",
    "if __name__ == .__main__.:",
    "if TYPE_CHECKING:",
    "@abstractmethod",
]
```

---

## Environment Configuration

### Environment Variables Template (.env.example)

```bash
# =============================================================================
# APPLICATION CONFIGURATION
# =============================================================================
APP_NAME="Learn Greek Easy API"
APP_VERSION="0.1.0"
APP_ENV="development"  # development, staging, production
DEBUG=true
API_V1_PREFIX="/api/v1"

# Server Configuration
HOST="0.0.0.0"
PORT=8000
RELOAD=true

# =============================================================================
# DATABASE CONFIGURATION (PostgreSQL)
# =============================================================================
DATABASE_HOST="localhost"
DATABASE_PORT=5432
DATABASE_NAME="learn_greek_easy"
DATABASE_USER="postgres"
DATABASE_PASSWORD="postgres"
DATABASE_URL="postgresql+asyncpg://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}"

# Database Pool Settings
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10
DATABASE_POOL_TIMEOUT=30

# =============================================================================
# REDIS CONFIGURATION
# =============================================================================
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=""
REDIS_URL="redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}"

# Redis Cache Settings
CACHE_TTL_SECONDS=300
SESSION_TTL_SECONDS=1800

# =============================================================================
# AUTHENTICATION & SECURITY
# =============================================================================

# JWT Settings
JWT_SECRET_KEY="your-super-secret-jwt-key-change-in-production"
JWT_ALGORITHM="HS256"
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# Password Hashing
BCRYPT_ROUNDS=12

# Google OAuth (Task 3)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://localhost:8000/api/v1/auth/google/callback"

# =============================================================================
# EMAIL CONFIGURATION (Future)
# =============================================================================
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM_EMAIL="noreply@learngreekeasy.com"
SMTP_FROM_NAME="Learn Greek Easy"

# =============================================================================
# CELERY CONFIGURATION (Task 11)
# =============================================================================
CELERY_BROKER_URL="redis://localhost:6379/1"
CELERY_RESULT_BACKEND="redis://localhost:6379/2"
CELERY_TASK_SERIALIZER="json"
CELERY_RESULT_SERIALIZER="json"
CELERY_ACCEPT_CONTENT="json"
CELERY_TIMEZONE="UTC"
CELERY_ENABLE_UTC=true

# =============================================================================
# CORS CONFIGURATION
# =============================================================================
CORS_ORIGINS="http://localhost:5173,http://localhost:3000"
CORS_ALLOW_CREDENTIALS=true
CORS_ALLOW_METHODS="GET,POST,PUT,DELETE,PATCH,OPTIONS"
CORS_ALLOW_HEADERS="*"

# =============================================================================
# RATE LIMITING
# =============================================================================
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_AUTH_PER_MINUTE=5

# =============================================================================
# MONITORING & LOGGING
# =============================================================================

# Logging
LOG_LEVEL="INFO"  # DEBUG, INFO, WARNING, ERROR, CRITICAL
LOG_FORMAT="json"  # json, text
LOG_FILE="logs/app.log"
LOG_MAX_BYTES=10485760  # 10MB
LOG_BACKUP_COUNT=5

# Sentry (Error Tracking)
SENTRY_DSN=""
SENTRY_ENVIRONMENT="development"
SENTRY_TRACES_SAMPLE_RATE=0.1

# =============================================================================
# FRONTEND INTEGRATION
# =============================================================================
FRONTEND_URL="http://localhost:5173"

# =============================================================================
# FEATURE FLAGS
# =============================================================================
FEATURE_GOOGLE_OAUTH=false
FEATURE_EMAIL_NOTIFICATIONS=false
FEATURE_RATE_LIMITING=true
FEATURE_BACKGROUND_TASKS=false

# =============================================================================
# CONTENT & BUSINESS LOGIC
# =============================================================================

# Spaced Repetition (SM-2 Algorithm)
SRS_INITIAL_EASE_FACTOR=2.5
SRS_MIN_EASE_FACTOR=1.3
SRS_MASTERED_THRESHOLD_DAYS=21

# Pagination
DEFAULT_PAGE_SIZE=20
MAX_PAGE_SIZE=100

# Streak Tracking
STREAK_RESET_HOUR_UTC=0  # Midnight UTC
```

### Configuration Management (src/config.py)

```python
"""Application configuration management using Pydantic Settings."""

import os
from functools import lru_cache
from typing import Any, Dict, List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
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
    # Celery (Task 11)
    # =========================================================================
    celery_broker_url: str = Field(
        default="redis://localhost:6379/1",
        description="Celery broker URL",
    )
    celery_result_backend: str = Field(
        default="redis://localhost:6379/2",
        description="Celery result backend",
    )

    # =========================================================================
    # CORS
    # =========================================================================
    cors_origins: List[str] = Field(
        default=["http://localhost:5173", "http://localhost:3000"],
        description="Allowed CORS origins",
    )
    cors_allow_credentials: bool = Field(default=True, description="Allow credentials")
    cors_allow_methods: List[str] = Field(
        default=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        description="Allowed HTTP methods",
    )
    cors_allow_headers: List[str] = Field(default=["*"], description="Allowed headers")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> List[str]:
        """Parse CORS origins from string or list."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

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
    def database_url_sync(self) -> str:
        """Get synchronous database URL (for Alembic)."""
        return self.database_url.replace("+asyncpg", "")


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Global settings instance
settings = get_settings()
```

### Application Constants (src/constants.py)

```python
"""Application constants and enumerations."""

from enum import Enum


class UserRole(str, Enum):
    """User role enumeration."""

    USER = "user"
    ADMIN = "admin"
    PREMIUM = "premium"


class DeckLevel(str, Enum):
    """Deck difficulty level (CEFR)."""

    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"


class CardStage(str, Enum):
    """Card learning stage in SRS system."""

    NEW = "new"
    LEARNING = "learning"
    REVIEW = "review"
    RELEARNING = "relearning"
    MASTERED = "mastered"


class DeckStatus(str, Enum):
    """User's deck status."""

    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class ResponseMessages:
    """Standard API response messages."""

    # Success
    SUCCESS = "Operation completed successfully"
    CREATED = "Resource created successfully"
    UPDATED = "Resource updated successfully"
    DELETED = "Resource deleted successfully"

    # Authentication
    LOGIN_SUCCESS = "Login successful"
    LOGOUT_SUCCESS = "Logout successful"
    REGISTER_SUCCESS = "Registration successful"
    TOKEN_REFRESHED = "Token refreshed successfully"

    # Errors
    NOT_FOUND = "Resource not found"
    UNAUTHORIZED = "Authentication required"
    FORBIDDEN = "Access forbidden"
    BAD_REQUEST = "Invalid request"
    INTERNAL_ERROR = "Internal server error"

    # Validation
    INVALID_CREDENTIALS = "Invalid email or password"
    EMAIL_ALREADY_EXISTS = "Email already registered"
    WEAK_PASSWORD = "Password does not meet requirements"
    TOKEN_EXPIRED = "Token has expired"
    TOKEN_INVALID = "Invalid token"


# Spaced Repetition System Constants
class SRSConstants:
    """Constants for SM-2 spaced repetition algorithm."""

    # Quality ratings (1-5)
    QUALITY_BLACKOUT = 1  # Complete blackout
    QUALITY_INCORRECT = 2  # Incorrect response with correct answer seeming familiar
    QUALITY_RECALL_HARD = 3  # Correct response with difficulty
    QUALITY_RECALL_OK = 4  # Correct response with hesitation
    QUALITY_PERFECT = 5  # Perfect response

    # Initial values
    INITIAL_EASE_FACTOR = 2.5
    INITIAL_INTERVAL = 1
    INITIAL_REPETITIONS = 0

    # Constraints
    MIN_EASE_FACTOR = 1.3
    MAX_EASE_FACTOR = 3.0

    # Stage thresholds (days)
    LEARNING_THRESHOLD = 1
    REVIEW_THRESHOLD = 7
    MASTERED_THRESHOLD = 21


# Pagination
DEFAULT_PAGE = 1
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

# Cache TTL (seconds)
CACHE_DECK_LIST = 3600  # 1 hour
CACHE_DECK_DETAIL = 1800  # 30 minutes
CACHE_USER_PROGRESS = 300  # 5 minutes

# Rate Limiting
RATE_LIMIT_GENERAL = "60/minute"
RATE_LIMIT_AUTH = "5/minute"
RATE_LIMIT_REVIEW = "120/minute"
```

---

## Logging Setup

### Logging Configuration (src/core/logging.py)

```python
"""Logging configuration with structured JSON output."""

import logging
import logging.handlers
import sys
from pathlib import Path
from typing import Any, Dict

import json_logging

from src.config import settings


class JSONFormatter(logging.Formatter):
    """Format logs as JSON for structured logging."""

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON."""
        log_data: Dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Add extra fields if present
        if hasattr(record, "extra"):
            log_data["extra"] = record.extra

        return json_logging.util.dumps(log_data)


class ColoredFormatter(logging.Formatter):
    """Colored formatter for development console output."""

    COLORS = {
        "DEBUG": "\033[36m",  # Cyan
        "INFO": "\033[32m",  # Green
        "WARNING": "\033[33m",  # Yellow
        "ERROR": "\033[31m",  # Red
        "CRITICAL": "\033[35m",  # Magenta
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        """Format with colors."""
        log_color = self.COLORS.get(record.levelname, self.RESET)
        record.levelname = f"{log_color}{record.levelname}{self.RESET}"
        return super().format(record)


def setup_logging() -> None:
    """Configure application logging."""
    # Create logs directory
    log_dir = Path(settings.log_file).parent
    log_dir.mkdir(parents=True, exist_ok=True)

    # Root logger
    logger = logging.getLogger()
    logger.setLevel(settings.log_level.upper())

    # Remove existing handlers
    logger.handlers = []

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(settings.log_level.upper())

    if settings.log_format == "json":
        console_handler.setFormatter(JSONFormatter())
    else:
        formatter = ColoredFormatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        console_handler.setFormatter(formatter)

    logger.addHandler(console_handler)

    # File handler with rotation
    file_handler = logging.handlers.RotatingFileHandler(
        settings.log_file,
        maxBytes=settings.log_max_bytes,
        backupCount=settings.log_backup_count,
    )
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(JSONFormatter())
    logger.addHandler(file_handler)

    # Error file handler
    error_file_handler = logging.handlers.RotatingFileHandler(
        settings.log_file.replace(".log", "_error.log"),
        maxBytes=settings.log_max_bytes,
        backupCount=settings.log_backup_count,
    )
    error_file_handler.setLevel(logging.ERROR)
    error_file_handler.setFormatter(JSONFormatter())
    logger.addHandler(error_file_handler)

    # Third-party library log levels
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("fastapi").setLevel(logging.INFO)
    logging.getLogger("sqlalchemy").setLevel(logging.WARNING)

    logger.info(
        "Logging configured",
        extra={
            "level": settings.log_level,
            "format": settings.log_format,
            "file": settings.log_file,
        },
    )


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance."""
    return logging.getLogger(name)
```

---

## Error Handling

### Custom Exceptions (src/core/exceptions.py)

```python
"""Custom exception classes for the application."""

from typing import Any, Dict, Optional

from fastapi import HTTPException, status


class BaseAPIException(HTTPException):
    """Base exception for all API errors."""

    def __init__(
        self,
        status_code: int,
        detail: str,
        error_code: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        extra: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Initialize API exception."""
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.error_code = error_code or self.__class__.__name__
        self.extra = extra or {}


# ============================================================================
# Authentication Exceptions
# ============================================================================


class InvalidCredentialsException(BaseAPIException):
    """Invalid email or password."""

    def __init__(self, detail: str = "Invalid email or password") -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            error_code="INVALID_CREDENTIALS",
        )


class TokenExpiredException(BaseAPIException):
    """JWT token has expired."""

    def __init__(self, detail: str = "Token has expired") -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            error_code="TOKEN_EXPIRED",
        )


class TokenInvalidException(BaseAPIException):
    """JWT token is invalid."""

    def __init__(self, detail: str = "Invalid token") -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            error_code="TOKEN_INVALID",
        )


class UnauthorizedException(BaseAPIException):
    """User is not authenticated."""

    def __init__(self, detail: str = "Authentication required") -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            error_code="UNAUTHORIZED",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ============================================================================
# Authorization Exceptions
# ============================================================================


class ForbiddenException(BaseAPIException):
    """User does not have permission."""

    def __init__(self, detail: str = "Access forbidden") -> None:
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
            error_code="FORBIDDEN",
        )


class PremiumRequiredException(BaseAPIException):
    """Premium subscription required."""

    def __init__(self, detail: str = "Premium subscription required") -> None:
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
            error_code="PREMIUM_REQUIRED",
        )


# ============================================================================
# Resource Exceptions
# ============================================================================


class NotFoundException(BaseAPIException):
    """Resource not found."""

    def __init__(self, resource: str = "Resource", detail: Optional[str] = None) -> None:
        detail = detail or f"{resource} not found"
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
            error_code="NOT_FOUND",
        )


class UserNotFoundException(NotFoundException):
    """User not found."""

    def __init__(self, user_id: Optional[str] = None) -> None:
        detail = f"User with ID '{user_id}' not found" if user_id else "User not found"
        super().__init__(resource="User", detail=detail)


class DeckNotFoundException(NotFoundException):
    """Deck not found."""

    def __init__(self, deck_id: Optional[str] = None) -> None:
        detail = f"Deck with ID '{deck_id}' not found" if deck_id else "Deck not found"
        super().__init__(resource="Deck", detail=detail)


class CardNotFoundException(NotFoundException):
    """Card not found."""

    def __init__(self, card_id: Optional[str] = None) -> None:
        detail = f"Card with ID '{card_id}' not found" if card_id else "Card not found"
        super().__init__(resource="Card", detail=detail)


# ============================================================================
# Validation Exceptions
# ============================================================================


class ValidationException(BaseAPIException):
    """Validation error."""

    def __init__(self, detail: str, field: Optional[str] = None) -> None:
        extra = {"field": field} if field else {}
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail,
            error_code="VALIDATION_ERROR",
            extra=extra,
        )


class EmailAlreadyExistsException(ValidationException):
    """Email address is already registered."""

    def __init__(self, email: str) -> None:
        super().__init__(
            detail=f"Email '{email}' is already registered",
            field="email",
        )


class WeakPasswordException(ValidationException):
    """Password does not meet requirements."""

    def __init__(
        self,
        detail: str = "Password must be at least 8 characters with uppercase, lowercase, and number",
    ) -> None:
        super().__init__(detail=detail, field="password")


# ============================================================================
# Business Logic Exceptions
# ============================================================================


class ReviewSubmissionException(BaseAPIException):
    """Error submitting review."""

    def __init__(self, detail: str = "Failed to submit review") -> None:
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
            error_code="REVIEW_SUBMISSION_ERROR",
        )


class DeckAlreadyStartedException(BaseAPIException):
    """Deck has already been started."""

    def __init__(self, deck_id: str) -> None:
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Deck '{deck_id}' has already been started",
            error_code="DECK_ALREADY_STARTED",
        )


# ============================================================================
# Rate Limiting
# ============================================================================


class RateLimitException(BaseAPIException):
    """Rate limit exceeded."""

    def __init__(self, detail: str = "Too many requests, please try again later") -> None:
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            error_code="RATE_LIMIT_EXCEEDED",
            headers={"Retry-After": "60"},
        )
```

---

## FastAPI Application

### Main Application (src/main.py)

```python
"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.config import settings
from src.core.exceptions import BaseAPIException
from src.core.logging import setup_logging

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager."""
    # Startup
    logger.info("Starting Learn Greek Easy API", extra={"version": settings.app_version})

    # TODO (Task 2): Initialize database connection
    # await init_database()

    # TODO (Task 11): Initialize Redis connection
    # await init_redis()

    yield

    # Shutdown
    logger.info("Shutting down Learn Greek Easy API")

    # TODO (Task 2): Close database connection
    # await close_database()

    # TODO (Task 11): Close Redis connection
    # await close_redis()


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    description="Backend API for Greek language learning with spaced repetition",
    version=settings.app_version,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    openapi_url="/openapi.json" if settings.debug else None,
    lifespan=lifespan,
)

# ============================================================================
# Middleware
# ============================================================================

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)

# Trusted host middleware (production only)
if settings.is_production:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["learngreekeasy.com", "*.learngreekeasy.com"],
    )

# TODO (Task 4): Add custom middleware
# - Request logging
# - Rate limiting
# - Authentication
# - Error handling

# ============================================================================
# Exception Handlers
# ============================================================================


@app.exception_handler(BaseAPIException)
async def base_api_exception_handler(
    request: Request,
    exc: BaseAPIException,
) -> JSONResponse:
    """Handle custom API exceptions."""
    logger.error(
        f"API Exception: {exc.error_code}",
        extra={
            "error_code": exc.error_code,
            "detail": exc.detail,
            "path": request.url.path,
            "method": request.method,
        },
    )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.error_code,
                "message": exc.detail,
                "extra": exc.extra,
            },
        },
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Handle Pydantic validation errors."""
    logger.warning(
        "Validation error",
        extra={
            "errors": exc.errors(),
            "path": request.url.path,
            "method": request.method,
        },
    )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": exc.errors(),
            },
        },
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(
    request: Request,
    exc: StarletteHTTPException,
) -> JSONResponse:
    """Handle HTTP exceptions."""
    logger.error(
        f"HTTP {exc.status_code} error",
        extra={
            "detail": exc.detail,
            "path": request.url.path,
            "method": request.method,
        },
    )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": exc.detail,
            },
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Handle unhandled exceptions."""
    logger.exception(
        "Unhandled exception",
        extra={
            "path": request.url.path,
            "method": request.method,
        },
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred",
            },
        },
    )


# ============================================================================
# Routes
# ============================================================================


@app.get("/")
async def root() -> dict:
    """Root endpoint - API information."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "environment": settings.app_env,
        "docs": "/docs" if settings.debug else None,
        "health": "/health",
        "api": settings.api_v1_prefix,
    }


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.app_version,
        "environment": settings.app_env,
    }


@app.get(f"{settings.api_v1_prefix}/status")
async def api_status() -> dict:
    """API status endpoint with detailed information."""
    return {
        "api_version": "v1",
        "app_version": settings.app_version,
        "environment": settings.app_env,
        "features": {
            "google_oauth": settings.feature_google_oauth,
            "email_notifications": settings.feature_email_notifications,
            "rate_limiting": settings.feature_rate_limiting,
            "background_tasks": settings.feature_background_tasks,
        },
    }


# Debug endpoint (development only)
if settings.debug:

    @app.get("/debug/settings")
    async def debug_settings() -> dict:
        """Debug endpoint to view current settings."""
        return {
            "app": {
                "name": settings.app_name,
                "version": settings.app_version,
                "env": settings.app_env,
                "debug": settings.debug,
            },
            "cors": {
                "origins": settings.cors_origins,
                "credentials": settings.cors_allow_credentials,
            },
            "features": {
                "google_oauth": settings.feature_google_oauth,
                "email_notifications": settings.feature_email_notifications,
                "rate_limiting": settings.feature_rate_limiting,
                "background_tasks": settings.feature_background_tasks,
            },
        }


# TODO (Task 3): Include authentication routes
# app.include_router(auth_router, prefix=f"{settings.api_v1_prefix}/auth", tags=["auth"])

# TODO (Task 5): Include deck routes
# app.include_router(deck_router, prefix=f"{settings.api_v1_prefix}/decks", tags=["decks"])

# TODO (Task 6): Include card routes
# app.include_router(card_router, prefix=f"{settings.api_v1_prefix}/cards", tags=["cards"])

# TODO (Task 7): Include review routes
# app.include_router(review_router, prefix=f"{settings.api_v1_prefix}/reviews", tags=["reviews"])

# TODO (Task 8): Include progress routes
# app.include_router(progress_router, prefix=f"{settings.api_v1_prefix}/progress", tags=["progress"])


# ============================================================================
# Main (for running with python src/main.py)
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level=settings.log_level.lower(),
    )
```

---

## Development Scripts

### Development Server Script (run.py)

```python
"""Development server runner."""

import uvicorn

from src.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level=settings.log_level.lower(),
        access_log=True,
    )
```

### Flake8 Configuration (.flake8)

```ini
[flake8]
max-line-length = 100
exclude =
    .git,
    __pycache__,
    .venv,
    venv,
    build,
    dist,
    *.egg-info,
    alembic/versions
ignore =
    E203,  # whitespace before ':'
    E501,  # line too long (handled by black)
    W503,  # line break before binary operator
per-file-ignores =
    __init__.py:F401
```

---

## Documentation

### Backend README.md

```markdown
# Learn Greek Easy - Backend API

Backend API for the Learn Greek Easy Greek language learning application.

## Tech Stack

- **FastAPI 0.115+** - Modern async web framework
- **Python 3.11+** - Latest stable Python
- **PostgreSQL** - Primary database
- **Redis** - Caching and sessions
- **SQLAlchemy 2.0** - ORM
- **Alembic** - Database migrations
- **Celery** - Background tasks
- **JWT** - Authentication

## Quick Start

### Prerequisites

- Python 3.14+
- Poetry 2.2+
- PostgreSQL 16+
- Redis 7+

### Installation

1. Install dependencies with Poetry:
```bash
poetry install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Edit `.env` with your configuration

### Running Development Server

```bash
poetry run python run.py
# Or:
poetry run uvicorn src.main:app --reload
```

API will be available at:
- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Project Structure

```
learn-greek-easy-backend/
├── src/
│   ├── main.py           # FastAPI application
│   ├── config.py         # Configuration
│   ├── constants.py      # Constants
│   ├── api/              # API routes
│   ├── core/             # Core functionality
│   ├── db/               # Database
│   ├── models/           # SQLAlchemy models
│   ├── schemas/          # Pydantic schemas
│   ├── services/         # Business logic
│   └── utils/            # Utilities
├── tests/                # Test suite
└── alembic/              # Database migrations
```

## API Documentation

Interactive API documentation available at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Development

### Code Quality

```bash
# Run all linters
poetry run flake8 src tests
poetry run mypy src
poetry run black --check src tests
poetry run isort --check-only src tests

# Format code
poetry run black src tests
poetry run isort src tests
```

### Testing

```bash
# Run all tests
poetry run pytest

# Run with coverage
poetry run pytest --cov=src --cov-report=html --cov-report=term
```

### Database Migrations

```bash
# Create migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

## Authentication

The API uses JWT tokens for authentication.

### Register
```bash
POST /api/v1/auth/register
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "full_name": "John Doe"
}
```

### Login
```bash
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

Returns:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

### Authenticated Requests
```bash
GET /api/v1/decks
Authorization: Bearer eyJ...
```

## Environment Variables

See `.env.example` for all available configuration options.

Key variables:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `JWT_SECRET_KEY` - JWT signing key
- `CORS_ORIGINS` - Allowed frontend origins

## Deployment

### Production Checklist

- [ ] Set `APP_ENV=production`
- [ ] Set strong `JWT_SECRET_KEY`
- [ ] Configure production database
- [ ] Set up Redis instance
- [ ] Configure CORS origins
- [ ] Enable Sentry error tracking
- [ ] Set up SSL/TLS
- [ ] Configure backup strategy
- [ ] Set up monitoring

### Docker

```bash
docker build -t learn-greek-easy-backend .
docker run -p 8000:8000 learn-greek-easy-backend
```

## Contributing

1. Create feature branch
2. Make changes
3. Run tests and linters
4. Submit pull request

## License

MIT
```

### Git Ignore (.gitignore)

```
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg

# Virtual Environment
venv/
ENV/
env/
.venv

# IDEs
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store

# Testing
.pytest_cache/
.coverage
.coverage.*
htmlcov/
.tox/
.nyc_output/
coverage.xml
*.cover

# Logs
*.log
logs/

# Environment
.env
.env.local
.env.*.local

# Database
*.db
*.sqlite
*.sqlite3

# Alembic
alembic/versions/*.pyc

# MyPy
.mypy_cache/
.dmypy.json
dmypy.json

# Celery
celerybeat-schedule
celerybeat.pid

# Jupyter
.ipynb_checkpoints

# macOS
.DS_Store
.AppleDouble
.LSOverride
```

---

## Implementation Steps

### Step 1: Initialize Project Structure (15 minutes)

```bash
# Create project directory
mkdir -p learn-greek-easy-backend
cd learn-greek-easy-backend

# Create directory structure
mkdir -p src/{api/v1,core,db,models,schemas,services,tasks,utils}
mkdir -p tests/{unit,integration,fixtures}
mkdir -p alembic/versions
mkdir -p logs

# Create __init__.py files
touch src/__init__.py
touch src/api/__init__.py
touch src/api/v1/__init__.py
touch src/core/__init__.py
touch src/db/__init__.py
touch src/models/__init__.py
touch src/schemas/__init__.py
touch src/services/__init__.py
touch src/tasks/__init__.py
touch src/utils/__init__.py
touch tests/__init__.py
touch tests/unit/__init__.py
touch tests/integration/__init__.py
touch tests/fixtures/__init__.py
```

**Verification:**
```bash
ls -R src/
```

### Step 2: Initialize Poetry and Install Dependencies (10 minutes)

```bash
# Initialize Poetry project (Poetry will create virtual environment automatically)
poetry init --no-interaction --name="learn-greek-easy-backend" --python="^3.14"

# OR copy the pyproject.toml from this plan

# Install all dependencies (production + dev)
poetry install

# Verify Poetry is using Python 3.14
poetry run python --version

# Verify installation
poetry show
```

**Verification:**
```bash
poetry run python -c "import fastapi; print(fastapi.__version__)"
poetry run python -c "import sqlalchemy; print(sqlalchemy.__version__)"

# Check Poetry environment info
poetry env info
```

**Key Poetry Commands:**
- `poetry add <package>` - Add production dependency
- `poetry add --group dev <package>` - Add dev dependency
- `poetry install` - Install all dependencies
- `poetry update` - Update dependencies
- `poetry show` - List installed packages
- `poetry shell` - Activate virtual environment
- `poetry run <command>` - Run command in Poetry environment

### Step 3: Create Configuration Files (20 minutes)

1. Copy all configuration files from this plan:
   - `.env.example`
   - `src/config.py`
   - `src/constants.py`
   - `pyproject.toml`
   - `.flake8`
   - `pytest.ini`
   - `.gitignore`

2. Create `.env` from `.env.example`:
```bash
cp .env.example .env
```

3. Edit `.env` with your local settings

**Verification:**
```bash
python -c "from src.config import settings; print(settings.app_name)"
```

### Step 4: Set Up Logging (15 minutes)

1. Create `src/core/logging.py` (from plan above)

2. Test logging:
```python
from src.core.logging import setup_logging, get_logger

setup_logging()
logger = get_logger(__name__)
logger.info("Logging is working!")
```

**Verification:**
```bash
python -c "from src.core.logging import setup_logging; setup_logging()"
ls logs/  # Should show app.log
```

### Step 5: Create Exception Classes (10 minutes)

1. Create `src/core/exceptions.py` (from plan above)

2. Test exceptions:
```python
from src.core.exceptions import InvalidCredentialsException

try:
    raise InvalidCredentialsException()
except InvalidCredentialsException as e:
    print(f"Status: {e.status_code}, Detail: {e.detail}")
```

### Step 6: Create FastAPI Application (20 minutes)

1. Create `src/main.py` (from plan above)

2. Test server:
```bash
python run.py
```

3. Open browser to http://localhost:8000
   - Test root endpoint: `/`
   - Test health check: `/health`
   - Test API docs: `/docs`

**Verification:**
```bash
curl http://localhost:8000/health
# Should return: {"status":"healthy","version":"0.1.0","environment":"development"}
```

### Step 7: Create Development Script (5 minutes)

1. Create `run.py` (from plan above)

**Verification:**
```bash
poetry run python run.py  # Should start server
```

**Note**: Backend-specific utility scripts will be added to the root `scripts/` directory as needed in future tasks.

### Step 8: Create Backend README (10 minutes)

1. Create `README.md` (from plan above)

**Verification:**
- Review README for completeness
- Test all example commands

### Step 9: Initialize Git (5 minutes)

```bash
git init
git add .
git commit -m "Initial backend setup (Task 1)"
```

### Step 10: Final Verification (10 minutes)

Run through complete verification checklist (see Success Criteria below).

---

## Integration Points

### Frontend Integration

The backend is designed to integrate seamlessly with the frontend:

**CORS Configuration:**
- Frontend URL: `http://localhost:5173`
- Configured in `.env`: `CORS_ORIGINS`
- Middleware in `src/main.py`

**API Response Format:**
All endpoints follow consistent format:
```json
{
  "success": true,
  "data": { ... }
}
```

Error responses:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { ... }
  }
}
```

**Authentication Flow:**
1. Frontend sends credentials to `/api/v1/auth/login`
2. Backend returns JWT tokens
3. Frontend stores tokens (httpOnly cookies)
4. Frontend includes token in Authorization header
5. Backend validates token on protected endpoints

### Preparation for Task 2 (Database Setup)

Placeholders created:
- `src/db/` directory for database connection
- `src/models/` directory for SQLAlchemy models
- `alembic/` directory for migrations
- Database configuration in `src/config.py`

### Preparation for Task 3 (Authentication)

Placeholders created:
- `src/core/security.py` for JWT and password hashing
- `src/api/v1/auth.py` for auth endpoints
- `src/services/auth.py` for auth business logic
- JWT configuration in `src/config.py`
- Authentication exceptions in `src/core/exceptions.py`

---

## Success Criteria

### 1. Project Structure ✅
- [ ] All directories created
- [ ] All `__init__.py` files present
- [ ] Structure follows FastAPI best practices

### 2. Dependencies ✅
- [ ] Virtual environment created
- [ ] All production dependencies installed
- [ ] All development dependencies installed
- [ ] `pip list` shows correct versions

### 3. Configuration ✅
- [ ] `.env.example` created with all variables
- [ ] `.env` created and customized
- [ ] `src/config.py` loads settings correctly
- [ ] Settings can be imported: `from src.config import settings`

### 4. Logging ✅
- [ ] Logging configuration complete
- [ ] Logs directory created
- [ ] Console logging works
- [ ] File logging works
- [ ] Log rotation configured

### 5. Error Handling ✅
- [ ] Custom exception classes created
- [ ] Base exception inherits from HTTPException
- [ ] Exception handlers registered in FastAPI
- [ ] Error responses follow standard format

### 6. FastAPI Application ✅
- [ ] Server starts without errors
- [ ] Root endpoint responds: `GET /`
- [ ] Health check responds: `GET /health`
- [ ] API docs accessible: `GET /docs`
- [ ] CORS configured correctly

### 7. Development Scripts ✅
- [ ] `run.py` works
- [ ] Poetry environment configured
- [ ] Code quality tools configured
- [ ] Tests can be run (even if none exist yet)

### 8. Code Quality ✅
- [ ] Black formatting configured
- [ ] isort configured
- [ ] mypy type checking configured
- [ ] flake8 linting configured
- [ ] All tools pass on current code

### 9. Documentation ✅
- [ ] README.md complete
- [ ] All setup steps documented
- [ ] API usage examples included
- [ ] Deployment notes included

### 10. Git ✅
- [ ] `.gitignore` configured
- [ ] Initial commit created
- [ ] No secrets committed

### Automated Verification

Run these tests to verify everything:

```bash
# 1. Check Python version
python --version  # Should be 3.11+

# 2. Check dependencies
pip list | grep fastapi  # Should show fastapi 0.115.0

# 3. Test configuration loading
python -c "from src.config import settings; assert settings.app_name"

# 4. Test logging
python -c "from src.core.logging import setup_logging; setup_logging()"

# 5. Test exceptions
python -c "from src.core.exceptions import InvalidCredentialsException"

# 6. Start server (in background)
python run.py &
sleep 5

# 7. Test endpoints
curl -f http://localhost:8000/ || exit 1
curl -f http://localhost:8000/health || exit 1
curl -f http://localhost:8000/api/v1/status || exit 1

# 8. Stop server
pkill -f "python run.py"
```

---

## Troubleshooting

### Issue: Python version mismatch
**Error:** `python: command not found` or version < 3.11
**Solution:**
```bash
# Install Python 3.11
# macOS:
brew install python@3.11

# Ubuntu:
sudo apt install python3.11 python3.11-venv

# Use specific version:
python3.11 -m venv venv
```

### Issue: Dependency installation fails
**Error:** `pip install` errors
**Solution:**
```bash
# Upgrade pip
pip install --upgrade pip setuptools wheel

# Install one by one to identify problem
pip install fastapi
pip install uvicorn
# etc.

# Check for OS-specific dependencies
# Ubuntu: sudo apt install python3-dev libpq-dev
# macOS: brew install postgresql
```

### Issue: Configuration not loading
**Error:** `ValidationError` when importing settings
**Solution:**
```bash
# Check .env file exists
ls -la .env

# Check .env format (no spaces around =)
cat .env

# Test manually:
python -c "from dotenv import load_dotenv; load_dotenv(); import os; print(os.getenv('APP_NAME'))"
```

### Issue: Server won't start
**Error:** Port already in use
**Solution:**
```bash
# Find process on port 8000
lsof -i :8000

# Kill process
kill -9 <PID>

# Or use different port
PORT=8001 python run.py
```

### Issue: CORS errors from frontend
**Error:** `Access-Control-Allow-Origin` error
**Solution:**
1. Check `CORS_ORIGINS` in `.env` includes frontend URL
2. Ensure frontend URL format is exact (no trailing slash)
3. Check CORS middleware is added in `src/main.py`

### Issue: Import errors
**Error:** `ModuleNotFoundError: No module named 'src'`
**Solution:**
```bash
# Ensure you're in learn-greek-easy-backend/ directory
pwd

# Use Poetry shell (Poetry manages virtual environment automatically)
poetry shell

# Or run commands with poetry run prefix
poetry run python run.py

# If still having issues, add src to PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
```

### Development Tips

1. **Use watchdog for auto-reload:**
```bash
uvicorn src.main:app --reload --reload-dir src
```

2. **Enable debug toolbar:**
```python
# Add to main.py in development
if settings.debug:
    from fastapi_debug import DebugAPIRoute
    app.router.route_class = DebugAPIRoute
```

3. **Use ipdb for debugging:**
```python
import ipdb; ipdb.set_trace()
```

4. **Check database connection:**
```python
# Will implement in Task 2
from src.db.session import engine
engine.connect()
```

5. **Monitor logs in real-time:**
```bash
tail -f logs/app.log
```

6. **Test API with httpie:**
```bash
pip install httpie
http GET http://localhost:8000/health
```

---

## Appendices

### Appendix A: Environment Variables Reference

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `APP_NAME` | string | "Learn Greek Easy API" | Application name |
| `APP_VERSION` | string | "0.1.0" | Application version |
| `APP_ENV` | string | "development" | Environment (dev/staging/prod) |
| `DEBUG` | boolean | false | Debug mode |
| `HOST` | string | "0.0.0.0" | Server host |
| `PORT` | integer | 8000 | Server port |
| `DATABASE_URL` | string | - | PostgreSQL connection URL |
| `REDIS_URL` | string | - | Redis connection URL |
| `JWT_SECRET_KEY` | string | - | JWT signing key (change in prod!) |
| `CORS_ORIGINS` | string | "http://localhost:5173" | Comma-separated origins |

See `.env.example` for complete list.

### Appendix B: API Response Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "Example"
  },
  "meta": {
    "timestamp": "2025-11-20T12:00:00Z"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "meta": {
    "timestamp": "2025-11-20T12:00:00Z"
  }
}
```

**Paginated Response:**
```json
{
  "success": true,
  "data": [
    {"id": "1", "name": "Item 1"},
    {"id": "2", "name": "Item 2"}
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_pages": 5,
    "total_items": 100
  }
}
```

### Appendix C: Code Style Guidelines

**Naming Conventions:**
- Classes: `PascalCase`
- Functions: `snake_case`
- Constants: `UPPER_SNAKE_CASE`
- Private: `_leading_underscore`

**Type Hints:**
```python
from typing import List, Optional, Dict, Any

def get_user(user_id: int) -> Optional[Dict[str, Any]]:
    """Get user by ID."""
    pass
```

**Docstrings:**
```python
def calculate_interval(quality: int, ease_factor: float) -> int:
    """
    Calculate next review interval using SM-2 algorithm.

    Args:
        quality: Quality rating (1-5)
        ease_factor: Current ease factor

    Returns:
        Next review interval in days

    Raises:
        ValueError: If quality not in range 1-5
    """
    pass
```

### Appendix D: Testing Strategy

**Unit Tests:**
- Test individual functions in isolation
- Mock external dependencies
- Fast execution (<1s per test)
- Located in `tests/unit/`

**Integration Tests:**
- Test API endpoints end-to-end
- Use test database
- Slower execution
- Located in `tests/integration/`

**Coverage Targets:**
- Overall: 80%+
- Critical paths (auth, SRS algorithm): 95%+

**Example Test:**
```python
import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_health_check():
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
```

---

## Summary

This plan provides a complete, production-ready foundation for the Learn Greek Easy backend API. All code examples are ready to use, and the implementation steps are clear and sequential.

**Estimated Time:** 2-3 hours

**What's Next:**
- **Task 2:** Database Design & Schema Creation
- **Task 3:** Core Authentication System
- **Task 4:** API Foundation & Middleware

---

**Document Version:** 2.0 (Updated for Python 3.14 + Poetry 2.2)
**Last Updated:** 2025-11-20
**Status:** Ready for Execution
**Python:** 3.14.0 (Installed)
**Poetry:** 2.2.1 (Installed)
**Next Action:** Begin implementation with Step 1 using Poetry
