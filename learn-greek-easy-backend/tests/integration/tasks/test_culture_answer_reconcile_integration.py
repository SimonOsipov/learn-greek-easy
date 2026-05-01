"""Integration tests for persist_culture_answer_task → GamificationReconciler.reconcile(IMMEDIATE).

These tests run against the real test PostgreSQL database (test_learn_greek) to verify
that persist_culture_answer_task now invokes GamificationReconciler and produces correct
DB state for culture achievements.

Pattern matches test_async_review_reconcile_integration.py:
- Seed test data via db_session, then commit so the task's own engine can read it.
- Call persist_culture_answer_task() directly with test DB URL.
- Refresh / query via db_session to assert DB state.

Tests:
1. test_10th_culture_answer_creates_achievement_and_notification
   - User with 9 prior CultureAnswerHistory rows → 10th answer via task →
     UserAchievement(culture_curious) row + ACHIEVEMENT_UNLOCKED notification created.
2. test_idempotent_on_second_invocation
   - Run persist_culture_answer_task twice → no duplicate achievement or notification.
3. test_two_thresholds_crossed_emits_two_notifications
   - User already has culture_curious (10 answered); crossing culture_explorer (50) AND
     perfect_culture_score (10 consecutive correct) at once → 2 ACHIEVEMENT_UNLOCKED
     notifications (culture_explorer not unlocked yet, 10-consec not yet met — we test
     a scenario where exactly 10 total answers crosses only culture_curious).
     For two-threshold case: seed 49 total + 9 consecutive, task adds 1 correct →
     total=50 (crosses culture_explorer) + consec=10 (crosses perfect_culture_score).
"""

from __future__ import annotations

from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    Achievement,
    AchievementCategory,
    CardStatus,
    CultureAnswerHistory,
    CultureDeck,
    CultureQuestion,
    CultureQuestionStats,
    Notification,
    NotificationType,
    UserAchievement,
)
from tests.factories.auth import UserFactory
from tests.helpers.database import get_test_database_url

# ---------------------------------------------------------------------------
# Achievement IDs under test
# ---------------------------------------------------------------------------

_CULTURE_CURIOUS_ID = "culture_curious"  # threshold=10 CULTURE_QUESTIONS_ANSWERED
_CULTURE_EXPLORER_ID = "culture_explorer"  # threshold=50 CULTURE_QUESTIONS_ANSWERED
_PERFECT_CULTURE_ID = "perfect_culture_score"  # threshold=10 CULTURE_CONSECUTIVE_CORRECT


# ---------------------------------------------------------------------------
# Seeding helpers
# ---------------------------------------------------------------------------


async def _seed_achievement_catalog(db_session: AsyncSession, achievement_id: str) -> Achievement:
    """Seed one Achievement catalog row if not already present."""
    existing = await db_session.get(Achievement, achievement_id)
    if existing:
        return existing

    # Map id → definition
    defs = {
        _CULTURE_CURIOUS_ID: dict(
            name="Culture Curious",
            description="Answer 10 culture questions",
            category=AchievementCategory.CULTURE,
            icon="compass",
            threshold=10,
            xp_reward=25,
            sort_order=100,
        ),
        _CULTURE_EXPLORER_ID: dict(
            name="Culture Explorer",
            description="Answer 50 culture questions",
            category=AchievementCategory.CULTURE,
            icon="map",
            threshold=50,
            xp_reward=75,
            sort_order=101,
        ),
        _PERFECT_CULTURE_ID: dict(
            name="Perfect Culture Score",
            description="10 consecutive correct culture answers",
            category=AchievementCategory.CULTURE,
            icon="bullseye",
            threshold=10,
            xp_reward=50,
            sort_order=110,
        ),
    }
    achievement = Achievement(id=achievement_id, **defs[achievement_id])
    db_session.add(achievement)
    await db_session.flush()
    return achievement


async def _seed_culture_question(db_session: AsyncSession) -> tuple[CultureDeck, CultureQuestion]:
    """Create a minimal CultureDeck + CultureQuestion for seeding answer history."""
    deck = CultureDeck(
        name_el=f"Ιστορία {uuid4().hex[:6]}",
        name_en=f"History {uuid4().hex[:6]}",
        name_ru=f"История {uuid4().hex[:6]}",
        category="history",
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)

    question = CultureQuestion(
        deck_id=deck.id,
        question_text={"el": "Ερώτηση;", "en": "Question?", "ru": "Вопрос?"},
        option_a={"el": "Α", "en": "A", "ru": "А"},
        option_b={"el": "Β", "en": "B", "ru": "Б"},
        correct_option=1,
        order_index=0,
    )
    db_session.add(question)
    await db_session.flush()
    await db_session.refresh(question)
    return deck, question


