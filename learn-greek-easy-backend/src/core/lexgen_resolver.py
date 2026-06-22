"""Per-POS morphology resolver scaffolding (LEXGEN-08-01).

This module holds the pure seam, registry, authority-chain config, and per-rung
adapters for the LEXGEN field-level resolver. It mirrors the style of the other
pure ``src/core/lexgen_*.py`` modules (``lexgen_forms.py`` /
``word_proposal_state.py``): no DB, no HTTP, no session, no I/O — only functions
over the value types from ``src/schemas/lexgen.py``.

What ships in 08-01 (this subtask)
----------------------------------
- ``MorphologyResolver`` — the POS-neutral resolver Protocol (seam #2).
- ``RESOLVERS`` registry + ``resolver_for(pos)``.
- ``NOUN_CHAINS`` — the §4 authority matrix as data: ``(pos, field)`` ->
  ordered tuple of rungs (rank order; co-rank-1 priority ``rules > wiktionary >
  lexicon > frequency`` per D2).
- The per-rung adapter callables. A *rung* is a small ``(packet, ctx) ->
  FieldEvidence | None`` adapter that reads exactly ONE source under
  ``packet.sources.*`` (NEVER a top-level packet attribute) and either returns
  one source's evidence or ``None`` when that source is absent (rung skipped —
  never a fabricated value).
- ``NounResolver`` with the first-confident-wins chain walk (filled in 08-02).

What does NOT ship here
-----------------------
- The reconciler service (08-03).

Rules rungs delegate to ``src/core/lexgen_authority.py`` via
``rules_for(pos, field)`` (TWO positional args). They look the registry up at
CALL time (capturing only the ``(pos, field)`` key, never the resolved tuple),
so ``lexgen_authority`` stays the single source of truth even if a row grows.

Confidence is logged-only / inert per Decision Record §3: no rung sets a numeric
``confidence`` to route a decision, and nothing downstream reads it to branch.
Every rung leaves ``FieldEvidence.confidence`` at its default ``None``.
"""

from __future__ import annotations

from typing import Callable, Protocol

from src.core.lexgen_authority import rules_for
from src.schemas.lexgen import (
    EvidencePacket,
    FieldEvidence,
    FormBundle,
    ResolutionContext,
    ResolvedField,
    ResolvedParadigm,
)

# A rung is a small adapter: it reads exactly ONE source and returns that
# source's evidence for one field, or None when the source is absent (skip).
Rung = Callable[[EvidencePacket, ResolutionContext], FieldEvidence | None]


# ---------------------------------------------------------------------------
# Resolver seam + registry (seam #2)
# ---------------------------------------------------------------------------


class MorphologyResolver(Protocol):
    """POS-neutral resolver seam: walk the authority chains for one lemma.

    A concrete resolver (e.g. :class:`NounResolver`) walks the per-field chains
    from :data:`NOUN_CHAINS` and produces a :class:`ResolvedParadigm`.
    """

    def resolve(self, lemma: str, packet: EvidencePacket) -> ResolvedParadigm: ...  # noqa: E704


