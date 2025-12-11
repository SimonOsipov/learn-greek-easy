"""Background tasks module.

This module provides:
1. FastAPI BackgroundTasks functions for async operations
2. Railway Cron task runners for scheduled jobs (future)

Example usage:
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
"""

from src.tasks.background import (
    check_achievements_task,
    invalidate_cache_task,
    is_background_tasks_enabled,
    log_analytics_task,
    recalculate_progress_task,
)

__all__ = [
    "check_achievements_task",
    "invalidate_cache_task",
    "is_background_tasks_enabled",
    "log_analytics_task",
    "recalculate_progress_task",
]
