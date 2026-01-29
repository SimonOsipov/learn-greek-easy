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
    "γεια": {},
    "ναι": {},
    "όχι": {},
    "ευχαριστώ": {},
    "παρακαλώ": {},
    "νερό": {},
    "ψωμί": {},
    "σπίτι": {},
    "καλημέρα": {},
    "καληνύχτα": {},
    # ========================================================================
    # A2 Level (10 words) - Daily life and common verbs
    # ========================================================================
    "δουλειά": {},
    "οικογένεια": {},
    "φίλος": {},
    "αγαπώ": {},
    "θέλω": {},
    "μπορώ": {},
    "πρέπει": {},
    "χρόνια": {},
    "σήμερα": {},
    "αύριο": {},
    # ========================================================================
    # B1 Level (10 words) - Intermediate concepts
    # ========================================================================
    "συζήτηση": {},
    "απόφαση": {},
    "εμπειρία": {},
    "προσπαθώ": {},
    "επιτυγχάνω": {},
    "αναπτύσσω": {},
    "κατάσταση": {},
    "σχέση": {},
    "ευκαιρία": {},
    "πρόβλημα": {},
    # ========================================================================
    # B2 Level (10 words) - Professional and analytical
    # ========================================================================
    "διαπραγμάτευση": {},
    "συμφωνία": {},
    "ανάλυση": {},
    "επιχείρηση": {},
    "στρατηγική": {},
    "αποτέλεσμα": {},
    "επιρροή": {},
    "παράγοντας": {},
    "προτεραιότητα": {},
    "αξιολόγηση": {},
    # ========================================================================
    # C1 Level (10 words) - Advanced academic
    # ========================================================================
    "διαφάνεια": {},
    "αειφορία": {},
    "διακυβέρνηση": {},
    "αντικειμενικότητα": {},
    "υποκειμενικότητα": {},
    "διεπιστημονικός": {},
    "πολυπλοκότητα": {},
    "ενσωμάτωση": {},
    "διαφοροποίηση": {},
    "συνεισφορά": {},
    # ========================================================================
    # C2 Level (10 words) - Mastery level philosophical/academic
    # ========================================================================
    "μεταμοντερνισμός": {},
    "επιστημολογία": {},
    "υπερβατικός": {},
    "διαλεκτική": {},
    "παραδειγματικός": {},
    "αποδόμηση": {},
    "ερμηνευτική": {},
    "φαινομενολογία": {},
    "οντολογία": {},
    "αισθητική": {},
}
