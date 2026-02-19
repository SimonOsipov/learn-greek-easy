"""Integration tests for audio_url population in word entry API responses."""

from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Deck, DeckLevel, PartOfSpeech, WordEntry


class TestWordEntryAudioUrlEndpoints:
    """Verify audio_url is included in all three word-entry response endpoints."""

    @pytest.fixture
    async def deck_with_audio_entry(self, db_session: AsyncSession):
        """Create a deck and word entry with audio_key set."""
        deck = Deck(
            name_en="Audio Test Deck",
            name_el="Audio Test Deck",
            name_ru="Audio Test Deck",
            description_en="Test",
            level=DeckLevel.A1,
            is_active=True,
        )
        db_session.add(deck)
        await db_session.flush()

        entry = WordEntry(
            deck_id=deck.id,
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="house",
            audio_key="word-audio/test-uuid.mp3",
            examples=[
                {
                    "id": "ex_1",
                    "greek": "Το σπίτι μου",
                    "english": "My house",
                    "russian": "",
                    "context": None,
                    "audio_key": "word-audio/test-uuid/ex_1.mp3",
                }
            ],
            is_active=True,
        )
        db_session.add(entry)
        await db_session.flush()
        return deck, entry

    @pytest.fixture
    async def deck_with_no_audio_entry(self, db_session: AsyncSession):
        """Create a deck and word entry without audio_key."""
        deck = Deck(
            name_en="No Audio Deck",
            name_el="No Audio Deck",
            name_ru="No Audio Deck",
            description_en="Test",
            level=DeckLevel.A1,
            is_active=True,
        )
        db_session.add(deck)
        await db_session.flush()

        entry = WordEntry(
            deck_id=deck.id,
            lemma="γάτα",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="cat",
            audio_key=None,
            examples=[],
            is_active=True,
        )
        db_session.add(entry)
        await db_session.flush()
        return deck, entry

    async def test_get_word_entry_includes_audio_url(
        self,
        client: AsyncClient,
        auth_headers: dict,
        deck_with_audio_entry,
    ):
        """GET /api/v1/word-entries/{id} returns audio_url field."""
        deck, entry = deck_with_audio_entry
        presigned_url = "https://s3.example.com/presigned/word-audio/test-uuid.mp3"

        with patch("src.services.word_entry_response.get_s3_service") as mock_get_s3:
            mock_s3 = MagicMock()
            mock_s3.generate_presigned_url.side_effect = lambda key: (
                f"https://s3.example.com/presigned/{key}" if key else None
            )
            mock_get_s3.return_value = mock_s3

            response = await client.get(
                f"/api/v1/word-entries/{entry.id}",
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert "audio_url" in data
        assert data["audio_url"] == presigned_url

    async def test_get_word_entry_audio_url_null_when_no_key(
        self,
        client: AsyncClient,
        auth_headers: dict,
        deck_with_no_audio_entry,
    ):
        """GET /api/v1/word-entries/{id} returns audio_url: null when no audio_key."""
        deck, entry = deck_with_no_audio_entry

        with patch("src.services.word_entry_response.get_s3_service") as mock_get_s3:
            mock_s3 = MagicMock()
            mock_s3.generate_presigned_url.return_value = None
            mock_get_s3.return_value = mock_s3

            response = await client.get(
                f"/api/v1/word-entries/{entry.id}",
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["audio_url"] is None

    async def test_deck_word_entries_includes_audio_url(
        self,
        client: AsyncClient,
        auth_headers: dict,
        deck_with_audio_entry,
    ):
        """GET /api/v1/decks/{deck_id}/word-entries returns audio_url on each entry."""
        deck, entry = deck_with_audio_entry

        with patch("src.services.word_entry_response.get_s3_service") as mock_get_s3:
            mock_s3 = MagicMock()
            mock_s3.generate_presigned_url.side_effect = lambda key: (
                f"https://s3.example.com/presigned/{key}" if key else None
            )
            mock_get_s3.return_value = mock_s3

            response = await client.get(
                f"/api/v1/decks/{deck.id}/word-entries",
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert len(data["word_entries"]) == 1
        assert "audio_url" in data["word_entries"][0]
        assert data["word_entries"][0]["audio_url"] is not None
