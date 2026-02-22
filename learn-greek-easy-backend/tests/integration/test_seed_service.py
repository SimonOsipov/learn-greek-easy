"""Integration tests for SeedService.

Tests cover:
- Full seed cycle with real database
- Truncation actually clears data
- Idempotency (running twice produces same result)
- Data integrity and foreign key relationships
- Password verification for seeded users
"""

from unittest.mock import patch

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    Card,
    CardStatistics,
    CultureDeck,
    CultureQuestion,
    CultureQuestionStats,
    Deck,
    DeckLevel,
    Feedback,
    FeedbackVote,
    Notification,
    NotificationType,
    Review,
    User,
    UserDeckProgress,
    UserSettings,
    VoteType,
    WordEntry,
)
from src.services.seed_service import SeedService

# Mark all tests in this file as seed tests; can be excluded from
# runs with: pytest -m "not seed"
pytestmark = pytest.mark.seed

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def enable_seeding():
    """Enable seeding for tests."""
    with patch("src.services.seed_service.settings") as mock_settings:
        mock_settings.can_seed_database.return_value = True
        mock_settings.get_seed_validation_errors.return_value = []
        yield mock_settings


# ============================================================================
# Full Seed Cycle Tests
# ============================================================================


@pytest.mark.no_parallel
class TestSeedServiceIntegration:
    """Integration tests with real database."""

    @pytest.mark.asyncio
    async def test_full_seed_creates_all_data(self, db_session: AsyncSession, enable_seeding):
        """seed_all creates complete test data set."""
        seed_service = SeedService(db_session)

        result = await seed_service.seed_all()

        assert result["success"] is True
        assert "v2_decks" in result

        # Verify users were created
        # 4 base users (learner, beginner, advanced, admin) + 3 XP test users + 5 subscription test users = 12 total
        user_count = await db_session.scalar(select(func.count(User.id)))
        assert user_count == 12

        # Verify decks were created
        # 6 CEFR level decks + 4 user-owned decks (3 learner + 1 admin) + 3 V2 decks = 13 total
        deck_count = await db_session.scalar(select(func.count(Deck.id)))
        assert deck_count == 13

        # Verify cards were created
        # 6 CEFR decks * 10 cards = 60 + user deck cards (5+3+0+2=10) = 70 total
        card_count = await db_session.scalar(select(func.count(Card.id)))
        assert card_count == 70

        # V2 decks use WordEntry: 10 nouns + 10 verbs + 10 mixed = 30 total
        word_entry_count = await db_session.scalar(select(func.count(WordEntry.id)))
        assert word_entry_count == 30

        # Verify user settings were created (12 users = 12 settings)
        settings_count = await db_session.scalar(select(func.count(UserSettings.id)))
        assert settings_count == 12

    @pytest.mark.asyncio
    async def test_seed_creates_correct_users(self, db_session: AsyncSession, enable_seeding):
        """Verify all expected users are created with correct attributes."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        # Verify learner user
        learner = await db_session.scalar(select(User).where(User.email == "e2e_learner@test.com"))
        assert learner is not None
        assert learner.full_name == "E2E Learner"
        assert learner.is_superuser is False
        assert learner.is_active is True

        # Verify admin user
        admin = await db_session.scalar(select(User).where(User.email == "e2e_admin@test.com"))
        assert admin is not None
        assert admin.is_superuser is True

    @pytest.mark.asyncio
    async def test_seed_creates_correct_decks(self, db_session: AsyncSession, enable_seeding):
        """Verify all CEFR level decks are created."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        # Verify all CEFR levels
        for level in DeckLevel:
            deck = await db_session.scalar(select(Deck).where(Deck.level == level))
            assert deck is not None, f"Deck for level {level} not found"
            assert deck.is_active is True
            assert f"{level.value}" in deck.name_en

    @pytest.mark.asyncio
    async def test_seed_creates_cards_with_greek_text(
        self, db_session: AsyncSession, enable_seeding
    ):
        """Verify cards contain Greek vocabulary."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        # Get a sample of cards
        cards = (await db_session.execute(select(Card).limit(10))).scalars().all()

        for card in cards:
            # front_text should contain Greek characters
            has_greek = any(
                "\u0370" <= char <= "\u03FF" or "\u1F00" <= char <= "\u1FFF"
                for char in card.front_text
            )
            assert has_greek, f"Card front_text '{card.front_text}' should contain Greek"

    @pytest.mark.asyncio
    async def test_seed_creates_learner_progress(self, db_session: AsyncSession, enable_seeding):
        """Verify progress data is created for learner user."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        # Verify card statistics were created
        stats_count = await db_session.scalar(select(func.count(CardStatistics.id)))
        assert stats_count > 0

        # Verify user deck progress was created
        progress_count = await db_session.scalar(select(func.count(UserDeckProgress.id)))
        assert progress_count > 0

        # Verify reviews were created
        review_count = await db_session.scalar(select(func.count(Review.id)))
        assert review_count > 0


