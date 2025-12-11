"""Smoke tests to verify E2E infrastructure.

These tests verify that the E2E test infrastructure is working correctly:
- Markers are registered
- Fixtures are available
- Base class methods work
- Basic workflow can be executed

Run with:
    pytest tests/e2e/test_smoke.py -v
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.e2e.conftest import E2ETestCase, StudyEnvironment, UserSession


class TestE2EInfrastructure(E2ETestCase):
    """Verify E2E infrastructure is working correctly."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_marker_registered(self) -> None:
        """Verify @pytest.mark.e2e works without warnings."""
        # If we get here without warnings, the marker is registered
        assert True

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_client_fixture_available(self, client: AsyncClient) -> None:
        """Verify client fixture is available in E2E tests."""
        assert isinstance(client, AsyncClient)

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_db_session_fixture_available(self, db_session: AsyncSession) -> None:
        """Verify db_session fixture is available in E2E tests."""
        assert db_session is not None

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_fresh_user_session_fixture(self, fresh_user_session: UserSession) -> None:
        """Verify fresh_user_session fixture creates valid user session."""
        assert fresh_user_session is not None
        assert fresh_user_session.user is not None
        assert fresh_user_session.headers is not None
        assert "Authorization" in fresh_user_session.headers
        assert fresh_user_session.headers["Authorization"].startswith("Bearer ")

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_admin_session_fixture(self, admin_session: UserSession) -> None:
        """Verify admin_session fixture provides superuser session."""
        assert admin_session is not None
        assert admin_session.user is not None
        assert admin_session.headers is not None
        assert "Authorization" in admin_session.headers
        # Verify superuser flag
        assert admin_session.user.is_superuser is True

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_populated_study_environment_fixture(
        self,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Verify populated_study_environment fixture sets up study session."""
        env = populated_study_environment
        assert env is not None
        assert env.user is not None
        assert env.deck is not None
        assert env.cards is not None
        assert len(env.cards) > 0
        assert "Authorization" in env.headers
        assert env.initialized is True


class TestE2ETestCaseMethods(E2ETestCase):
    """Verify E2ETestCase helper methods work correctly."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_register_and_login(self, client: AsyncClient) -> None:
        """Verify register_and_login creates valid user session."""
        session = await self.register_and_login(client)

        assert session is not None
        assert session.user is not None
        assert session.user.email is not None
        assert "Authorization" in session.headers

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_register_with_custom_data(self, client: AsyncClient) -> None:
        """Verify register_and_login accepts custom user data."""
        session = await self.register_and_login(
            client,
            email="custom_e2e@example.com",
            password="CustomPassword123!",
            full_name="Custom E2E User",
        )

        assert session.user.email == "custom_e2e@example.com"
        assert session.user.full_name == "Custom E2E User"

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_browse_available_decks(
        self,
        client: AsyncClient,
        test_deck_a1,  # Fixture from global conftest
    ) -> None:
        """Verify browse_available_decks returns deck list."""
        session = await self.register_and_login(client)
        decks = await self.browse_available_decks(client, session.headers)

        assert isinstance(decks, list)
        assert len(decks) >= 1  # At least the test_deck_a1

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_login_user(
        self,
        client: AsyncClient,
        test_user,  # Fixture from auth fixtures
    ) -> None:
        """Verify login_user works with existing user."""
        headers = await self.login_user(client, test_user.email)

        assert headers is not None
        assert "Authorization" in headers
        assert headers["Authorization"].startswith("Bearer ")


class TestMinimalWorkflow(E2ETestCase):
    """Test minimal E2E workflow to verify complete setup."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_minimal_workflow_register_browse_study(
        self,
        client: AsyncClient,
        test_deck_a1,
    ) -> None:
        """Minimal E2E workflow: register -> browse -> setup study.

        This test verifies the core E2E infrastructure by executing
        a minimal but complete workflow through the API.
        """
        # Step 1: Register new user
        session = await self.register_and_login(client)
        assert session.user is not None

        # Step 2: Browse available decks
        decks = await self.browse_available_decks(client, session.headers)
        assert len(decks) >= 1

        # Step 3: Setup study session
        queue = await self.setup_study_session(
            client,
            session.headers,
            test_deck_a1.id,
        )

        # Verify queue data structure
        assert queue is not None
        # Queue should have cards or indicate empty/total
        assert "cards" in queue or "total_due" in queue or "new_cards" in queue

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_workflow_with_populated_environment(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test workflow using populated study environment fixture."""
        env = populated_study_environment

        # Environment should be fully initialized
        assert env.initialized

        # Should be able to get study queue
        queue = await client.get(
            f"/api/v1/study/queue/{env.deck.id}",
            headers=env.headers,
        )
        assert queue.status_code == 200
