import pytest
from pydantic import ValidationError

from src.schemas.exercise_payload import SelectCorrectAnswerPayload
from src.services.exercise_migration_helpers import build_select_correct_answer_payload


def _ml(el: str = "ελ", en: str = "en", ru: str = "ру") -> dict:
    """Build a valid multilingual dict."""
    return {"el": el, "en": en, "ru": ru}


def test_4_options_correct_1():
    result = build_select_correct_answer_payload(_ml(), _ml(), _ml(), _ml(), _ml(), 1)
    assert result["correct_answer_index"] == 0
    assert len(result["options"]) == 4


def test_4_options_correct_4():
    result = build_select_correct_answer_payload(_ml(), _ml(), _ml(), _ml(), _ml(), 4)
    assert result["correct_answer_index"] == 3
    assert len(result["options"]) == 4


def test_3_options_correct_3():
    result = build_select_correct_answer_payload(_ml(), _ml(), _ml(), _ml(), None, 3)
    assert result["correct_answer_index"] == 2
    assert len(result["options"]) == 3


def test_2_options_correct_2():
    result = build_select_correct_answer_payload(_ml(), _ml(), _ml(), None, None, 2)
    assert result["correct_answer_index"] == 1
    assert len(result["options"]) == 2


def test_correct_option_zero_raises():
    with pytest.raises(ValueError):
        build_select_correct_answer_payload(_ml(), _ml(), _ml(), _ml(), _ml(), 0)


def test_correct_option_five_raises():
    with pytest.raises(ValueError):
        build_select_correct_answer_payload(_ml(), _ml(), _ml(), _ml(), _ml(), 5)


def test_correct_option_points_to_null():
    with pytest.raises(ValueError, match="null option"):
        build_select_correct_answer_payload(_ml(), _ml(), _ml(), None, None, 3)


def test_missing_en_in_question():
    with pytest.raises(ValidationError):
        build_select_correct_answer_payload({"el": "x", "ru": "x"}, _ml(), _ml(), _ml(), _ml(), 1)


def test_missing_ru_in_option_a():
    with pytest.raises(ValidationError):
        build_select_correct_answer_payload(_ml(), {"el": "x", "en": "x"}, _ml(), _ml(), _ml(), 1)


def test_all_present_returns_valid():
    result = build_select_correct_answer_payload(_ml(), _ml(), _ml(), _ml(), _ml(), 1)
    assert "prompt" in result
    assert "options" in result
    assert "correct_answer_index" in result


def test_returned_dict_passes_model_validate():
    result = build_select_correct_answer_payload(_ml(), _ml(), _ml(), _ml(), _ml(), 1)
    SelectCorrectAnswerPayload.model_validate(result)


def test_correct_answer_index_is_zero_indexed_int():
    result = build_select_correct_answer_payload(_ml(), _ml(), _ml(), _ml(), _ml(), 2)
    assert isinstance(result["correct_answer_index"], int)
    assert result["correct_answer_index"] == 1
