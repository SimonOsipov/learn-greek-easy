"""Integration tests for PERF-10-01: dashboard-replay round-trip counter.

DB-backed; requires a live PostgreSQL connection (provided by the
``db_session`` and ``db_engine`` fixtures from the root conftest).

Covers (RED before executor fills in real logic):
- AC3: replay_dashboard_roundtrips returns a positive round-trip count and a
       non-negative wall-time ms when run against a seeded user session.

The SQL round-trip count is measured using the same ``before_cursor_execute``
event-listener pattern used in tests/unit/repositories/test_deck_repository.py
(see capture_sql context manager there).  We mirror that approach here rather
than inventing a new hook style.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

import pytest
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from src.scripts.perf10_diagnosis import replay_dashboard_roundtrips
from tests.factories import UserFactory

# ---------------------------------------------------------------------------
# Helpers — mirror of the capture_sql context manager in test_deck_repository
# ---------------------------------------------------------------------------


@contextmanager
def capture_sql(engine: AsyncEngine) -> Generator[list[str], None, None]:
    """Capture SQL statements issued on *engine* for the duration of the block.

    Attaches a ``before_cursor_execute`` listener before the block and removes
    it after, so only statements issued inside the ``with`` body are recorded.

    Usage::

        with capture_sql(db_engine) as stmts:
            await repo.some_query()
        assert len(stmts) > 0
    """
    stmts: list[str] = []

    def _hook(conn, cursor, statement, parameters, context, executemany):
        stmts.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", _hook)
    try:
        yield stmts
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", _hook)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
class TestDashboardReplay:
    """AC3 — replay_dashboard_roundtrips must return measurable DB activity."""

    async def test_dashboard_replay_counts_roundtrips(
        self,
        db_session: AsyncSession,
        db_engine: AsyncEngine,
    ) -> None:
        """Given a seeded user in a real db_session, replay_dashboard_roundtrips
        must return a positive round-trip count and non-negative wall-time ms.

        The SQL round-trip counter uses the same before_cursor_execute hook as
        the PERF-08 deck-repository tests.
        """
        # Seed a minimal user so the dashboard queries have something to work with.
        user = await UserFactory.create(session=db_session)

        with capture_sql(db_engine) as stmts:
            result = await replay_dashboard_roundtrips(db_session)

        assert isinstance(result, dict), "Result must be a dict"

        assert "roundtrip_count" in result, "Result must contain 'roundtrip_count'"
        assert "wall_time_ms" in result, "Result must contain 'wall_time_ms'"

        assert isinstance(
            result["roundtrip_count"], int
        ), f"roundtrip_count must be int, got {type(result['roundtrip_count'])}"
        assert (
            result["roundtrip_count"] >= 1
        ), f"Expected at least 1 SQL round-trip, got {result['roundtrip_count']}"

        assert isinstance(
            result["wall_time_ms"], (int, float)
        ), f"wall_time_ms must be numeric, got {type(result['wall_time_ms'])}"
        assert (
            result["wall_time_ms"] >= 0
        ), f"wall_time_ms must be non-negative, got {result['wall_time_ms']}"

        # Sanity: the capture_sql hook must also have observed at least one
        # statement during the replay call (cross-check with the event hook).
        assert len(stmts) >= 1, (
            "before_cursor_execute hook captured no statements — "
            "replay_dashboard_roundtrips may not be issuing any queries"
        )
        _ = user  # referenced above; suppress potential linter warning
