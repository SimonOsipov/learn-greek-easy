"""JWT token generation and verification utilities.

This module provides secure JWT token management for authentication:
- Access token generation and verification
- Refresh token generation and verification with JTI tracking
- Token extraction from HTTP headers

All authentication now flows through Auth0. Legacy password hashing
and Google OAuth token verification have been removed.

Security Features:
- HS256 algorithm with configurable secret key
- Token type validation to prevent confused deputy attacks
- JTI (JWT ID) for refresh token tracking and revocation
- Constant-time token verification
"""

import secrets
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from src.config import settings
from src.core.exceptions import TokenExpiredException, TokenInvalidException

# ============================================================================
# Token ID Generation
# ============================================================================


def generate_token_id() -> str:
    """Generate a unique, cryptographically secure token ID (jti).

    This ID is used to uniquely identify refresh tokens for Redis storage
    and revocation. It uses secrets.token_urlsafe which is suitable for
    security-sensitive applications.

    Returns:
        str: A 22-character URL-safe base64 encoded random string.
             (16 bytes of randomness = 128 bits of entropy)

    Security Notes:
        - Uses secrets module (CSPRNG) for cryptographic security
        - 128 bits of entropy is sufficient for token identification
        - URL-safe encoding avoids issues in Redis keys

    Example:
        >>> token_id = generate_token_id()
        >>> print(f"Token ID: {token_id}")
        Token ID: Ks9J_x2mNpQ3rT5aB7cD
        >>> len(token_id)
        22
    """
    # token_urlsafe(16) generates 16 random bytes and encodes as URL-safe base64
    # Result is approximately 22 characters
    return secrets.token_urlsafe(16)


# ============================================================================
# JWT Token Generation
# ============================================================================


def create_access_token(user_id: UUID) -> tuple[str, datetime]:
    """Create a JWT access token for API authentication.

    Access tokens are short-lived (30 minutes) and used for authenticating
    API requests. They are NOT stored in the database - verification is
    purely cryptographic.

    Args:
        user_id (UUID): The unique identifier of the user.

    Returns:
        tuple[str, datetime]: A tuple containing:
            - str: The encoded JWT token string
            - datetime: The expiration timestamp (UTC)

    Raises:
        None: This function does not raise exceptions.

    Security Notes:
        - Token expires after jwt_access_token_expire_minutes (default: 720 = 12 hours)
        - Contains user_id in "sub" claim for identification
        - Includes "type": "access" to prevent token confusion attacks
        - Uses HS256 algorithm with shared secret
        - Timestamps are in UTC to avoid timezone issues

    Example:
        >>> from uuid import uuid4
        >>> user_id = uuid4()
        >>> token, expires_at = create_access_token(user_id)
        >>> print(f"Token length: {len(token)}")  # ~200 characters
        Token length: 215
        >>> print(f"Expires: {expires_at}")
        Expires: 2024-11-25 15:30:00+00:00
        >>> # Verify the token
        >>> verified_user_id = verify_token(token, "access")
        >>> assert verified_user_id == user_id
    """
    now = datetime.utcnow()
    expires_at = now + timedelta(minutes=settings.jwt_access_token_expire_minutes)

    payload = {
        "sub": str(user_id),  # Subject: user ID (convert UUID to string)
        "exp": expires_at,  # Expiration time (datetime, auto-converted to timestamp)
        "iat": now,  # Issued at (datetime, auto-converted to timestamp)
        "type": "access",  # Token type for validation
    }

    # Encode the JWT token
    token = jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    return token, expires_at


