"""Grammar data for enriched vocabulary seed data.

This module contains TypedDict definitions that match the Pydantic schemas in card.py,
along with the ENRICHED_VOCABULARY dictionary that will be populated with grammar data
for all 40 vocabulary words across CEFR levels A1-B2.
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
# All 40 words from CEFR levels A1-B2 are included as placeholders.
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
}
