"""RED integration tests for LEXGEN-14-01: LexgenPipelineService.run_for_lemma().

Tests verify the observable contract of the end-to-end pipeline:
    EvidenceAssemblyService.assemble()
    → (if attested) generate → verify → reconcile → judge
    → single db.commit()

SEAM CONTRACT (pinned by these RED tests):
1.  LexgenPipelineService(db).run_for_lemma(
        lemma_input: str,
        *,
        pos: str = "noun",
        requested_by: UUID | None,
    ) -> tuple[WordProposal, str]
    outcome string:
      "queued"   — proposal reached NEEDS_REVIEW (attested path)
      "rejected" — proposal hard-rejected by never-invent gate

2.  Attested lemma path (lemma present in ≥1 reference):
    (proposal, "queued"),
    proposal.status == NEEDS_REVIEW,
    judge_scores non-null,
    reconciliation_log non-null.

3.  Never-invent path (lemma absent from all references):
    (proposal, "rejected"),
    proposal.status == REJECTED,
    proposal.rejection_reason.startswith("never_invent:"),
    LexgenGeneratorService.generate() was NOT called.

4.  Trust score stays None in v1 (binary routing, no auto-approve).

5.  Chain stages execute in the right order — confirmed by all of
    generated_content, generated_fields, reconciliation_log, judge_scores
    being non-null on the NEEDS_REVIEW proposal.

6.  Default pos is "noun".

DB REQUIREMENT
--------------
Requires a real Postgres db_session.  Tests seed their own reference rows
and rely on transaction-rollback isolation.

FAKE LLM INJECTION
------------------
Tests activate the deterministic FakeOpenRouter by monkeypatching the
_get_openrouter function in the pipeline service module.  The executor MUST
expose a module-level ``_get_openrouter`` in lexgen_pipeline_service.py that
follows the same pattern as lexgen_review_service._get_openrouter:
  - returns FakeOpenRouter when settings.lexgen_e2e_fake_llm and not is_production
  - returns OpenRouterService otherwise
Tests patch at ``src.services.lexgen_pipeline_service._get_openrouter``.

NORMALIZATION
-------------
Tests patch get_lemma_normalization_service (same path as assembly tests)
so the test lemma strings pass through normalization unchanged.  The Wiktionary
morphology row (seeded in the test) provides the glosses_en field needed by
the verify stage's check_gloss_subset gate (severity=warn on mismatch, so
even a mismatch only flags, never hard-fails the pipeline).
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    FrequencyRank,
    WiktionaryMorphology,
    WordProposalState,
)
from src.schemas.nlp import NormalizedLemma
from src.services.lexgen_fake_openrouter import FakeOpenRouter

# ---------------------------------------------------------------------------
# Helpers — mirrored from test_evidence_assembly_lifecycle.py patterns
# ---------------------------------------------------------------------------


def _make_normalized(lemma: str) -> NormalizedLemma:
    return NormalizedLemma(
        input_word=lemma,
        lemma=lemma,
        gender=None,
        article=None,
        pos="NOUN",
        confidence=1.0,
    )


def _patch_normalize(lemma_out: str):
    """Patch get_lemma_normalization_service so normalize() returns lemma_out verbatim."""
    normalized = _make_normalized(lemma_out)
    mock_norm_svc = MagicMock()
    mock_norm_svc.normalize = MagicMock(return_value=normalized)
    return patch(
        "src.services.evidence_assembly_service.get_lemma_normalization_service",
        return_value=mock_norm_svc,
    )


async def _seed_wiktionary_row(
    db_session: AsyncSession,
    *,
    lemma: str,
    gender: str = "neuter",
    glosses_en: str = "book",
) -> WiktionaryMorphology:
    """Seed a WiktionaryMorphology row so the lemma is attested + has Wiktionary glosses."""
    row = WiktionaryMorphology(
        lemma=lemma,
        pos="noun",
        gender=gender,
        forms=[],
        glosses_en=glosses_en,
    )
    db_session.add(row)
    await db_session.flush()
    return row


async def _seed_frequency_row(
    db_session: AsyncSession,
    *,
    lemma: str,
    rank: int = 1,
) -> FrequencyRank:
    """Seed a FrequencyRank row so the lemma is attested via frequency."""
    row = FrequencyRank(lemma=lemma, rank=rank, source="wordfreq")
    db_session.add(row)
    await db_session.flush()
    return row


def _get_pipeline_service(db_session: AsyncSession):
    """Import and instantiate LexgenPipelineService.

    The import is deferred so the file collects even before the service
    exists.  Tests will fail on NotImplementedError from run_for_lemma,
    not on a collection error.
    """
    from src.services.lexgen_pipeline_service import LexgenPipelineService  # noqa: PLC0415

    return LexgenPipelineService(db_session)


# ---------------------------------------------------------------------------
# Test 1: Attested lemma → NEEDS_REVIEW with outcome="queued"
# ---------------------------------------------------------------------------


@pytest.mark.integration
async def test_run_for_lemma_attested_routes_to_needs_review(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Attested lemma runs through the full chain and lands NEEDS_REVIEW.

    Spec 1: returns (proposal, "queued"), proposal.status == NEEDS_REVIEW,
    judge_scores and reconciliation_log non-null.
    """
    lemma = "βιβλίο_pipe_test"

    # Seed Wiktionary row so the lemma is attested.
    await _seed_wiktionary_row(db_session, lemma=lemma, gender="neuter", glosses_en="book")

    # Inject FakeOpenRouter at the pipeline service's seam.
    monkeypatch.setattr(
        "src.services.lexgen_pipeline_service._get_openrouter",
        lambda: FakeOpenRouter(),
    )

    svc = _get_pipeline_service(db_session)
    with _patch_normalize(lemma):
        result = await svc.run_for_lemma(lemma, requested_by=uuid4())

    proposal, outcome = result

    assert outcome == "queued", f"Expected outcome 'queued' for attested lemma; got {outcome!r}"
    assert (
        proposal.status == WordProposalState.NEEDS_REVIEW
    ), f"Expected proposal.status == NEEDS_REVIEW for attested lemma; got {proposal.status!r}"
    assert (
        proposal.judge_scores is not None
    ), "judge_scores must be non-null after the full attested pipeline"
    assert (
        proposal.reconciliation_log is not None
    ), "reconciliation_log must be non-null after the full attested pipeline"


