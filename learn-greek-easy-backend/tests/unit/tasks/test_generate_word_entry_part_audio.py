"""Unit tests for generate_word_entry_part_audio_task background task."""

import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.tasks.background import (
    WORD_AUDIO_S3_PREFIX,
    WORD_AUDIO_VOICE_ID,
    generate_word_entry_part_audio_task,
)


def make_mock_session(word_entry):
    """Create a mock async session that returns the given word_entry on the first
    execute call (the SELECT) and a generic result on subsequent calls (the UPDATE)."""
    mock_session = AsyncMock()

    select_result = MagicMock()
    select_result.scalar_one_or_none.return_value = word_entry

    update_result = MagicMock()

    # First call → SELECT result, subsequent calls → UPDATE result
    mock_session.execute = AsyncMock(side_effect=[select_result, update_result])
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


def get_update_params(mock_session):
    """Return the params dict passed to the second session.execute call (the UPDATE)."""
    assert (
        mock_session.execute.call_count == 2
    ), f"Expected 2 execute calls (SELECT + UPDATE), got {mock_session.execute.call_count}"
    _sql, params = mock_session.execute.call_args_list[1].args
    return params


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
        """Happy path: lemma TTS succeeds, SQL UPDATE called with success=True and correct s3_key."""
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

        params = get_update_params(mock_session)
        expected_key = f"{WORD_AUDIO_S3_PREFIX}/{word_entry_id}.mp3"
        assert params["success"] is True
        assert params["s3_key"] == expected_key
        assert params["word_entry_id"] == str(word_entry_id)

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
        """Lemma success: SQL UPDATE is called (clearing of audio_generating_since is in SQL)."""
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

        # The clearing logic lives in the SQL UPDATE — verify it was called
        assert mock_session.execute.call_count == 2
        mock_session.commit.assert_called_once()


@pytest.mark.unit
class TestExampleHappyPath:
    async def test_example_generates_successfully(self):
        """Happy path: example TTS succeeds, SQL UPDATE called with correct patch JSON."""
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

        params = get_update_params(mock_session)
        expected_key = f"{WORD_AUDIO_S3_PREFIX}/{word_entry_id}/{example_id}.mp3"
        patch_data = json.loads(params["patch"])
        assert patch_data["audio_key"] == expected_key
        assert patch_data["audio_status"] == "ready"
        assert params["example_id"] == example_id
        assert params["word_entry_id"] == str(word_entry_id)

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
        """Example success: SQL UPDATE is called (clearing of audio_generating_since is in SQL)."""
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

        # The clearing logic lives in the SQL UPDATE — verify it was called
        assert mock_session.execute.call_count == 2
        mock_session.commit.assert_called_once()

    async def test_audio_generating_since_preserved_when_another_part_still_generating(self):
        """When another part is still generating, clearing is determined by DB state via SQL.

        The audio_generating_since conditional is embedded in the atomic SQL UPDATE —
        the Python layer passes the correct parameters and the DB decides. This test
        verifies the SQL UPDATE is called with the right example_id so the DB-side
        CASE expression can check the remaining examples correctly.
        """
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

            await generate_word_entry_part_audio_task(
                word_entry_id=word_entry_id,
                part="example",
                text="Το σπίτι μου",
                example_id=example_id,
                db_url="postgresql+asyncpg://test",
            )

        # Verify the SQL UPDATE was called with the correct example_id so the
        # DB-side CASE expression can exclude the completed example when checking
        # whether any others remain in generating state.
        params = get_update_params(mock_session)
        assert params["example_id"] == example_id
        assert params["word_entry_id"] == str(word_entry_id)


@pytest.mark.unit
class TestFailurePaths:
    async def test_tts_failure_sets_lemma_status_failed(self):
        """TTS failure: SQL UPDATE called with success=False."""
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

        params = get_update_params(mock_session)
        assert params["success"] is False

    async def test_s3_failure_sets_lemma_status_failed(self):
        """S3 upload failure: SQL UPDATE called with success=False."""
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

        params = get_update_params(mock_session)
        assert params["success"] is False

    async def test_audio_generating_since_cleared_on_failure(self):
        """TTS failure: SQL UPDATE is still called (clearing is in SQL)."""
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

        # SQL UPDATE was called (which includes the audio_generating_since CASE)
        assert mock_session.execute.call_count == 2
        mock_session.commit.assert_called_once()

    async def test_example_tts_failure_sets_failed_patch(self):
        """Example TTS failure: SQL UPDATE patch contains audio_status=failed (no audio_key)."""
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
                part="example",
                text="Το σπίτι μου",
                example_id=example_id,
                db_url="postgresql+asyncpg://test",
            )

        params = get_update_params(mock_session)
        patch_data = json.loads(params["patch"])
        assert patch_data["audio_status"] == "failed"
        assert "audio_key" not in patch_data
