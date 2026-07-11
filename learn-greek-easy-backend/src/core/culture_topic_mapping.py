"""Pure Pass-1 category → CultureTopic mapping + twin-key normalization (WEDGE-02-01).

Public surface:
  resolve_topic_for_category(category: str) -> CultureTopic
  normalize_twin_key(question_text: dict) -> str

No DB import here — this module is pure logic so it can be unit-tested in
isolation from the two-pass DB engine (``src/services/culture_topic_tagger.py``).

See the WEDGE-02 story System Design ("Components" → culture_topic_mapping.py)
for the exact contract:

  - resolve_topic_for_category: history/geography/politics/practical map to
    self; traditions/news/culture fold to CultureTopic.CULTURE (D-A2 —
    a harmless guard that never fires in prod, but the dev seed DOES have a
    traditions deck); any other category raises ValueError.

    D-A1: this is INTENTIONALLY NOT the same mapping as
    ``src.constants.CATEGORY_DB_TO_LOGICAL`` (which folds
    ``"practical" -> "culture"`` for the older 4-bucket readiness UI).
    ``practical`` MUST stay ``practical`` here — a separate, orthogonal
    5-bucket taxonomy; the two are never blended.
  - normalize_twin_key: takes question_text["el"], lowercases (``.lower()``,
    NOT ``.casefold()`` — D-A6: the prod partition was measured with SQL
    ``lower()``, which keeps Greek final-sigma "ς" distinct from "σ";
    ``.casefold()`` would fold them together and change the measured
    94-twin/19-residue split), strips, and collapses internal whitespace —
    used for both twin matching (Pass 2) and reviewed-fixture key matching.
"""

from __future__ import annotations

from src.core.culture_topic import CultureTopic

# Thematic categories resolve to their own CultureTopic value (D-A1: practical
# stays practical, the readiness fold in src.constants.CATEGORY_DB_TO_LOGICAL
# is a different, unrelated mapping and is never imported/reused here).
_THEMATIC_CATEGORIES = frozenset({"history", "geography", "politics", "practical"})

# traditions/news/culture all fold to CultureTopic.CULTURE (D-A2). traditions
# and news never appear in prod but the dev seed has a traditions deck, so
# this is a harmless defensive guard, not dead code.
_CULTURE_FOLD_CATEGORIES = frozenset({"traditions", "news", "culture"})


def resolve_topic_for_category(category: str) -> CultureTopic:
    """Pass-1 map: thematic categories resolve to self, culture/traditions/news
    fold to CultureTopic.CULTURE, anything else raises ValueError.
    """
    if category in _THEMATIC_CATEGORIES:
        return CultureTopic(category)
    if category in _CULTURE_FOLD_CATEGORIES:
        return CultureTopic.CULTURE
    raise ValueError(f"Unrecognized culture-question category: {category!r}")


def normalize_twin_key(question_text: dict) -> str:
    """Normalize question_text['el'] for twin/fixture matching.

    lower() (D-A6, not casefold()) + collapse-whitespace + strip, applied in
    one pass via str.split()/str.join() (split() with no args splits on any
    run of whitespace and drops empty strings, which is exactly
    lower + collapse-internal-whitespace + strip in a single idiom).
    """
    el = question_text["el"]
    return " ".join(el.lower().split())
