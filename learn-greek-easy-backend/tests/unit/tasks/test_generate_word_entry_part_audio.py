"""Unit tests for generate_word_entry_part_audio_task background task."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.tasks.background import (
    WORD_AUDIO_S3_PREFIX,
    WORD_AUDIO_VOICE_ID,
    generate_word_entry_part_audio_task,
)


def make_mock_session(word_entry):
    """Create a mock async session that returns the given word_entry."""
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = word_entry
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.commit = AsyncMock()
    mock_session.rollback = AsyncMock()
    mock_session.close = AsyncMock()
    # Support async context manager usage
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=False)
    return mock_session


def make_mock_engine(mock_session):
    """Create mock engine + sessionmaker pointing to mock_session."""
    mock_engine = AsyncMock()
    mock_sessionmaker = MagicMock(return_value=mock_session)
    return mock_engine, mock_sessionmaker


def make_word_entry(
    lemma="σπίτι",
    audio_key=None,
    audio_status="missing",
    examples=None,
):
    """Create a mock WordEntry ORM instance."""
    entry = MagicMock()
    entry.id = uuid4()
    entry.lemma = lemma
    entry.audio_key = audio_key
    entry.audio_status = audio_status
    entry.audio_generating_since = None
    if examples is None:
        examples = []
    entry.examples = examples
    return entry


@pytest.mark.unit
class TestGateChecks:
    async def test_early_return_when_background_tasks_disabled(self):
        """When is_background_tasks_enabled() returns False, task returns immediately."""
        with (
            patch("src.tasks.background.settings") as mock_settings,
            patch("src.tasks.background.create_async_engine") as mock_engine_factory,
        ):
            mock_settings.feature_background_tasks = False
            mock_settings.elevenlabs_configured = True

            await generate_word_entry_part_audio_task(
                word_entry_id=uuid4(),
                part="lemma",
                text="σπίτι",
                example_id=None,
                db_url="postgresql+asyncpg://test",
            )

            mock_engine_factory.assert_not_called()

    async def test_early_return_when_elevenlabs_not_configured(self):
        """When elevenlabs_configured is False, task returns immediately."""
        with (
            patch("src.tasks.background.settings") as mock_settings,
            patch("src.tasks.background.create_async_engine") as mock_engine_factory,
        ):
            mock_settings.feature_background_tasks = True
            mock_settings.elevenlabs_configured = False

            await generate_word_entry_part_audio_task(
                word_entry_id=uuid4(),
                part="lemma",
                text="σπίτι",
                example_id=None,
                db_url="postgresql+asyncpg://test",
            )

            mock_engine_factory.assert_not_called()

    async def test_early_return_when_word_entry_not_found(self):
        """When word entry is not found in DB, task returns gracefully without calling TTS."""
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.rollback = AsyncMock()
        mock_session.close = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        mock_engine = AsyncMock()
        mock_session_factory = MagicMock(return_value=mock_session)

        mock_elevenlabs = AsyncMock()

        with (
            patch("src.tasks.background.create_async_engine", return_value=mock_engine),
            patch("src.tasks.background.async_sessionmaker", return_value=mock_session_factory),
            patch("src.tasks.background.settings") as mock_settings,
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
        ):
            mock_settings.feature_background_tasks = True
            mock_settings.elevenlabs_configured = True
            mock_settings.is_production = False

            await generate_word_entry_part_audio_task(
                word_entry_id=uuid4(),
                part="lemma",
                text="σπίτι",
                example_id=None,
                db_url="postgresql+asyncpg://test",
            )

        mock_elevenlabs.generate_speech.assert_not_called()


@pytest.mark.unit
class TestLemmaHappyPath:
    async def test_lemma_generates_successfully_audio_key_set(self):
        """Happy path: lemma TTS succeeds, audio_key set, audio_status=READY."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(lemma="σπίτι", examples=[])
        word_entry.id = word_entry_id
        mock_session = make_mock_session(word_entry)
        mock_engine, mock_session_factory = make_mock_engine(mock_session)

        mock_elevenlabs = AsyncMock()
        mock_elevenlabs.generate_speech = AsyncMock(return_value=b"audio-bytes")
        mock_s3 = MagicMock()
        mock_s3.upload_object = MagicMock(return_value=True)

        with (
            patch("src.tasks.background.create_async_engine", return_value=mock_engine),
            patch("src.tasks.background.async_sessionmaker", return_value=mock_session_factory),
            patch("src.tasks.background.settings") as mock_settings,
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.services.s3_service.get_s3_service", return_value=mock_s3),
        ):
            mock_settings.feature_background_tasks = True
            mock_settings.elevenlabs_configured = True
            mock_settings.is_production = False

            await generate_word_entry_part_audio_task(
                word_entry_id=word_entry_id,
                part="lemma",
                text="σπίτι",
                example_id=None,
                db_url="postgresql+asyncpg://test",
            )

        expected_key = f"{WORD_AUDIO_S3_PREFIX}/{word_entry_id}.mp3"
        assert word_entry.audio_key == expected_key
        from src.db.models import AudioStatus

        assert word_entry.audio_status == AudioStatus.READY

    async def test_correct_s3_key_for_lemma(self):
        """S3 key for lemma follows pattern word-audio/{id}.mp3."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(lemma="σπίτι", examples=[])
        word_entry.id = word_entry_id
        mock_session = make_mock_session(word_entry)
        mock_engine, mock_session_factory = make_mock_engine(mock_session)

        mock_elevenlabs = AsyncMock()
        mock_elevenlabs.generate_speech = AsyncMock(return_value=b"audio")
        mock_s3 = MagicMock()
        mock_s3.upload_object = MagicMock(return_value=True)

        with (
            patch("src.tasks.background.create_async_engine", return_value=mock_engine),
            patch("src.tasks.background.async_sessionmaker", return_value=mock_session_factory),
            patch("src.tasks.background.settings") as mock_settings,
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.services.s3_service.get_s3_service", return_value=mock_s3),
        ):
            mock_settings.feature_background_tasks = True
            mock_settings.elevenlabs_configured = True
            mock_settings.is_production = False

            await generate_word_entry_part_audio_task(
                word_entry_id=word_entry_id,
                part="lemma",
                text="σπίτι",
                example_id=None,
                db_url="postgresql+asyncpg://test",
            )

        expected_key = f"{WORD_AUDIO_S3_PREFIX}/{word_entry_id}.mp3"
        mock_s3.upload_object.assert_called_once_with(expected_key, b"audio", "audio/mpeg")

    async def test_correct_voice_id_used(self):
        """TTS is called with the correct WORD_AUDIO_VOICE_ID."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(lemma="σπίτι", examples=[])
        word_entry.id = word_entry_id
        mock_session = make_mock_session(word_entry)
        mock_engine, mock_session_factory = make_mock_engine(mock_session)

        mock_elevenlabs = AsyncMock()
        mock_elevenlabs.generate_speech = AsyncMock(return_value=b"audio")
        mock_s3 = MagicMock()
        mock_s3.upload_object = MagicMock(return_value=True)

        with (
            patch("src.tasks.background.create_async_engine", return_value=mock_engine),
            patch("src.tasks.background.async_sessionmaker", return_value=mock_session_factory),
            patch("src.tasks.background.settings") as mock_settings,
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.services.s3_service.get_s3_service", return_value=mock_s3),
        ):
            mock_settings.feature_background_tasks = True
            mock_settings.elevenlabs_configured = True
            mock_settings.is_production = False

            await generate_word_entry_part_audio_task(
                word_entry_id=word_entry_id,
                part="lemma",
                text="σπίτι",
                example_id=None,
                db_url="postgresql+asyncpg://test",
            )

        mock_elevenlabs.generate_speech.assert_called_once_with(
            "σπίτι", voice_id=WORD_AUDIO_VOICE_ID
        )

    async def test_audio_generating_since_cleared_on_lemma_success(self):
        """audio_generating_since is set to None after successful lemma generation."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(lemma="σπίτι", examples=[])
        word_entry.id = word_entry_id
        mock_session = make_mock_session(word_entry)
        mock_engine, mock_session_factory = make_mock_engine(mock_session)

        mock_elevenlabs = AsyncMock()
        mock_elevenlabs.generate_speech = AsyncMock(return_value=b"audio")
        mock_s3 = MagicMock()
        mock_s3.upload_object = MagicMock(return_value=True)

        with (
            patch("src.tasks.background.create_async_engine", return_value=mock_engine),
            patch("src.tasks.background.async_sessionmaker", return_value=mock_session_factory),
            patch("src.tasks.background.settings") as mock_settings,
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.services.s3_service.get_s3_service", return_value=mock_s3),
        ):
            mock_settings.feature_background_tasks = True
            mock_settings.elevenlabs_configured = True
            mock_settings.is_production = False

            await generate_word_entry_part_audio_task(
                word_entry_id=word_entry_id,
                part="lemma",
                text="σπίτι",
                example_id=None,
                db_url="postgresql+asyncpg://test",
            )

        assert word_entry.audio_generating_since is None


@pytest.mark.unit
class TestExampleHappyPath:
    async def test_example_generates_successfully(self):
        """Happy path: example TTS succeeds, JSONB updated with audio_key + status=ready."""
        word_entry_id = uuid4()
        example_id = "ex_1"
        word_entry = make_word_entry(
            lemma="σπίτι",
            audio_key="word-audio/existing.mp3",
            examples=[
                {
                    "id": example_id,
                    "greek": "Το σπίτι μου",
                    "audio_key": None,
                    "audio_status": "generating",
                }
            ],
        )
        word_entry.id = word_entry_id
        mock_session = make_mock_session(word_entry)
        mock_engine, mock_session_factory = make_mock_engine(mock_session)

        mock_elevenlabs = AsyncMock()
        mock_elevenlabs.generate_speech = AsyncMock(return_value=b"audio")
        mock_s3 = MagicMock()
        mock_s3.upload_object = MagicMock(return_value=True)

        with (
            patch("src.tasks.background.create_async_engine", return_value=mock_engine),
            patch("src.tasks.background.async_sessionmaker", return_value=mock_session_factory),
            patch("src.tasks.background.settings") as mock_settings,
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.services.s3_service.get_s3_service", return_value=mock_s3),
        ):
            mock_settings.feature_background_tasks = True
            mock_settings.elevenlabs_configured = True
            mock_settings.is_production = False

            await generate_word_entry_part_audio_task(
                word_entry_id=word_entry_id,
                part="example",
                text="Το σπίτι μου",
                example_id=example_id,
                db_url="postgresql+asyncpg://test",
            )

        expected_key = f"{WORD_AUDIO_S3_PREFIX}/{word_entry_id}/{example_id}.mp3"
        assert word_entry.examples[0]["audio_key"] == expected_key
        assert word_entry.examples[0]["audio_status"] == "ready"

    async def test_correct_s3_key_for_example(self):
        """S3 key for example follows pattern word-audio/{entry_id}/{example_id}.mp3."""
        word_entry_id = uuid4()
        example_id = "ex_abc"
        word_entry = make_word_entry(
            lemma="σπίτι",
            audio_key="word-audio/existing.mp3",
            examples=[
                {
                    "id": example_id,
                    "greek": "Το σπίτι μου",
                    "audio_key": None,
                    "audio_status": "generating",
                }
            ],
        )
        word_entry.id = word_entry_id
        mock_session = make_mock_session(word_entry)
        mock_engine, mock_session_factory = make_mock_engine(mock_session)

        mock_elevenlabs = AsyncMock()
        mock_elevenlabs.generate_speech = AsyncMock(return_value=b"audio")
        mock_s3 = MagicMock()
        mock_s3.upload_object = MagicMock(return_value=True)

        with (
            patch("src.tasks.background.create_async_engine", return_value=mock_engine),
            patch("src.tasks.background.async_sessionmaker", return_value=mock_session_factory),
            patch("src.tasks.background.settings") as mock_settings,
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.services.s3_service.get_s3_service", return_value=mock_s3),
        ):
            mock_settings.feature_background_tasks = True
            mock_settings.elevenlabs_configured = True
            mock_settings.is_production = False

            await generate_word_entry_part_audio_task(
                word_entry_id=word_entry_id,
                part="example",
                text="Το σπίτι μου",
                example_id=example_id,
                db_url="postgresql+asyncpg://test",
            )

        expected_key = f"{WORD_AUDIO_S3_PREFIX}/{word_entry_id}/{example_id}.mp3"
        mock_s3.upload_object.assert_called_once_with(expected_key, b"audio", "audio/mpeg")

    async def test_audio_generating_since_cleared_on_example_success(self):
        """audio_generating_since is cleared after successful example generation when no others generating."""
        word_entry_id = uuid4()
        example_id = "ex_1"
        word_entry = make_word_entry(
            lemma="σπίτι",
            audio_key="word-audio/existing.mp3",
            examples=[
                {
                    "id": example_id,
                    "greek": "Το σπίτι μου",
                    "audio_key": None,
                    "audio_status": "generating",
                }
            ],
        )
        word_entry.id = word_entry_id
        mock_session = make_mock_session(word_entry)
        mock_engine, mock_session_factory = make_mock_engine(mock_session)

        mock_elevenlabs = AsyncMock()
        mock_elevenlabs.generate_speech = AsyncMock(return_value=b"audio")
        mock_s3 = MagicMock()
        mock_s3.upload_object = MagicMock(return_value=True)

        with (
            patch("src.tasks.background.create_async_engine", return_value=mock_engine),
            patch("src.tasks.background.async_sessionmaker", return_value=mock_session_factory),
            patch("src.tasks.background.settings") as mock_settings,
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.services.s3_service.get_s3_service", return_value=mock_s3),
        ):
            mock_settings.feature_background_tasks = True
            mock_settings.elevenlabs_configured = True
            mock_settings.is_production = False

            await generate_word_entry_part_audio_task(
                word_entry_id=word_entry_id,
                part="example",
                text="Το σπίτι μου",
                example_id=example_id,
                db_url="postgresql+asyncpg://test",
            )

        assert word_entry.audio_generating_since is None

    async def test_audio_generating_since_preserved_when_another_part_still_generating(self):
        """audio_generating_since is NOT cleared when another part is still generating."""
        from datetime import datetime, timezone

        word_entry_id = uuid4()
        example_id = "ex_1"
        generating_since = datetime.now(timezone.utc)
        word_entry = make_word_entry(
            lemma="σπίτι",
            audio_key=None,
            # lemma still in generating state
            examples=[
                {
                    "id": example_id,
                    "greek": "Το σπίτι μου",
                    "audio_key": None,
                    "audio_status": "generating",
                }
            ],
        )
        from src.db.models import AudioStatus

        word_entry.audio_status = AudioStatus.GENERATING
        word_entry.audio_generating_since = generating_since
        word_entry.id = word_entry_id
        mock_session = make_mock_session(word_entry)
        mock_engine, mock_session_factory = make_mock_engine(mock_session)

        mock_elevenlabs = AsyncMock()
        mock_elevenlabs.generate_speech = AsyncMock(return_value=b"audio")
        mock_s3 = MagicMock()
        mock_s3.upload_object = MagicMock(return_value=True)

        with (
            patch("src.tasks.background.create_async_engine", return_value=mock_engine),
            patch("src.tasks.background.async_sessionmaker", return_value=mock_session_factory),
            patch("src.tasks.background.settings") as mock_settings,
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.services.s3_service.get_s3_service", return_value=mock_s3),
        ):
            mock_settings.feature_background_tasks = True
            mock_settings.elevenlabs_configured = True
            mock_settings.is_production = False

            # Completing example, but lemma is still generating
            await generate_word_entry_part_audio_task(
                word_entry_id=word_entry_id,
                part="example",
                text="Το σπίτι μου",
                example_id=example_id,
                db_url="postgresql+asyncpg://test",
            )

        # audio_generating_since should NOT be cleared since lemma is still generating
        assert word_entry.audio_generating_since == generating_since


@pytest.mark.unit
class TestFailurePaths:
    async def test_tts_failure_sets_lemma_status_failed(self):
        """TTS failure sets lemma audio_status to FAILED."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(lemma="σπίτι", examples=[])
        word_entry.id = word_entry_id
        mock_session = make_mock_session(word_entry)
        mock_engine, mock_session_factory = make_mock_engine(mock_session)

        mock_elevenlabs = AsyncMock()
        mock_elevenlabs.generate_speech = AsyncMock(side_effect=Exception("TTS failed"))
        mock_s3 = MagicMock()

        with (
            patch("src.tasks.background.create_async_engine", return_value=mock_engine),
            patch("src.tasks.background.async_sessionmaker", return_value=mock_session_factory),
            patch("src.tasks.background.settings") as mock_settings,
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.services.s3_service.get_s3_service", return_value=mock_s3),
        ):
            mock_settings.feature_background_tasks = True
            mock_settings.elevenlabs_configured = True
            mock_settings.is_production = False

            await generate_word_entry_part_audio_task(
                word_entry_id=word_entry_id,
                part="lemma",
                text="σπίτι",
                example_id=None,
                db_url="postgresql+asyncpg://test",
            )

        from src.db.models import AudioStatus

        assert word_entry.audio_status == AudioStatus.FAILED

    async def test_s3_failure_sets_lemma_status_failed(self):
        """S3 upload failure sets lemma audio_status to FAILED."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(lemma="σπίτι", examples=[])
        word_entry.id = word_entry_id
        mock_session = make_mock_session(word_entry)
        mock_engine, mock_session_factory = make_mock_engine(mock_session)

        mock_elevenlabs = AsyncMock()
        mock_elevenlabs.generate_speech = AsyncMock(return_value=b"audio")
        mock_s3 = MagicMock()
        mock_s3.upload_object = MagicMock(return_value=False)  # upload fails

        with (
            patch("src.tasks.background.create_async_engine", return_value=mock_engine),
            patch("src.tasks.background.async_sessionmaker", return_value=mock_session_factory),
            patch("src.tasks.background.settings") as mock_settings,
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.services.s3_service.get_s3_service", return_value=mock_s3),
        ):
            mock_settings.feature_background_tasks = True
            mock_settings.elevenlabs_configured = True
            mock_settings.is_production = False

            await generate_word_entry_part_audio_task(
                word_entry_id=word_entry_id,
                part="lemma",
                text="σπίτι",
                example_id=None,
                db_url="postgresql+asyncpg://test",
            )

        from src.db.models import AudioStatus

        assert word_entry.audio_status == AudioStatus.FAILED

    async def test_audio_generating_since_cleared_on_failure(self):
        """audio_generating_since is cleared even after TTS failure."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(lemma="σπίτι", examples=[])
        word_entry.id = word_entry_id
        mock_session = make_mock_session(word_entry)
        mock_engine, mock_session_factory = make_mock_engine(mock_session)

        mock_elevenlabs = AsyncMock()
        mock_elevenlabs.generate_speech = AsyncMock(side_effect=Exception("TTS failed"))
        mock_s3 = MagicMock()

        with (
            patch("src.tasks.background.create_async_engine", return_value=mock_engine),
            patch("src.tasks.background.async_sessionmaker", return_value=mock_session_factory),
            patch("src.tasks.background.settings") as mock_settings,
            patch(
                "src.services.elevenlabs_service.get_elevenlabs_service",
                return_value=mock_elevenlabs,
            ),
            patch("src.services.s3_service.get_s3_service", return_value=mock_s3),
        ):
            mock_settings.feature_background_tasks = True
            mock_settings.elevenlabs_configured = True
            mock_settings.is_production = False

            await generate_word_entry_part_audio_task(
                word_entry_id=word_entry_id,
                part="lemma",
                text="σπίτι",
                example_id=None,
                db_url="postgresql+asyncpg://test",
            )

        assert word_entry.audio_generating_since is None
