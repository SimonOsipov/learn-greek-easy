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
from sqlalchemy.orm import noload

from src.core.logging import get_logger
from src.db.models import Achievement, UserAchievement, UserXP
from src.services.achievement_definitions import ACHIEVEMENTS, get_achievement_by_id
from src.services.gamification.projection import GamificationProjection
from src.services.gamification.types import GamificationSnapshot, ReconcileMode
from src.services.notification_service import NotificationService
from src.services.xp_constants import get_level_definition

# Stable sort_order lookup derived from the canonical ACHIEVEMENTS list order.
# Matches the index used by seed_achievements() so reconciler-seeded rows are
# consistent with the admin seed.
_ACHIEVEMENT_SORT_ORDER: dict[str, int] = {ach.id: i for i, ach in enumerate(ACHIEVEMENTS)}

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


async def _ensure_achievements_exist(db: AsyncSession, achievement_ids: list[str]) -> None:
    """Upsert the parent ``achievements`` rows for *achievement_ids* from code defs.

    Achievement definitions are code-only (``achievement_definitions.py``); the
    ``achievements`` table is their persisted projection. A ``user_achievements``
    row carries an FK to ``achievements.id``, so a code-defined achievement that
    has never been seeded would make the user-achievement insert below raise a
    ``ForeignKeyViolationError`` and poison the whole transaction. Ensure each
    parent row exists first — idempotent via ``on_conflict_do_nothing`` — so the
    reconciler stays self-sufficient regardless of seed state.
    """
    for ach_id in achievement_ids:
        ach_def = get_achievement_by_id(ach_id)
        if ach_def is None:
            continue
        stmt = (
            pg_insert(Achievement)
            .values(
                id=ach_def.id,
                name=ach_def.name,
                description=ach_def.description,
                category=ach_def.category,
                icon=ach_def.icon,
                threshold=ach_def.threshold,
                xp_reward=ach_def.xp_reward,
                # sort_order is NOT NULL with no DB-level default; include it so
                # a self-seed in a clean environment does not raise a NOT NULL
                # constraint violation.  Index matches seed_achievements().
                sort_order=_ACHIEVEMENT_SORT_ORDER.get(ach_def.id, 0),
            )
            .on_conflict_do_nothing(index_elements=["id"])
        )
        await db.execute(stmt)


async def _get_or_create_user_xp(db: AsyncSession, user_id: UUID) -> UserXP:
    """Fetch or create the UserXP row for *user_id*.

    Does NOT reuse XPService.get_or_create_user_xp because that method
    maintains a request-scoped cache that would be polluted by the reconciler
    calling it from background or admin contexts.

    ``noload(UserXP.user)`` suppresses the ``lazy="selectin"`` relationship load
    on UserXP.user.  Without it, the selectin fires a secondary SELECT that
    attempts to back-populate ``User.xp`` on the already-loaded User instance;
    since ``User.xp`` has ``lazy="raise"`` and is not pre-loaded by the auth
    dependency (which only eagerly loads User.settings), the back-populate check
    triggers an implicit lazy-load and raises ``InvalidRequestError``.  The
    reconciler never accesses ``user_xp.user``, so suppressing this load is safe.

    TODO(GAMIF-04): the read-then-insert path has a small race window when two
    concurrent reconciles both find no UserXP and both insert. The
    ``UserXP.user_id UNIQUE`` constraint will surface the second insert as an
    IntegrityError. Once Phase 4 wires reconcile into traffic, switch to
    ``pg_insert(UserXP).on_conflict_do_nothing(index_elements=["user_id"])``
    + re-select for atomic creation.
    """
    result = await db.execute(
        select(UserXP).options(noload(UserXP.user)).where(UserXP.user_id == user_id)
    )
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

        # TEMP-GAMIF04-DEBUG: diagnose why reconcile-on-read does not unlock an
        # earned-but-missing achievement in CI E2E. Inlined into the message
        # because the console sink does not render bound extras. Remove once root-caused.
        logger.info(
            f"gamif04.debug.reconcile user={user_id} mode={mode} "
            f"snap_count={len(snapshot.unlocked)} "
            f"fw_in_snap={'learning_first_word' in snapshot.unlocked} "
            f"fw_in_existing={'learning_first_word' in existing_unlocks} "
            f"candidates={candidate_ids}"
        )

        # 3a. Ensure parent achievements rows exist before inserting user_achievements,
        # otherwise a not-yet-seeded code-defined achievement triggers an FK violation
        # that aborts the entire transaction.
        await _ensure_achievements_exist(db, candidate_ids)

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