class NounResolver:
    """Resolver for ``pos == "noun"``.

    Walks each ``("noun", field)`` chain in :data:`NOUN_CHAINS` and produces a
    :class:`ResolvedParadigm`. The walk is first-confident-wins: the first rung
    returning a non-null value is the field's PRIMARY (D1 — "confident" simply
    means a non-null value; there is no ``>= τ`` gate). Lower- and co-rank rungs
    that also return a value become cross-checks; a cross-check whose value
    differs from the primary flags the field (F6). No confident rung leaves the
    field Unresolved (``value=None``, ``source="none"``) with an
    ``unresolved:<field>`` flag.

    Decision Record §3: ``confidence`` is inert / logged-only — it is carried
    through from the primary rung (always ``None`` in v1) and NEVER read to route
    a decision. There is NO numeric ``adjust()`` / arithmetic anywhere in this
    walk; the §6 schematic's numeric step is intentionally omitted (DR §3).
    """

    # Fields resolved in DEPENDENCY order so ``gender`` is written to
    # ``ctx.resolved`` before ``declension_group`` runs (D3 — the declension
    # Rules rung reads ``ctx.resolved["gender"]``).
    _FIELD_ORDER: tuple[str, ...] = (
        "gender",
        "declension_group",
        "declension_forms",
        "ipa",
        "pos",
        "lemma_exists",
        "frequency_rank",
    )

    def resolve(self, lemma: str, packet: EvidencePacket) -> ResolvedParadigm:
        ctx = ResolutionContext(lemma=lemma, resolved={})
        fields: list[ResolvedField] = []
        cross_checks: dict[str, list[FieldEvidence]] = {}

        for field in self._FIELD_ORDER:
            resolved_field, considered = self._resolve_field(field, packet, ctx)
            fields.append(resolved_field)
            if considered:
                cross_checks[field] = considered

        # ``flagged_fields`` is the reconciler's "needs a human look" subset: a
        # field is flagged only when it carries an ACTIONABLE reconciliation flag
        # (``disagreement:*`` or ``unresolved:*``). Pure audit/provenance flags
        # (``rule_ambiguous`` / ``ipa_unvalidated`` / ``lexicon_gender_inconsistent``)
        # stay in ``ResolvedField.flags`` for observability but do NOT by
        # themselves mark a field — an ambiguous rule that a confident source
        # then covered is not a problem to surface. (This narrows the
        # task-description's "any non-empty flags" wording to match the
        # committed chain-walk tests, e.g. test_agreeing_lower_rung_no_flag where
        # rule_ambiguous is carried but gender is NOT flagged — see 08-03/QA.)
        flagged_fields = [
            rf.field
            for rf in fields
            if any(fl.startswith(("disagreement:", "unresolved:")) for fl in rf.flags)
        ]

        return ResolvedParadigm(
            lemma=lemma,
            pos=packet.pos,
            fields=fields,
            cross_checks=cross_checks,
            flagged_fields=flagged_fields,
        )

    def _resolve_field(
        self, field: str, packet: EvidencePacket, ctx: ResolutionContext
    ) -> tuple[ResolvedField, list[FieldEvidence]]:
        """Walk one field's chain, returning its ResolvedField + considered cross-checks.

        Side effect: writes the chosen value (or ``None``) into
        ``ctx.resolved[field]`` so a later, dependent field's rung can read it
        (progressive resolution, D3).
        """
        chain = NOUN_CHAINS[(packet.pos, field)]
        flags: list[str] = []
        primary: FieldEvidence | None = None
        cross_checks: list[FieldEvidence] = []

        for rung in chain:
            ev = rung(packet, ctx)
            if ev is None or ev.value is None:
                # Not confident (D1). Carry forward any audit flags the skipped
                # rung emitted (rule_ambiguous / lexicon_gender_inconsistent),
                # so the never-invent provenance survives even though this rung
                # did not win. EXCEPTION (ipa, DR/spec): the Rules ipa rung's
                # ``ipa_invalid:*`` is NEVER propagated onto the final field — it
                # stays inside that rung's own evidence; the ``ipa_unvalidated``
                # marker is added below purely because the raw wiktionary rung
                # became primary.
                if ev is not None and ev.flags:
                    flags.extend(self._carry_flags(field, ev.flags))
                continue
            if primary is None:
                primary = ev
            else:
                cross_checks.append(ev)
                if ev.value != primary.value:
                    flags.append(f"disagreement:{field}:{primary.source}!={ev.source}")

        if primary is None:
            flags.append(f"unresolved:{field}")
            ctx.resolved[field] = None
            return (
                ResolvedField(field=field, value=None, source="none", flags=flags),
                cross_checks,
            )

        # The raw Wiktionary pronunciation rung becoming primary for ``ipa`` means
        # the value was taken WITHOUT the G2P validator confirming it (the Rules
        # rung either was absent or returned value=None). Mark it as unvalidated.
        if field == "ipa" and primary.source == "wiktionary":
            flags.append("ipa_unvalidated")

        ctx.resolved[field] = primary.value
        return (
            ResolvedField(
                field=field,
                value=primary.value,
                source=primary.source,
                confidence=primary.confidence,  # inert None passed through (DR §3)
                flags=flags,
            ),
            cross_checks,
        )

    @staticmethod
    def _carry_flags(field: str, rung_flags: list[str]) -> list[str]:
        """Filter a skipped rung's flags before carrying them onto the field.

        For ``ipa`` the Rules rung's ``ipa_invalid:*`` flag is dropped (it stays
        inside that rung's own evidence; the field instead gets ``ipa_unvalidated``
        when the raw wiktionary rung wins). All other flags pass through.
        """
        if field == "ipa":
            return [fl for fl in rung_flags if not fl.startswith("ipa_invalid")]
        return list(rung_flags)


