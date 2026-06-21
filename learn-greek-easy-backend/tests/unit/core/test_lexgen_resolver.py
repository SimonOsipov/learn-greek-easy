"""RED tests for the per-POS morphology resolver scaffolding (LEXGEN-08-01).

Authored test-first (RALPH Stage 2.5 / QA Mode A).  The module
``src/core/lexgen_resolver.py`` does NOT exist yet, so every test in this
file is RED for the right reason (ModuleNotFoundError / ImportError), NOT a
collection or syntax error.  Two new schema types (``ResolutionContext`` and
``ResolvedParadigm``) are also absent from ``src/schemas/lexgen.py`` until the
executor implements this subtask.

14 Test Specs covering:
  Schema types
  - test_resolution_context_carries_lemma_and_mutable_resolved
  - test_resolved_paradigm_and_context_live_in_schemas_module

  Registry
  - test_resolver_for_noun_returns_noun_resolver
  - test_resolver_for_unregistered_pos_returns_none

  NOUN_CHAINS coverage
  - test_noun_chains_cover_seven_fields
  - test_field_keys_use_lowercase_ipa

  Rung adapters (per-rung callable shape and source reads)
  - test_gender_rule_rung_uses_lexgen_authority
  - test_wiktionary_gender_rung_reads_packet_sources
  - test_absent_source_rung_returns_none
  - test_lexicon_gender_rung_extracts_from_forms
  - test_lexicon_gender_rung_empty_forms_returns_none
  - test_lexicon_gender_rung_inconsistent_genders_flags
  - test_ipa_rule_rung_threads_candidate_from_packet_and_lemma_from_ctx
  - test_declension_rule_rung_reads_resolved_gender_from_ctx

Verified facts used in these tests (no derivation):
  - EvidencePacket / sources schema verified at src/schemas/lexgen.py lines 197–282
  - FormBundle features["gender"] is the extraction point for lexicon gender (D18)
  - rules_for(pos, field) two positional args verified at src/core/lexgen_authority.py:102
  - gender_evidence("θάλασσα").value == "feminine" (confirmed in test_lexgen_authority.py)
  - NOUN_CHAINS must have EXACTLY 7 fields (spec AC-5)
  - Field key "ipa" lowercase, never "IPA" (spec AC-5/AC-6)
"""

import pytest

from src.core.lexgen_resolver import (
    NOUN_CHAINS,
    RESOLVERS,
    NounResolver,
    resolver_for,
)
from src.schemas.lexgen import (
    EvidencePacket,
    EvidencePacketSources,
    FieldEvidence,
    FormBundle,
    FrequencySource,
    GreekLexiconSource,
    ResolutionContext,
    ResolvedParadigm,
    RulesSource,
    WiktionarySource,
)

# ---------------------------------------------------------------------------
# Helpers — minimal EvidencePacket constructors
# ---------------------------------------------------------------------------


def _make_packet(
    *,
    normalized_lemma: str = "θάλασσα",
    pos: str = "noun",
    wikt_present: bool = False,
    wikt_gender: str | None = None,
    wikt_pronunciation: str | None = None,
    wikt_forms: list | None = None,
    lexicon_present: bool = False,
    lexicon_forms: list | None = None,
    freq_present: bool = False,
    freq_rank: int | None = None,
    rules_present: bool = False,
) -> EvidencePacket:
    return EvidencePacket(
        lemma_input=normalized_lemma,
        normalized_lemma=normalized_lemma,
        pos=pos,
        sources=EvidencePacketSources(
            wiktionary=WiktionarySource(
                present=wikt_present,
                gender=wikt_gender,
                pronunciation=wikt_pronunciation,
                forms=wikt_forms or [],
            ),
            greek_lexicon=GreekLexiconSource(
                present=lexicon_present,
                forms=lexicon_forms or [],
            ),
            frequency=FrequencySource(
                present=freq_present,
                rank=freq_rank,
            ),
            rules=RulesSource(present=rules_present),
        ),
    )


