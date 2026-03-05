"""Unit tests for generate_audio_for_culture_question_task."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.config import settings

# Test constant: Fake MP3 audio bytes
FAKE_AUDIO = b"\xff\xfb\x90\x00" + b"\x00" * 16000


class TestGenerateAudioForCultureQuestionTask:
    """Test the generate_audio_for_culture_question_task implementation."""

    @pytest.mark.asyncio
    async def test_skips_when_background_tasks_disabled(self):
        """Test that task returns early when background tasks are disabled."""
        from src.tasks.background import generate_audio_for_culture_question_task

        question_id = uuid4()

        with patch.object(settings, "feature_background_tasks", False):
            with patch("src.tasks.background.create_async_engine") as mock_create_engine:
                await generate_audio_for_culture_question_task(
                    question_id=question_id,
                    question_text_el="Ποια ήταν η πρώτη πρωτεύουσα;",
                    db_url="postgresql+asyncpg://test:test@localhost/test",
                )

                mock_create_engine.assert_not_called()

    @pytest.mark.asyncio
    async def test_skips_when_elevenlabs_not_configured(self):
        """Test that task returns early when ElevenLabs is not configured."""
        from src.tasks.background import generate_audio_for_culture_question_task

        question_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.settings") as mock_settings:
                mock_settings.elevenlabs_configured = False
                with patch("src.tasks.background.create_async_engine") as mock_create_engine:
                    await generate_audio_for_culture_question_task(
                        question_id=question_id,
                        question_text_el="Ποια ήταν η πρώτη πρωτεύουσα;",
                        db_url="postgresql+asyncpg://test:test@localhost/test",
                    )

                    mock_create_engine.assert_not_called()

    @pytest.mark.asyncio
    async def test_happy_path_tts_upload_db_update(self):
        """Test full happy path: TTS generation, S3 upload, DB update."""
        from src.tasks.background import generate_audio_for_culture_question_task

        question_id = uuid4()
        question_text_el = "Ποια ήταν η πρώτη πρωτεύουσα;"

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.settings") as mock_settings:
                mock_settings.elevenlabs_configured = True
                mock_settings.is_production = False
                mock_engine = AsyncMock()
                with patch("src.tasks.background.create_async_engine", return_value=mock_engine):
                    mock_session = AsyncMock()
                    mock_session_factory = MagicMock(return_value=mock_session)
                    with patch(
                        "src.tasks.background.async_sessionmaker",
                        return_value=mock_session_factory,
                    ):
                        # Mock ElevenLabs service
                        mock_elevenlabs = MagicMock()
                        mock_elevenlabs.generate_speech = AsyncMock(return_value=FAKE_AUDIO)
                        with patch(
                            "src.services.elevenlabs_service.get_elevenlabs_service",
                            return_value=mock_elevenlabs,
                        ):
                            # Mock S3 service
                            mock_s3 = MagicMock()
                            mock_s3.upload_object = MagicMock(return_value=True)
                            with patch(
                                "src.services.s3_service.get_s3_service",
                                return_value=mock_s3,
                            ):
                                # Mock DB query
                                mock_question = MagicMock()
                                mock_result = MagicMock()
                                mock_result.scalar_one_or_none.return_value = mock_question
                                mock_session.execute = AsyncMock(return_value=mock_result)

                                await generate_audio_for_culture_question_task(
                                    question_id=question_id,
                                    question_text_el=question_text_el,
                                    db_url="postgresql+asyncpg://test:test@localhost/test",
                                )

                                # Verify TTS was called with correct args
                                mock_elevenlabs.generate_speech.assert_awaited_once_with(
                                    question_text_el
                                )

                                # Verify S3 upload was called with correct args
                                expected_s3_key = f"culture/audio/{question_id}.mp3"
                                mock_s3.upload_object.assert_called_once_with(
                                    expected_s3_key, FAKE_AUDIO, "audio/mpeg"
                                )

                                # Verify question audio_s3_key was set
                                assert mock_question.audio_s3_key == expected_s3_key

                                # Verify session.commit() was called
                                mock_session.commit.assert_awaited_once()

                                # Verify engine.dispose() was called
                                mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_returns_early_when_s3_upload_fails(self):
        """Test that DB is not updated when S3 upload fails."""
        from src.tasks.background import generate_audio_for_culture_question_task

        question_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.settings") as mock_settings:
                mock_settings.elevenlabs_configured = True
                mock_settings.is_production = False
                mock_engine = AsyncMock()
                with patch("src.tasks.background.create_async_engine", return_value=mock_engine):
                    mock_session = AsyncMock()
                    mock_session_factory = MagicMock(return_value=mock_session)
                    with patch(
                        "src.tasks.background.async_sessionmaker",
                        return_value=mock_session_factory,
                    ):
                        mock_elevenlabs = MagicMock()
                        mock_elevenlabs.generate_speech = AsyncMock(return_value=FAKE_AUDIO)
                        with patch(
                            "src.services.elevenlabs_service.get_elevenlabs_service",
                            return_value=mock_elevenlabs,
                        ):
                            # Mock S3 service — upload fails
                            mock_s3 = MagicMock()
                            mock_s3.upload_object = MagicMock(return_value=False)
                            with patch(
                                "src.services.s3_service.get_s3_service",
                                return_value=mock_s3,
                            ):
                                await generate_audio_for_culture_question_task(
                                    question_id=question_id,
                                    question_text_el="Ποια ήταν η πρώτη πρωτεύουσα;",
                                    db_url="postgresql+asyncpg://test:test@localhost/test",
                                )

                                # DB should NOT be queried or committed
                                mock_session.commit.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_handles_elevenlabs_exception_gracefully(self):
        """Test that ElevenLabs exceptions are caught and logged."""
        from src.tasks.background import generate_audio_for_culture_question_task

        question_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.settings") as mock_settings:
                mock_settings.elevenlabs_configured = True
                mock_settings.is_production = False
                mock_engine = AsyncMock()
                with patch("src.tasks.background.create_async_engine", return_value=mock_engine):
                    mock_session = AsyncMock()
                    mock_session_factory = MagicMock(return_value=mock_session)
                    with patch(
                        "src.tasks.background.async_sessionmaker",
                        return_value=mock_session_factory,
                    ):
                        mock_elevenlabs = MagicMock()
                        mock_elevenlabs.generate_speech = AsyncMock(
                            side_effect=RuntimeError("ElevenLabs API error")
                        )
                        with patch(
                            "src.services.elevenlabs_service.get_elevenlabs_service",
                            return_value=mock_elevenlabs,
                        ):
                            # Should not raise
                            await generate_audio_for_culture_question_task(
                                question_id=question_id,
                                question_text_el="Ποια ήταν η πρώτη πρωτεύουσα;",
                                db_url="postgresql+asyncpg://test:test@localhost/test",
                            )

                            # Verify engine was disposed
                            mock_engine.dispose.assert_awaited_once()
