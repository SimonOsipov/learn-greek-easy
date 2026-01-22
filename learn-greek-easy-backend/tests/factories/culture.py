"""Culture model factories.

This module provides factories for culture-related models:
- CultureDeckFactory: Culture exam decks
- CultureQuestionFactory: Multiple-choice questions
- CultureQuestionStatsFactory: SM-2 progress tracking
- CultureAnswerHistoryFactory: Answer history for analytics
- NewsSourceFactory: News sources for AI culture question generation

Usage:
    # Create a culture deck
    deck = await CultureDeckFactory.create()

    # Create a geography deck
    deck = await CultureDeckFactory.create(geography=True)

    # Create a question with an image
    question = await CultureQuestionFactory.create(deck_id=deck.id, with_image=True)

    # Create mastered question stats
    stats = await CultureQuestionStatsFactory.create(
        user_id=user.id, question_id=question.id, mastered=True
    )

    # Create an incorrect answer
    history = await CultureAnswerHistoryFactory.create(
        user_id=user.id, question_id=question.id, wrong=True
    )

    # Create a news source
    source = await NewsSourceFactory.create()

    # Create an inactive news source
    source = await NewsSourceFactory.create(inactive=True)
"""

from datetime import date, datetime, timezone

import factory

from src.db.models import (
    CardStatus,
    CultureAnswerHistory,
    CultureDeck,
    CultureQuestion,
    CultureQuestionStats,
    NewsSource,
    SourceFetchHistory,
)
from tests.factories.base import BaseFactory


class CultureDeckFactory(BaseFactory):
    """Factory for CultureDeck model.

    Creates culture exam decks with multilingual content.

    Traits:
        inactive: Deactivated deck
        geography: Geography category deck
        politics: Politics category deck

    Example:
        deck = await CultureDeckFactory.create()
        geo_deck = await CultureDeckFactory.create(geography=True)
    """

    class Meta:
        model = CultureDeck

    name = "History"
    description = "Greek history questions"
    icon = "book-open"
    color_accent = "#4F46E5"
    category = "history"
    is_active = True
    order_index = factory.Sequence(lambda n: n)

    class Params:
        """Factory traits for common variations."""

        # Inactive deck
        inactive = factory.Trait(is_active=False)

        # Geography category deck
        geography = factory.Trait(
            category="geography",
            icon="map",
            color_accent="#10B981",
            name="Geography",
            description="Geography questions",
        )

        # Politics category deck
        politics = factory.Trait(
            category="politics",
            icon="landmark",
            color_accent="#F59E0B",
            name="Politics",
            description="Politics questions",
        )

        # Culture category deck
        culture = factory.Trait(
            category="culture",
            icon="music",
            color_accent="#EC4899",
            name="Culture",
            description="Culture questions",
        )


class CultureQuestionFactory(BaseFactory):
    """Factory for CultureQuestion model.

    Creates culture exam questions with multilingual content.

    Traits:
        with_image: Question with an image reference

    Example:
        question = await CultureQuestionFactory.create(deck_id=deck.id)
        img_question = await CultureQuestionFactory.create(deck_id=deck.id, with_image=True)
    """

    class Meta:
        model = CultureQuestion

    # Required: Must be provided
    deck_id = None  # Must be set explicitly

    # Question text
    question_text = factory.LazyAttribute(
        lambda _: {
            "el": "Ποια ήταν η πρώτη πρωτεύουσα της σύγχρονης Ελλάδας;",
            "en": "What was the first capital of modern Greece?",
            "ru": "Какой была первая столица современной Греции?",
        }
    )

    # Answer options
    option_a = factory.LazyAttribute(lambda _: {"el": "Αθήνα", "en": "Athens", "ru": "Афины"})
    option_b = factory.LazyAttribute(
        lambda _: {"el": "Θεσσαλονίκη", "en": "Thessaloniki", "ru": "Салоники"}
    )
    option_c = factory.LazyAttribute(lambda _: {"el": "Ναύπλιο", "en": "Nafplio", "ru": "Нафплион"})
    option_d = factory.LazyAttribute(lambda _: {"el": "Πάτρα", "en": "Patras", "ru": "Патры"})

    # Nafplio was the first capital (correct answer is C = 3)
    correct_option = 3

    # Optional fields
    image_key = None
    order_index = factory.Sequence(lambda n: n)

    class Params:
        """Factory traits for common variations."""

        # Question with an image
        with_image = factory.Trait(image_key="culture/questions/test-image.jpg")


