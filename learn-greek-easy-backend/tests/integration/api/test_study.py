"""Integration tests for study API endpoints.

This module provides comprehensive tests for the study endpoints including:
- GET /api/v1/study/queue - Get study queue across all decks
- GET /api/v1/study/queue/{deck_id} - Get study queue for a specific deck
- GET /api/v1/study/stats - Get study statistics
- POST /api/v1/study/initialize - Initialize specific cards for study
- POST /api/v1/study/initialize/{deck_id} - Initialize all cards in a deck
"""

from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardStatistics, CardStatus, Review
from tests.fixtures.deck import DeckWithCards


class TestGetStudyStatsEndpoint:
    """Test suite for GET /api/v1/study/stats endpoint."""

    @pytest.mark.asyncio
    async def test_get_study_stats_unauthenticated_returns_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        response = await client.get("/api/v1/study/stats")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_get_study_stats_empty(self, client: AsyncClient, auth_headers: dict):
        """Test stats for user with no reviews."""
        response = await client.get("/api/v1/study/stats", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["reviews_today"] == 0
        assert data["current_streak"] == 0
        assert data["total_reviews"] == 0
        assert data["total_study_time"] == 0

    @pytest.mark.asyncio
    async def test_get_study_stats_with_data(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
        deck_with_cards: DeckWithCards,
    ):
        """Test stats with review data."""
        # Create card statistics
        for card in deck_with_cards.cards[:3]:
            stats = CardStatistics(
                user_id=test_user.id,
                card_id=card.id,
                easiness_factor=2.5,
                interval=1,
                repetitions=1,
                next_review_date=datetime.utcnow().date(),
                status=CardStatus.LEARNING,
            )
            db_session.add(stats)

        # Create reviews
        for card in deck_with_cards.cards[:3]:
            review = Review(
                user_id=test_user.id,
                card_id=card.id,
                quality=4,
                time_taken=30,
                reviewed_at=datetime.utcnow(),
            )
            db_session.add(review)
        await db_session.commit()

        response = await client.get("/api/v1/study/stats", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["reviews_today"] == 3
        assert data["total_reviews"] == 3
        assert data["total_study_time"] == 90  # 3 * 30 seconds
        assert "by_status" in data
        assert data["by_status"]["learning"] == 3

    @pytest.mark.asyncio
    async def test_get_study_stats_response_fields(self, client: AsyncClient, auth_headers: dict):
        """Test that response includes all expected fields."""
        response = await client.get("/api/v1/study/stats", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        # Check all required fields are present
        assert "by_status" in data
        assert "reviews_today" in data
        assert "current_streak" in data
        assert "due_today" in data
        assert "total_reviews" in data
        assert "total_study_time" in data
        assert "average_quality" in data

        # Check by_status has all status keys
        assert "new" in data["by_status"]
        assert "learning" in data["by_status"]
        assert "review" in data["by_status"]
        assert "mastered" in data["by_status"]
        assert "due" in data["by_status"]

    @pytest.mark.asyncio
    async def test_get_study_stats_user_isolation(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
        deck_with_cards: DeckWithCards,
        two_users,
    ):
        """Test that users can only see their own stats."""
        user1, user2 = two_users

        # Create reviews for test_user (user1)
        for i, card in enumerate(deck_with_cards.cards[:2]):
            review = Review(
                user_id=test_user.id,
                card_id=card.id,
                quality=4,
                time_taken=20,
                reviewed_at=datetime.utcnow(),
            )
            db_session.add(review)

        # Create reviews for user2
        for card in deck_with_cards.cards[2:5]:
            review = Review(
                user_id=user2.id,
                card_id=card.id,
                quality=5,
                time_taken=15,
                reviewed_at=datetime.utcnow(),
            )
            db_session.add(review)
        await db_session.commit()

        # Request with test_user's auth headers should only see test_user's stats
        response = await client.get("/api/v1/study/stats", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        # Should only see 2 reviews (test_user's), not 3 (user2's)
        assert data["total_reviews"] == 2
        assert data["total_study_time"] == 40  # 2 * 20 seconds

    @pytest.mark.asyncio
    async def test_get_study_stats_with_streak(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
        deck_with_cards: DeckWithCards,
    ):
        """Test that study streak is calculated correctly."""
        # Create reviews for the last 3 consecutive days
        for days_ago in range(3):
            review = Review(
                user_id=test_user.id,
                card_id=deck_with_cards.cards[0].id,
                quality=4,
                time_taken=30,
                reviewed_at=datetime.utcnow() - timedelta(days=days_ago),
            )
            db_session.add(review)
        await db_session.commit()

        response = await client.get("/api/v1/study/stats", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["current_streak"] == 3

    @pytest.mark.asyncio
    async def test_get_study_stats_average_quality(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
        deck_with_cards: DeckWithCards,
    ):
        """Test that average quality is calculated correctly."""
        # Create reviews with known quality values: 3, 4, 5 = avg 4.0
        for i, card in enumerate(deck_with_cards.cards[:3]):
            review = Review(
                user_id=test_user.id,
                card_id=card.id,
                quality=3 + i,  # 3, 4, 5
                time_taken=30,
                reviewed_at=datetime.utcnow(),
            )
            db_session.add(review)
        await db_session.commit()

        response = await client.get("/api/v1/study/stats", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["average_quality"] == 4.0

    @pytest.mark.asyncio
    async def test_get_study_stats_invalid_deck_id_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that invalid deck_id format returns 422."""
        response = await client.get(
            "/api/v1/study/stats?deck_id=not-a-uuid",
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"


class TestGetStudyQueueEndpoint:
    """Test suite for GET /api/v1/study/queue endpoint."""

    @pytest.mark.asyncio
    async def test_get_study_queue_unauthenticated_returns_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        response = await client.get("/api/v1/study/queue")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_get_study_queue_empty(self, client: AsyncClient, auth_headers: dict):
        """Test empty queue returns correct structure."""
        response = await client.get("/api/v1/study/queue", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "deck_id" in data
        assert "deck_name" in data
        assert "total_due" in data
        assert "total_new" in data
        assert "total_in_queue" in data
        assert "cards" in data


class TestGetDeckStudyQueueEndpoint:
    """Test suite for GET /api/v1/study/queue/{deck_id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_deck_study_queue_unauthenticated_returns_401(
        self, client: AsyncClient, deck_with_cards: DeckWithCards
    ):
        """Test that unauthenticated request returns 401."""
        response = await client.get(f"/api/v1/study/queue/{deck_with_cards.deck.id}")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False


class TestInitializeCardsEndpoint:
    """Test suite for POST /api/v1/study/initialize endpoint."""

    @pytest.mark.asyncio
    async def test_initialize_cards_unauthenticated_returns_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        response = await client.post(
            "/api/v1/study/initialize",
            json={
                "deck_id": "660e8400-e29b-41d4-a716-446655440001",
                "card_ids": ["550e8400-e29b-41d4-a716-446655440000"],
            },
        )

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_initialize_cards_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
        deck_with_cards: DeckWithCards,
    ):
        """Test successful card initialization."""
        card_ids = [str(card.id) for card in deck_with_cards.cards[:3]]
        response = await client.post(
            "/api/v1/study/initialize",
            json={
                "deck_id": str(deck_with_cards.deck.id),
                "card_ids": card_ids,
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["initialized_count"] == 3
        assert data["already_exists_count"] == 0
        assert len(data["card_ids"]) == 3

    @pytest.mark.asyncio
    async def test_initialize_cards_already_initialized(
        self,
        client: AsyncClient,
        auth_headers: dict,
        deck_with_cards: DeckWithCards,
    ):
        """Test that already-initialized cards are handled gracefully."""
        # First initialization
        card_ids = [str(card.id) for card in deck_with_cards.cards[:2]]
        await client.post(
            "/api/v1/study/initialize",
            json={
                "deck_id": str(deck_with_cards.deck.id),
                "card_ids": card_ids,
            },
            headers=auth_headers,
        )

        # Second initialization with same cards
        response = await client.post(
            "/api/v1/study/initialize",
            json={
                "deck_id": str(deck_with_cards.deck.id),
                "card_ids": card_ids,
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["initialized_count"] == 0
        assert data["already_exists_count"] == 2

    @pytest.mark.asyncio
    async def test_initialize_cards_mixed_new_and_existing(
        self,
        client: AsyncClient,
        auth_headers: dict,
        deck_with_cards: DeckWithCards,
    ):
        """Test initialization with mix of new and existing cards."""
        # First initialize 2 cards
        first_batch = [str(card.id) for card in deck_with_cards.cards[:2]]
        await client.post(
            "/api/v1/study/initialize",
            json={
                "deck_id": str(deck_with_cards.deck.id),
                "card_ids": first_batch,
            },
            headers=auth_headers,
        )

        # Then initialize 4 cards (2 existing + 2 new)
        second_batch = [str(card.id) for card in deck_with_cards.cards[:4]]
        response = await client.post(
            "/api/v1/study/initialize",
            json={
                "deck_id": str(deck_with_cards.deck.id),
                "card_ids": second_batch,
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["initialized_count"] == 2  # Only 2 new cards
        assert data["already_exists_count"] == 2  # 2 already existed

    @pytest.mark.asyncio
    async def test_initialize_cards_invalid_deck_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that invalid deck_id returns 404."""
        response = await client.post(
            "/api/v1/study/initialize",
            json={
                "deck_id": "00000000-0000-0000-0000-000000000000",
                "card_ids": ["550e8400-e29b-41d4-a716-446655440000"],
            },
            headers=auth_headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_initialize_cards_response_fields(
        self,
        client: AsyncClient,
        auth_headers: dict,
        deck_with_cards: DeckWithCards,
    ):
        """Test that response includes all expected fields."""
        card_ids = [str(card.id) for card in deck_with_cards.cards[:2]]
        response = await client.post(
            "/api/v1/study/initialize",
            json={
                "deck_id": str(deck_with_cards.deck.id),
                "card_ids": card_ids,
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Check all required fields are present
        assert "initialized_count" in data
        assert "already_exists_count" in data
        assert "card_ids" in data
        assert isinstance(data["card_ids"], list)


class TestInitializeDeckEndpoint:
    """Test suite for POST /api/v1/study/initialize/{deck_id} endpoint."""

    @pytest.mark.asyncio
    async def test_initialize_deck_unauthenticated_returns_401(
        self,
        client: AsyncClient,
        deck_with_cards: DeckWithCards,
    ):
        """Test that unauthenticated request returns 401."""
        response = await client.post(f"/api/v1/study/initialize/{deck_with_cards.deck.id}")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_initialize_deck_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
        deck_with_cards: DeckWithCards,
    ):
        """Test successful deck initialization."""
        response = await client.post(
            f"/api/v1/study/initialize/{deck_with_cards.deck.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["initialized_count"] == len(deck_with_cards.cards)
        assert data["already_exists_count"] == 0

    @pytest.mark.asyncio
    async def test_initialize_deck_already_initialized(
        self,
        client: AsyncClient,
        auth_headers: dict,
        deck_with_cards: DeckWithCards,
    ):
        """Test that already-initialized deck is handled gracefully."""
        # First initialization
        await client.post(
            f"/api/v1/study/initialize/{deck_with_cards.deck.id}",
            headers=auth_headers,
        )

        # Second initialization
        response = await client.post(
            f"/api/v1/study/initialize/{deck_with_cards.deck.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["initialized_count"] == 0
        assert data["already_exists_count"] == len(deck_with_cards.cards)

    @pytest.mark.asyncio
    async def test_initialize_deck_nonexistent_returns_empty_result(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that non-existent deck returns empty result (graceful handling)."""
        response = await client.post(
            "/api/v1/study/initialize/00000000-0000-0000-0000-000000000000",
            headers=auth_headers,
        )

        # Service returns empty result for non-existent deck rather than 404
        assert response.status_code == 200
        data = response.json()
        assert data["initialized_count"] == 0
        assert data["already_exists_count"] == 0
        assert data["card_ids"] == []

    @pytest.mark.asyncio
    async def test_initialize_deck_response_fields(
        self,
        client: AsyncClient,
        auth_headers: dict,
        deck_with_cards: DeckWithCards,
    ):
        """Test that response includes all expected fields."""
        response = await client.post(
            f"/api/v1/study/initialize/{deck_with_cards.deck.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Check all required fields are present
        assert "initialized_count" in data
        assert "already_exists_count" in data
        assert "card_ids" in data
        assert isinstance(data["card_ids"], list)

    @pytest.mark.asyncio
    async def test_initialize_deck_partial_initialized(
        self,
        client: AsyncClient,
        auth_headers: dict,
        deck_with_cards: DeckWithCards,
    ):
        """Test deck initialization when some cards already initialized."""
        # First initialize only some cards
        some_card_ids = [str(card.id) for card in deck_with_cards.cards[:3]]
        await client.post(
            "/api/v1/study/initialize",
            json={
                "deck_id": str(deck_with_cards.deck.id),
                "card_ids": some_card_ids,
            },
            headers=auth_headers,
        )

        # Then initialize entire deck
        response = await client.post(
            f"/api/v1/study/initialize/{deck_with_cards.deck.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        # Should only initialize remaining cards
        remaining_count = len(deck_with_cards.cards) - 3
        assert data["initialized_count"] == remaining_count
        assert data["already_exists_count"] == 3
