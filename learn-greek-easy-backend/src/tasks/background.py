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

from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any
from uuid import UUID

if TYPE_CHECKING:
    from src.db.models import WordEntry  # noqa: F401

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config import settings
from src.core.logging import get_logger

logger = get_logger(__name__)


def is_background_tasks_enabled() -> bool:
    """Check if background tasks feature is enabled.

    Returns:
        bool: True if background tasks are enabled via feature flag.
    """
    return settings.feature_background_tasks


async def award_flashcard_xp_task(
    user_id: UUID,
    card_record_id: UUID,
    quality: int,
    db_url: str,
) -> None:
    """Award XP for a V2 flashcard review in the background.

    This task runs asynchronously after the review response is sent.
    It creates its own database connection to avoid issues with
    connection sharing across async contexts.

    Args:
        user_id: UUID of the user
        card_record_id: Card record ID (used as XP transaction source_id)
        quality: SM2 quality rating (0-5)
        db_url: Database connection URL
    """
    if not is_background_tasks_enabled():
        logger.debug("Background tasks disabled, skipping award_flashcard_xp_task")
        return

    logger.info(
        "Starting flashcard XP award",
        extra={
            "user_id": str(user_id),
            "card_record_id": str(card_record_id),
            "quality": quality,
            "task": "award_flashcard_xp",
        },
    )

    engine = None
    try:
        engine = create_async_engine(
            db_url,
            pool_pre_ping=True,
            connect_args={"ssl": "require"} if settings.is_production else {},
        )
        async_session_factory = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )

        session = async_session_factory()
        try:
            from src.services.xp_service import XPService

            xp_service = XPService(session)
            amount = await xp_service.award_flashcard_review_xp(
                user_id=user_id,
                quality=quality,
                card_record_id=card_record_id,
            )
            await session.commit()
            logger.info(
                "Flashcard XP awarded",
                extra={
                    "user_id": str(user_id),
                    "card_record_id": str(card_record_id),
                    "amount": amount,
                    "quality": quality,
                },
            )
        finally:
            await session.close()

    except Exception as e:
        logger.error(
            "Flashcard XP award failed",
            extra={
                "user_id": str(user_id),
                "card_record_id": str(card_record_id),
                "error": str(e),
            },
            exc_info=True,
        )
    finally:
        if engine is not None:
            await engine.dispose()


async def _run_achievement_checks(session: Any, user_id: UUID) -> int:
    """Run achievement checks for a user and commit any unlocks. Returns unlock count."""
    from src.services.achievement_definitions import AchievementMetric
    from src.services.achievement_service import AchievementService

    service = AchievementService(session)
    stats = await service._get_user_stats(user_id)

    any_unlocked = []
    for metric, stat_key in [
        (AchievementMetric.CARDS_LEARNED, "cards_learned"),
        (AchievementMetric.CARDS_MASTERED, "cards_mastered"),
        (AchievementMetric.TOTAL_REVIEWS, "total_reviews"),
    ]:
        value = int(stats.get(stat_key, 0))
        if value > 0:
            unlocked = await service.check_and_unlock_achievements(user_id, metric, value)
            any_unlocked.extend(unlocked)

    if any_unlocked:
        await session.commit()

    return len(any_unlocked)


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
        engine = create_async_engine(
            db_url,
            pool_pre_ping=True,
            connect_args={"ssl": "require"} if settings.is_production else {},
        )
        async_session_factory = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )

        session = async_session_factory()
        try:
            unlocked_count = await _run_achievement_checks(session, user_id)
            logger.info(
                "Achievement check complete",
                extra={"user_id": str(user_id), "unlocked_count": unlocked_count},
            )
        finally:
            await session.close()

        # Signal event bus for SSE dashboard refresh
        try:
            import asyncio

            from src.core.event_bus import dashboard_event_bus

            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(
                    dashboard_event_bus.signal(
                        f"dashboard:{user_id}",
                        {"reason": "achievement_unlocked"},
                    )
                )
        except Exception:
            pass  # Fire-and-forget: never let signaling break the task

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


