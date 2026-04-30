"""Unit tests for CultureAnswerHistoryRepository.get_daily_answer_counts.

Covers:
- empty user: returns empty list
- single day: one tuple
- multi-day: correct counts per day, ascending order
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CultureAnswerHistory, CultureDeck, CultureQuestion, User
from src.repositories.culture_answer_history import CultureAnswerHistoryRepository

# =============================================================================
# Helpers
# =============================================================================


async def _make_culture_context(db_session: AsyncSession) -> tuple[CultureDeck, CultureQuestion]:
    """Create a minimal culture deck + question for answer history FK requirements."""
    deck = CultureDeck(
        name_en="Daily Count Test Deck",
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
        selected_option=1,
        time_taken_seconds=10,
        deck_category="history",
        created_at=created_at,
    )


# =============================================================================
# Tests
# =============================================================================


class TestGetDailyAnswerCounts:
    @pytest.mark.asyncio
    async def test_empty_user_returns_empty_list(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        repo = CultureAnswerHistoryRepository(db_session)
        result = await repo.get_daily_answer_counts(sample_user.id)
        assert result == []

    @pytest.mark.asyncio
    async def test_single_day_single_answer(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        _, question = await _make_culture_context(db_session)
        ts = datetime(2024, 5, 1, 12, 0, 0, tzinfo=timezone.utc)
        db_session.add(_answer(sample_user.id, question.id, created_at=ts))
        await db_session.flush()

        repo = CultureAnswerHistoryRepository(db_session)
        result = await repo.get_daily_answer_counts(sample_user.id)

        assert len(result) == 1
        d, cnt = result[0]
        assert cnt == 1

    @pytest.mark.asyncio
    async def test_multi_day_counts_correct(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        """4 answers on day 1, 1 on day 2, 3 on day 3 → ascending order."""
        _, question = await _make_culture_context(db_session)
        base = datetime(2024, 6, 1, 8, 0, 0, tzinfo=timezone.utc)

        # Day 1: 4 answers
        for i in range(4):
            db_session.add(
                _answer(sample_user.id, question.id, created_at=base + timedelta(minutes=i))
            )
        # Day 2: 1 answer
        db_session.add(_answer(sample_user.id, question.id, created_at=base + timedelta(days=1)))
        # Day 3: 3 answers
        for i in range(3):
            db_session.add(
                _answer(
                    sample_user.id,
                    question.id,
                    created_at=base + timedelta(days=2, minutes=i),
                )
            )
        await db_session.flush()

        repo = CultureAnswerHistoryRepository(db_session)
        result = await repo.get_daily_answer_counts(sample_user.id)

        assert len(result) == 3
        dates = [d for d, _ in result]
        cnts = [c for _, c in result]
        assert dates == sorted(dates)  # ascending
        assert cnts == [4, 1, 3]

    @pytest.mark.asyncio
    async def test_isolates_by_user(
        self,
        db_session: AsyncSession,
        sample_user: User,
        sample_user_with_settings: User,
    ) -> None:
        """Counts are per-user; other users' answers are not included."""
        _, question = await _make_culture_context(db_session)
        ts = datetime(2024, 7, 1, 10, 0, 0, tzinfo=timezone.utc)

        db_session.add(_answer(sample_user.id, question.id, created_at=ts))
        db_session.add(_answer(sample_user_with_settings.id, question.id, created_at=ts))
        await db_session.flush()

        repo = CultureAnswerHistoryRepository(db_session)
        result = await repo.get_daily_answer_counts(sample_user.id)

        assert len(result) == 1
        assert result[0][1] == 1


