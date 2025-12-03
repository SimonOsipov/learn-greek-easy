"""Test data builders for complex scenarios.

This module provides fluent builders for creating complex test data:
- ReviewSessionBuilder: Build multi-card review sessions
- ProgressScenarioBuilder: Build user progress scenarios
- StudyStreakBuilder: Build study streak data

Builders provide a fluent API for readable test setup.

Usage:
    from tests.utils.builders import ReviewSessionBuilder

    async def test_review_session(db_session, test_user, deck_with_cards):
        session = await (
            ReviewSessionBuilder(db_session)
            .for_user(test_user)
            .for_deck(deck_with_cards.deck)
            .with_cards(deck_with_cards.cards[:5])
            .with_ratings([5, 4, 4, 3, 5])
            .build()
        )
        assert len(session.reviews) == 5
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta

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


# =============================================================================
# Result Containers
# =============================================================================


@dataclass
class ReviewSessionResult:
    """Container for review session builder output."""

    user: User
    deck: Deck
    cards: list[Card]
    reviews: list[Review]
    statistics: list[CardStatistics]
    duration_seconds: int
    average_quality: float


@dataclass
class ProgressScenarioResult:
    """Container for progress scenario builder output."""

    user: User
    decks: list[Deck]
    progress_records: list[UserDeckProgress]
    card_statistics: list[CardStatistics]
    reviews: list[Review]
    total_cards_studied: int
    total_cards_mastered: int


@dataclass
class StudyStreakResult:
    """Container for study streak builder output."""

    user: User
    reviews: list[Review]
    streak_days: int
    study_dates: list[date]
    cards_per_day: dict[date, int]


# =============================================================================
# Review Session Builder
# =============================================================================


class ReviewSessionBuilder:
    """Builder for creating review session test data.

    Creates a realistic review session with:
    - Multiple card reviews
    - SM-2 statistics updates
    - Timing information

    Example:
        result = await (
            ReviewSessionBuilder(db_session)
            .for_user(user)
            .for_deck(deck)
            .with_cards(cards)
            .with_ratings([5, 4, 4, 3, 5])
            .with_time_per_card(5)
            .build()
        )
    """

    def __init__(self, db_session: AsyncSession) -> None:
        """Initialize the builder with a database session.

        Args:
            db_session: SQLAlchemy async session for database operations.
        """
        self._session = db_session
        self._user: User | None = None
        self._deck: Deck | None = None
        self._cards: list[Card] = []
        self._ratings: list[int] = []
        self._time_per_card: int = 5
        self._session_start: datetime = datetime.utcnow()
        self._create_statistics: bool = True

    def for_user(self, user: User) -> "ReviewSessionBuilder":
        """Set the user for this session.

        Args:
            user: The user performing the review.

        Returns:
            Self for method chaining.
        """
        self._user = user
        return self

    def for_deck(self, deck: Deck) -> "ReviewSessionBuilder":
        """Set the deck being reviewed.

        Args:
            deck: The deck containing the cards.

        Returns:
            Self for method chaining.
        """
        self._deck = deck
        return self

    def with_cards(self, cards: list[Card]) -> "ReviewSessionBuilder":
        """Set the cards to review.

        Args:
            cards: List of cards to review.

        Returns:
            Self for method chaining.
        """
        self._cards = cards
        return self

    def with_ratings(self, ratings: list[int]) -> "ReviewSessionBuilder":
        """Set the quality ratings for each card (0-5).

        If fewer ratings than cards, remaining cards get rating 4.

        Args:
            ratings: List of SM-2 quality ratings (0-5).

        Returns:
            Self for method chaining.
        """
        self._ratings = ratings
        return self

    def with_all_perfect(self) -> "ReviewSessionBuilder":
        """Set all ratings to perfect (5).

        Returns:
            Self for method chaining.
        """
        self._ratings = [ReviewRating.PERFECT] * len(self._cards)
        return self

    def with_all_failed(self) -> "ReviewSessionBuilder":
        """Set all ratings to failed (0).

        Returns:
            Self for method chaining.
        """
        self._ratings = [ReviewRating.BLACKOUT] * len(self._cards)
        return self

    def with_mixed_ratings(self) -> "ReviewSessionBuilder":
        """Set realistic mixed ratings.

        Returns:
            Self for method chaining.
        """
        import random

        self._ratings = [random.choice([3, 4, 4, 5, 5]) for _ in self._cards]
        return self

    def with_time_per_card(self, seconds: int) -> "ReviewSessionBuilder":
        """Set average time spent per card.

        Args:
            seconds: Average seconds per card.

        Returns:
            Self for method chaining.
        """
        self._time_per_card = seconds
        return self

    def at_time(self, session_start: datetime) -> "ReviewSessionBuilder":
        """Set the session start time.

        Args:
            session_start: When the review session started.

        Returns:
            Self for method chaining.
        """
        self._session_start = session_start
        return self

    def without_statistics(self) -> "ReviewSessionBuilder":
        """Skip creating CardStatistics (just reviews).

        Returns:
            Self for method chaining.
        """
        self._create_statistics = False
        return self

    async def build(self) -> ReviewSessionResult:
        """Build and persist the review session.

        Returns:
            ReviewSessionResult: Container with all created entities.

        Raises:
            ValueError: If required fields are not set.
        """
        if not self._user:
            raise ValueError("User is required. Call .for_user()")
        if not self._deck:
            raise ValueError("Deck is required. Call .for_deck()")
        if not self._cards:
            raise ValueError("Cards are required. Call .with_cards()")

        # Extend ratings if needed
        while len(self._ratings) < len(self._cards):
            self._ratings.append(ReviewRating.CORRECT_HESITANT)

        reviews: list[Review] = []
        statistics: list[CardStatistics] = []
        current_time = self._session_start

        for i, (card, rating) in enumerate(zip(self._cards, self._ratings)):
            # Create review
            review = Review(
                user_id=self._user.id,
                card_id=card.id,
                quality=rating,
                time_taken=self._time_per_card + (i % 3),  # Slight variation
                reviewed_at=current_time,
            )
            self._session.add(review)
            reviews.append(review)

            # Create statistics if requested
            if self._create_statistics:
                stats = CardStatistics(
                    user_id=self._user.id,
                    card_id=card.id,
                    easiness_factor=2.5,
                    interval=1 if rating >= 3 else 0,
                    repetitions=1 if rating >= 3 else 0,
                    next_review_date=date.today() + timedelta(days=1),
                    status=CardStatus.LEARNING if rating >= 3 else CardStatus.NEW,
                )
                self._session.add(stats)
                statistics.append(stats)

            # Advance time
            current_time += timedelta(seconds=self._time_per_card)

        await self._session.commit()

        # Calculate metrics
        total_time = len(self._cards) * self._time_per_card
        avg_quality = sum(self._ratings) / len(self._ratings)

        return ReviewSessionResult(
            user=self._user,
            deck=self._deck,
            cards=self._cards,
            reviews=reviews,
            statistics=statistics,
            duration_seconds=total_time,
            average_quality=avg_quality,
        )


# =============================================================================
# Progress Scenario Builder
# =============================================================================


class ProgressScenarioBuilder:
    """Builder for creating user progress scenarios.

    Creates comprehensive progress data including:
    - Multiple deck progress records
    - Card statistics at various stages
    - Review history

    Example:
        result = await (
            ProgressScenarioBuilder(db_session)
            .for_user(user)
            .with_deck(deck1, studied=10, mastered=5)
            .with_deck(deck2, studied=5, mastered=2)
            .with_study_history(days=30)
            .build()
        )
    """

    def __init__(self, db_session: AsyncSession) -> None:
        """Initialize the builder with a database session.

        Args:
            db_session: SQLAlchemy async session for database operations.
        """
        self._session = db_session
        self._user: User | None = None
        self._deck_configs: list[dict] = []
        self._study_days: int = 0
        self._cards_per_day: int = 10

    def for_user(self, user: User) -> "ProgressScenarioBuilder":
        """Set the user for this scenario.

        Args:
            user: The user whose progress is being built.

        Returns:
            Self for method chaining.
        """
        self._user = user
        return self

    def with_deck(
        self,
        deck: Deck,
        cards: list[Card] | None = None,
        studied: int = 5,
        mastered: int = 2,
    ) -> "ProgressScenarioBuilder":
        """Add a deck with progress configuration.

        Args:
            deck: The deck
            cards: Cards in the deck (optional, creates statistics if provided)
            studied: Number of cards studied
            mastered: Number of cards mastered

        Returns:
            Self for method chaining.
        """
        self._deck_configs.append(
            {
                "deck": deck,
                "cards": cards or [],
                "studied": studied,
                "mastered": mastered,
            }
        )
        return self

    def with_study_history(
        self,
        days: int = 30,
        cards_per_day: int = 10,
    ) -> "ProgressScenarioBuilder":
        """Generate study history over a period.

        Args:
            days: Number of days of history
            cards_per_day: Average cards reviewed per day

        Returns:
            Self for method chaining.
        """
        self._study_days = days
        self._cards_per_day = cards_per_day
        return self

    def as_beginner(self) -> "ProgressScenarioBuilder":
        """Configure as a beginner user (minimal progress).

        Returns:
            Self for method chaining.
        """
        for config in self._deck_configs:
            config["studied"] = min(config["studied"], 5)
            config["mastered"] = min(config["mastered"], 1)
        self._study_days = 7
        return self

    def as_intermediate(self) -> "ProgressScenarioBuilder":
        """Configure as intermediate user.

        Returns:
            Self for method chaining.
        """
        for config in self._deck_configs:
            config["studied"] = 20
            config["mastered"] = 10
        self._study_days = 30
        return self

    def as_advanced(self) -> "ProgressScenarioBuilder":
        """Configure as advanced user (lots of progress).

        Returns:
            Self for method chaining.
        """
        for config in self._deck_configs:
            config["studied"] = 50
            config["mastered"] = 40
        self._study_days = 90
        return self

    async def build(self) -> ProgressScenarioResult:
        """Build and persist the progress scenario.

        Returns:
            ProgressScenarioResult: Container with all created entities.

        Raises:
            ValueError: If required fields are not set.
        """
        if not self._user:
            raise ValueError("User is required. Call .for_user()")
        if not self._deck_configs:
            raise ValueError("At least one deck is required. Call .with_deck()")

        progress_records: list[UserDeckProgress] = []
        all_statistics: list[CardStatistics] = []
        all_reviews: list[Review] = []
        total_studied = 0
        total_mastered = 0
        all_cards: list[Card] = []

        for config in self._deck_configs:
            deck = config["deck"]
            cards = config["cards"]
            studied = config["studied"]
            mastered = config["mastered"]
            all_cards.extend(cards)

            # Create progress record
            progress = UserDeckProgress(
                user_id=self._user.id,
                deck_id=deck.id,
                cards_studied=studied,
                cards_mastered=mastered,
                last_studied_at=datetime.utcnow(),
            )
            self._session.add(progress)
            progress_records.append(progress)
            total_studied += studied
            total_mastered += mastered

            # Create statistics for cards
            for i, card in enumerate(cards[:studied]):
                if i < mastered:
                    status = CardStatus.MASTERED
                    interval = 30
                    repetitions = 10
                elif i < studied:
                    status = CardStatus.LEARNING
                    interval = 1
                    repetitions = 2
                else:
                    status = CardStatus.NEW
                    interval = 0
                    repetitions = 0

                stats = CardStatistics(
                    user_id=self._user.id,
                    card_id=card.id,
                    easiness_factor=2.5,
                    interval=interval,
                    repetitions=repetitions,
                    next_review_date=date.today() + timedelta(days=interval),
                    status=status,
                )
                self._session.add(stats)
                all_statistics.append(stats)

        # Create review history if requested
        if self._study_days > 0 and all_cards:
            start_date = datetime.utcnow() - timedelta(days=self._study_days)
            for day in range(self._study_days):
                review_date = start_date + timedelta(days=day)
                # Create some reviews for this day
                for i in range(min(self._cards_per_day, len(all_cards))):
                    card = all_cards[(day + i) % len(all_cards)]
                    review = Review(
                        user_id=self._user.id,
                        card_id=card.id,
                        quality=ReviewRating.CORRECT_HESITANT,
                        time_taken=5,
                        reviewed_at=review_date,
                    )
                    self._session.add(review)
                    all_reviews.append(review)

        await self._session.commit()

        return ProgressScenarioResult(
            user=self._user,
            decks=[c["deck"] for c in self._deck_configs],
            progress_records=progress_records,
            card_statistics=all_statistics,
            reviews=all_reviews,
            total_cards_studied=total_studied,
            total_cards_mastered=total_mastered,
        )


# =============================================================================
# Study Streak Builder
# =============================================================================


class StudyStreakBuilder:
    """Builder for creating study streak test data.

    Creates review data that represents a consecutive study streak.

    Example:
        result = await (
            StudyStreakBuilder(db_session)
            .for_user(user)
            .with_cards(cards)
            .with_streak(days=7)
            .with_cards_per_day(10)
            .build()
        )
    """

    def __init__(self, db_session: AsyncSession) -> None:
        """Initialize the builder with a database session.

        Args:
            db_session: SQLAlchemy async session for database operations.
        """
        self._session = db_session
        self._user: User | None = None
        self._cards: list[Card] = []
        self._streak_days: int = 7
        self._cards_per_day: int = 10
        self._start_date: date | None = None
        self._break_days: list[int] = []

    def for_user(self, user: User) -> "StudyStreakBuilder":
        """Set the user.

        Args:
            user: The user whose streak is being built.

        Returns:
            Self for method chaining.
        """
        self._user = user
        return self

    def with_cards(self, cards: list[Card]) -> "StudyStreakBuilder":
        """Set the cards to use for reviews.

        Args:
            cards: List of cards to review.

        Returns:
            Self for method chaining.
        """
        self._cards = cards
        return self

    def with_streak(self, days: int) -> "StudyStreakBuilder":
        """Set the streak length in days.

        Args:
            days: Number of consecutive study days.

        Returns:
            Self for method chaining.
        """
        self._streak_days = days
        return self

    def with_cards_per_day(self, count: int) -> "StudyStreakBuilder":
        """Set cards reviewed per day.

        Args:
            count: Number of cards to review each day.

        Returns:
            Self for method chaining.
        """
        self._cards_per_day = count
        return self

    def starting_from(self, start_date: date) -> "StudyStreakBuilder":
        """Set the streak start date.

        Args:
            start_date: First day of the streak.

        Returns:
            Self for method chaining.
        """
        self._start_date = start_date
        return self

    def ending_today(self) -> "StudyStreakBuilder":
        """Configure streak to end today.

        Returns:
            Self for method chaining.
        """
        self._start_date = date.today() - timedelta(days=self._streak_days - 1)
        return self

    def with_breaks(self, break_days: list[int]) -> "StudyStreakBuilder":
        """Add breaks in the streak (0-indexed day numbers).

        Example: .with_breaks([3, 5]) skips days 3 and 5

        Args:
            break_days: List of day indices to skip.

        Returns:
            Self for method chaining.
        """
        self._break_days = break_days
        return self

    async def build(self) -> StudyStreakResult:
        """Build and persist the streak data.

        Returns:
            StudyStreakResult: Container with all created entities.

        Raises:
            ValueError: If required fields are not set.
        """
        if not self._user:
            raise ValueError("User is required. Call .for_user()")
        if not self._cards:
            raise ValueError("Cards are required. Call .with_cards()")

        start_date = self._start_date or (date.today() - timedelta(days=self._streak_days - 1))

        reviews: list[Review] = []
        study_dates: list[date] = []
        cards_per_day: dict[date, int] = {}
        actual_streak = 0

        for day in range(self._streak_days):
            if day in self._break_days:
                continue

            current_date = start_date + timedelta(days=day)
            study_dates.append(current_date)
            actual_streak += 1

            day_reviews = 0
            for i in range(min(self._cards_per_day, len(self._cards))):
                card = self._cards[(day + i) % len(self._cards)]
                review = Review(
                    user_id=self._user.id,
                    card_id=card.id,
                    quality=ReviewRating.CORRECT_HESITANT,
                    time_taken=5,
                    reviewed_at=datetime.combine(current_date, datetime.min.time().replace(hour=10)),
                )
                self._session.add(review)
                reviews.append(review)
                day_reviews += 1

            cards_per_day[current_date] = day_reviews

        await self._session.commit()

        return StudyStreakResult(
            user=self._user,
            reviews=reviews,
            streak_days=actual_streak,
            study_dates=study_dates,
            cards_per_day=cards_per_day,
        )


# =============================================================================
# Module Exports
# =============================================================================

__all__ = [
    # Result Containers
    "ReviewSessionResult",
    "ProgressScenarioResult",
    "StudyStreakResult",
    # Builders
    "ReviewSessionBuilder",
    "ProgressScenarioBuilder",
    "StudyStreakBuilder",
]
