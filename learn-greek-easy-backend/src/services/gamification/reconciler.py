"""GamificationReconciler — idempotent writer for gamification state.

Diffs the projection snapshot against stored state, inserts missing
UserAchievement rows, sets UserXP absolutely, and dispatches notifications
according to the requested ReconcileMode.

This is the ONLY module that writes gamification state.  All four trigger
points (action, read, scheduled, admin) call GamificationReconciler.reconcile().

Zero commits here — the caller owns the transaction.
"""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging import get_logger
from src.db.models import UserAchievement, UserXP
from src.services.achievement_definitions import get_achievement_by_id
from src.services.gamification.projection import GamificationProjection
from src.services.gamification.types import GamificationSnapshot, ReconcileMode
from src.services.notification_service import NotificationService
from src.services.xp_constants import get_level_definition

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Result type
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ReconcileResult:
    """Immutable summary of a single reconcile() call."""

    new_unlocks: list[str]
    total_xp_before: int
    total_xp_after: int
    leveled_up: bool
    snapshot: GamificationSnapshot


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


async def _read_existing_unlocks(db: AsyncSession, user_id: UUID) -> set[str]:
    """Return the set of achievement IDs already stored for this user."""
    result = await db.execute(
        select(UserAchievement.achievement_id).where(UserAchievement.user_id == user_id)
    )
    return set(result.scalars().all())


async def _get_or_create_user_xp(db: AsyncSession, user_id: UUID) -> UserXP:
    """Fetch or create the UserXP row for *user_id*.

    Does NOT reuse XPService.get_or_create_user_xp because that method
    maintains a request-scoped cache that would be polluted by the reconciler
    calling it from background or admin contexts.

    TODO(GAMIF-04): the read-then-insert path has a small race window when two
    concurrent reconciles both find no UserXP and both insert. The
    ``UserXP.user_id UNIQUE`` constraint will surface the second insert as an
    IntegrityError. Once Phase 4 wires reconcile into traffic, switch to
    ``pg_insert(UserXP).on_conflict_do_nothing(index_elements=["user_id"])``
    + re-select for atomic creation.
    """
    result = await db.execute(select(UserXP).where(UserXP.user_id == user_id))
    user_xp = result.scalar_one_or_none()
    if user_xp is None:
        user_xp = UserXP(user_id=user_id, total_xp=0, current_level=1)
        db.add(user_xp)
        await db.flush()
    return user_xp


async def _emit_achievement_notification(
    db: AsyncSession,
    user_id: UUID,
    ach_id: str,
) -> None:
    """Fire an ACHIEVEMENT_UNLOCKED notification for a single achievement."""
    ach_def = get_achievement_by_id(ach_id)
    if ach_def is None:
        logger.warning(
            "reconciler: achievement definition not found, skipping notification",
            achievement_id=ach_id,
        )
        return
    await NotificationService(db).notify_achievement_unlocked(
        user_id,
        ach_id,
        ach_def.name,
        ach_def.icon,
        ach_def.xp_reward,
    )


async def _emit_level_up(db: AsyncSession, user_id: UUID, new_level: int) -> None:
    """Fire a LEVEL_UP notification."""
    level_def = get_level_definition(new_level)
    await NotificationService(db).notify_level_up(
        user_id,
        new_level,
        level_name=level_def.name_english,
    )


async def _emit_achievements_summary(
    db: AsyncSession,
    user_id: UUID,
    new_ids: list[str],
) -> None:
    """Emit a single ACHIEVEMENTS_SUMMARY notification for N unlocks (SUMMARY mode)."""
    await NotificationService(db).notify_achievements_summary(user_id, new_ids)


# ---------------------------------------------------------------------------
# Reconciler
# ---------------------------------------------------------------------------


