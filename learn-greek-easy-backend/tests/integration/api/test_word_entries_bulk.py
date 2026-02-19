"""Integration tests for Bulk Word Entry Upload API endpoint.

This module contains integration tests for POST /api/v1/word-entries/bulk endpoint.
Tests verify endpoint behavior with real database operations including:
- Creating new word entries
- Updating existing entries (upsert by lemma + part_of_speech)
- Authentication and authorization
- Validation error handling
- Data persistence verification
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardRecord, CardType, Deck, DeckLevel, PartOfSpeech, WordEntry

# ============================================================================
# Test Data Fixtures
# ============================================================================

BULK_NOUN_ENTRY = {
    "lemma": "σπίτι",
    "part_of_speech": "noun",
    "translation_en": "house, home",
    "translation_ru": "дом",
    "pronunciation": "/spí·ti/",
    "grammar_data": {
        "gender": "neuter",
        "nominative_singular": "σπίτι",
        "genitive_singular": "σπιτιού",
        "nominative_plural": "σπίτια",
        "genitive_plural": "σπιτιών",
    },
    "examples": [
        {
            "id": "ex_spiti1",
            "greek": "Το σπίτι μου είναι μικρό.",
            "english": "My house is small.",
            "russian": "Мой дом маленький.",
        }
    ],
}

BULK_VERB_ENTRY = {
    "lemma": "γράφω",
    "part_of_speech": "verb",
    "translation_en": "to write",
    "translation_ru": "писать",
    "pronunciation": "/ghrá·fo/",
    "grammar_data": {
        "voice": "active",
        "present_1s": "γράφω",
        "present_2s": "γράφεις",
        "present_3s": "γράφει",
        "past_1s": "έγραψα",
    },
}

BULK_ADJECTIVE_ENTRY = {
    "lemma": "καλός",
    "part_of_speech": "adjective",
    "translation_en": "good, beautiful",
}

BULK_MINIMAL_ENTRY = {
    "lemma": "νερό",
    "part_of_speech": "noun",
    "translation_en": "water",
}

CARD_GEN_ENTRY_WITH_EXAMPLES = {
    "lemma": "δρόμος",
    "part_of_speech": "noun",
    "translation_en": "road, street",
    "translation_ru": "дорога, улица",
    "pronunciation": "/ðró·mos/",
    "grammar_data": {
        "gender": "masculine",
        "nominative_singular": "δρόμος",
        "genitive_singular": "δρόμου",
        "nominative_plural": "δρόμοι",
        "genitive_plural": "δρόμων",
    },
    "examples": [
        {
            "id": "ex_dromos1",
            "greek": "Ο δρόμος είναι μεγάλος.",
            "english": "The road is big.",
            "russian": "Дорога большая.",
        }
    ],
}

CARD_GEN_ENTRY_WITHOUT_EXAMPLES = {
    "lemma": "τρέχω",
    "part_of_speech": "verb",
    "translation_en": "to run",
    "translation_ru": "бежать",
    "pronunciation": "/tré·xo/",
    "grammar_data": {
        "voice": "active",
        "present_1s": "τρέχω",
        "present_2s": "τρέχεις",
        "present_3s": "τρέχει",
        "past_1s": "έτρεξα",
    },
}


class TestBulkUpsertWordEntriesEndpoint:
    """Integration tests for POST /api/v1/word-entries/bulk endpoint."""

    @pytest.fixture
    async def active_deck_for_bulk(self, db_session: AsyncSession):
        """Create an active deck for bulk word entry tests."""
        deck = Deck(
            id=uuid4(),
            name_en="Deck for Bulk Word Entry Tests",
            name_el="Τράπουλα για μαζικές λεξικές εγγραφές",
            name_ru="Колода для массовых словарных записей",
            description_en="Test deck for bulk word entry upload",
            description_el="Τράπουλα τεστ για μαζική φόρτωση λεξικών εγγραφών",
            description_ru="Тестовая колода для массовой загрузки словарных записей",
            level=DeckLevel.A1,
            is_active=True,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)
        return deck

    @pytest.fixture
    async def deck_with_existing_entry(self, db_session: AsyncSession, active_deck_for_bulk):
        """Create a deck with an existing word entry for update tests."""
        entry = WordEntry(
            id=uuid4(),
            deck_id=active_deck_for_bulk.id,
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="house (old translation)",
            translation_ru=None,
            pronunciation=None,
            grammar_data=None,
            examples=None,
            audio_key=None,
            is_active=True,
        )
        db_session.add(entry)
        await db_session.commit()
        await db_session.refresh(entry)
        return {"deck": active_deck_for_bulk, "entry": entry}

    # ========================================================================
    # Success Cases - Creating New Entries
    # ========================================================================

    @pytest.mark.asyncio
    async def test_bulk_upsert_word_entries_creates_new_entries(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test superuser can bulk create new word entries successfully."""
        request_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "word_entries": [
                BULK_MINIMAL_ENTRY,
                {
                    "lemma": "ψωμί",
                    "part_of_speech": "noun",
                    "translation_en": "bread",
                },
            ],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["deck_id"] == str(active_deck_for_bulk.id)
        assert data["created_count"] == 2
        assert data["updated_count"] == 0
        assert "cards_created" in data
        assert "cards_updated" in data
        assert isinstance(data["cards_created"], int)
        assert isinstance(data["cards_updated"], int)
        assert data["cards_created"] >= 0
        assert data["cards_updated"] >= 0
        assert len(data["word_entries"]) == 2

        # Verify entries data
        lemmas = {e["lemma"] for e in data["word_entries"]}
        assert "νερό" in lemmas
        assert "ψωμί" in lemmas

    @pytest.mark.asyncio
    async def test_bulk_upsert_word_entries_with_all_fields(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test bulk create with all optional fields populated."""
        request_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "word_entries": [BULK_NOUN_ENTRY],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == 1

        entry = data["word_entries"][0]
        assert entry["lemma"] == "σπίτι"
        assert entry["part_of_speech"] == "noun"
        assert entry["translation_en"] == "house, home"
        assert entry["translation_ru"] == "дом"
        assert entry["pronunciation"] == "/spí·ti/"
        assert entry["grammar_data"] is not None
        assert entry["grammar_data"]["gender"] == "neuter"
        assert entry["examples"] is not None
        assert len(entry["examples"]) == 1
        assert "id" in entry
        assert "created_at" in entry
        assert "updated_at" in entry

    # ========================================================================
    # Success Cases - Updating Existing Entries (Upsert)
    # ========================================================================

    @pytest.mark.asyncio
    async def test_bulk_upsert_word_entries_updates_existing(
        self, client: AsyncClient, superuser_auth_headers: dict, deck_with_existing_entry
    ):
        """Test bulk upsert updates existing entry matching (deck_id, lemma, part_of_speech)."""
        deck = deck_with_existing_entry["deck"]
        existing_entry = deck_with_existing_entry["entry"]

        # Same lemma and part_of_speech should update, not create
        request_data = {
            "deck_id": str(deck.id),
            "word_entries": [
                {
                    "lemma": "σπίτι",  # Same lemma
                    "part_of_speech": "noun",  # Same POS
                    "translation_en": "house, home (updated)",
                    "translation_ru": "дом",
                    "pronunciation": "/spí·ti/",
                },
            ],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == 0
        assert data["updated_count"] == 1
        assert len(data["word_entries"]) == 1

        # Verify the same ID was updated
        updated_entry = data["word_entries"][0]
        assert updated_entry["id"] == str(existing_entry.id)
        assert updated_entry["translation_en"] == "house, home (updated)"
        assert updated_entry["translation_ru"] == "дом"
        assert updated_entry["pronunciation"] == "/spí·ti/"

    @pytest.mark.asyncio
    async def test_bulk_upsert_word_entries_mixed_create_update(
        self, client: AsyncClient, superuser_auth_headers: dict, deck_with_existing_entry
    ):
        """Test bulk upsert with mix of new and existing entries."""
        deck = deck_with_existing_entry["deck"]

        request_data = {
            "deck_id": str(deck.id),
            "word_entries": [
                # This should UPDATE (same lemma + POS)
                {
                    "lemma": "σπίτι",
                    "part_of_speech": "noun",
                    "translation_en": "house (updated in mixed)",
                },
                # This should CREATE (new lemma)
                {
                    "lemma": "νερό",
                    "part_of_speech": "noun",
                    "translation_en": "water",
                },
                # This should CREATE (same lemma but different POS)
                {
                    "lemma": "σπίτι",
                    "part_of_speech": "verb",  # Different POS
                    "translation_en": "to house (rare)",
                },
            ],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == 2
        assert data["updated_count"] == 1
        assert len(data["word_entries"]) == 3

    @pytest.mark.asyncio
    async def test_bulk_upsert_word_entries_returns_correct_counts(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test response created_count + updated_count matches array length."""
        request_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "word_entries": [
                {"lemma": f"λέξη{i}", "part_of_speech": "noun", "translation_en": f"word{i}"}
                for i in range(5)
            ],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        total = data["created_count"] + data["updated_count"]
        assert total == len(data["word_entries"])
        assert total == 5

    # ========================================================================
    # Authentication & Authorization Tests
    # ========================================================================

    @pytest.mark.asyncio
    async def test_bulk_upsert_word_entries_unauthorized_401(
        self, client: AsyncClient, active_deck_for_bulk
    ):
        """Test unauthenticated request returns 401."""
        request_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "word_entries": [BULK_MINIMAL_ENTRY],
        }

        response = await client.post("/api/v1/word-entries/bulk", json=request_data)

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_bulk_upsert_word_entries_non_superuser_403(
        self, client: AsyncClient, auth_headers: dict, active_deck_for_bulk
    ):
        """Test regular user (non-superuser) returns 403."""
        request_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "word_entries": [BULK_MINIMAL_ENTRY],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=auth_headers,
        )

        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False

    # ========================================================================
    # Validation Error Tests (422)
    # ========================================================================

    @pytest.mark.asyncio
    async def test_bulk_upsert_word_entries_invalid_deck_404(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test non-existent deck_id returns 404."""
        non_existent_deck_id = uuid4()
        request_data = {
            "deck_id": str(non_existent_deck_id),
            "word_entries": [BULK_MINIMAL_ENTRY],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"
        assert str(non_existent_deck_id) in data["error"]["message"]

    @pytest.mark.asyncio
    async def test_bulk_upsert_word_entries_empty_array_422(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test empty word_entries array returns 422."""
        request_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "word_entries": [],  # Empty array violates min_length=1
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_bulk_upsert_word_entries_over_limit_422(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test >100 entries returns 422 (exceeds max_length)."""
        request_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "word_entries": [
                {"lemma": f"λέξη{i}", "part_of_speech": "noun", "translation_en": f"word{i}"}
                for i in range(101)  # 101 exceeds max_length=100
            ],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_bulk_upsert_word_entries_duplicate_lemma_pos_422(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test duplicate lemma + part_of_speech in same request returns 422."""
        request_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "word_entries": [
                {
                    "lemma": "σπίτι",
                    "part_of_speech": "noun",
                    "translation_en": "house",
                },
                {
                    "lemma": "σπίτι",  # Same lemma
                    "part_of_speech": "noun",  # Same POS - should fail
                    "translation_en": "home",
                },
            ],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_bulk_upsert_word_entries_invalid_part_of_speech_422(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test invalid part_of_speech enum value returns 422."""
        request_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "word_entries": [
                {
                    "lemma": "τεστ",
                    "part_of_speech": "invalid_pos",  # Invalid enum value
                    "translation_en": "test",
                }
            ],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_bulk_upsert_word_entries_missing_required_fields_422(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test missing required fields (lemma, translation_en) returns 422."""
        # Missing translation_en
        request_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "word_entries": [
                {
                    "lemma": "τεστ",
                    "part_of_speech": "noun",
                    # Missing translation_en
                }
            ],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_bulk_upsert_word_entries_missing_lemma_422(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test missing lemma field returns 422."""
        request_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "word_entries": [
                {
                    # Missing lemma
                    "part_of_speech": "noun",
                    "translation_en": "test",
                }
            ],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_bulk_upsert_word_entries_invalid_deck_id_format_422(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Test invalid deck_id format returns 422."""
        request_data = {
            "deck_id": "not-a-valid-uuid",
            "word_entries": [BULK_MINIMAL_ENTRY],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    # ========================================================================
    # Grammar Data Tests
    # ========================================================================

    @pytest.mark.asyncio
    async def test_bulk_upsert_word_entries_grammar_data_not_validated(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test arbitrary JSON in grammar_data is accepted without validation."""
        request_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "word_entries": [
                {
                    "lemma": "τεστ",
                    "part_of_speech": "noun",
                    "translation_en": "test",
                    "grammar_data": {
                        "arbitrary_key": "arbitrary_value",
                        "nested": {"deeply": {"nested": "data"}},
                        "array_field": [1, 2, 3],
                        "boolean_field": True,
                        "number_field": 42.5,
                    },
                }
            ],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == 1

        entry = data["word_entries"][0]
        assert entry["grammar_data"] is not None
        assert entry["grammar_data"]["arbitrary_key"] == "arbitrary_value"
        assert entry["grammar_data"]["nested"]["deeply"]["nested"] == "data"

    # ========================================================================
    # Persistence Verification Tests
    # ========================================================================

    @pytest.mark.asyncio
    async def test_bulk_upsert_word_entries_persisted_correctly(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        active_deck_for_bulk,
        db_session: AsyncSession,
    ):
        """Test bulk created entries are persisted in database."""
        request_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "word_entries": [BULK_NOUN_ENTRY],
        }

        # Create the entry
        create_response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert create_response.status_code == 201
        created_data = create_response.json()
        entry_id = created_data["word_entries"][0]["id"]

        # Verify via direct database query
        stmt = select(WordEntry).where(WordEntry.id == entry_id)
        result = await db_session.execute(stmt)
        db_entry = result.scalar_one()

        assert db_entry is not None
        assert db_entry.lemma == "σπίτι"
        assert db_entry.part_of_speech == PartOfSpeech.NOUN
        assert db_entry.translation_en == "house, home"
        assert db_entry.translation_ru == "дом"
        assert db_entry.pronunciation == "/spí·ti/"
        assert db_entry.grammar_data["gender"] == "neuter"

    @pytest.mark.asyncio
    async def test_bulk_upsert_word_entries_all_have_correct_deck_id(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test all created entries belong to the correct deck."""
        request_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "word_entries": [
                {"lemma": f"λέξη{i}", "part_of_speech": "noun", "translation_en": f"word{i}"}
                for i in range(5)
            ],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()

        # Verify all entries have the correct deck_id
        for entry in data["word_entries"]:
            assert entry["deck_id"] == str(active_deck_for_bulk.id)

    # ========================================================================
    # Edge Cases and Boundary Tests
    # ========================================================================

    @pytest.mark.asyncio
    async def test_bulk_upsert_single_entry(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test bulk upsert with exactly one entry (min_length boundary)."""
        request_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "word_entries": [BULK_MINIMAL_ENTRY],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == 1
        assert len(data["word_entries"]) == 1

    @pytest.mark.asyncio
    async def test_bulk_upsert_exactly_100_entries(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test bulk upsert with exactly 100 entries (max_length boundary)."""
        request_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "word_entries": [
                {"lemma": f"λέξη{i}", "part_of_speech": "noun", "translation_en": f"word{i}"}
                for i in range(100)  # Exactly at max_length
            ],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == 100
        assert len(data["word_entries"]) == 100

    @pytest.mark.asyncio
    async def test_bulk_upsert_all_parts_of_speech(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test bulk upsert with all valid part_of_speech values."""
        request_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "word_entries": [
                {"lemma": "σπίτι", "part_of_speech": "noun", "translation_en": "house"},
                {"lemma": "γράφω", "part_of_speech": "verb", "translation_en": "to write"},
                {"lemma": "καλός", "part_of_speech": "adjective", "translation_en": "good"},
                {"lemma": "γρήγορα", "part_of_speech": "adverb", "translation_en": "quickly"},
                {"lemma": "καλημέρα", "part_of_speech": "phrase", "translation_en": "good morning"},
            ],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == 5

        parts_of_speech = {e["part_of_speech"] for e in data["word_entries"]}
        assert "noun" in parts_of_speech
        assert "verb" in parts_of_speech
        assert "adjective" in parts_of_speech
        assert "adverb" in parts_of_speech
        assert "phrase" in parts_of_speech

    @pytest.mark.asyncio
    async def test_bulk_upsert_empty_lemma_rejected(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test empty lemma string is rejected."""
        request_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "word_entries": [
                {
                    "lemma": "",  # Empty string
                    "part_of_speech": "noun",
                    "translation_en": "test",
                }
            ],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_bulk_upsert_whitespace_only_lemma_rejected(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test whitespace-only lemma is rejected."""
        request_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "word_entries": [
                {
                    "lemma": "   ",  # Whitespace only
                    "part_of_speech": "noun",
                    "translation_en": "test",
                }
            ],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    @pytest.mark.asyncio
    async def test_bulk_upsert_response_includes_all_fields(
        self, client: AsyncClient, superuser_auth_headers: dict, active_deck_for_bulk
    ):
        """Test each entry in response has all expected fields."""
        request_data = {
            "deck_id": str(active_deck_for_bulk.id),
            "word_entries": [BULK_NOUN_ENTRY],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()

        # Verify top-level response includes card count fields
        assert "cards_created" in data, "Missing cards_created in response"
        assert "cards_updated" in data, "Missing cards_updated in response"
        assert isinstance(data["cards_created"], int)
        assert isinstance(data["cards_updated"], int)

        entry = data["word_entries"][0]

        # Verify all WordEntryResponse fields are present
        required_fields = [
            "id",
            "deck_id",
            "lemma",
            "part_of_speech",
            "translation_en",
            "translation_ru",
            "pronunciation",
            "grammar_data",
            "examples",
            "audio_key",
            "is_active",
            "created_at",
            "updated_at",
        ]
        for field in required_fields:
            assert field in entry, f"Missing required field: {field}"


class TestBulkUpsertCardGeneration:
    """Integration tests for card generation during bulk word entry upload."""

    @pytest.fixture
    async def active_deck_for_card_gen(self, db_session: AsyncSession):
        """Create an active V2 deck for card generation tests."""
        deck = Deck(
            id=uuid4(),
            name_en="Deck for Card Gen Tests",
            name_el="Τράπουλα δημιουργίας καρτών",
            name_ru="Колода для генерации карточек",
            description_en="Test deck for card generation integration",
            description_el="Τράπουλα τεστ",
            description_ru="Тестовая колода",
            level=DeckLevel.A1,
            is_active=True,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)
        return deck

    # ========================================================================
    # Card Generation - Response Count Tests
    # ========================================================================

    @pytest.mark.asyncio
    async def test_bulk_upload_creates_cards_for_new_entries(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        active_deck_for_card_gen,
    ):
        """Test first-time bulk upload of 2 entries creates 4 cards total (2 per entry)."""
        request_data = {
            "deck_id": str(active_deck_for_card_gen.id),
            "word_entries": [
                CARD_GEN_ENTRY_WITH_EXAMPLES,
                CARD_GEN_ENTRY_WITHOUT_EXAMPLES,
            ],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == 2
        assert data["updated_count"] == 0
        # δρόμος (noun with example id): 2 meaning + 2 sentence_translation = 4
        # τρέχω (verb, no examples): 2 meaning = 2
        assert data["cards_created"] == 6
        assert data["cards_updated"] == 0

    @pytest.mark.asyncio
    async def test_bulk_upload_reupload_updates_cards(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        active_deck_for_card_gen,
    ):
        """Test re-uploading the same entries updates existing cards instead of creating duplicates."""
        request_data = {
            "deck_id": str(active_deck_for_card_gen.id),
            "word_entries": [
                CARD_GEN_ENTRY_WITH_EXAMPLES,
                CARD_GEN_ENTRY_WITHOUT_EXAMPLES,
            ],
        }

        # First upload -- creates
        first_response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )
        assert first_response.status_code == 201
        first_data = first_response.json()
        # δρόμος: 2 meaning + 2 sentence_translation; τρέχω: 2 meaning = 6 total
        assert first_data["cards_created"] == 6
        assert first_data["cards_updated"] == 0

        # Second upload -- same data, should update
        second_response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )
        assert second_response.status_code == 201
        second_data = second_response.json()
        assert second_data["cards_created"] == 0
        assert second_data["cards_updated"] == 6

    # ========================================================================
    # Card Generation - Database Verification Tests
    # ========================================================================

    @pytest.mark.asyncio
    async def test_bulk_upload_card_records_table_correct(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        active_deck_for_card_gen,
        db_session: AsyncSession,
    ):
        """Test card_records table contains correct rows with correct field values after bulk upload."""
        request_data = {
            "deck_id": str(active_deck_for_card_gen.id),
            "word_entries": [
                CARD_GEN_ENTRY_WITH_EXAMPLES,
                CARD_GEN_ENTRY_WITHOUT_EXAMPLES,
            ],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )
        assert response.status_code == 201
        data = response.json()

        # Collect word entry IDs from response
        word_entry_ids = [entry["id"] for entry in data["word_entries"]]
        assert len(word_entry_ids) == 2

        # Query card_records table directly
        stmt = (
            select(CardRecord)
            .where(CardRecord.word_entry_id.in_(word_entry_ids))
            .order_by(CardRecord.word_entry_id, CardRecord.card_type)
        )
        result = await db_session.execute(stmt)
        card_records = list(result.scalars().all())

        # δρόμος (noun with example id): 2 meaning + 2 sentence_translation = 4
        # τρέχω (verb, no examples): 2 meaning = 2
        # Total: 6
        assert len(card_records) == 6

        # Group by word_entry_id
        cards_by_entry = {}
        for cr in card_records:
            cards_by_entry.setdefault(str(cr.word_entry_id), []).append(cr)

        entry_with_examples = next(e for e in data["word_entries"] if e["lemma"] == "δρόμος")
        entry_without_examples = next(e for e in data["word_entries"] if e["lemma"] == "τρέχω")

        for we_id, cards in cards_by_entry.items():
            card_types = {cr.card_type for cr in cards}
            assert CardType.MEANING_EL_TO_EN in card_types
            assert CardType.MEANING_EN_TO_EL in card_types

            if we_id == entry_with_examples["id"]:
                # δρόμος: 2 meaning + 2 sentence_translation
                assert len(cards) == 4
                assert CardType.SENTENCE_TRANSLATION in card_types
            else:
                # τρέχω: 2 meaning only
                assert len(cards) == 2

            for cr in cards:
                assert cr.tier == 1
                assert cr.is_active is True
                assert cr.deck_id == active_deck_for_card_gen.id

                # Validate front_content structure (common to all card types)
                assert "prompt" in cr.front_content
                assert "main" in cr.front_content
                assert "badge" in cr.front_content
                assert "card_type" in cr.front_content

                # Validate back_content structure (common to all card types)
                assert "answer" in cr.back_content
                assert "card_type" in cr.back_content

                # Meaning cards use "default" variant_key
                if cr.card_type in (CardType.MEANING_EL_TO_EN, CardType.MEANING_EN_TO_EL):
                    assert cr.variant_key == "default"

        # Verify specific front/back content for el_to_en card of entry WITH examples
        entry_with_examples = next(e for e in data["word_entries"] if e["lemma"] == "δρόμος")
        el_to_en_card = next(
            cr
            for cr in card_records
            if str(cr.word_entry_id) == entry_with_examples["id"]
            and cr.card_type == CardType.MEANING_EL_TO_EN
        )
        assert el_to_en_card.front_content["main"] == "δρόμος"
        assert el_to_en_card.back_content["answer"] == "road, street"

        # Verify en_to_el card for entry WITHOUT examples
        entry_without_examples = next(e for e in data["word_entries"] if e["lemma"] == "τρέχω")
        en_to_el_card = next(
            cr
            for cr in card_records
            if str(cr.word_entry_id) == entry_without_examples["id"]
            and cr.card_type == CardType.MEANING_EN_TO_EL
        )
        assert en_to_el_card.front_content["main"] == "to run"
        assert en_to_el_card.back_content["answer"] == "τρέχω"

    @pytest.mark.asyncio
    async def test_bulk_upload_card_context_populated_correctly(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        active_deck_for_card_gen,
        db_session: AsyncSession,
    ):
        """Test context field in back_content is populated for entries with examples and null for entries without."""
        request_data = {
            "deck_id": str(active_deck_for_card_gen.id),
            "word_entries": [
                CARD_GEN_ENTRY_WITH_EXAMPLES,
                CARD_GEN_ENTRY_WITHOUT_EXAMPLES,
            ],
        }

        response = await client.post(
            "/api/v1/word-entries/bulk",
            json=request_data,
            headers=superuser_auth_headers,
        )
        assert response.status_code == 201
        data = response.json()

        word_entry_ids = [entry["id"] for entry in data["word_entries"]]

        stmt = select(CardRecord).where(CardRecord.word_entry_id.in_(word_entry_ids))
        result = await db_session.execute(stmt)
        card_records = list(result.scalars().all())

        # Find the entry with examples (δρόμος)
        entry_with_examples = next(e for e in data["word_entries"] if e["lemma"] == "δρόμος")
        # Find the entry without examples (τρέχω)
        entry_without_examples = next(e for e in data["word_entries"] if e["lemma"] == "τρέχω")

        # MEANING cards for entry WITH examples should have context populated.
        # SENTENCE_TRANSLATION cards do not have a context field (they ARE the sentence).
        meaning_cards_with_examples = [
            cr
            for cr in card_records
            if str(cr.word_entry_id) == entry_with_examples["id"]
            and cr.card_type in (CardType.MEANING_EL_TO_EN, CardType.MEANING_EN_TO_EL)
        ]
        assert len(meaning_cards_with_examples) == 2, "Expected 2 meaning cards for δρόμος"
        for cr in meaning_cards_with_examples:
            context = cr.back_content.get("context")
            assert context is not None, (
                f"context should be populated for meaning card of entry with examples "
                f"(card_type={cr.card_type})"
            )
            assert context["greek"] == "Ο δρόμος είναι μεγάλος."
            assert context["english"] == "The road is big."
            assert context["label"] == "Example"

        # Cards for entry WITHOUT examples should have context as None
        cards_without_examples = [
            cr for cr in card_records if str(cr.word_entry_id) == entry_without_examples["id"]
        ]
        for cr in cards_without_examples:
            context = cr.back_content.get("context")
            assert context is None, (
                f"context should be None for entry without examples " f"(card_type={cr.card_type})"
            )
