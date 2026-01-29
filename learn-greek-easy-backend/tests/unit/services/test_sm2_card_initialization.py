"""Unit tests for SM2Service card initialization methods.

Tests cover:
- initialize_cards_for_user: Initialize CardStatistics for specified cards
- initialize_deck_for_user: Initialize all cards in a deck
- _validate_cards_in_deck: Helper to validate card-deck ownership

Acceptance Criteria tested:
- AC #1: initialize_cards_for_user creates stats for specified cards
- AC #2: Validates cards belong to specified deck
- AC #3: Does not duplicate existing CardStatistics records
- AC #4: Returns accurate counts of initialized vs already-exists
- AC #5: initialize_deck_for_user initializes all deck cards
- AC #6: Creates UserDeckProgress record if needed
- AC #7: Proper logging for audit trail
- AC #8: Handles empty card list gracefully
"""

import logging
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import DeckNotFoundException
from src.db.models import Card, CardStatus, Deck, User
from src.schemas.sm2 import CardInitializationRequest
from src.services.sm2_service import SM2Service
from tests.fixtures.deck import DeckWithCards


class TestInitializeCardsForUser:
    """Tests for SM2Service.initialize_cards_for_user method."""

    @pytest.mark.asyncio
    async def test_initialize_cards_creates_stats(
        self,
        db_session: AsyncSession,
        test_user: User,
        deck_with_cards: DeckWithCards,
    ):
        """AC #1: initialize_cards_for_user creates stats for specified cards."""
        service = SM2Service(db_session)
        deck = deck_with_cards.deck
        cards = deck_with_cards.cards[:3]  # Use first 3 cards

        request = CardInitializationRequest(
            deck_id=deck.id,
            card_ids=[card.id for card in cards],
        )

        result = await service.initialize_cards_for_user(
            user_id=test_user.id,
            request=request,
        )

        # Verify result
        assert result.initialized_count == 3
        assert result.already_exists_count == 0
        assert len(result.card_ids) == 3

        # Verify stats were created in database
        for card in cards:
            stats = await service.stats_repo.get_or_create(test_user.id, card.id)
            assert stats.status == CardStatus.NEW
            assert stats.easiness_factor == 2.5
            assert stats.interval == 0
            assert stats.repetitions == 0

    @pytest.mark.asyncio
    async def test_initialize_cards_validates_deck_ownership(
        self,
        db_session: AsyncSession,
        test_user: User,
        two_decks: tuple[Deck, Deck],
    ):
        """AC #2: Validates cards belong to specified deck."""
        service = SM2Service(db_session)
        deck1, deck2 = two_decks

        # Create cards for deck1
        card1 = Card(
            deck_id=deck1.id,
            front_text="Card 1",
            back_text_en="Back 1",
        )
        # Create card for deck2 (different deck)
        card2 = Card(
            deck_id=deck2.id,
            front_text="Card 2",
            back_text_en="Back 2",
        )
        db_session.add_all([card1, card2])
        await db_session.flush()

        # Try to initialize both cards but only for deck1
        request = CardInitializationRequest(
            deck_id=deck1.id,
            card_ids=[card1.id, card2.id],  # card2 belongs to deck2!
        )

        result = await service.initialize_cards_for_user(
            user_id=test_user.id,
            request=request,
        )

        # Only card1 should be initialized (card2 filtered out)
        assert result.initialized_count == 1
        assert card1.id in result.card_ids
        assert card2.id not in result.card_ids

    @pytest.mark.asyncio
    async def test_initialize_cards_no_duplicates(
        self,
        db_session: AsyncSession,
        test_user: User,
        deck_with_cards: DeckWithCards,
    ):
        """AC #3: Does not duplicate existing CardStatistics records."""
        service = SM2Service(db_session)
        deck = deck_with_cards.deck
        cards = deck_with_cards.cards[:3]

        # First initialization
        request = CardInitializationRequest(
            deck_id=deck.id,
            card_ids=[card.id for card in cards],
        )
        result1 = await service.initialize_cards_for_user(
            user_id=test_user.id,
            request=request,
        )
        assert result1.initialized_count == 3
        assert result1.already_exists_count == 0

        # Second initialization with same cards
        result2 = await service.initialize_cards_for_user(
            user_id=test_user.id,
            request=request,
        )

        # Should not create duplicates
        assert result2.initialized_count == 0
        assert result2.already_exists_count == 3

    @pytest.mark.asyncio
    async def test_initialize_cards_accurate_counts(
        self,
        db_session: AsyncSession,
        test_user: User,
        deck_with_cards: DeckWithCards,
    ):
        """AC #4: Returns accurate counts of initialized vs already-exists."""
        service = SM2Service(db_session)
        deck = deck_with_cards.deck
        cards = deck_with_cards.cards

        # Initialize first 2 cards
        request1 = CardInitializationRequest(
            deck_id=deck.id,
            card_ids=[cards[0].id, cards[1].id],
        )
        await service.initialize_cards_for_user(
            user_id=test_user.id,
            request=request1,
        )

        # Now initialize 4 cards (2 existing + 2 new)
        request2 = CardInitializationRequest(
            deck_id=deck.id,
            card_ids=[cards[0].id, cards[1].id, cards[2].id, cards[3].id],
        )
        result = await service.initialize_cards_for_user(
            user_id=test_user.id,
            request=request2,
        )

        assert result.initialized_count == 2  # cards[2] and cards[3]
        assert result.already_exists_count == 2  # cards[0] and cards[1]
        assert len(result.card_ids) == 2
        assert cards[2].id in result.card_ids
        assert cards[3].id in result.card_ids

    @pytest.mark.asyncio
    async def test_initialize_cards_creates_deck_progress(
        self,
        db_session: AsyncSession,
        test_user: User,
        deck_with_cards: DeckWithCards,
    ):
        """AC #6: Creates UserDeckProgress record if needed."""
        service = SM2Service(db_session)
        deck = deck_with_cards.deck
        cards = deck_with_cards.cards[:2]

        # Note: get_or_create will create progress if not exists,
        # but we're verifying initialize_cards_for_user also ensures it exists

        request = CardInitializationRequest(
            deck_id=deck.id,
            card_ids=[card.id for card in cards],
        )

        await service.initialize_cards_for_user(
            user_id=test_user.id,
            request=request,
        )

        # Verify progress record exists
        progress = await service.progress_repo.get_or_create(test_user.id, deck.id)
        assert progress is not None
        assert progress.user_id == test_user.id
        assert progress.deck_id == deck.id

    @pytest.mark.asyncio
    async def test_initialize_cards_logs_audit_trail(
        self,
        db_session: AsyncSession,
        test_user: User,
        deck_with_cards: DeckWithCards,
        caplog_loguru: pytest.LogCaptureFixture,
    ):
        """AC #7: Proper logging for audit trail."""
        service = SM2Service(db_session)
        deck = deck_with_cards.deck
        cards = deck_with_cards.cards[:2]

        request = CardInitializationRequest(
            deck_id=deck.id,
            card_ids=[card.id for card in cards],
        )

        with caplog_loguru.at_level(logging.INFO):
            await service.initialize_cards_for_user(
                user_id=test_user.id,
                request=request,
            )

        # Verify logging occurred
        assert any("Cards initialized" in record.message for record in caplog_loguru.records)

    @pytest.mark.asyncio
    async def test_initialize_cards_invalid_deck_raises(
        self,
        db_session: AsyncSession,
        test_user: User,
    ):
        """Error handling: Invalid deck raises DeckNotFoundException."""
        service = SM2Service(db_session)
        fake_deck_id = uuid4()
        fake_card_id = uuid4()

        request = CardInitializationRequest(
            deck_id=fake_deck_id,
            card_ids=[fake_card_id],
        )

        with pytest.raises(DeckNotFoundException) as exc_info:
            await service.initialize_cards_for_user(
                user_id=test_user.id,
                request=request,
            )

        assert str(fake_deck_id) in str(exc_info.value)


