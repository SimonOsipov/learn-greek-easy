"""Integration tests for SM-2 Service with real database.

These tests verify the complete SM-2 review flow with actual database transactions,
ensuring all components work together correctly:
- CardStatistics creation and updates
- Review history records
- UserDeckProgress tracking
- Study queue generation
- Card initialization

Acceptance Criteria tested:
- AC #1: Tests use real database transactions
- AC #2: Full review flow tested end-to-end
- AC #3: CardStatistics creation verified
- AC #4: Review history creation verified
- AC #5: UserDeckProgress updates verified
- AC #6: Study queue tested
- AC #7: Card initialization tested
- AC #8: No duplicate records created
- AC #9: Tests pass with `pytest -m integration`

Usage:
    # Run all SM-2 integration tests
    pytest tests/integration/test_sm2_integration.py -v

    # Run with markers
    pytest -m "integration and sm2" -v
"""

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Card, CardStatistics, CardStatus, Deck, Review, User, UserDeckProgress
from src.schemas.sm2 import CardInitializationRequest, StudyQueueRequest
from src.services.sm2_service import SM2Service

# Module-level markers
pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.integration,
    pytest.mark.sm2,
]


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def sm2_service(db_session: AsyncSession) -> SM2Service:
    """SM2Service with real database session.

    This fixture creates an SM2Service instance that uses the test database
    session, enabling real database transactions for integration testing.

    Args:
        db_session: The async database session from the test fixtures.

    Returns:
        SM2Service: Service instance with real database connection.
    """
    return SM2Service(db_session)


@pytest.fixture
async def test_deck_with_10_cards(
    db_session: AsyncSession,
    test_deck: Deck,
) -> tuple[Deck, list[Card]]:
    """Create a test deck with exactly 10 cards.

    Args:
        db_session: Database session.
        test_deck: Base deck fixture.

    Returns:
        tuple: (Deck, list of 10 Cards)
    """
    cards = []
    for i in range(10):
        card = Card(
            deck_id=test_deck.id,
            front_text=f"Greek Word {i + 1}",
            back_text_en=f"English Translation {i + 1}",
            pronunciation=f"Pronunciation Guide {i + 1}",
        )
        db_session.add(card)
        cards.append(card)
    await db_session.flush()
    return test_deck, cards


# =============================================================================
# TestProcessReviewIntegration - AC #2, #3, #4, #5, #8
# =============================================================================


