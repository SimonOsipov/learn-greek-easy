"""Integration test: review-write path → GamificationReconciler(IMMEDIATE) → Notification.

Verifies GAMIF-05-03 acceptance criterion #11:
  A review that crosses an achievement threshold creates a Notification row with
  type=ACHIEVEMENT_UNLOCKED synchronously within the same request lifecycle.

Uses a real db_session (PostgreSQL) and mocks GamificationProjection.compute to
produce a controlled snapshot (same technique as tests/unit/services/gamification/
test_reconciler.py) to avoid seeding the full Deck → WordEntry → CardRecord chain.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Achievement, AchievementCategory, Notification, NotificationType, User
from src.services.achievement_definitions import AchievementMetric
from src.services.gamification.types import GamificationSnapshot, MetricValues
from src.services.gamification.version import GAMIFICATION_PROJECTION_VERSION
from src.services.v2_sm2_service import V2SM2Service

# =============================================================================
# Helpers
# =============================================================================


async def _make_user(db: AsyncSession) -> User:
    """Create a minimal user for the test."""
    user = User(email=f"gamif05_integ_{uuid4().hex[:8]}@example.com", is_active=True)
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def _seed_achievement(db: AsyncSession, ach_id: str) -> Achievement:
    """Insert an Achievement row (required for UserAchievement FK).

    Uses merge strategy to avoid PK conflict when id already exists from another test.
    """
    result = await db.execute(select(Achievement).where(Achievement.id == ach_id))
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    ach = Achievement(
        id=ach_id,
        name="First Steps",
        description="Complete your first review",
        category=AchievementCategory.SPECIAL,
        icon="footprints",
        threshold=1,
        xp_reward=25,
        sort_order=9000,
    )
    db.add(ach)
    await db.flush()
    return ach


def _make_snapshot_first_review(user_id: object) -> GamificationSnapshot:
    """Build a snapshot that includes special_first_review as unlocked.

    The reconciler only reads snapshot.unlocked, snapshot.total_xp, and
    snapshot.current_level — it never accesses snapshot.metrics. So we
    provide only FIRST_REVIEW in MetricValues to keep the fixture minimal.
    """
    metrics = MetricValues({AchievementMetric.FIRST_REVIEW: 1})
    return GamificationSnapshot(
        user_id=user_id,
        metrics=metrics,
        unlocked=frozenset({"special_first_review"}),
        total_xp=25,
        current_level=1,
        projection_version=GAMIFICATION_PROJECTION_VERSION,
        computed_at=datetime.now(timezone.utc),
    )


def _make_side_effects_context(user_id: object, card_record_id: object) -> dict:
    """Build a minimal context dict matching what persist_review produces."""
    return {
        "user_id": str(user_id),
        "card_record_id": str(card_record_id),
        "quality": 4,
        "time_taken": 5,
        "new_status_value": "learning",
        "deck_id": str(uuid4()),
        "card_type_value": "meaning_el_to_en",
        "new_repetitions": 1,
    }


# =============================================================================
# Test
# =============================================================================


@pytest.mark.asyncio
@pytest.mark.integration
class TestReviewPathReconcileImmediate:
    """Integration: _run_persist_review_side_effects calls reconcile(IMMEDIATE),
    which creates an ACHIEVEMENT_UNLOCKED Notification synchronously."""

    async def test_first_review_unlocks_achievement_notification_synchronously(
        self, db_session: AsyncSession
    ) -> None:
        """Verify that reconcile(IMMEDIATE) inside _run_persist_review_side_effects
        creates a Notification with type=ACHIEVEMENT_UNLOCKED before the method returns.

        Scenario:
          - User has no prior reviews (fresh state).
          - Projection returns snapshot with special_first_review unlocked.
          - Notification must exist in DB after _run_persist_review_side_effects returns.
        """
        # Seed prerequisites
        user = await _make_user(db_session)
        await _seed_achievement(db_session, "special_first_review")

        card_record_id = uuid4()
        context = _make_side_effects_context(user.id, card_record_id)
        snapshot = _make_snapshot_first_review(user.id)

        service = V2SM2Service(db_session)

        with (
            patch(
                "src.services.gamification.reconciler.GamificationProjection.compute",
                new=AsyncMock(return_value=snapshot),
            ),
            # Mock daily goal check to avoid Redis dependency in integration tests
            patch.object(service, "_check_daily_goal_sync", new=AsyncMock()),
        ):
            await service._run_persist_review_side_effects(context)

        # Flush to make notifications visible within this transaction
        await db_session.flush()

        # Assert Notification row was created with the correct type
        result = await db_session.execute(
            select(Notification).where(
                Notification.user_id == user.id,
                Notification.type == NotificationType.ACHIEVEMENT_UNLOCKED,
            )
        )
        notifications = result.scalars().all()

        assert len(notifications) >= 1, (
            "Expected at least one ACHIEVEMENT_UNLOCKED notification for user after "
            "first review crossing threshold; found none."
        )
        notification = notifications[0]
        assert notification.type == NotificationType.ACHIEVEMENT_UNLOCKED
        assert notification.user_id == user.id
