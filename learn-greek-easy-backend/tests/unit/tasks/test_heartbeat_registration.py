"""OPS-01-02 (QA Mode B) — adversarial coverage for the scheduler heartbeat job.

The pre-authored AC tests pin two things:
  * ``test_scheduler.py::test_registers_all_jobs`` — the add_job COUNT is 6 and
    the five *other* job ids are present.
  * ``test_session_cleanup_monitor.py`` — the Sentry ``@monitor`` slug/config
    that decorates ``heartbeat_task`` at import time.

Neither of them pins the heartbeat's *actual APScheduler trigger*, nor the
*consistency* between that trigger and the Sentry ``monitor_config`` schedule.
Both gaps are real:

  * The count==6 test still PASSES if someone registers the heartbeat on
    ``IntervalTrigger(minutes=50)`` or a ``CronTrigger`` — proven by mutation.
  * A trigger/monitor mismatch (APScheduler fires every 50 min but Sentry
    expects a check-in every 5 min) causes Sentry *false-misses* and defeats
    the whole point of the story (the dead-man's-switch would page on a healthy
    scheduler).

These tests close both gaps plus guard the no-op body against a future edit
that turns the liveness beat into something that can fail (and thereby
self-defeat the dead-man's-switch).
"""

import asyncio
import importlib
import sys
from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from apscheduler.triggers.interval import IntervalTrigger

from src.tasks.scheduler import setup_scheduler

_SCHEDULED_MODULE = "src.tasks.scheduled"

# The heartbeat monitor_config the executor attached (Backlog task-1277). Kept
# here so the consistency test can tie the APScheduler trigger to it; the exact
# values themselves are pinned independently by test_session_cleanup_monitor.py.
_EXPECTED_INTERVAL_MINUTES = 5


# ---------------------------------------------------------------------------
# Helpers — mirror the mock-scheduler pattern from test_scheduler.py
# ---------------------------------------------------------------------------


def _run_setup_capture():
    """Run setup_scheduler() against a fully mocked AsyncIOScheduler.

    Returns (add_job_call_list, scheduler_init_kwargs) so callers can introspect
    both the per-job add_job(...) calls and the scheduler-level config (timezone).
    """
    import src.tasks.scheduler as scheduler_module

    scheduler_module._scheduler = None

    with (
        patch.object(scheduler_module, "settings") as mock_settings,
        patch("src.tasks.scheduler.AsyncIOScheduler") as mock_scheduler_class,
    ):
        mock_settings.feature_background_tasks = True
        mock_settings.streak_reset_hour_utc = 0

        mock_instance = MagicMock()
        mock_instance.get_jobs.return_value = []
        mock_scheduler_class.return_value = mock_instance

        setup_scheduler()

        scheduler_kwargs = mock_scheduler_class.call_args.kwargs
        add_job_calls = list(mock_instance.add_job.call_args_list)

    return add_job_calls, scheduler_kwargs


def _find_heartbeat_call(add_job_calls):
    """Return the single add_job(...) call whose id kwarg is 'heartbeat', else None."""
    matches = [c for c in add_job_calls if c.kwargs.get("id") == "heartbeat"]
    assert len(matches) <= 1, f"Expected at most one 'heartbeat' job, found {len(matches)}"
    return matches[0] if matches else None


