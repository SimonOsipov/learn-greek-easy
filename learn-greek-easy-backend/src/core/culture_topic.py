"""Canonical thematic-subject taxonomy for culture-exam questions (WEDGE-01).

Public surface:
  CultureTopic — str-enum of the five canonical thematic subjects

Mirrors the five thematic deck categories (history, geography, politics,
culture, practical). This is a pure, inert constant: it is not wired into
any model, schema, or endpoint by this subtask.
"""

from __future__ import annotations

import enum


class CultureTopic(str, enum.Enum):
    """Canonical thematic-subject taxonomy for culture-exam questions (WEDGE-01)."""

    HISTORY = "history"
    GEOGRAPHY = "geography"
    POLITICS = "politics"
    CULTURE = "culture"
    PRACTICAL = "practical"

    def __str__(self) -> str:  # str(CultureTopic.HISTORY) == "history", not the repr
        return self.value
