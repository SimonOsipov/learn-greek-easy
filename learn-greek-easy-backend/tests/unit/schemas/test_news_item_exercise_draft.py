"""Unit tests for ExerciseDraft delta and NewsItemCreate.exercise plumbing.

Scope: only the DELTA between ExerciseDraft and its parent SelectCorrectAnswerPayload,
plus the NewsItemCreate.exercise / NewsItemUpdate plumbing.

NOT covered here (already in test_exercise_payload.py):
- MultilingualField min_length=1 validation
- SelectCorrectAnswerPayload 2-4 options range
- SelectCorrectAnswerPayload correct_answer_in_range / correct_answer_index_non_negative semantics
"""

from datetime import date

import pytest
from pydantic import ValidationError

from src.db.models import NewsCountry
from src.schemas.news_item import ExerciseDraft, NewsItemCreate, NewsItemUpdate

# ---------------------------------------------------------------------------
# Helper factories (plain functions — not pytest fixtures)
# ---------------------------------------------------------------------------


def _ml(el: str = "α", en: str = "a", ru: str = "а") -> dict:
    """Minimal valid trilingual dict for MultilingualField."""
    return {"el": el, "en": en, "ru": ru}


def _option(suffix: str = "") -> dict:
    """One valid option dict — distinct text per call to keep options identifiable."""
    return _ml(el=f"α{suffix}", en=f"a{suffix}", ru=f"а{suffix}")


def _options(n: int) -> list[dict]:
    """N valid option dicts."""
    return [_option(str(i)) for i in range(n)]


def _valid_exercise_kwargs(options_count: int = 4, correct_answer_index: int = 0) -> dict:
    """Kwargs for a valid ExerciseDraft. Override options_count or index to break specific rules."""
    return {
        "prompt": _ml(el="Επίλεξε", en="Pick", ru="Выбери"),
        "options": _options(options_count),
        "correct_answer_index": correct_answer_index,
    }


def _valid_news_item_create_kwargs(**overrides) -> dict:
    """Required NewsItemCreate fields without exercise. All required fields from news_item.py."""
    base = {
        "scenario_el": "Σενάριο",
        "scenario_en": "Scenario",
        "scenario_ru": "Сценарий",
        "text_el": "Κείμενο",
        "country": NewsCountry.WORLD,
        "publication_date": date(2026, 1, 1),
        "original_article_url": "https://example.com/article",
        "source_image_url": "https://example.com/image.jpg",
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# Test classes
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestExerciseDraft:
    """Tests for the ExerciseDraft subclass delta over SelectCorrectAnswerPayload."""

    def test_happy_path(self):
        """Test 1: ExerciseDraft with 4 options and valid index constructs successfully."""
        instance = ExerciseDraft(**_valid_exercise_kwargs(options_count=4, correct_answer_index=2))
        assert len(instance.options) == 4
        assert instance.correct_answer_index == 2

    @pytest.mark.parametrize("count", [0, 1, 2, 3, 5, 6])
    def test_options_length_must_be_exactly_4(self, count):
        """Test 2: All non-4 lengths are rejected with 'exactly 4 entries'.

        Pydantic 2.9: same-name @field_validator in subclass REPLACES the parent
        validator entirely. The subclass's options_length is the only one that runs,
        so the strict message fires for all non-4 counts.
        """
        kwargs = _valid_exercise_kwargs(options_count=count, correct_answer_index=0)
        with pytest.raises(ValidationError) as exc_info:
            ExerciseDraft(**kwargs)
        assert "exactly 4 entries" in str(exc_info.value)

    def test_inherited_index_out_of_range(self):
        """Test 3a: Smoke check — parent's correct_answer_in_range still fires on subclass."""
        kwargs = _valid_exercise_kwargs(options_count=4, correct_answer_index=4)
        with pytest.raises(ValidationError):
            ExerciseDraft(**kwargs)

    def test_inherited_index_negative(self):
        """Test 3b: Smoke check — parent's correct_answer_index_non_negative still fires on subclass."""
        kwargs = _valid_exercise_kwargs(options_count=4, correct_answer_index=-1)
        with pytest.raises(ValidationError):
            ExerciseDraft(**kwargs)

    def test_index_coerces_string_to_int(self):
        """Test 4: correct_answer_index='2' is accepted and coerced to int 2."""
        kwargs = _valid_exercise_kwargs(options_count=4)
        kwargs["correct_answer_index"] = "2"
        instance = ExerciseDraft(**kwargs)
        assert instance.correct_answer_index == 2
        assert isinstance(instance.correct_answer_index, int)


@pytest.mark.unit
class TestNewsItemCreatePlumbing:
    """Tests for NewsItemCreate.exercise optional field and validation plumbing."""

    def test_exercise_is_optional(self):
        """Test 5: Building NewsItemCreate without exercise succeeds; exercise is None."""
        instance = NewsItemCreate(**_valid_news_item_create_kwargs())
        assert instance.exercise is None

    def test_exercise_accepts_dict(self):
        """Test 6: Building NewsItemCreate with valid exercise dict yields ExerciseDraft instance."""
        exercise_kwargs = _valid_exercise_kwargs(options_count=4, correct_answer_index=1)
        instance = NewsItemCreate(**_valid_news_item_create_kwargs(exercise=exercise_kwargs))
        assert isinstance(instance.exercise, ExerciseDraft)
        assert instance.exercise.correct_answer_index == 1

    def test_exercise_validation_propagates(self):
        """Test 7: Malformed exercise (3 options) raises ValidationError with 'exactly 4 entries'."""
        bad_exercise = _valid_exercise_kwargs(options_count=3, correct_answer_index=0)
        with pytest.raises(ValidationError) as exc_info:
            NewsItemCreate(**_valid_news_item_create_kwargs(exercise=bad_exercise))
        assert "exactly 4 entries" in str(exc_info.value)

    def test_news_item_update_silently_ignores_exercise(self):
        """Test 8: NewsItemUpdate does NOT define exercise; unknown kwargs are silently dropped.

        Current convention: NewsItemUpdate has no extra="forbid" config (verified at
        src/schemas/news_item.py — no model_config with extra="forbid"), so arbitrary
        kwargs like 'exercise' are silently ignored rather than rejected.
        Tightening this to extra="forbid" is OUT of scope for ATEX-03 / AUTOEX-01.
        """
        instance = NewsItemUpdate(exercise={"anything": "here"})
        dumped = instance.model_dump(exclude_unset=True)
        assert "exercise" not in dumped