# ---------------------------------------------------------------------------
# Test 2: Never-invent path → REJECTED, generator NOT called
# ---------------------------------------------------------------------------


@pytest.mark.integration
async def test_run_for_lemma_never_invent_rejects_without_generation(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Lemma absent from all references → REJECTED; LexgenGeneratorService.generate NOT called.

    Spec 2: returns (proposal, "rejected"), proposal.status == REJECTED,
    rejection_reason startswith "never_invent:", generate() never called.
    """
    lemma = "ξψζ_nonword_pipe"  # no reference rows seeded for this lemma

    # Track whether generate() is called — must NOT be called on never-invent path.
    generate_spy = AsyncMock(
        side_effect=AssertionError("generate() must NOT be called on rejected proposals")
    )
    monkeypatch.setattr(
        "src.services.lexgen_generator_service.LexgenGeneratorService.generate",
        generate_spy,
    )

    svc = _get_pipeline_service(db_session)
    with _patch_normalize(lemma):
        result = await svc.run_for_lemma(lemma, requested_by=uuid4())

    proposal, outcome = result

    assert outcome == "rejected", f"Expected outcome 'rejected' for absent lemma; got {outcome!r}"
    assert (
        proposal.status == WordProposalState.REJECTED
    ), f"Expected proposal.status == REJECTED for absent lemma; got {proposal.status!r}"
    assert (
        proposal.rejection_reason is not None
    ), "rejection_reason must be set on rejected proposals"
    assert proposal.rejection_reason.startswith("never_invent:"), (
        f"rejection_reason must start with 'never_invent:'; " f"got {proposal.rejection_reason!r}"
    )
    # generate_spy would have raised AssertionError if called — reaching here confirms it was not.
    generate_spy.assert_not_awaited()


# ---------------------------------------------------------------------------
# Test 3: Attested lemma never auto-approves; trust_score stays None
# ---------------------------------------------------------------------------


@pytest.mark.integration
async def test_run_for_lemma_never_auto_approves(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Binary routing v1: attested lemma ends at NEEDS_REVIEW, never AUTO_APPROVED.

    trust_score must remain None (Decision Record §3 — no auto-approve in v1).
    Spec 3.
    """
    lemma = "δρόμος_pipe_test"

    await _seed_wiktionary_row(db_session, lemma=lemma, gender="masculine", glosses_en="road")

    monkeypatch.setattr(
        "src.services.lexgen_pipeline_service._get_openrouter",
        lambda: FakeOpenRouter(),
    )

    svc = _get_pipeline_service(db_session)
    with _patch_normalize(lemma):
        result = await svc.run_for_lemma(lemma, requested_by=None)

    proposal, outcome = result

    assert (
        proposal.status == WordProposalState.NEEDS_REVIEW
    ), f"Pipeline must end at NEEDS_REVIEW (never AUTO_APPROVED); got {proposal.status!r}"
    assert (
        proposal.status != WordProposalState.AUTO_APPROVED
    ), "Pipeline must NOT auto-approve proposals in v1 (binary routing)"
    assert (
        proposal.trust_score is None
    ), f"trust_score must stay None in v1; got {proposal.trust_score!r}"
    assert (
        outcome == "queued"
    ), f"Outcome must be 'queued' for NEEDS_REVIEW proposal; got {outcome!r}"


# ---------------------------------------------------------------------------
# Test 4: Chain order matches state machine (all stages ran, no illegal transition)
# ---------------------------------------------------------------------------


@pytest.mark.integration
async def test_run_for_lemma_chain_order_matches_state_machine(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """All pipeline stages ran in order: generated_content, generated_fields,
    reconciliation_log, and judge_scores are all non-null, confirming every
    stage executed without IllegalProposalTransition.

    Spec 4: no IllegalProposalTransition raised; terminal status is NEEDS_REVIEW;
    all four JSONB cols populated.
    """
    lemma = "σπίτι_pipe_test"

    await _seed_wiktionary_row(db_session, lemma=lemma, gender="neuter", glosses_en="house")

    monkeypatch.setattr(
        "src.services.lexgen_pipeline_service._get_openrouter",
        lambda: FakeOpenRouter(),
    )

    svc = _get_pipeline_service(db_session)

    # Must NOT raise IllegalProposalTransition.
    with _patch_normalize(lemma):
        result = await svc.run_for_lemma(lemma, requested_by=uuid4())

    proposal, outcome = result

    assert outcome == "queued", f"Expected 'queued'; got {outcome!r}"
    assert (
        proposal.status == WordProposalState.NEEDS_REVIEW
    ), f"Terminal status must be NEEDS_REVIEW; got {proposal.status!r}"

    # All four JSONB columns non-null proves each stage ran and wrote its output.
    assert (
        proposal.generated_content is not None
    ), "generated_content must be non-null — proves LexgenGeneratorService.generate() ran"
    assert (
        proposal.generated_fields is not None
    ), "generated_fields must be non-null — proves LexgenReconcilerService.reconcile() ran"
    assert (
        proposal.reconciliation_log is not None
    ), "reconciliation_log must be non-null — proves LexgenReconcilerService.reconcile() ran"
    assert (
        proposal.judge_scores is not None
    ), "judge_scores must be non-null — proves LexgenJudgeService.judge() ran"


# ---------------------------------------------------------------------------
# Test 5: Default pos is "noun"
# ---------------------------------------------------------------------------


@pytest.mark.integration
async def test_run_for_lemma_default_pos_is_noun(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When pos is omitted, the created WordProposal.pos must equal 'noun'.

    Spec 5: pos omitted → proposal created with pos == 'noun'.

    This test uses the never-invent path (no reference rows seeded) so it
    does not need the FakeOpenRouter — it short-circuits before any LLM call.
    The key assertion is on proposal.pos.
    """
    lemma = "ξψζ_pos_default_test"  # no reference rows → never-invent (fast path)

    svc = _get_pipeline_service(db_session)
    with _patch_normalize(lemma):
        result = await svc.run_for_lemma(lemma, requested_by=None)  # pos omitted — uses default

    proposal, outcome = result

    assert proposal.pos == "noun", f"Default pos must be 'noun'; got {proposal.pos!r}"
    # Sanity: the never-invent path should fire (no reference rows).
    assert outcome == "rejected", f"Expected 'rejected' (no refs seeded); got {outcome!r}"


# ---------------------------------------------------------------------------
# QA Mode B — Adversarial / edge / boundary coverage (LEXGEN-14-01)
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Edge 1: generate→REJECTED mid-chain — generator exhausts retries on attested lemma.
#
# This is the second exit path (line 133-134 in lexgen_pipeline_service.py) that
# none of the five AC tests exercise. It verifies:
#   - The pipeline returns ("rejected") when an attested lemma's generator fails.
#   - reconcile() and judge() are NOT called (would raise IllegalProposalTransition
#     on a REJECTED proposal if they were).
# ---------------------------------------------------------------------------


@pytest.mark.integration
async def test_run_for_lemma_mid_chain_generate_reject_skips_reconcile_judge(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Attested lemma but generator exhausts 3 retries → REJECTED, reconcile/judge not called.

    This covers the second early-return path (lexgen_pipeline_service.py:132-134).
    If reconcile or judge were invoked on the REJECTED proposal they would raise
    IllegalProposalTransition (REJECTED has no outgoing edges) — so their mere
    absence proves correctness.
    """
    from unittest.mock import AsyncMock
    from unittest.mock import patch as std_patch

    lemma = "τράπεζα_midchain_reject_test"

    # Seed reference so the never-invent gate passes (lemma is attested).
    await _seed_wiktionary_row(db_session, lemma=lemma, gender="feminine", glosses_en="bank")

    # Make the generator always reject (simulates 3 consecutive ValidationErrors).
    # We use a real async function that transitions the proposal to REJECTED,
    # mirroring what the real generator does after _MAX_ATTEMPTS failures.
    async def _fake_generate_exhausted(proposal):  # noqa: ANN001
        from src.core.word_proposal_state import transition as wps_transition
        from src.db.models import WordProposalState as WPS

        proposal.retry_attempts = 3
        proposal.rejection_reason = "generation_invalid_after_retries: fake exhaustion"
        wps_transition(proposal, WPS.REJECTED)
        await db_session.flush()

    monkeypatch.setattr(
        "src.services.lexgen_pipeline_service._get_openrouter",
        lambda: FakeOpenRouter(),
    )

    reconcile_spy = AsyncMock(
        side_effect=AssertionError("reconcile() must NOT be called when generator rejects")
    )
    judge_spy = AsyncMock(
        side_effect=AssertionError("judge() must NOT be called when generator rejects")
    )

    svc = _get_pipeline_service(db_session)

    with (
        _patch_normalize(lemma),
        std_patch(
            "src.services.lexgen_generator_service.LexgenGeneratorService.generate",
            _fake_generate_exhausted,
        ),
        std_patch(
            "src.services.lexgen_reconciler_service.LexgenReconcilerService.reconcile",
            reconcile_spy,
        ),
        std_patch(
            "src.services.lexgen_judge_service.LexgenJudgeService.judge",
            judge_spy,
        ),
    ):
        result = await svc.run_for_lemma(lemma, requested_by=uuid4())

    proposal, outcome = result

    assert (
        outcome == "rejected"
    ), f"Expected 'rejected' when generator exhausts retries; got {outcome!r}"
    assert (
        proposal.status == WordProposalState.REJECTED
    ), f"Proposal must be REJECTED after generator exhaustion; got {proposal.status!r}"
    assert proposal.rejection_reason is not None
    assert "generation_invalid_after_retries" in proposal.rejection_reason
    # Reconcile and judge spies would have raised AssertionError if called.
    reconcile_spy.assert_not_awaited()
    judge_spy.assert_not_awaited()


# ---------------------------------------------------------------------------
# Edge 2: requested_by=None (admin/system trigger) on attested lemma.
#
# The AC tests always pass a UUID for requested_by. This edge verifies that
# None is accepted and the full attested pipeline still completes correctly —
# the pipeline signature declares `requested_by: UUID | None`.
# ---------------------------------------------------------------------------


@pytest.mark.integration
async def test_run_for_lemma_requested_by_none_routes_to_needs_review(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """requested_by=None (system/admin call) on attested lemma → NEEDS_REVIEW.

    The pipeline signature declares UUID | None. Callers like batch generation
    may pass None. This test confirms the None branch does not cause an error
    or change the outcome for an attested lemma.
    """
    lemma = "ποτάμι_system_trigger_test"

    await _seed_wiktionary_row(db_session, lemma=lemma, gender="neuter", glosses_en="river")

    monkeypatch.setattr(
        "src.services.lexgen_pipeline_service._get_openrouter",
        lambda: FakeOpenRouter(),
    )

    svc = _get_pipeline_service(db_session)
    with _patch_normalize(lemma):
        result = await svc.run_for_lemma(lemma, requested_by=None)

    proposal, outcome = result

    assert (
        outcome == "queued"
    ), f"requested_by=None attested path must return 'queued'; got {outcome!r}"
    assert (
        proposal.status == WordProposalState.NEEDS_REVIEW
    ), f"requested_by=None attested path must end at NEEDS_REVIEW; got {proposal.status!r}"
    assert proposal.judge_scores is not None, "judge_scores must be non-null"
    assert proposal.reconciliation_log is not None, "reconciliation_log must be non-null"
    # requested_by should be None on the persisted proposal.
    assert proposal.requested_by is None, (
        f"proposal.requested_by must be None when called with None; "
        f"got {proposal.requested_by!r}"
    )
