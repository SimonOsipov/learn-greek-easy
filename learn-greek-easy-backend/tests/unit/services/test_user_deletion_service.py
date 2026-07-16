"""Unit tests for UserDeletionService.

Tests cover:
- delete_account: Full account deletion flow
- Supabase deletion failure handling
- User without Supabase ID
- Database failure handling

These tests use mocked dependencies to verify the service
coordinates all deletion steps correctly.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
import stripe

from src.db.models import SubscriptionStatus
from src.services.user_deletion_service import DeletionResult, UserDeletionService


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    session = MagicMock()
    session.execute = AsyncMock()
    # PAY-05-01 [mock-session-fixture-prereq]: commit/rollback must be
    # AsyncMock, not auto-vivified MagicMock attributes -- delete_account()
    # is about to add `await self.db.commit()`, and `await` on a plain
    # MagicMock attribute raises TypeError.
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    return session


@pytest.fixture
def service(mock_db_session):
    """Create a UserDeletionService with mocked db session."""
    return UserDeletionService(mock_db_session)


@pytest.fixture
def mock_user():
    """Create a mock user object."""
    user = MagicMock()
    user.id = uuid4()
    user.supabase_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    # PAY-05-01 [mock-user-attr-landmine]: explicit safe defaults. Without
    # these, every other User attribute auto-vivifies as a truthy MagicMock,
    # which would silently fire Stripe/S3 guards (added in later PAY-05
    # subtasks) in tests that never opted in to exercising them.
    user.stripe_subscription_id = None
    user.stripe_customer_id = None
    user.subscription_status = SubscriptionStatus.NONE
    user.avatar_url = None
    return user


@pytest.mark.unit
class TestDeleteAccount:
    """Tests for UserDeletionService.delete_account method."""

    @pytest.mark.asyncio
    async def test_delete_success_full_flow(self, service, mock_user):
        """Test successful deletion of all data including Supabase."""
        user_id = mock_user.id
        supabase_id = mock_user.supabase_id

        # Mock reset service (returns a result object)
        mock_reset_result = MagicMock()
        mock_reset_result.total_deleted = 50
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)

        # Mock user repository
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        # Mock Supabase admin client
        with patch(
            "src.services.user_deletion_service.get_supabase_admin_client"
        ) as mock_get_client:
            mock_supabase_client = MagicMock()
            mock_supabase_client.delete_user = AsyncMock(return_value=True)
            mock_get_client.return_value = mock_supabase_client

            result = await service.delete_account(user_id, supabase_id)

        # Verify result
        assert result.success is True
        assert result.progress_deleted is True
        assert result.user_deleted is True
        assert result.supabase_deleted is True
        assert result.error_message is None

        # Verify all steps were called
        service.reset_service.reset_all_progress.assert_awaited_once_with(user_id)
        service.user_repository.get.assert_awaited_once_with(user_id)
        service.user_repository.delete.assert_awaited_once_with(mock_user)
        mock_supabase_client.delete_user.assert_awaited_once_with(supabase_id)

    @pytest.mark.asyncio
    async def test_delete_supabase_failure_still_succeeds(self, service, mock_user):
        """Test partial success when Supabase deletion fails."""
        user_id = mock_user.id
        supabase_id = mock_user.supabase_id

        # Mock successful local operations
        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        # Mock Supabase admin client that fails
        with patch(
            "src.services.user_deletion_service.get_supabase_admin_client"
        ) as mock_get_client:
            from src.core.exceptions import SupabaseAdminError

            mock_supabase_client = MagicMock()
            mock_supabase_client.delete_user = AsyncMock(
                side_effect=SupabaseAdminError("Failed to delete user from Supabase")
            )
            mock_get_client.return_value = mock_supabase_client

            # Mock sentry capture
            with patch("src.services.user_deletion_service.sentry_sdk") as mock_sentry:
                result = await service.delete_account(user_id, supabase_id)

        # Local deletion succeeded, but Supabase failed
        assert result.success is True  # Overall success because local deletion worked
        assert result.progress_deleted is True
        assert result.user_deleted is True
        assert result.supabase_deleted is False
        assert result.error_message is not None
        assert "contact support" in result.error_message.lower()

        # Verify sentry was called
        mock_sentry.capture_exception.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_without_supabase_id(self, service, mock_user):
        """Test deletion for user without Supabase identity."""
        user_id = mock_user.id

        # Mock successful local operations
        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        # Mock Supabase admin client (should not be called)
        with patch(
            "src.services.user_deletion_service.get_supabase_admin_client"
        ) as mock_get_client:
            mock_supabase_client = MagicMock()
            mock_get_client.return_value = mock_supabase_client

            # Call without supabase_id
            result = await service.delete_account(user_id, supabase_id=None)

        # Verify result
        assert result.success is True
        assert result.progress_deleted is True
        assert result.user_deleted is True
        assert result.supabase_deleted is None  # None indicates not attempted
        assert result.error_message is None

        # Verify Supabase delete was NOT called
        mock_supabase_client.delete_user.assert_not_called()

    @pytest.mark.asyncio
    async def test_delete_sets_correct_result_flags(self, service, mock_user):
        """Test that result flags are set correctly at each step."""
        user_id = mock_user.id
        supabase_id = mock_user.supabase_id

        # Mock all operations
        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        with patch(
            "src.services.user_deletion_service.get_supabase_admin_client"
        ) as mock_get_client:
            mock_supabase_client = MagicMock()
            mock_supabase_client.delete_user = AsyncMock(return_value=True)
            mock_get_client.return_value = mock_supabase_client

            result = await service.delete_account(user_id, supabase_id)

        # All flags should be True
        assert result.success is True
        assert result.progress_deleted is True
        assert result.user_deleted is True
        assert result.supabase_deleted is True

    @pytest.mark.asyncio
    async def test_delete_with_supabase_admin_not_configured(self, service, mock_user):
        """Test deletion when Supabase admin is not configured."""
        user_id = mock_user.id
        supabase_id = mock_user.supabase_id

        # Mock successful local operations
        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        # Mock get_supabase_admin_client returning None (not configured)
        with patch(
            "src.services.user_deletion_service.get_supabase_admin_client"
        ) as mock_get_client:
            mock_get_client.return_value = None

            result = await service.delete_account(user_id, supabase_id)

        # Local deletion should succeed, supabase_deleted stays None
        assert result.success is True
        assert result.progress_deleted is True
        assert result.user_deleted is True
        assert result.supabase_deleted is None  # None = admin not configured

    @pytest.mark.asyncio
    async def test_delete_user_already_deleted(self, service, mock_user):
        """Test deletion when user is already deleted (edge case)."""
        user_id = mock_user.id

        # Mock reset success
        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)

        # User not found in database
        service.user_repository.get = AsyncMock(return_value=None)
        service.user_repository.delete = AsyncMock()  # Ensure delete is also mocked

        result = await service.delete_account(user_id, supabase_id=None)

        # Should still succeed
        assert result.success is True
        assert result.progress_deleted is True
        assert result.user_deleted is True  # Treated as already deleted

        # Delete should not be called since user wasn't found
        service.user_repository.delete.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_delete_database_failure(self, service, mock_user):
        """Test complete failure when database deletion fails."""
        user_id = mock_user.id

        # Mock reset failure
        service.reset_service.reset_all_progress = AsyncMock(
            side_effect=Exception("Database connection failed")
        )

        # Mock user repository methods as AsyncMock
        service.user_repository.get = AsyncMock()
        service.user_repository.delete = AsyncMock()

        with patch("src.services.user_deletion_service.sentry_sdk") as mock_sentry:
            result = await service.delete_account(user_id, supabase_id=None)

        # Should fail completely
        assert result.success is False
        assert result.progress_deleted is False
        assert result.user_deleted is False
        assert result.error_message is not None

        # PAY-05-01 [sequence-order]: the user fetch now happens BEFORE
        # reset_all_progress, so `get` IS awaited here (reset is what fails).
        # The protective intent of this test -- no destructive step fires
        # once reset has failed -- is preserved by asserting `delete` never
        # runs, and (the new invariant this subtask introduces) that the
        # commit boundary never fires on a failed deletion either.
        service.user_repository.get.assert_awaited_once_with(user_id)
        service.user_repository.delete.assert_not_awaited()
        service.db.commit.assert_not_awaited()

        # Sentry should capture the exception
        mock_sentry.capture_exception.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_account_invalidates_identity(self, service, mock_user):
        """delete_account busts the identity cache for the deleted user (PERF-16-02).

        A deleted user's stale identity cache entry is worse than a normal
        stale entry: get_or_create_user's cache-hit path does db.get(User, id),
        gets None back (row gone), and falls through to the supabase_id query
        -- which can re-provision a brand new user row for the deleted
        supabase_id. Explicit invalidation on delete closes that window.

        RED reason: UserDeletionService.delete_account never calls the identity
        invalidation helper today.
        """
        user_id = mock_user.id
        supabase_id = mock_user.supabase_id

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        mock_cache = AsyncMock()
        mock_cache.invalidate_user_identity = AsyncMock()

        with (
            patch(
                "src.services.user_deletion_service.get_supabase_admin_client",
                return_value=None,
            ),
            patch(
                "src.services.user_deletion_service.get_cache",
                return_value=mock_cache,
                create=True,
            ),
        ):
            result = await service.delete_account(user_id, supabase_id)

        assert result.success is True
        mock_cache.invalidate_user_identity.assert_awaited_once_with(supabase_id, user_id)

    @pytest.mark.asyncio
    async def test_delete_account_invalidates_identity_with_none_supabase_id(
        self, service, mock_user
    ):
        """QA adversarial: delete_account(supabase_id=None) must still call
        invalidate_user_identity (with supabase_id=None) and must not crash.

        User.supabase_id is nullable at the ORM level, and callers of
        delete_account pass the Optional[str] straight through unchecked
        (per the invalidate_user_identity docstring). This covers the path
        where a user has no linked Supabase identity: the helper must still
        bust user:me:{user_id} rather than skip invalidation entirely.
        """
        user_id = mock_user.id

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        mock_cache = AsyncMock()
        mock_cache.invalidate_user_identity = AsyncMock()

        with (
            patch(
                "src.services.user_deletion_service.get_supabase_admin_client",
                return_value=None,
            ),
            patch(
                "src.services.user_deletion_service.get_cache",
                return_value=mock_cache,
                create=True,
            ),
        ):
            result = await service.delete_account(user_id, supabase_id=None)

        assert result.success is True
        mock_cache.invalidate_user_identity.assert_awaited_once_with(None, user_id)

    # ------------------------------------------------------------------
    # PAY-05-01 Test Specs: commit-boundary reorder
    #
    # RALPH Phase 1 Stage 2.5 (Mode A / RED). These transcribe the
    # architect's Test Specs table 1:1 -- they must fail against today's
    # implementation (no commit(), fetch-after-destroy order, extra={}
    # logging) for the RIGHT reason (an assertion on behavior), not from an
    # unconfigured mock. See story doc [sequence-order], [commit-ownership].
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_mock_db_session_commit_is_awaitable(self, mock_db_session):
        """Prereq (Test Spec row 8): pins the fixture contract the other 7
        Test Specs below silently depend on. `await session.commit()` must
        not raise TypeError. Expected GREEN immediately -- this only
        verifies the step-0 fixture fix just above, not delete_account().
        """
        await mock_db_session.commit()
        mock_db_session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_user_fetched_before_any_destruction(self, service, mock_user):
        """AC5 (traces AC3 precondition): user_repository.get() must run
        before reset_all_progress() and before user_repository.delete() --
        the ids (supabase_id, avatar_url) have to be captured before
        anything is destroyed. RED today: delete_account() calls
        reset_all_progress() first and user_repository.get() second.
        """
        user_id = mock_user.id
        supabase_id = mock_user.supabase_id
        call_order: list[str] = []

        mock_reset_result = MagicMock()

        async def _reset_all_progress(*_args, **_kwargs):
            call_order.append("reset_all_progress")
            return mock_reset_result

        async def _get(*_args, **_kwargs):
            call_order.append("get")
            return mock_user

        async def _delete(*_args, **_kwargs):
            call_order.append("delete")

        service.reset_service.reset_all_progress = AsyncMock(side_effect=_reset_all_progress)
        service.user_repository.get = AsyncMock(side_effect=_get)
        service.user_repository.delete = AsyncMock(side_effect=_delete)

        with patch(
            "src.services.user_deletion_service.get_supabase_admin_client",
            return_value=None,
        ):
            result = await service.delete_account(user_id, supabase_id)

        assert result.success is True
        assert {"get", "reset_all_progress", "delete"} <= set(
            call_order
        ), f"expected all three calls to run; got {call_order}"
        assert call_order.index("get") < call_order.index(
            "reset_all_progress"
        ), f"user fetch must precede progress reset; order was {call_order}"
        assert call_order.index("get") < call_order.index(
            "delete"
        ), f"user fetch must precede local delete; order was {call_order}"

    @pytest.mark.asyncio
    async def test_commit_precedes_supabase_delete(self, service, mock_db_session, mock_user):
        """AC5: the explicit commit must land before the Supabase auth
        delete call fires. RED today: there is no self.db.commit() call in
        delete_account() at all, so 'commit' never appears in call_order.
        """
        user_id = mock_user.id
        supabase_id = mock_user.supabase_id
        call_order: list[str] = []

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        async def _commit(*_args, **_kwargs):
            call_order.append("commit")

        mock_db_session.commit = AsyncMock(side_effect=_commit)

        with patch(
            "src.services.user_deletion_service.get_supabase_admin_client"
        ) as mock_get_client:
            mock_supabase_client = MagicMock()

            async def _delete_user(*_args, **_kwargs):
                call_order.append("delete_user")
                return True

            mock_supabase_client.delete_user = AsyncMock(side_effect=_delete_user)
            mock_get_client.return_value = mock_supabase_client

            result = await service.delete_account(user_id, supabase_id)

        assert result.success is True
        assert (
            "commit" in call_order and "delete_user" in call_order
        ), f"expected both commit and delete_user to run; got {call_order}"
        assert call_order.index("commit") < call_order.index(
            "delete_user"
        ), f"commit must precede the Supabase delete call; order was {call_order}"

    @pytest.mark.asyncio
    async def test_commit_called_exactly_once(self, service, mock_db_session, mock_user):
        """AC5 guard: exactly one commit per delete_account() call on the
        happy path -- guards against a stray double-commit once the commit
        boundary is introduced. RED today: self.db.commit() is never
        called, so assert_awaited_once fails with 'Called 0 times'.
        """
        user_id = mock_user.id
        supabase_id = mock_user.supabase_id

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        with patch(
            "src.services.user_deletion_service.get_supabase_admin_client"
        ) as mock_get_client:
            mock_supabase_client = MagicMock()
            mock_supabase_client.delete_user = AsyncMock(return_value=True)
            mock_get_client.return_value = mock_supabase_client

            result = await service.delete_account(user_id, supabase_id)

        assert result.success is True
        mock_db_session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_supabase_failure_keeps_local_deletion(self, service, mock_db_session, mock_user):
        """AC5: a post-commit Supabase failure must not roll back the
        already-committed local deletion. RED today: db.commit is never
        called at all, so it cannot have been "already awaited" by the
        time the (still-failing) Supabase call runs.
        """
        user_id = mock_user.id
        supabase_id = mock_user.supabase_id

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        with patch(
            "src.services.user_deletion_service.get_supabase_admin_client"
        ) as mock_get_client:
            from src.core.exceptions import SupabaseAdminError

            mock_supabase_client = MagicMock()
            mock_supabase_client.delete_user = AsyncMock(
                side_effect=SupabaseAdminError("Failed to delete user from Supabase")
            )
            mock_get_client.return_value = mock_supabase_client

            with patch("src.services.user_deletion_service.sentry_sdk"):
                result = await service.delete_account(user_id, supabase_id)

        assert result.success is True
        assert result.supabase_deleted is False
        mock_db_session.rollback.assert_not_awaited()
        mock_db_session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_supabase_failure_logs_error_with_flat_fields(self, service, mock_user):
        """AC4/AC5: the Supabase-failure logger.error must use kwargs, not
        extra={...}, per docs/conventions.md's kwargs logging convention --
        so supabase_id_prefix lands flat at record['extra'] top level.
        RED until user_deletion_service.py:177-184 is converted from
        extra={...} to kwargs [log-migration-carveout]. extra={...} nests
        the fields one level deeper, under record['extra']['extra'],
        confirmed empirically against this repo's loguru version.
        """
        from loguru import logger as loguru_logger

        user_id = mock_user.id
        supabase_id = mock_user.supabase_id

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        captured: list[dict] = []
        sink_id = loguru_logger.add(lambda m: captured.append(m.record), level="ERROR")

        try:
            with patch(
                "src.services.user_deletion_service.get_supabase_admin_client"
            ) as mock_get_client:
                from src.core.exceptions import SupabaseAdminError

                mock_supabase_client = MagicMock()
                mock_supabase_client.delete_user = AsyncMock(
                    side_effect=SupabaseAdminError("Failed to delete user from Supabase")
                )
                mock_get_client.return_value = mock_supabase_client

                with patch("src.services.user_deletion_service.sentry_sdk"):
                    await service.delete_account(user_id, supabase_id)
        finally:
            loguru_logger.remove(sink_id)

        error_records = [r for r in captured if "Supabase deletion failed" in r["message"]]
        assert error_records, "expected a logger.error call for the Supabase deletion failure"
        record = error_records[0]
        assert (
            "supabase_id_prefix" in record["extra"]
        ), f"supabase_id_prefix must be flat in record['extra'], got {record['extra']!r}"
        assert record["extra"]["supabase_id_prefix"] == supabase_id[:8]
        assert "extra" not in record["extra"], (
            "supabase_id_prefix must not be nested under extra.extra "
            f"(extra={{...}} was used instead of kwargs); got {record['extra']!r}"
        )

    @pytest.mark.asyncio
    async def test_missing_user_row_preserves_today_contract(
        self, service, mock_db_session, mock_user
    ):
        """AC2/AC7: the already-deleted-user early return must keep
        behaving exactly as it does today once the fetch moves to the top
        of delete_account() -- reset_all_progress still runs, the three
        success flags stay true, and nothing destructive (delete/commit/
        Supabase) runs since there is nothing to destroy.

        NOT necessarily red: today's implementation may already satisfy
        this contract, since fetch-first only reorders what happens AFTER
        the fetch, not this early-return branch itself. Verify honestly.
        """
        user_id = mock_user.id

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=None)
        service.user_repository.delete = AsyncMock()

        with patch(
            "src.services.user_deletion_service.get_supabase_admin_client"
        ) as mock_get_client:
            mock_supabase_client = MagicMock()
            mock_supabase_client.delete_user = AsyncMock()
            mock_get_client.return_value = mock_supabase_client

            result = await service.delete_account(user_id, supabase_id=None)

        assert result.success is True
        assert result.progress_deleted is True
        assert result.user_deleted is True

        service.reset_service.reset_all_progress.assert_awaited_once_with(user_id)
        service.user_repository.delete.assert_not_awaited()
        mock_supabase_client.delete_user.assert_not_called()
        mock_db_session.commit.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_no_supabase_id_still_commits(self, service, mock_db_session, mock_user):
        """AC5: the commit boundary must not be gated on having a
        supabase_id -- local deletion commits regardless of whether
        there's an external identity to clean up. RED today: there is no
        commit() call in delete_account() at all.
        """
        user_id = mock_user.id

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        with patch(
            "src.services.user_deletion_service.get_supabase_admin_client"
        ) as mock_get_client:
            mock_supabase_client = MagicMock()
            mock_get_client.return_value = mock_supabase_client

            result = await service.delete_account(user_id, supabase_id=None)

        assert result.success is True
        mock_db_session.commit.assert_awaited_once()
        mock_supabase_client.delete_user.assert_not_called()

    # ------------------------------------------------------------------
    # QA adversarial coverage (RALPH Phase 1 Stage 4, PAY-05-01 verify).
    # Stage 2.5's 8 Test Specs cover the happy-path reorder and the
    # Supabase-failure branch; these cover destructive-step failures and
    # the boundaries of the log-migration carve-out that Stage 2.5 didn't
    # exercise.
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_local_delete_failure_never_commits(self, service, mock_db_session, mock_user):
        """QA adversarial: if user_repository.delete() itself raises (e.g. a
        FK constraint violation), the commit boundary must never fire --
        committing a half-destroyed row would be worse than the pre-PAY-05-01
        behavior. Guards against a future refactor that widens the try/except
        around step 3 in a way that lets a failed delete fall through to
        commit().
        """
        user_id = mock_user.id

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock(side_effect=RuntimeError("FK violation"))

        with patch("src.services.user_deletion_service.sentry_sdk") as mock_sentry:
            result = await service.delete_account(user_id, supabase_id=None)

        assert result.success is False
        assert result.user_deleted is False
        mock_db_session.commit.assert_not_awaited()
        mock_sentry.capture_exception.assert_called_once()

    @pytest.mark.asyncio
    async def test_missing_user_row_reset_failure_does_not_crash(
        self, service, mock_db_session, mock_user
    ):
        """QA adversarial: the None-user early-return branch (AC7) also
        calls reset_all_progress -- if THAT call raises (e.g. Redis down),
        the exception must be caught by the outer handler like any other
        mid-flow failure, not propagate uncaught or spuriously commit.
        Stage 2.5's test_missing_user_row_preserves_today_contract only
        exercises the happy path through this branch.
        """
        user_id = mock_user.id

        service.user_repository.get = AsyncMock(return_value=None)
        service.reset_service.reset_all_progress = AsyncMock(side_effect=RuntimeError("reset boom"))
        service.user_repository.delete = AsyncMock()

        with patch("src.services.user_deletion_service.sentry_sdk") as mock_sentry:
            result = await service.delete_account(user_id, supabase_id=None)

        assert result.success is False
        assert result.progress_deleted is False
        assert result.user_deleted is False
        mock_db_session.commit.assert_not_awaited()
        service.user_repository.delete.assert_not_awaited()
        mock_sentry.capture_exception.assert_called_once()

    @pytest.mark.asyncio
    async def test_supabase_failure_log_carveout_does_not_leak_to_other_log_lines(
        self, service, mock_user
    ):
        """QA adversarial: `[log-migration-carveout]` says only the
        Supabase-failure logger.error at :204-209 is migrated to kwargs --
        every other extra={...} call in the file is deliberately left
        alone. Prove the carve-out didn't accidentally widen (or
        accidentally re-nest the one line it was supposed to flatten) by
        checking a DIFFERENT logger.error call (the outer exception
        handler's "Account deletion failed") still nests its fields under
        record['extra']['extra'], i.e. still uses extra={...} style.
        """
        from loguru import logger as loguru_logger

        user_id = mock_user.id

        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.reset_service.reset_all_progress = AsyncMock(side_effect=RuntimeError("boom"))
        service.user_repository.delete = AsyncMock()

        captured: list[dict] = []
        sink_id = loguru_logger.add(lambda m: captured.append(m.record), level="ERROR")
        try:
            with patch("src.services.user_deletion_service.sentry_sdk"):
                await service.delete_account(user_id, supabase_id=None)
        finally:
            loguru_logger.remove(sink_id)

        error_records = [r for r in captured if "Account deletion failed" in r["message"]]
        assert error_records, "expected the outer-handler logger.error to fire"
        record = error_records[0]
        assert "extra" in record["extra"], (
            "the outer exception handler's logger.error must remain "
            "extra={...} style (nested under extra.extra) -- the "
            "log-migration carve-out is scoped to the Supabase-failure "
            f"line only; got {record['extra']!r}"
        )

    @pytest.mark.asyncio
    async def test_post_commit_cache_invalidation_failure_does_not_report_false_total_failure(
        self, service, mock_db_session, mock_user
    ):
        """QA adversarial -- FAILS today, real gap for the executor.

        [post-commit-nonfatal] (architect decision, this subtask) requires
        that steps 5-7 (cache invalidate, Supabase delete, S3 delete) "run
        after the durable commit and must never raise -- each logs and
        continues." The Supabase-delete call honors this (its own
        try/except SupabaseAdminError). The cache-invalidation call
        (`get_cache().invalidate_user_identity(...)`, PERF-16-02) does
        NOT -- it has no local try/except, so any exception it raises
        (Redis down, etc.) falls through to the outer `except Exception`
        handler, which returns `result.success = False` even though
        `self.db.commit()` already ran and the local deletion is durably
        committed.

        This is a genuine regression risk introduced by moving the commit
        earlier: previously (pre-PAY-05-01, no explicit commit), the route
        raising HTTPException(500) on `not result.success` would propagate
        out to `get_db`, which rolls back on any exception -- so a
        cache-invalidation failure rolled back the WHOLE transaction and
        the misleading 500 was at least consistent with reality (nothing
        was actually deleted). Now, the local delete is already committed
        before this call runs, so `get_db`'s rollback-on-500 is a no-op
        against already-committed data: the client is told "Failed to
        delete account. Please try again." while the account is, in fact,
        already gone.

        Expected/desired behavior once fixed: a cache-invalidation failure
        must not flip `result.success` to False when the destructive steps
        and commit already succeeded -- it should log and continue, per
        [post-commit-nonfatal], the same way the Supabase-delete branch
        already does.
        """
        user_id = mock_user.id
        supabase_id = mock_user.supabase_id

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        mock_cache = AsyncMock()
        mock_cache.invalidate_user_identity = AsyncMock(
            side_effect=RuntimeError("redis connection refused")
        )

        with (
            patch(
                "src.services.user_deletion_service.get_cache",
                return_value=mock_cache,
                create=True,
            ),
            patch("src.services.user_deletion_service.sentry_sdk"),
        ):
            result = await service.delete_account(user_id, supabase_id)

        # The local delete already committed -- this must not be reported
        # as a total failure to the caller (which would 500 the route
        # despite the account already being durably deleted).
        mock_db_session.commit.assert_awaited_once()
        assert result.progress_deleted is True
        assert result.user_deleted is True
        assert result.success is True, (
            "cache-invalidation failure after a durable commit must not "
            "report total failure -- [post-commit-nonfatal] requires "
            "steps 5-7 to log and continue, not corrupt an already-"
            f"successful result; got {result!r}"
        )

    # ------------------------------------------------------------------
    # PAY-05-02 Test Specs: cancel the Stripe subscription before anything
    # is destroyed (task-1316).
    #
    # RALPH Phase 1 Stage 2.5 (Mode A / RED). These transcribe the
    # architect's 11-row Test Specs table 1:1. `get_stripe_client` and
    # `is_stripe_configured` are not yet imported into
    # user_deletion_service.py, so patches below use create=True -- this
    # avoids an AttributeError at test-setup time (the wrong kind of
    # "red"). The patch target already matches the destination-module
    # convention ("src.services.user_deletion_service.<name>") that the
    # executor's own import is expected to land at, per this file's own
    # precedent (get_cache is patched the same way), so no test rewrite
    # is needed once the guard exists. See story doc [stripe-guard],
    # [no-refund-params], [sequence-order], [idempotency].
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_active_sub_canceled_immediately(self, service, mock_user):
        """AC1: a user with an active Stripe subscription gets it canceled
        immediately via cancel_async, called bare (no params -- no
        refund/proration per [no-refund-params]; the installed SDK's
        prorate/invoice_now both default False).

        Green since PAY-05-02 (commit 7b79461a) added the guard + call.
        QA Stage 4 mutation-tested this: injecting a `params={"prorate":
        True}` kwarg into the real cancel_async call breaks this assertion,
        confirming [no-refund-params] is actually pinned, not just asserted.
        """
        user_id = mock_user.id
        mock_user.stripe_subscription_id = "sub_123"
        mock_user.subscription_status = SubscriptionStatus.ACTIVE

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        mock_stripe_client = MagicMock()
        mock_stripe_client.v1.subscriptions.cancel_async = AsyncMock()

        with (
            patch(
                "src.services.user_deletion_service.is_stripe_configured",
                return_value=True,
                create=True,
            ),
            patch(
                "src.services.user_deletion_service.get_stripe_client",
                return_value=mock_stripe_client,
                create=True,
            ),
        ):
            result = await service.delete_account(user_id, supabase_id=None)

        assert result.success is True
        mock_stripe_client.v1.subscriptions.cancel_async.assert_awaited_once_with("sub_123")

    @pytest.mark.asyncio
    async def test_cancel_precedes_local_deletion(self, service, mock_db_session, mock_user):
        """AC3: the Stripe cancel call must precede every local mutation --
        reset_all_progress, user_repository.delete, and db.commit.

        Green since PAY-05-02 (commit 7b79461a). Asserted via explicit
        membership first (not call_order.index(), which would raise
        ValueError -- the wrong kind of red -- if the entry were simply
        absent).
        """
        user_id = mock_user.id
        mock_user.stripe_subscription_id = "sub_123"
        mock_user.subscription_status = SubscriptionStatus.ACTIVE
        call_order: list[str] = []

        mock_reset_result = MagicMock()

        async def _cancel_async(*_args, **_kwargs):
            call_order.append("cancel_async")

        async def _reset_all_progress(*_args, **_kwargs):
            call_order.append("reset_all_progress")
            return mock_reset_result

        async def _delete(*_args, **_kwargs):
            call_order.append("delete")

        async def _commit(*_args, **_kwargs):
            call_order.append("commit")

        service.reset_service.reset_all_progress = AsyncMock(side_effect=_reset_all_progress)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock(side_effect=_delete)
        mock_db_session.commit = AsyncMock(side_effect=_commit)

        mock_stripe_client = MagicMock()
        mock_stripe_client.v1.subscriptions.cancel_async = AsyncMock(side_effect=_cancel_async)

        with (
            patch(
                "src.services.user_deletion_service.is_stripe_configured",
                return_value=True,
                create=True,
            ),
            patch(
                "src.services.user_deletion_service.get_stripe_client",
                return_value=mock_stripe_client,
                create=True,
            ),
        ):
            result = await service.delete_account(user_id, supabase_id=None)

        assert result.success is True
        assert "cancel_async" in call_order, f"expected cancel_async to run; got {call_order}"
        assert call_order.index("cancel_async") < call_order.index(
            "reset_all_progress"
        ), f"cancel must precede progress reset; order was {call_order}"
        assert call_order.index("cancel_async") < call_order.index(
            "delete"
        ), f"cancel must precede local delete; order was {call_order}"
        assert call_order.index("cancel_async") < call_order.index(
            "commit"
        ), f"cancel must precede commit; order was {call_order}"

    @pytest.mark.asyncio
    async def test_no_sub_id_skips_stripe(self, service, mock_user):
        """AC2: no stripe_subscription_id (status NONE, the fixture
        defaults) -> no Stripe call at all, deletion still succeeds.

        Expected GREEN on arrival: nothing calls Stripe today either, so
        "never called" is trivially true. This pins the guard's behavior
        once the executor adds the call -- it becomes the regression net.
        """
        user_id = mock_user.id
        # mock_user fixture defaults already satisfy this: stripe_subscription_id=None,
        # subscription_status=SubscriptionStatus.NONE.

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        mock_stripe_client = MagicMock()
        mock_stripe_client.v1.subscriptions.cancel_async = AsyncMock()

        with (
            patch(
                "src.services.user_deletion_service.is_stripe_configured",
                return_value=True,
                create=True,
            ),
            patch(
                "src.services.user_deletion_service.get_stripe_client",
                return_value=mock_stripe_client,
                create=True,
            ),
        ):
            result = await service.delete_account(user_id, supabase_id=None)

        assert result.success is True
        mock_stripe_client.v1.subscriptions.cancel_async.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_app_managed_trialing_skips_stripe(self, service, mock_user):
        """AC2/[trial-is-app-managed]: TRIALING with no stripe_subscription_id
        (the real shape for app-managed trials, per src/core/dependencies.py
        :217-226) skips Stripe entirely.

        Expected GREEN on arrival: nothing calls Stripe today either, so
        "never called" is trivially true.
        """
        user_id = mock_user.id
        mock_user.subscription_status = SubscriptionStatus.TRIALING
        mock_user.stripe_subscription_id = None

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        mock_stripe_client = MagicMock()
        mock_stripe_client.v1.subscriptions.cancel_async = AsyncMock()

        with (
            patch(
                "src.services.user_deletion_service.is_stripe_configured",
                return_value=True,
                create=True,
            ),
            patch(
                "src.services.user_deletion_service.get_stripe_client",
                return_value=mock_stripe_client,
                create=True,
            ),
        ):
            result = await service.delete_account(user_id, supabase_id=None)

        assert result.success is True
        mock_stripe_client.v1.subscriptions.cancel_async.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_canceled_status_skips_stripe(self, service, mock_user):
        """AC2: subscription_status CANCELED, even with a stripe_subscription_id
        still on the row, skips the Stripe call (already canceled server-side).

        Expected GREEN on arrival: nothing calls Stripe today either, so
        "never called" is trivially true.
        """
        user_id = mock_user.id
        mock_user.subscription_status = SubscriptionStatus.CANCELED
        mock_user.stripe_subscription_id = "sub_123"

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        mock_stripe_client = MagicMock()
        mock_stripe_client.v1.subscriptions.cancel_async = AsyncMock()

        with (
            patch(
                "src.services.user_deletion_service.is_stripe_configured",
                return_value=True,
                create=True,
            ),
            patch(
                "src.services.user_deletion_service.get_stripe_client",
                return_value=mock_stripe_client,
                create=True,
            ),
        ):
            result = await service.delete_account(user_id, supabase_id=None)

        assert result.success is True
        mock_stripe_client.v1.subscriptions.cancel_async.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_trialing_with_stripe_sub_is_still_canceled(self, service, mock_user):
        """AC1/AC2: TRIALING status WITH a stripe_subscription_id present
        (a future Stripe-side trial, not today's app-managed shape) must
        still be canceled -- this proves the guard is pointer-driven
        (keyed on stripe_subscription_id is not None), not a status
        allowlist. A status-allowlist implementation (e.g. only
        ACTIVE/PAST_DUE) would wrongly skip this case and fail here.

        Green since PAY-05-02 (commit 7b79461a). QA Stage 4 mutation-tested
        this: swapping the real guard for a
        `subscription_status in (ACTIVE, PAST_DUE)` allowlist makes this
        test fail (cancel_async awaited 0 times), confirming it genuinely
        catches an allowlist regression rather than passing vacuously.
        """
        user_id = mock_user.id
        mock_user.subscription_status = SubscriptionStatus.TRIALING
        mock_user.stripe_subscription_id = "sub_123"

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        mock_stripe_client = MagicMock()
        mock_stripe_client.v1.subscriptions.cancel_async = AsyncMock()

        with (
            patch(
                "src.services.user_deletion_service.is_stripe_configured",
                return_value=True,
                create=True,
            ),
            patch(
                "src.services.user_deletion_service.get_stripe_client",
                return_value=mock_stripe_client,
                create=True,
            ),
        ):
            result = await service.delete_account(user_id, supabase_id=None)

        assert result.success is True
        mock_stripe_client.v1.subscriptions.cancel_async.assert_awaited_once_with("sub_123")

    @pytest.mark.asyncio
    async def test_stripe_not_configured_skips_and_deletes(self, service, mock_user):
        """AC2: is_stripe_configured() is False -> get_stripe_client is
        NEVER called (not just that cancel_async wasn't invoked) --
        calling get_stripe_client() while unconfigured raises RuntimeError
        per src/core/stripe.py:32-38. Deletion still succeeds.

        Expected GREEN on arrival: nothing calls get_stripe_client today
        either, so "never called" is trivially true.
        """
        user_id = mock_user.id
        mock_user.stripe_subscription_id = "sub_123"
        mock_user.subscription_status = SubscriptionStatus.ACTIVE

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        with (
            patch(
                "src.services.user_deletion_service.is_stripe_configured",
                return_value=False,
                create=True,
            ),
            patch(
                "src.services.user_deletion_service.get_stripe_client",
                create=True,
            ) as mock_get_client,
        ):
            result = await service.delete_account(user_id, supabase_id=None)

        assert result.success is True
        mock_get_client.assert_not_called()

    @pytest.mark.asyncio
    async def test_invalid_request_error_does_not_block_deletion(
        self, service, mock_db_session, mock_user
    ):
        """AC2/[idempotency]: stripe.InvalidRequestError (e.g. subscription
        already canceled server-side, code="resource_missing") must NOT
        block deletion -- branch on exception class, never a message
        string.

        Green since PAY-05-02 (commit 7b79461a). The cancel_async
        assertion is what makes this non-vacuous: checking only the
        outcome (success/delete/commit) would have been trivially true
        even before the guard existed, since nothing called Stripe at all.
        """
        user_id = mock_user.id
        mock_user.stripe_subscription_id = "sub_123"
        mock_user.subscription_status = SubscriptionStatus.ACTIVE

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        mock_stripe_client = MagicMock()
        mock_stripe_client.v1.subscriptions.cancel_async = AsyncMock(
            side_effect=stripe.InvalidRequestError(
                "Subscription already canceled", param=None, code="resource_missing"
            )
        )

        with (
            patch(
                "src.services.user_deletion_service.is_stripe_configured",
                return_value=True,
                create=True,
            ),
            patch(
                "src.services.user_deletion_service.get_stripe_client",
                return_value=mock_stripe_client,
                create=True,
            ),
        ):
            result = await service.delete_account(user_id, supabase_id=None)

        mock_stripe_client.v1.subscriptions.cancel_async.assert_awaited_once_with("sub_123")
        assert result.success is True
        service.user_repository.delete.assert_awaited_once_with(mock_user)
        mock_db_session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_stripe_api_failure_deletes_nothing(self, service, mock_db_session, mock_user):
        """AC3/[idempotency]: any StripeError other than InvalidRequestError
        (e.g. APIConnectionError) fails closed -- nothing local is
        destroyed. Because the cancel precedes every mutation, the outer
        handler's re-raise -> success=False leaves the (never-started)
        rollback a genuine no-op.

        Green since PAY-05-02 (commit 7b79461a): before the guard existed,
        nothing called Stripe, so delete_account proceeded normally and
        succeeded -- result.success was True, not False.
        """
        user_id = mock_user.id
        mock_user.stripe_subscription_id = "sub_123"
        mock_user.subscription_status = SubscriptionStatus.ACTIVE

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        mock_stripe_client = MagicMock()
        mock_stripe_client.v1.subscriptions.cancel_async = AsyncMock(
            side_effect=stripe.APIConnectionError("Connection to Stripe failed")
        )

        with (
            patch(
                "src.services.user_deletion_service.is_stripe_configured",
                return_value=True,
                create=True,
            ),
            patch(
                "src.services.user_deletion_service.get_stripe_client",
                return_value=mock_stripe_client,
                create=True,
            ),
            patch("src.services.user_deletion_service.sentry_sdk"),
        ):
            result = await service.delete_account(user_id, supabase_id=None)

        assert result.success is False
        service.reset_service.reset_all_progress.assert_not_awaited()
        service.user_repository.delete.assert_not_awaited()
        mock_db_session.commit.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_failed_cancel_logs_ids_flat(self, service, mock_user):
        """AC4: the fail-closed logger.error must carry stripe_subscription_id
        and stripe_customer_id as flat, queryable fields at record["extra"]
        top level -- kwargs style, not nested under extra.extra. Reuses the
        real-loguru-sink pattern from
        test_supabase_failure_logs_error_with_flat_fields rather than
        mocking the logger. Matches on field presence (not exact message
        text, which isn't pinned by the architect's spec) to avoid
        coupling to wording the executor hasn't written yet.

        Green since PAY-05-02 (commit 7b79461a) added the kwargs-style
        logger.error call in the StripeError branch.
        """
        from loguru import logger as loguru_logger

        user_id = mock_user.id
        mock_user.stripe_subscription_id = "sub_123"
        mock_user.stripe_customer_id = "cus_456"
        mock_user.subscription_status = SubscriptionStatus.ACTIVE

        service.reset_service.reset_all_progress = AsyncMock(return_value=MagicMock())
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        mock_stripe_client = MagicMock()
        mock_stripe_client.v1.subscriptions.cancel_async = AsyncMock(
            side_effect=stripe.APIConnectionError("Connection to Stripe failed")
        )

        captured: list[dict] = []
        sink_id = loguru_logger.add(lambda m: captured.append(m.record), level="ERROR")

        try:
            with (
                patch(
                    "src.services.user_deletion_service.is_stripe_configured",
                    return_value=True,
                    create=True,
                ),
                patch(
                    "src.services.user_deletion_service.get_stripe_client",
                    return_value=mock_stripe_client,
                    create=True,
                ),
                patch("src.services.user_deletion_service.sentry_sdk"),
            ):
                await service.delete_account(user_id, supabase_id=None)
        finally:
            loguru_logger.remove(sink_id)

        stripe_error_records = [
            r
            for r in captured
            if "stripe_subscription_id" in r["extra"] or "stripe_customer_id" in r["extra"]
        ]
        assert stripe_error_records, (
            "expected a logger.error call exposing stripe_subscription_id/"
            f"stripe_customer_id; captured extras were {[r['extra'] for r in captured]!r}"
        )
        record = stripe_error_records[0]
        assert record["extra"].get("stripe_subscription_id") == "sub_123"
        assert record["extra"].get("stripe_customer_id") == "cus_456"
        assert "extra" not in record["extra"], (
            "sub_*/cus_* fields must be flat kwargs, not nested under "
            f"extra.extra; got {record['extra']!r}"
        )

    @pytest.mark.asyncio
    async def test_failed_cancel_logs_no_pii(self, service, mock_user):
        """AC4: the fail-closed logger.error must contain no PII (email,
        tokens, keys) alongside the Stripe ids.

        Green since PAY-05-02 (commit 7b79461a); see
        test_failed_cancel_logs_ids_flat for the log line itself.
        """
        from loguru import logger as loguru_logger

        user_id = mock_user.id
        mock_user.stripe_subscription_id = "sub_123"
        mock_user.stripe_customer_id = "cus_456"
        mock_user.subscription_status = SubscriptionStatus.ACTIVE
        mock_user.email = "should-not-be-logged@example.com"

        service.reset_service.reset_all_progress = AsyncMock(return_value=MagicMock())
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        mock_stripe_client = MagicMock()
        mock_stripe_client.v1.subscriptions.cancel_async = AsyncMock(
            side_effect=stripe.APIConnectionError("Connection to Stripe failed")
        )

        captured: list[dict] = []
        sink_id = loguru_logger.add(lambda m: captured.append(m.record), level="ERROR")

        try:
            with (
                patch(
                    "src.services.user_deletion_service.is_stripe_configured",
                    return_value=True,
                    create=True,
                ),
                patch(
                    "src.services.user_deletion_service.get_stripe_client",
                    return_value=mock_stripe_client,
                    create=True,
                ),
                patch("src.services.user_deletion_service.sentry_sdk"),
            ):
                await service.delete_account(user_id, supabase_id=None)
        finally:
            loguru_logger.remove(sink_id)

        stripe_error_records = [
            r
            for r in captured
            if "stripe_subscription_id" in r["extra"] or "stripe_customer_id" in r["extra"]
        ]
        assert stripe_error_records, (
            "expected a logger.error call exposing stripe_subscription_id/"
            f"stripe_customer_id; captured extras were {[r['extra'] for r in captured]!r}"
        )
        record = stripe_error_records[0]
        forbidden_keys = {"email", "token", "password", "jwt", "api_key", "secret"}
        leaked = forbidden_keys & set(record["extra"].keys())
        assert not leaked, f"PII/secret fields leaked into log extra: {leaked}"
        assert "should-not-be-logged@example.com" not in str(record["extra"].values())

    # ------------------------------------------------------------------
    # QA Stage 4 (Mode B) adversarial coverage added on top of the
    # architect's 11 Test Specs above. These probe exception classes and
    # id-shape combinations the RED spec didn't enumerate.
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_rate_limit_error_fails_closed(self, service, mock_db_session, mock_user):
        """AC2/[idempotency]: stripe.RateLimitError is a StripeError but NOT
        an InvalidRequestError -- it must fall through to the generic
        `except stripe.StripeError` branch and fail closed (re-raise),
        exactly like APIConnectionError. This guards against a future
        rewrite that special-cases APIConnectionError by class name
        instead of catching the StripeError family.
        """
        user_id = mock_user.id
        mock_user.stripe_subscription_id = "sub_123"
        mock_user.subscription_status = SubscriptionStatus.ACTIVE

        service.reset_service.reset_all_progress = AsyncMock(return_value=MagicMock())
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        mock_stripe_client = MagicMock()
        mock_stripe_client.v1.subscriptions.cancel_async = AsyncMock(
            side_effect=stripe.RateLimitError("Too many requests")
        )

        with (
            patch(
                "src.services.user_deletion_service.is_stripe_configured",
                return_value=True,
                create=True,
            ),
            patch(
                "src.services.user_deletion_service.get_stripe_client",
                return_value=mock_stripe_client,
                create=True,
            ),
            patch("src.services.user_deletion_service.sentry_sdk"),
        ):
            result = await service.delete_account(user_id, supabase_id=None)

        assert result.success is False
        service.reset_service.reset_all_progress.assert_not_awaited()
        service.user_repository.delete.assert_not_awaited()
        mock_db_session.commit.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_authentication_error_fails_closed(self, service, mock_db_session, mock_user):
        """AC2/[idempotency]: stripe.AuthenticationError (e.g. a revoked/
        rotated API key) is a StripeError but NOT an InvalidRequestError --
        must fail closed. This is the class of error that most looks like
        "our own misconfiguration" rather than a Stripe-side data problem,
        and it would be tempting (wrongly) to treat it as non-blocking.
        """
        user_id = mock_user.id
        mock_user.stripe_subscription_id = "sub_123"
        mock_user.subscription_status = SubscriptionStatus.ACTIVE

        service.reset_service.reset_all_progress = AsyncMock(return_value=MagicMock())
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        mock_stripe_client = MagicMock()
        mock_stripe_client.v1.subscriptions.cancel_async = AsyncMock(
            side_effect=stripe.AuthenticationError("Invalid API key")
        )

        with (
            patch(
                "src.services.user_deletion_service.is_stripe_configured",
                return_value=True,
                create=True,
            ),
            patch(
                "src.services.user_deletion_service.get_stripe_client",
                return_value=mock_stripe_client,
                create=True,
            ),
            patch("src.services.user_deletion_service.sentry_sdk"),
        ):
            result = await service.delete_account(user_id, supabase_id=None)

        assert result.success is False
        service.reset_service.reset_all_progress.assert_not_awaited()
        service.user_repository.delete.assert_not_awaited()
        mock_db_session.commit.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_bare_stripe_error_fails_closed(self, service, mock_db_session, mock_user):
        """AC2/[idempotency]: a bare stripe.StripeError instance (not any
        named subclass) must NOT match `except stripe.InvalidRequestError`
        and must fall through to the generic `except stripe.StripeError`
        branch, failing closed. This pins the except-order: catching
        InvalidRequestError first only works because it's checked before
        the broader StripeError catch, not because of any isinstance
        special-casing on the exception message.
        """
        user_id = mock_user.id
        mock_user.stripe_subscription_id = "sub_123"
        mock_user.subscription_status = SubscriptionStatus.ACTIVE

        service.reset_service.reset_all_progress = AsyncMock(return_value=MagicMock())
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        mock_stripe_client = MagicMock()
        mock_stripe_client.v1.subscriptions.cancel_async = AsyncMock(
            side_effect=stripe.StripeError("Unclassified Stripe failure")
        )

        with (
            patch(
                "src.services.user_deletion_service.is_stripe_configured",
                return_value=True,
                create=True,
            ),
            patch(
                "src.services.user_deletion_service.get_stripe_client",
                return_value=mock_stripe_client,
                create=True,
            ),
            patch("src.services.user_deletion_service.sentry_sdk"),
        ):
            result = await service.delete_account(user_id, supabase_id=None)

        assert result.success is False
        service.reset_service.reset_all_progress.assert_not_awaited()
        service.user_repository.delete.assert_not_awaited()
        mock_db_session.commit.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_non_stripe_exception_from_cancel_async_fails_closed(
        self, service, mock_db_session, mock_user
    ):
        """[idempotency]/fail-closed: a non-StripeError bug surfacing from
        cancel_async (e.g. a TypeError from a malformed call, or any other
        unexpected exception) is NOT caught by either except clause in the
        helper -- it must propagate straight through to delete_account's
        outer `except Exception` and still fail closed with nothing
        deleted. This guards against a future broadening of the helper's
        except clauses (e.g. a bare `except Exception` swallowing
        everything) reintroducing the exact bug this story exists to fix.
        """
        user_id = mock_user.id
        mock_user.stripe_subscription_id = "sub_123"
        mock_user.subscription_status = SubscriptionStatus.ACTIVE

        service.reset_service.reset_all_progress = AsyncMock(return_value=MagicMock())
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        mock_stripe_client = MagicMock()
        mock_stripe_client.v1.subscriptions.cancel_async = AsyncMock(
            side_effect=TypeError("unexpected SDK bug, not a StripeError at all")
        )

        with (
            patch(
                "src.services.user_deletion_service.is_stripe_configured",
                return_value=True,
                create=True,
            ),
            patch(
                "src.services.user_deletion_service.get_stripe_client",
                return_value=mock_stripe_client,
                create=True,
            ),
            patch("src.services.user_deletion_service.sentry_sdk"),
        ):
            result = await service.delete_account(user_id, supabase_id=None)

        assert result.success is False
        service.reset_service.reset_all_progress.assert_not_awaited()
        service.user_repository.delete.assert_not_awaited()
        mock_db_session.commit.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_get_stripe_client_raises_when_configured_fails_closed(
        self, service, mock_db_session, mock_user
    ):
        """Fail-closed edge case: is_stripe_configured() reports True but
        get_stripe_client() itself raises (e.g. a lazy-init race or an
        unexpected internal error, distinct from the "not configured"
        RuntimeError src/core/stripe.py raises deliberately). The guard
        must not swallow this either -- nothing local should be mutated.
        """
        user_id = mock_user.id
        mock_user.stripe_subscription_id = "sub_123"
        mock_user.subscription_status = SubscriptionStatus.ACTIVE

        service.reset_service.reset_all_progress = AsyncMock(return_value=MagicMock())
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        with (
            patch(
                "src.services.user_deletion_service.is_stripe_configured",
                return_value=True,
                create=True,
            ),
            patch(
                "src.services.user_deletion_service.get_stripe_client",
                side_effect=RuntimeError("unexpected client init failure"),
                create=True,
            ),
            patch("src.services.user_deletion_service.sentry_sdk"),
        ):
            result = await service.delete_account(user_id, supabase_id=None)

        assert result.success is False
        service.reset_service.reset_all_progress.assert_not_awaited()
        service.user_repository.delete.assert_not_awaited()
        mock_db_session.commit.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_customer_id_only_without_sub_id_skips_stripe(self, service, mock_user):
        """AC2/[stripe-guard]: a user with a stripe_customer_id but NO
        stripe_subscription_id (e.g. a Checkout session was started but
        never completed into a subscription) must skip the Stripe call --
        the guard is keyed purely on stripe_subscription_id, not on
        whether a Stripe customer record exists at all.
        """
        user_id = mock_user.id
        mock_user.stripe_subscription_id = None
        mock_user.stripe_customer_id = "cus_456"
        mock_user.subscription_status = SubscriptionStatus.NONE

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        mock_stripe_client = MagicMock()
        mock_stripe_client.v1.subscriptions.cancel_async = AsyncMock()

        with (
            patch(
                "src.services.user_deletion_service.is_stripe_configured",
                return_value=True,
                create=True,
            ),
            patch(
                "src.services.user_deletion_service.get_stripe_client",
                return_value=mock_stripe_client,
                create=True,
            ),
        ):
            result = await service.delete_account(user_id, supabase_id=None)

        assert result.success is True
        mock_stripe_client.v1.subscriptions.cancel_async.assert_not_awaited()

    # ------------------------------------------------------------------
    # PAY-05-03 Test Specs: remove the deleted user's avatar from object
    # storage (task-1317).
    #
    # RALPH Phase 1 Stage 2.5 (Mode A / RED). These transcribe the
    # architect's 5-row Test Specs table 1:1. Neither `asyncio` nor
    # `get_s3_service` is imported into user_deletion_service.py today, so
    # the patch below uses create=True -- this avoids an AttributeError at
    # test-setup time (the wrong kind of "red"). The patch target
    # ("src.services.user_deletion_service.get_s3_service") matches the
    # destination-module convention this file already establishes for
    # get_cache/is_stripe_configured/get_stripe_client. See story doc
    # [post-commit-nonfatal], [avatar-post-commit].
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_avatar_deleted_from_storage(self, service, mock_user):
        """AC6: a user with an avatar_url gets that exact S3 key deleted via
        s3_service.delete_object, called once.

        RED today: delete_account() never imports/calls get_s3_service or
        delete_object at all, so delete_object.assert_called_once_with
        fails with "Expected 'delete_object' to have been called once.
        Called 0 times."
        """
        user_id = mock_user.id
        mock_user.avatar_url = f"avatars/{user_id}/x.jpg"

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        mock_s3_service = MagicMock()
        mock_s3_service.delete_object = MagicMock(return_value=True)

        with patch(
            "src.services.user_deletion_service.get_s3_service",
            return_value=mock_s3_service,
            create=True,
        ):
            result = await service.delete_account(user_id, supabase_id=None)

        assert result.success is True
        mock_s3_service.delete_object.assert_called_once_with(mock_user.avatar_url)

    @pytest.mark.asyncio
    async def test_avatar_delete_runs_after_commit(self, service, mock_db_session, mock_user):
        """AC6: the S3 avatar delete must run after the commit that makes
        local deletion durable -- same call-order-recorder technique as
        test_commit_precedes_supabase_delete.

        RED today: delete_object is never called at all, so "delete_object"
        never appears in call_order and the membership assertion fails
        first ("expected both commit and delete_object to run").
        """
        user_id = mock_user.id
        mock_user.avatar_url = f"avatars/{user_id}/x.jpg"
        call_order: list[str] = []

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        async def _commit(*_args, **_kwargs):
            call_order.append("commit")

        mock_db_session.commit = AsyncMock(side_effect=_commit)

        def _delete_object(*_args, **_kwargs):
            call_order.append("delete_object")
            return True

        mock_s3_service = MagicMock()
        mock_s3_service.delete_object = MagicMock(side_effect=_delete_object)

        with patch(
            "src.services.user_deletion_service.get_s3_service",
            return_value=mock_s3_service,
            create=True,
        ):
            result = await service.delete_account(user_id, supabase_id=None)

        assert result.success is True
        assert (
            "commit" in call_order and "delete_object" in call_order
        ), f"expected both commit and delete_object to run; got {call_order}"
        assert call_order.index("commit") < call_order.index(
            "delete_object"
        ), f"commit must precede the S3 avatar delete; order was {call_order}"

    @pytest.mark.asyncio
    async def test_no_avatar_skips_s3(self, service, mock_user):
        """AC2: avatar_url=None (the mock_user fixture default) -> no S3
        call at all, deletion still succeeds. Asserts delete_object is
        NEVER called (not merely that it returned harmlessly), per the
        architect's explicit-`if avatar_url:` guard requirement -- relying
        on delete_object's internal falsy-key short-circuit would still
        pass an "assert returned True" check but fail this one.

        Expected GREEN on arrival: nothing calls S3 in delete_account today
        either, so "never called" is trivially true. This pins the guard's
        behavior once the executor adds the call -- it becomes the
        regression net against a future change that drops the `if
        avatar_url:` check and calls delete_object("") unconditionally.
        """
        user_id = mock_user.id
        # mock_user fixture default already satisfies this: avatar_url=None.

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        mock_s3_service = MagicMock()
        mock_s3_service.delete_object = MagicMock(return_value=True)

        with patch(
            "src.services.user_deletion_service.get_s3_service",
            return_value=mock_s3_service,
            create=True,
        ):
            result = await service.delete_account(user_id, supabase_id=None)

        assert result.success is True
        mock_s3_service.delete_object.assert_not_called()

    @pytest.mark.asyncio
    async def test_s3_failure_does_not_fail_deletion(self, service, mock_user):
        """AC6: delete_object returning False (it never raises -- only
        catches BotoCoreError/ClientError internally and self-logs) must
        not fail the overall deletion: result.success stays True, and a
        kwargs-style logger.error carries user_id so the failure is
        queryable. Uses the real-loguru-sink pattern (not a mocked logger)
        established by test_supabase_failure_logs_error_with_flat_fields.

        RED today: delete_object is never called, so no matching error
        record is captured and `assert error_records` fails with "expected
        a logger.error call for the avatar deletion failure".
        """
        from loguru import logger as loguru_logger

        user_id = mock_user.id
        mock_user.avatar_url = f"avatars/{user_id}/x.jpg"

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        mock_s3_service = MagicMock()
        mock_s3_service.delete_object = MagicMock(return_value=False)

        captured: list[dict] = []
        sink_id = loguru_logger.add(lambda m: captured.append(m.record), level="ERROR")

        try:
            with patch(
                "src.services.user_deletion_service.get_s3_service",
                return_value=mock_s3_service,
                create=True,
            ):
                result = await service.delete_account(user_id, supabase_id=None)
        finally:
            loguru_logger.remove(sink_id)

        assert result.success is True

        error_records = [r for r in captured if "avatar" in r["message"].lower()]
        assert (
            error_records
        ), f"expected a logger.error call for the avatar deletion failure; captured: {captured!r}"
        record = error_records[0]
        assert (
            "user_id" in record["extra"]
        ), f"user_id must be a flat kwarg field on record['extra'], got {record['extra']!r}"
        assert record["extra"]["user_id"] == str(user_id)
        assert "extra" not in record["extra"], (
            "user_id must not be nested under extra.extra (extra={...} was "
            f"used instead of kwargs); got {record['extra']!r}"
        )

    @pytest.mark.asyncio
    async def test_avatar_key_captured_before_row_deleted(self, service, mock_user):
        """AC6: delete_object must receive the key from the local captured
        BEFORE user_repository.delete() ran, not from the (already-deleted)
        `user` object -- proves the step-1 capture is what's actually
        consumed, not a live attribute read that would break the moment
        the user row/ORM object is invalidated post-delete.

        Constructed so it would genuinely fail if the executor tried to
        read `user.avatar_url` after delete: the delete side_effect mutates
        avatar_url on the mock to a different (garbage) value, simulating
        what a real ORM-expired/deleted instance would look like. If
        production code read from `user.avatar_url` post-delete instead of
        the pre-captured local, delete_object would be called with the
        post-delete garbage value instead of the original key.

        RED today: delete_object is never called at all, so
        assert_called_once_with fails with "Called 0 times", not a
        wrong-argument mismatch -- still a genuine RED for the right
        reason (the capture-and-use behavior doesn't exist yet).
        """
        user_id = mock_user.id
        original_key = f"avatars/{user_id}/x.jpg"
        mock_user.avatar_url = original_key

        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)

        async def _delete(*_args, **_kwargs):
            # Simulate the row being destroyed: if production code read
            # user.avatar_url AFTER this point, it would see this garbage
            # value instead of the captured original.
            mock_user.avatar_url = "GARBAGE-POST-DELETE-VALUE"

        service.user_repository.delete = AsyncMock(side_effect=_delete)

        mock_s3_service = MagicMock()
        mock_s3_service.delete_object = MagicMock(return_value=True)

        with patch(
            "src.services.user_deletion_service.get_s3_service",
            return_value=mock_s3_service,
            create=True,
        ):
            result = await service.delete_account(user_id, supabase_id=None)

        assert result.success is True
        mock_s3_service.delete_object.assert_called_once_with(original_key)


@pytest.mark.unit
class TestDeletionResult:
    """Tests for DeletionResult dataclass."""

    def test_deletion_result_defaults(self):
        """Test DeletionResult default values."""
        result = DeletionResult(
            success=False,
            progress_deleted=False,
            user_deleted=False,
            supabase_deleted=None,
        )
        assert result.success is False
        assert result.progress_deleted is False
        assert result.user_deleted is False
        assert result.supabase_deleted is None
        assert result.error_message is None

    def test_deletion_result_with_error(self):
        """Test DeletionResult with error message."""
        result = DeletionResult(
            success=True,
            progress_deleted=True,
            user_deleted=True,
            supabase_deleted=False,
            error_message="Supabase deletion failed",
        )
        assert result.success is True
        assert result.supabase_deleted is False
        assert result.error_message == "Supabase deletion failed"