async def _seed_answer_history(
    db_session: AsyncSession,
    user_id,
    question_id,
    count: int,
    is_correct: bool = True,
    deck_category: str = "history",
) -> None:
    """Seed `count` CultureAnswerHistory rows for the user."""
    for _ in range(count):
        history = CultureAnswerHistory(
            user_id=user_id,
            question_id=question_id,
            language="en",
            is_correct=is_correct,
            selected_option=1,
            time_taken_seconds=10,
            deck_category=deck_category,
        )
        db_session.add(history)
    await db_session.flush()


async def _seed_question_stats(
    db_session: AsyncSession,
    user_id,
    question_id,
) -> CultureQuestionStats:
    """Create a CultureQuestionStats row (required by persist_culture_answer_task step 1)."""
    stats = CultureQuestionStats(
        user_id=user_id,
        question_id=question_id,
        easiness_factor=2.5,
        interval=1,
        repetitions=1,
        next_review_date=date.today(),
        status=CardStatus.LEARNING,
    )
    db_session.add(stats)
    await db_session.flush()
    return stats


def _make_task_kwargs(user_id, question_id, test_db_url: str, **overrides) -> dict:
    """Return a complete kwarg dict for persist_culture_answer_task."""
    base = dict(
        user_id=user_id,
        question_id=question_id,
        selected_option=1,
        time_taken=8,
        language="en",
        is_correct=True,
        is_perfect=False,
        deck_category="history",
        sm2_new_ef=2.5,
        sm2_new_interval=2,
        sm2_new_repetitions=2,
        sm2_new_status="learning",
        sm2_next_review_date=date.today().isoformat(),
        stats_previous_status="learning",
        db_url=test_db_url,
    )
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# Test 1: 10th correct culture answer creates culture_curious achievement
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
class TestCultureAnswerCreatesAchievement:
    async def test_10th_culture_answer_creates_achievement_and_notification(
        self,
        db_session: AsyncSession,
    ) -> None:
        """10th correct culture answer must:
        - Create UserAchievement(culture_curious) row
        - Create a Notification of type ACHIEVEMENT_UNLOCKED
        """
        await _seed_achievement_catalog(db_session, _CULTURE_CURIOUS_ID)
        user = await UserFactory.create()
        _, question = await _seed_culture_question(db_session)

        # Seed 9 prior answers — crossing 10 total on this task call
        await _seed_answer_history(db_session, user.id, question.id, count=9)
        await _seed_question_stats(db_session, user.id, question.id)
        await db_session.commit()

        test_db_url = get_test_database_url()

        from src.config import settings as real_settings

        with (
            __import__("unittest.mock", fromlist=["patch"]).patch.object(
                real_settings, "feature_background_tasks", True
            ),
            __import__("unittest.mock", fromlist=["patch"]).patch.object(
                real_settings, "app_env", "development"
            ),
        ):
            from src.tasks.background import persist_culture_answer_task

            await persist_culture_answer_task(
                **_make_task_kwargs(user.id, question.id, test_db_url)
            )

        # Expire local cache so we read fresh DB state
        await db_session.rollback()

        ua_count = await db_session.scalar(
            select(func.count()).where(
                UserAchievement.user_id == user.id,
                UserAchievement.achievement_id == _CULTURE_CURIOUS_ID,
            )
        )
        assert ua_count == 1, f"Expected 1 UserAchievement(culture_curious), got {ua_count}"

        notif_count = await db_session.scalar(
            select(func.count()).where(
                Notification.user_id == user.id,
                Notification.type == NotificationType.ACHIEVEMENT_UNLOCKED,
            )
        )
        assert (
            notif_count >= 1
        ), f"Expected at least 1 ACHIEVEMENT_UNLOCKED notification, got {notif_count}"


