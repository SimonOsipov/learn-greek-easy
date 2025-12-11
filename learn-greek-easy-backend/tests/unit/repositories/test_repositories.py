"""Comprehensive unit tests for all repository classes."""

from datetime import date, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import NotFoundException
from src.db.models import CardDifficulty, CardStatus, DeckLevel, User
from src.repositories import (
    CardRepository,
    CardStatisticsRepository,
    DeckRepository,
    RefreshTokenRepository,
    ReviewRepository,
    UserDeckProgressRepository,
    UserRepository,
    UserSettingsRepository,
)
from src.schemas.user import UserCreate

# ============================================================================
# BaseRepository Tests (via UserRepository)
# ============================================================================


@pytest.mark.asyncio
async def test_get_existing_record(db_session: AsyncSession, sample_user):
    """Test getting an existing record by ID."""
    repo = UserRepository(db_session)
    user = await repo.get(sample_user.id)

    assert user is not None
    assert user.id == sample_user.id
    assert user.email == sample_user.email


@pytest.mark.asyncio
async def test_get_nonexistent_record(db_session: AsyncSession):
    """Test getting a non-existent record returns None."""
    repo = UserRepository(db_session)
    user = await repo.get(uuid4())

    assert user is None


@pytest.mark.asyncio
async def test_get_or_404_existing(db_session: AsyncSession, sample_user):
    """Test get_or_404 with existing record."""
    repo = UserRepository(db_session)
    user = await repo.get_or_404(sample_user.id)

    assert user is not None
    assert user.id == sample_user.id


@pytest.mark.asyncio
async def test_get_or_404_nonexistent(db_session: AsyncSession):
    """Test get_or_404 raises NotFoundException for missing record."""
    repo = UserRepository(db_session)

    with pytest.raises(NotFoundException) as exc_info:
        await repo.get_or_404(uuid4())

    assert "User" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_list_with_pagination(db_session: AsyncSession):
    """Test listing records with pagination."""
    repo = UserRepository(db_session)

    # Create multiple users
    for i in range(5):
        user = User(
            email=f"user{i}@example.com",
            password_hash="hashed",
            full_name=f"User {i}",
        )
        db_session.add(user)
    await db_session.commit()

    # Test pagination
    users_page1 = await repo.list(skip=0, limit=2)
    users_page2 = await repo.list(skip=2, limit=2)

    assert len(users_page1) == 2
    assert len(users_page2) == 2
    assert users_page1[0].id != users_page2[0].id


@pytest.mark.asyncio
async def test_count(db_session: AsyncSession, sample_user):
    """Test counting total records."""
    repo = UserRepository(db_session)
    count = await repo.count()

    assert count >= 1


@pytest.mark.asyncio
async def test_filter_by(db_session: AsyncSession):
    """Test filtering records by field values."""
    repo = UserRepository(db_session)

    # Create users with different email verification status
    verified_user = User(
        email="verified@example.com",
        password_hash="hashed",
        full_name="Verified User",
        email_verified_at=datetime.utcnow(),
    )
    unverified_user = User(
        email="unverified@example.com",
        password_hash="hashed",
        full_name="Unverified User",
    )
    db_session.add(verified_user)
    db_session.add(unverified_user)
    await db_session.commit()

    # Filter by is_active
    active_users = await repo.filter_by(is_active=True)

    assert len(active_users) >= 2


@pytest.mark.asyncio
async def test_exists(db_session: AsyncSession, sample_user):
    """Test checking if record exists."""
    repo = UserRepository(db_session)

    exists = await repo.exists(email=sample_user.email)
    not_exists = await repo.exists(email="nonexistent@example.com")

    assert exists is True
    assert not_exists is False


# ============================================================================
# UserRepository Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_by_email(db_session: AsyncSession, sample_user):
    """Test getting user by email address."""
    repo = UserRepository(db_session)
    user = await repo.get_by_email(sample_user.email)

    assert user is not None
    assert user.email == sample_user.email


@pytest.mark.asyncio
async def test_get_by_email_not_found(db_session: AsyncSession):
    """Test getting non-existent user by email returns None."""
    repo = UserRepository(db_session)
    user = await repo.get_by_email("notfound@example.com")

    assert user is None


@pytest.mark.asyncio
async def test_get_by_google_id(db_session: AsyncSession):
    """Test getting user by Google OAuth ID."""
    repo = UserRepository(db_session)

    # Create user with Google ID
    google_user = User(
        email="google@example.com",
        password_hash="",
        full_name="Google User",
        google_id="google_oauth_123",
    )
    db_session.add(google_user)
    await db_session.commit()

    # Find by Google ID
    user = await repo.get_by_google_id("google_oauth_123")

    assert user is not None
    assert user.google_id == "google_oauth_123"


