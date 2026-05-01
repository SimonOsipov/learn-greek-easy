"""Shadow comparator for gamification observability.

Runs GamificationProjection.compute() in parallel with the legacy XP/achievement
read path and emits structured loguru events showing how the two sources diverge.

Zero writes — this module never calls add(), flush(), commit(), or delete().
Flag-gated: when ``settings.gamification_shadow_mode`` is False the public
coroutines return immediately without any DB access or logging.

Loguru convention — narrow deviation:
    The three shadow events use the dotted event name BOTH as the loguru
    message and as an explicit ``event=`` kwarg so that Sentry indexes the
    event under both the message field and the attribute field.  This pattern
    is limited to this module and must not be copied elsewhere.

    Normal codebase pattern:   logger.info("human message", key=value)
    Shadow pattern:            logger.info("gamification.shadow.diff",
                                           event="gamification.shadow.diff",
                                           ...)

Event schema
------------
gamification.shadow.diff / gamification.shadow.match (INFO):
    event (str), user_id (str), endpoint (str),
    legacy_only (sorted list[str]), projection_only (sorted list[str]),
    xp_delta (int), level_delta (int),
    per_metric_mismatches (list[dict] — always [] in this PR),
    projection_version (int), cache_hit (bool)

gamification.shadow.error (WARNING):
    event (str), endpoint (str), user_id (str),
    error_type (str), error_message (str)

Cache
-----
Module-level dict keyed by user_id (UUID) caching
(GamificationSnapshot, inserted_at_monotonic) pairs.
TTL = 30 s, max_size = 512, eviction = drop expired first then arbitrary.
threading.Lock protects the critical section — never awaited inside the lock.
"""

import threading
import time
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.logging import get_logger
from src.services.gamification.projection import GamificationProjection
from src.services.gamification.types import GamificationSnapshot

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

_CACHE_TTL: float = 30.0
_CACHE_MAX: int = 512

_cache: dict[UUID, tuple[GamificationSnapshot, float]] = {}
_cache_lock = threading.Lock()


def _clear_cache() -> None:
    """Test hook — reset the in-process cache between test cases."""
    with _cache_lock:
        _cache.clear()


def _cache_get(user_id: UUID) -> tuple[GamificationSnapshot, bool]:
    """Return (snapshot, cache_hit).  Evicts expired entry on miss."""
    now = time.monotonic()
    with _cache_lock:
        entry = _cache.get(user_id)
        if entry is not None:
            snapshot, inserted_at = entry
            if now - inserted_at < _CACHE_TTL:
                return snapshot, True
            # Expired — evict
            del _cache[user_id]
    return None, False  # type: ignore[return-value]


def _cache_put(user_id: UUID, snapshot: GamificationSnapshot) -> None:
    """Insert snapshot; enforces max-size by evicting expired, then arbitrary."""
    now = time.monotonic()
    with _cache_lock:
        if len(_cache) >= _CACHE_MAX and user_id not in _cache:
            # Drop all expired entries first
            expired_keys = [k for k, (_, ts) in _cache.items() if now - ts >= _CACHE_TTL]
            for k in expired_keys:
                del _cache[k]
            # Still at cap — drop one arbitrary entry
            if len(_cache) >= _CACHE_MAX:
                arbitrary_key = next(iter(_cache))
                del _cache[arbitrary_key]
        _cache[user_id] = (snapshot, now)


# ---------------------------------------------------------------------------
# Private core
# ---------------------------------------------------------------------------


