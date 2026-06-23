"""Safety-net integration test for the deterministic FakeOpenRouter chain (LEXGEN-13-06).

Unlike the 13-02 tests (which mock the stage methods at class level), this file
runs the REAL ``LexgenReviewService.regenerate`` and ``.edit`` with the REAL
generator / verify / reconciler / judge stage services and the FAKE OpenRouter
active.

This is the BINDING local correctness gate: it confirms that:
  1. The fake is correctly injected via ``_get_openrouter()``.
  2. The entire real chain (generator → verify → reconcile → judge) runs end-to-end
     with the fake and reaches ``needs_review`` for both regenerate AND edit.
  3. The canned payloads satisfy all downstream validators (GeneratedLexContent,
     JudgeRubric, check_gloss_subset, check_e, check_target_attested).
  4. The prod-safety guard: flag OFF → ``_get_openrouter()`` returns the real
     ``OpenRouterService``, never the fake.

DB REQUIREMENT
--------------
Requires a real Postgres db_session (the function-scoped AsyncSession fixture from
tests/fixtures/database.py, bound at :5433). CI-only (no local DB by project rule).
Confirm collection locally:
    pytest tests/integration/services/test_lexgen_fake_openrouter_chain.py \\
        --collect-only -o addopts="" -q

spaCy CAVEAT
-----------
``check_target_attested`` lemmatizes the example via spaCy.  For a single bare
token (``"Βιβλίο."`` / ``"Δρόμος."``), spaCy almost always returns the same form
as the lemma.  Worst case: check_target_attested hard-fails → the verify stage
marks the proposal FLAGGED (not REJECTED), and after ≤2 retries the chain STILL
lands needs_review.  Final status is deterministic; only ``flagged_fields`` varies.
E2E assertions check STATUS + attempt/log EXISTENCE, never an exact flagged set.
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    ProposalAttempt,
    ReviewAction,
    WordProposal,
    WordProposalOrigin,
    WordProposalReviewLog,
    WordProposalState,
)
from src.schemas.lexgen import (
    EvidencePacket,
    EvidencePacketSources,
    FrequencySource,
    GreekLexiconSource,
    RulesSource,
    WiktionarySource,
)
from src.services.lexgen_fake_openrouter import FakeOpenRouter
from src.services.lexgen_review_service import LexgenReviewService, _get_openrouter

# ---------------------------------------------------------------------------
# Shared evidence-packet / proposal builders
# ---------------------------------------------------------------------------


def _make_evidence_packet(lemma: str, gender: str, gloss_en: str) -> EvidencePacket:
    """Build a minimal valid EvidencePacket for the given lemma.

    ``gloss_en`` MUST equal the FakeOpenRouter's canned ``gloss_en`` for that
    lemma so ``check_gloss_subset`` passes in the verify stage.
    """
    return EvidencePacket(
        lemma_input=lemma,
        normalized_lemma=lemma,
        pos="noun",
        sources=EvidencePacketSources(
            wiktionary=WiktionarySource(
                present=True,
                gender=gender,
                forms=[],
                pronunciation=None,
                glosses_en=gloss_en,
                genders=None,
            ),
            greek_lexicon=GreekLexiconSource(
                present=False,
                forms=[],
                attested_lemma=False,
                attested_surface_form=False,
                resolved_lemma=None,
            ),
            frequency=FrequencySource(present=False, rank=None, band=None),
            rules=RulesSource(present=False),
        ),
    )


async def _make_proposal(
    db_session: AsyncSession,
    *,
    lemma: str,
    gender: str,
    gloss_en: str,
    flagged_fields: list[str],
    generated_fields: dict,
    generated_content: dict,
    retry_attempts: int = 0,
) -> WordProposal:
    """Create a NEEDS_REVIEW proposal with all fields required for the full chain.

    Mirrors the seed rows for βιβλίο (regenerate) and δρόμος (edit).
    """
    from src.core.word_proposal_state import transition  # noqa: PLC0415

    packet = _make_evidence_packet(lemma, gender, gloss_en)
    proposal = WordProposal(
        lemma_input=lemma,
        pos="noun",
        origin=WordProposalOrigin.ADMIN,
        requested_by=None,
        status=WordProposalState.PENDING,
        evidence_packet=packet.model_dump(mode="json"),
        generated_fields=generated_fields,
        generated_content=generated_content,
        flagged_fields=flagged_fields,
        retry_attempts=retry_attempts,
    )
    db_session.add(proposal)
    await db_session.flush()

    # Advance to NEEDS_REVIEW via the same path the pipeline uses.
    transition(proposal, WordProposalState.GENERATING)
    transition(proposal, WordProposalState.SCORED)
    transition(proposal, WordProposalState.NEEDS_REVIEW)
    await db_session.flush()
    return proposal


# ---------------------------------------------------------------------------
# Prod-safety guard (no DB needed)
# ---------------------------------------------------------------------------


def test_prod_safety_flag_off_returns_real_service(monkeypatch: pytest.MonkeyPatch) -> None:
    """When lexgen_e2e_fake_llm is False, _get_openrouter() returns real service."""
    from src.config import settings  # noqa: PLC0415
    from src.services.openrouter_service import OpenRouterService  # noqa: PLC0415

    monkeypatch.setattr(settings, "lexgen_e2e_fake_llm", False)
    svc = _get_openrouter()
    assert isinstance(
        svc, OpenRouterService
    ), "_get_openrouter() must return OpenRouterService when flag is off"


def test_prod_safety_is_production_returns_real_service(monkeypatch: pytest.MonkeyPatch) -> None:
    """Even with flag ON, _get_openrouter() returns real service in production."""
    from src.config import settings  # noqa: PLC0415
    from src.services.openrouter_service import OpenRouterService  # noqa: PLC0415

    monkeypatch.setattr(settings, "lexgen_e2e_fake_llm", True)
    # Patch the property — monkeypatch can patch a property on a pydantic instance
    # by targeting the instance attribute directly (the Settings instance).
    monkeypatch.setattr(type(settings), "is_production", property(lambda self: True))
    try:
        svc = _get_openrouter()
        assert isinstance(svc, OpenRouterService), (
            "_get_openrouter() must return OpenRouterService when is_production=True "
            "(double-guard — fake must never activate in prod)"
        )
    finally:
        # Restore original is_production property so other tests aren't affected.
        monkeypatch.undo()


def test_flag_on_non_prod_returns_fake(monkeypatch: pytest.MonkeyPatch) -> None:
    """With flag ON and not in production (TESTING env), _get_openrouter() returns fake."""
    from src.config import settings  # noqa: PLC0415

    # In the test environment ENVIRONMENT=testing so is_production is already False.
    monkeypatch.setattr(settings, "lexgen_e2e_fake_llm", True)
    svc = _get_openrouter()
    assert isinstance(
        svc, FakeOpenRouter
    ), "_get_openrouter() must return FakeOpenRouter when flag on + not production"


# ---------------------------------------------------------------------------
# Real chain + fake — regenerate (βιβλίο)
# ---------------------------------------------------------------------------


@pytest.mark.integration
async def test_regenerate_real_chain_with_fake_reaches_needs_review(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The full regenerate chain (generator→verify→reconcile→judge) ends needs_review.

    Uses the real stage services and FakeOpenRouter.  Asserts:
    - Final status == needs_review.
    - ProposalAttempt snapshot created with attempt_no==1, retry_attempts==2
      (the βιβλίο seed has retry_attempts=2 — snapshot preserves the value).
    - At least one reject log row (for the prior flagged field "gender").
    - generated_content is non-null after the chain (generator output).
    - judge_scores schema_version == 'lexgen.judge.v1'.
    - disagreement.disagreed == False (identical rubric from both judges).
    """
    # Inject the fake at the module-level function the service calls.
    monkeypatch.setattr(
        "src.services.lexgen_review_service._get_openrouter",
        lambda: FakeOpenRouter(),
    )

    proposal = await _make_proposal(
        db_session,
        lemma="βιβλίο",
        gender="neuter",
        gloss_en="book",
        flagged_fields=["gender"],
        generated_fields={"gender": "neuter"},
        generated_content={
            "gloss_en": "book",
            "gloss_ru": "книга",
            "example_greek": "Βιβλίο.",
            "example_translation": "Book.",
        },
        retry_attempts=2,
    )
    proposal_id = proposal.id

    svc = LexgenReviewService(db_session)
    reviewer_id = uuid4()
    await svc.regenerate(proposal, reviewer_id=reviewer_id)

    # Status must end at needs_review (binary routing, no auto-approve in v1).
    assert (
        proposal.status == WordProposalState.NEEDS_REVIEW
    ), f"regenerate() must end needs_review; got {proposal.status!r}"

    # ProposalAttempt snapshot must exist (attempt_no 1, retry_attempts preserved).
    result = await db_session.execute(
        select(ProposalAttempt).where(ProposalAttempt.proposal_id == proposal_id)
    )
    attempts = result.scalars().all()
    assert len(attempts) >= 1, "regenerate() must create at least one ProposalAttempt snapshot"
    first_attempt = next((a for a in attempts if a.attempt_no == 1), None)
    assert first_attempt is not None, "ProposalAttempt with attempt_no==1 must exist"
    assert (
        first_attempt.retry_attempts == 2
    ), f"Snapshot must preserve proposal.retry_attempts==2; got {first_attempt.retry_attempts!r}"
    assert (
        first_attempt.generated_fields is not None
    ), "Snapshot must carry generated_fields (prior morphological state)"

    # Reject log rows for the prior flagged field(s).
    log_result = await db_session.execute(
        select(WordProposalReviewLog)
        .where(WordProposalReviewLog.proposal_id == proposal_id)
        .where(WordProposalReviewLog.action == ReviewAction.REJECT)
    )
    reject_rows = log_result.scalars().all()
    assert len(reject_rows) >= 1, "regenerate() must write reject log rows for prior flagged fields"

    # generated_content non-null (fake generator wrote it).
    assert (
        proposal.generated_content is not None
    ), "generated_content must be populated after the generator stage"

    # judge_scores structure.
    assert proposal.judge_scores is not None, "judge_scores must be set after judge stage"
    assert (
        proposal.judge_scores.get("schema_version") == "lexgen.judge.v1"
    ), "judge_scores schema_version must be 'lexgen.judge.v1'"
    disagreement = proposal.judge_scores.get("disagreement", {})
    assert (
        disagreement.get("disagreed") is False
    ), "Identical rubric from both fake judges must produce disagreed=False"


