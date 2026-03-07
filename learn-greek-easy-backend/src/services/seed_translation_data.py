"""Seed data for reference.translations table.

Provides representative rows covering all source types (kaikki, freedict, pivot),
both languages (en, ru), multiple senses per lemma, and nullable part_of_speech.
Used by SeedService for E2E and integration test seeding.
"""

SEED_TRANSLATIONS: list[dict] = [
    # --- σπίτι (house) ---
    {
        "lemma": "σπίτι",
        "language": "en",
        "sense_index": 0,
        "translation": "house",
        "part_of_speech": "NOUN",
        "source": "kaikki",
    },
    {
        "lemma": "σπίτι",
        "language": "en",
        "sense_index": 1,
        "translation": "home",
        "part_of_speech": "NOUN",
        "source": "kaikki",
    },
    {
        "lemma": "σπίτι",
        "language": "ru",
        "sense_index": 0,
        "translation": "дом",
        "part_of_speech": "NOUN",
        "source": "freedict",
    },
    # --- τρέχω (run) ---
    {
        "lemma": "τρέχω",
        "language": "en",
        "sense_index": 0,
        "translation": "run",
        "part_of_speech": "VERB",
        "source": "kaikki",
    },
    {
        "lemma": "τρέχω",
        "language": "ru",
        "sense_index": 0,
        "translation": "бежать",
        "part_of_speech": "VERB",
        "source": "pivot",
    },
    # --- μεγάλος (big) ---
    {
        "lemma": "μεγάλος",
        "language": "en",
        "sense_index": 0,
        "translation": "big",
        "part_of_speech": "ADJ",
        "source": "freedict",
    },
    {
        "lemma": "μεγάλος",
        "language": "en",
        "sense_index": 1,
        "translation": "great",
        "part_of_speech": "ADJ",
        "source": "kaikki",
    },
    {
        "lemma": "μεγάλος",
        "language": "ru",
        "sense_index": 0,
        "translation": "большой",
        "part_of_speech": "ADJ",
        "source": "pivot",
    },
    # --- γρήγορα (quickly) — no part_of_speech ---
    {
        "lemma": "γρήγορα",
        "language": "en",
        "sense_index": 0,
        "translation": "quickly",
        "part_of_speech": None,
        "source": "kaikki",
    },
    {
        "lemma": "γρήγορα",
        "language": "ru",
        "sense_index": 0,
        "translation": "быстро",
        "part_of_speech": None,
        "source": "freedict",
    },
]
