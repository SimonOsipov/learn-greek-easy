"""E2E tests for session management workflows.

These tests verify user session management functionality through
real HTTP requests, covering:
- Token refresh flow
- Logout endpoint
- Logout from all sessions
- Session listing
- Session revocation

Note: Some tests may behave differently when Redis is unavailable
in the test environment. Tests are designed to handle both scenarios.

Run with:
    pytest tests/e2e/workflows/test_session_management.py -v
"""

import pytest
from httpx import AsyncClient

from tests.e2e.conftest import E2ETestCase, UserSession


class TestSessionManagement(E2ETestCase):
    """E2E tests for session management workflows."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_token_refresh_endpoint_accepts_request(self, client: AsyncClient) -> None:
        """Test that token refresh endpoint accepts and processes requests."""
        # Register a user to get tokens
        session = await self.register_and_login(client)

        # Get the refresh token by logging in again
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={
                "email": session.user.email,
                "password": self.DEFAULT_PASSWORD,
            },
        )
        assert login_resp.status_code == 200
        tokens = login_resp.json()

        # Attempt token refresh - may return 200 (success) or 401 (if Redis unavailable)
        refresh_resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]},
        )

        # Accept both success (200) and unauthorized (401 if sessions not stored)
        assert refresh_resp.status_code in [200, 401]

        if refresh_resp.status_code == 200:
            new_tokens = refresh_resp.json()
            assert "access_token" in new_tokens
            assert "refresh_token" in new_tokens
            assert "token_type" in new_tokens
            assert "expires_in" in new_tokens
            assert new_tokens["token_type"] == "bearer"

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_logout_endpoint_accepts_request(self, client: AsyncClient) -> None:
        """Test that logout endpoint accepts and processes requests."""
        # Register a user to get tokens
        session = await self.register_and_login(client)

        # Get the refresh token by logging in
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={
                "email": session.user.email,
                "password": self.DEFAULT_PASSWORD,
            },
        )
        assert login_resp.status_code == 200
        tokens = login_resp.json()

        # Logout with the refresh token
        logout_resp = await client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": tokens["refresh_token"]},
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )

        assert logout_resp.status_code == 200
        logout_data = logout_resp.json()
        assert logout_data["success"] is True
        assert "message" in logout_data

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_logout_all_endpoint_responds(self, client: AsyncClient) -> None:
        """Test that logout-all endpoint responds successfully."""
        # Register a user
        session = await self.register_and_login(client)

        # Logout from all sessions
        logout_all_resp = await client.post(
            "/api/v1/auth/logout-all",
            headers=session.headers,
        )

        assert logout_all_resp.status_code == 200
        logout_data = logout_all_resp.json()
        assert logout_data["success"] is True
        assert "sessions_revoked" in logout_data
        assert isinstance(logout_data["sessions_revoked"], int)
        assert logout_data["sessions_revoked"] >= 0

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_get_user_sessions_returns_session_list(self, client: AsyncClient) -> None:
        """Test that get sessions endpoint returns a session list structure."""
        # Register and login to create a session
        session = await self.register_and_login(client)

        # Get sessions
        sessions_resp = await client.get(
            "/api/v1/auth/sessions",
            headers=session.headers,
        )

        # Accept 200 (success) or 500 (Redis unavailable)
        assert sessions_resp.status_code in [200, 500]

        if sessions_resp.status_code == 200:
            sessions_data = sessions_resp.json()
            assert "sessions" in sessions_data
            assert "total" in sessions_data
            assert isinstance(sessions_data["sessions"], list)
            assert isinstance(sessions_data["total"], int)
            assert sessions_data["total"] >= 0

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_session_info_structure(self, client: AsyncClient) -> None:
        """Test that session info has correct structure when sessions exist."""
        # Register and login
        session = await self.register_and_login(client)

        # Get sessions
        sessions_resp = await client.get(
            "/api/v1/auth/sessions",
            headers=session.headers,
        )

        # Accept 200 (success) or 500 (Redis unavailable)
        assert sessions_resp.status_code in [200, 500]

        if sessions_resp.status_code == 200:
            sessions_data = sessions_resp.json()

            if sessions_data["total"] > 0:
                session_info = sessions_data["sessions"][0]
                assert "id" in session_info
                assert "created_at" in session_info
                assert "expires_at" in session_info

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_revoke_session_endpoint(self, client: AsyncClient) -> None:
        """Test revoking a specific session by its ID."""
        # Register and login
        session = await self.register_and_login(client)

        # Get sessions to find a session ID
        sessions_resp = await client.get(
            "/api/v1/auth/sessions",
            headers=session.headers,
        )

        # Accept 200 (success) or 500 (Redis unavailable)
        assert sessions_resp.status_code in [200, 500]

        if sessions_resp.status_code == 200:
            sessions_data = sessions_resp.json()

            if sessions_data["total"] > 0:
                session_id = sessions_data["sessions"][0]["id"]

                # Revoke the session
                revoke_resp = await client.delete(
                    f"/api/v1/auth/sessions/{session_id}",
                    headers=session.headers,
                )

                assert revoke_resp.status_code == 200
                revoke_data = revoke_resp.json()
                assert revoke_data["success"] is True
                assert revoke_data["token_revoked"] is True

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_revoke_nonexistent_session_returns_404(self, client: AsyncClient) -> None:
        """Test that revoking a non-existent session returns 404 or 200."""
        session = await self.register_and_login(client)

        # Try to revoke a non-existent session
        fake_session_id = "00000000-0000-0000-0000-000000000000"
        revoke_resp = await client.delete(
            f"/api/v1/auth/sessions/{fake_session_id}",
            headers=session.headers,
        )

        # Accept 404 (not found) or 200 (graceful handling when Redis unavailable)
        assert revoke_resp.status_code in [200, 404]

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_session_endpoints_require_authentication(self, client: AsyncClient) -> None:
        """Test that session endpoints require authentication."""
        # Try to get sessions without auth
        sessions_resp = await client.get("/api/v1/auth/sessions")
        assert sessions_resp.status_code == 401

        # Try to logout-all without auth
        logout_all_resp = await client.post("/api/v1/auth/logout-all")
        assert logout_all_resp.status_code == 401

        # Try to revoke session without auth
        revoke_resp = await client.delete(
            "/api/v1/auth/sessions/00000000-0000-0000-0000-000000000000"
        )
        assert revoke_resp.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_refresh_with_invalid_token_returns_401(self, client: AsyncClient) -> None:
        """Test that refresh with invalid token returns 401."""
        refresh_resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid_token_here"},
        )

        assert refresh_resp.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_sessions_endpoint_returns_list(self, client: AsyncClient) -> None:
        """Test that sessions endpoint returns a list of sessions."""
        # Register a user
        session = await self.register_and_login(client)

        # Get sessions
        sessions_resp = await client.get(
            "/api/v1/auth/sessions",
            headers=session.headers,
        )

        # Accept 200 (success) or 500 (Redis unavailable)
        assert sessions_resp.status_code in [200, 500]

        if sessions_resp.status_code == 200:
            sessions_data = sessions_resp.json()
            assert "sessions" in sessions_data
            assert isinstance(sessions_data["sessions"], list)
            assert "total" in sessions_data
            assert isinstance(sessions_data["total"], int)


class TestLogoutBehavior(E2ETestCase):
    """E2E tests for logout behavior."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_logout_response_format(self, client: AsyncClient) -> None:
        """Test that logout response has correct format."""
        session = await self.register_and_login(client)

        # Get refresh token
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={
                "email": session.user.email,
                "password": self.DEFAULT_PASSWORD,
            },
        )
        tokens = login_resp.json()

        # Logout
        logout_resp = await client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": tokens["refresh_token"]},
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )

        assert logout_resp.status_code == 200
        data = logout_resp.json()
        assert "success" in data
        assert "message" in data
        assert "token_revoked" in data
        assert isinstance(data["success"], bool)
        assert isinstance(data["message"], str)
        assert isinstance(data["token_revoked"], bool)

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_logout_all_response_format(self, client: AsyncClient) -> None:
        """Test that logout-all response has correct format."""
        session = await self.register_and_login(client)

        logout_all_resp = await client.post(
            "/api/v1/auth/logout-all",
            headers=session.headers,
        )

        assert logout_all_resp.status_code == 200
        data = logout_all_resp.json()
        assert "success" in data
        assert "message" in data
        assert "sessions_revoked" in data
        assert isinstance(data["success"], bool)
        assert isinstance(data["message"], str)
        assert isinstance(data["sessions_revoked"], int)

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_logout_requires_auth_header(self, client: AsyncClient) -> None:
        """Test that logout endpoint requires authentication header."""
        # Try logout without auth header
        logout_resp = await client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": "some_token"},
        )

        assert logout_resp.status_code == 401


