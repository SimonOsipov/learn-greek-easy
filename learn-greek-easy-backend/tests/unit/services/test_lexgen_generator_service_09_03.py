"""RED unit tests for LEXGEN-09-03: closed-vocabulary lemma-set assembly.

These tests target two contracts:

1. LexgenGeneratorService._assemble_allowed_lemmas(packet, resolved):
   Must become ``async`` and return
   ``(await CefrVocabularyService(self.db).allowed_lemmas()) | {packet.normalized_lemma}``.
   Currently it is SYNC and returns only ``{packet.normalized_lemma}`` — so any
   test that calls ``await svc._assemble_allowed_lemmas(...)`` will fail because
   a coroutine cannot be awaited if the method is not actually a coroutine.

2. ``_build_messages(packet, resolved, allowed_lemmas, ...)`` already renders the
   allowed_lemmas set into the user prompt (implemented in 09-02, lines 111-113).
   ``test_prompt_contains_allowed_lemmas`` is therefore a GREEN regression guard
   from day one; it is noted as such in the test docstring.

3. ``test_allowed_lemmas_includes_target_lemma``:
   Verifies that the generator's _assemble_allowed_lemmas unions the target lemma
   even when CefrVocabularyService returns an empty set (lemma absent from
   cefr_lemma). This tests the | {packet.normalized_lemma} union at the generator
   level (not inside CefrVocabularyService).

4. ``test_assembly_does_not_reject_example``:
   Confirms _assemble_allowed_lemmas returns a set and does NOT trigger any
   proposal status transition. Pure safety guard.

Expected failure mode for RED tests:
    TypeError: object set can't be used in 'await' expression
    (because _assemble_allowed_lemmas is currently sync, not async)

``test_prompt_contains_allowed_lemmas`` is GREEN immediately (regression guard).
``test_assembly_does_not_reject_example`` exercises the current sync placeholder
in a no-await form, but the post-09-03 contract requires the method to be async
— the test is written for the async contract and will fail with the sync placeholder.

===========================================================================
SEAM CONTRACT — pinned by these RED tests (executor MUST honour):

1.  ``LexgenGeneratorService._assemble_allowed_lemmas(packet, resolved)`` MUST be
    an ``async def`` (coroutine) in the 09-03 implementation.

2.  It MUST return ``set[str]`` containing:
    - All lemmas from ``await CefrVocabularyService(self.db).allowed_lemmas()``
    - The target lemma (``packet.normalized_lemma``) — ALWAYS included even if
      absent from cefr_lemma.

3.  ``_build_messages`` already renders allowed_lemmas into the user message —
    no change required to that function.

4.  No proposal status transition (REJECTED / GENERATING / etc.) is triggered by
    _assemble_allowed_lemmas alone.
===========================================================================
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
from src.services.lexgen_generator_service import LexgenGeneratorService, _build_messages

# ---------------------------------------------------------------------------
# Shared fixtures helpers
# ---------------------------------------------------------------------------

_STANDARD_FORMS: list[FormBundle] = [
    FormBundle(form="βιβλίο", features={"case": "Nom", "number": "Sing"}),
    FormBundle(form="βιβλίου", features={"case": "Gen", "number": "Sing"}),
    FormBundle(form="βιβλίο", features={"case": "Acc", "number": "Sing"}),
    FormBundle(form="βιβλίο", features={"case": "Voc", "number": "Sing"}),
    FormBundle(form="βιβλία", features={"case": "Nom", "number": "Plur"}),
    FormBundle(form="βιβλίων", features={"case": "Gen", "number": "Plur"}),
    FormBundle(form="βιβλία", features={"case": "Acc", "number": "Plur"}),
    FormBundle(form="βιβλία", features={"case": "Voc", "number": "Plur"}),
]


def _make_biblio_packet() -> EvidencePacket:
    """Build a realistic EvidencePacket for βιβλίο (book — neuter noun)."""
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
    """Build an in-memory WordProposal with the βιβλίο evidence packet."""
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


def _make_service(mock_openrouter: AsyncMock | None = None) -> LexgenGeneratorService:
    """Return a LexgenGeneratorService with a mocked db and optional mocked openrouter."""
    mock_db = AsyncMock()
    mock_db.flush = AsyncMock()
    if mock_openrouter is None:
        mock_openrouter = AsyncMock()
    return LexgenGeneratorService(db=mock_db, openrouter=mock_openrouter)


# ---------------------------------------------------------------------------
# Tests: _build_messages renders allowed_lemmas into the prompt
# (GREEN from day one — regression guard for the 09-02 implementation)
# ---------------------------------------------------------------------------


class TestPromptRendering:
    """Tests that _build_messages includes the allowed-lemma set in the user message."""

    @pytest.mark.unit
    def test_prompt_contains_allowed_lemmas(self) -> None:
        """A non-empty allowed set appears in the user message text.

        task-1113 test spec: test_prompt_contains_allowed_lemmas.
        This exercises _build_messages() which was implemented in 09-02 and
        already renders allowed_lemmas (lines 111-113 in lexgen_generator_service.py).

        NOTE: This test is GREEN from day one (regression guard). It will PASS
        against the 09-02 placeholder because _build_messages is already
        implemented. It becomes load-bearing in 09-03 when the allowed set
        grows from {target_lemma} to the full CEFR set.
        """
        packet = _make_biblio_packet()
        allowed_lemmas = {"βιβλίο", "σπίτι", "σχολείο"}

        messages = _build_messages(packet, resolved=None, allowed_lemmas=allowed_lemmas)

        user_message = messages[-1]["content"]  # last message is the user message
        # All three lemmas must appear somewhere in the user message
        for lemma in allowed_lemmas:
            assert lemma in user_message, (
                f"Lemma '{lemma}' missing from user message. "
                f"The allowed-lemma set must be rendered into the prompt."
            )


# ---------------------------------------------------------------------------
# Tests: _assemble_allowed_lemmas — async contract + target lemma union
# ---------------------------------------------------------------------------


class TestAssembleAllowedLemmas:
    """Tests for LexgenGeneratorService._assemble_allowed_lemmas()."""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_allowed_lemmas_includes_target_lemma(self) -> None:
        """Target lemma is in the assembled set even when CefrVocabularyService returns empty.

        task-1113 test spec: test_allowed_lemmas_includes_target_lemma.
        Even if the lemma is absent from cefr_lemma (CefrVocabularyService returns {}),
        the generator's _assemble_allowed_lemmas MUST union in packet.normalized_lemma.
        This is the | {packet.normalized_lemma} at the generator level (not in the service).

        RED: currently _assemble_allowed_lemmas is SYNC, so awaiting it raises
        TypeError: object set can't be used in 'await' expression.
        """
        svc = _make_service()
        packet = _make_biblio_packet()

        # Mock CefrVocabularyService to return an empty set (lemma absent from cefr_lemma).
        with patch("src.services.lexgen_generator_service.CefrVocabularyService") as mock_cefr_cls:
            mock_cefr_instance = MagicMock()
            mock_cefr_instance.allowed_lemmas = AsyncMock(return_value=set())
            mock_cefr_cls.return_value = mock_cefr_instance

            result = await svc._assemble_allowed_lemmas(packet, resolved=None)

        assert (
            "βιβλίο" in result
        ), "Target lemma 'βιβλίο' must be in the result even if absent from cefr_lemma"

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_assembly_does_not_reject_example(self) -> None:
        """_assemble_allowed_lemmas returns a set only — no status transition side effect.

        task-1113 test spec: test_assembly_does_not_reject_example.
        The assembly is an INPUT helper only. It MUST NOT:
        - Call transition() on the proposal
        - Modify proposal.status
        - Write any proposal fields

        RED: currently _assemble_allowed_lemmas is SYNC, so awaiting it fails.
        Once 09-03 makes it async, this test confirms the return type is set[str]
        and no transition is triggered.
        """
        svc = _make_service()
        packet = _make_biblio_packet()
        proposal = _make_proposal()
        original_status = proposal.status

        with patch("src.services.lexgen_generator_service.CefrVocabularyService") as mock_cefr_cls:
            mock_cefr_instance = MagicMock()
            mock_cefr_instance.allowed_lemmas = AsyncMock(return_value={"σπίτι", "σχολείο"})
            mock_cefr_cls.return_value = mock_cefr_instance

            result = await svc._assemble_allowed_lemmas(packet, resolved=None)

        # Must return a set
        assert isinstance(
            result, set
        ), f"_assemble_allowed_lemmas must return set[str], got {type(result)}"
        # Must not have changed the proposal status (no side effects)
        assert (
            proposal.status == original_status
        ), "Assembly must not trigger any proposal state transition"

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_assembly_unions_cefr_set_with_target_lemma(self) -> None:
        """The result is the union of CefrVocabularyService's set and the target lemma.

        This pins the exact combination: CEFR lemmas (from the service) ∪ {target lemma}.
        The target lemma is included even if already in the CEFR set.

        RED: _assemble_allowed_lemmas is currently sync — awaiting fails.
        """
        svc = _make_service()
        packet = _make_biblio_packet()  # normalized_lemma = "βιβλίο"

        cefr_set = {"σπίτι", "σχολείο", "και"}  # none of these is "βιβλίο"

        with patch("src.services.lexgen_generator_service.CefrVocabularyService") as mock_cefr_cls:
            mock_cefr_instance = MagicMock()
            mock_cefr_instance.allowed_lemmas = AsyncMock(return_value=cefr_set)
            mock_cefr_cls.return_value = mock_cefr_instance

            result = await svc._assemble_allowed_lemmas(packet, resolved=None)

        # Target lemma must be present (the | {packet.normalized_lemma} union)
        assert "βιβλίο" in result, "Target lemma must be unioned in"
        # CEFR set members must be present
        for lemma in cefr_set:
            assert lemma in result, f"CEFR lemma '{lemma}' must be in the result"

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_cefr_vocabulary_service_called_with_db(self) -> None:
        """CefrVocabularyService is constructed with self.db (per-request pattern).

        This pins the FrequencyService-aligned shape: CefrVocabularyService(self.db)
        not a zero-arg singleton.

        RED: _assemble_allowed_lemmas is currently sync — the patch target
        (CefrVocabularyService) does not exist in the module yet, so this will
        also raise ModuleNotFoundError in addition to the await TypeError.
        """
        svc = _make_service()
        packet = _make_biblio_packet()
        expected_db = svc.db

        with patch("src.services.lexgen_generator_service.CefrVocabularyService") as mock_cefr_cls:
            mock_cefr_instance = MagicMock()
            mock_cefr_instance.allowed_lemmas = AsyncMock(return_value={"σπίτι"})
            mock_cefr_cls.return_value = mock_cefr_instance

            await svc._assemble_allowed_lemmas(packet, resolved=None)

        # CefrVocabularyService must be constructed with self.db
        mock_cefr_cls.assert_called_once_with(expected_db)
