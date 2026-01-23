"""Authentication fixtures for testing.

This module provides comprehensive authentication fixtures:
- test_user: A regular active user
- test_superuser: A superuser for admin testing
- test_unverified_user: User without email verification
- test_inactive_user: Deactivated user account
- auth_headers: Pre-built Authorization headers
- access_token: Valid JWT access token
- refresh_token: Valid JWT refresh token

All fixtures use PostgreSQL and integrate with the db_session fixture.

Note: All test users are created as Auth0-style users (no password hash)
since password-based authentication has been removed.

Usage:
    async def test_protected_endpoint(client: AsyncClient, auth_headers: dict):
        response = await client.get("/api/v1/protected", headers=auth_headers)
        assert response.status_code == 200

    async def test_admin_only(client: AsyncClient, superuser_auth_headers: dict):
        response = await client.delete("/api/v1/admin/users/123", headers=superuser_auth_headers)
        assert response.status_code == 200
"""

from collections.abc import AsyncGenerator
from datetime import datetime, timedelta
from typing import Any, NamedTuple
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.security import create_access_token, create_refresh_token
from src.db.models import RefreshToken, User, UserSettings

# =============================================================================
# Type Definitions
# =============================================================================


class AuthTokens(NamedTuple):
    """Container for access and refresh tokens with expiry info."""

    access_token: str
    refresh_token: str
    access_expires: datetime
    refresh_expires: datetime


class AuthenticatedUser(NamedTuple):
    """Container for user with tokens and headers."""

    user: User
    tokens: AuthTokens
    headers: dict[str, str]


# =============================================================================
# User Data Factories
# =============================================================================


def create_test_user_data(
    email: str | None = None,
    full_name: str = "Test User",
    is_active: bool = True,
    is_superuser: bool = False,
    email_verified: bool = False,
    auth0_id: str | None = None,
) -> dict[str, Any]:
    """Create test user data dictionary.

    All test users are created as Auth0-style users (no password hash)
    since password-based authentication has been removed.

    Args:
        email: User email (auto-generated if None)
        full_name: User's full name
        is_active: Whether user account is active
        is_superuser: Whether user has superuser privileges
        email_verified: Whether email is verified
        auth0_id: Auth0 user ID (auto-generated if None)

    Returns:
        dict: User data ready for User model creation
    """
    if email is None:
        email = f"testuser_{uuid4().hex[:8]}@example.com"

    if auth0_id is None:
        auth0_id = f"auth0|test_{uuid4().hex[:16]}"

    return {
        "email": email,
        "password_hash": None,  # Auth0 users don't have password
        "full_name": full_name,
        "is_active": is_active,
        "is_superuser": is_superuser,
        "email_verified_at": datetime.utcnow() if email_verified else None,
        "auth0_id": auth0_id,
    }


async def create_user_with_settings(
    db_session: AsyncSession,
    user_data: dict[str, Any],
    daily_goal: int = 20,
    email_notifications: bool = True,
) -> User:
    """Create a user with associated settings in the database.

    Args:
        db_session: Database session
        user_data: User attributes dictionary
        daily_goal: Daily learning goal
        email_notifications: Email notification preference

    Returns:
        User: Created user with settings
    """
    user = User(**user_data)
    db_session.add(user)
    await db_session.flush()

    settings = UserSettings(
        user_id=user.id,
        daily_goal=daily_goal,
        email_notifications=email_notifications,
    )
    db_session.add(settings)
    await db_session.commit()

    # Reload user with settings using selectinload (required for lazy="raise")
    stmt = select(User).options(selectinload(User.settings)).where(User.id == user.id)
    result = await db_session.execute(stmt)
    user = result.scalar_one()

    return user


def create_tokens_for_user(user: User) -> AuthTokens:
    """Create JWT tokens for a user.

    Args:
        user: User to create tokens for

    Returns:
        AuthTokens: Container with access and refresh tokens
    """
    access_token, access_expires = create_access_token(user.id)
    refresh_token, refresh_expires, _ = create_refresh_token(user.id)

    return AuthTokens(
        access_token=access_token,
        refresh_token=refresh_token,
        access_expires=access_expires,
        refresh_expires=refresh_expires,
    )


def create_auth_headers(access_token: str) -> dict[str, str]:
    """Create Authorization headers for HTTP requests.

    Args:
        access_token: JWT access token

    Returns:
        dict: Headers with Bearer token
    """
    return {"Authorization": f"Bearer {access_token}"}


