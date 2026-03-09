"""Unit tests for _signal_audio_event fire-and-forget helper in background.py.

Tests cover:
- Payload construction (audio_url only when status=ready and s3_key provided)
- Correct event bus key format ("word_audio:<uuid>")
- Swallowed exceptions (never propagates errors to caller)
- No-op when loop is not running
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


class TestSignalAudioEvent:
    """Tests for _signal_audio_event helper."""

    def test_does_not_raise_when_event_bus_raises(self) -> None:
        """Exceptions from the event bus are swallowed silently."""
        from src.tasks.background import _signal_audio_event

        with patch("src.core.event_bus.audio_event_bus") as mock_bus:
            mock_bus.signal = AsyncMock(side_effect=RuntimeError("bus exploded"))
            # Must not raise
            _signal_audio_event(
                word_entry_id=uuid4(),
                part="lemma",
                status="ready",
                s3_key=None,
            )

    def test_does_not_raise_when_s3_raises(self) -> None:
        """Exceptions from S3 presigned URL generation are swallowed silently."""
        from src.tasks.background import _signal_audio_event

        with patch("src.services.s3_service.get_s3_service") as mock_get_s3:
            mock_get_s3.side_effect = RuntimeError("S3 unavailable")
            # Must not raise
            _signal_audio_event(
                word_entry_id=uuid4(),
                part="lemma",
                status="ready",
                s3_key="audio/test.mp3",
            )

    @pytest.mark.asyncio
    async def test_ready_status_with_key_generates_presigned_url(self) -> None:
        """When status=ready and s3_key is provided, presigned URL is included."""
        from src.tasks.background import _signal_audio_event

        word_entry_id = uuid4()
        captured_payload: dict | None = None

        async def capture_signal(key: str, payload: dict) -> None:
            nonlocal captured_payload
            captured_payload = payload

        with patch("src.services.s3_service.get_s3_service") as mock_get_s3:
            mock_s3 = MagicMock()
            mock_s3.generate_presigned_url.return_value = "https://s3.example.com/audio.mp3"
            mock_get_s3.return_value = mock_s3

            with patch("src.core.event_bus.audio_event_bus") as mock_bus:
                mock_bus.signal = AsyncMock(side_effect=capture_signal)

                _signal_audio_event(
                    word_entry_id=word_entry_id,
                    part="lemma",
                    status="ready",
                    s3_key="audio/test.mp3",
                )

                # Give the created task a chance to run
                await asyncio.sleep(0)

        assert captured_payload is not None
        assert captured_payload["audio_url"] == "https://s3.example.com/audio.mp3"

    @pytest.mark.asyncio
    async def test_non_ready_status_omits_presigned_url(self) -> None:
        """When status is not 'ready', audio_url is None regardless of s3_key."""
        from src.tasks.background import _signal_audio_event

        captured_payload: dict | None = None

        async def capture_signal(key: str, payload: dict) -> None:
            nonlocal captured_payload
            captured_payload = payload

        with patch("src.services.s3_service.get_s3_service") as mock_get_s3:
            mock_s3 = MagicMock()
            mock_get_s3.return_value = mock_s3

            with patch("src.core.event_bus.audio_event_bus") as mock_bus:
                mock_bus.signal = AsyncMock(side_effect=capture_signal)

                _signal_audio_event(
                    word_entry_id=uuid4(),
                    part="lemma",
                    status="generating",
                    s3_key="audio/test.mp3",
                )

                await asyncio.sleep(0)

        assert captured_payload is not None
        assert captured_payload["audio_url"] is None
        mock_s3.generate_presigned_url.assert_not_called()

    @pytest.mark.asyncio
    async def test_event_bus_key_uses_word_audio_prefix(self) -> None:
        """Event bus key must be 'word_audio:<word_entry_id>'."""
        from src.tasks.background import _signal_audio_event

        word_entry_id = uuid4()
        captured_key: str | None = None

        async def capture_signal(key: str, payload: dict) -> None:
            nonlocal captured_key
            captured_key = key

        with patch("src.services.s3_service.get_s3_service") as mock_get_s3:
            mock_get_s3.return_value = MagicMock()

            with patch("src.core.event_bus.audio_event_bus") as mock_bus:
                mock_bus.signal = AsyncMock(side_effect=capture_signal)

                _signal_audio_event(
                    word_entry_id=word_entry_id,
                    part="lemma",
                    status="generating",
                )

                await asyncio.sleep(0)

        assert captured_key == f"word_audio:{word_entry_id}"

    @pytest.mark.asyncio
    async def test_payload_includes_all_fields(self) -> None:
        """Payload contains word_entry_id, part, example_id, status, audio_url."""
        from src.tasks.background import _signal_audio_event

        word_entry_id = uuid4()
        ex_id = str(uuid4())
        captured_payload: dict | None = None

        async def capture_signal(key: str, payload: dict) -> None:
            nonlocal captured_payload
            captured_payload = payload

        with patch("src.services.s3_service.get_s3_service") as mock_get_s3:
            mock_get_s3.return_value = MagicMock()

            with patch("src.core.event_bus.audio_event_bus") as mock_bus:
                mock_bus.signal = AsyncMock(side_effect=capture_signal)

                _signal_audio_event(
                    word_entry_id=word_entry_id,
                    part="example",
                    status="failed",
                    example_id=ex_id,
                )

                await asyncio.sleep(0)

        assert captured_payload is not None
        assert captured_payload["word_entry_id"] == str(word_entry_id)
        assert captured_payload["part"] == "example"
        assert captured_payload["example_id"] == ex_id
        assert captured_payload["status"] == "failed"
        assert "audio_url" in captured_payload