# ---------------------------------------------------------------------------
# Test 2: Idempotency — second invocation produces no duplicates
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
class TestCultureAnswerIdempotency:
    async def test_idempotent_on_second_invocation(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Running persist_culture_answer_task twice must not create duplicate rows.

        The reconciler uses pg_insert with on_conflict_do_nothing for UserAchievement,
        so the second call should be a no-op at the achievement level.
        """
        await _seed_achievement_catalog(db_session, _CULTURE_CURIOUS_ID)
        user = await UserFactory.create()
        _, question = await _seed_culture_question(db_session)

        await _seed_answer_history(db_session, user.id, question.id, count=9)
        await _seed_question_stats(db_session, user.id, question.id)
        await db_session.commit()

        test_db_url = get_test_database_url()

        from unittest.mock import patch

        from src.config import settings as real_settings

        with (
            patch.object(real_settings, "feature_background_tasks", True),
            patch.object(real_settings, "app_env", "development"),
        ):
            from src.tasks.background import persist_culture_answer_task

            kwargs = _make_task_kwargs(user.id, question.id, test_db_url)

            # First invocation — crosses threshold
            await persist_culture_answer_task(**kwargs)
            # Second invocation — idempotent
            await persist_culture_answer_task(**kwargs)

        await db_session.rollback()

        ua_count = await db_session.scalar(
            select(func.count()).where(
                UserAchievement.user_id == user.id,
                UserAchievement.achievement_id == _CULTURE_CURIOUS_ID,
            )
        )
        assert ua_count == 1, f"Idempotency failure: expected 1 UserAchievement, got {ua_count}"

        # Second reconcile sees new_unlocks=[] → no second notification
        notif_count = await db_session.scalar(
            select(func.count()).where(
                Notification.user_id == user.id,
                Notification.type == NotificationType.ACHIEVEMENT_UNLOCKED,
            )
        )
        assert (
            notif_count == 1
        ), f"Idempotency failure: expected 1 ACHIEVEMENT_UNLOCKED notification, got {notif_count}"


# ---------------------------------------------------------------------------
# Test 3: Single answer crossing two thresholds → two IMMEDIATE notifications
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
class TestCultureAnswerTwoThresholds:
    async def test_single_answer_crossing_two_thresholds_emits_two_notifications(
        self,
        db_session: AsyncSession,
    ) -> None:
        """One task call crossing two achievement thresholds must emit two notifications.

        Setup:
        - 49 prior answers, all correct (total=49, consec=49)
        - culture_explorer threshold=50 (CULTURE_QUESTIONS_ANSWERED)
        - perfect_culture_score threshold=10 (CULTURE_CONSECUTIVE_CORRECT)
        Both thresholds will be met by a single correct 50th answer (consec >= 10, total = 50).
        """
        await _seed_achievement_catalog(db_session, _CULTURE_EXPLORER_ID)
        await _seed_achievement_catalog(db_session, _PERFECT_CULTURE_ID)
        # Also seed culture_curious so it doesn't interfere (already past 10)
        await _seed_achievement_catalog(db_session, _CULTURE_CURIOUS_ID)

        user = await UserFactory.create()
        _, question = await _seed_culture_question(db_session)

        # Seed 49 correct answers — next one will push to 50 total + 10 consecutive
        await _seed_answer_history(db_session, user.id, question.id, count=49, is_correct=True)
        await _seed_question_stats(db_session, user.id, question.id)
        await db_session.commit()

        test_db_url = get_test_database_url()

        from unittest.mock import patch

        from src.config import settings as real_settings

        with (
            patch.object(real_settings, "feature_background_tasks", True),
            patch.object(real_settings, "app_env", "development"),
        ):
            from src.tasks.background import persist_culture_answer_task

            await persist_culture_answer_task(
                **_make_task_kwargs(user.id, question.id, test_db_url)
            )

        await db_session.rollback()

        # Both culture_explorer + perfect_culture_score must be unlocked
        ua_count = await db_session.scalar(
            select(func.count()).where(
                UserAchievement.user_id == user.id,
                UserAchievement.achievement_id.in_([_CULTURE_EXPLORER_ID, _PERFECT_CULTURE_ID]),
            )
        )
        assert ua_count >= 2, f"Expected 2 UserAchievements (explorer + perfect), got {ua_count}"

        # Two ACHIEVEMENT_UNLOCKED notifications (one per new achievement)
        notif_count = await db_session.scalar(
            select(func.count()).where(
                Notification.user_id == user.id,
                Notification.type == NotificationType.ACHIEVEMENT_UNLOCKED,
            )
        )
        # culture_curious also crossed at count=10 from the 49 seeds (was already above threshold),
        # so count >= 2 for the two target achievements.
        assert (
            notif_count >= 2
        ), f"Expected >= 2 ACHIEVEMENT_UNLOCKED notifications for two thresholds, got {notif_count}"