# Per-POS resolver registry. Additive by construction: registering a verb
# resolver later is a one-line append with zero change to the noun entry.
RESOLVERS: dict[str, MorphologyResolver] = {"noun": NounResolver()}


def resolver_for(pos: str) -> MorphologyResolver | None:
    """Return the registered resolver for *pos*, or ``None`` if none is registered."""
    return RESOLVERS.get(pos)


# ---------------------------------------------------------------------------
# Rung adapters — each reads exactly ONE packet.sources.* field (F1/F7).
# An absent source yields None (rung skipped), never a fabricated value (F9).
# ---------------------------------------------------------------------------


def _rules_rung(pos: str, field: str) -> Rung:
    """Build a Rules rung that delegates to ``lexgen_authority`` for ``(pos, field)``.

    The returned rung looks the authority registry up at CALL time (it captures
    only the ``(pos, field)`` key, never the resolved adapter tuple), iterates
    the registered adapter(s), and returns the FIRST that yields a
    :class:`FieldEvidence` (today each row has exactly one adapter; the shape
    survives the registry growing). Each registered adapter has a different
    signature, so the per-field call is dispatched below.
    """

    def rung(packet: EvidencePacket, ctx: ResolutionContext) -> FieldEvidence | None:
        for rule_fn in rules_for(pos, field):
            if field == "gender":
                # gender_evidence(lemma)
                return rule_fn(ctx.lemma)
            if field == "declension_group":
                # declension_group_evidence(lemma, gender) — needs an already
                # resolved gender; skip (return None) when gender is unresolved
                # rather than feed None to the rule (D3/F4).
                gender = ctx.resolved.get("gender")
                if gender is None:
                    return None
                return rule_fn(ctx.lemma, gender)
            if field == "ipa":
                # ipa_evidence(lemma, candidate_ipa) — validator gated on a
                # candidate from Wiktionary; absent candidate -> skip (D6).
                candidate = packet.sources.wiktionary.pronunciation
                if candidate is None:
                    return None
                return rule_fn(ctx.lemma, candidate)
        return None

    return rung


def _wiktionary_gender_rung(packet: EvidencePacket, ctx: ResolutionContext) -> FieldEvidence | None:
    """Read the Wiktionary gender directly from ``packet.sources.wiktionary.gender``."""
    gender = packet.sources.wiktionary.gender
    if gender is None:
        return None
    return FieldEvidence(source="wiktionary", field="gender", value=gender)


def _lexicon_gender_rung(packet: EvidencePacket, ctx: ResolutionContext) -> FieldEvidence | None:
    """Derive gender from the GreekLexicon forms (D18).

    ``GreekLexiconSource`` has no ``gender`` attribute, so gender is read from
    each ``FormBundle.features["gender"]``:

    1. Collect the distinct, non-empty gender values across the forms.
    2. None present  -> ``None`` (absent rung).
    3. All agree     -> ``FieldEvidence(source="lexicon", value=<that gender>)``.
    4. They differ   -> ``FieldEvidence(source="lexicon", value=None,
       flags=["lexicon_gender_inconsistent"])``.
    """
    forms: list[FormBundle] = packet.sources.greek_lexicon.forms
    genders = {g for bundle in forms if (g := bundle.features.get("gender"))}
    if not genders:
        return None
    if len(genders) == 1:
        return FieldEvidence(source="lexicon", field="gender", value=next(iter(genders)))
    return FieldEvidence(
        source="lexicon",
        field="gender",
        value=None,
        flags=["lexicon_gender_inconsistent"],
    )


def _lexicon_forms_rung(packet: EvidencePacket, ctx: ResolutionContext) -> FieldEvidence | None:
    """Surface the GreekLexicon declension forms as evidence (absent when no forms)."""
    forms = packet.sources.greek_lexicon.forms
    if not forms:
        return None
    return FieldEvidence(
        source="lexicon",
        field="declension_forms",
        value=str(len(forms)),
    )


def _wiktionary_forms_rung(packet: EvidencePacket, ctx: ResolutionContext) -> FieldEvidence | None:
    """Surface the Wiktionary declension forms as evidence (absent when no forms)."""
    forms = packet.sources.wiktionary.forms
    if not forms:
        return None
    return FieldEvidence(
        source="wiktionary",
        field="declension_forms",
        value=str(len(forms)),
    )


