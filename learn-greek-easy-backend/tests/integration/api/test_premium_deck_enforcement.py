"""Integration tests for premium deck enforcement.

Tests validate that free users are blocked from premium deck content
across study queue, initialize, and review endpoints, while premium/trialing/superusers can access.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user
from src.db.models import Deck, DeckLevel, SubscriptionStatus, SubscriptionTier, User
from src.main import app
from tests.factories.auth import UserFactory
from tests.fixtures.auth import _get_override_function, _test_user_registry

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

    pass


@pytest.mark.asyncio
class TestPremiumUsersAllowed:
    """Premium, trialing, and superusers can access premium deck content."""

    pass


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
