"""Integration tests for culture answer path → GamificationReconciler.reconcile(IMMEDIATE).

These tests run against the real test PostgreSQL database (test_learn_greek) to verify
that the GamificationReconciler produces correct DB state for culture achievements.

Design: tests call GamificationReconciler.reconcile() DIRECTLY using the test's
db_session, bypassing persist_culture_answer_task's own engine creation. This eliminates
the cross-session FK-visibility issue that arises when a separate asyncpg connection
cannot see data written (but not committed) by the test's savepoint-based session.

Seeding strategy: instead of seeding N-1 answers and calling the task to add the Nth,
we seed exactly the threshold count of answers directly and then call the reconciler.

Tests:
1. test_10th_culture_answer_creates_achievement_and_notification
   - User with 10 CultureAnswerHistory rows → reconcile(IMMEDIATE) →
     UserAchievement(culture_curious) row + ACHIEVEMENT_UNLOCKED notification
2. test_idempotent_on_second_invocation
   - Reconcile twice → no duplicate achievement or notification.
3. test_two_thresholds_crossed_emits_two_notifications
   - User with 50 total answers + 10 consecutive correct → reconcile(IMMEDIATE) →
     2 new achievements (culture_explorer + perfect_culture_score) + 2 notifications.
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    CultureAnswerHistory,
    CultureDeck,
    CultureQuestion,
    Notification,
    NotificationType,
    UserAchievement,
)
from src.services.gamification.reconciler import GamificationReconciler
from src.services.gamification.types import ReconcileMode
from tests.factories.auth import UserFactory

# ---------------------------------------------------------------------------
# Achievement IDs under test
# ---------------------------------------------------------------------------

_CULTURE_CURIOUS_ID = "culture_curious"  # threshold=10 CULTURE_QUESTIONS_ANSWERED
_CULTURE_EXPLORER_ID = "culture_explorer"  # threshold=50 CULTURE_QUESTIONS_ANSWERED
_PERFECT_CULTURE_ID = "perfect_culture_score"  # threshold=10 CULTURE_CONSECUTIVE_CORRECT


# ---------------------------------------------------------------------------
# Seeding helpers
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Test 1: 10 culture answers creates culture_curious achievement
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.timeout(60)
class TestCultureAnswerCreatesAchievement:
    async def test_10th_culture_answer_creates_achievement_and_notification(
        self,
        db_session: AsyncSession,
    ) -> None:
        """10 correct culture answers crossed the culture_curious threshold.

        The full achievement catalog is seeded by the autouse fixture in conftest.py.
        We seed 10 answer rows directly (no task call) then run the reconciler.
        """
        user = await UserFactory.create()
        _, question = await _seed_culture_question(db_session)

        # Seed exactly 10 answers — meets the culture_curious threshold (threshold=10)
        await _seed_answer_history(db_session, user.id, question.id, count=10)

        result = await GamificationReconciler.reconcile(
            db_session, user.id, ReconcileMode.IMMEDIATE
        )

        assert (
            _CULTURE_CURIOUS_ID in result.new_unlocks
        ), f"Expected culture_curious in new_unlocks, got {result.new_unlocks}"

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
@pytest.mark.timeout(60)
class TestCultureAnswerIdempotency:
    async def test_idempotent_on_second_invocation(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Running reconcile twice must not create duplicate rows.

        The reconciler uses pg_insert with on_conflict_do_nothing + RETURNING for
        UserAchievement, so the second call returns new_ids=[] and emits no extra
        notification.
        """
        user = await UserFactory.create()
        _, question = await _seed_culture_question(db_session)
        await _seed_answer_history(db_session, user.id, question.id, count=10)

        # First reconcile — crosses threshold
        result1 = await GamificationReconciler.reconcile(
            db_session, user.id, ReconcileMode.IMMEDIATE
        )
        assert _CULTURE_CURIOUS_ID in result1.new_unlocks

        # Capture notification count after first reconcile (may be > 1 because multiple
        # achievements can unlock simultaneously — e.g. culture_curious + perfect_culture_score).
        notif_count_after_first = await db_session.scalar(
            select(func.count()).where(
                Notification.user_id == user.id,
                Notification.type == NotificationType.ACHIEVEMENT_UNLOCKED,
            )
        )
        assert (
            notif_count_after_first >= 1
        ), f"Expected at least 1 ACHIEVEMENT_UNLOCKED notification after first reconcile, got {notif_count_after_first}"

        # Second reconcile — idempotent
        result2 = await GamificationReconciler.reconcile(
            db_session, user.id, ReconcileMode.IMMEDIATE
        )
        assert (
            _CULTURE_CURIOUS_ID not in result2.new_unlocks
        ), f"Second reconcile should not re-unlock {_CULTURE_CURIOUS_ID}, got {result2.new_unlocks}"

        ua_count = await db_session.scalar(
            select(func.count()).where(
                UserAchievement.user_id == user.id,
                UserAchievement.achievement_id == _CULTURE_CURIOUS_ID,
            )
        )
        assert ua_count == 1, f"Idempotency failure: expected 1 UserAchievement, got {ua_count}"

        # Second reconcile sees new_unlocks=[] → no new notifications.
        # We compare counts before/after rather than asserting an absolute value,
        # because multiple achievements may unlock in the first call.
        notif_count_after_second = await db_session.scalar(
            select(func.count()).where(
                Notification.user_id == user.id,
                Notification.type == NotificationType.ACHIEVEMENT_UNLOCKED,
            )
        )
        assert notif_count_after_first == notif_count_after_second, (
            f"Idempotency failure: second reconcile emitted "
            f"{notif_count_after_second - notif_count_after_first} new ACHIEVEMENT_UNLOCKED "
            f"notification(s) (before={notif_count_after_first}, after={notif_count_after_second})"
        )


