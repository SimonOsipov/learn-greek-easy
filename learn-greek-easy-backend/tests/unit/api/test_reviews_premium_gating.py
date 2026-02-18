"""Unit tests for BP04-03 premium deck gating on review endpoints.

Tests verify:
- POST /reviews: Hard block (403) for free users on cards in premium decks
- POST /reviews/bulk: Hard block (403) for free users when deck_id is premium
- Premium users (ACTIVE/TRIALING/PAST_DUE) and superusers can submit reviews on premium decks
- Non-existent deck_id in bulk endpoint silently skips the gate (no 404)
- OpenAPI 403 documented at router level
- card.deck selectin eager-load means no extra DB query for single review
- DeckRepository.get is called exactly once for bulk review
"""

from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient

from src.db.models import CardStatus, SubscriptionStatus
from src.schemas.sm2 import SM2BulkReviewResult, SM2ReviewResult

# =============================================================================
# Helpers
# =============================================================================


def _make_user_with_status(
    subscription_status: SubscriptionStatus = SubscriptionStatus.NONE,
    is_superuser: bool = False,
) -> MagicMock:
    """Create a User mock with given subscription status."""
    user = MagicMock()
    user.id = uuid4()
    user.email = "user@example.com"
    user.subscription_status = subscription_status
    user.is_superuser = is_superuser
    return user


def _make_card(is_premium: bool = False) -> MagicMock:
    """Create a Card mock whose .deck.is_premium reflects the given flag."""
    card = MagicMock()
    card.id = uuid4()
    card.deck = MagicMock()
    card.deck.id = uuid4()
    card.deck.is_premium = is_premium
    return card


def _make_deck(is_premium: bool = False) -> MagicMock:
    """Create a Deck mock."""
    deck = MagicMock()
    deck.id = uuid4()
    deck.is_premium = is_premium
    return deck


def _make_sm2_result(card_id=None) -> SM2ReviewResult:
    """Create a minimal SM2ReviewResult for mocking."""
    return SM2ReviewResult(
        success=True,
        card_id=card_id or uuid4(),
        quality=4,
        previous_status=CardStatus.NEW,
        new_status=CardStatus.LEARNING,
        easiness_factor=2.5,
        interval=1,
        repetitions=1,
        next_review_date=date.today() + timedelta(days=1),
    )


def _make_bulk_result(session_id: str = "test-session") -> SM2BulkReviewResult:
    """Create a minimal SM2BulkReviewResult for mocking."""
    card_id = uuid4()
    return SM2BulkReviewResult(
        session_id=session_id,
        total_submitted=1,
        successful=1,
        failed=0,
        results=[_make_sm2_result(card_id)],
    )


# =============================================================================
# AC-1: POST /reviews - Hard block for free users on premium deck cards
# =============================================================================


