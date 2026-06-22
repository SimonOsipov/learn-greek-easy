"""LEXGEN-09-02 — RAG generator service (LLM content author).

This service is the ONLY component that calls the LLM in the LEXGEN pipeline.
Its sole job is to author the four content fields that cannot come from
deterministic sources:

    gloss_en            — selected verbatim from Wiktionary candidate glosses
    gloss_ru            — generated (no Russian in Wiktionary importer)
    example_greek       — example sentence using the closed-vocab lemma set
    example_translation — English translation of the example sentence

Cardinal invariant (Decision Record §1 — ENFORCED STRUCTURALLY):
    The LLM NEVER produces a Greek morphological form. This is enforced by
    ``GeneratedLexContent.model_config = ConfigDict(extra="forbid")``: any
    response containing gender / ipa / declension / case form or ANY other
    morphological key is rejected (ValidationError) and triggers a retry,
    not persistence. The generator never assigns ``proposal.generated_fields``,
    ``reconciliation_log``, ``flagged_fields``, ``judge_scores``, or
    ``trust_score`` — those belong to the LEXGEN-08 reconciler.
"""

from __future__ import annotations

import json

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.lexgen_resolver import resolver_for
from src.core.logging import get_logger
from src.core.word_proposal_state import transition
from src.db.models import WordProposal, WordProposalState
from src.schemas.lexgen import EvidencePacket, GeneratedLexContent, ResolvedParadigm
from src.services.cefr_vocabulary_service import CefrVocabularyService
from src.services.openrouter_service import OpenRouterService, get_openrouter_service

logger = get_logger(__name__)

_MAX_ATTEMPTS = 3

_SYSTEM_PROMPT = """You are a Greek lexicography assistant. Your ONLY task is to supply
four content fields for a Greek lemma based on the supplied evidence.

HARD RULES — violating ANY of them will cause your response to be rejected and retried:

1. Draw ONLY from the supplied evidence below. Do not invent new facts.
2. NEVER produce, guess, or include a Greek morphological form (no gender values,
   no IPA, no declension group, no inflected case/number forms). If you include
   ANY extra key in your JSON the response will be rejected.
3. For gloss_en: choose VERBATIM from the Wiktionary candidate glosses provided
   (semicolon-separated). If no candidates are provided, use the closest available
   meaning from other evidence and it will be reviewed downstream.
4. For example_greek / example_translation: the example sentence MUST use ONLY
   lemmas from the allowed vocabulary list supplied in the user message.

Your response MUST be a JSON object with EXACTLY these four keys and no others:
{
  "gloss_en": "<selected English gloss>",
  "gloss_ru": "<Russian gloss>",
  "example_greek": "<example sentence in Modern Greek>",
  "example_translation": "<English translation of the example>"
}"""


def _build_messages(
    packet: EvidencePacket,
    resolved: ResolvedParadigm | None,
    allowed_lemmas: set[str],
    *,
    prior_error: str | None = None,
) -> list[dict[str, str]]:
    """Construct the system + user messages for the OpenRouter call.

    ``resolved`` carries the morphological fields already determined by the
    resolver (read-only context — the LLM is explicitly told not to touch them).
    ``allowed_lemmas`` is the closed vocabulary the example sentence must draw from.
    ``prior_error`` is echoed into the user message on retry attempts (D5).
    """
    # Build evidence summary for the user message.
    lines: list[str] = [
        f"Lemma: {packet.normalized_lemma}",
        f"POS: {packet.pos}",
    ]

    # Include resolver-determined morphological facts as read-only context.
    if resolved is not None:
        resolved_map = {rf.field: rf.value for rf in resolved.fields if rf.value is not None}
        if resolved_map:
            lines.append("\nMorphological facts (DO NOT reproduce these in your response):")
            for field, value in sorted(resolved_map.items()):
                lines.append(f"  {field}: {value}")

    # Wiktionary gloss candidates.
    wikt = packet.sources.wiktionary
    if wikt.present and wikt.glosses_en:
        candidates = wikt.glosses_en.split("; ")
        lines.append(
            f"\nWiktionary gloss candidates (choose gloss_en VERBATIM from these): "
            f"{'; '.join(candidates)}"
        )
    else:
        lines.append(
            "\nNo Wiktionary gloss candidates available — choose the closest meaning "
            "from other evidence; it will be reviewed downstream."
        )

    # Frequency context.
    freq = packet.sources.frequency
    if freq.present and freq.band:
        lines.append(f"\nFrequency band: {freq.band} (rank {freq.rank})")

    # Allowed vocabulary for the example sentence.
    vocab_list = ", ".join(sorted(allowed_lemmas)) if allowed_lemmas else packet.normalized_lemma
    lines.append(f"\nAllowed vocabulary for example sentence (use ONLY these lemmas): {vocab_list}")

    # Echo prior validation error on retries (D5).
    if prior_error is not None:
        lines.append(
            f"\n\nPREVIOUS ATTEMPT FAILED — your last response was rejected with this error:\n"
            f"  {prior_error}\n"
            "Please correct the problem and return valid JSON with exactly the four required keys."
        )

    user_content = "\n".join(lines)

    return [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]


