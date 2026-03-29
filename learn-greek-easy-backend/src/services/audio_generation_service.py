from __future__ import annotations

import base64
from dataclasses import dataclass
from io import BytesIO
from typing import Any, Optional, Protocol
from uuid import UUID

from mutagen.mp3 import MP3

from src.core.logging import get_logger

logger = get_logger(__name__)


class ProgressCallback(Protocol):
    async def __call__(self, stage: str, **kwargs: Any) -> None: ...  # noqa: E704


@dataclass
class AudioResult:
    audio_bytes: bytes
    s3_key: str
    duration_seconds: float
    file_size_bytes: int


@dataclass
class AudioWithTimestampsResult(AudioResult):
    word_timestamps: list[dict]  # [{word: str, start_ms: int, end_ms: int}]


@dataclass
class DialogAudioResult(AudioResult):
    line_timings: dict[int, tuple[int, int]]
    word_timestamps_map: dict[int, list[dict] | None]
    alignment_source: str
    degenerate_line_count: int


@dataclass
class DialogInput:
    text: str
    voice_id: str


def _redistribute_degenerate_timing(
    timing_map: dict[int, tuple[int, int]],
    sorted_lines: list[dict],
    duration_ms: int,
    word_timestamps_map: dict[int, list[dict] | None],
) -> tuple[dict[int, tuple[int, int]], dict[int, list[dict] | None]]:
    """Redistribute timing for degenerate lines proportionally by character count."""
    degenerate_indices = {i for i, (s, e) in timing_map.items() if s == e}
    if not degenerate_indices:
        return timing_map, word_timestamps_map

    char_counts = {i: len(sorted_lines[i]["text"]) for i in degenerate_indices}
    total_chars = sum(char_counts.values())
    if total_chars == 0:
        return timing_map, word_timestamps_map

    total_non_degenerate_time = sum(
        end - start for i, (start, end) in timing_map.items() if i not in degenerate_indices
    )
    unclaimed_ms = max(0, duration_ms - total_non_degenerate_time)

    # Proportional shares per degenerate line
    shares = {i: unclaimed_ms * (char_counts[i] / total_chars) for i in degenerate_indices}

    # Find ordered non-degenerate start times for clamping
    sorted_non_degen_starts = sorted(
        timing_map[i][0] for i in timing_map if i not in degenerate_indices
    )

    # Cursor walk: fill degenerate lines into gaps chronologically
    new_timing_map = dict(timing_map)
    cursor = 0
    ordered_indices = sorted(timing_map.keys())
    for i in ordered_indices:
        if i not in degenerate_indices:
            cursor = timing_map[i][1]
        else:
            start = cursor
            end = cursor + round(shares[i])
            # Clamp: find next non-degenerate start after cursor
            next_non_degen_start = next(
                (s for s in sorted_non_degen_starts if s > cursor), duration_ms
            )
            end = min(end, next_non_degen_start)
            # Clamp to duration_ms
            end = min(end, duration_ms)
            new_timing_map[i] = (start, end)
            cursor = end

    # Redistribute word timestamps for redistributed lines
    new_word_timestamps_map = dict(word_timestamps_map)
    for i in degenerate_indices:
        words = word_timestamps_map.get(i)
        if words is None:
            continue
        line_start, line_end = new_timing_map[i]
        line_duration = line_end - line_start
        total_word_chars = sum(len(w["word"]) for w in words)
        if total_word_chars == 0:
            continue
        word_cursor = line_start
        new_words = []
        for w_idx, w in enumerate(words):
            w_start = word_cursor
            if w_idx == len(words) - 1:
                w_end = line_end
            else:
                w_end = word_cursor + round(line_duration * len(w["word"]) / total_word_chars)
            new_words.append({**w, "start_ms": w_start, "end_ms": w_end})
            word_cursor = w_end
        new_word_timestamps_map[i] = new_words

    return new_timing_map, new_word_timestamps_map


