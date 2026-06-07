"""SQLCON-04: golden tests for get_daily_answer_aggregates.

Validates that the new single conditional-aggregate query produces value-identical
results to the three legacy CultureAnswerHistoryRepository methods it replaces in
the GamificationProjection.compute() path:
  - get_total_answers
  - get_correct_answers_count
  - get_daily_answer_counts

Tests are authored RED-first (method does not exist until implementation).

AC1 — merged aggregates value-identical (multi-day, mixed correct/incorrect)
AC1 — culture accuracy metric value-identical via full GamificationProjection.compute
AC1 — empty user returns (0, 0, [])
AC3 — day-bucketing byte-identical to get_daily_answer_counts
AC2 — get_consecutive_correct_streak + count_distinct_languages remain separate/unchanged
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CultureAnswerHistory, CultureDeck, CultureQuestion, User
from src.repositories.culture_answer_history import CultureAnswerHistoryRepository
from tests.fixtures.golden import GoldenSeed, golden_seed_fixture  # noqa: F401

# =============================================================================
# Helpers
# =============================================================================


async def _make_culture_context(
    db_session: AsyncSession,
) -> tuple[CultureDeck, CultureQuestion]:
    """Minimal culture deck + question for FK requirements."""
    deck = CultureDeck(
        name_en=f"SQLCON04 Deck {uuid4().hex[:6]}",
        name_el="Δεκ",
        name_ru="Дек",
        description_en="test",
        description_el="test",
        description_ru="test",
        category="history",
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()

    question = CultureQuestion(
        deck_id=deck.id,
        question_text={"en": "Test?", "el": "Τεστ;"},
        option_a={"en": "A", "el": "Α"},
        option_b={"en": "B", "el": "Β"},
        option_c={"en": "C", "el": "Γ"},
        option_d={"en": "D", "el": "Δ"},
        correct_option=1,
    )
    db_session.add(question)
    await db_session.flush()
    await db_session.refresh(question)
    return deck, question


async def _make_user(db_session: AsyncSession) -> User:
    user = User(email=f"sqlcon04_{uuid4().hex[:8]}@example.com", is_active=True)
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


def _answer(
    user_id,
    question_id,
    *,
    created_at: datetime,
    is_correct: bool = True,
) -> CultureAnswerHistory:
    return CultureAnswerHistory(
        user_id=user_id,
        question_id=question_id,
        language="en",
        is_correct=is_correct,
        selected_option=1 if is_correct else 2,
        time_taken_seconds=10,
        deck_category="history",
        created_at=created_at,
    )


# =============================================================================
# AC1: merged aggregates value-identical to legacy three-query approach
# =============================================================================


@pytest.mark.unit
class TestMergedAggregatesMatchLegacy:
    """AC1: get_daily_answer_aggregates produces the same total/correct/daily
    as get_total_answers + get_correct_answers_count + get_daily_answer_counts."""

    @pytest.mark.asyncio
    async def test_multi_day_mixed_correct_incorrect(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Seed 3 distinct days with mixed correct/incorrect so correct != total.

        Day 1 (2024-04-01): 4 answers — 3 correct, 1 wrong
        Day 2 (2024-04-02): 2 answers — 1 correct, 1 wrong
        Day 3 (2024-04-03): 5 answers — 5 correct, 0 wrong

        Expected: total=11, correct=9, daily=[(d1,4),(d2,2),(d3,5)]
        """
        user = await _make_user(db_session)
        _, question = await _make_culture_context(db_session)

        day1 = datetime(2024, 4, 1, 10, 0, 0, tzinfo=timezone.utc)
        day2 = datetime(2024, 4, 2, 10, 0, 0, tzinfo=timezone.utc)
        day3 = datetime(2024, 4, 3, 10, 0, 0, tzinfo=timezone.utc)

        # Day 1: 3 correct + 1 wrong
        for i in range(3):
            db_session.add(
                _answer(
                    user.id, question.id, created_at=day1 + timedelta(minutes=i), is_correct=True
                )
            )
        db_session.add(
            _answer(user.id, question.id, created_at=day1 + timedelta(minutes=3), is_correct=False)
        )
        # Day 2: 1 correct + 1 wrong
        db_session.add(_answer(user.id, question.id, created_at=day2, is_correct=True))
        db_session.add(
            _answer(user.id, question.id, created_at=day2 + timedelta(minutes=1), is_correct=False)
        )
        # Day 3: 5 correct
        for i in range(5):
            db_session.add(
                _answer(
                    user.id, question.id, created_at=day3 + timedelta(minutes=i), is_correct=True
                )
            )
        await db_session.flush()

        repo = CultureAnswerHistoryRepository(db_session)

        # Legacy three-query approach
        legacy_total = await repo.get_total_answers(user.id)
        legacy_correct = await repo.get_correct_answers_count(user.id)
        legacy_daily = await repo.get_daily_answer_counts(user.id)

        # New single merged query
        agg_rows = await repo.get_daily_answer_aggregates(user.id)

        merged_total = sum(total for _, total, _ in agg_rows)
        merged_correct = sum(correct for _, _, correct in agg_rows)
        merged_daily = [(d, total) for d, total, _ in agg_rows]

        # Non-trivial: total > 0, correct > 0, correct != total
        assert legacy_total == 11
        assert legacy_correct == 9
        assert legacy_correct != legacy_total

        assert (
            merged_total == legacy_total
        ), f"total mismatch: merged={merged_total}, legacy={legacy_total}"
        assert (
            merged_correct == legacy_correct
        ), f"correct mismatch: merged={merged_correct}, legacy={legacy_correct}"
        assert (
            merged_daily == legacy_daily
        ), f"daily mismatch: merged={merged_daily}, legacy={legacy_daily}"

    @pytest.mark.asyncio
    async def test_golden_seed_merged_matches_legacy(
        self,
        db_session: AsyncSession,
        golden_seed_fixture: GoldenSeed,  # noqa: F811
    ) -> None:
        """Use the golden seed (UTC boundary pair, 1 correct + 1 wrong) to verify
        merged totals match legacy for both non-zero and non-trivially different."""
        user = golden_seed_fixture.user
        repo = CultureAnswerHistoryRepository(db_session)

        # Legacy
        legacy_total = await repo.get_total_answers(user.id)
        legacy_correct = await repo.get_correct_answers_count(user.id)
        legacy_daily = await repo.get_daily_answer_counts(user.id)

        # New merged
        agg_rows = await repo.get_daily_answer_aggregates(user.id)
        merged_total = sum(t for _, t, _ in agg_rows)
        merged_correct = sum(c for _, _, c in agg_rows)
        merged_daily = [(d, t) for d, t, _ in agg_rows]

        # Sanity: golden seed has 2 answers (1 correct, 1 wrong)
        assert legacy_total == 2
        assert legacy_correct == 1
        assert legacy_total != legacy_correct

        assert merged_total == legacy_total
        assert merged_correct == legacy_correct
        assert merged_daily == legacy_daily


