"""Hard-fail credential guard for the `stripe_live` test lane (PAY-05-05).

The `stripe_live` marker exists to run a handful of integration tests
against a REAL Stripe test-mode account (never mocked). Those tests are
deselected from the main CI suite (`-m "not stripe_live"` in
`.github/workflows/test.yml`) and instead run in a separate CI job
(PAY-05-06) that provides `STRIPE_SECRET_KEY`.

This module's job is to make misconfiguration LOUD. Before this lane
existed, `tests/integration/test_stripe_integration.py` used a conditional
skip decorator that silently skipped whenever the Stripe credential env var
was absent -- which meant its Stripe connectivity check had never actually
executed in CI. `assert_stripe_test_key` replaces that silent skip with
`pytest.fail()`: missing, empty, or non-test-mode credentials fail the test
loudly instead of quietly skipping it. It never raises `pytest.skip()`.
"""

import os

import pytest

_TEST_KEY_PREFIX = "sk_test_"
_LIVE_KEY_PREFIX = "sk_live_"


def assert_stripe_test_key() -> None:
    """Raise `pytest.fail()` unless `STRIPE_SECRET_KEY` is a configured
    `sk_test_` key. Never raises `pytest.skip()`.

    Reads `os.getenv("STRIPE_SECRET_KEY")` directly rather than the cached
    `settings` singleton (`src.config.settings`), so tests can exercise this
    guard with `monkeypatch.setenv`/`delenv` without needing to reload
    settings.
    """
    key = os.getenv("STRIPE_SECRET_KEY")

    if not key:
        pytest.fail(
            "STRIPE_SECRET_KEY is not set (or empty) -- the stripe_live lane "
            "requires a configured Stripe test-mode secret key and refuses to "
            "silently skip. Set STRIPE_SECRET_KEY to a sk_test_ key to run "
            "this lane."
        )

    if not key.startswith(_TEST_KEY_PREFIX):
        if key.startswith(_LIVE_KEY_PREFIX):
            pytest.fail(
                "STRIPE_SECRET_KEY is a live key (starts with 'sk_live_') -- "
                "the stripe_live lane refuses to transact against the real "
                "Stripe account. Use a sk_test_ key."
            )
        pytest.fail(
            "STRIPE_SECRET_KEY does not look like a Stripe test-mode key "
            "(expected it to start with 'sk_test_'). Refusing to run the "
            "stripe_live lane with an unrecognized key format."
        )
