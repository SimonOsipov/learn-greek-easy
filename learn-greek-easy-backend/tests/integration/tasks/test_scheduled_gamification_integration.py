"""Integration tests for reconcile_active_users_task logic.

These tests run against the real test PostgreSQL database (test_learn_greek)
to verify end-to-end correctness of the scheduled gamification job.

Design: tests call _fetch_active_user_ids() and GamificationReconciler.reconcile()
DIRECTLY via the test's db_session, bypassing reconcile_active_users_task's own engine
creation. This eliminates the cross-session FK-visibility issue: the task's dedicated
asyncpg connection cannot see data that the test's savepoint-based session has written
but not committed to the real transaction log.

_fetch_active_user_ids() is a private module function; importing it in tests is
intentional (we own this codebase and it is the unit-of-work under test).

Tests:
1. test_three_users_with_backlog_get_one_summary_each
   - 3 users each with 1 CardRecordReview + 1 CardRecordStatistics (LEARNING)
   - No prior reconcile → each gets exactly 1 ACHIEVEMENTS_SUMMARY notification
   - Checks extra_data["count"] >= 1

2. test_running_twice_produces_no_duplicate_notifications
   - Same setup, reconcile twice for each user
   - Still exactly 1 ACHIEVEMENTS_SUMMARY per user after second run

3. test_user_with_no_new_unlocks_gets_no_notification
   - Pre-reconcile the user (QUIET mode, already converged) then reconcile again
     in SUMMARY mode → 0 ACHIEVEMENTS_SUMMARY notifications
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
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
    WordEntry,
)
from src.services.gamification.reconciler import GamificationReconciler
from src.services.gamification.types import ReconcileMode
from src.tasks.scheduled_gamification import _fetch_active_user_ids
from tests.factories.auth import UserFactory

# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------

_ACHIEVEMENT_ID = "learning_first_word"


async def _seed_user_with_review(db_session: AsyncSession):
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


async def _reconcile_active_users(db_session: AsyncSession, mode: ReconcileMode) -> list[UUID]:
    """Fetch active user IDs and reconcile each one using the test's db_session.

    This replaces calling reconcile_active_users_task() directly. The reconciler
    uses the test session so seeded data is immediately visible (same transaction).

    Returns the list of user IDs that were reconciled.
    """
    user_ids = await _fetch_active_user_ids(db_session)
    for user_id in user_ids:
        await GamificationReconciler.reconcile(db_session, user_id, mode)
    return user_ids


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
        - The autouse fixture seeds the full achievement catalog.
        - Create 3 users, each with a LEARNING card + recent CardRecordReview.
        - _fetch_active_user_ids sees all 3 via the same session.
        - Reconcile each user with SUMMARY mode.
        - Assert each user has exactly 1 ACHIEVEMENTS_SUMMARY notification.
        """
        users = []
        for _ in range(3):
            user = await _seed_user_with_review(db_session)
            users.append(user)

        # Reconcile active users (SUMMARY mode matches the scheduled task's mode)
        reconciled_ids = await _reconcile_active_users(db_session, ReconcileMode.SUMMARY)

        # Verify all 3 seeded users appear in active set
        for user in users:
            assert user.id in reconciled_ids, (
                f"User {user.id} not found in active user IDs. " f"Reconciled: {reconciled_ids}"
            )

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
            assert (
                notif.extra_data.get("count", 0) >= 1
            ), f"expected extra_data.count >= 1, got {notif.extra_data}"


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
        """Running reconcile twice → still exactly 1 ACHIEVEMENTS_SUMMARY per user.

        The reconciler is convergent: second run finds new_ids=[] and emits
        no ACHIEVEMENTS_SUMMARY notification.
        """
        users = []
        for _ in range(2):
            user = await _seed_user_with_review(db_session)
            users.append(user)

        # First reconcile pass (SUMMARY mode)
        await _reconcile_active_users(db_session, ReconcileMode.SUMMARY)
        # Second reconcile pass — should be idempotent
        await _reconcile_active_users(db_session, ReconcileMode.SUMMARY)

        for user in users:
            count = await db_session.scalar(
                select(func.count()).where(
                    Notification.user_id == user.id,
                    Notification.type == NotificationType.ACHIEVEMENTS_SUMMARY,
                )
            )
            assert count == 1, (
                f"Idempotency failure: user {user.id} has {count} ACHIEVEMENTS_SUMMARY "
                f"notifications after 2 reconcile runs (expected 1)"
            )


# ---------------------------------------------------------------------------
# Test 3: Pre-reconciled user gets no notification on subsequent reconcile
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
        3. Reconcile again with SUMMARY mode.
        4. Assert zero ACHIEVEMENTS_SUMMARY notifications for this user.
        """
        user = await _seed_user_with_review(db_session)

        # Pre-reconcile using QUIET mode: state converges, no notification emitted
        await GamificationReconciler.reconcile(db_session, user.id, ReconcileMode.QUIET)

        # Reconcile again with SUMMARY mode — new_ids=[] so no ACHIEVEMENTS_SUMMARY
        result = await GamificationReconciler.reconcile(db_session, user.id, ReconcileMode.SUMMARY)
        assert (
            result.new_unlocks == []
        ), f"Expected empty new_unlocks on second pass, got {result.new_unlocks}"

        count = await db_session.scalar(
            select(func.count()).where(
                Notification.user_id == user.id,
                Notification.type == NotificationType.ACHIEVEMENTS_SUMMARY,
            )
        )
        assert (
            count == 0
        ), f"Expected 0 ACHIEVEMENTS_SUMMARY for pre-reconciled user {user.id}, got {count}"
