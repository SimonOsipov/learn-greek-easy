"""E2E tests for feedback and voting functionality.

These tests verify the feedback API through real HTTP requests,
covering:
- POST /api/v1/feedback (create)
- GET /api/v1/feedback (list with filters and sorting)
- GET /api/v1/feedback/{feedback_id} (get single)
- DELETE /api/v1/feedback/{feedback_id} (delete own)
- POST /api/v1/feedback/{feedback_id}/vote (vote up/down)
- DELETE /api/v1/feedback/{feedback_id}/vote (remove vote)

Run with:
    pytest tests/e2e/scenarios/test_feedback_voting.py -v
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.e2e.conftest import E2ETestCase, UserSession

# =============================================================================
# Test Feedback Creation
# =============================================================================


class TestFeedbackCreation(E2ETestCase):
    """E2E tests for feedback creation functionality."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_create_feature_request(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test creating a feature request feedback item."""
        response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Add dark mode support",
                "description": "It would be great to have a dark mode option for studying at night.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Add dark mode support"
        assert data["category"] == "feature_request"

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_create_bug_report(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test creating a bug report feedback item."""
        response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Card shows incorrect translation",
                "description": "The word 'kalos' is showing wrong translation in B1 deck.",
                "category": "bug_incorrect_data",
            },
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Card shows incorrect translation"
        assert data["category"] == "bug_incorrect_data"

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_create_feedback_response_structure(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that feedback response has correct structure."""
        response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Test feedback item",
                "description": "This is a test description that is long enough.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 201
        data = response.json()

        # Required fields
        assert "id" in data
        assert "title" in data
        assert "description" in data
        assert "category" in data
        assert "status" in data
        assert "vote_count" in data
        assert "user_vote" in data
        assert "author" in data
        assert "created_at" in data
        assert "updated_at" in data

        # Author structure
        assert "id" in data["author"]
        assert "full_name" in data["author"]

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_create_feedback_sets_initial_values(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that newly created feedback has correct initial values."""
        response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Initial values test",
                "description": "Testing that initial values are set correctly.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 201
        data = response.json()

        assert data["status"] == "new"  # Default status
        assert data["vote_count"] == 0  # No votes yet
        assert data["user_vote"] is None  # User hasn't voted


# =============================================================================
# Test Feedback Listing
# =============================================================================


class TestFeedbackListing(E2ETestCase):
    """E2E tests for feedback listing functionality."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_list_feedback_returns_items(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that listing feedback returns created items."""
        # Create a feedback item first
        await client.post(
            "/api/v1/feedback",
            json={
                "title": "List test item",
                "description": "This item should appear in the list.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )

        # List feedback
        response = await client.get(
            "/api/v1/feedback",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert data["total"] >= 1

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_list_feedback_filter_by_category(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test filtering feedback by category."""
        # Create both types
        await client.post(
            "/api/v1/feedback",
            json={
                "title": "Feature for filter test",
                "description": "This is a feature request for filter testing.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        await client.post(
            "/api/v1/feedback",
            json={
                "title": "Bug for filter test",
                "description": "This is a bug report for filter testing purposes.",
                "category": "bug_incorrect_data",
            },
            headers=fresh_user_session.headers,
        )

        # Filter by feature_request
        response = await client.get(
            "/api/v1/feedback",
            params={"category": "feature_request"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        # All returned items should be feature requests
        for item in data["items"]:
            assert item["category"] == "feature_request"

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_list_feedback_filter_by_status(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test filtering feedback by status."""
        # Create a feedback item (will have 'new' status)
        await client.post(
            "/api/v1/feedback",
            json={
                "title": "Status filter test",
                "description": "Testing status filter functionality.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )

        # Filter by new status
        response = await client.get(
            "/api/v1/feedback",
            params={"status": "new"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        # All returned items should have 'new' status
        for item in data["items"]:
            assert item["status"] == "new"

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_list_feedback_sort_by_votes_desc(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test sorting feedback by votes descending."""
        response = await client.get(
            "/api/v1/feedback",
            params={"sort": "votes", "order": "desc"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Verify items are sorted by vote_count descending
        items = data["items"]
        if len(items) > 1:
            for i in range(len(items) - 1):
                assert items[i]["vote_count"] >= items[i + 1]["vote_count"]

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_list_feedback_sort_by_created_at_asc(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test sorting feedback by created_at ascending."""
        response = await client.get(
            "/api/v1/feedback",
            params={"sort": "created_at", "order": "asc"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Verify items are sorted by created_at ascending
        items = data["items"]
        if len(items) > 1:
            for i in range(len(items) - 1):
                assert items[i]["created_at"] <= items[i + 1]["created_at"]

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_list_feedback_includes_user_vote(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that listing includes user's vote on each item."""
        # Create feedback
        create_response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "User vote inclusion test",
                "description": "Testing that user_vote is included in response.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        feedback_id = create_response.json()["id"]

        # Vote on it
        await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "up"},
            headers=fresh_user_session.headers,
        )

        # List and check user_vote
        response = await client.get(
            "/api/v1/feedback",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Find our feedback item
        voted_item = None
        for item in data["items"]:
            if item["id"] == feedback_id:
                voted_item = item
                break

        assert voted_item is not None
        assert voted_item["user_vote"] == "up"

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_list_feedback_pagination_works(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that pagination parameters work correctly."""
        # Create multiple items
        for i in range(3):
            await client.post(
                "/api/v1/feedback",
                json={
                    "title": f"Pagination test item {i}",
                    "description": f"This is pagination test item number {i}.",
                    "category": "feature_request",
                },
                headers=fresh_user_session.headers,
            )

        # Test pagination
        response = await client.get(
            "/api/v1/feedback",
            params={"page": 1, "page_size": 2},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert len(data["items"]) <= 2


# =============================================================================
# Test Feedback Retrieval
# =============================================================================


class TestFeedbackRetrieval(E2ETestCase):
    """E2E tests for single feedback retrieval."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_get_single_feedback(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test retrieving a single feedback item."""
        # Create feedback
        create_response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Single retrieval test",
                "description": "Testing retrieval of a single feedback item.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        feedback_id = create_response.json()["id"]

        # Retrieve it
        response = await client.get(
            f"/api/v1/feedback/{feedback_id}",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == feedback_id
        assert data["title"] == "Single retrieval test"

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_get_feedback_not_found(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that getting nonexistent feedback returns 404."""
        fake_id = str(uuid4())
        response = await client.get(
            f"/api/v1/feedback/{fake_id}",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_get_feedback_response_structure(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that single feedback response has correct structure."""
        # Create feedback
        create_response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Structure test",
                "description": "Testing the response structure of single feedback.",
                "category": "bug_incorrect_data",
            },
            headers=fresh_user_session.headers,
        )
        feedback_id = create_response.json()["id"]

        # Retrieve and check structure
        response = await client.get(
            f"/api/v1/feedback/{feedback_id}",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Required fields
        assert "id" in data
        assert "title" in data
        assert "description" in data
        assert "category" in data
        assert "status" in data
        assert "vote_count" in data
        assert "user_vote" in data
        assert "author" in data
        assert "created_at" in data
        assert "updated_at" in data


# =============================================================================
# Test Feedback Deletion
# =============================================================================


class TestFeedbackDeletion(E2ETestCase):
    """E2E tests for feedback deletion."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_delete_own_feedback(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that user can delete their own feedback."""
        # Create feedback
        create_response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Delete test",
                "description": "This feedback will be deleted by its author.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        feedback_id = create_response.json()["id"]

        # Delete it
        response = await client.delete(
            f"/api/v1/feedback/{feedback_id}",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 204

        # Verify it's gone
        get_response = await client.get(
            f"/api/v1/feedback/{feedback_id}",
            headers=fresh_user_session.headers,
        )
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_delete_others_feedback_forbidden(
        self, client: AsyncClient, db_session: AsyncSession, fresh_user_session: UserSession
    ) -> None:
        """Test that user cannot delete another user's feedback."""
        # Create feedback as first user
        create_response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Cannot delete this",
                "description": "This feedback belongs to another user.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        feedback_id = create_response.json()["id"]

        # Create a second user
        second_session = await self.register_and_login(
            client,
            email=f"e2e_second_{uuid4().hex[:8]}@example.com",
            db_session=db_session,
        )

        # Try to delete as second user
        response = await client.delete(
            f"/api/v1/feedback/{feedback_id}",
            headers=second_session.headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_delete_nonexistent_feedback(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that deleting nonexistent feedback returns 404."""
        fake_id = str(uuid4())
        response = await client.delete(
            f"/api/v1/feedback/{fake_id}",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 404


# =============================================================================
# Test Feedback Voting
# =============================================================================


class TestFeedbackVoting(E2ETestCase):
    """E2E tests for feedback voting functionality - CRITICAL FOR COVERAGE."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_upvote_increases_count(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that upvoting increases vote count."""
        # Create feedback
        create_response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Upvote test",
                "description": "Testing that upvoting increases the vote count.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        feedback_id = create_response.json()["id"]
        initial_count = create_response.json()["vote_count"]

        # Upvote
        response = await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "up"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["new_vote_count"] == initial_count + 1
        assert data["vote_type"] == "up"

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_downvote_decreases_count(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that downvoting decreases vote count."""
        # Create feedback
        create_response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Downvote test",
                "description": "Testing that downvoting decreases the vote count.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        feedback_id = create_response.json()["id"]
        initial_count = create_response.json()["vote_count"]

        # Downvote
        response = await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "down"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["new_vote_count"] == initial_count - 1
        assert data["vote_type"] == "down"

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_change_vote_up_to_down(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test changing vote from upvote to downvote."""
        # Create feedback
        create_response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Change vote test",
                "description": "Testing changing vote from up to down.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        feedback_id = create_response.json()["id"]

        # First upvote
        up_response = await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "up"},
            headers=fresh_user_session.headers,
        )
        after_up_count = up_response.json()["new_vote_count"]

        # Then change to downvote
        down_response = await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "down"},
            headers=fresh_user_session.headers,
        )

        assert down_response.status_code == 200
        data = down_response.json()
        # Vote change from up to down: removes +1, adds -1 = -2 from upvoted state
        assert data["new_vote_count"] == after_up_count - 2
        assert data["vote_type"] == "down"

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_change_vote_down_to_up(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test changing vote from downvote to upvote."""
        # Create feedback
        create_response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Change vote down to up test",
                "description": "Testing changing vote from down to up.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        feedback_id = create_response.json()["id"]

        # First downvote
        down_response = await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "down"},
            headers=fresh_user_session.headers,
        )
        after_down_count = down_response.json()["new_vote_count"]

        # Then change to upvote
        up_response = await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "up"},
            headers=fresh_user_session.headers,
        )

        assert up_response.status_code == 200
        data = up_response.json()
        # Vote change from down to up: removes -1, adds +1 = +2 from downvoted state
        assert data["new_vote_count"] == after_down_count + 2
        assert data["vote_type"] == "up"

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_same_vote_no_change(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that voting the same way twice doesn't change count."""
        # Create feedback
        create_response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Same vote test",
                "description": "Testing that voting the same way twice is idempotent.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        feedback_id = create_response.json()["id"]

        # First upvote
        first_response = await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "up"},
            headers=fresh_user_session.headers,
        )
        first_count = first_response.json()["new_vote_count"]

        # Second upvote (same)
        second_response = await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "up"},
            headers=fresh_user_session.headers,
        )

        assert second_response.status_code == 200
        data = second_response.json()
        # Count should be the same
        assert data["new_vote_count"] == first_count

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_vote_response_includes_new_count(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that vote response includes the new vote count."""
        # Create feedback
        create_response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Vote response test",
                "description": "Testing that vote response includes new count.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        feedback_id = create_response.json()["id"]

        # Vote
        response = await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "up"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "feedback_id" in data
        assert "vote_type" in data
        assert "new_vote_count" in data
        assert isinstance(data["new_vote_count"], int)

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_user_can_vote_on_own_feedback(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that user can vote on their own feedback."""
        # Create feedback
        create_response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Self vote test",
                "description": "Testing that users can vote on their own feedback.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        feedback_id = create_response.json()["id"]

        # Vote on own feedback
        response = await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "up"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_vote_on_nonexistent_feedback(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that voting on nonexistent feedback returns 404."""
        fake_id = str(uuid4())
        response = await client.post(
            f"/api/v1/feedback/{fake_id}/vote",
            json={"vote_type": "up"},
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 404


# =============================================================================
# Test Vote Removal
# =============================================================================


class TestRemoveVote(E2ETestCase):
    """E2E tests for vote removal functionality."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_remove_upvote_decreases_count(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that removing upvote decreases count."""
        # Create feedback
        create_response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Remove upvote test",
                "description": "Testing that removing upvote decreases count.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        feedback_id = create_response.json()["id"]

        # Upvote first
        vote_response = await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "up"},
            headers=fresh_user_session.headers,
        )
        after_vote_count = vote_response.json()["new_vote_count"]

        # Remove vote
        remove_response = await client.delete(
            f"/api/v1/feedback/{feedback_id}/vote",
            headers=fresh_user_session.headers,
        )

        assert remove_response.status_code == 200
        data = remove_response.json()
        assert data["new_vote_count"] == after_vote_count - 1
        assert data["vote_type"] is None

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_remove_downvote_increases_count(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that removing downvote increases count."""
        # Create feedback
        create_response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Remove downvote test",
                "description": "Testing that removing downvote increases count.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        feedback_id = create_response.json()["id"]

        # Downvote first
        vote_response = await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "down"},
            headers=fresh_user_session.headers,
        )
        after_vote_count = vote_response.json()["new_vote_count"]

        # Remove vote
        remove_response = await client.delete(
            f"/api/v1/feedback/{feedback_id}/vote",
            headers=fresh_user_session.headers,
        )

        assert remove_response.status_code == 200
        data = remove_response.json()
        assert data["new_vote_count"] == after_vote_count + 1
        assert data["vote_type"] is None

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_remove_nonexistent_vote(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that removing nonexistent vote returns 404."""
        # Create feedback but don't vote
        create_response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "No vote removal test",
                "description": "Testing removal of a vote that doesn't exist.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        feedback_id = create_response.json()["id"]

        # Try to remove vote that doesn't exist
        response = await client.delete(
            f"/api/v1/feedback/{feedback_id}/vote",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_remove_vote_response_shows_null(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that remove vote response shows null vote_type."""
        # Create and vote
        create_response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Vote null test",
                "description": "Testing that removed vote shows null vote_type.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        feedback_id = create_response.json()["id"]

        await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "up"},
            headers=fresh_user_session.headers,
        )

        # Remove vote
        response = await client.delete(
            f"/api/v1/feedback/{feedback_id}/vote",
            headers=fresh_user_session.headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["vote_type"] is None
        assert data["feedback_id"] == feedback_id


# =============================================================================
# Test Feedback Workflows
# =============================================================================


class TestFeedbackWorkflow(E2ETestCase):
    """E2E tests for complete feedback workflows."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_complete_feedback_lifecycle(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test complete lifecycle: create, list, vote, unvote, delete."""
        # 1. Create feedback
        create_response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Lifecycle test",
                "description": "Testing the complete feedback lifecycle.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        assert create_response.status_code == 201
        feedback_id = create_response.json()["id"]

        # 2. List and find it
        list_response = await client.get(
            "/api/v1/feedback",
            headers=fresh_user_session.headers,
        )
        assert list_response.status_code == 200
        found = any(item["id"] == feedback_id for item in list_response.json()["items"])
        assert found

        # 3. Vote on it
        vote_response = await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "up"},
            headers=fresh_user_session.headers,
        )
        assert vote_response.status_code == 200
        assert vote_response.json()["new_vote_count"] == 1
        assert vote_response.json()["vote_type"] == "up"

        # 4. Verify vote via list endpoint (which includes user_vote)
        list_with_vote = await client.get(
            "/api/v1/feedback",
            headers=fresh_user_session.headers,
        )
        assert list_with_vote.status_code == 200
        voted_item = None
        for item in list_with_vote.json()["items"]:
            if item["id"] == feedback_id:
                voted_item = item
                break
        assert voted_item is not None
        assert voted_item["vote_count"] == 1
        # Note: user_vote in list may show vote status depending on implementation

        # 5. Remove vote
        unvote_response = await client.delete(
            f"/api/v1/feedback/{feedback_id}/vote",
            headers=fresh_user_session.headers,
        )
        assert unvote_response.status_code == 200
        assert unvote_response.json()["new_vote_count"] == 0

        # 6. Delete feedback
        delete_response = await client.delete(
            f"/api/v1/feedback/{feedback_id}",
            headers=fresh_user_session.headers,
        )
        assert delete_response.status_code == 204

        # 7. Verify it's gone
        final_get = await client.get(
            f"/api/v1/feedback/{feedback_id}",
            headers=fresh_user_session.headers,
        )
        assert final_get.status_code == 404

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_multi_user_voting_scenario(
        self, client: AsyncClient, db_session: AsyncSession, fresh_user_session: UserSession
    ) -> None:
        """Test multiple users voting on the same feedback."""
        # User 1 creates feedback
        create_response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Multi-user vote test",
                "description": "Testing multiple users voting on same feedback.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        feedback_id = create_response.json()["id"]

        # User 1 upvotes
        await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "up"},
            headers=fresh_user_session.headers,
        )

        # Create second user
        second_session = await self.register_and_login(
            client,
            email=f"e2e_multi_{uuid4().hex[:8]}@example.com",
            db_session=db_session,
        )

        # User 2 upvotes
        response = await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "up"},
            headers=second_session.headers,
        )

        assert response.status_code == 200
        assert response.json()["new_vote_count"] == 2

        # Create third user who downvotes
        third_session = await self.register_and_login(
            client,
            email=f"e2e_third_{uuid4().hex[:8]}@example.com",
            db_session=db_session,
        )

        response = await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "down"},
            headers=third_session.headers,
        )

        assert response.status_code == 200
        # 2 upvotes + 1 downvote = 1 net
        assert response.json()["new_vote_count"] == 1

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_vote_count_accuracy_with_multiple_users(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that vote count stays accurate with multiple vote changes."""
        # Create feedback
        create_response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Vote accuracy test",
                "description": "Testing vote count accuracy with multiple changes.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        feedback_id = create_response.json()["id"]

        # User 1 upvotes (count: +1)
        r1 = await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "up"},
            headers=fresh_user_session.headers,
        )
        assert r1.json()["new_vote_count"] == 1

        # User 1 changes to downvote (count: -1)
        r2 = await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "down"},
            headers=fresh_user_session.headers,
        )
        assert r2.json()["new_vote_count"] == -1

        # User 1 removes vote (count: 0)
        r3 = await client.delete(
            f"/api/v1/feedback/{feedback_id}/vote",
            headers=fresh_user_session.headers,
        )
        assert r3.json()["new_vote_count"] == 0

        # Final verification via GET
        final = await client.get(
            f"/api/v1/feedback/{feedback_id}",
            headers=fresh_user_session.headers,
        )
        assert final.json()["vote_count"] == 0


# =============================================================================
# Test Authentication Requirements
# =============================================================================


class TestFeedbackAuthentication(E2ETestCase):
    """E2E tests for feedback authentication requirements."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_list_feedback_unauthenticated(self, client: AsyncClient) -> None:
        """Test that listing feedback requires authentication."""
        response = await client.get("/api/v1/feedback")
        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_create_feedback_unauthenticated(self, client: AsyncClient) -> None:
        """Test that creating feedback requires authentication."""
        response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Unauth test",
                "description": "This should fail without authentication.",
                "category": "feature_request",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_vote_unauthenticated(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that voting requires authentication."""
        # Create feedback first
        create_response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Auth vote test",
                "description": "Testing vote authentication requirement.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        feedback_id = create_response.json()["id"]

        # Try to vote without auth
        response = await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "up"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_delete_vote_unauthenticated(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that deleting vote requires authentication."""
        # Create feedback first
        create_response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Auth delete vote test",
                "description": "Testing delete vote authentication requirement.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        feedback_id = create_response.json()["id"]

        # Try to delete vote without auth
        response = await client.delete(
            f"/api/v1/feedback/{feedback_id}/vote",
        )
        assert response.status_code == 401


# =============================================================================
# Test Validation
# =============================================================================


class TestFeedbackValidation(E2ETestCase):
    """E2E tests for feedback input validation."""

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_create_title_too_short(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that title must be at least 3 characters."""
        response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Hi",  # Too short (< 3)
                "description": "This has a valid description that is long enough.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_create_description_too_short(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that description must be at least 10 characters."""
        response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Valid title",
                "description": "Short",  # Too short (< 10)
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_create_invalid_category(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that category must be a valid enum value."""
        response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Valid title",
                "description": "This has a valid description that is long enough.",
                "category": "invalid_category",  # Not a valid enum
            },
            headers=fresh_user_session.headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_invalid_vote_type(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that vote_type must be 'up' or 'down'."""
        # Create feedback
        create_response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Vote validation test",
                "description": "Testing vote type validation.",
                "category": "feature_request",
            },
            headers=fresh_user_session.headers,
        )
        feedback_id = create_response.json()["id"]

        # Try invalid vote type
        response = await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "sideways"},  # Invalid
            headers=fresh_user_session.headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.e2e
    async def test_invalid_sort_field(
        self, client: AsyncClient, fresh_user_session: UserSession
    ) -> None:
        """Test that sort field must be valid."""
        response = await client.get(
            "/api/v1/feedback",
            params={"sort": "invalid_field"},
            headers=fresh_user_session.headers,
        )
        assert response.status_code == 422
