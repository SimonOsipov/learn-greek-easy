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

    id: NotRequired[str]
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
    "γεια": {
        "back_text_ru": "привет",
        "examples": [
            {
                "id": "ex_geia1",
                "greek": "Γεια, πώς είσαι;",
                "english": "Hi, how are you?",
                "russian": "Привет, как дела?",
            },
            {
                "id": "ex_geia2",
                "greek": "Γεια σου, Μαρία!",
                "english": "Hi, Maria!",
                "russian": "Привет, Мария!",
            },
        ],
    },  # interjection
    "ναι": {
        "back_text_ru": "да",
        "examples": [
            {
                "id": "ex_nai1",
                "greek": "Ναι, θέλω καφέ.",
                "english": "Yes, I want coffee.",
                "russian": "Да, я хочу кофе.",
            },
            {
                "id": "ex_nai2",
                "greek": "Ναι, σωστά!",
                "english": "Yes, correct!",
                "russian": "Да, правильно!",
            },
        ],
    },  # interjection
    "όχι": {
        "back_text_ru": "нет",
        "examples": [
            {
                "id": "ex_ochi1",
                "greek": "Όχι, ευχαριστώ.",
                "english": "No, thank you.",
                "russian": "Нет, спасибо.",
            },
            {
                "id": "ex_ochi2",
                "greek": "Όχι, δεν μπορώ.",
                "english": "No, I can't.",
                "russian": "Нет, я не могу.",
            },
        ],
    },  # interjection
    "ευχαριστώ": {
        "back_text_ru": "спасибо",
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
        "examples": [
            {
                "id": "ex_efcharisto1",
                "greek": "Σε ευχαριστώ πολύ για τη βοήθεια.",
                "english": "Thank you very much for your help.",
                "russian": "Большое спасибо за помощь.",
                "tense": "present",
            },
            {
                "id": "ex_efcharisto2",
                "greek": "Τον ευχαρίστησα για το δώρο.",
                "english": "I thanked him for the gift.",
                "russian": "Я поблагодарил его за подарок.",
                "tense": "past",
            },
        ],
    },  # verb
    "παρακαλώ": {
        "back_text_ru": "пожалуйста",
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
        "examples": [
            {
                "id": "ex_parakalo1",
                "greek": "Παρακαλώ, κάθισε εδώ.",
                "english": "Please, sit here.",
                "russian": "Пожалуйста, садись сюда.",
                "tense": "present",
            },
            {
                "id": "ex_parakalo2",
                "greek": "Τον παρακάλεσα να με βοηθήσει.",
                "english": "I asked him to help me.",
                "russian": "Я попросил его помочь мне.",
                "tense": "past",
            },
        ],
    },  # verb
    "νερό": {
        "back_text_ru": "вода",
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
        "examples": [
            {
                "id": "ex_nero1",
                "greek": "Θέλω ένα ποτήρι νερό.",
                "english": "I want a glass of water.",
                "russian": "Я хочу стакан воды.",
            },
            {
                "id": "ex_nero2",
                "greek": "Το νερό είναι κρύο.",
                "english": "The water is cold.",
                "russian": "Вода холодная.",
            },
        ],
    },
    "ψωμί": {
        "back_text_ru": "хлеб",
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
        "examples": [
            {
                "id": "ex_psomi1",
                "greek": "Αγόρασα φρέσκο ψωμί.",
                "english": "I bought fresh bread.",
                "russian": "Я купил свежий хлеб.",
            },
            {
                "id": "ex_psomi2",
                "greek": "Θέλεις ψωμί με βούτυρο;",
                "english": "Do you want bread with butter?",
                "russian": "Хочешь хлеб с маслом?",
            },
        ],
    },
    "σπίτι": {
        "back_text_ru": "дом",
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
        "examples": [
            {
                "id": "ex_spiti1",
                "greek": "Το σπίτι μου είναι κοντά.",
                "english": "My house is nearby.",
                "russian": "Мой дом близко.",
            },
            {
                "id": "ex_spiti2",
                "greek": "Πάμε σπίτι!",
                "english": "Let's go home!",
                "russian": "Пойдем домой!",
            },
        ],
    },
    "καλημέρα": {
        "back_text_ru": "доброе утро",
        "examples": [
            {
                "id": "ex_kalimera1",
                "greek": "Καλημέρα, τι κάνεις;",
                "english": "Good morning, how are you?",
                "russian": "Доброе утро, как дела?",
            },
            {
                "id": "ex_kalimera2",
                "greek": "Καλημέρα σας!",
                "english": "Good morning! (formal)",
                "russian": "Доброе утро! (вежливо)",
            },
        ],
    },  # interjection
    "καληνύχτα": {
        "back_text_ru": "спокойной ночи",
        "examples": [
            {
                "id": "ex_kalinychta1",
                "greek": "Καληνύχτα, όνειρα γλυκά!",
                "english": "Good night, sweet dreams!",
                "russian": "Спокойной ночи, сладких снов!",
            },
            {
                "id": "ex_kalinychta2",
                "greek": "Πάω για ύπνο. Καληνύχτα!",
                "english": "I'm going to sleep. Good night!",
                "russian": "Я иду спать. Спокойной ночи!",
            },
        ],
    },  # interjection
    # ========================================================================
    # A2 Level (10 words) - Daily life and common verbs
    # ========================================================================
    "δουλειά": {
        "back_text_ru": "работа",
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
        "examples": [
            {
                "id": "ex_douleia1",
                "greek": "Πάω στη δουλειά κάθε μέρα.",
                "english": "I go to work every day.",
                "russian": "Я хожу на работу каждый день.",
            },
            {
                "id": "ex_douleia2",
                "greek": "Έχω πολλή δουλειά σήμερα.",
                "english": "I have a lot of work today.",
                "russian": "У меня много работы сегодня.",
            },
        ],
    },
    "οικογένεια": {
        "back_text_ru": "семья",
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
        "examples": [
            {
                "id": "ex_oikogeneia1",
                "greek": "Η οικογένειά μου μένει στην Αθήνα.",
                "english": "My family lives in Athens.",
                "russian": "Моя семья живет в Афинах.",
            },
            {
                "id": "ex_oikogeneia2",
                "greek": "Αγαπώ την οικογένειά μου.",
                "english": "I love my family.",
                "russian": "Я люблю свою семью.",
            },
        ],
    },
    "φίλος": {
        "back_text_ru": "друг",
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
        "examples": [
            {
                "id": "ex_filos1",
                "greek": "Ο Γιάννης είναι ο καλύτερος φίλος μου.",
                "english": "Yannis is my best friend.",
                "russian": "Яннис - мой лучший друг.",
            },
            {
                "id": "ex_filos2",
                "greek": "Βλέπω τους φίλους μου το Σάββατο.",
                "english": "I see my friends on Saturday.",
                "russian": "Я вижусь с друзьями в субботу.",
            },
        ],
    },
    "αγαπώ": {
        "back_text_ru": "любить",
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
        "examples": [
            {
                "id": "ex_agapo1",
                "greek": "Σε αγαπώ πολύ.",
                "english": "I love you very much.",
                "russian": "Я тебя очень люблю.",
                "tense": "present",
            },
            {
                "id": "ex_agapo2",
                "greek": "Την αγάπησα από την πρώτη στιγμή.",
                "english": "I loved her from the first moment.",
                "russian": "Я полюбил ее с первого момента.",
                "tense": "past",
            },
        ],
    },  # verb
    "θέλω": {
        "back_text_ru": "хотеть",
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
        "examples": [
            {
                "id": "ex_thelo1",
                "greek": "Θέλω να μάθω ελληνικά.",
                "english": "I want to learn Greek.",
                "russian": "Я хочу выучить греческий.",
                "tense": "present",
            },
            {
                "id": "ex_thelo2",
                "greek": "Ήθελα να σου πω κάτι.",
                "english": "I wanted to tell you something.",
                "russian": "Я хотел тебе кое-что сказать.",
                "tense": "imperfect",
            },
        ],
    },  # verb
    "μπορώ": {
        "back_text_ru": "мочь",
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
        "examples": [
            {
                "id": "ex_mporo1",
                "greek": "Μπορώ να σε βοηθήσω.",
                "english": "I can help you.",
                "russian": "Я могу тебе помочь.",
                "tense": "present",
            },
            {
                "id": "ex_mporo2",
                "greek": "Δεν μπόρεσα να έρθω χθες.",
                "english": "I couldn't come yesterday.",
                "russian": "Я не смог прийти вчера.",
                "tense": "past",
            },
        ],
    },  # verb
    "πρέπει": {
        "back_text_ru": "надо / нужно",
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
        "examples": [
            {
                "id": "ex_prepei1",
                "greek": "Πρέπει να φύγω τώρα.",
                "english": "I must leave now.",
                "russian": "Мне нужно уйти сейчас.",
                "tense": "present",
            },
            {
                "id": "ex_prepei2",
                "greek": "Έπρεπε να το είχα πει νωρίτερα.",
                "english": "I should have said it earlier.",
                "russian": "Мне надо было сказать это раньше.",
                "tense": "imperfect",
            },
        ],
    },  # verb (impersonal)
    "χρόνια": {
        "back_text_ru": "годы",
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
        "examples": [
            {
                "id": "ex_chronia1",
                "greek": "Μένω εδώ πέντε χρόνια.",
                "english": "I have been living here for five years.",
                "russian": "Я живу здесь пять лет.",
            },
            {
                "id": "ex_chronia2",
                "greek": "Χρόνια πολλά!",
                "english": "Happy birthday! / Many years!",
                "russian": "С днем рождения! / Многие лета!",
            },
        ],
    },
    "σήμερα": {
        "back_text_ru": "сегодня",
        "adverb_data": {
            "comparative": "",
            "superlative": "",
        },
        "examples": [
            {
                "id": "ex_simera1",
                "greek": "Σήμερα είναι Δευτέρα.",
                "english": "Today is Monday.",
                "russian": "Сегодня понедельник.",
            },
            {
                "id": "ex_simera2",
                "greek": "Τι θα κάνεις σήμερα;",
                "english": "What will you do today?",
                "russian": "Что ты будешь делать сегодня?",
            },
        ],
    },  # adverb (time - no comparison)
    "αύριο": {
        "back_text_ru": "завтра",
        "adverb_data": {
            "comparative": "",
            "superlative": "",
        },
        "examples": [
            {
                "id": "ex_avrio1",
                "greek": "Αύριο θα πάω στη θάλασσα.",
                "english": "Tomorrow I will go to the sea.",
                "russian": "Завтра я пойду на море.",
            },
            {
                "id": "ex_avrio2",
                "greek": "Τα λέμε αύριο!",
                "english": "See you tomorrow!",
                "russian": "Увидимся завтра!",
            },
        ],
    },  # adverb (time - no comparison)
    # ========================================================================
    # B1 Level (10 words) - Intermediate concepts
    # ========================================================================
    "συζήτηση": {
        "back_text_ru": "обсуждение / дискуссия",
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
        "examples": [
            {
                "id": "ex_syzitisi1",
                "greek": "Είχαμε μια ενδιαφέρουσα συζήτηση.",
                "english": "We had an interesting discussion.",
                "russian": "У нас была интересная дискуссия.",
            },
            {
                "id": "ex_syzitisi2",
                "greek": "Η συζήτηση κράτησε δύο ώρες.",
                "english": "The discussion lasted two hours.",
                "russian": "Обсуждение длилось два часа.",
            },
        ],
    },
    "απόφαση": {
        "back_text_ru": "решение",
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
        "examples": [
            {
                "id": "ex_apofasi1",
                "greek": "Πήρα μια σημαντική απόφαση.",
                "english": "I made an important decision.",
                "russian": "Я принял важное решение.",
            },
            {
                "id": "ex_apofasi2",
                "greek": "Η απόφαση είναι δική σου.",
                "english": "The decision is yours.",
                "russian": "Решение за тобой.",
            },
        ],
    },
    "εμπειρία": {
        "back_text_ru": "опыт",
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
        "examples": [
            {
                "id": "ex_empeiria1",
                "greek": "Έχει πολλή εμπειρία στη δουλειά.",
                "english": "He has a lot of work experience.",
                "russian": "У него большой опыт работы.",
            },
            {
                "id": "ex_empeiria2",
                "greek": "Ήταν μια μοναδική εμπειρία.",
                "english": "It was a unique experience.",
                "russian": "Это был уникальный опыт.",
            },
        ],
    },
    "προσπαθώ": {
        "back_text_ru": "пытаться / стараться",
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
        "examples": [
            {
                "id": "ex_prospatho1",
                "greek": "Προσπαθώ να μάθω ελληνικά κάθε μέρα.",
                "english": "I try to learn Greek every day.",
                "russian": "Я стараюсь учить греческий каждый день.",
                "tense": "present",
            },
            {
                "id": "ex_prospatho2",
                "greek": "Προσπάθησε να καταλάβει το πρόβλημα.",
                "english": "He tried to understand the problem.",
                "russian": "Он попытался понять проблему.",
                "tense": "past",
            },
        ],
    },  # verb
    "επιτυγχάνω": {
        "back_text_ru": "достигать",
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
        "examples": [
            {
                "id": "ex_epitynchano1",
                "greek": "Θέλω να επιτύχω τους στόχους μου.",
                "english": "I want to achieve my goals.",
                "russian": "Я хочу достичь своих целей.",
                "tense": "present",
            },
            {
                "id": "ex_epitynchano2",
                "greek": "Επέτυχε μεγάλη επιτυχία στην καριέρα του.",
                "english": "He achieved great success in his career.",
                "russian": "Он добился большого успеха в карьере.",
                "tense": "past",
            },
        ],
    },  # verb
    "αναπτύσσω": {
        "back_text_ru": "развивать",
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
        "examples": [
            {
                "id": "ex_anaptyso1",
                "greek": "Αναπτύσσουμε νέα προϊόντα.",
                "english": "We are developing new products.",
                "russian": "Мы разрабатываем новые продукты.",
                "tense": "present",
            },
            {
                "id": "ex_anaptyso2",
                "greek": "Η εταιρεία ανέπτυξε καινοτόμες λύσεις.",
                "english": "The company developed innovative solutions.",
                "russian": "Компания разработала инновационные решения.",
                "tense": "past",
            },
        ],
    },  # verb
    "κατάσταση": {
        "back_text_ru": "ситуация / положение",
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
        "examples": [
            {
                "id": "ex_katastasi1",
                "greek": "Η κατάσταση είναι δύσκολη.",
                "english": "The situation is difficult.",
                "russian": "Ситуация сложная.",
            },
            {
                "id": "ex_katastasi2",
                "greek": "Πρέπει να βελτιώσουμε την κατάσταση.",
                "english": "We need to improve the situation.",
                "russian": "Нам нужно улучшить положение.",
            },
        ],
    },
    "σχέση": {
        "back_text_ru": "отношения / связь",
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
        "examples": [
            {
                "id": "ex_schesi1",
                "greek": "Έχουμε καλή σχέση με τους γείτονες.",
                "english": "We have a good relationship with the neighbors.",
                "russian": "У нас хорошие отношения с соседями.",
            },
            {
                "id": "ex_schesi2",
                "greek": "Ποια είναι η σχέση αυτών των δύο θεμάτων;",
                "english": "What is the connection between these two topics?",
                "russian": "Какая связь между этими двумя темами?",
            },
        ],
    },
    "ευκαιρία": {
        "back_text_ru": "возможность / шанс",
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
        "examples": [
            {
                "id": "ex_efkairia1",
                "greek": "Αυτή είναι μια μεγάλη ευκαιρία.",
                "english": "This is a great opportunity.",
                "russian": "Это отличная возможность.",
            },
            {
                "id": "ex_efkairia2",
                "greek": "Μη χάσεις αυτή την ευκαιρία!",
                "english": "Don't miss this chance!",
                "russian": "Не упусти эту возможность!",
            },
        ],
    },
    "πρόβλημα": {
        "back_text_ru": "проблема",
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
        "examples": [
            {
                "id": "ex_provlima1",
                "greek": "Υπάρχει ένα πρόβλημα με τον υπολογιστή.",
                "english": "There is a problem with the computer.",
                "russian": "Есть проблема с компьютером.",
            },
            {
                "id": "ex_provlima2",
                "greek": "Θα λύσουμε το πρόβλημα μαζί.",
                "english": "We will solve the problem together.",
                "russian": "Мы решим проблему вместе.",
            },
        ],
    },
    # ========================================================================
    # B2 Level (10 words) - Professional and analytical
    # ========================================================================
    "διαπραγμάτευση": {
        "back_text_ru": "переговоры",
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
        "examples": [
            {
                "id": "ex_diapragmatefsi1",
                "greek": "Οι διαπραγματεύσεις διήρκεσαν πολλές ώρες.",
                "english": "The negotiations lasted many hours.",
                "russian": "Переговоры длились много часов.",
            },
            {
                "id": "ex_diapragmatefsi2",
                "greek": "Είμαστε σε διαπραγμάτευση με την εταιρεία.",
                "english": "We are in negotiation with the company.",
                "russian": "Мы ведем переговоры с компанией.",
            },
        ],
    },
    "συμφωνία": {
        "back_text_ru": "соглашение / договор",
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
        "examples": [
            {
                "id": "ex_symfonia1",
                "greek": "Υπογράψαμε τη συμφωνία.",
                "english": "We signed the agreement.",
                "russian": "Мы подписали соглашение.",
            },
            {
                "id": "ex_symfonia2",
                "greek": "Καταλήξαμε σε συμφωνία.",
                "english": "We reached an agreement.",
                "russian": "Мы пришли к соглашению.",
            },
        ],
    },
    "ανάλυση": {
        "back_text_ru": "анализ",
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
        "examples": [
            {
                "id": "ex_analysi1",
                "greek": "Η ανάλυση των δεδομένων είναι απαραίτητη.",
                "english": "Data analysis is essential.",
                "russian": "Анализ данных необходим.",
            },
            {
                "id": "ex_analysi2",
                "greek": "Κάναμε λεπτομερή ανάλυση του προβλήματος.",
                "english": "We did a detailed analysis of the problem.",
                "russian": "Мы провели детальный анализ проблемы.",
            },
        ],
    },
    "επιχείρηση": {
        "back_text_ru": "предприятие / бизнес",
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
        "examples": [
            {
                "id": "ex_epicheirisi1",
                "greek": "Ξεκίνησε τη δική του επιχείρηση.",
                "english": "He started his own business.",
                "russian": "Он открыл свой бизнес.",
            },
            {
                "id": "ex_epicheirisi2",
                "greek": "Η επιχείρηση αναπτύσσεται γρήγορα.",
                "english": "The business is growing quickly.",
                "russian": "Предприятие быстро развивается.",
            },
        ],
    },
    "στρατηγική": {
        "back_text_ru": "стратегия",
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
        "examples": [
            {
                "id": "ex_stratigiki1",
                "greek": "Χρειαζόμαστε μια νέα στρατηγική.",
                "english": "We need a new strategy.",
                "russian": "Нам нужна новая стратегия.",
            },
            {
                "id": "ex_stratigiki2",
                "greek": "Η στρατηγική μάρκετινγκ ήταν επιτυχημένη.",
                "english": "The marketing strategy was successful.",
                "russian": "Маркетинговая стратегия была успешной.",
            },
        ],
    },
    "αποτέλεσμα": {
        "back_text_ru": "результат / итог",
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
        "examples": [
            {
                "id": "ex_apotelesma1",
                "greek": "Τα αποτελέσματα ήταν εντυπωσιακά.",
                "english": "The results were impressive.",
                "russian": "Результаты были впечатляющими.",
            },
            {
                "id": "ex_apotelesma2",
                "greek": "Περιμένουμε τα αποτελέσματα των εξετάσεων.",
                "english": "We are waiting for the exam results.",
                "russian": "Мы ждем результаты экзаменов.",
            },
        ],
    },
    "επιρροή": {
        "back_text_ru": "влияние",
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
        "examples": [
            {
                "id": "ex_epirroi1",
                "greek": "Έχει μεγάλη επιρροή στην ομάδα.",
                "english": "He has a great influence on the team.",
                "russian": "Он имеет большое влияние на команду.",
            },
            {
                "id": "ex_epirroi2",
                "greek": "Η τεχνολογία έχει επιρροή στη ζωή μας.",
                "english": "Technology has an influence on our lives.",
                "russian": "Технологии влияют на нашу жизнь.",
            },
        ],
    },
    "παράγοντας": {
        "back_text_ru": "фактор",
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
        "examples": [
            {
                "id": "ex_paragontas1",
                "greek": "Ο χρόνος είναι σημαντικός παράγοντας.",
                "english": "Time is an important factor.",
                "russian": "Время - важный фактор.",
            },
            {
                "id": "ex_paragontas2",
                "greek": "Πολλοί παράγοντες επηρεάζουν την απόφαση.",
                "english": "Many factors influence the decision.",
                "russian": "Многие факторы влияют на решение.",
            },
        ],
    },
    "προτεραιότητα": {
        "back_text_ru": "приоритет",
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
        "examples": [
            {
                "id": "ex_proteraiotita1",
                "greek": "Η υγεία είναι η πρώτη προτεραιότητα.",
                "english": "Health is the first priority.",
                "russian": "Здоровье - первый приоритет.",
            },
            {
                "id": "ex_proteraiotita2",
                "greek": "Πρέπει να καθορίσουμε τις προτεραιότητες.",
                "english": "We need to set the priorities.",
                "russian": "Нам нужно определить приоритеты.",
            },
        ],
    },
    "αξιολόγηση": {
        "back_text_ru": "оценка",
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
        "examples": [
            {
                "id": "ex_axiologisi1",
                "greek": "Η αξιολόγηση της απόδοσης είναι σημαντική.",
                "english": "Performance evaluation is important.",
                "russian": "Оценка эффективности важна.",
            },
            {
                "id": "ex_axiologisi2",
                "greek": "Κάναμε αξιολόγηση του προγράμματος.",
                "english": "We did an evaluation of the program.",
                "russian": "Мы провели оценку программы.",
            },
        ],
    },
    # ========================================================================
    # C1 Level (10 words) - Advanced academic
    # ========================================================================
    "διαφάνεια": {
        "back_text_ru": "прозрачность",
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
        "examples": [
            {
                "id": "ex_diafaneia1",
                "greek": "Η διαφάνεια είναι απαραίτητη στη δημόσια διοίκηση.",
                "english": "Transparency is essential in public administration.",
                "russian": "Прозрачность необходима в государственном управлении.",
            },
            {
                "id": "ex_diafaneia2",
                "greek": "Απαιτούμε πλήρη διαφάνεια στις διαδικασίες.",
                "english": "We demand full transparency in the procedures.",
                "russian": "Мы требуем полной прозрачности в процедурах.",
            },
        ],
    },
    "αειφορία": {
        "back_text_ru": "устойчивое развитие",
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
        "examples": [
            {
                "id": "ex_aeiforia1",
                "greek": "Η αειφορία είναι προτεραιότητα για το περιβάλλον.",
                "english": "Sustainability is a priority for the environment.",
                "russian": "Устойчивое развитие - приоритет для окружающей среды.",
            },
            {
                "id": "ex_aeiforia2",
                "greek": "Προωθούμε πολιτικές αειφορίας.",
                "english": "We promote sustainability policies.",
                "russian": "Мы продвигаем политику устойчивого развития.",
            },
        ],
    },
    "διακυβέρνηση": {
        "back_text_ru": "управление / руководство",
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
        "examples": [
            {
                "id": "ex_diakyvernisi1",
                "greek": "Η χρηστή διακυβέρνηση ενισχύει την εμπιστοσύνη.",
                "english": "Good governance strengthens trust.",
                "russian": "Хорошее управление укрепляет доверие.",
            },
            {
                "id": "ex_diakyvernisi2",
                "greek": "Η εταιρική διακυβέρνηση έχει βελτιωθεί.",
                "english": "Corporate governance has improved.",
                "russian": "Корпоративное управление улучшилось.",
            },
        ],
    },
    "αντικειμενικότητα": {
        "back_text_ru": "объективность",
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
        "examples": [
            {
                "id": "ex_antikeimenikotita1",
                "greek": "Η αντικειμενικότητα είναι σημαντική στην έρευνα.",
                "english": "Objectivity is important in research.",
                "russian": "Объективность важна в исследованиях.",
            },
            {
                "id": "ex_antikeimenikotita2",
                "greek": "Προσπαθούμε να διατηρήσουμε την αντικειμενικότητα.",
                "english": "We try to maintain objectivity.",
                "russian": "Мы стараемся сохранять объективность.",
            },
        ],
    },
    "υποκειμενικότητα": {
        "back_text_ru": "субъективность",
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
        "examples": [
            {
                "id": "ex_ypokeimenikotita1",
                "greek": "Η υποκειμενικότητα επηρεάζει την κρίση μας.",
                "english": "Subjectivity affects our judgment.",
                "russian": "Субъективность влияет на наше суждение.",
            },
            {
                "id": "ex_ypokeimenikotita2",
                "greek": "Πρέπει να αναγνωρίσουμε την υποκειμενικότητά μας.",
                "english": "We must recognize our subjectivity.",
                "russian": "Мы должны признать нашу субъективность.",
            },
        ],
    },
    "διεπιστημονικός": {
        "back_text_ru": "междисциплинарный",
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
        "examples": [
            {
                "id": "ex_diepistimonikos1",
                "greek": "Η έρευνα απαιτεί διεπιστημονική προσέγγιση.",
                "english": "The research requires an interdisciplinary approach.",
                "russian": "Исследование требует междисциплинарного подхода.",
            },
            {
                "id": "ex_diepistimonikos2",
                "greek": "Συμμετέχω σε ένα διεπιστημονικό πρόγραμμα.",
                "english": "I participate in an interdisciplinary program.",
                "russian": "Я участвую в междисциплинарной программе.",
            },
        ],
    },  # adjective
    "πολυπλοκότητα": {
        "back_text_ru": "сложность",
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
        "examples": [
            {
                "id": "ex_polyplokotita1",
                "greek": "Η πολυπλοκότητα του θέματος απαιτεί χρόνο.",
                "english": "The complexity of the topic requires time.",
                "russian": "Сложность темы требует времени.",
            },
            {
                "id": "ex_polyplokotita2",
                "greek": "Κατανοούμε την πολυπλοκότητα της κατάστασης.",
                "english": "We understand the complexity of the situation.",
                "russian": "Мы понимаем сложность ситуации.",
            },
        ],
    },
    "ενσωμάτωση": {
        "back_text_ru": "интеграция / включение",
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
        "examples": [
            {
                "id": "ex_ensomatosi1",
                "greek": "Η ενσωμάτωση νέων τεχνολογιών είναι απαραίτητη.",
                "english": "The integration of new technologies is essential.",
                "russian": "Интеграция новых технологий необходима.",
            },
            {
                "id": "ex_ensomatosi2",
                "greek": "Προχωρήσαμε στην ενσωμάτωση των δύο τμημάτων.",
                "english": "We proceeded with the integration of the two departments.",
                "russian": "Мы провели интеграцию двух отделов.",
            },
        ],
    },
    "διαφοροποίηση": {
        "back_text_ru": "дифференциация / различение",
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
        "examples": [
            {
                "id": "ex_diaforopoiisi1",
                "greek": "Η διαφοροποίηση των προϊόντων είναι στρατηγική.",
                "english": "Product differentiation is strategic.",
                "russian": "Дифференциация продуктов - это стратегия.",
            },
            {
                "id": "ex_diaforopoiisi2",
                "greek": "Υπάρχει διαφοροποίηση μεταξύ των δύο μεθόδων.",
                "english": "There is a differentiation between the two methods.",
                "russian": "Существует различие между двумя методами.",
            },
        ],
    },
    "συνεισφορά": {
        "back_text_ru": "вклад",
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
        "examples": [
            {
                "id": "ex_syneisfora1",
                "greek": "Η συνεισφορά του στην επιστήμη είναι μεγάλη.",
                "english": "His contribution to science is significant.",
                "russian": "Его вклад в науку значителен.",
            },
            {
                "id": "ex_syneisfora2",
                "greek": "Εκτιμούμε τη συνεισφορά κάθε μέλους.",
                "english": "We appreciate the contribution of each member.",
                "russian": "Мы ценим вклад каждого члена.",
            },
        ],
    },
    # ========================================================================
    # C2 Level (10 words) - Mastery level philosophical/academic
    # ========================================================================
    "μεταμοντερνισμός": {
        "back_text_ru": "постмодернизм",
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
        "examples": [
            {
                "id": "ex_metamonternismos1",
                "greek": "Ο μεταμοντερνισμός αμφισβητεί τις μεγάλες αφηγήσεις.",
                "english": "Postmodernism challenges the grand narratives.",
                "russian": "Постмодернизм оспаривает великие нарративы.",
            },
            {
                "id": "ex_metamonternismos2",
                "greek": "Η επιρροή του μεταμοντερνισμού στην τέχνη είναι εμφανής.",
                "english": "The influence of postmodernism on art is evident.",
                "russian": "Влияние постмодернизма на искусство очевидно.",
            },
        ],
    },
    "επιστημολογία": {
        "back_text_ru": "эпистемология / теория познания",
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
        "examples": [
            {
                "id": "ex_epistimologia1",
                "greek": "Η επιστημολογία μελετά τη φύση της γνώσης.",
                "english": "Epistemology studies the nature of knowledge.",
                "russian": "Эпистемология изучает природу знания.",
            },
            {
                "id": "ex_epistimologia2",
                "greek": "Τα επιστημολογικά ερωτήματα είναι θεμελιώδη.",
                "english": "Epistemological questions are fundamental.",
                "russian": "Эпистемологические вопросы фундаментальны.",
            },
        ],
    },
    "υπερβατικός": {
        "back_text_ru": "трансцендентный",
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
        "examples": [
            {
                "id": "ex_ypervatikos1",
                "greek": "Η υπερβατική φιλοσοφία εξερευνά τα όρια της εμπειρίας.",
                "english": "Transcendental philosophy explores the limits of experience.",
                "russian": "Трансцендентальная философия исследует границы опыта.",
            },
            {
                "id": "ex_ypervatikos2",
                "greek": "Είχε μια υπερβατική εμπειρία κατά τη διάρκεια του διαλογισμού.",
                "english": "He had a transcendental experience during meditation.",
                "russian": "Он пережил трансцендентный опыт во время медитации.",
            },
        ],
    },  # adjective
    "διαλεκτική": {
        "back_text_ru": "диалектика",
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
        "examples": [
            {
                "id": "ex_dialektiki1",
                "greek": "Η διαλεκτική είναι μέθοδος φιλοσοφικής ανάλυσης.",
                "english": "Dialectics is a method of philosophical analysis.",
                "russian": "Диалектика - это метод философского анализа.",
            },
            {
                "id": "ex_dialektiki2",
                "greek": "Η εγελιανή διαλεκτική βασίζεται στη σύνθεση αντιθέσεων.",
                "english": "Hegelian dialectics is based on the synthesis of opposites.",
                "russian": "Гегелевская диалектика основана на синтезе противоположностей.",
            },
        ],
    },
    "παραδειγματικός": {
        "back_text_ru": "парадигматический",
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
        "examples": [
            {
                "id": "ex_paradeigmatikos1",
                "greek": "Αυτή η θεωρία αποτελεί παραδειγματική αλλαγή.",
                "english": "This theory represents a paradigmatic shift.",
                "russian": "Эта теория представляет собой парадигматический сдвиг.",
            },
            {
                "id": "ex_paradeigmatikos2",
                "greek": "Είναι παραδειγματικό παράδειγμα καινοτομίας.",
                "english": "It is a paradigmatic example of innovation.",
                "russian": "Это парадигматический пример инновации.",
            },
        ],
    },  # adjective
    "αποδόμηση": {
        "back_text_ru": "деконструкция",
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
        "examples": [
            {
                "id": "ex_apodomisi1",
                "greek": "Η αποδόμηση αμφισβητεί τις δυαδικές αντιθέσεις.",
                "english": "Deconstruction challenges binary oppositions.",
                "russian": "Деконструкция оспаривает бинарные оппозиции.",
            },
            {
                "id": "ex_apodomisi2",
                "greek": "Ο Ντεριντά εισήγαγε την έννοια της αποδόμησης.",
                "english": "Derrida introduced the concept of deconstruction.",
                "russian": "Деррида ввел понятие деконструкции.",
            },
        ],
    },
    "ερμηνευτική": {
        "back_text_ru": "герменевтика",
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
        "examples": [
            {
                "id": "ex_ermineftiki1",
                "greek": "Η ερμηνευτική ασχολείται με την ερμηνεία κειμένων.",
                "english": "Hermeneutics deals with the interpretation of texts.",
                "russian": "Герменевтика занимается интерпретацией текстов.",
            },
            {
                "id": "ex_ermineftiki2",
                "greek": "Η φιλοσοφική ερμηνευτική επηρέασε τις ανθρωπιστικές επιστήμες.",
                "english": "Philosophical hermeneutics influenced the humanities.",
                "russian": "Философская герменевтика повлияла на гуманитарные науки.",
            },
        ],
    },
    "φαινομενολογία": {
        "back_text_ru": "феноменология",
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
        "examples": [
            {
                "id": "ex_fenomenologia1",
                "greek": "Η φαινομενολογία εξετάζει τη δομή της εμπειρίας.",
                "english": "Phenomenology examines the structure of experience.",
                "russian": "Феноменология исследует структуру опыта.",
            },
            {
                "id": "ex_fenomenologia2",
                "greek": "Ο Χούσερλ θεμελίωσε τη φαινομενολογία.",
                "english": "Husserl founded phenomenology.",
                "russian": "Гуссерль основал феноменологию.",
            },
        ],
    },
    "οντολογία": {
        "back_text_ru": "онтология",
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
        "examples": [
            {
                "id": "ex_ontologia1",
                "greek": "Η οντολογία μελετά τη φύση του είναι.",
                "english": "Ontology studies the nature of being.",
                "russian": "Онтология изучает природу бытия.",
            },
            {
                "id": "ex_ontologia2",
                "greek": "Τα οντολογικά ερωτήματα είναι κεντρικά στη μεταφυσική.",
                "english": "Ontological questions are central to metaphysics.",
                "russian": "Онтологические вопросы центральны в метафизике.",
            },
        ],
    },
    "αισθητική": {
        "back_text_ru": "эстетика",
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
        "examples": [
            {
                "id": "ex_aisthitiki1",
                "greek": "Η αισθητική εξετάζει την έννοια του ωραίου.",
                "english": "Aesthetics examines the concept of beauty.",
                "russian": "Эстетика исследует понятие красоты.",
            },
            {
                "id": "ex_aisthitiki2",
                "greek": "Η σύγχρονη αισθητική επαναπροσδιορίζει την τέχνη.",
                "english": "Modern aesthetics redefines art.",
                "russian": "Современная эстетика переопределяет искусство.",
            },
        ],
    },
}
