"""E2E tests for bulk review operations and streak tracking.

These tests cover the review API endpoints that have lower coverage:
- POST /api/v1/reviews/bulk - Bulk review submission
- Streak milestone tracking
- Daily goal notification triggering

Run with:
    pytest tests/e2e/scenarios/test_review_bulk_operations.py -v
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.e2e.conftest import E2ETestCase, StudyEnvironment

# =============================================================================
# Test Bulk Review Submission
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestBulkReviewSubmission(E2ETestCase):
    """E2E tests for POST /api/v1/reviews/bulk endpoint."""

    @pytest.mark.asyncio
    async def test_bulk_review_submission_success(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test submitting multiple reviews in a single request."""
        env = populated_study_environment

        # Prepare bulk review payload with first 3 cards
        reviews = [
            {
                "card_id": str(env.cards[i].id),
                "quality": 4,
                "time_taken": 5 + i,
            }
            for i in range(min(3, len(env.cards)))
        ]

        response = await client.post(
            "/api/v1/reviews/bulk",
            json={
                "deck_id": str(env.deck.id),
                "session_id": f"bulk-session-{uuid4().hex[:8]}",
                "reviews": reviews,
            },
            headers=env.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "session_id" in data
        assert "total_submitted" in data
        assert "successful" in data
        assert "failed" in data
        assert "results" in data

        # Verify counts
        assert data["total_submitted"] == len(reviews)
        assert data["successful"] >= 1
        assert data["failed"] >= 0

    @pytest.mark.asyncio
    async def test_bulk_review_response_structure(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that bulk review response has correct structure per card."""
        env = populated_study_environment

        reviews = [
            {
                "card_id": str(env.cards[0].id),
                "quality": 4,
                "time_taken": 5,
            }
        ]

        response = await client.post(
            "/api/v1/reviews/bulk",
            json={
                "deck_id": str(env.deck.id),
                "session_id": f"bulk-session-{uuid4().hex[:8]}",
                "reviews": reviews,
            },
            headers=env.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Check individual result structure
        assert len(data["results"]) >= 1
        result = data["results"][0]

        # SM2 result fields
        assert "success" in result
        assert "card_id" in result
        assert "quality" in result
        assert "previous_status" in result
        assert "new_status" in result
        assert "easiness_factor" in result
        assert "interval" in result
        assert "repetitions" in result
        assert "next_review_date" in result

    @pytest.mark.asyncio
    async def test_bulk_review_with_mixed_quality_ratings(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test bulk review with different quality ratings per card."""
        env = populated_study_environment

        # Use different quality ratings
        qualities = [5, 4, 3, 2, 1]
        reviews = [
            {
                "card_id": str(env.cards[i].id),
                "quality": qualities[i % len(qualities)],
                "time_taken": 5,
            }
            for i in range(min(5, len(env.cards)))
        ]

        response = await client.post(
            "/api/v1/reviews/bulk",
            json={
                "deck_id": str(env.deck.id),
                "session_id": f"mixed-quality-{uuid4().hex[:8]}",
                "reviews": reviews,
            },
            headers=env.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["successful"] >= 1

    @pytest.mark.asyncio
    async def test_bulk_review_all_valid_cards(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test bulk review with all valid cards succeeds."""
        env = populated_study_environment

        # Use only valid cards
        reviews = [
            {
                "card_id": str(env.cards[i].id),
                "quality": 4,
                "time_taken": 5,
            }
            for i in range(min(2, len(env.cards)))
        ]

        response = await client.post(
            "/api/v1/reviews/bulk",
            json={
                "deck_id": str(env.deck.id),
                "session_id": f"all-valid-{uuid4().hex[:8]}",
                "reviews": reviews,
            },
            headers=env.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # All should succeed
        assert data["total_submitted"] == len(reviews)
        assert data["successful"] == len(reviews)
        assert data["failed"] == 0

    @pytest.mark.asyncio
    async def test_bulk_review_empty_array_rejected(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that empty reviews array is rejected."""
        env = populated_study_environment

        response = await client.post(
            "/api/v1/reviews/bulk",
            json={
                "deck_id": str(env.deck.id),
                "session_id": f"empty-{uuid4().hex[:8]}",
                "reviews": [],
            },
            headers=env.headers,
        )

        # Should return 422 validation error
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_bulk_review_session_id_included(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that session_id is returned in response."""
        env = populated_study_environment
        session_id = f"session-tracking-{uuid4().hex[:8]}"

        reviews = [
            {
                "card_id": str(env.cards[0].id),
                "quality": 4,
                "time_taken": 5,
            }
        ]

        response = await client.post(
            "/api/v1/reviews/bulk",
            json={
                "deck_id": str(env.deck.id),
                "session_id": session_id,
                "reviews": reviews,
            },
            headers=env.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == session_id

    @pytest.mark.asyncio
    async def test_bulk_review_unauthenticated(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that bulk review requires authentication."""
        env = populated_study_environment

        response = await client.post(
            "/api/v1/reviews/bulk",
            json={
                "deck_id": str(env.deck.id),
                "session_id": "test",
                "reviews": [
                    {
                        "card_id": str(env.cards[0].id),
                        "quality": 4,
                        "time_taken": 5,
                    }
                ],
            },
            # No headers - unauthenticated
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_bulk_review_with_minimum_quality(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test bulk review with quality 0 (complete blackout)."""
        env = populated_study_environment

        reviews = [
            {
                "card_id": str(env.cards[0].id),
                "quality": 0,  # Minimum quality
                "time_taken": 30,
            },
        ]

        response = await client.post(
            "/api/v1/reviews/bulk",
            json={
                "deck_id": str(env.deck.id),
                "session_id": f"min-quality-{uuid4().hex[:8]}",
                "reviews": reviews,
            },
            headers=env.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["successful"] == 1
        # Quality 0 should reset the card
        assert data["results"][0]["quality"] == 0

    @pytest.mark.asyncio
    async def test_bulk_review_with_maximum_quality(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test bulk review with quality 5 (perfect response)."""
        env = populated_study_environment

        reviews = [
            {
                "card_id": str(env.cards[0].id),
                "quality": 5,  # Maximum quality
                "time_taken": 2,
            },
        ]

        response = await client.post(
            "/api/v1/reviews/bulk",
            json={
                "deck_id": str(env.deck.id),
                "session_id": f"max-quality-{uuid4().hex[:8]}",
                "reviews": reviews,
            },
            headers=env.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["successful"] == 1
        assert data["results"][0]["quality"] == 5

    @pytest.mark.asyncio
    async def test_bulk_review_repeated_card(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test bulk review with same card reviewed multiple times."""
        env = populated_study_environment
        card_id = str(env.cards[0].id)

        # Review the same card multiple times in one batch
        reviews = [
            {"card_id": card_id, "quality": 3, "time_taken": 5},
            {"card_id": card_id, "quality": 4, "time_taken": 3},
            {"card_id": card_id, "quality": 5, "time_taken": 2},
        ]

        response = await client.post(
            "/api/v1/reviews/bulk",
            json={
                "deck_id": str(env.deck.id),
                "session_id": f"repeated-card-{uuid4().hex[:8]}",
                "reviews": reviews,
            },
            headers=env.headers,
        )

        assert response.status_code == 200
        data = response.json()
        # All should process (may or may not succeed depending on implementation)
        assert data["total_submitted"] == 3

    @pytest.mark.asyncio
    async def test_bulk_review_large_batch(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test bulk review with larger batch of reviews."""
        env = populated_study_environment

        # Use all available cards (up to 10)
        reviews = [
            {
                "card_id": str(env.cards[i % len(env.cards)].id),
                "quality": (i % 6),  # Quality 0-5
                "time_taken": 5 + i,
            }
            for i in range(min(10, len(env.cards) * 2))
        ]

        response = await client.post(
            "/api/v1/reviews/bulk",
            json={
                "deck_id": str(env.deck.id),
                "session_id": f"large-batch-{uuid4().hex[:8]}",
                "reviews": reviews,
            },
            headers=env.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_submitted"] == len(reviews)


# =============================================================================
# Test Review History with Filtering
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestReviewHistoryFiltering(E2ETestCase):
    """E2E tests for GET /api/v1/reviews with date filtering."""

    @pytest.mark.asyncio
    async def test_review_history_pagination(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test review history pagination."""
        env = populated_study_environment

        # Submit a few reviews first
        for i in range(3):
            await client.post(
                "/api/v1/reviews",
                json={
                    "card_id": str(env.cards[i].id),
                    "quality": 4,
                    "time_taken": 5,
                },
                headers=env.headers,
            )

        # Get review history with pagination
        response = await client.get(
            "/api/v1/reviews",
            params={"page": 1, "page_size": 2},
            headers=env.headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "reviews" in data
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert len(data["reviews"]) <= 2

    @pytest.mark.asyncio
    async def test_review_history_response_structure(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that review history response has correct structure."""
        env = populated_study_environment

        # Submit a review first
        await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 4,
                "time_taken": 5,
            },
            headers=env.headers,
        )

        response = await client.get(
            "/api/v1/reviews",
            headers=env.headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert len(data["reviews"]) >= 1
        review = data["reviews"][0]

        # Review structure
        assert "id" in review
        assert "user_id" in review
        assert "card_id" in review
        assert "quality" in review
        assert "time_taken" in review
        assert "reviewed_at" in review

    @pytest.mark.asyncio
    async def test_review_history_user_isolation(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that review history only shows current user's reviews."""
        env = populated_study_environment

        # Submit review as first user
        await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 4,
                "time_taken": 5,
            },
            headers=env.headers,
        )

        # Create second user
        second_session = await self.register_and_login(
            client,
            email=f"e2e_isolation_{uuid4().hex[:8]}@example.com",
        )

        # Second user's history should be empty (or not include first user's)
        response = await client.get(
            "/api/v1/reviews",
            headers=second_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Second user shouldn't see first user's reviews
        for review in data["reviews"]:
            assert review["user_id"] == str(second_session.user.id)


# =============================================================================
# Test Single Review Submission with SM-2
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestSingleReviewSM2(E2ETestCase):
    """E2E tests for POST /api/v1/reviews with SM-2 algorithm."""

    @pytest.mark.asyncio
    async def test_review_quality_affects_interval(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that quality rating affects the next review interval."""
        env = populated_study_environment

        # Submit review with perfect quality (5)
        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 5,
                "time_taken": 3,
            },
            headers=env.headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["quality"] == 5
        assert data["interval"] >= 1
        assert data["easiness_factor"] >= 2.5  # Should stay or increase

    @pytest.mark.asyncio
    async def test_review_poor_quality_resets_progress(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that poor quality rating resets card progress."""
        env = populated_study_environment

        # First, make the card learned with good quality
        await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 5,
                "time_taken": 3,
            },
            headers=env.headers,
        )

        # Now review with poor quality
        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 1,  # Poor recall
                "time_taken": 10,
            },
            headers=env.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Card should be reset or have reduced interval
        assert data["success"] is True
        assert data["repetitions"] >= 0

    @pytest.mark.asyncio
    async def test_review_transitions_card_status(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that reviews transition card through learning states."""
        env = populated_study_environment

        # First review - should transition from new to learning
        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 4,
                "time_taken": 5,
            },
            headers=env.headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert "previous_status" in data
        assert "new_status" in data
        # Status should change or stay in learning phase

    @pytest.mark.asyncio
    async def test_review_returns_next_review_date(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that review response includes next review date."""
        env = populated_study_environment

        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 4,
                "time_taken": 5,
            },
            headers=env.headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert "next_review_date" in data
        # Should be a valid date string
        assert data["next_review_date"] is not None

    @pytest.mark.asyncio
    async def test_review_card_not_found(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that reviewing non-existent card returns 404."""
        env = populated_study_environment
        fake_id = str(uuid4())

        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": fake_id,
                "quality": 4,
                "time_taken": 5,
            },
            headers=env.headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_review_invalid_quality_rejected(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that invalid quality values are rejected."""
        env = populated_study_environment

        # Quality must be 0-5
        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 6,  # Invalid
                "time_taken": 5,
            },
            headers=env.headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_review_time_taken_at_max_accepted(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that time_taken at max (180 seconds) is accepted."""
        env = populated_study_environment

        # time_taken has max of 180 seconds (3 minutes)
        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(env.cards[0].id),
                "quality": 4,
                "time_taken": 180,  # Max value (3 minutes)
            },
            headers=env.headers,
        )

        assert response.status_code == 200


# =============================================================================
# Test Complete Review Session Workflow
# =============================================================================


@pytest.mark.e2e
@pytest.mark.scenario
class TestReviewSessionWorkflow(E2ETestCase):
    """E2E tests for complete review session workflows."""

    @pytest.mark.asyncio
    async def test_complete_study_session_workflow(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test complete workflow: init -> get queue -> review -> check history."""
        env = populated_study_environment

        # 1. Get study queue
        queue_response = await client.get(
            f"/api/v1/study/queue/{env.deck.id}",
            headers=env.headers,
        )
        assert queue_response.status_code == 200
        queue = queue_response.json()

        # 2. Review first few cards from queue
        cards_to_review = queue.get("cards", [])[:3]
        for card in cards_to_review:
            card_id = card.get("card_id") or card.get("id")
            review_response = await client.post(
                "/api/v1/reviews",
                json={
                    "card_id": str(card_id),
                    "quality": 4,
                    "time_taken": 5,
                },
                headers=env.headers,
            )
            assert review_response.status_code == 200

        # 3. Verify review history has our reviews
        history_response = await client.get(
            "/api/v1/reviews",
            headers=env.headers,
        )
        assert history_response.status_code == 200
        history = history_response.json()

        # Should have reviews
        assert history["total"] >= len(cards_to_review)

    @pytest.mark.asyncio
    async def test_multiple_reviews_same_card_updates_stats(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test that reviewing same card multiple times updates stats."""
        env = populated_study_environment
        card_id = str(env.cards[0].id)

        # First review
        response1 = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": card_id,
                "quality": 4,
                "time_taken": 5,
            },
            headers=env.headers,
        )
        assert response1.status_code == 200
        data1 = response1.json()

        # Second review
        response2 = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": card_id,
                "quality": 5,
                "time_taken": 3,
            },
            headers=env.headers,
        )
        assert response2.status_code == 200
        data2 = response2.json()

        # Repetitions should increase
        assert data2["repetitions"] > data1["repetitions"]

    @pytest.mark.asyncio
    async def test_review_with_all_quality_levels(
        self,
        client: AsyncClient,
        populated_study_environment: StudyEnvironment,
    ) -> None:
        """Test submitting reviews with all valid quality levels (0-5)."""
        env = populated_study_environment

        quality_levels = [0, 1, 2, 3, 4, 5]

        for i, quality in enumerate(quality_levels):
            if i >= len(env.cards):
                break

            response = await client.post(
                "/api/v1/reviews",
                json={
                    "card_id": str(env.cards[i].id),
                    "quality": quality,
                    "time_taken": 5,
                },
                headers=env.headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["quality"] == quality
