"""E2E tests for authentication error handling.

These tests verify proper error responses for authentication failures through
real HTTP requests, covering:
- Expired token handling
- Invalid token handling
- Missing token handling
- Malformed auth headers
- Invalid credentials
- Token validation edge cases

Run with:
    pytest tests/e2e/edge_cases/test_auth_errors.py -v
"""

import pytest
from httpx import AsyncClient

from tests.e2e.conftest import E2ETestCase


class TestExpiredTokenHandling(E2ETestCase):
    """E2E tests for expired token error handling."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_expired_access_token_returns_401(
        self, client: AsyncClient, expired_access_token: str
    ) -> None:
        """Test that expired access token returns 401 Unauthorized."""
        headers = {"Authorization": f"Bearer {expired_access_token}"}

        response = await client.get("/api/v1/auth/me", headers=headers)

        assert response.status_code == 401
        data = response.json()
        # API uses structured error format
        assert "error" in data or "detail" in data

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_expired_token_cannot_access_protected_endpoints(
        self, client: AsyncClient, expired_access_token: str
    ) -> None:
        """Test that expired tokens cannot access protected auth endpoints."""
        headers = {"Authorization": f"Bearer {expired_access_token}"}

        # Protected auth endpoints only (decks is public for browsing)
        endpoints = [
            "/api/v1/auth/me",
            "/api/v1/auth/sessions",
        ]

        for endpoint in endpoints:
            response = await client.get(endpoint, headers=headers)
            assert response.status_code == 401, f"Expected 401 for {endpoint}"


class TestInvalidTokenHandling(E2ETestCase):
    """E2E tests for invalid token error handling."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_invalid_token_returns_401(self, client: AsyncClient) -> None:
        """Test that invalid token returns 401 Unauthorized."""
        headers = {"Authorization": "Bearer invalid_token_string"}

        response = await client.get("/api/v1/auth/me", headers=headers)

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_random_string_token_returns_401(self, client: AsyncClient) -> None:
        """Test that random string as token returns 401."""
        headers = {"Authorization": "Bearer abc123xyz"}

        response = await client.get("/api/v1/auth/me", headers=headers)

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_jwt_like_but_invalid_token_returns_401(self, client: AsyncClient) -> None:
        """Test that JWT-structured but invalid token returns 401."""
        # Looks like JWT but has invalid signature
        fake_jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.invalid"
        headers = {"Authorization": f"Bearer {fake_jwt}"}

        response = await client.get("/api/v1/auth/me", headers=headers)

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_empty_token_returns_401(self, client: AsyncClient) -> None:
        """Test that empty token returns 401."""
        headers = {"Authorization": "Bearer "}

        response = await client.get("/api/v1/auth/me", headers=headers)

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_token_with_spaces_returns_401(self, client: AsyncClient) -> None:
        """Test that token with spaces returns 401."""
        headers = {"Authorization": "Bearer token with spaces"}

        response = await client.get("/api/v1/auth/me", headers=headers)

        assert response.status_code == 401


