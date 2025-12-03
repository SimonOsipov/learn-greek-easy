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

from collections.abc import AsyncGenerator
from datetime import date, datetime, timedelta
from typing import Any, NamedTuple
from uuid import UUID

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    Card,
    CardStatistics,
    CardStatus,
    Deck,
    Review,
    ReviewRating,
    User,
    UserDeckProgress,
)

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
    progress: UserDeckProgress


class CardWithStatistics(NamedTuple):
    """Container for card with user statistics."""

    card: Card
    statistics: CardStatistics


class UserWithLearningData(NamedTuple):
    """Complete learning data bundle for a user."""

    user: User
    deck: Deck
    cards: list[Card]
    progress: UserDeckProgress
    card_statistics: list[CardStatistics]
    reviews: list[Review]


class CardsByStatus(NamedTuple):
    """Cards grouped by their SM-2 status."""

    new: list[CardStatistics]
    learning: list[CardStatistics]
    review: list[CardStatistics]
    mastered: list[CardStatistics]


class ReviewHistory(NamedTuple):
    """Container for card review history."""

    card: Card
    statistics: CardStatistics
    reviews: list[Review]


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
# Factory Functions - UserDeckProgress
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
) -> UserDeckProgress:
    """Create UserDeckProgress in the database.

    Args:
        db_session: Database session
        user: User who has progress
        deck: Deck being studied
        cards_studied: Number of cards studied
        cards_mastered: Number of cards mastered
        last_studied_at: Last study timestamp

    Returns:
        UserDeckProgress: Created progress record
    """
    progress_data = create_progress_data(
        user_id=user.id,
        deck_id=deck.id,
        cards_studied=cards_studied,
        cards_mastered=cards_mastered,
        last_studied_at=last_studied_at,
    )
    progress = UserDeckProgress(**progress_data)
    db_session.add(progress)
    await db_session.commit()
    await db_session.refresh(progress)
    return progress


# =============================================================================
# Factory Functions - CardStatistics
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
    """Create CardStatistics data dictionary.

    Args:
        user_id: User's UUID
        card_id: Card's UUID
        easiness_factor: SM-2 easiness factor (1.3-2.5+)
        interval: Days until next review
        repetitions: Successful review count
        next_review_date: Next scheduled review
        status: Card learning status

    Returns:
        dict: Statistics data for model creation
    """
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
    card: Card,
    easiness_factor: float = SM2_DEFAULT_EASINESS_FACTOR,
    interval: int = 0,
    repetitions: int = 0,
    next_review_date: date | None = None,
    status: CardStatus = CardStatus.NEW,
) -> CardStatistics:
    """Create CardStatistics in the database.

    Args:
        db_session: Database session
        user: User who owns statistics
        card: Card being tracked
        easiness_factor: SM-2 EF value
        interval: Days between reviews
        repetitions: Successful reviews count
        next_review_date: Next review date
        status: Learning status

    Returns:
        CardStatistics: Created statistics record
    """
    stats_data = create_statistics_data(
        user_id=user.id,
        card_id=card.id,
        easiness_factor=easiness_factor,
        interval=interval,
        repetitions=repetitions,
        next_review_date=next_review_date,
        status=status,
    )
    stats = CardStatistics(**stats_data)
    db_session.add(stats)
    await db_session.commit()
    await db_session.refresh(stats)
    return stats


async def create_new_card_stats(
    db_session: AsyncSession,
    user: User,
    card: Card,
) -> CardStatistics:
    """Create statistics for a new (never reviewed) card.

    Args:
        db_session: Database session
        user: User
        card: Card

    Returns:
        CardStatistics: New card statistics
    """
    return await create_card_statistics(
        db_session,
        user,
        card,
        easiness_factor=SM2_DEFAULT_EASINESS_FACTOR,
        interval=0,
        repetitions=0,
        next_review_date=date.today(),
        status=CardStatus.NEW,
    )


