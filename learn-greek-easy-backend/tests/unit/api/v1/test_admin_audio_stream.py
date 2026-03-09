"""Unit tests for audio SSE stream helpers in admin.py.

Tests cover:
- _build_audio_status_event: event dict construction, presigned URL generation
- _collect_initial_audio_events: lemma-only, with examples, skipping examples without id
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import uuid4


class TestBuildAudioStatusEvent:
    """Tests for _build_audio_status_event helper."""

    def test_generating_status_returns_no_url(self) -> None:
        """Non-ready status produces no audio_url regardless of key."""
        from src.api.v1.admin import _build_audio_status_event

        result = _build_audio_status_event(
            word_entry_id=uuid4(),
            part="lemma",
            example_id=None,
            audio_status="generating",
            audio_key="audio/test.mp3",
        )

        assert result["status"] == "generating"
        assert result["audio_url"] is None

    def test_ready_status_with_key_generates_presigned_url(self) -> None:
        """Ready status with audio_key calls S3 and returns presigned URL."""
        from src.api.v1.admin import _build_audio_status_event

        with patch("src.api.v1.admin.get_s3_service") as mock_get_s3:
            mock_s3 = MagicMock()
            mock_s3.generate_presigned_url.return_value = "https://s3.example.com/audio.mp3"
            mock_get_s3.return_value = mock_s3

            result = _build_audio_status_event(
                word_entry_id=uuid4(),
                part="lemma",
                example_id=None,
                audio_status="ready",
                audio_key="audio/test.mp3",
            )

        assert result["audio_url"] == "https://s3.example.com/audio.mp3"
        mock_s3.generate_presigned_url.assert_called_once_with("audio/test.mp3")

    def test_ready_status_without_key_returns_no_url(self) -> None:
        """Ready status without audio_key still returns no URL (nothing to sign)."""
        from src.api.v1.admin import _build_audio_status_event

        with patch("src.api.v1.admin.get_s3_service") as mock_get_s3:
            mock_s3 = MagicMock()
            mock_get_s3.return_value = mock_s3

            result = _build_audio_status_event(
                word_entry_id=uuid4(),
                part="lemma",
                example_id=None,
                audio_status="ready",
                audio_key=None,
            )

        assert result["audio_url"] is None
        mock_s3.generate_presigned_url.assert_not_called()

    def test_example_event_preserves_example_id(self) -> None:
        """Example events carry the example_id through."""
        from src.api.v1.admin import _build_audio_status_event

        ex_id = str(uuid4())

        with patch("src.api.v1.admin.get_s3_service") as mock_get_s3:
            mock_get_s3.return_value = MagicMock()

            result = _build_audio_status_event(
                word_entry_id=uuid4(),
                part="example",
                example_id=ex_id,
                audio_status="failed",
                audio_key=None,
            )

        assert result["part"] == "example"
        assert result["example_id"] == ex_id
        assert result["status"] == "failed"
        assert result["audio_url"] is None

    def test_word_entry_id_is_stringified(self) -> None:
        """word_entry_id UUID is converted to string in the payload."""
        from src.api.v1.admin import _build_audio_status_event

        wid = uuid4()

        with patch("src.api.v1.admin.get_s3_service") as mock_get_s3:
            mock_get_s3.return_value = MagicMock()

            result = _build_audio_status_event(
                word_entry_id=wid,
                part="lemma",
                example_id=None,
                audio_status="missing",
                audio_key=None,
            )

        assert result["word_entry_id"] == str(wid)


class TestCollectInitialAudioEvents:
    """Tests for _collect_initial_audio_events helper."""

    def _make_word_entry(
        self,
        audio_status_value: str = "missing",
        audio_key: str | None = None,
        examples: list | None = None,
    ) -> MagicMock:
        word_entry = MagicMock()
        word_entry.id = uuid4()
        status_mock = MagicMock()
        status_mock.value = audio_status_value
        word_entry.audio_status = status_mock
        word_entry.audio_key = audio_key
        word_entry.examples = examples if examples is not None else []
        return word_entry

    def test_lemma_only_entry_produces_one_event(self) -> None:
        """Word entry with no examples produces exactly one lemma event."""
        from src.api.v1.admin import _collect_initial_audio_events

        word_entry = self._make_word_entry(audio_status_value="generating")

        with patch("src.api.v1.admin.get_s3_service") as mock_get_s3:
            mock_get_s3.return_value = MagicMock()
            events = _collect_initial_audio_events(word_entry)

        assert len(events) == 1
        assert events[0]["part"] == "lemma"
        assert events[0]["status"] == "generating"
        assert events[0]["example_id"] is None

    def test_examples_produce_additional_events(self) -> None:
        """Each example with an id produces an additional event."""
        from src.api.v1.admin import _collect_initial_audio_events

        ex_id = str(uuid4())
        word_entry = self._make_word_entry(
            audio_status_value="ready",
            audio_key="audio/test.mp3",
            examples=[{"id": ex_id, "audio_status": "generating", "audio_key": None}],
        )

        with patch("src.api.v1.admin.get_s3_service") as mock_get_s3:
            mock_s3 = MagicMock()
            mock_s3.generate_presigned_url.return_value = "https://s3.example.com/audio.mp3"
            mock_get_s3.return_value = mock_s3

            events = _collect_initial_audio_events(word_entry)

        assert len(events) == 2
        assert events[0]["part"] == "lemma"
        assert events[1]["part"] == "example"
        assert events[1]["example_id"] == ex_id
        assert events[1]["status"] == "generating"

    def test_examples_without_id_are_skipped(self) -> None:
        """Examples that have no 'id' key are silently skipped."""
        from src.api.v1.admin import _collect_initial_audio_events

        word_entry = self._make_word_entry(
            examples=[{"audio_status": "missing", "audio_key": None}],  # no id
        )

        with patch("src.api.v1.admin.get_s3_service") as mock_get_s3:
            mock_get_s3.return_value = MagicMock()
            events = _collect_initial_audio_events(word_entry)

        assert len(events) == 1  # only lemma
        assert events[0]["part"] == "lemma"

    def test_example_missing_audio_status_defaults_to_missing(self) -> None:
        """Examples without audio_status default to 'missing'."""
        from src.api.v1.admin import _collect_initial_audio_events

        ex_id = str(uuid4())
        word_entry = self._make_word_entry(
            examples=[{"id": ex_id}],  # no audio_status key
        )

        with patch("src.api.v1.admin.get_s3_service") as mock_get_s3:
            mock_get_s3.return_value = MagicMock()
            events = _collect_initial_audio_events(word_entry)

        assert len(events) == 2
        assert events[1]["status"] == "missing"

    def test_audio_status_without_value_attr_uses_str(self) -> None:
        """If audio_status has no .value attr (plain string), str() is used."""
        from src.api.v1.admin import _collect_initial_audio_events

        word_entry = MagicMock()
        word_entry.id = uuid4()
        word_entry.audio_status = "ready"  # plain string, no .value
        word_entry.audio_key = "audio/test.mp3"
        word_entry.examples = []

        with patch("src.api.v1.admin.get_s3_service") as mock_get_s3:
            mock_s3 = MagicMock()
            mock_s3.generate_presigned_url.return_value = "https://s3.example.com/audio.mp3"
            mock_get_s3.return_value = mock_s3

            events = _collect_initial_audio_events(word_entry)

        assert events[0]["status"] == "ready"

    def test_multiple_examples_all_included(self) -> None:
        """Multiple examples each produce their own event in order."""
        from src.api.v1.admin import _collect_initial_audio_events

        ex_ids = [str(uuid4()) for _ in range(3)]
        word_entry = self._make_word_entry(
            examples=[
                {"id": ex_ids[0], "audio_status": "ready", "audio_key": "k0"},
                {"id": ex_ids[1], "audio_status": "generating", "audio_key": None},
                {"id": ex_ids[2], "audio_status": "failed", "audio_key": None},
            ]
        )

        with patch("src.api.v1.admin.get_s3_service") as mock_get_s3:
            mock_s3 = MagicMock()
            mock_s3.generate_presigned_url.return_value = "https://s3.example.com/audio.mp3"
            mock_get_s3.return_value = mock_s3

            events = _collect_initial_audio_events(word_entry)

        assert len(events) == 4  # lemma + 3 examples
        assert [e["part"] for e in events] == ["lemma", "example", "example", "example"]
        assert [e["example_id"] for e in events[1:]] == ex_ids