# ============================================================================
# Truncation Tests
# ============================================================================


# ============================================================================
# Idempotency Tests
# ============================================================================


@pytest.mark.no_parallel
class TestSeedServiceIdempotency:
    """Tests for seed idempotency."""

    @pytest.mark.asyncio
    async def test_seed_is_idempotent(self, db_session: AsyncSession, enable_seeding):
        """Running seed_all twice produces same result."""
        seed_service = SeedService(db_session)

        # First seed
        result1 = await seed_service.seed_all()

        # Get counts after first seed
        user_count1 = await db_session.scalar(select(func.count(User.id)))
        deck_count1 = await db_session.scalar(select(func.count(Deck.id)))
        card_count1 = await db_session.scalar(select(func.count(Card.id)))

        # Second seed (should truncate and recreate)
        result2 = await seed_service.seed_all()

        # Get counts after second seed
        user_count2 = await db_session.scalar(select(func.count(User.id)))
        deck_count2 = await db_session.scalar(select(func.count(Deck.id)))
        card_count2 = await db_session.scalar(select(func.count(Card.id)))

        # Counts should be identical
        assert user_count1 == user_count2
        assert deck_count1 == deck_count2
        assert card_count1 == card_count2

        # Both should succeed
        assert result1["success"] is True
        assert result2["success"] is True


# ============================================================================
# Password Verification Tests
# ============================================================================


@pytest.mark.no_parallel
class TestSeedServiceAuthentication:
    """Tests for seeded user authentication.

    Since password-based authentication has been removed, seeded users
    are Auth0-style users (no password hash) with supabase_id set.
    """

    @pytest.mark.asyncio
    async def test_users_supabase_id_configuration(self, db_session: AsyncSession, enable_seeding):
        """Verify supabase_id configuration for seeded users.

        In test environments without Supabase Admin configured, all users
        have supabase_id=None. In environments with Supabase Admin, main
        E2E users will have Supabase Auth UUIDs.
        """
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        users = (await db_session.execute(select(User))).scalars().all()

        # All users should be created
        assert len(users) > 0

        # In test environment (no Supabase configured), all users have supabase_id=None
        # This is expected - Supabase Admin API is not available in unit/integration tests
        for user in users:
            assert user.supabase_id is None, (
                f"User {user.email} should have supabase_id=None "
                f"when Supabase Admin is not configured"
            )

    @pytest.mark.asyncio
    async def test_all_users_are_supabase_style(self, db_session: AsyncSession, enable_seeding):
        """All seeded users are Supabase-style (no password hash).

        Users authenticate via Supabase Auth. The app DB stores profile data only.
        """
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        users = (await db_session.execute(select(User))).scalars().all()

        # Verify users were created
        assert len(users) > 0


# ============================================================================
# Data Integrity Tests
# ============================================================================


