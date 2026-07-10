"""Tests for WEDGE-02-02: structural invariants of the 19-row reviewed fixture.

``RESIDUE_TOPIC_FIXTURE`` (``src/core/culture_topic_reviewed_fixture.py``) is
the frozen, checked-in judgment artifact for the 19 no-twin exam-paper
residue questions (see story's "Verified prod partition" table and D-A11).
These tests assert the STRUCTURE of the fixture, not the content of any
individual rationale — the rationale text is Claude's reviewed judgment from
an authorized one-time prod content read, not test-derived.

RED now (WEDGE-02-02, pre-population): ``RESIDUE_TOPIC_FIXTURE`` is still the
empty ``{}`` scaffolded by WEDGE-02-01, so every test below fails on a clean
assertion (e.g. ``len == 0 != 19``), not an import/collection error.

Acceptance Criteria covered (WEDGE-02-02, per the architect's Test Specs
table — task-1292):
  AC3/D-A11  Exactly 19 entries (the verified residue count).
  AC1        Every assigned topic is a CultureTopic member (closed set).
  AC3        Every key is already in normalize_twin_key form, so the
             engine's Pass-2 fixture lookup matches it directly.
  AC4        Every entry has a non-empty one-line rationale.
  D-A11      The 19 keys are distinct (no residue row collides with another).
"""

from __future__ import annotations

from src.core.culture_topic import CultureTopic
from src.core.culture_topic_mapping import normalize_twin_key
from src.core.culture_topic_reviewed_fixture import RESIDUE_TOPIC_FIXTURE

EXPECTED_RESIDUE_COUNT = 19

# ===========================================================================
# AC3/D-A11 — test_reviewed_fixture_has_19_entries
# ===========================================================================


class TestReviewedFixtureHas19Entries:
    def test_reviewed_fixture_has_19_entries(self) -> None:
        # AC3/D-A11 (WEDGE-02-02 Test Specs) — the verified residue count.
        assert len(RESIDUE_TOPIC_FIXTURE) == EXPECTED_RESIDUE_COUNT


# ===========================================================================
# AC1 — test_fixture_topics_in_closed_set
# ===========================================================================


class TestFixtureTopicsInClosedSet:
    def test_fixture_topics_in_closed_set(self) -> None:
        # AC1 (WEDGE-02-02 Test Specs) — every entry's topic is a real
        # CultureTopic member, not a raw string that happens to match a
        # member's value.
        assert (
            len(RESIDUE_TOPIC_FIXTURE) > 0
        ), "fixture is empty — nothing to check yet (expected pre-population)"
        for key, entry in RESIDUE_TOPIC_FIXTURE.items():
            assert isinstance(entry.topic, CultureTopic), (
                f"entry for key {key!r} has topic {entry.topic!r} which is not "
                "a CultureTopic member"
            )


# ===========================================================================
# AC3 — test_fixture_keys_are_normalized
# ===========================================================================


class TestFixtureKeysAreNormalized:
    def test_fixture_keys_are_normalized(self) -> None:
        # AC3 (WEDGE-02-02 Test Specs) — keys are already normalize_twin_key
        # output, so the engine's Pass-2 fixture lookup matches them directly
        # (idempotent under normalization).
        assert (
            len(RESIDUE_TOPIC_FIXTURE) > 0
        ), "fixture is empty — nothing to check yet (expected pre-population)"
        for key in RESIDUE_TOPIC_FIXTURE:
            assert normalize_twin_key({"el": key}) == key, (
                f"key {key!r} is not already in normalize_twin_key form "
                f"(got {normalize_twin_key({'el': key})!r})"
            )


# ===========================================================================
# AC4 — test_fixture_entries_have_rationale
# ===========================================================================


class TestFixtureEntriesHaveRationale:
    def test_fixture_entries_have_rationale(self) -> None:
        # AC4 (WEDGE-02-02 Test Specs) — every entry's rationale is a
        # non-empty (post-strip) string, positively checked (not just
        # "not falsy") to guard against a rationale of stray whitespace.
        assert (
            len(RESIDUE_TOPIC_FIXTURE) > 0
        ), "fixture is empty — nothing to check yet (expected pre-population)"
        for key, entry in RESIDUE_TOPIC_FIXTURE.items():
            assert isinstance(
                entry.rationale, str
            ), f"entry for key {key!r} has non-string rationale {entry.rationale!r}"
            assert (
                len(entry.rationale.strip()) > 0
            ), f"entry for key {key!r} has an empty (or whitespace-only) rationale"


# ===========================================================================
# D-A11 — test_fixture_keys_are_distinct
# ===========================================================================


class TestFixtureKeysAreDistinct:
    def test_fixture_keys_are_distinct(self) -> None:
        # D-A11 (WEDGE-02-02 Test Specs) — the 19 keys are 19 distinct
        # normalized strings; a dict enforces uniqueness structurally, but
        # this pins the *count* of unique keys to the expected residue count
        # (guards against accidental collision silently shrinking the dict
        # below 19 at authoring time).
        keys = list(RESIDUE_TOPIC_FIXTURE.keys())
        assert len(keys) == len(set(keys)) == EXPECTED_RESIDUE_COUNT
