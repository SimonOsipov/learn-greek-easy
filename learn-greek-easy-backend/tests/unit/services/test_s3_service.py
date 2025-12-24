"""Unit tests for S3 Service.

Tests cover:
- Pre-signed URL generation (success and failure cases)
- Graceful handling when S3 is not configured
- Object existence checking
- Error handling for various AWS exceptions
- Singleton pattern for get_s3_service()
- Railway Buckets support (custom endpoint URL)
- AWS S3 support (no custom endpoint)

"""

from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import BotoCoreError, ClientError

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def mock_settings_configured():
    """Settings with S3 configured (AWS mode - no custom endpoint)."""
    with patch("src.services.s3_service.settings") as mock:
        # Legacy AWS fields (for backwards compatibility)
        mock.aws_access_key_id = "test-key-id"
        mock.aws_secret_access_key = "test-secret"
        mock.aws_s3_bucket_name = "test-bucket"
        mock.aws_s3_region = "eu-central-1"
        # New effective_* properties
        mock.effective_s3_access_key_id = "test-key-id"
        mock.effective_s3_secret_access_key = "test-secret"
        mock.effective_s3_bucket_name = "test-bucket"
        mock.effective_s3_region = "eu-central-1"
        mock.effective_s3_endpoint_url = None  # AWS mode - no custom endpoint
        mock.s3_presigned_url_expiry = 3600
        mock.s3_configured = True
        yield mock


@pytest.fixture
def mock_settings_railway():
    """Settings with Railway Buckets configured (custom endpoint)."""
    with patch("src.services.s3_service.settings") as mock:
        # Railway provides these via environment variables
        mock.effective_s3_access_key_id = "railway-key-id"
        mock.effective_s3_secret_access_key = "railway-secret"
        mock.effective_s3_bucket_name = "railway-bucket"
        mock.effective_s3_region = "auto"
        mock.effective_s3_endpoint_url = "https://storage.railway.app"
        mock.s3_presigned_url_expiry = 3600
        mock.s3_configured = True
        yield mock


@pytest.fixture
def mock_settings_not_configured():
    """Settings without S3 configured."""
    with patch("src.services.s3_service.settings") as mock:
        mock.aws_access_key_id = None
        mock.aws_secret_access_key = None
        mock.aws_s3_bucket_name = None
        mock.effective_s3_access_key_id = None
        mock.effective_s3_secret_access_key = None
        mock.effective_s3_bucket_name = None
        mock.effective_s3_endpoint_url = None
        mock.s3_configured = False
        yield mock


@pytest.fixture
def mock_boto3_client():
    """Mock boto3 S3 client."""
    with patch("src.services.s3_service.boto3.client") as mock:
        yield mock


@pytest.fixture
def reset_singleton():
    """Reset the singleton S3Service instance before each test."""
    import src.services.s3_service as s3_module

    s3_module._s3_service = None
    yield
    s3_module._s3_service = None


# ============================================================================
# S3Service Tests - Pre-signed URL Generation
# ============================================================================


class TestS3ServiceGeneratePresignedUrl:
    """Tests for S3Service.generate_presigned_url() method."""

    def test_generate_presigned_url_success(self, mock_settings_configured, mock_boto3_client):
        """Test successful pre-signed URL generation."""
        from src.services.s3_service import S3Service

        mock_client = MagicMock()
        mock_client.generate_presigned_url.return_value = (
            "https://test-bucket.s3.amazonaws.com/culture/image.jpg?signature=xxx"
        )
        mock_boto3_client.return_value = mock_client

        service = S3Service()
        url = service.generate_presigned_url("culture/image.jpg")

        assert url is not None
        assert "https://" in url
        assert "test-bucket" in url
        mock_client.generate_presigned_url.assert_called_once_with(
            "get_object",
            Params={
                "Bucket": "test-bucket",
                "Key": "culture/image.jpg",
            },
            ExpiresIn=3600,
        )

    def test_generate_presigned_url_empty_key_none(self, mock_settings_configured):
        """Test that None image_key returns None."""
        from src.services.s3_service import S3Service

        service = S3Service()

        assert service.generate_presigned_url(None) is None

    def test_generate_presigned_url_empty_key_string(self, mock_settings_configured):
        """Test that empty string image_key returns None."""
        from src.services.s3_service import S3Service

        service = S3Service()

        assert service.generate_presigned_url("") is None

    def test_generate_presigned_url_s3_not_configured(self, mock_settings_not_configured):
        """Test graceful handling when S3 is not configured."""
        from src.services.s3_service import S3Service

        service = S3Service()
        url = service.generate_presigned_url("culture/image.jpg")

        assert url is None

    def test_generate_presigned_url_client_error(self, mock_settings_configured, mock_boto3_client):
        """Test handling of AWS ClientError during URL generation."""
        from src.services.s3_service import S3Service

        mock_client = MagicMock()
        mock_client.generate_presigned_url.side_effect = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}},
            "GeneratePresignedUrl",
        )
        mock_boto3_client.return_value = mock_client

        service = S3Service()
        url = service.generate_presigned_url("culture/image.jpg")

        assert url is None

    def test_generate_presigned_url_botocore_error(
        self, mock_settings_configured, mock_boto3_client
    ):
        """Test handling of BotoCoreError during URL generation."""
        from src.services.s3_service import S3Service

        mock_client = MagicMock()
        mock_client.generate_presigned_url.side_effect = BotoCoreError()
        mock_boto3_client.return_value = mock_client

        service = S3Service()
        url = service.generate_presigned_url("culture/image.jpg")

        assert url is None

    def test_generate_presigned_url_custom_expiry(
        self, mock_settings_configured, mock_boto3_client
    ):
        """Test custom expiry time is passed to generate_presigned_url."""
        from src.services.s3_service import S3Service

        mock_client = MagicMock()
        mock_client.generate_presigned_url.return_value = "https://url"
        mock_boto3_client.return_value = mock_client

        service = S3Service()
        service.generate_presigned_url("key", expiry_seconds=7200)

        mock_client.generate_presigned_url.assert_called_once_with(
            "get_object",
            Params={
                "Bucket": "test-bucket",
                "Key": "key",
            },
            ExpiresIn=7200,
        )


