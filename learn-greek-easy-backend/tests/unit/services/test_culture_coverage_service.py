"""Mode A RED tests for WEDGE-05-01: CultureCoverageService._compute_thin_flags.

Pure unit tests -- no DB, no async fixtures. Mirrors the shape of
tests/unit/services/test_dashboard_derivations.py: call the pure staticmethod
directly with a plain dict, assert on its return value.

RED reason: `_compute_thin_flags` currently unconditionally raises
NotImplementedError (src/services/culture_coverage_service.py), so every
test below fails on that exception -- not an import/collection error --
until the WEDGE-05-01 executor implements the real thin rule:
    best = max(per_topic.values())
    thin(t) = count[t] < 0.5 * best when best > 0 else False
(strict `<`: a topic at exactly 0.5 * best is NOT thin).
"""

from __future__ import annotations

import pytest

from src.services.culture_coverage_service import CultureCoverageService

_CANONICAL_TOPICS = ("history", "geography", "politics", "culture", "practical")


@pytest.mark.unit
def test_compute_thin_flags_marks_below_half_best() -> None:
    """WEDGE-02's real prod distribution: best = politics (146) -> threshold
    73 (strict <). history (57) and geography (69) are below threshold;
    culture (99) and practical (119) are not, and politics is the best
    itself so it can never be thin."""
    counts = {
        "history": 57,
        "geography": 69,
        "politics": 146,
        "culture": 99,
        "practical": 119,
    }

    result = CultureCoverageService._compute_thin_flags(counts)

    assert result == {
        "history": True,  # 57 < 73
        "geography": True,  # 69 < 73
        "politics": False,  # 146 == best
        "culture": False,  # 99 >= 73
        "practical": False,  # 119 >= 73
    }


@pytest.mark.unit
def test_compute_thin_flags_boundary_exactly_half_not_thin() -> None:
    """A topic whose count is EXACTLY 0.5 * best is NOT thin -- the rule is
    strict `<`, not `<=`. best=100 -> threshold 50; geography sits exactly
    at 50 and must report thin=False."""
    counts = {
        "history": 100,
        "geography": 50,
        "politics": 100,
        "culture": 100,
        "practical": 100,
    }

    result = CultureCoverageService._compute_thin_flags(counts)

    assert result["geography"] is False
    assert result == {topic: False for topic in _CANONICAL_TOPICS}


@pytest.mark.unit
def test_compute_thin_flags_all_equal_none_thin() -> None:
    """When every topic has the same count, best == every count, so no
    topic can be strictly below 0.5 * best -- all report thin=False."""
    counts = {topic: 40 for topic in _CANONICAL_TOPICS}

    result = CultureCoverageService._compute_thin_flags(counts)

    assert result == {topic: False for topic in _CANONICAL_TOPICS}


@pytest.mark.unit
def test_compute_thin_flags_empty_bank_none_thin() -> None:
    """An entirely empty bank (all counts 0, best=0) must not raise
    ZeroDivisionError and must report every topic as thin=False (the
    `best > 0` guard short-circuits the 0.5 * best comparison)."""
    counts = {topic: 0 for topic in _CANONICAL_TOPICS}

    result = CultureCoverageService._compute_thin_flags(counts)

    assert result == {topic: False for topic in _CANONICAL_TOPICS}