class TestProcessReviewIntegration:
    """Integration tests for process_review with real database.

    Tests the complete review processing flow including:
    - CardStatistics creation and updates
    - Review history recording
    - UserDeckProgress tracking
    - Duplicate prevention
    """

    async def test_first_review_creates_statistics(
        self,
        sm2_service: SM2Service,
        test_user: User,
        test_deck_with_10_cards: tuple[Deck, list[Card]],
        db_session: AsyncSession,
    ):
        """AC #3: First review creates CardStatistics record.

        Verifies that processing a review for a new card creates
        the CardStatistics record in the database.
        """
        deck, cards = test_deck_with_10_cards

        result = await sm2_service.process_review(
            user_id=test_user.id,
            card_id=cards[0].id,
            quality=4,
            time_taken=15,
        )

        # Verify result
        assert result.success is True
        assert result.previous_status == CardStatus.NEW
        assert result.new_status == CardStatus.LEARNING
        assert result.card_id == cards[0].id

        # Verify CardStatistics created in database
        stats_query = select(CardStatistics).where(
            CardStatistics.user_id == test_user.id,
            CardStatistics.card_id == cards[0].id,
        )
        stats_result = await db_session.execute(stats_query)
        stats_record = stats_result.scalar_one()

        assert stats_record is not None
        assert stats_record.status == CardStatus.LEARNING
        assert stats_record.easiness_factor >= 1.3
        assert stats_record.interval >= 1
        assert stats_record.repetitions >= 1

    async def test_review_creates_history_record(
        self,
        sm2_service: SM2Service,
        test_user: User,
        test_deck_with_10_cards: tuple[Deck, list[Card]],
        db_session: AsyncSession,
    ):
        """AC #4: Review creates Review history record.

        Verifies that each review is recorded in the Review table
        for history and analytics purposes.
        """
        deck, cards = test_deck_with_10_cards

        await sm2_service.process_review(
            user_id=test_user.id,
            card_id=cards[0].id,
            quality=4,
            time_taken=10,
        )

        # Verify Review record created in database
        review_query = select(Review).where(
            Review.user_id == test_user.id,
            Review.card_id == cards[0].id,
        )
        review_result = await db_session.execute(review_query)
        review_record = review_result.scalar_one()

        assert review_record is not None
        assert review_record.quality == 4
        assert review_record.time_taken == 10
        assert review_record.reviewed_at is not None

    async def test_review_updates_deck_progress(
        self,
        sm2_service: SM2Service,
        test_user: User,
        test_deck_with_10_cards: tuple[Deck, list[Card]],
        db_session: AsyncSession,
    ):
        """AC #5: Review updates UserDeckProgress.

        Verifies that cards_studied is incremented on first review
        of a card.
        """
        deck, cards = test_deck_with_10_cards

        # First review
        await sm2_service.process_review(
            user_id=test_user.id,
            card_id=cards[0].id,
            quality=4,
            time_taken=10,
        )

        # Verify UserDeckProgress created and updated
        progress_query = select(UserDeckProgress).where(
            UserDeckProgress.user_id == test_user.id,
            UserDeckProgress.deck_id == deck.id,
        )
        progress_result = await db_session.execute(progress_query)
        progress_record = progress_result.scalar_one()

        assert progress_record is not None
        assert progress_record.cards_studied == 1
        assert progress_record.cards_mastered == 0

    async def test_multiple_reviews_same_card_updates_existing(
        self,
        sm2_service: SM2Service,
        test_user: User,
        test_deck_with_10_cards: tuple[Deck, list[Card]],
        db_session: AsyncSession,
    ):
        """AC #8: Multiple reviews update existing stats, no duplicates.

        Verifies that reviewing the same card multiple times:
        1. Updates the existing CardStatistics record
        2. Creates multiple Review history records
        3. Does not create duplicate CardStatistics
        """
        deck, cards = test_deck_with_10_cards

        # First review
        result1 = await sm2_service.process_review(
            user_id=test_user.id,
            card_id=cards[0].id,
            quality=4,
            time_taken=10,
        )

        # Second review
        result2 = await sm2_service.process_review(
            user_id=test_user.id,
            card_id=cards[0].id,
            quality=5,
            time_taken=5,
        )

        # Verify only one CardStatistics record exists (no duplicates)
        stats_query = select(CardStatistics).where(
            CardStatistics.user_id == test_user.id,
            CardStatistics.card_id == cards[0].id,
        )
        stats_result = await db_session.execute(stats_query)
        stats_records = stats_result.scalars().all()

        assert len(stats_records) == 1

        # Verify stats were updated (values changed)
        assert result2.repetitions > result1.repetitions

        # Verify two Review records exist (history is kept)
        review_query = (
            select(func.count())
            .select_from(Review)
            .where(
                Review.user_id == test_user.id,
                Review.card_id == cards[0].id,
            )
        )
        review_count_result = await db_session.execute(review_query)
        review_count = review_count_result.scalar()

        assert review_count == 2

    async def test_failed_review_resets_progress(
        self,
        sm2_service: SM2Service,
        test_user: User,
        test_deck_with_10_cards: tuple[Deck, list[Card]],
        db_session: AsyncSession,
    ):
        """AC #2: Failed review resets progress.

        Verifies that a quality rating below 3 resets the
        repetitions and interval according to SM-2 algorithm.
        """
        deck, cards = test_deck_with_10_cards

        # Multiple successful reviews to build up progress
        for _ in range(3):
            await sm2_service.process_review(
                user_id=test_user.id,
                card_id=cards[0].id,
                quality=5,
                time_taken=5,
            )

        # Get stats before failed review
        stats_before_query = select(CardStatistics).where(
            CardStatistics.user_id == test_user.id,
            CardStatistics.card_id == cards[0].id,
        )
        stats_before_result = await db_session.execute(stats_before_query)
        stats_before = stats_before_result.scalar_one()
        reps_before = stats_before.repetitions
        assert reps_before > 0

        # Failed review (quality < 3)
        result = await sm2_service.process_review(
            user_id=test_user.id,
            card_id=cards[0].id,
            quality=1,
            time_taken=20,
        )

        # Verify progress was reset
        assert result.repetitions == 0
        assert result.interval == 1


# =============================================================================
# TestStudyQueueIntegration - AC #6
# =============================================================================


