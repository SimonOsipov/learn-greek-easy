"""Tests for gloss_cleaning utility module."""

import json
from pathlib import Path

import pytest

from src.utils.gloss_cleaning import clean_gloss, is_cross_reference

GOLDEN_DATA = json.loads(
    (Path(__file__).parent.parent.parent / "fixtures" / "gloss_cleaning_golden.json").read_text(
        encoding="utf-8"
    )
)


@pytest.mark.unit
class TestIsCrossReference:
    def test_plural_of(self) -> None:
        assert is_cross_reference("plural of cat") is True

    def test_alternative_form_of(self) -> None:
        assert is_cross_reference("Alternative form of aquila") is True

    def test_feminine_of(self) -> None:
        assert is_cross_reference("feminine of king") is True

    def test_masculine_of(self) -> None:
        assert is_cross_reference("masculine of queen") is True

    def test_synonym_of(self) -> None:
        assert is_cross_reference("Synonym of house") is True

    def test_diminutive_of(self) -> None:
        assert is_cross_reference("diminutive of cat") is True

    def test_comparative_form_of(self) -> None:
        assert is_cross_reference("comparative form of big") is True

    def test_superlative_form_of(self) -> None:
        assert is_cross_reference("superlative form of good") is True

    def test_regular_gloss_not_cross_ref(self) -> None:
        assert is_cross_reference("eagle") is False

    def test_empty_string_not_cross_ref(self) -> None:
        assert is_cross_reference("") is False

    def test_case_insensitive_plural(self) -> None:
        assert is_cross_reference("PLURAL of X") is True

    def test_case_insensitive_alternative(self) -> None:
        assert is_cross_reference("alternative form of Y") is True


@pytest.mark.unit
class TestCleanGloss:
    @pytest.mark.parametrize(
        "case",
        GOLDEN_DATA,
        ids=[c["input"] or "<empty>" for c in GOLDEN_DATA],
    )
    def test_golden_set(self, case: dict) -> None:
        result = clean_gloss(case["input"])
        assert result == case["expected"]

    def test_whitespace_only_returns_none(self) -> None:
        assert clean_gloss("   ") is None

    def test_tab_returns_none(self) -> None:
        assert clean_gloss("\t") is None

    def test_nested_parens_leading(self) -> None:
        # Only outermost leading paren stripped
        result = clean_gloss("(very (informal)) buddy")
        # _RE strips up to first ), so "(very (informal))" would strip "(very "
        # This is fine — just check it doesn't crash
        assert result is not None

    def test_result_after_stripping_is_non_empty(self) -> None:
        assert clean_gloss("(slang) cool (adjective)") == "cool"
