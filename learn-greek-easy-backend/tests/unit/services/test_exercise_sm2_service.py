"""Unit tests for ExerciseSM2Service PostHog event firing."""

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.db.models import CardStatus, DeckLevel, ExerciseModality, ExerciseSourceType
from src.services.exercise_sm2_service import ExerciseSM2Service


def _make_mock_exercise(
    source_type: ExerciseSourceType = ExerciseSourceType.DESCRIPTION,
) -> MagicMock:
    exercise = MagicMock()
    exercise.id = uuid4()
    exercise.source_type = source_type
    return exercise


def _make_mock_record(status: CardStatus = CardStatus.NEW) -> MagicMock:
    record = MagicMock()
    record.id = uuid4()
    record.status = status
    record.easiness_factor = 2.5
    record.interval = 0
    record.repetitions = 0
    record.created_at = None
    return record


def _make_mock_record_updated(
    status: CardStatus = CardStatus.LEARNING,
    easiness_factor: float = 2.5,
    interval: int = 1,
    repetitions: int = 1,
) -> MagicMock:
    record = MagicMock()
    record.id = uuid4()
    record.status = status
    record.easiness_factor = easiness_factor
    record.interval = interval
    record.repetitions = repetitions
    return record


def _make_sm2_result(new_status: CardStatus = CardStatus.LEARNING) -> MagicMock:
    result = MagicMock()
    result.new_easiness_factor = 2.5
    result.new_interval = 1
    result.new_repetitions = 1
    result.new_status = new_status
    return result


@pytest.mark.unit
class TestExerciseSM2ServicePostHogEvents:
    """Tests that verify PostHog capture_event is fired (or not) based on mastery transitions."""

    @pytest.mark.asyncio
    async def test_mastery_transition_fires_exercise_mastered_event(self, mock_db_session):
        """REVIEW → MASTERED transition should fire exercise_mastered event."""
        mock_exercise = _make_mock_exercise()
        mock_record = _make_mock_record(status=CardStatus.REVIEW)
        mock_record_updated = _make_mock_record_updated(status=CardStatus.MASTERED)
        sm2_result = _make_sm2_result(new_status=CardStatus.MASTERED)
        user_id = uuid4()
        exercise_id = mock_exercise.id

        service = ExerciseSM2Service(mock_db_session)
        service.record_repo.get_or_create = AsyncMock(return_value=(mock_record, False))
        service.record_repo.update_sm2_data = AsyncMock(return_value=mock_record_updated)
        service.review_repo.create_review = AsyncMock(return_value=MagicMock())

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_exercise
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        with (
            patch("src.services.exercise_sm2_service.calculate_sm2", return_value=sm2_result),
            patch(
                "src.services.exercise_sm2_service.calculate_next_review_date",
                return_value=date.today(),
            ),
            patch("src.services.exercise_sm2_service.capture_event") as mock_capture,
        ):
            await service.process_review(
                user_id=user_id,
                exercise_id=exercise_id,
                score=5,
                max_score=5,
            )

        mock_capture.assert_called_once()
        call_kwargs = mock_capture.call_args.kwargs
        assert call_kwargs["event"] == "exercise_mastered"
        assert call_kwargs["distinct_id"] == str(user_id)
        assert call_kwargs["properties"]["exercise_id"] == str(exercise_id)
        assert call_kwargs["properties"]["source_type"] == mock_exercise.source_type.value

    @pytest.mark.asyncio
    async def test_already_mastered_does_not_fire_event(self, mock_db_session):
        """MASTERED → MASTERED (re-review) should NOT fire event."""
        mock_exercise = _make_mock_exercise()
        mock_record = _make_mock_record(status=CardStatus.MASTERED)
        mock_record_updated = _make_mock_record_updated(status=CardStatus.MASTERED)
        sm2_result = _make_sm2_result(new_status=CardStatus.MASTERED)
        user_id = uuid4()
        exercise_id = mock_exercise.id

        service = ExerciseSM2Service(mock_db_session)
        service.record_repo.get_or_create = AsyncMock(return_value=(mock_record, False))
        service.record_repo.update_sm2_data = AsyncMock(return_value=mock_record_updated)
        service.review_repo.create_review = AsyncMock(return_value=MagicMock())

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_exercise
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        with (
            patch("src.services.exercise_sm2_service.calculate_sm2", return_value=sm2_result),
            patch(
                "src.services.exercise_sm2_service.calculate_next_review_date",
                return_value=date.today(),
            ),
            patch("src.services.exercise_sm2_service.capture_event") as mock_capture,
        ):
            await service.process_review(
                user_id=user_id,
                exercise_id=exercise_id,
                score=5,
                max_score=5,
            )

        mock_capture.assert_not_called()

    @pytest.mark.asyncio
    async def test_non_mastery_transition_does_not_fire_event(self, mock_db_session):
        """NEW → LEARNING transition should NOT fire event."""
        mock_exercise = _make_mock_exercise()
        mock_record = _make_mock_record(status=CardStatus.NEW)
        mock_record_updated = _make_mock_record_updated(status=CardStatus.LEARNING)
        sm2_result = _make_sm2_result(new_status=CardStatus.LEARNING)
        user_id = uuid4()
        exercise_id = mock_exercise.id

        service = ExerciseSM2Service(mock_db_session)
        service.record_repo.get_or_create = AsyncMock(return_value=(mock_record, False))
        service.record_repo.update_sm2_data = AsyncMock(return_value=mock_record_updated)
        service.review_repo.create_review = AsyncMock(return_value=MagicMock())

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_exercise
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        with (
            patch("src.services.exercise_sm2_service.calculate_sm2", return_value=sm2_result),
            patch(
                "src.services.exercise_sm2_service.calculate_next_review_date",
                return_value=date.today(),
            ),
            patch("src.services.exercise_sm2_service.capture_event") as mock_capture,
        ):
            await service.process_review(
                user_id=user_id,
                exercise_id=exercise_id,
                score=3,
                max_score=5,
            )

        mock_capture.assert_not_called()


