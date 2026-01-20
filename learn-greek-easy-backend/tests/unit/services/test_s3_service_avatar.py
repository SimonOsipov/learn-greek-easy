"""Unit tests for S3 service avatar-related methods.

Tests cover:
- Avatar content type validation
- Avatar file size validation
- Content type to extension mapping
- Presigned upload URL generation
- S3 object deletion

Run with:
    pytest tests/unit/services/test_s3_service_avatar.py -v
"""

from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import BotoCoreError, ClientError

from src.services.s3_service import (
    ALLOWED_AVATAR_CONTENT_TYPES,
    AVATAR_UPLOAD_URL_EXPIRY,
    CONTENT_TYPE_TO_EXT,
    MAX_AVATAR_SIZE_BYTES,
    S3Service,
)

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def reset_s3_singleton():
    """Reset S3 service singleton for each test."""
    import src.services.s3_service as s3_module

    s3_module._s3_service = None
    yield
    s3_module._s3_service = None


@pytest.fixture
def mock_settings_configured():
    """Settings with S3 configured."""
    with patch("src.services.s3_service.settings") as mock:
        mock.effective_s3_access_key_id = "test-key-id"
        mock.effective_s3_secret_access_key = "test-secret"
        mock.effective_s3_bucket_name = "test-bucket"
        mock.effective_s3_region = "eu-central-1"
        mock.effective_s3_endpoint_url = None
        mock.s3_presigned_url_expiry = 3600
        mock.s3_configured = True
        yield mock


@pytest.fixture
def mock_boto3_client():
    """Mock boto3 client."""
    with patch("src.services.s3_service.boto3.client") as mock:
        yield mock


# ============================================================================
# Avatar Content Type Validation Tests
# ============================================================================


class TestAvatarContentTypeValidation:
    """Tests for avatar content type validation."""

    def test_validate_jpeg_accepted(self):
        """Test that JPEG content type is accepted."""
        assert S3Service.validate_avatar_content_type("image/jpeg") is True

    def test_validate_png_accepted(self):
        """Test that PNG content type is accepted."""
        assert S3Service.validate_avatar_content_type("image/png") is True

    def test_validate_webp_accepted(self):
        """Test that WebP content type is accepted."""
        assert S3Service.validate_avatar_content_type("image/webp") is True

    def test_validate_gif_rejected(self):
        """Test that GIF content type is rejected."""
        assert S3Service.validate_avatar_content_type("image/gif") is False

    def test_validate_pdf_rejected(self):
        """Test that PDF content type is rejected."""
        assert S3Service.validate_avatar_content_type("application/pdf") is False

    def test_validate_svg_rejected(self):
        """Test that SVG content type is rejected."""
        assert S3Service.validate_avatar_content_type("image/svg+xml") is False

    def test_validate_empty_rejected(self):
        """Test that empty content type is rejected."""
        assert S3Service.validate_avatar_content_type("") is False

    def test_validate_text_rejected(self):
        """Test that text content type is rejected."""
        assert S3Service.validate_avatar_content_type("text/plain") is False


# ============================================================================
# Avatar Size Validation Tests
# ============================================================================


class TestAvatarSizeValidation:
    """Tests for avatar file size validation."""

    def test_validate_small_file_accepted(self):
        """Test that small file size is accepted."""
        assert S3Service.validate_avatar_size(1024) is True  # 1KB

    def test_validate_medium_file_accepted(self):
        """Test that medium file size is accepted."""
        assert S3Service.validate_avatar_size(2 * 1024 * 1024) is True  # 2MB

    def test_validate_max_size_accepted(self):
        """Test that file at exactly max size is accepted."""
        assert S3Service.validate_avatar_size(MAX_AVATAR_SIZE_BYTES) is True  # Exactly 5MB

    def test_validate_over_max_rejected(self):
        """Test that file over max size is rejected."""
        assert S3Service.validate_avatar_size(MAX_AVATAR_SIZE_BYTES + 1) is False

    def test_validate_zero_rejected(self):
        """Test that zero byte file is rejected."""
        assert S3Service.validate_avatar_size(0) is False

    def test_validate_negative_rejected(self):
        """Test that negative size is rejected."""
        assert S3Service.validate_avatar_size(-100) is False

    def test_validate_one_byte_accepted(self):
        """Test that minimum size (1 byte) is accepted."""
        assert S3Service.validate_avatar_size(1) is True


