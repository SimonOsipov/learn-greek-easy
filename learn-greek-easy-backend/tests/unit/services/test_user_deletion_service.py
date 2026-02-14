"""Unit tests for UserDeletionService.

Tests cover:
- delete_account: Full account deletion flow
- Auth0 deletion failure handling
- User without Auth0 ID
- Database failure handling

These tests use mocked dependencies to verify the service
coordinates all deletion steps correctly.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.services.user_deletion_service import DeletionResult, UserDeletionService


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    session = MagicMock()
    session.execute = AsyncMock()
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
    user.auth0_id = "auth0|123456789"
    return user


@pytest.mark.unit
class TestDeleteAccount:
    """Tests for UserDeletionService.delete_account method."""

    @pytest.mark.asyncio
    async def test_delete_success_full_flow(self, service, mock_user):
        """Test successful deletion of all data including Auth0."""
        user_id = mock_user.id
        auth0_id = mock_user.auth0_id

        # Mock reset service (returns a result object)
        mock_reset_result = MagicMock()
        mock_reset_result.total_deleted = 50
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)

        # Mock user repository
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        # Mock Auth0 client
        with patch(
            "src.services.user_deletion_service.get_auth0_management_client"
        ) as mock_get_client:
            mock_auth0_client = MagicMock()
            mock_auth0_client.delete_user = AsyncMock(return_value=True)
            mock_get_client.return_value = mock_auth0_client

            result = await service.delete_account(user_id, auth0_id)

        # Verify result
        assert result.success is True
        assert result.progress_deleted is True
        assert result.user_deleted is True
        assert result.auth0_deleted is True
        assert result.error_message is None

        # Verify all steps were called
        service.reset_service.reset_all_progress.assert_awaited_once_with(user_id)
        service.user_repository.get.assert_awaited_once_with(user_id)
        service.user_repository.delete.assert_awaited_once_with(mock_user)
        mock_auth0_client.delete_user.assert_awaited_once_with(auth0_id)

    @pytest.mark.asyncio
    async def test_delete_auth0_failure_still_succeeds(self, service, mock_user):
        """Test partial success when Auth0 deletion fails."""
        user_id = mock_user.id
        auth0_id = mock_user.auth0_id

        # Mock successful local operations
        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        # Mock Auth0 client that fails
        with patch(
            "src.services.user_deletion_service.get_auth0_management_client"
        ) as mock_get_client:
            from src.core.exceptions import SupabaseAdminError

            mock_auth0_client = MagicMock()
            mock_auth0_client.delete_user = AsyncMock(
                side_effect=SupabaseAdminError("Failed to delete user from Auth0")
            )
            mock_get_client.return_value = mock_auth0_client

            # Mock sentry capture
            with patch("src.services.user_deletion_service.sentry_sdk") as mock_sentry:
                result = await service.delete_account(user_id, auth0_id)

        # Local deletion succeeded, but Auth0 failed
        assert result.success is True  # Overall success because local deletion worked
        assert result.progress_deleted is True
        assert result.user_deleted is True
        assert result.auth0_deleted is False
        assert result.error_message is not None
        assert "contact support" in result.error_message.lower()

        # Verify sentry was called
        mock_sentry.capture_exception.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_without_auth0_id(self, service, mock_user):
        """Test deletion for user without Auth0 identity."""
        user_id = mock_user.id

        # Mock successful local operations
        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        # Mock Auth0 client (should not be called)
        with patch(
            "src.services.user_deletion_service.get_auth0_management_client"
        ) as mock_get_client:
            mock_auth0_client = MagicMock()
            mock_get_client.return_value = mock_auth0_client

            # Call without auth0_id
            result = await service.delete_account(user_id, auth0_id=None)

        # Verify result
        assert result.success is True
        assert result.progress_deleted is True
        assert result.user_deleted is True
        assert result.auth0_deleted is None  # None indicates not attempted
        assert result.error_message is None

        # Verify Auth0 delete was NOT called
        mock_auth0_client.delete_user.assert_not_called()

    @pytest.mark.asyncio
    async def test_delete_sets_correct_result_flags(self, service, mock_user):
        """Test that result flags are set correctly at each step."""
        user_id = mock_user.id
        auth0_id = mock_user.auth0_id

        # Mock all operations
        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        with patch(
            "src.services.user_deletion_service.get_auth0_management_client"
        ) as mock_get_client:
            mock_auth0_client = MagicMock()
            mock_auth0_client.delete_user = AsyncMock(return_value=True)
            mock_get_client.return_value = mock_auth0_client

            result = await service.delete_account(user_id, auth0_id)

        # All flags should be True
        assert result.success is True
        assert result.progress_deleted is True
        assert result.user_deleted is True
        assert result.auth0_deleted is True

    @pytest.mark.asyncio
    async def test_delete_with_auth0_m2m_not_configured(self, service, mock_user):
        """Test deletion when Auth0 M2M is not configured."""
        user_id = mock_user.id
        auth0_id = mock_user.auth0_id

        # Mock successful local operations
        mock_reset_result = MagicMock()
        service.reset_service.reset_all_progress = AsyncMock(return_value=mock_reset_result)
        service.user_repository.get = AsyncMock(return_value=mock_user)
        service.user_repository.delete = AsyncMock()

        # Mock get_auth0_management_client returning None (not configured)
        with patch(
            "src.services.user_deletion_service.get_auth0_management_client"
        ) as mock_get_client:
            mock_get_client.return_value = None

            result = await service.delete_account(user_id, auth0_id)

        # Local deletion should succeed, auth0_deleted stays None
        assert result.success is True
        assert result.progress_deleted is True
        assert result.user_deleted is True
        assert result.auth0_deleted is None  # None = M2M not configured

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

        result = await service.delete_account(user_id, auth0_id=None)

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
            result = await service.delete_account(user_id, auth0_id=None)

        # Should fail completely
        assert result.success is False
        assert result.progress_deleted is False
        assert result.user_deleted is False
        assert result.error_message is not None

        # User deletion should not be attempted since reset failed
        service.user_repository.get.assert_not_awaited()

        # Sentry should capture the exception
        mock_sentry.capture_exception.assert_called_once()


@pytest.mark.unit
class TestDeletionResult:
    """Tests for DeletionResult dataclass."""

    def test_deletion_result_defaults(self):
        """Test DeletionResult default values."""
        result = DeletionResult(
            success=False,
            progress_deleted=False,
            user_deleted=False,
            auth0_deleted=None,
        )
        assert result.success is False
        assert result.progress_deleted is False
        assert result.user_deleted is False
        assert result.auth0_deleted is None
        assert result.error_message is None

    def test_deletion_result_with_error(self):
        """Test DeletionResult with error message."""
        result = DeletionResult(
            success=True,
            progress_deleted=True,
            user_deleted=True,
            auth0_deleted=False,
            error_message="Auth0 deletion failed",
        )
        assert result.success is True
        assert result.auth0_deleted is False
        assert result.error_message == "Auth0 deletion failed"
