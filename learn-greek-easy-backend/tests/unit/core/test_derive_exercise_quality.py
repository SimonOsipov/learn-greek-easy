"""Unit tests for derive_exercise_quality() quality mapping function."""

import pytest

from src.core.sm2 import derive_exercise_quality


@pytest.mark.unit
class TestDeriveExerciseQuality:
    """Unit tests for derive_exercise_quality() quality mapping function."""

    @pytest.mark.parametrize(
        "score,max_score,expected",
        [
            (10, 10, 5),  # ratio 1.0 → 5
            (9, 10, 4),  # ratio 0.9 → 4
            (8, 10, 4),  # ratio 0.8 exactly → 4
            (7, 10, 3),  # ratio 0.7 → 3 (just below 0.8 threshold)
            (6, 10, 3),  # ratio 0.6 exactly → 3
            (5, 10, 2),  # ratio 0.5 → 2
            (4, 10, 2),  # ratio 0.4 exactly → 2
            (3, 10, 1),  # ratio 0.3 → 1
            (2, 10, 1),  # ratio 0.2 exactly → 1
            (1, 10, 0),  # ratio 0.1 → 0
            (0, 10, 0),  # ratio 0.0 → 0
        ],
    )
    def test_quality_thresholds(self, score: int, max_score: int, expected: int) -> None:
        assert derive_exercise_quality(score, max_score) == expected

    def test_score_exceeds_max_returns_5(self) -> None:
        """score > max_score → ratio > 1.0 → quality 5 (no cap needed)."""
        assert derive_exercise_quality(11, 10) == 5

    def test_max_score_zero_returns_0_no_exception(self) -> None:
        """max_score == 0: guard clause returns 0, no ZeroDivisionError."""
        assert derive_exercise_quality(0, 0) == 0

    def test_max_score_negative_returns_0(self) -> None:
        """max_score < 0: guard clause returns 0."""
        assert derive_exercise_quality(0, -1) == 0

    def test_negative_score_raises_value_error(self) -> None:
        """score < 0 raises ValueError."""
        with pytest.raises(ValueError, match="score must be >= 0"):
            derive_exercise_quality(-1, 10)
