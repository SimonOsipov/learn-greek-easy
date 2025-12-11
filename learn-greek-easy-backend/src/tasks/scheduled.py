"""Scheduled task implementations for APScheduler.

These tasks are run by the dedicated scheduler service (src/scheduler_main.py)
on a periodic basis using APScheduler's CronTrigger.

Tasks:
- streak_reset_task: Daily at midnight UTC - Check and log broken streaks
- session_cleanup_task: Daily at 3 AM UTC - Clean up orphaned Redis sessions
- stats_aggregate_task: Daily at 00:30 UTC - Aggregate user statistics

Note: stats_aggregate_task is a placeholder implementation.
Full implementation will be added in task 12.09.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config import settings

if TYPE_CHECKING:
    from redis.asyncio import Redis

logger = logging.getLogger(__name__)


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
        engine = create_async_engine(settings.database_url, pool_pre_ping=True)
        async_session_factory = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )

        async with async_session_factory() as session:
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
    """Aggregate daily user statistics.

    This task runs daily at 00:30 UTC (after streak reset) and:
    1. Aggregates review counts, accuracy rates, study time
    2. Updates daily/weekly/monthly summary tables
    3. Prepares data for analytics dashboards

    Note: Full implementation in task 12.09.
    """
    logger.info("Running stats aggregation task (placeholder)")
    # TODO: Implement in task 12.09
    # - Aggregate yesterday's review data per user
    # - Update summary statistics tables
    # - Log aggregation results
