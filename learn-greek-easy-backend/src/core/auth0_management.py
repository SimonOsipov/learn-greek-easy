"""Auth0 Management API client for user management operations.

This module provides functionality for interacting with the Auth0 Management API,
primarily for user deletion during account deletion flows.

Usage:
    from src.core.auth0_management import get_auth0_management_client

    client = get_auth0_management_client()
    if client:
        await client.delete_user("auth0|123456")
"""

import time
from typing import Any, Dict, Optional, cast

import httpx

from src.config import settings
from src.core.exceptions import Auth0ManagementError
from src.core.logging import get_logger

logger = get_logger(__name__)


class M2MTokenCache:
    """Thread-safe cache for Auth0 M2M (Machine-to-Machine) access tokens.

    The M2M token is used to authenticate requests to the Auth0 Management API.
    Caching reduces API calls and improves performance.

    Attributes:
        _token: Cached M2M access token
        _fetched_at: Timestamp when token was last fetched
        _ttl: Cache time-to-live in seconds (default: 23 hours)
    """

    def __init__(self, ttl: int = 23 * 3600) -> None:
        """Initialize M2M token cache.

        Args:
            ttl: Cache time-to-live in seconds (default: 23 hours, tokens expire in 24h)
        """
        self._token: Optional[str] = None
        self._fetched_at: float = 0
        self._ttl = ttl

    def get(self) -> Optional[str]:
        """Get cached token if still valid.

        Returns:
            Cached M2M token or None if cache is expired/empty
        """
        if self._token is None:
            return None

        if time.time() - self._fetched_at > self._ttl:
            return None

        return self._token

    def set(self, token: str) -> None:
        """Update cache with new token.

        Args:
            token: M2M access token from Auth0
        """
        self._token = token
        self._fetched_at = time.time()

    def invalidate(self) -> None:
        """Invalidate the cache, forcing a refresh on next get."""
        self._token = None
        self._fetched_at = 0


# Global M2M token cache instance
_m2m_token_cache = M2MTokenCache()


