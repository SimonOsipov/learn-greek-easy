"""Integration tests for Deck Word Entries API endpoint.

This module contains integration tests for GET /api/v1/decks/{deck_id}/word-entries endpoint.
Tests verify endpoint behavior with real database operations including:
- Pagination with page/page_size
- Search by lemma, translations, or pronunciation
- Filter by part of speech
- Sort by lemma or created_at
- Authentication and authorization
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Deck, DeckLevel, PartOfSpeech, User, WordEntry


class TestDeckWordEntriesEndpoint:
    """Integration tests for GET /api/v1/decks/{deck_id}/word-entries endpoint."""

    @pytest.fixture
    async def deck_for_word_entries(self, db_session: AsyncSession):
        """Create an active deck for word entry tests."""
        deck = Deck(
            id=uuid4(),
            name_en="Word Entries Test Deck",
            name_el="Τεστ Λεξιλόγιο",
            name_ru="Тестовая колода",
            description_en="Test deck for word entries endpoint",
            description_el="Τεστ τράπουλα για λεξιλόγιο",
            description_ru="Тестовая колода для словаря",
            level=DeckLevel.A1,
            is_active=True,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)
        return deck

    @pytest.fixture
    async def deck_with_word_entries(self, db_session: AsyncSession, deck_for_word_entries):
        """Create a deck with multiple word entries for testing."""
        entries = [
            WordEntry(
                id=uuid4(),
                deck_id=deck_for_word_entries.id,
                lemma="σπίτι",
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="house, home",
                translation_ru="дом",
                pronunciation="/spí·ti/",
                cefr_level=DeckLevel.A1,
                is_active=True,
            ),
            WordEntry(
                id=uuid4(),
                deck_id=deck_for_word_entries.id,
                lemma="γράφω",
                part_of_speech=PartOfSpeech.VERB,
                translation_en="to write",
                translation_ru="писать",
                pronunciation="/ghrá·fo/",
                cefr_level=DeckLevel.A1,
                is_active=True,
            ),
            WordEntry(
                id=uuid4(),
                deck_id=deck_for_word_entries.id,
                lemma="καλός",
                part_of_speech=PartOfSpeech.ADJECTIVE,
                translation_en="good, beautiful",
                translation_ru="хороший",
                pronunciation="/ka·lós/",
                cefr_level=DeckLevel.A1,
                is_active=True,
            ),
            WordEntry(
                id=uuid4(),
                deck_id=deck_for_word_entries.id,
                lemma="νερό",
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="water",
                translation_ru="вода",
                pronunciation="/ne·ró/",
                cefr_level=DeckLevel.A1,
                is_active=True,
            ),
            WordEntry(
                id=uuid4(),
                deck_id=deck_for_word_entries.id,
                lemma="τρέχω",
                part_of_speech=PartOfSpeech.VERB,
                translation_en="to run",
                translation_ru="бежать",
                pronunciation="/tré·cho/",
                cefr_level=DeckLevel.A2,
                is_active=True,
            ),
        ]
        for entry in entries:
            db_session.add(entry)
        await db_session.commit()
        for entry in entries:
            await db_session.refresh(entry)
        return {"deck": deck_for_word_entries, "entries": entries}

    @pytest.fixture
    async def other_user_deck_with_entries(self, db_session: AsyncSession):
        """Create a deck owned by another user for authorization tests."""
        # Create another user
        other_user = User(
            email="other_user_word_entries@example.com",
            password_hash=None,
            full_name="Other Word Entry User",
            is_active=True,
            is_superuser=False,
            auth0_id="auth0|other_user_word_entries_test",
        )
        db_session.add(other_user)
        await db_session.commit()
        await db_session.refresh(other_user)

        # Create a deck owned by the other user
        deck = Deck(
            id=uuid4(),
            name_en="Other User's Word Entry Deck",
            name_el="Τράπουλα Άλλου Χρήστη",
            name_ru="Колода Другого Пользователя",
            description_en="This deck belongs to someone else",
            description_el="Αυτή η τράπουλα ανήκει σε κάποιον άλλο",
            description_ru="Эта колода принадлежит другому",
            level=DeckLevel.A1,
            is_active=True,
            owner_id=other_user.id,
        )
        db_session.add(deck)
        await db_session.commit()
        await db_session.refresh(deck)

        # Add a word entry to it
        entry = WordEntry(
            id=uuid4(),
            deck_id=deck.id,
            lemma="τεστ",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="test",
            is_active=True,
        )
        db_session.add(entry)
        await db_session.commit()
        await db_session.refresh(entry)

        return {"deck": deck, "entry": entry, "user": other_user}

    # ========================================================================
    # Authentication Tests
    # ========================================================================

    @pytest.mark.asyncio
    async def test_list_word_entries_unauthenticated_returns_401(
        self, client: AsyncClient, deck_for_word_entries
    ):
        """Test unauthenticated request returns 401."""
        response = await client.get(f"/api/v1/decks/{deck_for_word_entries.id}/word-entries")

        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    # ========================================================================
    # Success Cases
    # ========================================================================

    @pytest.mark.asyncio
    async def test_list_word_entries_success(
        self, client: AsyncClient, auth_headers: dict, deck_with_word_entries
    ):
        """Test successfully listing word entries for a deck."""
        deck = deck_with_word_entries["deck"]
        entries = deck_with_word_entries["entries"]

        response = await client.get(
            f"/api/v1/decks/{deck.id}/word-entries",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["deck_id"] == str(deck.id)
        assert data["total"] == len(entries)
        assert data["page"] == 1
        assert data["page_size"] == 20
        assert len(data["word_entries"]) == len(entries)

        # Verify all entries are returned (sorted by lemma by default)
        lemmas = [entry["lemma"] for entry in data["word_entries"]]
        assert lemmas == sorted(lemmas)

    @pytest.mark.asyncio
    async def test_list_word_entries_empty_deck(
        self, client: AsyncClient, auth_headers: dict, deck_for_word_entries
    ):
        """Test listing word entries for a deck with no entries returns empty list."""
        response = await client.get(
            f"/api/v1/decks/{deck_for_word_entries.id}/word-entries",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["deck_id"] == str(deck_for_word_entries.id)
        assert data["total"] == 0
        assert data["word_entries"] == []

    # ========================================================================
    # Pagination Tests
    # ========================================================================

    @pytest.mark.asyncio
    async def test_list_word_entries_pagination(
        self, client: AsyncClient, auth_headers: dict, deck_with_word_entries
    ):
        """Test pagination works correctly."""
        deck = deck_with_word_entries["deck"]

        # Request page 1 with page_size=2
        response = await client.get(
            f"/api/v1/decks/{deck.id}/word-entries?page=1&page_size=2",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert len(data["word_entries"]) == 2

        # Request page 2
        response_page2 = await client.get(
            f"/api/v1/decks/{deck.id}/word-entries?page=2&page_size=2",
            headers=auth_headers,
        )

        assert response_page2.status_code == 200
        data_page2 = response_page2.json()
        assert data_page2["page"] == 2
        assert len(data_page2["word_entries"]) == 2

        # Ensure different entries on different pages
        page1_ids = [e["id"] for e in data["word_entries"]]
        page2_ids = [e["id"] for e in data_page2["word_entries"]]
        assert not set(page1_ids).intersection(set(page2_ids))

    # ========================================================================
    # Search Tests
    # ========================================================================

    @pytest.mark.asyncio
    async def test_list_word_entries_search(
        self, client: AsyncClient, auth_headers: dict, deck_with_word_entries
    ):
        """Test search by lemma works correctly."""
        deck = deck_with_word_entries["deck"]

        # Search for "σπίτι"
        response = await client.get(
            f"/api/v1/decks/{deck.id}/word-entries?search=σπίτι",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["word_entries"]) == 1
        assert data["word_entries"][0]["lemma"] == "σπίτι"

    @pytest.mark.asyncio
    async def test_list_word_entries_search_by_translation(
        self, client: AsyncClient, auth_headers: dict, deck_with_word_entries
    ):
        """Test search by translation works correctly."""
        deck = deck_with_word_entries["deck"]

        # Search for "house" (English translation)
        response = await client.get(
            f"/api/v1/decks/{deck.id}/word-entries?search=house",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["word_entries"][0]["lemma"] == "σπίτι"

    @pytest.mark.asyncio
    async def test_list_word_entries_search_no_results(
        self, client: AsyncClient, auth_headers: dict, deck_with_word_entries
    ):
        """Test search with no matches returns empty list."""
        deck = deck_with_word_entries["deck"]

        response = await client.get(
            f"/api/v1/decks/{deck.id}/word-entries?search=nonexistent",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["word_entries"] == []

    # ========================================================================
    # Filter Tests
    # ========================================================================

    @pytest.mark.asyncio
    async def test_list_word_entries_filter_by_part_of_speech(
        self, client: AsyncClient, auth_headers: dict, deck_with_word_entries
    ):
        """Test filtering by part of speech works correctly."""
        deck = deck_with_word_entries["deck"]

        # Filter for nouns only
        response = await client.get(
            f"/api/v1/decks/{deck.id}/word-entries?part_of_speech=noun",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2  # σπίτι and νερό are nouns
        assert all(e["part_of_speech"] == "noun" for e in data["word_entries"])

        # Filter for verbs
        response_verbs = await client.get(
            f"/api/v1/decks/{deck.id}/word-entries?part_of_speech=verb",
            headers=auth_headers,
        )

        assert response_verbs.status_code == 200
        data_verbs = response_verbs.json()
        assert data_verbs["total"] == 2  # γράφω and τρέχω are verbs
        assert all(e["part_of_speech"] == "verb" for e in data_verbs["word_entries"])

    # ========================================================================
    # Sort Tests
    # ========================================================================

    @pytest.mark.asyncio
    async def test_list_word_entries_sort(
        self, client: AsyncClient, auth_headers: dict, deck_with_word_entries
    ):
        """Test sorting works correctly."""
        deck = deck_with_word_entries["deck"]

        # Sort by lemma ascending (default)
        response_asc = await client.get(
            f"/api/v1/decks/{deck.id}/word-entries?sort_by=lemma&sort_order=asc",
            headers=auth_headers,
        )

        assert response_asc.status_code == 200
        data_asc = response_asc.json()
        lemmas_asc = [e["lemma"] for e in data_asc["word_entries"]]
        assert lemmas_asc == sorted(lemmas_asc)

        # Sort by lemma descending
        response_desc = await client.get(
            f"/api/v1/decks/{deck.id}/word-entries?sort_by=lemma&sort_order=desc",
            headers=auth_headers,
        )

        assert response_desc.status_code == 200
        data_desc = response_desc.json()
        lemmas_desc = [e["lemma"] for e in data_desc["word_entries"]]
        assert lemmas_desc == sorted(lemmas_desc, reverse=True)

    # ========================================================================
    # Error Cases
    # ========================================================================

    @pytest.mark.asyncio
    async def test_list_word_entries_deck_not_found(self, client: AsyncClient, auth_headers: dict):
        """Test 404 when deck doesn't exist."""
        non_existent_id = uuid4()

        response = await client.get(
            f"/api/v1/decks/{non_existent_id}/word-entries",
            headers=auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_list_word_entries_forbidden_other_user_deck(
        self, client: AsyncClient, auth_headers: dict, other_user_deck_with_entries
    ):
        """Test 403 when trying to access another user's deck."""
        deck = other_user_deck_with_entries["deck"]

        response = await client.get(
            f"/api/v1/decks/{deck.id}/word-entries",
            headers=auth_headers,
        )

        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_list_word_entries_inactive_deck_returns_404(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession
    ):
        """Test 404 when deck is inactive."""
        # Create an inactive deck
        inactive_deck = Deck(
            id=uuid4(),
            name_en="Inactive Deck",
            name_el="Ανενεργή Τράπουλα",
            name_ru="Неактивная Колода",
            level=DeckLevel.A1,
            is_active=False,
        )
        db_session.add(inactive_deck)
        await db_session.commit()
        await db_session.refresh(inactive_deck)

        response = await client.get(
            f"/api/v1/decks/{inactive_deck.id}/word-entries",
            headers=auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False

    # ========================================================================
    # Validation Tests
    # ========================================================================

    @pytest.mark.asyncio
    async def test_list_word_entries_invalid_page_returns_422(
        self, client: AsyncClient, auth_headers: dict, deck_for_word_entries
    ):
        """Test invalid page parameter returns 422."""
        response = await client.get(
            f"/api/v1/decks/{deck_for_word_entries.id}/word-entries?page=0",
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_list_word_entries_invalid_page_size_returns_422(
        self, client: AsyncClient, auth_headers: dict, deck_for_word_entries
    ):
        """Test invalid page_size parameter returns 422."""
        response = await client.get(
            f"/api/v1/decks/{deck_for_word_entries.id}/word-entries?page_size=101",
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_list_word_entries_invalid_part_of_speech_returns_422(
        self, client: AsyncClient, auth_headers: dict, deck_for_word_entries
    ):
        """Test invalid part_of_speech parameter returns 422."""
        response = await client.get(
            f"/api/v1/decks/{deck_for_word_entries.id}/word-entries?part_of_speech=invalid",
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_list_word_entries_invalid_sort_by_returns_422(
        self, client: AsyncClient, auth_headers: dict, deck_for_word_entries
    ):
        """Test invalid sort_by parameter returns 422."""
        response = await client.get(
            f"/api/v1/decks/{deck_for_word_entries.id}/word-entries?sort_by=invalid",
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_list_word_entries_invalid_sort_order_returns_422(
        self, client: AsyncClient, auth_headers: dict, deck_for_word_entries
    ):
        """Test invalid sort_order parameter returns 422."""
        response = await client.get(
            f"/api/v1/decks/{deck_for_word_entries.id}/word-entries?sort_order=invalid",
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False

    # ========================================================================
    # Combined Filter Tests
    # ========================================================================

    @pytest.mark.asyncio
    async def test_list_word_entries_combined_search_and_filter(
        self, client: AsyncClient, auth_headers: dict, deck_with_word_entries
    ):
        """Test search combined with part_of_speech filter."""
        deck = deck_with_word_entries["deck"]

        # Search for entries containing "to" and filter by verb
        response = await client.get(
            f"/api/v1/decks/{deck.id}/word-entries?search=to&part_of_speech=verb",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        # Both "γράφω" (to write) and "τρέχω" (to run) match
        assert data["total"] == 2
        assert all(e["part_of_speech"] == "verb" for e in data["word_entries"])

    # ========================================================================
    # Response Structure Tests
    # ========================================================================

    @pytest.mark.asyncio
    async def test_list_word_entries_response_structure(
        self, client: AsyncClient, auth_headers: dict, deck_with_word_entries
    ):
        """Test the response includes all expected fields."""
        deck = deck_with_word_entries["deck"]

        response = await client.get(
            f"/api/v1/decks/{deck.id}/word-entries?page_size=1",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Check top-level response structure
        assert "deck_id" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "word_entries" in data

        # Check word entry structure
        assert len(data["word_entries"]) == 1
        entry = data["word_entries"][0]
        assert "id" in entry
        assert "deck_id" in entry
        assert "lemma" in entry
        assert "part_of_speech" in entry
        assert "translation_en" in entry
        assert "is_active" in entry
        assert "created_at" in entry
        assert "updated_at" in entry