# =============================================================================
# Core User Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> AsyncGenerator[User, None]:
    """Provide a regular active test user.

    Creates a user with:
    - Valid email and password
    - Active account (is_active=True)
    - Regular user (is_superuser=False)
    - Unverified email (email_verified_at=None)

    Yields:
        User: The created test user
    """
    user_data = create_test_user_data(
        full_name="Regular Test User",
        is_active=True,
        is_superuser=False,
        email_verified=False,
    )
    user = await create_user_with_settings(db_session, user_data)
    yield user


@pytest_asyncio.fixture
async def test_superuser(db_session: AsyncSession) -> AsyncGenerator[User, None]:
    """Provide a superuser for admin testing.

    Creates a user with:
    - Valid email and password
    - Active account (is_active=True)
    - Superuser privileges (is_superuser=True)
    - Verified email

    Yields:
        User: The created superuser
    """
    user_data = create_test_user_data(
        email=f"admin_{uuid4().hex[:8]}@example.com",
        full_name="Admin Superuser",
        is_active=True,
        is_superuser=True,
        email_verified=True,
    )
    user = await create_user_with_settings(db_session, user_data)
    yield user


@pytest_asyncio.fixture
async def test_verified_user(db_session: AsyncSession) -> AsyncGenerator[User, None]:
    """Provide a user with verified email.

    Creates a user with:
    - Valid email and password
    - Active account
    - Regular user (not superuser)
    - Verified email (email_verified_at set)

    Yields:
        User: The created verified user
    """
    user_data = create_test_user_data(
        full_name="Verified User",
        is_active=True,
        is_superuser=False,
        email_verified=True,
    )
    user = await create_user_with_settings(db_session, user_data)
    yield user


@pytest_asyncio.fixture
async def test_inactive_user(db_session: AsyncSession) -> AsyncGenerator[User, None]:
    """Provide an inactive/deactivated user.

    Creates a user with:
    - Valid email and password
    - Inactive account (is_active=False)
    - Regular user

    Use this to test that inactive users cannot authenticate.

    Yields:
        User: The created inactive user
    """
    user_data = create_test_user_data(
        full_name="Inactive User",
        is_active=False,
        is_superuser=False,
    )
    user = await create_user_with_settings(db_session, user_data)
    yield user


# =============================================================================
# Token Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def test_user_tokens(test_user: User) -> AuthTokens:
    """Provide valid JWT tokens for the test user.

    Args:
        test_user: The test user fixture

    Returns:
        AuthTokens: Named tuple with access_token, refresh_token, and expiry times
    """
    return create_tokens_for_user(test_user)


@pytest_asyncio.fixture
async def superuser_tokens(test_superuser: User) -> AuthTokens:
    """Provide valid JWT tokens for the superuser.

    Args:
        test_superuser: The superuser fixture

    Returns:
        AuthTokens: Named tuple with access_token, refresh_token, and expiry times
    """
    return create_tokens_for_user(test_superuser)


@pytest_asyncio.fixture
async def access_token(test_user_tokens: AuthTokens) -> str:
    """Provide just the access token string.

    Convenience fixture for tests that only need the access token.

    Args:
        test_user_tokens: The test user tokens fixture

    Returns:
        str: JWT access token
    """
    return test_user_tokens.access_token


@pytest_asyncio.fixture
async def refresh_token_value(
    test_user: User,
    test_user_tokens: AuthTokens,
    db_session: AsyncSession,
) -> str:
    """Provide a refresh token that's stored in the database.

    This fixture creates a valid refresh token AND stores it in the
    database, which is required for token refresh operations.

    Args:
        test_user: The test user
        test_user_tokens: The test user tokens
        db_session: Database session

    Returns:
        str: JWT refresh token (stored in database)
    """
    # Store refresh token in database
    db_refresh_token = RefreshToken(
        user_id=test_user.id,
        token=test_user_tokens.refresh_token,
        expires_at=test_user_tokens.refresh_expires,
    )
    db_session.add(db_refresh_token)
    await db_session.commit()

    return test_user_tokens.refresh_token