# ============================================================================
# S3Service Tests - Object Existence Check
# ============================================================================


class TestS3ServiceCheckObjectExists:
    """Tests for S3Service.check_object_exists() method."""

    def test_check_object_exists_true(self, mock_settings_configured, mock_boto3_client):
        """Test object existence check returns True when object exists."""
        from src.services.s3_service import S3Service

        mock_client = MagicMock()
        mock_client.head_object.return_value = {}
        mock_boto3_client.return_value = mock_client

        service = S3Service()
        exists = service.check_object_exists("culture/image.jpg")

        assert exists is True
        mock_client.head_object.assert_called_once_with(
            Bucket="test-bucket",
            Key="culture/image.jpg",
        )

    def test_check_object_exists_false_404(self, mock_settings_configured, mock_boto3_client):
        """Test object existence check returns False on 404 not found."""
        from src.services.s3_service import S3Service

        mock_client = MagicMock()
        mock_client.head_object.side_effect = ClientError(
            {"Error": {"Code": "404", "Message": "Not Found"}},
            "HeadObject",
        )
        mock_boto3_client.return_value = mock_client

        service = S3Service()
        exists = service.check_object_exists("culture/missing.jpg")

        assert exists is False

    def test_check_object_exists_false_other_error(
        self, mock_settings_configured, mock_boto3_client
    ):
        """Test object existence check returns False on other ClientError."""
        from src.services.s3_service import S3Service

        mock_client = MagicMock()
        mock_client.head_object.side_effect = ClientError(
            {"Error": {"Code": "403", "Message": "Forbidden"}},
            "HeadObject",
        )
        mock_boto3_client.return_value = mock_client

        service = S3Service()
        exists = service.check_object_exists("culture/forbidden.jpg")

        assert exists is False

    def test_check_object_exists_botocore_error(self, mock_settings_configured, mock_boto3_client):
        """Test object existence check returns False on BotoCoreError."""
        from src.services.s3_service import S3Service

        mock_client = MagicMock()
        mock_client.head_object.side_effect = BotoCoreError()
        mock_boto3_client.return_value = mock_client

        service = S3Service()
        exists = service.check_object_exists("culture/image.jpg")

        assert exists is False

    def test_check_object_exists_empty_key(self, mock_settings_configured):
        """Test object existence check returns False for empty key."""
        from src.services.s3_service import S3Service

        service = S3Service()

        assert service.check_object_exists("") is False

    def test_check_object_exists_s3_not_configured(self, mock_settings_not_configured):
        """Test object existence check returns False when S3 not configured."""
        from src.services.s3_service import S3Service

        service = S3Service()
        exists = service.check_object_exists("culture/image.jpg")

        assert exists is False


# ============================================================================
# S3Service Tests - Client Initialization
# ============================================================================


