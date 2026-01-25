"""Unit tests for CultureQuestionStatsRepository.

This module tests:
- get_by_user_and_question: Retrieve stats for user-question pair
- count_by_status_for_deck: Count questions by SM-2 status
- get_deck_progress: Calculate deck progress statistics
- get_last_practiced_at: Get last practice timestamp
- has_user_started_deck: Check if user has started a deck
- count_answers_today: Count culture answers for daily goal

Tests use real database fixtures to verify SQL queries work correctly.
"""

from datetime import date, timedelta
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardStatus, CultureDeck, CultureQuestion, CultureQuestionStats, User
from src.repositories.culture_question_stats import CultureQuestionStatsRepository

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def culture_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an active culture deck for testing."""
    deck = CultureDeck(
        name="Greek History",
        description="Learn about Greek history",
        category="history",
        is_active=True,
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
    for i in range(5):
        question = CultureQuestion(
            deck_id=culture_deck.id,
            question_text={
                "en": f"Question {i + 1}?",
                "el": f"Ερώτηση {i + 1};",
            },
            option_a={"en": "Option A", "el": "Επιλογή Α"},
            option_b={"en": "Option B", "el": "Επιλογή Β"},
            option_c={"en": "Option C", "el": "Επιλογή Γ"},
            option_d={"en": "Option D", "el": "Επιλογή Δ"},
            correct_option=(i % 4) + 1,
            order_index=i,
        )
        db_session.add(question)
        questions.append(question)

    await db_session.flush()
    for q in questions:
        await db_session.refresh(q)
    return questions


@pytest.fixture
async def question_stats(
    db_session: AsyncSession,
    test_user: User,
    culture_questions: list[CultureQuestion],
) -> list[CultureQuestionStats]:
    """Create question stats with various statuses."""
    stats_list = []
    # Create 5 stats with mix of statuses: 2 LEARNING, 1 REVIEW, 1 MASTERED, 1 NEW
    statuses = [
        CardStatus.LEARNING,
        CardStatus.REVIEW,
        CardStatus.MASTERED,
        CardStatus.LEARNING,
        CardStatus.NEW,
    ]

    for i, question in enumerate(culture_questions):
        stats = CultureQuestionStats(
            user_id=test_user.id,
            question_id=question.id,
            easiness_factor=2.5,
            interval=i + 1,
            repetitions=i,
            next_review_date=date.today() - timedelta(days=i),
            status=statuses[i],
        )
        db_session.add(stats)
        stats_list.append(stats)

    await db_session.flush()
    for s in stats_list:
        await db_session.refresh(s)
    return stats_list


# =============================================================================
# Test get_by_user_and_question
# =============================================================================


class TestGetByUserAndQuestion:
    """Tests for get_by_user_and_question method."""

    @pytest.mark.asyncio
    async def test_returns_stats_when_exists(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_questions: list[CultureQuestion],
        question_stats: list[CultureQuestionStats],
    ):
        """Should return stats for existing user-question pair."""
        repo = CultureQuestionStatsRepository(db_session)

        result = await repo.get_by_user_and_question(test_user.id, culture_questions[0].id)

        assert result is not None
        assert result.user_id == test_user.id
        assert result.question_id == culture_questions[0].id

    @pytest.mark.asyncio
    async def test_returns_none_when_not_exists(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_questions: list[CultureQuestion],
    ):
        """Should return None for non-existing pair (no stats created yet)."""
        repo = CultureQuestionStatsRepository(db_session)

        result = await repo.get_by_user_and_question(test_user.id, culture_questions[0].id)

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_for_different_user(
        self,
        db_session: AsyncSession,
        culture_questions: list[CultureQuestion],
        question_stats: list[CultureQuestionStats],
    ):
        """Should return None when querying for different user's stats."""
        repo = CultureQuestionStatsRepository(db_session)
        random_user_id = uuid4()

        result = await repo.get_by_user_and_question(random_user_id, culture_questions[0].id)

        assert result is None


# =============================================================================
# Test count_by_status_for_deck
# =============================================================================


