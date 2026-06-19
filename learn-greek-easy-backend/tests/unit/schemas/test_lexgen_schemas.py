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

from src.schemas.lexgen import (
    FEATURE_KEYS,
    GRAMMAR_DATA_SCHEMA,
    FieldEvidence,
    FormBundle,
    ProposalDraft,
    ResolvedField,
)

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


# ---------------------------------------------------------------------------
# LEXGEN-02-02 — POS-neutral proposal-draft value types + GRAMMAR_DATA_SCHEMA.
#
# RED-phase acceptance-criteria tests authored test-first (Mode A). They target
# the LEXGEN-02-02 symbols which currently ship as minimal non-functional STUBS
# in ``src/schemas/lexgen.py``:
#   - FieldEvidence / ResolvedField with NO confidence bound,
#   - GRAMMAR_DATA_SCHEMA as a plain mutable dict.
# The executor (Stage 3) makes these go green by adding the ge/le bound and an
# immutable mapping. Imports resolve cleanly so failures are assertion /
# missing-ValidationError / missing-TypeError, NOT collection errors.
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestFieldEvidenceAndResolvedField:
    """FieldEvidence / ResolvedField construction, defaults, and confidence bounds."""

    def test_field_evidence_defaults(self):
        """AC-1: FieldEvidence(source, field, value) defaults confidence=None, flags=[]."""
        evidence = FieldEvidence(source="wiktionary", field="lemma", value="σπίτι")
        assert evidence.source == "wiktionary"
        assert evidence.field == "lemma"
        assert evidence.value == "σπίτι"
        assert evidence.confidence is None
        assert evidence.flags == []

    def test_resolved_field_confidence_bounds(self):
        """AC-1: ResolvedField confidence must be in [0.0, 1.0].

        ``confidence=1.5`` must raise ValidationError (above the ge/le bound);
        ``confidence=0.8`` is in-range and must construct. This is the key RED:
        the stub omits the ge/le bound, so 1.5 is wrongly accepted (no error).
        """
        with pytest.raises(ValidationError):
            ResolvedField(
                field="lemma",
                value="σπίτι",
                source="wiktionary",
                confidence=1.5,
            )
        valid = ResolvedField(
            field="lemma",
            value="σπίτι",
            source="wiktionary",
            confidence=0.8,
        )
        assert valid.confidence == 0.8


@pytest.mark.unit
class TestProposalDraftPosNeutral:
    """ProposalDraft is POS-neutral: pos is free text, no noun-only fields."""

    def test_proposal_draft_pos_is_free_text(self):
        """AC-2: pos accepts any string (no enum constraint) — verb and noun both work."""
        verb_draft = ProposalDraft(
            lemma="γράφω",
            pos="verb",
            grammar_data_schema_version="noun.v1",
        )
        noun_draft = ProposalDraft(
            lemma="σπίτι",
            pos="noun",
            grammar_data_schema_version="noun.v1",
        )
        assert verb_draft.pos == "verb"
        assert noun_draft.pos == "noun"

    def test_proposal_draft_pos_neutral_no_gender_field(self):
        """AC-2: ProposalDraft has NO noun-only fields (no gender/cases on the model)."""
        field_names = set(ProposalDraft.model_fields.keys())
        assert "gender" not in field_names
        assert "cases" not in field_names
        # Positive pin: the POS-neutral fields the contract DOES require.
        assert {"lemma", "pos", "resolved_fields", "grammar_data_schema_version"} <= field_names