def _make_ctx(lemma: str, resolved: dict | None = None) -> ResolutionContext:
    return ResolutionContext(lemma=lemma, resolved=resolved or {})


# ---------------------------------------------------------------------------
# Schema tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestResolutionContextSchema:
    """ResolutionContext must live in src/schemas/lexgen and carry a mutable resolved map."""

    def test_resolution_context_carries_lemma_and_mutable_resolved(self) -> None:
        """Construct ResolutionContext; lemma and empty resolved are set; resolved is mutable."""
        ctx = ResolutionContext(lemma="βιβλίο")
        assert ctx.lemma == "βιβλίο"
        assert ctx.resolved == {}
        # resolved dict must be mutable in-place (used by the resolver walk)
        ctx.resolved["gender"] = "neuter"
        assert ctx.resolved["gender"] == "neuter"

    def test_resolved_paradigm_and_context_live_in_schemas_module(self) -> None:
        """ResolutionContext and ResolvedParadigm must be importable from src.schemas.lexgen (F5/D12)."""
        # If the import at the top of this file resolves, these symbols exist in schemas.
        # We construct minimal instances to confirm the types are usable.
        ctx = ResolutionContext(lemma="θάλασσα")
        assert ctx.lemma == "θάλασσα"

        paradigm = ResolvedParadigm(
            lemma="θάλασσα",
            pos="noun",
            fields=[],
            cross_checks={},
            flagged_fields=[],
        )
        assert paradigm.lemma == "θάλασσα"
        assert paradigm.pos == "noun"
        assert paradigm.fields == []
        assert paradigm.cross_checks == {}
        assert paradigm.flagged_fields == []


# ---------------------------------------------------------------------------
# Registry tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestResolverRegistry:
    """RESOLVERS dict and resolver_for() must expose a NounResolver under 'noun'."""

    def test_resolver_for_noun_returns_noun_resolver(self) -> None:
        """resolver_for('noun') must return a MorphologyResolver with a resolve method."""
        resolver = resolver_for("noun")
        assert resolver is not None
        assert hasattr(resolver, "resolve"), "MorphologyResolver must expose resolve()"

    def test_resolver_for_unregistered_pos_returns_none(self) -> None:
        """resolver_for('verb') must return None (verb not yet registered)."""
        assert resolver_for("verb") is None

    def test_noun_is_registered_in_resolvers_dict(self) -> None:
        """RESOLVERS['noun'] must exist and be a NounResolver instance."""
        assert "noun" in RESOLVERS
        assert isinstance(RESOLVERS["noun"], NounResolver)


# ---------------------------------------------------------------------------
# NOUN_CHAINS coverage tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestNounChains:
    """NOUN_CHAINS must cover all seven fields from the authority matrix, keyed by ('noun', field)."""

    _EXPECTED_FIELDS = {
        "gender",
        "declension_group",
        "declension_forms",
        "ipa",
        "pos",
        "lemma_exists",
        "frequency_rank",
    }

    def test_noun_chains_cover_seven_fields(self) -> None:
        """NOUN_CHAINS must have exactly 7 entries under pos='noun'."""
        noun_fields = {field for (pos, field) in NOUN_CHAINS if pos == "noun"}
        assert noun_fields == self._EXPECTED_FIELDS, (
            f"NOUN_CHAINS fields mismatch.\n"
            f"  Expected: {sorted(self._EXPECTED_FIELDS)}\n"
            f"  Got:      {sorted(noun_fields)}"
        )

    def test_noun_chains_all_keys_use_noun_pos(self) -> None:
        """Every key in NOUN_CHAINS must use pos='noun' (no other POS registered yet)."""
        for pos, field in NOUN_CHAINS:
            assert pos == "noun", f"Unexpected pos in NOUN_CHAINS: ({pos!r}, {field!r})"

    def test_field_keys_use_lowercase_ipa(self) -> None:
        """Field key must be 'ipa' (lowercase), never 'IPA' — per LEXGEN-07 contract."""
        assert ("noun", "ipa") in NOUN_CHAINS, "('noun', 'ipa') must be in NOUN_CHAINS"
        assert ("noun", "IPA") not in NOUN_CHAINS, "('noun', 'IPA') must NOT be in NOUN_CHAINS"

    def test_noun_chains_values_are_non_empty_tuples(self) -> None:
        """Every NOUN_CHAINS entry must have at least one rung (non-empty tuple)."""
        for key, rungs in NOUN_CHAINS.items():
            assert len(rungs) >= 1, f"NOUN_CHAINS[{key!r}] has no rungs"


