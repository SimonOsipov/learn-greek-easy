"""LEXGEN morphological form schemas — feature-keyed, POS-neutral (LEXGEN-02-01).

This module holds the Layer-0 representation for inflected forms in the LEXGEN
word-proposal pipeline. A form is carried as a ``FormBundle``: the surface
string plus a ``features`` dict keyed by a controlled vocabulary
(``FEATURE_KEYS``). This is the canonical internal shape; flat keys like
``genitive_plural`` exist only at the UI edge and are converted in/out by the
strict converters (LEXGEN-02-03, ``src/core/lexgen_forms.py``).

Invariants
----------
- **Seam #1 — feature-keyed forms.** Internally a form's morphology is a dict
  of ``{feature_key: value}`` (e.g. ``{"case": "genitive", "number": "plural"}``).
  Flat, underscore-joined keys (``genitive_plural``) are a UI-edge convenience
  only; they never appear inside a ``FormBundle.features`` dict. The boundary is
  enforced by the feature-key validator below (any key ∉ ``FEATURE_KEYS`` —
  including a flat key — is rejected).
- **Seam #5 — POS-neutral.** A ``FormBundle`` makes no assumption about part of
  speech. ``gender`` is just one feature key among ten, no more privileged than
  ``case`` or ``tense``; nouns simply happen to use ``case``/``number``/``gender``
  while verbs use ``person``/``tense``/``mood``/etc. No source/lexicon access
  happens in this story — these are pure value types.

Value-mapping table (LEXGEN-08 join contract)
----------------------------------------------
The verified noun mapping from UD-canonical feature values (as produced upstream,
lowercase English) to the ``GreekLexicon`` column value (English UD abbreviation):

    feature key   UD canonical value        GreekLexicon column → value
    -----------   -----------------------   ---------------------------
    case          nominative                ptosi   → "Nom"
    case          genitive                  ptosi   → "Gen"
    case          accusative                ptosi   → "Acc"
    case          vocative                  ptosi   → "Voc"
    number        singular                  number  → "Sing"
    number        plural                    number  → "Plur"
    gender        masculine                 gender  → "Masc"
    gender        feminine                  gender  → "Fem"
    gender        neuter                    gender  → "Neut"
    (pos)         noun                       pos     → "NOUN"

Evidence (production code, verified — the dev lexicon table is empty and prod is
network-blocked, so the mapping is sourced from the live mapping dicts):
  - ``src/services/local_verification_service.py:28`` ``_CASE_MAP`` →
    nominative/genitive/accusative/vocative ↦ Nom/Gen/Acc/Voc.
  - ``src/services/local_verification_service.py:29`` ``_NUMBER_MAP`` →
    singular/plural ↦ Sing/Plur.
  - ``src/utils/greek_articles.py:27`` ``GENDER_MAP`` →
    Masc/Fem/Neut ↦ masculine/feminine/neuter (this module's table is the inverse
    direction: UD canonical → column value).
  - ``src/db/models.py`` ``GreekLexicon`` column comments confirm the stored
    abbreviations: ``ptosi`` "Grammatical case (Nom, Gen, Acc, Voc)",
    ``number`` "(Sing, Plur)", ``gender`` "(Masc, Fem, Neut)".
  - ``pos`` "NOUN" is the Universal POS tag, consistent with
    ``src/schemas/nlp.py`` ``MorphologyResult.pos``.

``person`` type-impedance caveat (verb path — DOCUMENTATION ONLY)
----------------------------------------------------------------
``GreekLexicon.person`` is a ``SmallInteger`` storing the integer person 1/2/3
(``src/db/models.py`` — ``comment="Grammatical person (1, 2, 3) for verb forms"``),
NOT a string. A feature-exact join on ``person`` would therefore require an
explicit cast, e.g. ``CAST(GreekLexicon.person AS TEXT) == features["person"]``;
the value is not directly string-join-ready against a ``features`` dict (whose
values are always strings). No ``person`` value map, join, or cast ships in this
story — this caveat is recorded here so the LEXGEN-08 join implementation does
not silently mismatch on it. Verb feature *values* (tense/aspect/mood/voice/etc.)
are likewise documented out of scope here; only the noun value map is authored.
"""

from types import MappingProxyType
from typing import Mapping

from pydantic import BaseModel, ConfigDict, Field, field_validator

# The controlled vocabulary of morphological feature keys, aligned 1:1 to the
# GreekLexicon morphology columns. Exactly ten keys; no more, no less.
FEATURE_KEYS: frozenset[str] = frozenset(
    {
        "case",
        "number",
        "gender",
        "person",
        "tense",
        "aspect",
        "mood",
        "verbform",
        "voice",
        "degree",
    }
)


