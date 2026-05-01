"""Scheduled gamification reconcile job.

Runs daily at 03:00 UTC. Finds users with at least one review in the last
30 days (active users) and calls GamificationReconciler.reconcile with
ReconcileMode.SUMMARY so each backlogged user receives exactly one
ACHIEVEMENTS_SUMMARY notification rather than a storm of per-achievement
notifications when per-event loops are removed by the action cutover.

Architecture:
    - Dedicated engine per run (matches trial_expiration_task pattern).
    - One fetch session to collect active user IDs.
    - One AsyncSession per batch of 100 users; per-user commit inside the batch.
    - Per-user errors isolated: rollback + Sentry capture + continue loop.
    - Kill-switch: settings.gamification_reconcile_on_read = False skips the run.

Idempotency:
    The reconciler writes convergently (on_conflict_do_nothing for
    UserAchievement rows; absolute set of UserXP.total_xp). A second run on
    the same day produces new_ids=[] → no ACHIEVEMENTS_SUMMARY notification
    row is emitted, so no duplicates appear.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

import sentry_sdk
from sqlalchemy import distinct, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config import settings
from src.core.logging import get_logger
from src.db.models import CardRecordReview, ExerciseReview
from src.services.gamification.reconciler import GamificationReconciler
from src.services.gamification.types import ReconcileMode

logger = get_logger(__name__)

ACTIVE_WINDOW_DAYS = 30
BATCH_SIZE = 100


async def _fetch_active_user_ids(session: AsyncSession) -> list[UUID]:
    """Return distinct user IDs with at least one review in the last 30 days.

    Two single-table queries merged in Python (vs. UNION) keeps each query
    on the indexed (user_id, reviewed_at) path for the query planner.

    Args:
        session: Open async database session.

    Returns:
        Sorted list of UUIDs (deterministic order for logging / batch boundaries).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=ACTIVE_WINDOW_DAYS)

    crr_q = select(distinct(CardRecordReview.user_id)).where(CardRecordReview.reviewed_at >= cutoff)
    ex_q = select(distinct(ExerciseReview.user_id)).where(ExerciseReview.reviewed_at >= cutoff)

    crr_ids = set((await session.execute(crr_q)).scalars().all())
    ex_ids = set((await session.execute(ex_q)).scalars().all())

    return sorted(crr_ids | ex_ids)


async def reconcile_active_users_task() -> None:
    """Reconcile gamification state for all active users (SUMMARY mode).

    Called daily at 03:00 UTC by APScheduler. Ships backlogged achievement
    unlocks as a single ACHIEVEMENTS_SUMMARY notification per user. Idempotent:
    second run in the same day produces no new notifications.

    Kill-switch: if settings.gamification_reconcile_on_read is False, the task
    logs and returns immediately. APScheduler still fires the cron — the task
    body just no-ops.
    """
    if not settings.gamification_reconcile_on_read:
        logger.info("scheduled_gamification: kill-switch off, skipping run")
        return

    started_at = datetime.now(timezone.utc)
    engine = None
    total_users = 0
    succeeded = 0
    failed = 0
    total_new_unlocks = 0

    try:
        engine = create_async_engine(
            settings.database_url,
            pool_pre_ping=True,
            connect_args={"ssl": "require"} if settings.is_production else {},
        )
        sm = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        # Phase 1: collect active user IDs in a dedicated session
        async with sm() as session:
            user_ids = await _fetch_active_user_ids(session)

        total_users = len(user_ids)

        # Phase 2: process in batches of BATCH_SIZE
        for batch_start in range(0, total_users, BATCH_SIZE):
            batch = user_ids[batch_start : batch_start + BATCH_SIZE]

            async with sm() as session:
                for user_id in batch:
                    try:
                        result = await GamificationReconciler.reconcile(
                            session, user_id, ReconcileMode.SUMMARY
                        )
                        await session.commit()
                        succeeded += 1
                        total_new_unlocks += len(result.new_unlocks)
                    except Exception as exc:
                        failed += 1
                        await session.rollback()
                        logger.exception(
                            "scheduled_gamification: user reconcile failed",
                            extra={"user_id": str(user_id)},
                        )
                        sentry_sdk.capture_exception(exc)

    except Exception as exc:
        logger.exception("scheduled_gamification: fatal failure")
        sentry_sdk.capture_exception(exc)
        raise

    finally:
        if engine is not None:
            await engine.dispose()

        duration_ms = (datetime.now(timezone.utc) - started_at).total_seconds() * 1000
        logger.info(
            "scheduled_gamification: complete",
            extra={
                "total_users": total_users,
                "succeeded": succeeded,
                "failed": failed,
                "total_new_unlocks": total_new_unlocks,
                "duration_ms": duration_ms,
            },
        )
