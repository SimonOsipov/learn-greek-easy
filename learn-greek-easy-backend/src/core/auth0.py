"""Auth0 token validation and JWKS management.

This module provides functionality for validating Auth0 access tokens using JWKS
(JSON Web Key Set). It includes caching for JWKS to reduce API calls and improve
performance.

Usage:
    from src.core.auth0 import verify_auth0_token

    user_info = await verify_auth0_token(access_token)
    # user_info.auth0_id, user_info.email, etc.
"""

import time
from dataclasses import dataclass
from typing import Any, Dict, Optional, cast

import httpx
from authlib.jose import JsonWebKey, jwt
from authlib.jose.errors import BadSignatureError, DecodeError, ExpiredTokenError

from src.config import settings
from src.core.exceptions import (
    Auth0DisabledException,
    Auth0TokenExpiredException,
    Auth0TokenInvalidException,
)
from src.core.logging import get_logger

logger = get_logger(__name__)


@dataclass(frozen=True)
class Auth0UserInfo:
    """Parsed user information from Auth0 access token.

    Attributes:
        auth0_id: Auth0 user identifier (sub claim)
        email: User's email address (if present)
        email_verified: Whether the email is verified
        name: User's full name (if present)
    """

    auth0_id: str
    email: Optional[str] = None
    email_verified: bool = False
    name: Optional[str] = None


class JWKSCache:
    """Thread-safe cache for Auth0 JWKS (JSON Web Key Set).

    The JWKS contains public keys used to verify JWT signatures.
    Caching reduces API calls to Auth0's JWKS endpoint.

    Attributes:
        _keys: Cached JWKS keys
        _fetched_at: Timestamp when keys were last fetched
        _ttl: Cache time-to-live in seconds
    """

    def __init__(self, ttl: int = 3600) -> None:
        """Initialize JWKS cache.

        Args:
            ttl: Cache time-to-live in seconds (default: 1 hour)
        """
        self._keys: Optional[Dict[str, Any]] = None
        self._fetched_at: float = 0
        self._ttl = ttl

    def get(self) -> Optional[Dict[str, Any]]:
        """Get cached JWKS if still valid.

        Returns:
            Cached JWKS keys or None if cache is expired/empty
        """
        if self._keys is None:
            return None

        if time.time() - self._fetched_at > self._ttl:
            return None

        return self._keys

    def set(self, keys: Dict[str, Any]) -> None:
        """Update cache with new JWKS.

        Args:
            keys: JWKS response from Auth0
        """
        self._keys = keys
        self._fetched_at = time.time()

    def invalidate(self) -> None:
        """Invalidate the cache, forcing a refresh on next get."""
        self._keys = None
        self._fetched_at = 0


# Global JWKS cache instance
_jwks_cache = JWKSCache(ttl=settings.auth0_jwks_cache_ttl)


async def fetch_jwks(jwks_uri: str) -> Dict[str, Any]:
    """Fetch JWKS from Auth0.

    Uses caching to reduce API calls. If cached keys are valid, returns them
    immediately. Otherwise, fetches fresh keys from Auth0.

    Args:
        jwks_uri: Auth0 JWKS endpoint URL

    Returns:
        JWKS containing public keys for token verification

    Raises:
        Auth0TokenInvalidException: If JWKS cannot be fetched
    """
    # Check cache first
    cached_keys = _jwks_cache.get()
    if cached_keys is not None:
        logger.debug("Using cached JWKS keys")
        return cached_keys

    logger.debug("Fetching fresh JWKS from Auth0", extra={"jwks_uri": jwks_uri})

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(jwks_uri)
            response.raise_for_status()
            jwks_data: Dict[str, Any] = cast(Dict[str, Any], response.json())

            # Cache the keys
            _jwks_cache.set(jwks_data)

            logger.debug(
                "JWKS fetched and cached",
                extra={"key_count": len(jwks_data.get("keys", []))},
            )

            return jwks_data

    except httpx.TimeoutException as e:
        logger.error("Timeout fetching JWKS from Auth0", extra={"error": str(e)})
        raise Auth0TokenInvalidException(detail="Unable to verify token: JWKS timeout")

    except httpx.HTTPStatusError as e:
        logger.error(
            "HTTP error fetching JWKS",
            extra={"status": e.response.status_code, "error": str(e)},
        )
        raise Auth0TokenInvalidException(detail="Unable to verify token: JWKS fetch failed")

    except Exception as e:
        logger.error("Unexpected error fetching JWKS", extra={"error": str(e)})
        raise Auth0TokenInvalidException(detail="Unable to verify token: JWKS error")


