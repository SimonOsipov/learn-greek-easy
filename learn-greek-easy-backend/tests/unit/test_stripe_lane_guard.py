"""Meta-tests for the stripe_live lane's hard-fail credential guard (PAY-05-05).

These tests exercise the guard's *logic*, which is pure (no network, no pytest
fixture machinery) -- that is exactly what lets them run in the main suite,
marked `unit`, with no STRIPE_SECRET_KEY present (there is none in CI's main
`test.yml` job env, and none locally).

The whole `stripe_live` lane exists to replace a *silent skip*:
`tests/integration/test_stripe_integration.py` has skipped its Stripe
connectivity check in every CI run since it was written, because the main
suite never sets STRIPE_SECRET_KEY. This file's job is to pin that the
replacement guard fails loudly (`pytest.fail` -> `Failed`) instead of
quietly (`pytest.skip` -> `Skipped`) -- those two pytest outcome exceptions
are disjoint (`Failed`/`Skipped` both subclass `BaseException` directly, not
`Exception`, and neither subclasses the other; confirmed empirically against
pytest 9.1.1 during PAY-05-05 Stage 1 validation), so asserting the wrong one
would make these tests worthless.

Expected guard shape (this subtask does NOT implement it -- PAY-05-05's
executor does):

    # tests/integration/stripe_lane/guard.py
    def assert_stripe_test_key() -> None:
        '''Raise pytest.fail() unless STRIPE_SECRET_KEY is a configured
        sk_test_ key. Never raises pytest.skip().'''

Called from an autouse fixture in a NEW `tests/integration/stripe_lane/conftest.py`
(never the shared `tests/integration/conftest.py` -- that fires for all ~700
existing integration tests). Assumed to read `os.getenv("STRIPE_SECRET_KEY")`
directly (mirroring the legacy skipif's own check), which is what lets
`monkeypatch.setenv`/`delenv` in these tests reach it.

RED today for two different reasons -- see the per-test docstrings:
  - test_guard_fails_when_key_missing / _empty_string / _on_live_key / _passes_on_test_key:
    RED via ImportError (the guard module does not exist yet), converted by
    `_import_guard()` below into an explicit `pytest.fail()` so the whole file
    still collects and the two tests below run as clean, independent reds.
  - test_no_skipif_remains_in_stripe_tests / test_stripe_live_marker_is_registered:
    RED via genuine assertion failure against the current repo state.
"""

import subprocess
import sys
import tomllib
from pathlib import Path
from typing import Callable

import pytest

_BACKEND_ROOT = Path(__file__).parents[2]  # learn-greek-easy-backend/


def _import_guard() -> Callable[[], None]:
    """Import the guard's plain, pytest-fixture-independent callable.

    Import happens lazily (inside a test, not at module scope) so a missing
    guard module fails only the four tests that need it -- not the whole
    file's collection, which would also swallow the two clean, independent
    reds (`test_no_skipif_remains_in_stripe_tests`,
    `test_stripe_live_marker_is_registered`) below.
    """
    try:
        from tests.integration.stripe_lane.guard import (  # type: ignore[import-not-found]
            assert_stripe_test_key,
        )
    except ImportError as exc:
        pytest.fail(
            "tests.integration.stripe_lane.guard.assert_stripe_test_key not found "
            f"({exc}) -- expected until the PAY-05-05 executor implements the guard "
            "module. This is an ImportError-flavoured red, not an assertion failure."
        )
    return assert_stripe_test_key


def _run_guard_expect_failed(guard: Callable[[], None]) -> str:
    """Call guard(), asserting it raises pytest.fail's `Failed` -- and NOT
    pytest.skip's `Skipped`. Returns the failure message on success.

    Deliberately catches BaseException, not Exception: `Failed`/`Skipped` both
    subclass BaseException directly (confirmed empirically), so a bare
    `except Exception` would let a wrongly-raised `Skipped` escape this helper
    uncaught. pytest's runner treats an escaped `Skipped` as marking the
    *calling test* SKIPPED rather than FAILED -- which would silently hide the
    exact anti-silent-skip bug this test file exists to catch.
    """
    try:
        guard()
    except BaseException as exc:  # noqa: BLE001 -- see docstring: must catch Skipped too
        assert isinstance(exc, pytest.fail.Exception), (
            "expected guard() to raise pytest.fail's Failed, got " f"{type(exc).__name__}: {exc}"
        )
        return str(exc)
    else:
        pytest.fail("guard() did not raise; expected it to fail")