class CultureQuestionStatsFactory(BaseFactory):
    """Factory for CultureQuestionStats model.

    Creates SM-2 spaced repetition statistics for culture questions.

    Traits:
        learning: In learning phase
        mastered: Successfully mastered
        due_today: Due for review today
        overdue: Past due for review

    Example:
        stats = await CultureQuestionStatsFactory.create(
            user_id=user.id, question_id=question.id
        )
        mastered = await CultureQuestionStatsFactory.create(
            user_id=user.id, question_id=question.id, mastered=True
        )
    """

    class Meta:
        model = CultureQuestionStats

    # Required: Must be provided
    user_id = None  # Must be set explicitly
    question_id = None  # Must be set explicitly

    # SM-2 defaults
    easiness_factor = 2.5
    interval = 0
    repetitions = 0
    next_review_date = factory.LazyFunction(date.today)
    status = CardStatus.NEW

    class Params:
        """Factory traits for SM-2 states."""

        # Learning state
        learning = factory.Trait(
            status=CardStatus.LEARNING,
            easiness_factor=2.3,
            interval=1,
            repetitions=1,
        )

        # Review state
        review = factory.Trait(
            status=CardStatus.REVIEW,
            easiness_factor=2.5,
            interval=7,
            repetitions=3,
        )

        # Mastered state
        mastered = factory.Trait(
            status=CardStatus.MASTERED,
            easiness_factor=2.6,
            interval=30,
            repetitions=5,
        )

        # Due today
        due_today = factory.Trait(
            next_review_date=factory.LazyFunction(date.today),
        )

        # Overdue (past due)
        overdue = factory.Trait(
            next_review_date=factory.LazyFunction(
                lambda: date.today().replace(day=max(1, date.today().day - 7))
            ),
        )


class CultureAnswerHistoryFactory(BaseFactory):
    """Factory for CultureAnswerHistory model.

    Creates answer history records for analytics and achievements.

    Traits:
        wrong: Incorrect answer
        greek: Answer in Greek
        russian: Answer in Russian
        slow: Slow response (60 seconds)
        fast: Fast response (5 seconds)

    Example:
        history = await CultureAnswerHistoryFactory.create(
            user_id=user.id, question_id=question.id
        )
        wrong = await CultureAnswerHistoryFactory.create(
            user_id=user.id, question_id=question.id, wrong=True
        )
    """

    class Meta:
        model = CultureAnswerHistory

    # Required: Must be provided
    user_id = None  # Must be set explicitly
    question_id = None  # Must be set explicitly

    # Answer details
    language = "en"
    is_correct = True
    selected_option = 3  # Matches correct_option in CultureQuestionFactory
    time_taken_seconds = 15
    deck_category = "history"

    class Params:
        """Factory traits for common variations."""

        # Incorrect answer
        wrong = factory.Trait(
            is_correct=False,
            selected_option=1,  # Wrong answer (A)
        )

        # Greek language
        greek = factory.Trait(language="el")

        # Russian language
        russian = factory.Trait(language="ru")

        # Slow response
        slow = factory.Trait(time_taken_seconds=60)

        # Fast response
        fast = factory.Trait(time_taken_seconds=5)

        # Geography category
        geography = factory.Trait(deck_category="geography")

        # Politics category
        politics = factory.Trait(deck_category="politics")


class NewsSourceFactory(BaseFactory):
    """Factory for NewsSource model.

    Creates news website sources for AI culture question generation.

    Traits:
        inactive: Deactivated source

    Example:
        source = await NewsSourceFactory.create()
        inactive_source = await NewsSourceFactory.create(inactive=True)
    """

    class Meta:
        model = NewsSource

    # Source information - unique URL via sequence
    name = factory.Sequence(lambda n: f"News Source {n}")
    url = factory.Sequence(lambda n: f"https://news-source-{n}.example.com/")
    is_active = True

    class Params:
        """Factory traits for common variations."""

        # Inactive source
        inactive = factory.Trait(is_active=False)


class SourceFetchHistoryFactory(BaseFactory):
    """Factory for SourceFetchHistory model.

    Creates fetch history entries for news sources.

    Traits:
        error: Failed fetch with error message
        scheduled: Scheduled fetch trigger type

    Example:
        history = await SourceFetchHistoryFactory.create(source_id=source.id)
        error_history = await SourceFetchHistoryFactory.create(source_id=source.id, error=True)
    """

    class Meta:
        model = SourceFetchHistory

    source_id = None  # Must be set by caller
    fetched_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))
    status = "success"
    html_content = "<html><head><title>Test</title></head><body>Test content</body></html>"
    html_size_bytes = factory.LazyAttribute(
        lambda o: len(o.html_content.encode("utf-8")) if o.html_content else None
    )
    error_message = None
    trigger_type = "manual"
    final_url = None

    class Params:
        """Factory traits for common variations."""

        # Error fetch
        error = factory.Trait(
            status="error",
            html_content=None,
            html_size_bytes=None,
            error_message="Connection timeout after 30.0s",
        )

        # Scheduled fetch
        scheduled = factory.Trait(trigger_type="scheduled")
