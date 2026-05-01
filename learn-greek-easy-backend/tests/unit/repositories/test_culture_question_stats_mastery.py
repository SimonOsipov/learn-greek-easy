"""Unit tests for CultureQuestionStatsRepository.get_category_mastery_counts.

Covers:
- empty user (no stats): mastered=0, total=total questions per category
- full history mastery: mastered == total for history
- partial geography mastery: mastered < total for geography
- dynamic discovery: categories come from DB, not hardcoded
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardStatus, CultureDeck, CultureQuestion, CultureQuestionStats, User
from src.repositories.culture_question_stats import CultureQuestionStatsRepository

# =============================================================================
# Helpers
# =============================================================================


async def _setup_deck_with_questions(
    db_session: AsyncSession,
    *,
    category: str,
    question_count: int,
) -> tuple[CultureDeck, list[CultureQuestion]]:
    """Create a deck with the given category and N questions."""
    deck = CultureDeck(
        name_en=f"{category.title()} Test Deck",
        name_el=category,
        name_ru=category,
        description_en="test",
        description_el="test",
        description_ru="test",
        category=category,
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()

    questions: list[CultureQuestion] = []
    for i in range(question_count):
        q = CultureQuestion(
            deck_id=deck.id,
            question_text={"en": f"Q{i}?", "el": f"Ε{i};"},
            option_a={"en": "A"},
            option_b={"en": "B"},
            option_c={"en": "C"},
            option_d={"en": "D"},
            correct_option=1,
            order_index=i,
        )
        db_session.add(q)
        questions.append(q)

    await db_session.flush()
    for q in questions:
        await db_session.refresh(q)
    return deck, questions


async def _master_questions(
    db_session: AsyncSession,
    user: User,
    questions: list[CultureQuestion],
) -> None:
    """Create MASTERED stats for each question."""
    from datetime import date

    for q in questions:
        stats = CultureQuestionStats(
            user_id=user.id,
            question_id=q.id,
            easiness_factor=2.6,
            interval=30,
            repetitions=5,
            next_review_date=date.today(),
            status=CardStatus.MASTERED,
        )
        db_session.add(stats)
    await db_session.flush()


# =============================================================================
# Tests
# =============================================================================


class TestGetCategoryMasteryCounts:
    @pytest.mark.asyncio
    async def test_empty_user_mastered_zero_total_reflects_db(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        """No stats for user → mastered=0, total = actual question count."""
        _, _ = await _setup_deck_with_questions(db_session, category="history", question_count=3)

        repo = CultureQuestionStatsRepository(db_session)
        result = await repo.get_category_mastery_counts(sample_user.id)

        assert "history" in result
        mastered, total = result["history"]
        assert mastered == 0
        assert total == 3

    @pytest.mark.asyncio
    async def test_full_history_mastery(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        """User masters all history questions → mastered == total."""
        _, questions = await _setup_deck_with_questions(
            db_session, category="history", question_count=4
        )
        await _master_questions(db_session, sample_user, questions)

        repo = CultureQuestionStatsRepository(db_session)
        result = await repo.get_category_mastery_counts(sample_user.id)

        mastered, total = result["history"]
        assert mastered == total == 4

    @pytest.mark.asyncio
    async def test_partial_geography_mastery(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        """User masters 2 of 5 geography questions → mastered < total."""
        _, geo_questions = await _setup_deck_with_questions(
            db_session, category="geography", question_count=5
        )
        # Master only first 2
        await _master_questions(db_session, sample_user, geo_questions[:2])

        repo = CultureQuestionStatsRepository(db_session)
        result = await repo.get_category_mastery_counts(sample_user.id)

        mastered, total = result["geography"]
        assert mastered == 2
        assert total == 5
        assert mastered < total

    @pytest.mark.asyncio
    async def test_categories_are_dynamic_from_db(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        """Method discovers categories from DB — only categories that exist are returned."""
        # Create only two categories in this test's DB state
        await _setup_deck_with_questions(db_session, category="history", question_count=2)
        await _setup_deck_with_questions(db_session, category="politics", question_count=3)

        repo = CultureQuestionStatsRepository(db_session)
        result = await repo.get_category_mastery_counts(sample_user.id)

        # Both categories present
        assert "history" in result
        assert "politics" in result

        # Totals correct
        _, total_history = result["history"]
        _, total_politics = result["politics"]
        assert total_history == 2
        assert total_politics == 3

    @pytest.mark.asyncio
    async def test_mixed_mastery_across_two_categories(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        """Full history mastery + partial geography mastery."""
        _, hist_qs = await _setup_deck_with_questions(
            db_session, category="history", question_count=3
        )
        _, geo_qs = await _setup_deck_with_questions(
            db_session, category="geography", question_count=4
        )

        # Master all history
        await _master_questions(db_session, sample_user, hist_qs)
        # Master 1 geography question
        await _master_questions(db_session, sample_user, geo_qs[:1])

        repo = CultureQuestionStatsRepository(db_session)
        result = await repo.get_category_mastery_counts(sample_user.id)

        hist_mastered, hist_total = result["history"]
        geo_mastered, geo_total = result["geography"]

        assert hist_mastered == hist_total == 3
        assert geo_mastered == 1
        assert geo_total == 4

    @pytest.mark.asyncio
    async def test_empty_db_returns_empty_dict(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        """No culture decks in DB → returns empty dict."""
        repo = CultureQuestionStatsRepository(db_session)
        result = await repo.get_category_mastery_counts(sample_user.id)
        assert result == {}
