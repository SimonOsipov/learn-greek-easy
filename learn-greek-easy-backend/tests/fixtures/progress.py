"""Progress and Review fixtures for testing.

This module provides fixtures for testing spaced repetition functionality:

Progress Fixtures:
- user_deck_progress: Basic progress for a user on a deck
- user_with_deck_progress: User bundle with deck progress
- progress_with_mastery: Progress showing card mastery

Card Statistics Fixtures (SM-2 Algorithm):
- new_card_statistics: Fresh card (never reviewed)
- learning_card_statistics: Card in learning phase
- review_card_statistics: Card in review phase
- mastered_card_statistics: Fully mastered card
- due_card_statistics: Card due for review today
- overdue_card_statistics: Card past due date
- cards_by_status: Cards grouped by SM-2 status

Review Fixtures:
- test_review: Single review record
- review_history: Multiple reviews for a card
- perfect_review_history: All perfect (5) ratings
- struggling_review_history: Mixed poor ratings
- user_with_reviews: User with full review history

All fixtures integrate with existing auth and deck fixtures.

Usage:
    async def test_due_cards(
        authenticated_user: AuthenticatedUser,
        due_card_statistics: CardStatistics,
    ):
        # due_card_statistics is for a card due today
        assert due_card_statistics.next_review_date <= date.today()

    async def test_sm2_calculation(learning_card_statistics: CardStatistics):
        # learning_card_statistics has appropriate SM-2 values
        assert learning_card_statistics.status == CardStatus.LEARNING
        assert learning_card_statistics.repetitions > 0
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import date, datetime
from typing import Any, NamedTuple
from uuid import UUID

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardStatus, Deck, ReviewRating, User

# Import from sibling fixtures
from tests.fixtures.auth import AuthenticatedUser  # noqa: F401 - used in docstring example
from tests.fixtures.deck import DeckWithCards

# =============================================================================
# Type Definitions
# =============================================================================


class UserProgress(NamedTuple):
    """Container for user with their deck progress."""

    user: User
    deck: Deck
    progress: Any


class CardWithStatistics(NamedTuple):
    """Container for card with user statistics."""

    card: Any
    statistics: Any


class UserWithLearningData(NamedTuple):
    """Complete learning data bundle for a user."""

    user: User
    deck: Deck
    cards: list[Any]
    progress: Any
    card_statistics: list[Any]
    reviews: list[Any]


class CardsByStatus(NamedTuple):
    """Cards grouped by their SM-2 status."""

    new: list[Any]
    learning: list[Any]
    review: list[Any]
    mastered: list[Any]


class ReviewHistory(NamedTuple):
    """Container for card review history."""

    card: Any
    statistics: Any
    reviews: list[Any]


# =============================================================================
# SM-2 Algorithm Constants
# =============================================================================

# Default SM-2 values for new cards
SM2_DEFAULT_EASINESS_FACTOR = 2.5
SM2_MIN_EASINESS_FACTOR = 1.3

# Typical intervals after successful reviews
SM2_INTERVALS = {
    "first_success": 1,  # 1 day after first successful review
    "second_success": 6,  # 6 days after second success
    "learning": 1,  # Learning phase interval
    "review": 10,  # Typical review interval
    "mastered": 30,  # Mastered card interval
}


# =============================================================================
# Factory Functions - UserDeckProgress (V1 - stubs, V1 model removed)
# =============================================================================


def create_progress_data(
    user_id: UUID,
    deck_id: UUID,
    cards_studied: int = 0,
    cards_mastered: int = 0,
    last_studied_at: datetime | None = None,
) -> dict[str, Any]:
    """Create UserDeckProgress data dictionary.

    Args:
        user_id: User's UUID
        deck_id: Deck's UUID
        cards_studied: Number of cards studied
        cards_mastered: Number of cards mastered
        last_studied_at: Last study timestamp

    Returns:
        dict: Progress data for model creation
    """
    return {
        "user_id": user_id,
        "deck_id": deck_id,
        "cards_studied": cards_studied,
        "cards_mastered": cards_mastered,
        "last_studied_at": last_studied_at,
    }


async def create_user_deck_progress(
    db_session: AsyncSession,
    user: User,
    deck: Deck,
    cards_studied: int = 0,
    cards_mastered: int = 0,
    last_studied_at: datetime | None = None,
) -> Any:
    """Create UserDeckProgress in the database. (V1 - stub, V1 model removed)"""
    raise NotImplementedError("UserDeckProgress (V1) has been removed. Use V2 CardRecord progress.")


# =============================================================================
# Factory Functions - CardStatistics (V1 - stubs, V1 model removed)
# =============================================================================


def create_statistics_data(
    user_id: UUID,
    card_id: UUID,
    easiness_factor: float = SM2_DEFAULT_EASINESS_FACTOR,
    interval: int = 0,
    repetitions: int = 0,
    next_review_date: date | None = None,
    status: CardStatus = CardStatus.NEW,
) -> dict[str, Any]:
    """Create CardStatistics data dictionary. (V1 - stub)"""
    if next_review_date is None:
        next_review_date = date.today()

    return {
        "user_id": user_id,
        "card_id": card_id,
        "easiness_factor": easiness_factor,
        "interval": interval,
        "repetitions": repetitions,
        "next_review_date": next_review_date,
        "status": status,
    }


async def create_card_statistics(
    db_session: AsyncSession,
    user: User,
    card: Any,
    easiness_factor: float = SM2_DEFAULT_EASINESS_FACTOR,
    interval: int = 0,
    repetitions: int = 0,
    next_review_date: date | None = None,
    status: CardStatus = CardStatus.NEW,
) -> Any:
    """Create CardStatistics in the database. (V1 - stub, V1 model removed)"""
    raise NotImplementedError("CardStatistics (V1) has been removed. Use CardRecordStatistics.")


async def create_new_card_stats(
    db_session: AsyncSession,
    user: User,
    card: Any,
) -> Any:
    """Create statistics for a new (never reviewed) card. (V1 - stub)"""
    raise NotImplementedError("CardStatistics (V1) has been removed. Use CardRecordStatistics.")


async def create_learning_card_stats(
    db_session: AsyncSession,
    user: User,
    card: Any,
) -> Any:
    """Create statistics for a card in learning phase. (V1 - stub)"""
    raise NotImplementedError("CardStatistics (V1) has been removed. Use CardRecordStatistics.")


async def create_review_card_stats(
    db_session: AsyncSession,
    user: User,
    card: Any,
) -> Any:
    """Create statistics for a card in review phase. (V1 - stub)"""
    raise NotImplementedError("CardStatistics (V1) has been removed. Use CardRecordStatistics.")


async def create_mastered_card_stats(
    db_session: AsyncSession,
    user: User,
    card: Any,
) -> Any:
    """Create statistics for a mastered card. (V1 - stub)"""
    raise NotImplementedError("CardStatistics (V1) has been removed. Use CardRecordStatistics.")


async def create_due_card_stats(
    db_session: AsyncSession,
    user: User,
    card: Any,
) -> Any:
    """Create statistics for a card due for review today. (V1 - stub)"""
    raise NotImplementedError("CardStatistics (V1) has been removed. Use CardRecordStatistics.")


async def create_overdue_card_stats(
    db_session: AsyncSession,
    user: User,
    card: Any,
    days_overdue: int = 3,
) -> Any:
    """Create statistics for an overdue card. (V1 - stub)"""
    raise NotImplementedError("CardStatistics (V1) has been removed. Use CardRecordStatistics.")


# =============================================================================
# Factory Functions - Review (V1 - stubs, V1 model removed)
# =============================================================================


def create_review_data(
    user_id: UUID,
    card_id: UUID,
    quality: int = ReviewRating.CORRECT_HESITANT,
    time_taken: int = 5,
    reviewed_at: datetime | None = None,
) -> dict[str, Any]:
    """Create Review data dictionary. (V1 - stub)"""
    if reviewed_at is None:
        reviewed_at = datetime.utcnow()

    return {
        "user_id": user_id,
        "card_id": card_id,
        "quality": quality,
        "time_taken": time_taken,
        "reviewed_at": reviewed_at,
    }


async def create_review(
    db_session: AsyncSession,
    user: User,
    card: Any,
    quality: int = ReviewRating.CORRECT_HESITANT,
    time_taken: int = 5,
    reviewed_at: datetime | None = None,
) -> Any:
    """Create a Review in the database. (V1 - stub, V1 model removed)"""
    raise NotImplementedError("Review (V1) has been removed. Use CardRecordReview.")


async def create_review_history(
    db_session: AsyncSession,
    user: User,
    card: Any,
    ratings: list[int],
    start_date: datetime | None = None,
) -> list[Any]:
    """Create a series of reviews for a card. (V1 - stub, V1 model removed)"""
    raise NotImplementedError("Review (V1) has been removed. Use CardRecordReview.")


# =============================================================================
# Progress Fixtures (V1 - stubs, V1 model removed)
# =============================================================================


@pytest_asyncio.fixture
async def user_deck_progress(
    db_session: AsyncSession,
    test_user: User,
    test_deck: Deck,
) -> AsyncGenerator[Any, None]:
    """Provide basic progress for test_user on test_deck. (V1 - stub)"""
    raise NotImplementedError("UserDeckProgress (V1) has been removed.")
    yield  # type: ignore[misc]


@pytest_asyncio.fixture
async def fresh_user_progress(
    db_session: AsyncSession,
    test_user: User,
    test_deck: Deck,
) -> AsyncGenerator[Any, None]:
    """Provide progress for a user who just started. (V1 - stub)"""
    raise NotImplementedError("UserDeckProgress (V1) has been removed.")
    yield  # type: ignore[misc]


@pytest_asyncio.fixture
async def completed_deck_progress(
    db_session: AsyncSession,
    test_user: User,
    deck_with_cards: DeckWithCards,
) -> AsyncGenerator[Any, None]:
    """Provide progress for a fully completed deck. (V1 - stub)"""
    raise NotImplementedError("UserDeckProgress (V1) has been removed.")
    yield  # type: ignore[misc]


# =============================================================================
# CardStatistics Fixtures (V1 - stubs, V1 model removed)
# =============================================================================


@pytest_asyncio.fixture
async def new_card_statistics(
    db_session: AsyncSession,
    test_user: User,
    test_card: Any,
) -> AsyncGenerator[Any, None]:
    """Provide statistics for a new (never reviewed) card. (V1 - stub)"""
    raise NotImplementedError("CardStatistics (V1) has been removed.")
    yield  # type: ignore[misc]


@pytest_asyncio.fixture
async def learning_card_statistics(
    db_session: AsyncSession,
    test_user: User,
    test_card: Any,
) -> AsyncGenerator[Any, None]:
    """Provide statistics for a card in learning phase. (V1 - stub)"""
    raise NotImplementedError("CardStatistics (V1) has been removed.")
    yield  # type: ignore[misc]


@pytest_asyncio.fixture
async def review_card_statistics(
    db_session: AsyncSession,
    test_user: User,
    test_card: Any,
) -> AsyncGenerator[Any, None]:
    """Provide statistics for a card in review phase. (V1 - stub)"""
    raise NotImplementedError("CardStatistics (V1) has been removed.")
    yield  # type: ignore[misc]


@pytest_asyncio.fixture
async def mastered_card_statistics(
    db_session: AsyncSession,
    test_user: User,
    test_card: Any,
) -> AsyncGenerator[Any, None]:
    """Provide statistics for a fully mastered card. (V1 - stub)"""
    raise NotImplementedError("CardStatistics (V1) has been removed.")
    yield  # type: ignore[misc]


@pytest_asyncio.fixture
async def due_card_statistics(
    db_session: AsyncSession,
    test_user: User,
    test_card: Any,
) -> AsyncGenerator[Any, None]:
    """Provide statistics for a card due for review today. (V1 - stub)"""
    raise NotImplementedError("CardStatistics (V1) has been removed.")
    yield  # type: ignore[misc]


@pytest_asyncio.fixture
async def overdue_card_statistics(
    db_session: AsyncSession,
    test_user: User,
    test_card: Any,
) -> AsyncGenerator[Any, None]:
    """Provide statistics for an overdue card (3 days past due). (V1 - stub)"""
    raise NotImplementedError("CardStatistics (V1) has been removed.")
    yield  # type: ignore[misc]


@pytest_asyncio.fixture
async def cards_by_status(
    db_session: AsyncSession,
    test_user: User,
    deck_with_cards: DeckWithCards,
) -> AsyncGenerator[CardsByStatus, None]:
    """Provide cards grouped by SM-2 status. (V1 - stub)"""
    raise NotImplementedError("CardStatistics (V1) has been removed.")
    yield  # type: ignore[misc]


@pytest_asyncio.fixture
async def multiple_due_cards(
    db_session: AsyncSession,
    test_user: User,
    deck_with_cards: DeckWithCards,
) -> AsyncGenerator[list[Any], None]:
    """Provide multiple cards due for review. (V1 - stub)"""
    raise NotImplementedError("CardStatistics (V1) has been removed.")
    yield  # type: ignore[misc]


# =============================================================================
# Review Fixtures (V1 - stubs, V1 model removed)
# =============================================================================


@pytest_asyncio.fixture
async def test_review(
    db_session: AsyncSession,
    test_user: User,
    test_card: Any,
) -> AsyncGenerator[Any, None]:
    """Provide a single review record. (V1 - stub)"""
    raise NotImplementedError("Review (V1) has been removed.")
    yield  # type: ignore[misc]


@pytest_asyncio.fixture
async def perfect_review(
    db_session: AsyncSession,
    test_user: User,
    test_card: Any,
) -> AsyncGenerator[Any, None]:
    """Provide a perfect (quality=5) review. (V1 - stub)"""
    raise NotImplementedError("Review (V1) has been removed.")
    yield  # type: ignore[misc]


@pytest_asyncio.fixture
async def failed_review(
    db_session: AsyncSession,
    test_user: User,
    test_card: Any,
) -> AsyncGenerator[Any, None]:
    """Provide a failed (quality=0) review. (V1 - stub)"""
    raise NotImplementedError("Review (V1) has been removed.")
    yield  # type: ignore[misc]


@pytest_asyncio.fixture
async def review_history(
    db_session: AsyncSession,
    test_user: User,
    test_card: Any,
) -> AsyncGenerator[list[Any], None]:
    """Provide a realistic review history for a card. (V1 - stub)"""
    raise NotImplementedError("Review (V1) has been removed.")
    yield  # type: ignore[misc]


@pytest_asyncio.fixture
async def perfect_review_history(
    db_session: AsyncSession,
    test_user: User,
    test_card: Any,
) -> AsyncGenerator[list[Any], None]:
    """Provide a history of all perfect reviews. (V1 - stub)"""
    raise NotImplementedError("Review (V1) has been removed.")
    yield  # type: ignore[misc]


@pytest_asyncio.fixture
async def struggling_review_history(
    db_session: AsyncSession,
    test_user: User,
    test_card: Any,
) -> AsyncGenerator[list[Any], None]:
    """Provide a history showing struggle with a card. (V1 - stub)"""
    raise NotImplementedError("Review (V1) has been removed.")
    yield  # type: ignore[misc]


# =============================================================================
# Composite/Bundle Fixtures (V1 - stubs, V1 model removed)
# =============================================================================


@pytest_asyncio.fixture
async def user_with_deck_progress(
    db_session: AsyncSession,
    test_user: User,
    test_deck: Deck,
) -> AsyncGenerator[UserProgress, None]:
    """Provide a user bundled with their deck progress. (V1 - stub)"""
    raise NotImplementedError("UserDeckProgress (V1) has been removed.")
    yield  # type: ignore[misc]


@pytest_asyncio.fixture
async def card_with_statistics(
    db_session: AsyncSession,
    test_user: User,
    test_card: Any,
) -> AsyncGenerator[CardWithStatistics, None]:
    """Provide a card bundled with user statistics. (V1 - stub)"""
    raise NotImplementedError("CardStatistics (V1) has been removed.")
    yield  # type: ignore[misc]


@pytest_asyncio.fixture
async def card_with_review_history(
    db_session: AsyncSession,
    test_user: User,
    test_card: Any,
) -> AsyncGenerator[ReviewHistory, None]:
    """Provide a card with statistics and review history. (V1 - stub)"""
    raise NotImplementedError("CardStatistics/Review (V1) have been removed.")
    yield  # type: ignore[misc]


@pytest_asyncio.fixture
async def user_with_learning_progress(
    db_session: AsyncSession,
    test_user: User,
    deck_with_cards: DeckWithCards,
) -> AsyncGenerator[UserWithLearningData, None]:
    """Provide comprehensive learning data for a user. (V1 - stub)"""
    raise NotImplementedError("V1 Card/CardStatistics/Review models have been removed.")
    yield  # type: ignore[misc]


@pytest_asyncio.fixture
async def two_users_same_deck(
    db_session: AsyncSession,
    two_users: tuple[User, User],
    deck_with_cards: DeckWithCards,
) -> AsyncGenerator[tuple[UserProgress, UserProgress], None]:
    """Provide two users with progress on the same deck. (V1 - stub)"""
    raise NotImplementedError("UserDeckProgress (V1) has been removed.")
    yield  # type: ignore[misc]