class FormBundle(BaseModel):
    """A single inflected surface form plus its morphological features.

    ``features`` is keyed by the controlled ``FEATURE_KEYS`` vocabulary; values
    are free strings (the upstream UD-canonical value, e.g. ``"genitive"``).
    Only the *keys* are constrained — an unknown key (including a flat,
    underscore-joined UI-edge key like ``"genitive_plural"``) raises a
    ``ValidationError``.
    """

    form: str = Field(..., min_length=1)
    features: dict[str, str]

    @field_validator("features")
    @classmethod
    def _features_keys_in_vocabulary(cls, value: dict[str, str]) -> dict[str, str]:
        """Reject any features key outside the controlled FEATURE_KEYS vocabulary."""
        unknown = set(value) - FEATURE_KEYS
        if unknown:
            raise ValueError(
                f"Unknown feature key(s): {sorted(unknown)}. "
                f"Allowed keys: {sorted(FEATURE_KEYS)}."
            )
        return value


# ---------------------------------------------------------------------------
# LEXGEN-02-02 — POS-neutral proposal-draft value types + GRAMMAR_DATA_SCHEMA.
#
# In-flight pipeline shapes for the reconciler. These are pure value types: no
# persistence, no resolver behaviour, no converters (those land in 02-03). Like
# the FormBundle above, they are POS-neutral — ``gender`` is NEVER a structural
# field here, only ever a ``FormBundle.features`` key (seam #5).
# ---------------------------------------------------------------------------


class FieldEvidence(BaseModel):
    """One source's evidence for a single field value.

    ``confidence`` and ``flags`` are INERT logged data (Decision Record §3): no
    model in this pipeline reads them to branch a decision — they are carried
    for observability/audit only. ``confidence`` is bounded to ``[0.0, 1.0]``
    so a malformed score is rejected at the boundary, matching the precedent in
    ``src/schemas/nlp.py`` (``NormalizedLemma.confidence``).
    """

    source: str
    field: str
    value: str | None = None
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    flags: list[str] = Field(default_factory=list)


class ResolvedField(BaseModel):
    """The reconciler's chosen value for one field, plus its provenance.

    ``confidence``/``flags`` are inert logged data (Decision Record §3), as on
    ``FieldEvidence``. ``confidence`` is bounded to ``[0.0, 1.0]``.
    """

    field: str
    value: str | None = None
    source: str
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    flags: list[str] = Field(default_factory=list)


class ProposalDraft(BaseModel):
    """In-flight bundle of reconciled fields for a single word proposal.

    POS-neutral by construction: ``pos`` is FREE TEXT (no enum/Literal), mirroring
    ``WordProposal.pos`` from LEXGEN-01, so verbs/adjectives/etc. need no schema
    change. There is no ``gender`` (or any other noun-only) structural field —
    ``gender`` only ever appears as a ``FormBundle.features`` key (seam #5).
    """

    lemma: str = Field(..., min_length=1)
    pos: str
    resolved_fields: list[ResolvedField] = Field(default_factory=list)
    grammar_data_schema_version: str


# Immutable {pos: grammar-data-schema-version} mapping. Wrapped in
# MappingProxyType so an accidental runtime write (e.g. ``GRAMMAR_DATA_SCHEMA[
# "noun"] = ...``) raises ``TypeError`` instead of silently mutating shared
# global state. Adding a part of speech later is purely additive — e.g. append
# ``"verb": "verb.v1"`` — with ZERO change to the existing ``"noun"`` entry. No
# verb schema is authored here (that is a later story).
GRAMMAR_DATA_SCHEMA: Mapping[str, str] = MappingProxyType({"noun": "noun.v1"})


# ---------------------------------------------------------------------------
# LEXGEN-08-01 — Resolver value types (per-POS morphology resolver scaffolding).
#
# POS-neutral carriers for the field-level authority-chain walk (the resolver
# itself lives in ``src/core/lexgen_resolver.py``). They live HERE, next to the
# LEXGEN-02 ``FieldEvidence``/``ResolvedField`` family they extend (F5/D12/D17),
# rather than in ``core/``, so the schema module stays the single home for the
# pipeline value types and ``lexgen_resolver`` can import them from one place.
# ---------------------------------------------------------------------------


class ResolutionContext(BaseModel):
    """Per-resolution carrier passed to every rung during the chain walk.

    Carries the normalized ``lemma`` plus a MUTABLE ``resolved`` map of
    already-resolved field values (``field -> chosen value``), so a later
    field's rung can read an earlier field's resolved value (e.g. the
    ``declension_group`` rung reads ``resolved["gender"]`` — D3). The resolver
    populates ``resolved`` field by field, in dependency order; rungs only READ
    ``ctx``, the resolver is the only writer.
    """

    lemma: str
    resolved: dict[str, str | None] = Field(default_factory=dict)


