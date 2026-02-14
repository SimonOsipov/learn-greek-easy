"""User Account Deletion Service for Danger Zone operations.

Provides complete account deletion including:
- All user progress data
- User database record
- Auth0 identity (if configured)

IMPORTANT: This service orchestrates deletion across multiple systems.
Auth0 deletion failures do NOT rollback local deletion per PRD decision.
"""

from dataclasses import dataclass
from typing import Optional
from uuid import UUID

import sentry_sdk
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.auth0_management import SupabaseAdminError, get_auth0_management_client
from src.core.logging import get_logger
from src.repositories import UserRepository
from src.services.user_progress_reset_service import UserProgressResetService

logger = get_logger(__name__)


@dataclass
class DeletionResult:
    """Result of account deletion operation.

    Attributes:
        success: True if the core deletion (local DB) succeeded
        progress_deleted: True if all progress data was deleted
        user_deleted: True if user record was deleted from database
        auth0_deleted: True if Auth0 user was deleted, None if M2M not configured
        error_message: Human-readable error message for partial failures
    """

    success: bool
    progress_deleted: bool
    user_deleted: bool
    auth0_deleted: Optional[bool]
    error_message: Optional[str] = None


class UserDeletionService:
    """Service for complete account deletion.

    Orchestrates the deletion of:
    1. All progress data (via UserProgressResetService, includes cache clearing)
    2. User database record
    3. Auth0 identity (if M2M is configured)

    Important notes:
    - Does NOT commit the transaction - caller must commit
    - Auth0 failures are logged but do not fail the operation
    - Local deletion proceeds even if Auth0 deletion fails (per PRD)

    Usage:
        async with async_session() as db:
            service = UserDeletionService(db)
            result = await service.delete_account(user_id, auth0_id)
            if result.success:
                await db.commit()  # Caller commits the transaction
    """

    def __init__(self, db: AsyncSession):
        """Initialize the service with database session.

        Args:
            db: Async database session for persistence operations
        """
        self.db = db
        self.reset_service = UserProgressResetService(db)
        self.user_repository = UserRepository(db)

    async def delete_account(self, user_id: UUID, auth0_id: Optional[str] = None) -> DeletionResult:
        """Delete user account completely.

        Order of operations (per PRD):
        1. Delete all progress data via UserProgressResetService (includes cache)
        2. Delete user record from database
        3. Delete user from Auth0 (if auth0_id provided and M2M configured)

        Note: Auth0 deletion failure does NOT rollback local deletion.
        The user is considered deleted locally; orphaned Auth0 identity
        is logged to Sentry for manual cleanup.

        Args:
            user_id: UUID of the user to delete
            auth0_id: Optional Auth0 user ID (e.g., 'auth0|123456')

        Returns:
            DeletionResult indicating success/failure of each step
        """
        result = DeletionResult(
            success=False,
            progress_deleted=False,
            user_deleted=False,
            auth0_deleted=None,  # None = M2M not configured or no auth0_id
        )

        try:
            # Step 1: Delete all progress data (reuses reset service)
            # This also clears Redis cache for the user
            logger.info(
                "Starting account deletion",
                extra={"user_id": str(user_id), "has_auth0_id": auth0_id is not None},
            )

            await self.reset_service.reset_all_progress(user_id)
            result.progress_deleted = True
            logger.debug(
                "Progress data deleted",
                extra={"user_id": str(user_id)},
            )

            # Step 2: Delete user from database
            user = await self.user_repository.get(user_id)
            if user is None:
                # User already deleted - this is an edge case but not an error
                logger.warning(
                    "User not found during deletion (may already be deleted)",
                    extra={"user_id": str(user_id)},
                )
                result.user_deleted = True
                result.success = True
                return result

            await self.user_repository.delete(user)
            result.user_deleted = True
            logger.info(
                "User record deleted from database",
                extra={"user_id": str(user_id)},
            )

            # Step 3: Delete from Auth0 (if applicable)
            if auth0_id:
                auth0_client = get_auth0_management_client()
                if auth0_client is None:
                    logger.warning(
                        "Auth0 M2M not configured, skipping Auth0 deletion",
                        extra={
                            "user_id": str(user_id),
                            "auth0_id": auth0_id[:20] + "..." if len(auth0_id) > 20 else auth0_id,
                        },
                    )
                    # Leave auth0_deleted as None to indicate M2M not configured
                else:
                    try:
                        await auth0_client.delete_user(auth0_id)
                        result.auth0_deleted = True
                        logger.info(
                            "Auth0 user deleted successfully",
                            extra={
                                "user_id": str(user_id),
                                "auth0_id": (
                                    auth0_id[:20] + "..." if len(auth0_id) > 20 else auth0_id
                                ),
                            },
                        )
                    except SupabaseAdminError as e:
                        # Log but don't fail - per PRD decision
                        result.auth0_deleted = False
                        result.error_message = (
                            "Account deleted locally but Auth0 deletion failed. "
                            "Please contact support if you experience login issues."
                        )
                        logger.error(
                            "Auth0 deletion failed after local deletion",
                            extra={
                                "user_id": str(user_id),
                                "auth0_id": (
                                    auth0_id[:20] + "..." if len(auth0_id) > 20 else auth0_id
                                ),
                                "error": str(e),
                            },
                        )
                        sentry_sdk.capture_exception(e)
            else:
                # No auth0_id - nothing to delete from Auth0
                logger.debug(
                    "No Auth0 ID provided, skipping Auth0 deletion",
                    extra={"user_id": str(user_id)},
                )

            result.success = True
            logger.info(
                "Account deletion completed successfully",
                extra={
                    "user_id": str(user_id),
                    "progress_deleted": result.progress_deleted,
                    "user_deleted": result.user_deleted,
                    "auth0_deleted": result.auth0_deleted,
                },
            )
            return result

        except Exception as e:
            logger.error(
                "Account deletion failed",
                extra={
                    "user_id": str(user_id),
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "progress_deleted": result.progress_deleted,
                    "user_deleted": result.user_deleted,
                },
            )
            sentry_sdk.capture_exception(e)
            result.error_message = "Failed to delete account. Please try again."
            return result


__all__ = ["UserDeletionService", "DeletionResult"]
