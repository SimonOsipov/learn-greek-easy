"""Unit tests for culture schemas validation."""

from datetime import date, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from src.schemas.culture import (
    CultureAnswerRequest,
    CultureAnswerResponse,
    CultureDeckProgress,
    CultureDeckResponse,
    CultureOverallProgress,
    CultureQuestionResponse,
    CultureQuestionStatsResponse,
    CultureSessionSummary,
    MultilingualText,
)


class TestMultilingualText:
    """Test MultilingualText schema validation."""

    def test_valid_multilingual_text(self):
        """Test valid multilingual text with all languages."""
        text = MultilingualText(
            el="Greek text",
            en="English text",
            ru="Russian text",
        )
        assert text.el == "Greek text"
        assert text.en == "English text"
        assert text.ru == "Russian text"

    def test_empty_greek_rejected(self):
        """Test that empty Greek text is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            MultilingualText(el="", en="English", ru="Russian")
        assert "too_short" in str(exc_info.value).lower()

    def test_empty_english_rejected(self):
        """Test that empty English text is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            MultilingualText(el="Greek", en="", ru="Russian")
        assert "too_short" in str(exc_info.value).lower()

    def test_empty_russian_rejected(self):
        """Test that empty Russian text is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            MultilingualText(el="Greek", en="English", ru="")
        assert "too_short" in str(exc_info.value).lower()


class TestCultureAnswerRequest:
    """Test answer request validation."""

    def test_valid_answer(self):
        """Test valid answer submission."""
        answer = CultureAnswerRequest(selected_option=2, time_taken=15)
        assert answer.selected_option == 2
        assert answer.time_taken == 15

    def test_option_below_range(self):
        """Test option below valid range."""
        with pytest.raises(ValidationError) as exc_info:
            CultureAnswerRequest(selected_option=0, time_taken=10)
        assert "greater than or equal to 1" in str(exc_info.value)

    def test_option_above_range(self):
        """Test option above valid range."""
        with pytest.raises(ValidationError) as exc_info:
            CultureAnswerRequest(selected_option=5, time_taken=10)
        assert "less than or equal to 4" in str(exc_info.value)

    def test_time_taken_accepts_large_values(self):
        """Test time taken accepts values over 300 seconds (no upper limit)."""
        answer = CultureAnswerRequest(selected_option=1, time_taken=600)
        assert answer.time_taken == 600

        answer2 = CultureAnswerRequest(selected_option=1, time_taken=3600)  # 1 hour
        assert answer2.time_taken == 3600

    def test_time_taken_negative(self):
        """Test negative time taken rejected."""
        with pytest.raises(ValidationError) as exc_info:
            CultureAnswerRequest(selected_option=1, time_taken=-1)
        assert "greater than or equal to 0" in str(exc_info.value)

    def test_boundary_option_1(self):
        """Test option at lower boundary."""
        answer = CultureAnswerRequest(selected_option=1, time_taken=0)
        assert answer.selected_option == 1

    def test_boundary_option_4(self):
        """Test option at upper boundary."""
        answer = CultureAnswerRequest(selected_option=4, time_taken=300)
        assert answer.selected_option == 4
        assert answer.time_taken == 300


class TestCultureDeckResponse:
    """Test deck response schema."""

    def test_valid_deck(self):
        """Test valid deck response."""
        deck = CultureDeckResponse(
            id="12345678-1234-1234-1234-123456789abc",
            name="History",
            description="Learn about Greek history",
            icon="book-open",
            color_accent="#4F46E5",
            category="history",
            question_count=25,
            progress=None,
        )
        assert deck.question_count == 25
        assert deck.progress is None

    def test_valid_deck_with_progress(self):
        """Test valid deck response with progress."""
        progress = CultureDeckProgress(
            questions_total=50,
            questions_mastered=20,
            questions_learning=15,
            questions_new=15,
        )
        deck = CultureDeckResponse(
            id=uuid4(),
            name="Test Deck",
            description="Test description",
            icon="test",
            color_accent="#FFFFFF",
            category="history",
            question_count=50,
            progress=progress,
        )
        assert deck.progress is not None
        assert deck.progress.questions_total == 50

    def test_invalid_color_format(self):
        """Test invalid hex color format."""
        with pytest.raises(ValidationError) as exc_info:
            CultureDeckResponse(
                id="12345678-1234-1234-1234-123456789abc",
                name="Test Deck",
                description="Test description",
                icon="test",
                color_accent="invalid",  # Not hex format
                category="history",
                question_count=10,
            )
        assert "pattern" in str(exc_info.value).lower()

    def test_invalid_color_short(self):
        """Test invalid short hex color."""
        with pytest.raises(ValidationError) as exc_info:
            CultureDeckResponse(
                id=uuid4(),
                name="Test Deck",
                description="Test description",
                icon="test",
                color_accent="#FFF",  # Short form not allowed
                category="history",
                question_count=10,
            )
        assert "pattern" in str(exc_info.value).lower()

    def test_invalid_color_missing_hash(self):
        """Test hex color without hash prefix."""
        with pytest.raises(ValidationError) as exc_info:
            CultureDeckResponse(
                id=uuid4(),
                name="Test Deck",
                description="Test description",
                icon="test",
                color_accent="4F46E5",  # Missing #
                category="history",
                question_count=10,
            )
        assert "pattern" in str(exc_info.value).lower()

    def test_negative_question_count_rejected(self):
        """Test negative question count rejected."""
        with pytest.raises(ValidationError) as exc_info:
            CultureDeckResponse(
                id=uuid4(),
                name="Test Deck",
                description="Test description",
                icon="test",
                color_accent="#4F46E5",
                category="history",
                question_count=-1,
            )
        assert "greater than or equal to 0" in str(exc_info.value)


class TestCultureDeckProgress:
    """Test progress schema."""

    def test_valid_progress(self):
        """Test valid progress data."""
        progress = CultureDeckProgress(
            questions_total=50,
            questions_mastered=20,
            questions_learning=15,
            questions_new=15,
            last_practiced_at=None,
        )
        assert progress.questions_total == 50

    def test_progress_with_timestamp(self):
        """Test progress with last practiced timestamp."""
        now = datetime.now()
        progress = CultureDeckProgress(
            questions_total=50,
            questions_mastered=20,
            questions_learning=15,
            questions_new=15,
            last_practiced_at=now,
        )
        assert progress.last_practiced_at == now

    def test_negative_count_rejected(self):
        """Test negative question count rejected."""
        with pytest.raises(ValidationError):
            CultureDeckProgress(
                questions_total=-1,
                questions_mastered=0,
                questions_learning=0,
                questions_new=0,
            )

    def test_negative_mastered_rejected(self):
        """Test negative mastered count rejected."""
        with pytest.raises(ValidationError):
            CultureDeckProgress(
                questions_total=50,
                questions_mastered=-1,
                questions_learning=0,
                questions_new=0,
            )


class TestCultureQuestionResponse:
    """Test question response schema."""

    def test_valid_question(self):
        """Test valid question response."""
        question = CultureQuestionResponse(
            id=uuid4(),
            question_text={"el": "Ερώτηση", "en": "Question", "ru": "Вопрос"},
            options=[
                {"el": "A", "en": "A", "ru": "A"},
                {"el": "B", "en": "B", "ru": "B"},
                {"el": "C", "en": "C", "ru": "C"},
                {"el": "D", "en": "D", "ru": "D"},
            ],
            image_url=None,
            order_index=0,
        )
        assert len(question.options) == 4
        assert question.order_index == 0

    def test_question_with_image(self):
        """Test question with image URL."""
        question = CultureQuestionResponse(
            id=uuid4(),
            question_text={"el": "Test", "en": "Test", "ru": "Test"},
            options=[
                {"el": "A", "en": "A", "ru": "A"},
                {"el": "B", "en": "B", "ru": "B"},
                {"el": "C", "en": "C", "ru": "C"},
                {"el": "D", "en": "D", "ru": "D"},
            ],
            image_url="https://example.com/image.jpg",
            order_index=1,
        )
        assert question.image_url == "https://example.com/image.jpg"

    def test_too_few_options_rejected(self):
        """Test less than 4 options rejected."""
        with pytest.raises(ValidationError) as exc_info:
            CultureQuestionResponse(
                id=uuid4(),
                question_text={"el": "Test", "en": "Test", "ru": "Test"},
                options=[
                    {"el": "A", "en": "A", "ru": "A"},
                    {"el": "B", "en": "B", "ru": "B"},
                    {"el": "C", "en": "C", "ru": "C"},
                ],  # Only 3 options
                order_index=0,
            )
        assert "too_short" in str(exc_info.value).lower()

    def test_too_many_options_rejected(self):
        """Test more than 4 options rejected."""
        with pytest.raises(ValidationError) as exc_info:
            CultureQuestionResponse(
                id=uuid4(),
                question_text={"el": "Test", "en": "Test", "ru": "Test"},
                options=[
                    {"el": "A", "en": "A", "ru": "A"},
                    {"el": "B", "en": "B", "ru": "B"},
                    {"el": "C", "en": "C", "ru": "C"},
                    {"el": "D", "en": "D", "ru": "D"},
                    {"el": "E", "en": "E", "ru": "E"},
                ],  # 5 options
                order_index=0,
            )
        assert "too_long" in str(exc_info.value).lower()

    def test_negative_order_index_rejected(self):
        """Test negative order index rejected."""
        with pytest.raises(ValidationError):
            CultureQuestionResponse(
                id=uuid4(),
                question_text={"el": "Test", "en": "Test", "ru": "Test"},
                options=[
                    {"el": "A", "en": "A", "ru": "A"},
                    {"el": "B", "en": "B", "ru": "B"},
                    {"el": "C", "en": "C", "ru": "C"},
                    {"el": "D", "en": "D", "ru": "D"},
                ],
                order_index=-1,
            )


class TestCultureQuestionStatsResponse:
    """Test question stats schema."""

    def test_valid_stats(self):
        """Test valid stats response."""
        stats = CultureQuestionStatsResponse(
            easiness_factor=2.5,
            interval=7,
            repetitions=3,
            next_review_date=date.today(),
            status="learning",
        )
        assert stats.easiness_factor == 2.5
        assert stats.interval == 7

    def test_easiness_factor_below_range(self):
        """Test easiness factor below minimum."""
        with pytest.raises(ValidationError) as exc_info:
            CultureQuestionStatsResponse(
                easiness_factor=1.2,  # Below 1.3
                interval=7,
                repetitions=3,
                next_review_date=date.today(),
                status="learning",
            )
        assert "greater than or equal to 1.3" in str(exc_info.value)

    def test_easiness_factor_above_range(self):
        """Test easiness factor above maximum."""
        with pytest.raises(ValidationError) as exc_info:
            CultureQuestionStatsResponse(
                easiness_factor=2.6,  # Above 2.5
                interval=7,
                repetitions=3,
                next_review_date=date.today(),
                status="learning",
            )
        assert "less than or equal to 2.5" in str(exc_info.value)

    def test_negative_interval_rejected(self):
        """Test negative interval rejected."""
        with pytest.raises(ValidationError):
            CultureQuestionStatsResponse(
                easiness_factor=2.0,
                interval=-1,
                repetitions=3,
                next_review_date=date.today(),
                status="learning",
            )


class TestCultureOverallProgress:
    """Test overall progress schema."""

    def test_valid_overall_progress(self):
        """Test valid overall progress."""
        progress = CultureOverallProgress(
            total_questions=100,
            questions_mastered=50,
            questions_learning=30,
            questions_new=20,
            decks_started=5,
            decks_completed=2,
            accuracy_percentage=75.5,
            total_practice_sessions=25,
        )
        assert progress.total_questions == 100
        assert progress.accuracy_percentage == 75.5

    def test_accuracy_above_100_rejected(self):
        """Test accuracy above 100% rejected."""
        with pytest.raises(ValidationError) as exc_info:
            CultureOverallProgress(
                total_questions=100,
                questions_mastered=50,
                questions_learning=30,
                questions_new=20,
                decks_started=5,
                decks_completed=2,
                accuracy_percentage=101.0,  # Above 100
                total_practice_sessions=25,
            )
        assert "less than or equal to 100" in str(exc_info.value)

    def test_negative_accuracy_rejected(self):
        """Test negative accuracy rejected."""
        with pytest.raises(ValidationError) as exc_info:
            CultureOverallProgress(
                total_questions=100,
                questions_mastered=50,
                questions_learning=30,
                questions_new=20,
                decks_started=5,
                decks_completed=2,
                accuracy_percentage=-1.0,
                total_practice_sessions=25,
            )
        assert "greater than or equal to 0" in str(exc_info.value)


class TestCultureAnswerResponse:
    """Test answer response schema."""

    def test_valid_answer_response(self):
        """Test valid answer response."""
        response = CultureAnswerResponse(
            is_correct=True,
            correct_option=2,
            xp_earned=10,
            new_stats=CultureQuestionStatsResponse(
                easiness_factor=2.5,
                interval=7,
                repetitions=3,
                next_review_date=date.today(),
                status="learning",
            ),
        )
        assert response.is_correct is True
        assert response.xp_earned == 10

    def test_incorrect_answer_response(self):
        """Test incorrect answer response."""
        response = CultureAnswerResponse(
            is_correct=False,
            correct_option=3,
            xp_earned=0,
            new_stats=CultureQuestionStatsResponse(
                easiness_factor=1.3,
                interval=1,
                repetitions=0,
                next_review_date=date.today(),
                status="new",
            ),
        )
        assert response.is_correct is False
        assert response.xp_earned == 0


class TestCultureSessionSummary:
    """Test session summary schema."""

    def test_valid_session_summary(self):
        """Test valid session summary."""
        now = datetime.now()
        summary = CultureSessionSummary(
            session_id="sess-123",
            deck_id=uuid4(),
            deck_name="Test Deck",
            questions_answered=10,
            correct_count=8,
            incorrect_count=2,
            accuracy_percentage=80.0,
            xp_earned=50,
            duration_seconds=120,
            started_at=now,
            ended_at=now,
        )
        assert summary.questions_answered == 10
        assert summary.accuracy_percentage == 80.0

    def test_accuracy_boundary_100(self):
        """Test 100% accuracy is valid."""
        now = datetime.now()
        summary = CultureSessionSummary(
            session_id="sess-123",
            deck_id=uuid4(),
            deck_name="Test Deck",
            questions_answered=10,
            correct_count=10,
            incorrect_count=0,
            accuracy_percentage=100.0,
            xp_earned=100,
            duration_seconds=60,
            started_at=now,
            ended_at=now,
        )
        assert summary.accuracy_percentage == 100.0

    def test_accuracy_boundary_0(self):
        """Test 0% accuracy is valid."""
        now = datetime.now()
        summary = CultureSessionSummary(
            session_id="sess-123",
            deck_id=uuid4(),
            deck_name="Test Deck",
            questions_answered=10,
            correct_count=0,
            incorrect_count=10,
            accuracy_percentage=0.0,
            xp_earned=0,
            duration_seconds=60,
            started_at=now,
            ended_at=now,
        )
        assert summary.accuracy_percentage == 0.0
