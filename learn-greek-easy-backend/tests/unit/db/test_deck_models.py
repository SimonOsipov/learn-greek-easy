"""Unit tests for Deck and CultureDeck models.

Tests the is_premium field on both Deck and CultureDeck models:
- Default value is False
- Can be set to True
- is_premium is independent of is_active
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CultureDeck, Deck, DeckLevel


class TestDeckModelIsPremium:
    """Test Deck model is_premium field."""

    def test_deck_is_premium_with_explicit_false(self):
        """Test is_premium can be explicitly set to False when creating a Deck."""
        # Note: SQLAlchemy's `default=False` only applies on database INSERT.
        # In-memory model instances need explicit values for non-nullable fields.
        deck = Deck(
            name="Test Deck",
            description="Test description",
            level=DeckLevel.A1,
            is_premium=False,
        )
        assert deck.is_premium is False

    def test_deck_is_premium_can_be_true(self):
        """Test is_premium can be set to True."""
        deck = Deck(
            name="Premium Deck",
            description="Premium content",
            level=DeckLevel.B1,
            is_premium=True,
        )
        assert deck.is_premium is True

    def test_deck_is_premium_explicit_false(self):
        """Test is_premium can be explicitly set to False."""
        deck = Deck(
            name="Free Deck",
            description="Free content",
            level=DeckLevel.A2,
            is_premium=False,
        )
        assert deck.is_premium is False

    def test_deck_is_premium_independent_of_is_active(self):
        """Test is_premium and is_active are independent."""
        # Active and premium
        deck1 = Deck(
            name="Active Premium",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=True,
        )
        assert deck1.is_active is True
        assert deck1.is_premium is True

        # Active and not premium
        deck2 = Deck(
            name="Active Free",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=False,
        )
        assert deck2.is_active is True
        assert deck2.is_premium is False

        # Inactive and premium
        deck3 = Deck(
            name="Inactive Premium",
            level=DeckLevel.A1,
            is_active=False,
            is_premium=True,
        )
        assert deck3.is_active is False
        assert deck3.is_premium is True

        # Inactive and not premium
        deck4 = Deck(
            name="Inactive Free",
            level=DeckLevel.A1,
            is_active=False,
            is_premium=False,
        )
        assert deck4.is_active is False
        assert deck4.is_premium is False


class TestDeckModelIsPremiumDatabase:
    """Integration tests for Deck model is_premium with database."""

    @pytest.mark.asyncio
    async def test_deck_is_premium_persists_false(self, db_session: AsyncSession):
        """Test is_premium=False is persisted to database."""
        deck = Deck(
            name="Free DB Deck",
            description="Test persistence",
            level=DeckLevel.A1,
            is_premium=False,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.id is not None
        assert deck.is_premium is False

    @pytest.mark.asyncio
    async def test_deck_is_premium_persists_true(self, db_session: AsyncSession):
        """Test is_premium=True is persisted to database."""
        deck = Deck(
            name="Premium DB Deck",
            description="Premium test",
            level=DeckLevel.B2,
            is_premium=True,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.id is not None
        assert deck.is_premium is True

    @pytest.mark.asyncio
    async def test_deck_is_premium_default_persists(self, db_session: AsyncSession):
        """Test default is_premium=False when not specified."""
        deck = Deck(
            name="Default Premium Deck",
            description="Default test",
            level=DeckLevel.A1,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.is_premium is False

    @pytest.mark.asyncio
    async def test_deck_is_premium_update_independent(self, db_session: AsyncSession):
        """Test updating is_premium does not affect is_active."""
        deck = Deck(
            name="Update Test Deck",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=False,
        )
        db_session.add(deck)
        await db_session.commit()

        # Update is_premium only
        deck.is_premium = True
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.is_premium is True
        assert deck.is_active is True  # Should remain unchanged

    @pytest.mark.asyncio
    async def test_deck_is_active_update_independent(self, db_session: AsyncSession):
        """Test updating is_active does not affect is_premium."""
        deck = Deck(
            name="Active Update Test Deck",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=True,
        )
        db_session.add(deck)
        await db_session.commit()

        # Update is_active only
        deck.is_active = False
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.is_active is False
        assert deck.is_premium is True  # Should remain unchanged


class TestCultureDeckModelIsPremium:
    """Test CultureDeck model is_premium field."""

    def test_culture_deck_is_premium_with_explicit_false(self):
        """Test is_premium can be explicitly set to False when creating a CultureDeck."""
        # Note: SQLAlchemy's `default=False` only applies on database INSERT.
        # In-memory model instances need explicit values for non-nullable fields.
        deck = CultureDeck(
            name="Culture Test",
            description="Culture test description",
            icon="book-open",
            color_accent="#4F46E5",
            category="history",
            is_premium=False,
        )
        assert deck.is_premium is False

    def test_culture_deck_is_premium_can_be_true(self):
        """Test is_premium can be set to True."""
        deck = CultureDeck(
            name="Premium Culture Deck",
            description="Premium culture content",
            icon="crown",
            color_accent="#9333EA",
            category="traditions",
            is_premium=True,
        )
        assert deck.is_premium is True

    def test_culture_deck_is_premium_explicit_false(self):
        """Test is_premium can be explicitly set to False."""
        deck = CultureDeck(
            name="Free Culture Deck",
            description="Free culture content",
            icon="book",
            color_accent="#22C55E",
            category="geography",
            is_premium=False,
        )
        assert deck.is_premium is False

    def test_culture_deck_is_premium_independent_of_is_active(self):
        """Test is_premium and is_active are independent."""
        # Active and premium
        deck1 = CultureDeck(
            name="Active Premium Culture",
            icon="crown",
            color_accent="#FFD700",
            category="history",
            is_active=True,
            is_premium=True,
        )
        assert deck1.is_active is True
        assert deck1.is_premium is True

        # Active and not premium
        deck2 = CultureDeck(
            name="Active Free Culture",
            icon="book",
            color_accent="#4F46E5",
            category="history",
            is_active=True,
            is_premium=False,
        )
        assert deck2.is_active is True
        assert deck2.is_premium is False

        # Inactive and premium
        deck3 = CultureDeck(
            name="Inactive Premium Culture",
            icon="crown",
            color_accent="#9333EA",
            category="history",
            is_active=False,
            is_premium=True,
        )
        assert deck3.is_active is False
        assert deck3.is_premium is True

        # Inactive and not premium
        deck4 = CultureDeck(
            name="Inactive Free Culture",
            icon="book",
            color_accent="#22C55E",
            category="history",
            is_active=False,
            is_premium=False,
        )
        assert deck4.is_active is False
        assert deck4.is_premium is False


class TestCultureDeckModelIsPremiumDatabase:
    """Integration tests for CultureDeck model is_premium with database."""

    @pytest.mark.asyncio
    async def test_culture_deck_is_premium_persists_false(self, db_session: AsyncSession):
        """Test is_premium=False is persisted to database."""
        deck = CultureDeck(
            name="Free Culture DB",
            description="Test persistence",
            icon="book-open",
            color_accent="#4F46E5",
            category="history",
            is_premium=False,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.id is not None
        assert deck.is_premium is False

    @pytest.mark.asyncio
    async def test_culture_deck_is_premium_persists_true(self, db_session: AsyncSession):
        """Test is_premium=True is persisted to database."""
        deck = CultureDeck(
            name="Premium Culture DB",
            description="Premium test",
            icon="crown",
            color_accent="#9333EA",
            category="traditions",
            is_premium=True,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.id is not None
        assert deck.is_premium is True

    @pytest.mark.asyncio
    async def test_culture_deck_is_premium_default_persists(self, db_session: AsyncSession):
        """Test default is_premium=False when not specified."""
        deck = CultureDeck(
            name="Default Premium Culture",
            description="Default test",
            icon="book",
            color_accent="#22C55E",
            category="geography",
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.is_premium is False

    @pytest.mark.asyncio
    async def test_culture_deck_is_premium_update_independent(self, db_session: AsyncSession):
        """Test updating is_premium does not affect is_active."""
        deck = CultureDeck(
            name="Update Culture Test",
            icon="book",
            color_accent="#4F46E5",
            category="history",
            is_active=True,
            is_premium=False,
        )
        db_session.add(deck)
        await db_session.commit()

        # Update is_premium only
        deck.is_premium = True
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.is_premium is True
        assert deck.is_active is True  # Should remain unchanged

    @pytest.mark.asyncio
    async def test_culture_deck_is_active_update_independent(self, db_session: AsyncSession):
        """Test updating is_active does not affect is_premium."""
        deck = CultureDeck(
            name="Active Culture Update Test",
            icon="crown",
            color_accent="#9333EA",
            category="traditions",
            is_active=True,
            is_premium=True,
        )
        db_session.add(deck)
        await db_session.commit()

        # Update is_active only
        deck.is_active = False
        await db_session.commit()
        await db_session.refresh(deck)

        assert deck.is_active is False
        assert deck.is_premium is True  # Should remain unchanged
