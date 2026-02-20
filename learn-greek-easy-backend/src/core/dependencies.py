"""Authentication dependencies for FastAPI routes.

This module provides dependency injection functions for authentication:
- get_current_user: Main auth dependency that validates Supabase token and loads/creates user
- get_current_superuser: Admin-only dependency requiring is_superuser=True
- get_current_user_optional: Optional auth for mixed authenticated/anonymous endpoints
- get_or_create_user: Auto-provision users from Supabase JWT claims

Usage:
    from src.core.dependencies import get_current_user, get_current_superuser

    @router.get("/profile")
    async def get_profile(current_user: User = Depends(get_current_user)):
        return current_user

    @router.get("/admin/users")
    async def list_users(admin: User = Depends(get_current_superuser)):
        return await get_all_users()
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.exceptions import (
    ConflictException,
    ForbiddenException,
    TokenExpiredException,
    TokenInvalidException,
    UnauthorizedException,
)
from src.core.logging import bind_log_context
from src.core.posthog import capture_event
from src.core.sentry import set_user_context
from src.core.supabase_auth import SupabaseUserClaims, verify_supabase_token
from src.db.dependencies import get_db
from src.db.models import SubscriptionStatus, User, UserSettings

# HTTPBearer security scheme with auto_error=False
# This allows us to handle missing auth gracefully for optional auth endpoints
security_scheme = HTTPBearer(auto_error=False)


async def get_or_create_user(db: AsyncSession, claims: SupabaseUserClaims) -> User:
    """Get or create a user based on Supabase JWT claims.

    This function implements auto-provisioning: on first login with a valid
    Supabase token, a new user record is created automatically.

    The function handles:
    - Existing user lookup by supabase_id
    - Email-based upsert (updates supabase_id if email exists)
    - New user creation with default UserSettings
    - Race condition handling (concurrent first-login requests)

    Args:
        db: Database session
        claims: Verified Supabase user claims from JWT

    Returns:
        User: Existing or newly created user with settings relationship loaded

    Note:
        Uses db.flush() (not db.commit()) - the get_db() dependency
        handles commit automatically after the route handler returns.
    """
    # 1. Try to find existing user by supabase_id
    stmt = (
        select(User)
        .options(selectinload(User.settings))
        .where(User.supabase_id == claims.supabase_id)
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is not None:
        return user

    # 2. Check if user exists by email (upsert pattern)
    # If user exists with same email but different supabase_id, update supabase_id
    # (Supabase Auth is the source of truth for auth identity)
    if claims.email:
        email_stmt = (
            select(User).options(selectinload(User.settings)).where(User.email == claims.email)
        )
        email_result = await db.execute(email_stmt)
        existing_by_email = email_result.scalar_one_or_none()

        if existing_by_email is not None:
            # Update supabase_id to match current Supabase Auth identity
            existing_by_email.supabase_id = claims.supabase_id
            await db.flush()
            return existing_by_email

    # 3. Handle missing email (User.email is NOT NULL)
    # Supabase tokens always have email for email/password and OAuth flows.
    # For phone-only auth (not currently used), generate a placeholder.
    user_email = claims.email or f"{claims.supabase_id}@supabase.placeholder"

    # 4. Create new user with IntegrityError handling for race conditions
    now = datetime.now(timezone.utc)
    new_user = User(
        supabase_id=claims.supabase_id,
        email=user_email,
        full_name=claims.full_name,
        is_active=True,
        is_superuser=False,
        subscription_status=SubscriptionStatus.TRIALING,
        trial_start_date=now,
        trial_end_date=now + timedelta(days=14),
    )
    db.add(new_user)
    try:
        await db.flush()  # Get the generated UUID
    except IntegrityError:
        await db.rollback()
        # Race condition: another request created this user concurrently.
        # Re-query to return the user created by the other request.
        stmt = (
            select(User)
            .options(selectinload(User.settings))
            .where(User.supabase_id == claims.supabase_id)
        )
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        if user is not None:
            return user
        # Unexpected IntegrityError (should not happen with current logic)
        raise

    # 5. Create default UserSettings
    new_settings = UserSettings(
        user_id=new_user.id,
        daily_goal=20,
        email_notifications=True,
    )
    db.add(new_settings)
    await db.flush()

    # 6. Reload user with settings relationship
    await db.refresh(new_user, ["settings"])
    capture_event(
        distinct_id=str(new_user.id),
        event="trial_started",
        properties={
            "trial_duration_days": 14,
            "trial_start_date": now.isoformat(),
            "trial_end_date": (now + timedelta(days=14)).isoformat(),
        },
        user_email=new_user.email,
    )
    return new_user


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get the current authenticated user from Supabase JWT token.

    This dependency:
    1. Extracts and verifies the Supabase JWT token
    2. Auto-provisions new users on first login
    3. Validates user is active
    4. Sets up Sentry and logging context

    Args:
        request: The HTTP request (for storing user context)
        credentials: HTTP Authorization credentials from Bearer token
        db: Database session

    Returns:
        User: The authenticated user with settings loaded

    Raises:
        UnauthorizedException (401): If no token, invalid token, expired token,
            or user account is deactivated
        ConflictException (409): If email already exists with different account

    Example:
        @router.get("/me")
        async def get_me(current_user: User = Depends(get_current_user)):
            return UserProfileResponse.model_validate(current_user)
    """
    # 1. Extract Bearer token
    if not credentials:
        raise UnauthorizedException(
            detail="Authentication required. Please provide a valid access token."
        )

    token = credentials.credentials

    # 2. Verify Supabase token and extract claims
    try:
        claims = await verify_supabase_token(token)
    except TokenExpiredException:
        raise UnauthorizedException(detail="Access token has expired. Please refresh your token.")
    except TokenInvalidException as e:
        raise UnauthorizedException(detail=f"Invalid access token: {e.detail}")

    # 2a. Store claims on request.state for use in endpoints
    request.state.supabase_claims = claims

    # 3. Get or create user (auto-provisioning)
    user = await get_or_create_user(db, claims)

    # 4. Check if user is active
    if not user.is_active:
        raise UnauthorizedException(detail="User account has been deactivated.")

    # 5. Set Sentry user context for error tracking
    set_user_context(
        user_id=str(user.id),
        email=user.email,
        username=user.full_name,
    )

    # 6. Bind user context for logging - all subsequent logs will include user_id
    bind_log_context(user_id=str(user.id))

    # 7. Store user email in request state for exception handlers
    request.state.user_email = user.email

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
        raise ForbiddenException(detail="Superuser privileges required for this action.")

    return current_user