@pytest.mark.asyncio
async def test_create_with_settings(db_session: AsyncSession):
    """Test creating user with default settings."""
    repo = UserRepository(db_session)

    user_in = UserCreate(
        email="newuser@example.com",
        password="Password123",
        full_name="New User",
    )

    user = await repo.create_with_settings(user_in, "hashed_password_123")
    await db_session.commit()
    await db_session.refresh(user)

    assert user.email == "newuser@example.com"
    assert user.password_hash == "hashed_password_123"

    # Check settings were created
    settings_repo = UserSettingsRepository(db_session)
    settings = await settings_repo.get_by_user_id(user.id)

    assert settings is not None
    assert settings.daily_goal == 20
    assert settings.email_notifications is True


@pytest.mark.asyncio
async def test_get_with_settings(db_session: AsyncSession, sample_user_with_settings):
    """Test getting user with settings eagerly loaded."""
    repo = UserRepository(db_session)
    user = await repo.get_with_settings(sample_user_with_settings.id)

    assert user is not None
    assert user.settings is not None
    assert user.settings.daily_goal == 25


@pytest.mark.asyncio
async def test_verify_email(db_session: AsyncSession, sample_user):
    """Test marking user email as verified."""
    repo = UserRepository(db_session)

    assert sample_user.email_verified_at is None

    user = await repo.verify_email(sample_user.id)
    await db_session.commit()

    assert user.email_verified_at is not None


@pytest.mark.asyncio
async def test_deactivate(db_session: AsyncSession, sample_user):
    """Test deactivating user account."""
    repo = UserRepository(db_session)

    assert sample_user.is_active is True

    user = await repo.deactivate(sample_user.id)
    await db_session.commit()

    assert user.is_active is False


# ============================================================================
# RefreshTokenRepository Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_by_token(db_session: AsyncSession, sample_refresh_token):
    """Test getting refresh token by token string."""
    repo = RefreshTokenRepository(db_session)
    token = await repo.get_by_token(sample_refresh_token.token)

    assert token is not None
    assert token.token == sample_refresh_token.token
    assert token.user is not None


