"""Unit tests for exercise payload schema validation."""

import pytest
from pydantic import ValidationError

from src.db.models import ExerciseType
from src.schemas.exercise_payload import (
    PAYLOAD_SCHEMA_MAP,
    MultilingualField,
    SelectCorrectAnswerPayload,
    validate_exercise_payload,
)


def _ml(el: str = "Ελληνικά", en: str = "English", ru: str = "Русский") -> dict:
    """Helper to create a multilingual field dict."""
    return {"el": el, "en": en, "ru": ru}


def _options(count: int = 4) -> list[dict]:
    """Helper to create N option dicts."""
    labels = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"]
    return [
        _ml(el=f"Επιλογή {labels[i]}", en=labels[i], ru=f"Вариант {labels[i]}")
        for i in range(count)
    ]


@pytest.mark.unit
class TestMultilingualField:
    """Test MultilingualField schema validation."""

    def test_valid_multilingual_field(self):
        field = MultilingualField(el="Ελληνικά", en="English", ru="Русский")
        assert field.el == "Ελληνικά"
        assert field.en == "English"
        assert field.ru == "Русский"

    def test_empty_el_rejected(self):
        with pytest.raises(ValidationError):
            MultilingualField(el="", en="English", ru="Русский")

    def test_empty_en_rejected(self):
        with pytest.raises(ValidationError):
            MultilingualField(el="Ελληνικά", en="", ru="Русский")

    def test_empty_ru_rejected(self):
        with pytest.raises(ValidationError):
            MultilingualField(el="Ελληνικά", en="English", ru="")


@pytest.mark.unit
class TestSelectCorrectAnswerPayload:
    """Test SelectCorrectAnswerPayload schema validation."""

    def test_valid_2_options(self):
        payload = SelectCorrectAnswerPayload(
            prompt=MultilingualField(**_ml()),
            options=[MultilingualField(**o) for o in _options(2)],
            correct_answer_index=0,
        )
        assert len(payload.options) == 2
        assert payload.correct_answer_index == 0

    def test_valid_3_options(self):
        payload = SelectCorrectAnswerPayload(
            prompt=MultilingualField(**_ml()),
            options=[MultilingualField(**o) for o in _options(3)],
            correct_answer_index=2,
        )
        assert len(payload.options) == 3

    def test_valid_4_options(self):
        payload = SelectCorrectAnswerPayload(
            prompt=MultilingualField(**_ml()),
            options=[MultilingualField(**o) for o in _options(4)],
            correct_answer_index=3,
        )
        assert len(payload.options) == 4
        assert payload.correct_answer_index == 3

    def test_zero_options_rejected(self):
        with pytest.raises(ValidationError, match="2-4 items"):
            SelectCorrectAnswerPayload(
                prompt=MultilingualField(**_ml()),
                options=[],
                correct_answer_index=0,
            )

    def test_one_option_rejected(self):
        with pytest.raises(ValidationError, match="2-4 items"):
            SelectCorrectAnswerPayload(
                prompt=MultilingualField(**_ml()),
                options=[MultilingualField(**_options(1)[0])],
                correct_answer_index=0,
            )

    def test_five_options_rejected(self):
        with pytest.raises(ValidationError, match="2-4 items"):
            SelectCorrectAnswerPayload(
                prompt=MultilingualField(**_ml()),
                options=[MultilingualField(**o) for o in _options(5)],
                correct_answer_index=0,
            )

    def test_negative_index_rejected(self):
        with pytest.raises(ValidationError, match="must be >= 0"):
            SelectCorrectAnswerPayload(
                prompt=MultilingualField(**_ml()),
                options=[MultilingualField(**o) for o in _options(2)],
                correct_answer_index=-1,
            )

    def test_index_out_of_range_rejected(self):
        with pytest.raises(ValidationError, match="must be < number of options"):
            SelectCorrectAnswerPayload(
                prompt=MultilingualField(**_ml()),
                options=[MultilingualField(**o) for o in _options(2)],
                correct_answer_index=2,
            )

    def test_missing_prompt_rejected(self):
        with pytest.raises(ValidationError):
            SelectCorrectAnswerPayload(
                options=[MultilingualField(**o) for o in _options(2)],
                correct_answer_index=0,
            )


@pytest.mark.unit
class TestPayloadSchemaMap:
    """Test PAYLOAD_SCHEMA_MAP completeness and dispatch."""

    def test_all_exercise_types_registered(self):
        """Every ExerciseType must have an entry in PAYLOAD_SCHEMA_MAP."""
        for exercise_type in ExerciseType:
            assert (
                exercise_type in PAYLOAD_SCHEMA_MAP
            ), f"{exercise_type.value} missing from PAYLOAD_SCHEMA_MAP"

    def test_validate_dispatches_select_correct_answer(self):
        """validate_exercise_payload should return SelectCorrectAnswerPayload."""
        payload_dict = {
            "prompt": _ml(),
            "options": _options(4),
            "correct_answer_index": 1,
        }
        result = validate_exercise_payload(ExerciseType.SELECT_CORRECT_ANSWER, payload_dict)
        assert isinstance(result, SelectCorrectAnswerPayload)
        assert result.correct_answer_index == 1