def _apply_forced_alignment(  # noqa: C901
    alignment_response: dict[str, Any],
    timing_map: dict[int, tuple[int, int]],
    sorted_lines: list[dict],
    word_timestamps_map: dict[int, list[dict] | None],
) -> tuple[dict[int, tuple[int, int]], dict[int, list[dict] | None]]:
    """Map forced alignment word timestamps to degenerate dialog lines."""
    degenerate_indices = {i for i, (s, e) in timing_map.items() if s == e}
    if not degenerate_indices:
        return timing_map, word_timestamps_map

    full_text = "\n".join(line["text"] for line in sorted_lines)

    line_ranges: list[tuple[int, int, int]] = []
    offset = 0
    for i, line in enumerate(sorted_lines):
        length = len(line["text"])
        line_ranges.append((i, offset, offset + length))
        offset += length + 1

    line_words: dict[int, list[dict]] = {i: [] for i in degenerate_indices}

    cursor = 0
    for word in alignment_response.get("words", []):
        word_text = word["text"]
        word_len = len(word_text)

        if full_text[cursor : cursor + word_len] == word_text:
            match_pos = cursor
        else:
            match_pos = None
            search_start = max(0, cursor - 10)
            search_end = min(len(full_text), cursor + 10 + word_len)
            window = full_text[search_start:search_end]
            idx = window.find(word_text)
            if idx != -1:
                match_pos = search_start + idx

        if match_pos is None:
            continue

        cursor = match_pos + word_len
        while cursor < len(full_text) and full_text[cursor] in (" ", "\n"):
            cursor += 1

        for line_idx, char_start, char_end in line_ranges:
            if char_start <= match_pos < char_end:
                if line_idx in degenerate_indices:
                    line_words[line_idx].append(word)
                break

    new_timing_map = dict(timing_map)
    new_word_timestamps_map = dict(word_timestamps_map)

    for i in degenerate_indices:
        words = line_words[i]
        if not words:
            continue

        word_list = [
            {
                "word": w["text"],
                "start_ms": int(w["start"] * 1000),
                "end_ms": int(w["end"] * 1000),
            }
            for w in words
        ]

        new_timing_map[i] = (word_list[0]["start_ms"], word_list[-1]["end_ms"])
        new_word_timestamps_map[i] = word_list

    return new_timing_map, new_word_timestamps_map


def _build_word_timestamps(  # noqa: C901
    result_data: dict, sorted_lines: list[dict]
) -> dict[int, list[dict] | None]:
    """Extract word-level timing from ElevenLabs alignment data."""
    try:
        alignment = result_data.get("alignment")
        if not alignment:
            logger.warning(
                "_build_word_timestamps: alignment missing in result_data, returning all None"
            )
            return {i: None for i in range(len(sorted_lines))}

        chars = alignment.get("characters", [])
        starts = alignment.get("character_start_times_seconds", [])
        ends = alignment.get("character_end_times_seconds", [])
        voice_segments = result_data.get("voice_segments", [])

        result: dict[int, list[dict] | None] = {i: None for i in range(len(sorted_lines))}

        for seg in voice_segments:
            line_idx = seg.get("dialogue_input_index")
            if line_idx is None:
                logger.warning(
                    "_build_word_timestamps: segment missing dialogue_input_index, skipping"
                )
                continue

            char_start = seg.get("character_start_index")
            char_end = seg.get("character_end_index")

            if char_start is None or char_end is None:
                logger.warning(
                    "_build_word_timestamps: segment {} missing character indices, skipping",
                    line_idx,
                )
                continue

            seg_chars = chars[char_start:char_end]
            seg_starts = starts[char_start:char_end]
            seg_ends = ends[char_start:char_end]

            words: list[dict] = []
            word_chars: list[str] = []
            word_start_idx: int | None = None

            for j, ch in enumerate(seg_chars):
                if ch == " ":
                    if word_chars:
                        words.append(
                            {
                                "word": "".join(word_chars),
                                "start_ms": int(seg_starts[word_start_idx] * 1000),
                                "end_ms": int(seg_ends[j - 1] * 1000),
                            }
                        )
                        word_chars = []
                        word_start_idx = None
                else:
                    if not word_chars:
                        word_start_idx = j
                    word_chars.append(ch)

            if word_chars:
                last_idx = len(seg_chars) - 1
                words.append(
                    {
                        "word": "".join(word_chars),
                        "start_ms": int(seg_starts[word_start_idx] * 1000),
                        "end_ms": int(seg_ends[last_idx] * 1000),
                    }
                )

            result[line_idx] = words

        return result
    except (IndexError, KeyError, TypeError) as exc:
        logger.warning("_build_word_timestamps: unexpected error, returning all None: {}", exc)
        return {i: None for i in range(len(sorted_lines))}


