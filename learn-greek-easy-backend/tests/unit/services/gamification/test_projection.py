"""Unit tests for GamificationProjection.compute().

Coverage:
- Empty user: all metrics zero, no achievements unlocked
- Basic user: 1 mastered card → learning_first_word unlocked
- Streak user: 7-day streak → first_flame + warming_up
- Session speedster: CPM threshold met → speed_demon unlocked
- Night Owl: max_hour=23 → unlocked
- Early Bird: min_hour=5 → 24-5=19 >= 17 → unlocked
- Weekly accuracy below min cardinality (< 50) yields 0
- Culture accuracy below min cardinality (< 20) yields 0
- Exhaustiveness: every AchievementMetric value is present in snapshot.metrics
- Determinism: same input → equal snapshots (modulo computed_at)
- No DB writes: mock session, assert no mutating calls
- INACTIVE_RETURN excludes trailing gap (last reviewed 30 days ago)
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    CardRecord,
    CardRecordReview,
    CardRecordStatistics,
    CardStatus,
    CardType,
    CultureAnswerHistory,
    CultureDeck,
    CultureQuestion,
    Deck,
    DeckLevel,
    PartOfSpeech,
    User,
    WordEntry,
)
from src.services.achievement_definitions import AchievementMetric
from src.services.gamification.projection import GamificationProjection

# =============================================================================
# Helpers
# =============================================================================


async def _make_user(db_session: AsyncSession) -> User:
    user = User(email=f"gamif_test_{uuid4().hex[:8]}@example.com", is_active=True)
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


async def _make_culture_context(
    db_session: AsyncSession,
    category: str = "history",
) -> tuple[CultureDeck, CultureQuestion]:
    deck = CultureDeck(
        name_en="Test Deck",
        name_el="Δεκ",
        name_ru="Дек",
        description_en="test",
        description_el="test",
        description_ru="test",
        category=category,
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


async def _make_deck(db_session: AsyncSession, level: DeckLevel = DeckLevel.A1) -> Deck:
    deck = Deck(
        name_el="Δοκιμή",
        name_en="Test Deck",
        name_ru="Тест",
        description_el="desc",
        description_en="desc",
        description_ru="desc",
        level=level,
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


async def _make_card(
    db_session: AsyncSession, deck_id: UUID, word_entry_id: UUID | None = None
) -> CardRecord:
    if word_entry_id is None:
        word = WordEntry(
            owner_id=None,
            lemma=f"test_{uuid4().hex[:8]}",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="test",
            is_active=True,
        )
        db_session.add(word)
        await db_session.flush()
        word_entry_id = word.id
    card = CardRecord(
        deck_id=deck_id,
        word_entry_id=word_entry_id,
        card_type=CardType.MEANING_EL_TO_EN,
        variant_key=f"v_{uuid4().hex[:8]}",
        front_content={"el": "word"},
        back_content={"en": "meaning"},
        is_active=True,
    )
    db_session.add(card)
    await db_session.flush()
    await db_session.refresh(card)
    return card


async def _make_card_stats(
    db_session: AsyncSession,
    user_id: UUID,
    card_record_id: UUID,
    status: CardStatus = CardStatus.MASTERED,
) -> CardRecordStatistics:
    stats = CardRecordStatistics(
        user_id=user_id,
        card_record_id=card_record_id,
        easiness_factor=2.5,
        interval=1,
        repetitions=1,
        next_review_date=date.today(),
        status=status,
    )
    db_session.add(stats)
    await db_session.flush()
    return stats


async def _make_review(
    db_session: AsyncSession,
    user_id: UUID,
    card_record_id: UUID,
    *,
    reviewed_at: datetime,
    quality: int = 4,
    time_taken: int = 10,
) -> CardRecordReview:
    review = CardRecordReview(
        user_id=user_id,
        card_record_id=card_record_id,
        quality=quality,
        time_taken=time_taken,
        reviewed_at=reviewed_at,
    )
    db_session.add(review)
    await db_session.flush()
    return review


def _culture_answer(
    user_id: UUID,
    question_id: UUID,
    *,
    created_at: datetime,
    is_correct: bool = True,
    language: str = "en",
) -> CultureAnswerHistory:
    return CultureAnswerHistory(
        user_id=user_id,
        question_id=question_id,
        language=language,
        is_correct=is_correct,
        selected_option=1,
        time_taken_seconds=10,
        deck_category="history",
        created_at=created_at,
    )


# =============================================================================
# Tests
# =============================================================================


@pytest.mark.unit
class TestEmptyUser:
    """An empty user should have all-zero metrics and no unlocked achievements."""

    async def test_empty_user_zero_metrics_no_unlocks(self, db_session: AsyncSession) -> None:
        user = await _make_user(db_session)
        snap = await GamificationProjection.compute(db_session, user.id)

        assert snap.metrics[AchievementMetric.STREAK_DAYS] == 0
        assert snap.metrics[AchievementMetric.CARDS_LEARNED] == 0
        assert snap.metrics[AchievementMetric.TOTAL_REVIEWS] == 0
        assert snap.metrics[AchievementMetric.CULTURE_QUESTIONS_ANSWERED] == 0
        assert snap.unlocked == frozenset()
        assert snap.projection_version == 1
        assert snap.user_id == user.id


@pytest.mark.unit
class TestBasicUserFirstWord:
    """1 mastered card → learning_first_word unlocked."""

    async def test_basic_user_unlocks_first_word(self, db_session: AsyncSession) -> None:
        user = await _make_user(db_session)
        deck = await _make_deck(db_session, DeckLevel.A1)
        card = await _make_card(db_session, deck.id)
        await _make_card_stats(db_session, user.id, card.id, status=CardStatus.MASTERED)

        snap = await GamificationProjection.compute(db_session, user.id)

        assert snap.metrics[AchievementMetric.CARDS_LEARNED] >= 1
        assert snap.metrics[AchievementMetric.CARDS_MASTERED] >= 1
        assert "learning_first_word" in snap.unlocked


@pytest.mark.unit
class TestStreakUser:
    """7-day streak → streak_first_flame (threshold 3) and streak_warming_up (threshold 7)."""

    async def test_streak_user_unlocks_streak_achievements(self, db_session: AsyncSession) -> None:
        user = await _make_user(db_session)
        deck = await _make_deck(db_session, DeckLevel.A1)
        card = await _make_card(db_session, deck.id)
        await _make_card_stats(db_session, user.id, card.id, status=CardStatus.LEARNING)

        today = datetime.now(timezone.utc)
        # Create reviews for 7 consecutive days ending today
        for days_ago in range(7):
            ts = today - timedelta(days=days_ago)
            await _make_review(db_session, user.id, card.id, reviewed_at=ts)

        snap = await GamificationProjection.compute(db_session, user.id)

        assert snap.metrics[AchievementMetric.STREAK_DAYS] >= 7
        assert "streak_first_flame" in snap.unlocked  # threshold 3
        assert "streak_warming_up" in snap.unlocked  # threshold 7


@pytest.mark.unit
class TestSessionSpeedster:
    """30 cards / 60 s = 30 cpm > threshold 20 → speed_demon unlocked."""

    async def test_session_speedster_uses_cpm_threshold(self, db_session: AsyncSession) -> None:
        user = await _make_user(db_session)
        deck = await _make_deck(db_session, DeckLevel.A1)

        base_time = datetime.now(timezone.utc) - timedelta(hours=1)
        # Create 30 cards reviewed within a 60-second window (= 30 cpm)
        for i in range(30):
            card = await _make_card(db_session, deck.id)
            await _make_card_stats(db_session, user.id, card.id, status=CardStatus.REVIEW)
            ts = base_time + timedelta(seconds=i * 2)  # 2s apart → 60s total for 30 reviews
            await _make_review(
                db_session, user.id, card.id, reviewed_at=ts, quality=4, time_taken=2
            )

        snap = await GamificationProjection.compute(db_session, user.id)

        assert snap.metrics[AchievementMetric.SESSION_SPEED_CPM] >= 20
        assert "session_speed_demon" in snap.unlocked


@pytest.mark.unit
class TestNightOwl:
    """Review at hour=23 UTC → SESSION_HOUR_LATEST=23 >= threshold 22 → unlocked."""

    async def test_night_owl_at_22_unlocks(self, db_session: AsyncSession) -> None:
        user = await _make_user(db_session)
        deck = await _make_deck(db_session, DeckLevel.A1)
        card = await _make_card(db_session, deck.id)
        await _make_card_stats(db_session, user.id, card.id, status=CardStatus.REVIEW)

        # Review at 23:00 UTC
        today = date.today()
        ts = datetime(today.year, today.month, today.day, 23, 0, 0, tzinfo=timezone.utc)
        await _make_review(db_session, user.id, card.id, reviewed_at=ts)

        snap = await GamificationProjection.compute(db_session, user.id)

        assert snap.metrics[AchievementMetric.SESSION_HOUR_LATEST] >= 22
        assert "session_night_owl" in snap.unlocked


@pytest.mark.unit
class TestEarlyBird:
    """Review at hour=5 UTC → stored as 24-5=19 >= threshold 17 → unlocked."""

    async def test_early_bird_at_5_unlocks(self, db_session: AsyncSession) -> None:
        user = await _make_user(db_session)
        deck = await _make_deck(db_session, DeckLevel.A1)
        card = await _make_card(db_session, deck.id)
        await _make_card_stats(db_session, user.id, card.id, status=CardStatus.REVIEW)

        # Review at 05:00 UTC
        today = date.today()
        ts = datetime(today.year, today.month, today.day, 5, 0, 0, tzinfo=timezone.utc)
        await _make_review(db_session, user.id, card.id, reviewed_at=ts)

        snap = await GamificationProjection.compute(db_session, user.id)

        # 24 - 5 = 19 >= 17 (threshold for early bird)
        assert snap.metrics[AchievementMetric.SESSION_HOUR_EARLIEST] == 19
        assert "session_early_bird" in snap.unlocked


@pytest.mark.unit
class TestWeeklyAccuracyCardinality:
    """<50 reviews → WEEKLY_ACCURACY = 0, even if 100% correct."""

    async def test_weekly_accuracy_below_min_cardinality_yields_zero(
        self, db_session: AsyncSession
    ) -> None:
        user = await _make_user(db_session)
        deck = await _make_deck(db_session, DeckLevel.A1)

        today = datetime.now(timezone.utc)
        # Add 49 correct reviews (below the 50-review threshold)
        for i in range(49):
            card = await _make_card(db_session, deck.id)
            await _make_card_stats(db_session, user.id, card.id, status=CardStatus.REVIEW)
            ts = today - timedelta(days=1, seconds=i)
            await _make_review(db_session, user.id, card.id, reviewed_at=ts, quality=5)

        snap = await GamificationProjection.compute(db_session, user.id)

        assert snap.metrics[AchievementMetric.WEEKLY_ACCURACY] == 0


@pytest.mark.unit
class TestCultureAccuracyCardinality:
    """<20 culture answers → CULTURE_ACCURACY = 0, even if 100% correct."""

    async def test_culture_accuracy_below_min_cardinality_yields_zero(
        self, db_session: AsyncSession
    ) -> None:
        user = await _make_user(db_session)
        _, question = await _make_culture_context(db_session)

        base = datetime.now(timezone.utc) - timedelta(hours=1)
        # Add 19 correct culture answers (below the 20-answer threshold)
        for i in range(19):
            db_session.add(
                _culture_answer(
                    user.id,
                    question.id,
                    created_at=base + timedelta(seconds=i),
                    is_correct=True,
                )
            )
        await db_session.flush()

        snap = await GamificationProjection.compute(db_session, user.id)

        assert snap.metrics[AchievementMetric.CULTURE_ACCURACY] == 0


@pytest.mark.unit
class TestExhaustiveness:
    """Every AchievementMetric value must be present in snapshot.metrics."""

    async def test_exhaustiveness_all_metrics_present(self, db_session: AsyncSession) -> None:
        user = await _make_user(db_session)
        snap = await GamificationProjection.compute(db_session, user.id)

        for metric in AchievementMetric:
            assert metric in snap.metrics, f"Metric {metric} missing from snapshot"


@pytest.mark.unit
class TestDeterminism:
    """Same input data → equal snapshots (modulo computed_at)."""

    async def test_determinism_same_input_same_output(self, db_session: AsyncSession) -> None:
        user = await _make_user(db_session)
        deck = await _make_deck(db_session, DeckLevel.A1)
        card = await _make_card(db_session, deck.id)
        await _make_card_stats(db_session, user.id, card.id, status=CardStatus.MASTERED)

        snap1 = await GamificationProjection.compute(db_session, user.id)
        snap2 = await GamificationProjection.compute(db_session, user.id)

        # All fields except computed_at must be equal
        assert snap1.user_id == snap2.user_id
        assert snap1.unlocked == snap2.unlocked
        assert snap1.total_xp == snap2.total_xp
        assert snap1.current_level == snap2.current_level
        assert snap1.projection_version == snap2.projection_version
        assert dict(snap1.metrics.items()) == dict(snap2.metrics.items())


@pytest.mark.unit
class TestNoDbWrites:
    """GamificationProjection.compute() must not make any DB-mutating calls."""

    async def test_no_db_writes(self) -> None:
        """Verify that compute() never calls add, flush, commit, or delete."""
        user_id = uuid4()

        # Build a mock db session where all repo calls return valid empty data
        mock_db = AsyncMock(spec=AsyncSession)

        # Mock execute to return appropriate empty results for each query
        # We need to patch the repository methods directly since the mock db
        # won't have real query execution.
        with (
            patch(
                "src.services.gamification.projection.compute_aggregated_streak",
                new=AsyncMock(return_value=0),
            ),
            patch(
                "src.services.gamification.projection.CardRecordStatisticsRepository.count_by_status",
                new=AsyncMock(
                    return_value={"new": 0, "learning": 0, "review": 0, "mastered": 0, "due": 0}
                ),
            ),
            patch(
                "src.services.gamification.projection.CardRecordReviewRepository.get_total_reviews",
                new=AsyncMock(return_value=0),
            ),
            patch(
                "src.services.gamification.projection.CardRecordReviewRepository.get_session_aggregates",
                new=AsyncMock(return_value=[]),
            ),
            patch(
                "src.services.gamification.projection.CardRecordReviewRepository.get_weekly_accuracy",
                new=AsyncMock(return_value=(0, 0)),
            ),
            patch(
                "src.services.gamification.projection.CardRecordReviewRepository.get_consecutive_correct_streak",
                new=AsyncMock(return_value=0),
            ),
            patch(
                "src.services.gamification.projection.CardRecordStatisticsRepository.get_cefr_completion",
                new=AsyncMock(
                    return_value={
                        DeckLevel.A1: (0, 0),
                        DeckLevel.A2: (0, 0),
                        DeckLevel.B1: (0, 0),
                        DeckLevel.B2: (0, 0),
                    }
                ),
            ),
            patch(
                "src.services.gamification.projection.CardRecordReviewRepository.get_max_inactive_gap_days",
                new=AsyncMock(return_value=0),
            ),
            patch(
                "src.services.gamification.projection.CardRecordReviewRepository.get_daily_review_counts",
                new=AsyncMock(return_value=[]),
            ),
            patch(
                "src.services.gamification.projection.CultureAnswerHistoryRepository.get_total_answers",
                new=AsyncMock(return_value=0),
            ),
            patch(
                "src.services.gamification.projection.CultureAnswerHistoryRepository.get_correct_answers_count",
                new=AsyncMock(return_value=0),
            ),
            patch(
                "src.services.gamification.projection.CultureAnswerHistoryRepository.get_consecutive_correct_streak",
                new=AsyncMock(return_value=0),
            ),
            patch(
                "src.services.gamification.projection.CultureQuestionStatsRepository.get_category_mastery_counts",
                new=AsyncMock(return_value={}),
            ),
            patch(
                "src.services.gamification.projection.CultureAnswerHistoryRepository.count_by_language",
                new=AsyncMock(return_value=0),
            ),
            patch(
                "src.services.gamification.projection.CultureAnswerHistoryRepository.count_distinct_languages",
                new=AsyncMock(return_value=0),
            ),
            patch(
                "src.services.gamification.projection.CultureAnswerHistoryRepository.get_daily_answer_counts",
                new=AsyncMock(return_value=[]),
            ),
        ):
            # Mock the UserSettings query
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = None
            mock_db.execute = AsyncMock(return_value=mock_result)

            await GamificationProjection.compute(mock_db, user_id)

        # Assert no mutating calls were made on the session
        mock_db.add.assert_not_called()
        mock_db.flush.assert_not_called()
        mock_db.commit.assert_not_called()
        mock_db.delete.assert_not_called()


@pytest.mark.unit
class TestInactiveReturn:
    """INACTIVE_RETURN excludes the trailing gap from last review to today."""

    async def test_inactive_return_excludes_trailing_gap(self, db_session: AsyncSession) -> None:
        """User reviewed 30 days ago but never returned — trailing gap excluded, so value = 0."""
        user = await _make_user(db_session)
        deck = await _make_deck(db_session, DeckLevel.A1)
        card = await _make_card(db_session, deck.id)
        await _make_card_stats(db_session, user.id, card.id, status=CardStatus.REVIEW)

        # Single review 30 days ago — only one review date, so no internal gap
        ts = datetime.now(timezone.utc) - timedelta(days=30)
        await _make_review(db_session, user.id, card.id, reviewed_at=ts)

        snap = await GamificationProjection.compute(db_session, user.id)

        # With only one review date there's no *internal* gap, so INACTIVE_RETURN = 0
        assert snap.metrics[AchievementMetric.INACTIVE_RETURN] == 0
