"""Diagnostic harness for PERF-10: per-query baseline measurement.

Run with:
    poetry run python -m src.scripts.perf10_diagnosis

This module exposes three functions used by the tests and the main harness:

``measure_query_baseline(engine)``
    Connects to the database three ways (direct connection, pooled with
    pre-ping enabled, pooled with pre-ping disabled) and times a minimal
    round-trip SELECT 1.  Returns a dict with keys ``direct_ms``,
    ``pooled_preping_ms``, and ``pooled_no_preping_ms`` — all non-negative
    floats representing elapsed milliseconds.

``probe_config_engagement()``
    Interrogates the runtime configuration — settings fields and the Redis
    client — and returns a summary dict with at least:
        ``cache_live`` (bool): whether a live Redis client is available.
        ``feature_background_tasks`` (bool): the current flag value.
        ``database_pool_warm_min`` (int): the pool warm-min setting.

``replay_dashboard_roundtrips(session)``
    Replays the queries that back the learner dashboard (deck list, due-count,
    recent-activity) against the provided AsyncSession.  Returns a dict with:
        ``roundtrip_count`` (int): number of SQL statements executed (≥ 1).
        ``wall_time_ms`` (float): total elapsed time in milliseconds (≥ 0).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings  # noqa: F401 — patched in tests
from src.core.redis import get_redis  # noqa: F401 — patched in tests

# ---------------------------------------------------------------------------
# Public API — skeletons only; executor fills in the real logic.
# ---------------------------------------------------------------------------


def measure_query_baseline(engine: Any) -> dict[str, float]:
    """Measure per-query overhead across three connection modes.

    Args:
        engine: A SQLAlchemy AsyncEngine (or sync Engine) targeting the DB.

    Returns:
        Dict with keys ``direct_ms``, ``pooled_preping_ms``,
        ``pooled_no_preping_ms`` (all non-negative floats).
    """
    raise NotImplementedError


def probe_config_engagement() -> dict[str, Any]:
    """Probe runtime configuration and cache availability.

    Returns:
        Dict with at least ``cache_live`` (bool),
        ``feature_background_tasks`` (bool), and
        ``database_pool_warm_min`` (int).
    """
    raise NotImplementedError


async def replay_dashboard_roundtrips(session: AsyncSession) -> dict[str, Any]:
    """Replay the dashboard query set and count SQL round-trips.

    Args:
        session: An AsyncSession connected to a seeded test database.

    Returns:
        Dict with ``roundtrip_count`` (int ≥ 1) and
        ``wall_time_ms`` (float ≥ 0).
    """
    raise NotImplementedError


# ---------------------------------------------------------------------------
# CLI entry-point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import asyncio

    async def _main() -> None:  # pragma: no cover
        raise NotImplementedError("Main harness not yet implemented")

    asyncio.run(_main())
