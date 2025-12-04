# -*- coding: utf-8 -*-
"""Unit tests for SessionRepository (Redis-based session storage)."""

import json
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.repositories.session import SessionRepository


class TestSessionRepositoryAvailability:
    """Test suite for Redis availability checks."""

    def test_is_available_returns_true_when_redis_available(self):
        """Test that is_available returns True when Redis client exists."""
        mock_redis = MagicMock()
        repo = SessionRepository(redis_client=mock_redis)
        assert repo.is_available is True

    def test_is_available_returns_false_when_redis_none(self):
        """Test that is_available returns False when Redis client is None."""
        repo = SessionRepository(redis_client=None)
        # Also patch get_redis to return None
        with patch("src.repositories.session.get_redis", return_value=None):
            assert repo.is_available is False


class TestSessionRepositoryKeyBuilding:
    """Test suite for Redis key construction."""

    def test_session_key_format(self):
        """Test that session key is built correctly."""
        mock_redis = MagicMock()
        repo = SessionRepository(redis_client=mock_redis)

        user_id = uuid4()
        token_id = "abc123"

        key = repo._session_key(user_id, token_id)
        assert key == f"refresh:{user_id}:{token_id}"

    def test_user_sessions_key_format(self):
        """Test that user sessions set key is built correctly."""
        mock_redis = MagicMock()
        repo = SessionRepository(redis_client=mock_redis)

        user_id = uuid4()
        key = repo._user_sessions_key(user_id)
        assert key == f"user_sessions:{user_id}"


class TestCreateSession:
    """Test suite for create_session method."""

    @pytest.mark.asyncio
    async def test_create_session_success(self):
        """Test successful session creation in Redis."""
        mock_redis = AsyncMock()
        mock_pipeline = AsyncMock()
        mock_redis.pipeline.return_value.__aenter__.return_value = mock_pipeline

        repo = SessionRepository(redis_client=mock_redis)

        user_id = uuid4()
        token_id = "test_token_id"
        token = "jwt_token_string"
        expires_at = datetime.utcnow() + timedelta(days=30)

        result = await repo.create_session(
            user_id=user_id,
            token_id=token_id,
            token=token,
            expires_at=expires_at,
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0",
        )

        assert result is True
        mock_pipeline.setex.assert_called_once()
        mock_pipeline.sadd.assert_called_once()
        mock_pipeline.expire.assert_called_once()
        mock_pipeline.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_session_returns_false_when_redis_unavailable(self):
        """Test that create_session returns False when Redis is unavailable."""
        repo = SessionRepository(redis_client=None)

        with patch("src.repositories.session.get_redis", return_value=None):
            result = await repo.create_session(
                user_id=uuid4(),
                token_id="test",
                token="token",
                expires_at=datetime.utcnow() + timedelta(days=30),
            )

        assert result is False

    @pytest.mark.asyncio
    async def test_create_session_handles_redis_error(self):
        """Test that create_session handles Redis errors gracefully."""
        mock_redis = AsyncMock()
        mock_redis.pipeline.side_effect = Exception("Redis connection error")

        repo = SessionRepository(redis_client=mock_redis)

        result = await repo.create_session(
            user_id=uuid4(),
            token_id="test",
            token="token",
            expires_at=datetime.utcnow() + timedelta(days=30),
        )

        assert result is False


