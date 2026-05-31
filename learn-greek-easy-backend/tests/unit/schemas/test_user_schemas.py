"""Unit tests for user schemas validation.

Covers UserUpdate, UserResponse (effective_role default that drives the
paywall), UserSettingsUpdate (validate_language coercion, theme pattern,
daily_goal bounds), UserWithSettingsUpdate (constraint parity with
UserSettingsUpdate), and AvatarUploadRequest (5 MB boundary + zero).
"""

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from pydantic import ValidationError

from src.schemas.user import (
    AvatarUploadRequest,
    UserResponse,
    UserSettingsUpdate,
    UserUpdate,
    UserWithSettingsUpdate,
)


class TestUserUpdate:
    """Test UserUpdate schema validation."""

    def test_all_fields_optional(self):
        """Test UserUpdate accepts no fields (all optional)."""
        update = UserUpdate()
        assert update.full_name is None
        assert update.avatar_url is None

    def test_valid_full_name_and_avatar(self):
        """Test UserUpdate with valid values."""
        update = UserUpdate(full_name="Maria Papadopoulou", avatar_url="avatars/abc.png")
        assert update.full_name == "Maria Papadopoulou"
        assert update.avatar_url == "avatars/abc.png"

    def test_full_name_empty_string_rejected(self):
        """Test empty full_name is rejected (min_length=1)."""
        with pytest.raises(ValidationError) as exc_info:
            UserUpdate(full_name="")
        assert "too_short" in str(exc_info.value).lower()

    def test_full_name_too_long_rejected(self):
        """Test full_name over 255 chars is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            UserUpdate(full_name="A" * 256)
        assert "string_too_long" in str(exc_info.value).lower()

    def test_avatar_url_too_long_rejected(self):
        """Test avatar_url over 500 chars is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            UserUpdate(avatar_url="a" * 501)
        assert "string_too_long" in str(exc_info.value).lower()


class TestUserResponseEffectiveRole:
    """Test UserResponse.effective_role field (drives the paywall)."""

    def _base_kwargs(self):
        now = datetime.now(timezone.utc)
        return {
            "id": uuid4(),
            "email": "user@example.com",
            "is_active": True,
            "is_superuser": False,
            "created_at": now,
            "updated_at": now,
        }

    def test_effective_role_defaults_to_free(self):
        """Test effective_role defaults to 'free' when omitted.

        This default is the fail-safe for the paywall: an un-set role must
        never accidentally grant premium access.
        """
        response = UserResponse(**self._base_kwargs())
        assert response.effective_role == "free"

    def test_effective_role_accepts_premium(self):
        """Test effective_role can be set to 'premium'."""
        response = UserResponse(effective_role="premium", **self._base_kwargs())
        assert response.effective_role == "premium"

    def test_effective_role_accepts_admin(self):
        """Test effective_role can be set to 'admin'."""
        response = UserResponse(effective_role="admin", **self._base_kwargs())
        assert response.effective_role == "admin"

    def test_effective_role_is_unconstrained_string(self):
        """Pin current behavior: effective_role is a plain str with no enum
        constraint at the schema layer (validation/derivation lives in the
        API layer, not here)."""
        response = UserResponse(effective_role="anything", **self._base_kwargs())
        assert response.effective_role == "anything"


class TestValidateLanguage:
    """Test UserSettingsUpdate.validate_language coercion."""

    def test_none_preserved(self):
        """Test None is preserved (clears language preference)."""
        settings = UserSettingsUpdate(preferred_language=None)
        assert settings.preferred_language is None

    def test_empty_string_coerced_to_none(self):
        """Pin current behavior: empty string is silently coerced to None.

        The audit flags this as masking client bugs (a client sending '' to
        set a language gets a silent no-op rather than a 422). Behavior is
        intentionally preserved here so '' continues to act as 'clear the
        preference'; see notes for the suspected-bug flag.
        """
        settings = UserSettingsUpdate(preferred_language="")
        assert settings.preferred_language is None

    def test_valid_language_en(self):
        """Test 'en' is accepted unchanged."""
        settings = UserSettingsUpdate(preferred_language="en")
        assert settings.preferred_language == "en"

    def test_valid_language_ru(self):
        """Test 'ru' is accepted unchanged."""
        settings = UserSettingsUpdate(preferred_language="ru")
        assert settings.preferred_language == "ru"

    def test_unsupported_language_rejected(self):
        """Test a non-empty unsupported code is rejected by the Literal.

        Confirms the empty-string coercion does NOT open the door to other
        arbitrary strings: 'fr' still fails Literal validation.
        """
        with pytest.raises(ValidationError):
            UserSettingsUpdate(preferred_language="fr")

    def test_greek_language_rejected(self):
        """Test 'el' (Greek UI removed) is rejected."""
        with pytest.raises(ValidationError):
            UserSettingsUpdate(preferred_language="el")


