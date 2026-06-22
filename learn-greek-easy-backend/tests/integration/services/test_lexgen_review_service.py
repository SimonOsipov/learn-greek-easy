"""RED integration tests for LEXGEN-13-02: LexgenReviewService.

Four reviewer actions on ``needs_review`` proposals:
  approve / edit / regenerate / reject

plus per-field ``word_proposal_review_log`` rows and the new
``needs_review → generating`` guard edge (D-REGEN-EDGE-MANDATORY).

COLLECTION NOTE
---------------
``LexgenReviewService`` does not exist yet.  To keep this file COLLECTABLE
(so pytest can count tests) the import is deferred inside a module-level
helper ``_get_service_class()``.  Each test calls that helper, which raises
``ModuleNotFoundError`` as the RED failure — NOT a collection error.

Expected RED failure mode for all tests:
    ModuleNotFoundError: No module named 'src.services.lexgen_review_service'

DB REQUIREMENT
--------------
These tests require a real Postgres db_session (the function-scoped
``AsyncSession`` fixture from tests/fixtures/database.py, bound at :5433).
DO NOT run locally — they are CI-only.  Confirm collection only:
    pytest tests/integration/services/test_lexgen_review_service.py \\
        --collect-only -o addopts="" -q
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import IllegalProposalTransition, ValidationException
from src.db.models import (
    HumanDecision,
    PartOfSpeech,
    ProposalAttempt,
    ReviewAction,
    Visibility,
    WordEntry,
    WordProposal,
    WordProposalOrigin,
    WordProposalReviewLog,
    WordProposalState,
)
from src.schemas.lexgen import (
    EvidencePacket,
    EvidencePacketSources,
    FormBundle,
    FrequencySource,
    GreekLexiconSource,
    RulesSource,
    WiktionarySource,
)

if TYPE_CHECKING:
    pass


# ---------------------------------------------------------------------------
# Deferred import — keeps file collectable before service exists.
# ---------------------------------------------------------------------------


def _get_service_class():
    """Import and return LexgenReviewService.

    Raises ModuleNotFoundError if the module has not been created yet.
    That is the RED failure mode for every test in this file.
    """
    from src.services.lexgen_review_service import LexgenReviewService  # noqa: PLC0415

    return LexgenReviewService


# ---------------------------------------------------------------------------
# Shared EvidencePacket / proposal builders
# ---------------------------------------------------------------------------


def _make_noun_forms() -> list[FormBundle]:
    """Minimal valid noun paradigm (βιβλίο — neuter -ο declension)."""
    return [
        FormBundle(form="βιβλίο", features={"case": "nominative", "number": "singular"}),
        FormBundle(form="βιβλίου", features={"case": "genitive", "number": "singular"}),
        FormBundle(form="βιβλίο", features={"case": "accusative", "number": "singular"}),
        FormBundle(form="βιβλίο", features={"case": "vocative", "number": "singular"}),
        FormBundle(form="βιβλία", features={"case": "nominative", "number": "plural"}),
        FormBundle(form="βιβλίων", features={"case": "genitive", "number": "plural"}),
        FormBundle(form="βιβλία", features={"case": "accusative", "number": "plural"}),
        FormBundle(form="βιβλία", features={"case": "vocative", "number": "plural"}),
    ]


def _make_biblio_packet() -> EvidencePacket:
    """Build a realistic EvidencePacket for βιβλίο (neuter noun)."""
    forms = _make_noun_forms()
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
                glosses_en="book",
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


async def _make_needs_review_proposal(
    db_session: AsyncSession,
    *,
    lemma: str = "βιβλίο",
    pos: str = "noun",
    flagged_fields: list[str] | None = None,
    generated_fields: dict | None = None,
    generated_content: dict | None = None,
) -> WordProposal:
    """Create and flush a WordProposal in NEEDS_REVIEW state, fully populated.

    Populates all JSONB fields needed by the review service:
    - evidence_packet: full EvidencePacket
    - generated_fields: flat declension keys + scalar morphology (reconciler output)
    - generated_content: gloss + example (LEXGEN-09 RAG output)
    - flagged_fields: list of fields flagged for review
    """
    from src.core.word_proposal_state import transition  # noqa: PLC0415

    packet = _make_biblio_packet()
    proposal = WordProposal(
        lemma_input=lemma,
        pos=pos,
        origin=WordProposalOrigin.ADMIN,
        requested_by=None,
        status=WordProposalState.PENDING,
    )
    db_session.add(proposal)
    await db_session.flush()

    # Advance through the pipeline states to reach NEEDS_REVIEW.
    transition(proposal, WordProposalState.GENERATING)
    proposal.evidence_packet = packet.model_dump(mode="json")
    # Reconciler output (generated_fields): flat declension keys + scalars.
    proposal.generated_fields = generated_fields or {
        "gender": "neuter",
        "ipa": "vivˈli.o",
        "frequency_rank": 55,
        "pos": "noun",
        "nominative_singular": "βιβλίο",
        "genitive_singular": "βιβλίου",
        "accusative_singular": "βιβλίο",
        "vocative_singular": "βιβλίο",
        "nominative_plural": "βιβλία",
        "genitive_plural": "βιβλίων",
        "accusative_plural": "βιβλία",
        "vocative_plural": "βιβλία",
    }
    # LEXGEN-09 RAG output (generated_content): gloss + example.
    proposal.generated_content = generated_content or {
        "gloss_en": "book",
        "gloss_ru": "книга",
        "example_greek": "Διαβάζω ένα βιβλίο.",
        "example_translation": "I am reading a book.",
    }
    # Simulate judge flagging some fields.
    proposal.flagged_fields = flagged_fields if flagged_fields is not None else ["gender"]
    transition(proposal, WordProposalState.SCORED)
    transition(proposal, WordProposalState.NEEDS_REVIEW)
    await db_session.flush()
    return proposal


async def _make_needs_review_zero_flagged(
    db_session: AsyncSession,
) -> WordProposal:
    """Create a NEEDS_REVIEW proposal with zero flagged fields."""
    return await _make_needs_review_proposal(db_session, flagged_fields=[])


# ---------------------------------------------------------------------------
# Helpers to create a stub deck UUID (tests don't need a real deck row since
# WordEntryRepository.link_to_deck is patched in most tests)
# ---------------------------------------------------------------------------


_FAKE_DECK_ID = uuid4()
_FAKE_REVIEWER_ID = uuid4()


# ---------------------------------------------------------------------------
# Shared LLM-stage service patcher helpers
# ---------------------------------------------------------------------------


def _noop_generate_patch():
    """Patch LexgenGeneratorService so generate() is a no-op async mock."""
    return patch(
        "src.services.lexgen_generator_service.LexgenGeneratorService.generate",
        new_callable=AsyncMock,
        return_value=None,
    )


def _noop_verify_patch():
    """Patch LexgenVerifyService so verify() is a no-op async mock.

    VerifyOutcome is a dataclass (status: Literal["PASS","FLAGGED","REJECTED"]).
    The real verify() does NOT change proposal.status (proposal stays GENERATING).
    """
    from src.services.lexgen_verify_service import VerifyOutcome  # noqa: PLC0415

    mock = AsyncMock(return_value=VerifyOutcome(status="PASS"))
    return patch(
        "src.services.lexgen_verify_service.LexgenVerifyService.verify",
        mock,
    )


def _noop_reconcile_patch():
    """Patch LexgenReconcilerService so reconcile() simulates GENERATING→SCORED transition.

    The real reconcile() calls transition(proposal, GENERATING→SCORED) + flush.
    The noop must simulate that side effect so downstream mocks (judge) see a
    SCORED proposal — matching the real pipeline's precondition.
    """
    from src.core.word_proposal_state import transition  # noqa: PLC0415
    from src.db.models import WordProposalState  # noqa: PLC0415

    async def _reconcile_side_effect(proposal_arg: object) -> None:
        transition(proposal_arg, WordProposalState.SCORED)  # type: ignore[arg-type]

    return patch(
        "src.services.lexgen_reconciler_service.LexgenReconcilerService.reconcile",
        new=_reconcile_side_effect,
    )


def _noop_judge_patch():
    """Patch LexgenJudgeService so judge() simulates SCORED→NEEDS_REVIEW transition.

    JudgeOutcome is a dataclass with fields: judges, disagreed, disagreeing_dimensions,
    flagged, routed_to — NOT status/scores. The real judge() also calls
    transition(proposal, SCORED→NEEDS_REVIEW) + flush. The noop must simulate
    that side effect so tests asserting proposal.status==NEEDS_REVIEW after edit/
    regenerate are correct.
    """
    from src.core.word_proposal_state import transition  # noqa: PLC0415
    from src.db.models import WordProposalState  # noqa: PLC0415
    from src.services.lexgen_judge_service import JudgeOutcome  # noqa: PLC0415

    async def _judge_side_effect(proposal_arg: object) -> JudgeOutcome:
        transition(proposal_arg, WordProposalState.NEEDS_REVIEW)  # type: ignore[arg-type]
        return JudgeOutcome(
            judges=[],
            disagreed=False,
            disagreeing_dimensions=[],
            flagged=[],
            routed_to=WordProposalState.NEEDS_REVIEW,
        )

    return patch(
        "src.services.lexgen_judge_service.LexgenJudgeService.judge",
        new=_judge_side_effect,
    )


# ---------------------------------------------------------------------------
# Test class 1 — approve: creates WordEntry and ships
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestApproveCreatesWordEntryAndShips:
    """AC-1: approve builds a WordEntry from the proposal and ships it."""

    async def test_approve_creates_word_entry_and_ships(self, db_session: AsyncSession) -> None:
        """correct proposal → approve(deck_id) → word_entries row exists, status=shipped.

        AC-1: After approve() completes:
          - A word_entries row was created (bulk_upsert returned it).
          - proposal.status == SHIPPED.
          - proposal.shipped_word_entry_id is set to the new entry's UUID.
        """
        svc_cls = _get_service_class()
        proposal = await _make_needs_review_proposal(db_session)
        svc = svc_cls(db_session)

        await svc.approve(proposal, deck_id=_FAKE_DECK_ID, reviewer_id=_FAKE_REVIEWER_ID)

        assert (
            proposal.status == WordProposalState.SHIPPED
        ), f"proposal.status must be SHIPPED after approve(); got {proposal.status!r}"
        assert (
            proposal.shipped_word_entry_id is not None
        ), "proposal.shipped_word_entry_id must be set after approve()"
        # Verify the word_entries row actually exists in the session.
        result = await db_session.execute(
            select(WordEntry).where(WordEntry.id == proposal.shipped_word_entry_id)
        )
        word_entry = result.scalar_one_or_none()
        assert (
            word_entry is not None
        ), "A WordEntry row must exist for shipped_word_entry_id after approve()"

    async def test_approve_maps_from_three_sources(self, db_session: AsyncSession) -> None:
        """AC-1 (CRITICAL): WordEntry fields come from THREE distinct sources.

        - translation_en from generated_content['gloss_en']
        - translation_ru from generated_content['gloss_ru']
        - pronunciation from generated_fields['ipa']
        - grammar_data = the flat {case}_{number} keys from generated_fields directly
        - examples derived from generated_content example_greek/example_translation
        - lemma from lemma_input
        - part_of_speech mapped from pos (noun → PartOfSpeech.NOUN)
        """
        svc_cls = _get_service_class()
        proposal = await _make_needs_review_proposal(db_session)
        svc = svc_cls(db_session)

        await svc.approve(proposal, deck_id=_FAKE_DECK_ID, reviewer_id=_FAKE_REVIEWER_ID)

        result = await db_session.execute(
            select(WordEntry).where(WordEntry.id == proposal.shipped_word_entry_id)
        )
        we = result.scalar_one()

        # Source 1: proposal.lemma_input
        assert we.lemma == "βιβλίο", f"lemma must come from lemma_input; got {we.lemma!r}"
        # Source 1: proposal.pos → PartOfSpeech enum
        assert (
            we.part_of_speech == PartOfSpeech.NOUN
        ), f"part_of_speech must be PartOfSpeech.NOUN from pos='noun'; got {we.part_of_speech!r}"
        # Source 2 (generated_content): gloss_en → translation_en
        assert (
            we.translation_en == "book"
        ), f"translation_en must come from generated_content['gloss_en']; got {we.translation_en!r}"
        # Source 2 (generated_content): gloss_ru → translation_ru
        assert (
            we.translation_ru == "книга"
        ), f"translation_ru must come from generated_content['gloss_ru']; got {we.translation_ru!r}"
        # Source 3 (generated_fields): ipa → pronunciation
        assert (
            we.pronunciation == "vivˈli.o"
        ), f"pronunciation must come from generated_fields['ipa']; got {we.pronunciation!r}"
        # Source 2 (generated_content): example_greek + example_translation → examples
        assert we.examples is not None and len(we.examples) >= 1, (
            "examples must be built from generated_content example_greek/example_translation; "
            f"got {we.examples!r}"
        )
        assert any("βιβλίο" in ex.get("greek", "") for ex in we.examples), (
            "examples must contain the greek example sentence; " f"got {we.examples!r}"
        )

    async def test_approve_grammar_data_from_generated_fields(
        self, db_session: AsyncSession
    ) -> None:
        """AC-1: grammar_data holds the flat declension keys from generated_fields directly.

        The reconciler already ran bundles_to_flat. approve() MUST NOT re-convert —
        it reads the flat {case}_{number} keys directly into WordEntry.grammar_data.
        """
        svc_cls = _get_service_class()
        proposal = await _make_needs_review_proposal(db_session)
        svc = svc_cls(db_session)

        await svc.approve(proposal, deck_id=_FAKE_DECK_ID, reviewer_id=_FAKE_REVIEWER_ID)

        result = await db_session.execute(
            select(WordEntry).where(WordEntry.id == proposal.shipped_word_entry_id)
        )
        we = result.scalar_one()

        assert we.grammar_data is not None, "grammar_data must be set after approve()"
        # The flat keys must be present in grammar_data
        for expected_key in ("nominative_singular", "genitive_singular", "nominative_plural"):
            assert expected_key in we.grammar_data, (
                f"grammar_data must contain flat key '{expected_key}' (copied directly "
                f"from generated_fields, NO re-conversion); "
                f"grammar_data keys={list(we.grammar_data.keys())}"
            )
        assert we.grammar_data.get("nominative_singular") == "βιβλίο", (
            f"grammar_data['nominative_singular'] must be 'βιβλίο'; "
            f"got {we.grammar_data.get('nominative_singular')!r}"
        )

    async def test_approve_logs_accept_per_field(self, db_session: AsyncSession) -> None:
        """AC-1: approve writes accept log rows per flagged field.

        For a proposal with flagged_fields=['gender'], approve must write
        a word_proposal_review_log row with action=APPROVE, field='gender'.
        """
        svc_cls = _get_service_class()
        proposal = await _make_needs_review_proposal(
            db_session, flagged_fields=["gender", "nominative_singular"]
        )
        svc = svc_cls(db_session)

        await svc.approve(proposal, deck_id=_FAKE_DECK_ID, reviewer_id=_FAKE_REVIEWER_ID)

        result = await db_session.execute(
            select(WordProposalReviewLog).where(WordProposalReviewLog.proposal_id == proposal.id)
        )
        log_rows = result.scalars().all()
        assert len(log_rows) >= 2, (
            "approve with 2 flagged fields must write at least 2 log rows; " f"got {len(log_rows)}"
        )
        flagged_in_log = {row.field for row in log_rows if row.field is not None}
        assert (
            "gender" in flagged_in_log
        ), f"'gender' must appear as a log row field; logged fields={flagged_in_log!r}"
        assert "nominative_singular" in flagged_in_log, (
            f"'nominative_singular' must appear as a log row field; "
            f"logged fields={flagged_in_log!r}"
        )
        for row in log_rows:
            if row.field is not None:
                assert row.action == ReviewAction.APPROVE, (
                    f"Per-field log rows for approve must have action=APPROVE; "
                    f"got {row.action!r}"
                )

    async def test_approve_zero_flagged_emits_single_null_summary_row(
        self, db_session: AsyncSession
    ) -> None:
        """AC-1/F7: 0 flagged fields → exactly one log row with field IS NULL, action=approve.

        A zero-flagged proposal means the pipeline had no disagreements.
        The approve() action still records the reviewer decision via a single
        summary log row with field=NULL, action=APPROVE, human_decision=ACCEPT.
        """
        svc_cls = _get_service_class()
        proposal = await _make_needs_review_zero_flagged(db_session)
        svc = svc_cls(db_session)

        await svc.approve(proposal, deck_id=_FAKE_DECK_ID, reviewer_id=_FAKE_REVIEWER_ID)

        result = await db_session.execute(
            select(WordProposalReviewLog).where(WordProposalReviewLog.proposal_id == proposal.id)
        )
        log_rows = result.scalars().all()
        assert len(log_rows) == 1, (
            f"Zero flagged fields must produce exactly 1 summary log row; "
            f"got {len(log_rows)} rows"
        )
        row = log_rows[0]
        assert row.field is None, (
            f"Summary log row field must be NULL for zero-flagged approve; "
            f"got field={row.field!r}"
        )
        assert (
            row.action == ReviewAction.APPROVE
        ), f"Summary log row action must be APPROVE; got {row.action!r}"
        assert (
            row.human_decision == HumanDecision.ACCEPT
        ), f"Summary log row human_decision must be ACCEPT; got {row.human_decision!r}"


# ---------------------------------------------------------------------------
# Test class 2 — approve: validation + transactionality
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestApproveValidationAndTransactionality:
    """AC-2, AC-3, AC-8: approve completeness check, component composition, atomicity."""

    async def test_approve_blocks_when_required_field_missing(
        self, db_session: AsyncSession
    ) -> None:
        """AC-3: generated_content lacks gloss_en → approve raises ValidationException → 422.

        The raise must happen BEFORE any mutation: status stays needs_review,
        no word_entries row is created, no log rows are written.
        """
        svc_cls = _get_service_class()
        # Provide generated_content WITHOUT gloss_en (the required derivable field).
        proposal = await _make_needs_review_proposal(
            db_session,
            generated_content={
                # gloss_en intentionally missing
                "gloss_ru": "книга",
                "example_greek": "Διαβάζω ένα βιβλίο.",
                "example_translation": "I am reading a book.",
            },
        )
        original_status = proposal.status
        svc = svc_cls(db_session)

        with pytest.raises(ValidationException) as exc_info:
            await svc.approve(proposal, deck_id=_FAKE_DECK_ID, reviewer_id=_FAKE_REVIEWER_ID)

        # Status must not have changed.
        assert proposal.status == original_status == WordProposalState.NEEDS_REVIEW, (
            f"status must stay needs_review when approve raises ValidationException; "
            f"got {proposal.status!r}"
        )
        # shipped_word_entry_id must not be set.
        assert (
            proposal.shipped_word_entry_id is None
        ), "shipped_word_entry_id must NOT be set when approve raises ValidationException"
        # No word_entries row must exist.
        result = await db_session.execute(select(WordEntry))
        entries = result.scalars().all()
        assert (
            len(entries) == 0
        ), f"No WordEntry rows must exist after failed approve; got {len(entries)}"
        # No log rows must exist.
        result = await db_session.execute(
            select(WordProposalReviewLog).where(WordProposalReviewLog.proposal_id == proposal.id)
        )
        log_rows = result.scalars().all()
        assert (
            len(log_rows) == 0
        ), f"No log rows must exist after failed approve; got {len(log_rows)}"
        # The exception must be a ValidationException (→ 422).
        assert isinstance(exc_info.value, ValidationException), (
            f"approve with missing gloss_en must raise ValidationException (→422); "
            f"got {type(exc_info.value)!r}"
        )

    async def test_approve_does_not_call_create_and_link_endpoint(
        self, db_session: AsyncSession
    ) -> None:
        """AC-2/F11: approve MUST NOT call create_and_link_word_entry (self-commits at line 3978).

        Instead it must compose bulk_upsert / link_to_deck / CardGeneratorService
        directly in ONE transaction.  We assert the endpoint function is not invoked.
        """
        svc_cls = _get_service_class()
        proposal = await _make_needs_review_proposal(db_session)
        svc = svc_cls(db_session)

        # Spy on the self-committing endpoint — it must never be called.
        with patch(
            "src.api.v1.admin.create_and_link_word_entry",
            new_callable=AsyncMock,
            side_effect=AssertionError(
                "create_and_link_word_entry must NOT be called from LexgenReviewService.approve()"
            ),
        ) as endpoint_spy:
            await svc.approve(proposal, deck_id=_FAKE_DECK_ID, reviewer_id=_FAKE_REVIEWER_ID)

        endpoint_spy.assert_not_called()
        # The proposal must still have shipped (the service used the components directly).
        assert proposal.status == WordProposalState.SHIPPED

    async def test_approve_side_effect_failure_rolls_back(self, db_session: AsyncSession) -> None:
        """AC-8: a failed side-effect (link_to_deck raises) → full rollback.

        After the exception:
          - No word_entries row persists.
          - proposal.status stays needs_review (the status change is rolled back too).
          - No log rows persist.
        This verifies that status + side effects + log rows are all in ONE transaction.
        """
        svc_cls = _get_service_class()
        proposal = await _make_needs_review_proposal(db_session)
        svc = svc_cls(db_session)

        with patch(
            "src.repositories.word_entry.WordEntryRepository.link_to_deck",
            new_callable=AsyncMock,
            side_effect=RuntimeError("simulated link_to_deck failure"),
        ):
            with pytest.raises(RuntimeError, match="simulated link_to_deck failure"):
                await svc.approve(proposal, deck_id=_FAKE_DECK_ID, reviewer_id=_FAKE_REVIEWER_ID)

        # Rollback: status must have reverted.
        assert proposal.status == WordProposalState.NEEDS_REVIEW, (
            f"status must revert to needs_review after side-effect failure; "
            f"got {proposal.status!r}"
        )
        # No word_entries row.
        result = await db_session.execute(select(WordEntry))
        entries = result.scalars().all()
        assert (
            len(entries) == 0
        ), f"No WordEntry rows must persist after rolled-back approve; got {len(entries)}"
        # No log rows.
        result = await db_session.execute(
            select(WordProposalReviewLog).where(WordProposalReviewLog.proposal_id == proposal.id)
        )
        log_rows = result.scalars().all()
        assert (
            len(log_rows) == 0
        ), f"No log rows must persist after rolled-back approve; got {len(log_rows)}"


# ---------------------------------------------------------------------------
# Test class 3 — edit: rescore → needs_review, per-field log
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestEdit:
    """AC-4: edit applies field changes, re-scores, logs per field."""

    async def test_edit_rescores_and_returns_to_needs_review(
        self, db_session: AsyncSession
    ) -> None:
        """AC-4: edit a field → status returns to needs_review, never auto_approved/shipped.

        The edit flow is:
          flat_to_bundles (at UI edge) → persist generated_fields →
          transition(needs_review → scored) → judge() → lands scored → needs_review.
        Binary routing means judge() always returns needs_review (Decision Record §3).
        """
        svc_cls = _get_service_class()
        proposal = await _make_needs_review_proposal(db_session)
        svc = svc_cls(db_session)

        edits = {"nominative_singular": "βιβλίο_edited"}

        with _noop_judge_patch():
            await svc.edit(
                proposal,
                field_edits=edits,
                reviewer_id=_FAKE_REVIEWER_ID,
            )

        # After edit + judge, status must be needs_review (binary routing).
        assert (
            proposal.status == WordProposalState.NEEDS_REVIEW
        ), f"status must be NEEDS_REVIEW after edit+judge; got {proposal.status!r}"
        # Must never reach auto_approved or shipped.
        assert proposal.status not in {
            WordProposalState.AUTO_APPROVED,
            WordProposalState.SHIPPED,
        }, "edit must never reach AUTO_APPROVED or SHIPPED"

    async def test_edit_declension_cell_roundtrips_via_flat_to_bundles(
        self, db_session: AsyncSession
    ) -> None:
        """AC-4: editing a flat declension cell persists via flat_to_bundles into generated_fields.

        The edit arrives as a flat {case}_{number} key from the UI.  The service
        must call flat_to_bundles to validate/round-trip the edit, then write the
        updated generated_fields.  The edited key must be present in the
        proposal's generated_fields after the call.
        """
        svc_cls = _get_service_class()
        proposal = await _make_needs_review_proposal(db_session)
        svc = svc_cls(db_session)

        edits = {"nominative_singular": "βιβλιαράκι"}  # a human correction

        with _noop_judge_patch():
            await svc.edit(
                proposal,
                field_edits=edits,
                reviewer_id=_FAKE_REVIEWER_ID,
            )

        # The edit must be persisted in generated_fields.
        gf = proposal.generated_fields or {}
        assert gf.get("nominative_singular") == "βιβλιαράκι", (
            f"edited nominative_singular must be persisted in generated_fields; "
            f"got {gf.get('nominative_singular')!r}"
        )

    async def test_edit_logs_per_field_old_new(self, db_session: AsyncSession) -> None:
        """AC-4: edit writes per-field log rows with field, pipeline_value (old), edited_value (new).

        Each edited field must produce a log row with:
          action = EDIT
          field = the edited field name
          pipeline_value = the original (pipeline-generated) value
          edited_value = the human correction
        """
        svc_cls = _get_service_class()
        original_nom_sg = "βιβλίο"
        proposal = await _make_needs_review_proposal(db_session)
        svc = svc_cls(db_session)

        edits = {"nominative_singular": "βιβλίο_new"}

        with _noop_judge_patch():
            await svc.edit(
                proposal,
                field_edits=edits,
                reviewer_id=_FAKE_REVIEWER_ID,
            )

        result = await db_session.execute(
            select(WordProposalReviewLog).where(
                WordProposalReviewLog.proposal_id == proposal.id,
                WordProposalReviewLog.action == ReviewAction.EDIT,
            )
        )
        edit_rows = result.scalars().all()
        assert (
            len(edit_rows) >= 1
        ), f"edit must produce at least one EDIT log row; got {len(edit_rows)}"
        edit_row = next((r for r in edit_rows if r.field == "nominative_singular"), None)
        assert edit_row is not None, "An EDIT log row for 'nominative_singular' must exist"
        assert edit_row.pipeline_value == original_nom_sg, (
            f"pipeline_value must be the old/original value '{original_nom_sg}'; "
            f"got {edit_row.pipeline_value!r}"
        )
        assert edit_row.edited_value == "βιβλίο_new", (
            f"edited_value must be the human correction 'βιβλίο_new'; "
            f"got {edit_row.edited_value!r}"
        )


# ---------------------------------------------------------------------------
# Test class 4 — regenerate: snapshot prior attempt, transition to GENERATING, re-run
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestRegenerate:
    """AC-5: regenerate snapshots prior attempt, transitions needs_review→generating, re-runs chain."""

    async def test_regenerate_keeps_prior_attempt(self, db_session: AsyncSession) -> None:
        """AC-5: a proposal_attempt snapshot row exists after regenerate.

        The prior attempt (including retry_attempts + JSONB snapshots) must be
        snapshotted BEFORE any mutation. After regenerate():
          - At least one ProposalAttempt row exists for this proposal.
          - The snapshot captures the prior generated_content and generated_fields.
        """
        svc_cls = _get_service_class()
        proposal = await _make_needs_review_proposal(db_session)
        original_content = dict(proposal.generated_content or {})
        svc = svc_cls(db_session)

        with (
            _noop_generate_patch(),
            _noop_verify_patch(),
            _noop_reconcile_patch(),
            _noop_judge_patch(),
        ):
            await svc.regenerate(proposal, reviewer_id=_FAKE_REVIEWER_ID)

        result = await db_session.execute(
            select(ProposalAttempt).where(ProposalAttempt.proposal_id == proposal.id)
        )
        attempts = result.scalars().all()
        assert len(attempts) >= 1, (
            f"At least one ProposalAttempt row must exist after regenerate(); "
            f"got {len(attempts)}"
        )
        # The snapshot must preserve the prior generated_content.
        prior = attempts[0]
        assert (
            prior.generated_content is not None
        ), "ProposalAttempt.generated_content must capture the prior attempt's content"
        assert prior.generated_content.get("gloss_en") == original_content.get("gloss_en"), (
            f"Prior attempt snapshot must preserve gloss_en={original_content.get('gloss_en')!r}; "
            f"got {prior.generated_content.get('gloss_en')!r}"
        )

    async def test_regenerate_enters_generating(self, db_session: AsyncSession) -> None:
        """AC-5/F2: the needs_review→generating transition fires BEFORE the chain.

        Uses a spy on the generator's generate() that captures proposal.status
        at entry — must observe GENERATING (proves the transition happened first,
        not bypassed).
        """
        svc_cls = _get_service_class()
        proposal = await _make_needs_review_proposal(db_session)
        svc = svc_cls(db_session)

        status_at_generate_entry: list[WordProposalState] = []

        async def _spy_generate(proposal_arg: WordProposal) -> None:
            status_at_generate_entry.append(proposal_arg.status)

        with (
            patch(
                "src.services.lexgen_generator_service.LexgenGeneratorService.generate",
                new=_spy_generate,
            ),
            _noop_verify_patch(),
            _noop_reconcile_patch(),
            _noop_judge_patch(),
        ):
            await svc.regenerate(proposal, reviewer_id=_FAKE_REVIEWER_ID)

        assert len(status_at_generate_entry) == 1, "generate() must have been called exactly once"
        assert status_at_generate_entry[0] == WordProposalState.GENERATING, (
            f"proposal.status at generate() entry must be GENERATING (transition fires BEFORE chain); "
            f"got {status_at_generate_entry[0]!r}"
        )

    async def test_regenerate_logs_rejection_of_prior(self, db_session: AsyncSession) -> None:
        """AC-5: reject log rows are written for the prior attempt's flagged fields.

        Before running the new chain, regenerate() must write per-field REJECT
        log rows for the prior flagged_fields (documenting why the prior attempt
        was not approved).
        """
        svc_cls = _get_service_class()
        proposal = await _make_needs_review_proposal(db_session, flagged_fields=["gender", "ipa"])
        svc = svc_cls(db_session)

        with (
            _noop_generate_patch(),
            _noop_verify_patch(),
            _noop_reconcile_patch(),
            _noop_judge_patch(),
        ):
            await svc.regenerate(proposal, reviewer_id=_FAKE_REVIEWER_ID)

        result = await db_session.execute(
            select(WordProposalReviewLog).where(
                WordProposalReviewLog.proposal_id == proposal.id,
                WordProposalReviewLog.action == ReviewAction.REJECT,
            )
        )
        reject_rows = result.scalars().all()
        rejected_fields = {row.field for row in reject_rows if row.field is not None}
        assert "gender" in rejected_fields, (
            f"REJECT log row must exist for prior flagged field 'gender'; "
            f"logged fields={rejected_fields!r}"
        )
        assert "ipa" in rejected_fields, (
            f"REJECT log row must exist for prior flagged field 'ipa'; "
            f"logged fields={rejected_fields!r}"
        )

    async def test_regenerate_ends_in_needs_review(self, db_session: AsyncSession) -> None:
        """AC-5: after the mocked chain, proposal.status == needs_review (new attempt).

        The full chain is: generate → verify → reconcile → judge.
        Judge always lands needs_review (binary routing, Decision Record §3).
        """
        svc_cls = _get_service_class()
        proposal = await _make_needs_review_proposal(db_session)
        svc = svc_cls(db_session)

        with (
            _noop_generate_patch(),
            _noop_verify_patch(),
            _noop_reconcile_patch(),
            _noop_judge_patch(),
        ):
            await svc.regenerate(proposal, reviewer_id=_FAKE_REVIEWER_ID)

        assert proposal.status == WordProposalState.NEEDS_REVIEW, (
            f"proposal.status must be NEEDS_REVIEW after regenerate() chain; "
            f"got {proposal.status!r}"
        )


# ---------------------------------------------------------------------------
# Test class 5 — reject: terminal, sets reason, writes log rows
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestReject:
    """AC-6: reject sets rejection_reason, transitions to REJECTED, writes log rows."""

    async def test_reject_sets_reason_and_terminal(self, db_session: AsyncSession) -> None:
        """AC-6: reject → status=rejected, rejection_reason set, reject log rows written.

        After reject():
          - proposal.status == REJECTED (terminal).
          - proposal.rejection_reason is set to the provided reason string.
          - REJECT log rows exist for the prior flagged fields.
        """
        svc_cls = _get_service_class()
        proposal = await _make_needs_review_proposal(db_session, flagged_fields=["gender"])
        svc = svc_cls(db_session)

        reason = "Gender disagreement could not be resolved."
        await svc.reject(
            proposal,
            rejection_reason=reason,
            reviewer_id=_FAKE_REVIEWER_ID,
        )

        assert (
            proposal.status == WordProposalState.REJECTED
        ), f"status must be REJECTED after reject(); got {proposal.status!r}"
        assert proposal.rejection_reason == reason, (
            f"rejection_reason must be set to the provided reason; "
            f"got {proposal.rejection_reason!r}"
        )

        result = await db_session.execute(
            select(WordProposalReviewLog).where(
                WordProposalReviewLog.proposal_id == proposal.id,
                WordProposalReviewLog.action == ReviewAction.REJECT,
            )
        )
        reject_rows = result.scalars().all()
        assert len(reject_rows) >= 1, (
            f"At least one REJECT log row must exist after reject(); " f"got {len(reject_rows)}"
        )
        rejected_fields = {row.field for row in reject_rows if row.field is not None}
        assert "gender" in rejected_fields, (
            f"REJECT log row must exist for flagged field 'gender'; "
            f"logged fields={rejected_fields!r}"
        )


# ---------------------------------------------------------------------------
# Test class 6 — all actions: guard for non-needs_review proposals
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestActionsRejectNonNeedsReview:
    """AC-7: each action on a non-needs_review proposal raises IllegalProposalTransition."""

    async def _make_shipped_proposal(self, db_session: AsyncSession) -> WordProposal:
        """Create a SHIPPED proposal for guard tests.

        Requires a real WordEntry row because shipped_word_entry_id is a FK to
        word_entries — using a random UUID would fail with IntegrityError on flush.
        """
        from src.core.word_proposal_state import transition  # noqa: PLC0415

        # Create a real WordEntry so the FK constraint is satisfied.
        word_entry = WordEntry(
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="house",
            owner_id=None,
            visibility=Visibility.SHARED,
        )
        db_session.add(word_entry)
        await db_session.flush()  # assign word_entry.id

        proposal = WordProposal(
            lemma_input="σπίτι",
            pos="noun",
            origin=WordProposalOrigin.ADMIN,
            requested_by=None,
            status=WordProposalState.NEEDS_REVIEW,
        )
        db_session.add(proposal)
        await db_session.flush()
        # Set the FK before transitioning (transition guard checks it).
        proposal.shipped_word_entry_id = word_entry.id
        transition(proposal, WordProposalState.SHIPPED)
        await db_session.flush()
        return proposal

    async def _make_scored_proposal(self, db_session: AsyncSession) -> WordProposal:
        """Create a SCORED proposal for guard tests."""
        from src.core.word_proposal_state import transition  # noqa: PLC0415

        proposal = WordProposal(
            lemma_input="σπίτι",
            pos="noun",
            origin=WordProposalOrigin.ADMIN,
            requested_by=None,
            status=WordProposalState.PENDING,
        )
        db_session.add(proposal)
        await db_session.flush()
        transition(proposal, WordProposalState.GENERATING)
        transition(proposal, WordProposalState.SCORED)
        await db_session.flush()
        return proposal

    async def test_actions_reject_non_needs_review_shipped(self, db_session: AsyncSession) -> None:
        """AC-7: all four actions on a SHIPPED proposal raise IllegalProposalTransition."""
        svc_cls = _get_service_class()
        proposal = await self._make_shipped_proposal(db_session)
        svc = svc_cls(db_session)

        with pytest.raises(IllegalProposalTransition):
            await svc.approve(proposal, deck_id=_FAKE_DECK_ID, reviewer_id=_FAKE_REVIEWER_ID)

        # Reset for next call (still shipped)
        with pytest.raises(IllegalProposalTransition):
            await svc.edit(proposal, field_edits={}, reviewer_id=_FAKE_REVIEWER_ID)

        with pytest.raises(IllegalProposalTransition):
            await svc.regenerate(proposal, reviewer_id=_FAKE_REVIEWER_ID)

        with pytest.raises(IllegalProposalTransition):
            await svc.reject(
                proposal,
                rejection_reason="test",
                reviewer_id=_FAKE_REVIEWER_ID,
            )

    async def test_actions_reject_non_needs_review_scored(self, db_session: AsyncSession) -> None:
        """AC-7: all four actions on a SCORED proposal raise IllegalProposalTransition."""
        svc_cls = _get_service_class()
        proposal = await self._make_scored_proposal(db_session)
        svc = svc_cls(db_session)

        # None of these must succeed — SCORED is not NEEDS_REVIEW.
        for action_coro in [
            svc.approve(proposal, deck_id=_FAKE_DECK_ID, reviewer_id=_FAKE_REVIEWER_ID),
            svc.edit(proposal, field_edits={}, reviewer_id=_FAKE_REVIEWER_ID),
            svc.regenerate(proposal, reviewer_id=_FAKE_REVIEWER_ID),
            svc.reject(proposal, rejection_reason="test", reviewer_id=_FAKE_REVIEWER_ID),
        ]:
            with pytest.raises(IllegalProposalTransition):
                await action_coro

    async def test_actions_do_not_mutate_status_on_guard_raise(
        self, db_session: AsyncSession
    ) -> None:
        """AC-7: when guard raises, proposal.status is UNCHANGED (no partial mutation)."""
        svc_cls = _get_service_class()
        proposal = await self._make_scored_proposal(db_session)
        original_status = proposal.status
        svc = svc_cls(db_session)

        with pytest.raises(IllegalProposalTransition):
            await svc.approve(proposal, deck_id=_FAKE_DECK_ID, reviewer_id=_FAKE_REVIEWER_ID)

        assert proposal.status == original_status, (
            f"status must not change when guard raises; "
            f"expected {original_status!r}, got {proposal.status!r}"
        )
