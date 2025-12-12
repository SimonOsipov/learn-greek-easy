"""E2E tests for Google OAuth authentication.

These tests verify Google OAuth endpoint behavior through real HTTP requests,
covering:
- OAuth disabled scenarios (when GOOGLE_CLIENT_ID is not configured)
- Invalid/malformed token handling
- Empty/missing token handling
- Request validation errors

Note: The GoogleAuthRequest schema requires id_token to be at least 100 characters.
Real Google ID tokens are ~1000+ characters (JWT format).

Run with:
    pytest tests/e2e/scenarios/test_google_oauth.py -v
"""

import pytest
from httpx import AsyncClient

from tests.e2e.conftest import E2ETestCase


def _make_long_token(base: str = "test_token") -> str:
    """Create a token string that meets the 100 character minimum."""
    return base + "x" * (100 - len(base) + 10)


def _make_jwt_like_token() -> str:
    """Create a JWT-structured but invalid token >= 100 chars."""
    # Header.Payload.Signature format
    header = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9"
    payload = "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0"
    signature = "invalid_signature_padding_to_make_it_long_enough"
    return f"{header}.{payload}.{signature}"


class TestGoogleOAuthDisabled(E2ETestCase):
    """E2E tests for Google OAuth endpoint behavior.

    These tests verify the endpoint handles various scenarios correctly.
    In production, Google OAuth may or may not be configured.
    """

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_google_oauth_returns_error_for_invalid_token(self, client: AsyncClient) -> None:
        """Test Google OAuth behavior with invalid (but properly formatted) token."""
        # Token must be at least 100 chars to pass validation
        fake_token = _make_long_token("invalid_google_token")

        response = await client.post(
            "/api/v1/auth/google",
            json={"id_token": fake_token},
        )

        # Should return either 503 (not configured) or 401 (token invalid)
        assert response.status_code in [401, 503]

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_google_oauth_jwt_structured_token(self, client: AsyncClient) -> None:
        """Test Google OAuth with JWT-structured but invalid token."""
        jwt_token = _make_jwt_like_token()

        response = await client.post(
            "/api/v1/auth/google",
            json={"id_token": jwt_token},
        )

        # Should return 401 (invalid token) or 503 (not configured)
        assert response.status_code in [401, 503]


class TestGoogleOAuthValidation(E2ETestCase):
    """E2E tests for Google OAuth request validation."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_google_oauth_empty_token_returns_422(self, client: AsyncClient) -> None:
        """Test that empty id_token returns 422 validation error."""
        response = await client.post(
            "/api/v1/auth/google",
            json={"id_token": ""},
        )

        # Empty string should fail min_length validation
        assert response.status_code == 422
        data = response.json()
        # API uses structured error format
        assert "error" in data or "detail" in data

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_google_oauth_missing_token_returns_422(self, client: AsyncClient) -> None:
        """Test that missing id_token returns 422 validation error."""
        response = await client.post(
            "/api/v1/auth/google",
            json={},
        )

        # Missing required field should fail validation
        assert response.status_code == 422
        data = response.json()
        assert "error" in data or "detail" in data

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_google_oauth_short_token_returns_422(self, client: AsyncClient) -> None:
        """Test that token < 100 chars returns 422 validation error."""
        response = await client.post(
            "/api/v1/auth/google",
            json={"id_token": "short_token"},  # < 100 chars
        )

        # Should fail min_length validation
        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_google_oauth_null_token_returns_422(self, client: AsyncClient) -> None:
        """Test that null id_token returns 422 validation error."""
        response = await client.post(
            "/api/v1/auth/google",
            json={"id_token": None},
        )

        # Null value should fail validation
        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_google_oauth_invalid_token_type_returns_422(self, client: AsyncClient) -> None:
        """Test that non-string id_token returns 422 validation error."""
        response = await client.post(
            "/api/v1/auth/google",
            json={"id_token": 12345},
        )

        # Integer should fail validation
        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_google_oauth_array_token_returns_422(self, client: AsyncClient) -> None:
        """Test that array id_token returns 422 validation error."""
        response = await client.post(
            "/api/v1/auth/google",
            json={"id_token": ["token1", "token2"]},
        )

        # Array should fail validation
        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_google_oauth_object_token_returns_422(self, client: AsyncClient) -> None:
        """Test that object id_token returns 422 validation error."""
        response = await client.post(
            "/api/v1/auth/google",
            json={"id_token": {"token": "nested"}},
        )

        # Object should fail validation
        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_google_oauth_malformed_json_returns_422(self, client: AsyncClient) -> None:
        """Test that malformed JSON returns 422."""
        response = await client.post(
            "/api/v1/auth/google",
            content="not valid json",
            headers={"Content-Type": "application/json"},
        )

        # Invalid JSON should return 422
        assert response.status_code == 422


class TestGoogleOAuthRequestBehavior(E2ETestCase):
    """E2E tests for Google OAuth request handling behavior."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_google_oauth_extra_fields_accepted(self, client: AsyncClient) -> None:
        """Test that extra fields in request are ignored."""
        response = await client.post(
            "/api/v1/auth/google",
            json={
                "id_token": _make_long_token(),
                "extra_field": "should_be_ignored",
                "another_field": 123,
            },
        )

        # Extra fields should be ignored, token validation should proceed
        # Should return 401 (invalid token) or 503 (not configured)
        assert response.status_code in [401, 503]

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_google_oauth_very_long_token(self, client: AsyncClient) -> None:
        """Test that very long token is handled gracefully."""
        # Generate a very long token string
        long_token = "x" * 10000

        response = await client.post(
            "/api/v1/auth/google",
            json={"id_token": long_token},
        )

        # Should return 401 (invalid) or 503 (not configured), not crash
        assert response.status_code in [401, 503]