@pytest.mark.asyncio
async def test_delete_expired(db_session: AsyncSession, sample_user):
    """Test deleting expired refresh tokens."""
    repo = RefreshTokenRepository(db_session)

    # Create expired and valid tokens
    from src.db.models import RefreshToken

    expired_token = RefreshToken(
        user_id=sample_user.id,
        token="expired_token",
        expires_at=datetime.utcnow() - timedelta(days=1),
    )
    valid_token = RefreshToken(
        user_id=sample_user.id,
        token="valid_token",
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db_session.add(expired_token)
    db_session.add(valid_token)
    await db_session.commit()

    # Delete expired
    deleted_count = await repo.delete_expired()
    await db_session.commit()

    assert deleted_count >= 1

    # Verify expired token is gone
    token = await repo.get_by_token("expired_token")
    assert token is None

    # Verify valid token still exists
    token = await repo.get_by_token("valid_token")
    assert token is not None


@pytest.mark.asyncio
async def test_delete_user_tokens(db_session: AsyncSession, sample_user, sample_refresh_token):
    """Test deleting all tokens for a user."""
    repo = RefreshTokenRepository(db_session)

    deleted_count = await repo.delete_user_tokens(sample_user.id)
    await db_session.commit()

    assert deleted_count >= 1


# ============================================================================
# DeckRepository Tests
# ============================================================================


@pytest.mark.asyncio
async def test_list_active_decks(db_session: AsyncSession, sample_deck):
    """Test listing active decks."""
    repo = DeckRepository(db_session)

    # Create inactive deck
    from src.db.models import Deck

    inactive_deck = Deck(
        name="Inactive Deck",
        description="This deck is inactive",
        level=DeckLevel.A1,
        is_active=False,
    )
    db_session.add(inactive_deck)
    await db_session.commit()

    # List active decks
    active_decks = await repo.list_active(skip=0, limit=10)

    assert len(active_decks) >= 1
    assert all(deck.is_active for deck in active_decks)


@pytest.mark.asyncio
async def test_list_active_with_level_filter(db_session: AsyncSession):
    """Test filtering active decks by level."""
    repo = DeckRepository(db_session)

    # Create decks with different levels
    from src.db.models import Deck

    a1_deck = Deck(
        name="A1 Deck",
        description="Beginner",
        level=DeckLevel.A1,
        is_active=True,
    )
    b1_deck = Deck(
        name="B1 Deck",
        description="Intermediate",
        level=DeckLevel.B1,
        is_active=True,
    )
    db_session.add(a1_deck)
    db_session.add(b1_deck)
    await db_session.commit()

    # Filter by level
    a1_decks = await repo.list_active(level=DeckLevel.A1)

    assert len(a1_decks) >= 1
    assert all(deck.level == DeckLevel.A1 for deck in a1_decks)


@pytest.mark.asyncio
async def test_get_with_cards(db_session: AsyncSession, sample_deck, sample_cards):
    """Test getting deck with cards eagerly loaded."""
    repo = DeckRepository(db_session)
    deck = await repo.get_with_cards(sample_deck.id)

    assert deck is not None
    assert len(deck.cards) == 3


@pytest.mark.asyncio
async def test_count_cards(db_session: AsyncSession, sample_deck, sample_cards):
    """Test counting cards in a deck."""
    repo = DeckRepository(db_session)
    count = await repo.count_cards(sample_deck.id)

    assert count == 3


@pytest.mark.asyncio
async def test_search_decks(db_session: AsyncSession):
    """Test searching decks by name or description."""
    repo = DeckRepository(db_session)

    from src.db.models import Deck

    # Create searchable decks
    deck1 = Deck(
        name="Greek for Beginners",
        description="Learn basic Greek",
        level=DeckLevel.A1,
        is_active=True,
    )
    deck2 = Deck(
        name="Advanced Vocabulary",
        description="Greek advanced words",
        level=DeckLevel.C1,
        is_active=True,
    )
    db_session.add(deck1)
    db_session.add(deck2)
    await db_session.commit()

    # Search by name
    results = await repo.search("Greek")
    assert len(results) >= 2

    # Search by description
    results = await repo.search("advanced")
    assert len(results) >= 1


# ============================================================================
# CardRepository Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_by_deck(db_session: AsyncSession, sample_deck, sample_cards):
    """Test getting all cards for a deck."""
    repo = CardRepository(db_session)
    cards = await repo.get_by_deck(sample_deck.id)

    assert len(cards) == 3
    # Verify order
    assert cards[0].order_index == 1
    assert cards[1].order_index == 2
    assert cards[2].order_index == 3


@pytest.mark.asyncio
async def test_get_by_difficulty(db_session: AsyncSession, sample_deck, sample_cards):
    """Test filtering cards by difficulty."""
    repo = CardRepository(db_session)
    easy_cards = await repo.get_by_difficulty(sample_deck.id, CardDifficulty.EASY)

    assert len(easy_cards) == 2
    assert all(card.difficulty == CardDifficulty.EASY for card in easy_cards)


@pytest.mark.asyncio
async def test_bulk_create(db_session: AsyncSession, sample_deck):
    """Test bulk creating multiple cards."""
    repo = CardRepository(db_session)

    cards_data = [
        {
            "deck_id": sample_deck.id,
            "front_text": f"Card {i}",
            "back_text": f"Karta {i}",
            "pronunciation": f"Pronunciation {i}",
            "difficulty": CardDifficulty.EASY,
            "order_index": i,
        }
        for i in range(5)
    ]

    cards = await repo.bulk_create(cards_data)
    await db_session.commit()

    assert len(cards) == 5


# ============================================================================
# UserDeckProgressRepository Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_or_create_existing_progress(db_session: AsyncSession, sample_progress):
    """Test get_or_create returns existing progress."""
    repo = UserDeckProgressRepository(db_session)
    progress = await repo.get_or_create(sample_progress.user_id, sample_progress.deck_id)

    assert progress.id == sample_progress.id
    assert progress.cards_studied == 5


@pytest.mark.asyncio
async def test_get_or_create_new_progress(db_session: AsyncSession, sample_user, sample_deck):
    """Test get_or_create creates new progress if not exists."""
    repo = UserDeckProgressRepository(db_session)

    # Create new deck
    from src.db.models import Deck

    new_deck = Deck(
        name="New Deck",
        description="Brand new",
        level=DeckLevel.A1,
        is_active=True,
    )
    db_session.add(new_deck)
    await db_session.commit()
    await db_session.refresh(new_deck)

    progress = await repo.get_or_create(sample_user.id, new_deck.id)
    await db_session.commit()

    assert progress.cards_studied == 0
    assert progress.cards_mastered == 0


@pytest.mark.asyncio
async def test_get_user_progress(db_session: AsyncSession, sample_progress):
    """Test getting all progress for a user."""
    repo = UserDeckProgressRepository(db_session)
    progress_list = await repo.get_user_progress(sample_progress.user_id)

    assert len(progress_list) >= 1
    assert progress_list[0].deck is not None


@pytest.mark.asyncio
async def test_update_progress_metrics(db_session: AsyncSession, sample_progress):
    """Test updating progress metrics."""
    repo = UserDeckProgressRepository(db_session)

    initial_studied = sample_progress.cards_studied
    initial_mastered = sample_progress.cards_mastered

    progress = await repo.update_progress_metrics(
        sample_progress.id,
        cards_studied_delta=3,
        cards_mastered_delta=1,
    )
    await db_session.commit()

    assert progress.cards_studied == initial_studied + 3
    assert progress.cards_mastered == initial_mastered + 1
    assert progress.last_studied_at is not None


# ============================================================================
# CardStatisticsRepository Tests
# ============================================================================


@pytest.mark.asyncio
async def test_card_stats_get_or_create_existing(db_session: AsyncSession, sample_card_statistics):
    """Test get_or_create returns existing statistics."""
    repo = CardStatisticsRepository(db_session)
    stats = await repo.get_or_create(
        sample_card_statistics.user_id,
        sample_card_statistics.card_id,
    )

    assert stats.id == sample_card_statistics.id


@pytest.mark.asyncio
async def test_card_stats_get_or_create_new(db_session: AsyncSession, sample_user, sample_cards):
    """Test get_or_create creates new statistics."""
    repo = CardStatisticsRepository(db_session)
    stats = await repo.get_or_create(sample_user.id, sample_cards[1].id)
    await db_session.commit()

    assert stats.easiness_factor == 2.5
    assert stats.status == CardStatus.NEW


@pytest.mark.asyncio
async def test_get_due_cards(db_session: AsyncSession, sample_user, sample_deck, sample_cards):
    """Test getting cards due for review."""
    repo = CardStatisticsRepository(db_session)

    # Create statistics for cards with different due dates
    from src.db.models import CardStatistics

    # Due today
    stat1 = CardStatistics(
        user_id=sample_user.id,
        card_id=sample_cards[0].id,
        easiness_factor=2.5,
        interval=1,
        repetitions=1,
        next_review_date=date.today(),
        status=CardStatus.LEARNING,
    )
    # Due tomorrow
    stat2 = CardStatistics(
        user_id=sample_user.id,
        card_id=sample_cards[1].id,
        easiness_factor=2.5,
        interval=1,
        repetitions=1,
        next_review_date=date.today() + timedelta(days=1),
        status=CardStatus.REVIEW,
    )
    db_session.add(stat1)
    db_session.add(stat2)
    await db_session.commit()

    due_stats = await repo.get_due_cards(sample_user.id, deck_id=sample_deck.id)

    assert len(due_stats) >= 1
    assert all(stat.next_review_date <= date.today() for stat in due_stats)


@pytest.mark.asyncio
async def test_get_by_status(db_session: AsyncSession, sample_user, sample_card_statistics):
    """Test filtering cards by status."""
    repo = CardStatisticsRepository(db_session)
    learning_cards = await repo.get_by_status(sample_user.id, CardStatus.LEARNING)

    assert len(learning_cards) >= 1
    assert all(stat.status == CardStatus.LEARNING for stat in learning_cards)


@pytest.mark.asyncio
async def test_update_sm2_data(db_session: AsyncSession, sample_card_statistics):
    """Test updating SM-2 algorithm data."""
    repo = CardStatisticsRepository(db_session)

    new_date = date.today() + timedelta(days=3)
    stats = await repo.update_sm2_data(
        sample_card_statistics.id,
        easiness_factor=2.6,
        interval=3,
        repetitions=2,
        next_review_date=new_date,
        status=CardStatus.REVIEW,
    )
    await db_session.commit()

    assert stats.easiness_factor == 2.6
    assert stats.interval == 3
    assert stats.repetitions == 2
    assert stats.next_review_date == new_date
    assert stats.status == CardStatus.REVIEW


# ============================================================================
# ReviewRepository Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_user_reviews(db_session: AsyncSession, sample_review):
    """Test getting user's review history."""
    repo = ReviewRepository(db_session)
    reviews = await repo.get_user_reviews(sample_review.user_id)

    assert len(reviews) >= 1
    assert reviews[0].user_id == sample_review.user_id


@pytest.mark.asyncio
async def test_get_user_reviews_with_date_filter(
    db_session: AsyncSession, sample_user, sample_cards
):
    """Test filtering reviews by date range."""
    repo = ReviewRepository(db_session)

    # Create reviews on different dates
    from src.db.models import Review

    old_review = Review(
        user_id=sample_user.id,
        card_id=sample_cards[0].id,
        quality=4,
        time_taken=5,
        reviewed_at=datetime.utcnow() - timedelta(days=10),
    )
    recent_review = Review(
        user_id=sample_user.id,
        card_id=sample_cards[1].id,
        quality=5,
        time_taken=3,
        reviewed_at=datetime.utcnow(),
    )
    db_session.add(old_review)
    db_session.add(recent_review)
    await db_session.commit()

    # Filter by date
    start_date = date.today() - timedelta(days=5)
    reviews = await repo.get_user_reviews(sample_user.id, start_date=start_date)

    assert len(reviews) >= 1


@pytest.mark.asyncio
async def test_count_reviews_today(db_session: AsyncSession, sample_user, sample_cards):
    """Test counting reviews completed today."""
    repo = ReviewRepository(db_session)

    # Create review today
    from src.db.models import Review

    review = Review(
        user_id=sample_user.id,
        card_id=sample_cards[0].id,
        quality=4,
        time_taken=5,
        reviewed_at=datetime.utcnow(),
    )
    db_session.add(review)
    await db_session.commit()

    count = await repo.count_reviews_today(sample_user.id)

    assert count >= 1


@pytest.mark.asyncio
async def test_get_streak(db_session: AsyncSession, sample_user, sample_cards):
    """Test calculating study streak."""
    repo = ReviewRepository(db_session)

    # Create reviews on consecutive days
    from src.db.models import Review

    for i in range(3):
        review = Review(
            user_id=sample_user.id,
            card_id=sample_cards[0].id,
            quality=4,
            time_taken=5,
            reviewed_at=datetime.combine(
                date.today() - timedelta(days=i),
                datetime.min.time(),
            )
            + timedelta(hours=10),
        )
        db_session.add(review)
    await db_session.commit()

    streak = await repo.get_streak(sample_user.id)

    assert streak >= 1


@pytest.mark.asyncio
async def test_get_average_quality(db_session: AsyncSession, sample_user, sample_cards):
    """Test calculating average review quality."""
    repo = ReviewRepository(db_session)

    # Create reviews with different quality ratings
    from src.db.models import Review

    for quality in [3, 4, 5]:
        review = Review(
            user_id=sample_user.id,
            card_id=sample_cards[0].id,
            quality=quality,
            time_taken=5,
            reviewed_at=datetime.utcnow(),
        )
        db_session.add(review)
    await db_session.commit()

    avg_quality = await repo.get_average_quality(sample_user.id, days=7)

    assert avg_quality >= 3.0
    assert avg_quality <= 5.0


# ============================================================================
# CardStatisticsRepository - New SM-2 Methods Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_new_cards_for_deck(
    db_session: AsyncSession, sample_user, sample_deck, sample_cards
):
    """Test getting cards that user hasn't studied yet."""
    repo = CardStatisticsRepository(db_session)

    # Create statistics for only one card
    from src.db.models import CardStatistics

    stats = CardStatistics(
        user_id=sample_user.id,
        card_id=sample_cards[0].id,
        easiness_factor=2.5,
        interval=0,
        repetitions=0,
        next_review_date=date.today(),
        status=CardStatus.NEW,
    )
    db_session.add(stats)
    await db_session.commit()

    # Get new cards - should exclude the one with statistics
    new_cards = await repo.get_new_cards_for_deck(sample_user.id, sample_deck.id)

    assert len(new_cards) == 2  # 3 cards - 1 with stats = 2 new cards
    assert sample_cards[0].id not in [c.id for c in new_cards]
    assert sample_cards[1].id in [c.id for c in new_cards]
    assert sample_cards[2].id in [c.id for c in new_cards]


