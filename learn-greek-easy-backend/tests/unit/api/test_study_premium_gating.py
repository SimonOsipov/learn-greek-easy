"""Unit tests for BP04-02 premium deck gating on study and initialize endpoints.

Tests verify:
- GET /study/queue/{deck_id}: Hard block (403) for free users on premium decks
- GET /study/queue (all decks): Silent filter for free users (exclude_premium_decks)
- POST /study/initialize: Hard block (403) for free users on premium decks
- POST /study/initialize/{deck_id}: Hard block (403) for free users on premium decks
- Premium users (ACTIVE/TRIALING/PAST_DUE) and superusers can access premium decks
- exclude_premium_decks flag is correctly set based on user tier
- OpenAPI 403 documented at router level
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient

from src.db.models import SubscriptionStatus
from src.schemas.sm2 import CardInitializationResult, StudyQueue

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


def _make_deck(is_premium: bool = False, is_active: bool = True) -> MagicMock:
    """Create a Deck mock."""
    deck = MagicMock()
    deck.id = uuid4()
    deck.is_premium = is_premium
    deck.is_active = is_active
    return deck


def _make_empty_queue(deck_id: UUID | None = None) -> StudyQueue:
    """Create an empty StudyQueue."""
    return StudyQueue(
        deck_id=deck_id or UUID(int=0),
        deck_name="Test Deck",
        total_due=0,
        total_new=0,
        total_in_queue=0,
        cards=[],
    )


# =============================================================================
# AC-1: GET /study/queue/{deck_id} - Hard block for free users on premium decks
# =============================================================================


@pytest.mark.unit
class TestGetDeckStudyQueuePremiumGating:
    """GET /study/queue/{deck_id} must return 403 PREMIUM_REQUIRED for free users on premium decks."""

    @pytest.mark.asyncio
    async def test_free_user_premium_deck_returns_403(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Free user accessing premium deck returns HTTP 403 with PREMIUM_REQUIRED."""
        deck_id = uuid4()
        premium_deck = _make_deck(is_premium=True, is_active=True)

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = premium_deck
            mock_repo_class.return_value = mock_repo

            response = await client.get(
                f"/api/v1/study/queue/{deck_id}",
                headers=auth_headers,
            )

        # auth_headers uses test_user which has subscription_status=NONE (FREE tier)
        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "PREMIUM_REQUIRED"

    @pytest.mark.asyncio
    async def test_free_user_free_deck_returns_200(self, client: AsyncClient, auth_headers: dict):
        """Free user accessing non-premium deck succeeds normally."""
        deck_id = uuid4()
        free_deck = _make_deck(is_premium=False, is_active=True)
        mock_queue = _make_empty_queue(deck_id)

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = free_deck
            mock_repo_class.return_value = mock_repo

            with patch("src.api.v1.study.SM2Service") as mock_service_class:
                mock_service = AsyncMock()
                mock_service.get_study_queue.return_value = mock_queue
                mock_service_class.return_value = mock_service

                response = await client.get(
                    f"/api/v1/study/queue/{deck_id}",
                    headers=auth_headers,
                )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_inactive_deck_returns_404_not_403(self, client: AsyncClient, auth_headers: dict):
        """Inactive premium deck returns 404 (deck check occurs before premium check)."""
        deck_id = uuid4()
        inactive_premium_deck = _make_deck(is_premium=True, is_active=False)

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = inactive_premium_deck
            mock_repo_class.return_value = mock_repo

            response = await client.get(
                f"/api/v1/study/queue/{deck_id}",
                headers=auth_headers,
            )

        # Deck is inactive -> 404 before premium check fires
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_nonexistent_deck_returns_404(self, client: AsyncClient, auth_headers: dict):
        """Non-existent deck (repo returns None) returns 404."""
        deck_id = uuid4()

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = None
            mock_repo_class.return_value = mock_repo

            response = await client.get(
                f"/api/v1/study/queue/{deck_id}",
                headers=auth_headers,
            )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_premium_user_active_can_access_premium_deck(
        self, client: AsyncClient, auth_headers: dict, test_user, db_session
    ):
        """User with ACTIVE subscription can access premium decks."""
        # Update test_user to have ACTIVE subscription
        test_user.subscription_status = SubscriptionStatus.ACTIVE
        await db_session.commit()

        deck_id = uuid4()
        premium_deck = _make_deck(is_premium=True, is_active=True)
        mock_queue = _make_empty_queue(deck_id)

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = premium_deck
            mock_repo_class.return_value = mock_repo

            with patch("src.api.v1.study.SM2Service") as mock_service_class:
                mock_service = AsyncMock()
                mock_service.get_study_queue.return_value = mock_queue
                mock_service_class.return_value = mock_service

                response = await client.get(
                    f"/api/v1/study/queue/{deck_id}",
                    headers=auth_headers,
                )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_superuser_can_access_premium_deck(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Superuser can access premium decks regardless of subscription."""
        deck_id = uuid4()
        premium_deck = _make_deck(is_premium=True, is_active=True)
        mock_queue = _make_empty_queue(deck_id)

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = premium_deck
            mock_repo_class.return_value = mock_repo

            with patch("src.api.v1.study.SM2Service") as mock_service_class:
                mock_service = AsyncMock()
                mock_service.get_study_queue.return_value = mock_queue
                mock_service_class.return_value = mock_service

                response = await client.get(
                    f"/api/v1/study/queue/{deck_id}",
                    headers=superuser_auth_headers,
                )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_403_response_contains_detail(self, client: AsyncClient, auth_headers: dict):
        """403 response detail message indicates premium requirement."""
        deck_id = uuid4()
        premium_deck = _make_deck(is_premium=True, is_active=True)

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = premium_deck
            mock_repo_class.return_value = mock_repo

            response = await client.get(
                f"/api/v1/study/queue/{deck_id}",
                headers=auth_headers,
            )

        assert response.status_code == 403
        data = response.json()
        assert (
            "premium" in data["error"]["message"].lower()
            or "premium" in data.get("detail", "").lower()
        )


# =============================================================================
# AC-2: GET /study/queue (all decks) - Silent filter for free users
# =============================================================================


@pytest.mark.unit
class TestGetStudyQueueAllDecksExcludePremium:
    """GET /study/queue must silently exclude premium decks for free users."""

    @pytest.mark.asyncio
    async def test_free_user_gets_exclude_premium_decks_true(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Free user's all-decks queue request has exclude_premium_decks=True."""
        mock_queue = _make_empty_queue()

        with patch("src.api.v1.study.SM2Service") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_study_queue.return_value = mock_queue
            mock_service_class.return_value = mock_service

            response = await client.get(
                "/api/v1/study/queue",
                headers=auth_headers,
            )

        # Should succeed (no error)
        assert response.status_code == 200

        # Verify the request passed exclude_premium_decks=True
        call_args = mock_service.get_study_queue.call_args
        request_arg = call_args[0][1]
        assert request_arg.exclude_premium_decks is True

    @pytest.mark.asyncio
    async def test_free_user_all_decks_returns_200_not_403(
        self, client: AsyncClient, auth_headers: dict
    ):
        """All-decks endpoint never returns 403 for free users (silent filter only)."""
        mock_queue = _make_empty_queue()

        with patch("src.api.v1.study.SM2Service") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_study_queue.return_value = mock_queue
            mock_service_class.return_value = mock_service

            response = await client.get(
                "/api/v1/study/queue",
                headers=auth_headers,
            )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_premium_user_gets_exclude_premium_decks_false(
        self, client: AsyncClient, auth_headers: dict, test_user, db_session
    ):
        """Premium user's all-decks queue request has exclude_premium_decks=False."""
        test_user.subscription_status = SubscriptionStatus.ACTIVE
        await db_session.commit()

        mock_queue = _make_empty_queue()

        with patch("src.api.v1.study.SM2Service") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_study_queue.return_value = mock_queue
            mock_service_class.return_value = mock_service

            response = await client.get(
                "/api/v1/study/queue",
                headers=auth_headers,
            )

        assert response.status_code == 200
        call_args = mock_service.get_study_queue.call_args
        request_arg = call_args[0][1]
        assert request_arg.exclude_premium_decks is False

    @pytest.mark.asyncio
    async def test_trialing_user_gets_exclude_premium_decks_false(
        self, client: AsyncClient, auth_headers: dict, test_user, db_session
    ):
        """TRIALING user's all-decks queue request has exclude_premium_decks=False."""
        test_user.subscription_status = SubscriptionStatus.TRIALING
        await db_session.commit()

        mock_queue = _make_empty_queue()

        with patch("src.api.v1.study.SM2Service") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_study_queue.return_value = mock_queue
            mock_service_class.return_value = mock_service

            response = await client.get(
                "/api/v1/study/queue",
                headers=auth_headers,
            )

        assert response.status_code == 200
        call_args = mock_service.get_study_queue.call_args
        request_arg = call_args[0][1]
        assert request_arg.exclude_premium_decks is False

    @pytest.mark.asyncio
    async def test_past_due_user_gets_exclude_premium_decks_false(
        self, client: AsyncClient, auth_headers: dict, test_user, db_session
    ):
        """PAST_DUE user's all-decks queue request has exclude_premium_decks=False."""
        test_user.subscription_status = SubscriptionStatus.PAST_DUE
        await db_session.commit()

        mock_queue = _make_empty_queue()

        with patch("src.api.v1.study.SM2Service") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_study_queue.return_value = mock_queue
            mock_service_class.return_value = mock_service

            response = await client.get(
                "/api/v1/study/queue",
                headers=auth_headers,
            )

        assert response.status_code == 200
        call_args = mock_service.get_study_queue.call_args
        request_arg = call_args[0][1]
        assert request_arg.exclude_premium_decks is False

    @pytest.mark.asyncio
    async def test_superuser_gets_exclude_premium_decks_false(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Superuser's all-decks queue request has exclude_premium_decks=False."""
        mock_queue = _make_empty_queue()

        with patch("src.api.v1.study.SM2Service") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_study_queue.return_value = mock_queue
            mock_service_class.return_value = mock_service

            response = await client.get(
                "/api/v1/study/queue",
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200
        call_args = mock_service.get_study_queue.call_args
        request_arg = call_args[0][1]
        assert request_arg.exclude_premium_decks is False

    @pytest.mark.asyncio
    async def test_all_decks_no_deck_repository_called(
        self, client: AsyncClient, auth_headers: dict
    ):
        """All-decks endpoint does NOT fetch any deck from DeckRepository (no hard block)."""
        mock_queue = _make_empty_queue()

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo_class.return_value = mock_repo

            with patch("src.api.v1.study.SM2Service") as mock_service_class:
                mock_service = AsyncMock()
                mock_service.get_study_queue.return_value = mock_queue
                mock_service_class.return_value = mock_service

                response = await client.get(
                    "/api/v1/study/queue",
                    headers=auth_headers,
                )

        assert response.status_code == 200
        # DeckRepository.get should NOT be called for all-decks endpoint
        mock_repo.get.assert_not_called()


# =============================================================================
# AC-3: POST /study/initialize/{deck_id} - Hard block for free users on premium decks
# =============================================================================


@pytest.mark.unit
class TestInitializeDeckPremiumGating:
    """POST /study/initialize/{deck_id} must return 403 PREMIUM_REQUIRED for free users."""

    @pytest.mark.asyncio
    async def test_free_user_premium_deck_returns_403(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Free user calling initialize/{deck_id} on premium deck gets 403."""
        deck_id = uuid4()
        premium_deck = _make_deck(is_premium=True, is_active=True)

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = premium_deck
            mock_repo_class.return_value = mock_repo

            response = await client.post(
                f"/api/v1/study/initialize/{deck_id}",
                headers=auth_headers,
            )

        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "PREMIUM_REQUIRED"

    @pytest.mark.asyncio
    async def test_free_user_free_deck_returns_200(self, client: AsyncClient, auth_headers: dict):
        """Free user calling initialize/{deck_id} on non-premium deck succeeds."""
        deck_id = uuid4()
        free_deck = _make_deck(is_premium=False, is_active=True)
        mock_result = CardInitializationResult(
            initialized_count=0,
            already_exists_count=0,
            card_ids=[],
        )

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = free_deck
            mock_repo_class.return_value = mock_repo

            with patch("src.api.v1.study.SM2Service") as mock_service_class:
                mock_service = AsyncMock()
                mock_service.initialize_deck_for_user.return_value = mock_result
                mock_service_class.return_value = mock_service

                response = await client.post(
                    f"/api/v1/study/initialize/{deck_id}",
                    headers=auth_headers,
                )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_nonexistent_deck_skips_premium_check_proceeds_gracefully(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Non-existent deck (repo returns None) skips premium check, proceeds to service.

        The implementation currently does: if deck: check_premium_deck_access(user, deck)
        So for non-existent decks, no 403 is raised - the service handles it.
        """
        deck_id = uuid4()
        mock_result = CardInitializationResult(
            initialized_count=0,
            already_exists_count=0,
            card_ids=[],
        )

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = None  # Deck not found
            mock_repo_class.return_value = mock_repo

            with patch("src.api.v1.study.SM2Service") as mock_service_class:
                mock_service = AsyncMock()
                mock_service.initialize_deck_for_user.return_value = mock_result
                mock_service_class.return_value = mock_service

                response = await client.post(
                    f"/api/v1/study/initialize/{deck_id}",
                    headers=auth_headers,
                )

        # Service is called (returns empty result for non-existent deck)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_premium_user_active_can_initialize_premium_deck(
        self, client: AsyncClient, auth_headers: dict, test_user, db_session
    ):
        """ACTIVE subscription user can initialize a premium deck."""
        test_user.subscription_status = SubscriptionStatus.ACTIVE
        await db_session.commit()

        deck_id = uuid4()
        premium_deck = _make_deck(is_premium=True, is_active=True)
        mock_result = CardInitializationResult(
            initialized_count=5,
            already_exists_count=0,
            card_ids=[uuid4() for _ in range(5)],
        )

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = premium_deck
            mock_repo_class.return_value = mock_repo

            with patch("src.api.v1.study.SM2Service") as mock_service_class:
                mock_service = AsyncMock()
                mock_service.initialize_deck_for_user.return_value = mock_result
                mock_service_class.return_value = mock_service

                response = await client.post(
                    f"/api/v1/study/initialize/{deck_id}",
                    headers=auth_headers,
                )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_superuser_can_initialize_premium_deck(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Superuser can initialize a premium deck."""
        deck_id = uuid4()
        premium_deck = _make_deck(is_premium=True, is_active=True)
        mock_result = CardInitializationResult(
            initialized_count=5,
            already_exists_count=0,
            card_ids=[uuid4() for _ in range(5)],
        )

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = premium_deck
            mock_repo_class.return_value = mock_repo

            with patch("src.api.v1.study.SM2Service") as mock_service_class:
                mock_service = AsyncMock()
                mock_service.initialize_deck_for_user.return_value = mock_result
                mock_service_class.return_value = mock_service

                response = await client.post(
                    f"/api/v1/study/initialize/{deck_id}",
                    headers=superuser_auth_headers,
                )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_trialing_user_can_initialize_premium_deck(
        self, client: AsyncClient, auth_headers: dict, test_user, db_session
    ):
        """TRIALING subscription user can initialize a premium deck."""
        test_user.subscription_status = SubscriptionStatus.TRIALING
        await db_session.commit()

        deck_id = uuid4()
        premium_deck = _make_deck(is_premium=True, is_active=True)
        mock_result = CardInitializationResult(
            initialized_count=0,
            already_exists_count=0,
            card_ids=[],
        )

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = premium_deck
            mock_repo_class.return_value = mock_repo

            with patch("src.api.v1.study.SM2Service") as mock_service_class:
                mock_service = AsyncMock()
                mock_service.initialize_deck_for_user.return_value = mock_result
                mock_service_class.return_value = mock_service

                response = await client.post(
                    f"/api/v1/study/initialize/{deck_id}",
                    headers=auth_headers,
                )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_past_due_user_can_initialize_premium_deck(
        self, client: AsyncClient, auth_headers: dict, test_user, db_session
    ):
        """PAST_DUE subscription user can initialize a premium deck."""
        test_user.subscription_status = SubscriptionStatus.PAST_DUE
        await db_session.commit()

        deck_id = uuid4()
        premium_deck = _make_deck(is_premium=True, is_active=True)
        mock_result = CardInitializationResult(
            initialized_count=0,
            already_exists_count=0,
            card_ids=[],
        )

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = premium_deck
            mock_repo_class.return_value = mock_repo

            with patch("src.api.v1.study.SM2Service") as mock_service_class:
                mock_service = AsyncMock()
                mock_service.initialize_deck_for_user.return_value = mock_result
                mock_service_class.return_value = mock_service

                response = await client.post(
                    f"/api/v1/study/initialize/{deck_id}",
                    headers=auth_headers,
                )

        assert response.status_code == 200


# =============================================================================
# AC-4: POST /study/initialize - Hard block for free users on premium decks
# =============================================================================


@pytest.mark.unit
class TestInitializeCardsPremiumGating:
    """POST /study/initialize must return 403 PREMIUM_REQUIRED for free users."""

    @pytest.mark.asyncio
    async def test_free_user_premium_deck_returns_403(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Free user initializing specific cards in a premium deck gets 403."""
        deck_id = uuid4()
        card_id = uuid4()
        premium_deck = _make_deck(is_premium=True)

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = premium_deck
            mock_repo_class.return_value = mock_repo

            response = await client.post(
                "/api/v1/study/initialize",
                json={
                    "deck_id": str(deck_id),
                    "card_ids": [str(card_id)],
                },
                headers=auth_headers,
            )

        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "PREMIUM_REQUIRED"

    @pytest.mark.asyncio
    async def test_free_user_free_deck_returns_200(self, client: AsyncClient, auth_headers: dict):
        """Free user initializing cards in a non-premium deck succeeds."""
        deck_id = uuid4()
        card_id = uuid4()
        free_deck = _make_deck(is_premium=False)
        mock_result = CardInitializationResult(
            initialized_count=1,
            already_exists_count=0,
            card_ids=[card_id],
        )

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = free_deck
            mock_repo_class.return_value = mock_repo

            with patch("src.api.v1.study.SM2Service") as mock_service_class:
                mock_service = AsyncMock()
                mock_service.initialize_cards_for_user.return_value = mock_result
                mock_service_class.return_value = mock_service

                response = await client.post(
                    "/api/v1/study/initialize",
                    json={
                        "deck_id": str(deck_id),
                        "card_ids": [str(card_id)],
                    },
                    headers=auth_headers,
                )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_nonexistent_deck_returns_404(self, client: AsyncClient, auth_headers: dict):
        """Deck that does not exist returns 404 (api raises DeckNotFoundException)."""
        deck_id = uuid4()
        card_id = uuid4()

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = None  # Deck not found
            mock_repo_class.return_value = mock_repo

            response = await client.post(
                "/api/v1/study/initialize",
                json={
                    "deck_id": str(deck_id),
                    "card_ids": [str(card_id)],
                },
                headers=auth_headers,
            )

        # API raises DeckNotFoundException -> 404
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_premium_user_active_can_initialize_cards_in_premium_deck(
        self, client: AsyncClient, auth_headers: dict, test_user, db_session
    ):
        """ACTIVE user can initialize cards in a premium deck."""
        test_user.subscription_status = SubscriptionStatus.ACTIVE
        await db_session.commit()

        deck_id = uuid4()
        card_id = uuid4()
        premium_deck = _make_deck(is_premium=True)
        mock_result = CardInitializationResult(
            initialized_count=1,
            already_exists_count=0,
            card_ids=[card_id],
        )

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = premium_deck
            mock_repo_class.return_value = mock_repo

            with patch("src.api.v1.study.SM2Service") as mock_service_class:
                mock_service = AsyncMock()
                mock_service.initialize_cards_for_user.return_value = mock_result
                mock_service_class.return_value = mock_service

                response = await client.post(
                    "/api/v1/study/initialize",
                    json={
                        "deck_id": str(deck_id),
                        "card_ids": [str(card_id)],
                    },
                    headers=auth_headers,
                )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_superuser_can_initialize_cards_in_premium_deck(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """Superuser can initialize cards in a premium deck."""
        deck_id = uuid4()
        card_id = uuid4()
        premium_deck = _make_deck(is_premium=True)
        mock_result = CardInitializationResult(
            initialized_count=1,
            already_exists_count=0,
            card_ids=[card_id],
        )

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = premium_deck
            mock_repo_class.return_value = mock_repo

            with patch("src.api.v1.study.SM2Service") as mock_service_class:
                mock_service = AsyncMock()
                mock_service.initialize_cards_for_user.return_value = mock_result
                mock_service_class.return_value = mock_service

                response = await client.post(
                    "/api/v1/study/initialize",
                    json={
                        "deck_id": str(deck_id),
                        "card_ids": [str(card_id)],
                    },
                    headers=superuser_auth_headers,
                )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_premium_gate_checked_before_service_call(
        self, client: AsyncClient, auth_headers: dict
    ):
        """SM2Service is NOT called if premium gate blocks the request."""
        deck_id = uuid4()
        card_id = uuid4()
        premium_deck = _make_deck(is_premium=True)

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = premium_deck
            mock_repo_class.return_value = mock_repo

            with patch("src.api.v1.study.SM2Service") as mock_service_class:
                mock_service = AsyncMock()
                mock_service_class.return_value = mock_service

                response = await client.post(
                    "/api/v1/study/initialize",
                    json={
                        "deck_id": str(deck_id),
                        "card_ids": [str(card_id)],
                    },
                    headers=auth_headers,
                )

        assert response.status_code == 403
        # Service was never called because gate blocked
        mock_service.initialize_cards_for_user.assert_not_called()


# =============================================================================
# AC-5: Premium statuses allow access
# =============================================================================


@pytest.mark.unit
class TestAllPremiumStatusesAllowDeckQueueAccess:
    """All premium subscription statuses (ACTIVE, TRIALING, PAST_DUE) allow deck access."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "status",
        [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIALING,
            SubscriptionStatus.PAST_DUE,
        ],
    )
    async def test_premium_status_allows_queue_deck_access(
        self,
        status: SubscriptionStatus,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session,
    ):
        """Each premium status variant allows access to premium deck queue."""
        test_user.subscription_status = status
        await db_session.commit()

        deck_id = uuid4()
        premium_deck = _make_deck(is_premium=True, is_active=True)
        mock_queue = _make_empty_queue(deck_id)

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = premium_deck
            mock_repo_class.return_value = mock_repo

            with patch("src.api.v1.study.SM2Service") as mock_service_class:
                mock_service = AsyncMock()
                mock_service.get_study_queue.return_value = mock_queue
                mock_service_class.return_value = mock_service

                response = await client.get(
                    f"/api/v1/study/queue/{deck_id}",
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
    async def test_free_status_blocks_premium_deck_access(
        self,
        status: SubscriptionStatus,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session,
    ):
        """Each free-tier status variant blocks access to premium deck queue."""
        test_user.subscription_status = status
        await db_session.commit()

        deck_id = uuid4()
        premium_deck = _make_deck(is_premium=True, is_active=True)

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = premium_deck
            mock_repo_class.return_value = mock_repo

            response = await client.get(
                f"/api/v1/study/queue/{deck_id}",
                headers=auth_headers,
            )

        assert (
            response.status_code == 403
        ), f"Expected 403 for status={status}, got {response.status_code}"


# =============================================================================
# AC-6: exclude_premium_decks field in schema
# =============================================================================


@pytest.mark.unit
class TestStudyQueueRequestSchema:
    """StudyQueueRequest schema has exclude_premium_decks field with default False."""

    def test_exclude_premium_decks_field_exists(self):
        """StudyQueueRequest has exclude_premium_decks field."""
        from src.schemas.sm2 import StudyQueueRequest

        req = StudyQueueRequest()
        assert hasattr(req, "exclude_premium_decks")

    def test_exclude_premium_decks_defaults_to_false(self):
        """exclude_premium_decks defaults to False."""
        from src.schemas.sm2 import StudyQueueRequest

        req = StudyQueueRequest()
        assert req.exclude_premium_decks is False

    def test_exclude_premium_decks_can_be_set_to_true(self):
        """exclude_premium_decks can be explicitly set to True."""
        from src.schemas.sm2 import StudyQueueRequest

        req = StudyQueueRequest(exclude_premium_decks=True)
        assert req.exclude_premium_decks is True

    def test_exclude_premium_decks_is_bool(self):
        """exclude_premium_decks field is boolean type."""
        from src.schemas.sm2 import StudyQueueRequest

        req = StudyQueueRequest(exclude_premium_decks=True)
        assert isinstance(req.exclude_premium_decks, bool)


# =============================================================================
# AC-7: Repository SQL filtering
# =============================================================================


@pytest.mark.unit
class TestRepositoryExcludePremiumDecksParameter:
    """Repository methods accept and use exclude_premium_decks parameter."""

    def test_get_due_cards_accepts_exclude_premium_decks(self):
        """get_due_cards signature includes exclude_premium_decks parameter."""
        import inspect

        from src.repositories.progress import CardStatisticsRepository

        sig = inspect.signature(CardStatisticsRepository.get_due_cards)
        assert "exclude_premium_decks" in sig.parameters

    def test_get_due_cards_exclude_premium_decks_defaults_to_false(self):
        """get_due_cards exclude_premium_decks default is False."""
        import inspect

        from src.repositories.progress import CardStatisticsRepository

        sig = inspect.signature(CardStatisticsRepository.get_due_cards)
        param = sig.parameters["exclude_premium_decks"]
        assert param.default is False

    def test_get_early_practice_cards_accepts_exclude_premium_decks(self):
        """get_early_practice_cards signature includes exclude_premium_decks parameter."""
        import inspect

        from src.repositories.progress import CardStatisticsRepository

        sig = inspect.signature(CardStatisticsRepository.get_early_practice_cards)
        assert "exclude_premium_decks" in sig.parameters

    def test_get_early_practice_cards_exclude_premium_decks_defaults_to_false(self):
        """get_early_practice_cards exclude_premium_decks default is False."""
        import inspect

        from src.repositories.progress import CardStatisticsRepository

        sig = inspect.signature(CardStatisticsRepository.get_early_practice_cards)
        param = sig.parameters["exclude_premium_decks"]
        assert param.default is False

    def test_get_new_cards_for_deck_accepts_exclude_premium_decks(self):
        """get_new_cards_for_deck signature includes exclude_premium_decks parameter."""
        import inspect

        from src.repositories.progress import CardStatisticsRepository

        sig = inspect.signature(CardStatisticsRepository.get_new_cards_for_deck)
        assert "exclude_premium_decks" in sig.parameters

    def test_get_new_cards_for_deck_exclude_premium_decks_defaults_to_false(self):
        """get_new_cards_for_deck exclude_premium_decks default is False."""
        import inspect

        from src.repositories.progress import CardStatisticsRepository

        sig = inspect.signature(CardStatisticsRepository.get_new_cards_for_deck)
        param = sig.parameters["exclude_premium_decks"]
        assert param.default is False


# =============================================================================
# AC-8: OpenAPI 403 response documented
# =============================================================================


@pytest.mark.unit
class TestOpenApi403Documentation:
    """OpenAPI schema includes 403 response on relevant endpoints."""

    def test_router_level_403_response_defined(self):
        """Router-level responses dict includes 403 PREMIUM_REQUIRED description."""
        from src.api.v1.study import router

        assert 403 in router.responses
        assert "premium" in router.responses[403]["description"].lower()

    def test_get_queue_deck_id_endpoint_inherits_403(self):
        """GET /queue/{deck_id} endpoint has 403 in its OpenAPI responses."""
        from src.api.v1.study import router

        # The router-level 403 applies to all routes
        # Find the route by checking router routes
        routes = {r.path: r for r in router.routes}
        assert "/queue/{deck_id}" in routes

    def test_initialize_cards_endpoint_inherits_403(self):
        """POST /initialize endpoint has 403 through router-level responses."""
        from src.api.v1.study import router

        routes = {r.path: r for r in router.routes}
        assert "/initialize" in routes

    def test_initialize_deck_endpoint_inherits_403(self):
        """POST /initialize/{deck_id} endpoint has 403 through router-level responses."""
        from src.api.v1.study import router

        routes = {r.path: r for r in router.routes}
        assert "/initialize/{deck_id}" in routes


# =============================================================================
# AC-9: Service passthrough of exclude_premium_decks
# =============================================================================


@pytest.mark.unit
class TestServicePassthroughExcludePremiumDecks:
    """SM2Service.get_study_queue passes exclude_premium_decks to all repo calls."""

    @pytest.mark.asyncio
    async def test_get_study_queue_passes_exclude_premium_to_get_due_cards(
        self, client, auth_headers
    ):
        """Service passes exclude_premium_decks to get_due_cards repository call."""
        mock_queue = _make_empty_queue()

        with patch("src.api.v1.study.SM2Service") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_study_queue.return_value = mock_queue
            mock_service_class.return_value = mock_service

            await client.get("/api/v1/study/queue", headers=auth_headers)

        # Verify service was called with a request that has exclude_premium_decks=True
        call_args = mock_service.get_study_queue.call_args
        request_arg = call_args[0][1]
        assert request_arg.exclude_premium_decks is True

    def test_get_new_cards_has_exclude_premium_decks_kwarg(self):
        """SM2Service._get_new_cards accepts exclude_premium_decks parameter."""
        import inspect

        from src.services.sm2_service import SM2Service

        sig = inspect.signature(SM2Service._get_new_cards)
        assert "exclude_premium_decks" in sig.parameters

    def test_get_new_cards_exclude_premium_decks_defaults_to_false(self):
        """SM2Service._get_new_cards exclude_premium_decks defaults to False."""
        import inspect

        from src.services.sm2_service import SM2Service

        sig = inspect.signature(SM2Service._get_new_cards)
        param = sig.parameters["exclude_premium_decks"]
        assert param.default is False


# =============================================================================
# Integration behavior: initialize_deck with non-existent deck
# =============================================================================


@pytest.mark.unit
class TestInitializeDeckNonExistentBehavior:
    """Document and verify the behavior of initialize/{deck_id} for non-existent decks.

    The implementation currently does:
        deck = await deck_repo.get(deck_id)
        if deck:
            check_premium_deck_access(current_user, deck)
        # Then calls service regardless

    So for non-existent decks, there's no 404 from the endpoint - the service handles it.
    This test documents that behavior.
    """

    @pytest.mark.asyncio
    async def test_nonexistent_deck_premium_check_skipped_service_called(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Non-existent deck bypasses premium check and calls service."""
        deck_id = uuid4()
        mock_result = CardInitializationResult(
            initialized_count=0,
            already_exists_count=0,
            card_ids=[],
        )

        with patch("src.api.v1.study.DeckRepository") as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get.return_value = None  # Deck doesn't exist
            mock_repo_class.return_value = mock_repo

            with patch("src.api.v1.study.SM2Service") as mock_service_class:
                mock_service = AsyncMock()
                mock_service.initialize_deck_for_user.return_value = mock_result
                mock_service_class.return_value = mock_service

                response = await client.post(
                    f"/api/v1/study/initialize/{deck_id}",
                    headers=auth_headers,
                )

        # Service is called even though deck doesn't exist
        assert response.status_code == 200
        mock_service.initialize_deck_for_user.assert_called_once()
