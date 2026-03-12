"""Tests for DELETE /api/v1/admin/word-entries/{word_entry_id} endpoint."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Deck, DeckLevel, DeckWordEntry, PartOfSpeech, WordEntry


@pytest.fixture
async def test_deck(db_session: AsyncSession) -> Deck:
    """Create a test deck."""
    deck = Deck(
        id=uuid4(),
        name_en="Test Deck for Delete Tests",
        name_el="Τεστ Κολόδα",
        name_ru="Тестовая колода",
        description_en="Test deck for deletion tests",
        description_el="Τεστ",
        description_ru="Тест",
        level=DeckLevel.A1,
        is_active=True,
    )
    db_session.add(deck)
    await db_session.commit()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def test_word_entry(db_session: AsyncSession, test_deck: Deck) -> WordEntry:
    """Create a test word entry with audio keys."""
    entry = WordEntry(
        id=uuid4(),
        owner_id=None,
        lemma="σπίτι",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="house",
        translation_ru="дом",
        audio_key="audio/test-lemma.mp3",
        examples=[
            {
                "id": "ex1",
                "greek": "Το σπίτι είναι μεγάλο.",
                "english": "The house is big.",
                "audio_key": "audio/example-1.mp3",
            }
        ],
        is_active=True,
    )
    db_session.add(entry)
    await db_session.flush()
    db_session.add(DeckWordEntry(deck_id=test_deck.id, word_entry_id=entry.id))
    await db_session.commit()
    await db_session.refresh(entry)
    return entry


@pytest.fixture
async def test_word_entry_no_audio(db_session: AsyncSession, test_deck: Deck) -> WordEntry:
    """Create a test word entry with no audio."""
    entry = WordEntry(
        id=uuid4(),
        owner_id=None,
        lemma="γάτα",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="cat",
        translation_ru="кошка",
        audio_key=None,
        examples=[],
        is_active=True,
    )
    db_session.add(entry)
    await db_session.flush()
    db_session.add(DeckWordEntry(deck_id=test_deck.id, word_entry_id=entry.id))
    await db_session.commit()
    await db_session.refresh(entry)
    return entry


@pytest.mark.unit
class TestDeleteWordEntry:
    """Tests for DELETE /api/v1/admin/word-entries/{word_entry_id}."""

    @pytest.mark.asyncio
    async def test_delete_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        test_word_entry: WordEntry,
        db_session: AsyncSession,
    ) -> None:
        """204: deletes word entry successfully."""
        entry_id = test_word_entry.id
        with patch("src.api.v1.admin.get_s3_service") as mock_get_s3:
            mock_s3 = MagicMock()
            mock_s3.delete_object.return_value = True
            mock_get_s3.return_value = mock_s3

            response = await client.delete(
                f"/api/v1/admin/word-entries/{entry_id}",
                headers=superuser_auth_headers,
            )

        assert response.status_code == 204
        # Verify gone from DB
        db_session.expire_all()
        result = await db_session.get(WordEntry, entry_id)
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_cascades_deck_word_entries(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        test_word_entry: WordEntry,
        db_session: AsyncSession,
    ) -> None:
        """204: DeckWordEntry junction rows are removed via DB cascade."""
        entry_id = test_word_entry.id
        with patch("src.api.v1.admin.get_s3_service") as mock_get_s3:
            mock_get_s3.return_value = MagicMock()
            response = await client.delete(
                f"/api/v1/admin/word-entries/{entry_id}",
                headers=superuser_auth_headers,
            )

        assert response.status_code == 204
        db_session.expire_all()
        result = await db_session.execute(
            select(DeckWordEntry).where(DeckWordEntry.word_entry_id == entry_id)
        )
        assert result.scalar_one_or_none() is None

    @pytest.mark.asyncio
    async def test_delete_cleans_s3_audio(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        test_word_entry: WordEntry,
    ) -> None:
        """204: S3 delete_object called with lemma audio key."""
        with patch("src.api.v1.admin.get_s3_service") as mock_get_s3:
            mock_s3 = MagicMock()
            mock_s3.delete_object.return_value = True
            mock_get_s3.return_value = mock_s3

            response = await client.delete(
                f"/api/v1/admin/word-entries/{test_word_entry.id}",
                headers=superuser_auth_headers,
            )

        assert response.status_code == 204
        mock_s3.delete_object.assert_any_call("audio/test-lemma.mp3")

    @pytest.mark.asyncio
    async def test_delete_cleans_s3_example_audio(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        test_word_entry: WordEntry,
    ) -> None:
        """204: S3 delete_object called for example audio keys."""
        with patch("src.api.v1.admin.get_s3_service") as mock_get_s3:
            mock_s3 = MagicMock()
            mock_s3.delete_object.return_value = True
            mock_get_s3.return_value = mock_s3

            response = await client.delete(
                f"/api/v1/admin/word-entries/{test_word_entry.id}",
                headers=superuser_auth_headers,
            )

        assert response.status_code == 204
        mock_s3.delete_object.assert_any_call("audio/example-1.mp3")

    @pytest.mark.asyncio
    async def test_delete_no_audio_skips_s3(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        test_word_entry_no_audio: WordEntry,
    ) -> None:
        """204: S3 delete_object not called when no audio keys."""
        with patch("src.api.v1.admin.get_s3_service") as mock_get_s3:
            mock_s3 = MagicMock()
            mock_get_s3.return_value = mock_s3

            response = await client.delete(
                f"/api/v1/admin/word-entries/{test_word_entry_no_audio.id}",
                headers=superuser_auth_headers,
            )

        assert response.status_code == 204
        mock_s3.delete_object.assert_not_called()

    @pytest.mark.asyncio
    async def test_delete_s3_failure_does_not_block(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        test_word_entry: WordEntry,
        db_session: AsyncSession,
    ) -> None:
        """204: S3 failure doesn't prevent DB deletion."""
        entry_id = test_word_entry.id
        with patch("src.api.v1.admin.get_s3_service") as mock_get_s3:
            mock_s3 = MagicMock()
            mock_s3.delete_object.side_effect = Exception("S3 unavailable")
            mock_get_s3.return_value = mock_s3

            response = await client.delete(
                f"/api/v1/admin/word-entries/{entry_id}",
                headers=superuser_auth_headers,
            )

        assert response.status_code == 204
        db_session.expire_all()
        result = await db_session.get(WordEntry, entry_id)
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_not_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
    ) -> None:
        """404: returns not found for non-existent word entry ID."""
        response = await client.delete(
            f"/api/v1/admin/word-entries/{uuid4()}",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_requires_auth(
        self,
        client: AsyncClient,
        test_word_entry: WordEntry,
    ) -> None:
        """401: returns unauthorized without auth headers."""
        response = await client.delete(
            f"/api/v1/admin/word-entries/{test_word_entry.id}",
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_delete_requires_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        test_word_entry: WordEntry,
    ) -> None:
        """403: returns forbidden for non-superuser."""
        response = await client.delete(
            f"/api/v1/admin/word-entries/{test_word_entry.id}",
            headers=auth_headers,
        )
        assert response.status_code == 403
