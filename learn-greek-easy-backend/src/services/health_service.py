"""Health check service with component health verification."""

import asyncio
import os
import time
from datetime import datetime, timezone
from typing import Awaitable, Callable, Generic, Optional, Tuple, TypeVar

import psutil
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from src.config import settings
from src.core.logging import get_logger
from src.core.redis import check_redis_health
from src.core.stripe import get_stripe_client, is_stripe_configured
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
    StripeHealth,
)

logger = get_logger(__name__)

# Track application start time
_start_time: float = time.time()


def get_uptime_seconds() -> float:
    """Get application uptime in seconds."""
    return time.time() - _start_time


# ---------------------------------------------------------------------------
# Health/readiness result cache (OPS-03-01)
#
# A tiny async single-flight TTL memo sits in front of get_readiness_status()
# and get_health_status() so that a burst of health pings collapses onto at
# most one DB + Redis round-trip per TTL window, regardless of concurrency.
# This protects the single-worker <=30-connection Supavisor budget (D3): N
# concurrent misses queue on one lock, only the first computes while the rest
# await and then read the freshly-cached value (single-flight, not a
# thundering memo). Both healthy AND unhealthy results are cached identically
# for the full window, so the connection budget also holds during an outage (a
# just-died dependency still flips within <=1 TTL). Uses time.monotonic() (not
# wall-clock) so a clock adjustment cannot extend the window.
# ---------------------------------------------------------------------------

_HEALTH_CACHE_TTL_SECONDS: float = 5.0

_T = TypeVar("_T")


class _AsyncSingleFlightTTL(Generic[_T]):
    """Async single-flight TTL cache holding one ``(value, monotonic-expiry)``.

    ``get(factory)`` serves the cached value while it is still fresh; on a miss
    it acquires a lock, double-checks freshness (a concurrent awaiter may have
    just filled the cache), and otherwise awaits ``factory()`` exactly once.
    """

    def __init__(self, ttl_seconds: float) -> None:
        self._ttl = ttl_seconds
        self._lock = asyncio.Lock()
        self._value: Optional[_T] = None
        self._expiry: float = 0.0

    async def get(self, factory: Callable[[], Awaitable[_T]]) -> _T:
        # Fast path: serve a still-fresh cached value without taking the lock.
        if time.monotonic() < self._expiry:
            assert self._value is not None
            return self._value

        async with self._lock:
            # Double-check: a concurrent awaiter may have filled the cache
            # while we were waiting for the lock.
            if time.monotonic() < self._expiry:
                assert self._value is not None
                return self._value

            value = await factory()
            self._value = value
            self._expiry = time.monotonic() + self._ttl
            return value

    def reset(self) -> None:
        """Drop the cached value so the next ``get()`` recomputes."""
        self._value = None
        self._expiry = 0.0


_readiness_cache: "_AsyncSingleFlightTTL[Tuple[ReadinessResponse, int]]" = _AsyncSingleFlightTTL(
    _HEALTH_CACHE_TTL_SECONDS
)
_health_cache: "_AsyncSingleFlightTTL[Tuple[HealthResponse, int]]" = _AsyncSingleFlightTTL(
    _HEALTH_CACHE_TTL_SECONDS
)


def _reset_health_caches() -> None:
    """Reset both health-service caches so the next call recomputes.

    Used by the service test module's autouse fixture to prevent a cached
    result from one test leaking into the next.
    """
    _readiness_cache.reset()
    _health_cache.reset()


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

        async with factory.begin() as session:
            result = await session.execute(text("SELECT 1"))
            result.scalar()

        latency_ms = (asyncio.get_event_loop().time() - start_time) * 1000

        return ComponentHealth(
            status=ComponentStatus.HEALTHY,
            latency_ms=round(latency_ms, 2),
            message="Connection successful",
        )

    except OperationalError:
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


async def check_stripe_health(timeout: Optional[float] = None) -> StripeHealth:
    """Check Stripe API connectivity.

    Args:
        timeout: Optional timeout in seconds (default: 5.0)

    Returns:
        StripeHealth: Stripe health status
    """
    if not is_stripe_configured():
        return StripeHealth(
            status="unconfigured",
            message="Stripe secret key not configured",
        )

    timeout = timeout or 5.0

    try:
        client = get_stripe_client()
        await asyncio.wait_for(
            client.v1.accounts.retrieve_current_async(),
            timeout=timeout,
        )
        return StripeHealth(
            status="ok",
            message="Stripe API reachable",
        )
    except asyncio.TimeoutError:
        return StripeHealth(
            status="error",
            message=f"Stripe API timeout after {timeout}s",
        )
    except Exception as e:
        logger.warning(f"Stripe health check failed: {e}")
        return StripeHealth(
            status="error",
            message=f"Stripe API error: {str(e)}",
        )


async def get_health_status() -> Tuple[HealthResponse, int]:
    """Return the comprehensive health check, cached ~5s (single-flight).

    Thin wrapper over :func:`_compute_health_status`; see the module-level
    cache note. Both routers call this, so one cache covers all public health
    surfaces.
    """
    return await _health_cache.get(_compute_health_status)


async def _compute_health_status() -> Tuple[HealthResponse, int]:
    """
    Perform comprehensive health check of all components.

    Returns:
        Tuple of (HealthResponse, HTTP status code)
    """
    # Run all checks in parallel (Stripe excluded from the aggregate health poll —
    # it makes a synchronous external API call and should not block liveness/readiness)
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

    # Determine overall status
    # Database is critical - if unhealthy, system is unhealthy
    # Redis is non-critical - if unhealthy, system is degraded

    # At this point, checks are guaranteed to be their respective types
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
        timestamp=datetime.now(timezone.utc),
        uptime_seconds=round(get_uptime_seconds(), 2),
        checks=HealthChecks(
            database=db_check,
            redis=redis_check,
            stripe=None,  # Not polled in the aggregate; call check_stripe_health() explicitly if needed
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
    """Return the readiness probe status, cached ~5s (single-flight).

    Thin wrapper over :func:`_compute_readiness_status`; see the module-level
    cache note. Both routers call this, so one cache covers all public
    readiness surfaces.
    """
    return await _readiness_cache.get(_compute_readiness_status)


async def _compute_readiness_status() -> Tuple[ReadinessResponse, int]:
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
