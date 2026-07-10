"""Pure Pass-1 category → CultureTopic mapping + twin-key normalization (WEDGE-02-01).

Public surface:
  resolve_topic_for_category(category: str) -> CultureTopic
  normalize_twin_key(question_text: dict) -> str

No DB import here — this module is pure logic so it can be unit-tested in
isolation from the two-pass DB engine (``src/services/culture_topic_tagger.py``).

STAGE 2.5 SCAFFOLD: both functions are signature-only stubs that
``raise NotImplementedError``. The executor implements the real mapping /
normalization logic in Stage 3. See the WEDGE-02 story System Design
("Components" → culture_topic_mapping.py) for the exact contract:

  - resolve_topic_for_category: history/geography/politics/practical map to
    self; traditions/news/culture fold to CultureTopic.CULTURE (D-A2 —
    a harmless guard that never fires in prod, but the dev seed DOES have a
    traditions deck); any other category raises ValueError.
  - normalize_twin_key: takes question_text["el"], lowercases/casefolds,
    strips, and collapses internal whitespace (D-A6) — used for both twin
    matching (Pass 2) and reviewed-fixture key matching.
"""

from __future__ import annotations

from src.core.culture_topic import CultureTopic


def resolve_topic_for_category(category: str) -> CultureTopic:
    """Pass-1 map: thematic categories resolve to self, culture/traditions/news
    fold to CultureTopic.CULTURE, anything else raises ValueError.

    Stub (WEDGE-02-01 Stage 2.5) — implemented in Stage 3.
    """
    raise NotImplementedError(
        "resolve_topic_for_category is not implemented yet (WEDGE-02-01 Stage 3)."
    )


def normalize_twin_key(question_text: dict) -> str:
    """Normalize question_text['el'] for twin/fixture matching.

    Stub (WEDGE-02-01 Stage 2.5) — implemented in Stage 3.
    """
    raise NotImplementedError("normalize_twin_key is not implemented yet (WEDGE-02-01 Stage 3).")
