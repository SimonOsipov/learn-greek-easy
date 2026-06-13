"""Adversarial / edge-case tests for EMAIL-19-03: propagate_email_change.

Mode B (Verify) additions — these extend the 6 AC tests already authored in
test_billing_utils_email_propagation.py and confirmed green post-implementation.

Coverage goals:
- Independent isolation: Stripe failure must not skip Resend and vice versa.
- Both active simultaneously: Stripe + Resend both called in one invocation.
- No PII in logs: warning binds user_id/error only, never new_email.
- Correct argument: Stripe params carry new_email, not user.email (old value).
- Both raise simultaneously: helper still returns None without re-raising.
"""

from __future__ import annotations

import logging
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import stripe as stripe_lib

from src.core.billing_utils import propagate_email_change
from src.db.models import User


def _make_user(**kwargs) -> MagicMock:
    """Create a minimal mock User for propagation tests."""
    defaults = {
        "id": "user-uuid-adv",
        "stripe_customer_id": "cus_adv",
        "email": "old@example.com",
    }
    defaults.update(kwargs)
    user = MagicMock(spec=User)
    for k, v in defaults.items():
        setattr(user, k, v)
    return user


@pytest.mark.unit
class TestPropagateEmailChangeIsolation:
    """Stripe failure must not skip Resend; Resend failure must not undo Stripe."""

    @pytest.mark.asyncio
    async def test_stripe_failure_does_not_skip_resend(self):
        """If Stripe raises, Resend must still be attempted.

        Independent isolation requirement: each block is separately try/except'd,
        so a Stripe StripeError cannot prevent the Resend block from executing.
        """
        user = _make_user(stripe_customer_id="cus_adv")
        mock_client = MagicMock()
        mock_client.v1.customers.update_async = AsyncMock(
            side_effect=stripe_lib.StripeError("stripe network error")
        )
        mock_resend = MagicMock()
        mock_resend.Contacts.update.return_value = None

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
            patch("src.core.billing_utils.resend", mock_resend, create=True),
        ):
            mock_settings.resend_user_audience_id = "aud_active_123"

            # Must not raise
            result = await propagate_email_change(user, "new@x.com")

        assert result is None
        # Stripe was attempted (and failed)
        mock_client.v1.customers.update_async.assert_awaited_once()
        # Resend was STILL attempted despite Stripe failure
        mock_resend.Contacts.update.assert_called_once()

    @pytest.mark.asyncio
    async def test_resend_failure_does_not_affect_stripe_completion(self):
        """If Resend raises, Stripe must have already completed normally.

        Stripe executes first; its success is unaffected by Resend blowing up.
        The helper returns None in all cases.
        """
        user = _make_user(stripe_customer_id="cus_adv")
        mock_client = MagicMock()
        mock_client.v1.customers.update_async = AsyncMock(return_value=MagicMock())
        mock_resend = MagicMock()
        mock_resend.Contacts.update.side_effect = Exception("resend 5xx")

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
            patch("src.core.billing_utils.resend", mock_resend, create=True),
        ):
            mock_settings.resend_user_audience_id = "aud_active_123"

            # Must not raise
            result = await propagate_email_change(user, "new@x.com")

        assert result is None
        # Stripe completed successfully
        mock_client.v1.customers.update_async.assert_awaited_once()
        # Resend was attempted (and swallowed)
        mock_resend.Contacts.update.assert_called_once()

    @pytest.mark.asyncio
    async def test_both_raise_returns_none(self):
        """When both Stripe and Resend raise, propagate_email_change still returns None."""
        user = _make_user(stripe_customer_id="cus_adv")
        mock_client = MagicMock()
        mock_client.v1.customers.update_async = AsyncMock(
            side_effect=stripe_lib.StripeError("stripe down")
        )
        mock_resend = MagicMock()
        mock_resend.Contacts.update.side_effect = Exception("resend down")

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
            patch("src.core.billing_utils.resend", mock_resend, create=True),
        ):
            mock_settings.resend_user_audience_id = "aud_active_123"

            result = await propagate_email_change(user, "new@x.com")

        assert result is None
        mock_client.v1.customers.update_async.assert_awaited_once()
        mock_resend.Contacts.update.assert_called_once()


