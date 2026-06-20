"""Curated closed-class (function-word) whitelist for the CEFR lemma reference.

LEXGEN-04-02. This module ships a small, **hand-curated** list of modern Greek
closed-class lemmas — articles, prepositions, pronouns, and common conjunctions /
particles — together with a pure row-builder that the 04-03 loader consumes.

Why this lives here (and not under ``data/``):
    The gitignored ``data/`` directory holds license-restricted external corpora
    (e.g. the Greek lexicon, ΚΕΓ glossaries, frequency data) that must NOT be
    committed (AC-INV-4 / AC-19). These ~150 function words, by contrast, are
    **our own** small, explicit, hand-curated list — so they are committed here,
    under ``src/scripts/``, in version control like any other source constant.

Why these bypass attestation (AC-15):
    The CEFR loader normally attests open-class candidate lemmas against
    ``greek_lexicon`` / ``wiktionary_morphology`` before admitting them. Closed-class
    function words (articles, prepositions, pronouns, conjunctions) are a finite,
    well-known set that need not be attested as nouns/verbs — they are forced in at
    ``level = "A1"`` with ``closed_class = True`` and ``source = "closed_class"``.
    ``build_closed_class_rows()`` is therefore a pure function: it takes no DB
    connection and never calls any normalization or attestation helper. The 04-03
    loader inserts its rows directly, bypassing the attestation gate.

Not LLM-generated (AC-INV-3 / AC-19): every lemma below was selected by hand from
standard modern Greek (monotonic) closed-class inventories.
"""

# ---------------------------------------------------------------------------
# The curated whitelist.
#
# All lemmas are lowercase, monotonic Greek script, and deduped. Grouped by class
# for readability only — at runtime the four groups are concatenated into one flat,
# order-irrelevant whitelist. Set-membership (not ordering) is what the gate uses.
# ---------------------------------------------------------------------------

# Articles — definite (all cases/numbers/genders) + indefinite + article+σε crasis.
_ARTICLES: tuple[str, ...] = (
    # definite article
    "ο",
    "η",
    "το",
    "οι",
    "τα",
    "τον",
    "την",
    "τη",
    "του",
    "της",
    "των",
    "τους",
    "τις",
    # σε + definite article (στον/στην/στο… crasis — extremely high-frequency)
    "στον",
    "στην",
    "στη",
    "στο",
    "στους",
    "στις",
    "στα",
    # indefinite article
    "ένας",
    "έναν",
    "ένα",
    "μια",
    "μία",
    "ενός",
    "μιας",
)

# Prepositions — simple + common compound/adverbial prepositions.
_PREPOSITIONS: tuple[str, ...] = (
    "σε",
    "με",
    "για",
    "από",
    "προς",
    "χωρίς",
    "δίχως",
    "μετά",
    "πριν",
    "κατά",
    "παρά",
    "αντί",
    "ως",
    "έως",
    "μέχρι",
    "μέσα",
    "έξω",
    "πάνω",
    "κάτω",
    "μπροστά",
    "πίσω",
    "δίπλα",
    "κοντά",
    "μακριά",
    "ανάμεσα",
    "μεταξύ",
    "γύρω",
    "εκτός",
    "εντός",
    "υπέρ",
    "ενάντια",
    "σύμφωνα",
    "λόγω",
    "ένεκα",
    "πλάι",
    "απέναντι",
)

