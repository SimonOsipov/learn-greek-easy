"""Unit tests for forced alignment feature (LDLG-25).

Covers:
- ElevenLabsService.forced_align HTTP method (TestForcedAlign)
- _apply_forced_alignment pure function (TestApplyForcedAlignment)
- Alignment + redistribution combined flow (TestAlignmentFlow)
"""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from src.api.v1.admin import _apply_forced_alignment, _redistribute_degenerate_timing
from src.core.exceptions import (
    ElevenLabsAPIError,
    ElevenLabsAuthenticationError,
    ElevenLabsNotConfiguredError,
    ElevenLabsRateLimitError,
)
from src.services.elevenlabs_service import ElevenLabsService

# ---------------------------------------------------------------------------
# Shared test data
# ---------------------------------------------------------------------------

SAMPLE_FA_RESPONSE = {
    "words": [
        {"text": "Γεια", "start": 0.0, "end": 0.35},
        {"text": "σας", "start": 0.35, "end": 0.7},
        {"text": "Πώς", "start": 0.7, "end": 1.0},
        {"text": "είστε", "start": 1.0, "end": 1.5},
    ],
    "loss": 0.042,
}

SAMPLE_SORTED_LINES = [
    {"id": "aaa", "text": "Γεια σας", "line_index": 0},
    {"id": "bbb", "text": "Πώς είστε", "line_index": 1},
    {"id": "ccc", "text": "Καλά ευχαριστώ", "line_index": 2},
]

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_settings_configured():
    """Settings with ElevenLabs configured."""
    with patch("src.services.elevenlabs_service.settings") as mock:
        mock.elevenlabs_api_key = "test-api-key-12345"
        mock.elevenlabs_configured = True
        mock.elevenlabs_model_id = "eleven_multilingual_v2"
        mock.elevenlabs_dialog_model_id = "eleven_v3"
        mock.elevenlabs_output_format = "mp3_44100_128"
        mock.elevenlabs_timeout = 30
        yield mock


@pytest.fixture()
def mock_settings_not_configured():
    with patch("src.services.elevenlabs_service.settings") as mock:
        mock.elevenlabs_api_key = ""
        mock.elevenlabs_configured = False
        yield mock


def _make_mock_client(status_code, json_data=None, text="", side_effect=None):
    mock_response = MagicMock()
    mock_response.status_code = status_code
    mock_response.json.return_value = json_data or {}
    mock_response.text = text
    mock_client = AsyncMock()
    if side_effect:
        mock_client.post.side_effect = side_effect
    else:
        mock_client.post.return_value = mock_response
    return mock_client, mock_response


# ---------------------------------------------------------------------------
# TestForcedAlign — ElevenLabsService.forced_align HTTP method
# ---------------------------------------------------------------------------


