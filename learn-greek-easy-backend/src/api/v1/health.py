"""Versioned health check API endpoints.

This module provides health check endpoints under /api/v1/health/*
to enable accessing health checks through the frontend proxy.

These endpoints mirror the root-level /health endpoints but are accessible
via the versioned API path, allowing health checks to work when the backend
is private and only accessible through the frontend's Caddy proxy.

Endpoints:
    GET /api/v1/health - Comprehensive health check with all components
    GET /api/v1/health/live - Kubernetes-style liveness probe
    GET /api/v1/health/ready - Kubernetes-style readiness probe
"""

from fastapi import APIRouter, Response

from src.schemas.health import HealthResponse, LivenessResponse, ReadinessResponse
from src.services.health_service import get_health_status, get_liveness_status, get_readiness_status

router = APIRouter(prefix="/health", tags=["Health"])


@router.get(
    "",
    response_model=HealthResponse,
    summary="Comprehensive health check",
    description="Perform comprehensive health check including database, Redis, and memory status.",
    responses={
        200: {
            "description": "System is healthy or degraded",
            "content": {
                "application/json": {
                    "example": {
                        "status": "healthy",
                        "version": "0.1.0",
                        "environment": "production",
                        "timestamp": "2024-12-02T10:30:00Z",
                        "uptime_seconds": 3600,
                        "checks": {
                            "database": {
                                "status": "healthy",
                                "latency_ms": 5.2,
                                "message": "Connection successful",
                            },
                            "redis": {
                                "status": "healthy",
                                "latency_ms": 1.1,
                                "message": "PONG received",
                            },
                            "memory": {
                                "status": "healthy",
                                "used_mb": 128.5,
                                "percent": 45.2,
                                "message": "Memory usage normal",
                            },
                        },
                    }
                }
            },
        },
        503: {
            "description": "System is unhealthy (database unavailable)",
        },
    },
)
async def health_check(response: Response) -> HealthResponse:
    """Perform comprehensive health check via /api/v1/health.

    This endpoint checks the health of all critical components:
    - Database connectivity and latency
    - Redis connectivity and latency
    - Memory usage

    Returns:
        HealthResponse with overall status and component details.
        HTTP 200 if healthy or degraded, 503 if unhealthy.
    """
    health_response, http_status = await get_health_status()
    response.status_code = http_status
    return health_response


@router.get(
    "/live",
    response_model=LivenessResponse,
    summary="Liveness probe",
    description="Kubernetes-style liveness probe. Returns immediately if the process is alive.",
    responses={
        200: {
            "description": "Process is alive",
            "content": {
                "application/json": {
                    "example": {
                        "status": "alive",
                        "timestamp": "2024-12-02T10:30:00Z",
                    }
                }
            },
        },
    },
)
async def liveness_check() -> LivenessResponse:
    """Liveness probe at /api/v1/health/live.

    This is a lightweight check that returns immediately if the process is running.
    No dependency checks are performed - if this endpoint responds, the process is alive.

    Use this for Kubernetes liveness probes to detect stuck/frozen processes.

    Returns:
        LivenessResponse with status "alive" and current timestamp.
    """
    return await get_liveness_status()


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    summary="Readiness probe",
    description="Kubernetes-style readiness probe. Checks if all dependencies are available.",
    responses={
        200: {
            "description": "System is ready to accept traffic",
            "content": {
                "application/json": {
                    "example": {
                        "status": "ready",
                        "timestamp": "2024-12-02T10:30:00Z",
                        "checks": {"database": True, "redis": True},
                    }
                }
            },
        },
        503: {
            "description": "System is not ready (dependencies unavailable)",
            "content": {
                "application/json": {
                    "example": {
                        "status": "not_ready",
                        "timestamp": "2024-12-02T10:30:00Z",
                        "checks": {"database": False, "redis": True},
                    }
                }
            },
        },
    },
)
async def readiness_check(response: Response) -> ReadinessResponse:
    """Readiness probe at /api/v1/health/ready.

    This endpoint checks if the application is ready to accept traffic by verifying
    all critical dependencies (database and Redis) are available.

    Use this for Kubernetes readiness probes to control traffic routing.

    Returns:
        ReadinessResponse with status "ready" or "not_ready" and dependency checks.
        HTTP 200 if ready, 503 if not ready.
    """
    readiness_response, http_status = await get_readiness_status()
    response.status_code = http_status
    return readiness_response