def _capture_heartbeat_monitor_config():
    """Reload src.tasks.scheduled under a spy on sentry_sdk.crons.monitor.

    Returns the monitor_config dict passed to the sole @monitor at import time.
    Restores the ORIGINAL module object in a finally so no other test sees the
    spied reload.

    Identity — not just importability — matters here. Any test that did
    ``from src.tasks.scheduled import <fn>`` at COLLECTION time (e.g.
    test_scheduled_tasks_aggregation.py) holds a function whose ``__globals__``
    IS the original module's ``__dict__``. A teardown that merely RE-IMPORTS
    (a NEW module object) splits that callee from a later
    ``patch("src.tasks.scheduled.<x>")`` string target, which resolves through
    ``sys.modules[...]`` — the new object. The patch then silently MISSES the
    callee, which surfaced as ``RuntimeError: Database not initialized`` in the
    scheduler integration tests under xdist (same root cause documented in
    test_session_cleanup_monitor.py's ``_restore_scheduled``).
    """
    factory_spy = MagicMock()
    factory_spy.return_value = lambda fn: fn  # transparent inner decorator

    # Capture the LIVE module object BEFORE eviction so teardown can restore
    # this exact object (identity-preserving) rather than a re-imported clone.
    original_module = sys.modules.get(_SCHEDULED_MODULE)

    # Evict only the scheduled module (see test_session_cleanup_monitor.py for why
    # we must NOT evict the src.tasks package or src.tasks.scheduler).
    for key in list(sys.modules.keys()):
        if key == _SCHEDULED_MODULE or key.startswith(_SCHEDULED_MODULE + "."):
            sys.modules.pop(key, None)

    try:
        with patch("sentry_sdk.crons.monitor", factory_spy):
            importlib.import_module(_SCHEDULED_MODULE)

        assert factory_spy.call_count == 1, (
            f"Expected exactly one @monitor decoration at import, " f"got {factory_spy.call_count}"
        )
        call = factory_spy.call_args_list[0]
        config = call.kwargs.get("monitor_config")
        if config is None and len(call.args) >= 2:
            config = call.args[1]
    finally:
        # Restore the ORIGINAL module object so subsequent tests use the same
        # namespace their collection-time imports were bound to. Fall back to a
        # fresh import only if there was no prior module (isolated single-file run).
        for key in list(sys.modules.keys()):
            if key == _SCHEDULED_MODULE or key.startswith(_SCHEDULED_MODULE + "."):
                sys.modules.pop(key, None)
        if original_module is not None:
            sys.modules[_SCHEDULED_MODULE] = original_module
        else:
            importlib.import_module(_SCHEDULED_MODULE)

    # Regression guard: teardown must have restored the EXACT original object.
    # Skipped when the module was not imported before this call (isolated run of
    # only this file), where there is no prior identity to preserve.
    if original_module is not None:
        assert sys.modules[_SCHEDULED_MODULE] is original_module, (
            "reload teardown must restore the ORIGINAL src.tasks.scheduled object; "
            "a re-imported clone splits collection-time imported callees from later "
            "string-target patches (the 'Database not initialized' xdist contamination)."
        )

    return config


# ---------------------------------------------------------------------------
# Test 1 — heartbeat trigger is an IntervalTrigger of exactly 5 minutes
# ---------------------------------------------------------------------------


class TestHeartbeatTriggerShape:
    """The count==6 AC test is blind to the heartbeat's actual trigger.

    Regression this catches (proven by mutation): registering the heartbeat as
    ``IntervalTrigger(minutes=50)`` or as a ``CronTrigger`` keeps add_job count
    at 6, so ``test_registers_all_jobs`` stays GREEN — but Sentry would expect a
    check-in every 5 min while APScheduler fires every 50 min → false-miss pages.
    """

    def test_heartbeat_registered_under_id_heartbeat(self):
        """A job with id='heartbeat' must exist and run heartbeat_task."""
        add_job_calls, _ = _run_setup_capture()
        heartbeat_call = _find_heartbeat_call(add_job_calls)

        assert heartbeat_call is not None, (
            "No add_job(...) call with id='heartbeat' was registered. "
            "The trigger/monitor consistency guarantee relies on this exact id."
        )

        from src.tasks.scheduled import heartbeat_task

        registered_fn = heartbeat_call.args[0]
        assert registered_fn is heartbeat_task, (
            "The id='heartbeat' job must be wired to heartbeat_task, "
            f"but it points at {registered_fn!r}."
        )

    def test_heartbeat_trigger_is_interval_of_5_minutes(self):
        """Trigger must be an IntervalTrigger with a 5-minute interval — exactly."""
        add_job_calls, _ = _run_setup_capture()
        heartbeat_call = _find_heartbeat_call(add_job_calls)
        assert heartbeat_call is not None, "id='heartbeat' job missing"

        trigger = heartbeat_call.args[1]  # 2nd positional arg is the trigger

        assert isinstance(trigger, IntervalTrigger), (
            f"Heartbeat trigger must be an IntervalTrigger (not a CronTrigger or "
            f"other), got {type(trigger).__name__}."
        )
        assert trigger.interval == timedelta(minutes=_EXPECTED_INTERVAL_MINUTES), (
            f"Heartbeat IntervalTrigger must fire every {_EXPECTED_INTERVAL_MINUTES} "
            f"minutes, but interval is {trigger.interval}."
        )


