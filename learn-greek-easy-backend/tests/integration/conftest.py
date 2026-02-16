"""Integration test specific fixtures and configuration.

This module provides fixtures specifically for integration tests:
- URL helper fixtures for API endpoints
- Test data fixtures for common scenarios
- Integration-specific utilities
- Factory session binding (autouse for integration tests only)

Note: Database fixtures are available from the global conftest.py
(tests/conftest.py) which imports them from tests/fixtures/database.py.
The HTTP client fixture is also in the global conftest.py.

Usage:
    async def test_auth_endpoint(client, auth_url, valid_login_data):
        response = await client.post(f"{auth_url}/login", json=valid_login_data)
        assert response.status_code == 200

    async def test_deck_endpoint(client, decks_url, auth_headers):
        response = await client.get(decks_url, headers=auth_headers)
        assert response.status_code == 200
"""

from collections.abc import Generator

import pytest
import pytest_asyncio
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CultureDeck, Deck, DeckLevel
from src.main import app as fastapi_app
from tests.factories.base import set_factory_session

# =============================================================================
# Factory Session Binding
# =============================================================================


@pytest.fixture(autouse=True)
def bind_factory_session(db_session: AsyncSession) -> Generator[None, None, None]:
    """Bind the database session to all factories for integration tests.

    This fixture automatically binds the db_session to BaseFactory,
    making it available to all factory classes in integration tests.

    The binding is done before each test and cleared after.

    Args:
        db_session: The test database session fixture.

    Yields:
        None: Allows the test to run.
    """
    set_factory_session(db_session)
    yield
    set_factory_session(None)


# =============================================================================
# FastAPI Application Fixture
# =============================================================================


@pytest.fixture
def app() -> Generator[FastAPI, None, None]:
    """Provide FastAPI application instance for dependency override tests.

    Yields:
        FastAPI: The application instance.

    Note:
        Dependency overrides are automatically cleared after each test.
    """
    yield fastapi_app
    # Clean up any dependency overrides after test
    fastapi_app.dependency_overrides.clear()


# =============================================================================
# API URL Helper Fixtures
# =============================================================================


@pytest.fixture
def api_base_url() -> str:
    """Return the base URL for API v1 endpoints.

    Use this fixture to construct endpoint URLs in integration tests.

    Returns:
        str: The API base URL ("/api/v1")

    Example:
        async def test_custom_endpoint(client, api_base_url):
            response = await client.get(f"{api_base_url}/custom")
            assert response.status_code == 200
    """
    return "/api/v1"


@pytest.fixture
def auth_url(api_base_url: str) -> str:
    """Return the auth endpoints base URL.

    Returns:
        str: The auth URL ("/api/v1/auth")

    Example:
        async def test_login(client, auth_url):
            response = await client.post(f"{auth_url}/login", json=credentials)
            assert response.status_code == 200
    """
    return f"{api_base_url}/auth"


@pytest.fixture
def decks_url(api_base_url: str) -> str:
    """Return the decks endpoints base URL.

    Returns:
        str: The decks URL ("/api/v1/decks")

    Example:
        async def test_list_decks(client, decks_url, auth_headers):
            response = await client.get(decks_url, headers=auth_headers)
            assert response.status_code == 200
    """
    return f"{api_base_url}/decks"


@pytest.fixture
def cards_url(api_base_url: str) -> str:
    """Return the cards endpoints base URL.

    Returns:
        str: The cards URL ("/api/v1/cards")

    Example:
        async def test_get_card(client, cards_url, auth_headers, test_card):
            response = await client.get(
                f"{cards_url}/{test_card.id}",
                headers=auth_headers
            )
            assert response.status_code == 200
    """
    return f"{api_base_url}/cards"


@pytest.fixture
def reviews_url(api_base_url: str) -> str:
    """Return the reviews endpoints base URL.

    Returns:
        str: The reviews URL ("/api/v1/reviews")

    Example:
        async def test_submit_review(client, reviews_url, auth_headers):
            response = await client.post(
                reviews_url,
                json={"card_id": str(card_id), "quality": 4},
                headers=auth_headers
            )
            assert response.status_code == 201
    """
    return f"{api_base_url}/reviews"


