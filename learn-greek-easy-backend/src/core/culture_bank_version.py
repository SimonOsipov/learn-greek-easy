"""Culture-question bank version/date constants (WEDGE-02-04).

Public surface:
  CULTURE_BANK_VERSION       — ISO date the reviewed topic-tagging pass was
                                frozen/merged (str).
  CULTURE_BANK_QUESTION_COUNT — prod-verified exact question count (int).

These are the first-class recorded bank version/date + count that WEDGE-05
(a separate, later story) reads for its "bank v<date>, <count> questions"
honest-coverage chip. No endpoint/DTO/migration is added here — WEDGE-05
imports these constants directly (D-A7: a metadata table was explicitly
rejected as heavier and dragging in exactly the schema/read surface the
WEDGE-02 story's Out-of-Scope section forbids).

CULTURE_BANK_QUESTION_COUNT was prod-verified against the live database on
2026-07-10 (exactly 490 rows).
"""

from __future__ import annotations

CULTURE_BANK_VERSION: str = "2026-07-10"
CULTURE_BANK_QUESTION_COUNT: int = 490
