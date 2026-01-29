"""Grammar data for enriched vocabulary seed data.

This module contains TypedDict definitions that match the Pydantic schemas in card.py,
along with the ENRICHED_VOCABULARY dictionary that will be populated with grammar data
for all 60 vocabulary words across CEFR levels A1-C2.
"""

from typing import NotRequired, TypedDict

# ============================================================================
# TypedDict Definitions (matching Pydantic schemas in card.py)
# ============================================================================


class NounDataDict(TypedDict, total=False):
    """Noun grammar data with gender and case forms."""

    gender: str  # Required: "masculine" | "feminine" | "neuter"
    nominative_singular: str
    genitive_singular: str
    accusative_singular: str
    vocative_singular: str
    nominative_plural: str
    genitive_plural: str
    accusative_plural: str
    vocative_plural: str


class VerbDataDict(TypedDict, total=False):
    """Verb grammar data with voice and conjugations."""

    voice: str  # Required: "active" | "passive"
    # Present tense
    present_1s: str
    present_2s: str
    present_3s: str
    present_1p: str
    present_2p: str
    present_3p: str
    # Imperfect tense
    imperfect_1s: str
    imperfect_2s: str
    imperfect_3s: str
    imperfect_1p: str
    imperfect_2p: str
    imperfect_3p: str
    # Past (aorist) tense
    past_1s: str
    past_2s: str
    past_3s: str
    past_1p: str
    past_2p: str
    past_3p: str
    # Future tense
    future_1s: str
    future_2s: str
    future_3s: str
    future_1p: str
    future_2p: str
    future_3p: str
    # Perfect tense
    perfect_1s: str
    perfect_2s: str
    perfect_3s: str
    perfect_1p: str
    perfect_2p: str
    perfect_3p: str
    # Imperative
    imperative_2s: str
    imperative_2p: str


class AdjectiveDataDict(TypedDict, total=False):
    """Adjective grammar data with declensions and comparison forms."""

    # Masculine forms
    masculine_nom_sg: str
    masculine_gen_sg: str
    masculine_acc_sg: str
    masculine_voc_sg: str
    masculine_nom_pl: str
    masculine_gen_pl: str
    masculine_acc_pl: str
    masculine_voc_pl: str
    # Feminine forms
    feminine_nom_sg: str
    feminine_gen_sg: str
    feminine_acc_sg: str
    feminine_voc_sg: str
    feminine_nom_pl: str
    feminine_gen_pl: str
    feminine_acc_pl: str
    feminine_voc_pl: str
    # Neuter forms
    neuter_nom_sg: str
    neuter_gen_sg: str
    neuter_acc_sg: str
    neuter_voc_sg: str
    neuter_nom_pl: str
    neuter_gen_pl: str
    neuter_acc_pl: str
    neuter_voc_pl: str
    # Comparison forms
    comparative: str
    superlative: str


class AdverbDataDict(TypedDict, total=False):
    """Adverb grammar data with comparison forms."""

    comparative: str
    superlative: str


class ExampleDict(TypedDict):
    """Structured example for a vocabulary card."""

    greek: str  # Required
    english: NotRequired[str]
    russian: NotRequired[str]
    tense: NotRequired[str]


class EnrichedWordData(TypedDict, total=False):
    """Enriched grammar data for a vocabulary word."""

    noun_data: NounDataDict
    verb_data: VerbDataDict
    adjective_data: AdjectiveDataDict
    adverb_data: AdverbDataDict
    examples: list[ExampleDict]
    searchable_forms: list[str]
    searchable_forms_normalized: list[str]
    back_text_ru: str


# ============================================================================
# Enriched Vocabulary Data
# ============================================================================
# Dictionary keyed by Greek word (front_text) with grammar data.
# All 60 words from CEFR levels A1-C2 are included as placeholders.
# Data will be populated in subsequent tasks.

