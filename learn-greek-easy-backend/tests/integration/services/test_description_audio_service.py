"""Integration tests for run_description_audio_pipeline (pipeline core).

Bucket C: drives the orchestrator directly with a stubbed AudioGenerationService
and a real test sessionmaker (test_factory fixture from conftest.py).

Key design decisions:
- audio_service is passed as a parameter — NOT patched via get_audio_generation_service
  (description_audio_service.py:186 accepts it directly; no internal lookup).
- Seeds via db_session (autouse bind_factory_session is active), then calls
  await db_session.commit() so the pipeline's own factory.begin() sessions can
  see the committed rows.
- Assertions on DB state re-load the row via db_session after the pipeline
  completes (using db_session.get or refresh so the snapshot is current).
"""

from __future__ import annotations

import logging
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.db.models import DescriptionStatus, SituationDescription
from src.services.audio_generation_service import AudioGenerationService, AudioWithTimestampsResult
from src.services.description_audio_service import (
    DescriptionGenerateError,
    run_description_audio_pipeline,
)
from tests.factories.situation import SituationFactory
from tests.factories.situation_description import SituationDescriptionFactory

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_audio_result(word_timestamps=None) -> AudioWithTimestampsResult:
    """Build a realistic stub AudioWithTimestampsResult."""
    if word_timestamps is None:
        word_timestamps = [
            {"word": "Καλημέρα", "start_ms": 0, "end_ms": 800},
            {"word": "κόσμε", "start_ms": 850, "end_ms": 1400},
        ]
    return AudioWithTimestampsResult(
        audio_bytes=b"fake-mp3-bytes",
        s3_key="situations/test/description-b1.mp3",
        duration_seconds=12.5,
        file_size_bytes=200_000,
        word_timestamps=word_timestamps,
    )


def _make_audio_service(stub_result: AudioWithTimestampsResult) -> AudioGenerationService:
    """Build a MagicMock AudioGenerationService with generate_single returning stub_result."""
    svc = MagicMock(spec=AudioGenerationService)
    svc.generate_single = AsyncMock(return_value=stub_result)
    return svc


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestRunDescriptionAudioPipelineB1:
    """C.1: pipeline writes the correct B1 columns and leaves A2 columns NULL."""

    async def test_pipeline_writes_b1_columns(
        self,
        db_session: AsyncSession,
        test_factory: async_sessionmaker[AsyncSession],
    ):
        """B1 run writes audio_s3_key, duration, word_timestamps, status=AUDIO_READY."""
        situation = await SituationFactory.create(session=db_session, ready=True)
        description = await SituationDescriptionFactory.create(
            session=db_session,
            situation_id=situation.id,
            text_el="Καλημέρα, αυτό είναι ένα τεστ.",
        )
        await db_session.commit()

        stub_result = _make_audio_result()
        audio_service = _make_audio_service(stub_result)

        await run_description_audio_pipeline(
            situation_id=situation.id,
            level="b1",
            factory=test_factory,
            audio_service=audio_service,
        )

        # Re-load from DB (pipeline used its own session; db_session cache is stale)
        await db_session.refresh(description)

        assert description.audio_s3_key is not None
        assert description.audio_duration_seconds == stub_result.duration_seconds
        assert description.word_timestamps == stub_result.word_timestamps
        assert len(description.word_timestamps) > 0
        assert description.status == DescriptionStatus.AUDIO_READY

        # A2 columns must remain NULL
        assert description.audio_a2_s3_key is None
        assert description.audio_a2_duration_seconds is None
        assert description.word_timestamps_a2 is None


