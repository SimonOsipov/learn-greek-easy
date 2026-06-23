"""Unit tests for LexgenJudgeService (LEXGEN-11-02) — the Stage 5 ensemble judge.

Verifies the ensemble judge call (two judges, one per configured slug), the D1
disagreement rule, judge_scores JSONB persistence, the binary SCORED→NEEDS_REVIEW
routing, and the degraded one-judge-errored path.

===========================================================================
SEAM CONTRACT — pinned by these tests (the implementation MUST honour):

1.  ``class LexgenJudgeService`` with ``__init__(self, db: AsyncSession,
    openrouter: OpenRouterService)`` — per-request, NOT a singleton.

2.  ``async def judge(self, proposal: WordProposal) -> JudgeOutcome``:
      - Entry state SCORED; asserts proposal.generated_content is not None.
      - Rebuilds GeneratedLexContent + EvidencePacket from JSONB.
      - Two judge calls, one per settings.lexgen_judge_models slug:
          openrouter.complete(messages, model=<slug>,
              response_format={"type":"json_object"},
              temperature=0.0,
              max_tokens=settings.lexgen_judge_max_tokens,
              reasoning={"type":"disabled"})
        → JudgeRubric.model_validate(json.loads(resp.content)) in a ≤3-attempt
          retry loop (echo prior error). 3 invalid from one judge → that judge
          errored (NOT a rejection).
      - Disagreement rule D1:
          (a) ANY rubric dimension delta ≥2 → disagreed=True
          (b) SET of blocking-issue fields differs between judges → disagreed=True
          (c) disagreeing_dimensions = branch-(a) dimension names only ([] when
              only branch-(b) fires).
      - flagged_fields += disagreeing dimension names ∪ every blocking-issue
        field (append-merge, de-dupe, reassign — not in-place mutate).
      - judge_scores JSONB written:
          {schema_version:"lexgen.judge.v1",
           judges:[{model,status,rubric|null,error?}],
           disagreement:{disagreed,dimensions,rule}}
        NO trust_score/aggregate/overall/score key anywhere.
      - transition(proposal, NEEDS_REVIEW) — ONLY status mutation.
      - single await db.flush(); returns JudgeOutcome.
      - Degraded: one judge errors → recorded errored, treated as
        cannot-confirm-agreement (disagreed=True), surviving judge's flags
        applied, still routes to needs_review.

3.  ``JudgeOutcome(judges, disagreed, disagreeing_dimensions, flagged,
        routed_to=NEEDS_REVIEW)``
    ``JudgeResult(model, rubric|None, status Literal[ok,errored], error|None)``

4.  ``get_lexgen_judge_service(db) -> LexgenJudgeService``
===========================================================================
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock

import pytest

from src.config import settings
from src.db.models import WordProposal, WordProposalOrigin, WordProposalState
from src.schemas.lexgen import (
    EvidencePacket,
    EvidencePacketSources,
    FormBundle,
    FrequencySource,
    GreekLexiconSource,
    JudgeRubric,
    RulesSource,
    WiktionarySource,
)
from src.schemas.nlp import OpenRouterResponse
from src.services.openrouter_service import OpenRouterService

# ---------------------------------------------------------------------------
# Deferred import helpers — keep the file collectable before the service exists.
# Each test that calls _get_service_class() etc. will fail with
# ModuleNotFoundError if the module has not been created yet.
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


def _get_judge_result():
    """Import and return JudgeResult."""
    from src.services.lexgen_judge_service import JudgeResult  # noqa: PLC0415

    return JudgeResult


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
    flagged_fields: list[str] | None = None,
    generated_fields: dict | None = None,
    reconciliation_log: dict | None = None,
) -> WordProposal:
    """Build an in-memory WordProposal in SCORED state with valid JSONB columns.

    The proposal is NOT persisted to DB (unit tests use a mocked AsyncSession).
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


# ---------------------------------------------------------------------------
# Rubric helpers
# ---------------------------------------------------------------------------

