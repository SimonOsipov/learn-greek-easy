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

import pytest

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


# ===========================================================================
# Adversarial / edge coverage — added QA Mode B (post-implementation)
# ===========================================================================
#
# The three suites above are the AC-derived RED specs authored in Mode A.
# They are left untouched. Everything below is additional coverage QA added
# while verifying the (now green) implementation.


class TestCultureTopicRoundTripFromString:
    """CultureTopic(value) must round-trip back to the matching member.

    WEDGE-02 will likely construct ``CultureTopic(deck.category)`` directly
    from the DB string column. If value-based construction doesn't resolve
    to the identical enum member, the taxonomy isn't usable as intended.
    """

    @pytest.mark.parametrize(
        ("raw_value", "expected_member"),
        [
            ("history", "HISTORY"),
            ("geography", "GEOGRAPHY"),
            ("politics", "POLITICS"),
            ("culture", "CULTURE"),
            ("practical", "PRACTICAL"),
        ],
    )
    def test_value_construction_round_trips_to_member(
        self, raw_value: str, expected_member: str
    ) -> None:
        _require_culture_topic()
        constructed = CultureTopic(raw_value)
        assert constructed is getattr(CultureTopic, expected_member), (
            f"CultureTopic({raw_value!r}) did not round-trip to "
            f"CultureTopic.{expected_member}; got {constructed!r}"
        )


class TestCultureTopicNoDuplicateValues:
    """No two members may share a value (would silently alias in Python enums)."""

    def test_no_duplicate_or_aliased_values(self) -> None:
        _require_culture_topic()
        assert len(CultureTopic) == 5, (
            f"Expected exactly 5 distinct CultureTopic members, got {len(CultureTopic)}. "
            "A duplicate value would silently alias to an existing member and shrink "
            "the iteration count below the number of declared members."
        )
        distinct_values = {member.value for member in CultureTopic}
        assert len(distinct_values) == 5, (
            f"Expected 5 distinct .value strings, got {len(distinct_values)}: "
            f"{distinct_values}. A typo could create two members with the same value."
        )


class TestCultureTopicUnknownValueRaises:
    """Constructing from a value outside the closed set must raise ValueError."""

    def test_excluded_seed_key_raises_value_error(self) -> None:
        """'traditions' is the deliberately-excluded seed category (Architect D3):
        it exists in the raw culture-deck seed vocabulary but must NOT be a
        valid CultureTopic member."""
        _require_culture_topic()
        with pytest.raises(ValueError):
            CultureTopic("traditions")

    def test_excluded_seed_key_news_raises_value_error(self) -> None:
        """'news' is likewise present in the broader seed/category vocabulary
        (src/schemas/culture.py) but excluded from the closed CultureTopic set."""
        _require_culture_topic()
        with pytest.raises(ValueError):
            CultureTopic("news")

    def test_wrong_case_raises_value_error(self) -> None:
        """CultureTopic is a closed, lowercase-only set: title-casing a valid
        value must NOT resolve — construction is case-sensitive."""
        _require_culture_topic()
        with pytest.raises(ValueError):
            CultureTopic("History")

    def test_empty_string_raises_value_error(self) -> None:
        _require_culture_topic()
        with pytest.raises(ValueError):
            CultureTopic("")


class TestCultureTopicStrEquality:
    """str-enum equality must hold for f-string interpolation and direct
    string comparison, so a future `topic == deck.category` compare works."""

    def test_fstring_interpolation_is_bare_value(self) -> None:
        _require_culture_topic()
        assert (
            f"{CultureTopic.CULTURE}" == "culture"
        ), f"f-string interpolation of CultureTopic.CULTURE was {f'{CultureTopic.CULTURE}'!r}"

    def test_equality_against_plain_string(self) -> None:
        _require_culture_topic()
        assert (
            CultureTopic.CULTURE == "culture"
        ), "CultureTopic.CULTURE must compare equal to the plain string 'culture' (str-enum)"
        assert (
            CultureTopic.CULTURE != "practical"
        ), "CultureTopic.CULTURE must not compare equal to an unrelated value"
