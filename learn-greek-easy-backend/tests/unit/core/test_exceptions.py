"""Unit tests for the core API exception hierarchy.

Covers the High-tier exception clusters in ``src/core/exceptions.py`` that the
main.py exception handler reads verbatim (``status_code``, ``error_code``,
``detail``, ``extra``, ``headers``):

- BaseAPIException root contract (error_code fallback, extra default + isolation).
- PremiumRequiredException paywall payload (extra fields + private gate attrs).
- Billing cluster status codes / error codes / custom-detail overrides.
- Auth cluster status codes + WWW-Authenticate header behaviour.
- Seed cluster status codes / codes / details + mutual non-interchangeability.
- NounGenerationError raw_content storage contract.
"""

import pytest
from fastapi import status

from src.core.exceptions import (
    AlreadyPremiumException,
    BaseAPIException,
    BillingNotConfiguredException,
    CheckoutNotPaidException,
    CheckoutUserMismatchException,
    InvalidCredentialsException,
    NounGenerationError,
    PlanChangeNotAllowedException,
    PremiumRequiredException,
    SeedDisabledException,
    SeedForbiddenException,
    SeedUnauthorizedException,
    SubscriptionAlreadyCancelingException,
    SubscriptionNotActiveException,
    TokenExpiredException,
    TokenInvalidException,
    UnauthorizedException,
)

# ============================================================================
# BaseAPIException root contract
# ============================================================================


class TestBaseAPIException:
    """Root exception contract read directly by the main.py error handler."""

    def test_error_code_falls_back_to_class_name(self) -> None:
        exc = BaseAPIException(status_code=400, detail="boom")
        assert exc.error_code == "BaseAPIException"

    def test_explicit_error_code_preserved(self) -> None:
        exc = BaseAPIException(status_code=400, detail="boom", error_code="CUSTOM")
        assert exc.error_code == "CUSTOM"

    def test_subclass_error_code_falls_back_to_subclass_name(self) -> None:
        class MyError(BaseAPIException):
            def __init__(self) -> None:
                super().__init__(status_code=400, detail="x")

        assert MyError().error_code == "MyError"

    def test_extra_defaults_to_empty_dict_not_none(self) -> None:
        exc = BaseAPIException(status_code=400, detail="boom")
        assert exc.extra == {}
        assert exc.extra is not None

    def test_extra_preserved_when_provided(self) -> None:
        exc = BaseAPIException(status_code=400, detail="boom", extra={"k": "v"})
        assert exc.extra == {"k": "v"}

    def test_two_instances_do_not_share_extra_dict(self) -> None:
        """Mutable-default guard: each instance must get its own ``extra`` dict."""
        a = BaseAPIException(status_code=400, detail="a")
        b = BaseAPIException(status_code=400, detail="b")
        assert a.extra is not b.extra
        a.extra["mutated"] = True
        assert b.extra == {}

    def test_headers_passed_through(self) -> None:
        exc = BaseAPIException(status_code=400, detail="x", headers={"X-Foo": "bar"})
        assert exc.headers == {"X-Foo": "bar"}

    def test_headers_default_none(self) -> None:
        exc = BaseAPIException(status_code=400, detail="x")
        assert exc.headers is None

    def test_is_http_exception(self) -> None:
        from fastapi import HTTPException

        assert isinstance(BaseAPIException(status_code=400, detail="x"), HTTPException)


# ============================================================================
# PremiumRequiredException paywall payload
# ============================================================================


class TestPremiumRequiredException:
    """Paywall exception serialized verbatim into the upsell response."""

    def test_status_and_code(self) -> None:
        exc = PremiumRequiredException()
        assert exc.status_code == status.HTTP_403_FORBIDDEN
        assert exc.error_code == "PREMIUM_REQUIRED"

    def test_default_constructor_valid(self) -> None:
        exc = PremiumRequiredException()
        assert exc.detail == "Premium subscription required"
        assert exc.extra == {
            "required_tier": "premium",
            "current_tier": "free",
            "trial_eligible": False,
        }

    def test_extra_contains_tier_and_trial_fields(self) -> None:
        exc = PremiumRequiredException(
            current_tier="free",
            required_tier="premium",
            trial_eligible=True,
        )
        assert exc.extra["current_tier"] == "free"
        assert exc.extra["required_tier"] == "premium"
        assert exc.extra["trial_eligible"] is True

    def test_custom_detail_override(self) -> None:
        exc = PremiumRequiredException(detail="This deck requires a Premium subscription")
        assert exc.detail == "This deck requires a Premium subscription"

    def test_gate_type_and_deck_id_absent_from_extra(self) -> None:
        """Current contract: gate_type/deck_id are NOT serialized into the response.

        They are stored as private attrs and dropped by the main.py handler (which
        emits only ``exc.extra``). The upsell context (gate_type/deck_id) is already
        captured via PostHog at the raise site in src/core/subscription.py, so this
        pins the intentional response shape rather than leaking the private fields.
        """
        exc = PremiumRequiredException(gate_type="premium_deck", deck_id="deck-123")
        assert "gate_type" not in exc.extra
        assert "deck_id" not in exc.extra

    def test_gate_type_and_deck_id_stored_as_private_attrs(self) -> None:
        exc = PremiumRequiredException(gate_type="premium_deck", deck_id="deck-123")
        assert exc._gate_type == "premium_deck"
        assert exc._deck_id == "deck-123"

    def test_gate_type_defaults(self) -> None:
        exc = PremiumRequiredException()
        assert exc._gate_type == "require_premium"
        assert exc._deck_id is None

    def test_catchable_as_base(self) -> None:
        with pytest.raises(BaseAPIException):
            raise PremiumRequiredException()


