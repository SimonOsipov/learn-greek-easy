"""Adversarial / edge / negative coverage for LexgenVerifyService (LEXGEN-10-03 QA Mode B).

These tests EXTEND the AC-pinned suite (test_lexgen_verify_service.py) with boundary,
negative, and multi-fault scenarios NOT covered by the original spec tests.

Defects targeted:
  - ADV-01  Both check_e fail AND gloss warn together — do both flags land?
  - ADV-02  proposal.flagged_fields already non-empty — does verify APPEND without clobbering?
  - ADV-03  generated_content is None — does verify raise a clean, diagnosable error?
  - ADV-04  example_greek missing from generated_content — clean error, not AttributeError crash?
  - ADV-05  All content words out-of-vocab (multiple offenders) — all recorded in offending?
  - ADV-06  VS-06 correct-patch proof — patching src.services.lexgen_verify_service.LexiconService
            (not src.services.lexicon_service.LexiconService) intercepts LexiconService calls
            made via the verify module's locally-bound name.
  - ADV-07  Target lemma present ONLY inside a contraction (not as standalone word).
  - ADV-08  CefrVocabularyService raises a DB error → exception propagates (not swallowed).
  - ADV-09  LexiconService raises a DB error → exception propagates (not swallowed).

Dependency mocking convention (all tests that call svc.verify()):
    - CefrVocabularyService is patched at src.services.lexgen_verify_service.CefrVocabularyService
    - LexiconService is patched at src.services.lexgen_verify_service.LexiconService
    These are the names as bound in the verify module namespace and are therefore the
    correct intercept points.
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

# Patch target for LexgenGeneratorService within the verify-service module namespace.
# Tests that exercise hard-fail paths MUST patch this to avoid a real LLM call.
_PATCH_GENERATOR = "src.services.lexgen_verify_service.LexgenGeneratorService"


def _make_always_failing_generator_mock() -> AsyncMock:
    """Return a generator mock whose generate() is a no-op (content stays unchanged).

    Used in hard-fail unit tests so the regen loop runs 2 times with gates still
    failing, reaching the persistent-fail → FLAGGED terminal without any LLM call.
    """
    mock_gen = AsyncMock()
    mock_gen.generate = AsyncMock()  # no-op: proposal.generated_content unchanged
    return mock_gen


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


def _cefr_mock(lemma_set: set[str] | None = None) -> AsyncMock:
    """Return a configured CefrVocabularyService mock instance.

    lemma_set: returned by allowed_lemmas().  Defaults to empty set so that
    check_e hard-fails for all non-target content words (useful for OOV tests).
    """
    if lemma_set is None:
        lemma_set = set()
    instance = AsyncMock()
    instance.allowed_lemmas = AsyncMock(return_value=lemma_set)
    return instance


def _lexicon_miss_mock() -> AsyncMock:
    """Return a LexiconService mock whose lookup() always returns None (lexicon miss)."""
    instance = AsyncMock()
    instance.lookup = AsyncMock(return_value=None)
    return instance


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
        Generator is mocked (always-failing) so regen loop runs 2× → FLAGGED.
        """
        # gloss_en="tome" not in glosses_en="book; volume" → gloss warn
        # example with κβάντο → check_e fail (not in empty cefr_lemmas)
        proposal = _make_proposal(
            gloss_en="tome",
            example_greek="Το βιβλίο κβάντο.",  # κβάντο is OOV
            glosses_en="book; volume",
        )
        svc = _make_service()

        gen_mock = _make_always_failing_generator_mock()
        with (
            patch(_PATCH_GENERATOR, return_value=gen_mock),
            patch(
                "src.services.lexgen_verify_service.CefrVocabularyService",
                return_value=_cefr_mock(),  # empty set → κβάντο OOV
            ),
            patch(
                "src.services.lexgen_verify_service.LexiconService",
                return_value=_lexicon_miss_mock(),
            ),
        ):
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

            with patch(
                "src.services.lexgen_verify_service.LexiconService",
                return_value=_lexicon_miss_mock(),
            ):
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
        """ADV-02b: pre-existing flag; check_e hard-fails; _on_hard_fail must append, not replace.
        Generator is mocked (always-failing) so regen loop runs 2× → FLAGGED.
        """
        proposal = _make_proposal(
            example_greek="Το βιβλίο κβάντο.",  # κβάντο OOV → check_e fail
            flagged_fields=["some_prior_field"],
        )
        svc = _make_service()

        gen_mock = _make_always_failing_generator_mock()
        with (
            patch(_PATCH_GENERATOR, return_value=gen_mock),
            patch(
                "src.services.lexgen_verify_service.CefrVocabularyService",
                return_value=_cefr_mock(),  # empty → κβάντο OOV
            ),
            patch(
                "src.services.lexgen_verify_service.LexiconService",
                return_value=_lexicon_miss_mock(),
            ),
        ):
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
        """ADV-02c: if 'check_e' is ALREADY in flagged_fields, verify must not add it twice.
        Generator is mocked (always-failing) so regen loop runs 2× → FLAGGED.
        """
        proposal = _make_proposal(
            example_greek="Το βιβλίο κβάντο.",
            flagged_fields=["check_e"],  # already present from a prior stage
        )
        svc = _make_service()

        gen_mock = _make_always_failing_generator_mock()
        with (
            patch(_PATCH_GENERATOR, return_value=gen_mock),
            patch(
                "src.services.lexgen_verify_service.CefrVocabularyService",
                return_value=_cefr_mock(),  # empty → κβάντο OOV
            ),
            patch(
                "src.services.lexgen_verify_service.LexiconService",
                return_value=_lexicon_miss_mock(),
            ),
        ):
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

    Note: GeneratedLexContent.model_validate(None) is called in Step 2, BEFORE the
    CefrVocabularyService call in Step 7. No DB mock is needed for this path.
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

    Note: GeneratedLexContent.model_validate() is called in Step 2, BEFORE the
    CefrVocabularyService call in Step 7. No DB mock is needed for this path.
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
        Generator is mocked (always-failing) so regen loop runs 2× → FLAGGED.
        """
        # All CEFR lemmas empty (default mock), so κβάντο and φοτόν both fail
        proposal = _make_proposal(
            example_greek="Το βιβλίο κβάντο φοτόν.",  # two OOV content words
        )
        svc = _make_service()

        gen_mock = _make_always_failing_generator_mock()
        with (
            patch(_PATCH_GENERATOR, return_value=gen_mock),
            patch(
                "src.services.lexgen_verify_service.CefrVocabularyService",
                return_value=_cefr_mock(),  # empty set → all non-target OOV
            ),
            patch(
                "src.services.lexgen_verify_service.LexiconService",
                return_value=_lexicon_miss_mock(),
            ),
        ):
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
# ADV-06 — VS-06 correct-patch proof
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestVS06CorrectPatchTarget:
    """ADV-06: prove that patching src.services.lexgen_verify_service.LexiconService
    (the verify module's own namespace) DOES intercept LexiconService calls made by
    the verify service, while patching src.services.lexicon_service.LexiconService
    (the definition module) does NOT.

    Context: The verify module imports LexiconService at module level:
        from src.services.lexicon_service import LexiconService
    This binds the name `LexiconService` in `src.services.lexgen_verify_service`.
    Patching the DEFINITION module does not affect this already-bound name.
    Patching the VERIFY MODULE's namespace does intercept it.

    This was identified as a vacuity bug in ADV-06 (now fixed in VS-06):
    VS-06 previously patched the definition module — now it patches the verify module.
    """

    async def test_adv06_definition_module_patch_is_vacuous_for_verify_service(self) -> None:
        """ADV-06a: patching the DEFINITION module (src.services.lexicon_service.LexiconService)
        does NOT intercept calls from within lexgen_verify_service. The patch call_count
        stays 0 regardless of whether LexiconService was actually used by verify().

        This confirms the definition-module patch provides no meaningful protection.

        Generator is mocked (always-failing) to handle any hard-fail path reached via
        real spaCy — avoids a real LLM call with the MagicMock openrouter.
        """
        # Sentence with an uncertain token (lemma == text) to trigger LexiconService fallback.
        proposal = _make_proposal(
            example_greek="Το βιβλίο τσιπς.",  # "τσιπς" likely uncertain to spaCy
        )
        svc = _make_service()

        # Patch definition module AND provide proper verify-module patches so verify() runs.
        gen_mock = _make_always_failing_generator_mock()
        with (
            patch(_PATCH_GENERATOR, return_value=gen_mock),
            patch(
                "src.services.lexgen_verify_service.CefrVocabularyService",
                return_value=_cefr_mock(),
            ),
            patch(
                "src.services.lexgen_verify_service.LexiconService",
                return_value=_lexicon_miss_mock(),
            ),
            # Patch the DEFINITION module — this does NOT intercept verify's local binding.
            patch(
                "src.services.lexicon_service.LexiconService",
            ) as mock_lex_definition,
        ):
            await svc.verify(proposal)

        # The definition-module patch call_count is 0 regardless of whether the verify
        # service used LexiconService — it monitors the wrong name.
        assert mock_lex_definition.call_count == 0, (
            "ADV-06a: The definition-module patch call_count == 0 confirms it does NOT "
            "intercept calls from lexgen_verify_service's locally-bound name."
        )

    async def test_adv06_verify_module_patch_intercepts_lexicon_calls(self) -> None:
        """ADV-06b: patching the VERIFY MODULE namespace (src.services.lexgen_verify_service.LexiconService)
        DOES intercept LexiconService calls from within verify().

        When a token is uncertain (lemma == text), verify() calls LexiconService(db).lookup().
        We force a deterministic uncertain token via a morphology mock so the lexicon
        fallback is guaranteed to fire.  Patching the verify module's namespace intercepts
        this and the mock call_count > 0 confirms interception.

        This is the correct patch target used by VS-06 in the AC test suite.

        Generator is mocked (always-failing) to handle any hard-fail path reached.
        """
        from unittest.mock import MagicMock  # noqa: PLC0415 — already imported above

        # Build a morphology mock that returns ONE uncertain token (lemma == text).
        # "τσιπς" with lemma == text → triggers the LexiconService fallback path.
        uncertain_token = MagicMock()
        uncertain_token.text = "τσιπς"
        uncertain_token.lemma = "τσιπς"  # lemma == text → uncertain → fallback fires
        uncertain_token.is_punct = False
        uncertain_token.is_space = False
        uncertain_token.like_num = False

        punct_token = MagicMock()
        punct_token.text = "."
        punct_token.lemma = "."
        punct_token.is_punct = True
        punct_token.is_space = False
        punct_token.like_num = False

        morph_svc = MagicMock()
        morph_svc.lemmatize_sentence = MagicMock(return_value=[uncertain_token, punct_token])

        proposal = _make_proposal(
            example_greek="τσιπς.",  # sentence content matches the mocked tokens
        )
        svc = _make_service()

        gen_mock = _make_always_failing_generator_mock()
        with (
            patch(_PATCH_GENERATOR, return_value=gen_mock),
            patch(
                "src.services.lexgen_verify_service.CefrVocabularyService",
                return_value=_cefr_mock(),
            ),
            patch(
                "src.services.lexgen_verify_service.get_morphology_service",
                return_value=morph_svc,
            ),
            patch(
                "src.services.lexgen_verify_service.LexiconService",
            ) as mock_lex_verify_module,
        ):
            mock_instance = AsyncMock()
            mock_instance.lookup = AsyncMock(return_value=None)
            mock_lex_verify_module.return_value = mock_instance

            await svc.verify(proposal)

        assert (
            mock_lex_verify_module.call_count > 0
        ), "ADV-06b: verify-module patch must intercept at least one LexiconService construction."
        assert (
            mock_instance.lookup.await_count > 0
        ), "ADV-06b: lookup() must be awaited when the fallback path is exercised."


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

        # Generator mock guards against any hard-fail path with real spaCy + MagicMock openrouter.
        gen_mock = _make_always_failing_generator_mock()
        with (
            patch(_PATCH_GENERATOR, return_value=gen_mock),
            patch(
                "src.services.lexgen_verify_service.CefrVocabularyService",
                return_value=_cefr_mock({"μητέρα", "πάω", "σπίτι", "σε", "ο", "η", "στο"}),
            ),
            patch(
                "src.services.lexgen_verify_service.LexiconService",
                return_value=_lexicon_miss_mock(),
            ),
        ):
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
# ADV-08 — CefrVocabularyService raises a DB error → exception propagates
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestCefrServiceDbError:
    """ADV-08: CefrVocabularyService.allowed_lemmas() raises a real DB exception.

    After the fix (Defect-1 removal of try/except), the exception propagates to
    the caller instead of being silently swallowed. This is the CORRECT behavior:
    a production DB failure should surface as an error, not silently empty the
    allowed set and false-flag every content word.
    """

    async def test_adv08_cefr_db_error_propagates_to_caller(self) -> None:
        """ADV-08: when CefrVocabularyService raises, the exception propagates.

        Before fix: the try/except swallowed the exception; allowed_set = {target_only};
        every content word failed Check E (false positives in FLAGGED outcome).
        After fix: the exception is re-raised; the caller (API/task runner) handles it.

        LexiconService is also mocked (at the verify-module namespace) so that the
        token-resolution step (which runs before the CEFR call) doesn't fail on the
        bare AsyncMock db.
        """
        with (
            patch(
                "src.services.lexgen_verify_service.CefrVocabularyService",
            ) as mock_cefr_cls,
            patch(
                "src.services.lexgen_verify_service.LexiconService",
                return_value=_lexicon_miss_mock(),
            ),
        ):
            mock_cefr_instance = AsyncMock()
            mock_cefr_instance.allowed_lemmas = AsyncMock(
                side_effect=Exception("simulated DB connection error")
            )
            mock_cefr_cls.return_value = mock_cefr_instance

            proposal = _make_proposal(
                example_greek="Η μητέρα διαβάζει ένα βιβλίο στο σπίτι.",
            )
            svc = _make_service()

            # After fix: exception must propagate, NOT be swallowed.
            with pytest.raises(Exception, match="simulated DB connection error"):
                await svc.verify(proposal)


# ---------------------------------------------------------------------------
# ADV-09 — LexiconService raises a DB error → exception propagates
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestLexiconServiceDbError:
    """ADV-09: LexiconService.lookup() raises a DB exception.

    After the fix (Defect-2 removal of try/except), the exception propagates to
    the caller instead of being silently swallowed. Before the fix, a transient
    DB error caused the token to be misclassified as unknown_to_analyzer.
    """

    async def test_adv09_lexicon_db_error_propagates_to_caller(self) -> None:
        """ADV-09: LexiconService(db).lookup() raises → exception propagates.

        The verify service must NOT swallow the exception.  We force a deterministic
        uncertain token via a morphology mock so the lexicon fallback is guaranteed
        to fire and the simulated DB error is always raised.
        """
        from unittest.mock import MagicMock  # noqa: PLC0415 — already imported above

        # Force an uncertain token: lemma == text → LexiconService.lookup() is called.
        uncertain_token = MagicMock()
        uncertain_token.text = "τσιπς"
        uncertain_token.lemma = "τσιπς"  # lemma == text → fallback fires
        uncertain_token.is_punct = False
        uncertain_token.is_space = False
        uncertain_token.like_num = False

        morph_svc = MagicMock()
        morph_svc.lemmatize_sentence = MagicMock(return_value=[uncertain_token])

        proposal = _make_proposal(example_greek="τσιπς")
        svc = _make_service()

        with (
            patch(
                "src.services.lexgen_verify_service.CefrVocabularyService",
                return_value=_cefr_mock(),
            ),
            patch(
                "src.services.lexgen_verify_service.get_morphology_service",
                return_value=morph_svc,
            ),
            patch(
                "src.services.lexgen_verify_service.LexiconService",
            ) as mock_lex_cls,
        ):
            mock_lex_instance = AsyncMock()
            mock_lex_instance.lookup = AsyncMock(
                side_effect=Exception("simulated lexicon DB error")
            )
            mock_lex_cls.return_value = mock_lex_instance

            with pytest.raises(Exception, match="simulated lexicon DB error"):
                await svc.verify(proposal)
