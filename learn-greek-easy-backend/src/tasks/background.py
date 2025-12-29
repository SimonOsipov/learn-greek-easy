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

    This ensures progress metrics are accurate after reviews.
    Useful when metrics might have drifted due to edge cases
    (concurrent updates, partial failures, etc.).

    The task creates its own database connection to avoid issues with
    connection sharing across async contexts.

    Args:
        user_id: UUID of the user to recalculate for
        deck_id: UUID of the deck to recalculate
        db_url: Database connection URL
    """
    if not is_background_tasks_enabled():
        logger.debug("Background tasks disabled, skipping recalculate_progress_task")
        return

    logger.info(
        "Starting progress recalculation",
        extra={
            "user_id": str(user_id),
            "deck_id": str(deck_id),
            "task": "recalculate_progress",
        },
    )

    start_time = datetime.now(timezone.utc)
    engine = None

    try:
        # Create dedicated engine for this background task
        engine = create_async_engine(db_url, pool_pre_ping=True)
        async_session_factory = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )

        async with async_session_factory() as session:
            # Import here to avoid circular imports
            from src.repositories import CardStatisticsRepository, UserDeckProgressRepository

            progress_repo = UserDeckProgressRepository(session)
            stats_repo = CardStatisticsRepository(session)

            # Get actual counts from card statistics
            status_counts = await stats_repo.count_by_status(user_id, deck_id)

            # Recalculate studied (learning + review + mastered)
            cards_studied = sum(status_counts.get(s, 0) for s in ["learning", "review", "mastered"])
            cards_mastered = status_counts.get("mastered", 0)

            # Get or create progress record
            progress = await progress_repo.get_or_create(user_id, deck_id)

            # Track changes for logging
            old_studied = progress.cards_studied
            old_mastered = progress.cards_mastered

            # Update if different
            if progress.cards_studied != cards_studied or progress.cards_mastered != cards_mastered:
                progress.cards_studied = cards_studied
                progress.cards_mastered = cards_mastered
                await session.commit()

                logger.info(
                    "Progress recalculated with changes",
                    extra={
                        "user_id": str(user_id),
                        "deck_id": str(deck_id),
                        "old_studied": old_studied,
                        "new_studied": cards_studied,
                        "old_mastered": old_mastered,
                        "new_mastered": cards_mastered,
                    },
                )
            else:
                logger.info(
                    "Progress recalculation - no changes needed",
                    extra={
                        "user_id": str(user_id),
                        "deck_id": str(deck_id),
                        "cards_studied": cards_studied,
                        "cards_mastered": cards_mastered,
                    },
                )

        duration_ms = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
        logger.info(
            "Progress recalculation complete",
            extra={
                "user_id": str(user_id),
                "deck_id": str(deck_id),
                "duration_ms": duration_ms,
            },
        )

    except Exception as e:
        logger.error(
            "Progress recalculation failed",
            extra={
                "user_id": str(user_id),
                "deck_id": str(deck_id),
                "error": str(e),
            },
            exc_info=True,
        )
    finally:
        # Always dispose of the engine to clean up connections
        if engine is not None:
            await engine.dispose()


async def process_answer_side_effects_task(
    user_id: UUID,
    question_id: UUID,
    language: str,
    is_correct: bool,
    selected_option: int,
    time_taken_seconds: int,
    deck_category: str,
    culture_answers_before: int,
    db_url: str,
) -> None:
    """Process non-critical side effects in background after culture answer submission.

    This task runs asynchronously after the culture answer response is sent.
    It handles:
    1. Record answer history to CultureAnswerHistory
    2. Check daily goal completion and create notification
    3. Award daily goal XP bonus if completed

    The task creates its own database connection to avoid issues with
    connection sharing across async contexts.

    Args:
        user_id: User who answered
        question_id: Question that was answered
        language: Language used (el, en, ru)
        is_correct: Whether answer was correct
        selected_option: Selected option (1-4)
        time_taken_seconds: Time taken in seconds
        deck_category: Category of the deck
        culture_answers_before: Culture answers count before this answer
        db_url: Database connection URL
    """
    if not is_background_tasks_enabled():
        logger.debug("Background tasks disabled, skipping process_answer_side_effects_task")
        return

    logger.info(
        "Starting answer side effects processing",
        extra={
            "user_id": str(user_id),
            "question_id": str(question_id),
            "is_correct": is_correct,
            "task": "process_answer_side_effects",
        },
    )

    engine = None
    try:
        # Create dedicated engine for this background task
        engine = create_async_engine(db_url, pool_pre_ping=True)
        async_session_factory = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )

        async with async_session_factory() as session:
            # Step 1: Record answer history
            from src.db.models import CultureAnswerHistory

            answer_history = CultureAnswerHistory(
                user_id=user_id,
                question_id=question_id,
                language=language,
                is_correct=is_correct,
                selected_option=selected_option,
                time_taken_seconds=time_taken_seconds,
                deck_category=deck_category,
            )
            session.add(answer_history)

            logger.debug(
                "Recorded culture answer history in background",
                extra={
                    "user_id": str(user_id),
                    "question_id": str(question_id),
                    "is_correct": is_correct,
                },
            )

            # Step 2: Check daily goal completion and notify
            await _check_and_notify_daily_goal(
                session=session,
                user_id=user_id,
                culture_answers_before=culture_answers_before,
            )

            await session.commit()

        logger.info(
            "Answer side effects processed successfully",
            extra={
                "user_id": str(user_id),
                "question_id": str(question_id),
            },
        )

    except Exception as e:
        logger.error(
            "Answer side effects processing failed",
            extra={"user_id": str(user_id), "error": str(e)},
            exc_info=True,
        )
    finally:
        if engine is not None:
            await engine.dispose()


async def _check_and_notify_daily_goal(
    session: AsyncSession,
    user_id: UUID,
    culture_answers_before: int,
) -> bool:
    """Check if daily goal was completed and send notification if so.

    Uses Redis SETNX for duplicate notification prevention.

    Args:
        session: Database session
        user_id: User's UUID
        culture_answers_before: Culture answers count BEFORE this answer

    Returns:
        True if daily goal was just completed, False otherwise
    """
    from datetime import date

    from sqlalchemy import select

    from src.core.redis import get_redis
    from src.db.models import UserSettings
    from src.repositories.review import ReviewRepository
    from src.services.notification_service import NotificationService
    from src.services.xp_service import XPService

    try:
        # Get user's daily goal setting
        result = await session.execute(select(UserSettings).where(UserSettings.user_id == user_id))
        user_settings = result.scalar_one_or_none()
        daily_goal = user_settings.daily_goal if user_settings else 20  # Default

        # Get flashcard reviews today
        review_repo = ReviewRepository(session)
        flashcard_reviews = await review_repo.count_reviews_today(user_id)

        # Calculate total reviews (flashcards + culture answers)
        culture_answers_after = culture_answers_before + 1  # Include current answer
        total_reviews_after = flashcard_reviews + culture_answers_after
        total_reviews_before = flashcard_reviews + culture_answers_before

        # Check if we just crossed the threshold
        if total_reviews_before >= daily_goal:
            # Already completed goal before this answer
            return False

        if total_reviews_after < daily_goal:
            # Still haven't reached goal
            return False

        # We just crossed the threshold! Check Redis for duplicate prevention
        redis = get_redis()
        if redis:
            cache_key = f"daily_goal_notified:{user_id}:{date.today().isoformat()}"

            # Use SETNX (set if not exists) for atomic check-and-set
            was_set = await redis.setnx(cache_key, "1")
            if not was_set:
                # Already notified today
                logger.debug(
                    "Daily goal notification already sent",
                    extra={"user_id": str(user_id)},
                )
                return False

            # Set expiry (24 hours to be safe, will auto-cleanup)
            await redis.expire(cache_key, 86400)

        # Create notification
        notification_service = NotificationService(session)
        await notification_service.notify_daily_goal_complete(
            user_id=user_id,
            reviews_completed=total_reviews_after,
        )

        # Award daily goal XP bonus
        xp_service = XPService(session)
        await xp_service.award_daily_goal_xp(user_id)

        logger.info(
            "Daily goal completed via culture answer (background)",
            extra={
                "user_id": str(user_id),
                "total_reviews": total_reviews_after,
                "daily_goal": daily_goal,
            },
        )

        return True

    except Exception as e:
        # Log error but don't fail the background task
        logger.warning(
            "Failed to check daily goal in background",
            extra={
                "user_id": str(user_id),
                "error": str(e),
            },
        )
        return False


async def check_culture_achievements_task(
    user_id: UUID,
    question_id: UUID,
    is_correct: bool,
    language: str,
    deck_category: str,
    db_url: str,
) -> None:
    """Check culture achievements in background after answer submission.

    This task runs asynchronously after the culture answer response is sent.
    It checks all 12 culture achievement types and logs any new unlocks.

    The task creates its own database connection to avoid issues with
    connection sharing across async contexts.

    Args:
        user_id: User who answered
        question_id: Question that was answered
        is_correct: Whether answer was correct
        language: Language used (el, en, ru)
        deck_category: Category of the deck
        db_url: Database connection URL
    """
    if not is_background_tasks_enabled():
        logger.debug("Background tasks disabled, skipping check_culture_achievements_task")
        return

    logger.info(
        "Starting culture achievement check",
        extra={
            "user_id": str(user_id),
            "question_id": str(question_id),
            "is_correct": is_correct,
            "language": language,
            "deck_category": deck_category,
            "task": "check_culture_achievements",
        },
    )

    engine = None
    try:
        # Create dedicated engine for this background task
        engine = create_async_engine(db_url, pool_pre_ping=True)
        async_session_factory = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )

        async with async_session_factory() as session:
            from src.services.achievement_service import AchievementService

            service = AchievementService(session)
            unlocked = await service.check_culture_achievements(
                user_id=user_id,
                question_id=question_id,
                is_correct=is_correct,
                language=language,
                deck_category=deck_category,
            )

            if unlocked:
                await session.commit()
                logger.info(
                    "Culture achievements unlocked",
                    extra={
                        "user_id": str(user_id),
                        "unlocked_count": len(unlocked),
                        "achievement_ids": [a["id"] for a in unlocked],
                    },
                )
            else:
                logger.debug(
                    "No culture achievements unlocked",
                    extra={"user_id": str(user_id)},
                )

    except Exception as e:
        logger.error(
            "Culture achievement check failed",
            extra={"user_id": str(user_id), "error": str(e)},
            exc_info=True,
        )
    finally:
        if engine is not None:
            await engine.dispose()
