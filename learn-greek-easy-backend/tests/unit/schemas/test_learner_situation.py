"""Unit tests for learner situation schema validation."""

from uuid import uuid4

import pytest

from src.db.models import SituationStatus
from src.schemas.learner_situation import (
    LearnerDescriptionNested,
    LearnerSituationDetailResponse,
    LearnerSituationListItem,
    LearnerSituationListResponse,
)


@pytest.mark.unit
class TestLearnerSituationListItem:
    """Test LearnerSituationListItem serialization."""

    def _valid_kwargs(self, **overrides):
        kwargs = dict(
            id=uuid4(),
            scenario_el="Στον καφέ",
            scenario_en="At the coffee shop",
            scenario_ru="В кофейне",
            status=SituationStatus.READY,
            has_audio=False,
            has_dialog=False,
            exercise_total=0,
            exercise_completed=0,
        )
        kwargs.update(overrides)
        return kwargs

    def test_serialization_with_all_fields(self):
        uid = uuid4()
        item = LearnerSituationListItem(**self._valid_kwargs(id=uid))
        assert item.id == uid
        assert item.scenario_en == "At the coffee shop"
        assert item.status == SituationStatus.READY

    def test_has_audio_and_has_dialog_booleans(self):
        item = LearnerSituationListItem(**self._valid_kwargs(has_audio=True, has_dialog=True))
        assert item.has_audio is True
        assert item.has_dialog is True

    def test_has_audio_false_by_default_kwarg(self):
        item = LearnerSituationListItem(**self._valid_kwargs(has_audio=False))
        assert item.has_audio is False

    def test_exercise_counts_default_zero(self):
        item = LearnerSituationListItem(**self._valid_kwargs())
        assert item.exercise_total == 0
        assert item.exercise_completed == 0

    def test_exercise_counts_nonzero(self):
        item = LearnerSituationListItem(
            **self._valid_kwargs(exercise_total=3, exercise_completed=1)
        )
        assert item.exercise_total == 3
        assert item.exercise_completed == 1


@pytest.mark.unit
class TestLearnerSituationListResponse:
    """Test LearnerSituationListResponse."""

    def test_empty_response(self):
        resp = LearnerSituationListResponse(items=[], total=0, page=1, page_size=20)
        assert resp.items == []
        assert resp.total == 0

    def test_response_with_items(self):
        item = LearnerSituationListItem(
            id=uuid4(),
            scenario_el="Στον καφέ",
            scenario_en="At the coffee shop",
            scenario_ru="В кофейне",
            status=SituationStatus.READY,
            has_audio=False,
            has_dialog=False,
            exercise_total=2,
            exercise_completed=1,
        )
        resp = LearnerSituationListResponse(items=[item], total=1, page=1, page_size=20)
        assert len(resp.items) == 1
        assert resp.total == 1
        assert resp.page == 1
        assert resp.page_size == 20

    def test_pagination_fields_preserved(self):
        resp = LearnerSituationListResponse(items=[], total=50, page=3, page_size=10)
        assert resp.total == 50
        assert resp.page == 3
        assert resp.page_size == 10


@pytest.mark.unit
class TestLearnerDescriptionNested:
    """Test LearnerDescriptionNested schema."""

    def test_minimal_with_text_el_only(self):
        desc = LearnerDescriptionNested(text_el="Ο Γιάννης πίνει καφέ.")
        assert desc.text_el == "Ο Γιάννης πίνει καφέ."
        assert desc.text_el_a2 is None
        assert desc.audio_url is None
        assert desc.audio_a2_url is None

    def test_optional_fields_default_none(self):
        desc = LearnerDescriptionNested(text_el="Κείμενο")
        assert desc.audio_duration_seconds is None
        assert desc.audio_a2_duration_seconds is None
        assert desc.word_timestamps is None
        assert desc.word_timestamps_a2 is None

    def test_all_fields_set(self):
        desc = LearnerDescriptionNested(
            text_el="Κείμενο",
            text_el_a2="Απλό κείμενο",
            audio_url="https://example.com/audio.mp3",
            audio_a2_url="https://example.com/audio_a2.mp3",
            audio_duration_seconds=45.5,
            audio_a2_duration_seconds=30.0,
        )
        assert desc.text_el_a2 == "Απλό κείμενο"
        assert desc.audio_url == "https://example.com/audio.mp3"
        assert desc.audio_duration_seconds == 45.5


@pytest.mark.unit
class TestLearnerSituationDetailResponse:
    """Test LearnerSituationDetailResponse schema."""

    def _valid_kwargs(self, **overrides):
        kwargs = dict(
            id=uuid4(),
            scenario_el="Στον καφέ",
            scenario_en="At the coffee shop",
            scenario_ru="В кофейне",
            status=SituationStatus.READY,
            exercise_total=0,
            exercise_completed=0,
        )
        kwargs.update(overrides)
        return kwargs

    def test_without_description_or_dialog(self):
        resp = LearnerSituationDetailResponse(**self._valid_kwargs())
        assert resp.description is None
        assert resp.dialog is None
        assert resp.exercise_total == 0
        assert resp.exercise_completed == 0

    def test_with_description(self):
        desc = LearnerDescriptionNested(
            text_el="Ο Γιάννης πίνει καφέ.",
            text_el_a2="Απλό κείμενο",
        )
        resp = LearnerSituationDetailResponse(
            **self._valid_kwargs(description=desc, exercise_total=2)
        )
        assert resp.description is not None
        assert resp.description.text_el == "Ο Γιάννης πίνει καφέ."
        assert resp.description.text_el_a2 == "Απλό κείμενο"
        assert resp.exercise_total == 2

    def test_id_is_preserved(self):
        uid = uuid4()
        resp = LearnerSituationDetailResponse(**self._valid_kwargs(id=uid))
        assert resp.id == uid

    def test_status_ready(self):
        resp = LearnerSituationDetailResponse(**self._valid_kwargs(status=SituationStatus.READY))
        assert resp.status == SituationStatus.READY
