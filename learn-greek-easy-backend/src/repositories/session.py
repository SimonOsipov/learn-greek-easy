"""Redis-based session repository for refresh token management.

This module provides a repository for managing refresh token sessions
using Redis as the ONLY storage backend. It supports:
- Fast session creation and validation
- Token rotation with atomic operations
- User session listing and revocation
- Automatic session expiry via Redis TTL

NOTE: Redis is required for session management. There is no PostgreSQL fallback.
If Redis is unavailable, session operations will fail gracefully.
"""

import json
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from redis.asyncio import Redis

from src.config import settings
from src.core.logging import get_logger
from src.core.redis import get_redis

logger = get_logger(__name__)


class SessionRepository:
    """Repository for managing refresh token sessions in Redis.

    Redis Key Schema:
        - Session data: `refresh:{user_id}:{token_id}` -> JSON session data
        - User sessions set: `user_sessions:{user_id}` -> Set of token_ids

    Session Data Structure:
        {
            "token_id": "abc123",
            "user_id": "uuid-string",
            "token": "eyJ...",
            "created_at": "ISO8601 timestamp",
            "ip_address": "optional IP",
            "user_agent": "optional user agent"
        }

    TTL:
        Sessions automatically expire based on settings.session_ttl_days.
        Both the session key and the user sessions set member are managed.
    """

    def __init__(self, redis_client: Optional[Redis] = None):
        """Initialize the session repository.

        Args:
            redis_client: Optional Redis client. If not provided, uses the
                global Redis client from get_redis().
        """
        self._redis = redis_client

    @property
    def redis(self) -> Optional[Redis]:
        """Get the Redis client, using global client if not set."""
        if self._redis is not None:
            return self._redis
        return get_redis()

    @property
    def is_available(self) -> bool:
        """Check if Redis is available for session storage."""
        return self.redis is not None

    def _session_key(self, user_id: UUID, token_id: str) -> str:
        """Build Redis key for a session.

        Args:
            user_id: User's UUID
            token_id: Unique token identifier (jti)

        Returns:
            Redis key in format: refresh:{user_id}:{token_id}
        """
        return f"{settings.session_key_prefix}{user_id}:{token_id}"

    def _user_sessions_key(self, user_id: UUID) -> str:
        """Build Redis key for user's sessions set.

        Args:
            user_id: User's UUID

        Returns:
            Redis key in format: user_sessions:{user_id}
        """
        return f"user_sessions:{user_id}"

    def _calculate_ttl_seconds(self) -> int:
        """Calculate TTL in seconds from settings.session_ttl_days."""
        return settings.session_ttl_days * 24 * 60 * 60

    async def create_session(
        self,
        user_id: UUID,
        token_id: str,
        token: str,
        expires_at: datetime,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> bool:
        """Create a new session in Redis.

        Args:
            user_id: User's UUID
            token_id: Unique token identifier (jti from JWT)
            token: The refresh token string
            expires_at: Token expiration timestamp
            ip_address: Optional client IP address
            user_agent: Optional client user agent

        Returns:
            True if session was created successfully, False if Redis unavailable

        Raises:
            None: Errors are logged and False is returned
        """
        redis = self.redis
        if redis is None:
            logger.debug("Redis unavailable, cannot create session")
            return False

        try:
            session_data = {
                "token_id": token_id,
                "user_id": str(user_id),
                "token": token,
                "created_at": datetime.utcnow().isoformat(),
                "expires_at": expires_at.isoformat(),
                "ip_address": ip_address,
                "user_agent": user_agent,
            }

            session_key = self._session_key(user_id, token_id)
            user_sessions_key = self._user_sessions_key(user_id)
            ttl_seconds = self._calculate_ttl_seconds()

            # Use pipeline for atomic operation
            async with redis.pipeline(transaction=True) as pipe:
                # Store session data with TTL
                pipe.setex(session_key, ttl_seconds, json.dumps(session_data))
                # Add token_id to user's sessions set
                pipe.sadd(user_sessions_key, token_id)
                # Set TTL on user sessions set (refresh on each new session)
                pipe.expire(user_sessions_key, ttl_seconds)
                await pipe.execute()

            logger.debug(
                "Session created in Redis",
                extra={"user_id": str(user_id), "token_id": token_id},
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to create session in Redis: {e}",
                extra={"user_id": str(user_id), "token_id": token_id},
            )
            return False

    async def get_session(self, user_id: UUID, token_id: str) -> Optional[dict[str, Any]]:
        """Get session data from Redis.

        Args:
            user_id: User's UUID
            token_id: Unique token identifier

        Returns:
            Session data dict if found, None otherwise
        """
        redis = self.redis
        if redis is None:
            return None

        try:
            session_key = self._session_key(user_id, token_id)
            data = await redis.get(session_key)

            if data is None:
                return None

            result: dict[str, Any] = json.loads(data)
            return result

        except Exception as e:
            logger.error(
                f"Failed to get session from Redis: {e}",
                extra={"user_id": str(user_id), "token_id": token_id},
            )
            return None

    async def validate_session(self, user_id: UUID, token_id: str, token: str) -> bool:
        """Validate that a session exists and matches the token.

        Args:
            user_id: User's UUID
            token_id: Unique token identifier
            token: The refresh token string to validate

        Returns:
            True if session exists and token matches, False otherwise
        """
        session_data = await self.get_session(user_id, token_id)

        if session_data is None:
            return False

        # Verify the token matches what's stored
        stored_token = session_data.get("token")
        if stored_token != token:
            logger.warning(
                "Token mismatch for session",
                extra={"user_id": str(user_id), "token_id": token_id},
            )
            return False

        return True

    async def delete_session(self, user_id: UUID, token_id: str) -> bool:
        """Delete a session from Redis.

        Args:
            user_id: User's UUID
            token_id: Unique token identifier

        Returns:
            True if session was deleted, False if Redis unavailable or error
        """
        redis = self.redis
        if redis is None:
            return False

        try:
            session_key = self._session_key(user_id, token_id)
            user_sessions_key = self._user_sessions_key(user_id)

            # Use pipeline for atomic operation
            async with redis.pipeline(transaction=True) as pipe:
                pipe.delete(session_key)
                pipe.srem(user_sessions_key, token_id)
                await pipe.execute()

            logger.debug(
                "Session deleted from Redis",
                extra={"user_id": str(user_id), "token_id": token_id},
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to delete session from Redis: {e}",
                extra={"user_id": str(user_id), "token_id": token_id},
            )
            return False

    async def rotate_session(
        self,
        user_id: UUID,
        old_token_id: str,
        new_token_id: str,
        new_token: str,
        new_expires_at: datetime,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> bool:
        """Atomically rotate a session (delete old, create new).

        This implements secure token rotation where the old token is
        invalidated and a new token is created in a single atomic operation.

        Args:
            user_id: User's UUID
            old_token_id: Token ID to invalidate
            new_token_id: New token ID
            new_token: New refresh token string
            new_expires_at: New token expiration
            ip_address: Optional client IP address
            user_agent: Optional client user agent

        Returns:
            True if rotation succeeded, False otherwise
        """
        redis = self.redis
        if redis is None:
            return False

        try:
            old_session_key = self._session_key(user_id, old_token_id)
            new_session_key = self._session_key(user_id, new_token_id)
            user_sessions_key = self._user_sessions_key(user_id)
            ttl_seconds = self._calculate_ttl_seconds()

            new_session_data = {
                "token_id": new_token_id,
                "user_id": str(user_id),
                "token": new_token,
                "created_at": datetime.utcnow().isoformat(),
                "expires_at": new_expires_at.isoformat(),
                "ip_address": ip_address,
                "user_agent": user_agent,
            }

            # Use pipeline for atomic operation
            async with redis.pipeline(transaction=True) as pipe:
                # Delete old session
                pipe.delete(old_session_key)
                pipe.srem(user_sessions_key, old_token_id)
                # Create new session
                pipe.setex(new_session_key, ttl_seconds, json.dumps(new_session_data))
                pipe.sadd(user_sessions_key, new_token_id)
                pipe.expire(user_sessions_key, ttl_seconds)
                await pipe.execute()

            logger.debug(
                "Session rotated in Redis",
                extra={
                    "user_id": str(user_id),
                    "old_token_id": old_token_id,
                    "new_token_id": new_token_id,
                },
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to rotate session in Redis: {e}",
                extra={"user_id": str(user_id), "old_token_id": old_token_id},
            )
            return False

    async def get_user_sessions(self, user_id: UUID) -> list[dict[str, Any]]:
        """Get all active sessions for a user.

        Args:
            user_id: User's UUID

        Returns:
            List of session data dicts (without exposing tokens)
        """
        redis = self.redis
        if redis is None:
            return []

        try:
            user_sessions_key = self._user_sessions_key(user_id)

            # Get all token_ids for this user
            token_ids = await redis.smembers(user_sessions_key)

            if not token_ids:
                return []

            sessions = []
            for token_id in token_ids:
                session_data = await self.get_session(user_id, token_id)
                if session_data:
                    # Return session info without exposing the token
                    sessions.append(
                        {
                            "token_id": session_data.get("token_id"),
                            "created_at": session_data.get("created_at"),
                            "expires_at": session_data.get("expires_at"),
                            "ip_address": session_data.get("ip_address"),
                            "user_agent": session_data.get("user_agent"),
                        }
                    )

            return sessions

        except Exception as e:
            logger.error(
                f"Failed to get user sessions from Redis: {e}",
                extra={"user_id": str(user_id)},
            )
            return []

    async def revoke_all_user_sessions(self, user_id: UUID) -> int:
        """Revoke all sessions for a user.

        This is used when logging out from all devices, changing password,
        or deactivating an account.

        Args:
            user_id: User's UUID

        Returns:
            Number of sessions revoked
        """
        redis = self.redis
        if redis is None:
            return 0

        try:
            user_sessions_key = self._user_sessions_key(user_id)

            # Get all token_ids for this user
            token_ids = await redis.smembers(user_sessions_key)

            if not token_ids:
                return 0

            # Build list of session keys to delete
            session_keys = [self._session_key(user_id, token_id) for token_id in token_ids]

            # Delete all sessions and the user sessions set
            async with redis.pipeline(transaction=True) as pipe:
                for key in session_keys:
                    pipe.delete(key)
                pipe.delete(user_sessions_key)
                await pipe.execute()

            count = len(token_ids)
            logger.info(
                "All user sessions revoked from Redis",
                extra={"user_id": str(user_id), "sessions_revoked": count},
            )
            return count

        except Exception as e:
            logger.error(
                f"Failed to revoke all user sessions from Redis: {e}",
                extra={"user_id": str(user_id)},
            )
            return 0

    async def session_exists(self, user_id: UUID, token_id: str) -> bool:
        """Check if a session exists in Redis.

        Args:
            user_id: User's UUID
            token_id: Unique token identifier

        Returns:
            True if session exists, False otherwise
        """
        redis = self.redis
        if redis is None:
            return False

        try:
            session_key = self._session_key(user_id, token_id)
            return await redis.exists(session_key) > 0

        except Exception as e:
            logger.error(
                f"Failed to check session existence in Redis: {e}",
                extra={"user_id": str(user_id), "token_id": token_id},
            )
            return False
