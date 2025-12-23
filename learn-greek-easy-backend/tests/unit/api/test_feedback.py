"""Unit tests for feedback API endpoints.

Tests cover:
- Feedback creation (POST /api/v1/feedback)
- Feedback listing with filters/sorting (GET /api/v1/feedback)
- Feedback detail retrieval (GET /api/v1/feedback/{id})
- Feedback deletion (DELETE /api/v1/feedback/{id})
- Voting on feedback (POST /api/v1/feedback/{id}/vote)
- Vote removal (DELETE /api/v1/feedback/{id}/vote)

These tests mock the FeedbackRepository to test endpoint logic in isolation.
For full integration tests, see tests/integration/api/test_feedback.py
"""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient

from src.db.models import Feedback, FeedbackCategory, FeedbackStatus, FeedbackVote, User, VoteType

# =============================================================================
# Helper Functions
# =============================================================================


def create_mock_user(
    user_id=None,
    full_name="Test Author",
    is_superuser=False,
):
    """Create a mock User object for testing."""
    mock = MagicMock(spec=User)
    mock.id = user_id or uuid4()
    mock.full_name = full_name
    mock.is_superuser = is_superuser
    return mock


def create_mock_feedback(
    feedback_id=None,
    user_id=None,
    title="Test Feedback",
    description="Test description for feedback item",
    category=FeedbackCategory.FEATURE_REQUEST,
    status=FeedbackStatus.NEW,
    vote_count=0,
    votes=None,
    user=None,
):
    """Create a mock Feedback object for testing."""
    mock = MagicMock(spec=Feedback)
    mock.id = feedback_id or uuid4()
    mock.user_id = user_id or uuid4()
    mock.title = title
    mock.description = description
    mock.category = category
    mock.status = status
    mock.vote_count = vote_count
    mock.votes = votes or []
    mock.created_at = datetime.utcnow()
    mock.updated_at = datetime.utcnow()

    # Create mock user
    if user is None:
        mock_user = create_mock_user(user_id=mock.user_id)
        mock.user = mock_user
    else:
        mock.user = user

    return mock


def create_mock_vote(
    vote_id=None,
    user_id=None,
    feedback_id=None,
    vote_type=VoteType.UP,
):
    """Create a mock FeedbackVote object for testing."""
    mock = MagicMock(spec=FeedbackVote)
    mock.id = vote_id or uuid4()
    mock.user_id = user_id or uuid4()
    mock.feedback_id = feedback_id or uuid4()
    mock.vote_type = vote_type
    return mock


# =============================================================================
# TestFeedbackListUnit - Tests for GET /api/v1/feedback
# =============================================================================


