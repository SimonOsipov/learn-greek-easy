"""Base test classes for Learn Greek Easy backend tests.

This module provides reusable base classes that encapsulate common
testing patterns and utilities:

- BaseTestCase: Foundation for all tests with common utilities
- AuthenticatedTestCase: Extends BaseTestCase with authentication helpers

These classes are designed to work with pytest fixtures and provide
utility methods rather than fixture inheritance (which doesn't work well
with pytest's fixture system).

Usage:
    class TestMyFeature(BaseTestCase):
        async def test_something(self, db_session):
            user = await self.create_test_user(db_session)
            assert user.email is not None

    class TestProtectedEndpoint(AuthenticatedTestCase):
        async def test_with_auth(self, client, authenticated_user):
            response = await self.make_authenticated_request(
                client, "GET", "/api/v1/me", authenticated_user.headers
            )
            assert response.status_code == 200
"""

from datetime import datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient, Response
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import Card, Deck, DeckLevel, User, UserSettings


class BaseTestCase:
    """Base class for all test cases providing common utilities.

    This class provides:
    - User creation utilities
    - Deck and card creation utilities
    - Common assertions
    - Database helper methods
    - Timestamp utilities

    All methods are designed to work with pytest fixtures passed as arguments.
    This class does NOT define fixtures itself.

    Example:
        class TestUsers(BaseTestCase):
            async def test_create_user(self, db_session):
                user = await self.create_test_user(db_session)
                assert user.id is not None
                assert user.is_active is True
    """

    # =========================================================================
    # User Creation Utilities
    # =========================================================================

    async def create_test_user(
        self,
        db_session: AsyncSession,
        email: str | None = None,
        full_name: str = "Test User",
        is_active: bool = True,
        is_superuser: bool = False,
    ) -> User:
        """Create a test user in the database.

        All test users are created with Supabase authentication.

        Args:
            db_session: Database session
            email: User email (auto-generated if None)
            full_name: User's full name
            is_active: Whether account is active
            is_superuser: Whether user has admin privileges

        Returns:
            User: Created user with settings
        """
        if email is None:
            email = f"test_{uuid4().hex[:8]}@example.com"

        user = User(
            email=email,
            supabase_id=str(uuid4()),
            full_name=full_name,
            is_active=is_active,
            is_superuser=is_superuser,
        )
        db_session.add(user)
        await db_session.flush()

        settings = UserSettings(
            user_id=user.id,
            daily_goal=20,
            email_notifications=True,
        )
        db_session.add(settings)
        await db_session.commit()

        # Reload user with settings using selectinload (required for lazy="raise")
        stmt = select(User).options(selectinload(User.settings)).where(User.id == user.id)
        result = await db_session.execute(stmt)
        user = result.scalar_one()

        return user

    async def create_test_superuser(
        self,
        db_session: AsyncSession,
        email: str | None = None,
    ) -> User:
        """Create a superuser for admin testing.

        Args:
            db_session: Database session
            email: User email (auto-generated if None)

        Returns:
            User: Created superuser
        """
        return await self.create_test_user(
            db_session,
            email=email or f"admin_{uuid4().hex[:8]}@example.com",
            full_name="Admin User",
            is_superuser=True,
        )

    # =========================================================================
    # Deck and Card Creation Utilities
    # =========================================================================

    async def create_test_deck(
        self,
        db_session: AsyncSession,
        name: str = "Test Deck",
        description: str = "A test deck",
        level: DeckLevel = DeckLevel.A1,
        is_active: bool = True,
    ) -> Deck:
        """Create a test deck in the database.

        Args:
            db_session: Database session
            name: Deck name (used for all language fields)
            description: Deck description (used for all language fields)
            level: CEFR level (A1-C2)
            is_active: Whether deck is active

        Returns:
            Deck: Created deck
        """
        deck = Deck(
            name_en=name,
            name_el=name,
            name_ru=name,
            description_en=description,
            description_el=description,
            description_ru=description,
            level=level,
            is_active=is_active,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)

        return deck

    async def create_test_card(
        self,
        db_session: AsyncSession,
        deck: Deck,
        front_text: str = "Hello",
        back_text_en: str = "Yeia",
    ) -> Card:
        """Create a test card in the database.

        Args:
            db_session: Database session
            deck: Parent deck
            front_text: Front of card (Greek)
            back_text_en: Back of card (English translation)

        Returns:
            Card: Created card
        """
        card = Card(
            deck_id=deck.id,
            front_text=front_text,
            back_text_en=back_text_en,
        )
        db_session.add(card)
        await db_session.commit()
        await db_session.refresh(card)

        return card

    async def create_deck_with_cards(
        self,
        db_session: AsyncSession,
        name: str = "Test Deck",
        level: DeckLevel = DeckLevel.A1,
        card_count: int = 5,
    ) -> tuple[Deck, list[Card]]:
        """Create a deck with multiple cards.

        Args:
            db_session: Database session
            name: Deck name
            level: CEFR level
            card_count: Number of cards to create

        Returns:
            tuple: (Deck, list of Cards)
        """
        deck = await self.create_test_deck(db_session, name=name, level=level)

        cards = []
        for i in range(card_count):
            card = await self.create_test_card(
                db_session,
                deck,
                front_text=f"Greek word {i}",
                back_text_en=f"English word {i}",
            )
            cards.append(card)

        return deck, cards

    # =========================================================================
    # Database Helper Methods
    # =========================================================================

    async def count_table_rows(
        self,
        db_session: AsyncSession,
        table_name: str,
    ) -> int:
        """Count rows in a database table.

        Args:
            db_session: Database session
            table_name: Name of the table

        Returns:
            int: Number of rows in the table
        """
        result = await db_session.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
        return result.scalar() or 0

    async def table_exists(
        self,
        db_session: AsyncSession,
        table_name: str,
    ) -> bool:
        """Check if a table exists in the database.

        Args:
            db_session: Database session
            table_name: Name of the table

        Returns:
            bool: True if table exists
        """
        result = await db_session.execute(
            text(
                """
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = :table_name
                )
                """
            ),
            {"table_name": table_name},
        )
        return result.scalar() or False

    async def get_entity_by_id(
        self,
        db_session: AsyncSession,
        model_class: type,
        entity_id: UUID,
    ) -> Any:
        """Get an entity by its ID.

        Args:
            db_session: Database session
            model_class: SQLAlchemy model class
            entity_id: UUID of the entity

        Returns:
            Entity or None if not found
        """
        return await db_session.get(model_class, entity_id)

    # =========================================================================
    # Timestamp Utilities
    # =========================================================================

    @staticmethod
    def utc_now() -> datetime:
        """Get current UTC datetime.

        Returns:
            datetime: Current UTC time
        """
        return datetime.utcnow()

    @staticmethod
    def days_ago(days: int) -> datetime:
        """Get datetime for N days ago.

        Args:
            days: Number of days ago

        Returns:
            datetime: Timestamp for N days ago
        """
        return datetime.utcnow() - timedelta(days=days)

    @staticmethod
    def days_from_now(days: int) -> datetime:
        """Get datetime for N days from now.

        Args:
            days: Number of days from now

        Returns:
            datetime: Timestamp for N days from now
        """
        return datetime.utcnow() + timedelta(days=days)

    # =========================================================================
    # Assertion Helpers
    # =========================================================================

    def assert_user_created(self, user: User, email: str | None = None) -> None:
        """Assert that a user was created correctly.

        Args:
            user: User to validate
            email: Expected email (optional)
        """
        assert user is not None
        assert user.id is not None
        assert user.created_at is not None
        if email:
            assert user.email == email

    def assert_response_success(
        self,
        response: Response,
        expected_status: int = 200,
    ) -> None:
        """Assert that an HTTP response was successful.

        Args:
            response: HTTP response
            expected_status: Expected status code (default 200)
        """
        assert response.status_code == expected_status, (
            f"Expected {expected_status}, got {response.status_code}: " f"{response.text}"
        )

    def assert_response_error(
        self,
        response: Response,
        expected_status: int,
        error_detail: str | None = None,
    ) -> None:
        """Assert that an HTTP response was an error.

        Args:
            response: HTTP response
            expected_status: Expected error status code
            error_detail: Expected error message (optional)
        """
        assert response.status_code == expected_status
        if error_detail:
            data = response.json()
            assert "detail" in data
            assert error_detail in data["detail"]