async def _check_daily_goal_for_review(
    session: AsyncSession,
    user_id: str,
    reviews_before: int,
) -> None:
    """Check if deck review just completed daily goal and create notification.

    Uses reviews_before + 1 (avoids a DB re-query) and Redis SETNX for dedup.

    Args:
        session: Database session (owned by caller)
        user_id: User's UUID as string
        reviews_before: Flashcard review count BEFORE this review
    """
    from datetime import date

    from sqlalchemy import select

    from src.core.redis import get_redis
    from src.db.models import UserSettings
    from src.repositories.culture_question_stats import CultureQuestionStatsRepository
    from src.services.notification_service import NotificationService

    try:
        result = await session.execute(
            select(UserSettings).where(UserSettings.user_id == UUID(user_id))
        )
        user_settings = result.scalar_one_or_none()
        daily_goal = user_settings.daily_goal if user_settings else 20

        # Include culture answers in total (daily goal combines flashcard + culture reviews)
        culture_stats_repo = CultureQuestionStatsRepository(session)
        culture_answers_today = await culture_stats_repo.count_answers_today(UUID(user_id))

        total_reviews_before = reviews_before + culture_answers_today
        reviews_after = reviews_before + 1
        total_reviews_after = reviews_after + culture_answers_today

        if total_reviews_before >= daily_goal:
            return

        if total_reviews_after < daily_goal:
            return

        redis = get_redis()
        if redis:
            cache_key = f"daily_goal_notified:{user_id}:{date.today().isoformat()}"
            was_set = await redis.setnx(cache_key, "1")
            if not was_set:
                return
            await redis.expire(cache_key, 86400)

        notification_service = NotificationService(session)
        await notification_service.notify_daily_goal_complete(
            user_id=UUID(user_id),
            reviews_completed=total_reviews_after,
        )

        logger.info(
            "Daily goal notification created (deck review background)",
            extra={"user_id": user_id, "reviews": total_reviews_after},
        )

    except Exception as e:
        logger.warning(
            "Failed to check/create daily goal notification in background",
            extra={"user_id": user_id, "error": str(e)},
        )


async def _persist_review_core(
    session: AsyncSession,
    *,
    user_id: str,
    card_record_id: str,
    deck_id: str,
    card_type_value: str,
    quality: int,
    time_taken: int,
    stats_id: str,
    stats_created_at_iso: str | None,
    new_ef: float,
    new_interval: int,
    new_repetitions: int,
    new_status_value: str,
    next_review_date_iso: str,
    is_newly_mastered: bool,
    user_email: str | None,
) -> None:
    """Write SM2 stats, create review record, and fire mastery event. Caller commits."""
    from datetime import date, datetime, timezone

    from src.db.models import CardRecordReview, CardStatus
    from src.repositories.card_record_statistics import CardRecordStatisticsRepository

    stats_repo = CardRecordStatisticsRepository(session)
    await stats_repo.update_sm2_data(
        stats_id=UUID(stats_id),
        easiness_factor=new_ef,
        interval=new_interval,
        repetitions=new_repetitions,
        next_review_date=date.fromisoformat(next_review_date_iso),
        status=CardStatus(new_status_value),
    )

    review = CardRecordReview(
        card_record_id=UUID(card_record_id),
        user_id=UUID(user_id),
        quality=quality,
        time_taken=time_taken,
        reviewed_at=datetime.now(timezone.utc),
    )
    session.add(review)
    await session.flush()

    if is_newly_mastered:
        days_to_master = 0
        if stats_created_at_iso:
            created_at = datetime.fromisoformat(stats_created_at_iso)
            if created_at.tzinfo is not None:
                created_at = created_at.replace(tzinfo=None)
            days_to_master = (datetime.now(timezone.utc).replace(tzinfo=None) - created_at).days
        from src.core.posthog import capture_event

        capture_event(
            distinct_id=user_id,
            event="card_mastered_v2",
            properties={
                "deck_id": deck_id,
                "card_record_id": card_record_id,
                "card_type": card_type_value,
                "reviews_to_master": new_repetitions,
                "days_to_master": days_to_master,
            },
            user_email=user_email,
        )


