"""Unit tests for ExerciseSM2Service PostHog event firing."""

from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.db.models import (
    CardStatus,
    DeckLevel,
    ExerciseModality,
    ExerciseSourceType,
    ExerciseType,
)
from src.schemas.exercise_queue import ExerciseItemPayload
from src.services.exercise_sm2_service import ExerciseSM2Service
from src.services.picture_match_service import InsufficientDistractorPoolError


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
            mock_s3.return_value.generate_presigned_url.side_effect = (
                lambda k, **kwargs: f"https://cdn/{k}"
            )
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
            mock_s3.return_value.generate_presigned_url.side_effect = (
                lambda k, **kwargs: f"https://cdn/{k}"
            )
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
            mock_s3.return_value.generate_presigned_url.side_effect = (
                lambda k, **kwargs: f"https://cdn/{k}"
            )
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
            mock_s3.return_value.generate_presigned_url.side_effect = (
                lambda k, **kwargs: f"https://cdn/{k}"
            )
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
            mock_s3.return_value.generate_presigned_url.side_effect = (
                lambda k, **kwargs: f"https://cdn/{k}"
            )
            result = await service.load_description_enrichment([exercise.id])

        data = result[exercise.id]
        assert data["description_text_el"] == "B1 fallback text"
        assert data["description_audio_url"] is None