@pytest.mark.unit
def test_guard_fails_when_key_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    """STRIPE_SECRET_KEY unset -> guard raises Failed, not Skipped.

    This is *the* anti-silent-skip assertion: the guard exists specifically to
    stop the lane from doing what test_stripe_integration.py has always done --
    quietly skip when no key is present.
    """
    guard = _import_guard()
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)

    _run_guard_expect_failed(guard)


@pytest.mark.unit
def test_guard_fails_when_key_empty_string(monkeypatch: pytest.MonkeyPatch) -> None:
    """STRIPE_SECRET_KEY="" -> guard raises Failed (empty is not "configured")."""
    guard = _import_guard()
    monkeypatch.setenv("STRIPE_SECRET_KEY", "")

    _run_guard_expect_failed(guard)


@pytest.mark.unit
def test_guard_fails_on_live_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """STRIPE_SECRET_KEY=sk_live_abc -> guard raises Failed and names the refusal.

    This is the blast-radius guard: it is what stops the lane ever transacting
    against the real Stripe account.
    """
    guard = _import_guard()
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_live_abc")

    message = _run_guard_expect_failed(guard)

    assert (
        "live" in message.lower()
    ), f"failure message must name the live-key refusal, got: {message!r}"


@pytest.mark.unit
def test_guard_passes_on_test_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """STRIPE_SECRET_KEY=sk_test_abc -> guard returns normally (no exception)."""
    guard = _import_guard()
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_abc")

    try:
        guard()
    except BaseException as exc:  # noqa: BLE001 -- must not accidentally SKIP this test
        pytest.fail(
            "expected guard() to return normally for a valid sk_test_ key, "
            f"but it raised {type(exc).__name__}: {exc}"
        )


def _has_stripe_key_skipif(source: str) -> bool:
    """True if `source` contains a `skipif(...)` call referencing STRIPE_SECRET_KEY.

    Scans a fixed-size window after each `skipif(` occurrence rather than a single
    strict regex, so it survives reasonable reformatting of the decorator's
    arguments (multi-line, reordered kwargs, etc.).
    """
    marker = "skipif"
    start = 0
    while True:
        idx = source.find(marker, start)
        if idx == -1:
            return False
        window = source[idx : idx + 300]
        if "STRIPE_SECRET_KEY" in window:
            return True
        start = idx + len(marker)


@pytest.mark.unit
def test_no_skipif_remains_in_stripe_tests() -> None:
    """Pins [stripe-lane-legacy-skipif]: no skipif referencing STRIPE_SECRET_KEY
    remains anywhere in the stripe test surface.

    RED today: tests/integration/test_stripe_integration.py:27-30 has exactly
    this skipif, decorating a class currently marked `@pytest.mark.stripe`
    (mocked-lane marker) at line 25. PAY-05-05's own scope was expanded (Stage 1
    validation) to strip this skipif and reclassify that class's marker to
    `stripe_live` in the SAME PR that introduces this test -- otherwise this
    test is RED at its own subtask's merge, not just today.

    Also checks any file under tests/integration/stripe_lane/ (the new lane
    directory), if it exists yet, so a future stripe_live test file can't
    reintroduce the same silent-skip trap.
    """
    candidates = [_BACKEND_ROOT / "tests" / "integration" / "test_stripe_integration.py"]

    lane_dir = _BACKEND_ROOT / "tests" / "integration" / "stripe_lane"
    if lane_dir.is_dir():
        candidates.extend(sorted(lane_dir.rglob("*.py")))

    offenders = []
    for path in candidates:
        if not path.is_file():
            continue
        source = path.read_text(encoding="utf-8")
        if _has_stripe_key_skipif(source):
            offenders.append(str(path.relative_to(_BACKEND_ROOT)))

    assert offenders == [], (
        f"Found a skipif referencing STRIPE_SECRET_KEY in {len(offenders)} file(s) -- "
        "this reintroduces the silent-skip trap the stripe_live lane guard exists to "
        "close:\n" + "\n".join(f"  {f}" for f in offenders)
    )


@pytest.mark.unit
def test_stripe_live_marker_is_registered() -> None:
    """`stripe_live` is registered in pyproject.toml markers, distinct from `stripe`.

    RED today: pyproject.toml:212-233 has 23 registered markers including
    `stripe` (:223, mocked-lane) but no `stripe_live`. Because `--strict-markers`
    is set (:195), an unregistered marker aborts COLLECTION for the entire test
    run the instant any test uses it (empirically confirmed during Stage 1
    validation: "Interrupted: 1 error during collection") -- not just the guard,
    and not just the offending test. This must be registered before PAY-05-06
    can mark a single test `stripe_live`.
    """
    pyproject_path = _BACKEND_ROOT / "pyproject.toml"
    with pyproject_path.open("rb") as fh:
        config = tomllib.load(fh)

    markers = config["tool"]["pytest"]["ini_options"]["markers"]
    marker_names = {entry.split(":", 1)[0].strip() for entry in markers}

    assert "stripe" in marker_names, "sanity: the existing mocked-lane marker must still exist"
    assert "stripe_live" in marker_names, (
        "stripe_live marker is not registered in pyproject.toml "
        "[tool.pytest.ini_options].markers -- any @pytest.mark.stripe_live usage will "
        "abort collection for the ENTIRE test run under --strict-markers"
    )