async def _run_shadow(
    db: AsyncSession,
    user_id: UUID,
    *,
    legacy_total_xp: int,
    legacy_current_level: int,
    legacy_unlocked_ids: set[str],
    endpoint: str,
) -> None:
    """Compute projection, diff, emit one log event.

    Wrapped in a broad try/except so any failure (including logger failures)
    can be caught by the calling public helper.
    """
    try:
        cached_snapshot, cache_hit = _cache_get(user_id)
        if cache_hit:
            snapshot: GamificationSnapshot = cached_snapshot
        else:
            snapshot = await GamificationProjection.compute(db, user_id)
            _cache_put(user_id, snapshot)

        # Compute diff
        proj_unlocked: set[str] = set(snapshot.unlocked)
        legacy_only = sorted(legacy_unlocked_ids - proj_unlocked)
        projection_only = sorted(proj_unlocked - legacy_unlocked_ids)
        xp_delta = snapshot.total_xp - legacy_total_xp
        level_delta = snapshot.current_level - legacy_current_level

        has_diff = bool(legacy_only or projection_only or xp_delta or level_delta)

        if has_diff:
            event_name = "gamification.shadow.diff"
            logger.info(
                event_name,
                event=event_name,
                user_id=str(user_id),
                endpoint=endpoint,
                legacy_only=legacy_only,
                projection_only=projection_only,
                xp_delta=xp_delta,
                level_delta=level_delta,
                per_metric_mismatches=[],
                projection_version=snapshot.projection_version,
                cache_hit=cache_hit,
            )
        else:
            event_name = "gamification.shadow.match"
            logger.info(
                event_name,
                event=event_name,
                user_id=str(user_id),
                endpoint=endpoint,
                legacy_only=[],
                projection_only=[],
                xp_delta=0,
                level_delta=0,
                per_metric_mismatches=[],
                projection_version=snapshot.projection_version,
                cache_hit=cache_hit,
            )
    except Exception as exc:
        _emit_shadow_error(user_id=user_id, endpoint=endpoint, exc=exc)


def _emit_shadow_error(*, user_id: UUID, endpoint: str, exc: Exception) -> None:
    """Best-effort error emission — caller must not rely on this succeeding."""
    event_name = "gamification.shadow.error"
    logger.warning(
        event_name,
        event=event_name,
        endpoint=endpoint,
        user_id=str(user_id),
        error_type=type(exc).__name__,
        error_message=str(exc),
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def shadow_compare_xp_stats(
    db: AsyncSession,
    user_id: UUID,
    *,
    legacy_total_xp: int,
    legacy_current_level: int,
    endpoint: str,
) -> None:
    """Compare GamificationProjection against legacy XP stats.

    Emits one of:
      - ``gamification.shadow.match`` (INFO) — no discrepancy found
      - ``gamification.shadow.diff`` (INFO)  — mismatch detected
      - ``gamification.shadow.error`` (WARNING) — projection or logger raised

    Args:
        db: Async session reused from the request — no new connection opened.
        user_id: User UUID.
        legacy_total_xp: ``stats["total_xp"]`` from XPService.
        legacy_current_level: ``stats["current_level"]`` from XPService.
        endpoint: Caller endpoint string for log context.
    """
    if not settings.gamification_shadow_mode:
        return
    try:
        await _run_shadow(
            db,
            user_id,
            legacy_total_xp=legacy_total_xp,
            legacy_current_level=legacy_current_level,
            legacy_unlocked_ids=set(),
            endpoint=endpoint,
        )
    except Exception as exc:
        _emit_shadow_error(user_id=user_id, endpoint=endpoint, exc=exc)


async def shadow_compare_achievements(
    db: AsyncSession,
    user_id: UUID,
    *,
    legacy_unlocked_ids: set[str],
    endpoint: str,
) -> None:
    """Compare GamificationProjection against legacy achievement unlock set.

    Emits one of:
      - ``gamification.shadow.match`` (INFO) — no discrepancy found
      - ``gamification.shadow.diff`` (INFO)  — mismatch detected
      - ``gamification.shadow.error`` (WARNING) — projection or logger raised

    Args:
        db: Async session reused from the request — no new connection opened.
        user_id: User UUID.
        legacy_unlocked_ids: Set of achievement IDs currently unlocked in DB.
        endpoint: Caller endpoint string for log context.
    """
    if not settings.gamification_shadow_mode:
        return
    try:
        await _run_shadow(
            db,
            user_id,
            legacy_total_xp=0,
            legacy_current_level=0,
            legacy_unlocked_ids=legacy_unlocked_ids,
            endpoint=endpoint,
        )
    except Exception as exc:
        _emit_shadow_error(user_id=user_id, endpoint=endpoint, exc=exc)


__all__ = [
    "shadow_compare_xp_stats",
    "shadow_compare_achievements",
    "_clear_cache",
    "_cache",
]
