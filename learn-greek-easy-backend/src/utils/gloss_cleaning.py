"""Gloss string normalization for Wiktionary and FreeDict ETL.

Cleans raw gloss strings by removing cross-references, obsolete entries,
and parenthetical qualifiers that don't belong in translated definitions.

Examples:
    >>> clean_gloss("eagle")
    'eagle'
    >>> clean_gloss("Alternative form of aquila")
    >>> clean_gloss("(bird) eagle")
    'eagle'
    >>> clean_gloss("kite (toy)")
    'kite'
    >>> clean_gloss("(obsolete) archaic word")
"""

import re

# ============================================================================
# Cross-reference patterns
# ============================================================================

_CROSS_REFERENCE_RE = re.compile(
    r"^(Alternative|Synonym|plural|diminutive|augmentative|feminine|masculine|neuter|comparative|superlative)\s+(form\s+|of\s+)",
    re.IGNORECASE,
)

_SKIP_QUALIFIERS = ("(obsolete)", "(archaic)")


# ============================================================================
# Public API
# ============================================================================


def is_cross_reference(raw: str) -> bool:
    """Return True if raw matches a cross-reference pattern.

    Args:
        raw: Raw gloss string from Wiktionary or FreeDict.

    Returns:
        True if the string is a cross-reference (e.g., "plural of X"), False otherwise.

    Examples:
        >>> is_cross_reference("plural of cat")
        True
        >>> is_cross_reference("eagle")
        False
    """
    return bool(_CROSS_REFERENCE_RE.match(raw))


def clean_gloss(raw: str) -> str | None:
    """Clean a raw gloss string for use in translation data.

    Applies the following pipeline in order:
    1. Return None for empty or whitespace-only strings.
    2. Return None for cross-references (e.g., "plural of X").
    3. Return None for obsolete/archaic qualifiers.
    4. Strip leading parenthetical qualifier.
    5. Strip trailing parenthetical qualifier.
    6. Strip surrounding whitespace.
    7. Return None if result is empty, else return cleaned string.

    Args:
        raw: Raw gloss string from Wiktionary or FreeDict source data.

    Returns:
        Cleaned gloss string, or None if the gloss should be skipped.

    Examples:
        >>> clean_gloss("eagle")
        'eagle'
        >>> clean_gloss("(bird) eagle")
        'eagle'
        >>> clean_gloss("kite (toy)")
        'kite'
        >>> clean_gloss("Alternative form of aquila")
        >>> clean_gloss("(obsolete) old word")
        >>> clean_gloss("")
    """
    if not raw or not raw.strip():
        return None

    if is_cross_reference(raw):
        return None

    raw_lower = raw.lower()
    for qualifier in _SKIP_QUALIFIERS:
        if raw_lower.startswith(qualifier):
            return None

    result = re.sub(r"^\([^)]*\)\s*", "", raw)
    result = re.sub(r"\s*\([^)]*\)$", "", result)
    result = result.strip()

    return result if result else None
