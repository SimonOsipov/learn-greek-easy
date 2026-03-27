"""Deck and Card fixtures for testing.

This module provides comprehensive fixtures for deck and card testing:
- test_deck: A basic A1-level deck
- test_deck_a1, test_deck_a2, test_deck_b1: Level-specific decks
- test_cards: A list of cards for a deck
- deck_with_cards: A deck populated with cards
- deck_with_mixed_difficulty_cards: Cards of varying difficulty
- empty_deck: A deck with no cards
- inactive_deck: A deactivated deck

All fixtures use PostgreSQL and integrate with the db_session fixture.

Usage:
    async def test_deck_listing(client: AsyncClient, test_deck: Deck):
        # test_deck is an A1-level Greek vocabulary deck
        assert test_deck.level == DeckLevel.A1

    async def test_cards_in_deck(deck_with_cards: DeckWithCards):
        deck = deck_with_cards.deck
        cards = deck_with_cards.cards
        assert len(cards) == 5
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any, NamedTuple
from uuid import UUID

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Deck, DeckLevel

# =============================================================================
# Type Definitions
# =============================================================================


class DeckWithCards(NamedTuple):
    """Container for a deck with its cards."""

    deck: Deck
    cards: list[Any]


class MultiLevelDecks(NamedTuple):
    """Container for decks at different CEFR levels."""

    a1: Deck
    a2: Deck
    b1: Deck


# =============================================================================
# Greek Vocabulary Data
# =============================================================================

# A1 Level - Basic Greetings and Essential Words
GREEK_VOCABULARY_A1: list[dict[str, Any]] = [
    {
        "front_text": "Yeia sou",
        "back_text_en": "Hello (informal)",
        "pronunciation": "YAH-soo",
        "example_sentence": "Yeia sou, ti kaneis?",
    },
    {
        "front_text": "Kalimera",
        "back_text_en": "Good morning",
        "pronunciation": "kah-lee-MEH-rah",
        "example_sentence": "Kalimera! Pos eiste?",
    },
    {
        "front_text": "Efcharisto",
        "back_text_en": "Thank you",
        "pronunciation": "ef-hah-ree-STO",
        "example_sentence": "Efcharisto poli!",
    },
    {
        "front_text": "Parakalo",
        "back_text_en": "Please / You're welcome",
        "pronunciation": "pah-rah-kah-LO",
        "example_sentence": "Parakalo, boroume na pame?",
    },
    {
        "front_text": "Nero",
        "back_text_en": "Water",
        "pronunciation": "neh-RO",
        "example_sentence": "Thelo ena nero, parakalo.",
    },
    {
        "front_text": "Psomi",
        "back_text_en": "Bread",
        "pronunciation": "pso-MEE",
        "example_sentence": "To psomi einai fresko.",
    },
    {
        "front_text": "Spiti",
        "back_text_en": "House / Home",
        "pronunciation": "SPEE-tee",
        "example_sentence": "To spiti mou einai mikro.",
    },
    {
        "front_text": "Ena",
        "back_text_en": "One",
        "pronunciation": "EH-nah",
        "example_sentence": "Ena kafe, parakalo.",
    },
    {
        "front_text": "Dio",
        "back_text_en": "Two",
        "pronunciation": "THEE-oh",
        "example_sentence": "Dio nero, parakalo.",
    },
    {
        "front_text": "Tria",
        "back_text_en": "Three",
        "pronunciation": "TREE-ah",
        "example_sentence": "Tria adelfia echo.",
    },
]

# A2 Level - Daily Life and Common Verbs
GREEK_VOCABULARY_A2: list[dict[str, Any]] = [
    {
        "front_text": "Troo",
        "back_text_en": "I eat",
        "pronunciation": "TRO-oh",
        "example_sentence": "Troo proino stis okto.",
    },
    {
        "front_text": "Pino",
        "back_text_en": "I drink",
        "pronunciation": "PEE-no",
        "example_sentence": "Pino kafe kathe proi.",
    },
    {
        "front_text": "Douleo",
        "back_text_en": "I work",
        "pronunciation": "thoo-LEH-vo",
        "example_sentence": "Douleo se ena grafeio.",
    },
    {
        "front_text": "Oikogeneia",
        "back_text_en": "Family",
        "pronunciation": "ee-ko-YEH-nee-ah",
        "example_sentence": "I oikogeneia mou einai megali.",
    },
    {
        "front_text": "Filo",
        "back_text_en": "Friend",
        "pronunciation": "FEE-lo",
        "example_sentence": "O Yiannis einai o filo mou.",
    },
]

# B1 Level - Abstract Concepts and Complex Vocabulary
GREEK_VOCABULARY_B1: list[dict[str, Any]] = [
    {
        "front_text": "Agapi",
        "back_text_en": "Love",
        "pronunciation": "ah-GAH-pee",
        "example_sentence": "I agapi einai to pio simantiko pragma.",
    },
    {
        "front_text": "Elpida",
        "back_text_en": "Hope",
        "pronunciation": "el-PEE-thah",
        "example_sentence": "Echo elpida gia to mellon.",
    },
    {
        "front_text": "Epistimi",
        "back_text_en": "Science",
        "pronunciation": "eh-pee-STEE-mee",
        "example_sentence": "I epistimi proodeui synechos.",
    },
    {
        "front_text": "Politismos",
        "back_text_en": "Culture / Civilization",
        "pronunciation": "po-lee-tee-SMOS",
        "example_sentence": "O ellinikos politismos einai archaios.",
    },
    {
        "front_text": "Dimokratia",
        "back_text_en": "Democracy",
        "pronunciation": "thee-mo-krah-TEE-ah",
        "example_sentence": "I dimokratia gennithike stin Athina.",
    },
]


# =============================================================================
# Factory Functions
# =============================================================================


def create_deck_data(
    name: str | None = None,
    description: str | None = None,
    level: DeckLevel = DeckLevel.A1,
    is_active: bool = True,
    owner_id: UUID | None = None,
) -> dict[str, Any]:
    """Create deck data dictionary with trilingual support.

    Args:
        name: Deck name in English (auto-generated if None)
        description: Deck description in English
        level: CEFR level (A1-B2)
        is_active: Whether deck is active
        owner_id: Owner user ID (None for system decks)

    Returns:
        dict: Deck data ready for Deck model creation with trilingual fields
    """
    if name is None:
        name = f"Greek {level.value} Vocabulary"

    if description is None:
        descriptions = {
            DeckLevel.A1: "Essential Greek words and phrases for beginners",
            DeckLevel.A2: "Elementary Greek vocabulary for daily life",
            DeckLevel.B1: "Intermediate Greek vocabulary and expressions",
            DeckLevel.B2: "Upper-intermediate Greek for confident speakers",
        }
        description = descriptions.get(level, "Greek vocabulary deck")

    # Generate trilingual names and descriptions
    # For testing purposes, we use the English name/description for all locales
    return {
        "name_en": name,
        "name_el": name,  # Same as English for test fixtures
        "name_ru": name,  # Same as English for test fixtures
        "description_en": description,
        "description_el": description,  # Same as English for test fixtures
        "description_ru": description,  # Same as English for test fixtures
        "level": level,
        "is_active": is_active,
        "owner_id": owner_id,
    }


async def create_deck(
    db_session: AsyncSession,
    name: str | None = None,
    description: str | None = None,
    level: DeckLevel = DeckLevel.A1,
    is_active: bool = True,
    owner_id: UUID | None = None,
) -> Deck:
    """Create a deck in the database.

    Args:
        db_session: Database session
        name: Deck name
        description: Deck description
        level: CEFR level
        is_active: Whether deck is active
        owner_id: Owner user ID (None for system decks)

    Returns:
        Deck: Created deck
    """
    deck_data = create_deck_data(
        name=name,
        description=description,
        level=level,
        is_active=is_active,
        owner_id=owner_id,
    )
    deck = Deck(**deck_data)
    db_session.add(deck)
    await db_session.commit()
    await db_session.refresh(deck)
    return deck


# =============================================================================
# Core Deck Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def test_deck(db_session: AsyncSession) -> AsyncGenerator[Deck, None]:
    """Provide a basic A1-level test deck.

    Creates an active deck with:
    - Name: "Greek A1 Vocabulary"
    - Level: A1 (Beginner)
    - Description: Standard beginner description
    - No cards (use deck_with_cards for cards)

    Yields:
        Deck: The created test deck
    """
    deck = await create_deck(db_session, level=DeckLevel.A1)
    yield deck


@pytest_asyncio.fixture
async def test_deck_a1(db_session: AsyncSession) -> AsyncGenerator[Deck, None]:
    """Provide an A1 (Beginner) level deck.

    Explicitly named for clarity when testing level-specific behavior.

    Yields:
        Deck: A1 level deck
    """
    deck = await create_deck(
        db_session,
        name="Greek Basics - A1",
        level=DeckLevel.A1,
    )
    yield deck


@pytest_asyncio.fixture
async def test_deck_a2(db_session: AsyncSession) -> AsyncGenerator[Deck, None]:
    """Provide an A2 (Elementary) level deck.

    Yields:
        Deck: A2 level deck
    """
    deck = await create_deck(
        db_session,
        name="Greek Daily Life - A2",
        level=DeckLevel.A2,
    )
    yield deck


@pytest_asyncio.fixture
async def test_deck_b1(db_session: AsyncSession) -> AsyncGenerator[Deck, None]:
    """Provide a B1 (Intermediate) level deck.

    Yields:
        Deck: B1 level deck
    """
    deck = await create_deck(
        db_session,
        name="Greek Conversations - B1",
        level=DeckLevel.B1,
    )
    yield deck


@pytest_asyncio.fixture
async def inactive_deck(db_session: AsyncSession) -> AsyncGenerator[Deck, None]:
    """Provide an inactive/deactivated deck.

    Use for testing that inactive decks are properly hidden.

    Yields:
        Deck: Inactive deck
    """
    deck = await create_deck(
        db_session,
        name="Archived Deck",
        is_active=False,
    )
    yield deck


@pytest_asyncio.fixture
async def empty_deck(db_session: AsyncSession) -> AsyncGenerator[Deck, None]:
    """Provide a deck with no cards.

    Alias for test_deck, but semantically clear for empty-deck tests.

    Yields:
        Deck: Empty deck
    """
    deck = await create_deck(
        db_session,
        name="Empty Deck",
        description="A deck waiting for cards",
    )
    yield deck


# =============================================================================
# Card Fixtures (V1 - stubs, Card model removed in V2)
# =============================================================================


@pytest_asyncio.fixture
async def test_card(
    db_session: AsyncSession,
    test_deck: Deck,
) -> AsyncGenerator[Any, None]:
    """Stub: V1 Card removed. Yields None."""
    yield None  # type: ignore[misc]


@pytest_asyncio.fixture
async def test_cards(
    db_session: AsyncSession,
    test_deck: Deck,
) -> AsyncGenerator[Any, None]:
    """Stub: V1 Card removed. Yields empty list."""
    yield []  # type: ignore[misc]


# =============================================================================
# Composite Fixtures (Deck + Cards) (V1 - stubs, Card model removed in V2)
# =============================================================================


@pytest_asyncio.fixture
async def deck_with_cards(
    db_session: AsyncSession,
) -> AsyncGenerator[DeckWithCards, None]:
    """Provide a deck with empty cards list (V1 Card removed; cards=[] in V2)."""
    deck = await create_deck(db_session, level=DeckLevel.A1)
    yield DeckWithCards(deck=deck, cards=[])


@pytest_asyncio.fixture
async def deck_with_all_a1_cards(
    db_session: AsyncSession,
) -> AsyncGenerator[DeckWithCards, None]:
    """Provide an A1 deck with empty cards list (V1 Card removed)."""
    deck = await create_deck(db_session, level=DeckLevel.A1)
    yield DeckWithCards(deck=deck, cards=[])


@pytest_asyncio.fixture
async def deck_with_a2_cards(
    db_session: AsyncSession,
) -> AsyncGenerator[DeckWithCards, None]:
    """Provide an A2 deck with empty cards list (V1 Card removed)."""
    deck = await create_deck(db_session, level=DeckLevel.A2)
    yield DeckWithCards(deck=deck, cards=[])


@pytest_asyncio.fixture
async def deck_with_b1_cards(
    db_session: AsyncSession,
) -> AsyncGenerator[DeckWithCards, None]:
    """Provide a B1 deck with empty cards list (V1 Card removed)."""
    deck = await create_deck(db_session, level=DeckLevel.B1)
    yield DeckWithCards(deck=deck, cards=[])


# =============================================================================
# Large Dataset Fixtures (V1 - stubs, Card model removed in V2)
# =============================================================================


@pytest_asyncio.fixture
async def deck_with_many_cards(
    db_session: AsyncSession,
) -> AsyncGenerator[DeckWithCards, None]:
    """Provide a deck with empty cards list (V1 Card removed)."""
    deck = await create_deck(db_session, level=DeckLevel.A1)
    yield DeckWithCards(deck=deck, cards=[])


@pytest_asyncio.fixture
async def multi_level_decks(
    db_session: AsyncSession,
) -> AsyncGenerator[MultiLevelDecks, None]:
    """Provide decks at A1, A2, and B1 levels.

    Useful for testing level filtering and progression.

    Yields:
        MultiLevelDecks: Named tuple with a1, a2, b1 decks
    """
    a1 = await create_deck(db_session, level=DeckLevel.A1)
    a2 = await create_deck(db_session, level=DeckLevel.A2)
    b1 = await create_deck(db_session, level=DeckLevel.B1)

    yield MultiLevelDecks(a1=a1, a2=a2, b1=b1)


@pytest_asyncio.fixture
async def two_decks(
    db_session: AsyncSession,
) -> AsyncGenerator[tuple[Deck, Deck], None]:
    """Provide two different decks for testing isolation.

    Yields:
        tuple[Deck, Deck]: Two different decks
    """
    deck1 = await create_deck(
        db_session,
        name="Deck One",
        level=DeckLevel.A1,
    )
    deck2 = await create_deck(
        db_session,
        name="Deck Two",
        level=DeckLevel.A2,
    )
    yield deck1, deck2


# =============================================================================
# User-Owned Deck Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def user_owned_deck(
    db_session: AsyncSession,
    test_user,  # User fixture from auth.py
) -> AsyncGenerator[Deck, None]:
    """Provide a deck owned by the test user.

    Use for testing /mine endpoint and ownership authorization.

    Yields:
        Deck: Deck owned by test_user
    """
    deck = await create_deck(
        db_session,
        name="My Custom Vocabulary",
        description="My personal Greek vocabulary deck",
        level=DeckLevel.A1,
        owner_id=test_user.id,
    )
    yield deck


@pytest_asyncio.fixture
async def other_user_deck(
    db_session: AsyncSession,
) -> AsyncGenerator[Deck, None]:
    """Provide a deck owned by a different user.

    Use for testing 403 authorization when accessing another user's deck.

    Yields:
        Deck: Deck owned by another user
    """
    from src.db.models import User

    # Create another user to own this deck
    other_user = User(
        email="other_user@example.com",
        full_name="Other User",
        is_active=True,
        is_superuser=False,
        supabase_id="supabase|other_user_test",
    )
    db_session.add(other_user)
    await db_session.commit()
    await db_session.refresh(other_user)

    # Create a deck owned by the other user
    deck = await create_deck(
        db_session,
        name="Other User's Deck",
        description="This deck belongs to someone else",
        level=DeckLevel.A1,
        owner_id=other_user.id,
    )
    yield deck


@pytest_asyncio.fixture
async def multiple_user_decks(
    db_session: AsyncSession,
    test_user,  # User fixture from auth.py
) -> AsyncGenerator[list[Deck], None]:
    """Provide multiple decks owned by the test user.

    Use for testing pagination in /mine endpoint.

    Yields:
        list[Deck]: 3 decks owned by test_user
    """
    decks = []
    for i, level in enumerate([DeckLevel.A1, DeckLevel.A2, DeckLevel.B1]):
        deck = await create_deck(
            db_session,
            name=f"My Deck {i + 1}",
            description=f"Personal deck number {i + 1}",
            level=level,
            owner_id=test_user.id,
        )
        decks.append(deck)
    yield decks


@pytest_asyncio.fixture
async def inactive_user_deck(
    db_session: AsyncSession,
    test_user,  # User fixture from auth.py
) -> AsyncGenerator[Deck, None]:
    """Provide an inactive deck owned by the test user.

    Use for testing that inactive user decks are excluded from /mine.

    Yields:
        Deck: Inactive deck owned by test_user
    """
    deck = await create_deck(
        db_session,
        name="My Archived Deck",
        description="Inactive personal deck",
        level=DeckLevel.A1,
        is_active=False,
        owner_id=test_user.id,
    )
    yield deck
