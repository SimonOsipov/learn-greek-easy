"""API testing utilities for Learn Greek Easy.

This module provides helpers for HTTP request testing:
- Authenticated request wrappers
- Token extraction utilities
- Query parameter builders
- Response validation helpers

Usage:
    from tests.helpers.api import (
        make_authenticated_request,
        extract_tokens_from_response,
        build_query_params,
    )

    async def test_api_call(client, auth_headers):
        response = await make_authenticated_request(
            client, "GET", "/api/v1/decks", auth_headers
        )
        assert response.status_code == 200
"""

from typing import Any
from urllib.parse import urlencode

from httpx import AsyncClient, Response

# =============================================================================
# Authenticated Request Helpers
# =============================================================================


async def make_authenticated_request(
    client: AsyncClient,
    method: str,
    url: str,
    headers: dict[str, str],
    *,
    json: dict[str, Any] | None = None,
    params: dict[str, Any] | None = None,
    data: dict[str, Any] | None = None,
    **kwargs: Any,
) -> Response:
    """Make an authenticated HTTP request.

    A unified helper that handles all HTTP methods with proper authentication.

    Args:
        client: AsyncClient instance
        method: HTTP method (GET, POST, PUT, PATCH, DELETE)
        url: Request URL
        headers: Auth headers (must contain Authorization)
        json: JSON body for POST/PUT/PATCH
        params: Query parameters
        data: Form data
        **kwargs: Additional arguments to pass to client

    Returns:
        Response: HTTP response

    Example:
        response = await make_authenticated_request(
            client, "POST", "/api/v1/decks",
            auth_headers,
            json={"name": "My Deck", "level": "A1"}
        )
    """
    method = method.upper()

    # Build request kwargs
    request_kwargs: dict[str, Any] = {
        "headers": headers,
        **kwargs,
    }

    if json is not None:
        request_kwargs["json"] = json
    if params is not None:
        request_kwargs["params"] = params
    if data is not None:
        request_kwargs["data"] = data

    # Execute request
    if method == "GET":
        return await client.get(url, **request_kwargs)
    elif method == "POST":
        return await client.post(url, **request_kwargs)
    elif method == "PUT":
        return await client.put(url, **request_kwargs)
    elif method == "PATCH":
        return await client.patch(url, **request_kwargs)
    elif method == "DELETE":
        return await client.delete(url, **request_kwargs)
    else:
        raise ValueError(f"Unsupported HTTP method: {method}")


async def make_request_without_auth(
    client: AsyncClient,
    method: str,
    url: str,
    *,
    json: dict[str, Any] | None = None,
    params: dict[str, Any] | None = None,
    **kwargs: Any,
) -> Response:
    """Make an unauthenticated HTTP request.

    Useful for testing public endpoints or auth-required error handling.

    Args:
        client: AsyncClient instance
        method: HTTP method
        url: Request URL
        json: JSON body
        params: Query parameters
        **kwargs: Additional arguments

    Returns:
        Response: HTTP response

    Example:
        response = await make_request_without_auth(client, "GET", "/api/v1/health")
        assert response.status_code == 200
    """
    return await make_authenticated_request(
        client,
        method,
        url,
        headers={},
        json=json,
        params=params,
        **kwargs,
    )


# =============================================================================
# Token Utilities
# =============================================================================


def extract_tokens_from_response(response: Response) -> tuple[str, str]:
    """Extract access and refresh tokens from a login/register response.

    Args:
        response: HTTP response from auth endpoint

    Returns:
        tuple: (access_token, refresh_token)

    Raises:
        AssertionError: If tokens not found in response

    Example:
        response = await client.post("/api/v1/auth/login", json=credentials)
        access_token, refresh_token = extract_tokens_from_response(response)
    """
    assert response.status_code in (
        200,
        201,
    ), f"Expected successful auth response, got {response.status_code}: {response.text}"

    data = response.json()
    assert "access_token" in data, f"access_token not found in response: {data}"
    assert "refresh_token" in data, f"refresh_token not found in response: {data}"

    return data["access_token"], data["refresh_token"]


def create_auth_headers(access_token: str) -> dict[str, str]:
    """Create Authorization headers from an access token.

    Args:
        access_token: JWT access token

    Returns:
        dict: Headers with Bearer token

    Example:
        headers = create_auth_headers(access_token)
        response = await client.get("/api/v1/auth/me", headers=headers)
    """
    return {"Authorization": f"Bearer {access_token}"}


def extract_user_id_from_response(response: Response) -> str:
    """Extract user ID from a user-related response.

    Args:
        response: HTTP response containing user data

    Returns:
        str: User ID

    Raises:
        AssertionError: If user ID not found
    """
    data = response.json()
    assert "id" in data, f"User ID not found in response: {data}"
    return data["id"]


# =============================================================================
# Query Parameter Builders
# =============================================================================


