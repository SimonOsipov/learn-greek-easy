"""RED integration tests for LEXGEN-10-03: LexgenVerifyService gate orchestration.

These tests verify the end-to-end gate orchestration against a REAL Postgres db_session
(function-scoped AsyncSession at :5433) and real spaCy (el_core_news_md singleton).

Test specs from the story (VS-01 through VS-09; VS-06/VS-08 are the unit file):

VS-01 worked-example-pass:
    §7 canonical sentence ("Η μητέρα διαβάζει ένα βιβλίο στο σπίτι.", target βιβλίο)
    + seeded cefr_lemma rows → verify() outcome PASS.

VS-02 out-of-vocab-fail:
    Sentence contains a non-seeded content word (κβάντο) not in cefr_lemma
    → Check E gate fail; proposal.flagged_fields contains "check_e".

VS-03 missing-target-fail:
    Sentence omits the target lemma βιβλίο
    → target-attested gate fail.

VS-04 gloss-not-in-wikt-warn:
    gloss_en="tome" ∉ {"book", "volume"}, sentence otherwise valid
    → gloss gate warns; flagged_fields contains "gloss_en"; NOT a hard regeneration.

VS-05 whitespace-gloss-reject:
    gloss_en="  " (whitespace-only)
    → gloss gate hard fail (whitespace-reject).

VS-07 unknown-token-flag-not-fail:
    Sentence has a proper noun spaCy+LexiconService can't lemmatize
    → unknown_to_analyzer flagged; Check E NOT hard-failed by it.

VS-09 contraction-pass:
    "στο" → spaCy lemma "σε ο"; both split parts closed-class & seeded
    → Check E PASSES (contraction split handled end-to-end).

Expected RED failure mode: NotImplementedError
  Tests call await svc.verify(proposal) WITHOUT catching the exception.
  They FAIL because verify() raises NotImplementedError immediately.
  This is the correct RED mode: implementation error, NOT import/collection error.

Seeding MUST succeed for every test; if a seeding/collection error appears,
fix the scaffold (seeding must work so the ONLY failure is NotImplementedError).

===========================================================================
SEAM CONTRACT — pinned by these RED tests:
1.  LexgenVerifyService(db: AsyncSession, openrouter: OpenRouterService).
2.  async def verify(self, proposal: WordProposal) -> VerifyOutcome.
3.  VerifyOutcome.status: "PASS" | "FLAGGED" | "REJECTED".
4.  VerifyOutcome.gate_results: list[GateResult].
5.  VerifyOutcome.flagged: list[str].
6.  On FLAGGED outcome: failing gate/field names written to proposal.flagged_fields.
7.  NEVER calls transition(). proposal.status stays GENERATING.
===========================================================================
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CefrLemma, WordProposal, WordProposalOrigin, WordProposalState
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
# Deferred import helper — keeps file collectable.
# The stub module exists; imports succeed. Tests FAIL on verify() raising
# NotImplementedError (not on import/collection errors).
# ---------------------------------------------------------------------------


def _get_service_class():
    """Import and return LexgenVerifyService."""
    from src.services.lexgen_verify_service import LexgenVerifyService  # noqa: PLC0415

    return LexgenVerifyService


def _make_service(db_session: AsyncSession) -> object:
    """Return a LexgenVerifyService bound to the test session, mocked OpenRouter.

    OpenRouter is mocked because the 10-03 stub never reads it (NotImplementedError
    fires before any use). The 10-04 regeneration loop integration tests (separate
    file) will supply a real mock with side-effects.
    """
    cls = _get_service_class()
    mock_openrouter = MagicMock()
    return cls(db=db_session, openrouter=mock_openrouter)


# ---------------------------------------------------------------------------
# Seeding helpers (mirrors test_cefr_vocabulary_service.py pattern exactly)
# ---------------------------------------------------------------------------


async def _seed_cefr_lemma(
    db_session: AsyncSession,
    *,
    lemma: str,
    level: str,
    source: str = "test",
    closed_class: bool = False,
) -> CefrLemma:
    """Insert a single CefrLemma row and flush (rollback-isolated)."""
    row = CefrLemma(lemma=lemma, level=level, source=source, closed_class=closed_class)
    db_session.add(row)
    await db_session.flush()
    return row


async def _seed_closed_class_function_words(db_session: AsyncSession) -> None:
    """Seed the minimal closed-class whitelist for the §7 worked example and VS-09.

    Per story AC: "Ensure σε, ο, το are present in the closed-class whitelist
    so a contracted token (e.g. στο→σε+ο) passes §7 regardless of split."
    """
    # Core contractions: σε+ο makes στο; ε+ι makes εί etc.
    closed_class_words = ["σε", "ο", "το", "η", "και", "να", "θα", "αν", "ή", "ένα"]
    for word in closed_class_words:
        await _seed_cefr_lemma(
            db_session,
            lemma=word,
            level="A1",  # level arm is moot — closed_class arm always includes
            closed_class=True,
        )


async def _seed_s7_content_words(db_session: AsyncSession) -> None:
    """Seed the §7 sentence content-word lemmas at A1/A2 level.

    §7 sentence: "Η μητέρα διαβάζει ένα βιβλίο στο σπίτι."
    Post-skip token ledger:
        η       — closed-class (seeded by _seed_closed_class_function_words)
        μητέρα  — A2 content word → seed
        διαβάζω — A2 (spaCy lemma of "διαβάζει") → seed
        ένα     — like_num=True → SKIPPED by verify service; no seed needed
        βιβλίο  — TARGET: always allowed; never seed (must pass even if absent)
        στο     → σε+ο contraction split; both closed-class → seeded above
        σπίτι   — A1 content word → seed
    """
    await _seed_cefr_lemma(db_session, lemma="μητέρα", level="A2")
    await _seed_cefr_lemma(db_session, lemma="διαβάζω", level="A2")
    await _seed_cefr_lemma(db_session, lemma="σπίτι", level="A1")


async def _make_generating_proposal(
    db_session: AsyncSession,
    *,
    target_lemma: str = "βιβλίο",
    gloss_en: str = "book",
    glosses_en: str = "book; volume",
    example_greek: str = "Η μητέρα διαβάζει ένα βιβλίο στο σπίτι.",
    example_translation: str = "The mother reads a book at home.",
) -> WordProposal:
    """Create and flush a WordProposal in GENERATING state with both JSONB columns.

    This is the standard fixture for all verify-service integration tests.
    Mirrors _make_generating_proposal from test_lexgen_reconciler.py but adds
    the generated_content column that verify() (unlike reconcile()) requires.
    """
    from src.core.word_proposal_state import transition  # noqa: PLC0415

    forms = [
        FormBundle(
            form=target_lemma,
            features={"case": "nominative", "number": "singular"},
        ),
    ]
    packet = EvidencePacket(
        lemma_input=target_lemma,
        normalized_lemma=target_lemma,
        pos="noun",
        sources=EvidencePacketSources(
            wiktionary=WiktionarySource(
                present=True,
                gender="neuter",
                forms=forms,
                glosses_en=glosses_en,
            ),
            greek_lexicon=GreekLexiconSource(
                present=True,
                forms=forms,
                attested_lemma=True,
                resolved_lemma=target_lemma,
            ),
            frequency=FrequencySource(present=True, rank=55, band="A1"),
            rules=RulesSource(present=True),
        ),
    )

    proposal = WordProposal(
        lemma_input=target_lemma,
        pos="noun",
        origin=WordProposalOrigin.ADMIN,
        requested_by=None,
        status=WordProposalState.PENDING,
    )
    db_session.add(proposal)
    await db_session.flush()

    # Advance PENDING → GENERATING via the state machine guard.
    transition(proposal, WordProposalState.GENERATING)

    # Populate both JSONB columns that verify() requires.
    proposal.evidence_packet = packet.model_dump(mode="json")
    proposal.generated_content = {
        "gloss_en": gloss_en,
        "gloss_ru": "книга",
        "example_greek": example_greek,
        "example_translation": example_translation,
    }
    proposal.flagged_fields = None
    await db_session.flush()
    return proposal


# ---------------------------------------------------------------------------
# VS-01 — §7 worked example → PASS end-to-end
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.db
class TestWorkedExamplePass:
    """VS-01: the canonical Architecture-Schematics §7 worked example → outcome PASS."""

    async def test_vs01_s7_worked_example_produces_pass(self, db_session: AsyncSession) -> None:
        """VS-01: seeded §7 CEFR rows + valid sentence + matching gloss → PASS.

        All three gates must pass:
          - Check E: all non-skip, non-target lemmas ∈ seeded set (A1/A2 + closed-class).
          - Target attested: βιβλίο is in the sentence.
          - Gloss subset: "book" ∈ {"book", "volume"}.

        RED: verify() raises NotImplementedError (stub not implemented).
        GREEN: outcome.status == "PASS".
        """
        await _seed_closed_class_function_words(db_session)
        await _seed_s7_content_words(db_session)

        proposal = await _make_generating_proposal(db_session)
        svc = _make_service(db_session)

        # RED: raises NotImplementedError.
        # GREEN: returns VerifyOutcome(status="PASS").
        outcome = await svc.verify(proposal)

        assert outcome.status == "PASS", (
            f"VS-01: §7 worked example must produce PASS; got {outcome.status!r}. "
            f"gate_results={outcome.gate_results!r}"
        )
        # No source services must have been re-queried (packet rebuilt from JSONB).
        # (Asserted implicitly: no external calls in a real-db integration test
        # without mock injection — if a source service were called it would hit
        # the empty test DB and likely return None, causing gate failures.)


# ---------------------------------------------------------------------------
# VS-02 — out-of-vocab content word → Check E fail
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.db
class TestOutOfVocabFail:
    """VS-02: out-of-CEFR content word in example → Check E fail → "check_e" in flagged_fields."""

    async def test_vs02_out_of_vocab_lemma_fails_check_e(self, db_session: AsyncSession) -> None:
        """VS-02: "κβάντο" is not in cefr_lemma and not the target → Check E fails.

        Per the 10-03 stub's _on_hard_fail: flags immediately (no regen yet).
        outcome.status == "FLAGGED"; proposal.flagged_fields contains "check_e".

        RED: verify() raises NotImplementedError.
        GREEN: outcome.status == "FLAGGED"; "check_e" in proposal.flagged_fields.
        """
        await _seed_closed_class_function_words(db_session)
        await _seed_s7_content_words(db_session)
        # κβάντο is deliberately NOT seeded — it is the out-of-vocab word.

        # §7 sentence with σπίτι replaced by κβάντο (out-of-vocab).
        proposal = await _make_generating_proposal(
            db_session,
            example_greek="Η μητέρα διαβάζει ένα βιβλίο στο κβάντο.",
        )
        svc = _make_service(db_session)

        # RED: raises NotImplementedError.
        # GREEN: outcome.status == "FLAGGED"; Check E gate failed.
        outcome = await svc.verify(proposal)

        assert (
            outcome.status == "FLAGGED"
        ), f"VS-02: out-of-vocab example must produce FLAGGED; got {outcome.status!r}"
        check_e_gates = [r for r in outcome.gate_results if r.gate == "check_e"]
        assert (
            len(check_e_gates) == 1
        ), f"VS-02: exactly one check_e gate result expected; got {outcome.gate_results!r}"
        assert not check_e_gates[0].passed, "VS-02: check_e gate must not pass"
        assert (
            check_e_gates[0].severity == "fail"
        ), f"VS-02: check_e severity must be 'fail'; got {check_e_gates[0].severity!r}"
        assert (
            proposal.flagged_fields is not None
        ), "VS-02: proposal.flagged_fields must be non-null after Check E fail"
        assert "check_e" in proposal.flagged_fields, (
            f"VS-02: 'check_e' must be in proposal.flagged_fields; "
            f"got {proposal.flagged_fields!r}"
        )


# ---------------------------------------------------------------------------
# VS-03 — missing target lemma → target-attested gate fail
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.db
class TestMissingTargetFail:
    """VS-03: sentence omits the target lemma βιβλίο → target-attested gate fails."""

    async def test_vs03_missing_target_fails_target_attested_gate(
        self, db_session: AsyncSession
    ) -> None:
        """VS-03: sentence without βιβλίο → target-attested gate fails.

        The sentence "Η μητέρα διαβάζει ένα σπίτι στο σπίτι." has no βιβλίο.
        All other content words are seeded. Only the target-attested gate fires.

        RED: verify() raises NotImplementedError.
        GREEN: target-attested gate in outcome.gate_results has passed=False.
        """
        await _seed_closed_class_function_words(db_session)
        await _seed_s7_content_words(db_session)

        # Sentence deliberately omits βιβλίο (the target).
        proposal = await _make_generating_proposal(
            db_session,
            example_greek="Η μητέρα διαβάζει ένα σπίτι στο σπίτι.",
        )
        svc = _make_service(db_session)

        # RED: raises NotImplementedError.
        # GREEN: target-attested gate reports fail.
        outcome = await svc.verify(proposal)

        target_gates = [r for r in outcome.gate_results if r.gate == "target_attested"]
        assert len(target_gates) == 1, (
            f"VS-03: exactly one target_attested gate result expected; "
            f"got {outcome.gate_results!r}"
        )
        assert not target_gates[
            0
        ].passed, "VS-03: target_attested gate must not pass when target lemma is absent"
        assert target_gates[0].severity == "fail", (
            f"VS-03: target_attested severity must be 'fail'; " f"got {target_gates[0].severity!r}"
        )


# ---------------------------------------------------------------------------
# VS-04 — gloss not in Wiktionary → warn/flag, NOT hard regeneration
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.db
class TestGlossNotInWiktWarn:
    """VS-04: non-empty gloss not in Wiktionary glosses → gloss gate warns; "gloss_en" flagged."""

    async def test_vs04_gloss_not_in_wikt_warns_and_flags_gloss_en(
        self, db_session: AsyncSession
    ) -> None:
        """VS-04: gloss="tome" ∉ {"book", "volume"} → warn; flagged_fields has "gloss_en";
        verify does NOT regenerate (D-GLOSS-SEVERITY: non-empty mismatch is warn-only).

        Check E and target-attested pass (§7 sentence, all words seeded).

        RED: verify() raises NotImplementedError.
        GREEN: gloss gate warns; "gloss_en" in proposal.flagged_fields;
               outcome.check_e_regens == 0 (no regen triggered).
        """
        await _seed_closed_class_function_words(db_session)
        await _seed_s7_content_words(db_session)

        # gloss_en="tome" ∉ "book; volume" → warn.
        proposal = await _make_generating_proposal(
            db_session,
            gloss_en="tome",
            glosses_en="book; volume",
        )
        svc = _make_service(db_session)

        # RED: raises NotImplementedError.
        # GREEN: gloss gate warns; "gloss_en" flagged.
        outcome = await svc.verify(proposal)

        gloss_gates = [r for r in outcome.gate_results if r.gate == "gloss_subset"]
        assert len(gloss_gates) == 1, (
            f"VS-04: exactly one gloss_subset gate result expected; "
            f"got {outcome.gate_results!r}"
        )
        assert not gloss_gates[0].passed, "VS-04: gloss gate must not pass for 'tome'"
        assert gloss_gates[0].severity == "warn", (
            "VS-04: non-empty gloss not in Wiktionary must be 'warn' (NOT 'fail'); "
            f"got {gloss_gates[0].severity!r}"
        )
        assert (
            proposal.flagged_fields is not None
        ), "VS-04: proposal.flagged_fields must be set after gloss warn"
        assert "gloss_en" in proposal.flagged_fields, (
            f"VS-04: 'gloss_en' must be in proposal.flagged_fields; "
            f"got {proposal.flagged_fields!r}"
        )
        # Warn does NOT trigger regen.
        assert outcome.check_e_regens == 0, (
            f"VS-04: warn-only result must not consume regen budget; "
            f"got check_e_regens={outcome.check_e_regens}"
        )


# ---------------------------------------------------------------------------
# VS-05 — whitespace-only gloss → hard fail
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.db
class TestWhitespaceGlossReject:
    """VS-05: whitespace-only gloss_en → gloss gate reports hard fail (whitespace-reject)."""

    async def test_vs05_whitespace_gloss_hard_fails_gloss_gate(
        self, db_session: AsyncSession
    ) -> None:
        """VS-05: gloss_en="  " → gloss gate severity="fail" (whitespace-reject path).

        Per D-GLOSS-SEVERITY and core/lexgen_verify.py check_gloss_subset():
        an empty/whitespace-only gloss is a HARD fail, not a warn.
        The 10-03 stub's _on_hard_fail flags immediately.

        RED: verify() raises NotImplementedError.
        GREEN: gloss gate severity=="fail"; outcome.status == "FLAGGED".
        """
        await _seed_closed_class_function_words(db_session)
        await _seed_s7_content_words(db_session)

        # gloss_en is whitespace-only → hard fail.
        proposal = await _make_generating_proposal(
            db_session,
            gloss_en="  ",
        )
        svc = _make_service(db_session)

        # RED: raises NotImplementedError.
        # GREEN: gloss gate severity=="fail".
        outcome = await svc.verify(proposal)

        gloss_gates = [r for r in outcome.gate_results if r.gate == "gloss_subset"]
        assert len(gloss_gates) == 1, (
            f"VS-05: exactly one gloss_subset gate result expected; "
            f"got {outcome.gate_results!r}"
        )
        assert not gloss_gates[0].passed, "VS-05: gloss gate must not pass for whitespace gloss"
        assert gloss_gates[0].severity == "fail", (
            "VS-05: whitespace-only gloss must be 'fail' (hard fail, NOT 'warn'); "
            f"got {gloss_gates[0].severity!r}"
        )


# ---------------------------------------------------------------------------
# VS-07 — unknown-to-analyzer token → flagged, Check E not hard-failed
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.db
class TestUnknownTokenFlagNotFail:
    """VS-07: token spaCy+lexicon can't resolve → unknown_to_analyzer; Check E not hard-failed."""

    async def test_vs07_unknown_proper_noun_does_not_fail_check_e(
        self, db_session: AsyncSession
    ) -> None:
        """VS-07: sentence contains Ξξξτεστ (made-up; spaCy uncertain; lexicon misses it).
        Per D-UNKNOWN: flag it as unknown_to_analyzer, do NOT hard-fail Check E.

        Sentence: "Η Ξξξτεστ διαβάζει ένα βιβλίο στο σπίτι."
        Ξξξτεστ replaces μητέρα. spaCy will likely return lemma == text (uncertain).
        LexiconService will return None for this made-up token.
        The verify service records unknown_to_analyzer and continues.
        All other content words are seeded.

        RED: verify() raises NotImplementedError.
        GREEN: check_e gate passes (unknown token does NOT count as out-of-vocab failure).
        """
        await _seed_closed_class_function_words(db_session)
        await _seed_s7_content_words(db_session)
        # Ξξξτεστ is deliberately NOT seeded.

        # Replace μητέρα with an obviously-made-up token spaCy won't have.
        proposal = await _make_generating_proposal(
            db_session,
            example_greek="Η Ξξξτεστ διαβάζει ένα βιβλίο στο σπίτι.",
        )
        svc = _make_service(db_session)

        # RED: raises NotImplementedError.
        # GREEN: check_e gate passes (unknown token does not cause hard fail).
        outcome = await svc.verify(proposal)

        check_e_gates = [r for r in outcome.gate_results if r.gate == "check_e"]
        assert len(check_e_gates) == 1, (
            f"VS-07: exactly one check_e gate result expected; " f"got {outcome.gate_results!r}"
        )
        assert check_e_gates[0].passed, (
            "VS-07: Check E must PASS even with an unknown-to-analyzer token. "
            "D-UNKNOWN: flag it, do not treat as out-of-vocab. "
            f"offending={check_e_gates[0].offending!r}"
        )