async def _run_review_side_effects(
    *,
    user_id: str,
    card_record_id: str,
    quality: int,
    time_taken: int,
    new_status_value: str,
    reviews_before: int,
    db_url: str,
) -> None:
    """Run non-critical side effects (XP, daily goal, achievements, analytics)."""
    from datetime import datetime, timezone

    # Award XP
    try:
        await award_flashcard_xp_task(
            user_id=UUID(user_id),
            card_record_id=UUID(card_record_id),
            quality=quality,
            db_url=db_url,
        )
    except Exception as e:
        logger.warning(
            "XP award failed in persist_deck_review_task",
            extra={"user_id": user_id, "error": str(e)},
        )

    # Check daily goal notification
    engine2 = None
    try:
        engine2 = create_async_engine(
            db_url,
            pool_pre_ping=True,
            connect_args={"ssl": "require"} if settings.is_production else {},
        )
        factory2 = async_sessionmaker(engine2, class_=AsyncSession, expire_on_commit=False)
        session2 = factory2()
        try:
            await _check_daily_goal_for_review(
                session=session2, user_id=user_id, reviews_before=reviews_before
            )
            await session2.commit()
        finally:
            await session2.close()
    except Exception as e:
        logger.warning(
            "Daily goal check failed in persist_deck_review_task",
            extra={"user_id": user_id, "error": str(e)},
        )
    finally:
        if engine2 is not None:
            await engine2.dispose()

    # Check achievements
    try:
        await check_achievements_task(user_id=UUID(user_id), db_url=db_url)
    except Exception as e:
        logger.warning(
            "Achievement check failed in persist_deck_review_task",
            extra={"user_id": user_id, "error": str(e)},
        )

    # Log analytics
    timestamp = datetime.now(timezone.utc).isoformat()
    logger.info(
        "ANALYTICS: review_completed",
        extra={
            "analytics": True,
            "event_type": "review_completed",
            "user_id": user_id,
            "timestamp": timestamp,
            "event_data": {
                "card_record_id": card_record_id,
                "quality": quality,
                "time_taken": time_taken,
                "new_status": new_status_value,
            },
        },
    )


