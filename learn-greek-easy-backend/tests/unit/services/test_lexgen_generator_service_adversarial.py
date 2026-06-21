"""Adversarial / edge / negative tests for LEXGEN-09-02: LexgenGeneratorService.

These tests supplement the 9 AC tests in test_lexgen_generator_service.py.
They specifically target edge cases, invariants, and scenarios NOT covered by
the AC test set: unsupported POS (resolver-None path), exact retry-echo
propagation, flush counts, prompt content invariants, and reject-then-no-leak.

All tests use the same fixture helpers as the AC test file.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

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
from src.schemas.nlp import OpenRouterResponse
from src.services.openrouter_service import OpenRouterService

# ---------------------------------------------------------------------------
# Import helpers (same deferred pattern as AC test file)
# ---------------------------------------------------------------------------


def _get_service_class():
    from src.services.lexgen_generator_service import LexgenGeneratorService  # noqa: PLC0415

    return LexgenGeneratorService


def _make_service(mock_openrouter: AsyncMock) -> object:
    mock_db = AsyncMock()
    mock_db.flush = AsyncMock()
    cls = _get_service_class()
    return cls(db=mock_db, openrouter=mock_openrouter)


# ---------------------------------------------------------------------------
# Packet / proposal helpers
# ---------------------------------------------------------------------------

_STANDARD_FORMS: list[FormBundle] = [
    FormBundle(form="βιβλίο", features={"case": "Nom", "number": "Sing"}),
    FormBundle(form="βιβλίου", features={"case": "Gen", "number": "Sing"}),
]

_VALID_CONTENT_DICT = {
    "gloss_en": "book",
    "gloss_ru": "книга",
    "example_greek": "Διαβάζω ένα βιβλίο.",
    "example_translation": "I am reading a book.",
}
_VALID_CONTENT_JSON = json.dumps(_VALID_CONTENT_DICT)
_BAD_JSON = "this is not json {"
_MISSING_FIELD_JSON = json.dumps(
    {
        "gloss_en": "book",
        "example_greek": "Διαβάζω ένα βιβλίο.",
        "example_translation": "I am reading a book.",
    }
)


def _make_openrouter_response(content: str) -> OpenRouterResponse:
    return OpenRouterResponse(
        content=content,
        model="google/gemini-2.5-flash-lite",
        usage=None,
        latency_ms=0.0,
    )


def _make_noun_packet() -> EvidencePacket:
    """Realistic noun packet for βιβλίο — mirrors the AC helper."""
    return EvidencePacket(
        lemma_input="βιβλίο",
        normalized_lemma="βιβλίο",
        pos="noun",
        sources=EvidencePacketSources(
            wiktionary=WiktionarySource(
                present=True,
                gender="neuter",
                forms=_STANDARD_FORMS,
                pronunciation="vivˈli.o",
                glosses_en="book; volume",
            ),
            greek_lexicon=GreekLexiconSource(
                present=True,
                forms=_STANDARD_FORMS,
                attested_lemma=True,
                resolved_lemma="βιβλίο",
            ),
            frequency=FrequencySource(present=True, rank=55, band="A1"),
            rules=RulesSource(present=True),
        ),
    )


def _make_verb_packet() -> EvidencePacket:
    """Minimal verb packet — pos='verb' has NO registered resolver (returns None)."""
    return EvidencePacket(
        lemma_input="τρέχω",
        normalized_lemma="τρέχω",
        pos="verb",
        sources=EvidencePacketSources(
            wiktionary=WiktionarySource(
                present=True,
                gender=None,
                forms=[],
                pronunciation="ˈtreço",
                glosses_en="to run; to go fast",
            ),
            greek_lexicon=GreekLexiconSource(
                present=False,
                forms=[],
                attested_lemma=False,
                resolved_lemma=None,
            ),
            frequency=FrequencySource(present=True, rank=200, band="A2"),
            rules=RulesSource(present=True),
        ),
    )


def _make_packet_no_glosses() -> EvidencePacket:
    """Noun packet where Wiktionary glosses_en is None (no candidate glosses)."""
    return EvidencePacket(
        lemma_input="σύμβολο",
        normalized_lemma="σύμβολο",
        pos="noun",
        sources=EvidencePacketSources(
            wiktionary=WiktionarySource(
                present=True,
                gender="neuter",
                forms=_STANDARD_FORMS,
                pronunciation=None,
                glosses_en=None,  # ← missing EN gloss candidates
            ),
            greek_lexicon=GreekLexiconSource(
                present=True,
                forms=_STANDARD_FORMS,
                attested_lemma=True,
                resolved_lemma="σύμβολο",
            ),
            frequency=FrequencySource(present=False, rank=None, band=None),
            rules=RulesSource(present=True),
        ),
    )


def _make_proposal_from_packet(
    packet: EvidencePacket,
    *,
    status: WordProposalState = WordProposalState.GENERATING,
) -> WordProposal:
    """Build an in-memory WordProposal from any EvidencePacket."""
    proposal = WordProposal(
        lemma_input=packet.lemma_input,
        pos=packet.pos,
        origin=WordProposalOrigin.ADMIN,
        status=status,
    )
    proposal.evidence_packet = packet.model_dump(mode="json")
    proposal.generated_content = None
    proposal.generated_fields = None
    proposal.reconciliation_log = None
    proposal.flagged_fields = None
    proposal.judge_scores = None
    proposal.trust_score = None
    return proposal


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_openrouter() -> AsyncMock:
    return AsyncMock(spec=OpenRouterService)


# ---------------------------------------------------------------------------
# Adversarial test class: unsupported POS (resolver-None path)
# ---------------------------------------------------------------------------


class TestResolverNone:
    """When pos has no registered resolver, resolver_for() returns None.

    The generator must proceed to the LLM call without crashing — resolved is
    set to None and _build_messages gracefully skips the morphological context
    block. This is the KEY edge case specified in the QA brief.
    """

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_unsupported_pos_verb_succeeds_without_crash(
        self, mock_openrouter: AsyncMock
    ) -> None:
        """pos='verb' has no registered resolver → resolver_for returns None
        → generate() must NOT raise AttributeError or any error → succeeds on
        valid LLM response; generated_content populated.

        Guards: resolver.resolve() is never called on None; _build_messages
        handles resolved=None safely.
        """
        mock_openrouter.complete.return_value = _make_openrouter_response(_VALID_CONTENT_JSON)
        packet = _make_verb_packet()
        proposal = _make_proposal_from_packet(packet)

        svc = _make_service(mock_openrouter)
        # Must NOT raise AttributeError, TypeError, or any exception.
        await svc.generate(proposal)

        assert proposal.generated_content is not None
        assert proposal.status == WordProposalState.GENERATING
        mock_openrouter.complete.assert_awaited_once()

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_unsupported_pos_prompt_omits_morphological_context(
        self, mock_openrouter: AsyncMock
    ) -> None:
        """When resolver is None, the built prompt must NOT contain
        'Morphological facts' — that block requires a non-None resolved paradigm.

        Guards: _build_messages's `if resolved is not None:` branch is really
        skipped when resolver_for returns None.
        """
        mock_openrouter.complete.return_value = _make_openrouter_response(_VALID_CONTENT_JSON)
        packet = _make_verb_packet()
        proposal = _make_proposal_from_packet(packet)

        svc = _make_service(mock_openrouter)
        await svc.generate(proposal)

        call_messages = mock_openrouter.complete.call_args.kwargs["messages"]
        full_text = " ".join(
            m["content"] for m in call_messages if isinstance(m.get("content"), str)
        )
        assert "Morphological facts" not in full_text, (
            "When resolver is None, the 'Morphological facts' block must be absent from the prompt "
            "(resolved is None → _build_messages skips that section)"
        )

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_unsupported_pos_adjective_succeeds(self, mock_openrouter: AsyncMock) -> None:
        """pos='adjective' also has no registered resolver → same None path.

        Checks that the resolver-None path is not accidentally limited to 'verb'.
        """
        mock_openrouter.complete.return_value = _make_openrouter_response(_VALID_CONTENT_JSON)
        adj_packet = EvidencePacket(
            lemma_input="καλός",
            normalized_lemma="καλός",
            pos="adjective",
            sources=EvidencePacketSources(
                wiktionary=WiktionarySource(
                    present=True,
                    gender=None,
                    forms=[],
                    pronunciation=None,
                    glosses_en="good; nice",
                ),
                greek_lexicon=GreekLexiconSource(
                    present=False,
                    forms=[],
                    attested_lemma=False,
                    resolved_lemma=None,
                ),
                frequency=FrequencySource(present=True, rank=80, band="A1"),
                rules=RulesSource(present=True),
            ),
        )
        proposal = _make_proposal_from_packet(adj_packet)

        svc = _make_service(mock_openrouter)
        await svc.generate(proposal)  # must not raise

        assert proposal.generated_content is not None


# ---------------------------------------------------------------------------
# Adversarial tests: exact retry-echo propagation
# ---------------------------------------------------------------------------


class TestRetryEchoExact:
    """Verify the echoed error text propagates correctly into retry prompts."""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_second_attempt_only_retry_count_and_echo(
        self, mock_openrouter: AsyncMock
    ) -> None:
        """Fail-then-succeed (2 attempts): retry_attempts == 1 on success
        (first-try success = 0, one-retry success = 1).

        Also verifies that the second prompt (and only the second) contains the
        echoed error — the first prompt must NOT contain error-echo text.
        """
        mock_openrouter.complete.side_effect = [
            _make_openrouter_response(_BAD_JSON),
            _make_openrouter_response(_VALID_CONTENT_JSON),
        ]
        packet = _make_noun_packet()
        proposal = _make_proposal_from_packet(packet)

        svc = _make_service(mock_openrouter)
        await svc.generate(proposal)

        assert (
            proposal.retry_attempts == 1
        ), "One failure before success → retry_attempts should be 1 (attempts-1 = 2-1)"

        calls = mock_openrouter.complete.call_args_list
        first_text = " ".join(
            m["content"] for m in calls[0].kwargs["messages"] if isinstance(m.get("content"), str)
        )
        second_text = " ".join(
            m["content"] for m in calls[1].kwargs["messages"] if isinstance(m.get("content"), str)
        )

        # First prompt must NOT have the error-echo block.
        assert (
            "PREVIOUS ATTEMPT FAILED" not in first_text
        ), "First prompt must not contain error-echo — prior_error is None on attempt 1"
        # Second prompt MUST have the error-echo block.
        assert (
            "PREVIOUS ATTEMPT FAILED" in second_text
        ), "Second prompt must echo the prior error (D5 — prior_error set after attempt 1)"

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_both_retry_prompts_contain_error_echo(self, mock_openrouter: AsyncMock) -> None:
        """Two failures then success (3 attempts): BOTH the 2nd and 3rd prompt
        must contain the echoed error (not just the 2nd).

        Guards against echoing only once and clearing last_error too early.
        """
        mock_openrouter.complete.side_effect = [
            _make_openrouter_response(_BAD_JSON),
            _make_openrouter_response(_MISSING_FIELD_JSON),
            _make_openrouter_response(_VALID_CONTENT_JSON),
        ]
        packet = _make_noun_packet()
        proposal = _make_proposal_from_packet(packet)

        svc = _make_service(mock_openrouter)
        await svc.generate(proposal)

        assert proposal.generated_content is not None
        calls = mock_openrouter.complete.call_args_list
        assert len(calls) == 3

        second_text = " ".join(
            m["content"] for m in calls[1].kwargs["messages"] if isinstance(m.get("content"), str)
        )
        third_text = " ".join(
            m["content"] for m in calls[2].kwargs["messages"] if isinstance(m.get("content"), str)
        )

        assert (
            "PREVIOUS ATTEMPT FAILED" in second_text
        ), "2nd prompt must contain error echo after 1st failure"
        assert "PREVIOUS ATTEMPT FAILED" in third_text, (
            "3rd prompt must contain error echo after 2nd failure — last_error must be "
            "updated on each invalid attempt, not cleared"
        )


# ---------------------------------------------------------------------------
# Adversarial tests: glosses_en None / empty
# ---------------------------------------------------------------------------


class TestGlossesGap:
    """Verify the generator proceeds normally when Wiktionary glosses_en is absent."""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_no_glosses_en_does_not_hard_reject(self, mock_openrouter: AsyncMock) -> None:
        """glosses_en=None in the evidence packet is a data gap, not malformed output.

        generate() must still call the LLM and succeed on a valid response.
        The prompt must contain a fallback message about no gloss candidates.
        """
        mock_openrouter.complete.return_value = _make_openrouter_response(_VALID_CONTENT_JSON)
        packet = _make_packet_no_glosses()
        proposal = _make_proposal_from_packet(packet)

        svc = _make_service(mock_openrouter)
        await svc.generate(proposal)

        assert proposal.generated_content is not None
        assert proposal.status == WordProposalState.GENERATING
        mock_openrouter.complete.assert_awaited_once()

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_no_glosses_en_prompt_contains_fallback_instruction(
        self, mock_openrouter: AsyncMock
    ) -> None:
        """When glosses_en is None, the prompt must include the fallback instruction
        (not a crash or silent omission).
        """
        mock_openrouter.complete.return_value = _make_openrouter_response(_VALID_CONTENT_JSON)
        packet = _make_packet_no_glosses()
        proposal = _make_proposal_from_packet(packet)

        svc = _make_service(mock_openrouter)
        await svc.generate(proposal)

        call_messages = mock_openrouter.complete.call_args.kwargs["messages"]
        full_text = " ".join(
            m["content"] for m in call_messages if isinstance(m.get("content"), str)
        )

        assert "No Wiktionary gloss candidates" in full_text, (
            "When glosses_en is None, prompt must contain the no-candidates fallback "
            "instruction so the LLM knows to use other evidence"
        )


# ---------------------------------------------------------------------------
# Adversarial tests: success path never calls transition()
# ---------------------------------------------------------------------------


class TestSuccessNoTransition:
    """On success, generate() must never call transition() — proposal stays GENERATING."""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_success_path_transition_never_called(self, mock_openrouter: AsyncMock) -> None:
        """Patch transition to detect any call — on success path it must be zero calls."""
        mock_openrouter.complete.return_value = _make_openrouter_response(_VALID_CONTENT_JSON)
        packet = _make_noun_packet()
        proposal = _make_proposal_from_packet(packet)

        svc = _make_service(mock_openrouter)

        with patch("src.services.lexgen_generator_service.transition") as mock_transition:
            await svc.generate(proposal)

        mock_transition.assert_not_called(), (
            "transition() must never be called on the success path — "
            "proposal stays GENERATING (the reconciler advances it)"
        )


# ---------------------------------------------------------------------------
# Adversarial tests: db.flush() call counts
# ---------------------------------------------------------------------------


class TestFlushCounts:
    """db.flush() must be called exactly once on both success and reject paths."""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_flush_called_once_on_success(self, mock_openrouter: AsyncMock) -> None:
        """Single flush on the success path (after writing generated_content)."""
        mock_openrouter.complete.return_value = _make_openrouter_response(_VALID_CONTENT_JSON)
        packet = _make_noun_packet()
        proposal = _make_proposal_from_packet(packet)

        mock_db = AsyncMock()
        mock_db.flush = AsyncMock()
        cls = _get_service_class()
        svc = cls(db=mock_db, openrouter=mock_openrouter)

        await svc.generate(proposal)

        assert (
            mock_db.flush.await_count == 1
        ), f"Expected exactly 1 db.flush() on success path; got {mock_db.flush.await_count}"

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_flush_called_once_on_reject(self, mock_openrouter: AsyncMock) -> None:
        """Single flush on the reject path (after transition to REJECTED)."""
        mock_openrouter.complete.side_effect = [
            _make_openrouter_response(_BAD_JSON),
            _make_openrouter_response(_MISSING_FIELD_JSON),
            _make_openrouter_response(_BAD_JSON),
        ]
        packet = _make_noun_packet()
        proposal = _make_proposal_from_packet(packet)

        mock_db = AsyncMock()
        mock_db.flush = AsyncMock()
        cls = _get_service_class()
        svc = cls(db=mock_db, openrouter=mock_openrouter)

        await svc.generate(proposal)

        assert (
            mock_db.flush.await_count == 1
        ), f"Expected exactly 1 db.flush() on reject path; got {mock_db.flush.await_count}"


# ---------------------------------------------------------------------------
# Adversarial tests: prompt content invariants
# ---------------------------------------------------------------------------


class TestPromptInvariants:
    """Assert structural invariants in the system prompt and user message."""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_system_prompt_forbids_morphology_production(
        self, mock_openrouter: AsyncMock
    ) -> None:
        """The system message must tell the LLM to NEVER produce a morphological form.

        This is the in-prompt half of the cardinal invariant (the schema half is
        GeneratedLexContent extra='forbid'). Both halves must be present.
        """
        mock_openrouter.complete.return_value = _make_openrouter_response(_VALID_CONTENT_JSON)
        packet = _make_noun_packet()
        proposal = _make_proposal_from_packet(packet)

        svc = _make_service(mock_openrouter)
        await svc.generate(proposal)

        call_messages = mock_openrouter.complete.call_args.kwargs["messages"]
        system_messages = [m for m in call_messages if m.get("role") == "system"]
        assert system_messages, "There must be at least one system message in the prompt"

        system_text = " ".join(m["content"] for m in system_messages)
        # The system prompt must contain explicit instruction not to produce morphology.
        assert any(
            kw in system_text.upper()
            for kw in ("NEVER", "MORPHOLOGICAL", "NO GENDER", "NO IPA", "EXTRA KEY")
        ), (
            "System prompt must explicitly forbid morphological form production "
            "(cardinal invariant in-prompt half). Check _SYSTEM_PROMPT in the service."
        )

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_system_prompt_specifies_four_required_keys(
        self, mock_openrouter: AsyncMock
    ) -> None:
        """The system message must enumerate the four required output keys."""
        mock_openrouter.complete.return_value = _make_openrouter_response(_VALID_CONTENT_JSON)
        packet = _make_noun_packet()
        proposal = _make_proposal_from_packet(packet)

        svc = _make_service(mock_openrouter)
        await svc.generate(proposal)

        call_messages = mock_openrouter.complete.call_args.kwargs["messages"]
        system_text = " ".join(m["content"] for m in call_messages if m.get("role") == "system")

        for key in ("gloss_en", "gloss_ru", "example_greek", "example_translation"):
            assert key in system_text, (
                f"System prompt must name '{key}' as a required output key so the LLM "
                "knows the exact schema to produce"
            )

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_user_message_includes_lemma(self, mock_openrouter: AsyncMock) -> None:
        """The user message must include the normalized lemma so the LLM knows the target word."""
        mock_openrouter.complete.return_value = _make_openrouter_response(_VALID_CONTENT_JSON)
        packet = _make_noun_packet()
        proposal = _make_proposal_from_packet(packet)

        svc = _make_service(mock_openrouter)
        await svc.generate(proposal)

        call_messages = mock_openrouter.complete.call_args.kwargs["messages"]
        user_messages = [m for m in call_messages if m.get("role") == "user"]
        user_text = " ".join(m["content"] for m in user_messages)

        assert (
            "βιβλίο" in user_text
        ), "User message must include the normalized lemma (packet.normalized_lemma)"


# ---------------------------------------------------------------------------
# Adversarial tests: reject path — no partial write leak
# ---------------------------------------------------------------------------


class TestRejectNoLeak:
    """After 3 failures, generated_content must remain None — no partial write."""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_reject_generated_content_stays_none(self, mock_openrouter: AsyncMock) -> None:
        """Even though 3 attempts ran and parsed (and failed), generated_content
        must remain None after the reject path (no partial write from any attempt).
        """
        mock_openrouter.complete.side_effect = [
            _make_openrouter_response(_BAD_JSON),
            _make_openrouter_response(_MISSING_FIELD_JSON),
            _make_openrouter_response(_BAD_JSON),
        ]
        packet = _make_noun_packet()
        proposal = _make_proposal_from_packet(packet)

        svc = _make_service(mock_openrouter)
        await svc.generate(proposal)

        assert proposal.generated_content is None, (
            "generated_content must remain None after 3 failures — "
            "the success path (write + return) was never reached"
        )
        assert proposal.status == WordProposalState.REJECTED

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_reject_all_cardinal_fields_stay_none(self, mock_openrouter: AsyncMock) -> None:
        """On reject path, ALL cardinal fields (generated_fields, reconciliation_log,
        flagged_fields, judge_scores, trust_score) must remain None.

        Guards against any accidental write in the reject branch.
        """
        mock_openrouter.complete.side_effect = [
            _make_openrouter_response(_BAD_JSON),
            _make_openrouter_response(_BAD_JSON),
            _make_openrouter_response(_BAD_JSON),
        ]
        packet = _make_noun_packet()
        proposal = _make_proposal_from_packet(packet)

        svc = _make_service(mock_openrouter)
        await svc.generate(proposal)

        assert proposal.generated_fields is None, "generated_fields must stay None on reject"
        assert proposal.reconciliation_log is None, "reconciliation_log must stay None on reject"
        assert proposal.flagged_fields is None, "flagged_fields must stay None on reject"
        assert proposal.judge_scores is None, "judge_scores must stay None on reject"
        assert proposal.trust_score is None, "trust_score must stay None on reject"

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_reject_reason_includes_last_error_text(self, mock_openrouter: AsyncMock) -> None:
        """rejection_reason must contain the last error string (not just a generic message).

        This is observable: the service sets
        `proposal.rejection_reason = f"generation_invalid_after_retries: {last_error}"`
        Guards against accidentally dropping last_error from the rejection message.
        """
        mock_openrouter.complete.side_effect = [
            _make_openrouter_response(_BAD_JSON),
            _make_openrouter_response(_BAD_JSON),
            _make_openrouter_response(_BAD_JSON),
        ]
        packet = _make_noun_packet()
        proposal = _make_proposal_from_packet(packet)

        svc = _make_service(mock_openrouter)
        await svc.generate(proposal)

        assert proposal.rejection_reason is not None
        assert (
            "generation_invalid_after_retries" in proposal.rejection_reason
        ), "rejection_reason must start with 'generation_invalid_after_retries:' prefix"
        # The last error (bad JSON parse) should be embedded in the reason.
        assert len(proposal.rejection_reason) > len(
            "generation_invalid_after_retries: "
        ), "rejection_reason must include the actual error text, not just the prefix"


# ---------------------------------------------------------------------------
# Adversarial tests: response_format on every retry call
# ---------------------------------------------------------------------------


class TestResponseFormatAllCalls:
    """response_format={"type":"json_object"} must appear on ALL complete() calls,
    not just the first.
    """

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_response_format_on_all_retry_calls(self, mock_openrouter: AsyncMock) -> None:
        """3 total calls (2 failures + 1 success) → all 3 must have response_format."""
        mock_openrouter.complete.side_effect = [
            _make_openrouter_response(_BAD_JSON),
            _make_openrouter_response(_MISSING_FIELD_JSON),
            _make_openrouter_response(_VALID_CONTENT_JSON),
        ]
        packet = _make_noun_packet()
        proposal = _make_proposal_from_packet(packet)

        svc = _make_service(mock_openrouter)
        await svc.generate(proposal)

        assert mock_openrouter.complete.await_count == 3
        for i, c in enumerate(mock_openrouter.complete.call_args_list):
            rf = c.kwargs.get("response_format")
            assert rf == {"type": "json_object"}, (
                f"complete() call #{i + 1} missing response_format={{'type':'json_object'}}; "
                f"got: {rf!r}"
            )

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_no_model_kwarg_on_any_retry_call(self, mock_openrouter: AsyncMock) -> None:
        """model= kwarg must be absent (or None) on all 3 complete() calls."""
        mock_openrouter.complete.side_effect = [
            _make_openrouter_response(_BAD_JSON),
            _make_openrouter_response(_BAD_JSON),
            _make_openrouter_response(_VALID_CONTENT_JSON),
        ]
        packet = _make_noun_packet()
        proposal = _make_proposal_from_packet(packet)

        svc = _make_service(mock_openrouter)
        await svc.generate(proposal)

        for i, c in enumerate(mock_openrouter.complete.call_args_list):
            model_kwarg = c.kwargs.get("model")
            assert model_kwarg is None, (
                f"complete() call #{i + 1} must NOT pass an explicit model= kwarg; "
                f"got model={model_kwarg!r}"
            )