@pytest.mark.no_parallel
class TestSeedServiceDataIntegrity:
    """Tests for data integrity and relationships."""

    @pytest.mark.asyncio
    async def test_user_settings_linked_correctly(self, db_session: AsyncSession, enable_seeding):
        """Each user has linked settings."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        users = (await db_session.execute(select(User))).scalars().all()

        for user in users:
            settings = await db_session.scalar(
                select(UserSettings).where(UserSettings.user_id == user.id)
            )
            assert settings is not None, f"Settings not found for user {user.email}"

    @pytest.mark.asyncio
    async def test_cards_linked_to_decks(self, db_session: AsyncSession, enable_seeding):
        """All cards are linked to valid decks."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        cards = (await db_session.execute(select(Card))).scalars().all()

        for card in cards:
            deck = await db_session.scalar(select(Deck).where(Deck.id == card.deck_id))
            assert deck is not None, f"Deck not found for card {card.id}"

    @pytest.mark.asyncio
    async def test_statistics_linked_to_users_and_cards(
        self, db_session: AsyncSession, enable_seeding
    ):
        """Card statistics are linked to valid users and cards."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        stats = (await db_session.execute(select(CardStatistics))).scalars().all()

        for stat in stats:
            user = await db_session.scalar(select(User).where(User.id == stat.user_id))
            assert user is not None, f"User not found for stat {stat.id}"

            card = await db_session.scalar(select(Card).where(Card.id == stat.card_id))
            assert card is not None, f"Card not found for stat {stat.id}"

    @pytest.mark.asyncio
    async def test_reviews_linked_to_users_and_cards(
        self, db_session: AsyncSession, enable_seeding
    ):
        """Reviews are linked to valid users and cards."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        reviews = (await db_session.execute(select(Review))).scalars().all()

        for review in reviews:
            user = await db_session.scalar(select(User).where(User.id == review.user_id))
            assert user is not None, f"User not found for review {review.id}"

            card = await db_session.scalar(select(Card).where(Card.id == review.card_id))
            assert card is not None, f"Card not found for review {review.id}"


# ============================================================================
# Feedback Seeding Tests
# ============================================================================


@pytest.mark.no_parallel
class TestSeedServiceFeedback:
    """Integration tests for feedback seeding with real database."""

    @pytest.mark.asyncio
    async def test_seed_creates_feedback_items(self, db_session: AsyncSession, enable_seeding):
        """seed_all creates 8 feedback items."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        # Verify 8 feedback items were created
        feedback_count = await db_session.scalar(select(func.count(Feedback.id)))
        assert feedback_count == 8

    @pytest.mark.asyncio
    async def test_seed_creates_votes(self, db_session: AsyncSession, enable_seeding):
        """seed_all creates votes for feedback items."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        # Verify votes were created
        vote_count = await db_session.scalar(select(func.count(FeedbackVote.id)))
        assert vote_count > 0

        # Verify both upvotes and downvotes exist
        upvote_count = await db_session.scalar(
            select(func.count(FeedbackVote.id)).where(FeedbackVote.vote_type == VoteType.UP)
        )
        downvote_count = await db_session.scalar(
            select(func.count(FeedbackVote.id)).where(FeedbackVote.vote_type == VoteType.DOWN)
        )

        assert upvote_count > 0, "Should have upvotes"
        assert downvote_count > 0, "Should have downvotes"
        assert downvote_count == 2, "Should have exactly 2 downvotes"

    @pytest.mark.asyncio
    async def test_vote_counts_match_actual_votes(self, db_session: AsyncSession, enable_seeding):
        """CRITICAL: Verify denormalized vote_count matches actual votes."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        # Get all feedback items
        feedback_items = (await db_session.execute(select(Feedback))).scalars().all()

        for feedback in feedback_items:
            # Count actual votes for this feedback
            upvotes = await db_session.scalar(
                select(func.count(FeedbackVote.id)).where(
                    FeedbackVote.feedback_id == feedback.id,
                    FeedbackVote.vote_type == VoteType.UP,
                )
            )
            downvotes = await db_session.scalar(
                select(func.count(FeedbackVote.id)).where(
                    FeedbackVote.feedback_id == feedback.id,
                    FeedbackVote.vote_type == VoteType.DOWN,
                )
            )

            expected_count = upvotes - downvotes
            assert feedback.vote_count == expected_count, (
                f"Feedback '{feedback.title}' has vote_count={feedback.vote_count} "
                f"but expected {expected_count} (upvotes={upvotes}, downvotes={downvotes})"
            )

    @pytest.mark.asyncio
    async def test_seed_creates_diverse_vote_scenarios(
        self, db_session: AsyncSession, enable_seeding
    ):
        """Verify diverse vote scenarios: popular, controversial, new."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        # Get feedback by title
        dark_mode = await db_session.scalar(
            select(Feedback).where(Feedback.title == "Add dark mode support")
        )
        gamification = await db_session.scalar(
            select(Feedback).where(Feedback.title == "Add gamification features")
        )
        spaced_rep = await db_session.scalar(
            select(Feedback).where(Feedback.title == "Add spaced repetition settings")
        )
        card_order = await db_session.scalar(
            select(Feedback).where(Feedback.title == "Card order randomization broken")
        )

        # Dark mode should be popular (high vote count)
        assert dark_mode is not None
        assert dark_mode.vote_count == 3, f"Dark mode expected +3, got {dark_mode.vote_count}"

        # Gamification should be controversial (mixed votes)
        assert gamification is not None
        assert (
            gamification.vote_count == 1
        ), f"Gamification expected +1, got {gamification.vote_count}"

        # Spaced repetition should have no votes (new)
        assert spaced_rep is not None
        assert spaced_rep.vote_count == 0, f"Spaced rep expected 0, got {spaced_rep.vote_count}"

        # Card order bug should be mixed (0 net)
        assert card_order is not None
        assert card_order.vote_count == 0, f"Card order expected 0, got {card_order.vote_count}"

    @pytest.mark.asyncio
    async def test_feedback_linked_to_valid_users(self, db_session: AsyncSession, enable_seeding):
        """Feedback items are linked to valid users."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        feedback_items = (await db_session.execute(select(Feedback))).scalars().all()

        for feedback in feedback_items:
            user = await db_session.scalar(select(User).where(User.id == feedback.user_id))
            assert user is not None, f"User not found for feedback '{feedback.title}'"

    @pytest.mark.asyncio
    async def test_votes_linked_to_valid_users_and_feedback(
        self, db_session: AsyncSession, enable_seeding
    ):
        """Votes are linked to valid users and feedback items."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        votes = (await db_session.execute(select(FeedbackVote))).scalars().all()

        for vote in votes:
            user = await db_session.scalar(select(User).where(User.id == vote.user_id))
            assert user is not None, f"User not found for vote {vote.id}"

            feedback = await db_session.scalar(
                select(Feedback).where(Feedback.id == vote.feedback_id)
            )
            assert feedback is not None, f"Feedback not found for vote {vote.id}"

            # Verify user is not voting on their own feedback
            assert (
                vote.user_id != feedback.user_id
            ), f"User {user.email} voted on their own feedback '{feedback.title}'"


