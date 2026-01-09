"""E2E Test Infrastructure - conftest.py

This module provides the foundational infrastructure for E2E API tests:
- Type definitions (UserSession, StudyEnvironment)
- E2ETestCase base class with workflow helper methods
- E2E-specific fixtures (fresh_user_session, admin_session, populated_study_environment)
- Factory session binding for E2E tests

Usage:
    from tests.e2e.conftest import E2ETestCase, UserSession

    class TestUserWorkflow(E2ETestCase):
        async def test_complete_journey(self, client, fresh_user_session):
            # Use E2ETestCase helper methods
            decks = await self.browse_available_decks(client, fresh_user_session.headers)
            ...
"""

from collections.abc import Generator
from datetime import datetime, timedelta
from typing import NamedTuple
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from httpx import AsyncClient, Response
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Card, Deck, User
from tests.base import AuthenticatedTestCase
from tests.factories.base import BaseFactory
from tests.fixtures.auth import AuthTokens
from tests.helpers.time import freeze_time

# =============================================================================
# Type Definitions
# =============================================================================


class UserSession(NamedTuple):
    """Container for user with authentication context.

    Attributes:
        user: User model instance or user-like object from API response
        headers: Authorization headers for HTTP requests
        tokens: Optional AuthTokens container with access/refresh tokens
    """

    user: User | object  # Can be User or user-like object from API
    headers: dict[str, str]
    tokens: AuthTokens | None = None


class StudyEnvironment(NamedTuple):
    """Container for complete study testing environment.

    Attributes:
        user: User model instance
        deck: Deck model instance with cards
        cards: List of Card model instances
        headers: Authorization headers for HTTP requests
        initialized: Whether study session has been initialized
    """

    user: User
    deck: Deck
    cards: list[Card]
    headers: dict[str, str]
    initialized: bool = False


# =============================================================================
# Factory Session Binding (same pattern as integration tests)
# =============================================================================


@pytest.fixture(autouse=True)
def bind_factory_session(db_session: AsyncSession) -> Generator[None, None, None]:
    """Bind db_session to factories for E2E tests.

    This fixture automatically binds the db_session to BaseFactory,
    making it available to all factory classes in E2E tests.

    Args:
        db_session: The test database session fixture.

    Yields:
        None: Allows the test to run.
    """
    BaseFactory._session = db_session
    yield
    BaseFactory._session = None


# =============================================================================
# E2ETestCase Base Class
# =============================================================================