@pytest.mark.asyncio
async def test_get_new_cards_for_deck_with_limit(
    db_session: AsyncSession, sample_user, sample_deck, sample_cards
):
    """Test get_new_cards_for_deck respects limit parameter."""
    repo = CardStatisticsRepository(db_session)

    # Get only 1 new card
    new_cards = await repo.get_new_cards_for_deck(sample_user.id, sample_deck.id, limit=1)

    assert len(new_cards) == 1


@pytest.mark.asyncio
async def test_get_new_cards_for_deck_no_deck_filter(
    db_session: AsyncSession, sample_user, sample_deck
):
    """Test get_new_cards_for_deck without deck filter returns all unstudied cards."""
    repo = CardStatisticsRepository(db_session)

    # Create another deck with cards
    from src.db.models import Card, Deck

    another_deck = Deck(
        name="Another Deck",
        description="Test",
        level=DeckLevel.A2,
        is_active=True,
    )
    db_session.add(another_deck)
    await db_session.flush()

    card = Card(
        deck_id=another_deck.id,
        front_text="Test",
        back_text="Test",
        difficulty=CardDifficulty.EASY,
        order_index=1,
    )
    db_session.add(card)
    await db_session.commit()

    # Get all new cards (no deck filter)
    new_cards = await repo.get_new_cards_for_deck(sample_user.id, deck_id=None, limit=100)

    # Should include cards from both decks
    assert len(new_cards) >= 1