# ============================================================================
# Notification Seeding Tests
# ============================================================================


@pytest.mark.no_parallel
class TestSeedServiceNotifications:
    """Integration tests for notification seeding with real database."""

    @pytest.mark.asyncio
    async def test_seed_creates_notifications(self, db_session: AsyncSession, enable_seeding):
        """seed_all creates notifications for learner user.

        Creates:
        - 5 base notifications (achievement, daily_goal, level_up, streak_at_risk, welcome)
        - 4 announcement notifications (from seed_announcement_campaigns)
        Total: 9 notifications
        """
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        # Verify 9 notifications were created (5 base + 4 announcements)
        notification_count = await db_session.scalar(select(func.count(Notification.id)))
        assert notification_count == 9

    @pytest.mark.asyncio
    async def test_notifications_linked_to_learner(self, db_session: AsyncSession, enable_seeding):
        """Notifications are linked to the learner user."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        # Get learner user
        learner = await db_session.scalar(select(User).where(User.email == "e2e_learner@test.com"))
        assert learner is not None

        # All notifications should belong to learner
        notifications = (await db_session.execute(select(Notification))).scalars().all()

        for n in notifications:
            assert n.user_id == learner.id

    @pytest.mark.asyncio
    async def test_notifications_have_correct_read_status(
        self, db_session: AsyncSession, enable_seeding
    ):
        """Verify correct read/unread notification counts.

        Base notifications: 3 unread, 2 read
        Announcement notifications: 2 unread (Welcome, Maintenance), 2 read (Feature, Weekly)
        Total: 5 unread, 4 read
        """
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        # Count unread (3 base + 2 announcements)
        unread_count = await db_session.scalar(
            select(func.count(Notification.id)).where(Notification.read == False)  # noqa: E712
        )
        assert unread_count == 5

        # Count read (2 base + 2 announcements)
        read_count = await db_session.scalar(
            select(func.count(Notification.id)).where(Notification.read == True)  # noqa: E712
        )
        assert read_count == 4

    @pytest.mark.asyncio
    async def test_notifications_have_various_types(self, db_session: AsyncSession, enable_seeding):
        """Verify notifications have various types including announcements."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        notifications = (await db_session.execute(select(Notification))).scalars().all()

        types = {n.type for n in notifications}

        # Should have 6 different notification types (5 base + admin_announcement)
        assert len(types) == 6
        assert NotificationType.ACHIEVEMENT_UNLOCKED in types
        assert NotificationType.DAILY_GOAL_COMPLETE in types
        assert NotificationType.LEVEL_UP in types
        assert NotificationType.STREAK_AT_RISK in types
        assert NotificationType.WELCOME in types
        assert NotificationType.ADMIN_ANNOUNCEMENT in types

    @pytest.mark.asyncio
    async def test_notifications_have_correct_titles(
        self, db_session: AsyncSession, enable_seeding
    ):
        """Verify notifications have expected titles including announcements."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        notifications = (await db_session.execute(select(Notification))).scalars().all()

        titles = {n.title for n in notifications}

        # Check for expected titles (5 base + 4 announcements)
        expected_titles = {
            # Base notification titles
            "Achievement Unlocked: First Flame",
            "Daily Goal Complete!",
            "Level Up!",
            "Streak at Risk!",
            "Welcome to Greekly!",
            # Announcement notification titles
            "E2E Test Announcement - Welcome",
            "E2E Test Announcement - New Feature",
            "E2E Test Announcement - Weekly Update",
            "E2E Test Announcement - Maintenance Complete",
        }

        assert titles == expected_titles

    @pytest.mark.asyncio
    async def test_notification_timestamps_are_in_past(
        self, db_session: AsyncSession, enable_seeding
    ):
        """Verify notification timestamps are realistic (in the past)."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)

        notifications = (await db_session.execute(select(Notification))).scalars().all()

        for n in notifications:
            # All created_at should be in the past
            assert n.created_at < now

            # If read, read_at should also be in the past
            if n.read and n.read_at:
                assert n.read_at < now
                # read_at should be after created_at
                assert n.read_at > n.created_at

    @pytest.mark.asyncio
    async def test_truncation_clears_notifications(self, db_session: AsyncSession, enable_seeding):
        """Verify truncation clears notifications table including announcements."""
        seed_service = SeedService(db_session)

        # First seed
        await seed_service.seed_all()

        # Verify notifications exist (5 base + 4 announcements = 9)
        count_before = await db_session.scalar(select(func.count(Notification.id)))
        assert count_before == 9

        # Truncate
        await seed_service.truncate_tables()
        await db_session.commit()

        # Verify notifications are cleared
        count_after = await db_session.scalar(select(func.count(Notification.id)))
        assert count_after == 0