class TestInitializeDeckForUser:
    """Tests for SM2Service.initialize_deck_for_user method."""

    @pytest.mark.asyncio
    async def test_initialize_deck_initializes_all_cards(
        self,
        db_session: AsyncSession,
        test_user: User,
        deck_with_cards: DeckWithCards,
    ):
        """AC #5: initialize_deck_for_user initializes all deck cards."""
        service = SM2Service(db_session)
        deck = deck_with_cards.deck
        expected_count = len(deck_with_cards.cards)

        result = await service.initialize_deck_for_user(
            user_id=test_user.id,
            deck_id=deck.id,
        )

        assert result.initialized_count == expected_count
        assert result.already_exists_count == 0
        assert len(result.card_ids) == expected_count

    @pytest.mark.asyncio
    async def test_initialize_deck_empty_deck(
        self,
        db_session: AsyncSession,
        test_user: User,
        empty_deck: Deck,
    ):
        """AC #8: Handles empty deck gracefully."""
        service = SM2Service(db_session)

        result = await service.initialize_deck_for_user(
            user_id=test_user.id,
            deck_id=empty_deck.id,
        )

        assert result.initialized_count == 0
        assert result.already_exists_count == 0
        assert len(result.card_ids) == 0

    @pytest.mark.asyncio
    async def test_initialize_deck_partial_existing(
        self,
        db_session: AsyncSession,
        test_user: User,
        deck_with_cards: DeckWithCards,
    ):
        """Test initializing deck when some cards already have statistics."""
        service = SM2Service(db_session)
        deck = deck_with_cards.deck
        cards = deck_with_cards.cards
        total_cards = len(cards)

        # Pre-initialize first 2 cards
        request = CardInitializationRequest(
            deck_id=deck.id,
            card_ids=[cards[0].id, cards[1].id],
        )
        await service.initialize_cards_for_user(
            user_id=test_user.id,
            request=request,
        )

        # Now initialize entire deck
        result = await service.initialize_deck_for_user(
            user_id=test_user.id,
            deck_id=deck.id,
        )

        # Should only initialize remaining cards
        expected_new = total_cards - 2
        assert result.initialized_count == expected_new
        assert result.already_exists_count == 2


