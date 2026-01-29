"""Unit tests for SeedService.

Tests cover:
- Production protection (guard methods)
- Table truncation order
- User seeding
- Deck and card seeding
- Card statistics seeding
- Review history seeding
- Full seed orchestration
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.db.models import DeckLevel, FeedbackCategory, NotificationType, VoteType
from src.services.seed_service import SeedService

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def mock_db():
    """Create a mock async database session."""
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.execute = AsyncMock()
    return db


@pytest.fixture
def seed_service(mock_db):
    """Create SeedService instance with mock database."""
    return SeedService(mock_db)


@pytest.fixture
def mock_settings_can_seed():
    """Mock settings to allow seeding."""
    with patch("src.services.seed_service.settings") as mock_settings:
        mock_settings.can_seed_database.return_value = True
        mock_settings.get_seed_validation_errors.return_value = []
        yield mock_settings


@pytest.fixture
def mock_settings_cannot_seed():
    """Mock settings to block seeding."""
    with patch("src.services.seed_service.settings") as mock_settings:
        mock_settings.can_seed_database.return_value = False
        mock_settings.get_seed_validation_errors.return_value = [
            "Seeding is disabled in production environment",
            "TEST_SEED_ENABLED is not set to true",
        ]
        yield mock_settings


# ============================================================================
# Guard Method Tests
# ============================================================================


class TestSeedServiceGuards:
    """Tests for production protection."""

    def test_check_can_seed_allowed(self, seed_service, mock_settings_can_seed):
        """_check_can_seed should not raise when seeding is allowed."""
        # Should not raise
        seed_service._check_can_seed()

    def test_check_can_seed_blocked(self, seed_service, mock_settings_cannot_seed):
        """_check_can_seed should raise RuntimeError when seeding blocked."""
        with pytest.raises(RuntimeError) as exc_info:
            seed_service._check_can_seed()

        assert "Database seeding not allowed" in str(exc_info.value)
        assert "production" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_truncate_blocked_in_production(self, seed_service, mock_settings_cannot_seed):
        """truncate_tables should raise RuntimeError in production."""
        with pytest.raises(RuntimeError) as exc_info:
            await seed_service.truncate_tables()

        assert "Database seeding not allowed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_seed_users_blocked_in_production(self, seed_service, mock_settings_cannot_seed):
        """seed_users should raise RuntimeError in production."""
        with pytest.raises(RuntimeError) as exc_info:
            await seed_service.seed_users()

        assert "Database seeding not allowed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_seed_decks_and_cards_blocked_in_production(
        self, seed_service, mock_settings_cannot_seed
    ):
        """seed_decks_and_cards should raise RuntimeError in production."""
        with pytest.raises(RuntimeError) as exc_info:
            await seed_service.seed_decks_and_cards()

        assert "Database seeding not allowed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_seed_card_statistics_blocked_in_production(
        self, seed_service, mock_settings_cannot_seed
    ):
        """seed_card_statistics should raise RuntimeError in production."""
        with pytest.raises(RuntimeError) as exc_info:
            await seed_service.seed_card_statistics(
                user_id=uuid4(), deck_id=uuid4(), progress_percent=50
            )

        assert "Database seeding not allowed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_seed_reviews_blocked_in_production(
        self, seed_service, mock_settings_cannot_seed
    ):
        """seed_reviews should raise RuntimeError in production."""
        with pytest.raises(RuntimeError) as exc_info:
            await seed_service.seed_reviews(user_id=uuid4(), card_id=uuid4(), review_count=5)

        assert "Database seeding not allowed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_seed_all_blocked_in_production(self, seed_service, mock_settings_cannot_seed):
        """seed_all should raise RuntimeError in production."""
        with pytest.raises(RuntimeError) as exc_info:
            await seed_service.seed_all()

        assert "Database seeding not allowed" in str(exc_info.value)


# ============================================================================
# Truncation Tests
# ============================================================================


class TestSeedServiceTruncation:
    """Tests for table truncation."""

    def test_truncation_order_is_fk_safe(self):
        """Verify truncation order respects FK constraints."""
        # Children must come before parents
        order = SeedService.TRUNCATION_ORDER

        # reviews depends on users and cards
        assert order.index("reviews") < order.index("users")
        assert order.index("reviews") < order.index("cards")

        # card_statistics depends on users and cards
        assert order.index("card_statistics") < order.index("users")
        assert order.index("card_statistics") < order.index("cards")

        # user_deck_progress depends on users and decks
        assert order.index("user_deck_progress") < order.index("users")
        assert order.index("user_deck_progress") < order.index("decks")

        # refresh_tokens depends on users
        assert order.index("refresh_tokens") < order.index("users")

        # user_settings depends on users
        assert order.index("user_settings") < order.index("users")

        # cards depends on decks
        assert order.index("cards") < order.index("decks")

        # culture_question_stats depends on users and culture_questions
        assert order.index("culture_question_stats") < order.index("users")
        assert order.index("culture_question_stats") < order.index("culture_questions")

        # culture_questions depends on culture_decks
        assert order.index("culture_questions") < order.index("culture_decks")

    @pytest.mark.asyncio
    async def test_truncate_returns_table_list(self, seed_service, mock_db, mock_settings_can_seed):
        """Verify truncate_tables returns list of truncated tables."""
        result = await seed_service.truncate_tables()

        assert result["success"] is True
        assert "truncated_tables" in result
        assert len(result["truncated_tables"]) == len(SeedService.TRUNCATION_ORDER)
        assert result["truncated_tables"] == SeedService.TRUNCATION_ORDER

    @pytest.mark.asyncio
    async def test_truncate_executes_for_all_tables(
        self, seed_service, mock_db, mock_settings_can_seed
    ):
        """Verify truncate calls execute for each table."""
        await seed_service.truncate_tables()

        # Should call execute once per table
        assert mock_db.execute.call_count == len(SeedService.TRUNCATION_ORDER)


# ============================================================================
# User Seeding Tests
# ============================================================================


class TestSeedServiceUsers:
    """Tests for user seeding."""

    @pytest.mark.asyncio
    async def test_creates_four_test_users(self, seed_service, mock_db, mock_settings_can_seed):
        """Verify 4 users are created with correct attributes."""
        # Mock flush to assign IDs
        call_count = 0

        async def mock_flush():
            nonlocal call_count
            call_count += 1

        mock_db.flush = mock_flush

        result = await seed_service.seed_users()

        assert result["success"] is True
        assert len(result["users"]) == 4

        # Check email addresses
        emails = [u["email"] for u in result["users"]]
        assert "e2e_learner@test.com" in emails
        assert "e2e_beginner@test.com" in emails
        assert "e2e_advanced@test.com" in emails
        assert "e2e_admin@test.com" in emails

    @pytest.mark.asyncio
    async def test_admin_user_is_superuser(self, seed_service, mock_db, mock_settings_can_seed):
        """Verify admin user has is_superuser=True."""
        result = await seed_service.seed_users()

        admin_user = next(u for u in result["users"] if u["email"] == "e2e_admin@test.com")
        assert admin_user["is_superuser"] is True

        # Other users should not be superusers
        for user in result["users"]:
            if user["email"] != "e2e_admin@test.com":
                assert user["is_superuser"] is False

    @pytest.mark.asyncio
    async def test_password_is_returned(self, seed_service, mock_db, mock_settings_can_seed):
        """Verify default password is returned for backward compatibility."""
        result = await seed_service.seed_users()

        assert "password" in result
        assert result["password"] == SeedService.DEFAULT_PASSWORD

    @pytest.mark.asyncio
    async def test_users_have_auth0_id_in_response(
        self, seed_service, mock_db, mock_settings_can_seed
    ):
        """Verify auth0_id field is included in response.

        Main E2E users (learner, beginner, advanced, admin) have auth0_id=None
        to enable Auth0 account linking during E2E tests. This allows testing
        the flow where an existing email account gets linked to Auth0.
        """
        result = await seed_service.seed_users()

        for user in result["users"]:
            # auth0_id should be in the response (even if None)
            assert "auth0_id" in user
            # Main E2E users should have None for account linking
            assert user["auth0_id"] is None


# ============================================================================
# Content Seeding Tests
# ============================================================================


class TestSeedServiceContent:
    """Tests for deck and card seeding."""

    @pytest.mark.asyncio
    async def test_creates_six_decks(self, seed_service, mock_db, mock_settings_can_seed):
        """Verify 6 CEFR level decks are created."""
        result = await seed_service.seed_decks_and_cards()

        assert result["success"] is True
        assert len(result["decks"]) == 6

        # Check all CEFR levels
        levels = [d["level"] for d in result["decks"]]
        assert "A1" in levels
        assert "A2" in levels
        assert "B1" in levels
        assert "B2" in levels
        assert "C1" in levels
        assert "C2" in levels

    @pytest.mark.asyncio
    async def test_each_deck_has_ten_cards(self, seed_service, mock_db, mock_settings_can_seed):
        """Verify 10 cards per deck."""
        result = await seed_service.seed_decks_and_cards()

        for deck in result["decks"]:
            assert deck["card_count"] == 10

        assert result["total_cards"] == 60  # 6 decks * 10 cards

    @pytest.mark.asyncio
    async def test_vocabulary_has_greek_text(self, seed_service):
        """Verify vocabulary contains Greek characters."""
        # Check that vocabulary data contains Greek text
        for level, words in SeedService.VOCABULARY.items():
            for greek, english, category, part_of_speech in words:
                # Greek text should contain Greek characters
                assert any(
                    "\u0370" <= char <= "\u03FF" or "\u1F00" <= char <= "\u1FFF" for char in greek
                ), f"'{greek}' should contain Greek characters"

    def test_vocabulary_covers_all_cefr_levels(self, seed_service):
        """Verify vocabulary exists for all CEFR levels."""
        for level in DeckLevel:
            assert level in SeedService.VOCABULARY
            assert len(SeedService.VOCABULARY[level]) == 10


# ============================================================================
# Statistics Seeding Tests
# ============================================================================


class TestSeedServiceStatistics:
    """Tests for card statistics seeding."""

    @pytest.mark.asyncio
    async def test_creates_statistics_for_all_cards(
        self, seed_service, mock_db, mock_settings_can_seed
    ):
        """Verify statistics are created for each card in deck."""
        # Mock card query result
        card_ids = [uuid4() for _ in range(10)]
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [(cid,) for cid in card_ids]
        mock_db.execute.return_value = mock_result

        result = await seed_service.seed_card_statistics(
            user_id=uuid4(), deck_id=uuid4(), progress_percent=50
        )

        assert result["success"] is True
        assert result["stats_created"] == 10

    @pytest.mark.asyncio
    async def test_progress_distribution(self, seed_service, mock_db, mock_settings_can_seed):
        """Verify card status distribution matches progress_percent."""
        card_ids = [uuid4() for _ in range(10)]
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [(cid,) for cid in card_ids]
        mock_db.execute.return_value = mock_result

        result = await seed_service.seed_card_statistics(
            user_id=uuid4(), deck_id=uuid4(), progress_percent=60
        )

        # 60% of 10 = 6 mastered
        assert result["mastered"] == 6
        # Up to 3 learning cards
        assert result["learning"] == 3
        # Remainder are new
        assert result["new"] == 1

    @pytest.mark.asyncio
    async def test_handles_empty_deck(self, seed_service, mock_db, mock_settings_can_seed):
        """Verify handling of deck with no cards."""
        mock_result = MagicMock()
        mock_result.fetchall.return_value = []
        mock_db.execute.return_value = mock_result

        result = await seed_service.seed_card_statistics(
            user_id=uuid4(), deck_id=uuid4(), progress_percent=50
        )

        assert result["success"] is True
        assert result["stats_created"] == 0


# ============================================================================
# Review Seeding Tests
# ============================================================================


class TestSeedServiceReviews:
    """Tests for review history seeding."""

    @pytest.mark.asyncio
    async def test_creates_requested_reviews(self, seed_service, mock_db, mock_settings_can_seed):
        """Verify correct number of reviews are created."""
        result = await seed_service.seed_reviews(user_id=uuid4(), card_id=uuid4(), review_count=5)

        assert result["success"] is True
        assert result["reviews_created"] == 5
        assert len(result["reviews"]) == 5

    @pytest.mark.asyncio
    async def test_ratings_improve_over_time(self, seed_service, mock_db, mock_settings_can_seed):
        """Verify review ratings show learning progression."""
        result = await seed_service.seed_reviews(user_id=uuid4(), card_id=uuid4(), review_count=5)

        ratings = [r["quality"] for r in result["reviews"]]

        # First ratings should be lower (harder)
        # Last rating should be higher (easier/perfect)
        assert ratings[0] <= ratings[-1]
        assert ratings[-1] == 5  # Perfect rating

    @pytest.mark.asyncio
    async def test_limits_to_available_ratings(self, seed_service, mock_db, mock_settings_can_seed):
        """Verify review count is limited to rating progression length."""
        result = await seed_service.seed_reviews(
            user_id=uuid4(), card_id=uuid4(), review_count=100  # Request more than available
        )

        # Should be limited to 5 (length of rating_progression)
        assert result["reviews_created"] == 5


# ============================================================================
# Full Seed Orchestration Tests
# ============================================================================


class TestSeedServiceOrchestration:
    """Tests for seed_all orchestration."""

    @pytest.fixture
    def mock_db_with_ids(self):
        """Create mock database that assigns IDs to added objects."""
        db = AsyncMock()
        added_objects = []

        def track_add(obj):
            # Assign a UUID to the object if it has an id attribute
            if hasattr(obj, "id") and obj.id is None:
                obj.id = uuid4()
            added_objects.append(obj)

        db.add = MagicMock(side_effect=track_add)
        db.flush = AsyncMock()
        db.commit = AsyncMock()

        # Mock execute for queries
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [(uuid4(),) for _ in range(10)]
        mock_result.fetchone.return_value = (uuid4(),)
        db.execute = AsyncMock(return_value=mock_result)

        return db

    @pytest.mark.asyncio
    async def test_seed_all_calls_all_methods(self, mock_db_with_ids, mock_settings_can_seed):
        """Verify seed_all orchestrates all seeding methods."""
        seed_service = SeedService(mock_db_with_ids)

        result = await seed_service.seed_all()

        assert result["success"] is True
        assert "truncation" in result
        assert "users" in result
        assert "content" in result
        assert "statistics" in result
        assert "reviews" in result

    @pytest.mark.asyncio
    async def test_seed_all_commits_transaction(self, mock_db_with_ids, mock_settings_can_seed):
        """Verify seed_all commits the transaction."""
        seed_service = SeedService(mock_db_with_ids)

        await seed_service.seed_all()

        mock_db_with_ids.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_seed_all_creates_learner_progress(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """Verify seed_all creates progress for e2e_learner user."""
        seed_service = SeedService(mock_db_with_ids)

        result = await seed_service.seed_all()

        # Check that statistics were created
        assert result["statistics"]["success"] is True
        assert result["statistics"]["stats_created"] > 0

        # Check that reviews were created
        assert result["reviews"]["success"] is True
        assert result["reviews"]["reviews_created"] > 0


# ============================================================================
# Feedback Seeding Tests
# ============================================================================


class TestSeedServiceFeedback:
    """Tests for feedback seeding."""

    @pytest.fixture
    def mock_db_with_ids(self):
        """Create mock database that assigns IDs to added objects."""
        db = AsyncMock()

        def track_add(obj):
            # Assign a UUID to the object if it has an id attribute
            if hasattr(obj, "id") and obj.id is None:
                obj.id = uuid4()

        db.add = MagicMock(side_effect=track_add)
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.execute = AsyncMock()

        return db

    @pytest.mark.asyncio
    async def test_seed_feedback_blocked_in_production(
        self, seed_service, mock_settings_cannot_seed
    ):
        """seed_feedback should raise RuntimeError in production."""
        user_ids = [uuid4() for _ in range(4)]
        with pytest.raises(RuntimeError) as exc_info:
            await seed_service.seed_feedback(user_ids)

        assert "Database seeding not allowed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_creates_feedback_items(self, mock_db_with_ids, mock_settings_can_seed):
        """Verify 8 feedback items are created."""
        seed_service = SeedService(mock_db_with_ids)
        user_ids = [uuid4() for _ in range(4)]

        result = await seed_service.seed_feedback(user_ids)

        assert result["success"] is True
        assert len(result["feedback"]) == 8

    @pytest.mark.asyncio
    async def test_creates_feedback_with_both_categories(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """Verify feedback items include both feature requests and bug reports."""
        seed_service = SeedService(mock_db_with_ids)
        user_ids = [uuid4() for _ in range(4)]

        result = await seed_service.seed_feedback(user_ids)

        categories = [f["category"] for f in result["feedback"]]

        # Should have both categories
        assert FeedbackCategory.FEATURE_REQUEST.value in categories
        assert FeedbackCategory.BUG_INCORRECT_DATA.value in categories

        # Count by category: 5 feature requests, 3 bug reports
        feature_count = categories.count(FeedbackCategory.FEATURE_REQUEST.value)
        bug_count = categories.count(FeedbackCategory.BUG_INCORRECT_DATA.value)

        assert feature_count == 5
        assert bug_count == 3

    @pytest.mark.asyncio
    async def test_creates_feedback_with_various_statuses(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """Verify feedback items have various statuses."""
        seed_service = SeedService(mock_db_with_ids)
        user_ids = [uuid4() for _ in range(4)]

        result = await seed_service.seed_feedback(user_ids)

        statuses = [f["status"] for f in result["feedback"]]

        # Should have multiple different statuses
        unique_statuses = set(statuses)
        assert len(unique_statuses) >= 3  # At least NEW, PLANNED, IN_PROGRESS

    @pytest.mark.asyncio
    async def test_creates_votes_with_upvotes_and_downvotes(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """Verify votes include both upvotes and downvotes."""
        seed_service = SeedService(mock_db_with_ids)
        user_ids = [uuid4() for _ in range(4)]

        result = await seed_service.seed_feedback(user_ids)

        votes = result["votes"]
        vote_types = [v["type"] for v in votes]

        # Should have both upvotes and downvotes
        assert VoteType.UP.value in vote_types
        assert VoteType.DOWN.value in vote_types

        # Count by type
        upvote_count = vote_types.count(VoteType.UP.value)
        downvote_count = vote_types.count(VoteType.DOWN.value)

        # Should have more upvotes than downvotes
        assert upvote_count > downvote_count
        # Should have exactly 2 downvotes (gamification + card order bug)
        assert downvote_count == 2

    @pytest.mark.asyncio
    async def test_handles_insufficient_users(self, seed_service, mock_db, mock_settings_can_seed):
        """Verify handling of insufficient users."""
        # Less than 2 users should return empty result
        user_ids = [uuid4()]

        result = await seed_service.seed_feedback(user_ids)

        assert result["success"] is True
        assert result["feedback"] == []
        assert result["votes"] == []


# ============================================================================
# Notification Seeding Tests
# ============================================================================


class TestSeedServiceNotifications:
    """Tests for notification seeding."""

    @pytest.fixture
    def mock_db_with_ids(self):
        """Create mock database that assigns IDs to added objects."""
        db = AsyncMock()

        def track_add(obj):
            # Assign a UUID to the object if it has an id attribute
            if hasattr(obj, "id") and obj.id is None:
                obj.id = uuid4()

        db.add = MagicMock(side_effect=track_add)
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.execute = AsyncMock()

        return db

    @pytest.mark.asyncio
    async def test_seed_notifications_blocked_in_production(
        self, seed_service, mock_settings_cannot_seed
    ):
        """seed_notifications should raise RuntimeError in production."""
        with pytest.raises(RuntimeError) as exc_info:
            await seed_service.seed_notifications(uuid4())

        assert "Database seeding not allowed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_creates_five_notifications(self, mock_db_with_ids, mock_settings_can_seed):
        """Verify 5 notifications are created."""
        seed_service = SeedService(mock_db_with_ids)
        user_id = uuid4()

        result = await seed_service.seed_notifications(user_id)

        assert result["success"] is True
        assert result["notifications_created"] == 5

    @pytest.mark.asyncio
    async def test_creates_three_unread_notifications(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """Verify 3 unread notifications are created."""
        seed_service = SeedService(mock_db_with_ids)
        user_id = uuid4()

        result = await seed_service.seed_notifications(user_id)

        assert result["unread_count"] == 3

    @pytest.mark.asyncio
    async def test_creates_notifications_with_various_types(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """Verify notifications have various types."""
        seed_service = SeedService(mock_db_with_ids)

        # Track what types are added
        added_notifications = []
        original_add = mock_db_with_ids.add.side_effect

        def track_notifications(obj):
            original_add(obj)
            if hasattr(obj, "type") and hasattr(obj, "title") and hasattr(obj, "message"):
                added_notifications.append(obj)

        mock_db_with_ids.add = MagicMock(side_effect=track_notifications)

        user_id = uuid4()
        await seed_service.seed_notifications(user_id)

        # Verify we have different notification types
        types = [n.type for n in added_notifications]
        unique_types = set(types)

        # Should have at least 4 different types
        assert len(unique_types) >= 4

        # Verify specific expected types
        assert NotificationType.ACHIEVEMENT_UNLOCKED in types
        assert NotificationType.DAILY_GOAL_COMPLETE in types
        assert NotificationType.LEVEL_UP in types
        assert NotificationType.STREAK_AT_RISK in types
        assert NotificationType.WELCOME in types

    @pytest.mark.asyncio
    async def test_notifications_have_correct_read_status(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """Verify notifications have correct read/unread status."""
        seed_service = SeedService(mock_db_with_ids)

        # Track notifications
        added_notifications = []
        original_add = mock_db_with_ids.add.side_effect

        def track_notifications(obj):
            original_add(obj)
            if hasattr(obj, "type") and hasattr(obj, "title") and hasattr(obj, "read"):
                added_notifications.append(obj)

        mock_db_with_ids.add = MagicMock(side_effect=track_notifications)

        user_id = uuid4()
        await seed_service.seed_notifications(user_id)

        # Count read vs unread
        unread = [n for n in added_notifications if not n.read]
        read = [n for n in added_notifications if n.read]

        assert len(unread) == 3
        assert len(read) == 2

        # Verify read notifications have read_at set
        for n in read:
            assert n.read_at is not None

        # Verify unread notifications don't have read_at set
        for n in unread:
            assert n.read_at is None

    @pytest.mark.asyncio
    async def test_notifications_have_required_fields(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """Verify notifications have all required fields populated."""
        seed_service = SeedService(mock_db_with_ids)

        # Track notifications
        added_notifications = []
        original_add = mock_db_with_ids.add.side_effect

        def track_notifications(obj):
            original_add(obj)
            if hasattr(obj, "type") and hasattr(obj, "title") and hasattr(obj, "message"):
                added_notifications.append(obj)

        mock_db_with_ids.add = MagicMock(side_effect=track_notifications)

        user_id = uuid4()
        await seed_service.seed_notifications(user_id)

        for n in added_notifications:
            assert n.user_id == user_id
            assert n.title is not None and len(n.title) > 0
            assert n.message is not None and len(n.message) > 0
            assert n.icon is not None
            assert n.action_url is not None
            assert n.created_at is not None


# ============================================================================
# Culture Seeding Tests
# ============================================================================


class TestSeedServiceCulture:
    """Tests for culture deck and question seeding."""

    @pytest.fixture
    def mock_db_with_ids(self):
        """Create mock database that assigns IDs to added objects."""
        db = AsyncMock()

        def track_add(obj):
            # Assign a UUID to the object if it has an id attribute
            if hasattr(obj, "id") and obj.id is None:
                obj.id = uuid4()

        db.add = MagicMock(side_effect=track_add)
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.execute = AsyncMock()

        return db

    @pytest.mark.asyncio
    async def test_seed_culture_blocked_in_production(
        self, seed_service, mock_settings_cannot_seed
    ):
        """seed_culture_decks_and_questions should raise RuntimeError in production."""
        with pytest.raises(RuntimeError) as exc_info:
            await seed_service.seed_culture_decks_and_questions()

        assert "Database seeding not allowed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_seed_culture_statistics_blocked_in_production(
        self, seed_service, mock_settings_cannot_seed
    ):
        """seed_culture_question_statistics should raise RuntimeError in production."""
        with pytest.raises(RuntimeError) as exc_info:
            await seed_service.seed_culture_question_statistics(
                user_id=uuid4(), deck_id=uuid4(), progress_percent=50
            )

        assert "Database seeding not allowed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_creates_five_culture_decks(self, mock_db_with_ids, mock_settings_can_seed):
        """Verify 5 culture decks are created."""
        seed_service = SeedService(mock_db_with_ids)

        result = await seed_service.seed_culture_decks_and_questions()

        assert result["success"] is True
        assert len(result["decks"]) == 5

        # Check all categories
        categories = [d["category"] for d in result["decks"]]
        assert "history" in categories
        assert "geography" in categories
        assert "politics" in categories
        assert "culture" in categories
        assert "traditions" in categories

    @pytest.mark.asyncio
    async def test_each_culture_deck_has_ten_questions(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """Verify 10 questions per culture deck."""
        seed_service = SeedService(mock_db_with_ids)

        result = await seed_service.seed_culture_decks_and_questions()

        for deck in result["decks"]:
            assert deck["question_count"] == 10

        assert result["total_questions"] == 50  # 5 decks * 10 questions

    @pytest.mark.asyncio
    async def test_culture_questions_have_trilingual_content(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """Verify culture questions have el, en, ru translations."""
        seed_service = SeedService(mock_db_with_ids)

        # Track added questions
        added_questions = []
        original_add = mock_db_with_ids.add.side_effect

        def track_questions(obj):
            original_add(obj)
            if hasattr(obj, "question_text") and hasattr(obj, "option_a"):
                added_questions.append(obj)

        mock_db_with_ids.add = MagicMock(side_effect=track_questions)

        await seed_service.seed_culture_decks_and_questions()

        for q in added_questions:
            # Check question text has all 3 languages
            assert "el" in q.question_text
            assert "en" in q.question_text
            assert "ru" in q.question_text

            # Check options have all 3 languages
            for option in [q.option_a, q.option_b, q.option_c, q.option_d]:
                if option:  # option_d may be None
                    assert "el" in option
                    assert "en" in option
                    assert "ru" in option

    def test_culture_questions_constant_has_correct_structure(self, seed_service):
        """Verify CULTURE_QUESTIONS constant has correct structure."""
        # Check all categories exist
        for category in ["history", "geography", "politics", "culture", "traditions"]:
            assert category in SeedService.CULTURE_QUESTIONS

            questions = SeedService.CULTURE_QUESTIONS[category]
            assert len(questions) == 10

            for q_data in questions:
                # Check required fields
                assert "question_text" in q_data
                assert "options" in q_data
                assert "correct_option" in q_data

                # Check question has translations
                assert "el" in q_data["question_text"]
                assert "en" in q_data["question_text"]
                assert "ru" in q_data["question_text"]

                # Check options (answers) have translations
                assert len(q_data["options"]) >= 2  # At least 2 options
                for option in q_data["options"]:
                    assert "el" in option
                    assert "en" in option
                    assert "ru" in option

                # Check correct_option is valid (1-based index)
                assert 1 <= q_data["correct_option"] <= len(q_data["options"])

    def test_culture_decks_constant_has_correct_structure(self, seed_service):
        """Verify CULTURE_DECKS constant has correct structure."""
        assert len(SeedService.CULTURE_DECKS) == 5

        # CULTURE_DECKS is a dict with category as key
        for category, deck_data in SeedService.CULTURE_DECKS.items():
            assert category in ["history", "geography", "politics", "culture", "traditions"]
            assert "name" in deck_data
            assert "description" in deck_data

            # Name and description are now simple English strings (not multilingual dicts)
            assert isinstance(deck_data["name"], str)
            assert isinstance(deck_data["description"], str)
            assert len(deck_data["name"]) > 0
            assert len(deck_data["description"]) > 0


class TestSeedServiceCultureStatistics:
    """Tests for culture question statistics seeding."""

    @pytest.fixture
    def mock_db_with_ids(self):
        """Create mock database that assigns IDs and returns question IDs."""
        db = AsyncMock()

        def track_add(obj):
            # Assign a UUID to the object if it has an id attribute
            if hasattr(obj, "id") and obj.id is None:
                obj.id = uuid4()

        db.add = MagicMock(side_effect=track_add)
        db.flush = AsyncMock()
        db.commit = AsyncMock()

        # Mock execute for queries
        question_ids = [uuid4() for _ in range(10)]
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [(qid,) for qid in question_ids]
        db.execute = AsyncMock(return_value=mock_result)

        return db

    @pytest.mark.asyncio
    async def test_creates_statistics_for_all_questions(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """Verify statistics are created for each question in deck."""
        seed_service = SeedService(mock_db_with_ids)

        result = await seed_service.seed_culture_question_statistics(
            user_id=uuid4(), deck_id=uuid4(), progress_percent=50
        )

        assert result["success"] is True
        assert result["stats_created"] == 10

    @pytest.mark.asyncio
    async def test_progress_distribution_sixty_percent(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """Verify status distribution matches 60% progress."""
        seed_service = SeedService(mock_db_with_ids)

        result = await seed_service.seed_culture_question_statistics(
            user_id=uuid4(), deck_id=uuid4(), progress_percent=60
        )

        # 60% of 10 = 6 mastered
        assert result["mastered"] == 6
        # Up to 3 learning
        assert result["learning"] == 3
        # Remainder are new
        assert result["new"] == 1

    @pytest.mark.asyncio
    async def test_progress_distribution_eighty_percent(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """Verify status distribution matches 80% progress."""
        seed_service = SeedService(mock_db_with_ids)

        result = await seed_service.seed_culture_question_statistics(
            user_id=uuid4(), deck_id=uuid4(), progress_percent=80
        )

        # 80% of 10 = 8 mastered
        assert result["mastered"] == 8
        # Remaining 2 cards: up to 3 learning (but only 2 remaining)
        # Learning = min(3, 10 - 8) = min(3, 2) = 2
        assert result["learning"] == 2
        # Remainder = 10 - 8 - 2 = 0
        assert result["new"] == 0

    @pytest.mark.asyncio
    async def test_handles_empty_deck(self, mock_db_with_ids, mock_settings_can_seed):
        """Verify handling of deck with no questions."""
        # Override mock to return empty
        mock_result = MagicMock()
        mock_result.fetchall.return_value = []
        mock_db_with_ids.execute = AsyncMock(return_value=mock_result)

        seed_service = SeedService(mock_db_with_ids)

        result = await seed_service.seed_culture_question_statistics(
            user_id=uuid4(), deck_id=uuid4(), progress_percent=50
        )

        assert result["success"] is True
        assert result["stats_created"] == 0

    @pytest.mark.asyncio
    async def test_mastered_questions_have_high_stats(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """Verify mastered questions have appropriate SM-2 stats."""
        seed_service = SeedService(mock_db_with_ids)

        # Track added statistics
        added_stats = []
        original_add = mock_db_with_ids.add.side_effect

        def track_stats(obj):
            original_add(obj)
            if hasattr(obj, "times_correct") and hasattr(obj, "times_incorrect"):
                added_stats.append(obj)

        mock_db_with_ids.add = MagicMock(side_effect=track_stats)

        await seed_service.seed_culture_question_statistics(
            user_id=uuid4(), deck_id=uuid4(), progress_percent=100
        )

        # All should be mastered with high stats
        for stat in added_stats:
            # Mastered questions should have been reviewed multiple times
            assert stat.times_correct >= 3
            # Higher ease factor
            assert stat.ease_factor >= 2.5
            # Higher interval
            assert stat.interval >= 7


# ============================================================================
# User Deck Seeding Tests
# ============================================================================


class TestSeedServiceUserDecks:
    """Tests for user-owned deck seeding."""

    @pytest.fixture
    def mock_db_with_ids(self):
        """Create mock database that assigns IDs to added objects."""
        db = AsyncMock()

        def track_add(obj):
            # Assign a UUID to the object if it has an id attribute
            if hasattr(obj, "id") and obj.id is None:
                obj.id = uuid4()

        db.add = MagicMock(side_effect=track_add)
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.execute = AsyncMock()

        return db

    def test_user_decks_constant_has_correct_structure(self, seed_service):
        """Verify USER_DECKS constant has correct structure."""
        # Check expected users exist
        assert "e2e_learner@test.com" in SeedService.USER_DECKS
        assert "e2e_admin@test.com" in SeedService.USER_DECKS

        # e2e_learner should have 3 decks
        learner_decks = SeedService.USER_DECKS["e2e_learner@test.com"]
        assert len(learner_decks) == 3

        # Verify learner deck names and card counts
        learner_names = [d["name"] for d in learner_decks]
        assert "My Greek Basics" in learner_names
        assert "Travel Phrases" in learner_names
        assert "Practice Deck" in learner_names

        # Verify card counts for learner
        learner_card_counts = {d["name"]: d["card_count"] for d in learner_decks}
        assert learner_card_counts["My Greek Basics"] == 5
        assert learner_card_counts["Travel Phrases"] == 3
        assert learner_card_counts["Practice Deck"] == 0

        # e2e_admin should have 1 deck
        admin_decks = SeedService.USER_DECKS["e2e_admin@test.com"]
        assert len(admin_decks) == 1
        assert admin_decks[0]["name"] == "Admin's Personal Deck"
        assert admin_decks[0]["card_count"] == 2

    def test_user_decks_have_valid_levels(self, seed_service):
        """Verify all user deck levels are valid DeckLevel values."""
        for email, deck_configs in SeedService.USER_DECKS.items():
            for deck_config in deck_configs:
                assert "level" in deck_config
                assert deck_config["level"] in DeckLevel

    @pytest.mark.asyncio
    async def test_seed_user_decks_blocked_in_production(
        self, seed_service, mock_settings_cannot_seed
    ):
        """seed_user_decks should raise RuntimeError in production."""
        mock_users = [{"id": str(uuid4()), "email": "e2e_learner@test.com"}]
        with pytest.raises(RuntimeError) as exc_info:
            await seed_service.seed_user_decks(mock_users)

        assert "Database seeding not allowed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_creates_four_user_decks(self, mock_db_with_ids, mock_settings_can_seed):
        """Verify 4 user decks are created (3 for learner + 1 for admin)."""
        seed_service = SeedService(mock_db_with_ids)
        mock_users = [
            {"id": str(uuid4()), "email": "e2e_learner@test.com"},
            {"id": str(uuid4()), "email": "e2e_admin@test.com"},
            {"id": str(uuid4()), "email": "e2e_beginner@test.com"},
            {"id": str(uuid4()), "email": "e2e_advanced@test.com"},
        ]

        result = await seed_service.seed_user_decks(mock_users)

        assert result["success"] is True
        assert result["total_user_decks"] == 4
        # 5 + 3 + 0 + 2 = 10 cards total
        assert result["total_user_cards"] == 10

    @pytest.mark.asyncio
    async def test_decks_have_correct_owner_ids(self, mock_db_with_ids, mock_settings_can_seed):
        """Verify decks have correct owner_id set."""
        seed_service = SeedService(mock_db_with_ids)
        learner_id = uuid4()
        admin_id = uuid4()
        mock_users = [
            {"id": str(learner_id), "email": "e2e_learner@test.com"},
            {"id": str(admin_id), "email": "e2e_admin@test.com"},
        ]

        result = await seed_service.seed_user_decks(mock_users)

        # Check learner's decks have correct owner
        learner_decks = [d for d in result["decks"] if d["owner_email"] == "e2e_learner@test.com"]
        assert len(learner_decks) == 3
        for deck in learner_decks:
            assert deck["owner_id"] == str(learner_id)

        # Check admin's deck has correct owner
        admin_decks = [d for d in result["decks"] if d["owner_email"] == "e2e_admin@test.com"]
        assert len(admin_decks) == 1
        assert admin_decks[0]["owner_id"] == str(admin_id)

    @pytest.mark.asyncio
    async def test_skips_unknown_users(self, mock_db_with_ids, mock_settings_can_seed):
        """Verify skipping users not in USER_DECKS config."""
        seed_service = SeedService(mock_db_with_ids)
        # Only provide beginner user, who has no decks configured
        mock_users = [
            {"id": str(uuid4()), "email": "e2e_beginner@test.com"},
            {"id": str(uuid4()), "email": "unknown@test.com"},
        ]

        result = await seed_service.seed_user_decks(mock_users)

        assert result["success"] is True
        assert result["total_user_decks"] == 0
        assert result["total_user_cards"] == 0
        assert len(result["decks"]) == 0

    @pytest.mark.asyncio
    async def test_creates_cards_for_non_empty_decks(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """Verify cards are created only for decks with card_count > 0."""
        seed_service = SeedService(mock_db_with_ids)

        # Track added objects
        added_decks = []
        added_cards = []
        original_add = mock_db_with_ids.add.side_effect

        def track_objects(obj):
            original_add(obj)
            if hasattr(obj, "owner_id") and hasattr(obj, "name") and hasattr(obj, "level"):
                added_decks.append(obj)
            elif hasattr(obj, "deck_id") and hasattr(obj, "front_text"):
                added_cards.append(obj)

        mock_db_with_ids.add = MagicMock(side_effect=track_objects)

        mock_users = [
            {"id": str(uuid4()), "email": "e2e_learner@test.com"},
        ]

        await seed_service.seed_user_decks(mock_users)

        # Verify 3 decks created for learner
        assert len(added_decks) == 3

        # Verify card counts: 5 + 3 + 0 = 8 cards
        assert len(added_cards) == 8

        # Find the Practice Deck (which has 0 cards)
        practice_deck = next((d for d in added_decks if d.name == "Practice Deck"), None)
        assert practice_deck is not None

        # Verify no cards were created for Practice Deck
        practice_deck_cards = [c for c in added_cards if c.deck_id == practice_deck.id]
        assert len(practice_deck_cards) == 0

    @pytest.mark.asyncio
    async def test_user_decks_are_not_premium(self, mock_db_with_ids, mock_settings_can_seed):
        """Verify user decks have is_premium=False."""
        seed_service = SeedService(mock_db_with_ids)

        # Track added decks
        added_decks = []
        original_add = mock_db_with_ids.add.side_effect

        def track_decks(obj):
            original_add(obj)
            if hasattr(obj, "owner_id") and hasattr(obj, "is_premium"):
                added_decks.append(obj)

        mock_db_with_ids.add = MagicMock(side_effect=track_decks)

        mock_users = [
            {"id": str(uuid4()), "email": "e2e_learner@test.com"},
            {"id": str(uuid4()), "email": "e2e_admin@test.com"},
        ]

        await seed_service.seed_user_decks(mock_users)

        # All user decks should not be premium
        for deck in added_decks:
            assert deck.is_premium is False

    @pytest.mark.asyncio
    async def test_user_decks_are_active(self, mock_db_with_ids, mock_settings_can_seed):
        """Verify user decks have is_active=True."""
        seed_service = SeedService(mock_db_with_ids)

        # Track added decks
        added_decks = []
        original_add = mock_db_with_ids.add.side_effect

        def track_decks(obj):
            original_add(obj)
            if hasattr(obj, "owner_id") and hasattr(obj, "is_active"):
                added_decks.append(obj)

        mock_db_with_ids.add = MagicMock(side_effect=track_decks)

        mock_users = [
            {"id": str(uuid4()), "email": "e2e_learner@test.com"},
        ]

        await seed_service.seed_user_decks(mock_users)

        # All user decks should be active
        for deck in added_decks:
            assert deck.is_active is True

    @pytest.mark.asyncio
    async def test_cards_use_vocabulary_from_deck_level(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """Verify cards use vocabulary from the correct level."""
        seed_service = SeedService(mock_db_with_ids)

        # Track added cards
        added_cards = []
        original_add = mock_db_with_ids.add.side_effect

        def track_cards(obj):
            original_add(obj)
            if hasattr(obj, "front_text") and hasattr(obj, "back_text_en"):
                added_cards.append(obj)

        mock_db_with_ids.add = MagicMock(side_effect=track_cards)

        mock_users = [
            {"id": str(uuid4()), "email": "e2e_learner@test.com"},
        ]

        await seed_service.seed_user_decks(mock_users)

        # My Greek Basics uses A1 vocabulary (5 cards)
        a1_vocab = SeedService.VOCABULARY[DeckLevel.A1][:5]
        a1_front_texts = [v[0] for v in a1_vocab]

        # Travel Phrases uses A2 vocabulary (3 cards)
        a2_vocab = SeedService.VOCABULARY[DeckLevel.A2][:3]
        a2_front_texts = [v[0] for v in a2_vocab]

        # Verify all expected vocabulary items are in added cards
        card_front_texts = [c.front_text for c in added_cards]

        for text in a1_front_texts:
            assert text in card_front_texts, f"A1 word '{text}' not found in cards"

        for text in a2_front_texts:
            assert text in card_front_texts, f"A2 word '{text}' not found in cards"


# ============================================================================
# News Items Seeding Tests
# ============================================================================


class TestSeedServiceNewsItems:
    """Tests for news items seeding."""

    @pytest.fixture
    def mock_db_with_ids(self):
        """Create mock database that assigns IDs to added objects."""
        db = AsyncMock()

        def track_add(obj):
            if not hasattr(obj, "id") or obj.id is None:
                obj.id = uuid4()

        db.add = MagicMock(side_effect=track_add)
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.execute = AsyncMock()
        return db

    @pytest.mark.asyncio
    async def test_seed_news_items_blocked_in_production(
        self, seed_service, mock_settings_cannot_seed
    ):
        """seed_news_items should raise RuntimeError in production."""
        with pytest.raises(RuntimeError) as exc_info:
            await seed_service.seed_news_items()

        assert "Database seeding not allowed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_creates_five_news_items(self, mock_db_with_ids, mock_settings_can_seed):
        """seed_news_items should create exactly 5 news items."""
        seed_service = SeedService(mock_db_with_ids)

        result = await seed_service.seed_news_items()

        assert result["success"] is True
        assert result["count"] == 5
        assert len(result["news_items"]) == 5

    @pytest.mark.asyncio
    async def test_news_items_have_trilingual_titles(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """Verify news items have Greek, English, and Russian titles."""
        seed_service = SeedService(mock_db_with_ids)

        # Track added news items
        added_items = []
        original_add = mock_db_with_ids.add.side_effect

        def track_news(obj):
            original_add(obj)
            if hasattr(obj, "title_el") and hasattr(obj, "title_en") and hasattr(obj, "title_ru"):
                added_items.append(obj)

        mock_db_with_ids.add = MagicMock(side_effect=track_news)

        await seed_service.seed_news_items()

        # Verify each item has all three language titles
        for item in added_items:
            assert item.title_el is not None and len(item.title_el) > 0
            assert item.title_en is not None and len(item.title_en) > 0
            assert item.title_ru is not None and len(item.title_ru) > 0

    @pytest.mark.asyncio
    async def test_news_items_have_trilingual_descriptions(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """Verify news items have Greek, English, and Russian descriptions."""
        seed_service = SeedService(mock_db_with_ids)

        # Track added news items
        added_items = []
        original_add = mock_db_with_ids.add.side_effect

        def track_news(obj):
            original_add(obj)
            if hasattr(obj, "description_el") and hasattr(obj, "description_en"):
                added_items.append(obj)

        mock_db_with_ids.add = MagicMock(side_effect=track_news)

        await seed_service.seed_news_items()

        # Verify each item has all three language descriptions
        for item in added_items:
            assert item.description_el is not None and len(item.description_el) > 0
            assert item.description_en is not None and len(item.description_en) > 0
            assert item.description_ru is not None and len(item.description_ru) > 0

    @pytest.mark.asyncio
    async def test_news_items_have_valid_urls(self, mock_db_with_ids, mock_settings_can_seed):
        """Verify news items have valid original article URLs."""
        seed_service = SeedService(mock_db_with_ids)

        # Track added news items
        added_items = []
        original_add = mock_db_with_ids.add.side_effect

        def track_news(obj):
            original_add(obj)
            if hasattr(obj, "original_article_url"):
                added_items.append(obj)

        mock_db_with_ids.add = MagicMock(side_effect=track_news)

        await seed_service.seed_news_items()

        # Verify URLs start with https://
        for item in added_items:
            assert item.original_article_url.startswith("https://")

    @pytest.mark.asyncio
    async def test_news_items_have_s3_keys(self, mock_db_with_ids, mock_settings_can_seed):
        """Verify news items have S3 image keys."""
        seed_service = SeedService(mock_db_with_ids)

        # Track added news items
        added_items = []
        original_add = mock_db_with_ids.add.side_effect

        def track_news(obj):
            original_add(obj)
            if hasattr(obj, "image_s3_key"):
                added_items.append(obj)

        mock_db_with_ids.add = MagicMock(side_effect=track_news)

        await seed_service.seed_news_items()

        # Verify S3 keys are present and follow expected pattern
        for item in added_items:
            assert item.image_s3_key is not None
            assert item.image_s3_key.startswith("news/")
            assert item.image_s3_key.endswith(".jpg")

    @pytest.mark.asyncio
    async def test_news_items_constant_has_correct_structure(self, seed_service):
        """Verify NEWS_ITEMS constant has correct structure."""
        news_items = SeedService.NEWS_ITEMS

        assert len(news_items) == 5

        for item in news_items:
            assert "title_el" in item
            assert "title_en" in item
            assert "title_ru" in item
            assert "description_el" in item
            assert "description_en" in item
            assert "description_ru" in item
            assert "days_ago" in item
            assert isinstance(item["days_ago"], int)
            assert item["days_ago"] >= 0

    @pytest.mark.asyncio
    async def test_seed_news_items_deletes_existing_e2e_items_first(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """seed_news_items should delete existing E2E items before creating new ones (idempotency)."""
        seed_service = SeedService(mock_db_with_ids)

        await seed_service.seed_news_items()

        # Verify execute was called (for delete statement)
        mock_db_with_ids.execute.assert_called()

        # Get the delete call (should be first execute call)
        delete_call = mock_db_with_ids.execute.call_args_list[0]
        delete_stmt = delete_call[0][0]

        # Verify it's a delete statement targeting news items
        stmt_str = str(delete_stmt).upper()
        assert "DELETE" in stmt_str or hasattr(delete_stmt, "is_delete")
        assert "NEWS_ITEMS" in stmt_str
        # The LIKE clause is used to match e2e test articles
        assert "LIKE" in stmt_str
        assert "ORIGINAL_ARTICLE_URL" in stmt_str


# ============================================================================
# News Feed Page Seeding Tests
# ============================================================================


class TestSeedServiceNewsFeedPage:
    """Tests for news feed page seeding (25 items, 10 with questions)."""

    @pytest.fixture
    def mock_db_with_ids(self):
        """Create mock database that assigns IDs and simulates deck lookup."""
        db = AsyncMock()

        def track_add(obj):
            if not hasattr(obj, "id") or obj.id is None:
                obj.id = uuid4()

        db.add = MagicMock(side_effect=track_add)
        db.flush = AsyncMock()
        db.commit = AsyncMock()

        # Mock execute for deck lookup - return None to trigger deck creation
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        return db

    @pytest.mark.asyncio
    async def test_seed_news_feed_page_blocked_in_production(
        self, seed_service, mock_settings_cannot_seed
    ):
        """seed_news_feed_page should raise RuntimeError in production."""
        with pytest.raises(RuntimeError) as exc_info:
            await seed_service.seed_news_feed_page()

        assert "Database seeding not allowed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_creates_25_news_items(self, mock_db_with_ids, mock_settings_can_seed):
        """seed_news_feed_page should create exactly 25 news items."""
        seed_service = SeedService(mock_db_with_ids)

        result = await seed_service.seed_news_feed_page()

        assert result["success"] is True
        assert result["news_items_created"] == 25

    @pytest.mark.asyncio
    async def test_creates_10_items_with_questions(self, mock_db_with_ids, mock_settings_can_seed):
        """seed_news_feed_page should create 10 items with questions."""
        seed_service = SeedService(mock_db_with_ids)

        result = await seed_service.seed_news_feed_page()

        assert result["items_with_questions"] == 10
        assert result["items_without_questions"] == 15

    @pytest.mark.asyncio
    async def test_creates_correct_number_of_questions(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """seed_news_feed_page should create 39 questions total (3-5 per item)."""
        seed_service = SeedService(mock_db_with_ids)

        result = await seed_service.seed_news_feed_page()

        # Items 0-9 have questions: 3+4+5+3+4+5+3+4+5+3 = 39
        assert result["questions_created"] == 39

    @pytest.mark.asyncio
    async def test_news_items_have_greek_titles(self, mock_db_with_ids, mock_settings_can_seed):
        """News items should have Greek titles with Greek characters."""
        seed_service = SeedService(mock_db_with_ids)

        # Track added news items
        added_items = []
        original_add = mock_db_with_ids.add.side_effect

        def track_news(obj):
            original_add(obj)
            if hasattr(obj, "title_el") and hasattr(obj, "title_en") and hasattr(obj, "title_ru"):
                added_items.append(obj)

        mock_db_with_ids.add = MagicMock(side_effect=track_news)

        await seed_service.seed_news_feed_page()

        # Verify Greek titles have Greek characters
        for item in added_items:
            assert item.title_el is not None and len(item.title_el) > 0
            # Greek Unicode range: \u0370-\u03FF (basic) or \u1F00-\u1FFF (extended)
            assert any(
                "\u0370" <= char <= "\u03FF" or "\u1F00" <= char <= "\u1FFF"
                for char in item.title_el
            )

    @pytest.mark.asyncio
    async def test_news_items_have_trilingual_summaries(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """News items should have Greek, English, and Russian descriptions."""
        seed_service = SeedService(mock_db_with_ids)

        # Track added news items
        added_items = []
        original_add = mock_db_with_ids.add.side_effect

        def track_news(obj):
            original_add(obj)
            if hasattr(obj, "description_el"):
                added_items.append(obj)

        mock_db_with_ids.add = MagicMock(side_effect=track_news)

        await seed_service.seed_news_feed_page()

        for item in added_items:
            assert item.description_el is not None and len(item.description_el) > 0
            assert item.description_en is not None and len(item.description_en) > 0
            assert item.description_ru is not None and len(item.description_ru) > 0

    @pytest.mark.asyncio
    async def test_questions_linked_via_original_article_url(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """Questions should be linked to news items via original_article_url."""
        seed_service = SeedService(mock_db_with_ids)

        # Track added objects
        added_news = []
        added_questions = []
        original_add = mock_db_with_ids.add.side_effect

        def track_objects(obj):
            original_add(obj)
            if hasattr(obj, "title_el") and hasattr(obj, "original_article_url"):
                added_news.append(obj)
            elif hasattr(obj, "question_text") and hasattr(obj, "original_article_url"):
                added_questions.append(obj)

        mock_db_with_ids.add = MagicMock(side_effect=track_objects)

        await seed_service.seed_news_feed_page()

        # Get all news item URLs that should have questions (first 10)
        news_urls_with_questions = [
            item.original_article_url for i, item in enumerate(added_news) if i < 10
        ]

        # Verify all questions have URLs matching news items
        for question in added_questions:
            assert question.original_article_url in news_urls_with_questions

    @pytest.mark.asyncio
    async def test_deletes_existing_data_before_seeding(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """seed_news_feed_page should delete existing test data first (idempotency)."""
        seed_service = SeedService(mock_db_with_ids)

        await seed_service.seed_news_feed_page()

        # Verify execute was called for delete statements
        calls = mock_db_with_ids.execute.call_args_list

        # Should have at least 2 delete calls (questions first, then news items)
        delete_calls = [
            call
            for call in calls
            if "DELETE" in str(call[0][0]).upper() or hasattr(call[0][0], "is_delete")
        ]
        assert len(delete_calls) >= 2

    @pytest.mark.asyncio
    async def test_creates_culture_deck_if_not_exists(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """seed_news_feed_page should create E2E News Feed Page deck if not exists."""
        seed_service = SeedService(mock_db_with_ids)

        # Track added decks
        added_decks = []
        original_add = mock_db_with_ids.add.side_effect

        def track_decks(obj):
            original_add(obj)
            if hasattr(obj, "name") and hasattr(obj, "category") and hasattr(obj, "is_active"):
                added_decks.append(obj)

        mock_db_with_ids.add = MagicMock(side_effect=track_decks)

        result = await seed_service.seed_news_feed_page()

        # Verify deck was created
        assert len(added_decks) == 1
        assert added_decks[0].name == "E2E News Feed Page"
        assert "deck_id" in result

    @pytest.mark.asyncio
    async def test_returns_deck_id_in_results(self, mock_db_with_ids, mock_settings_can_seed):
        """seed_news_feed_page should return deck_id in results."""
        seed_service = SeedService(mock_db_with_ids)

        result = await seed_service.seed_news_feed_page()

        assert "deck_id" in result
        # UUID should be a valid string
        assert len(result["deck_id"]) > 0

    @pytest.mark.asyncio
    async def test_news_items_have_varied_publication_dates(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """News items should have publication dates spread across 25 days."""
        seed_service = SeedService(mock_db_with_ids)

        # Track added news items
        added_items = []
        original_add = mock_db_with_ids.add.side_effect

        def track_news(obj):
            original_add(obj)
            if hasattr(obj, "publication_date"):
                added_items.append(obj)

        mock_db_with_ids.add = MagicMock(side_effect=track_news)

        await seed_service.seed_news_feed_page()

        # Get unique dates
        dates = set(item.publication_date for item in added_items)
        # Should have at least 20 unique dates (25 items with 0-24 days ago)
        assert len(dates) >= 20

    @pytest.mark.asyncio
    async def test_news_items_have_e2e_urls(self, mock_db_with_ids, mock_settings_can_seed):
        """News items should have e2e-news-feed-page URLs for idempotency."""
        seed_service = SeedService(mock_db_with_ids)

        # Track added news items
        added_items = []
        original_add = mock_db_with_ids.add.side_effect

        def track_news(obj):
            original_add(obj)
            if hasattr(obj, "original_article_url") and hasattr(obj, "title_el"):
                added_items.append(obj)

        mock_db_with_ids.add = MagicMock(side_effect=track_news)

        await seed_service.seed_news_feed_page()

        # All URLs should follow the e2e-news-feed-page pattern
        for item in added_items:
            assert "e2e-news-feed-page" in item.original_article_url


# ============================================================================
# Changelog Seeding Tests
# ============================================================================


class TestSeedServiceChangelog:
    """Tests for changelog entries seeding."""

    @pytest.fixture
    def mock_db_with_ids(self):
        """Create mock database that assigns IDs to added objects."""
        db = AsyncMock()

        def track_add(obj):
            if not hasattr(obj, "id") or obj.id is None:
                obj.id = uuid4()

        db.add = MagicMock(side_effect=track_add)
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.execute = AsyncMock()
        return db

    @pytest.mark.asyncio
    async def test_creates_twelve_changelog_entries(self, mock_db_with_ids, mock_settings_can_seed):
        """seed_changelog_entries should create exactly 12 entries."""
        seed_service = SeedService(mock_db_with_ids)

        result = await seed_service.seed_changelog_entries()

        assert result["success"] is True
        assert result["entries_created"] == 12

    @pytest.mark.asyncio
    async def test_creates_four_entries_per_tag_type(
        self, mock_db_with_ids, mock_settings_can_seed
    ):
        """seed_changelog_entries should create 4 entries per tag type."""
        seed_service = SeedService(mock_db_with_ids)

        result = await seed_service.seed_changelog_entries()

        assert result["by_tag"]["new_feature"] == 4
        assert result["by_tag"]["bug_fix"] == 4
        assert result["by_tag"]["announcement"] == 4

    @pytest.mark.asyncio
    async def test_entries_have_varied_dates(self, mock_db_with_ids, mock_settings_can_seed):
        """Entries should have created_at dates spread over ~25 days."""
        from src.db.models import ChangelogEntry

        seed_service = SeedService(mock_db_with_ids)

        # Track added entries
        added_entries = []
        original_add = mock_db_with_ids.add.side_effect

        def track_entries(obj):
            original_add(obj)
            if isinstance(obj, ChangelogEntry):
                added_entries.append(obj)

        mock_db_with_ids.add = MagicMock(side_effect=track_entries)

        await seed_service.seed_changelog_entries()

        # Get unique dates
        dates = set(entry.created_at.date() for entry in added_entries)
        # Expected days_ago: 1,5,10,15,3,8,12,20,2,7,14,25 = 12 unique values
        assert len(dates) == 12

    @pytest.mark.asyncio
    async def test_entries_have_markdown_content(self, mock_db_with_ids, mock_settings_can_seed):
        """Entries should have markdown formatting in content fields."""
        from src.db.models import ChangelogEntry

        seed_service = SeedService(mock_db_with_ids)

        # Track added entries
        added_entries = []
        original_add = mock_db_with_ids.add.side_effect

        def track_entries(obj):
            original_add(obj)
            if isinstance(obj, ChangelogEntry):
                added_entries.append(obj)

        mock_db_with_ids.add = MagicMock(side_effect=track_entries)

        await seed_service.seed_changelog_entries()

        # Count entries with markdown
        entries_with_bold = 0
        entries_with_italic = 0

        for entry in added_entries:
            if "**" in entry.content_en:
                entries_with_bold += 1
            if "*" in entry.content_en and "**" not in entry.content_en.replace("**", ""):
                entries_with_italic += 1

        # At least some entries should have bold formatting
        assert entries_with_bold >= 3, "Expected at least 3 entries with **bold** formatting"

    @pytest.mark.asyncio
    async def test_entries_have_trilingual_content(self, mock_db_with_ids, mock_settings_can_seed):
        """Entries should have English, Greek, and Russian content."""
        from src.db.models import ChangelogEntry

        seed_service = SeedService(mock_db_with_ids)

        # Track added entries
        added_entries = []
        original_add = mock_db_with_ids.add.side_effect

        def track_entries(obj):
            original_add(obj)
            if isinstance(obj, ChangelogEntry):
                added_entries.append(obj)

        mock_db_with_ids.add = MagicMock(side_effect=track_entries)

        await seed_service.seed_changelog_entries()

        for entry in added_entries:
            # Check all 3 languages have content
            assert entry.title_en and len(entry.title_en) > 0
            assert entry.title_el and len(entry.title_el) > 0
            assert entry.title_ru and len(entry.title_ru) > 0
            assert entry.content_en and len(entry.content_en) > 0
            assert entry.content_el and len(entry.content_el) > 0
            assert entry.content_ru and len(entry.content_ru) > 0

    @pytest.mark.asyncio
    async def test_entries_have_valid_tags(self, mock_db_with_ids, mock_settings_can_seed):
        """Entries should have valid ChangelogTag values."""
        from src.db.models import ChangelogEntry, ChangelogTag

        seed_service = SeedService(mock_db_with_ids)

        # Track added entries
        added_entries = []
        original_add = mock_db_with_ids.add.side_effect

        def track_entries(obj):
            original_add(obj)
            if isinstance(obj, ChangelogEntry):
                added_entries.append(obj)

        mock_db_with_ids.add = MagicMock(side_effect=track_entries)

        await seed_service.seed_changelog_entries()

        # All entries should have valid tags
        for entry in added_entries:
            assert entry.tag in [
                ChangelogTag.NEW_FEATURE,
                ChangelogTag.BUG_FIX,
                ChangelogTag.ANNOUNCEMENT,
            ]

        # Count by tag
        tag_counts = {}
        for entry in added_entries:
            tag_counts[entry.tag] = tag_counts.get(entry.tag, 0) + 1

        assert tag_counts[ChangelogTag.NEW_FEATURE] == 4
        assert tag_counts[ChangelogTag.BUG_FIX] == 4
        assert tag_counts[ChangelogTag.ANNOUNCEMENT] == 4

    def test_truncation_order_includes_changelog_entries(self):
        """TRUNCATION_ORDER should include changelog_entries table."""
        assert "changelog_entries" in SeedService.TRUNCATION_ORDER