async def create_learning_card_stats(
    db_session: AsyncSession,
    user: User,
    card: Card,
) -> CardStatistics:
    """Create statistics for a card in learning phase.

    Simulates a card after 2 reviews, still in learning.

    Args:
        db_session: Database session
        user: User
        card: Card

    Returns:
        CardStatistics: Learning phase statistics
    """
    return await create_card_statistics(
        db_session,
        user,
        card,
        easiness_factor=2.36,  # Decreased slightly from reviews
        interval=SM2_INTERVALS["learning"],
        repetitions=2,
        next_review_date=date.today() + timedelta(days=1),
        status=CardStatus.LEARNING,
    )


async def create_review_card_stats(
    db_session: AsyncSession,
    user: User,
    card: Card,
) -> CardStatistics:
    """Create statistics for a card in review phase.

    Simulates a card that graduated from learning.

    Args:
        db_session: Database session
        user: User
        card: Card

    Returns:
        CardStatistics: Review phase statistics
    """
    return await create_card_statistics(
        db_session,
        user,
        card,
        easiness_factor=2.5,
        interval=SM2_INTERVALS["review"],
        repetitions=5,
        next_review_date=date.today() + timedelta(days=10),
        status=CardStatus.REVIEW,
    )


async def create_mastered_card_stats(
    db_session: AsyncSession,
    user: User,
    card: Card,
) -> CardStatistics:
    """Create statistics for a mastered card.

    Simulates a card with many successful reviews.

    Args:
        db_session: Database session
        user: User
        card: Card

    Returns:
        CardStatistics: Mastered card statistics
    """
    return await create_card_statistics(
        db_session,
        user,
        card,
        easiness_factor=2.7,  # Increased from consistent success
        interval=SM2_INTERVALS["mastered"],
        repetitions=10,
        next_review_date=date.today() + timedelta(days=30),
        status=CardStatus.MASTERED,
    )


async def create_due_card_stats(
    db_session: AsyncSession,
    user: User,
    card: Card,
) -> CardStatistics:
    """Create statistics for a card due for review today.

    Args:
        db_session: Database session
        user: User
        card: Card

    Returns:
        CardStatistics: Due card statistics
    """
    return await create_card_statistics(
        db_session,
        user,
        card,
        easiness_factor=2.5,
        interval=5,
        repetitions=3,
        next_review_date=date.today(),  # Due today
        status=CardStatus.REVIEW,
    )


async def create_overdue_card_stats(
    db_session: AsyncSession,
    user: User,
    card: Card,
    days_overdue: int = 3,
) -> CardStatistics:
    """Create statistics for an overdue card.

    Args:
        db_session: Database session
        user: User
        card: Card
        days_overdue: How many days past due

    Returns:
        CardStatistics: Overdue card statistics
    """
    return await create_card_statistics(
        db_session,
        user,
        card,
        easiness_factor=2.5,
        interval=5,
        repetitions=3,
        next_review_date=date.today() - timedelta(days=days_overdue),
        status=CardStatus.REVIEW,
    )


# =============================================================================
# Factory Functions - Review
# =============================================================================


def create_review_data(
    user_id: UUID,
    card_id: UUID,
    quality: int = ReviewRating.CORRECT_HESITANT,
    time_taken: int = 5,
    reviewed_at: datetime | None = None,
) -> dict[str, Any]:
    """Create Review data dictionary.

    Args:
        user_id: User's UUID
        card_id: Card's UUID
        quality: SM-2 quality rating (0-5)
        time_taken: Seconds spent on review
        reviewed_at: Review timestamp

    Returns:
        dict: Review data for model creation
    """
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
    card: Card,
    quality: int = ReviewRating.CORRECT_HESITANT,
    time_taken: int = 5,
    reviewed_at: datetime | None = None,
) -> Review:
    """Create a Review in the database.

    Args:
        db_session: Database session
        user: User who reviewed
        card: Card reviewed
        quality: SM-2 quality (0-5)
        time_taken: Seconds spent
        reviewed_at: Review timestamp

    Returns:
        Review: Created review record
    """
    review_data = create_review_data(
        user_id=user.id,
        card_id=card.id,
        quality=quality,
        time_taken=time_taken,
        reviewed_at=reviewed_at,
    )
    review = Review(**review_data)
    db_session.add(review)
    await db_session.commit()
    await db_session.refresh(review)
    return review