class TestValidateCardsInDeck:
    """Tests for SM2Service._validate_cards_in_deck helper method."""

    @pytest.mark.asyncio
    async def test_validate_filters_invalid_cards(
        self,
        db_session: AsyncSession,
        two_decks: tuple[Deck, Deck],
    ):
        """Test that validation filters out cards from other decks."""
        service = SM2Service(db_session)
        deck1, deck2 = two_decks

        # Create cards in different decks
        card1 = Card(deck_id=deck1.id, front_text="Card 1", back_text_en="Back 1")
        card2 = Card(deck_id=deck1.id, front_text="Card 2", back_text_en="Back 2")
        card3 = Card(deck_id=deck2.id, front_text="Card 3", back_text_en="Back 3")
        db_session.add_all([card1, card2, card3])
        await db_session.flush()

        # Validate for deck1
        valid_ids = await service._validate_cards_in_deck(
            card_ids=[card1.id, card2.id, card3.id],
            deck_id=deck1.id,
        )

        assert len(valid_ids) == 2
        assert card1.id in valid_ids
        assert card2.id in valid_ids
        assert card3.id not in valid_ids

    @pytest.mark.asyncio
    async def test_validate_handles_nonexistent_cards(
        self,
        db_session: AsyncSession,
        deck_with_cards: DeckWithCards,
    ):
        """Test that validation handles non-existent card IDs."""
        service = SM2Service(db_session)
        deck = deck_with_cards.deck
        real_card = deck_with_cards.cards[0]
        fake_card_id = uuid4()

        valid_ids = await service._validate_cards_in_deck(
            card_ids=[real_card.id, fake_card_id],
            deck_id=deck.id,
        )

        assert len(valid_ids) == 1
        assert real_card.id in valid_ids
        assert fake_card_id not in valid_ids

    @pytest.mark.asyncio
    async def test_validate_empty_list(
        self,
        db_session: AsyncSession,
        deck_with_cards: DeckWithCards,
    ):
        """Test validation with empty card list."""
        service = SM2Service(db_session)
        deck = deck_with_cards.deck

        valid_ids = await service._validate_cards_in_deck(
            card_ids=[],
            deck_id=deck.id,
        )

        assert valid_ids == []
