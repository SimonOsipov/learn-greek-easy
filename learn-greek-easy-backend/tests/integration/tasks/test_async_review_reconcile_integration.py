"""Integration tests for async review path → GamificationReconciler.reconcile(IMMEDIATE).

These tests run against the real test PostgreSQL database (test_learn_greek) to verify
that check_achievements_task (called from _run_review_side_effects after persist_deck_review_task)
now invokes GamificationReconciler and produces correct DB state.

Pattern matches test_scheduled_gamification_integration.py:
- Seed test data via db_session, then commit so the task's own engine can read it.
- Patch settings.database_url → test DB URL.
- Run check_achievements_task() directly (same function _run_review_side_effects calls).
- Refresh / query via db_session to assert DB state.

Tests:
1. test_async_review_path_creates_achievement_and_notification
   - User with LEARNING card → check_achievements_task → UserAchievement row + ACHIEVEMENT_UNLOCKED
2. test_idempotent_on_second_invocation
   - Run check_achievements_task twice → still 1 UserAchievement, 1 notification (no duplicates)
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
    UserAchievement,
    WordEntry,
)
from tests.factories.auth import UserFactory
from tests.helpers.database import get_test_database_url

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_ACHIEVEMENT_ID = "learning_first_word"


async def _seed_achievement_catalog(db_session: AsyncSession) -> Achievement:
    """Seed the required Achievement catalog row."""
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


def _patch_task_db_url():
    """Context manager: point the background task at the test DB."""
    test_db_url = get_test_database_url()
    return patch(
        "src.tasks.background.settings",
        feature_background_tasks=True,
        is_production=False,
        database_url=test_db_url,
    )


# ---------------------------------------------------------------------------
# Test 1: async review path creates UserAchievement + ACHIEVEMENT_UNLOCKED
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
class TestAsyncReviewPathCreatesAchievement:
    async def test_async_review_path_creates_achievement_and_notification(
        self,
        db_session: AsyncSession,
    ) -> None:
        """check_achievements_task (called from _run_review_side_effects) must:
        - Create a UserAchievement row for learning_first_word
        - Create a Notification of type ACHIEVEMENT_UNLOCKED

        Setup:
        - Seed achievement catalog + user with LEARNING card + review.
        - Commit to make data visible to task's engine.
        - Call check_achievements_task directly (same path as _run_review_side_effects).
        - Assert DB state via db_session.
        """
        await _seed_achievement_catalog(db_session)
        user = await _seed_user_with_review(db_session)
        await db_session.commit()

        test_db_url = get_test_database_url()

        from src.config import settings as real_settings

        with patch.object(real_settings, "feature_background_tasks", True):
            with patch.object(real_settings, "app_env", "development"):
                from src.tasks.background import check_achievements_task

                await check_achievements_task(
                    user_id=user.id,
                    db_url=test_db_url,
                )

        # Expire cache so we read fresh state
        await db_session.rollback()

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
class TestAsyncReviewPathIdempotency:
    async def test_idempotent_on_second_invocation(
        self,
        db_session: AsyncSession,
    ) -> None:
        """Running check_achievements_task twice must not create duplicate rows.

        The reconciler uses pg_insert with on_conflict_do_nothing for UserAchievement,
        so the second call should be a no-op at the DB level.
        """
        await _seed_achievement_catalog(db_session)
        user = await _seed_user_with_review(db_session)
        await db_session.commit()

        test_db_url = get_test_database_url()

        from src.config import settings as real_settings

        with patch.object(real_settings, "feature_background_tasks", True):
            with patch.object(real_settings, "app_env", "development"):
                from src.tasks.background import check_achievements_task

                # First invocation
                await check_achievements_task(user_id=user.id, db_url=test_db_url)
                # Second invocation
                await check_achievements_task(user_id=user.id, db_url=test_db_url)

        await db_session.rollback()

        # Still exactly 1 UserAchievement row
        ua_count = await db_session.scalar(
            select(func.count()).where(
                UserAchievement.user_id == user.id,
                UserAchievement.achievement_id == _ACHIEVEMENT_ID,
            )
        )
        assert ua_count == 1, f"Idempotency failure: expected 1 UserAchievement, got {ua_count}"

        # Notifications: reconciler emits IMMEDIATE notifications on each call but
        # the idempotency guarantee is at the UserAchievement (row-level). The ACHIEVEMENT_UNLOCKED
        # notification count on the second run depends on whether new_ids is empty.
        # Since new_ids=[] on the second run, no new notification is emitted.
        notif_count = await db_session.scalar(
            select(func.count()).where(
                Notification.user_id == user.id,
                Notification.type == NotificationType.ACHIEVEMENT_UNLOCKED,
            )
        )
        assert (
            notif_count == 1
        ), f"Idempotency failure: expected 1 ACHIEVEMENT_UNLOCKED notification, got {notif_count}"