@pytest.fixture
def users_url(api_base_url: str) -> str:
    """Return the users endpoints base URL.

    Returns:
        str: The users URL ("/api/v1/users")

    Example:
        async def test_get_current_user(client, users_url, auth_headers):
            response = await client.get(f"{users_url}/me", headers=auth_headers)
            assert response.status_code == 200
    """
    return f"{api_base_url}/users"


@pytest.fixture
def progress_url(api_base_url: str) -> str:
    """Return the progress endpoints base URL.

    Returns:
        str: The progress URL ("/api/v1/progress")

    Example:
        async def test_get_progress(client, progress_url, auth_headers):
            response = await client.get(progress_url, headers=auth_headers)
            assert response.status_code == 200
    """
    return f"{api_base_url}/progress"


@pytest.fixture
def feedback_url(api_base_url: str) -> str:
    """Return the feedback endpoints base URL.

    Returns:
        str: The feedback URL ("/api/v1/feedback")

    Example:
        async def test_list_feedback(client, feedback_url, auth_headers):
            response = await client.get(feedback_url, headers=auth_headers)
            assert response.status_code == 200
    """
    return f"{api_base_url}/feedback"


# =============================================================================
# Test Data Fixtures
# =============================================================================


@pytest.fixture
def valid_registration_data() -> dict:
    """Provide valid user registration data.

    Returns a dictionary with all required fields for user registration.

    Returns:
        dict: Registration data with email, password, and display_name

    Example:
        async def test_register(client, auth_url, valid_registration_data):
            response = await client.post(
                f"{auth_url}/register",
                json=valid_registration_data
            )
            assert response.status_code == 201
    """
    return {
        "email": "newuser@example.com",
        "password": "SecurePass123!",
        "full_name": "New User",
    }


@pytest.fixture
def valid_login_data(test_user) -> dict:
    """Provide valid login credentials for test_user.

    This fixture depends on test_user and provides credentials
    that will successfully authenticate against that user.

    Args:
        test_user: The test_user fixture from auth fixtures

    Returns:
        dict: Login credentials with email and password

    Example:
        async def test_login(client, auth_url, valid_login_data):
            response = await client.post(
                f"{auth_url}/login",
                json=valid_login_data
            )
            assert response.status_code == 200
            assert "access_token" in response.json()
    """
    return {
        "email": test_user.email,
        "password": "TestPassword123!",  # Default password from auth fixtures
    }


@pytest.fixture
def invalid_login_data() -> dict:
    """Provide invalid login credentials.

    Use this to test authentication failure scenarios.

    Returns:
        dict: Invalid credentials that should fail authentication

    Example:
        async def test_login_fails_with_wrong_password(
            client, auth_url, invalid_login_data
        ):
            response = await client.post(
                f"{auth_url}/login",
                json=invalid_login_data
            )
            assert response.status_code == 401
    """
    return {
        "email": "nonexistent@example.com",
        "password": "WrongPassword123!",
    }


@pytest.fixture
def weak_password_data() -> dict:
    """Provide registration data with a weak password.

    Use this to test password validation failures.

    Returns:
        dict: Registration data with an insufficiently strong password

    Example:
        async def test_register_rejects_weak_password(
            client, auth_url, weak_password_data
        ):
            response = await client.post(
                f"{auth_url}/register",
                json=weak_password_data
            )
            assert response.status_code == 422
    """
    return {
        "email": "weakpass@example.com",
        "password": "weak",  # Too short, no uppercase, no numbers
        "full_name": "Weak Password User",
    }


@pytest.fixture
def invalid_email_data() -> dict:
    """Provide registration data with an invalid email format.

    Use this to test email validation failures.

    Returns:
        dict: Registration data with an invalid email

    Example:
        async def test_register_rejects_invalid_email(
            client, auth_url, invalid_email_data
        ):
            response = await client.post(
                f"{auth_url}/register",
                json=invalid_email_data
            )
            assert response.status_code == 422
    """
    return {
        "email": "not-an-email",
        "password": "ValidPass123!",
        "full_name": "Invalid Email User",
    }


# =============================================================================
# Deck Test Data Fixtures
# =============================================================================