class TestUserSettingsUpdateTheme:
    """Test UserSettingsUpdate.theme pattern validation."""

    def test_theme_light(self):
        """Test 'light' is accepted."""
        settings = UserSettingsUpdate(theme="light")
        assert settings.theme == "light"

    def test_theme_dark(self):
        """Test 'dark' is accepted."""
        settings = UserSettingsUpdate(theme="dark")
        assert settings.theme == "dark"

    def test_theme_none(self):
        """Test None theme is accepted (optional)."""
        settings = UserSettingsUpdate(theme=None)
        assert settings.theme is None

    def test_theme_invalid_rejected(self):
        """Test arbitrary theme value is rejected by the pattern."""
        with pytest.raises(ValidationError) as exc_info:
            UserSettingsUpdate(theme="solarized")
        assert "string_pattern_mismatch" in str(exc_info.value).lower()

    def test_theme_empty_string_rejected(self):
        """Test empty theme is rejected (does not match pattern)."""
        with pytest.raises(ValidationError) as exc_info:
            UserSettingsUpdate(theme="")
        assert "string_pattern_mismatch" in str(exc_info.value).lower()

    def test_theme_case_sensitive(self):
        """Test theme pattern is case sensitive ('Light' rejected)."""
        with pytest.raises(ValidationError):
            UserSettingsUpdate(theme="Light")


class TestUserSettingsUpdateDailyGoal:
    """Test UserSettingsUpdate.daily_goal bounds (ge=1, le=200)."""

    def test_daily_goal_min_boundary(self):
        """Test daily_goal lower bound (1) is accepted."""
        settings = UserSettingsUpdate(daily_goal=1)
        assert settings.daily_goal == 1

    def test_daily_goal_max_boundary(self):
        """Test daily_goal upper bound (200) is accepted."""
        settings = UserSettingsUpdate(daily_goal=200)
        assert settings.daily_goal == 200

    def test_daily_goal_none(self):
        """Test daily_goal None is accepted (optional)."""
        settings = UserSettingsUpdate(daily_goal=None)
        assert settings.daily_goal is None

    def test_daily_goal_zero_rejected(self):
        """Test daily_goal of 0 is rejected (below ge=1)."""
        with pytest.raises(ValidationError) as exc_info:
            UserSettingsUpdate(daily_goal=0)
        assert "greater than or equal to 1" in str(exc_info.value).lower()

    def test_daily_goal_above_max_rejected(self):
        """Test daily_goal of 201 is rejected (above le=200)."""
        with pytest.raises(ValidationError) as exc_info:
            UserSettingsUpdate(daily_goal=201)
        assert "less than or equal to 200" in str(exc_info.value).lower()


