"""Unit tests for SM2 schemas validation."""

from datetime import date
from uuid import uuid4

import pytest
from pydantic import ValidationError

from src.db.models import CardStatus
from src.schemas.card import Example
from src.schemas.sm2 import StudyQueue, StudyQueueCard, StudyQueueRequest
from src.schemas.v2_sm2 import V2RatingPreview, V2StudyQueueCard


class TestStudyQueueRequest:
    """Test StudyQueueRequest schema validation."""

    def test_default_values(self):
        """Test default values for all fields."""
        request = StudyQueueRequest()
        assert request.deck_id is None
        assert request.limit == 20
        assert request.include_new is True
        assert request.new_cards_limit == 10
        assert request.include_early_practice is False
        assert request.early_practice_limit == 10

    def test_include_early_practice_true(self):
        """Test setting include_early_practice to True."""
        request = StudyQueueRequest(include_early_practice=True)
        assert request.include_early_practice is True

    def test_early_practice_limit_valid_range(self):
        """Test valid early_practice_limit values."""
        # Minimum boundary
        request = StudyQueueRequest(early_practice_limit=0)
        assert request.early_practice_limit == 0

        # Maximum boundary
        request = StudyQueueRequest(early_practice_limit=50)
        assert request.early_practice_limit == 50

        # Mid-range value
        request = StudyQueueRequest(early_practice_limit=25)
        assert request.early_practice_limit == 25

    def test_early_practice_limit_below_minimum(self):
        """Test early_practice_limit below minimum (0) is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            StudyQueueRequest(early_practice_limit=-1)
        assert "greater than or equal to 0" in str(exc_info.value)

    def test_early_practice_limit_above_maximum(self):
        """Test early_practice_limit above maximum (50) is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            StudyQueueRequest(early_practice_limit=51)
        assert "less than or equal to 50" in str(exc_info.value)

    def test_early_practice_with_deck_id(self):
        """Test early practice fields work with deck_id specified."""
        deck_id = uuid4()
        request = StudyQueueRequest(
            deck_id=deck_id,
            include_early_practice=True,
            early_practice_limit=20,
        )
        assert request.deck_id == deck_id
        assert request.include_early_practice is True
        assert request.early_practice_limit == 20


class TestStudyQueueCard:
    """Test StudyQueueCard schema validation."""

    def test_is_early_practice_default_false(self):
        """Test is_early_practice defaults to False."""
        card = StudyQueueCard(
            card_id=uuid4(),
            front_text="Greek text",
            back_text="English text",
            status=CardStatus.NEW,
            is_new=True,
        )
        assert card.is_early_practice is False

    def test_is_early_practice_can_be_true(self):
        """Test is_early_practice can be set to True."""
        card = StudyQueueCard(
            card_id=uuid4(),
            front_text="Greek text",
            back_text="English text",
            status=CardStatus.REVIEW,
            is_new=False,
            is_early_practice=True,
            due_date=date.today(),
        )
        assert card.is_early_practice is True

    def test_card_can_be_both_not_new_and_early_practice(self):
        """Test that a non-new card can be marked as early practice."""
        card = StudyQueueCard(
            card_id=uuid4(),
            front_text="Greek",
            back_text="English",
            status=CardStatus.LEARNING,
            is_new=False,
            is_early_practice=True,
        )
        assert card.is_new is False
        assert card.is_early_practice is True

    def test_new_card_not_early_practice(self):
        """Test a new card is typically not early practice."""
        card = StudyQueueCard(
            card_id=uuid4(),
            front_text="Greek",
            back_text="English",
            status=CardStatus.NEW,
            is_new=True,
            is_early_practice=False,
        )
        assert card.is_new is True
        assert card.is_early_practice is False

    def test_all_card_fields_together(self):
        """Test card with all fields populated including early practice."""
        card_id = uuid4()
        card = StudyQueueCard(
            card_id=card_id,
            front_text="Front",
            back_text="Back",
            example_sentence="Example",
            pronunciation="pron",
            examples=[{"greek": "Example", "english": "Translation", "russian": ""}],
            status=CardStatus.REVIEW,
            is_new=False,
            is_early_practice=True,
            due_date=date.today(),
            easiness_factor=2.5,
            interval=7,
        )
        assert card.card_id == card_id
        assert card.is_early_practice is True
        assert card.due_date == date.today()
        assert card.examples == [Example(greek="Example", english="Translation", russian="")]

    def test_examples_field_optional(self):
        """Test that examples field is optional."""
        card = StudyQueueCard(
            card_id=uuid4(),
            front_text="Greek text",
            back_text="English text",
            status=CardStatus.NEW,
            is_new=True,
        )
        assert card.examples is None

    def test_examples_field_accepts_list(self):
        """Test that examples field accepts a list of dicts."""
        examples = [
            {"greek": "Greek 1", "english": "English 1", "russian": "Russian 1"},
            {
                "greek": "Greek 2",
                "english": "English 2",
                "russian": "Russian 2",
                "tense": "present",
            },
        ]
        card = StudyQueueCard(
            card_id=uuid4(),
            front_text="Greek text",
            back_text="English text",
            status=CardStatus.NEW,
            is_new=True,
            examples=examples,
        )
        expected = [
            Example(greek="Greek 1", english="English 1", russian="Russian 1"),
            Example(greek="Greek 2", english="English 2", russian="Russian 2", tense="present"),
        ]
        assert card.examples == expected
        assert len(card.examples) == 2


