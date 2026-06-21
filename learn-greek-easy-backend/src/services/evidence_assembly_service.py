"""LEXGEN-06-02 — Stage 1 evidence assembly service.

Assembles an ``EvidencePacket`` for a given (lemma_input, pos) pair by
consulting three read-only sources in parallel-ish fashion:

1. Wiktionary morphology (``WiktionaryMorphologyService``).
2. GreekLexicon attestation (direct SQL on ``GreekLexicon`` ORM model).
3. Frequency rank (``FrequencyService``).

The ``rules`` slot is always the absent stub (D-RULESSTUB) in this story;
the rule-based resolver ships in a later LEXGEN story.

IMPORTANT: All three service constructors (``FrequencyService``,
``WiktionaryMorphologyService``) and the ``get_lemma_normalization_service``
factory are imported at MODULE LEVEL so that the patch paths used in unit
tests (``src.services.evidence_assembly_service.FrequencyService``, etc.)
resolve correctly.

Normalization contract (D-NORM):
    lower() → NFC → _final_sigma_unfold() → get_lemma_normalization_service().normalize(x).lemma

POS casing contract:
    - pos forwarded verbatim (lowercase) to WiktionaryMorphologyService.
    - pos.upper() forwarded to GreekLexicon existence query / LexiconService.

This module contains NO LLM/chat-model imports (Stage 1 is retrieval-only;
LEXGEN-09 is the generator).
"""

from __future__ import annotations

import unicodedata
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.word_proposal_state import transition
from src.db.models import GreekLexicon, WordProposal, WordProposalOrigin, WordProposalState
from src.schemas.lexgen import (
    FEATURE_KEYS,
    EvidencePacket,
    EvidencePacketSources,
    FormBundle,
    FrequencySource,
    GreekLexiconSource,
    RulesSource,
    WiktionarySource,
)
from src.services.frequency_service import FrequencyService
from src.services.lemma_normalization_service import get_lemma_normalization_service
from src.services.lexicon_service import LexiconService
from src.services.wiktionary_morphology_service import WiktionaryMorphologyService
from src.utils.greek_text import _final_sigma_unfold  # noqa: WPS450 (private import by design)

# ---------------------------------------------------------------------------
# GreekLexicon DB value → UD-canonical feature value maps (LEXGEN-02 table,
# reversed direction: DB abbreviation → feature dict value).
# ---------------------------------------------------------------------------

_PTOSI_MAP: dict[str, str] = {
    "Nom": "nominative",
    "Gen": "genitive",
    "Acc": "accusative",
    "Voc": "vocative",
}

_NUMBER_MAP: dict[str, str] = {
    "Sing": "singular",
    "Plur": "plural",
}

_GENDER_MAP: dict[str, str] = {
    "Masc": "masculine",
    "Fem": "feminine",
    "Neut": "neuter",
}

# Genders to probe for common-gender (multi-row) Wiktionary lookup.
_WIKTIONARY_GENDERS = ("masculine", "feminine", "neuter")


def _row_to_form_bundle(row: GreekLexicon) -> FormBundle | None:
    """Convert a GreekLexicon ORM row to a FormBundle.

    Only noun-applicable feature keys (case, number, gender) are emitted.
    ``person`` is a SmallInteger — not string-compatible — and is skipped here
    per the LEXGEN-02 caveat. Keys not in FEATURE_KEYS are silently omitted.
    Returns None if the resulting features dict is empty (no recognised values).
    """
    features: dict[str, str] = {}

    if row.ptosi and row.ptosi in _PTOSI_MAP:
        features["case"] = _PTOSI_MAP[row.ptosi]
    if row.number and row.number in _NUMBER_MAP:
        features["number"] = _NUMBER_MAP[row.number]
    if row.gender and row.gender in _GENDER_MAP:
        features["gender"] = _GENDER_MAP[row.gender]

    # Guard: only emit keys within FEATURE_KEYS (FormBundle validator enforces this).
    features = {k: v for k, v in features.items() if k in FEATURE_KEYS}

    if not features or not row.form:
        return None

    return FormBundle(form=row.form, features=features)