class TestForcedAlign:
    @pytest.mark.asyncio
    async def test_success_returns_parsed_json(self, mock_settings_configured):
        """200 response: returns parsed JSON dict unchanged."""
        mock_client, _ = _make_mock_client(200, json_data=SAMPLE_FA_RESPONSE)
        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            service = ElevenLabsService()
            result = await service.forced_align(b"audio_bytes", "Γεια σας\nΠώς είστε")
        assert result == SAMPLE_FA_RESPONSE

    @pytest.mark.asyncio
    async def test_401_raises_authentication_error(self, mock_settings_configured):
        """401 response raises ElevenLabsAuthenticationError."""
        mock_client, _ = _make_mock_client(401, text="Unauthorized")
        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            service = ElevenLabsService()
            with pytest.raises(ElevenLabsAuthenticationError) as exc_info:
                await service.forced_align(b"audio", "text")
        assert "forced_alignment" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_429_raises_rate_limit_error(self, mock_settings_configured):
        """429 response raises ElevenLabsRateLimitError."""
        mock_client, _ = _make_mock_client(429)
        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            service = ElevenLabsService()
            with pytest.raises(ElevenLabsRateLimitError):
                await service.forced_align(b"audio", "text")

    @pytest.mark.asyncio
    async def test_500_raises_api_error_with_status_code(self, mock_settings_configured):
        """500 response raises ElevenLabsAPIError with status_code=500."""
        mock_client, _ = _make_mock_client(500, text="Server error")
        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            service = ElevenLabsService()
            with pytest.raises(ElevenLabsAPIError) as exc_info:
                await service.forced_align(b"audio", "text")
        assert exc_info.value.status_code == 500

    @pytest.mark.asyncio
    async def test_network_error_raises_api_error_with_status_0(self, mock_settings_configured):
        """httpx.RequestError raises ElevenLabsAPIError with status_code=0."""
        mock_client, _ = _make_mock_client(0, side_effect=httpx.RequestError("Connection failed"))
        with patch("src.services.elevenlabs_service.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            service = ElevenLabsService()
            with pytest.raises(ElevenLabsAPIError) as exc_info:
                await service.forced_align(b"audio", "text")
        assert exc_info.value.status_code == 0
        assert "Network error" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_not_configured_raises_not_configured_error(self, mock_settings_not_configured):
        """Unconfigured service raises ElevenLabsNotConfiguredError."""
        service = ElevenLabsService()
        with pytest.raises(ElevenLabsNotConfiguredError):
            await service.forced_align(b"audio", "text")


# ---------------------------------------------------------------------------
# TestApplyForcedAlignment — _apply_forced_alignment pure function
# ---------------------------------------------------------------------------


class TestApplyForcedAlignment:
    def test_no_degenerate_lines_returns_inputs_unchanged(self):
        """If no degenerate lines, returns original maps unchanged."""
        timing_map = {0: (0, 500), 1: (700, 1500)}
        word_timestamps_map = {0: None, 1: None}
        result_timing, result_words = _apply_forced_alignment(
            SAMPLE_FA_RESPONSE, timing_map, SAMPLE_SORTED_LINES[:2], word_timestamps_map
        )
        assert result_timing is timing_map
        assert result_words is word_timestamps_map

    def test_all_degenerate_lines_updated_with_word_timing(self):
        """All degenerate lines get word-level timestamps when FA has words for them."""
        timing_map = {0: (0, 0), 1: (0, 0)}
        word_timestamps_map = {0: None, 1: None}
        sorted_lines = [
            {"id": "a", "text": "Γεια σας", "line_index": 0},
            {"id": "b", "text": "Πώς είστε", "line_index": 1},
        ]
        result_timing, result_words = _apply_forced_alignment(
            SAMPLE_FA_RESPONSE, timing_map, sorted_lines, word_timestamps_map
        )
        # Line 0 should be fixed
        assert result_timing[0] != (0, 0)
        assert result_words[0] is not None
        assert len(result_words[0]) == 2
        # Line 1 should be fixed
        assert result_timing[1] != (0, 0)
        assert result_words[1] is not None
        assert len(result_words[1]) == 2

    def test_mixed_degenerate_non_degenerate_only_degenerate_updated(self):
        """Only degenerate lines updated; non-degenerate lines unchanged."""
        timing_map = {0: (0, 0), 1: (700, 1500), 2: (0, 0)}
        word_timestamps_map = {
            0: None,
            1: [{"word": "Πώς", "start_ms": 700, "end_ms": 1000}],
            2: None,
        }
        result_timing, result_words = _apply_forced_alignment(
            SAMPLE_FA_RESPONSE, timing_map, SAMPLE_SORTED_LINES, word_timestamps_map
        )
        # Line 1 (non-degenerate) unchanged
        assert result_timing[1] == (700, 1500)
        assert result_words[1] == [{"word": "Πώς", "start_ms": 700, "end_ms": 1000}]
        # Line 0 should be fixed (has FA words "Γεια σας")
        assert result_timing[0][0] != result_timing[0][1]
        # Line 2 (no FA words for "Καλά ευχαριστώ") stays degenerate
        assert result_timing[2][0] == result_timing[2][1]

    def test_degenerate_line_with_no_matching_words_stays_degenerate(self):
        """A degenerate line with no FA words remains degenerate."""
        timing_map = {0: (0, 0)}
        word_timestamps_map = {0: None}
        sorted_lines = [{"id": "x", "text": "Καλά ευχαριστώ", "line_index": 0}]
        result_timing, result_words = _apply_forced_alignment(
            SAMPLE_FA_RESPONSE, timing_map, sorted_lines, word_timestamps_map
        )
        # No FA words match "Καλά ευχαριστώ" — stays degenerate
        s, e = result_timing[0]
        assert s == e

    def test_word_timestamps_correctly_converted_from_seconds_to_ms(self):
        """start/end floats (seconds) are converted to start_ms/end_ms ints (ms)."""
        timing_map = {0: (0, 0)}
        word_timestamps_map = {0: None}
        sorted_lines = [{"id": "a", "text": "Γεια σας", "line_index": 0}]
        fa_response = {
            "words": [
                {"text": "Γεια", "start": 0.35, "end": 0.70},
                {"text": "σας", "start": 0.70, "end": 1.00},
            ]
        }
        _result_timing, result_words = _apply_forced_alignment(
            fa_response, timing_map, sorted_lines, word_timestamps_map
        )
        assert result_words[0][0]["start_ms"] == 350
        assert result_words[0][0]["end_ms"] == 700
        assert result_words[0][1]["start_ms"] == 700
        assert result_words[0][1]["end_ms"] == 1000

    def test_line_timing_derived_from_word_boundaries(self):
        """Line start_ms = first word start_ms, end_ms = last word end_ms."""
        timing_map = {0: (0, 0)}
        word_timestamps_map = {0: None}
        sorted_lines = [{"id": "a", "text": "Γεια σας", "line_index": 0}]
        result_timing, result_words = _apply_forced_alignment(
            SAMPLE_FA_RESPONSE, timing_map, sorted_lines, word_timestamps_map
        )
        words = result_words[0]
        assert result_timing[0] == (words[0]["start_ms"], words[-1]["end_ms"])

    def test_input_dicts_not_mutated(self):
        """Original timing_map and word_timestamps_map are not mutated."""
        timing_map = {0: (0, 0), 1: (700, 1500)}
        word_timestamps_map = {0: None, 1: None}
        original_timing = dict(timing_map)
        original_words = dict(word_timestamps_map)
        _apply_forced_alignment(
            SAMPLE_FA_RESPONSE, timing_map, SAMPLE_SORTED_LINES[:2], word_timestamps_map
        )
        assert timing_map == original_timing
        assert word_timestamps_map == original_words

    def test_multi_word_line_all_words_assigned(self):
        """A multi-word line gets all its FA words assigned in order."""
        timing_map = {0: (0, 0)}
        word_timestamps_map = {0: None}
        sorted_lines = [{"id": "a", "text": "Γεια σας", "line_index": 0}]
        _result_timing, result_words = _apply_forced_alignment(
            SAMPLE_FA_RESPONSE, timing_map, sorted_lines, word_timestamps_map
        )
        words = result_words[0]
        assert len(words) == 2
        assert words[0]["word"] == "Γεια"
        assert words[1]["word"] == "σας"

    def test_cursor_drift_recovery_handles_word_mismatch(self):
        """Drift recovery finds word even if cursor is slightly off."""
        # The cursor will be off by a few characters after the first match
        timing_map = {0: (0, 0)}
        word_timestamps_map = {0: None}
        sorted_lines = [{"id": "a", "text": "Γεια σας Πώς", "line_index": 0}]
        fa_response = {
            "words": [
                {"text": "Γεια", "start": 0.0, "end": 0.35},
                {"text": "σας", "start": 0.35, "end": 0.7},
                {"text": "Πώς", "start": 0.7, "end": 1.0},
            ]
        }
        _result_timing, result_words = _apply_forced_alignment(
            fa_response, timing_map, sorted_lines, word_timestamps_map
        )
        # All three words matched
        assert len(result_words[0]) == 3

    def test_unmatchable_word_skipped_subsequent_words_still_matched(self):
        """A word not found in full_text is skipped without breaking subsequent words."""
        timing_map = {0: (0, 0)}
        word_timestamps_map = {0: None}
        sorted_lines = [{"id": "a", "text": "Γεια σας", "line_index": 0}]
        fa_response = {
            "words": [
                {"text": "XXXXXXXX", "start": 0.0, "end": 0.2},  # unmatchable
                {"text": "Γεια", "start": 0.2, "end": 0.5},
                {"text": "σας", "start": 0.5, "end": 0.8},
            ]
        }
        _result_timing, result_words = _apply_forced_alignment(
            fa_response, timing_map, sorted_lines, word_timestamps_map
        )
        # Unmatchable word skipped; "Γεια" and "σας" still matched
        assert len(result_words[0]) == 2
        assert result_words[0][0]["word"] == "Γεια"
        assert result_words[0][1]["word"] == "σας"


# ---------------------------------------------------------------------------
# TestAlignmentFlow — combined _apply_forced_alignment + redistribution logic
# ---------------------------------------------------------------------------


class TestAlignmentFlow:
    """Tests that simulate the pipeline's alignment_source logic using pure functions.

    These verify the decision logic that determines alignment_source:
    - FA fixes all degenerate lines → 'forced_alignment'
    - FA raises / fixes nothing → 'redistribution'
    - FA partially fixes → 'redistribution'
    - No degenerate lines → 'original'
    """

    def _simulate_alignment_source(
        self, timing_map, sorted_lines, word_timestamps_map, fa_response=None, fa_raises=False
    ):
        """Simulate the pipeline's alignment_source state machine using pure functions."""
        alignment_source = "original"
        degenerate_count = sum(1 for s, e in timing_map.values() if s == e)

        if degenerate_count > 0:
            if fa_raises:
                # FA exception — fall through to redistribution
                pass
            elif fa_response is not None:
                timing_map, word_timestamps_map = _apply_forced_alignment(
                    fa_response, timing_map, sorted_lines, word_timestamps_map
                )
                remaining = sum(1 for s, e in timing_map.values() if s == e)
                if remaining == 0:
                    alignment_source = "forced_alignment"
                # else: fall through to redistribution

        # Redistribution
        remaining_degenerate = sum(1 for s, e in timing_map.values() if s == e)
        if remaining_degenerate > 0:
            duration_ms = 2000
            timing_map, word_timestamps_map = _redistribute_degenerate_timing(
                timing_map, sorted_lines, duration_ms, word_timestamps_map
            )
            if alignment_source == "original":
                alignment_source = "redistribution"

        return alignment_source

    def test_fa_fixes_all_degenerate_lines_alignment_source_is_forced_alignment(self):
        """FA fixes all degenerate lines → alignment_source = 'forced_alignment'."""
        timing_map = {0: (0, 0), 1: (0, 0)}
        word_timestamps_map = {0: None, 1: None}
        sorted_lines = [
            {"id": "a", "text": "Γεια σας", "line_index": 0},
            {"id": "b", "text": "Πώς είστε", "line_index": 1},
        ]
        alignment_source = self._simulate_alignment_source(
            timing_map, sorted_lines, word_timestamps_map, fa_response=SAMPLE_FA_RESPONSE
        )
        assert alignment_source == "forced_alignment"

    def test_fa_raises_exception_falls_back_to_redistribution(self):
        """FA exception → falls back to redistribution, alignment_source = 'redistribution'."""
        timing_map = {0: (0, 0)}
        word_timestamps_map = {0: None}
        sorted_lines = [{"id": "a", "text": "Γεια σας", "line_index": 0}]
        alignment_source = self._simulate_alignment_source(
            timing_map, sorted_lines, word_timestamps_map, fa_raises=True
        )
        assert alignment_source == "redistribution"

    def test_fa_partially_fixes_remaining_handled_by_redistribution(self):
        """FA partially fixes (some remain degenerate) → redistribution, alignment_source = 'redistribution'."""
        # Line 2 "Καλά ευχαριστώ" has no FA words — stays degenerate, needs redistribution
        timing_map = {0: (0, 0), 1: (700, 1500), 2: (0, 0)}
        word_timestamps_map = {0: None, 1: None, 2: None}
        alignment_source = self._simulate_alignment_source(
            timing_map, SAMPLE_SORTED_LINES, word_timestamps_map, fa_response=SAMPLE_FA_RESPONSE
        )
        assert alignment_source == "redistribution"

    def test_no_degenerate_lines_fa_not_called_alignment_source_is_original(self):
        """No degenerate lines → FA skipped, redistribution skipped, alignment_source = 'original'."""
        timing_map = {0: (0, 500), 1: (700, 1500)}
        word_timestamps_map = {0: None, 1: None}
        sorted_lines = [
            {"id": "a", "text": "Γεια σας", "line_index": 0},
            {"id": "b", "text": "Πώς είστε", "line_index": 1},
        ]
        alignment_source = self._simulate_alignment_source(
            timing_map, sorted_lines, word_timestamps_map, fa_response=None
        )
        assert alignment_source == "original"
