"""Tests for POST /api/v1/admin/word-entries/generate/stream SSE endpoint."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from src.core.dependencies import SSEAuthResult


def _parse_sse_text(text: str) -> list[dict]:
    events = []
    for block in text.split("\n\n"):
        block = block.strip()
        if not block or block.startswith(":") or block.startswith("retry:"):
            continue
        etype, data_str = None, None
        for line in block.split("\n"):
            if line.startswith("event:"):
                etype = line[6:].strip()
            elif line.startswith("data:"):
                data_str = line[5:].strip()
        if data_str:
            try:
                data = json.loads(data_str)
            except json.JSONDecodeError:
                data = data_str
            events.append({"event": etype, "data": data})
    return events


async def _collect_stream(response) -> list[dict]:
    content = b""
    async for chunk in response.body_iterator:
        content += chunk if isinstance(chunk, bytes) else chunk.encode()
    return _parse_sse_text(content.decode())


def _make_superuser_auth() -> SSEAuthResult:
    mock_user = MagicMock()
    mock_user.is_superuser = True
    mock_user.id = uuid4()
    return SSEAuthResult(user=mock_user)


class TestGenerateStreamAuth:
    """Auth-related tests for the generate stream endpoint."""

    @pytest.mark.asyncio
    async def test_unauthenticated_yields_error(self) -> None:
        from src.api.v1.admin import generate_word_entry_stream
        from src.schemas.admin import GenerateWordEntryRequest

        sse_auth = SSEAuthResult(error_code="auth_required", error_message="Auth required")
        request = GenerateWordEntryRequest(word="σπίτι", deck_id=uuid4())

        response = await generate_word_entry_stream(
            request=request,
            sse_auth=sse_auth,
        )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert len(error_events) >= 1
        assert error_events[0]["data"]["code"] == "auth_required"

    @pytest.mark.asyncio
    async def test_non_superuser_yields_forbidden(self) -> None:
        from src.api.v1.admin import generate_word_entry_stream
        from src.schemas.admin import GenerateWordEntryRequest

        mock_user = MagicMock()
        mock_user.is_superuser = False
        sse_auth = SSEAuthResult(user=mock_user)
        request = GenerateWordEntryRequest(word="σπίτι", deck_id=uuid4())

        response = await generate_word_entry_stream(
            request=request,
            sse_auth=sse_auth,
        )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert any(e["data"].get("code") == "forbidden" for e in error_events)


class TestGenerateStreamFromStage:
    """Tests for from_stage=generation shortcut."""

    @pytest.mark.asyncio
    async def test_from_stage_generation_requires_lemma(self) -> None:
        from src.api.v1.admin import generate_word_entry_stream
        from src.schemas.admin import GenerateWordEntryRequest

        sse_auth = _make_superuser_auth()
        # No lemma field set
        request = GenerateWordEntryRequest(word="σπίτι", deck_id=uuid4())

        response = await generate_word_entry_stream(
            request=request,
            sse_auth=sse_auth,
            from_stage="generation",
        )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert len(error_events) >= 1
        assert any("lemma" in str(e["data"]).lower() for e in error_events)

    @pytest.mark.asyncio
    async def test_invalid_from_stage_yields_error(self) -> None:
        from src.api.v1.admin import generate_word_entry_stream
        from src.schemas.admin import GenerateWordEntryRequest

        sse_auth = _make_superuser_auth()
        request = GenerateWordEntryRequest(word="σπίτι", deck_id=uuid4())

        response = await generate_word_entry_stream(
            request=request,
            sse_auth=sse_auth,
            from_stage="normalization",  # invalid value
        )
        events = await _collect_stream(response)
        error_events = [e for e in events if e.get("event") == "error"]
        assert len(error_events) >= 1

    @pytest.mark.asyncio
    async def test_schema_accepts_lemma_fields(self) -> None:
        from src.schemas.admin import GenerateWordEntryRequest

        req = GenerateWordEntryRequest(
            word="σπίτι",
            deck_id=uuid4(),
            lemma="σπίτι",
            gender="neuter",
            article="το",
        )
        assert req.lemma == "σπίτι"
        assert req.gender == "neuter"
        assert req.article == "το"


class TestGenerateStreamConnectedEvent:
    """Tests for the connected event."""

    @pytest.mark.asyncio
    async def test_authenticated_stream_starts_with_connected(self) -> None:
        from src.api.v1.admin import generate_word_entry_stream
        from src.schemas.admin import GenerateWordEntryRequest

        sse_auth = _make_superuser_auth()
        request = GenerateWordEntryRequest(word="σπίτι", deck_id=uuid4())

        # Mock all pipeline stages to return immediately
        with (patch("src.api.v1.admin._generate_word_entry_sse_pipeline") as mock_pipeline,):

            async def fake_pipeline(*args, **kwargs):
                yield 'event: connected\ndata: ""\n\n'
                yield 'event: pipeline_failed\ndata: {"error":"test","stage":"test"}\n\n'

            mock_pipeline.return_value = fake_pipeline()

            response = await generate_word_entry_stream(
                request=request,
                sse_auth=sse_auth,
            )

        events = await _collect_stream(response)
        connected = [e for e in events if e.get("event") == "connected"]
        assert len(connected) >= 1