@pytest.mark.unit
class TestGrammarDataSchema:
    """GRAMMAR_DATA_SCHEMA is the immutable {pos: schema-version} mapping."""

    def test_grammar_data_schema_noun_v1(self):
        """AC-3: the noun entry maps to the versioned schema id "noun.v1"."""
        assert GRAMMAR_DATA_SCHEMA["noun"] == "noun.v1"

    def test_grammar_data_schema_immutable(self):
        """AC-3: GRAMMAR_DATA_SCHEMA is a frozen mapping — assignment raises TypeError.

        Key RED: the stub is a plain mutable dict, so this assignment SUCCEEDS
        instead of raising — the missing-TypeError is the failure signal.
        """
        with pytest.raises(TypeError):
            GRAMMAR_DATA_SCHEMA["verb"] = "x"  # type: ignore[index]

    def test_grammar_data_schema_overwrite_existing_rejected(self):
        """AC-3: overwriting an EXISTING key also raises, and leaves the value intact.

        Key RED: the stub dict allows ``["noun"]="x"`` and mutates the value, so
        both the missing-TypeError AND the post-mutation value check fail.
        """
        with pytest.raises(TypeError):
            GRAMMAR_DATA_SCHEMA["noun"] = "x"  # type: ignore[index]
        # The original value survives the rejected mutation attempt.
        assert GRAMMAR_DATA_SCHEMA["noun"] == "noun.v1"


# ---------------------------------------------------------------------------
# LEXGEN-02-02 — Mode B adversarial / edge / negative coverage (QA-authored).
#
# The AC tests above (TestFieldEvidenceAndResolvedField / TestProposalDraft-
# PosNeutral / TestGrammarDataSchema) cover the happy path + one bound + one
# mutation each. These pin the BOUNDARIES so a future loosening is a conscious,
# test-breaking change rather than a silent regression. All behaviors below were
# verified live against the shipped impl (commit 5aa81a31) before being pinned.
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestConfidenceBoundsAdversarial:
    """Pin the INCLUSIVE [0.0, 1.0] bound on confidence (FieldEvidence + ResolvedField)."""

    @pytest.mark.parametrize("model", [FieldEvidence, ResolvedField])
    @pytest.mark.parametrize("valid", [0.0, 1.0, 0.5])
    def test_confidence_inclusive_bounds_accepted(self, model, valid):
        """ge/le are INCLUSIVE: 0.0 and 1.0 are valid endpoints, not rejected.

        Guards against an off-by-epsilon regression to ``gt=0.0``/``lt=1.0``
        (exclusive), which would wrongly reject a legitimate 0.0 (no evidence)
        or 1.0 (certain) score.
        """
        instance = model(source="wiktionary", field="lemma", confidence=valid)
        assert instance.confidence == valid

    @pytest.mark.parametrize("model", [FieldEvidence, ResolvedField])
    @pytest.mark.parametrize("invalid", [-0.01, 1.01, -1.0, 2.0])
    def test_confidence_out_of_range_rejected(self, model, invalid):
        """Any score just outside [0.0, 1.0] raises — pins the bound is enforced."""
        with pytest.raises(ValidationError):
            model(source="wiktionary", field="lemma", confidence=invalid)

    @pytest.mark.parametrize("model", [FieldEvidence, ResolvedField])
    def test_confidence_none_default(self, model):
        """confidence defaults to None (absent), not 0.0 — absence is distinguishable."""
        instance = model(source="s", field="f")
        assert instance.confidence is None


@pytest.mark.unit
class TestFlagsDefaultNotShared:
    """flags uses default_factory=list — each instance gets an independent list."""

    @pytest.mark.parametrize("model", [FieldEvidence, ResolvedField])
    def test_flags_default_is_per_instance(self, model):
        """Mutating one instance's flags must NOT leak into a sibling's.

        Direct guard against a ``default=[]`` regression, where every instance
        would alias one shared module-level list (the classic Python mutable-
        default bug). The impl uses ``default_factory=list``, so this passes.
        """
        a = model(source="s", field="f")
        b = model(source="s", field="f")
        a.flags.append("guessed")
        assert a.flags == ["guessed"]
        assert b.flags == []
        assert a.flags is not b.flags

    @pytest.mark.parametrize("model", [FieldEvidence, ResolvedField])
    def test_flags_default_empty_list(self, model):
        """flags defaults to an empty list, not None."""
        assert model(source="s", field="f").flags == []


