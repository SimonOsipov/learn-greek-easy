"""Culture model factories.

This module provides factories for culture-related models:
- CultureDeckFactory: Culture exam decks
- CultureQuestionFactory: Multiple-choice questions
- CultureQuestionStatsFactory: SM-2 progress tracking
- CultureAnswerHistoryFactory: Answer history for analytics

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
"""

from datetime import date

import factory

from src.db.models import (
    CardStatus,
    CultureAnswerHistory,
    CultureDeck,
    CultureQuestion,
    CultureQuestionStats,
)
from tests.factories.base import BaseFactory


class CultureDeckFactory(BaseFactory):
    """Factory for CultureDeck model.

    Creates culture exam decks with trilingual content (Greek, English, Russian).

    Traits:
        inactive: Deactivated deck
        premium: Premium deck
        geography: Geography category deck
        politics: Politics category deck
        culture: Culture category deck

    Example:
        deck = await CultureDeckFactory.create()
        geo_deck = await CultureDeckFactory.create(geography=True)
    """

    class Meta:
        model = CultureDeck

    # Multilingual name fields
    name_el = "Ιστορία"
    name_en = "History"
    name_ru = "История"

    # Multilingual description fields
    description_el = "Ερωτήσεις ελληνικής ιστορίας"
    description_en = "Greek history questions"
    description_ru = "Вопросы по истории Греции"

    category = "history"
    is_active = True
    is_premium = False
    order_index = factory.Sequence(lambda n: n)

    class Params:
        """Factory traits for common variations."""

        # Inactive deck
        inactive = factory.Trait(is_active=False)

        # Premium deck
        premium = factory.Trait(is_premium=True)

        # Geography category deck
        geography = factory.Trait(
            category="geography",
            name_el="Γεωγραφία",
            name_en="Geography",
            name_ru="География",
            description_el="Ερωτήσεις γεωγραφίας",
            description_en="Geography questions",
            description_ru="Вопросы по географии",
        )

        # Politics category deck
        politics = factory.Trait(
            category="politics",
            name_el="Πολιτική",
            name_en="Politics",
            name_ru="Политика",
            description_el="Ερωτήσεις πολιτικής",
            description_en="Politics questions",
            description_ru="Вопросы по политике",
        )

        # Culture category deck
        culture = factory.Trait(
            category="culture",
            name_el="Πολιτισμός",
            name_en="Culture",
            name_ru="Культура",
            description_el="Ερωτήσεις πολιτισμού",
            description_en="Culture questions",
            description_ru="Вопросы по культуре",
        )

        # Traditions category deck
        traditions = factory.Trait(
            category="traditions",
            name_el="Παραδόσεις",
            name_en="Traditions",
            name_ru="Традиции",
            description_el="Ερωτήσεις παραδόσεων",
            description_en="Traditions questions",
            description_ru="Вопросы о традициях",
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
