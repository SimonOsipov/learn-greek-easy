"""Feedback model factories.

This module provides factories for feedback-related models:
- FeedbackFactory: User feedback submissions
- FeedbackVoteFactory: Votes on feedback items

Usage:
    # Create a feature request feedback
    feedback = await FeedbackFactory.create(user_id=user.id)

    # Create a bug report
    bug = await FeedbackFactory.create(user_id=user.id, bug=True)

    # Create a planned feedback with votes
    planned = await FeedbackFactory.create(user_id=user.id, planned=True, popular=True)

    # Create a vote on feedback
    vote = await FeedbackVoteFactory.create(user_id=user.id, feedback_id=feedback.id)

    # Create a downvote
    downvote = await FeedbackVoteFactory.create(
        user_id=user.id, feedback_id=feedback.id, downvote=True
    )
"""

import factory

from src.db.models import Feedback, FeedbackCategory, FeedbackStatus, FeedbackVote, VoteType
from tests.factories.base import BaseFactory, fake


class FeedbackFactory(BaseFactory):
    """Factory for Feedback model.

    Creates user feedback submissions with configurable categories and statuses.

    Traits:
        bug: Sets category to BUG_INCORRECT_DATA
        planned: Sets status to PLANNED
        under_review: Sets status to UNDER_REVIEW
        in_progress: Sets status to IN_PROGRESS
        completed: Sets status to COMPLETED
        popular: Sets vote_count to 10

    Example:
        feedback = await FeedbackFactory.create(user_id=user.id)
        bug_report = await FeedbackFactory.create(user_id=user.id, bug=True)
        popular_feedback = await FeedbackFactory.create(user_id=user.id, popular=True)
    """

    class Meta:
        model = Feedback

    # Required: Must be provided
    user_id = None  # Must be set explicitly

    # Default values
    title = factory.LazyAttribute(
        lambda _: fake.sentence(nb_words=6)[:50]  # Ensure within title length
    )
    description = factory.LazyAttribute(
        lambda _: fake.paragraph(nb_sentences=3)  # Generates 50+ chars
    )
    category = FeedbackCategory.FEATURE_REQUEST
    status = FeedbackStatus.NEW
    vote_count = 0

    class Params:
        """Factory traits for common variations."""

        # Category traits
        bug = factory.Trait(
            category=FeedbackCategory.BUG_INCORRECT_DATA,
            title=factory.LazyAttribute(lambda _: f"Bug: {fake.sentence(nb_words=4)}"[:50]),
        )

        # Status traits
        planned = factory.Trait(
            status=FeedbackStatus.PLANNED,
        )

        under_review = factory.Trait(
            status=FeedbackStatus.UNDER_REVIEW,
        )

        in_progress = factory.Trait(
            status=FeedbackStatus.IN_PROGRESS,
        )

        completed = factory.Trait(
            status=FeedbackStatus.COMPLETED,
        )

        cancelled = factory.Trait(
            status=FeedbackStatus.CANCELLED,
        )

        # Vote count trait
        popular = factory.Trait(
            vote_count=10,
        )


class FeedbackVoteFactory(BaseFactory):
    """Factory for FeedbackVote model.

    Creates votes on feedback items.

    Traits:
        downvote: Sets vote_type to DOWN

    Example:
        upvote = await FeedbackVoteFactory.create(
            user_id=user.id, feedback_id=feedback.id
        )
        downvote = await FeedbackVoteFactory.create(
            user_id=user.id, feedback_id=feedback.id, downvote=True
        )
    """

    class Meta:
        model = FeedbackVote

    # Required: Must be provided
    user_id = None  # Must be set explicitly
    feedback_id = None  # Must be set explicitly

    # Default values
    vote_type = VoteType.UP

    class Params:
        """Factory traits for common variations."""

        downvote = factory.Trait(
            vote_type=VoteType.DOWN,
        )