@pytest.mark.unit
class TestRequiredFields:
    """Non-defaulted fields are required — omitting them raises (no silent default)."""

    def test_field_evidence_requires_source_and_field(self):
        """FieldEvidence(source, field) are mandatory; value/confidence/flags default."""
        with pytest.raises(ValidationError):
            FieldEvidence(field="lemma")  # type: ignore[call-arg]  # no source
        with pytest.raises(ValidationError):
            FieldEvidence(source="wiktionary")  # type: ignore[call-arg]  # no field
        # All three optionals can be omitted once the two required are present.
        ev = FieldEvidence(source="wiktionary", field="lemma")
        assert ev.value is None and ev.confidence is None and ev.flags == []

    def test_resolved_field_requires_field_and_source(self):
        """ResolvedField(field, source) are mandatory."""
        with pytest.raises(ValidationError):
            ResolvedField(source="wiktionary")  # type: ignore[call-arg]  # no field
        with pytest.raises(ValidationError):
            ResolvedField(field="lemma")  # type: ignore[call-arg]  # no source

    def test_proposal_draft_requires_lemma_pos_and_schema_version(self):
        """ProposalDraft requires lemma, pos, grammar_data_schema_version.

        ``resolved_fields`` defaults to [] (default_factory) and may be omitted;
        the other three have no default and must be supplied.
        """
        # resolved_fields omitted -> defaults to [].
        draft = ProposalDraft(lemma="σπίτι", pos="noun", grammar_data_schema_version="noun.v1")
        assert draft.resolved_fields == []
        # Each of the three required fields, omitted in turn, raises.
        with pytest.raises(ValidationError):
            ProposalDraft(pos="noun", grammar_data_schema_version="noun.v1")  # type: ignore[call-arg]
        with pytest.raises(ValidationError):
            ProposalDraft(lemma="σπίτι", grammar_data_schema_version="noun.v1")  # type: ignore[call-arg]
        with pytest.raises(ValidationError):
            ProposalDraft(lemma="σπίτι", pos="noun")  # type: ignore[call-arg]


@pytest.mark.unit
class TestProposalDraftResolvedFields:
    """resolved_fields: list[ResolvedField] — round-trip, coercion, and rejection."""

    def test_resolved_fields_round_trip(self):
        """A list of ResolvedField instances is stored verbatim and round-trips."""
        rf1 = ResolvedField(field="lemma", value="σπίτι", source="wiktionary", confidence=0.9)
        rf2 = ResolvedField(field="pos", value="noun", source="spacy", flags=["low-evidence"])
        draft = ProposalDraft(
            lemma="σπίτι",
            pos="noun",
            grammar_data_schema_version="noun.v1",
            resolved_fields=[rf1, rf2],
        )
        assert len(draft.resolved_fields) == 2
        assert all(isinstance(f, ResolvedField) for f in draft.resolved_fields)
        assert draft.resolved_fields[0].field == "lemma"
        assert draft.resolved_fields[1].flags == ["low-evidence"]

    def test_resolved_fields_default_empty_list_not_shared(self):
        """resolved_fields default_factory => independent [] per instance."""
        a = ProposalDraft(lemma="a", pos="noun", grammar_data_schema_version="noun.v1")
        b = ProposalDraft(lemma="b", pos="noun", grammar_data_schema_version="noun.v1")
        a.resolved_fields.append(ResolvedField(field="lemma", value="a", source="s"))
        assert len(a.resolved_fields) == 1
        assert b.resolved_fields == []
        assert a.resolved_fields is not b.resolved_fields

    def test_resolved_fields_coerces_valid_dict(self):
        """PINNED BEHAVIOR: a well-formed dict is coerced into a ResolvedField.

        Pydantic v2 model-validates each list element; a dict carrying the
        required keys (field, source) becomes a real ResolvedField instance.
        """
        draft = ProposalDraft(
            lemma="σπίτι",
            pos="noun",
            grammar_data_schema_version="noun.v1",
            resolved_fields=[{"field": "lemma", "value": "σπίτι", "source": "wiktionary"}],
        )
        assert isinstance(draft.resolved_fields[0], ResolvedField)
        assert draft.resolved_fields[0].field == "lemma"
        assert draft.resolved_fields[0].source == "wiktionary"

    def test_resolved_fields_dict_missing_required_key_rejected(self):
        """A dict lacking a required ResolvedField key (source) is rejected.

        Coercion does NOT paper over a missing required field — the nested
        validation still fires.
        """
        with pytest.raises(ValidationError):
            ProposalDraft(
                lemma="σπίτι",
                pos="noun",
                grammar_data_schema_version="noun.v1",
                resolved_fields=[{"field": "lemma", "value": "σπίτι"}],  # no source
            )

    def test_resolved_fields_non_model_element_rejected(self):
        """A non-dict, non-ResolvedField element (an int) is rejected.

        Pins that the list is typed: ``resolved_fields=[5]`` raises rather than
        silently storing a bare int.
        """
        with pytest.raises(ValidationError):
            ProposalDraft(
                lemma="σπίτι",
                pos="noun",
                grammar_data_schema_version="noun.v1",
                resolved_fields=[5],  # type: ignore[list-item]
            )