class GamificationReconciler:
    """Writer that brings stored gamification state in sync with the projection.

    Usage::

        result = await GamificationReconciler.reconcile(db, user_id, mode)

    The caller is responsible for committing the enclosing transaction.

    Known caveats (acceptable in Phase 1, addressed in later phases):

    * Notifications are emitted before the caller commits — if the outer
      transaction rolls back, the user still received the notification.
      Phase 4 will move dispatch behind a ``after_commit`` SQLAlchemy event
      or return the unlock list so the caller can dispatch post-commit.
    * Two concurrent reconciles for the same user can both compute the same
      ``new_ids``; ``pg_insert.on_conflict_do_nothing`` correctly skips
      duplicates at the DB layer, but both calls will emit IMMEDIATE
      notifications for the same achievements. Phase 4 will switch the
      pg_insert to ``RETURNING`` so we notify only for rows actually inserted
      by this call.
    """

    @staticmethod
    async def reconcile(
        db: AsyncSession,
        user_id: UUID,
        mode: ReconcileMode,
    ) -> ReconcileResult:
        """Compute projection, diff against stored state, write convergently.

        Steps:
        1. Compute the read-only projection snapshot.
        2. Read existing UserAchievement set from DB.
        3. Get-or-create the UserXP row; capture old values.
        4. Diff: new_ids = projection.unlocked - existing_unlocks (sorted).
        5. pg_insert each missing achievement with on_conflict_do_nothing.
        6. Set UserXP.total_xp and current_level absolutely (convergent).
        7. db.flush() — never db.commit().
        8. Detect level-up.
        9. Dispatch notifications per mode.
        10. Return ReconcileResult.

        Args:
            db: Async database session.  Caller commits.
            user_id: User UUID.
            mode: Notification dispatch mode.

        Returns:
            ReconcileResult with diff summary and the snapshot used.
        """
        # 1. Compute projection (pure read — zero DB writes)
        snapshot = await GamificationProjection.compute(db, user_id)

        # 2. Read current stored state
        existing_unlocks = await _read_existing_unlocks(db, user_id)
        user_xp = await _get_or_create_user_xp(db, user_id)
        old_xp: int = user_xp.total_xp
        old_level: int = user_xp.current_level

        # 3. Diff: achievements present in projection but absent from DB
        candidate_ids: list[str] = sorted(snapshot.unlocked - existing_unlocks)

        # 4. Write achievements — RETURNING limits notifications to rows actually inserted.
        # Two concurrent reconciles can both compute the same candidate_ids; using RETURNING
        # ensures only the reconcile that won the INSERT emits notifications (the loser gets
        # an empty returned set from on_conflict_do_nothing).
        actually_inserted: list[str] = []
        for ach_id in candidate_ids:
            stmt = (
                pg_insert(UserAchievement)
                .values(
                    user_id=user_id,
                    achievement_id=ach_id,
                    # NOTE: projection_version write deferred to GAMIF-03 schema migration.
                    # After migration, pass projection_version=snapshot.projection_version
                    # into the pg_insert values here.
                )
                .on_conflict_do_nothing(index_elements=["user_id", "achievement_id"])
                .returning(UserAchievement.achievement_id)
            )
            result = await db.execute(stmt)
            returned_id = result.scalar_one_or_none()
            if returned_id is not None:
                actually_inserted.append(returned_id)

        new_ids: list[str] = actually_inserted

        # 5. Write XP absolutely (convergent: running twice yields the same value)
        user_xp.total_xp = snapshot.total_xp
        user_xp.current_level = snapshot.current_level
        # NOTE: projection_version write deferred to GAMIF-03 schema migration.
        # After migration, set user_xp.projection_version = snapshot.projection_version
        # and pass projection_version=snapshot.projection_version into the pg_insert values.

        await db.flush()

        # 6. Detect level-up
        leveled_up: bool = snapshot.current_level > old_level

        # 7. Dispatch notifications by mode — driven by actually-inserted IDs only.
        if mode == ReconcileMode.IMMEDIATE:
            for ach_id in new_ids:
                await _emit_achievement_notification(db, user_id, ach_id)
            if leveled_up:
                await _emit_level_up(db, user_id, snapshot.current_level)

        elif mode == ReconcileMode.SUMMARY:
            if new_ids:
                await _emit_achievements_summary(db, user_id, new_ids)
            if leveled_up:
                await _emit_level_up(db, user_id, snapshot.current_level)

        # QUIET: no notifications emitted

        return ReconcileResult(
            new_unlocks=new_ids,
            total_xp_before=old_xp,
            total_xp_after=snapshot.total_xp,
            leveled_up=leveled_up,
            snapshot=snapshot,
        )


__all__ = ["GamificationReconciler", "ReconcileResult"]