_PERFECT_RUBRIC_DICT = {
    "naturalness": 5,
    "sense_fit": 5,
    "translation_faith_en": 5,
    "translation_faith_ru": 5,
    "a2_appropriateness": 5,
    "blocking_issues": [],
}
# Validate at module load so fixture dicts stay in sync with JudgeRubric schema.
# This also makes the JudgeRubric import actively used (not just a re-export).
JudgeRubric.model_validate(_PERFECT_RUBRIC_DICT)

_GOOD_RUBRIC_DICT = {
    "naturalness": 4,
    "sense_fit": 4,
    "translation_faith_en": 4,
    "translation_faith_ru": 4,
    "a2_appropriateness": 4,
    "blocking_issues": [],
}
JudgeRubric.model_validate(_GOOD_RUBRIC_DICT)


def _rubric_response(rubric_dict: dict) -> OpenRouterResponse:
    """Build an OpenRouterResponse wrapping a rubric dict as JSON."""
    return OpenRouterResponse(
        content=json.dumps(rubric_dict),
        model="model-a/x",
        usage=None,
        latency_ms=0.0,
    )


@pytest.fixture()
def mock_openrouter() -> AsyncMock:
    """Return an AsyncMock standing in for OpenRouterService."""
    return AsyncMock(spec=OpenRouterService)


# ---------------------------------------------------------------------------
# AC-1: judge() calls openrouter.complete twice, once per model slug
# ---------------------------------------------------------------------------


class TestJudgeCallsTwoModels:
    """AC-1: scored proposal, both judges return valid rubrics."""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_judge_calls_two_models_by_slug(self, mock_openrouter: AsyncMock) -> None:
        """AC-1: judge() calls openrouter.complete exactly 2×; each call uses the
        correct model= kwarg from settings.lexgen_judge_models.
        """
        # Both judges return a valid rubric on first attempt.
        mock_openrouter.complete.side_effect = [
            _rubric_response(_PERFECT_RUBRIC_DICT),
            _rubric_response(_PERFECT_RUBRIC_DICT),
        ]
        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)

        await svc.judge(proposal)

        assert mock_openrouter.complete.await_count == 2, (
            f"AC-1: judge() must call openrouter.complete exactly 2 times; "
            f"got {mock_openrouter.complete.await_count}"
        )

        call_args_list = mock_openrouter.complete.call_args_list
        used_models = [c.kwargs.get("model") or c.args[1] for c in call_args_list]
        # Normalise: some implementations pass model as positional — extract from kwargs
        used_models = [c.kwargs.get("model", None) for c in call_args_list]
        assert (
            _JUDGE_MODEL_A in used_models
        ), f"AC-1: model-a slug must be used in one call; got models={used_models}"
        assert (
            _JUDGE_MODEL_B in used_models
        ), f"AC-1: model-b slug must be used in one call; got models={used_models}"


# ---------------------------------------------------------------------------
# AC-2: 3 invalid responses from one judge → that judge errored, no rejection
# ---------------------------------------------------------------------------


class TestInvalidJudgeJsonRetriesAndErrored:
    """AC-2: retry loop for invalid JSON; 3 failures → judge errored, not rejected."""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_invalid_judge_json_retries_then_errored(
        self, mock_openrouter: AsyncMock
    ) -> None:
        """AC-2: judge A returns non-JSON 3×, judge B returns valid rubric.

        → judge A's JudgeResult.status == "errored"
        → proposal NOT rejected (status must be NEEDS_REVIEW)
        """
        non_json = OpenRouterResponse(
            content="this is not json {",
            model=_JUDGE_MODEL_A,
            usage=None,
            latency_ms=0.0,
        )
        # judge A: 3 invalid responses; judge B: 1 valid response
        mock_openrouter.complete.side_effect = [
            non_json,
            non_json,
            non_json,
            _rubric_response(_PERFECT_RUBRIC_DICT),
        ]
        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)

        outcome = await svc.judge(proposal)

        # Find the errored judge (JudgeResult.status is "errored" per seam contract)
        errored = [r for r in outcome.judges if r.status == "errored"]
        assert (
            len(errored) == 1
        ), f"AC-2: exactly one judge must have status='errored'; got judges={outcome.judges}"
        assert errored[0].status == "errored"

        # Proposal must NOT be rejected
        assert proposal.status == WordProposalState.NEEDS_REVIEW, (
            f"AC-2: proposal must be NEEDS_REVIEW (not REJECTED) when one judge errors; "
            f"got {proposal.status!r}"
        )


