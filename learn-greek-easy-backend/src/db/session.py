"""Database session management with async SQLAlchemy 2.0."""

import asyncio
import logging
from typing import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from src.config import settings

# Note: Using stdlib logging here to avoid circular import.
# src.core.logging triggers src.core.__init__.py which imports
# src.core.dependencies which imports src.db.dependencies.
# Logs are still routed to loguru via InterceptHandler.
logger = logging.getLogger(__name__)


# Global engine instance (initialized on app startup)
_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None
_keepalive_task: asyncio.Task | None = None
_KEEPALIVE_INTERVAL_SECONDS = 300  # refresh warmed connections well inside pool_recycle=3600; keeps them hot against network/Postgres-side drops (Supavisor session mode does not idle-reap: client_idle_timeout defaults to 0)


def create_engine() -> AsyncEngine:
    """
    Create async SQLAlchemy engine with connection pooling.

    Configuration:
    - Uses asyncpg driver for PostgreSQL
    - AsyncAdaptedQueuePool for production (connection reuse, set automatically)
    - NullPool for testing (no connection pooling)
    - Connection pool size configurable via settings

    Returns:
        AsyncEngine: Configured SQLAlchemy async engine
    """
    # Build engine kwargs based on environment
    engine_kwargs = {
        "echo": settings.debug,  # Log SQL queries in debug mode
        "future": True,  # Use SQLAlchemy 2.0 API
        "pool_pre_ping": True,  # Verify connections before using
        "pool_recycle": 3600,  # Recycle connections after 1 hour
        "connect_args": {
            "server_settings": {"jit": "off"},  # Disable JIT for better performance
            "command_timeout": 60,  # Command timeout in seconds
            **({"ssl": "require"} if settings.is_production else {}),
        },
    }

    # Add pooling configuration based on environment
    if settings.is_testing:
        engine_kwargs["poolclass"] = NullPool
    else:
        # For production, let SQLAlchemy use AsyncAdaptedQueuePool automatically
        engine_kwargs["pool_size"] = settings.database_pool_size
        engine_kwargs["max_overflow"] = settings.database_max_overflow
        engine_kwargs["pool_timeout"] = settings.database_pool_timeout

    # Engine configuration
    engine = create_async_engine(settings.database_url, **engine_kwargs)

    logger.info(
        "Database engine created",
        extra={
            "url": (
                settings.database_url.split("@")[1] if "@" in settings.database_url else "unknown"
            ),  # Hide credentials
            "pool_size": settings.database_pool_size,
            "max_overflow": settings.database_max_overflow,
        },
    )

    return engine


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """
    Create async session factory.

    Args:
        engine: SQLAlchemy async engine

    Returns:
        async_sessionmaker: Session factory for creating database sessions
    """
    return async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,  # Don't expire objects after commit
        autoflush=False,  # Manual flush control
        autocommit=False,  # Manual commit control
    )


async def _warm_one() -> None:
    """Open one pooled connection, run SELECT 1, return it to the pool's idle set."""
    async with _engine.connect() as conn:  # type: ignore[union-attr]
        await conn.execute(text("SELECT 1"))


async def _keepalive_ping(warm_min: int) -> None:
    """One keepalive tick: touch warm_min pooled connections to reset their idle clocks."""
    for _ in range(warm_min):
        async with _engine.connect() as conn:  # type: ignore[union-attr]
            await conn.execute(text("SELECT 1"))


async def _keepalive_loop(warm_min: int) -> None:
    """Periodically ping the pool so warmed connections don't idle-reap / go cold."""
    while True:
        await asyncio.sleep(_KEEPALIVE_INTERVAL_SECONDS)
        try:
            await _keepalive_ping(warm_min)
        except Exception as e:  # never let the keepalive die silently on a transient error
            logger.warning("Keepalive ping failed", extra={"error": str(e)})


async def init_db(warm_min: int | None = None) -> None:
    """
    Initialize database connection on application startup.

    Should be called in FastAPI lifespan startup event.

    Args:
        warm_min: Number of connections to pre-warm. Defaults to
            settings.database_pool_warm_min. Pass 0 to opt out entirely.
    """
    global _engine, _session_factory, _keepalive_task

    if _engine is not None:
        logger.warning("Database engine already initialized")
        return

    # Clear any stale keepalive reference from a previous init/close cycle.
    _keepalive_task = None

    logger.info("Initializing database connection...")

    effective_warm_min = settings.database_pool_warm_min if warm_min is None else warm_min

    _engine = create_engine()
    _session_factory = create_session_factory(_engine)

    # Test connection
    try:
        async with _engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("Database connection successful")
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        raise

    # Pre-warm the pool: pre-pay the asyncpg connect() handshake (TCP + TLS +
    # Postgres startup) up front so the first requests after a cold start find
    # hot, ready connections instead of each paying ~85ms cold-connect. Each
    # warmed connection runs SELECT 1 and returns to the pool's idle set.
    # (SELECT 1 (int4) needs no custom-type lookup — asyncpg introspects lazily;
    #  the win here is the connect() handshake, not type-cache setup.)
    if not settings.is_testing and effective_warm_min > 0:
        try:
            await asyncio.gather(*[_warm_one() for _ in range(effective_warm_min)])
            logger.info("Pool pre-warmed", extra={"warm_min": effective_warm_min})
        except Exception as e:
            # Non-fatal: connectivity already verified above; pool fills lazily.
            logger.warning("Pool warm-up connection failed", extra={"error": str(e)})
        _keepalive_task = asyncio.create_task(_keepalive_loop(effective_warm_min))


async def close_db() -> None:
    """
    Close database connection on application shutdown.

    Should be called in FastAPI lifespan shutdown event.
    """
    global _engine, _session_factory, _keepalive_task

    if _engine is None:
        return

    logger.info("Closing database connection...")

    if _keepalive_task is not None:
        _keepalive_task.cancel()
        try:
            await _keepalive_task
        except asyncio.CancelledError:
            pass
        _keepalive_task = None

    await _engine.dispose()
    _engine = None
    _session_factory = None

    logger.info("Database connection closed")


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """
    Get the global session factory.

    Returns:
        async_sessionmaker: Session factory instance

    Raises:
        RuntimeError: If database not initialized
    """
    if _session_factory is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _session_factory


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Get async database session with automatic lifecycle management.

    This is a convenience function for getting sessions outside of
    FastAPI dependency injection (e.g., in background tasks).

    Usage:
        async with get_session() as session:
            result = await session.execute(select(User))

    Yields:
        AsyncSession: Database session
    """
    factory = get_session_factory()
    async with factory() as session:
        yield session