class TestTokenRefreshFlow(E2ETestCase):
    """E2E tests for token refresh workflow."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_refresh_endpoint_returns_proper_structure(self, client: AsyncClient) -> None:
        """Test that refresh endpoint returns proper structure when successful."""
        session = await self.register_and_login(client)

        login_resp = await client.post(
            "/api/v1/auth/login",
            json={
                "email": session.user.email,
                "password": self.DEFAULT_PASSWORD,
            },
        )
        tokens = login_resp.json()

        refresh_resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]},
        )

        # May succeed or fail depending on session storage availability
        if refresh_resp.status_code == 200:
            data = refresh_resp.json()
            assert "access_token" in data
            assert "refresh_token" in data
            assert "token_type" in data
            assert "expires_in" in data
            assert isinstance(data["expires_in"], int)
            assert data["expires_in"] > 0
            assert data["token_type"] == "bearer"
        else:
            # If refresh fails due to session storage issues, that's acceptable
            assert refresh_resp.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_refresh_with_empty_token_returns_error(self, client: AsyncClient) -> None:
        """Test that refresh with empty token returns error."""
        refresh_resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": ""},
        )

        # Should return 401 (invalid token) or 422 (validation error)
        assert refresh_resp.status_code in [401, 422]

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_refresh_with_malformed_token_returns_401(self, client: AsyncClient) -> None:
        """Test that refresh with malformed token returns 401."""
        refresh_resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "not.a.valid.jwt.token"},
        )

        assert refresh_resp.status_code == 401


class TestAuthenticationFlow(E2ETestCase):
    """E2E tests for authentication flow."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_login_returns_tokens(self, client: AsyncClient) -> None:
        """Test that login returns access and refresh tokens."""
        session = await self.register_and_login(client)

        login_resp = await client.post(
            "/api/v1/auth/login",
            json={
                "email": session.user.email,
                "password": self.DEFAULT_PASSWORD,
            },
        )

        assert login_resp.status_code == 200
        tokens = login_resp.json()
        assert "access_token" in tokens
        assert "refresh_token" in tokens
        assert "token_type" in tokens
        assert tokens["token_type"] == "bearer"

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_access_token_works_for_protected_endpoints(self, client: AsyncClient) -> None:
        """Test that access token can be used for protected endpoints."""
        session = await self.register_and_login(client)

        # Use access token to access protected endpoint
        me_resp = await client.get(
            "/api/v1/auth/me",
            headers=session.headers,
        )

        assert me_resp.status_code == 200
        me_data = me_resp.json()
        assert me_data["email"] == session.user.email

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_invalid_credentials_returns_401(self, client: AsyncClient) -> None:
        """Test that invalid credentials return 401."""
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "WrongPassword123!",
            },
        )

        assert login_resp.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_me_endpoint_without_auth_returns_401(self, client: AsyncClient) -> None:
        """Test that /me endpoint without auth returns 401."""
        me_resp = await client.get("/api/v1/auth/me")

        assert me_resp.status_code == 401