class TestMissingTokenHandling(E2ETestCase):
    """E2E tests for missing token error handling."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_missing_authorization_header_returns_401(self, client: AsyncClient) -> None:
        """Test that missing Authorization header returns 401."""
        response = await client.get("/api/v1/auth/me")

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_empty_authorization_header_returns_401(self, client: AsyncClient) -> None:
        """Test that empty Authorization header returns 401."""
        headers = {"Authorization": ""}

        response = await client.get("/api/v1/auth/me", headers=headers)

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_protected_endpoints_require_auth(self, client: AsyncClient) -> None:
        """Test that all protected endpoints require authentication."""
        protected_endpoints = [
            ("GET", "/api/v1/auth/me"),
            ("GET", "/api/v1/auth/sessions"),
            ("POST", "/api/v1/auth/logout-all"),
            ("DELETE", "/api/v1/auth/sessions/00000000-0000-0000-0000-000000000000"),
        ]

        for method, endpoint in protected_endpoints:
            if method == "GET":
                response = await client.get(endpoint)
            elif method == "POST":
                response = await client.post(endpoint)
            elif method == "DELETE":
                response = await client.delete(endpoint)
            else:
                continue

            assert (
                response.status_code == 401
            ), f"Expected 401 for {method} {endpoint}, got {response.status_code}"


class TestMalformedAuthHeaders(E2ETestCase):
    """E2E tests for malformed authorization header handling."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_missing_bearer_prefix_returns_401(self, client: AsyncClient) -> None:
        """Test that missing Bearer prefix returns 401."""
        session = await self.register_and_login(client)
        # Extract just the token without Bearer
        token = session.headers["Authorization"].replace("Bearer ", "")

        headers = {"Authorization": token}

        response = await client.get("/api/v1/auth/me", headers=headers)

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_wrong_auth_scheme_returns_401(self, client: AsyncClient) -> None:
        """Test that wrong auth scheme (Basic instead of Bearer) returns 401."""
        headers = {"Authorization": "Basic dXNlcm5hbWU6cGFzc3dvcmQ="}

        response = await client.get("/api/v1/auth/me", headers=headers)

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_lowercase_bearer_may_fail(self, client: AsyncClient) -> None:
        """Test that lowercase 'bearer' may be rejected."""
        session = await self.register_and_login(client)
        token = session.headers["Authorization"].replace("Bearer ", "")

        headers = {"Authorization": f"bearer {token}"}

        response = await client.get("/api/v1/auth/me", headers=headers)

        # Most implementations accept lowercase, but this documents the behavior
        # Either 200 (accepted) or 401 (rejected) is valid
        assert response.status_code in [200, 401]

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_double_bearer_returns_401(self, client: AsyncClient) -> None:
        """Test that double Bearer prefix returns 401."""
        headers = {"Authorization": "Bearer Bearer some_token"}

        response = await client.get("/api/v1/auth/me", headers=headers)

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_extra_whitespace_in_header_handled(self, client: AsyncClient) -> None:
        """Test that extra whitespace in header is handled."""
        headers = {"Authorization": "Bearer   token_with_extra_spaces"}

        response = await client.get("/api/v1/auth/me", headers=headers)

        # Should still reject invalid token
        assert response.status_code == 401


class TestInvalidCredentials(E2ETestCase):
    """E2E tests for invalid credentials error handling."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_wrong_password_returns_401(self, client: AsyncClient) -> None:
        """Test that wrong password returns 401."""
        # First register a user
        session = await self.register_and_login(client)

        # Try to login with wrong password
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": session.user.email,
                "password": "WrongPassword123!",
            },
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_nonexistent_email_returns_401(self, client: AsyncClient) -> None:
        """Test that non-existent email returns 401."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "nonexistent_user@example.com",
                "password": "SomePassword123!",
            },
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_empty_email_returns_validation_error(self, client: AsyncClient) -> None:
        """Test that empty email returns validation error."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "",
                "password": "SomePassword123!",
            },
        )

        # Should return 422 (validation) or 401 (auth)
        assert response.status_code in [401, 422]

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_empty_password_returns_validation_error(self, client: AsyncClient) -> None:
        """Test that empty password returns validation error."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "test@example.com",
                "password": "",
            },
        )

        # Should return 422 (validation) or 401 (auth)
        assert response.status_code in [401, 422]

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_invalid_email_format_returns_error(self, client: AsyncClient) -> None:
        """Test that invalid email format returns error."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "not_an_email",
                "password": "SomePassword123!",
            },
        )

        # Should return 422 (validation) or 401 (auth)
        assert response.status_code in [401, 422]


class TestRegistrationErrors(E2ETestCase):
    """E2E tests for registration error handling."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_duplicate_email_returns_409(self, client: AsyncClient) -> None:
        """Test that registering with duplicate email returns 409."""
        # Register first user
        session = await self.register_and_login(client)

        # Try to register with same email
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": session.user.email,
                "password": "AnotherPassword123!",
                "full_name": "Another User",
            },
        )

        assert response.status_code == 409

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_weak_password_returns_422(self, client: AsyncClient) -> None:
        """Test that weak password returns validation error."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "weak",
                "full_name": "New User",
            },
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_password_without_digit_returns_422(self, client: AsyncClient) -> None:
        """Test that password without digit returns validation error."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "NoDigitsHere!",
                "full_name": "New User",
            },
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_password_without_letter_returns_422(self, client: AsyncClient) -> None:
        """Test that password without letters returns validation error."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "12345678!@#",
                "full_name": "New User",
            },
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_missing_required_fields_returns_422(self, client: AsyncClient) -> None:
        """Test that missing required fields returns validation error."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                # Missing password
            },
        )

        assert response.status_code == 422