# ---------------------------------------------------------------------------
# Test 2 — APScheduler trigger ↔ Sentry monitor_config consistency
# ---------------------------------------------------------------------------


class TestTriggerMonitorConfigConsistency:
    """The APScheduler firing interval MUST equal the Sentry monitor schedule.

    Both values are derived from source (trigger from setup_scheduler, config
    from the import-time @monitor spy), so this is not a 5==5 literal tautology:
    mutating EITHER side alone turns it RED. A drift here is the exact failure
    the story exists to prevent — Sentry would expect check-ins on a cadence the
    scheduler never fires on, producing false dead-man's-switch alerts.

    Constraint (OPS-01-02): the scheduler timezone is UTC, and the Sentry
    monitor_config timezone must equal it ("UTC") so the check-in windows line up.
    """

    def test_trigger_interval_matches_monitor_schedule(self):
        config = _capture_heartbeat_monitor_config()
        add_job_calls, _ = _run_setup_capture()
        heartbeat_call = _find_heartbeat_call(add_job_calls)
        assert heartbeat_call is not None, "id='heartbeat' job missing"
        trigger = heartbeat_call.args[1]

        assert isinstance(
            trigger, IntervalTrigger
        ), f"Consistency check assumes an IntervalTrigger, got {type(trigger).__name__}."
        assert config is not None, "heartbeat @monitor carries no monitor_config"

        schedule = config.get("schedule", {})
        assert schedule.get("type") == "interval", (
            f"monitor_config schedule.type must be 'interval' to match the "
            f"APScheduler IntervalTrigger, got {schedule.get('type')!r}."
        )
        assert (
            schedule.get("unit") == "minute"
        ), f"monitor_config schedule.unit must be 'minute', got {schedule.get('unit')!r}."

        # The load-bearing tie: APScheduler interval == Sentry-declared interval.
        config_value = schedule.get("value")
        assert trigger.interval == timedelta(minutes=config_value), (
            f"APScheduler fires every {trigger.interval} but Sentry monitor_config "
            f"declares every {config_value} minute(s). A mismatch makes Sentry "
            f"expect check-ins the scheduler never sends (false dead-man's-switch)."
        )

    def test_monitor_timezone_matches_scheduler_timezone_utc(self):
        config = _capture_heartbeat_monitor_config()
        _, scheduler_kwargs = _run_setup_capture()

        scheduler_tz = scheduler_kwargs.get("timezone")
        assert (
            scheduler_tz == "UTC"
        ), f"Scheduler must be configured with timezone='UTC', got {scheduler_tz!r}."
        assert config is not None, "heartbeat @monitor carries no monitor_config"
        assert config.get("timezone") == scheduler_tz, (
            f"monitor_config timezone must equal the scheduler timezone "
            f"({scheduler_tz!r}), got {config.get('timezone')!r} — otherwise the "
            f"Sentry check-in window is offset from when jobs actually run."
        )


# ---------------------------------------------------------------------------
# Test 3 — heartbeat_task is an awaitable no-op that never raises / touches IO
# ---------------------------------------------------------------------------


class TestHeartbeatTaskIsNoOp:
    """The beat must stay a pure no-op.

    If a future edit makes heartbeat_task open a DB session, hit Redis, or
    otherwise do work that can fail, the liveness beat could raise and thereby
    *self-defeat* the dead-man's-switch it exists to power. These tests fail the
    moment the body stops being a trivial no-op.
    """

    def test_heartbeat_task_is_coroutine_function(self):
        from src.tasks.scheduled import heartbeat_task

        assert asyncio.iscoroutinefunction(heartbeat_task), (
            "heartbeat_task must remain an async coroutine function so APScheduler "
            "awaits it like the other jobs."
        )

    @pytest.mark.asyncio
    async def test_heartbeat_task_returns_none_and_opens_no_db_session(self):
        from src.tasks import scheduled

        # If the beat ever tries to open a DB session, this mock records it.
        with patch.object(scheduled, "get_session_factory") as mock_factory:
            result = await scheduled.heartbeat_task()  # must not raise

        assert result is None, f"heartbeat_task must return None (pure no-op), got {result!r}."
        # heartbeat_task must not open a DB session — the beat has to be cheap
        # and unfailable to be a trustworthy dead-man's-switch. assert_not_called()
        # raises if get_session_factory was touched.
        mock_factory.assert_not_called()
