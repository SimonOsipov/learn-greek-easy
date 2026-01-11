"""Feedback repository for database operations."""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import asc, case, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import Feedback, FeedbackCategory, FeedbackStatus, FeedbackVote, VoteType
from src.repositories.base import BaseRepository


class FeedbackRepository(BaseRepository[Feedback]):
    """Repository for Feedback model operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(Feedback, db)

    async def list_with_filters(
        self,
        *,
        category: Optional[FeedbackCategory] = None,
        status: Optional[FeedbackStatus] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        skip: int = 0,
        limit: int = 20,
    ) -> List[Feedback]:
        """List feedback with filters and sorting."""
        query = select(Feedback).options(
            selectinload(Feedback.user),
            selectinload(Feedback.votes),
        )

        if category is not None:
            query = query.where(Feedback.category == category)
        if status is not None:
            query = query.where(Feedback.status == status)

        sort_column = Feedback.vote_count if sort_by == "votes" else Feedback.created_at
        order_func = desc if sort_order == "desc" else asc
        query = query.order_by(order_func(sort_column))

        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_with_filters(
        self,
        *,
        category: Optional[FeedbackCategory] = None,
        status: Optional[FeedbackStatus] = None,
    ) -> int:
        """Count feedback items matching filters."""
        query = select(func.count()).select_from(Feedback)

        if category is not None:
            query = query.where(Feedback.category == category)
        if status is not None:
            query = query.where(Feedback.status == status)

        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_with_user(self, feedback_id: UUID) -> Optional[Feedback]:
        """Get feedback by ID with user loaded."""
        query = (
            select(Feedback)
            .options(
                selectinload(Feedback.user),
                selectinload(Feedback.votes),
            )
            .where(Feedback.id == feedback_id)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_user_vote(self, feedback_id: UUID, user_id: UUID) -> Optional[FeedbackVote]:
        """Get user's vote on a feedback item."""
        query = select(FeedbackVote).where(
            FeedbackVote.feedback_id == feedback_id,
            FeedbackVote.user_id == user_id,
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def upsert_vote(
        self,
        feedback_id: UUID,
        user_id: UUID,
        vote_type: VoteType,
    ) -> tuple[FeedbackVote, int]:
        """Create or update a vote on feedback."""
        existing_vote = await self.get_user_vote(feedback_id, user_id)
        feedback = await self.get(feedback_id)
        if feedback is None:
            raise ValueError(f"Feedback {feedback_id} not found")

        if existing_vote:
            old_value = 1 if existing_vote.vote_type == VoteType.UP else -1
            new_value = 1 if vote_type == VoteType.UP else -1
            delta = new_value - old_value

            existing_vote.vote_type = vote_type
            feedback.vote_count += delta
            vote = existing_vote
        else:
            vote = FeedbackVote(
                feedback_id=feedback_id,
                user_id=user_id,
                vote_type=vote_type,
            )
            self.db.add(vote)

            delta = 1 if vote_type == VoteType.UP else -1
            feedback.vote_count += delta

        await self.db.flush()
        return vote, feedback.vote_count

    async def remove_vote(self, feedback_id: UUID, user_id: UUID) -> Optional[int]:
        """Remove user's vote from feedback."""
        existing_vote = await self.get_user_vote(feedback_id, user_id)

        if not existing_vote:
            return None

        feedback = await self.get(feedback_id)
        if feedback is None:
            return None

        delta = -1 if existing_vote.vote_type == VoteType.UP else 1
        feedback.vote_count += delta

        await self.db.delete(existing_vote)
        await self.db.flush()

        return feedback.vote_count

    async def list_for_admin(
        self,
        *,
        status: Optional[FeedbackStatus] = None,
        category: Optional[FeedbackCategory] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> List[Feedback]:
        """List feedback for admin with special sorting (NEW status first).

        Sorting: NEW status items first, then by created_at DESC.
        """
        query = select(Feedback).options(
            selectinload(Feedback.user),
        )

        if status is not None:
            query = query.where(Feedback.status == status)
        if category is not None:
            query = query.where(Feedback.category == category)

        # Sort NEW status first (0), all others second (1), then by created_at DESC
        status_priority = case(
            (Feedback.status == FeedbackStatus.NEW, 0),
            else_=1,
        )
        query = query.order_by(status_priority, desc(Feedback.created_at))

        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())
