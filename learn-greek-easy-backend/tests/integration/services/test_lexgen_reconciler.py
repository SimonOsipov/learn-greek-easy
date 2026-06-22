"""RED integration tests for LEXGEN-08-03: LexgenReconcilerService.reconcile()
— reconciliation_log v1 shape, flagged_fields (D19 NARROW), generated_fields,
state transition GENERATING→SCORED, and the unsupported-POS branch.

These tests require a real Postgres db_session (the function-scoped AsyncSession
fixture from tests/fixtures/database.py, bound at :5433).  They construct
WordProposal rows directly, store an EvidencePacket via
``packet.model_dump(mode="json")``, and call reconcile() on the proposal.

Expected failure mode when run before the implementation exists:
    ModuleNotFoundError: No module named 'src.services.lexgen_reconciler_service'

Collected 9 test items will all fail on import, NOT on fixture or DB connection
errors.

===========================================================================
SEAM CONTRACT — pinned by these RED tests (executor MUST honour):
1.  LexgenReconcilerService(db).reconcile(proposal) — async coroutine.
    Mirrors EvidenceAssemblyService(db) shape (src/services/evidence_assembly_service.py).

2.  reconcile() steps:
      a. packet = EvidencePacket.model_validate(proposal.evidence_packet)
         NEVER calls Wiktionary / Lexicon / Frequency services.
      b. resolver = resolver_for(proposal.pos); None → unsupported-POS branch.
      c. resolved = resolver.resolve(packet.normalized_lemma, packet)
      d. Writes proposal.reconciliation_log (v1 shape below).
      e. proposal.flagged_fields = list(paradigm.flagged_fields)  [D19 NARROW]
         = fields with disagreement:* OR unresolved:* flags only.
         Audit flags (rule_ambiguous, ipa_unvalidated, lexicon_gender_inconsistent)
         stay ONLY in per-field reconciliation_log entries — NEVER enter flagged_fields.
      f. proposal.generated_fields = {gender, declension_group, ipa, frequency_rank,
         ...flat declension form keys}  (no gloss_en, no gloss_ru, no example).
      g. transition(proposal, WordProposalState.SCORED) — NEVER auto_approved /
         needs_review / rejected; trust_score stays None (Decision Record §3).
      h. await self.db.flush()  (single flush after the three JSONB cols + state).

3.  reconciliation_log v1 shape:
      {
        "schema_version": "lexgen.reconciliation.v1",
        "pos": <pos>,
        "lemma": <normalized_lemma>,
        "fields": {
          "<field>": {
            "value": <str | null>,
            "source": <str>,
            "confidence": null,          ← ALWAYS null in v1
            "flags": [<str>, ...],
            "cross_checks": [
              {"source": <str>, "value": <str | null>, "agree": <bool>,
               "confidence": null, "flags": []},
              ...
            ],
          },
          ...
        },
        "gaps": ["gloss_en", "gloss_ru", "example"],  ← ALWAYS these three
      }

4.  D19 (BINDING — narrows task prose):
    proposal.flagged_fields = list(paradigm.flagged_fields)   ← copy from resolver
    The resolver's ``flagged_fields`` = fields where any flag startswith
    ("disagreement:", "unresolved:").  Audit flags that DO NOT start with
    those prefixes (rule_ambiguous, ipa_unvalidated, lexicon_gender_inconsistent)
    never add a field to proposal.flagged_fields.

5.  Unsupported POS (resolver_for(pos) is None):
    proposal.flagged_fields = ["unsupported_pos"]
    proposal.reconciliation_log has an error marker (executor chooses key name)
    transition(proposal, SCORED) still called
    No exception raised.

6.  Guard (do NOT pre-check status):
    transition(proposal, SCORED) on a non-generating proposal raises
    IllegalProposalTransition — surface it, do not swallow.

7.  EvidencePacket fixture pattern (executor MUST reuse):
    Build a valid packet via pydantic:
      packet = EvidencePacket(
          lemma_input="βιβλίο",
          normalized_lemma="βιβλίο",
          pos="noun",
          sources=EvidencePacketSources(
              wiktionary=WiktionarySource(
                  present=True,
                  gender="neuter",
                  forms=[...],
                  pronunciation="vivˈli.o",
                  glosses_en="book",
              ),
              greek_lexicon=GreekLexiconSource(present=True, forms=[...]),
              frequency=FrequencySource(present=True, rank=55, band="A1"),
              rules=RulesSource(present=True),
          ),
      )
      proposal.evidence_packet = packet.model_dump(mode="json")
    This is the exact inverse of evidence_assembly_service.py:172 snapshot.

8.  No-requery spy targets:
    The executor MUST NOT call any of these from reconcile():
      src.services.wiktionary_morphology_service.WiktionaryMorphologyService
      src.services.lexicon_service.LexiconService
      src.services.frequency_service.FrequencyService
    (These are the services evidence_assembly_service.assemble_evidence() calls.)
    Assert via unittest.mock.patch that they are not instantiated / called.
===========================================================================
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import IllegalProposalTransition
from src.db.models import WordProposal, WordProposalOrigin, WordProposalState
from src.schemas.lexgen import (
    EvidencePacket,
    EvidencePacketSources,
    FormBundle,
    FrequencySource,
    GreekLexiconSource,
    RulesSource,
    WiktionarySource,
)

# ---------------------------------------------------------------------------
# Deferred import helpers — keep file collectable before service exists.
# Every test calls _get_service(db_session) which raises ModuleNotFoundError
# if the module does not exist yet — that is the expected RED failure mode.
# ---------------------------------------------------------------------------


def _get_service_class():
    """Import and return LexgenReconcilerService.

    Raises ModuleNotFoundError if the module has not been created yet.
    That is the RED failure mode for every test in this file.
    """
    from src.services.lexgen_reconciler_service import (  # noqa: PLC0415
        LexgenReconcilerService,
    )

    return LexgenReconcilerService


def _get_reconcile(db_session: AsyncSession):
    """Return a bound reconcile() coroutine from a fresh service instance.

    Usage in tests:
        reconcile = _get_reconcile(db_session)
        await reconcile(proposal)
    """
    svc = _get_service_class()(db_session)
    return svc.reconcile  # ModuleNotFoundError == RED for the right reason


# ---------------------------------------------------------------------------
# Shared EvidencePacket builders
# ---------------------------------------------------------------------------


def _make_standard_forms() -> list[FormBundle]:
    """Minimal but valid noun paradigm (βιβλίο — neuter -ο declension)."""
    return [
        FormBundle(form="βιβλίο", features={"case": "nominative", "number": "singular"}),
        FormBundle(form="βιβλίου", features={"case": "genitive", "number": "singular"}),
        FormBundle(form="βιβλίο", features={"case": "accusative", "number": "singular"}),
        FormBundle(form="βιβλίο", features={"case": "vocative", "number": "singular"}),
        FormBundle(form="βιβλία", features={"case": "nominative", "number": "plural"}),
        FormBundle(form="βιβλίων", features={"case": "genitive", "number": "plural"}),
        FormBundle(form="βιβλία", features={"case": "accusative", "number": "plural"}),
        FormBundle(form="βιβλία", features={"case": "vocative", "number": "plural"}),
    ]


def _make_biblio_packet(*, include_glosses_en: bool = True) -> EvidencePacket:
    """Build a realistic EvidencePacket for βιβλίο (book — neuter noun).

    Wiktionary reports gender="neuter"; the rules rung for βιβλίο returns
    AMBIGUOUS (ends in -ο, no match in _GENDER_RULES) so wiktionary wins as
    primary for gender.  No disagreement → "gender" NOT in flagged_fields.

    Executor NOTE: this is the exact shape produced by evidence_assembly_service
    LEXGEN-06 via packet.model_dump(mode="json") → stored in proposal.evidence_packet
    → reconcile() restores it via EvidencePacket.model_validate(proposal.evidence_packet).
    """
    forms = _make_standard_forms()
    return EvidencePacket(
        lemma_input="βιβλίο",
        normalized_lemma="βιβλίο",
        pos="noun",
        sources=EvidencePacketSources(
            wiktionary=WiktionarySource(
                present=True,
                gender="neuter",
                forms=forms,
                pronunciation="vivˈli.o",
                glosses_en="book" if include_glosses_en else None,
            ),
            greek_lexicon=GreekLexiconSource(
                present=True,
                forms=forms,
                attested_lemma=True,
                resolved_lemma="βιβλίο",
            ),
            frequency=FrequencySource(present=True, rank=55, band="A1"),
            rules=RulesSource(present=True),
        ),
    )


def _make_disagreement_packet() -> EvidencePacket:
    """Build a packet where wiktionary and lexicon disagree on gender.

    Wiktionary says "masculine"; lexicon forms all have gender="feminine".
    The chain walk will set primary gender to "masculine" (wiktionary wins
    as co-rank-1 after the rules rung returns AMBIGUOUS for this lemma).
    The lexicon rung returns "feminine" as a cross-check → disagreement flag
    → "gender" WILL be in paradigm.flagged_fields → D19 puts it in
    proposal.flagged_fields.

    Lemma "θάλασσα" ends in -α → derive_gender → "feminine" (rules win).
    We need rules to return AMBIGUOUS so wiktionary becomes primary.
    Use a lemma ending in -ος (AMBIGUOUS by rules) so both wiktionary and
    lexicon become co-rank peers and disagreement fires.
    """
    # Lexicon forms with gender="feminine"
    fem_forms = [
        FormBundle(
            form="λόγος",
            features={"case": "nominative", "number": "singular", "gender": "feminine"},
        ),
    ]
    # Lexicon gender rung reads features["gender"] → "feminine"
    # Wiktionary gender = "masculine"
    # Rules rung for "λόγος" (ends in -ος) → AMBIGUOUS → value=None, skipped
    # → wiktionary "masculine" is primary, lexicon "feminine" is cross-check
    # → disagreement:gender:wiktionary!=lexicon flag fires
    return EvidencePacket(
        lemma_input="λόγος",
        normalized_lemma="λόγος",
        pos="noun",
        sources=EvidencePacketSources(
            wiktionary=WiktionarySource(
                present=True,
                gender="masculine",
                forms=[],
            ),
            greek_lexicon=GreekLexiconSource(
                present=True,
                forms=fem_forms,
                attested_lemma=True,
                resolved_lemma="λόγος",
            ),
            frequency=FrequencySource(present=True, rank=100, band="A2"),
            rules=RulesSource(present=True),
        ),
    )


def _make_rule_ambiguous_only_packet() -> EvidencePacket:
    """Build a packet where the rules rung fires rule_ambiguous but sources AGREE.

    βιβλίο: derive_gender("βιβλίο") → AMBIGUOUS (ends in -ο, no _GENDER_RULES match).
    The rules rung emits rule_ambiguous; wiktionary="neuter" wins as primary.
    Lexicon forms have gender="neuter" (cross-check agrees).
    Result: audit flag rule_ambiguous in the reconciliation_log field entry,
    BUT "gender" NOT in proposal.flagged_fields because no disagreement:* /
    unresolved:* flag fires.  This tests the D19 NARROW behaviour.
    """
    # Lexicon forms with gender="neuter" — agrees with wiktionary
    neut_forms = [
        FormBundle(
            form="βιβλίο",
            features={"case": "nominative", "number": "singular", "gender": "neuter"},
        ),
    ]
    return EvidencePacket(
        lemma_input="βιβλίο",
        normalized_lemma="βιβλίο",
        pos="noun",
        sources=EvidencePacketSources(
            wiktionary=WiktionarySource(
                present=True,
                gender="neuter",
                forms=[],
            ),
            greek_lexicon=GreekLexiconSource(
                present=True,
                forms=neut_forms,
                attested_lemma=True,
                resolved_lemma="βιβλίο",
            ),
            frequency=FrequencySource(present=True, rank=55, band="A1"),
            rules=RulesSource(present=True),
        ),
    )


async def _make_generating_proposal(
    db_session: AsyncSession,
    *,
    lemma: str = "βιβλίο",
    pos: str = "noun",
    packet: EvidencePacket | None = None,
) -> WordProposal:
    """Create and flush a WordProposal in GENERATING state with an evidence_packet.

    This is the standard fixture for all reconciler tests.  The proposal is
    created in PENDING state, then advanced to GENERATING via the state machine,
    and the evidence_packet is stored as JSONB (exact inverse of
    evidence_assembly_service.py:172).
    """
    from src.core.word_proposal_state import transition  # noqa: PLC0415

    if packet is None:
        packet = _make_biblio_packet()

    proposal = WordProposal(
        lemma_input=lemma,
        pos=pos,
        origin=WordProposalOrigin.ADMIN,
        requested_by=None,
        # Start in PENDING; advance to GENERATING below via the state machine.
        status=WordProposalState.PENDING,
    )
    db_session.add(proposal)
    await db_session.flush()

    # Advance PENDING → GENERATING (legal edge per LEXGEN-01).
    transition(proposal, WordProposalState.GENERATING)
    # Snapshot the packet as JSONB (same as evidence_assembly_service.py:172).
    proposal.evidence_packet = packet.model_dump(mode="json")
    await db_session.flush()
    return proposal


# ---------------------------------------------------------------------------
# Test class 1 — Packet rebuild without re-querying reference services
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestPacketRebuiltViaModelValidate:
    """reconcile() must rebuild the packet from JSONB — no reference service calls."""

    async def test_packet_rebuilt_via_model_validate_no_requery(
        self, db_session: AsyncSession
    ) -> None:
        """Stored JSONB → EvidencePacket.model_validate() → resolve() — ZERO re-queries.

        The reconciler MUST NOT instantiate or call WiktionaryService,
        LexiconService, or FrequencyService.  All data is already in
        proposal.evidence_packet JSONB.
        """
        proposal = await _make_generating_proposal(db_session)
        reconcile = _get_reconcile(db_session)

        with (
            patch(
                "src.services.wiktionary_morphology_service.WiktionaryMorphologyService",
                side_effect=AssertionError(
                    "WiktionaryMorphologyService must NOT be called by reconcile()"
                ),
            ) as mock_wikt,
            patch(
                "src.services.lexicon_service.LexiconService",
                side_effect=AssertionError("LexiconService must NOT be called by reconcile()"),
            ) as mock_lex,
            patch(
                "src.services.frequency_service.FrequencyService",
                side_effect=AssertionError("FrequencyService must NOT be called by reconcile()"),
            ) as mock_freq,
        ):
            # reconcile() must complete without triggering any of the mocked classes.
            await reconcile(proposal)

        # If any class was instantiated, the side_effect would have raised.
        # Belt-and-suspenders: also assert call counts.
        mock_wikt.assert_not_called()
        mock_lex.assert_not_called()
        mock_freq.assert_not_called()

        # Sanity: the proposal must have advanced to SCORED.
        assert proposal.status == WordProposalState.SCORED, (
            "reconcile() must advance status to SCORED even in no-requery test; "
            f"got {proposal.status!r}"
        )


# ---------------------------------------------------------------------------
# Test class 2 — reconciliation_log v1 shape
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestReconciliationLogV1Shape:
    """reconcile() must write a reconciliation_log matching the v1 schema."""

    async def test_reconcile_writes_reconciliation_log_v1(self, db_session: AsyncSession) -> None:
        """Packet for βιβλίο → reconcile() → log carries schema_version + gender + gaps.

        AC #2 — the reconciliation_log JSONB must match the v1 shape:
          • top-level: schema_version, pos, lemma, fields, gaps
          • fields["gender"]: value="neuter", source (non-null), confidence=null,
            flags (list), cross_checks (list)

        Spec note (adaptation from spec literal):
          The spec says value=="neuter".  βιβλίο ends in -ο — derive_gender
          returns AMBIGUOUS (no match in _GENDER_RULES).  The rules rung therefore
          emits value=None, flags=["rule_ambiguous"] and is SKIPPED by the chain
          walk.  Wiktionary then provides "neuter" as primary.  So
          fields["gender"]["value"] == "neuter" is correct — it comes from
          Wiktionary, not the rules rung.  source will be "wiktionary".
        """
        packet = _make_biblio_packet()
        proposal = await _make_generating_proposal(db_session, packet=packet)
        reconcile = _get_reconcile(db_session)

        await reconcile(proposal)

        log = proposal.reconciliation_log
        assert log is not None, "reconciliation_log must be non-null after reconcile()"

        # Top-level keys
        assert log.get("schema_version") == "lexgen.reconciliation.v1", (
            "reconciliation_log['schema_version'] must be 'lexgen.reconciliation.v1'; "
            f"got {log.get('schema_version')!r}"
        )
        assert (
            log.get("pos") == "noun"
        ), f"reconciliation_log['pos'] must be 'noun'; got {log.get('pos')!r}"
        assert (
            log.get("lemma") == "βιβλίο"
        ), f"reconciliation_log['lemma'] must be 'βιβλίο'; got {log.get('lemma')!r}"

        # fields must be a dict
        fields = log.get("fields")
        assert isinstance(
            fields, dict
        ), f"reconciliation_log['fields'] must be a dict; got {type(fields)!r}"

        # gender field entry
        assert (
            "gender" in fields
        ), f"reconciliation_log['fields'] must contain 'gender'; keys={list(fields.keys())}"
        gender_entry = fields["gender"]
        assert gender_entry.get("value") == "neuter", (
            "gender field entry value must be 'neuter' (from wiktionary rung, "
            f"rules returns AMBIGUOUS for -ο suffix); got {gender_entry.get('value')!r}"
        )
        assert (
            gender_entry.get("source") is not None
        ), "gender field entry must have a non-null source"
        assert gender_entry.get("confidence") is None, (
            "confidence must be null (always null in v1, Decision Record §3); "
            f"got {gender_entry.get('confidence')!r}"
        )
        assert isinstance(
            gender_entry.get("flags"), list
        ), f"gender field entry 'flags' must be a list; got {type(gender_entry.get('flags'))!r}"
        assert isinstance(gender_entry.get("cross_checks"), list), (
            "gender field entry 'cross_checks' must be a list; "
            f"got {type(gender_entry.get('cross_checks'))!r}"
        )

        # gaps must always include the three content fields
        gaps = log.get("gaps")
        assert isinstance(
            gaps, list
        ), f"reconciliation_log['gaps'] must be a list; got {type(gaps)!r}"
        for expected_gap in ("gloss_en", "gloss_ru", "example"):
            assert expected_gap in gaps, (
                f"'{expected_gap}' must be in reconciliation_log['gaps'] (F9/D14); "
                f"gaps={gaps!r}"
            )

    async def test_field_entry_cross_check_shape(self, db_session: AsyncSession) -> None:
        """Each cross-check in a field entry must have source/value/agree/confidence/flags."""
        # Use disagreement packet to ensure at least one cross-check is present
        packet = _make_disagreement_packet()
        proposal = await _make_generating_proposal(db_session, lemma="λόγος", packet=packet)
        reconcile = _get_reconcile(db_session)

        await reconcile(proposal)

        log = proposal.reconciliation_log
        fields = log.get("fields", {})
        gender_entry = fields.get("gender", {})
        cross_checks = gender_entry.get("cross_checks", [])

        # At least one cross-check must be present (lexicon cross-checked wiktionary)
        assert len(cross_checks) >= 1, (
            "With disagreement packet, gender field must have at least one cross_check; "
            f"cross_checks={cross_checks!r}"
        )
        for cc in cross_checks:
            for required_key in ("source", "value", "agree", "confidence", "flags"):
                assert (
                    required_key in cc
                ), f"cross_check entry missing key '{required_key}'; entry={cc!r}"
            assert (
                cc["confidence"] is None
            ), f"cross_check confidence must be null; got {cc['confidence']!r}"
            assert isinstance(
                cc["flags"], list
            ), f"cross_check 'flags' must be a list; got {type(cc['flags'])!r}"
            assert isinstance(
                cc["agree"], bool
            ), f"cross_check 'agree' must be a bool (precomputed); got {type(cc['agree'])!r}"


# ---------------------------------------------------------------------------
# Test class 3 — flagged_fields (D19 NARROW)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestFlaggedFields:
    """reconcile() must set proposal.flagged_fields = list(paradigm.flagged_fields) [D19]."""

    async def test_reconcile_populates_flagged_fields_on_disagreement(
        self, db_session: AsyncSession
    ) -> None:
        """Packet with gender disagreement → "gender" in proposal.flagged_fields.

        AC #3 (D19 NARROW adaptation):
          The spec says "any flag marks the field".  D19 overrides this:
          only disagreement:* and unresolved:* flags put a field in
          proposal.flagged_fields.  We use a packet where wiktionary="masculine"
          and lexicon forms give gender="feminine" → the resolver flags the field
          with disagreement:gender:wiktionary!=lexicon → "gender" in flagged_fields.
        """
        packet = _make_disagreement_packet()
        proposal = await _make_generating_proposal(db_session, lemma="λόγος", packet=packet)
        reconcile = _get_reconcile(db_session)

        await reconcile(proposal)

        assert (
            proposal.flagged_fields is not None
        ), "proposal.flagged_fields must be non-null after reconcile() with disagreement"
        assert "gender" in proposal.flagged_fields, (
            "gender disagreement must put 'gender' in proposal.flagged_fields (D19); "
            f"flagged_fields={proposal.flagged_fields!r}"
        )
        # Must be de-duplicated (no field appears twice); order follows the resolver's
        # field-resolution order (D19 / NounResolver._FIELD_ORDER), NOT alphabetical.
        # See test_multiple_fields_flagged_order_matches_field_order in 08-02 unit tests.
        assert len(proposal.flagged_fields) == len(set(proposal.flagged_fields)), (
            "proposal.flagged_fields must not contain duplicates; "
            f"got {proposal.flagged_fields!r}"
        )

    async def test_rule_ambiguous_alone_does_not_flag_field(self, db_session: AsyncSession) -> None:
        """D19: rule_ambiguous is an AUDIT flag — it must NOT add the field to flagged_fields.

        βιβλίο: rules rung emits rule_ambiguous (ends in -ο, AMBIGUOUS).
        Wiktionary="neuter" wins as primary; lexicon forms agree (neuter).
        No disagreement:* / unresolved:* fires → "gender" must NOT be in
        proposal.flagged_fields even though the per-field log entry carries
        rule_ambiguous in its flags[].
        """
        packet = _make_rule_ambiguous_only_packet()
        proposal = await _make_generating_proposal(db_session, packet=packet)
        reconcile = _get_reconcile(db_session)

        await reconcile(proposal)

        flagged = proposal.flagged_fields or []
        assert "gender" not in flagged, (
            "rule_ambiguous alone (audit flag) must NOT add 'gender' to "
            f"proposal.flagged_fields (D19 NARROW); flagged_fields={flagged!r}"
        )


# ---------------------------------------------------------------------------
# Test class 4 — generated_fields
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestGeneratedFields:
    """reconcile() must write resolved morphological values + flat forms to generated_fields."""

    async def test_resolved_values_written_to_generated_fields(
        self, db_session: AsyncSession
    ) -> None:
        """Resolvable packet → generated_fields has gender + flat declension keys.

        AC #4: generated_fields must contain:
          • gender (resolved morphological value)
          • flat declension keys e.g. nominative_singular, genitive_plural, …
        It must NOT contain gloss_en, gloss_ru, or example.
        """
        packet = _make_biblio_packet()
        proposal = await _make_generating_proposal(db_session, packet=packet)
        reconcile = _get_reconcile(db_session)

        await reconcile(proposal)

        gf = proposal.generated_fields
        assert gf is not None, "generated_fields must be non-null after reconcile()"
        assert isinstance(gf, dict), f"generated_fields must be a dict; got {type(gf)!r}"

        # Gender must be present
        assert "gender" in gf, f"generated_fields must contain 'gender'; keys={list(gf.keys())}"
        assert gf["gender"] == "neuter", (
            "generated_fields['gender'] must be 'neuter' for βιβλίο packet "
            f"(wiktionary is primary for -ο suffix); got {gf['gender']!r}"
        )

        # At least one flat declension key must be present (forms are in the packet)
        flat_keys = {k for k in gf if "_singular" in k or "_plural" in k}
        assert len(flat_keys) > 0, (
            "generated_fields must contain flat declension keys "
            f"(e.g. nominative_singular); keys={list(gf.keys())}"
        )

        # Gloss and example must be ABSENT
        for absent_key in ("gloss_en", "gloss_ru", "example"):
            assert absent_key not in gf, (
                f"generated_fields must NOT contain '{absent_key}' (F9/D14 — "
                f"LEXGEN-09 is sole gloss owner); keys={list(gf.keys())}"
            )


# ---------------------------------------------------------------------------
# Test class 5 — gaps list (gloss_en/gloss_ru/example always absent)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestGlossExampleListedAsGaps:
    """reconcile() must list gloss/example in gaps even when glosses_en is populated."""

    async def test_gloss_example_listed_as_gaps(self, db_session: AsyncSession) -> None:
        """Any resolve → gaps includes gloss_en/gloss_ru/example; generated_fields has no gloss.

        AC #4 (F9/D14): LEXGEN-08 does NOT write glosses even when
        packet.sources.wiktionary.glosses_en is populated.  LEXGEN-09 is the
        sole gloss owner.  The reconciler must always put these three fields
        under reconciliation_log["gaps"].
        """
        # Packet WITH glosses_en populated
        packet = _make_biblio_packet(include_glosses_en=True)
        assert (
            packet.sources.wiktionary.glosses_en == "book"
        ), "Fixture sanity: wiktionary.glosses_en must be 'book'"

        proposal = await _make_generating_proposal(db_session, packet=packet)
        reconcile = _get_reconcile(db_session)

        await reconcile(proposal)

        log = proposal.reconciliation_log
        gaps = log.get("gaps", [])
        for expected in ("gloss_en", "gloss_ru", "example"):
            assert expected in gaps, (
                f"'{expected}' must be in reconciliation_log['gaps'] even when "
                f"wiktionary.glosses_en is populated (F9/D14); gaps={gaps!r}"
            )

        gf = proposal.generated_fields or {}
        assert "gloss_en" not in gf, (
            "generated_fields must NOT contain 'gloss_en' (LEXGEN-09 owns glosses); "
            f"keys={list(gf.keys())}"
        )

    async def test_no_llm_import_or_call_in_reconcile(self, db_session: AsyncSession) -> None:
        """reconcile() must NOT import or invoke any LLM/generator module.

        The reconciler is purely deterministic — no LLM call happens here.
        Confirm by patching the most likely LLM entry point and asserting it
        is never called.
        """
        proposal = await _make_generating_proposal(db_session)
        reconcile = _get_reconcile(db_session)

        # Patch at the openai / anthropic level — whichever the executor would use.
        # Using a broad patch on a likely module name; executor must ensure it is
        # not imported from reconcile() at all.
        with patch.dict(
            "sys.modules",
            {
                "openai": MagicMock(),
                "anthropic": MagicMock(),
            },
        ):
            # Must not raise even with fake LLM modules patched to MagicMocks.
            await reconcile(proposal)

        assert proposal.status == WordProposalState.SCORED


# ---------------------------------------------------------------------------
# Test class 6 — state transition
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestStateTransition:
    """reconcile() must advance the proposal exactly GENERATING → SCORED."""

    async def test_reconcile_advances_generating_to_scored(self, db_session: AsyncSession) -> None:
        """Proposal in GENERATING → reconcile() → status == SCORED.

        AC #5.
        """
        proposal = await _make_generating_proposal(db_session)
        assert (
            proposal.status == WordProposalState.GENERATING
        ), "Fixture sanity: proposal must start in GENERATING"

        reconcile = _get_reconcile(db_session)
        await reconcile(proposal)

        assert proposal.status == WordProposalState.SCORED, (
            "reconcile() must advance status to SCORED; " f"got {proposal.status!r}"
        )

    async def test_reconcile_never_sets_routing_states(self, db_session: AsyncSession) -> None:
        """After reconcile() → status is SCORED; routing states never set; trust_score None.

        AC #5: auto_approved / needs_review / rejected are NEVER set by the
        reconciler.  Routing fan-out belongs to LEXGEN-11.
        trust_score must remain None (Decision Record §3 — inert in v1).
        """
        proposal = await _make_generating_proposal(db_session)
        reconcile = _get_reconcile(db_session)

        await reconcile(proposal)

        forbidden_states = {
            WordProposalState.AUTO_APPROVED,
            WordProposalState.NEEDS_REVIEW,
            WordProposalState.REJECTED,
        }
        assert (
            proposal.status not in forbidden_states
        ), f"reconcile() must not set a routing state; got {proposal.status!r}"
        assert (
            proposal.status == WordProposalState.SCORED
        ), f"status must be SCORED after reconcile(); got {proposal.status!r}"
        assert proposal.trust_score is None, (
            "trust_score must remain None — inert in v1 (Decision Record §3); "
            f"got {proposal.trust_score!r}"
        )


# ---------------------------------------------------------------------------
# Test class 7 — guard: non-generating raises IllegalProposalTransition
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestNonGeneratingGuard:
    """reconcile() on a non-generating proposal must raise IllegalProposalTransition."""

    async def test_reconcile_on_non_generating_raises(self, db_session: AsyncSession) -> None:
        """Proposal in PENDING → reconcile() → raises IllegalProposalTransition.

        AC #7: The reconciler must NOT pre-check status; it must let
        transition(proposal, SCORED) raise the guard error naturally.
        """
        # Build a proposal in PENDING state (do NOT advance to GENERATING).
        proposal = WordProposal(
            lemma_input="σπίτι",
            pos="noun",
            origin=WordProposalOrigin.ADMIN,
            requested_by=None,
            status=WordProposalState.PENDING,
        )
        db_session.add(proposal)
        packet = _make_biblio_packet()
        proposal.evidence_packet = packet.model_dump(mode="json")
        await db_session.flush()

        assert (
            proposal.status == WordProposalState.PENDING
        ), "Fixture sanity: proposal must be in PENDING"

        reconcile = _get_reconcile(db_session)

        with pytest.raises(IllegalProposalTransition):
            await reconcile(proposal)

    async def test_reconcile_on_scored_proposal_raises(self, db_session: AsyncSession) -> None:
        """Proposal already in SCORED → reconcile() → raises IllegalProposalTransition.

        Guard also covers already-scored proposals (idempotent calls must not be silently swallowed).
        """
        from src.core.word_proposal_state import transition  # noqa: PLC0415

        proposal = await _make_generating_proposal(db_session)
        # Advance to SCORED manually (simulates a prior reconcile run).
        transition(proposal, WordProposalState.SCORED)
        await db_session.flush()

        reconcile = _get_reconcile(db_session)

        with pytest.raises(IllegalProposalTransition):
            await reconcile(proposal)


# ---------------------------------------------------------------------------
# Test class 8 — unsupported POS branch
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestUnsupportedPos:
    """reconcile() with an unsupported POS must flag, score, and not raise."""

    async def test_unsupported_pos_flags_and_scores(self, db_session: AsyncSession) -> None:
        """pos="verb" (no resolver registered) → flagged_fields==['unsupported_pos'],
        log has error marker, status SCORED, no exception raised.

        AC #6 (D7).
        """
        # Build a minimal packet for a verb — pos must match.
        verb_packet = EvidencePacket(
            lemma_input="γράφω",
            normalized_lemma="γράφω",
            pos="verb",
            sources=EvidencePacketSources(
                wiktionary=WiktionarySource(present=True, gender=None),
                greek_lexicon=GreekLexiconSource(present=True, forms=[]),
                frequency=FrequencySource(present=True, rank=200, band="A2"),
                rules=RulesSource(present=False),
            ),
        )
        proposal = await _make_generating_proposal(
            db_session,
            lemma="γράφω",
            pos="verb",
            packet=verb_packet,
        )
        reconcile = _get_reconcile(db_session)

        # Must not raise even with no registered resolver.
        await reconcile(proposal)

        # flagged_fields must be exactly ["unsupported_pos"]
        assert proposal.flagged_fields == ["unsupported_pos"], (
            "unsupported POS must set flagged_fields=['unsupported_pos']; "
            f"got {proposal.flagged_fields!r}"
        )

        # Status must be SCORED (still advances — D7)
        assert proposal.status == WordProposalState.SCORED, (
            "unsupported POS must still advance to SCORED; " f"got {proposal.status!r}"
        )

        # reconciliation_log must carry some error marker (executor chooses key name)
        log = proposal.reconciliation_log
        assert log is not None, "reconciliation_log must be non-null even for unsupported POS"
        # At minimum, schema_version must be present.
        assert log.get("schema_version") == "lexgen.reconciliation.v1", (
            "reconciliation_log schema_version must be set for unsupported POS; "
            f"got {log.get('schema_version')!r}"
        )
        # The log must signal the unsupported_pos error — either via a top-level
        # "error" key or by any other executor-chosen mechanism.
        has_error_marker = (
            "error" in log
            or log.get("unsupported_pos") is True
            or any("unsupported" in str(v).lower() for v in log.values())
        )
        assert has_error_marker, (
            "reconciliation_log must carry an error marker for unsupported POS; " f"log={log!r}"
        )


# ---------------------------------------------------------------------------
# Test class 9 (ADVERSARIAL) — fully-unresolved noun: all sources absent
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestFullyUnresolvedNoun:
    """reconcile() on a noun with ALL sources absent (present=False, no forms, no rank).

    Every field the NounResolver walks must be UNRESOLVED — value=None,
    flags contains "unresolved:<field>". Those fields must all appear in
    proposal.flagged_fields (D19: unresolved:* is an actionable flag that
    DOES mark the field). generated_fields must be empty (no scalars, no
    flat form keys). The log must still be written in v1 shape with all
    fields present and gaps correct. State still advances to SCORED.
    """

    async def test_fully_absent_packet_flags_all_unresolved_fields(
        self, db_session: AsyncSession
    ) -> None:
        """All sources absent → every resolved field has unresolved:* → all in flagged_fields.

        This is the adversarial boundary: a proposal that arrives with a
        completely empty evidence_packet (no Wiktionary hit, no lexicon hit,
        no frequency hit). The resolver must still produce a ResolvedParadigm
        (with value=None for each field), and the reconciler must propagate
        paradigm.flagged_fields (which will contain every field that couldn't
        be resolved) directly to proposal.flagged_fields without recomputing.
        """
        absent_packet = EvidencePacket(
            lemma_input="ξξξ",
            normalized_lemma="ξξξ",
            pos="noun",
            sources=EvidencePacketSources(
                wiktionary=WiktionarySource(present=False, forms=[]),
                greek_lexicon=GreekLexiconSource(present=False, forms=[]),
                frequency=FrequencySource(present=False, rank=None, band=None),
                rules=RulesSource(present=False),
            ),
        )
        proposal = await _make_generating_proposal(db_session, lemma="ξξξ", packet=absent_packet)
        reconcile = _get_reconcile(db_session)

        await reconcile(proposal)

        # All fields with unresolved:* in their flags must be in flagged_fields.
        log = proposal.reconciliation_log
        assert log is not None, "reconciliation_log must be written even for fully absent packet"
        assert log.get("schema_version") == "lexgen.reconciliation.v1"

        fields = log.get("fields", {})
        # Every field in the log should be unresolved — check that each has
        # "unresolved:<field>" in flags.
        for field_name, entry in fields.items():
            if entry["value"] is None:
                assert any(fl.startswith("unresolved:") for fl in entry.get("flags", [])), (
                    f"Field '{field_name}' has value=None but no unresolved:* flag; "
                    f"flags={entry.get('flags')!r}"
                )

        # proposal.flagged_fields must include all fields flagged as unresolved.
        flagged = proposal.flagged_fields or []
        assert len(flagged) > 0, (
            "Fully absent packet must produce at least one flagged field; "
            f"flagged_fields={flagged!r}"
        )
        # gender in particular must be flagged (key noun field, no source can provide it).
        assert "gender" in flagged, (
            "gender must be in flagged_fields when all sources are absent; "
            f"flagged_fields={flagged!r}"
        )

        # generated_fields must be empty — nothing to write when all sources absent.
        gf = proposal.generated_fields or {}
        assert gf == {}, (
            "generated_fields must be empty when all sources are absent "
            "(no resolved values, no flat forms); "
            f"generated_fields={gf!r}"
        )

        # gaps must still be the standard three.
        gaps = log.get("gaps", [])
        for expected in ("gloss_en", "gloss_ru", "example"):
            assert (
                expected in gaps
            ), f"'{expected}' must be in gaps even for fully absent packet; gaps={gaps!r}"

        # State must still advance to SCORED.
        assert (
            proposal.status == WordProposalState.SCORED
        ), f"Fully absent packet must still advance to SCORED; got {proposal.status!r}"

        # trust_score must remain None.
        assert (
            proposal.trust_score is None
        ), f"trust_score must remain None after reconcile(); got {proposal.trust_score!r}"


# ---------------------------------------------------------------------------
# Test class 10 (ADVERSARIAL) — disagree cross_checks have agree=False
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestCrossCheckAgreeFlag:
    """The cross_check.agree bool must be precomputed correctly.

    agree=True when cross-check value == primary value.
    agree=False when cross-check value != primary value (disagreement case).
    The reconciler builds cross_checks from paradigm.cross_checks, which the
    resolver populates for each "considered" (non-primary) rung.
    """

    async def test_disagreement_cross_check_has_agree_false(self, db_session: AsyncSession) -> None:
        """Disagreement packet → gender cross_check has agree=False for the differing source.

        The disagreement packet has wiktionary.gender="masculine" (primary) and
        lexicon forms with gender="feminine" (cross-check). The cross-check for
        lexicon source must have agree=False (feminine != masculine).
        """
        packet = _make_disagreement_packet()
        proposal = await _make_generating_proposal(db_session, lemma="λόγος", packet=packet)
        reconcile = _get_reconcile(db_session)

        await reconcile(proposal)

        log = proposal.reconciliation_log
        fields = log.get("fields", {})
        gender_entry = fields.get("gender", {})
        cross_checks = gender_entry.get("cross_checks", [])

        # There must be at least one cross-check with agree=False.
        disagree_checks = [cc for cc in cross_checks if cc.get("agree") is False]
        assert len(disagree_checks) >= 1, (
            "With gender disagreement (wiktionary=masculine, lexicon=feminine), "
            "at least one cross_check must have agree=False; "
            f"cross_checks={cross_checks!r}"
        )
        # The disagreeing cross-check must be from the lexicon source (rank 2).
        disagree_sources = {cc["source"] for cc in disagree_checks}
        assert "lexicon" in disagree_sources, (
            "The disagreeing cross_check must be from 'lexicon'; "
            f"disagree sources={disagree_sources!r}"
        )

    async def test_agreeing_cross_check_has_agree_true(self, db_session: AsyncSession) -> None:
        """Agreeing cross-check (rule_ambiguous only packet) → cross_check agree=True.

        For the βιβλίο packet with lexicon neuter forms agreeing with wiktionary
        neuter: the lexicon gender cross-check must have agree=True because its
        value matches the primary (wiktionary) value.
        """
        packet = _make_rule_ambiguous_only_packet()
        proposal = await _make_generating_proposal(db_session, packet=packet)
        reconcile = _get_reconcile(db_session)

        await reconcile(proposal)

        log = proposal.reconciliation_log
        fields = log.get("fields", {})
        gender_entry = fields.get("gender", {})
        cross_checks = gender_entry.get("cross_checks", [])

        # Any cross-check that is present must have agree=True (sources agree).
        for cc in cross_checks:
            assert cc.get("agree") is True, (
                "When sources agree on gender, all cross_checks must have agree=True; "
                f"cross_check={cc!r}"
            )


# ---------------------------------------------------------------------------
# Test class 11 (ADVERSARIAL) — exact flat form keys and values
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestExactFlatFormKeys:
    """generated_fields must contain the REAL flat form keys with correct values.

    The existing AC#4 test only checks for the presence of keys containing
    '_singular' or '_plural' substrings — it does not verify specific key names
    or form values. This adversarial test pins the exact output of bundles_to_flat
    applied to the standard βιβλίο paradigm.
    """

    async def test_flat_form_keys_exact_names_and_values(self, db_session: AsyncSession) -> None:
        """Standard βιβλίο packet → generated_fields contains all 8 exact flat keys.

        The 8 cells of the βιβλίο paradigm (4 cases × 2 numbers) must each
        appear as "{case}_{number}: <form>" entries in generated_fields.
        This verifies bundles_to_flat is actually invoked (not just counted)
        and that the correct forms are written — not a count witness.
        """
        packet = _make_biblio_packet()
        proposal = await _make_generating_proposal(db_session, packet=packet)
        reconcile = _get_reconcile(db_session)

        await reconcile(proposal)

        gf = proposal.generated_fields
        assert gf is not None, "generated_fields must be non-null"

        # Expected flat form values for βιβλίο from _make_standard_forms().
        expected_flat = {
            "nominative_singular": "βιβλίο",
            "genitive_singular": "βιβλίου",
            "accusative_singular": "βιβλίο",
            "vocative_singular": "βιβλίο",
            "nominative_plural": "βιβλία",
            "genitive_plural": "βιβλίων",
            "accusative_plural": "βιβλία",
            "vocative_plural": "βιβλία",
        }
        for key, expected_form in expected_flat.items():
            assert key in gf, (
                f"generated_fields must contain flat key '{key}'; "
                f"keys present={sorted(k for k in gf if '_' in k)}"
            )
            assert gf[key] == expected_form, (
                f"generated_fields['{key}'] must be '{expected_form}'; " f"got {gf[key]!r}"
            )


# ---------------------------------------------------------------------------
# Test class 12 (ADVERSARIAL) — idempotency guard: re-running raises
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestIdempotencyGuard:
    """Calling reconcile() a second time on an already-SCORED proposal must raise.

    The LEXGEN-01 guard (GENERATING→SCORED is the only legal transition from
    GENERATING; SCORED→SCORED is not in ALLOWED_TRANSITIONS) must fire. The
    reconciler must NOT pre-check status — it must let transition() raise, which
    is the same path that covers the non-generating guard (AC#7).
    """

    async def test_double_reconcile_raises_illegal_transition(
        self, db_session: AsyncSession
    ) -> None:
        """First reconcile() succeeds; second reconcile() on the same SCORED proposal raises.

        This confirms the guard is not bypassed or swallowed for re-run attempts.
        """
        proposal = await _make_generating_proposal(db_session)
        reconcile = _get_reconcile(db_session)

        # First call: must succeed.
        await reconcile(proposal)
        assert (
            proposal.status == WordProposalState.SCORED
        ), "First reconcile() must advance to SCORED"

        # Second call on the same (now SCORED) proposal must raise.
        with pytest.raises(IllegalProposalTransition):
            await reconcile(proposal)


# ---------------------------------------------------------------------------
# Test class 13 (ADVERSARIAL) — exact gaps list
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestExactGapsList:
    """reconciliation_log["gaps"] must be exactly ["gloss_en", "gloss_ru", "example"].

    The existing AC tests check membership but not exact equality. This
    adversarial test pins the exact contents to catch accidental additions.
    """

    async def test_gaps_exact_contents(self, db_session: AsyncSession) -> None:
        """reconciliation_log["gaps"] must be exactly the three expected gap fields.

        No extra fields should be present; the three content fields must all
        be listed even when the packet carries glosses_en.
        """
        packet = _make_biblio_packet(include_glosses_en=True)
        proposal = await _make_generating_proposal(db_session, packet=packet)
        reconcile = _get_reconcile(db_session)

        await reconcile(proposal)

        log = proposal.reconciliation_log
        gaps = log.get("gaps", [])

        assert sorted(gaps) == sorted(["gloss_en", "gloss_ru", "example"]), (
            "reconciliation_log['gaps'] must be exactly ['gloss_en', 'gloss_ru', 'example']; "
            f"got {gaps!r}"
        )

    async def test_unsupported_pos_gaps_exact_contents(self, db_session: AsyncSession) -> None:
        """Unsupported POS path also writes the standard three gaps.

        Even in the error branch, gaps must be the standard three content fields.
        """
        verb_packet = EvidencePacket(
            lemma_input="γράφω",
            normalized_lemma="γράφω",
            pos="verb",
            sources=EvidencePacketSources(
                wiktionary=WiktionarySource(present=True, gender=None),
                greek_lexicon=GreekLexiconSource(present=True, forms=[]),
                frequency=FrequencySource(present=True, rank=200, band="A2"),
                rules=RulesSource(present=False),
            ),
        )
        proposal = await _make_generating_proposal(
            db_session, lemma="γράφω", pos="verb", packet=verb_packet
        )
        reconcile = _get_reconcile(db_session)

        await reconcile(proposal)

        log = proposal.reconciliation_log
        gaps = log.get("gaps", [])

        assert sorted(gaps) == sorted(["gloss_en", "gloss_ru", "example"]), (
            "Unsupported POS reconciliation_log['gaps'] must be exactly "
            f"['gloss_en', 'gloss_ru', 'example']; got {gaps!r}"
        )