@pytest.mark.unit
class TestSubmitReviewPremiumGating:
    """POST /reviews must return 403 PREMIUM_REQUIRED for free users on premium deck cards."""

    @pytest.mark.asyncio
    async def test_free_user_premium_deck_card_returns_403(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Free user submitting review on card in premium deck gets HTTP 403 PREMIUM_REQUIRED."""
        card_id = uuid4()
        premium_card = _make_card(is_premium=True)

        with patch("src.api.v1.reviews.CardRepository") as mock_card_repo_class:
            mock_card_repo = AsyncMock()
            mock_card_repo.get.return_value = premium_card
            mock_card_repo_class.return_value = mock_card_repo

            response = await client.post(
                "/api/v1/reviews",
                json={"card_id": str(card_id), "quality": 4, "time_taken": 10},
                headers=auth_headers,
            )

        # auth_headers uses test_user which has subscription_status=NONE (FREE tier)
        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "PREMIUM_REQUIRED"

    @pytest.mark.asyncio
    async def test_free_user_free_deck_card_returns_200(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Free user submitting review on card in non-premium deck succeeds."""
        card_id = uuid4()
        free_card = _make_card(is_premium=False)
        mock_result = _make_sm2_result(card_id)

        with (
            patch("src.api.v1.reviews.CardRepository") as mock_card_repo_class,
            patch("src.api.v1.reviews.SM2Service") as mock_service_class,
        ):
            mock_card_repo = AsyncMock()
            mock_card_repo.get.return_value = free_card
            mock_card_repo_class.return_value = mock_card_repo

            mock_service = AsyncMock()
            mock_service.process_review.return_value = mock_result
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/reviews",
                json={"card_id": str(card_id), "quality": 4, "time_taken": 10},
                headers=auth_headers,
            )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_premium_gate_blocks_before_sm2_service(
        self, client: AsyncClient, auth_headers: dict
    ):
        """SM2Service.process_review is NOT called when premium gate blocks the request."""
        card_id = uuid4()
        premium_card = _make_card(is_premium=True)

        with (
            patch("src.api.v1.reviews.CardRepository") as mock_card_repo_class,
            patch("src.api.v1.reviews.SM2Service") as mock_service_class,
        ):
            mock_card_repo = AsyncMock()
            mock_card_repo.get.return_value = premium_card
            mock_card_repo_class.return_value = mock_card_repo

            mock_service = AsyncMock()
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/reviews",
                json={"card_id": str(card_id), "quality": 4, "time_taken": 10},
                headers=auth_headers,
            )

        assert response.status_code == 403
        mock_service.process_review.assert_not_called()

    @pytest.mark.asyncio
    async def test_403_detail_mentions_premium(self, client: AsyncClient, auth_headers: dict):
        """403 response detail message mentions premium requirement."""
        card_id = uuid4()
        premium_card = _make_card(is_premium=True)

        with patch("src.api.v1.reviews.CardRepository") as mock_card_repo_class:
            mock_card_repo = AsyncMock()
            mock_card_repo.get.return_value = premium_card
            mock_card_repo_class.return_value = mock_card_repo

            response = await client.post(
                "/api/v1/reviews",
                json={"card_id": str(card_id), "quality": 4, "time_taken": 10},
                headers=auth_headers,
            )

        assert response.status_code == 403
        data = response.json()
        # The error message should indicate a premium requirement
        error_message = data.get("error", {}).get("message", "") or data.get("detail", "")
        assert "premium" in error_message.lower()

    @pytest.mark.asyncio
    async def test_card_not_found_returns_404_before_premium_check(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Non-existent card returns 404 (not 403 — card check precedes premium check)."""
        card_id = uuid4()

        with patch("src.api.v1.reviews.CardRepository") as mock_card_repo_class:
            mock_card_repo = AsyncMock()
            mock_card_repo.get.return_value = None
            mock_card_repo_class.return_value = mock_card_repo

            response = await client.post(
                "/api/v1/reviews",
                json={"card_id": str(card_id), "quality": 4, "time_taken": 10},
                headers=auth_headers,
            )

        assert response.status_code == 404


# =============================================================================
# AC-2: POST /reviews/bulk - Hard block for free users on premium deck_id
# =============================================================================


@pytest.mark.unit
class TestSubmitBulkReviewsPremiumGating:
    """POST /reviews/bulk must return 403 PREMIUM_REQUIRED for free users on premium deck_id."""

    @pytest.mark.asyncio
    async def test_free_user_premium_deck_id_returns_403(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Free user bulk-reviewing cards in a premium deck gets HTTP 403 PREMIUM_REQUIRED."""
        deck_id = uuid4()
        card_id = uuid4()
        premium_deck = _make_deck(is_premium=True)

        with patch("src.api.v1.reviews.DeckRepository") as mock_deck_repo_class:
            mock_deck_repo = AsyncMock()
            mock_deck_repo.get.return_value = premium_deck
            mock_deck_repo_class.return_value = mock_deck_repo

            response = await client.post(
                "/api/v1/reviews/bulk",
                json={
                    "deck_id": str(deck_id),
                    "session_id": "test-session",
                    "reviews": [{"card_id": str(card_id), "quality": 4, "time_taken": 10}],
                },
                headers=auth_headers,
            )

        # auth_headers uses test_user which has subscription_status=NONE (FREE tier)
        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "PREMIUM_REQUIRED"

    @pytest.mark.asyncio
    async def test_free_user_free_deck_id_returns_200(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Free user bulk-reviewing cards in a non-premium deck succeeds."""
        deck_id = uuid4()
        card_id = uuid4()
        free_deck = _make_deck(is_premium=False)
        mock_result = _make_bulk_result()

        with (
            patch("src.api.v1.reviews.DeckRepository") as mock_deck_repo_class,
            patch("src.api.v1.reviews.SM2Service") as mock_service_class,
        ):
            mock_deck_repo = AsyncMock()
            mock_deck_repo.get.return_value = free_deck
            mock_deck_repo_class.return_value = mock_deck_repo

            mock_service = AsyncMock()
            mock_service.process_bulk_reviews.return_value = mock_result
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/reviews/bulk",
                json={
                    "deck_id": str(deck_id),
                    "session_id": "test-session",
                    "reviews": [{"card_id": str(card_id), "quality": 4, "time_taken": 10}],
                },
                headers=auth_headers,
            )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_nonexistent_deck_id_returns_404(self, client: AsyncClient, auth_headers: dict):
        """Non-existent deck_id (repo returns None) returns 404.

        The implementation raises DeckNotFoundException when the deck does not exist,
        closing the security gap where a free user could bypass the premium gate by
        supplying an invalid deck_id.
        """
        deck_id = uuid4()
        card_id = uuid4()

        with (
            patch("src.api.v1.reviews.DeckRepository") as mock_deck_repo_class,
            patch("src.api.v1.reviews.SM2Service") as mock_service_class,
        ):
            mock_deck_repo = AsyncMock()
            mock_deck_repo.get.return_value = None  # Deck does not exist
            mock_deck_repo_class.return_value = mock_deck_repo

            mock_service = AsyncMock()
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/reviews/bulk",
                json={
                    "deck_id": str(deck_id),
                    "session_id": "test-session",
                    "reviews": [{"card_id": str(card_id), "quality": 4, "time_taken": 10}],
                },
                headers=auth_headers,
            )

        assert response.status_code == 404
        mock_service.process_bulk_reviews.assert_not_called()

    @pytest.mark.asyncio
    async def test_bulk_premium_gate_blocks_before_sm2_service(
        self, client: AsyncClient, auth_headers: dict
    ):
        """SM2Service.process_bulk_reviews is NOT called when premium gate blocks."""
        deck_id = uuid4()
        card_id = uuid4()
        premium_deck = _make_deck(is_premium=True)

        with (
            patch("src.api.v1.reviews.DeckRepository") as mock_deck_repo_class,
            patch("src.api.v1.reviews.SM2Service") as mock_service_class,
        ):
            mock_deck_repo = AsyncMock()
            mock_deck_repo.get.return_value = premium_deck
            mock_deck_repo_class.return_value = mock_deck_repo

            mock_service = AsyncMock()
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/reviews/bulk",
                json={
                    "deck_id": str(deck_id),
                    "session_id": "test-session",
                    "reviews": [{"card_id": str(card_id), "quality": 4, "time_taken": 10}],
                },
                headers=auth_headers,
            )

        assert response.status_code == 403
        mock_service.process_bulk_reviews.assert_not_called()

    @pytest.mark.asyncio
    async def test_deck_repository_get_called_once_for_bulk(
        self, client: AsyncClient, auth_headers: dict
    ):
        """DeckRepository.get is called exactly once (the +1 DB query for bulk gating)."""
        deck_id = uuid4()
        card_id = uuid4()
        free_deck = _make_deck(is_premium=False)
        mock_result = _make_bulk_result()

        with (
            patch("src.api.v1.reviews.DeckRepository") as mock_deck_repo_class,
            patch("src.api.v1.reviews.SM2Service") as mock_service_class,
        ):
            mock_deck_repo = AsyncMock()
            mock_deck_repo.get.return_value = free_deck
            mock_deck_repo_class.return_value = mock_deck_repo

            mock_service = AsyncMock()
            mock_service.process_bulk_reviews.return_value = mock_result
            mock_service_class.return_value = mock_service

            await client.post(
                "/api/v1/reviews/bulk",
                json={
                    "deck_id": str(deck_id),
                    "session_id": "test-session",
                    "reviews": [{"card_id": str(card_id), "quality": 4, "time_taken": 10}],
                },
                headers=auth_headers,
            )

        # Verify exactly one deck lookup (the +1 DB query)
        mock_deck_repo.get.assert_called_once_with(deck_id)


# =============================================================================
# AC-3: Zero additional DB queries for single review (selectin eager load)
# =============================================================================


@pytest.mark.unit
class TestSingleReviewZeroExtraDbQueries:
    """POST /reviews accesses card.deck without any additional DB query.

    The Card.deck relationship uses lazy='selectin', so when CardRepository.get()
    loads the card, the deck is eagerly loaded in the same SELECT IN round-trip.
    check_premium_deck_access(current_user, card.deck) accesses an already-loaded object.
    """

    @pytest.mark.asyncio
    async def test_card_repository_get_called_once_only(
        self, client: AsyncClient, auth_headers: dict
    ):
        """CardRepository.get is called exactly once — the deck comes from selectin load."""
        card_id = uuid4()
        free_card = _make_card(is_premium=False)
        mock_result = _make_sm2_result(card_id)

        with (
            patch("src.api.v1.reviews.CardRepository") as mock_card_repo_class,
            patch("src.api.v1.reviews.SM2Service") as mock_service_class,
        ):
            mock_card_repo = AsyncMock()
            mock_card_repo.get.return_value = free_card
            mock_card_repo_class.return_value = mock_card_repo

            mock_service = AsyncMock()
            mock_service.process_review.return_value = mock_result
            mock_service_class.return_value = mock_service

            await client.post(
                "/api/v1/reviews",
                json={"card_id": str(card_id), "quality": 4, "time_taken": 10},
                headers=auth_headers,
            )

        # Only one call: CardRepository.get(review.card_id)
        mock_card_repo.get.assert_called_once_with(card_id)

    @pytest.mark.asyncio
    async def test_no_deck_repository_used_in_single_review(
        self, client: AsyncClient, auth_headers: dict
    ):
        """DeckRepository is NOT instantiated or used for the single review endpoint."""
        card_id = uuid4()
        free_card = _make_card(is_premium=False)
        mock_result = _make_sm2_result(card_id)

        with (
            patch("src.api.v1.reviews.CardRepository") as mock_card_repo_class,
            patch("src.api.v1.reviews.DeckRepository") as mock_deck_repo_class,
            patch("src.api.v1.reviews.SM2Service") as mock_service_class,
        ):
            mock_card_repo = AsyncMock()
            mock_card_repo.get.return_value = free_card
            mock_card_repo_class.return_value = mock_card_repo

            mock_service = AsyncMock()
            mock_service.process_review.return_value = mock_result
            mock_service_class.return_value = mock_service

            await client.post(
                "/api/v1/reviews",
                json={"card_id": str(card_id), "quality": 4, "time_taken": 10},
                headers=auth_headers,
            )

        # DeckRepository must NOT be used in the single review path
        mock_deck_repo_class.assert_not_called()


# =============================================================================
# AC-5: Premium/trialing/superuser users can review premium deck cards
# =============================================================================


@pytest.mark.unit
class TestPremiumUsersCanReviewPremiumDecks:
    """Premium users (ACTIVE, TRIALING, PAST_DUE) and superusers pass the gate."""

    @pytest.mark.asyncio
    async def test_active_user_can_review_premium_deck_card(
        self, client: AsyncClient, auth_headers: dict, test_user, db_session
    ):
        """User with ACTIVE subscription can review cards in a premium deck."""
        test_user.subscription_status = SubscriptionStatus.ACTIVE
        await db_session.commit()

        card_id = uuid4()
        premium_card = _make_card(is_premium=True)
        mock_result = _make_sm2_result(card_id)

        with (
            patch("src.api.v1.reviews.CardRepository") as mock_card_repo_class,
            patch("src.api.v1.reviews.SM2Service") as mock_service_class,
        ):
            mock_card_repo = AsyncMock()
            mock_card_repo.get.return_value = premium_card
            mock_card_repo_class.return_value = mock_card_repo

            mock_service = AsyncMock()
            mock_service.process_review.return_value = mock_result
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/reviews",
                json={"card_id": str(card_id), "quality": 4, "time_taken": 10},
                headers=auth_headers,
            )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_trialing_user_can_review_premium_deck_card(
        self, client: AsyncClient, auth_headers: dict, test_user, db_session
    ):
        """User with TRIALING subscription can review cards in a premium deck."""
        test_user.subscription_status = SubscriptionStatus.TRIALING
        await db_session.commit()

        card_id = uuid4()
        premium_card = _make_card(is_premium=True)
        mock_result = _make_sm2_result(card_id)

        with (
            patch("src.api.v1.reviews.CardRepository") as mock_card_repo_class,
            patch("src.api.v1.reviews.SM2Service") as mock_service_class,
        ):
            mock_card_repo = AsyncMock()
            mock_card_repo.get.return_value = premium_card
            mock_card_repo_class.return_value = mock_card_repo

            mock_service = AsyncMock()
            mock_service.process_review.return_value = mock_result
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/reviews",
                json={"card_id": str(card_id), "quality": 4, "time_taken": 10},
                headers=auth_headers,
            )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_past_due_user_can_review_premium_deck_card(
        self, client: AsyncClient, auth_headers: dict, test_user, db_session
    ):
        """User with PAST_DUE subscription can review cards in a premium deck."""
        test_user.subscription_status = SubscriptionStatus.PAST_DUE
        await db_session.commit()

        card_id = uuid4()
        premium_card = _make_card(is_premium=True)
        mock_result = _make_sm2_result(card_id)

        with (
            patch("src.api.v1.reviews.CardRepository") as mock_card_repo_class,
            patch("src.api.v1.reviews.SM2Service") as mock_service_class,
        ):
            mock_card_repo = AsyncMock()
            mock_card_repo.get.return_value = premium_card
            mock_card_repo_class.return_value = mock_card_repo

            mock_service = AsyncMock()
            mock_service.process_review.return_value = mock_result
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/reviews",
                json={"card_id": str(card_id), "quality": 4, "time_taken": 10},
                headers=auth_headers,
            )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_superuser_can_review_premium_deck_card(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Superuser can review cards in a premium deck regardless of subscription."""
        card_id = uuid4()
        premium_card = _make_card(is_premium=True)
        mock_result = _make_sm2_result(card_id)

        with (
            patch("src.api.v1.reviews.CardRepository") as mock_card_repo_class,
            patch("src.api.v1.reviews.SM2Service") as mock_service_class,
        ):
            mock_card_repo = AsyncMock()
            mock_card_repo.get.return_value = premium_card
            mock_card_repo_class.return_value = mock_card_repo

            mock_service = AsyncMock()
            mock_service.process_review.return_value = mock_result
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/reviews",
                json={"card_id": str(card_id), "quality": 4, "time_taken": 10},
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_active_user_can_bulk_review_premium_deck(
        self, client: AsyncClient, auth_headers: dict, test_user, db_session
    ):
        """User with ACTIVE subscription can bulk-review cards in a premium deck."""
        test_user.subscription_status = SubscriptionStatus.ACTIVE
        await db_session.commit()

        deck_id = uuid4()
        card_id = uuid4()
        premium_deck = _make_deck(is_premium=True)
        mock_result = _make_bulk_result()

        with (
            patch("src.api.v1.reviews.DeckRepository") as mock_deck_repo_class,
            patch("src.api.v1.reviews.SM2Service") as mock_service_class,
        ):
            mock_deck_repo = AsyncMock()
            mock_deck_repo.get.return_value = premium_deck
            mock_deck_repo_class.return_value = mock_deck_repo

            mock_service = AsyncMock()
            mock_service.process_bulk_reviews.return_value = mock_result
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/reviews/bulk",
                json={
                    "deck_id": str(deck_id),
                    "session_id": "test-session",
                    "reviews": [{"card_id": str(card_id), "quality": 4, "time_taken": 10}],
                },
                headers=auth_headers,
            )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_superuser_can_bulk_review_premium_deck(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Superuser can bulk-review cards in a premium deck."""
        deck_id = uuid4()
        card_id = uuid4()
        premium_deck = _make_deck(is_premium=True)
        mock_result = _make_bulk_result()

        with (
            patch("src.api.v1.reviews.DeckRepository") as mock_deck_repo_class,
            patch("src.api.v1.reviews.SM2Service") as mock_service_class,
        ):
            mock_deck_repo = AsyncMock()
            mock_deck_repo.get.return_value = premium_deck
            mock_deck_repo_class.return_value = mock_deck_repo

            mock_service = AsyncMock()
            mock_service.process_bulk_reviews.return_value = mock_result
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/reviews/bulk",
                json={
                    "deck_id": str(deck_id),
                    "session_id": "test-session",
                    "reviews": [{"card_id": str(card_id), "quality": 4, "time_taken": 10}],
                },
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200


# =============================================================================
# AC-5 (parametrized): All free-tier statuses block, all premium statuses allow
# =============================================================================


@pytest.mark.unit
class TestAllSubscriptionStatusesForSingleReview:
    """Parametrized status checks for POST /reviews endpoint."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "status",
        [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIALING,
            SubscriptionStatus.PAST_DUE,
        ],
    )
    async def test_premium_status_allows_review_on_premium_deck(
        self,
        status: SubscriptionStatus,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session,
    ):
        """Each premium status variant allows reviewing cards in a premium deck."""
        test_user.subscription_status = status
        await db_session.commit()

        card_id = uuid4()
        premium_card = _make_card(is_premium=True)
        mock_result = _make_sm2_result(card_id)

        with (
            patch("src.api.v1.reviews.CardRepository") as mock_card_repo_class,
            patch("src.api.v1.reviews.SM2Service") as mock_service_class,
        ):
            mock_card_repo = AsyncMock()
            mock_card_repo.get.return_value = premium_card
            mock_card_repo_class.return_value = mock_card_repo

            mock_service = AsyncMock()
            mock_service.process_review.return_value = mock_result
            mock_service_class.return_value = mock_service

            response = await client.post(
                "/api/v1/reviews",
                json={"card_id": str(card_id), "quality": 4, "time_taken": 10},
                headers=auth_headers,
            )

        assert (
            response.status_code == 200
        ), f"Expected 200 for status={status}, got {response.status_code}"

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "status",
        [
            SubscriptionStatus.NONE,
            SubscriptionStatus.CANCELED,
            SubscriptionStatus.INCOMPLETE,
            SubscriptionStatus.UNPAID,
        ],
    )
    async def test_free_status_blocks_review_on_premium_deck(
        self,
        status: SubscriptionStatus,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session,
    ):
        """Each free-tier status variant blocks reviewing cards in a premium deck."""
        test_user.subscription_status = status
        await db_session.commit()

        card_id = uuid4()
        premium_card = _make_card(is_premium=True)

        with patch("src.api.v1.reviews.CardRepository") as mock_card_repo_class:
            mock_card_repo = AsyncMock()
            mock_card_repo.get.return_value = premium_card
            mock_card_repo_class.return_value = mock_card_repo

            response = await client.post(
                "/api/v1/reviews",
                json={"card_id": str(card_id), "quality": 4, "time_taken": 10},
                headers=auth_headers,
            )

        assert (
            response.status_code == 403
        ), f"Expected 403 for status={status}, got {response.status_code}"


# =============================================================================
# AC-6: OpenAPI 403 response documented on router
# =============================================================================


@pytest.mark.unit
class TestOpenApi403DocumentationReviews:
    """OpenAPI schema includes 403 response on the reviews router."""

    def test_reviews_router_level_403_response_defined(self):
        """Reviews router-level responses dict includes 403 with premium description."""
        from src.api.v1.reviews import router

        assert 403 in router.responses
        assert "premium" in router.responses[403]["description"].lower()

    def test_reviews_router_has_submit_review_route(self):
        """Reviews router includes POST '' (submit_review) route."""
        from src.api.v1.reviews import router

        routes = {r.path: r for r in router.routes}
        assert "" in routes

    def test_reviews_router_has_bulk_review_route(self):
        """Reviews router includes POST '/bulk' route."""
        from src.api.v1.reviews import router

        routes = {r.path: r for r in router.routes}
        assert "/bulk" in routes
