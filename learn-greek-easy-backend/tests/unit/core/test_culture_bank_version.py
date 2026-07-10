"""Tests for WEDGE-02-04: culture bank version/date constant module.

Cheap regression guard for ``src/core/culture_bank_version.py`` (test-first:
no — a bare constant module with no branching logic, D-A7). Confirms the two
module-level constants WEDGE-05 will read for its "bank v<date>, <count>
questions" coverage chip are importable and shaped correctly.
"""

from __future__ import annotations

import re

from src.core.culture_bank_version import (
    CULTURE_BANK_QUESTION_COUNT,
    CULTURE_BANK_VERSION,
)

_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def test_culture_bank_version_is_iso_date_string() -> None:
    assert isinstance(CULTURE_BANK_VERSION, str)
    assert _ISO_DATE_RE.match(
        CULTURE_BANK_VERSION
    ), f"CULTURE_BANK_VERSION {CULTURE_BANK_VERSION!r} is not an ISO date (YYYY-MM-DD)"


def test_culture_bank_question_count_is_prod_verified_490() -> None:
    assert isinstance(CULTURE_BANK_QUESTION_COUNT, int)
    assert CULTURE_BANK_QUESTION_COUNT == 490