async def verify_auth0_token(access_token: str) -> Auth0UserInfo:
    """Verify an Auth0 access token and extract user information.

    This function:
    1. Checks that Auth0 is configured
    2. Fetches/uses cached JWKS for signature verification
    3. Validates the token signature, expiration, issuer, and audience
    4. Extracts user information from token claims

    Args:
        access_token: Auth0 JWT access token

    Returns:
        Auth0UserInfo containing user details from the token

    Raises:
        Auth0DisabledException: If Auth0 is not configured
        Auth0TokenExpiredException: If the token has expired
        Auth0TokenInvalidException: If the token is invalid
    """
    # Check Auth0 configuration
    if not settings.auth0_configured:
        raise Auth0DisabledException()

    jwks_uri = settings.auth0_jwks_uri
    issuer = settings.auth0_issuer
    audience = settings.auth0_audience

    # Type assertions (we know these are not None after auth0_configured check)
    assert jwks_uri is not None
    assert issuer is not None
    assert audience is not None

    try:
        # Fetch JWKS (uses cache if valid)
        jwks_data = await fetch_jwks(jwks_uri)

        # Import keys from JWKS
        key_set = JsonWebKey.import_key_set(jwks_data)

        # Decode and verify the token
        claims = jwt.decode(
            access_token,
            key_set,
            claims_options={
                "iss": {"essential": True, "value": issuer},
                "aud": {"essential": True, "value": audience},
                "exp": {"essential": True},
                "sub": {"essential": True},
            },
        )

        # Validate claims (checks exp, iss, aud)
        claims.validate()

        # Extract user info from claims
        auth0_id = claims.get("sub")
        if not auth0_id:
            raise Auth0TokenInvalidException(detail="Token missing sub claim")

        user_info = Auth0UserInfo(
            auth0_id=auth0_id,
            email=claims.get("email") or claims.get(f"{audience}/email"),
            email_verified=claims.get("email_verified", False)
            or claims.get(f"{audience}/email_verified", False),
            name=claims.get("name") or claims.get(f"{audience}/name"),
        )

        logger.info(
            "Auth0 token verified successfully",
            extra={"auth0_id": auth0_id[:20] + "..." if len(auth0_id) > 20 else auth0_id},
        )

        return user_info

    except ExpiredTokenError:
        logger.warning("Auth0 token has expired")
        raise Auth0TokenExpiredException()

    except BadSignatureError as e:
        logger.warning("Auth0 token has invalid signature", extra={"error": str(e)})
        raise Auth0TokenInvalidException(detail="Invalid token signature")

    except DecodeError as e:
        logger.warning("Auth0 token could not be decoded", extra={"error": str(e)})
        raise Auth0TokenInvalidException(detail="Token could not be decoded")

    except Auth0TokenExpiredException:
        raise  # Re-raise without wrapping

    except Auth0TokenInvalidException:
        raise  # Re-raise without wrapping

    except Exception as e:
        logger.error(
            "Unexpected error verifying Auth0 token",
            extra={"error": str(e), "error_type": type(e).__name__},
        )
        raise Auth0TokenInvalidException(detail="Token verification failed")


def invalidate_jwks_cache() -> None:
    """Invalidate the JWKS cache.

    This can be used when you suspect the cached keys are stale,
    for example after a key rotation at Auth0.
    """
    _jwks_cache.invalidate()
    logger.info("JWKS cache invalidated")
