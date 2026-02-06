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

from sqlalchemy import delete, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.db.models import (
    Achievement,
    AnnouncementCampaign,
    Card,
    CardStatistics,
    CardStatus,
    CardSystemVersion,
    ChangelogEntry,
    ChangelogTag,
    CultureAnswerHistory,
    CultureDeck,
    CultureQuestion,
    CultureQuestionStats,
    Deck,
    DeckLevel,
    Feedback,
    FeedbackCategory,
    FeedbackStatus,
    FeedbackVote,
    MockExamAnswer,
    MockExamSession,
    MockExamStatus,
    NewsItem,
    Notification,
    NotificationType,
    PartOfSpeech,
    Review,
    User,
    UserAchievement,
    UserDeckProgress,
    UserSettings,
    UserXP,
    VoteType,
    WordEntry,
    XPTransaction,
)
from src.services.achievement_definitions import ACHIEVEMENTS as ACHIEVEMENT_DEFS
from src.services.seed_grammar_data import ENRICHED_VOCABULARY
from src.services.xp_constants import get_level_from_xp
from src.utils.greek_text import extract_searchable_forms, generate_normalized_forms


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


class NewsItemSeedData(TypedDict):
    """Type definition for news item seed data items."""

    title_el: str
    title_en: str
    title_ru: str
    description_el: str
    description_en: str
    description_ru: str
    days_ago: int


class AnnouncementCampaignSeedData(TypedDict):
    """Type definition for announcement campaign seed data items."""

    title: str
    message: str
    link_url: str | None
    hours_ago: float
    read_by_learner: bool


