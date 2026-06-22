"""LEXGEN-08-03 — Field-level reconciler service.

The reconciler is the ONLY LEXGEN-08 module that touches a DB session / mutates
a ``WordProposal``. It rebuilds the ``EvidencePacket`` from
``proposal.evidence_packet`` JSONB (the exact inverse of LEXGEN-06's
``packet.model_dump(mode="json")`` snapshot — F7/D15: NEVER re-query Wiktionary /
Lexicon / Frequency), runs the per-POS resolver, and persists three JSONB
columns plus a single state edge:

1. ``reconciliation_log`` — schema ``lexgen.reconciliation.v1`` (D4): the chosen
   value + provenance + cross-checks per field, gloss/example listed under
   ``gaps`` (incl. ``gloss_en`` even when the packet carries it — F9/D14, since
   LEXGEN-09 is the sole gloss owner).
2. ``flagged_fields`` — copied DIRECTLY from the resolver (D19, BINDING): the
   already-narrow disagreement/unresolved subset. Audit flags (``rule_ambiguous``,
   ``ipa_unvalidated``, ``lexicon_gender_inconsistent``) live ONLY inside the
   per-field log entries' ``flags[]`` and never enter ``flagged_fields``.
3. ``generated_fields`` — the resolved morphological field values + the chosen
   declension forms flattened to UI-edge flat keys (D10). Gloss/RU/example are
   absent here (D11/D14) and recorded as gaps instead.

State: the proposal advances EXACTLY ``generating → scored`` through the
LEXGEN-01 :func:`transition` guard — never numerically routing to
auto_approved/needs_review/rejected, with ``trust_score`` staying ``None``.

Decision Record §3: ``confidence`` / ``trust_score`` is inert / logged-only —
NO numeric arithmetic in this service affects routing or any branch. The
``confidence`` field is always written as ``null`` in v1 (present-but-null so a
later calibration pass can backfill it; nothing reads it today). The
scored → {needs_review | rejected | auto_approved} routing fan-out belongs to
LEXGEN-11, not here.

This module imports NO LLM/chat-model/generator: reconciliation is purely
deterministic over the already-assembled evidence.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import UnknownFlatFormKey
from src.core.lexgen_forms import bundles_to_flat
from src.core.lexgen_resolver import resolver_for
from src.core.word_proposal_state import transition
from src.db.models import WordProposal, WordProposalState
from src.schemas.lexgen import EvidencePacket, FormBundle, ResolvedParadigm

# v1 reconciliation-log schema marker (D4).
RECONCILIATION_SCHEMA_VERSION = "lexgen.reconciliation.v1"

# Content fields LEXGEN-08 NEVER writes — recorded under reconciliation_log.gaps
# (F9/D14). LEXGEN-09 is the sole gloss/example owner.
GAP_FIELDS: list[str] = ["gloss_en", "gloss_ru", "example"]

# Morphological scalar fields written into generated_fields (the resolved value
# per field, when non-null). ``declension_forms`` is intentionally EXCLUDED — its
# resolver value is only a count witness; the real forms are flattened separately.
_GENERATED_SCALAR_FIELDS: frozenset[str] = frozenset(
    {"gender", "declension_group", "ipa", "frequency_rank", "pos", "lemma_exists"}
)


class LexgenReconcilerService:
    """Field-level reconciler for the LEXGEN word-proposal pipeline.

    Constructor:
        db: AsyncSession — injected per-request SQLAlchemy async session
            (mirrors :class:`EvidenceAssemblyService`).

    Usage::

        service = LexgenReconcilerService(db)
        await service.reconcile(proposal)  # proposal must be in GENERATING
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def reconcile(self, proposal: WordProposal) -> None:
        """Reconcile a GENERATING proposal: write the three JSONB cols + score it.

        Steps (see module docstring):
            1. Rebuild the packet from JSONB via ``EvidencePacket.model_validate``
               (no re-query — F7/D15).
            2. Look up the per-POS resolver; ``None`` → unsupported-POS branch.
            3. Resolve the paradigm.
            4. Write reconciliation_log (v1 shape), flagged_fields (D19 direct
               copy), and generated_fields (scalars + flat forms).
            5. Advance GENERATING → SCORED through the guard, then flush ONCE.

        The status guard is NOT pre-checked: ``transition()`` raises
        :class:`IllegalProposalTransition` on a non-generating proposal — that
        propagates (it is never swallowed).
        """
        packet = EvidencePacket.model_validate(proposal.evidence_packet)

        resolver = resolver_for(proposal.pos)
        if resolver is None:
            await self._reconcile_unsupported_pos(proposal, packet)
            return

        paradigm = resolver.resolve(packet.normalized_lemma, packet)

        proposal.reconciliation_log = self._build_reconciliation_log(packet, paradigm)
        # D19 (BINDING): copy the resolver's already-narrow flagged set directly
        # (fields carrying disagreement:* / unresolved:* flags only). Do NOT
        # recompute from "any flag" — audit flags stay in the per-field log only.
        proposal.flagged_fields = list(paradigm.flagged_fields)
        proposal.generated_fields = self._build_generated_fields(packet, paradigm)

        # Decision Record §3: state-driven advance only — confidence/trust_score
        # are inert (logged-only, no numeric routing here). Routing fan-out to
        # auto_approved/needs_review/rejected is LEXGEN-11, never this service.
        transition(proposal, WordProposalState.SCORED)
        await self.db.flush()

    # ------------------------------------------------------------------
    # Private builders
    # ------------------------------------------------------------------

    async def _reconcile_unsupported_pos(
        self, proposal: WordProposal, packet: EvidencePacket
    ) -> None:
        """Unsupported-POS branch (D7): flag, log an error marker, still score.

        Sets ``flagged_fields=['unsupported_pos']``, writes a v1 log carrying an
        ``error`` marker (no resolver ran, so ``fields`` is empty), advances to
        SCORED, and flushes — never raises.
        """
        proposal.flagged_fields = ["unsupported_pos"]
        proposal.reconciliation_log = {
            "schema_version": RECONCILIATION_SCHEMA_VERSION,
            "pos": proposal.pos,
            "lemma": packet.normalized_lemma,
            "fields": {},
            "gaps": list(GAP_FIELDS),
            "error": "unsupported_pos",
        }
        proposal.generated_fields = {}

        # Decision Record §3: state-driven advance only (see reconcile()).
        transition(proposal, WordProposalState.SCORED)
        await self.db.flush()

    def _build_reconciliation_log(self, packet: EvidencePacket, paradigm: ResolvedParadigm) -> dict:
        """Build the v1 reconciliation_log dict from the resolved paradigm.

        Top-level keys: ``schema_version``, ``pos``, ``lemma``, ``fields``,
        ``gaps``. Each field entry carries ``value`` / ``source`` /
        ``confidence`` (ALWAYS null in v1) / ``flags`` (the resolver's FULL flag
        list, incl. audit flags, for the calibration dataset) / ``cross_checks``.
        Each cross-check precomputes ``agree`` (== the primary value) so the
        reviewer UI never has to recompute it.
        """
        fields: dict[str, dict] = {}
        for resolved in paradigm.fields:
            primary_value = resolved.value
            cross_checks = [
                {
                    "source": ev.source,
                    "value": ev.value,
                    "agree": ev.value == primary_value,
                    "confidence": None,
                    "flags": list(ev.flags),
                }
                for ev in paradigm.cross_checks.get(resolved.field, [])
            ]
            fields[resolved.field] = {
                "value": primary_value,
                "source": resolved.source,
                "confidence": None,  # ALWAYS null in v1 (DR §3)
                "flags": list(resolved.flags),
                "cross_checks": cross_checks,
            }

        return {
            "schema_version": RECONCILIATION_SCHEMA_VERSION,
            "pos": paradigm.pos,
            "lemma": paradigm.lemma,
            "fields": fields,
            "gaps": list(GAP_FIELDS),
        }

    def _build_generated_fields(self, packet: EvidencePacket, paradigm: ResolvedParadigm) -> dict:
        """Build generated_fields: resolved scalar values + flat declension forms.

        Scalars (gender/declension_group/ipa/frequency_rank/pos/lemma_exists) are
        taken from the resolved field values when non-null. The chosen declension
        forms are flattened to UI-edge flat keys via
        :func:`lexgen_forms.bundles_to_flat`. Gloss/RU/example are NEVER written
        here (D11/D14) — they are recorded under reconciliation_log.gaps.
        """
        generated: dict[str, str] = {}
        for resolved in paradigm.fields:
            if resolved.field in _GENERATED_SCALAR_FIELDS and resolved.value is not None:
                generated[resolved.field] = resolved.value

        for flat_key, form in self._flatten_chosen_forms(packet).items():
            generated[flat_key] = form

        return generated

    @staticmethod
    def _flatten_chosen_forms(packet: EvidencePacket) -> dict[str, str]:
        """Flatten the chosen declension forms to ``{case}_{number}`` flat keys.

        Source precedence mirrors the resolver's ``declension_forms`` chain rank:
        lexicon forms (rank 1) win when present, else wiktionary forms (rank 2).
        ``bundles_to_flat`` is STRICT and all-or-nothing — when the chosen forms
        cannot be flattened (e.g. a bundle lacks case/number, as in a
        gender-only lexicon witness), no form keys are emitted (the converter
        contract is respected; partial paradigms are never invented).
        """
        forms: list[FormBundle] = (
            packet.sources.greek_lexicon.forms or packet.sources.wiktionary.forms
        )
        if not forms:
            return {}
        try:
            return bundles_to_flat(forms)
        except UnknownFlatFormKey:
            return {}
