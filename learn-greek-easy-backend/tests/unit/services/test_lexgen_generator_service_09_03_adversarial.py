"""Adversarial / edge / negative unit tests for LEXGEN-09-03:
LexgenGeneratorService._assemble_allowed_lemmas().

These tests supplement the 4 AC unit tests in test_lexgen_generator_service_09_03.py.
They target edge cases NOT covered by the AC set:
  - Empty CEFR set → _assemble_allowed_lemmas returns exactly {target_lemma}
  - Proposal object is NOT mutated by _assemble_allowed_lemmas (no status, no field writes)
  - allowed_lemmas() is called exactly once per generate() call (no double-query)
  - The assembled set is what actually appears in the built prompt (wiring end-to-end)

All tests are unit-level: CefrVocabularyService is patched so no real DB is required.
"""

from __future__ import annotations

import json
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
from src.schemas.nlp import OpenRouterResponse
from src.services.lexgen_generator_service import LexgenGeneratorService
from src.services.openrouter_service import OpenRouterService

# ---------------------------------------------------------------------------
# Shared fixture helpers
# ---------------------------------------------------------------------------

_STANDARD_FORMS: list[FormBundle] = [
    FormBundle(form="βιβλίο", features={"case": "Nom", "number": "Sing"}),
    FormBundle(form="βιβλίου", features={"case": "Gen", "number": "Sing"}),
]

_VALID_CONTENT_JSON = json.dumps(
    {
        "gloss_en": "book",
        "gloss_ru": "книга",
        "example_greek": "Διαβάζω ένα βιβλίο.",
        "example_translation": "I am reading a book.",
    }
)


def _make_biblio_packet() -> EvidencePacket:
    """Realistic noun packet for βιβλίο."""
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