# ============================================================================
# Billing cluster
# ============================================================================


class TestBillingCluster:
    """Guards on every Stripe lifecycle op — status/code must be exact."""

    @pytest.mark.parametrize(
        ("exc_class", "expected_status", "expected_code", "default_detail"),
        [
            (
                BillingNotConfiguredException,
                status.HTTP_400_BAD_REQUEST,
                "BILLING_NOT_CONFIGURED",
                "Stripe billing is not configured",
            ),
            (
                AlreadyPremiumException,
                status.HTTP_403_FORBIDDEN,
                "ALREADY_PREMIUM",
                "You already have an active premium subscription",
            ),
            (
                CheckoutNotPaidException,
                status.HTTP_400_BAD_REQUEST,
                "CHECKOUT_NOT_PAID",
                "Payment has not been completed",
            ),
            (
                CheckoutUserMismatchException,
                status.HTTP_400_BAD_REQUEST,
                "CHECKOUT_USER_MISMATCH",
                "Checkout session does not belong to this user",
            ),
            (
                SubscriptionNotActiveException,
                status.HTTP_409_CONFLICT,
                "SUBSCRIPTION_NOT_ACTIVE",
                "User does not have an active subscription",
            ),
            (
                PlanChangeNotAllowedException,
                status.HTTP_409_CONFLICT,
                "PLAN_CHANGE_NOT_ALLOWED",
                "Plan change is not allowed for this subscription",
            ),
            (
                SubscriptionAlreadyCancelingException,
                status.HTTP_409_CONFLICT,
                "SUBSCRIPTION_ALREADY_CANCELING",
                "Subscription is already scheduled for cancellation",
            ),
        ],
    )
    def test_status_code_and_detail(
        self,
        exc_class: type[BaseAPIException],
        expected_status: int,
        expected_code: str,
        default_detail: str,
    ) -> None:
        exc = exc_class()
        assert exc.status_code == expected_status
        assert exc.error_code == expected_code
        assert exc.detail == default_detail

    @pytest.mark.parametrize(
        "exc_class",
        [
            BillingNotConfiguredException,
            AlreadyPremiumException,
            CheckoutNotPaidException,
            CheckoutUserMismatchException,
            SubscriptionNotActiveException,
            PlanChangeNotAllowedException,
            SubscriptionAlreadyCancelingException,
        ],
    )
    def test_custom_detail_override(self, exc_class: type[BaseAPIException]) -> None:
        exc = exc_class(detail="custom message")
        assert exc.detail == "custom message"

    @pytest.mark.parametrize(
        "exc_class",
        [
            BillingNotConfiguredException,
            AlreadyPremiumException,
            CheckoutNotPaidException,
            CheckoutUserMismatchException,
            SubscriptionNotActiveException,
            PlanChangeNotAllowedException,
            SubscriptionAlreadyCancelingException,
        ],
    )
    def test_catchable_as_base(self, exc_class: type[BaseAPIException]) -> None:
        with pytest.raises(BaseAPIException):
            raise exc_class()


# ============================================================================
# Auth cluster
# ============================================================================


