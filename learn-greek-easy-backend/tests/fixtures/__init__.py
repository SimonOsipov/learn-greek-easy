"""Test fixtures package.

This package contains reusable test fixtures:
- database.py: Database session and engine fixtures (PostgreSQL only)
- auth.py: Authentication-related fixtures (users, tokens, headers)
- deck.py: Deck and card fixtures with Greek vocabulary
- progress.py: Progress tracking and review fixtures for SM-2 testing

Import fixtures in conftest.py to make them available globally.

Available Database Fixtures:
    db_engine: Async PostgreSQL engine (creates/drops tables per test)
    db_session: Async session with automatic rollback
    db_session_with_savepoint: Session using savepoint pattern
    session_db_engine: Shared engine across test session (faster)
    fast_db_session: Session using shared engine (faster, less isolated)

Available Auth Fixtures:
    test_user: Regular active user
    test_superuser: Admin user with superuser privileges
    test_verified_user: User with verified email
    test_inactive_user: Deactivated user account
    test_user_tokens: JWT tokens for test_user
    auth_headers: Authorization headers for test_user
    superuser_auth_headers: Authorization headers for superuser
    authenticated_user: Complete bundle (user, tokens, headers)
    expired_access_token: Expired token for error testing
    invalid_token: Invalid token for error testing

Available Deck Fixtures:
    test_deck: Basic A1-level deck
    test_deck_a1, test_deck_a2, test_deck_b1: Level-specific decks
    test_card: Single test card
    test_cards: List of 5 test cards
    deck_with_cards: Deck with 5 A1 vocabulary cards
    deck_with_all_a1_cards: Deck with all 10 A1 vocabulary cards
    deck_with_a2_cards, deck_with_b1_cards: Level-specific decks with cards
    multi_level_decks: A1, A2, B1 decks bundle
    cards_by_difficulty: Cards grouped by difficulty
    inactive_deck: Deactivated deck
    empty_deck: Deck with no cards

Available Progress Fixtures:
    user_deck_progress: Basic progress for user on deck
    fresh_user_progress: Progress for new user (0 studied)
    completed_deck_progress: Progress with all cards mastered
    new_card_statistics: Card never reviewed (NEW status)
    learning_card_statistics: Card in learning phase
    review_card_statistics: Card in review phase
    mastered_card_statistics: Fully mastered card
    due_card_statistics: Card due for review today
    overdue_card_statistics: Card past due date
    cards_by_status: Cards grouped by SM-2 status

Available Review Fixtures:
    test_review: Single review record
    perfect_review: Perfect (quality=5) review
    failed_review: Failed (quality=0) review
    review_history: Mixed review history (5 reviews)
    perfect_review_history: All perfect reviews
    struggling_review_history: Poor performance history

Available Bundle Fixtures:
    user_with_deck_progress: User + deck + progress
    card_with_statistics: Card + statistics
    card_with_review_history: Card + statistics + reviews
    user_with_learning_progress: Complete learning data bundle
    two_users_same_deck: Two users studying same deck

Note: All fixtures use PostgreSQL. SQLite is not supported due to
      PostgreSQL-specific features (native enums, uuid_generate_v4, etc.).

Usage:
    # In conftest.py
    from tests.fixtures.database import db_engine, db_session
    from tests.fixtures.auth import test_user, auth_headers
    from tests.fixtures.deck import deck_with_cards, DeckWithCards
    from tests.fixtures.progress import user_with_learning_progress

    # In test files
    async def test_something(
        db_session: AsyncSession,
        deck_with_cards: DeckWithCards,
    ):
        deck = deck_with_cards.deck
        cards = deck_with_cards.cards
        ...
"""

# Database fixtures
from tests.fixtures.database import (
    clean_tables,
    create_test_engine,
    create_test_session_factory,
    db_engine,
    db_session,
    db_session_with_savepoint,
    db_url,
    fast_db_session,
    session_db_engine,
    verify_isolation,
)

# Auth fixtures
from tests.fixtures.auth import (
    # User fixtures
    test_user,
    test_superuser,
    test_verified_user,
    test_inactive_user,
    two_users,
    # Token fixtures
    test_user_tokens,
    superuser_tokens,
    access_token,
    refresh_token_value,
    # Header fixtures
    auth_headers,
    superuser_auth_headers,
    expired_auth_headers,
    # Bundle fixtures
    authenticated_user,
    authenticated_superuser,
    # Error testing fixtures
    expired_access_token,
    invalid_token,
    # Utility functions
    create_test_user_data,
    create_user_with_settings,
    create_tokens_for_user,
    create_auth_headers,
    # Types
    AuthTokens,
    AuthenticatedUser,
)

# Deck fixtures
from tests.fixtures.deck import (
    # Type definitions
    DeckWithCards,
    MultiLevelDecks,
    # Vocabulary data
    GREEK_VOCABULARY_A1,
    GREEK_VOCABULARY_A2,
    GREEK_VOCABULARY_B1,
    # Factory functions
    create_deck_data,
    create_card_data,
    create_deck,
    create_card,
    create_deck_with_vocabulary,
    # Core deck fixtures
    test_deck,
    test_deck_a1,
    test_deck_a2,
    test_deck_b1,
    inactive_deck,
    empty_deck,
    # Card fixtures
    test_card,
    test_cards,
    cards_by_difficulty,
    # Composite fixtures
    deck_with_cards,
    deck_with_all_a1_cards,
    deck_with_a2_cards,
    deck_with_b1_cards,
    multi_level_decks,
    two_decks,
    # Large dataset fixtures
    deck_with_many_cards,
)

