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

import io
import posixpath
import threading
import time
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Optional

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
# "immutable" is safe: all overwritten keys are versioned (SCACHE-03/04/05 done),
# so re-uploads mint a new key + delete the old — no in-place overwrite can pin stale bytes.
# Unmapped types fall back to the image directive (graceful, no crash).
_DEFAULT_CACHE_CONTROL = "public, max-age=31536000, immutable"
CONTENT_TYPE_TO_CACHE_CONTROL: dict[str, str] = {
    "image/jpeg": "public, max-age=31536000, immutable",
    "image/png": "public, max-age=31536000, immutable",
    "image/webp": "public, max-age=31536000, immutable",
    "audio/mpeg": "public, max-age=31536000, immutable",
}

# Lock protecting the process-global botocore.auth.get_current_datetime rebind
# used for deterministic presigned URL signing.  asyncio.to_thread can run
# multiple signing calls concurrently even in a --workers 1 deployment.
_SIGN_LOCK = threading.Lock()

# Deck cover image upload constraints
ALLOWED_DECK_IMAGE_CONTENT_TYPES = frozenset(["image/jpeg", "image/png", "image/webp"])
MAX_DECK_IMAGE_SIZE_BYTES = 3 * 1024 * 1024  # 3MB

# 30-day expiry for situation/news/culture-question image presigns.
# Mirrors _COVER_IMAGE_URL_EXPIRY_SECONDS in culture_deck_service.py (line 53).
# The clock-window floor derives a ~30-day signing window from this value, making
# image URLs byte-stable for ~30 days so returning users hit browser disk cache
# instead of re-downloading on every session.
IMAGE_PRESIGN_EXPIRY_SECONDS = 2592000  # 30 days

# WebP derivative widths generated alongside every image upload (PERF-10).
# Keys follow the scheme  <base_without_ext>_<width>w.webp
# e.g. situation-pictures/abc123/sha256hash_400w.webp
# PERF-11 backfill script reuses these same widths + key scheme.
DERIVATIVE_WIDTHS: tuple[int, ...] = (400, 800, 1600)
_DERIVATIVE_CONTENT_TYPE = "image/webp"

