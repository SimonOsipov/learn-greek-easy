"""Unit tests for word entry link/unlink admin endpoints.

Tests cover:
- POST /api/v1/admin/decks/{deck_id}/word-entries/{word_entry_id}/link
- DELETE /api/v1/admin/decks/{deck_id}/word-entries/{word_entry_id}/link
- 201 success for link
- 204 success for unlink
- 404 for deck/word entry not found
- 404 for word entry inactive
- 409 for already linked
- 401 for unauthenticated requests
- 403 for non-superuser requests
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Deck, DeckLevel, DeckWordEntry, PartOfSpeech, WordEntry

LINK_URL = "/api/v1/admin/decks/{deck_id}/word-entries/{word_entry_id}/link"


def _url(deck_id, word_entry_id) -> str:
    return LINK_URL.format(deck_id=deck_id, word_entry_id=word_entry_id)


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
async def test_deck(db_session: AsyncSession) -> Deck:
    """Create a V2 test deck."""
    deck = Deck(
        id=uuid4(),
        name_en="Link Unlink Test Deck",
        name_el="Τεστ σύνδεση",
        name_ru="Тест связи",
        description_en="Test deck for link/unlink tests",
        level=DeckLevel.A1,
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    return deck


@pytest.fixture
async def test_word_entry(db_session: AsyncSession) -> WordEntry:
    """Create an active shared word entry (not linked to any deck yet)."""
    entry = WordEntry(
        id=uuid4(),
        lemma="σπίτι",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="house",
        translation_ru="дом",
        is_active=True,
        grammar_data={
            "gender": "neuter",
            "cases": {
                "singular": {"nominative": "σπίτι"},
                "plural": {"nominative": "σπίτια"},
            },
        },
        examples=[],
    )
    db_session.add(entry)
    await db_session.flush()
    return entry


@pytest.fixture
async def linked_word_entry(
    db_session: AsyncSession, test_deck: Deck, test_word_entry: WordEntry
) -> WordEntry:
    """Create a word entry already linked to test_deck."""
    junction = DeckWordEntry(deck_id=test_deck.id, word_entry_id=test_word_entry.id)
    db_session.add(junction)
    await db_session.flush()
    return test_word_entry


# =============================================================================
# Tests: POST (link)
# =============================================================================


@pytest.mark.unit
class TestLinkWordEntry:
    @pytest.mark.asyncio
    async def test_link_success_201(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        test_deck: Deck,
        test_word_entry: WordEntry,
    ) -> None:
        """Linking a valid word entry to a deck returns 201."""
        with patch("src.api.v1.admin.CardGeneratorService") as mock_card_svc_cls:
            mock_card_svc = AsyncMock()
            mock_card_svc.generate_meaning_cards = AsyncMock(return_value=(0, 0))
            mock_card_svc.generate_plural_form_cards = AsyncMock(return_value=(0, 0))
            mock_card_svc.generate_sentence_translation_cards = AsyncMock(return_value=(0, 0))
            mock_card_svc.generate_article_cards = AsyncMock(return_value=(0, 0))
            mock_card_svc_cls.return_value = mock_card_svc

            response = await client.post(
                _url(test_deck.id, test_word_entry.id),
                headers=superuser_auth_headers,
            )
        assert response.status_code == 201
        data = response.json()
        assert data["id"] == str(test_word_entry.id)
        assert data["lemma"] == "σπίτι"
        assert data["deck_id"] == str(test_deck.id)

    @pytest.mark.asyncio
    async def test_link_deck_not_found_404(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        test_word_entry: WordEntry,
    ) -> None:
        """Linking to a non-existent deck returns 404."""
        response = await client.post(
            _url(uuid4(), test_word_entry.id),
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_link_word_entry_not_found_404(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        test_deck: Deck,
    ) -> None:
        """Linking a non-existent word entry returns 404."""
        response = await client.post(
            _url(test_deck.id, uuid4()),
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_link_word_entry_inactive_404(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
        test_deck: Deck,
    ) -> None:
        """Linking an inactive word entry returns 404."""
        inactive_entry = WordEntry(
            id=uuid4(),
            lemma="αδρανής",
            part_of_speech=PartOfSpeech.ADJECTIVE,
            translation_en="inactive",
            translation_ru="неактивный",
            is_active=False,
            examples=[],
        )
        db_session.add(inactive_entry)
        await db_session.flush()

        response = await client.post(
            _url(test_deck.id, inactive_entry.id),
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_link_already_linked_409(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        test_deck: Deck,
        linked_word_entry: WordEntry,
    ) -> None:
        """Linking an already-linked word entry returns 409."""
        response = await client.post(
            _url(test_deck.id, linked_word_entry.id),
            headers=superuser_auth_headers,
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_link_unauthenticated_401(
        self,
        client: AsyncClient,
        test_deck: Deck,
        test_word_entry: WordEntry,
    ) -> None:
        """Unauthenticated request returns 401."""
        response = await client.post(_url(test_deck.id, test_word_entry.id))
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_link_non_superuser_403(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_deck: Deck,
        test_word_entry: WordEntry,
    ) -> None:
        """Regular user (non-superuser) request returns 403."""
        response = await client.post(
            _url(test_deck.id, test_word_entry.id),
            headers=auth_headers,
        )
        assert response.status_code == 403


# =============================================================================
# Tests: DELETE (unlink)
# =============================================================================


@pytest.mark.unit
class TestUnlinkWordEntry:
    @pytest.mark.asyncio
    async def test_unlink_success_204(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        test_deck: Deck,
        linked_word_entry: WordEntry,
    ) -> None:
        """Unlinking a linked word entry returns 204 with no body."""
        response = await client.delete(
            _url(test_deck.id, linked_word_entry.id),
            headers=superuser_auth_headers,
        )
        assert response.status_code == 204
        assert response.content == b""

    @pytest.mark.asyncio
    async def test_unlink_not_linked_404(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        test_deck: Deck,
        test_word_entry: WordEntry,
    ) -> None:
        """Unlinking a word entry that is not linked to the deck returns 404."""
        response = await client.delete(
            _url(test_deck.id, test_word_entry.id),
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_unlink_unauthenticated_401(
        self,
        client: AsyncClient,
        test_deck: Deck,
        linked_word_entry: WordEntry,
    ) -> None:
        """Unauthenticated request returns 401."""
        response = await client.delete(_url(test_deck.id, linked_word_entry.id))
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_unlink_non_superuser_403(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_deck: Deck,
        linked_word_entry: WordEntry,
    ) -> None:
        """Regular user (non-superuser) request returns 403."""
        response = await client.delete(
            _url(test_deck.id, linked_word_entry.id),
            headers=auth_headers,
        )
        assert response.status_code == 403