class TestGoogleOAuthMethodHandling(E2ETestCase):
    """E2E tests for Google OAuth HTTP method handling."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_google_oauth_method_not_allowed_get(self, client: AsyncClient) -> None:
        """Test that GET method returns 405 Method Not Allowed."""
        response = await client.get("/api/v1/auth/google")

        assert response.status_code == 405

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_google_oauth_method_not_allowed_put(self, client: AsyncClient) -> None:
        """Test that PUT method returns 405 Method Not Allowed."""
        response = await client.put(
            "/api/v1/auth/google",
            json={"id_token": _make_long_token()},
        )

        assert response.status_code == 405

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_google_oauth_method_not_allowed_delete(self, client: AsyncClient) -> None:
        """Test that DELETE method returns 405 Method Not Allowed."""
        response = await client.delete("/api/v1/auth/google")

        assert response.status_code == 405

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_google_oauth_method_not_allowed_patch(self, client: AsyncClient) -> None:
        """Test that PATCH method returns 405 Method Not Allowed."""
        response = await client.patch(
            "/api/v1/auth/google",
            json={"id_token": _make_long_token()},
        )

        assert response.status_code == 405


class TestGoogleOAuthResponseFormat(E2ETestCase):
    """E2E tests for Google OAuth response formatting."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_google_oauth_error_response_is_json(self, client: AsyncClient) -> None:
        """Test that error responses are JSON formatted."""
        response = await client.post(
            "/api/v1/auth/google",
            json={"id_token": _make_long_token()},
        )

        # Should have JSON content type
        assert "application/json" in response.headers.get("content-type", "")

        # Should be valid JSON
        data = response.json()
        assert isinstance(data, dict)

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_google_oauth_validation_error_format(self, client: AsyncClient) -> None:
        """Test that validation error response has expected structure."""
        response = await client.post(
            "/api/v1/auth/google",
            json={"id_token": "too_short"},
        )

        assert response.status_code == 422
        data = response.json()

        # API uses either 'error' or 'detail' format
        assert "error" in data or "detail" in data

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_google_oauth_auth_error_format(self, client: AsyncClient) -> None:
        """Test that auth error response has expected structure."""
        response = await client.post(
            "/api/v1/auth/google",
            json={"id_token": _make_long_token()},
        )

        # 401 or 503
        assert response.status_code in [401, 503]
        data = response.json()

        # Should have error information
        assert "error" in data or "detail" in data