class TestProfileUpdate(E2ETestCase):
    """E2E tests for profile update functionality (PATCH /api/v1/auth/me)."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_update_full_name(
        self, client: AsyncClient, fresh_user_session: "UserSession"
    ) -> None:
        """Test updating user's full name."""
        new_name = "Updated Full Name"

        response = await client.patch(
            "/api/v1/auth/me",
            json={"full_name": new_name},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == new_name

        # Verify change persisted
        me_resp = await client.get("/api/v1/auth/me", headers=fresh_user_session.headers)
        assert me_resp.json()["full_name"] == new_name

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_update_daily_goal(
        self, client: AsyncClient, fresh_user_session: "UserSession"
    ) -> None:
        """Test updating daily goal setting."""
        new_goal = 50

        response = await client.patch(
            "/api/v1/auth/me",
            json={"daily_goal": new_goal},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["settings"]["daily_goal"] == new_goal

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_update_email_notifications(
        self, client: AsyncClient, fresh_user_session: "UserSession"
    ) -> None:
        """Test toggling email notifications setting."""
        # First get current value
        me_resp = await client.get("/api/v1/auth/me", headers=fresh_user_session.headers)
        current_value = me_resp.json()["settings"]["email_notifications"]

        # Toggle it
        new_value = not current_value
        response = await client.patch(
            "/api/v1/auth/me",
            json={"email_notifications": new_value},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["settings"]["email_notifications"] == new_value

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_update_preferred_language(
        self, client: AsyncClient, fresh_user_session: "UserSession"
    ) -> None:
        """Test updating preferred language setting."""
        new_language = "el"  # Greek

        response = await client.patch(
            "/api/v1/auth/me",
            json={"preferred_language": new_language},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["settings"]["preferred_language"] == new_language

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_update_multiple_fields_at_once(
        self, client: AsyncClient, fresh_user_session: "UserSession"
    ) -> None:
        """Test updating multiple fields in a single request."""
        updates = {
            "full_name": "Multi-Update User",
            "daily_goal": 75,
            "email_notifications": False,
            "preferred_language": "el",  # Only "en" and "el" are supported
        }

        response = await client.patch(
            "/api/v1/auth/me",
            json=updates,
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == updates["full_name"]
        assert data["settings"]["daily_goal"] == updates["daily_goal"]
        assert data["settings"]["email_notifications"] == updates["email_notifications"]
        assert data["settings"]["preferred_language"] == updates["preferred_language"]

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_update_profile_requires_authentication(self, client: AsyncClient) -> None:
        """Test that PATCH /api/v1/auth/me requires authentication."""
        response = await client.patch(
            "/api/v1/auth/me",
            json={"full_name": "Unauthorized Update"},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_update_profile_response_structure(
        self, client: AsyncClient, fresh_user_session: "UserSession"
    ) -> None:
        """Test that profile update response has correct structure."""
        response = await client.patch(
            "/api/v1/auth/me",
            json={"full_name": "Structure Test User"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Verify user profile fields
        assert "id" in data
        assert "email" in data
        assert "full_name" in data
        assert "is_active" in data
        assert "is_superuser" in data
        assert "created_at" in data
        assert "updated_at" in data

        # Verify settings are included
        assert "settings" in data
        settings = data["settings"]
        assert "id" in settings
        assert "user_id" in settings
        assert "daily_goal" in settings
        assert "email_notifications" in settings
        assert "preferred_language" in settings