@pytest.mark.unit
class TestProposalDraftPosNeutralDeep:
    """Deep POS-neutrality: pos is unconstrained free text; no noun-only structure."""

    @pytest.mark.parametrize("pos", ["noun", "verb", "adjective", "adverb", "pronoun", "ADP", "x"])
    def test_pos_accepts_arbitrary_part_of_speech(self, pos):
        """pos accepts any POS string — no enum/Literal gate.

        A future enum constraint (e.g. ``Literal["noun", "verb"]``) would break
        this, surfacing the POS-neutrality contract regression at review time.
        """
        draft = ProposalDraft(lemma="x", pos=pos, grammar_data_schema_version="noun.v1")
        assert draft.pos == pos

    def test_pos_is_plain_str_annotation(self):
        """The pos field annotation is exactly ``str`` (not an enum/Literal).

        Direct structural pin of POS-neutrality independent of value-level tests:
        if someone narrows the annotation, this fails immediately.
        """
        assert ProposalDraft.model_fields["pos"].annotation is str

    def test_no_noun_only_structural_fields(self):
        """No noun-only field (gender/cases/number/declension) exists on the model.

        Broader than the AC's gender-only check: a whole family of noun-shaped
        fields is forbidden, so POS-neutrality cannot erode field-by-field.
        """
        field_names = set(ProposalDraft.model_fields.keys())
        for noun_only in ("gender", "cases", "case", "number", "declension", "article"):
            assert noun_only not in field_names
        assert field_names == {
            "lemma",
            "pos",
            "resolved_fields",
            "grammar_data_schema_version",
        }

    def test_extra_noun_only_kwarg_is_ignored_not_stored(self):
        """PINNED BEHAVIOR: an extra ``gender=`` kwarg is silently IGNORED.

        Pydantic's default ``extra="ignore"`` means a noun-only kwarg neither
        raises nor lands as data — it cannot leak in as a hidden field. (See QA
        FINDINGS: it is ignored, not *forbidden*; a future ``extra="forbid"``
        would make this raise instead — pinned so that is a conscious change.)
        """
        draft = ProposalDraft(
            lemma="σπίτι",
            pos="noun",
            grammar_data_schema_version="noun.v1",
            gender="neuter",  # type: ignore[call-arg]
        )
        assert not hasattr(draft, "gender")
        assert draft.model_extra is None

    def test_empty_pos_currently_allowed(self):
        """CONTRACT PIN + FINDING: ``pos=""`` is accepted today (no min_length on pos).

        ``pos: str`` carries no ``min_length``, so the empty string constructs —
        even though an empty part-of-speech is semantically meaningless. This
        mirrors the ``WordProposal.pos`` free-text precedent (LEXGEN-01) and is
        pinned deliberately: a future decision to require ``min_length=1`` on pos
        is then a conscious, test-breaking change. See QA FINDINGS.
        """
        draft = ProposalDraft(lemma="σπίτι", pos="", grammar_data_schema_version="noun.v1")
        assert draft.pos == ""


