"""Integration tests for reconcile_active_users_task.

These tests run against the real test PostgreSQL database (test_learn_greek)
to verify end-to-end correctness of the scheduled gamification job.

Pattern (same as TestTrialExpirationTask in test_trial_lifecycle.py):
- Seed test data via db_session, then commit to make it visible to the task's
  own engine/connection.
- Patch settings.database_url → test DB URL so the task opens a real connection.
- Run reconcile_active_users_task().
- Refresh / query via db_session to assert DB state.

Tests:
1. test_three_users_with_backlog_get_one_summary_each
   - 3 users each with 1 CardRecordReview + 1 CardRecordStatistics (LEARNING)
   - No prior reconcile → each gets exactly 1 ACHIEVEMENTS_SUMMARY notification
   - Checks extra_data["count"] >= 1

2. test_running_twice_produces_no_duplicate_notifications
   - Same setup, run task twice
   - Still exactly 1 ACHIEVEMENTS_SUMMARY per user after second run

3. test_user_with_no_new_unlocks_gets_no_notification
   - Pre-reconcile the user (already converged) then run job → 0 new notifications
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    Achievement,
    AchievementCategory,
    CardRecord,
    CardRecordReview,
    CardRecordStatistics,
    CardStatus,
    CardType,
    Deck,
    DeckLevel,
    DeckWordEntry,
    Notification,
    NotificationType,
    PartOfSpeech,
    User,
    WordEntry,
)
from src.services.gamification.reconciler import GamificationReconciler
from src.services.gamification.types import ReconcileMode
from tests.factories.auth import UserFactory
from tests.helpers.database import get_test_database_url

# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------

_ACHIEVEMENT_ID = "learning_first_word"


async def _seed_achievement_catalog(db_session: AsyncSession) -> Achievement:
    """Seed the required FK parent row in the achievements catalog."""
    existing = await db_session.get(Achievement, _ACHIEVEMENT_ID)
    if existing:
        return existing
    achievement = Achievement(
        id=_ACHIEVEMENT_ID,
        name="First Word",
        description="Learn your first card",
        category=AchievementCategory.LEARNING,
        icon="book",
        threshold=1,
        xp_reward=10,
        sort_order=0,
    )
    db_session.add(achievement)
    await db_session.flush()
    return achievement


async def _seed_user_with_review(db_session: AsyncSession) -> User:
    """Seed a user with the minimal graph to satisfy:
    - _fetch_active_user_ids (CardRecordReview in last 30 days)
    - GamificationProjection (cards_learned=1 via LEARNING CardRecordStatistics)

    Returns the User.
    """
    user = await UserFactory.create()

    # Deck → WordEntry → DeckWordEntry → CardRecord
    deck = Deck(
        name_en=f"Test Deck {uuid4().hex[:6]}",
        name_el="Τεστ",
        name_ru="Тест",
        description_en="Test",
        description_el="Τεστ",
        description_ru="Тест",
        level=DeckLevel.A1,
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)

    word_entry = WordEntry(
        owner_id=None,
        lemma=f"λέξη_{uuid4().hex[:4]}",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="word",
        is_active=True,
    )
    db_session.add(word_entry)
    await db_session.flush()
    await db_session.refresh(word_entry)

    db_session.add(DeckWordEntry(deck_id=deck.id, word_entry_id=word_entry.id))
    await db_session.flush()

    card_record = CardRecord(
        word_entry_id=word_entry.id,
        deck_id=deck.id,
        card_type=CardType.MEANING_EL_TO_EN,
        variant_key=f"sched_test_{uuid4().hex[:8]}",
        front_content={"card_type": "meaning_el_to_en", "prompt": "Translate", "main": "λέξη"},
        back_content={"card_type": "meaning_el_to_en", "answer": "word"},
    )
    db_session.add(card_record)
    await db_session.flush()
    await db_session.refresh(card_record)

    # CardRecordStatistics — status=LEARNING makes cards_learned=1 in projection
    stat = CardRecordStatistics(
        user_id=user.id,
        card_record_id=card_record.id,
        easiness_factor=2.36,
        interval=1,
        repetitions=2,
        next_review_date=date.today(),
        status=CardStatus.LEARNING,
    )
    db_session.add(stat)
    await db_session.flush()

    # CardRecordReview — makes user appear in _fetch_active_user_ids
    review = CardRecordReview(
        user_id=user.id,
        card_record_id=card_record.id,
        quality=4,
        time_taken=3000,
        reviewed_at=datetime.now(timezone.utc),
    )
    db_session.add(review)
    await db_session.flush()

    return user


def _patch_task_settings():
    """Return a context manager that points the task at the test DB.

    Also patches create_async_engine to use pool_size=1, max_overflow=0 so
    connections are released immediately after each session.  Without this,
    the task's dedicated engine can hold an idle asyncpg connection that
    conflicts with the db_session fixture's rollback-based teardown and causes
    the CI runner to hang waiting for that connection to be freed.
    """
    from sqlalchemy.ext.asyncio import create_async_engine as _real_cae

    test_db_url = get_test_database_url()

    def _test_engine(url, **kwargs):
        # Minimal pool so connections are returned and closed immediately.
        kwargs["pool_size"] = 1
        kwargs["max_overflow"] = 0
        return _real_cae(url, **kwargs)

    settings_patch = patch(
        "src.tasks.scheduled_gamification.settings",
        gamification_reconcile_on_read=True,
        database_url=test_db_url,
        is_production=False,
    )
    engine_patch = patch(
        "src.tasks.scheduled_gamification.create_async_engine",
        side_effect=_test_engine,
    )
    from contextlib import ExitStack

    stack = ExitStack()
    stack.enter_context(settings_patch)
    stack.enter_context(engine_patch)
    return stack


# ---------------------------------------------------------------------------
# Test 1: 3 users with backlogged unlocks each get 1 ACHIEVEMENTS_SUMMARY
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.timeout(60)
class TestThreeUsersGetOneSummaryEach:
    async def test_three_users_with_backlog_get_one_summary_each(
        self,
        db_session: AsyncSession,
    ) -> None:
        """3 users with no prior reconcile each receive exactly 1 ACHIEVEMENTS_SUMMARY.

        Setup:
        - Seed achievement catalog (learning_first_word).
        - Create 3 users, each with a LEARNING card + recent CardRecordReview.
        - Commit to make data visible to task's engine.
        - Run reconcile_active_users_task().
        - Assert each user has exactly 1 ACHIEVEMENTS_SUMMARY notification.
        """
        await _seed_achievement_catalog(db_session)

        users = []
        for _ in range(3):
            user = await _seed_user_with_review(db_session)
            users.append(user)

        # Commit so the task's separate connection can read the data
        await db_session.commit()

        with _patch_task_settings():
            from src.tasks.scheduled_gamification import reconcile_active_users_task

            await reconcile_active_users_task()

        # Expire cache and re-query
        await db_session.rollback()

        for user in users:
            count = await db_session.scalar(
                select(func.count()).where(
                    Notification.user_id == user.id,
                    Notification.type == NotificationType.ACHIEVEMENTS_SUMMARY,
                )
            )
            assert (
                count == 1
            ), f"Expected exactly 1 ACHIEVEMENTS_SUMMARY for user {user.id}, got {count}"

            # Also verify extra_data.count >= 1
            notif = await db_session.scalar(
                select(Notification).where(
                    Notification.user_id == user.id,
                    Notification.type == NotificationType.ACHIEVEMENTS_SUMMARY,
                )
            )
            assert notif is not None
            assert isinstance(notif.extra_data, dict)
            assert notif.extra_data.get("count", 0) >= 1


# ---------------------------------------------------------------------------
# Test 2: Running twice produces no duplicate notifications
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.timeout(60)
class TestIdempotency:
    async def test_running_twice_produces_no_duplicate_notifications(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Running the task twice → still exactly 1 ACHIEVEMENTS_SUMMARY per user.

        The reconciler is convergent: second run finds new_ids=[] and emits
        no ACHIEVEMENTS_SUMMARY notification.
        """
        await _seed_achievement_catalog(db_session)

        users = []
        for _ in range(2):
            user = await _seed_user_with_review(db_session)
            users.append(user)

        await db_session.commit()

        from src.tasks.scheduled_gamification import reconcile_active_users_task

        with _patch_task_settings():
            await reconcile_active_users_task()
            await reconcile_active_users_task()

        await db_session.rollback()

        for user in users:
            count = await db_session.scalar(
                select(func.count()).where(
                    Notification.user_id == user.id,
                    Notification.type == NotificationType.ACHIEVEMENTS_SUMMARY,
                )
            )
            assert count == 1, (
                f"Idempotency failure: user {user.id} has {count} ACHIEVEMENTS_SUMMARY "
                f"notifications after 2 runs (expected 1)"
            )


