# Task 05: API Foundation & Middleware - Technical Design Document

## Overview

**Feature**: API Foundation & Middleware
**Architecture Pattern**: Layered Middleware Pipeline with FastAPI
**Estimated Duration**: 2-3 hours
**Dependencies**: Task 3 (Authentication - 90%), Task 4 (Testing Framework - 100%)
**Priority**: High

### Objectives

1. Implement a robust middleware pipeline for cross-cutting concerns
2. Standardize API response formats across all endpoints
3. Add rate limiting for API protection
4. Enhance error handling with centralized management
5. Improve observability with comprehensive request/response logging
6. Establish API versioning strategy for future compatibility

---

## System Architecture

### Component Diagram

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                    FastAPI Application                   │
                    └─────────────────────────────────────────────────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    │                  Middleware Pipeline               │
                    │  (executed in reverse order of registration)       │
                    └────────────────────────────────────────────────────┘
                                              │
          ┌───────────────────────────────────┼───────────────────────────────────┐
          │                                   │                                   │
          ▼                                   ▼                                   ▼
┌──────────────────┐              ┌──────────────────┐              ┌──────────────────┐
│  CORS Middleware │              │ TrustedHost      │              │ Request Logging  │
│    (Existing)    │              │   Middleware     │              │   Middleware     │
│                  │              │   (Existing)     │              │     (NEW)        │
└──────────────────┘              └──────────────────┘              └──────────────────┘
                                              │
          ┌───────────────────────────────────┼───────────────────────────────────┐
          │                                   │                                   │
          ▼                                   ▼                                   ▼
