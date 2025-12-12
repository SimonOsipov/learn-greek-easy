"""E2E tests for new user onboarding journey.

This module tests the complete new user experience from registration
through first study session, validating that all API endpoints work
together correctly.

Test Classes:
- TestCompleteOnboardingFlow: Full registration to first review
- TestNewUserEmptyProgress: Empty progress state validation
- TestFirstReviewMetrics: First review updates all metrics
- TestDeckAccessPatterns: Authenticated vs unauthenticated access
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardStatistics, CardStatus, Review, User, UserSettings
from tests.e2e.conftest import E2ETestCase
from tests.factories import CardFactory, DeckFactory


@pytest.mark.e2e
class TestCompleteOnboardingFlow(E2ETestCase):
    """Test complete new user journey from registration to first review."""

    @pytest.mark.asyncio
    async def test_complete_onboarding_flow(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """
        Test: Register -> Login -> Browse Decks -> Initialize -> Review

        This test validates the entire new user onboarding experience,
        ensuring all API endpoints work together correctly.
        """
        # Setup: Create a deck with cards for testing
        # Note: factories use bind_factory_session fixture from e2e/conftest.py
        deck = await DeckFactory.create(session=db_session, name="A1 Greek Basics")
        # Create cards for the deck (cards variable unused but needed for test setup)
        await CardFactory.create_batch(
            session=db_session,
            size=10,
            deck_id=deck.id,
        )

        # Generate unique email to avoid conflicts
        unique_email = f"newuser_{uuid4().hex[:8]}@example.com"

        # Step 1: Register new user
        register_data = {
            "email": unique_email,
            "password": "SecurePass123!",
            "full_name": "New Greek Learner",
        }
        register_response = await client.post(
            "/api/v1/auth/register",
            json=register_data,
        )
        assert (
            register_response.status_code == 201
        ), f"Registration failed: {register_response.json()}"
        register_result = register_response.json()
        assert "access_token" in register_result
        assert "refresh_token" in register_result
        assert register_result["token_type"] == "bearer"

        # Verify user created in database
        user_query = await db_session.execute(select(User).where(User.email == unique_email))
        user = user_query.scalar_one()
        assert user.is_active is True
        assert user.full_name == "New Greek Learner"

        # Verify UserSettings created with defaults
        settings_query = await db_session.execute(
            select(UserSettings).where(UserSettings.user_id == user.id)
        )
        settings = settings_query.scalar_one()
        assert settings.daily_goal == 20
        assert settings.email_notifications is True

        # Step 2: Login with credentials
        login_response = await client.post(
            "/api/v1/auth/login",
            json={"email": unique_email, "password": "SecurePass123!"},
        )
        assert login_response.status_code == 200
        login_result = login_response.json()
        access_token = login_result["access_token"]
        auth_headers = {"Authorization": f"Bearer {access_token}"}

        # Step 3: Browse available decks
        decks_response = await client.get("/api/v1/decks", headers=auth_headers)
        assert decks_response.status_code == 200
        decks_data = decks_response.json()
        assert "decks" in decks_data
        assert len(decks_data["decks"]) >= 1

        # Step 4: View deck details
        deck_response = await client.get(
            f"/api/v1/decks/{deck.id}",
            headers=auth_headers,
        )
        assert deck_response.status_code == 200
        deck_data = deck_response.json()
        assert deck_data["name"] == "A1 Greek Basics"

        # Step 5: Initialize study session
        init_response = await client.post(
            f"/api/v1/study/initialize/{deck.id}",
            headers=auth_headers,
        )
        assert init_response.status_code == 200
        init_result = init_response.json()
        assert init_result["initialized_count"] == 10  # All cards initialized
        assert init_result["already_exists_count"] == 0

        # Verify CardStatistics created for all cards
        stats_count = await db_session.scalar(
            select(func.count())
            .select_from(CardStatistics)
            .where(CardStatistics.user_id == user.id)
        )
        assert stats_count == 10

        # Step 6: Get study queue
        # Note: After initialization, all cards have CardStatistics with status=NEW.
        # total_new counts cards WITHOUT statistics, so it's 0.
        # Cards appear in queue with status="new" showing they're ready to study.
        queue_response = await client.get(
            f"/api/v1/study/queue/{deck.id}?include_new=true",
            headers=auth_headers,
        )
        assert queue_response.status_code == 200
        queue_data = queue_response.json()
        # Cards are in queue with status="new" (just initialized)
        assert len(queue_data["cards"]) > 0
        new_cards_in_queue = [c for c in queue_data["cards"] if c["status"] == "new"]
        assert len(new_cards_in_queue) == 10  # All cards have status=new

        # Get first card for review
        first_card = queue_data["cards"][0]
        card_id = first_card["card_id"]

        # Step 7: Submit first review
        review_response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": card_id,
                "quality": 4,  # Good recall
                "time_taken": 5,
            },
            headers=auth_headers,
        )
        assert review_response.status_code == 200
        review_result = review_response.json()
        assert review_result["success"] is True
        assert review_result["card_id"] == card_id
        assert review_result["new_status"] in ["learning", "review"]

        # Verify Review created in database
        review_query = await db_session.execute(
            select(Review).where(
                Review.user_id == user.id,
                Review.card_id == card_id,
            )
        )
        review = review_query.scalar_one()
        assert review.quality == 4

        # Verify CardStatistics updated
        stats_query = await db_session.execute(
            select(CardStatistics).where(
                CardStatistics.user_id == user.id,
                CardStatistics.card_id == card_id,
            )
        )
        card_stats = stats_query.scalar_one()
        assert card_stats.status == CardStatus.LEARNING
        assert card_stats.repetitions == 1

        # Step 8: Verify progress updated
        progress_response = await client.get(
            "/api/v1/progress/dashboard",
            headers=auth_headers,
        )
        assert progress_response.status_code == 200
        progress_data = progress_response.json()

        # Verify metrics updated
        assert progress_data["overview"]["total_decks_started"] >= 1
        assert progress_data["today"]["reviews_completed"] >= 1
        assert progress_data["cards_by_status"]["learning"] >= 1


@pytest.mark.e2e
class TestNewUserEmptyProgress(E2ETestCase):
    """Test that new users see valid empty progress data."""

    @pytest.mark.asyncio
    async def test_new_user_empty_progress_dashboard(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Test: New user gets dashboard with zero/default values."""
        # Register new user
        unique_email = f"empty_progress_{uuid4().hex[:8]}@example.com"
        register_response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": unique_email,
                "password": "SecurePass123!",
                "full_name": "Empty Progress User",
            },
        )
        assert register_response.status_code == 201
        access_token = register_response.json()["access_token"]
        auth_headers = {"Authorization": f"Bearer {access_token}"}

        # Get progress dashboard immediately (no activity yet)
        progress_response = await client.get(
            "/api/v1/progress/dashboard",
            headers=auth_headers,
        )
        assert progress_response.status_code == 200
        data = progress_response.json()

        # Verify all overview metrics are zero
        assert data["overview"]["total_cards_studied"] == 0
        assert data["overview"]["total_cards_mastered"] == 0
        assert data["overview"]["total_decks_started"] == 0
        assert data["overview"]["overall_mastery_percentage"] == 0

        # Verify today metrics are zero (except daily_goal)
        assert data["today"]["reviews_completed"] == 0
        assert data["today"]["cards_due"] == 0
        assert data["today"]["daily_goal"] == 20  # Default from UserSettings
        assert data["today"]["goal_progress_percentage"] == 0

        # Verify streak data
        assert data["streak"]["current_streak"] == 0
        assert data["streak"]["longest_streak"] == 0
        assert data["streak"]["last_study_date"] is None

        # Verify cards_by_status all zero
        assert data["cards_by_status"]["new"] == 0
        assert data["cards_by_status"]["learning"] == 0
        assert data["cards_by_status"]["review"] == 0
        assert data["cards_by_status"]["mastered"] == 0

        # Verify recent_activity is empty list
        assert data["recent_activity"] == []

    @pytest.mark.asyncio
    async def test_new_user_empty_deck_progress_list(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Test: New user gets empty deck progress list."""
        unique_email = f"no_decks_{uuid4().hex[:8]}@example.com"
        register_response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": unique_email,
                "password": "SecurePass123!",
                "full_name": "No Decks User",
            },
        )
        access_token = register_response.json()["access_token"]
        auth_headers = {"Authorization": f"Bearer {access_token}"}

        # Get deck progress list
        decks_response = await client.get(
            "/api/v1/progress/decks",
            headers=auth_headers,
        )
        assert decks_response.status_code == 200
        data = decks_response.json()

        assert data["total"] == 0
        assert data["decks"] == []
        assert data["page"] == 1


@pytest.mark.e2e
class TestFirstReviewMetrics(E2ETestCase):
    """Test that first review correctly updates all metrics."""

    @pytest.mark.asyncio
    async def test_first_review_updates_all_metrics(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Test: First review updates stats, progress, and card status."""
        # Setup: Create deck with cards
        deck = await DeckFactory.create(session=db_session)
        # Create cards for the deck (needed for test setup)
        await CardFactory.create_batch(
            session=db_session,
            size=5,
            deck_id=deck.id,
        )

        # Register and login
        unique_email = f"first_review_{uuid4().hex[:8]}@example.com"
        register_response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": unique_email,
                "password": "SecurePass123!",
                "full_name": "First Review User",
            },
        )
        access_token = register_response.json()["access_token"]
        auth_headers = {"Authorization": f"Bearer {access_token}"}

        # Get user for DB assertions
        user_query = await db_session.execute(select(User).where(User.email == unique_email))
        user = user_query.scalar_one()

        # Initialize study session
        await client.post(
            f"/api/v1/study/initialize/{deck.id}",
            headers=auth_headers,
        )

        # Capture initial queue state
        # Note: After initialize_deck, all cards have CardStatistics with status=NEW.
        # total_new counts cards WITHOUT statistics (not yet initialized), so it's 0.
        # The queue cards show status="new" for newly initialized cards.
        initial_queue = await client.get(
            f"/api/v1/study/queue/{deck.id}?include_new=true",
            headers=auth_headers,
        )
        initial_queue_data = initial_queue.json()
        # After initialization, cards are in the queue with status="new"
        # They are counted as due since they have statistics now
        assert initial_queue_data["total_in_queue"] >= 1
        initial_cards = initial_queue_data["cards"]
        assert len(initial_cards) >= 1
        # Verify cards have status "new" (just initialized)
        new_status_cards = [c for c in initial_cards if c["status"] == "new"]
        assert len(new_status_cards) >= 1

        # Get card to review
        card_id = initial_cards[0]["card_id"]

        # Submit first review
        review_response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": card_id,
                "quality": 4,
                "time_taken": 5,
            },
            headers=auth_headers,
        )
        assert review_response.status_code == 200

        # Verify all metrics updated

        # 1. Progress dashboard
        progress = await client.get(
            "/api/v1/progress/dashboard",
            headers=auth_headers,
        )
        progress_data = progress.json()
        assert progress_data["today"]["reviews_completed"] == 1
        assert progress_data["overview"]["total_decks_started"] >= 1
        assert progress_data["cards_by_status"]["learning"] >= 1

        # 2. Study stats
        stats = await client.get(
            "/api/v1/study/stats",
            headers=auth_headers,
        )
        stats_data = stats.json()
        assert stats_data["reviews_today"] == 1
        assert stats_data["total_reviews"] == 1

        # 3. Review history
        history = await client.get(
            "/api/v1/reviews",
            headers=auth_headers,
        )
        history_data = history.json()
        assert history_data["total"] == 1

        # 4. Updated queue (reviewed card status changed from "new" to "learning")
        updated_queue = await client.get(
            f"/api/v1/study/queue/{deck.id}?include_new=true",
            headers=auth_headers,
        )
        updated_queue_data = updated_queue.json()
        # After review, the card's status changes to "learning"
        # So there should be one less card with status="new"
        updated_new_cards = [c for c in updated_queue_data["cards"] if c["status"] == "new"]
        assert len(updated_new_cards) == len(new_status_cards) - 1

        # 5. Database state
        await db_session.refresh(user)  # Refresh to get latest state
        card_stats_query = await db_session.execute(
            select(CardStatistics).where(
                CardStatistics.user_id == user.id,
                CardStatistics.card_id == card_id,
            )
        )
        stats_record = card_stats_query.scalar_one()
        assert stats_record.status == CardStatus.LEARNING
        assert stats_record.repetitions == 1


