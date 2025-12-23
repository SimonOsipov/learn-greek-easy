"""S3 Service for managing pre-signed URLs for culture question images.

This service provides:
- Pre-signed URL generation for GET operations
- Graceful handling of missing/invalid images
- Configurable URL expiry (default 1 hour)

The service is designed to fail gracefully - if S3 is unavailable or
an image doesn't exist, it returns None rather than raising exceptions.
This allows questions to remain usable without images.

"""

import logging
from typing import TYPE_CHECKING, Optional

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from src.config import settings

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client

logger = logging.getLogger(__name__)


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
                "S3 not configured - AWS credentials or bucket name missing",
                extra={
                    "has_access_key": bool(settings.aws_access_key_id),
                    "has_secret_key": bool(settings.aws_secret_access_key),
                    "has_bucket": bool(settings.aws_s3_bucket_name),
                },
            )
            return None

        try:
            config = Config(
                signature_version="s3v4",
                retries={"max_attempts": 3, "mode": "standard"},
            )
            self._client = boto3.client(
                "s3",
                aws_access_key_id=settings.aws_access_key_id,
                aws_secret_access_key=settings.aws_secret_access_key,
                region_name=settings.aws_s3_region,
                config=config,
            )
            logger.info(
                "S3 client initialized",
                extra={
                    "region": settings.aws_s3_region,
                    "bucket": settings.aws_s3_bucket_name,
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
            url: str = client.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": settings.aws_s3_bucket_name,
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
            client.head_object(
                Bucket=settings.aws_s3_bucket_name,
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