def build_query_params(**kwargs: Any) -> dict[str, str]:
    """Build query parameters, filtering out None values.

    Args:
        **kwargs: Key-value pairs for query parameters

    Returns:
        dict: Filtered query parameters

    Example:
        params = build_query_params(page=1, page_size=10, search=None)
        # Returns {"page": "1", "page_size": "10"}
    """
    return {k: str(v) for k, v in kwargs.items() if v is not None}


def build_pagination_params(
    page: int = 1,
    page_size: int = 10,
    **extra: Any,
) -> dict[str, str]:
    """Build pagination query parameters.

    Args:
        page: Page number (1-indexed)
        page_size: Items per page
        **extra: Additional query parameters

    Returns:
        dict: Pagination parameters

    Example:
        params = build_pagination_params(page=2, page_size=20, sort="created_at")
        # Returns {"page": "2", "page_size": "20", "sort": "created_at"}
    """
    params = {"page": str(page), "page_size": str(page_size)}
    params.update(build_query_params(**extra))
    return params


def build_filter_params(
    level: str | None = None,
    is_active: bool | None = None,
    search: str | None = None,
    **extra: Any,
) -> dict[str, str]:
    """Build filter query parameters for deck/card endpoints.

    Args:
        level: CEFR level filter (A1, A2, etc.)
        is_active: Active status filter
        search: Search term
        **extra: Additional filters

    Returns:
        dict: Filter parameters

    Example:
        params = build_filter_params(level="A1", is_active=True)
    """
    params: dict[str, str] = {}
    if level is not None:
        params["level"] = level
    if is_active is not None:
        params["is_active"] = str(is_active).lower()
    if search is not None:
        params["search"] = search
    params.update(build_query_params(**extra))
    return params


def build_url_with_params(base_url: str, params: dict[str, str]) -> str:
    """Build a URL with query parameters.

    Args:
        base_url: Base URL path
        params: Query parameters

    Returns:
        str: URL with encoded query string

    Example:
        url = build_url_with_params("/api/v1/decks", {"page": "1", "level": "A1"})
        # Returns "/api/v1/decks?page=1&level=A1"
    """
    if not params:
        return base_url
    return f"{base_url}?{urlencode(params)}"


# =============================================================================
# Response Validation Helpers
# =============================================================================


def assert_status_code(
    response: Response,
    expected: int | list[int],
    *,
    message: str | None = None,
) -> None:
    """Assert that response has expected status code.

    Enhanced assertion with helpful error message including response body.

    Args:
        response: HTTP response
        expected: Expected status code(s)
        message: Custom error message prefix

    Raises:
        AssertionError: If status code doesn't match

    Example:
        assert_status_code(response, 200)
        assert_status_code(response, [200, 201], message="Create should succeed")
    """
    if isinstance(expected, int):
        expected = [expected]

    if response.status_code not in expected:
        error_msg = f"Expected status {expected}, got {response.status_code}"
        if message:
            error_msg = f"{message}: {error_msg}"

        # Try to include response body for debugging
        try:
            body = response.json()
            error_msg += f"\nResponse body: {body}"
        except Exception:
            error_msg += f"\nResponse text: {response.text[:500]}"

        raise AssertionError(error_msg)


def assert_json_response(response: Response) -> dict[str, Any]:
    """Assert response is JSON and return parsed body.

    Args:
        response: HTTP response

    Returns:
        dict: Parsed JSON body

    Raises:
        AssertionError: If response is not valid JSON

    Example:
        data = assert_json_response(response)
        assert data["id"] == expected_id
    """
    content_type = response.headers.get("content-type", "")
    assert (
        "application/json" in content_type
    ), f"Expected JSON response, got content-type: {content_type}"

    try:
        return response.json()
    except Exception as e:
        raise AssertionError(f"Response is not valid JSON: {e}\nBody: {response.text[:500]}")


def assert_success_response(
    response: Response,
    *,
    expected_keys: list[str] | None = None,
) -> dict[str, Any]:
    """Assert response is successful (2xx) and return body.

    Args:
        response: HTTP response
        expected_keys: Keys that should be in response

    Returns:
        dict: Response body

    Raises:
        AssertionError: If response is not successful
    """
    assert (
        200 <= response.status_code < 300
    ), f"Expected success status, got {response.status_code}: {response.text}"

    data = assert_json_response(response)

    if expected_keys:
        for key in expected_keys:
            assert key in data, f"Expected key '{key}' not in response: {list(data.keys())}"

    return data


# =============================================================================
# Module Exports
# =============================================================================

__all__ = [
    # Authenticated Request Helpers
    "make_authenticated_request",
    "make_request_without_auth",
    # Token Utilities
    "extract_tokens_from_response",
    "create_auth_headers",
    "extract_user_id_from_response",
    # Query Parameter Builders
    "build_query_params",
    "build_pagination_params",
    "build_filter_params",
    "build_url_with_params",
    # Response Validation Helpers
    "assert_status_code",
    "assert_json_response",
    "assert_success_response",
]
