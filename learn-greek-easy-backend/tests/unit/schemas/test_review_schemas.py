"""Unit tests for review schema validation.

Covers the second SRS quality gate (``validate_quality``) that backs the
SM-2 algorithm, plus the bulk-submission list bounds and the per-answer
``time_taken`` boundary driven by ``MAX_ANSWER_TIME_SECONDS``.
"""

from uuid import uuid4

import pytest
from pydantic import ValidationError

from src.constants import MAX_ANSWER_TIME_SECONDS
from src.db.models import ReviewRating
from src.schemas.review import BulkReviewSubmit, ReviewSubmit


def _valid_review(quality: int = 5, time_taken: int = 10) -> dict:
    """Build kwargs for a valid ReviewSubmit."""
    return {"card_id": uuid4(), "quality": quality, "time_taken": time_taken}


class TestValidateQuality:
    """Test the validate_quality second gate on ReviewSubmit."""

    @pytest.mark.parametrize("quality", [0, 1, 2, 3, 4, 5])
    def test_all_valid_ratings_accepted(self, quality):
        """Every ReviewRating enum value (0-5) is accepted."""
        review = ReviewSubmit(**_valid_review(quality=quality))
        assert review.quality == quality

    def test_quality_six_rejected(self):
        """A quality of 6 is rejected (out of enum + Field range)."""
        with pytest.raises(ValidationError):
            ReviewSubmit(**_valid_review(quality=6))

    def test_quality_negative_rejected(self):
        """A negative quality is rejected by the Field ge=0 bound."""
        with pytest.raises(ValidationError) as exc_info:
            ReviewSubmit(**_valid_review(quality=-1))
        assert "greater than or equal to 0" in str(exc_info.value)

    def test_validate_quality_directly_for_all_ratings(self):
        """Call the validator classmethod directly for each valid rating."""
        for rating in ReviewRating:
            assert ReviewSubmit.validate_quality(rating.value) == rating.value

    def test_validate_quality_directly_rejects_invalid(self):
        """validate_quality raises ValueError for a value not in the enum."""
        with pytest.raises(ValueError) as exc_info:
            ReviewSubmit.validate_quality(99)
        assert "Quality must be one of" in str(exc_info.value)


class TestReviewRatingRegressionGuard:
    """Regression guard documenting current ReviewRating membership.

    validate_quality derives its allowed set from ReviewRating, so if the
    enum gains or loses a member the accepted quality set changes silently.
    This test pins the contract: ratings 0-5, six members.
    """

    def test_review_rating_members_are_zero_to_five(self):
        values = sorted(rating.value for rating in ReviewRating)
        assert values == [0, 1, 2, 3, 4, 5]

    def test_validate_quality_accepts_exactly_the_enum_values(self):
        """The validator's accepted set equals the current enum values."""
        for rating in ReviewRating:
            assert ReviewSubmit.validate_quality(rating.value) == rating.value
        # A value just past the current max is not part of the enum.
        max_value = max(rating.value for rating in ReviewRating)
        with pytest.raises(ValueError):
            ReviewSubmit.validate_quality(max_value + 1)


class TestTimeTakenBoundary:
    """Test the time_taken boundary bound by MAX_ANSWER_TIME_SECONDS."""

    def test_max_answer_time_constant_is_180(self):
        """Pin the constant the schema bound depends on."""
        assert MAX_ANSWER_TIME_SECONDS == 180

    def test_time_taken_zero_accepted(self):
        review = ReviewSubmit(**_valid_review(time_taken=0))
        assert review.time_taken == 0

    def test_time_taken_at_max_accepted(self):
        """time_taken equal to the cap (180) is accepted."""
        review = ReviewSubmit(**_valid_review(time_taken=MAX_ANSWER_TIME_SECONDS))
        assert review.time_taken == MAX_ANSWER_TIME_SECONDS

    def test_time_taken_above_max_rejected(self):
        """time_taken one above the cap (181) is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ReviewSubmit(**_valid_review(time_taken=MAX_ANSWER_TIME_SECONDS + 1))
        assert "less than or equal to" in str(exc_info.value)

    def test_time_taken_negative_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            ReviewSubmit(**_valid_review(time_taken=-1))
        assert "greater than or equal to 0" in str(exc_info.value)


class TestBulkReviewSubmitBounds:
    """Test the reviews list length bounds (1-100) on BulkReviewSubmit."""

    def _bulk(self, count: int) -> dict:
        return {
            "deck_id": uuid4(),
            "session_id": "session-abc",
            "reviews": [_valid_review() for _ in range(count)],
        }

    def test_one_review_accepted(self):
        """Minimum list length (1) is accepted."""
        bulk = BulkReviewSubmit(**self._bulk(1))
        assert len(bulk.reviews) == 1

    def test_hundred_reviews_accepted(self):
        """Maximum list length (100) is accepted."""
        bulk = BulkReviewSubmit(**self._bulk(100))
        assert len(bulk.reviews) == 100

    def test_zero_reviews_rejected(self):
        """Empty review list (0) is rejected by min_length=1."""
        with pytest.raises(ValidationError) as exc_info:
            BulkReviewSubmit(**self._bulk(0))
        assert "at least 1 item" in str(exc_info.value)

    def test_hundred_one_reviews_rejected(self):
        """List of 101 reviews is rejected by max_length=100."""
        with pytest.raises(ValidationError) as exc_info:
            BulkReviewSubmit(**self._bulk(101))
        assert "at most 100 items" in str(exc_info.value)

    def test_nested_review_validation_applies(self):
        """Invalid quality inside a bulk review is rejected."""
        payload = self._bulk(1)
        payload["reviews"][0]["quality"] = 6
        with pytest.raises(ValidationError):
            BulkReviewSubmit(**payload)