# ---------------------------------------------------------------------------
# VS-09 — contraction στο → σε+ο; both closed-class & seeded → Check E PASS
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.db
class TestContractionPass:
    """VS-09: "στο" → spaCy lemma "σε ο"; split parts are closed-class → Check E PASS."""

    async def test_vs09_contraction_split_and_passes_check_e(
        self, db_session: AsyncSession
    ) -> None:
        """VS-09: "στο σπίτι" in sentence; spaCy returns "σε ο" as lemma for "στο".
        The verify service splits "σε ο" → ["σε", "ο"], normalizes each, asserts
        membership. Both "σε" and "ο" are seeded as closed_class=True → Check E PASSES.

        This tests the contraction-handling path end-to-end (AC F6).
        Without the split, "σε ο" (space-joined) would not be in the allowed set
        and Check E would false-fail on every contracted sentence.

        RED: verify() raises NotImplementedError.
        GREEN: check_e gate passes; outcome.status == "PASS".
        """
        await _seed_closed_class_function_words(db_session)  # seeds σε, ο, etc.
        await _seed_s7_content_words(db_session)

        # §7 sentence — contains "στο σπίτι" (the canonical contraction test case).
        proposal = await _make_generating_proposal(
            db_session,
            example_greek="Η μητέρα διαβάζει ένα βιβλίο στο σπίτι.",
        )
        svc = _make_service(db_session)

        # RED: raises NotImplementedError.
        # GREEN: outcome.status == "PASS"; check_e gate passes.
        outcome = await svc.verify(proposal)

        assert outcome.status == "PASS", (
            "VS-09: contraction στο→σε+ο must be split and both parts pass Check E "
            "via the closed-class whitelist; "
            f"got outcome.status={outcome.status!r}. "
            f"gate_results={outcome.gate_results!r}"
        )
        check_e_gates = [r for r in outcome.gate_results if r.gate == "check_e"]
        assert len(check_e_gates) == 1, (
            f"VS-09: exactly one check_e gate result expected; " f"got {outcome.gate_results!r}"
        )
        assert check_e_gates[0].passed, (
            "VS-09: Check E must PASS with στο→σε+ο contraction split correctly handled. "
            f"offending={check_e_gates[0].offending!r}"
        )