┌──────────────────┐              ┌──────────────────┐              ┌──────────────────┐
│  Rate Limiting   │              │  Error Handling  │              │ Auth Logging     │
│   Middleware     │              │   Middleware     │              │   Middleware     │
│     (NEW)        │              │     (NEW)        │              │   (Existing)     │
└──────────────────┘              └──────────────────┘              └──────────────────┘
                                              │
                                              ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │                   API Router Layer                       │
                    │   /api/v1/* endpoints with Pydantic validation          │
                    └─────────────────────────────────────────────────────────┘
                                              │
          ┌───────────────────────────────────┼───────────────────────────────────┐
          │                                   │                                   │
          ▼                                   ▼                                   ▼
┌──────────────────┐              ┌──────────────────┐              ┌──────────────────┐
│  /health         │              │  /api/v1/auth/*  │              │  /api/v1/status  │
│  /health/live    │              │   (Existing)     │              │   (Existing)     │
│  /health/ready   │              │                  │              │                  │
│   (Existing)     │              │                  │              │                  │
└──────────────────┘              └──────────────────┘              └──────────────────┘
```

### Middleware Execution Order

FastAPI/Starlette processes middleware in **reverse order** of registration. The recommended registration order:

```python
# In main.py - register in this order:
1. CORSMiddleware           # First registered, last to process
2. TrustedHostMiddleware    # Production security
3. RequestLoggingMiddleware # Log all requests (NEW)
4. RateLimitingMiddleware   # Block abusive requests (NEW)
5. ErrorHandlingMiddleware  # Catch and format errors (NEW)
6. AuthLoggingMiddleware    # Log auth-specific requests (existing)
```

### Data Flow

1. **Request arrives** at FastAPI application
2. **CORSMiddleware** handles preflight requests and adds CORS headers
3. **TrustedHostMiddleware** validates Host header (production only)
4. **RequestLoggingMiddleware** logs request start, generates request ID
5. **RateLimitingMiddleware** checks rate limits, may reject request
6. **ErrorHandlingMiddleware** wraps request in try/except for error formatting
7. **AuthLoggingMiddleware** logs auth-specific requests
8. **Router** dispatches to appropriate endpoint handler
9. **Response flows back** through middleware in reverse
10. **RequestLoggingMiddleware** logs response status and duration

---

## Component Specifications

### 05.01: CORS Middleware Configuration

**Status**: ✅ COMPLETED (2025-12-05)

**Current State**:
```python
# src/main.py (lines 68-74)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)
```

**Enhancements Needed**:
1. Add `expose_headers` for custom response headers (e.g., `X-Request-ID`, rate limit headers)
2. Document CORS configuration in settings
3. Add validation for production origins

**Configuration Schema**:
```python
# src/config.py - additions
cors_expose_headers_raw: str = Field(
    default="X-Request-ID,X-RateLimit-Limit,X-RateLimit-Remaining,X-RateLimit-Reset",
    alias="cors_expose_headers",
    description="Headers exposed to browser (comma-separated)",
)

@property
def cors_expose_headers(self) -> List[str]:
    """Get exposed headers as a list."""
    return self._parse_list_from_string(self.cors_expose_headers_raw)
```

---

### 05.02: Request Logging Middleware

**Status**: ✅ COMPLETED (2025-12-05)
**PR**: [#11](https://github.com/SimonOsipov/learn-greek-easy/pull/11)

**Purpose**: Log all HTTP requests with timing, request IDs, and correlation data for observability.

**File**: `src/middleware/logging.py`

**Implementation Design**:

```python
"""Request logging middleware for comprehensive API observability."""

import logging
import time
import uuid
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging all HTTP requests with timing and request IDs.

    Features:
    - Generates unique request ID for correlation
    - Logs request start with method, path, client IP
    - Logs response with status code and duration
    - Adds X-Request-ID header to response
    - Supports log level based on status code

    Attributes:
        EXCLUDED_PATHS: Paths to exclude from logging (health checks, static files)
    """

    EXCLUDED_PATHS: list[str] = [
        "/health/live",  # Liveness probe - too frequent
        "/docs",
        "/redoc",
        "/openapi.json",
        "/favicon.ico",
    ]

    async def dispatch(
        self,
        request: Request,
        call_next: Callable,
    ) -> Response:
        """Process request and log details."""
        # Skip excluded paths
        if self._should_skip(request.url.path):
            return await call_next(request)

        # Generate request ID
        request_id = str(uuid.uuid4())[:8]  # Short ID for readability

        # Store in request state for access by handlers
        request.state.request_id = request_id

        # Log request start
        start_time = time.perf_counter()
        client_ip = self._get_client_ip(request)

        logger.info(
            "Request started",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "query": str(request.query_params) if request.query_params else None,
                "client_ip": client_ip,
                "user_agent": request.headers.get("user-agent"),
            },
        )

        # Process request
        try:
            response = await call_next(request)
        except Exception as e:
            # Log unhandled exceptions
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.exception(
                "Request failed with unhandled exception",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": round(duration_ms, 2),
                    "error": str(e),
                },
            )
            raise

        # Calculate duration
        duration_ms = (time.perf_counter() - start_time) * 1000

        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id

        # Log response
        log_level = self._get_log_level(response.status_code)
        logger.log(
            log_level,
            "Request completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2),
            },
        )

        return response

    def _should_skip(self, path: str) -> bool:
        """Check if path should be excluded from logging."""
        return any(path.startswith(excluded) for excluded in self.EXCLUDED_PATHS)

    def _get_client_ip(self, request: Request) -> str | None:
        """Extract client IP, handling proxied requests."""
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        if request.client:
            return request.client.host
        return None

    def _get_log_level(self, status_code: int) -> int:
        """Determine log level based on status code."""
        if status_code >= 500:
            return logging.ERROR
        elif status_code >= 400:
            return logging.WARNING
        return logging.INFO
```

**Request ID Flow**:
- Generated at middleware entry
- Stored in `request.state.request_id`
- Added to response as `X-Request-ID` header
- Included in all log entries for correlation

---

### 05.03: Error Handling Middleware

**Status**: ✅ COMPLETED (2025-12-06)
**PR**: [#12](https://github.com/SimonOsipov/learn-greek-easy/pull/12)

**Purpose**: Centralize exception handling with consistent error response format.

**File**: `src/middleware/error_handler.py`

**Current State Analysis**:
- Exception handlers exist in `main.py` (lines 95-225)
- Handlers for: `BaseAPIException`, `RequestValidationError`, `StarletteHTTPException`, generic `Exception`
- Response format is consistent: `{"success": false, "error": {...}}`

**Enhancement Design**:

```python
"""Centralized error handling middleware."""

import logging
import traceback
from typing import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from src.config import settings

logger = logging.getLogger(__name__)


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Middleware for catching and formatting unhandled errors.

    While FastAPI exception handlers catch most errors, this middleware
    provides an additional safety net for:
    - Errors in other middleware
    - Errors before reaching exception handlers
    - Consistent error logging with request context

    Note: This middleware complements, not replaces, FastAPI exception handlers.
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable,
    ) -> Response:
        """Process request with error catching."""
        try:
            return await call_next(request)
        except Exception as exc:
            # Get request ID if available
            request_id = getattr(request.state, "request_id", "unknown")

            # Log the error with full traceback
            logger.exception(
                "Unhandled middleware exception",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "error_type": type(exc).__name__,
                    "error_message": str(exc),
                },
            )

            # Build error response
            error_response = {
                "success": False,
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred",
                    "request_id": request_id,
                },
            }

            # Include debug info in development
            if settings.debug:
                error_response["error"]["debug"] = {
                    "type": type(exc).__name__,
                    "message": str(exc),
                    "traceback": traceback.format_exc().split("\n"),
                }

            return JSONResponse(
                status_code=500,
                content=error_response,
                headers={"X-Request-ID": request_id},
            )
```

**Standard Error Response Format**:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "request_id": "abc12345",
    "details": {},  // Optional: validation errors, etc.
    "extra": {}     // Optional: additional context
  }
}
```

---

### 05.04: Rate Limiting Middleware

**Status**: ✅ COMPLETED (2025-12-06)
**PR**: [#13](https://github.com/SimonOsipov/learn-greek-easy/pull/13)

**Purpose**: Protect API from abuse with configurable rate limits.

**File**: `src/middleware/rate_limit.py`

**Approach**: Redis-based sliding window rate limiting with fallback to in-memory.

**Configuration** (from `src/config.py`, lines 206-209):
```python
rate_limit_enabled: bool = Field(default=True, description="Enable rate limiting")
rate_limit_per_minute: int = Field(default=60, description="General rate limit")
rate_limit_auth_per_minute: int = Field(default=5, description="Auth endpoint rate limit")
```

**Implementation Design**:

```python
"""Rate limiting middleware with Redis backend."""

import logging
import time
from typing import Callable, Optional

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from src.config import settings
from src.core.redis import get_redis_client

logger = logging.getLogger(__name__)


class RateLimitInfo:
    """Rate limit configuration for an endpoint."""

    def __init__(
        self,
        limit: int,
        window_seconds: int = 60,
        key_prefix: str = "ratelimit",
    ):
        self.limit = limit
        self.window_seconds = window_seconds
        self.key_prefix = key_prefix


class RateLimitingMiddleware(BaseHTTPMiddleware):
    """Middleware for rate limiting API requests.

    Features:
    - Redis-based sliding window algorithm
    - Different limits for auth vs general endpoints
    - Rate limit headers in response
    - Graceful degradation when Redis unavailable
    - IP-based rate limiting (user-based for authenticated requests - future)

    Rate Limit Headers:
    - X-RateLimit-Limit: Maximum requests allowed
    - X-RateLimit-Remaining: Requests remaining in window
    - X-RateLimit-Reset: Unix timestamp when limit resets
    """

    # Endpoint-specific rate limits
    AUTH_PATHS = [
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/google",
    ]

    # Paths exempt from rate limiting
    EXEMPT_PATHS = [
        "/health",
        "/health/live",
        "/health/ready",
        "/docs",
        "/redoc",
        "/openapi.json",
    ]

    async def dispatch(
        self,
        request: Request,
        call_next: Callable,
    ) -> Response:
        """Process request with rate limiting."""
        # Skip if rate limiting disabled
        if not settings.feature_rate_limiting:
            return await call_next(request)

        path = request.url.path

        # Skip exempt paths
        if self._is_exempt(path):
            return await call_next(request)

        # Get rate limit config for this path
        rate_info = self._get_rate_limit(path)

        # Get client identifier (IP-based for now)
        client_id = self._get_client_id(request)

        # Check rate limit
        allowed, remaining, reset_at = await self._check_rate_limit(
            client_id, path, rate_info
        )

        if not allowed:
            request_id = getattr(request.state, "request_id", "unknown")
            logger.warning(
                "Rate limit exceeded",
                extra={
                    "request_id": request_id,
                    "client_id": client_id,
                    "path": path,
                    "limit": rate_info.limit,
                },
            )
            return self._rate_limit_response(rate_info, reset_at, request_id)

        # Process request
        response = await call_next(request)

        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(rate_info.limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, remaining - 1))
        response.headers["X-RateLimit-Reset"] = str(int(reset_at))

        return response

    def _is_exempt(self, path: str) -> bool:
        """Check if path is exempt from rate limiting."""
        return any(path.startswith(exempt) for exempt in self.EXEMPT_PATHS)

    def _get_rate_limit(self, path: str) -> RateLimitInfo:
        """Get rate limit configuration for path."""
        if any(path.startswith(auth_path) for auth_path in self.AUTH_PATHS):
            return RateLimitInfo(
                limit=settings.rate_limit_auth_per_minute,
                window_seconds=60,
                key_prefix="ratelimit:auth",
            )
        return RateLimitInfo(
            limit=settings.rate_limit_per_minute,
            window_seconds=60,
            key_prefix="ratelimit:api",
        )

    def _get_client_id(self, request: Request) -> str:
        """Get unique client identifier."""
        # Check for forwarded IP (behind proxy)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        if request.client:
            return request.client.host

        return "unknown"

    async def _check_rate_limit(
        self,
        client_id: str,
        path: str,
        rate_info: RateLimitInfo,
    ) -> tuple[bool, int, float]:
        """Check if request is within rate limit.

        Uses sliding window algorithm with Redis.

        Returns:
            Tuple of (allowed, remaining, reset_timestamp)
        """
        redis = get_redis_client()

        if redis is None:
            # Graceful degradation - allow request if Redis unavailable
            logger.warning("Redis unavailable for rate limiting, allowing request")
            return True, rate_info.limit, time.time() + rate_info.window_seconds

        current_time = time.time()
        window_start = current_time - rate_info.window_seconds

        # Key format: ratelimit:{type}:{client_id}
        key = f"{rate_info.key_prefix}:{client_id}"

        try:
            pipe = redis.pipeline()

            # Remove old entries outside window
            pipe.zremrangebyscore(key, 0, window_start)

            # Count requests in current window
            pipe.zcard(key)

            # Add current request
            pipe.zadd(key, {str(current_time): current_time})

            # Set expiry on key
            pipe.expire(key, rate_info.window_seconds)

            results = await pipe.execute()

            request_count = results[1]  # zcard result
            remaining = rate_info.limit - request_count
            reset_at = current_time + rate_info.window_seconds

            return remaining > 0, remaining, reset_at

        except Exception as e:
            logger.error(f"Rate limit check failed: {e}")
            # Graceful degradation
            return True, rate_info.limit, time.time() + rate_info.window_seconds

    def _rate_limit_response(
        self,
        rate_info: RateLimitInfo,
        reset_at: float,
        request_id: str,
    ) -> JSONResponse:
        """Generate rate limit exceeded response."""
        retry_after = max(1, int(reset_at - time.time()))

        return JSONResponse(
            status_code=429,
            content={
                "success": False,
                "error": {
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": "Too many requests. Please try again later.",
                    "request_id": request_id,
                    "retry_after": retry_after,
                },
            },
            headers={
                "X-RateLimit-Limit": str(rate_info.limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(int(reset_at)),
                "Retry-After": str(retry_after),
                "X-Request-ID": request_id,
            },
        )
```

**Rate Limiting Algorithm**: Sliding Window using Redis Sorted Sets
- Key: `ratelimit:{type}:{client_ip}`
- Score: Unix timestamp of request
- Members: Unique request identifiers
- Cleanup: Remove entries older than window on each request

---

### 05.05: Request Validation Enhancement

**Current State**: Pydantic validation is already implemented via FastAPI's automatic schema validation.

**Enhancement**: Create validation utilities for complex scenarios.

**File**: `src/utils/validation.py`

```python
"""Request validation utilities."""

import re
from typing import Any

from pydantic import field_validator, model_validator

# Regex patterns for common validations
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
UUID_REGEX = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)


def validate_pagination(page: int, page_size: int, max_page_size: int = 100) -> tuple[int, int]:
    """Validate and normalize pagination parameters.

    Args:
        page: Page number (1-indexed)
        page_size: Items per page
        max_page_size: Maximum allowed page size

    Returns:
        Tuple of (offset, limit) for database queries

    Raises:
        ValueError: If pagination parameters are invalid
    """
    if page < 1:
        raise ValueError("Page must be >= 1")
    if page_size < 1:
        raise ValueError("Page size must be >= 1")
    if page_size > max_page_size:
        page_size = max_page_size

    offset = (page - 1) * page_size
    return offset, page_size


def sanitize_search_query(query: str, max_length: int = 100) -> str:
    """Sanitize search query string.

    Args:
        query: Raw search query
        max_length: Maximum allowed length

    Returns:
        Sanitized query string
    """
    # Strip whitespace and limit length
    query = query.strip()[:max_length]

    # Remove potentially dangerous characters for SQL LIKE
    # (Note: SQLAlchemy parameterization handles SQL injection)
    query = re.sub(r"[%_\\]", "", query)

    return query
```

---

### 05.06: Response Formatting Utilities

**Purpose**: Standardize API response formats for consistency.

**File**: `src/utils/responses.py`

```python
"""Response formatting utilities for consistent API responses."""

from datetime import datetime
from typing import Any, Generic, List, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationMeta(BaseModel):
    """Pagination metadata for list responses."""

    page: int = Field(description="Current page number (1-indexed)")
    page_size: int = Field(description="Items per page")
    total_items: int = Field(description="Total number of items")
    total_pages: int = Field(description="Total number of pages")
    has_next: bool = Field(description="Whether there is a next page")
    has_prev: bool = Field(description="Whether there is a previous page")


class SuccessResponse(BaseModel, Generic[T]):
    """Standard success response wrapper."""

    success: bool = Field(default=True, description="Operation success status")
    data: T = Field(description="Response data")
    message: Optional[str] = Field(default=None, description="Optional success message")


class PaginatedResponse(BaseModel, Generic[T]):
    """Standard paginated response wrapper."""

    success: bool = Field(default=True, description="Operation success status")
    data: List[T] = Field(description="List of items")
    pagination: PaginationMeta = Field(description="Pagination metadata")


class ErrorDetail(BaseModel):
    """Error detail structure."""

    code: str = Field(description="Error code")
    message: str = Field(description="Human-readable error message")
    request_id: Optional[str] = Field(default=None, description="Request ID for tracing")
    details: Optional[dict[str, Any]] = Field(default=None, description="Additional error details")


class ErrorResponse(BaseModel):
    """Standard error response wrapper."""

    success: bool = Field(default=False, description="Always false for errors")
    error: ErrorDetail = Field(description="Error information")


def create_success_response(
    data: Any,
    message: Optional[str] = None,
) -> dict[str, Any]:
    """Create a standard success response.

    Args:
        data: Response data (will be serialized)
        message: Optional success message

    Returns:
        Dictionary ready for JSONResponse
    """
    response = {
        "success": True,
        "data": data,
    }
    if message:
        response["message"] = message
    return response


def create_paginated_response(
    items: List[Any],
    page: int,
    page_size: int,
    total_items: int,
) -> dict[str, Any]:
    """Create a standard paginated response.

    Args:
        items: List of items for current page
        page: Current page number (1-indexed)
        page_size: Items per page
        total_items: Total count of all items

    Returns:
        Dictionary ready for JSONResponse
    """
    total_pages = (total_items + page_size - 1) // page_size if page_size > 0 else 0

    return {
        "success": True,
        "data": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_items": total_items,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1,
        },
    }


def create_error_response(
    code: str,
    message: str,
    request_id: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Create a standard error response.

    Args:
        code: Error code (e.g., "NOT_FOUND", "VALIDATION_ERROR")
        message: Human-readable error message
        request_id: Request ID for tracing
        details: Additional error details

    Returns:
        Dictionary ready for JSONResponse
    """
    error = {
        "code": code,
        "message": message,
    }
    if request_id:
        error["request_id"] = request_id
    if details:
        error["details"] = details

    return {
        "success": False,
        "error": error,
    }
```

---

### 05.07: API Versioning Strategy

**Current State**: API v1 prefix is configured in `settings.api_v1_prefix` (default: `/api/v1`).

**Strategy**: URL Path Versioning (already implemented)

**Rationale**:
- Simple and explicit
- Easy to route and document
- Clear for frontend integration
- Matches existing implementation

**Enhancement**: Create versioned router structure

**File Structure**:
```
src/api/
├── __init__.py
├── health.py          # Non-versioned health endpoints
├── v1/
│   ├── __init__.py    # v1 router exports
│   ├── auth.py        # Authentication endpoints
│   ├── decks.py       # Deck management (future)
│   ├── cards.py       # Card management (future)
│   ├── reviews.py     # Review submission (future)
│   └── progress.py    # User progress (future)
└── v2/                # Future version
    └── __init__.py
```

**Router Organization** (`src/api/v1/__init__.py` - enhanced):
```python
"""API version 1 routers.

All v1 API endpoints are defined in this package.
Routers are prefixed with /api/v1 in main.py.
"""

from fastapi import APIRouter

from src.api.v1.auth import router as auth_router

# Create v1 root router
api_v1_router = APIRouter()

# Include all v1 routers
api_v1_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])

# Future routers:
# api_v1_router.include_router(deck_router, prefix="/decks", tags=["Decks"])
# api_v1_router.include_router(card_router, prefix="/cards", tags=["Cards"])
# api_v1_router.include_router(review_router, prefix="/reviews", tags=["Reviews"])
# api_v1_router.include_router(progress_router, prefix="/progress", tags=["Progress"])

__all__ = ["api_v1_router", "auth_router"]
```

**Main App Integration** (`src/main.py` - update):
```python
from src.api.v1 import api_v1_router

# Include versioned API
app.include_router(api_v1_router, prefix=settings.api_v1_prefix)
```

---

### 05.08: Health Check Endpoint

**Status**: Already Implemented

**Current Endpoints**:
- `GET /health` - Comprehensive health check (DB, Redis, Memory)
- `GET /health/live` - Kubernetes liveness probe
- `GET /health/ready` - Kubernetes readiness probe

**Implementation**: `src/api/health.py`, `src/services/health_service.py`, `src/schemas/health.py`

**No changes needed** - current implementation is complete and matches requirements.

---

## File Structure

```
src/
├── api/
│   ├── __init__.py
│   ├── health.py                    # Health endpoints (existing)
│   └── v1/
│       ├── __init__.py              # v1 router aggregation (enhance)
│       └── auth.py                  # Auth endpoints (existing)
├── config.py                        # Settings (enhance with CORS expose headers)
├── core/
│   ├── exceptions.py                # Custom exceptions (existing)
│   └── ...
├── middleware/
│   ├── __init__.py                  # Middleware exports (create)
│   ├── auth.py                      # Auth logging middleware (existing)
│   ├── logging.py                   # Request logging middleware (NEW)
│   ├── rate_limit.py                # Rate limiting middleware (NEW)
│   └── error_handler.py             # Error handling middleware (NEW)
├── utils/
│   ├── __init__.py                  # Utils exports (create)
│   ├── validation.py                # Validation utilities (NEW)
│   └── responses.py                 # Response formatting (NEW)
└── main.py                          # Application entry (update middleware order)

tests/
├── unit/
│   └── middleware/
│       ├── __init__.py              # (existing)
│       ├── test_auth_middleware.py  # (existing)
│       ├── test_logging_middleware.py   # (NEW)
│       ├── test_rate_limit_middleware.py # (NEW)
│       └── test_error_handler_middleware.py # (NEW)
│   └── utils/
│       ├── __init__.py              # (NEW)
│       ├── test_validation.py       # (NEW)
│       └── test_responses.py        # (NEW)
└── integration/
    └── api/
        ├── test_middleware_chain.py # Integration tests (NEW)
        └── test_rate_limiting.py    # Rate limit integration (NEW)
```

---

## Implementation Order

### Phase 1: Foundation (1 hour)
1. **05.06**: Create response formatting utilities (`src/utils/responses.py`)
2. **05.05**: Create validation utilities (`src/utils/validation.py`)
3. **05.01**: Enhance CORS configuration in `src/config.py`

### Phase 2: Middleware (1-1.5 hours)
4. **05.02**: Implement request logging middleware (`src/middleware/logging.py`)
5. **05.03**: Implement error handling middleware (`src/middleware/error_handler.py`)
6. **05.04**: Implement rate limiting middleware (`src/middleware/rate_limit.py`)

### Phase 3: Integration (30 minutes)
7. **05.07**: Enhance API versioning structure
8. Update `src/main.py` with middleware registration order
9. Create `src/middleware/__init__.py` for exports

### Phase 4: Testing (45 minutes - 1 hour)
10. Unit tests for each middleware
11. Integration tests for middleware chain
12. Rate limiting integration tests with Redis

---

## Testing Strategy

### Unit Tests

**Middleware Tests** (`tests/unit/middleware/`):

```python
# test_logging_middleware.py
class TestRequestLoggingMiddleware:
    """Unit tests for request logging middleware."""

    async def test_generates_request_id(self, client):
        """Test that request ID is generated and returned in header."""
        response = await client.get("/api/v1/status")
        assert "X-Request-ID" in response.headers
        assert len(response.headers["X-Request-ID"]) == 8

    async def test_logs_request_start_and_end(self, client, caplog):
        """Test that request start and completion are logged."""
        response = await client.get("/api/v1/status")
        assert "Request started" in caplog.text
        assert "Request completed" in caplog.text

    async def test_excludes_health_live_from_logging(self, client, caplog):
        """Test that /health/live is excluded from logging."""
        response = await client.get("/health/live")
        assert "Request started" not in caplog.text


# test_rate_limit_middleware.py
class TestRateLimitingMiddleware:
    """Unit tests for rate limiting middleware."""

    async def test_allows_requests_under_limit(self, client):
        """Test requests are allowed within rate limit."""
        for _ in range(5):
            response = await client.get("/api/v1/status")
            assert response.status_code == 200

    async def test_includes_rate_limit_headers(self, client):
        """Test rate limit headers are present in response."""
        response = await client.get("/api/v1/status")
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        assert "X-RateLimit-Reset" in response.headers

    async def test_blocks_requests_over_limit(self, client, mock_redis):
        """Test requests are blocked when rate limit exceeded."""
        # Simulate exceeded rate limit
        mock_redis.zcard.return_value = 100

        response = await client.get("/api/v1/status")
        assert response.status_code == 429
        assert "RATE_LIMIT_EXCEEDED" in response.json()["error"]["code"]

    async def test_auth_endpoints_have_stricter_limit(self, client):
        """Test auth endpoints use stricter rate limit."""
        # Auth limit is 5/minute vs 60/minute for general
        response = await client.post("/api/v1/auth/login", json={...})
        assert int(response.headers["X-RateLimit-Limit"]) == 5


# test_error_handler_middleware.py
class TestErrorHandlingMiddleware:
    """Unit tests for error handling middleware."""

    async def test_catches_unhandled_exceptions(self, client, mocker):
        """Test middleware catches exceptions from other middleware."""
        # Mock a middleware that raises an exception
        mocker.patch("src.middleware.logging.RequestLoggingMiddleware.dispatch",
                    side_effect=RuntimeError("Test error"))

        response = await client.get("/api/v1/status")
        assert response.status_code == 500
        assert response.json()["success"] is False

    async def test_includes_request_id_in_error(self, client):
        """Test error response includes request ID."""
        # Force an error
        response = await client.get("/api/v1/nonexistent")
        assert "request_id" in response.json()["error"]
```

**Utility Tests** (`tests/unit/utils/`):

```python
# test_responses.py
class TestResponseFormatting:
    """Unit tests for response formatting utilities."""

    def test_create_success_response(self):
        """Test success response creation."""
        response = create_success_response({"id": 1, "name": "test"})
        assert response["success"] is True
        assert response["data"]["id"] == 1

    def test_create_paginated_response(self):
        """Test paginated response creation."""
        response = create_paginated_response(
            items=[1, 2, 3],
            page=2,
            page_size=3,
            total_items=10,
        )
        assert response["pagination"]["total_pages"] == 4
        assert response["pagination"]["has_next"] is True
        assert response["pagination"]["has_prev"] is True


# test_validation.py
class TestValidationUtilities:
    """Unit tests for validation utilities."""

    def test_validate_pagination_valid(self):
        """Test pagination validation with valid params."""
        offset, limit = validate_pagination(page=2, page_size=20)
        assert offset == 20
        assert limit == 20

    def test_validate_pagination_caps_page_size(self):
        """Test pagination caps page size at maximum."""
        offset, limit = validate_pagination(page=1, page_size=500, max_page_size=100)
        assert limit == 100

    def test_sanitize_search_query(self):
        """Test search query sanitization."""
        result = sanitize_search_query("  test%query_  ")
        assert result == "testquery"
```

### Integration Tests

```python
# tests/integration/api/test_middleware_chain.py
class TestMiddlewareChain:
    """Integration tests for full middleware pipeline."""

    async def test_request_flows_through_all_middleware(self, client, caplog):
        """Test request passes through all middleware layers."""
        response = await client.get("/api/v1/status")

        # Verify request ID propagates through chain
        request_id = response.headers["X-Request-ID"]
        assert request_id in caplog.text

        # Verify rate limit headers present
        assert "X-RateLimit-Limit" in response.headers

    async def test_error_handling_preserves_request_context(self, client):
        """Test error responses include request context."""
        response = await client.get("/api/v1/nonexistent")

        assert response.status_code == 404
        assert "X-Request-ID" in response.headers


# tests/integration/api/test_rate_limiting.py
class TestRateLimitingIntegration:
    """Integration tests for rate limiting with Redis."""

    @pytest.mark.slow
    async def test_rate_limit_recovery_after_window(self, client):
        """Test rate limit resets after time window."""
        # Exhaust rate limit
        for _ in range(10):
            await client.post("/api/v1/auth/login", json={...})

        # Should be blocked
        response = await client.post("/api/v1/auth/login", json={...})
        assert response.status_code == 429

        # Wait for window to pass (use time mocking in practice)
        await asyncio.sleep(60)

        # Should work again
        response = await client.post("/api/v1/auth/login", json={...})
        assert response.status_code != 429
```

### Test Coverage Targets

| Component | Target Coverage |
|-----------|-----------------|
| `src/middleware/logging.py` | 95% |
| `src/middleware/rate_limit.py` | 90% |
| `src/middleware/error_handler.py` | 95% |
| `src/utils/validation.py` | 95% |
| `src/utils/responses.py` | 95% |
| **Overall Task 05** | **90%+** |

---

## Success Criteria

### Functional Requirements

1. **Request Logging**
   - [ ] All API requests are logged with method, path, status, duration
   - [ ] Unique request ID generated and returned in `X-Request-ID` header
   - [ ] Request ID included in all related log entries
   - [ ] Health probe endpoints excluded from verbose logging

2. **Error Handling**
   - [ ] All errors return consistent JSON format
   - [ ] Request ID included in error responses
   - [ ] Debug information available in development mode only
   - [ ] Unhandled exceptions caught and logged with stack trace

3. **Rate Limiting**
   - [ ] General API endpoints: 60 requests/minute
   - [ ] Auth endpoints: 5 requests/minute
   - [ ] Rate limit headers present in all responses
   - [ ] 429 response with retry information when exceeded
   - [ ] Graceful degradation when Redis unavailable

4. **CORS**
   - [ ] Custom headers exposed to browser (`X-Request-ID`, rate limit headers)
   - [ ] Origins properly validated in production

5. **Response Formatting**
   - [ ] Success responses follow standard format
   - [ ] Paginated responses include metadata
   - [ ] Error responses include code, message, request ID

### Non-Functional Requirements

1. **Performance**
   - [ ] Middleware overhead < 5ms per request
   - [ ] Rate limit check < 10ms (Redis operation)

2. **Reliability**
   - [ ] Rate limiting degrades gracefully without Redis
   - [ ] Error handling catches all unhandled exceptions

3. **Observability**
   - [ ] All requests traceable via request ID
   - [ ] Log entries include structured data for aggregation

4. **Testing**
   - [ ] Unit test coverage >= 90%
   - [ ] Integration tests pass
   - [ ] All middleware tested in isolation and together

---

## Open Questions

### Technical Decisions Needed

1. **Rate Limiting Key**: Should rate limiting be IP-based only, or include user ID for authenticated requests?
   - **Recommendation**: Start with IP-based, add user-based for authenticated endpoints in future

2. **Request ID Format**: Full UUID vs shortened (8 chars)?
   - **Recommendation**: 8-character shortened for readability in logs and headers

3. **Rate Limit Algorithm**: Fixed window vs sliding window?
   - **Recommendation**: Sliding window (implemented above) for smoother rate limiting

### Assumptions

1. Redis is available for rate limiting (graceful degradation implemented)
2. Request logging uses existing logging infrastructure (JSON format)
3. API versioning stays with URL path approach (/api/v1/)
4. Health endpoints remain outside versioned API prefix

---

## Security Considerations

### Rate Limiting
- Protects against brute force attacks on auth endpoints
- Prevents API abuse and DoS attempts
- IP-based limiting with proxy header support

### Error Handling
- No sensitive information leaked in production errors
- Stack traces only shown in debug mode
- Request context preserved for debugging

### CORS
- Production should use explicit origin whitelist
- Credentials properly handled
- Custom headers explicitly exposed

---

## References

- **Existing Implementation**: `src/main.py`, `src/middleware/auth.py`
- **Exception Hierarchy**: `src/core/exceptions.py`
- **Health Endpoints**: `src/api/health.py`
- **Configuration**: `src/config.py`
- **Testing Framework**: `tests/conftest.py`, Task 4 documentation

---

**Document Version**: 1.0
**Created**: 2025-12-05
**Author**: Architect Agent
**Status**: Ready for Review
