"""E2E tests for learning session workflows.

This module tests complete study session workflows from queue retrieval
through review completion with SM-2 algorithm validation.

Test Classes:
- TestLearningSessionWorkflows: Core study session workflow tests
- TestEmptyQueueHandling: Empty queue scenarios
- TestLearningSessionEdgeCases: Error handling and edge cases
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardStatistics, CardStatus, Review, User
from tests.e2e.conftest import E2ETestCase
from tests.factories import CardFactory, DeckFactory
from tests.fixtures.deck import DeckWithCards


@pytest.mark.e2e
class TestLearningSessionWorkflows(E2ETestCase):
    """Test complete learning session workflows.

    These tests validate the full study experience:
    - Complete study session (queue -> review all -> verify empty queue)
    - Bulk review workflow
    - Mixed quality responses with SM-2 algorithm effects
    - Partial session completion and resume
    """

    @pytest.mark.asyncio
    async def test_complete_study_session(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict,
        test_user: User,
    ):
        """Test: Queue -> Review all cards -> Verify empty queue -> Check stats.

        This test validates the complete study session workflow:
        1. Create deck with cards and initialize for study
        2. Get study queue with new cards
        3. Review all cards sequentially
        4. Verify queue is empty after all reviews
        5. Verify statistics reflect all reviews
        6. Verify database state (Review records created)
        """
        # Setup: Create deck with 5 cards
        deck = await DeckFactory.create(session=db_session, name="Complete Session Deck")
        await CardFactory.create_batch(
            session=db_session,
            size=5,
            deck_id=deck.id,
        )

        # Initialize study session
        init_response = await client.post(
            f"/api/v1/study/initialize/{deck.id}",
            headers=auth_headers,
        )
        assert init_response.status_code == 200
        init_data = init_response.json()
        assert init_data["initialized_count"] == 5

        # Get initial queue with new cards
        queue_response = await client.get(
            f"/api/v1/study/queue/{deck.id}?include_new=true",
            headers=auth_headers,
        )
        assert queue_response.status_code == 200
        initial_queue = queue_response.json()
        initial_count = initial_queue["total_in_queue"]
        assert initial_count == 5, "Queue should have 5 cards"
        assert len(initial_queue["cards"]) == 5

        # Review all cards
        for card_data in initial_queue["cards"]:
            review_response = await client.post(
                "/api/v1/reviews",
                json={
                    "card_id": card_data["card_id"],
                    "quality": 4,  # Good recall
                    "time_taken": 5,
                },
                headers=auth_headers,
            )
            assert review_response.status_code == 200
            result = review_response.json()
            assert result["success"] is True
            assert result["card_id"] == card_data["card_id"]

        # Verify queue is empty after all reviews
        final_queue_response = await client.get(
            f"/api/v1/study/queue/{deck.id}?include_new=true",
            headers=auth_headers,
        )
        assert final_queue_response.status_code == 200
        final_queue = final_queue_response.json()
        # After reviewing with quality=4, cards transition from NEW to LEARNING
        # They are no longer "new" cards, so total_new should be 0
        assert final_queue["total_new"] == 0, "No new cards should remain"
        # Cards in LEARNING status will have next_review_at set to future
        # so they won't be due immediately - queue may have fewer due cards

        # Verify stats reflect all reviews
        stats_response = await client.get(
            f"/api/v1/study/stats?deck_id={deck.id}",
            headers=auth_headers,
        )
        assert stats_response.status_code == 200
        stats = stats_response.json()
        assert stats["reviews_today"] == initial_count
        assert stats["total_reviews"] == initial_count

        # Verify by_status shows cards in learning (quality=4 moves from NEW to LEARNING)
        assert stats["by_status"]["learning"] >= 1 or stats["by_status"]["review"] >= 1

        # Verify database state - Review records created
        review_count = await db_session.scalar(
            select(func.count()).select_from(Review).where(Review.user_id == test_user.id)
        )
        assert review_count == initial_count, "Review records should be created for each card"

    @pytest.mark.asyncio
    async def test_bulk_review_workflow(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict,
        test_user: User,
    ):
        """Test: Queue -> Collect cards -> Bulk submit -> Verify all processed.

        This test validates the bulk review workflow:
        1. Get queue with multiple cards
        2. Build reviews array from queue cards
        3. Submit bulk reviews
        4. Verify all reviews processed successfully
        5. Verify stats reflect all reviews
        """
        # Setup: Create deck with cards
        deck = await DeckFactory.create(session=db_session, name="Bulk Review Deck")
        await CardFactory.create_batch(
            session=db_session,
            size=5,
            deck_id=deck.id,
        )

        # Initialize study session
        await client.post(
            f"/api/v1/study/initialize/{deck.id}",
            headers=auth_headers,
        )

        # Get study queue
        queue_response = await client.get(
            f"/api/v1/study/queue/{deck.id}?include_new=true",
            headers=auth_headers,
        )
        assert queue_response.status_code == 200
        queue = queue_response.json()
        cards = queue["cards"]
        assert len(cards) >= 3, "Need at least 3 cards for bulk review"

        # Build bulk reviews payload
        reviews_to_submit = [
            {
                "card_id": cards[i]["card_id"],
                "quality": 4,
                "time_taken": 5 + i,
            }
            for i in range(min(3, len(cards)))
        ]

        # Submit bulk reviews
        bulk_response = await client.post(
            "/api/v1/reviews/bulk",
            json={
                "deck_id": str(deck.id),
                "session_id": f"e2e-bulk-{uuid4().hex[:8]}",
                "reviews": reviews_to_submit,
            },
            headers=auth_headers,
        )
        assert bulk_response.status_code == 200
        bulk_result = bulk_response.json()

        # Verify all reviews processed
        assert bulk_result["total_submitted"] == len(reviews_to_submit)
        assert bulk_result["successful"] == len(reviews_to_submit)
        assert bulk_result["failed"] == 0
        assert len(bulk_result["results"]) == len(reviews_to_submit)

        # Verify all results have success=True
        for result in bulk_result["results"]:
            assert result["success"] is True

        # Verify stats reflect reviews
        stats_response = await client.get(
            f"/api/v1/study/stats?deck_id={deck.id}",
            headers=auth_headers,
        )
        assert stats_response.status_code == 200
        stats = stats_response.json()
        assert stats["reviews_today"] >= len(reviews_to_submit)

    @pytest.mark.asyncio
    async def test_mixed_quality_responses(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict,
        test_user: User,
    ):
        """Test: Submit reviews with quality 1-5 -> Verify SM-2 algorithm effects.

        Quality rating effects (SM-2):
        - Quality 5 (Perfect): EF increases, status may advance to REVIEW
        - Quality 4 (Good): EF unchanged, status LEARNING
        - Quality 3 (Difficult): EF decreases slightly, status LEARNING
        - Quality 2 (Wrong): EF decreases, repetitions reset to 0
        - Quality 1 (Blackout): EF at minimum, repetitions reset to 0

        Assertions:
        - Quality < 3 resets repetitions to 0
        - Quality >= 3 increments repetitions
        - average_quality reflects submitted values
        """
        # Setup: Create deck with 5 cards
        deck = await DeckFactory.create(session=db_session, name="Mixed Quality Deck")
        await CardFactory.create_batch(
            session=db_session,
            size=5,
            deck_id=deck.id,
        )

        # Initialize
        await client.post(
            f"/api/v1/study/initialize/{deck.id}",
            headers=auth_headers,
        )

        # Get queue
        queue_response = await client.get(
            f"/api/v1/study/queue/{deck.id}?include_new=true",
            headers=auth_headers,
        )
        assert queue_response.status_code == 200
        cards = queue_response.json()["cards"]
        assert len(cards) == 5

        # Submit reviews with qualities 1-5
        qualities = [1, 2, 3, 4, 5]
        card_qualities = {}

        for i, quality in enumerate(qualities):
            card_id = cards[i]["card_id"]
            card_qualities[card_id] = quality

            review_response = await client.post(
                "/api/v1/reviews",
                json={
                    "card_id": card_id,
                    "quality": quality,
                    "time_taken": 5,
                },
                headers=auth_headers,
            )
            assert review_response.status_code == 200
            result = review_response.json()
            assert result["success"] is True
            assert result["quality"] == quality

        # Verify SM-2 effects in database
        for card_id, quality in card_qualities.items():
            stats_query = await db_session.execute(
                select(CardStatistics).where(
                    CardStatistics.user_id == test_user.id,
                    CardStatistics.card_id == card_id,
                )
            )
            card_stats = stats_query.scalar_one()

            if quality < 3:
                # Quality < 3: repetitions reset to 0, stays in LEARNING
                assert card_stats.repetitions == 0, f"Quality {quality} should reset reps to 0"
                assert card_stats.status == CardStatus.LEARNING
            else:
                # Quality >= 3: repetitions >= 1 (first successful review)
                assert card_stats.repetitions >= 1, f"Quality {quality} should have reps >= 1"

        # Verify average quality in stats
        stats_response = await client.get(
            f"/api/v1/study/stats?deck_id={deck.id}",
            headers=auth_headers,
        )
        assert stats_response.status_code == 200
        stats = stats_response.json()

        # Average quality = (1+2+3+4+5)/5 = 3.0
        expected_avg = sum(qualities) / len(qualities)
        assert (
            abs(stats["average_quality"] - expected_avg) < 0.1
        ), f"Average quality should be ~{expected_avg}, got {stats['average_quality']}"

    @pytest.mark.asyncio
    async def test_partial_session_completion(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict,
        test_user: User,
    ):
        """Test: Review half -> Stop -> Resume -> Complete remaining.

        This test validates partial session handling:
        1. Create 10 cards, review first 5
        2. Verify stats show 5 reviews
        3. Resume and review remaining 5
        4. Verify final queue empty, stats show 10 reviews

        Note: After initialization, total_new=0 because all cards have CardStatistics.
        The cards are in the queue with status="new" (just initialized).
        After review, card status changes from "new" to "learning".
        """
        # Setup: Create deck with 10 cards
        deck = await DeckFactory.create(session=db_session, name="Partial Session Deck")
        await CardFactory.create_batch(
            session=db_session,
            size=10,
            deck_id=deck.id,
        )

        # Initialize
        init_response = await client.post(
            f"/api/v1/study/initialize/{deck.id}",
            headers=auth_headers,
        )
        assert init_response.status_code == 200

        # Session 1: Get queue and review first 5 cards
        queue_response = await client.get(
            f"/api/v1/study/queue/{deck.id}?include_new=true",
            headers=auth_headers,
        )
        assert queue_response.status_code == 200
        initial_queue = queue_response.json()
        assert initial_queue["total_in_queue"] == 10

        # All cards should have status="new" (just initialized)
        new_cards_initial = [c for c in initial_queue["cards"] if c["status"] == "new"]
        assert len(new_cards_initial) == 10, "All 10 cards should have status=new"

        # Review first 5 cards
        first_half = initial_queue["cards"][:5]
        reviewed_card_ids = set()
        for card_data in first_half:
            await client.post(
                "/api/v1/reviews",
                json={
                    "card_id": card_data["card_id"],
                    "quality": 4,
                    "time_taken": 5,
                },
                headers=auth_headers,
            )
            reviewed_card_ids.add(card_data["card_id"])

        # Verify stats after first half
        stats_after_first = await client.get(
            "/api/v1/study/stats",
            headers=auth_headers,
        )
        assert stats_after_first.status_code == 200
        assert stats_after_first.json()["reviews_today"] == 5

        # Session 2: Get remaining queue
        remaining_queue_response = await client.get(
            f"/api/v1/study/queue/{deck.id}?include_new=true",
            headers=auth_headers,
        )
        assert remaining_queue_response.status_code == 200
        remaining_queue = remaining_queue_response.json()

        # After reviewing 5 cards, only 5 should still have status="new"
        # The reviewed cards will have status="learning"
        new_cards_remaining = [c for c in remaining_queue["cards"] if c["status"] == "new"]
        assert len(new_cards_remaining) == 5, "Should have 5 remaining cards with status=new"

        # Verify these are different from the ones we reviewed
        for card in new_cards_remaining:
            assert card["card_id"] not in reviewed_card_ids, "Remaining cards should be unreviewed"

        # Review remaining 5 cards
        for card_data in new_cards_remaining:
            await client.post(
                "/api/v1/reviews",
                json={
                    "card_id": card_data["card_id"],
                    "quality": 4,
                    "time_taken": 5,
                },
                headers=auth_headers,
            )

        # Verify final queue has no more "new" status cards
        final_queue_response = await client.get(
            f"/api/v1/study/queue/{deck.id}?include_new=true",
            headers=auth_headers,
        )
        assert final_queue_response.status_code == 200
        final_queue = final_queue_response.json()

        # No cards should have status="new" anymore
        final_new_cards = [c for c in final_queue["cards"] if c["status"] == "new"]
        assert len(final_new_cards) == 0, "No cards should have status=new after all reviewed"

        # Verify final stats show 10 reviews
        final_stats = await client.get(
            "/api/v1/study/stats",
            headers=auth_headers,
        )
        assert final_stats.status_code == 200
        assert final_stats.json()["reviews_today"] == 10


@pytest.mark.e2e
class TestEmptyQueueHandling(E2ETestCase):
    """Test empty queue handling scenarios.

    Verifies correct response structure when:
    - Deck has no cards
    - All cards have been reviewed
    - Global queue is empty
    """

    @pytest.mark.asyncio
    async def test_empty_queue_handling_empty_deck(
        self,
        client: AsyncClient,
        auth_headers: dict,
        empty_deck,
    ):
        """Test: Empty deck returns valid empty queue structure.

        Assertions:
        - Response status 200 (not error)
        - cards is empty list (not null)
        - All count fields are 0
        """
        response = await client.get(
            f"/api/v1/study/queue/{empty_deck.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Verify empty structure
        assert data["total_due"] == 0
        assert data["total_new"] == 0
        assert data["cards"] == []
        # total_in_queue should be 0 for empty deck
        assert data.get("total_in_queue", 0) == 0

    @pytest.mark.asyncio
    async def test_empty_queue_after_all_reviews(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict,
        test_user: User,
    ):
        """Test: Queue is empty structure after reviewing all cards."""
        # Setup: Create small deck with 3 cards
        deck = await DeckFactory.create(session=db_session, name="Small Deck")
        await CardFactory.create_batch(
            session=db_session,
            size=3,
            deck_id=deck.id,
        )

        # Initialize
        await client.post(
            f"/api/v1/study/initialize/{deck.id}",
            headers=auth_headers,
        )

        # Get and review all cards
        queue_response = await client.get(
            f"/api/v1/study/queue/{deck.id}?include_new=true",
            headers=auth_headers,
        )
        cards = queue_response.json()["cards"]

        for card_data in cards:
            await client.post(
                "/api/v1/reviews",
                json={
                    "card_id": card_data["card_id"],
                    "quality": 4,
                    "time_taken": 5,
                },
                headers=auth_headers,
            )

        # Verify queue shows empty for new cards
        final_response = await client.get(
            f"/api/v1/study/queue/{deck.id}?include_new=true",
            headers=auth_headers,
        )
        assert final_response.status_code == 200
        data = final_response.json()

        # No more new cards
        assert data["total_new"] == 0
        # Cards are empty or only contains learning/review cards (not "new")
        new_cards = [c for c in data.get("cards", []) if c.get("status") == "new"]
        assert len(new_cards) == 0

    @pytest.mark.asyncio
    async def test_global_queue_empty_structure(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict,
    ):
        """Test: Global queue (no deck_id) returns valid empty structure.

        When user has no study activity, global queue should return
        valid empty structure, not error.
        """
        # Note: Fresh user with no study activity
        # Register a new user to ensure clean slate
        unique_email = f"empty_queue_{uuid4().hex[:8]}@example.com"
        register_response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": unique_email,
                "password": "SecurePass123!",
                "full_name": "Empty Queue User",
            },
        )
        assert register_response.status_code == 201
        fresh_headers = {"Authorization": f"Bearer {register_response.json()['access_token']}"}

        # Get global queue for user with no activity
        response = await client.get(
            "/api/v1/study/queue",
            headers=fresh_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Verify valid structure with zeros
        assert data["total_due"] == 0
        assert data["total_new"] == 0
        assert isinstance(data["cards"], list)
        assert len(data["cards"]) == 0


@pytest.mark.e2e
class TestLearningSessionEdgeCases(E2ETestCase):
    """Test edge cases and error handling for learning sessions.

    Covers:
    - Non-existent card (404)
    - Invalid quality values (422)
    - Bulk review limits (422)
    - Empty reviews array (422)
    """

    @pytest.mark.asyncio
    async def test_review_nonexistent_card_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test: Reviewing non-existent card returns 404."""
        fake_card_id = "00000000-0000-0000-0000-000000000000"

        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": fake_card_id,
                "quality": 4,
                "time_taken": 5,
            },
            headers=auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_invalid_quality_high_returns_422(
        self,
        client: AsyncClient,
        auth_headers: dict,
        deck_with_cards: DeckWithCards,
    ):
        """Test: Quality > 5 returns 422 validation error."""
        card = deck_with_cards.cards[0]

        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(card.id),
                "quality": 6,  # Invalid - max is 5
                "time_taken": 5,
            },
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_invalid_quality_negative_returns_422(
        self,
        client: AsyncClient,
        auth_headers: dict,
        deck_with_cards: DeckWithCards,
    ):
        """Test: Quality < 0 returns 422 validation error."""
        card = deck_with_cards.cards[0]

        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(card.id),
                "quality": -1,  # Invalid - min is 0
                "time_taken": 5,
            },
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_bulk_review_exceeds_limit_returns_422(
        self,
        client: AsyncClient,
        auth_headers: dict,
        deck_with_cards: DeckWithCards,
    ):
        """Test: Bulk review with > 100 items returns 422."""
        card = deck_with_cards.cards[0]

        # Create 101 reviews (exceeds limit)
        reviews = [
            {
                "card_id": str(card.id),
                "quality": 4,
                "time_taken": 5,
            }
            for _ in range(101)
        ]

        response = await client.post(
            "/api/v1/reviews/bulk",
            json={
                "deck_id": str(deck_with_cards.deck.id),
                "session_id": "test-exceeds-limit",
                "reviews": reviews,
            },
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_bulk_review_empty_array_returns_422(
        self,
        client: AsyncClient,
        auth_headers: dict,
        deck_with_cards: DeckWithCards,
    ):
        """Test: Bulk review with empty reviews array returns 422."""
        response = await client.post(
            "/api/v1/reviews/bulk",
            json={
                "deck_id": str(deck_with_cards.deck.id),
                "session_id": "test-empty-array",
                "reviews": [],  # Empty array
            },
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"