class E2ETestCase(AuthenticatedTestCase):
    """Base class for E2E tests with workflow helper methods.

    Extends AuthenticatedTestCase with E2E-specific utilities:
    - User registration and authentication via API
    - Study session management
    - Review submission helpers
    - Time simulation for spaced repetition testing
    - Progress validation assertions

    Example:
        class TestLearningWorkflow(E2ETestCase):
            async def test_complete_learning_journey(self, client):
                # Register and get session
                session = await self.register_and_login(client)

                # Browse and select deck
                decks = await self.browse_available_decks(client, session.headers)

                # Start studying
                queue = await self.setup_study_session(
                    client, session.headers, decks[0]["id"]
                )

                # Complete reviews
                await self.complete_review_session(
                    client, session.headers, queue["cards"], quality=4
                )
    """

    DEFAULT_PASSWORD = "TestPassword123!"

    # -------------------------------------------------------------------------
    # User Registration & Authentication
    # -------------------------------------------------------------------------

    async def register_and_login(
        self,
        client: AsyncClient,
        email: str | None = None,
        password: str | None = None,
        full_name: str = "E2E Test User",
    ) -> UserSession:
        """Create user via factory and authenticate via test seed endpoint.

        Args:
            client: AsyncClient instance
            email: User email (auto-generated if None)
            password: User password (unused, kept for API compatibility)
            full_name: User's display name

        Returns:
            UserSession: Container with user info and auth headers

        Raises:
            AssertionError: If user creation or auth fails
        """
        from tests.factories import UserFactory
        from tests.factories.base import BaseFactory

        if email is None:
            email = f"e2e_user_{uuid4().hex[:8]}@example.com"

        # Ensure factory has session bound (the autouse fixture should do this,
        # but we need to ensure it's set for async context)
        if BaseFactory._session is None:
            raise ValueError(
                "No database session available. Either pass session parameter "
                "or ensure the factory session fixture is active."
            )

        # Create user via factory (directly in DB)
        user = await UserFactory.create(email=email, full_name=full_name)

        # Get auth tokens via test seed endpoint
        response = await client.post(
            "/api/v1/test/seed/auth",
            json={"email": email},
        )
        assert response.status_code == 200, f"Test auth failed: {response.text}"
        token_data = response.json()

        headers = {"Authorization": f"Bearer {token_data['access_token']}"}

        # Create user-like object
        class UserInfo:
            """Lightweight user representation."""

            def __init__(self, user_model, data: dict) -> None:
                self.id = user_model.id
                self.email = user_model.email
                self.full_name = user_model.full_name

        return UserSession(user=UserInfo(user, token_data), headers=headers)

    async def login_user(
        self,
        client: AsyncClient,
        email: str,
        password: str | None = None,
    ) -> dict[str, str]:
        """Get auth tokens for existing user via test seed endpoint.

        Args:
            client: AsyncClient instance
            email: User email
            password: User password (unused, kept for API compatibility)

        Returns:
            dict: Authorization headers

        Raises:
            AssertionError: If auth fails
        """
        resp = await client.post(
            "/api/v1/test/seed/auth",
            json={"email": email},
        )
        assert resp.status_code == 200, f"Test auth failed: {resp.text}"
        return {"Authorization": f"Bearer {resp.json()['access_token']}"}

    # -------------------------------------------------------------------------
    # Study Session Workflows
    # -------------------------------------------------------------------------

    async def setup_study_session(
        self,
        client: AsyncClient,
        headers: dict[str, str],
        deck_id: UUID | str,
    ) -> dict:
        """Initialize study session and return queue data.

        Args:
            client: AsyncClient instance
            headers: Authorization headers
            deck_id: Deck ID to study

        Returns:
            dict: Study queue data from API

        Raises:
            AssertionError: If initialization or queue fetch fails
        """
        did = str(deck_id)

        # Initialize cards for study
        init = await client.post(f"/api/v1/study/initialize/{did}", headers=headers)
        assert init.status_code == 200, f"Init failed: {init.text}"

        # Get study queue
        queue = await client.get(f"/api/v1/study/queue/{did}", headers=headers)
        assert queue.status_code == 200, f"Queue failed: {queue.text}"

        return queue.json()

    async def complete_review_session(
        self,
        client: AsyncClient,
        headers: dict[str, str],
        cards: list,
        quality: int = 4,
        response_time_ms: int = 3000,
    ) -> list[Response]:
        """Review all provided cards with specified quality.

        Args:
            client: AsyncClient instance
            headers: Authorization headers
            cards: List of cards to review (dicts or Card objects)
            quality: Review quality (0-5, default 4 = good recall)
            response_time_ms: Simulated response time in milliseconds

        Returns:
            list[Response]: List of review submission responses

        Raises:
            AssertionError: If any review submission fails
        """
        responses = []
        for card in cards:
            # Extract card_id from various formats
            if isinstance(card, dict):
                card_id = card.get("card_id") or card.get("id")
            else:
                card_id = str(card.id)

            resp = await client.post(
                "/api/v1/reviews",
                json={
                    "card_id": str(card_id),
                    "quality": quality,
                    "response_time_ms": response_time_ms,
                },
                headers=headers,
            )
            assert resp.status_code == 201, f"Review failed: {resp.text}"
            responses.append(resp)
        return responses

    async def submit_single_review(
        self,
        client: AsyncClient,
        headers: dict[str, str],
        card_id: UUID | str,
        quality: int = 4,
        response_time_ms: int = 3000,
    ) -> dict:
        """Submit a single review and return response data.

        Args:
            client: AsyncClient instance
            headers: Authorization headers
            card_id: Card ID to review
            quality: Review quality (0-5)
            response_time_ms: Response time in milliseconds

        Returns:
            dict: Review response data from API

        Raises:
            AssertionError: If review submission fails
        """
        resp = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(card_id),
                "quality": quality,
                "response_time_ms": response_time_ms,
            },
            headers=headers,
        )
        assert resp.status_code == 201, f"Review failed: {resp.text}"
        return resp.json()

    # -------------------------------------------------------------------------
    # Time Simulation
    # -------------------------------------------------------------------------

    def advance_time(self, days: int):
        """Return context manager to freeze time N days from now.

        Useful for testing spaced repetition scheduling.

        Args:
            days: Number of days to advance

        Returns:
            ContextManager: Time freeze context manager

        Example:
            with self.advance_time(days=1):
                # All datetime calls return tomorrow
                queue = await self.setup_study_session(...)
        """
        future = datetime.utcnow() + timedelta(days=days)
        return freeze_time(future)

    # -------------------------------------------------------------------------
    # Assertions
    # -------------------------------------------------------------------------

    async def assert_progress_matches_reviews(
        self,
        client: AsyncClient,
        headers: dict[str, str],
        deck_id: UUID | str,
    ) -> None:
        """Verify progress statistics match review history.

        Args:
            client: AsyncClient instance
            headers: Authorization headers
            deck_id: Deck ID to check

        Raises:
            AssertionError: If progress doesn't match review history
        """
        did = str(deck_id)

        # Get progress
        progress = await client.get(f"/api/v1/progress/{did}", headers=headers)
        assert progress.status_code == 200

        # Get review history
        history = await client.get(
            "/api/v1/reviews/history",
            params={"deck_id": did},
            headers=headers,
        )
        assert history.status_code == 200

        p_data = progress.json()
        h_data = history.json()
        review_count = len(h_data.get("items", h_data.get("reviews", [])))

        assert (
            p_data["total_reviews"] == review_count
        ), f"Progress ({p_data['total_reviews']}) != history ({review_count})"

    async def assert_deck_card_count_accurate(
        self,
        client: AsyncClient,
        deck_id: UUID | str,
        headers: dict[str, str] | None = None,
    ) -> None:
        """Verify deck card_count matches actual card count.

        Args:
            client: AsyncClient instance
            deck_id: Deck ID to check
            headers: Optional authorization headers

        Raises:
            AssertionError: If card_count doesn't match actual cards
        """
        did = str(deck_id)
        h = headers or {}

        # Get deck info
        deck = await client.get(f"/api/v1/decks/{did}", headers=h)
        assert deck.status_code == 200

        # Get actual cards
        cards = await client.get(f"/api/v1/decks/{did}/cards", headers=h)
        assert cards.status_code == 200

        actual = len(cards.json().get("items", cards.json().get("cards", [])))
        reported = deck.json().get("card_count", 0)

        assert reported == actual, f"card_count ({reported}) != actual ({actual})"

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------

    async def get_deck_cards(
        self,
        client: AsyncClient,
        deck_id: UUID | str,
        headers: dict[str, str] | None = None,
    ) -> list[dict]:
        """Fetch all cards for a deck.

        Args:
            client: AsyncClient instance
            deck_id: Deck ID
            headers: Optional authorization headers

        Returns:
            list[dict]: List of card data from API
        """
        resp = await client.get(f"/api/v1/decks/{deck_id}/cards", headers=headers or {})
        assert resp.status_code == 200
        data = resp.json()
        return data.get("items", data.get("cards", []))

    async def browse_available_decks(
        self,
        client: AsyncClient,
        headers: dict[str, str],
    ) -> list[dict]:
        """List all available decks.

        Args:
            client: AsyncClient instance
            headers: Authorization headers

        Returns:
            list[dict]: List of deck data from API
        """
        resp = await client.get("/api/v1/decks", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        return data.get("items", data.get("decks", []))


# =============================================================================
# E2E-Specific Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def fresh_user_session(
    client: AsyncClient,
    db_session: AsyncSession,
) -> UserSession:
    """Create new user via factory and authenticate via test seed endpoint.

    This fixture creates a fresh user directly in DB via factory,
    then authenticates via the test seed auth endpoint.

    Args:
        client: AsyncClient fixture
        db_session: Database session (for transaction rollback)

    Returns:
        UserSession: Container with user info and auth headers

    Example:
        async def test_new_user_workflow(fresh_user_session):
            assert fresh_user_session.user is not None
            assert "Authorization" in fresh_user_session.headers
    """
    from tests.factories import UserFactory
    from tests.factories.base import BaseFactory

    email = f"e2e_fresh_{uuid4().hex[:8]}@example.com"
    full_name = "Fresh E2E User"

    # Ensure factory has session bound (fixture ordering can be tricky)
    BaseFactory._session = db_session

    # Create user via factory (directly in DB)
    user = await UserFactory.create(email=email, full_name=full_name)

    # Get auth tokens via test seed endpoint
    resp = await client.post(
        "/api/v1/test/seed/auth",
        json={"email": email},
    )
    assert resp.status_code == 200, f"Test auth failed: {resp.text}"
    token_data = resp.json()

    headers = {"Authorization": f"Bearer {token_data['access_token']}"}

    class UserInfo:
        """Lightweight user representation."""

        def __init__(self, user_model) -> None:
            self.id = user_model.id
            self.email = user_model.email
            self.full_name = user_model.full_name

    return UserSession(user=UserInfo(user), headers=headers)