@pytest.mark.asyncio
async def test_count_new_cards_for_deck(
    db_session: AsyncSession, sample_user, sample_deck, sample_cards
):
    """Test counting unstudied cards in a deck."""
    repo = CardStatisticsRepository(db_session)

    # Create statistics for one card
    from src.db.models import CardStatistics

    stats = CardStatistics(
        user_id=sample_user.id,
        card_id=sample_cards[0].id,
        easiness_factor=2.5,
        interval=0,
        repetitions=0,
        next_review_date=date.today(),
        status=CardStatus.NEW,
    )
    db_session.add(stats)
    await db_session.commit()

    count = await repo.count_new_cards_for_deck(sample_user.id, sample_deck.id)

    assert count == 2  # 3 cards - 1 with stats = 2 new cards


@pytest.mark.asyncio
async def test_count_by_status(db_session: AsyncSession, sample_user, sample_deck, sample_cards):
    """Test counting cards by status."""
    repo = CardStatisticsRepository(db_session)

    # Create statistics with different statuses
    from src.db.models import CardStatistics

    stats1 = CardStatistics(
        user_id=sample_user.id,
        card_id=sample_cards[0].id,
        easiness_factor=2.5,
        interval=0,
        repetitions=0,
        next_review_date=date.today(),
        status=CardStatus.NEW,
    )
    stats2 = CardStatistics(
        user_id=sample_user.id,
        card_id=sample_cards[1].id,
        easiness_factor=2.5,
        interval=1,
        repetitions=1,
        next_review_date=date.today(),  # Due today
        status=CardStatus.LEARNING,
    )
    stats3 = CardStatistics(
        user_id=sample_user.id,
        card_id=sample_cards[2].id,
        easiness_factor=2.6,
        interval=5,
        repetitions=3,
        next_review_date=date.today() + timedelta(days=5),  # Not due
        status=CardStatus.MASTERED,
    )
    db_session.add(stats1)
    db_session.add(stats2)
    db_session.add(stats3)
    await db_session.commit()

    counts = await repo.count_by_status(sample_user.id, sample_deck.id)

    assert counts["new"] == 1
    assert counts["learning"] == 1
    assert counts["mastered"] == 1
    assert counts["review"] == 0
    # Due count includes new and learning cards due today
    assert counts["due"] == 2  # stats1 and stats2 are due today


