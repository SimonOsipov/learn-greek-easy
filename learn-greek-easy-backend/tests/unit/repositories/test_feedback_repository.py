"""Unit tests for FeedbackRepository.

This module tests:
- list_with_filters: List feedback with pagination and filters
- count_with_filters: Count feedback matching filters
- get_with_user: Get feedback with user relationship loaded
- get_user_vote: Get user's vote on feedback
- upsert_vote: Create or update a vote
- remove_vote: Remove a vote

Tests use real database fixtures to verify SQL queries work correctly.
"""

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Feedback, FeedbackCategory, FeedbackStatus, FeedbackVote, User, VoteType
from src.repositories.feedback import FeedbackRepository

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def feedback_user(db_session: AsyncSession) -> User:
    """Create a user for feedback testing."""
    user = User(
        email="feedback_test@example.com",
        password_hash="hashed",
        full_name="Feedback Tester",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def feedback_items(db_session: AsyncSession, feedback_user: User) -> list[Feedback]:
    """Create multiple feedback items for testing."""
    items = []
    categories = [FeedbackCategory.FEATURE_REQUEST, FeedbackCategory.BUG_INCORRECT_DATA]

    for i in range(4):
        feedback = Feedback(
            user_id=feedback_user.id,
            title=f"Feedback {i + 1}",
            description=f"This is feedback item number {i + 1} with enough text.",
            category=categories[i % 2],
            status=FeedbackStatus.NEW,
            vote_count=i * 2,  # 0, 2, 4, 6
        )
        db_session.add(feedback)
        items.append(feedback)

    await db_session.flush()
    for item in items:
        await db_session.refresh(item)
    return items


@pytest.fixture
async def single_feedback(db_session: AsyncSession, feedback_user: User) -> Feedback:
    """Create a single feedback item for vote testing."""
    feedback = Feedback(
        user_id=feedback_user.id,
        title="Vote Test Feedback",
        description="This feedback item is used for testing votes.",
        category=FeedbackCategory.FEATURE_REQUEST,
        status=FeedbackStatus.NEW,
        vote_count=0,
    )
    db_session.add(feedback)
    await db_session.flush()
    await db_session.refresh(feedback)
    return feedback


# =============================================================================
# Test list_with_filters
# =============================================================================


class TestListWithFilters:
    """Tests for list_with_filters method."""

    @pytest.mark.asyncio
    async def test_returns_all_feedback(
        self,
        db_session: AsyncSession,
        feedback_items: list[Feedback],
    ):
        """Should return all feedback when no filters applied."""
        repo = FeedbackRepository(db_session)

        result = await repo.list_with_filters()

        assert len(result) >= len(feedback_items)

    @pytest.mark.asyncio
    async def test_filters_by_category(
        self,
        db_session: AsyncSession,
        feedback_items: list[Feedback],
    ):
        """Should filter by category."""
        repo = FeedbackRepository(db_session)

        result = await repo.list_with_filters(category=FeedbackCategory.FEATURE_REQUEST)

        for item in result:
            assert item.category == FeedbackCategory.FEATURE_REQUEST

    @pytest.mark.asyncio
    async def test_filters_by_status(
        self,
        db_session: AsyncSession,
        feedback_items: list[Feedback],
    ):
        """Should filter by status."""
        repo = FeedbackRepository(db_session)

        result = await repo.list_with_filters(status=FeedbackStatus.NEW)

        for item in result:
            assert item.status == FeedbackStatus.NEW

    @pytest.mark.asyncio
    async def test_sorts_by_vote_count_desc(
        self,
        db_session: AsyncSession,
        feedback_items: list[Feedback],
    ):
        """Should sort by vote count descending."""
        repo = FeedbackRepository(db_session)

        result = await repo.list_with_filters(sort_by="votes", sort_order="desc")

        if len(result) > 1:
            for i in range(len(result) - 1):
                assert result[i].vote_count >= result[i + 1].vote_count

    @pytest.mark.asyncio
    async def test_sorts_by_created_at_asc(
        self,
        db_session: AsyncSession,
        feedback_items: list[Feedback],
    ):
        """Should sort by created_at ascending."""
        repo = FeedbackRepository(db_session)

        result = await repo.list_with_filters(sort_by="created_at", sort_order="asc")

        if len(result) > 1:
            for i in range(len(result) - 1):
                assert result[i].created_at <= result[i + 1].created_at

    @pytest.mark.asyncio
    async def test_respects_pagination(
        self,
        db_session: AsyncSession,
        feedback_items: list[Feedback],
    ):
        """Should respect skip and limit."""
        repo = FeedbackRepository(db_session)

        result = await repo.list_with_filters(skip=1, limit=2)

        assert len(result) <= 2

    @pytest.mark.asyncio
    async def test_loads_user_relationship(
        self,
        db_session: AsyncSession,
        feedback_items: list[Feedback],
    ):
        """Should eagerly load user relationship."""
        repo = FeedbackRepository(db_session)

        result = await repo.list_with_filters(limit=1)

        if result:
            # User should be loaded (no additional query needed)
            assert result[0].user is not None
            assert result[0].user.full_name is not None


# =============================================================================
# Test count_with_filters
# =============================================================================


class TestCountWithFilters:
    """Tests for count_with_filters method."""

    @pytest.mark.asyncio
    async def test_counts_all_feedback(
        self,
        db_session: AsyncSession,
        feedback_items: list[Feedback],
    ):
        """Should count all feedback when no filters."""
        repo = FeedbackRepository(db_session)

        result = await repo.count_with_filters()

        assert result >= len(feedback_items)

    @pytest.mark.asyncio
    async def test_counts_by_category(
        self,
        db_session: AsyncSession,
        feedback_items: list[Feedback],
    ):
        """Should count filtered by category."""
        repo = FeedbackRepository(db_session)

        result = await repo.count_with_filters(category=FeedbackCategory.FEATURE_REQUEST)

        # Should have at least 2 (every other item is feature request)
        assert result >= 2

    @pytest.mark.asyncio
    async def test_counts_by_status(
        self,
        db_session: AsyncSession,
        feedback_items: list[Feedback],
    ):
        """Should count filtered by status."""
        repo = FeedbackRepository(db_session)

        result = await repo.count_with_filters(status=FeedbackStatus.NEW)

        # All items have NEW status
        assert result >= len(feedback_items)


# =============================================================================
# Test get_with_user
# =============================================================================


class TestGetWithUser:
    """Tests for get_with_user method."""

    @pytest.mark.asyncio
    async def test_returns_feedback_with_user(
        self,
        db_session: AsyncSession,
        single_feedback: Feedback,
    ):
        """Should return feedback with user loaded."""
        repo = FeedbackRepository(db_session)

        result = await repo.get_with_user(single_feedback.id)

        assert result is not None
        assert result.id == single_feedback.id
        assert result.user is not None
        assert result.user.full_name == "Feedback Tester"

    @pytest.mark.asyncio
    async def test_returns_none_for_nonexistent(
        self,
        db_session: AsyncSession,
    ):
        """Should return None for non-existent feedback."""
        repo = FeedbackRepository(db_session)

        result = await repo.get_with_user(uuid4())

        assert result is None

    @pytest.mark.asyncio
    async def test_loads_votes_relationship(
        self,
        db_session: AsyncSession,
        single_feedback: Feedback,
        feedback_user: User,
    ):
        """Should load votes relationship (empty list when no votes)."""
        repo = FeedbackRepository(db_session)

        result = await repo.get_with_user(single_feedback.id)

        assert result is not None
        # Votes relationship should be loaded (empty list initially)
        assert result.votes is not None
        assert isinstance(result.votes, list)


# =============================================================================
# Test get_user_vote
# =============================================================================


class TestGetUserVote:
    """Tests for get_user_vote method."""

    @pytest.mark.asyncio
    async def test_returns_vote_when_exists(
        self,
        db_session: AsyncSession,
        single_feedback: Feedback,
        feedback_user: User,
    ):
        """Should return vote when user has voted."""
        repo = FeedbackRepository(db_session)

        # Create a vote
        vote = FeedbackVote(
            feedback_id=single_feedback.id,
            user_id=feedback_user.id,
            vote_type=VoteType.UP,
        )
        db_session.add(vote)
        await db_session.flush()

        result = await repo.get_user_vote(single_feedback.id, feedback_user.id)

        assert result is not None
        assert result.vote_type == VoteType.UP

    @pytest.mark.asyncio
    async def test_returns_none_when_no_vote(
        self,
        db_session: AsyncSession,
        single_feedback: Feedback,
        feedback_user: User,
    ):
        """Should return None when user hasn't voted."""
        repo = FeedbackRepository(db_session)

        result = await repo.get_user_vote(single_feedback.id, feedback_user.id)

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_for_different_user(
        self,
        db_session: AsyncSession,
        single_feedback: Feedback,
        feedback_user: User,
    ):
        """Should return None for different user."""
        repo = FeedbackRepository(db_session)

        # Create a vote for feedback_user
        vote = FeedbackVote(
            feedback_id=single_feedback.id,
            user_id=feedback_user.id,
            vote_type=VoteType.UP,
        )
        db_session.add(vote)
        await db_session.flush()

        # Query for different user
        result = await repo.get_user_vote(single_feedback.id, uuid4())

        assert result is None


# =============================================================================
# Test upsert_vote
# =============================================================================


class TestUpsertVote:
    """Tests for upsert_vote method."""

    @pytest.mark.asyncio
    async def test_creates_new_upvote(
        self,
        db_session: AsyncSession,
        single_feedback: Feedback,
        feedback_user: User,
    ):
        """Should create new upvote and increase vote count."""
        repo = FeedbackRepository(db_session)

        vote, new_count = await repo.upsert_vote(single_feedback.id, feedback_user.id, VoteType.UP)

        assert vote is not None
        assert vote.vote_type == VoteType.UP
        assert new_count == 1

    @pytest.mark.asyncio
    async def test_creates_new_downvote(
        self,
        db_session: AsyncSession,
        single_feedback: Feedback,
        feedback_user: User,
    ):
        """Should create new downvote and decrease vote count."""
        repo = FeedbackRepository(db_session)

        vote, new_count = await repo.upsert_vote(
            single_feedback.id, feedback_user.id, VoteType.DOWN
        )

        assert vote is not None
        assert vote.vote_type == VoteType.DOWN
        assert new_count == -1

    @pytest.mark.asyncio
    async def test_updates_vote_from_up_to_down(
        self,
        db_session: AsyncSession,
        single_feedback: Feedback,
        feedback_user: User,
    ):
        """Should update existing upvote to downvote."""
        repo = FeedbackRepository(db_session)

        # First upvote
        await repo.upsert_vote(single_feedback.id, feedback_user.id, VoteType.UP)

        # Then change to downvote
        vote, new_count = await repo.upsert_vote(
            single_feedback.id, feedback_user.id, VoteType.DOWN
        )

        assert vote.vote_type == VoteType.DOWN
        # Was +1, now -1 = delta of -2
        assert new_count == -1

    @pytest.mark.asyncio
    async def test_updates_vote_from_down_to_up(
        self,
        db_session: AsyncSession,
        single_feedback: Feedback,
        feedback_user: User,
    ):
        """Should update existing downvote to upvote."""
        repo = FeedbackRepository(db_session)

        # First downvote
        await repo.upsert_vote(single_feedback.id, feedback_user.id, VoteType.DOWN)

        # Then change to upvote
        vote, new_count = await repo.upsert_vote(single_feedback.id, feedback_user.id, VoteType.UP)

        assert vote.vote_type == VoteType.UP
        # Was -1, now +1 = delta of +2
        assert new_count == 1

    @pytest.mark.asyncio
    async def test_same_vote_no_change(
        self,
        db_session: AsyncSession,
        single_feedback: Feedback,
        feedback_user: User,
    ):
        """Should not change count when voting same way twice."""
        repo = FeedbackRepository(db_session)

        # First upvote
        _, count1 = await repo.upsert_vote(single_feedback.id, feedback_user.id, VoteType.UP)

        # Second upvote (same)
        _, count2 = await repo.upsert_vote(single_feedback.id, feedback_user.id, VoteType.UP)

        assert count1 == count2

    @pytest.mark.asyncio
    async def test_raises_for_nonexistent_feedback(
        self,
        db_session: AsyncSession,
        feedback_user: User,
    ):
        """Should raise ValueError for non-existent feedback."""
        repo = FeedbackRepository(db_session)

        with pytest.raises(ValueError, match="not found"):
            await repo.upsert_vote(uuid4(), feedback_user.id, VoteType.UP)


# =============================================================================
# Test remove_vote
# =============================================================================


class TestRemoveVote:
    """Tests for remove_vote method."""

    @pytest.mark.asyncio
    async def test_removes_upvote(
        self,
        db_session: AsyncSession,
        single_feedback: Feedback,
        feedback_user: User,
    ):
        """Should remove upvote and decrease count."""
        repo = FeedbackRepository(db_session)

        # First create an upvote
        await repo.upsert_vote(single_feedback.id, feedback_user.id, VoteType.UP)

        # Then remove it
        new_count = await repo.remove_vote(single_feedback.id, feedback_user.id)

        assert new_count == 0

    @pytest.mark.asyncio
    async def test_removes_downvote(
        self,
        db_session: AsyncSession,
        single_feedback: Feedback,
        feedback_user: User,
    ):
        """Should remove downvote and increase count."""
        repo = FeedbackRepository(db_session)

        # First create a downvote
        await repo.upsert_vote(single_feedback.id, feedback_user.id, VoteType.DOWN)

        # Then remove it
        new_count = await repo.remove_vote(single_feedback.id, feedback_user.id)

        assert new_count == 0

    @pytest.mark.asyncio
    async def test_returns_none_when_no_vote(
        self,
        db_session: AsyncSession,
        single_feedback: Feedback,
        feedback_user: User,
    ):
        """Should return None when user hasn't voted."""
        repo = FeedbackRepository(db_session)

        result = await repo.remove_vote(single_feedback.id, feedback_user.id)

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_for_nonexistent_feedback(
        self,
        db_session: AsyncSession,
        feedback_user: User,
    ):
        """Should return None for non-existent feedback."""
        repo = FeedbackRepository(db_session)

        # First create a vote that doesn't point to real feedback
        result = await repo.remove_vote(uuid4(), feedback_user.id)

        assert result is None