class AdminCardSeedData(TypedDict, total=False):
    """Type definition for admin vocabulary card seed data items."""

    front_text: str  # Greek word (required)
    back_text_en: str  # English translation (required)
    back_text_ru: str  # Russian translation (optional)
    pronunciation: str  # Pronunciation guide (optional)
    part_of_speech: PartOfSpeech  # Part of speech (optional)
    noun_data: dict[str, Any]  # Noun grammar data (optional)
    verb_data: dict[str, Any]  # Verb grammar data (optional)
    adjective_data: dict[str, Any]  # Adjective grammar data (optional)
    adverb_data: dict[str, Any]  # Adverb grammar data (optional)
    examples: list[dict[str, str]]  # Structured examples (optional)


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
        # Mock Exam tables (children first)
        "mock_exam_answers",
        "mock_exam_sessions",
        # News items (no FK dependencies)
        "news_items",
        # XP & Achievement tables (children first)
        "xp_transactions",
        "user_achievements",
        "user_xp",
        "achievements",
        # Notification tables
        "notifications",
        "announcement_campaigns",
        # Changelog tables
        "changelog_entries",
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
    # Each tuple: (greek, english, category, part_of_speech)
    # part_of_speech is None for interjections (greetings) and particles (ναι/όχι)
    VOCABULARY: dict[DeckLevel, list[tuple[str, str, str, PartOfSpeech | None]]] = {
        DeckLevel.A1: [
            ("γεια", "hello", "Common greeting", None),
            ("ναι", "yes", "Affirmative", None),
            ("όχι", "no", "Negative", None),
            ("ευχαριστώ", "thank you", "Gratitude", PartOfSpeech.VERB),
            ("παρακαλώ", "please/you're welcome", "Politeness", PartOfSpeech.VERB),
            ("νερό", "water", "Basic noun", PartOfSpeech.NOUN),
            ("ψωμί", "bread", "Basic noun", PartOfSpeech.NOUN),
            ("σπίτι", "house", "Basic noun", PartOfSpeech.NOUN),
            ("καλημέρα", "good morning", "Morning greeting", None),
            ("καληνύχτα", "good night", "Night greeting", None),
        ],
        DeckLevel.A2: [
            ("δουλειά", "work/job", "Employment", PartOfSpeech.NOUN),
            ("οικογένεια", "family", "Relations", PartOfSpeech.NOUN),
            ("φίλος", "friend", "Relations", PartOfSpeech.NOUN),
            ("αγαπώ", "I love", "Emotion verb", PartOfSpeech.VERB),
            ("θέλω", "I want", "Desire verb", PartOfSpeech.VERB),
            ("μπορώ", "I can", "Ability verb", PartOfSpeech.VERB),
            ("πρέπει", "must/should", "Impersonal modal verb", PartOfSpeech.VERB),
            ("χρόνια", "years", "Time", PartOfSpeech.NOUN),
            ("σήμερα", "today", "Time adverb", PartOfSpeech.ADVERB),
            ("αύριο", "tomorrow", "Time adverb", PartOfSpeech.ADVERB),
        ],
        DeckLevel.B1: [
            ("συζήτηση", "discussion", "Communication", PartOfSpeech.NOUN),
            ("απόφαση", "decision", "Abstract noun", PartOfSpeech.NOUN),
            ("εμπειρία", "experience", "Abstract noun", PartOfSpeech.NOUN),
            ("προσπαθώ", "I try", "Effort verb", PartOfSpeech.VERB),
            ("επιτυγχάνω", "I achieve", "Success verb", PartOfSpeech.VERB),
            ("αναπτύσσω", "I develop", "Growth verb", PartOfSpeech.VERB),
            ("κατάσταση", "situation", "State noun", PartOfSpeech.NOUN),
            ("σχέση", "relationship", "Connection noun", PartOfSpeech.NOUN),
            ("ευκαιρία", "opportunity", "Chance noun", PartOfSpeech.NOUN),
            ("πρόβλημα", "problem", "Challenge noun", PartOfSpeech.NOUN),
        ],
        DeckLevel.B2: [
            ("διαπραγμάτευση", "negotiation", "Business", PartOfSpeech.NOUN),
            ("συμφωνία", "agreement", "Contract", PartOfSpeech.NOUN),
            ("ανάλυση", "analysis", "Examination", PartOfSpeech.NOUN),
            ("επιχείρηση", "enterprise/business", "Commerce", PartOfSpeech.NOUN),
            ("στρατηγική", "strategy", "Planning", PartOfSpeech.NOUN),
            ("αποτέλεσμα", "result/outcome", "Conclusion", PartOfSpeech.NOUN),
            ("επιρροή", "influence", "Impact", PartOfSpeech.NOUN),
            ("παράγοντας", "factor", "Element", PartOfSpeech.NOUN),
            ("προτεραιότητα", "priority", "Importance", PartOfSpeech.NOUN),
            ("αξιολόγηση", "evaluation", "Assessment", PartOfSpeech.NOUN),
        ],
        DeckLevel.C1: [
            ("διαφάνεια", "transparency", "Openness", PartOfSpeech.NOUN),
            ("αειφορία", "sustainability", "Environment", PartOfSpeech.NOUN),
            ("διακυβέρνηση", "governance", "Administration", PartOfSpeech.NOUN),
            ("αντικειμενικότητα", "objectivity", "Impartiality", PartOfSpeech.NOUN),
            ("υποκειμενικότητα", "subjectivity", "Personal view", PartOfSpeech.NOUN),
            (
                "διεπιστημονικός",
                "interdisciplinary",
                "Academic",
                PartOfSpeech.ADJECTIVE,
            ),
            ("πολυπλοκότητα", "complexity", "Intricacy", PartOfSpeech.NOUN),
            ("ενσωμάτωση", "integration", "Incorporation", PartOfSpeech.NOUN),
            ("διαφοροποίηση", "differentiation", "Distinction", PartOfSpeech.NOUN),
            ("συνεισφορά", "contribution", "Input", PartOfSpeech.NOUN),
        ],
        DeckLevel.C2: [
            ("μεταμοντερνισμός", "postmodernism", "Philosophy", PartOfSpeech.NOUN),
            ("επιστημολογία", "epistemology", "Theory of knowledge", PartOfSpeech.NOUN),
            (
                "υπερβατικός",
                "transcendent",
                "Beyond experience",
                PartOfSpeech.ADJECTIVE,
            ),
            ("διαλεκτική", "dialectic", "Philosophical method", PartOfSpeech.NOUN),
            (
                "παραδειγματικός",
                "paradigmatic",
                "Model example",
                PartOfSpeech.ADJECTIVE,
            ),
            ("αποδόμηση", "deconstruction", "Analysis method", PartOfSpeech.NOUN),
            ("ερμηνευτική", "hermeneutics", "Interpretation theory", PartOfSpeech.NOUN),
            ("φαινομενολογία", "phenomenology", "Philosophy branch", PartOfSpeech.NOUN),
            ("οντολογία", "ontology", "Study of being", PartOfSpeech.NOUN),
            ("αισθητική", "aesthetics", "Beauty philosophy", PartOfSpeech.NOUN),
        ],
    }

    # User-owned deck definitions for E2E testing
    # Maps user email -> list of deck configurations
    USER_DECKS: dict[str, list[dict[str, Any]]] = {
        "e2e_learner@test.com": [
            {
                "name_en": "My Greek Basics",
                "name_el": "Τα Ελληνικά μου Βασικά",
                "name_ru": "Мои основы греческого",
                "description_en": "My personal collection of basic Greek words",
                "description_el": "Η προσωπική μου συλλογή βασικών ελληνικών λέξεων",
                "description_ru": "Моя личная коллекция базовых греческих слов",
                "level": DeckLevel.A1,
                "card_count": 5,
            },
            {
                "name_en": "Travel Phrases",
                "name_el": "Φράσεις Ταξιδιού",
                "name_ru": "Фразы для путешествий",
                "description_en": "Essential phrases for traveling in Greece",
                "description_el": "Απαραίτητες φράσεις για ταξίδια στην Ελλάδα",
                "description_ru": "Необходимые фразы для путешествия по Греции",
                "level": DeckLevel.A2,
                "card_count": 3,
            },
            {
                "name_en": "Practice Deck",
                "name_el": "Τράπουλα Εξάσκησης",
                "name_ru": "Практическая колода",
                "description_en": "An empty deck for practice",
                "description_el": "Μια κενή τράπουλα για εξάσκηση",
                "description_ru": "Пустая колода для практики",
                "level": DeckLevel.B1,
                "card_count": 0,
            },
        ],
        "e2e_admin@test.com": [
            {
                "name_en": "Admin's Personal Deck",
                "name_el": "Προσωπική Τράπουλα Διαχειριστή",
                "name_ru": "Личная колода администратора",
                "description_en": "Admin's personal vocabulary collection",
                "description_el": "Προσωπική συλλογή λεξιλογίου διαχειριστή",
                "description_ru": "Личная коллекция словарного запаса администратора",
                "level": DeckLevel.A1,
                "card_count": 2,
            },
        ],
    }

    # Danger zone test users for E2E testing
    # These users are created separately from main seed users
    # Reset user has full progress data, delete user has minimal data
    DANGER_ZONE_USERS = [
        {
            "email": "e2e_danger_reset@test.com",
            "full_name": "E2E Danger Reset User",
            "is_superuser": False,
            "is_active": True,
            "auth0_id": None,
            "has_progress": True,
        },
        {
            "email": "e2e_danger_delete@test.com",
            "full_name": "E2E Danger Delete User",
            "is_superuser": False,
            "is_active": True,
            "auth0_id": None,
            "has_progress": False,
        },
    ]

    # Mock exam session configurations for E2E testing
    # 80% pass threshold (20/25 correct)
    # Creates history for e2e_learner@test.com: 3 passed, 2 failed
    MOCK_EXAM_SESSIONS = [
        {
            "score": 23,
            "total_questions": 25,
            "passed": True,
            "time_taken_seconds": 1200,
            "days_ago": 6,
        },  # 92% Pass
        {
            "score": 21,
            "total_questions": 25,
            "passed": True,
            "time_taken_seconds": 1500,
            "days_ago": 5,
        },  # 84% Pass
        {
            "score": 12,
            "total_questions": 25,
            "passed": False,
            "time_taken_seconds": 900,
            "days_ago": 4,
        },  # 48% Fail
        {
            "score": 20,
            "total_questions": 25,
            "passed": True,
            "time_taken_seconds": 1350,
            "days_ago": 2,
        },  # 80% Pass
        {
            "score": 15,
            "total_questions": 25,
            "passed": False,
            "time_taken_seconds": 1100,
            "days_ago": 1,
        },  # 60% Fail
    ]

    # News items for E2E testing (5 items with varied publication dates)
    NEWS_ITEMS: list[NewsItemSeedData] = [
        {
            "title_el": "Ελληνικά Νέα: Νέα Πολιτιστική Πρωτοβουλία",
            "title_en": "Greek News: New Cultural Initiative",
            "title_ru": "Греческие новости: Новая культурная инициатива",
            "description_el": "Η κυβέρνηση ανακοίνωσε νέα πολιτιστική πρωτοβουλία για την προώθηση της ελληνικής γλώσσας.",
            "description_en": "The government announced a new cultural initiative to promote the Greek language.",
            "description_ru": "Правительство объявило о новой культурной инициативе по продвижению греческого языка.",
            "days_ago": 0,
        },
        {
            "title_el": "Ιστορική Ανακάλυψη στην Αθήνα",
            "title_en": "Historical Discovery in Athens",
            "title_ru": "Историческое открытие в Афинах",
            "description_el": "Αρχαιολόγοι ανακάλυψαν σημαντικά ευρήματα στο κέντρο της Αθήνας.",
            "description_en": "Archaeologists discovered significant artifacts in central Athens.",
            "description_ru": "Археологи обнаружили значительные артефакты в центре Афин.",
            "days_ago": 1,
        },
        {
            "title_el": "Οικονομική Ανάπτυξη στην Ελλάδα",
            "title_en": "Economic Growth in Greece",
            "title_ru": "Экономический рост в Греции",
            "description_el": "Νέα οικονομικά στοιχεία δείχνουν σημαντική ανάπτυξη.",
            "description_en": "New economic data shows significant growth.",
            "description_ru": "Новые экономические данные показывают значительный рост.",
            "days_ago": 2,
        },
        {
            "title_el": "Τουριστική Σεζόν 2026",
            "title_en": "Tourism Season 2026",
            "title_ru": "Туристический сезон 2026",
            "description_el": "Οι προβλέψεις για την τουριστική σεζόν είναι αισιόδοξες.",
            "description_en": "Predictions for the tourism season are optimistic.",
            "description_ru": "Прогнозы на туристический сезон оптимистичны.",
            "days_ago": 7,
        },
        {
            "title_el": "Πολιτιστικά Γεγονότα Ιανουαρίου",
            "title_en": "January Cultural Events",
            "title_ru": "Культурные события января",
            "description_el": "Τα σημαντικότερα πολιτιστικά γεγονότα του μήνα.",
            "description_en": "The most important cultural events of the month.",
            "description_ru": "Самые важные культурные события месяца.",
            "days_ago": 30,
        },
    ]

    # Announcement campaigns for E2E testing (4 scenarios with varied states)
    ANNOUNCEMENT_CAMPAIGNS: list[AnnouncementCampaignSeedData] = [
        {
            "title": "E2E Test Announcement - Welcome",
            "message": "Welcome to the new platform! Check out our latest features.",
            "link_url": None,
            "hours_ago": 0.5,  # 30 min - fresh/unread
            "read_by_learner": False,
        },
        {
            "title": "E2E Test Announcement - New Feature",
            "message": "We've added exciting new learning tools. Click the link to explore!",
            "link_url": "https://example.com/new-features",
            "hours_ago": 2,  # 2 hours - with link
            "read_by_learner": True,
        },
        {
            "title": "E2E Test Announcement - Weekly Update",
            "message": "Here's what's new this week in Greek learning.",
            "link_url": None,
            "hours_ago": 24,  # 1 day ago
            "read_by_learner": True,
        },
        {
            "title": "E2E Test Announcement - Maintenance Complete",
            "message": "Scheduled maintenance has been completed successfully.",
            "link_url": None,
            "hours_ago": 168,  # 7 days ago
            "read_by_learner": False,
        },
    ]

    # Admin vocabulary cards for E2E testing
    # Deck 1: 10 cards with varying grammar data completeness
    # Deck 2: Empty deck for first card creation test
    ADMIN_CARDS_DECK_NAME_EN = "E2E Vocabulary Cards Test Deck"
    ADMIN_CARDS_DECK_NAME_EL = "E2E Δοκιμαστική Τράπουλα Καρτών Λεξιλογίου"
    ADMIN_CARDS_DECK_NAME_RU = "E2E Колода тестовых карточек словарного запаса"
    ADMIN_CARDS_EMPTY_DECK_NAME_EN = "E2E Empty Vocabulary Deck"
    ADMIN_CARDS_EMPTY_DECK_NAME_EL = "E2E Κενή Τράπουλα Λεξιλογίου"
    ADMIN_CARDS_EMPTY_DECK_NAME_RU = "E2E Пустая колода словарного запаса"
    ADMIN_CARDS: list[AdminCardSeedData] = [
        # Card 1: Basic card - just front_text and back_text_en (no grammar)
        {
            "front_text": "καλημέρα",
            "back_text_en": "good morning",
        },
        # Card 2: Card with back_text_ru
        {
            "front_text": "καληνύχτα",
            "back_text_en": "good night",
            "back_text_ru": "спокойной ночи",
        },
        # Card 3: Card with pronunciation
        {
            "front_text": "ευχαριστώ",
            "back_text_en": "thank you",
            "back_text_ru": "спасибо",
            "pronunciation": "ef-ha-ri-STO",
        },
        # Card 4: Noun card with partial noun_data (gender: masculine, some declension)
        {
            "front_text": "σπίτι",
            "back_text_en": "house",
            "back_text_ru": "дом",
            "pronunciation": "SPI-ti",
            "part_of_speech": PartOfSpeech.NOUN,
            "noun_data": {
                "gender": "neuter",
                "nominative_singular": "σπίτι",
                "genitive_singular": "σπιτιού",
                "accusative_singular": "σπίτι",
            },
        },
        # Card 5: Noun card with full noun_data (all declension fields)
        {
            "front_text": "νερό",
            "back_text_en": "water",
            "back_text_ru": "вода",
            "pronunciation": "ne-RO",
            "part_of_speech": PartOfSpeech.NOUN,
            "noun_data": {
                "gender": "neuter",
                "nominative_singular": "νερό",
                "genitive_singular": "νερού",
                "accusative_singular": "νερό",
                "vocative_singular": "νερό",
                "nominative_plural": "νερά",
                "genitive_plural": "νερών",
                "accusative_plural": "νερά",
                "vocative_plural": "νερά",
            },
        },
        # Card 6: Verb card with verb_data (voice: active, some conjugations)
        {
            "front_text": "τρώω",
            "back_text_en": "I eat",
            "back_text_ru": "я ем",
            "pronunciation": "TRO-o",
            "part_of_speech": PartOfSpeech.VERB,
            "verb_data": {
                "voice": "active",
                "present_1s": "τρώω",
                "present_2s": "τρως",
                "present_3s": "τρώει",
                "present_1p": "τρώμε",
                "present_2p": "τρώτε",
                "present_3p": "τρώνε",
            },
        },
        # Card 7: Verb card with verb_data (voice: passive, different conjugations)
        {
            "front_text": "διαβάζομαι",
            "back_text_en": "I am read",
            "back_text_ru": "меня читают",
            "pronunciation": "dhi-a-VA-zo-me",
            "part_of_speech": PartOfSpeech.VERB,
            "verb_data": {
                "voice": "passive",
                "present_1s": "διαβάζομαι",
                "present_2s": "διαβάζεσαι",
                "present_3s": "διαβάζεται",
                "present_1p": "διαβαζόμαστε",
                "present_2p": "διαβάζεστε",
                "present_3p": "διαβάζονται",
                "past_1s": "διαβάστηκα",
                "past_2s": "διαβάστηκες",
                "past_3s": "διαβάστηκε",
            },
        },
        # Card 8: Adjective card with adjective_data (some declension + comparison)
        {
            "front_text": "καλός",
            "back_text_en": "good",
            "back_text_ru": "хороший",
            "pronunciation": "ka-LOS",
            "part_of_speech": PartOfSpeech.ADJECTIVE,
            "adjective_data": {
                "masculine_nom_sg": "καλός",
                "masculine_gen_sg": "καλού",
                "masculine_acc_sg": "καλό",
                "feminine_nom_sg": "καλή",
                "feminine_gen_sg": "καλής",
                "feminine_acc_sg": "καλή",
                "neuter_nom_sg": "καλό",
                "neuter_gen_sg": "καλού",
                "neuter_acc_sg": "καλό",
                "comparative": "καλύτερος",
                "superlative": "κάλλιστος",
            },
        },
        # Card 9: Adverb card with adverb_data (comparative, superlative)
        {
            "front_text": "γρήγορα",
            "back_text_en": "quickly",
            "back_text_ru": "быстро",
            "pronunciation": "GHRI-gho-ra",
            "part_of_speech": PartOfSpeech.ADVERB,
            "adverb_data": {
                "comparative": "πιο γρήγορα",
                "superlative": "γρηγορότατα",
            },
        },
        # Card 10: Card with examples array (2-3 examples)
        {
            "front_text": "βιβλίο",
            "back_text_en": "book",
            "back_text_ru": "книга",
            "pronunciation": "vi-VLI-o",
            "part_of_speech": PartOfSpeech.NOUN,
            "noun_data": {
                "gender": "neuter",
                "nominative_singular": "βιβλίο",
                "genitive_singular": "βιβλίου",
                "accusative_singular": "βιβλίο",
            },
            "examples": [
                {
                    "greek": "Διαβάζω ένα βιβλίο.",
                    "english": "I am reading a book.",
                    "russian": "Я читаю книгу.",
                },
                {
                    "greek": "Το βιβλίο είναι στο τραπέζι.",
                    "english": "The book is on the table.",
                    "russian": "Книга на столе.",
                },
                {
                    "greek": "Αγόρασα καινούργιο βιβλίο.",
                    "english": "I bought a new book.",
                    "russian": "Я купил новую книгу.",
                },
            ],
        },
    ]

    # Culture categories with deck definitions (simple English strings)
    CULTURE_DECKS = {
        "history": {
            "name_en": "Greek History",
            "name_el": "Ελληνική Ιστορία",
            "name_ru": "Греческая история",
            "description_en": "Questions about Greek history",
            "description_el": "Ερωτήσεις για την ελληνική ιστορία",
            "description_ru": "Вопросы об истории Греции",
        },
        "geography": {
            "name_en": "Greek Geography",
            "name_el": "Ελληνική Γεωγραφία",
            "name_ru": "Греческая география",
            "description_en": "Questions about Greek geography",
            "description_el": "Ερωτήσεις για την ελληνική γεωγραφία",
            "description_ru": "Вопросы о географии Греции",
        },
        "politics": {
            "name_en": "Political System",
            "name_el": "Πολιτικό Σύστημα",
            "name_ru": "Политическая система",
            "description_en": "Questions about the political system",
            "description_el": "Ερωτήσεις για το πολιτικό σύστημα",
            "description_ru": "Вопросы о политической системе",
        },
        "culture": {
            "name_en": "Greek Culture",
            "name_el": "Ελληνικός Πολιτισμός",
            "name_ru": "Греческая культура",
            "description_en": "Questions about Greek culture",
            "description_el": "Ερωτήσεις για τον ελληνικό πολιτισμό",
            "description_ru": "Вопросы о греческой культуре",
        },
        "traditions": {
            "name_en": "Traditions and Customs",
            "name_el": "Παραδόσεις και Έθιμα",
            "name_ru": "Традиции и обычаи",
            "description_en": "Questions about Greek traditions",
            "description_el": "Ερωτήσεις για τις ελληνικές παραδόσεις",
            "description_ru": "Вопросы о греческих традициях",
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
                    {
                        "el": "Κωνσταντίνος Α'",
                        "en": "Constantine I",
                        "ru": "Константин I",
                    },
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
                    {
                        "el": "Ένωση και Δύναμη",
                        "en": "Unity and Strength",
                        "ru": "Единство и сила",
                    },
                    {
                        "el": "Νίκη ή Θάνατος",
                        "en": "Victory or Death",
                        "ru": "Победа или смерть",
                    },
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
                    {
                        "el": "Ιόνιο Πέλαγος",
                        "en": "Ionian Sea",
                        "ru": "Ионическое море",
                    },
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
                    {
                        "el": "Ο Πρωθυπουργός",
                        "en": "The Prime Minister",
                        "ru": "Премьер-министр",
                    },
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
                    {
                        "el": "Ελεγκτικό Συνέδριο",
                        "en": "Court of Audit",
                        "ru": "Счётная палата",
                    },
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
                    {
                        "el": "Δόξα και Τιμή",
                        "en": "Glory and Honor",
                        "ru": "Слава и честь",
                    },
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
                    {
                        "el": "Γιώργος Σεφέρης",
                        "en": "George Seferis",
                        "ru": "Йоргос Сеферис",
                    },
                    {
                        "el": "Κωνσταντίνος Καβάφης",
                        "en": "Constantine Cavafy",
                        "ru": "Константинос Кавафис",
                    },
                    {
                        "el": "Οδυσσέας Ελύτης",
                        "en": "Odysseas Elytis",
                        "ru": "Одиссеас Элитис",
                    },
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
                    {
                        "el": "Θέατρο Διονύσου",
                        "en": "Theatre of Dionysus",
                        "ru": "Театр Диониса",
                    },
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
                    {
                        "el": "Αρχαία Αγορά",
                        "en": "Ancient Agora",
                        "ru": "Древняя Агора",
                    },
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
                    {
                        "el": "Ρωμαιοκαθολική",
                        "en": "Roman Catholic",
                        "ru": "Римско-католическая",
                    },
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
                    {
                        "el": "Λαϊκή μουσική",
                        "en": "Folk music",
                        "ru": "Народная музыка",
                    },
                    {
                        "el": "Κλασική μουσική",
                        "en": "Classical music",
                        "ru": "Классическая музыка",
                    },
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
                    {
                        "el": "Γιώργος Λάνθιμος",
                        "en": "Yorgos Lanthimos",
                        "ru": "Йоргос Лантимос",
                    },
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
                    {
                        "el": "Πάντα τον Μάρτιο",
                        "en": "Always in March",
                        "ru": "Всегда в марте",
                    },
                    {
                        "el": "Πάντα τον Απρίλιο",
                        "en": "Always in April",
                        "ru": "Всегда в апреле",
                    },
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
                    {
                        "el": "Γαλακτομπούρεκο",
                        "en": "Galaktoboureko",
                        "ru": "Галактобуреко",
                    },
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
                    {
                        "el": "Ανάβουμε κεριά",
                        "en": "Lighting candles",
                        "ru": "Зажигание свечей",
                    },
                    {
                        "el": "Τρώμε σταφύλια",
                        "en": "Eating grapes",
                        "ru": "Едим виноград",
                    },
                    {
                        "el": "Πετάμε πιάτα",
                        "en": "Throwing plates",
                        "ru": "Бросание тарелок",
                    },
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
                    {
                        "el": "Η Μεταμόρφωση",
                        "en": "The Transfiguration",
                        "ru": "Преображение",
                    },
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
                    {
                        "el": "Δεν γιορτάζεται",
                        "en": "Not celebrated",
                        "ru": "Не отмечается",
                    },
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

    def _create_enriched_card(
        self,
        deck_id: UUID,
        greek: str,
        english: str,
        part_of_speech: PartOfSpeech | None,
        level: DeckLevel,
        example_prefix: str = "Example sentence with",
    ) -> Card:
        """Create a Card with enriched grammar data from ENRICHED_VOCABULARY.

        Looks up the Greek word in ENRICHED_VOCABULARY and populates:
        - back_text_ru (Russian translation)
        - Grammar JSONB fields (noun_data, verb_data, adjective_data, adverb_data)
        - examples (structured example sentences)
        - searchable_forms (all inflected word forms)
        - searchable_forms_normalized (accent-stripped forms)
        - level (from deck's level)

        Falls back gracefully for words not in ENRICHED_VOCABULARY.

        Args:
            deck_id: UUID of the deck this card belongs to
            greek: Greek word (front_text)
            english: English translation (back_text_en)
            part_of_speech: Part of speech enum value
            level: CEFR level for the card
            example_prefix: Prefix for fallback example_sentence

        Returns:
            Card instance with all enriched fields populated
        """
        # Look up enriched data (cast to dict for extract_searchable_forms)
        enriched: dict[str, Any] = dict(ENRICHED_VOCABULARY.get(greek, {}))

        # Extract grammar data fields
        noun_data = enriched.get("noun_data")
        verb_data = enriched.get("verb_data")
        adjective_data = enriched.get("adjective_data")
        adverb_data = enriched.get("adverb_data")

        # Get examples from enriched data
        examples = enriched.get("examples")

        # Get Russian translation
        back_text_ru = enriched.get("back_text_ru")

        # Generate searchable forms using utility functions
        searchable_forms = extract_searchable_forms(enriched, greek)
        searchable_forms_normalized = generate_normalized_forms(searchable_forms)

        # Build example_sentence for backward compatibility
        # Use first example's Greek text if available, otherwise use fallback
        if examples and len(examples) > 0:
            example_sentence = examples[0].get("greek", f"{example_prefix} '{greek}'")
        else:
            example_sentence = f"{example_prefix} '{greek}'"

        return Card(
            deck_id=deck_id,
            front_text=greek,
            back_text_en=english,
            back_text_ru=back_text_ru,
            example_sentence=example_sentence,
            pronunciation=f"/{greek}/",
            part_of_speech=part_of_speech,
            level=level,
            noun_data=noun_data,
            verb_data=verb_data,
            adjective_data=adjective_data,
            adverb_data=adverb_data,
            examples=examples,
            searchable_forms=searchable_forms,
            searchable_forms_normalized=searchable_forms_normalized,
        )

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

        # Premium levels - C1 and C2 are premium content
        premium_levels = {DeckLevel.C1, DeckLevel.C2}

        # Greek translations for CEFR levels
        level_translations_el = {
            DeckLevel.A1: "Ελληνικό Λεξιλόγιο A1",
            DeckLevel.A2: "Ελληνικό Λεξιλόγιο A2",
            DeckLevel.B1: "Ελληνικό Λεξιλόγιο B1",
            DeckLevel.B2: "Ελληνικό Λεξιλόγιο B2",
            DeckLevel.C1: "Ελληνικό Λεξιλόγιο C1",
            DeckLevel.C2: "Ελληνικό Λεξιλόγιο C2",
        }
        description_translations_el = {
            DeckLevel.A1: "Βασικό ελληνικό λεξιλόγιο για επίπεδο CEFR A1",
            DeckLevel.A2: "Βασικό ελληνικό λεξιλόγιο για επίπεδο CEFR A2",
            DeckLevel.B1: "Βασικό ελληνικό λεξιλόγιο για επίπεδο CEFR B1",
            DeckLevel.B2: "Βασικό ελληνικό λεξιλόγιο για επίπεδο CEFR B2",
            DeckLevel.C1: "Βασικό ελληνικό λεξιλόγιο για επίπεδο CEFR C1",
            DeckLevel.C2: "Βασικό ελληνικό λεξιλόγιο για επίπεδο CEFR C2",
        }
        # Russian translations for CEFR levels
        level_translations_ru = {
            DeckLevel.A1: "Греческий словарь A1",
            DeckLevel.A2: "Греческий словарь A2",
            DeckLevel.B1: "Греческий словарь B1",
            DeckLevel.B2: "Греческий словарь B2",
            DeckLevel.C1: "Греческий словарь C1",
            DeckLevel.C2: "Греческий словарь C2",
        }
        description_translations_ru = {
            DeckLevel.A1: "Основной греческий словарь для уровня CEFR A1",
            DeckLevel.A2: "Основной греческий словарь для уровня CEFR A2",
            DeckLevel.B1: "Основной греческий словарь для уровня CEFR B1",
            DeckLevel.B2: "Основной греческий словарь для уровня CEFR B2",
            DeckLevel.C1: "Основной греческий словарь для уровня CEFR C1",
            DeckLevel.C2: "Основной греческий словарь для уровня CEFR C2",
        }

        for level, words in self.VOCABULARY.items():
            # Create deck - C1 and C2 are premium
            is_premium = level in premium_levels
            deck = Deck(
                name_en=f"Greek {level.value} Vocabulary",
                name_el=level_translations_el[level],
                name_ru=level_translations_ru[level],
                description_en=f"Essential Greek vocabulary for CEFR level {level.value}",
                description_el=description_translations_el[level],
                description_ru=description_translations_ru[level],
                level=level,
                is_active=True,
                is_premium=is_premium,
                card_system=CardSystemVersion.V1,
            )
            self.db.add(deck)
            await self.db.flush()

            # Create cards with enriched grammar data
            for i, (greek, english, category, part_of_speech) in enumerate(words):
                card = self._create_enriched_card(
                    deck_id=deck.id,
                    greek=greek,
                    english=english,
                    part_of_speech=part_of_speech,
                    level=level,
                    example_prefix="Example sentence with",
                )
                self.db.add(card)

            created_decks.append(
                {
                    "id": str(deck.id),
                    "name": deck.name_en,
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

    async def seed_user_decks(self, users: list[dict[str, Any]]) -> dict[str, Any]:
        """Create user-owned decks with cards for E2E testing.

        Creates personal decks for specified test users:
        - e2e_learner: 3 decks (My Greek Basics, Travel Phrases, Practice Deck)
        - e2e_admin: 1 deck (Admin's Personal Deck)
        - Other users (beginner, advanced): 0 decks (for empty state testing)

        Args:
            users: List of user dicts with 'id' and 'email' keys from seed_users()

        Returns:
            dict with 'decks' list containing created user deck info

        Raises:
            RuntimeError: If seeding not allowed
        """
        self._check_can_seed()

        # Build user email -> UUID mapping
        user_map: dict[str, UUID] = {user["email"]: UUID(user["id"]) for user in users}
        created_decks: list[dict[str, Any]] = []

        for email, deck_configs in self.USER_DECKS.items():
            user_id = user_map.get(email)
            if not user_id:
                # Skip if user not found (e.g., email not in seeded users)
                continue

            for deck_config in deck_configs:
                # Create deck with owner_id set to the user
                deck = Deck(
                    name_en=deck_config["name_en"],
                    name_el=deck_config["name_el"],
                    name_ru=deck_config["name_ru"],
                    description_en=deck_config["description_en"],
                    description_el=deck_config["description_el"],
                    description_ru=deck_config["description_ru"],
                    level=deck_config["level"],
                    is_active=True,
                    is_premium=False,  # User decks are never premium
                    owner_id=user_id,
                    card_system=CardSystemVersion.V1,
                )
                self.db.add(deck)
                await self.db.flush()

                # Create cards if card_count > 0
                card_count = deck_config["card_count"]
                if card_count > 0:
                    # Reuse vocabulary from existing VOCABULARY dict
                    vocab = self.VOCABULARY.get(deck_config["level"], [])
                    words_to_use = vocab[:card_count]

                    for i, (greek, english, category, part_of_speech) in enumerate(words_to_use):
                        card = self._create_enriched_card(
                            deck_id=deck.id,
                            greek=greek,
                            english=english,
                            part_of_speech=part_of_speech,
                            level=deck_config["level"],
                            example_prefix="User example:",
                        )
                        self.db.add(card)

                created_decks.append(
                    {
                        "id": str(deck.id),
                        "name": deck.name_en,
                        "level": deck_config["level"].value,
                        "card_count": card_count,
                        "owner_id": str(user_id),
                        "owner_email": email,
                    }
                )

        await self.db.flush()

        return {
            "success": True,
            "decks": created_decks,
            "total_user_decks": len(created_decks),
            "total_user_cards": sum(d["card_count"] for d in created_decks),
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
            select(Card.id).where(Card.deck_id == deck_id).order_by(Card.created_at)
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
                name_en=deck_data["name_en"],
                name_el=deck_data["name_el"],
                name_ru=deck_data["name_ru"],
                description_en=deck_data["description_en"],
                description_el=deck_data["description_el"],
                description_ru=deck_data["description_ru"],
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

            created_decks.append(
                {
                    "id": str(deck.id),
                    "name": deck_data["name_en"],
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
    # Mock Exam Seeding
    # =====================

    async def seed_mock_exam_history(self, user_id: UUID) -> dict[str, Any]:
        """Create mock exam history for a user.

        Creates completed mock exam sessions with answers for E2E testing.
        The data simulates a realistic exam history with mix of passed and failed exams.

        Args:
            user_id: User to create mock exam history for

        Returns:
            dict with seeding summary including sessions and answers created

        Raises:
            RuntimeError: If seeding not allowed
        """
        self._check_can_seed()

        # Get culture question IDs from database (need 25 for each exam)
        result = await self.db.execute(
            select(CultureQuestion.id).order_by(CultureQuestion.id).limit(50)
        )
        question_ids = [row[0] for row in result.fetchall()]

        if len(question_ids) < 25:
            return {
                "success": False,
                "error": f"Need at least 25 culture questions, found {len(question_ids)}. "
                "Run seed_culture_decks_and_questions() first.",
                "sessions_created": 0,
                "answers_created": 0,
            }

        sessions_created = 0
        answers_created = 0
        now = datetime.now(timezone.utc)

        for exam_config in self.MOCK_EXAM_SESSIONS:
            score = exam_config["score"]
            total_questions = exam_config["total_questions"]
            passed = exam_config["passed"]
            time_taken_seconds = exam_config["time_taken_seconds"]
            days_ago = exam_config["days_ago"]

            # Calculate timestamps
            exam_date = now - timedelta(days=days_ago)
            started_at = exam_date
            completed_at = exam_date + timedelta(seconds=time_taken_seconds)

            # Create the session
            session = MockExamSession(
                user_id=user_id,
                started_at=started_at,
                completed_at=completed_at,
                score=score,
                total_questions=total_questions,
                passed=passed,
                time_taken_seconds=time_taken_seconds,
                status=MockExamStatus.COMPLETED,
            )
            self.db.add(session)
            await self.db.flush()  # Get session ID
            sessions_created += 1

            # Create 25 answers for this session
            # Use first 25 questions (cycling if needed)
            exam_questions = question_ids[:25]

            # Calculate average time per question
            avg_time_per_question = time_taken_seconds // total_questions

            for i, question_id in enumerate(exam_questions):
                # First `score` answers are correct, rest are incorrect
                is_correct = i < score
                # Correct answer is always option 1 in our seed data
                selected_option = 1 if is_correct else 2

                # Spread answer times across the exam duration
                answer_time = started_at + timedelta(seconds=avg_time_per_question * (i + 1))

                answer = MockExamAnswer(
                    session_id=session.id,
                    question_id=question_id,
                    selected_option=selected_option,
                    is_correct=is_correct,
                    time_taken_seconds=avg_time_per_question,
                    answered_at=answer_time,
                )
                self.db.add(answer)
                answers_created += 1

        await self.db.flush()

        return {
            "success": True,
            "sessions_created": sessions_created,
            "answers_created": answers_created,
            "passed_count": sum(1 for e in self.MOCK_EXAM_SESSIONS if e["passed"]),
            "failed_count": sum(1 for e in self.MOCK_EXAM_SESSIONS if not e["passed"]),
        }

    # =====================
    # Question Review Seeding
    # =====================

    async def seed_pending_question(self) -> dict[str, Any]:
        """Seed a pending culture question for admin review E2E tests.

        Creates a question with is_pending_review=True and deck_id=None.
        This simulates a question awaiting admin approval.

        This method is idempotent - if a question with the same source_article_url
        exists, it will be deleted and recreated to ensure a fresh pending state.

        Returns:
            dict with question_id and source_article_url
        """
        self._check_can_seed()

        # Use a test URL for the pending question
        source_url = "https://e2e-test.example.com/cypriot-culture-article"
        await self.db.execute(
            delete(CultureQuestion).where(CultureQuestion.source_article_url == source_url)
        )

        # Create pending question without deck assignment
        question = CultureQuestion(
            deck_id=None,
            question_text={
                "el": "Ποιος ήταν ο πρώτος πρόεδρος της Κυπριακής Δημοκρατίας;",
                "en": "Who was the first president of the Republic of Cyprus?",
                "ru": "Кто был первым президентом Республики Кипр?",
            },
            option_a={
                "el": "Γλαύκος Κληρίδης",
                "en": "Glafcos Clerides",
                "ru": "Глафкос Клиридис",
            },
            option_b={
                "el": "Μακάριος Γ΄",
                "en": "Makarios III",
                "ru": "Макариос III",
            },
            option_c={
                "el": "Σπύρος Κυπριανού",
                "en": "Spyros Kyprianou",
                "ru": "Спирос Киприану",
            },
            option_d={
                "el": "Τάσσος Παπαδόπουλος",
                "en": "Tassos Papadopoulos",
                "ru": "Тассос Пападопулос",
            },
            correct_option=2,
            is_pending_review=True,
            source_article_url=source_url,
        )

        self.db.add(question)
        await self.db.flush()

        return {
            "question_id": str(question.id),
            "source_article_url": question.source_article_url,
        }

    # =====================
    # News Feed Seeding
    # =====================

    async def seed_news_items(self) -> dict[str, Any]:
        """Create news items for E2E testing.

        Creates 5 news items with varied publication dates for testing:
        - News section display on dashboard
        - Admin news tab functionality
        - Pagination

        This method is idempotent - it deletes existing E2E test news items
        before creating new ones.

        Returns:
            dict with seeding summary including created items

        Raises:
            RuntimeError: If seeding not allowed
        """
        self._check_can_seed()

        # Delete existing E2E test news items (idempotent)
        await self.db.execute(
            delete(NewsItem).where(
                NewsItem.original_article_url.like("https://example.com/e2e-test-article-%")
            )
        )

        created_items = []
        today = date.today()

        for i, item_data in enumerate(self.NEWS_ITEMS, start=1):
            publication_date = today - timedelta(days=item_data["days_ago"])

            news_item = NewsItem(
                title_el=item_data["title_el"],
                title_en=item_data["title_en"],
                title_ru=item_data["title_ru"],
                description_el=item_data["description_el"],
                description_en=item_data["description_en"],
                description_ru=item_data["description_ru"],
                publication_date=publication_date,
                original_article_url=f"https://example.com/e2e-test-article-{i}",
                image_s3_key=f"news/e2e-test-image-{i}.jpg",
            )
            self.db.add(news_item)
            await self.db.flush()

            created_items.append(
                {
                    "id": str(news_item.id),
                    "title_en": news_item.title_en,
                    "publication_date": str(news_item.publication_date),
                }
            )

        return {
            "success": True,
            "news_items": created_items,
            "count": len(created_items),
        }

    async def seed_announcement_campaigns(
        self,
        admin_id: UUID,
        learner_id: UUID,
    ) -> dict[str, Any]:
        """Create announcement campaigns and notifications for E2E testing.

        Creates 4 announcement campaigns with varying states:
        - Fresh announcement (30 min ago, unread)
        - Recent with link (2 hours ago, read)
        - Day-old announcement (24 hours ago, read)
        - Week-old announcement (7 days ago, unread)

        This method is idempotent - it deletes existing E2E test announcements
        before creating new ones.

        Args:
            admin_id: UUID of the admin user who creates announcements
            learner_id: UUID of the learner user who receives notifications

        Returns:
            dict with seeding summary including created campaigns

        Raises:
            RuntimeError: If seeding not allowed
        """
        self._check_can_seed()

        now = datetime.now(timezone.utc)

        # Delete existing E2E test announcements (idempotent)
        await self.db.execute(
            delete(AnnouncementCampaign).where(
                AnnouncementCampaign.title.like("E2E Test Announcement%")
            )
        )
        # Delete related notifications
        await self.db.execute(
            delete(Notification).where(
                Notification.type == NotificationType.ADMIN_ANNOUNCEMENT,
                Notification.title.like("E2E Test Announcement%"),
            )
        )

        created_campaigns = []

        for config in self.ANNOUNCEMENT_CAMPAIGNS:
            campaign_time = now - timedelta(hours=config["hours_ago"])

            # Create campaign
            campaign = AnnouncementCampaign(
                title=config["title"],
                message=config["message"],
                link_url=config.get("link_url"),
                created_by=admin_id,
                total_recipients=1,
                read_count=1 if config["read_by_learner"] else 0,
            )
            self.db.add(campaign)
            await self.db.flush()

            # Backdate created_at
            await self.db.execute(
                update(AnnouncementCampaign)
                .where(AnnouncementCampaign.id == campaign.id)
                .values(created_at=campaign_time)
            )

            # Create notification for learner
            notification = Notification(
                user_id=learner_id,
                type=NotificationType.ADMIN_ANNOUNCEMENT,
                title=config["title"],
                message=config["message"],
                icon="megaphone",
                action_url=config.get("link_url"),
                extra_data={"campaign_id": str(campaign.id)},
                read=config["read_by_learner"],
                read_at=(
                    campaign_time + timedelta(minutes=30) if config["read_by_learner"] else None
                ),
            )
            self.db.add(notification)
            await self.db.flush()

            # Backdate notification created_at
            await self.db.execute(
                update(Notification)
                .where(Notification.id == notification.id)
                .values(created_at=campaign_time)
            )

            created_campaigns.append(
                {
                    "id": str(campaign.id),
                    "title": config["title"],
                    "read_by_learner": config["read_by_learner"],
                }
            )

        return {
            "success": True,
            "campaigns_created": len(created_campaigns),
            "campaigns": created_campaigns,
        }

    async def seed_news_questions(self) -> dict[str, Any]:
        """Create news items with linked culture questions for E2E testing.

        Creates:
        - 2 NewsItems WITH associated CultureQuestions
        - 1 NewsItem WITHOUT associated question
        - Uses/creates "E2E News Questions" culture deck

        This method is idempotent - deletes existing E2E test data first.

        Returns:
            dict with seeding summary including created items

        Raises:
            RuntimeError: If seeding not allowed
        """
        self._check_can_seed()

        # Delete existing E2E news-questions test data (questions first for FK safety)
        await self.db.execute(
            delete(CultureQuestion).where(
                CultureQuestion.original_article_url.like("https://example.com/e2e-news-question-%")
            )
        )
        await self.db.execute(
            delete(NewsItem).where(
                NewsItem.original_article_url.like("https://example.com/e2e-news-question-%")
            )
        )

        # Find or create E2E culture deck
        result = await self.db.execute(
            select(CultureDeck).where(CultureDeck.name_en == "E2E News Questions")
        )
        deck = result.scalar_one_or_none()

        if not deck:
            deck = CultureDeck(
                name_en="E2E News Questions",
                name_el="E2E Ερωτήσεις Ειδήσεων",
                name_ru="E2E Новостные вопросы",
                description_en="Deck for E2E testing news-linked questions",
                description_el="Τράπουλα για δοκιμές E2E ερωτήσεων που σχετίζονται με ειδήσεις",
                description_ru="Колода для E2E тестирования вопросов, связанных с новостями",
                category="culture",
                is_active=True,
                is_premium=False,
            )
            self.db.add(deck)
            await self.db.flush()

        news_items_data = []
        questions_data = []

        # News item 1 - WITH question
        news_1 = NewsItem(
            title_el="Κυπριακή κουλτούρα: Παραδόσεις",
            title_en="Cypriot Culture: Traditions",
            title_ru="Кипрская культура: Традиции",
            description_el="Ανακαλύψτε τις παραδόσεις της Κύπρου.",
            description_en="Discover the traditions of Cyprus.",
            description_ru="Откройте для себя традиции Кипра.",
            image_s3_key="news-images/e2e-placeholder.jpg",
            publication_date=date.today(),
            original_article_url="https://example.com/e2e-news-question-1",
        )
        self.db.add(news_1)

        question_1 = CultureQuestion(
            deck_id=deck.id,
            question_text={
                "el": "Ποια είναι η παραδοσιακή κυπριακή γιορτή την άνοιξη;",
                "en": "What is the traditional Cypriot spring festival?",
            },
            option_a={"el": "Κατακλυσμός", "en": "Kataklysmos"},
            option_b={"el": "Ανθεστήρια", "en": "Anthestiria"},
            option_c={"el": "Πάσχα", "en": "Easter"},
            option_d={"el": "Καρναβάλι", "en": "Carnival"},
            correct_option=2,
            original_article_url="https://example.com/e2e-news-question-1",
            is_pending_review=False,
        )
        self.db.add(question_1)

        # News item 2 - WITH question
        news_2 = NewsItem(
            title_el="Ιστορία της Κύπρου",
            title_en="History of Cyprus",
            title_ru="История Кипра",
            description_el="Μάθετε για την πλούσια ιστορία.",
            description_en="Learn about the rich history.",
            description_ru="Узнайте о богатой истории.",
            image_s3_key="news-images/e2e-placeholder.jpg",
            publication_date=date.today() - timedelta(days=1),
            original_article_url="https://example.com/e2e-news-question-2",
        )
        self.db.add(news_2)

        question_2 = CultureQuestion(
            deck_id=deck.id,
            question_text={
                "el": "Πότε έγινε η Κύπρος ανεξάρτητη;",
                "en": "When did Cyprus become independent?",
            },
            option_a={"el": "1950", "en": "1950"},
            option_b={"el": "1960", "en": "1960"},
            option_c={"el": "1970", "en": "1970"},
            option_d={"el": "1974", "en": "1974"},
            correct_option=2,
            original_article_url="https://example.com/e2e-news-question-2",
            is_pending_review=False,
        )
        self.db.add(question_2)

        # News item 3 - WITHOUT question
        news_3 = NewsItem(
            title_el="Τρέχοντα νέα",
            title_en="Current News",
            title_ru="Текущие новости",
            description_el="Τελευταία νέα από την Κύπρο.",
            description_en="Latest news from Cyprus.",
            description_ru="Последние новости с Кипра.",
            image_s3_key="news-images/e2e-placeholder.jpg",
            publication_date=date.today() - timedelta(days=2),
            original_article_url="https://example.com/e2e-news-question-3-no-question",
        )
        self.db.add(news_3)

        await self.db.flush()

        news_items_data = [
            {
                "id": str(news_1.id),
                "has_question": True,
                "url": news_1.original_article_url,
            },
            {
                "id": str(news_2.id),
                "has_question": True,
                "url": news_2.original_article_url,
            },
            {
                "id": str(news_3.id),
                "has_question": False,
                "url": news_3.original_article_url,
            },
        ]
        questions_data = [
            {"id": str(question_1.id), "deck_id": str(deck.id)},
            {"id": str(question_2.id), "deck_id": str(deck.id)},
        ]

        return {
            "success": True,
            "deck_id": str(deck.id),
            "news_items_created": 3,
            "questions_created": 2,
            "news_items": news_items_data,
            "questions": questions_data,
        }

    async def seed_news_feed_page(self) -> dict[str, Any]:
        """Create comprehensive news items for E2E testing of the News Feed Page.

        Creates:
        - 25 NewsItems with varied categories and difficulty levels
        - 10 items WITH associated CultureQuestions (3-5 questions each)
        - 15 items WITHOUT associated questions
        - Uses/creates "E2E News Feed Page" culture deck

        This method is idempotent - deletes existing E2E test data first.

        Returns:
            dict with seeding summary including created items and questions

        Raises:
            RuntimeError: If seeding not allowed
        """
        self._check_can_seed()

        # Delete existing E2E news-feed-page test data (questions first for FK safety)
        await self.db.execute(
            delete(CultureQuestion).where(
                CultureQuestion.original_article_url.like(
                    "https://example.com/e2e-news-feed-page-%"
                )
            )
        )
        await self.db.execute(
            delete(NewsItem).where(
                NewsItem.original_article_url.like("https://example.com/e2e-news-feed-page-%")
            )
        )

        # Find or create E2E culture deck for news page questions
        result = await self.db.execute(
            select(CultureDeck).where(CultureDeck.name_en == "E2E News Feed Page")
        )
        deck = result.scalar_one_or_none()

        if not deck:
            deck = CultureDeck(
                name_en="E2E News Feed Page",
                name_el="E2E Σελίδα Ροής Ειδήσεων",
                name_ru="E2E Страница ленты новостей",
                description_en="Deck for E2E testing news feed page pagination and filtering",
                description_el="Τράπουλα για δοκιμές E2E σελιδοποίησης και φιλτραρίσματος ροής ειδήσεων",
                description_ru="Колода для E2E тестирования пагинации и фильтрации страницы ленты новостей",
                category="culture",
                is_active=True,
                is_premium=False,
            )
            self.db.add(deck)
            await self.db.flush()

        # Define categories and difficulty levels for variety
        categories = [
            "politics",
            "culture",
            "sports",
            "economy",
            "science",
            "technology",
        ]
        difficulty_levels = ["A1", "A2", "B1", "B2"]

        # News items data - 25 items total
        # Greek titles with variety of topics
        news_titles = [
            (
                "Η Ελλάδα γιορτάζει την Εθνική Επέτειο",
                "Greece Celebrates National Anniversary",
                "Греция празднует национальную годовщину",
            ),
            (
                "Νέα ανακάλυψη στην αρχαία Ολυμπία",
                "New Discovery at Ancient Olympia",
                "Новое открытие в древней Олимпии",
            ),
            (
                "Οικονομική ανάπτυξη στην Ελλάδα",
                "Economic Growth in Greece",
                "Экономический рост в Греции",
            ),
            (
                "Ο τουρισμός σπάει ρεκόρ",
                "Tourism Breaks Records",
                "Туризм бьет рекорды",
            ),
            (
                "Νέα τεχνολογική επένδυση στην Αθήνα",
                "New Tech Investment in Athens",
                "Новые технологические инвестиции в Афины",
            ),
            (
                "Αθλητικές επιτυχίες για την Ελλάδα",
                "Athletic Successes for Greece",
                "Спортивные успехи Греции",
            ),
            (
                "Πολιτιστικό φεστιβάλ στη Θεσσαλονίκη",
                "Cultural Festival in Thessaloniki",
                "Культурный фестиваль в Салониках",
            ),
            (
                "Νέο πανεπιστημιακό πρόγραμμα",
                "New University Program",
                "Новая университетская программа",
            ),
            (
                "Περιβαλλοντική πρωτοβουλία στα νησιά",
                "Environmental Initiative on the Islands",
                "Экологическая инициатива на островах",
            ),
            (
                "Διεθνής συνεργασία στην έρευνα",
                "International Research Collaboration",
                "Международное сотрудничество в исследованиях",
            ),
            ("Νέο μουσείο στην Κρήτη", "New Museum in Crete", "Новый музей на Крите"),
            (
                "Οι Έλληνες επιστήμονες διακρίνονται",
                "Greek Scientists Excel",
                "Греческие ученые отличаются",
            ),
            (
                "Αγροτική καινοτομία στη Μακεδονία",
                "Agricultural Innovation in Macedonia",
                "Сельскохозяйственные инновации в Македонии",
            ),
            (
                "Νέα έργα υποδομής στην Πελοπόννησο",
                "New Infrastructure Projects in Peloponnese",
                "Новые инфраструктурные проекты на Пелопоннесе",
            ),
            (
                "Διπλωματικές εξελίξεις στην Ανατολική Μεσόγειο",
                "Diplomatic Developments in Eastern Mediterranean",
                "Дипломатические события в Восточном Средиземноморье",
            ),
            (
                "Νέα μέτρα για την ενέργεια",
                "New Energy Measures",
                "Новые энергетические меры",
            ),
            (
                "Φεστιβάλ κινηματογράφου στην Αθήνα",
                "Film Festival in Athens",
                "Кинофестиваль в Афинах",
            ),
            (
                "Πρόοδος στην ψηφιακή μετάβαση",
                "Progress in Digital Transition",
                "Прогресс в цифровой трансформации",
            ),
            (
                "Νέες τουριστικές διαδρομές στα Δωδεκάνησα",
                "New Tourist Routes in Dodecanese",
                "Новые туристические маршруты на Додеканесе",
            ),
            (
                "Ελληνική γαστρονομία στο επίκεντρο",
                "Greek Gastronomy in Focus",
                "Греческая гастрономия в центре внимания",
            ),
            (
                "Συνέδριο για την κλιματική αλλαγή",
                "Climate Change Conference",
                "Конференция по изменению климата",
            ),
            (
                "Νέα θέατρα στην περιφέρεια",
                "New Theaters in the Regions",
                "Новые театры в регионах",
            ),
            (
                "Επιτυχίες στον ναυτιλιακό τομέα",
                "Successes in the Shipping Sector",
                "Успехи в судоходном секторе",
            ),
            (
                "Καινοτομία στην ελληνική βιομηχανία",
                "Innovation in Greek Industry",
                "Инновации в греческой промышленности",
            ),
            (
                "Διεθνείς βραβεύσεις για ελληνικά προϊόντα",
                "International Awards for Greek Products",
                "Международные награды для греческих продуктов",
            ),
        ]

        # Summaries in Greek/English/Russian
        summary_templates = [
            (
                "Σημαντικές εξελίξεις στον τομέα αυτό που επηρεάζουν την καθημερινότητα.",
                "Important developments in this sector affecting daily life.",
                "Важные события в этой области, влияющие на повседневную жизнь.",
            ),
            (
                "Νέα πρωτοβουλία που υπόσχεται σημαντικές αλλαγές.",
                "A new initiative promising significant changes.",
                "Новая инициатива, обещающая значительные изменения.",
            ),
            (
                "Ανακοινώθηκαν νέα μέτρα από τις αρμόδιες αρχές.",
                "New measures announced by the relevant authorities.",
                "Объявлены новые меры соответствующими органами.",
            ),
            (
                "Θετικές εξελίξεις που ενισχύουν την ανάπτυξη.",
                "Positive developments strengthening growth.",
                "Положительные события, способствующие росту.",
            ),
            (
                "Σημαντική πρόοδος καταγράφηκε τις τελευταίες ημέρες.",
                "Significant progress recorded in recent days.",
                "Значительный прогресс зафиксирован в последние дни.",
            ),
        ]

        today = date.today()
        news_items_data = []
        questions_data = []

        # Items with questions (indices 0-9)
        items_with_questions = set(range(10))

        # Question templates for news items
        # TypedDict would be better, but inline type annotation is simpler
        question_templates: list[dict[str, Any]] = [
            {
                "question": {
                    "el": "Ποιο είναι το κύριο θέμα του άρθρου;",
                    "en": "What is the main topic of the article?",
                    "ru": "Какова основная тема статьи?",
                },
                "options": [
                    {"el": "Πολιτική", "en": "Politics", "ru": "Политика"},
                    {"el": "Οικονομία", "en": "Economy", "ru": "Экономика"},
                    {"el": "Πολιτισμός", "en": "Culture", "ru": "Культура"},
                    {"el": "Αθλητισμός", "en": "Sports", "ru": "Спорт"},
                ],
                "correct": 3,
            },
            {
                "question": {
                    "el": "Πού αναφέρεται το άρθρο;",
                    "en": "Where does the article refer to?",
                    "ru": "О каком месте идет речь в статье?",
                },
                "options": [
                    {"el": "Αθήνα", "en": "Athens", "ru": "Афины"},
                    {"el": "Θεσσαλονίκη", "en": "Thessaloniki", "ru": "Салоники"},
                    {"el": "Κρήτη", "en": "Crete", "ru": "Крит"},
                    {"el": "Πελοπόννησος", "en": "Peloponnese", "ru": "Пелопоннес"},
                ],
                "correct": 1,
            },
            {
                "question": {
                    "el": "Τι είδους ανάπτυξη περιγράφεται;",
                    "en": "What type of development is described?",
                    "ru": "Какой тип развития описывается?",
                },
                "options": [
                    {"el": "Οικονομική", "en": "Economic", "ru": "Экономическое"},
                    {
                        "el": "Τεχνολογική",
                        "en": "Technological",
                        "ru": "Технологическое",
                    },
                    {"el": "Πολιτιστική", "en": "Cultural", "ru": "Культурное"},
                    {
                        "el": "Περιβαλλοντική",
                        "en": "Environmental",
                        "ru": "Экологическое",
                    },
                ],
                "correct": 2,
            },
            {
                "question": {
                    "el": "Ποιος είναι ο στόχος της πρωτοβουλίας;",
                    "en": "What is the goal of the initiative?",
                    "ru": "Какова цель инициативы?",
                },
                "options": [
                    {
                        "el": "Βελτίωση της ποιότητας ζωής",
                        "en": "Improving quality of life",
                        "ru": "Улучшение качества жизни",
                    },
                    {
                        "el": "Οικονομική ανάπτυξη",
                        "en": "Economic growth",
                        "ru": "Экономический рост",
                    },
                    {
                        "el": "Προστασία περιβάλλοντος",
                        "en": "Environmental protection",
                        "ru": "Защита окружающей среды",
                    },
                    {
                        "el": "Πολιτιστική προώθηση",
                        "en": "Cultural promotion",
                        "ru": "Продвижение культуры",
                    },
                ],
                "correct": 1,
            },
            {
                "question": {
                    "el": "Ποιο είναι το αναμενόμενο αποτέλεσμα;",
                    "en": "What is the expected outcome?",
                    "ru": "Каков ожидаемый результат?",
                },
                "options": [
                    {
                        "el": "Αύξηση επισκεπτών",
                        "en": "Increase in visitors",
                        "ru": "Увеличение посетителей",
                    },
                    {
                        "el": "Νέες θέσεις εργασίας",
                        "en": "New jobs",
                        "ru": "Новые рабочие места",
                    },
                    {
                        "el": "Βελτίωση υποδομών",
                        "en": "Infrastructure improvement",
                        "ru": "Улучшение инфраструктуры",
                    },
                    {
                        "el": "Διεθνής αναγνώριση",
                        "en": "International recognition",
                        "ru": "Международное признание",
                    },
                ],
                "correct": 4,
            },
        ]

        for i, (title_el, title_en, title_ru) in enumerate(news_titles):
            # Calculate publication date spread over 30 days
            days_ago = i  # Items spread across 0-24 days ago
            publication_date = today - timedelta(days=days_ago)

            # Rotate through categories and difficulty levels
            category = categories[i % len(categories)]
            difficulty = difficulty_levels[i % len(difficulty_levels)]

            # Get summary from templates
            summary_el, summary_en, summary_ru = summary_templates[i % len(summary_templates)]

            # Create URL for this item
            article_url = f"https://example.com/e2e-news-feed-page-{i + 1}"

            news_item = NewsItem(
                title_el=title_el,
                title_en=title_en,
                title_ru=title_ru,
                description_el=summary_el,
                description_en=summary_en,
                description_ru=summary_ru,
                image_s3_key=f"news-images/e2e-news-feed-page-{i + 1}.jpg",
                publication_date=publication_date,
                original_article_url=article_url,
            )
            self.db.add(news_item)
            await self.db.flush()

            has_questions = i in items_with_questions
            news_items_data.append(
                {
                    "id": str(news_item.id),
                    "title_en": title_en,
                    "publication_date": str(publication_date),
                    "category": category,
                    "difficulty": difficulty,
                    "has_questions": has_questions,
                }
            )

            # Create questions for items 0-9 (10 items with 3-5 questions each)
            if has_questions:
                # Number of questions varies: 3, 4, or 5
                num_questions = 3 + (i % 3)  # 3, 4, 5, 3, 4, 5, 3, 4, 5, 3

                for q_idx in range(num_questions):
                    template = question_templates[q_idx % len(question_templates)]

                    question = CultureQuestion(
                        deck_id=deck.id,
                        question_text=template["question"],
                        option_a=template["options"][0],
                        option_b=template["options"][1],
                        option_c=template["options"][2],
                        option_d=template["options"][3],
                        correct_option=template["correct"],
                        original_article_url=article_url,
                        is_pending_review=False,
                    )
                    self.db.add(question)
                    await self.db.flush()

                    questions_data.append(
                        {
                            "id": str(question.id),
                            "news_item_id": str(news_item.id),
                            "article_url": article_url,
                        }
                    )

        return {
            "success": True,
            "deck_id": str(deck.id),
            "news_items_created": len(news_items_data),
            "questions_created": len(questions_data),
            "items_with_questions": len(items_with_questions),
            "items_without_questions": len(news_items_data) - len(items_with_questions),
            "news_items": news_items_data,
            "questions": questions_data,
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
                "action_url": "/achievements",
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
    # Danger Zone User Seeding
    # =====================

    async def seed_danger_zone_users(self) -> dict[str, Any]:  # noqa: C901
        """Create danger zone test users for E2E testing.

        Creates two test users:
        - e2e_danger_reset@test.com: Full progress data for reset testing
        - e2e_danger_delete@test.com: Minimal data for deletion testing

        This method is idempotent - it deletes existing users before recreating.
        Requires /seed/content and /seed/culture to be called first.

        Returns:
            dict with created users and data counts

        Raises:
            RuntimeError: If seeding not allowed
        """
        self._check_can_seed()

        now = datetime.now(timezone.utc)
        created_users: list[dict[str, Any]] = []
        data_counts: dict[str, int] = {
            "deck_progress": 0,
            "card_statistics": 0,
            "reviews": 0,
            "xp_transactions": 0,
            "achievements": 0,
            "mock_exam_sessions": 0,
            "mock_exam_answers": 0,
            "culture_stats": 0,
            "culture_history": 0,
            "notifications": 0,
        }

        for user_data in self.DANGER_ZONE_USERS:
            email = user_data["email"]

            # Check if user exists
            result = await self.db.execute(select(User).where(User.email == email))
            existing_user = result.scalar_one_or_none()

            # Delete existing user and all their data in FK-safe order
            if existing_user:
                user_id = existing_user.id

                # Delete in FK-safe order (children first)
                # 1. Reviews
                await self.db.execute(delete(Review).where(Review.user_id == user_id))
                # 2. Card statistics
                await self.db.execute(
                    delete(CardStatistics).where(CardStatistics.user_id == user_id)
                )
                # 3. User deck progress
                await self.db.execute(
                    delete(UserDeckProgress).where(UserDeckProgress.user_id == user_id)
                )
                # 4. Culture answer history
                await self.db.execute(
                    delete(CultureAnswerHistory).where(CultureAnswerHistory.user_id == user_id)
                )
                # 5. Culture question stats
                await self.db.execute(
                    delete(CultureQuestionStats).where(CultureQuestionStats.user_id == user_id)
                )
                # 6. Mock exam answers (via session cascade won't work, delete explicitly)
                await self.db.execute(
                    delete(MockExamAnswer).where(
                        MockExamAnswer.session_id.in_(
                            select(MockExamSession.id).where(MockExamSession.user_id == user_id)
                        )
                    )
                )
                # 7. Mock exam sessions
                await self.db.execute(
                    delete(MockExamSession).where(MockExamSession.user_id == user_id)
                )
                # 8. XP transactions
                await self.db.execute(delete(XPTransaction).where(XPTransaction.user_id == user_id))
                # 9. User achievements
                await self.db.execute(
                    delete(UserAchievement).where(UserAchievement.user_id == user_id)
                )
                # 10. Notifications
                await self.db.execute(delete(Notification).where(Notification.user_id == user_id))
                # 11. User XP
                await self.db.execute(delete(UserXP).where(UserXP.user_id == user_id))
                # 12. User settings
                await self.db.execute(delete(UserSettings).where(UserSettings.user_id == user_id))
                # 13. Finally, delete the user
                await self.db.execute(delete(User).where(User.id == user_id))
                await self.db.flush()

            # Create fresh user
            user = User(
                email=email,
                full_name=user_data["full_name"],
                password_hash=None,  # Auth0 users don't have password
                auth0_id=user_data["auth0_id"],
                is_superuser=user_data["is_superuser"],
                is_active=user_data["is_active"],
                email_verified_at=now,
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
            await self.db.flush()

            user_info: dict[str, Any] = {
                "id": str(user.id),
                "email": email,
                "full_name": user_data["full_name"],
            }

            # Create progress data for the "reset" user
            if user_data.get("has_progress"):
                # Get existing decks (require /seed/content called first)
                decks_result = await self.db.execute(select(Deck).order_by(Deck.level).limit(2))
                decks = decks_result.scalars().all()

                if len(decks) < 2:
                    user_info["error"] = "Insufficient decks. Run /seed/content first."
                    created_users.append(user_info)
                    continue

                # Create UserDeckProgress for 2 decks
                for deck in decks:
                    deck_progress = UserDeckProgress(
                        user_id=user.id,
                        deck_id=deck.id,
                        cards_studied=5,
                        cards_mastered=3,
                        total_reviews=15,
                        current_streak=3,
                        longest_streak=5,
                        last_studied_at=now - timedelta(hours=2),
                    )
                    self.db.add(deck_progress)
                    data_counts["deck_progress"] += 1

                # Get cards from those decks for statistics
                cards_result = await self.db.execute(
                    select(Card).where(Card.deck_id.in_([d.id for d in decks])).limit(10)
                )
                cards = cards_result.scalars().all()

                # Create CardStatistics for cards in those decks
                today = date.today()
                for i, card in enumerate(cards):
                    # 60% mastered, 20% learning, 20% new
                    if i < 6:
                        status = CardStatus.MASTERED
                        ef = 2.8
                        interval = 21
                        reps = 5
                    elif i < 8:
                        status = CardStatus.LEARNING
                        ef = 2.3
                        interval = 3
                        reps = 2
                    else:
                        status = CardStatus.NEW
                        ef = 2.5
                        interval = 0
                        reps = 0

                    card_stat = CardStatistics(
                        user_id=user.id,
                        card_id=card.id,
                        easiness_factor=ef,
                        interval=interval,
                        repetitions=reps,
                        next_review_date=today + timedelta(days=interval),
                        status=status,
                    )
                    self.db.add(card_stat)
                    data_counts["card_statistics"] += 1

                # Create Reviews for studied cards
                for card in cards[:8]:  # Reviews for non-new cards
                    for j in range(5):  # 5 reviews per card
                        review = Review(
                            user_id=user.id,
                            card_id=card.id,
                            rating=4 if j % 2 == 0 else 3,  # Mix of ratings
                            reviewed_at=now - timedelta(days=10 - j * 2),
                        )
                        self.db.add(review)
                        data_counts["reviews"] += 1

                # Create UserXP with 500 XP, level 3
                user_xp = UserXP(
                    user_id=user.id,
                    total_xp=500,
                    current_level=3,
                )
                self.db.add(user_xp)

                # Create 5 XPTransaction records
                xp_reasons = [
                    ("correct_answer", 10),
                    ("daily_goal", 50),
                    ("correct_answer", 10),
                    ("streak_bonus", 30),
                    ("correct_answer", 10),
                ]
                for reason, amount in xp_reasons:
                    xp_tx = XPTransaction(
                        user_id=user.id,
                        amount=amount,
                        reason=reason,
                        earned_at=now - timedelta(hours=len(xp_reasons)),
                    )
                    self.db.add(xp_tx)
                    data_counts["xp_transactions"] += 1

                # Unlock 3 achievements via UserAchievement
                achievement_ids = [
                    "streak_first_flame",
                    "learning_first_word",
                    "session_quick_study",
                ]
                for ach_id in achievement_ids:
                    user_ach = UserAchievement(
                        user_id=user.id,
                        achievement_id=ach_id,
                        unlocked_at=now - timedelta(days=1),
                    )
                    self.db.add(user_ach)
                    data_counts["achievements"] += 1

                # Create mock exam sessions (require /seed/culture called first)
                culture_questions_result = await self.db.execute(select(CultureQuestion).limit(25))
                culture_questions = culture_questions_result.scalars().all()

                if len(culture_questions) >= 25:
                    # Create 2 MockExamSession with MockExamAnswer
                    exam_configs = [
                        {"score": 22, "passed": True, "days_ago": 3},
                        {"score": 18, "passed": False, "days_ago": 1},
                    ]
                    for config in exam_configs:
                        exam_time = now - timedelta(days=config["days_ago"])
                        session = MockExamSession(
                            user_id=user.id,
                            started_at=exam_time,
                            completed_at=exam_time + timedelta(minutes=20),
                            score=config["score"],
                            total_questions=25,
                            passed=config["passed"],
                            time_taken_seconds=1200,
                            status=MockExamStatus.COMPLETED,
                        )
                        self.db.add(session)
                        await self.db.flush()
                        data_counts["mock_exam_sessions"] += 1

                        # Create answers for this session
                        for i, question in enumerate(culture_questions[:25]):
                            is_correct = i < config["score"]
                            answer = MockExamAnswer(
                                session_id=session.id,
                                question_id=question.id,
                                selected_option=1 if is_correct else 2,
                                is_correct=is_correct,
                                time_taken_seconds=48,
                                answered_at=exam_time + timedelta(seconds=48 * (i + 1)),
                            )
                            self.db.add(answer)
                            data_counts["mock_exam_answers"] += 1
                else:
                    user_info["mock_exam_warning"] = (
                        "Insufficient culture questions for mock exams. " "Run /seed/culture first."
                    )

                # Create CultureQuestionStats with CultureAnswerHistory
                if len(culture_questions) >= 10:
                    # Get deck info for the category
                    culture_deck_result = await self.db.execute(select(CultureDeck).limit(1))
                    culture_deck = culture_deck_result.scalar_one_or_none()
                    category = culture_deck.category if culture_deck else "history"

                    for i, question in enumerate(culture_questions[:10]):
                        # 60% mastered, 30% learning, 10% new
                        if i < 6:
                            status = CardStatus.MASTERED
                            ef = 2.8
                            interval = 14
                            reps = 4
                        elif i < 9:
                            status = CardStatus.LEARNING
                            ef = 2.3
                            interval = 2
                            reps = 1
                        else:
                            status = CardStatus.NEW
                            ef = 2.5
                            interval = 0
                            reps = 0

                        culture_stat = CultureQuestionStats(
                            user_id=user.id,
                            question_id=question.id,
                            easiness_factor=ef,
                            interval=interval,
                            repetitions=reps,
                            next_review_date=today + timedelta(days=interval),
                            status=status,
                        )
                        self.db.add(culture_stat)
                        data_counts["culture_stats"] += 1

                        # Create answer history for non-new questions
                        if status != CardStatus.NEW:
                            history = CultureAnswerHistory(
                                user_id=user.id,
                                question_id=question.id,
                                language="en",
                                is_correct=status == CardStatus.MASTERED,
                                selected_option=1 if status == CardStatus.MASTERED else 2,
                                time_taken_seconds=30,
                                deck_category=category,
                            )
                            self.db.add(history)
                            data_counts["culture_history"] += 1

                # Create 5 Notifications
                notification_types = [
                    (
                        NotificationType.ACHIEVEMENT_UNLOCKED,
                        "Achievement Unlocked!",
                        False,
                        "/achievements",
                    ),
                    (
                        NotificationType.DAILY_GOAL_COMPLETE,
                        "Daily Goal Complete!",
                        False,
                        "/",
                    ),
                    (NotificationType.LEVEL_UP, "Level Up!", True, "/achievements"),
                    (
                        NotificationType.STREAK_AT_RISK,
                        "Streak at Risk!",
                        True,
                        "/decks",
                    ),
                    (NotificationType.WELCOME, "Welcome!", True, "/decks"),
                ]
                for notif_type, title, is_read, action_url in notification_types:
                    notification = Notification(
                        user_id=user.id,
                        type=notif_type,
                        title=title,
                        message=f"Test notification: {title}",
                        icon="bell",
                        action_url=action_url,
                        read=is_read,
                        read_at=now if is_read else None,
                    )
                    self.db.add(notification)
                    data_counts["notifications"] += 1

                user_info["has_progress"] = True
            else:
                # For delete user - just create minimal UserXP
                user_xp = UserXP(
                    user_id=user.id,
                    total_xp=0,
                    current_level=1,
                )
                self.db.add(user_xp)
                user_info["has_progress"] = False

            created_users.append(user_info)

        await self.db.flush()

        return {
            "success": True,
            "users_created": len(created_users),
            "users": created_users,
            "data_counts": data_counts,
        }

    # =====================
    # Changelog Seeding
    # =====================

    async def seed_changelog_entries(self) -> dict[str, Any]:
        """Seed 12 changelog entries for E2E testing.

        Creates:
        - 4 New Feature entries
        - 4 Bug Fix entries
        - 4 Announcement entries

        Publication dates spread over past month for realistic pagination testing.
        """
        entries_data = [
            # New Features (4)
            {
                "title_en": "New Vocabulary Card Types",
                "title_ru": "Новые типы карточек словаря",
                "content_en": "We've added **vocabulary** and *culture* card types to help you learn Greek more effectively.",
                "content_ru": "Мы добавили **словарные** и *культурные* карточки для более эффективного изучения греческого.",
                "tag": ChangelogTag.NEW_FEATURE,
                "days_ago": 1,
            },
            {
                "title_en": "Audio Pronunciation Feature",
                "title_ru": "Функция аудио произношения",
                "content_en": "Listen to native Greek pronunciation for all vocabulary cards.",
                "content_ru": "Слушайте произношение от носителей языка для всех карточек словаря.",
                "tag": ChangelogTag.NEW_FEATURE,
                "days_ago": 5,
            },
            {
                "title_en": "Progress Statistics Dashboard",
                "title_ru": "Панель статистики прогресса",
                "content_en": "Track your learning progress with detailed statistics and charts.",
                "content_ru": "Отслеживайте прогресс обучения с помощью подробной статистики и графиков.",
                "tag": ChangelogTag.NEW_FEATURE,
                "days_ago": 10,
            },
            {
                "title_en": "Spaced Repetition Algorithm",
                "title_ru": "Алгоритм интервального повторения",
                "content_en": "Our new spaced repetition system helps you remember words **longer**.",
                "content_ru": "Наша новая система интервального повторения помогает запоминать слова **дольше**.",
                "tag": ChangelogTag.NEW_FEATURE,
                "days_ago": 15,
            },
            # Bug Fixes (4)
            {
                "title_en": "Fixed Card Display Issue",
                "title_ru": "Исправлена проблема отображения карточек",
                "content_en": "Resolved an issue where cards would sometimes display incorrectly on mobile devices.",
                "content_ru": "Решена проблема, при которой карточки иногда отображались некорректно на мобильных устройствах.",
                "tag": ChangelogTag.BUG_FIX,
                "days_ago": 3,
            },
            {
                "title_en": "Login Session Stability",
                "title_ru": "Стабильность сеанса входа",
                "content_en": "Fixed occasional logout issues that some users experienced.",
                "content_ru": "Исправлены периодические проблемы с выходом из системы, которые испытывали некоторые пользователи.",
                "tag": ChangelogTag.BUG_FIX,
                "days_ago": 8,
            },
            {
                "title_en": "Audio Playback Fix",
                "title_ru": "Исправление воспроизведения аудио",
                "content_en": "Audio now plays correctly on *all* supported browsers.",
                "content_ru": "Аудио теперь воспроизводится правильно во *всех* поддерживаемых браузерах.",
                "tag": ChangelogTag.BUG_FIX,
                "days_ago": 12,
            },
            {
                "title_en": "Performance Improvements",
                "title_ru": "Улучшения производительности",
                "content_en": "Reduced loading times by 40% across the application.",
                "content_ru": "Время загрузки сокращено на 40% по всему приложению.",
                "tag": ChangelogTag.BUG_FIX,
                "days_ago": 20,
            },
            # Announcements (4)
            {
                "title_en": "Welcome to Learn Greek Easy!",
                "title_ru": "Добро пожаловать в Learn Greek Easy!",
                "content_en": "Thank you for joining us on your Greek learning journey!",
                "content_ru": "Спасибо, что присоединились к нам в изучении греческого языка!",
                "tag": ChangelogTag.ANNOUNCEMENT,
                "days_ago": 2,
            },
            {
                "title_en": "Maintenance Scheduled",
                "title_ru": "Запланированное обслуживание",
                "content_en": "Brief maintenance window scheduled for this weekend.",
                "content_ru": "Кратковременное техническое обслуживание запланировано на эти выходные.",
                "tag": ChangelogTag.ANNOUNCEMENT,
                "days_ago": 7,
            },
            {
                "title_en": "Community Milestone",
                "title_ru": "Веха сообщества",
                "content_en": "We've reached **1,000** active learners! Thank you for your support.",
                "content_ru": "Мы достигли **1000** активных учеников! Спасибо за вашу поддержку.",
                "tag": ChangelogTag.ANNOUNCEMENT,
                "days_ago": 14,
            },
            {
                "title_en": "Holiday Schedule",
                "title_ru": "Праздничный график",
                "content_en": "Our support team will have limited availability during the holidays.",
                "content_ru": "Наша служба поддержки будет работать в ограниченном режиме во время праздников.",
                "tag": ChangelogTag.ANNOUNCEMENT,
                "days_ago": 25,
            },
        ]

        created = []
        for entry_data in entries_data:
            days_ago: int = entry_data.pop("days_ago")  # type: ignore[assignment]
            entry = ChangelogEntry(
                **entry_data,
                created_at=datetime.now(timezone.utc) - timedelta(days=days_ago),
            )
            self.db.add(entry)
            created.append(entry)

        await self.db.flush()

        return {
            "success": True,
            "entries_created": len(created),
            "by_tag": {
                "new_feature": 4,
                "bug_fix": 4,
                "announcement": 4,
            },
        }

    async def seed_admin_cards(self) -> dict[str, Any]:
        """Seed vocabulary decks and cards for E2E admin testing.

        Creates:
        - 1 vocabulary deck with 10 cards (varying grammar data completeness)
        - 1 empty vocabulary deck for first card creation test

        Cards include:
        - Basic cards (front_text, back_text_en only)
        - Cards with Russian translations
        - Cards with pronunciation
        - Noun cards with partial/full declension data
        - Verb cards with active/passive voice conjugations
        - Adjective cards with declension and comparison
        - Adverb cards with comparison forms
        - Cards with structured examples

        This method is idempotent - it deletes existing E2E test decks
        before creating new ones.

        Returns:
            dict with seeding summary including created decks and cards

        Raises:
            RuntimeError: If seeding not allowed
        """
        self._check_can_seed()

        # Delete existing E2E test decks (idempotent)
        # First delete cards in those decks (FK constraint)
        existing_decks = await self.db.execute(
            select(Deck).where(
                Deck.name_en.in_(
                    [self.ADMIN_CARDS_DECK_NAME_EN, self.ADMIN_CARDS_EMPTY_DECK_NAME_EN]
                )
            )
        )
        for deck in existing_decks.scalars().all():
            await self.db.execute(delete(Card).where(Card.deck_id == deck.id))
        await self.db.execute(
            delete(Deck).where(
                Deck.name_en.in_(
                    [self.ADMIN_CARDS_DECK_NAME_EN, self.ADMIN_CARDS_EMPTY_DECK_NAME_EN]
                )
            )
        )

        # Create main test deck with 10 cards
        main_deck = Deck(
            name_en=self.ADMIN_CARDS_DECK_NAME_EN,
            name_el=self.ADMIN_CARDS_DECK_NAME_EL,
            name_ru=self.ADMIN_CARDS_DECK_NAME_RU,
            description_en="E2E test deck with vocabulary cards of varying completeness",
            description_el="E2E δοκιμαστική τράπουλα με κάρτες λεξιλογίου διαφορετικής πληρότητας",
            description_ru="E2E тестовая колода с карточками словарного запаса разной полноты",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=False,
            card_system=CardSystemVersion.V1,
        )
        self.db.add(main_deck)
        await self.db.flush()

        # Create cards
        created_cards = []
        for i, card_data in enumerate(self.ADMIN_CARDS):
            # Extract grammar data (generate searchable forms if grammar data present)
            noun_data = card_data.get("noun_data")
            verb_data = card_data.get("verb_data")
            adjective_data = card_data.get("adjective_data")
            adverb_data = card_data.get("adverb_data")
            examples = card_data.get("examples")

            # Generate searchable forms from grammar data
            enriched_data: dict[str, Any] = {}
            if noun_data:
                enriched_data["noun_data"] = noun_data
            if verb_data:
                enriched_data["verb_data"] = verb_data
            if adjective_data:
                enriched_data["adjective_data"] = adjective_data
            if adverb_data:
                enriched_data["adverb_data"] = adverb_data

            searchable_forms = extract_searchable_forms(enriched_data, card_data["front_text"])
            searchable_forms_normalized = generate_normalized_forms(searchable_forms)

            card = Card(
                deck_id=main_deck.id,
                front_text=card_data["front_text"],
                back_text_en=card_data["back_text_en"],
                back_text_ru=card_data.get("back_text_ru"),
                pronunciation=card_data.get("pronunciation"),
                part_of_speech=card_data.get("part_of_speech"),
                level=DeckLevel.A1,
                noun_data=noun_data,
                verb_data=verb_data,
                adjective_data=adjective_data,
                adverb_data=adverb_data,
                examples=examples,
                searchable_forms=searchable_forms if searchable_forms else None,
                searchable_forms_normalized=(
                    searchable_forms_normalized if searchable_forms_normalized else None
                ),
            )
            self.db.add(card)
            created_cards.append(
                {
                    "front_text": card_data["front_text"],
                    "back_text_en": card_data["back_text_en"],
                    "has_grammar": bool(noun_data or verb_data or adjective_data or adverb_data),
                    "has_examples": bool(examples),
                }
            )

        await self.db.flush()

        # Create empty test deck for first card creation test
        empty_deck = Deck(
            name_en=self.ADMIN_CARDS_EMPTY_DECK_NAME_EN,
            name_el=self.ADMIN_CARDS_EMPTY_DECK_NAME_EL,
            name_ru=self.ADMIN_CARDS_EMPTY_DECK_NAME_RU,
            description_en="E2E test deck for first card creation testing",
            description_el="E2E δοκιμαστική τράπουλα για δοκιμή δημιουργίας πρώτης κάρτας",
            description_ru="E2E тестовая колода для тестирования создания первой карточки",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=False,
            card_system=CardSystemVersion.V1,
        )
        self.db.add(empty_deck)
        await self.db.flush()

        return {
            "success": True,
            "decks_created": 2,
            "cards_created": len(created_cards),
            "main_deck": {
                "id": str(main_deck.id),
                "name": self.ADMIN_CARDS_DECK_NAME_EN,
                "card_count": len(created_cards),
            },
            "empty_deck": {
                "id": str(empty_deck.id),
                "name": self.ADMIN_CARDS_EMPTY_DECK_NAME_EN,
                "card_count": 0,
            },
            "cards": created_cards,
        }

    # =====================
    # Full Seed Orchestration
    # =====================

    async def seed_all(self) -> dict[str, Any]:  # noqa: C901
        """Execute full database seeding sequence.

        Orchestrates complete seeding:
        1. Truncate all tables (clean slate)
        2. Create test users
        3. Create system decks and cards
        3b. Create user-owned decks (My Decks feature)
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

        # Step 3b: Create user-owned decks (My Decks feature)
        user_decks_result = await self.seed_user_decks(users_result["users"])

        # Step 3c: Create V2 decks with word entries
        v2_decks_result = await self._seed_v2_decks()

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
        notifications_result: dict[str, Any] = {
            "success": True,
            "notifications_created": 0,
        }

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

        # Step 12: Create mock exam history for learner user
        mock_exam_result: dict[str, Any] = {"success": True, "sessions_created": 0}
        if learner_id:
            mock_exam_result = await self.seed_mock_exam_history(user_id=learner_id)

        # Step 13: Create news items for dashboard and admin testing
        news_result = await self.seed_news_items()

        # Step 14: Create news items with linked culture questions
        news_questions_result = await self.seed_news_questions()

        # Step 15: Create announcement campaigns
        announcements_result: dict[str, Any] = {"success": True, "campaigns_created": 0}
        admin_id = next(
            (UUID(u["id"]) for u in users_result["users"] if u["email"] == "e2e_admin@test.com"),
            None,
        )
        if admin_id and learner_id:
            announcements_result = await self.seed_announcement_campaigns(
                admin_id=admin_id,
                learner_id=learner_id,
            )

        # Step 16: Seed changelog entries
        changelog_result = await self.seed_changelog_entries()

        # Commit all changes
        await self.db.commit()

        return {
            "success": True,
            "truncation": truncate_result,
            "users": users_result,
            "content": content_result,
            "user_decks": user_decks_result,
            "v2_decks": v2_decks_result,
            "v1_deck_id": content_result["decks"][0]["id"] if content_result.get("decks") else None,
            "v2_deck_id": (
                v2_decks_result["v2_decks"][0]["id"] if v2_decks_result.get("v2_decks") else None
            ),
            "statistics": stats_result,
            "reviews": reviews_result,
            "notifications": notifications_result,
            "feedback": feedback_result,
            "achievements": achievements_result,
            "xp_users": xp_users_result,
            "culture": culture_result,
            "culture_statistics": culture_stats_result,
            "culture_advanced_stats": advanced_culture_stats,
            "mock_exams": mock_exam_result,
            "news": news_result,
            "news_questions": news_questions_result,
            "announcements": announcements_result,
            "changelog": changelog_result,
        }

    async def _create_word_entries_from_vocab(
        self, deck_id: UUID, vocabulary: list[dict[str, Any]]
    ) -> list[WordEntry]:
        """Create WordEntry objects from a vocabulary list.

        Args:
            deck_id: UUID of the deck to add entries to
            vocabulary: List of word data dicts with keys: lemma, part_of_speech,
                translation_en, translation_ru, pronunciation, cefr_level,
                grammar_data, examples

        Returns:
            List of created WordEntry objects
        """
        entries = []
        for word_data in vocabulary:
            word_entry = WordEntry(
                deck_id=deck_id,
                lemma=word_data["lemma"],
                part_of_speech=word_data["part_of_speech"],
                translation_en=word_data["translation_en"],
                translation_ru=word_data.get("translation_ru"),
                pronunciation=word_data.get("pronunciation"),
                cefr_level=word_data.get("cefr_level"),
                grammar_data=word_data.get("grammar_data"),
                examples=word_data.get("examples"),
                is_active=True,
            )
            self.db.add(word_entry)
            entries.append(word_entry)
        if entries:
            await self.db.flush()
        return entries

    async def _seed_v2_decks(self) -> dict[str, Any]:
        """Create V2 decks with word entries for E2E testing.

        Creates 3 V2 decks:
        - E2E V2 Nouns Deck (A1): 10 nouns with declension grammar_data
        - E2E V2 Verbs Deck (A2): 10 verbs with conjugation grammar_data
        - E2E V2 Mixed Deck (A2): 4 adjectives + 4 adverbs + 2 phrases

        NOTE: Does NOT call self.db.commit() - caller is responsible for committing.

        Returns:
            dict with 'v2_decks' list and 'v2_word_entry_count' total
        """
        # ========== Create V2 Nouns Deck ==========
        v2_nouns_deck = Deck(
            name_en="E2E V2 Nouns Deck (A1)",
            name_el="E2E V2 Nouns Deck (A1)",
            name_ru="E2E V2 Nouns Deck (A1)",
            description_en="Test deck for V2 system with Greek nouns and declension data",
            description_el="Test deck for V2 system with Greek nouns and declension data",
            description_ru="Test deck for V2 system with Greek nouns and declension data",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=False,
            card_system=CardSystemVersion.V2,
        )
        self.db.add(v2_nouns_deck)

        # ========== Create V2 Verbs Deck ==========
        v2_verbs_deck = Deck(
            name_en="E2E V2 Verbs Deck (A2)",
            name_el="E2E V2 Verbs Deck (A2)",
            name_ru="E2E V2 Verbs Deck (A2)",
            description_en="Test deck for V2 system with Greek verbs and conjugation data",
            description_el="Test deck for V2 system with Greek verbs and conjugation data",
            description_ru="Test deck for V2 system with Greek verbs and conjugation data",
            level=DeckLevel.A2,
            is_active=True,
            is_premium=False,
            card_system=CardSystemVersion.V2,
        )
        self.db.add(v2_verbs_deck)

        # ========== Create V2 Mixed Deck ==========
        v2_mixed_deck = Deck(
            name_en="E2E V2 Mixed Deck (A2)",
            name_el="E2E V2 Mixed Deck (A2)",
            name_ru="E2E V2 Mixed Deck (A2)",
            description_en="Test deck for V2 system with adjectives, adverbs, and phrases",
            description_el="Test deck for V2 system with adjectives, adverbs, and phrases",
            description_ru="Test deck for V2 system with adjectives, adverbs, and phrases",
            level=DeckLevel.A2,
            is_active=True,
            is_premium=False,
            card_system=CardSystemVersion.V2,
        )
        self.db.add(v2_mixed_deck)
        await self.db.flush()

        # V2 Nouns vocabulary (10 A1 nouns: 4 neuter, 4 masculine, 2 feminine)
        v2_nouns_vocabulary: list[dict[str, Any]] = [
            # ---- Neuter nouns (4) ----
            {
                "lemma": "σπίτι",
                "part_of_speech": PartOfSpeech.NOUN,
                "translation_en": "house, home",
                "translation_ru": "дом",
                "pronunciation": "/spí·ti/",
                "cefr_level": DeckLevel.A1,
                "grammar_data": {
                    "gender": "neuter",
                    "declension_group": "neuter_i",
                    "cases": {
                        "singular": {
                            "nominative": "το σπίτι",
                            "genitive": "του σπιτιού",
                            "accusative": "το σπίτι",
                        },
                        "plural": {
                            "nominative": "τα σπίτια",
                            "genitive": "των σπιτιών",
                            "accusative": "τα σπίτια",
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Το σπίτι μου είναι μεγάλο.",
                        "english": "My house is big.",
                        "russian": "Мой дом большой.",
                    },
                ],
            },
            {
                "lemma": "νερό",
                "part_of_speech": PartOfSpeech.NOUN,
                "translation_en": "water",
                "translation_ru": "вода",
                "pronunciation": "/ne·ró/",
                "cefr_level": DeckLevel.A1,
                "grammar_data": {
                    "gender": "neuter",
                    "declension_group": "neuter_o",
                    "cases": {
                        "singular": {
                            "nominative": "το νερό",
                            "genitive": "του νερού",
                            "accusative": "το νερό",
                        },
                        "plural": {
                            "nominative": "τα νερά",
                            "genitive": "των νερών",
                            "accusative": "τα νερά",
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Πίνω νερό.",
                        "english": "I drink water.",
                        "russian": "Я пью воду.",
                    },
                ],
            },
            {
                "lemma": "βιβλίο",
                "part_of_speech": PartOfSpeech.NOUN,
                "translation_en": "book",
                "translation_ru": "книга",
                "pronunciation": "/vi·vlí·o/",
                "cefr_level": DeckLevel.A1,
                "grammar_data": {
                    "gender": "neuter",
                    "declension_group": "neuter_o",
                    "cases": {
                        "singular": {
                            "nominative": "το βιβλίο",
                            "genitive": "του βιβλίου",
                            "accusative": "το βιβλίο",
                        },
                        "plural": {
                            "nominative": "τα βιβλία",
                            "genitive": "των βιβλίων",
                            "accusative": "τα βιβλία",
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Διαβάζω ένα βιβλίο.",
                        "english": "I am reading a book.",
                        "russian": "Я читаю книгу.",
                    },
                ],
            },
            {
                "lemma": "παιδί",
                "part_of_speech": PartOfSpeech.NOUN,
                "translation_en": "child",
                "translation_ru": "ребёнок",
                "pronunciation": "/pe·dhí/",
                "cefr_level": DeckLevel.A1,
                "grammar_data": {
                    "gender": "neuter",
                    "declension_group": "neuter_i",
                    "cases": {
                        "singular": {
                            "nominative": "το παιδί",
                            "genitive": "του παιδιού",
                            "accusative": "το παιδί",
                        },
                        "plural": {
                            "nominative": "τα παιδιά",
                            "genitive": "των παιδιών",
                            "accusative": "τα παιδιά",
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Το παιδί παίζει στο πάρκο.",
                        "english": "The child plays in the park.",
                        "russian": "Ребёнок играет в парке.",
                    },
                ],
            },
            # ---- Masculine nouns (4) ----
            {
                "lemma": "σκύλος",
                "part_of_speech": PartOfSpeech.NOUN,
                "translation_en": "dog",
                "translation_ru": "собака",
                "pronunciation": "/skí·los/",
                "cefr_level": DeckLevel.A1,
                "grammar_data": {
                    "gender": "masculine",
                    "declension_group": "masculine_os",
                    "cases": {
                        "singular": {
                            "nominative": "ο σκύλος",
                            "genitive": "του σκύλου",
                            "accusative": "τον σκύλο",
                        },
                        "plural": {
                            "nominative": "οι σκύλοι",
                            "genitive": "των σκύλων",
                            "accusative": "τους σκύλους",
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Ο σκύλος τρέχει στον κήπο.",
                        "english": "The dog runs in the garden.",
                        "russian": "Собака бегает в саду.",
                    },
                ],
            },
            {
                "lemma": "δάσκαλος",
                "part_of_speech": PartOfSpeech.NOUN,
                "translation_en": "teacher (male)",
                "translation_ru": "учитель",
                "pronunciation": "/dhá·ska·los/",
                "cefr_level": DeckLevel.A1,
                "grammar_data": {
                    "gender": "masculine",
                    "declension_group": "masculine_os",
                    "cases": {
                        "singular": {
                            "nominative": "ο δάσκαλος",
                            "genitive": "του δασκάλου",
                            "accusative": "τον δάσκαλο",
                        },
                        "plural": {
                            "nominative": "οι δάσκαλοι",
                            "genitive": "των δασκάλων",
                            "accusative": "τους δασκάλους",
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Ο δάσκαλος διδάσκει ελληνικά.",
                        "english": "The teacher teaches Greek.",
                        "russian": "Учитель преподает греческий.",
                    },
                ],
            },
            {
                "lemma": "δρόμος",
                "part_of_speech": PartOfSpeech.NOUN,
                "translation_en": "road, street",
                "translation_ru": "дорога, улица",
                "pronunciation": "/dhró·mos/",
                "cefr_level": DeckLevel.A1,
                "grammar_data": {
                    "gender": "masculine",
                    "declension_group": "masculine_os",
                    "cases": {
                        "singular": {
                            "nominative": "ο δρόμος",
                            "genitive": "του δρόμου",
                            "accusative": "τον δρόμο",
                        },
                        "plural": {
                            "nominative": "οι δρόμοι",
                            "genitive": "των δρόμων",
                            "accusative": "τους δρόμους",
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Ο δρόμος είναι μεγάλος.",
                        "english": "The road is long.",
                        "russian": "Дорога длинная.",
                    },
                ],
            },
            {
                "lemma": "φίλος",
                "part_of_speech": PartOfSpeech.NOUN,
                "translation_en": "friend (male)",
                "translation_ru": "друг",
                "pronunciation": "/fí·los/",
                "cefr_level": DeckLevel.A1,
                "grammar_data": {
                    "gender": "masculine",
                    "declension_group": "masculine_os",
                    "cases": {
                        "singular": {
                            "nominative": "ο φίλος",
                            "genitive": "του φίλου",
                            "accusative": "τον φίλο",
                        },
                        "plural": {
                            "nominative": "οι φίλοι",
                            "genitive": "των φίλων",
                            "accusative": "τους φίλους",
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Ο φίλος μου είναι Έλληνας.",
                        "english": "My friend is Greek.",
                        "russian": "Мой друг — грек.",
                    },
                ],
            },
            # ---- Feminine nouns (2) ----
            {
                "lemma": "γάτα",
                "part_of_speech": PartOfSpeech.NOUN,
                "translation_en": "cat",
                "translation_ru": "кошка",
                "pronunciation": "/ghá·ta/",
                "cefr_level": DeckLevel.A1,
                "grammar_data": {
                    "gender": "feminine",
                    "declension_group": "feminine_a",
                    "cases": {
                        "singular": {
                            "nominative": "η γάτα",
                            "genitive": "της γάτας",
                            "accusative": "τη γάτα",
                        },
                        "plural": {
                            "nominative": "οι γάτες",
                            "genitive": "των γατών",
                            "accusative": "τις γάτες",
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Η γάτα κοιμάται στον καναπέ.",
                        "english": "The cat sleeps on the couch.",
                        "russian": "Кошка спит на диване.",
                    },
                ],
            },
            {
                "lemma": "γυναίκα",
                "part_of_speech": PartOfSpeech.NOUN,
                "translation_en": "woman, wife",
                "translation_ru": "женщина, жена",
                "pronunciation": "/yi·né·ka/",
                "cefr_level": DeckLevel.A1,
                "grammar_data": {
                    "gender": "feminine",
                    "declension_group": "feminine_a",
                    "cases": {
                        "singular": {
                            "nominative": "η γυναίκα",
                            "genitive": "της γυναίκας",
                            "accusative": "τη γυναίκα",
                        },
                        "plural": {
                            "nominative": "οι γυναίκες",
                            "genitive": "των γυναικών",
                            "accusative": "τις γυναίκες",
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Η γυναίκα μιλάει ελληνικά.",
                        "english": "The woman speaks Greek.",
                        "russian": "Женщина говорит по-гречески.",
                    },
                ],
            },
        ]
        v2_nouns_entries = await self._create_word_entries_from_vocab(
            v2_nouns_deck.id, v2_nouns_vocabulary
        )
        # V2 Verbs vocabulary (10 A2 verbs: 6 Group A, 4 Group B)
        v2_verbs_vocabulary: list[dict[str, Any]] = [
            # ---- Group A verbs (6) - regular -ω conjugation ----
            {
                "lemma": "πίνω",
                "part_of_speech": PartOfSpeech.VERB,
                "translation_en": "to drink",
                "translation_ru": "пить",
                "pronunciation": "/pí·no/",
                "cefr_level": DeckLevel.A2,
                "grammar_data": {
                    "voice": "active",
                    "conjugation_group": "A",
                    "tenses": {
                        "present": {
                            "εγώ": "πίνω",
                            "εσύ": "πίνεις",
                            "αυτός/αυτή/αυτό": "πίνει",
                            "εμείς": "πίνουμε",
                            "εσείς": "πίνετε",
                            "αυτοί/αυτές/αυτά": "πίνουν(ε)",
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Πίνω καφέ κάθε πρωί.",
                        "english": "I drink coffee every morning.",
                        "russian": "Я пью кофе каждое утро.",
                    },
                ],
            },
            {
                "lemma": "γράφω",
                "part_of_speech": PartOfSpeech.VERB,
                "translation_en": "to write",
                "translation_ru": "писать",
                "pronunciation": "/ghrá·fo/",
                "cefr_level": DeckLevel.A2,
                "grammar_data": {
                    "voice": "active",
                    "conjugation_group": "A",
                    "tenses": {
                        "present": {
                            "εγώ": "γράφω",
                            "εσύ": "γράφεις",
                            "αυτός/αυτή/αυτό": "γράφει",
                            "εμείς": "γράφουμε",
                            "εσείς": "γράφετε",
                            "αυτοί/αυτές/αυτά": "γράφουν(ε)",
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Γράφω ένα γράμμα στον φίλο μου.",
                        "english": "I write a letter to my friend.",
                        "russian": "Я пишу письмо своему другу.",
                    },
                ],
            },
            {
                "lemma": "διαβάζω",
                "part_of_speech": PartOfSpeech.VERB,
                "translation_en": "to read, to study",
                "translation_ru": "читать, учить",
                "pronunciation": "/dhi·a·vá·zo/",
                "cefr_level": DeckLevel.A2,
                "grammar_data": {
                    "voice": "active",
                    "conjugation_group": "A",
                    "tenses": {
                        "present": {
                            "εγώ": "διαβάζω",
                            "εσύ": "διαβάζεις",
                            "αυτός/αυτή/αυτό": "διαβάζει",
                            "εμείς": "διαβάζουμε",
                            "εσείς": "διαβάζετε",
                            "αυτοί/αυτές/αυτά": "διαβάζουν(ε)",
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Διαβάζω ένα βιβλίο κάθε βράδυ.",
                        "english": "I read a book every evening.",
                        "russian": "Я читаю книгу каждый вечер.",
                    },
                ],
            },
            {
                "lemma": "δουλεύω",
                "part_of_speech": PartOfSpeech.VERB,
                "translation_en": "to work",
                "translation_ru": "работать",
                "pronunciation": "/dhu·lé·vo/",
                "cefr_level": DeckLevel.A2,
                "grammar_data": {
                    "voice": "active",
                    "conjugation_group": "A",
                    "tenses": {
                        "present": {
                            "εγώ": "δουλεύω",
                            "εσύ": "δουλεύεις",
                            "αυτός/αυτή/αυτό": "δουλεύει",
                            "εμείς": "δουλεύουμε",
                            "εσείς": "δουλεύετε",
                            "αυτοί/αυτές/αυτά": "δουλεύουν(ε)",
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Δουλεύω σε ένα γραφείο.",
                        "english": "I work in an office.",
                        "russian": "Я работаю в офисе.",
                    },
                ],
            },
            {
                "lemma": "μαθαίνω",
                "part_of_speech": PartOfSpeech.VERB,
                "translation_en": "to learn",
                "translation_ru": "учиться, изучать",
                "pronunciation": "/ma·thé·no/",
                "cefr_level": DeckLevel.A2,
                "grammar_data": {
                    "voice": "active",
                    "conjugation_group": "A",
                    "tenses": {
                        "present": {
                            "εγώ": "μαθαίνω",
                            "εσύ": "μαθαίνεις",
                            "αυτός/αυτή/αυτό": "μαθαίνει",
                            "εμείς": "μαθαίνουμε",
                            "εσείς": "μαθαίνετε",
                            "αυτοί/αυτές/αυτά": "μαθαίνουν(ε)",
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Μαθαίνω ελληνικά εδώ και δύο χρόνια.",
                        "english": "I have been learning Greek for two years.",
                        "russian": "Я учу греческий уже два года.",
                    },
                ],
            },
            {
                "lemma": "ακούω",
                "part_of_speech": PartOfSpeech.VERB,
                "translation_en": "to hear, to listen",
                "translation_ru": "слушать, слышать",
                "pronunciation": "/a·kú·o/",
                "cefr_level": DeckLevel.A2,
                "grammar_data": {
                    "voice": "active",
                    "conjugation_group": "A",
                    "tenses": {
                        "present": {
                            "εγώ": "ακούω",
                            "εσύ": "ακούς",
                            "αυτός/αυτή/αυτό": "ακούει",
                            "εμείς": "ακούμε",
                            "εσείς": "ακούτε",
                            "αυτοί/αυτές/αυτά": "ακούν(ε)",
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Ακούω μουσική κάθε μέρα.",
                        "english": "I listen to music every day.",
                        "russian": "Я слушаю музыку каждый день.",
                    },
                ],
            },
            # ---- Group B verbs (4) - contracted -ώ/-άω conjugation ----
            {
                "lemma": "αγαπώ",
                "part_of_speech": PartOfSpeech.VERB,
                "translation_en": "to love",
                "translation_ru": "любить",
                "pronunciation": "/a·gha·pó/",
                "cefr_level": DeckLevel.A2,
                "grammar_data": {
                    "voice": "active",
                    "conjugation_group": "B",
                    "tenses": {
                        "present": {
                            "εγώ": "αγαπώ / αγαπάω",
                            "εσύ": "αγαπάς",
                            "αυτός/αυτή/αυτό": "αγαπά / αγαπάει",
                            "εμείς": "αγαπάμε / αγαπούμε",
                            "εσείς": "αγαπάτε",
                            "αυτοί/αυτές/αυτά": "αγαπούν(ε) / αγαπάν(ε)",
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Αγαπώ την οικογένειά μου.",
                        "english": "I love my family.",
                        "russian": "Я люблю свою семью.",
                    },
                ],
            },
            {
                "lemma": "θέλω",
                "part_of_speech": PartOfSpeech.VERB,
                "translation_en": "to want",
                "translation_ru": "хотеть",
                "pronunciation": "/thé·lo/",
                "cefr_level": DeckLevel.A2,
                "grammar_data": {
                    "voice": "active",
                    "conjugation_group": "B",
                    "tenses": {
                        "present": {
                            "εγώ": "θέλω",
                            "εσύ": "θέλεις / θες",
                            "αυτός/αυτή/αυτό": "θέλει",
                            "εμείς": "θέλουμε",
                            "εσείς": "θέλετε",
                            "αυτοί/αυτές/αυτά": "θέλουν(ε)",
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Θέλω ένα ποτήρι νερό.",
                        "english": "I want a glass of water.",
                        "russian": "Я хочу стакан воды.",
                    },
                ],
            },
            {
                "lemma": "μιλώ",
                "part_of_speech": PartOfSpeech.VERB,
                "translation_en": "to speak, to talk",
                "translation_ru": "говорить, разговаривать",
                "pronunciation": "/mi·ló/",
                "cefr_level": DeckLevel.A2,
                "grammar_data": {
                    "voice": "active",
                    "conjugation_group": "B",
                    "tenses": {
                        "present": {
                            "εγώ": "μιλώ / μιλάω",
                            "εσύ": "μιλάς",
                            "αυτός/αυτή/αυτό": "μιλά / μιλάει",
                            "εμείς": "μιλάμε / μιλούμε",
                            "εσείς": "μιλάτε",
                            "αυτοί/αυτές/αυτά": "μιλούν(ε) / μιλάν(ε)",
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Μιλάς ελληνικά πολύ καλά!",
                        "english": "You speak Greek very well!",
                        "russian": "Ты очень хорошо говоришь по-гречески!",
                    },
                ],
            },
            {
                "lemma": "τρώω",
                "part_of_speech": PartOfSpeech.VERB,
                "translation_en": "to eat",
                "translation_ru": "есть, кушать",
                "pronunciation": "/tró·o/",
                "cefr_level": DeckLevel.A2,
                "grammar_data": {
                    "voice": "active",
                    "conjugation_group": "B",
                    "tenses": {
                        "present": {
                            "εγώ": "τρώω",
                            "εσύ": "τρως",
                            "αυτός/αυτή/αυτό": "τρώει",
                            "εμείς": "τρώμε",
                            "εσείς": "τρώτε",
                            "αυτοί/αυτές/αυτά": "τρών(ε)",
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Τρώω σουβλάκι κάθε Παρασκευή.",
                        "english": "I eat souvlaki every Friday.",
                        "russian": "Я ем сувлаки каждую пятницу.",
                    },
                ],
            },
        ]
        v2_verbs_entries = await self._create_word_entries_from_vocab(
            v2_verbs_deck.id, v2_verbs_vocabulary
        )
        # V2 Mixed vocabulary (10 A2 items: 4 adjectives, 4 adverbs, 2 phrases)
        v2_mixed_vocabulary: list[dict[str, Any]] = [
            # ---- Adjectives (4) ----
            {
                "lemma": "καλός",
                "part_of_speech": PartOfSpeech.ADJECTIVE,
                "translation_en": "good, nice",
                "translation_ru": "хороший",
                "pronunciation": "/ka·lós/",
                "cefr_level": DeckLevel.A2,
                "grammar_data": {
                    "declension_group": "os_i_o",
                    "forms": {
                        "masculine": {
                            "singular": {
                                "nominative": "καλός",
                                "genitive": "καλού",
                                "accusative": "καλό",
                            },
                            "plural": {
                                "nominative": "καλοί",
                                "genitive": "καλών",
                                "accusative": "καλούς",
                            },
                        },
                        "feminine": {
                            "singular": {
                                "nominative": "καλή",
                                "genitive": "καλής",
                                "accusative": "καλή",
                            },
                            "plural": {
                                "nominative": "καλές",
                                "genitive": "καλών",
                                "accusative": "καλές",
                            },
                        },
                        "neuter": {
                            "singular": {
                                "nominative": "καλό",
                                "genitive": "καλού",
                                "accusative": "καλό",
                            },
                            "plural": {
                                "nominative": "καλά",
                                "genitive": "καλών",
                                "accusative": "καλά",
                            },
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Είναι πολύ καλός δάσκαλος.",
                        "english": "He is a very good teacher.",
                        "russian": "Он очень хороший учитель.",
                    },
                ],
            },
            {
                "lemma": "μεγάλος",
                "part_of_speech": PartOfSpeech.ADJECTIVE,
                "translation_en": "big, large, great",
                "translation_ru": "большой, великий",
                "pronunciation": "/me·ghá·los/",
                "cefr_level": DeckLevel.A2,
                "grammar_data": {
                    "declension_group": "os_i_o",
                    "forms": {
                        "masculine": {
                            "singular": {
                                "nominative": "μεγάλος",
                                "genitive": "μεγάλου",
                                "accusative": "μεγάλο",
                            },
                            "plural": {
                                "nominative": "μεγάλοι",
                                "genitive": "μεγάλων",
                                "accusative": "μεγάλους",
                            },
                        },
                        "feminine": {
                            "singular": {
                                "nominative": "μεγάλη",
                                "genitive": "μεγάλης",
                                "accusative": "μεγάλη",
                            },
                            "plural": {
                                "nominative": "μεγάλες",
                                "genitive": "μεγάλων",
                                "accusative": "μεγάλες",
                            },
                        },
                        "neuter": {
                            "singular": {
                                "nominative": "μεγάλο",
                                "genitive": "μεγάλου",
                                "accusative": "μεγάλο",
                            },
                            "plural": {
                                "nominative": "μεγάλα",
                                "genitive": "μεγάλων",
                                "accusative": "μεγάλα",
                            },
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Το σπίτι είναι πολύ μεγάλο.",
                        "english": "The house is very big.",
                        "russian": "Дом очень большой.",
                    },
                ],
            },
            {
                "lemma": "μικρός",
                "part_of_speech": PartOfSpeech.ADJECTIVE,
                "translation_en": "small, little",
                "translation_ru": "маленький",
                "pronunciation": "/mi·krós/",
                "cefr_level": DeckLevel.A2,
                "grammar_data": {
                    "declension_group": "os_i_o",
                    "forms": {
                        "masculine": {
                            "singular": {
                                "nominative": "μικρός",
                                "genitive": "μικρού",
                                "accusative": "μικρό",
                            },
                            "plural": {
                                "nominative": "μικροί",
                                "genitive": "μικρών",
                                "accusative": "μικρούς",
                            },
                        },
                        "feminine": {
                            "singular": {
                                "nominative": "μικρή",
                                "genitive": "μικρής",
                                "accusative": "μικρή",
                            },
                            "plural": {
                                "nominative": "μικρές",
                                "genitive": "μικρών",
                                "accusative": "μικρές",
                            },
                        },
                        "neuter": {
                            "singular": {
                                "nominative": "μικρό",
                                "genitive": "μικρού",
                                "accusative": "μικρό",
                            },
                            "plural": {
                                "nominative": "μικρά",
                                "genitive": "μικρών",
                                "accusative": "μικρά",
                            },
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Η γάτα είναι μικρή.",
                        "english": "The cat is small.",
                        "russian": "Кошка маленькая.",
                    },
                ],
            },
            {
                "lemma": "νέος",
                "part_of_speech": PartOfSpeech.ADJECTIVE,
                "translation_en": "young, new",
                "translation_ru": "молодой, новый",
                "pronunciation": "/né·os/",
                "cefr_level": DeckLevel.A2,
                "grammar_data": {
                    "declension_group": "os_a_o",
                    "forms": {
                        "masculine": {
                            "singular": {
                                "nominative": "νέος",
                                "genitive": "νέου",
                                "accusative": "νέο",
                            },
                            "plural": {
                                "nominative": "νέοι",
                                "genitive": "νέων",
                                "accusative": "νέους",
                            },
                        },
                        "feminine": {
                            "singular": {
                                "nominative": "νέα",
                                "genitive": "νέας",
                                "accusative": "νέα",
                            },
                            "plural": {
                                "nominative": "νέες",
                                "genitive": "νέων",
                                "accusative": "νέες",
                            },
                        },
                        "neuter": {
                            "singular": {
                                "nominative": "νέο",
                                "genitive": "νέου",
                                "accusative": "νέο",
                            },
                            "plural": {
                                "nominative": "νέα",
                                "genitive": "νέων",
                                "accusative": "νέα",
                            },
                        },
                    },
                },
                "examples": [
                    {
                        "greek": "Ο νέος μαθητής είναι από την Αθήνα.",
                        "english": "The new student is from Athens.",
                        "russian": "Новый ученик из Афин.",
                    },
                ],
            },
            # ---- Adverbs (4) ----
            {
                "lemma": "σήμερα",
                "part_of_speech": PartOfSpeech.ADVERB,
                "translation_en": "today",
                "translation_ru": "сегодня",
                "pronunciation": "/sí·me·ra/",
                "cefr_level": DeckLevel.A2,
                "grammar_data": {"category": "time"},
                "examples": [
                    {
                        "greek": "Σήμερα έχει ωραίο καιρό.",
                        "english": "Today the weather is nice.",
                        "russian": "Сегодня хорошая погода.",
                    },
                ],
            },
            {
                "lemma": "αύριο",
                "part_of_speech": PartOfSpeech.ADVERB,
                "translation_en": "tomorrow",
                "translation_ru": "завтра",
                "pronunciation": "/áv·ri·o/",
                "cefr_level": DeckLevel.A2,
                "grammar_data": {"category": "time"},
                "examples": [
                    {
                        "greek": "Αύριο θα πάω στη δουλειά.",
                        "english": "Tomorrow I will go to work.",
                        "russian": "Завтра я пойду на работу.",
                    },
                ],
            },
            {
                "lemma": "εδώ",
                "part_of_speech": PartOfSpeech.ADVERB,
                "translation_en": "here",
                "translation_ru": "здесь, тут",
                "pronunciation": "/e·dhó/",
                "cefr_level": DeckLevel.A2,
                "grammar_data": {"category": "place"},
                "examples": [
                    {
                        "greek": "Έλα εδώ, σε παρακαλώ.",
                        "english": "Come here, please.",
                        "russian": "Иди сюда, пожалуйста.",
                    },
                ],
            },
            {
                "lemma": "πολύ",
                "part_of_speech": PartOfSpeech.ADVERB,
                "translation_en": "very, much, a lot",
                "translation_ru": "очень, много",
                "pronunciation": "/po·lí/",
                "cefr_level": DeckLevel.A2,
                "grammar_data": {"category": "degree"},
                "examples": [
                    {
                        "greek": "Μου αρέσει πολύ η Ελλάδα.",
                        "english": "I like Greece a lot.",
                        "russian": "Мне очень нравится Греция.",
                    },
                ],
            },
            # ---- Phrases (2) ----
            {
                "lemma": "καλημέρα",
                "part_of_speech": PartOfSpeech.PHRASE,
                "translation_en": "good morning",
                "translation_ru": "доброе утро",
                "pronunciation": "/ka·li·mé·ra/",
                "cefr_level": DeckLevel.A2,
                "grammar_data": {"category": "greeting", "formality": "neutral"},
                "examples": [
                    {
                        "greek": "Καλημέρα! Τι κάνεις;",
                        "english": "Good morning! How are you?",
                        "russian": "Доброе утро! Как дела?",
                    },
                ],
            },
            {
                "lemma": "ευχαριστώ",
                "part_of_speech": PartOfSpeech.PHRASE,
                "translation_en": "thank you",
                "translation_ru": "спасибо",
                "pronunciation": "/ef·cha·ri·stó/",
                "cefr_level": DeckLevel.A2,
                "grammar_data": {"category": "politeness", "formality": "neutral"},
                "examples": [
                    {
                        "greek": "Ευχαριστώ πολύ για τη βοήθεια!",
                        "english": "Thank you very much for the help!",
                        "russian": "Большое спасибо за помощь!",
                    },
                ],
            },
        ]
        v2_mixed_entries = await self._create_word_entries_from_vocab(
            v2_mixed_deck.id, v2_mixed_vocabulary
        )

        await self.db.flush()

        return {
            "success": True,
            "v2_decks": [
                {
                    "id": str(v2_nouns_deck.id),
                    "name": v2_nouns_deck.name_en,
                    "level": v2_nouns_deck.level.value,
                    "word_entry_count": len(v2_nouns_entries),
                },
                {
                    "id": str(v2_verbs_deck.id),
                    "name": v2_verbs_deck.name_en,
                    "level": v2_verbs_deck.level.value,
                    "word_entry_count": len(v2_verbs_entries),
                },
                {
                    "id": str(v2_mixed_deck.id),
                    "name": v2_mixed_deck.name_en,
                    "level": v2_mixed_deck.level.value,
                    "word_entry_count": len(v2_mixed_entries),
                },
            ],
            "v2_word_entry_count": len(v2_nouns_entries)
            + len(v2_verbs_entries)
            + len(v2_mixed_entries),
        }

    async def seed_dual_decks(self) -> dict[str, Any]:
        """Seed V1 and V2 decks for E2E testing of dual card system.

        Creates:
        - 1 V1 deck with 10 traditional cards (SM-2 states)
        - 3 V2 decks:
          - E2E V2 Nouns Deck (A1): noun word entries with declension data
          - E2E V2 Verbs Deck (A2): verb word entries with conjugation data
          - E2E V2 Mixed Deck (A2): adjective, adverb, and phrase entries

        This endpoint is idempotent - it deletes existing E2E dual test decks first.

        Returns:
            dict with v1_deck_id, v2_deck_id (backwards-compat), v2_decks array, and counts
        """
        # Delete ALL existing E2E dual test decks (idempotent)
        # Use delete with where clause to handle multiple duplicates if they exist
        await self.db.execute(delete(Deck).where(Deck.name_en == "E2E V1 Test Deck"))
        await self.db.execute(delete(Deck).where(Deck.name_en == "E2E V2 Test Deck"))
        await self.db.execute(delete(Deck).where(Deck.name_en == "E2E V2 Nouns Deck (A1)"))
        await self.db.execute(delete(Deck).where(Deck.name_en == "E2E V2 Verbs Deck (A2)"))
        await self.db.execute(delete(Deck).where(Deck.name_en == "E2E V2 Mixed Deck (A2)"))

        await self.db.flush()

        # ========== Create V1 Deck (Traditional Cards) ==========
        v1_deck = Deck(
            name_en="E2E V1 Test Deck",
            name_el="E2E V1 Test Deck",
            name_ru="E2E V1 Test Deck",
            description_en="Test deck for V1 (legacy flashcard) system",
            description_el="Test deck for V1 (legacy flashcard) system",
            description_ru="Test deck for V1 (legacy flashcard) system",
            level=DeckLevel.A1,
            is_active=True,
            is_premium=False,
            card_system=CardSystemVersion.V1,
        )
        self.db.add(v1_deck)
        await self.db.flush()

        # Create 10 traditional cards for V1 deck
        v1_vocabulary = [
            ("γεια", "hello", "greeting"),
            ("ναι", "yes", "affirmative"),
            ("όχι", "no", "negative"),
            ("ευχαριστώ", "thank you", "gratitude"),
            ("παρακαλώ", "please", "politeness"),
            ("νερό", "water", "noun"),
            ("ψωμί", "bread", "noun"),
            ("σπίτι", "house", "noun"),
            ("καλημέρα", "good morning", "greeting"),
            ("καληνύχτα", "good night", "greeting"),
        ]

        v1_cards = []
        for greek, english, category in v1_vocabulary:
            card = Card(
                deck_id=v1_deck.id,
                front_text=greek,
                back_text_en=english,
                back_text_ru=None,
                pronunciation=None,
                part_of_speech=PartOfSpeech.NOUN if category == "noun" else None,
            )
            self.db.add(card)
            v1_cards.append(card)
        await self.db.flush()

        # ========== Create V2 Decks (delegated to reusable method) ==========
        v2_result = await self._seed_v2_decks()

        await self.db.commit()

        return {
            "success": True,
            "v1_deck_id": str(v1_deck.id),
            "v1_deck_name": v1_deck.name_en,
            # Backwards-compatible: first V2 deck ID for existing E2E tests
            "v2_deck_id": v2_result["v2_decks"][0]["id"] if v2_result.get("v2_decks") else None,
            "v2_decks": v2_result.get("v2_decks", []),
            "v1_card_count": len(v1_cards),
            "v2_word_entry_count": v2_result.get("v2_word_entry_count", 0),
        }
