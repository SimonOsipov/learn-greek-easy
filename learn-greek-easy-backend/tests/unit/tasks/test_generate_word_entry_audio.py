"""Unit tests for generate_word_entry_audio_task background task."""

from unittest.mock import AsyncMock, MagicMock, call, patch
from uuid import uuid4

from src.tasks.background import (
    WORD_AUDIO_S3_PREFIX,
    WORD_AUDIO_VOICE_ID,
    generate_word_entry_audio_task,
)


def make_mock_session(word_entry):
    """Create a mock async session that returns the given word_entry."""
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = word_entry
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.commit = AsyncMock()
    mock_session.close = AsyncMock()
    return mock_session


def make_mock_engine(mock_session):
    """Create mock engine + sessionmaker pointing to mock_session."""
    mock_engine = AsyncMock()
    mock_sessionmaker = MagicMock(return_value=mock_session)
    return mock_engine, mock_sessionmaker


def make_word_entry(
    lemma="σπίτι",
    audio_key=None,
    examples=None,
):
    """Create a mock WordEntry ORM instance."""
    entry = MagicMock()
    entry.id = uuid4()
    entry.lemma = lemma
    entry.audio_key = audio_key
    if examples is None:
        examples = [
            {"id": "ex_1", "greek": "Το σπίτι μου", "audio_key": None},
            {"id": "ex_2", "greek": "Μεγάλο σπίτι", "audio_key": None},
        ]
    entry.examples = examples
    return entry


FULL_PATCHES = [
    "src.tasks.background.create_async_engine",
    "src.tasks.background.async_sessionmaker",
    "src.tasks.background.settings",
]


class TestConstants:
    def test_word_audio_s3_prefix_constant(self):
        assert WORD_AUDIO_S3_PREFIX == "word-audio"

    def test_word_audio_voice_id_constant(self):
        assert WORD_AUDIO_VOICE_ID is not None
        assert isinstance(WORD_AUDIO_VOICE_ID, str)
        assert len(WORD_AUDIO_VOICE_ID) > 0


class TestGateChecks:
    async def test_task_skips_when_background_tasks_disabled(self):
        """When is_background_tasks_enabled() returns False, task returns immediately."""
        with (
            patch("src.tasks.background.settings") as mock_settings,
            patch("src.tasks.background.create_async_engine") as mock_engine_factory,
        ):
            mock_settings.feature_background_tasks = False
            mock_settings.elevenlabs_configured = True

            await generate_word_entry_audio_task(
                word_entry_id=uuid4(),
                lemma="σπίτι",
                examples=[],
                db_url="postgresql+asyncpg://test",
            )

            mock_engine_factory.assert_not_called()

    async def test_task_skips_when_elevenlabs_not_configured(self):
        """When elevenlabs_configured is False, task logs warning and returns."""
        with (
            patch("src.tasks.background.settings") as mock_settings,
            patch("src.tasks.background.create_async_engine") as mock_engine_factory,
        ):
            mock_settings.feature_background_tasks = True
            mock_settings.elevenlabs_configured = False

            await generate_word_entry_audio_task(
                word_entry_id=uuid4(),
                lemma="σπίτι",
                examples=[],
                db_url="postgresql+asyncpg://test",
            )

            mock_engine_factory.assert_not_called()


