"""RED tests for the per-POS authority seam (LEXGEN-07-03).

Authored test-first (RALPH Stage 2.5 / QA Mode A).  The adapter bodies in
``src/core/lexgen_authority.py`` raise ``NotImplementedError``, so every test
that calls an adapter is RED for the right reason (NotImplementedError), NOT a
collection error — the imports resolve against the skeleton which exports the
real ``RULE_AUTHORITY``, ``rules_for``, and the three adapter callables.

Structural tests (RULE_AUTHORITY shape, rules_for routing) are expected to
PASS as scaffolding already.  The four adapter-behavioural tests + the
type-check test will be RED on NotImplementedError until Stage 3 implementation.

Expected values verified against the ACTUAL functions (run 2026-06-21):
  derive_gender("θάλασσα")                  → "feminine"
  derive_gender("δρόμος") is AMBIGUOUS      → True
  derive_declension_group("βιβλίο","neuter")  → "neuter_o"
  derive_declension_group("καφές","neuter") is AMBIGUOUS → True
  normalize_ipa("/ˈspiti/")                 → "spiti"
  validate_ipa("x","/wɔɪ/").ok             → False  (w not in inventory)

FieldEvidence shape (src/schemas/lexgen.py lines 129–143):
  source: str        — required
  field: str         — required
  value: str | None  — default None
  confidence: float | None — default None, bounded [0.0, 1.0]
  flags: list[str]   — default_factory=list (default [])

Test Specs (AC → test):
  RULE_AUTHORITY structure
  - test_authority_has_exactly_three_noun_rows
  - test_no_verb_rows

  rules_for routing
  - test_rules_for_unregistered_returns_empty
  - test_rules_for_noun_gender_returns_adapter

  gender_evidence adapter (RED — NotImplementedError until Stage 3)
  - test_gender_adapter_resolves_value
  - test_gender_adapter_ambiguous_is_none_flagged

  declension_group_evidence adapter (RED — NotImplementedError until Stage 3)
  - test_declension_adapter_resolves
  - test_declension_adapter_ambiguous

  ipa_evidence adapter (RED — NotImplementedError until Stage 3)
  - test_ipa_adapter_pass
  - test_ipa_adapter_fail

  Return-type guard (RED — NotImplementedError until Stage 3)
  - test_adapters_return_fieldevidence_type
"""

from src.core.lexgen_authority import (
    RULE_AUTHORITY,
    declension_group_evidence,
    gender_evidence,
    ipa_evidence,
    rules_for,
)
from src.schemas.lexgen import FieldEvidence

# ===========================================================================
# RULE_AUTHORITY structure — PASS as scaffolding
# ===========================================================================


class TestRuleAuthorityStructure:
    """RULE_AUTHORITY must have exactly three noun rows and no verb rows."""

    def test_authority_has_exactly_three_noun_rows(self) -> None:
        """Exactly the three noun-field keys and nothing else."""
        assert set(RULE_AUTHORITY.keys()) == {
            ("noun", "gender"),
            ("noun", "declension_group"),
            ("noun", "ipa"),
        }

    def test_no_verb_rows(self) -> None:
        """No verb key is registered (verb slot is only a comment placeholder)."""
        for pos, _field in RULE_AUTHORITY:
            assert pos == "noun", f"Unexpected non-noun key: ({pos!r}, {_field!r})"


# ===========================================================================
# rules_for routing — PASS as scaffolding
# ===========================================================================


class TestRulesFor:
    """rules_for() must return () for unregistered keys and the adapter tuple for registered ones."""

    def test_rules_for_unregistered_returns_empty_verb_gender(self) -> None:
        """('verb','gender') is not registered → empty tuple."""
        assert rules_for("verb", "gender") == ()

    def test_rules_for_unregistered_returns_empty_noun_tense(self) -> None:
        """('noun','tense') is not registered → empty tuple."""
        assert rules_for("noun", "tense") == ()

    def test_rules_for_noun_gender_returns_adapter(self) -> None:
        """('noun','gender') row contains gender_evidence callable."""
        adapters = rules_for("noun", "gender")
        assert gender_evidence in adapters


# ===========================================================================
# Adapter behavioural tests — RED (NotImplementedError) until Stage 3
# ===========================================================================


class TestGenderEvidenceAdapter:
    """gender_evidence wraps derive_gender; maps AMBIGUOUS to value=None+flag."""

    def test_gender_adapter_resolves_value(self) -> None:
        """Unambiguous feminine ending → value='feminine', source='rules', field='gender'."""
        result = gender_evidence("θάλασσα")
        assert result.source == "rules"
        assert result.field == "gender"
        assert result.value == "feminine"

    def test_gender_adapter_ambiguous_is_none_flagged(self) -> None:
        """Ambiguous ending (-ος) → value=None, flags=['rule_ambiguous']."""
        result = gender_evidence("δρόμος")
        assert result.value is None
        assert result.flags == ["rule_ambiguous"]


class TestDeclensionGroupEvidenceAdapter:
    """declension_group_evidence wraps derive_declension_group."""

    def test_declension_adapter_resolves(self) -> None:
        """Unambiguous neuter -ο → value='neuter_o', source='rules', field='declension_group'."""
        result = declension_group_evidence("βιβλίο", "neuter")
        assert result.value == "neuter_o"
        assert result.source == "rules"
        assert result.field == "declension_group"

    def test_declension_adapter_ambiguous(self) -> None:
        """Neuter + unmatched ending → value=None, flags=['rule_ambiguous']."""
        result = declension_group_evidence("καφές", "neuter")
        assert result.value is None
        assert result.flags == ["rule_ambiguous"]


class TestIpaEvidenceAdapter:
    """ipa_evidence wraps validate_ipa; maps ok→value, fail→value=None+flag."""

    def test_ipa_adapter_pass(self) -> None:
        """Valid IPA → value=normalize_ipa('/ˈspiti/')='spiti', field='ipa', no ipa_invalid flag."""
        result = ipa_evidence("σπίτι", "/ˈspiti/")
        assert result.field == "ipa"
        assert result.value is not None
        # normalize_ipa strips /…/ and ˈ → "spiti"
        assert result.value == "spiti"
        assert not any(f.startswith("ipa_invalid") for f in result.flags)

    def test_ipa_adapter_fail(self) -> None:
        """'w' not in Greek phoneme inventory → value=None, flags[0] starts with 'ipa_invalid'."""
        result = ipa_evidence("x", "/wɔɪ/")
        assert result.value is None
        assert len(result.flags) >= 1
        assert result.flags[0].startswith("ipa_invalid")


# ===========================================================================
# Return-type guard — RED (NotImplementedError) until Stage 3
# ===========================================================================


class TestAdaptersReturnFieldEvidenceType:
    """Every adapter must return a FieldEvidence with source='rules'."""

    def test_gender_evidence_returns_fieldevidence(self) -> None:
        result = gender_evidence("θάλασσα")
        assert isinstance(result, FieldEvidence)
        assert result.source == "rules"

    def test_declension_group_evidence_returns_fieldevidence(self) -> None:
        result = declension_group_evidence("βιβλίο", "neuter")
        assert isinstance(result, FieldEvidence)
        assert result.source == "rules"

    def test_ipa_evidence_returns_fieldevidence(self) -> None:
        result = ipa_evidence("σπίτι", "/ˈspiti/")
        assert isinstance(result, FieldEvidence)
        assert result.source == "rules"
