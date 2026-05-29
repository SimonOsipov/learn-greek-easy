"""S3 Service for managing pre-signed URLs for culture question images.

This service provides:
- Pre-signed URL generation for GET operations
- Graceful handling of missing/invalid images
- Configurable URL expiry (default 1 hour)
- Support for Railway Buckets and AWS S3

The service is designed to fail gracefully - if S3 is unavailable or
an image doesn't exist, it returns None rather than raising exceptions.
This allows questions to remain usable without images.

Railway Buckets Configuration:
    Railway automatically provides: BUCKET, ACCESS_KEY_ID, SECRET_ACCESS_KEY, REGION, ENDPOINT
    Endpoint: https://storage.railway.app

AWS S3 Configuration:
    Set: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME, AWS_S3_REGION
    No endpoint needed (uses AWS default)

URL Stability Guarantee:
    Presigned GET URLs are byte-identical across deploys and across separate S3Service
    instances (including after a process restart) via *clock-window determinism*: the
    signing clock is floored to a window boundary before calling generate_presigned_url,
    so every signer that is within the same window produces the same X-Amz-Date and
    therefore the same signature.  The in-process _url_cache is a micro-optimisation
    (avoids redundant signing CPU) but is NOT the source of URL stability.
    NOTE: the app runs --workers 1 (see Dockerfile CMD), but concurrent threaded signing
    can occur via asyncio.to_thread; the module-level _SIGN_LOCK ensures the process-global
    botocore.auth rebind/restore is always atomic.

"""

import threading
import time
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

import boto3
import botocore.auth
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from src.config import settings
from src.core.logging import get_logger

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client

logger = get_logger(__name__)

# Avatar upload constraints
ALLOWED_AVATAR_CONTENT_TYPES = frozenset(["image/jpeg", "image/png", "image/webp"])
MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024  # 5MB
AVATAR_UPLOAD_URL_EXPIRY = 600  # 10 minutes

# Content type to extension mapping
CONTENT_TYPE_TO_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

# Content type to Cache-Control header mapping for uploaded objects.
# Applied via put_object CacheControl= so the stored object carries the directive.
# NO "immutable" here — that is added in SCACHE-03/04/05 after versioning lands.
# Unmapped types fall back to the image directive (graceful, no crash).
_DEFAULT_CACHE_CONTROL = "public, max-age=86400"
CONTENT_TYPE_TO_CACHE_CONTROL: dict[str, str] = {
    "image/jpeg": "public, max-age=86400",
    "image/png": "public, max-age=86400",
    "image/webp": "public, max-age=86400",
    "audio/mpeg": "public, max-age=86400",
}

# Lock protecting the process-global botocore.auth.get_current_datetime rebind
# used for deterministic presigned URL signing.  asyncio.to_thread can run
# multiple signing calls concurrently even in a --workers 1 deployment.
_SIGN_LOCK = threading.Lock()

# Deck cover image upload constraints
ALLOWED_DECK_IMAGE_CONTENT_TYPES = frozenset(["image/jpeg", "image/png", "image/webp"])
MAX_DECK_IMAGE_SIZE_BYTES = 3 * 1024 * 1024  # 3MB

# Presigned URL cache: hot-path micro-optimisation that avoids redundant signing.
# URL stability across deploys is guaranteed by clock-window determinism (see module
# docstring), NOT by this cache.
_PRESIGNED_URL_CACHE_BUFFER = 600  # 10 minutes before expiry, generate a new URL