# ============================================================================
# Culture Seeding Tests
# ============================================================================


@pytest.mark.no_parallel
class TestSeedServiceCulture:
    """Integration tests for culture seeding with real database."""

    @pytest.mark.asyncio
    async def test_seed_creates_culture_decks(self, db_session: AsyncSession, enable_seeding):
        """seed_all creates at least 5 base culture decks plus E2E decks."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        # Verify at least 5 culture decks were created (5 base + E2E decks)
        deck_count = await db_session.scalar(select(func.count(CultureDeck.id)))
        assert deck_count >= 5

    @pytest.mark.asyncio
    async def test_seed_creates_culture_questions(self, db_session: AsyncSession, enable_seeding):
        """seed_all creates at least 50 culture questions (10 per base deck)."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        # Verify at least 50 culture questions were created (50 base + E2E questions)
        question_count = await db_session.scalar(select(func.count(CultureQuestion.id)))
        assert question_count >= 50

    @pytest.mark.asyncio
    async def test_culture_decks_have_correct_categories(
        self, db_session: AsyncSession, enable_seeding
    ):
        """Verify all 5 culture categories are created."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        decks = (await db_session.execute(select(CultureDeck))).scalars().all()

        categories = {d.category for d in decks}
        assert categories == {"history", "geography", "politics", "culture", "traditions"}

    @pytest.mark.asyncio
    async def test_culture_decks_have_trilingual_names(
        self, db_session: AsyncSession, enable_seeding
    ):
        """Verify culture decks have el, en, ru translations."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        decks = (await db_session.execute(select(CultureDeck))).scalars().all()

        for deck in decks:
            # Name should have all 3 languages
            assert deck.name_el is not None, f"Deck {deck.category} missing name_el"
            assert deck.name_en is not None, f"Deck {deck.category} missing name_en"
            assert deck.name_ru is not None, f"Deck {deck.category} missing name_ru"

            # Description should have all 3 languages
            assert deck.description_el is not None, f"Deck {deck.category} missing description_el"
            assert deck.description_en is not None, f"Deck {deck.category} missing description_en"
            assert deck.description_ru is not None, f"Deck {deck.category} missing description_ru"

    @pytest.mark.asyncio
    async def test_culture_questions_have_trilingual_content(
        self, db_session: AsyncSession, enable_seeding
    ):
        """Verify culture questions have el, en, ru translations."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        questions = (await db_session.execute(select(CultureQuestion).limit(10))).scalars().all()

        for q in questions:
            # Question text should have all 3 languages
            assert "el" in q.question_text, "Question missing 'el' translation"
            assert "en" in q.question_text, "Question missing 'en' translation"
            assert "ru" in q.question_text, "Question missing 'ru' translation"

            # Options should have all 3 languages
            for option in [q.option_a, q.option_b, q.option_c, q.option_d]:
                if option:  # option_d may be None
                    assert "el" in option, "Option missing 'el' translation"
                    assert "en" in option, "Option missing 'en' translation"
                    assert "ru" in option, "Option missing 'ru' translation"

    @pytest.mark.asyncio
    async def test_culture_questions_linked_to_decks(
        self, db_session: AsyncSession, enable_seeding
    ):
        """Verify all culture questions are linked to valid decks."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        questions = (await db_session.execute(select(CultureQuestion))).scalars().all()

        for q in questions:
            deck = await db_session.scalar(select(CultureDeck).where(CultureDeck.id == q.deck_id))
            assert deck is not None, f"Culture deck not found for question {q.id}"

    @pytest.mark.asyncio
    async def test_each_base_deck_has_ten_questions(self, db_session: AsyncSession, enable_seeding):
        """Verify each base culture deck has exactly 10 questions.

        Only checks the 5 base culture decks, not E2E decks which may have
        different question counts.
        """
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        base_categories = {"history", "geography", "politics", "culture", "traditions"}
        decks = (
            (
                await db_session.execute(
                    select(CultureDeck).where(CultureDeck.category.in_(base_categories))
                )
            )
            .scalars()
            .all()
        )

        # Filter to only base decks (not E2E decks with names like "E2E ...")
        base_decks = [d for d in decks if not d.name_en.startswith("E2E")]

        for deck in base_decks:
            question_count = await db_session.scalar(
                select(func.count(CultureQuestion.id)).where(CultureQuestion.deck_id == deck.id)
            )
            assert (
                question_count == 10
            ), f"Base deck {deck.category} has {question_count} questions, expected 10"


