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
