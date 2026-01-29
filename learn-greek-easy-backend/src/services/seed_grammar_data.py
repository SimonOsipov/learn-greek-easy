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
    "ευχαριστώ": {},  # verb
    "παρακαλώ": {},  # verb
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
    "αγαπώ": {},  # verb
    "θέλω": {},  # verb
    "μπορώ": {},  # verb
    "πρέπει": {},  # verb (impersonal)
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
    "σήμερα": {},  # adverb
    "αύριο": {},  # adverb
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
    "προσπαθώ": {},  # verb
    "επιτυγχάνω": {},  # verb
    "αναπτύσσω": {},  # verb
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
    "διεπιστημονικός": {},  # adjective
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
    "υπερβατικός": {},  # adjective
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
    "παραδειγματικός": {},  # adjective
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
