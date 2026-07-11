"""Tests for WEDGE-02-01: pure Pass-1 category mapping + twin-key normalization.

Regression guard for ``resolve_topic_for_category`` and ``normalize_twin_key``
in ``src/core/culture_topic_mapping.py`` — the two pure functions the
two-pass tagging engine (``src/services/culture_topic_tagger.py``) is built
on.

Acceptance Criteria covered (WEDGE-02-01, per the architect's Test Specs
table — task-1291):
  AC3/AC1  Thematic categories (history/geography/politics/practical) map to
           self — the D-A1 readiness fold (practical -> culture, elsewhere in
           src/constants.py) must NOT leak into this mapping.
  AC2/tax  traditions/news/culture fold to CultureTopic.CULTURE (D-A2 —
           harmless guard, never fires in prod; the dev seed DOES have a
           traditions deck).
  AC1      An unrecognized category raises ValueError (surfaces loudly; the
           engine catches it into report.unmapped).
  AC3      normalize_twin_key is case- and whitespace-robust, which is what
           makes AC3's "a question and its exam-paper copy never disagree"
           hold once Pass 2's twin matching is wired up.
"""

from __future__ import annotations

import pytest

from src.core.culture_topic import CultureTopic
from src.core.culture_topic_mapping import normalize_twin_key, resolve_topic_for_category

# ===========================================================================
# AC3/AC1 — test_thematic_categories_map_to_self
# ===========================================================================


class TestThematicCategoriesMapToSelf:
    """history/geography/politics/practical must resolve to themselves."""

    @pytest.mark.parametrize(
        "category",
        ["history", "geography", "politics", "practical"],
    )
    def test_thematic_categories_map_to_self(self, category: str) -> None:
        # AC3/AC1 (WEDGE-02-01 Test Specs) — practical -> practical, NOT culture.
        assert resolve_topic_for_category(category) == CultureTopic(category)


# ===========================================================================
# AC2/tax — test_traditions_news_culture_fold_to_culture
# ===========================================================================


class TestTraditionsNewsCultureFoldToCulture:
    """traditions/news/culture all fold to CultureTopic.CULTURE (D-A2)."""

    @pytest.mark.parametrize("category", ["traditions", "news", "culture"])
    def test_traditions_news_culture_fold_to_culture(self, category: str) -> None:
        # AC2/tax (WEDGE-02-01 Test Specs)
        assert resolve_topic_for_category(category) == CultureTopic.CULTURE


# ===========================================================================
# AC1 — test_unknown_category_raises_value_error
# ===========================================================================


class TestUnknownCategoryRaisesValueError:
    def test_unknown_category_raises_value_error(self) -> None:
        # AC1 (WEDGE-02-01 Test Specs)
        with pytest.raises(ValueError):
            resolve_topic_for_category("astronomy")


# ===========================================================================
# AC3 — test_normalize_twin_key_matches_case_whitespace_variants
# ===========================================================================


class TestNormalizeTwinKeyMatchesCaseWhitespaceVariants:
    """Case- and whitespace-insensitive twin matching is what makes AC3's
    'a question and its exam-paper copy never disagree' hold in Pass 2."""

    def test_normalize_twin_key_matches_case_whitespace_variants(self) -> None:
        # AC3 (WEDGE-02-01 Test Specs)
        original = {
            "el": "Ποια ήταν η πρώτη πρωτεύουσα της σύγχρονης Ελλάδας;",
            "en": "What was the first capital of modern Greece?",
            "ru": "Какой была первая столица современной Греции?",
        }
        # Same el content, differing by case + leading/trailing/internal
        # whitespace (and a wholly different en/ru translation, to prove
        # normalize_twin_key only looks at "el").
        variant = {
            "el": "  ΠΟΙΑ  ήταν η πρώτη   πρωτεύουσα της σύγχρονης ελλάδας;  ",
            "en": "a completely different english translation",
            "ru": "совершенно другой русский перевод",
        }
        assert normalize_twin_key(original) == normalize_twin_key(variant)
