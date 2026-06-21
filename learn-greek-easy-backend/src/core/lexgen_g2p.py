"""G2P phonotactic legality validator for the LEXGEN pipeline (LEXGEN-07-02).

This module provides a pure, stateless phonotactic **legality** check
(NOT a transducer): given a candidate IPA string emitted by an LLM, it
normalises the string and then validates every residual symbol against the
Greek phoneme inventory accepted by this codebase.

Public surface:

    G2PResult  — frozen dataclass (ok: bool, reason: str | None)
    validate_ipa(lemma, candidate_ipa) -> G2PResult
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class G2PResult:
    """Result of a G2P phonotactic legality check.

    Attributes:
        ok: True if every residual symbol in the normalised candidate is
            a member of the Greek phoneme inventory; False otherwise.
        reason: Human-readable failure description, or None when ok is True.
    """

    ok: bool
    reason: str | None


def validate_ipa(lemma: str, candidate_ipa: str) -> G2PResult:
    """Validate that *candidate_ipa* contains only legal Greek phoneme symbols.

    Normalises *candidate_ipa* via ``normalize_ipa`` (strips delimiters,
    dots, stress marks, Greek accents, tie-bar, nasalisation, length mark)
    and then checks that every remaining character is a member of the
    codebase's Greek phoneme inventory.

    The inventory is the union of both IPA conventions in use (standard IPA
    and the LLM simplified-Latin substitution set):

        frozenset("a e i o u p b t d k f v s z m n l r g x θ ð ɣ ʝ ʎ ŋ ç ɲ c y h".split()) | {"ɡ"}

    Note: BOTH ``g`` (U+0067) and ``ɡ`` (U+0261) are legal.  ``x``
    (U+0078, LATIN SMALL LETTER X) is legal.  ``c``, ``y``, ``h`` are
    the residuals produced by the LLM substitutions ç→c, ʝ→y, ɣ→gh.

    Special case — empty normalised candidate:
        If ``normalize_ipa(candidate_ipa)`` produces an empty string the
        check returns ``G2PResult(ok=False, reason="empty pronunciation")``
        immediately, BEFORE the membership scan.  (Without this guard
        ``all(ch in inventory for ch in "")`` would pass vacuously.)

    Args:
        lemma: The Greek lemma being validated (used for context only;
            the phonotactic check does not inspect the lemma).
        candidate_ipa: The raw IPA string to validate (may include
            delimiters, stress markers, syllable dots, etc.).

    Returns:
        A frozen ``G2PResult`` with ``ok=True`` and ``reason=None`` on
        success, or ``ok=False`` and a non-empty ``reason`` on failure.
    """
    raise NotImplementedError