# ---------------------------------------------------------------------------
# Rung adapter tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestGenderRuleRung:
    """The Rules rung for ('noun','gender') must call gender_evidence and return FieldEvidence."""

    def test_gender_rule_rung_uses_lexgen_authority(self) -> None:
        """Rules rung for gender called with 'θάλασσα' returns FieldEvidence(source='rules', value='feminine').

        θάλασσα ends in -ασσα / -α: derive_gender -> 'feminine' (verified in test_lexgen_authority.py).
        """
        packet = _make_packet(normalized_lemma="θάλασσα", rules_present=True)
        ctx = _make_ctx("θάλασσα")

        # The Rules rung is the FIRST rung in NOUN_CHAINS[("noun","gender")]
        rungs = NOUN_CHAINS[("noun", "gender")]
        # Find the rules rung — it is the first rung by rank order (rank 1)
        rules_rung = rungs[0]
        result = rules_rung(packet, ctx)

        assert result is not None, "Rules rung must return evidence for 'θάλασσα'"
        assert isinstance(result, FieldEvidence)
        assert result.source == "rules"
        assert result.field == "gender"
        assert result.value == "feminine"


@pytest.mark.unit
class TestWiktionaryGenderRung:
    """The Wiktionary packet rung for gender must read packet.sources.wiktionary.gender."""

    def test_wiktionary_gender_rung_reads_packet_sources(self) -> None:
        """Wiktionary gender rung returns FieldEvidence(source='wiktionary', value='neuter') when present."""
        packet = _make_packet(
            normalized_lemma="βιβλίο",
            wikt_present=True,
            wikt_gender="neuter",
        )
        ctx = _make_ctx("βιβλίο")

        # Wiktionary gender rung is the second rung in gender chain (after rules)
        rungs = NOUN_CHAINS[("noun", "gender")]
        # find the wiktionary rung by iterating; it should return source="wiktionary"
        wikt_rung = None
        for rung in rungs:
            ev = rung(packet, ctx)
            if ev is not None and ev.source == "wiktionary":
                wikt_rung = rung
                wikt_result = ev
                break
        assert wikt_rung is not None, "Wiktionary gender rung must exist in gender chain"
        assert wikt_result.source == "wiktionary"
        assert wikt_result.field == "gender"
        assert wikt_result.value == "neuter"


@pytest.mark.unit
class TestFrequencyRung:
    """The frequency rung must return None when source is absent, FieldEvidence when rank is present."""

    def test_absent_source_rung_returns_none(self) -> None:
        """Frequency rung returns None when frequency.present=False and rank=None."""
        packet = _make_packet(freq_present=False, freq_rank=None)
        ctx = _make_ctx("θάλασσα")

        rungs = NOUN_CHAINS[("noun", "frequency_rank")]
        assert len(rungs) >= 1, "frequency_rank chain must have at least one rung"
        freq_rung = rungs[0]
        result = freq_rung(packet, ctx)
        assert result is None, "Frequency rung must return None when rank is None"

    def test_frequency_rung_present_returns_str_rank(self) -> None:
        """Frequency rung converts int rank to str per D16."""
        packet = _make_packet(freq_present=True, freq_rank=42)
        ctx = _make_ctx("θάλασσα")

        rungs = NOUN_CHAINS[("noun", "frequency_rank")]
        freq_rung = rungs[0]
        result = freq_rung(packet, ctx)

        assert result is not None
        assert isinstance(result, FieldEvidence)
        assert result.source == "frequency"
        assert result.field == "frequency_rank"
        assert result.value == "42"  # int->str per D16