class TestS3ServiceClientInitialization:
    """Tests for S3Service client initialization."""

    def test_lazy_client_initialization(self, mock_settings_configured, mock_boto3_client):
        """Test that S3 client is initialized lazily on first use."""
        from src.services.s3_service import S3Service

        mock_client = MagicMock()
        mock_client.generate_presigned_url.return_value = "https://url"
        mock_boto3_client.return_value = mock_client

        service = S3Service()

        # Client should not be created yet
        mock_boto3_client.assert_not_called()

        # First call should trigger initialization
        service.generate_presigned_url("key")
        mock_boto3_client.assert_called_once()

        # Second call should reuse existing client
        service.generate_presigned_url("key2")
        mock_boto3_client.assert_called_once()  # Still only one call

    def test_client_initialization_failure(self, mock_settings_configured, mock_boto3_client):
        """Test handling of exception during boto3 client creation."""
        from src.services.s3_service import S3Service

        mock_boto3_client.side_effect = Exception("Failed to create client")

        service = S3Service()
        url = service.generate_presigned_url("culture/image.jpg")

        assert url is None


# ============================================================================
# get_s3_service() Singleton Tests
# ============================================================================


class TestGetS3Service:
    """Tests for get_s3_service() singleton function."""

    def test_returns_singleton(self, reset_singleton):
        """Test that get_s3_service returns the same instance."""
        with patch("src.services.s3_service.settings") as mock:
            mock.s3_configured = False

            from src.services.s3_service import get_s3_service

            service1 = get_s3_service()
            service2 = get_s3_service()

            assert service1 is service2

    def test_creates_s3_service_instance(self, reset_singleton):
        """Test that get_s3_service returns an S3Service instance."""
        with patch("src.services.s3_service.settings") as mock:
            mock.s3_configured = False

            from src.services.s3_service import S3Service, get_s3_service

            service = get_s3_service()

            assert isinstance(service, S3Service)


# ============================================================================
# Integration with Services __init__.py
# ============================================================================


class TestServicesModuleExports:
    """Tests verifying S3Service is properly exported from services module."""

    def test_s3_service_exported(self):
        """Test that S3Service is accessible from src.services."""
        from src.services import S3Service

        assert S3Service is not None

    def test_get_s3_service_exported(self):
        """Test that get_s3_service is accessible from src.services."""
        from src.services import get_s3_service

        assert callable(get_s3_service)


# ============================================================================
# Railway Buckets Support Tests
# ============================================================================


class TestRailwayBucketsSupport:
    """Tests for Railway Buckets S3-compatible storage support."""

    def test_railway_client_uses_custom_endpoint(self, mock_settings_railway, mock_boto3_client):
        """Test that Railway configuration passes custom endpoint_url to boto3."""
        from src.services.s3_service import S3Service

        mock_client = MagicMock()
        mock_client.generate_presigned_url.return_value = "https://storage.railway.app/url"
        mock_boto3_client.return_value = mock_client

        service = S3Service()
        service.generate_presigned_url("culture/image.jpg")

        # Verify boto3.client was called with endpoint_url
        mock_boto3_client.assert_called_once()
        call_kwargs = mock_boto3_client.call_args[1]
        assert call_kwargs["endpoint_url"] == "https://storage.railway.app"
        assert call_kwargs["aws_access_key_id"] == "railway-key-id"
        assert call_kwargs["aws_secret_access_key"] == "railway-secret"
        assert call_kwargs["region_name"] == "auto"

    def test_railway_presigned_url_uses_correct_bucket(
        self, mock_settings_railway, mock_boto3_client
    ):
        """Test that Railway bucket name is used in presigned URL generation."""
        from src.services.s3_service import S3Service

        mock_client = MagicMock()
        mock_client.generate_presigned_url.return_value = "https://url"
        mock_boto3_client.return_value = mock_client

        service = S3Service()
        service.generate_presigned_url("culture/image.jpg")

        mock_client.generate_presigned_url.assert_called_once_with(
            "get_object",
            Params={
                "Bucket": "railway-bucket",
                "Key": "culture/image.jpg",
            },
            ExpiresIn=3600,
        )

    def test_aws_client_no_endpoint_url(self, mock_settings_configured, mock_boto3_client):
        """Test that AWS configuration does NOT pass endpoint_url to boto3."""
        from src.services.s3_service import S3Service

        mock_client = MagicMock()
        mock_client.generate_presigned_url.return_value = "https://url"
        mock_boto3_client.return_value = mock_client

        service = S3Service()
        service.generate_presigned_url("culture/image.jpg")

        # Verify boto3.client was called WITHOUT endpoint_url
        mock_boto3_client.assert_called_once()
        call_kwargs = mock_boto3_client.call_args[1]
        assert "endpoint_url" not in call_kwargs
        assert call_kwargs["aws_access_key_id"] == "test-key-id"
        assert call_kwargs["region_name"] == "eu-central-1"