ENRICHED_VOCABULARY: dict[str, EnrichedWordData] = {
    # ========================================================================
    # A1 Level (10 words) - Basic greetings and essentials
    # ========================================================================
    "γεια": {},  # interjection
    "ναι": {},  # interjection
    "όχι": {},  # interjection
    "ευχαριστώ": {
        "verb_data": {
            "voice": "active",
            "present_1s": "ευχαριστώ",
            "present_2s": "ευχαριστείς",
            "present_3s": "ευχαριστεί",
            "present_1p": "ευχαριστούμε",
            "present_2p": "ευχαριστείτε",
            "present_3p": "ευχαριστούν",
            "imperfect_1s": "ευχαριστούσα",
            "imperfect_2s": "ευχαριστούσες",
            "imperfect_3s": "ευχαριστούσε",
            "imperfect_1p": "ευχαριστούσαμε",
            "imperfect_2p": "ευχαριστούσατε",
            "imperfect_3p": "ευχαριστούσαν",
            "past_1s": "ευχαρίστησα",
            "past_2s": "ευχαρίστησες",
            "past_3s": "ευχαρίστησε",
            "past_1p": "ευχαριστήσαμε",
            "past_2p": "ευχαριστήσατε",
            "past_3p": "ευχαρίστησαν",
            "future_1s": "θα ευχαριστήσω",
            "future_2s": "θα ευχαριστήσεις",
            "future_3s": "θα ευχαριστήσει",
            "future_1p": "θα ευχαριστήσουμε",
            "future_2p": "θα ευχαριστήσετε",
            "future_3p": "θα ευχαριστήσουν",
            "perfect_1s": "έχω ευχαριστήσει",
            "perfect_2s": "έχεις ευχαριστήσει",
            "perfect_3s": "έχει ευχαριστήσει",
            "perfect_1p": "έχουμε ευχαριστήσει",
            "perfect_2p": "έχετε ευχαριστήσει",
            "perfect_3p": "έχουν ευχαριστήσει",
            "imperative_2s": "ευχαρίστησε",
            "imperative_2p": "ευχαριστήστε",
        },
    },  # verb
    "παρακαλώ": {
        "verb_data": {
            "voice": "active",
            "present_1s": "παρακαλώ",
            "present_2s": "παρακαλείς",
            "present_3s": "παρακαλεί",
            "present_1p": "παρακαλούμε",
            "present_2p": "παρακαλείτε",
            "present_3p": "παρακαλούν",
            "imperfect_1s": "παρακαλούσα",
            "imperfect_2s": "παρακαλούσες",
            "imperfect_3s": "παρακαλούσε",
            "imperfect_1p": "παρακαλούσαμε",
            "imperfect_2p": "παρακαλούσατε",
            "imperfect_3p": "παρακαλούσαν",
            "past_1s": "παρακάλεσα",
            "past_2s": "παρακάλεσες",
            "past_3s": "παρακάλεσε",
            "past_1p": "παρακαλέσαμε",
            "past_2p": "παρακαλέσατε",
            "past_3p": "παρακάλεσαν",
            "future_1s": "θα παρακαλέσω",
            "future_2s": "θα παρακαλέσεις",
            "future_3s": "θα παρακαλέσει",
            "future_1p": "θα παρακαλέσουμε",
            "future_2p": "θα παρακαλέσετε",
            "future_3p": "θα παρακαλέσουν",
            "perfect_1s": "έχω παρακαλέσει",
            "perfect_2s": "έχεις παρακαλέσει",
            "perfect_3s": "έχει παρακαλέσει",
            "perfect_1p": "έχουμε παρακαλέσει",
            "perfect_2p": "έχετε παρακαλέσει",
            "perfect_3p": "έχουν παρακαλέσει",
            "imperative_2s": "παρακάλεσε",
            "imperative_2p": "παρακαλέστε",
        },
    },  # verb
    "νερό": {
        "noun_data": {
            "gender": "neuter",
            "nominative_singular": "το νερό",
            "genitive_singular": "του νερού",
            "accusative_singular": "το νερό",
            "vocative_singular": "νερό",
            "nominative_plural": "τα νερά",
            "genitive_plural": "των νερών",
            "accusative_plural": "τα νερά",
            "vocative_plural": "νερά",
        },
    },
    "ψωμί": {
        "noun_data": {
            "gender": "neuter",
            "nominative_singular": "το ψωμί",
            "genitive_singular": "του ψωμιού",
            "accusative_singular": "το ψωμί",
            "vocative_singular": "ψωμί",
            "nominative_plural": "τα ψωμιά",
            "genitive_plural": "των ψωμιών",
            "accusative_plural": "τα ψωμιά",
            "vocative_plural": "ψωμιά",
        },
    },
    "σπίτι": {
        "noun_data": {
            "gender": "neuter",
            "nominative_singular": "το σπίτι",
            "genitive_singular": "του σπιτιού",
            "accusative_singular": "το σπίτι",
            "vocative_singular": "σπίτι",
            "nominative_plural": "τα σπίτια",
            "genitive_plural": "των σπιτιών",
            "accusative_plural": "τα σπίτια",
            "vocative_plural": "σπίτια",
        },
    },
    "καλημέρα": {},  # interjection
    "καληνύχτα": {},  # interjection
    # ========================================================================
    # A2 Level (10 words) - Daily life and common verbs
    # ========================================================================
    "δουλειά": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η δουλειά",
            "genitive_singular": "της δουλειάς",
            "accusative_singular": "τη δουλειά",
            "vocative_singular": "δουλειά",
            "nominative_plural": "οι δουλειές",
            "genitive_plural": "των δουλειών",
            "accusative_plural": "τις δουλειές",
            "vocative_plural": "δουλειές",
        },
    },
    "οικογένεια": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η οικογένεια",
            "genitive_singular": "της οικογένειας",
            "accusative_singular": "την οικογένεια",
            "vocative_singular": "οικογένεια",
            "nominative_plural": "οι οικογένειες",
            "genitive_plural": "των οικογενειών",
            "accusative_plural": "τις οικογένειες",
            "vocative_plural": "οικογένειες",
        },
    },
    "φίλος": {
        "noun_data": {
            "gender": "masculine",
            "nominative_singular": "ο φίλος",
            "genitive_singular": "του φίλου",
            "accusative_singular": "τον φίλο",
            "vocative_singular": "φίλε",
            "nominative_plural": "οι φίλοι",
            "genitive_plural": "των φίλων",
            "accusative_plural": "τους φίλους",
            "vocative_plural": "φίλοι",
        },
    },
    "αγαπώ": {
        "verb_data": {
            "voice": "active",
            "present_1s": "αγαπώ",
            "present_2s": "αγαπάς",
            "present_3s": "αγαπά",
            "present_1p": "αγαπάμε",
            "present_2p": "αγαπάτε",
            "present_3p": "αγαπούν",
            "imperfect_1s": "αγαπούσα",
            "imperfect_2s": "αγαπούσες",
            "imperfect_3s": "αγαπούσε",
            "imperfect_1p": "αγαπούσαμε",
            "imperfect_2p": "αγαπούσατε",
            "imperfect_3p": "αγαπούσαν",
            "past_1s": "αγάπησα",
            "past_2s": "αγάπησες",
            "past_3s": "αγάπησε",
            "past_1p": "αγαπήσαμε",
            "past_2p": "αγαπήσατε",
            "past_3p": "αγάπησαν",
            "future_1s": "θα αγαπήσω",
            "future_2s": "θα αγαπήσεις",
            "future_3s": "θα αγαπήσει",
            "future_1p": "θα αγαπήσουμε",
            "future_2p": "θα αγαπήσετε",
            "future_3p": "θα αγαπήσουν",
            "perfect_1s": "έχω αγαπήσει",
            "perfect_2s": "έχεις αγαπήσει",
            "perfect_3s": "έχει αγαπήσει",
            "perfect_1p": "έχουμε αγαπήσει",
            "perfect_2p": "έχετε αγαπήσει",
            "perfect_3p": "έχουν αγαπήσει",
            "imperative_2s": "αγάπα",
            "imperative_2p": "αγαπάτε",
        },
    },  # verb
    "θέλω": {
        "verb_data": {
            "voice": "active",
            "present_1s": "θέλω",
            "present_2s": "θέλεις",
            "present_3s": "θέλει",
            "present_1p": "θέλουμε",
            "present_2p": "θέλετε",
            "present_3p": "θέλουν",
            "imperfect_1s": "ήθελα",
            "imperfect_2s": "ήθελες",
            "imperfect_3s": "ήθελε",
            "imperfect_1p": "θέλαμε",
            "imperfect_2p": "θέλατε",
            "imperfect_3p": "ήθελαν",
            "past_1s": "θέλησα",
            "past_2s": "θέλησες",
            "past_3s": "θέλησε",
            "past_1p": "θελήσαμε",
            "past_2p": "θελήσατε",
            "past_3p": "θέλησαν",
            "future_1s": "θα θελήσω",
            "future_2s": "θα θελήσεις",
            "future_3s": "θα θελήσει",
            "future_1p": "θα θελήσουμε",
            "future_2p": "θα θελήσετε",
            "future_3p": "θα θελήσουν",
            "perfect_1s": "έχω θελήσει",
            "perfect_2s": "έχεις θελήσει",
            "perfect_3s": "έχει θελήσει",
            "perfect_1p": "έχουμε θελήσει",
            "perfect_2p": "έχετε θελήσει",
            "perfect_3p": "έχουν θελήσει",
            "imperative_2s": "",
            "imperative_2p": "",
        },
    },  # verb
    "μπορώ": {
        "verb_data": {
            "voice": "active",
            "present_1s": "μπορώ",
            "present_2s": "μπορείς",
            "present_3s": "μπορεί",
            "present_1p": "μπορούμε",
            "present_2p": "μπορείτε",
            "present_3p": "μπορούν",
            "imperfect_1s": "μπορούσα",
            "imperfect_2s": "μπορούσες",
            "imperfect_3s": "μπορούσε",
            "imperfect_1p": "μπορούσαμε",
            "imperfect_2p": "μπορούσατε",
            "imperfect_3p": "μπορούσαν",
            "past_1s": "μπόρεσα",
            "past_2s": "μπόρεσες",
            "past_3s": "μπόρεσε",
            "past_1p": "μπορέσαμε",
            "past_2p": "μπορέσατε",
            "past_3p": "μπόρεσαν",
            "future_1s": "θα μπορέσω",
            "future_2s": "θα μπορέσεις",
            "future_3s": "θα μπορέσει",
            "future_1p": "θα μπορέσουμε",
            "future_2p": "θα μπορέσετε",
            "future_3p": "θα μπορέσουν",
            "perfect_1s": "έχω μπορέσει",
            "perfect_2s": "έχεις μπορέσει",
            "perfect_3s": "έχει μπορέσει",
            "perfect_1p": "έχουμε μπορέσει",
            "perfect_2p": "έχετε μπορέσει",
            "perfect_3p": "έχουν μπορέσει",
            "imperative_2s": "",
            "imperative_2p": "",
        },
    },  # verb
    "πρέπει": {
        "verb_data": {
            "voice": "active",
            "present_1s": "",
            "present_2s": "",
            "present_3s": "πρέπει",
            "present_1p": "",
            "present_2p": "",
            "present_3p": "",
            "imperfect_1s": "",
            "imperfect_2s": "",
            "imperfect_3s": "έπρεπε",
            "imperfect_1p": "",
            "imperfect_2p": "",
            "imperfect_3p": "",
            "past_1s": "",
            "past_2s": "",
            "past_3s": "",
            "past_1p": "",
            "past_2p": "",
            "past_3p": "",
            "future_1s": "",
            "future_2s": "",
            "future_3s": "θα πρέπει",
            "future_1p": "",
            "future_2p": "",
            "future_3p": "",
            "perfect_1s": "",
            "perfect_2s": "",
            "perfect_3s": "",
            "perfect_1p": "",
            "perfect_2p": "",
            "perfect_3p": "",
            "imperative_2s": "",
            "imperative_2p": "",
        },
    },  # verb (impersonal)
    "χρόνια": {
        "noun_data": {
            "gender": "neuter",
            "nominative_singular": "το χρόνο",
            "genitive_singular": "του χρόνου",
            "accusative_singular": "το χρόνο",
            "vocative_singular": "χρόνο",
            "nominative_plural": "τα χρόνια",
            "genitive_plural": "των χρόνων",
            "accusative_plural": "τα χρόνια",
            "vocative_plural": "χρόνια",
        },
    },
    "σήμερα": {
        "adverb_data": {
            "comparative": "",
            "superlative": "",
        },
    },  # adverb (time - no comparison)
    "αύριο": {
        "adverb_data": {
            "comparative": "",
            "superlative": "",
        },
    },  # adverb (time - no comparison)
    # ========================================================================
    # B1 Level (10 words) - Intermediate concepts
    # ========================================================================
    "συζήτηση": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η συζήτηση",
            "genitive_singular": "της συζήτησης",
            "accusative_singular": "τη συζήτηση",
            "vocative_singular": "συζήτηση",
            "nominative_plural": "οι συζητήσεις",
            "genitive_plural": "των συζητήσεων",
            "accusative_plural": "τις συζητήσεις",
            "vocative_plural": "συζητήσεις",
        },
    },
    "απόφαση": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η απόφαση",
            "genitive_singular": "της απόφασης",
            "accusative_singular": "την απόφαση",
            "vocative_singular": "απόφαση",
            "nominative_plural": "οι αποφάσεις",
            "genitive_plural": "των αποφάσεων",
            "accusative_plural": "τις αποφάσεις",
            "vocative_plural": "αποφάσεις",
        },
    },
    "εμπειρία": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η εμπειρία",
            "genitive_singular": "της εμπειρίας",
            "accusative_singular": "την εμπειρία",
            "vocative_singular": "εμπειρία",
            "nominative_plural": "οι εμπειρίες",
            "genitive_plural": "των εμπειριών",
            "accusative_plural": "τις εμπειρίες",
            "vocative_plural": "εμπειρίες",
        },
    },
    "προσπαθώ": {
        "verb_data": {
            "voice": "active",
            "present_1s": "προσπαθώ",
            "present_2s": "προσπαθείς",
            "present_3s": "προσπαθεί",
            "present_1p": "προσπαθούμε",
            "present_2p": "προσπαθείτε",
            "present_3p": "προσπαθούν",
            "imperfect_1s": "προσπαθούσα",
            "imperfect_2s": "προσπαθούσες",
            "imperfect_3s": "προσπαθούσε",
            "imperfect_1p": "προσπαθούσαμε",
            "imperfect_2p": "προσπαθούσατε",
            "imperfect_3p": "προσπαθούσαν",
            "past_1s": "προσπάθησα",
            "past_2s": "προσπάθησες",
            "past_3s": "προσπάθησε",
            "past_1p": "προσπαθήσαμε",
            "past_2p": "προσπαθήσατε",
            "past_3p": "προσπάθησαν",
            "future_1s": "θα προσπαθήσω",
            "future_2s": "θα προσπαθήσεις",
            "future_3s": "θα προσπαθήσει",
            "future_1p": "θα προσπαθήσουμε",
            "future_2p": "θα προσπαθήσετε",
            "future_3p": "θα προσπαθήσουν",
            "perfect_1s": "έχω προσπαθήσει",
            "perfect_2s": "έχεις προσπαθήσει",
            "perfect_3s": "έχει προσπαθήσει",
            "perfect_1p": "έχουμε προσπαθήσει",
            "perfect_2p": "έχετε προσπαθήσει",
            "perfect_3p": "έχουν προσπαθήσει",
            "imperative_2s": "προσπάθησε",
            "imperative_2p": "προσπαθήστε",
        },
    },  # verb
    "επιτυγχάνω": {
        "verb_data": {
            "voice": "active",
            "present_1s": "επιτυγχάνω",
            "present_2s": "επιτυγχάνεις",
            "present_3s": "επιτυγχάνει",
            "present_1p": "επιτυγχάνουμε",
            "present_2p": "επιτυγχάνετε",
            "present_3p": "επιτυγχάνουν",
            "imperfect_1s": "επιτύγχανα",
            "imperfect_2s": "επιτύγχανες",
            "imperfect_3s": "επιτύγχανε",
            "imperfect_1p": "επιτυγχάναμε",
            "imperfect_2p": "επιτυγχάνατε",
            "imperfect_3p": "επιτύγχαναν",
            "past_1s": "επέτυχα",
            "past_2s": "επέτυχες",
            "past_3s": "επέτυχε",
            "past_1p": "επιτύχαμε",
            "past_2p": "επιτύχατε",
            "past_3p": "επέτυχαν",
            "future_1s": "θα επιτύχω",
            "future_2s": "θα επιτύχεις",
            "future_3s": "θα επιτύχει",
            "future_1p": "θα επιτύχουμε",
            "future_2p": "θα επιτύχετε",
            "future_3p": "θα επιτύχουν",
            "perfect_1s": "έχω επιτύχει",
            "perfect_2s": "έχεις επιτύχει",
            "perfect_3s": "έχει επιτύχει",
            "perfect_1p": "έχουμε επιτύχει",
            "perfect_2p": "έχετε επιτύχει",
            "perfect_3p": "έχουν επιτύχει",
            "imperative_2s": "επίτυχε",
            "imperative_2p": "επιτύχετε",
        },
    },  # verb
    "αναπτύσσω": {
        "verb_data": {
            "voice": "active",
            "present_1s": "αναπτύσσω",
            "present_2s": "αναπτύσσεις",
            "present_3s": "αναπτύσσει",
            "present_1p": "αναπτύσσουμε",
            "present_2p": "αναπτύσσετε",
            "present_3p": "αναπτύσσουν",
            "imperfect_1s": "ανέπτυσσα",
            "imperfect_2s": "ανέπτυσσες",
            "imperfect_3s": "ανέπτυσσε",
            "imperfect_1p": "αναπτύσσαμε",
            "imperfect_2p": "αναπτύσσατε",
            "imperfect_3p": "ανέπτυσσαν",
            "past_1s": "ανέπτυξα",
            "past_2s": "ανέπτυξες",
            "past_3s": "ανέπτυξε",
            "past_1p": "αναπτύξαμε",
            "past_2p": "αναπτύξατε",
            "past_3p": "ανέπτυξαν",
            "future_1s": "θα αναπτύξω",
            "future_2s": "θα αναπτύξεις",
            "future_3s": "θα αναπτύξει",
            "future_1p": "θα αναπτύξουμε",
            "future_2p": "θα αναπτύξετε",
            "future_3p": "θα αναπτύξουν",
            "perfect_1s": "έχω αναπτύξει",
            "perfect_2s": "έχεις αναπτύξει",
            "perfect_3s": "έχει αναπτύξει",
            "perfect_1p": "έχουμε αναπτύξει",
            "perfect_2p": "έχετε αναπτύξει",
            "perfect_3p": "έχουν αναπτύξει",
            "imperative_2s": "ανάπτυξε",
            "imperative_2p": "αναπτύξτε",
        },
    },  # verb
    "κατάσταση": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η κατάσταση",
            "genitive_singular": "της κατάστασης",
            "accusative_singular": "την κατάσταση",
            "vocative_singular": "κατάσταση",
            "nominative_plural": "οι καταστάσεις",
            "genitive_plural": "των καταστάσεων",
            "accusative_plural": "τις καταστάσεις",
            "vocative_plural": "καταστάσεις",
        },
    },
    "σχέση": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η σχέση",
            "genitive_singular": "της σχέσης",
            "accusative_singular": "τη σχέση",
            "vocative_singular": "σχέση",
            "nominative_plural": "οι σχέσεις",
            "genitive_plural": "των σχέσεων",
            "accusative_plural": "τις σχέσεις",
            "vocative_plural": "σχέσεις",
        },
    },
    "ευκαιρία": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η ευκαιρία",
            "genitive_singular": "της ευκαιρίας",
            "accusative_singular": "την ευκαιρία",
            "vocative_singular": "ευκαιρία",
            "nominative_plural": "οι ευκαιρίες",
            "genitive_plural": "των ευκαιριών",
            "accusative_plural": "τις ευκαιρίες",
            "vocative_plural": "ευκαιρίες",
        },
    },
    "πρόβλημα": {
        "noun_data": {
            "gender": "neuter",
            "nominative_singular": "το πρόβλημα",
            "genitive_singular": "του προβλήματος",
            "accusative_singular": "το πρόβλημα",
            "vocative_singular": "πρόβλημα",
            "nominative_plural": "τα προβλήματα",
            "genitive_plural": "των προβλημάτων",
            "accusative_plural": "τα προβλήματα",
            "vocative_plural": "προβλήματα",
        },
    },
    # ========================================================================
    # B2 Level (10 words) - Professional and analytical
    # ========================================================================
    "διαπραγμάτευση": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η διαπραγμάτευση",
            "genitive_singular": "της διαπραγμάτευσης",
            "accusative_singular": "τη διαπραγμάτευση",
            "vocative_singular": "διαπραγμάτευση",
            "nominative_plural": "οι διαπραγματεύσεις",
            "genitive_plural": "των διαπραγματεύσεων",
            "accusative_plural": "τις διαπραγματεύσεις",
            "vocative_plural": "διαπραγματεύσεις",
        },
    },
    "συμφωνία": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η συμφωνία",
            "genitive_singular": "της συμφωνίας",
            "accusative_singular": "τη συμφωνία",
            "vocative_singular": "συμφωνία",
            "nominative_plural": "οι συμφωνίες",
            "genitive_plural": "των συμφωνιών",
            "accusative_plural": "τις συμφωνίες",
            "vocative_plural": "συμφωνίες",
        },
    },
    "ανάλυση": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η ανάλυση",
            "genitive_singular": "της ανάλυσης",
            "accusative_singular": "την ανάλυση",
            "vocative_singular": "ανάλυση",
            "nominative_plural": "οι αναλύσεις",
            "genitive_plural": "των αναλύσεων",
            "accusative_plural": "τις αναλύσεις",
            "vocative_plural": "αναλύσεις",
        },
    },
    "επιχείρηση": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η επιχείρηση",
            "genitive_singular": "της επιχείρησης",
            "accusative_singular": "την επιχείρηση",
            "vocative_singular": "επιχείρηση",
            "nominative_plural": "οι επιχειρήσεις",
            "genitive_plural": "των επιχειρήσεων",
            "accusative_plural": "τις επιχειρήσεις",
            "vocative_plural": "επιχειρήσεις",
        },
    },
    "στρατηγική": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η στρατηγική",
            "genitive_singular": "της στρατηγικής",
            "accusative_singular": "τη στρατηγική",
            "vocative_singular": "στρατηγική",
            "nominative_plural": "οι στρατηγικές",
            "genitive_plural": "των στρατηγικών",
            "accusative_plural": "τις στρατηγικές",
            "vocative_plural": "στρατηγικές",
        },
    },
    "αποτέλεσμα": {
        "noun_data": {
            "gender": "neuter",
            "nominative_singular": "το αποτέλεσμα",
            "genitive_singular": "του αποτελέσματος",
            "accusative_singular": "το αποτέλεσμα",
            "vocative_singular": "αποτέλεσμα",
            "nominative_plural": "τα αποτελέσματα",
            "genitive_plural": "των αποτελεσμάτων",
            "accusative_plural": "τα αποτελέσματα",
            "vocative_plural": "αποτελέσματα",
        },
    },
    "επιρροή": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η επιρροή",
            "genitive_singular": "της επιρροής",
            "accusative_singular": "την επιρροή",
            "vocative_singular": "επιρροή",
            "nominative_plural": "οι επιρροές",
            "genitive_plural": "των επιρροών",
            "accusative_plural": "τις επιρροές",
            "vocative_plural": "επιρροές",
        },
    },
    "παράγοντας": {
        "noun_data": {
            "gender": "masculine",
            "nominative_singular": "ο παράγοντας",
            "genitive_singular": "του παράγοντα",
            "accusative_singular": "τον παράγοντα",
            "vocative_singular": "παράγοντα",
            "nominative_plural": "οι παράγοντες",
            "genitive_plural": "των παραγόντων",
            "accusative_plural": "τους παράγοντες",
            "vocative_plural": "παράγοντες",
        },
    },
    "προτεραιότητα": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η προτεραιότητα",
            "genitive_singular": "της προτεραιότητας",
            "accusative_singular": "την προτεραιότητα",
            "vocative_singular": "προτεραιότητα",
            "nominative_plural": "οι προτεραιότητες",
            "genitive_plural": "των προτεραιοτήτων",
            "accusative_plural": "τις προτεραιότητες",
            "vocative_plural": "προτεραιότητες",
        },
    },
    "αξιολόγηση": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η αξιολόγηση",
            "genitive_singular": "της αξιολόγησης",
            "accusative_singular": "την αξιολόγηση",
            "vocative_singular": "αξιολόγηση",
            "nominative_plural": "οι αξιολογήσεις",
            "genitive_plural": "των αξιολογήσεων",
            "accusative_plural": "τις αξιολογήσεις",
            "vocative_plural": "αξιολογήσεις",
        },
    },
    # ========================================================================
    # C1 Level (10 words) - Advanced academic
    # ========================================================================
    "διαφάνεια": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η διαφάνεια",
            "genitive_singular": "της διαφάνειας",
            "accusative_singular": "τη διαφάνεια",
            "vocative_singular": "διαφάνεια",
            "nominative_plural": "οι διαφάνειες",
            "genitive_plural": "των διαφανειών",
            "accusative_plural": "τις διαφάνειες",
            "vocative_plural": "διαφάνειες",
        },
    },
    "αειφορία": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η αειφορία",
            "genitive_singular": "της αειφορίας",
            "accusative_singular": "την αειφορία",
            "vocative_singular": "αειφορία",
            "nominative_plural": "οι αειφορίες",
            "genitive_plural": "των αειφοριών",
            "accusative_plural": "τις αειφορίες",
            "vocative_plural": "αειφορίες",
        },
    },
    "διακυβέρνηση": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η διακυβέρνηση",
            "genitive_singular": "της διακυβέρνησης",
            "accusative_singular": "τη διακυβέρνηση",
            "vocative_singular": "διακυβέρνηση",
            "nominative_plural": "οι διακυβερνήσεις",
            "genitive_plural": "των διακυβερνήσεων",
            "accusative_plural": "τις διακυβερνήσεις",
            "vocative_plural": "διακυβερνήσεις",
        },
    },
    "αντικειμενικότητα": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η αντικειμενικότητα",
            "genitive_singular": "της αντικειμενικότητας",
            "accusative_singular": "την αντικειμενικότητα",
            "vocative_singular": "αντικειμενικότητα",
            "nominative_plural": "οι αντικειμενικότητες",
            "genitive_plural": "των αντικειμενικοτήτων",
            "accusative_plural": "τις αντικειμενικότητες",
            "vocative_plural": "αντικειμενικότητες",
        },
    },
    "υποκειμενικότητα": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η υποκειμενικότητα",
            "genitive_singular": "της υποκειμενικότητας",
            "accusative_singular": "την υποκειμενικότητα",
            "vocative_singular": "υποκειμενικότητα",
            "nominative_plural": "οι υποκειμενικότητες",
            "genitive_plural": "των υποκειμενικοτήτων",
            "accusative_plural": "τις υποκειμενικότητες",
            "vocative_plural": "υποκειμενικότητες",
        },
    },
    "διεπιστημονικός": {
        "adjective_data": {
            "masculine_nom_sg": "διεπιστημονικός",
            "masculine_gen_sg": "διεπιστημονικού",
            "masculine_acc_sg": "διεπιστημονικό",
            "masculine_voc_sg": "διεπιστημονικέ",
            "masculine_nom_pl": "διεπιστημονικοί",
            "masculine_gen_pl": "διεπιστημονικών",
            "masculine_acc_pl": "διεπιστημονικούς",
            "masculine_voc_pl": "διεπιστημονικοί",
            "feminine_nom_sg": "διεπιστημονική",
            "feminine_gen_sg": "διεπιστημονικής",
            "feminine_acc_sg": "διεπιστημονική",
            "feminine_voc_sg": "διεπιστημονική",
            "feminine_nom_pl": "διεπιστημονικές",
            "feminine_gen_pl": "διεπιστημονικών",
            "feminine_acc_pl": "διεπιστημονικές",
            "feminine_voc_pl": "διεπιστημονικές",
            "neuter_nom_sg": "διεπιστημονικό",
            "neuter_gen_sg": "διεπιστημονικού",
            "neuter_acc_sg": "διεπιστημονικό",
            "neuter_voc_sg": "διεπιστημονικό",
            "neuter_nom_pl": "διεπιστημονικά",
            "neuter_gen_pl": "διεπιστημονικών",
            "neuter_acc_pl": "διεπιστημονικά",
            "neuter_voc_pl": "διεπιστημονικά",
            "comparative": "πιο διεπιστημονικός",
            "superlative": "ο πιο διεπιστημονικός",
        },
    },  # adjective
    "πολυπλοκότητα": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η πολυπλοκότητα",
            "genitive_singular": "της πολυπλοκότητας",
            "accusative_singular": "την πολυπλοκότητα",
            "vocative_singular": "πολυπλοκότητα",
            "nominative_plural": "οι πολυπλοκότητες",
            "genitive_plural": "των πολυπλοκοτήτων",
            "accusative_plural": "τις πολυπλοκότητες",
            "vocative_plural": "πολυπλοκότητες",
        },
    },
    "ενσωμάτωση": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η ενσωμάτωση",
            "genitive_singular": "της ενσωμάτωσης",
            "accusative_singular": "την ενσωμάτωση",
            "vocative_singular": "ενσωμάτωση",
            "nominative_plural": "οι ενσωματώσεις",
            "genitive_plural": "των ενσωματώσεων",
            "accusative_plural": "τις ενσωματώσεις",
            "vocative_plural": "ενσωματώσεις",
        },
    },
    "διαφοροποίηση": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η διαφοροποίηση",
            "genitive_singular": "της διαφοροποίησης",
            "accusative_singular": "τη διαφοροποίηση",
            "vocative_singular": "διαφοροποίηση",
            "nominative_plural": "οι διαφοροποιήσεις",
            "genitive_plural": "των διαφοροποιήσεων",
            "accusative_plural": "τις διαφοροποιήσεις",
            "vocative_plural": "διαφοροποιήσεις",
        },
    },
    "συνεισφορά": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η συνεισφορά",
            "genitive_singular": "της συνεισφοράς",
            "accusative_singular": "τη συνεισφορά",
            "vocative_singular": "συνεισφορά",
            "nominative_plural": "οι συνεισφορές",
            "genitive_plural": "των συνεισφορών",
            "accusative_plural": "τις συνεισφορές",
            "vocative_plural": "συνεισφορές",
        },
    },
    # ========================================================================
    # C2 Level (10 words) - Mastery level philosophical/academic
    # ========================================================================
    "μεταμοντερνισμός": {
        "noun_data": {
            "gender": "masculine",
            "nominative_singular": "ο μεταμοντερνισμός",
            "genitive_singular": "του μεταμοντερνισμού",
            "accusative_singular": "τον μεταμοντερνισμό",
            "vocative_singular": "μεταμοντερνισμέ",
            "nominative_plural": "οι μεταμοντερνισμοί",
            "genitive_plural": "των μεταμοντερνισμών",
            "accusative_plural": "τους μεταμοντερνισμούς",
            "vocative_plural": "μεταμοντερνισμοί",
        },
    },
    "επιστημολογία": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η επιστημολογία",
            "genitive_singular": "της επιστημολογίας",
            "accusative_singular": "την επιστημολογία",
            "vocative_singular": "επιστημολογία",
            "nominative_plural": "οι επιστημολογίες",
            "genitive_plural": "των επιστημολογιών",
            "accusative_plural": "τις επιστημολογίες",
            "vocative_plural": "επιστημολογίες",
        },
    },
    "υπερβατικός": {
        "adjective_data": {
            "masculine_nom_sg": "υπερβατικός",
            "masculine_gen_sg": "υπερβατικού",
            "masculine_acc_sg": "υπερβατικό",
            "masculine_voc_sg": "υπερβατικέ",
            "masculine_nom_pl": "υπερβατικοί",
            "masculine_gen_pl": "υπερβατικών",
            "masculine_acc_pl": "υπερβατικούς",
            "masculine_voc_pl": "υπερβατικοί",
            "feminine_nom_sg": "υπερβατική",
            "feminine_gen_sg": "υπερβατικής",
            "feminine_acc_sg": "υπερβατική",
            "feminine_voc_sg": "υπερβατική",
            "feminine_nom_pl": "υπερβατικές",
            "feminine_gen_pl": "υπερβατικών",
            "feminine_acc_pl": "υπερβατικές",
            "feminine_voc_pl": "υπερβατικές",
            "neuter_nom_sg": "υπερβατικό",
            "neuter_gen_sg": "υπερβατικού",
            "neuter_acc_sg": "υπερβατικό",
            "neuter_voc_sg": "υπερβατικό",
            "neuter_nom_pl": "υπερβατικά",
            "neuter_gen_pl": "υπερβατικών",
            "neuter_acc_pl": "υπερβατικά",
            "neuter_voc_pl": "υπερβατικά",
            "comparative": "πιο υπερβατικός",
            "superlative": "ο πιο υπερβατικός",
        },
    },  # adjective
    "διαλεκτική": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η διαλεκτική",
            "genitive_singular": "της διαλεκτικής",
            "accusative_singular": "τη διαλεκτική",
            "vocative_singular": "διαλεκτική",
            "nominative_plural": "οι διαλεκτικές",
            "genitive_plural": "των διαλεκτικών",
            "accusative_plural": "τις διαλεκτικές",
            "vocative_plural": "διαλεκτικές",
        },
    },
    "παραδειγματικός": {
        "adjective_data": {
            "masculine_nom_sg": "παραδειγματικός",
            "masculine_gen_sg": "παραδειγματικού",
            "masculine_acc_sg": "παραδειγματικό",
            "masculine_voc_sg": "παραδειγματικέ",
            "masculine_nom_pl": "παραδειγματικοί",
            "masculine_gen_pl": "παραδειγματικών",
            "masculine_acc_pl": "παραδειγματικούς",
            "masculine_voc_pl": "παραδειγματικοί",
            "feminine_nom_sg": "παραδειγματική",
            "feminine_gen_sg": "παραδειγματικής",
            "feminine_acc_sg": "παραδειγματική",
            "feminine_voc_sg": "παραδειγματική",
            "feminine_nom_pl": "παραδειγματικές",
            "feminine_gen_pl": "παραδειγματικών",
            "feminine_acc_pl": "παραδειγματικές",
            "feminine_voc_pl": "παραδειγματικές",
            "neuter_nom_sg": "παραδειγματικό",
            "neuter_gen_sg": "παραδειγματικού",
            "neuter_acc_sg": "παραδειγματικό",
            "neuter_voc_sg": "παραδειγματικό",
            "neuter_nom_pl": "παραδειγματικά",
            "neuter_gen_pl": "παραδειγματικών",
            "neuter_acc_pl": "παραδειγματικά",
            "neuter_voc_pl": "παραδειγματικά",
            "comparative": "πιο παραδειγματικός",
            "superlative": "ο πιο παραδειγματικός",
        },
    },  # adjective
    "αποδόμηση": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η αποδόμηση",
            "genitive_singular": "της αποδόμησης",
            "accusative_singular": "την αποδόμηση",
            "vocative_singular": "αποδόμηση",
            "nominative_plural": "οι αποδομήσεις",
            "genitive_plural": "των αποδομήσεων",
            "accusative_plural": "τις αποδομήσεις",
            "vocative_plural": "αποδομήσεις",
        },
    },
    "ερμηνευτική": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η ερμηνευτική",
            "genitive_singular": "της ερμηνευτικής",
            "accusative_singular": "την ερμηνευτική",
            "vocative_singular": "ερμηνευτική",
            "nominative_plural": "οι ερμηνευτικές",
            "genitive_plural": "των ερμηνευτικών",
            "accusative_plural": "τις ερμηνευτικές",
            "vocative_plural": "ερμηνευτικές",
        },
    },
    "φαινομενολογία": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η φαινομενολογία",
            "genitive_singular": "της φαινομενολογίας",
            "accusative_singular": "τη φαινομενολογία",
            "vocative_singular": "φαινομενολογία",
            "nominative_plural": "οι φαινομενολογίες",
            "genitive_plural": "των φαινομενολογιών",
            "accusative_plural": "τις φαινομενολογίες",
            "vocative_plural": "φαινομενολογίες",
        },
    },
    "οντολογία": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η οντολογία",
            "genitive_singular": "της οντολογίας",
            "accusative_singular": "την οντολογία",
            "vocative_singular": "οντολογία",
            "nominative_plural": "οι οντολογίες",
            "genitive_plural": "των οντολογιών",
            "accusative_plural": "τις οντολογίες",
            "vocative_plural": "οντολογίες",
        },
    },
    "αισθητική": {
        "noun_data": {
            "gender": "feminine",
            "nominative_singular": "η αισθητική",
            "genitive_singular": "της αισθητικής",
            "accusative_singular": "την αισθητική",
            "vocative_singular": "αισθητική",
            "nominative_plural": "οι αισθητικές",
            "genitive_plural": "των αισθητικών",
            "accusative_plural": "τις αισθητικές",
            "vocative_plural": "αισθητικές",
        },
    },
}
