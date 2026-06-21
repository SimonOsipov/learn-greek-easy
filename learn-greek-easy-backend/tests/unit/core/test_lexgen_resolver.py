"""Tests for the per-POS morphology resolver scaffolding (LEXGEN-08-01).

Originally authored test-first (RALPH Stage 2.5 / QA Mode A).  The module
``src/core/lexgen_resolver.py`` does NOT exist yet, so every test in this
file is RED for the right reason (ModuleNotFoundError / ImportError), NOT a
collection or syntax error.  Two new schema types (``ResolutionContext`` and
``ResolvedParadigm``) are also absent from ``src/schemas/lexgen.py`` until the
executor implements this subtask.

After Mode B (QA verification), adversarial and witness-value coverage was added:
- Co-rank-1 tuple order within NOUN_CHAINS (rules > wiktionary > lexicon)
- lemma_exists co-rank-1 triple (wiktionary / lexicon / frequency all rank 1)
- Witness-value pinning for pos / lemma_exists / declension_forms rungs (OQ-A)
- ResolvedParadigm round-trip via model_dump / model_validate
- resolver_for with empty-string and None-ish pos
- Lexicon gender rung with forms missing the gender feature key
- DR §3 — no numeric confidence in any rung output

14 Test Specs (Mode A) + 14 adversarial tests (Mode B) = 28 tests total.

14 Mode A test specs covering:
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


# ---------------------------------------------------------------------------
# Mode B — adversarial / edge / witness-value coverage (QA LEXGEN-08-01)
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestNounChainsCoRankOrder:
    """Co-rank-1 ordering within NOUN_CHAINS must be rules > wiktionary > lexicon (D2)."""

    def test_gender_chain_corank1_order_rules_then_wiktionary(self) -> None:
        """NOUN_CHAINS[('noun','gender')]: first rung is the rules rung, second is wiktionary.

        This is load-bearing for 08-02: the walk tries rungs in order, so the
        tuple position IS the priority. Mutating the order would silently change
        which source wins at co-rank-1.
        """
        rungs = NOUN_CHAINS[("noun", "gender")]
        # Drive each rung with a packet where rules DO resolve (θάλασσα → feminine)
        # and wikt gender is also present.
        packet = _make_packet(
            normalized_lemma="θάλασσα",
            rules_present=True,
            wikt_present=True,
            wikt_gender="masculine",  # deliberate mismatch to distinguish sources
        )
        ctx = _make_ctx("θάλασσα")

        # First rung must be the rules rung (source="rules")
        first_ev = rungs[0](packet, ctx)
        assert first_ev is not None, "First rung (rules) must return evidence for 'θάλασσα'"
        assert (
            first_ev.source == "rules"
        ), f"Expected first rung source='rules' (co-rank-1 priority), got '{first_ev.source}'"

        # Second rung must be wiktionary (source="wiktionary")
        second_ev = rungs[1](packet, ctx)
        assert second_ev is not None, "Second rung (wiktionary) must return evidence when present"
        assert (
            second_ev.source == "wiktionary"
        ), f"Expected second rung source='wiktionary', got '{second_ev.source}'"

    def test_gender_chain_lexicon_is_third(self) -> None:
        """Lexicon gender rung is THIRD in the gender chain (rank 2, after rules+wiktionary at rank 1)."""
        rungs = NOUN_CHAINS[("noun", "gender")]
        assert len(rungs) == 3, f"gender chain must have 3 rungs, got {len(rungs)}"
        # Third rung must produce source="lexicon" when forms carry gender
        forms = [FormBundle(form="θαλάσση", features={"case": "genitive", "gender": "feminine"})]
        packet = _make_packet(lexicon_present=True, lexicon_forms=forms)
        ctx = _make_ctx("θάλασσα")
        third_ev = rungs[2](packet, ctx)
        assert third_ev is not None
        assert third_ev.source == "lexicon"

    def test_lemma_exists_all_three_rungs_are_rank1(self) -> None:
        """NOUN_CHAINS[('noun','lemma_exists')] must have exactly 3 rungs (wiktionary/lexicon/frequency at co-rank-1, D2).

        The co-rank-1 triple means any present source wins independently; no source is
        preferred over another. Pinning the count prevents silent removal.
        """
        rungs = NOUN_CHAINS[("noun", "lemma_exists")]
        assert len(rungs) == 3, f"lemma_exists chain must have 3 co-rank-1 rungs, got {len(rungs)}"
        # Confirm each rung returns a distinct source when all sources are present
        packet = _make_packet(
            wikt_present=True, lexicon_present=True, freq_present=True, freq_rank=5
        )
        ctx = _make_ctx("θάλασσα")
        sources = [r(packet, ctx).source for r in rungs if r(packet, ctx) is not None]
        assert set(sources) == {
            "wiktionary",
            "lexicon",
            "frequency",
        }, f"All three lemma_exists sources must be reachable, got: {sources}"


@pytest.mark.unit
class TestWitnessValues:
    """Pin the witness values for pos / lemma_exists / declension_forms rungs (OQ-A).

    These rungs return non-None values so 08-02's chain-walk can recognise them
    as 'resolved' (None = skipped). Pinning the exact strings prevents 08-02/08-03
    from silently regressing them.
    """

    def test_pos_rung_value_is_packet_pos(self) -> None:
        """pos rungs return packet.pos as the value — not a constant, not 'present', not None."""
        packet = _make_packet(pos="noun", wikt_present=True)
        ctx = _make_ctx("θάλασσα")

        rungs = NOUN_CHAINS[("noun", "pos")]
        wikt_pos_rung = rungs[0]  # wiktionary pos rung is first
        ev = wikt_pos_rung(packet, ctx)

        assert ev is not None
        assert ev.value == "noun", f"pos rung must return packet.pos ('noun'), got {ev.value!r}"
        assert ev.source == "wiktionary"
        assert ev.field == "pos"

    def test_lemma_exists_rung_value_is_string_true(self) -> None:
        """lemma_exists rungs return the string 'true' (not bool True, not '1', not 'present')."""
        packet = _make_packet(wikt_present=True)
        ctx = _make_ctx("θάλασσα")

        rungs = NOUN_CHAINS[("noun", "lemma_exists")]
        wikt_lemma_rung = rungs[0]
        ev = wikt_lemma_rung(packet, ctx)

        assert ev is not None
        assert (
            ev.value == "true"
        ), f"lemma_exists rung must return value='true' (str), got {ev.value!r}"
        assert ev.source == "wiktionary"
        assert ev.field == "lemma_exists"

    def test_lexicon_lemma_exists_rung_value_is_string_true(self) -> None:
        """Lexicon lemma_exists rung also returns 'true' (same contract as wiktionary rung)."""
        packet = _make_packet(lexicon_present=True)
        ctx = _make_ctx("θάλασσα")

        rungs = NOUN_CHAINS[("noun", "lemma_exists")]
        lexicon_lemma_rung = rungs[1]
        ev = lexicon_lemma_rung(packet, ctx)

        assert ev is not None
        assert ev.value == "true"
        assert ev.source == "lexicon"

    def test_frequency_lemma_exists_rung_value_is_string_true(self) -> None:
        """Frequency lemma_exists rung returns 'true' when source is present."""
        packet = _make_packet(freq_present=True, freq_rank=100)
        ctx = _make_ctx("θάλασσα")

        rungs = NOUN_CHAINS[("noun", "lemma_exists")]
        freq_lemma_rung = rungs[2]
        ev = freq_lemma_rung(packet, ctx)

        assert ev is not None
        assert ev.value == "true"
        assert ev.source == "frequency"

    def test_declension_forms_lexicon_rung_value_is_count_string(self) -> None:
        """Lexicon declension_forms rung value is str(len(forms)) — the count of forms present.

        This is the executor's witness choice (OQ-A): the count string is the
        value 08-02 sees as 'resolved'. Pinned here so 08-02/08-03 cannot
        silently change it to None or a different sentinel.
        """
        forms = [
            FormBundle(form="θάλασσα", features={"case": "nominative", "number": "singular"}),
            FormBundle(form="θαλάσσης", features={"case": "genitive", "number": "singular"}),
            FormBundle(form="θάλασσα", features={"case": "accusative", "number": "singular"}),
        ]
        packet = _make_packet(lexicon_present=True, lexicon_forms=forms)
        ctx = _make_ctx("θάλασσα")

        rungs = NOUN_CHAINS[("noun", "declension_forms")]
        lexicon_forms_rung = rungs[0]  # lexicon is rank 1
        ev = lexicon_forms_rung(packet, ctx)

        assert ev is not None
        assert ev.source == "lexicon"
        assert ev.field == "declension_forms"
        assert (
            ev.value == "3"
        ), f"declension_forms lexicon rung value must be str(len(forms))='3', got {ev.value!r}"

    def test_declension_forms_wiktionary_rung_value_is_count_string(self) -> None:
        """Wiktionary declension_forms rung value is str(len(forms)) — same witness convention."""
        forms = [
            FormBundle(form="βιβλίο", features={"case": "nominative", "number": "singular"}),
            FormBundle(form="βιβλίου", features={"case": "genitive", "number": "singular"}),
        ]
        packet = _make_packet(wikt_present=True, wikt_forms=forms)
        ctx = _make_ctx("βιβλίο")

        rungs = NOUN_CHAINS[("noun", "declension_forms")]
        wikt_forms_rung = rungs[1]  # wiktionary is rank 2
        ev = wikt_forms_rung(packet, ctx)

        assert ev is not None
        assert ev.source == "wiktionary"
        assert ev.field == "declension_forms"
        assert ev.value == "2"


@pytest.mark.unit
class TestResolvedParadigmRoundTrip:
    """ResolvedParadigm must survive model_dump / model_validate round-trips."""

    def test_resolved_paradigm_model_dump_and_validate(self) -> None:
        """ResolvedParadigm.model_dump() + model_validate() round-trips without data loss."""
        from src.schemas.lexgen import ResolvedField

        paradigm = ResolvedParadigm(
            lemma="θάλασσα",
            pos="noun",
            fields=[
                ResolvedField(field="gender", value="feminine", source="rules"),
            ],
            cross_checks={
                "gender": [FieldEvidence(source="wiktionary", field="gender", value="feminine")]
            },
            flagged_fields=[],
        )
        dumped = paradigm.model_dump()
        restored = ResolvedParadigm.model_validate(dumped)

        assert restored.lemma == paradigm.lemma
        assert restored.pos == paradigm.pos
        assert len(restored.fields) == 1
        assert restored.fields[0].field == "gender"
        assert restored.fields[0].value == "feminine"
        assert restored.fields[0].source == "rules"
        assert len(restored.cross_checks["gender"]) == 1
        assert restored.cross_checks["gender"][0].source == "wiktionary"

    def test_resolved_paradigm_empty_fields_is_valid(self) -> None:
        """ResolvedParadigm with no resolved fields must be a valid state (e.g. all sources absent)."""
        paradigm = ResolvedParadigm(lemma="ξ", pos="noun")
        assert paradigm.fields == []
        assert paradigm.cross_checks == {}
        assert paradigm.flagged_fields == []


@pytest.mark.unit
class TestResolverForEdgeCases:
    """resolver_for must degrade gracefully on unusual pos values."""

    def test_resolver_for_empty_string_returns_none(self) -> None:
        """resolver_for('') must return None — empty string is not a registered POS."""
        assert resolver_for("") is None

    def test_resolver_for_uppercase_noun_returns_none(self) -> None:
        """resolver_for('NOUN') returns None — the registry key is lowercase 'noun'."""
        assert resolver_for("NOUN") is None

    def test_resolver_for_whitespace_returns_none(self) -> None:
        """resolver_for(' noun ') returns None — whitespace is not normalised."""
        assert resolver_for(" noun ") is None


@pytest.mark.unit
class TestLexiconGenderRungMissingFeatureKey:
    """Lexicon gender rung must treat bundles with no 'gender' feature key as non-contributing."""

    def test_forms_without_gender_feature_key_return_none(self) -> None:
        """Forms with case+number but no 'gender' key contribute nothing to gender extraction.

        The rung must return None (not crash, not fabricate a value).
        """
        forms = [
            FormBundle(form="θάλασσα", features={"case": "nominative", "number": "singular"}),
            FormBundle(form="θαλάσσης", features={"case": "genitive", "number": "singular"}),
        ]
        packet = _make_packet(lexicon_present=True, lexicon_forms=forms)
        ctx = _make_ctx("θάλασσα")

        rungs = NOUN_CHAINS[("noun", "gender")]
        # Check the lexicon rung specifically
        for rung in rungs:
            ev = rung(packet, ctx)
            if ev is not None and ev.source == "lexicon":
                pytest.fail(
                    f"Lexicon gender rung must return None when no 'gender' feature key "
                    f"is present in any form, but returned {ev}"
                )

    def test_mixed_forms_some_with_gender_some_without(self) -> None:
        """Only bundles that have a 'gender' key contribute to the set; absent-key bundles are ignored."""
        forms = [
            FormBundle(form="θαλάσσης", features={"case": "genitive", "number": "singular"}),
            # no gender key above
            FormBundle(
                form="θάλασσα",
                features={"case": "nominative", "number": "singular", "gender": "feminine"},
            ),
        ]
        packet = _make_packet(lexicon_present=True, lexicon_forms=forms)
        ctx = _make_ctx("θάλασσα")

        rungs = NOUN_CHAINS[("noun", "gender")]
        lexicon_result = None
        for rung in rungs:
            ev = rung(packet, ctx)
            if ev is not None and ev.source == "lexicon":
                lexicon_result = ev
                break

        assert (
            lexicon_result is not None
        ), "Lexicon gender rung must return evidence when at least one form has gender"
        assert lexicon_result.value == "feminine"


@pytest.mark.unit
class TestDR3NoConfidence:
    """DR §3: no rung may set a numeric confidence — confidence must always be None (inert/logged-only)."""

    def _all_rung_results(self) -> list[FieldEvidence]:
        """Drive every rung with a maximally-populated packet and collect all non-None results."""
        forms = [
            FormBundle(
                form="θάλασσα",
                features={"case": "nominative", "number": "singular", "gender": "feminine"},
            )
        ]
        packet = _make_packet(
            normalized_lemma="θάλασσα",
            pos="noun",
            wikt_present=True,
            wikt_gender="feminine",
            wikt_pronunciation="θaˈlasa",
            wikt_forms=forms,
            lexicon_present=True,
            lexicon_forms=forms,
            freq_present=True,
            freq_rank=7,
            rules_present=True,
        )
        ctx = _make_ctx("θάλασσα", resolved={"gender": "feminine"})

        results = []
        for rungs in NOUN_CHAINS.values():
            for rung in rungs:
                ev = rung(packet, ctx)
                if ev is not None:
                    results.append(ev)
        return results

    def test_no_rung_sets_numeric_confidence(self) -> None:
        """Every rung leaves FieldEvidence.confidence at None (DR §3 — inert logged-only data).

        A rung that sets a numeric confidence would let a downstream consumer
        silently branch on it, violating the 'logged-only' decision record.
        """
        results = self._all_rung_results()
        assert results, "Must have collected at least one FieldEvidence from the rungs"
        for ev in results:
            assert ev.confidence is None, (
                f"Rung for source='{ev.source}' field='{ev.field}' "
                f"set confidence={ev.confidence!r}; DR §3 requires None"
            )


# ===========================================================================
# Mode A — Chain-walk tests (LEXGEN-08-02, 14 Test Specs)
#
# These tests verify NounResolver.resolve() — the first-confident-wins walk,
# disagreement / unresolved flagging, gender-before-declension dependency, and
# IPA validator gating.  All tests FAIL RED because NounResolver.resolve raises
# NotImplementedError until 08-02 is implemented.
#
# Pinned witness values (derived from real module outputs):
#   derive_gender("θάλασσα")           -> "feminine"
#   derive_gender("βιβλίο")            -> AMBIGUOUS  (ends -ο, no gender rule)
#   derive_gender("καφές")             -> AMBIGUOUS  (ends -ς/-ης/-ας shared)
#   derive_declension_group("βιβλίο", "neuter") -> "neuter_o"
#   derive_declension_group("θάλασσα","feminine") -> "feminine_a"
#   normalize_ipa("vivˈlio")           -> "vivlio"
#   validate_ipa("βιβλίο", "vivˈlio") -> G2PResult(ok=True, reason=None)
#   normalize_ipa("θaˈlasa")           -> "θalasa"
#   validate_ipa("θάλασσα","θaˈlasa") -> G2PResult(ok=True, reason=None)
#
# NOTE: derive_gender("βιβλίο") is AMBIGUOUS (not "neuter").  Tests that need
# βιβλίο resolved to "neuter" supply it via wikt_gender="neuter" in the packet
# OR directly in ctx.resolved["gender"], bypassing the rules rung.
# ===========================================================================


@pytest.mark.unit
class TestChainWalkFirstConfidentWins:
    """AC-1: first rung with a non-null value becomes primary; remaining are cross-checks."""

    def test_first_confident_rung_wins(self) -> None:
        """Rules gender='feminine' (θάλασσα) AND wikt gender='feminine' -> primary source='rules'.

        The rules rung is rank-1 co-rank-1 and returns a confident value ('feminine').
        The wiktionary rung also returns 'feminine' but becomes a cross-check, not primary.
        """
        packet = _make_packet(
            normalized_lemma="θάλασσα",
            pos="noun",
            rules_present=True,
            wikt_present=True,
            wikt_gender="feminine",
        )
        resolver = NounResolver()
        paradigm = resolver.resolve("θάλασσα", packet)

        gender_field = next(f for f in paradigm.fields if f.field == "gender")
        assert gender_field.value == "feminine"
        assert (
            gender_field.source == "rules"
        ), f"Expected primary source='rules' (first co-rank-1 rung), got '{gender_field.source}'"

    def test_agreeing_lower_rung_no_flag(self) -> None:
        """Rules='neuter'(*), wikt gender='neuter', lexicon gender='neuter' (βιβλίο) -> no flag.

        (*) βιβλίο's rules rung returns AMBIGUOUS (ends -ο, no gender rule), so the
        ACTUAL primary here is wiktionary.  Both wikt and lexicon agree -> flags empty.
        We supply wikt_gender='neuter' and lexicon forms with gender='neuter'.
        """
        forms = [
            FormBundle(
                form="βιβλίο",
                features={"case": "nominative", "number": "singular", "gender": "neuter"},
            ),
            FormBundle(
                form="βιβλίου",
                features={"case": "genitive", "number": "singular", "gender": "neuter"},
            ),
        ]
        packet = _make_packet(
            normalized_lemma="βιβλίο",
            pos="noun",
            rules_present=True,
            wikt_present=True,
            wikt_gender="neuter",
            lexicon_present=True,
            lexicon_forms=forms,
        )
        resolver = NounResolver()
        paradigm = resolver.resolve("βιβλίο", packet)

        gender_field = next(f for f in paradigm.fields if f.field == "gender")
        assert gender_field.value == "neuter"
        # No disagreement flags — all sources agree
        disagreement_flags = [fl for fl in gender_field.flags if fl.startswith("disagreement:")]
        assert (
            disagreement_flags == []
        ), f"Agreeing sources must produce no disagreement flags; got {gender_field.flags}"
        assert (
            "gender" not in paradigm.flagged_fields
        ), "Agreeing gender field must NOT appear in flagged_fields"
        # cross_checks for gender must all agree
        if "gender" in paradigm.cross_checks:
            for cc in paradigm.cross_checks["gender"]:
                assert (
                    cc.value == "neuter"
                ), f"Cross-check source='{cc.source}' should agree value='neuter', got '{cc.value}'"

    def test_lower_rank_disagreement_flags_field(self) -> None:
        """Wikt gender='masculine' (rank-1 primary, rules AMBIGUOUS), lexicon='feminine' (rank-2).

        Primary = wikt (first confident rung at rank-1).  Lexicon disagrees at rank-2
        -> flag 'disagreement:gender:wiktionary!=lexicon' AND 'gender' in flagged_fields.
        Primary value 'masculine' is still returned (AC-2).
        """
        forms = [
            FormBundle(
                form="ποιητής",
                features={"case": "nominative", "number": "singular", "gender": "feminine"},
            )
        ]
        packet = _make_packet(
            normalized_lemma="ποιητής",
            pos="noun",
            rules_present=True,
            wikt_present=True,
            wikt_gender="masculine",
            lexicon_present=True,
            lexicon_forms=forms,
        )
        resolver = NounResolver()
        paradigm = resolver.resolve("ποιητής", packet)

        gender_field = next(f for f in paradigm.fields if f.field == "gender")
        assert (
            gender_field.value == "masculine"
        ), f"Primary value must be 'masculine' (wikt primary), got '{gender_field.value}'"
        assert (
            "disagreement:gender:wiktionary!=lexicon" in gender_field.flags
        ), f"Expected 'disagreement:gender:wiktionary!=lexicon' in flags, got {gender_field.flags}"
        assert (
            "gender" in paradigm.flagged_fields
        ), "Field with disagreement must appear in flagged_fields"

    def test_corank_disagreement_also_flags_field(self) -> None:
        """Co-rank-1 rules='neuter' (βιβλίο — WAIT: rules AMBIGUOUS for βιβλίο).

        Use θάλασσα where rules give 'feminine', then supply wikt gender='masculine'
        to get a genuine co-rank-1 disagreement.  Rules wins (D2 priority rules>wikt).
        Expected: value='feminine', source='rules', flag 'disagreement:gender:rules!=wiktionary',
        'gender' in flagged_fields.
        """
        packet = _make_packet(
            normalized_lemma="θάλασσα",
            pos="noun",
            rules_present=True,
            wikt_present=True,
            wikt_gender="masculine",  # deliberate mismatch at co-rank-1
        )
        resolver = NounResolver()
        paradigm = resolver.resolve("θάλασσα", packet)

        gender_field = next(f for f in paradigm.fields if f.field == "gender")
        assert (
            gender_field.source == "rules"
        ), f"rules rung must win at co-rank-1 (D2 priority), got source='{gender_field.source}'"
        assert gender_field.value == "feminine"
        assert (
            "disagreement:gender:rules!=wiktionary" in gender_field.flags
        ), f"Expected co-rank-1 disagreement flag, got {gender_field.flags}"
        assert "gender" in paradigm.flagged_fields

    def test_no_confident_source_unresolved_flag(self) -> None:
        """Rules AMBIGUOUS, wikt gender=None, lexicon no gender -> unresolved:gender + flagged.

        Expected: ResolvedField(field='gender', value=None, source='none'),
        'unresolved:gender' in flags, 'gender' in flagged_fields.
        """
        packet = _make_packet(
            normalized_lemma="καφές",
            pos="noun",
            rules_present=True,
            wikt_present=True,
            wikt_gender=None,  # no gender from wikt
            lexicon_present=True,
            lexicon_forms=[],  # no forms -> lexicon gender rung skipped
        )
        resolver = NounResolver()
        paradigm = resolver.resolve("καφές", packet)

        gender_field = next(f for f in paradigm.fields if f.field == "gender")
        assert (
            gender_field.value is None
        ), f"No confident source -> value must be None, got '{gender_field.value}'"
        assert (
            gender_field.source == "none"
        ), f"No confident source -> source must be 'none', got '{gender_field.source}'"
        assert (
            "unresolved:gender" in gender_field.flags
        ), f"Expected 'unresolved:gender' in flags, got {gender_field.flags}"
        assert "gender" in paradigm.flagged_fields


@pytest.mark.unit
class TestChainWalkLemmaExists:
    """AC-4: co-rank-1 lemma_exists; agreeing across wikt/lexicon/frequency -> no flag."""

    def test_corank_lemma_exists_priority_and_agreement(self) -> None:
        """wikt.present=True, lexicon.present=True, freq.present=True -> primary='wiktionary', no flag.

        D2 priority: wiktionary is first co-rank-1 rung for lemma_exists -> primary source.
        All three agree on value 'true' -> no disagreement flag, lemma_exists NOT in flagged_fields.
        """
        packet = _make_packet(
            normalized_lemma="θάλασσα",
            pos="noun",
            wikt_present=True,
            lexicon_present=True,
            freq_present=True,
            freq_rank=100,
        )
        resolver = NounResolver()
        paradigm = resolver.resolve("θάλασσα", packet)

        le_field = next((f for f in paradigm.fields if f.field == "lemma_exists"), None)
        assert le_field is not None, "lemma_exists must be present in resolved fields"
        assert le_field.value == "true"
        assert (
            le_field.source == "wiktionary"
        ), f"D2 priority: wiktionary must be primary for lemma_exists, got '{le_field.source}'"
        assert (
            "lemma_exists" not in paradigm.flagged_fields
        ), "All three sources agree on 'true' -> lemma_exists must NOT be in flagged_fields"


@pytest.mark.unit
class TestChainWalkDeclensionDependency:
    """AC-5: gender resolved before declension_group; ambiguous/None gender -> Rules rung skipped."""

    def test_declension_skips_rule_rung_when_gender_ambiguous(self) -> None:
        """καφές: rules gender AMBIGUOUS -> ctx.resolved['gender'] is None -> declension Rules rung skipped.

        If no other source supplies declension_group either, field is unresolved.
        The key invariant: the Rules rung must NOT be called (it would fabricate a group
        without a valid gender). We observe this by checking the field is unresolved
        (not 'masculine_is' or any fabricated value).
        """
        packet = _make_packet(
            normalized_lemma="καφές",
            pos="noun",
            rules_present=True,
            wikt_present=True,
            wikt_gender=None,
            lexicon_present=True,
            lexicon_forms=[],
        )
        resolver = NounResolver()
        paradigm = resolver.resolve("καφές", packet)

        decl_field = next((f for f in paradigm.fields if f.field == "declension_group"), None)
        if decl_field is not None:
            # The Rules rung must NOT have produced a value; it was skipped because gender is None.
            # The field may be unresolved (value=None, source='none') if no other rung supplies it.
            assert decl_field.value != "masculine_is", (
                "Rules rung must be skipped when gender is None/AMBIGUOUS; "
                "must not produce masculine_is"
            )
        # If decl_field is not present in fields at all, that is also acceptable
        # (implementation may omit fields with no rungs returning a value).
        # The important invariant is no fabricated group from the Rules rung.

    def test_resolved_gender_threaded_into_declension_rung(self) -> None:
        """βιβλίο: rules gender AMBIGUOUS, wikt gender='neuter' -> ctx.resolved['gender']='neuter'.

        After gender is resolved to 'neuter' (from wikt), the declension Rules rung is called
        with ('βιβλίο', 'neuter') -> derive_declension_group returns 'neuter_o'.
        Expected: declension_group primary value == 'neuter_o', source == 'rules'.
        """
        packet = _make_packet(
            normalized_lemma="βιβλίο",
            pos="noun",
            rules_present=True,
            wikt_present=True,
            wikt_gender="neuter",  # rules is AMBIGUOUS for βιβλίο; wikt supplies gender
        )
        resolver = NounResolver()
        paradigm = resolver.resolve("βιβλίο", packet)

        decl_field = next((f for f in paradigm.fields if f.field == "declension_group"), None)
        assert (
            decl_field is not None
        ), "declension_group must be present in resolved fields when gender is 'neuter'"
        assert (
            decl_field.value == "neuter_o"
        ), f"derive_declension_group('βιβλίο','neuter')='neuter_o'; got '{decl_field.value}'"
        assert decl_field.source == "rules"


@pytest.mark.unit
class TestChainWalkIpa:
    """AC-5: IPA Rules rung only runs when wikt.pronunciation is non-null."""

    def test_ipa_rule_rung_skipped_without_candidate(self) -> None:
        """wikt.pronunciation=None -> Rules validator not run; no wikt pronunciation either -> unresolved.

        Expected: ipa field value=None, source='none', 'unresolved:ipa' in flags.
        """
        packet = _make_packet(
            normalized_lemma="βιβλίο",
            pos="noun",
            wikt_present=True,
            wikt_pronunciation=None,
        )
        resolver = NounResolver()
        paradigm = resolver.resolve("βιβλίο", packet)

        ipa_field = next((f for f in paradigm.fields if f.field == "ipa"), None)
        if ipa_field is not None:
            assert ipa_field.value is None, "No pronunciation candidate -> ipa value must be None"
            assert (
                ipa_field.source == "none"
            ), f"No pronunciation -> source must be 'none', got '{ipa_field.source}'"
            assert (
                "unresolved:ipa" in ipa_field.flags
            ), f"Expected 'unresolved:ipa' in flags, got {ipa_field.flags}"

    def test_ipa_taken_unvalidated_when_only_wiktionary(self) -> None:
        """wikt.pronunciation present but NO rules candidate path results in wikt value + ipa_unvalidated.

        IMPORTANT: The IPA chain is:
          rung-0: Rules (validates wikt candidate — but returns None when wikt has NO pronunciation)
          rung-1: _wiktionary_pronunciation_rung (raw wikt value, no validation)

        When wikt.pronunciation IS present, the Rules rung IS called first (it validates the
        candidate).  To get the 'ipa_unvalidated' scenario we need the Rules rung to return
        value=None (i.e., validate_ipa fails, flags ipa_invalid) AND the wikt rung to be primary.

        Use a pronunciation string with illegal IPA symbols to force Rules to fail.
        Illegal symbol 'Q' (uppercase Q is not in the Greek phoneme inventory).
        Expected: value=='QBAD' (raw wikt), source='wiktionary', flag 'ipa_unvalidated'.

        NOTE: The spec says 'ipa_unvalidated' fires when 'no rules candidate path'.
        In the actual chain, the Rules rung IS present when wikt.pronunciation is non-null;
        it either validates (-> primary 'rules') or fails (-> value=None + ipa_invalid flag;
        chain continues to wikt rung which becomes primary with 'ipa_unvalidated').
        """
        illegal_ipa = "QBAD"  # 'Q' is illegal in GREEK_PHONEME_INVENTORY
        packet = _make_packet(
            normalized_lemma="τεστ",
            pos="noun",
            wikt_present=True,
            wikt_pronunciation=illegal_ipa,
        )
        resolver = NounResolver()
        paradigm = resolver.resolve("τεστ", packet)

        ipa_field = next((f for f in paradigm.fields if f.field == "ipa"), None)
        assert ipa_field is not None, "ipa field must be present when wikt.pronunciation is set"
        assert (
            ipa_field.value == illegal_ipa
        ), f"Wikt raw value must be primary when Rules rung fails; got '{ipa_field.value}'"
        assert (
            ipa_field.source == "wiktionary"
        ), f"Source must be 'wiktionary' when Rules validation fails, got '{ipa_field.source}'"
        assert "ipa_unvalidated" in ipa_field.flags, (
            f"Expected 'ipa_unvalidated' in flags when wikt value taken without validation, "
            f"got {ipa_field.flags}"
        )

    def test_ipa_rule_validates_wiktionary_candidate(self) -> None:
        """wikt.pronunciation='θaˈlasa' (legal IPA) -> Rules rung validates -> primary source='rules'.

        normalize_ipa('θaˈlasa') = 'θalasa' — all chars in GREEK_PHONEME_INVENTORY.
        validate_ipa returns ok=True -> ipa_evidence returns value='θalasa', source='rules'.
        Expected: ipa field value='θalasa', source='rules', no ipa_unvalidated/ipa_invalid flag.
        """
        packet = _make_packet(
            normalized_lemma="θάλασσα",
            pos="noun",
            wikt_present=True,
            wikt_pronunciation="θaˈlasa",
        )
        resolver = NounResolver()
        paradigm = resolver.resolve("θάλασσα", packet)

        ipa_field = next((f for f in paradigm.fields if f.field == "ipa"), None)
        assert ipa_field is not None, "ipa field must be present when pronunciation is supplied"
        assert (
            ipa_field.value == "θalasa"
        ), f"normalize_ipa('θaˈlasa')='θalasa'; got '{ipa_field.value}'"
        assert (
            ipa_field.source == "rules"
        ), f"Rules rung validates the legal IPA -> source must be 'rules', got '{ipa_field.source}'"
        bad_flags = [fl for fl in ipa_field.flags if fl.startswith("ipa_")]
        assert (
            bad_flags == []
        ), f"No ipa_* flags expected when validation passes; got {ipa_field.flags}"


@pytest.mark.unit
class TestChainWalkRuleAmbiguousPropagated:
    """Rule-ambiguous evidence carries the flag but does NOT become primary (never-invent)."""

    def test_rule_ambiguous_flag_propagated_not_primary(self) -> None:
        """Rules gender AMBIGUOUS (καφές) but wikt gender='feminine' -> primary=wikt, flag carried.

        The Rules rung returns FieldEvidence(value=None, flags=['rule_ambiguous']).
        'rule_ambiguous' must appear in the resolved gender field's flags (carried through),
        but the primary value must be 'feminine' from wiktionary (not None from rules).
        """
        packet = _make_packet(
            normalized_lemma="καφές",
            pos="noun",
            rules_present=True,
            wikt_present=True,
            wikt_gender="feminine",
        )
        resolver = NounResolver()
        paradigm = resolver.resolve("καφές", packet)

        gender_field = next(f for f in paradigm.fields if f.field == "gender")
        assert (
            gender_field.value == "feminine"
        ), f"Primary must be wikt 'feminine'; got '{gender_field.value}'"
        assert (
            gender_field.source == "wiktionary"
        ), f"Primary source must be 'wiktionary'; got '{gender_field.source}'"
        assert "rule_ambiguous" in gender_field.flags, (
            f"rule_ambiguous flag from the Rules rung must be carried into the field; "
            f"got {gender_field.flags}"
        )


@pytest.mark.unit
class TestChainWalkNoNumericConfidence:
    """AC-6: every ResolvedField.confidence is None; no numeric constant from {0.05,0.20,...}."""

    _FORBIDDEN_CONSTANTS: frozenset[float] = frozenset({0.05, 0.20, 0.85, 0.90, 0.75})

    def test_no_numeric_routing_confidence_is_none(self) -> None:
        """Any resolved paradigm: all ResolvedField.confidence values must be None (DR §3).

        Also checks that none of the forbidden routing constants appear as confidence values.
        """
        forms = [
            FormBundle(
                form="θάλασσα",
                features={"case": "nominative", "number": "singular", "gender": "feminine"},
            )
        ]
        packet = _make_packet(
            normalized_lemma="θάλασσα",
            pos="noun",
            rules_present=True,
            wikt_present=True,
            wikt_gender="feminine",
            wikt_pronunciation="θaˈlasa",
            wikt_forms=forms,
            lexicon_present=True,
            lexicon_forms=forms,
            freq_present=True,
            freq_rank=7,
        )
        resolver = NounResolver()
        paradigm = resolver.resolve("θάλασσα", packet)

        assert paradigm.fields, "Paradigm must have at least one resolved field"
        for rf in paradigm.fields:
            assert rf.confidence is None, (
                f"ResolvedField field='{rf.field}' has confidence={rf.confidence!r}; "
                f"DR §3 requires None"
            )
            if rf.confidence is not None:
                assert (
                    rf.confidence not in self._FORBIDDEN_CONSTANTS
                ), f"Forbidden routing constant {rf.confidence} found in field '{rf.field}'"


@pytest.mark.unit
class TestChainWalkFrequencyRank:
    """AC-1/F8: frequency_rank is resolved from packet.sources.frequency.rank as str."""

    def test_frequency_rank_resolved_from_packet(self) -> None:
        """freq.rank=42 -> resolve frequency_rank -> value='42' (int->str, F8), source='frequency'.

        Expected: ResolvedField(field='frequency_rank', value='42', source='frequency').
        """
        packet = _make_packet(
            normalized_lemma="θάλασσα",
            pos="noun",
            freq_present=True,
            freq_rank=42,
        )
        resolver = NounResolver()
        paradigm = resolver.resolve("θάλασσα", packet)

        freq_field = next((f for f in paradigm.fields if f.field == "frequency_rank"), None)
        assert freq_field is not None, "frequency_rank must be present when freq.rank=42"
        assert (
            freq_field.value == "42"
        ), f"int rank must be converted to str '42'; got '{freq_field.value}'"
        assert freq_field.source == "frequency"