class TestLemmaAudioGeneration:
    async def test_task_generates_lemma_audio(self):
        """Happy path: TTS called with lemma and voice_id, S3 upload called, audio_key set."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(lemma="σπίτι", audio_key=None, examples=[])
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

            await generate_word_entry_audio_task(
                word_entry_id=word_entry_id,
                lemma="σπίτι",
                examples=[],
                db_url="postgresql+asyncpg://test",
            )

        mock_elevenlabs.generate_speech.assert_called_once_with(
            "σπίτι", voice_id=WORD_AUDIO_VOICE_ID
        )
        expected_s3_key = f"{WORD_AUDIO_S3_PREFIX}/{word_entry_id}.mp3"
        mock_s3.upload_object.assert_called_once_with(expected_s3_key, b"audio-bytes", "audio/mpeg")
        assert word_entry.audio_key == expected_s3_key
        assert mock_session.commit.call_count == 2

    async def test_task_lemma_tts_failure_continues_to_examples(self):
        """When lemma TTS raises, task logs error and continues to process examples."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(
            lemma="σπίτι",
            audio_key=None,
            examples=[{"id": "ex_1", "greek": "Το σπίτι μου", "audio_key": None}],
        )
        word_entry.id = word_entry_id
        mock_session = make_mock_session(word_entry)
        mock_engine, mock_session_factory = make_mock_engine(mock_session)

        mock_elevenlabs = AsyncMock()
        # Fail on first call (lemma), succeed on second (example)
        mock_elevenlabs.generate_speech = AsyncMock(
            side_effect=[Exception("TTS failed"), b"example-audio"]
        )
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

            await generate_word_entry_audio_task(
                word_entry_id=word_entry_id,
                lemma="σπίτι",
                examples=[{"id": "ex_1", "greek": "Το σπίτι μου"}],
                db_url="postgresql+asyncpg://test",
            )

        # Both TTS calls were attempted
        assert mock_elevenlabs.generate_speech.call_count == 2
        # Example was still uploaded despite lemma failure
        assert mock_s3.upload_object.call_count == 1

    async def test_task_lemma_s3_upload_failure_continues(self):
        """When S3 returns False for lemma, error logged and example processing continues."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(
            lemma="σπίτι",
            audio_key=None,
            examples=[{"id": "ex_1", "greek": "Το σπίτι μου", "audio_key": None}],
        )
        word_entry.id = word_entry_id
        mock_session = make_mock_session(word_entry)
        mock_engine, mock_session_factory = make_mock_engine(mock_session)

        mock_elevenlabs = AsyncMock()
        mock_elevenlabs.generate_speech = AsyncMock(return_value=b"audio")
        mock_s3 = MagicMock()
        # Fail on lemma upload, succeed on example upload
        mock_s3.upload_object = MagicMock(side_effect=[False, True])

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

            await generate_word_entry_audio_task(
                word_entry_id=word_entry_id,
                lemma="σπίτι",
                examples=[{"id": "ex_1", "greek": "Το σπίτι μου"}],
                db_url="postgresql+asyncpg://test",
            )

        # Both upload attempts were made
        assert mock_s3.upload_object.call_count == 2


class TestExampleAudioGeneration:
    async def test_task_generates_example_audio(self):
        """Happy path: TTS called for each example with correct S3 key format."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(
            lemma="σπίτι",
            audio_key="word-audio/existing.mp3",  # has audio, text matches -> lemma skipped
            examples=[
                {"id": "ex_1", "greek": "Το σπίτι μου", "audio_key": None},
                {"id": "ex_2", "greek": "Μεγάλο σπίτι", "audio_key": None},
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

            await generate_word_entry_audio_task(
                word_entry_id=word_entry_id,
                lemma="σπίτι",
                examples=[
                    {"id": "ex_1", "greek": "Το σπίτι μου"},
                    {"id": "ex_2", "greek": "Μεγάλο σπίτι"},
                ],
                db_url="postgresql+asyncpg://test",
            )

        assert mock_elevenlabs.generate_speech.call_count == 2
        expected_calls = [
            call("Το σπίτι μου", voice_id=WORD_AUDIO_VOICE_ID),
            call("Μεγάλο σπίτι", voice_id=WORD_AUDIO_VOICE_ID),
        ]
        mock_elevenlabs.generate_speech.assert_has_calls(expected_calls)
        upload_calls = [c.args[0] for c in mock_s3.upload_object.call_args_list]
        assert f"{WORD_AUDIO_S3_PREFIX}/{word_entry_id}/ex_1.mp3" in upload_calls
        assert f"{WORD_AUDIO_S3_PREFIX}/{word_entry_id}/ex_2.mp3" in upload_calls

    async def test_task_example_tts_failure_does_not_abort(self):
        """TTS failure on one example doesn't abort processing of next example."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(
            lemma="σπίτι",
            audio_key="existing.mp3",
            examples=[
                {"id": "ex_1", "greek": "First example", "audio_key": None},
                {"id": "ex_2", "greek": "Second example", "audio_key": None},
            ],
        )
        word_entry.id = word_entry_id
        mock_session = make_mock_session(word_entry)
        mock_engine, mock_session_factory = make_mock_engine(mock_session)

        mock_elevenlabs = AsyncMock()
        mock_elevenlabs.generate_speech = AsyncMock(side_effect=[Exception("TTS failed"), b"audio"])
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

            await generate_word_entry_audio_task(
                word_entry_id=word_entry_id,
                lemma="σπίτι",
                examples=[
                    {"id": "ex_1", "greek": "First example"},
                    {"id": "ex_2", "greek": "Second example"},
                ],
                db_url="postgresql+asyncpg://test",
            )

        assert mock_elevenlabs.generate_speech.call_count == 2
        assert mock_s3.upload_object.call_count == 1

    async def test_task_example_without_id_skipped(self):
        """Examples missing id are silently skipped (no TTS call)."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(lemma="σπίτι", audio_key=None, examples=[])
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

            await generate_word_entry_audio_task(
                word_entry_id=word_entry_id,
                lemma="σπίτι",
                examples=[{"greek": "No id here"}],  # no 'id' key
                db_url="postgresql+asyncpg://test",
            )

        # Only lemma TTS was called (for the word entry itself)
        # The example without id was skipped
        mock_elevenlabs.generate_speech.assert_called_once_with(
            "σπίτι", voice_id=WORD_AUDIO_VOICE_ID
        )

    async def test_task_example_without_greek_skipped(self):
        """Examples missing greek text are silently skipped."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(lemma="σπίτι", audio_key=None, examples=[])
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

            await generate_word_entry_audio_task(
                word_entry_id=word_entry_id,
                lemma="σπίτι",
                examples=[{"id": "ex_1"}],  # has id but no 'greek'
                db_url="postgresql+asyncpg://test",
            )

        mock_elevenlabs.generate_speech.assert_called_once_with(
            "σπίτι", voice_id=WORD_AUDIO_VOICE_ID
        )


class TestSkipIfUnchanged:
    async def test_task_skips_lemma_when_text_unchanged_and_audio_exists(self):
        """TTS NOT called for lemma when DB lemma matches and audio_key exists."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(
            lemma="σπίτι", audio_key="word-audio/existing.mp3", examples=[]
        )
        word_entry.id = word_entry_id
        mock_session = make_mock_session(word_entry)
        mock_engine, mock_session_factory = make_mock_engine(mock_session)

        mock_elevenlabs = AsyncMock()
        mock_elevenlabs.generate_speech = AsyncMock(return_value=b"audio")
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

            await generate_word_entry_audio_task(
                word_entry_id=word_entry_id,
                lemma="σπίτι",  # same as DB
                examples=[],
                db_url="postgresql+asyncpg://test",
            )

        mock_elevenlabs.generate_speech.assert_not_called()
        assert mock_session.commit.call_count == 2

    async def test_task_generates_lemma_when_text_changed(self):
        """TTS IS called when DB lemma differs from incoming lemma."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(
            lemma="σπίτι", audio_key="word-audio/existing.mp3", examples=[]
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

            await generate_word_entry_audio_task(
                word_entry_id=word_entry_id,
                lemma="σπίτια",  # DIFFERENT from DB "σπίτι"
                examples=[],
                db_url="postgresql+asyncpg://test",
            )

        mock_elevenlabs.generate_speech.assert_called_once()

    async def test_task_generates_lemma_when_audio_key_missing(self):
        """TTS IS called when audio_key is None even if text matches."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(lemma="σπίτι", audio_key=None, examples=[])
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

            await generate_word_entry_audio_task(
                word_entry_id=word_entry_id,
                lemma="σπίτι",
                examples=[],
                db_url="postgresql+asyncpg://test",
            )

        mock_elevenlabs.generate_speech.assert_called_once()

    async def test_task_skips_example_when_greek_unchanged_and_audio_exists(self):
        """TTS NOT called for example when greek matches existing and audio_key exists."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(
            lemma="σπίτι",
            audio_key="word-audio/existing.mp3",
            examples=[{"id": "ex_1", "greek": "Αμετάβλητο", "audio_key": "word-audio/x/ex_1.mp3"}],
        )
        word_entry.id = word_entry_id
        mock_session = make_mock_session(word_entry)
        mock_engine, mock_session_factory = make_mock_engine(mock_session)

        mock_elevenlabs = AsyncMock()
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

            await generate_word_entry_audio_task(
                word_entry_id=word_entry_id,
                lemma="σπίτι",  # unchanged + has audio -> skip lemma
                examples=[{"id": "ex_1", "greek": "Αμετάβλητο"}],  # unchanged + has audio -> skip
                db_url="postgresql+asyncpg://test",
            )

        mock_elevenlabs.generate_speech.assert_not_called()

    async def test_task_generates_example_when_greek_changed(self):
        """TTS IS called for example when greek text differs."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(
            lemma="σπίτι",
            audio_key="word-audio/existing.mp3",
            examples=[
                {"id": "ex_1", "greek": "Παλιό κείμενο", "audio_key": "word-audio/x/ex_1.mp3"}
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

            await generate_word_entry_audio_task(
                word_entry_id=word_entry_id,
                lemma="σπίτι",
                examples=[{"id": "ex_1", "greek": "Νέο κείμενο"}],  # DIFFERENT greek
                db_url="postgresql+asyncpg://test",
            )

        mock_elevenlabs.generate_speech.assert_called_once_with(
            "Νέο κείμενο", voice_id=WORD_AUDIO_VOICE_ID
        )

    async def test_task_generates_for_new_example_not_in_db(self):
        """TTS IS called for incoming example id with no match in existing DB."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(
            lemma="σπίτι",
            audio_key="word-audio/existing.mp3",
            examples=[
                {"id": "ex_old", "greek": "Old example", "audio_key": "word-audio/x/ex_old.mp3"}
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

            await generate_word_entry_audio_task(
                word_entry_id=word_entry_id,
                lemma="σπίτι",
                examples=[{"id": "ex_new", "greek": "Brand new example"}],  # NEW id, not in DB
                db_url="postgresql+asyncpg://test",
            )

        mock_elevenlabs.generate_speech.assert_called_once_with(
            "Brand new example", voice_id=WORD_AUDIO_VOICE_ID
        )

    async def test_task_mixed_skip_and_generate(self):
        """Word entry with 3 examples: one unchanged (skipped), one changed, one new."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(
            lemma="σπίτι",
            audio_key="word-audio/existing.mp3",
            examples=[
                {"id": "ex_1", "greek": "Unchanged text", "audio_key": "word-audio/x/ex_1.mp3"},
                {"id": "ex_2", "greek": "Old text", "audio_key": "word-audio/x/ex_2.mp3"},
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

            await generate_word_entry_audio_task(
                word_entry_id=word_entry_id,
                lemma="σπίτι",
                examples=[
                    {"id": "ex_1", "greek": "Unchanged text"},  # skip (unchanged + has audio)
                    {"id": "ex_2", "greek": "New text"},  # generate (text changed)
                    {"id": "ex_3", "greek": "Brand new"},  # generate (new id)
                ],
                db_url="postgresql+asyncpg://test",
            )

        # 2 generated (ex_2 changed, ex_3 new), 1 skipped (ex_1 unchanged)
        assert mock_elevenlabs.generate_speech.call_count == 2


class TestDbUpdate:
    async def test_task_updates_word_entry_audio_key(self):
        """After successful lemma audio, word_entry.audio_key set to correct S3 key."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(lemma="σπίτι", audio_key=None, examples=[])
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

            await generate_word_entry_audio_task(
                word_entry_id=word_entry_id,
                lemma="σπίτι",
                examples=[],
                db_url="postgresql+asyncpg://test",
            )

        assert word_entry.audio_key == f"{WORD_AUDIO_S3_PREFIX}/{word_entry_id}.mp3"
        assert mock_session.commit.call_count == 2

    async def test_task_updates_example_audio_keys_in_jsonb(self):
        """After successful example audio, JSONB is fully reassigned with new audio_keys."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(
            lemma="σπίτι",
            audio_key="word-audio/existing.mp3",
            examples=[
                {"id": "ex_1", "greek": "Example text", "audio_key": None},
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

            await generate_word_entry_audio_task(
                word_entry_id=word_entry_id,
                lemma="σπίτι",
                examples=[{"id": "ex_1", "greek": "Example text"}],
                db_url="postgresql+asyncpg://test",
            )

        # Full JSONB reassignment should have occurred
        expected_key = f"{WORD_AUDIO_S3_PREFIX}/{word_entry_id}/ex_1.mp3"
        assert word_entry.examples[0]["audio_key"] == expected_key
        assert mock_session.commit.call_count == 2

    async def test_task_all_skipped_no_db_update(self):
        """When all items are skipped, no DB commit occurs."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(
            lemma="σπίτι",
            audio_key="word-audio/existing.mp3",
            examples=[
                {"id": "ex_1", "greek": "Unchanged", "audio_key": "word-audio/x/ex_1.mp3"},
            ],
        )
        word_entry.id = word_entry_id
        mock_session = make_mock_session(word_entry)
        mock_engine, mock_session_factory = make_mock_engine(mock_session)

        mock_elevenlabs = AsyncMock()
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

            await generate_word_entry_audio_task(
                word_entry_id=word_entry_id,
                lemma="σπίτι",
                examples=[{"id": "ex_1", "greek": "Unchanged"}],
                db_url="postgresql+asyncpg://test",
            )

        assert mock_session.commit.call_count == 2

    async def test_task_word_entry_not_found_returns_gracefully(self):
        """If word entry deleted before task runs, task logs error and returns."""
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None  # not found
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.close = AsyncMock()

        mock_engine = AsyncMock()
        mock_session_factory = MagicMock(return_value=mock_session)

        mock_elevenlabs = AsyncMock()
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

            await generate_word_entry_audio_task(
                word_entry_id=uuid4(),
                lemma="σπίτι",
                examples=[],
                db_url="postgresql+asyncpg://test",
            )

        mock_elevenlabs.generate_speech.assert_not_called()
        mock_engine.dispose.assert_called_once()


class TestEngineSessionLifecycle:
    async def test_task_disposes_engine_on_success(self):
        """Engine dispose() is awaited on the happy path."""
        word_entry_id = uuid4()
        word_entry = make_word_entry(lemma="σπίτι", audio_key=None, examples=[])
        word_entry.id = word_entry_id
        mock_session = make_mock_session(word_entry)
        mock_engine = AsyncMock()
        mock_session_factory = MagicMock(return_value=mock_session)

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

            await generate_word_entry_audio_task(
                word_entry_id=word_entry_id,
                lemma="σπίτι",
                examples=[],
                db_url="postgresql+asyncpg://test",
            )

        mock_engine.dispose.assert_called_once()

    async def test_task_disposes_engine_on_failure(self):
        """Engine dispose() is still called in finally even when task encounters error."""
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.side_effect = Exception("DB error")
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_session.close = AsyncMock()

        mock_engine = AsyncMock()
        mock_session_factory = MagicMock(return_value=mock_session)

        mock_elevenlabs = AsyncMock()
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

            await generate_word_entry_audio_task(
                word_entry_id=uuid4(),
                lemma="σπίτι",
                examples=[],
                db_url="postgresql+asyncpg://test",
            )

        mock_engine.dispose.assert_called_once()
