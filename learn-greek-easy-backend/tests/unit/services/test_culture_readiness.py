"""Unit tests for CultureQuestionService.get_culture_readiness.

This module tests:
- Readiness score calculation (weighted sum of SRS stages)
- Verdict boundary thresholds
- Accuracy computation from answer history
- Category inclusion/exclusion rules (active decks, included categories)
- questions_learned counting (MASTERED only)
"""

from datetime import date, datetime, timedelta

import pytest
import sqlalchemy as sa
from sqlalchemy import select
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


# =============================================================================
# Additional Fixtures for Category Breakdown Tests
# =============================================================================


@pytest.fixture
async def geography_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an active geography deck."""
    deck = CultureDeck(
        name_en="Greek Geography",
        name_el="Greek Geography",
        name_ru="Greek Geography",
        description_en="Geography",
        description_el="Geography",
        description_ru="Geography",
        category="geography",
        is_active=True,
        order_index=2,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def politics_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an active politics deck."""
    deck = CultureDeck(
        name_en="Greek Politics",
        name_el="Greek Politics",
        name_ru="Greek Politics",
        description_en="Politics",
        description_el="Politics",
        description_ru="Politics",
        category="politics",
        is_active=True,
        order_index=3,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def culture_category_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an active culture deck (maps to 'culture' logical category)."""
    deck = CultureDeck(
        name_en="Greek Culture",
        name_el="Greek Culture",
        name_ru="Greek Culture",
        description_en="Culture",
        description_el="Culture",
        description_ru="Culture",
        category="culture",
        is_active=True,
        order_index=4,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


async def create_answer_history_with_date(
    db_session: AsyncSession,
    user: User,
    question: CultureQuestion,
    is_correct: bool,
    created_at: datetime,
) -> CultureAnswerHistory:
    """Helper: create a CultureAnswerHistory record with an explicit created_at timestamp."""
    deck_result = await db_session.execute(
        select(CultureDeck).where(CultureDeck.id == question.deck_id)
    )
    deck = deck_result.scalar_one()
    history = CultureAnswerHistory(
        user_id=user.id,
        question_id=question.id,
        language="en",
        is_correct=is_correct,
        selected_option=1,
        time_taken_seconds=10,
        deck_category=deck.category,
    )
    db_session.add(history)
    await db_session.flush()
    # Override created_at (server default)
    await db_session.execute(
        sa.update(CultureAnswerHistory)
        .where(CultureAnswerHistory.id == history.id)
        .values(created_at=created_at)
    )
    await db_session.refresh(history)
    return history


# =============================================================================
# TestCategoryBreakdown
# =============================================================================


class TestCategoryBreakdown:
    """Tests for the per-category breakdown in CultureQuestionService.get_culture_readiness."""

    @pytest.mark.asyncio
    async def test_zero_activity_returns_4_categories_at_zero(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        geography_deck: CultureDeck,
        politics_deck: CultureDeck,
    ):
        """With no stats, all 4 logical categories appear with readiness 0.0."""
        await create_questions_for_deck(db_session, culture_deck, 5)
        await create_questions_for_deck(db_session, geography_deck, 5)
        await create_questions_for_deck(db_session, politics_deck, 5)

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        assert len(result.categories) == 4
        for cat in result.categories:
            assert cat.readiness_percentage == 0.0

    @pytest.mark.asyncio
    async def test_exactly_4_logical_categories_returned(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        geography_deck: CultureDeck,
        politics_deck: CultureDeck,
        practical_deck: CultureDeck,
    ):
        """Always returns exactly 4 logical categories: history, geography, politics, culture."""
        await create_questions_for_deck(db_session, culture_deck, 5)
        await create_questions_for_deck(db_session, geography_deck, 5)
        await create_questions_for_deck(db_session, politics_deck, 5)
        await create_questions_for_deck(db_session, practical_deck, 5)

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        category_names = {c.category for c in result.categories}
        assert category_names == {"history", "geography", "politics", "culture"}
        assert len(result.categories) == 4

    @pytest.mark.asyncio
    async def test_traditions_excluded(
        self,
        db_session: AsyncSession,
        test_user: User,
        traditions_deck: CultureDeck,
        culture_deck: CultureDeck,
    ):
        """Traditions deck does not appear as a logical category in the breakdown."""
        await create_questions_for_deck(db_session, traditions_deck, 5)
        await create_questions_for_deck(db_session, culture_deck, 5)

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        category_names = {c.category for c in result.categories}
        assert "traditions" not in category_names

    @pytest.mark.asyncio
    async def test_culture_practical_merge(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_category_deck: CultureDeck,
        practical_deck: CultureDeck,
    ):
        """Practical deck merges into the 'culture' logical category (15 total questions)."""
        await create_questions_for_deck(db_session, culture_category_deck, 10)
        await create_questions_for_deck(db_session, practical_deck, 5)

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        culture_cat = next(c for c in result.categories if c.category == "culture")
        assert culture_cat.questions_total == 15

    @pytest.mark.asyncio
    async def test_per_category_weighted_readiness(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        geography_deck: CultureDeck,
        politics_deck: CultureDeck,
    ):
        """Per-category readiness is computed from weighted SRS stages.

        history: 10 questions, 1 LEARNING (0.25) → (1*0.25)/10*100 = 2.5
        geography: 10 questions, 3 REVIEW (0.5) → (3*0.5)/10*100 = 15.0
        politics: 10 questions, 5 MASTERED (1.0) → (5*1.0)/10*100 = 50.0
        """
        history_qs = await create_questions_for_deck(db_session, culture_deck, 10)
        geo_qs = await create_questions_for_deck(db_session, geography_deck, 10)
        pol_qs = await create_questions_for_deck(db_session, politics_deck, 10)

        await create_stats_for_questions(db_session, test_user, history_qs[:1], CardStatus.LEARNING)
        await create_stats_for_questions(db_session, test_user, geo_qs[:3], CardStatus.REVIEW)
        await create_stats_for_questions(db_session, test_user, pol_qs[:5], CardStatus.MASTERED)

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        cat_map = {c.category: c for c in result.categories}
        assert cat_map["history"].readiness_percentage == 2.5
        assert cat_map["geography"].readiness_percentage == 15.0
        assert cat_map["politics"].readiness_percentage == 50.0

    @pytest.mark.asyncio
    async def test_sorting_order(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        geography_deck: CultureDeck,
        politics_deck: CultureDeck,
        culture_category_deck: CultureDeck,
    ):
        """Categories are sorted ascending by readiness_percentage: weakest first."""
        # geography=30%, politics=45%, history=60%, culture=80%
        history_qs = await create_questions_for_deck(db_session, culture_deck, 10)
        geo_qs = await create_questions_for_deck(db_session, geography_deck, 10)
        pol_qs = await create_questions_for_deck(db_session, politics_deck, 10)
        culture_qs = await create_questions_for_deck(db_session, culture_category_deck, 10)

        # geography: 3 MASTERED = 30%
        await create_stats_for_questions(db_session, test_user, geo_qs[:3], CardStatus.MASTERED)
        # politics: 4 MASTERED + 1 REVIEW = 40+5=45%
        await create_stats_for_questions(db_session, test_user, pol_qs[:4], CardStatus.MASTERED)
        await create_stats_for_questions(db_session, test_user, pol_qs[4:5], CardStatus.REVIEW)
        # history: 6 MASTERED = 60%
        await create_stats_for_questions(db_session, test_user, history_qs[:6], CardStatus.MASTERED)
        # culture: 8 MASTERED = 80%
        await create_stats_for_questions(db_session, test_user, culture_qs[:8], CardStatus.MASTERED)

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        readiness_values = [c.readiness_percentage for c in result.categories]
        assert readiness_values == sorted(readiness_values)
        assert result.categories[0].category == "geography"
        assert result.categories[3].category == "culture"

    @pytest.mark.asyncio
    async def test_tie_breaking_alphabetical(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        geography_deck: CultureDeck,
    ):
        """When two categories have equal readiness, sort alphabetically by category name."""
        # history and geography both at 50%: 5 MASTERED out of 10
        history_qs = await create_questions_for_deck(db_session, culture_deck, 10)
        geo_qs = await create_questions_for_deck(db_session, geography_deck, 10)

        await create_stats_for_questions(db_session, test_user, history_qs[:5], CardStatus.MASTERED)
        await create_stats_for_questions(db_session, test_user, geo_qs[:5], CardStatus.MASTERED)

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        tied = [c for c in result.categories if c.readiness_percentage == 50.0]
        assert len(tied) == 2
        tied_names = [c.category for c in tied]
        assert tied_names == sorted(tied_names)
        assert tied_names[0] == "geography"
        assert tied_names[1] == "history"

    @pytest.mark.asyncio
    async def test_inactive_decks_excluded(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
        geography_deck: CultureDeck,
        inactive_deck: CultureDeck,
    ):
        """Inactive decks do not contribute to category totals."""
        # 10 questions in active history deck
        history_qs = await create_questions_for_deck(db_session, culture_deck, 10)
        await create_stats_for_questions(db_session, test_user, history_qs, CardStatus.MASTERED)

        # 5 questions in inactive deck (same logical category: history)
        inactive_qs = await create_questions_for_deck(db_session, inactive_deck, 5)
        await create_stats_for_questions(db_session, test_user, inactive_qs, CardStatus.MASTERED)

        # 5 questions in active geography deck
        geo_qs = await create_questions_for_deck(db_session, geography_deck, 5)
        await create_stats_for_questions(db_session, test_user, geo_qs, CardStatus.MASTERED)

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        history_cat = next(c for c in result.categories if c.category == "history")
        # Only 10 from active deck, not 15
        assert history_cat.questions_total == 10

    @pytest.mark.asyncio
    async def test_division_by_zero_guard(
        self,
        db_session: AsyncSession,
        test_user: User,
    ):
        """No questions in DB → no crash, all categories have readiness 0.0."""
        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        assert result.readiness_percentage == 0.0
        assert len(result.categories) == 4
        for cat in result.categories:
            assert cat.readiness_percentage == 0.0
            assert cat.questions_total == 0

    @pytest.mark.asyncio
    async def test_questions_mastered_counts_mastered_only(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
    ):
        """questions_mastered in category breakdown counts MASTERED status only."""
        questions = await create_questions_for_deck(db_session, culture_deck, 10)

        # 5 MASTERED, 3 REVIEW, 2 LEARNING
        await create_stats_for_questions(db_session, test_user, questions[:5], CardStatus.MASTERED)
        await create_stats_for_questions(db_session, test_user, questions[5:8], CardStatus.REVIEW)
        await create_stats_for_questions(db_session, test_user, questions[8:], CardStatus.LEARNING)

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        history_cat = next(c for c in result.categories if c.category == "history")
        assert history_cat.questions_mastered == 5

    @pytest.mark.asyncio
    async def test_top_level_fields_unchanged(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
    ):
        """Adding category breakdown does not alter top-level response fields."""
        questions = await create_questions_for_deck(db_session, culture_deck, 10)
        await create_stats_for_questions(db_session, test_user, questions[:5], CardStatus.MASTERED)

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        # Top-level fields still reflect overall values
        assert result.questions_learned == 5
        assert result.questions_total == 10
        assert result.readiness_percentage == 50.0
        assert result.verdict == "getting_there"
        # categories list is present
        assert result.categories is not None


# =============================================================================
# TestCategoryAccuracy
# =============================================================================


class TestCategoryAccuracy:
    """Tests for per-category accuracy and needs_reinforcement in get_culture_readiness."""

    @pytest.mark.asyncio
    async def test_accuracy_mixed_answers(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
    ):
        """7 correct + 3 incorrect in history → accuracy_percentage=70.0."""
        questions = await create_questions_for_deck(db_session, culture_deck, 10)
        await create_stats_for_questions(db_session, test_user, questions, CardStatus.REVIEW)

        now = datetime.utcnow()
        for i, q in enumerate(questions):
            await create_answer_history_with_date(
                db_session, test_user, q, is_correct=(i < 7), created_at=now
            )

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        history_cat = next(c for c in result.categories if c.category == "history")
        assert history_cat.accuracy_percentage == 70.0

    @pytest.mark.asyncio
    async def test_accuracy_null_when_no_recent_answers(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
    ):
        """Answers older than 30 days → accuracy_percentage is None for that category."""
        questions = await create_questions_for_deck(db_session, culture_deck, 5)
        await create_stats_for_questions(db_session, test_user, questions, CardStatus.REVIEW)

        old_date = datetime.utcnow() - timedelta(days=31)
        for q in questions:
            await create_answer_history_with_date(
                db_session, test_user, q, is_correct=True, created_at=old_date
            )

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        history_cat = next(c for c in result.categories if c.category == "history")
        assert history_cat.accuracy_percentage is None

    @pytest.mark.asyncio
    async def test_accuracy_30_day_window_boundary(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
    ):
        """Answer at 31 days ago is excluded; answer at 29 days ago is included."""
        questions = await create_questions_for_deck(db_session, culture_deck, 2)
        await create_stats_for_questions(db_session, test_user, questions, CardStatus.REVIEW)

        now = datetime.utcnow()
        # 31 days ago: outside window (excluded)
        await create_answer_history_with_date(
            db_session,
            test_user,
            questions[0],
            is_correct=True,
            created_at=now - timedelta(days=31),
        )
        # 29 days ago: inside window (included), incorrect
        await create_answer_history_with_date(
            db_session,
            test_user,
            questions[1],
            is_correct=False,
            created_at=now - timedelta(days=29),
        )

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        history_cat = next(c for c in result.categories if c.category == "history")
        # Only the incorrect answer within window counts → 0 correct / 1 total = 0.0%
        assert history_cat.accuracy_percentage == 0.0

    @pytest.mark.asyncio
    async def test_accuracy_culture_practical_merge(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_category_deck: CultureDeck,
        practical_deck: CultureDeck,
    ):
        """Culture + practical answers merge into single 'culture' logical category accuracy."""
        culture_qs = await create_questions_for_deck(db_session, culture_category_deck, 5)
        practical_qs = await create_questions_for_deck(db_session, practical_deck, 3)
        await create_stats_for_questions(db_session, test_user, culture_qs, CardStatus.REVIEW)
        await create_stats_for_questions(db_session, test_user, practical_qs, CardStatus.REVIEW)

        now = datetime.utcnow()
        # culture deck: 3 correct, 2 wrong
        for i, q in enumerate(culture_qs):
            await create_answer_history_with_date(
                db_session, test_user, q, is_correct=(i < 3), created_at=now
            )
        # practical deck: 2 correct, 1 wrong
        for i, q in enumerate(practical_qs):
            await create_answer_history_with_date(
                db_session, test_user, q, is_correct=(i < 2), created_at=now
            )

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        culture_cat = next(c for c in result.categories if c.category == "culture")
        # 5 correct out of 8 total = 62.5%
        assert culture_cat.accuracy_percentage == 62.5

    @pytest.mark.asyncio
    async def test_needs_reinforcement_true(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
    ):
        """needs_reinforcement=True when readiness >= 80% and accuracy < 70%."""
        questions = await create_questions_for_deck(db_session, culture_deck, 10)
        # 8 MASTERED → readiness = 80%
        await create_stats_for_questions(db_session, test_user, questions[:8], CardStatus.MASTERED)

        now = datetime.utcnow()
        # 6 correct, 4 wrong → accuracy = 60% (below 70%)
        for i, q in enumerate(questions):
            await create_answer_history_with_date(
                db_session, test_user, q, is_correct=(i < 6), created_at=now
            )

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        history_cat = next(c for c in result.categories if c.category == "history")
        assert history_cat.readiness_percentage == 80.0
        assert history_cat.accuracy_percentage == 60.0
        assert history_cat.needs_reinforcement is True

    @pytest.mark.asyncio
    async def test_needs_reinforcement_false_high_accuracy(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
    ):
        """needs_reinforcement=False when accuracy >= 70%, even with high readiness."""
        questions = await create_questions_for_deck(db_session, culture_deck, 10)
        # 9 MASTERED → readiness = 90%
        await create_stats_for_questions(db_session, test_user, questions[:9], CardStatus.MASTERED)

        now = datetime.utcnow()
        # 7 correct, 3 wrong → accuracy = 70% (not below 70)
        for i, q in enumerate(questions):
            await create_answer_history_with_date(
                db_session, test_user, q, is_correct=(i < 7), created_at=now
            )

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        history_cat = next(c for c in result.categories if c.category == "history")
        assert history_cat.needs_reinforcement is False

    @pytest.mark.asyncio
    async def test_needs_reinforcement_false_low_mastery(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
    ):
        """needs_reinforcement=False when readiness < 80%, even with low accuracy."""
        questions = await create_questions_for_deck(db_session, culture_deck, 10)
        # 6 MASTERED → readiness = 60% (below 80%)
        await create_stats_for_questions(db_session, test_user, questions[:6], CardStatus.MASTERED)

        now = datetime.utcnow()
        # 4 correct, 6 wrong → accuracy = 40%
        for i, q in enumerate(questions):
            await create_answer_history_with_date(
                db_session, test_user, q, is_correct=(i < 4), created_at=now
            )

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        history_cat = next(c for c in result.categories if c.category == "history")
        assert history_cat.needs_reinforcement is False

    @pytest.mark.asyncio
    async def test_needs_reinforcement_false_null_accuracy(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
    ):
        """needs_reinforcement=False when accuracy_percentage is None (no answers)."""
        questions = await create_questions_for_deck(db_session, culture_deck, 10)
        # 9 MASTERED → readiness = 90%
        await create_stats_for_questions(db_session, test_user, questions[:9], CardStatus.MASTERED)
        # No answer history

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        history_cat = next(c for c in result.categories if c.category == "history")
        assert history_cat.accuracy_percentage is None
        assert history_cat.needs_reinforcement is False

    @pytest.mark.asyncio
    async def test_traditions_excluded_from_accuracy(
        self,
        db_session: AsyncSession,
        test_user: User,
        traditions_deck: CultureDeck,
        culture_deck: CultureDeck,
    ):
        """Traditions answers are excluded from per-category accuracy computation."""
        traditions_qs = await create_questions_for_deck(db_session, traditions_deck, 5)
        history_qs = await create_questions_for_deck(db_session, culture_deck, 5)
        await create_stats_for_questions(db_session, test_user, traditions_qs, CardStatus.REVIEW)
        await create_stats_for_questions(db_session, test_user, history_qs, CardStatus.REVIEW)

        now = datetime.utcnow()
        # All traditions answers correct (should not appear in any logical category)
        for q in traditions_qs:
            await create_answer_history_with_date(
                db_session, test_user, q, is_correct=True, created_at=now
            )
        # All history answers incorrect
        for q in history_qs:
            await create_answer_history_with_date(
                db_session, test_user, q, is_correct=False, created_at=now
            )

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        history_cat = next(c for c in result.categories if c.category == "history")
        # Only history answers counted → 0 correct / 5 = 0.0%
        assert history_cat.accuracy_percentage == 0.0

        # No 'traditions' logical category should appear
        category_names = {c.category for c in result.categories}
        assert "traditions" not in category_names

    @pytest.mark.asyncio
    async def test_boundary_thresholds(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
    ):
        """accuracy==70.0 AND readiness==80.0 → needs_reinforcement=False (strict < 70 check)."""
        questions = await create_questions_for_deck(db_session, culture_deck, 10)
        # 8 MASTERED → readiness = 80%
        await create_stats_for_questions(db_session, test_user, questions[:8], CardStatus.MASTERED)

        now = datetime.utcnow()
        # 7 correct, 3 wrong → accuracy = 70.0% (exactly at threshold, NOT below)
        for i, q in enumerate(questions):
            await create_answer_history_with_date(
                db_session, test_user, q, is_correct=(i < 7), created_at=now
            )

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        history_cat = next(c for c in result.categories if c.category == "history")
        assert history_cat.accuracy_percentage == 70.0
        assert history_cat.readiness_percentage == 80.0
        # Strict: < 70 required for reinforcement → False at exactly 70
        assert history_cat.needs_reinforcement is False

    @pytest.mark.asyncio
    async def test_existing_category_fields_unchanged(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
    ):
        """CategoryReadiness still returns category, readiness_pct, questions_mastered, total, deck_ids."""
        questions = await create_questions_for_deck(db_session, culture_deck, 10)
        await create_stats_for_questions(db_session, test_user, questions[:4], CardStatus.MASTERED)

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        history_cat = next(c for c in result.categories if c.category == "history")
        assert history_cat.category == "history"
        assert history_cat.readiness_percentage == 40.0
        assert history_cat.questions_mastered == 4
        assert history_cat.questions_total == 10
        assert isinstance(history_cat.deck_ids, list)
        assert len(history_cat.deck_ids) > 0

    @pytest.mark.asyncio
    async def test_existing_top_level_fields_unchanged(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_deck: CultureDeck,
    ):
        """Top-level response fields (readiness_percentage, verdict, questions_learned, etc.) unaffected."""
        questions = await create_questions_for_deck(db_session, culture_deck, 10)
        await create_stats_for_questions(db_session, test_user, questions[:6], CardStatus.MASTERED)

        now = datetime.utcnow()
        for i, q in enumerate(questions[:8]):
            await create_answer_history_with_date(
                db_session, test_user, q, is_correct=(i < 6), created_at=now
            )

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        assert result.readiness_percentage == 60.0
        assert result.verdict == "ready"
        assert result.questions_learned == 6
        assert result.questions_total == 10
        assert result.total_answers == 8
        assert result.accuracy_percentage == 75.0
