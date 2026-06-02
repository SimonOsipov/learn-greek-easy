"""Unit tests for CultureAnswerHistoryRepository.get_daily_answer_counts.

Covers:
- empty user: returns empty list
- single day: one tuple
- multi-day: correct counts per day, ascending order
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.constants import MAX_ANSWER_TIME_SECONDS
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
    time_taken_seconds: int = 10,
) -> CultureAnswerHistory:
    return CultureAnswerHistory(
        user_id=user_id,
        question_id=question_id,
        language="en",
        is_correct=is_correct,
        selected_option=1,
        time_taken_seconds=time_taken_seconds,
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


class TestGetStudyTimeThisWeek:
    """CULT2-3 / CHR-05: rolling trailing-7-day culture study time."""

    @pytest.mark.asyncio
    async def test_empty_user_returns_zero(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        repo = CultureAnswerHistoryRepository(db_session)
        assert await repo.get_study_time_this_week(sample_user.id) == 0

    @pytest.mark.asyncio
    async def test_sums_only_answers_within_trailing_7_days(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        """Answers in the last 7 days count; an 8-day-old answer is excluded."""
        _, question = await _make_culture_context(db_session)
        now = datetime.now(timezone.utc)
        # In window: 2 days ago (30s) + 6 days ago (20s) = 50
        db_session.add(
            _answer(
                sample_user.id,
                question.id,
                created_at=now - timedelta(days=2),
                time_taken_seconds=30,
            )
        )
        db_session.add(
            _answer(
                sample_user.id,
                question.id,
                created_at=now - timedelta(days=6),
                time_taken_seconds=20,
            )
        )
        # Outside window: 8 days ago → excluded
        db_session.add(
            _answer(
                sample_user.id,
                question.id,
                created_at=now - timedelta(days=8),
                time_taken_seconds=99,
            )
        )
        await db_session.flush()

        repo = CultureAnswerHistoryRepository(db_session)
        assert await repo.get_study_time_this_week(sample_user.id) == 50

    @pytest.mark.asyncio
    async def test_caps_each_answer_at_max(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        """A single outlier answer is capped at MAX_ANSWER_TIME_SECONDS."""
        _, question = await _make_culture_context(db_session)
        now = datetime.now(timezone.utc)
        db_session.add(
            _answer(
                sample_user.id,
                question.id,
                created_at=now - timedelta(days=1),
                time_taken_seconds=500,
            )
        )
        await db_session.flush()

        repo = CultureAnswerHistoryRepository(db_session)
        assert await repo.get_study_time_this_week(sample_user.id) == MAX_ANSWER_TIME_SECONDS

    @pytest.mark.asyncio
    async def test_isolates_by_user(
        self,
        db_session: AsyncSession,
        sample_user: User,
        sample_user_with_settings: User,
    ) -> None:
        """Only the requested user's answers are summed."""
        _, question = await _make_culture_context(db_session)
        now = datetime.now(timezone.utc)
        db_session.add(
            _answer(
                sample_user.id,
                question.id,
                created_at=now - timedelta(days=1),
                time_taken_seconds=15,
            )
        )
        db_session.add(
            _answer(
                sample_user_with_settings.id,
                question.id,
                created_at=now - timedelta(days=1),
                time_taken_seconds=40,
            )
        )
        await db_session.flush()

        repo = CultureAnswerHistoryRepository(db_session)
        assert await repo.get_study_time_this_week(sample_user.id) == 15


class TestGetStudyTimeForDeck:
    """DDR-01: per-deck study time aggregation."""

    @pytest.mark.asyncio
    async def test_empty_returns_zero(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        """No answers for user → 0."""
        deck, _ = await _make_culture_context(db_session)
        repo = CultureAnswerHistoryRepository(db_session)
        result = await repo.get_study_time_for_deck(sample_user.id, deck.id)
        assert result == 0

    @pytest.mark.asyncio
    async def test_sums_answers_for_deck(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        """Sum of answer times for the target deck's questions."""
        deck, question = await _make_culture_context(db_session)
        now = datetime.now(timezone.utc)
        db_session.add(_answer(sample_user.id, question.id, created_at=now, time_taken_seconds=30))
        db_session.add(_answer(sample_user.id, question.id, created_at=now, time_taken_seconds=20))
        await db_session.flush()

        repo = CultureAnswerHistoryRepository(db_session)
        assert await repo.get_study_time_for_deck(sample_user.id, deck.id) == 50

    @pytest.mark.asyncio
    async def test_caps_answer_at_max(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        """A single answer with time > MAX_ANSWER_TIME_SECONDS contributes exactly MAX."""
        deck, question = await _make_culture_context(db_session)
        now = datetime.now(timezone.utc)
        db_session.add(
            _answer(sample_user.id, question.id, created_at=now, time_taken_seconds=9999)
        )
        await db_session.flush()

        repo = CultureAnswerHistoryRepository(db_session)
        assert (
            await repo.get_study_time_for_deck(sample_user.id, deck.id) == MAX_ANSWER_TIME_SECONDS
        )

    @pytest.mark.asyncio
    async def test_cross_deck_isolation(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        """Answers for deck B are excluded from deck A's total."""
        deck_a, question_a = await _make_culture_context(db_session)
        deck_b, question_b = await _make_culture_context(db_session)
        now = datetime.now(timezone.utc)

        # 25s on deck A, 50s on deck B
        db_session.add(
            _answer(sample_user.id, question_a.id, created_at=now, time_taken_seconds=25)
        )
        db_session.add(
            _answer(sample_user.id, question_b.id, created_at=now, time_taken_seconds=50)
        )
        await db_session.flush()

        repo = CultureAnswerHistoryRepository(db_session)
        assert await repo.get_study_time_for_deck(sample_user.id, deck_a.id) == 25
        assert await repo.get_study_time_for_deck(sample_user.id, deck_b.id) == 50

    @pytest.mark.asyncio
    async def test_orphan_question_excluded(
        self,
        db_session: AsyncSession,
        sample_user: User,
    ) -> None:
        """Answer to a CultureQuestion with deck_id IS NULL is excluded."""
        from src.db.models import CultureQuestion as CQ

        deck, _ = await _make_culture_context(db_session)
        # Create a question with deck_id=None (orphan)
        orphan_q = CQ(
            deck_id=None,
            question_text={"en": "Orphan?", "el": "Ορφανό;"},
            option_a={"en": "A", "el": "Α"},
            option_b={"en": "B", "el": "Β"},
            option_c={"en": "C", "el": "Γ"},
            option_d={"en": "D", "el": "Δ"},
            correct_option=1,
        )
        db_session.add(orphan_q)
        await db_session.flush()
        await db_session.refresh(orphan_q)

        now = datetime.now(timezone.utc)
        db_session.add(_answer(sample_user.id, orphan_q.id, created_at=now, time_taken_seconds=100))
        await db_session.flush()

        repo = CultureAnswerHistoryRepository(db_session)
        # deck has no answers, orphan answer should not appear under deck
        assert await repo.get_study_time_for_deck(sample_user.id, deck.id) == 0