# =============================================================================
# Auth Headers Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def auth_headers(test_user_tokens: AuthTokens) -> dict[str, str]:
    """Provide Authorization headers for the test user.

    Ready-to-use headers for making authenticated HTTP requests.

    Args:
        test_user_tokens: The test user tokens fixture

    Returns:
        dict: Headers with "Authorization: Bearer <token>"

    Example:
        async def test_protected_endpoint(client, auth_headers):
            response = await client.get("/api/v1/me", headers=auth_headers)
            assert response.status_code == 200
    """
    return create_auth_headers(test_user_tokens.access_token)


@pytest_asyncio.fixture
async def superuser_auth_headers(superuser_tokens: AuthTokens) -> dict[str, str]:
    """Provide Authorization headers for the superuser.

    Ready-to-use headers for making authenticated admin requests.

    Args:
        superuser_tokens: The superuser tokens fixture

    Returns:
        dict: Headers with "Authorization: Bearer <token>"

    Example:
        async def test_admin_endpoint(client, superuser_auth_headers):
            response = await client.delete("/api/v1/admin/users/123", headers=superuser_auth_headers)
            assert response.status_code == 200
    """
    return create_auth_headers(superuser_tokens.access_token)


# =============================================================================
# Authenticated User Bundle Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def authenticated_user(
    test_user: User,
    test_user_tokens: AuthTokens,
    auth_headers: dict[str, str],
) -> AuthenticatedUser:
    """Provide a complete authenticated user bundle.

    This fixture bundles together the user, their tokens, and auth headers
    for convenient use in tests that need all of these.

    Args:
        test_user: The test user
        test_user_tokens: The test user tokens
        auth_headers: The auth headers

    Returns:
        AuthenticatedUser: Named tuple with user, tokens, and headers

    Example:
        async def test_something(authenticated_user):
            user = authenticated_user.user
            headers = authenticated_user.headers
            tokens = authenticated_user.tokens
    """
    return AuthenticatedUser(
        user=test_user,
        tokens=test_user_tokens,
        headers=auth_headers,
    )


@pytest_asyncio.fixture
async def authenticated_superuser(
    test_superuser: User,
    superuser_tokens: AuthTokens,
    superuser_auth_headers: dict[str, str],
) -> AuthenticatedUser:
    """Provide a complete authenticated superuser bundle.

    Similar to authenticated_user but with superuser privileges.

    Args:
        test_superuser: The superuser
        superuser_tokens: The superuser tokens
        superuser_auth_headers: The superuser auth headers

    Returns:
        AuthenticatedUser: Named tuple with user, tokens, and headers
    """
    return AuthenticatedUser(
        user=test_superuser,
        tokens=superuser_tokens,
        headers=superuser_auth_headers,
    )


# =============================================================================
# Expired Token Fixtures (for testing expiration handling)
# =============================================================================


@pytest.fixture
def expired_access_token() -> str:
    """Provide an expired access token for testing expiration handling.

    Creates a token that expired 1 hour ago.

    Returns:
        str: Expired JWT access token

    Warning:
        This token will fail validation. Use for testing error handling.
    """
    from jose import jwt

    from src.config import settings

    payload = {
        "sub": str(uuid4()),
        "exp": datetime.utcnow() - timedelta(hours=1),  # Expired 1 hour ago
        "iat": datetime.utcnow() - timedelta(hours=2),
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


@pytest.fixture
def invalid_token() -> str:
    """Provide a malformed/invalid token for testing error handling.

    Returns:
        str: Invalid JWT token string
    """
    return "invalid.token.string"


@pytest.fixture
def expired_auth_headers(expired_access_token: str) -> dict[str, str]:
    """Provide Authorization headers with an expired token.

    Args:
        expired_access_token: The expired token fixture

    Returns:
        dict: Headers with expired Bearer token
    """
    return create_auth_headers(expired_access_token)


# =============================================================================
# Multiple Users Fixtures (for testing user isolation)
# =============================================================================


@pytest_asyncio.fixture
async def two_users(db_session: AsyncSession) -> AsyncGenerator[tuple[User, User], None]:
    """Provide two different users for testing user isolation.

    Useful for testing that users cannot access each other's data.

    Yields:
        tuple[User, User]: Two different active users
    """
    user1_data = create_test_user_data(
        email=f"user1_{uuid4().hex[:8]}@example.com",
        full_name="User One",
    )
    user2_data = create_test_user_data(
        email=f"user2_{uuid4().hex[:8]}@example.com",
        full_name="User Two",
    )

    user1 = await create_user_with_settings(db_session, user1_data)
    user2 = await create_user_with_settings(db_session, user2_data)

    yield user1, user2
