"""Unit tests for generate_audio_for_news_item_task."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.config import settings

# Test constant: Fake MP3 audio bytes
FAKE_AUDIO = b"\xff\xfb\x90\x00" + b"\x00" * 16000


class TestGenerateAudioForNewsItemTask:
    """Test the generate_audio_for_news_item_task implementation."""

    @pytest.mark.asyncio
    async def test_skips_when_background_tasks_disabled(self):
        """Test that task returns early when background tasks are disabled."""
        from src.tasks.background import generate_audio_for_news_item_task

        news_item_id = uuid4()

        with patch.object(settings, "feature_background_tasks", False):
            with patch("src.tasks.background.create_async_engine") as mock_create_engine:
                await generate_audio_for_news_item_task(
                    news_item_id=news_item_id,
                    description_el="Κείμενο δοκιμής",
                    db_url="postgresql+asyncpg://test:test@localhost/test",
                )

                # Should not create engine when disabled
                mock_create_engine.assert_not_called()

    @pytest.mark.asyncio
    async def test_skips_when_elevenlabs_not_configured(self):
        """Test that task returns early when ElevenLabs is not configured."""
        from src.tasks.background import generate_audio_for_news_item_task

        news_item_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.settings") as mock_settings:
                mock_settings.elevenlabs_configured = False
                with patch("src.tasks.background.create_async_engine") as mock_create_engine:
                    await generate_audio_for_news_item_task(
                        news_item_id=news_item_id,
                        description_el="Κείμενο δοκιμής",
                        db_url="postgresql+asyncpg://test:test@localhost/test",
                    )

                    # Should not create engine when ElevenLabs not configured
                    mock_create_engine.assert_not_called()

    @pytest.mark.asyncio
    async def test_happy_path_tts_upload_db_update(self):
        """Test full happy path: TTS generation, S3 upload, DB update."""
        from src.tasks.background import generate_audio_for_news_item_task

        news_item_id = uuid4()
        description_el = "Κείμενο δοκιμής"

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.settings") as mock_settings:
                mock_settings.elevenlabs_configured = True
                mock_settings.audio_s3_prefix = "news-audio"
                # Mock engine
                mock_engine = AsyncMock()
                with patch("src.tasks.background.create_async_engine", return_value=mock_engine):
                    # Mock session
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
                                mock_news_item = MagicMock()
                                mock_result = MagicMock()
                                mock_result.scalar_one_or_none.return_value = mock_news_item
                                mock_session.execute = AsyncMock(return_value=mock_result)

                                await generate_audio_for_news_item_task(
                                    news_item_id=news_item_id,
                                    description_el=description_el,
                                    db_url="postgresql+asyncpg://test:test@localhost/test",
                                )

                                # Verify TTS was called with correct args
                                mock_elevenlabs.generate_speech.assert_awaited_once_with(
                                    description_el, news_item_id=news_item_id
                                )

                                # Verify S3 upload was called with correct args
                                expected_s3_key = f"news-audio/{news_item_id}.mp3"
                                mock_s3.upload_object.assert_called_once_with(
                                    expected_s3_key, FAKE_AUDIO, "audio/mpeg"
                                )

                                # Verify news item fields were set
                                assert mock_news_item.audio_s3_key == expected_s3_key
                                assert mock_news_item.audio_generated_at is not None
                                assert mock_news_item.audio_file_size_bytes == len(FAKE_AUDIO)
                                assert mock_news_item.audio_duration_seconds is not None

                                # Verify session.commit() was called
                                mock_session.commit.assert_awaited_once()

                                # Verify engine.dispose() was called
                                mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_s3_upload_failure_no_db_update(self):
        """Test that DB is not updated when S3 upload fails."""
        from src.tasks.background import generate_audio_for_news_item_task

        news_item_id = uuid4()
        description_el = "Κείμενο δοκιμής"

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.settings") as mock_settings:
                mock_settings.elevenlabs_configured = True
                mock_settings.audio_s3_prefix = "news-audio"
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
                            # Mock S3 service - upload fails
                            mock_s3 = MagicMock()
                            mock_s3.upload_object = MagicMock(return_value=False)
                            with patch(
                                "src.services.s3_service.get_s3_service",
                                return_value=mock_s3,
                            ):
                                await generate_audio_for_news_item_task(
                                    news_item_id=news_item_id,
                                    description_el=description_el,
                                    db_url="postgresql+asyncpg://test:test@localhost/test",
                                )

                                # Verify session.commit() was NOT called
                                mock_session.commit.assert_not_awaited()

                                # Verify engine.dispose() was still called
                                mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_tts_failure_exception_swallowed(self):
        """Test that TTS failures don't propagate exceptions."""
        from src.tasks.background import generate_audio_for_news_item_task

        news_item_id = uuid4()
        description_el = "Κείμενο δοκιμής"

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.settings") as mock_settings:
                mock_settings.elevenlabs_configured = True
                mock_engine = AsyncMock()
                with patch("src.tasks.background.create_async_engine", return_value=mock_engine):
                    mock_session = AsyncMock()
                    mock_session_factory = MagicMock(return_value=mock_session)
                    with patch(
                        "src.tasks.background.async_sessionmaker",
                        return_value=mock_session_factory,
                    ):
                        # Mock ElevenLabs service - raises exception
                        mock_elevenlabs = MagicMock()
                        mock_elevenlabs.generate_speech = AsyncMock(
                            side_effect=Exception("TTS failed")
                        )
                        with patch(
                            "src.services.elevenlabs_service.get_elevenlabs_service",
                            return_value=mock_elevenlabs,
                        ):
                            # Should not raise exception
                            await generate_audio_for_news_item_task(
                                news_item_id=news_item_id,
                                description_el=description_el,
                                db_url="postgresql+asyncpg://test:test@localhost/test",
                            )

                            # Verify engine.dispose() was still called
                            mock_engine.dispose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_s3_key_format(self):
        """Test that S3 key follows expected format."""
        from src.tasks.background import generate_audio_for_news_item_task

        news_item_id = uuid4()
        description_el = "Κείμενο δοκιμής"

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.settings") as mock_settings:
                mock_settings.elevenlabs_configured = True
                mock_settings.audio_s3_prefix = "news-audio"
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
                                mock_news_item = MagicMock()
                                mock_result = MagicMock()
                                mock_result.scalar_one_or_none.return_value = mock_news_item
                                mock_session.execute = AsyncMock(return_value=mock_result)

                                await generate_audio_for_news_item_task(
                                    news_item_id=news_item_id,
                                    description_el=description_el,
                                    db_url="postgresql+asyncpg://test:test@localhost/test",
                                )

                                # Verify S3 key format
                                expected_s3_key = f"news-audio/{news_item_id}.mp3"
                                mock_s3.upload_object.assert_called_once_with(
                                    expected_s3_key, FAKE_AUDIO, "audio/mpeg"
                                )

    @pytest.mark.asyncio
    async def test_duration_calculation(self):
        """Test that audio duration is calculated correctly from byte length."""
        from src.tasks.background import generate_audio_for_news_item_task

        news_item_id = uuid4()
        description_el = "Κείμενο δοκιμής"

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.settings") as mock_settings:
                mock_settings.elevenlabs_configured = True
                mock_settings.audio_s3_prefix = "news-audio"
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
                                mock_news_item = MagicMock()
                                mock_result = MagicMock()
                                mock_result.scalar_one_or_none.return_value = mock_news_item
                                mock_session.execute = AsyncMock(return_value=mock_result)

                                await generate_audio_for_news_item_task(
                                    news_item_id=news_item_id,
                                    description_el=description_el,
                                    db_url="postgresql+asyncpg://test:test@localhost/test",
                                )

                                # Calculate expected duration (128kbps bitrate)
                                expected_duration = (len(FAKE_AUDIO) * 8) / (128 * 1000)

                                # Verify duration calculation
                                assert mock_news_item.audio_duration_seconds == expected_duration
                                # Also verify using pytest.approx
                                assert mock_news_item.audio_duration_seconds == pytest.approx(
                                    expected_duration
                                )

    @pytest.mark.asyncio
    async def test_news_item_not_found(self):
        """Test that task handles case when news item is not found in DB."""
        from src.tasks.background import generate_audio_for_news_item_task

        news_item_id = uuid4()
        description_el = "Κείμενο δοκιμής"

        with patch.object(settings, "feature_background_tasks", True):
            with patch("src.tasks.background.settings") as mock_settings:
                mock_settings.elevenlabs_configured = True
                mock_settings.audio_s3_prefix = "news-audio"
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
                                # Mock DB query - returns None
                                mock_result = MagicMock()
                                mock_result.scalar_one_or_none.return_value = None
                                mock_session.execute = AsyncMock(return_value=mock_result)

                                await generate_audio_for_news_item_task(
                                    news_item_id=news_item_id,
                                    description_el=description_el,
                                    db_url="postgresql+asyncpg://test:test@localhost/test",
                                )

                                # Verify session.commit() was NOT called
                                mock_session.commit.assert_not_awaited()

                                # Verify engine.dispose() was still called
                                mock_engine.dispose.assert_awaited_once()