class ResolvedParadigm(BaseModel):
    """The resolver's output for one lemma: the chosen value per field, plus audit.

    ``fields`` is one ``ResolvedField`` per resolved field; ``cross_checks`` maps
    each field to the lower-rank evidence that was considered (for the
    reconciler's audit log); ``flagged_fields`` is the convenience subset of
    fields carrying an actionable flag (``disagreement:*`` / ``unresolved:*``);
    audit-only flags (``rule_ambiguous``, ``ipa_unvalidated``,
    ``lexicon_gender_inconsistent``) stay in the per-field flags and do NOT add
    the field here. POS-neutral: ``pos`` is free text, mirroring
    ``ProposalDraft``/``WordProposal``.
    """

    lemma: str
    pos: str
    fields: list[ResolvedField] = Field(default_factory=list)
    cross_checks: dict[str, list[FieldEvidence]] = Field(default_factory=dict)
    flagged_fields: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# LEXGEN-06-01 — EvidencePacket schema (Stage 1 evidence assembly).
#
# An auditable provenance snapshot of all sources consulted for a given lemma
# before the never-invent gate runs. Each source carries a ``present: bool``
# discriminator (intentional deviation from the nullable-None convention) so
# that "consulted but absent" is explicit in the packet dump.
#
# RulesSource is a D-RULESSTUB: present/absent only — no resolver fields ship
# until the rule-based resolver is implemented in a later LEXGEN story.
# ---------------------------------------------------------------------------


class WiktionarySource(BaseModel):
    """Evidence collected from the Wiktionary importer for one lemma.

    ``forms`` reuses the LEXGEN-02 ``FormBundle`` type; an empty list means
    the entry existed but carried no inflected forms.

    ``gender`` is set for single-gender lemmas (e.g. "neuter"), ``None`` for
    common-gender (multi-row) lemmas. ``genders`` is populated only for
    common-gender lemmas, carrying per-gender detail dicts.
    ``pronunciation`` and ``glosses_en`` come from the WiktionaryMorphology row.
    """

    present: bool
    forms: list[FormBundle] = Field(default_factory=list)
    gender: str | None = None
    pronunciation: str | None = None
    glosses_en: str | None = None
    genders: list | None = None


class GreekLexiconSource(BaseModel):
    """Evidence collected from the GreekLexicon database for one lemma.

    ``attested_lemma``: True when the normalized lemma matched the ``lemma``
    column of a GreekLexicon row directly.
    ``attested_surface_form``: True when the normalized lemma matched the
    ``form`` column (inflected surface form) but NOT the ``lemma`` column.
    ``resolved_lemma``: The canonical lemma used for fetching declensions —
    equals the normalized lemma for a lemma-column hit, or the row's
    ``.lemma`` value for a surface-form-only hit.
    """

    present: bool
    forms: list[FormBundle] = Field(default_factory=list)
    attested_lemma: bool = False
    attested_surface_form: bool = False
    resolved_lemma: str | None = None


class FrequencySource(BaseModel):
    """Frequency-rank evidence from the reference.frequency_rank table.

    Absent shape (AC-6): ``{"present": false, "rank": null, "band": null}``.
    The ``rank`` and ``band`` fields are always present in the dump (never
    omitted) so the consumer never has to check for key existence — only for
    ``None`` vs a concrete value.
    """

    present: bool
    rank: int | None = None
    band: str | None = None


class RulesSource(BaseModel):
    """Rule-based resolver evidence stub (D-RULESSTUB).

    Absent shape (AC-3): ``{"present": false}`` — exactly one key, no resolver
    fields. This stub will grow when the rule-based resolver lands in a later
    LEXGEN story; until then no resolver fields are exposed.
    """

    present: bool


class EvidencePacketSources(BaseModel):
    """Container for all four per-source evidence sub-models."""

    wiktionary: WiktionarySource
    greek_lexicon: GreekLexiconSource
    frequency: FrequencySource
    rules: RulesSource


class EvidencePacket(BaseModel):
    """Auditable provenance snapshot produced by Stage 1 evidence assembly.

    Carries the raw and normalised lemma, the part-of-speech (free text,
    POS-neutral), and the per-source evidence collected before the
    never-invent gate runs. ``model_dump(mode="json")`` yields a
    ``json.dumps``-serializable dict.
    """

    lemma_input: str
    normalized_lemma: str
    pos: str
    sources: EvidencePacketSources


