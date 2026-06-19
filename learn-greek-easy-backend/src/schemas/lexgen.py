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

from pydantic import BaseModel, Field, field_validator

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
