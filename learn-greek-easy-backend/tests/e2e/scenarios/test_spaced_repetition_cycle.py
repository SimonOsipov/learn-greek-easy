"""E2E tests for SM-2 spaced repetition cycle.

This module tests the complete spaced repetition learning cycle,
validating SM-2 algorithm behavior including:
- Card state progression (NEW -> LEARNING -> REVIEW -> MASTERED)
- Interval scheduling accuracy
- Failed review handling and progress reset
- Easiness factor adjustments
- Mastery threshold requirements

Test markers applied automatically:
- @pytest.mark.e2e
- @pytest.mark.scenario
"""

from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardStatistics, CardStatus, User
from tests.e2e.conftest import E2ETestCase
from tests.factories import CardFactory, DeckFactory


@pytest.mark.e2e
class TestSpacedRepetitionCycle(E2ETestCase):
    """E2E tests for SM-2 spaced repetition cycle.

    These tests validate the complete SM-2 algorithm behavior through
    the API, verifying state transitions, interval calculations,
    and scheduling logic.
    """

    @pytest.mark.asyncio
    async def test_card_state_progression_new_to_mastered(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict,
        test_user: User,
    ) -> None:
        """Test complete state progression: NEW -> LEARNING -> REVIEW -> MASTERED.

        Validates that a card progresses through all states with perfect reviews:
        - Review 1: NEW -> LEARNING (rep=1, interval=1)
        - Review 2: LEARNING -> LEARNING (rep=2, interval=6)
        - Review 3: LEARNING -> REVIEW (rep=3, interval based on EF)
        - Review 4+: Eventually reaches MASTERED when EF >= 2.3 and interval >= 21
        """
        # Create deck with cards
        deck = await DeckFactory.create(
            session=db_session,
            name="State Progression Test Deck",
        )
        cards = await CardFactory.create_batch(
            session=db_session,
            size=1,
            deck_id=deck.id,
        )
        card = cards[0]

        # Initialize study session
        init_response = await client.post(
            f"/api/v1/study/initialize/{deck.id}",
            headers=auth_headers,
        )
        assert init_response.status_code == 200

        # Track progression through reviews
        # Review 1: NEW -> LEARNING
        review1 = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(card.id),
                "quality": 5,  # Perfect recall
                "time_taken": 5,
            },
            headers=auth_headers,
        )
        assert review1.status_code == 200
        r1 = review1.json()
        assert r1["success"] is True
        assert r1["previous_status"] == "new"
        assert r1["new_status"] == "learning"
        assert r1["repetitions"] == 1
        assert r1["interval"] == 1

        # Review 2: LEARNING -> LEARNING (need 3 reps to exit learning)
        review2 = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(card.id),
                "quality": 5,
                "time_taken": 5,
            },
            headers=auth_headers,
        )
        assert review2.status_code == 200
        r2 = review2.json()
        assert r2["previous_status"] == "learning"
        assert r2["new_status"] == "learning"
        assert r2["repetitions"] == 2
        assert r2["interval"] == 6

        # Review 3: LEARNING -> REVIEW (3 reps = exit learning phase)
        review3 = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(card.id),
                "quality": 5,
                "time_taken": 5,
            },
            headers=auth_headers,
        )
        assert review3.status_code == 200
        r3 = review3.json()
        assert r3["previous_status"] == "learning"
        assert r3["new_status"] == "review"
        assert r3["repetitions"] == 3
        # Interval should be ~16 (6 * 2.8 rounded) or similar based on EF growth
        assert r3["interval"] >= 15  # With EF >= 2.5, 6 * EF >= 15
        assert r3["easiness_factor"] >= 2.5  # EF should have increased

        # Review 4: May transition to MASTERED if interval >= 21
        review4 = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(card.id),
                "quality": 5,
                "time_taken": 5,
            },
            headers=auth_headers,
        )
        assert review4.status_code == 200
        r4 = review4.json()
        assert r4["repetitions"] == 4
        # With high EF and interval from review 3 * EF, should reach mastery threshold
        assert r4["easiness_factor"] >= 2.3  # Mastery EF threshold

        # Either REVIEW or MASTERED depending on interval
        if r4["interval"] >= 21:
            assert r4["new_status"] == "mastered"
        else:
            assert r4["new_status"] == "review"

    @pytest.mark.asyncio
    async def test_interval_scheduling_accuracy(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict,
        test_user: User,
    ) -> None:
        """Verify interval calculations match SM-2 algorithm.

        With quality=4 (EF unchanged at 2.5):
        - Review 1: interval=1
        - Review 2: interval=6
        - Review 3: interval=round(6 * 2.5)=15
        - Review 4: interval=round(15 * 2.5)=38
        - Review 5: interval=round(38 * 2.5)=95
        """
        deck = await DeckFactory.create(
            session=db_session,
            name="Interval Test Deck",
        )
        cards = await CardFactory.create_batch(
            session=db_session,
            size=1,
            deck_id=deck.id,
        )
        card = cards[0]

        # Initialize
        await client.post(
            f"/api/v1/study/initialize/{deck.id}",
            headers=auth_headers,
        )

        # Expected intervals with quality=4 (EF stays at 2.5)
        expected_intervals = [1, 6, 15, 38, 95]

        for i, expected_interval in enumerate(expected_intervals):
            response = await client.post(
                "/api/v1/reviews",
                json={
                    "card_id": str(card.id),
                    "quality": 4,  # EF unchanged
                    "time_taken": 5,
                },
                headers=auth_headers,
            )
            assert response.status_code == 200
            result = response.json()

            assert result["interval"] == expected_interval, (
                f"Review {i + 1}: expected interval={expected_interval}, "
                f"got {result['interval']}"
            )
            assert result["repetitions"] == i + 1

            # Verify EF stays at 2.5 with quality=4
            assert (
                abs(result["easiness_factor"] - 2.5) < 0.01
            ), f"Review {i + 1}: EF should be 2.5 with q=4, got {result['easiness_factor']}"

    @pytest.mark.asyncio
    async def test_failed_review_resets_progress(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict,
        test_user: User,
    ) -> None:
        """Test that quality < 3 resets repetitions and interval.

        Validates the SM-2 "failed recall" behavior:
        - Build up progress with 3 successful reviews
        - Submit a failed review (quality=1)
        - Verify: status -> LEARNING, repetitions -> 0, interval -> 1
        """
        deck = await DeckFactory.create(
            session=db_session,
            name="Failed Review Test Deck",
        )
        cards = await CardFactory.create_batch(
            session=db_session,
            size=1,
            deck_id=deck.id,
        )
        card = cards[0]

        # Initialize
        await client.post(
            f"/api/v1/study/initialize/{deck.id}",
            headers=auth_headers,
        )

        # Build up progress with 3 successful reviews
        for i in range(3):
            response = await client.post(
                "/api/v1/reviews",
                json={
                    "card_id": str(card.id),
                    "quality": 5,
                    "time_taken": 5,
                },
                headers=auth_headers,
            )
            assert response.status_code == 200

        # Verify card is now in REVIEW status
        result_before_fail = response.json()
        assert result_before_fail["new_status"] == "review"
        assert result_before_fail["repetitions"] == 3
        previous_ef = result_before_fail["easiness_factor"]
        assert previous_ef > 2.5  # EF increased with quality=5

        # Submit a FAILED review (quality=1)
        fail_response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(card.id),
                "quality": 1,  # Failed recall
                "time_taken": 15,
            },
            headers=auth_headers,
        )
        assert fail_response.status_code == 200
        fail_result = fail_response.json()

        # Verify reset
        assert fail_result["previous_status"] == "review"
        assert fail_result["new_status"] == "learning"
        assert fail_result["repetitions"] == 0
        assert fail_result["interval"] == 1

        # EF should decrease (q=1 reduces by ~0.54)
        assert fail_result["easiness_factor"] < previous_ef
        assert fail_result["easiness_factor"] >= 1.3  # Never below minimum

    @pytest.mark.asyncio
    async def test_card_due_tracking(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict,
        test_user: User,
    ) -> None:
        """Test card scheduling tracks next review date correctly.

        Verifies that after review:
        - next_review_date is set correctly (today + interval)
        - Database CardStatistics.next_review_date matches API response
        """
        deck = await DeckFactory.create(
            session=db_session,
            name="Due Date Test Deck",
        )
        cards = await CardFactory.create_batch(
            session=db_session,
            size=1,
            deck_id=deck.id,
        )
        card = cards[0]
        user_id = test_user.id
        card_id = card.id

        # Initialize
        await client.post(
            f"/api/v1/study/initialize/{deck.id}",
            headers=auth_headers,
        )

        # First review
        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(card_id),
                "quality": 4,
                "time_taken": 5,
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        result = response.json()

        # Verify next_review_date in response
        assert result["interval"] == 1
        today = date.today()
        expected_next_review = today + timedelta(days=1)
        assert result["next_review_date"] == expected_next_review.isoformat()

        # Verify in database
        db_session.expire_all()
        stats_result = await db_session.execute(
            select(CardStatistics).where(
                CardStatistics.user_id == user_id,
                CardStatistics.card_id == card_id,
            )
        )
        card_stats = stats_result.scalar_one()
        assert card_stats.next_review_date == expected_next_review

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "quality,expected_ef_delta",
        [
            (5, 0.10),  # Perfect - EF increases
            (4, 0.00),  # Good - EF unchanged
            (3, -0.14),  # Difficult - EF decreases
        ],
    )
    async def test_ease_factor_adjustment_successful(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict,
        test_user: User,
        quality: int,
        expected_ef_delta: float,
    ) -> None:
        """Test EF changes correctly based on quality rating (q >= 3).

        For successful recalls (quality 3-5):
        - q=5: EF increases by +0.10
        - q=4: EF unchanged (+0.00)
        - q=3: EF decreases by -0.14
        """
        deck = await DeckFactory.create(
            session=db_session,
            name=f"EF Test Deck Q{quality}",
        )
        cards = await CardFactory.create_batch(
            session=db_session,
            size=1,
            deck_id=deck.id,
        )
        card = cards[0]

        # Initialize
        await client.post(
            f"/api/v1/study/initialize/{deck.id}",
            headers=auth_headers,
        )

        initial_ef = 2.5  # Default starting EF

        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(card.id),
                "quality": quality,
                "time_taken": 5,
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        result = response.json()

        expected_ef = max(1.3, initial_ef + expected_ef_delta)
        assert result["easiness_factor"] == pytest.approx(
            expected_ef, abs=0.01
        ), f"q={quality}: expected EF={expected_ef}, got {result['easiness_factor']}"

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "quality,expected_ef_delta",
        [
            (2, -0.32),  # Incorrect easy to remember - EF decreases
            (1, -0.54),  # Incorrect hard - EF decreases more
            (0, -0.80),  # Complete blackout - EF decreases most
        ],
    )
    async def test_ease_factor_adjustment_failed(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict,
        test_user: User,
        quality: int,
        expected_ef_delta: float,
    ) -> None:
        """Test EF changes correctly based on failed quality rating (q < 3).

        For failed recalls (quality 0-2):
        - q=2: EF decreases by -0.32
        - q=1: EF decreases by -0.54
        - q=0: EF decreases by -0.80

        All failed recalls reset repetitions to 0 and interval to 1.
        """
        deck = await DeckFactory.create(
            session=db_session,
            name=f"EF Failed Test Deck Q{quality}",
        )
        cards = await CardFactory.create_batch(
            session=db_session,
            size=1,
            deck_id=deck.id,
        )
        card = cards[0]

        # Initialize
        await client.post(
            f"/api/v1/study/initialize/{deck.id}",
            headers=auth_headers,
        )

        initial_ef = 2.5  # Default starting EF

        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(card.id),
                "quality": quality,
                "time_taken": 10,
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        result = response.json()

        expected_ef = max(1.3, initial_ef + expected_ef_delta)
        assert result["easiness_factor"] == pytest.approx(
            expected_ef, abs=0.01
        ), f"q={quality}: expected EF={expected_ef}, got {result['easiness_factor']}"

        # Failed recalls reset progress
        assert result["repetitions"] == 0
        assert result["interval"] == 1
        assert result["new_status"] == "learning"

    @pytest.mark.asyncio
    async def test_mastery_threshold(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict,
        test_user: User,
    ) -> None:
        """Test cards become MASTERED when EF >= 2.3 AND interval >= 21.

        Mastery requirements (from SM-2 constants):
        - MASTERY_EF_THRESHOLD = 2.3
        - MASTERY_INTERVAL_THRESHOLD = 21

        With quality=5 each time:
        - Review 1: EF=2.6, interval=1 -> LEARNING
        - Review 2: EF=2.7, interval=6 -> LEARNING
        - Review 3: EF=2.8, interval~17 -> REVIEW (interval < 21)
        - Review 4: EF=2.9, interval~48 -> MASTERED (EF>=2.3, interval>=21)
        """
        deck = await DeckFactory.create(
            session=db_session,
            name="Mastery Test Deck",
        )
        cards = await CardFactory.create_batch(
            session=db_session,
            size=1,
            deck_id=deck.id,
        )
        card = cards[0]

        # Initialize
        await client.post(
            f"/api/v1/study/initialize/{deck.id}",
            headers=auth_headers,
        )

        # Reviews 1-3: Build up to REVIEW status
        for i in range(3):
            response = await client.post(
                "/api/v1/reviews",
                json={
                    "card_id": str(card.id),
                    "quality": 5,
                    "time_taken": 5,
                },
                headers=auth_headers,
            )
            assert response.status_code == 200
            result = response.json()

            # Third review should reach REVIEW status
            if i == 2:
                assert result["new_status"] == "review"
                assert result["repetitions"] == 3
                assert result["easiness_factor"] >= 2.3  # EF threshold met
                # But interval may be < 21, so not mastered yet

        # Review 4: Should achieve MASTERED
        mastery_response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(card.id),
                "quality": 5,
                "time_taken": 5,
            },
            headers=auth_headers,
        )
        assert mastery_response.status_code == 200
        mastery_result = mastery_response.json()

        # Verify mastery achieved
        assert mastery_result["new_status"] == "mastered"
        assert mastery_result["easiness_factor"] >= 2.3
        assert mastery_result["interval"] >= 21
        assert mastery_result["repetitions"] == 4

    @pytest.mark.asyncio
    async def test_mastery_lost_on_failed_review(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict,
        test_user: User,
    ) -> None:
        """Test mastered card loses mastery status on failed review.

        Validates that even a MASTERED card returns to LEARNING
        when user fails to recall it (quality < 3).
        """
        deck = await DeckFactory.create(
            session=db_session,
            name="Mastery Loss Test Deck",
        )
        cards = await CardFactory.create_batch(
            session=db_session,
            size=1,
            deck_id=deck.id,
        )
        card = cards[0]
        user_id = test_user.id
        card_id = card.id

        # Create a pre-mastered card via direct DB setup
        # First initialize to create CardStatistics
        await client.post(
            f"/api/v1/study/initialize/{deck.id}",
            headers=auth_headers,
        )

        # Get the card statistics and update to mastered state
        stats_result = await db_session.execute(
            select(CardStatistics).where(
                CardStatistics.user_id == user_id,
                CardStatistics.card_id == card_id,
            )
        )
        card_stats = stats_result.scalar_one()

        # Set to mastered state
        card_stats.status = CardStatus.MASTERED
        card_stats.easiness_factor = 2.5
        card_stats.interval = 30
        card_stats.repetitions = 6
        card_stats.next_review_date = date.today()  # Due now
        await db_session.commit()

        # Submit failed review
        fail_response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(card_id),
                "quality": 1,  # Failed recall
                "time_taken": 15,
            },
            headers=auth_headers,
        )
        assert fail_response.status_code == 200
        fail_result = fail_response.json()

        # Verify mastery lost
        assert fail_result["previous_status"] == "mastered"
        assert fail_result["new_status"] == "learning"
        assert fail_result["repetitions"] == 0
        assert fail_result["interval"] == 1

    @pytest.mark.asyncio
    async def test_quality_boundary_values(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict,
        test_user: User,
    ) -> None:
        """Test boundary between successful (q>=3) and failed (q<3) reviews.

        Quality 3 is the boundary:
        - q=3: Successful but difficult, repetitions increment
        - q=2: Failed, repetitions reset to 0

        This test verifies the distinct behavior at this boundary.
        """
        deck = await DeckFactory.create(
            session=db_session,
            name="Quality Boundary Test Deck",
        )
        cards = await CardFactory.create_batch(
            session=db_session,
            size=2,
            deck_id=deck.id,
        )

        # Initialize
        await client.post(
            f"/api/v1/study/initialize/{deck.id}",
            headers=auth_headers,
        )

        # Card 1: Quality 3 (successful, difficult)
        q3_response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(cards[0].id),
                "quality": 3,
                "time_taken": 10,
            },
            headers=auth_headers,
        )
        assert q3_response.status_code == 200
        q3_result = q3_response.json()
        assert q3_result["repetitions"] == 1  # Incremented
        assert q3_result["new_status"] == "learning"  # Still learning (need 3 reps)

        # Card 2: Quality 2 (failed)
        q2_response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(cards[1].id),
                "quality": 2,
                "time_taken": 10,
            },
            headers=auth_headers,
        )
        assert q2_response.status_code == 200
        q2_result = q2_response.json()
        assert q2_result["repetitions"] == 0  # Reset
        assert q2_result["interval"] == 1  # Reset
        assert q2_result["new_status"] == "learning"  # Back to learning

    @pytest.mark.asyncio
    async def test_consecutive_perfect_reviews_ef_growth(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict,
        test_user: User,
    ) -> None:
        """Test EF grows with consecutive perfect reviews.

        With quality=5 each time:
        - Initial EF: 2.5
        - After review 1: 2.6 (+0.10)
        - After review 2: 2.7 (+0.10)
        - After review 3: 2.8 (+0.10)
        - After review 4: 2.9 (+0.10)
        """
        deck = await DeckFactory.create(
            session=db_session,
            name="EF Growth Test Deck",
        )
        cards = await CardFactory.create_batch(
            session=db_session,
            size=1,
            deck_id=deck.id,
        )
        card = cards[0]

        # Initialize
        await client.post(
            f"/api/v1/study/initialize/{deck.id}",
            headers=auth_headers,
        )

        expected_efs = [2.6, 2.7, 2.8, 2.9]

        for i, expected_ef in enumerate(expected_efs):
            response = await client.post(
                "/api/v1/reviews",
                json={
                    "card_id": str(card.id),
                    "quality": 5,
                    "time_taken": 5,
                },
                headers=auth_headers,
            )
            assert response.status_code == 200
            result = response.json()

            assert result["easiness_factor"] == pytest.approx(
                expected_ef, abs=0.01
            ), f"Review {i + 1}: expected EF={expected_ef}, got {result['easiness_factor']}"

    @pytest.mark.asyncio
    async def test_ef_floor_enforced(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict,
        test_user: User,
    ) -> None:
        """Test EF never drops below minimum (1.3).

        Even with consecutive q=0 reviews, EF should floor at 1.3.
        """
        deck = await DeckFactory.create(
            session=db_session,
            name="EF Floor Test Deck",
        )
        cards = await CardFactory.create_batch(
            session=db_session,
            size=1,
            deck_id=deck.id,
        )
        card = cards[0]

        # Initialize
        await client.post(
            f"/api/v1/study/initialize/{deck.id}",
            headers=auth_headers,
        )

        # Submit multiple failed reviews to drive EF down
        # Starting EF=2.5, q=0 decreases by 0.8 each time
        # 2.5 - 0.8 = 1.7
        # 1.7 - 0.8 = 0.9 -> clamped to 1.3
        # 1.3 - 0.8 = 0.5 -> clamped to 1.3
        for i in range(5):
            response = await client.post(
                "/api/v1/reviews",
                json={
                    "card_id": str(card.id),
                    "quality": 0,  # Complete blackout
                    "time_taken": 30,
                },
                headers=auth_headers,
            )
            assert response.status_code == 200
            result = response.json()

            # EF should never go below 1.3
            assert (
                result["easiness_factor"] >= 1.3
            ), f"Review {i + 1}: EF {result['easiness_factor']} is below minimum 1.3"

            # After ~2 reviews, should be clamped at 1.3
            if i >= 2:
                assert result["easiness_factor"] == pytest.approx(1.3, abs=0.01)

    @pytest.mark.asyncio
    async def test_alternating_quality_reviews(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict,
        test_user: User,
    ) -> None:
        """Test card behavior with alternating good and bad reviews.

        Simulates realistic learning where user sometimes forgets:
        - Review 1: q=4 (good) -> rep=1
        - Review 2: q=2 (fail) -> rep=0 (reset)
        - Review 3: q=5 (perfect) -> rep=1
        - Review 4: q=4 (good) -> rep=2
        """
        deck = await DeckFactory.create(
            session=db_session,
            name="Alternating Quality Test Deck",
        )
        cards = await CardFactory.create_batch(
            session=db_session,
            size=1,
            deck_id=deck.id,
        )
        card = cards[0]

        # Initialize
        await client.post(
            f"/api/v1/study/initialize/{deck.id}",
            headers=auth_headers,
        )

        # Review 1: Good recall
        r1 = await client.post(
            "/api/v1/reviews",
            json={"card_id": str(card.id), "quality": 4, "time_taken": 5},
            headers=auth_headers,
        )
        assert r1.json()["repetitions"] == 1

        # Review 2: Fail (resets progress)
        r2 = await client.post(
            "/api/v1/reviews",
            json={"card_id": str(card.id), "quality": 2, "time_taken": 10},
            headers=auth_headers,
        )
        assert r2.json()["repetitions"] == 0  # Reset
        assert r2.json()["interval"] == 1  # Reset

        # Review 3: Perfect (start over)
        r3 = await client.post(
            "/api/v1/reviews",
            json={"card_id": str(card.id), "quality": 5, "time_taken": 5},
            headers=auth_headers,
        )
        assert r3.json()["repetitions"] == 1  # Back to 1

        # Review 4: Good
        r4 = await client.post(
            "/api/v1/reviews",
            json={"card_id": str(card.id), "quality": 4, "time_taken": 5},
            headers=auth_headers,
        )
        assert r4.json()["repetitions"] == 2  # Progressing

    @pytest.mark.asyncio
    async def test_database_statistics_consistency(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict,
        test_user: User,
    ) -> None:
        """Test API response matches database CardStatistics state.

        Verifies that after each review, the API response values
        exactly match the database state.
        """
        deck = await DeckFactory.create(
            session=db_session,
            name="DB Consistency Test Deck",
        )
        cards = await CardFactory.create_batch(
            session=db_session,
            size=1,
            deck_id=deck.id,
        )
        card = cards[0]
        user_id = test_user.id
        card_id = card.id

        # Initialize
        await client.post(
            f"/api/v1/study/initialize/{deck.id}",
            headers=auth_headers,
        )

        # Submit review
        response = await client.post(
            "/api/v1/reviews",
            json={
                "card_id": str(card_id),
                "quality": 4,
                "time_taken": 5,
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        api_result = response.json()

        # Verify database matches API response
        db_session.expire_all()
        stats_result = await db_session.execute(
            select(CardStatistics).where(
                CardStatistics.user_id == user_id,
                CardStatistics.card_id == card_id,
            )
        )
        db_stats = stats_result.scalar_one()

        # All values should match
        assert db_stats.easiness_factor == pytest.approx(api_result["easiness_factor"], abs=0.001)
        assert db_stats.interval == api_result["interval"]
        assert db_stats.repetitions == api_result["repetitions"]
        assert db_stats.status.value == api_result["new_status"]
        assert db_stats.next_review_date.isoformat() == api_result["next_review_date"]
