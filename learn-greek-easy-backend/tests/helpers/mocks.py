"""Mock builders for external dependencies.

This module provides pre-configured mocks for testing:
- Redis client mock
- Email service mock (future)
- External API mocks

Usage:
    from tests.helpers.mocks import mock_redis_client

    async def test_with_redis(mocker):
        redis = mock_redis_client(mocker)
        redis.get.return_value = "cached_value"
        # Test code that uses Redis
"""

from typing import Any
from unittest.mock import AsyncMock, MagicMock


# =============================================================================
# Redis Mock
# =============================================================================


def mock_redis_client(mocker: Any | None = None) -> MagicMock:
    """Create a pre-configured Redis client mock.

    Provides common Redis operations as AsyncMocks.

    Args:
        mocker: pytest-mock mocker fixture (optional)

    Returns:
        MagicMock: Configured Redis mock

    Example:
        redis = mock_redis_client()
        redis.get.return_value = b"cached_value"
        redis.set.return_value = True

        # In test
        result = await redis.get("key")
        assert result == b"cached_value"
    """
    mock = MagicMock()

    # Async operations
    mock.get = AsyncMock(return_value=None)
    mock.set = AsyncMock(return_value=True)
    mock.setex = AsyncMock(return_value=True)
    mock.delete = AsyncMock(return_value=1)
    mock.exists = AsyncMock(return_value=0)
    mock.expire = AsyncMock(return_value=True)
    mock.ttl = AsyncMock(return_value=-1)
    mock.incr = AsyncMock(return_value=1)
    mock.decr = AsyncMock(return_value=0)
    mock.lpush = AsyncMock(return_value=1)
    mock.rpush = AsyncMock(return_value=1)
    mock.lpop = AsyncMock(return_value=None)
    mock.rpop = AsyncMock(return_value=None)
    mock.lrange = AsyncMock(return_value=[])
    mock.hget = AsyncMock(return_value=None)
    mock.hset = AsyncMock(return_value=1)
    mock.hgetall = AsyncMock(return_value={})
    mock.hdel = AsyncMock(return_value=1)
    mock.sadd = AsyncMock(return_value=1)
    mock.srem = AsyncMock(return_value=1)
    mock.smembers = AsyncMock(return_value=set())
    mock.sismember = AsyncMock(return_value=False)

    # Connection management
    mock.close = AsyncMock()
    mock.ping = AsyncMock(return_value=True)

    # Pipeline support
    pipeline_mock = MagicMock()
    pipeline_mock.execute = AsyncMock(return_value=[])
    mock.pipeline = MagicMock(return_value=pipeline_mock)

    return mock


def configure_redis_cache(
    redis_mock: MagicMock,
    cache_data: dict[str, bytes | str],
) -> None:
    """Configure Redis mock with cached data.

    Args:
        redis_mock: Redis mock instance
        cache_data: Dictionary of key -> value pairs

    Example:
        redis = mock_redis_client()
        configure_redis_cache(redis, {
            "user:123": b'{"name": "Test"}',
            "session:abc": b'{"user_id": "123"}',
        })
    """

    async def mock_get(key: str) -> bytes | None:
        value = cache_data.get(key)
        if isinstance(value, str):
            return value.encode()
        return value

    redis_mock.get = AsyncMock(side_effect=mock_get)
    redis_mock.exists = AsyncMock(side_effect=lambda k: 1 if k in cache_data else 0)


# =============================================================================
# Email Service Mock
# =============================================================================


def mock_email_service(mocker: Any | None = None) -> MagicMock:
    """Create a pre-configured email service mock.

    Args:
        mocker: pytest-mock mocker fixture (optional)

    Returns:
        MagicMock: Configured email service mock

    Example:
        email_service = mock_email_service()
        email_service.send_verification_email.return_value = True

        # In test
        result = await email_service.send_verification_email(user.email)
        email_service.send_verification_email.assert_called_once_with(user.email)
    """
    mock = MagicMock()

    # Common email operations
    mock.send_email = AsyncMock(return_value=True)
    mock.send_verification_email = AsyncMock(return_value=True)
    mock.send_password_reset_email = AsyncMock(return_value=True)
    mock.send_welcome_email = AsyncMock(return_value=True)
    mock.send_notification = AsyncMock(return_value=True)

    # Batch operations
    mock.send_bulk = AsyncMock(return_value={"sent": 0, "failed": 0})

    return mock