@pytest.mark.e2e
class TestDeckAccessPatterns(E2ETestCase):
    """Test deck access patterns for public vs authenticated-only endpoints.

    Note: Deck list and detail endpoints are public (no auth required).
    Only administrative actions (create, update, delete) require authentication.
    """

    @pytest.mark.asyncio
    async def test_public_can_browse_decks(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Test: Public (unauthenticated) users can browse available decks.

        The deck list endpoint is intentionally public to allow users
        to see available content before registering.
        """
        # Create a deck for testing (deck variable unused but needed for DB setup)
        await DeckFactory.create(
            session=db_session,
            name="Public Deck",
            is_active=True,
        )

        # No auth headers - public access
        response = await client.get("/api/v1/decks")
        assert response.status_code == 200
        data = response.json()
        assert "decks" in data
        # Should include our active deck
        deck_names = [d["name"] for d in data["decks"]]
        assert "Public Deck" in deck_names

    @pytest.mark.asyncio
    async def test_public_can_view_deck_detail(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Test: Public users can view specific deck details."""
        # Create a deck
        deck = await DeckFactory.create(
            session=db_session,
            name="Test Deck",
            is_active=True,
        )

        # No auth headers - public access
        response = await client.get(f"/api/v1/decks/{deck.id}")
        assert response.status_code == 200
        assert response.json()["name"] == "Test Deck"

    @pytest.mark.asyncio
    async def test_study_endpoints_require_authentication(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Test: Study-related endpoints require authentication.

        While deck browsing is public, actually studying requires login.
        """
        deck = await DeckFactory.create(
            session=db_session,
            name="Study Deck",
            is_active=True,
        )

        # Study initialization requires auth
        init_response = await client.post(f"/api/v1/study/initialize/{deck.id}")
        assert init_response.status_code == 401

        # Study queue requires auth
        queue_response = await client.get(f"/api/v1/study/queue/{deck.id}")
        assert queue_response.status_code == 401

        # Study stats require auth
        stats_response = await client.get("/api/v1/study/stats")
        assert stats_response.status_code == 401

    @pytest.mark.asyncio
    async def test_authenticated_user_can_study_decks(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Test: Authenticated user can browse and study decks."""
        # Create a deck
        deck = await DeckFactory.create(
            session=db_session,
            name="Study Ready Deck",
            is_active=True,
        )
        await CardFactory.create_batch(
            session=db_session,
            size=5,
            deck_id=deck.id,
        )

        # Register and get auth
        unique_email = f"deck_browser_{uuid4().hex[:8]}@example.com"
        register_response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": unique_email,
                "password": "SecurePass123!",
                "full_name": "Deck Browser",
            },
        )
        auth_headers = {"Authorization": f"Bearer {register_response.json()['access_token']}"}

        # Can list decks (also works without auth)
        list_response = await client.get("/api/v1/decks", headers=auth_headers)
        assert list_response.status_code == 200
        assert len(list_response.json()["decks"]) >= 1

        # Can view specific deck
        detail_response = await client.get(
            f"/api/v1/decks/{deck.id}",
            headers=auth_headers,
        )
        assert detail_response.status_code == 200
        assert detail_response.json()["name"] == "Study Ready Deck"

        # Can initialize study session (requires auth)
        init_response = await client.post(
            f"/api/v1/study/initialize/{deck.id}",
            headers=auth_headers,
        )
        assert init_response.status_code == 200

    @pytest.mark.asyncio
    async def test_inactive_deck_not_visible(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Test: Inactive decks are not visible to regular users."""
        # Create inactive deck
        inactive_deck = await DeckFactory.create(
            session=db_session,
            name="Inactive Deck",
            is_active=False,
        )

        # Inactive deck should return 404 on direct access (even for public)
        detail_response = await client.get(
            f"/api/v1/decks/{inactive_deck.id}",
        )
        # Should be 404 for inactive decks
        assert detail_response.status_code == 404
