"""Unit tests for LEXGEN morphological form schemas (LEXGEN-02-01).

RED-phase acceptance-criteria tests authored test-first (Mode A). They target
``src/schemas/lexgen.py``, which currently ships a minimal non-functional STUB:
no ``min_length`` on ``form``, no features-key validator, and an empty
``FEATURE_KEYS``. The executor (Stage 3) makes these go green by adding the
real constraints. Imports resolve cleanly so the failures are assertion /
missing-ValidationError, NOT collection errors.
"""

import pytest
from pydantic import ValidationError

from src.schemas.lexgen import FEATURE_KEYS, FormBundle

# Canonical 10-key feature set per the architect's spec.
EXPECTED_FEATURE_KEYS = frozenset(
    {
        "case",
        "number",
        "gender",
        "person",
        "tense",
        "aspect",
        "mood",
        "verbform",
        "voice",
        "degree",
    }
)


@pytest.mark.unit
class TestFormBundle:
    """FormBundle construction, field constraints, and feature-key validation."""

    def test_formbundle_minimal_valid(self):
        """AC-1: a form string + valid features constructs and round-trips."""
        bundle = FormBundle(
            form="σπίτι",
            features={"case": "nominative", "number": "singular"},
        )
        assert bundle.form == "σπίτι"
        assert bundle.features == {"case": "nominative", "number": "singular"}

    def test_formbundle_empty_form_rejected(self):
        """AC-1: an empty form string must raise ValidationError (min_length=1)."""
        with pytest.raises(ValidationError):
            FormBundle(
                form="",
                features={"case": "nominative", "number": "singular"},
            )

    def test_unknown_feature_key_rejected(self):
        """AC-3: a features key not in FEATURE_KEYS must raise ValidationError."""
        with pytest.raises(ValidationError):
            FormBundle(form="σπίτι", features={"kase": "nominative"})


@pytest.mark.unit
class TestFeatureKeys:
    """FEATURE_KEYS is the canonical, exact 10-key set."""

    def test_feature_keys_exact_set(self):
        """AC-2: FEATURE_KEYS equals the exact 10-key frozenset."""
        assert FEATURE_KEYS == EXPECTED_FEATURE_KEYS


@pytest.mark.unit
class TestNounParadigm:
    """A noun paradigm is 8 FormBundles (nom/gen/acc/voc × sg/pl)."""

    def test_noun_paradigm_eight_cells(self):
        """AC-4: build the 8 declension cells with only case/number/gender keys."""
        cases = ["nominative", "genitive", "accusative", "vocative"]
        numbers = ["singular", "plural"]
        gender = "neuter"

        paradigm = [
            FormBundle(
                form=f"form-{case}-{number}",
                features={"case": case, "number": number, "gender": gender},
            )
            for number in numbers
            for case in cases
        ]

        # 8 cells total.
        assert len(paradigm) == 8

        allowed_keys = {"case", "number", "gender"}
        for cell in paradigm:
            # Every features key is one of the three paradigm keys.
            assert set(cell.features.keys()) <= allowed_keys
            # No flat/underscore-joined keys (e.g. "case_number").
            for key in cell.features:
                assert "_" not in key

    def test_noun_paradigm_features_round_trip_unchanged(self):
        """AC-4: feature VALUES are stored verbatim — no coercion/normalization.

        Pins that the validator only constrains keys; the upstream UD-canonical
        value strings survive construction byte-for-byte (so the LEXGEN-08 join
        contract maps a known input, not a silently-rewritten one).
        """
        features = {"case": "genitive", "number": "plural", "gender": "neuter"}
        bundle = FormBundle(form="σπιτιών", features=features)
        assert bundle.features == {
            "case": "genitive",
            "number": "plural",
            "gender": "neuter",
        }
        # Identity of values (not just equality of dicts).
        assert bundle.features["case"] == "genitive"
        assert bundle.features["number"] == "plural"
        assert bundle.features["gender"] == "neuter"