class TestGetSession:
    """Test suite for get_session method."""

    @pytest.mark.asyncio
    async def test_get_session_returns_data(self):
        """Test successful session retrieval."""
        mock_redis = AsyncMock()
        user_id = uuid4()
        token_id = "test_token_id"

        session_data = {
            "token_id": token_id,
            "user_id": str(user_id),
            "token": "jwt_token",
            "created_at": datetime.utcnow().isoformat(),
        }
        mock_redis.get.return_value = json.dumps(session_data)

        repo = SessionRepository(redis_client=mock_redis)
        result = await repo.get_session(user_id, token_id)

        assert result is not None
        assert result["token_id"] == token_id
        assert result["token"] == "jwt_token"

    @pytest.mark.asyncio
    async def test_get_session_returns_none_when_not_found(self):
        """Test get_session returns None when session doesn't exist."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None

        repo = SessionRepository(redis_client=mock_redis)
        result = await repo.get_session(uuid4(), "nonexistent")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_session_returns_none_when_redis_unavailable(self):
        """Test get_session returns None when Redis is unavailable."""
        repo = SessionRepository(redis_client=None)

        with patch("src.repositories.session.get_redis", return_value=None):
            result = await repo.get_session(uuid4(), "test")

        assert result is None


class TestValidateSession:
    """Test suite for validate_session method."""

    @pytest.mark.asyncio
    async def test_validate_session_returns_true_for_valid_session(self):
        """Test that validate_session returns True for valid session."""
        mock_redis = AsyncMock()
        user_id = uuid4()
        token_id = "test_token_id"
        token = "jwt_token"

        session_data = {
            "token_id": token_id,
            "user_id": str(user_id),
            "token": token,
        }
        mock_redis.get.return_value = json.dumps(session_data)

        repo = SessionRepository(redis_client=mock_redis)
        result = await repo.validate_session(user_id, token_id, token)

        assert result is True

    @pytest.mark.asyncio
    async def test_validate_session_returns_false_for_token_mismatch(self):
        """Test that validate_session returns False when token doesn't match."""
        mock_redis = AsyncMock()
        user_id = uuid4()
        token_id = "test_token_id"

        session_data = {
            "token_id": token_id,
            "user_id": str(user_id),
            "token": "stored_token",
        }
        mock_redis.get.return_value = json.dumps(session_data)

        repo = SessionRepository(redis_client=mock_redis)
        result = await repo.validate_session(user_id, token_id, "different_token")

        assert result is False

    @pytest.mark.asyncio
    async def test_validate_session_returns_false_when_session_not_found(self):
        """Test that validate_session returns False when session doesn't exist."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None

        repo = SessionRepository(redis_client=mock_redis)
        result = await repo.validate_session(uuid4(), "test", "token")

        assert result is False


class TestDeleteSession:
    """Test suite for delete_session method."""

    @pytest.mark.asyncio
    async def test_delete_session_success(self):
        """Test successful session deletion."""
        mock_redis = AsyncMock()
        mock_pipeline = AsyncMock()
        mock_redis.pipeline.return_value.__aenter__.return_value = mock_pipeline

        repo = SessionRepository(redis_client=mock_redis)

        result = await repo.delete_session(uuid4(), "test_token_id")

        assert result is True
        mock_pipeline.delete.assert_called_once()
        mock_pipeline.srem.assert_called_once()
        mock_pipeline.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_session_returns_false_when_redis_unavailable(self):
        """Test delete_session returns False when Redis unavailable."""
        repo = SessionRepository(redis_client=None)

        with patch("src.repositories.session.get_redis", return_value=None):
            result = await repo.delete_session(uuid4(), "test")

        assert result is False


class TestRotateSession:
    """Test suite for rotate_session method."""

    @pytest.mark.asyncio
    async def test_rotate_session_success(self):
        """Test successful session rotation."""
        mock_redis = AsyncMock()
        mock_pipeline = AsyncMock()
        mock_redis.pipeline.return_value.__aenter__.return_value = mock_pipeline

        repo = SessionRepository(redis_client=mock_redis)

        user_id = uuid4()
        result = await repo.rotate_session(
            user_id=user_id,
            old_token_id="old_token",
            new_token_id="new_token",
            new_token="new_jwt_token",
            new_expires_at=datetime.utcnow() + timedelta(days=30),
        )

        assert result is True
        # Should delete old and create new in atomic pipeline
        assert mock_pipeline.delete.call_count == 1
        assert mock_pipeline.srem.call_count == 1
        assert mock_pipeline.setex.call_count == 1
        assert mock_pipeline.sadd.call_count == 1

    @pytest.mark.asyncio
    async def test_rotate_session_returns_false_when_redis_unavailable(self):
        """Test rotate_session returns False when Redis unavailable."""
        repo = SessionRepository(redis_client=None)

        with patch("src.repositories.session.get_redis", return_value=None):
            result = await repo.rotate_session(
                user_id=uuid4(),
                old_token_id="old",
                new_token_id="new",
                new_token="token",
                new_expires_at=datetime.utcnow() + timedelta(days=30),
            )

        assert result is False


class TestGetUserSessions:
    """Test suite for get_user_sessions method."""

    @pytest.mark.asyncio
    async def test_get_user_sessions_returns_sessions(self):
        """Test successful retrieval of user sessions."""
        mock_redis = AsyncMock()
        user_id = uuid4()

        # Mock smembers to return token_ids
        mock_redis.smembers.return_value = {"token1", "token2"}

        # Mock get to return session data
        session1 = {
            "token_id": "token1",
            "created_at": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(days=30)).isoformat(),
            "ip_address": "192.168.1.1",
        }
        session2 = {
            "token_id": "token2",
            "created_at": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(days=30)).isoformat(),
            "ip_address": "192.168.1.2",
        }

        async def mock_get(key):
            if "token1" in key:
                return json.dumps(session1)
            elif "token2" in key:
                return json.dumps(session2)
            return None

        mock_redis.get.side_effect = mock_get

        repo = SessionRepository(redis_client=mock_redis)
        sessions = await repo.get_user_sessions(user_id)

        assert len(sessions) == 2
        # Verify tokens are not exposed
        for session in sessions:
            assert "token" not in session
            assert "token_id" in session

    @pytest.mark.asyncio
    async def test_get_user_sessions_returns_empty_list_when_no_sessions(self):
        """Test get_user_sessions returns empty list when no sessions."""
        mock_redis = AsyncMock()
        mock_redis.smembers.return_value = set()

        repo = SessionRepository(redis_client=mock_redis)
        sessions = await repo.get_user_sessions(uuid4())

        assert sessions == []


class TestRevokeAllUserSessions:
    """Test suite for revoke_all_user_sessions method."""

    @pytest.mark.asyncio
    async def test_revoke_all_sessions_success(self):
        """Test successful revocation of all user sessions."""
        mock_redis = AsyncMock()
        mock_redis.smembers.return_value = {"token1", "token2", "token3"}

        mock_pipeline = AsyncMock()
        mock_redis.pipeline.return_value.__aenter__.return_value = mock_pipeline

        repo = SessionRepository(redis_client=mock_redis)
        count = await repo.revoke_all_user_sessions(uuid4())

        assert count == 3
        # Should delete 3 session keys + 1 user sessions set
        assert mock_pipeline.delete.call_count == 4
        mock_pipeline.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_revoke_all_sessions_returns_zero_when_no_sessions(self):
        """Test revoke_all returns 0 when no sessions exist."""
        mock_redis = AsyncMock()
        mock_redis.smembers.return_value = set()

        repo = SessionRepository(redis_client=mock_redis)
        count = await repo.revoke_all_user_sessions(uuid4())

        assert count == 0


class TestSessionExists:
    """Test suite for session_exists method."""

    @pytest.mark.asyncio
    async def test_session_exists_returns_true(self):
        """Test session_exists returns True when session exists."""
        mock_redis = AsyncMock()
        mock_redis.exists.return_value = 1

        repo = SessionRepository(redis_client=mock_redis)
        result = await repo.session_exists(uuid4(), "token_id")

        assert result is True

    @pytest.mark.asyncio
    async def test_session_exists_returns_false(self):
        """Test session_exists returns False when session doesn't exist."""
        mock_redis = AsyncMock()
        mock_redis.exists.return_value = 0

        repo = SessionRepository(redis_client=mock_redis)
        result = await repo.session_exists(uuid4(), "token_id")

        assert result is False

    @pytest.mark.asyncio
    async def test_session_exists_returns_false_when_redis_unavailable(self):
        """Test session_exists returns False when Redis unavailable."""
        repo = SessionRepository(redis_client=None)

        with patch("src.repositories.session.get_redis", return_value=None):
            result = await repo.session_exists(uuid4(), "token_id")

        assert result is False