# ---------------------------------------------------------------------------
# AC-3: identical rubrics → no disagreement
# ---------------------------------------------------------------------------


class TestAgreementNoDisagreementFlag:
    """AC-3: both rubrics identical → disagreed False, no dimension names flagged."""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_agreement_no_disagreement_flag(self, mock_openrouter: AsyncMock) -> None:
        """AC-3: both judges return identical rubrics → outcome.disagreed is False,
        no dimension name added to flagged_fields.
        """
        mock_openrouter.complete.side_effect = [
            _rubric_response(_GOOD_RUBRIC_DICT),
            _rubric_response(_GOOD_RUBRIC_DICT),
        ]
        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)

        outcome = await svc.judge(proposal)

        assert (
            outcome.disagreed is False
        ), f"AC-3: identical rubrics must produce disagreed=False; got {outcome.disagreed}"
        # No dimension name should have been flagged
        for dim in (
            "naturalness",
            "sense_fit",
            "translation_faith_en",
            "translation_faith_ru",
            "a2_appropriateness",
        ):
            assert dim not in (outcome.flagged or []), (
                f"AC-3: dimension {dim!r} must NOT be in flagged when judges agree; "
                f"got flagged={outcome.flagged!r}"
            )


# ---------------------------------------------------------------------------
# AC-4: per-dimension disagreement (delta ≥2) flags the dimension
# ---------------------------------------------------------------------------


class TestPerDimensionDisagreementFlagsDimension:
    """AC-4: rubrics differ by ≥2 on a2_appropriateness → disagreed True, dimension flagged."""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_per_dimension_disagreement_flags_dimension(
        self, mock_openrouter: AsyncMock
    ) -> None:
        """AC-4: judge A gives a2_appropriateness=5, judge B gives a2_appropriateness=3.

        Delta = 2 → disagreed True, "a2_appropriateness" must be in flagged_fields.
        """
        rubric_a = {**_PERFECT_RUBRIC_DICT, "a2_appropriateness": 5}
        rubric_b = {**_PERFECT_RUBRIC_DICT, "a2_appropriateness": 3}

        mock_openrouter.complete.side_effect = [
            _rubric_response(rubric_a),
            _rubric_response(rubric_b),
        ]
        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)

        outcome = await svc.judge(proposal)

        assert outcome.disagreed is True, (
            f"AC-4: delta=2 on a2_appropriateness must produce disagreed=True; "
            f"got {outcome.disagreed}"
        )
        assert "a2_appropriateness" in (
            outcome.flagged or []
        ), f"AC-4: 'a2_appropriateness' must be in flagged; got flagged={outcome.flagged!r}"
        assert "a2_appropriateness" in (outcome.disagreeing_dimensions or []), (
            f"AC-4: 'a2_appropriateness' must be in disagreeing_dimensions; "
            f"got {outcome.disagreeing_dimensions!r}"
        )


# ---------------------------------------------------------------------------
# AC-4(b): blocking-field set mismatch only → disagreed True, dimensions=[]
# ---------------------------------------------------------------------------