class S3Service:
    """Service for S3 operations related to culture question images."""

    def __init__(self) -> None:
        """Initialize S3 service with AWS credentials from settings."""
        self._client: Optional["S3Client"] = None
        self._initialized = False
        self._url_cache: dict[str, tuple[str, float]] = {}  # key -> (url, valid_until)

    def _get_client(self) -> Optional["S3Client"]:
        """Get or create S3 client lazily.

        Returns:
            S3 client if configured, None otherwise
        """
        if self._initialized:
            return self._client

        self._initialized = True

        if not settings.s3_configured:
            logger.warning(
                "S3 not configured - credentials or bucket name missing",
                extra={
                    "has_access_key": bool(settings.effective_s3_access_key_id),
                    "has_secret_key": bool(settings.effective_s3_secret_access_key),
                    "has_bucket": bool(settings.effective_s3_bucket_name),
                    "has_endpoint": bool(settings.effective_s3_endpoint_url),
                },
            )
            return None

        try:
            config = Config(
                signature_version="s3v4",
                retries={"max_attempts": 3, "mode": "standard"},
            )

            # Create S3 client - endpoint_url is optional (Railway needs it, AWS doesn't)
            if settings.effective_s3_endpoint_url:
                self._client = boto3.client(
                    "s3",
                    aws_access_key_id=settings.effective_s3_access_key_id,
                    aws_secret_access_key=settings.effective_s3_secret_access_key,
                    region_name=settings.effective_s3_region,
                    config=config,
                    endpoint_url=settings.effective_s3_endpoint_url,
                )
            else:
                self._client = boto3.client(
                    "s3",
                    aws_access_key_id=settings.effective_s3_access_key_id,
                    aws_secret_access_key=settings.effective_s3_secret_access_key,
                    region_name=settings.effective_s3_region,
                    config=config,
                )

            logger.info(
                "S3 client initialized",
                extra={
                    "region": settings.effective_s3_region,
                    "bucket": settings.effective_s3_bucket_name,
                    "endpoint": settings.effective_s3_endpoint_url or "AWS default",
                    "provider": "Railway" if settings.effective_s3_endpoint_url else "AWS",
                },
            )
            return self._client
        except Exception as e:
            logger.error(
                "Failed to initialize S3 client",
                extra={"error": str(e)},
            )
            return None

    def generate_presigned_url(
        self,
        image_key: Optional[str],
        expiry_seconds: Optional[int] = None,
    ) -> Optional[str]:
        """Generate a pre-signed URL for an S3 object.

        Args:
            image_key: The S3 object key (e.g., "culture/images/q123.jpg").
                      If None or empty, returns None.
            expiry_seconds: URL expiry in seconds. Defaults to settings value.

        Returns:
            Pre-signed URL string if successful, None otherwise.
            Returns None for:
            - S3 not configured
            - Empty/None image_key
            - S3 client errors
            - Object doesn't exist (on HEAD check if enabled)

        Example:
            >>> s3_service = S3Service()
            >>> url = s3_service.generate_presigned_url("culture/q1.jpg")
            >>> if url:
            ...     return {"image_url": url}
        """
        # Handle empty/None image_key
        if not image_key:
            return None

        # Check cache: return existing URL if still valid
        cached = self._url_cache.get(image_key)
        if cached is not None:
            cached_url, valid_until = cached
            if time.monotonic() < valid_until:
                return cached_url

        client = self._get_client()
        if not client:
            return None

        expiry = expiry_seconds or settings.s3_presigned_url_expiry

        try:
            bucket_name = settings.effective_s3_bucket_name
            assert bucket_name is not None  # Guaranteed by _get_client() check

            # Clock-window determinism: floor the signing clock to a window boundary
            # so every signer within the same window produces an identical X-Amz-Date
            # and therefore a byte-identical URL.  This guarantees stable URLs across
            # deploys and fresh instances — NOT the in-process cache.
            window_seconds = max(expiry - _PRESIGNED_URL_CACHE_BUFFER, 60)
            now_epoch = time.time()
            floored_epoch = (int(now_epoch) // window_seconds) * window_seconds
            # Build naive UTC datetime (datetime.utcfromtimestamp is deprecated)
            frozen_dt = datetime.fromtimestamp(floored_epoch, tz=timezone.utc).replace(tzinfo=None)

            # Temporarily rebind botocore.auth.get_current_datetime to return the
            # floored datetime so SigV4Auth stamps X-Amz-Date with the window boundary.
            # Lock ensures the process-global rebind/restore is atomic across threads.
            with _SIGN_LOCK:
                _orig_get_current_datetime = botocore.auth.get_current_datetime
                botocore.auth.get_current_datetime = lambda: frozen_dt
                try:
                    url: str = client.generate_presigned_url(
                        "get_object",
                        Params={
                            "Bucket": bucket_name,
                            "Key": image_key,
                        },
                        ExpiresIn=expiry,
                    )
                finally:
                    botocore.auth.get_current_datetime = _orig_get_current_datetime

            # Cache the URL: valid until expiry minus buffer
            cache_ttl = max(expiry - _PRESIGNED_URL_CACHE_BUFFER, 60)
            self._url_cache[image_key] = (url, time.monotonic() + cache_ttl)

            logger.debug(
                "Generated pre-signed URL",
                extra={
                    "image_key": image_key,
                    "expiry_seconds": expiry,
                },
            )
            return url
        except (BotoCoreError, ClientError) as e:
            logger.warning(
                "Failed to generate pre-signed URL",
                extra={
                    "image_key": image_key,
                    "error": str(e),
                },
            )
            return None

    def check_object_exists(self, image_key: str) -> bool:
        """Check if an object exists in S3.

        Args:
            image_key: The S3 object key to check

        Returns:
            True if object exists, False otherwise
        """
        if not image_key:
            return False

        client = self._get_client()
        if not client:
            return False

        try:
            bucket_name = settings.effective_s3_bucket_name
            assert bucket_name is not None  # Guaranteed by s3_configured check
            client.head_object(
                Bucket=bucket_name,
                Key=image_key,
            )
            return True
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code == "404":
                logger.debug(
                    "Object not found in S3",
                    extra={"image_key": image_key},
                )
            else:
                logger.warning(
                    "Error checking object existence",
                    extra={
                        "image_key": image_key,
                        "error_code": error_code,
                        "error": str(e),
                    },
                )
            return False
        except BotoCoreError as e:
            logger.warning(
                "BotoCore error checking object existence",
                extra={
                    "image_key": image_key,
                    "error": str(e),
                },
            )
            return False

    def generate_presigned_upload_url(
        self,
        s3_key: str,
        content_type: str,
        expiry_seconds: int = AVATAR_UPLOAD_URL_EXPIRY,
    ) -> Optional[str]:
        """Generate a pre-signed URL for uploading to S3.

        Args:
            s3_key: The S3 object key to upload to
            content_type: The Content-Type of the file being uploaded
            expiry_seconds: URL expiry in seconds. Defaults to 10 minutes.

        Returns:
            Pre-signed URL string if successful, None otherwise.
        """
        client = self._get_client()
        if not client:
            return None

        try:
            bucket_name = settings.effective_s3_bucket_name
            assert bucket_name is not None

            url: str = client.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": bucket_name,
                    "Key": s3_key,
                    "ContentType": content_type,
                },
                ExpiresIn=expiry_seconds,
            )
            logger.debug(
                "Generated pre-signed upload URL",
                extra={
                    "s3_key": s3_key,
                    "content_type": content_type,
                    "expiry_seconds": expiry_seconds,
                },
            )
            return url
        except (BotoCoreError, ClientError) as e:
            logger.warning(
                "Failed to generate pre-signed upload URL",
                extra={
                    "s3_key": s3_key,
                    "error": str(e),
                },
            )
            return None

    def delete_object(self, s3_key: str) -> bool:
        """Delete an object from S3.

        Args:
            s3_key: The S3 object key to delete

        Returns:
            True if deleted successfully (or object didn't exist), False on error
        """
        if not s3_key:
            return True  # Nothing to delete

        client = self._get_client()
        if not client:
            logger.warning(
                "Cannot delete S3 object - client not initialized",
                extra={"s3_key": s3_key},
            )
            return False

        try:
            bucket_name = settings.effective_s3_bucket_name
            assert bucket_name is not None

            client.delete_object(
                Bucket=bucket_name,
                Key=s3_key,
            )
            self._url_cache.pop(s3_key, None)
            logger.info(
                "Deleted S3 object",
                extra={"s3_key": s3_key},
            )
            return True
        except (BotoCoreError, ClientError) as e:
            logger.error(
                "Failed to delete S3 object",
                extra={
                    "s3_key": s3_key,
                    "error": str(e),
                },
            )
            return False

    def upload_object(
        self,
        s3_key: str,
        data: bytes,
        content_type: str,
    ) -> bool:
        """Upload bytes directly to S3.

        Args:
            s3_key: The S3 object key
            data: Raw bytes to upload
            content_type: MIME type of the content

        Returns:
            True if upload successful, False otherwise
        """
        client = self._get_client()
        if not client:
            logger.warning(
                "Cannot upload to S3 - client not initialized",
                extra={"s3_key": s3_key},
            )
            return False

        try:
            bucket_name = settings.effective_s3_bucket_name
            assert bucket_name is not None

            # Apply per-content-type Cache-Control; unmapped types fall back to the
            # default image directive so news_item_service dynamic content-types
            # (e.g. image/gif, image/avif) never cause a crash.
            cache_control = CONTENT_TYPE_TO_CACHE_CONTROL.get(content_type, _DEFAULT_CACHE_CONTROL)
            client.put_object(
                Bucket=bucket_name,
                Key=s3_key,
                Body=data,
                ContentType=content_type,
                CacheControl=cache_control,
            )
            self._url_cache.pop(s3_key, None)
            logger.info(
                "Uploaded object to S3",
                extra={
                    "s3_key": s3_key,
                    "content_type": content_type,
                    "size_bytes": len(data),
                },
            )
            return True
        except (BotoCoreError, ClientError) as e:
            logger.error(
                "Failed to upload object to S3",
                extra={"s3_key": s3_key, "error": str(e)},
            )
            return False

    @staticmethod
    def validate_avatar_content_type(content_type: str) -> bool:
        """Check if content type is allowed for avatar uploads."""
        return content_type in ALLOWED_AVATAR_CONTENT_TYPES

    @staticmethod
    def validate_avatar_size(size_bytes: int) -> bool:
        """Check if file size is within allowed limit."""
        return 0 < size_bytes <= MAX_AVATAR_SIZE_BYTES

    @staticmethod
    def get_extension_for_content_type(content_type: str) -> Optional[str]:
        """Get file extension for a content type."""
        return CONTENT_TYPE_TO_EXT.get(content_type)


# Singleton instance for use across the application
_s3_service: Optional[S3Service] = None


def get_s3_service() -> S3Service:
    """Get or create the singleton S3Service instance.

    Returns:
        S3Service instance
    """
    global _s3_service
    if _s3_service is None:
        _s3_service = S3Service()
    return _s3_service
