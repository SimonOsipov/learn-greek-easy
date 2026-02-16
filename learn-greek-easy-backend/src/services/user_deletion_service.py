"""User Account Deletion Service for Danger Zone operations.

Provides complete account deletion including:
- All user progress data
- User database record
- Supabase identity (if configured)

IMPORTANT: This service orchestrates deletion across multiple systems.
Supabase deletion failures do NOT rollback local deletion per PRD decision.
"""

from dataclasses import dataclass
from typing import Optional
from uuid import UUID

import sentry_sdk
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import SupabaseAdminError
from src.core.logging import get_logger
from src.core.supabase_admin import get_supabase_admin_client
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
        supabase_deleted: True if Supabase user was deleted, None if admin not configured
        error_message: Human-readable error message for partial failures
    """

    success: bool
    progress_deleted: bool
    user_deleted: bool
    supabase_deleted: Optional[bool]
    error_message: Optional[str] = None


class UserDeletionService:
    """Service for complete account deletion.

    Orchestrates the deletion of:
    1. All progress data (via UserProgressResetService, includes cache clearing)
    2. User database record
    3. Supabase identity (if admin configured)

    Important notes:
    - Does NOT commit the transaction - caller must commit
    - Supabase failures are logged but do not fail the operation
    - Local deletion proceeds even if Supabase deletion fails (per PRD)

    Usage:
        async with async_session() as db:
            service = UserDeletionService(db)
            result = await service.delete_account(user_id, supabase_id)
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

    async def delete_account(
        self, user_id: UUID, supabase_id: Optional[str] = None
    ) -> DeletionResult:
        """Delete user account completely.

        Order of operations (per PRD):
        1. Delete all progress data via UserProgressResetService (includes cache)
        2. Delete user record from database
        3. Delete user from Supabase (if supabase_id provided and admin configured)

        Note: Supabase deletion failure does NOT rollback local deletion.
        The user is considered deleted locally; orphaned Supabase identity
        is logged to Sentry for manual cleanup.

        Args:
            user_id: UUID of the user to delete
            supabase_id: Optional Supabase user UUID

        Returns:
            DeletionResult indicating success/failure of each step
        """
        result = DeletionResult(
            success=False,
            progress_deleted=False,
            user_deleted=False,
            supabase_deleted=None,  # None = admin not configured or no supabase_id
        )

        try:
            # Step 1: Delete all progress data (reuses reset service)
            # This also clears Redis cache for the user
            logger.info(
                "Starting account deletion",
                extra={"user_id": str(user_id), "has_supabase_id": supabase_id is not None},
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

            # Step 3: Delete from Supabase (if applicable)
            if supabase_id:
                supabase_client = get_supabase_admin_client()
                if supabase_client is None:
                    logger.warning(
                        "Supabase admin not configured, skipping Supabase deletion",
                        extra={
                            "user_id": str(user_id),
                            "supabase_id_prefix": supabase_id[:8],
                        },
                    )
                    # Leave supabase_deleted as None to indicate admin not configured
                else:
                    try:
                        await supabase_client.delete_user(supabase_id)
                        result.supabase_deleted = True
                        logger.info(
                            "Supabase user deleted successfully",
                            extra={
                                "user_id": str(user_id),
                                "supabase_id_prefix": supabase_id[:8],
                            },
                        )
                    except SupabaseAdminError as e:
                        # Log but don't fail - per PRD decision
                        result.supabase_deleted = False
                        result.error_message = (
                            "Account deleted locally but Supabase deletion failed. "
                            "Please contact support if you experience login issues."
                        )
                        logger.error(
                            "Supabase deletion failed after local deletion",
                            extra={
                                "user_id": str(user_id),
                                "supabase_id_prefix": supabase_id[:8],
                                "error": str(e),
                            },
                        )
                        sentry_sdk.capture_exception(e)
            else:
                # No supabase_id - nothing to delete from Supabase
                logger.debug(
                    "No Supabase ID provided, skipping Supabase deletion",
                    extra={"user_id": str(user_id)},
                )

            result.success = True
            logger.info(
                "Account deletion completed successfully",
                extra={
                    "user_id": str(user_id),
                    "progress_deleted": result.progress_deleted,
                    "user_deleted": result.user_deleted,
                    "supabase_deleted": result.supabase_deleted,
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
