"""RED tests for INFRA-07: Sentry Crons @monitor on session_cleanup_task.

These tests assert the decorator is applied with the correct slug and that
ONLY one job in the scheduler is decorated (Sentry free tier = 1 monitor).

They are intentionally RED before implementation (no @monitor applied yet)
and will turn GREEN once the executor adds:
    from sentry_sdk.crons import monitor
    @monitor(monitor_slug="scheduler-session-cleanup")
    async def session_cleanup_task() -> None: ...

Technique: import-time spy.
  Because sentry_sdk.crons.monitor is called at module import time (decoration
  runs when Python executes the `@monitor(...)` expression), we must:
    1. Delete the already-imported module from sys.modules.
    2. Patch sentry_sdk.crons.monitor with a spy WHILE the module is reloaded.
    3. Assert the spy was called during the reload.
    4. Restore the real module in teardown so other tests are unaffected.

  Patching AFTER import has no effect — decoration is a one-time event at
  module load, not re-evaluated on each function call.
"""

import asyncio
import importlib
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SCHEDULED_MODULE = "src.tasks.scheduled"

# Sub-modules of src.tasks.scheduled that may also be cached and need eviction
# so a fresh reload pulls in a clean copy.
_SUBMODULES_TO_EVICT = [
    "src.tasks.scheduled",
    "src.tasks",  # the package __init__ re-exports names; evict it too
]


def _evict_scheduled():
    """Remove src.tasks.scheduled (and the tasks package) from sys.modules."""
    for key in list(sys.modules.keys()):
        for target in _SUBMODULES_TO_EVICT:
            if key == target or key.startswith(target + "."):
                sys.modules.pop(key, None)


def _restore_scheduled():
    """Re-import src.tasks.scheduled for real so subsequent tests use the true module."""
    _evict_scheduled()
    importlib.import_module(_SCHEDULED_MODULE)


# ---------------------------------------------------------------------------
# Test A — Decorator applied with the correct slug
# ---------------------------------------------------------------------------


class TestMonitorAppliedWithCorrectSlug:
    """
    INFRA-07 AC#1: session_cleanup_task is decorated with
    @monitor(monitor_slug="scheduler-session-cleanup").

    RED pre-implementation: spy never called (count == 0), so the
    "called exactly once" assertion fails for the right reason.
    """

    def test_monitor_applied_with_correct_slug(self):
        """
        Spy on sentry_sdk.crons.monitor, reload the scheduled module under
        the patch, then assert the spy was called exactly once with
        monitor_slug='scheduler-session-cleanup'.

        PRE-IMPLEMENTATION: FAILS because @monitor is not applied yet
        → spy is never called → assert spy.call_count == 1 fails.
        """
        # A pass-through spy: records calls and returns a transparent decorator
        # so the reload doesn't break the module structure.
        spy = MagicMock(side_effect=lambda fn: fn)

        _evict_scheduled()
        try:
            with patch("sentry_sdk.crons.monitor", spy):
                importlib.import_module(_SCHEDULED_MODULE)

            # Assert called exactly once (one @monitor decoration)
            assert spy.call_count == 1, (
                f"Expected sentry_sdk.crons.monitor to be called exactly once "
                f"during module load, but it was called {spy.call_count} time(s). "
                f"Has @monitor been applied to session_cleanup_task?"
            )

            # Assert the slug is exactly right
            call_kwargs = spy.call_args_list[0][1]  # kwargs of the first (only) call
            assert call_kwargs.get("monitor_slug") == "scheduler-session-cleanup", (
                f"Expected monitor_slug='scheduler-session-cleanup', " f"got: {call_kwargs!r}"
            )
        finally:
            # Restore the real (unpatched) module so later tests are unaffected
            _restore_scheduled()


# ---------------------------------------------------------------------------
# Test B — Free-tier guard: exactly one @monitor in the scheduler codebase
# ---------------------------------------------------------------------------


