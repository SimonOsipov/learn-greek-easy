"""Unit tests for _redistribute_degenerate_timing."""

from src.services.audio_generation_service import _redistribute_degenerate_timing


def _make_timing_map(*entries: tuple[int, int]) -> dict[int, tuple[int, int]]:
    """Build timing_map from (start, end) pairs indexed by position."""
    return {i: (s, e) for i, (s, e) in enumerate(entries)}


def _make_sorted_lines(*texts: str) -> list[dict]:
    """Build sorted_lines with 'text' key for each entry."""
    return [{"text": t, "id": i, "line_index": i, "speaker_id": 1} for i, t in enumerate(texts)]


def _make_word_timestamps_map(
    *word_lists: list[str] | None,
) -> dict[int, list[dict] | None]:
    """Build word_timestamps_map; None entries stay None."""
    result: dict[int, list[dict] | None] = {}
    for i, words in enumerate(word_lists):
        if words is None:
            result[i] = None
        else:
            result[i] = [{"word": w, "start_ms": 0, "end_ms": 0} for w in words]
    return result


class TestRedistributeNoDegenerate:
    def test_no_degenerate_returns_unchanged(self):
        timing_map = _make_timing_map((0, 1000), (1000, 2000))
        sorted_lines = _make_sorted_lines("hello", "world")
        word_map = _make_word_timestamps_map(None, None)
        result_t, result_w = _redistribute_degenerate_timing(
            timing_map, sorted_lines, 2000, word_map
        )
        assert result_t is timing_map
        assert result_w is word_map


class TestRedistributeAllDegenerate:
    def test_all_degenerate_distributes_full_duration(self):
        # 3 lines, chars 10/20/30, 6000ms -> proportional shares
        timing_map = _make_timing_map((0, 0), (0, 0), (0, 0))
        sorted_lines = _make_sorted_lines("a" * 10, "b" * 20, "c" * 30)
        word_map = _make_word_timestamps_map(None, None, None)
        result_t, _ = _redistribute_degenerate_timing(timing_map, sorted_lines, 6000, word_map)
        # shares: 10/60*6000=1000, 20/60*6000=2000, 30/60*6000=3000
        assert result_t[0] == (0, 1000)
        assert result_t[1] == (1000, 3000)
        assert result_t[2] == (3000, 6000)


class TestRedistributeMixed:
    def test_mixed_degenerate_non_degenerate(self):
        # Line 0 non-degen (0,2000), Line 1 degen 10-chars, Line 2 non-degen (4000,6000),
        # Line 3 degen 20-chars, duration=9000ms
        timing_map = _make_timing_map((0, 2000), (0, 0), (4000, 6000), (0, 0))
        sorted_lines = _make_sorted_lines("a" * 5, "b" * 10, "c" * 5, "d" * 20)
        word_map = _make_word_timestamps_map(None, None, None, None)
        result_t, _ = _redistribute_degenerate_timing(timing_map, sorted_lines, 9000, word_map)
        # unclaimed = 9000 - (2000 + 2000) = 5000
        # line 1 share: 5000 * 10/30 = 1667 (rounded)
        # line 1: start=2000, end=min(2000+1667, 4000) = 3667
        # line 3 share: 5000 * 20/30 = 3333 (rounded)
        # line 3: start=6000, end=min(6000+3333, 9000) = 9000
        assert result_t[1] == (2000, 3667)
        assert result_t[3] == (6000, 9000)


class TestRedistributeConsecutive:
    def test_consecutive_degenerate_sharing_gap(self):
        # Line 0 non-degen(0,1000), Lines 1&2 degen 10-chars each,
        # Line 3 non-degen(5000,7000), duration=7000ms
        timing_map = _make_timing_map((0, 1000), (0, 0), (0, 0), (5000, 7000))
        sorted_lines = _make_sorted_lines("a" * 5, "b" * 10, "c" * 10, "d" * 5)
        word_map = _make_word_timestamps_map(None, None, None, None)
        result_t, _ = _redistribute_degenerate_timing(timing_map, sorted_lines, 7000, word_map)
        # unclaimed = 7000 - (1000 + 2000) = 4000
        # each share: 4000 * 10/20 = 2000
        # line 1: start=1000, end=min(1000+2000, 5000)=3000
        # line 2: start=3000, end=min(3000+2000, 5000)=5000
        assert result_t[1] == (1000, 3000)
        assert result_t[2] == (3000, 5000)


