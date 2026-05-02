"""Integration tests for async review path → GamificationReconciler.reconcile(IMMEDIATE).

These tests run against the real test PostgreSQL database (test_learn_greek) to verify
that the GamificationReconciler produces correct DB state when called from the async
review path (i.e. what check_achievements_task delegates to).

Design: tests call GamificationReconciler.reconcile() DIRECTLY using the test's
db_session, bypassing check_achievements_task's own engine creation. This eliminates
the cross-session FK-visibility issue that arises when a separate asyncpg connection
cannot see data written (but not committed) by the test's savepoint-based session.

Tests:
1. test_async_review_path_creates_achievement_and_notification
   - User with LEARNING card → reconcile(IMMEDIATE) → UserAchievement row +
     ACHIEVEMENT_UNLOCKED notification
2. test_idempotent_on_second_invocation
   - Reconcile twice → still 1 UserAchievement, 1 notification (no duplicates)
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import uuid4

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
    UserAchievement,
    WordEntry,
)
from src.services.gamification.reconciler import GamificationReconciler
from src.services.gamification.types import ReconcileMode
from tests.factories.auth import UserFactory

# ---------------------------------------------------------------------------
# Achievement ID under test
# ---------------------------------------------------------------------------

_ACHIEVEMENT_ID = "learning_first_word"


# ---------------------------------------------------------------------------
# Seeding helpers
# ---------------------------------------------------------------------------


async def _seed_user_with_review(db_session: AsyncSession):
    """Seed a user with a LEARNING card and a recent review.

    This satisfies GamificationProjection: cards_learned=1 via LEARNING status,
    and makes total_reviews >= 1.
    """
    user = await UserFactory.create()

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
        variant_key=f"async_review_test_{uuid4().hex[:8]}",
        front_content={"card_type": "meaning_el_to_en", "prompt": "Translate", "main": "λέξη"},
        back_content={"card_type": "meaning_el_to_en", "answer": "word"},
    )
    db_session.add(card_record)
    await db_session.flush()
    await db_session.refresh(card_record)

    # CardRecordStatistics with LEARNING status → cards_learned=1 in projection
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

    # CardRecordReview — triggers total_reviews count in projection
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


# ---------------------------------------------------------------------------
# Test 1: async review path creates UserAchievement + ACHIEVEMENT_UNLOCKED
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.timeout(60)
class TestAsyncReviewPathCreatesAchievement:
    async def test_async_review_path_creates_achievement_and_notification(
        self,
        db_session: AsyncSession,
    ) -> None:
        """GamificationReconciler.reconcile(IMMEDIATE) must:
        - Create a UserAchievement row for learning_first_word
        - Create a Notification of type ACHIEVEMENT_UNLOCKED

        The full achievement catalog is seeded by the autouse fixture in conftest.py.
        We call the reconciler directly via the test session, eliminating the
        cross-engine FK-visibility issue that plagued the original task-wrapper approach.
        """
        user = await _seed_user_with_review(db_session)

        # Call the reconciler directly with the test's session.
        # The reconciler calls db.flush() internally; no commit needed here
        # because we read back via the same session.
        result = await GamificationReconciler.reconcile(
            db_session, user.id, ReconcileMode.IMMEDIATE
        )

        assert (
            _ACHIEVEMENT_ID in result.new_unlocks
        ), f"Expected {_ACHIEVEMENT_ID} in new_unlocks, got {result.new_unlocks}"

        # Assert UserAchievement row created
        ua_count = await db_session.scalar(
            select(func.count()).where(
                UserAchievement.user_id == user.id,
                UserAchievement.achievement_id == _ACHIEVEMENT_ID,
            )
        )
        assert ua_count == 1, f"Expected 1 UserAchievement for {_ACHIEVEMENT_ID}, got {ua_count}"

        # Assert ACHIEVEMENT_UNLOCKED notification created
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
# Test 2: idempotent — second invocation produces no duplicates
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.timeout(60)
class TestAsyncReviewPathIdempotency:
    async def test_idempotent_on_second_invocation(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Running reconcile twice must not create duplicate rows.

        The reconciler uses pg_insert with on_conflict_do_nothing + RETURNING for
        UserAchievement, so the second call returns new_ids=[] and emits no extra
        notification.
        """
        user = await _seed_user_with_review(db_session)

        # First reconcile
        result1 = await GamificationReconciler.reconcile(
            db_session, user.id, ReconcileMode.IMMEDIATE
        )
        assert _ACHIEVEMENT_ID in result1.new_unlocks

        # Capture notification count after first reconcile (may be > 1 because multiple
        # achievements can unlock simultaneously — e.g. learning_first_word + special_first_review).
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
            result2.new_unlocks == []
        ), f"Second reconcile should return empty new_unlocks, got {result2.new_unlocks}"

        # Still exactly 1 UserAchievement row for the target achievement
        ua_count = await db_session.scalar(
            select(func.count()).where(
                UserAchievement.user_id == user.id,
                UserAchievement.achievement_id == _ACHIEVEMENT_ID,
            )
        )
        assert ua_count == 1, f"Idempotency failure: expected 1 UserAchievement, got {ua_count}"

        # Second reconcile must NOT emit any new notifications (idempotency property).
        # We compare the count before and after the second reconcile rather than asserting
        # an absolute value, because multiple achievements may be unlocked in the first call.
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