class TestGetConsecutiveCorrectStreak:
    @pytest.mark.asyncio
    async def test_empty_user_returns_zero(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        repo = CultureAnswerHistoryRepository(db_session)
        result = await repo.get_consecutive_correct_streak(sample_user.id)
        assert result == 0

    @pytest.mark.asyncio
    async def test_all_correct_returns_count(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        _, question = await _make_culture_context(db_session)
        base = datetime(2024, 8, 1, 10, 0, 0, tzinfo=timezone.utc)
        for i in range(5):
            db_session.add(
                _answer(
                    sample_user.id,
                    question.id,
                    created_at=base + timedelta(seconds=i),
                    is_correct=True,
                )
            )
        await db_session.flush()

        repo = CultureAnswerHistoryRepository(db_session)
        result = await repo.get_consecutive_correct_streak(sample_user.id)
        assert result == 5

    @pytest.mark.asyncio
    async def test_streak_broken_by_wrong(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        """3 correct then 1 wrong then 2 correct → streak = 3 (from most recent)."""
        _, question = await _make_culture_context(db_session)
        base = datetime(2024, 8, 2, 10, 0, 0, tzinfo=timezone.utc)
        # Oldest first: wrong, correct, correct, correct, correct, correct
        correctness = [False, True, True, True, True, True]
        for i, is_correct in enumerate(correctness):
            db_session.add(
                _answer(
                    sample_user.id,
                    question.id,
                    created_at=base + timedelta(seconds=i),
                    is_correct=is_correct,
                )
            )
        await db_session.flush()

        repo = CultureAnswerHistoryRepository(db_session)
        result = await repo.get_consecutive_correct_streak(sample_user.id)
        # Most recent 5 are correct, 6th (oldest) is wrong → streak = 5
        assert result == 5


class TestCountByLanguage:
    @pytest.mark.asyncio
    async def test_empty_user_returns_zero(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        repo = CultureAnswerHistoryRepository(db_session)
        result = await repo.count_by_language(sample_user.id, "el")
        assert result == 0

    @pytest.mark.asyncio
    async def test_counts_only_matching_language(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        _, question = await _make_culture_context(db_session)
        base = datetime(2024, 9, 1, 10, 0, 0, tzinfo=timezone.utc)

        # 3 Greek, 2 English answers
        for i in range(3):
            db_session.add(
                CultureAnswerHistory(
                    user_id=sample_user.id,
                    question_id=question.id,
                    language="el",
                    is_correct=True,
                    selected_option=1,
                    time_taken_seconds=5,
                    deck_category="history",
                    created_at=base + timedelta(seconds=i),
                )
            )
        for i in range(2):
            db_session.add(
                CultureAnswerHistory(
                    user_id=sample_user.id,
                    question_id=question.id,
                    language="en",
                    is_correct=True,
                    selected_option=1,
                    time_taken_seconds=5,
                    deck_category="history",
                    created_at=base + timedelta(seconds=10 + i),
                )
            )
        await db_session.flush()

        repo = CultureAnswerHistoryRepository(db_session)
        assert await repo.count_by_language(sample_user.id, "el") == 3
        assert await repo.count_by_language(sample_user.id, "en") == 2
        assert await repo.count_by_language(sample_user.id, "ru") == 0


class TestCountDistinctLanguages:
    @pytest.mark.asyncio
    async def test_empty_user_returns_zero(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        repo = CultureAnswerHistoryRepository(db_session)
        result = await repo.count_distinct_languages(sample_user.id)
        assert result == 0

    @pytest.mark.asyncio
    async def test_counts_distinct_languages(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        _, question = await _make_culture_context(db_session)
        base = datetime(2024, 10, 1, 10, 0, 0, tzinfo=timezone.utc)

        for i, lang in enumerate(["el", "en", "ru", "el", "en"]):
            db_session.add(
                CultureAnswerHistory(
                    user_id=sample_user.id,
                    question_id=question.id,
                    language=lang,
                    is_correct=True,
                    selected_option=1,
                    time_taken_seconds=5,
                    deck_category="history",
                    created_at=base + timedelta(seconds=i),
                )
            )
        await db_session.flush()

        repo = CultureAnswerHistoryRepository(db_session)
        result = await repo.count_distinct_languages(sample_user.id)
        assert result == 3