@pytest.mark.asyncio
class TestRunDescriptionAudioPipelineA2:
    """C.2: pipeline writes the correct A2 columns and leaves B1 columns NULL."""

    async def test_pipeline_writes_a2_columns(
        self,
        db_session: AsyncSession,
        test_factory: async_sessionmaker[AsyncSession],
    ):
        """A2 run writes audio_a2_s3_key, a2 duration, word_timestamps_a2, status=AUDIO_READY."""
        situation = await SituationFactory.create(session=db_session, ready=True)
        description = await SituationDescriptionFactory.create(
            session=db_session,
            situation_id=situation.id,
            text_el="B1 κείμενο για ελεγχο.",
            text_el_a2="A2 κείμενο για ελεγχο.",
        )
        await db_session.commit()

        stub_result = _make_audio_result()
        audio_service = _make_audio_service(stub_result)

        await run_description_audio_pipeline(
            situation_id=situation.id,
            level="a2",
            factory=test_factory,
            audio_service=audio_service,
        )

        await db_session.refresh(description)

        assert description.audio_a2_s3_key is not None
        assert description.audio_a2_duration_seconds == stub_result.duration_seconds
        assert description.word_timestamps_a2 == stub_result.word_timestamps
        assert description.status == DescriptionStatus.AUDIO_READY

        # B1 columns must remain NULL (this run did not touch them)
        assert description.audio_s3_key is None
        assert description.audio_duration_seconds is None
        assert description.word_timestamps is None


@pytest.mark.asyncio
class TestRunDescriptionAudioPipelineEmptyTimestamps:
    """C.3: forced_align empty-timestamps path — audio persists, ERROR logged (AC#11)."""

    async def test_empty_word_timestamps_persists_audio_and_logs_error(
        self,
        db_session: AsyncSession,
        test_factory: async_sessionmaker[AsyncSession],
        caplog_loguru,
    ):
        """When audio service returns empty word_timestamps, audio is still written
        and an ERROR record with situation_id / level / text_length extras is emitted."""
        situation = await SituationFactory.create(session=db_session, ready=True)
        description = await SituationDescriptionFactory.create(
            session=db_session,
            situation_id=situation.id,
            text_el="Κείμενο χωρίς timestamps.",
        )
        await db_session.commit()

        # Stub returns empty timestamps — the AC#11 branch in run_description_audio_pipeline
        stub_result = _make_audio_result(word_timestamps=[])
        audio_service = _make_audio_service(stub_result)

        caplog_loguru.set_level(logging.ERROR)

        await run_description_audio_pipeline(
            situation_id=situation.id,
            level="b1",
            factory=test_factory,
            audio_service=audio_service,
        )

        await db_session.refresh(description)

        # Audio must still be persisted
        assert description.audio_s3_key is not None
        assert description.status == DescriptionStatus.AUDIO_READY
        assert description.word_timestamps == []

        # An ERROR record must have been emitted
        error_records = [r for r in caplog_loguru.records if r.levelname == "ERROR"]
        assert len(error_records) >= 1
        messages = [r.getMessage() for r in error_records]
        assert any("forced_align returned empty timestamps" in m for m in messages)


@pytest.mark.asyncio
class TestRunDescriptionAudioPipelineTTSFailure:
    """C.4: TTS exception propagates as DescriptionGenerateError; row stays DRAFT."""

    async def test_tts_exception_propagates_and_leaves_row_in_draft(
        self,
        db_session: AsyncSession,
        test_factory: async_sessionmaker[AsyncSession],
    ):
        """When generate_single raises, the orchestrator wraps it in
        DescriptionGenerateError (not RuntimeError) and leaves the DB row in DRAFT."""
        situation = await SituationFactory.create(session=db_session, ready=True)
        description = await SituationDescriptionFactory.create(
            session=db_session,
            situation_id=situation.id,
            text_el="Κείμενο που θα αποτύχει.",
        )
        await db_session.commit()

        broken_service = MagicMock(spec=AudioGenerationService)
        broken_service.generate_single = AsyncMock(
            side_effect=RuntimeError("simulated TTS failure")
        )

        with pytest.raises(DescriptionGenerateError):
            await run_description_audio_pipeline(
                situation_id=situation.id,
                level="b1",
                factory=test_factory,
                audio_service=broken_service,
            )

        # Row must still be in DRAFT — no half-write on failure
        result = await db_session.execute(
            select(SituationDescription).where(SituationDescription.id == description.id)
        )
        row = result.scalar_one()
        assert row.status == DescriptionStatus.DRAFT
        assert row.audio_s3_key is None
        assert row.word_timestamps is None
