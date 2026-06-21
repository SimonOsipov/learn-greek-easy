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
from src.core.lexgen_g2p import validate_ipa
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


# ===========================================================================
# Adversarial / edge coverage (Mode B — QA LEXGEN-07-03)
# ===========================================================================


class TestConfidenceIsNeverSet:
    """Decision Record §3: the rules layer never sets confidence — it stays None."""

    def test_gender_evidence_confidence_is_none(self) -> None:
        """gender_evidence must never populate confidence (inert field)."""
        result = gender_evidence("θάλασσα")
        assert result.confidence is None

    def test_gender_evidence_ambiguous_confidence_is_none(self) -> None:
        """Even on an ambiguous result confidence stays None."""
        result = gender_evidence("δρόμος")
        assert result.confidence is None

    def test_declension_group_evidence_confidence_is_none(self) -> None:
        """declension_group_evidence must never populate confidence."""
        result = declension_group_evidence("βιβλίο", "neuter")
        assert result.confidence is None

    def test_declension_group_evidence_ambiguous_confidence_is_none(self) -> None:
        """Ambiguous declension path must not set confidence."""
        result = declension_group_evidence("καφές", "neuter")
        assert result.confidence is None

    def test_ipa_evidence_pass_confidence_is_none(self) -> None:
        """ipa_evidence on a valid candidate must not set confidence."""
        result = ipa_evidence("σπίτι", "/ˈspiti/")
        assert result.confidence is None

    def test_ipa_evidence_fail_confidence_is_none(self) -> None:
        """ipa_evidence on an invalid candidate must not set confidence."""
        result = ipa_evidence("x", "/wɔɪ/")
        assert result.confidence is None


class TestCleanFlagsOnSuccess:
    """Adapters must NOT append stray flags when they resolve cleanly."""

    def test_gender_evidence_clean_resolve_has_empty_flags(self) -> None:
        """θάλασσα resolves unambiguously — flags list must be empty."""
        result = gender_evidence("θάλασσα")
        assert result.flags == []

    def test_declension_group_evidence_clean_resolve_has_empty_flags(self) -> None:
        """βιβλίο/neuter resolves unambiguously — flags list must be empty."""
        result = declension_group_evidence("βιβλίο", "neuter")
        assert result.flags == []

    def test_ipa_evidence_pass_has_empty_flags(self) -> None:
        """Valid IPA — flags list must be empty (no ipa_invalid or any other flag)."""
        result = ipa_evidence("σπίτι", "/ˈspiti/")
        assert result.flags == []


class TestAmbiguousNeverLeaksValue:
    """On every ambiguous path value MUST be None and flag MUST be exactly ['rule_ambiguous']."""

    def test_gender_ambiguous_value_is_none(self) -> None:
        """δρόμος is ambiguous (-ος is masc/fem/neut) — value must be None, not fabricated."""
        result = gender_evidence("δρόμος")
        assert result.value is None

    def test_gender_ambiguous_flag_is_exactly_rule_ambiguous(self) -> None:
        """Ambiguous gender result must carry exactly ['rule_ambiguous'], no extras."""
        result = gender_evidence("δρόμος")
        assert result.flags == ["rule_ambiguous"]

    def test_declension_group_ambiguous_value_is_none(self) -> None:
        """καφές with gender=neuter is ambiguous — value must be None, not fabricated."""
        result = declension_group_evidence("καφές", "neuter")
        assert result.value is None

    def test_declension_group_ambiguous_flag_is_exactly_rule_ambiguous(self) -> None:
        """Ambiguous declension result must carry exactly ['rule_ambiguous'], no extras."""
        result = declension_group_evidence("καφές", "neuter")
        assert result.flags == ["rule_ambiguous"]