class TestBlockingFieldMismatchOnlyTriggersDisagreement:
    """AC-4(b): identical 5-dim rubrics but different blocking-issue fields → disagreed True
    with disagreeing_dimensions == [].
    """

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_blocking_field_mismatch_only_triggers_disagreement(
        self, mock_openrouter: AsyncMock
    ) -> None:
        """AC-4(b): both rubrics have all-4 scores identical (no delta ≥2),
        but judge A blocks example_greek and judge B blocks gloss_en.

        → disagreed True
        → both fields in flagged_fields
        → outcome.disagreeing_dimensions == []
        """
        rubric_a = {
            "naturalness": 4,
            "sense_fit": 4,
            "translation_faith_en": 4,
            "translation_faith_ru": 4,
            "a2_appropriateness": 4,
            "blocking_issues": [
                {"field": "example_greek", "issue": "sentence sounds unnatural"},
            ],
        }
        rubric_b = {
            "naturalness": 4,
            "sense_fit": 4,
            "translation_faith_en": 4,
            "translation_faith_ru": 4,
            "a2_appropriateness": 4,
            "blocking_issues": [
                {"field": "gloss_en", "issue": "gloss is ambiguous"},
            ],
        }

        mock_openrouter.complete.side_effect = [
            _rubric_response(rubric_a),
            _rubric_response(rubric_b),
        ]
        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)

        outcome = await svc.judge(proposal)

        assert outcome.disagreed is True, (
            f"AC-4(b): different blocking-issue fields must produce disagreed=True; "
            f"got {outcome.disagreed}"
        )
        assert outcome.disagreeing_dimensions == [], (
            f"AC-4(b): disagreeing_dimensions must be [] when only blocking sets differ; "
            f"got {outcome.disagreeing_dimensions!r}"
        )
        assert "example_greek" in (
            outcome.flagged or []
        ), f"AC-4(b): 'example_greek' must be flagged; got flagged={outcome.flagged!r}"
        assert "gloss_en" in (
            outcome.flagged or []
        ), f"AC-4(b): 'gloss_en' must be flagged; got flagged={outcome.flagged!r}"


# ---------------------------------------------------------------------------
# AC-5: blocking issue on a field → that field is in flagged_fields
# ---------------------------------------------------------------------------


class TestBlockingIssueFlagsNamedField:
    """AC-5: judge A raises blocking_issue on example_greek → "example_greek" flagged."""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_blocking_issue_flags_named_field(self, mock_openrouter: AsyncMock) -> None:
        """AC-5: judge A blocking_issue field=example_greek → "example_greek" in flagged_fields."""
        rubric_a = {
            "naturalness": 4,
            "sense_fit": 4,
            "translation_faith_en": 4,
            "translation_faith_ru": 4,
            "a2_appropriateness": 4,
            "blocking_issues": [
                {"field": "example_greek", "issue": "sentence is grammatically incorrect"},
            ],
        }
        rubric_b = {**_PERFECT_RUBRIC_DICT}  # no blocking issues

        mock_openrouter.complete.side_effect = [
            _rubric_response(rubric_a),
            _rubric_response(rubric_b),
        ]
        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)

        outcome = await svc.judge(proposal)

        assert "example_greek" in (outcome.flagged or []), (
            f"AC-5: blocking_issue on example_greek must flag that field; "
            f"got flagged={outcome.flagged!r}"
        )
        assert "example_greek" in (proposal.flagged_fields or []), (
            f"AC-5: 'example_greek' must be in proposal.flagged_fields; "
            f"got {proposal.flagged_fields!r}"
        )


# ---------------------------------------------------------------------------
# AC-6: flagged_fields append-merge (pre-existing flags preserved, no duplicates)
# ---------------------------------------------------------------------------


class TestFlaggedFieldsAppendMerge:
    """AC-6: pre-existing flagged_fields must be preserved and new flags appended."""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_flagged_fields_append_merge(self, mock_openrouter: AsyncMock) -> None:
        """AC-6: proposal.flagged_fields pre-set to ["gloss_en"].

        After judge():
          - "gloss_en" still present (not clobbered)
          - new flags from judge are added
          - no duplicates for any field
        """
        rubric_a = {
            "naturalness": 5,
            "sense_fit": 5,
            "translation_faith_en": 5,
            "translation_faith_ru": 5,
            "a2_appropriateness": 5,
            "blocking_issues": [
                {"field": "example_greek", "issue": "uses out-of-vocab word"},
            ],
        }
        rubric_b = {**_PERFECT_RUBRIC_DICT}

        mock_openrouter.complete.side_effect = [
            _rubric_response(rubric_a),
            _rubric_response(rubric_b),
        ]
        # Pre-seed a flag from an earlier stage
        proposal = _make_proposal(flagged_fields=["gloss_en"])
        svc = _make_service(mock_openrouter)

        await svc.judge(proposal)

        assert proposal.flagged_fields is not None
        assert "gloss_en" in proposal.flagged_fields, (
            f"AC-6: pre-existing 'gloss_en' must NOT be clobbered; "
            f"got {proposal.flagged_fields!r}"
        )
        assert "example_greek" in proposal.flagged_fields, (
            f"AC-6: new 'example_greek' flag must be appended; " f"got {proposal.flagged_fields!r}"
        )
        # No duplicates
        for field in proposal.flagged_fields:
            assert proposal.flagged_fields.count(field) == 1, (
                f"AC-6: duplicate flag {field!r} in flagged_fields; "
                f"got {proposal.flagged_fields!r}"
            )