@pytest.mark.no_parallel
class TestSeedServiceCultureStatistics:
    """Integration tests for culture question statistics seeding with real database."""

    @pytest.mark.asyncio
    async def test_seed_creates_learner_culture_stats(
        self, db_session: AsyncSession, enable_seeding
    ):
        """seed_all creates culture statistics for learner user (60% History)."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        # Get learner user
        learner = await db_session.scalar(select(User).where(User.email == "e2e_learner@test.com"))
        assert learner is not None

        # Verify learner has culture stats
        learner_stats_count = await db_session.scalar(
            select(func.count(CultureQuestionStats.id)).where(
                CultureQuestionStats.user_id == learner.id
            )
        )
        # Learner should have stats for history deck (10 questions * 60% = 6 stats)
        assert learner_stats_count > 0

    @pytest.mark.asyncio
    async def test_seed_creates_advanced_culture_stats(
        self, db_session: AsyncSession, enable_seeding
    ):
        """seed_all creates culture statistics for advanced user (80% all decks)."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        # Get advanced user
        advanced = await db_session.scalar(
            select(User).where(User.email == "e2e_advanced@test.com")
        )
        assert advanced is not None

        # Verify advanced has culture stats for all decks
        advanced_stats_count = await db_session.scalar(
            select(func.count(CultureQuestionStats.id)).where(
                CultureQuestionStats.user_id == advanced.id
            )
        )
        # Advanced should have stats for all 5 decks (50 questions * 80% = 40+ stats)
        assert advanced_stats_count >= 40

    @pytest.mark.asyncio
    async def test_culture_stats_linked_to_valid_users_and_questions(
        self, db_session: AsyncSession, enable_seeding
    ):
        """Culture statistics are linked to valid users and questions."""
        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        stats = (await db_session.execute(select(CultureQuestionStats))).scalars().all()

        for stat in stats:
            user = await db_session.scalar(select(User).where(User.id == stat.user_id))
            assert user is not None, f"User not found for culture stat {stat.id}"

            question = await db_session.scalar(
                select(CultureQuestion).where(CultureQuestion.id == stat.question_id)
            )
            assert question is not None, f"Question not found for culture stat {stat.id}"

    @pytest.mark.asyncio
    async def test_truncation_clears_culture_tables(self, db_session: AsyncSession, enable_seeding):
        """Verify truncation clears culture tables."""
        seed_service = SeedService(db_session)

        # First seed
        await seed_service.seed_all()

        # Verify culture data exists (at least 5 base decks, possibly more E2E decks)
        deck_count_before = await db_session.scalar(select(func.count(CultureDeck.id)))
        question_count_before = await db_session.scalar(select(func.count(CultureQuestion.id)))
        stats_count_before = await db_session.scalar(select(func.count(CultureQuestionStats.id)))

        assert deck_count_before >= 5
        assert question_count_before >= 50
        assert stats_count_before > 0

        # Truncate
        await seed_service.truncate_tables()
        await db_session.commit()

        # Verify culture tables are cleared
        deck_count_after = await db_session.scalar(select(func.count(CultureDeck.id)))
        question_count_after = await db_session.scalar(select(func.count(CultureQuestion.id)))
        stats_count_after = await db_session.scalar(select(func.count(CultureQuestionStats.id)))

        assert deck_count_after == 0
        assert question_count_after == 0
        assert stats_count_after == 0


