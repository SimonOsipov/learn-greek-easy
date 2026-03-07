"""Tests for pos_mapping utility module."""

import pytest

from src.utils.pos_mapping import FREEDICT_TO_UPOS, KAIKKI_TO_UPOS, map_pos


@pytest.mark.unit
class TestKaikkiToUpos:
    @pytest.mark.parametrize("raw,expected", list(KAIKKI_TO_UPOS.items()))
    def test_all_kaikki_entries(self, raw: str, expected: str) -> None:
        assert map_pos(raw, source="kaikki") == expected


@pytest.mark.unit
class TestFreedictToUpos:
    @pytest.mark.parametrize("raw,expected", list(FREEDICT_TO_UPOS.items()))
    def test_all_freedict_entries(self, raw: str, expected: str) -> None:
        assert map_pos(raw, source="freedict") == expected


@pytest.mark.unit
class TestMapPos:
    def test_unknown_returns_x(self) -> None:
        assert map_pos("unknown_thing") == "X"

    def test_unknown_freedict_returns_x(self) -> None:
        assert map_pos("unknown_tag", source="freedict") == "X"

    def test_case_insensitive_upper(self) -> None:
        assert map_pos("NOUN") == "NOUN"

    def test_case_insensitive_mixed(self) -> None:
        assert map_pos("Adj") == "ADJ"

    def test_default_source_is_kaikki(self) -> None:
        # "n" is NOUN in freedict but unknown in kaikki
        assert map_pos("n") == "X"

    def test_freedict_n_maps_to_noun(self) -> None:
        assert map_pos("n", source="freedict") == "NOUN"

    def test_freedict_v_maps_to_verb(self) -> None:
        assert map_pos("v", source="freedict") == "VERB"

    def test_empty_string_returns_x(self) -> None:
        assert map_pos("") == "X"
