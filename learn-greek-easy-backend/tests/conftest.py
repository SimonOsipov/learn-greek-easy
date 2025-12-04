"""Global test fixtures and configuration for Learn Greek Easy backend.

This module provides:
- Event loop configuration for async tests
- Pytest plugins and hooks
- Shared fixtures available to all tests
- Test markers registration
- Database fixtures for async testing (PostgreSQL only)

Fixture Organization:
- Database fixtures: tests/fixtures/database.py
- Auth fixtures: tests/integration/conftest.py
- Model fixtures: tests/unit/repositories/conftest.py

Note: All database fixtures use PostgreSQL exclusively.
      SQLite is not supported due to PostgreSQL-specific features.
"""

import asyncio
from collections.abc import AsyncGenerator, Generator
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

# Import auth fixtures from fixtures package
from tests.fixtures.auth import (  # User fixtures; Token fixtures; Header fixtures; Bundle fixtures; Error testing fixtures
    access_token,
    auth_headers,
    authenticated_superuser,
    authenticated_user,
    expired_access_token,
    expired_auth_headers,
    invalid_token,
    refresh_token_value,
    superuser_auth_headers,
    superuser_tokens,
    test_inactive_user,
    test_superuser,
    test_user,
    test_user_tokens,
    test_verified_user,
    two_users,
)

# Import database fixtures from fixtures package
from tests.fixtures.database import (
    clean_tables,
    db_engine,
    db_session,
    db_session_with_savepoint,
    db_url,
    fast_db_session,
    is_parallel_run,
    session_db_engine,
    verify_isolation,
    worker_id,
)

# Import deck fixtures from fixtures package
from tests.fixtures.deck import (  # Type definitions; Core fixtures; Card fixtures; Composite fixtures
    DeckWithCards,
    MultiLevelDecks,
    cards_by_difficulty,
    deck_with_a2_cards,
    deck_with_all_a1_cards,
    deck_with_b1_cards,
    deck_with_cards,
    deck_with_many_cards,
    empty_deck,
    inactive_deck,
    multi_level_decks,
    test_card,
    test_cards,
    test_deck,
    test_deck_a1,
    test_deck_a2,
    test_deck_b1,
    two_decks,
)

# Import progress fixtures from fixtures package
from tests.fixtures.progress import (  # Type definitions; Progress fixtures; Card statistics fixtures; Review fixtures; Bundle fixtures
    CardsByStatus,
    CardWithStatistics,
    ReviewHistory,
    UserProgress,
    UserWithLearningData,
    card_with_review_history,
    card_with_statistics,
    cards_by_status,
    completed_deck_progress,
    due_card_statistics,
    failed_review,
    fresh_user_progress,
    learning_card_statistics,
    mastered_card_statistics,
    multiple_due_cards,
    new_card_statistics,
    overdue_card_statistics,
    perfect_review,
    perfect_review_history,
    review_card_statistics,
    review_history,
    struggling_review_history,
    test_review,
    two_users_same_deck,
    user_deck_progress,
    user_with_deck_progress,
    user_with_learning_progress,
)

