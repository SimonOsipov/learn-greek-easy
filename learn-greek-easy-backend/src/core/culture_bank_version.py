"""Culture-question bank version/date constants (WEDGE-02-04).

Public surface:
  CULTURE_BANK_VERSION       — ISO date the reviewed topic-tagging pass was
                                frozen/merged (str).
  CULTURE_BANK_QUESTION_COUNT — prod-verified exact question count (int).

These were recorded as the frozen bank version/date + count when WEDGE-02's
topic-tagging pass merged. WEDGE-05 (a separate, later story) ultimately
computes its "bank v<date>, <count> questions" honest-coverage chip from
LIVE COUNT(*)/MAX(updated_at) reads instead (see CultureCoverageService),
NOT from these constants — they are not imported by WEDGE-05 and exist here
purely as the historical WEDGE-02 record. No endpoint/DTO/migration is added
here (D-A7: a metadata table was explicitly rejected as heavier and dragging
in exactly the schema/read surface the WEDGE-02 story's Out-of-Scope section
forbids).

CULTURE_BANK_QUESTION_COUNT was prod-verified against the live database on
2026-07-10 (exactly 490 rows).
"""

from __future__ import annotations

CULTURE_BANK_VERSION: str = "2026-07-10"
CULTURE_BANK_QUESTION_COUNT: int = 490