class TestStudyQueueIntegration:
    """Integration tests for study queue with real database.

    Tests study queue generation including:
    - New cards appearing in queue
    - Due cards prioritization
    - Deck filtering
    """

    async def test_new_cards_appear_in_queue(
        self,
        sm2_service: SM2Service,
        test_user: User,
        test_deck_with_10_cards: tuple[Deck, list[Card]],
    ):
        """AC #6: New cards appear in study queue.

        Verifies that cards without CardStatistics appear
        as new cards in the study queue.
        """
        deck, cards = test_deck_with_10_cards

        request = StudyQueueRequest(
            deck_id=deck.id,
            limit=20,
            include_new=True,
            new_cards_limit=10,
        )

        queue = await sm2_service.get_study_queue(
            user_id=test_user.id,
            request=request,
        )

        assert queue.total_new == 10
        assert len(queue.cards) == 10
        assert all(card.is_new for card in queue.cards)

    async def test_due_cards_appear_first(
        self,
        sm2_service: SM2Service,
        test_user: User,
        test_deck_with_10_cards: tuple[Deck, list[Card]],
        db_session: AsyncSession,
    ):
        """AC #6: Due cards appear before new cards in queue.

        Verifies that cards due for review are prioritized
        over new cards in the study queue.
        """
        from datetime import date, timedelta

        deck, cards = test_deck_with_10_cards

        # Review first 3 cards
        for i in range(3):
            await sm2_service.process_review(
                user_id=test_user.id,
                card_id=cards[i].id,
                quality=4,
                time_taken=10,
            )

        # Manually set next_review_date to today to make them "due"
        # (normally they wouldn't be due until tomorrow or later)
        update_query = select(CardStatistics).where(
            CardStatistics.user_id == test_user.id,
        )
        result = await db_session.execute(update_query)
        stats_records = result.scalars().all()

        for stats in stats_records:
            stats.next_review_date = date.today() - timedelta(days=1)
        await db_session.flush()

        request = StudyQueueRequest(
            deck_id=deck.id,
            limit=20,
            include_new=True,
            new_cards_limit=10,
        )

        queue = await sm2_service.get_study_queue(
            user_id=test_user.id,
            request=request,
        )

        # Due cards should appear before new cards
        assert queue.total_due == 3
        assert queue.total_new == 7

        # First 3 should be due cards (not new)
        for i in range(3):
            assert not queue.cards[i].is_new

        # Remaining should be new cards
        for i in range(3, 10):
            assert queue.cards[i].is_new

    async def test_deck_filtering_works(
        self,
        sm2_service: SM2Service,
        test_user: User,
        two_decks: tuple[Deck, Deck],
        db_session: AsyncSession,
    ):
        """AC #6: Deck filtering works correctly.

        Verifies that study queue only includes cards
        from the specified deck.
        """
        deck1, deck2 = two_decks

        # Create cards in deck1
        card1 = Card(
            deck_id=deck1.id,
            front_text="Deck1 Card",
            back_text_en="Translation 1",
        )
        db_session.add(card1)

        # Create cards in deck2
        card2 = Card(
            deck_id=deck2.id,
            front_text="Deck2 Card",
            back_text_en="Translation 2",
        )
        db_session.add(card2)
        await db_session.flush()

        # Request queue for deck1 only
        request = StudyQueueRequest(
            deck_id=deck1.id,
            limit=20,
            include_new=True,
            new_cards_limit=10,
        )

        queue = await sm2_service.get_study_queue(
            user_id=test_user.id,
            request=request,
        )

        # Should only contain deck1 cards
        assert queue.total_new == 1
        assert len(queue.cards) == 1
        assert queue.cards[0].card_id == card1.id


# =============================================================================
# TestCardInitializationIntegration - AC #7, #8
# =============================================================================


