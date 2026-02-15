"""Integration tests for GET /api/v1/word-entries/{word_entry_id}/cards endpoint.

This module contains integration tests for retrieving card records by word entry ID including:
- Successful retrieval of active cards
- Empty list when no cards exist
- Filtering out inactive cards
- Response schema validation
- Authorization checks (system vs user-created decks)
- 404 handling for non-existent entries
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardRecord, CardType, Deck, DeckLevel, PartOfSpeech, User, WordEntry


class TestGetWordEntryCardsEndpoint:
    """Integration tests for GET /api/v1/word-entries/{word_entry_id}/cards endpoint."""

    @pytest.fixture
    async def system_deck_with_entry_and_cards(self, db_session: AsyncSession):
        """Create a system deck with a word entry and card records (2 active, 1 inactive)."""
        deck = Deck(
            id=uuid4(),
            name_en="System Deck for Card Tests",
            name_el="Τράπουλα συστήματος για κάρτες",
            name_ru="Системная колода для карточек",
            description_en="Test deck for card retrieval",
            description_el="Τράπουλα δοκιμής",
            description_ru="Тестовая колода",
            level=DeckLevel.A1,
            is_active=True,
            owner_id=None,  # System deck
        )
        db_session.add(deck)
        await db_session.flush()

        entry = WordEntry(
            id=uuid4(),
            deck_id=deck.id,
            is_active=True,
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="house, home",
            translation_ru="дом",
            pronunciation="/spi.ti/",
        )
        db_session.add(entry)
        await db_session.flush()

        active_card_1 = CardRecord(
            id=uuid4(),
            word_entry_id=entry.id,
            deck_id=deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            tier=1,
            variant_key="default",
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "What does this mean?",
                "main": "σπίτι",
                "badge": "noun",
            },
            back_content={
                "card_type": "meaning_el_to_en",
                "answer": "house",
            },
            is_active=True,
        )
        active_card_2 = CardRecord(
            id=uuid4(),
            word_entry_id=entry.id,
            deck_id=deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            tier=1,
            variant_key="variant_2",
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "What does this mean?",
                "main": "σπίτι",
                "badge": "noun",
            },
            back_content={
                "card_type": "meaning_el_to_en",
                "answer": "home",
            },
            is_active=True,
        )
        inactive_card = CardRecord(
            id=uuid4(),
            word_entry_id=entry.id,
            deck_id=deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            tier=1,
            variant_key="variant_3",
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "What does this mean?",
                "main": "σπίτι",
                "badge": "noun",
            },
            back_content={
                "card_type": "meaning_el_to_en",
                "answer": "house (inactive)",
            },
            is_active=False,
        )
        db_session.add_all([active_card_1, active_card_2, inactive_card])
        await db_session.commit()
        await db_session.refresh(deck)
        await db_session.refresh(entry)
        await db_session.refresh(active_card_1)
        await db_session.refresh(active_card_2)
        await db_session.refresh(inactive_card)

        return {
            "deck": deck,
            "entry": entry,
            "active_cards": [active_card_1, active_card_2],
            "inactive_card": inactive_card,
        }

    @pytest.fixture
    async def system_deck_with_entry_no_cards(self, db_session: AsyncSession):
        """Create a system deck with a word entry but no card records."""
        deck = Deck(
            id=uuid4(),
            name_en="System Deck No Cards",
            name_el="Τράπουλα χωρίς κάρτες",
            name_ru="Колода без карточек",
            description_en="Test deck with no cards",
            description_el="Τράπουλα δοκιμής",
            description_ru="Тестовая колода",
            level=DeckLevel.A1,
            is_active=True,
            owner_id=None,  # System deck
        )
        db_session.add(deck)
        await db_session.flush()

        entry = WordEntry(
            id=uuid4(),
            deck_id=deck.id,
            is_active=True,
            lemma="γράφω",
            part_of_speech=PartOfSpeech.VERB,
            translation_en="to write",
        )
        db_session.add(entry)
        await db_session.commit()
        await db_session.refresh(deck)
        await db_session.refresh(entry)

        return {"deck": deck, "entry": entry}

    @pytest.fixture
    async def other_user_deck_with_entry_and_cards(self, db_session: AsyncSession):
        """Create a deck owned by another user with a word entry and card record."""
        other_user = User(
            id=uuid4(),
            email="other_card_user@test.com",
            full_name="Other Card User",
            is_active=True,
        )
        db_session.add(other_user)
        await db_session.flush()

        deck = Deck(
            id=uuid4(),
            name_en="Other User Card Deck",
            name_el="Τράπουλα άλλου χρήστη",
            name_ru="Колода другого пользователя",
            description_en="Test deck owned by another user",
            description_el="Τράπουλα δοκιμής",
            description_ru="Тестовая колода",
            level=DeckLevel.A1,
            is_active=True,
            owner_id=other_user.id,
        )
        db_session.add(deck)
        await db_session.flush()

        entry = WordEntry(
            id=uuid4(),
            deck_id=deck.id,
            is_active=True,
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="house, home",
        )
        db_session.add(entry)
        await db_session.flush()

        card = CardRecord(
            id=uuid4(),
            word_entry_id=entry.id,
            deck_id=deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            tier=1,
            variant_key="default",
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "What does this mean?",
                "main": "σπίτι",
                "badge": "noun",
            },
            back_content={
                "card_type": "meaning_el_to_en",
                "answer": "house",
            },
            is_active=True,
        )
        db_session.add(card)
        await db_session.commit()
        await db_session.refresh(entry)

        return {"deck": deck, "entry": entry, "user": other_user, "card": card}

    # ========================================================================
    # Success Cases
    # ========================================================================

    @pytest.mark.asyncio
    async def test_get_cards_for_word_entry_success(
        self, client: AsyncClient, auth_headers: dict, system_deck_with_entry_and_cards
    ):
        """Test authenticated user can retrieve active cards from system deck."""
        entry = system_deck_with_entry_and_cards["entry"]

        response = await client.get(
            f"/api/v1/word-entries/{entry.id}/cards",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 2
        for card in data:
            assert card["word_entry_id"] == str(entry.id)

    @pytest.mark.asyncio
    async def test_get_cards_for_word_entry_empty_list(
        self, client: AsyncClient, auth_headers: dict, system_deck_with_entry_no_cards
    ):
        """Test returns empty list when word entry has no cards."""
        entry = system_deck_with_entry_no_cards["entry"]

        response = await client.get(
            f"/api/v1/word-entries/{entry.id}/cards",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    @pytest.mark.asyncio
    async def test_get_cards_excludes_inactive_cards(
        self, client: AsyncClient, auth_headers: dict, system_deck_with_entry_and_cards
    ):
        """Test inactive cards are excluded from the response."""
        entry = system_deck_with_entry_and_cards["entry"]
        inactive_card = system_deck_with_entry_and_cards["inactive_card"]

        response = await client.get(
            f"/api/v1/word-entries/{entry.id}/cards",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        returned_ids = [card["id"] for card in data]
        assert str(inactive_card.id) not in returned_ids

    @pytest.mark.asyncio
    async def test_get_cards_response_matches_card_record_response_schema(
        self, client: AsyncClient, auth_headers: dict, system_deck_with_entry_and_cards
    ):
        """Test response contains all CardRecordResponse fields."""
        entry = system_deck_with_entry_and_cards["entry"]

        response = await client.get(
            f"/api/v1/word-entries/{entry.id}/cards",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0

        required_fields = [
            "id",
            "word_entry_id",
            "deck_id",
            "card_type",
            "tier",
            "front_content",
            "back_content",
            "is_active",
            "created_at",
            "updated_at",
        ]
        for card in data:
            for field in required_fields:
                assert field in card, f"Missing required field: {field}"

    # ========================================================================
    # Authentication Tests (401)
    # ========================================================================

    @pytest.mark.asyncio
    async def test_get_cards_unauthorized_401(
        self, client: AsyncClient, system_deck_with_entry_and_cards
    ):
        """Test unauthenticated request returns 401."""
        entry = system_deck_with_entry_and_cards["entry"]

        response = await client.get(f"/api/v1/word-entries/{entry.id}/cards")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    # ========================================================================
    # Authorization Tests (403)
    # ========================================================================

    @pytest.mark.asyncio
    async def test_get_cards_from_other_users_deck_403(
        self, client: AsyncClient, auth_headers: dict, other_user_deck_with_entry_and_cards
    ):
        """Test user cannot access cards from another user's deck."""
        entry = other_user_deck_with_entry_and_cards["entry"]

        response = await client.get(
            f"/api/v1/word-entries/{entry.id}/cards",
            headers=auth_headers,
        )

        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False
        assert "permission" in data["error"]["message"].lower()

    # ========================================================================
    # Not Found Tests (404)
    # ========================================================================

    @pytest.mark.asyncio
    async def test_get_cards_word_entry_not_found_404(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Test non-existent word entry returns 404."""
        non_existent_id = uuid4()

        response = await client.get(
            f"/api/v1/word-entries/{non_existent_id}/cards",
            headers=auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"