# MIME types that trigger derivative generation (audio/other types are skipped).
_IMAGE_CONTENT_TYPES = frozenset(
    [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/avif",
        "image/heic",
    ]
)

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
                _orig_get_current_datetime = getattr(botocore.auth, "get_current_datetime")
                setattr(botocore.auth, "get_current_datetime", lambda: frozen_dt)
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
                    setattr(botocore.auth, "get_current_datetime", _orig_get_current_datetime)

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

    @staticmethod
    def _encode_webp(img: "Any", width: int, original_height: int) -> Optional[bytes]:
        """Resize *img* (a PIL Image) to *width* px and encode as WebP."""
        from PIL import Image  # noqa: PLC0415

        height = max(1, int(original_height * width / img.width))
        resized: Any = img.resize((width, height), Image.Resampling.LANCZOS)
        if resized.mode not in ("RGB", "RGBA"):
            resized = resized.convert("RGB")
        buf = io.BytesIO()
        resized.save(buf, format="WEBP", quality=82, method=4)
        return buf.getvalue()

    def _upload_derivative_width(
        self,
        base_without_ext: str,
        img: "Any",
        width: int,
        original_height: int,
        base_s3_key: str,
    ) -> Optional[str]:
        """Encode one WebP derivative, upload it, return key on success or None."""
        webp_bytes = self._encode_webp(img, width, original_height)
        if not webp_bytes:
            return None
        derivative_key = f"{base_without_ext}_{width}w.webp"
        ok = self.upload_object(derivative_key, webp_bytes, _DERIVATIVE_CONTENT_TYPE)
        if ok:
            logger.info(
                "Uploaded WebP derivative",
                extra={
                    "derivative_key": derivative_key,
                    "width": width,
                    "size_bytes": len(webp_bytes),
                },
            )
            return derivative_key
        logger.warning(
            "Failed to upload WebP derivative",
            extra={"derivative_key": derivative_key, "width": width},
        )
        return None

    @staticmethod
    def _open_image(image_bytes: bytes) -> "Optional[Any]":
        """Open *image_bytes* as a Pillow Image, normalise mode to RGB/RGBA, return it.

        Returns a ``PIL.Image.Image`` instance, or None if decoding fails.
        Typed as ``Any`` because PIL has no PEP 561 stubs bundled with the package.
        """
        from PIL import Image  # noqa: PLC0415

        try:
            img: Any = Image.open(io.BytesIO(image_bytes))
        except Exception:
            return None
        if img.mode not in ("RGB", "RGBA"):
            try:
                img = img.convert(
                    "RGBA" if img.mode == "P" and "transparency" in img.info else "RGB"
                )
            except Exception:
                pass
        return img

    def generate_image_derivatives(
        self,
        base_s3_key: str,
        image_bytes: bytes,
        widths: tuple[int, ...] = DERIVATIVE_WIDTHS,
    ) -> list[str]:
        """Generate WebP derivatives at the requested widths and upload them to S3.

        Produces one WebP variant per width (skipping widths >= source width) and
        uploads each under the deterministic key ``<base_without_ext>_<width>w.webp``.
        The original object is never modified.  Per-width failures are swallowed.

        Returns:
            List of S3 keys for successfully uploaded derivatives.
        """
        img = self._open_image(image_bytes)
        if img is None:
            logger.warning(
                "Could not open image for derivative generation; skipping",
                extra={"s3_key": base_s3_key},
            )
            return []

        original_width, original_height = img.size
        base_without_ext = posixpath.splitext(base_s3_key)[0]

        uploaded_keys: list[str] = []
        for width in sorted(widths):
            if width >= original_width:
                continue
            try:
                key = self._upload_derivative_width(
                    base_without_ext, img, width, original_height, base_s3_key
                )
                if key:
                    uploaded_keys.append(key)
            except Exception as exc:
                logger.warning(
                    "WebP derivative generation failed for width; skipping",
                    extra={"s3_key": base_s3_key, "width": width, "error": str(exc)},
                )
        return uploaded_keys

    def get_derivative_presigned_urls(
        self,
        base_s3_key: str,
        expiry_seconds: Optional[int] = None,
    ) -> dict[int, str]:
        """Return presigned URLs for each available WebP derivative of base_s3_key.

        Keys are the pixel-width integers (e.g. {400: url, 800: url, 1600: url}).
        A width entry is omitted when the derivative key does not exist in S3
        (no-op — presigning never checks existence, but callers should treat a
        missing URL as "derivative not yet generated").

        In practice we always presign all DERIVATIVE_WIDTHS and let the frontend
        gracefully fall back to the original when a URL resolves to 404.  This
        keeps the helper simple and avoids a HEAD-per-width round-trip at read time.
        PERF-11 (backfill) will create the missing objects so 404s will heal.

        Args:
            base_s3_key:    S3 key of the original image.
            expiry_seconds: Presign expiry; defaults to IMAGE_PRESIGN_EXPIRY_SECONDS.

        Returns:
            dict mapping width (int) to presigned URL (str); empty if S3 not configured.
        """
        expiry = expiry_seconds or IMAGE_PRESIGN_EXPIRY_SECONDS
        base_without_ext = posixpath.splitext(base_s3_key)[0]
        result: dict[int, str] = {}
        for width in DERIVATIVE_WIDTHS:
            derivative_key = f"{base_without_ext}_{width}w.webp"
            url = self.generate_presigned_url(derivative_key, expiry_seconds=expiry)
            if url:
                result[width] = url
        return result


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


def maybe_generate_derivatives(
    base_s3_key: str,
    image_bytes: bytes,
    content_type: str,
) -> None:
    """Fire-and-forget derivative generation for an image upload.

    Calls ``S3Service.generate_image_derivatives`` only when the content type is
    a recognised image format.  Any failure is logged inside the helper and does
    NOT propagate — so callers can invoke this after ``upload_object`` without
    wrapping in try/except.

    Args:
        base_s3_key:   S3 key the original bytes were uploaded to.
        image_bytes:   The same bytes that were uploaded.
        content_type:  MIME type of the upload.
    """
    if content_type not in _IMAGE_CONTENT_TYPES:
        return
    svc = get_s3_service()
    svc.generate_image_derivatives(base_s3_key, image_bytes)
