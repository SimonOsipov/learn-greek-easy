"""Integration tests for user settings API endpoints.

Tests for PATCH /api/v1/auth/me focusing on settings updates including theme.

Run with:
    pytest tests/integration/api/test_user_settings.py -v
"""

import pytest
from httpx import AsyncClient

from src.db.models import User


@pytest.mark.integration
@pytest.mark.auth
class TestUserSettingsUpdate:
    """Tests for updating user settings via PATCH /api/v1/auth/me."""

    @pytest.mark.asyncio
    async def test_update_theme_to_dark(
        self,
        client: AsyncClient,
        test_user: User,
        auth_headers: dict[str, str],
    ) -> None:
        """Test updating user theme preference to dark."""
        response = await client.patch(
            "/api/v1/auth/me",
            json={"theme": "dark"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["settings"]["theme"] == "dark"

    @pytest.mark.asyncio
    async def test_update_theme_to_light(
        self,
        client: AsyncClient,
        test_user: User,
        auth_headers: dict[str, str],
    ) -> None:
        """Test updating user theme preference to light."""
        response = await client.patch(
            "/api/v1/auth/me",
            json={"theme": "light"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["settings"]["theme"] == "light"

    @pytest.mark.asyncio
    async def test_update_theme_invalid_value(
        self,
        client: AsyncClient,
        test_user: User,
        auth_headers: dict[str, str],
    ) -> None:
        """Test that invalid theme values are rejected."""
        response = await client.patch(
            "/api/v1/auth/me",
            json={"theme": "invalid"},
            headers=auth_headers,
        )

        assert response.status_code == 422
        # Verify the error response contains validation failure info
        data = response.json()
        # Response format: {"success": False, "error": {...}}
        assert data.get("success") is False or "error" in data or "detail" in data

    @pytest.mark.asyncio
    async def test_update_theme_with_other_settings(
        self,
        client: AsyncClient,
        test_user: User,
        auth_headers: dict[str, str],
    ) -> None:
        """Test updating theme along with other settings."""
        response = await client.patch(
            "/api/v1/auth/me",
            json={
                "theme": "dark",
                "daily_goal": 30,
                "email_notifications": False,
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["settings"]["theme"] == "dark"
        assert data["settings"]["daily_goal"] == 30
        assert data["settings"]["email_notifications"] is False

    @pytest.mark.asyncio
    async def test_get_me_returns_theme(
        self,
        client: AsyncClient,
        test_user: User,
        auth_headers: dict[str, str],
    ) -> None:
        """Test that GET /me returns theme in settings."""
        # First, set a theme
        await client.patch(
            "/api/v1/auth/me",
            json={"theme": "dark"},
            headers=auth_headers,
        )

        # Then fetch the user profile
        response = await client.get(
            "/api/v1/auth/me",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "settings" in data
        assert "theme" in data["settings"]
        assert data["settings"]["theme"] == "dark"

    @pytest.mark.asyncio
    async def test_theme_defaults_to_null(
        self,
        client: AsyncClient,
        test_user: User,
        auth_headers: dict[str, str],
    ) -> None:
        """Test that theme defaults to null for new users."""
        response = await client.get(
            "/api/v1/auth/me",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        # Default theme should be None (null in JSON)
        assert data["settings"]["theme"] is None