async def create_review_history(
    db_session: AsyncSession,
    user: User,
    card: Card,
    ratings: list[int],
    start_date: datetime | None = None,
) -> list[Review]:
    """Create a series of reviews for a card.

    Args:
        db_session: Database session
        user: User
        card: Card
        ratings: List of quality ratings in chronological order
        start_date: First review date (defaults to 30 days ago)

    Returns:
        list[Review]: Review history
    """
    if start_date is None:
        start_date = datetime.utcnow() - timedelta(days=30)

    reviews = []
    current_date = start_date

    for i, rating in enumerate(ratings):
        review = await create_review(
            db_session,
            user,
            card,
            quality=rating,
            time_taken=3 + i,  # Varying time
            reviewed_at=current_date,
        )
        reviews.append(review)
        # Space reviews by increasing intervals (simulating SM-2)
        current_date += timedelta(days=max(1, i * 2))

    return reviews


# =============================================================================
# Progress Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def user_deck_progress(
    db_session: AsyncSession,
    test_user: User,
    test_deck: Deck,
) -> AsyncGenerator[UserDeckProgress, None]:
    """Provide basic progress for test_user on test_deck.

    Creates progress with:
    - 5 cards studied
    - 2 cards mastered
    - Last studied today

    Yields:
        UserDeckProgress: User's progress on the deck
    """
    progress = await create_user_deck_progress(
        db_session,
        test_user,
        test_deck,
        cards_studied=5,
        cards_mastered=2,
        last_studied_at=datetime.utcnow(),
    )
    yield progress


@pytest_asyncio.fixture
async def fresh_user_progress(
    db_session: AsyncSession,
    test_user: User,
    test_deck: Deck,
) -> AsyncGenerator[UserDeckProgress, None]:
    """Provide progress for a user who just started.

    Creates progress with:
    - 0 cards studied
    - 0 cards mastered
    - Never studied

    Yields:
        UserDeckProgress: Fresh progress record
    """
    progress = await create_user_deck_progress(
        db_session,
        test_user,
        test_deck,
        cards_studied=0,
        cards_mastered=0,
        last_studied_at=None,
    )
    yield progress


@pytest_asyncio.fixture
async def completed_deck_progress(
    db_session: AsyncSession,
    test_user: User,
    deck_with_cards: DeckWithCards,
) -> AsyncGenerator[UserDeckProgress, None]:
    """Provide progress for a fully completed deck.

    Creates progress where all cards are studied and mastered.

    Yields:
        UserDeckProgress: Completed deck progress
    """
    card_count = len(deck_with_cards.cards)
    progress = await create_user_deck_progress(
        db_session,
        test_user,
        deck_with_cards.deck,
        cards_studied=card_count,
        cards_mastered=card_count,
        last_studied_at=datetime.utcnow(),
    )
    yield progress


# =============================================================================
# CardStatistics Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def new_card_statistics(
    db_session: AsyncSession,
    test_user: User,
    test_card: Card,
) -> AsyncGenerator[CardStatistics, None]:
    """Provide statistics for a new (never reviewed) card.

    SM-2 values:
    - easiness_factor: 2.5 (default)
    - interval: 0
    - repetitions: 0
    - status: NEW

    Yields:
        CardStatistics: New card statistics
    """
    stats = await create_new_card_stats(db_session, test_user, test_card)
    yield stats


