"""Feedback API endpoints.

This module provides HTTP endpoints for feedback operations including:
- Listing feedback with filters and sorting
- Creating new feedback
- Deleting own feedback
- Voting on feedback
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user
from src.core.exceptions import ForbiddenException, NotFoundException
from src.db.dependencies import get_db
from src.db.models import Feedback, FeedbackCategory, FeedbackStatus, User
from src.repositories.feedback import FeedbackRepository
from src.schemas.feedback import (
    AuthorBriefResponse,
    FeedbackCreate,
    FeedbackListResponse,
    FeedbackResponse,
    VoteRequest,
    VoteResponse,
)

router = APIRouter(
    tags=["Feedback"],
    responses={
        401: {"description": "Not authenticated"},
        422: {"description": "Validation error"},
    },
)


def _build_feedback_response(feedback: Feedback, user_id: UUID) -> FeedbackResponse:
    """Build FeedbackResponse with user's vote status.

    Args:
        feedback: Feedback model instance with votes loaded
        user_id: Current user's ID to check their vote

    Returns:
        FeedbackResponse with user_vote populated
    """
    # Find user's vote on this feedback
    user_vote = None
    for vote in feedback.votes:
        if vote.user_id == user_id:
            user_vote = vote.vote_type
            break

    return FeedbackResponse(
        id=feedback.id,
        title=feedback.title,
        description=feedback.description,
        category=feedback.category,
        status=feedback.status,
        vote_count=feedback.vote_count,
        user_vote=user_vote,
        author=AuthorBriefResponse(
            id=feedback.user.id,
            full_name=feedback.user.full_name,
        ),
        created_at=feedback.created_at,
        updated_at=feedback.updated_at,
    )


@router.get(
    "",
    response_model=FeedbackListResponse,
    summary="List feedback",
    description="Get paginated list of feedback with optional filters and sorting.",
    responses={
        200: {
            "description": "Paginated list of feedback items",
        },
    },
)
async def list_feedback(
    category: Optional[FeedbackCategory] = Query(
        default=None,
        description="Filter by category (feature_request or bug_incorrect_data)",
    ),
    status_filter: Optional[FeedbackStatus] = Query(
        default=None,
        alias="status",
        description="Filter by status",
    ),
    sort: str = Query(
        default="created_at",
        pattern="^(votes|created_at)$",
        description="Sort field: 'votes' or 'created_at'",
    ),
    order: str = Query(
        default="desc",
        pattern="^(asc|desc)$",
        description="Sort order: 'asc' or 'desc'",
    ),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=50, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FeedbackListResponse:
    """List all feedback with pagination, filters, and sorting.

    Args:
        category: Filter by feedback category
        status_filter: Filter by status
        sort: Sort field (votes or created_at)
        order: Sort order (asc or desc)
        page: Page number (starting from 1)
        page_size: Items per page (max 50)
        db: Database session
        current_user: Authenticated user

    Returns:
        FeedbackListResponse with total count and paginated items
    """
    repo = FeedbackRepository(db)

    skip = (page - 1) * page_size

    items = await repo.list_with_filters(
        category=category,
        status=status_filter,
        sort_by=sort,
        sort_order=order,
        skip=skip,
        limit=page_size,
    )

    total = await repo.count_with_filters(
        category=category,
        status=status_filter,
    )

    return FeedbackListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[_build_feedback_response(item, current_user.id) for item in items],
    )


@router.post(
    "",
    response_model=FeedbackResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create feedback",
    description="Submit new feedback or bug report.",
    responses={
        201: {"description": "Feedback created successfully"},
    },
)
async def create_feedback(
    feedback_data: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FeedbackResponse:
    """Create new feedback item.

    Args:
        feedback_data: Feedback creation data
        db: Database session
        current_user: Authenticated user (becomes author)

    Returns:
        Created FeedbackResponse
    """
    repo = FeedbackRepository(db)

    # Create feedback with current user as author
    feedback = await repo.create(
        {
            "user_id": current_user.id,
            "title": feedback_data.title,
            "description": feedback_data.description,
            "category": feedback_data.category,
        }
    )

    await db.commit()
    await db.refresh(feedback)

    # Reload with relationships
    feedback_with_user = await repo.get_with_user(feedback.id)
    # This should never be None since we just created the feedback
    assert feedback_with_user is not None

    return _build_feedback_response(feedback_with_user, current_user.id)


@router.get(
    "/{feedback_id}",
    response_model=FeedbackResponse,
    summary="Get feedback",
    description="Get a single feedback item by ID.",
    responses={
        200: {"description": "Feedback details"},
        404: {"description": "Feedback not found"},
    },
)
async def get_feedback(
    feedback_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FeedbackResponse:
    """Get feedback by ID.

    Args:
        feedback_id: UUID of feedback to retrieve
        db: Database session
        current_user: Authenticated user

    Returns:
        FeedbackResponse

    Raises:
        NotFoundException: If feedback doesn't exist
    """
    repo = FeedbackRepository(db)

    feedback = await repo.get_with_user(feedback_id)
    if feedback is None:
        raise NotFoundException(
            resource="Feedback", detail=f"Feedback with ID '{feedback_id}' not found"
        )

    return _build_feedback_response(feedback, current_user.id)


@router.delete(
    "/{feedback_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete feedback",
    description="Delete your own feedback item.",
    responses={
        204: {"description": "Feedback deleted"},
        403: {"description": "Cannot delete others' feedback"},
        404: {"description": "Feedback not found"},
    },
)
async def delete_feedback(
    feedback_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete feedback (own items only).

    Args:
        feedback_id: UUID of feedback to delete
        db: Database session
        current_user: Authenticated user

    Raises:
        NotFoundException: If feedback doesn't exist
        ForbiddenException: If trying to delete others' feedback
    """
    repo = FeedbackRepository(db)

    feedback = await repo.get(feedback_id)
    if feedback is None:
        raise NotFoundException(
            resource="Feedback", detail=f"Feedback with ID '{feedback_id}' not found"
        )

    # Only allow deleting own feedback (or superuser)
    if feedback.user_id != current_user.id and not current_user.is_superuser:
        raise ForbiddenException(detail="You can only delete your own feedback")

    await repo.delete(feedback)
    await db.commit()


