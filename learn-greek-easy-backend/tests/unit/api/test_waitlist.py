"""Unit tests for waitlist API endpoints.

Tests for:
- POST /api/v1/waitlist/subscribe
- POST /api/v1/waitlist/confirm

Uses a standalone FastAPI app (no DB required — waitlist has no DB dependency).
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.api.v1.waitlist import router

# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def app() -> FastAPI:
    """Standalone FastAPI app with waitlist router."""
    test_app = FastAPI()
    test_app.include_router(router, prefix="/api/v1/waitlist")
    return test_app


@pytest.fixture
async def client(app: FastAPI) -> AsyncClient:
    """Async HTTP client for the standalone app."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_service_subscribe_success():
    """Mock WaitlistService.subscribe returning success."""
    with patch("src.api.v1.waitlist.WaitlistService") as mock_cls:
        mock_instance = MagicMock()
        mock_instance.subscribe = AsyncMock(return_value={"message": "Check your email to confirm"})
        mock_cls.return_value = mock_instance
        yield mock_instance


@pytest.fixture
def mock_service_confirm_success():
    """Mock WaitlistService.confirm returning True."""
    with patch("src.api.v1.waitlist.WaitlistService") as mock_cls:
        mock_instance = MagicMock()
        mock_instance.confirm = AsyncMock(return_value=True)
        mock_cls.return_value = mock_instance
        yield mock_instance


@pytest.fixture
def mock_service_confirm_failure():
    """Mock WaitlistService.confirm returning False."""
    with patch("src.api.v1.waitlist.WaitlistService") as mock_cls:
        mock_instance = MagicMock()
        mock_instance.confirm = AsyncMock(return_value=False)
        mock_cls.return_value = mock_instance
        yield mock_instance


# =============================================================================
# POST /subscribe Tests
# =============================================================================


@pytest.mark.asyncio
class TestWaitlistSubscribe:
    """Tests for POST /api/v1/waitlist/subscribe."""

    async def test_subscribe_success_returns_201(
        self, client: AsyncClient, mock_service_subscribe_success: MagicMock
    ) -> None:
        """Happy path: valid email returns 201 with message."""
        response = await client.post(
            "/api/v1/waitlist/subscribe",
            json={"email": "user@example.com"},
        )
        assert response.status_code == 201
        assert response.json()["message"] == "Check your email to confirm"

    async def test_subscribe_invalid_email_returns_422(self, client: AsyncClient) -> None:
        """Invalid email format returns 422 (Pydantic validation)."""
        response = await client.post(
            "/api/v1/waitlist/subscribe",
            json={"email": "not-an-email"},
        )
        assert response.status_code == 422

    async def test_subscribe_duplicate_returns_409(self, client: AsyncClient) -> None:
        """Duplicate email returns 409."""
        from src.services.waitlist_service import WaitlistDuplicateError

        with patch("src.api.v1.waitlist.WaitlistService") as mock_cls:
            mock_instance = MagicMock()
            mock_instance.subscribe = AsyncMock(side_effect=WaitlistDuplicateError())
            mock_cls.return_value = mock_instance
            response = await client.post(
                "/api/v1/waitlist/subscribe",
                json={"email": "user@example.com"},
            )
        assert response.status_code == 409
        assert response.json()["detail"] == "Email already registered"

    async def test_subscribe_api_failure_returns_502(self, client: AsyncClient) -> None:
        """Resend API failure returns 502."""
        from src.services.waitlist_service import WaitlistAPIError

        with patch("src.api.v1.waitlist.WaitlistService") as mock_cls:
            mock_instance = MagicMock()
            mock_instance.subscribe = AsyncMock(side_effect=WaitlistAPIError())
            mock_cls.return_value = mock_instance
            response = await client.post(
                "/api/v1/waitlist/subscribe",
                json={"email": "user@example.com"},
            )
        assert response.status_code == 502
        assert response.json()["detail"] == "Failed to process signup"


# =============================================================================
# POST /confirm Tests
# =============================================================================


@pytest.mark.asyncio
class TestWaitlistConfirm:
    """Tests for POST /api/v1/waitlist/confirm."""

    async def test_confirm_valid_token_returns_200(
        self, client: AsyncClient, mock_service_confirm_success: MagicMock
    ) -> None:
        """Valid token returns 200 with success message."""
        response = await client.post(
            "/api/v1/waitlist/confirm",
            json={"token": "contact-id-123.random-secret-abc"},
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Email confirmed"

    async def test_confirm_invalid_token_returns_400(
        self, client: AsyncClient, mock_service_confirm_failure: MagicMock
    ) -> None:
        """Invalid/expired token returns 400."""
        response = await client.post(
            "/api/v1/waitlist/confirm",
            json={"token": "invalid.token"},
        )
        assert response.status_code == 400
        assert "invalid" in response.json()["detail"].lower()

    async def test_confirm_missing_token_returns_422(self, client: AsyncClient) -> None:
        """Missing token field returns 422."""
        response = await client.post("/api/v1/waitlist/confirm", json={})
        assert response.status_code == 422

    async def test_confirm_calls_service_with_token(
        self, client: AsyncClient, mock_service_confirm_success: MagicMock
    ) -> None:
        """Service.confirm is called with the exact token from the body."""
        token = "abc123.secretxyz"
        await client.post("/api/v1/waitlist/confirm", json={"token": token})
        mock_service_confirm_success.confirm.assert_called_once_with(token)
