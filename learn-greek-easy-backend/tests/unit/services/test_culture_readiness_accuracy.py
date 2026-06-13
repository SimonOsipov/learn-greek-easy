"""RED tests for PRACT2-7-05: culture accuracy all-time window + no-attempts exclusion.

The bug (D5 from architect): per-category accuracy uses a 30-day window
(CultureAnswerHistory.created_at >= now - 30 days) while overall accuracy has
NO time filter (all-time). This split means answers older than 30 days make
every category's accuracy_percentage=None ("no attempts") while the overall
accuracy_percentage is non-null — a logical contradiction.

The fix: align both queries to all-time AND implement zero-denominator semantics
so that categories with zero attempts contribute neither numerator nor denominator
to the overall accuracy figure.

These tests are authored RED before the fix lands.
"""

from datetime import date, datetime, timedelta

import pytest
import sqlalchemy as sa
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
# Helpers  (mirror of test_culture_readiness.py; do not import across files)
# =============================================================================


async def _make_deck(
    db_session: AsyncSession,
    category: str,
    name: str = "Test Deck",
    is_active: bool = True,
) -> CultureDeck:
    deck = CultureDeck(
        name_en=name,
        name_el=name,
        name_ru=name,
        description_en=name,
        description_el=name,
        description_ru=name,
        category=category,
        is_active=is_active,
        order_index=0,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


async def _make_questions(
    db_session: AsyncSession, deck: CultureDeck, count: int
) -> list[CultureQuestion]:
    questions = []
    for i in range(count):
        q = CultureQuestion(
            deck_id=deck.id,
            question_text={"en": f"Q{i}?", "el": f"Q{i}?", "ru": f"Q{i}?"},
            option_a={"en": "A", "el": "A", "ru": "A"},
            option_b={"en": "B", "el": "B", "ru": "B"},
            option_c={"en": "C", "el": "C", "ru": "C"},
            option_d={"en": "D", "el": "D", "ru": "D"},
            correct_option=1,
            order_index=i,
        )
        db_session.add(q)
        questions.append(q)
    await db_session.flush()
    for q in questions:
        await db_session.refresh(q)
    return questions


async def _make_stats(
    db_session: AsyncSession, user: User, questions: list[CultureQuestion], status: CardStatus
) -> None:
    for q in questions:
        db_session.add(
            CultureQuestionStats(
                user_id=user.id,
                question_id=q.id,
                status=status,
                easiness_factor=2.5,
                interval=1,
                repetitions=1,
                next_review_date=date.today(),
            )
        )
    await db_session.flush()


async def _make_answer(
    db_session: AsyncSession,
    user: User,
    question: CultureQuestion,
    deck_category: str,
    is_correct: bool,
    created_at: datetime,
) -> CultureAnswerHistory:
    """Insert an answer history row with an explicit created_at timestamp."""
    entry = CultureAnswerHistory(
        user_id=user.id,
        question_id=question.id,
        language="en",
        is_correct=is_correct,
        selected_option=1,
        time_taken_seconds=5,
        deck_category=deck_category,
    )
    db_session.add(entry)
    await db_session.flush()
    # Override the server-default created_at
    await db_session.execute(
        sa.update(CultureAnswerHistory)
        .where(CultureAnswerHistory.id == entry.id)
        .values(created_at=created_at)
    )
    await db_session.refresh(entry)
    return entry


# =============================================================================
# Test class
# =============================================================================


class TestCultureReadinessAccuracyWindow:
    """RED tests for PRACT2-7-05 — culture accuracy all-time alignment."""

    @pytest.mark.asyncio
    async def test_overall_null_when_all_categories_empty(
        self,
        db_session: AsyncSession,
        test_user: User,
    ):
        """AC-2: user with zero answers → overall accuracy is None AND every
        category's accuracy_percentage is None (no attempts anywhere).

        This validates the 'no attempts → None, not 0%' semantics that the fix
        must preserve. Should pass on both current and fixed code.
        """
        # Create one history deck with some questions so the service has real
        # categories to iterate over, but add ZERO answer history rows.
        deck = await _make_deck(db_session, "history", "History Deck")
        questions = await _make_questions(db_session, deck, 5)
        await _make_stats(db_session, test_user, questions, CardStatus.REVIEW)

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        # Overall accuracy must be None — zero answers means no accuracy signal.
        assert result.accuracy_percentage is None, (
            "Expected overall accuracy_percentage to be None when no answers exist, "
            f"got {result.accuracy_percentage}"
        )

        # Every logical category that has zero answers must also report None.
        cats_with_answers = [c for c in result.categories if c.accuracy_percentage is not None]
        assert cats_with_answers == [], (
            "Expected all categories to have accuracy_percentage=None with zero answers, "
            f"but these reported non-None: {[(c.category, c.accuracy_percentage) for c in cats_with_answers]}"
        )

    @pytest.mark.asyncio
    async def test_overall_and_category_same_window(
        self,
        db_session: AsyncSession,
        test_user: User,
    ):
        """AC-1: answers placed ~40 days ago (older than the 30-day per-category
        filter) must be reflected in BOTH per-category AND overall accuracy after
        the fix.

        Current (buggy) behaviour:
          - per-category query: created_at >= now-30d  → excludes 40-day-old rows
            → history category accuracy_percentage = None
          - overall query: no time filter (all-time) → includes 40-day-old rows
            → overall accuracy_percentage = non-null (e.g. 80.0)

        This test asserts the FIXED behaviour: both are non-null.
        It fails on current code because the per-category assertion is not met.

        This is the primary RED gate for PRACT2-7-05.
        """
        deck = await _make_deck(db_session, "history", "History Deck")
        questions = await _make_questions(db_session, deck, 5)
        await _make_stats(db_session, test_user, questions, CardStatus.REVIEW)

        # All 5 answers placed 40 days ago — well outside the current 30-day window.
        old_date = datetime.utcnow() - timedelta(days=40)
        for i, q in enumerate(questions):
            await _make_answer(
                db_session,
                test_user,
                q,
                deck_category="history",
                is_correct=(i < 4),  # 4 correct, 1 wrong → 80%
                created_at=old_date,
            )

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        history_cat = next((c for c in result.categories if c.category == "history"), None)
        assert history_cat is not None, "Expected a 'history' category in the result"

        # After the fix: per-category accuracy must be non-null (all-time, not 30-day)
        assert history_cat.accuracy_percentage is not None, (
            "PRACT2-7-05 RED: history category accuracy_percentage is None for answers "
            "older than 30 days — expected non-None after the all-time alignment fix. "
            "This failure confirms the current 30-day/all-time split bug exists."
        )
        # Sanity: the 40-day-old answers give exactly 80.0% (4 correct / 5)
        assert history_cat.accuracy_percentage == pytest.approx(
            80.0, abs=0.1
        ), f"Expected history accuracy_percentage ≈ 80.0%, got {history_cat.accuracy_percentage}"

        # After the fix: overall accuracy must also be non-null
        assert result.accuracy_percentage is not None, (
            "Expected overall accuracy_percentage to be non-null when answers exist "
            "(even if older than 30 days). Got None."
        )
        # Overall accuracy must reflect the same 40-day-old data
        assert result.accuracy_percentage == pytest.approx(
            80.0, abs=0.1
        ), f"Expected overall accuracy_percentage ≈ 80.0%, got {result.accuracy_percentage}"

    @pytest.mark.asyncio
    async def test_empty_category_excluded_from_overall(
        self,
        db_session: AsyncSession,
        test_user: User,
    ):
        """AC-3: one category has attempts, all others have zero answers.
        Overall accuracy must equal that one category's accuracy — empty
        categories contribute NEITHER numerator NOR denominator (they do not
        pull the overall figure toward 0%).

        Example: history has 4/5 correct (80%). Geography has no answers.
        Expected overall: 80.0% (denominator = 5, not 10 or more).
        Would be wrong: 40% (if empty categories counted as 0/N correct).
        """
        history_deck = await _make_deck(db_session, "history", "History Deck")
        geography_deck = await _make_deck(db_session, "geography", "Geography Deck")

        history_qs = await _make_questions(db_session, history_deck, 5)
        geography_qs = await _make_questions(db_session, geography_deck, 5)

        await _make_stats(db_session, test_user, history_qs, CardStatus.REVIEW)
        await _make_stats(db_session, test_user, geography_qs, CardStatus.REVIEW)

        now = datetime.utcnow()
        # Only history gets answers: 4 correct + 1 wrong = 80%
        for i, q in enumerate(history_qs):
            await _make_answer(
                db_session,
                test_user,
                q,
                deck_category="history",
                is_correct=(i < 4),
                created_at=now,
            )
        # Geography: no answers at all.

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        history_cat = next((c for c in result.categories if c.category == "history"), None)
        geography_cat = next((c for c in result.categories if c.category == "geography"), None)

        assert history_cat is not None
        assert geography_cat is not None

        # Geography has no answers → its per-category accuracy must be None
        assert geography_cat.accuracy_percentage is None, (
            "Expected geography accuracy_percentage to be None (no attempts), "
            f"got {geography_cat.accuracy_percentage}"
        )

        # History has answers → non-null at 80%
        assert history_cat.accuracy_percentage is not None
        assert history_cat.accuracy_percentage == pytest.approx(
            80.0, abs=0.1
        ), f"Expected history accuracy_percentage ≈ 80.0%, got {history_cat.accuracy_percentage}"

        # Overall must equal history (the only category with attempts).
        # If geography were counted as 0/5 correct, overall = 4/10 = 40%, NOT 80%.
        assert result.accuracy_percentage is not None, (
            "Expected overall accuracy_percentage to be non-null when at least one "
            "category has answers."
        )
        assert result.accuracy_percentage == pytest.approx(80.0, abs=0.1), (
            f"AC-3 FAILED: overall accuracy_percentage = {result.accuracy_percentage}, "
            "expected ≈ 80.0%. "
            "Empty categories (geography, 0 answers) must NOT contribute to the "
            "overall denominator — they are pulling the figure toward 0%."
        )

    @pytest.mark.asyncio
    async def test_overall_accuracy_is_pooled_not_averaged(
        self,
        db_session: AsyncSession,
        test_user: User,
    ):
        """Adversarial: overall accuracy_percentage is pooled sum(correct)/sum(total)
        across categories, NOT an average of per-category percentages.

        Setup:
          history:   9 correct / 10 total  → per-category = 90.0%
          geography: 1 correct /  5 total  → per-category = 20.0%

        Pooled:  (9 + 1) / (10 + 5) = 10/15 ≈ 66.7%
        Averaged: (90.0 + 20.0) / 2       = 55.0%

        The two values differ whenever categories have unequal answer counts.
        This test locks in pooled semantics and fails if the implementation
        ever switches to averaging per-category percentages.
        """
        history_deck = await _make_deck(db_session, "history", "History Deck")
        geography_deck = await _make_deck(db_session, "geography", "Geography Deck")

        history_qs = await _make_questions(db_session, history_deck, 10)
        geography_qs = await _make_questions(db_session, geography_deck, 5)

        await _make_stats(db_session, test_user, history_qs, CardStatus.REVIEW)
        await _make_stats(db_session, test_user, geography_qs, CardStatus.REVIEW)

        now = datetime.utcnow()

        # history: 9 correct, 1 wrong
        for i, q in enumerate(history_qs):
            await _make_answer(
                db_session,
                test_user,
                q,
                deck_category="history",
                is_correct=(i < 9),
                created_at=now,
            )

        # geography: 1 correct, 4 wrong
        for i, q in enumerate(geography_qs):
            await _make_answer(
                db_session,
                test_user,
                q,
                deck_category="geography",
                is_correct=(i < 1),
                created_at=now,
            )

        service = CultureQuestionService(db_session)
        result = await service.get_culture_readiness(test_user.id)

        history_cat = next((c for c in result.categories if c.category == "history"), None)
        geography_cat = next((c for c in result.categories if c.category == "geography"), None)

        assert history_cat is not None
        assert geography_cat is not None

        # Per-category sanity checks
        assert history_cat.accuracy_percentage == pytest.approx(
            90.0, abs=0.1
        ), f"Expected history accuracy ≈ 90.0%, got {history_cat.accuracy_percentage}"
        assert geography_cat.accuracy_percentage == pytest.approx(
            20.0, abs=0.1
        ), f"Expected geography accuracy ≈ 20.0%, got {geography_cat.accuracy_percentage}"

        # Overall must be pooled (66.7%), not the average-of-averages (55.0%)
        pooled_expected = (9 + 1) / (10 + 5) * 100  # 66.666...%
        averaged_expected = (90.0 + 20.0) / 2  # 55.0%

        assert result.accuracy_percentage is not None
        assert result.accuracy_percentage == pytest.approx(pooled_expected, abs=0.2), (
            f"Overall accuracy_percentage = {result.accuracy_percentage}. "
            f"Expected pooled ≈ {pooled_expected:.1f}% (sum(correct)/sum(total)), "
            f"not average-of-averages {averaged_expected:.1f}%. "
            "If this test fails, the implementation switched to averaging per-category "
            "percentages instead of pooling raw answer rows."
        )
