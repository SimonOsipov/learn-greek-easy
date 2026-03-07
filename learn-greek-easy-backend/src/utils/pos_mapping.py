"""Part-of-speech tag mapping for dictionary ETL pipeline.

Maps raw POS tags from Kaikki (Wiktionary) and FreeDict sources to
Universal POS (UPOS) tags used throughout the application.

Examples:
    >>> map_pos("noun")
    'NOUN'
    >>> map_pos("adj")
    'ADJ'
    >>> map_pos("n", source="freedict")
    'NOUN'
    >>> map_pos("unknown_thing")
    'X'
"""

# ============================================================================
# Kaikki (Wiktionary) POS mapping
# ============================================================================

KAIKKI_TO_UPOS: dict[str, str] = {
    "noun": "NOUN",
    "adj": "ADJ",
    "verb": "VERB",
    "adv": "ADV",
    "name": "PROPN",
    "num": "NUM",
    "pron": "PRON",
    "conj": "CCONJ",
    "prep": "ADP",
    "particle": "PART",
    "intj": "INTJ",
    "phrase": "PHRASE",
    "article": "DET",
    "character": "X",
    "symbol": "X",
    "punct": "X",
}

# ============================================================================
# FreeDict POS mapping
# ============================================================================

FREEDICT_TO_UPOS: dict[str, str] = {
    "n": "NOUN",
    "adj": "ADJ",
    "v": "VERB",
    "adv": "ADV",
    "pron": "PRON",
    "conj": "CCONJ",
    "prep": "ADP",
    "interj": "INTJ",
    "art": "DET",
    "num": "NUM",
    "part": "PART",
}


# ============================================================================
# Public API
# ============================================================================


def map_pos(raw_pos: str, source: str = "kaikki") -> str:
    """Map a raw part-of-speech tag to a UPOS tag.

    Args:
        raw_pos: Raw POS tag from the source data. Case-insensitive.
        source: Data source identifier. One of "kaikki" or "freedict".
                Defaults to "kaikki".

    Returns:
        UPOS tag string (e.g., "NOUN", "VERB"), or "X" for unknown values.

    Examples:
        >>> map_pos("noun")
        'NOUN'
        >>> map_pos("n", source="freedict")
        'NOUN'
        >>> map_pos("unknown_tag")
        'X'
        >>> map_pos("NOUN")
        'NOUN'
    """
    normalized = raw_pos.lower()
    mapping = KAIKKI_TO_UPOS if source == "kaikki" else FREEDICT_TO_UPOS
    return mapping.get(normalized, "X")
