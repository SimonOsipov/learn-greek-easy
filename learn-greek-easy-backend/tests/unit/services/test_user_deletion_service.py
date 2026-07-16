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

        # User deletion should not be attempted since reset failed
        service.user_repository.get.assert_not_awaited()

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
