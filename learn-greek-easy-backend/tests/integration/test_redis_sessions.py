# -*- coding: utf-8 -*-
"""Integration tests for Redis session storage.

These tests verify that the Redis session storage integrates correctly
with the authentication flow. They test the actual Redis operations
when Redis is available, and fallback behavior when Redis is unavailable.

Note: These tests require a running Redis instance (via Docker or local).
If Redis is not available, some tests will be skipped.
"""

from datetime import datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

import pytest

from src.core.security import create_refresh_token, verify_refresh_token_with_jti
from src.repositories.session import SessionRepository
from src.services.auth_service import AuthService


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


class TestAuthServiceRedisIntegration:
    """Integration tests for AuthService with Redis session storage."""

    @pytest.mark.asyncio
    async def test_refresh_token_includes_jti(self):
        """Test that new refresh tokens include jti claim."""
        user_id = uuid4()
        token, expires_at, token_id = create_refresh_token(user_id)

        # Verify token_id is returned
        assert token_id is not None
        assert len(token_id) > 10

        # Verify jti can be extracted from token
        verified_user_id, verified_jti = verify_refresh_token_with_jti(token)
        assert verified_user_id == user_id
        assert verified_jti == token_id

    @pytest.mark.asyncio
    async def test_login_stores_session_in_redis(self, db_session, redis_client):
        """Test that login stores session in Redis when available."""
        if redis_client is None:
            pytest.skip("Redis not available")

        from src.core.security import hash_password
        from src.db.models import User
        from src.schemas.user import UserLogin

        # Create test user
        user = User(
            email="redis_login_test@example.com",
            password_hash=hash_password("TestPass123!"),
            full_name="Redis Login Test",
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        # Create session repo with redis client
        session_repo = SessionRepository(redis_client=redis_client)

        # Create auth service
        auth_service = AuthService(db=db_session, session_repo=session_repo)

        # Login
        login_data = UserLogin(email="redis_login_test@example.com", password="TestPass123!")
        logged_in_user, tokens = await auth_service.login_user(
            login_data,
            client_ip="127.0.0.1",
            user_agent="Test Client",
        )

        # Verify session is in Redis
        sessions = await session_repo.get_user_sessions(logged_in_user.id)
        assert len(sessions) >= 1

        # Verify session has IP and user agent
        session = sessions[0]
        assert session["ip_address"] == "127.0.0.1"
        assert session["user_agent"] == "Test Client"

        # Cleanup
        await session_repo.revoke_all_user_sessions(logged_in_user.id)


class TestFallbackToPostgres:
    """Test fallback behavior when Redis is unavailable."""

    @pytest.mark.asyncio
    async def test_login_falls_back_to_postgres_when_redis_unavailable(self, db_session):
        """Test that login stores token in PostgreSQL when Redis unavailable."""
        from sqlalchemy import select

        from src.core.security import hash_password
        from src.db.models import RefreshToken, User
        from src.schemas.user import UserLogin

        # Create test user
        user = User(
            email="postgres_fallback_test@example.com",
            password_hash=hash_password("TestPass123!"),
            full_name="Postgres Fallback Test",
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        # Create session repo that simulates Redis being unavailable
        session_repo = SessionRepository(redis_client=None)

        # Create auth service with unavailable Redis
        with patch("src.repositories.session.get_redis", return_value=None):
            auth_service = AuthService(db=db_session, session_repo=session_repo)

            # Login
            login_data = UserLogin(
                email="postgres_fallback_test@example.com",
                password="TestPass123!",
            )
            logged_in_user, tokens = await auth_service.login_user(login_data)

        # Verify token is in PostgreSQL
        result = await db_session.execute(
            select(RefreshToken).where(RefreshToken.user_id == logged_in_user.id)
        )
        db_tokens = result.scalars().all()
        assert len(db_tokens) >= 1

    @pytest.mark.asyncio
    async def test_get_user_sessions_includes_both_sources(self, db_session):
        """Test that get_user_sessions returns sessions from both Redis and PostgreSQL."""
        from unittest.mock import AsyncMock

        from src.db.models import RefreshToken

        user_id = uuid4()

        # Create a mock session repo that returns Redis sessions
        mock_session_repo = AsyncMock(spec=SessionRepository)
        mock_session_repo.get_user_sessions.return_value = [
            {
                "token_id": "redis_session_1",
                "created_at": datetime.utcnow().isoformat(),
                "expires_at": (datetime.utcnow() + timedelta(days=30)).isoformat(),
                "ip_address": "192.168.1.1",
                "user_agent": "Chrome",
            }
        ]
        mock_session_repo.revoke_all_user_sessions.return_value = 0

        # Create PostgreSQL token directly in database
        from src.db.models import User

        user = User(
            id=user_id,
            email="both_sources_test@example.com",
            password_hash="hashed",
            full_name="Both Sources Test",
            is_active=True,
        )
        db_session.add(user)
        await db_session.flush()

        pg_token = RefreshToken(
            user_id=user_id,
            token="pg_token_123",
            expires_at=datetime.utcnow() + timedelta(days=30),
        )
        db_session.add(pg_token)
        await db_session.commit()

        # Create auth service
        auth_service = AuthService(db=db_session, session_repo=mock_session_repo)

        # Get sessions
        sessions = await auth_service.get_user_sessions(user_id)

        # Should have sessions from both sources
        assert len(sessions) == 2

        # Check sources
        sources = [s["source"] for s in sessions]
        assert "redis" in sources
        assert "postgres" in sources


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
