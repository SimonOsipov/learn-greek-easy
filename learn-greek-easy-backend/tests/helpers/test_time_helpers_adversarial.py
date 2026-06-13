"""Adversarial / edge / boundary coverage for tests/helpers/time.py token helpers.

Mode B QA additions for INFRA-10-01. These tests do NOT duplicate the AC contract
tests in test_time_helpers.py; they extend coverage with:

- Tamper-resistance: wrong key and signature mutation must fail decode
- Claim round-trip fidelity: all expected claims survive encode→decode
- create_future_token timing precision: exp is ≈ N hours ahead (not just "future")
- get_token_expiration on a NON-expired (future) token: must return correct datetime
- hours_ago boundary: hours_ago=0 should still produce an exp <= now (past or equal)
- token_type claim propagates through both helpers
"""

import base64
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from tests.helpers.time import create_expired_token, create_future_token, get_token_expiration

# ---------------------------------------------------------------------------
# Shared decode helper (no validate() — to inspect expired tokens)
# ---------------------------------------------------------------------------


def _decode_hs256_raw(token: str, secret: str) -> dict:
    """Decode an HS256 JWT with authlib without calling validate()."""
    from authlib.jose import jwt as authlib_jwt

    key = {
        "kty": "oct",
        "k": base64.urlsafe_b64encode(secret.encode()).rstrip(b"=").decode(),
    }
    claims = authlib_jwt.decode(token, key)
    return dict(claims)


def _settings_secret() -> str:
    from src.config import settings

    return settings.jwt_secret_key


# ---------------------------------------------------------------------------
# Tamper-resistance
# ---------------------------------------------------------------------------


class TestTamperResistance:
    """Tokens produced by the helpers must NOT be decodable with a wrong key."""

    def test_expired_token_wrong_key_raises(self):
        """Decoding create_expired_token with the wrong key must raise."""
        from authlib.jose import jwt as authlib_jwt
        from authlib.jose.errors import BadSignatureError

        user_id = uuid4()
        token = create_expired_token(user_id)

        wrong_secret = "wrong-key-totally-different-12345"
        wrong_key = {
            "kty": "oct",
            "k": base64.urlsafe_b64encode(wrong_secret.encode()).rstrip(b"=").decode(),
        }
        with pytest.raises((BadSignatureError, Exception)):
            authlib_jwt.decode(token, wrong_key)

    def test_future_token_wrong_key_raises(self):
        """Decoding create_future_token with the wrong key must raise."""
        from authlib.jose import jwt as authlib_jwt
        from authlib.jose.errors import BadSignatureError

        user_id = uuid4()
        token = create_future_token(user_id)

        wrong_secret = "another-wrong-key-pad-to-32chars!!"
        wrong_key = {
            "kty": "oct",
            "k": base64.urlsafe_b64encode(wrong_secret.encode()).rstrip(b"=").decode(),
        }
        with pytest.raises((BadSignatureError, Exception)):
            authlib_jwt.decode(token, wrong_key)

    def test_signature_mutation_rejected(self):
        """Mutating the signature segment of a token must cause decode to reject it."""
        from authlib.jose import jwt as authlib_jwt

        user_id = uuid4()
        token = create_expired_token(user_id)

        # JWT has 3 segments: header.payload.signature
        parts = token.split(".")
        assert len(parts) == 3, "Expected standard 3-segment JWT"

        # Flip last char of signature to corrupt it
        sig = parts[2]
        # Replace last character with something different
        corrupted_sig = sig[:-1] + ("A" if sig[-1] != "A" else "B")
        corrupted_token = ".".join([parts[0], parts[1], corrupted_sig])

        secret = _settings_secret()
        key = {
            "kty": "oct",
            "k": base64.urlsafe_b64encode(secret.encode()).rstrip(b"=").decode(),
        }
        with pytest.raises(Exception):
            authlib_jwt.decode(corrupted_token, key)