# ---------------------------------------------------------------------------
# AC-7: judge_scores JSONB shape — no trust_score/aggregate/overall/score
# ---------------------------------------------------------------------------


class TestJudgeScoresPersistedShape:
    """AC-7: judge_scores must have the correct schema_version, 2 judges,
    a disagreement record, and NO forbidden aggregate keys.
    """

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_judge_scores_persisted_shape(self, mock_openrouter: AsyncMock) -> None:
        """AC-7: proposal.judge_scores has schema_version=="lexgen.judge.v1",
        2 judges each with a rubric, a disagreement record;
        and NO key in {"trust_score","overall","score","aggregate"} anywhere.
        """
        mock_openrouter.complete.side_effect = [
            _rubric_response(_PERFECT_RUBRIC_DICT),
            _rubric_response(_GOOD_RUBRIC_DICT),
        ]
        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)

        await svc.judge(proposal)

        assert proposal.judge_scores is not None, "AC-7: judge_scores must be set after judge()"
        scores = proposal.judge_scores
        assert (
            scores.get("schema_version") == "lexgen.judge.v1"
        ), f"AC-7: schema_version must be 'lexgen.judge.v1'; got {scores.get('schema_version')!r}"
        assert "judges" in scores, "AC-7: 'judges' key must be present in judge_scores"
        assert (
            len(scores["judges"]) == 2
        ), f"AC-7: must have exactly 2 judge entries; got {len(scores['judges'])}"
        assert "disagreement" in scores, "AC-7: 'disagreement' key must be present in judge_scores"

        # Recursively check for forbidden keys anywhere in the judge_scores tree
        forbidden = {"trust_score", "overall", "score", "aggregate"}

        def _collect_keys(obj, path="judge_scores"):
            """Recursively yield all string keys found in obj."""
            if isinstance(obj, dict):
                for k, v in obj.items():
                    yield k
                    yield from _collect_keys(v, f"{path}.{k}")
            elif isinstance(obj, list):
                for i, item in enumerate(obj):
                    yield from _collect_keys(item, f"{path}[{i}]")

        all_keys = set(_collect_keys(scores))
        bad_keys = forbidden & all_keys
        assert not bad_keys, (
            f"AC-7: forbidden key(s) found in judge_scores: {bad_keys!r}. "
            "No trust_score/overall/score/aggregate may appear anywhere in judge_scores."
        )


# ---------------------------------------------------------------------------
# AC-8: SCORED → NEEDS_REVIEW (binary routing)
# ---------------------------------------------------------------------------


class TestRouteScoredToNeedsReview:
    """AC-8: proposal transitions from SCORED to NEEDS_REVIEW after judge()."""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_routes_scored_to_needs_review(self, mock_openrouter: AsyncMock) -> None:
        """AC-8: proposal.status == NEEDS_REVIEW after judge() completes."""
        mock_openrouter.complete.side_effect = [
            _rubric_response(_PERFECT_RUBRIC_DICT),
            _rubric_response(_GOOD_RUBRIC_DICT),
        ]
        proposal = _make_proposal()
        assert proposal.status == WordProposalState.SCORED, "Pre-condition: must start SCORED"

        svc = _make_service(mock_openrouter)
        await svc.judge(proposal)

        assert proposal.status == WordProposalState.NEEDS_REVIEW, (
            f"AC-8: proposal.status must be NEEDS_REVIEW after judge(); " f"got {proposal.status!r}"
        )


# ---------------------------------------------------------------------------
# AC-9: full-agreement all-5 rubrics → still NEEDS_REVIEW, trust_score None
# ---------------------------------------------------------------------------