async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Get the current user if authenticated, otherwise return None.

    This is for endpoints that have different behavior for authenticated
    vs anonymous users. For example, showing personalized content for
    logged-in users but generic content for anonymous visitors.

    Uses the same Supabase token verification and auto-provisioning as
    get_current_user, but returns None for any auth failures instead of
    raising exceptions.

    Args:
        request: The HTTP request (for storing user context)
        credentials: HTTP Authorization credentials from Bearer token (optional)
        db: Database session

    Returns:
        Optional[User]: The authenticated user if valid token provided,
            None if no token, invalid token, or user inactive

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

    # Try to verify the Supabase token
    try:
        claims = await verify_supabase_token(token)
    except (TokenExpiredException, TokenInvalidException, UnauthorizedException):
        # Invalid/expired token or Supabase not configured - treat as anonymous
        return None

    # Store claims on request.state for use in endpoints
    request.state.supabase_claims = claims

    # Try to get or create user
    try:
        user = await get_or_create_user(db, claims)
    except ConflictException:
        # Email conflict - treat as anonymous (edge case)
        return None

    # User inactive - treat as anonymous
    if not user.is_active:
        return None

    # Set Sentry user context for error tracking
    set_user_context(
        user_id=str(user.id),
        email=user.email,
        username=user.full_name,
    )

    # Bind user context for logging - all subsequent logs will include user_id
    bind_log_context(user_id=str(user.id))

    # Store user email in request state for exception handlers
    request.state.user_email = user.email

    return user


def get_locale_from_header(
    accept_language: str | None = Header(default=None, alias="Accept-Language"),
) -> str:
    """FastAPI dependency to extract locale from Accept-Language header.

    Supports formats:
    - "el" -> "el"
    - "el-GR" -> "el"
    - "el,en;q=0.9" -> "el" (highest priority)

    Returns:
        Two-letter locale code (defaults to "en" if parsing fails)
    """
    if not accept_language:
        return "en"

    # Split by comma and process each language tag
    languages = []
    for part in accept_language.split(","):
        part = part.strip()
        if not part:
            continue

        # Split language from quality factor (e.g., "el;q=0.9")
        if ";" in part:
            lang_part, q_part = part.split(";", 1)
            lang_part = lang_part.strip()
            try:
                q_value = float(q_part.strip().replace("q=", ""))
            except ValueError:
                q_value = 1.0
        else:
            lang_part = part
            q_value = 1.0

        # Extract base language (e.g., "el-GR" -> "el")
        base_lang = lang_part.split("-")[0].lower()

        if base_lang:
            languages.append((base_lang, q_value))

    # Sort by quality factor (descending) and return highest
    if languages:
        languages.sort(key=lambda x: x[1], reverse=True)
        return languages[0][0]

    return "en"


# ============================================================================
# Export Public API
# ============================================================================

__all__ = [
    "get_current_user",
    "get_current_superuser",
    "get_current_user_optional",
    "get_locale_from_header",
    "get_or_create_user",
    "security_scheme",
]
