"""Integration tests for trial lifecycle.

Tests verify the full trial lifecycle end-to-end:
- get_effective_access_level with real DB users
- check_premium_deck_access with trial users
- HTTP API access for active vs expired trial users
- trial_expiration_task transitioning expired users to NONE

Uses the real test database with mocked auth (no live Supabase token verification).
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user, get_or_create_user
from src.core.exceptions import PremiumRequiredException
from src.core.subscription import check_premium_deck_access, get_effective_access_level
from src.core.supabase_auth import SupabaseUserClaims
from src.db.models import (
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
from tests.helpers.database import get_test_database_url

# ===========================================================================
# Module-level Helpers
# ===========================================================================


async def _register_user(user: User, label: str = "user") -> dict[str, str]:
    """Register user in test registry and return auth headers."""
    token = f"test-{label}-{user.id}"
    _test_user_registry[token] = user
    if get_current_user not in app.dependency_overrides:
        app.dependency_overrides[get_current_user] = _get_override_function()
    return {"Authorization": f"Bearer {token}"}


async def _create_premium_deck(db_session: AsyncSession) -> Deck:
    """Create a premium deck."""
    deck = Deck(
        name_en="Premium Trial Test Deck",
        name_el="Premium Trial Test Deck",
        name_ru="Premium Trial Test Deck",
        level=DeckLevel.A1,
        is_active=True,
        is_premium=True,
        card_system=CardSystemVersion.V1,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


# ===========================================================================
# Class 1: TestGetEffectiveAccessLevel
# ===========================================================================


@pytest.mark.asyncio
class TestGetEffectiveAccessLevel:
    """get_effective_access_level with real DB users and subscription fields."""

    async def test_active_trial_returns_premium(self, db_session: AsyncSession):
        """TRIALING + future trial_end_date -> PREMIUM."""
        user = await UserFactory.create(
            subscription_status=SubscriptionStatus.TRIALING,
            subscription_tier=SubscriptionTier.FREE,
            trial_start_date=datetime.now(timezone.utc) - timedelta(days=13),
            trial_end_date=datetime.now(timezone.utc) + timedelta(days=1),
        )
        result = get_effective_access_level(user)
        assert result == SubscriptionTier.PREMIUM

    async def test_expired_trial_returns_free(self, db_session: AsyncSession):
        """TRIALING + past trial_end_date -> FREE."""
        user = await UserFactory.create(
            subscription_status=SubscriptionStatus.TRIALING,
            subscription_tier=SubscriptionTier.FREE,
            trial_start_date=datetime.now(timezone.utc) - timedelta(days=15),
            trial_end_date=datetime.now(timezone.utc) - timedelta(days=1),
        )
        result = get_effective_access_level(user)
        assert result == SubscriptionTier.FREE

    async def test_trialing_with_null_end_date_returns_premium(self, db_session: AsyncSession):
        """TRIALING + None trial_end_date -> PREMIUM (defensive case)."""
        user = await UserFactory.create(
            subscription_status=SubscriptionStatus.TRIALING,
            subscription_tier=SubscriptionTier.FREE,
            trial_end_date=None,
        )
        result = get_effective_access_level(user)
        assert result == SubscriptionTier.PREMIUM

    async def test_none_status_returns_free(self, db_session: AsyncSession):
        """NONE status -> FREE."""
        user = await UserFactory.create(
            subscription_status=SubscriptionStatus.NONE,
            subscription_tier=SubscriptionTier.FREE,
        )
        result = get_effective_access_level(user)
        assert result == SubscriptionTier.FREE

    async def test_active_subscription_returns_premium(self, db_session: AsyncSession):
        """ACTIVE subscription status -> PREMIUM."""
        user = await UserFactory.create(
            subscription_status=SubscriptionStatus.ACTIVE,
            subscription_tier=SubscriptionTier.PREMIUM,
        )
        result = get_effective_access_level(user)
        assert result == SubscriptionTier.PREMIUM

    async def test_superuser_always_premium(self, db_session: AsyncSession):
        """Superuser with NONE status and FREE tier -> PREMIUM."""
        user = await UserFactory.create(
            subscription_status=SubscriptionStatus.NONE,
            subscription_tier=SubscriptionTier.FREE,
            is_superuser=True,
        )
        result = get_effective_access_level(user)
        assert result == SubscriptionTier.PREMIUM


# ===========================================================================
# Class 2: TestTrialPremiumDeckAccess
# ===========================================================================


@pytest.mark.asyncio
class TestTrialPremiumDeckAccess:
    """check_premium_deck_access with active and expired trial users."""

    async def test_active_trial_can_access_premium_deck(self, db_session: AsyncSession):
        """Active TRIALING user can access a premium deck (no exception)."""
        user = await UserFactory.create(
            subscription_status=SubscriptionStatus.TRIALING,
            subscription_tier=SubscriptionTier.FREE,
            trial_start_date=datetime.now(timezone.utc) - timedelta(days=13),
            trial_end_date=datetime.now(timezone.utc) + timedelta(days=1),
        )
        deck = await _create_premium_deck(db_session)

        with patch("src.core.subscription.capture_event"):
            check_premium_deck_access(user, deck)
        # No exception raised = test passes

    async def test_expired_trial_blocked_from_premium_deck(self, db_session: AsyncSession):
        """Expired TRIALING user cannot access a premium deck -> PremiumRequiredException."""
        user = await UserFactory.create(
            subscription_status=SubscriptionStatus.TRIALING,
            subscription_tier=SubscriptionTier.FREE,
            trial_start_date=datetime.now(timezone.utc) - timedelta(days=15),
            trial_end_date=datetime.now(timezone.utc) - timedelta(days=1),
        )
        deck = await _create_premium_deck(db_session)

        with patch("src.core.subscription.capture_event"):
            with pytest.raises(PremiumRequiredException):
                check_premium_deck_access(user, deck)


# ===========================================================================
# Class 3: TestTrialApiAccess
# ===========================================================================


@pytest.mark.asyncio
class TestTrialApiAccess:
    """HTTP API access checks for active and expired trial users."""

    async def test_active_trial_user_gets_200(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Active TRIALING user gets 200 on premium deck study queue endpoint."""
        user = await UserFactory.create(
            subscription_status=SubscriptionStatus.TRIALING,
            subscription_tier=SubscriptionTier.FREE,
            trial_start_date=datetime.now(timezone.utc) - timedelta(days=13),
            trial_end_date=datetime.now(timezone.utc) + timedelta(days=1),
        )
        headers = await _register_user(user, "trial-active")
        deck = await _create_premium_deck(db_session)

        try:
            response = await client.get(
                f"/api/v1/study/queue/{deck.id}",
                headers=headers,
            )
            assert response.status_code == 200
        finally:
            _test_user_registry.pop(f"test-trial-active-{user.id}", None)

    async def test_expired_trial_user_gets_403(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """Expired TRIALING user gets 403 on premium deck study queue endpoint."""
        user = await UserFactory.create(
            subscription_status=SubscriptionStatus.TRIALING,
            subscription_tier=SubscriptionTier.FREE,
            trial_start_date=datetime.now(timezone.utc) - timedelta(days=15),
            trial_end_date=datetime.now(timezone.utc) - timedelta(days=1),
        )
        headers = await _register_user(user, "trial-expired")
        deck = await _create_premium_deck(db_session)

        try:
            response = await client.get(
                f"/api/v1/study/queue/{deck.id}",
                headers=headers,
            )
            assert response.status_code == 403
        finally:
            _test_user_registry.pop(f"test-trial-expired-{user.id}", None)

    async def test_expired_trial_error_shows_trial_not_eligible(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
    ):
        """403 response for expired TRIALING user has trial_eligible=False.

        An expired TRIALING user has subscription_status=TRIALING (not NONE),
        so trial_eligible is False (trial was already used).
        """
        user = await UserFactory.create(
            subscription_status=SubscriptionStatus.TRIALING,
            subscription_tier=SubscriptionTier.FREE,
            trial_start_date=datetime.now(timezone.utc) - timedelta(days=15),
            trial_end_date=datetime.now(timezone.utc) - timedelta(days=1),
        )
        headers = await _register_user(user, "trial-expired2")
        deck = await _create_premium_deck(db_session)

        try:
            response = await client.get(
                f"/api/v1/study/queue/{deck.id}",
                headers=headers,
            )
            assert response.status_code == 403
            data = response.json()
            assert data["error"]["extra"]["trial_eligible"] is False
        finally:
            _test_user_registry.pop(f"test-trial-expired2-{user.id}", None)


# ===========================================================================
# Class 4: TestTrialExpirationTaskIntegration
# ===========================================================================


@pytest.mark.asyncio
class TestTrialExpirationTaskIntegration:
    """trial_expiration_task with real DB - verifies actual status transitions."""

    async def test_expired_auto_trial_transitions_to_none(self, db_session: AsyncSession):
        """Expired auto-trial SQL correctly transitions TRIALING→NONE, preserving trial dates.

        Note: trial_expiration_task creates its own DB engine. The test DB uses nested
        transactions (savepoints) for isolation, so committed data is not visible to a
        separate engine connection. This test validates the SQL UPDATE logic directly via
        the test session — the same SQL the task executes.
        """
        user = await UserFactory.create(
            subscription_status=SubscriptionStatus.TRIALING,
            subscription_tier=SubscriptionTier.FREE,
            trial_start_date=datetime.now(timezone.utc) - timedelta(days=15),
            trial_end_date=datetime.now(timezone.utc) - timedelta(days=1),
            stripe_subscription_id=None,
        )
        original_trial_start = user.trial_start_date
        original_trial_end = user.trial_end_date

        # Execute the same SQL the task uses, directly via test session
        await db_session.execute(
            text(
                """
                UPDATE users
                SET subscription_status = 'NONE',
                    updated_at = NOW()
                WHERE subscription_status = 'TRIALING'
                  AND trial_end_date < NOW()
                  AND stripe_subscription_id IS NULL
            """
            )
        )

        await db_session.refresh(user)
        assert user.subscription_status == SubscriptionStatus.NONE
        # Trial dates preserved (not cleared by the UPDATE)
        assert user.trial_start_date == original_trial_start
        assert user.trial_end_date == original_trial_end

    async def test_active_trial_not_touched(self, db_session: AsyncSession):
        """Active (non-expired) TRIALING user is not modified by the task."""
        from src.tasks.scheduled import trial_expiration_task

        user = await UserFactory.create(
            subscription_status=SubscriptionStatus.TRIALING,
            subscription_tier=SubscriptionTier.FREE,
            trial_start_date=datetime.now(timezone.utc) - timedelta(days=13),
            trial_end_date=datetime.now(timezone.utc) + timedelta(days=1),
            stripe_subscription_id=None,
        )

        await db_session.commit()

        test_db_url = get_test_database_url()
        with (
            patch("src.tasks.scheduled.settings") as mock_settings,
            patch("src.tasks.scheduled.init_posthog"),
            patch("src.tasks.scheduled.is_posthog_enabled", return_value=False),
        ):
            mock_settings.database_url = test_db_url
            mock_settings.is_production = False
            await trial_expiration_task()

        await db_session.refresh(user)
        assert user.subscription_status == SubscriptionStatus.TRIALING

    async def test_stripe_managed_trial_not_touched(self, db_session: AsyncSession):
        """Stripe-managed TRIALING user (stripe_subscription_id set) is not modified."""
        from src.tasks.scheduled import trial_expiration_task

        user = await UserFactory.create(
            subscription_status=SubscriptionStatus.TRIALING,
            subscription_tier=SubscriptionTier.FREE,
            trial_start_date=datetime.now(timezone.utc) - timedelta(days=15),
            trial_end_date=datetime.now(timezone.utc) - timedelta(days=1),
            stripe_subscription_id="sub_test_" + uuid4().hex[:8],
        )

        await db_session.commit()

        test_db_url = get_test_database_url()
        with (
            patch("src.tasks.scheduled.settings") as mock_settings,
            patch("src.tasks.scheduled.init_posthog"),
            patch("src.tasks.scheduled.is_posthog_enabled", return_value=False),
        ):
            mock_settings.database_url = test_db_url
            mock_settings.is_production = False
            await trial_expiration_task()

        await db_session.refresh(user)
        assert user.subscription_status == SubscriptionStatus.TRIALING

    async def test_multiple_expired_users_all_transition(self, db_session: AsyncSession):
        """SQL batch UPDATE transitions all expired TRIALING users to NONE in one pass."""
        users = []
        for _ in range(3):
            u = await UserFactory.create(
                subscription_status=SubscriptionStatus.TRIALING,
                subscription_tier=SubscriptionTier.FREE,
                trial_start_date=datetime.now(timezone.utc) - timedelta(days=15),
                trial_end_date=datetime.now(timezone.utc) - timedelta(days=1),
                stripe_subscription_id=None,
            )
            users.append(u)

        # Same SQL as trial_expiration_task UPDATE phase
        await db_session.execute(
            text(
                """
                UPDATE users
                SET subscription_status = 'NONE',
                    updated_at = NOW()
                WHERE subscription_status = 'TRIALING'
                  AND trial_end_date < NOW()
                  AND stripe_subscription_id IS NULL
            """
            )
        )

        for u in users:
            await db_session.refresh(u)
            assert u.subscription_status == SubscriptionStatus.NONE

    async def test_no_expired_users_completes_cleanly(self, db_session: AsyncSession):
        """Task completes without error when there are no expired trial users."""
        from src.tasks.scheduled import trial_expiration_task

        # No expired trial users in the DB for this test
        test_db_url = get_test_database_url()
        with (
            patch("src.tasks.scheduled.settings") as mock_settings,
            patch("src.tasks.scheduled.init_posthog"),
            patch("src.tasks.scheduled.is_posthog_enabled", return_value=False),
        ):
            mock_settings.database_url = test_db_url
            mock_settings.is_production = False
            # Should not raise
            await trial_expiration_task()


# ===========================================================================
# Class 5: TestGetOrCreateUserTrialActivation
# ===========================================================================


@pytest.mark.asyncio
class TestGetOrCreateUserTrialActivation:
    """get_or_create_user sets trial fields on first signup (real DB)."""

    async def test_new_user_signup_activates_trial(self, db_session: AsyncSession):
        """get_or_create_user creates new user with TRIALING status and 14-day trial."""
        claims = SupabaseUserClaims(
            supabase_id=str(uuid4()),
            email=f"trial_integ_{uuid4().hex[:8]}@example.com",
            full_name="Trial Integration User",
        )
        with patch("src.core.dependencies.capture_event"):
            user = await get_or_create_user(db_session, claims)

        assert user.subscription_status == SubscriptionStatus.TRIALING
        assert user.trial_start_date is not None
        assert user.trial_end_date is not None
        assert user.subscription_tier == SubscriptionTier.FREE
        diff = user.trial_end_date - user.trial_start_date
        assert 13 <= diff.days <= 14

    async def test_new_user_has_premium_access(self, db_session: AsyncSession):
        """Newly created user (active trial) gets PREMIUM from get_effective_access_level."""
        claims = SupabaseUserClaims(
            supabase_id=str(uuid4()),
            email=f"trial_premium_{uuid4().hex[:8]}@example.com",
            full_name="Trial Premium User",
        )
        with patch("src.core.dependencies.capture_event"):
            user = await get_or_create_user(db_session, claims)

        assert get_effective_access_level(user) == SubscriptionTier.PREMIUM

    async def test_existing_user_not_re_trialed(self, db_session: AsyncSession):
        """Calling get_or_create_user again for existing user does NOT reset trial fields."""
        claims = SupabaseUserClaims(
            supabase_id=str(uuid4()),
            email=f"trial_retrial_{uuid4().hex[:8]}@example.com",
            full_name="Trial Retrial User",
        )
        with patch("src.core.dependencies.capture_event"):
            user_first = await get_or_create_user(db_session, claims)

        original_trial_end = user_first.trial_end_date

        # Second call: returns existing user, does NOT reset trial
        with patch("src.core.dependencies.capture_event") as mock_capture:
            user_second = await get_or_create_user(db_session, claims)

        assert user_second.id == user_first.id
        assert user_second.trial_end_date == original_trial_end
        mock_capture.assert_not_called()

    async def test_full_trial_lifecycle(self, db_session: AsyncSession):
        """End-to-end: new user → PREMIUM → trial expires → FREE → SQL cleans to NONE."""
        claims = SupabaseUserClaims(
            supabase_id=str(uuid4()),
            email=f"trial_lifecycle_{uuid4().hex[:8]}@example.com",
            full_name="Lifecycle User",
        )
        # Step 1: Create user — trial active
        with patch("src.core.dependencies.capture_event"):
            user = await get_or_create_user(db_session, claims)

        assert get_effective_access_level(user) == SubscriptionTier.PREMIUM

        # Step 2: Simulate trial expiry by setting trial_end_date to past
        user.trial_end_date = datetime.now(timezone.utc) - timedelta(days=1)
        await db_session.flush()

        assert get_effective_access_level(user) == SubscriptionTier.FREE

        # Step 3: Run the expiry SQL (same as trial_expiration_task UPDATE phase)
        await db_session.execute(
            text(
                """
                UPDATE users
                SET subscription_status = 'NONE',
                    updated_at = NOW()
                WHERE subscription_status = 'TRIALING'
                  AND trial_end_date < NOW()
                  AND stripe_subscription_id IS NULL
            """
            )
        )

        await db_session.refresh(user)
        assert user.subscription_status == SubscriptionStatus.NONE
        assert get_effective_access_level(user) == SubscriptionTier.FREE