async def persist_deck_review_task(
    user_id: str,
    card_record_id: str,
    deck_id: str,
    card_type_value: str,
    quality: int,
    time_taken: int,
    stats_id: str,
    stats_created_at_iso: str | None,
    new_ef: float,
    new_interval: int,
    new_repetitions: int,
    new_status_value: str,
    next_review_date_iso: str,
    previous_status_value: str,
    is_newly_mastered: bool,
    reviews_before: int,
    user_email: str | None,
    db_url: str,
) -> None:
    """Persist a deck review and run all post-review side effects in background.

    This consolidated task replaces three separate background tasks
    (check_achievements_task, log_analytics_task, award_flashcard_xp_task)
    and the inline _check_daily_goal_notification call.
    """
    if not is_background_tasks_enabled():
        logger.debug("Background tasks disabled, skipping persist_deck_review_task")
        return

    logger.info(
        "Starting deck review persistence",
        extra={
            "user_id": user_id,
            "card_record_id": card_record_id,
            "quality": quality,
            "task": "persist_deck_review",
        },
    )

    # Phase 1: Core DB writes (update stats, create review, mastery event)
    engine = None
    try:
        engine = create_async_engine(
            db_url,
            pool_pre_ping=True,
            connect_args={"ssl": "require"} if settings.is_production else {},
        )
        factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        session = factory()
        try:
            await _persist_review_core(
                session,
                user_id=user_id,
                card_record_id=card_record_id,
                deck_id=deck_id,
                card_type_value=card_type_value,
                quality=quality,
                time_taken=time_taken,
                stats_id=stats_id,
                stats_created_at_iso=stats_created_at_iso,
                new_ef=new_ef,
                new_interval=new_interval,
                new_repetitions=new_repetitions,
                new_status_value=new_status_value,
                next_review_date_iso=next_review_date_iso,
                is_newly_mastered=is_newly_mastered,
                user_email=user_email,
            )
            await session.commit()
        finally:
            await session.close()

        logger.info(
            "Deck review persisted successfully",
            extra={
                "user_id": user_id,
                "card_record_id": card_record_id,
                "new_status": new_status_value,
            },
        )
    except Exception as e:
        logger.error(
            "Deck review persistence failed",
            extra={"user_id": user_id, "card_record_id": card_record_id, "error": str(e)},
            exc_info=True,
        )
        return
    finally:
        if engine is not None:
            await engine.dispose()

    # Phase 2: Non-critical side effects (XP, daily goal, achievements, analytics)
    await _run_review_side_effects(
        user_id=user_id,
        card_record_id=card_record_id,
        quality=quality,
        time_taken=time_taken,
        new_status_value=new_status_value,
        reviews_before=reviews_before,
        db_url=db_url,
    )


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
        engine = create_async_engine(
            db_url,
            pool_pre_ping=True,
            connect_args={"ssl": "require"} if settings.is_production else {},
        )
        async_session_factory = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )

        session = async_session_factory()
        try:
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
        finally:
            await session.close()

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
    from src.repositories.card_record_review import CardRecordReviewRepository
    from src.services.notification_service import NotificationService
    from src.services.xp_service import XPService

    try:
        # Get user's daily goal setting
        result = await session.execute(select(UserSettings).where(UserSettings.user_id == user_id))
        user_settings = result.scalar_one_or_none()
        daily_goal = user_settings.daily_goal if user_settings else 20  # Default

        # Get flashcard reviews today
        review_repo = CardRecordReviewRepository(session)
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