@pytest.mark.unit
class TestGetStudyQueueSummaryMode:
    """PERF-17-03: get_study_queue(summary=True) count-parity + slim payload.

    RED for the right reason today: `summary` is not yet a parameter of
    get_study_queue, so every call below raises TypeError("unexpected keyword
    argument 'summary'") until PERF-17-03 adds the kwarg.
    """

    @pytest.mark.asyncio
    async def test_summary_true_preserves_counts_on_mixed_queue(self, mock_db_session):
        """T03-1: summary=True returns identical total_due/total_new/
        total_early_practice/total_in_queue to summary=False for the same
        user/params on a due+new+early-practice mixed queue.
        """
        user_id = uuid4()

        due_record = _make_mock_record(status=CardStatus.REVIEW)
        due_record.exercise = _make_mock_exercise(source_type=ExerciseSourceType.WORD_ORDER)
        due_record.next_review_date = date.today()

        new_exercise = _make_mock_exercise(source_type=ExerciseSourceType.WORD_ORDER)

        early_record = _make_mock_record(status=CardStatus.REVIEW)
        early_record.exercise = _make_mock_exercise(source_type=ExerciseSourceType.WORD_ORDER)
        early_record.next_review_date = date.today() + timedelta(days=3)

        service = ExerciseSM2Service(mock_db_session)
        service.record_repo.get_due_exercises = AsyncMock(return_value=[due_record])
        service.record_repo.get_new_exercises = AsyncMock(return_value=[new_exercise])
        service.record_repo.get_early_practice_exercises = AsyncMock(return_value=[early_record])

        queue_full = await service.get_study_queue(
            user_id, include_early_practice=True, summary=False
        )
        queue_summary = await service.get_study_queue(
            user_id, include_early_practice=True, summary=True
        )

        assert queue_summary.total_due == queue_full.total_due == 1
        assert queue_summary.total_new == queue_full.total_new == 1
        assert queue_summary.total_early_practice == queue_full.total_early_practice == 1
        assert queue_summary.total_in_queue == queue_full.total_in_queue == 3

    @pytest.mark.asyncio
    async def test_summary_true_nulls_heavy_fields_keeps_light_fields(self, mock_db_session):
        """T03-2: summary=True nulls/empties heavy per-item fields (items,
        word_timestamps, description_text_el, description_audio_url) while
        light fields (scenario_*, modality, audio_level, exercise_type)
        stay populated exactly as enriched.
        """
        user_id = uuid4()

        due_record = _make_mock_record(status=CardStatus.REVIEW)
        due_record.exercise = _make_mock_exercise(source_type=ExerciseSourceType.DESCRIPTION)
        due_record.next_review_date = date.today()

        service = ExerciseSM2Service(mock_db_session)
        service.record_repo.get_due_exercises = AsyncMock(return_value=[due_record])
        service.record_repo.get_new_exercises = AsyncMock(return_value=[])
        service.record_repo.get_early_practice_exercises = AsyncMock(return_value=[])
        service.load_description_enrichment = AsyncMock(
            return_value={
                due_record.exercise.id: {
                    "situation_id": uuid4(),
                    "scenario_el": "Σκηνή",
                    "scenario_en": "Scene",
                    "scenario_ru": "Сцена",
                    "description_text_el": "Ο Γιάννης.",
                    "description_audio_url": "https://cdn/b1/audio.mp3",
                    "description_audio_duration": 12.5,
                    "word_timestamps": [{"word": "Ο", "start": 0.0, "end": 0.2}],
                    "items": [ExerciseItemPayload(item_index=0, payload={"a": 1})],
                    "exercise_type": ExerciseType.FILL_GAPS,
                    "modality": ExerciseModality.READING,
                    "audio_level_value": DeckLevel.B1,
                }
            }
        )

        queue = await service.get_study_queue(user_id, summary=True)

        assert len(queue.exercises) == 1
        item = queue.exercises[0]
        # Heavy fields: nulled/empty
        assert item.items == []
        assert item.word_timestamps is None
        assert item.description_text_el is None
        assert item.description_audio_url is None
        assert item.description_audio_duration is None
        # Light fields: still populated as enriched
        assert item.scenario_el == "Σκηνή"
        assert item.scenario_en == "Scene"
        assert item.scenario_ru == "Сцена"
        assert item.modality == ExerciseModality.READING
        assert item.audio_level == DeckLevel.B1
        assert item.exercise_type == ExerciseType.FILL_GAPS

    @pytest.mark.asyncio
    async def test_picture_match_drop_count_parity_across_summary_modes(self, mock_db_session):
        """T03-5: a picture-match item whose enrichment raises
        InsufficientDistractorPoolError is dropped in BOTH summary=True and
        summary=False; total_in_queue matches between modes and is strictly
        less than total_due + total_new (drop, not truncation).

        Uses the plain-Exception service-layer InsufficientDistractorPoolError
        from src.services.picture_match_service (NOT the HTTP-facing
        InsufficientDistractorPoolException in src.core.exceptions) so the
        real drop path in load_picture_match_enrichment is exercised.
        """
        user_id = uuid4()

        due_record = _make_mock_record(status=CardStatus.REVIEW)
        due_record.exercise = _make_mock_exercise(source_type=ExerciseSourceType.WORD_ORDER)
        due_record.next_review_date = date.today()

        picture_source_exercise = _make_mock_exercise(source_type=ExerciseSourceType.PICTURE)
        picture_source_exercise.picture_exercise = MagicMock()
        picture_source_exercise.picture_exercise.exercise_type = (
            ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION
        )
        picture_source_exercise.picture_exercise.picture = MagicMock()
        picture_source_exercise.picture_exercise.picture.situation_id = uuid4()

        service = ExerciseSM2Service(mock_db_session)
        service.record_repo.get_due_exercises = AsyncMock(return_value=[due_record])
        service.record_repo.get_new_exercises = AsyncMock(return_value=[picture_source_exercise])
        service.record_repo.get_early_practice_exercises = AsyncMock(return_value=[])

        # load_picture_match_enrichment's own bulk-load query: return the
        # picture exercise with its picture_exercise relation populated so
        # the code proceeds to (and fails inside) assemble_picture_match_payload.
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [picture_source_exercise]
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        with patch(
            "src.services.exercise_sm2_service.assemble_picture_match_payload",
            AsyncMock(side_effect=InsufficientDistractorPoolError()),
        ):
            queue_full = await service.get_study_queue(user_id, summary=False)
            queue_summary = await service.get_study_queue(user_id, summary=True)

        # Pre-drop counts unaffected by the drop or by summary mode.
        assert queue_full.total_due == queue_summary.total_due == 1
        assert queue_full.total_new == queue_summary.total_new == 1
        # Post-drop count-parity: the picture item is dropped in both modes.
        assert queue_full.total_in_queue == queue_summary.total_in_queue == 1
        assert queue_full.total_in_queue < queue_full.total_due + queue_full.total_new
        remaining_ids = {item.exercise_id for item in queue_full.exercises}
        assert due_record.exercise.id in remaining_ids
        assert picture_source_exercise.id not in remaining_ids

    @pytest.mark.asyncio
    async def test_summary_true_call_does_not_leak_into_subsequent_summary_false_call(
        self, mock_db_session
    ):
        """Adversarial (AC#4): summary=True and summary=False must build fully
        independent item lists per call. Calls summary=True FIRST, then
        summary=False SECOND -- the reverse of T03-1/T03-5's ordering -- so an
        in-place-mutation-across-calls/requests bug could not hide behind
        "the full call always runs first". Guards against a future caching or
        object-reuse change letting a summary=True response leak nulled heavy
        fields into the summary=False (practice-session) path.
        """
        user_id = uuid4()
        due_record = _make_mock_record(status=CardStatus.REVIEW)
        due_record.exercise = _make_mock_exercise(source_type=ExerciseSourceType.DESCRIPTION)
        due_record.next_review_date = date.today()

        service = ExerciseSM2Service(mock_db_session)
        service.record_repo.get_due_exercises = AsyncMock(return_value=[due_record])
        service.record_repo.get_new_exercises = AsyncMock(return_value=[])
        service.record_repo.get_early_practice_exercises = AsyncMock(return_value=[])
        service.load_description_enrichment = AsyncMock(
            return_value={
                due_record.exercise.id: {
                    "situation_id": uuid4(),
                    "scenario_el": "Σκηνή",
                    "scenario_en": "Scene",
                    "scenario_ru": "Сцена",
                    "description_text_el": "Ο Γιάννης.",
                    "description_audio_url": "https://cdn/b1/audio.mp3",
                    "description_audio_duration": 12.5,
                    "word_timestamps": [{"word": "Ο", "start": 0.0, "end": 0.2}],
                    "items": [ExerciseItemPayload(item_index=0, payload={"a": 1})],
                    "exercise_type": ExerciseType.FILL_GAPS,
                    "modality": ExerciseModality.READING,
                    "audio_level_value": DeckLevel.B1,
                }
            }
        )

        queue_summary_first = await service.get_study_queue(user_id, summary=True)
        queue_full_second = await service.get_study_queue(user_id, summary=False)

        # First call: heavy fields nulled as expected.
        assert queue_summary_first.exercises[0].items == []
        assert queue_summary_first.exercises[0].word_timestamps is None

        # Second call (summary=False, made AFTER the summary=True call): must
        # get the full, un-nulled payload -- proves items are rebuilt fresh
        # per call, not shared/cached/mutated-in-place across requests.
        full_item = queue_full_second.exercises[0]
        assert full_item.items != []
        assert full_item.word_timestamps == [{"word": "Ο", "start": 0.0, "end": 0.2}]
        assert full_item.description_text_el == "Ο Γιάννης."
        assert full_item.description_audio_url == "https://cdn/b1/audio.mp3"

    @pytest.mark.asyncio
    async def test_summary_false_default_path_leaves_heavy_fields_exactly_as_assembled(
        self, mock_db_session
    ):
        """Adversarial (AC#4, highest-risk): summary=False (default, unrequested)
        must return items whose heavy fields are UNCHANGED -- byte-identical to
        what enrichment/assembly produced, not merely "non-empty". Guards
        against any future refactor of _slim_to_summary's early-return branch
        partially nulling fields even when summary=False.
        """
        user_id = uuid4()
        due_record = _make_mock_record(status=CardStatus.REVIEW)
        due_record.exercise = _make_mock_exercise(source_type=ExerciseSourceType.DESCRIPTION)
        due_record.next_review_date = date.today()

        items_payload = [ExerciseItemPayload(item_index=0, payload={"a": 1})]
        word_timestamps_payload = [{"word": "Καλημέρα", "start": 0.0, "end": 0.5}]

        service = ExerciseSM2Service(mock_db_session)
        service.record_repo.get_due_exercises = AsyncMock(return_value=[due_record])
        service.record_repo.get_new_exercises = AsyncMock(return_value=[])
        service.record_repo.get_early_practice_exercises = AsyncMock(return_value=[])
        service.load_description_enrichment = AsyncMock(
            return_value={
                due_record.exercise.id: {
                    "situation_id": uuid4(),
                    "scenario_el": "Σκηνή",
                    "scenario_en": "Scene",
                    "scenario_ru": "Сцена",
                    "description_text_el": "Ο Γιάννης πήγε σχολείο.",
                    "description_audio_url": "https://cdn/b1/audio.mp3",
                    "description_audio_duration": 12.5,
                    "word_timestamps": word_timestamps_payload,
                    "items": items_payload,
                    "exercise_type": ExerciseType.FILL_GAPS,
                    "modality": ExerciseModality.LISTENING,
                    "audio_level_value": DeckLevel.B1,
                }
            }
        )

        queue = await service.get_study_queue(user_id, summary=False)

        item = queue.exercises[0]
        assert item.items == items_payload
        assert item.word_timestamps == word_timestamps_payload
        assert item.description_text_el == "Ο Γιάννης πήγε σχολείο."
        assert item.description_audio_url == "https://cdn/b1/audio.mp3"
        assert item.description_audio_duration == 12.5

    @pytest.mark.asyncio
    async def test_summary_true_mixed_modalities_no_truncation_all_light_fields_kept(
        self, mock_db_session
    ):
        """Adversarial (AC#2/AC#5, D7): summary=True on a queue mixing a
        non-description (WORD_ORDER, due-tier) item with two description
        items of DIFFERENT modalities (READING new-tier, LISTENING
        early-practice-tier) must (a) keep ALL three items -- no server-side
        truncation, since the exercises hub client-filters by modality then
        slices -- and (b) keep every item's modality/scenario_* fields so the
        client-side filter can still distinguish them after slimming.
        """
        user_id = uuid4()

        due_record = _make_mock_record(status=CardStatus.REVIEW)
        due_record.exercise = _make_mock_exercise(source_type=ExerciseSourceType.WORD_ORDER)
        due_record.next_review_date = date.today()

        new_exercise = _make_mock_exercise(source_type=ExerciseSourceType.DESCRIPTION)
        early_record = _make_mock_record(status=CardStatus.REVIEW)
        early_record.exercise = _make_mock_exercise(source_type=ExerciseSourceType.DESCRIPTION)
        early_record.next_review_date = date.today() + timedelta(days=3)

        service = ExerciseSM2Service(mock_db_session)
        service.record_repo.get_due_exercises = AsyncMock(return_value=[due_record])
        service.record_repo.get_new_exercises = AsyncMock(return_value=[new_exercise])
        service.record_repo.get_early_practice_exercises = AsyncMock(return_value=[early_record])
        service.load_description_enrichment = AsyncMock(
            return_value={
                new_exercise.id: {
                    "situation_id": uuid4(),
                    "scenario_el": "Διάβασμα",
                    "scenario_en": "Reading",
                    "scenario_ru": "Чтение",
                    "description_text_el": "Κείμενο ανάγνωσης.",
                    "description_audio_url": None,
                    "description_audio_duration": None,
                    "word_timestamps": None,
                    "items": [ExerciseItemPayload(item_index=0, payload={"kind": "reading"})],
                    "exercise_type": ExerciseType.FILL_GAPS,
                    "modality": ExerciseModality.READING,
                    "audio_level_value": DeckLevel.A2,
                },
                early_record.exercise.id: {
                    "situation_id": uuid4(),
                    "scenario_el": "Ακρόαση",
                    "scenario_en": "Listening",
                    "scenario_ru": "Аудирование",
                    "description_text_el": None,
                    "description_audio_url": "https://cdn/a1/audio.mp3",
                    "description_audio_duration": 8.0,
                    "word_timestamps": [{"word": "Καλησπέρα", "start": 0.0, "end": 0.4}],
                    "items": [ExerciseItemPayload(item_index=0, payload={"kind": "listening"})],
                    "exercise_type": ExerciseType.FILL_GAPS,
                    "modality": ExerciseModality.LISTENING,
                    "audio_level_value": DeckLevel.A1,
                },
            }
        )

        queue = await service.get_study_queue(user_id, include_early_practice=True, summary=True)

        # D7: slim, never truncate -- all 3 items present.
        assert queue.total_in_queue == 3
        items_by_id = {item.exercise_id: item for item in queue.exercises}
        assert due_record.exercise.id in items_by_id
        assert new_exercise.id in items_by_id
        assert early_record.exercise.id in items_by_id

        word_order_item = items_by_id[due_record.exercise.id]
        reading_item = items_by_id[new_exercise.id]
        listening_item = items_by_id[early_record.exercise.id]

        # Light fields survive slimming, including the modality/scenario_*
        # fields the hub's client-side filter depends on.
        assert word_order_item.source_type == ExerciseSourceType.WORD_ORDER
        assert reading_item.modality == ExerciseModality.READING
        assert reading_item.scenario_el == "Διάβασμα"
        assert listening_item.modality == ExerciseModality.LISTENING
        assert listening_item.scenario_el == "Ακρόαση"
        assert listening_item.is_early_practice is True

        # Heavy fields nulled/empty on every item regardless of modality.
        for item in (word_order_item, reading_item, listening_item):
            assert item.items == []
            assert item.word_timestamps is None
            assert item.description_text_el is None
            assert item.description_audio_url is None

    @pytest.mark.asyncio
    async def test_summary_true_empty_queue_returns_empty_items_zero_counts(self, mock_db_session):
        """Edge case: an empty queue in summary=True mode must not crash and
        must report all-zero counts with an empty items list (no
        ZeroDivision/IndexError/AttributeError from _slim_to_summary iterating
        an empty list, and no accidental non-zero count).
        """
        user_id = uuid4()
        service = ExerciseSM2Service(mock_db_session)
        service.record_repo.get_due_exercises = AsyncMock(return_value=[])
        service.record_repo.get_new_exercises = AsyncMock(return_value=[])
        service.record_repo.get_early_practice_exercises = AsyncMock(return_value=[])

        queue = await service.get_study_queue(user_id, include_early_practice=True, summary=True)

        assert queue.total_due == 0
        assert queue.total_new == 0
        assert queue.total_early_practice == 0
        assert queue.total_in_queue == 0
        assert queue.exercises == []
