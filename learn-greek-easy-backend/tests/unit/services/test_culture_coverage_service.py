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


# ---------------------------------------------------------------------------
# QA (Mode B) adversarial additions -- boundary/absence cases the Mode A
# RED spec didn't cover.
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_compute_thin_flags_absent_canonical_topic_is_thin() -> None:
    """A canonical topic entirely absent from the bank (count 0) while
    siblings are populated is maximally thin: 0 < 0.5 * best whenever
    best > 0. This is the real shape `get_coverage` produces for a
    never-tagged topic -- it seeds `per_topic` with 0 for all 5 canonical
    topics up front, so an absent topic reaches `_compute_thin_flags` as an
    explicit 0, not a missing key."""
    counts = {
        "history": 0,
        "geography": 40,
        "politics": 40,
        "culture": 40,
        "practical": 40,
    }

    result = CultureCoverageService._compute_thin_flags(counts)

    assert result["history"] is True
    assert result == {
        "history": True,
        "geography": False,
        "politics": False,
        "culture": False,
        "practical": False,
    }


@pytest.mark.unit
def test_compute_thin_flags_single_populated_topic() -> None:
    """Only one topic has any questions (best = that topic's count, every
    other canonical topic is 0). The populated topic is best-stocked so it
    can never be thin; every 0-count topic is strictly below half of a
    positive best, so all four are thin."""
    counts = {
        "history": 0,
        "geography": 0,
        "politics": 10,
        "culture": 0,
        "practical": 0,
    }

    result = CultureCoverageService._compute_thin_flags(counts)

    assert result == {
        "history": True,
        "geography": True,
        "politics": False,
        "culture": True,
        "practical": True,
    }


@pytest.mark.unit
def test_compute_thin_flags_one_below_vs_at_threshold() -> None:
    """best=100 -> threshold 50 (strict <). A topic at 49 is thin (49 < 50);
    a topic at exactly 50 is NOT thin (50 is not < 50) -- pins the exact
    off-by-one boundary distinct from the existing exactly-half test, which
    uses a single count (50) equal to the threshold for every non-best
    topic. Here the two boundary-adjacent counts are asserted side by side
    in the same call so a `<=` regression (already caught by the existing
    boundary test) and an off-by-one on the *other* side (e.g. `< best -
    50` instead of `< 0.5 * best`) would both be caught."""
    counts = {
        "history": 100,
        "geography": 49,
        "politics": 50,
        "culture": 100,
        "practical": 100,
    }

    result = CultureCoverageService._compute_thin_flags(counts)

    assert result["geography"] is True  # 49 < 50
    assert result["politics"] is False  # 50 is not < 50