@pytest.mark.unit
class TestPropagateEmailChangeBothActive:
    """Both Stripe and Resend active in a single invocation."""

    @pytest.mark.asyncio
    async def test_both_called_when_both_configured(self):
        """Stripe customer_id set + stripe configured + resend_user_audience_id set
        → both Stripe update_async and Resend Contacts.update called exactly once.
        """
        user = _make_user(stripe_customer_id="cus_adv")
        mock_client = MagicMock()
        mock_client.v1.customers.update_async = AsyncMock(return_value=MagicMock())
        mock_resend = MagicMock()
        mock_resend.Contacts.update.return_value = None

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
            patch("src.core.billing_utils.resend", mock_resend, create=True),
        ):
            mock_settings.resend_user_audience_id = "aud_active_123"

            result = await propagate_email_change(user, "new@x.com")

        assert result is None
        mock_client.v1.customers.update_async.assert_awaited_once()
        mock_resend.Contacts.update.assert_called_once()


@pytest.mark.unit
class TestPropagateEmailChangeNoPII:
    """Warning logs on failure must not include the new email address (PII)."""

    @pytest.mark.asyncio
    async def test_stripe_failure_log_contains_no_email(self, caplog_loguru):
        """The warning emitted when Stripe fails must bind user_id + error, not email.

        CLAUDE.md rule: "Never log: emails/PII".
        """
        user = _make_user(stripe_customer_id="cus_adv")
        mock_client = MagicMock()
        mock_client.v1.customers.update_async = AsyncMock(
            side_effect=stripe_lib.StripeError("network error")
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

            with caplog_loguru.at_level(logging.WARNING):
                await propagate_email_change(user, "pii-email@secret.com")

        # Log was emitted
        assert any(
            "Stripe" in r.getMessage() for r in caplog_loguru.records
        ), "Expected a warning log for Stripe failure"
        # The raw email must NOT appear in any log record
        for record in caplog_loguru.records:
            assert (
                "pii-email@secret.com" not in record.getMessage()
            ), f"PII (email) leaked into log: {record.getMessage()!r}"

    @pytest.mark.asyncio
    async def test_resend_failure_log_contains_no_email(self, caplog_loguru):
        """The warning emitted when Resend fails must bind user_id + error, not email.

        CLAUDE.md rule: "Never log: emails/PII".
        """
        user = _make_user(stripe_customer_id=None)
        mock_resend = MagicMock()
        mock_resend.Contacts.update.side_effect = Exception("Resend 500")

        with (
            patch(
                "src.core.billing_utils.is_stripe_configured",
                return_value=False,
                create=True,
            ),
            patch("src.core.billing_utils.settings") as mock_settings,
            patch("src.core.billing_utils.resend", mock_resend, create=True),
        ):
            mock_settings.resend_user_audience_id = "aud_active_123"

            with caplog_loguru.at_level(logging.WARNING):
                await propagate_email_change(user, "pii-email@secret.com")

        # Log was emitted
        assert any(
            "Resend" in r.getMessage() for r in caplog_loguru.records
        ), "Expected a warning log for Resend failure"
        # The raw email must NOT appear in any log record
        for record in caplog_loguru.records:
            assert (
                "pii-email@secret.com" not in record.getMessage()
            ), f"PII (email) leaked into log: {record.getMessage()!r}"


@pytest.mark.unit
class TestPropagateEmailChangeCorrectArgs:
    """The new_email arg (not user.email) is what propagates to downstream systems."""

    @pytest.mark.asyncio
    async def test_stripe_params_carry_new_email_not_old(self):
        """Stripe update_async params must contain new_email, not user.email.

        At call time user.email may still hold the old value; the function must
        propagate the new_email argument, not the user object's current attribute.
        """
        user = _make_user(stripe_customer_id="cus_adv", email="old@example.com")
        mock_client = MagicMock()
        mock_client.v1.customers.update_async = AsyncMock(return_value=MagicMock())

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

            await propagate_email_change(user, "new-verified@x.com")

        mock_client.v1.customers.update_async.assert_awaited_once_with(
            "cus_adv",
            params={"email": "new-verified@x.com"},
        )
        # Sanity: old email was NOT passed
        call_kwargs = mock_client.v1.customers.update_async.call_args
        assert call_kwargs.kwargs["params"]["email"] != "old@example.com"