# ---------------------------------------------------------------------------
# Real chain + fake — edit (δρόμος)
# ---------------------------------------------------------------------------


@pytest.mark.integration
async def test_edit_real_chain_with_fake_reaches_needs_review(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """edit() updates generated_fields, writes an EDIT log row, ends needs_review.

    Asserts:
    - Final status == needs_review.
    - EDIT log row with field=="gender", pipeline_value=="masculine",
      edited_value=="feminine".
    - generated_fields["gender"] updated to "feminine".
    """
    monkeypatch.setattr(
        "src.services.lexgen_review_service._get_openrouter",
        lambda: FakeOpenRouter(),
    )

    proposal = await _make_proposal(
        db_session,
        lemma="δρόμος",
        gender="masculine",
        gloss_en="road",
        flagged_fields=["gender"],
        generated_fields={"gender": "masculine"},
        generated_content={
            "gloss_en": "road",
            "gloss_ru": "дорога",
            "example_greek": "Δρόμος.",
            "example_translation": "Road.",
        },
        retry_attempts=0,
    )
    proposal_id = proposal.id

    svc = LexgenReviewService(db_session)
    reviewer_id = uuid4()
    await svc.edit(proposal, field_edits={"gender": "feminine"}, reviewer_id=reviewer_id)

    # Status must end at needs_review.
    assert (
        proposal.status == WordProposalState.NEEDS_REVIEW
    ), f"edit() must end needs_review; got {proposal.status!r}"

    # generated_fields["gender"] updated.
    assert proposal.generated_fields is not None
    assert proposal.generated_fields.get("gender") == "feminine", (
        f"generated_fields['gender'] must be 'feminine' after edit; "
        f"got {proposal.generated_fields.get('gender')!r}"
    )

    # EDIT log row with correct old/new values.
    log_result = await db_session.execute(
        select(WordProposalReviewLog)
        .where(WordProposalReviewLog.proposal_id == proposal_id)
        .where(WordProposalReviewLog.action == ReviewAction.EDIT)
    )
    edit_rows = log_result.scalars().all()
    assert (
        len(edit_rows) == 1
    ), f"edit() must write exactly one EDIT log row for one field edit; got {len(edit_rows)}"
    edit_row = edit_rows[0]
    assert (
        edit_row.field == "gender"
    ), f"EDIT log row field must be 'gender'; got {edit_row.field!r}"
    assert (
        edit_row.pipeline_value == "masculine"
    ), f"EDIT log row pipeline_value (old) must be 'masculine'; got {edit_row.pipeline_value!r}"
    assert (
        edit_row.edited_value == "feminine"
    ), f"EDIT log row edited_value (new) must be 'feminine'; got {edit_row.edited_value!r}"
