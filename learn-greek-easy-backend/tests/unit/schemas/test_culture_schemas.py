"""Unit tests for culture schemas validation."""

from datetime import date, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from src.schemas.culture import (
    CultureAnswerRequest,
    CultureAnswerResponse,
    CultureDeckCreate,
    CultureDeckProgress,
    CultureDeckResponse,
    CultureDeckUpdate,
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

    def test_time_taken_at_max_limit(self):
        """Test time taken accepts values at the 180s limit."""
        answer = CultureAnswerRequest(selected_option=1, time_taken=180)
        assert answer.time_taken == 180

    def test_time_taken_above_limit_rejected(self):
        """Test time taken above 180 seconds is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            CultureAnswerRequest(selected_option=1, time_taken=181)
        assert "less than or equal to 180" in str(exc_info.value)

        with pytest.raises(ValidationError) as exc_info:
            CultureAnswerRequest(selected_option=1, time_taken=600)
        assert "less than or equal to 180" in str(exc_info.value)

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
        answer = CultureAnswerRequest(selected_option=4, time_taken=180)
        assert answer.selected_option == 4
        assert answer.time_taken == 180


class TestCultureDeckResponse:
    """Test deck response schema."""

    def test_valid_deck(self):
        """Test valid deck response."""
        deck = CultureDeckResponse(
            id="12345678-1234-1234-1234-123456789abc",
            name="History",
            description="Learn about Greek history",
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
            category="history",
            question_count=50,
            progress=progress,
        )
        assert deck.progress is not None
        assert deck.progress.questions_total == 50

    def test_negative_question_count_rejected(self):
        """Test negative question count rejected."""
        with pytest.raises(ValidationError) as exc_info:
            CultureDeckResponse(
                id=uuid4(),
                name="Test Deck",
                description="Test description",
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
        """Test valid question response with 4 options."""
        question = CultureQuestionResponse(
            id=uuid4(),
            question_text={"el": "Ερώτηση", "en": "Question", "ru": "Вопрос"},
            options=[
                {"el": "A", "en": "A", "ru": "A"},
                {"el": "B", "en": "B", "ru": "B"},
                {"el": "C", "en": "C", "ru": "C"},
                {"el": "D", "en": "D", "ru": "D"},
            ],
            option_count=4,
            image_url=None,
            order_index=0,
        )
        assert len(question.options) == 4
        assert question.option_count == 4
        assert question.order_index == 0

    def test_valid_question_with_2_options(self):
        """Test valid question response with 2 options."""
        question = CultureQuestionResponse(
            id=uuid4(),
            question_text={"el": "Ερώτηση", "en": "Question", "ru": "Вопрос"},
            options=[
                {"el": "A", "en": "A", "ru": "A"},
                {"el": "B", "en": "B", "ru": "B"},
            ],
            option_count=2,
            image_url=None,
            order_index=0,
        )
        assert len(question.options) == 2
        assert question.option_count == 2

    def test_valid_question_with_3_options(self):
        """Test valid question response with 3 options."""
        question = CultureQuestionResponse(
            id=uuid4(),
            question_text={"el": "Ερώτηση", "en": "Question", "ru": "Вопрос"},
            options=[
                {"el": "A", "en": "A", "ru": "A"},
                {"el": "B", "en": "B", "ru": "B"},
                {"el": "C", "en": "C", "ru": "C"},
            ],
            option_count=3,
            image_url=None,
            order_index=0,
        )
        assert len(question.options) == 3
        assert question.option_count == 3

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
            option_count=4,
            image_url="https://example.com/image.jpg",
            order_index=1,
        )
        assert question.image_url == "https://example.com/image.jpg"

    def test_too_few_options_rejected(self):
        """Test less than 2 options rejected."""
        with pytest.raises(ValidationError) as exc_info:
            CultureQuestionResponse(
                id=uuid4(),
                question_text={"el": "Test", "en": "Test", "ru": "Test"},
                options=[
                    {"el": "A", "en": "A", "ru": "A"},
                ],  # Only 1 option
                option_count=1,
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
                option_count=5,
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
                option_count=4,
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


class TestCultureDeckResponseIsPremium:
    """Test CultureDeckResponse is_premium field."""

    def test_deck_response_is_premium_default_false(self):
        """Test is_premium defaults to False."""
        deck = CultureDeckResponse(
            id=uuid4(),
            name="Test Deck",
            description="Test description",
            category="history",
            question_count=10,
            progress=None,
        )
        assert deck.is_premium is False

    def test_deck_response_is_premium_true(self):
        """Test is_premium can be set to True."""
        deck = CultureDeckResponse(
            id=uuid4(),
            name="Premium Deck",
            description="Premium content",
            category="history",
            question_count=20,
            is_premium=True,
            progress=None,
        )
        assert deck.is_premium is True

    def test_deck_response_is_premium_false_explicit(self):
        """Test is_premium can be explicitly set to False."""
        deck = CultureDeckResponse(
            id=uuid4(),
            name="Free Deck",
            description="Free content",
            category="geography",
            question_count=15,
            is_premium=False,
            progress=None,
        )
        assert deck.is_premium is False

    def test_deck_response_with_progress_and_premium(self):
        """Test deck response with progress includes is_premium."""
        progress = CultureDeckProgress(
            questions_total=50,
            questions_mastered=20,
            questions_learning=15,
            questions_new=15,
        )
        deck = CultureDeckResponse(
            id=uuid4(),
            name="Premium with Progress",
            description="Test",
            category="politics",
            question_count=50,
            is_premium=True,
            progress=progress,
        )
        assert deck.is_premium is True
        assert deck.progress.questions_total == 50


class TestCultureDeckCreate:
    """Test CultureDeckCreate schema validation with trilingual fields."""

    def test_create_deck_with_trilingual_names(self):
        """Test creating deck with trilingual names."""
        deck_data = CultureDeckCreate(
            name_el="Ιστορία",
            name_en="History",
            name_ru="История",
            category="history",
            order_index=0,
        )
        assert deck_data.name_el == "Ιστορία"
        assert deck_data.name_en == "History"
        assert deck_data.name_ru == "История"

    def test_create_deck_with_trilingual_descriptions(self):
        """Test creating deck with trilingual descriptions."""
        deck_data = CultureDeckCreate(
            name_el="Ιστορία",
            name_en="History",
            name_ru="История",
            description_el="Ελληνική ιστορία",
            description_en="Greek history",
            description_ru="Греческая история",
            category="history",
            order_index=0,
        )
        assert deck_data.description_el == "Ελληνική ιστορία"
        assert deck_data.description_en == "Greek history"
        assert deck_data.description_ru == "Греческая история"

    def test_create_deck_with_is_premium_default_false(self):
        """Test is_premium defaults to False on create."""
        deck_data = CultureDeckCreate(
            name_el="New Culture Deck",
            name_en="New Culture Deck",
            name_ru="Новый Deck",
            category="history",
            order_index=0,
        )
        assert deck_data.is_premium is False

    def test_create_deck_with_is_premium_true(self):
        """Test is_premium can be set to True on create."""
        deck_data = CultureDeckCreate(
            name_el="Premium Culture Deck",
            name_en="Premium Culture Deck",
            name_ru="Премиум Deck",
            category="traditions",
            order_index=0,
            is_premium=True,
        )
        assert deck_data.is_premium is True

    def test_create_deck_with_is_premium_false_explicit(self):
        """Test is_premium can be explicitly False on create."""
        deck_data = CultureDeckCreate(
            name_el="Free Culture Deck",
            name_en="Free Culture Deck",
            name_ru="Бесплатный Deck",
            category="geography",
            order_index=0,
            is_premium=False,
        )
        assert deck_data.is_premium is False

    def test_create_deck_missing_name_el_rejected(self):
        """Test that missing name_el is rejected."""
        with pytest.raises(ValidationError):
            CultureDeckCreate(
                name_en="History",
                name_ru="История",
                category="history",
                order_index=0,
            )

    def test_create_deck_missing_name_en_rejected(self):
        """Test that missing name_en is rejected."""
        with pytest.raises(ValidationError):
            CultureDeckCreate(
                name_el="Ιστορία",
                name_ru="История",
                category="history",
                order_index=0,
            )

    def test_create_deck_missing_name_ru_rejected(self):
        """Test that missing name_ru is rejected."""
        with pytest.raises(ValidationError):
            CultureDeckCreate(
                name_el="Ιστορία",
                name_en="History",
                category="history",
                order_index=0,
            )

    def test_create_deck_descriptions_optional(self):
        """Test that descriptions are optional."""
        deck_data = CultureDeckCreate(
            name_el="Test",
            name_en="Test",
            name_ru="Test",
            category="history",
            order_index=0,
        )
        assert deck_data.description_el is None
        assert deck_data.description_en is None
        assert deck_data.description_ru is None


class TestCultureDeckUpdate:
    """Test CultureDeckUpdate schema validation with trilingual fields."""

    def test_update_is_premium_only(self):
        """Test updating only is_premium field."""
        update = CultureDeckUpdate(is_premium=True)
        assert update.is_premium is True
        assert update.name_el is None
        assert update.name_en is None
        assert update.name_ru is None
        assert update.is_active is None

    def test_update_is_premium_false(self):
        """Test updating is_premium to False."""
        update = CultureDeckUpdate(is_premium=False)
        assert update.is_premium is False

    def test_update_single_language_name(self):
        """Test updating only one language name."""
        update = CultureDeckUpdate(name_ru="Обновленное название")
        assert update.name_ru == "Обновленное название"
        assert update.name_el is None
        assert update.name_en is None

    def test_update_is_premium_and_is_active_independent(self):
        """Test is_premium and is_active can be updated independently."""
        # Set premium only
        update1 = CultureDeckUpdate(is_premium=True)
        assert update1.is_premium is True
        assert update1.is_active is None

        # Set active only
        update2 = CultureDeckUpdate(is_active=False)
        assert update2.is_active is False
        assert update2.is_premium is None

        # Set both - they should be independent
        update3 = CultureDeckUpdate(is_active=False, is_premium=True)
        assert update3.is_active is False
        assert update3.is_premium is True

    def test_update_all_trilingual_fields(self):
        """Test updating all trilingual fields."""
        update = CultureDeckUpdate(
            name_el="Νέο Όνομα",
            name_en="New Name",
            name_ru="Новое Имя",
            description_el="Νέα περιγραφή",
            description_en="New description",
            description_ru="Новое описание",
            category="geography",
            order_index=5,
            is_active=True,
            is_premium=True,
        )
        assert update.name_el == "Νέο Όνομα"
        assert update.name_en == "New Name"
        assert update.name_ru == "Новое Имя"
        assert update.is_active is True
        assert update.is_premium is True

    def test_update_empty_all_fields_none(self):
        """Test empty update has all fields as None."""
        update = CultureDeckUpdate()
        assert update.name_el is None
        assert update.name_en is None
        assert update.name_ru is None
        assert update.description_el is None
        assert update.description_en is None
        assert update.description_ru is None
        assert update.category is None
        assert update.order_index is None
        assert update.is_active is None
        assert update.is_premium is None


class TestCultureDeckAdminResponse:
    """Test CultureDeckAdminResponse schema validation."""

    def test_valid_admin_response_with_trilingual_fields(self):
        """Test valid admin response with all language fields."""
        from datetime import datetime

        from src.schemas.culture import CultureDeckAdminResponse

        now = datetime.now()
        response = CultureDeckAdminResponse(
            id=uuid4(),
            name_el="Ιστορία",
            name_en="History",
            name_ru="История",
            description_el="Ελληνική ιστορία",
            description_en="Greek history",
            description_ru="Греческая история",
            category="history",
            question_count=25,
            is_active=True,
            is_premium=False,
            order_index=0,
            created_at=now,
            updated_at=now,
        )
        assert response.name_el == "Ιστορία"
        assert response.name_en == "History"
        assert response.name_ru == "История"
        assert response.question_count == 25

    def test_admin_response_descriptions_can_be_none(self):
        """Test that description fields can be None."""
        from datetime import datetime

        from src.schemas.culture import CultureDeckAdminResponse

        now = datetime.now()
        response = CultureDeckAdminResponse(
            id=uuid4(),
            name_el="Test",
            name_en="Test",
            name_ru="Test",
            description_el=None,
            description_en=None,
            description_ru=None,
            category="history",
            question_count=0,
            is_active=True,
            is_premium=False,
            order_index=0,
            created_at=now,
            updated_at=now,
        )
        assert response.description_el is None
        assert response.description_en is None
        assert response.description_ru is None