class TestRedistributeBoundaryPositions:
    def test_degenerate_at_start(self):
        # Line 0 degen, Line 1 non-degen(3000,6000), duration=6000ms
        timing_map = _make_timing_map((0, 0), (3000, 6000))
        sorted_lines = _make_sorted_lines("a" * 10, "b" * 5)
        word_map = _make_word_timestamps_map(None, None)
        result_t, _ = _redistribute_degenerate_timing(timing_map, sorted_lines, 6000, word_map)
        # unclaimed = 6000 - 3000 = 3000, line 0 share = 3000
        # line 0: start=0, end=min(0+3000, 3000)=3000
        assert result_t[0] == (0, 3000)

    def test_degenerate_at_end(self):
        # Line 0 non-degen(0,3000), Line 1 degen, duration=6000ms
        timing_map = _make_timing_map((0, 3000), (0, 0))
        sorted_lines = _make_sorted_lines("a" * 5, "b" * 10)
        word_map = _make_word_timestamps_map(None, None)
        result_t, _ = _redistribute_degenerate_timing(timing_map, sorted_lines, 6000, word_map)
        # unclaimed = 6000 - 3000 = 3000, line 1 share = 3000
        # line 1: start=3000, end=min(3000+3000, 6000)=6000
        assert result_t[1] == (3000, 6000)


class TestRedistributeWordTimestamps:
    def test_word_timestamps_redistributed_within_line(self):
        # Line 0 non-degen(0,2000), line 1 degen with words, line 2 non-degen(5000,7000), duration=9000ms
        # unclaimed = 9000 - (2000 + 2000) = 5000; line 1 share = 5000
        # cursor after line 0 = 2000, line 1: start=2000, end=min(2000+5000, 5000)=5000 -> 3000ms duration
        # words: "hello"(5c), "world"(5c), "foo"(3c), 13 total chars
        # "hello": 5/13 * 3000 = 1154 -> (2000, 3154)
        # "world": 5/13 * 3000 = 1154 -> (3154, 4308)
        # "foo": last -> (4308, 5000)
        timing_map2 = _make_timing_map((0, 2000), (0, 0), (5000, 7000))
        sorted_lines2 = _make_sorted_lines("x" * 5, "hello world foo", "y" * 5)
        word_map2 = {
            0: None,
            1: [
                {"word": "hello", "start_ms": 0, "end_ms": 0},
                {"word": "world", "start_ms": 0, "end_ms": 0},
                {"word": "foo", "start_ms": 0, "end_ms": 0},
            ],
            2: None,
        }
        result_t, result_w = _redistribute_degenerate_timing(
            timing_map2, sorted_lines2, 9000, word_map2
        )
        assert result_t[1] == (2000, 5000)
        words = result_w[1]
        assert words is not None
        assert len(words) == 3
        assert words[0]["start_ms"] == 2000
        assert words[0]["end_ms"] == 3154
        assert words[1]["start_ms"] == 3154
        assert words[1]["end_ms"] == 4308
        assert words[2]["start_ms"] == 4308
        assert words[2]["end_ms"] == 5000

    def test_word_timestamps_none_stays_none(self):
        timing_map = _make_timing_map((0, 0), (2000, 5000))
        sorted_lines = _make_sorted_lines("hello world", "b" * 5)
        word_map = _make_word_timestamps_map(None, None)
        _, result_w = _redistribute_degenerate_timing(timing_map, sorted_lines, 5000, word_map)
        assert result_w[0] is None


class TestRedistributeEdgeCases:
    def test_zero_unclaimed_time(self):
        # Non-degen time equals duration, degenerate line gets 0ms
        timing_map = _make_timing_map((0, 0), (0, 6000))
        sorted_lines = _make_sorted_lines("a" * 10, "b" * 5)
        word_map = _make_word_timestamps_map(None, None)
        result_t, _ = _redistribute_degenerate_timing(timing_map, sorted_lines, 6000, word_map)
        # unclaimed = max(0, 6000 - 6000) = 0, share = 0
        # line 0: start=0, end=min(0, 0)=0 -> stays (0, 0)
        start, end = result_t[0]
        assert end - start == 0

    def test_empty_text_lines_handled_gracefully(self):
        # total_chars == 0 -> return unchanged
        timing_map = _make_timing_map((0, 0), (0, 0))
        sorted_lines = _make_sorted_lines("", "")
        word_map = _make_word_timestamps_map(None, None)
        result_t, result_w = _redistribute_degenerate_timing(
            timing_map, sorted_lines, 6000, word_map
        )
        assert result_t is timing_map
        assert result_w is word_map

    def test_input_dicts_not_mutated(self):
        timing_map = _make_timing_map((0, 2000), (0, 0), (4000, 6000))
        original_timing = dict(timing_map)
        sorted_lines = _make_sorted_lines("a" * 5, "b" * 10, "c" * 5)
        word_map = {
            0: None,
            1: [{"word": "hello", "start_ms": 0, "end_ms": 0}],
            2: None,
        }
        original_word_map = {k: list(v) if v is not None else None for k, v in word_map.items()}
        _redistribute_degenerate_timing(timing_map, sorted_lines, 9000, word_map)
        # Input dicts should not be mutated
        assert timing_map == original_timing
        assert word_map[1] == original_word_map[1]