def _wiktionary_pronunciation_rung(
    packet: EvidencePacket, ctx: ResolutionContext
) -> FieldEvidence | None:
    """Surface the raw Wiktionary pronunciation as IPA evidence (no validation)."""
    pronunciation = packet.sources.wiktionary.pronunciation
    if pronunciation is None:
        return None
    return FieldEvidence(source="wiktionary", field="ipa", value=pronunciation)


def _wiktionary_pos_rung(packet: EvidencePacket, ctx: ResolutionContext) -> FieldEvidence | None:
    """Witness pos from the presence of the Wiktionary source; value = ``packet.pos``."""
    if not packet.sources.wiktionary.present:
        return None
    return FieldEvidence(source="wiktionary", field="pos", value=packet.pos)


def _lexicon_pos_rung(packet: EvidencePacket, ctx: ResolutionContext) -> FieldEvidence | None:
    """Witness pos from the presence of the GreekLexicon source; value = ``packet.pos``."""
    if not packet.sources.greek_lexicon.present:
        return None
    return FieldEvidence(source="lexicon", field="pos", value=packet.pos)


def _wiktionary_lemma_exists_rung(
    packet: EvidencePacket, ctx: ResolutionContext
) -> FieldEvidence | None:
    """Attest lemma existence from ``packet.sources.wiktionary.present``."""
    if not packet.sources.wiktionary.present:
        return None
    return FieldEvidence(source="wiktionary", field="lemma_exists", value="true")


def _lexicon_lemma_exists_rung(
    packet: EvidencePacket, ctx: ResolutionContext
) -> FieldEvidence | None:
    """Attest lemma existence from ``packet.sources.greek_lexicon.present``."""
    if not packet.sources.greek_lexicon.present:
        return None
    return FieldEvidence(source="lexicon", field="lemma_exists", value="true")


def _frequency_lemma_exists_rung(
    packet: EvidencePacket, ctx: ResolutionContext
) -> FieldEvidence | None:
    """Attest lemma existence from ``packet.sources.frequency.present``."""
    if not packet.sources.frequency.present:
        return None
    return FieldEvidence(source="frequency", field="lemma_exists", value="true")


def _frequency_rank_rung(packet: EvidencePacket, ctx: ResolutionContext) -> FieldEvidence | None:
    """Read the frequency rank; ``int -> str`` per D16, ``None`` when absent (F8)."""
    rank = packet.sources.frequency.rank
    if rank is None:
        return None
    return FieldEvidence(source="frequency", field="frequency_rank", value=str(rank))


# ---------------------------------------------------------------------------
# NOUN_CHAINS — the §4 authority matrix as data (D8).
#
# Seven ("noun", <field>) keys; rungs ordered by rank (co-rank-1 priority
# rules > wiktionary > lexicon > frequency, D2). Field keys are LOWERCASE — the
# IPA field key is "ipa", never "IPA" (LEXGEN-07 contract).
# ---------------------------------------------------------------------------

NOUN_CHAINS: dict[tuple[str, str], tuple[Rung, ...]] = {
    ("noun", "gender"): (
        _rules_rung("noun", "gender"),  # rank 1
        _wiktionary_gender_rung,  # rank 1
        _lexicon_gender_rung,  # rank 2
    ),
    ("noun", "declension_group"): (
        _rules_rung("noun", "declension_group"),  # rank 1
        # wiktionary/lexicon declension_group derivation lands when forms can be
        # unambiguously mapped to a group (D5); not surfaced as a rung in 08-01.
    ),
    ("noun", "declension_forms"): (
        _lexicon_forms_rung,  # rank 1
        _wiktionary_forms_rung,  # rank 2
    ),
    ("noun", "ipa"): (
        _rules_rung("noun", "ipa"),  # rank 1 — validator gated on the wikt candidate
        _wiktionary_pronunciation_rung,  # rank 2 — raw candidate
    ),
    ("noun", "pos"): (
        _wiktionary_pos_rung,  # rank 1
        _lexicon_pos_rung,  # rank 2
    ),
    ("noun", "lemma_exists"): (
        _wiktionary_lemma_exists_rung,  # rank 1
        _lexicon_lemma_exists_rung,  # rank 1
        _frequency_lemma_exists_rung,  # rank 1
    ),
    ("noun", "frequency_rank"): (_frequency_rank_rung,),  # rank 1
}
