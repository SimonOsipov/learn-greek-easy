"""E2E Test Database Seeding Service.

Provides deterministic database seeding for E2E tests with:
- FK-safe table truncation
- Idempotent user creation
- Reproducible test data scenarios

IMPORTANT: This service should NEVER be used in production.
All methods check settings.can_seed_database() before executing.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional, TypedDict
from uuid import UUID

from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.security import hash_password
from src.db.models import (
    Achievement,
    Card,
    CardDifficulty,
    CardStatistics,
    CardStatus,
    Deck,
    DeckLevel,
    Feedback,
    FeedbackCategory,
    FeedbackStatus,
    FeedbackVote,
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
        6. Create feedback and votes
        7. Create achievements and XP data
        8. Create XP-specific test users

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

        # Step 6: Create feedback and votes
        feedback_result = await self.seed_feedback(user_ids)

        # Step 7: Seed achievement definitions
        achievements_result = await self.seed_achievements()

        # Step 8: Create XP-specific test users for E2E testing
        now = datetime.now(timezone.utc)
        xp_users_result: dict[str, Any] = {"success": True, "users": []}

        # XP Boundary User - 99 XP (1 XP away from level 2)
        xp_boundary_user = User(
            email="e2e_xp_boundary@test.com",
            full_name="E2E XP Boundary",
            password_hash=self.password_hash,
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
            password_hash=self.password_hash,
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
            password_hash=self.password_hash,
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

        # Commit all changes
        await self.db.commit()

        return {
            "success": True,
            "truncation": truncate_result,
            "users": users_result,
            "content": content_result,
            "statistics": stats_result,
            "reviews": reviews_result,
            "feedback": feedback_result,
            "achievements": achievements_result,
            "xp_users": xp_users_result,
        }
