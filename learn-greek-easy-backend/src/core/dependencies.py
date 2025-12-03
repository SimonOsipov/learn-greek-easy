"""Authentication dependencies for FastAPI routes.

This module provides dependency injection functions for authentication:
- get_current_user: Main auth dependency that validates token and loads user
- get_current_superuser: Admin-only dependency requiring is_superuser=True
- get_current_user_optional: Optional auth for mixed authenticated/anonymous endpoints

Usage:
    from src.core.dependencies import get_current_user, get_current_superuser

    @router.get("/profile")
    async def get_profile(current_user: User = Depends(get_current_user)):
        return current_user

    @router.get("/admin/users")
    async def list_users(admin: User = Depends(get_current_superuser)):
        return await get_all_users()
"""

from typing import Optional

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.exceptions import (
    ForbiddenException,
    TokenExpiredException,
    TokenInvalidException,
    UnauthorizedException,
    UserNotFoundException,
)
from src.core.security import verify_token
from src.db.dependencies import get_db
from src.db.models import User

# HTTPBearer security scheme with auto_error=False
# This allows us to handle missing auth gracefully for optional auth endpoints
security_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get the current authenticated user from the JWT token.

    This is the main authentication dependency. It:
    1. Extracts the Bearer token from the Authorization header
    2. Validates the JWT token (signature, expiration, type)
    3. Loads the user from the database with their settings
    4. Verifies the user is active

    Args:
        credentials: HTTP Authorization credentials from Bearer token
        db: Database session (injected)

    Returns:
        User: The authenticated user with settings loaded

    Raises:
        UnauthorizedException (401): If no token provided, token expired,
            token invalid, or user is inactive
        UserNotFoundException (404): If user no longer exists in database

    Example:
        @router.get("/me")
        async def get_me(current_user: User = Depends(get_current_user)):
            return UserProfileResponse.model_validate(current_user)
    """
    # Check if credentials were provided
    if not credentials:
        raise UnauthorizedException(
            detail="Authentication required. Please provide a valid access token."
        )

    token = credentials.credentials

    # Verify the JWT token
    try:
        user_id = verify_token(token, token_type="access")
    except TokenExpiredException:
        raise UnauthorizedException(
            detail="Access token has expired. Please refresh your token."
        )
    except TokenInvalidException as e:
        raise UnauthorizedException(detail=f"Invalid access token: {e.detail}")

    # Load user from database with settings
    stmt = (
        select(User)
        .options(selectinload(User.settings))
        .where(User.id == user_id)
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    # Check if user exists
    if user is None:
        raise UserNotFoundException(user_id=str(user_id))

    # Check if user is active
    if not user.is_active:
        raise UnauthorizedException(
            detail="User account has been deactivated."
        )

    return user


async def get_current_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get the current authenticated superuser.

    This dependency builds on get_current_user and adds a superuser check.
    Use this for admin-only endpoints.

    Args:
        current_user: The authenticated user (from get_current_user)

    Returns:
        User: The authenticated superuser

    Raises:
        ForbiddenException (403): If user is not a superuser

    Example:
        @router.delete("/users/{user_id}")
        async def delete_user(
            user_id: UUID,
            admin: User = Depends(get_current_superuser)
        ):
            # Only superusers can delete users
            await delete_user_by_id(user_id)
    """
    if not current_user.is_superuser:
        raise ForbiddenException(
            detail="Superuser privileges required for this action."
        )

    return current_user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Get the current user if authenticated, otherwise return None.

    This is for endpoints that have different behavior for authenticated
    vs anonymous users. For example, showing personalized content for
    logged-in users but generic content for anonymous visitors.

    Args:
        credentials: HTTP Authorization credentials from Bearer token (optional)
        db: Database session (injected)

    Returns:
        Optional[User]: The authenticated user if valid token provided,
            None if no token or token invalid

    Example:
        @router.get("/decks")
        async def list_decks(
            current_user: Optional[User] = Depends(get_current_user_optional)
        ):
            if current_user:
                # Return personalized deck list with progress
                return await get_user_decks(current_user.id)
            else:
                # Return public deck list
                return await get_public_decks()
    """
    # No credentials provided - anonymous request
    if not credentials:
        return None

    token = credentials.credentials

    # Try to verify the token
    try:
        user_id = verify_token(token, token_type="access")
    except (TokenExpiredException, TokenInvalidException):
        # Invalid token - treat as anonymous
        return None

    # Load user from database with settings
    stmt = (
        select(User)
        .options(selectinload(User.settings))
        .where(User.id == user_id)
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    # User not found or inactive - treat as anonymous
    if user is None or not user.is_active:
        return None

    return user


# ============================================================================
# Export Public API
# ============================================================================

__all__ = [
    "get_current_user",
    "get_current_superuser",
    "get_current_user_optional",
    "security_scheme",
]
