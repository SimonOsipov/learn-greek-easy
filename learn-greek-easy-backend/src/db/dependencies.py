"""FastAPI dependencies for database access."""

from typing import AsyncGenerator

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging import get_logger
from src.db.session import get_session_factory

logger = get_logger(__name__)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency for database session.

    Provides automatic session lifecycle management:
    - Creates new session for each request
    - Commits on success
    - Rolls back on error
    - Always closes session

    Usage in routes:
        @router.get("/users")
        async def get_users(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(User))
            return result.scalars().all()

    Yields:
        AsyncSession: Database session for the request
    """
    factory = get_session_factory()

    async with factory() as session:
        try:
            logger.debug("Database session created")
            yield session

            # Commit if no exception occurred
            await session.commit()
            logger.debug("Database session committed")

        except SQLAlchemyError as e:
            # Rollback on database errors - these are real issues
            await session.rollback()
            logger.error(f"Database session rolled back due to SQLAlchemy error: {e}")
            raise

        except Exception as e:
            # Rollback on other exceptions - log at DEBUG to avoid Sentry noise
            # (these are often expected errors like validation failures)
            await session.rollback()
            logger.debug(f"Database session rolled back: {e}")
            raise

        finally:
            # Always close the session
            await session.close()
            logger.debug("Database session closed")


# Alternative: Transaction dependency (explicit transaction control)
async def get_db_transactional() -> AsyncGenerator[AsyncSession, None]:
    """
    Database session dependency with explicit transaction control.

    Unlike get_db(), this does NOT auto-commit. The route handler
    must explicitly call session.commit().

    Use this when you need fine-grained transaction control.

    Yields:
        AsyncSession: Database session (no auto-commit)
    """
    factory = get_session_factory()

    async with factory() as session:
        try:
            yield session

        except SQLAlchemyError as e:
            # Rollback on database errors - these are real issues
            await session.rollback()
            logger.error(f"Transactional session rolled back due to SQLAlchemy error: {e}")
            raise

        except Exception as e:
            # Rollback on other exceptions - log at DEBUG to avoid Sentry noise
            await session.rollback()
            logger.debug(f"Transactional session rolled back: {e}")
            raise

        finally:
            await session.close()