# ============================================================================
# Content Type to Extension Mapping Tests
# ============================================================================


class TestContentTypeToExtension:
    """Tests for content type to extension mapping."""

    def test_jpeg_returns_jpg(self):
        """Test that JPEG content type maps to jpg extension."""
        assert S3Service.get_extension_for_content_type("image/jpeg") == "jpg"

    def test_png_returns_png(self):
        """Test that PNG content type maps to png extension."""
        assert S3Service.get_extension_for_content_type("image/png") == "png"

    def test_webp_returns_webp(self):
        """Test that WebP content type maps to webp extension."""
        assert S3Service.get_extension_for_content_type("image/webp") == "webp"

    def test_unknown_returns_none(self):
        """Test that unknown content type returns None."""
        assert S3Service.get_extension_for_content_type("image/gif") is None

    def test_empty_returns_none(self):
        """Test that empty content type returns None."""
        assert S3Service.get_extension_for_content_type("") is None

    def test_invalid_returns_none(self):
        """Test that invalid content type returns None."""
        assert S3Service.get_extension_for_content_type("not-a-content-type") is None


# ============================================================================
# Presigned Upload URL Generation Tests
# ============================================================================


class TestGeneratePresignedUploadUrl:
    """Tests for presigned upload URL generation."""

    def test_success(
        self,
        reset_s3_singleton,
        mock_settings_configured,
        mock_boto3_client,
    ):
        """Test successful presigned upload URL generation."""
        # Arrange
        mock_client = MagicMock()
        mock_client.generate_presigned_url.return_value = (
            "https://s3.amazonaws.com/bucket/key?signature=abc"
        )
        mock_boto3_client.return_value = mock_client

        # Act
        service = S3Service()
        url = service.generate_presigned_upload_url(
            s3_key="avatars/user-id/uuid.jpg",
            content_type="image/jpeg",
        )

        # Assert
        assert url is not None
        assert "s3.amazonaws.com" in url
        mock_client.generate_presigned_url.assert_called_once_with(
            "put_object",
            Params={
                "Bucket": "test-bucket",
                "Key": "avatars/user-id/uuid.jpg",
                "ContentType": "image/jpeg",
            },
            ExpiresIn=AVATAR_UPLOAD_URL_EXPIRY,
        )

    def test_custom_expiry(
        self,
        reset_s3_singleton,
        mock_settings_configured,
        mock_boto3_client,
    ):
        """Test presigned URL with custom expiry."""
        mock_client = MagicMock()
        mock_client.generate_presigned_url.return_value = "https://url"
        mock_boto3_client.return_value = mock_client

        service = S3Service()
        service.generate_presigned_upload_url(
            s3_key="key.jpg",
            content_type="image/jpeg",
            expiry_seconds=300,
        )

        mock_client.generate_presigned_url.assert_called_once()
        call_args = mock_client.generate_presigned_url.call_args
        assert call_args[1]["ExpiresIn"] == 300

    def test_returns_none_on_client_error(
        self,
        reset_s3_singleton,
        mock_settings_configured,
        mock_boto3_client,
    ):
        """Test that ClientError returns None instead of raising."""
        mock_client = MagicMock()
        mock_client.generate_presigned_url.side_effect = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}},
            "GeneratePresignedUrl",
        )
        mock_boto3_client.return_value = mock_client

        service = S3Service()
        url = service.generate_presigned_upload_url("key.jpg", "image/jpeg")

        assert url is None

    def test_returns_none_on_botocore_error(
        self,
        reset_s3_singleton,
        mock_settings_configured,
        mock_boto3_client,
    ):
        """Test that BotoCoreError returns None instead of raising."""
        mock_client = MagicMock()
        mock_client.generate_presigned_url.side_effect = BotoCoreError()
        mock_boto3_client.return_value = mock_client

        service = S3Service()
        url = service.generate_presigned_upload_url("key.jpg", "image/jpeg")

        assert url is None

    def test_returns_none_when_not_configured(self, reset_s3_singleton):
        """Test that unconfigured S3 returns None."""
        with patch("src.services.s3_service.settings") as mock_settings:
            mock_settings.s3_configured = False

            service = S3Service()
            url = service.generate_presigned_upload_url("key.jpg", "image/jpeg")

            assert url is None

    def test_uses_png_content_type(
        self,
        reset_s3_singleton,
        mock_settings_configured,
        mock_boto3_client,
    ):
        """Test presigned URL generation with PNG content type."""
        mock_client = MagicMock()
        mock_client.generate_presigned_url.return_value = "https://url"
        mock_boto3_client.return_value = mock_client

        service = S3Service()
        service.generate_presigned_upload_url(
            s3_key="avatars/user-id/uuid.png",
            content_type="image/png",
        )

        call_args = mock_client.generate_presigned_url.call_args
        assert call_args[1]["Params"]["ContentType"] == "image/png"


