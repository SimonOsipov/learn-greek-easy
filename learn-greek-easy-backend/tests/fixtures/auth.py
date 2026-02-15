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
from typing import Any, NamedTuple
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import User, UserSettings

# =============================================================================
# Type Definitions
# =============================================================================


class AuthenticatedUser(NamedTuple):
    """Container for user with headers."""

    user: User
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
    supabase_id: str | None = None,
) -> dict[str, Any]:
    """Create test user data dictionary.

    All test users are created with Supabase authentication.

    Args:
        email: User email (auto-generated if None)
        full_name: User's full name
        is_active: Whether user account is active
        is_superuser: Whether user has superuser privileges
        email_verified: Whether email is verified
        supabase_id: Supabase user ID (auto-generated UUID if None)

    Returns:
        dict: User data ready for User model creation
    """
    if email is None:
        email = f"testuser_{uuid4().hex[:8]}@example.com"

    if supabase_id is None:
        supabase_id = str(uuid4())

    return {
        "email": email,
        "full_name": full_name,
        "is_active": is_active,
        "is_superuser": is_superuser,
        "supabase_id": supabase_id,
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


def create_auth_headers() -> dict[str, str]:
    """Create Authorization headers for HTTP requests.

    In Supabase auth testing, the actual token value doesn't matter
    because we use dependency overrides to inject the user.

    Returns:
        dict: Headers with dummy Bearer token
    """
    return {"Authorization": "Bearer test-supabase-token"}


# =============================================================================
# Core User Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> AsyncGenerator[User, None]:
    """Provide a regular active test user.

    Creates a user with:
    - Valid email
    - Active account (is_active=True)
    - Regular user (is_superuser=False)

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
    - Valid email
    - Active account
    - Regular user (not superuser)

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
# Token Fixtures (Removed - Supabase handles JWT tokens)
# =============================================================================
# The old token fixtures (test_user_tokens, superuser_tokens, access_token,
# refresh_token_value) have been removed. Supabase handles JWT token generation.
# Tests now use dependency overrides instead of self-issued tokens.


# =============================================================================
# Auth Headers Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def auth_headers(test_user) -> dict[str, str]:
    """Provide Authorization headers for authenticated requests and set up dependency override.

    This fixture:
    - Returns Authorization headers for HTTP requests
    - Sets up dependency override to inject test_user into get_current_user
    - Works with the client fixture automatically

    Args:
        test_user: The test user fixture (automatically overrides get_current_user).

    Returns:
        dict: Headers with "Authorization: Bearer <token>"

    Example:
        async def test_protected_endpoint(client, auth_headers):
            # auth_headers automatically sets up dependency override
            response = await client.get("/api/v1/me", headers=auth_headers)
            assert response.status_code == 200
    """
    from src.core.dependencies import get_current_user
    from src.main import app

    # Set up dependency override for get_current_user
    async def override_get_current_user():
        return test_user

    app.dependency_overrides[get_current_user] = override_get_current_user

    return create_auth_headers()


@pytest_asyncio.fixture
async def superuser_auth_headers(test_superuser) -> dict[str, str]:
    """Provide Authorization headers for superuser requests and set up dependency override.

    This fixture:
    - Returns Authorization headers for HTTP requests
    - Sets up dependency override to inject test_superuser into get_current_user
    - Works with the client fixture automatically

    Args:
        test_superuser: The test superuser fixture (automatically overrides get_current_user).

    Returns:
        dict: Headers with "Authorization: Bearer <token>"

    Example:
        async def test_admin_endpoint(client, superuser_auth_headers):
            # superuser_auth_headers automatically sets up dependency override
            response = await client.delete("/api/v1/admin/users/123",
                                          headers=superuser_auth_headers)
            assert response.status_code == 200
    """
    from src.core.dependencies import get_current_user
    from src.main import app

    # Set up dependency override for get_current_user
    async def override_get_current_user():
        return test_superuser

    app.dependency_overrides[get_current_user] = override_get_current_user

    return create_auth_headers()


# =============================================================================
# Authenticated User Bundle Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def authenticated_user(
    test_user: User,
    auth_headers: dict[str, str],
) -> AuthenticatedUser:
    """Provide a complete authenticated user bundle.

    This fixture bundles together the user and auth headers for
    convenient use in tests.

    Args:
        test_user: The test user
        auth_headers: The auth headers

    Returns:
        AuthenticatedUser: Named tuple with user and headers

    Example:
        async def test_something(authenticated_user):
            user = authenticated_user.user
            headers = authenticated_user.headers
    """
    return AuthenticatedUser(
        user=test_user,
        headers=auth_headers,
    )


@pytest_asyncio.fixture
async def authenticated_superuser(
    test_superuser: User,
    superuser_auth_headers: dict[str, str],
) -> AuthenticatedUser:
    """Provide a complete authenticated superuser bundle.

    Similar to authenticated_user but with superuser privileges.

    Args:
        test_superuser: The superuser
        superuser_auth_headers: The superuser auth headers

    Returns:
        AuthenticatedUser: Named tuple with user and headers
    """
    return AuthenticatedUser(
        user=test_superuser,
        headers=superuser_auth_headers,
    )


# =============================================================================
# Expired/Invalid Token Fixtures (for testing error handling)
# =============================================================================


@pytest.fixture
def invalid_token() -> str:
    """Provide a malformed/invalid token for testing error handling.

    Returns:
        str: Invalid JWT token string
    """
    return "invalid.token.string"


@pytest.fixture
def invalid_auth_headers(invalid_token: str) -> dict[str, str]:
    """Provide Authorization headers with an invalid token.

    Args:
        invalid_token: The invalid token fixture

    Returns:
        dict: Headers with invalid Bearer token
    """
    return {"Authorization": f"Bearer {invalid_token}"}


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
