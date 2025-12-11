"""Standalone scheduler service entry point.

This module runs APScheduler as an independent service, separate from the
FastAPI backend. It handles:
- Redis connection for distributed operations
- APScheduler lifecycle management
- Graceful shutdown on SIGTERM/SIGINT

Usage:
    python -m src.scheduler_main

Railway Configuration:
    - Start Command: python -m src.scheduler_main
    - No HTTP port needed (internal service)
"""

import asyncio
import logging
import signal
import sys
from types import FrameType
from typing import Optional

from src.config import settings
from src.core.redis import close_redis, init_redis
from src.tasks.scheduler import get_scheduler, setup_scheduler, shutdown_scheduler

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Global shutdown event
shutdown_event = asyncio.Event()


def handle_shutdown(signum: int, frame: Optional[FrameType]) -> None:
    """Handle shutdown signals gracefully.

    Args:
        signum: Signal number received
        frame: Current stack frame (unused)
    """
    sig_name = signal.Signals(signum).name
    logger.info(f"Received {sig_name}, initiating graceful shutdown...")
    shutdown_event.set()


async def main() -> None:
    """Main scheduler service entry point."""
    logger.info("Starting scheduler service...")

    # Check feature flag
    if not settings.feature_background_tasks:
        logger.warning("Background tasks disabled (FEATURE_BACKGROUND_TASKS=false)")
        logger.warning("Scheduler service will exit. Enable the feature flag to run.")
        return

    # Register signal handlers
    signal.signal(signal.SIGTERM, handle_shutdown)
    signal.signal(signal.SIGINT, handle_shutdown)

    try:
        # Initialize Redis connection (needed for distributed operations)
        await init_redis()
        logger.info("Redis connection established")

        # Start the scheduler
        setup_scheduler()
        scheduler = get_scheduler()

        if scheduler and scheduler.running:
            job_count = len(scheduler.get_jobs())
            logger.info(f"Scheduler running with {job_count} jobs")

            # Log registered jobs
            for job in scheduler.get_jobs():
                logger.info(f"  - {job.id}: {job.name} (next run: {job.next_run_time})")
        else:
            logger.error("Scheduler failed to start")
            return

        # Wait for shutdown signal
        logger.info("Scheduler service ready, waiting for shutdown signal...")
        await shutdown_event.wait()

    except Exception as e:
        logger.exception(f"Scheduler service error: {e}")
        raise

    finally:
        # Cleanup
        logger.info("Shutting down scheduler...")
        shutdown_scheduler()

        logger.info("Closing Redis connection...")
        await close_redis()

        logger.info("Scheduler service stopped")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Scheduler interrupted by user")
    except Exception as e:
        logger.exception(f"Fatal error: {e}")
        sys.exit(1)
