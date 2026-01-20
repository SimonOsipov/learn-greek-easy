"""Users API endpoints.

This module provides endpoints for user account management,
including dangerous operations like resetting progress and deleting accounts.
"""

from fastapi import APIRouter, Depends, status

from src.core.dependencies import get_current_user
from src.db.models import User

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
) -> None:
    """Reset all learning progress for the current user.

    This endpoint will delete all learning-related data while
    preserving the user account and settings.

    Args:
        current_user: Authenticated user (injected)

    Returns:
        None (204 No Content on success)
    """
    # TODO: Implement in DANGER-04
    pass


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
) -> None:
    """Delete the current user's account and all data.

    This endpoint will permanently delete the user's account
    and all associated data from both the database and Auth0.

    Args:
        current_user: Authenticated user (injected)

    Returns:
        None (204 No Content on success)
    """
    # TODO: Implement in DANGER-07
    pass