@pytest.fixture
def valid_deck_data() -> dict:
    """Provide valid deck creation data.

    Returns:
        dict: Deck data for creation tests

    Example:
        async def test_create_deck(client, decks_url, auth_headers, valid_deck_data):
            response = await client.post(
                decks_url,
                json=valid_deck_data,
                headers=auth_headers
            )
            assert response.status_code == 201
    """
    return {
        "name": "Test Deck",
        "description": "A test deck for integration tests",
        "level": "A1",
        "is_active": True,
    }


@pytest.fixture
def valid_card_data(test_deck) -> dict:
    """Provide valid card creation data.

    Args:
        test_deck: A deck fixture to associate the card with

    Returns:
        dict: Card data for creation tests
    """
    return {
        "deck_id": str(test_deck.id),
        "front_text": "Hello",
        "back_text_en": "Yeia sou",
        "pronunciation": "Yah soo",
    }


# =============================================================================
# Review Test Data Fixtures
# =============================================================================


@pytest.fixture
def valid_review_data(test_card) -> dict:
    """Provide valid review submission data.

    Args:
        test_card: A card fixture to review

    Returns:
        dict: Review data for submission tests
    """
    return {
        "card_id": str(test_card.id),
        "quality": 4,  # Good recall
        "time_taken": 5,  # 5 seconds
    }


@pytest.fixture
def perfect_review_data(test_card) -> dict:
    """Provide perfect review submission data (quality 5).

    Args:
        test_card: A card fixture to review

    Returns:
        dict: Perfect review data
    """
    return {
        "card_id": str(test_card.id),
        "quality": 5,  # Perfect recall
        "time_taken": 2,
    }


@pytest.fixture
def failed_review_data(test_card) -> dict:
    """Provide failed review submission data (quality 0-2).

    Args:
        test_card: A card fixture to review

    Returns:
        dict: Failed review data
    """
    return {
        "card_id": str(test_card.id),
        "quality": 1,  # Complete blackout
        "time_taken": 15,
    }


# =============================================================================
# Localized Deck Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def localized_deck(db_session: AsyncSession) -> Deck:
    """Create a system deck with all language variants.

    This fixture creates a deck with trilingual support for testing
    Accept-Language header handling.

    Yields:
        Deck: A system deck with name and description in en, el, ru
    """
    deck = Deck(
        name_el="Ελληνικό Λεξιλόγιο",
        name_en="Greek Vocabulary",
        name_ru="Греческий словарь",
        description_el="Βασικές λέξεις για αρχάριους",
        description_en="Basic words for beginners",
        description_ru="Базовые слова для начинающих",
        level=DeckLevel.A1,
        is_active=True,
        is_premium=False,
        owner_id=None,  # System deck
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest_asyncio.fixture
async def localized_culture_deck(db_session: AsyncSession) -> CultureDeck:
    """Create a culture deck with all language variants.

    This fixture creates a culture deck with trilingual support for testing
    Accept-Language header handling.

    Yields:
        CultureDeck: A culture deck with name and description in en, el, ru
    """
    deck = CultureDeck(
        name_el="Ελληνική Ιστορία",
        name_en="Greek History",
        name_ru="Греческая история",
        description_el="Μάθετε για την ιστορία της Ελλάδας",
        description_en="Learn about Greek history",
        description_ru="Узнайте об истории Греции",
        category="history",
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


# =============================================================================
# Module Exports
# =============================================================================

__all__ = [
    # Factory session binding
    "bind_factory_session",
    # FastAPI app
    "app",
    # URL fixtures
    "api_base_url",
    "auth_url",
    "decks_url",
    "cards_url",
    "reviews_url",
    "users_url",
    "progress_url",
    "feedback_url",
    # Registration/Login fixtures
    "valid_registration_data",
    "valid_login_data",
    "invalid_login_data",
    "weak_password_data",
    "invalid_email_data",
    # Deck fixtures
    "valid_deck_data",
    "valid_card_data",
    # Localized deck fixtures
    "localized_deck",
    "localized_culture_deck",
    # Review fixtures
    "valid_review_data",
    "perfect_review_data",
    "failed_review_data",
]