@pytest.mark.unit
class TestEmptyUser:
    """AC1: zero culture answers → (0, 0, [])."""

    @pytest.mark.asyncio
    async def test_empty_user_zero_totals(
        self,
        db_session: AsyncSession,
    ) -> None:
        user = await _make_user(db_session)
        repo = CultureAnswerHistoryRepository(db_session)

        agg_rows = await repo.get_daily_answer_aggregates(user.id)

        merged_total = sum(t for _, t, _ in agg_rows)
        merged_correct = sum(c for _, _, c in agg_rows)
        merged_daily = [(d, t) for d, t, _ in agg_rows]

        assert merged_total == 0
        assert merged_correct == 0
        assert merged_daily == []
        assert agg_rows == []


# =============================================================================
# AC1: culture accuracy metric value-identical via GamificationProjection.compute
# =============================================================================


@pytest.mark.unit
class TestProjectionCultureMetricsValueIdentical:
    """AC1: GamificationProjection.compute returns the same CULTURE_ACCURACY and
    CULTURE_QUESTIONS_ANSWERED after the 3→1 consolidation."""

    @pytest.mark.asyncio
    async def test_culture_accuracy_and_count_via_full_projection(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Seed >=20 answers (mix correct/wrong) so CULTURE_ACCURACY > 0.

        25 answers total: 20 correct, 5 wrong → accuracy = round(20/25*100) = 80.

        Imports GamificationProjection and AchievementMetric locally to avoid
        triggering the module-level spaCy/pydantic-v1 REGEX import error that
        affects isolated collection of this file (pre-existing local-env artifact,
        not present in CI where the full suite is collected together).
        """
        # Local imports to avoid spaCy pydantic-v1 REGEX collection error in isolation
        from src.services.achievement_definitions import AchievementMetric  # noqa: PLC0415
        from src.services.gamification.projection import GamificationProjection  # noqa: PLC0415

        user = await _make_user(db_session)
        _, question = await _make_culture_context(db_session)

        base = datetime(2024, 5, 1, 10, 0, 0, tzinfo=timezone.utc)
        # 20 correct answers across 3 days
        for i in range(20):
            db_session.add(
                _answer(
                    user.id,
                    question.id,
                    created_at=base + timedelta(hours=i),
                    is_correct=True,
                )
            )
        # 5 wrong answers on a 4th day
        day4 = base + timedelta(days=3)
        for i in range(5):
            db_session.add(
                _answer(
                    user.id,
                    question.id,
                    created_at=day4 + timedelta(minutes=i),
                    is_correct=False,
                )
            )
        await db_session.flush()

        snap = await GamificationProjection.compute(db_session, user.id)

        assert snap.metrics[AchievementMetric.CULTURE_QUESTIONS_ANSWERED] == 25
        # round(20/25*100) = 80
        assert snap.metrics[AchievementMetric.CULTURE_ACCURACY] == 80


# =============================================================================
# AC3: day-bucketing byte-identical to get_daily_answer_counts
# =============================================================================


@pytest.mark.unit
class TestDayBucketingMatchesLegacy:
    """AC3: The day-keys produced by get_daily_answer_aggregates must match
    those produced by get_daily_answer_counts exactly, including UTC boundary."""

    @pytest.mark.asyncio
    async def test_utc_day_boundary_keys_match(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Answers at 23:30 and 00:30 UTC must land in two separate day buckets,
        and those buckets must be identical across old and new methods."""
        user = await _make_user(db_session)
        _, question = await _make_culture_context(db_session)

        evening = datetime(2024, 3, 15, 23, 30, 0, tzinfo=timezone.utc)
        morning = datetime(2024, 3, 16, 0, 30, 0, tzinfo=timezone.utc)

        db_session.add(_answer(user.id, question.id, created_at=evening, is_correct=True))
        db_session.add(_answer(user.id, question.id, created_at=morning, is_correct=False))
        await db_session.flush()

        repo = CultureAnswerHistoryRepository(db_session)

        legacy_daily = await repo.get_daily_answer_counts(user.id)
        agg_rows = await repo.get_daily_answer_aggregates(user.id)
        merged_daily = [(d, t) for d, t, _ in agg_rows]

        # Must produce two distinct day buckets
        assert len(legacy_daily) == 2
        assert merged_daily == legacy_daily

    @pytest.mark.asyncio
    async def test_golden_seed_day_keys_identical(
        self,
        db_session: AsyncSession,
        golden_seed_fixture: GoldenSeed,  # noqa: F811
    ) -> None:
        """Golden fixture places culture answers at UTC boundary — verify key alignment."""
        user = golden_seed_fixture.user
        repo = CultureAnswerHistoryRepository(db_session)

        legacy_daily = await repo.get_daily_answer_counts(user.id)
        agg_rows = await repo.get_daily_answer_aggregates(user.id)
        merged_daily = [(d, t) for d, t, _ in agg_rows]

        assert len(merged_daily) == 2
        assert merged_daily == legacy_daily


# =============================================================================
# AC2: consecutive_correct_streak + count_distinct_languages remain separate
# =============================================================================


@pytest.mark.unit
class TestSeparateQueriesUnchanged:
    """AC2: get_consecutive_correct_streak and count_distinct_languages remain
    separate repo calls (not folded into get_daily_answer_aggregates)."""

    @pytest.mark.asyncio
    async def test_consecutive_correct_streak_unaffected(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Seed: 2 correct then 1 wrong then 3 correct → consecutive_correct = 3."""
        user = await _make_user(db_session)
        _, question = await _make_culture_context(db_session)

        base = datetime(2024, 6, 1, 10, 0, 0, tzinfo=timezone.utc)
        # oldest to newest: correct, correct, WRONG, correct, correct, correct
        correctness = [True, True, False, True, True, True]
        for i, is_correct in enumerate(correctness):
            db_session.add(
                _answer(
                    user.id,
                    question.id,
                    created_at=base + timedelta(seconds=i),
                    is_correct=is_correct,
                )
            )
        await db_session.flush()

        repo = CultureAnswerHistoryRepository(db_session)

        streak = await repo.get_consecutive_correct_streak(user.id)
        assert streak == 3, f"Expected 3, got {streak}"

        # Also verify get_daily_answer_aggregates returns correct totals
        agg_rows = await repo.get_daily_answer_aggregates(user.id)
        merged_total = sum(t for _, t, _ in agg_rows)
        merged_correct = sum(c for _, _, c in agg_rows)
        # total=6, correct=5 — different from streak value
        assert merged_total == 6
        assert merged_correct == 5
        assert merged_correct != streak  # ensures they are independent scalars

    @pytest.mark.asyncio
    async def test_count_distinct_languages_unaffected(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Seed answers in 3 distinct languages; count_distinct_languages = 3,
        get_daily_answer_aggregates total = all answers across days."""
        user = await _make_user(db_session)
        _, question = await _make_culture_context(db_session)

        base = datetime(2024, 7, 1, 10, 0, 0, tzinfo=timezone.utc)
        languages = ["el", "en", "ru", "el", "en"]
        for i, lang in enumerate(languages):
            db_session.add(
                CultureAnswerHistory(
                    user_id=user.id,
                    question_id=question.id,
                    language=lang,
                    is_correct=True,
                    selected_option=1,
                    time_taken_seconds=10,
                    deck_category="history",
                    created_at=base + timedelta(seconds=i),
                )
            )
        await db_session.flush()

        repo = CultureAnswerHistoryRepository(db_session)

        distinct_langs = await repo.count_distinct_languages(user.id)
        assert distinct_langs == 3

        agg_rows = await repo.get_daily_answer_aggregates(user.id)
        merged_total = sum(t for _, t, _ in agg_rows)
        assert merged_total == 5  # all 5 answers counted
        # The two values are independent (5 != 3)
        assert merged_total != distinct_langs
