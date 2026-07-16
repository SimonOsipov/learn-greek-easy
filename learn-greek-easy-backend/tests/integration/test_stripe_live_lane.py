"""Integration tests for the real Stripe test-mode cancellation lifecycle
(PAY-05-06, task-1320) -- the FINAL PAY-05 subtask and the done-gate for the
whole story.

Everything else in PAY-05 (the cancel-before-delete ordering, the
[idempotency] non-blocking InvalidRequestError branch, the [no-refund-params]
bare cancel_async() call) was proven with a MOCKED Stripe client
(test_user_deletion_integration.py, PAY-05-04). This file is the one place
in the whole story that proves those same behaviors against a REAL Stripe
test-mode account -- the Build Plan's "test-mode verification shows the
subscription cancelled", automated.

Structural opposite of PAY-05-04's vacuity trap: there, an unpatched
`is_stripe_configured()`/`get_stripe_client()` would return False/raise
because CI's main `backend-tests` job sets no STRIPE_SECRET_KEY, so the
mocks were load-bearing. HERE, in the separate `stripe-live-tests` CI job,
`STRIPE_SECRET_KEY` (a real `sk_test_` key) is present in the job's `env:`
BEFORE pytest starts, so `Settings()` (module-level `@lru_cache` in
src/config.py) reads it correctly at first import -- `is_stripe_configured()`
and `get_stripe_client()` need NO patching here, and patching them would
defeat the entire point of this file. Nothing in this file mocks Stripe.

No local Postgres AND no local STRIPE_SECRET_KEY are available in this
development environment (the project forbids standing up a local Postgres,
and the Stripe test-mode key lives only in GitHub Actions secrets) -- these
tests are collection-checked locally (`pytest --collect-only -m stripe_live`)
but have NEVER been RUN locally. CI's new `stripe-live-tests` job
(PAY-05-06's own CI-config half, not built in this file) is the first place
any of them execute for real, against the real Stripe test-mode account.

Every test below carries `@pytest.mark.stripe_live` (via the class-level
marker): that marker is both what makes `stripe_live_guard`
(tests/integration/conftest.py) hard-fail instead of silently no-op'ing, and
what the main suite's `-m "not stripe_live"` addopts default (pyproject.toml)
relies on to deselect these tests everywhere except the dedicated CI job. A
test that forgot the marker would run in the main suite with no
STRIPE_SECRET_KEY configured and break `main`.
"""

import pytest
import stripe
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.stripe import get_stripe_client
from src.db.models import SubscriptionStatus, SubscriptionTier, User

DELETE_URL = "/api/v1/users/me"


