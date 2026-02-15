"""Supabase Admin API client for user management operations.

This module provides functionality for interacting with the Supabase Admin API,
primarily for user deletion during account deletion flows.

Usage:
    from src.core.supabase_admin import get_supabase_admin_client

    client = get_supabase_admin_client()
    if client:
        await client.delete_user("d0714948-xxxx-xxxx-xxxx-xxxxxxxxxxxx")
"""

import httpx

from src.config import settings
from src.core.exceptions import SupabaseAdminError
from src.core.logging import get_logger

logger = get_logger(__name__)


class SupabaseAdminClient:
    """Client for Supabase Admin API operations.

    Uses the service role key for authentication (static key, no token exchange).

    Attributes:
        supabase_url: Supabase project URL
        service_role_key: Service role key for admin operations
    """

    def __init__(self, supabase_url: str, service_role_key: str) -> None:
        self.supabase_url = supabase_url.rstrip("/")
        self.service_role_key = service_role_key

    async def delete_user(self, supabase_id: str) -> bool:
        """Delete a user from Supabase Auth.

        Idempotent: if the user does not exist (404), treat as success.

        Args:
            supabase_id: The Supabase user UUID

        Returns:
            True if deleted successfully or user didn't exist

        Raises:
            SupabaseAdminError: If deletion fails
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.delete(
                    f"{self.supabase_url}/auth/v1/admin/users/{supabase_id}",
                    headers={
                        "Authorization": f"Bearer {self.service_role_key}",
                        "apikey": self.service_role_key,
                    },
                )

                if response.status_code == 200:
                    logger.info(
                        "Supabase user deleted successfully",
                        extra={"supabase_id_prefix": supabase_id[:8]},
                    )
                    return True

                if response.status_code == 404:
                    logger.info(
                        "Supabase user not found (already deleted)",
                        extra={"supabase_id_prefix": supabase_id[:8]},
                    )
                    return True

                logger.error(
                    "Supabase user deletion failed",
                    extra={
                        "status_code": response.status_code,
                        "supabase_id_prefix": supabase_id[:8],
                    },
                )
                raise SupabaseAdminError(
                    detail=f"Failed to delete user from Supabase: {response.status_code}"
                )

        except SupabaseAdminError:
            raise

        except httpx.TimeoutException as e:
            logger.error(
                "Timeout deleting Supabase user",
                extra={"error": str(e), "supabase_id_prefix": supabase_id[:8]},
            )
            raise SupabaseAdminError(detail="Failed to delete user from Supabase: timeout")

        except Exception as e:
            logger.error(
                "Unexpected error deleting Supabase user",
                extra={
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "supabase_id_prefix": supabase_id[:8],
                },
            )
            raise SupabaseAdminError(detail="Failed to delete user from Supabase")


def get_supabase_admin_client() -> SupabaseAdminClient | None:
    """Get Supabase Admin client if configured.

    Returns:
        SupabaseAdminClient if supabase_url and supabase_service_role_key are set,
        None otherwise.
    """
    if not settings.supabase_admin_configured:
        logger.debug("Supabase admin not configured, returning None")
        return None

    assert settings.supabase_url is not None
    assert settings.supabase_service_role_key is not None

    return SupabaseAdminClient(
        supabase_url=settings.supabase_url,
        service_role_key=settings.supabase_service_role_key,
    )
