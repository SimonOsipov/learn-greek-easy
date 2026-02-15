"""Supabase token validation and JWKS management.

This module provides functionality for validating Supabase access tokens using JWKS
(JSON Web Key Set). It includes caching for JWKS to reduce API calls and improve
performance, with key rotation retry logic for resilience.

Usage:
    from src.core.supabase_auth import verify_supabase_token

    user_claims = await verify_supabase_token(access_token)
    # user_claims.supabase_id, user_claims.email, user_claims.full_name
"""

import time
from dataclasses import dataclass
from typing import Any, Dict, Optional, cast

import httpx
from authlib.jose import JsonWebKey, jwt
from authlib.jose.errors import (
    BadSignatureError,
    DecodeError,
    ExpiredTokenError,
    InvalidClaimError,
    MissingClaimError,
)

from src.config import settings
from src.core.exceptions import TokenExpiredException, TokenInvalidException, UnauthorizedException
from src.core.logging import get_logger

logger = get_logger(__name__)


@dataclass(frozen=True)
class SupabaseUserClaims:
    """Verified identity claims from a Supabase JWT.

    Attributes:
        supabase_id: Supabase user identifier (sub claim, UUID format)
        email: User's email address (if present in token)
        full_name: User's full name from user_metadata (if present)

    Note: Frozen dataclass ensures immutability after verification.
    """

    supabase_id: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    auth_provider: Optional[str] = None  # from app_metadata.provider


class JWKSCache:
    """Cache for Supabase JWKS (JSON Web Key Set).

    The JWKS contains public keys used to verify JWT signatures.
    Caching reduces API calls to Supabase's JWKS endpoint.

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
            keys: JWKS response from Supabase
        """
        self._keys = keys
        self._fetched_at = time.time()

    def invalidate(self) -> None:
        """Invalidate the cache, forcing a refresh on next get."""
        self._keys = None
        self._fetched_at = 0


# Global JWKS cache instance
_jwks_cache = JWKSCache(ttl=settings.supabase_jwks_cache_ttl)


async def _fetch_jwks(jwks_url: str) -> Dict[str, Any]:
    """Fetch JWKS from Supabase.

    Uses caching to reduce API calls. If cached keys are valid, returns them
    immediately. Otherwise, fetches fresh keys from Supabase.

    Args:
        jwks_url: Supabase JWKS endpoint URL

    Returns:
        JWKS containing public keys for token verification

    Raises:
        TokenInvalidException: If JWKS cannot be fetched
    """
    # Check cache first
    cached_keys = _jwks_cache.get()
    if cached_keys is not None:
        logger.debug("Using cached JWKS keys")
        return cached_keys

    logger.debug("Fetching fresh JWKS from Supabase", extra={"jwks_url": jwks_url})

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(jwks_url)
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
        logger.error("Timeout fetching JWKS from Supabase", extra={"error": str(e)})
        raise TokenInvalidException(detail="Unable to verify token: JWKS timeout")

    except httpx.HTTPStatusError as e:
        logger.error(
            "HTTP error fetching JWKS",
            extra={"status": e.response.status_code, "error": str(e)},
        )
        raise TokenInvalidException(detail="Unable to verify token: JWKS fetch failed")

    except Exception as e:
        logger.error("Unexpected error fetching JWKS", extra={"error": str(e)})
        raise TokenInvalidException(detail="Unable to verify token: JWKS error")


def _decode_token(token: str, jwks_data: Dict[str, Any], issuer: str) -> SupabaseUserClaims:
    """Decode and validate a Supabase JWT (internal helper).

    Args:
        token: JWT access token
        jwks_data: JWKS response containing public keys
        issuer: Expected issuer claim value

    Returns:
        SupabaseUserClaims with verified identity

    Raises:
        BadSignatureError: If signature verification fails (triggers retry in caller)
        ExpiredTokenError: If token has expired
        DecodeError: If token is malformed
        InvalidClaimError: If iss/aud don't match
        MissingClaimError: If required claim is missing
    """
    # Import keys from JWKS
    key_set = JsonWebKey.import_key_set(jwks_data)

    # Decode and verify the token
    claims = jwt.decode(
        token,
        key_set,
        claims_options={
            "iss": {"essential": True, "value": issuer},
            "aud": {"essential": True, "value": "authenticated"},
            "exp": {"essential": True},
            "sub": {"essential": True},
        },
    )

    # Validate claims (checks exp, iss, aud)
    claims.validate()

    # Extract required sub claim (UUID format)
    supabase_id = claims.get("sub")
    if not supabase_id:
        raise MissingClaimError("Token missing sub claim")

    # Extract optional email (directly from access token)
    email = claims.get("email")

    # Extract optional full_name from user_metadata
    user_metadata = claims.get("user_metadata") or {}
    full_name = user_metadata.get("full_name") if isinstance(user_metadata, dict) else None

    # Extract auth provider from app_metadata
    app_metadata = claims.get("app_metadata") or {}
    auth_provider = app_metadata.get("provider") if isinstance(app_metadata, dict) else None

    return SupabaseUserClaims(
        supabase_id=supabase_id,
        email=email,
        full_name=full_name,
        auth_provider=auth_provider,
    )