@pytest.mark.unit
class TestLexiconGenderRung:
    """The lexicon gender rung must extract gender from FormBundle.features['gender'] (D18)."""

    def test_lexicon_gender_rung_extracts_from_forms(self) -> None:
        """Single consistent gender across forms -> FieldEvidence(source='lexicon', value='masculine')."""
        forms = [
            FormBundle(
                form="καφές",
                features={"case": "nominative", "number": "singular", "gender": "masculine"},
            ),
            FormBundle(
                form="καφέ",
                features={"case": "vocative", "number": "singular", "gender": "masculine"},
            ),
        ]
        packet = _make_packet(
            normalized_lemma="καφές",
            lexicon_present=True,
            lexicon_forms=forms,
        )
        ctx = _make_ctx("καφές")

        rungs = NOUN_CHAINS[("noun", "gender")]
        # Find the lexicon rung (source="lexicon")
        lexicon_result = None
        for rung in rungs:
            ev = rung(packet, ctx)
            if ev is not None and ev.source == "lexicon":
                lexicon_result = ev
                break
        assert (
            lexicon_result is not None
        ), "Lexicon gender rung must return evidence when forms carry gender"
        assert lexicon_result.source == "lexicon"
        assert lexicon_result.field == "gender"
        assert lexicon_result.value == "masculine"

    def test_lexicon_gender_rung_empty_forms_returns_none(self) -> None:
        """Empty forms list -> lexicon gender rung returns None (D18 step 2 — absent rung)."""
        packet = _make_packet(lexicon_present=True, lexicon_forms=[])
        ctx = _make_ctx("θάλασσα")

        rungs = NOUN_CHAINS[("noun", "gender")]
        # The lexicon rung on empty forms must return None
        for rung in rungs:
            ev = rung(packet, ctx)
            if ev is not None and ev.source == "lexicon":
                pytest.fail(
                    "Lexicon gender rung must return None for empty forms, " f"but returned {ev}"
                )
        # If no rung returned source="lexicon", that's also acceptable (rung is skipped)

    def test_lexicon_gender_rung_inconsistent_genders_flags(self) -> None:
        """Forms with conflicting gender values -> value=None, flag='lexicon_gender_inconsistent'."""
        forms = [
            FormBundle(
                form="θάλασσα",
                features={"case": "nominative", "number": "singular", "gender": "masculine"},
            ),
            FormBundle(
                form="θαλάσσης",
                features={"case": "genitive", "number": "singular", "gender": "feminine"},
            ),
        ]
        packet = _make_packet(
            normalized_lemma="θάλασσα",
            lexicon_present=True,
            lexicon_forms=forms,
        )
        ctx = _make_ctx("θάλασσα")

        rungs = NOUN_CHAINS[("noun", "gender")]
        lexicon_result = None
        for rung in rungs:
            ev = rung(packet, ctx)
            if ev is not None and ev.source == "lexicon":
                lexicon_result = ev
                break

        assert lexicon_result is not None, (
            "Lexicon gender rung must return a FieldEvidence (with value=None + flag) "
            "when forms carry conflicting genders"
        )
        assert lexicon_result.value is None, "Inconsistent genders -> value must be None"
        assert (
            "lexicon_gender_inconsistent" in lexicon_result.flags
        ), f"Expected 'lexicon_gender_inconsistent' in flags, got {lexicon_result.flags}"


