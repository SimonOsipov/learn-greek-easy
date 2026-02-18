"""Scheduled task implementations for APScheduler.

These tasks are run by the dedicated scheduler service (src/scheduler_main.py)
on a periodic basis using APScheduler's CronTrigger.

Tasks:
- streak_reset_task: Daily at midnight UTC - Check and log broken streaks
- session_cleanup_task: Daily at 3 AM UTC - Clean up orphaned Redis sessions
- stats_aggregate_task: Daily at 4 AM UTC - Aggregate user statistics for analytics
"""

from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config import settings
from src.core.logging import get_logger

if TYPE_CHECKING:
    from redis.asyncio import Redis

logger = get_logger(__name__)


async def streak_reset_task() -> None:
    """Check and handle streak resets for users who missed study days.

    This task runs daily at the configured streak_reset_hour_utc (default: midnight UTC).

    Current Implementation:
    - Streaks are calculated dynamically from review history
    - This task logs users who would have their streak reset
    - Future: Could update a cached streak value for performance

    Note: The Learn Greek Easy app calculates streaks in real-time from the
    `reviews` table. This task is for monitoring/logging purposes and future
    cached streak support.
    """
    logger.info(
        "Starting streak reset task",
        extra={"streak_reset_hour_utc": settings.streak_reset_hour_utc},
    )

    start_time = datetime.now(timezone.utc)
    engine = None

    try:
        # Create dedicated engine for this scheduled task
        engine = create_async_engine(
            settings.database_url,
            pool_pre_ping=True,
            connect_args={"ssl": "require"} if settings.is_production else {},
        )
        async_session_factory = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )

        session = async_session_factory()
        try:
            today = datetime.now(timezone.utc).date()
            yesterday = today - timedelta(days=1)

            # Find users who:
            # 1. Had reviews before yesterday (had some activity going)
            # 2. Did NOT have reviews yesterday (missed a day)
            # This identifies users whose streak would reset today
            #
            # Note: We look for users whose last review was 2+ days ago
            # (i.e., before yesterday), which means they missed yesterday
            query = text(
                """
                SELECT
                    user_id,
                    MAX(DATE(reviewed_at)) as last_review_date
                FROM reviews
                GROUP BY user_id
                HAVING MAX(DATE(reviewed_at)) < :yesterday
            """
            )

            result = await session.execute(query, {"yesterday": yesterday})
            users_with_broken_streak = result.fetchall()

            if not users_with_broken_streak:
                logger.info(
                    "Streak reset task complete - no broken streaks found",
                    extra={
                        "check_date": str(yesterday),
                        "users_with_broken_streak": 0,
                    },
                )
            else:
                for user_id, last_review_date in users_with_broken_streak:
                    days_since_review = (today - last_review_date).days
                    logger.info(
                        "User streak broken",
                        extra={
                            "user_id": str(user_id),
                            "last_review_date": str(last_review_date),
                            "days_since_review": days_since_review,
                        },
                    )

                duration_ms = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000

                logger.info(
                    "Streak reset task complete",
                    extra={
                        "check_date": str(yesterday),
                        "users_with_broken_streak": len(users_with_broken_streak),
                        "duration_ms": duration_ms,
                    },
                )

            await session.commit()
        finally:
            await session.close()

    except Exception as e:
        logger.error(f"Streak reset task failed: {e}", exc_info=True)
        raise

    finally:
        # Always dispose of the engine to clean up connections
        if engine is not None:
            await engine.dispose()


