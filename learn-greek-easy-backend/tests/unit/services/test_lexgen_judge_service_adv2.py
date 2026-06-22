"""Adversarial coverage for LexgenJudgeService — Mode B additions (LEXGEN-11-02 QA).

These tests go beyond the 14 AC tests to pin boundary, failure-mode, and
invariant scenarios the AC tests do not cover.

ADV-01  D1 boundary — delta exactly 2 on ONE dimension → disagreed True (lower bound).
ADV-02  D1 boundary — delta exactly 1 on all dimensions → disagreed False (upper quiet).
ADV-03  Both judges errored (all attempts raise) → both recorded errored,
        disagreed=True, routes to NEEDS_REVIEW, no crash, trust_score None.
ADV-04  Multiple disagreeing dimensions → all appear in both flagged_fields and
        disagreement.dimensions.
ADV-05  Blocking-issue field de-dup: both judges block the SAME field → that field
        appears ONCE in flagged_fields; same field-set means branch-(b) does NOT fire
        (disagreed driven by dim delta only in this case).
ADV-06  judge_scores round-trips: each rubric entry re-validates as JudgeRubric;
        both model slugs recorded correctly.
ADV-07  trust_score stays None on degraded path (one judge errored + one OK).
ADV-08  Recursive no-aggregate-key: no key matching {trust_score, overall, aggregate,
        mean, score, confidence} anywhere in judge_scores (walks nested dicts/lists).
        Extends AC-7 which omits 'mean' and 'confidence' from its forbidden set.
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
# ---------------------------------------------------------------------------


def _get_service_class():
    from src.services.lexgen_judge_service import LexgenJudgeService  # noqa: PLC0415

    return LexgenJudgeService


# ---------------------------------------------------------------------------
# Settings fixture — shared across every test in this file
# ---------------------------------------------------------------------------

_JUDGE_MODEL_A = "model-a/x"
_JUDGE_MODEL_B = "model-b/y"


@pytest.fixture(autouse=True)
def patch_judge_models():
    """Patch settings so every test gets exactly two known judge model slugs.

    Uses object.__setattr__ bypass — Pydantic v2 Settings rejects unknown
    fields via __setattr__ before LEXGEN-11-03 adds them to config.py.
    """
    _MISSING = object()
    attrs = {
        "lexgen_judge_models": [_JUDGE_MODEL_A, _JUDGE_MODEL_B],
        "lexgen_judge_max_tokens": 1024,
        "lexgen_judge_max_attempts": 3,
    }
    originals = {k: getattr(settings, k, _MISSING) for k in attrs}
    for k, v in attrs.items():
        object.__setattr__(settings, k, v)
    yield
    for k, v in originals.items():
        if v is _MISSING:
            try:
                object.__delattr__(settings, k)
            except AttributeError:
                pass
        else:
            object.__setattr__(settings, k, v)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

_STANDARD_FORMS: list[FormBundle] = [
    FormBundle(form="βιβλίο", features={"case": "nominative", "number": "singular"}),
    FormBundle(form="βιβλίου", features={"case": "genitive", "number": "singular"}),
]


def _make_biblio_packet() -> EvidencePacket:
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


def _make_proposal(
    *,
    status: WordProposalState = WordProposalState.SCORED,
    flagged_fields: list[str] | None = None,
    generated_fields: dict | None = None,
    reconciliation_log: dict | None = None,
) -> WordProposal:
    packet = _make_biblio_packet()
    proposal = WordProposal(
        lemma_input="βιβλίο",
        pos="noun",
        origin=WordProposalOrigin.ADMIN,
        status=status,
    )
    proposal.evidence_packet = packet.model_dump(mode="json")
    proposal.generated_content = {
        "gloss_en": "book",
        "gloss_ru": "книга",
        "example_greek": "Διαβάζω ένα βιβλίο.",
        "example_translation": "I am reading a book.",
    }
    proposal.generated_fields = generated_fields
    proposal.reconciliation_log = reconciliation_log
    proposal.flagged_fields = flagged_fields
    proposal.judge_scores = None
    proposal.trust_score = None
    return proposal


def _make_db_mock() -> AsyncMock:
    mock_db = AsyncMock()
    mock_db.flush = AsyncMock()
    return mock_db


def _make_service(mock_openrouter: AsyncMock) -> object:
    cls = _get_service_class()
    return cls(db=_make_db_mock(), openrouter=mock_openrouter)


def _rubric_response(rubric_dict: dict) -> OpenRouterResponse:
    return OpenRouterResponse(
        content=json.dumps(rubric_dict),
        model=_JUDGE_MODEL_A,
        usage=None,
        latency_ms=0.0,
    )


def _rubric(*, overrides: dict | None = None) -> dict:
    """Return a perfect rubric dict with optional field overrides."""
    base = {
        "naturalness": 5,
        "sense_fit": 5,
        "translation_faith_en": 5,
        "translation_faith_ru": 5,
        "a2_appropriateness": 5,
        "blocking_issues": [],
    }
    if overrides:
        base.update(overrides)
    return base


@pytest.fixture()
def mock_openrouter() -> AsyncMock:
    return AsyncMock(spec=OpenRouterService)


# ---------------------------------------------------------------------------
# ADV-01: D1 boundary — delta EXACTLY 2 triggers disagreement
# ---------------------------------------------------------------------------


class TestD1BoundaryExactly2Disagrees:
    """ADV-01: delta of exactly 2 on ONE dimension → disagreed True.

    The AC-4 test also uses delta=2 (a2_appropriateness 5 vs 3), so this test
    confirms the same boundary but on a DIFFERENT dimension (naturalness) and
    verifies the dimension name ends up in disagreeing_dimensions.
    """

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_delta_exactly_2_triggers_disagreement(self, mock_openrouter: AsyncMock) -> None:
        """ADV-01: naturalness 5 vs 3 (delta=2) → disagreed True; dimension in list."""
        rubric_a = _rubric(overrides={"naturalness": 5})
        rubric_b = _rubric(overrides={"naturalness": 3})

        mock_openrouter.complete.side_effect = [
            _rubric_response(rubric_a),
            _rubric_response(rubric_b),
        ]
        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)
        outcome = await svc.judge(proposal)

        assert outcome.disagreed is True, (
            f"ADV-01: delta=2 on naturalness must produce disagreed=True; "
            f"got {outcome.disagreed}"
        )
        assert "naturalness" in (outcome.disagreeing_dimensions or []), (
            f"ADV-01: 'naturalness' must be in disagreeing_dimensions; "
            f"got {outcome.disagreeing_dimensions!r}"
        )
        assert "naturalness" in (
            outcome.flagged or []
        ), f"ADV-01: 'naturalness' must be in flagged; got {outcome.flagged!r}"


# ---------------------------------------------------------------------------
# ADV-02: D1 boundary — delta exactly 1 on every dimension → disagreed False
# ---------------------------------------------------------------------------


class TestD1BoundaryExactly1Agrees:
    """ADV-02: delta of 1 on every dimension → disagreed False (below threshold).

    Pins that the ≥2 check is not >2 (off-by-one on the wrong side).
    """

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_delta_exactly_1_all_dimensions_no_disagreement(
        self, mock_openrouter: AsyncMock
    ) -> None:
        """ADV-02: all five dimensions differ by exactly 1 → disagreed False."""
        rubric_a = {
            "naturalness": 5,
            "sense_fit": 5,
            "translation_faith_en": 5,
            "translation_faith_ru": 5,
            "a2_appropriateness": 5,
            "blocking_issues": [],
        }
        rubric_b = {
            "naturalness": 4,
            "sense_fit": 4,
            "translation_faith_en": 4,
            "translation_faith_ru": 4,
            "a2_appropriateness": 4,
            "blocking_issues": [],
        }

        mock_openrouter.complete.side_effect = [
            _rubric_response(rubric_a),
            _rubric_response(rubric_b),
        ]
        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)
        outcome = await svc.judge(proposal)

        assert outcome.disagreed is False, (
            f"ADV-02: delta=1 on all dimensions must produce disagreed=False; "
            f"got {outcome.disagreed}"
        )
        assert outcome.disagreeing_dimensions == [], (
            f"ADV-02: disagreeing_dimensions must be [] when all deltas are 1; "
            f"got {outcome.disagreeing_dimensions!r}"
        )
        # No dimension name should appear in flagged (no blocking issues, delta<2)
        for dim in (
            "naturalness",
            "sense_fit",
            "translation_faith_en",
            "translation_faith_ru",
            "a2_appropriateness",
        ):
            assert dim not in (proposal.flagged_fields or []), (
                f"ADV-02: dimension {dim!r} must NOT be flagged when delta=1; "
                f"got flagged_fields={proposal.flagged_fields!r}"
            )


# ---------------------------------------------------------------------------
# ADV-03: Both judges errored → routes, trust_score None, no crash
# ---------------------------------------------------------------------------


class TestBothJudgesErrored:
    """ADV-03: both judges exhaust all attempts (exception raised each time).

    Verifies:
    - Both JudgeResult.status == "errored"
    - disagreed=True (neither side confirmed)
    - proposal.status == NEEDS_REVIEW (not REJECTED, no crash)
    - proposal.trust_score is None
    - judge_scores written with both errored entries
    """

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_both_judges_errored_routes_to_needs_review(
        self, mock_openrouter: AsyncMock
    ) -> None:
        """ADV-03: judge A and judge B each raise on all 3 attempts."""
        err = Exception("network unreachable")
        # 3 attempts per judge × 2 judges = 6 exceptions
        mock_openrouter.complete.side_effect = [err] * 6

        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)
        outcome = await svc.judge(proposal)

        # Both judges errored
        errored = [r for r in outcome.judges if r.status == "errored"]
        assert len(errored) == 2, (
            f"ADV-03: both judges must have status='errored'; "
            f"got statuses={[r.status for r in outcome.judges]!r}"
        )

        # Cannot confirm agreement when both errored
        assert (
            outcome.disagreed is True
        ), f"ADV-03: both-errored must produce disagreed=True; got {outcome.disagreed}"

        # Binary routing still applies — no rejection
        assert proposal.status == WordProposalState.NEEDS_REVIEW, (
            f"ADV-03: proposal must route to NEEDS_REVIEW even when both judges error; "
            f"got {proposal.status!r}"
        )

        # trust_score must remain untouched
        assert proposal.trust_score is None, (
            f"ADV-03: trust_score must remain None on both-errored path; "
            f"got {proposal.trust_score!r}"
        )

        # judge_scores must still be written (schema_version present)
        assert (
            proposal.judge_scores is not None
        ), "ADV-03: judge_scores must be set even when both judges error"
        assert proposal.judge_scores.get("schema_version") == "lexgen.judge.v1", (
            f"ADV-03: judge_scores schema_version must be 'lexgen.judge.v1'; "
            f"got {proposal.judge_scores.get('schema_version')!r}"
        )


# ---------------------------------------------------------------------------
# ADV-04: Multiple disagreeing dimensions → all in flagged + dimensions list
# ---------------------------------------------------------------------------


class TestMultipleDisagreeingDimensions:
    """ADV-04: rubrics differ by ≥2 on THREE dimensions simultaneously.

    All three dimension names must appear in both flagged_fields and
    outcome.disagreeing_dimensions.
    """

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_multiple_disagreeing_dimensions_all_flagged(
        self, mock_openrouter: AsyncMock
    ) -> None:
        """ADV-04: three dimensions with delta ≥2 → all appear in flagged + dimensions list."""
        rubric_a = {
            "naturalness": 5,
            "sense_fit": 5,
            "translation_faith_en": 5,
            "translation_faith_ru": 1,  # delta=4
            "a2_appropriateness": 1,  # delta=4
            "blocking_issues": [],
        }
        rubric_b = {
            "naturalness": 1,  # delta=4
            "sense_fit": 5,
            "translation_faith_en": 5,
            "translation_faith_ru": 5,  # delta=4
            "a2_appropriateness": 5,  # delta=4
            "blocking_issues": [],
        }
        # Expected disagreeing dimensions: naturalness, translation_faith_ru, a2_appropriateness

        mock_openrouter.complete.side_effect = [
            _rubric_response(rubric_a),
            _rubric_response(rubric_b),
        ]
        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)
        outcome = await svc.judge(proposal)

        assert outcome.disagreed is True, (
            f"ADV-04: three-dimension delta must produce disagreed=True; "
            f"got {outcome.disagreed}"
        )

        expected_dims = {"naturalness", "translation_faith_ru", "a2_appropriateness"}
        actual_dims = set(outcome.disagreeing_dimensions or [])
        assert expected_dims == actual_dims, (
            f"ADV-04: disagreeing_dimensions must be exactly {expected_dims!r}; "
            f"got {actual_dims!r}"
        )

        flagged_set = set(outcome.flagged or [])
        missing_from_flagged = expected_dims - flagged_set
        assert not missing_from_flagged, (
            f"ADV-04: disagreeing dimensions missing from flagged: {missing_from_flagged!r}; "
            f"got flagged={outcome.flagged!r}"
        )


# ---------------------------------------------------------------------------
# ADV-05: Blocking-issue field de-dup — same field from both judges → once in flagged
# ---------------------------------------------------------------------------


class TestBlockingIssueSameFieldBothJudgesDeduped:
    """ADV-05: both judges raise blocking_issue on the SAME field (gloss_ru).

    That field must appear exactly ONCE in flagged_fields (no dupe).
    Both judges agree on the blocking set → branch-(b) does NOT fire (disagreed
    is driven solely by dim-delta, which is 0 here → disagreed False).
    """

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_same_blocking_field_both_judges_deduped(
        self, mock_openrouter: AsyncMock
    ) -> None:
        """ADV-05: both judges block gloss_ru; same field-set → branch-(b) silent,
        gloss_ru appears exactly once in flagged_fields.
        """
        blocking_gloss_ru = [{"field": "gloss_ru", "issue": "Russian gloss is incorrect"}]
        rubric_a = _rubric(overrides={"blocking_issues": blocking_gloss_ru})
        rubric_b = _rubric(overrides={"blocking_issues": blocking_gloss_ru})

        mock_openrouter.complete.side_effect = [
            _rubric_response(rubric_a),
            _rubric_response(rubric_b),
        ]
        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)
        outcome = await svc.judge(proposal)

        # Both raise same field → sets are equal → branch-(b) does NOT fire
        # All dims are equal (all 5s) → branch-(a) does NOT fire
        assert outcome.disagreed is False, (
            f"ADV-05: same blocking-field-set + zero dim-delta must produce disagreed=False; "
            f"got {outcome.disagreed}"
        )

        # gloss_ru must appear exactly once (no dupe from two judges)
        count = (proposal.flagged_fields or []).count("gloss_ru")
        assert count == 1, (
            f"ADV-05: 'gloss_ru' must appear exactly once in flagged_fields; "
            f"found {count} occurrence(s) in {proposal.flagged_fields!r}"
        )


# ---------------------------------------------------------------------------
# ADV-06: judge_scores round-trips — rubric entries re-validate as JudgeRubric
# ---------------------------------------------------------------------------


class TestJudgeScoresRoundTrip:
    """ADV-06: each rubric entry stored in judge_scores re-validates as JudgeRubric,
    and both model slugs are recorded correctly.
    """

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_judge_scores_rubric_round_trips(self, mock_openrouter: AsyncMock) -> None:
        """ADV-06: both judges OK → judge_scores entries carry the correct model slugs
        and their rubric dicts re-parse as valid JudgeRubric objects.
        """
        rubric_a_dict = _rubric(overrides={"naturalness": 4, "sense_fit": 3})
        rubric_b_dict = _rubric(overrides={"naturalness": 5, "a2_appropriateness": 2})

        mock_openrouter.complete.side_effect = [
            _rubric_response(rubric_a_dict),
            _rubric_response(rubric_b_dict),
        ]
        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)
        await svc.judge(proposal)

        assert proposal.judge_scores is not None
        judge_entries = proposal.judge_scores["judges"]
        assert (
            len(judge_entries) == 2
        ), f"ADV-06: must have 2 judge entries; got {len(judge_entries)}"

        # Both model slugs must be recorded
        recorded_models = {e["model"] for e in judge_entries}
        assert (
            _JUDGE_MODEL_A in recorded_models
        ), f"ADV-06: model-a slug missing from judge_scores; got models={recorded_models!r}"
        assert (
            _JUDGE_MODEL_B in recorded_models
        ), f"ADV-06: model-b slug missing from judge_scores; got models={recorded_models!r}"

        # Each OK judge's rubric must re-validate as JudgeRubric
        for entry in judge_entries:
            if entry["status"] == "ok":
                assert (
                    entry["rubric"] is not None
                ), f"ADV-06: 'ok' judge entry must carry a non-None rubric; got {entry!r}"
                # Raises ValidationError if the stored dict is malformed
                JudgeRubric.model_validate(entry["rubric"])


# ---------------------------------------------------------------------------
# ADV-07: trust_score stays None on degraded path (one judge errored)
# ---------------------------------------------------------------------------


class TestTrustScoreStaysNoneDegradedPath:
    """ADV-07: one judge errors — trust_score must remain None on the degraded path.

    Extends AC-9 (which asserts trust_score=None on perfect agreement) to also
    cover the failure path, ensuring the invariant holds unconditionally.
    """

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_trust_score_stays_none_on_degraded_path(
        self, mock_openrouter: AsyncMock
    ) -> None:
        """ADV-07: judge B raises on all attempts; trust_score must stay None."""
        err = Exception("degraded path: OpenRouter timeout")
        mock_openrouter.complete.side_effect = [
            _rubric_response(_rubric()),  # judge A: OK
            err,
            err,
            err,  # judge B: 3× fail
        ]
        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)
        await svc.judge(proposal)

        assert proposal.trust_score is None, (
            f"ADV-07: trust_score must remain None on degraded path (one judge errored); "
            f"got {proposal.trust_score!r}"
        )


# ---------------------------------------------------------------------------
# ADV-08: Recursive no-aggregate-key check (full forbidden set)
# ---------------------------------------------------------------------------


class TestJudgeScoresNoAggregateKeyRecursive:
    """ADV-08: no key matching {trust_score, overall, aggregate, mean, score, confidence}
    anywhere in the judge_scores tree (recursively).

    AC-7 uses {"trust_score", "overall", "score", "aggregate"} — it misses "mean"
    and "confidence". This test checks the full set from the story invariants.
    """

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_no_aggregate_key_anywhere_in_judge_scores(
        self, mock_openrouter: AsyncMock
    ) -> None:
        """ADV-08: walk the complete judge_scores tree; assert none of the
        forbidden aggregate/trust keys appear at any depth.
        """
        mock_openrouter.complete.side_effect = [
            _rubric_response(_rubric()),
            _rubric_response(_rubric(overrides={"naturalness": 3})),
        ]
        proposal = _make_proposal()
        svc = _make_service(mock_openrouter)
        await svc.judge(proposal)

        assert proposal.judge_scores is not None

        # Full forbidden set from the story invariants (superset of AC-7's set)
        forbidden = {"trust_score", "overall", "aggregate", "mean", "score", "confidence"}

        def _collect_keys(obj):
            """Yield every string key found recursively in dicts/lists."""
            if isinstance(obj, dict):
                for k, v in obj.items():
                    yield k
                    yield from _collect_keys(v)
            elif isinstance(obj, list):
                for item in obj:
                    yield from _collect_keys(item)

        all_keys = set(_collect_keys(proposal.judge_scores))
        bad_keys = forbidden & all_keys
        assert not bad_keys, (
            f"ADV-08: forbidden key(s) found anywhere in judge_scores: {bad_keys!r}. "
            f"No aggregate/trust key may appear at any depth. "
            f"All keys found: {sorted(all_keys)!r}"
        )
