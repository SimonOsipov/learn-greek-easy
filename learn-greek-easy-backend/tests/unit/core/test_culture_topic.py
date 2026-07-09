"""RED tests for WEDGE-01-01: CultureTopic taxonomy constant.

Mode A — authored RED before implementation (RALPH Stage 2.5 / QA Mode A).

``CultureTopic`` does NOT exist yet in ``src/core/culture_topic.py``. Every
test that references it is expected to fail with ``ImportError`` /
``ModuleNotFoundError`` at collection time UNLESS the executor creates a stub
module first — see "Expected RED Failure Mode" below (pattern mirrors
``tests/unit/core/test_exercise_topic.py``).

The preferred executor pattern is:
  1. Create ``src/core/culture_topic.py`` with the ``CultureTopic(str, enum.Enum)``
     class carrying exactly the five lowercase values and a ``__str__`` override.
  2. These tests then run against the real enum and pass.

If the executor has not created the module yet, the guarded import below keeps
``pytest --collect-only`` succeeding; running the tests raises ImportError
inside each test body (a legitimate RED reason: the feature is absent).

Acceptance Criteria covered (WEDGE-01-01 / Core AC1):
  Core AC1  ``CultureTopic`` is the single, canonical five-value topic taxonomy
            (history, geography, politics, culture, practical) — no parallel
            taxonomy may exist, and ``str(topic)`` serializes to the bare
            lowercase value (matching how ``deck.category`` is stored).
"""

try:
    from src.core.culture_topic import CultureTopic

    _IMPORT_OK = True
except (ImportError, ModuleNotFoundError):
    # Module doesn't exist yet — tests will re-raise the ImportError at call
    # time so pytest reports them as errors, not "passed".
    _IMPORT_OK = False
    CultureTopic = None  # type: ignore[assignment,misc]


def _require_culture_topic() -> None:
    """Raise ImportError if the module is missing, so tests fail for the right reason."""
    if not _IMPORT_OK:
        raise ImportError(
            "src.core.culture_topic module does not exist yet. "
            "Executor must create it as part of WEDGE-01-01."
        )


EXPECTED_VALUES = {"history", "geography", "politics", "culture", "practical"}


# ===========================================================================
# Core AC1 — CultureTopic is the single, canonical five-value taxonomy
# ===========================================================================


class TestCultureTopicValuesExact:
    """Anti-drift guard: exactly the five expected lowercase values, no more, no fewer."""

    def test_culture_topic_values_exact(self) -> None:
        """GIVEN the CultureTopic enum
        WHEN  collecting every member's .value
        THEN  the set is EXACTLY {history, geography, politics, culture, practical}
              and there are exactly 5 members.

        This is the no-parallel-taxonomy guard (Core AC1): it must fail if a
        sixth value is added, or if any expected value is missing or renamed.

        RED reason: CultureTopic does not exist yet.
        """
        _require_culture_topic()
        actual_values = {t.value for t in CultureTopic}
        assert actual_values == EXPECTED_VALUES, (
            f"CultureTopic values drifted from the canonical taxonomy. "
            f"Expected {EXPECTED_VALUES}, got {actual_values}"
        )
        assert (
            len(CultureTopic) == 5
        ), f"Expected exactly 5 CultureTopic members, got {len(CultureTopic)}"


class TestCultureTopicStrIsBareValue:
    """str(topic) must serialize to the bare value, not the enum repr."""

    def test_culture_topic_str_is_bare_value(self) -> None:
        """GIVEN CultureTopic.HISTORY
        WHEN  calling str() on it
        THEN  the result is the bare value "history", NOT "CultureTopic.HISTORY".

        Guards the __str__ override (Core AC1): CultureTopic must serialize to
        the bare value, matching how deck.category is stored in the DB.

        RED reason: CultureTopic does not exist yet.
        """
        _require_culture_topic()
        assert str(CultureTopic.HISTORY) == "history", (
            f"Expected str(CultureTopic.HISTORY) == 'history', got {str(CultureTopic.HISTORY)!r}. "
            "CultureTopic must override __str__ to return self.value."
        )


class TestCultureTopicIsLowercaseStrEnum:
    """Every member must be a str instance with a lowercase value."""

    def test_culture_topic_is_lowercase_str_enum(self) -> None:
        """GIVEN every member of CultureTopic
        WHEN  checking its type and value casing
        THEN  each member is a str instance AND its value is already lowercase.

        Guards the lowercase str-enum convention shared with ExerciseTopic-style
        taxonomies in this codebase.

        RED reason: CultureTopic does not exist yet.
        """
        _require_culture_topic()
        for member in CultureTopic:
            assert isinstance(member, str), f"{member!r} is not a str instance"
            assert (
                member.value == member.value.lower()
            ), f"{member!r} has a non-lowercase value: {member.value!r}"