@pytest.mark.unit
class TestFeatureKeyValidationAdversarial:
    """Adversarial / edge / negative coverage for the feature-key validator.

    The AC tests cover the happy path + a single unknown key. These pin the
    boundary behaviors (empty dict, multiple unknowns, mixed valid/invalid,
    empty-string values) so a future tightening is a *conscious* contract change
    rather than a silent regression.
    """

    def test_empty_features_allowed(self):
        """A bare form with NO features constructs fine.

        The key-validator only rejects unknown KEYS; an empty dict has none, so
        it must pass (e.g. an uninflected/indeclinable surface form). Pins that
        the validator does not require any minimum number of features.
        """
        bundle = FormBundle(form="και", features={})
        assert bundle.features == {}
        assert bundle.form == "και"

    def test_multiple_unknown_keys_rejected_and_named(self):
        """All offending unknown keys are surfaced, not just the first.

        The validator diffs the whole key-set against FEATURE_KEYS, so the error
        message must name every offender (sorted) — important for a UI-edge dev
        debugging a flat-key leak.
        """
        with pytest.raises(ValidationError) as exc_info:
            FormBundle(
                form="σπίτι",
                features={"genitive_plural": "x", "kase": "y", "nummber": "z"},
            )
        message = str(exc_info.value)
        # Every offending key is named in the error.
        assert "genitive_plural" in message
        assert "kase" in message
        assert "nummber" in message

    def test_mixed_valid_and_invalid_key_rejected(self):
        """One valid key does NOT excuse a sibling invalid key.

        A dict with a legitimate "case" plus a bogus "tens" (typo of "tense")
        must still raise — the presence of any unknown key fails the whole bundle.
        """
        with pytest.raises(ValidationError) as exc_info:
            FormBundle(form="γράφω", features={"case": "nominative", "tens": "present"})
        message = str(exc_info.value)
        # The bogus key is named; the legitimate one is not flagged.
        assert "tens" in message

    def test_flat_underscore_key_rejected(self):
        """Seam #1: a flat UI-edge key (genitive_plural) is rejected internally.

        This is the explicit invariant the docstring calls out — flat,
        underscore-joined keys live only at the UI edge and never inside
        FormBundle.features. Direct negative proof of the boundary.
        """
        with pytest.raises(ValidationError):
            FormBundle(form="σπιτιών", features={"genitive_plural": "value"})

    def test_all_ten_feature_keys_accepted(self):
        """Every key in FEATURE_KEYS is individually accepted by the validator.

        Guards against an off-by-one between FEATURE_KEYS and the validator's
        membership check (e.g. a typo'd key in the frozenset would let a "valid"
        key through here while a real one is rejected).
        """
        all_keys_features = {key: "x" for key in FEATURE_KEYS}
        bundle = FormBundle(form="x", features=all_keys_features)
        assert set(bundle.features.keys()) == set(FEATURE_KEYS)

    def test_empty_string_value_currently_allowed(self):
        """CONTRACT PIN: a valid key with an empty-string VALUE is allowed today.

        Only keys are constrained; values are free strings with no min_length.
        ``{"case": ""}`` therefore constructs. This is pinned deliberately so a
        future decision to reject empty values is a conscious, test-breaking
        change — NOT a silent one. (See FINDINGS in the QA report.)
        """
        bundle = FormBundle(form="σπίτι", features={"case": ""})
        assert bundle.features == {"case": ""}


@pytest.mark.unit
class TestFeatureKeysImmutability:
    """FEATURE_KEYS is a genuinely immutable frozenset (not a mutable set)."""

    def test_feature_keys_is_frozenset(self):
        """AC-2: FEATURE_KEYS is a frozenset instance, not a plain set."""
        assert isinstance(FEATURE_KEYS, frozenset)

    def test_feature_keys_has_exactly_ten_keys(self):
        """AC-2: exactly 10 keys — no more, no less."""
        assert len(FEATURE_KEYS) == 10

    def test_feature_keys_cannot_be_mutated(self):
        """AC-2: a frozenset exposes no add/remove — mutation attempts raise."""
        with pytest.raises(AttributeError):
            FEATURE_KEYS.add("bogus")  # type: ignore[attr-defined]
        with pytest.raises(AttributeError):
            FEATURE_KEYS.discard("case")  # type: ignore[attr-defined]
        # The set is unchanged after the failed mutation attempts.
        assert len(FEATURE_KEYS) == 10


@pytest.mark.unit
class TestFormConstraintAdversarial:
    """Edge coverage for the ``form`` field constraint (AC-1)."""

    def test_whitespace_only_form_currently_accepted(self):
        """CONTRACT PIN + FINDING: a whitespace-only form ("   ") passes today.

        ``min_length=1`` counts CHARACTERS, so "   " (3 spaces) satisfies it even
        though it is semantically empty. This matches the existing precedent in
        ``src/schemas/nlp.py`` (``MorphologyResult.nominative: str = Field(...,
        min_length=1)`` also accepts whitespace), so it is a defensible contract
        rather than a defect — but it is pinned here so any future
        ``.strip()``-based tightening is a conscious change. See QA FINDINGS.
        """
        bundle = FormBundle(form="   ", features={"case": "nominative"})
        assert bundle.form == "   "

    def test_single_char_form_accepted(self):
        """AC-1 boundary: exactly one character satisfies min_length=1."""
        bundle = FormBundle(form="ο", features={})
        assert bundle.form == "ο"

    def test_missing_form_rejected(self):
        """AC-1: ``form`` is required (Field(...)) — omitting it raises."""
        with pytest.raises(ValidationError):
            FormBundle(features={"case": "nominative"})  # type: ignore[call-arg]

    def test_missing_features_rejected(self):
        """``features`` is required — omitting it raises (no implicit default)."""
        with pytest.raises(ValidationError):
            FormBundle(form="σπίτι")  # type: ignore[call-arg]
