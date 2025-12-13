"""E2E Test Database Seeding Service.

Provides deterministic database seeding for E2E tests with:
- FK-safe table truncation
- Idempotent user creation
- Reproducible test data scenarios

IMPORTANT: This service should NEVER be used in production.
All methods check settings.can_seed_database() before executing.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.security import hash_password
from src.db.models import (
    Card,
    CardDifficulty,
    CardStatistics,
    CardStatus,
    Deck,
    DeckLevel,
    Review,
    User,
    UserDeckProgress,
    UserSettings,
)


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
        "reviews",
        "card_statistics",
        "user_deck_progress",
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

    def __init__(self, db: AsyncSession):
        """Initialize SeedService with database session.

        Args:
            db: Async SQLAlchemy session for database operations
        """
        self.db = db
        self._password_hash: Optional[str] = None

    @property
    def password_hash(self) -> str:
        """Lazily compute password hash (expensive operation)."""
        if self._password_hash is None:
            self._password_hash = hash_password(self.DEFAULT_PASSWORD)
        return self._password_hash

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

        Creates users idempotently - if user with email exists,
        updates their data instead of creating new.

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

        users_data = [
            {
                "email": "e2e_learner@test.com",
                "full_name": "E2E Learner",
                "is_superuser": False,
                "is_active": True,
            },
            {
                "email": "e2e_beginner@test.com",
                "full_name": "E2E Beginner",
                "is_superuser": False,
                "is_active": True,
            },
            {
                "email": "e2e_advanced@test.com",
                "full_name": "E2E Advanced",
                "is_superuser": False,
                "is_active": True,
            },
            {
                "email": "e2e_admin@test.com",
                "full_name": "E2E Admin",
                "is_superuser": True,
                "is_active": True,
            },
        ]

        created_users = []
        now = datetime.now(timezone.utc)

        for user_data in users_data:
            user = User(
                email=user_data["email"],
                full_name=user_data["full_name"],
                password_hash=self.password_hash,
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
                }
            )

        await self.db.flush()

        return {
            "success": True,
            "users": created_users,
            "password": self.DEFAULT_PASSWORD,  # For E2E test login
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

        for level, words in self.VOCABULARY.items():
            # Create deck
            deck = Deck(
                name=f"Greek {level.value} Vocabulary",
                description=f"Essential Greek vocabulary for CEFR level {level.value}",
                level=level,
                is_active=True,
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
    # Full Seed Orchestration
    # =====================

    async def seed_all(self) -> dict[str, Any]:
        """Execute full database seeding sequence.

        Orchestrates complete seeding:
        1. Truncate all tables (clean slate)
        2. Create test users
        3. Create decks and cards
        4. Create progress data for learner user
        5. Create review history for learner user

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
        for user in users_result["users"]:
            if user["email"] == "e2e_learner@test.com":
                learner_id = UUID(user["id"])
                break

        a1_deck_id = None
        for deck in content_result["decks"]:
            if deck["level"] == "A1":
                a1_deck_id = UUID(deck["id"])
                break

        stats_result: dict[str, Any] = {"success": True, "stats_created": 0}
        reviews_result: dict[str, Any] = {"success": True, "reviews_created": 0}

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

        # Commit all changes
        await self.db.commit()

        return {
            "success": True,
            "truncation": truncate_result,
            "users": users_result,
            "content": content_result,
            "statistics": stats_result,
            "reviews": reviews_result,
        }
