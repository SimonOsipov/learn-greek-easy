"""FastAPI application entry point."""

import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import AsyncGenerator, Sequence

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.api.health import router as health_router
from src.api.v1 import v1_router
from src.config import settings
from src.core.exceptions import BaseAPIException
from src.core.logging import get_logger, setup_logging
from src.core.posthog import init_posthog, shutdown_posthog
from src.core.redis import close_redis, init_redis
from src.core.sentry import (
    capture_exception_if_needed,
    init_sentry,
    is_sentry_enabled,
    shutdown_sentry,
)
from src.db import close_db, init_db
from src.middleware import (
    AuthLoggingMiddleware,
    ErrorHandlingMiddleware,
    RateLimitingMiddleware,
    RequestLoggingMiddleware,
    VersionHeaderMiddleware,
)

# Setup logging
setup_logging()
logger = get_logger(__name__)


async def _start_openrouter_client() -> None:
    """Initialize OpenRouter HTTP client (connection pooling + HTTP/2)."""
    try:
        from src.services.openrouter_service import get_openrouter_service

        await get_openrouter_service().start()
        logger.info("OpenRouter HTTP client initialized")
    except Exception as exc:
        logger.warning("OpenRouter client initialization failed: {error}", error=str(exc))


async def _close_openrouter_client() -> None:
    """Close OpenRouter HTTP client and release connection pool."""
    try:
        from src.services.openrouter_service import get_openrouter_service

        await get_openrouter_service().close()
    except Exception as exc:
        logger.warning("OpenRouter client shutdown failed: {error}", error=str(exc))


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager."""
    # Startup
    logger.info("Starting Learn Greek Easy API", version=settings.app_version)

    # Validate CORS configuration
    cors_warnings = settings.validate_cors_for_production()
    for warning in cors_warnings:
        logger.warning(
            "CORS configuration warning: {warning}",
            warning=warning,
            category="security",
            config="cors",
        )

    # Initialize database connection
    await init_db()

    # Initialize Redis connection
    await init_redis()

    # Initialize PostHog analytics
    init_posthog()

    # Initialize Sentry error tracking
    init_sentry()

    # Warm up NLP services (spaCy + Hunspell) to eliminate cold-start penalty
    morphology_ms = 0.0
    spellcheck_ms = 0.0
    morphology_ok = False
    spellcheck_ok = False
    try:
        from src.services.morphology_service import get_morphology_service

        t0 = time.perf_counter()
        get_morphology_service()
        morphology_ms = (time.perf_counter() - t0) * 1000
        morphology_ok = True
    except Exception as exc:
        logger.warning("Morphology service warmup failed: {error}", error=str(exc))

    try:
        from src.services.spellcheck_service import get_spellcheck_service

        t0 = time.perf_counter()
        get_spellcheck_service()
        spellcheck_ms = (time.perf_counter() - t0) * 1000
        spellcheck_ok = True
    except Exception as exc:
        logger.warning("Spellcheck service warmup failed: {error}", error=str(exc))

    all_ok = morphology_ok and spellcheck_ok
    logger.info(
        "NLP services warmed up" if all_ok else "NLP services partially warmed up (some failures)",
        morphology_ms=round(morphology_ms, 1),
        spellcheck_ms=round(spellcheck_ms, 1),
        morphology_ok=morphology_ok,
        spellcheck_ok=spellcheck_ok,
    )

    await _start_openrouter_client()

    # Auto-seed on deploy (local dev only)
    if settings.seed_on_deploy and settings.can_seed_database():
        logger.info("SEED_ON_DEPLOY enabled, auto-seeding database...")
        try:
            from src.db import get_session_factory
            from src.services.seed_service import SeedService

            session_factory = get_session_factory()
            async with session_factory() as db:
                service = SeedService(db)
                result = await service.seed_all()
                logger.info(
                    "Auto-seed completed",
                    users_created=len(result.get("users", {}).get("users", [])),
                    decks_created=len(result.get("content", {}).get("decks", [])),
                )
        except Exception as e:
            logger.exception("Auto-seed failed: {error}", error=str(e))
            # Don't fail startup on seed error

    yield

    # Shutdown
    logger.info("Shutting down Learn Greek Easy API")

    # Shutdown Sentry (flush events before closing connections)
    shutdown_sentry()

    # Shutdown PostHog analytics (flush events before closing connections)
    shutdown_posthog()

    await _close_openrouter_client()

    # Close Redis connection
    await close_redis()

    # Close database connection
    await close_db()


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
# NOTE: Starlette middleware execution order is REVERSE of registration order.
# Last registered = first to execute on request, first to process response.
# We want CORS to process ALL responses (including error responses from
# ErrorHandlingMiddleware), so CORS must be registered LAST.

# Version header middleware for stale client detection
# Adds X-App-Version header to all responses
app.add_middleware(VersionHeaderMiddleware)

# NOTE: TrustedHostMiddleware removed - Railway handles host security at the edge,
# and internal health checks use unpredictable Host headers that cause 400 errors.
# For private services (not exposed to internet), this middleware is unnecessary.

# Auth logging middleware for security monitoring
app.add_middleware(AuthLoggingMiddleware)

# Rate limiting middleware - checks limits before processing
app.add_middleware(RateLimitingMiddleware)

# Error handling middleware - catches exceptions from downstream middleware
app.add_middleware(ErrorHandlingMiddleware)

# Request logging middleware for comprehensive API observability
# Sets request_id early in the chain
app.add_middleware(RequestLoggingMiddleware)

# CORS middleware - MUST be registered LAST so it executes FIRST on request
# and wraps ALL responses (including error responses from ErrorHandlingMiddleware).
# This ensures CORS headers are added to every response, not just successful ones.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
    expose_headers=settings.cors_expose_headers,
)

# ============================================================================
# Exception Handlers
# ============================================================================


@app.exception_handler(BaseAPIException)
async def base_api_exception_handler(
    request: Request,
    exc: BaseAPIException,
) -> JSONResponse:
    """Handle custom API exceptions."""
    request_id = getattr(request.state, "request_id", "unknown")

    logger.error(
        "API Exception: {error_code}",
        error_code=exc.error_code,
        detail=exc.detail,
        path=request.url.path,
        method=request.method,
        request_id=request_id,
    )

    # Only capture 5xx errors to Sentry (not 4xx client errors)
    if exc.status_code >= 500:
        user_email = getattr(request.state, "user_email", None)
        capture_exception_if_needed(
            exc,
            user_email=user_email,
            extra={
                "request_id": request_id,
                "error_code": exc.error_code,
                "path": request.url.path,
                "method": request.method,
            },
        )

    # Merge existing headers with X-Request-ID
    headers = dict(exc.headers) if exc.headers else {}
    headers.setdefault("X-Request-ID", request_id)

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.error_code,
                "message": exc.detail,
                "extra": exc.extra,
                "request_id": request_id,
            },
        },
        headers=headers,
    )


def _sanitize_validation_errors(errors: list | Sequence) -> list:
    """Sanitize validation errors for JSON serialization.

    Pydantic validation errors may contain non-serializable objects
    in the 'ctx' field (e.g., ValueError instances). This function
    converts them to strings.
    """
    sanitized = []
    for error in errors:
        sanitized_error = {}
        for key, value in error.items():
            if key == "ctx" and isinstance(value, dict):
                # Convert any exception objects in ctx to strings
                sanitized_error[key] = {
                    k: str(v) if isinstance(v, Exception) else v for k, v in value.items()
                }
            else:
                sanitized_error[key] = value
        sanitized.append(sanitized_error)
    return sanitized


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Handle Pydantic validation errors."""
    logger.warning(
        "Validation error",
        errors=exc.errors(),
        path=request.url.path,
        method=request.method,
    )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": _sanitize_validation_errors(exc.errors()),
            },
        },
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(
    request: Request,
    exc: StarletteHTTPException,
) -> JSONResponse:
    """Handle HTTP exceptions."""
    # Log 4xx at WARNING (client errors), 5xx at ERROR (server errors)
    if exc.status_code >= 500:
        logger.error(
            "HTTP {status_code} error",
            status_code=exc.status_code,
            detail=exc.detail,
            path=request.url.path,
            method=request.method,
        )
    else:
        logger.warning(
            "HTTP {status_code} error",
            status_code=exc.status_code,
            detail=exc.detail,
            path=request.url.path,
            method=request.method,
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
    request_id = getattr(request.state, "request_id", "unknown")

    logger.exception(
        "Unhandled exception",
        request_id=request_id,
        path=request.url.path,
        method=request.method,
    )

    # Capture to Sentry with request context
    user_email = getattr(request.state, "user_email", None)
    capture_exception_if_needed(
        exc,
        user_email=user_email,
        extra={
            "request_id": request_id,
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
                "request_id": request_id,
            },
        },
        headers={"X-Request-ID": request_id},
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


@app.get(f"{settings.api_v1_prefix}/status")
async def api_status() -> dict:
    """API status endpoint with detailed information."""
    return {
        "api_version": "v1",
        "app_version": settings.app_version,
        "environment": settings.app_env,
        "features": {
            "supabase_auth": True,
            "email_notifications": settings.feature_email_notifications,
            "rate_limiting": settings.feature_rate_limiting,
            "background_tasks": settings.feature_background_tasks,
        },
    }


# Store the startup time when the module loads
_startup_time = datetime.now(timezone.utc).isoformat()


@app.get("/version")
async def version() -> dict:
    """Version endpoint for deployment verification.

    Returns commit SHA, branch, and build time to verify
    which code is actually deployed in preview environments.
    """
    return {
        "commit_sha": os.environ.get(
            "RAILWAY_GIT_COMMIT_SHA", os.environ.get("GITHUB_SHA", "local")
        ),
        "branch": os.environ.get("RAILWAY_GIT_BRANCH", "unknown"),
        "build_time": _startup_time,
        "environment": settings.app_env,
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
                "expose_headers": settings.cors_expose_headers,
                "methods": settings.cors_allow_methods,
                "headers": settings.cors_allow_headers,
            },
            "features": {
                "supabase_auth": True,
                "email_notifications": settings.feature_email_notifications,
                "rate_limiting": settings.feature_rate_limiting,
                "background_tasks": settings.feature_background_tasks,
            },
        }

    @app.post("/debug/sentry-test")
    async def trigger_sentry_test(request: Request) -> dict:
        """Trigger a test exception to verify Sentry integration.

        Returns information about whether the exception was captured.
        """
        try:
            raise ValueError("This is a test exception for Sentry verification")
        except Exception as exc:
            request_id = getattr(request.state, "request_id", "test")
            event_id = capture_exception_if_needed(
                exc,
                extra={
                    "request_id": request_id,
                    "test": True,
                    "endpoint": "/debug/sentry-test",
                },
            )
            return {
                "success": True,
                "sentry_enabled": is_sentry_enabled(),
                "event_captured": event_id is not None,
                "event_id": event_id,
                "message": (
                    "Test exception sent to Sentry"
                    if event_id
                    else "Sentry not enabled or capture failed"
                ),
            }


# Include health check routes (not versioned - available at /health*)
app.include_router(health_router)

# Include API v1 routes
# All v1 endpoints are aggregated in src/api/v1/router.py
app.include_router(v1_router, prefix=settings.api_v1_prefix)

# Future: API v2 routes
# When breaking changes are needed, create src/api/v2/router.py and mount it:
# from src.api.v2 import v2_router
# app.include_router(v2_router, prefix="/api/v2")


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
