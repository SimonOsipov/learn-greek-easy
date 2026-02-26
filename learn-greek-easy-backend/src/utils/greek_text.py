"""Greek text utilities for searchable forms and accent normalization.

This module provides:
- Accent normalization for Greek text (stripping tonos and dialytika)
- Searchable form extraction from enriched grammar data
- Normalized form generation for search optimization

These utilities support the grammar card enrichment system by generating
searchable word forms that allow users to find vocabulary cards regardless
of case form or accent placement.

Usage:
    from src.utils.greek_text import (
        normalize_greek_accents,
        extract_searchable_forms,
        generate_normalized_forms,
    )

    # Normalize Greek text (strip accents)
    normalized = normalize_greek_accents("καλημέρα")
    # Result: "καλημερα"

    # Extract searchable forms from enriched grammar data
    forms = extract_searchable_forms(enriched_data, "νερό")
    # Result: ["νερά", "νερό", "νερού", "νερών"]

    # Generate normalized versions for accent-insensitive search
    normalized_forms = generate_normalized_forms(forms)
    # Result: ["νερα", "νερο", "νερου", "νερων"]
"""

# ============================================================================
# Greek Article Patterns
# ============================================================================

# Greek definite articles to strip from noun forms
# Includes all case/number/gender variations
GREEK_ARTICLES = {
    "ο ",  # masculine nominative singular
    "η ",  # feminine nominative singular
    "το ",  # neuter nominative singular
    "τον ",  # masculine accusative singular
    "την ",  # feminine accusative singular
    "του ",  # masculine/neuter genitive singular
    "της ",  # feminine genitive singular
    "τους ",  # masculine accusative plural
    "τις ",  # feminine accusative plural
    "τα ",  # neuter nominative/accusative plural
    "των ",  # genitive plural (all genders)
    "οι ",  # masculine/feminine nominative plural
}

# ============================================================================
# Accent Mapping
# ============================================================================

# Mapping of accented Greek characters to unaccented equivalents
# Covers tonos (acute accent) and dialytika (diaeresis)
ACCENT_MAP = {
    # Lowercase with tonos
    "ά": "α",
    "έ": "ε",
    "ή": "η",
    "ί": "ι",
    "ό": "ο",
    "ύ": "υ",
    "ώ": "ω",
    # Uppercase with tonos
    "Ά": "Α",
    "Έ": "Ε",
    "Ή": "Η",
    "Ί": "Ι",
    "Ό": "Ο",
    "Ύ": "Υ",
    "Ώ": "Ω",
    # Lowercase with dialytika
    "ϊ": "ι",
    "ϋ": "υ",
    # Lowercase with dialytika and tonos
    "ΐ": "ι",
    "ΰ": "υ",
    # Uppercase with dialytika
    "Ϊ": "Ι",
    "Ϋ": "Υ",
}


# ============================================================================
# Accent Normalization
# ============================================================================


def normalize_greek_accents(text: str) -> str:
    """Remove Greek accent marks (tonos) and dialytika from text.

    Converts accented Greek vowels to their unaccented equivalents:
    - Tonos (acute accent): ά→α, έ→ε, ή→η, ί→ι, ό→ο, ύ→υ, ώ→ω
    - Dialytika (diaeresis): ϊ→ι, ϋ→υ
    - Combined tonos+dialytika: ΐ→ι, ΰ→υ

    This enables accent-insensitive search by normalizing both the
    search query and stored word forms.

    Args:
        text: Greek text with potential accent marks.

    Returns:
        Text with all Greek accent marks removed.
        Non-Greek characters and unaccented Greek characters pass through unchanged.

    Examples:
        >>> normalize_greek_accents("καλημέρα")
        'καλημερα'

        >>> normalize_greek_accents("ευχαριστώ")
        'ευχαριστω'

        >>> normalize_greek_accents("άέήίόύώ")
        'αεηιουω'

        >>> normalize_greek_accents("ϊ ϋ ΐ ΰ")
        'ι υ ι υ'

        >>> normalize_greek_accents("")
        ''
    """
    result = []
    for char in text:
        result.append(ACCENT_MAP.get(char, char))
    return "".join(result)


# ============================================================================
# Internal Helper Functions
# ============================================================================