def _make_de_exercise(
    modality: ExerciseModality,
    audio_level: DeckLevel,
    *,
    text_el: str = "Ο Γιάννης.",
    text_el_a2: str | None = None,
    audio_s3_key: str = "b1/audio.mp3",
    audio_a2_s3_key: str = "a2/audio.mp3",
    audio_duration_seconds: float = 10.0,
    audio_a2_duration_seconds: float = 8.0,
    word_timestamps: list | None = None,
    word_timestamps_a2: list | None = None,
) -> MagicMock:
    desc = MagicMock()
    desc.text_el = text_el
    desc.text_el_a2 = text_el_a2
    desc.audio_s3_key = audio_s3_key
    desc.audio_a2_s3_key = audio_a2_s3_key
    desc.audio_duration_seconds = audio_duration_seconds
    desc.audio_a2_duration_seconds = audio_a2_duration_seconds
    desc.word_timestamps = word_timestamps if word_timestamps is not None else []
    desc.word_timestamps_a2 = word_timestamps_a2 if word_timestamps_a2 is not None else []
    desc.situation = MagicMock()
    desc.situation.id = uuid4()
    desc.situation.scenario_el = "scenario"
    desc.situation.scenario_en = "scenario"
    desc.situation.scenario_ru = "scenario"

    de = MagicMock()
    de.modality = modality
    de.audio_level = audio_level
    de.description = desc
    de.items = []
    de.exercise_type = MagicMock()

    exercise = MagicMock()
    exercise.id = uuid4()
    exercise.description_exercise = de
    return exercise


def _mock_db_for_enrichment(mock_db_session, exercises: list) -> None:
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = exercises
    mock_db_session.execute = AsyncMock(return_value=mock_result)