class Auth0ManagementClient:
    """Client for Auth0 Management API operations.

    Provides methods for user management operations such as deletion.
    Handles M2M token acquisition and caching automatically.

    Attributes:
        domain: Auth0 domain
        client_id: M2M application client ID
        client_secret: M2M application client secret
        audience: Management API audience
    """

    def __init__(
        self,
        domain: str,
        client_id: str,
        client_secret: str,
    ) -> None:
        """Initialize Auth0 Management API client.

        Args:
            domain: Auth0 domain (e.g., 'your-tenant.us.auth0.com')
            client_id: M2M application client ID
            client_secret: M2M application client secret
        """
        self.domain = domain
        self.client_id = client_id
        self.client_secret = client_secret
        self.audience = f"https://{domain}/api/v2/"

    async def _get_management_token(self) -> str:
        """Get M2M token for Management API, using cached token if valid.

        Returns:
            Valid M2M access token

        Raises:
            Auth0ManagementError: If token cannot be obtained
        """
        # Check cache first
        cached_token = _m2m_token_cache.get()
        if cached_token is not None:
            logger.debug("Using cached M2M token")
            return cached_token

        logger.debug("Fetching fresh M2M token from Auth0")

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"https://{self.domain}/oauth/token",
                    json={
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "audience": self.audience,
                        "grant_type": "client_credentials",
                    },
                )
                response.raise_for_status()
                data: Dict[str, Any] = cast(Dict[str, Any], response.json())

                token: str = str(data["access_token"])
                _m2m_token_cache.set(token)

                logger.debug("M2M token fetched and cached")
                return token

        except httpx.TimeoutException as e:
            logger.error("Timeout fetching M2M token from Auth0", extra={"error": str(e)})
            raise Auth0ManagementError(detail="Unable to obtain Auth0 management token: timeout")

        except httpx.HTTPStatusError as e:
            logger.error(
                "HTTP error fetching M2M token",
                extra={"status": e.response.status_code, "error": str(e)},
            )
            raise Auth0ManagementError(
                detail=f"Unable to obtain Auth0 management token: {e.response.status_code}"
            )

        except Exception as e:
            logger.error(
                "Unexpected error fetching M2M token",
                extra={"error": str(e), "error_type": type(e).__name__},
            )
            raise Auth0ManagementError(detail="Unable to obtain Auth0 management token")

    async def delete_user(self, auth0_id: str) -> bool:
        """Delete a user from Auth0.

        This operation is idempotent - if the user doesn't exist in Auth0,
        it's treated as a successful deletion.

        Args:
            auth0_id: The Auth0 user ID (e.g., 'auth0|123456')

        Returns:
            True if deleted successfully or user didn't exist

        Raises:
            Auth0ManagementError: If deletion fails for reasons other than user not found
        """
        token = await self._get_management_token()

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.delete(
                    f"https://{self.domain}/api/v2/users/{auth0_id}",
                    headers={"Authorization": f"Bearer {token}"},
                )

                if response.status_code == 204:
                    logger.info(
                        "Auth0 user deleted successfully",
                        extra={
                            "auth0_id": auth0_id[:20] + "..." if len(auth0_id) > 20 else auth0_id
                        },
                    )
                    return True

                if response.status_code == 404:
                    # User not found in Auth0 - treat as success (idempotent)
                    logger.info(
                        "Auth0 user not found (already deleted)",
                        extra={
                            "auth0_id": auth0_id[:20] + "..." if len(auth0_id) > 20 else auth0_id
                        },
                    )
                    return True

                if response.status_code == 401:
                    # Token might be invalid/expired - invalidate cache and retry once
                    logger.warning("Auth0 token rejected, invalidating cache and retrying")
                    _m2m_token_cache.invalidate()
                    return await self._delete_user_with_fresh_token(auth0_id)

                # Other errors
                logger.error(
                    "Auth0 user deletion failed",
                    extra={
                        "status_code": response.status_code,
                        "auth0_id": auth0_id[:20] + "..." if len(auth0_id) > 20 else auth0_id,
                    },
                )
                raise Auth0ManagementError(
                    detail=f"Failed to delete user from Auth0: {response.status_code}"
                )

        except Auth0ManagementError:
            raise  # Re-raise without wrapping

        except httpx.TimeoutException as e:
            logger.error(
                "Timeout deleting Auth0 user",
                extra={
                    "error": str(e),
                    "auth0_id": auth0_id[:20] + "..." if len(auth0_id) > 20 else auth0_id,
                },
            )
            raise Auth0ManagementError(detail="Failed to delete user from Auth0: timeout")

        except Exception as e:
            logger.error(
                "Unexpected error deleting Auth0 user",
                extra={
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "auth0_id": auth0_id[:20] + "..." if len(auth0_id) > 20 else auth0_id,
                },
            )
            raise Auth0ManagementError(detail="Failed to delete user from Auth0")

    async def _delete_user_with_fresh_token(self, auth0_id: str) -> bool:
        """Retry user deletion with a fresh token (after 401).

        This is called internally when the cached token is rejected.
        Does NOT retry again on 401 to avoid infinite loops.

        Args:
            auth0_id: The Auth0 user ID

        Returns:
            True if deleted successfully or user didn't exist

        Raises:
            Auth0ManagementError: If deletion fails
        """
        token = await self._get_management_token()

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.delete(
                    f"https://{self.domain}/api/v2/users/{auth0_id}",
                    headers={"Authorization": f"Bearer {token}"},
                )

                if response.status_code == 204:
                    logger.info(
                        "Auth0 user deleted successfully (after token refresh)",
                        extra={
                            "auth0_id": auth0_id[:20] + "..." if len(auth0_id) > 20 else auth0_id
                        },
                    )
                    return True

                if response.status_code == 404:
                    logger.info(
                        "Auth0 user not found (already deleted, after token refresh)",
                        extra={
                            "auth0_id": auth0_id[:20] + "..." if len(auth0_id) > 20 else auth0_id
                        },
                    )
                    return True

                # Any other error (including 401 again) - fail without retry
                logger.error(
                    "Auth0 user deletion failed after token refresh",
                    extra={
                        "status_code": response.status_code,
                        "auth0_id": auth0_id[:20] + "..." if len(auth0_id) > 20 else auth0_id,
                    },
                )
                raise Auth0ManagementError(
                    detail=f"Failed to delete user from Auth0: {response.status_code}"
                )

        except Auth0ManagementError:
            raise

        except Exception as e:
            logger.error(
                "Error deleting Auth0 user after token refresh",
                extra={
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "auth0_id": auth0_id[:20] + "..." if len(auth0_id) > 20 else auth0_id,
                },
            )
            raise Auth0ManagementError(detail="Failed to delete user from Auth0")


def get_auth0_management_client() -> Optional[Auth0ManagementClient]:
    """Get Auth0 Management API client if M2M is configured.

    Returns:
        Auth0ManagementClient instance if M2M credentials are configured,
        None otherwise.

    Example:
        client = get_auth0_management_client()
        if client:
            await client.delete_user("auth0|123456")
        else:
            logger.warning("Auth0 M2M not configured, skipping Auth0 deletion")
    """
    if not settings.auth0_m2m_configured:
        logger.debug("Auth0 M2M not configured, returning None")
        return None

    # Type assertions - we know these are not None after auth0_m2m_configured check
    assert settings.auth0_domain is not None
    assert settings.auth0_m2m_client_id is not None
    assert settings.auth0_m2m_client_secret is not None

    return Auth0ManagementClient(
        domain=settings.auth0_domain,
        client_id=settings.auth0_m2m_client_id,
        client_secret=settings.auth0_m2m_client_secret,
    )


def invalidate_m2m_token_cache() -> None:
    """Invalidate the M2M token cache.

    This can be used when you suspect the cached token is invalid,
    for example after credential rotation.
    """
    _m2m_token_cache.invalidate()
    logger.info("M2M token cache invalidated")
