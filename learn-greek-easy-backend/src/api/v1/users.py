"""Users API endpoints.

This module provides endpoints for user account management,
including dangerous operations like resetting progress and deleting accounts.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user
from src.core.logging import get_logger
from src.db.dependencies import get_db
from src.db.models import User
from src.services.user_deletion_service import UserDeletionService
from src.services.user_progress_reset_service import UserProgressResetService

logger = get_logger(__name__)

router = APIRouter(
    # Note: prefix is set by parent router in v1/router.py
    # This router is mounted at /users under the /api/v1 prefix
    tags=["Users"],
    responses={
        401: {"description": "Not authenticated"},
        422: {"description": "Validation error"},
    },
)


@router.post(
    "/me/reset-progress",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Reset all learning progress",
    description="""
    Reset all learning progress for the current user.

    This is a **destructive operation** that will permanently delete:
    - All card statistics and review history
    - All deck progress
    - All XP and achievements
    - Study streaks and time tracking

    This action cannot be undone. The user's account and preferences
    will be preserved, but all learning data will be removed.
    """,
    responses={
        204: {"description": "Progress reset successfully"},
        401: {"description": "Not authenticated - missing or invalid token"},
    },
)
async def reset_user_progress(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Reset all learning progress for the current user.

    This endpoint will delete all learning-related data while
    preserving the user account and settings.

    Args:
        current_user: Authenticated user (injected)
        db: Database session (injected)

    Returns:
        None (204 No Content on success)
    """
    logger.info(
        "Reset progress requested",
        extra={"user_id": str(current_user.id)},
    )

    try:
        service = UserProgressResetService(db)
        result = await service.reset_all_progress(current_user.id)

        logger.info(
            "Progress reset completed",
            extra={
                "user_id": str(current_user.id),
                "total_deleted": result.total_deleted,
            },
        )
        # Return None for 204 No Content - get_db auto-commits

    except Exception as e:
        logger.error(
            "Failed to reset user progress",
            extra={
                "user_id": str(current_user.id),
                "error": str(e),
                "error_type": type(e).__name__,
            },
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset progress. Please try again.",
        )


@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete user account",
    description="""
    Delete the current user's account and all associated data.

    This is a **destructive operation** that will permanently delete:
    - The user account
    - All user settings and preferences
    - All learning progress and statistics
    - All review history
    - All XP and achievements
    - The Auth0 account

    This action cannot be undone. The user will be logged out and
    their account will be permanently removed from the system.
    """,
    responses={
        204: {"description": "Account deleted successfully"},
        401: {"description": "Not authenticated - missing or invalid token"},
    },
)
async def delete_user_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete the current user's account and all data.

    This endpoint will permanently delete the user's account
    and all associated data from both the database and Auth0.

    Args:
        current_user: Authenticated user (injected)
        db: Database session (injected)

    Returns:
        None (204 No Content on success)
    """
    logger.info(
        "Delete account requested",
        extra={"user_id": str(current_user.id)},
    )

    try:
        service = UserDeletionService(db)
        result = await service.delete_account(
            user_id=current_user.id,
            auth0_id=current_user.auth0_id,  # type: ignore[attr-defined]  # SUPA-06: Rename to supabase_id
        )

        if not result.success:
            # Complete failure - local deletion failed
            logger.error(
                "Account deletion failed",
                extra={
                    "user_id": str(current_user.id),
                    "error_message": result.error_message,
                },
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete account. Please try again.",
            )

        # Check for Auth0 partial failure (per PRD: return 500 if Auth0 fails)
        if result.auth0_deleted is False:  # False = tried but failed, None = not attempted
            logger.warning(
                "Account deleted but Auth0 cleanup failed",
                extra={
                    "user_id": str(current_user.id),
                    "auth0_error": result.error_message,
                },
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Account deleted but authentication cleanup failed. Please contact support.",
            )

        logger.info(
            "Account deleted successfully",
            extra={
                "user_id": str(current_user.id),
                "progress_deleted": result.progress_deleted,
                "auth0_deleted": result.auth0_deleted,
            },
        )
        # Return None for 204 No Content - get_db auto-commits

    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        logger.error(
            "Unexpected error during account deletion",
            extra={
                "user_id": str(current_user.id),
                "error": str(e),
                "error_type": type(e).__name__,
            },
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete account. Please try again.",
        )
