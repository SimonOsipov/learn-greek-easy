"""Progress tracking model factories.

This module provides factories for progress-related models:
- UserDeckProgressFactory: User progress on decks
- CardStatisticsFactory: SM-2 algorithm statistics
- ReviewFactory: Individual review records

Usage:
    # Create progress for a user on a deck
    progress = await UserDeckProgressFactory.create(user_id=user.id, deck_id=deck.id)

    # Create SM-2 statistics for a card
    stats = await CardStatisticsFactory.create(user_id=user.id, card_id=card.id)

    # Create mastered card statistics
    mastered_stats = await CardStatisticsFactory.create(
        user_id=user.id, card_id=card.id, mastered=True
    )

    # Create a review
    review = await ReviewFactory.create(user_id=user.id, card_id=card.id)
"""

from datetime import date, datetime, timedelta

import factory
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    CardStatistics,
    CardStatus,
    Review,
    ReviewRating,
    UserDeckProgress,
)
from tests.factories.base import BaseFactory, utc_now


# =============================================================================
# SM-2 Algorithm Constants
# =============================================================================

SM2_DEFAULT_EASINESS_FACTOR = 2.5
SM2_MIN_EASINESS_FACTOR = 1.3

SM2_INTERVALS = {
    "first_success": 1,    # 1 day after first successful review
    "second_success": 6,   # 6 days after second success
    "learning": 1,         # Learning phase interval
    "review": 10,          # Typical review interval
    "mastered": 30,        # Mastered card interval
}


class UserDeckProgressFactory(BaseFactory):
    """Factory for UserDeckProgress model.

    Creates user progress records for deck study tracking.

    Traits:
        fresh: New user, no progress
        active: Some cards studied
        completed: All cards mastered

    Example:
        progress = await UserDeckProgressFactory.create(
            user_id=user.id, deck_id=deck.id
        )
        fresh = await UserDeckProgressFactory.create(
            user_id=user.id, deck_id=deck.id, fresh=True
        )
    """

    class Meta:
        model = UserDeckProgress

    # Required: Must be provided
    user_id = None  # Must be set explicitly
    deck_id = None  # Must be set explicitly

    # Default values
    cards_studied = 5
    cards_mastered = 2
    last_studied_at = factory.LazyFunction(utc_now)

    class Params:
        """Factory traits for common variations."""

        # Fresh progress (new user)
        fresh = factory.Trait(
            cards_studied=0,
            cards_mastered=0,
            last_studied_at=None,
        )

        # Active learner
        active = factory.Trait(
            cards_studied=10,
            cards_mastered=3,
            last_studied_at=factory.LazyFunction(utc_now),
        )

        # Completed deck
        completed = factory.Trait(
            cards_studied=50,
            cards_mastered=50,
            last_studied_at=factory.LazyFunction(utc_now),
        )

        # Stale progress (hasn't studied recently)
        stale = factory.Trait(
            last_studied_at=factory.LazyFunction(
                lambda: utc_now() - timedelta(days=30)
            ),
        )