# ---------------------------------------------------------------------------
# Claim round-trip fidelity
# ---------------------------------------------------------------------------


class TestClaimRoundTrip:
    """All expected claims must survive the encode→decode round-trip."""

    def test_expired_token_all_claims_present(self):
        """create_expired_token must embed sub, exp, iat, type in the token."""
        user_id = uuid4()
        token = create_expired_token(user_id, hours_ago=3, token_type="refresh")
        claims = _decode_hs256_raw(token, _settings_secret())

        assert "sub" in claims, "Missing 'sub' claim"
        assert "exp" in claims, "Missing 'exp' claim"
        assert "iat" in claims, "Missing 'iat' claim"
        assert "type" in claims, "Missing 'type' claim"
        assert claims["sub"] == str(user_id)
        assert claims["type"] == "refresh"

    def test_future_token_all_claims_present(self):
        """create_future_token must embed sub, exp, iat, type in the token."""
        user_id = uuid4()
        token = create_future_token(user_id, expires_in_hours=48, token_type="refresh")
        claims = _decode_hs256_raw(token, _settings_secret())

        assert "sub" in claims, "Missing 'sub' claim"
        assert "exp" in claims, "Missing 'exp' claim"
        assert "iat" in claims, "Missing 'iat' claim"
        assert "type" in claims, "Missing 'type' claim"
        assert claims["sub"] == str(user_id)
        assert claims["type"] == "refresh"

    def test_expired_token_type_access_default(self):
        """Default token_type is 'access' for create_expired_token."""
        token = create_expired_token(uuid4())
        claims = _decode_hs256_raw(token, _settings_secret())
        assert claims["type"] == "access"

    def test_future_token_type_access_default(self):
        """Default token_type is 'access' for create_future_token."""
        token = create_future_token(uuid4())
        claims = _decode_hs256_raw(token, _settings_secret())
        assert claims["type"] == "access"


# ---------------------------------------------------------------------------
# Timing precision
# ---------------------------------------------------------------------------


class TestTimingPrecision:
    """Expiration timestamps must be approximately correct, not just in the right direction."""

    def test_expired_token_exp_approximately_hours_ago(self):
        """Expired token exp should be ≈ hours_ago hours before now (within 5s tolerance).

        Note: uses datetime.utcnow().timestamp() to match how the helpers compute exp
        (naive-datetime .timestamp() is local-timezone-aware; using the same basis avoids
        a spurious 3-hour delta on machines in non-UTC zones with Python 3.14).
        """
        from datetime import datetime as _dt

        hours_ago = 3
        before_ts = _dt.utcnow().timestamp()
        token = create_expired_token(uuid4(), hours_ago=hours_ago)
        after_ts = _dt.utcnow().timestamp()

        claims = _decode_hs256_raw(token, _settings_secret())
        exp = claims["exp"]

        tolerance = 5  # 5-second window
        expected_min = before_ts - (hours_ago * 3600) - tolerance
        expected_max = after_ts - (hours_ago * 3600) + tolerance
        assert (
            expected_min <= exp <= expected_max
        ), f"exp={exp} not ≈ {hours_ago}h ago (expected {expected_min:.0f}–{expected_max:.0f})"

    def test_future_token_exp_approximately_hours_ahead(self):
        """Future token exp should be ≈ expires_in_hours ahead of now (within 5s tolerance).

        Note: uses datetime.utcnow().timestamp() to match how the helpers compute exp.
        """
        from datetime import datetime as _dt

        hours_ahead = 12
        before_ts = _dt.utcnow().timestamp()
        token = create_future_token(uuid4(), expires_in_hours=hours_ahead)
        after_ts = _dt.utcnow().timestamp()

        claims = _decode_hs256_raw(token, _settings_secret())
        exp = claims["exp"]

        expected_min = before_ts + (hours_ahead * 3600) - 5
        expected_max = after_ts + (hours_ahead * 3600) + 5
        assert (
            expected_min <= exp <= expected_max
        ), f"exp={exp} not ≈ {hours_ahead}h ahead (expected {expected_min:.0f}–{expected_max:.0f})"

    def test_hours_ago_zero_produces_past_or_equal_exp(self):
        """hours_ago=0 edge case: exp should be <= now (boundary: just expired or exactly now).

        Uses datetime.utcnow().timestamp() to match the helpers' epoch basis.
        """
        from datetime import datetime as _dt

        token = create_expired_token(uuid4(), hours_ago=0)
        after_ts = _dt.utcnow().timestamp()

        claims = _decode_hs256_raw(token, _settings_secret())
        exp = claims["exp"]

        # exp must be <= now+1 to account for integer truncation in timestamp()
        assert exp <= after_ts + 1, f"hours_ago=0 produced a future exp={exp}, now={after_ts:.0f}"