def create_refresh_token(user_id: UUID, token_id: str | None = None) -> tuple[str, datetime, str]:
    """Create a JWT refresh token for obtaining new access tokens.

    Refresh tokens are long-lived (30 days) and used to obtain new access
    tokens without re-entering credentials. They can be stored in Redis
    (primary) or PostgreSQL (fallback) for session management and revocation.

    Args:
        user_id (UUID): The unique identifier of the user.
        token_id (str | None): Optional unique token identifier (jti claim).
            If not provided, a new token_id will be generated using
            generate_token_id(). This ID is used as the Redis key and
            for session identification.

    Returns:
        tuple[str, datetime, str]: A tuple containing:
            - str: The encoded JWT token string
            - datetime: The expiration timestamp (UTC)
            - str: The token_id (jti) for Redis storage/revocation

    Raises:
        None: This function does not raise exceptions.

    Security Notes:
        - Token expires after jwt_refresh_token_expire_days (default: 30)
        - Contains "jti" claim for unique token identification
        - Contains "type": "refresh" to prevent using as access token
        - Should be revoked on logout or password change
        - Redis storage preferred over PostgreSQL for performance

    Example:
        >>> from uuid import uuid4
        >>> user_id = uuid4()
        >>> token, expires_at, token_id = create_refresh_token(user_id)
        >>> print(f"Token: {token[:50]}...")
        Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOi...
        >>> print(f"Token ID (jti): {token_id}")
        Token ID (jti): Ks9J_x2mNpQ3rT5aB7cD
        >>> # Store in Redis: refresh:{user_id}:{token_id} -> session_data
    """
    now = datetime.utcnow()
    expires_at = now + timedelta(days=settings.jwt_refresh_token_expire_days)

    # Generate token_id if not provided
    if token_id is None:
        token_id = generate_token_id()

    payload = {
        "sub": str(user_id),  # Subject: user ID
        "exp": expires_at,  # Expiration time
        "iat": now,  # Issued at
        "type": "refresh",  # Token type for validation
        "jti": token_id,  # JWT ID for unique identification and revocation
    }

    # Encode the JWT token
    token = jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    return token, expires_at, token_id


# ============================================================================
# JWT Token Verification
# ============================================================================


def verify_token(token: str, token_type: str = "access") -> UUID:
    """Verify a JWT token and extract the user ID.

    Validates the token signature, expiration, and type. This is a
    cryptographic operation - no database lookup is performed here.
    For refresh tokens, you MUST also check the database to ensure
    the token hasn't been revoked.

    Args:
        token (str): The JWT token string to verify.
        token_type (str): Expected token type ("access" or "refresh").
            Defaults to "access".

    Returns:
        UUID: The user ID extracted from the token's "sub" claim.

    Raises:
        TokenExpiredException: If the token has expired (exp claim).
        TokenInvalidException: If the token is invalid for any reason:
            - Invalid signature (wrong secret key)
            - Invalid format (malformed JWT)
            - Wrong token type (refresh token used as access, etc.)
            - Missing required claims (sub, type)
            - Invalid UUID format in sub claim

    Security Notes:
        - Always verify token type to prevent confused deputy attacks
        - Expired tokens raise TokenExpiredException (401 Unauthorized)
        - Invalid tokens raise TokenInvalidException (401 Unauthorized)
        - For refresh tokens, ALWAYS check database revocation after this
        - Uses constant-time signature verification (timing attack safe)

    Example:
        >>> from uuid import uuid4
        >>> user_id = uuid4()
        >>> # Create and verify access token
        >>> access_token, _ = create_access_token(user_id)
        >>> verified_id = verify_token(access_token, "access")
        >>> assert verified_id == user_id
        >>>
        >>> # Wrong token type raises exception
        >>> refresh_token, _ = create_refresh_token(user_id)
        >>> try:
        ...     verify_token(refresh_token, "access")  # Wrong type!
        ... except TokenInvalidException as e:
        ...     print(f"Caught: {e.detail}")
        Caught: Invalid token type, expected access
        >>>
        >>> # Expired token raises exception
        >>> # (Token with exp in the past would raise TokenExpiredException)
    """
    try:
        # Decode and verify the JWT token
        # This validates:
        # - Signature (using secret key)
        # - Expiration (exp claim)
        # - Algorithm (must match jwt_algorithm)
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )

        # Verify token type matches expected type
        # This prevents using a refresh token as an access token
        if payload.get("type") != token_type:
            raise TokenInvalidException(detail=f"Invalid token type, expected {token_type}")

        # Extract user_id from "sub" claim
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise TokenInvalidException(detail="Token missing subject claim")

        # Convert string UUID to UUID object
        try:
            user_id = UUID(user_id_str)
        except (ValueError, TypeError) as e:
            raise TokenInvalidException(detail=f"Invalid user ID format: {e}")

        return user_id

    except JWTError as e:
        # JWTError is the base exception from python-jose
        # It includes ExpiredSignatureError, JWTClaimsError, etc.

        error_str = str(e).lower()

        # Check if this is an expiration error
        # ExpiredSignatureError message contains "expired"
        if "expired" in error_str or "signature has expired" in error_str:
            raise TokenExpiredException()

        # All other JWT errors are considered invalid tokens
        raise TokenInvalidException(detail=str(e))


