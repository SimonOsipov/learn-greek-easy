"""Database session management with async SQLAlchemy 2.0."""

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


async def init_db() -> None:
    """
    Initialize database connection on application startup.

    Should be called in FastAPI lifespan startup event.
    """
    global _engine, _session_factory

    if _engine is not None:
        logger.warning("Database engine already initialized")
        return

    logger.info("Initializing database connection...")

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


async def close_db() -> None:
    """
    Close database connection on application shutdown.

    Should be called in FastAPI lifespan shutdown event.
    """
    global _engine, _session_factory

    if _engine is None:
        return

    logger.info("Closing database connection...")

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
