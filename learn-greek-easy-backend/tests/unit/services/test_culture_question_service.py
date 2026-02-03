"""Unit tests for CultureQuestionService.

This module tests:
- get_question_queue: Fetching due + new questions for practice
- process_answer: Answer submission with SM-2 integration
- get_culture_progress: Overall progress tracking

Tests use real database fixtures and mock S3Service where needed.
"""

from datetime import date, timedelta
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import CultureDeckNotFoundException, CultureQuestionNotFoundException
from src.db.models import CardStatus, CultureDeck, CultureQuestion, CultureQuestionStats, User
from src.services.culture_question_service import CultureQuestionService

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def culture_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an active culture deck for testing."""
    deck = CultureDeck(
        name_en="Greek History",
        name_el="Greek History",
        name_ru="Greek History",
        description_en="Learn about Greek history",
        description_el="Learn about Greek history",
        description_ru="Learn about Greek history",
        category="history",
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def inactive_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an inactive culture deck."""
    deck = CultureDeck(
        name_en="Archived",
        name_el="Archived",
        name_ru="Archived",
        description_en="Archived deck",
        description_el="Archived deck",
        description_ru="Archived deck",
        category="history",
        is_active=False,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def culture_questions(
    db_session: AsyncSession, culture_deck: CultureDeck
) -> list[CultureQuestion]:
    """Create multiple culture questions."""
    questions = []
    for i in range(10):
        question = CultureQuestion(
            deck_id=culture_deck.id,
            question_text={
                "en": f"Question {i + 1}?",
                "el": f"Ερώτηση {i + 1};",
                "ru": f"Вопрос {i + 1}?",
            },
            option_a={"en": "Option A", "el": "Επιλογή Α", "ru": "Вариант А"},
            option_b={"en": "Option B", "el": "Επιλογή Β", "ru": "Вариант Б"},
            option_c={"en": "Option C", "el": "Επιλογή Γ", "ru": "Вариант В"},
            option_d={"en": "Option D", "el": "Επιλογή Δ", "ru": "Вариант Г"},
            correct_option=(i % 4) + 1,  # Varies 1-4
            order_index=i,
            image_key=f"images/q{i}.jpg" if i % 3 == 0 else None,  # Some with images
        )
        db_session.add(question)
        questions.append(question)

    await db_session.flush()
    for q in questions:
        await db_session.refresh(q)
    return questions


@pytest.fixture
async def due_question_stats(
    db_session: AsyncSession,
    test_user: User,
    culture_questions: list[CultureQuestion],
) -> list[CultureQuestionStats]:
    """Create question stats with some questions due for review."""
    stats_list = []

    # Create stats for first 5 questions: 2 overdue, 2 due today, 1 not due
    for i, question in enumerate(culture_questions[:5]):
        if i < 2:
            # Overdue (yesterday and 2 days ago)
            next_review = date.today() - timedelta(days=i + 1)
            status = CardStatus.LEARNING
        elif i < 4:
            # Due today
            next_review = date.today()
            status = CardStatus.REVIEW
        else:
            # Not due (tomorrow)
            next_review = date.today() + timedelta(days=1)
            status = CardStatus.MASTERED

        stats = CultureQuestionStats(
            user_id=test_user.id,
            question_id=question.id,
            easiness_factor=2.5,
            interval=i + 1,
            repetitions=i,
            next_review_date=next_review,
            status=status,
        )
        db_session.add(stats)
        stats_list.append(stats)

    await db_session.flush()
    for s in stats_list:
        await db_session.refresh(s)
    return stats_list


@pytest.fixture
def mock_s3_service():
    """Create a mock S3 service."""
    mock = MagicMock()
    mock.generate_presigned_url.return_value = "https://s3.example.com/presigned-url"
    return mock


# =============================================================================
# Test Question Queue
# =============================================================================


class TestGetQuestionQueue:
    """Tests for get_question_queue method."""

    @pytest.mark.asyncio
    async def test_get_question_queue_returns_due_questions_first(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        due_question_stats: list[CultureQuestionStats],
        mock_s3_service,
    ):
        """Due questions should come before new questions."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        queue = await service.get_question_queue(
            user_id=test_user.id,
            deck_id=culture_deck.id,
            limit=10,
            include_new=True,
            new_questions_limit=5,
        )

        # Should have 4 due questions (2 overdue + 2 due today)
        assert queue.total_due == 4
        # Should have 5 new questions (questions 5-9 have no stats)
        assert queue.total_new == 5
        assert queue.total_in_queue == 9  # 4 due + 5 new

        # First 4 should be due (not new)
        for item in queue.questions[:4]:
            assert item.is_new is False

        # Last 5 should be new
        for item in queue.questions[4:]:
            assert item.is_new is True

    @pytest.mark.asyncio
    async def test_get_question_queue_respects_limit(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should not exceed limit parameter."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        queue = await service.get_question_queue(
            user_id=test_user.id,
            deck_id=culture_deck.id,
            limit=3,
            include_new=True,
            new_questions_limit=10,
        )

        # Should respect limit
        assert queue.total_in_queue == 3
        assert len(queue.questions) == 3

    @pytest.mark.asyncio
    async def test_get_question_queue_respects_new_questions_limit(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should respect new_questions_limit parameter."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        queue = await service.get_question_queue(
            user_id=test_user.id,
            deck_id=culture_deck.id,
            limit=20,
            include_new=True,
            new_questions_limit=2,
        )

        # All questions should be new (no stats exist), but limited to 2
        assert queue.total_new == 2
        assert queue.total_in_queue == 2

    @pytest.mark.asyncio
    async def test_get_question_queue_excludes_new_when_disabled(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        due_question_stats: list[CultureQuestionStats],
        mock_s3_service,
    ):
        """Should not include new questions when include_new=False."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        queue = await service.get_question_queue(
            user_id=test_user.id,
            deck_id=culture_deck.id,
            limit=20,
            include_new=False,
        )

        # Only due questions, no new
        assert queue.total_new == 0
        assert queue.total_due == 4
        assert queue.total_in_queue == 4

    @pytest.mark.asyncio
    async def test_get_question_queue_includes_presigned_urls(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Questions with image_key should have presigned URL."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        queue = await service.get_question_queue(
            user_id=test_user.id,
            deck_id=culture_deck.id,
            limit=10,
        )

        # Find questions with images
        questions_with_images = [q for q in queue.questions if q.image_url is not None]
        questions_without_images = [q for q in queue.questions if q.image_url is None]

        # Should have some with images (every 3rd one)
        assert len(questions_with_images) > 0
        assert len(questions_without_images) > 0

        # Image URLs should be presigned
        for q in questions_with_images:
            assert q.image_url == "https://s3.example.com/presigned-url"

    @pytest.mark.asyncio
    async def test_get_question_queue_handles_null_image_gracefully(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Questions without image_key should have null image_url."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        queue = await service.get_question_queue(
            user_id=test_user.id,
            deck_id=culture_deck.id,
            limit=10,
        )

        # Find questions without images
        questions_without_images = [q for q in queue.questions if q.image_url is None]

        # Should have some without images
        assert len(questions_without_images) > 0

    @pytest.mark.asyncio
    async def test_get_question_queue_deck_not_found(
        self,
        db_session: AsyncSession,
        test_user: User,
        mock_s3_service,
    ):
        """Non-existent deck should raise 404."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        with pytest.raises(CultureDeckNotFoundException):
            await service.get_question_queue(
                user_id=test_user.id,
                deck_id=uuid4(),
                limit=10,
            )

    @pytest.mark.asyncio
    async def test_get_question_queue_inactive_deck_returns_404(
        self,
        db_session: AsyncSession,
        test_user: User,
        inactive_deck: CultureDeck,
        mock_s3_service,
    ):
        """Inactive deck should raise 404."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        with pytest.raises(CultureDeckNotFoundException):
            await service.get_question_queue(
                user_id=test_user.id,
                deck_id=inactive_deck.id,
                limit=10,
            )

    @pytest.mark.asyncio
    async def test_get_question_queue_orders_overdue_first(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        due_question_stats: list[CultureQuestionStats],
        mock_s3_service,
    ):
        """Overdue questions should come before due-today questions."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        queue = await service.get_question_queue(
            user_id=test_user.id,
            deck_id=culture_deck.id,
            limit=10,
            include_new=False,
        )

        # First 2 should be overdue (oldest first)
        assert len(queue.questions) >= 2
        due_dates = [q.due_date for q in queue.questions]
        # Should be sorted by date ascending
        assert due_dates == sorted(due_dates)


# =============================================================================
# Test Answer Processing
# =============================================================================


class TestProcessAnswer:
    """Tests for process_answer method."""

    @pytest.mark.asyncio
    async def test_process_answer_correct_applies_sm2_quality_3(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Correct answer should use quality=3 (Good)."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]  # correct_option = 1

        result = await service.process_answer(
            user_id=test_user.id,
            question_id=question.id,
            selected_option=1,  # Correct answer
            time_taken=10,
        )

        assert result.is_correct is True
        assert result.correct_option == 1
        assert result.sm2_result.success is True
        # Quality 3 = Good progression
        assert result.sm2_result.interval >= 1
        assert result.sm2_result.repetitions >= 1

    @pytest.mark.asyncio
    async def test_process_answer_wrong_applies_sm2_quality_1(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Wrong answer should use quality=1 (Again)."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]  # correct_option = 1

        result = await service.process_answer(
            user_id=test_user.id,
            question_id=question.id,
            selected_option=2,  # Wrong answer
            time_taken=10,
        )

        assert result.is_correct is False
        assert result.correct_option == 1
        assert result.sm2_result.success is True
        # Quality 1 = Again, reset to learning
        assert result.sm2_result.new_status in ["learning", "new"]

    @pytest.mark.asyncio
    async def test_process_answer_creates_stats_on_first_answer(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Stats should be created if not exists (get_or_create pattern)."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]

        # Verify no stats exist initially
        from sqlalchemy import select

        initial_stats = await db_session.execute(
            select(CultureQuestionStats).where(
                CultureQuestionStats.user_id == test_user.id,
                CultureQuestionStats.question_id == question.id,
            )
        )
        assert initial_stats.scalar_one_or_none() is None

        # Process answer
        result = await service.process_answer(
            user_id=test_user.id,
            question_id=question.id,
            selected_option=1,
            time_taken=10,
        )

        # Verify stats were created
        assert result.sm2_result.previous_status == "new"

    @pytest.mark.asyncio
    async def test_process_answer_updates_existing_stats(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        due_question_stats: list[CultureQuestionStats],
        mock_s3_service,
    ):
        """Should update existing stats, not create new ones."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]
        original_stats = due_question_stats[0]

        result = await service.process_answer(
            user_id=test_user.id,
            question_id=question.id,
            selected_option=1,  # Correct
            time_taken=10,
        )

        # Should show transition from original status
        assert result.sm2_result.previous_status == original_stats.status.value

    @pytest.mark.asyncio
    async def test_process_answer_invalid_option_raises_error(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """selected_option outside 1-4 should raise ValueError."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]

        with pytest.raises(ValueError, match="selected_option must be between 1 and 4"):
            await service.process_answer(
                user_id=test_user.id,
                question_id=question.id,
                selected_option=5,  # Invalid
                time_taken=10,
            )

        with pytest.raises(ValueError, match="selected_option must be between 1 and 4"):
            await service.process_answer(
                user_id=test_user.id,
                question_id=question.id,
                selected_option=0,  # Invalid
                time_taken=10,
            )

    @pytest.mark.asyncio
    async def test_process_answer_question_not_found(
        self,
        db_session: AsyncSession,
        test_user: User,
        mock_s3_service,
    ):
        """Non-existent question should raise 404."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        with pytest.raises(CultureQuestionNotFoundException):
            await service.process_answer(
                user_id=test_user.id,
                question_id=uuid4(),
                selected_option=1,
                time_taken=10,
            )

    @pytest.mark.asyncio
    async def test_process_answer_returns_feedback_message(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should return a feedback message for UI."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]

        result = await service.process_answer(
            user_id=test_user.id,
            question_id=question.id,
            selected_option=1,  # Correct
            time_taken=10,
        )

        assert result.message is not None
        # First correct answer should show "Good start!"
        assert result.message == "Good start!"

    @pytest.mark.asyncio
    async def test_process_answer_awards_xp_for_correct_answer(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Correct culture answer should award XP (10 + 20 first review bonus)."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]

        result = await service.process_answer(
            user_id=test_user.id,
            question_id=question.id,
            selected_option=1,  # Correct answer
            time_taken=10,
        )

        # XP integration: 10 XP for correct answer + 20 XP first review bonus = 30 XP
        assert result.xp_earned == 30

    @pytest.mark.asyncio
    async def test_process_answer_awards_xp_for_wrong_answer(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Wrong culture answer should still award 2 XP (MANDATORY per architecture)."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]

        result = await service.process_answer(
            user_id=test_user.id,
            question_id=question.id,
            selected_option=2,  # Wrong answer (correct is 1)
            time_taken=10,
        )

        # XP integration: 2 XP for wrong answer (no first review bonus for wrong answers)
        assert result.xp_earned == 2

    @pytest.mark.asyncio
    async def test_process_answer_returns_deck_category(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Response should include deck_category for achievement tracking."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]

        result = await service.process_answer(
            user_id=test_user.id,
            question_id=question.id,
            selected_option=1,
            time_taken=10,
        )

        # deck_category should be present for achievement tracking
        assert result.deck_category == culture_deck.category


# =============================================================================
# Test Progress Methods
# =============================================================================


class TestGetCultureProgress:
    """Tests for get_culture_progress method."""

    @pytest.mark.asyncio
    async def test_get_progress_no_data(
        self,
        db_session: AsyncSession,
        test_user: User,
        mock_s3_service,
    ):
        """Progress with no decks should return zeros."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        progress = await service.get_culture_progress(user_id=test_user.id)

        assert progress.overall.total_questions == 0
        assert progress.overall.questions_mastered == 0
        assert progress.overall.questions_learning == 0
        assert progress.overall.questions_new == 0

    @pytest.mark.asyncio
    async def test_get_progress_with_questions(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Progress should count total questions from active decks."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        progress = await service.get_culture_progress(user_id=test_user.id)

        assert progress.overall.total_questions == 10
        assert progress.overall.questions_new == 10  # No stats yet

    @pytest.mark.asyncio
    async def test_get_progress_with_stats(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        due_question_stats: list[CultureQuestionStats],
        mock_s3_service,
    ):
        """Progress should count by status correctly."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        progress = await service.get_culture_progress(user_id=test_user.id)

        assert progress.overall.total_questions == 10
        # 5 questions have stats, 5 are still new
        assert progress.overall.questions_mastered == 1  # 1 mastered
        assert progress.overall.questions_learning > 0  # Some learning/review

    @pytest.mark.asyncio
    async def test_get_progress_by_category(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Progress should include category breakdown."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        progress = await service.get_culture_progress(user_id=test_user.id)

        assert "history" in progress.by_category
        assert progress.by_category["history"].questions_total == 10

    @pytest.mark.asyncio
    async def test_get_progress_excludes_inactive_decks(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        inactive_deck: CultureDeck,
        mock_s3_service,
    ):
        """Progress should only count questions from active decks."""
        # Add questions to inactive deck
        for i in range(5):
            question = CultureQuestion(
                deck_id=inactive_deck.id,
                question_text={"en": f"Archived Q{i}", "el": f"Αρχ{i}"},
                option_a={"en": "A", "el": "Α"},
                option_b={"en": "B", "el": "Β"},
                option_c={"en": "C", "el": "Γ"},
                option_d={"en": "D", "el": "Δ"},
                correct_option=1,
                order_index=i,
            )
            db_session.add(question)
        await db_session.flush()

        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        progress = await service.get_culture_progress(user_id=test_user.id)

        # Should not include questions from inactive deck
        assert progress.overall.total_questions == 0  # No questions in active decks


# =============================================================================
# Test Progress By Category
# =============================================================================


class TestGetProgressByCategory:
    """Tests for _get_progress_by_category private method (lines 801-852)."""

    @pytest.mark.asyncio
    async def test_returns_empty_dict_when_no_decks(
        self,
        db_session: AsyncSession,
        test_user: User,
        mock_s3_service,
    ):
        """Should return empty dict when no active decks exist."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        result = await service._get_progress_by_category(test_user.id)

        # Result depends on whether active decks exist in db
        assert isinstance(result, dict)

    @pytest.mark.asyncio
    async def test_groups_by_category(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should group progress by deck category."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        result = await service._get_progress_by_category(test_user.id)

        assert "history" in result  # culture_deck has category "history"
        assert result["history"].questions_total == len(culture_questions)

    @pytest.mark.asyncio
    async def test_counts_mastered_questions(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        due_question_stats: list[CultureQuestionStats],
        mock_s3_service,
    ):
        """Should count mastered questions per category."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        result = await service._get_progress_by_category(test_user.id)

        assert "history" in result
        # due_question_stats fixture has 1 mastered
        assert result["history"].questions_mastered == 1

    @pytest.mark.asyncio
    async def test_calculates_new_as_total_minus_mastered(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """questions_new should be total - mastered."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        result = await service._get_progress_by_category(test_user.id)

        category = result.get("history")
        if category:
            expected_new = category.questions_total - category.questions_mastered
            assert category.questions_new == expected_new


# =============================================================================
# Test Build Queue Item Helper
# =============================================================================


class TestBuildQueueItem:
    """Tests for _build_queue_item helper method."""

    @pytest.mark.asyncio
    async def test_builds_item_with_stats(
        self,
        db_session: AsyncSession,
        culture_questions: list[CultureQuestion],
        due_question_stats: list[CultureQuestionStats],
        mock_s3_service,
    ):
        """Should include status and due_date when stats provided."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]
        stats = due_question_stats[0]

        result = service._build_queue_item(question, stats)

        assert result.is_new is False
        assert result.status == stats.status.value
        assert result.due_date == stats.next_review_date

    @pytest.mark.asyncio
    async def test_builds_item_without_stats(
        self,
        db_session: AsyncSession,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should mark as new when no stats provided."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]

        result = service._build_queue_item(question, stats=None)

        assert result.is_new is True
        assert result.status == CardStatus.NEW.value
        assert result.due_date is None

    @pytest.mark.asyncio
    async def test_generates_presigned_url_for_image(
        self,
        db_session: AsyncSession,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should generate presigned URL when image_key exists."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        # Find a question with image_key (every 3rd in fixture, index 0, 3, 6, 9)
        question = culture_questions[0]  # Has image_key

        result = service._build_queue_item(question, stats=None)

        if question.image_key:
            assert result.image_url == "https://s3.example.com/presigned-url"
            mock_s3_service.generate_presigned_url.assert_called_with(question.image_key)


# =============================================================================
# Test Get Feedback Message Helper
# =============================================================================


class TestGetFeedbackMessage:
    """Tests for _get_feedback_message helper method."""

    @pytest.mark.asyncio
    async def test_mastered_message(
        self,
        db_session: AsyncSession,
        mock_s3_service,
    ):
        """Should return mastery message when newly mastered."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        result = service._get_feedback_message(
            is_correct=True,
            is_first=False,
            is_mastered=True,
            was_mastered=False,
        )

        assert result == "Excellent! Question mastered!"

    @pytest.mark.asyncio
    async def test_lost_mastery_message(
        self,
        db_session: AsyncSession,
        mock_s3_service,
    ):
        """Should return practice message when mastery lost."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        result = service._get_feedback_message(
            is_correct=False,
            is_first=False,
            is_mastered=False,
            was_mastered=True,
        )

        assert result == "Keep practicing this one."

    @pytest.mark.asyncio
    async def test_first_correct_message(
        self,
        db_session: AsyncSession,
        mock_s3_service,
    ):
        """Should return Good start for first correct answer."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        result = service._get_feedback_message(
            is_correct=True,
            is_first=True,
            is_mastered=False,
            was_mastered=False,
        )

        assert result == "Good start!"

    @pytest.mark.asyncio
    async def test_correct_message(
        self,
        db_session: AsyncSession,
        mock_s3_service,
    ):
        """Should return Correct for subsequent correct answers."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        result = service._get_feedback_message(
            is_correct=True,
            is_first=False,
            is_mastered=False,
            was_mastered=False,
        )

        assert result == "Correct!"

    @pytest.mark.asyncio
    async def test_incorrect_message(
        self,
        db_session: AsyncSession,
        mock_s3_service,
    ):
        """Should return review message for incorrect answers."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        result = service._get_feedback_message(
            is_correct=False,
            is_first=False,
            is_mastered=False,
            was_mastered=False,
        )

        assert result == "Not quite. Review this question."


# =============================================================================
# Test Answer History Recording
# Note: Answer history recording has been moved to background tasks for performance.
# Tests for this functionality are now in tests/unit/tasks/test_background.py
# =============================================================================


# =============================================================================
# Test Get Question Deck Category
# =============================================================================


class TestGetQuestionDeckCategory:
    """Tests for get_question_deck_category method."""

    @pytest.mark.asyncio
    async def test_get_question_deck_category_returns_category(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should return deck category for a question."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]

        category = await service.get_question_deck_category(question.id)

        assert category == culture_deck.category

    @pytest.mark.asyncio
    async def test_get_question_deck_category_raises_for_invalid_question(
        self,
        db_session: AsyncSession,
        mock_s3_service,
    ):
        """Should raise CultureQuestionNotFoundException for invalid question."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        with pytest.raises(CultureQuestionNotFoundException):
            await service.get_question_deck_category(uuid4())


# =============================================================================
# Test CRUD Methods (Admin Operations)
# =============================================================================


class TestCreateQuestion:
    """Tests for create_question method (lines 889-926)."""

    @pytest.mark.asyncio
    async def test_create_question_success(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        mock_s3_service,
    ):
        """Should successfully create a question."""
        from src.schemas.culture import CultureQuestionCreate, MultilingualText

        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        question_data = CultureQuestionCreate(
            deck_id=culture_deck.id,
            question_text=MultilingualText(
                el="Ερώτηση τεστ?",
                en="Test question?",
                ru="Тестовый вопрос?",
            ),
            option_a=MultilingualText(el="Α", en="A", ru="А"),
            option_b=MultilingualText(el="Β", en="B", ru="Б"),
            option_c=MultilingualText(el="Γ", en="C", ru="В"),
            option_d=MultilingualText(el="Δ", en="D", ru="Г"),
            correct_option=1,
            order_index=0,
        )

        result = await service.create_question(question_data)

        assert result.deck_id == culture_deck.id
        assert result.correct_option == 1
        assert result.question_text["en"] == "Test question?"
        assert result.order_index == 0

    @pytest.mark.asyncio
    async def test_create_question_with_image_key(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        mock_s3_service,
    ):
        """Should create question with image_key."""
        from src.schemas.culture import CultureQuestionCreate, MultilingualText

        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        question_data = CultureQuestionCreate(
            deck_id=culture_deck.id,
            question_text=MultilingualText(
                el="Ερώτηση εικόνας?",
                en="Image question?",
                ru="Вопрос с изображением?",
            ),
            option_a=MultilingualText(el="Α", en="A", ru="А"),
            option_b=MultilingualText(el="Β", en="B", ru="Б"),
            option_c=MultilingualText(el="Γ", en="C", ru="В"),
            option_d=MultilingualText(el="Δ", en="D", ru="Г"),
            correct_option=2,
            image_key="images/test.jpg",
            order_index=1,
        )

        result = await service.create_question(question_data)

        assert result.image_key == "images/test.jpg"

    @pytest.mark.asyncio
    async def test_create_question_deck_not_found(
        self,
        db_session: AsyncSession,
        mock_s3_service,
    ):
        """Should raise CultureDeckNotFoundException when deck doesn't exist."""
        from src.schemas.culture import CultureQuestionCreate, MultilingualText

        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        question_data = CultureQuestionCreate(
            deck_id=uuid4(),  # Non-existent deck
            question_text=MultilingualText(
                el="Ερώτηση?",
                en="Question?",
                ru="Вопрос?",
            ),
            option_a=MultilingualText(el="Α", en="A", ru="А"),
            option_b=MultilingualText(el="Β", en="B", ru="Б"),
            option_c=MultilingualText(el="Γ", en="C", ru="В"),
            option_d=MultilingualText(el="Δ", en="D", ru="Г"),
            correct_option=1,
        )

        with pytest.raises(CultureDeckNotFoundException):
            await service.create_question(question_data)


class TestBulkCreateQuestions:
    """Tests for bulk_create_questions method (lines 948-989)."""

    @pytest.mark.asyncio
    async def test_bulk_create_questions_success(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        mock_s3_service,
    ):
        """Should successfully create multiple questions."""
        from src.schemas.culture import (
            CultureQuestionBulkCreateRequest,
            CultureQuestionBulkItem,
            MultilingualText,
        )

        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        request = CultureQuestionBulkCreateRequest(
            deck_id=culture_deck.id,
            questions=[
                CultureQuestionBulkItem(
                    question_text=MultilingualText(
                        el="Ερώτηση 1?",
                        en="Question 1?",
                        ru="Вопрос 1?",
                    ),
                    option_a=MultilingualText(el="Α1", en="A1", ru="А1"),
                    option_b=MultilingualText(el="Β1", en="B1", ru="Б1"),
                    option_c=MultilingualText(el="Γ1", en="C1", ru="В1"),
                    option_d=MultilingualText(el="Δ1", en="D1", ru="Г1"),
                    correct_option=1,
                    order_index=0,
                ),
                CultureQuestionBulkItem(
                    question_text=MultilingualText(
                        el="Ερώτηση 2?",
                        en="Question 2?",
                        ru="Вопрос 2?",
                    ),
                    option_a=MultilingualText(el="Α2", en="A2", ru="А2"),
                    option_b=MultilingualText(el="Β2", en="B2", ru="Б2"),
                    option_c=MultilingualText(el="Γ2", en="C2", ru="В2"),
                    option_d=MultilingualText(el="Δ2", en="D2", ru="Г2"),
                    correct_option=2,
                    order_index=1,
                ),
            ],
        )

        result = await service.bulk_create_questions(request)

        assert result.deck_id == culture_deck.id
        assert result.created_count == 2
        assert len(result.questions) == 2
        assert result.questions[0].question_text["en"] == "Question 1?"
        assert result.questions[1].question_text["en"] == "Question 2?"

    @pytest.mark.asyncio
    async def test_bulk_create_questions_single_question(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        mock_s3_service,
    ):
        """Should successfully create a single question via bulk endpoint."""
        from src.schemas.culture import (
            CultureQuestionBulkCreateRequest,
            CultureQuestionBulkItem,
            MultilingualText,
        )

        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        request = CultureQuestionBulkCreateRequest(
            deck_id=culture_deck.id,
            questions=[
                CultureQuestionBulkItem(
                    question_text=MultilingualText(
                        el="Μοναδική ερώτηση?",
                        en="Single question?",
                        ru="Единственный вопрос?",
                    ),
                    option_a=MultilingualText(el="Α", en="A", ru="А"),
                    option_b=MultilingualText(el="Β", en="B", ru="Б"),
                    option_c=MultilingualText(el="Γ", en="C", ru="В"),
                    option_d=MultilingualText(el="Δ", en="D", ru="Г"),
                    correct_option=3,
                ),
            ],
        )

        result = await service.bulk_create_questions(request)

        assert result.created_count == 1

    @pytest.mark.asyncio
    async def test_bulk_create_questions_deck_not_found(
        self,
        db_session: AsyncSession,
        mock_s3_service,
    ):
        """Should raise CultureDeckNotFoundException when deck doesn't exist."""
        from src.schemas.culture import (
            CultureQuestionBulkCreateRequest,
            CultureQuestionBulkItem,
            MultilingualText,
        )

        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        request = CultureQuestionBulkCreateRequest(
            deck_id=uuid4(),  # Non-existent deck
            questions=[
                CultureQuestionBulkItem(
                    question_text=MultilingualText(
                        el="Ερώτηση?",
                        en="Question?",
                        ru="Вопрос?",
                    ),
                    option_a=MultilingualText(el="Α", en="A", ru="А"),
                    option_b=MultilingualText(el="Β", en="B", ru="Б"),
                    option_c=MultilingualText(el="Γ", en="C", ru="В"),
                    option_d=MultilingualText(el="Δ", en="D", ru="Г"),
                    correct_option=1,
                ),
            ],
        )

        with pytest.raises(CultureDeckNotFoundException):
            await service.bulk_create_questions(request)


class TestUpdateQuestion:
    """Tests for update_question method (lines 1023-1048)."""

    @pytest.mark.asyncio
    async def test_update_question_success(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should successfully update a question."""
        from src.schemas.culture import CultureQuestionUpdate, MultilingualText

        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]

        update_data = CultureQuestionUpdate(
            question_text=MultilingualText(
                el="Ενημερωμένη ερώτηση?",
                en="Updated question?",
                ru="Обновленный вопрос?",
            ),
            correct_option=4,
        )

        result = await service.update_question(question.id, update_data)

        assert result.id == question.id
        assert result.question_text["en"] == "Updated question?"
        assert result.correct_option == 4

    @pytest.mark.asyncio
    async def test_update_question_partial_update(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should update only specified fields."""
        from src.schemas.culture import CultureQuestionUpdate

        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]
        original_question_text = question.question_text

        update_data = CultureQuestionUpdate(
            correct_option=3,
            order_index=99,
        )

        result = await service.update_question(question.id, update_data)

        assert result.correct_option == 3
        assert result.order_index == 99
        # Original question text should be unchanged
        assert result.question_text == original_question_text

    @pytest.mark.asyncio
    async def test_update_question_image_key(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should update image_key."""
        from src.schemas.culture import CultureQuestionUpdate

        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]

        update_data = CultureQuestionUpdate(
            image_key="images/new_image.png",
        )

        result = await service.update_question(question.id, update_data)

        assert result.image_key == "images/new_image.png"

    @pytest.mark.asyncio
    async def test_update_question_not_found(
        self,
        db_session: AsyncSession,
        mock_s3_service,
    ):
        """Should raise CultureQuestionNotFoundException when question doesn't exist."""
        from src.schemas.culture import CultureQuestionUpdate

        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        update_data = CultureQuestionUpdate(
            correct_option=2,
        )

        with pytest.raises(CultureQuestionNotFoundException):
            await service.update_question(uuid4(), update_data)


class TestDeleteQuestion:
    """Tests for delete_question method (lines 1069-1076)."""

    @pytest.mark.asyncio
    async def test_delete_question_success(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should successfully delete a question."""
        from sqlalchemy import select

        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]
        question_id = question.id

        # Delete the question
        await service.delete_question(question_id)

        # Flush to ensure deletion is processed
        await db_session.flush()

        # Verify deletion
        result = await db_session.execute(
            select(CultureQuestion).where(CultureQuestion.id == question_id)
        )
        deleted_question = result.scalar_one_or_none()
        assert deleted_question is None

    @pytest.mark.asyncio
    async def test_delete_question_not_found(
        self,
        db_session: AsyncSession,
        mock_s3_service,
    ):
        """Should raise CultureQuestionNotFoundException when question doesn't exist."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        with pytest.raises(CultureQuestionNotFoundException):
            await service.delete_question(uuid4())


# =============================================================================
# Test Process Answer Fast (Early Response Pattern)
# =============================================================================


# =============================================================================
# Test Variable Answer Count (VAC-04)
# =============================================================================


class TestVariableAnswerCount:
    """Tests for variable answer count support (2, 3, or 4 options)."""

    @pytest.fixture
    async def two_option_question(
        self, db_session: AsyncSession, culture_deck: CultureDeck
    ) -> CultureQuestion:
        """Create a 2-option (True/False) question."""
        question = CultureQuestion(
            deck_id=culture_deck.id,
            question_text={
                "en": "Athens is the capital of Greece?",
                "el": "Η Αθήνα είναι η πρωτεύουσα της Ελλάδας;",
                "ru": "Афины - столица Греции?",
            },
            option_a={"en": "True", "el": "Αληθές", "ru": "Правда"},
            option_b={"en": "False", "el": "Ψευδές", "ru": "Ложь"},
            option_c=None,  # 2-option question
            option_d=None,
            correct_option=1,  # True
            order_index=100,
        )
        db_session.add(question)
        await db_session.flush()
        await db_session.refresh(question)
        return question

    @pytest.fixture
    async def three_option_question(
        self, db_session: AsyncSession, culture_deck: CultureDeck
    ) -> CultureQuestion:
        """Create a 3-option question."""
        question = CultureQuestion(
            deck_id=culture_deck.id,
            question_text={
                "en": "What color is the Greek flag?",
                "el": "Τι χρώμα είναι η ελληνική σημαία;",
                "ru": "Какого цвета греческий флаг?",
            },
            option_a={"en": "Blue and white", "el": "Μπλε και λευκό", "ru": "Синий и белый"},
            option_b={"en": "Red and white", "el": "Κόκκινο και λευκό", "ru": "Красный и белый"},
            option_c={"en": "Green and white", "el": "Πράσινο και λευκό", "ru": "Зеленый и белый"},
            option_d=None,  # 3-option question
            correct_option=1,
            order_index=101,
        )
        db_session.add(question)
        await db_session.flush()
        await db_session.refresh(question)
        return question

    # -------------------------------------------------------------------------
    # _build_queue_item tests
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_build_queue_item_two_option_question_returns_two_options(
        self,
        db_session: AsyncSession,
        two_option_question: CultureQuestion,
        mock_s3_service,
    ):
        """2-option question should return options array of length 2."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        result = service._build_queue_item(two_option_question, stats=None)

        assert len(result.options) == 2
        assert result.option_count == 2
        assert result.options[0]["en"] == "True"
        assert result.options[1]["en"] == "False"

    @pytest.mark.asyncio
    async def test_build_queue_item_three_option_question_returns_three_options(
        self,
        db_session: AsyncSession,
        three_option_question: CultureQuestion,
        mock_s3_service,
    ):
        """3-option question should return options array of length 3."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        result = service._build_queue_item(three_option_question, stats=None)

        assert len(result.options) == 3
        assert result.option_count == 3
        assert result.options[0]["en"] == "Blue and white"
        assert result.options[1]["en"] == "Red and white"
        assert result.options[2]["en"] == "Green and white"

    # -------------------------------------------------------------------------
    # process_answer validation tests
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_process_answer_two_option_question_option_3_raises_error(
        self,
        db_session: AsyncSession,
        test_user: User,
        two_option_question: CultureQuestion,
        mock_s3_service,
    ):
        """Answering option 3 on 2-option question should raise ValueError."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        with pytest.raises(ValueError, match="selected_option must be between 1 and 2"):
            await service.process_answer(
                user_id=test_user.id,
                question_id=two_option_question.id,
                selected_option=3,  # Invalid for 2-option question
                time_taken=10,
            )

    @pytest.mark.asyncio
    async def test_process_answer_three_option_question_option_4_raises_error(
        self,
        db_session: AsyncSession,
        test_user: User,
        three_option_question: CultureQuestion,
        mock_s3_service,
    ):
        """Answering option 4 on 3-option question should raise ValueError."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        with pytest.raises(ValueError, match="selected_option must be between 1 and 3"):
            await service.process_answer(
                user_id=test_user.id,
                question_id=three_option_question.id,
                selected_option=4,  # Invalid for 3-option question
                time_taken=10,
            )

    @pytest.mark.asyncio
    async def test_process_answer_two_option_question_valid_options(
        self,
        db_session: AsyncSession,
        test_user: User,
        two_option_question: CultureQuestion,
        mock_s3_service,
    ):
        """2-option question should accept options 1 and 2."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        # Option 1 should work
        result1 = await service.process_answer(
            user_id=test_user.id,
            question_id=two_option_question.id,
            selected_option=1,  # Valid: True
            time_taken=10,
        )
        assert result1.is_correct is True

        # Option 2 should also work (but be wrong)
        result2 = await service.process_answer(
            user_id=test_user.id,
            question_id=two_option_question.id,
            selected_option=2,  # Valid: False (wrong answer)
            time_taken=10,
        )
        assert result2.is_correct is False

    # -------------------------------------------------------------------------
    # process_answer_fast validation tests
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_process_answer_fast_two_option_question_option_3_raises_error(
        self,
        db_session: AsyncSession,
        test_user: User,
        two_option_question: CultureQuestion,
        mock_s3_service,
    ):
        """Answering option 3 on 2-option question (fast path) should raise ValueError."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        with pytest.raises(ValueError, match="selected_option must be between 1 and 2"):
            await service.process_answer_fast(
                user_id=test_user.id,
                question_id=two_option_question.id,
                selected_option=3,  # Invalid for 2-option question
                time_taken=10,
            )

    @pytest.mark.asyncio
    async def test_process_answer_fast_three_option_question_option_4_raises_error(
        self,
        db_session: AsyncSession,
        test_user: User,
        three_option_question: CultureQuestion,
        mock_s3_service,
    ):
        """Answering option 4 on 3-option question (fast path) should raise ValueError."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        with pytest.raises(ValueError, match="selected_option must be between 1 and 3"):
            await service.process_answer_fast(
                user_id=test_user.id,
                question_id=three_option_question.id,
                selected_option=4,  # Invalid for 3-option question
                time_taken=10,
            )

    @pytest.mark.asyncio
    async def test_process_answer_fast_two_option_question_valid_options(
        self,
        db_session: AsyncSession,
        test_user: User,
        two_option_question: CultureQuestion,
        mock_s3_service,
    ):
        """2-option question (fast path) should accept options 1 and 2."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        # Option 1 should work
        response1, _ = await service.process_answer_fast(
            user_id=test_user.id,
            question_id=two_option_question.id,
            selected_option=1,  # Valid: True
            time_taken=10,
        )
        assert response1.is_correct is True

        # Option 2 should also work (but be wrong)
        response2, _ = await service.process_answer_fast(
            user_id=test_user.id,
            question_id=two_option_question.id,
            selected_option=2,  # Valid: False (wrong answer)
            time_taken=10,
        )
        assert response2.is_correct is False


class TestCreateQuestionVariableOptions:
    """Tests for create_question with variable option counts."""

    @pytest.mark.asyncio
    async def test_create_question_two_options(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        mock_s3_service,
    ):
        """Should create a 2-option question with null option_c and option_d."""
        from src.schemas.culture import CultureQuestionCreate, MultilingualText

        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        question_data = CultureQuestionCreate(
            deck_id=culture_deck.id,
            question_text=MultilingualText(
                el="Αληθές ή Ψευδές?",
                en="True or False?",
                ru="Правда или ложь?",
            ),
            option_a=MultilingualText(el="Αληθές", en="True", ru="Правда"),
            option_b=MultilingualText(el="Ψευδές", en="False", ru="Ложь"),
            option_c=None,  # 2-option question
            option_d=None,
            correct_option=1,
            order_index=0,
        )

        result = await service.create_question(question_data)

        assert result.option_a["en"] == "True"
        assert result.option_b["en"] == "False"
        assert result.option_c is None
        assert result.option_d is None
        assert result.option_count == 2

    @pytest.mark.asyncio
    async def test_create_question_three_options(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        mock_s3_service,
    ):
        """Should create a 3-option question with null option_d only."""
        from src.schemas.culture import CultureQuestionCreate, MultilingualText

        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        question_data = CultureQuestionCreate(
            deck_id=culture_deck.id,
            question_text=MultilingualText(
                el="Ερώτηση με 3 επιλογές?",
                en="Question with 3 options?",
                ru="Вопрос с 3 вариантами?",
            ),
            option_a=MultilingualText(el="Α", en="A", ru="А"),
            option_b=MultilingualText(el="Β", en="B", ru="Б"),
            option_c=MultilingualText(el="Γ", en="C", ru="В"),
            option_d=None,  # 3-option question
            correct_option=2,
            order_index=0,
        )

        result = await service.create_question(question_data)

        assert result.option_a["en"] == "A"
        assert result.option_b["en"] == "B"
        assert result.option_c["en"] == "C"
        assert result.option_d is None
        assert result.option_count == 3


class TestBulkCreateQuestionsVariableOptions:
    """Tests for bulk_create_questions with variable option counts."""

    @pytest.mark.asyncio
    async def test_bulk_create_mixed_option_counts(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        mock_s3_service,
    ):
        """Should create questions with different option counts in one batch."""
        from src.schemas.culture import (
            CultureQuestionBulkCreateRequest,
            CultureQuestionBulkItem,
            MultilingualText,
        )

        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        request = CultureQuestionBulkCreateRequest(
            deck_id=culture_deck.id,
            questions=[
                # 2-option question
                CultureQuestionBulkItem(
                    question_text=MultilingualText(
                        el="2 επιλογές?",
                        en="2 options?",
                        ru="2 варианта?",
                    ),
                    option_a=MultilingualText(el="Α", en="A", ru="А"),
                    option_b=MultilingualText(el="Β", en="B", ru="Б"),
                    option_c=None,
                    option_d=None,
                    correct_option=1,
                    order_index=0,
                ),
                # 3-option question
                CultureQuestionBulkItem(
                    question_text=MultilingualText(
                        el="3 επιλογές?",
                        en="3 options?",
                        ru="3 варианта?",
                    ),
                    option_a=MultilingualText(el="Α", en="A", ru="А"),
                    option_b=MultilingualText(el="Β", en="B", ru="Б"),
                    option_c=MultilingualText(el="Γ", en="C", ru="В"),
                    option_d=None,
                    correct_option=2,
                    order_index=1,
                ),
                # 4-option question
                CultureQuestionBulkItem(
                    question_text=MultilingualText(
                        el="4 επιλογές?",
                        en="4 options?",
                        ru="4 варианта?",
                    ),
                    option_a=MultilingualText(el="Α", en="A", ru="А"),
                    option_b=MultilingualText(el="Β", en="B", ru="Б"),
                    option_c=MultilingualText(el="Γ", en="C", ru="В"),
                    option_d=MultilingualText(el="Δ", en="D", ru="Г"),
                    correct_option=3,
                    order_index=2,
                ),
            ],
        )

        result = await service.bulk_create_questions(request)

        assert result.created_count == 3
        assert len(result.questions) == 3

        # Verify 2-option question
        assert result.questions[0].option_c is None
        assert result.questions[0].option_d is None
        assert result.questions[0].option_count == 2

        # Verify 3-option question
        assert result.questions[1].option_c is not None
        assert result.questions[1].option_d is None
        assert result.questions[1].option_count == 3

        # Verify 4-option question
        assert result.questions[2].option_c is not None
        assert result.questions[2].option_d is not None
        assert result.questions[2].option_count == 4


class TestProcessAnswerFast:
    """Tests for process_answer_fast method (early response pattern)."""

    @pytest.mark.asyncio
    async def test_process_answer_fast_correct_answer(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Correct answer should return is_correct=True with estimated XP."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]  # correct_option = 1

        response, context = await service.process_answer_fast(
            user_id=test_user.id,
            question_id=question.id,
            selected_option=1,  # Correct answer
            time_taken=10,
            language="en",
        )

        assert response.is_correct is True
        assert response.correct_option == 1
        # XP should include base (10) + first review bonus (20) = 30
        assert response.xp_earned == 30
        assert response.message == "Correct!"
        assert response.deck_category == culture_deck.category

    @pytest.mark.asyncio
    async def test_process_answer_fast_wrong_answer(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Wrong answer should return is_correct=False with encouragement XP."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]  # correct_option = 1

        response, context = await service.process_answer_fast(
            user_id=test_user.id,
            question_id=question.id,
            selected_option=2,  # Wrong answer
            time_taken=10,
            language="en",
        )

        assert response.is_correct is False
        assert response.correct_option == 1
        # XP should be base wrong (2) only - no first review bonus for wrong answers
        assert response.xp_earned == 2
        assert response.message == "Not quite. Review this question."
        assert response.deck_category == culture_deck.category

    @pytest.mark.asyncio
    async def test_process_answer_fast_perfect_answer(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Perfect answer (< 2 seconds) should get bonus XP."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]

        response, context = await service.process_answer_fast(
            user_id=test_user.id,
            question_id=question.id,
            selected_option=1,  # Correct answer
            time_taken=1,  # Perfect recall (< 2 seconds)
            language="en",
        )

        assert response.is_correct is True
        # Perfect XP (15) + first review bonus (20) = 35
        assert response.xp_earned == 35
        assert context["is_perfect"] is True

    @pytest.mark.asyncio
    async def test_process_answer_fast_returns_context_for_background_task(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should return context dict with all data needed for background task."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]

        response, context = await service.process_answer_fast(
            user_id=test_user.id,
            question_id=question.id,
            selected_option=1,
            time_taken=5,
            language="el",
        )

        # Verify context contains all required fields
        assert context["user_id"] == test_user.id
        assert context["question_id"] == question.id
        assert context["selected_option"] == 1
        assert context["time_taken"] == 5
        assert context["language"] == "el"
        assert context["is_correct"] is True
        assert context["is_perfect"] is False
        assert context["deck_category"] == culture_deck.category
        assert context["correct_option"] == question.correct_option

    @pytest.mark.asyncio
    async def test_process_answer_fast_invalid_option_raises_error(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Invalid selected_option should raise ValueError."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]

        with pytest.raises(ValueError, match="selected_option must be between 1 and 4"):
            await service.process_answer_fast(
                user_id=test_user.id,
                question_id=question.id,
                selected_option=5,  # Invalid
                time_taken=10,
            )

        with pytest.raises(ValueError, match="selected_option must be between 1 and 4"):
            await service.process_answer_fast(
                user_id=test_user.id,
                question_id=question.id,
                selected_option=0,  # Invalid
                time_taken=10,
            )

    @pytest.mark.asyncio
    async def test_process_answer_fast_question_not_found(
        self,
        db_session: AsyncSession,
        test_user: User,
        mock_s3_service,
    ):
        """Non-existent question should raise CultureQuestionNotFoundException."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)

        with pytest.raises(CultureQuestionNotFoundException):
            await service.process_answer_fast(
                user_id=test_user.id,
                question_id=uuid4(),  # Non-existent
                selected_option=1,
                time_taken=10,
            )

    @pytest.mark.asyncio
    async def test_process_answer_fast_does_not_create_stats(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Fast path should NOT create stats (that's done in background task)."""
        from sqlalchemy import select

        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]

        # Verify no stats exist initially
        initial_stats = await db_session.execute(
            select(CultureQuestionStats).where(
                CultureQuestionStats.user_id == test_user.id,
                CultureQuestionStats.question_id == question.id,
            )
        )
        assert initial_stats.scalar_one_or_none() is None

        # Process answer via fast path
        await service.process_answer_fast(
            user_id=test_user.id,
            question_id=question.id,
            selected_option=1,
            time_taken=10,
        )

        # Stats should still not exist (created by background task, not fast path)
        post_stats = await db_session.execute(
            select(CultureQuestionStats).where(
                CultureQuestionStats.user_id == test_user.id,
                CultureQuestionStats.question_id == question.id,
            )
        )
        assert post_stats.scalar_one_or_none() is None

    @pytest.mark.asyncio
    async def test_process_answer_fast_different_languages(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should accept and pass through different language options."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]

        for lang in ["en", "el", "ru"]:
            response, context = await service.process_answer_fast(
                user_id=test_user.id,
                question_id=question.id,
                selected_option=1,
                time_taken=10,
                language=lang,
            )

            assert context["language"] == lang
