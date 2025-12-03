"""Redis client management with connection pooling."""

import asyncio
import logging
from typing import Optional, Tuple

from redis.asyncio import ConnectionPool, Redis
from redis.exceptions import ConnectionError, TimeoutError

from src.config import settings

logger = logging.getLogger(__name__)

# Global Redis client instance
_redis_client: Optional[Redis] = None
_connection_pool: Optional[ConnectionPool] = None


async def init_redis() -> None:
    """
    Initialize Redis connection pool on application startup.

    Should be called in FastAPI lifespan startup event.
    """
    global _redis_client, _connection_pool

    if _redis_client is not None:
        logger.warning("Redis client already initialized")
        return

    logger.info("Initializing Redis connection...")

    try:
        # Create connection pool
        _connection_pool = ConnectionPool.from_url(
            settings.redis_url,
            max_connections=10,
            decode_responses=True,
            socket_timeout=settings.health_check_redis_timeout,
            socket_connect_timeout=settings.health_check_redis_timeout,
        )

        # Create client with pool
        _redis_client = Redis(connection_pool=_connection_pool)

        # Test connection
        await _redis_client.ping()
        logger.info("Redis connection successful")

    except Exception as e:
        logger.warning(f"Redis connection failed: {e}. Application will run in degraded mode.")
        _redis_client = None
        _connection_pool = None


async def close_redis() -> None:
    """
    Close Redis connection on application shutdown.

    Should be called in FastAPI lifespan shutdown event.
    """
    global _redis_client, _connection_pool

    if _redis_client is None:
        return

    logger.info("Closing Redis connection...")

    try:
        await _redis_client.close()
        if _connection_pool:
            await _connection_pool.disconnect()
    except Exception as e:
        logger.error(f"Error closing Redis connection: {e}")
    finally:
        _redis_client = None
        _connection_pool = None

    logger.info("Redis connection closed")


def get_redis() -> Optional[Redis]:
    """
    Get the global Redis client instance.

    Returns:
        Redis client or None if not initialized/available
    """
    return _redis_client


async def check_redis_health(timeout: Optional[float] = None) -> Tuple[bool, float, str]:
    """
    Check Redis connection health.

    Args:
        timeout: Optional timeout override in seconds

    Returns:
        Tuple of (is_healthy, latency_ms, message)
    """
    if _redis_client is None:
        return False, 0.0, "Redis client not initialized"

    check_timeout = timeout or settings.health_check_redis_timeout

    try:
        start_time = asyncio.get_event_loop().time()

        # Use asyncio.wait_for for timeout control
        await asyncio.wait_for(
            _redis_client.ping(),
            timeout=check_timeout,
        )

        latency_ms = (asyncio.get_event_loop().time() - start_time) * 1000

        return True, latency_ms, "PONG received"

    except asyncio.TimeoutError:
        return False, 0.0, f"Connection timeout after {check_timeout}s"

    except ConnectionError as e:
        return False, 0.0, f"Connection error: {str(e)}"

    except TimeoutError as e:
        return False, 0.0, f"Timeout error: {str(e)}"

    except Exception as e:
        return False, 0.0, f"Unexpected error: {str(e)}"