class TestAuthCluster:
    """All four auth exceptions are 401; only UnauthorizedException sets the header."""

    def test_unauthorized_sets_www_authenticate_bearer(self) -> None:
        exc = UnauthorizedException()
        assert exc.status_code == status.HTTP_401_UNAUTHORIZED
        assert exc.error_code == "UNAUTHORIZED"
        assert exc.headers == {"WWW-Authenticate": "Bearer"}

    def test_token_expired_is_401_without_header(self) -> None:
        exc = TokenExpiredException()
        assert exc.status_code == status.HTTP_401_UNAUTHORIZED
        assert exc.error_code == "TOKEN_EXPIRED"
        assert exc.headers is None

    def test_token_invalid_is_401_without_header(self) -> None:
        exc = TokenInvalidException()
        assert exc.status_code == status.HTTP_401_UNAUTHORIZED
        assert exc.error_code == "TOKEN_INVALID"
        assert exc.headers is None

    def test_invalid_credentials_is_401_without_header(self) -> None:
        exc = InvalidCredentialsException()
        assert exc.status_code == status.HTTP_401_UNAUTHORIZED
        assert exc.error_code == "INVALID_CREDENTIALS"
        assert exc.headers is None

    @pytest.mark.parametrize(
        "exc_class",
        [
            UnauthorizedException,
            TokenExpiredException,
            TokenInvalidException,
            InvalidCredentialsException,
        ],
    )
    def test_all_auth_exceptions_are_401_and_catchable(
        self, exc_class: type[BaseAPIException]
    ) -> None:
        exc = exc_class()
        assert exc.status_code == status.HTTP_401_UNAUTHORIZED
        assert isinstance(exc, BaseAPIException)

    @pytest.mark.parametrize(
        "exc_class",
        [TokenExpiredException, TokenInvalidException, InvalidCredentialsException],
    )
    def test_non_unauthorized_auth_exceptions_omit_bearer_header(
        self, exc_class: type[BaseAPIException]
    ) -> None:
        assert exc_class().headers is None

    def test_custom_detail_overrides(self) -> None:
        assert UnauthorizedException(detail="nope").detail == "nope"
        assert TokenExpiredException(detail="stale").detail == "stale"
        assert TokenInvalidException(detail="bad").detail == "bad"
        assert InvalidCredentialsException(detail="wrong").detail == "wrong"


# ============================================================================
# Seed cluster
# ============================================================================


class TestSeedCluster:
    """Seed-endpoint guards: a code swap would mask a prod misconfig."""

    def test_seed_forbidden(self) -> None:
        exc = SeedForbiddenException()
        assert exc.status_code == status.HTTP_403_FORBIDDEN
        assert exc.error_code == "SEED_FORBIDDEN"
        assert exc.detail == "Database seeding is forbidden in production environment"

    def test_seed_disabled(self) -> None:
        exc = SeedDisabledException()
        assert exc.status_code == status.HTTP_403_FORBIDDEN
        assert exc.error_code == "SEED_DISABLED"
        assert exc.detail == "Database seeding is disabled. Set TEST_SEED_ENABLED=true to enable"

    def test_seed_unauthorized(self) -> None:
        exc = SeedUnauthorizedException()
        assert exc.status_code == status.HTTP_401_UNAUTHORIZED
        assert exc.error_code == "SEED_UNAUTHORIZED"
        assert exc.detail == "Invalid or missing X-Test-Seed-Secret header"

    def test_forbidden_and_disabled_share_status_but_differ_in_code(self) -> None:
        forbidden = SeedForbiddenException()
        disabled = SeedDisabledException()
        assert forbidden.status_code == disabled.status_code == status.HTTP_403_FORBIDDEN
        assert forbidden.error_code != disabled.error_code

    def test_unauthorized_not_interchangeable_with_forbidden(self) -> None:
        assert SeedUnauthorizedException().status_code != SeedForbiddenException().status_code
        assert SeedUnauthorizedException().error_code != SeedForbiddenException().error_code

    @pytest.mark.parametrize(
        "exc_class",
        [SeedForbiddenException, SeedDisabledException, SeedUnauthorizedException],
    )
    def test_catchable_as_base(self, exc_class: type[BaseAPIException]) -> None:
        with pytest.raises(BaseAPIException):
            raise exc_class()


# ============================================================================
# NounGenerationError raw_content storage contract
# ============================================================================


class TestNounGenerationError:
    """Plain Exception (not BaseAPIException); stores detail + optional raw_content."""

    def test_not_base_api_exception(self) -> None:
        assert not issubclass(NounGenerationError, BaseAPIException)
        assert issubclass(NounGenerationError, Exception)

    def test_stores_detail_and_message(self) -> None:
        exc = NounGenerationError("parse failed")
        assert exc.detail == "parse failed"
        assert str(exc) == "parse failed"

    def test_raw_content_defaults_none(self) -> None:
        exc = NounGenerationError("parse failed")
        assert exc.raw_content is None

    def test_stores_raw_content_when_provided(self) -> None:
        exc = NounGenerationError("parse failed", raw_content="{bad json}")
        assert exc.raw_content == "{bad json}"
        assert exc.detail == "parse failed"

    def test_catchable_as_exception(self) -> None:
        with pytest.raises(NounGenerationError):
            raise NounGenerationError("boom")
