"""Integration tests for premium deck enforcement.

Tests validate that free users are blocked from premium deck content
across study queue, initialize, and review endpoints, while premium/trialing/superusers can access.
"""

from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user
from src.db.models import (
    CardStatistics,
    CardStatus,
    CardSystemVersion,
    Deck,
    DeckLevel,
    SubscriptionStatus,
    SubscriptionTier,
    User,
)
from src.main import app
from tests.factories.auth import UserFactory
from tests.fixtures.auth import _get_override_function, _test_user_registry
from tests.fixtures.deck import create_card

# ===========================================================================
# Helpers
# ===========================================================================


async def _register_user(
    user: User,
    label: str = "user",
) -> dict[str, str]:
    """Register user in test registry and return auth headers."""
    token = f"test-{label}-{user.id}"
    _test_user_registry[token] = user
    if get_current_user not in app.dependency_overrides:
        app.dependency_overrides[get_current_user] = _get_override_function()
    return {"Authorization": f"Bearer {token}"}


async def _create_premium_deck(db_session: AsyncSession) -> Deck:
    """Create a premium deck."""
    deck = Deck(
        name_en="Premium Greek Basics",
        name_el="Premium Greek Basics",
        name_ru="Premium Greek Basics",
        level=DeckLevel.A1,
        is_active=True,
        is_premium=True,
        card_system=CardSystemVersion.V1,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


async def _create_free_deck(db_session: AsyncSession) -> Deck:
    """Create a non-premium deck."""
    deck = Deck(
        name_en="Free Greek Basics",
        name_el="Free Greek Basics",
        name_ru="Free Greek Basics",
        level=DeckLevel.A1,
        is_active=True,
        is_premium=False,
        card_system=CardSystemVersion.V1,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


# ===========================================================================
# Test Classes
# ===========================================================================


@pytest.mark.asyncio
class TestFreeUserBlocked:
    """Free users cannot access premium deck content."""

    async def test_study_queue_for_premium_deck_returns_403(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Free user blocked from GET /study/queue/{premium_deck_id}."""
        free_user = await UserFactory.create(
            subscription_tier=SubscriptionTier.FREE,
            subscription_status=SubscriptionStatus.NONE,
        )
        headers = await _register_user(free_user, "free")

        deck = await _create_premium_deck(db_session)

        try:
            response = await client.get(
                f"/api/v1/study/queue/{deck.id}",
                headers=headers,
            )
            assert response.status_code == 403
            data = response.json()
            assert data["success"] is False
            assert data["error"]["code"] == "PREMIUM_REQUIRED"
        finally:
            _test_user_registry.pop(f"test-free-{free_user.id}", None)

    async def test_initialize_deck_returns_403(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Free user blocked from POST /study/initialize/{premium_deck_id}."""
        free_user = await UserFactory.create(
            subscription_tier=SubscriptionTier.FREE,
            subscription_status=SubscriptionStatus.NONE,
        )
        headers = await _register_user(free_user, "free2")

        deck = await _create_premium_deck(db_session)

        try:
            response = await client.post(
                f"/api/v1/study/initialize/{deck.id}",
                headers=headers,
            )
            assert response.status_code == 403
            data = response.json()
            assert data["error"]["code"] == "PREMIUM_REQUIRED"
        finally:
            _test_user_registry.pop(f"test-free2-{free_user.id}", None)

    async def test_review_submit_for_premium_card_returns_403(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Free user blocked from POST /reviews when card is in a premium deck."""
        free_user = await UserFactory.create(
            subscription_tier=SubscriptionTier.FREE,
            subscription_status=SubscriptionStatus.NONE,
        )
        headers = await _register_user(free_user, "free3")

        deck = await _create_premium_deck(db_session)
        card = await create_card(db_session, deck, front_text="geia", back_text_en="hello")

        try:
            response = await client.post(
                "/api/v1/reviews",
                json={"card_id": str(card.id), "quality": 4, "time_taken": 10},
                headers=headers,
            )
            assert response.status_code == 403
            data = response.json()
            assert data["error"]["code"] == "PREMIUM_REQUIRED"
        finally:
            _test_user_registry.pop(f"test-free3-{free_user.id}", None)

    async def test_bulk_review_for_premium_deck_returns_403(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Free user blocked from POST /reviews/bulk when deck_id is premium."""
        free_user = await UserFactory.create(
            subscription_tier=SubscriptionTier.FREE,
            subscription_status=SubscriptionStatus.NONE,
        )
        headers = await _register_user(free_user, "free4")

        deck = await _create_premium_deck(db_session)
        card = await create_card(db_session, deck, front_text="geia", back_text_en="hello")

        try:
            response = await client.post(
                "/api/v1/reviews/bulk",
                json={
                    "deck_id": str(deck.id),
                    "session_id": "test-session-001",
                    "reviews": [{"card_id": str(card.id), "quality": 4, "time_taken": 10}],
                },
                headers=headers,
            )
            assert response.status_code == 403
            data = response.json()
            assert data["error"]["code"] == "PREMIUM_REQUIRED"
        finally:
            _test_user_registry.pop(f"test-free4-{free_user.id}", None)


@pytest.mark.asyncio
class TestPremiumUsersAllowed:
    """Premium, trialing, and superusers can access premium deck content."""

    async def test_premium_user_can_access_deck_study_queue(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Premium (ACTIVE) user can access GET /study/queue/{premium_deck_id}."""
        premium_user = await UserFactory.create(
            subscription_tier=SubscriptionTier.PREMIUM,
            subscription_status=SubscriptionStatus.ACTIVE,
        )
        headers = await _register_user(premium_user, "premium")

        deck = await _create_premium_deck(db_session)

        try:
            response = await client.get(
                f"/api/v1/study/queue/{deck.id}",
                headers=headers,
            )
            assert response.status_code == 200
        finally:
            _test_user_registry.pop(f"test-premium-{premium_user.id}", None)

    async def test_trialing_user_can_access_deck_study_queue(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Trialing user (FREE tier but TRIALING status) can access premium decks."""
        trialing_user = await UserFactory.create(
            subscription_tier=SubscriptionTier.FREE,
            subscription_status=SubscriptionStatus.TRIALING,
        )
        headers = await _register_user(trialing_user, "trialing")

        deck = await _create_premium_deck(db_session)

        try:
            response = await client.get(
                f"/api/v1/study/queue/{deck.id}",
                headers=headers,
            )
            assert response.status_code == 200
        finally:
            _test_user_registry.pop(f"test-trialing-{trialing_user.id}", None)

    async def test_superuser_can_access_deck_study_queue(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Superuser with FREE subscription can access premium decks."""
        superuser = await UserFactory.create(
            subscription_tier=SubscriptionTier.FREE,
            subscription_status=SubscriptionStatus.NONE,
            is_superuser=True,
        )
        headers = await _register_user(superuser, "super")

        deck = await _create_premium_deck(db_session)

        try:
            response = await client.get(
                f"/api/v1/study/queue/{deck.id}",
                headers=headers,
            )
            assert response.status_code == 200
        finally:
            _test_user_registry.pop(f"test-super-{superuser.id}", None)


@pytest.mark.asyncio
class TestAllDecksQueueFiltering:
    """All-decks study queue silently excludes premium deck cards for free users."""

    async def test_free_user_all_decks_excludes_premium_cards(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Free user GET /study/queue returns 200 with no premium deck cards."""
        free_user = await UserFactory.create(
            subscription_tier=SubscriptionTier.FREE,
            subscription_status=SubscriptionStatus.NONE,
        )
        headers = await _register_user(free_user, "filter")

        # Create both premium and free decks with cards
        premium_deck = await _create_premium_deck(db_session)
        premium_card = await create_card(
            db_session, premium_deck, front_text="premium_word", back_text_en="premium_translation"
        )

        free_deck = await _create_free_deck(db_session)
        free_card = await create_card(
            db_session, free_deck, front_text="free_word", back_text_en="free_translation"
        )

        # Initialize CardStatistics so cards appear in the queue
        for card_obj in [premium_card, free_card]:
            stats = CardStatistics(
                user_id=free_user.id,
                card_id=card_obj.id,
                easiness_factor=2.5,
                interval=1,
                repetitions=1,
                next_review_date=date.today(),
                status=CardStatus.LEARNING,
            )
            db_session.add(stats)
        await db_session.flush()

        try:
            response = await client.get(
                "/api/v1/study/queue",
                headers=headers,
            )
            assert response.status_code == 200
            data = response.json()
            card_ids = [c["card_id"] for c in data.get("cards", [])]
            # Premium card must NOT be in the queue
            assert str(premium_card.id) not in card_ids
        finally:
            _test_user_registry.pop(f"test-filter-{free_user.id}", None)


@pytest.mark.asyncio
class TestReadOnlyBrowsingAllowed:
    """Free users can browse premium deck metadata (read-only)."""

    async def test_free_user_can_view_premium_deck_details(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Free user can GET /decks/{premium_deck_id} - browsing is allowed."""
        free_user = await UserFactory.create(
            subscription_tier=SubscriptionTier.FREE,
            subscription_status=SubscriptionStatus.NONE,
        )
        headers = await _register_user(free_user, "browse")

        deck = await _create_premium_deck(db_session)

        try:
            response = await client.get(
                f"/api/v1/decks/{deck.id}",
                headers=headers,
            )
            assert response.status_code == 200
        finally:
            _test_user_registry.pop(f"test-browse-{free_user.id}", None)


@pytest.mark.asyncio
class TestErrorResponseSchema:
    """Verify the 403 error response includes required fields."""

    async def test_error_body_has_premium_required_code(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """403 response has error_code PREMIUM_REQUIRED."""
        free_user = await UserFactory.create(
            subscription_tier=SubscriptionTier.FREE,
            subscription_status=SubscriptionStatus.NONE,
        )
        headers = await _register_user(free_user, "err1")

        deck = await _create_premium_deck(db_session)

        try:
            response = await client.get(f"/api/v1/study/queue/{deck.id}", headers=headers)
            assert response.status_code == 403
            data = response.json()
            assert data["error"]["code"] == "PREMIUM_REQUIRED"
        finally:
            _test_user_registry.pop(f"test-err1-{free_user.id}", None)

    async def test_error_body_has_trial_eligible_true(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """403 response has trial_eligible=True for a user who never subscribed."""
        free_user = await UserFactory.create(
            subscription_tier=SubscriptionTier.FREE,
            subscription_status=SubscriptionStatus.NONE,
        )
        headers = await _register_user(free_user, "err2")

        deck = await _create_premium_deck(db_session)

        try:
            response = await client.get(f"/api/v1/study/queue/{deck.id}", headers=headers)
            assert response.status_code == 403
            data = response.json()
            assert data["error"]["extra"]["trial_eligible"] is True
        finally:
            _test_user_registry.pop(f"test-err2-{free_user.id}", None)

    async def test_error_body_has_current_tier(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """403 response has current_tier=free in extra."""
        free_user = await UserFactory.create(
            subscription_tier=SubscriptionTier.FREE,
            subscription_status=SubscriptionStatus.NONE,
        )
        headers = await _register_user(free_user, "err3")

        deck = await _create_premium_deck(db_session)

        try:
            response = await client.get(f"/api/v1/study/queue/{deck.id}", headers=headers)
            assert response.status_code == 403
            data = response.json()
            assert data["error"]["extra"]["current_tier"] == "free"
            assert data["error"]["extra"]["required_tier"] == "premium"
        finally:
            _test_user_registry.pop(f"test-err3-{free_user.id}", None)
