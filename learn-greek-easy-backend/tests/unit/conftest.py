"""Unit test specific fixtures and configuration.

This module provides fixtures that are specific to unit tests:
- Mock database sessions
- Mock external services
- Isolated test configurations

These fixtures are designed for fast, isolated unit tests that don't
require a real database or external services.

For database fixtures, see tests/fixtures/database.py
For auth fixtures, see tests/fixtures/auth.py

Usage:
    from tests.unit.conftest import mock_db_session, mock_auth

    async def test_service_logic(mock_db_session, mock_auth):
        mock_db_session.execute.return_value = mock_result
        mock_auth.login_user.return_value = (user, tokens)
        # Test isolated business logic
"""

import pytest
from unittest.mock import MagicMock

from tests.helpers.mocks import (
    mock_async_session,
    mock_auth_service,
    mock_email_service,
    mock_redis_client,
)


# =============================================================================
# Mock Session Fixtures
# =============================================================================


@pytest.fixture
def mock_db_session() -> MagicMock:
    """Provide a mock database session for unit tests.

    Use this when you want to test code that uses a database
    session without actually hitting the database. This is ideal
    for testing service layer logic in isolation.

    The mock session includes pre-configured AsyncMocks for:
    - execute, commit, rollback, close, flush, refresh
    - get, add, delete

    Returns:
        MagicMock: Configured database session mock

    Example:
        async def test_user_creation(mock_db_session):
            from unittest.mock import AsyncMock

            mock_db_session.add = MagicMock()
            mock_db_session.commit = AsyncMock()

            # Test code that uses db_session
            await create_user(mock_db_session, user_data)

            mock_db_session.add.assert_called_once()
            await mock_db_session.commit.assert_awaited_once()
    """
    return mock_async_session()


# =============================================================================
# Mock Service Fixtures
# =============================================================================


@pytest.fixture
def mock_auth() -> MagicMock:
    """Provide a mock AuthService for unit tests.

    Pre-configured with common auth operations as AsyncMocks.
    Use this to test code that depends on AuthService without
    exercising the actual authentication logic.

    Mock methods available:
    - register_user
    - login_user
    - refresh_access_token
    - revoke_refresh_token
    - revoke_all_user_tokens
    - get_user_sessions
    - revoke_session_by_id

    Returns:
        MagicMock: Configured AuthService mock

    Example:
        async def test_login_calls_auth_service(mock_auth):
            user = User(id=uuid4(), email="test@example.com")
            tokens = AuthTokens(access_token="...", refresh_token="...")

            mock_auth.login_user.return_value = (user, tokens)

            # Test code that uses auth_service
            result = await some_function_using_auth(mock_auth)

            mock_auth.login_user.assert_awaited_once()
    """
    return mock_auth_service()


@pytest.fixture
def mock_email() -> MagicMock:
    """Provide a mock email service for unit tests.

    Pre-configured with common email operations as AsyncMocks.
    Use this to test code that sends emails without actually
    sending any emails.

    Mock methods available:
    - send_email
    - send_verification_email
    - send_password_reset_email
    - send_welcome_email
    - send_notification
    - send_bulk

    Returns:
        MagicMock: Configured email service mock

    Example:
        async def test_registration_sends_email(mock_email):
            mock_email.send_verification_email.return_value = True

            # Test code that sends verification email
            await register_user(user_data, email_service=mock_email)

            mock_email.send_verification_email.assert_awaited_once()
    """
    return mock_email_service()


@pytest.fixture
def mock_redis() -> MagicMock:
    """Provide a mock Redis client for unit tests.

    Pre-configured with common Redis operations as AsyncMocks.
    Use this to test code that uses Redis caching without
    requiring a running Redis instance.

    Mock methods available:
    - get, set, setex, delete, exists, expire, ttl
    - incr, decr
    - lpush, rpush, lpop, rpop, lrange
    - hget, hset, hgetall, hdel
    - sadd, srem, smembers, sismember
    - close, ping
    - pipeline (with execute method)

    Returns:
        MagicMock: Configured Redis client mock

    Example:
        async def test_cache_hit(mock_redis):
            mock_redis.get.return_value = b'cached_value'

            # Test code that uses Redis cache
            result = await get_cached_data(mock_redis, "key")

            assert result == "cached_value"
            mock_redis.get.assert_awaited_once_with("key")

        async def test_cache_miss(mock_redis):
            mock_redis.get.return_value = None
            mock_redis.set.return_value = True

            # Test code that sets cache on miss
            result = await get_or_set_cache(mock_redis, "key", "value")

            mock_redis.set.assert_awaited_once()
    """
    return mock_redis_client()


# =============================================================================
# Module Exports
# =============================================================================

__all__ = [
    "mock_db_session",
    "mock_auth",
    "mock_email",
    "mock_redis",
]
