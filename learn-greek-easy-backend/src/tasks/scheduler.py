"""APScheduler configuration for scheduled background tasks.

This module provides the scheduler core used by the dedicated
scheduler service (src/scheduler_main.py).

The scheduler runs periodic jobs like:
- Streak reset (daily at midnight UTC)
- Session cleanup (hourly)
- Stats aggregation (daily at 00:30 UTC)

Architecture:
    This project uses a dedicated scheduler service pattern:

    +-----------------------+     +-----------------------+
    |   Backend (API)       |     |  Scheduler Service    |
    |  +---------------+    |     |  +---------------+    |
    |  |   FastAPI     |    |     |  | scheduler_main|    |
    |  |   +           |    |     |  |      v        |    |
    |  | Background    |    |     |  | APScheduler   |    |
    |  |   Tasks       |    |     |  | (this module) |    |
    |  +---------------+    |     |  +---------------+    |
    +-----------------------+     +-----------------------+
             |                              |
        Fire-and-forget               Scheduled jobs
        (achievements,                (streak reset,
         cache invalidation)           session cleanup)

Usage:
    # In scheduler_main.py (dedicated service)
    from src.tasks.scheduler import setup_scheduler, shutdown_scheduler

    async def main():
        setup_scheduler()
        try:
            await asyncio.Event().wait()  # Run forever
        finally:
            shutdown_scheduler()
"""

from typing import Optional

from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED, JobExecutionEvent
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from src.config import settings
from src.core.logging import get_logger

logger = get_logger(__name__)

# Global scheduler instance
_scheduler: Optional[AsyncIOScheduler] = None


def job_listener(event: JobExecutionEvent) -> None:
    """Log job execution results.

    This listener is attached to the scheduler to log both successful
    and failed job executions for monitoring and debugging.

    Args:
        event: Job execution event from APScheduler
    """
    if event.exception:
        logger.error(
            f"Scheduled job {event.job_id} failed: {event.exception}",
            exc_info=event.exception,
        )
    else:
        logger.info(f"Scheduled job {event.job_id} completed successfully")


def setup_scheduler() -> None:
    """Initialize and start the APScheduler.

    Only starts if feature_background_tasks is enabled in settings.
    Called by scheduler_main.py (dedicated service).

    The scheduler is configured with:
    - UTC timezone for consistent scheduling across environments
    - coalesce=True: Combine missed runs into a single execution
    - max_instances=1: Prevent overlapping job runs
    - misfire_grace_time=300: Allow 5 minutes grace for missed jobs
    """
    global _scheduler

    if not settings.feature_background_tasks:
        logger.info("Background tasks disabled, skipping scheduler setup")
        return

    logger.info("Initializing APScheduler...")

    _scheduler = AsyncIOScheduler(
        timezone="UTC",
        job_defaults={
            "coalesce": True,  # Combine missed runs into one
            "max_instances": 1,  # One instance per job at a time
            "misfire_grace_time": 60 * 5,  # 5 min grace for missed jobs (300 seconds)
        },
    )

    # Add event listener for logging
    _scheduler.add_listener(job_listener, EVENT_JOB_EXECUTED | EVENT_JOB_ERROR)

    # Register scheduled jobs (implemented in 12.07-12.09)
    # Import here to avoid circular imports
    from src.tasks.scheduled import session_cleanup_task, stats_aggregate_task, streak_reset_task

    # Daily streak reset at configured hour (default: midnight UTC)
    _scheduler.add_job(
        streak_reset_task,
        CronTrigger(hour=settings.streak_reset_hour_utc, minute=0),
        id="streak_reset",
        name="Daily Streak Reset",
    )

    # Hourly session cleanup (at the top of each hour)
    _scheduler.add_job(
        session_cleanup_task,
        CronTrigger(minute=0),
        id="session_cleanup",
        name="Hourly Session Cleanup",
    )

    # Daily stats aggregation at 00:30 UTC (after streak reset)
    _scheduler.add_job(
        stats_aggregate_task,
        CronTrigger(hour=0, minute=30),
        id="stats_aggregate",
        name="Daily Stats Aggregation",
    )

    _scheduler.start()
    logger.info(f"APScheduler started with {len(_scheduler.get_jobs())} jobs")

    # Log registered jobs for visibility
    for job in _scheduler.get_jobs():
        logger.info(f"  - {job.id}: {job.name} (next run: {job.next_run_time})")


def shutdown_scheduler() -> None:
    """Shutdown the APScheduler gracefully.

    Waits for currently running jobs to complete before shutting down.
    Called during service shutdown to ensure clean termination.
    """
    global _scheduler

    if _scheduler is None:
        return

    logger.info("Shutting down APScheduler...")
    _scheduler.shutdown(wait=True)
    _scheduler = None
    logger.info("APScheduler shutdown complete")


def get_scheduler() -> Optional[AsyncIOScheduler]:
    """Get the global scheduler instance.

    Returns:
        The AsyncIOScheduler instance if initialized, None otherwise.
        Useful for checking scheduler status or accessing job information.
    """
    return _scheduler
