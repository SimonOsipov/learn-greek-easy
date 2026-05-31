from __future__ import annotations

from uuid import UUID

from src.core.logging import get_logger
from src.db.session import get_session_factory
from src.services.openrouter_service import get_openrouter_service
from src.services.s3_service import get_s3_service
from src.services.situation_picture_service import run_picture_generation_pipeline
from src.tasks.background import is_background_tasks_enabled

logger = get_logger(__name__)


async def generate_picture_task(situation_id: UUID) -> None:
    """Fire-and-forget BG task: generate AI picture for a situation.

    Convention (per src/tasks/background.py):
      - Gated on settings.feature_background_tasks via is_background_tasks_enabled().
      - Uses the global session factory initialised at startup.
      - Catches all exceptions, logs ERROR, never raises out.
    """
    if not is_background_tasks_enabled():
        logger.debug(
            "Background tasks disabled, skipping generate_picture_task",
            extra={"situation_id": str(situation_id)},
        )
        return

    try:
        factory = get_session_factory()
        openrouter_service = get_openrouter_service()
        s3_service = get_s3_service()
        await run_picture_generation_pipeline(situation_id, factory, openrouter_service, s3_service)
    except Exception:
        logger.error(
            "picture-generation BG task failed",
            extra={"situation_id": str(situation_id)},
            exc_info=True,
        )