async def persist_culture_answer_task(
    user_id: UUID,
    question_id: UUID,
    selected_option: int,
    time_taken: int,
    language: str,
    is_correct: bool,
    is_perfect: bool,
    deck_category: str,
    sm2_new_ef: float,
    sm2_new_interval: int,
    sm2_new_repetitions: int,
    sm2_new_status: str,
    sm2_next_review_date: str,
    stats_previous_status: str,
    db_url: str,
) -> None:
    """Persist culture answer results using pre-computed SM-2 values.

    This background task receives pre-computed SM-2 values from compute_answer()
    and persists them without recalculation. It handles:

    1. Get/create stats record (CultureQuestionStats)
    2. Apply pre-computed SM-2 values to stats
    3. Record answer history (CultureAnswerHistory)
    4. Award XP via XPService.award_culture_answer_xp()
    5. Award first review bonus via XPService.award_first_review_bonus()
    6. Check daily goal via _check_and_notify_daily_goal()
    7. Check achievements via AchievementService.check_culture_achievements()

    The task creates its own database connection to avoid issues with
    connection sharing across async contexts.

    Args:
        user_id: User who answered
        question_id: Question that was answered
        selected_option: Selected option (1-4)
        time_taken: Time taken in seconds
        language: Language used (el, en, ru)
        is_correct: Whether answer was correct
        is_perfect: Whether answer was fast (< threshold seconds)
        deck_category: Category of the deck
        sm2_new_ef: Pre-computed new easiness factor
        sm2_new_interval: Pre-computed new interval in days
        sm2_new_repetitions: Pre-computed new repetition count
        sm2_new_status: Pre-computed new CardStatus value string
        sm2_next_review_date: Pre-computed next review date as ISO string
        stats_previous_status: CardStatus value string before this answer
        db_url: Database connection URL
    """
    if not is_background_tasks_enabled():
        logger.debug("Background tasks disabled, skipping persist_culture_answer_task")
        return

    logger.info(
        "Starting culture answer persistence",
        extra={
            "user_id": str(user_id),
            "question_id": str(question_id),
            "is_correct": is_correct,
            "task": "persist_culture_answer",
        },
    )

    start_time = datetime.now(timezone.utc)
    engine = None

    try:
        # Create dedicated engine for this background task
        engine = create_async_engine(
            db_url,
            pool_pre_ping=True,
            connect_args={"ssl": "require"} if settings.is_production else {},
        )
        async_session_factory = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )

        session = async_session_factory()
        try:
            from datetime import date as date_type

            from sqlalchemy import select

            from src.db.models import CardStatus, CultureAnswerHistory, CultureQuestionStats
            from src.repositories.culture_question_stats import CultureQuestionStatsRepository
            from src.services.achievement_service import AchievementService
            from src.services.xp_service import XPService

            # Step 1: Get or create stats
            query = select(CultureQuestionStats).where(
                CultureQuestionStats.user_id == user_id,
                CultureQuestionStats.question_id == question_id,
            )
            result = await session.execute(query)
            stats = result.scalar_one_or_none()

            if not stats:
                from src.core.sm2 import DEFAULT_EASINESS_FACTOR

                stats = CultureQuestionStats(
                    user_id=user_id,
                    question_id=question_id,
                    easiness_factor=DEFAULT_EASINESS_FACTOR,
                    interval=0,
                    repetitions=0,
                    next_review_date=date_type.today(),
                    status=CardStatus.NEW,
                )
                session.add(stats)
                await session.flush()

            previous_status = CardStatus(stats_previous_status)

            # Step 2: Apply pre-computed SM-2 values (no recalculation)
            stats.easiness_factor = sm2_new_ef
            stats.interval = sm2_new_interval
            stats.repetitions = sm2_new_repetitions
            stats.status = CardStatus(sm2_new_status)
            stats.next_review_date = date_type.fromisoformat(sm2_next_review_date)

            logger.debug(
                "SM-2 values applied in persistence task",
                extra={
                    "user_id": str(user_id),
                    "question_id": str(question_id),
                    "previous_status": previous_status.value,
                    "new_status": sm2_new_status,
                    "next_review_date": sm2_next_review_date,
                },
            )

            # Step 3: Record answer history
            answer_history = CultureAnswerHistory(
                user_id=user_id,
                question_id=question_id,
                language=language,
                is_correct=is_correct,
                selected_option=selected_option,
                time_taken_seconds=time_taken,
                deck_category=deck_category,
            )
            session.add(answer_history)

            # Step 4: Award XP for the answer
            xp_service = XPService(session)
            xp_earned = await xp_service.award_culture_answer_xp(
                user_id=user_id,
                is_correct=is_correct,
                is_perfect=is_perfect,
                source_id=question_id,
            )

            # Step 5: Award first review bonus (once per day - only for correct answers)
            first_review_bonus = 0
            if is_correct:
                first_review_bonus = await xp_service.award_first_review_bonus(user_id)
            total_xp = xp_earned + first_review_bonus

            logger.debug(
                "XP awarded in persistence task",
                extra={
                    "user_id": str(user_id),
                    "xp_earned": xp_earned,
                    "first_review_bonus": first_review_bonus,
                    "total_xp": total_xp,
                },
            )

            # Step 6: Check daily goal completion and notify
            stats_repo = CultureQuestionStatsRepository(session)
            culture_answers_before = await stats_repo.count_answers_today(user_id) - 1
            if culture_answers_before < 0:
                culture_answers_before = 0

            await _check_and_notify_daily_goal(
                session=session,
                user_id=user_id,
                culture_answers_before=culture_answers_before,
            )

            # Step 7: Check achievements
            achievement_service = AchievementService(session)
            unlocked = await achievement_service.check_culture_achievements(
                user_id=user_id,
                question_id=question_id,
                is_correct=is_correct,
                language=language,
                deck_category=deck_category,
            )

            if unlocked:
                logger.info(
                    "Achievements unlocked in persistence task",
                    extra={
                        "user_id": str(user_id),
                        "unlocked_count": len(unlocked),
                        "achievement_ids": [a["id"] for a in unlocked],
                    },
                )

            # Commit all changes
            await session.commit()
        finally:
            await session.close()

        duration_ms = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
        logger.info(
            "Culture answer persistence complete",
            extra={
                "user_id": str(user_id),
                "question_id": str(question_id),
                "is_correct": is_correct,
                "total_xp": total_xp,
                "previous_status": previous_status.value,
                "new_status": sm2_new_status,
                "duration_ms": duration_ms,
            },
        )

    except Exception as e:
        logger.error(
            "Culture answer persistence failed",
            extra={
                "user_id": str(user_id),
                "question_id": str(question_id),
                "error": str(e),
            },
            exc_info=True,
        )
    finally:
        if engine is not None:
            await engine.dispose()


