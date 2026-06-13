"""Contract / characterization tests for tests/helpers/time.py token helpers.

These tests guard the public contract of the three token helpers:
- create_expired_token  -> str, exp in the past, sub matches user_id
- create_future_token   -> str, exp in the future, sub matches user_id
- get_token_expiration  -> datetime in the past, does NOT raise on expired token

They are decoded independently using authlib.jose (NOT jose), so they
remain green even after python-jose is removed in INFRA-10-01.

Expected state:
  - GREEN now (characterises current jose-backed behaviour)
  - GREEN after INFRA-10-01 (authlib rewrite must preserve the same contract)
"""

import base64
from datetime import datetime, timezone
from uuid import uuid4

from tests.helpers.time import create_expired_token, create_future_token, get_token_expiration

# ---------------------------------------------------------------------------
# Helpers: decode a HS256 token independently via authlib.jose
# ---------------------------------------------------------------------------


def _decode_hs256(token: str, secret: str) -> dict:
    """Decode an HS256 JWT using authlib.jose without calling validate().

    This does NOT couple the tests to python-jose at all.
    validate() is deliberately skipped so we can inspect expired tokens.
    """
    from authlib.jose import jwt as authlib_jwt

    # authlib requires an OKP/oct JWK dict for HMAC keys
    key = {
        "kty": "oct",
        "k": base64.urlsafe_b64encode(secret.encode()).rstrip(b"=").decode(),
    }
    claims = authlib_jwt.decode(token, key)
    # Do NOT call claims.validate() — we intentionally read expired tokens here
    return dict(claims)


def _settings_secret() -> str:
    """Return jwt_secret_key from the application settings singleton."""
    from src.config import settings

    return settings.jwt_secret_key


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestCreateExpiredTokenContract:
    """create_expired_token must return a str whose exp is in the past."""

    def test_expired_token_helper_roundtrips(self):
        """create_expired_token returns a str; decoded exp is in the past; sub matches user_id."""
        user_id = uuid4()
        token = create_expired_token(user_id)

        # Contract: must be a plain str (not bytes)
        assert isinstance(
            token, str
        ), f"create_expired_token must return str, got {type(token).__name__!r}"

        secret = _settings_secret()
        claims = _decode_hs256(token, secret)

        # sub must match the user_id passed in
        assert claims["sub"] == str(user_id), f"Expected sub={user_id!s}, got {claims['sub']!r}"

        # exp must be in the past (the token is "expired")
        now_ts = datetime.now(tz=timezone.utc).timestamp()
        assert (
            claims["exp"] < now_ts
        ), f"Expected exp to be in the past, got exp={claims['exp']} vs now={now_ts:.0f}"


class TestCreateFutureTokenContract:
    """create_future_token must return a str whose exp is in the future."""

    def test_future_token_helper_roundtrips(self):
        """create_future_token returns a str; decoded exp is in the future; sub matches user_id."""
        user_id = uuid4()
        token = create_future_token(user_id)

        # Contract: must be a plain str
        assert isinstance(
            token, str
        ), f"create_future_token must return str, got {type(token).__name__!r}"

        secret = _settings_secret()
        claims = _decode_hs256(token, secret)

        assert claims["sub"] == str(user_id), f"Expected sub={user_id!s}, got {claims['sub']!r}"

        now_ts = datetime.now(tz=timezone.utc).timestamp()
        assert (
            claims["exp"] > now_ts
        ), f"Expected exp to be in the future, got exp={claims['exp']} vs now={now_ts:.0f}"


class TestGetTokenExpirationContract:
    """get_token_expiration must extract exp from an expired token without raising."""

    def test_get_token_expiration_extracts_exp_from_expired_token(self):
        """get_token_expiration returns a past datetime and does NOT raise on an expired token."""
        user_id = uuid4()
        expired_token = create_expired_token(user_id, hours_ago=2)

        # Must not raise even though the token is expired
        result = get_token_expiration(expired_token)

        # Contract: returns a datetime
        assert isinstance(
            result, datetime
        ), f"get_token_expiration must return datetime, got {type(result).__name__!r}"

        # The expiration time must be in the past
        now = datetime.now(tz=timezone.utc)
        # Normalise result to UTC for comparison
        if result.tzinfo is None:
            result = result.replace(tzinfo=timezone.utc)
        assert (
            result < now
        ), f"Expected returned exp to be in the past, got {result!r} vs now={now!r}"
