"""Integration tests for feedback API endpoints.

This module provides comprehensive tests for the feedback endpoints including:
- GET /api/v1/feedback - List feedback with filters and sorting
- POST /api/v1/feedback - Create new feedback
- GET /api/v1/feedback/{id} - Get single feedback
- DELETE /api/v1/feedback/{id} - Delete own feedback
- POST /api/v1/feedback/{id}/vote - Vote on feedback
- DELETE /api/v1/feedback/{id}/vote - Remove vote
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import FeedbackFactory, FeedbackVoteFactory, UserFactory


class TestListFeedbackEndpoint:
    """Test suite for GET /api/v1/feedback endpoint."""

    @pytest.mark.asyncio
    async def test_list_feedback_unauthenticated_returns_401(
        self, client: AsyncClient, feedback_url: str
    ):
        """Test that unauthenticated request returns 401."""
        response = await client.get(feedback_url)

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_list_feedback_empty(
        self, client: AsyncClient, feedback_url: str, auth_headers: dict
    ):
        """Test empty feedback list returns correct structure."""
        response = await client.get(feedback_url, headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["items"] == []
        assert data["page"] == 1
        assert data["page_size"] == 20

    @pytest.mark.asyncio
    async def test_list_feedback_with_data(
        self,
        client: AsyncClient,
        feedback_url: str,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Test returns feedback when data exists."""
        # Create feedback items
        await FeedbackFactory.create(user_id=test_user.id)
        await FeedbackFactory.create(user_id=test_user.id, bug=True)
        await FeedbackFactory.create(user_id=test_user.id, planned=True)

        response = await client.get(feedback_url, headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        assert len(data["items"]) == 3

    @pytest.mark.asyncio
    async def test_list_feedback_pagination(
        self,
        client: AsyncClient,
        feedback_url: str,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Test pagination works correctly."""
        # Create 5 feedback items
        for _ in range(5):
            await FeedbackFactory.create(user_id=test_user.id)

        # Get first page of 2
        response = await client.get(f"{feedback_url}?page=1&page_size=2", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert len(data["items"]) == 2
        assert data["page"] == 1
        assert data["page_size"] == 2

    @pytest.mark.asyncio
    async def test_list_feedback_filter_by_category(
        self,
        client: AsyncClient,
        feedback_url: str,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Test filtering by category works."""
        # Create mixed feedback
        await FeedbackFactory.create(user_id=test_user.id)  # feature_request
        await FeedbackFactory.create(user_id=test_user.id)  # feature_request
        await FeedbackFactory.create(user_id=test_user.id, bug=True)  # bug

        # Filter by bug category
        response = await client.get(
            f"{feedback_url}?category=bug_incorrect_data", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["category"] == "bug_incorrect_data"

    @pytest.mark.asyncio
    async def test_list_feedback_filter_by_status(
        self,
        client: AsyncClient,
        feedback_url: str,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Test filtering by status works."""
        # Create feedback with different statuses
        await FeedbackFactory.create(user_id=test_user.id)  # new
        await FeedbackFactory.create(user_id=test_user.id, planned=True)
        await FeedbackFactory.create(user_id=test_user.id, completed=True)

        # Filter by planned status
        response = await client.get(f"{feedback_url}?status=planned", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["status"] == "planned"

    @pytest.mark.asyncio
    async def test_list_feedback_sort_by_votes_desc(
        self,
        client: AsyncClient,
        feedback_url: str,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Test sorting by votes descending."""
        # Create feedback with different vote counts
        low = await FeedbackFactory.create(user_id=test_user.id, vote_count=1)
        high = await FeedbackFactory.create(user_id=test_user.id, vote_count=10)
        mid = await FeedbackFactory.create(user_id=test_user.id, vote_count=5)

        response = await client.get(f"{feedback_url}?sort=votes&order=desc", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        items = data["items"]
        assert len(items) == 3
        assert items[0]["id"] == str(high.id)
        assert items[1]["id"] == str(mid.id)
        assert items[2]["id"] == str(low.id)

    @pytest.mark.asyncio
    async def test_list_feedback_sort_by_created_at_asc(
        self,
        client: AsyncClient,
        feedback_url: str,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Test sorting by created_at ascending."""
        # Create feedback (they have sequential created_at times)
        first = await FeedbackFactory.create(user_id=test_user.id)
        second = await FeedbackFactory.create(user_id=test_user.id)
        third = await FeedbackFactory.create(user_id=test_user.id)

        response = await client.get(
            f"{feedback_url}?sort=created_at&order=asc", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        items = data["items"]
        assert len(items) == 3
        # First created should be first in list
        assert items[0]["id"] == str(first.id)
        assert items[1]["id"] == str(second.id)
        assert items[2]["id"] == str(third.id)

    @pytest.mark.asyncio
    async def test_list_feedback_response_includes_user_vote(
        self,
        client: AsyncClient,
        feedback_url: str,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Test that response includes current user's vote."""
        # Create feedback
        feedback = await FeedbackFactory.create(user_id=test_user.id)
        # User upvotes their own feedback
        await FeedbackVoteFactory.create(user_id=test_user.id, feedback_id=feedback.id)
        # Commit and expire all to ensure fresh data on next query
        # This is needed because the Feedback object was cached without votes,
        # and selectinload won't re-run if the relationship is considered "loaded"
        await db_session.commit()
        db_session.expire_all()

        response = await client.get(feedback_url, headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["user_vote"] == "up"

    @pytest.mark.asyncio
    async def test_list_feedback_invalid_page_returns_422(
        self, client: AsyncClient, feedback_url: str, auth_headers: dict
    ):
        """Test that page=0 returns 422."""
        response = await client.get(f"{feedback_url}?page=0", headers=auth_headers)

        assert response.status_code == 422


class TestCreateFeedbackEndpoint:
    """Test suite for POST /api/v1/feedback endpoint."""

    @pytest.mark.asyncio
    async def test_create_feedback_unauthenticated_returns_401(
        self, client: AsyncClient, feedback_url: str
    ):
        """Test that unauthenticated request returns 401."""
        response = await client.post(
            feedback_url,
            json={
                "title": "Test feedback",
                "description": "This is a test description that is long enough",
                "category": "feature_request",
            },
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_feedback_success(
        self, client: AsyncClient, feedback_url: str, auth_headers: dict, test_user
    ):
        """Test successful feedback creation."""
        response = await client.post(
            feedback_url,
            json={
                "title": "Add dark mode support",
                "description": "It would be great to have a dark mode option for studying at night.",
                "category": "feature_request",
            },
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Add dark mode support"
        assert (
            data["description"]
            == "It would be great to have a dark mode option for studying at night."
        )
        assert data["category"] == "feature_request"
        assert data["status"] == "new"
        assert data["vote_count"] == 0
        assert data["user_vote"] is None
        assert data["author"]["id"] == str(test_user.id)

    @pytest.mark.asyncio
    async def test_create_feedback_bug_category(
        self, client: AsyncClient, feedback_url: str, auth_headers: dict
    ):
        """Test creating bug report feedback."""
        response = await client.post(
            feedback_url,
            json={
                "title": "Wrong translation for word",
                "description": "The word 'hello' is translated incorrectly in the A1 deck.",
                "category": "bug_incorrect_data",
            },
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["category"] == "bug_incorrect_data"

    @pytest.mark.asyncio
    async def test_create_feedback_title_too_short_returns_422(
        self, client: AsyncClient, feedback_url: str, auth_headers: dict
    ):
        """Test that title must be at least 5 characters."""
        response = await client.post(
            feedback_url,
            json={
                "title": "Hi",
                "description": "This description is long enough for validation",
                "category": "feature_request",
            },
            headers=auth_headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_feedback_description_too_short_returns_422(
        self, client: AsyncClient, feedback_url: str, auth_headers: dict
    ):
        """Test that description must be at least 20 characters."""
        response = await client.post(
            feedback_url,
            json={
                "title": "Valid title here",
                "description": "Too short",
                "category": "feature_request",
            },
            headers=auth_headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_feedback_invalid_category_returns_422(
        self, client: AsyncClient, feedback_url: str, auth_headers: dict
    ):
        """Test that invalid category returns 422."""
        response = await client.post(
            feedback_url,
            json={
                "title": "Valid title here",
                "description": "This description is long enough for validation",
                "category": "invalid_category",
            },
            headers=auth_headers,
        )

        assert response.status_code == 422


class TestGetFeedbackEndpoint:
    """Test suite for GET /api/v1/feedback/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_feedback_unauthenticated_returns_401(
        self, client: AsyncClient, feedback_url: str
    ):
        """Test that unauthenticated request returns 401."""
        response = await client.get(f"{feedback_url}/{uuid4()}")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_feedback_success(
        self,
        client: AsyncClient,
        feedback_url: str,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Test successful feedback retrieval."""
        feedback = await FeedbackFactory.create(
            user_id=test_user.id,
            title="Test feedback title",
            description="Test feedback description that is long enough",
        )

        response = await client.get(f"{feedback_url}/{feedback.id}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(feedback.id)
        assert data["title"] == "Test feedback title"
        assert data["author"]["id"] == str(test_user.id)

    @pytest.mark.asyncio
    async def test_get_feedback_not_found_returns_404(
        self, client: AsyncClient, feedback_url: str, auth_headers: dict
    ):
        """Test that non-existent feedback returns 404."""
        response = await client.get(f"{feedback_url}/{uuid4()}", headers=auth_headers)

        assert response.status_code == 404


class TestDeleteFeedbackEndpoint:
    """Test suite for DELETE /api/v1/feedback/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_delete_feedback_unauthenticated_returns_401(
        self, client: AsyncClient, feedback_url: str
    ):
        """Test that unauthenticated request returns 401."""
        response = await client.delete(f"{feedback_url}/{uuid4()}")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_delete_own_feedback_success(
        self,
        client: AsyncClient,
        feedback_url: str,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Test successful deletion of own feedback."""
        feedback = await FeedbackFactory.create(user_id=test_user.id)

        response = await client.delete(f"{feedback_url}/{feedback.id}", headers=auth_headers)

        assert response.status_code == 204

        # Verify deletion
        get_response = await client.get(f"{feedback_url}/{feedback.id}", headers=auth_headers)
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_others_feedback_returns_403(
        self,
        client: AsyncClient,
        feedback_url: str,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test that deleting others' feedback returns 403."""
        # Create another user and their feedback
        other_user = await UserFactory.create()
        feedback = await FeedbackFactory.create(user_id=other_user.id)

        response = await client.delete(f"{feedback_url}/{feedback.id}", headers=auth_headers)

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_feedback_not_found_returns_404(
        self, client: AsyncClient, feedback_url: str, auth_headers: dict
    ):
        """Test that deleting non-existent feedback returns 404."""
        response = await client.delete(f"{feedback_url}/{uuid4()}", headers=auth_headers)

        assert response.status_code == 404


class TestVoteOnFeedbackEndpoint:
    """Test suite for POST /api/v1/feedback/{id}/vote endpoint."""

    @pytest.mark.asyncio
    async def test_vote_unauthenticated_returns_401(self, client: AsyncClient, feedback_url: str):
        """Test that unauthenticated request returns 401."""
        response = await client.post(
            f"{feedback_url}/{uuid4()}/vote",
            json={"vote_type": "up"},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_upvote_success(
        self,
        client: AsyncClient,
        feedback_url: str,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Test successful upvote."""
        feedback = await FeedbackFactory.create(user_id=test_user.id, vote_count=0)

        response = await client.post(
            f"{feedback_url}/{feedback.id}/vote",
            json={"vote_type": "up"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["feedback_id"] == str(feedback.id)
        assert data["vote_type"] == "up"
        assert data["new_vote_count"] == 1

    @pytest.mark.asyncio
    async def test_downvote_success(
        self,
        client: AsyncClient,
        feedback_url: str,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Test successful downvote."""
        feedback = await FeedbackFactory.create(user_id=test_user.id, vote_count=0)

        response = await client.post(
            f"{feedback_url}/{feedback.id}/vote",
            json={"vote_type": "down"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["vote_type"] == "down"
        assert data["new_vote_count"] == -1

    @pytest.mark.asyncio
    async def test_change_vote_from_up_to_down(
        self,
        client: AsyncClient,
        feedback_url: str,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Test changing vote from upvote to downvote."""
        feedback = await FeedbackFactory.create(user_id=test_user.id, vote_count=1)
        await FeedbackVoteFactory.create(user_id=test_user.id, feedback_id=feedback.id)  # upvote

        # Change to downvote
        response = await client.post(
            f"{feedback_url}/{feedback.id}/vote",
            json={"vote_type": "down"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["vote_type"] == "down"
        # Was +1, changed from +1 to -1 = difference of -2
        assert data["new_vote_count"] == -1

    @pytest.mark.asyncio
    async def test_vote_on_nonexistent_feedback_returns_404(
        self, client: AsyncClient, feedback_url: str, auth_headers: dict
    ):
        """Test voting on non-existent feedback returns 404."""
        response = await client.post(
            f"{feedback_url}/{uuid4()}/vote",
            json={"vote_type": "up"},
            headers=auth_headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_vote_invalid_type_returns_422(
        self,
        client: AsyncClient,
        feedback_url: str,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Test that invalid vote type returns 422."""
        feedback = await FeedbackFactory.create(user_id=test_user.id)

        response = await client.post(
            f"{feedback_url}/{feedback.id}/vote",
            json={"vote_type": "invalid"},
            headers=auth_headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_user_can_vote_on_own_feedback(
        self,
        client: AsyncClient,
        feedback_url: str,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Test that users can vote on their own feedback (per PRD)."""
        feedback = await FeedbackFactory.create(user_id=test_user.id)

        response = await client.post(
            f"{feedback_url}/{feedback.id}/vote",
            json={"vote_type": "up"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["vote_type"] == "up"


class TestRemoveVoteEndpoint:
    """Test suite for DELETE /api/v1/feedback/{id}/vote endpoint."""

    @pytest.mark.asyncio
    async def test_remove_vote_unauthenticated_returns_401(
        self, client: AsyncClient, feedback_url: str
    ):
        """Test that unauthenticated request returns 401."""
        response = await client.delete(f"{feedback_url}/{uuid4()}/vote")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_remove_vote_success(
        self,
        client: AsyncClient,
        feedback_url: str,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Test successful vote removal."""
        feedback = await FeedbackFactory.create(user_id=test_user.id, vote_count=1)
        await FeedbackVoteFactory.create(user_id=test_user.id, feedback_id=feedback.id)

        response = await client.delete(f"{feedback_url}/{feedback.id}/vote", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["feedback_id"] == str(feedback.id)
        assert data["vote_type"] is None
        assert data["new_vote_count"] == 0

    @pytest.mark.asyncio
    async def test_remove_nonexistent_vote_returns_404(
        self,
        client: AsyncClient,
        feedback_url: str,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Test removing non-existent vote returns 404."""
        feedback = await FeedbackFactory.create(user_id=test_user.id)

        response = await client.delete(f"{feedback_url}/{feedback.id}/vote", headers=auth_headers)

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_remove_vote_from_nonexistent_feedback_returns_404(
        self, client: AsyncClient, feedback_url: str, auth_headers: dict
    ):
        """Test removing vote from non-existent feedback returns 404."""
        response = await client.delete(f"{feedback_url}/{uuid4()}/vote", headers=auth_headers)

        assert response.status_code == 404


class TestFeedbackResponseFields:
    """Test suite for verifying response field structure."""

    @pytest.mark.asyncio
    async def test_feedback_response_has_all_fields(
        self,
        client: AsyncClient,
        feedback_url: str,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Test that feedback response includes all expected fields."""
        feedback = await FeedbackFactory.create(
            user_id=test_user.id,
            title="Test title",
            description="Test description that is long enough",
        )

        response = await client.get(f"{feedback_url}/{feedback.id}", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        # Check all expected fields
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

        # Check author fields
        assert "id" in data["author"]
        assert "full_name" in data["author"]

    @pytest.mark.asyncio
    async def test_feedback_list_response_structure(
        self,
        client: AsyncClient,
        feedback_url: str,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ):
        """Test that list response has correct structure."""
        await FeedbackFactory.create(user_id=test_user.id)

        response = await client.get(feedback_url, headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        # Check list response structure
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "items" in data
        assert isinstance(data["items"], list)
