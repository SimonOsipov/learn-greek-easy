"""RED tests for LEXGEN-10-04: regenerate ×2 → flag loop.

These tests pin the contract that 10-04 MUST implement in _on_hard_fail.
They are intentionally RED against the 10-03 stub, which flags immediately
and never calls generate().

Architecture-Schematics contract (§8, LEXGEN-10-04):
    - On a hard-fail gate (severity="fail"), call generator.generate(proposal)
      (outer loop, up to 2 times) re-running all gates each time.
    - Self-heal: if gates pass after a regen, return PASS (regen count recorded).
    - Persistent-fail (2 regens, still failing): append gate names to
      proposal.flagged_fields, single db.flush(), return FLAGGED.
    - Generator-rejection: if generate() transitions proposal to REJECTED mid-loop,
      stop immediately and return REJECTED (no second regen).
    - Warn-only gates: NEVER trigger generate(); record warn in flagged_fields
      per existing _record_warns path.
    - check_e_regens: count of outer regenerations in VerifyOutcome.check_e_regens
      AND proposal.generated_content['check_e_regens'] (JSONB key, no migration).
    - verify() public contract (constructor + signature) is unchanged from 10-03.

Patch strategy (CRITICAL — verified-module-namespace rule):
    All patches target src.services.lexgen_verify_service.* — the namespace
    where verify() resolves its imported names. Patching the definition module
    is vacuous (the verify module's bound names won't be intercepted).

    Specifically:
        src.services.lexgen_verify_service.LexgenGeneratorService  ← RG-01..06
        src.services.lexgen_verify_service.CefrVocabularyService   ← all tests
        src.services.lexgen_verify_service.LexiconService          ← all tests

Gate forcing strategy:
    Check E (hard-fail gate) is forced by:
        - Using an example sentence that contains an out-of-vocab lemma.
        - Mocking CefrVocabularyService.allowed_lemmas() to return a CONTROLLED
          set that excludes that lemma.
        - Mocking LexiconService.lookup() to return None (token is unknown →
          excluded from checked_sub_lemmas via D-UNKNOWN rule).
    Wait — D-UNKNOWN: if token is unknown (lemma == text AND lexicon returns None),
    it is EXCLUDED from checked_sub_lemmas (not checked by Check E).  That means
    unknown tokens pass silently.  To reliably fail Check E we must ensure the
    sentence contains a token that spaCy CAN lemmatize (lemma != text), but whose
    lemma is NOT in the allowed set.

    Simplest approach: mock get_morphology_service() in the verify-module namespace
    to return a controlled morphology service whose lemmatize_sentence() returns a
    FIXED token list.  This gives full determinism without spaCy or DB.

    We mock src.services.lexgen_verify_service.get_morphology_service.
"""

from __future__ import annotations

import inspect
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
# Module-level import helpers (deferred to keep the file collectable)
# ---------------------------------------------------------------------------


def _get_service_class():
    from src.services.lexgen_verify_service import LexgenVerifyService  # noqa: PLC0415

    return LexgenVerifyService


def _get_verify_outcome_class():
    from src.services.lexgen_verify_service import VerifyOutcome  # noqa: PLC0415

    return VerifyOutcome


# ---------------------------------------------------------------------------
# Patch target constants (verify-module namespace — see module docstring)
# ---------------------------------------------------------------------------

_PATCH_GENERATOR = "src.services.lexgen_verify_service.LexgenGeneratorService"
_PATCH_CEFR = "src.services.lexgen_verify_service.CefrVocabularyService"
_PATCH_LEXICON = "src.services.lexgen_verify_service.LexiconService"
_PATCH_MORPHOLOGY = "src.services.lexgen_verify_service.get_morphology_service"

