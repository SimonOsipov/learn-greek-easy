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
from datetime import datetime, timezone
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
    deck_id: UUID | None = None,
) -> None:
    """Invalidate cache entries after data changes.

    This task runs asynchronously to clear stale cache entries after
    deck, card, or progress updates.

    Args:
        cache_type: Type of cache to invalidate ("deck", "card", "progress")
        entity_id: ID of the entity that changed
        user_id: Optional user ID for user-specific cache
        deck_id: Optional deck ID (required for card cache invalidation)

    Supported cache types:
        - "deck": Invalidates deck cache. entity_id is the deck_id.
        - "card": Invalidates card cache. entity_id is the card_id, deck_id is required.
        - "progress": Invalidates user progress cache. entity_id is the deck_id, user_id is required.
    """
    if not is_background_tasks_enabled():
        logger.debug("Background tasks disabled, skipping invalidate_cache_task")
        return

    logger.info(
        "Starting cache invalidation",
        extra={
            "cache_type": cache_type,
            "entity_id": str(entity_id),
            "user_id": str(user_id) if user_id else None,
            "deck_id": str(deck_id) if deck_id else None,
            "task": "invalidate_cache",
        },
    )

    try:
        from src.core.cache import get_cache

        cache = get_cache()
        deleted = 0

        if cache_type == "deck":
            deleted = await cache.invalidate_deck(entity_id)
        elif cache_type == "card" and deck_id:
            deleted = await cache.invalidate_card(entity_id, deck_id)
        elif cache_type == "progress" and user_id:
            deleted = await cache.invalidate_user_progress(user_id, entity_id)
        else:
            logger.warning(
                "Invalid cache invalidation request",
                extra={
                    "cache_type": cache_type,
                    "has_user_id": user_id is not None,
                    "has_deck_id": deck_id is not None,
                },
            )
            return

        logger.info(
            "Cache invalidation complete",
            extra={
                "cache_type": cache_type,
                "deleted_entries": deleted,
            },
        )

    except Exception as e:
        logger.error(
            "Cache invalidation failed",
            extra={
                "cache_type": cache_type,
                "entity_id": str(entity_id),
                "error": str(e),
            },
            exc_info=True,
        )


# Supported analytics event types
ANALYTICS_EVENTS = {
    "review_completed": "Single card review completed",
    "bulk_review_completed": "Bulk review session completed",
    "session_started": "Study session started",
    "session_ended": "Study session ended",
    "deck_started": "User started a new deck",
    "achievement_unlocked": "User unlocked an achievement",
    "streak_milestone": "User reached streak milestone",
    "mastery_milestone": "User reached mastery milestone",
}


async def log_analytics_task(
    event_type: str,
    user_id: UUID,
    data: dict[str, Any],
) -> None:
    """Log analytics event for study sessions.

    This logs structured analytics data that can be processed
    by log aggregation systems (e.g., Railway logs, DataDog, Sentry).

    Args:
        event_type: Type of event (see ANALYTICS_EVENTS)
        user_id: User who triggered the event
        data: Additional event-specific data
    """
    if not is_background_tasks_enabled():
        logger.debug("Background tasks disabled, skipping log_analytics_task")
        return

    timestamp = datetime.now(timezone.utc).isoformat()

    # Validate event type
    if event_type not in ANALYTICS_EVENTS:
        logger.warning(
            "Unknown analytics event type",
            extra={"event_type": event_type, "user_id": str(user_id)},
        )

    # Log the analytics event
    logger.info(
        f"ANALYTICS: {event_type}",
        extra={
            "analytics": True,  # Tag for log filtering
            "event_type": event_type,
            "user_id": str(user_id),
            "timestamp": timestamp,
            "event_data": data,
        },
    )


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
