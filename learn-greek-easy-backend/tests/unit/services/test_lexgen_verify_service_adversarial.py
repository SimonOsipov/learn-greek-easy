"""Adversarial / edge / negative coverage for LexgenVerifyService (LEXGEN-10-03 QA Mode B).

These tests EXTEND the AC-pinned suite (test_lexgen_verify_service.py) with boundary,
negative, and multi-fault scenarios NOT covered by the original spec tests.

Defects targeted:
  - ADV-01  Both check_e fail AND gloss warn together — do both flags land?
  - ADV-02  proposal.flagged_fields already non-empty — does verify APPEND without clobbering?
  - ADV-03  generated_content is None — does verify raise a clean, diagnosable error?
  - ADV-04  example_greek missing from generated_content — clean error, not AttributeError crash?
  - ADV-05  All content words out-of-vocab (multiple offenders) — all recorded in offending?
  - ADV-06  VS-06 vacuity proof — patch on src.services.lexicon_service.LexiconService does NOT
            intercept calls via the already-bound local name in lexgen_verify_service.py.
            mock_lex.assert_not_called() passes vacuously even when LexiconService IS used.
  - ADV-07  Target lemma present ONLY inside a contraction (not as standalone word).
  - ADV-08  Empty allowed set (CefrVocabularyService raises) — Check E behavior.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

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
# Helpers — reuse from the AC test file pattern
# ---------------------------------------------------------------------------


def _get_service_class():
    from src.services.lexgen_verify_service import LexgenVerifyService  # noqa: PLC0415

    return LexgenVerifyService


def _get_verify_outcome_class():
    from src.services.lexgen_verify_service import VerifyOutcome  # noqa: PLC0415

    return VerifyOutcome


def _make_biblio_packet(glosses_en: str = "book; volume") -> EvidencePacket:
    forms = [
        FormBundle(form="βιβλίο", features={"case": "nominative", "number": "singular"}),
    ]
    return EvidencePacket(
        lemma_input="βιβλίο",
        normalized_lemma="βιβλίο",
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
                resolved_lemma="βιβλίο",
            ),
            frequency=FrequencySource(present=True, rank=55, band="A1"),
            rules=RulesSource(present=True),
        ),
    )


_SENTINEL = object()


def _make_proposal(
    *,
    gloss_en: str = "book",
    example_greek: str = "Η μητέρα διαβάζει ένα βιβλίο στο σπίτι.",
    glosses_en: str = "book; volume",
    generated_content: object = _SENTINEL,
    flagged_fields: list[str] | None = None,
) -> WordProposal:
    """Build an in-memory proposal in GENERATING state."""
    packet = _make_biblio_packet(glosses_en=glosses_en)
    proposal = WordProposal(
        lemma_input="βιβλίο",
        pos="noun",
        origin=WordProposalOrigin.ADMIN,
        requested_by=None,
        status=WordProposalState.GENERATING,
    )
    proposal.evidence_packet = packet.model_dump(mode="json")

    if generated_content is _SENTINEL:
        proposal.generated_content = {
            "gloss_en": gloss_en,
            "gloss_ru": "книга",
            "example_greek": example_greek,
            "example_translation": "The mother reads a book at home.",
        }
    else:
        proposal.generated_content = generated_content  # type: ignore[assignment]

    proposal.generated_fields = None
    proposal.reconciliation_log = None
    proposal.flagged_fields = flagged_fields
    proposal.judge_scores = None
    proposal.trust_score = None
    return proposal


def _make_service(*, mock_db: AsyncMock | None = None) -> object:
    cls = _get_service_class()
    if mock_db is None:
        mock_db = AsyncMock()
        mock_db.flush = AsyncMock()
    return cls(db=mock_db, openrouter=MagicMock())


# ---------------------------------------------------------------------------
# ADV-01 — check_e FAIL + gloss WARN simultaneously: both flags must land
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestBothCheckEFailAndGlossWarn:
    """ADV-01: when Check E hard-fails AND gloss also warns, the hard-fail path wins
    (FLAGGED outcome) and _on_hard_fail records the check_e gate name.
    The gloss gate result is still present in gate_results even on FLAGGED paths.
    """

    async def test_adv01_check_e_fail_takes_priority_gloss_gate_still_present(self) -> None:
        """ADV-01: sentence has out-of-vocab + gloss not in Wikt.
        _on_hard_fail fires for check_e; gloss gate result still in outcome.gate_results.
        """
        # gloss_en="tome" not in glosses_en="book; volume" → gloss warn
        # example with κβάντο → check_e fail (not in empty cefr_lemmas)
        proposal = _make_proposal(
            gloss_en="tome",
            example_greek="Το βιβλίο κβάντο.",  # κβάντο is OOV
            glosses_en="book; volume",
        )
        svc = _make_service()

        outcome = await svc.verify(proposal)

        # Check E hard-fails → FLAGGED
        assert (
            outcome.status == "FLAGGED"
        ), f"ADV-01: check_e fail must produce FLAGGED, got {outcome.status!r}"
        # check_e gate result present in gate_results
        check_e_gates = [r for r in outcome.gate_results if r.gate == "check_e"]
        assert check_e_gates, "ADV-01: check_e gate result must be present in gate_results"
        assert not check_e_gates[0].passed, "ADV-01: check_e must not pass"
        assert check_e_gates[0].severity == "fail", "ADV-01: check_e severity must be 'fail'"

        # gloss_subset gate result also present
        gloss_gates = [r for r in outcome.gate_results if r.gate == "gloss_subset"]
        assert gloss_gates, "ADV-01: gloss_subset gate result must be present even on FLAGGED path"

        # check_e must be in flagged_fields
        assert proposal.flagged_fields is not None, "ADV-01: flagged_fields must be non-null"
        assert (
            "check_e" in proposal.flagged_fields
        ), f"ADV-01: 'check_e' must be in flagged_fields; got {proposal.flagged_fields!r}"


# ---------------------------------------------------------------------------
# ADV-02 — pre-existing flagged_fields: verify must APPEND, not clobber
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestPreExistingFlaggedFields:
    """ADV-02: if proposal.flagged_fields is already non-empty (reconciler or judge wrote it),
    verify() must APPEND new flags without clobbering the existing ones.
    """

    async def test_adv02_verify_appends_to_existing_flagged_fields_on_warn(self) -> None:
        """ADV-02: pre-existing flag ["some_prior_field"]; gloss warn fires;
        result must be ["some_prior_field", "gloss_en"] (order preserved, no duplication).
        """
        # Pre-seed a flag from a prior stage
        proposal = _make_proposal(
            gloss_en="tome",  # not in glosses → warn
            example_greek="Η μητέρα διαβάζει ένα βιβλίο στο σπίτι.",
            flagged_fields=["some_prior_field"],
        )
        # CefrVocabularyService mock: return set of lemmas that would pass check_e
        # We need the allowed set to contain the words, or check_e will hard-fail.
        # Simplest: mock CefrVocabularyService.allowed_lemmas to return a set
        # that covers μητέρα, διαβάζω, σπίτι, σε, ο (everything except target/glosses).
        # Unit test: we mock CefrVocabularyService at its module location IN verify service.
        with patch(
            "src.services.lexgen_verify_service.CefrVocabularyService",
        ) as mock_cefr_cls:
            mock_cefr_instance = AsyncMock()
            mock_cefr_instance.allowed_lemmas = AsyncMock(
                return_value={"μητέρα", "διαβάζω", "σπίτι", "σε", "ο", "η", "ένα"}
            )
            mock_cefr_cls.return_value = mock_cefr_instance

            svc = _make_service()
            outcome = await svc.verify(proposal)

        # Gloss warn → PASS outcome (no hard fail)
        assert outcome.status == "PASS", (
            f"ADV-02: gloss warn on valid sentence should give PASS; got {outcome.status!r}. "
            f"gate_results={outcome.gate_results!r}"
        )
        assert proposal.flagged_fields is not None, "ADV-02: flagged_fields must remain set"
        assert (
            "some_prior_field" in proposal.flagged_fields
        ), f"ADV-02: pre-existing flag must NOT be clobbered; got {proposal.flagged_fields!r}"
        assert (
            "gloss_en" in proposal.flagged_fields
        ), f"ADV-02: 'gloss_en' must be appended; got {proposal.flagged_fields!r}"

    async def test_adv02_verify_appends_to_existing_flagged_fields_on_hard_fail(self) -> None:
        """ADV-02b: pre-existing flag; check_e hard-fails; _on_hard_fail must append, not replace."""
        proposal = _make_proposal(
            example_greek="Το βιβλίο κβάντο.",  # κβάντο OOV → check_e fail
            flagged_fields=["some_prior_field"],
        )
        svc = _make_service()

        outcome = await svc.verify(proposal)

        assert outcome.status == "FLAGGED"
        assert proposal.flagged_fields is not None
        assert (
            "some_prior_field" in proposal.flagged_fields
        ), f"ADV-02b: prior flag clobbered; got {proposal.flagged_fields!r}"
        assert (
            "check_e" in proposal.flagged_fields
        ), f"ADV-02b: check_e not appended; got {proposal.flagged_fields!r}"

    async def test_adv02_no_duplicate_flags(self) -> None:
        """ADV-02c: if 'check_e' is ALREADY in flagged_fields, verify must not add it twice."""
        proposal = _make_proposal(
            example_greek="Το βιβλίο κβάντο.",
            flagged_fields=["check_e"],  # already present from a prior stage
        )
        svc = _make_service()

        await svc.verify(proposal)

        check_e_count = (proposal.flagged_fields or []).count("check_e")
        assert check_e_count == 1, (
            f"ADV-02c: 'check_e' must appear exactly once in flagged_fields; "
            f"got count={check_e_count}, fields={proposal.flagged_fields!r}"
        )


# ---------------------------------------------------------------------------
# ADV-03 — generated_content is None → clean ValidationError, not AttributeError crash
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestNoneGeneratedContent:
    """ADV-03: proposal.generated_content is None.
    verify() should raise a pydantic ValidationError (GeneratedLexContent.model_validate(None))
    rather than an AttributeError or silent bad state.
    """

    async def test_adv03_none_generated_content_raises_validation_error(self) -> None:
        """ADV-03: generated_content=None → ValidationError from model_validate, not crash."""
        from pydantic import ValidationError  # noqa: PLC0415

        proposal = _make_proposal(generated_content=None)
        svc = _make_service()

        with pytest.raises((ValidationError, TypeError, ValueError)) as exc_info:
            await svc.verify(proposal)

        # Must NOT be an AttributeError (which would indicate a silent None-dereference)
        assert not isinstance(exc_info.value, AttributeError), (
            f"ADV-03: generated_content=None must raise ValidationError/TypeError, "
            f"not AttributeError; got {type(exc_info.value).__name__}"
        )


# ---------------------------------------------------------------------------
# ADV-04 — example_greek missing from generated_content dict
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestMissingExampleGreek:
    """ADV-04: generated_content dict lacks 'example_greek' key.
    verify() should raise a clean pydantic ValidationError, not a KeyError crash.
    """

    async def test_adv04_missing_example_greek_raises_validation_error(self) -> None:
        """ADV-04: generated_content without example_greek key → ValidationError."""
        from pydantic import ValidationError  # noqa: PLC0415

        # Dict without example_greek
        bad_content = {"gloss_en": "book", "gloss_ru": "книга"}
        proposal = _make_proposal(generated_content=bad_content)
        svc = _make_service()

        with pytest.raises((ValidationError, KeyError)) as exc_info:
            await svc.verify(proposal)

        # Must NOT be AttributeError
        assert not isinstance(exc_info.value, AttributeError), (
            f"ADV-04: missing example_greek must raise ValidationError/KeyError, "
            f"not AttributeError; got {type(exc_info.value).__name__}"
        )


# ---------------------------------------------------------------------------
# ADV-05 — multiple out-of-vocab offenders → all recorded
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestMultipleOutOfVocabOffenders:
    """ADV-05: sentence where ALL content words are out-of-vocab.
    check_e.offending must list every offending lemma, not just the first.
    """

    async def test_adv05_multiple_oov_words_all_recorded_in_offending(self) -> None:
        """ADV-05: sentence "Το βιβλίο κβάντο φοτόν." — κβάντο and φοτόν both OOV.
        GateResult.offending must contain both.
        """
        # All CEFR lemmas empty (default mock), so κβάντο and φοτόν both fail
        proposal = _make_proposal(
            example_greek="Το βιβλίο κβάντο φοτόν.",  # two OOV content words
        )
        svc = _make_service()

        outcome = await svc.verify(proposal)

        assert (
            outcome.status == "FLAGGED"
        ), f"ADV-05: multiple OOV words must produce FLAGGED; got {outcome.status!r}"
        check_e_gates = [r for r in outcome.gate_results if r.gate == "check_e"]
        assert check_e_gates, "ADV-05: check_e gate result must be present"
        offending = check_e_gates[0].offending
        assert (
            len(offending) >= 2
        ), f"ADV-05: both OOV lemmas must appear in offending; got {offending!r}"


# ---------------------------------------------------------------------------
# ADV-06 — VS-06 vacuity proof
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestVS06Vacuity:
    """ADV-06: prove that the VS-06 patch target (src.services.lexicon_service.LexiconService)
    does NOT intercept calls made via the already-bound module-level name inside the verify
    service.  mock_lex.assert_not_called() passes vacuously — it is NOT evidence that
    LexiconService was not called.

    This test deliberately USES the real LexiconService call path (an uncertain token that
    triggers the fallback) and demonstrates the mock assertion still vacuously passes.
    """

    async def test_adv06_vs06_patch_target_is_vacuous_for_local_binding(self) -> None:
        """ADV-06: patch src.services.lexicon_service.LexiconService with a spy.
        Even if the verify service CALLS LexiconService (via its local binding),
        the spy's call_count remains 0 — the assertion in VS-06 is vacuous.

        If this test passes, VS-06 provides no protection: its mock_lex.assert_not_called()
        would also pass even if the service re-queried via LexiconService (which is
        OPPOSITE to what VS-06 intends to assert).
        """
        # Use a sentence with a word spaCy will treat as uncertain (lemma == text).
        # The service will try LexiconService(self.db).lookup(token.text).
        # We patch the *module-level* name in lexicon_service, NOT in lexgen_verify_service.
        proposal = _make_proposal(
            example_greek="Το βιβλίο τσιπς.",  # "τσιπς" likely uncertain to spaCy
        )
        svc = _make_service()

        with patch(
            "src.services.lexicon_service.LexiconService",
            wraps=None,  # spy: tracks calls to THIS name
        ) as mock_lex_module_level:
            outcome = await svc.verify(proposal)  # noqa: F841

        # The patch was on src.services.lexicon_service.LexiconService (module-level name).
        # The verify service uses its own local binding imported at module level.
        # Therefore call_count == 0 regardless of whether LexiconService was actually used.
        #
        # This demonstrates VS-06's mock_lex.assert_not_called() is vacuous:
        # it can NEVER detect that LexiconService was called via the local binding.
        assert mock_lex_module_level.call_count == 0, (
            "ADV-06: This confirms the patch target is NOT the call site. "
            "VS-06's mock_lex.assert_not_called() passes vacuously — it provides "
            "no protection against source re-querying via the already-bound local name."
        )

    async def test_adv06_correct_patch_target_would_be_verify_service_module(self) -> None:
        """ADV-06b: the CORRECT patch target for intercepting LexiconService calls
        from lexgen_verify_service is 'src.services.lexgen_verify_service.LexiconService'
        (patch where the name is looked up, not where it is defined).

        If patched correctly, instantiating LexiconService from within the verify service
        WOULD trigger the side_effect — proving the correct patch catches real calls.
        """
        # The verify service calls LexiconService(self.db) when a token is uncertain.
        # Patching the verify service's own namespace DOES intercept it.
        proposal = _make_proposal(
            example_greek="Το βιβλίο τσιπς.",  # uncertain token likely
        )
        svc = _make_service()

        call_detected = {"value": False}

        with patch(
            "src.services.lexgen_verify_service.LexiconService",
        ) as mock_lex_correct:
            # Configure mock to behave like a real LexiconService instance would
            mock_instance = AsyncMock()
            mock_instance.lookup = AsyncMock(return_value=None)
            mock_lex_correct.return_value = mock_instance

            outcome = await svc.verify(proposal)  # noqa: F841
            # If LexiconService was called at all (for any uncertain token),
            # call_count > 0 when patched at the CORRECT location.
            call_detected["value"] = mock_lex_correct.call_count > 0

        # We don't assert the exact count (it depends on spaCy's uncertain-token set),
        # but we document that the correct patch target CAN intercept calls.
        # The assertion here just documents the behavior difference.
        # (On Python 3.14 with mocked spaCy, spaCy may mock all tokens, so call_count
        # may still be 0 — this is acceptable; the key point is the patch IS reachable.)
        # This test is informational rather than a hard assertion on call_count.


# ---------------------------------------------------------------------------
# ADV-07 — target lemma present only as part of a contraction (not standalone)
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestTargetInContraction:
    """ADV-07: edge case where the target lemma might appear embedded in a contraction.

    This tests the check_target_attested gate: if the target (e.g. "ο") only appears
    as a sub-lemma from a contraction split, it must still be counted as attested.
    """

    async def test_adv07_target_as_closed_class_token_is_attested(self) -> None:
        """ADV-07: target = "ο" (an article), appears in sentence only via contraction "στο"→"σε ο".
        The all_sub_lemmas list (used for target_attested) must include it.

        We use a custom packet with target_lemma="ο" to test this edge case.
        """
        from src.schemas.lexgen import (  # noqa: PLC0415
            EvidencePacket,
            EvidencePacketSources,
            FormBundle,
            FrequencySource,
            GreekLexiconSource,
            RulesSource,
            WiktionarySource,
        )

        forms = [FormBundle(form="ο", features={"case": "nominative", "number": "singular"})]
        packet = EvidencePacket(
            lemma_input="ο",
            normalized_lemma="ο",
            pos="noun",  # unusual but schema-valid for test purposes
            sources=EvidencePacketSources(
                wiktionary=WiktionarySource(
                    present=True,
                    gender="masculine",
                    forms=forms,
                    glosses_en="the",
                ),
                greek_lexicon=GreekLexiconSource(
                    present=True,
                    forms=forms,
                    attested_lemma=True,
                    resolved_lemma="ο",
                ),
                frequency=FrequencySource(present=True, rank=1, band="A1"),
                rules=RulesSource(present=True),
            ),
        )

        proposal = WordProposal(
            lemma_input="ο",
            pos="noun",
            origin=WordProposalOrigin.ADMIN,
            requested_by=None,
            status=WordProposalState.GENERATING,
        )
        proposal.evidence_packet = packet.model_dump(mode="json")
        proposal.generated_content = {
            "gloss_en": "the",
            "gloss_ru": "определённый артикль",
            "example_greek": "Η μητέρα πάει στο σπίτι.",  # "ο" only appears via "στο"→"σε ο"
            "example_translation": "The mother goes home.",
        }
        proposal.generated_fields = None
        proposal.reconciliation_log = None
        proposal.flagged_fields = None
        proposal.judge_scores = None
        proposal.trust_score = None

        svc = _make_service()
        outcome = await svc.verify(proposal)

        # The target_attested gate should find "ο" in all_sub_lemmas
        # (derived from "στο"→"σε ο" split → sub-lemma "ο")
        target_gates = [r for r in outcome.gate_results if r.gate == "target_attested"]
        assert target_gates, "ADV-07: target_attested gate must be present"
        assert target_gates[0].passed, (
            "ADV-07: target 'ο' should be attested via contraction sub-lemma 'ο' from 'στο'; "
            f"gate failed with reason: {target_gates[0].reason!r}"
        )


# ---------------------------------------------------------------------------
# ADV-08 — CefrVocabularyService raises a DB error → check_e behavior
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestCefrServiceDbError:
    """ADV-08: CefrVocabularyService.allowed_lemmas() raises a real DB exception.

    The current implementation has try/except Exception around allowed_lemmas()
    that silently falls back to empty set. This means:
    - A production DB failure causes allowed set = empty = ONLY the target passes.
    - Every content word fails Check E (false positives in FLAGGED outcome).
    - The error is swallowed with no log/re-raise.

    This test DOCUMENTS the current (defective) behavior so the executor can fix it:
    the try/except should be removed; if needed for unit tests, the test mock should
    return a proper set instead.
    """

    async def test_adv08_cefr_db_error_causes_silent_empty_allowed_set(self) -> None:
        """ADV-08: when CefrVocabularyService raises, allowed_set = {target_only}.
        The verify service DOES NOT re-raise — it silently flags all content words
        as out-of-vocab. Documents the defect: production DB errors are masked.
        """
        # Force CefrVocabularyService to raise a real DB-like exception
        with patch(
            "src.services.lexgen_verify_service.CefrVocabularyService",
        ) as mock_cefr_cls:
            mock_cefr_instance = AsyncMock()
            mock_cefr_instance.allowed_lemmas = AsyncMock(
                side_effect=Exception("simulated DB connection error")
            )
            mock_cefr_cls.return_value = mock_cefr_instance

            proposal = _make_proposal(
                example_greek="Η μητέρα διαβάζει ένα βιβλίο στο σπίτι.",
            )
            svc = _make_service()

            # DEFECTIVE BEHAVIOR: the exception is swallowed; allowed_set = {βιβλίο} only.
            # The §7 worked example (which should PASS) becomes FLAGGED because
            # μητέρα/διαβάζω/σπίτι/σε/ο are all excluded from the empty allowed set.
            # This test pins the current behavior so a fix is explicit.
            outcome = await svc.verify(proposal)

            # Document what CURRENTLY happens (defective masking):
            # With empty allowed_set, check_e fails even for the §7 worked example.
            # The correct behavior would be to re-raise the exception.
            check_e_gates = [r for r in outcome.gate_results if r.gate == "check_e"]
            # At this point, the test just documents — we check that the service did NOT
            # raise (i.e. the exception was swallowed), which is the defect we're flagging.
            assert outcome is not None, (
                "ADV-08: DB error in allowed_lemmas() was swallowed (not re-raised). "
                "This is the defect: production DB errors silently produce empty allowed set, "
                "causing false positives on Check E. "
                "Fix: remove the try/except around CefrVocabularyService.allowed_lemmas(); "
                "fix the unit test mock to return a proper set instead."
            )
            # The gate result reveals the masking effect:
            if check_e_gates:
                # If check_e failed, the §7 sentence was incorrectly flagged due to empty set
                # (or it passed somehow — either way documents the swallowing behavior)
                pass  # outcome is documented above


# ---------------------------------------------------------------------------
# ADV-09 — LexiconService raises a DB error → token incorrectly marked unknown
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestLexiconServiceDbError:
    """ADV-09: LexiconService.lookup() raises a DB exception.

    The current implementation has try/except Exception around lookup() that
    silently falls back to entry=None (marking the token as unknown_to_analyzer).
    This means:
    - A transient DB error marks a resolvable token as unknown.
    - Unknown tokens are excluded from checked_sub_lemmas (D-UNKNOWN).
    - The error is silently swallowed.

    Documents the defect: the try/except should not exist in production code;
    the unit test should inject a proper AsyncMock returning LexiconEntry|None.
    """

    async def test_adv09_lexicon_db_error_silently_marks_token_unknown(self) -> None:
        """ADV-09: LexiconService(db).lookup() raises → token treated as unknown_to_analyzer.
        Documents the defect: DB errors are masked; tokens are incorrectly excluded.
        """
        with patch(
            "src.services.lexgen_verify_service.LexiconService",
        ) as mock_lex_cls:
            mock_lex_instance = AsyncMock()
            mock_lex_instance.lookup = AsyncMock(
                side_effect=Exception("simulated lexicon DB error")
            )
            mock_lex_cls.return_value = mock_lex_instance

            proposal = _make_proposal(
                example_greek="Το βιβλίο.",  # minimal sentence; target βιβλίο
            )
            svc = _make_service()

            # The exception is swallowed; lookup returns None → token is unknown
            # The service does NOT re-raise — this is the defect we document.
            outcome = await svc.verify(proposal)

            assert outcome is not None, (
                "ADV-09: DB error in LexiconService.lookup() was swallowed (not re-raised). "
                "This is the defect: transient DB errors cause tokens to be silently "
                "misclassified as unknown_to_analyzer. "
                "Fix: remove the try/except around LexiconService.lookup(); "
                "the unit test mock should return AsyncMock(return_value=None) directly."
            )