# Progress fixtures
from tests.fixtures.progress import (
    # Type definitions
    UserProgress,
    CardWithStatistics,
    UserWithLearningData,
    CardsByStatus,
    ReviewHistory,
    # SM-2 constants
    SM2_DEFAULT_EASINESS_FACTOR,
    SM2_MIN_EASINESS_FACTOR,
    SM2_INTERVALS,
    # Factory functions - Progress
    create_progress_data,
    create_user_deck_progress,
    # Factory functions - Statistics
    create_statistics_data,
    create_card_statistics,
    create_new_card_stats,
    create_learning_card_stats,
    create_review_card_stats,
    create_mastered_card_stats,
    create_due_card_stats,
    create_overdue_card_stats,
    # Factory functions - Reviews
    create_review_data,
    create_review,
    create_review_history,
    # Progress fixtures
    user_deck_progress,
    fresh_user_progress,
    completed_deck_progress,
    # Card statistics fixtures
    new_card_statistics,
    learning_card_statistics,
    review_card_statistics,
    mastered_card_statistics,
    due_card_statistics,
    overdue_card_statistics,
    cards_by_status,
    multiple_due_cards,
    # Review fixtures
    test_review,
    perfect_review,
    failed_review,
    review_history,
    perfect_review_history,
    struggling_review_history,
    # Bundle fixtures
    user_with_deck_progress,
    card_with_statistics,
    card_with_review_history,
    user_with_learning_progress,
    two_users_same_deck,
)

__all__ = [
    # Database fixtures
    "db_engine",
    "db_session",
    "db_session_with_savepoint",
    "session_db_engine",
    "fast_db_session",
    "db_url",
    "clean_tables",
    "verify_isolation",
    "create_test_engine",
    "create_test_session_factory",
    # User fixtures
    "test_user",
    "test_superuser",
    "test_verified_user",
    "test_inactive_user",
    "two_users",
    # Token fixtures
    "test_user_tokens",
    "superuser_tokens",
    "access_token",
    "refresh_token_value",
    # Header fixtures
    "auth_headers",
    "superuser_auth_headers",
    "expired_auth_headers",
    # Bundle fixtures
    "authenticated_user",
    "authenticated_superuser",
    # Error testing fixtures
    "expired_access_token",
    "invalid_token",
    # Utility functions
    "create_test_user_data",
    "create_user_with_settings",
    "create_tokens_for_user",
    "create_auth_headers",
    # Types
    "AuthTokens",
    "AuthenticatedUser",
    # Deck type definitions
    "DeckWithCards",
    "MultiLevelDecks",
    # Vocabulary data
    "GREEK_VOCABULARY_A1",
    "GREEK_VOCABULARY_A2",
    "GREEK_VOCABULARY_B1",
    # Deck factory functions
    "create_deck_data",
    "create_card_data",
    "create_deck",
    "create_card",
    "create_deck_with_vocabulary",
    # Core deck fixtures
    "test_deck",
    "test_deck_a1",
    "test_deck_a2",
    "test_deck_b1",
    "inactive_deck",
    "empty_deck",
    # Card fixtures
    "test_card",
    "test_cards",
    "cards_by_difficulty",
    # Composite deck fixtures
    "deck_with_cards",
    "deck_with_all_a1_cards",
    "deck_with_a2_cards",
    "deck_with_b1_cards",
    "multi_level_decks",
    "two_decks",
    "deck_with_many_cards",
    # Progress type definitions
    "UserProgress",
    "CardWithStatistics",
    "UserWithLearningData",
    "CardsByStatus",
    "ReviewHistory",
    # SM-2 constants
    "SM2_DEFAULT_EASINESS_FACTOR",
    "SM2_MIN_EASINESS_FACTOR",
    "SM2_INTERVALS",
    # Progress factory functions
    "create_progress_data",
    "create_user_deck_progress",
    "create_statistics_data",
    "create_card_statistics",
    "create_new_card_stats",
    "create_learning_card_stats",
    "create_review_card_stats",
    "create_mastered_card_stats",
    "create_due_card_stats",
    "create_overdue_card_stats",
    "create_review_data",
    "create_review",
    "create_review_history",
    # Progress fixtures
    "user_deck_progress",
    "fresh_user_progress",
    "completed_deck_progress",
    # Card statistics fixtures
    "new_card_statistics",
    "learning_card_statistics",
    "review_card_statistics",
    "mastered_card_statistics",
    "due_card_statistics",
    "overdue_card_statistics",
    "cards_by_status",
    "multiple_due_cards",
    # Review fixtures
    "test_review",
    "perfect_review",
    "failed_review",
    "review_history",
    "perfect_review_history",
    "struggling_review_history",
    # Progress bundle fixtures
    "user_with_deck_progress",
    "card_with_statistics",
    "card_with_review_history",
    "user_with_learning_progress",
    "two_users_same_deck",
]
