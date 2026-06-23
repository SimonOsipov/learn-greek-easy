"""RED tests for SIT-27-03: deterministic exercise topic taxonomy.

Mode A — authored RED before implementation (RALPH Stage 2.5 / QA Mode A).

The function ``derive_exercise_topic(source_type, modality)`` does NOT exist yet
in ``src/core/exercise_topic.py``.  Every test that calls it is expected to fail
with ``ImportError`` / ``ModuleNotFoundError`` at collection time UNLESS the
executor creates a stub module first — see "Expected RED Failure Mode" below.

The preferred executor pattern (matches ``test_lexgen_rules.py`` precedent) is:
  1. Create ``src/core/exercise_topic.py`` with the ``derive_exercise_topic``
     function signature and ``ExerciseTopic`` enum stub (raises
     ``NotImplementedError`` in the body).
  2. The tests then fail with ``NotImplementedError`` (correct reason) rather
     than ``ImportError`` (wrong reason).

If the executor skips the stub, pytest --collect-only will still succeed because
the import is guarded with a try/except inside _import_under_test() below, which
means collect-only never fails; running tests will raise ImportError (also a
legit red reason, just less precise than NotImplementedError).

Acceptance Criteria covered (SIT-27-03):
  AC-1  A pure function maps every (source_type, modality) combination to exactly
        one of the four topics, with listening taking priority.
  AC-2  Each exercise item in the exercises API carries its derived ``topic``.
  AC-3  The exercises API response includes per-topic counts.

AC-1 (pure function) is fully covered here. AC-2 + AC-3 are API-level and live
in ``tests/unit/api/v1/test_situation_exercises_topic.py``.

Topic derivation rule (Decision #4 in SIT-27 architecture doc):
  1. modality == LISTENING                             → "Listening"
  2. else source_type == DIALOG                        → "Dialogue"
  3. else source_type == PICTURE                       → "Visual"
  4. else (source_type in {DESCRIPTION, WORD_ORDER})   → "Reading"

Modality READING is the only non-LISTENING value for ExerciseModality, so rules
2-4 only apply when modality == READING.
"""

from src.db.models import ExerciseModality, ExerciseSourceType

# ---------------------------------------------------------------------------
# Target import — guarded so that --collect-only passes even before executor
# creates the module.  Running tests will fail with the right error.
# ---------------------------------------------------------------------------

try:
    from src.core.exercise_topic import ExerciseTopic, derive_exercise_topic

    _IMPORT_OK = True
except (ImportError, ModuleNotFoundError):
    # Module doesn't exist yet — tests will re-raise the ImportError at call
    # time so pytest reports them as errors, not "passed".
    _IMPORT_OK = False
    ExerciseTopic = None  # type: ignore[assignment,misc]
    derive_exercise_topic = None  # type: ignore[assignment]


def _call_derive(source_type: ExerciseSourceType, modality: ExerciseModality):
    """Call derive_exercise_topic, raising ImportError if module is missing."""
    if not _IMPORT_OK:
        raise ImportError(
            "src.core.exercise_topic module does not exist yet. "
            "Executor must create it as part of SIT-27-03."
        )
    return derive_exercise_topic(source_type, modality)  # type: ignore[misc]


# ===========================================================================
# AC-1 — Deterministic topic derivation
# ===========================================================================


class TestTopicDerivationListeningPriority:
    """Listening modality takes priority over source_type (AC-1, row 1)."""

    def test_topic_listening_priority_over_dialog_source(self) -> None:
        """GIVEN source_type=DIALOG, modality=LISTENING
        WHEN  derive_exercise_topic()
        THEN  topic == "Listening"  (modality wins over source-type).

        RED reason: derive_exercise_topic does not exist yet.
        """
        result = _call_derive(ExerciseSourceType.DIALOG, ExerciseModality.LISTENING)
        assert str(result) in (
            "Listening",
            "ExerciseTopic.LISTENING",
        ), f"Expected Listening, got {result!r}"

    def test_topic_listening_priority_over_description_source(self) -> None:
        """GIVEN source_type=DESCRIPTION, modality=LISTENING
        WHEN  derive_exercise_topic()
        THEN  topic == "Listening".
        """
        result = _call_derive(ExerciseSourceType.DESCRIPTION, ExerciseModality.LISTENING)
        assert str(result) in (
            "Listening",
            "ExerciseTopic.LISTENING",
        ), f"Expected Listening, got {result!r}"

    def test_topic_listening_priority_over_picture_source(self) -> None:
        """GIVEN source_type=PICTURE, modality=LISTENING
        WHEN  derive_exercise_topic()
        THEN  topic == "Listening" (not Visual).

        Edge case: picture exercises can theoretically have a listening modality
        (audio+image).  Listening still wins.
        """
        result = _call_derive(ExerciseSourceType.PICTURE, ExerciseModality.LISTENING)
        assert str(result) in (
            "Listening",
            "ExerciseTopic.LISTENING",
        ), f"Expected Listening, got {result!r}"

    def test_topic_listening_priority_over_word_order_source(self) -> None:
        """GIVEN source_type=WORD_ORDER, modality=LISTENING
        WHEN  derive_exercise_topic()
        THEN  topic == "Listening".
        """
        result = _call_derive(ExerciseSourceType.WORD_ORDER, ExerciseModality.LISTENING)
        assert str(result) in (
            "Listening",
            "ExerciseTopic.LISTENING",
        ), f"Expected Listening, got {result!r}"


