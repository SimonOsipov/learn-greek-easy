"""Integration tests for Google OAuth endpoint."""

from unittest.mock import patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import User, UserSettings


class TestGoogleOAuthEndpoint:
    """Integration tests for POST /api/v1/auth/google."""

    @pytest.mark.asyncio
    async def test_google_oauth_disabled_returns_503(self, client: AsyncClient):
        """Test 503 returned when Google OAuth is disabled."""
        with patch("src.config.settings") as mock_settings:
            mock_settings.google_oauth_configured = False

            response = await client.post(
                "/api/v1/auth/google",
                json={"id_token": "x" * 200},
            )

            assert response.status_code == 503
            error = response.json()
            error_msg = error.get("detail") or error.get("error", {}).get("message", "")
            assert "not enabled" in error_msg.lower()

    @pytest.mark.asyncio
    async def test_invalid_token_returns_401(self, client: AsyncClient):
        """Test 401 returned for invalid token."""
        with patch("src.config.settings") as mock_settings:
            mock_settings.google_oauth_configured = True
            mock_settings.google_client_id = "test-client-id"

            with patch("src.core.security.google_id_token.verify_oauth2_token") as mock_verify:
                mock_verify.side_effect = ValueError("Invalid token")

                response = await client.post(
                    "/api/v1/auth/google",
                    json={"id_token": "invalid-token" * 20},
                )

                assert response.status_code == 401
                error = response.json()
                error_msg = error.get("detail") or error.get("error", {}).get("message", "")
                assert "invalid" in error_msg.lower()

    @pytest.mark.asyncio
    async def test_successful_google_login_creates_user(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        """Test successful Google login returns tokens and creates user."""
        email = f"googleuser_{uuid4().hex[:8]}@example.com"

        with patch("src.config.settings") as mock_settings:
            mock_settings.google_oauth_configured = True
            mock_settings.google_client_id = "test-client-id"

            with patch("src.core.security.google_id_token.verify_oauth2_token") as mock_verify:
                mock_verify.return_value = {
                    "sub": f"google-{uuid4().hex[:12]}",
                    "email": email,
                    "email_verified": True,
                    "name": "New Google User",
                    "iss": "accounts.google.com",
                }

                response = await client.post(
                    "/api/v1/auth/google",
                    json={"id_token": "valid-token" * 50},
                )

                assert response.status_code == 200
                data = response.json()
                assert "access_token" in data
                assert "refresh_token" in data
                assert data["token_type"] == "bearer"
                assert data["expires_in"] > 0

        # Verify user created in database
        result = await db_session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        assert user is not None
        assert user.email == email
        assert user.full_name == "New Google User"
        assert user.google_id is not None
        assert user.password_hash is None  # OAuth-only user
        assert user.email_verified_at is not None  # Auto-verified

        # Verify user settings created
        result = await db_session.execute(
            select(UserSettings).where(UserSettings.user_id == user.id)
        )
        settings = result.scalar_one_or_none()
        assert settings is not None
        assert settings.daily_goal == 20

    @pytest.mark.asyncio
    async def test_account_linking_works(self, client: AsyncClient, db_session: AsyncSession):
        """Test Google account can be linked to existing email user."""
        # First, register a user via email/password
        email = f"linkuser_{uuid4().hex[:8]}@example.com"
        register_data = {
            "email": email,
            "password": "SecurePass123!",
            "full_name": "Link Test User",
        }

        register_response = await client.post("/api/v1/auth/register", json=register_data)
        assert register_response.status_code == 201

        # Verify user exists without Google ID
        result = await db_session.execute(select(User).where(User.email == email))
        user = result.scalar_one()
        assert user.google_id is None

        google_id = f"google-{uuid4().hex[:12]}"

        # Now login with Google using same email
        with patch("src.config.settings") as mock_settings:
            mock_settings.google_oauth_configured = True
            mock_settings.google_client_id = "test-client-id"

            with patch("src.core.security.google_id_token.verify_oauth2_token") as mock_verify:
                mock_verify.return_value = {
                    "sub": google_id,
                    "email": email,
                    "email_verified": True,
                    "name": "Google Name",
                    "iss": "accounts.google.com",
                }

                response = await client.post(
                    "/api/v1/auth/google",
                    json={"id_token": "valid-token" * 50},
                )

                assert response.status_code == 200
                data = response.json()
                assert "access_token" in data

        # Verify Google ID was linked
        await db_session.refresh(user)
        assert user.google_id == google_id
        # Name should NOT be updated since user already had one
        assert user.full_name == "Link Test User"

    @pytest.mark.asyncio
    async def test_account_conflict_returns_409(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        """Test 409 returned when email is linked to different Google account."""
        # Create a user with a Google ID already linked
        email = f"conflict_{uuid4().hex[:8]}@example.com"
        existing_google_id = f"existing-google-{uuid4().hex[:12]}"

        # Create user manually with Google ID
        user = User(
            email=email,
            password_hash=None,
            full_name="Conflict User",
            google_id=existing_google_id,
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()

        # Try to login with a DIFFERENT Google account but same email
        different_google_id = f"different-google-{uuid4().hex[:12]}"

        with patch("src.config.settings") as mock_settings:
            mock_settings.google_oauth_configured = True
            mock_settings.google_client_id = "test-client-id"

            with patch("src.core.security.google_id_token.verify_oauth2_token") as mock_verify:
                mock_verify.return_value = {
                    "sub": different_google_id,  # Different Google ID!
                    "email": email,  # Same email
                    "email_verified": True,
                    "iss": "accounts.google.com",
                }

                response = await client.post(
                    "/api/v1/auth/google",
                    json={"id_token": "valid-token" * 50},
                )

                assert response.status_code == 409
                error = response.json()
                error_msg = error.get("detail") or error.get("error", {}).get("message", "")
                assert "already registered" in error_msg.lower()

    @pytest.mark.asyncio
    async def test_short_token_returns_422(self, client: AsyncClient):
        """Test 422 returned for token shorter than 100 characters."""
        response = await client.post(
            "/api/v1/auth/google",
            json={"id_token": "short"},
        )

        assert response.status_code == 422
        error = response.json()
        assert "error" in error

    @pytest.mark.asyncio
    async def test_missing_token_returns_422(self, client: AsyncClient):
        """Test 422 returned when id_token is missing."""
        response = await client.post(
            "/api/v1/auth/google",
            json={},
        )

        assert response.status_code == 422
        error = response.json()
        assert "error" in error

    @pytest.mark.asyncio
    async def test_returning_google_user_can_login(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        """Test user who registered with Google can login again."""
        email = f"returning_{uuid4().hex[:8]}@example.com"
        google_id = f"google-{uuid4().hex[:12]}"

        # Create user with Google ID (simulate previous Google login)
        user = User(
            email=email,
            password_hash=None,
            full_name="Returning User",
            google_id=google_id,
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()

        with patch("src.config.settings") as mock_settings:
            mock_settings.google_oauth_configured = True
            mock_settings.google_client_id = "test-client-id"

            with patch("src.core.security.google_id_token.verify_oauth2_token") as mock_verify:
                mock_verify.return_value = {
                    "sub": google_id,  # Same Google ID
                    "email": email,
                    "email_verified": True,
                    "name": "Returning User",
                    "iss": "accounts.google.com",
                }

                response = await client.post(
                    "/api/v1/auth/google",
                    json={"id_token": "valid-token" * 50},
                )

                assert response.status_code == 200
                data = response.json()
                assert "access_token" in data
                assert "refresh_token" in data

    @pytest.mark.asyncio
    async def test_inactive_user_returns_401(self, client: AsyncClient, db_session: AsyncSession):
        """Test 401 returned when Google user is inactive."""
        email = f"inactive_{uuid4().hex[:8]}@example.com"
        google_id = f"google-{uuid4().hex[:12]}"

        # Create inactive user
        user = User(
            email=email,
            password_hash=None,
            full_name="Inactive User",
            google_id=google_id,
            is_active=False,  # Inactive!
        )
        db_session.add(user)
        await db_session.commit()

        with patch("src.config.settings") as mock_settings:
            mock_settings.google_oauth_configured = True
            mock_settings.google_client_id = "test-client-id"

            with patch("src.core.security.google_id_token.verify_oauth2_token") as mock_verify:
                mock_verify.return_value = {
                    "sub": google_id,
                    "email": email,
                    "email_verified": True,
                    "iss": "accounts.google.com",
                }

                response = await client.post(
                    "/api/v1/auth/google",
                    json={"id_token": "valid-token" * 50},
                )

                assert response.status_code == 401
                error = response.json()
                error_msg = error.get("detail") or error.get("error", {}).get("message", "")
                assert "deactivated" in error_msg.lower()