# ---------------------------------------------------------------------------
# Test 3: Pre-reconciled user gets no notification on task run
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.timeout(60)
class TestNoNotificationForConvergedUser:
    async def test_user_with_no_new_unlocks_gets_no_notification(
        self,
        db_session: AsyncSession,
    ) -> None:
        """A user that was already reconciled (converged state) gets 0 new notifications.

        Steps:
        1. Seed user + full graph.
        2. Pre-reconcile via GamificationReconciler.reconcile(QUIET) directly.
        3. Commit.
        4. Run reconcile_active_users_task().
        5. Assert zero ACHIEVEMENTS_SUMMARY notifications for this user.
        """
        await _seed_achievement_catalog(db_session)
        user = await _seed_user_with_review(db_session)

        # Pre-reconcile using QUIET mode so no notification is emitted but state converges
        await GamificationReconciler.reconcile(db_session, user.id, ReconcileMode.QUIET)
        await db_session.commit()

        from src.tasks.scheduled_gamification import reconcile_active_users_task

        with _patch_task_settings():
            await reconcile_active_users_task()

        await db_session.rollback()

        count = await db_session.scalar(
            select(func.count()).where(
                Notification.user_id == user.id,
                Notification.type == NotificationType.ACHIEVEMENTS_SUMMARY,
            )
        )
        assert (
            count == 0
        ), f"Expected 0 ACHIEVEMENTS_SUMMARY for pre-reconciled user {user.id}, got {count}"
