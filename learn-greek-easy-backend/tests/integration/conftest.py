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

from collections.abc import AsyncGenerator, Generator

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from src.db.models import CultureDeck, Deck, DeckLevel, SubscriptionStatus, SubscriptionTier, User
from src.main import app as fastapi_app
from tests.factories.auth import UserFactory
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
# Real get_db Commit/Rollback Boundary Fixtures (OPS-04-03, promoted from
# test_webhook_integration.py by PAY-05-04 so other integration modules --
# starting with test_user_deletion_integration.py -- can share them)
# =============================================================================
#
# The shared `client` fixture (tests/conftest.py:376-401) overrides get_db
# with a bare `yield db_session` -- it never calls commit()/rollback(), so it
# cannot exercise the production get_db boundary (src/db/dependencies.py)
# where a matched-handler failure must roll back BOTH the user mutation and
# the webhook_events row. Both `db_session` and `db_session_with_savepoint`
# (tests/fixtures/database.py) use a single `connection.begin_nested()` with
# no restart mechanism, so a REAL `session.rollback()` inside a request would
# roll back the seeded fixture data too (or leave the savepoint consumed).
#
# The fixtures below implement the SQLAlchemy 2.0 canonical recipe for
# "Joining a Session into an External Transaction" (verified against
# Context7 / docs.sqlalchemy.org/en/20/orm/session_transaction.html): bind a
# Session/AsyncSession to a connection that already has an open,
# never-committed outer transaction, using
# join_transaction_mode="create_savepoint". This supersedes the older
# pre-1.4 recipe of a manual
# `@event.listens_for(session.sync_session, "after_transaction_end")`
# listener that re-opens a SAVEPOINT by hand -- join_transaction_mode builds
# the same "restart savepoint on every autobegin" behavior directly into the
# Session (confirmed via `AsyncSession.__init__`'s `**kw` passthrough to the
# sync `Session.__init__`, which exposes `join_transaction_mode` in
# SQLAlchemy 2.0.51, the version pinned in this repo), so code under test
# can call commit()/rollback() any number of times while the connection's
# outer transaction still isolates everything from the real database.


@pytest_asyncio.fixture
async def real_commit_session(db_engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    """AsyncSession bound to a connection with join_transaction_mode="create_savepoint".

    Unlike db_session/db_session_with_savepoint (single begin_nested(), no
    restart), every session.commit()/rollback() here only ends the CURRENT
    SAVEPOINT -- the next operation on the session autobegins a FRESH
    SAVEPOINT nested under the same still-open, still-uncommitted outer
    transaction. Rolling back that outer transaction at teardown discards
    everything (no durable writes; xdist/NullPool-safe, same guarantee as
    db_session).

    Callers that seed data with this session and then drive an HTTP request
    through it (see real_commit_client) MUST commit() after seeding --
    otherwise the seed insert shares the SAME savepoint as the request's own
    mutations, and a real rollback() inside the request would undo the seed
    too (exactly the trap this fixture exists to avoid).
    """
    connection = await db_engine.connect()
    transaction = await connection.begin()  # outer transaction, NEVER committed

    session = AsyncSession(
        bind=connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )

    try:
        yield session
    finally:
        await session.close()
        await transaction.rollback()
        await connection.close()


@pytest_asyncio.fixture
async def real_commit_client(
    real_commit_session: AsyncSession,
) -> AsyncGenerator[AsyncClient, None]:
    """AsyncClient wired to a get_db override that mirrors production
    src/db/dependencies.py::get_db EXACTLY: commit() on success, rollback()
    on any exception. This is what lets failure-path tests observe the real
    commit/rollback boundary -- the shared `client` fixture's bare
    `yield db_session` override never calls either.
    """
    from src.db.dependencies import get_db
    from src.main import app

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        try:
            yield real_commit_session
            await real_commit_session.commit()
        except Exception:
            await real_commit_session.rollback()
            raise

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def real_commit_authed_client(
    real_commit_client: AsyncClient,
    real_commit_session: AsyncSession,
) -> AsyncGenerator[tuple[AsyncClient, User], None]:
    """(client, user) pair wired to the real commit/rollback boundary AND a
    real, DB-backed authenticated user -- for endpoints (like
    DELETE /api/v1/users/me) whose durability guarantees can only be
    proven by reading committed state back from the database. [PAY-05-04]
    [real-commit-auth-override]

    Seeds one User directly on real_commit_session (default shape: FREE
    tier, TRIALING status, no Stripe ids -- the inert "free user" case) and
    commits that seed immediately, so a request driven through
    real_commit_client -- which reads via the SAME connection once its
    get_db override is live -- can see the row. Then overrides
    get_current_user to return that exact object. Both overrides land on
    the SAME app.dependency_overrides dict that real_commit_client's
    teardown clears wholesale (`.clear()`, not a single-key pop), so
    registering get_current_user here -- on top of the get_db override
    real_commit_client already registered -- is sufficient; no separate
    get_db override or AsyncClient construction is needed in this fixture.
    Overriding get_current_user replaces the WHOLE callable (FastAPI swaps
    the entire dependency, not just its body), so the request needs no
    Authorization header at all -- none of JWKS verification, the identity
    cache, or Sentry/logging context from the real get_current_user runs.

    Tests that need a different subscription/Stripe shape than the default
    (e.g. an ACTIVE subscription with stripe_subscription_id/
    stripe_customer_id set) mutate attributes on the yielded `user` and
    call `await real_commit_session.commit()` again before driving the
    request -- real_commit_session's join_transaction_mode
    ("create_savepoint") lets it commit any number of times, and
    expire_on_commit=False means the mutated attributes stay readable on
    the same Python object afterwards.

    Do NOT use auth_headers/test_user/bare `UserFactory.create()` (no
    `session=` kwarg) here or in tests that consume this fixture -- those
    all bind to `db_session` (tests/fixtures/database.py), a DIFFERENT
    connection than real_commit_session (both draw from the same
    `db_engine`/`session_db_engine` pool, but are never the same connection
    object). A request routed through real_commit_client reads via
    real_commit_session's connection, so it cannot see a row seeded on
    db_session's connection -- not even after a commit there, since
    Postgres transaction isolation does not share (even committed) state
    across separate connections. `UserFactory.create(session=
    real_commit_session, ...)` (used below, and already proven at
    test_webhook_integration.py:361-367/446-452) sidesteps this correctly;
    the ban is on the *default-bound* session, not on factories generally.
    """
    from src.core.dependencies import get_current_user
    from src.main import app

    user = await UserFactory.create(
        session=real_commit_session,
        subscription_tier=SubscriptionTier.FREE,
        subscription_status=SubscriptionStatus.TRIALING,
        stripe_customer_id=None,
        stripe_subscription_id=None,
    )
    await real_commit_session.commit()

    async def override_get_current_user() -> User:
        return user

    app.dependency_overrides[get_current_user] = override_get_current_user

    yield real_commit_client, user


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
    # Real get_db commit/rollback boundary fixtures (OPS-04-03, PAY-05-04)
    "real_commit_session",
    "real_commit_client",
    "real_commit_authed_client",
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