class GeneratedLexContent(BaseModel):
    """The ONLY content the RAG generator authors/selects (LEXGEN-09).

    Morphology is structurally impossible here: ``extra="forbid"`` rejects any
    gender/ipa/declension/form field (cardinal invariant — Decision Record §1;
    LLM never produces a morphological form).

    The four fields map to the reconciler's declared gaps as follows:
    - ``gloss_en``           → gap "gloss_en"  (selection from Wiktionary candidates)
    - ``gloss_ru``           → gap "gloss_ru"  (generated; Generator rank 1)
    - ``example_greek``      → gap "example"   (1→2 mapping; sentence under closed-vocab)
    - ``example_translation`` → gap "example"  (1→2 mapping; translation; Generator rank 1)

    ``"example"`` is the reconciler's gap LABEL only — it is NEVER a literal key
    in ``generated_content`` (D6/F1).  Downstream consumers (LEXGEN-10/11) resolve
    it via the fixed 1→2 mapping to these two concrete keys.
    """

    model_config = ConfigDict(extra="forbid")

    gloss_en: str = Field(..., min_length=1)
    gloss_ru: str = Field(..., min_length=1)
    example_greek: str = Field(..., min_length=1)
    example_translation: str = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# LEXGEN-11-01 — Judge rubric schemas (Stage 5 ensemble judge).
#
# The closed-vocabulary content shape each judge scores. Like
# ``GeneratedLexContent`` (Decision Record §1), the judge speaks ONLY to the
# four generated content fields — never morphology. ``JudgeBlockingIssue.field``
# is constrained to that same four-field vocabulary so a judge cannot critique a
# gender/case/declension field it has no authority over. There is deliberately
# NO aggregate/overall score field anywhere here: the five dimensions are the
# only numeric surface, which makes a numeric trust score structurally
# impossible (Decision Record §3, D8) and is guarded by ``extra="forbid"``.
# ---------------------------------------------------------------------------

# The five rubric dimension names — the single source of truth for what each
# judge scores. A tuple so the ordering is deterministic (used to diff two
# judges' rubrics dimension-by-dimension downstream).
JUDGE_RUBRIC_DIMENSIONS: tuple[str, ...] = (
    "naturalness",
    "sense_fit",
    "translation_faith_en",
    "translation_faith_ru",
    "a2_appropriateness",
)

# The closed content vocabulary a judge is allowed to raise a blocking issue
# against — exactly the four ``GeneratedLexContent`` fields. A field outside
# this set (e.g. a morphology field like ``gender`` or ``case``) is rejected at
# the boundary, mirroring ``FormBundle._features_keys_in_vocabulary``.
_JUDGE_CRITIQUEABLE_FIELDS: frozenset[str] = frozenset(
    {
        "gloss_en",
        "gloss_ru",
        "example_greek",
        "example_translation",
    }
)


class JudgeBlockingIssue(BaseModel):
    """A single blocking issue one judge raises against a content field.

    ``field`` is constrained to the ``_JUDGE_CRITIQUEABLE_FIELDS`` closed
    vocabulary (the four ``GeneratedLexContent`` fields); any other value —
    including a morphology field like ``gender`` — raises a ``ValidationError``,
    the same closed-vocabulary boundary ``FormBundle`` enforces on feature keys.
    ``extra="forbid"`` blocks any smuggled-in extra key.
    """

    model_config = ConfigDict(extra="forbid")

    field: str
    issue: str

    @field_validator("field")
    @classmethod
    def _field_in_vocabulary(cls, value: str) -> str:
        """Reject any blocking-issue field outside the closed content vocabulary."""
        if value not in _JUDGE_CRITIQUEABLE_FIELDS:
            raise ValueError(
                f"Unknown critiqueable field: {value!r}. "
                f"Allowed fields: {sorted(_JUDGE_CRITIQUEABLE_FIELDS)}."
            )
        return value


class JudgeRubric(BaseModel):
    """One judge's structured score for a generated content proposal.

    Five integer dimensions, each bounded to ``[1, 5]`` (``ge=1, le=5``), plus a
    (possibly empty) list of ``JudgeBlockingIssue``. ``extra="forbid"`` makes the
    cardinal invariant structural: a judge cannot smuggle in an ``overall_score``
    or any other un-declared field, so no numeric trust/aggregate score can ever
    enter the pipeline (Decision Record §3, D8).
    """

    model_config = ConfigDict(extra="forbid")

    naturalness: int = Field(..., ge=1, le=5)
    sense_fit: int = Field(..., ge=1, le=5)
    translation_faith_en: int = Field(..., ge=1, le=5)
    translation_faith_ru: int = Field(..., ge=1, le=5)
    a2_appropriateness: int = Field(..., ge=1, le=5)
    blocking_issues: list[JudgeBlockingIssue] = Field(default_factory=list)
