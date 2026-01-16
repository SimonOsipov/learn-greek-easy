"""E2E Test Database Seeding Service.

Provides deterministic database seeding for E2E tests with:
- FK-safe table truncation
- Idempotent user creation
- Reproducible test data scenarios

IMPORTANT: This service should NEVER be used in production.
All methods check settings.can_seed_database() before executing.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Any, TypedDict
from uuid import UUID

from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.db.models import (
    Achievement,
    Card,
    CardDifficulty,
    CardStatistics,
    CardStatus,
    CultureDeck,
    CultureQuestion,
    CultureQuestionStats,
    Deck,
    DeckLevel,
    Feedback,
    FeedbackCategory,
    FeedbackStatus,
    FeedbackVote,
    Notification,
    NotificationType,
    Review,
    User,
    UserAchievement,
    UserDeckProgress,
    UserSettings,
    UserXP,
    VoteType,
)
from src.services.achievement_definitions import ACHIEVEMENTS as ACHIEVEMENT_DEFS
from src.services.xp_constants import get_level_from_xp


class FeedbackSeedData(TypedDict):
    """Type definition for feedback seed data items."""

    title: str
    description: str
    category: FeedbackCategory
    status: FeedbackStatus
    user_idx: int


class NotificationSeedData(TypedDict, total=False):
    """Type definition for notification seed data items."""

    type: NotificationType
    title: str
    message: str
    icon: str
    action_url: str
    extra_data: dict[str, Any] | None
    read: bool
    read_at: datetime
    created_at: datetime


class SeedService:
    """Service for seeding E2E test database with deterministic data.

    IMPORTANT: This service should NEVER be used in production.
    All methods check settings.can_seed_database() before executing.

    Usage:
        async with async_session() as db:
            seed_service = SeedService(db)
            result = await seed_service.seed_all()
    """

    # FK-safe truncation order (children first, then parents)
    TRUNCATION_ORDER = [
        # XP & Achievement tables (children first)
        "xp_transactions",
        "user_achievements",
        "user_xp",
        "achievements",
        # Notification tables
        "notifications",
        # Culture tables (children first)
        "culture_question_stats",
        "culture_questions",
        "culture_decks",
        # Existing tables
        "reviews",
        "card_statistics",
        "user_deck_progress",
        "feedback_votes",
        "feedback",
        "refresh_tokens",
        "user_settings",
        "cards",
        "users",
        "decks",
    ]

    # Default test user password (hashed once for performance)
    DEFAULT_PASSWORD = "TestPassword123!"

    # Greek vocabulary by CEFR level
    VOCABULARY = {
        DeckLevel.A1: [
            ("γεια", "hello", "Common greeting"),
            ("ναι", "yes", "Affirmative"),
            ("όχι", "no", "Negative"),
            ("ευχαριστώ", "thank you", "Gratitude"),
            ("παρακαλώ", "please/you're welcome", "Politeness"),
            ("νερό", "water", "Basic noun"),
            ("ψωμί", "bread", "Basic noun"),
            ("σπίτι", "house", "Basic noun"),
            ("καλημέρα", "good morning", "Morning greeting"),
            ("καληνύχτα", "good night", "Night greeting"),
        ],
        DeckLevel.A2: [
            ("δουλειά", "work/job", "Employment"),
            ("οικογένεια", "family", "Relations"),
            ("φίλος", "friend", "Relations"),
            ("αγαπώ", "I love", "Emotion verb"),
            ("θέλω", "I want", "Desire verb"),
            ("μπορώ", "I can", "Ability verb"),
            ("πρέπει", "must/should", "Obligation"),
            ("χρόνια", "years", "Time"),
            ("σήμερα", "today", "Time"),
            ("αύριο", "tomorrow", "Time"),
        ],
        DeckLevel.B1: [
            ("συζήτηση", "discussion", "Communication"),
            ("απόφαση", "decision", "Abstract noun"),
            ("εμπειρία", "experience", "Abstract noun"),
            ("προσπαθώ", "I try", "Effort verb"),
            ("επιτυγχάνω", "I achieve", "Success verb"),
            ("αναπτύσσω", "I develop", "Growth verb"),
            ("κατάσταση", "situation", "State noun"),
            ("σχέση", "relationship", "Connection noun"),
            ("ευκαιρία", "opportunity", "Chance noun"),
            ("πρόβλημα", "problem", "Challenge noun"),
        ],
        DeckLevel.B2: [
            ("διαπραγμάτευση", "negotiation", "Business"),
            ("συμφωνία", "agreement", "Contract"),
            ("ανάλυση", "analysis", "Examination"),
            ("επιχείρηση", "enterprise/business", "Commerce"),
            ("στρατηγική", "strategy", "Planning"),
            ("αποτέλεσμα", "result/outcome", "Conclusion"),
            ("επιρροή", "influence", "Impact"),
            ("παράγοντας", "factor", "Element"),
            ("προτεραιότητα", "priority", "Importance"),
            ("αξιολόγηση", "evaluation", "Assessment"),
        ],
        DeckLevel.C1: [
            ("διαφάνεια", "transparency", "Openness"),
            ("αειφορία", "sustainability", "Environment"),
            ("διακυβέρνηση", "governance", "Administration"),
            ("αντικειμενικότητα", "objectivity", "Impartiality"),
            ("υποκειμενικότητα", "subjectivity", "Personal view"),
            ("διεπιστημονικός", "interdisciplinary", "Academic"),
            ("πολυπλοκότητα", "complexity", "Intricacy"),
            ("ενσωμάτωση", "integration", "Incorporation"),
            ("διαφοροποίηση", "differentiation", "Distinction"),
            ("συνεισφορά", "contribution", "Input"),
        ],
        DeckLevel.C2: [
            ("μεταμοντερνισμός", "postmodernism", "Philosophy"),
            ("επιστημολογία", "epistemology", "Theory of knowledge"),
            ("υπερβατικός", "transcendent", "Beyond experience"),
            ("διαλεκτική", "dialectic", "Philosophical method"),
            ("παραδειγματικός", "paradigmatic", "Model example"),
            ("αποδόμηση", "deconstruction", "Analysis method"),
            ("ερμηνευτική", "hermeneutics", "Interpretation theory"),
            ("φαινομενολογία", "phenomenology", "Philosophy branch"),
            ("οντολογία", "ontology", "Study of being"),
            ("αισθητική", "aesthetics", "Beauty philosophy"),
        ],
    }

    # Culture categories with deck definitions (simple English strings)
    CULTURE_DECKS = {
        "history": {
            "name": "Greek History",
            "description": "Questions about Greek history",
            "icon": "book-open",
            "color_accent": "#8B4513",
        },
        "geography": {
            "name": "Greek Geography",
            "description": "Questions about Greek geography",
            "icon": "map",
            "color_accent": "#228B22",
        },
        "politics": {
            "name": "Political System",
            "description": "Questions about the political system",
            "icon": "landmark",
            "color_accent": "#4169E1",
        },
        "culture": {
            "name": "Greek Culture",
            "description": "Questions about Greek culture",
            "icon": "palette",
            "color_accent": "#9932CC",
        },
        "traditions": {
            "name": "Traditions and Customs",
            "description": "Questions about Greek traditions",
            "icon": "star",
            "color_accent": "#DAA520",
        },
    }

    # Culture questions by category - 10 questions each (50 total)
    CULTURE_QUESTIONS: dict[str, list[dict[str, Any]]] = {
        "history": [
            {
                "question_text": {
                    "el": "Ποιος ήταν ο πρώτος βασιλιάς της σύγχρονης Ελλάδας;",
                    "en": "Who was the first king of modern Greece?",
                    "ru": "Кто был первым королем современной Греции?",
                },
                "options": [
                    {"el": "Όθων", "en": "Otto", "ru": "Оттон"},
                    {"el": "Γεώργιος Α'", "en": "George I", "ru": "Георг I"},
                    {"el": "Κωνσταντίνος Α'", "en": "Constantine I", "ru": "Константин I"},
                    {"el": "Παύλος", "en": "Paul", "ru": "Павел"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Πότε ξεκίνησε η Ελληνική Επανάσταση;",
                    "en": "When did the Greek Revolution begin?",
                    "ru": "Когда началась Греческая революция?",
                },
                "options": [
                    {"el": "1821", "en": "1821", "ru": "1821"},
                    {"el": "1832", "en": "1832", "ru": "1832"},
                    {"el": "1800", "en": "1800", "ru": "1800"},
                    {"el": "1912", "en": "1912", "ru": "1912"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Πότε έγινε η Ελλάδα μέλος της Ευρωπαϊκής Ένωσης;",
                    "en": "When did Greece join the European Union?",
                    "ru": "Когда Греция вступила в Европейский Союз?",
                },
                "options": [
                    {"el": "1981", "en": "1981", "ru": "1981"},
                    {"el": "1974", "en": "1974", "ru": "1974"},
                    {"el": "1992", "en": "1992", "ru": "1992"},
                    {"el": "2001", "en": "2001", "ru": "2001"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποιος ήταν ο εθνικός ήρωας της Ελληνικής Επανάστασης;",
                    "en": "Who was the national hero of the Greek Revolution?",
                    "ru": "Кто был национальным героем Греческой революции?",
                },
                "options": [
                    {
                        "el": "Θεόδωρος Κολοκοτρώνης",
                        "en": "Theodoros Kolokotronis",
                        "ru": "Теодорос Колокотронис",
                    },
                    {
                        "el": "Ελευθέριος Βενιζέλος",
                        "en": "Eleftherios Venizelos",
                        "ru": "Элефтериос Венизелос",
                    },
                    {
                        "el": "Ιωάννης Καποδίστριας",
                        "en": "Ioannis Kapodistrias",
                        "ru": "Иоаннис Каподистрия",
                    },
                    {
                        "el": "Αλέξανδρος Υψηλάντης",
                        "en": "Alexandros Ypsilantis",
                        "ru": "Александрос Ипсилантис",
                    },
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Πότε καταργήθηκε η μοναρχία στην Ελλάδα;",
                    "en": "When was the monarchy abolished in Greece?",
                    "ru": "Когда была упразднена монархия в Греции?",
                },
                "options": [
                    {"el": "1974", "en": "1974", "ru": "1974"},
                    {"el": "1967", "en": "1967", "ru": "1967"},
                    {"el": "1981", "en": "1981", "ru": "1981"},
                    {"el": "1946", "en": "1946", "ru": "1946"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποιος ήταν ο πρώτος κυβερνήτης της Ελλάδας;",
                    "en": "Who was the first governor of Greece?",
                    "ru": "Кто был первым правителем Греции?",
                },
                "options": [
                    {
                        "el": "Ιωάννης Καποδίστριας",
                        "en": "Ioannis Kapodistrias",
                        "ru": "Иоаннис Каподистрия",
                    },
                    {"el": "Όθων", "en": "Otto", "ru": "Оттон"},
                    {
                        "el": "Θεόδωρος Κολοκοτρώνης",
                        "en": "Theodoros Kolokotronis",
                        "ru": "Теодорос Колокотронис",
                    },
                    {
                        "el": "Αλέξανδρος Μαυροκορδάτος",
                        "en": "Alexandros Mavrokordatos",
                        "ru": "Александрос Маврокордатос",
                    },
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Πότε ανακηρύχθηκε η ανεξαρτησία της Ελλάδας;",
                    "en": "When was Greece's independence declared?",
                    "ru": "Когда была провозглашена независимость Греции?",
                },
                "options": [
                    {"el": "1822", "en": "1822", "ru": "1822"},
                    {"el": "1821", "en": "1821", "ru": "1821"},
                    {"el": "1830", "en": "1830", "ru": "1830"},
                    {"el": "1832", "en": "1832", "ru": "1832"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποιος Έλληνας πολιτικός θεωρείται ο ιδρυτής του σύγχρονου ελληνικού κράτους;",
                    "en": "Which Greek politician is considered the founder of the modern Greek state?",
                    "ru": "Какой греческий политик считается основателем современного греческого государства?",
                },
                "options": [
                    {
                        "el": "Ελευθέριος Βενιζέλος",
                        "en": "Eleftherios Venizelos",
                        "ru": "Элефтериос Венизелос",
                    },
                    {
                        "el": "Ιωάννης Καποδίστριας",
                        "en": "Ioannis Kapodistrias",
                        "ru": "Иоаннис Каподистрия",
                    },
                    {
                        "el": "Κωνσταντίνος Καραμανλής",
                        "en": "Konstantinos Karamanlis",
                        "ru": "Константинос Караманлис",
                    },
                    {
                        "el": "Ανδρέας Παπανδρέου",
                        "en": "Andreas Papandreou",
                        "ru": "Андреас Папандреу",
                    },
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Πόσα χρόνια διήρκεσε η Οθωμανική κυριαρχία στην Ελλάδα;",
                    "en": "How many years did Ottoman rule last in Greece?",
                    "ru": "Сколько лет длилось османское владычество в Греции?",
                },
                "options": [
                    {"el": "Περίπου 400", "en": "About 400", "ru": "Около 400"},
                    {"el": "Περίπου 200", "en": "About 200", "ru": "Около 200"},
                    {"el": "Περίπου 500", "en": "About 500", "ru": "Около 500"},
                    {"el": "Περίπου 300", "en": "About 300", "ru": "Около 300"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποιο ήταν το σύνθημα της Ελληνικής Επανάστασης;",
                    "en": "What was the motto of the Greek Revolution?",
                    "ru": "Каким был девиз Греческой революции?",
                },
                "options": [
                    {
                        "el": "Ελευθερία ή Θάνατος",
                        "en": "Freedom or Death",
                        "ru": "Свобода или смерть",
                    },
                    {"el": "Ένωση και Δύναμη", "en": "Unity and Strength", "ru": "Единство и сила"},
                    {"el": "Νίκη ή Θάνατος", "en": "Victory or Death", "ru": "Победа или смерть"},
                    # Note: Only 3 options - testing variable answer count support
                ],
                "correct_option": 1,
            },
        ],
        "geography": [
            {
                "question_text": {
                    "el": "Ποια είναι η πρωτεύουσα της Ελλάδας;",
                    "en": "What is the capital of Greece?",
                    "ru": "Какая столица Греции?",
                },
                "options": [
                    {"el": "Αθήνα", "en": "Athens", "ru": "Афины"},
                    {"el": "Θεσσαλονίκη", "en": "Thessaloniki", "ru": "Салоники"},
                    {"el": "Πάτρα", "en": "Patras", "ru": "Патры"},
                    {"el": "Ηράκλειο", "en": "Heraklion", "ru": "Ираклион"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποιο είναι το μεγαλύτερο νησί της Ελλάδας;",
                    "en": "What is the largest island of Greece?",
                    "ru": "Какой самый большой остров Греции?",
                },
                "options": [
                    {"el": "Κρήτη", "en": "Crete", "ru": "Крит"},
                    {"el": "Εύβοια", "en": "Euboea", "ru": "Эвбея"},
                    {"el": "Ρόδος", "en": "Rhodes", "ru": "Родос"},
                    {"el": "Λέσβος", "en": "Lesbos", "ru": "Лесбос"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποιο είναι το ψηλότερο βουνό της Ελλάδας;",
                    "en": "What is the highest mountain in Greece?",
                    "ru": "Какая самая высокая гора в Греции?",
                },
                "options": [
                    {"el": "Όλυμπος", "en": "Olympus", "ru": "Олимп"},
                    {"el": "Παρνασσός", "en": "Parnassus", "ru": "Парнас"},
                    {"el": "Πίνδος", "en": "Pindus", "ru": "Пинд"},
                    {"el": "Ταΰγετος", "en": "Taygetus", "ru": "Тайгет"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Πόσες περιφέρειες έχει η Ελλάδα;",
                    "en": "How many regions does Greece have?",
                    "ru": "Сколько регионов в Греции?",
                },
                "options": [
                    {"el": "13", "en": "13", "ru": "13"},
                    {"el": "10", "en": "10", "ru": "10"},
                    {"el": "15", "en": "15", "ru": "15"},
                    {"el": "12", "en": "12", "ru": "12"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποια θάλασσα βρέχει τη δυτική Ελλάδα;",
                    "en": "Which sea borders western Greece?",
                    "ru": "Какое море омывает западную Грецию?",
                },
                "options": [
                    {"el": "Ιόνιο Πέλαγος", "en": "Ionian Sea", "ru": "Ионическое море"},
                    {"el": "Αιγαίο Πέλαγος", "en": "Aegean Sea", "ru": "Эгейское море"},
                    {
                        "el": "Μεσόγειος Θάλασσα",
                        "en": "Mediterranean Sea",
                        "ru": "Средиземное море",
                    },
                    {"el": "Μαύρη Θάλασσα", "en": "Black Sea", "ru": "Чёрное море"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποια είναι η δεύτερη μεγαλύτερη πόλη της Ελλάδας;",
                    "en": "What is the second largest city in Greece?",
                    "ru": "Какой второй по величине город в Греции?",
                },
                "options": [
                    {"el": "Θεσσαλονίκη", "en": "Thessaloniki", "ru": "Салоники"},
                    {"el": "Πάτρα", "en": "Patras", "ru": "Патры"},
                    {"el": "Ηράκλειο", "en": "Heraklion", "ru": "Ираклион"},
                    {"el": "Λάρισα", "en": "Larissa", "ru": "Лариса"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Με πόσες χώρες συνορεύει η Ελλάδα;",
                    "en": "How many countries does Greece border?",
                    "ru": "С какими странами граничит Греция?",
                },
                "options": [
                    {"el": "4", "en": "4", "ru": "4"},
                    {"el": "3", "en": "3", "ru": "3"},
                    {"el": "5", "en": "5", "ru": "5"},
                    {"el": "2", "en": "2", "ru": "2"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Περίπου πόσα νησιά έχει η Ελλάδα;",
                    "en": "Approximately how many islands does Greece have?",
                    "ru": "Приблизительно сколько островов в Греции?",
                },
                "options": [
                    {"el": "6000", "en": "6000", "ru": "6000"},
                    {"el": "3000", "en": "3000", "ru": "3000"},
                    {"el": "1000", "en": "1000", "ru": "1000"},
                    {"el": "500", "en": "500", "ru": "500"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποιος ποταμός είναι ο μακρύτερος στην Ελλάδα;",
                    "en": "Which river is the longest in Greece?",
                    "ru": "Какая река самая длинная в Греции?",
                },
                "options": [
                    {"el": "Αλιάκμονας", "en": "Aliakmonas", "ru": "Альякмонас"},
                    {"el": "Αξιός", "en": "Axios", "ru": "Аксьос"},
                    {"el": "Πηνειός", "en": "Pinios", "ru": "Пиньос"},
                    {"el": "Αχελώος", "en": "Acheloos", "ru": "Ахелоос"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποια περιοχή της Ελλάδας είναι γνωστή ως η γη των θεών;",
                    "en": "Which region of Greece is known as the land of the gods?",
                    "ru": "Какой регион Греции известен как земля богов?",
                },
                "options": [
                    {
                        "el": "Μακεδονία (Όλυμπος)",
                        "en": "Macedonia (Olympus)",
                        "ru": "Македония (Олимп)",
                    },
                    {"el": "Πελοπόννησος", "en": "Peloponnese", "ru": "Пелопоннес"},
                    {"el": "Κρήτη", "en": "Crete", "ru": "Крит"},
                    {"el": "Αττική", "en": "Attica", "ru": "Аттика"},
                ],
                "correct_option": 1,
            },
        ],
        "politics": [
            {
                "question_text": {
                    "el": "Ποιο είναι το πολίτευμα της Ελλάδας;",
                    "en": "What is the form of government in Greece?",
                    "ru": "Какая форма правления в Греции?",
                },
                "options": [
                    {
                        "el": "Προεδρευόμενη Κοινοβουλευτική Δημοκρατία",
                        "en": "Parliamentary Republic",
                        "ru": "Парламентская республика",
                    },
                    {
                        "el": "Συνταγματική Μοναρχία",
                        "en": "Constitutional Monarchy",
                        "ru": "Конституционная монархия",
                    },
                    {
                        "el": "Προεδρική Δημοκρατία",
                        "en": "Presidential Republic",
                        "ru": "Президентская республика",
                    },
                    {"el": "Ομοσπονδία", "en": "Federation", "ru": "Федерация"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Πόσα χρόνια διαρκεί η θητεία του Προέδρου της Δημοκρατίας;",
                    "en": "How many years is the term of the President of the Republic?",
                    "ru": "Сколько лет длится срок полномочий Президента Республики?",
                },
                "options": [
                    {"el": "5", "en": "5", "ru": "5"},
                    {"el": "4", "en": "4", "ru": "4"},
                    {"el": "6", "en": "6", "ru": "6"},
                    {"el": "7", "en": "7", "ru": "7"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Πόσους βουλευτές έχει η Ελληνική Βουλή;",
                    "en": "How many members does the Greek Parliament have?",
                    "ru": "Сколько депутатов в греческом парламенте?",
                },
                "options": [
                    {"el": "300", "en": "300", "ru": "300"},
                    {"el": "250", "en": "250", "ru": "250"},
                    {"el": "350", "en": "350", "ru": "350"},
                    {"el": "200", "en": "200", "ru": "200"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποιος εκλέγει τον Πρόεδρο της Δημοκρατίας;",
                    "en": "Who elects the President of the Republic?",
                    "ru": "Кто избирает Президента Республики?",
                },
                "options": [
                    {
                        "el": "Η Βουλή των Ελλήνων",
                        "en": "The Hellenic Parliament",
                        "ru": "Парламент Греции",
                    },
                    {
                        "el": "Ο λαός με άμεση ψηφοφορία",
                        "en": "The people by direct vote",
                        "ru": "Народ прямым голосованием",
                    },
                    {"el": "Ο Πρωθυπουργός", "en": "The Prime Minister", "ru": "Премьер-министр"},
                    {
                        "el": "Το Υπουργικό Συμβούλιο",
                        "en": "The Cabinet",
                        "ru": "Кабинет министров",
                    },
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Κάθε πόσα χρόνια γίνονται εκλογές για τη Βουλή;",
                    "en": "How often are parliamentary elections held?",
                    "ru": "Как часто проводятся парламентские выборы?",
                },
                "options": [
                    {"el": "4", "en": "4", "ru": "4"},
                    {"el": "3", "en": "3", "ru": "3"},
                    {"el": "5", "en": "5", "ru": "5"},
                    {"el": "6", "en": "6", "ru": "6"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποιο είναι το ανώτατο δικαστήριο στην Ελλάδα;",
                    "en": "What is the highest court in Greece?",
                    "ru": "Какой высший суд в Греции?",
                },
                "options": [
                    {
                        "el": "Άρειος Πάγος",
                        "en": "Areios Pagos (Supreme Court)",
                        "ru": "Ареопаг (Верховный суд)",
                    },
                    {
                        "el": "Συμβούλιο της Επικρατείας",
                        "en": "Council of State",
                        "ru": "Государственный совет",
                    },
                    {"el": "Ελεγκτικό Συνέδριο", "en": "Court of Audit", "ru": "Счётная палата"},
                    {
                        "el": "Ανώτατο Ειδικό Δικαστήριο",
                        "en": "Supreme Special Court",
                        "ru": "Специальный Верховный суд",
                    },
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποιο είναι το ελάχιστο ποσοστό για είσοδο στη Βουλή;",
                    "en": "What is the minimum percentage to enter Parliament?",
                    "ru": "Какой минимальный процент для прохождения в парламент?",
                },
                "options": [
                    {"el": "3%", "en": "3%", "ru": "3%"},
                    {"el": "5%", "en": "5%", "ru": "5%"},
                    {"el": "4%", "en": "4%", "ru": "4%"},
                    {"el": "2%", "en": "2%", "ru": "2%"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Από ποια ηλικία έχει κανείς δικαίωμα ψήφου στην Ελλάδα;",
                    "en": "From what age can one vote in Greece?",
                    "ru": "С какого возраста можно голосовать в Греции?",
                },
                "options": [
                    {"el": "17", "en": "17", "ru": "17"},
                    {"el": "18", "en": "18", "ru": "18"},
                    {"el": "21", "en": "21", "ru": "21"},
                    {"el": "16", "en": "16", "ru": "16"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποια είναι η εθνική εορτή της Ελλάδας;",
                    "en": "What is the national day of Greece?",
                    "ru": "Какой национальный праздник Греции?",
                },
                "options": [
                    {"el": "25 Μαρτίου", "en": "March 25", "ru": "25 марта"},
                    {"el": "28 Οκτωβρίου", "en": "October 28", "ru": "28 октября"},
                    {"el": "17 Νοεμβρίου", "en": "November 17", "ru": "17 ноября"},
                    {"el": "15 Αυγούστου", "en": "August 15", "ru": "15 августа"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Τι είναι η Βουλή των Ελλήνων;",
                    "en": "What is the Hellenic Parliament?",
                    "ru": "Что такое Парламент Греции?",
                },
                "options": [
                    {
                        "el": "Το νομοθετικό σώμα της χώρας",
                        "en": "The legislative body of the country",
                        "ru": "Законодательный орган страны",
                    },
                    {
                        "el": "Το δικαστικό σώμα της χώρας",
                        "en": "The judicial body of the country",
                        "ru": "Судебный орган страны",
                    },
                    {
                        "el": "Η κυβέρνηση της χώρας",
                        "en": "The government of the country",
                        "ru": "Правительство страны",
                    },
                    {
                        "el": "Το στρατιωτικό συμβούλιο",
                        "en": "The military council",
                        "ru": "Военный совет",
                    },
                ],
                "correct_option": 1,
            },
        ],
        "culture": [
            {
                "question_text": {
                    "el": "Ποιος έγραψε την Οδύσσεια;",
                    "en": "Who wrote the Odyssey?",
                    "ru": "Кто написал Одиссею?",
                },
                "options": [
                    {"el": "Όμηρος", "en": "Homer", "ru": "Гомер"},
                    {"el": "Σοφοκλής", "en": "Sophocles", "ru": "Софокл"},
                    {"el": "Πλάτων", "en": "Plato", "ru": "Платон"},
                    {"el": "Αριστοτέλης", "en": "Aristotle", "ru": "Аристотель"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποιος είναι ο εθνικός ύμνος της Ελλάδας;",
                    "en": "What is the national anthem of Greece?",
                    "ru": "Какой национальный гимн Греции?",
                },
                "options": [
                    {
                        "el": "Ύμνος εις την Ελευθερίαν",
                        "en": "Hymn to Liberty",
                        "ru": "Гимн Свободе",
                    },
                    {
                        "el": "Η Ελλάς ποτέ δεν πεθαίνει",
                        "en": "Greece Never Dies",
                        "ru": "Греция никогда не умрёт",
                    },
                    {"el": "Δόξα και Τιμή", "en": "Glory and Honor", "ru": "Слава и честь"},
                    {
                        "el": "Μακεδονία Ξακουστή",
                        "en": "Famous Macedonia",
                        "ru": "Славная Македония",
                    },
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποιος Έλληνας ποιητής κέρδισε το Νόμπελ Λογοτεχνίας;",
                    "en": "Which Greek poet won the Nobel Prize in Literature?",
                    "ru": "Какой греческий поэт получил Нобелевскую премию по литературе?",
                },
                "options": [
                    {"el": "Γιώργος Σεφέρης", "en": "George Seferis", "ru": "Йоргос Сеферис"},
                    {
                        "el": "Κωνσταντίνος Καβάφης",
                        "en": "Constantine Cavafy",
                        "ru": "Константинос Кавафис",
                    },
                    {"el": "Οδυσσέας Ελύτης", "en": "Odysseas Elytis", "ru": "Одиссеас Элитис"},
                    {
                        "el": "Νίκος Καζαντζάκης",
                        "en": "Nikos Kazantzakis",
                        "ru": "Никос Казандзакис",
                    },
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποιο είναι το πιο διάσημο αρχαιοελληνικό θέατρο;",
                    "en": "What is the most famous ancient Greek theater?",
                    "ru": "Какой самый известный древнегреческий театр?",
                },
                "options": [
                    {
                        "el": "Θέατρο Επιδαύρου",
                        "en": "Theatre of Epidaurus",
                        "ru": "Театр Эпидавра",
                    },
                    {
                        "el": "Ηρώδειο",
                        "en": "Odeon of Herodes Atticus",
                        "ru": "Одеон Герода Аттика",
                    },
                    {"el": "Θέατρο Διονύσου", "en": "Theatre of Dionysus", "ru": "Театр Диониса"},
                    {
                        "el": "Αρχαίο Θέατρο Δελφών",
                        "en": "Ancient Theatre of Delphi",
                        "ru": "Древний театр Дельф",
                    },
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποιο είναι το εθνικό χορευτικό στυλ της Ελλάδας;",
                    "en": "What is the national dance style of Greece?",
                    "ru": "Какой национальный танцевальный стиль Греции?",
                },
                "options": [
                    {"el": "Συρτάκι", "en": "Sirtaki", "ru": "Сиртаки"},
                    {"el": "Καλαματιανός", "en": "Kalamatianos", "ru": "Каламатьянос"},
                    {"el": "Χασάπικο", "en": "Hasapiko", "ru": "Хасапико"},
                    {"el": "Τσάμικο", "en": "Tsamiko", "ru": "Цамико"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποιο αρχαίο ελληνικό μνημείο είναι σύμβολο της Αθήνας;",
                    "en": "Which ancient Greek monument is a symbol of Athens?",
                    "ru": "Какой древнегреческий памятник является символом Афин?",
                },
                "options": [
                    {"el": "Παρθενώνας", "en": "Parthenon", "ru": "Парфенон"},
                    {
                        "el": "Ναός του Ολυμπίου Διός",
                        "en": "Temple of Olympian Zeus",
                        "ru": "Храм Зевса Олимпийского",
                    },
                    {"el": "Αρχαία Αγορά", "en": "Ancient Agora", "ru": "Древняя Агора"},
                    {"el": "Ερεχθείο", "en": "Erechtheion", "ru": "Эрехтейон"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποια είναι η επίσημη θρησκεία της Ελλάδας;",
                    "en": "What is the official religion of Greece?",
                    "ru": "Какая официальная религия Греции?",
                },
                "options": [
                    {
                        "el": "Ελληνική Ορθόδοξη Χριστιανική",
                        "en": "Greek Orthodox Christian",
                        "ru": "Греческое православие",
                    },
                    {"el": "Ρωμαιοκαθολική", "en": "Roman Catholic", "ru": "Римско-католическая"},
                    {"el": "Προτεσταντική", "en": "Protestant", "ru": "Протестантизм"},
                    {
                        "el": "Δεν υπάρχει επίσημη θρησκεία",
                        "en": "No official religion",
                        "ru": "Нет официальной религии",
                    },
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποια είναι η διάσημη ελληνική μουσική που συνδέεται με το ρεμπέτικο;",
                    "en": "What is the famous Greek music associated with rebetiko?",
                    "ru": "Какая известная греческая музыка связана с ребетико?",
                },
                "options": [
                    {"el": "Λαϊκή μουσική", "en": "Folk music", "ru": "Народная музыка"},
                    {"el": "Κλασική μουσική", "en": "Classical music", "ru": "Классическая музыка"},
                    {
                        "el": "Βυζαντινή μουσική",
                        "en": "Byzantine music",
                        "ru": "Византийская музыка",
                    },
                    {
                        "el": "Δημοτική μουσική",
                        "en": "Traditional music",
                        "ru": "Традиционная музыка",
                    },
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποιος Έλληνας σκηνοθέτης κέρδισε το Όσκαρ καλύτερης ταινίας;",
                    "en": "Which Greek director won the Oscar for Best Picture?",
                    "ru": "Какой греческий режиссёр получил Оскар за лучший фильм?",
                },
                "options": [
                    {"el": "Γιώργος Λάνθιμος", "en": "Yorgos Lanthimos", "ru": "Йоргос Лантимос"},
                    {"el": "Κώστας Γαβράς", "en": "Costa-Gavras", "ru": "Коста-Гаврас"},
                    {
                        "el": "Θεόδωρος Αγγελόπουλος",
                        "en": "Theo Angelopoulos",
                        "ru": "Тео Ангелопулос",
                    },
                    {
                        "el": "Μιχάλης Κακογιάννης",
                        "en": "Michael Cacoyannis",
                        "ru": "Михалис Какояннис",
                    },
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποιο είναι το εθνικό ποτό της Ελλάδας;",
                    "en": "What is the national drink of Greece?",
                    "ru": "Какой национальный напиток Греции?",
                },
                "options": [
                    {"el": "Ούζο", "en": "Ouzo", "ru": "Узо"},
                    {"el": "Τσίπουρο", "en": "Tsipouro", "ru": "Ципуро"},
                    {"el": "Ρετσίνα", "en": "Retsina", "ru": "Рецина"},
                    {"el": "Μεταξά", "en": "Metaxa", "ru": "Метакса"},
                ],
                "correct_option": 1,
            },
        ],
        "traditions": [
            {
                "question_text": {
                    "el": "Πότε γιορτάζεται το Πάσχα στην Ελλάδα;",
                    "en": "When is Easter celebrated in Greece?",
                    "ru": "Когда празднуется Пасха в Греции?",
                },
                "options": [
                    {
                        "el": "Σύμφωνα με το Ορθόδοξο ημερολόγιο",
                        "en": "According to the Orthodox calendar",
                        "ru": "По православному календарю",
                    },
                    {
                        "el": "Σύμφωνα με το Δυτικό ημερολόγιο",
                        "en": "According to the Western calendar",
                        "ru": "По западному календарю",
                    },
                    {"el": "Πάντα τον Μάρτιο", "en": "Always in March", "ru": "Всегда в марте"},
                    {"el": "Πάντα τον Απρίλιο", "en": "Always in April", "ru": "Всегда в апреле"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποιο είναι το παραδοσιακό φαγητό του Πάσχα στην Ελλάδα;",
                    "en": "What is the traditional Easter food in Greece?",
                    "ru": "Какое традиционное пасхальное блюдо в Греции?",
                },
                "options": [
                    {
                        "el": "Αρνί και κόκκινα αυγά",
                        "en": "Lamb and red eggs",
                        "ru": "Ягнёнок и красные яйца",
                    },
                    {"el": "Γαλοπούλα", "en": "Turkey", "ru": "Индейка"},
                    {"el": "Ψάρι", "en": "Fish", "ru": "Рыба"},
                    {"el": "Χοιρινό", "en": "Pork", "ru": "Свинина"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Τι γιορτάζεται στις 28 Οκτωβρίου;",
                    "en": "What is celebrated on October 28?",
                    "ru": "Что отмечается 28 октября?",
                },
                "options": [
                    {
                        "el": "Η επέτειος του ΟΧΙ",
                        "en": "Oxi Day Anniversary",
                        "ru": "Годовщина дня Охи",
                    },
                    {
                        "el": "Η Ελληνική Επανάσταση",
                        "en": "Greek Revolution",
                        "ru": "Греческая революция",
                    },
                    {
                        "el": "Η απελευθέρωση της Αθήνας",
                        "en": "Liberation of Athens",
                        "ru": "Освобождение Афин",
                    },
                    {
                        "el": "Η ίδρυση της Δημοκρατίας",
                        "en": "Founding of the Republic",
                        "ru": "Основание республики",
                    },
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποιο είναι το παραδοσιακό ελληνικό γλυκό για τον γάμο;",
                    "en": "What is the traditional Greek wedding sweet?",
                    "ru": "Какой традиционный греческий свадебный десерт?",
                },
                "options": [
                    {
                        "el": "Κουφέτα",
                        "en": "Jordan almonds (Koufeta)",
                        "ru": "Миндаль в сахаре (Куфета)",
                    },
                    {"el": "Μπακλαβάς", "en": "Baklava", "ru": "Пахлава"},
                    {"el": "Γαλακτομπούρεκο", "en": "Galaktoboureko", "ru": "Галактобуреко"},
                    {"el": "Λουκουμάδες", "en": "Loukoumades", "ru": "Лукумадес"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Τι παράδοση υπάρχει την Πρωτοχρονιά στην Ελλάδα;",
                    "en": "What tradition exists on New Year's Day in Greece?",
                    "ru": "Какая традиция существует в Новый год в Греции?",
                },
                "options": [
                    {
                        "el": "Κόβουμε τη βασιλόπιτα",
                        "en": "Cutting the Vasilopita",
                        "ru": "Разрезание Василопиты",
                    },
                    {"el": "Ανάβουμε κεριά", "en": "Lighting candles", "ru": "Зажигание свечей"},
                    {"el": "Τρώμε σταφύλια", "en": "Eating grapes", "ru": "Едим виноград"},
                    {"el": "Πετάμε πιάτα", "en": "Throwing plates", "ru": "Бросание тарелок"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποια είναι η γιορτή του Αγίου Βασιλείου;",
                    "en": "When is Saint Basil's Day?",
                    "ru": "Когда празднуется день Святого Василия?",
                },
                "options": [
                    {"el": "1 Ιανουαρίου", "en": "January 1", "ru": "1 января"},
                    {"el": "25 Δεκεμβρίου", "en": "December 25", "ru": "25 декабря"},
                    {"el": "6 Ιανουαρίου", "en": "January 6", "ru": "6 января"},
                    {"el": "7 Ιανουαρίου", "en": "January 7", "ru": "7 января"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Τι γιορτάζεται στα Θεοφάνεια (6 Ιανουαρίου);",
                    "en": "What is celebrated on Epiphany (January 6)?",
                    "ru": "Что отмечается на Богоявление (6 января)?",
                },
                "options": [
                    {
                        "el": "Η βάπτιση του Ιησού Χριστού",
                        "en": "The baptism of Jesus Christ",
                        "ru": "Крещение Иисуса Христа",
                    },
                    {
                        "el": "Η γέννηση του Ιησού",
                        "en": "The birth of Jesus",
                        "ru": "Рождение Иисуса",
                    },
                    {"el": "Η Ανάσταση", "en": "The Resurrection", "ru": "Воскресение"},
                    {"el": "Η Μεταμόρφωση", "en": "The Transfiguration", "ru": "Преображение"},
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποιο είναι το έθιμο με τον σταυρό στα Θεοφάνεια;",
                    "en": "What is the cross custom on Epiphany?",
                    "ru": "Какой обычай с крестом на Богоявление?",
                },
                "options": [
                    {
                        "el": "Ρίχνεται στη θάλασσα και τον βρίσκει κολυμβητής",
                        "en": "Thrown into the sea and retrieved by a swimmer",
                        "ru": "Бросается в море и достаётся пловцом",
                    },
                    {
                        "el": "Φυλάσσεται στην εκκλησία",
                        "en": "Kept in the church",
                        "ru": "Хранится в церкви",
                    },
                    {
                        "el": "Καίγεται σε τελετή",
                        "en": "Burned in a ceremony",
                        "ru": "Сжигается в церемонии",
                    },
                    {
                        "el": "Δίνεται σε νεόνυμφους",
                        "en": "Given to newlyweds",
                        "ru": "Дарится молодожёнам",
                    },
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποια είναι η παραδοσιακή ελληνική μέρα ονομαστικής εορτής;",
                    "en": "What is the traditional Greek name day celebration?",
                    "ru": "Что такое традиционный греческий День именин?",
                },
                "options": [
                    {
                        "el": "Γιορτάζεται αντί για γενέθλια",
                        "en": "Celebrated instead of birthdays",
                        "ru": "Отмечается вместо дня рождения",
                    },
                    {
                        "el": "Γιορτάζεται μαζί με τα γενέθλια",
                        "en": "Celebrated together with birthdays",
                        "ru": "Отмечается вместе с днём рождения",
                    },
                    {"el": "Δεν γιορτάζεται", "en": "Not celebrated", "ru": "Не отмечается"},
                    {
                        "el": "Γιορτάζεται μόνο για παιδιά",
                        "en": "Celebrated only for children",
                        "ru": "Отмечается только для детей",
                    },
                ],
                "correct_option": 1,
            },
            {
                "question_text": {
                    "el": "Ποιο είναι το έθιμο με τα πυροτεχνήματα στη Χίο;",
                    "en": "What is the fireworks custom in Chios?",
                    "ru": "Какой обычай с фейерверками на Хиосе?",
                },
                "options": [
                    {
                        "el": "Ρουκετοπόλεμος ανάμεσα σε εκκλησίες το Πάσχα",
                        "en": "Rocket war between churches on Easter",
                        "ru": "Война ракетами между церквями на Пасху",
                    },
                    {
                        "el": "Πυροτεχνήματα στη θάλασσα",
                        "en": "Fireworks at sea",
                        "ru": "Фейерверки на море",
                    },
                    {
                        "el": "Πυροτεχνήματα στα βουνά",
                        "en": "Fireworks in the mountains",
                        "ru": "Фейерверки в горах",
                    },
                    {
                        "el": "Πυροτεχνήματα την Πρωτοχρονιά",
                        "en": "New Year fireworks",
                        "ru": "Новогодние фейерверки",
                    },
                ],
                "correct_option": 1,
            },
        ],
    }

    def __init__(self, db: AsyncSession):
        """Initialize SeedService with database session.

        Args:
            db: Async SQLAlchemy session for database operations
        """
        self.db = db

    # =====================
    # Guard Methods
    # =====================

    def _check_can_seed(self) -> None:
        """Verify seeding is allowed in current environment.

        Raises:
            RuntimeError: If seeding is not allowed
        """
        if not settings.can_seed_database():
            errors = settings.get_seed_validation_errors()
            raise RuntimeError(f"Database seeding not allowed: {'; '.join(errors)}")

    # =====================
    # Truncation Methods
    # =====================

    async def truncate_tables(self) -> dict[str, Any]:
        """Truncate all seeded tables in FK-safe order.

        Uses TRUNCATE CASCADE for efficiency while respecting
        foreign key constraints by ordering correctly.

        Returns:
            dict with 'truncated_tables' list and 'success' bool

        Raises:
            RuntimeError: If seeding not allowed
        """
        self._check_can_seed()

        truncated = []
        for table in self.TRUNCATION_ORDER:
            await self.db.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE"))
            truncated.append(table)

        await self.db.flush()

        return {
            "success": True,
            "truncated_tables": truncated,
        }

    # =====================
    # User Seeding
    # =====================

    async def seed_users(self) -> dict[str, Any]:
        """Create deterministic test users for E2E scenarios.

        Creates Auth0-style users (no password hash) for E2E testing.
        Auth0 test users should authenticate via Auth0's test mode or
        have corresponding Auth0 accounts configured.

        Test Users Created:
        1. e2e_learner@test.com - Regular learner with progress
        2. e2e_beginner@test.com - New user, no progress
        3. e2e_advanced@test.com - Advanced user, high progress
        4. e2e_admin@test.com - Admin user for admin tests

        Returns:
            dict with 'users' list of created user data

        Raises:
            RuntimeError: If seeding not allowed
        """
        self._check_can_seed()

        # NOTE: auth0_id is set to None so that when Auth0 E2E tests run,
        # the real Auth0 user ID can be linked to these seeded users.
        # Setting fake auth0_ids would cause AccountLinkingConflictException.
        users_data = [
            {
                "email": "e2e_learner@test.com",
                "full_name": "E2E Learner",
                "is_superuser": False,
                "is_active": True,
                "auth0_id": None,
            },
            {
                "email": "e2e_beginner@test.com",
                "full_name": "E2E Beginner",
                "is_superuser": False,
                "is_active": True,
                "auth0_id": None,
            },
            {
                "email": "e2e_advanced@test.com",
                "full_name": "E2E Advanced",
                "is_superuser": False,
                "is_active": True,
                "auth0_id": None,
            },
            {
                "email": "e2e_admin@test.com",
                "full_name": "E2E Admin",
                "is_superuser": True,
                "is_active": True,
                "auth0_id": None,
            },
        ]

        created_users = []
        now = datetime.now(timezone.utc)

        for user_data in users_data:
            user = User(
                email=user_data["email"],
                full_name=user_data["full_name"],
                password_hash=None,  # Auth0 users don't have password
                auth0_id=user_data["auth0_id"],
                is_superuser=user_data["is_superuser"],
                is_active=user_data["is_active"],
                email_verified_at=now,  # Pre-verified for E2E tests
            )
            self.db.add(user)
            await self.db.flush()

            # Create user settings
            user_settings = UserSettings(
                user_id=user.id,
                daily_goal=20,
                email_notifications=True,
            )
            self.db.add(user_settings)

            created_users.append(
                {
                    "id": str(user.id),
                    "email": user.email,
                    "full_name": user.full_name,
                    "is_superuser": user.is_superuser,
                    "auth0_id": user.auth0_id,
                }
            )

        await self.db.flush()

        return {
            "success": True,
            "users": created_users,
            "password": self.DEFAULT_PASSWORD,  # Kept for backward compatibility
        }

    # =====================
    # Content Seeding
    # =====================

    async def seed_decks_and_cards(self) -> dict[str, Any]:
        """Create test decks with cards for each CEFR level.

        Creates:
        - 1 deck per CEFR level (A1, A2, B1, B2, C1, C2)
        - 10 cards per deck (vocabulary items)
        - Realistic Greek vocabulary with translations

        Returns:
            dict with 'decks' list containing deck and card info

        Raises:
            RuntimeError: If seeding not allowed
        """
        self._check_can_seed()

        created_decks = []
        difficulties = [CardDifficulty.EASY, CardDifficulty.MEDIUM, CardDifficulty.HARD]

        # Premium levels - C1 and C2 are premium content
        premium_levels = {DeckLevel.C1, DeckLevel.C2}

        for level, words in self.VOCABULARY.items():
            # Create deck - C1 and C2 are premium
            is_premium = level in premium_levels
            deck = Deck(
                name=f"Greek {level.value} Vocabulary",
                description=f"Essential Greek vocabulary for CEFR level {level.value}",
                level=level,
                is_active=True,
                is_premium=is_premium,
            )
            self.db.add(deck)
            await self.db.flush()

            # Create cards
            for i, (greek, english, category) in enumerate(words):
                card = Card(
                    deck_id=deck.id,
                    front_text=greek,
                    back_text=english,
                    example_sentence=f"Example sentence with '{greek}'",
                    pronunciation=f"[{greek}]",
                    difficulty=difficulties[i % 3],  # Rotate through difficulties
                    order_index=i,
                )
                self.db.add(card)

            created_decks.append(
                {
                    "id": str(deck.id),
                    "name": deck.name,
                    "level": level.value,
                    "card_count": len(words),
                    "is_premium": is_premium,
                }
            )

        await self.db.flush()

        return {
            "success": True,
            "decks": created_decks,
            "total_cards": sum(len(v) for v in self.VOCABULARY.values()),
        }

    # =====================
    # Progress Seeding
    # =====================

    async def seed_card_statistics(
        self,
        user_id: UUID,
        deck_id: UUID,
        progress_percent: int = 50,
    ) -> dict[str, Any]:
        """Create card statistics for a user's deck progress.

        Generates SM-2 spaced repetition data simulating realistic
        learning progress at the specified percentage.

        Args:
            user_id: User to create statistics for
            deck_id: Deck to create statistics for
            progress_percent: 0-100, how much of deck is "learned"

        Returns:
            dict with statistics summary

        Raises:
            RuntimeError: If seeding not allowed
        """
        self._check_can_seed()

        # Get cards for the deck
        result = await self.db.execute(
            select(Card.id).where(Card.deck_id == deck_id).order_by(Card.order_index)
        )
        card_ids = [row[0] for row in result.fetchall()]

        if not card_ids:
            return {"success": True, "stats_created": 0}

        # Calculate how many cards should be at each stage
        total_cards = len(card_ids)
        learned_count = int(total_cards * progress_percent / 100)
        learning_count = min(3, total_cards - learned_count)

        stats_created = 0
        today = date.today()
        now = datetime.now(timezone.utc)

        for i, card_id in enumerate(card_ids):
            if i < learned_count:
                # Mastered cards
                status = CardStatus.MASTERED
                easiness_factor = 2.5
                interval = 30
                repetitions = 5
                next_review = today + timedelta(days=interval)
            elif i < learned_count + learning_count:
                # Learning cards
                status = CardStatus.LEARNING
                easiness_factor = 2.5
                interval = 1
                repetitions = 1
                next_review = today + timedelta(days=1)
            else:
                # New cards
                status = CardStatus.NEW
                easiness_factor = 2.5
                interval = 0
                repetitions = 0
                next_review = today

            stat = CardStatistics(
                user_id=user_id,
                card_id=card_id,
                status=status,
                easiness_factor=easiness_factor,
                interval=interval,
                repetitions=repetitions,
                next_review_date=next_review,
            )
            self.db.add(stat)
            stats_created += 1

        # Create/update user deck progress
        progress = UserDeckProgress(
            user_id=user_id,
            deck_id=deck_id,
            cards_studied=learned_count + learning_count,
            cards_mastered=learned_count,
            last_studied_at=now,
        )
        self.db.add(progress)

        await self.db.flush()

        return {
            "success": True,
            "stats_created": stats_created,
            "mastered": learned_count,
            "learning": learning_count,
            "new": total_cards - learned_count - learning_count,
        }

    # =====================
    # Review History Seeding
    # =====================

    async def seed_reviews(
        self,
        user_id: UUID,
        card_id: UUID,
        review_count: int = 5,
    ) -> dict[str, Any]:
        """Create review history for a card.

        Generates realistic review history with improving ratings
        over time (simulating learning progression).

        Args:
            user_id: User who reviewed
            card_id: Card that was reviewed
            review_count: Number of reviews to create

        Returns:
            dict with reviews summary

        Raises:
            RuntimeError: If seeding not allowed
        """
        self._check_can_seed()

        reviews_created = []
        now = datetime.now(timezone.utc)

        # Simulate learning progression: ratings improve over time
        # SM-2 quality ratings: 0-5 (stored as int in Review.quality)
        rating_progression = [3, 3, 4, 4, 5]  # Hard → Hesitant → Perfect

        for i in range(min(review_count, len(rating_progression))):
            review_date = now - timedelta(days=(review_count - i) * 3)
            quality = rating_progression[i]

            review = Review(
                user_id=user_id,
                card_id=card_id,
                quality=quality,
                time_taken=max(5, 20 - (i * 3)),  # Faster over time (seconds)
                reviewed_at=review_date,
            )
            self.db.add(review)
            reviews_created.append(
                {
                    "quality": quality,
                    "date": review_date.isoformat(),
                }
            )

        await self.db.flush()

        return {
            "success": True,
            "reviews_created": len(reviews_created),
            "reviews": reviews_created,
        }

    # =====================
    # Feedback Seeding
    # =====================

    async def seed_feedback(self, user_ids: list[UUID]) -> dict[str, Any]:
        """Create deterministic feedback items for E2E tests.

        Creates feedback with different categories, statuses, and vote counts
        to test the feedback voting feature.

        Args:
            user_ids: List of user IDs to create feedback for

        Returns:
            dict with 'feedback' list of created items

        Raises:
            RuntimeError: If seeding not allowed
        """
        self._check_can_seed()

        if len(user_ids) < 2:
            return {"success": True, "feedback": [], "votes": []}

        feedback_data: list[FeedbackSeedData] = [
            # === POPULAR FEATURE REQUESTS (high upvotes) ===
            {
                "title": "Add dark mode support",
                "description": "It would be great to have a dark mode option "
                "for studying at night. This would reduce eye strain.",
                "category": FeedbackCategory.FEATURE_REQUEST,
                "status": FeedbackStatus.PLANNED,
                "user_idx": 0,  # learner
            },
            {
                "title": "Add pronunciation audio",
                "description": "Having native speaker audio for Greek words "
                "would greatly improve learning experience.",
                "category": FeedbackCategory.FEATURE_REQUEST,
                "status": FeedbackStatus.IN_PROGRESS,
                "user_idx": 1,  # beginner
            },
            # === MODERATE INTEREST ===
            {
                "title": "Export progress to PDF",
                "description": "Would love to export my learning progress and "
                "statistics to a PDF report for sharing.",
                "category": FeedbackCategory.FEATURE_REQUEST,
                "status": FeedbackStatus.UNDER_REVIEW,
                "user_idx": 1,  # beginner
            },
            # === CONTROVERSIAL (mixed upvotes and downvotes) ===
            {
                "title": "Add gamification features",
                "description": "Add XP points, badges, and leaderboards to make "
                "learning more engaging and competitive.",
                "category": FeedbackCategory.FEATURE_REQUEST,
                "status": FeedbackStatus.NEW,
                "user_idx": 2,  # advanced
            },
            # === NEW/NO VOTES ===
            {
                "title": "Add spaced repetition settings",
                "description": "Allow users to customize the spaced repetition "
                "algorithm parameters for their learning style.",
                "category": FeedbackCategory.FEATURE_REQUEST,
                "status": FeedbackStatus.NEW,
                "user_idx": 0,  # learner
            },
            # === BUG REPORTS ===
            {
                "title": "Incorrect translation for 'efcharisto'",
                "description": "The word 'efcharisto' shows as 'goodbye' but "
                "it should be 'thank you' in the A1 vocabulary deck.",
                "category": FeedbackCategory.BUG_INCORRECT_DATA,
                "status": FeedbackStatus.NEW,
                "user_idx": 0,  # learner
            },
            {
                "title": "Missing accent in word display",
                "description": "The accent mark is not showing correctly for "
                "some Greek words in the flashcard display.",
                "category": FeedbackCategory.BUG_INCORRECT_DATA,
                "status": FeedbackStatus.COMPLETED,
                "user_idx": 1,  # beginner
            },
            {
                "title": "Card order randomization broken",
                "description": "When shuffle mode is enabled, the cards still "
                "appear in the same order every time.",
                "category": FeedbackCategory.BUG_INCORRECT_DATA,
                "status": FeedbackStatus.IN_PROGRESS,
                "user_idx": 2,  # advanced
            },
        ]

        created_feedback = []
        for item in feedback_data:
            user_id = user_ids[item["user_idx"]]
            feedback = Feedback(
                user_id=user_id,
                title=item["title"],
                description=item["description"],
                category=item["category"],
                status=item["status"],
                vote_count=0,
            )
            self.db.add(feedback)
            await self.db.flush()

            created_feedback.append(
                {
                    "id": str(feedback.id),
                    "title": item["title"],
                    "category": item["category"].value,
                    "status": item["status"].value,
                    "user_id": str(user_id),
                }
            )

        # Define vote patterns: (feedback_index, voter_idx, vote_type)
        # Creates diverse scenarios: popular, controversial, new (no votes)
        vote_patterns: list[tuple[int, int, VoteType]] = [
            # Dark mode - POPULAR (3 upvotes) => vote_count = +3
            (0, 1, VoteType.UP),  # beginner upvotes
            (0, 2, VoteType.UP),  # advanced upvotes
            (0, 3, VoteType.UP),  # admin upvotes
            # Pronunciation audio - POPULAR (2 upvotes) => vote_count = +2
            (1, 0, VoteType.UP),  # learner upvotes
            (1, 2, VoteType.UP),  # advanced upvotes
            # Export to PDF - MODERATE (1 upvote) => vote_count = +1
            (2, 0, VoteType.UP),  # learner upvotes
            # Gamification - CONTROVERSIAL (2 up, 1 down) => vote_count = +1
            (3, 0, VoteType.UP),  # learner upvotes
            (3, 1, VoteType.UP),  # beginner upvotes
            (3, 3, VoteType.DOWN),  # admin downvotes
            # Spaced repetition settings - NEW (no votes) => vote_count = 0
            # (intentionally empty)
            # Bug: Incorrect translation - SUPPORTED (2 upvotes) => vote_count = +2
            (5, 1, VoteType.UP),  # beginner upvotes
            (5, 2, VoteType.UP),  # advanced upvotes
            # Bug: Missing accent - RESOLVED (1 upvote) => vote_count = +1
            (6, 0, VoteType.UP),  # learner upvotes
            # Bug: Card order - MIXED (1 up, 1 down) => vote_count = 0
            (7, 0, VoteType.UP),  # learner upvotes
            (7, 1, VoteType.DOWN),  # beginner downvotes
        ]

        votes_created: list[dict[str, Any]] = []
        for feedback_idx, voter_idx, vote_type in vote_patterns:
            if feedback_idx >= len(created_feedback):
                continue
            if voter_idx >= len(user_ids):
                continue

            feedback_id = UUID(created_feedback[feedback_idx]["id"])
            feedback_user_idx = feedback_data[feedback_idx]["user_idx"]

            # Skip if voter is the feedback author
            if voter_idx == feedback_user_idx:
                continue

            vote = FeedbackVote(
                user_id=user_ids[voter_idx],
                feedback_id=feedback_id,
                vote_type=vote_type,
            )
            self.db.add(vote)

            # Update vote_count - CRITICAL: use +1 for UP, -1 for DOWN
            vote_delta = 1 if vote_type == VoteType.UP else -1
            await self.db.execute(
                update(Feedback)
                .where(Feedback.id == feedback_id)
                .values(vote_count=Feedback.vote_count + vote_delta)
            )

            votes_created.append(
                {
                    "feedback_id": str(feedback_id),
                    "user_idx": voter_idx,
                    "type": vote_type.value,
                }
            )

        await self.db.flush()

        return {
            "success": True,
            "feedback": created_feedback,
            "votes": votes_created,
        }

    # =====================
    # Culture Seeding
    # =====================

    async def seed_culture_decks_and_questions(self) -> dict[str, Any]:
        """Create culture decks with questions for E2E tests.

        Creates:
        - 5 culture decks (History, Geography, Politics, Culture, Traditions)
        - 10 questions per deck (50 total)
        - All content in 3 languages (el, en, ru)

        Returns:
            dict with 'decks' and 'questions' counts

        Raises:
            RuntimeError: If seeding not allowed
        """
        self._check_can_seed()

        created_decks = []
        total_questions = 0

        # History and Traditions are premium content
        premium_categories = {"history", "traditions"}

        for category, deck_data in self.CULTURE_DECKS.items():
            # History and Traditions are premium, others are free
            is_premium = category in premium_categories
            deck = CultureDeck(
                name=deck_data["name"],
                description=deck_data["description"],
                icon=deck_data["icon"],
                color_accent=deck_data["color_accent"],
                category=category,
                is_active=True,
                is_premium=is_premium,
            )
            self.db.add(deck)
            await self.db.flush()

            # Create questions for this deck
            questions_data = self.CULTURE_QUESTIONS.get(category, [])
            for i, q_data in enumerate(questions_data):
                question = CultureQuestion(
                    deck_id=deck.id,
                    question_text=q_data["question_text"],
                    option_a=q_data["options"][0],
                    option_b=q_data["options"][1],
                    option_c=q_data["options"][2] if len(q_data["options"]) > 2 else None,
                    option_d=q_data["options"][3] if len(q_data["options"]) > 3 else None,
                    correct_option=q_data["correct_option"],
                    image_key=q_data.get("image_key"),
                    order_index=i,
                )
                self.db.add(question)
                total_questions += 1

            # Extract English name for return value
            name_translations = deck_data["name"]
            if isinstance(name_translations, dict):
                name_en = name_translations.get("en", str(name_translations))
            else:
                name_en = str(name_translations)

            created_decks.append(
                {
                    "id": str(deck.id),
                    "name": name_en,
                    "category": category,
                    "question_count": len(questions_data),
                    "is_premium": is_premium,
                }
            )

        await self.db.flush()

        return {
            "success": True,
            "decks": created_decks,
            "total_questions": total_questions,
        }

    async def seed_culture_question_statistics(
        self,
        user_id: UUID,
        deck_id: UUID,
        progress_percent: int = 50,
    ) -> dict[str, Any]:
        """Create culture question statistics for a user's deck progress.

        Similar to seed_card_statistics but for culture questions.
        Generates SM-2 spaced repetition data simulating realistic progress.

        Args:
            user_id: User to create statistics for
            deck_id: Culture deck to create statistics for
            progress_percent: 0-100, how much of deck is "learned"

        Returns:
            dict with statistics summary

        Raises:
            RuntimeError: If seeding not allowed
        """
        self._check_can_seed()

        # Get questions for the deck
        result = await self.db.execute(
            select(CultureQuestion.id)
            .where(CultureQuestion.deck_id == deck_id)
            .order_by(CultureQuestion.order_index)
        )
        question_ids = [row[0] for row in result.fetchall()]

        if not question_ids:
            return {"success": True, "stats_created": 0}

        total_questions = len(question_ids)
        mastered_count = int(total_questions * progress_percent / 100)
        learning_count = min(3, total_questions - mastered_count)

        stats_created = 0
        today = date.today()

        for i, question_id in enumerate(question_ids):
            if i < mastered_count:
                # Mastered questions
                status = CardStatus.MASTERED
                easiness_factor = 2.5
                interval = 30
                repetitions = 5
                next_review = today + timedelta(days=interval)
            elif i < mastered_count + learning_count:
                # Learning questions
                status = CardStatus.LEARNING
                easiness_factor = 2.5
                interval = 1
                repetitions = 1
                next_review = today + timedelta(days=1)
            else:
                # New questions
                status = CardStatus.NEW
                easiness_factor = 2.5
                interval = 0
                repetitions = 0
                next_review = today

            stat = CultureQuestionStats(
                user_id=user_id,
                question_id=question_id,
                status=status,
                easiness_factor=easiness_factor,
                interval=interval,
                repetitions=repetitions,
                next_review_date=next_review,
            )
            self.db.add(stat)
            stats_created += 1

        await self.db.flush()

        return {
            "success": True,
            "stats_created": stats_created,
            "mastered": mastered_count,
            "learning": learning_count,
            "new": total_questions - mastered_count - learning_count,
        }

    # =====================
    # XP & Achievement Seeding
    # =====================

    async def seed_achievements(self) -> dict[str, Any]:
        """Seed achievement definitions from code definitions.

        Creates Achievement records in the database from the
        ACHIEVEMENTS list in achievement_definitions.py.

        Returns:
            dict with 'achievements_created' count

        Raises:
            RuntimeError: If seeding not allowed
        """
        self._check_can_seed()

        created = []
        for i, ach_def in enumerate(ACHIEVEMENT_DEFS):
            achievement = Achievement(
                id=ach_def.id,
                name=ach_def.name,
                description=ach_def.description,
                category=ach_def.category,
                icon=ach_def.icon,
                threshold=ach_def.threshold,
                xp_reward=ach_def.xp_reward,
                sort_order=i,
            )
            self.db.add(achievement)
            created.append(ach_def.id)

        await self.db.flush()

        return {
            "success": True,
            "achievements_created": len(created),
        }

    async def seed_user_xp(
        self,
        user_id: UUID,
        total_xp: int,
        achievement_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        """Seed XP and achievements for a user.

        Creates UserXP record with specified XP and optionally
        unlocks achievements for the user.

        Args:
            user_id: User to seed XP for
            total_xp: Total XP to assign
            achievement_ids: List of achievement IDs to unlock

        Returns:
            dict with XP and achievement info

        Raises:
            RuntimeError: If seeding not allowed
        """
        self._check_can_seed()

        # Calculate level from XP
        level = get_level_from_xp(total_xp)

        # Create UserXP record
        user_xp = UserXP(
            user_id=user_id,
            total_xp=total_xp,
            current_level=level,
        )
        self.db.add(user_xp)

        # Create user achievements if provided
        achievements_unlocked = 0
        if achievement_ids:
            now = datetime.now(timezone.utc)
            for ach_id in achievement_ids:
                user_ach = UserAchievement(
                    user_id=user_id,
                    achievement_id=ach_id,
                    unlocked_at=now,
                    notified=True,  # Pre-notified for E2E tests
                )
                self.db.add(user_ach)
                achievements_unlocked += 1

        await self.db.flush()

        return {
            "success": True,
            "total_xp": total_xp,
            "level": level,
            "achievements_unlocked": achievements_unlocked,
        }

    # =====================
    # Notification Seeding
    # =====================

    async def seed_notifications(self, user_id: UUID) -> dict[str, Any]:
        """Create deterministic notifications for a test user.

        Creates 5 notifications:
        - 3 UNREAD: Achievement (1h ago), Daily Goal (3h ago), Level Up (1d ago)
        - 2 READ: Streak at Risk (2d ago), Welcome (7d ago)

        Args:
            user_id: User to create notifications for

        Returns:
            dict with notifications summary

        Raises:
            RuntimeError: If seeding not allowed
        """
        self._check_can_seed()

        now = datetime.now(timezone.utc)
        created: list[dict[str, Any]] = []

        notifications_data: list[NotificationSeedData] = [
            # UNREAD (3)
            {
                "type": NotificationType.ACHIEVEMENT_UNLOCKED,
                "title": "Achievement Unlocked: First Flame",
                "message": "You earned 50 XP!",
                "icon": "trophy",
                "action_url": "/achievements",
                "extra_data": {"achievement_id": "streak_first_flame", "xp_reward": 50},
                "read": False,
                "created_at": now - timedelta(hours=1),
            },
            {
                "type": NotificationType.DAILY_GOAL_COMPLETE,
                "title": "Daily Goal Complete!",
                "message": "You reviewed 20 cards today. Great job!",
                "icon": "check-circle",
                "action_url": "/",
                "extra_data": {"reviews_completed": 20},
                "read": False,
                "created_at": now - timedelta(hours=3),
            },
            {
                "type": NotificationType.LEVEL_UP,
                "title": "Level Up!",
                "message": "You reached Level 3: Apprentice",
                "icon": "arrow-up",
                "action_url": "/profile",
                "extra_data": {"new_level": 3, "level_name": "Apprentice"},
                "read": False,
                "created_at": now - timedelta(days=1),
            },
            # READ (2)
            {
                "type": NotificationType.STREAK_AT_RISK,
                "title": "Streak at Risk!",
                "message": "Study now to keep your 5-day streak going!",
                "icon": "flame",
                "action_url": "/decks",
                "extra_data": {"streak_days": 5},
                "read": True,
                "read_at": now - timedelta(days=1, hours=12),
                "created_at": now - timedelta(days=2),
            },
            {
                "type": NotificationType.WELCOME,
                "title": "Welcome to Greekly!",
                "message": "Start your Greek learning journey today. Choose a deck to begin!",
                "icon": "wave",
                "action_url": "/decks",
                "extra_data": None,
                "read": True,
                "read_at": now - timedelta(days=6),
                "created_at": now - timedelta(days=7),
            },
        ]

        for notif_data in notifications_data:
            notification = Notification(
                user_id=user_id,
                type=notif_data["type"],
                title=notif_data["title"],
                message=notif_data["message"],
                icon=notif_data["icon"],
                action_url=notif_data["action_url"],
                extra_data=notif_data["extra_data"],
                read=notif_data["read"],
                read_at=notif_data.get("read_at"),
            )
            notification.created_at = notif_data["created_at"]
            self.db.add(notification)
            created.append(
                {
                    "type": notif_data["type"].value,
                    "title": notif_data["title"],
                    "read": notif_data["read"],
                }
            )

        await self.db.flush()

        return {
            "success": True,
            "notifications_created": len(created),
            "unread_count": sum(1 for n in created if not n["read"]),
        }

    # =====================
    # Full Seed Orchestration
    # =====================

    async def seed_all(self) -> dict[str, Any]:  # noqa: C901
        """Execute full database seeding sequence.

        Orchestrates complete seeding:
        1. Truncate all tables (clean slate)
        2. Create test users
        3. Create decks and cards
        4. Create progress data for learner user
        5. Create review history for learner user
        6. Create notifications for learner user
        7. Create feedback and votes
        8. Create achievements and XP data
        9. Create XP-specific test users
        10. Create culture decks and questions
        11. Create culture progress for learner and advanced users

        Returns:
            dict with complete seeding summary

        Raises:
            RuntimeError: If seeding not allowed
        """
        self._check_can_seed()

        # Step 1: Truncate
        truncate_result = await self.truncate_tables()

        # Step 2: Create users
        users_result = await self.seed_users()

        # Step 3: Create content
        content_result = await self.seed_decks_and_cards()

        # Step 4 & 5: Create progress for learner user
        # Find the learner user and A1 deck for detailed progress
        learner_id = None
        user_ids: list[UUID] = []
        for user in users_result["users"]:
            user_ids.append(UUID(user["id"]))
            if user["email"] == "e2e_learner@test.com":
                learner_id = UUID(user["id"])

        a1_deck_id = None
        for deck in content_result["decks"]:
            if deck["level"] == "A1":
                a1_deck_id = UUID(deck["id"])
                break

        stats_result: dict[str, Any] = {"success": True, "stats_created": 0}
        reviews_result: dict[str, Any] = {"success": True, "reviews_created": 0}
        notifications_result: dict[str, Any] = {"success": True, "notifications_created": 0}

        if learner_id and a1_deck_id:
            # Create 60% progress on A1 deck for learner
            stats_result = await self.seed_card_statistics(
                user_id=learner_id,
                deck_id=a1_deck_id,
                progress_percent=60,
            )

            # Get first card for review history
            result = await self.db.execute(
                select(Card.id).where(Card.deck_id == a1_deck_id).limit(1)
            )
            row = result.fetchone()
            if row:
                reviews_result = await self.seed_reviews(
                    user_id=learner_id,
                    card_id=row[0],
                    review_count=5,
                )

        # Step 6: Create notifications for learner user
        if learner_id:
            notifications_result = await self.seed_notifications(user_id=learner_id)

        # Step 7: Create feedback and votes
        feedback_result = await self.seed_feedback(user_ids)

        # Step 8: Seed achievement definitions
        achievements_result = await self.seed_achievements()

        # Step 9: Create XP-specific test users for E2E testing
        now = datetime.now(timezone.utc)
        xp_users_result: dict[str, Any] = {"success": True, "users": []}

        # XP Boundary User - 99 XP (1 XP away from level 2)
        xp_boundary_user = User(
            email="e2e_xp_boundary@test.com",
            full_name="E2E XP Boundary",
            password_hash=None,  # Auth0 users don't have password
            auth0_id="auth0|e2e_xp_boundary",
            is_superuser=False,
            is_active=True,
            email_verified_at=now,
        )
        self.db.add(xp_boundary_user)
        await self.db.flush()
        xp_boundary_settings = UserSettings(
            user_id=xp_boundary_user.id,
            daily_goal=20,
            email_notifications=True,
        )
        self.db.add(xp_boundary_settings)
        await self.seed_user_xp(xp_boundary_user.id, 99, [])
        xp_users_result["users"].append(
            {
                "email": "e2e_xp_boundary@test.com",
                "total_xp": 99,
                "level": 1,
            }
        )

        # XP Mid User - 4100 XP (Level 7) with some achievements
        xp_mid_user = User(
            email="e2e_xp_mid@test.com",
            full_name="E2E XP Mid",
            password_hash=None,  # Auth0 users don't have password
            auth0_id="auth0|e2e_xp_mid",
            is_superuser=False,
            is_active=True,
            email_verified_at=now,
        )
        self.db.add(xp_mid_user)
        await self.db.flush()
        xp_mid_settings = UserSettings(
            user_id=xp_mid_user.id,
            daily_goal=20,
            email_notifications=True,
        )
        self.db.add(xp_mid_settings)
        mid_achievements = [
            "streak_first_flame",
            "streak_warming_up",
            "learning_first_word",
            "learning_vocabulary_builder",
            "session_quick_study",
        ]
        await self.seed_user_xp(xp_mid_user.id, 4100, mid_achievements)
        xp_users_result["users"].append(
            {
                "email": "e2e_xp_mid@test.com",
                "total_xp": 4100,
                "level": 7,
                "achievements": mid_achievements,
            }
        )

        # XP Max User - 100000 XP (Level 15) with all achievements
        xp_max_user = User(
            email="e2e_xp_max@test.com",
            full_name="E2E XP Max",
            password_hash=None,  # Auth0 users don't have password
            auth0_id="auth0|e2e_xp_max",
            is_superuser=False,
            is_active=True,
            email_verified_at=now,
        )
        self.db.add(xp_max_user)
        await self.db.flush()
        xp_max_settings = UserSettings(
            user_id=xp_max_user.id,
            daily_goal=20,
            email_notifications=True,
        )
        self.db.add(xp_max_settings)
        all_achievement_ids = [a.id for a in ACHIEVEMENT_DEFS]
        await self.seed_user_xp(xp_max_user.id, 100000, all_achievement_ids)
        xp_users_result["users"].append(
            {
                "email": "e2e_xp_max@test.com",
                "total_xp": 100000,
                "level": 15,
                "achievements": all_achievement_ids,
            }
        )

        # Step 10: Create culture decks and questions
        culture_result = await self.seed_culture_decks_and_questions()

        # Step 11: Create culture progress for learner and advanced users
        culture_stats_result: dict[str, Any] = {"success": True, "stats_created": 0}
        advanced_culture_stats: list[dict[str, Any]] = []

        if culture_result.get("decks"):
            # Create 60% progress on History deck for learner user
            history_deck = next(
                (d for d in culture_result["decks"] if d["category"] == "history"),
                None,
            )
            if learner_id and history_deck:
                culture_stats_result = await self.seed_culture_question_statistics(
                    user_id=learner_id,
                    deck_id=UUID(history_deck["id"]),
                    progress_percent=60,
                )

            # Advanced user gets 80% progress on all culture decks
            advanced_id = next(
                (
                    UUID(u["id"])
                    for u in users_result["users"]
                    if u["email"] == "e2e_advanced@test.com"
                ),
                None,
            )
            if advanced_id:
                for deck in culture_result.get("decks", []):
                    advanced_stats = await self.seed_culture_question_statistics(
                        user_id=advanced_id,
                        deck_id=UUID(deck["id"]),
                        progress_percent=80,
                    )
                    advanced_culture_stats.append(
                        {
                            "deck": deck["name"],
                            "stats_created": advanced_stats.get("stats_created", 0),
                        }
                    )

        # Commit all changes
        await self.db.commit()

        return {
            "success": True,
            "truncation": truncate_result,
            "users": users_result,
            "content": content_result,
            "statistics": stats_result,
            "reviews": reviews_result,
            "notifications": notifications_result,
            "feedback": feedback_result,
            "achievements": achievements_result,
            "xp_users": xp_users_result,
            "culture": culture_result,
            "culture_statistics": culture_stats_result,
            "culture_advanced_stats": advanced_culture_stats,
        }
