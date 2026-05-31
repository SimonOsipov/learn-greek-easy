from __future__ import annotations

from typing import Literal
from uuid import UUID

from src.core.logging import get_logger
from src.db.session import get_session_factory
from src.services.audio_generation_service import get_audio_generation_service
from src.services.description_audio_service import run_description_audio_pipeline
from src.tasks.background import is_background_tasks_enabled

logger = get_logger(__name__)


async def generate_description_audio_task(
    situation_id: UUID,
    level: Literal["b1", "a2"],
) -> None:
    """Fire-and-forget BG task: generate description audio + word timestamps.

    Convention (per src/tasks/background.py):
      - Gated on settings.feature_background_tasks via is_background_tasks_enabled().
      - Uses the global session factory initialised at startup.
      - Catches all exceptions, logs ERROR, never raises out.
    """
    if not is_background_tasks_enabled():
        logger.debug(
            "Background tasks disabled, skipping generate_description_audio_task",
            extra={"situation_id": str(situation_id), "level": level},
        )
        return

    try:
        factory = get_session_factory()
        audio_service = get_audio_generation_service()
        await run_description_audio_pipeline(situation_id, level, factory, audio_service)
    except Exception:
        logger.error(
            "description-audio BG task failed",
            extra={"situation_id": str(situation_id), "level": level},
            exc_info=True,
        )