@pytest.mark.asyncio
async def test_count_by_status_no_deck_filter(
    db_session: AsyncSession, sample_user, sample_deck, sample_cards
):
    """Test count_by_status without deck filter."""
    repo = CardStatisticsRepository(db_session)

    # Create some statistics
    from src.db.models import CardStatistics

    stats = CardStatistics(
        user_id=sample_user.id,
        card_id=sample_cards[0].id,
        easiness_factor=2.5,
        interval=0,
        repetitions=0,
        next_review_date=date.today(),
        status=CardStatus.NEW,
    )
    db_session.add(stats)
    await db_session.commit()

    counts = await repo.count_by_status(sample_user.id, deck_id=None)

    assert counts["new"] >= 1
    assert "due" in counts


@pytest.mark.asyncio
async def test_get_user_stats_for_deck(
    db_session: AsyncSession, sample_user, sample_deck, sample_cards
):
    """Test getting all statistics for a user in a specific deck."""
    repo = CardStatisticsRepository(db_session)

    # Create statistics for all cards
    from src.db.models import CardStatistics

    for i, card in enumerate(sample_cards):
        stats = CardStatistics(
            user_id=sample_user.id,
            card_id=card.id,
            easiness_factor=2.5,
            interval=i,
            repetitions=i,
            next_review_date=date.today() + timedelta(days=i),
            status=CardStatus.NEW,
        )
        db_session.add(stats)
    await db_session.commit()

    stats_list = await repo.get_user_stats_for_deck(sample_user.id, sample_deck.id)

    assert len(stats_list) == 3
    # Check that cards are loaded (eager loading works)
    for stat in stats_list:
        assert stat.card is not None
        assert stat.card.front_text is not None