@pytest.mark.unit
class TestProposalDraftLemmaConstraint:
    """lemma carries min_length=1 (mirrors FormBundle.form)."""

    def test_empty_lemma_rejected(self):
        """AC-2 boundary: ``lemma=""`` raises (min_length=1)."""
        with pytest.raises(ValidationError):
            ProposalDraft(lemma="", pos="noun", grammar_data_schema_version="noun.v1")

    def test_single_char_lemma_accepted(self):
        """Boundary: exactly one character satisfies min_length=1."""
        draft = ProposalDraft(lemma="ο", pos="noun", grammar_data_schema_version="noun.v1")
        assert draft.lemma == "ο"


@pytest.mark.unit
class TestGrammarDataSchemaImmutabilityAdversarial:
    """Every mutation verb on GRAMMAR_DATA_SCHEMA is rejected; contents stay intact."""

    def test_delitem_rejected(self):
        """``del GRAMMAR_DATA_SCHEMA["noun"]`` raises and the entry survives."""
        with pytest.raises(TypeError):
            del GRAMMAR_DATA_SCHEMA["noun"]  # type: ignore[misc]
        assert GRAMMAR_DATA_SCHEMA["noun"] == "noun.v1"

    def test_pop_unavailable(self):
        """A read-only MappingProxyType exposes no ``pop`` — calling it raises.

        MappingProxyType has no ``pop``/``clear``/``update`` methods at all, so
        attribute access raises AttributeError (a stricter guarantee than a
        mutable dict whose pop would mutate).
        """
        with pytest.raises(AttributeError):
            GRAMMAR_DATA_SCHEMA.pop("noun")  # type: ignore[attr-defined]
        assert GRAMMAR_DATA_SCHEMA["noun"] == "noun.v1"

    def test_update_unavailable(self):
        """``.update({...})`` is not exposed by the proxy — raises AttributeError."""
        with pytest.raises(AttributeError):
            GRAMMAR_DATA_SCHEMA.update({"verb": "verb.v1"})  # type: ignore[attr-defined]
        assert "verb" not in GRAMMAR_DATA_SCHEMA

    def test_clear_unavailable(self):
        """``.clear()`` is not exposed by the proxy — raises AttributeError."""
        with pytest.raises(AttributeError):
            GRAMMAR_DATA_SCHEMA.clear()  # type: ignore[attr-defined]
        assert len(GRAMMAR_DATA_SCHEMA) == 1

    def test_setdefault_unavailable(self):
        """``.setdefault`` is not exposed by the proxy — raises AttributeError."""
        with pytest.raises(AttributeError):
            GRAMMAR_DATA_SCHEMA.setdefault("verb", "verb.v1")  # type: ignore[attr-defined]
        assert "verb" not in GRAMMAR_DATA_SCHEMA

    def test_contents_intact_after_all_failed_mutations(self):
        """After every rejected mutation above, the mapping is exactly {noun: noun.v1}."""
        assert len(GRAMMAR_DATA_SCHEMA) == 1
        assert dict(GRAMMAR_DATA_SCHEMA) == {"noun": "noun.v1"}

    def test_missing_key_raises_keyerror(self):
        """A read of an absent pos (e.g. "verb") raises KeyError — no verb schema yet."""
        with pytest.raises(KeyError):
            _ = GRAMMAR_DATA_SCHEMA["verb"]
