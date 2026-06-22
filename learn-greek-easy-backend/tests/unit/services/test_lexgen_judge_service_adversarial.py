"""Adversarial / edge / negative coverage for LexgenJudgeService (LEXGEN-11-02 QA Mode A).

These tests cover boundary, negative, and failure-mode scenarios that the AC tests
do not address: the non-SCORED transition guard, the one-judge-errored routing path,
deterministic-primacy (judge() never writes morphology), and the None-generated_content
assert.

Tests:
  AC-10  Non-SCORED proposal raises IllegalProposalTransition (propagates, not swallowed).
  AC-11  One judge errors (OpenRouter raises) → surviving judge's flags applied,
         disagreed=True, proposal routes to NEEDS_REVIEW (not rejected).
  AC-12  judge() never writes generated_fields / reconciliation_log (they stay unchanged).
  AC(new) generated_content=None on SCORED proposal → AssertionError (not silent bad state).
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock

import pytest

from src.config import settings
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
# Deferred import helpers — keep the file collectable before the service exists.
# ---------------------------------------------------------------------------


def _get_service_class():
    """Import and return LexgenJudgeService.

    Raises ModuleNotFoundError if the module has not been created yet —
    that is the expected RED failure mode for every test in this file.
    """
    from src.services.lexgen_judge_service import LexgenJudgeService  # noqa: PLC0415

    return LexgenJudgeService


def _get_judge_outcome():
    """Import and return JudgeOutcome."""
    from src.services.lexgen_judge_service import JudgeOutcome  # noqa: PLC0415

    return JudgeOutcome


# ---------------------------------------------------------------------------
# Autouse fixture — patch settings.lexgen_judge_models for every test
# ---------------------------------------------------------------------------

_JUDGE_MODEL_A = "model-a/x"
_JUDGE_MODEL_B = "model-b/y"


@pytest.fixture(autouse=True)
def patch_judge_models():
    """Patch settings so every test gets exactly two known judge model slugs.

    Uses object.__setattr__ bypass so the patch works even before LEXGEN-11-03
    adds the field to config.py — Pydantic v2 Settings rejects unknown fields
    via __setattr__, so we go around it with object.__setattr__.
    The teardown restores the original values (or removes the injected attrs).
    """
    _MISSING = object()
    attrs = {
        "lexgen_judge_models": [_JUDGE_MODEL_A, _JUDGE_MODEL_B],
        "lexgen_judge_max_tokens": 1024,
        "lexgen_judge_max_attempts": 3,
    }
    # Save originals (may not exist yet)
    originals = {k: getattr(settings, k, _MISSING) for k in attrs}
    # Inject via object.__setattr__ — bypasses Pydantic field validation
    for k, v in attrs.items():
        object.__setattr__(settings, k, v)
    yield
    # Restore — remove injected attrs that didn't exist before
    for k, v in originals.items():
        if v is _MISSING:
            try:
                object.__delattr__(settings, k)
            except AttributeError:
                pass
        else:
            object.__setattr__(settings, k, v)


# ---------------------------------------------------------------------------
# Shared fixture helpers
# ---------------------------------------------------------------------------

_STANDARD_FORMS: list[FormBundle] = [
    FormBundle(form="βιβλίο", features={"case": "nominative", "number": "singular"}),
    FormBundle(form="βιβλίου", features={"case": "genitive", "number": "singular"}),
]


def _make_biblio_packet() -> EvidencePacket:
    """Build a valid EvidencePacket for βιβλίο (book — neuter noun)."""
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


def _make_generated_content_dict() -> dict:
    """Return a valid generated_content dict (GeneratedLexContent-compatible)."""
    return {
        "gloss_en": "book",
        "gloss_ru": "книга",
        "example_greek": "Διαβάζω ένα βιβλίο.",
        "example_translation": "I am reading a book.",
    }


def _make_proposal(
    *,
    status: WordProposalState = WordProposalState.SCORED,
    generated_content: dict | None = None,
    generated_fields: dict | None = None,
    reconciliation_log: dict | None = None,
    flagged_fields: list[str] | None = None,
) -> WordProposal:
    """Build an in-memory WordProposal with the βιβλίο evidence packet.

    NOT persisted to DB (unit tests use a mocked AsyncSession).
    Status is set directly — bypassing the state machine intentionally.
    """
    packet = _make_biblio_packet()
    proposal = WordProposal(
        lemma_input="βιβλίο",
        pos="noun",
        origin=WordProposalOrigin.ADMIN,
        status=status,
    )
    proposal.evidence_packet = packet.model_dump(mode="json")
    proposal.generated_content = (
        generated_content if generated_content is not None else _make_generated_content_dict()
    )
    proposal.generated_fields = generated_fields
    proposal.reconciliation_log = reconciliation_log
    proposal.flagged_fields = flagged_fields
    proposal.judge_scores = None
    proposal.trust_score = None
    return proposal


def _make_db_mock() -> AsyncMock:
    """Return a mocked AsyncSession with flush() pre-configured."""
    mock_db = AsyncMock()
    mock_db.flush = AsyncMock()
    return mock_db


def _make_service(mock_openrouter: AsyncMock) -> object:
    """Return a LexgenJudgeService with a mocked db and openrouter."""
    cls = _get_service_class()
    return cls(db=_make_db_mock(), openrouter=mock_openrouter)


_PERFECT_RUBRIC_DICT = {
    "naturalness": 5,
    "sense_fit": 5,
    "translation_faith_en": 5,
    "translation_faith_ru": 5,
    "a2_appropriateness": 5,
    "blocking_issues": [],
}


def _rubric_response(rubric_dict: dict, model: str = _JUDGE_MODEL_A) -> OpenRouterResponse:
    """Build an OpenRouterResponse wrapping a rubric dict as JSON."""
    return OpenRouterResponse(
        content=json.dumps(rubric_dict),
        model=model,
        usage=None,
        latency_ms=0.0,
    )


@pytest.fixture()
def mock_openrouter() -> AsyncMock:
    """Return an AsyncMock standing in for OpenRouterService."""
    return AsyncMock(spec=OpenRouterService)


# ---------------------------------------------------------------------------
# AC-10: non-SCORED proposal raises IllegalProposalTransition
# ---------------------------------------------------------------------------


class TestNonScoredProposalRaises:
    """AC-10: proposal in GENERATING state → judge() raises IllegalProposalTransition.

    The service must not swallow the guard — the illegal-transition propagates.
    """

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_non_scored_proposal_raises(self, mock_openrouter: AsyncMock) -> None:
        """AC-10: GENERATING → NEEDS_REVIEW is NOT a legal edge (GENERATING only allows
        SCORED or REJECTED). The judge tries transition(proposal, NEEDS_REVIEW) and the
        guard raises IllegalProposalTransition — which must NOT be swallowed.

        Design: the service asserts the entry state (SCORED) early enough that
        IllegalProposalTransition (or AssertionError) propagates to the caller.
        """
        # Two valid rubric responses — the transition guard fires before or during judge()
        mock_openrouter.complete.side_effect = [
            _rubric_response(_PERFECT_RUBRIC_DICT),
            _rubric_response(_PERFECT_RUBRIC_DICT),
        ]
        proposal = _make_proposal(status=WordProposalState.GENERATING)
        svc = _make_service(mock_openrouter)

        with pytest.raises((IllegalProposalTransition, AssertionError)):
            await svc.judge(proposal)


# ---------------------------------------------------------------------------
# AC-11: one judge errors (OpenRouter raises) → surviving judge's flags applied,
#         disagreed=True, routes to NEEDS_REVIEW
# ---------------------------------------------------------------------------


class TestOneJudgeErroredStillRoutesAndFlags:
    """AC-11: degraded mode — one judge's OpenRouter call raises (simulating network/API error).

    The other judge's result is still applied. The errored judge is recorded.
    disagreed=True (cannot confirm agreement). Proposal goes to NEEDS_REVIEW.
    """

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_one_judge_errored_still_routes_and_flags(
        self, mock_openrouter: AsyncMock
    ) -> None:
        """AC-11: judge B's OpenRouter call raises on all 3 attempts; judge A returns
        a valid rubric with a blocking issue.

        → judge A's blocking flag applied to flagged_fields
        → disagreed=True (cannot confirm agreement — one side errored)
        → proposal.status == NEEDS_REVIEW (not REJECTED)
        """
        rubric_a_with_blocking = {
            "naturalness": 4,
            "sense_fit": 4,
            "translation_faith_en": 4,
            "translation_faith_ru": 4,
            "a2_appropriateness": 4,
            "blocking_issues": [
                {"field": "gloss_en", "issue": "ambiguous gloss"},
            ],
        }
        # Judge A: 1 valid response
        # Judge B: 3 exceptions (all attempts raise)
        mock_openrouter.complete.side_effect = [
            _rubric_response(rubric_a_with_blocking),  # judge A — OK
            Exception("simulated OpenRouter network error"),  # judge B attempt 1
            Exception("simulated OpenRouter network error"),  # judge B attempt 2
            Exception("simulated OpenRouter network error"),  # judge B attempt 3
        ]
        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)

        outcome = await svc.judge(proposal)

        # Proposal must be NEEDS_REVIEW, not REJECTED
        assert proposal.status == WordProposalState.NEEDS_REVIEW, (
            f"AC-11: proposal must route to NEEDS_REVIEW even when one judge errors; "
            f"got {proposal.status!r}"
        )
        # Surviving judge's flag must be applied
        assert "gloss_en" in (proposal.flagged_fields or []), (
            f"AC-11: surviving judge A's blocking flag 'gloss_en' must be in flagged_fields; "
            f"got {proposal.flagged_fields!r}"
        )
        # One-sided → cannot confirm agreement
        assert (
            outcome.disagreed is True
        ), f"AC-11: one errored judge must produce disagreed=True; got {outcome.disagreed}"
        # At least one judge must be recorded as errored
        errored = [r for r in outcome.judges if r.status == "errored"]
        assert len(errored) >= 1, (
            f"AC-11: at least one judge must have status='errored'; "
            f"got judges={outcome.judges!r}"
        )


# ---------------------------------------------------------------------------
# AC-12: judge() never writes generated_fields / reconciliation_log
# ---------------------------------------------------------------------------


class TestJudgeNeverWritesMorphologyFields:
    """AC-12: judge() is prohibited from writing generated_fields or reconciliation_log.

    These fields belong to the LEXGEN-08 reconciler. A judge that overwrites them
    would destroy the reconciler's authoritative output.
    """

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_judge_never_writes_morphology_fields(self, mock_openrouter: AsyncMock) -> None:
        """AC-12: proposal.generated_fields and .reconciliation_log are pre-set;
        after judge(), they must be byte-for-byte unchanged.
        """
        prior_generated_fields = {
            "gender": "neuter",
            "declension_group": "2b",
            "ipa": "vivˈli.o",
        }
        prior_reconciliation_log = {
            "schema_version": "reconciliation.v1",
            "fields": [{"field": "gender", "chosen_value": "neuter", "source": "wiktionary"}],
        }

        mock_openrouter.complete.side_effect = [
            _rubric_response(_PERFECT_RUBRIC_DICT),
            _rubric_response(_PERFECT_RUBRIC_DICT),
        ]
        proposal = _make_proposal(
            generated_fields=prior_generated_fields,
            reconciliation_log=prior_reconciliation_log,
        )
        svc = _make_service(mock_openrouter)

        await svc.judge(proposal)

        assert proposal.generated_fields == prior_generated_fields, (
            "AC-12: judge() must NOT write proposal.generated_fields — "
            f"got {proposal.generated_fields!r}, expected {prior_generated_fields!r}"
        )
        assert proposal.reconciliation_log == prior_reconciliation_log, (
            "AC-12: judge() must NOT write proposal.reconciliation_log — "
            f"got {proposal.reconciliation_log!r}, expected {prior_reconciliation_log!r}"
        )


# ---------------------------------------------------------------------------
# AC(new): generated_content=None on SCORED proposal → AssertionError
# ---------------------------------------------------------------------------


class TestNoneGeneratedContentAsserts:
    """AC(new): SCORED proposal with generated_content=None.

    judge() must raise AssertionError (the service asserts the content is present).
    It must NOT silently leave the proposal in SCORED, and it must NOT raise a bare
    ValidationError that could mask the root cause.
    """

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_none_generated_content_asserts(self, mock_openrouter: AsyncMock) -> None:
        """AC(new): generated_content=None on a SCORED proposal.

        Expected: judge() raises AssertionError.
        Must NOT: silently leave proposal in SCORED without raising.
        Must NOT: raise ValidationError (which would obscure the assertion contract).
        """
        # Two rubric responses queued — they should NOT be consumed because the
        # assertion fires before any LLM call is made.
        mock_openrouter.complete.side_effect = [
            _rubric_response(_PERFECT_RUBRIC_DICT),
            _rubric_response(_PERFECT_RUBRIC_DICT),
        ]

        # Build SCORED proposal with no generated_content (None)
        packet = _make_biblio_packet()
        proposal = WordProposal(
            lemma_input="βιβλίο",
            pos="noun",
            origin=WordProposalOrigin.ADMIN,
            status=WordProposalState.SCORED,
        )
        proposal.evidence_packet = packet.model_dump(mode="json")
        proposal.generated_content = None  # the problematic state
        proposal.generated_fields = None
        proposal.reconciliation_log = None
        proposal.flagged_fields = None
        proposal.judge_scores = None
        proposal.trust_score = None

        svc = _make_service(mock_openrouter)

        with pytest.raises(AssertionError):
            await svc.judge(proposal)

        # Proposal must NOT have silently transitioned
        assert proposal.status == WordProposalState.SCORED, (
            "AC(new): proposal status must remain SCORED when AssertionError fires; "
            f"got {proposal.status!r}"
        )
