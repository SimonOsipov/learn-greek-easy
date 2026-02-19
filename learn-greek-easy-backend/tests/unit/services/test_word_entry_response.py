"""Unit tests for word_entry_to_response helper function."""

from datetime import datetime
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from src.db.models import AudioStatus
from src.schemas.word_entry import WordEntryResponse
from src.services.s3_service import S3Service
from src.services.word_entry_response import word_entry_to_response


@pytest.fixture
def mock_s3_service():
    """Mock S3 service that returns presigned URLs for non-empty keys."""
    mock = MagicMock(spec=S3Service)
    mock.generate_presigned_url.side_effect = lambda key: (
        f"https://s3.example.com/presigned/{key}" if key else None
    )
    return mock


@pytest.fixture
def sample_entry():
    """Mock WordEntry ORM instance with audio and examples."""
    entry = MagicMock()
    entry.id = uuid4()
    entry.deck_id = uuid4()
    entry.lemma = "σπίτι"
    entry.part_of_speech = "noun"
    entry.translation_en = "house"
    entry.translation_en_plural = None
    entry.translation_ru = "дом"
    entry.translation_ru_plural = None
    entry.pronunciation = "spíti"
    entry.grammar_data = None
    entry.audio_key = "word-audio/spiti.mp3"
    entry.audio_url = None  # Pydantic reads this during model_validate; service overwrites it
    entry.audio_status = AudioStatus.READY
    entry.audio_generating_since = None
    entry.examples = [
        {
            "id": "ex_1",
            "greek": "Το σπίτι μου",
            "english": "My house",
            "russian": "Мой дом",
            "context": None,
            "audio_key": "word-audio/uuid/ex_1.mp3",
        }
    ]
    entry.is_active = True
    now = datetime.now()
    entry.created_at = now
    entry.updated_at = now
    return entry


class TestWordEntryToResponse:
    def test_word_entry_to_response_with_audio_key(self, sample_entry, mock_s3_service):
        """audio_url is populated from audio_key when present."""
        result = word_entry_to_response(sample_entry, s3_service=mock_s3_service)

        assert isinstance(result, WordEntryResponse)
        assert result.audio_url == "https://s3.example.com/presigned/word-audio/spiti.mp3"
        mock_s3_service.generate_presigned_url.assert_any_call("word-audio/spiti.mp3")

    def test_word_entry_to_response_without_audio_key(self, sample_entry, mock_s3_service):
        """audio_url is None when audio_key is None."""
        sample_entry.audio_key = None

        result = word_entry_to_response(sample_entry, s3_service=mock_s3_service)

        assert result.audio_url is None

    def test_word_entry_to_response_with_empty_audio_key(self, sample_entry, mock_s3_service):
        """audio_url is None when audio_key is empty string."""
        sample_entry.audio_key = ""

        result = word_entry_to_response(sample_entry, s3_service=mock_s3_service)

        assert result.audio_url is None

    def test_example_audio_url_populated(self, sample_entry, mock_s3_service):
        """Example audio_url populated from example audio_key."""
        result = word_entry_to_response(sample_entry, s3_service=mock_s3_service)

        assert len(result.examples) == 1
        assert (
            result.examples[0].audio_url
            == "https://s3.example.com/presigned/word-audio/uuid/ex_1.mp3"
        )

    def test_example_audio_url_null_when_no_key(self, sample_entry, mock_s3_service):
        """Example audio_url is None when example audio_key is None."""
        sample_entry.examples = [
            {
                "id": "ex_1",
                "greek": "Το σπίτι μου",
                "english": "",
                "russian": "",
                "context": None,
                "audio_key": None,
            }
        ]

        result = word_entry_to_response(sample_entry, s3_service=mock_s3_service)

        assert result.examples[0].audio_url is None

    def test_mixed_examples_audio_urls(self, sample_entry, mock_s3_service):
        """First example has presigned URL, second has None."""
        sample_entry.examples = [
            {
                "id": "ex_1",
                "greek": "With key",
                "english": "",
                "russian": "",
                "context": None,
                "audio_key": "word-audio/uuid/ex_1.mp3",
            },
            {
                "id": "ex_2",
                "greek": "Without key",
                "english": "",
                "russian": "",
                "context": None,
                "audio_key": None,
            },
        ]

        result = word_entry_to_response(sample_entry, s3_service=mock_s3_service)

        assert (
            result.examples[0].audio_url
            == "https://s3.example.com/presigned/word-audio/uuid/ex_1.mp3"
        )
        assert result.examples[1].audio_url is None

    def test_s3_service_unavailable_returns_null(self, sample_entry):
        """When S3 unavailable (returns None for all keys), audio_url fields are null."""
        mock_s3 = MagicMock(spec=S3Service)
        mock_s3.generate_presigned_url.return_value = None

        result = word_entry_to_response(sample_entry, s3_service=mock_s3)

        assert result.audio_url is None
        for ex in result.examples:
            assert ex.audio_url is None

    def test_all_other_response_fields_preserved(self, sample_entry, mock_s3_service):
        """Non-audio fields pass through correctly."""
        result = word_entry_to_response(sample_entry, s3_service=mock_s3_service)

        assert result.id == sample_entry.id
        assert result.deck_id == sample_entry.deck_id
        assert result.lemma == "σπίτι"
        assert result.translation_en == "house"
        assert result.translation_ru == "дом"
        assert result.pronunciation == "spíti"
        assert result.is_active is True
        assert len(result.examples) == 1
        assert result.examples[0].greek == "Το σπίτι μου"