class TestCardInitializationIntegration:
    """Integration tests for card initialization with real database.

    Tests card initialization including:
    - Full deck initialization
    - Re-initialization skipping existing
    - Partial initialization
    """

    async def test_initialize_deck_creates_stats_for_all_cards(
        self,
        sm2_service: SM2Service,
        test_user: User,
        test_deck_with_10_cards: tuple[Deck, list[Card]],
        db_session: AsyncSession,
    ):
        """AC #7: Initialize deck creates stats for all cards.

        Verifies that initialize_deck_for_user creates
        CardStatistics for all cards in the deck.
        """
        deck, cards = test_deck_with_10_cards

        result = await sm2_service.initialize_deck_for_user(
            user_id=test_user.id,
            deck_id=deck.id,
        )

        # Verify result counts
        assert result.initialized_count == 10
        assert result.already_exists_count == 0
        assert len(result.card_ids) == 10

        # Verify all CardStatistics created in database
        stats_query = (
            select(CardStatistics)
            .where(CardStatistics.user_id == test_user.id)
            .join(Card)
            .where(Card.deck_id == deck.id)
        )
        stats_result = await db_session.execute(stats_query)
        stats_records = stats_result.scalars().all()

        assert len(stats_records) == 10

        # Verify all have NEW status
        for stats in stats_records:
            assert stats.status == CardStatus.NEW
            assert stats.easiness_factor == 2.5
            assert stats.interval == 0
            assert stats.repetitions == 0

    async def test_reinitialization_skips_existing_records(
        self,
        sm2_service: SM2Service,
        test_user: User,
        test_deck_with_10_cards: tuple[Deck, list[Card]],
        db_session: AsyncSession,
    ):
        """AC #7, #8: Re-initialization skips existing records.

        Verifies that calling initialize_deck_for_user again:
        1. Skips existing CardStatistics
        2. Does not create duplicates
        """
        deck, cards = test_deck_with_10_cards

        # First initialization
        result1 = await sm2_service.initialize_deck_for_user(
            user_id=test_user.id,
            deck_id=deck.id,
        )
        assert result1.initialized_count == 10

        # Second initialization (re-initialization)
        result2 = await sm2_service.initialize_deck_for_user(
            user_id=test_user.id,
            deck_id=deck.id,
        )

        # Should skip all existing
        assert result2.initialized_count == 0
        assert result2.already_exists_count == 10

        # Verify still only 10 records (no duplicates)
        stats_query = (
            select(CardStatistics)
            .where(CardStatistics.user_id == test_user.id)
            .join(Card)
            .where(Card.deck_id == deck.id)
        )
        stats_result = await db_session.execute(stats_query)
        stats_records = stats_result.scalars().all()

        assert len(stats_records) == 10

    async def test_partial_initialization_adds_only_new_cards(
        self,
        sm2_service: SM2Service,
        test_user: User,
        test_deck_with_10_cards: tuple[Deck, list[Card]],
        db_session: AsyncSession,
    ):
        """AC #7, #8: Partial initialization adds only new cards.

        Verifies that initializing a subset of cards, then the
        full deck, only creates stats for the missing cards.
        """
        deck, cards = test_deck_with_10_cards

        # Initialize first 5 cards manually
        request = CardInitializationRequest(
            deck_id=deck.id,
            card_ids=[c.id for c in cards[:5]],
        )
        first_result = await sm2_service.initialize_cards_for_user(
            user_id=test_user.id,
            request=request,
        )
        assert first_result.initialized_count == 5

        # Initialize full deck
        result = await sm2_service.initialize_deck_for_user(
            user_id=test_user.id,
            deck_id=deck.id,
        )

        # Should only initialize remaining 5
        assert result.initialized_count == 5
        assert result.already_exists_count == 5

        # Verify total of 10 records
        stats_query = (
            select(CardStatistics)
            .where(CardStatistics.user_id == test_user.id)
            .join(Card)
            .where(Card.deck_id == deck.id)
        )
        stats_result = await db_session.execute(stats_query)
        stats_records = stats_result.scalars().all()

        assert len(stats_records) == 10


# =============================================================================
# Transaction Verification Tests - AC #1, #2
# =============================================================================


class TestDatabaseTransactionVerification:
    """Tests verifying real database transactions are used.

    These tests explicitly verify that data persists and
    transactions work correctly with the real database.
    """

    async def test_review_persists_after_commit(
        self,
        sm2_service: SM2Service,
        test_user: User,
        test_deck_with_10_cards: tuple[Deck, list[Card]],
        db_session: AsyncSession,
    ):
        """AC #1: Tests use real database transactions.

        Verifies that data persists in the database after
        the review is processed.
        """
        deck, cards = test_deck_with_10_cards

        # Process review (which flushes changes)
        await sm2_service.process_review(
            user_id=test_user.id,
            card_id=cards[0].id,
            quality=4,
            time_taken=10,
        )

        # Create fresh query to verify data persisted
        stats_query = select(CardStatistics).where(
            CardStatistics.user_id == test_user.id,
            CardStatistics.card_id == cards[0].id,
        )
        stats_result = await db_session.execute(stats_query)
        stats_record = stats_result.scalar_one_or_none()

        assert stats_record is not None
        assert stats_record.status != CardStatus.NEW

    async def test_multiple_cards_reviewed_in_same_transaction(
        self,
        sm2_service: SM2Service,
        test_user: User,
        test_deck_with_10_cards: tuple[Deck, list[Card]],
        db_session: AsyncSession,
    ):
        """AC #2: Full review flow tested end-to-end.

        Verifies that reviewing multiple cards creates
        the expected database records for all.
        """
        deck, cards = test_deck_with_10_cards

        # Review multiple cards
        for card in cards[:5]:
            await sm2_service.process_review(
                user_id=test_user.id,
                card_id=card.id,
                quality=4,
                time_taken=10,
            )

        # Verify all 5 CardStatistics created
        stats_query = select(CardStatistics).where(
            CardStatistics.user_id == test_user.id,
        )
        stats_result = await db_session.execute(stats_query)
        stats_records = stats_result.scalars().all()

        assert len(stats_records) == 5

        # Verify all 5 Review records created
        review_query = select(Review).where(
            Review.user_id == test_user.id,
        )
        review_result = await db_session.execute(review_query)
        review_records = review_result.scalars().all()

        assert len(review_records) == 5

        # Verify progress updated correctly
        progress_query = select(UserDeckProgress).where(
            UserDeckProgress.user_id == test_user.id,
            UserDeckProgress.deck_id == deck.id,
        )
        progress_result = await db_session.execute(progress_query)
        progress_record = progress_result.scalar_one()

        assert progress_record.cards_studied == 5