@router.post(
    "/{feedback_id}/vote",
    response_model=VoteResponse,
    summary="Vote on feedback",
    description="Cast or change your vote on a feedback item.",
    responses={
        200: {"description": "Vote recorded"},
        404: {"description": "Feedback not found"},
    },
)
async def vote_on_feedback(
    feedback_id: UUID,
    vote_data: VoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VoteResponse:
    """Vote on feedback (upvote or downvote).

    If user already voted, this changes their vote.

    Args:
        feedback_id: UUID of feedback to vote on
        vote_data: Vote type (up or down)
        db: Database session
        current_user: Authenticated user

    Returns:
        VoteResponse with new vote count

    Raises:
        NotFoundException: If feedback doesn't exist
    """
    repo = FeedbackRepository(db)

    # Verify feedback exists
    feedback = await repo.get(feedback_id)
    if feedback is None:
        raise NotFoundException(
            resource="Feedback", detail=f"Feedback with ID '{feedback_id}' not found"
        )

    # Create or update vote
    vote, new_count = await repo.upsert_vote(
        feedback_id=feedback_id,
        user_id=current_user.id,
        vote_type=vote_data.vote_type,
    )

    await db.commit()

    return VoteResponse(
        feedback_id=feedback_id,
        vote_type=vote.vote_type,
        new_vote_count=new_count,
    )


@router.delete(
    "/{feedback_id}/vote",
    response_model=VoteResponse,
    summary="Remove vote",
    description="Remove your vote from a feedback item.",
    responses={
        200: {"description": "Vote removed"},
        404: {"description": "Feedback or vote not found"},
    },
)
async def remove_vote(
    feedback_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VoteResponse:
    """Remove vote from feedback.

    Args:
        feedback_id: UUID of feedback
        db: Database session
        current_user: Authenticated user

    Returns:
        VoteResponse with new vote count

    Raises:
        NotFoundException: If feedback doesn't exist or user hasn't voted
    """
    repo = FeedbackRepository(db)

    # Verify feedback exists
    feedback = await repo.get(feedback_id)
    if feedback is None:
        raise NotFoundException(
            resource="Feedback", detail=f"Feedback with ID '{feedback_id}' not found"
        )

    # Remove vote
    new_count = await repo.remove_vote(
        feedback_id=feedback_id,
        user_id=current_user.id,
    )

    if new_count is None:
        raise NotFoundException(resource="Vote", detail="You haven't voted on this feedback")

    await db.commit()

    return VoteResponse(
        feedback_id=feedback_id,
        vote_type=None,  # Vote was removed
        new_vote_count=new_count,
    )