# Pronouns — personal, possessive/clitic, demonstrative, relative, interrogative,
# indefinite. (Clitics such as μου/σου/του/της overlap with article/preposition
# spellings; the set dedupes them.)
_PRONOUNS: tuple[str, ...] = (
    # strong personal (nominative)
    "εγώ",
    "εσύ",
    "αυτός",
    "αυτή",
    "αυτό",
    "εμείς",
    "εσείς",
    "αυτοί",
    "αυτές",
    "αυτά",
    # strong personal (oblique)
    "εμένα",
    "εσένα",
    "αυτόν",
    "αυτήν",
    "εμάς",
    "εσάς",
    "αυτών",
    "αυτούς",
    # weak / clitic & possessive
    "μου",
    "σου",
    "μας",
    "σας",
    "τη",
    "σε",
    # demonstrative
    "εκείνος",
    "εκείνη",
    "εκείνο",
    "εκείνοι",
    "εκείνες",
    "εκείνα",
    "τέτοιος",
    "τόσος",
    # relative / interrogative
    "που",
    "οποίος",
    "όποιος",
    "όσος",
    "ποιος",
    "ποια",
    "ποιο",
    "ποιοι",
    "ποιες",
    "πόσος",
    "πόσο",
    "τι",
    # indefinite
    "κάποιος",
    "κάποια",
    "κάποιο",
    "κάτι",
    "κανείς",
    "κανένας",
    "καμία",
    "κανένα",
    "τίποτα",
    "τίποτε",
    "όλος",
    "όλη",
    "όλο",
    "όλοι",
    "όλες",
    "όλα",
    "άλλος",
    "άλλη",
    "άλλο",
    "μερικοί",
    "καθένας",
)

# Conjunctions and common particles (negation, future/subjunctive, modal, answer).
_CONJUNCTIONS_AND_PARTICLES: tuple[str, ...] = (
    # coordinating
    "και",
    "κι",
    "ή",
    "αλλά",
    "όμως",
    "ωστόσο",
    "ούτε",
    "είτε",
    "μήτε",
    "παρά",
    # subordinating
    "ότι",
    "πως",
    "να",
    "αν",
    "όταν",
    "γιατί",
    "διότι",
    "επειδή",
    "ενώ",
    "καθώς",
    "αφού",
    "ώστε",
    "μήπως",
    "εάν",
    "σαν",
    "μόλις",
    "προτού",
    "εφόσον",
    # discourse / linking particles
    "μα",
    "λοιπόν",
    "δηλαδή",
    "άρα",
    "επομένως",
    "βέβαια",
    "ίσως",
    "μάλιστα",
    # negation / mood / future particles
    "δεν",
    "δε",
    "μην",
    "μη",
    "θα",
    "ας",
    "να",
    # answer particles
    "ναι",
    "όχι",
)


def _dedupe_preserving_order(*groups: tuple[str, ...]) -> list[str]:
    """Concatenate the class groups and drop duplicates, keeping first appearance.

    Several function words legitimately belong to more than one class (e.g. ``σε``
    is both a preposition and a weak personal pronoun; ``να`` is both a conjunction
    and a subjunctive particle; ``παρά`` is preposition + conjunction). The
    whitelist is a *set* of lemmas, so each surface form appears exactly once.
    """
    seen: set[str] = set()
    out: list[str] = []
    for group in groups:
        for lemma in group:
            if lemma not in seen:
                seen.add(lemma)
                out.append(lemma)
    return out


#: The curated, deduped, lowercase, Greek-script closed-class whitelist.
CLOSED_CLASS_LEMMAS: list[str] = _dedupe_preserving_order(
    _ARTICLES,
    _PREPOSITIONS,
    _PRONOUNS,
    _CONJUNCTIONS_AND_PARTICLES,
)

#: The single CEFR introduction level assigned to every closed-class function word.
CLOSED_CLASS_LEVEL = "A1"

#: The provenance tag written to ``reference.cefr_lemma.source`` for these rows.
CLOSED_CLASS_SOURCE = "closed_class"


def build_closed_class_rows() -> list[dict[str, object]]:
    """Build one CEFR-lemma row per closed-class whitelist lemma.

    Pure function — takes no arguments, opens no DB connection, and performs no
    normalization or attestation (AC-15): closed-class words are forced in as-is.
    The 04-03 loader inserts these rows directly into ``reference.cefr_lemma``.

    Returns:
        A list of dicts, one per lemma in :data:`CLOSED_CLASS_LEMMAS`, each with
        keys ``lemma`` / ``level`` / ``closed_class`` / ``source`` — matching the
        ``reference.cefr_lemma`` columns. Every row is forced to
        ``level="A1"``, ``closed_class=True``, ``source="closed_class"``.
    """
    return [
        {
            "lemma": lemma,
            "level": CLOSED_CLASS_LEVEL,
            "closed_class": True,
            "source": CLOSED_CLASS_SOURCE,
        }
        for lemma in CLOSED_CLASS_LEMMAS
    ]