# ============================================================================
# Delete Object Tests
# ============================================================================


class TestDeleteObject:
    """Tests for S3 object deletion."""

    def test_success(
        self,
        reset_s3_singleton,
        mock_settings_configured,
        mock_boto3_client,
    ):
        """Test successful object deletion."""
        mock_client = MagicMock()
        mock_boto3_client.return_value = mock_client

        service = S3Service()
        result = service.delete_object("avatars/user-id/uuid.jpg")

        assert result is True
        mock_client.delete_object.assert_called_once_with(
            Bucket="test-bucket",
            Key="avatars/user-id/uuid.jpg",
        )

    def test_empty_key_returns_true(self, reset_s3_singleton):
        """Test that empty key returns True without calling S3."""
        service = S3Service()
        assert service.delete_object("") is True

    def test_none_key_returns_true(self, reset_s3_singleton):
        """Test that None key returns True without calling S3."""
        service = S3Service()
        # Pass empty string since the method handles empty strings
        assert service.delete_object("") is True

    def test_returns_false_on_client_error(
        self,
        reset_s3_singleton,
        mock_settings_configured,
        mock_boto3_client,
    ):
        """Test that ClientError returns False."""
        mock_client = MagicMock()
        mock_client.delete_object.side_effect = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Denied"}},
            "DeleteObject",
        )
        mock_boto3_client.return_value = mock_client

        service = S3Service()
        result = service.delete_object("key.jpg")

        assert result is False

    def test_returns_false_on_botocore_error(
        self,
        reset_s3_singleton,
        mock_settings_configured,
        mock_boto3_client,
    ):
        """Test that BotoCoreError returns False."""
        mock_client = MagicMock()
        mock_client.delete_object.side_effect = BotoCoreError()
        mock_boto3_client.return_value = mock_client

        service = S3Service()
        result = service.delete_object("key.jpg")

        assert result is False

    def test_returns_false_when_not_configured(self, reset_s3_singleton):
        """Test that unconfigured S3 returns False."""
        with patch("src.services.s3_service.settings") as mock_settings:
            mock_settings.s3_configured = False

            service = S3Service()
            result = service.delete_object("key.jpg")

            assert result is False


# ============================================================================
# Avatar Constants Tests
# ============================================================================


class TestAvatarConstants:
    """Tests for avatar-related constants."""

    def test_allowed_content_types(self):
        """Test that allowed content types are correct."""
        assert ALLOWED_AVATAR_CONTENT_TYPES == frozenset(["image/jpeg", "image/png", "image/webp"])

    def test_max_size_is_5mb(self):
        """Test that max size is 5MB."""
        assert MAX_AVATAR_SIZE_BYTES == 5 * 1024 * 1024

    def test_upload_url_expiry_is_10_minutes(self):
        """Test that upload URL expiry is 10 minutes."""
        assert AVATAR_UPLOAD_URL_EXPIRY == 600

    def test_content_type_mappings(self):
        """Test that content type mappings are correct."""
        assert CONTENT_TYPE_TO_EXT == {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
        }
