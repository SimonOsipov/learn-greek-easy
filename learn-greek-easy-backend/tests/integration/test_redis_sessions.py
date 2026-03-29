# -*- coding: utf-8 -*-
"""Integration tests for Redis session storage.

These tests verify that the Redis session storage integrates correctly
with the authentication flow. They test the actual Redis operations
when Redis is available, and fallback behavior when Redis is unavailable.

Note: These tests require a running Redis instance (via Docker or local).
If Redis is not available, some tests will be skipped.
"""

from datetime import datetime, timedelta
from uuid import uuid4

import pytest

from src.repositories.session import SessionRepository


class TestSessionRepositoryIntegration:
    """Integration tests for SessionRepository with real Redis operations."""

    @pytest.mark.asyncio
    async def test_create_and_get_session(self, redis_client):
        """Test creating and retrieving a session from Redis."""
        if redis_client is None:
            pytest.skip("Redis not available")

        repo = SessionRepository(redis_client=redis_client)

        user_id = uuid4()
        token_id = "test_token_abc123"
        token = "jwt_token_string"
        expires_at = datetime.utcnow() + timedelta(days=30)

        # Create session
        created = await repo.create_session(
            user_id=user_id,
            token_id=token_id,
            token=token,
            expires_at=expires_at,
            ip_address="192.168.1.1",
            user_agent="Test Browser",
        )
        assert created is True

        # Retrieve session
        session = await repo.get_session(user_id, token_id)
        assert session is not None
        assert session["token_id"] == token_id
        assert session["user_id"] == str(user_id)
        assert session["token"] == token
        assert session["ip_address"] == "192.168.1.1"
        assert session["user_agent"] == "Test Browser"

        # Cleanup
        await repo.delete_session(user_id, token_id)

    @pytest.mark.asyncio
    async def test_validate_session_with_correct_token(self, redis_client):
        """Test session validation with correct token."""
        if redis_client is None:
            pytest.skip("Redis not available")

        repo = SessionRepository(redis_client=redis_client)

        user_id = uuid4()
        token_id = "validate_test_token"
        token = "correct_token_value"
        expires_at = datetime.utcnow() + timedelta(days=30)

        await repo.create_session(
            user_id=user_id,
            token_id=token_id,
            token=token,
            expires_at=expires_at,
        )

        # Validate with correct token
        valid = await repo.validate_session(user_id, token_id, token)
        assert valid is True

        # Validate with wrong token
        invalid = await repo.validate_session(user_id, token_id, "wrong_token")
        assert invalid is False

        # Cleanup
        await repo.delete_session(user_id, token_id)

    @pytest.mark.asyncio
    async def test_delete_session(self, redis_client):
        """Test session deletion from Redis."""
        if redis_client is None:
            pytest.skip("Redis not available")

        repo = SessionRepository(redis_client=redis_client)

        user_id = uuid4()
        token_id = "delete_test_token"

        await repo.create_session(
            user_id=user_id,
            token_id=token_id,
            token="token",
            expires_at=datetime.utcnow() + timedelta(days=30),
        )

        # Verify session exists
        assert await repo.session_exists(user_id, token_id) is True

        # Delete session
        deleted = await repo.delete_session(user_id, token_id)
        assert deleted is True

        # Verify session no longer exists
        assert await repo.session_exists(user_id, token_id) is False

    @pytest.mark.asyncio
    async def test_rotate_session(self, redis_client):
        """Test atomic session rotation."""
        if redis_client is None:
            pytest.skip("Redis not available")

        repo = SessionRepository(redis_client=redis_client)

        user_id = uuid4()
        old_token_id = "old_token_id"
        new_token_id = "new_token_id"

        # Create old session
        await repo.create_session(
            user_id=user_id,
            token_id=old_token_id,
            token="old_token",
            expires_at=datetime.utcnow() + timedelta(days=30),
        )

        # Rotate session
        rotated = await repo.rotate_session(
            user_id=user_id,
            old_token_id=old_token_id,
            new_token_id=new_token_id,
            new_token="new_token",
            new_expires_at=datetime.utcnow() + timedelta(days=30),
            ip_address="10.0.0.1",
        )
        assert rotated is True

        # Old session should not exist
        assert await repo.session_exists(user_id, old_token_id) is False

        # New session should exist
        assert await repo.session_exists(user_id, new_token_id) is True

        # Cleanup
        await repo.delete_session(user_id, new_token_id)

    @pytest.mark.asyncio
    async def test_get_user_sessions(self, redis_client):
        """Test retrieving all sessions for a user."""
        if redis_client is None:
            pytest.skip("Redis not available")

        repo = SessionRepository(redis_client=redis_client)

        user_id = uuid4()
        expires_at = datetime.utcnow() + timedelta(days=30)

        # Create multiple sessions
        for i in range(3):
            await repo.create_session(
                user_id=user_id,
                token_id=f"session_{i}",
                token=f"token_{i}",
                expires_at=expires_at,
                ip_address=f"192.168.1.{i}",
            )

        # Get all sessions
        sessions = await repo.get_user_sessions(user_id)
        assert len(sessions) == 3

        # Verify tokens are not exposed
        for session in sessions:
            assert "token" not in session
            assert "token_id" in session

        # Cleanup
        await repo.revoke_all_user_sessions(user_id)

    @pytest.mark.asyncio
    async def test_revoke_all_user_sessions(self, redis_client):
        """Test revoking all sessions for a user."""
        if redis_client is None:
            pytest.skip("Redis not available")

        repo = SessionRepository(redis_client=redis_client)

        user_id = uuid4()
        expires_at = datetime.utcnow() + timedelta(days=30)

        # Create multiple sessions
        for i in range(5):
            await repo.create_session(
                user_id=user_id,
                token_id=f"revoke_session_{i}",
                token=f"token_{i}",
                expires_at=expires_at,
            )

        # Revoke all
        count = await repo.revoke_all_user_sessions(user_id)
        assert count == 5

        # Verify no sessions remain
        sessions = await repo.get_user_sessions(user_id)
        assert len(sessions) == 0


# =============================================================================
# Pytest Fixtures for Redis
# =============================================================================


@pytest.fixture
async def redis_client():
    """Provide a Redis client for integration tests.

    Returns None if Redis is not available, allowing tests to be skipped.
    """
    from src.core.redis import close_redis, get_redis, init_redis

    try:
        await init_redis()
        client = get_redis()
        if client:
            # Test connection
            await client.ping()
            yield client
        else:
            yield None
    except Exception:
        yield None
    finally:
        await close_redis()