class TestCountByStatusForDeck:
    """Tests for count_by_status_for_deck method."""

    @pytest.mark.asyncio
    async def test_counts_all_statuses(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        question_stats: list[CultureQuestionStats],
    ):
        """Should return correct counts for each status."""
        repo = CultureQuestionStatsRepository(db_session)

        result = await repo.count_by_status_for_deck(test_user.id, culture_deck.id)

        # Verify all keys are present
        assert "new" in result
        assert "learning" in result
        assert "review" in result
        assert "mastered" in result

        # Based on fixture: 2 LEARNING, 1 REVIEW, 1 MASTERED, 1 NEW status
        # But "new" in result is calculated as total_questions - in_progress
        # Since we have 5 questions with 5 stats (1 with NEW status),
        # the NEW status question counts toward studied
        assert result["learning"] == 2
        assert result["review"] == 1
        assert result["mastered"] == 1
        # new = total (5) - (learning + review + mastered) = 5 - 4 = 1
        # But the NEW status stat counts as studied, so new should be 0
        # Actually: new = total_questions - in_progress_count
        # in_progress_count = learning + review + mastered = 2 + 1 + 1 = 4
        # new = 5 - 4 = 1

    @pytest.mark.asyncio
    async def test_calculates_new_from_total_minus_studied(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """New count should be total questions minus those with stats."""
        repo = CultureQuestionStatsRepository(db_session)

        result = await repo.count_by_status_for_deck(test_user.id, culture_deck.id)

        # No stats exist, all should be new
        assert result["new"] == len(culture_questions)
        assert result["learning"] == 0
        assert result["review"] == 0
        assert result["mastered"] == 0

    @pytest.mark.asyncio
    async def test_returns_zeros_for_empty_deck(
        self,
        db_session: AsyncSession,
        test_user: User,
    ):
        """Should return zeros for deck with no questions."""
        repo = CultureQuestionStatsRepository(db_session)
        non_existent_deck_id = uuid4()

        result = await repo.count_by_status_for_deck(test_user.id, non_existent_deck_id)

        assert result["new"] == 0
        assert result["learning"] == 0
        assert result["review"] == 0
        assert result["mastered"] == 0


# =============================================================================
# Test get_deck_progress
# =============================================================================


class TestGetDeckProgress:
    """Tests for get_deck_progress method."""

    @pytest.mark.asyncio
    async def test_returns_progress_dict(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        question_stats: list[CultureQuestionStats],
    ):
        """Should return dict with all progress fields."""
        repo = CultureQuestionStatsRepository(db_session)

        result = await repo.get_deck_progress(test_user.id, culture_deck.id)

        assert "questions_total" in result
        assert "questions_mastered" in result
        assert "questions_learning" in result
        assert "questions_new" in result
        assert result["questions_total"] == 5

    @pytest.mark.asyncio
    async def test_learning_includes_review_status(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        question_stats: list[CultureQuestionStats],
    ):
        """questions_learning should include both learning and review statuses."""
        repo = CultureQuestionStatsRepository(db_session)

        result = await repo.get_deck_progress(test_user.id, culture_deck.id)

        # Fixture has 2 LEARNING + 1 REVIEW = 3 in "learning" category
        assert result["questions_learning"] == 3

    @pytest.mark.asyncio
    async def test_returns_zeros_for_no_stats(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Should return proper values when no stats exist."""
        repo = CultureQuestionStatsRepository(db_session)

        result = await repo.get_deck_progress(test_user.id, culture_deck.id)

        assert result["questions_total"] == 5
        assert result["questions_new"] == 5
        assert result["questions_mastered"] == 0
        assert result["questions_learning"] == 0


# =============================================================================
# Test get_last_practiced_at
# =============================================================================


class TestGetLastPracticedAt:
    """Tests for get_last_practiced_at method."""

    @pytest.mark.asyncio
    async def test_returns_most_recent_timestamp(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        question_stats: list[CultureQuestionStats],
    ):
        """Should return the most recent updated_at timestamp."""
        repo = CultureQuestionStatsRepository(db_session)

        result = await repo.get_last_practiced_at(test_user.id, culture_deck.id)

        assert result is not None
        # updated_at is set automatically on creation

    @pytest.mark.asyncio
    async def test_returns_none_when_no_stats(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Should return None when user has no stats for deck."""
        repo = CultureQuestionStatsRepository(db_session)

        result = await repo.get_last_practiced_at(test_user.id, culture_deck.id)

        assert result is None


# =============================================================================
# Test has_user_started_deck
# =============================================================================


class TestHasUserStartedDeck:
    """Tests for has_user_started_deck method."""

    @pytest.mark.asyncio
    async def test_returns_true_when_has_stats(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        question_stats: list[CultureQuestionStats],
    ):
        """Should return True when user has at least one stat."""
        repo = CultureQuestionStatsRepository(db_session)

        result = await repo.has_user_started_deck(test_user.id, culture_deck.id)

        assert result is True

    @pytest.mark.asyncio
    async def test_returns_false_when_no_stats(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
    ):
        """Should return False when user has no stats."""
        repo = CultureQuestionStatsRepository(db_session)

        result = await repo.has_user_started_deck(test_user.id, culture_deck.id)

        assert result is False

    @pytest.mark.asyncio
    async def test_returns_false_for_different_user(
        self,
        db_session: AsyncSession,
        culture_deck: CultureDeck,
        culture_questions: list[CultureQuestion],
        question_stats: list[CultureQuestionStats],
    ):
        """Should return False for different user."""
        repo = CultureQuestionStatsRepository(db_session)
        random_user_id = uuid4()

        result = await repo.has_user_started_deck(random_user_id, culture_deck.id)

        assert result is False


# =============================================================================
# Test count_answers_today
# =============================================================================


class TestCountAnswersToday:
    """Tests for count_answers_today method."""

    @pytest.mark.asyncio
    async def test_counts_stats_updated_today(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_questions: list[CultureQuestion],
        question_stats: list[CultureQuestionStats],
    ):
        """Should count stats with updated_at = today."""
        repo = CultureQuestionStatsRepository(db_session)

        result = await repo.count_answers_today(test_user.id)

        # All stats were created today in fixture, so updated_at is today
        assert result == 5

    @pytest.mark.asyncio
    async def test_returns_zero_for_new_user(
        self,
        db_session: AsyncSession,
    ):
        """Should return 0 for user with no stats."""
        repo = CultureQuestionStatsRepository(db_session)
        random_user_id = uuid4()

        result = await repo.count_answers_today(random_user_id)

        assert result == 0
