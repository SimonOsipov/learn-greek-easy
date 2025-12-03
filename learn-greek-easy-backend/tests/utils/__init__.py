"""Test utilities for Learn Greek Easy.

This package provides utility classes for testing:
- builders: Fluent test data builders

Usage:
    from tests.utils import ReviewSessionBuilder, ProgressScenarioBuilder

    async def test_review_session(db_session, test_user, deck_with_cards):
        result = await (
            ReviewSessionBuilder(db_session)
            .for_user(test_user)
            .for_deck(deck_with_cards.deck)
            .with_cards(deck_with_cards.cards[:5])
            .with_ratings([5, 4, 4, 3, 5])
            .build()
        )
        assert len(result.reviews) == 5
"""

from tests.utils.builders import (
    ProgressScenarioBuilder,
    ProgressScenarioResult,
    ReviewSessionBuilder,
    ReviewSessionResult,
    StudyStreakBuilder,
    StudyStreakResult,
)

__all__ = [
    # Result Containers
    "ProgressScenarioResult",
    "ReviewSessionResult",
    "StudyStreakResult",
    # Builders
    "ProgressScenarioBuilder",
    "ReviewSessionBuilder",
    "StudyStreakBuilder",
]
