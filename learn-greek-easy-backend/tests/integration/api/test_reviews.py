"""Integration tests for review API endpoints.

This module provides comprehensive tests for the review endpoints including:
- GET /api/v1/reviews - Get paginated review history
- POST /api/v1/reviews - Submit a single review
- POST /api/v1/reviews/bulk - Submit multiple reviews
"""

from datetime import date, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Review
from tests.fixtures.deck import DeckWithCards


class TestGetReviewHistoryEndpoint:
    """Test suite for GET /api/v1/reviews endpoint."""

    @pytest.mark.asyncio
    async def test_get_review_history_unauthenticated_returns_401(self, client: AsyncClient):
        """Test that unauthenticated request returns 401."""
        response = await client.get("/api/v1/reviews")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_get_review_history_empty(self, client: AsyncClient, auth_headers: dict):
        """Test empty review history returns correct structure."""
        response = await client.get("/api/v1/reviews", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["reviews"] == []
        assert data["page"] == 1
        assert data["page_size"] == 50

    @pytest.mark.asyncio
    async def test_get_review_history_with_data(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
        deck_with_cards: DeckWithCards,
    ):
        """Test returns reviews when data exists."""
        # Create reviews for the user
        for i, card in enumerate(deck_with_cards.cards[:3]):
            review = Review(
                user_id=test_user.id,
                card_id=card.id,
                quality=4,
                time_taken=10 + i,
                reviewed_at=datetime.utcnow() - timedelta(hours=i),
            )
            db_session.add(review)
        await db_session.commit()

        response = await client.get("/api/v1/reviews", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        assert len(data["reviews"]) == 3

    @pytest.mark.asyncio
    async def test_get_review_history_pagination(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
        deck_with_cards: DeckWithCards,
    ):
        """Test pagination works correctly."""
        # Create 5 reviews
        for i in range(5):
            review = Review(
                user_id=test_user.id,
                card_id=deck_with_cards.cards[0].id,
                quality=4,
                time_taken=10,
                reviewed_at=datetime.utcnow() - timedelta(hours=i),
            )
            db_session.add(review)
        await db_session.commit()

        # Get first page of 2
        response = await client.get("/api/v1/reviews?page=1&page_size=2", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert len(data["reviews"]) == 2
        assert data["page"] == 1
        assert data["page_size"] == 2

    @pytest.mark.asyncio
    async def test_get_review_history_second_page(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
        deck_with_cards: DeckWithCards,
    ):
        """Test second page returns different reviews."""
        # Create 5 reviews
        for i in range(5):
            review = Review(
                user_id=test_user.id,
                card_id=deck_with_cards.cards[0].id,
                quality=4,
                time_taken=10,
                reviewed_at=datetime.utcnow() - timedelta(hours=i),
            )
            db_session.add(review)
        await db_session.commit()

        # Get first page
        response_page1 = await client.get(
            "/api/v1/reviews?page=1&page_size=2", headers=auth_headers
        )
        data_page1 = response_page1.json()

        # Get second page
        response_page2 = await client.get(
            "/api/v1/reviews?page=2&page_size=2", headers=auth_headers
        )
        data_page2 = response_page2.json()

        assert response_page2.status_code == 200
        assert data_page2["page"] == 2
        assert len(data_page2["reviews"]) == 2

        # Reviews on page 2 should not be on page 1
        page1_ids = [r["id"] for r in data_page1["reviews"]]
        page2_ids = [r["id"] for r in data_page2["reviews"]]
        assert not set(page1_ids).intersection(set(page2_ids))

    @pytest.mark.asyncio
    async def test_get_review_history_date_filter_start_date(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
        deck_with_cards: DeckWithCards,
    ):
        """Test start_date filter works correctly."""
        # Create old review (10 days ago)
        old_review = Review(
            user_id=test_user.id,
            card_id=deck_with_cards.cards[0].id,
            quality=4,
            time_taken=10,
            reviewed_at=datetime.utcnow() - timedelta(days=10),
        )
        # Create recent review (today)
        recent_review = Review(
            user_id=test_user.id,
            card_id=deck_with_cards.cards[1].id,
            quality=5,
            time_taken=15,
            reviewed_at=datetime.utcnow(),
        )
        db_session.add(old_review)
        db_session.add(recent_review)
        await db_session.commit()

        # Filter by start_date (last 5 days)
        start_date = (date.today() - timedelta(days=5)).isoformat()
        response = await client.get(
            f"/api/v1/reviews?start_date={start_date}", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["reviews"]) == 1

    @pytest.mark.asyncio
    async def test_get_review_history_date_filter_end_date(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
        deck_with_cards: DeckWithCards,
    ):
        """Test end_date filter works correctly."""
        # Create old review (10 days ago)
        old_review = Review(
            user_id=test_user.id,
            card_id=deck_with_cards.cards[0].id,
            quality=4,
            time_taken=10,
            reviewed_at=datetime.utcnow() - timedelta(days=10),
        )
        # Create recent review (today)
        recent_review = Review(
            user_id=test_user.id,
            card_id=deck_with_cards.cards[1].id,
            quality=5,
            time_taken=15,
            reviewed_at=datetime.utcnow(),
        )
        db_session.add(old_review)
        db_session.add(recent_review)
        await db_session.commit()

        # Filter by end_date (5 days ago)
        end_date = (date.today() - timedelta(days=5)).isoformat()
        response = await client.get(f"/api/v1/reviews?end_date={end_date}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["reviews"]) == 1

    @pytest.mark.asyncio
    async def test_get_review_history_date_range_filter(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
        deck_with_cards: DeckWithCards,
    ):
        """Test both start_date and end_date filter together."""
        # Create reviews at different times
        very_old = Review(
            user_id=test_user.id,
            card_id=deck_with_cards.cards[0].id,
            quality=3,
            time_taken=10,
            reviewed_at=datetime.utcnow() - timedelta(days=15),
        )
        mid = Review(
            user_id=test_user.id,
            card_id=deck_with_cards.cards[1].id,
            quality=4,
            time_taken=10,
            reviewed_at=datetime.utcnow() - timedelta(days=7),
        )
        recent = Review(
            user_id=test_user.id,
            card_id=deck_with_cards.cards[2].id,
            quality=5,
            time_taken=10,
            reviewed_at=datetime.utcnow(),
        )
        db_session.add(very_old)
        db_session.add(mid)
        db_session.add(recent)
        await db_session.commit()

        # Filter date range (10 days ago to 5 days ago)
        start_date = (date.today() - timedelta(days=10)).isoformat()
        end_date = (date.today() - timedelta(days=5)).isoformat()
        response = await client.get(
            f"/api/v1/reviews?start_date={start_date}&end_date={end_date}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["reviews"]) == 1

    @pytest.mark.asyncio
    async def test_get_review_history_user_isolation(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
        deck_with_cards: DeckWithCards,
        two_users,
    ):
        """Test that users can only see their own reviews."""
        user1, user2 = two_users

        # Create review for user1 (test_user is same as user1 from two_users in most cases)
        review_user1 = Review(
            user_id=test_user.id,
            card_id=deck_with_cards.cards[0].id,
            quality=4,
            time_taken=10,
            reviewed_at=datetime.utcnow(),
        )
        # Create review for user2
        review_user2 = Review(
            user_id=user2.id,
            card_id=deck_with_cards.cards[1].id,
            quality=5,
            time_taken=15,
            reviewed_at=datetime.utcnow(),
        )
        db_session.add(review_user1)
        db_session.add(review_user2)
        await db_session.commit()

        # Request with test_user's auth headers should only see test_user's reviews
        response = await client.get("/api/v1/reviews", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        # Should only see reviews for the authenticated user
        for review in data["reviews"]:
            assert review["user_id"] == str(test_user.id)

    @pytest.mark.asyncio
    async def test_get_review_history_invalid_page_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that page=0 returns 422."""
        response = await client.get("/api/v1/reviews?page=0", headers=auth_headers)

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_get_review_history_invalid_page_size_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that page_size > 100 returns 422."""
        response = await client.get("/api/v1/reviews?page_size=101", headers=auth_headers)

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_get_review_history_invalid_date_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test that invalid date format returns 422."""
        response = await client.get("/api/v1/reviews?start_date=not-a-date", headers=auth_headers)

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_get_review_history_returns_in_reverse_chronological_order(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
        deck_with_cards: DeckWithCards,
    ):
        """Test that reviews are returned most recent first."""
        # Create reviews with known order
        review1 = Review(
            user_id=test_user.id,
            card_id=deck_with_cards.cards[0].id,
            quality=3,
            time_taken=10,
            reviewed_at=datetime.utcnow() - timedelta(hours=2),
        )
        review2 = Review(
            user_id=test_user.id,
            card_id=deck_with_cards.cards[1].id,
            quality=4,
            time_taken=10,
            reviewed_at=datetime.utcnow() - timedelta(hours=1),
        )
        review3 = Review(
            user_id=test_user.id,
            card_id=deck_with_cards.cards[2].id,
            quality=5,
            time_taken=10,
            reviewed_at=datetime.utcnow(),
        )
        db_session.add(review1)
        db_session.add(review2)
        db_session.add(review3)
        await db_session.commit()
        await db_session.refresh(review1)
        await db_session.refresh(review2)
        await db_session.refresh(review3)

        response = await client.get("/api/v1/reviews", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        reviews = data["reviews"]
        assert len(reviews) == 3

        # Most recent first (review3, then review2, then review1)
        assert reviews[0]["id"] == str(review3.id)
        assert reviews[1]["id"] == str(review2.id)
        assert reviews[2]["id"] == str(review1.id)

    @pytest.mark.asyncio
    async def test_get_review_history_response_fields(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
        deck_with_cards: DeckWithCards,
    ):
        """Test that response includes all expected fields."""
        review = Review(
            user_id=test_user.id,
            card_id=deck_with_cards.cards[0].id,
            quality=4,
            time_taken=15,
            reviewed_at=datetime.utcnow(),
        )
        db_session.add(review)
        await db_session.commit()
        await db_session.refresh(review)

        response = await client.get("/api/v1/reviews", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        review_data = data["reviews"][0]

        # Check all expected fields
        assert "id" in review_data
        assert "user_id" in review_data
        assert "card_id" in review_data
        assert "quality" in review_data
        assert "time_taken" in review_data
        assert "reviewed_at" in review_data

        # Verify values
        assert review_data["id"] == str(review.id)
        assert review_data["user_id"] == str(test_user.id)
        assert review_data["card_id"] == str(deck_with_cards.cards[0].id)
        assert review_data["quality"] == 4
        assert review_data["time_taken"] == 15
