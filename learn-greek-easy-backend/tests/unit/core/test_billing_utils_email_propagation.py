"""RED test specs for EMAIL-19-03: propagate_email_change Stripe + Resend propagation.

Mode A (Test-Spec): These tests are authored BEFORE implementation.
The helper is currently a no-op stub in src/core/billing_utils.py.

Expected RED/GUARD status per AC:
- AC-1: RED — stub never calls customers.update_async (assert_awaited_once_with fails)
- AC-2: GUARD — stub never calls Stripe at all; passes trivially (regression guard)
- AC-3: RED — stub never attempts update; assert_awaited_once_with fails behaviorally
- AC-4: GUARD — stub never calls Resend; passes trivially (regression guard)
- AC-5: RED — stub never attempts Resend update; assert_called_once fails behaviorally

Handling of not-yet-existing attrs in billing_utils.py:
  billing_utils.py currently imports NONE of: is_stripe_configured, get_stripe_client,
  or resend.  All three are added by EMAIL-19-03.  Every patch uses ``create=True``
  so unittest.mock injects the name into the module namespace for the duration of the
  test rather than raising AttributeError during patch setup.  This keeps all
  failures BEHAVIORAL (wrong call count) rather than collection errors.

  Similarly, settings.resend_user_audience_id does not exist yet.  We patch
  ``src.core.billing_utils.settings`` wholesale with a MagicMock and set only
  the attrs each test cares about.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.core.billing_utils import propagate_email_change
from src.db.models import User


def _make_user(**kwargs) -> MagicMock:
    """Create a minimal mock User for propagation tests."""
    defaults = {
        "id": "user-uuid-test",
        "stripe_customer_id": "cus_123",
    }
    defaults.update(kwargs)
    user = MagicMock(spec=User)
    for k, v in defaults.items():
        setattr(user, k, v)
    return user


@pytest.mark.unit
class TestPropagateEmailChangeStripe:
    """Stripe path of propagate_email_change."""

    @pytest.mark.asyncio
    async def test_ac1_calls_stripe_customer_update_when_configured(self):
        """AC-1: Stripe update_async called once with customer id + email param.

        RED reason: stub is a no-op and never calls customers.update_async, so
        assert_awaited_once_with fails with "Expected ... to have been awaited once".
        """
        user = _make_user(stripe_customer_id="cus_123")
        mock_client = MagicMock()
        mock_client.v1.customers.update_async = AsyncMock(return_value=MagicMock())

        with (
            # create=True: is_stripe_configured not yet imported in billing_utils
            patch(
                "src.core.billing_utils.is_stripe_configured",
                return_value=True,
                create=True,
            ),
            # create=True: get_stripe_client not yet imported in billing_utils
            patch(
                "src.core.billing_utils.get_stripe_client",
                return_value=mock_client,
                create=True,
            ),
            # Patch settings to supply resend_user_audience_id="" (not in Settings yet).
            patch("src.core.billing_utils.settings") as mock_settings,
        ):
            mock_settings.resend_user_audience_id = ""

            await propagate_email_change(user, "new@x.com")

        mock_client.v1.customers.update_async.assert_awaited_once_with(
            "cus_123",
            params={"email": "new@x.com"},
        )

    @pytest.mark.asyncio
    async def test_ac2_no_stripe_call_when_customer_id_is_none(self):
        """AC-2 (GUARD): No Stripe call when stripe_customer_id is None.

        The stub already makes no calls, so this passes trivially as a
        regression guard: once implemented, the None-customer branch must
        still skip Stripe.
        """
        user = _make_user(stripe_customer_id=None)
        mock_client = MagicMock()
        mock_client.v1.customers.update_async = AsyncMock()

        with (
            patch(
                "src.core.billing_utils.is_stripe_configured",
                return_value=True,
                create=True,
            ),
            patch(
                "src.core.billing_utils.get_stripe_client",
                return_value=mock_client,
                create=True,
            ),
            patch("src.core.billing_utils.settings") as mock_settings,
        ):
            mock_settings.resend_user_audience_id = ""

            await propagate_email_change(user, "new@x.com")

        mock_client.v1.customers.update_async.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_ac2_no_stripe_call_when_stripe_not_configured(self):
        """AC-2 variant (GUARD): No Stripe call when is_stripe_configured() is False.

        The stub makes no calls; regression guard for the unconfigured-Stripe branch.
        """
        user = _make_user(stripe_customer_id="cus_123")
        mock_client = MagicMock()
        mock_client.v1.customers.update_async = AsyncMock()

        with (
            patch(
                "src.core.billing_utils.is_stripe_configured",
                return_value=False,
                create=True,
            ),
            patch(
                "src.core.billing_utils.get_stripe_client",
                return_value=mock_client,
                create=True,
            ),
            patch("src.core.billing_utils.settings") as mock_settings,
        ):
            mock_settings.resend_user_audience_id = ""

            await propagate_email_change(user, "new@x.com")

        mock_client.v1.customers.update_async.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_ac3_stripe_error_is_swallowed(self):
        """AC-3: Stripe update_async raises → caught + logged, no re-raise.

        RED reason: stub never attempts the update at all.  The assertion
        assert_awaited_once_with fails because update_async was never awaited.
        Post-impl the test confirms: (a) the call WAS attempted, and (b)
        propagate_email_change returned normally despite the exception.
        """
        import stripe as stripe_lib

        user = _make_user(stripe_customer_id="cus_123")
        mock_client = MagicMock()
        mock_client.v1.customers.update_async = AsyncMock(
            side_effect=stripe_lib.StripeError("API failure")
        )

        with (
            patch(
                "src.core.billing_utils.is_stripe_configured",
                return_value=True,
                create=True,
            ),
            patch(
                "src.core.billing_utils.get_stripe_client",
                return_value=mock_client,
                create=True,
            ),
            patch("src.core.billing_utils.settings") as mock_settings,
        ):
            mock_settings.resend_user_audience_id = ""

            # Must not raise — best-effort swallow.
            await propagate_email_change(user, "new@x.com")

        # The update must have been ATTEMPTED (not silently skipped).
        # Against the no-op stub this assertion fails → RED.
        mock_client.v1.customers.update_async.assert_awaited_once_with(
            "cus_123",
            params={"email": "new@x.com"},
        )


@pytest.mark.unit
class TestPropagateEmailChangeResend:
    """Resend path of propagate_email_change, gated on resend_user_audience_id."""

    @pytest.mark.asyncio
    async def test_ac4_no_resend_call_when_audience_id_empty(self):
        """AC-4 (GUARD): resend_user_audience_id="" → Resend.Contacts never called.

        Even when resend_api_key is truthy, the empty user-audience gate must
        produce an unconditional no-op.  Stub already makes no calls; passes
        trivially as a regression guard.

        The waitlist resend_audience_id must NEVER be read or used for the
        user-audience path.
        """
        user = _make_user(stripe_customer_id=None)

        with (
            patch(
                "src.core.billing_utils.is_stripe_configured",
                return_value=False,
                create=True,
            ),
            patch("src.core.billing_utils.settings") as mock_settings,
            # create=True: billing_utils doesn't import resend yet (EMAIL-19-03 adds it).
            patch("src.core.billing_utils.resend", create=True) as mock_resend,
        ):
            # resend_api_key truthy — but user audience empty → no Resend call.
            mock_settings.resend_user_audience_id = ""
            mock_settings.resend_api_key = "re_test_key"
            # Waitlist audience present but must never be touched.
            mock_settings.resend_audience_id = "waitlist_aud_should_not_be_touched"

            await propagate_email_change(user, "new@x.com")

        # No Resend Contacts call in any form.
        mock_resend.Contacts.update.assert_not_called()
        mock_resend.Contacts.create.assert_not_called()

    @pytest.mark.asyncio
    async def test_ac5_resend_error_is_swallowed_when_audience_configured(self):
        """AC-5: resend_user_audience_id set + Contacts.update raises → swallowed.

        RED reason: stub never attempts the Resend update, so
        mock_resend.Contacts.update.assert_called_once() fails with "not called".
        Post-impl confirms: (a) update WAS attempted, (b) no re-raise.
        """
        user = _make_user(stripe_customer_id=None)

        mock_resend_mod = MagicMock()
        mock_resend_mod.Contacts.update.side_effect = Exception("Resend API error")

        with (
            patch(
                "src.core.billing_utils.is_stripe_configured",
                return_value=False,
                create=True,
            ),
            patch("src.core.billing_utils.settings") as mock_settings,
            # create=True: billing_utils doesn't import resend yet (EMAIL-19-03 adds it).
            patch("src.core.billing_utils.resend", mock_resend_mod, create=True),
        ):
            mock_settings.resend_user_audience_id = "aud_test_123"
            mock_settings.resend_api_key = "re_test_key"

            # Must not raise — best-effort swallow.
            await propagate_email_change(user, "new@x.com")

        # The update must have been ATTEMPTED (not silently skipped).
        # Against the no-op stub this assertion fails → RED.
        mock_resend_mod.Contacts.update.assert_called_once()