@pytest.mark.unit
def test_pyproject_addopts_deselects_stripe_live_by_default() -> None:
    """Pins the addopts-level default added in PAY-05-05's second commit
    (`fix(PAY-05-05): default-deselect stripe_live in pyproject addopts, not
    just CI`): `-m "not stripe_live"` must be present in
    `[tool.pytest.ini_options].addopts` as two adjacent list entries (`-m`,
    then `not stripe_live`), so a bare/path-scoped local invocation (no `-m`
    flag at all -- the shape of every documented dev command in
    CLAUDE.md/docs/testing.md) never reaches the stripe_live_guard's
    hard-fail just because a developer has no STRIPE_SECRET_KEY configured.

    Cheap, non-subprocess regression pin, complementary to
    test_cli_marker_expression_replaces_addopts_default below (which proves
    the runtime *behavior* this config enables; this one guards the config
    itself from silently drifting, e.g. someone reordering or removing the
    two-entry pair while editing addopts for an unrelated reason).
    """
    pyproject_path = _BACKEND_ROOT / "pyproject.toml"
    with pyproject_path.open("rb") as fh:
        config = tomllib.load(fh)

    addopts = config["tool"]["pytest"]["ini_options"]["addopts"]

    pairs = list(zip(addopts, addopts[1:]))
    assert ("-m", "not stripe_live") in pairs, (
        "expected addopts to contain '-m' immediately followed by "
        "'not stripe_live' -- got addopts=" + repr(addopts)
    )


@pytest.mark.unit
def test_cli_marker_expression_replaces_addopts_default() -> None:
    """Empirically pins the single most fracture-prone assumption in the
    whole stripe_live lane: an explicit CLI `-m` expression REPLACES
    pyproject.toml's addopts `-m "not stripe_live"` default -- it does NOT
    AND with it.

    Why this matters: PAY-05-06's CI job runs `pytest -m stripe_live
    --no-cov -v`. If a future pytest version (or some other addopts change)
    made a CLI `-m` combine with the addopts default instead of replacing
    it, that invocation would silently evaluate to
    `stripe_live AND not stripe_live` -- always false -- and collect ZERO
    tests. Pytest's own "no tests collected" is exit code 5, which --
    unless a CI step explicitly greps for it -- reads as a green, vacuous
    PASS: exactly the silent-pass failure mode the stripe_live lane exists
    to prevent (verified during PAY-05-05 QA Stage 4 by actually invoking
    pytest as a subprocess, not just reading config, against the one real
    stripe_live-marked test in the repo, in both directions).

    Subprocess, not in-process pytest.main(), so this file's own pytest
    config/plugins/coverage instrumentation can't leak into the child
    invocation being measured.
    """
    target = "tests/integration/test_stripe_integration.py"
    common_args = [
        sys.executable,
        "-m",
        "pytest",
        target,
        "--collect-only",
        "-q",
        "--no-cov",
    ]

    bare = subprocess.run(
        common_args,
        cwd=_BACKEND_ROOT,
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    assert "no tests collected (1 deselected)" in bare.stdout, (
        "expected the addopts default alone (no -m flag at all) to deselect "
        f"the one stripe_live test in {target}; got stdout tail:\n{bare.stdout[-1500:]}"
    )

    explicit = subprocess.run(
        [*common_args[:4], "-m", "stripe_live", *common_args[4:]],
        cwd=_BACKEND_ROOT,
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    assert "1 test collected" in explicit.stdout, (
        "expected explicit CLI `-m stripe_live` to REPLACE (not AND with) the "
        "addopts default and select the test. If this now shows 0 selected / "
        "no tests collected, PAY-05-06's CI job would collect zero tests and "
        f"pass vacuously -- got stdout tail:\n{explicit.stdout[-1500:]}"
    )
    assert "no tests collected" not in explicit.stdout, (
        "the explicit -m stripe_live invocation must NOT report 'no tests "
        f"collected' -- got stdout tail:\n{explicit.stdout[-1500:]}"
    )