class EvidenceAssemblyService:
    """Read-only evidence assembler for Stage 1 of the LEXGEN word-proposal pipeline.

    Consults Wiktionary, GreekLexicon, and frequency sources, then returns an
    ``EvidencePacket`` that carries an auditable provenance snapshot.

    Constructor:
        db: AsyncSession — injected per-request SQLAlchemy async session.

    Usage::

        service = EvidenceAssemblyService(db)
        packet = await service.assemble_evidence("σπίτι", pos="noun")
        if EvidenceAssemblyService._lemma_exists(packet):
            ...
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def assemble(
        self,
        lemma_input: str,
        pos: str,
        origin: WordProposalOrigin,
        requested_by: UUID | None,
    ) -> WordProposal:
        """Create a WordProposal, assemble evidence, and drive the state machine.

        State transitions (origin-agnostic):
            • lemma present in any source  → pending → generating  (GENERATING)
            • lemma absent from all sources → pending → generating → rejected  (REJECTED)

        The evidence_packet is always snapshotted before any reject transition.
        The transition() guard is used for every status change (never raw .status=).

        Args:
            lemma_input: Raw lemma string.
            pos: Part-of-speech string (e.g. "noun").
            origin: WordProposalOrigin (ADMIN / USER_REQUEST / BATCH).
            requested_by: User FK or None (ADMIN/BATCH originating user).

        Returns:
            The persisted WordProposal (status=GENERATING or REJECTED).
        """
        proposal = WordProposal(
            status=WordProposalState.PENDING,
            lemma_input=lemma_input,
            pos=pos,
            origin=origin,
            requested_by=requested_by,
        )
        self.db.add(proposal)
        await self.db.flush()

        # Assemble evidence from all three read-only sources.
        packet = await self.assemble_evidence(lemma_input, pos)

        # Snapshot ALWAYS (before any reject transition).
        proposal.evidence_packet = packet.model_dump(mode="json")

        if self._lemma_exists(packet):
            # Lemma attested in at least one source → advance to GENERATING.
            transition(proposal, WordProposalState.GENERATING)
            await self.db.flush()
            return proposal

        # Never-invent: lemma absent from all references → GENERATING then REJECTED.
        transition(proposal, WordProposalState.GENERATING)
        transition(proposal, WordProposalState.REJECTED)
        proposal.rejection_reason = "never_invent: lemma absent from all references"
        await self.db.flush()
        return proposal

    async def assemble_evidence(self, lemma_input: str, pos: str) -> EvidencePacket:
        """Assemble evidence from all three read-only sources for a (lemma_input, pos) pair.

        Normalization pipeline (D-NORM):
            lower() → NFC → _final_sigma_unfold() → normalize().lemma

        Args:
            lemma_input: Raw lemma string (may be uppercase, have trailing space, etc.).
            pos: Part-of-speech string (lowercase, e.g. "noun"). Forwarded verbatim
                to Wiktionary; uppercased for GreekLexicon / LexiconService.

        Returns:
            EvidencePacket with all four per-source sub-models populated.
        """
        # --- Normalization (D-NORM) ---
        pre_normalized = _final_sigma_unfold(unicodedata.normalize("NFC", lemma_input.lower()))
        normalized_result = get_lemma_normalization_service().normalize(pre_normalized)
        normalized_lemma = normalized_result.lemma

        # --- Assemble each source (sequential; no external I/O concurrency needed) ---
        wiktionary_source = await self._assemble_wiktionary(normalized_lemma, pos)
        frequency_source = await self._assemble_frequency(normalized_lemma)
        greek_lexicon_source = await self._assemble_greek_lexicon(normalized_lemma, pos)

        return EvidencePacket(
            lemma_input=lemma_input,
            normalized_lemma=normalized_lemma,
            pos=pos,
            sources=EvidencePacketSources(
                wiktionary=wiktionary_source,
                greek_lexicon=greek_lexicon_source,
                frequency=frequency_source,
                rules=RulesSource(present=False),  # D-RULESSTUB
            ),
        )

    @staticmethod
    def _lemma_exists(packet: EvidencePacket) -> bool:
        """Return True iff at least one source attests the lemma.

        D-FREQONLY: frequency-alone is sufficient to declare existence.
        Checks: Wiktionary OR GreekLexicon OR Frequency.

        Args:
            packet: Assembled EvidencePacket (from :meth:`assemble_evidence`).

        Returns:
            True if any source has present=True, False if all three are absent.
        """
        return (
            packet.sources.wiktionary.present
            or packet.sources.greek_lexicon.present
            or packet.sources.frequency.present
        )

    # ------------------------------------------------------------------
    # Private per-source assembly helpers
    # ------------------------------------------------------------------

    async def _assemble_wiktionary(self, lemma: str, pos: str) -> WiktionarySource:
        """Assemble Wiktionary evidence for ``lemma`` (forwarding pos verbatim / lowercase).

        Single-gender lemma (exactly one row for the pos):
            - Try ``get_form_bundles(lemma, pos)`` first.
            - If that returns bundles → ``present=True``, populate gender/IPA/glosses from entry.
            - If None (multiple rows or absent) → fall through to per-gender probe.

        Multi-gender lemma (common-gender, e.g. σύζυγος):
            - Per-gender probe across masculine/feminine/neuter.
            - ANY hit → ``present=True``, ``gender=None``, ``genders=[per-gender dicts]``.

        Absent (no rows for pos):
            - ``present=False``, empty forms, all optional fields None.
        """
        wikt_service = WiktionaryMorphologyService(self.db)

        # First try: get_form_bundles resolves to a single unambiguous row.
        bundles = await wikt_service.get_form_bundles(lemma, pos)
        if bundles is not None:
            # Single-gender case — also fetch entry for metadata.
            entry = await wikt_service.get_entry(lemma, pos)
            return WiktionarySource(
                present=True,
                forms=bundles,
                gender=entry.gender if entry else None,
                pronunciation=entry.pronunciation if entry else None,
                glosses_en=entry.glosses_en if entry else None,
                genders=None,
            )

        # Fallback: per-gender probe (handles common-gender and truly absent).
        per_gender_hits: list[dict] = []
        for g in _WIKTIONARY_GENDERS:
            entry = await wikt_service.get_entry(lemma, pos, gender=g)
            if entry is None:
                continue
            gender_bundles = await wikt_service.get_form_bundles(lemma, pos, gender=g)
            per_gender_hits.append(
                {
                    "gender": g,
                    "pronunciation": entry.pronunciation,
                    "glosses_en": entry.glosses_en,
                    "forms": gender_bundles or [],
                }
            )

        if not per_gender_hits:
            # Truly absent.
            return WiktionarySource(present=False, forms=[])

        if len(per_gender_hits) == 1:
            # Single-gender but get_form_bundles returned None (unusual; treat as single-gender).
            hit = per_gender_hits[0]
            return WiktionarySource(
                present=True,
                forms=hit["forms"],
                gender=hit["gender"],
                pronunciation=hit["pronunciation"],
                glosses_en=hit["glosses_en"],
                genders=None,
            )

        # Multi-gender (common-gender): collect all forms across genders.
        all_forms: list[FormBundle] = []
        for hit in per_gender_hits:
            all_forms.extend(hit["forms"])

        return WiktionarySource(
            present=True,
            forms=all_forms,
            gender=None,
            pronunciation=None,
            glosses_en=None,
            genders=per_gender_hits,
        )

    async def _assemble_frequency(self, lemma: str) -> FrequencySource:
        """Assemble frequency evidence for ``lemma``."""
        freq_service = FrequencyService(self.db)
        rank = await freq_service.get_frequency_rank(lemma)
        if rank is None:
            return FrequencySource(present=False, rank=None, band=None)
        band = await freq_service.get_frequency_band(lemma)
        return FrequencySource(present=True, rank=rank, band=band)

    async def _assemble_greek_lexicon(self, lemma: str, pos: str) -> GreekLexiconSource:
        """Assemble GreekLexicon attestation evidence.

        Fires a SINGLE existence query:
            SELECT ... FROM reference.greek_lexicon
            WHERE (lemma = :L OR form = :L) AND pos = :POS
            LIMIT 1

        pos is uppercased (GreekLexicon stores UD-UPPERCASE, e.g. "NOUN").

        Lemma-column hit: ``attested_lemma=True``, resolved_lemma = normalized_lemma.
        Surface-form-only hit: ``attested_surface_form=True``, resolved_lemma = row.lemma.
        Then fetches all declension rows via LexiconService.get_declensions(resolved_lemma, pos.upper()).
        """
        pos_upper = pos.upper()

        stmt = (
            select(GreekLexicon)
            .where(
                or_(GreekLexicon.lemma == lemma, GreekLexicon.form == lemma),
                GreekLexicon.pos == pos_upper,
            )
            .limit(1)
        )
        result = await self.db.execute(stmt)
        # LIMIT 1 guarantees at most one row; scalar() returns the ORM entity or None.
        row = result.scalar()

        if row is None:
            return GreekLexiconSource(
                present=False,
                attested_lemma=False,
                attested_surface_form=False,
            )

        # Determine how we matched.
        attested_lemma = row.lemma == lemma
        attested_surface_form = not attested_lemma

        # Resolve the canonical lemma for declension fetching.
        resolved_lemma = lemma if attested_lemma else row.lemma

        # Fetch all declension rows and map to FormBundles.
        lexicon_service = LexiconService(self.db)
        declension_entries = await lexicon_service.get_declensions(resolved_lemma, pos_upper)

        forms: list[FormBundle] = []
        for entry in declension_entries:
            features: dict[str, str] = {}
            if entry.ptosi and entry.ptosi in _PTOSI_MAP:
                features["case"] = _PTOSI_MAP[entry.ptosi]
            if entry.number and entry.number in _NUMBER_MAP:
                features["number"] = _NUMBER_MAP[entry.number]
            if entry.gender and entry.gender in _GENDER_MAP:
                features["gender"] = _GENDER_MAP[entry.gender]

            features = {k: v for k, v in features.items() if k in FEATURE_KEYS}
            if features and entry.form:
                forms.append(FormBundle(form=entry.form, features=features))

        return GreekLexiconSource(
            present=True,
            attested_lemma=attested_lemma,
            attested_surface_form=attested_surface_form,
            resolved_lemma=resolved_lemma,
            forms=forms,
        )