class TestIpaInvalidFlagCarriesReason:
    """The ipa_invalid flag must encode the validate_ipa reason so LEXGEN-08 can read it."""

    def test_ipa_invalid_flag_format_matches_validate_ipa_reason(self) -> None:
        """flags[0] must equal f'ipa_invalid:{validate_ipa(...).reason}' exactly."""
        result = ipa_evidence("x", "/wɔɪ/")
        vr = validate_ipa("x", "/wɔɪ/")
        assert result.flags[0] == f"ipa_invalid:{vr.reason}"

    def test_ipa_empty_candidate_value_is_none(self) -> None:
        """Empty string candidate — normalize_ipa('') == '' → empty pronunciation path."""
        result = ipa_evidence("x", "")
        assert result.value is None

    def test_ipa_empty_candidate_flag_starts_with_ipa_invalid(self) -> None:
        """Empty candidate must raise the ipa_invalid flag (not silently pass vacuously)."""
        result = ipa_evidence("x", "")
        assert result.flags[0].startswith("ipa_invalid")

    def test_ipa_empty_candidate_reason_mentions_empty(self) -> None:
        """The ipa_invalid reason for an empty candidate must mention 'empty'."""
        result = ipa_evidence("x", "")
        assert "empty" in result.flags[0]


class TestRuleAuthorityAdapterCallability:
    """Every adapter in RULE_AUTHORITY is callable and returns FieldEvidence."""

    def test_noun_gender_adapter_returns_fieldevidence(self) -> None:
        """The adapter stored under ('noun','gender') must be callable and return FieldEvidence."""
        adapters = rules_for("noun", "gender")
        assert len(adapters) == 1
        result = adapters[0]("θάλασσα")
        assert isinstance(result, FieldEvidence)

    def test_noun_declension_group_adapter_returns_fieldevidence(self) -> None:
        """The adapter stored under ('noun','declension_group') must return FieldEvidence."""
        adapters = rules_for("noun", "declension_group")
        assert len(adapters) == 1
        result = adapters[0]("βιβλίο", "neuter")
        assert isinstance(result, FieldEvidence)

    def test_noun_ipa_adapter_returns_fieldevidence(self) -> None:
        """The adapter stored under ('noun','ipa') must return FieldEvidence."""
        adapters = rules_for("noun", "ipa")
        assert len(adapters) == 1
        result = adapters[0]("σπίτι", "/ˈspiti/")
        assert isinstance(result, FieldEvidence)


class TestFieldMatchesRowKey:
    """Every adapter's returned FieldEvidence.field must equal the registry key's field component."""

    def test_noun_gender_adapter_field_is_gender(self) -> None:
        """Adapter for key ('noun','gender') must return FieldEvidence with field='gender'."""
        result = gender_evidence("θάλασσα")
        assert result.field == "gender"

    def test_noun_declension_group_adapter_field_is_declension_group(self) -> None:
        """Adapter for ('noun','declension_group') must return field='declension_group'."""
        result = declension_group_evidence("βιβλίο", "neuter")
        assert result.field == "declension_group"

    def test_noun_ipa_adapter_field_is_ipa(self) -> None:
        """Adapter for ('noun','ipa') must return field='ipa'."""
        result = ipa_evidence("σπίτι", "/ˈspiti/")
        assert result.field == "ipa"

    def test_noun_gender_ambiguous_field_is_gender(self) -> None:
        """Even on ambiguous resolution, field='gender' must be preserved."""
        result = gender_evidence("δρόμος")
        assert result.field == "gender"

    def test_noun_declension_group_ambiguous_field_is_declension_group(self) -> None:
        """Even on ambiguous resolution, field='declension_group' must be preserved."""
        result = declension_group_evidence("καφές", "neuter")
        assert result.field == "declension_group"

    def test_noun_ipa_invalid_field_is_ipa(self) -> None:
        """Even on invalid IPA, field='ipa' must be preserved."""
        result = ipa_evidence("x", "/wɔɪ/")
        assert result.field == "ipa"


class TestRuleAuthorityValuesAreTuples:
    """RULE_AUTHORITY values must be tuples (ordered, immutable), not lists."""

    def test_all_authority_values_are_tuples(self) -> None:
        """Every value in RULE_AUTHORITY must be a tuple, not a list."""
        for (pos, field), adapters in RULE_AUTHORITY.items():
            assert isinstance(
                adapters, tuple
            ), f"RULE_AUTHORITY[({pos!r}, {field!r})] is {type(adapters).__name__}, expected tuple"