@pytest_asyncio.fixture
async def learning_card_statistics(
    db_session: AsyncSession,
    test_user: User,
    test_card: Card,
) -> AsyncGenerator[CardStatistics, None]:
    """Provide statistics for a card in learning phase.

    SM-2 values:
    - easiness_factor: 2.36
    - interval: 1
    - repetitions: 2
    - status: LEARNING

    Yields:
        CardStatistics: Learning card statistics
    """
    stats = await create_learning_card_stats(db_session, test_user, test_card)
    yield stats


@pytest_asyncio.fixture
async def review_card_statistics(
    db_session: AsyncSession,
    test_user: User,
    test_card: Card,
) -> AsyncGenerator[CardStatistics, None]:
    """Provide statistics for a card in review phase.

    SM-2 values:
    - easiness_factor: 2.5
    - interval: 10
    - repetitions: 5
    - status: REVIEW

    Yields:
        CardStatistics: Review card statistics
    """
    stats = await create_review_card_stats(db_session, test_user, test_card)
    yield stats


@pytest_asyncio.fixture
async def mastered_card_statistics(
    db_session: AsyncSession,
    test_user: User,
    test_card: Card,
) -> AsyncGenerator[CardStatistics, None]:
    """Provide statistics for a fully mastered card.

    SM-2 values:
    - easiness_factor: 2.7
    - interval: 30
    - repetitions: 10
    - status: MASTERED

    Yields:
        CardStatistics: Mastered card statistics
    """
    stats = await create_mastered_card_stats(db_session, test_user, test_card)
    yield stats


@pytest_asyncio.fixture
async def due_card_statistics(
    db_session: AsyncSession,
    test_user: User,
    test_card: Card,
) -> AsyncGenerator[CardStatistics, None]:
    """Provide statistics for a card due for review today.

    next_review_date is set to today.

    Yields:
        CardStatistics: Due card statistics
    """
    stats = await create_due_card_stats(db_session, test_user, test_card)
    yield stats


@pytest_asyncio.fixture
async def overdue_card_statistics(
    db_session: AsyncSession,
    test_user: User,
    test_card: Card,
) -> AsyncGenerator[CardStatistics, None]:
    """Provide statistics for an overdue card (3 days past due).

    Yields:
        CardStatistics: Overdue card statistics
    """
    stats = await create_overdue_card_stats(
        db_session,
        test_user,
        test_card,
        days_overdue=3,
    )
    yield stats


@pytest_asyncio.fixture
async def cards_by_status(
    db_session: AsyncSession,
    test_user: User,
    deck_with_cards: DeckWithCards,
) -> AsyncGenerator[CardsByStatus, None]:
    """Provide cards grouped by SM-2 status.

    Creates statistics for 5 cards:
    - 1 NEW card
    - 2 LEARNING cards
    - 1 REVIEW card
    - 1 MASTERED card

    Yields:
        CardsByStatus: Named tuple with cards by status
    """
    cards = deck_with_cards.cards

    new_stats = [await create_new_card_stats(db_session, test_user, cards[0])]
    learning_stats = [
        await create_learning_card_stats(db_session, test_user, cards[1]),
        await create_learning_card_stats(db_session, test_user, cards[2]),
    ]
    review_stats = [await create_review_card_stats(db_session, test_user, cards[3])]
    mastered_stats = [await create_mastered_card_stats(db_session, test_user, cards[4])]

    yield CardsByStatus(
        new=new_stats,
        learning=learning_stats,
        review=review_stats,
        mastered=mastered_stats,
    )


@pytest_asyncio.fixture
async def multiple_due_cards(
    db_session: AsyncSession,
    test_user: User,
    deck_with_cards: DeckWithCards,
) -> AsyncGenerator[list[CardStatistics], None]:
    """Provide multiple cards due for review.

    Creates 3 cards all due today.

    Yields:
        list[CardStatistics]: List of due card statistics
    """
    cards = deck_with_cards.cards[:3]
    stats = []
    for card in cards:
        stat = await create_due_card_stats(db_session, test_user, card)
        stats.append(stat)
    yield stats