class CardStatisticsFactory(BaseFactory):
    """Factory for CardStatistics model (SM-2 algorithm).

    Creates card statistics for spaced repetition testing.

    Traits:
        new: Never reviewed (NEW status)
        learning: In learning phase (LEARNING status)
        review: In review phase (REVIEW status)
        mastered: Fully mastered (MASTERED status)
        due: Due for review today
        overdue: Past due date

    Example:
        # New card
        stats = await CardStatisticsFactory.create(
            user_id=user.id, card_id=card.id, new=True
        )

        # Mastered card
        mastered = await CardStatisticsFactory.create(
            user_id=user.id, card_id=card.id, mastered=True
        )

        # Due for review today
        due = await CardStatisticsFactory.create(
            user_id=user.id, card_id=card.id, due=True
        )
    """

    class Meta:
        model = CardStatistics

    # Required: Must be provided
    user_id = None  # Must be set explicitly
    card_id = None  # Must be set explicitly

    # Default SM-2 values (card in learning phase)
    easiness_factor = SM2_DEFAULT_EASINESS_FACTOR
    interval = 1
    repetitions = 1
    next_review_date = factory.LazyFunction(lambda: date.today() + timedelta(days=1))
    status = CardStatus.LEARNING

    class Params:
        """Factory traits for SM-2 states."""

        # NEW: Never reviewed
        new = factory.Trait(
            easiness_factor=SM2_DEFAULT_EASINESS_FACTOR,
            interval=0,
            repetitions=0,
            next_review_date=factory.LazyFunction(date.today),
            status=CardStatus.NEW,
        )

        # LEARNING: In initial learning phase
        learning = factory.Trait(
            easiness_factor=2.36,  # Slightly decreased from reviews
            interval=SM2_INTERVALS["learning"],
            repetitions=2,
            next_review_date=factory.LazyFunction(
                lambda: date.today() + timedelta(days=1)
            ),
            status=CardStatus.LEARNING,
        )

        # REVIEW: Graduated to review phase
        review = factory.Trait(
            easiness_factor=SM2_DEFAULT_EASINESS_FACTOR,
            interval=SM2_INTERVALS["review"],
            repetitions=5,
            next_review_date=factory.LazyFunction(
                lambda: date.today() + timedelta(days=10)
            ),
            status=CardStatus.REVIEW,
        )

        # MASTERED: Fully mastered
        mastered = factory.Trait(
            easiness_factor=2.7,  # Increased from consistent success
            interval=SM2_INTERVALS["mastered"],
            repetitions=10,
            next_review_date=factory.LazyFunction(
                lambda: date.today() + timedelta(days=30)
            ),
            status=CardStatus.MASTERED,
        )

        # Due for review today
        due = factory.Trait(
            easiness_factor=SM2_DEFAULT_EASINESS_FACTOR,
            interval=5,
            repetitions=3,
            next_review_date=factory.LazyFunction(date.today),
            status=CardStatus.REVIEW,
        )

        # Overdue (past due date)
        overdue = factory.Trait(
            easiness_factor=SM2_DEFAULT_EASINESS_FACTOR,
            interval=5,
            repetitions=3,
            next_review_date=factory.LazyFunction(
                lambda: date.today() - timedelta(days=3)
            ),
            status=CardStatus.REVIEW,
        )

        # Struggling card (low EF)
        struggling = factory.Trait(
            easiness_factor=SM2_MIN_EASINESS_FACTOR,
            interval=1,
            repetitions=1,
            status=CardStatus.LEARNING,
        )


class ReviewFactory(BaseFactory):
    """Factory for Review model.

    Creates individual review records for analytics testing.

    Traits:
        perfect: Perfect recall (quality=5)
        failed: Complete blackout (quality=0)
        hesitant: Correct but hesitant (quality=4)
        hard: Correct but difficult (quality=3)

    Example:
        review = await ReviewFactory.create(user_id=user.id, card_id=card.id)
        perfect = await ReviewFactory.create(
            user_id=user.id, card_id=card.id, perfect=True
        )
    """

    class Meta:
        model = Review

    # Required: Must be provided
    user_id = None  # Must be set explicitly
    card_id = None  # Must be set explicitly

    # Default values
    quality = ReviewRating.CORRECT_HESITANT  # 4
    time_taken = 5  # seconds
    reviewed_at = factory.LazyFunction(utc_now)

    class Params:
        """Factory traits for review qualities."""

        # Perfect recall
        perfect = factory.Trait(
            quality=ReviewRating.PERFECT,  # 5
            time_taken=2,  # Quick response
        )

        # Complete blackout
        failed = factory.Trait(
            quality=ReviewRating.BLACKOUT,  # 0
            time_taken=15,  # Long time trying to remember
        )

        # Incorrect but easy to recall
        incorrect_easy = factory.Trait(
            quality=ReviewRating.INCORRECT_EASY,  # 2
            time_taken=8,
        )

        # Correct but difficult
        hard = factory.Trait(
            quality=ReviewRating.CORRECT_HARD,  # 3
            time_taken=10,
        )

        # Correct with hesitation
        hesitant = factory.Trait(
            quality=ReviewRating.CORRECT_HESITANT,  # 4
            time_taken=6,
        )

    @classmethod
    async def create_history(
        cls,
        user_id,
        card_id,
        ratings: list[int],
        session: AsyncSession | None = None,
        start_date: datetime | None = None,
    ) -> list[Review]:
        """Create a series of reviews for a card.

        Args:
            user_id: User ID
            card_id: Card ID
            ratings: List of quality ratings in chronological order
            session: Database session
            start_date: First review date (defaults to 30 days ago)

        Returns:
            List of Review records
        """
        if start_date is None:
            start_date = utc_now() - timedelta(days=30)

        reviews = []
        current_date = start_date

        for i, rating in enumerate(ratings):
            review = await cls.create(
                session=session,
                user_id=user_id,
                card_id=card_id,
                quality=rating,
                time_taken=3 + i,  # Varying time
                reviewed_at=current_date,
            )
            reviews.append(review)
            # Space reviews by increasing intervals
            current_date += timedelta(days=max(1, i * 2))

        return reviews
