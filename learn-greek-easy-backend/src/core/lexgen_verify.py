"""Pure deterministic gate functions for the LEXGEN verify stage (LEXGEN-10-01).

This module is intentionally free of I/O, database access, LLM calls, and
heavy NLP dependencies (no spaCy, no SQLAlchemy).  All functions are pure and
side-effect-free — inputs in, GateResult out.

The verify service (LEXGEN-10-03) is responsible for:
  - Lemmatizing the sentence (spaCy) and producing the post-skip/post-split
    sub-lemma list.
  - Calling ``normalize_lemma`` on each lemma before passing it here.
  - Passing the normalized allowed set.

Public surface:

    GateResult              — frozen dataclass (passed, severity, gate, offending, reason)
    normalize_lemma(lemma) -> str
    check_e(token_lemmas, allowed, target_lemma) -> GateResult
    check_target_attested(token_lemmas, target_lemma) -> GateResult
    check_gloss_subset(gloss_en, wiktionary_glosses) -> GateResult
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass, field
from typing import Literal


@dataclass(frozen=True)
class GateResult:
    """Result of a deterministic verify-stage gate.

    Attributes:
        passed:    True when the gate passes; False on warn or fail.
        severity:  "pass" | "warn" | "fail".
                   "warn"  → record flag, do NOT regenerate (e.g. gloss not in Wiktionary).
                   "fail"  → hard gate failure, triggers regenerate ×2 → flag.
        gate:      Name of the gate that produced this result (e.g. "check_e").
        offending: List of offending lemmas / tokens (non-empty only on fail).
        reason:    Human-readable description, or None when passed=True.
    """

    passed: bool
    severity: Literal["pass", "warn", "fail"]
    gate: str
    offending: list[str] = field(default_factory=list)
    reason: str | None = None


def normalize_lemma(lemma: str) -> str:
    """Normalize a lemma for membership comparison: lower() + NFC, accents preserved.

    Matches the CEFR loader normalization (src/scripts/load_cefr_lemma.py):
    ``raw.lower()`` followed by ``unicodedata.normalize("NFC", …)``.
    Accents are NOT stripped (monotonic modern Greek — do NOT call
    ``normalize_greek_accents`` or any accent-stripping helper here).

    Args:
        lemma: Raw lemma string (may be title-case or all-caps).

    Returns:
        Lowercased, NFC-normalized lemma string with accents intact.
    """
    return unicodedata.normalize("NFC", lemma.lower())


def check_e(
    token_lemmas: list[str],
    allowed: set[str],
    target_lemma: str,
) -> GateResult:
    """Closed-vocabulary gate (Check E, Architecture-Schematics §7).

    Every lemma in ``token_lemmas`` must be a member of
    ``allowed ∪ {target_lemma}``.  The target lemma NEVER counts as offending,
    even if it is absent from ``allowed``.

    This function operates on an ALREADY-split, ALREADY-normalized sub-lemma
    list.  The verify service (LEXGEN-10-03) handles contraction splitting
    (e.g. 'σε ο' → ['σε', 'ο']) and ``normalize_lemma`` application before
    calling this function.

    Args:
        token_lemmas:  Post-skip, post-split, post-normalize sub-lemma list.
        allowed:       The allowed CEFR ∪ closed-class set (caller normalizes).
        target_lemma:  The target lemma (already normalized).

    Returns:
        GateResult with gate="check_e".
        On pass: passed=True, severity="pass", offending=[].
        On fail: passed=False, severity="fail", offending=[out-of-vocab lemmas].
    """
    offending = [lemma for lemma in token_lemmas if lemma != target_lemma and lemma not in allowed]
    passed = not offending
    return GateResult(
        passed=passed,
        severity="pass" if passed else "fail",
        gate="check_e",
        offending=offending,
        reason=None if passed else f"out-of-vocab lemmas: {offending}",
    )


def check_target_attested(
    token_lemmas: list[str],
    target_lemma: str,
) -> GateResult:
    """Assert the target lemma is present in the sentence's token lemmas.

    Args:
        token_lemmas:  Post-skip, post-normalize sub-lemma list.
        target_lemma:  The target lemma (already normalized).

    Returns:
        GateResult with gate="target_attested".
        On pass: passed=True, severity="pass".
        On fail: passed=False, severity="fail".
    """
    passed = target_lemma in token_lemmas
    return GateResult(
        passed=passed,
        severity="pass" if passed else "fail",
        gate="target_attested",
        offending=[],
        reason=None if passed else f"target lemma '{target_lemma}' not found in sentence",
    )


def check_gloss_subset(
    gloss_en: str,
    wiktionary_glosses: str | None,
) -> GateResult:
    """Assert the generator's chosen EN gloss is among the Wiktionary glosses.

    The Wiktionary glosses string is semicolon-separated (the generator uses
    "; " as the separator); each entry is stripped before comparison.

    Severity policy (D-GLOSS-SEVERITY):
      - Empty/whitespace-only ``gloss_en`` → passed=False, severity="fail"
        (whitespace-reject; triggers regenerate ×2 path).
      - Non-empty ``gloss_en`` not found in glosses → passed=False, severity="warn"
        (flag only; does NOT trigger regeneration).
      - ``gloss_en`` found in glosses → passed=True, severity="pass".

    Args:
        gloss_en:           The EN gloss produced by the generator.
        wiktionary_glosses: Semicolon-separated Wiktionary glosses string,
                            or None if no Wiktionary evidence was retrieved.

    Returns:
        GateResult with gate="gloss_subset".
    """
    stripped_gloss = gloss_en.strip()

    if not stripped_gloss:
        return GateResult(
            passed=False,
            severity="fail",
            gate="gloss_subset",
            offending=[],
            reason="gloss is empty or whitespace-only",
        )

    glosses_str = wiktionary_glosses or ""
    gloss_set = {entry.strip() for entry in glosses_str.split(";") if entry.strip()}

    if stripped_gloss in gloss_set:
        return GateResult(
            passed=True,
            severity="pass",
            gate="gloss_subset",
            offending=[],
            reason=None,
        )

    return GateResult(
        passed=False,
        severity="warn",
        gate="gloss_subset",
        offending=[],
        reason=f"gloss '{stripped_gloss}' not found in Wiktionary glosses",
    )
