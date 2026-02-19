"""Unit tests for audio status resolution in word_entry_response helpers."""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from src.db.models import AudioStatus
from src.schemas.word_entry import WordEntryResponse
from src.services.s3_service import S3Service
from src.services.word_entry_response import (
    STALE_GENERATING_THRESHOLD,
    _resolve_audio_status,
    _resolve_example_audio_status,
    word_entry_to_response,
)


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
    """Mock WordEntry ORM instance with audio fields populated."""
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
    entry.audio_url = None
    entry.audio_status = AudioStatus.READY
    entry.audio_generating_since = None
    entry.examples = []
    entry.is_active = True
    now = datetime.now(timezone.utc)
    entry.created_at = now
    entry.updated_at = now
    return entry


# ============================================================================
# TestResolveAudioStatus
# ============================================================================


@pytest.mark.unit
class TestResolveAudioStatus:
    def test_missing_returns_missing(self):
        """MISSING status returns 'missing'."""
        result = _resolve_audio_status(AudioStatus.MISSING, generating_since=None)
        assert result == "missing"

    def test_ready_returns_ready(self):
        """READY status returns 'ready'."""
        result = _resolve_audio_status(AudioStatus.READY, generating_since=None)
        assert result == "ready"

    def test_failed_returns_failed(self):
        """FAILED status returns 'failed'."""
        result = _resolve_audio_status(AudioStatus.FAILED, generating_since=None)
        assert result == "failed"

    def test_generating_fresh_returns_generating(self):
        """GENERATING with recent timestamp returns 'generating'."""
        generating_since = datetime.now(timezone.utc) - timedelta(minutes=1)
        result = _resolve_audio_status(AudioStatus.GENERATING, generating_since=generating_since)
        assert result == "generating"

    def test_generating_stale_returns_failed(self):
        """GENERATING with timestamp older than threshold returns 'failed'."""
        generating_since = (
            datetime.now(timezone.utc) - STALE_GENERATING_THRESHOLD - timedelta(seconds=1)
        )
        result = _resolve_audio_status(AudioStatus.GENERATING, generating_since=generating_since)
        assert result == "failed"

    def test_generating_null_timestamp_returns_generating(self):
        """GENERATING with null timestamp returns 'generating' (no stale check)."""
        result = _resolve_audio_status(AudioStatus.GENERATING, generating_since=None)
        assert result == "generating"

    def test_generating_just_below_boundary_returns_generating(self):
        """GENERATING just below the stale threshold returns 'generating' (not yet stale)."""
        generating_since = (
            datetime.now(timezone.utc) - STALE_GENERATING_THRESHOLD + timedelta(seconds=10)
        )
        result = _resolve_audio_status(AudioStatus.GENERATING, generating_since=generating_since)
        assert result == "generating"


# ============================================================================
# TestResolveExampleAudioStatus
# ============================================================================


@pytest.mark.unit
class TestResolveExampleAudioStatus:
    def test_explicit_ready_status(self):
        """Explicit 'ready' status is returned as-is."""
        result = _resolve_example_audio_status(
            example_audio_status="ready",
            example_audio_key="some-key",
            generating_since=None,
        )
        assert result == "ready"

    def test_explicit_failed_status(self):
        """Explicit 'failed' status is returned as-is."""
        result = _resolve_example_audio_status(
            example_audio_status="failed",
            example_audio_key=None,
            generating_since=None,
        )
        assert result == "failed"

    def test_legacy_fallback_with_audio_key_returns_ready(self):
        """When status is None and audio_key is present, returns 'ready' (legacy fallback)."""
        result = _resolve_example_audio_status(
            example_audio_status=None,
            example_audio_key="word-audio/uuid/ex_1.mp3",
            generating_since=None,
        )
        assert result == "ready"

    def test_legacy_fallback_without_audio_key_returns_missing(self):
        """When status is None and audio_key is None, returns 'missing' (legacy fallback)."""
        result = _resolve_example_audio_status(
            example_audio_status=None,
            example_audio_key=None,
            generating_since=None,
        )
        assert result == "missing"

    def test_generating_fresh_returns_generating(self):
        """Explicit 'generating' with recent timestamp returns 'generating'."""
        generating_since = datetime.now(timezone.utc) - timedelta(minutes=2)
        result = _resolve_example_audio_status(
            example_audio_status="generating",
            example_audio_key=None,
            generating_since=generating_since,
        )
        assert result == "generating"

    def test_generating_stale_returns_failed(self):
        """Explicit 'generating' with stale timestamp returns 'failed'."""
        generating_since = (
            datetime.now(timezone.utc) - STALE_GENERATING_THRESHOLD - timedelta(seconds=1)
        )
        result = _resolve_example_audio_status(
            example_audio_status="generating",
            example_audio_key=None,
            generating_since=generating_since,
        )
        assert result == "failed"


# ============================================================================
# TestWordEntryToResponseAudioStatus
# ============================================================================


@pytest.mark.unit
class TestWordEntryToResponseAudioStatus:
    def test_ready_audio_status_in_response(self, sample_entry, mock_s3_service):
        """word_entry_to_response includes audio_status='ready' for READY entries."""
        sample_entry.audio_status = AudioStatus.READY
        result = word_entry_to_response(sample_entry, s3_service=mock_s3_service)
        assert isinstance(result, WordEntryResponse)
        assert result.audio_status == "ready"

    def test_missing_audio_status_in_response(self, sample_entry, mock_s3_service):
        """word_entry_to_response includes audio_status='missing' for MISSING entries."""
        sample_entry.audio_status = AudioStatus.MISSING
        result = word_entry_to_response(sample_entry, s3_service=mock_s3_service)
        assert result.audio_status == "missing"

    def test_example_audio_status_in_response(self, sample_entry, mock_s3_service):
        """word_entry_to_response populates audio_status on examples."""
        sample_entry.examples = [
            {
                "id": "ex_1",
                "greek": "Το σπίτι μου",
                "english": "My house",
                "russian": "",
                "context": None,
                "audio_key": "word-audio/uuid/ex_1.mp3",
                "audio_status": "ready",
            }
        ]
        result = word_entry_to_response(sample_entry, s3_service=mock_s3_service)
        assert len(result.examples) == 1
        assert result.examples[0].audio_status == "ready"
