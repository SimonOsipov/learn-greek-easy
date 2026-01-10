"""Unit tests for Learn Greek Easy backend.

Unit tests are fast, isolated tests that test individual functions,
classes, or methods in isolation. Dependencies are mocked.

Structure:
---------
- core/: Core module tests (security, JWT, dependencies)
- services/: Service layer tests
- middleware/: Middleware tests
- repositories/: Repository layer tests
- infrastructure/: Test framework infrastructure tests

Conventions:
-----------
- Tests should be fast (< 100ms each)
- External dependencies should be mocked
- Database access should use mock_db_session fixture
- Each test should test a single behavior

Running Unit Tests:
------------------
    # Run all unit tests
    poetry run pytest tests/unit/

    # Run with marker
    poetry run pytest -m unit

    # Run specific module
    poetry run pytest tests/unit/core/

Available Fixtures (from tests/unit/conftest.py):
-----------------------------------------------
- mock_db_session: Mock AsyncSession for database operations
- mock_auth: Mock AuthService for authentication logic
- mock_email: Mock EmailService for email operations
- mock_redis: Mock Redis client for caching

Example:
-------
    class TestAuthService:
        async def test_get_user_by_email_found(self, mock_db_session):
            service = AuthService(mock_db_session)
            user = await service._get_user_by_email("test@example.com")
            assert user is not None
"""
