"""RED unit tests for LEXGEN-09-02: LexgenGeneratorService retry/reject state machine.

These tests target ``src/services/lexgen_generator_service.py`` which does NOT
exist yet. The deferred import pattern (_get_service_class / _make_service)
ensures the file is COLLECTABLE and each test fails individually with a clear
ModuleNotFoundError (not a collection-abort error).

Expected failure mode when run before the implementation:
    ModuleNotFoundError: No module named 'src.services.lexgen_generator_service'

===========================================================================
SEAM CONTRACT — pinned by these RED tests (executor MUST honour):

1.  ``class LexgenGeneratorService`` with ``__init__(self, db: AsyncSession,
    openrouter: OpenRouterService)`` — per-request, NOT a singleton.

2.  ``async def generate(self, proposal: WordProposal) -> None``:
      - Rebuilds EvidencePacket from proposal.evidence_packet.
      - Runs resolver for read-only morphology context (never writes morphology).
      - Calls openrouter.complete(messages, response_format={"type":"json_object"})
        with NO explicit model= kwarg.
      - On success: proposal.generated_content = content.model_dump(),
        proposal.retry_attempts = attempts - 1; proposal stays GENERATING;
        await db.flush(); returns.
      - On invalid JSON or ValidationError: echoes error into next prompt; retries
        (max 3 attempts, max 2 retries).
      - On 3 failures: proposal.retry_attempts = 3, proposal.rejection_reason set,
        transition(proposal, REJECTED), await db.flush().
      - NEVER assigns proposal.generated_fields, reconciliation_log, flagged_fields,
        judge_scores, or trust_score.
      - transition() is the ONLY status mutation.

3.  generated_content stores exactly the 4 keys:
      {gloss_en, gloss_ru, example_greek, example_translation}
    — NEVER a literal "example" key (D6/F1).
===========================================================================
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

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
from src.schemas.nlp import OpenRouterResponse
from src.services.openrouter_service import OpenRouterService

# ---------------------------------------------------------------------------
# Deferred import helper — keeps the file collectable before the service exists.
# Each test that calls _make_service() will fail with ModuleNotFoundError if
# the module has not been created yet — that is the expected RED failure mode.
# ---------------------------------------------------------------------------


def _get_service_class():
    """Import and return LexgenGeneratorService.

    Raises ModuleNotFoundError if the module has not been created yet.
    That is the expected RED failure mode for every test in this file.
    """
    from src.services.lexgen_generator_service import (  # noqa: PLC0415
        LexgenGeneratorService,
    )

    return LexgenGeneratorService


def _make_db_mock() -> AsyncMock:
    """Return a mocked AsyncSession with the CEFR execute chain pre-configured.

    CefrVocabularyService.allowed_lemmas() does:
        result = await db.execute(...)
        return set(result.scalars().all())

    Since db is AsyncMock, awaiting db.execute(...) returns db.execute.return_value.
    But db.execute.return_value is itself AsyncMock (child of AsyncMock), so
    .scalars() would be AsyncMock and return a coroutine — causing AttributeError.
    Fix: replace execute.return_value with a plain MagicMock so .scalars().all()
    returns [] synchronously. This is a realistic empty-CEFR-set mock.
    """
    mock_db = AsyncMock()
    mock_db.flush = AsyncMock()
    mock_execute_result = MagicMock()
    mock_execute_result.scalars.return_value.all.return_value = []
    mock_db.execute.return_value = mock_execute_result
    return mock_db


def _make_service(mock_openrouter: AsyncMock) -> object:
    """Return a LexgenGeneratorService with a mocked db and openrouter.

    db is an AsyncMock whose .flush() is awaitable and whose .execute() chain
    returns an empty CEFR set ([] from result.scalars().all()) so 09-02 assertions
    hold with the 09-03 CefrVocabularyService call wired in.
    """
    cls = _get_service_class()
    return cls(db=_make_db_mock(), openrouter=mock_openrouter)


# ---------------------------------------------------------------------------
# EvidencePacket fixture helpers
# Mirror _make_biblio_packet / _make_standard_forms from
# tests/integration/services/test_lexgen_reconciler.py  (same exact shape
# the executor must produce and restore via EvidencePacket.model_validate).
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
    """Build a realistic EvidencePacket for βιβλίο (book — neuter noun).

    Mirrors the test helper in test_lexgen_reconciler.py — this is the exact
    shape produced by evidence_assembly_service (LEXGEN-06) and stored in
    proposal.evidence_packet via packet.model_dump(mode="json").
    """
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
    """Build an in-memory WordProposal with the βιβλίο evidence packet.

    The proposal is NOT persisted to DB (unit tests use a mocked AsyncSession).
    The status is set directly — this bypasses the state machine intentionally
    to allow testing proposals in non-standard entry states.
    """
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


# ---------------------------------------------------------------------------
# Valid and invalid JSON payloads for the OpenRouter mock.
# ---------------------------------------------------------------------------

_VALID_CONTENT_DICT = {
    "gloss_en": "book",
    "gloss_ru": "книга",
    "example_greek": "Διαβάζω ένα βιβλίο.",
    "example_translation": "I am reading a book.",
}

_VALID_CONTENT_JSON = json.dumps(_VALID_CONTENT_DICT)

# Invalid: extra "gender" field → GeneratedLexContent.model_validate raises
# ValidationError (extra="forbid") → counts as an invalid attempt.
_MORPHOLOGY_CONTENT_JSON = json.dumps(
    {
        "gloss_en": "book",
        "gloss_ru": "книга",
        "example_greek": "Διαβάζω ένα βιβλίο.",
        "example_translation": "I am reading a book.",
        "gender": "neuter",  # forbidden morphology field
    }
)

_BAD_JSON = "this is not json {"

# Invalid: missing required field gloss_ru
_MISSING_FIELD_JSON = json.dumps(
    {
        "gloss_en": "book",
        "example_greek": "Διαβάζω ένα βιβλίο.",
        "example_translation": "I am reading a book.",
    }
)


def _make_openrouter_response(content: str) -> OpenRouterResponse:
    """Build an OpenRouterResponse with the given text content."""
    return OpenRouterResponse(
        content=content,
        model="google/gemini-2.5-flash-lite",
        usage=None,
        latency_ms=0.0,
    )


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_openrouter() -> AsyncMock:
    """Return an AsyncMock standing in for OpenRouterService."""
    return AsyncMock(spec=OpenRouterService)


# ---------------------------------------------------------------------------
# Tests: successful first-attempt generation
# ---------------------------------------------------------------------------


class TestGenerateSuccess:
    """Tests for happy-path single-attempt generation."""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_generate_success_first_attempt(self, mock_openrouter: AsyncMock) -> None:
        """First-attempt valid output → generated_content populated with 4 fields;
        proposal status stays GENERATING; complete() called exactly once.

        AC #1.
        """
        mock_openrouter.complete.return_value = _make_openrouter_response(_VALID_CONTENT_JSON)
        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)

        await svc.generate(proposal)

        assert proposal.generated_content is not None
        assert len(proposal.generated_content) >= 4
        assert proposal.status == WordProposalState.GENERATING
        mock_openrouter.complete.assert_awaited_once()

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_generate_passes_json_object_response_format(
        self, mock_openrouter: AsyncMock
    ) -> None:
        """complete() is called with response_format={"type":"json_object"} on every call.

        AC #2.
        """
        mock_openrouter.complete.return_value = _make_openrouter_response(_VALID_CONTENT_JSON)
        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)

        await svc.generate(proposal)

        call_kwargs = mock_openrouter.complete.call_args.kwargs
        assert call_kwargs.get("response_format") == {"type": "json_object"}

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_generate_uses_default_model(self, mock_openrouter: AsyncMock) -> None:
        """complete() is NOT called with an explicit model= kwarg (uses default model).

        AC #3. The service passes no model= argument so OpenRouterService tracks
        settings.openrouter_default_model (google/gemini-2.5-flash-lite).
        """
        mock_openrouter.complete.return_value = _make_openrouter_response(_VALID_CONTENT_JSON)
        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)

        await svc.generate(proposal)

        call_kwargs = mock_openrouter.complete.call_args.kwargs
        # model kwarg must be absent OR explicitly None — either means "use default"
        assert call_kwargs.get("model") is None

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_generate_persists_example_as_two_keys(self, mock_openrouter: AsyncMock) -> None:
        """generated_content keys are exactly the 4 concrete keys; "example" is NEVER present.

        D6/F1: the reconciler's gap label "example" has a fixed 1→2 mapping to
        example_greek + example_translation. A literal "example" key must NEVER
        appear in generated_content.
        """
        mock_openrouter.complete.return_value = _make_openrouter_response(_VALID_CONTENT_JSON)
        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)

        await svc.generate(proposal)

        assert proposal.generated_content is not None
        keys = set(proposal.generated_content.keys())
        assert "gloss_en" in keys
        assert "gloss_ru" in keys
        assert "example_greek" in keys
        assert "example_translation" in keys
        assert "example" not in keys, (
            '"example" must never be a literal key in generated_content (D6/F1); '
            "use example_greek + example_translation"
        )

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_generate_never_writes_generated_fields(self, mock_openrouter: AsyncMock) -> None:
        """proposal.generated_fields is never set by the generator.

        D2 (CRITICAL): the LEXGEN-08 reconciler fully overwrites generated_fields;
        any generator write would be clobbered. The generator must leave it None.

        AC #7.
        """
        mock_openrouter.complete.return_value = _make_openrouter_response(_VALID_CONTENT_JSON)
        proposal = _make_proposal()
        assert proposal.generated_fields is None  # pre-condition

        svc = _make_service(mock_openrouter)
        await svc.generate(proposal)

        assert proposal.generated_fields is None, (
            "LexgenGeneratorService must NEVER write proposal.generated_fields — "
            "the reconciler owns that field (D2, AC #7)"
        )


# ---------------------------------------------------------------------------
# Tests: retry/reject state machine
# ---------------------------------------------------------------------------


class TestRetryAndReject:
    """Tests for the retry-×2 / hard-reject loop."""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_generate_retry_then_success(self, mock_openrouter: AsyncMock) -> None:
        """Bad JSON on attempt 1, valid on attempt 2 → succeeds; complete() called twice;
        the second call's messages include the prior error text.

        AC #4.
        """
        mock_openrouter.complete.side_effect = [
            _make_openrouter_response(_BAD_JSON),
            _make_openrouter_response(_VALID_CONTENT_JSON),
        ]
        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)

        await svc.generate(proposal)

        assert proposal.generated_content is not None
        assert proposal.status == WordProposalState.GENERATING
        assert mock_openrouter.complete.await_count == 2

        # Second call must echo the prior parse error into the prompt messages.
        second_call_messages = mock_openrouter.complete.call_args_list[1].kwargs["messages"]
        combined_text = " ".join(
            m["content"] for m in second_call_messages if isinstance(m.get("content"), str)
        )
        # The echoed error must appear somewhere in the second prompt.
        assert len(combined_text) > 0, "second prompt messages must not be empty"
        # We can't predict the exact error string but there should be some indication
        # of the prior failure — assert the second prompt is longer than the first
        # (error echo adds content), OR contains an error-like keyword.
        first_call_messages = mock_openrouter.complete.call_args_list[0].kwargs["messages"]
        first_text = " ".join(
            m["content"] for m in first_call_messages if isinstance(m.get("content"), str)
        )
        assert len(combined_text) > len(first_text) or any(
            kw in combined_text.lower()
            for kw in ("error", "invalid", "retry", "previous", "failed", "json")
        ), "Second prompt should include the prior validation error (AC #4, D5)"

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_generate_schema_invalid_triggers_retry(self, mock_openrouter: AsyncMock) -> None:
        """JSON with a forbidden morphology field (gender) → ValidationError → retry.

        Attempt 1 returns JSON with extra "gender" field → GeneratedLexContent
        extra="forbid" raises ValidationError → attempt 2 returns valid JSON → success.

        AC #6.
        """
        mock_openrouter.complete.side_effect = [
            _make_openrouter_response(_MORPHOLOGY_CONTENT_JSON),
            _make_openrouter_response(_VALID_CONTENT_JSON),
        ]
        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)

        await svc.generate(proposal)

        assert proposal.generated_content is not None
        assert proposal.status == WordProposalState.GENERATING
        assert mock_openrouter.complete.await_count == 2
        # The persisted content must NOT contain the morphology field.
        assert "gender" not in proposal.generated_content

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_generate_three_failures_hard_reject(self, mock_openrouter: AsyncMock) -> None:
        """Three consecutive invalid responses → hard reject.

        After 3 failed attempts:
        - proposal.status == REJECTED
        - proposal.rejection_reason is set (non-empty string)
        - proposal.retry_attempts == 3
        - proposal.generated_content is None (never wrote it)
        - complete() was called exactly 3 times

        AC #5.
        """
        mock_openrouter.complete.side_effect = [
            _make_openrouter_response(_BAD_JSON),
            _make_openrouter_response(_MISSING_FIELD_JSON),
            _make_openrouter_response(_BAD_JSON),
        ]
        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)

        await svc.generate(proposal)

        assert proposal.status == WordProposalState.REJECTED
        assert proposal.rejection_reason is not None and len(proposal.rejection_reason) > 0
        assert proposal.retry_attempts == 3
        assert proposal.generated_content is None
        assert mock_openrouter.complete.await_count == 3

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_generate_reject_uses_transition_guard(self, mock_openrouter: AsyncMock) -> None:
        """A proposal NOT in GENERATING state causes generate() to raise
        IllegalProposalTransition when it tries to call transition(proposal, REJECTED).

        Design: the service calls transition() as the ONLY status mutation.
        When 3 attempts fail, it tries transition(proposal, REJECTED).
        For a proposal in PENDING (only edge is PENDING→GENERATING), the REJECTED
        target is not legal, so IllegalProposalTransition is raised and must
        NOT be swallowed by the service.

        We pass 3 invalid responses so the rejection path is definitely triggered,
        then assert the guard surfaces (AC #8).
        """
        mock_openrouter.complete.side_effect = [
            _make_openrouter_response(_BAD_JSON),
            _make_openrouter_response(_BAD_JSON),
            _make_openrouter_response(_BAD_JSON),
        ]
        # PENDING has only one legal edge: PENDING → GENERATING.
        # PENDING → REJECTED is illegal, so transition() raises.
        proposal = _make_proposal(status=WordProposalState.PENDING)
        svc = _make_service(mock_openrouter)

        with pytest.raises(IllegalProposalTransition):
            await svc.generate(proposal)
