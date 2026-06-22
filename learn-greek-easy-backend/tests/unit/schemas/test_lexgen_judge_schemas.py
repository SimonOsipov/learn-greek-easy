"""Unit tests for LEXGEN judge rubric schemas (LEXGEN-11-01).

RED-phase acceptance-criteria tests authored test-first (Mode A). They target
``src/schemas/lexgen.py`` additions that do NOT exist yet:
- ``JudgeRubric``
- ``JudgeBlockingIssue``
- ``JUDGE_RUBRIC_DIMENSIONS``
- ``_JUDGE_CRITIQUEABLE_FIELDS``

The deferred-import pattern is used throughout: ``GeneratedLexContent`` (already
in the module) is safe to import at module level, but the new symbols are
imported inside each test function via helpers (below) so the file COLLECTS
cleanly and every test fails with ImportError/AttributeError at runtime — the
correct not-implemented RED signal, NOT a collection error.
"""

import pytest
from pydantic import ValidationError

# ---------------------------------------------------------------------------
# Deferred-import helpers — one per new symbol.
#
# Importing inside a function body rather than at module level ensures that a
# missing class raises ImportError INSIDE the test (runtime failure), not at
# collection time (which would abort the whole file).  The ``# noqa: PLC0415``
# suppresses the "import not at top of file" lint rule that is intentionally
# violated here by design.
# ---------------------------------------------------------------------------


def _get_judge_rubric():
    """Deferred import of JudgeRubric.

    Raises ImportError if the class does not exist yet — that IS the expected
    RED failure mode for LEXGEN-11-01 Mode A tests.
    """
    from src.schemas.lexgen import JudgeRubric  # noqa: PLC0415

    return JudgeRubric


def _get_judge_blocking_issue():
    """Deferred import of JudgeBlockingIssue."""
    from src.schemas.lexgen import JudgeBlockingIssue  # noqa: PLC0415

    return JudgeBlockingIssue


def _get_judge_rubric_dimensions():
    """Deferred import of JUDGE_RUBRIC_DIMENSIONS."""
    from src.schemas.lexgen import JUDGE_RUBRIC_DIMENSIONS  # noqa: PLC0415

    return JUDGE_RUBRIC_DIMENSIONS


# ---------------------------------------------------------------------------
# Canonical payloads used across tests.
# ---------------------------------------------------------------------------

_VALID_RUBRIC_PAYLOAD: dict = {
    "naturalness": 4,
    "sense_fit": 3,
    "translation_faith_en": 5,
    "translation_faith_ru": 4,
    "a2_appropriateness": 3,
    "blocking_issues": [
        {"field": "example_greek", "issue": "Sentence uses out-of-scope vocabulary."}
    ],
}

_VALID_RUBRIC_NO_ISSUES: dict = {
    "naturalness": 4,
    "sense_fit": 3,
    "translation_faith_en": 5,
    "translation_faith_ru": 4,
    "a2_appropriateness": 3,
}


# ---------------------------------------------------------------------------
# AC-1 — JudgeRubric structure: five int dimensions + blocking_issues list.
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestJudgeRubricAcceptsValid:
    """AC-1: a complete valid payload constructs successfully."""

    def test_judge_rubric_accepts_valid_payload(self):
        """AC-1: five int dimensions + one blocking_issues entry → model constructed.

        GIVEN  a dict with all five dimension fields in [1, 5] and one valid
               blocking_issues entry with field="example_greek"
        WHEN   JudgeRubric.model_validate(payload)
        THEN   returns a model with those exact values; blocking_issues has
               one entry whose .field is "example_greek"
        """
        JudgeRubric = _get_judge_rubric()
        model = JudgeRubric.model_validate(_VALID_RUBRIC_PAYLOAD)
        assert model.naturalness == 4
        assert model.sense_fit == 3
        assert model.translation_faith_en == 5
        assert model.translation_faith_ru == 4
        assert model.a2_appropriateness == 3
        assert len(model.blocking_issues) == 1
        assert model.blocking_issues[0].field == "example_greek"

    def test_judge_rubric_rejects_extra_key(self):
        """AC-1: extra="forbid" must reject an unknown key alongside valid ones.

        GIVEN  a valid payload plus "overall_score": 4
        WHEN   JudgeRubric.model_validate(payload)
        THEN   raises ValidationError (extra field forbidden)

        This guards the cardinal invariant: the LLM cannot smuggle in an
        extra overall_score or any other un-declared field.
        """
        JudgeRubric = _get_judge_rubric()
        bad = {**_VALID_RUBRIC_NO_ISSUES, "overall_score": 4}
        with pytest.raises(ValidationError):
            JudgeRubric.model_validate(bad)


