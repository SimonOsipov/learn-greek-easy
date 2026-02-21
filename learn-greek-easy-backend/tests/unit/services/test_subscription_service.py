"""Unit tests for SubscriptionService."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.core.exceptions import (
    PlanChangeNotAllowedException,
    SubscriptionAlreadyCancelingException,
    SubscriptionNotActiveException,
)
from src.db.models import BillingCycle, SubscriptionStatus, SubscriptionTier, User
from src.services.subscription_service import SubscriptionService


def _make_user(**kwargs) -> MagicMock:
    """Create a mock User for tests."""
    defaults = {
        "id": "test-user-id",
        "email": "test@example.com",
        "stripe_subscription_id": "sub_test123",
        "subscription_tier": SubscriptionTier.PREMIUM,
        "subscription_status": SubscriptionStatus.ACTIVE,
        "subscription_cancel_at_period_end": False,
        "billing_cycle": BillingCycle.MONTHLY,
    }
    defaults.update(kwargs)
    user = MagicMock(spec=User)
    for k, v in defaults.items():
        setattr(user, k, v)
    return user


@pytest.mark.unit
@pytest.mark.stripe
class TestSubscriptionServiceChangePlan:

    @pytest.mark.asyncio
    async def test_change_plan_success(self):
        """Successfully change plan to a different billing cycle."""
        user = _make_user(billing_cycle=BillingCycle.MONTHLY)
        db = MagicMock()
        service = SubscriptionService(db)

        mock_subscription = MagicMock()
        mock_subscription.items.data = [MagicMock(id="si_item123")]
        mock_client = MagicMock()
        mock_client.v1.subscriptions.retrieve_async = AsyncMock(return_value=mock_subscription)
        mock_client.v1.subscriptions.update_async = AsyncMock()

        with (
            patch("src.services.subscription_service.get_stripe_client", return_value=mock_client),
            patch(
                "src.services.subscription_service.billing_cycle_to_price_id",
                return_value="price_quarterly",
            ),
            patch("src.services.subscription_service.capture_event") as mock_capture,
        ):
            await service.change_plan(user, BillingCycle.QUARTERLY)

        mock_client.v1.subscriptions.update_async.assert_called_once()
        call_kwargs = str(mock_client.v1.subscriptions.update_async.call_args)
        assert "create_prorations" in call_kwargs
        assert user.billing_cycle == BillingCycle.QUARTERLY
        mock_capture.assert_called_once_with(
            distinct_id=str(user.id),
            event="plan_change_completed",
            properties={
                "user_id": str(user.id),
                "new_billing_cycle": "quarterly",
                "previous_billing_cycle": "monthly",
            },
            user_email=user.email,
        )

    @pytest.mark.asyncio
    async def test_change_plan_rejects_no_subscription(self):
        """Raise SubscriptionNotActiveException if no stripe_subscription_id."""
        user = _make_user(stripe_subscription_id=None)
        db = MagicMock()
        service = SubscriptionService(db)
        with pytest.raises(SubscriptionNotActiveException):
            await service.change_plan(user, BillingCycle.QUARTERLY)

    @pytest.mark.asyncio
    async def test_change_plan_rejects_non_premium(self):
        """Raise SubscriptionNotActiveException if not premium tier."""
        user = _make_user(subscription_tier=SubscriptionTier.FREE)
        db = MagicMock()
        service = SubscriptionService(db)
        with pytest.raises(SubscriptionNotActiveException):
            await service.change_plan(user, BillingCycle.QUARTERLY)

    @pytest.mark.asyncio
    async def test_change_plan_rejects_past_due(self):
        """Raise PlanChangeNotAllowedException if subscription is PAST_DUE."""
        user = _make_user(subscription_status=SubscriptionStatus.PAST_DUE)
        db = MagicMock()
        service = SubscriptionService(db)
        with pytest.raises(PlanChangeNotAllowedException):
            await service.change_plan(user, BillingCycle.QUARTERLY)

    @pytest.mark.asyncio
    async def test_change_plan_rejects_cancel_scheduled(self):
        """Raise PlanChangeNotAllowedException if subscription is scheduled to cancel."""
        user = _make_user(subscription_cancel_at_period_end=True)
        db = MagicMock()
        service = SubscriptionService(db)
        with pytest.raises(PlanChangeNotAllowedException):
            await service.change_plan(user, BillingCycle.QUARTERLY)

    @pytest.mark.asyncio
    async def test_change_plan_rejects_same_cycle(self):
        """Raise PlanChangeNotAllowedException if already on the requested cycle."""
        user = _make_user(billing_cycle=BillingCycle.MONTHLY)
        db = MagicMock()
        service = SubscriptionService(db)
        with pytest.raises(PlanChangeNotAllowedException):
            await service.change_plan(user, BillingCycle.MONTHLY)


@pytest.mark.unit
@pytest.mark.stripe
class TestSubscriptionServiceCancel:

    @pytest.mark.asyncio
    async def test_cancel_success(self):
        """Successfully schedule subscription for cancellation."""
        user = _make_user()
        db = MagicMock()
        service = SubscriptionService(db)
        mock_client = MagicMock()
        mock_client.v1.subscriptions.update_async = AsyncMock()

        with (
            patch("src.services.subscription_service.get_stripe_client", return_value=mock_client),
            patch("src.services.subscription_service.capture_event") as mock_capture,
        ):
            await service.cancel(user)

        mock_client.v1.subscriptions.update_async.assert_called_once_with(
            user.stripe_subscription_id,
            params={"cancel_at_period_end": True},
        )
        assert user.subscription_cancel_at_period_end is True
        mock_capture.assert_called_once_with(
            distinct_id=str(user.id),
            event="cancel_scheduled",
            properties={
                "user_id": str(user.id),
                "subscription_status": user.subscription_status.value,
            },
            user_email=user.email,
        )

    @pytest.mark.asyncio
    async def test_cancel_allows_past_due(self):
        """Cancel should succeed for PAST_DUE subscriptions."""
        user = _make_user(subscription_status=SubscriptionStatus.PAST_DUE)
        db = MagicMock()
        service = SubscriptionService(db)
        mock_client = MagicMock()
        mock_client.v1.subscriptions.update_async = AsyncMock()

        with (
            patch("src.services.subscription_service.get_stripe_client", return_value=mock_client),
            patch("src.services.subscription_service.capture_event"),
        ):
            await service.cancel(user)

        mock_client.v1.subscriptions.update_async.assert_called_once()

    @pytest.mark.asyncio
    async def test_cancel_rejects_already_canceling(self):
        """Raise SubscriptionAlreadyCancelingException if already scheduled for cancellation."""
        user = _make_user(subscription_cancel_at_period_end=True)
        db = MagicMock()
        service = SubscriptionService(db)
        with pytest.raises(SubscriptionAlreadyCancelingException):
            await service.cancel(user)


@pytest.mark.unit
@pytest.mark.stripe
class TestSubscriptionServiceReactivate:

    @pytest.mark.asyncio
    async def test_reactivate_success(self):
        """Successfully reactivate a subscription scheduled for cancellation."""
        user = _make_user(subscription_cancel_at_period_end=True)
        db = MagicMock()
        service = SubscriptionService(db)
        mock_client = MagicMock()
        mock_client.v1.subscriptions.update_async = AsyncMock()

        with (
            patch("src.services.subscription_service.get_stripe_client", return_value=mock_client),
            patch("src.services.subscription_service.capture_event") as mock_capture,
        ):
            await service.reactivate(user)

        mock_client.v1.subscriptions.update_async.assert_called_once_with(
            user.stripe_subscription_id,
            params={"cancel_at_period_end": False},
        )
        assert user.subscription_cancel_at_period_end is False
        mock_capture.assert_called_once_with(
            distinct_id=str(user.id),
            event="reactivate_completed",
            properties={"user_id": str(user.id)},
            user_email=user.email,
        )

    @pytest.mark.asyncio
    async def test_reactivate_requires_cancel_scheduled(self):
        """Raise SubscriptionNotActiveException if not scheduled for cancellation."""
        user = _make_user(subscription_cancel_at_period_end=False)
        db = MagicMock()
        service = SubscriptionService(db)
        with pytest.raises(SubscriptionNotActiveException):
            await service.reactivate(user)

    @pytest.mark.asyncio
    async def test_reactivate_rejects_non_active_status(self):
        """Raise SubscriptionNotActiveException if subscription status is not ACTIVE."""
        user = _make_user(
            subscription_cancel_at_period_end=True, subscription_status=SubscriptionStatus.PAST_DUE
        )
        db = MagicMock()
        service = SubscriptionService(db)
        with pytest.raises(SubscriptionNotActiveException):
            await service.reactivate(user)
