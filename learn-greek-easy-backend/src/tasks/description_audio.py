from __future__ import annotations

from typing import Literal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config import settings
from src.core.logging import get_logger
from src.services.audio_generation_service import get_audio_generation_service
from src.services.description_audio_service import run_description_audio_pipeline
from src.tasks.background import is_background_tasks_enabled

logger = get_logger(__name__)


async def generate_description_audio_task(
    situation_id: UUID,
    level: Literal["b1", "a2"],
    db_url: str,
) -> None:
    """Fire-and-forget BG task: generate description audio + word timestamps.

    Convention (per src/tasks/background.py):
      - Gated on settings.feature_background_tasks via is_background_tasks_enabled().
      - Builds its own engine per call; disposes in finally.
      - Catches all exceptions, logs ERROR, never raises out.
    """
    if not is_background_tasks_enabled():
        logger.debug(
            "Background tasks disabled, skipping generate_description_audio_task",
            extra={"situation_id": str(situation_id), "level": level},
        )
        return

    engine = None
    try:
        engine = create_async_engine(
            db_url,
            pool_pre_ping=True,
            connect_args={"ssl": "require"} if settings.is_production else {},
        )
        factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        audio_service = get_audio_generation_service()
        await run_description_audio_pipeline(situation_id, level, factory, audio_service)
    except Exception:
        logger.error(
            "description-audio BG task failed",
            extra={"situation_id": str(situation_id), "level": level},
            exc_info=True,
        )
    finally:
        if engine is not None:
            await engine.dispose()