# =============================================================================
# External API Mock
# =============================================================================


def mock_external_api(
    mocker: Any | None = None,
    *,
    base_url: str = "https://api.example.com",
    default_response: dict[str, Any] | None = None,
) -> MagicMock:
    """Create a generic external API mock.

    Args:
        mocker: pytest-mock mocker fixture (optional)
        base_url: Base URL for the API
        default_response: Default response for all endpoints

    Returns:
        MagicMock: Configured API mock

    Example:
        api = mock_external_api(base_url="https://translation.api.com")
        api.translate.return_value = {"translated": "Yeia sou"}

        result = await api.translate("Hello", "el")
    """
    mock = MagicMock()
    mock.base_url = base_url

    response = default_response or {"success": True}

    # HTTP methods
    mock.get = AsyncMock(return_value=response)
    mock.post = AsyncMock(return_value=response)
    mock.put = AsyncMock(return_value=response)
    mock.delete = AsyncMock(return_value=response)
    mock.patch = AsyncMock(return_value=response)

    # Common API operations
    mock.request = AsyncMock(return_value=response)
    mock.fetch = AsyncMock(return_value=response)

    return mock


def mock_http_response(
    status_code: int = 200,
    json_data: dict[str, Any] | None = None,
    text: str = "",
    headers: dict[str, str] | None = None,
) -> MagicMock:
    """Create a mock HTTP response object.

    Args:
        status_code: HTTP status code
        json_data: Response JSON data
        text: Response text
        headers: Response headers

    Returns:
        MagicMock: Mock response object

    Example:
        response = mock_http_response(200, json_data={"id": "123"})
        assert response.status_code == 200
        assert response.json() == {"id": "123"}
    """
    mock = MagicMock()
    mock.status_code = status_code
    mock.text = text or str(json_data or "")
    mock.headers = headers or {"content-type": "application/json"}

    if json_data is not None:
        mock.json = MagicMock(return_value=json_data)
    else:
        mock.json = MagicMock(side_effect=ValueError("No JSON"))

    return mock


# =============================================================================
# Service Mocks
# =============================================================================


def mock_auth_service(mocker: Any | None = None) -> MagicMock:
    """Create a mock for AuthService.

    Args:
        mocker: pytest-mock mocker fixture (optional)

    Returns:
        MagicMock: Configured AuthService mock

    Example:
        auth_service = mock_auth_service()
        auth_service.authenticate.return_value = (user, tokens)
    """
    mock = MagicMock()

    mock.register_user = AsyncMock()
    mock.login_user = AsyncMock()
    mock.refresh_access_token = AsyncMock()
    mock.revoke_refresh_token = AsyncMock(return_value=True)
    mock.revoke_all_user_tokens = AsyncMock(return_value=1)
    mock.get_user_sessions = AsyncMock(return_value=[])
    mock.revoke_session_by_id = AsyncMock(return_value=True)

    return mock


# =============================================================================
# Database Mocks
# =============================================================================


def mock_async_session() -> MagicMock:
    """Create a mock AsyncSession for unit testing without database.

    Returns:
        MagicMock: Mock session with async operations

    Example:
        session = mock_async_session()
        session.execute.return_value = mock_result
    """
    mock = MagicMock()

    # Async context manager support
    mock.__aenter__ = AsyncMock(return_value=mock)
    mock.__aexit__ = AsyncMock(return_value=None)

    # Core operations
    mock.execute = AsyncMock()
    mock.commit = AsyncMock()
    mock.rollback = AsyncMock()
    mock.close = AsyncMock()
    mock.flush = AsyncMock()
    mock.refresh = AsyncMock()

    # Query operations
    mock.get = AsyncMock(return_value=None)
    mock.add = MagicMock()
    mock.delete = AsyncMock()

    return mock


# =============================================================================
# Module Exports
# =============================================================================

__all__ = [
    # Redis Mock
    "mock_redis_client",
    "configure_redis_cache",
    # Email Service Mock
    "mock_email_service",
    # External API Mock
    "mock_external_api",
    "mock_http_response",
    # Service Mocks
    "mock_auth_service",
    # Database Mocks
    "mock_async_session",
]
