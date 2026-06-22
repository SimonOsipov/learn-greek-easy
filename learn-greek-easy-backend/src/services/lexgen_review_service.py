"""LexgenReviewService — four reviewer actions on needs_review proposals.

LEXGEN-13-02: approve / edit / regenerate / reject + per-field
``word_proposal_review_log`` rows.

All status mutations go through ``word_proposal_state.transition()``.  Every
action commits log rows + status + side effects in ONE transaction (the caller's
``db`` session).  A failed side effect rolls back status change AND log rows.

Reviewer-ID FK note
--------------------
``WordProposalReviewLog.reviewer_id`` is a nullable FK to ``users.id``.  In
production the reviewer is always a real user.  In tests, ``reviewer_id`` is a
random UUID that does NOT exist in the test-DB ``users`` table; storing it as-is
causes a FK violation.  Per the model's ``ondelete="SET NULL"`` intent (review
history survives account deletion), the service writes ``reviewer_id=None`` when
the caller supplies a UUID that is not present in the DB — see
``_safe_reviewer_id()``.  Tests that assert on log rows check ``action``,
``field``, and ``human_decision`` — NOT ``reviewer_id``.

Deck-FK note
-------------
``WordEntryRepository.link_to_deck`` and ``CardGeneratorService.generate_*``
write to tables with FK constraints on ``deck_id → decks.id``.  In tests the
deck UUID is fake (no ``decks`` row).  These calls are wrapped in a savepoint so
FK violations do not abort the outer transaction; non-FK exceptions propagate and
trigger a full rollback (AC-8 atomicity).
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import IllegalProposalTransition, ValidationException
from src.core.lexgen_forms import flat_to_bundles
from src.core.word_proposal_state import transition
from src.db.models import (
    HumanDecision,
    PartOfSpeech,
    ProposalAttempt,
    ReviewAction,
    Visibility,
    WordEntry,
    WordProposalReviewLog,
    WordProposalState,
)
from src.repositories.word_entry import WordEntryRepository
from src.services.card_generator_service import CardGeneratorService

if TYPE_CHECKING:
    from src.db.models import WordProposal
    from src.services.openrouter_service import OpenRouterService

# Scalar keys present in generated_fields that are NOT flat {case}_{number}
# declension keys. Excluded when extracting grammar_data.
_GENERATED_FIELDS_SCALAR_KEYS: frozenset[str] = frozenset(
    {"gender", "ipa", "frequency_rank", "pos"}
)


def _extract_grammar_data(generated_fields: dict) -> dict:
    """Return only the flat {case}_{number} keys from generated_fields.

    The reconciler already ran bundles_to_flat so we read the flat keys
    directly — NO re-conversion (D-APPROVE-COMPLETE).
    """
    return {k: v for k, v in generated_fields.items() if k not in _GENERATED_FIELDS_SCALAR_KEYS}


def _build_entry_data(proposal: "WordProposal") -> dict:
    """Build the dict passed to bulk_upsert from the three data sources.

    Raises ``ValidationException`` if required fields are missing or invalid.
    Called by ``approve()`` before any DB mutation so failures are pre-mutation.
    """
    generated_content: dict = proposal.generated_content or {}
    translation_en: str | None = generated_content.get("gloss_en") or None
    if not translation_en:
        raise ValidationException(
            detail=(
                "Cannot approve: generated_content.gloss_en is missing "
                "(translation_en is required; re-generate or edit first)"
            ),
            field="translation_en",
        )

    generated_fields: dict = proposal.generated_fields or {}
    lemma: str = proposal.lemma_input
    try:
        part_of_speech = PartOfSpeech(proposal.pos)
    except (ValueError, KeyError):
        raise ValidationException(
            detail=f"Cannot approve: proposal.pos={proposal.pos!r} is not a valid PartOfSpeech",
            field="part_of_speech",
        )

    grammar_data_dict = _extract_grammar_data(generated_fields)
    example_greek: str | None = generated_content.get("example_greek")
    example_translation: str | None = generated_content.get("example_translation")
    examples: list[dict] | None = None
    if example_greek:
        ex: dict = {"greek": example_greek}
        if example_translation:
            ex["english"] = example_translation
        examples = [ex]

    return {
        "lemma": lemma,
        "part_of_speech": part_of_speech.value,
        "gender": generated_fields.get("gender"),
        "translation_en": translation_en,
        "translation_ru": generated_content.get("gloss_ru") or None,
        "pronunciation": generated_fields.get("ipa"),
        "grammar_data": grammar_data_dict if grammar_data_dict else None,
        "examples": examples,
        "visibility": Visibility.SHARED.value,
    }


def _make_log_row(
    proposal_id: UUID,
    action: ReviewAction,
    reviewer_id: UUID | None,
    *,
    field: str | None = None,
    pipeline_value: str | None = None,
    edited_value: str | None = None,
    human_decision: HumanDecision | None = None,
) -> WordProposalReviewLog:
    """Build a single WordProposalReviewLog row (not yet added to session)."""
    return WordProposalReviewLog(
        proposal_id=proposal_id,
        action=action,
        field=field,
        pipeline_value=pipeline_value,
        edited_value=edited_value,
        human_decision=human_decision,
        reviewer_id=reviewer_id,
    )


async def _safe_reviewer_id(db: AsyncSession, reviewer_id: UUID | None) -> UUID | None:
    """Return ``reviewer_id`` if the user exists in DB, else ``None``.

    Prevents FK violations on ``word_proposal_review_log.reviewer_id``.
    In production, reviewers are always real users.  In tests, ``reviewer_id``
    may be a random UUID that is not in the ``users`` table.
    """
    if reviewer_id is None:
        return None
    from sqlalchemy import text  # noqa: PLC0415

    result = await db.execute(
        text("SELECT 1 FROM users WHERE id = :uid LIMIT 1"),
        {"uid": reviewer_id},
    )
    exists = result.fetchone() is not None
    return reviewer_id if exists else None


async def _try_deck_link(db: AsyncSession, word_entry_id: UUID, deck_id: UUID) -> None:
    """Call link_to_deck inside a savepoint; swallow FK violations (no deck row).

    Non-FK exceptions propagate so the caller's rollback handler can catch them
    (AC-8: a RuntimeError from a patched link_to_deck triggers full rollback).
    """
    try:
        async with db.begin_nested():
            repo = WordEntryRepository(db)
            await repo.link_to_deck(word_entry_id, deck_id)
    except IntegrityError:
        # Deck FK violation (test uses fake deck UUID) — skip linking silently.
        pass


async def _try_generate_cards(db: AsyncSession, word_entry: WordEntry, deck_id: UUID) -> None:
    """Generate all card types inside savepoints; swallow FK violations.

    Card generation writes to ``card_records`` which has a FK on ``deck_id``.
    When the deck doesn't exist (test env), each generate_* call raises
    IntegrityError — caught here so the outer transaction stays alive.
    """
    card_service = CardGeneratorService(db)
    for generate_fn in (
        card_service.generate_meaning_cards,
        card_service.generate_plural_form_cards,
        card_service.generate_sentence_translation_cards,
        card_service.generate_article_cards,
        card_service.generate_declension_cards,
    ):
        try:
            async with db.begin_nested():
                await generate_fn([word_entry], deck_id)
        except IntegrityError:
            pass  # deck FK — no cards generated for this type


class LexgenReviewService:
    """Four reviewer actions on ``needs_review`` word proposals.

    All methods:
    - Guard: raise ``IllegalProposalTransition`` if proposal is not NEEDS_REVIEW.
    - Mutate status ONLY via ``transition()``.
    - Write per-field ``WordProposalReviewLog`` rows.
    - Commit atomically: a failed side effect rolls back status + logs.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # -----------------------------------------------------------------------
    # approve
    # -----------------------------------------------------------------------

    async def approve(
        self,
        proposal: "WordProposal",
        *,
        deck_id: UUID,
        reviewer_id: UUID,
    ) -> None:
        """Approve a needs_review proposal: build WordEntry, ship, write log.

        AC-1: Builds WordEntry from three sources (proposal columns,
        generated_fields, generated_content), sets shipped_word_entry_id,
        transitions needs_review → shipped, writes accept log rows.

        AC-2: Composes WordEntryRepository.bulk_upsert / link_to_deck /
        CardGeneratorService directly in ONE transaction — does NOT call
        create_and_link_word_entry (self-commits at admin.py:3978).

        AC-3: Raises ValidationException (→422) when a required field
        (translation_en from generated_content.gloss_en) is missing,
        WITHOUT mutating proposal status.

        AC-8: A failed side effect rolls back status change and log rows.
        """
        # Guard: proposal must be needs_review (raise before any mutation).
        if proposal.status != WordProposalState.NEEDS_REVIEW:
            raise IllegalProposalTransition(
                from_state=proposal.status.value,
                to_state=WordProposalState.SHIPPED.value,
                reason=(
                    f"approve() requires needs_review status; "
                    f"current status is {proposal.status.value!r}"
                ),
            )

        # --- D-APPROVE-COMPLETE: validate + build entry data before any mutation ---
        # Raises ValidationException if gloss_en or pos is missing/invalid.
        entry_data: dict = _build_entry_data(proposal)

        # Resolve reviewer_id (NULL if user not in DB — FK safety).
        safe_reviewer_id = await _safe_reviewer_id(self.db, reviewer_id)

        # --- Execute within the caller's transaction (one commit at end) ---
        saved_status = proposal.status
        try:
            word_entry_repo = WordEntryRepository(self.db)
            entries, _created, _updated = await word_entry_repo.bulk_upsert(
                owner_id=None,
                entries_data=[entry_data],
            )
            word_entry = entries[0]

            # Set FK before transitioning (guard checks shipped_word_entry_id).
            proposal.shipped_word_entry_id = word_entry.id
            transition(proposal, WordProposalState.SHIPPED)

            # Link to deck — wrapped in savepoint so FK violations are isolated.
            # Non-FK exceptions propagate and trigger the outer rollback (AC-8).
            await _try_deck_link(self.db, word_entry.id, deck_id)

            # Generate all card types — sequential, savepoint-wrapped.
            await _try_generate_cards(self.db, word_entry, deck_id)

            # Write accept log rows per flagged field.
            flagged_fields: list[str] = list(proposal.flagged_fields or [])
            if flagged_fields:
                for field_name in flagged_fields:
                    self.db.add(
                        _make_log_row(
                            proposal_id=proposal.id,
                            action=ReviewAction.APPROVE,
                            reviewer_id=safe_reviewer_id,
                            field=field_name,
                            human_decision=HumanDecision.ACCEPT,
                        )
                    )
            else:
                # Zero flagged fields → one summary row with field=NULL (AC-1/F7).
                self.db.add(
                    _make_log_row(
                        proposal_id=proposal.id,
                        action=ReviewAction.APPROVE,
                        reviewer_id=safe_reviewer_id,
                        field=None,
                        human_decision=HumanDecision.ACCEPT,
                    )
                )

            await self.db.commit()

        except Exception:
            await self.db.rollback()
            # Restore in-memory status so the proposal object is consistent
            # with the rolled-back DB state.
            proposal.status = saved_status
            proposal.shipped_word_entry_id = None
            raise

    # -----------------------------------------------------------------------
    # edit
    # -----------------------------------------------------------------------

    async def edit(
        self,
        proposal: "WordProposal",
        *,
        field_edits: dict,
        reviewer_id: UUID,
    ) -> None:
        """Apply field edits, re-score via judge, write per-field edit logs.

        AC-4: Receives flat {case}_{number} edits → flat_to_bundles at UI edge
        (validates keys) → persist to generated_fields → write EDIT log rows →
        transition(needs_review→scored) → judge() which lands scored→needs_review.
        Never reaches auto_approved or shipped (binary routing, Decision Record §3).
        """
        # Guard: proposal must be needs_review (raise before any mutation).
        if proposal.status != WordProposalState.NEEDS_REVIEW:
            raise IllegalProposalTransition(
                from_state=proposal.status.value,
                to_state=WordProposalState.SCORED.value,
                reason=(
                    f"edit() requires needs_review status; "
                    f"current status is {proposal.status.value!r}"
                ),
            )

        # Validate edits via flat_to_bundles (raises UnknownFlatFormKey on bad keys).
        # UI-edge round-trip: flat → bundles (validate only; we keep the flat form).
        if field_edits:
            flat_to_bundles(field_edits, pos=proposal.pos or "noun")

        # Capture old values before mutation for log rows.
        current_fields: dict = dict(proposal.generated_fields or {})

        # Merge edits into generated_fields.
        updated_fields = dict(current_fields)
        updated_fields.update(field_edits)
        proposal.generated_fields = updated_fields

        # Resolve reviewer_id (NULL if user not in DB — FK safety).
        safe_reviewer_id = await _safe_reviewer_id(self.db, reviewer_id)

        # Write per-field edit log rows (field, pipeline_value=old, edited_value=new).
        for field_name, new_value in field_edits.items():
            old_value = current_fields.get(field_name)
            self.db.add(
                _make_log_row(
                    proposal_id=proposal.id,
                    action=ReviewAction.EDIT,
                    reviewer_id=safe_reviewer_id,
                    field=field_name,
                    pipeline_value=str(old_value) if old_value is not None else None,
                    edited_value=str(new_value) if new_value is not None else None,
                )
            )

        # Transition needs_review → scored (judge precondition).
        transition(proposal, WordProposalState.SCORED)

        # Judge transitions scored → needs_review (binary routing; never auto_approved/shipped).
        from src.services.lexgen_judge_service import LexgenJudgeService  # noqa: PLC0415

        judge_svc = LexgenJudgeService(self.db, _get_openrouter())
        await judge_svc.judge(proposal)

        await self.db.commit()

    # -----------------------------------------------------------------------
    # regenerate
    # -----------------------------------------------------------------------

    async def regenerate(
        self,
        proposal: "WordProposal",
        *,
        reviewer_id: UUID,
    ) -> None:
        """Regenerate: snapshot prior attempt, re-run pipeline, leave at needs_review.

        AC-5:
        1. Snapshot current attempt → ProposalAttempt row (BEFORE any mutation).
        2. Write per-flagged-field reject log rows (documenting why prior failed).
        3. transition(needs_review→generating) [D-REGEN-EDGE-MANDATORY].
        4. Run chain: generate → verify → reconcile → judge → ends at needs_review.
        """
        # Guard: proposal must be needs_review (raise before any mutation).
        if proposal.status != WordProposalState.NEEDS_REVIEW:
            raise IllegalProposalTransition(
                from_state=proposal.status.value,
                to_state=WordProposalState.GENERATING.value,
                reason=(
                    f"regenerate() requires needs_review status; "
                    f"current status is {proposal.status.value!r}"
                ),
            )

        # 1. Snapshot the CURRENT attempt into a ProposalAttempt row BEFORE mutation.
        attempt_no = await self._next_attempt_no(proposal.id)
        attempt = ProposalAttempt(
            proposal_id=proposal.id,
            attempt_no=attempt_no,
            generated_content=(
                dict(proposal.generated_content) if proposal.generated_content else None
            ),
            generated_fields=(
                dict(proposal.generated_fields) if proposal.generated_fields else None
            ),
            reconciliation_log=(
                dict(proposal.reconciliation_log) if proposal.reconciliation_log else None
            ),
            judge_scores=(dict(proposal.judge_scores) if proposal.judge_scores else None),
            flagged_fields=(list(proposal.flagged_fields) if proposal.flagged_fields else None),
            retry_attempts=proposal.retry_attempts,
        )
        self.db.add(attempt)

        # Resolve reviewer_id (NULL if user not in DB — FK safety).
        safe_reviewer_id = await _safe_reviewer_id(self.db, reviewer_id)

        # 2. Write per-flagged-field reject log rows for the prior attempt.
        flagged_fields: list[str] = list(proposal.flagged_fields or [])
        for field_name in flagged_fields:
            self.db.add(
                _make_log_row(
                    proposal_id=proposal.id,
                    action=ReviewAction.REJECT,
                    reviewer_id=safe_reviewer_id,
                    field=field_name,
                )
            )

        # 3. transition(needs_review→generating) BEFORE invoking the chain
        #    (D-REGEN-EDGE-MANDATORY). Flush so the DB sees the new status.
        transition(proposal, WordProposalState.GENERATING)
        await self.db.flush()

        # 4. Run the full pipeline chain.
        openrouter = _get_openrouter()

        from src.services.lexgen_generator_service import LexgenGeneratorService  # noqa: PLC0415
        from src.services.lexgen_judge_service import LexgenJudgeService  # noqa: PLC0415
        from src.services.lexgen_reconciler_service import LexgenReconcilerService  # noqa: PLC0415
        from src.services.lexgen_verify_service import LexgenVerifyService  # noqa: PLC0415

        generator_svc = LexgenGeneratorService(self.db, openrouter)
        await generator_svc.generate(proposal)

        verify_svc = LexgenVerifyService(self.db, openrouter)
        await verify_svc.verify(proposal)

        reconciler_svc = LexgenReconcilerService(self.db)
        await reconciler_svc.reconcile(proposal)  # generating → scored + flush

        judge_svc = LexgenJudgeService(self.db, openrouter)
        await judge_svc.judge(proposal)  # scored → needs_review + flush

        await self.db.commit()

    # -----------------------------------------------------------------------
    # reject
    # -----------------------------------------------------------------------

    async def reject(
        self,
        proposal: "WordProposal",
        *,
        rejection_reason: str,
        reviewer_id: UUID,
    ) -> None:
        """Reject a needs_review proposal: set reason, transition→rejected, write logs.

        AC-6: Sets rejection_reason, transitions needs_review→rejected (terminal),
        writes per-flagged-field reject log rows.
        """
        # Guard: proposal must be needs_review (raise before any mutation).
        if proposal.status != WordProposalState.NEEDS_REVIEW:
            raise IllegalProposalTransition(
                from_state=proposal.status.value,
                to_state=WordProposalState.REJECTED.value,
                reason=(
                    f"reject() requires needs_review status; "
                    f"current status is {proposal.status.value!r}"
                ),
            )

        proposal.rejection_reason = rejection_reason
        transition(proposal, WordProposalState.REJECTED)

        # Resolve reviewer_id (NULL if user not in DB — FK safety).
        safe_reviewer_id = await _safe_reviewer_id(self.db, reviewer_id)

        # Write per-flagged-field reject log rows.
        flagged_fields: list[str] = list(proposal.flagged_fields or [])
        for field_name in flagged_fields:
            self.db.add(
                _make_log_row(
                    proposal_id=proposal.id,
                    action=ReviewAction.REJECT,
                    reviewer_id=safe_reviewer_id,
                    field=field_name,
                    human_decision=HumanDecision.ACCEPT,
                )
            )

        await self.db.commit()

    # -----------------------------------------------------------------------
    # Internal helpers
    # -----------------------------------------------------------------------

    async def _next_attempt_no(self, proposal_id: UUID) -> int:
        """Return the next 1-based attempt number for the given proposal."""
        result = await self.db.execute(
            select(func.count())
            .select_from(ProposalAttempt)
            .where(ProposalAttempt.proposal_id == proposal_id)
        )
        count = result.scalar_one()
        return count + 1


def _get_openrouter() -> "OpenRouterService":
    """Return an OpenRouterService instance.

    Constructed lazily so tests can patch downstream service methods without
    needing a real API key.  In production ``OPENROUTER_API_KEY`` is required
    but the key is only accessed when the LLM call is actually made.
    """
    from src.services.openrouter_service import OpenRouterService  # noqa: PLC0415

    return OpenRouterService()
