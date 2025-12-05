"""Integration tests for CORS middleware.

Tests cover:
- CORS header behavior on preflight requests
- CORS header behavior on actual requests
- Access-Control-Expose-Headers configuration
- Origin validation

Note: According to the CORS specification, Access-Control-Expose-Headers
is only sent on actual responses (GET, POST, etc.), not on preflight
(OPTIONS) responses. Preflight responses include Allow-Origin, Allow-Methods,
Allow-Headers, but not Expose-Headers.
"""

import pytest
from httpx import AsyncClient


class TestCorsHeaders:
    """Integration tests for CORS header behavior."""

    @pytest.mark.asyncio
    async def test_preflight_request_returns_allow_headers(self, client: AsyncClient):
        """Test OPTIONS preflight request returns CORS allow headers."""
        response = await client.options(
            "/api/v1/status",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )

        # Preflight should succeed
        assert response.status_code == 200

        # Check for preflight-specific CORS headers
        assert "Access-Control-Allow-Origin" in response.headers
        assert "Access-Control-Allow-Methods" in response.headers

    @pytest.mark.asyncio
    async def test_actual_request_allows_exposed_header_access(self, client: AsyncClient):
        """Test actual request includes Access-Control-Expose-Headers."""
        response = await client.get(
            "/api/v1/status",
            headers={"Origin": "http://localhost:5173"},
        )

        assert response.status_code == 200

        # Response should include expose headers directive
        expose_headers = response.headers.get("Access-Control-Expose-Headers", "")
        assert "X-Request-ID" in expose_headers
        assert "X-RateLimit-Limit" in expose_headers

    @pytest.mark.asyncio
    async def test_cors_allows_configured_origins(self, client: AsyncClient):
        """Test CORS allows requests from configured origins."""
        response = await client.get(
            "/api/v1/status",
            headers={"Origin": "http://localhost:5173"},
        )

        assert response.status_code == 200
        assert response.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"

    @pytest.mark.asyncio
    async def test_cors_blocks_unconfigured_origins(self, client: AsyncClient):
        """Test CORS blocks requests from unconfigured origins."""
        response = await client.get(
            "/api/v1/status",
            headers={"Origin": "http://malicious-site.com"},
        )

        # Request still succeeds (CORS is browser-enforced)
        # but Access-Control-Allow-Origin should not match
        allow_origin = response.headers.get("Access-Control-Allow-Origin")
        assert allow_origin != "http://malicious-site.com"

    @pytest.mark.asyncio
    async def test_expose_headers_includes_all_configured_headers(self, client: AsyncClient):
        """Test that all configured expose headers are present in actual response."""
        response = await client.get(
            "/api/v1/status",
            headers={"Origin": "http://localhost:5173"},
        )

        assert response.status_code == 200

        # Access-Control-Expose-Headers is only on actual responses, not preflight
        expose_headers = response.headers.get("Access-Control-Expose-Headers", "")

        # Check all default exposed headers are present
        assert "X-Request-ID" in expose_headers
        assert "X-RateLimit-Limit" in expose_headers
        assert "X-RateLimit-Remaining" in expose_headers
        assert "X-RateLimit-Reset" in expose_headers