class TestStudyQueue:
    """Test StudyQueue schema validation."""

    def test_total_early_practice_default_zero(self):
        """Test total_early_practice defaults to 0."""
        queue = StudyQueue(
            deck_id=uuid4(),
            deck_name="Test Deck",
            total_due=5,
            total_new=3,
            total_in_queue=8,
        )
        assert queue.total_early_practice == 0

    def test_total_early_practice_can_be_set(self):
        """Test total_early_practice can be set to positive value."""
        queue = StudyQueue(
            deck_id=uuid4(),
            deck_name="Test Deck",
            total_due=5,
            total_new=3,
            total_early_practice=2,
            total_in_queue=10,
        )
        assert queue.total_early_practice == 2

    def test_total_early_practice_negative_rejected(self):
        """Test negative total_early_practice is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            StudyQueue(
                deck_id=uuid4(),
                deck_name="Test Deck",
                total_due=5,
                total_new=3,
                total_early_practice=-1,
                total_in_queue=8,
            )
        assert "greater than or equal to 0" in str(exc_info.value)

    def test_queue_with_early_practice_cards(self):
        """Test queue can contain cards with early practice flag."""
        early_card = StudyQueueCard(
            card_id=uuid4(),
            front_text="Early",
            back_text="Practice",
            status=CardStatus.LEARNING,
            is_new=False,
            is_early_practice=True,
        )
        due_card = StudyQueueCard(
            card_id=uuid4(),
            front_text="Due",
            back_text="Card",
            status=CardStatus.REVIEW,
            is_new=False,
            is_early_practice=False,
        )
        queue = StudyQueue(
            deck_id=uuid4(),
            deck_name="Mixed Queue",
            total_due=1,
            total_new=0,
            total_early_practice=1,
            total_in_queue=2,
            cards=[due_card, early_card],
        )
        assert queue.total_early_practice == 1
        assert len(queue.cards) == 2
        assert queue.cards[1].is_early_practice is True

    def test_queue_all_counts_match(self):
        """Test queue with due, new, and early practice cards."""
        queue = StudyQueue(
            deck_id=uuid4(),
            deck_name="Full Queue",
            total_due=5,
            total_new=3,
            total_early_practice=2,
            total_in_queue=10,
        )
        assert queue.total_due == 5
        assert queue.total_new == 3
        assert queue.total_early_practice == 2
        assert queue.total_in_queue == 10


class TestV2RatingPreview:
    """Unit tests for V2RatingPreview schema (PRACT2-3-05)."""

    def test_round_trip_serialization(self):
        """V2RatingPreview should survive a model_validate round-trip."""
        preview = V2RatingPreview(
            rating=3,
            quality=4,
            interval=1,
            next_review_date=date(2026, 6, 5),
            new_status=CardStatus.LEARNING,
        )
        data = preview.model_dump()
        restored = V2RatingPreview.model_validate(data)
        assert restored.rating == 3
        assert restored.quality == 4
        assert restored.interval == 1
        assert restored.next_review_date == date(2026, 6, 5)
        assert restored.new_status == CardStatus.LEARNING

    def test_all_rating_values_accepted(self):
        """V2RatingPreview accepts any of the four UI rating values."""
        for rating, quality in {1: 0, 2: 2, 3: 4, 4: 5}.items():
            preview = V2RatingPreview(
                rating=rating,
                quality=quality,
                interval=1,
                next_review_date=date.today(),
                new_status=CardStatus.LEARNING,
            )
            assert preview.rating == rating
            assert preview.quality == quality


class TestV2StudyQueueCardRatingPreviews:
    """Unit tests for rating_previews field on V2StudyQueueCard (PRACT2-3-05)."""

    def _make_card(self, **kwargs) -> V2StudyQueueCard:
        defaults = dict(
            card_record_id=uuid4(),
            word_entry_id=uuid4(),
            deck_id=uuid4(),
            deck_name="Test Deck",
            card_type="meaning_el_to_en",
            variant_key="meaning",
            front_content={},
            back_content={},
            is_new=False,
        )
        defaults.update(kwargs)
        return V2StudyQueueCard(**defaults)

    def test_rating_previews_defaults_to_empty_list(self):
        """rating_previews should default to [] when not supplied."""
        card = self._make_card()
        assert card.rating_previews == []

    def test_rating_previews_accepts_list_of_previews(self):
        """rating_previews field accepts a list of V2RatingPreview objects."""
        preview = V2RatingPreview(
            rating=1,
            quality=0,
            interval=1,
            next_review_date=date.today(),
            new_status=CardStatus.LEARNING,
        )
        card = self._make_card(rating_previews=[preview])
        assert len(card.rating_previews) == 1
        assert card.rating_previews[0].rating == 1
        assert card.rating_previews[0].quality == 0