# _PATCH_GENERATOR uses create=True because in the 10-03 stub LexgenGeneratorService
# is NOT yet imported into lexgen_verify_service.py.  10-04 will add that import;
# create=True allows the patch to inject the attribute into the module namespace
# right now so the tests fail at ASSERTION time (call_count checks), not at
# patch-context-manager-entry time (AttributeError).  Once 10-04 adds the import
# the create=True flag becomes a no-op (the attribute exists).
_GENERATOR_PATCH_KWARGS: dict = {"create": True}

# ---------------------------------------------------------------------------
# Shared token/sentence fixtures
# ---------------------------------------------------------------------------

# A sentence containing "κβάντο" (quantum) — definitely not in any B1 set.
_FAILING_SENTENCE = "Η μητέρα βλέπει ένα κβάντο."
# A clean sentence: all tokens in the default allowed set; target βιβλίο present.
_PASSING_SENTENCE = "Η μητέρα διαβάζει ένα βιβλίο στο σπίτι."


def _make_sentence_token(text: str, lemma: str, *, is_punct: bool = False):
    """Build a minimal SentenceToken-like mock."""
    tok = MagicMock()
    tok.text = text
    tok.lemma = lemma
    tok.is_punct = is_punct
    tok.is_space = False
    tok.like_num = False
    return tok


def _tokens_for_failing_sentence():
    """Token list that forces Check E to FAIL.

    "κβάντο" is returned with lemma != text so it passes the spaCy-resolved branch
    (not unknown), but its lemma is outside the allowed set.
    """
    return [
        _make_sentence_token("Η", "ο"),  # article — allowed
        _make_sentence_token("μητέρα", "μητέρα"),  # noun — allowed (lemma==text handled below)
        _make_sentence_token("βλέπει", "βλέπω"),  # verb — allowed
        _make_sentence_token("ένα", "ένα"),  # article — allowed
        _make_sentence_token(
            "κβάντο", "κβάντο"
        ),  # OUT-OF-VOCAB (lemma==text, lexicon→None = unknown → excluded from Check E)
        _make_sentence_token(".", ".", is_punct=True),
    ]


def _tokens_for_passing_sentence():
    """Token list that makes all gates PASS (target βιβλίο present)."""
    return [
        _make_sentence_token("Η", "ο"),
        _make_sentence_token("μητέρα", "μητέρα"),
        _make_sentence_token("διαβάζει", "διαβάζω"),
        _make_sentence_token("ένα", "ένα"),
        _make_sentence_token("βιβλίο", "βιβλίο"),  # target — always in allowed
        _make_sentence_token("στο", "σε"),
        _make_sentence_token("σπίτι", "σπίτι"),
        _make_sentence_token(".", ".", is_punct=True),
    ]


# ---------------------------------------------------------------------------
# NOTE on D-UNKNOWN and Check E forcing
# ---------------------------------------------------------------------------
# Tokens where lemma == text go through LexiconService fallback.  If LexiconService
# returns None they are UNKNOWN → excluded from checked_sub_lemmas → NOT checked
# by Check E.  Therefore "κβάντο" (lemma==text, lexicon=None) would be silently
# excluded and Check E would PASS.
#
# To force a hard Check E failure, we need a token that spaCy DOES resolve
# (lemma != text) but whose lemma is not in the allowed set.
# In _tokens_for_failing_sentence we use "βλέπει"→"βλέπω" as the resolved token,
# but we'll restrict the allowed_lemmas set to exclude "βλέπω" in the tests that
# need Check E to fail.  The CEFR mock controls the allowed set.
# ---------------------------------------------------------------------------

# Allowed set for PASS scenario: covers all tokens in _PASSING_SENTENCE
_ALLOWED_PASS = {"ο", "μητέρα", "διαβάζω", "ένα", "σε", "σπίτι"}
# Allowed set for FAIL scenario: covers all passing-sentence resolved lemmas but NOT "βλέπω"
# (the failing sentence has "βλέπει"→"βλέπω" which is excluded from this set, so Check E
#  hard-fails on the failing sentence but PASSES on the passing sentence after regen).
_ALLOWED_FAIL = {"ο", "μητέρα", "ένα", "διαβάζω", "σε", "σπίτι"}


