"""Unit tests for deck schemas validation.

Tests for DeckResponse, DeckUpdate, and DeckDetailResponse schemas,
including is_premium field validation.
"""

from datetime import datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from src.db.models import DeckLevel
from src.schemas.deck import (
    DeckBase,
    DeckCreate,
    DeckDetailResponse,
    DeckListResponse,
    DeckResponse,
    DeckSearchResponse,
    DeckUpdate,
)


class TestDeckBase:
    """Test DeckBase schema validation."""

    def test_valid_deck_base(self):
        """Test valid deck base with all required fields."""
        deck = DeckBase(
            name="Greek A1 Vocabulary",
            description="Basic Greek words",
            level=DeckLevel.A1,
        )
        assert deck.name == "Greek A1 Vocabulary"
        assert deck.description == "Basic Greek words"
        assert deck.level == DeckLevel.A1

    def test_deck_base_without_description(self):
        """Test deck base with optional description omitted."""
        deck = DeckBase(
            name="Greek Basics",
            level=DeckLevel.B1,
        )
        assert deck.name == "Greek Basics"
        assert deck.description is None
        assert deck.level == DeckLevel.B1

    def test_deck_base_empty_name_rejected(self):
        """Test that empty name is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            DeckBase(name="", level=DeckLevel.A1)
        assert "too_short" in str(exc_info.value).lower()

    def test_deck_base_name_too_long_rejected(self):
        """Test that name over 255 characters is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            DeckBase(name="A" * 256, level=DeckLevel.A1)
        assert "string_too_long" in str(exc_info.value).lower()

    def test_deck_base_invalid_level_rejected(self):
        """Test that invalid level value is rejected."""
        with pytest.raises(ValidationError):
            DeckBase(name="Test", level="INVALID")


class TestDeckCreate:
    """Test DeckCreate schema validation."""

    def test_deck_create_inherits_from_base(self):
        """Test DeckCreate inherits DeckBase fields."""
        deck = DeckCreate(
            name="New Deck",
            description="A new deck",
            level=DeckLevel.A2,
        )
        assert deck.name == "New Deck"
        assert deck.level == DeckLevel.A2

    def test_deck_create_all_cefr_levels(self):
        """Test DeckCreate accepts all CEFR levels."""
        levels = [
            DeckLevel.A1,
            DeckLevel.A2,
            DeckLevel.B1,
            DeckLevel.B2,
            DeckLevel.C1,
            DeckLevel.C2,
        ]
        for level in levels:
            deck = DeckCreate(name=f"Level {level.value}", level=level)
            assert deck.level == level

    def test_deck_create_is_system_deck_default_false(self):
        """Test is_system_deck defaults to False."""
        deck = DeckCreate(
            name="Test Deck",
            level=DeckLevel.A1,
        )
        assert deck.is_system_deck is False

    def test_deck_create_is_system_deck_true(self):
        """Test is_system_deck can be set to True."""
        deck = DeckCreate(
            name="System Deck",
            level=DeckLevel.B1,
            is_system_deck=True,
        )
        assert deck.is_system_deck is True


class TestDeckUpdate:
    """Test DeckUpdate schema validation for partial updates."""

    def test_deck_update_all_fields_optional(self):
        """Test that all fields are optional for partial update."""
        # Empty update is valid
        update = DeckUpdate()
        assert update.name is None
        assert update.description is None
        assert update.level is None
        assert update.is_active is None
        assert update.is_premium is None

    def test_deck_update_name_only(self):
        """Test updating only name."""
        update = DeckUpdate(name="Updated Name")
        assert update.name == "Updated Name"
        assert update.level is None
        assert update.is_active is None
        assert update.is_premium is None

    def test_deck_update_level_only(self):
        """Test updating only level."""
        update = DeckUpdate(level=DeckLevel.C1)
        assert update.level == DeckLevel.C1
        assert update.name is None

    def test_deck_update_is_active(self):
        """Test updating is_active field."""
        update = DeckUpdate(is_active=False)
        assert update.is_active is False

        update = DeckUpdate(is_active=True)
        assert update.is_active is True

    def test_deck_update_is_premium(self):
        """Test updating is_premium field."""
        update = DeckUpdate(is_premium=True)
        assert update.is_premium is True

        update = DeckUpdate(is_premium=False)
        assert update.is_premium is False

    def test_deck_update_is_premium_and_is_active_independent(self):
        """Test is_premium and is_active can be updated independently."""
        # Set premium only
        update1 = DeckUpdate(is_premium=True)
        assert update1.is_premium is True
        assert update1.is_active is None

        # Set active only
        update2 = DeckUpdate(is_active=False)
        assert update2.is_active is False
        assert update2.is_premium is None

        # Set both - they should be independent
        update3 = DeckUpdate(is_active=False, is_premium=True)
        assert update3.is_active is False
        assert update3.is_premium is True

    def test_deck_update_all_fields(self):
        """Test updating all fields at once."""
        update = DeckUpdate(
            name="Complete Update",
            description="New description",
            level=DeckLevel.B2,
            is_active=False,
            is_premium=True,
        )
        assert update.name == "Complete Update"
        assert update.description == "New description"
        assert update.level == DeckLevel.B2
        assert update.is_active is False
        assert update.is_premium is True

    def test_deck_update_empty_name_rejected(self):
        """Test that empty name is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            DeckUpdate(name="")
        assert "too_short" in str(exc_info.value).lower()

    def test_deck_update_name_too_long_rejected(self):
        """Test that name over 255 characters is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            DeckUpdate(name="A" * 256)
        assert "string_too_long" in str(exc_info.value).lower()

    def test_deck_update_invalid_level_rejected(self):
        """Test that invalid level value is rejected."""
        with pytest.raises(ValidationError):
            DeckUpdate(level="INVALID")


