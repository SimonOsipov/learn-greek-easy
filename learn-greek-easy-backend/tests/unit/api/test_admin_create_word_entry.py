"""Unit tests for POST /api/v1/admin/word-entries endpoint.

Tests cover:
- 201 success: create new word entry and link to deck
- 201 upsert: update existing word entry (is_new=False)
- 404 when deck not found
- 409 when deck is inactive or not V2
- 401 for unauthenticated requests
- 403 for non-superuser requests
- 422 for missing required fields
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Deck, DeckLevel, PartOfSpeech, WordEntry

URL = "/api/v1/admin/word-entries"


def _valid_body(deck_id) -> dict:
    """Return a valid request body for the endpoint."""
    return {
        "deck_id": str(deck_id),
        "word_entry": {
            "lemma": "σπίτι",
            "part_of_speech": "noun",
            "translation_en": "house",
            "translation_ru": "дом",
            "grammar_data": {
                "gender": "neuter",
                "nominative_singular": "σπίτι",
                "nominative_plural": "σπίτια",
            },
        },
    }


def _patch_card_service(created_per_type: int = 2):
    """Context manager that patches CardGeneratorService with async mocks."""
    return patch(
        "src.api.v1.admin.CardGeneratorService",
        side_effect=lambda db: _make_mock_card_service(created_per_type),
    )


def _make_mock_card_service(created_per_type: int = 2):
    mock_svc = AsyncMock()
    mock_svc.generate_meaning_cards = AsyncMock(return_value=(created_per_type, 0))
    mock_svc.generate_plural_form_cards = AsyncMock(return_value=(created_per_type, 0))
    mock_svc.generate_sentence_translation_cards = AsyncMock(return_value=(created_per_type, 0))
    mock_svc.generate_article_cards = AsyncMock(return_value=(created_per_type, 0))
    mock_svc.generate_declension_cards = AsyncMock(return_value=(created_per_type, 0))
    return mock_svc


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
async def v2_deck(db_session: AsyncSession) -> Deck:
    """Create an active V2 deck for tests."""
    deck = Deck(
        id=uuid4(),
        name_en="Create Word Entry Test Deck",
        name_el="Τεστ δημιουργία λέξης",
        name_ru="Тест создания слова",
        description_en="Test deck for create word entry tests",
        level=DeckLevel.A1,
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    return deck


@pytest.fixture
async def inactive_v2_deck(db_session: AsyncSession) -> Deck:
    """Create an inactive deck."""
    deck = Deck(
        id=uuid4(),
        name_en="Inactive V2 Deck",
        name_el="Ανενεργό V2",
        name_ru="Неактивная V2 колода",
        description_en="Inactive deck",
        level=DeckLevel.A1,
        is_active=False,
    )
    db_session.add(deck)
    await db_session.flush()
    return deck


# =============================================================================
# Tests
# =============================================================================


@pytest.mark.unit
class TestCreateAndLinkWordEntry:
    @pytest.mark.asyncio
    async def test_create_word_entry_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ) -> None:
        """Creating a new word entry returns 201 with is_new=True."""
        with _patch_card_service(created_per_type=2):
            response = await client.post(
                URL,
                json=_valid_body(v2_deck.id),
                headers=superuser_auth_headers,
            )

        assert response.status_code == 201
        data = response.json()
        assert data["is_new"] is True
        assert data["cards_created"] == 10  # 5 types × 2 each
        assert data["word_entry"]["lemma"] == "σπίτι"
        assert data["word_entry"]["deck_id"] == str(v2_deck.id)

    @pytest.mark.asyncio
    async def test_create_word_entry_upsert_existing(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        v2_deck: Deck,
    ) -> None:
        """Upserting an existing word entry (same lemma+POS) returns is_new=False."""
        # Pre-create the word entry so the upsert finds it
        existing = WordEntry(
            id=uuid4(),
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="house",
            owner_id=None,
            is_active=True,
            examples=[],
        )
        db_session.add(existing)
        await db_session.commit()

        with _patch_card_service():
            response = await client.post(
                URL,
                json=_valid_body(v2_deck.id),
                headers=superuser_auth_headers,
            )

        assert response.status_code == 201
        data = response.json()
        assert data["is_new"] is False
        assert data["word_entry"]["lemma"] == "σπίτι"

    @pytest.mark.asyncio
    async def test_create_word_entry_deck_not_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ) -> None:
        """Returns 404 when deck_id does not exist."""
        body = _valid_body(uuid4())
        response = await client.post(URL, json=body, headers=superuser_auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_create_word_entry_inactive_deck(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        inactive_v2_deck: Deck,
    ) -> None:
        """Returns 409 when deck is inactive."""
        response = await client.post(
            URL,
            json=_valid_body(inactive_v2_deck.id),
            headers=superuser_auth_headers,
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_create_word_entry_unauthenticated(
        self,
        client: AsyncClient,
        v2_deck: Deck,
    ) -> None:
        """Returns 401 when no auth token provided."""
        response = await client.post(URL, json=_valid_body(v2_deck.id))
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_word_entry_non_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict,
        v2_deck: Deck,
    ) -> None:
        """Returns 403 for regular (non-superuser) users."""
        response = await client.post(
            URL,
            json=_valid_body(v2_deck.id),
            headers=auth_headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_create_word_entry_validation_error(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ) -> None:
        """Returns 422 when required fields are missing."""
        # Missing 'lemma' and 'translation_en' in word_entry
        body = {
            "deck_id": str(v2_deck.id),
            "word_entry": {
                "part_of_speech": "noun",
            },
        }
        response = await client.post(URL, json=body, headers=superuser_auth_headers)
        assert response.status_code == 422