def _strip_article(form: str) -> str:
    """Strip Greek definite article from a noun form.

    Args:
        form: Noun form potentially prefixed with definite article.

    Returns:
        Form with article removed, or original form if no article found.
    """
    for article in GREEK_ARTICLES:
        if form.startswith(article):
            return form[len(article) :]
    return form


def _strip_verb_prefix(form: str) -> str:
    """Strip future and perfect tense prefixes from verb forms.

    Removes:
    - Future prefix: "θα " (will)
    - Perfect prefixes: "έχω ", "έχεις ", "έχει ", etc. (have + participle)

    Args:
        form: Verb form potentially prefixed with tense marker.

    Returns:
        Form with prefix removed, or original form if no prefix found.
    """
    # Strip future prefix
    if form.startswith("θα "):
        return form[3:]

    # Strip perfect tense prefixes (έχω + participle)
    perfect_prefixes = [
        "έχω ",
        "έχεις ",
        "έχει ",
        "έχουμε ",
        "έχετε ",
        "έχουν ",
    ]
    for prefix in perfect_prefixes:
        if form.startswith(prefix):
            return form[len(prefix) :]

    return form


def _strip_comparative_prefix(form: str) -> str:
    """Strip comparative/superlative prefixes from adjective/adverb forms.

    Removes:
    - Comparative prefix: "πιο " (more)
    - Superlative prefix: "ο πιο " (the most)

    Args:
        form: Adjective or adverb form potentially prefixed with comparison marker.

    Returns:
        Form with prefix removed, or original form if no prefix found.
    """
    if form.startswith("ο πιο "):
        return form[6:]
    if form.startswith("πιο "):
        return form[4:]
    return form


# ============================================================================
# Searchable Form Extraction
# ============================================================================


def _extract_noun_forms(noun_data: dict, forms: set[str]) -> None:
    """Extract noun forms, stripping articles."""
    for key, value in noun_data.items():
        if key != "gender" and value:
            stripped = _strip_article(value)
            if stripped:
                forms.add(stripped)


def _extract_verb_forms(verb_data: dict, forms: set[str]) -> None:
    """Extract verb forms, stripping tense prefixes."""
    for key, value in verb_data.items():
        if key != "voice" and value:
            stripped = _strip_verb_prefix(value)
            if stripped:
                forms.add(stripped)


def _extract_adjective_forms(adj_data: dict, forms: set[str]) -> None:
    """Extract adjective forms, stripping comparison prefixes."""
    for value in adj_data.values():
        if value:
            stripped = _strip_comparative_prefix(value)
            if stripped:
                forms.add(stripped)


def _extract_adverb_forms(adv_data: dict, forms: set[str]) -> None:
    """Extract adverb forms, stripping comparison prefixes."""
    for value in adv_data.values():
        if value:
            stripped = _strip_comparative_prefix(value)
            if stripped:
                forms.add(stripped)


def extract_searchable_forms(enriched_data: dict, front_text: str) -> list[str]:
    """Extract all searchable word forms from enriched grammar data.

    Processes grammar data for nouns, verbs, adjectives, and adverbs to
    extract all inflected forms suitable for search indexing. Strips
    articles and tense prefixes to isolate the core word forms.

    Processing by part of speech:
    - Nouns: Extract all 8 case forms (nom/gen/acc/voc x sing/plural),
      strip definite articles (ο/η/το/etc.)
    - Verbs: Extract all conjugation forms, strip "θα " future prefix
      and "έχω/έχεις/etc." perfect prefixes
    - Adjectives: Extract all 24 declension forms plus comparatives,
      strip "πιο " and "ο πιο " comparison prefixes
    - Adverbs: Extract base, comparative, and superlative forms,
      strip comparison prefixes

    Args:
        enriched_data: Dictionary containing grammar data with keys like
            "noun_data", "verb_data", "adjective_data", or "adverb_data".
        front_text: The main vocabulary word (always included in results).

    Returns:
        Sorted list of unique non-empty searchable forms.
        Always includes front_text.

    Examples:
        >>> noun_data = {
        ...     "noun_data": {
        ...         "gender": "neuter",
        ...         "nominative_singular": "το νερό",
        ...         "genitive_singular": "του νερού",
        ...     }
        ... }
        >>> extract_searchable_forms(noun_data, "νερό")
        ['νερό', 'νερού']

        >>> verb_data = {
        ...     "verb_data": {
        ...         "present_1s": "θέλω",
        ...         "future_1s": "θα θελήσω",
        ...     }
        ... }
        >>> extract_searchable_forms(verb_data, "θέλω")
        ['θέλω', 'θελήσω']

        >>> extract_searchable_forms({}, "γεια")
        ['γεια']
    """
    forms: set[str] = {front_text}

    if "noun_data" in enriched_data:
        _extract_noun_forms(enriched_data["noun_data"], forms)

    if "verb_data" in enriched_data:
        _extract_verb_forms(enriched_data["verb_data"], forms)

    if "adjective_data" in enriched_data:
        _extract_adjective_forms(enriched_data["adjective_data"], forms)

    if "adverb_data" in enriched_data:
        _extract_adverb_forms(enriched_data["adverb_data"], forms)

    return sorted(forms)


