"""Health check service with component health verification."""

import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional, Tuple

import psutil
from sqlalchemy import text

from src.config import settings
from src.core.redis import check_redis_health
from src.db.session import get_session_factory
from src.schemas.health import (
    ComponentHealth,
    ComponentStatus,
    HealthChecks,
    HealthResponse,
    HealthStatus,
    LivenessResponse,
    MemoryHealth,
    ReadinessChecks,
    ReadinessResponse,
)

logger = logging.getLogger(__name__)

# Track application start time
_start_time: float = time.time()


def get_uptime_seconds() -> float:
    """Get application uptime in seconds."""
    return time.time() - _start_time


async def check_database_health(timeout: Optional[float] = None) -> ComponentHealth:
    """
    Check PostgreSQL database connectivity.

    Args:
        timeout: Optional timeout override in seconds

    Returns:
        ComponentHealth with database status
    """
    check_timeout = timeout or settings.health_check_db_timeout

    try:
        factory = get_session_factory()
    except RuntimeError:
        return ComponentHealth(
            status=ComponentStatus.UNHEALTHY,
            latency_ms=None,
            message="Database not initialized",
        )

    try:
        start_time = asyncio.get_event_loop().time()

        async with factory() as session:
            # Execute simple query with timeout
            result = await asyncio.wait_for(
                session.execute(text("SELECT 1")),
                timeout=check_timeout,
            )
            result.scalar()

        latency_ms = (asyncio.get_event_loop().time() - start_time) * 1000

        return ComponentHealth(
            status=ComponentStatus.HEALTHY,
            latency_ms=round(latency_ms, 2),
            message="Connection successful",
        )

    except asyncio.TimeoutError:
        return ComponentHealth(
            status=ComponentStatus.UNHEALTHY,
            latency_ms=None,
            message=f"Connection timeout after {check_timeout}s",
        )

    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return ComponentHealth(
            status=ComponentStatus.UNHEALTHY,
            latency_ms=None,
            message=f"Connection error: {str(e)}",
        )


async def check_redis_health_component(timeout: Optional[float] = None) -> ComponentHealth:
    """
    Check Redis connectivity.

    Args:
        timeout: Optional timeout override in seconds

    Returns:
        ComponentHealth with Redis status
    """
    is_healthy, latency_ms, message = await check_redis_health(timeout)

    return ComponentHealth(
        status=ComponentStatus.HEALTHY if is_healthy else ComponentStatus.UNHEALTHY,
        latency_ms=round(latency_ms, 2) if latency_ms > 0 else None,
        message=message,
    )


def check_memory_health() -> MemoryHealth:
    """
    Check application memory usage.

    Returns:
        MemoryHealth with memory statistics
    """
    try:
        process = psutil.Process(os.getpid())
        memory_info = process.memory_info()
        memory_percent = process.memory_percent()

        used_mb = memory_info.rss / (1024 * 1024)

        if memory_percent >= settings.health_check_memory_warning_percent:
            status = ComponentStatus.WARNING
            message = f"High memory usage: {memory_percent:.1f}%"
        else:
            status = ComponentStatus.HEALTHY
            message = "Memory usage normal"

        return MemoryHealth(
            status=status,
            used_mb=round(used_mb, 2),
            percent=round(memory_percent, 2),
            message=message,
        )

    except Exception as e:
        logger.error(f"Memory health check failed: {e}")
        return MemoryHealth(
            status=ComponentStatus.WARNING,
            used_mb=0.0,
            percent=0.0,
            message=f"Unable to check memory: {str(e)}",
        )


async def get_health_status() -> Tuple[HealthResponse, int]:
    """
    Perform comprehensive health check of all components.

    Returns:
        Tuple of (HealthResponse, HTTP status code)
    """
    # Run all checks in parallel
    db_check, redis_check = await asyncio.gather(
        check_database_health(),
        check_redis_health_component(),
        return_exceptions=True,
    )

    # Handle exceptions from gather
    if isinstance(db_check, Exception):
        logger.error(f"Database health check exception: {db_check}")
        db_check = ComponentHealth(
            status=ComponentStatus.UNHEALTHY,
            latency_ms=None,
            message=f"Check failed: {str(db_check)}",
        )

    if isinstance(redis_check, Exception):
        logger.error(f"Redis health check exception: {redis_check}")
        redis_check = ComponentHealth(
            status=ComponentStatus.UNHEALTHY,
            latency_ms=None,
            message=f"Check failed: {str(redis_check)}",
        )

    # Get memory status (synchronous)
    memory_check = check_memory_health()

    # Determine overall status
    # Database is critical - if unhealthy, system is unhealthy
    # Redis is non-critical - if unhealthy, system is degraded
    # Memory warning doesn't affect overall status

    # At this point, both checks are guaranteed to be ComponentHealth
    assert isinstance(db_check, ComponentHealth)
    assert isinstance(redis_check, ComponentHealth)

    if db_check.status == ComponentStatus.UNHEALTHY:
        overall_status = HealthStatus.UNHEALTHY
        http_status = 503
    elif redis_check.status == ComponentStatus.UNHEALTHY:
        overall_status = HealthStatus.DEGRADED
        http_status = 200  # Degraded is still "okay" for basic health checks
    else:
        overall_status = HealthStatus.HEALTHY
        http_status = 200

    response = HealthResponse(
        status=overall_status,
        version=settings.app_version,
        environment=settings.app_env,
        timestamp=datetime.now(timezone.utc),
        uptime_seconds=round(get_uptime_seconds(), 2),
        checks=HealthChecks(
            database=db_check,
            redis=redis_check,
            memory=memory_check,
        ),
    )

    return response, http_status


async def get_liveness_status() -> LivenessResponse:
    """
    Get liveness probe status.

    This is a simple check that returns immediately if the process is running.
    No dependency checks are performed.

    Returns:
        LivenessResponse
    """
    return LivenessResponse(
        status="alive",
        timestamp=datetime.now(timezone.utc),
    )


async def get_readiness_status() -> Tuple[ReadinessResponse, int]:
    """
    Get readiness probe status.

    Checks if the application is ready to accept traffic by verifying
    all critical dependencies are available.

    Returns:
        Tuple of (ReadinessResponse, HTTP status code)
    """
    # Check both database and Redis in parallel
    db_check, redis_check = await asyncio.gather(
        check_database_health(),
        check_redis_health_component(),
        return_exceptions=True,
    )

    # Determine readiness
    db_ready = isinstance(db_check, ComponentHealth) and db_check.status == ComponentStatus.HEALTHY
    redis_ready = (
        isinstance(redis_check, ComponentHealth) and redis_check.status == ComponentStatus.HEALTHY
    )

    # Both must be ready for the app to be ready
    is_ready = db_ready and redis_ready
    http_status = 200 if is_ready else 503

    response = ReadinessResponse(
        status="ready" if is_ready else "not_ready",
        timestamp=datetime.now(timezone.utc),
        checks=ReadinessChecks(
            database=db_ready,
            redis=redis_ready,
        ),
    )

    return response, http_status
