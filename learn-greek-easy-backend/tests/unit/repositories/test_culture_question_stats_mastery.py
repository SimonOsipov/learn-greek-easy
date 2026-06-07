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

    @pytest.mark.asyncio
    async def test_all_mastered_returns_total_equals_mastered(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        """All questions mastered → each entry is (total, total)."""
        _, hist_qs = await _setup_deck_with_questions(
            db_session, category="history", question_count=3
        )
        _, geo_qs = await _setup_deck_with_questions(
            db_session, category="geography", question_count=2
        )
        await _master_questions(db_session, sample_user, hist_qs)
        await _master_questions(db_session, sample_user, geo_qs)

        repo = CultureQuestionStatsRepository(db_session)
        result = await repo.get_category_mastery_counts(sample_user.id)

        hist_mastered, hist_total = result["history"]
        geo_mastered, geo_total = result["geography"]
        assert hist_mastered == hist_total == 3
        assert geo_mastered == geo_total == 2

    @pytest.mark.asyncio
    async def test_multi_user_isolation(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        """Multi-user fixture: B's MASTERED rows must not leak into A's counts.

        Setup:
        - history: 4 questions; user A masters 2, user B masters all 4
        - geography: 3 questions; user B masters 2, user A masters none

        Assertions:
        - A's history: mastered=2, total=4
        - B's history: mastered=4, total=4
        - total is IDENTICAL for both users (user-independent)
        - A's geography: mastered=0, total=3
        - B's geography: mastered=2, total=3
        """
        # Create a second user (same minimal fields as sample_user fixture)
        user_b = User(
            email="user_b_mastery@example.com",
            full_name="User B",
            is_active=True,
        )
        db_session.add(user_b)
        await db_session.flush()
        await db_session.refresh(user_b)

        _, hist_qs = await _setup_deck_with_questions(
            db_session, category="history", question_count=4
        )
        _, geo_qs = await _setup_deck_with_questions(
            db_session, category="geography", question_count=3
        )

        # User A: masters hist[:2] only; nothing in geography
        await _master_questions(db_session, sample_user, hist_qs[:2])

        # User B: masters all history + geo[:2]
        await _master_questions(db_session, user_b, hist_qs)
        await _master_questions(db_session, user_b, geo_qs[:2])

        repo = CultureQuestionStatsRepository(db_session)

        result_a = await repo.get_category_mastery_counts(sample_user.id)
        result_b = await repo.get_category_mastery_counts(user_b.id)

        # User A — history
        a_hist_mastered, a_hist_total = result_a["history"]
        assert a_hist_mastered == 2, "A's mastered count must exclude B's rows"
        assert a_hist_total == 4, "total is user-independent"

        # User B — history
        b_hist_mastered, b_hist_total = result_b["history"]
        assert b_hist_mastered == 4
        assert b_hist_total == 4

        # Totals must be identical regardless of which user queries
        assert a_hist_total == b_hist_total, "total must be user-independent"

        # User A — geography: no stats → mastered=0
        a_geo_mastered, a_geo_total = result_a["geography"]
        assert a_geo_mastered == 0, "A has no geography stats; B's must not leak"
        assert a_geo_total == 3

        # User B — geography
        b_geo_mastered, b_geo_total = result_b["geography"]
        assert b_geo_mastered == 2
        assert b_geo_total == 3

    @pytest.mark.asyncio
    async def test_golden_value_identity_vs_legacy_logic(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        """Golden: new 2-query impl returns ==-identical dict to pre-consolidation snapshots.

        The pre-consolidation results are derived from seed data via explicit
        hand-calculation (non-circular — no round-trip through the method under test).

        Scenarios:
        - empty: {} == {}
        - zero-mastered: {history: (0, 3), geography: (0, 2)} — no stats at all
        - all-mastered: {history: (3, 3), geography: (2, 2)} — all questions MASTERED
        - partial: {history: (2, 3), geography: (1, 2)} — subset MASTERED
        """
        repo = CultureQuestionStatsRepository(db_session)

        # ---- scenario: empty (no decks) ----
        empty_result = await repo.get_category_mastery_counts(sample_user.id)
        assert empty_result == {}

        # ---- scenario: zero-mastered (decks + questions; user has no stats) ----
        _, hist_qs = await _setup_deck_with_questions(
            db_session, category="history", question_count=3
        )
        _, geo_qs = await _setup_deck_with_questions(
            db_session, category="geography", question_count=2
        )

        zero_result = await repo.get_category_mastery_counts(sample_user.id)
        expected_zero = {"history": (0, 3), "geography": (0, 2)}
        assert (
            zero_result == expected_zero
        ), f"zero-mastered golden mismatch: got {zero_result!r}, expected {expected_zero!r}"

        # ---- scenario: partial-mastered ----
        await _master_questions(db_session, sample_user, hist_qs[:2])
        await _master_questions(db_session, sample_user, geo_qs[:1])

        partial_result = await repo.get_category_mastery_counts(sample_user.id)
        expected_partial = {"history": (2, 3), "geography": (1, 2)}
        assert (
            partial_result == expected_partial
        ), f"partial-mastered golden mismatch: got {partial_result!r}, expected {expected_partial!r}"

        # ---- scenario: all-mastered ----
        # Master the remaining questions
        await _master_questions(db_session, sample_user, hist_qs[2:])
        await _master_questions(db_session, sample_user, geo_qs[1:])

        all_result = await repo.get_category_mastery_counts(sample_user.id)
        expected_all = {"history": (3, 3), "geography": (2, 2)}
        assert (
            all_result == expected_all
        ), f"all-mastered golden mismatch: got {all_result!r}, expected {expected_all!r}"