# ---------------------------------------------------------------------------
# Test 3: Single reconcile crossing two thresholds → two IMMEDIATE notifications
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.timeout(60)
class TestCultureAnswerTwoThresholds:
    async def test_single_reconcile_crossing_two_thresholds_emits_two_notifications(
        self,
        db_session: AsyncSession,
    ) -> None:
        """One reconcile call crossing two achievement thresholds must emit two notifications.

        Setup:
        - 50 total correct answers → crosses culture_explorer (threshold=50) and
          culture_curious (threshold=10, already pre-unlocked so does NOT count as new)
        - 10 consecutive correct answers → crosses perfect_culture_score (threshold=10)
        Both culture_explorer and perfect_culture_score are the TARGET newly unlocked achievements.

        50 correct answers also satisfy bystander achievements:
        - culture_curious (threshold=10, pre-inserted — counts as already unlocked)
        - culture_sharp_mind (90% accuracy; 50/50=100% ≥ 90%, and total ≥ 20)
        - special_overachiever (DAILY_GOAL_EXCEEDED: 50 answers / daily_goal=20 * 100 = 250 ≥ 200)
        All three bystanders are pre-inserted so their pg_insert RETURNING returns nothing
        → exactly 2 new ACHIEVEMENT_UNLOCKED notifications (explorer + perfect).
        """
        user = await UserFactory.create()
        _, question = await _seed_culture_question(db_session)

        # Seed 50 correct answers — meets culture_explorer (50) and perfect_culture_score (10 consec)
        await _seed_answer_history(db_session, user.id, question.id, count=50, is_correct=True)

        # Pre-unlock all bystander achievements that 50 correct answers also satisfy.
        # This isolates the two TARGET achievements (culture_explorer + perfect_culture_score)
        # so the reconciler's RETURNING INSERT returns nothing for the bystanders.
        for bystander_id in [
            _CULTURE_CURIOUS_ID,  # threshold=10 CULTURE_QUESTIONS_ANSWERED
            "culture_sharp_mind",  # threshold=90 CULTURE_ACCURACY (100% with 50 answers)
            "special_overachiever",  # threshold=200 DAILY_GOAL_EXCEEDED (250 with 50 answers)
        ]:
            db_session.add(UserAchievement(user_id=user.id, achievement_id=bystander_id))
        await db_session.flush()

        result = await GamificationReconciler.reconcile(
            db_session, user.id, ReconcileMode.IMMEDIATE
        )

        # Both culture_explorer + perfect_culture_score must be in new_unlocks
        assert (
            _CULTURE_EXPLORER_ID in result.new_unlocks
        ), f"Expected culture_explorer in new_unlocks, got {result.new_unlocks}"
        assert (
            _PERFECT_CULTURE_ID in result.new_unlocks
        ), f"Expected perfect_culture_score in new_unlocks, got {result.new_unlocks}"
        assert _CULTURE_CURIOUS_ID not in result.new_unlocks, (
            f"culture_curious was pre-unlocked and should not appear in new_unlocks, "
            f"got {result.new_unlocks}"
        )

        # Both culture_explorer + perfect_culture_score must be stored
        ua_count = await db_session.scalar(
            select(func.count()).where(
                UserAchievement.user_id == user.id,
                UserAchievement.achievement_id.in_([_CULTURE_EXPLORER_ID, _PERFECT_CULTURE_ID]),
            )
        )
        assert (
            ua_count == 2
        ), f"Expected exactly 2 UserAchievements (explorer + perfect), got {ua_count}"

        # Exactly two ACHIEVEMENT_UNLOCKED notifications
        notif_count = await db_session.scalar(
            select(func.count()).where(
                Notification.user_id == user.id,
                Notification.type == NotificationType.ACHIEVEMENT_UNLOCKED,
            )
        )
        assert (
            notif_count == 2
        ), f"Expected exactly 2 ACHIEVEMENT_UNLOCKED notifications for two thresholds, got {notif_count}"
