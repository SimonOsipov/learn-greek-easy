"""Diagnostic harness for PERF-10: per-query baseline measurement.

Run with:
    poetry run python -m src.scripts.perf10_diagnosis

This is a *standalone* diagnostic script — it is NOT wired into request
handling.  It measures the per-query baseline against the configured database,
probes whether the already-shipped PERF-05 cache / PERF-07 warm-pool config is
actually engaged, and replays the dashboard read sequence to count its
sequential DB round-trips.  Its purpose is to attribute the "still slow"
hot-path latency to a verified root cause and gate the conditional PERF-10-02
… 04 subtasks (see ``docs/perf-10-diagnosis.md``).

Public API (used by the tests and the ``__main__`` harness):

``measure_query_baseline(engine, *, connect=None)``
    Times a minimal ``SELECT 1`` round-trip three ways — direct asyncpg
    connect, Supavisor pooled checkout *with* ``pool_pre_ping``, and the same
    *without* ``pool_pre_ping`` — to isolate the Supavisor proxy delta and the
    per-checkout pre-ping cost.  Returns a dict with keys ``direct_ms``,
    ``pooled_preping_ms``, ``pooled_no_preping_ms`` (all non-negative floats,
    in milliseconds).  Any connection failure for a given mode yields ``0.0``
    for that key (which also signals "unreachable from this host").

``probe_config_engagement()``
    Reports whether a live Redis client is available (``cache_live`` =
    ``get_redis() is not None`` — the gate that decides whether PERF-05 caching
    actually runs), plus the current ``feature_background_tasks`` flag and the
    effective ``database_pool_warm_min``.

``replay_dashboard_roundtrips(session)``
    Replays the learner-dashboard read sequence (``ProgressService
    ._compute_dashboard_stats``) against the provided AsyncSession with a
    ``before_cursor_execute`` counting hook, returning ``roundtrip_count``
    (int ≥ 1) and ``wall_time_ms`` (float ≥ 0).
"""

from __future__ import annotations

import time
from typing import Any, Awaitable, Callable, Optional
from uuid import uuid4

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings  # noqa: F401 — patched in tests
from src.core.redis import get_redis  # noqa: F401 — patched in tests

# Number of timed iterations per connection mode in the baseline benchmark.
_BASELINE_ITERATIONS = 20

# ---------------------------------------------------------------------------
# AC1 — per-query baseline across three connection modes
# ---------------------------------------------------------------------------


async def _time_direct_asyncpg(iterations: int) -> float:
    """Mean ms for a ``SELECT 1`` over a fresh raw-asyncpg direct connection.

    Uses the sync DSN (no ``+asyncpg`` SQLAlchemy dialect prefix) since asyncpg
    speaks libpq directly.  A new connection per call would dominate the timing
    with the connect handshake, so we connect once and time the queries.
    """
    import asyncpg

    dsn = settings.database_url_sync
    conn = await asyncpg.connect(dsn)
    try:
        start = time.perf_counter()
        for _ in range(iterations):
            await conn.fetchval("SELECT 1")
        elapsed = time.perf_counter() - start
    finally:
        await conn.close()
    return (elapsed / iterations) * 1000.0


async def _time_pooled(iterations: int, *, pre_ping: bool) -> float:
    """Mean ms for a ``SELECT 1`` over a Supavisor pooled checkout.

    Builds a throwaway SQLAlchemy async engine with ``pool_pre_ping`` set to
    *pre_ping* so the per-checkout liveness ``SELECT 1`` cost is isolated: each
    iteration opens a fresh connection from the pool (``engine.connect()``),
    which is where ``pool_pre_ping`` fires its extra round-trip.
    """
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine(
        settings.database_url,
        pool_pre_ping=pre_ping,
        pool_size=2,
        max_overflow=2,
    )
    try:
        # Warm one connection so the connect handshake isn't counted.
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))

        start = time.perf_counter()
        for _ in range(iterations):
            # New checkout each iteration → pool_pre_ping fires here when on.
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        elapsed = time.perf_counter() - start
    finally:
        await engine.dispose()
    return (elapsed / iterations) * 1000.0


def measure_query_baseline(
    engine: Any,
    *,
    connect: Optional[Callable[..., Any]] = None,
) -> dict[str, float]:
    """Measure per-query overhead across three connection modes.

    Times a minimal ``SELECT 1`` over (a) a raw-asyncpg direct connection,
    (b) a Supavisor pooled checkout *with* ``pool_pre_ping``, and (c) the same
    *without* ``pool_pre_ping``.  The delta (b)−(a) isolates the Supavisor proxy
    overhead; (b)−(c) isolates the per-checkout pre-ping round-trip.

    Args:
        engine: Accepted for signature/back-compat; the real timing uses the
            module's connection helpers (driven off ``settings``).  A mock or
            unreachable target simply yields ``0.0`` for the affected mode.
        connect: Optional override coroutine factory for the direct/pooled
            timing (test seam).  When ``None`` the real helpers are used.

    Returns:
        Dict with keys ``direct_ms``, ``pooled_preping_ms``,
        ``pooled_no_preping_ms`` — all non-negative floats (ms).  Any mode that
        cannot connect (mock engine, DB unreachable) returns ``0.0`` for that
        key rather than raising, so the caller always gets a well-formed dict.
    """
    import asyncio

    _ = engine  # signature compatibility; real timing is settings-driven

    async def _run() -> dict[str, float]:
        direct_fn = connect or _time_direct_asyncpg

        async def _safe(coro_factory: Callable[[], Awaitable[float]]) -> float:
            try:
                value = await coro_factory()
                return max(0.0, float(value))
            except Exception:
                # DB unreachable / mock engine / connect error → 0.0 sentinel.
                return 0.0

        direct_ms = await _safe(lambda: direct_fn(_BASELINE_ITERATIONS))
        pooled_preping_ms = await _safe(lambda: _time_pooled(_BASELINE_ITERATIONS, pre_ping=True))
        pooled_no_preping_ms = await _safe(
            lambda: _time_pooled(_BASELINE_ITERATIONS, pre_ping=False)
        )

        return {
            "direct_ms": direct_ms,
            "pooled_preping_ms": pooled_preping_ms,
            "pooled_no_preping_ms": pooled_no_preping_ms,
        }

    # Run in a private event loop. asyncio.run() raises if one is already
    # running, but this harness is invoked from sync contexts (tests / CLI).
    try:
        return asyncio.run(_run())
    except RuntimeError:
        # Fallback for the unlikely "already in a loop" case — still return a
        # well-formed (all-zero) dict rather than propagating.
        return {
            "direct_ms": 0.0,
            "pooled_preping_ms": 0.0,
            "pooled_no_preping_ms": 0.0,
        }