@pytest.mark.unit
class TestLoadDescriptionEnrichment:
    """Tests for per-row A2/B1 and modality-aware content branching."""

    @pytest.mark.asyncio
    async def test_a2_listening_returns_a2_audio_no_text(self, mock_db_session):
        exercise = _make_de_exercise(ExerciseModality.LISTENING, DeckLevel.A2)
        _mock_db_for_enrichment(mock_db_session, [exercise])

        service = ExerciseSM2Service(mock_db_session)
        with patch("src.services.exercise_sm2_service.get_s3_service") as mock_s3:
            mock_s3.return_value.generate_presigned_url.side_effect = lambda k: f"https://cdn/{k}"
            result = await service.load_description_enrichment([exercise.id])

        data = result[exercise.id]
        assert data["description_audio_url"] is not None
        assert "a2" in data["description_audio_url"]
        assert data["description_text_el"] is None
        assert data["word_timestamps"] is None

    @pytest.mark.asyncio
    async def test_b1_listening_returns_b1_audio_no_text(self, mock_db_session):
        exercise = _make_de_exercise(ExerciseModality.LISTENING, DeckLevel.B1)
        _mock_db_for_enrichment(mock_db_session, [exercise])

        service = ExerciseSM2Service(mock_db_session)
        with patch("src.services.exercise_sm2_service.get_s3_service") as mock_s3:
            mock_s3.return_value.generate_presigned_url.side_effect = lambda k: f"https://cdn/{k}"
            result = await service.load_description_enrichment([exercise.id])

        data = result[exercise.id]
        assert data["description_audio_url"] is not None
        assert "b1" in data["description_audio_url"]
        assert data["description_text_el"] is None
        assert data["word_timestamps"] is None

    @pytest.mark.asyncio
    async def test_a2_reading_returns_a2_text_no_audio(self, mock_db_session):
        exercise = _make_de_exercise(
            ExerciseModality.READING,
            DeckLevel.A2,
            text_el_a2="A2 text",
        )
        _mock_db_for_enrichment(mock_db_session, [exercise])

        service = ExerciseSM2Service(mock_db_session)
        with patch("src.services.exercise_sm2_service.get_s3_service") as mock_s3:
            mock_s3.return_value.generate_presigned_url.side_effect = lambda k: f"https://cdn/{k}"
            result = await service.load_description_enrichment([exercise.id])

        data = result[exercise.id]
        assert data["description_text_el"] == "A2 text"
        assert data["description_audio_url"] is None
        assert data["description_audio_duration"] is None
        assert data["word_timestamps"] is None

    @pytest.mark.asyncio
    async def test_b1_reading_returns_b1_text_no_audio(self, mock_db_session):
        exercise = _make_de_exercise(ExerciseModality.READING, DeckLevel.B1)
        _mock_db_for_enrichment(mock_db_session, [exercise])

        service = ExerciseSM2Service(mock_db_session)
        with patch("src.services.exercise_sm2_service.get_s3_service") as mock_s3:
            mock_s3.return_value.generate_presigned_url.side_effect = lambda k: f"https://cdn/{k}"
            result = await service.load_description_enrichment([exercise.id])

        data = result[exercise.id]
        assert data["description_text_el"] == "Ο Γιάννης."
        assert data["description_audio_url"] is None
        assert data["description_audio_duration"] is None
        assert data["word_timestamps"] is None

    @pytest.mark.asyncio
    async def test_a2_falls_back_to_b1_text_when_a2_text_null(self, mock_db_session):
        exercise = _make_de_exercise(
            ExerciseModality.READING,
            DeckLevel.A2,
            text_el="B1 fallback text",
            text_el_a2=None,
        )
        _mock_db_for_enrichment(mock_db_session, [exercise])

        service = ExerciseSM2Service(mock_db_session)
        with patch("src.services.exercise_sm2_service.get_s3_service") as mock_s3:
            mock_s3.return_value.generate_presigned_url.side_effect = lambda k: f"https://cdn/{k}"
            result = await service.load_description_enrichment([exercise.id])

        data = result[exercise.id]
        assert data["description_text_el"] == "B1 fallback text"
        assert data["description_audio_url"] is None