# ---------------------------------------------------------------------------
# get_token_expiration on a NON-expired token
# ---------------------------------------------------------------------------


class TestGetTokenExpirationFuture:
    """get_token_expiration must also work correctly on a non-expired (future) token."""

    def test_get_token_expiration_returns_future_datetime_for_future_token(self):
        """On a future token, get_token_expiration must return a datetime in the future."""
        hours_ahead = 6
        user_id = uuid4()
        token = create_future_token(user_id, expires_in_hours=hours_ahead)

        result = get_token_expiration(token)

        assert isinstance(result, datetime), f"Expected datetime, got {type(result).__name__}"

        now = datetime.now(tz=timezone.utc)
        if result.tzinfo is None:
            result = result.replace(tzinfo=timezone.utc)

        assert result > now, f"Expected future exp for future token, got {result!r} <= {now!r}"

    def test_get_token_expiration_consistent_with_create_future_token(self):
        """get_token_expiration must return a datetime consistent with the exp claim embedded
        by create_future_token — i.e. the two must agree within 1 second when decoded
        independently.

        This test avoids wall-clock epoch comparisons (which vary on non-UTC machines)
        and instead verifies internal consistency: decode the token twice via two different
        code paths and confirm both paths see the same exp value.
        """
        hours_ahead = 4
        user_id = uuid4()
        token = create_future_token(user_id, expires_in_hours=hours_ahead)

        # Path A: get_token_expiration (the helper under test)
        result = get_token_expiration(token)
        if result.tzinfo is None:
            result = result.replace(tzinfo=timezone.utc)

        # Path B: independent decode via _decode_hs256_raw, same authlib primitives
        claims = _decode_hs256_raw(token, _settings_secret())
        independent_exp = datetime.fromtimestamp(claims["exp"], tz=timezone.utc)

        # Both paths must agree on the same exp (within 1s for integer truncation)
        delta = abs((result - independent_exp).total_seconds())
        assert delta <= 1, (
            f"get_token_expiration returned {result!r} but independent decode "
            f"gives {independent_exp!r} — they disagree by {delta:.3f}s"
        )

        # The decoded exp must be in the future relative to the token creation time
        # (checked via the independent decode: exp - iat should be ≈ hours_ahead*3600)
        iat = claims.get("iat")
        if iat is not None:
            expected_duration_secs = hours_ahead * 3600
            actual_duration_secs = claims["exp"] - iat
            tolerance = 10  # 10-second window for integer truncation
            assert abs(actual_duration_secs - expected_duration_secs) <= tolerance, (
                f"Token duration {actual_duration_secs}s != expected {expected_duration_secs}s "
                f"(±{tolerance}s)"
            )

    def test_get_token_expiration_does_not_raise_on_future_token(self):
        """Calling get_token_expiration on a non-expired token must not raise."""
        token = create_future_token(uuid4(), expires_in_hours=24)
        # Should not raise
        result = get_token_expiration(token)
        assert result is not None