# ---------------------------------------------------------------------------
# AC2 — runtime config-engagement probe
# ---------------------------------------------------------------------------


def probe_config_engagement() -> dict[str, Any]:
    """Probe runtime configuration and cache availability.

    ``cache_live`` is the load-bearing signal: ``CacheService.enabled`` is
    ``settings.cache_enabled AND get_redis() is not None``, and ``init_redis``
    *swallows* connection failures (leaving the client ``None``), so a cache
    that silently no-ops in prod is the prime suspect for "get_me still slow
    despite the identity cache."

    Returns:
        Dict with ``cache_live`` (bool), ``feature_background_tasks`` (bool),
        and ``database_pool_warm_min`` (int).
    """
    return {
        "cache_live": get_redis() is not None,
        "feature_background_tasks": settings.feature_background_tasks,
        "database_pool_warm_min": settings.database_pool_warm_min,
    }


# ---------------------------------------------------------------------------
# AC3 — dashboard read-sequence replay + round-trip count
# ---------------------------------------------------------------------------


async def replay_dashboard_roundtrips(session: AsyncSession) -> dict[str, Any]:
    """Replay the dashboard read sequence and count SQL round-trips.

    Attaches a ``before_cursor_execute`` counting hook to the session's sync
    engine (the same pattern as ``tests/unit/repositories/test_deck_repository
    .py::capture_sql``), runs ``ProgressService._compute_dashboard_stats`` for a
    user, and returns the statement count and wall-time.  ``_compute_dashboard
    _stats`` is used directly (not the cached ``get_dashboard_stats``) so the
    replay always exercises the full sequential read path, not a cache hit.

    The user need not have any data — the dashboard reads run (and count) the
    same regardless; an absent user simply yields zero-valued aggregates.

    Args:
        session: An AsyncSession connected to a seeded test database.

    Returns:
        Dict with ``roundtrip_count`` (int ≥ 1) and ``wall_time_ms`` (float).
    """
    # Imported lazily so the unit tests (which never call this) don't pull in
    # the full service graph.
    from src.services.progress_service import ProgressService

    statements: list[str] = []

    def _hook(
        conn: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        statements.append(statement)

    # Resolve the underlying *sync* Engine and attach the counting hook there —
    # the same target the reference capture_sql helper uses
    # (tests/unit/repositories/test_deck_repository.py). The session may be
    # bound to a Connection (the test fixture binds via bind=<AsyncConnection>)
    # or directly to an Engine; ``.engine`` on either a Connection or an Engine
    # returns the owning Engine, and ``.sync_engine`` unwraps the async facade.
    bind = session.get_bind()  # AsyncConnection facade or AsyncEngine
    owning_engine = bind.engine  # AsyncEngine in both cases
    sync_engine = getattr(owning_engine, "sync_engine", owning_engine)
    event.listen(sync_engine, "before_cursor_execute", _hook)
    try:
        user_id = uuid4()
        start = time.perf_counter()
        await ProgressService(session)._compute_dashboard_stats(user_id)
        wall_time_ms = (time.perf_counter() - start) * 1000.0
    finally:
        event.remove(sync_engine, "before_cursor_execute", _hook)

    return {
        "roundtrip_count": len(statements),
        "wall_time_ms": wall_time_ms,
    }


# ---------------------------------------------------------------------------
# CLI entry-point — run all three probes and print a report.
# ---------------------------------------------------------------------------


def _format_report(baseline: dict[str, float], config: dict[str, Any]) -> str:
    lines = [
        "PERF-10 diagnosis harness",
        "=========================",
        "",
        "Per-query baseline (mean ms over "
        f"{_BASELINE_ITERATIONS} iterations; 0.0 = mode unreachable):",
        f"  direct asyncpg .............. {baseline['direct_ms']:.2f} ms",
        f"  pooled WITH pool_pre_ping ... {baseline['pooled_preping_ms']:.2f} ms",
        f"  pooled WITHOUT pre_ping ..... {baseline['pooled_no_preping_ms']:.2f} ms",
        "",
        "Config engagement:",
        f"  cache_live (get_redis() != None) ... {config['cache_live']}",
        f"  feature_background_tasks ........... {config['feature_background_tasks']}",
        f"  database_pool_warm_min ............. {config['database_pool_warm_min']}",
    ]
    return "\n".join(lines)


if __name__ == "__main__":
    baseline = measure_query_baseline(None)
    config = probe_config_engagement()
    print(_format_report(baseline, config))