def verify_refresh_token_with_jti(token: str) -> tuple[UUID, str | None]:
    """Verify a refresh token and extract both user_id and jti (token_id).

    This function is specifically for refresh tokens and extracts the jti
    claim which is used for Redis-based session management. It handles
    both new tokens (with jti) and legacy tokens (without jti).

    Args:
        token (str): The JWT refresh token string to verify.

    Returns:
        tuple[UUID, str | None]: A tuple containing:
            - UUID: The user_id extracted from the token's "sub" claim
            - str | None: The token_id (jti claim) or None for legacy tokens

    Raises:
        TokenExpiredException: If the token has expired (exp claim).
        TokenInvalidException: If the token is invalid for any reason:
            - Invalid signature (wrong secret key)
            - Invalid format (malformed JWT)
            - Wrong token type (not a refresh token)
            - Missing required claims (sub, type)
            - Invalid UUID format in sub claim

    Security Notes:
        - Always verifies token type is "refresh"
        - Returns None for jti if the token is a legacy token (before Redis sessions)
        - For tokens with jti, you MUST also verify the session exists in Redis
        - For tokens without jti, fall back to PostgreSQL verification

    Example:
        >>> from uuid import uuid4
        >>> user_id = uuid4()
        >>> # Verify new-style token with jti
        >>> token, expires_at, token_id = create_refresh_token(user_id)
        >>> verified_user_id, verified_jti = verify_refresh_token_with_jti(token)
        >>> assert verified_user_id == user_id
        >>> assert verified_jti == token_id
        >>>
        >>> # Legacy tokens return None for jti
        >>> # legacy_token = ... (old token without jti claim)
        >>> # verified_user_id, verified_jti = verify_refresh_token_with_jti(legacy_token)
        >>> # assert verified_jti is None  # Fall back to PostgreSQL
    """
    try:
        # Decode and verify the JWT token
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )

        # Verify token type is "refresh"
        if payload.get("type") != "refresh":
            raise TokenInvalidException(detail="Invalid token type, expected refresh")

        # Extract user_id from "sub" claim
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise TokenInvalidException(detail="Token missing subject claim")

        # Convert string UUID to UUID object
        try:
            user_id = UUID(user_id_str)
        except (ValueError, TypeError) as e:
            raise TokenInvalidException(detail=f"Invalid user ID format: {e}")

        # Extract jti (token_id) - may be None for legacy tokens
        jti = payload.get("jti")

        return user_id, jti

    except JWTError as e:
        error_str = str(e).lower()

        # Check if this is an expiration error
        if "expired" in error_str or "signature has expired" in error_str:
            raise TokenExpiredException()

        # All other JWT errors are considered invalid tokens
        raise TokenInvalidException(detail=str(e))


# ============================================================================
# Token Extraction from HTTP Headers
# ============================================================================

# HTTPBearer security scheme for FastAPI dependency injection
# This will extract the "Authorization: Bearer <token>" header
# auto_error=False means it won't automatically raise 403, we handle it manually
security_scheme = HTTPBearer(auto_error=False)


def extract_token_from_header(
    credentials: Optional[HTTPAuthorizationCredentials],
) -> str:
    """Extract JWT token from Authorization header.

    Used as a FastAPI dependency to extract the Bearer token from
    the Authorization header.

    Args:
        credentials (Optional[HTTPAuthorizationCredentials]):
            Credentials from HTTPBearer dependency.
            None if no Authorization header was provided.

    Returns:
        str: The extracted JWT token string.

    Raises:
        TokenInvalidException: If no credentials were provided.

    Security Notes:
        - Expects "Authorization: Bearer <token>" header
        - Does NOT validate the token (use verify_token for that)
        - Returns raw token string for further processing
        - Raises TokenInvalidException (401) if missing

    Example (in FastAPI endpoint):
        >>> from fastapi import Depends
        >>> from src.core.security import security_scheme, extract_token_from_header, verify_token
        >>>
        >>> @app.get("/protected")
        >>> async def protected_endpoint(
        ...     credentials: HTTPAuthorizationCredentials = Depends(security_scheme)
        ... ):
        ...     # Extract token
        ...     token = extract_token_from_header(credentials)
        ...     # Verify token and get user_id
        ...     user_id = verify_token(token, "access")
        ...     return {"user_id": str(user_id)}
    """
    if not credentials:
        raise TokenInvalidException(detail="No authentication token provided")

    # HTTPAuthorizationCredentials has:
    # - scheme: "Bearer"
    # - credentials: The actual token string
    return str(credentials.credentials)


# ============================================================================
# Export Public API
# ============================================================================

__all__ = [
    # JWT token management
    "create_access_token",
    "create_refresh_token",
    "verify_token",
    "extract_token_from_header",
    "security_scheme",
    # Session management
    "generate_token_id",
    "verify_refresh_token_with_jti",
]