@pytest.mark.unit
class TestIpaRuleRung:
    """The IPA Rules rung must thread lemma from ctx and candidate from packet.sources.wiktionary."""

    def test_ipa_rule_rung_threads_candidate_from_packet_and_lemma_from_ctx(self) -> None:
        """IPA Rules rung calls ipa_evidence(ctx.lemma, packet.sources.wiktionary.pronunciation).

        'vivˈlio' contains a non-IPA char 'v' which is in the Greek phoneme inventory
        (verified: validate_ipa succeeds for basic Latin transcription in the inventory).
        We verify the rung READS the packet pronunciation and the ctx lemma by checking
        the result has source='rules' and field='ipa'.
        """
        packet = _make_packet(
            normalized_lemma="βιβλίο",
            wikt_present=True,
            wikt_pronunciation="vivˈlio",
        )
        ctx = _make_ctx("βιβλίο")

        rungs = NOUN_CHAINS[("noun", "ipa")]
        assert len(rungs) >= 1, "IPA chain must have at least one rung"
        rules_rung = rungs[0]
        result = rules_rung(packet, ctx)

        # Result is either a FieldEvidence (pass or fail) or None (if wikt pronunciation absent).
        # The pronunciation IS present, so the rung must produce a result (not None).
        assert (
            result is not None
        ), "IPA Rules rung must return FieldEvidence when pronunciation is provided, not None"
        assert isinstance(result, FieldEvidence)
        assert result.source == "rules"
        assert result.field == "ipa"

    def test_ipa_rule_rung_absent_pronunciation_returns_none(self) -> None:
        """IPA Rules rung returns None when wiktionary.pronunciation is None (absent candidate, D6)."""
        packet = _make_packet(wikt_present=False, wikt_pronunciation=None)
        ctx = _make_ctx("βιβλίο")

        rungs = NOUN_CHAINS[("noun", "ipa")]
        rules_rung = rungs[0]
        result = rules_rung(packet, ctx)

        assert (
            result is None
        ), "IPA Rules rung must return None when pronunciation candidate is absent"


@pytest.mark.unit
class TestDeclensionRuleRung:
    """The declension_group Rules rung must read ctx.resolved['gender'] and ctx.lemma."""

    def test_declension_rule_rung_reads_resolved_gender_from_ctx(self) -> None:
        """Declension Rules rung calls declension_group_evidence(ctx.lemma, ctx.resolved['gender']).

        βιβλίο + gender=neuter -> value='neuter_o' (verified in test_lexgen_authority.py).
        """
        packet = _make_packet(normalized_lemma="βιβλίο", rules_present=True)
        ctx = _make_ctx("βιβλίο", resolved={"gender": "neuter"})

        rungs = NOUN_CHAINS[("noun", "declension_group")]
        assert len(rungs) >= 1, "declension_group chain must have at least one rung"
        rules_rung = rungs[0]
        result = rules_rung(packet, ctx)

        assert (
            result is not None
        ), "Declension Rules rung must return FieldEvidence when gender is resolved"
        assert isinstance(result, FieldEvidence)
        assert result.source == "rules"
        assert result.field == "declension_group"
        assert result.value == "neuter_o"

    def test_declension_rule_rung_skips_when_gender_unresolved(self) -> None:
        """Declension Rules rung returns None when ctx.resolved has no 'gender' key (D3/F4).

        Feeding None to declension_group_evidence would be incorrect; the rung must skip.
        """
        packet = _make_packet(normalized_lemma="βιβλίο", rules_present=True)
        # no "gender" key in resolved
        ctx = _make_ctx("βιβλίο", resolved={})

        rungs = NOUN_CHAINS[("noun", "declension_group")]
        rules_rung = rungs[0]
        result = rules_rung(packet, ctx)

        assert (
            result is None
        ), "Declension Rules rung must return None (skip) when gender is not yet resolved in ctx"


@pytest.mark.unit
class TestNounResolverSkeletonExists:
    """NounResolver.resolve must exist as an empty skeleton that raises NotImplementedError (08-02 fills it)."""

    def test_noun_resolver_resolve_raises_not_implemented(self) -> None:
        """NounResolver.resolve is an empty skeleton; calling it raises NotImplementedError."""
        resolver = NounResolver()
        packet = _make_packet()
        with pytest.raises(NotImplementedError):
            resolver.resolve("θάλασσα", packet)