class TestDeckResponse:
    """Test DeckResponse schema validation."""

    def test_valid_deck_response(self):
        """Test valid deck response with all fields."""
        now = datetime.now()
        response = DeckResponse(
            id=uuid4(),
            name="Greek A1 Vocabulary",
            description="Basic Greek words",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=False,
            created_at=now,
            updated_at=now,
        )
        assert response.name == "Greek A1 Vocabulary"
        assert response.is_active is True
        assert response.is_premium is False

    def test_deck_response_is_premium_true(self):
        """Test deck response with is_premium=True."""
        now = datetime.now()
        response = DeckResponse(
            id=uuid4(),
            name="Premium Greek",
            description="Premium content",
            level=DeckLevel.B1,
            is_active=True,
            is_premium=True,
            created_at=now,
            updated_at=now,
        )
        assert response.is_premium is True
        assert response.is_active is True

    def test_deck_response_premium_and_inactive(self):
        """Test deck response can be both premium and inactive."""
        now = datetime.now()
        response = DeckResponse(
            id=uuid4(),
            name="Archived Premium",
            description="Old premium deck",
            level=DeckLevel.C1,
            is_active=False,
            is_premium=True,
            created_at=now,
            updated_at=now,
        )
        assert response.is_premium is True
        assert response.is_active is False

    def test_deck_response_all_levels(self):
        """Test deck response with all CEFR levels."""
        now = datetime.now()
        levels = [
            DeckLevel.A1,
            DeckLevel.A2,
            DeckLevel.B1,
            DeckLevel.B2,
            DeckLevel.C1,
            DeckLevel.C2,
        ]
        for level in levels:
            response = DeckResponse(
                id=uuid4(),
                name=f"Level {level.value}",
                level=level,
                is_active=True,
                is_premium=False,
                created_at=now,
                updated_at=now,
            )
            assert response.level == level


class TestDeckDetailResponse:
    """Test DeckDetailResponse schema validation."""

    def test_valid_deck_detail_response(self):
        """Test valid deck detail response with card count."""
        now = datetime.now()
        response = DeckDetailResponse(
            id=uuid4(),
            name="Greek A1 Vocabulary",
            description="Basic Greek words",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=False,
            created_at=now,
            updated_at=now,
            card_count=25,
        )
        assert response.card_count == 25
        assert response.is_premium is False

    def test_deck_detail_response_zero_cards(self):
        """Test deck detail with zero cards."""
        now = datetime.now()
        response = DeckDetailResponse(
            id=uuid4(),
            name="Empty Deck",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=False,
            created_at=now,
            updated_at=now,
            card_count=0,
        )
        assert response.card_count == 0

    def test_deck_detail_response_negative_card_count_rejected(self):
        """Test negative card count is rejected."""
        now = datetime.now()
        with pytest.raises(ValidationError) as exc_info:
            DeckDetailResponse(
                id=uuid4(),
                name="Test",
                level=DeckLevel.A1,
                is_active=True,
                is_premium=False,
                created_at=now,
                updated_at=now,
                card_count=-1,
            )
        # Pydantic 2.x uses "greater_than_equal" in validation error type
        assert "greater than or equal to 0" in str(exc_info.value).lower()


class TestDeckListResponse:
    """Test DeckListResponse schema validation."""

    def test_valid_deck_list_response(self):
        """Test valid deck list response."""
        now = datetime.now()
        deck = DeckResponse(
            id=uuid4(),
            name="Test Deck",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=True,
            created_at=now,
            updated_at=now,
        )
        response = DeckListResponse(
            total=1,
            page=1,
            page_size=20,
            decks=[deck],
        )
        assert response.total == 1
        assert len(response.decks) == 1
        assert response.decks[0].is_premium is True

    def test_deck_list_with_mixed_premium_status(self):
        """Test deck list with both premium and non-premium decks."""
        now = datetime.now()
        premium_deck = DeckResponse(
            id=uuid4(),
            name="Premium Deck",
            level=DeckLevel.B1,
            is_active=True,
            is_premium=True,
            created_at=now,
            updated_at=now,
        )
        free_deck = DeckResponse(
            id=uuid4(),
            name="Free Deck",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=False,
            created_at=now,
            updated_at=now,
        )
        response = DeckListResponse(
            total=2,
            page=1,
            page_size=20,
            decks=[premium_deck, free_deck],
        )
        assert response.total == 2
        assert response.decks[0].is_premium is True
        assert response.decks[1].is_premium is False


class TestDeckSearchResponse:
    """Test DeckSearchResponse schema validation."""

    def test_valid_deck_search_response(self):
        """Test valid deck search response."""
        now = datetime.now()
        deck = DeckResponse(
            id=uuid4(),
            name="Greek Search Result",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=False,
            created_at=now,
            updated_at=now,
        )
        response = DeckSearchResponse(
            total=1,
            page=1,
            page_size=20,
            query="Greek",
            decks=[deck],
        )
        assert response.query == "Greek"
        assert response.total == 1
        assert response.decks[0].is_premium is False

    def test_deck_search_response_with_premium_decks(self):
        """Test search response correctly includes premium status."""
        now = datetime.now()
        deck = DeckResponse(
            id=uuid4(),
            name="Premium Greek",
            level=DeckLevel.B2,
            is_active=True,
            is_premium=True,
            created_at=now,
            updated_at=now,
        )
        response = DeckSearchResponse(
            total=1,
            page=1,
            page_size=20,
            query="premium",
            decks=[deck],
        )
        assert response.decks[0].is_premium is True
