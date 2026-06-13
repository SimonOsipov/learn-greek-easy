"""Regression-lock for the Supavisor SESSION-mode engine configuration (PERF-10-04).

This is a **born-GREEN regression lock**, NOT a test-first RED.

PERF-10-01's diagnosis resolved the transaction-mode
lever to a documented NO-OP: tx-mode stays REJECTED on a correctness fact (it breaks
asyncpg prepared statements) and the per-query slowness was count-bound, not Supavisor
session-mode proxy overhead. PERF-10-04 therefore makes NO engine change.

Because nothing changed, the F1 branch ships exactly one assertion that LOCKS the
current session-mode engine config so a future silent flip to transaction mode (or a
drift of the budgeted pool default) is caught by CI rather than reaching prod. The
single test below is green by design today; it goes RED only if someone:

  - adds an asyncpg ``statement_cache_size`` override to ``connect_args``
    (the required tx-mode mitigation — a tell-tale of a tx-mode flip), or
  - moves the engine off Supavisor session-mode port 5432 onto tx-mode 6543, or
  - drops ``pool_pre_ping`` (PERF-10-04 'KEEP' verdict — no keepalive-liveness
    evidence justified dropping it), or
  - drifts the budgeted pool default away from API 15 + 5 (≤30 Supavisor budget).

The pool-budget guard asserts the env-independent ``Settings`` field DEFAULT (a prod
deploy may override pool size via env by design, so the Field default is the only
stable budget lock). The tx-mode tells are asserted against the kwargs handed to
``create_async_engine`` (mocked — no DB connection), built from a pinned ``Settings``
so ambient ``.env`` / CI noise cannot flake the test.

Out of scope (flagged follow-up): a runtime startup assertion in ``config.py`` that
would catch a prod env override like ``DATABASE_POOL_SIZE=40`` — that is a code change,
not part of this no-op subtask.
"""

from unittest.mock import patch

import pytest
from sqlalchemy.engine import make_url

import src.db.session as session_module
from src.config import Settings


@pytest.mark.unit
def test_session_mode_engine_config_unchanged():
    """REGRESSION LOCK (born-green, F1): engine stays Supavisor session-mode, pool 15+5.

    Guards against a silent flip to Supavisor transaction mode (port 6543 +
    asyncpg ``statement_cache_size=0``), a dropped ``pool_pre_ping``, or drift of the
    budgeted pool default. NOT a test-first RED: PERF-10-04 changed no engine code, so
    this asserts the *current* config holds.
    """
    # --- Budget lock: the canonical, env-independent pool default is API 15 + 5
    #     (≤30 Supavisor budget). Asserting the Field default (not the runtime value)
    #     keeps the lock stable across local/CI .env overrides. ---
    fields = Settings.model_fields
    assert (
        fields["database_pool_size"].default == 15
    ), "database_pool_size default drifted from the budgeted 15"
    assert (
        fields["database_max_overflow"].default == 5
    ), "database_max_overflow default drifted from the budgeted 5"

    # --- Build the engine from a PINNED Settings so ambient .env / CI pool-size
    #     overrides cannot flake the tx-mode tells below. is_production=False keeps
    #     SSL out of connect_args; the production (non-testing) pool branch is taken
    #     because app_env is not 'testing'. ---
    pinned = Settings(
        database_url="postgresql+asyncpg://u:p@db.supabase.co:5432/postgres",
        app_env="development",
        testing=False,
        database_pool_size=15,
        database_max_overflow=5,
    )

    with (
        patch.object(session_module, "settings", pinned),
        patch("src.db.session.create_async_engine") as mock_create,
    ):
        session_module.create_engine()

    args, kwargs = mock_create.call_args

    # --- pool_pre_ping kept (PERF-10-04 'KEEP' verdict) ---
    assert kwargs["pool_pre_ping"] is True, "pool_pre_ping must stay True"

    # --- Still SESSION mode: NO asyncpg prepared-statement-cache override. The only
    #     reason to disable the asyncpg statement cache is a transaction-mode
    #     migration; its presence is a tell-tale that tx-mode was silently adopted.
    #     asyncpg/SQLAlchemy accept TWO spellings for this knob — forbid both so a
    #     synonym can't slip the guard. ---
    connect_args = kwargs["connect_args"]
    for cache_knob in ("statement_cache_size", "prepared_statement_cache_size"):
        assert cache_knob not in connect_args, (
            f"{cache_knob} in connect_args signals a transaction-mode flip "
            "(tx-mode requires the asyncpg statement cache disabled); "
            "session mode must not set it"
        )

    # --- DB URL is the engine target; assert it is NOT Supavisor transaction-mode
    #     port 6543. create_async_engine is called with the URL as its first
    #     positional arg. ---
    port = make_url(args[0]).port
    assert port != 6543, (
        f"engine URL port {port} is Supavisor transaction-mode (6543); "
        "PERF-10-04 keeps session mode (5432)"
    )
    assert port == 5432, f"expected Supavisor session-mode port 5432, got {port}"