class TestOnlyOneJobDecorated:
    """
    INFRA-07 AC#1: Sentry free tier allows exactly ONE cron monitor.
    No other scheduled job may carry a @monitor decoration.

    We use a source-scan approach (count literal occurrences of `@monitor(`
    in scheduled.py and scheduled_gamification.py) combined with the spy
    count from a fresh module reload, giving two independent assertions.

    RED pre-implementation: both counts are 0, so "exactly 1" fails.
    """

    def _source_scan_count(self) -> int:
        """
        Count the number of @monitor( decorator occurrences across the two
        scheduler source files. This is file-level source truth — it catches
        decorated definitions even if the reload spy misses an edge case.
        """
        backend_root = Path(__file__).parent.parent.parent.parent / "src" / "tasks"
        files_to_scan = [
            backend_root / "scheduled.py",
            backend_root / "scheduled_gamification.py",
        ]
        count = 0
        for path in files_to_scan:
            if path.exists():
                text = path.read_text()
                # Count lines that ARE decorator applications: @monitor(
                # (not bare imports or comments)
                for line in text.splitlines():
                    stripped = line.strip()
                    if stripped.startswith("@monitor(") or stripped.startswith("@monitor ("):
                        count += 1
        return count

    def test_exactly_one_monitor_in_source(self):
        """
        Source-scan assertion: exactly one @monitor( line across all scheduler
        task files.

        PRE-IMPLEMENTATION: FAILS — count == 0 (no decorator exists yet).
        """
        count = self._source_scan_count()
        assert count == 1, (
            f"Expected exactly 1 @monitor( decoration across scheduled task "
            f"files (Sentry free tier = 1 monitor), found {count}. "
            f"Pre-implementation: this is RED because no @monitor is applied yet."
        )

    def test_monitor_slug_in_source_is_session_cleanup(self):
        """
        Source-scan slug check: the one @monitor line must use
        monitor_slug='scheduler-session-cleanup'.

        PRE-IMPLEMENTATION: FAILS — no @monitor line exists.
        """
        backend_root = Path(__file__).parent.parent.parent.parent / "src" / "tasks"
        files_to_scan = [
            backend_root / "scheduled.py",
            backend_root / "scheduled_gamification.py",
        ]
        slug_lines = []
        for path in files_to_scan:
            if path.exists():
                text = path.read_text()
                for line in text.splitlines():
                    stripped = line.strip()
                    if stripped.startswith("@monitor(") or stripped.startswith("@monitor ("):
                        slug_lines.append(stripped)

        assert (
            len(slug_lines) == 1
        ), f"Expected exactly one @monitor( decorator line, found {len(slug_lines)}: {slug_lines!r}"
        assert "scheduler-session-cleanup" in slug_lines[0], (
            f"The @monitor decorator must use monitor_slug='scheduler-session-cleanup', "
            f"but the line is: {slug_lines[0]!r}"
        )


# ---------------------------------------------------------------------------
# Test C — Behavior / async-ness unchanged (guard — may be GREEN pre-impl too)
# ---------------------------------------------------------------------------


class TestSessionCleanupTaskBehaviorUnchanged:
    """
    INFRA-07 AC#2: Wrapping with @monitor must not break async-ness or
    observable behavior. These tests may be GREEN even before implementation
    (the function is already async and well-tested); they guard against
    regressions introduced by the decorator.
    """

    def test_is_async_function_after_decoration(self):
        """
        asyncio.iscoroutinefunction must return True after the @monitor wrap.
        sentry_sdk 2.54.0 preserves this via functools.wraps.
        This test is GREEN pre-implementation and must stay GREEN after.
        """
        from src.tasks.scheduled import session_cleanup_task

        assert asyncio.iscoroutinefunction(session_cleanup_task), (
            "session_cleanup_task must remain an async-compatible coroutine "
            "function after @monitor wrapping."
        )

    @pytest.mark.asyncio
    async def test_happy_path_with_redis_none_no_raise(self):
        """
        With get_redis() returning None (Sentry uninit, no-op decorator),
        the task must log a warning and return without raising.
        GREEN pre-implementation; guards against decorator regressions.
        """
        from unittest.mock import patch

        from src.tasks.scheduled import session_cleanup_task

        with patch("src.core.redis.get_redis", return_value=None):
            with patch("src.tasks.scheduled.logger") as mock_logger:
                # Must not raise
                await session_cleanup_task()

                warning_calls = [c[0][0] for c in mock_logger.warning.call_args_list]
                assert any(
                    "Redis not available" in msg for msg in warning_calls
                ), "Expected 'Redis not available' warning when Redis is None"