# Re-export for backwards compatibility
__all__ = [
    # Database fixtures
    "db_engine",
    "db_session",
    "db_session_with_savepoint",
    "session_db_engine",
    "fast_db_session",
    "db_url",
    "clean_tables",
    "verify_isolation",
    # Parallel execution fixtures
    "worker_id",
    "is_parallel_run",
    # Auth fixtures
    "test_user",
    "test_superuser",
    "test_verified_user",
    "test_inactive_user",
    "two_users",
    "test_user_tokens",
    "superuser_tokens",
    "access_token",
    "refresh_token_value",
    "auth_headers",
    "superuser_auth_headers",
    "expired_auth_headers",
    "authenticated_user",
    "authenticated_superuser",
    "expired_access_token",
    "invalid_token",
    # Deck fixtures
    "DeckWithCards",
    "MultiLevelDecks",
    "test_deck",
    "test_deck_a1",
    "test_deck_a2",
    "test_deck_b1",
    "inactive_deck",
    "empty_deck",
    "test_card",
    "test_cards",
    "cards_by_difficulty",
    "deck_with_cards",
    "deck_with_all_a1_cards",
    "deck_with_a2_cards",
    "deck_with_b1_cards",
    "multi_level_decks",
    "two_decks",
    "deck_with_many_cards",
    # Progress fixtures
    "UserProgress",
    "CardWithStatistics",
    "UserWithLearningData",
    "CardsByStatus",
    "ReviewHistory",
    "user_deck_progress",
    "fresh_user_progress",
    "completed_deck_progress",
    "new_card_statistics",
    "learning_card_statistics",
    "review_card_statistics",
    "mastered_card_statistics",
    "due_card_statistics",
    "overdue_card_statistics",
    "cards_by_status",
    "multiple_due_cards",
    "test_review",
    "perfect_review",
    "failed_review",
    "review_history",
    "perfect_review_history",
    "struggling_review_history",
    "user_with_deck_progress",
    "card_with_statistics",
    "card_with_review_history",
    "user_with_learning_progress",
    "two_users_same_deck",
]


# =============================================================================
# Event Loop Configuration
# =============================================================================


@pytest.fixture(scope="session")
def event_loop_policy():
    """Provide event loop policy for the test session.

    Uses the default asyncio event loop policy, which is appropriate for
    most cases. Override this fixture if you need a custom policy.

    Returns:
        asyncio.AbstractEventLoopPolicy: The event loop policy to use.
    """
    return asyncio.DefaultEventLoopPolicy()


# =============================================================================
# Pytest Configuration Hooks
# =============================================================================


def pytest_configure(config: pytest.Config) -> None:
    """Configure pytest with custom markers and settings.

    This hook runs during pytest's configuration phase, before test collection.
    We use it to:
    - Register custom markers (unit, integration, slow, auth, api, db, no_parallel)
    - Set up any global test configuration

    Args:
        config: The pytest configuration object.
    """
    # Register custom markers (also defined in pyproject.toml for IDE support)
    config.addinivalue_line("markers", "unit: Unit tests (fast, isolated, mocked dependencies)")
    config.addinivalue_line("markers", "integration: Integration tests (slower, real database)")
    config.addinivalue_line("markers", "slow: Slow tests (>1s execution time)")
    config.addinivalue_line("markers", "auth: Authentication-related tests")
    config.addinivalue_line("markers", "api: API endpoint tests")
    config.addinivalue_line("markers", "db: Database-related tests")
    config.addinivalue_line(
        "markers", "no_parallel: Tests that cannot run in parallel (sequential only)"
    )


def pytest_collection_modifyitems(
    session: pytest.Session,
    config: pytest.Config,
    items: list[pytest.Item],
) -> None:
    """Modify collected test items.

    This hook runs after test collection. We use it to:
    - Auto-mark tests based on their location (unit/ or integration/)
    - Add default markers for test organization
    - Skip no_parallel tests when running with pytest-xdist

    Args:
        session: The pytest session.
        config: The pytest configuration.
        items: List of collected test items.
    """
    # Check if we're running in parallel mode (pytest-xdist)
    is_parallel = hasattr(config, "workerinput")

    for item in items:
        # Auto-mark tests based on directory
        test_path = str(item.fspath)
        if "unit/" in test_path:
            item.add_marker(pytest.mark.unit)
        elif "integration/" in test_path:
            item.add_marker(pytest.mark.integration)

        # Auto-mark auth-related tests
        if "auth" in item.name.lower() or "auth" in test_path.lower():
            item.add_marker(pytest.mark.auth)

        # Auto-mark middleware tests
        if "middleware" in test_path.lower():
            item.add_marker(pytest.mark.unit)

        # Auto-mark database tests
        if "db_session" in item.fixturenames or "db_engine" in item.fixturenames:
            item.add_marker(pytest.mark.db)

        # Skip no_parallel tests when running in parallel mode
        if is_parallel and item.get_closest_marker("no_parallel"):
            item.add_marker(
                pytest.mark.skip(
                    reason="Test marked as no_parallel - skipped during parallel execution"
                )
            )