async def _verify_with_retry(
    token: str, jwks_url: str, issuer: str, used_cache: bool
) -> SupabaseUserClaims:
    """Verify token with key rotation retry logic (internal helper).

    Args:
        token: JWT access token
        jwks_url: JWKS endpoint URL
        issuer: Expected issuer claim value
        used_cache: Whether cached keys were available before verification

    Returns:
        SupabaseUserClaims with verified identity

    Raises:
        TokenInvalidException: If verification fails after retry
    """
    try:
        jwks_data = await _fetch_jwks(jwks_url)
        result = _decode_token(token, jwks_data, issuer)

        logger.info(
            "Supabase token verified successfully",
            extra={"supabase_id": result.supabase_id[:8] + "..."},
        )
        return result

    except BadSignatureError:
        # Key rotation retry: only retry if we used cached keys (stale risk)
        if not used_cache:
            logger.warning("Supabase token has invalid signature (fresh keys)")
            raise TokenInvalidException(detail="Invalid token signature")

        # Retry with fresh JWKS (key rotation scenario)
        logger.info("Retrying Supabase token verification with fresh JWKS")
        _jwks_cache.invalidate()

        try:
            jwks_data = await _fetch_jwks(jwks_url)
            result = _decode_token(token, jwks_data, issuer)

            logger.info(
                "Supabase token verified after JWKS refresh",
                extra={"supabase_id": result.supabase_id[:8] + "..."},
            )
            return result

        except BadSignatureError:
            logger.warning("Supabase token has invalid signature (retry failed)")
            raise TokenInvalidException(detail="Invalid token signature")


async def verify_supabase_token(token: str) -> SupabaseUserClaims:
    """Verify a Supabase access token and extract user claims.

    This function:
    1. Checks that Supabase is configured
    2. Fetches/uses cached JWKS for signature verification
    3. Validates the token signature, expiration, issuer, and audience
    4. Extracts user claims from the token
    5. On signature failure with cached keys, retries once with fresh JWKS (key rotation)

    Args:
        token: Supabase JWT access token

    Returns:
        SupabaseUserClaims containing verified user identity

    Raises:
        UnauthorizedException: If Supabase is not configured
        TokenExpiredException: If the token has expired
        TokenInvalidException: If the token is invalid or verification fails

    Note:
        All error paths return 401 status codes (never 500) to prevent
        information disclosure about auth infrastructure.
    """
    # Check Supabase configuration
    # Note: supabase_configured checks both supabase_url and supabase_service_role_key.
    # For JWT verification we only need supabase_url, but both are always set together
    # in Railway, so this is acceptable coupling.
    if not settings.supabase_configured:
        raise UnauthorizedException(detail="Supabase authentication is not enabled")

    jwks_url = settings.supabase_jwks_url
    issuer = settings.supabase_issuer

    # Type assertions (we know these are not None after supabase_configured check)
    assert jwks_url is not None
    assert issuer is not None

    # Detect if we're using cached keys BEFORE fetching (for retry decision)
    # Must check before _fetch_jwks() because after fetch the cache is always populated
    used_cache = _jwks_cache.get() is not None

    try:
        return await _verify_with_retry(token, jwks_url, issuer, used_cache)

    except ExpiredTokenError:
        logger.warning("Supabase token has expired")
        raise TokenExpiredException()

    except MissingClaimError as e:
        logger.warning("Supabase token missing required claim", extra={"error": str(e)})
        raise TokenInvalidException(detail=f"Token missing required claim: {e}")

    except InvalidClaimError as e:
        logger.warning("Supabase token has invalid claim", extra={"error": str(e)})
        raise TokenInvalidException(detail=f"Token has invalid claim: {e}")

    except DecodeError as e:
        logger.warning("Supabase token could not be decoded", extra={"error": str(e)})
        raise TokenInvalidException(detail="Token could not be decoded")

    except TokenExpiredException:
        raise  # Re-raise without wrapping

    except TokenInvalidException:
        raise  # Re-raise without wrapping

    except Exception as e:
        logger.error(
            "Unexpected error verifying Supabase token",
            extra={"error": str(e), "error_type": type(e).__name__},
        )
        raise TokenInvalidException(detail="Token verification failed")


def invalidate_jwks_cache() -> None:
    """Invalidate the JWKS cache.

    This can be used when you suspect the cached keys are stale,
    for example after a key rotation at Supabase.
    """
    _jwks_cache.invalidate()
    logger.info("JWKS cache invalidated")