class TestTopicDerivationDialogue:
    """Dialog source + reading modality → Dialogue (AC-1, row 2)."""

    def test_topic_dialog_reading_is_dialogue(self) -> None:
        """GIVEN source_type=DIALOG, modality=READING
        WHEN  derive_exercise_topic()
        THEN  topic == "Dialogue".

        RED reason: derive_exercise_topic does not exist yet.
        """
        result = _call_derive(ExerciseSourceType.DIALOG, ExerciseModality.READING)
        assert str(result) in (
            "Dialogue",
            "ExerciseTopic.DIALOGUE",
        ), f"Expected Dialogue, got {result!r}"


class TestTopicDerivationVisual:
    """Picture source + reading modality → Visual (AC-1, row 3)."""

    def test_topic_picture_is_visual(self) -> None:
        """GIVEN source_type=PICTURE, modality=READING
        WHEN  derive_exercise_topic()
        THEN  topic == "Visual".

        RED reason: derive_exercise_topic does not exist yet.
        """
        result = _call_derive(ExerciseSourceType.PICTURE, ExerciseModality.READING)
        assert str(result) in ("Visual", "ExerciseTopic.VISUAL"), f"Expected Visual, got {result!r}"


class TestTopicDerivationReading:
    """Description/word_order + reading modality → Reading (AC-1, rows 4-5)."""

    def test_topic_description_reading_is_reading(self) -> None:
        """GIVEN source_type=DESCRIPTION, modality=READING
        WHEN  derive_exercise_topic()
        THEN  topic == "Reading".

        RED reason: derive_exercise_topic does not exist yet.
        """
        result = _call_derive(ExerciseSourceType.DESCRIPTION, ExerciseModality.READING)
        assert str(result) in (
            "Reading",
            "ExerciseTopic.READING",
        ), f"Expected Reading, got {result!r}"

    def test_topic_word_order_reading_is_reading(self) -> None:
        """GIVEN source_type=WORD_ORDER, modality=READING
        WHEN  derive_exercise_topic()
        THEN  topic == "Reading".

        WORD_ORDER uses reading modality in practice (no audio); it is a text
        reordering exercise, so Reading is correct.

        RED reason: derive_exercise_topic does not exist yet.
        """
        result = _call_derive(ExerciseSourceType.WORD_ORDER, ExerciseModality.READING)
        assert str(result) in (
            "Reading",
            "ExerciseTopic.READING",
        ), f"Expected Reading, got {result!r}"


class TestTopicDerivationCoverage:
    """Exhaustive coverage: all 8 (source_type × modality) combos are mapped."""

    def test_all_combinations_return_a_topic(self) -> None:
        """Every valid (source_type, modality) pair maps to a non-None topic.

        This is an exhaustive smoke test over all 8 combinations.  If the
        executor adds a new source_type or modality enum member it will still
        be caught here as long as they appear in the model enums.
        """
        for source_type in ExerciseSourceType:
            for modality in ExerciseModality:
                result = _call_derive(source_type, modality)
                assert (
                    result is not None
                ), f"derive_exercise_topic({source_type!r}, {modality!r}) returned None"

    def test_derive_is_deterministic(self) -> None:
        """Same inputs always produce the same output (no randomness/state)."""
        inputs = (ExerciseSourceType.DESCRIPTION, ExerciseModality.LISTENING)
        first = _call_derive(*inputs)
        second = _call_derive(*inputs)
        assert first == second, "derive_exercise_topic must be deterministic"
