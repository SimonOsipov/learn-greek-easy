"""Frozen reviewed-fixture scaffold for the 19 no-twin exam-paper residue rows.

WEDGE-02-01 (D-A11): of the 113 past-exam-paper question copies, 94 have
exactly one clean thematic twin (inherited deterministically by the engine's
Pass 2) and 19 have no thematic twin at all. Rather than blind-defaulting
those 19 to ``culture`` (which would silently mis-tag any that are really
history/geography/politics/practical), they are captured as a small,
checked-in, FROZEN judgment fixture — assigned by Claude reading the real
question content from prod (a one-time, human-authorized read), each with a
one-line rationale.

``ReviewedTopic`` is the injectable per-entry type. ``RESIDUE_TOPIC_FIXTURE``
is the checked-in dict, keyed on ``normalize_twin_key``-form question text.

This module is a REAL, working scaffold — not a stub. ``RESIDUE_TOPIC_FIXTURE``
is intentionally EMPTY here: WEDGE-02-02 populates it with the 19 real
entries. The two-pass engine's ``reviewed_fixture`` parameter is injectable
specifically so this subtask's tests never depend on the real 19 rows — see
``tests/integration/services/test_culture_topic_tagger.py``, which injects
small synthetic fixtures instead.
"""

from __future__ import annotations

from typing import NamedTuple

from src.core.culture_topic import CultureTopic


class ReviewedTopic(NamedTuple):
    """One frozen judgment entry: the assigned topic + a one-line rationale."""

    topic: CultureTopic
    rationale: str


RESIDUE_TOPIC_FIXTURE: dict[str, ReviewedTopic] = {}
