"""Unit tests for S3 Service.

Tests cover:
- Pre-signed URL generation (success and failure cases)
- Graceful handling when S3 is not configured
- Object existence checking
- Error handling for various AWS exceptions
- Singleton pattern for get_s3_service()
- Railway Buckets support (custom endpoint URL)
- AWS S3 support (no custom endpoint)
- Clock-window determinism (SCACHE-02)
- Cache-Control directives on upload_object (SCACHE-02/SCACHE-05)
- No ResponseCacheControl in presigned GET params (SCACHE-02)

"""

from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlparse

import botocore.auth
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


@pytest.fixture
def mock_settings_24h():
    """Configured S3 settings with 24-hour expiry (used by SCACHE-02 determinism tests)."""
    with patch("src.services.s3_service.settings") as mock:
        mock.s3_configured = True
        mock.effective_s3_access_key_id = "AKIAIOSFODNN7EXAMPLE"
        mock.effective_s3_secret_access_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
        mock.effective_s3_bucket_name = "test-bucket"
        mock.effective_s3_region = "eu-central-1"
        mock.effective_s3_endpoint_url = None
        mock.s3_presigned_url_expiry = 86400
        yield mock


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


# ============================================================================
# SCACHE-02 Module-level helpers and constants
# ============================================================================

_EXPIRY = 86400
_CACHE_BUFFER = 600  # _PRESIGNED_URL_CACHE_BUFFER
_WINDOW_SEC = _EXPIRY - _CACHE_BUFFER  # 85800 s
_FIXED_EPOCH = 1748553315.0  # arbitrary; offset 35115 s into a window
_FLOORED_EPOCH = (int(_FIXED_EPOCH) // _WINDOW_SEC) * _WINDOW_SEC  # 1748518200
_KEY = "culture/images/q123.jpg"


def _floor(epoch: float, window: int = _WINDOW_SEC) -> int:
    return (int(epoch) // window) * window


def _gen_url_with_clock(svc, clock_epoch: float, expiry: int = _EXPIRY) -> str | None:
    """Generate a URL with a controlled clock and empty cache."""
    svc._url_cache.clear()
    with patch("src.services.s3_service.time") as t:
        t.time.return_value = clock_epoch
        t.monotonic.return_value = 9_999_999  # always cache-miss
        return svc.generate_presigned_url(_KEY, expiry_seconds=expiry)


def _parse(url: str) -> dict:
    pq = parse_qs(urlparse(url).query)
    return {
        "date": pq.get("X-Amz-Date", ["MISSING"])[0],
        "expires": pq.get("X-Amz-Expires", ["MISSING"])[0],
        "sig": pq.get("X-Amz-Signature", ["MISSING"])[0],
    }


# ============================================================================
# SCACHE-02 Part A: Clock-window determinism
# ============================================================================


class TestClockWindowDeterminism:
    """Presigned URLs are byte-identical when the signing clock is in the same window."""

    def test_same_instance_same_window_byte_identical(self, mock_settings_24h):
        """Two calls within the same window from the same instance produce the same URL."""
        from src.services.s3_service import S3Service

        svc = S3Service()
        url_a = _gen_url_with_clock(svc, _FIXED_EPOCH)
        url_b = _gen_url_with_clock(svc, _FIXED_EPOCH + 100)  # 100s later, same window

        assert url_a is not None
        assert url_b is not None
        pa, pb = _parse(url_a), _parse(url_b)

        assert pa["date"] == pb["date"], "X-Amz-Date must be the same within a window"
        assert pa["sig"] == pb["sig"], "X-Amz-Signature must be identical within a window"
        assert url_a == url_b

    def test_fresh_instance_same_window_byte_identical(self, mock_settings_24h):
        """A fresh S3Service instance in the same window produces the same URL.

        This proves stability is NOT provided by the per-instance _url_cache but by
        clock-window determinism.
        """
        from src.services.s3_service import S3Service

        svc1 = S3Service()
        svc2 = S3Service()  # independent instance, no shared cache

        url_a = _gen_url_with_clock(svc1, _FIXED_EPOCH)
        url_b = _gen_url_with_clock(svc2, _FIXED_EPOCH + 200)  # fresh instance, same window

        assert url_a is not None and url_b is not None
        assert url_a == url_b, "Fresh instance in same window must produce byte-identical URL"

    def test_url_changes_at_window_boundary(self, mock_settings_24h):
        """URL changes when the clock advances into the next window."""
        from src.services.s3_service import S3Service

        svc_old = S3Service()
        svc_new = S3Service()

        url_old = _gen_url_with_clock(svc_old, _FIXED_EPOCH)
        next_window = _FLOORED_EPOCH + _WINDOW_SEC + 1  # just inside next window
        url_new = _gen_url_with_clock(svc_new, next_window)

        assert url_old is not None and url_new is not None
        po, pn = _parse(url_old), _parse(url_new)

        assert po["date"] != pn["date"], "X-Amz-Date must differ across window boundary"
        assert url_old != url_new

    def test_amz_expires_equals_configured_expiry(self, mock_settings_24h):
        """X-Amz-Expires in the URL equals the configured expiry seconds."""
        from src.services.s3_service import S3Service

        svc = S3Service()
        url = _gen_url_with_clock(svc, _FIXED_EPOCH)

        assert url is not None
        p = _parse(url)
        assert p["expires"] == str(
            _EXPIRY
        ), f"X-Amz-Expires={p['expires']!r} does not match configured expiry {_EXPIRY}"

    def test_no_403_gap_old_url_valid_at_window_rollover(self):
        """Old URL must still be valid when the new window starts (no 403 gap).

        The old URL was signed with the floored_epoch as its X-Amz-Date and
        X-Amz-Expires=86400. The window rolls after window_sec=85800s.
        At rollover, remaining validity = 86400 - 85800 = 600s (the buffer).
        """
        from src.services.s3_service import _PRESIGNED_URL_CACHE_BUFFER

        window_sec = max(_EXPIRY - _PRESIGNED_URL_CACHE_BUFFER, 60)
        floored = _floor(_FIXED_EPOCH, window_sec)

        url_expiry_epoch = floored + _EXPIRY  # signed_clock + ExpiresIn
        window_rollover_epoch = floored + window_sec
        remaining_at_rollover = url_expiry_epoch - window_rollover_epoch

        assert (
            remaining_at_rollover > 0
        ), f"Gap detected: old URL expires {-remaining_at_rollover}s BEFORE new window starts"
        assert (
            remaining_at_rollover == _PRESIGNED_URL_CACHE_BUFFER
        ), f"Expected remaining={_PRESIGNED_URL_CACHE_BUFFER}s, got {remaining_at_rollover}s"

    def test_window_seconds_calculation(self):
        """window_seconds = max(expiry - buffer, 60) with default 24h expiry."""
        from src.services.s3_service import _PRESIGNED_URL_CACHE_BUFFER

        window_sec = max(_EXPIRY - _PRESIGNED_URL_CACHE_BUFFER, 60)
        assert window_sec == 85800  # 23h 50m
        assert window_sec >= 60, "window_seconds must be at least 60"


# ============================================================================
# SCACHE-02 Part A: _SIGN_LOCK
# ============================================================================


class TestSignLock:
    """_SIGN_LOCK is present and is a threading.Lock."""

    def test_sign_lock_is_present(self):
        """Module-level _SIGN_LOCK must exist."""
        from src.services import s3_service as s3mod

        assert hasattr(s3mod, "_SIGN_LOCK"), "_SIGN_LOCK not found in s3_service module"

    def test_sign_lock_is_threading_lock(self):
        """_SIGN_LOCK must be a threading.Lock (or RLock) instance."""
        from src.services import s3_service as s3mod

        # threading.Lock() returns a _thread.lock; isinstance check via acquire/release duck typing
        lock = s3mod._SIGN_LOCK
        assert hasattr(lock, "acquire") and hasattr(
            lock, "release"
        ), "_SIGN_LOCK does not look like a threading.Lock"
        # Confirm it's not already locked from a previous test
        acquired = lock.acquire(blocking=False)
        if acquired:
            lock.release()
        else:
            pytest.fail("_SIGN_LOCK was left locked — possible rebind leak")

    def test_botocore_datetime_restored_after_signing(self, mock_settings_24h):
        """botocore.auth.get_current_datetime is restored to its original after signing."""
        from src.services.s3_service import S3Service

        original = botocore.auth.get_current_datetime

        svc = S3Service()
        _gen_url_with_clock(svc, _FIXED_EPOCH)

        assert (
            botocore.auth.get_current_datetime is original
        ), "botocore.auth.get_current_datetime was NOT restored after signing"

    def test_botocore_datetime_restored_on_exception(self, mock_settings_24h):
        """botocore.auth.get_current_datetime is restored even if generate_presigned_url raises."""
        from src.services.s3_service import S3Service

        original = botocore.auth.get_current_datetime

        with patch("src.services.s3_service.boto3.client") as mock_boto3:
            mock_client = MagicMock()
            from botocore.exceptions import ClientError

            mock_client.generate_presigned_url.side_effect = ClientError(
                {"Error": {"Code": "AccessDenied", "Message": "Denied"}},
                "GeneratePresignedUrl",
            )
            mock_boto3.return_value = mock_client

            svc = S3Service()
            result = _gen_url_with_clock(svc, _FIXED_EPOCH)

        # Result is None (exception was swallowed) — but the seam must be restored
        assert result is None
        assert (
            botocore.auth.get_current_datetime is original
        ), "botocore.auth.get_current_datetime was NOT restored after exception"


# ============================================================================
# SCACHE-02/SCACHE-05 Part B: Cache-Control on upload_object
# ============================================================================


class TestUploadObjectCacheControl:
    """upload_object passes correct Cache-Control to put_object."""

    def _upload_and_get_call_kwargs(self, content_type: str, s3_key: str = "test/key") -> dict:
        """Helper: run upload_object and return the put_object call kwargs."""
        with patch("src.services.s3_service.settings") as mock_settings:
            mock_settings.s3_configured = True
            mock_settings.effective_s3_access_key_id = "key"
            mock_settings.effective_s3_secret_access_key = "secret"
            mock_settings.effective_s3_bucket_name = "bucket"
            mock_settings.effective_s3_region = "eu-central-1"
            mock_settings.effective_s3_endpoint_url = None

            with patch("src.services.s3_service.boto3.client") as mock_boto3:
                mock_client = MagicMock()
                mock_boto3.return_value = mock_client

                from src.services.s3_service import S3Service

                svc = S3Service()
                result = svc.upload_object(s3_key, b"data", content_type)

        assert result is True, f"upload_object returned False for {content_type!r}"
        return mock_client.put_object.call_args.kwargs

    def test_jpeg_cache_control(self):
        """image/jpeg => public, max-age=86400, immutable."""
        kwargs = self._upload_and_get_call_kwargs("image/jpeg")
        assert kwargs["CacheControl"] == "public, max-age=31536000, immutable"

    def test_png_cache_control(self):
        """image/png => public, max-age=86400, immutable."""
        kwargs = self._upload_and_get_call_kwargs("image/png")
        assert kwargs["CacheControl"] == "public, max-age=31536000, immutable"

    def test_webp_cache_control(self):
        """image/webp => public, max-age=86400, immutable."""
        kwargs = self._upload_and_get_call_kwargs("image/webp")
        assert kwargs["CacheControl"] == "public, max-age=31536000, immutable"

    def test_audio_mpeg_cache_control(self):
        """audio/mpeg => public, max-age=86400, immutable."""
        kwargs = self._upload_and_get_call_kwargs("audio/mpeg")
        assert kwargs["CacheControl"] == "public, max-age=31536000, immutable"

    def test_unmapped_gif_falls_back_to_default(self):
        """image/gif (unmapped) => falls back to _DEFAULT_CACHE_CONTROL without raising."""
        from src.services.s3_service import _DEFAULT_CACHE_CONTROL

        kwargs = self._upload_and_get_call_kwargs("image/gif")
        assert kwargs["CacheControl"] == _DEFAULT_CACHE_CONTROL

    def test_unmapped_octet_stream_falls_back_to_default(self):
        """application/octet-stream (unmapped) => falls back to default without raising."""
        from src.services.s3_service import _DEFAULT_CACHE_CONTROL

        kwargs = self._upload_and_get_call_kwargs("application/octet-stream")
        assert kwargs["CacheControl"] == _DEFAULT_CACHE_CONTROL

    def test_cache_control_kwarg_is_present_in_put_object(self):
        """CacheControl= kwarg is always present in put_object, never omitted."""
        kwargs = self._upload_and_get_call_kwargs("image/jpeg")
        assert "CacheControl" in kwargs, "CacheControl kwarg missing from put_object call"

    def test_default_cache_control_value(self):
        """_DEFAULT_CACHE_CONTROL is public, max-age=86400, immutable."""
        from src.services.s3_service import _DEFAULT_CACHE_CONTROL

        assert _DEFAULT_CACHE_CONTROL == "public, max-age=31536000, immutable"


# ============================================================================
# SCACHE-02 AC #8/#9 (updated for SCACHE-05): immutable present, no ResponseCacheControl
# ============================================================================


class TestForbiddenDirectives:
    """immutable is present in all mapped Cache-Control values; no ResponseCacheControl in GET presign."""

    def test_immutable_in_all_content_type_mapping_values(self):
        """Every Cache-Control value in CONTENT_TYPE_TO_CACHE_CONTROL contains 'immutable'."""
        from src.services.s3_service import CONTENT_TYPE_TO_CACHE_CONTROL

        for ct, cc in CONTENT_TYPE_TO_CACHE_CONTROL.items():
            assert "immutable" in cc, (
                f"'immutable' missing from CONTENT_TYPE_TO_CACHE_CONTROL[{ct!r}]={cc!r}. "
                "All mapped types must carry the immutable directive."
            )

    def test_immutable_in_default_cache_control(self):
        """_DEFAULT_CACHE_CONTROL contains 'immutable'."""
        from src.services.s3_service import _DEFAULT_CACHE_CONTROL

        assert (
            "immutable" in _DEFAULT_CACHE_CONTROL
        ), f"'immutable' missing from _DEFAULT_CACHE_CONTROL={_DEFAULT_CACHE_CONTROL!r}"

    def test_no_response_cache_control_in_presign_params(self):
        """generate_presigned_url does NOT add ResponseCacheControl to the Params dict."""
        import inspect

        from src.services.s3_service import S3Service

        src_text = inspect.getsource(S3Service.generate_presigned_url)
        assert "ResponseCacheControl" not in src_text, (
            "ResponseCacheControl was added to generate_presigned_url Params — "
            "this would embed the directive in the URL and bypass CDN rules."
        )

    def test_presigned_url_params_do_not_contain_response_cache_control(self, mock_settings_24h):
        """The actual Params dict passed to generate_presigned_url has no ResponseCacheControl."""
        from src.services.s3_service import S3Service

        captured_params = {}

        with patch("src.services.s3_service.boto3.client") as mock_boto3:
            mock_client = MagicMock()

            def capture_call(operation, **kwargs):
                captured_params.update(kwargs.get("Params", {}))
                return "https://example.com/url?X-Amz-Signature=abc"

            mock_client.generate_presigned_url.side_effect = capture_call
            mock_boto3.return_value = mock_client

            svc = S3Service()
            _gen_url_with_clock(svc, _FIXED_EPOCH)

        assert (
            "ResponseCacheControl" not in captured_params
        ), f"ResponseCacheControl found in Params: {captured_params}"
