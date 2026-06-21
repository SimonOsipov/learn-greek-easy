"""Noun morphology heuristics for the LEXGEN pipeline (LEXGEN-07-01).

Public surface:
  AMBIGUOUS           — singleton sentinel for unknown / genuinely ambiguous results
  derive_gender       — lemma → "feminine" | "neuter" | AMBIGUOUS
  derive_declension_group — (lemma, gender) → group str | AMBIGUOUS
"""

from __future__ import annotations

from src.utils.greek_text import _strip_article, normalize_greek_accents


class _Ambiguous:
    """Sentinel for unknown or genuinely ambiguous morphological analysis.

    A single module-level instance ``AMBIGUOUS`` is shared by both functions.
    Covers both 'ending unknown' and 'ending exists but gender/group is
    ambiguous from the ending alone'.
    """

    __slots__ = ()

    def __repr__(self) -> str:
        return "AMBIGUOUS"


AMBIGUOUS = _Ambiguous()

# ---------------------------------------------------------------------------
# Declension rules — copied/generalised from NounDataGenerationService
# (LEXGEN-07-01 D1: original left untouched; retired in LEXGEN-09).
#
# The table is keyed by gender and contains (suffix, group) pairs.  Within
# each gender the pairs are already ordered longest-suffix-first so that
# multi-character suffixes (e.g. "-μα") are matched before shorter ones
# (e.g. "-α", "-ο").
# ---------------------------------------------------------------------------
_DECLENSION_RULES: dict[str, list[tuple[str, str]]] = {
    "masculine": [
        ("-ος", "masculine_os"),
        ("-ας", "masculine_as"),
        ("-ής", "masculine_is"),
        ("-ης", "masculine_is"),
    ],
    "feminine": [
        ("-ος", "feminine_os"),
        ("-α", "feminine_a"),
        ("-η", "feminine_i"),
    ],
    "neuter": [
        ("-μα", "neuter_ma"),
        ("-ος", "neuter_os"),
        ("-ο", "neuter_o"),
        ("-ι", "neuter_i"),
    ],
}

# ---------------------------------------------------------------------------
# Gender heuristics — ordered longest-suffix-first so that "-μα" (neuter)
# is tested before the single-char "-α" (feminine) class.
# Only endings that *unambiguously* signal a single gender are included.
# ---------------------------------------------------------------------------
_GENDER_RULES: list[tuple[str, str]] = [
    ("-μα", "neuter"),  # γράμμα, πρόβλημα — must precede "-α"
    ("-α", "feminine"),  # θάλασσα, γλώσσα
    ("-η", "feminine"),  # νίκη, πόλη
    ("-ι", "neuter"),  # παιδί, ταξίδι
]


def _prepare(lemma: str) -> str:
    """Strip article and normalise accents for suffix matching."""
    return normalize_greek_accents(_strip_article(lemma))


def derive_gender(lemma: str) -> str | _Ambiguous:
    """Derive grammatical gender from a Greek noun lemma by its ending.

    Endings that unambiguously signal gender:
      -α / -η  → "feminine"
      -ι / -μα → "neuter"

    Everything else (including -ος / -ης / -ας which are shared across
    genders) → AMBIGUOUS.  Never fabricates a gender.

    Internally strips the definite article and normalises Greek accents so
    matching is article-tolerant and accent-insensitive.
    """
    bare = _prepare(lemma)
    for suffix, gender in _GENDER_RULES:
        suffix_norm = normalize_greek_accents(suffix.lstrip("-"))
        if bare.endswith(suffix_norm):
            return gender
    return AMBIGUOUS


def derive_declension_group(lemma: str, gender: str) -> str | _Ambiguous:
    """Derive the declension group from a Greek noun lemma and its gender.

    Generalises the ``_DECLENSION_RULES`` table from NounDataGenerationService.
    Within each gender the rules are applied longest-suffix-first so that e.g.
    ``-μα`` is matched before ``-α``.

    Group names (from the production rules table):
      masculine: masculine_os | masculine_as | masculine_is
      feminine:  feminine_a   | feminine_i   | feminine_os
      neuter:    neuter_ma    | neuter_o     | neuter_i    | neuter_os

    Returns AMBIGUOUS when the gender is unknown, the lemma's ending does not
    match any rule for the given gender, or the ending is genuinely ambiguous.

    Internally strips the definite article and normalises Greek accents so
    matching is article-tolerant and accent-insensitive.
    """
    rules = _DECLENSION_RULES.get(gender)
    if rules is None:
        return AMBIGUOUS

    bare = _prepare(lemma)
    for suffix, group in rules:
        suffix_norm = normalize_greek_accents(suffix.lstrip("-"))
        if bare.endswith(suffix_norm):
            return group

    return AMBIGUOUS
