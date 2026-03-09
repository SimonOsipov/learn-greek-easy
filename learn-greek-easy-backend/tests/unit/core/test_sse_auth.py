"""Tests for SSEAuthResult and get_sse_auth dependency in src/core/dependencies.py."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import Request

from src.core.dependencies import SSEAuthResult, get_sse_auth

# ============================================================
# Fixtures
# ============================================================


def _make_mock_user(is_active: bool = True) -> MagicMock:
    user = MagicMock()
    user.id = uuid4()
    user.email = "test@example.com"
    user.full_name = "Test User"
    user.is_active = is_active
    return user


def _make_mock_request() -> MagicMock:
    request = MagicMock(spec=Request)
    request.state = MagicMock()
    return request


def _make_mock_credentials(token: str) -> MagicMock:
    creds = MagicMock()
    creds.credentials = token
    return creds


# ============================================================
# SSEAuthResult
# ============================================================


class TestSSEAuthResult:
    """Tests for SSEAuthResult dataclass."""

    def test_is_authenticated_true_when_user_set(self) -> None:
        result = SSEAuthResult(user=_make_mock_user())
        assert result.is_authenticated is True

    def test_is_authenticated_false_when_no_user(self) -> None:
        result = SSEAuthResult(error_code="auth_failed", error_message="fail")
        assert result.is_authenticated is False

    def test_default_fields_are_none(self) -> None:
        result = SSEAuthResult()
        assert result.user is None
        assert result.error_code is None
        assert result.error_message is None


# ============================================================
# get_sse_auth
# ============================================================


class TestGetSSEAuth:
    """Tests for get_sse_auth() dependency."""

    @pytest.mark.asyncio
    async def test_missing_token_returns_auth_required(self) -> None:
        result = await get_sse_auth(
            request=_make_mock_request(),
            token=None,
            credentials=None,
            db=AsyncMock(),
        )
        assert result.is_authenticated is False
        assert result.error_code == "auth_required"

    @pytest.mark.asyncio
    async def test_valid_token_from_header(self) -> None:
        mock_user = _make_mock_user()
        mock_claims = MagicMock()

        with (
            patch(
                "src.core.dependencies.verify_supabase_token", return_value=mock_claims
            ) as mock_verify,
            patch("src.core.dependencies.get_or_create_user", return_value=mock_user),
            patch("src.core.dependencies.set_user_context"),
            patch("src.core.dependencies.bind_log_context"),
        ):
            result = await get_sse_auth(
                request=_make_mock_request(),
                token=None,
                credentials=_make_mock_credentials("valid-header-token"),
                db=AsyncMock(),
            )
            mock_verify.assert_called_once_with("valid-header-token")

        assert result.is_authenticated is True
        assert result.user is mock_user

    @pytest.mark.asyncio
    async def test_valid_token_from_query_param(self) -> None:
        mock_user = _make_mock_user()
        mock_claims = MagicMock()

        with (
            patch(
                "src.core.dependencies.verify_supabase_token", return_value=mock_claims
            ) as mock_verify,
            patch("src.core.dependencies.get_or_create_user", return_value=mock_user),
            patch("src.core.dependencies.set_user_context"),
            patch("src.core.dependencies.bind_log_context"),
        ):
            result = await get_sse_auth(
                request=_make_mock_request(),
                token="valid-query-token",
                credentials=None,
                db=AsyncMock(),
            )
            mock_verify.assert_called_once_with("valid-query-token")

        assert result.is_authenticated is True

    @pytest.mark.asyncio
    async def test_header_takes_precedence_over_query_param(self) -> None:
        mock_user = _make_mock_user()
        mock_claims = MagicMock()

        with (
            patch(
                "src.core.dependencies.verify_supabase_token", return_value=mock_claims
            ) as mock_verify,
            patch("src.core.dependencies.get_or_create_user", return_value=mock_user),
            patch("src.core.dependencies.set_user_context"),
            patch("src.core.dependencies.bind_log_context"),
        ):
            await get_sse_auth(
                request=_make_mock_request(),
                token="query-token",
                credentials=_make_mock_credentials("header-token"),
                db=AsyncMock(),
            )
            mock_verify.assert_called_once_with("header-token")

    @pytest.mark.asyncio
    async def test_expired_token_returns_token_expired(self) -> None:
        from src.core.exceptions import TokenExpiredException

        with patch(
            "src.core.dependencies.verify_supabase_token", side_effect=TokenExpiredException()
        ):
            result = await get_sse_auth(
                request=_make_mock_request(),
                token="expired-token",
                credentials=None,
                db=AsyncMock(),
            )
        assert result.is_authenticated is False
        assert result.error_code == "token_expired"

    @pytest.mark.asyncio
    async def test_invalid_token_returns_auth_failed(self) -> None:
        from src.core.exceptions import TokenInvalidException

        exc = TokenInvalidException()
        exc.detail = "bad token"
        with patch("src.core.dependencies.verify_supabase_token", side_effect=exc):
            result = await get_sse_auth(
                request=_make_mock_request(),
                token="bad-token",
                credentials=None,
                db=AsyncMock(),
            )
        assert result.is_authenticated is False
        assert result.error_code == "auth_failed"