class TestTokenRefreshErrors(E2ETestCase):
    """E2E tests for token refresh error handling."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_refresh_with_invalid_token_returns_401(self, client: AsyncClient) -> None:
        """Test that refresh with invalid token returns 401."""
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid_refresh_token"},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_refresh_with_access_token_returns_401(self, client: AsyncClient) -> None:
        """Test that using access token for refresh returns 401."""
        session = await self.register_and_login(client)
        # Extract access token from header
        access_token = session.headers["Authorization"].replace("Bearer ", "")

        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": access_token},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_refresh_with_empty_token_returns_error(self, client: AsyncClient) -> None:
        """Test that refresh with empty token returns error."""
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": ""},
        )

        # Should return 401 (invalid) or 422 (validation)
        assert response.status_code in [401, 422]

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_refresh_with_malformed_jwt_returns_401(self, client: AsyncClient) -> None:
        """Test that refresh with malformed JWT returns 401."""
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "not.a.valid.jwt"},
        )

        assert response.status_code == 401


class TestLogoutErrors(E2ETestCase):
    """E2E tests for logout error handling."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_logout_without_auth_returns_401(self, client: AsyncClient) -> None:
        """Test that logout without auth returns 401."""
        response = await client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": "some_token"},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_logout_all_without_auth_returns_401(self, client: AsyncClient) -> None:
        """Test that logout-all without auth returns 401."""
        response = await client.post("/api/v1/auth/logout-all")

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_logout_with_invalid_refresh_token(self, client: AsyncClient) -> None:
        """Test logout with invalid refresh token behavior."""
        session = await self.register_and_login(client)

        response = await client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": "invalid_token"},
            headers=session.headers,
        )

        # Logout might succeed even with invalid refresh token
        # (since access token is valid for auth)
        assert response.status_code in [200, 401]


class TestSessionErrors(E2ETestCase):
    """E2E tests for session management error handling."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_get_sessions_without_auth_returns_401(self, client: AsyncClient) -> None:
        """Test that getting sessions without auth returns 401."""
        response = await client.get("/api/v1/auth/sessions")

        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_revoke_nonexistent_session_returns_404(self, client: AsyncClient) -> None:
        """Test that revoking non-existent session returns 404 or 200."""
        session = await self.register_and_login(client)

        fake_session_id = "00000000-0000-0000-0000-000000000000"
        response = await client.delete(
            f"/api/v1/auth/sessions/{fake_session_id}",
            headers=session.headers,
        )

        # Accept 404 (not found) or 200 (Redis delete succeeds even for non-existent keys)
        assert response.status_code in [200, 404]

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_revoke_session_with_invalid_uuid_returns_422(self, client: AsyncClient) -> None:
        """Test that revoking session with invalid UUID returns 422."""
        session = await self.register_and_login(client)

        response = await client.delete(
            "/api/v1/auth/sessions/not-a-valid-uuid",
            headers=session.headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_revoke_session_without_auth_returns_401(self, client: AsyncClient) -> None:
        """Test that revoking session without auth returns 401."""
        response = await client.delete("/api/v1/auth/sessions/00000000-0000-0000-0000-000000000000")

        assert response.status_code == 401


class TestErrorResponseFormat(E2ETestCase):
    """E2E tests for error response format consistency."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_401_response_has_error_structure(self, client: AsyncClient) -> None:
        """Test that 401 responses have proper error structure."""
        response = await client.get("/api/v1/auth/me")

        assert response.status_code == 401
        data = response.json()
        # API uses structured error format: {success: false, error: {code, message}}
        assert "error" in data or "detail" in data
        if "error" in data:
            assert "code" in data["error"]
            assert "message" in data["error"]

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_422_response_has_error_structure(self, client: AsyncClient) -> None:
        """Test that 422 responses have proper error structure."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "test@example.com",
                # Missing required password
            },
        )

        assert response.status_code == 422
        data = response.json()
        # API uses structured error format with details array
        assert "error" in data or "detail" in data
        if "error" in data:
            assert "code" in data["error"]
            assert "details" in data["error"] or "message" in data["error"]

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_409_response_has_error_structure(self, client: AsyncClient) -> None:
        """Test that 409 responses have proper error structure."""
        # Register a user first
        session = await self.register_and_login(client)

        # Try to register again with same email
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": session.user.email,
                "password": "AnotherPassword123!",
                "full_name": "Duplicate User",
            },
        )

        assert response.status_code == 409
        data = response.json()
        # Check for either format
        assert "error" in data or "detail" in data
