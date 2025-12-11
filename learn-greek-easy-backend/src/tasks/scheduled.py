"""Scheduled task implementations for APScheduler.

These tasks are run by the dedicated scheduler service (src/scheduler_main.py)
on a periodic basis using APScheduler's CronTrigger.

Tasks:
- streak_reset_task: Daily at midnight UTC - Check and log broken streaks
- session_cleanup_task: Hourly - Clean up stale review sessions
- stats_aggregate_task: Daily at 00:30 UTC - Aggregate user statistics

Note: session_cleanup_task and stats_aggregate_task are placeholder implementations.
Full implementations will be added in tasks 12.08-12.09.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config import settings

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


async def session_cleanup_task() -> None:
    """Clean up stale and orphaned review sessions.

    This task runs hourly and:
    1. Finds review sessions that have been inactive for too long
    2. Marks them as abandoned or cleans them up
    3. Frees up resources and maintains data integrity

    Note: Full implementation in task 12.08.
    """
    logger.info("Running session cleanup task (placeholder)")
    # TODO: Implement in task 12.08
    # - Find sessions older than SESSION_TTL_SECONDS
    # - Mark as abandoned or delete based on policy
    # - Log cleanup statistics


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