@pytest.mark.asyncio
async def test_bulk_create_statistics(
    db_session: AsyncSession, sample_user, sample_deck, sample_cards
):
    """Test bulk creating statistics for multiple cards."""
    repo = CardStatisticsRepository(db_session)

    card_ids = [card.id for card in sample_cards]
    new_stats = await repo.bulk_create_statistics(sample_user.id, card_ids)
    await db_session.commit()

    assert len(new_stats) == 3
    for stat in new_stats:
        assert stat.user_id == sample_user.id
        assert stat.easiness_factor == 2.5
        assert stat.status == CardStatus.NEW
        assert stat.interval == 0
        assert stat.repetitions == 0


@pytest.mark.asyncio
async def test_bulk_create_statistics_skips_existing(
    db_session: AsyncSession, sample_user, sample_cards
):
    """Test bulk_create_statistics skips cards that already have statistics."""
    repo = CardStatisticsRepository(db_session)

    # Create statistics for first card
    from src.db.models import CardStatistics

    existing_stats = CardStatistics(
        user_id=sample_user.id,
        card_id=sample_cards[0].id,
        easiness_factor=2.5,
        interval=0,
        repetitions=0,
        next_review_date=date.today(),
        status=CardStatus.NEW,
    )
    db_session.add(existing_stats)
    await db_session.commit()

    # Bulk create for all cards - should skip the first one
    card_ids = [card.id for card in sample_cards]
    new_stats = await repo.bulk_create_statistics(sample_user.id, card_ids)
    await db_session.commit()

    # Only 2 new stats should be created (3 cards - 1 existing)
    assert len(new_stats) == 2
    new_card_ids = [s.card_id for s in new_stats]
    assert sample_cards[0].id not in new_card_ids


@pytest.mark.asyncio
async def test_bulk_create_statistics_empty_list(db_session: AsyncSession, sample_user):
    """Test bulk_create_statistics with empty list."""
    repo = CardStatisticsRepository(db_session)

    new_stats = await repo.bulk_create_statistics(sample_user.id, [])

    assert new_stats == []


# ============================================================================
# ReviewRepository - New SM-2 Methods Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_total_reviews(db_session: AsyncSession, sample_user, sample_cards):
    """Test counting total reviews for a user."""
    repo = ReviewRepository(db_session)

    # Create multiple reviews
    from src.db.models import Review

    for i in range(5):
        review = Review(
            user_id=sample_user.id,
            card_id=sample_cards[0].id,
            quality=4,
            time_taken=10,
            reviewed_at=datetime.utcnow() - timedelta(days=i),
        )
        db_session.add(review)
    await db_session.commit()

    total = await repo.get_total_reviews(sample_user.id)

    assert total >= 5


@pytest.mark.asyncio
async def test_get_total_reviews_no_reviews(db_session: AsyncSession, sample_user):
    """Test get_total_reviews returns 0 for users with no reviews."""
    repo = ReviewRepository(db_session)

    # Create a new user with no reviews
    new_user = User(
        email="no_reviews@example.com",
        password_hash="hashed",
        full_name="No Reviews",
    )
    db_session.add(new_user)
    await db_session.commit()

    total = await repo.get_total_reviews(new_user.id)

    assert total == 0


@pytest.mark.asyncio
async def test_get_total_study_time(db_session: AsyncSession, sample_user, sample_cards):
    """Test summing total study time for a user."""
    repo = ReviewRepository(db_session)

    # Create reviews with known time_taken values
    from src.db.models import Review

    times = [10, 20, 30]  # Total: 60 seconds
    for time_taken in times:
        review = Review(
            user_id=sample_user.id,
            card_id=sample_cards[0].id,
            quality=4,
            time_taken=time_taken,
            reviewed_at=datetime.utcnow(),
        )
        db_session.add(review)
    await db_session.commit()

    total_time = await repo.get_total_study_time(sample_user.id)

    assert total_time >= 60  # At least 60 seconds from our test data


@pytest.mark.asyncio
async def test_get_total_study_time_no_reviews(db_session: AsyncSession, sample_user):
    """Test get_total_study_time returns 0 for users with no reviews."""
    repo = ReviewRepository(db_session)

    # Create a new user with no reviews
    new_user = User(
        email="no_study_time@example.com",
        password_hash="hashed",
        full_name="No Study Time",
    )
    db_session.add(new_user)
    await db_session.commit()

    total_time = await repo.get_total_study_time(new_user.id)

    assert total_time == 0


# ============================================================================
# ReviewRepository - count_user_reviews Tests
# ============================================================================


