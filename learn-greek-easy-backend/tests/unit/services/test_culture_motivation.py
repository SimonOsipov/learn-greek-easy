"""Unit tests for CultureQuestionService._compute_motivation.

This module tests:
- Delta calculation and direction classification (improving/stagnant/declining)
- Threshold boundary conditions
- New user (no stats) path
- Null return when no questions
- Past readiness excludes recent stats (within MOTIVATION_DELTA_DAYS)
- Past readiness includes old stats (older than MOTIVATION_DELTA_DAYS)
- Deterministic variant selection based on user_id + ISO week
- Message key pattern for non-new-user directions
- Params dict completeness and types
- Full readiness response includes motivation when has_stats=True
"""

from datetime import date, datetime, timedelta

import pytest
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from src.constants import MOTIVATION_NEW_USER_TEMPLATES
from src.db.models import CardStatus, CultureDeck, CultureQuestion, CultureQuestionStats, User
from src.services.culture_question_service import CultureQuestionService

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def history_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an active history deck for motivation tests."""
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
async def history_questions(
    db_session: AsyncSession,
    history_deck: CultureDeck,
) -> list[CultureQuestion]:
    """Create 10 questions in the history deck."""
    questions = []
    for i in range(10):
        question = CultureQuestion(
            deck_id=history_deck.id,
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


async def _create_questions_for_deck(
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


async def create_stats_with_date(
    db_session: AsyncSession,
    user: User,
    questions: list[CultureQuestion],
    status: CardStatus,
    created_at: datetime,
) -> list[CultureQuestionStats]:
    """Create CultureQuestionStats with a specific created_at timestamp.

    Inserts stats normally, then uses a raw SQL UPDATE to set created_at to the
    desired past timestamp (overriding the server_default=func.now()).
    """
    stats_list = []
    stat_ids = []
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
        stat_ids.append(s.id)

    # Override created_at and updated_at via raw SQL (server_default cannot be overridden via ORM)
    await db_session.execute(
        sa.update(CultureQuestionStats)
        .where(CultureQuestionStats.id.in_(stat_ids))
        .values(created_at=created_at, updated_at=created_at)
    )
    await db_session.flush()

    return stats_list


# =============================================================================
# Test Suite
# =============================================================================


class TestCultureMotivation:
    """Tests for CultureQuestionService._compute_motivation."""

    @pytest.mark.asyncio
    async def test_delta_improving(
        self,
        db_session: AsyncSession,
        test_user: User,
        history_deck: CultureDeck,
    ):
        """current=55%, past=42% → delta=13.0, delta_direction='improving'."""
        questions = await _create_questions_for_deck(db_session, history_deck, 100)

        # 42 MASTERED from 8 days ago → past_readiness = 42%
        past_date = datetime.utcnow() - timedelta(days=8)
        await create_stats_with_date(
            db_session, test_user, questions[:42], CardStatus.MASTERED, past_date
        )

        service = CultureQuestionService(db_session)
        result = await service._compute_motivation(
            user_id=test_user.id,
            current_readiness=55.0,
            current_verdict="getting_there",
            questions_total=100,
            questions_learned=55,
            has_stats=True,
        )

        assert result is not None
        assert result.delta_percentage == 13.0
        assert result.delta_direction == "improving"

    @pytest.mark.asyncio
    async def test_delta_stagnant(
        self,
        db_session: AsyncSession,
        test_user: User,
        history_deck: CultureDeck,
    ):
        """current=51%, past=50% → delta=1.0, delta_direction='stagnant'."""
        questions = await _create_questions_for_deck(db_session, history_deck, 100)

        # 50 MASTERED from 8 days ago → past_readiness = 50%
        past_date = datetime.utcnow() - timedelta(days=8)
        await create_stats_with_date(
            db_session, test_user, questions[:50], CardStatus.MASTERED, past_date
        )

        service = CultureQuestionService(db_session)
        result = await service._compute_motivation(
            user_id=test_user.id,
            current_readiness=51.0,
            current_verdict="getting_there",
            questions_total=100,
            questions_learned=51,
            has_stats=True,
        )

        assert result is not None
        assert result.delta_percentage == 1.0
        assert result.delta_direction == "stagnant"

    @pytest.mark.asyncio
    async def test_delta_declining(
        self,
        db_session: AsyncSession,
        test_user: User,
        history_deck: CultureDeck,
    ):
        """current=50%, past=60% → delta=-10.0, delta_direction='declining'."""
        questions = await _create_questions_for_deck(db_session, history_deck, 100)

        # 60 MASTERED from 8 days ago → past_readiness = 60%
        past_date = datetime.utcnow() - timedelta(days=8)
        await create_stats_with_date(
            db_session, test_user, questions[:60], CardStatus.MASTERED, past_date
        )

        service = CultureQuestionService(db_session)
        result = await service._compute_motivation(
            user_id=test_user.id,
            current_readiness=50.0,
            current_verdict="getting_there",
            questions_total=100,
            questions_learned=50,
            has_stats=True,
        )

        assert result is not None
        assert result.delta_percentage == -10.0
        assert result.delta_direction == "declining"

    @pytest.mark.asyncio
    async def test_threshold_boundaries(
        self,
        db_session: AsyncSession,
        test_user: User,
        history_deck: CultureDeck,
    ):
        """Test exact threshold boundary conditions for delta classification.

        MOTIVATION_DELTA_IMPROVING_THRESHOLD = 3.0
        MOTIVATION_DELTA_DECLINING_THRESHOLD = -3.0

        delta=+3.0  → stagnant (not strictly >)
        delta=+3.01 → improving (strictly >)
        delta=-3.0  → stagnant (not strictly <)
        delta=-3.01 → declining (strictly <)
        """
        questions = await _create_questions_for_deck(db_session, history_deck, 100)
        past_date = datetime.utcnow() - timedelta(days=8)

        # 50 MASTERED from 8 days ago → past_readiness = 50%
        await create_stats_with_date(
            db_session, test_user, questions[:50], CardStatus.MASTERED, past_date
        )

        service = CultureQuestionService(db_session)

        # delta = +3.0 → stagnant (not > threshold)
        result = await service._compute_motivation(
            user_id=test_user.id,
            current_readiness=53.0,  # 53 - 50 = 3.0
            current_verdict="getting_there",
            questions_total=100,
            questions_learned=53,
            has_stats=True,
        )
        assert result is not None
        assert result.delta_direction == "stagnant"

        # delta = +3.01 → improving (strictly > threshold)
        result = await service._compute_motivation(
            user_id=test_user.id,
            current_readiness=53.01,  # 53.01 - 50 = 3.01
            current_verdict="getting_there",
            questions_total=100,
            questions_learned=53,
            has_stats=True,
        )
        assert result is not None
        assert result.delta_direction == "improving"

        # delta = -3.0 → stagnant (not < threshold)
        result = await service._compute_motivation(
            user_id=test_user.id,
            current_readiness=47.0,  # 47 - 50 = -3.0
            current_verdict="not_ready",
            questions_total=100,
            questions_learned=47,
            has_stats=True,
        )
        assert result is not None
        assert result.delta_direction == "stagnant"

        # delta = -3.01 → declining (strictly < threshold)
        result = await service._compute_motivation(
            user_id=test_user.id,
            current_readiness=46.99,  # 46.99 - 50 = -3.01
            current_verdict="not_ready",
            questions_total=100,
            questions_learned=47,
            has_stats=True,
        )
        assert result is not None
        assert result.delta_direction == "declining"

    @pytest.mark.asyncio
    async def test_new_user_no_stats(
        self,
        db_session: AsyncSession,
        test_user: User,
        history_deck: CultureDeck,
    ):
        """has_stats=False → delta_direction='new_user', key in MOTIVATION_NEW_USER_TEMPLATES."""
        await _create_questions_for_deck(db_session, history_deck, 10)

        service = CultureQuestionService(db_session)
        result = await service._compute_motivation(
            user_id=test_user.id,
            current_readiness=0.0,
            current_verdict="not_ready",
            questions_total=10,
            questions_learned=0,
            has_stats=False,
        )

        assert result is not None
        assert result.delta_direction == "new_user"
        assert result.message_key in MOTIVATION_NEW_USER_TEMPLATES

    @pytest.mark.asyncio
    async def test_motivation_null_when_no_questions(
        self,
        db_session: AsyncSession,
        test_user: User,
    ):
        """questions_total=0 → returns None."""
        service = CultureQuestionService(db_session)
        result = await service._compute_motivation(
            user_id=test_user.id,
            current_readiness=0.0,
            current_verdict="not_ready",
            questions_total=0,
            questions_learned=0,
            has_stats=False,
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_past_readiness_excludes_recent_stats(
        self,
        db_session: AsyncSession,
        test_user: User,
        history_deck: CultureDeck,
    ):
        """Stats created NOW are not counted as past stats (delta should be near zero).

        Stats with created_at=now() are NOT <= cutoff (now - 7 days),
        so past_readiness = 0 and delta ≈ current_readiness.
        """
        questions = await _create_questions_for_deck(db_session, history_deck, 100)

        # Create stats with created_at = now (recent, within MOTIVATION_DELTA_DAYS)
        recent_date = datetime.utcnow()
        await create_stats_with_date(
            db_session, test_user, questions[:30], CardStatus.MASTERED, recent_date
        )

        service = CultureQuestionService(db_session)
        result = await service._compute_motivation(
            user_id=test_user.id,
            current_readiness=30.0,
            current_verdict="not_ready",
            questions_total=100,
            questions_learned=30,
            has_stats=True,
        )

        assert result is not None
        # Recent stats don't count as past → past_readiness = 0 → delta = 30.0
        # 30.0 > MOTIVATION_DELTA_IMPROVING_THRESHOLD (3.0) → improving
        assert result.delta_direction == "improving"
        assert result.delta_percentage == 30.0

    @pytest.mark.asyncio
    async def test_past_readiness_includes_old_stats(
        self,
        db_session: AsyncSession,
        test_user: User,
        history_deck: CultureDeck,
    ):
        """Stats created 8 days ago ARE counted in past readiness.

        8 days > MOTIVATION_DELTA_DAYS (7), so these stats appear in past_readiness.
        """
        questions = await _create_questions_for_deck(db_session, history_deck, 100)

        # Create 40 MASTERED stats from 8 days ago → past_readiness = 40%
        old_date = datetime.utcnow() - timedelta(days=8)
        await create_stats_with_date(
            db_session, test_user, questions[:40], CardStatus.MASTERED, old_date
        )

        service = CultureQuestionService(db_session)
        result = await service._compute_motivation(
            user_id=test_user.id,
            current_readiness=40.0,
            current_verdict="getting_there",
            questions_total=100,
            questions_learned=40,
            has_stats=True,
        )

        assert result is not None
        # 40% old stats included in past → past_readiness=40%, delta=0 → stagnant
        assert result.delta_direction == "stagnant"
        assert result.params["previousPercent"] == 40.0

    @pytest.mark.asyncio
    async def test_deterministic_variant_selection(
        self,
        db_session: AsyncSession,
        test_user: User,
        history_deck: CultureDeck,
    ):
        """Same user_id + same ISO week → same message_key on every call."""
        questions = await _create_questions_for_deck(db_session, history_deck, 100)
        past_date = datetime.utcnow() - timedelta(days=8)
        await create_stats_with_date(
            db_session, test_user, questions[:50], CardStatus.MASTERED, past_date
        )

        service = CultureQuestionService(db_session)

        # Call 3 times with identical inputs — all should return the same message_key
        results = []
        for _ in range(3):
            result = await service._compute_motivation(
                user_id=test_user.id,
                current_readiness=50.0,
                current_verdict="getting_there",
                questions_total=100,
                questions_learned=50,
                has_stats=True,
            )
            assert result is not None
            results.append(result.message_key)

        assert results[0] == results[1] == results[2]

    @pytest.mark.asyncio
    async def test_message_key_pattern(
        self,
        db_session: AsyncSession,
        test_user: User,
        history_deck: CultureDeck,
    ):
        """For non-new-user, message_key matches cultureMotivation.{direction}.{verdictCamelCase}.{N}."""
        questions = await _create_questions_for_deck(db_session, history_deck, 100)
        past_date = datetime.utcnow() - timedelta(days=8)

        # 42 MASTERED old → past_readiness=42%; current=55% → delta=13 → improving
        await create_stats_with_date(
            db_session, test_user, questions[:42], CardStatus.MASTERED, past_date
        )

        service = CultureQuestionService(db_session)
        result = await service._compute_motivation(
            user_id=test_user.id,
            current_readiness=55.0,
            current_verdict="getting_there",
            questions_total=100,
            questions_learned=55,
            has_stats=True,
        )

        assert result is not None
        # Key format: cultureMotivation.improving.gettingThere.N
        assert result.message_key.startswith("cultureMotivation.improving.gettingThere.")
        # The trailing part should be a digit
        suffix = result.message_key.rsplit(".", 1)[-1]
        assert suffix.isdigit()

    @pytest.mark.asyncio
    async def test_params_dict_completeness(
        self,
        db_session: AsyncSession,
        test_user: User,
        history_deck: CultureDeck,
    ):
        """params has all 5 keys with correct types."""
        questions = await _create_questions_for_deck(db_session, history_deck, 100)
        past_date = datetime.utcnow() - timedelta(days=8)
        await create_stats_with_date(
            db_session, test_user, questions[:50], CardStatus.MASTERED, past_date
        )

        service = CultureQuestionService(db_session)
        result = await service._compute_motivation(
            user_id=test_user.id,
            current_readiness=55.0,
            current_verdict="getting_there",
            questions_total=100,
            questions_learned=55,
            has_stats=True,
        )

        assert result is not None
        params = result.params

        # All 5 required keys must be present
        assert "currentPercent" in params
        assert "previousPercent" in params
        assert "delta" in params
        assert "questionsTotal" in params
        assert "questionsLearned" in params

        # Type checks
        assert isinstance(params["currentPercent"], (int, float))
        assert isinstance(params["previousPercent"], (int, float))
        assert isinstance(params["delta"], (int, float))
        assert isinstance(params["questionsTotal"], int)
        assert isinstance(params["questionsLearned"], int)

        # Value checks
        assert params["currentPercent"] == 55.0
        assert params["previousPercent"] == 50.0
        assert params["delta"] == 5.0  # abs(55.0 - 50.0)
        assert params["questionsTotal"] == 100
        assert params["questionsLearned"] == 55

    @pytest.mark.asyncio
    async def test_full_readiness_includes_motivation(
        self,
        db_session: AsyncSession,
        test_user: User,
        history_deck: CultureDeck,
    ):
        """get_culture_readiness() returns non-None motivation when has_stats=True."""
        questions = await _create_questions_for_deck(db_session, history_deck, 100)

        # Create 20 MASTERED stats 8 days ago (so has_stats=True via get_culture_readiness)
        past_date = datetime.utcnow() - timedelta(days=8)
        await create_stats_with_date(
            db_session, test_user, questions[:20], CardStatus.MASTERED, past_date
        )

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        assert result.motivation is not None