async def _cleanup_session_keys_without_ttl(redis: "Redis") -> tuple[int, int]:
    """Scan and delete session keys that have no TTL set.

    Args:
        redis: Redis client instance

    Returns:
        Tuple of (scanned_keys_count, deleted_keys_count)
    """
    deleted_no_ttl = 0
    scanned_keys = 0

    cursor: int = 0
    while True:
        cursor, keys = await redis.scan(
            cursor=cursor,
            match=f"{settings.session_key_prefix}*",
            count=100,
        )

        scanned_keys += len(keys)

        for key in keys:
            ttl = await redis.ttl(key)

            # Delete keys with no TTL set (TTL = -1 means no expiry)
            # This shouldn't happen but catches bugs
            if ttl == -1:
                await redis.delete(key)
                deleted_no_ttl += 1
                logger.warning(
                    "Deleted session key without TTL",
                    extra={"key": key},
                )

        if cursor == 0:
            break

    return scanned_keys, deleted_no_ttl


async def _cleanup_orphaned_session_refs(redis: "Redis") -> tuple[int, int]:
    """Scan user_sessions sets and remove orphaned session references.

    Args:
        redis: Redis client instance

    Returns:
        Tuple of (deleted_orphaned_refs_count, deleted_empty_sets_count)
    """
    deleted_orphaned = 0
    deleted_empty_sets = 0

    cursor: int = 0
    while True:
        cursor, keys = await redis.scan(
            cursor=cursor,
            match="user_sessions:*",
            count=100,
        )

        for user_sessions_key in keys:
            # Get all token_ids in the set
            token_ids = await redis.smembers(user_sessions_key)

            # Extract user_id from key (format: user_sessions:{user_id})
            user_id = user_sessions_key.split(":")[-1]

            for token_id in token_ids:
                # Check if the session key still exists
                session_key = f"{settings.session_key_prefix}{user_id}:{token_id}"
                exists = await redis.exists(session_key)

                if not exists:
                    # Remove orphaned reference from set
                    await redis.srem(user_sessions_key, token_id)
                    deleted_orphaned += 1
                    logger.debug(
                        "Removed orphaned session reference",
                        extra={
                            "user_id": user_id,
                            "token_id": token_id,
                        },
                    )

            # Delete empty user_sessions sets
            remaining = await redis.scard(user_sessions_key)
            if remaining == 0:
                await redis.delete(user_sessions_key)
                deleted_empty_sets += 1

        if cursor == 0:
            break

    return deleted_orphaned, deleted_empty_sets


async def session_cleanup_task() -> None:
    """Clean up expired and orphaned sessions from Redis.

    This task runs daily to ensure any orphaned session keys are removed.
    Redis TTL should handle most expiry, but this catches edge cases:

    1. Keys without TTL (shouldn't happen, but safety check)
    2. Orphaned user_sessions sets (user deleted, sessions remain)
    3. Stale entries from failed operations

    Note: This task is defensive - Redis TTL handles normal expiry.
    """
    logger.info("Starting session cleanup task")
    start_time = datetime.now(timezone.utc)

    from src.core.redis import close_redis, get_redis, init_redis

    await init_redis()
    redis = get_redis()

    try:
        if redis is None:
            logger.warning("Redis not available, skipping session cleanup")
            return

        # Phase 1: Clean up session keys without TTL
        scanned_keys, deleted_no_ttl = await _cleanup_session_keys_without_ttl(redis)

        # Phase 2: Clean up orphaned user_sessions references
        deleted_orphaned, deleted_empty_sets = await _cleanup_orphaned_session_refs(redis)

        duration_ms = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000

        logger.info(
            "Session cleanup complete",
            extra={
                "scanned_keys": scanned_keys,
                "deleted_no_ttl": deleted_no_ttl,
                "deleted_orphaned": deleted_orphaned,
                "deleted_empty_sets": deleted_empty_sets,
                "duration_ms": duration_ms,
            },
        )

    except Exception as e:
        logger.error(f"Session cleanup failed: {e}", exc_info=True)
        raise

    finally:
        await close_redis()