# ---------------------------------------------------------------------------
# Builder helpers
# ---------------------------------------------------------------------------


def _make_biblio_packet() -> EvidencePacket:
    forms = [
        FormBundle(form="βιβλίο", features={"case": "nominative", "number": "singular"}),
        FormBundle(form="βιβλίου", features={"case": "genitive", "number": "singular"}),
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
                pronunciation="vivˈli.o",
                glosses_en="book; volume",
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


def _make_proposal(
    *,
    gloss_en: str = "book",
    example_greek: str = _PASSING_SENTENCE,
) -> WordProposal:
    """Build an in-memory WordProposal in GENERATING state."""
    packet = _make_biblio_packet()
    proposal = WordProposal(
        lemma_input="βιβλίο",
        pos="noun",
        origin=WordProposalOrigin.ADMIN,
        requested_by=None,
        status=WordProposalState.GENERATING,
    )
    proposal.evidence_packet = packet.model_dump(mode="json")
    proposal.generated_content = {
        "gloss_en": gloss_en,
        "gloss_ru": "книга",
        "example_greek": example_greek,
        "example_translation": "The mother reads a book at home.",
    }
    proposal.generated_fields = None
    proposal.reconciliation_log = None
    proposal.flagged_fields = None
    proposal.judge_scores = None
    proposal.trust_score = None
    proposal.retry_attempts = 0
    return proposal


def _make_service(*, mock_db: AsyncMock | None = None):
    """Build a LexgenVerifyService with mocked db and openrouter."""
    cls = _get_service_class()
    if mock_db is None:
        mock_db = AsyncMock()
        mock_db.flush = AsyncMock()
    return cls(db=mock_db, openrouter=MagicMock())


def _cefr_mock(lemma_set: set[str] | None = None):
    instance = AsyncMock()
    instance.allowed_lemmas = AsyncMock(
        return_value=lemma_set if lemma_set is not None else _ALLOWED_PASS
    )
    return instance


def _lexicon_mock(return_value=None):
    instance = AsyncMock()
    instance.lookup = AsyncMock(return_value=return_value)
    return instance


def _morphology_mock_failing():
    """MorphologyService mock that returns tokens forcing Check E to FAIL."""
    svc = MagicMock()
    svc.lemmatize_sentence = MagicMock(return_value=_tokens_for_failing_sentence())
    return svc


def _morphology_mock_passing():
    """MorphologyService mock that returns tokens where all gates PASS."""
    svc = MagicMock()
    svc.lemmatize_sentence = MagicMock(return_value=_tokens_for_passing_sentence())
    return svc


def _make_generator_mock_self_heal(proposal: WordProposal) -> AsyncMock:
    """Return a generator mock whose generate() rewrites example_greek to pass on regen #1.

    Side effect: mutates proposal.generated_content to use _PASSING_SENTENCE.
    This simulates the generator healing the out-of-vocab problem.
    """

    async def _side_effect(_proposal):
        # Rewrite the content so the next gate run sees a passing sentence.
        _proposal.generated_content = {
            "gloss_en": "book",
            "gloss_ru": "книга",
            "example_greek": _PASSING_SENTENCE,
            "example_translation": "The mother reads a book at home.",
        }

    mock_gen = AsyncMock()
    mock_gen.generate = AsyncMock(side_effect=_side_effect)
    return mock_gen


def _make_generator_mock_always_fail(proposal: WordProposal) -> AsyncMock:  # noqa: ARG001
    """Return a generator mock whose generate() does NOT heal the sentence.

    The proposal's generated_content stays with the failing sentence.
    """

    async def _side_effect(_proposal):
        # Content unchanged — gates will still fail.
        pass

    mock_gen = AsyncMock()
    mock_gen.generate = AsyncMock(side_effect=_side_effect)
    return mock_gen


def _make_generator_mock_rejects(proposal: WordProposal) -> AsyncMock:
    """Return a generator mock whose generate() simulates a REJECTED terminal transition.

    Sets proposal.status = REJECTED on first call, simulating the generator's
    3-internal-failures path.
    """

    async def _side_effect(_proposal):
        _proposal.status = WordProposalState.REJECTED

    mock_gen = AsyncMock()
    mock_gen.generate = AsyncMock(side_effect=_side_effect)
    return mock_gen


# ---------------------------------------------------------------------------
# RG-01  Self-heal: one regen → PASS
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestRG01SelfHeal:
    """RG-01: hard-fail on attempt 1; generate() heals content; attempt 2 PASSES.

    Expected (10-04):
        - generate() called exactly ONCE.
        - outcome.status == "PASS".
        - outcome.check_e_regens == 1.
        - proposal.generated_content['check_e_regens'] == 1.

    RED (10-03 stub):
        - generate() is never called (call_count 0).
        - outcome.status == "FLAGGED" (stub flags immediately).
        => AssertionError on "generate() called exactly once" and "status PASS".
    """

    async def test_rg01_self_heal_generate_called_once(self) -> None:
        proposal = _make_proposal(example_greek=_FAILING_SENTENCE)
        svc = _make_service()

        gen_mock = _make_generator_mock_self_heal(proposal)

        # morphology: fail on the first lemmatize call, pass on the second.
        failing_morph = _morphology_mock_failing()
        passing_morph = _morphology_mock_passing()
        morph_call_count = [0]

        def _morph_factory():
            morph_call_count[0] += 1
            if morph_call_count[0] == 1:
                return failing_morph
            return passing_morph

        with (
            patch(_PATCH_GENERATOR, return_value=gen_mock, create=True),
            patch(_PATCH_CEFR, side_effect=lambda db: _cefr_mock(_ALLOWED_FAIL)),
            patch(_PATCH_LEXICON, return_value=_lexicon_mock()),
            patch(_PATCH_MORPHOLOGY, side_effect=_morph_factory),
        ):
            outcome = await svc.verify(proposal)

        # RG-01 contract assertions
        assert gen_mock.generate.call_count == 1, (
            f"RG-01: generate() must be called exactly once (self-heal); "
            f"got call_count={gen_mock.generate.call_count}"
        )
        VerifyOutcome = _get_verify_outcome_class()
        assert isinstance(outcome, VerifyOutcome)
        assert (
            outcome.status == "PASS"
        ), f"RG-01: outcome.status must be 'PASS' after self-heal; got {outcome.status!r}"
        assert (
            outcome.check_e_regens == 1
        ), f"RG-01: outcome.check_e_regens must be 1; got {outcome.check_e_regens}"
        assert proposal.generated_content.get("check_e_regens") == 1, (
            f"RG-01: proposal.generated_content['check_e_regens'] must be 1; "
            f"got {proposal.generated_content.get('check_e_regens')!r}"
        )


# ---------------------------------------------------------------------------
# RG-02  Persistent-fail: 2 regens, still failing → FLAGGED
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestRG02PersistentFlag:
    """RG-02: gates fail on every attempt → generate() called twice → FLAGGED.

    Expected (10-04):
        - generate() called exactly TWICE.
        - outcome.status == "FLAGGED".
        - proposal.flagged_fields contains the failing gate name (e.g. "check_e").
        - proposal.status == GENERATING (verify never calls transition()).

    RED (10-03 stub):
        - generate() is never called (call_count 0).
        - outcome.status == "FLAGGED" (coincidentally correct).
        => AssertionError on generate() call_count == 2.
           Possibly also on flagged_fields content (stub writes gate name not field).
    """

    async def test_rg02_persistent_fail_generate_called_twice(self) -> None:
        proposal = _make_proposal(example_greek=_FAILING_SENTENCE)
        svc = _make_service()

        gen_mock = _make_generator_mock_always_fail(proposal)

        with (
            patch(_PATCH_GENERATOR, return_value=gen_mock, create=True),
            patch(_PATCH_CEFR, side_effect=lambda db: _cefr_mock(_ALLOWED_FAIL)),
            patch(_PATCH_LEXICON, return_value=_lexicon_mock()),
            patch(_PATCH_MORPHOLOGY, return_value=_morphology_mock_failing()),
        ):
            outcome = await svc.verify(proposal)

        assert gen_mock.generate.call_count == 2, (
            f"RG-02: generate() must be called exactly twice on persistent fail; "
            f"got call_count={gen_mock.generate.call_count}"
        )
        VerifyOutcome = _get_verify_outcome_class()
        assert isinstance(outcome, VerifyOutcome)
        assert (
            outcome.status == "FLAGGED"
        ), f"RG-02: outcome.status must be 'FLAGGED'; got {outcome.status!r}"
        assert (
            proposal.flagged_fields is not None
        ), "RG-02: proposal.flagged_fields must be set after persistent fail"
        assert "check_e" in proposal.flagged_fields, (
            f"RG-02: 'check_e' must be in proposal.flagged_fields; "
            f"got {proposal.flagged_fields!r}"
        )
        assert (
            proposal.status == WordProposalState.GENERATING
        ), f"RG-02: proposal.status must remain GENERATING; got {proposal.status!r}"


# ---------------------------------------------------------------------------
# RG-03  Generator-rejects: generate() transitions to REJECTED → loop stops
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestRG03GeneratorRejects:
    """RG-03: generate() sets proposal.status=REJECTED on first regen → outcome REJECTED.

    Expected (10-04):
        - generate() called exactly ONCE (loop detects REJECTED and stops).
        - outcome.status == "REJECTED".
        - No second regen.

    RED (10-03 stub):
        - generate() is never called (call_count 0).
        => AssertionError on generate() call_count == 1 and status == "REJECTED".
    """

    async def test_rg03_generator_rejects_stops_loop(self) -> None:
        proposal = _make_proposal(example_greek=_FAILING_SENTENCE)
        svc = _make_service()

        gen_mock = _make_generator_mock_rejects(proposal)

        with (
            patch(_PATCH_GENERATOR, return_value=gen_mock, create=True),
            patch(_PATCH_CEFR, side_effect=lambda db: _cefr_mock(_ALLOWED_FAIL)),
            patch(_PATCH_LEXICON, return_value=_lexicon_mock()),
            patch(_PATCH_MORPHOLOGY, return_value=_morphology_mock_failing()),
        ):
            outcome = await svc.verify(proposal)

        assert gen_mock.generate.call_count == 1, (
            f"RG-03: generate() must be called exactly once (rejection stops loop); "
            f"got call_count={gen_mock.generate.call_count}"
        )
        VerifyOutcome = _get_verify_outcome_class()
        assert isinstance(outcome, VerifyOutcome)
        assert outcome.status == "REJECTED", (
            f"RG-03: outcome.status must be 'REJECTED' when generator rejects; "
            f"got {outcome.status!r}"
        )


# ---------------------------------------------------------------------------
# RG-04  Regen-count isolation: check_e_regens tracked; retry_attempts untouched
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestRG04RegenCountIsolated:
    """RG-04: persistent fail; verify sets check_e_regens=2; retry_attempts unchanged.

    Expected (10-04):
        - outcome.check_e_regens == 2.
        - proposal.generated_content['check_e_regens'] == 2.
        - proposal.retry_attempts == <sentinel> (unchanged from before verify()).

    RED (10-03 stub):
        - outcome.check_e_regens == 0 (stub never regens).
        - proposal.generated_content has no 'check_e_regens' key.
        => AssertionError on both counts.
    """

    async def test_rg04_regen_count_in_outcome_and_content(self) -> None:
        _SENTINEL = 42  # sentinel value for retry_attempts
        proposal = _make_proposal(example_greek=_FAILING_SENTENCE)
        proposal.retry_attempts = _SENTINEL
        svc = _make_service()

        gen_mock = _make_generator_mock_always_fail(proposal)

        with (
            patch(_PATCH_GENERATOR, return_value=gen_mock, create=True),
            patch(_PATCH_CEFR, side_effect=lambda db: _cefr_mock(_ALLOWED_FAIL)),
            patch(_PATCH_LEXICON, return_value=_lexicon_mock()),
            patch(_PATCH_MORPHOLOGY, return_value=_morphology_mock_failing()),
        ):
            outcome = await svc.verify(proposal)

        # POSITIVE: check_e_regens == 2 in outcome and in generated_content JSONB
        assert (
            outcome.check_e_regens == 2
        ), f"RG-04 (positive): outcome.check_e_regens must be 2; got {outcome.check_e_regens}"
        assert proposal.generated_content.get("check_e_regens") == 2, (
            f"RG-04 (positive): proposal.generated_content['check_e_regens'] must be 2; "
            f"got {proposal.generated_content.get('check_e_regens')!r}"
        )

        # NEGATIVE: verify service must NOT touch retry_attempts
        assert proposal.retry_attempts == _SENTINEL, (
            f"RG-04 (negative): verify() must NOT assign proposal.retry_attempts; "
            f"sentinel {_SENTINEL} changed to {proposal.retry_attempts!r}"
        )


# ---------------------------------------------------------------------------
# RG-05  Warn-only → no regen, flagged_fields has warn field, outcome PASS
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestRG05WarnNoRegen:
    """RG-05: only gloss_subset warns (non-empty gloss not in Wiktionary); no regen.

    Setup:
        - example_greek passes Check E and target_attested gates.
        - gloss_en is non-empty but not in the wiktionary glosses → "warn".

    Expected (10-04 and 10-03 — this test should stay GREEN after 10-04):
        - generate() NOT called (call_count 0).
        - outcome.status == "PASS" (warn does not fail the outcome).
        - proposal.flagged_fields contains "gloss_en" (the warn field).

    RED NOTE: This test should already PASS in 10-03 (warns don't trigger regen).
    But we include it to confirm the "no regen for warns" invariant is preserved
    by 10-04. If the 10-03 stub has a bug where the warn path calls generate(),
    this test will catch that regression too.
    """

    async def test_rg05_warn_does_not_trigger_generate(self) -> None:
        # Use a gloss not in the packet's wiktionary glosses ("book; volume")
        proposal = _make_proposal(
            gloss_en="tome",  # not in "book; volume"
            example_greek=_PASSING_SENTENCE,
        )
        svc = _make_service()

        gen_mock = AsyncMock()
        gen_mock.generate = AsyncMock()

        with (
            patch(_PATCH_GENERATOR, return_value=gen_mock, create=True),
            patch(_PATCH_CEFR, side_effect=lambda db: _cefr_mock(_ALLOWED_PASS)),
            patch(_PATCH_LEXICON, return_value=_lexicon_mock()),
            patch(_PATCH_MORPHOLOGY, return_value=_morphology_mock_passing()),
        ):
            outcome = await svc.verify(proposal)

        assert gen_mock.generate.call_count == 0, (
            f"RG-05: generate() must NOT be called for warn-only gates; "
            f"got call_count={gen_mock.generate.call_count}"
        )
        VerifyOutcome = _get_verify_outcome_class()
        assert isinstance(outcome, VerifyOutcome)
        assert (
            outcome.status == "PASS"
        ), f"RG-05: outcome.status must be 'PASS' for warn-only; got {outcome.status!r}"
        assert (
            proposal.flagged_fields is not None
        ), "RG-05: proposal.flagged_fields must be set by warn handler"
        assert "gloss_en" in proposal.flagged_fields, (
            f"RG-05: 'gloss_en' must be in proposal.flagged_fields for gloss_subset warn; "
            f"got {proposal.flagged_fields!r}"
        )


# ---------------------------------------------------------------------------
# RG-06  Single-flush: persistent fail → db.flush() called exactly once
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.asyncio
class TestRG06SingleFlush:
    """RG-06: persistent fail → terminal mutations → db.flush() exactly once.

    Expected (10-04):
        - db.flush() called exactly ONCE after flagged_fields is written.
        - Specifically: NOT called 0 times (current 10-03 stub — _on_hard_fail
          does no flush), and NOT called 2+ times (guard against extra flushes).

    RED (10-03 stub):
        - _on_hard_fail does not call db.flush().
        - _record_warns is not called (hard fail path).
        - db.flush() call_count == 0.
        => AssertionError: flush called 0 times, expected exactly 1.
    """

    async def test_rg06_single_flush_on_persistent_fail(self) -> None:
        proposal = _make_proposal(example_greek=_FAILING_SENTENCE)
        mock_db = AsyncMock()
        mock_db.flush = AsyncMock()
        svc = _make_service(mock_db=mock_db)

        gen_mock = _make_generator_mock_always_fail(proposal)

        with (
            patch(_PATCH_GENERATOR, return_value=gen_mock, create=True),
            patch(_PATCH_CEFR, side_effect=lambda db: _cefr_mock(_ALLOWED_FAIL)),
            patch(_PATCH_LEXICON, return_value=_lexicon_mock()),
            patch(_PATCH_MORPHOLOGY, return_value=_morphology_mock_failing()),
        ):
            outcome = await svc.verify(proposal)

        assert outcome.status == "FLAGGED"  # confirm we hit the persistent-fail path
        assert mock_db.flush.call_count == 1, (
            f"RG-06: db.flush() must be called exactly once after persistent-fail terminal mutations; "
            f"got call_count={mock_db.flush.call_count}"
        )


# ---------------------------------------------------------------------------
# RG-07  Contract guard: public API signature unchanged from 10-03
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestRG07ContractGuard:
    """RG-07: verify() and __init__ signatures are unchanged from 10-03.

    This is a pure introspection test — GREEN from day one and must stay GREEN
    through 10-04.  If 10-04 adds required parameters to either method, this
    test catches the regression.
    """

    def test_rg07_init_signature_unchanged(self) -> None:
        """LexgenVerifyService.__init__ must accept (self, db, openrouter) only."""
        cls = _get_service_class()
        sig = inspect.signature(cls.__init__)
        params = list(sig.parameters.keys())
        assert params == ["self", "db", "openrouter"], (
            f"RG-07: __init__ signature changed; expected ['self', 'db', 'openrouter'], "
            f"got {params!r}"
        )

    def test_rg07_verify_signature_unchanged(self) -> None:
        """verify() must accept (self, proposal) only."""
        cls = _get_service_class()
        sig = inspect.signature(cls.verify)
        params = list(sig.parameters.keys())
        assert params == ["self", "proposal"], (
            f"RG-07: verify() signature changed; expected ['self', 'proposal'], " f"got {params!r}"
        )

    def test_rg07_verify_outcome_fields_present(self) -> None:
        """VerifyOutcome must have status, gate_results, check_e_regens, flagged."""
        VerifyOutcome = _get_verify_outcome_class()
        outcome = VerifyOutcome(status="PASS")
        assert hasattr(outcome, "status")
        assert hasattr(outcome, "gate_results")
        assert hasattr(outcome, "check_e_regens")
        assert hasattr(outcome, "flagged")
        assert outcome.check_e_regens == 0  # default unchanged

    def test_rg07_on_hard_fail_seam_exists(self) -> None:
        """_on_hard_fail must exist as a method on LexgenVerifyService (overridable seam)."""
        cls = _get_service_class()
        assert hasattr(
            cls, "_on_hard_fail"
        ), "RG-07: LexgenVerifyService must have _on_hard_fail method (10-04 seam)"
        assert callable(getattr(cls, "_on_hard_fail")), "RG-07: _on_hard_fail must be callable"