@pytest.mark.asyncio
async def test_count_user_reviews_no_filter(db_session: AsyncSession, sample_user, sample_cards):
    """Test counting all reviews for a user without date filters."""
    repo = ReviewRepository(db_session)

    # Create multiple reviews
    from src.db.models import Review

    for i in range(5):
        review = Review(
            user_id=sample_user.id,
            card_id=sample_cards[0].id,
            quality=4,
            time_taken=10,
            reviewed_at=datetime.utcnow() - timedelta(days=i),
        )
        db_session.add(review)
    await db_session.commit()

    count = await repo.count_user_reviews(sample_user.id)

    assert count >= 5


@pytest.mark.asyncio
async def test_count_user_reviews_with_start_date(
    db_session: AsyncSession, sample_user, sample_cards
):
    """Test counting reviews with start date filter."""
    repo = ReviewRepository(db_session)

    # Create reviews on different dates
    from src.db.models import Review

    old_review = Review(
        user_id=sample_user.id,
        card_id=sample_cards[0].id,
        quality=4,
        time_taken=5,
        reviewed_at=datetime.utcnow() - timedelta(days=10),
    )
    recent_review = Review(
        user_id=sample_user.id,
        card_id=sample_cards[1].id,
        quality=5,
        time_taken=3,
        reviewed_at=datetime.utcnow(),
    )
    db_session.add(old_review)
    db_session.add(recent_review)
    await db_session.commit()

    # Filter by start date (last 5 days)
    start_date = date.today() - timedelta(days=5)
    count = await repo.count_user_reviews(sample_user.id, start_date=start_date)

    # Should only count recent_review (today is within last 5 days)
    assert count >= 1


@pytest.mark.asyncio
async def test_count_user_reviews_with_end_date(
    db_session: AsyncSession, sample_user, sample_cards
):
    """Test counting reviews with end date filter."""
    repo = ReviewRepository(db_session)

    # Create reviews on different dates
    from src.db.models import Review

    old_review = Review(
        user_id=sample_user.id,
        card_id=sample_cards[0].id,
        quality=4,
        time_taken=5,
        reviewed_at=datetime.utcnow() - timedelta(days=10),
    )
    recent_review = Review(
        user_id=sample_user.id,
        card_id=sample_cards[1].id,
        quality=5,
        time_taken=3,
        reviewed_at=datetime.utcnow(),
    )
    db_session.add(old_review)
    db_session.add(recent_review)
    await db_session.commit()

    # Filter by end date (up to 5 days ago)
    end_date = date.today() - timedelta(days=5)
    count = await repo.count_user_reviews(sample_user.id, end_date=end_date)

    # Should only count old_review (10 days ago is before 5 days ago)
    assert count >= 1


@pytest.mark.asyncio
async def test_count_user_reviews_with_date_range(
    db_session: AsyncSession, sample_user, sample_cards
):
    """Test counting reviews with both start and end date filters."""
    repo = ReviewRepository(db_session)

    # Create reviews on different dates
    from src.db.models import Review

    # Review 15 days ago
    very_old_review = Review(
        user_id=sample_user.id,
        card_id=sample_cards[0].id,
        quality=3,
        time_taken=5,
        reviewed_at=datetime.utcnow() - timedelta(days=15),
    )
    # Review 7 days ago
    mid_review = Review(
        user_id=sample_user.id,
        card_id=sample_cards[1].id,
        quality=4,
        time_taken=5,
        reviewed_at=datetime.utcnow() - timedelta(days=7),
    )
    # Review today
    recent_review = Review(
        user_id=sample_user.id,
        card_id=sample_cards[2].id,
        quality=5,
        time_taken=3,
        reviewed_at=datetime.utcnow(),
    )
    db_session.add(very_old_review)
    db_session.add(mid_review)
    db_session.add(recent_review)
    await db_session.commit()

    # Filter by date range (10 days ago to 5 days ago)
    start_date = date.today() - timedelta(days=10)
    end_date = date.today() - timedelta(days=5)
    count = await repo.count_user_reviews(sample_user.id, start_date=start_date, end_date=end_date)

    # Should only count mid_review (7 days ago is in range)
    assert count >= 1


@pytest.mark.asyncio
async def test_count_user_reviews_no_reviews(db_session: AsyncSession, sample_user):
    """Test count_user_reviews returns 0 for users with no reviews."""
    repo = ReviewRepository(db_session)

    # Create a new user with no reviews
    new_user = User(
        email="no_reviews_count@example.com",
        password_hash="hashed",
        full_name="No Reviews Count",
    )
    db_session.add(new_user)
    await db_session.commit()

    count = await repo.count_user_reviews(new_user.id)

    assert count == 0
