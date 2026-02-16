"""Integration tests for GET /api/v1/word-entries/{word_entry_id} endpoint.

This module contains integration tests for retrieving word entries by ID including:
- Successful retrieval for authenticated users
- Authorization checks (system vs user-created decks)
- 404 handling for non-existent or inactive entries
- Response field validation
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Deck, DeckLevel, PartOfSpeech, User, WordEntry

# ============================================================================
# Test Data Fixtures
# ============================================================================

WORD_ENTRY_NOUN = {
    "lemma": "σπίτι",
    "part_of_speech": PartOfSpeech.NOUN,
    "translation_en": "house, home",
    "translation_ru": "дом",
    "pronunciation": "/spí·ti/",
    "grammar_data": {
        "gender": "neuter",
        "nominative_singular": "σπίτι",
        "genitive_singular": "σπιτιού",
        "accusative_singular": "σπίτι",
        "vocative_singular": "σπίτι",
        "nominative_plural": "σπίτια",
        "genitive_plural": "σπιτιών",
        "accusative_plural": "σπίτια",
        "vocative_plural": "σπίτια",
    },
    "examples": [
        {
            "greek": "Το σπίτι μου είναι μικρό.",
            "english": "My house is small.",
            "russian": "Мой дом маленький.",
        }
    ],
}

WORD_ENTRY_VERB = {
    "lemma": "γράφω",
    "part_of_speech": PartOfSpeech.VERB,
    "translation_en": "to write",
    "translation_ru": "писать",
    "pronunciation": "/ghrá·fo/",
    "grammar_data": {
        "voice": "active",
        "present_1s": "γράφω",
        "present_2s": "γράφεις",
        "present_3s": "γράφει",
        "present_1p": "γράφουμε",
        "present_2p": "γράφετε",
        "present_3p": "γράφουν",
        "past_1s": "έγραψα",
        "imperative_2s": "γράψε",
        "imperative_2p": "γράψτε",
    },
}


class TestGetWordEntryEndpoint:
    """Integration tests for GET /api/v1/word-entries/{word_entry_id} endpoint."""

    @pytest.fixture
    async def system_deck_with_entry(self, db_session: AsyncSession):
        """Create a system deck (no owner) with a word entry."""
        deck = Deck(
            id=uuid4(),
            name_en="System Deck for Word Entry Tests",
            name_el="Τράπουλα συστήματος για δοκιμές",
            name_ru="Системная колода для тестов",
            description_en="Test deck for word entry retrieval",
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
            **WORD_ENTRY_NOUN,
        )
        db_session.add(entry)
        await db_session.commit()
        await db_session.refresh(deck)
        await db_session.refresh(entry)

        return {"deck": deck, "entry": entry}

    @pytest.fixture
    async def user_deck_with_entry(self, db_session: AsyncSession, test_user: User):
        """Create a user-owned deck with a word entry."""
        deck = Deck(
            id=uuid4(),
            name_en="User Deck for Word Entry Tests",
            name_el="Τράπουλα χρήστη για δοκιμές",
            name_ru="Пользовательская колода для тестов",
            description_en="Test deck for word entry retrieval",
            description_el="Τράπουλα δοκιμής",
            description_ru="Тестовая колода",
            level=DeckLevel.A1,
            is_active=True,
            owner_id=test_user.id,  # User-owned deck
        )
        db_session.add(deck)
        await db_session.flush()

        entry = WordEntry(
            id=uuid4(),
            deck_id=deck.id,
            is_active=True,
            **WORD_ENTRY_VERB,
        )
        db_session.add(entry)
        await db_session.commit()
        await db_session.refresh(deck)
        await db_session.refresh(entry)

        return {"deck": deck, "entry": entry}

    @pytest.fixture
    async def other_user_deck_with_entry(self, db_session: AsyncSession):
        """Create a deck owned by another user with a word entry."""
        # Create another user
        other_user = User(
            id=uuid4(),
            email="other_user@test.com",
            full_name="Other User",
            is_active=True,
        )
        db_session.add(other_user)
        await db_session.flush()

        deck = Deck(
            id=uuid4(),
            name_en="Other User Deck",
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
            **WORD_ENTRY_NOUN,
        )
        db_session.add(entry)
        await db_session.commit()
        await db_session.refresh(entry)

        return {"deck": deck, "entry": entry, "user": other_user}

    @pytest.fixture
    async def inactive_word_entry(self, db_session: AsyncSession, system_deck_with_entry):
        """Create an inactive word entry."""
        deck = system_deck_with_entry["deck"]

        entry = WordEntry(
            id=uuid4(),
            deck_id=deck.id,
            lemma="inactive_word",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="inactive",
            is_active=False,  # Inactive entry
        )
        db_session.add(entry)
        await db_session.commit()
        await db_session.refresh(entry)

        return entry

    # ========================================================================
    # Success Cases
    # ========================================================================

    @pytest.mark.asyncio
    async def test_get_word_entry_from_system_deck_success(
        self, client: AsyncClient, auth_headers: dict, system_deck_with_entry
    ):
        """Test authenticated user can retrieve word entry from system deck."""
        entry = system_deck_with_entry["entry"]

        response = await client.get(
            f"/api/v1/word-entries/{entry.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(entry.id)
        assert data["deck_id"] == str(system_deck_with_entry["deck"].id)
        assert data["lemma"] == "σπίτι"
        assert data["part_of_speech"] == "noun"
        assert data["translation_en"] == "house, home"
        assert data["translation_ru"] == "дом"
        assert data["pronunciation"] == "/spí·ti/"
        assert data["is_active"] is True

    @pytest.mark.asyncio
    async def test_get_word_entry_includes_grammar_data(
        self, client: AsyncClient, auth_headers: dict, system_deck_with_entry
    ):
        """Test response includes full grammar_data."""
        entry = system_deck_with_entry["entry"]

        response = await client.get(
            f"/api/v1/word-entries/{entry.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        grammar_data = data["grammar_data"]
        assert grammar_data is not None
        assert grammar_data["gender"] == "neuter"
        assert grammar_data["nominative_singular"] == "σπίτι"
        assert grammar_data["genitive_singular"] == "σπιτιού"

    @pytest.mark.asyncio
    async def test_get_word_entry_includes_examples(
        self, client: AsyncClient, auth_headers: dict, system_deck_with_entry
    ):
        """Test response includes examples array."""
        entry = system_deck_with_entry["entry"]

        response = await client.get(
            f"/api/v1/word-entries/{entry.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        examples = data["examples"]
        assert examples is not None
        assert len(examples) == 1
        assert examples[0]["greek"] == "Το σπίτι μου είναι μικρό."
        assert examples[0]["english"] == "My house is small."
        assert examples[0]["russian"] == "Мой дом маленький."

    @pytest.mark.asyncio
    async def test_get_word_entry_from_own_deck_success(
        self, client: AsyncClient, auth_headers: dict, user_deck_with_entry
    ):
        """Test user can retrieve word entry from their own deck."""
        entry = user_deck_with_entry["entry"]

        response = await client.get(
            f"/api/v1/word-entries/{entry.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(entry.id)
        assert data["lemma"] == "γράφω"
        assert data["part_of_speech"] == "verb"

    @pytest.mark.asyncio
    async def test_get_word_entry_response_has_all_fields(
        self, client: AsyncClient, auth_headers: dict, system_deck_with_entry
    ):
        """Test response includes all WordEntryResponse fields."""
        entry = system_deck_with_entry["entry"]

        response = await client.get(
            f"/api/v1/word-entries/{entry.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Verify all required fields are present
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
            assert field in data, f"Missing required field: {field}"

    # ========================================================================
    # Authentication Tests (401)
    # ========================================================================

    @pytest.mark.asyncio
    async def test_get_word_entry_unauthorized_401(
        self, client: AsyncClient, system_deck_with_entry
    ):
        """Test unauthenticated request returns 401."""
        entry = system_deck_with_entry["entry"]

        response = await client.get(f"/api/v1/word-entries/{entry.id}")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    # ========================================================================
    # Authorization Tests (403)
    # ========================================================================

    @pytest.mark.asyncio
    async def test_get_word_entry_from_other_users_deck_403(
        self, client: AsyncClient, auth_headers: dict, other_user_deck_with_entry
    ):
        """Test user cannot access word entry from another user's deck."""
        entry = other_user_deck_with_entry["entry"]

        response = await client.get(
            f"/api/v1/word-entries/{entry.id}",
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
    async def test_get_word_entry_not_found_404(self, client: AsyncClient, auth_headers: dict):
        """Test non-existent word entry returns 404."""
        non_existent_id = uuid4()

        response = await client.get(
            f"/api/v1/word-entries/{non_existent_id}",
            headers=auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_get_inactive_word_entry_404(
        self, client: AsyncClient, auth_headers: dict, inactive_word_entry
    ):
        """Test inactive word entry returns 404."""
        response = await client.get(
            f"/api/v1/word-entries/{inactive_word_entry.id}",
            headers=auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"

    # ========================================================================
    # Validation Tests (422)
    # ========================================================================

    @pytest.mark.asyncio
    async def test_get_word_entry_invalid_uuid_422(self, client: AsyncClient, auth_headers: dict):
        """Test invalid UUID format returns 422."""
        response = await client.get(
            "/api/v1/word-entries/not-a-valid-uuid",
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"