class TestHighestScoringFullAgreementStillNeedsReview:
    """AC-9: all-5 rubrics, identical, no blocking issues → NEEDS_REVIEW, NOT AUTO_APPROVED.
    trust_score must remain None.
    """

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_highest_scoring_full_agreement_still_needs_review(
        self, mock_openrouter: AsyncMock
    ) -> None:
        """AC-9: both judges return identical perfect rubrics with no blocking issues.

        → status NEEDS_REVIEW (NOT AUTO_APPROVED)
        → disagreed False
        → proposal.trust_score is None
        """
        mock_openrouter.complete.side_effect = [
            _rubric_response(_PERFECT_RUBRIC_DICT),
            _rubric_response(_PERFECT_RUBRIC_DICT),
        ]
        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)

        outcome = await svc.judge(proposal)

        assert proposal.status == WordProposalState.NEEDS_REVIEW, (
            f"AC-9: perfect-agreement proposal must go to NEEDS_REVIEW (not AUTO_APPROVED); "
            f"got {proposal.status!r}"
        )
        assert (
            outcome.disagreed is False
        ), f"AC-9: perfect agreement → disagreed must be False; got {outcome.disagreed}"
        assert proposal.trust_score is None, (
            f"AC-9: trust_score must remain None (INERT in v1); " f"got {proposal.trust_score!r}"
        )


# ---------------------------------------------------------------------------
# REGRESSION: judge() must tolerate the sanctioned `check_e_regens` metadata
# key written by LexgenVerifyService (LEXGEN-10 Check-E regen count), while
# the morphology-leakage guard (extra="forbid") must STILL reject any other
# unexpected key.
# ---------------------------------------------------------------------------


class TestJudgeToleratesCheckERegenKey:
    """Regression for the verify↔judge contract (LEXGEN-10 writes check_e_regens).

    LexgenVerifyService intentionally persists the Check-E regeneration count
    into generated_content as check_e_regens.  GeneratedLexContent has
    extra="forbid" so it would previously reject that key with ValidationError.

    The fix strips only the single sanctioned key before validation, leaving
    the morphology-leakage guard intact for all other unexpected keys.
    """

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_judge_tolerates_check_e_regens_key_in_generated_content(
        self, mock_openrouter: AsyncMock
    ) -> None:
        """REGRESSION (Fix 1): proposal whose generated_content carries check_e_regens
        must NOT raise ValidationError — judge() must succeed and reach NEEDS_REVIEW.

        Mirrors the real pipeline path where Check E regenerated at least once
        before the proposal reached the judge stage.
        """
        mock_openrouter.complete.side_effect = [
            _rubric_response(_PERFECT_RUBRIC_DICT),
            _rubric_response(_PERFECT_RUBRIC_DICT),
        ]
        # Simulate generated_content written by the verify stage after Check-E regen.
        content_with_regen_key = {
            **_make_generated_content_dict(),
            "check_e_regens": 2,  # sanctioned LEXGEN-10 verify metadata key
        }
        proposal = _make_proposal(generated_content=content_with_regen_key)
        svc = _make_service(mock_openrouter)

        # Must NOT raise ValidationError despite check_e_regens being present.
        outcome = await svc.judge(proposal)

        assert proposal.status == WordProposalState.NEEDS_REVIEW, (
            "REGRESSION: judge() must reach NEEDS_REVIEW when generated_content "
            f"carries check_e_regens; got {proposal.status!r}"
        )
        assert (
            outcome.routed_to == WordProposalState.NEEDS_REVIEW
        ), f"REGRESSION: routed_to must be NEEDS_REVIEW; got {outcome.routed_to!r}"

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_judge_still_rejects_disallowed_morphology_key_in_generated_content(
        self, mock_openrouter: AsyncMock
    ) -> None:
        """REGRESSION guard: the extra="forbid" morphology-leakage guard must remain
        intact — a generated_content with a DISALLOWED key (e.g. 'gender') must
        still raise ValidationError, proving the guard is not weakened.
        """
        from pydantic import ValidationError  # noqa: PLC0415

        content_with_leakage = {
            **_make_generated_content_dict(),
            "gender": "neuter",  # morphology key — NOT sanctioned
        }
        proposal = _make_proposal(generated_content=content_with_leakage)
        svc = _make_service(mock_openrouter)

        with pytest.raises(ValidationError):
            await svc.judge(proposal)
