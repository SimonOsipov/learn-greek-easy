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

"""

from typing import TYPE_CHECKING, Optional

import boto3
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


class S3Service:
    """Service for S3 operations related to culture question images."""

    def __init__(self) -> None:
        """Initialize S3 service with AWS credentials from settings."""
        self._client: Optional["S3Client"] = None
        self._initialized = False

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

        client = self._get_client()
        if not client:
            return None

        expiry = expiry_seconds or settings.s3_presigned_url_expiry

        try:
            bucket_name = settings.effective_s3_bucket_name
            assert bucket_name is not None  # Guaranteed by _get_client() check
            url: str = client.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": bucket_name,
                    "Key": image_key,
                },
                ExpiresIn=expiry,
            )
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
