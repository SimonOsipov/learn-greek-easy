"""Background task functions for async operations.

This module provides FastAPI BackgroundTasks functions that can be
executed asynchronously after a response has been sent to the client.

Usage:
    from fastapi import BackgroundTasks
    from src.tasks import check_achievements_task

    @router.post("/review")
    async def submit_review(background_tasks: BackgroundTasks):
        # ... process review ...
        background_tasks.add_task(check_achievements_task, user_id, db_url)
        return response
"""

import logging
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config import settings

logger = logging.getLogger(__name__)


def is_background_tasks_enabled() -> bool:
    """Check if background tasks feature is enabled.

    Returns:
        bool: True if background tasks are enabled via feature flag.
    """
    return settings.feature_background_tasks


async def check_achievements_task(user_id: UUID, db_url: str) -> None:
    """Check if user has earned new achievements after a review.

    This task runs asynchronously after the review response is sent.
    It checks all achievement thresholds and logs any new unlocks.

    The task creates its own database connection to avoid issues with
    connection sharing across async contexts.

    Args:
        user_id: UUID of the user to check
        db_url: Database connection URL
    """
    if not is_background_tasks_enabled():
        logger.debug("Background tasks disabled, skipping check_achievements_task")
        return

    logger.info(
        "Starting achievement check",
        extra={"user_id": str(user_id), "task": "check_achievements"},
    )

    engine = None
    try:
        # Create dedicated engine for this background task
        engine = create_async_engine(db_url, pool_pre_ping=True)
        async_session_factory = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )

        async with async_session_factory() as session:
            # Import here to avoid circular imports
            from src.services.progress_service import ProgressService

            service = ProgressService(session)
            achievements = await service.get_achievements(user_id)

            unlocked = [a for a in achievements.achievements if a.unlocked]
            logger.info(
                "Achievement check complete",
                extra={
                    "user_id": str(user_id),
                    "total_unlocked": len(unlocked),
                    "total_points": achievements.total_points,
                },
            )

    except Exception as e:
        logger.error(
            "Achievement check failed",
            extra={"user_id": str(user_id), "error": str(e)},
            exc_info=True,
        )
    finally:
        # Always dispose of the engine to clean up connections
        if engine is not None:
            await engine.dispose()


async def invalidate_cache_task(
    cache_type: str,
    entity_id: UUID,
    user_id: UUID | None = None,
) -> None:
    """Invalidate cached data after a data modification.

    This task runs asynchronously to clear stale cache entries after
    deck, card, or progress updates.

    Args:
        cache_type: Type of cache to invalidate (e.g., "deck", "card", "progress").
        entity_id: ID of the entity that was modified.
        user_id: Optional user ID for user-specific cache invalidation.

    Note:
        Placeholder - full implementation in 12.03.
    """
    if not is_background_tasks_enabled():
        logger.debug("Background tasks disabled, skipping invalidate_cache_task")
        return

    logger.debug(
        f"invalidate_cache_task called: cache_type={cache_type}, "
        f"entity_id={entity_id}, user_id={user_id}"
    )
    # TODO: Implement in 12.03
    pass


async def log_analytics_task(
    event_type: str,
    user_id: UUID,
    data: dict[str, Any],
) -> None:
    """Log analytics events asynchronously.

    This task captures user activity events for analytics and reporting
    without blocking the main request/response flow.

    Args:
        event_type: Type of event (e.g., "review_completed", "deck_created").
        user_id: ID of the user who triggered the event.
        data: Additional event data to log.

    Note:
        Placeholder - full implementation in 12.04.
    """
    if not is_background_tasks_enabled():
        logger.debug("Background tasks disabled, skipping log_analytics_task")
        return

    logger.debug(
        f"log_analytics_task called: event_type={event_type}, " f"user_id={user_id}, data={data}"
    )
    # TODO: Implement in 12.04
    pass


async def recalculate_progress_task(
    user_id: UUID,
    deck_id: UUID,
    db_url: str,
) -> None:
    """Recalculate user progress statistics for a deck.

    This task runs asynchronously to update aggregated progress
    metrics after reviews without blocking the response.

    Args:
        user_id: ID of the user whose progress to recalculate.
        deck_id: ID of the deck to recalculate progress for.
        db_url: Database connection URL for creating a new session.

    Note:
        Placeholder - full implementation in 12.05.
    """
    if not is_background_tasks_enabled():
        logger.debug("Background tasks disabled, skipping recalculate_progress_task")
        return

    logger.debug(f"recalculate_progress_task called: user_id={user_id}, deck_id={deck_id}")
    # TODO: Implement in 12.05
    pass