# ---------------------------------------------------------------------------
# AC-2 — Each dimension is an int in [1, 5] (ge=1, le=5).
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestRubricDimensionRange:
    """AC-2: each dimension field enforces ge=1, le=5."""

    @pytest.mark.parametrize("out_of_range_value", [0, 6])
    def test_rubric_dimension_out_of_range_rejected(self, out_of_range_value: int):
        """AC-2: naturalness outside [1, 5] raises ValidationError.

        GIVEN  a payload where naturalness is 0 (below ge=1) or 6 (above le=5)
        WHEN   JudgeRubric.model_validate(payload)
        THEN   raises ValidationError

        Parametrized for 0 and 6 — the two canonical boundary violations.
        """
        JudgeRubric = _get_judge_rubric()
        bad = {**_VALID_RUBRIC_NO_ISSUES, "naturalness": out_of_range_value}
        with pytest.raises(ValidationError):
            JudgeRubric.model_validate(bad)


# ---------------------------------------------------------------------------
# AC-3 — JudgeBlockingIssue: field + issue required; field closed vocabulary.
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestJudgeBlockingIssueRequiredFields:
    """AC-3: JudgeBlockingIssue requires both field and issue."""

    def test_blocking_issue_requires_field_and_issue(self):
        """AC-3: omitting "field" from JudgeBlockingIssue payload raises.

        GIVEN  {"issue": "x"} (no "field" key)
        WHEN   JudgeBlockingIssue.model_validate(payload)
        THEN   raises ValidationError (missing required field)
        """
        JudgeBlockingIssue = _get_judge_blocking_issue()
        with pytest.raises(ValidationError):
            JudgeBlockingIssue.model_validate({"issue": "x"})


@pytest.mark.unit
class TestJudgeBlockingIssueClosedVocabulary:
    """AC-3: JudgeBlockingIssue.field must be one of the four content fields."""

    def test_blocking_issue_field_must_be_content_field(self):
        """AC-3: a morphology field ("gender") is rejected; a content field is accepted.

        GIVEN (A) {"field": "gender", "issue": "x"}
        WHEN   JudgeBlockingIssue.model_validate(payload_A)
        THEN   raises ValidationError ("gender" is not in _JUDGE_CRITIQUEABLE_FIELDS)

        GIVEN (B) {"field": "example_greek", "issue": "x"}
        WHEN   JudgeBlockingIssue.model_validate(payload_B)
        THEN   constructs successfully; .field == "example_greek"
        """
        JudgeBlockingIssue = _get_judge_blocking_issue()

        # Morphology field must be rejected.
        with pytest.raises(ValidationError):
            JudgeBlockingIssue.model_validate({"field": "gender", "issue": "x"})

        # Content field must be accepted.
        issue = JudgeBlockingIssue.model_validate({"field": "example_greek", "issue": "x"})
        assert issue.field == "example_greek"


# ---------------------------------------------------------------------------
# AC-4 — JUDGE_RUBRIC_DIMENSIONS constant covers exactly the five names.
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestJudgeRubricDimensionsConstant:
    """AC-4: JUDGE_RUBRIC_DIMENSIONS is exactly the five declared dimension names."""

    def test_rubric_dimensions_constant_exact(self):
        """AC-4: set(JUDGE_RUBRIC_DIMENSIONS) equals the five-name set precisely.

        GIVEN  the JUDGE_RUBRIC_DIMENSIONS constant
        WHEN   convert to set
        THEN   == {"naturalness", "sense_fit", "translation_faith_en",
                   "translation_faith_ru", "a2_appropriateness"}
               (exactly five; no more, no less)
        """
        JUDGE_RUBRIC_DIMENSIONS = _get_judge_rubric_dimensions()
        expected = {
            "naturalness",
            "sense_fit",
            "translation_faith_en",
            "translation_faith_ru",
            "a2_appropriateness",
        }
        assert set(JUDGE_RUBRIC_DIMENSIONS) == expected
        assert len(set(JUDGE_RUBRIC_DIMENSIONS)) == 5