class TestFeedbackListUnit:
    """Unit tests for GET /api/v1/feedback endpoint."""

    @pytest.mark.asyncio
    async def test_list_feedback_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test successful feedback listing returns paginated response."""
        mock_feedback = create_mock_feedback()

        with patch("src.api.v1.feedback.FeedbackRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.list_with_filters.return_value = [mock_feedback]
            mock_repo.count_with_filters.return_value = 1
            mock_repo_class.return_value = mock_repo

            response = await client.get(
                "/api/v1/feedback",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert "total" in data
            assert "items" in data
            assert "page" in data
            assert "page_size" in data
            assert data["total"] == 1
            assert len(data["items"]) == 1

    @pytest.mark.asyncio
    async def test_list_feedback_unauthenticated_returns_401(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated requests return 401."""
        response = await client.get("/api/v1/feedback")
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_list_feedback_with_category_filter(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test category filter is passed to repository."""
        with patch("src.api.v1.feedback.FeedbackRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.list_with_filters.return_value = []
            mock_repo.count_with_filters.return_value = 0
            mock_repo_class.return_value = mock_repo

            response = await client.get(
                "/api/v1/feedback?category=feature_request",
                headers=auth_headers,
            )

            assert response.status_code == 200
            mock_repo.list_with_filters.assert_called_once()
            call_kwargs = mock_repo.list_with_filters.call_args.kwargs
            assert call_kwargs["category"] == FeedbackCategory.FEATURE_REQUEST

    @pytest.mark.asyncio
    async def test_list_feedback_with_status_filter(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test status filter is passed to repository."""
        with patch("src.api.v1.feedback.FeedbackRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.list_with_filters.return_value = []
            mock_repo.count_with_filters.return_value = 0
            mock_repo_class.return_value = mock_repo

            response = await client.get(
                "/api/v1/feedback?status=new",
                headers=auth_headers,
            )

            assert response.status_code == 200
            call_kwargs = mock_repo.list_with_filters.call_args.kwargs
            assert call_kwargs["status"] == FeedbackStatus.NEW

    @pytest.mark.asyncio
    async def test_list_feedback_sort_by_votes(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test sort by votes parameter."""
        with patch("src.api.v1.feedback.FeedbackRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.list_with_filters.return_value = []
            mock_repo.count_with_filters.return_value = 0
            mock_repo_class.return_value = mock_repo

            response = await client.get(
                "/api/v1/feedback?sort=votes&order=desc",
                headers=auth_headers,
            )

            assert response.status_code == 200
            call_kwargs = mock_repo.list_with_filters.call_args.kwargs
            assert call_kwargs["sort_by"] == "votes"
            assert call_kwargs["sort_order"] == "desc"

    @pytest.mark.asyncio
    async def test_list_feedback_pagination(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test pagination parameters."""
        with patch("src.api.v1.feedback.FeedbackRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.list_with_filters.return_value = []
            mock_repo.count_with_filters.return_value = 0
            mock_repo_class.return_value = mock_repo

            response = await client.get(
                "/api/v1/feedback?page=2&page_size=10",
                headers=auth_headers,
            )

            assert response.status_code == 200
            call_kwargs = mock_repo.list_with_filters.call_args.kwargs
            assert call_kwargs["skip"] == 10  # (page 2 - 1) * page_size 10
            assert call_kwargs["limit"] == 10

    @pytest.mark.asyncio
    async def test_list_feedback_invalid_sort_returns_422(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test invalid sort parameter returns 422."""
        response = await client.get(
            "/api/v1/feedback?sort=invalid",
            headers=auth_headers,
        )
        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"


# =============================================================================
# TestFeedbackCreationUnit - Tests for POST /api/v1/feedback
# =============================================================================


class TestFeedbackCreationUnit:
    """Unit tests for POST /api/v1/feedback endpoint."""

    @pytest.mark.asyncio
    async def test_create_feedback_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session,
    ):
        """Test successful feedback creation."""
        mock_feedback = create_mock_feedback(
            title="New Feature Request",
            description="Please add this feature to the application",
            category=FeedbackCategory.FEATURE_REQUEST,
        )
        # Need to give the mock an ID attribute that returns a UUID for get_with_user call
        mock_feedback.id = uuid4()

        with patch("src.api.v1.feedback.FeedbackRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.create.return_value = mock_feedback
            mock_repo.get_with_user.return_value = mock_feedback
            mock_repo_class.return_value = mock_repo

            # Patch the db session methods that are called after create
            with patch.object(db_session, "commit", new_callable=AsyncMock):
                with patch.object(db_session, "refresh", new_callable=AsyncMock):
                    response = await client.post(
                        "/api/v1/feedback",
                        json={
                            "title": "New Feature Request",
                            "description": "Please add this feature to the application",
                            "category": "feature_request",
                        },
                        headers=auth_headers,
                    )

            assert response.status_code == 201
            data = response.json()
            assert data["title"] == "New Feature Request"
            assert data["category"] == "feature_request"

    @pytest.mark.asyncio
    async def test_create_feedback_unauthenticated_returns_401(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated requests return 401."""
        response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Test Title Here",
                "description": "Test description here for feedback",
                "category": "feature_request",
            },
        )
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_create_feedback_empty_title_returns_422(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that empty title returns 422."""
        response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "",
                "description": "Valid description here for feedback",
                "category": "feature_request",
            },
            headers=auth_headers,
        )
        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_create_feedback_title_too_short_returns_422(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that title < 3 chars returns 422."""
        response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "ab",  # Less than min_length=3
                "description": "Valid description here for feedback",
                "category": "feature_request",
            },
            headers=auth_headers,
        )
        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_create_feedback_description_too_short_returns_422(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that description < 10 chars returns 422."""
        response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Valid Title",
                "description": "short",  # Less than min_length=10
                "category": "feature_request",
            },
            headers=auth_headers,
        )
        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_create_feedback_invalid_category_returns_422(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that invalid category returns 422."""
        response = await client.post(
            "/api/v1/feedback",
            json={
                "title": "Valid Title",
                "description": "Valid description here for feedback",
                "category": "invalid_category",
            },
            headers=auth_headers,
        )
        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False


# =============================================================================
# TestFeedbackDetailUnit - Tests for GET /api/v1/feedback/{id}
# =============================================================================


class TestFeedbackDetailUnit:
    """Unit tests for GET /api/v1/feedback/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_feedback_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test successful feedback retrieval."""
        feedback_id = uuid4()
        mock_feedback = create_mock_feedback(feedback_id=feedback_id)

        with patch("src.api.v1.feedback.FeedbackRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get_with_user.return_value = mock_feedback
            mock_repo_class.return_value = mock_repo

            response = await client.get(
                f"/api/v1/feedback/{feedback_id}",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["id"] == str(feedback_id)
            assert "title" in data
            assert "vote_count" in data
            assert "author" in data

    @pytest.mark.asyncio
    async def test_get_feedback_not_found_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that non-existent feedback returns 404."""
        feedback_id = uuid4()

        with patch("src.api.v1.feedback.FeedbackRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get_with_user.return_value = None
            mock_repo_class.return_value = mock_repo

            response = await client.get(
                f"/api/v1/feedback/{feedback_id}",
                headers=auth_headers,
            )

            assert response.status_code == 404
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_get_feedback_invalid_uuid_returns_422(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that invalid UUID returns 422."""
        response = await client.get(
            "/api/v1/feedback/not-a-uuid",
            headers=auth_headers,
        )
        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_get_feedback_includes_user_vote(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
    ):
        """Test that user's vote is included in response."""
        feedback_id = uuid4()
        user_vote = create_mock_vote(
            user_id=test_user.id,
            feedback_id=feedback_id,
            vote_type=VoteType.UP,
        )
        mock_feedback = create_mock_feedback(
            feedback_id=feedback_id,
            votes=[user_vote],
        )

        with patch("src.api.v1.feedback.FeedbackRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get_with_user.return_value = mock_feedback
            mock_repo_class.return_value = mock_repo

            response = await client.get(
                f"/api/v1/feedback/{feedback_id}",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["user_vote"] == "up"

    @pytest.mark.asyncio
    async def test_get_feedback_unauthenticated_returns_401(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated requests return 401."""
        feedback_id = uuid4()
        response = await client.get(f"/api/v1/feedback/{feedback_id}")
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False


# =============================================================================
# TestFeedbackDeleteUnit - Tests for DELETE /api/v1/feedback/{id}
# =============================================================================


class TestFeedbackDeleteUnit:
    """Unit tests for DELETE /api/v1/feedback/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_delete_own_feedback_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
    ):
        """Test successful deletion of own feedback."""
        feedback_id = uuid4()
        mock_feedback = create_mock_feedback(
            feedback_id=feedback_id,
            user_id=test_user.id,
        )

        with patch("src.api.v1.feedback.FeedbackRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_feedback
            mock_repo.delete.return_value = None
            mock_repo_class.return_value = mock_repo

            response = await client.delete(
                f"/api/v1/feedback/{feedback_id}",
                headers=auth_headers,
            )

            assert response.status_code == 204
            mock_repo.delete.assert_called_once_with(mock_feedback)

    @pytest.mark.asyncio
    async def test_delete_others_feedback_returns_403(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
    ):
        """Test that deleting others' feedback returns 403."""
        feedback_id = uuid4()
        other_user_id = uuid4()
        mock_feedback = create_mock_feedback(
            feedback_id=feedback_id,
            user_id=other_user_id,  # Different user
        )

        with patch("src.api.v1.feedback.FeedbackRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_feedback
            mock_repo_class.return_value = mock_repo

            response = await client.delete(
                f"/api/v1/feedback/{feedback_id}",
                headers=auth_headers,
            )

            assert response.status_code == 403
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "FORBIDDEN"

    @pytest.mark.asyncio
    async def test_delete_feedback_not_found_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test that deleting non-existent feedback returns 404."""
        feedback_id = uuid4()

        with patch("src.api.v1.feedback.FeedbackRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = None
            mock_repo_class.return_value = mock_repo

            response = await client.delete(
                f"/api/v1/feedback/{feedback_id}",
                headers=auth_headers,
            )

            assert response.status_code == 404
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_superuser_can_delete_any_feedback(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Test that superuser can delete any feedback."""
        feedback_id = uuid4()
        other_user_id = uuid4()
        mock_feedback = create_mock_feedback(
            feedback_id=feedback_id,
            user_id=other_user_id,
        )

        with patch("src.api.v1.feedback.FeedbackRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_feedback
            mock_repo.delete.return_value = None
            mock_repo_class.return_value = mock_repo

            response = await client.delete(
                f"/api/v1/feedback/{feedback_id}",
                headers=superuser_auth_headers,
            )

            assert response.status_code == 204
            mock_repo.delete.assert_called_once_with(mock_feedback)

    @pytest.mark.asyncio
    async def test_delete_feedback_unauthenticated_returns_401(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated requests return 401."""
        feedback_id = uuid4()
        response = await client.delete(f"/api/v1/feedback/{feedback_id}")
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False


# =============================================================================
# TestFeedbackVotingUnit - Tests for POST/DELETE /api/v1/feedback/{id}/vote
# =============================================================================


class TestFeedbackVotingUnit:
    """Unit tests for voting endpoints."""

    @pytest.mark.asyncio
    async def test_upvote_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test successful upvote."""
        feedback_id = uuid4()
        mock_feedback = create_mock_feedback(feedback_id=feedback_id)
        mock_vote = create_mock_vote(
            feedback_id=feedback_id,
            vote_type=VoteType.UP,
        )

        with patch("src.api.v1.feedback.FeedbackRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_feedback
            mock_repo.upsert_vote.return_value = (mock_vote, 1)
            mock_repo_class.return_value = mock_repo

            response = await client.post(
                f"/api/v1/feedback/{feedback_id}/vote",
                json={"vote_type": "up"},
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["vote_type"] == "up"
            assert data["new_vote_count"] == 1

    @pytest.mark.asyncio
    async def test_downvote_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test successful downvote."""
        feedback_id = uuid4()
        mock_feedback = create_mock_feedback(feedback_id=feedback_id)
        mock_vote = create_mock_vote(
            feedback_id=feedback_id,
            vote_type=VoteType.DOWN,
        )

        with patch("src.api.v1.feedback.FeedbackRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_feedback
            mock_repo.upsert_vote.return_value = (mock_vote, -1)
            mock_repo_class.return_value = mock_repo

            response = await client.post(
                f"/api/v1/feedback/{feedback_id}/vote",
                json={"vote_type": "down"},
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["vote_type"] == "down"
            assert data["new_vote_count"] == -1

    @pytest.mark.asyncio
    async def test_vote_on_nonexistent_feedback_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test voting on non-existent feedback returns 404."""
        feedback_id = uuid4()

        with patch("src.api.v1.feedback.FeedbackRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = None
            mock_repo_class.return_value = mock_repo

            response = await client.post(
                f"/api/v1/feedback/{feedback_id}/vote",
                json={"vote_type": "up"},
                headers=auth_headers,
            )

            assert response.status_code == 404
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_vote_invalid_type_returns_422(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test invalid vote type returns 422."""
        feedback_id = uuid4()

        response = await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "invalid"},
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_remove_vote_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test successful vote removal."""
        feedback_id = uuid4()
        mock_feedback = create_mock_feedback(feedback_id=feedback_id)

        with patch("src.api.v1.feedback.FeedbackRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_feedback
            mock_repo.remove_vote.return_value = 0  # New vote count
            mock_repo_class.return_value = mock_repo

            response = await client.delete(
                f"/api/v1/feedback/{feedback_id}/vote",
                headers=auth_headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["vote_type"] is None
            assert data["new_vote_count"] == 0

    @pytest.mark.asyncio
    async def test_remove_vote_not_voted_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test removing non-existent vote returns 404."""
        feedback_id = uuid4()
        mock_feedback = create_mock_feedback(feedback_id=feedback_id)

        with patch("src.api.v1.feedback.FeedbackRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = mock_feedback
            mock_repo.remove_vote.return_value = None  # No existing vote
            mock_repo_class.return_value = mock_repo

            response = await client.delete(
                f"/api/v1/feedback/{feedback_id}/vote",
                headers=auth_headers,
            )

            assert response.status_code == 404
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_remove_vote_feedback_not_found_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Test removing vote from non-existent feedback returns 404."""
        feedback_id = uuid4()

        with patch("src.api.v1.feedback.FeedbackRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = None
            mock_repo_class.return_value = mock_repo

            response = await client.delete(
                f"/api/v1/feedback/{feedback_id}/vote",
                headers=auth_headers,
            )

            assert response.status_code == 404
            data = response.json()
            assert data["success"] is False

    @pytest.mark.asyncio
    async def test_vote_unauthenticated_returns_401(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated vote requests return 401."""
        feedback_id = uuid4()
        response = await client.post(
            f"/api/v1/feedback/{feedback_id}/vote",
            json={"vote_type": "up"},
        )
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_remove_vote_unauthenticated_returns_401(
        self,
        client: AsyncClient,
    ):
        """Test that unauthenticated vote removal returns 401."""
        feedback_id = uuid4()
        response = await client.delete(f"/api/v1/feedback/{feedback_id}/vote")
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False
