"""RED tests for OPS-01-02: migrate the single Sentry Crons @monitor from the
(dead) session-cleanup job to the new no-op heartbeat task.

End-state under test (Backlog task-1277):
  1. src/tasks/scheduled.py defines a no-op ``heartbeat_task`` decorated with
        @monitor(
            monitor_slug="scheduler-heartbeat",
            monitor_config={
                "schedule": {"type": "interval", "value": 5, "unit": "minute"},
                "checkin_margin": 2,
                "max_runtime": 1,
                "timezone": "UTC",
            },
        )
     (monitor_config is a PLAIN DICT — MonitorConfig is TYPE_CHECKING-only in
     sentry-sdk 2.63.0.)
  2. ``session_cleanup_task`` NO LONGER carries an @monitor decorator.
  3. The slug ``scheduler-session-cleanup`` no longer appears in the source.

Sentry free tier allows exactly ONE cron monitor, so the whole scheduler
codebase must carry exactly one @monitor — now on the heartbeat, not on
session-cleanup.

RED status BEFORE implementation
--------------------------------
Today scheduled.py:211 still has
    @monitor(monitor_slug="scheduler-session-cleanup")
on session_cleanup_task, and there is no heartbeat_task. So every assertion
below fails for the RIGHT reason — an *assertion* failure ("expected
scheduler-heartbeat, found scheduler-session-cleanup" / "session_cleanup_task
still decorated" / "scheduler-session-cleanup still in source"), NOT an
import/collection error.

Why no ``from src.tasks.scheduled import heartbeat_task`` at module top
----------------------------------------------------------------------
heartbeat_task does not exist yet — a top-level import of it would make this
file fail to COLLECT (ImportError), which is the wrong kind of RED. Instead we
verify the end-state two ways that both keep RED as a clean assertion failure:

  * Source-scan of scheduled.py (read the file text, inspect which function
    each ``@monitor(`` line decorates, check slug presence/absence). No import
    of the not-yet-existing symbol.
  * Import-time spy: sentry_sdk.crons.monitor is a DECORATOR FACTORY invoked at
    module-import time. We evict src.tasks.scheduled from sys.modules, reload it
    under a spy patched onto sentry_sdk.crons.monitor, and introspect the
    slug + config dict that were passed. The module still imports cleanly
    (the spy is a transparent pass-through), so the RED is purely the
    assertions on the recorded slug/config.

Technique note (import-time spy):
  Because sentry_sdk.crons.monitor is called at module import time (decoration
  runs when Python executes the ``@monitor(...)`` expression), we must:
    1. Delete the already-imported module from sys.modules.
    2. Patch sentry_sdk.crons.monitor with a spy WHILE the module is reloaded.
    3. Assert on the recorded call args.
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

# Only src.tasks.scheduled (and any sub-modules) need eviction for the reload
# spy to work.  We deliberately do NOT evict src.tasks (the package __init__)
# or src.tasks.scheduler — those modules are imported at test-collection time
# by test_scheduler.py (top-level `from src.tasks.scheduler import ...`).
# Evicting the package forces Python to re-execute __init__.py, which
# re-imports src.tasks.scheduler as a NEW module object — different from the
# one already bound to test_scheduler.py's top-level names.  The two sets of
# names then point to different _scheduler globals and six scheduler tests
# silently fail.  Since src.tasks.__init__ does NOT import from
# src.tasks.scheduled, we don't need to evict the package at all.
_SUBMODULES_TO_EVICT = [
    "src.tasks.scheduled",
]

# The expected end-state monitor config the executor must attach to
# heartbeat_task (Backlog task-1277).
_EXPECTED_HEARTBEAT_SLUG = "scheduler-heartbeat"
_EXPECTED_HEARTBEAT_CONFIG = {
    "schedule": {"type": "interval", "value": 5, "unit": "minute"},
    "checkin_margin": 2,
    "max_runtime": 1,
    "timezone": "UTC",
}
_DEAD_SESSION_CLEANUP_SLUG = "scheduler-session-cleanup"


def _evict_scheduled():
    """Remove src.tasks.scheduled from sys.modules (only that module)."""
    for key in list(sys.modules.keys()):
        for target in _SUBMODULES_TO_EVICT:
            if key == target or key.startswith(target + "."):
                sys.modules.pop(key, None)


def _restore_scheduled():
    """Re-import src.tasks.scheduled for real so subsequent tests use the true module."""
    _evict_scheduled()
    importlib.import_module(_SCHEDULED_MODULE)


def _tasks_dir() -> Path:
    """Absolute path to src/tasks/ (from tests/unit/tasks/ → up 3 → src/tasks)."""
    return Path(__file__).parent.parent.parent.parent / "src" / "tasks"


def _scheduler_source_files() -> list[Path]:
    """Every scheduler task source file that could legally carry an @monitor."""
    root = _tasks_dir()
    return [root / "scheduled.py", root / "scheduled_gamification.py"]


def _is_monitor_decorator_line(stripped: str) -> bool:
    """True if a stripped source line is an @monitor( decorator application."""
    return stripped.startswith("@monitor(") or stripped.startswith("@monitor (")


def _decorated_function_map(source: str) -> dict[str, str]:
    """Map each ``@monitor(`` occurrence to the function it decorates.

    Scans forward from every ``@monitor(`` line to the next ``def``/``async def``
    and records the function name. Robust to the decorator spanning multiple
    lines and to intervening decorators.

    Returns { function_name: monitor_line } for every decorated function.
    """
    lines = source.splitlines()
    result: dict[str, str] = {}
    for i, line in enumerate(lines):
        if not _is_monitor_decorator_line(line.strip()):
            continue
        monitor_line = line.strip()
        # Scan forward to the next function definition
        for j in range(i + 1, len(lines)):
            fwd = lines[j].strip()
            if fwd.startswith("async def ") or fwd.startswith("def "):
                # extract name: "async def foo(" -> "foo"
                after_def = fwd.split("def ", 1)[1]
                fn_name = after_def.split("(", 1)[0].strip()
                result[fn_name] = monitor_line
                break
    return result


def _extract_slug_and_config(call):
    """Pull (monitor_slug, monitor_config) out of a recorded spy call.

    The executor uses kwargs (@monitor(monitor_slug=..., monitor_config=...)),
    but fall back to positional args so a positional call is still introspected
    rather than mis-reported as a wrong-reason failure.
    """
    args, kwargs = call.args, call.kwargs
    slug = kwargs.get("monitor_slug")
    config = kwargs.get("monitor_config")
    if slug is None and len(args) >= 1:
        slug = args[0]
    if config is None and len(args) >= 2:
        config = args[1]
    return slug, config


# ---------------------------------------------------------------------------
# Test A — Source-scan: monitor migrated to heartbeat, session-cleanup dropped
# ---------------------------------------------------------------------------


class TestMonitorMigratedToHeartbeatInSource:
    """
    OPS-01-02 AC-B2 via file-level source truth.

    RED pre-implementation:
      - scheduled.py still has @monitor(monitor_slug="scheduler-session-cleanup")
        on session_cleanup_task and no heartbeat_task.
    """

    def _read(self, path: Path) -> str:
        return path.read_text() if path.exists() else ""

    def test_dead_session_cleanup_slug_removed_from_source(self):
        """The 'scheduler-session-cleanup' slug must be gone from all scheduler files.

        PRE-IMPLEMENTATION: FAILS — the slug is still present in scheduled.py.
        """
        offenders = []
        for path in _scheduler_source_files():
            if _DEAD_SESSION_CLEANUP_SLUG in self._read(path):
                offenders.append(path.name)
        assert not offenders, (
            f"The dead slug {_DEAD_SESSION_CLEANUP_SLUG!r} must be fully removed, "
            f"but it still appears in: {offenders}. "
            f"OPS-01-02 drops the session-cleanup monitor entirely."
        )

    def test_heartbeat_slug_present_in_source(self):
        """The new 'scheduler-heartbeat' slug must appear in scheduled.py.

        PRE-IMPLEMENTATION: FAILS — no heartbeat monitor exists yet.
        """
        source = self._read(_tasks_dir() / "scheduled.py")
        assert _EXPECTED_HEARTBEAT_SLUG in source, (
            f"Expected the new monitor slug {_EXPECTED_HEARTBEAT_SLUG!r} to appear in "
            f"scheduled.py, but it is absent — has heartbeat_task been decorated?"
        )

    def test_monitor_decorates_heartbeat_not_session_cleanup(self):
        """The single @monitor must decorate heartbeat_task, NOT session_cleanup_task.

        PRE-IMPLEMENTATION: FAILS — the @monitor currently decorates
        session_cleanup_task, so `decorated == {'heartbeat_task'}` is false and
        'session_cleanup_task' is still in the decorated set.
        """
        source = self._read(_tasks_dir() / "scheduled.py")
        decorated = _decorated_function_map(source)

        assert "session_cleanup_task" not in decorated, (
            "session_cleanup_task must NO LONGER carry an @monitor decorator "
            f"(OPS-01-02 removes it), but it is still decorated by: "
            f"{decorated.get('session_cleanup_task')!r}"
        )
        assert set(decorated.keys()) == {"heartbeat_task"}, (
            "Exactly one function — heartbeat_task — must carry @monitor, "
            f"but the decorated functions are: {sorted(decorated.keys())}"
        )

    def test_exactly_one_monitor_across_scheduler_files(self):
        """Free-tier guard: exactly one @monitor( line across all scheduler files.

        Holds both before and after implementation (the migration moves the one
        monitor, it does not add a second). Guards against the executor leaving
        BOTH the old and new decorators, which would exceed the Sentry free-tier
        1-monitor limit.
        """
        count = 0
        for path in _scheduler_source_files():
            for line in self._read(path).splitlines():
                if _is_monitor_decorator_line(line.strip()):
                    count += 1
        assert count == 1, (
            f"Expected exactly 1 @monitor( decoration across scheduler task files "
            f"(Sentry free tier = 1 monitor), found {count}."
        )


# ---------------------------------------------------------------------------
# Test B — Import-time spy: heartbeat slug + full monitor_config shape
# ---------------------------------------------------------------------------


class TestHeartbeatMonitorSlugAndConfig:
    """
    OPS-01-02 AC-B2: the @monitor applied at import time carries
    monitor_slug='scheduler-heartbeat' AND the correct monitor_config dict
    (interval/5/minute schedule, checkin_margin=2, max_runtime=1, timezone=UTC).

    RED pre-implementation: the sole @monitor call passes
    monitor_slug='scheduler-session-cleanup' with no monitor_config, so the
    slug assertion fails first with a clean, right-reason message.
    """

    def test_heartbeat_monitor_slug_and_config(self):
        """
        Spy on sentry_sdk.crons.monitor, reload scheduled.py under the patch,
        then assert the recorded decoration matches the heartbeat end-state.

        sentry_sdk.crons.monitor is a DECORATOR FACTORY, used as:
            @monitor(monitor_slug="...", monitor_config={...})  # factory call
            async def fn(): ...                                 # decorator(fn)

        The spy models this two-step protocol:
          - factory_spy(monitor_slug=..., monitor_config=...) at import (step 1)
          - factory_spy.return_value(fn) immediately after (step 2)
        Its return_value is a transparent pass-through so the module loads.
        """
        factory_spy = MagicMock()
        factory_spy.return_value = lambda fn: fn  # inner decorator: transparent

        _evict_scheduled()
        try:
            with patch("sentry_sdk.crons.monitor", factory_spy):
                importlib.import_module(_SCHEDULED_MODULE)

            # Exactly one @monitor decoration ran during load (free-tier guard).
            assert factory_spy.call_count == 1, (
                f"Expected sentry_sdk.crons.monitor to be called exactly once during "
                f"module load, but it was called {factory_spy.call_count} time(s)."
            )

            slug, config = _extract_slug_and_config(factory_spy.call_args_list[0])

            # Slug: RED pre-impl → 'scheduler-session-cleanup' != 'scheduler-heartbeat'.
            assert slug == _EXPECTED_HEARTBEAT_SLUG, (
                f"Expected monitor_slug={_EXPECTED_HEARTBEAT_SLUG!r}, got {slug!r}. "
                f"The @monitor must be migrated onto heartbeat_task."
            )

            # Config: RED pre-impl → the session-cleanup decorator passes no config.
            assert config is not None, (
                "Expected a monitor_config dict on the heartbeat @monitor, got None. "
                "The heartbeat monitor must declare its interval schedule so Sentry "
                "knows when to expect check-ins."
            )
            assert config.get("schedule") == _EXPECTED_HEARTBEAT_CONFIG["schedule"], (
                f"Expected schedule={_EXPECTED_HEARTBEAT_CONFIG['schedule']!r}, "
                f"got {config.get('schedule')!r}"
            )
            assert config.get("checkin_margin") == _EXPECTED_HEARTBEAT_CONFIG["checkin_margin"], (
                f"Expected checkin_margin={_EXPECTED_HEARTBEAT_CONFIG['checkin_margin']}, "
                f"got {config.get('checkin_margin')!r}"
            )
            assert config.get("max_runtime") == _EXPECTED_HEARTBEAT_CONFIG["max_runtime"], (
                f"Expected max_runtime={_EXPECTED_HEARTBEAT_CONFIG['max_runtime']}, "
                f"got {config.get('max_runtime')!r}"
            )
            assert config.get("timezone") == _EXPECTED_HEARTBEAT_CONFIG["timezone"], (
                f"Expected timezone={_EXPECTED_HEARTBEAT_CONFIG['timezone']!r}, "
                f"got {config.get('timezone')!r}"
            )
        finally:
            # Restore the real (unpatched) module so later tests are unaffected.
            # This MUST run even if assertions fail to prevent module-state
            # contamination that would cascade failures to other test modules.
            _restore_scheduled()


# ---------------------------------------------------------------------------
# Test C — Behavior / async-ness unchanged (guard — GREEN before and after)
# ---------------------------------------------------------------------------


class TestSessionCleanupTaskBehaviorUnchanged:
    """
    OPS-01-02 regression guard: dropping the @monitor from session_cleanup_task
    must not break its async-ness or observable behavior. These stay GREEN both
    before and after implementation.
    """

    def test_is_async_function(self):
        """session_cleanup_task must remain a coroutine function."""
        from src.tasks.scheduled import session_cleanup_task

        assert asyncio.iscoroutinefunction(
            session_cleanup_task
        ), "session_cleanup_task must remain an async coroutine function."

    @pytest.mark.asyncio
    async def test_happy_path_with_redis_none_no_raise(self):
        """
        With get_redis() returning None, the task logs a warning and returns
        without raising. Guards against regressions from the decorator removal.
        """
        from src.tasks.scheduled import session_cleanup_task

        with patch("src.core.redis.get_redis", return_value=None):
            with patch("src.tasks.scheduled.logger") as mock_logger:
                await session_cleanup_task()  # must not raise

                warning_calls = [c[0][0] for c in mock_logger.warning.call_args_list]
                assert any(
                    "Redis not available" in msg for msg in warning_calls
                ), "Expected 'Redis not available' warning when Redis is None"
