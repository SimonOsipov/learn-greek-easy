"""Integration tests for Learn Greek Easy backend.

Integration tests verify that multiple components work together correctly.
These tests use a real PostgreSQL database and test actual API endpoints.

Structure:
---------
- api/: API endpoint integration tests

Conventions:
-----------
- Tests use a real database (PostgreSQL)
- Each test runs in a transaction that is rolled back
- Tests may be slower than unit tests
- HTTP client fixture makes actual requests to the app

Running Integration Tests:
-------------------------
    # Run all integration tests
    poetry run pytest tests/integration/

    # Run with marker
    poetry run pytest -m integration

    # Run API tests only
    poetry run pytest tests/integration/api/

Available Fixtures (from tests/integration/conftest.py):
------------------------------------------------------
URL Helpers:
- api_base_url: "/api/v1"
- auth_url: "/api/v1/auth"
- decks_url: "/api/v1/decks"
- cards_url: "/api/v1/cards"
- reviews_url: "/api/v1/reviews"
- users_url: "/api/v1/users"
- progress_url: "/api/v1/progress"

Test Data:
- valid_registration_data: Dict for user registration
- valid_login_data: Dict for user login (requires test_user)
- invalid_login_data: Dict with invalid credentials
- valid_deck_data: Dict for deck creation
- valid_card_data: Dict for card creation
- valid_review_data: Dict for review submission

Global Fixtures (from tests/conftest.py):
----------------------------------------
- db_session: Real database session with rollback
- client: AsyncClient for HTTP requests
- test_user: Standard test user
- auth_headers: Authorization headers for test_user

Example:
-------
    @pytest.mark.integration
    class TestAuthAPI:
        async def test_register_creates_user(
            self, client, auth_url, valid_registration_data
        ):
            response = await client.post(
                f"{auth_url}/register",
                json=valid_registration_data
            )
            assert response.status_code == 201
            assert "id" in response.json()

        async def test_login_returns_tokens(
            self, client, auth_url, valid_login_data
        ):
            response = await client.post(
                f"{auth_url}/login",
                json=valid_login_data
            )
            assert response.status_code == 200
            assert "access_token" in response.json()
"""