class AudioGenerationService:
    def __init__(self) -> None:
        from src.services.elevenlabs_service import get_elevenlabs_service
        from src.services.s3_service import get_s3_service

        self._elevenlabs = get_elevenlabs_service()
        self._s3 = get_s3_service()

    async def generate_single(  # noqa: C901
        self,
        text: str,
        s3_key: str,
        voice_id: str | None = None,
        on_progress: ProgressCallback | None = None,
        news_item_id: Optional[UUID] = None,
        with_timestamps: bool = False,
    ) -> AudioResult | AudioWithTimestampsResult:
        if on_progress is not None:
            await on_progress("tts")

        audio_bytes = await self._elevenlabs.generate_speech(
            text,
            voice_id=voice_id,
            news_item_id=news_item_id,
        )

        # Optional word-level timestamps via forced alignment
        word_timestamps: list[dict] = []
        if with_timestamps:
            if on_progress is not None:
                await on_progress("alignment")
            try:
                fa_response = await self._elevenlabs.forced_align(audio_bytes, text)
                word_timestamps = [
                    {
                        "word": w["text"],
                        "start_ms": int(w["start"] * 1000),
                        "end_ms": int(w["end"] * 1000),
                    }
                    for w in fa_response.get("words", [])
                ]
            except Exception:
                logger.warning(
                    "forced_align failed for generate_single, returning empty word_timestamps"
                )

        duration_seconds = (len(audio_bytes) * 8) / (128 * 1000)
        if with_timestamps:
            try:
                mp3 = MP3(fileobj=BytesIO(audio_bytes))
                if mp3.info is not None:
                    duration_seconds = mp3.info.length
            except Exception:
                pass  # keep bitrate estimate

        if on_progress is not None:
            await on_progress("upload")

        upload_ok = self._s3.upload_object(s3_key, audio_bytes, "audio/mpeg")
        if not upload_ok:
            raise RuntimeError("S3 upload failed")

        if with_timestamps:
            return AudioWithTimestampsResult(
                audio_bytes=audio_bytes,
                s3_key=s3_key,
                duration_seconds=duration_seconds,
                file_size_bytes=len(audio_bytes),
                word_timestamps=word_timestamps,
            )
        return AudioResult(
            audio_bytes=audio_bytes,
            s3_key=s3_key,
            duration_seconds=duration_seconds,
            file_size_bytes=len(audio_bytes),
        )

    def generate_presigned_url(self, s3_key: str) -> str | None:
        return self._s3.generate_presigned_url(s3_key)

    async def generate_dialog(  # noqa: C901
        self,
        inputs: list[DialogInput],
        s3_key: str,
        on_progress: ProgressCallback | None = None,
    ) -> DialogAudioResult:
        sorted_lines = [{"text": inp.text} for inp in inputs]
        el_inputs = [{"text": inp.text, "voice_id": inp.voice_id} for inp in inputs]

        if on_progress is not None:
            await on_progress("tts")

        result_data = await self._elevenlabs.generate_dialog_audio(el_inputs)

        audio_bytes = base64.b64decode(result_data["audio_base64"])

        voice_segments = result_data.get("voice_segments")
        if not voice_segments:
            raise ValueError("voice_segments missing or empty in ElevenLabs response")

        timing_map: dict[int, tuple[int, int]] = {}
        for seg in voice_segments:
            idx = seg["dialogue_input_index"]
            timing_map[idx] = (
                int(seg["start_time_seconds"] * 1000),
                int(seg["end_time_seconds"] * 1000),
            )

        # Validate all line indices are present
        for i in range(len(inputs)):
            if i not in timing_map:
                raise ValueError(f"voice_segments missing entry for line index {i}")

        degenerate_line_count = sum(1 for s, e in timing_map.values() if s == e)
        if degenerate_line_count > 0:
            logger.warning(
                "Dialog audio has {} degenerate line(s) (start_ms == end_ms)",
                degenerate_line_count,
            )

        word_timestamps_map = _build_word_timestamps(result_data, sorted_lines)

        # Parse MP3 duration (fallback to segment duration)
        duration_seconds = voice_segments[-1]["end_time_seconds"]
        try:
            mp3 = MP3(fileobj=BytesIO(audio_bytes))
            if mp3.info is not None:
                duration_seconds = mp3.info.length
        except Exception:
            pass

        alignment_source = "original"

        # Forced alignment for degenerate lines
        if degenerate_line_count > 0:
            try:
                if on_progress is not None:
                    await on_progress("alignment")
                full_transcript = "\n".join(inp.text for inp in inputs)
                fa_response = await self._elevenlabs.forced_align(audio_bytes, full_transcript)
                timing_map, word_timestamps_map = _apply_forced_alignment(
                    fa_response, timing_map, sorted_lines, word_timestamps_map
                )
                remaining = sum(1 for s, e in timing_map.values() if s == e)
                if remaining == 0:
                    alignment_source = "forced_alignment"
                else:
                    logger.warning(
                        "Forced alignment left {} degenerate line(s), falling through to redistribution",
                        remaining,
                    )
            except Exception as exc:
                logger.warning("Forced alignment failed, falling back to redistribution: {}", exc)

        # Redistribution fallback
        remaining_degenerate = sum(1 for s, e in timing_map.values() if s == e)
        if remaining_degenerate > 0:
            duration_ms = int(duration_seconds * 1000)
            timing_map, word_timestamps_map = _redistribute_degenerate_timing(
                timing_map, sorted_lines, duration_ms, word_timestamps_map
            )
            if alignment_source == "original":
                alignment_source = "redistribution"

        if on_progress is not None:
            await on_progress("upload")

        upload_ok = self._s3.upload_object(s3_key, audio_bytes, "audio/mpeg")
        if not upload_ok:
            raise RuntimeError("S3 upload failed")

        return DialogAudioResult(
            audio_bytes=audio_bytes,
            s3_key=s3_key,
            duration_seconds=duration_seconds,
            file_size_bytes=len(audio_bytes),
            line_timings=timing_map,
            word_timestamps_map=word_timestamps_map,
            alignment_source=alignment_source,
            degenerate_line_count=degenerate_line_count,
        )


_service: AudioGenerationService | None = None


def get_audio_generation_service() -> AudioGenerationService:
    global _service
    if _service is None:
        _service = AudioGenerationService()
    return _service
