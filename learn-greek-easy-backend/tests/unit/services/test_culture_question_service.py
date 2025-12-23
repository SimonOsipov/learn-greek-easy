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
        name={"en": "Greek History", "el": "Ελληνική Ιστορία", "ru": "Греческая история"},
        description={"en": "Learn about Greek history", "el": "Μάθετε"},
        icon="book-open",
        color_accent="#4F46E5",
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
        name={"en": "Archived", "el": "Αρχειοθετημένο", "ru": "Архивный"},
        description={"en": "Archived deck", "el": "Αρχειοθετημένο"},
        icon="archive",
        color_accent="#6B7280",
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

        # XP integration: 2 XP for wrong answer + 20 XP first review bonus = 22 XP
        assert result.xp_earned == 22

    @pytest.mark.asyncio
    async def test_process_answer_returns_daily_goal_completed_false_when_not_completed(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """daily_goal_completed should be False when goal not met."""
        service = CultureQuestionService(db_session, s3_service=mock_s3_service)
        question = culture_questions[0]

        result = await service.process_answer(
            user_id=test_user.id,
            question_id=question.id,
            selected_option=1,
            time_taken=10,
        )

        # Only 1 answer, default goal is 20
        assert result.daily_goal_completed is False


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
