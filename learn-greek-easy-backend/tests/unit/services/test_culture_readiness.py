"""Unit tests for CultureQuestionService.get_culture_readiness.

This module tests:
- Readiness score calculation (weighted sum of SRS stages)
- Verdict boundary thresholds
- Accuracy computation from answer history
- Category inclusion/exclusion rules (active decks, included categories)
- questions_learned counting (MASTERED only)
"""

from datetime import date

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    CardStatus,
    CultureAnswerHistory,
    CultureDeck,
    CultureQuestion,
    CultureQuestionStats,
    User,
)
from src.services.culture_question_service import CultureQuestionService

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def culture_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an active history deck for testing."""
    deck = CultureDeck(
        name_en="Greek History",
        name_el="Greek History",
        name_ru="Greek History",
        description_en="Learn about Greek history",
        description_el="Learn about Greek history",
        description_ru="Learn about Greek history",
        category="history",
        is_active=True,
        order_index=0,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def inactive_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an inactive deck (should be excluded from readiness)."""
    deck = CultureDeck(
        name_en="Archived History",
        name_el="Archived History",
        name_ru="Archived History",
        description_en="Archived deck",
        description_el="Archived deck",
        description_ru="Archived deck",
        category="history",
        is_active=False,
        order_index=99,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def traditions_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an active traditions deck (excluded from readiness calculation)."""
    deck = CultureDeck(
        name_en="Greek Traditions",
        name_el="Greek Traditions",
        name_ru="Greek Traditions",
        description_en="Greek traditions",
        description_el="Greek traditions",
        description_ru="Greek traditions",
        category="traditions",
        is_active=True,
        order_index=1,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def practical_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an active practical deck (included in readiness calculation)."""
    deck = CultureDeck(
        name_en="Practical Greek",
        name_el="Practical Greek",
        name_ru="Practical Greek",
        description_en="Practical knowledge",
        description_el="Practical knowledge",
        description_ru="Practical knowledge",
        category="practical",
        is_active=True,
        order_index=2,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


async def create_questions_for_deck(
    db_session: AsyncSession,
    deck: CultureDeck,
    count: int,
) -> list[CultureQuestion]:
    """Helper: create N questions for a deck."""
    questions = []
    for i in range(count):
        question = CultureQuestion(
            deck_id=deck.id,
            question_text={
                "en": f"Question {i + 1}?",
                "el": f"Ερώτηση {i + 1};",
                "ru": f"Вопрос {i + 1}?",
            },
            option_a={"en": "Option A", "el": "Επιλογή Α", "ru": "Вариант А"},
            option_b={"en": "Option B", "el": "Επιλογή Β", "ru": "Вариант Б"},
            option_c={"en": "Option C", "el": "Επιλογή Γ", "ru": "Вариант В"},
            option_d={"en": "Option D", "el": "Επιλογή Δ", "ru": "Вариант Г"},
            correct_option=(i % 4) + 1,
            order_index=i,
        )
        db_session.add(question)
        questions.append(question)

    await db_session.flush()
    for q in questions:
        await db_session.refresh(q)
    return questions


async def create_stats_for_questions(
    db_session: AsyncSession,
    user: User,
    questions: list[CultureQuestion],
    status: CardStatus,
) -> list[CultureQuestionStats]:
    """Helper: create CultureQuestionStats with a given status for each question."""
    stats_list = []
    for question in questions:
        stats = CultureQuestionStats(
            user_id=user.id,
            question_id=question.id,
            status=status,
            easiness_factor=2.5,
            interval=1,
            repetitions=1,
            next_review_date=date.today(),
        )
        db_session.add(stats)
        stats_list.append(stats)

    await db_session.flush()
    for s in stats_list:
        await db_session.refresh(s)
    return stats_list


async def create_answer_history(
    db_session: AsyncSession,
    user: User,
    question: CultureQuestion,
    is_correct: bool,
    deck_category: str,
) -> CultureAnswerHistory:
    """Helper: create a single CultureAnswerHistory record."""
    entry = CultureAnswerHistory(
        user_id=user.id,
        question_id=question.id,
        language="en",
        is_correct=is_correct,
        selected_option=1,
        time_taken_seconds=10,
        deck_category=deck_category,
    )
    db_session.add(entry)
    await db_session.flush()
    await db_session.refresh(entry)
    return entry


# =============================================================================
# Test Suite
# =============================================================================


class TestCultureReadiness:
    """Tests for CultureQuestionService.get_culture_readiness."""

    @pytest.mark.asyncio
    async def test_zero_activity_returns_not_ready(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
    ):
        """No stats at all → readiness=0, verdict='not_ready', questions_learned=0."""
        await create_questions_for_deck(db_session, culture_deck, 10)

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        assert result.readiness_percentage == 0.0
        assert result.verdict == "not_ready"
        assert result.questions_learned == 0
        assert result.accuracy_percentage is None
        assert result.total_answers == 0

    @pytest.mark.asyncio
    async def test_all_learning_returns_25_percent(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
    ):
        """All 10 questions at LEARNING status → readiness=25.0, verdict='not_ready'."""
        questions = await create_questions_for_deck(db_session, culture_deck, 10)
        await create_stats_for_questions(db_session, test_user, questions, CardStatus.LEARNING)

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        # 10 * 0.25 / 10 * 100 = 25.0
        assert result.readiness_percentage == 25.0
        assert result.verdict == "not_ready"
        assert result.questions_learned == 0

    @pytest.mark.asyncio
    async def test_all_review_returns_50_percent(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
    ):
        """All 10 questions at REVIEW status → readiness=50.0, verdict='getting_there'."""
        questions = await create_questions_for_deck(db_session, culture_deck, 10)
        await create_stats_for_questions(db_session, test_user, questions, CardStatus.REVIEW)

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        # 10 * 0.5 / 10 * 100 = 50.0
        assert result.readiness_percentage == 50.0
        assert result.verdict == "getting_there"
        assert result.questions_learned == 0

    @pytest.mark.asyncio
    async def test_all_mastered_returns_100_percent(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
    ):
        """All 10 questions at MASTERED status → readiness=100.0, verdict='thoroughly_prepared'."""
        questions = await create_questions_for_deck(db_session, culture_deck, 10)
        await create_stats_for_questions(db_session, test_user, questions, CardStatus.MASTERED)

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        # 10 * 1.0 / 10 * 100 = 100.0
        assert result.readiness_percentage == 100.0
        assert result.verdict == "thoroughly_prepared"
        assert result.questions_learned == 10

    @pytest.mark.asyncio
    async def test_mixed_statuses_calculation(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
    ):
        """Mixed statuses: 40 MASTERED + 20 REVIEW + 40 LEARNING + 100 NEW → 30.0%."""
        # 200 total questions
        questions = await create_questions_for_deck(db_session, culture_deck, 200)

        # 40 MASTERED
        await create_stats_for_questions(db_session, test_user, questions[:40], CardStatus.MASTERED)
        # 20 REVIEW
        await create_stats_for_questions(db_session, test_user, questions[40:60], CardStatus.REVIEW)
        # 40 LEARNING
        await create_stats_for_questions(
            db_session, test_user, questions[60:100], CardStatus.LEARNING
        )
        # 100 NEW (no stats)

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        # (40*1.0 + 20*0.5 + 40*0.25) / 200 * 100 = (40+10+10)/200*100 = 60/200*100 = 30.0
        assert result.readiness_percentage == 30.0
        assert result.verdict == "not_ready"

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "n_mastered,expected_verdict",
        [
            (39, "not_ready"),
            (40, "getting_there"),
            (59, "getting_there"),
            (60, "ready"),
            (84, "ready"),
            (85, "thoroughly_prepared"),
        ],
    )
    async def test_verdict_boundaries(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        n_mastered: int,
        expected_verdict: str,
    ):
        """Verdict threshold boundaries: mastered N of 100 questions."""
        # 100 total questions; N mastered gives N% readiness (since weight=1.0)
        questions = await create_questions_for_deck(db_session, culture_deck, 100)
        await create_stats_for_questions(
            db_session, test_user, questions[:n_mastered], CardStatus.MASTERED
        )

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        assert result.verdict == expected_verdict

    @pytest.mark.asyncio
    async def test_accuracy_with_mixed_answers(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
    ):
        """7 correct + 3 incorrect answers → accuracy_percentage=70.0, total_answers=10."""
        questions = await create_questions_for_deck(db_session, culture_deck, 10)
        await create_stats_for_questions(db_session, test_user, questions, CardStatus.REVIEW)

        # Create answer history: 7 correct, 3 incorrect
        for i, q in enumerate(questions):
            await create_answer_history(
                db_session,
                test_user,
                q,
                is_correct=(i < 7),
                deck_category=culture_deck.category,
            )

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        assert result.total_answers == 10
        assert result.accuracy_percentage == 70.0

    @pytest.mark.asyncio
    async def test_accuracy_null_when_no_answers(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
    ):
        """Stats exist but no answer history → accuracy_percentage=None."""
        questions = await create_questions_for_deck(db_session, culture_deck, 10)
        await create_stats_for_questions(db_session, test_user, questions, CardStatus.REVIEW)
        # No answer history created

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        assert result.accuracy_percentage is None

    @pytest.mark.asyncio
    async def test_inactive_decks_excluded(
        self,
        db_session: AsyncSession,
        test_user: User,
        inactive_deck: CultureDeck,
        culture_deck: CultureDeck,
    ):
        """Inactive deck questions are excluded; only active deck questions count."""
        # 5 questions in inactive deck, all mastered
        inactive_qs = await create_questions_for_deck(db_session, inactive_deck, 5)
        await create_stats_for_questions(db_session, test_user, inactive_qs, CardStatus.MASTERED)

        # 10 questions in active deck, all mastered
        active_qs = await create_questions_for_deck(db_session, culture_deck, 10)
        await create_stats_for_questions(db_session, test_user, active_qs, CardStatus.MASTERED)

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        # Only 10 active deck questions count → 10/10 = 100%
        assert result.questions_learned == 10
        assert result.readiness_percentage == 100.0

    @pytest.mark.asyncio
    async def test_traditions_excluded(
        self,
        db_session: AsyncSession,
        test_user: User,
        traditions_deck: CultureDeck,
        culture_deck: CultureDeck,
    ):
        """Traditions deck questions are excluded from readiness calculation."""
        # 5 questions in traditions deck, all mastered
        traditions_qs = await create_questions_for_deck(db_session, traditions_deck, 5)
        await create_stats_for_questions(db_session, test_user, traditions_qs, CardStatus.MASTERED)

        # 10 questions in history deck, all mastered
        history_qs = await create_questions_for_deck(db_session, culture_deck, 10)
        await create_stats_for_questions(db_session, test_user, history_qs, CardStatus.MASTERED)

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        # Only 10 history questions count (traditions excluded)
        assert result.questions_learned == 10
        assert result.readiness_percentage == 100.0

    @pytest.mark.asyncio
    async def test_practical_included(
        self,
        db_session: AsyncSession,
        test_user: User,
        practical_deck: CultureDeck,
        culture_deck: CultureDeck,
    ):
        """Practical deck questions ARE included in readiness calculation."""
        # 5 questions in practical deck, all mastered
        practical_qs = await create_questions_for_deck(db_session, practical_deck, 5)
        await create_stats_for_questions(db_session, test_user, practical_qs, CardStatus.MASTERED)

        # 10 questions in history deck, all mastered
        history_qs = await create_questions_for_deck(db_session, culture_deck, 10)
        await create_stats_for_questions(db_session, test_user, history_qs, CardStatus.MASTERED)

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        # 15 total questions, all mastered → 100%
        assert result.questions_learned == 15
        assert result.readiness_percentage == 100.0

    @pytest.mark.asyncio
    async def test_questions_learned_counts_mastered_only(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
    ):
        """questions_learned counts MASTERED only, not REVIEW or LEARNING."""
        questions = await create_questions_for_deck(db_session, culture_deck, 10)

        # 3 MASTERED, 4 REVIEW, 3 LEARNING
        await create_stats_for_questions(db_session, test_user, questions[:3], CardStatus.MASTERED)
        await create_stats_for_questions(db_session, test_user, questions[3:7], CardStatus.REVIEW)
        await create_stats_for_questions(db_session, test_user, questions[7:], CardStatus.LEARNING)

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        assert result.questions_learned == 3