@pytest.mark.integration
@pytest.mark.stripe_live
@pytest.mark.asyncio
class TestStripeLiveCancellationLifecycle:
    """Real-Stripe coverage for AC1/AC2/AC7/AC8 -- never mocked."""

    async def test_real_sub_is_canceled_by_account_deletion(
        self,
        real_commit_authed_client: tuple[AsyncClient, User],
        real_commit_session: AsyncSession,
        stripe_test_subscription: stripe.Subscription,
    ):
        """AC1/AC7/AC8 -- THE done-gate. A real, `active` test-mode
        subscription is attached to a real DB-backed user, the user hits
        DELETE /api/v1/users/me (real get_db boundary, real Stripe --
        cancel_async is NOT mocked), and reading the subscription back FROM
        STRIPE (not our DB, not a webhook -- AC7's exact distinction)
        confirms `status == "canceled"`.

        `cancel_at_period_end is False` is the second assertion, not a
        throwaway: it is the concrete difference between an immediate
        cancel (what `[no-refund-params]`'s bare `cancel_async(sub_id)`
        call produces) and a scheduled cancel-at-period-end (what a future
        `cancel_at_period_end=True` would produce instead) -- the exact
        distinction AC1 draws between "cancelled" and "will cancel later".
        A regression to scheduled cancellation would NOT be caught by the
        first assertion alone: Stripe keeps a `cancel_at_period_end=True`
        subscription in `status == "active"` until the period actually
        ends, so that regression would fail the FIRST assertion (`status`
        would still read `"active"`, not `"canceled"`) rather than slip
        past it -- but asserting `cancel_at_period_end is False` directly,
        rather than only inferring it from `status`, pins the exact field
        AC1's "immediate, not scheduled" distinction is about, instead of
        relying on a side effect of it.

        Vacuity check: could this pass without the behaviour being real?
        - If STRIPE_SECRET_KEY were missing/misconfigured, `stripe_live_guard`
          (autouse, marker-gated) hard-fails via `assert_stripe_test_key()`
          before this test body even runs -- no silent pass path.
        - If `get_stripe_client()` were somehow unconfigured at call time
          it raises `RuntimeError`, not a swallowed False -- loud, not
          silent.
        - The sub was created `active` by `stripe_test_subscription`
          (pm_card_visa already set as default payment method, no
          `payment_behavior="default_incomplete"`) and nothing else in this
          test's own body cancels it before the DELETE request -- so a
          `status == "canceled"` read-back can only be explained by the
          DELETE request's own cancel_async call, not by an
          already-canceled starting state.
        """
        client, user = real_commit_authed_client
        user.stripe_customer_id = stripe_test_subscription.customer
        user.stripe_subscription_id = stripe_test_subscription.id
        user.subscription_status = SubscriptionStatus.ACTIVE
        user.subscription_tier = SubscriptionTier.PREMIUM
        await real_commit_session.commit()

        assert stripe_test_subscription.status == "active"  # pre-condition, not the assertion

        response = await client.delete(DELETE_URL)
        assert response.status_code == 204

        stripe_client = get_stripe_client()
        sub = await stripe_client.v1.subscriptions.retrieve_async(stripe_test_subscription.id)
        assert sub.status == "canceled"
        assert sub.cancel_at_period_end is False

    async def test_real_cancel_issues_no_refund(
        self,
        real_commit_authed_client: tuple[AsyncClient, User],
        real_commit_session: AsyncSession,
        stripe_test_subscription: stripe.Subscription,
    ):
        """AC1 -- pins `[no-refund-params]`: cancelling with no params
        (neither `prorate` nor `invoice_now`, both default `False` in the
        installed SDK -- verified directly against
        stripe/params/_subscription_cancel_params.py in the installed
        15.3.0 package) issues no proration credit / refund invoice item.
        This test would fail if a future executor added `prorate=True` (or
        `invoice_now=True`) to the cancel call in
        `_cancel_stripe_subscription_before_deletion`.

        Assertion mechanism: an absolute "zero invoice items ever" check
        would be WRONG -- normal subscription billing can generate invoice
        items unrelated to cancellation. Instead this snapshots the
        customer's `invoice_items` count immediately before driving the
        DELETE request and asserts the count is UNCHANGED immediately
        after -- a delta of zero specifically across the cancel action,
        which is what `prorate=True` would have violated (it creates a NEW
        invoice item crediting unused time).

        Vacuity check: could this pass without the behaviour being real?
        - If cancel_async were never invoked at all (e.g. the guard
          short-circuited on a wrong condition), the delta would trivially
          be zero for the WRONG reason. Guarded against by reusing the same
          real_commit_authed_client + stripe_test_subscription seeding as
          the sibling test above, which independently proves cancel_async
          fires (status flips to "canceled") -- this test's 204 assertion
          on the SAME request path confirms the same code ran here.
        - If no invoice existed at all, "count unchanged" would be
          vacuously true regardless of prorate behaviour -- addressed by
          asserting on a DELTA rather than an absolute count, so the test
          is agnostic to whether the baseline is 0 or nonzero; what it
          cannot tolerate is the count going UP, which is exactly what
          `prorate=True`/`invoice_now=True` would do.
        """
        client, user = real_commit_authed_client
        user.stripe_customer_id = stripe_test_subscription.customer
        user.stripe_subscription_id = stripe_test_subscription.id
        user.subscription_status = SubscriptionStatus.ACTIVE
        user.subscription_tier = SubscriptionTier.PREMIUM
        await real_commit_session.commit()

        stripe_client = get_stripe_client()
        customer_id = stripe_test_subscription.customer

        before = await stripe_client.v1.invoice_items.list_async(params={"customer": customer_id})
        before_count = len(before.data)

        response = await client.delete(DELETE_URL)
        assert response.status_code == 204

        after = await stripe_client.v1.invoice_items.list_async(params={"customer": customer_id})
        after_count = len(after.data)

        assert after_count == before_count

    async def test_cancel_already_canceled_sub_raises_invalid_request(
        self,
        stripe_test_subscription: stripe.Subscription,
    ):
        """AC2 -- empirically resolves `[stripe-error-shape-unverified]`,
        which until now was only an assumption in
        `_cancel_stripe_subscription_before_deletion`'s `except
        stripe.InvalidRequestError` branch (`[idempotency]`), never proven
        against a real Stripe response. Cancels a real, active subscription
        directly (no HTTP layer involved -- this test targets the Stripe
        SDK call itself, not the endpoint), then cancels the SAME
        subscription id again and asserts the raised exception IS an
        instance of `stripe.InvalidRequestError` -- pinning the exact
        exception class `[idempotency]`'s except-clause keys on.

        Vacuity check: could this pass without the behaviour being real?
        - If the first cancel_async call itself failed (network issue,
          misconfigured key), the test errors out on that call, before ever
          reaching `pytest.raises` -- not a false pass.
        - If Stripe silently no-op'd a second cancel on an already-canceled
          subscription (returned success instead of raising), `pytest.raises`
          would correctly fail this test -- there is no path by which "no
          exception raised" reads as a pass.
        - This is deliberately the FIRST time this exact call sequence
          (cancel -> cancel again) has ever executed against live Stripe in
          this codebase (Stage 1 validation's attempt to verify it via a
          scratch write against the sandbox account was correctly blocked
          by the permission system, precisely because a validation pass
          shouldn't mutate the shared sandbox) -- this test IS the first
          live proof, by design.
        """
        stripe_client = get_stripe_client()
        await stripe_client.v1.subscriptions.cancel_async(stripe_test_subscription.id)

        with pytest.raises(stripe.InvalidRequestError):
            await stripe_client.v1.subscriptions.cancel_async(stripe_test_subscription.id)

    async def test_delete_with_already_canceled_real_sub_still_deletes(
        self,
        real_commit_authed_client: tuple[AsyncClient, User],
        real_commit_session: AsyncSession,
        stripe_test_subscription: stripe.Subscription,
    ):
        """AC2 -- the missed-webhook case `[idempotency]` exists for,
        against real Stripe: the subscription is cancelled OUT OF BAND
        (directly via the SDK, simulating a webhook Stripe sent but our
        system never processed) while the user row is left stale --
        `subscription_status` still `ACTIVE`, `stripe_subscription_id`
        still pointing at the now-already-canceled subscription. Driving
        DELETE /api/v1/users/me must still succeed: 204, and the row is
        durably gone via a fresh SELECT (not a read on the mutated Python
        object -- the same "fresh SELECT" pattern
        test_user_deletion_integration.py already established).

        `subscription_status` is deliberately left at `ACTIVE`, NOT
        `CANCELED`: `_cancel_stripe_subscription_before_deletion`'s guard
        short-circuits early when `subscription_status ==
        SubscriptionStatus.CANCELED` (before ever calling Stripe at all) --
        setting it to `CANCELED` here would test the wrong branch (the
        early-return guard, already covered by
        test_user_deletion_service.py's unit tests) instead of the
        `except stripe.InvalidRequestError` branch this test targets. With
        `ACTIVE`, the guard proceeds to call `cancel_async` for real, hits
        the already-canceled subscription, and must catch the resulting
        `InvalidRequestError` rather than propagate it.

        Vacuity check: could this pass without the behaviour being real?
        - If `_cancel_stripe_subscription_before_deletion` regressed to
          propagate `stripe.InvalidRequestError` instead of catching it,
          the endpoint would 500 (caught by the outer try/except in
          `delete_account`, which returns `result.success = False`), NOT
          204 -- so this test's status-code assertion is NOT trivially
          satisfiable by a broken idempotency branch.
        - If the out-of-band cancel_async call above failed silently
          (e.g. wrong subscription id), the subsequent DELETE's own
          cancel_async call would succeed cleanly and the row would still
          end up deleted -- but that would prove nothing about the
          already-canceled path specifically. Guarded by the fact that this
          exact sequence (cancel once out of band, then drive the delete)
          is what `test_cancel_already_canceled_sub_raises_invalid_request`
          above independently proves raises `InvalidRequestError` on a
          second cancel -- the same subscription-id reuse pattern, so if
          the out-of-band cancel hadn't taken effect, that sibling test
          would already be failing.
        """
        stripe_client = get_stripe_client()
        await stripe_client.v1.subscriptions.cancel_async(stripe_test_subscription.id)

        client, user = real_commit_authed_client
        user.stripe_customer_id = stripe_test_subscription.customer
        user.stripe_subscription_id = stripe_test_subscription.id
        user.subscription_status = SubscriptionStatus.ACTIVE  # stale: Stripe already canceled it
        user.subscription_tier = SubscriptionTier.PREMIUM
        await real_commit_session.commit()
        user_id = user.id

        response = await client.delete(DELETE_URL)
        assert response.status_code == 204

        fresh_user = await real_commit_session.scalar(select(User).where(User.id == user_id))
        assert fresh_user is None


# =============================================================================
# AC8 (Test Specs row 5): test_stripe_api_connectivity
# =============================================================================
#
# This row has no corresponding function in THIS file. Its file column in
# the architect's Test Specs table is
# tests/integration/test_stripe_integration.py, naming a MIGRATION (skipif
# removed, class reclassified `stripe_live`) rather than a new assertion to
# author here. That migration was already completed by PAY-05-05, not this
# subtask -- confirmed by reading test_stripe_integration.py directly: its
# module docstring already states the lane rationale, its `skipif` decorator
# is already gone, and its class already carries
# `@pytest.mark.stripe_live` alongside `@pytest.mark.integration`. Adding a
# duplicate test here would violate this task's "don't duplicate" spec
# instruction. There is nothing to add.
