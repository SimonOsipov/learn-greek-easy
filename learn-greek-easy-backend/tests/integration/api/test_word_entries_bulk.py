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

from src.db.models import Deck, DeckLevel, PartOfSpeech, WordEntry

# ============================================================================
# Test Data Fixtures
# ============================================================================

BULK_NOUN_ENTRY = {
    "lemma": "σπίτι",
    "part_of_speech": "noun",
    "translation_en": "house, home",
    "translation_ru": "дом",
    "cefr_level": "A1",
    "pronunciation": "/ˈspiti/",
    "grammar_data": {
        "gender": "neuter",
        "nominative_singular": "σπίτι",
        "genitive_singular": "σπιτιού",
        "nominative_plural": "σπίτια",
        "genitive_plural": "σπιτιών",
    },
    "examples": [
        {
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
    "cefr_level": "A1",
    "pronunciation": "/ˈɣrafo/",
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
    "cefr_level": "A1",
}

BULK_MINIMAL_ENTRY = {
    "lemma": "νερό",
    "part_of_speech": "noun",
    "translation_en": "water",
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
            cefr_level=None,
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
        assert entry["cefr_level"] == "A1"
        assert entry["pronunciation"] == "/ˈspiti/"
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
                    "pronunciation": "/ˈspiti/",
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
        assert updated_entry["pronunciation"] == "/ˈspiti/"

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
        assert db_entry.pronunciation == "/ˈspiti/"
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
        entry = data["word_entries"][0]

        # Verify all WordEntryResponse fields are present
        required_fields = [
            "id",
            "deck_id",
            "lemma",
            "part_of_speech",
            "cefr_level",
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
