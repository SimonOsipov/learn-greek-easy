"""Health check API endpoints.

This module provides health check endpoints for monitoring and
Kubernetes probes (liveness and readiness).
"""

import logging

from fastapi import APIRouter, Response

from src.schemas.health import HealthResponse, LivenessResponse, ReadinessResponse
from src.services.health_service import get_health_status, get_liveness_status, get_readiness_status

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Comprehensive health check",
    responses={
        200: {
            "description": "Application is healthy or degraded",
            "content": {
                "application/json": {
                    "examples": {
                        "healthy": {
                            "summary": "All systems operational",
                            "value": {
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
                            },
                        },
                        "degraded": {
                            "summary": "Non-critical service unavailable",
                            "value": {
                                "status": "degraded",
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
                                        "status": "unhealthy",
                                        "latency_ms": None,
                                        "message": "Connection timeout after 3s",
                                    },
                                    "memory": {
                                        "status": "healthy",
                                        "used_mb": 128.5,
                                        "percent": 45.2,
                                        "message": "Memory usage normal",
                                    },
                                },
                            },
                        },
                    }
                }
            },
        },
        503: {
            "description": "Critical service unavailable",
            "content": {
                "application/json": {
                    "example": {
                        "status": "unhealthy",
                        "version": "0.1.0",
                        "environment": "production",
                        "timestamp": "2024-12-02T10:30:00Z",
                        "uptime_seconds": 3600,
                        "checks": {
                            "database": {
                                "status": "unhealthy",
                                "latency_ms": None,
                                "message": "Connection error: Connection refused",
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
    },
)
async def health_check(response: Response) -> HealthResponse:
    """Perform comprehensive health check of all application components.

    This endpoint checks:
    - **Database**: PostgreSQL connectivity via simple query
    - **Redis**: Cache connectivity via PING command
    - **Memory**: Application memory usage statistics

    Status meanings:
    - **healthy**: All components operational
    - **degraded**: Non-critical components unavailable (Redis)
    - **unhealthy**: Critical components unavailable (Database)

    Returns:
        HealthResponse with detailed component status
    """
    health_response, http_status = await get_health_status()
    response.status_code = http_status
    return health_response


@router.get(
    "/health/live",
    response_model=LivenessResponse,
    summary="Liveness probe",
    responses={
        200: {
            "description": "Application process is alive",
            "content": {
                "application/json": {
                    "example": {"status": "alive", "timestamp": "2024-12-02T10:30:00Z"}
                }
            },
        },
    },
)
async def liveness_check() -> LivenessResponse:
    """Kubernetes liveness probe endpoint.

    Returns 200 if the application process is running. This check does NOT
    verify dependencies - it only confirms the FastAPI process is alive.

    Use this for Kubernetes livenessProbe to detect deadlocks or unresponsive
    processes that should be restarted.

    Returns:
        LivenessResponse with alive status
    """
    return await get_liveness_status()


@router.get(
    "/health/ready",
    response_model=ReadinessResponse,
    summary="Readiness probe",
    responses={
        200: {
            "description": "Application is ready to accept traffic",
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
            "description": "Application is not ready",
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
    """Kubernetes readiness probe endpoint.

    Returns 200 if the application is ready to accept traffic, meaning all
    dependencies (database, Redis) are available.

    Use this for Kubernetes readinessProbe to prevent routing traffic to
    pods that aren't ready to handle requests.

    Returns:
        ReadinessResponse with ready/not_ready status
    """
    readiness_response, http_status = await get_readiness_status()
    response.status_code = http_status
    return readiness_response
