"""Noun morphology heuristics for the LEXGEN pipeline (LEXGEN-07-01).

SKELETON ONLY — all derivation logic raises NotImplementedError.
The executor will replace the bodies in Stage 3.

Public surface:
  AMBIGUOUS           — singleton sentinel for unknown / genuinely ambiguous results
  derive_gender       — lemma → "feminine" | "neuter" | AMBIGUOUS
  derive_declension_group — (lemma, gender) → group str | AMBIGUOUS
"""

from __future__ import annotations


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
    raise NotImplementedError


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
    raise NotImplementedError