# =============================================================================
# Review Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def test_review(
    db_session: AsyncSession,
    test_user: User,
    test_card: Card,
) -> AsyncGenerator[Review, None]:
    """Provide a single review record.

    Creates a review with:
    - quality: 4 (CORRECT_HESITANT)
    - time_taken: 5 seconds
    - reviewed_at: now

    Yields:
        Review: Single review record
    """
    review = await create_review(
        db_session,
        test_user,
        test_card,
        quality=ReviewRating.CORRECT_HESITANT,
        time_taken=5,
    )
    yield review


@pytest_asyncio.fixture
async def perfect_review(
    db_session: AsyncSession,
    test_user: User,
    test_card: Card,
) -> AsyncGenerator[Review, None]:
    """Provide a perfect (quality=5) review.

    Yields:
        Review: Perfect review record
    """
    review = await create_review(
        db_session,
        test_user,
        test_card,
        quality=ReviewRating.PERFECT,
        time_taken=2,
    )
    yield review


@pytest_asyncio.fixture
async def failed_review(
    db_session: AsyncSession,
    test_user: User,
    test_card: Card,
) -> AsyncGenerator[Review, None]:
    """Provide a failed (quality=0) review.

    Yields:
        Review: Failed review record
    """
    review = await create_review(
        db_session,
        test_user,
        test_card,
        quality=ReviewRating.BLACKOUT,
        time_taken=10,
    )
    yield review


@pytest_asyncio.fixture
async def review_history(
    db_session: AsyncSession,
    test_user: User,
    test_card: Card,
) -> AsyncGenerator[list[Review], None]:
    """Provide a realistic review history for a card.

    Creates 5 reviews with mixed ratings:
    [3, 4, 3, 4, 5] - improving performance

    Yields:
        list[Review]: Review history
    """
    ratings = [
        ReviewRating.CORRECT_HARD,
        ReviewRating.CORRECT_HESITANT,
        ReviewRating.CORRECT_HARD,
        ReviewRating.CORRECT_HESITANT,
        ReviewRating.PERFECT,
    ]
    reviews = await create_review_history(
        db_session,
        test_user,
        test_card,
        ratings,
    )
    yield reviews


@pytest_asyncio.fixture
async def perfect_review_history(
    db_session: AsyncSession,
    test_user: User,
    test_card: Card,
) -> AsyncGenerator[list[Review], None]:
    """Provide a history of all perfect reviews.

    Creates 5 reviews all with quality=5.

    Yields:
        list[Review]: Perfect review history
    """
    ratings = [ReviewRating.PERFECT] * 5
    reviews = await create_review_history(
        db_session,
        test_user,
        test_card,
        ratings,
    )
    yield reviews


@pytest_asyncio.fixture
async def struggling_review_history(
    db_session: AsyncSession,
    test_user: User,
    test_card: Card,
) -> AsyncGenerator[list[Review], None]:
    """Provide a history showing struggle with a card.

    Creates reviews with poor/mixed ratings:
    [0, 1, 2, 1, 3] - many failures

    Yields:
        list[Review]: Struggling review history
    """
    ratings = [
        ReviewRating.BLACKOUT,
        ReviewRating.INCORRECT_HARD,
        ReviewRating.INCORRECT_EASY,
        ReviewRating.INCORRECT_HARD,
        ReviewRating.CORRECT_HARD,
    ]
    reviews = await create_review_history(
        db_session,
        test_user,
        test_card,
        ratings,
    )
    yield reviews


# =============================================================================
# Composite/Bundle Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def user_with_deck_progress(
    db_session: AsyncSession,
    test_user: User,
    test_deck: Deck,
) -> AsyncGenerator[UserProgress, None]:
    """Provide a user bundled with their deck progress.

    Yields:
        UserProgress: Named tuple with user, deck, and progress
    """
    progress = await create_user_deck_progress(
        db_session,
        test_user,
        test_deck,
        cards_studied=5,
        cards_mastered=2,
        last_studied_at=datetime.utcnow(),
    )
    yield UserProgress(user=test_user, deck=test_deck, progress=progress)