class AuthenticatedTestCase(BaseTestCase):
    """Base class for tests requiring authentication.

    Extends BaseTestCase with authentication-specific utilities:
    - Token creation and validation
    - Auth header generation
    - Authenticated HTTP request helpers

    This class provides helper methods but relies on pytest fixtures
    for actual user/token creation (from tests/fixtures/auth.py).

    Example:
        class TestProtectedEndpoints(AuthenticatedTestCase):
            async def test_me_endpoint(self, client, authenticated_user):
                response = await self.make_authenticated_request(
                    client, "GET", "/api/v1/auth/me", authenticated_user.headers
                )
                self.assert_response_success(response)
    """

    # =========================================================================
    # Auth Headers Utilities
    # =========================================================================

    def create_auth_headers(self) -> dict[str, str]:
        """Create Authorization headers for authenticated requests.

        In Supabase testing, we use dependency overrides to inject the user,
        so the actual token value doesn't matter.

        Returns:
            dict: Headers with Bearer token
        """
        return {"Authorization": "Bearer test-supabase-token"}

    # =========================================================================
    # Authenticated HTTP Request Helpers
    # =========================================================================

    async def make_authenticated_request(
        self,
        client: AsyncClient,
        method: str,
        url: str,
        headers: dict[str, str],
        json: dict | None = None,
        **kwargs,
    ) -> Response:
        """Make an authenticated HTTP request.

        Args:
            client: AsyncClient instance
            method: HTTP method (GET, POST, PUT, DELETE, etc.)
            url: Request URL
            headers: Auth headers (from fixtures)
            json: Request body as JSON (optional)
            **kwargs: Additional arguments to pass to client

        Returns:
            Response: HTTP response
        """
        method = method.upper()
        request_func = getattr(client, method.lower())

        if json is not None:
            return await request_func(url, headers=headers, json=json, **kwargs)
        else:
            return await request_func(url, headers=headers, **kwargs)

    async def get_authenticated(
        self,
        client: AsyncClient,
        url: str,
        headers: dict[str, str],
        **kwargs,
    ) -> Response:
        """Make an authenticated GET request.

        Args:
            client: AsyncClient instance
            url: Request URL
            headers: Auth headers

        Returns:
            Response: HTTP response
        """
        return await self.make_authenticated_request(client, "GET", url, headers, **kwargs)

    async def post_authenticated(
        self,
        client: AsyncClient,
        url: str,
        headers: dict[str, str],
        json: dict | None = None,
        **kwargs,
    ) -> Response:
        """Make an authenticated POST request.

        Args:
            client: AsyncClient instance
            url: Request URL
            headers: Auth headers
            json: Request body

        Returns:
            Response: HTTP response
        """
        return await self.make_authenticated_request(
            client, "POST", url, headers, json=json, **kwargs
        )

    async def put_authenticated(
        self,
        client: AsyncClient,
        url: str,
        headers: dict[str, str],
        json: dict | None = None,
        **kwargs,
    ) -> Response:
        """Make an authenticated PUT request.

        Args:
            client: AsyncClient instance
            url: Request URL
            headers: Auth headers
            json: Request body

        Returns:
            Response: HTTP response
        """
        return await self.make_authenticated_request(
            client, "PUT", url, headers, json=json, **kwargs
        )

    async def delete_authenticated(
        self,
        client: AsyncClient,
        url: str,
        headers: dict[str, str],
        **kwargs,
    ) -> Response:
        """Make an authenticated DELETE request.

        Args:
            client: AsyncClient instance
            url: Request URL
            headers: Auth headers

        Returns:
            Response: HTTP response
        """
        return await self.make_authenticated_request(client, "DELETE", url, headers, **kwargs)

    # =========================================================================
    # Authentication Assertion Helpers
    # =========================================================================

    def assert_unauthorized(self, response: Response) -> None:
        """Assert that a response is 401 Unauthorized.

        Args:
            response: HTTP response
        """
        self.assert_response_error(response, 401)

    def assert_forbidden(self, response: Response) -> None:
        """Assert that a response is 403 Forbidden.

        Args:
            response: HTTP response
        """
        self.assert_response_error(response, 403)


# =============================================================================
# Pytest Markers for Test Classes
# =============================================================================

# These can be used as class decorators for automatic marking
unit = pytest.mark.unit
integration = pytest.mark.integration
slow = pytest.mark.slow
auth = pytest.mark.auth
api = pytest.mark.api
db = pytest.mark.db
