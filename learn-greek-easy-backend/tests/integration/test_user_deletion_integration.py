"""Integration tests for DELETE /api/v1/users/me (account deletion).

The first integration coverage this endpoint has ever had (PAY-05-04,
task-1318). Stripe is mocked throughout -- the real-Stripe half is
PAY-05-06. These tests exist to prove, against a REAL database (not mocked
repositories/sessions), the two durability guarantees that only a real
commit/rollback boundary can demonstrate:

- AC3: a Stripe cancel failure must leave the user row AND their progress
  data durably intact -- nothing partially destroyed.
- AC5: a post-commit Supabase failure must NOT undo the already-committed
  local deletion -- the row must be durably gone, with a 204 (not 500).

All four tests drive the endpoint through real_commit_authed_client
(tests/integration/conftest.py), which seeds a real User on
real_commit_session and commits the seed so the request -- routed through
the SAME connection via a get_db override that mirrors production commit/
rollback semantics -- can see it. Every durability assertion below re-reads
via a fresh `select()` on real_commit_session rather than touching an
in-Python attribute on the object we mutated earlier: a `select()` always
issues a real SQL query (unlike `session.get()`, which can short-circuit
via the identity map), so it reflects whatever the request actually
committed or rolled back -- not what we assume happened. Because
real_commit_session's outer transaction is never committed (only
SAVEPOINTs are released/rolled back within it, via join_transaction_mode),
these fresh selects see everything released within THIS test's sandbox
without ever touching the real database outside of it -- the exact same
"fresh SELECT" pattern already proven in
test_webhook_integration.py's real_commit_client tests.

No local Postgres is available in this environment (the project forbids
standing one up) -- these tests are collection-checked locally
(`pytest --collect-only`) but have never been RUN locally. CI's
`Backend Tests` job is the first place any of them execute for real.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import stripe
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import SupabaseAdminError
from src.db.models import SubscriptionStatus, SubscriptionTier, User, XPTransaction
from tests.factories.xp_achievements import XPTransactionFactory

DELETE_URL = "/api/v1/users/me"


@pytest.mark.integration
@pytest.mark.stripe
class TestUserDeletionIntegration:
    """Integration tests for account deletion against a real database."""

    @pytest.mark.asyncio
    async def test_delete_with_active_sub_cancels_then_deletes(
        self,
        real_commit_authed_client: tuple[AsyncClient, User],
        real_commit_session: AsyncSession,
    ):
        """AC7/AC1: an ACTIVE Stripe subscription is canceled via
        cancel_async, THEN the user row is durably deleted -- 204, and a
        fresh SELECT finds no row.

        THE VACUITY TRAP: CI's Backend Tests job sets no STRIPE_SECRET_KEY,
        so an unpatched `is_stripe_configured()` returns False, and
        `_cancel_stripe_subscription_before_deletion`'s guard short-circuits
        on that BEFORE ever calling `get_stripe_client()` -- cancel_async
        would never fire regardless of stripe_subscription_id, and this
        test would still get a 204 with the row gone (deletion doesn't
        depend on Stripe succeeding when it's "not configured"). That
        would make the test pass while proving NOTHING about the
        cancel-then-delete ordering it claims to cover. Patching
        `is_stripe_configured` AND `get_stripe_client` TOGETHER closes that
        gap, and `cancel_async.assert_awaited_once_with("sub_123")` is the
        assertion that would actually fail if either patch were dropped or
        the guard regressed.
        """
        client, user = real_commit_authed_client
        user.subscription_tier = SubscriptionTier.PREMIUM
        user.subscription_status = SubscriptionStatus.ACTIVE
        user.stripe_customer_id = "cus_456"
        user.stripe_subscription_id = "sub_123"
        await real_commit_session.commit()
        user_id = user.id

        mock_stripe_client = MagicMock()
        mock_stripe_client.v1.subscriptions.cancel_async = AsyncMock()

        with (
            patch(
                "src.services.user_deletion_service.is_stripe_configured",
                return_value=True,
            ),
            patch(
                "src.services.user_deletion_service.get_stripe_client",
                return_value=mock_stripe_client,
            ),
        ):
            response = await client.delete(DELETE_URL)

        assert response.status_code == 204
        mock_stripe_client.v1.subscriptions.cancel_async.assert_awaited_once_with("sub_123")

        # Fresh SELECT (not a read on the `user` object mutated above) --
        # proves the DELETE reached Postgres, not just that the Python
        # object looks deleted.
        fresh_user = await real_commit_session.scalar(select(User).where(User.id == user_id))
        assert fresh_user is None

    @pytest.mark.asyncio
    async def test_stripe_failure_leaves_user_durably_intact(
        self,
        real_commit_authed_client: tuple[AsyncClient, User],
        real_commit_session: AsyncSession,
    ):
        """AC3: a Stripe cancel failure (APIConnectionError -- a StripeError
        that is NOT the idempotency-carve-out InvalidRequestError) fails
        closed: 500, and the user row AND its progress rows (an
        XPTransaction here, the FK-free minimal category
        UserProgressResetService touches) are STILL there via a fresh
        SELECT -- nothing was partially destroyed.

        Vacuity guard: the same trap as the test above, mirrored. Without
        patching `is_stripe_configured` True (CI has no STRIPE_SECRET_KEY),
        cancel_async is never invoked, no exception is raised, and deletion
        proceeds to completion -- 204, row and progress GONE -- the exact
        opposite of what this test asserts. That makes the patch
        load-bearing for reaching a correct 500 at all, not merely
        cosmetic. We additionally assert cancel_async WAS awaited with
        "sub_123" so a 500 from some unrelated bug can't be mistaken for
        this specific fail-closed path.
        """
        client, user = real_commit_authed_client
        user.subscription_tier = SubscriptionTier.PREMIUM
        user.subscription_status = SubscriptionStatus.ACTIVE
        user.stripe_customer_id = "cus_456"
        user.stripe_subscription_id = "sub_123"
        await real_commit_session.commit()
        user_id = user.id

        xp_txn = await XPTransactionFactory.create(session=real_commit_session, user_id=user_id)
        await real_commit_session.commit()
        xp_txn_id = xp_txn.id

        mock_stripe_client = MagicMock()
        mock_stripe_client.v1.subscriptions.cancel_async = AsyncMock(
            side_effect=stripe.APIConnectionError("Connection to Stripe failed")
        )

        with (
            patch(
                "src.services.user_deletion_service.is_stripe_configured",
                return_value=True,
            ),
            patch(
                "src.services.user_deletion_service.get_stripe_client",
                return_value=mock_stripe_client,
            ),
        ):
            response = await client.delete(DELETE_URL)

        assert response.status_code == 500
        mock_stripe_client.v1.subscriptions.cancel_async.assert_awaited_once_with("sub_123")

        fresh_user = await real_commit_session.scalar(select(User).where(User.id == user_id))
        assert fresh_user is not None

        fresh_xp_txn = await real_commit_session.scalar(
            select(XPTransaction).where(XPTransaction.id == xp_txn_id)
        )
        assert fresh_xp_txn is not None

    @pytest.mark.asyncio
    async def test_supabase_failure_leaves_user_durably_deleted(
        self,
        real_commit_authed_client: tuple[AsyncClient, User],
        real_commit_session: AsyncSession,
    ):
        """AC5: a Supabase admin failure during the POST-commit cleanup
        step must NOT undo the already-committed local deletion -- 204
        (not 500), and a fresh SELECT finds no user row.

        Vacuity guard, mirror-image of the Stripe trap above:
        `UserFactory` always assigns a random `supabase_id`
        (tests/factories/auth.py), so `delete_account`'s `if supabase_id:`
        branch is always entered -- but if `get_supabase_admin_client`
        were left UNPATCHED, the real (unconfigured-in-tests) client would
        be None, the whole Supabase branch would be skipped, and
        `delete_user` would never be called at all. A 204-with-row-gone
        result in THAT case would look identical to this test's expected
        outcome while proving nothing about "failure is tolerated" -- it
        would just be "never attempted." We patch
        `get_supabase_admin_client` to return a client whose `delete_user`
        raises `SupabaseAdminError`, and assert `delete_user` WAS awaited
        with the seeded user's `supabase_id` -- that assertion is what
        makes the 204 meaningful.

        `stripe_subscription_id` is left at the fixture's default (None,
        TRIALING) so `_cancel_stripe_subscription_before_deletion`'s guard
        short-circuits on `stripe_subscription_id is None` before ever
        consulting `is_stripe_configured()` -- no Stripe patch is needed
        to isolate this test to the Supabase failure path.
        """
        client, user = real_commit_authed_client
        supabase_id = user.supabase_id
        user_id = user.id
        assert user.stripe_subscription_id is None  # isolates this to the Supabase path

        mock_supabase_client = MagicMock()
        mock_supabase_client.delete_user = AsyncMock(
            side_effect=SupabaseAdminError("Failed to delete user from Supabase")
        )

        with patch(
            "src.services.user_deletion_service.get_supabase_admin_client",
            return_value=mock_supabase_client,
        ):
            response = await client.delete(DELETE_URL)

        assert response.status_code == 204
        mock_supabase_client.delete_user.assert_awaited_once_with(supabase_id)

        fresh_user = await real_commit_session.scalar(select(User).where(User.id == user_id))
        assert fresh_user is None

    @pytest.mark.asyncio
    async def test_delete_free_user_no_stripe_call(
        self,
        real_commit_authed_client: tuple[AsyncClient, User],
        real_commit_session: AsyncSession,
    ):
        """AC2: a free/TRIALING user with no stripe_subscription_id (the
        fixture's own default seed -- no mutation needed) never calls
        Stripe at all, and the row is durably gone: 204, cancel_async
        never awaited, fresh SELECT finds no row.

        Vacuity guard: the inverse risk from the two tests above. An
        UNPATCHED `is_stripe_configured()` (False in CI) would make
        "cancel_async never awaited" trivially true for the WRONG reason --
        the guard would never even get far enough to inspect
        stripe_subscription_id. We patch `is_stripe_configured` True and
        hand it a fully working `cancel_async` mock, so the ONLY reason it
        stays un-awaited is the real guard rejecting on
        `stripe_subscription_id is None` -- the same mutation-tested
        pattern the PAY-05-02 unit tests (`test_no_sub_id_skips_stripe`)
        use to prove this isn't a status allowlist in disguise.
        """
        client, user = real_commit_authed_client
        user_id = user.id
        assert user.stripe_subscription_id is None
        assert user.subscription_status == SubscriptionStatus.TRIALING

        mock_stripe_client = MagicMock()
        mock_stripe_client.v1.subscriptions.cancel_async = AsyncMock()

        with (
            patch(
                "src.services.user_deletion_service.is_stripe_configured",
                return_value=True,
            ),
            patch(
                "src.services.user_deletion_service.get_stripe_client",
                return_value=mock_stripe_client,
            ),
        ):
            response = await client.delete(DELETE_URL)

        assert response.status_code == 204
        mock_stripe_client.v1.subscriptions.cancel_async.assert_not_awaited()

        fresh_user = await real_commit_session.scalar(select(User).where(User.id == user_id))
        assert fresh_user is None


# =============================================================================
# AC7/AC1 (Test Specs row 5): test_webhook_integration_still_passes_on_shared_fixtures
# =============================================================================
#
# This row has no corresponding function in THIS file -- its file column in
# the architect's Test Specs table is tests/integration/test_webhook_integration.py,
# and it names an outcome (the existing webhook integration tests still pass,
# unmodified, once real_commit_session/real_commit_client are promoted to
# conftest.py), not a new assertion to write. There is nothing to add here:
# the promotion is mechanically a pure move (fixture resolution is
# name-based -- see the comment left at the top of test_webhook_integration.py
# where the fixtures used to be). Whether it actually still passes is
# provable only by running the suite -- there is no local Postgres in this
# environment, so this is verified in CI, not here.