async def stats_aggregate_task() -> None:
    """Pre-compute daily statistics for faster dashboard queries.

    This task aggregates review data from the previous day into
    summary statistics. Currently logs aggregated data; future
    versions could populate a dedicated stats table.

    Aggregates:
    - Reviews per user
    - Average quality per user
    - Total study time per user
    - Cards mastered per user

    Runs daily during off-peak hours (4 AM UTC).
    """
    logger.info("Starting stats aggregation task")
    start_time = datetime.now(timezone.utc)
    engine = None

    try:
        # Create dedicated engine for this scheduled task
        engine = create_async_engine(
            settings.database_url,
            pool_pre_ping=True,
            connect_args={"ssl": "require"} if settings.is_production else {},
        )
        async_session_factory = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )

        session = async_session_factory()
        try:
            yesterday = datetime.now(timezone.utc).date() - timedelta(days=1)

            # Aggregate review statistics by user for yesterday
            review_stats_query = text(
                """
                SELECT
                    r.user_id,
                    COUNT(*) as review_count,
                    ROUND(AVG(r.quality)::numeric, 2) as avg_quality,
                    COALESCE(SUM(r.time_taken), 0) as total_time_seconds,
                    COUNT(DISTINCT r.card_id) as unique_cards
                FROM reviews r
                WHERE DATE(r.reviewed_at) = :target_date
                GROUP BY r.user_id
                ORDER BY review_count DESC
            """
            )

            result = await session.execute(review_stats_query, {"target_date": yesterday})
            daily_review_stats = result.fetchall()

            # Aggregate mastery statistics (cards that became mastered yesterday)
            # Note: PostgreSQL enum values are uppercase (MASTERED, not mastered)
            mastery_stats_query = text(
                """
                SELECT
                    cs.user_id,
                    COUNT(*) as cards_mastered
                FROM card_statistics cs
                WHERE cs.status = 'MASTERED'
                  AND DATE(cs.updated_at) = :target_date
                GROUP BY cs.user_id
            """
            )

            mastery_result = await session.execute(mastery_stats_query, {"target_date": yesterday})
            mastery_stats = {row[0]: row[1] for row in mastery_result.fetchall()}

            # Calculate totals (handle empty results and None values defensively)
            total_users = len(daily_review_stats)
            total_reviews = sum(row[1] for row in daily_review_stats) if daily_review_stats else 0
            total_time = sum(row[3] or 0 for row in daily_review_stats) if daily_review_stats else 0

            # Log per-user stats for analytics
            for (
                user_id,
                review_count,
                avg_quality,
                time_seconds,
                unique_cards,
            ) in daily_review_stats:
                cards_mastered = mastery_stats.get(user_id, 0)

                logger.info(
                    "Daily user stats",
                    extra={
                        "date": str(yesterday),
                        "user_id": str(user_id),
                        "review_count": review_count,
                        "avg_quality": float(avg_quality) if avg_quality else 0,
                        "study_time_seconds": time_seconds or 0,
                        "unique_cards": unique_cards,
                        "cards_mastered": cards_mastered,
                    },
                )

            # Calculate platform-wide statistics
            if daily_review_stats:
                avg_reviews_per_user = total_reviews / total_users
                avg_time_per_user = total_time / total_users
                total_mastered = sum(mastery_stats.values())
            else:
                avg_reviews_per_user = 0
                avg_time_per_user = 0
                total_mastered = 0

            duration_ms = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000

            logger.info(
                "Stats aggregation complete",
                extra={
                    "date": str(yesterday),
                    "total_active_users": total_users,
                    "total_reviews": total_reviews,
                    "total_study_time_seconds": total_time,
                    "total_cards_mastered": total_mastered,
                    "avg_reviews_per_user": round(avg_reviews_per_user, 1),
                    "avg_time_per_user_seconds": round(avg_time_per_user, 1),
                    "duration_ms": duration_ms,
                },
            )

            await session.commit()
        finally:
            await session.close()

    except Exception as e:
        logger.error(f"Stats aggregation failed: {e}", exc_info=True)
        raise

    finally:
        # Always dispose of the engine to clean up connections
        if engine is not None:
            await engine.dispose()