def pytest_report_header(config: pytest.Config) -> list[str]:
    """Add custom information to the pytest report header.

    This appears at the start of the test run output.

    Args:
        config: The pytest configuration.

    Returns:
        List of strings to add to the report header.
    """
    from tests.helpers.database import get_test_database_url

    db_url = get_test_database_url()

    # Check parallel execution mode
    is_parallel = hasattr(config, "workerinput")
    if is_parallel:
        worker_id = config.workerinput["workerid"]
        parallel_info = f"Parallel Mode: Worker {worker_id}"
    else:
        # Check if xdist is configured (but we might be master)
        num_workers = getattr(config.option, "numprocesses", None)
        if num_workers:
            parallel_info = f"Parallel Mode: {num_workers} workers (pytest-xdist)"
        else:
            parallel_info = "Sequential Mode: Single process"

    return [
        "Learn Greek Easy Backend Test Suite",
        "Database: PostgreSQL (test_learn_greek)",
        f"URL: {db_url.split('@')[1] if '@' in db_url else db_url}",
        "Async Mode: auto (pytest-asyncio)",
        parallel_info,
        "=" * 50,
    ]


# =============================================================================
# HTTP Client Fixture
# =============================================================================


@pytest.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create a test HTTP client.

    This client will use the test database session for all requests.

    Args:
        db_session: The test database session fixture.

    Yields:
        AsyncClient: The test HTTP client.
    """
    from src.db.dependencies import get_db
    from src.main import app

    # Override the get_db dependency to use our test session
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

    # Clean up dependency overrides
    app.dependency_overrides.clear()


# =============================================================================
# Utility Fixtures
# =============================================================================


@pytest.fixture
def anyio_backend() -> str:
    """Specify the async backend for anyio-based tests.

    Returns:
        str: The backend name ("asyncio").
    """
    return "asyncio"


@pytest.fixture
def sample_password() -> str:
    """Provide a sample strong password for testing.

    This password meets all strength requirements:
    - 8+ characters
    - Uppercase and lowercase letters
    - Numbers
    - Special characters

    Returns:
        str: A valid strong password.
    """
    return "TestPassword123!"


@pytest.fixture
def sample_email() -> str:
    """Provide a sample email for testing.

    Returns:
        str: A valid test email address.
    """
    return "test@example.com"


@pytest.fixture
def sample_user_data(sample_email: str, sample_password: str) -> dict[str, Any]:
    """Provide sample user data for registration tests.

    Args:
        sample_email: The email fixture.
        sample_password: The password fixture.

    Returns:
        dict: User registration data.
    """
    return {
        "email": sample_email,
        "password": sample_password,
        "display_name": "Test User",
    }


# =============================================================================
# Test Environment Fixtures
# =============================================================================


@pytest.fixture(scope="session")
def test_settings() -> dict[str, Any]:
    """Provide test environment settings.

    Returns:
        dict: Configuration settings for tests.
    """
    from tests.helpers.database import get_test_database_url

    return {
        "testing": True,
        "debug": True,
        "database_url": get_test_database_url(),
        "jwt_secret": "test-secret-key-for-testing-only",
        "jwt_algorithm": "HS256",
        "access_token_expire_minutes": 30,
        "refresh_token_expire_days": 30,
    }


# =============================================================================
# Async Utility Fixtures
# =============================================================================


@pytest.fixture
async def async_sleep():
    """Provide an async sleep function for timing tests.

    Returns:
        Callable: An async sleep function.
    """

    async def _sleep(seconds: float) -> None:
        await asyncio.sleep(seconds)

    return _sleep


# =============================================================================
# Cleanup Fixtures
# =============================================================================


@pytest.fixture(autouse=True)
def reset_test_state() -> Generator[None, None, None]:
    """Reset any global test state between tests.

    This fixture runs automatically before and after each test,
    ensuring tests are isolated from each other.

    Yields:
        None: Allows the test to run.
    """
    # Setup: nothing to do yet
    yield
    # Teardown: nothing to do yet (database cleanup handled by db_session)
