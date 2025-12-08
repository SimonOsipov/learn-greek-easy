"""Integration tests for Bulk Create Cards API endpoint.

This module contains integration tests for POST /api/v1/cards/bulk endpoint.
Tests verify endpoint behavior with real database operations.
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from src.db.models import Deck, DeckLevel


class TestBulkCreateCardsEndpoint:
    """Integration tests for POST /api/v1/cards/bulk endpoint."""

    @pytest.fixture
    async def active_deck_for_bulk(self, db_session):
        """Create an active deck for bulk card creation tests."""
        deck = Deck(
            id=uuid4(),
            name="Deck for Bulk Card Creation",
            description="Test deck for bulk create card endpoint",
            level=DeckLevel.A1,
            is_active=True,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)
        return deck

    @pytest.fixture
    async def inactive_deck_for_bulk(self, db_session):
        """Create an inactive deck for bulk card creation tests."""
        deck = Deck(
            id=uuid4(),
            name="Inactive Deck for Bulk Creation",
            description="Inactive test deck",
            level=DeckLevel.A1,
            is_active=False,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)
        return deck

    @pytest.mark.asyncio
    async def test_bulk_create_cards_success(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test superuser can bulk create cards successfully."""
        cards_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "cards": [
                {
                    "front_text": "kalimera",
                    "back_text": "good morning",
                    "difficulty": "easy",
                    "order_index": 1,
                },
                {
                    "front_text": "kalispera",
                    "back_text": "good evening",
                    "difficulty": "easy",
                    "order_index": 2,
                },
            ],
        }

        response = await client.post(
            "/api/v1/cards/bulk",
            json=cards_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["deck_id"] == str(active_deck_for_bulk.id)
        assert data["created_count"] == 2
        assert len(data["cards"]) == 2

        # Verify cards data
        assert data["cards"][0]["front_text"] == "kalimera"
        assert data["cards"][0]["back_text"] == "good morning"
        assert data["cards"][1]["front_text"] == "kalispera"
        assert data["cards"][1]["back_text"] == "good evening"

    @pytest.mark.asyncio
    async def test_bulk_create_cards_with_all_fields(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test bulk create with all optional fields populated."""
        cards_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "cards": [
                {
                    "front_text": "efharisto",
                    "back_text": "thank you",
                    "example_sentence": "Efharisto poly!",
                    "pronunciation": "ef-ha-ri-STO",
                    "difficulty": "medium",
                    "order_index": 0,
                },
            ],
        }

        response = await client.post(
            "/api/v1/cards/bulk",
            json=cards_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == 1
        card = data["cards"][0]
        assert card["front_text"] == "efharisto"
        assert card["example_sentence"] == "Efharisto poly!"
        assert card["pronunciation"] == "ef-ha-ri-STO"
        assert card["difficulty"] == "medium"
        assert "id" in card
        assert "created_at" in card
        assert "updated_at" in card

    @pytest.mark.asyncio
    async def test_bulk_create_cards_over_limit_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test that 101 cards exceeds limit and returns 422."""
        cards_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "cards": [
                {
                    "front_text": f"word {i}",
                    "back_text": f"translation {i}",
                    "difficulty": "easy",
                    "order_index": i,
                }
                for i in range(101)  # 101 cards exceeds max_length=100
            ],
        }

        response = await client.post(
            "/api/v1/cards/bulk",
            json=cards_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_bulk_create_cards_empty_array_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test empty cards array returns 422."""
        cards_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "cards": [],  # Empty array violates min_length=1
        }

        response = await client.post(
            "/api/v1/cards/bulk",
            json=cards_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_bulk_create_cards_invalid_deck_returns_404(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test non-existent deck_id returns 404."""
        non_existent_deck_id = uuid4()
        cards_data = {
            "deck_id": str(non_existent_deck_id),
            "cards": [
                {
                    "front_text": "test",
                    "back_text": "test",
                    "difficulty": "easy",
                    "order_index": 0,
                },
            ],
        }

        response = await client.post(
            "/api/v1/cards/bulk",
            json=cards_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"
        assert str(non_existent_deck_id) in data["error"]["message"]

    @pytest.mark.asyncio
    async def test_bulk_create_cards_unauthorized_returns_401(
        self, client: AsyncClient, active_deck_for_bulk
    ):
        """Test unauthenticated request returns 401."""
        cards_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "cards": [
                {
                    "front_text": "test",
                    "back_text": "test",
                    "difficulty": "easy",
                    "order_index": 0,
                },
            ],
        }

        response = await client.post("/api/v1/cards/bulk", json=cards_data)

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_bulk_create_cards_non_superuser_returns_403(
        self, client: AsyncClient, auth_headers: dict, active_deck_for_bulk
    ):
        """Test regular user (non-superuser) returns 403."""
        cards_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "cards": [
                {
                    "front_text": "test",
                    "back_text": "test",
                    "difficulty": "easy",
                    "order_index": 0,
                },
            ],
        }

        response = await client.post(
            "/api/v1/cards/bulk",
            json=cards_data,
            headers=auth_headers,
        )

        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_bulk_create_cards_all_have_correct_deck_id(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test all created cards belong to the correct deck."""
        cards_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "cards": [
                {
                    "front_text": f"word {i}",
                    "back_text": f"translation {i}",
                    "difficulty": "easy",
                    "order_index": i,
                }
                for i in range(5)
            ],
        }

        response = await client.post(
            "/api/v1/cards/bulk",
            json=cards_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()

        # Verify all cards have the correct deck_id
        for card in data["cards"]:
            assert card["deck_id"] == str(active_deck_for_bulk.id)

    @pytest.mark.asyncio
    async def test_bulk_create_cards_created_count_matches(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test response created_count matches actual array length."""
        num_cards = 7
        cards_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "cards": [
                {
                    "front_text": f"word {i}",
                    "back_text": f"translation {i}",
                    "difficulty": "medium",
                    "order_index": i,
                }
                for i in range(num_cards)
            ],
        }

        response = await client.post(
            "/api/v1/cards/bulk",
            json=cards_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == num_cards
        assert len(data["cards"]) == num_cards

    @pytest.mark.asyncio
    async def test_bulk_create_cards_response_includes_all_fields(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test each card in response has all expected fields."""
        cards_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "cards": [
                {
                    "front_text": "test",
                    "back_text": "test translation",
                    "example_sentence": "Example here",
                    "pronunciation": "test-pron",
                    "difficulty": "hard",
                    "order_index": 10,
                },
            ],
        }

        response = await client.post(
            "/api/v1/cards/bulk",
            json=cards_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        card = data["cards"][0]

        # Verify all required CardResponse fields are present
        required_fields = [
            "id",
            "deck_id",
            "front_text",
            "back_text",
            "example_sentence",
            "pronunciation",
            "difficulty",
            "order_index",
            "created_at",
            "updated_at",
        ]
        for field in required_fields:
            assert field in card, f"Missing required field: {field}"

    @pytest.mark.asyncio
    async def test_bulk_create_cards_invalid_card_data_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test invalid card in array returns 422."""
        cards_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "cards": [
                {
                    "front_text": "valid card",
                    "back_text": "translation",
                    "difficulty": "easy",
                    "order_index": 0,
                },
                {
                    # Missing required fields
                    "front_text": "missing back_text and difficulty",
                },
            ],
        }

        response = await client.post(
            "/api/v1/cards/bulk",
            json=cards_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_bulk_create_cards_invalid_difficulty_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test invalid difficulty value in card returns 422."""
        cards_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "cards": [
                {
                    "front_text": "test",
                    "back_text": "test",
                    "difficulty": "super_hard",  # Invalid value
                    "order_index": 0,
                },
            ],
        }

        response = await client.post(
            "/api/v1/cards/bulk",
            json=cards_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_bulk_create_cards_negative_order_index_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test negative order_index returns 422."""
        cards_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "cards": [
                {
                    "front_text": "test",
                    "back_text": "test",
                    "difficulty": "easy",
                    "order_index": -1,  # Invalid negative value
                },
            ],
        }

        response = await client.post(
            "/api/v1/cards/bulk",
            json=cards_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_bulk_create_cards_invalid_deck_id_format_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test invalid deck_id format returns 422."""
        cards_data = {
            "deck_id": "not-a-valid-uuid",
            "cards": [
                {
                    "front_text": "test",
                    "back_text": "test",
                    "difficulty": "easy",
                    "order_index": 0,
                },
            ],
        }

        response = await client.post(
            "/api/v1/cards/bulk",
            json=cards_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_bulk_create_cards_in_inactive_deck_succeeds(
        self, client: AsyncClient, superuser_auth_headers: dict, inactive_deck_for_bulk
    ):
        """Test admin can bulk create cards in inactive decks (admin privilege)."""
        cards_data = {
            "deck_id": str(inactive_deck_for_bulk.id),
            "cards": [
                {
                    "front_text": "test in inactive",
                    "back_text": "translation",
                    "difficulty": "easy",
                    "order_index": 0,
                },
            ],
        }

        response = await client.post(
            "/api/v1/cards/bulk",
            json=cards_data,
            headers=superuser_auth_headers,
        )

        # Admin should be able to create cards in inactive decks
        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == 1
        assert str(data["deck_id"]) == str(inactive_deck_for_bulk.id)

    @pytest.mark.asyncio
    async def test_bulk_created_cards_are_persisted(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test bulk created cards can be retrieved via GET endpoint."""
        cards_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "cards": [
                {
                    "front_text": "persisted bulk test",
                    "back_text": "persisted translation",
                    "difficulty": "hard",
                    "order_index": 0,
                },
            ],
        }

        # Bulk create the cards
        create_response = await client.post(
            "/api/v1/cards/bulk",
            json=cards_data,
            headers=superuser_auth_headers,
        )

        assert create_response.status_code == 201
        created_data = create_response.json()
        card_id = created_data["cards"][0]["id"]

        # Verify card can be retrieved
        get_response = await client.get(f"/api/v1/cards/{card_id}")

        assert get_response.status_code == 200
        retrieved_card = get_response.json()
        assert retrieved_card["id"] == card_id
        assert retrieved_card["front_text"] == "persisted bulk test"
        assert retrieved_card["back_text"] == "persisted translation"

    @pytest.mark.asyncio
    async def test_bulk_create_cards_all_difficulties(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test bulk creating cards with all valid difficulty levels."""
        cards_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "cards": [
                {
                    "front_text": "easy word",
                    "back_text": "translation",
                    "difficulty": "easy",
                    "order_index": 0,
                },
                {
                    "front_text": "medium word",
                    "back_text": "translation",
                    "difficulty": "medium",
                    "order_index": 1,
                },
                {
                    "front_text": "hard word",
                    "back_text": "translation",
                    "difficulty": "hard",
                    "order_index": 2,
                },
            ],
        }

        response = await client.post(
            "/api/v1/cards/bulk",
            json=cards_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == 3

        difficulties = [card["difficulty"] for card in data["cards"]]
        assert "easy" in difficulties
        assert "medium" in difficulties
        assert "hard" in difficulties

    @pytest.mark.asyncio
    async def test_bulk_create_cards_empty_front_text_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test empty front_text returns 422."""
        cards_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "cards": [
                {
                    "front_text": "",  # Empty string violates min_length=1
                    "back_text": "test",
                    "difficulty": "easy",
                    "order_index": 0,
                },
            ],
        }

        response = await client.post(
            "/api/v1/cards/bulk",
            json=cards_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_bulk_create_cards_empty_back_text_returns_422(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test empty back_text returns 422."""
        cards_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "cards": [
                {
                    "front_text": "test",
                    "back_text": "",  # Empty string violates min_length=1
                    "difficulty": "easy",
                    "order_index": 0,
                },
            ],
        }

        response = await client.post(
            "/api/v1/cards/bulk",
            json=cards_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_bulk_create_single_card(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test bulk create with exactly one card (min_length boundary)."""
        cards_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "cards": [
                {
                    "front_text": "single card",
                    "back_text": "translation",
                    "difficulty": "easy",
                    "order_index": 0,
                },
            ],
        }

        response = await client.post(
            "/api/v1/cards/bulk",
            json=cards_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == 1
        assert len(data["cards"]) == 1