@pytest_asyncio.fixture
async def card_with_statistics(
    db_session: AsyncSession,
    test_user: User,
    test_card: Card,
) -> AsyncGenerator[CardWithStatistics, None]:
    """Provide a card bundled with user statistics.

    Yields:
        CardWithStatistics: Named tuple with card and statistics
    """
    stats = await create_learning_card_stats(db_session, test_user, test_card)
    yield CardWithStatistics(card=test_card, statistics=stats)


@pytest_asyncio.fixture
async def card_with_review_history(
    db_session: AsyncSession,
    test_user: User,
    test_card: Card,
) -> AsyncGenerator[ReviewHistory, None]:
    """Provide a card with statistics and review history.

    Yields:
        ReviewHistory: Card, statistics, and reviews
    """
    stats = await create_review_card_stats(db_session, test_user, test_card)
    ratings = [3, 4, 4, 5, 4]
    reviews = await create_review_history(db_session, test_user, test_card, ratings)
    yield ReviewHistory(card=test_card, statistics=stats, reviews=reviews)


@pytest_asyncio.fixture
async def user_with_learning_progress(
    db_session: AsyncSession,
    test_user: User,
    deck_with_cards: DeckWithCards,
) -> AsyncGenerator[UserWithLearningData, None]:
    """Provide comprehensive learning data for a user.

    Creates:
    - User with deck progress
    - Card statistics for all cards
    - Review history for some cards

    This is the most comprehensive fixture for testing
    the full learning flow.

    Yields:
        UserWithLearningData: Complete learning data bundle
    """
    deck = deck_with_cards.deck
    cards = deck_with_cards.cards

    # Create deck progress
    progress = await create_user_deck_progress(
        db_session,
        test_user,
        deck,
        cards_studied=len(cards),
        cards_mastered=2,
        last_studied_at=datetime.utcnow(),
    )

    # Create card statistics with varying statuses
    card_statistics = []
    for i, card in enumerate(cards):
        if i == 0:
            stats = await create_new_card_stats(db_session, test_user, card)
        elif i < 3:
            stats = await create_learning_card_stats(db_session, test_user, card)
        elif i < 4:
            stats = await create_review_card_stats(db_session, test_user, card)
        else:
            stats = await create_mastered_card_stats(db_session, test_user, card)
        card_statistics.append(stats)

    # Create reviews for cards that have been studied
    reviews = []
    for i, card in enumerate(cards[1:4]):  # Skip first (new) card
        card_reviews = await create_review_history(
            db_session,
            test_user,
            card,
            [3, 4, 4],  # Simple history
        )
        reviews.extend(card_reviews)

    yield UserWithLearningData(
        user=test_user,
        deck=deck,
        cards=cards,
        progress=progress,
        card_statistics=card_statistics,
        reviews=reviews,
    )


@pytest_asyncio.fixture
async def two_users_same_deck(
    db_session: AsyncSession,
    two_users: tuple[User, User],
    deck_with_cards: DeckWithCards,
) -> AsyncGenerator[tuple[UserProgress, UserProgress], None]:
    """Provide two users with progress on the same deck.

    Useful for testing user isolation.

    Yields:
        tuple: Two UserProgress bundles for different users
    """
    user1, user2 = two_users
    deck = deck_with_cards.deck

    progress1 = await create_user_deck_progress(
        db_session,
        user1,
        deck,
        cards_studied=3,
        cards_mastered=1,
        last_studied_at=datetime.utcnow(),
    )
    progress2 = await create_user_deck_progress(
        db_session,
        user2,
        deck,
        cards_studied=5,
        cards_mastered=3,
        last_studied_at=datetime.utcnow() - timedelta(days=1),
    )

    yield (
        UserProgress(user=user1, deck=deck, progress=progress1),
        UserProgress(user=user2, deck=deck, progress=progress2),
    )