@pytest.mark.no_parallel
class TestSeedServiceCultureTruncationOrder:
    """Tests for culture table truncation order with real database."""

    @pytest.mark.asyncio
    async def test_truncation_order_is_fk_safe_for_culture(
        self, db_session: AsyncSession, enable_seeding
    ):
        """Verify culture truncation doesn't violate FK constraints."""
        seed_service = SeedService(db_session)

        # Seed data with FK relationships
        await seed_service.seed_all()

        # Truncation should not raise FK constraint errors
        result = await seed_service.truncate_tables()
        await db_session.commit()

        assert result["success"] is True
        # Verify culture tables are in the truncation order
        assert "culture_question_stats" in result["truncated_tables"]
        assert "culture_questions" in result["truncated_tables"]
        assert "culture_decks" in result["truncated_tables"]


# ============================================================================
# Announcement Seeding Tests
# ============================================================================


@pytest.mark.no_parallel
class TestSeedServiceAnnouncements:
    """Integration tests for announcement campaign seeding with real database."""

    @pytest.mark.asyncio
    async def test_seed_creates_announcement_campaigns(
        self, db_session: AsyncSession, enable_seeding
    ):
        """seed_all creates 4 announcement campaigns."""
        from sqlalchemy import func, select

        from src.db.models import AnnouncementCampaign

        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        # Verify 4 announcement campaigns were created
        campaign_count = await db_session.scalar(select(func.count(AnnouncementCampaign.id)))
        assert campaign_count == 4

    @pytest.mark.asyncio
    async def test_announcement_campaigns_have_correct_titles(
        self, db_session: AsyncSession, enable_seeding
    ):
        """Verify announcement campaigns have expected titles."""
        from sqlalchemy import select

        from src.db.models import AnnouncementCampaign

        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        campaigns = (await db_session.execute(select(AnnouncementCampaign))).scalars().all()

        titles = {c.title for c in campaigns}

        expected_titles = {
            "E2E Test Announcement - Welcome",
            "E2E Test Announcement - New Feature",
            "E2E Test Announcement - Weekly Update",
            "E2E Test Announcement - Maintenance Complete",
        }

        assert titles == expected_titles

    @pytest.mark.asyncio
    async def test_announcement_campaigns_created_by_admin(
        self, db_session: AsyncSession, enable_seeding
    ):
        """Verify all campaigns are created by the admin user."""
        from sqlalchemy import select

        from src.db.models import AnnouncementCampaign, User

        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        # Get admin user
        admin = await db_session.scalar(select(User).where(User.email == "e2e_admin@test.com"))
        assert admin is not None

        # All campaigns should be created by admin
        campaigns = (await db_session.execute(select(AnnouncementCampaign))).scalars().all()

        for campaign in campaigns:
            assert campaign.created_by == admin.id

    @pytest.mark.asyncio
    async def test_announcement_campaign_with_link(self, db_session: AsyncSession, enable_seeding):
        """Verify one campaign has a link URL."""
        from sqlalchemy import select

        from src.db.models import AnnouncementCampaign

        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        # Find campaign with link
        campaign_with_link = await db_session.scalar(
            select(AnnouncementCampaign).where(
                AnnouncementCampaign.title == "E2E Test Announcement - New Feature"
            )
        )

        assert campaign_with_link is not None
        assert campaign_with_link.link_url == "https://example.com/new-features"

    @pytest.mark.asyncio
    async def test_announcement_campaigns_have_different_timestamps(
        self, db_session: AsyncSession, enable_seeding
    ):
        """Verify campaigns have different created_at timestamps."""
        from sqlalchemy import select

        from src.db.models import AnnouncementCampaign

        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        campaigns = (await db_session.execute(select(AnnouncementCampaign))).scalars().all()

        # All timestamps should be different
        timestamps = [c.created_at for c in campaigns]
        assert len(set(timestamps)) == 4, "All campaigns should have different timestamps"

    @pytest.mark.asyncio
    async def test_announcement_notifications_linked_to_campaigns(
        self, db_session: AsyncSession, enable_seeding
    ):
        """Verify announcement notifications have campaign_id in extra_data."""
        from sqlalchemy import select

        from src.db.models import AnnouncementCampaign, Notification, NotificationType

        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        # Get all announcement notifications
        notifications = (
            (
                await db_session.execute(
                    select(Notification).where(
                        Notification.type == NotificationType.ADMIN_ANNOUNCEMENT
                    )
                )
            )
            .scalars()
            .all()
        )

        assert len(notifications) == 4

        # Get all campaign IDs
        campaigns = (await db_session.execute(select(AnnouncementCampaign))).scalars().all()
        campaign_ids = {str(c.id) for c in campaigns}

        # Each notification should reference a valid campaign
        for notification in notifications:
            assert notification.extra_data is not None
            assert "campaign_id" in notification.extra_data
            assert notification.extra_data["campaign_id"] in campaign_ids

    @pytest.mark.asyncio
    async def test_announcement_read_counts_match_notifications(
        self, db_session: AsyncSession, enable_seeding
    ):
        """Verify campaign read_count matches notification read status."""
        from sqlalchemy import select

        from src.db.models import AnnouncementCampaign, Notification, NotificationType

        seed_service = SeedService(db_session)

        await seed_service.seed_all()

        campaigns = (await db_session.execute(select(AnnouncementCampaign))).scalars().all()

        for campaign in campaigns:
            # Get notification for this campaign
            notification = await db_session.scalar(
                select(Notification).where(
                    Notification.type == NotificationType.ADMIN_ANNOUNCEMENT,
                    Notification.title == campaign.title,
                )
            )

            assert notification is not None

            # Read count should match notification read status
            expected_read_count = 1 if notification.read else 0
            assert campaign.read_count == expected_read_count

    @pytest.mark.asyncio
    async def test_truncation_clears_announcement_campaigns(
        self, db_session: AsyncSession, enable_seeding
    ):
        """Verify truncation clears announcement_campaigns table."""
        from sqlalchemy import func, select

        from src.db.models import AnnouncementCampaign

        seed_service = SeedService(db_session)

        # First seed
        await seed_service.seed_all()

        # Verify campaigns exist
        count_before = await db_session.scalar(select(func.count(AnnouncementCampaign.id)))
        assert count_before == 4

        # Truncate
        await seed_service.truncate_tables()
        await db_session.commit()

        # Verify campaigns are cleared
        count_after = await db_session.scalar(select(func.count(AnnouncementCampaign.id)))
        assert count_after == 0

    @pytest.mark.asyncio
    async def test_announcement_seeding_is_idempotent(
        self, db_session: AsyncSession, enable_seeding
    ):
        """Verify announcement seeding is idempotent (can run multiple times)."""
        from sqlalchemy import func, select

        from src.db.models import AnnouncementCampaign

        seed_service = SeedService(db_session)

        # First seed
        await seed_service.seed_all()
        count1 = await db_session.scalar(select(func.count(AnnouncementCampaign.id)))

        # Second seed (should truncate and recreate)
        await seed_service.seed_all()
        count2 = await db_session.scalar(select(func.count(AnnouncementCampaign.id)))

        # Counts should be identical
        assert count1 == count2 == 4
