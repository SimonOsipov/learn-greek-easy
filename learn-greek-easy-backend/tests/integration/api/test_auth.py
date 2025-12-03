"""Integration tests for authentication endpoints."""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import RefreshToken, User, UserSettings


class TestAuthEndpoints:
    """Test suite for authentication API endpoints."""

    @pytest.mark.asyncio
    async def test_register_endpoint_success(self, client: AsyncClient, db_session: AsyncSession):
        """Test successful registration via API endpoint."""
        # Arrange
        user_data = {
            "email": f"newuser_{uuid4().hex[:8]}@example.com",
            "password": "SecurePass123!",
            "full_name": "New User",
        }

        # Act
        response = await client.post("/api/v1/auth/register", json=user_data)

        # Assert
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] == 1800

        # Verify user created in database
        result = await db_session.execute(select(User).where(User.email == user_data["email"]))
        user = result.scalar_one_or_none()
        assert user is not None
        assert user.email == user_data["email"]
        assert user.full_name == user_data["full_name"]
        assert user.is_active is True

        # Verify user settings created
        result = await db_session.execute(
            select(UserSettings).where(UserSettings.user_id == user.id)
        )
        settings = result.scalar_one_or_none()
        assert settings is not None
        assert settings.daily_goal == 20
        assert settings.email_notifications is True

        # Verify refresh token stored
        result = await db_session.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user.id,
            )
        )
        refresh_token = result.scalar_one_or_none()
        assert refresh_token is not None

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client: AsyncClient, db_session: AsyncSession):
        """Test registration with duplicate email returns 409."""
        # Arrange
        email = f"duplicate_{uuid4().hex[:8]}@example.com"
        user_data = {"email": email, "password": "SecurePass123!", "full_name": "First User"}

        # Register first user
        response = await client.post("/api/v1/auth/register", json=user_data)
        assert response.status_code == 201

        # Act - Try to register with same email
        user_data["full_name"] = "Second User"
        response = await client.post("/api/v1/auth/register", json=user_data)

        # Assert
        assert response.status_code == 409
        error = response.json()
        assert "already registered" in error["detail"]

    @pytest.mark.asyncio
    async def test_register_weak_password(self, client: AsyncClient):
        """Test registration with weak password returns 422."""
        # Arrange
        user_data = {
            "email": f"user_{uuid4().hex[:8]}@example.com",
            "password": "weak",  # Too short
            "full_name": "Test User",
        }

        # Act
        response = await client.post("/api/v1/auth/register", json=user_data)

        # Assert
        assert response.status_code == 422
        error = response.json()
        assert "error" in error
        assert any(
            "password" in str(detail).lower()
            for detail in error.get("error", {}).get("details", [])
        )

    @pytest.mark.asyncio
    async def test_register_no_digit_in_password(self, client: AsyncClient):
        """Test registration with password without digit returns 422."""
        # Arrange
        user_data = {
            "email": f"user_{uuid4().hex[:8]}@example.com",
            "password": "NoDigitsHere!",  # No digits
            "full_name": "Test User",
        }

        # Act
        response = await client.post("/api/v1/auth/register", json=user_data)

        # Assert
        assert response.status_code == 422
        error = response.json()
        assert "error" in error
        details = error.get("error", {}).get("details", [])
        assert any("digit" in str(detail.get("msg", "")).lower() for detail in details)

    @pytest.mark.asyncio
    async def test_register_invalid_email(self, client: AsyncClient):
        """Test registration with invalid email returns 422."""
        # Arrange
        user_data = {
            "email": "not-an-email",
            "password": "SecurePass123!",
            "full_name": "Test User",
        }

        # Act
        response = await client.post("/api/v1/auth/register", json=user_data)

        # Assert
        assert response.status_code == 422
        error = response.json()
        assert "error" in error

    @pytest.mark.asyncio
    async def test_register_missing_fields(self, client: AsyncClient):
        """Test registration with missing fields returns 422."""
        # Arrange
        user_data = {
            "email": "user@example.com"
            # Missing password and full_name
        }

        # Act
        response = await client.post("/api/v1/auth/register", json=user_data)

        # Assert
        assert response.status_code == 422
        error = response.json()
        assert "error" in error

    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, db_session: AsyncSession):
        """Test successful login after registration."""
        # Arrange - Register a user first
        email = f"login_{uuid4().hex[:8]}@example.com"
        password = "SecurePass123!"
        register_data = {"email": email, "password": password, "full_name": "Login Test User"}

        register_response = await client.post("/api/v1/auth/register", json=register_data)
        assert register_response.status_code == 201

        # Act - Login with the same credentials
        login_data = {"email": email, "password": password}
        response = await client.post("/api/v1/auth/login", json=login_data)

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] == 1800

    @pytest.mark.asyncio
    async def test_login_invalid_email(self, client: AsyncClient):
        """Test login with non-existent email returns 401."""
        # Arrange
        login_data = {"email": "nonexistent@example.com", "password": "SomePass123!"}

        # Act
        response = await client.post("/api/v1/auth/login", json=login_data)

        # Assert
        assert response.status_code == 401
        error = response.json()
        assert "Invalid email or password" in error["detail"]

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient, db_session: AsyncSession):
        """Test login with wrong password returns 401."""
        # Arrange - Register a user first
        email = f"wrongpass_{uuid4().hex[:8]}@example.com"
        register_data = {
            "email": email,
            "password": "CorrectPass123!",
            "full_name": "Wrong Pass User",
        }

        register_response = await client.post("/api/v1/auth/register", json=register_data)
        assert register_response.status_code == 201

        # Act - Login with wrong password
        login_data = {"email": email, "password": "WrongPass123!"}
        response = await client.post("/api/v1/auth/login", json=login_data)

        # Assert
        assert response.status_code == 401
        error = response.json()
        assert "Invalid email or password" in error["detail"]