# ============================================================================
# Normalized Form Generation
# ============================================================================


def generate_normalized_forms(forms: list[str]) -> list[str]:
    """Generate accent-normalized versions of all word forms.

    Applies accent normalization to each form to enable accent-insensitive
    search. Users can search for Greek words without worrying about
    correct accent placement.

    Args:
        forms: List of Greek word forms (may contain accents).

    Returns:
        Sorted list of unique normalized forms (accents stripped).

    Examples:
        >>> generate_normalized_forms(["νερό", "νερού", "νερά"])
        ['νερα', 'νερο', 'νερου']

        >>> generate_normalized_forms(["νερό", "νερο"])  # Duplicates after normalization
        ['νερο']

        >>> generate_normalized_forms([])
        []
    """
    normalized: set[str] = set()
    for form in forms:
        norm = normalize_greek_accents(form)
        if norm:
            normalized.add(norm)
    return sorted(normalized)


# ============================================================================
# TTS Text Resolution
# ============================================================================

# Gender-to-article mapping for TTS text resolution
GENDER_TO_ARTICLE: dict[str, str] = {
    "masculine": "ο ",
    "feminine": "η ",
    "neuter": "το ",
}


def resolve_tts_text(lemma: str, part_of_speech: str, grammar_data: dict | None) -> str:
    """Resolve the text to send to ElevenLabs TTS for a word entry.

    Returns the article-prepended form for nouns and adjectives, or the bare
    lemma for verbs, adverbs, phrases, and any unrecognised part of speech.

    Resolution logic:
    - Nouns: Use grammar_data.cases.singular.nominative if present (already
      includes the article, e.g. "το νερό"), else fall back to the gender-inferred
      article from GENDER_TO_ARTICLE prepended to the lemma, else bare lemma.
    - Adjectives: Use "ο " + grammar_data.forms.masculine.singular.nominative
      if present, else bare lemma.
    - Verbs, adverbs, phrases (and unrecognised parts): bare lemma.

    Args:
        lemma: The base word form (e.g. "νερό", "καλός", "τρέχω").
        part_of_speech: String value of the part of speech -- "noun", "verb",
            "adjective", "adverb", or "phrase". Use the string value, not the
            enum, to keep this function decoupled from SQLAlchemy models.
        grammar_data: The JSON grammar_data blob from the word entry, or None.

    Returns:
        Text string to send to the TTS service.

    Examples:
        >>> resolve_tts_text("νερό", "noun", {"cases": {"singular": {"nominative": "το νερό"}}})
        'το νερό'

        >>> resolve_tts_text("τράπεζα", "noun", {"gender": "feminine"})
        'η τράπεζα'

        >>> resolve_tts_text("τρέχω", "verb", None)
        'τρέχω'
    """
    if not isinstance(grammar_data, dict):
        return lemma

    if part_of_speech == "noun":
        nominative: str = grammar_data.get("cases", {}).get("singular", {}).get("nominative") or ""
        if nominative:
            return nominative
        gender: str = grammar_data.get("gender") or ""
        if gender in GENDER_TO_ARTICLE:
            return GENDER_TO_ARTICLE[gender] + lemma
        return lemma

    if part_of_speech == "adjective":
        masc_nominative: str = (
            grammar_data.get("forms", {}).get("masculine", {}).get("singular", {}).get("nominative")
            or ""
        )
        if masc_nominative:
            return "ο " + masc_nominative
        return lemma

    return lemma
