"""Content model factories.

This module provides factories for content-related models:
- DeckFactory: Flashcard decks with CEFR levels
- CardFactory: Individual flashcards with Greek vocabulary

Usage:
    # Create an A1 deck
    deck = await DeckFactory.create()

    # Create a B2 deck
    deck = await DeckFactory.create(b2=True)

    # Create a card for a deck
    card = await CardFactory.create(deck_id=deck.id)

    # Create deck with cards
    deck, cards = await DeckFactory.create_with_cards(card_count=10)
"""

import factory
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Card, Deck, DeckLevel
from tests.factories.base import BaseFactory, fake


class DeckFactory(BaseFactory):
    """Factory for Deck model.

    Creates flashcard decks with configurable CEFR levels.

    Traits:
        inactive: Deactivated deck
        a1, a2, b1, b2, c1, c2: CEFR level presets

    Example:
        deck = await DeckFactory.create()  # Default A1
        b2_deck = await DeckFactory.create(b2=True)
        inactive_deck = await DeckFactory.create(inactive=True)
    """

    class Meta:
        model = Deck

    # Default values
    name = factory.LazyAttribute(
        lambda obj: fake.deck_name(obj.level.value if hasattr(obj, "level") and obj.level else "A1")
    )
    description = factory.LazyAttribute(
        lambda obj: fake.deck_description(
            obj.level.value if hasattr(obj, "level") and obj.level else "A1"
        )
    )
    level = DeckLevel.A1
    is_active = True

    class Params:
        """Factory traits for common variations."""

        # Inactive deck
        inactive = factory.Trait(
            is_active=False,
        )

        # CEFR Level traits
        a1 = factory.Trait(
            level=DeckLevel.A1,
            name=factory.LazyAttribute(lambda _: fake.deck_name("A1")),
            description=factory.LazyAttribute(lambda _: fake.deck_description("A1")),
        )

        a2 = factory.Trait(
            level=DeckLevel.A2,
            name=factory.LazyAttribute(lambda _: fake.deck_name("A2")),
            description=factory.LazyAttribute(lambda _: fake.deck_description("A2")),
        )

        b1 = factory.Trait(
            level=DeckLevel.B1,
            name=factory.LazyAttribute(lambda _: fake.deck_name("B1")),
            description=factory.LazyAttribute(lambda _: fake.deck_description("B1")),
        )

        b2 = factory.Trait(
            level=DeckLevel.B2,
            name=factory.LazyAttribute(lambda _: fake.deck_name("B2")),
            description=factory.LazyAttribute(lambda _: fake.deck_description("B2")),
        )

        c1 = factory.Trait(
            level=DeckLevel.C1,
            name=factory.LazyAttribute(lambda _: fake.deck_name("C1")),
            description=factory.LazyAttribute(lambda _: fake.deck_description("C1")),
        )

        c2 = factory.Trait(
            level=DeckLevel.C2,
            name=factory.LazyAttribute(lambda _: fake.deck_name("C2")),
            description=factory.LazyAttribute(lambda _: fake.deck_description("C2")),
        )

    @classmethod
    async def create_with_cards(
        cls,
        session: AsyncSession | None = None,
        card_count: int = 5,
        **kwargs,
    ) -> tuple[Deck, list[Card]]:
        """Create a deck with multiple cards.

        Args:
            session: Database session
            card_count: Number of cards to create
            **kwargs: Deck field overrides

        Returns:
            Tuple of (Deck, list of Cards)
        """
        deck = await cls.create(session=session, **kwargs)

        cards = []
        # Note: deck.level could be used for level-appropriate vocabulary in future

        for i in range(card_count):
            card = await CardFactory.create(
                session=session,
                deck_id=deck.id,
                # Use level-appropriate vocabulary
            )
            cards.append(card)

        return deck, cards


class CardFactory(BaseFactory):
    """Factory for Card model.

    Creates flashcards with Greek vocabulary content.

    Example:
        card = await CardFactory.create(deck_id=deck.id)
    """

    class Meta:
        model = Card

    # Required: Must be provided
    deck_id = None  # Must be set explicitly

    # Greek vocabulary from Faker provider
    front_text = factory.LazyAttribute(lambda _: fake.greek_word("A1"))
    back_text_en = factory.LazyAttribute(lambda _: fake.greek_translation("A1"))
    back_text_ru = None  # Optional Russian translation
    pronunciation = factory.LazyAttribute(lambda _: fake.greek_pronunciation("A1"))
    example_sentence = factory.LazyAttribute(lambda _: fake.greek_example_sentence("A1"))
    part_of_speech = None  # Optional part of speech
    level = None  # Optional CEFR level override

    class Params:
        """Factory traits for common variations."""

        # Minimal card (no optional fields)
        minimal = factory.Trait(
            pronunciation=None,
            example_sentence=None,
            back_text_ru=None,
            part_of_speech=None,
            level=None,
        )

    @classmethod
    async def create_vocabulary_card(
        cls,
        deck_id,
        level: str = "A1",
        session: AsyncSession | None = None,
        **kwargs,
    ) -> Card:
        """Create a card with level-appropriate vocabulary.

        Args:
            deck_id: ID of parent deck
            level: CEFR level for vocabulary selection
            session: Database session
            **kwargs: Field overrides

        Returns:
            Card with Greek vocabulary
        """
        vocab = fake.greek_vocabulary_card(level)

        return await cls.create(
            session=session,
            deck_id=deck_id,
            front_text=vocab["front_text"],
            back_text_en=vocab["back_text"],
            pronunciation=vocab.get("pronunciation"),
            example_sentence=vocab.get("example_sentence"),
            **kwargs,
        )