def _make_proposal(*, status: WordProposalState = WordProposalState.GENERATING) -> WordProposal:
    """Build an in-memory WordProposal for βιβλίο."""
    packet = _make_biblio_packet()
    proposal = WordProposal(
        lemma_input="βιβλίο",
        pos="noun",
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


def _make_openrouter_response(content: str) -> OpenRouterResponse:
    return OpenRouterResponse(
        content=content,
        model="google/gemini-2.5-flash-lite",
        usage=None,
        latency_ms=0.0,
    )


def _make_service(cefr_return_value: set[str]) -> LexgenGeneratorService:
    """Return a LexgenGeneratorService whose CefrVocabularyService is pre-patched.

    NOTE: patching is done inside each test because we need to return the service
    AND keep the patch active during _assemble_allowed_lemmas. This factory is just
    for constructing the service object with a pre-configured DB mock that returns
    cefr_return_value when .scalars().all() is called.

    We use a MagicMock for the execute result so .scalars().all() returns
    synchronously (not as a coroutine), matching the CefrVocabularyService contract.
    """
    mock_db = AsyncMock()
    mock_db.flush = AsyncMock()
    mock_execute_result = MagicMock()
    mock_execute_result.scalars.return_value.all.return_value = list(cefr_return_value)
    mock_db.execute.return_value = mock_execute_result
    mock_openrouter = AsyncMock(spec=OpenRouterService)
    return LexgenGeneratorService(db=mock_db, openrouter=mock_openrouter)


# ---------------------------------------------------------------------------
# Adversarial: empty CEFR set → exactly {target_lemma}
# ---------------------------------------------------------------------------


class TestEmptyCefrSet:
    """When CefrVocabularyService returns an empty set, _assemble_allowed_lemmas
    must return exactly {packet.normalized_lemma} — the target lemma union is
    the ONLY non-empty contributor.
    """

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_empty_cefr_set_returns_only_target_lemma(self) -> None:
        """CefrVocabularyService returns {} → result is exactly {"βιβλίο"}.

        Guards: the target-lemma union is not conditional on the CEFR set being
        non-empty. Even with zero CEFR rows, the target word must be allowed.
        """
        svc = _make_service(cefr_return_value=set())
        packet = _make_biblio_packet()

        with patch("src.services.lexgen_generator_service.CefrVocabularyService") as mock_cefr_cls:
            mock_cefr_instance = MagicMock()
            mock_cefr_instance.allowed_lemmas = AsyncMock(return_value=set())
            mock_cefr_cls.return_value = mock_cefr_instance

            result = await svc._assemble_allowed_lemmas(packet, resolved=None)

        assert result == {
            "βιβλίο"
        }, f"With empty CEFR set, result must be exactly {{'βιβλίο'}}; got {result!r}"

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_empty_cefr_set_generate_includes_target_lemma_in_prompt(self) -> None:
        """When CEFR returns {}, the generated prompt's vocab line contains target lemma.

        End-to-end wiring guard: _assemble_allowed_lemmas({}) | {lemma} → prompt
        renders the target lemma even with an empty CEFR table.
        """
        mock_openrouter = AsyncMock(spec=OpenRouterService)
        mock_openrouter.complete.return_value = _make_openrouter_response(_VALID_CONTENT_JSON)

        mock_db = AsyncMock()
        mock_db.flush = AsyncMock()
        mock_execute_result = MagicMock()
        mock_execute_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_execute_result

        svc = LexgenGeneratorService(db=mock_db, openrouter=mock_openrouter)
        proposal = _make_proposal()

        with patch("src.services.lexgen_generator_service.CefrVocabularyService") as mock_cefr_cls:
            mock_cefr_instance = MagicMock()
            mock_cefr_instance.allowed_lemmas = AsyncMock(return_value=set())
            mock_cefr_cls.return_value = mock_cefr_instance

            await svc.generate(proposal)

        # The prompt passed to the LLM must contain the target lemma in the vocab line.
        call_messages = mock_openrouter.complete.call_args.kwargs["messages"]
        user_text = " ".join(m["content"] for m in call_messages if m.get("role") == "user")
        assert "βιβλίο" in user_text, (
            "User message must contain the target lemma 'βιβλίο' in the allowed-vocab "
            "line even when CEFR returns an empty set"
        )


# ---------------------------------------------------------------------------
# Adversarial: no side effects on proposal
# ---------------------------------------------------------------------------


class TestNoSideEffects:
    """_assemble_allowed_lemmas must not mutate the proposal in any way."""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_proposal_unchanged_after_assembly(self) -> None:
        """proposal.status, .generated_content, .generated_fields all unchanged.

        _assemble_allowed_lemmas is a pure read — it derives the allowed set
        from the evidence packet and the CEFR DB table. It must leave the
        proposal object completely untouched.
        """
        svc = _make_service(cefr_return_value={"σπίτι", "σχολείο"})
        packet = _make_biblio_packet()
        proposal = _make_proposal()

        # Capture pre-call state.
        pre_status = proposal.status
        pre_generated_content = proposal.generated_content
        pre_generated_fields = proposal.generated_fields
        pre_reconciliation_log = proposal.reconciliation_log
        pre_flagged_fields = proposal.flagged_fields
        pre_trust_score = proposal.trust_score

        with patch("src.services.lexgen_generator_service.CefrVocabularyService") as mock_cefr_cls:
            mock_cefr_instance = MagicMock()
            mock_cefr_instance.allowed_lemmas = AsyncMock(return_value={"σπίτι", "σχολείο"})
            mock_cefr_cls.return_value = mock_cefr_instance

            await svc._assemble_allowed_lemmas(packet, resolved=None)

        # All proposal fields must be identical to pre-call values.
        assert (
            proposal.status == pre_status
        ), "status must not be mutated by _assemble_allowed_lemmas"
        assert (
            proposal.generated_content == pre_generated_content
        ), "generated_content must not be mutated by _assemble_allowed_lemmas"
        assert (
            proposal.generated_fields == pre_generated_fields
        ), "generated_fields must not be mutated by _assemble_allowed_lemmas"
        assert (
            proposal.reconciliation_log == pre_reconciliation_log
        ), "reconciliation_log must not be mutated by _assemble_allowed_lemmas"
        assert (
            proposal.flagged_fields == pre_flagged_fields
        ), "flagged_fields must not be mutated by _assemble_allowed_lemmas"
        assert (
            proposal.trust_score == pre_trust_score
        ), "trust_score must not be mutated by _assemble_allowed_lemmas"


# ---------------------------------------------------------------------------
# Adversarial: CefrVocabularyService.allowed_lemmas called exactly once per generate()
# ---------------------------------------------------------------------------


class TestSingleCefrQuery:
    """allowed_lemmas() must be called exactly once per generate() call.

    Guards against accidental double-query (e.g., inside a retry loop) which
    would produce redundant DB round-trips.
    """

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_allowed_lemmas_called_once_on_success(self) -> None:
        """generate() success (first attempt) → CefrVocabularyService.allowed_lemmas() × 1."""
        mock_openrouter = AsyncMock(spec=OpenRouterService)
        mock_openrouter.complete.return_value = _make_openrouter_response(_VALID_CONTENT_JSON)

        mock_db = AsyncMock()
        mock_db.flush = AsyncMock()
        mock_execute_result = MagicMock()
        mock_execute_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_execute_result

        svc = LexgenGeneratorService(db=mock_db, openrouter=mock_openrouter)
        proposal = _make_proposal()

        with patch("src.services.lexgen_generator_service.CefrVocabularyService") as mock_cefr_cls:
            mock_cefr_instance = MagicMock()
            mock_cefr_instance.allowed_lemmas = AsyncMock(return_value={"σπίτι"})
            mock_cefr_cls.return_value = mock_cefr_instance

            await svc.generate(proposal)

        mock_cefr_instance.allowed_lemmas.assert_awaited_once_with(), (
            "allowed_lemmas() must be awaited exactly once per generate() call; "
            "it must NOT be called inside the retry loop"
        )

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_allowed_lemmas_called_once_on_retry_then_success(self) -> None:
        """generate() with 1 retry → CefrVocabularyService.allowed_lemmas() × 1 (not × 2).

        The CEFR assembly happens in Stage 3 (before the retry loop), so retries
        must reuse the already-assembled set rather than re-querying the DB.
        """
        mock_openrouter = AsyncMock(spec=OpenRouterService)
        mock_openrouter.complete.side_effect = [
            _make_openrouter_response("this is not json {"),
            _make_openrouter_response(_VALID_CONTENT_JSON),
        ]

        mock_db = AsyncMock()
        mock_db.flush = AsyncMock()
        mock_execute_result = MagicMock()
        mock_execute_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_execute_result

        svc = LexgenGeneratorService(db=mock_db, openrouter=mock_openrouter)
        proposal = _make_proposal()

        with patch("src.services.lexgen_generator_service.CefrVocabularyService") as mock_cefr_cls:
            mock_cefr_instance = MagicMock()
            mock_cefr_instance.allowed_lemmas = AsyncMock(return_value={"σπίτι"})
            mock_cefr_cls.return_value = mock_cefr_instance

            await svc.generate(proposal)

        # Must be exactly 1 call even though the retry loop ran twice.
        assert mock_cefr_instance.allowed_lemmas.await_count == 1, (
            f"allowed_lemmas() must be called exactly once (before the retry loop), "
            f"got {mock_cefr_instance.allowed_lemmas.await_count}"
        )


# ---------------------------------------------------------------------------
# Adversarial: CEFR set is rendered into the prompt (wiring guard)
# ---------------------------------------------------------------------------


class TestCefrSetRenderedInPrompt:
    """The assembled CEFR set must appear in the built prompt, not just be assembled.

    Guards the full wiring chain: CefrVocabularyService → _assemble_allowed_lemmas
    → _build_messages → OpenRouter messages.
    """

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_cefr_lemmas_appear_in_user_message(self) -> None:
        """CEFR lemmas from the service appear in the user message vocab line.

        This confirms the full wiring: generate() assembles the CEFR set and
        passes it to _build_messages, which renders it into the user message.
        """
        mock_openrouter = AsyncMock(spec=OpenRouterService)
        mock_openrouter.complete.return_value = _make_openrouter_response(_VALID_CONTENT_JSON)

        mock_db = AsyncMock()
        mock_db.flush = AsyncMock()
        mock_execute_result = MagicMock()
        mock_execute_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_execute_result

        svc = LexgenGeneratorService(db=mock_db, openrouter=mock_openrouter)
        proposal = _make_proposal()

        # Patch CefrVocabularyService to return a specific set we can check.
        cefr_lemmas = {"σπίτι", "σχολείο", "και"}

        with patch("src.services.lexgen_generator_service.CefrVocabularyService") as mock_cefr_cls:
            mock_cefr_instance = MagicMock()
            mock_cefr_instance.allowed_lemmas = AsyncMock(return_value=cefr_lemmas)
            mock_cefr_cls.return_value = mock_cefr_instance

            await svc.generate(proposal)

        call_messages = mock_openrouter.complete.call_args.kwargs["messages"]
        user_text = " ".join(m["content"] for m in call_messages if m.get("role") == "user")

        for lemma in cefr_lemmas:
            assert lemma in user_text, (
                f"CEFR lemma '{lemma}' must appear in the user message vocab line "
                f"(full wiring: CefrVocabularyService → _assemble_allowed_lemmas → prompt)"
            )
        # Target lemma must also be present.
        assert "βιβλίο" in user_text, (
            "Target lemma 'βιβλίο' must also appear in the user message vocab line "
            "(always unioned in from packet.normalized_lemma)"
        )