async def create_announcement_notifications_task(
    campaign_id: UUID,
    campaign_title: str,
    campaign_message: str,
    link_url: str | None,
    db_url: str,
) -> None:
    """Create notification records for all active users for an announcement campaign.

    This task runs asynchronously after the announcement creation response is sent.
    It creates a Notification record for each active user, stores the campaign_id
    in extra_data, and updates the campaign's total_recipients count.

    The task creates its own database connection to avoid issues with
    connection sharing across async contexts.

    Args:
        campaign_id: UUID of the announcement campaign
        campaign_title: Title for the notification
        campaign_message: Message for the notification
        link_url: Optional URL for the notification action
        db_url: Database connection URL
    """
    if not is_background_tasks_enabled():
        logger.debug("Background tasks disabled, skipping create_announcement_notifications_task")
        return

    logger.info(
        "Starting announcement notification creation",
        extra={
            "campaign_id": str(campaign_id),
            "task": "create_announcement_notifications",
        },
    )

    start_time = datetime.now(timezone.utc)
    engine = None
    total_created = 0
    batch_size = 100

    try:
        # Create dedicated engine for this background task
        engine = create_async_engine(
            db_url,
            pool_pre_ping=True,
            connect_args={"ssl": "require"} if settings.is_production else {},
        )
        async_session_factory = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )

        session = async_session_factory()
        try:
            # Import here to avoid circular imports
            from sqlalchemy import select

            from src.db.models import Notification, NotificationType, User
            from src.repositories.announcement import AnnouncementCampaignRepository

            # Get all active user IDs
            query = select(User.id).where(User.is_active.is_(True))
            result = await session.execute(query)
            user_ids = list(result.scalars().all())

            logger.info(
                "Found active users for announcement",
                extra={
                    "campaign_id": str(campaign_id),
                    "user_count": len(user_ids),
                },
            )

            # Create notifications in batches
            for i in range(0, len(user_ids), batch_size):
                batch = user_ids[i : i + batch_size]

                for user_id in batch:
                    notification = Notification(
                        user_id=user_id,
                        type=NotificationType.ADMIN_ANNOUNCEMENT,
                        title=campaign_title,
                        message=campaign_message,
                        icon="megaphone",
                        action_url=link_url,
                        extra_data={"campaign_id": str(campaign_id)},
                    )
                    session.add(notification)
                    total_created += 1

                # Flush after each batch to avoid memory buildup
                await session.flush()

                logger.debug(
                    "Notification batch created",
                    extra={
                        "campaign_id": str(campaign_id),
                        "batch_number": (i // batch_size) + 1,
                        "batch_size": len(batch),
                        "total_created": total_created,
                    },
                )

            # Update campaign with total recipients
            repo = AnnouncementCampaignRepository(session)
            campaign = await repo.get(campaign_id)
            if campaign:
                campaign.total_recipients = total_created
                await session.flush()

            # Commit all changes
            await session.commit()
        finally:
            await session.close()

        duration_ms = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
        logger.info(
            "Announcement notifications created successfully",
            extra={
                "campaign_id": str(campaign_id),
                "total_created": total_created,
                "duration_ms": duration_ms,
            },
        )

    except Exception as e:
        logger.error(
            "Announcement notification creation failed",
            extra={
                "campaign_id": str(campaign_id),
                "total_created": total_created,
                "error": str(e),
            },
            exc_info=True,
        )
    finally:
        if engine is not None:
            await engine.dispose()