class LexgenGeneratorService:
    """RAG generator: authors the four LLM-only content fields for a WordProposal.

    Per-request (NOT a singleton): instantiated with an injected ``db`` session
    and ``openrouter`` service, mirroring ``LexgenReconcilerService``.

    The generator NEVER writes morphological fields (generated_fields /
    reconciliation_log / flagged_fields / judge_scores / trust_score). It also
    does NOT advance the proposal state — the proposal stays GENERATING on success
    so the next pipeline stage (reconciler) can pick it up. On 3 failures the
    proposal transitions to REJECTED via the state-machine guard.
    """

    def __init__(self, db: AsyncSession, openrouter: OpenRouterService) -> None:
        self.db = db
        self.openrouter = openrouter

    async def _assemble_allowed_lemmas(
        self,
        packet: EvidencePacket,
        resolved: ResolvedParadigm | None,  # noqa: ARG002 — reserved for future use
    ) -> set[str]:
        """Return the closed vocabulary set for the example sentence (LEXGEN-09-03).

        Assembles the allowed-lemma set as:
            (await CefrVocabularyService(self.db).allowed_lemmas())
            | {packet.normalized_lemma}

        The target lemma is always included even if absent from reference.cefr_lemma.
        Target level is hardcoded to B1 (TARGET_LEVEL_DEFAULT — D11/F2; no per-lemma lookup).
        This is a PROMPT INPUT helper only — no enforcement/rejection (that is LEXGEN-10).
        """
        cefr = CefrVocabularyService(self.db)
        allowed = await cefr.allowed_lemmas()  # hardcoded B1 default (D11/F2)
        allowed.add(packet.normalized_lemma)
        return allowed

    async def generate(self, proposal: WordProposal) -> None:
        """Author the four content fields via the OpenRouter LLM (up to 3 attempts).

        On success: writes ``proposal.generated_content`` and
        ``proposal.retry_attempts``; proposal stays GENERATING; flushes to DB.

        On 3 consecutive failures: sets ``proposal.retry_attempts = 3``,
        ``proposal.rejection_reason``, calls ``transition(proposal, REJECTED)``,
        and flushes. ``IllegalProposalTransition`` is NOT caught — it propagates
        to the caller (AC #8: the guard surfaces, not swallows).

        NEVER assigns: generated_fields, reconciliation_log, flagged_fields,
        judge_scores, trust_score (cardinal invariant — those belong to LEXGEN-08).
        """
        # Stage 1 — rebuild evidence packet from the JSONB snapshot (never re-query).
        # Guard: evidence_packet may be absent for test-seeded proposals. Treat as a
        # hard validation failure so the retry loop exhausts and transitions to REJECTED
        # rather than crashing with a Pydantic ValidationError.
        if proposal.evidence_packet is None:
            transition(proposal, WordProposalState.REJECTED)
            proposal.retry_attempts = _MAX_ATTEMPTS
            proposal.rejection_reason = "evidence_packet_missing: cannot generate without evidence"
            await self.db.flush()
            return
        packet = EvidencePacket.model_validate(proposal.evidence_packet)

        # Stage 2 — run the resolver for READ-ONLY morphology context.
        # The resolved paradigm is passed to the prompt builder as fixed facts
        # the LLM must not reproduce. If the POS has no registered resolver
        # (e.g. verb, adjective), resolved is None and we proceed anyway —
        # the generator only authors gloss/example, not morphology.
        resolver = resolver_for(packet.pos)
        resolved: ResolvedParadigm | None = (
            resolver.resolve(packet.normalized_lemma, packet) if resolver is not None else None
        )

        # Stage 3 — assemble the closed-vocabulary set from CEFR reference (09-03).
        allowed_lemmas = await self._assemble_allowed_lemmas(packet, resolved)

        # Stage 4 — retry loop (max 3 attempts = 2 retries).
        attempts = 0
        last_error: str | None = None

        while attempts < _MAX_ATTEMPTS:
            attempts += 1
            messages = _build_messages(packet, resolved, allowed_lemmas, prior_error=last_error)
            resp = await self.openrouter.complete(
                messages=messages,
                response_format={"type": "json_object"},
            )
            try:
                content = GeneratedLexContent.model_validate(json.loads(resp.content))
            except (json.JSONDecodeError, ValidationError) as exc:
                last_error = str(exc)
                logger.warning(
                    "LexgenGeneratorService: attempt %d/%d invalid — %s",
                    attempts,
                    _MAX_ATTEMPTS,
                    last_error[:200],
                )
                continue

            # Success path — write content, never touch morphological fields.
            proposal.generated_content = content.model_dump()
            proposal.retry_attempts = attempts - 1  # 0 on first-try success
            await self.db.flush()
            return

        # All 3 attempts exhausted → hard reject.
        # transition() is the ONLY status mutation; IllegalProposalTransition
        # deliberately propagates (AC #8 — not wrapped in try/except).
        transition(proposal, WordProposalState.REJECTED)
        proposal.retry_attempts = attempts
        proposal.rejection_reason = f"generation_invalid_after_retries: {last_error}"
        await self.db.flush()


def get_lexgen_generator_service(db: AsyncSession) -> LexgenGeneratorService:
    """Factory: return a per-request LexgenGeneratorService with the singleton OpenRouter.

    Mirrors ``get_exercise_sm2_service(db)`` / ``cross_ai_verification_service``
    factory pattern (F6, D1).
    """
    return LexgenGeneratorService(db, get_openrouter_service())
