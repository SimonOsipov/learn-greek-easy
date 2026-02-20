"""Background tasks module.

This module provides:
1. FastAPI BackgroundTasks functions for async fire-and-forget operations
2. APScheduler for scheduled periodic jobs (in dedicated service)

Example usage for background tasks:
    from fastapi import BackgroundTasks
    from src.tasks import check_achievements_task, is_background_tasks_enabled

    @router.post("/review")
    async def submit_review(
        background_tasks: BackgroundTasks,
        db: AsyncSession = Depends(get_db),
    ):
        # Process review...

        # Queue background tasks if enabled
        if is_background_tasks_enabled():
            background_tasks.add_task(
                check_achievements_task,
                user_id,
                settings.database_url,
            )

        return response

Example usage for scheduler (in scheduler_main.py):
    from src.tasks import setup_scheduler, shutdown_scheduler

    async def main():
        setup_scheduler()
        try:
            await asyncio.Event().wait()  # Run forever
        finally:
            shutdown_scheduler()
"""

from src.tasks.background import (
    ANALYTICS_EVENTS,
    WORD_AUDIO_S3_PREFIX,
    check_achievements_task,
    check_culture_achievements_task,
    create_announcement_notifications_task,
    generate_audio_for_news_item_task,
    generate_word_entry_audio_task,
    generate_word_entry_part_audio_task,
    invalidate_cache_task,
    is_background_tasks_enabled,
    log_analytics_task,
    process_answer_side_effects_task,
    process_culture_answer_full_async,
    recalculate_progress_task,
)
from src.tasks.scheduler import get_scheduler, setup_scheduler, shutdown_scheduler

__all__ = [
    # Background tasks (API-side, fire-and-forget)
    "ANALYTICS_EVENTS",
    "WORD_AUDIO_S3_PREFIX",
    "check_achievements_task",
    "check_culture_achievements_task",
    "create_announcement_notifications_task",
    "generate_audio_for_news_item_task",
    "generate_word_entry_audio_task",
    "generate_word_entry_part_audio_task",
    "invalidate_cache_task",
    "is_background_tasks_enabled",
    "log_analytics_task",
    "process_answer_side_effects_task",
    "process_culture_answer_full_async",
    "recalculate_progress_task",
    # Scheduler (dedicated service)
    "get_scheduler",
    "setup_scheduler",
    "shutdown_scheduler",
]