class TestUserWithSettingsUpdate:
    """Test UserWithSettingsUpdate validation and constraint parity."""

    def test_all_fields_optional(self):
        """Test UserWithSettingsUpdate accepts no fields."""
        update = UserWithSettingsUpdate()
        assert update.full_name is None
        assert update.avatar_url is None
        assert update.daily_goal is None
        assert update.email_notifications is None
        assert update.preferred_language is None
        assert update.theme is None

    def test_full_combined_update(self):
        """Test a full combined profile + settings update."""
        update = UserWithSettingsUpdate(
            full_name="Yannis",
            avatar_url="avatars/y.png",
            daily_goal=50,
            email_notifications=True,
            preferred_language="ru",
            theme="dark",
        )
        assert update.full_name == "Yannis"
        assert update.daily_goal == 50
        assert update.preferred_language == "ru"
        assert update.theme == "dark"

    def test_daily_goal_bounds_match_settings_update(self):
        """Test daily_goal constraints agree with UserSettingsUpdate.

        Both schemas must enforce identical [1, 200] bounds. Divergence would
        let one endpoint accept goals the other rejects. This reads the
        constraints from the field metadata so a future divergence fails here.
        """
        combined = UserWithSettingsUpdate.model_fields["daily_goal"]
        settings = UserSettingsUpdate.model_fields["daily_goal"]

        def _bounds(field):
            ge = le = None
            for meta in field.metadata:
                if hasattr(meta, "ge"):
                    ge = meta.ge
                if hasattr(meta, "le"):
                    le = meta.le
            return ge, le

        assert _bounds(combined) == _bounds(settings) == (1, 200)

    def test_daily_goal_zero_rejected(self):
        """Test daily_goal of 0 rejected in combined schema too."""
        with pytest.raises(ValidationError) as exc_info:
            UserWithSettingsUpdate(daily_goal=0)
        assert "greater than or equal to 1" in str(exc_info.value).lower()

    def test_daily_goal_above_max_rejected(self):
        """Test daily_goal of 201 rejected in combined schema too."""
        with pytest.raises(ValidationError) as exc_info:
            UserWithSettingsUpdate(daily_goal=201)
        assert "less than or equal to 200" in str(exc_info.value).lower()

    def test_theme_invalid_rejected(self):
        """Test theme pattern enforced in combined schema."""
        with pytest.raises(ValidationError):
            UserWithSettingsUpdate(theme="sepia")

    def test_unsupported_language_rejected(self):
        """Test preferred_language Literal enforced in combined schema."""
        with pytest.raises(ValidationError):
            UserWithSettingsUpdate(preferred_language="fr")

    def test_empty_string_language_rejected(self):
        """Pin a divergence: UserWithSettingsUpdate has NO validate_language
        coercion, so '' is NOT coerced to None here and fails the Literal.

        This differs from UserSettingsUpdate (which silently maps '' -> None).
        See notes for the suspected behavioral inconsistency between the two
        schemas.
        """
        with pytest.raises(ValidationError):
            UserWithSettingsUpdate(preferred_language="")

    def test_full_name_empty_string_rejected(self):
        """Test empty full_name rejected (min_length=1)."""
        with pytest.raises(ValidationError):
            UserWithSettingsUpdate(full_name="")


class TestAvatarUploadRequest:
    """Test AvatarUploadRequest file_size bounds (gt=0, le=5MB)."""

    FIVE_MB = 5 * 1024 * 1024

    def test_valid_request(self):
        """Test a valid avatar upload request."""
        req = AvatarUploadRequest(content_type="image/png", file_size=1024)
        assert req.content_type == "image/png"
        assert req.file_size == 1024

    def test_file_size_at_5mb_boundary_accepted(self):
        """Test file_size exactly 5 MB is accepted (le boundary)."""
        req = AvatarUploadRequest(content_type="image/jpeg", file_size=self.FIVE_MB)
        assert req.file_size == self.FIVE_MB

    def test_file_size_one_byte_over_5mb_rejected(self):
        """Test file_size of 5 MB + 1 byte is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            AvatarUploadRequest(content_type="image/png", file_size=self.FIVE_MB + 1)
        assert "less than or equal to" in str(exc_info.value).lower()

    def test_file_size_one_byte_accepted(self):
        """Test minimum positive file_size (1 byte) is accepted (gt=0)."""
        req = AvatarUploadRequest(content_type="image/png", file_size=1)
        assert req.file_size == 1

    def test_file_size_zero_rejected(self):
        """Test file_size of 0 is rejected (gt=0)."""
        with pytest.raises(ValidationError) as exc_info:
            AvatarUploadRequest(content_type="image/png", file_size=0)
        assert "greater than 0" in str(exc_info.value).lower()

    def test_file_size_negative_rejected(self):
        """Test negative file_size is rejected (gt=0)."""
        with pytest.raises(ValidationError) as exc_info:
            AvatarUploadRequest(content_type="image/png", file_size=-1)
        assert "greater than 0" in str(exc_info.value).lower()

    def test_content_type_required(self):
        """Test content_type is required."""
        with pytest.raises(ValidationError) as exc_info:
            AvatarUploadRequest(file_size=1024)
        assert "content_type" in str(exc_info.value).lower()

    def test_file_size_required(self):
        """Test file_size is required."""
        with pytest.raises(ValidationError) as exc_info:
            AvatarUploadRequest(content_type="image/png")
        assert "file_size" in str(exc_info.value).lower()