@pytest_asyncio.fixture
async def admin_session(
    client: AsyncClient,
    test_superuser: User,
    superuser_auth_headers: dict[str, str],
) -> UserSession:
    """Provide admin session with elevated privileges.

    Uses the existing test_superuser fixture and wraps it in UserSession.

    Args:
        client: AsyncClient fixture
        test_superuser: Superuser fixture from auth fixtures
        superuser_auth_headers: Superuser auth headers fixture

    Returns:
        UserSession: Container with superuser and admin headers

    Example:
        async def test_admin_operation(admin_session):
            # admin_session.user has is_superuser=True
            response = await client.delete(
                f"/api/v1/admin/users/{user_id}",
                headers=admin_session.headers
            )
    """
    return UserSession(user=test_superuser, headers=superuser_auth_headers)


@pytest_asyncio.fixture
async def populated_study_environment(
    client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    auth_headers: dict[str, str],
    deck_with_cards: tuple[Deck, list[Card]],
) -> StudyEnvironment:
    """User with deck, cards, and initialized study session.

    This fixture provides a complete study environment ready for testing:
    - User with authentication
    - Deck with cards
    - Initialized study session (cards ready to review)

    Args:
        client: AsyncClient fixture
        db_session: Database session
        test_user: Test user fixture
        auth_headers: Auth headers fixture
        deck_with_cards: Deck with cards fixture

    Returns:
        StudyEnvironment: Complete study testing environment

    Example:
        async def test_review_session(populated_study_environment):
            env = populated_study_environment
            assert env.initialized
            # Ready to test reviews
            resp = await client.post(
                "/api/v1/reviews",
                json={"card_id": str(env.cards[0].id), "quality": 4},
                headers=env.headers
            )
    """
    deck, cards = deck_with_cards

    # Initialize study session
    resp = await client.post(
        f"/api/v1/study/initialize/{deck.id}",
        headers=auth_headers,
    )
    initialized = resp.status_code == 200

    return StudyEnvironment(
        user=test_user,
        deck=deck,
        cards=cards,
        headers=auth_headers,
        initialized=initialized,
    )


# =============================================================================
# Module Exports
# =============================================================================

__all__ = [
    # Type definitions
    "UserSession",
    "StudyEnvironment",
    # Base class
    "E2ETestCase",
    # Fixtures
    "bind_factory_session",
    "fresh_user_session",
    "admin_session",
    "populated_study_environment",
]
