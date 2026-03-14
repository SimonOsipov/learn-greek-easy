"""Greek article and gender mapping constants for reverse lookup and verification.

These constants map spaCy gender morph codes (Masc/Fem/Neut) to Greek articles
organized by case and number. They are used by:
- LocalVerificationService (verification pipeline)
- ReverseLookupService (reverse translation lookup)
"""

NOMINATIVE_ARTICLES: dict[str, dict[str, str]] = {
    "masculine": {"singular": "ο ", "plural": "οι "},
    "feminine": {"singular": "η ", "plural": "οι "},
    "neuter": {"singular": "το ", "plural": "τα "},
}

GENITIVE_ARTICLES: dict[str, dict[str, str]] = {
    "masculine": {"singular": "του ", "plural": "των "},
    "feminine": {"singular": "της ", "plural": "των "},
    "neuter": {"singular": "του ", "plural": "των "},
}

ACCUSATIVE_ARTICLES: dict[str, dict[str, str]] = {
    "masculine": {"singular": "τον ", "plural": "τους "},
    "feminine": {"singular": "την ", "plural": "τις "},
    "neuter": {"singular": "το ", "plural": "τα "},
}

GENDER_MAP: dict[str, str] = {
    "Masc": "masculine",
    "Fem": "feminine",
    "Neut": "neuter",
}

ARTICLE_MAP: dict[str, dict[str, dict[str, str]]] = {
    "nominative": NOMINATIVE_ARTICLES,
    "genitive": GENITIVE_ARTICLES,
    "accusative": ACCUSATIVE_ARTICLES,
}


def get_nominative_article(gender_code: str) -> str | None:
    """Return nominative singular article for a spaCy gender code (Masc/Fem/Neut).

    Returns the article WITH trailing space (e.g., "ο ", "η ", "το ") since
    articles are used as prefixes in string operations.

    Returns None for unknown or empty gender codes.
    """
    gender = GENDER_MAP.get(gender_code)
    if gender is None:
        return None
    return NOMINATIVE_ARTICLES[gender]["singular"]
