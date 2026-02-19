"""Unit tests for SM2Service._enrich_cards_with_audio() study queue audio enrichment."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardStatus, PartOfSpeech
from src.schemas.card import Example
from src.schemas.sm2 import StudyQueueCard
from src.services.sm2_service import SM2Service


def make_study_queue_card(
    card_id=None,
    front_text="σπίτι",
    part_of_speech=PartOfSpeech.NOUN,
    examples=None,
):
    """Create a StudyQueueCard for testing."""
    return StudyQueueCard(
        card_id=card_id or uuid4(),
        front_text=front_text,
        back_text="house",
        part_of_speech=part_of_speech,
        examples=examples or [],
        status=CardStatus.NEW,
        is_new=True,
        is_early_practice=False,
    )


def make_word_entry(deck_id, lemma, part_of_speech, audio_key=None, examples=None):
    """Create a mock WordEntry ORM object."""
    we = MagicMock()
    we.id = uuid4()
    we.deck_id = deck_id
    we.lemma = lemma
    we.part_of_speech = part_of_speech
    we.audio_key = audio_key
    we.examples = examples or []
    return we


def make_sm2_service(db_session):
    """Create SM2Service with a mock db session."""
    service = MagicMock(spec=SM2Service)
    service.db = db_session
    service._enrich_cards_with_audio = SM2Service._enrich_cards_with_audio.__get__(
        service, SM2Service
    )
    return service


class TestEnrichCardsWithAudio:
    async def test_enrich_empty_cards_list(self):
        """Empty input returns empty dict, no DB queries."""
        mock_db = AsyncMock(spec=AsyncSession)
        service = make_sm2_service(mock_db)

        result = await service._enrich_cards_with_audio([])

        assert result == {}
        mock_db.execute.assert_not_called()

    async def test_enrich_cards_with_matching_word_entries(self):
        """Cards whose (deck_id, lemma, pos) match a WordEntry get audio_url populated."""
        card_id = uuid4()
        deck_id = uuid4()
        card = make_study_queue_card(card_id=card_id, front_text="σπίτι")
        word_entry = make_word_entry(
            deck_id=deck_id,
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            audio_key="word-audio/spiti.mp3",
        )

        mock_db = AsyncMock(spec=AsyncSession)

        # First query: Card -> deck_id mapping
        card_result = MagicMock()
        card_result.all.return_value = [(card_id, deck_id)]

        # Second query: WordEntry records
        we_result = MagicMock()
        we_result.scalars.return_value.all.return_value = [word_entry]

        mock_db.execute = AsyncMock(side_effect=[card_result, we_result])
        service = make_sm2_service(mock_db)

        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.side_effect = lambda key: (
            f"https://s3.example.com/{key}" if key else None
        )

        with patch("src.services.sm2_service.get_s3_service", return_value=mock_s3):
            result = await service._enrich_cards_with_audio([card])

        assert card_id in result
        assert result[card_id]["audio_url"] == "https://s3.example.com/word-audio/spiti.mp3"
        assert result[card_id]["word_entry_id"] == word_entry.id

    async def test_enrich_cards_without_word_entries(self):
        """V1 cards with no matching WordEntry keep audio_url=None."""
        card_id = uuid4()
        deck_id = uuid4()
        card = make_study_queue_card(card_id=card_id, front_text="σπίτι")

        mock_db = AsyncMock(spec=AsyncSession)

        card_result = MagicMock()
        card_result.all.return_value = [(card_id, deck_id)]
        we_result = MagicMock()
        we_result.scalars.return_value.all.return_value = []  # no matches

        mock_db.execute = AsyncMock(side_effect=[card_result, we_result])
        service = make_sm2_service(mock_db)

        mock_s3 = MagicMock()

        with patch("src.services.sm2_service.get_s3_service", return_value=mock_s3):
            result = await service._enrich_cards_with_audio([card])

        assert card_id not in result

    async def test_enrich_examples_get_id_from_word_entry(self):
        """Card examples matching WordEntry examples by Greek text get id populated."""
        card_id = uuid4()
        deck_id = uuid4()
        card = make_study_queue_card(
            card_id=card_id,
            front_text="σπίτι",
            examples=[Example(greek="Το σπίτι μου", english="My house", russian="")],
        )
        word_entry = make_word_entry(
            deck_id=deck_id,
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            audio_key="word-audio/spiti.mp3",
            examples=[
                {
                    "id": "ex_spiti1",
                    "greek": "Το σπίτι μου",
                    "english": "My house",
                    "audio_key": "word-audio/uuid/ex_spiti1.mp3",
                }
            ],
        )

        mock_db = AsyncMock(spec=AsyncSession)
        card_result = MagicMock()
        card_result.all.return_value = [(card_id, deck_id)]
        we_result = MagicMock()
        we_result.scalars.return_value.all.return_value = [word_entry]
        mock_db.execute = AsyncMock(side_effect=[card_result, we_result])
        service = make_sm2_service(mock_db)

        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.side_effect = lambda key: (
            f"https://s3.example.com/{key}" if key else None
        )

        with patch("src.services.sm2_service.get_s3_service", return_value=mock_s3):
            result = await service._enrich_cards_with_audio([card])

        examples_audio = result[card_id]["examples_audio"]
        assert "Το σπίτι μου" in examples_audio
        assert examples_audio["Το σπίτι μου"]["id"] == "ex_spiti1"
        assert (
            examples_audio["Το σπίτι μου"]["audio_url"]
            == "https://s3.example.com/word-audio/uuid/ex_spiti1.mp3"
        )

    async def test_enrich_graceful_degradation_no_s3(self):
        """When S3 returns None for all keys, audio_url fields are None but no exceptions."""
        card_id = uuid4()
        deck_id = uuid4()
        card = make_study_queue_card(card_id=card_id)
        word_entry = make_word_entry(
            deck_id=deck_id,
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            audio_key="word-audio/spiti.mp3",
        )

        mock_db = AsyncMock(spec=AsyncSession)
        card_result = MagicMock()
        card_result.all.return_value = [(card_id, deck_id)]
        we_result = MagicMock()
        we_result.scalars.return_value.all.return_value = [word_entry]
        mock_db.execute = AsyncMock(side_effect=[card_result, we_result])
        service = make_sm2_service(mock_db)

        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = None  # S3 unavailable

        with patch("src.services.sm2_service.get_s3_service", return_value=mock_s3):
            result = await service._enrich_cards_with_audio([card])

        assert card_id in result
        assert result[card_id]["audio_url"] is None

    async def test_enrich_cards_without_part_of_speech(self):
        """Cards with part_of_speech=None are skipped gracefully."""
        card_id = uuid4()
        card = make_study_queue_card(card_id=card_id, part_of_speech=None)

        mock_db = AsyncMock(spec=AsyncSession)
        card_result = MagicMock()
        card_result.all.return_value = [(card_id, uuid4())]
        mock_db.execute = AsyncMock(return_value=card_result)
        service = make_sm2_service(mock_db)

        mock_s3 = MagicMock()
        with patch("src.services.sm2_service.get_s3_service", return_value=mock_s3):
            result = await service._enrich_cards_with_audio([card])

        assert card_id not in result

    async def test_enrich_mixed_batch(self):
        """Mix of cards with and without WordEntry matches; correct assignment."""
        card1_id = uuid4()
        card2_id = uuid4()
        deck_id = uuid4()

        card1 = make_study_queue_card(card_id=card1_id, front_text="σπίτι")
        card2 = make_study_queue_card(card_id=card2_id, front_text="γάτα")

        word_entry = make_word_entry(
            deck_id=deck_id,
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            audio_key="word-audio/spiti.mp3",
        )

        mock_db = AsyncMock(spec=AsyncSession)
        card_result = MagicMock()
        card_result.all.return_value = [(card1_id, deck_id), (card2_id, deck_id)]
        we_result = MagicMock()
        we_result.scalars.return_value.all.return_value = [word_entry]  # only σπίτι matches
        mock_db.execute = AsyncMock(side_effect=[card_result, we_result])
        service = make_sm2_service(mock_db)

        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.side_effect = lambda key: (
            f"https://s3.example.com/{key}" if key else None
        )

        with patch("src.services.sm2_service.get_s3_service", return_value=mock_s3):
            result = await service._enrich_cards_with_audio([card1, card2])

        assert card1_id in result
        assert card2_id not in result

    async def test_enrich_presigned_url_generation(self):
        """Verify generate_presigned_url is called with the correct audio_key."""
        card_id = uuid4()
        deck_id = uuid4()
        card = make_study_queue_card(card_id=card_id)
        word_entry = make_word_entry(
            deck_id=deck_id,
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            audio_key="word-audio/specific-key.mp3",
        )

        mock_db = AsyncMock(spec=AsyncSession)
        card_result = MagicMock()
        card_result.all.return_value = [(card_id, deck_id)]
        we_result = MagicMock()
        we_result.scalars.return_value.all.return_value = [word_entry]
        mock_db.execute = AsyncMock(side_effect=[card_result, we_result])
        service = make_sm2_service(mock_db)

        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = "https://presigned.url"

        with patch("src.services.sm2_service.get_s3_service", return_value=mock_s3):
            await service._enrich_cards_with_audio([card])

        mock_s3.generate_presigned_url.assert_called_with("word-audio/specific-key.mp3")
