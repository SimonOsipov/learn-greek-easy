#!/usr/bin/env python
"""CLI script for migrating existing users to Auth0.

This script migrates users from the local database to Auth0 using the
Management API. Users are created WITHOUT passwords - they must use the
"forgot password" flow on first login.

Usage:
    # Dry run (show what would be done)
    poetry run python scripts/migrate_users_to_auth0.py --dry-run

    # Full migration
    poetry run python scripts/migrate_users_to_auth0.py

    # With custom batch size and verbose logging
    poetry run python scripts/migrate_users_to_auth0.py --batch-size 50 --verbose

Requirements:
    - AUTH0_DOMAIN must be set
    - AUTH0_M2M_CLIENT_ID must be set (M2M application)
    - AUTH0_M2M_CLIENT_SECRET must be set (M2M application)
    - M2M app must have Management API permissions:
        - read:users
        - create:users
        - update:users

Exit codes:
    0 - Success
    1 - Failure (configuration error or migration failed)
"""

import argparse
import asyncio
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
from uuid import UUID

import httpx

# Add parent directory to path for imports
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from src.config import settings  # noqa: E402
from src.core.logging import get_logger, setup_logging  # noqa: E402

# Setup logging using the application's logging configuration
setup_logging()
logger = get_logger(__name__)


# ============================================================================
# Data Classes
# ============================================================================


@dataclass
class MigrationResult:
    """Result of migrating a single user."""

    user_id: UUID
    email: str
    success: bool
    auth0_id: Optional[str] = None
    action: str = ""  # "created", "linked", "skipped", "failed"
    error: Optional[str] = None


@dataclass
class MigrationSummary:
    """Summary of the entire migration."""

    total_users: int = 0
    migrated: int = 0
    linked: int = 0
    skipped: int = 0
    failed: int = 0
    errors: list[str] = field(default_factory=list)
    results: list[MigrationResult] = field(default_factory=list)


# ============================================================================
# Auth0 Management Client
# ============================================================================


class Auth0ManagementClient:
    """Client for Auth0 Management API operations."""

    def __init__(
        self,
        domain: str,
        client_id: str,
        client_secret: str,
        verbose: bool = False,
    ):
        """Initialize the Auth0 Management API client.

        Args:
            domain: Auth0 tenant domain (e.g., your-tenant.us.auth0.com)
            client_id: M2M application client ID
            client_secret: M2M application client secret
            verbose: Enable verbose logging
        """
        self.domain = domain
        self.client_id = client_id
        self.client_secret = client_secret
        self.verbose = verbose
        self._access_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None
        self._client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self) -> "Auth0ManagementClient":
        """Async context manager entry."""
        self._client = httpx.AsyncClient(timeout=30.0)
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Async context manager exit."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def get_management_token(self) -> str:
        """Get an access token for the Management API using client credentials.

        Returns:
            Access token string

        Raises:
            httpx.HTTPStatusError: If token request fails
        """
        # Check if we have a valid cached token
        if (
            self._access_token
            and self._token_expires_at
            and datetime.utcnow() < self._token_expires_at
        ):
            return self._access_token

        if not self._client:
            raise RuntimeError("Client not initialized. Use async context manager.")

        token_url = f"https://{self.domain}/oauth/token"
        payload = {
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "audience": f"https://{self.domain}/api/v2/",
        }

        if self.verbose:
            logger.debug(f"Requesting Management API token from {token_url}")

        response = await self._client.post(token_url, json=payload)
        response.raise_for_status()

        data = response.json()
        self._access_token = data["access_token"]

        # Cache token with a small buffer before expiry
        expires_in = data.get("expires_in", 86400)
        from datetime import timedelta

        self._token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in - 60)

        if self.verbose:
            logger.debug(f"Obtained Management API token, expires in {expires_in}s")

        return self._access_token

    async def get_user_by_email(self, email: str) -> Optional[dict[str, Any]]:
        """Search for a user in Auth0 by email.

        Args:
            email: User's email address

        Returns:
            User dict if found, None otherwise
        """
        if not self._client:
            raise RuntimeError("Client not initialized. Use async context manager.")

        token = await self.get_management_token()
        headers = {"Authorization": f"Bearer {token}"}

        # URL encode the email for the query
        import urllib.parse

        encoded_email = urllib.parse.quote(email)
        search_url = f"https://{self.domain}/api/v2/users-by-email?email={encoded_email}"

        if self.verbose:
            logger.debug(f"Searching for user by email: {email}")

        response = await self._client.get(search_url, headers=headers)
        response.raise_for_status()

        users = response.json()
        if users:
            # Return the first matching user
            return users[0]

        return None

    async def create_user(
        self,
        email: str,
        full_name: Optional[str] = None,
        email_verified: bool = True,
    ) -> dict[str, Any]:
        """Create a user in Auth0 without a password.

        Users created without passwords must use the "forgot password" flow
        to set their password on first login.

        Args:
            email: User's email address
            full_name: User's full name (optional)
            email_verified: Whether to mark email as verified

        Returns:
            Created user dict from Auth0

        Raises:
            httpx.HTTPStatusError: If user creation fails
        """
        if not self._client:
            raise RuntimeError("Client not initialized. Use async context manager.")

        token = await self.get_management_token()
        headers = {"Authorization": f"Bearer {token}"}

        create_url = f"https://{self.domain}/api/v2/users"
        payload: dict[str, Any] = {
            "connection": "Username-Password-Authentication",
            "email": email,
            "email_verified": email_verified,
        }

        if full_name:
            payload["name"] = full_name

        if self.verbose:
            logger.debug(f"Creating user in Auth0: {email}")

        response = await self._client.post(create_url, json=payload, headers=headers)
        response.raise_for_status()

        return response.json()


# ============================================================================
# Migration Logic
# ============================================================================


async def migrate_users(
    dry_run: bool = False,
    batch_size: int = 100,
    verbose: bool = False,
) -> MigrationSummary:
    """Migrate users from PostgreSQL to Auth0.

    This function:
    1. Queries all users where auth0_id IS NULL
    2. For each user:
       - Checks if user exists in Auth0 by email
       - If exists: links the auth0_id to local user
       - If not: creates user in Auth0, then links
    3. Returns a summary of the migration

    Args:
        dry_run: If True, only show what would be done
        batch_size: Number of users to process in each batch
        verbose: Enable verbose logging

    Returns:
        MigrationSummary with results
    """
    summary = MigrationSummary()

    # Import database modules
    from sqlalchemy import select

    from src.db import close_db, get_session_factory, init_db  # noqa: E402
    from src.db.models import User  # noqa: E402

    logger.info("Initializing database connection...")
    await init_db()

    try:
        session_factory = get_session_factory()

        # Count total users to migrate
        async with session_factory() as db:
            count_query = select(User).where(User.auth0_id.is_(None))
            db_result = await db.execute(count_query)
            users_to_migrate = db_result.scalars().all()
            summary.total_users = len(users_to_migrate)

        logger.info(f"Found {summary.total_users} users to migrate")

        if summary.total_users == 0:
            logger.info("No users to migrate. All users already have auth0_id.")
            return summary

        if dry_run:
            logger.info("")
            logger.info("DRY RUN MODE - No changes will be made")
            logger.info("")
            logger.info("Would migrate the following users:")
            for user in users_to_migrate[:20]:  # Show first 20
                logger.info(f"  - {user.email} (ID: {user.id})")
            if len(users_to_migrate) > 20:
                logger.info(f"  ... and {len(users_to_migrate) - 20} more")
            logger.info("")
            logger.info("Each user would be:")
            logger.info("  1. Checked if exists in Auth0 by email")
            logger.info("  2. If exists: linked to local user")
            logger.info("  3. If not: created in Auth0 (without password), then linked")
            logger.info("")
            logger.info("Users must use 'Forgot Password' on first login after migration.")
            return summary

        # Initialize Auth0 client
        async with Auth0ManagementClient(
            domain=settings.auth0_domain,  # type: ignore
            client_id=settings.auth0_m2m_client_id,  # type: ignore
            client_secret=settings.auth0_m2m_client_secret,  # type: ignore
            verbose=verbose,
        ) as auth0_client:
            # Process users in batches
            for i in range(0, len(users_to_migrate), batch_size):
                batch = users_to_migrate[i : i + batch_size]
                batch_num = (i // batch_size) + 1
                total_batches = (len(users_to_migrate) + batch_size - 1) // batch_size

                logger.info(f"Processing batch {batch_num}/{total_batches} ({len(batch)} users)")

                async with session_factory() as db:
                    for user in batch:
                        migration_result = await _migrate_single_user(
                            db=db,
                            auth0_client=auth0_client,
                            user=user,
                            verbose=verbose,
                        )
                        summary.results.append(migration_result)

                        if migration_result.success:
                            if migration_result.action == "created":
                                summary.migrated += 1
                            elif migration_result.action == "linked":
                                summary.linked += 1
                            elif migration_result.action == "skipped":
                                summary.skipped += 1
                        else:
                            summary.failed += 1
                            if migration_result.error:
                                summary.errors.append(f"{user.email}: {migration_result.error}")

                    # Commit batch
                    await db.commit()

                logger.info(
                    f"Batch {batch_num} complete: "
                    f"migrated={summary.migrated}, linked={summary.linked}, "
                    f"skipped={summary.skipped}, failed={summary.failed}"
                )

    finally:
        await close_db()

    return summary


async def _migrate_single_user(
    db: Any,
    auth0_client: Auth0ManagementClient,
    user: Any,
    verbose: bool = False,
) -> MigrationResult:
    """Migrate a single user to Auth0.

    Args:
        db: Database session
        auth0_client: Auth0 Management API client
        user: User model instance
        verbose: Enable verbose logging

    Returns:
        MigrationResult with outcome
    """
    result = MigrationResult(
        user_id=user.id,
        email=user.email,
        success=False,
    )

    try:
        # Check if user already exists in Auth0
        auth0_user = await auth0_client.get_user_by_email(user.email)

        if auth0_user:
            # User exists in Auth0 - link the ID
            auth0_id = auth0_user["user_id"]
            user.auth0_id = auth0_id
            db.add(user)
            await db.flush()

            result.success = True
            result.auth0_id = auth0_id
            result.action = "linked"

            if verbose:
                logger.info(f"Linked existing Auth0 user: {user.email} -> {auth0_id}")
        else:
            # Create user in Auth0 (without password)
            email_verified = user.email_verified_at is not None
            auth0_user = await auth0_client.create_user(
                email=user.email,
                full_name=user.full_name,
                email_verified=email_verified,
            )

            auth0_id = auth0_user["user_id"]
            user.auth0_id = auth0_id
            db.add(user)
            await db.flush()

            result.success = True
            result.auth0_id = auth0_id
            result.action = "created"

            if verbose:
                logger.info(f"Created Auth0 user: {user.email} -> {auth0_id}")

    except httpx.HTTPStatusError as e:
        error_detail = e.response.text if e.response else str(e)
        result.error = f"HTTP {e.response.status_code}: {error_detail}"
        logger.error(f"Failed to migrate {user.email}: {result.error}")

    except Exception as e:
        result.error = str(e)
        logger.error(f"Failed to migrate {user.email}: {result.error}")

    return result


# ============================================================================
# Main Entry Point
# ============================================================================


def _log_summary(summary: MigrationSummary, duration: float) -> None:
    """Log migration summary."""
    logger.info("")
    logger.info("=" * 60)
    logger.info("Migration Summary")
    logger.info("=" * 60)
    logger.info(f"Duration: {duration:.2f}s")
    logger.info(f"Total users: {summary.total_users}")
    logger.info(f"Migrated (new in Auth0): {summary.migrated}")
    logger.info(f"Linked (existing in Auth0): {summary.linked}")
    logger.info(f"Skipped: {summary.skipped}")
    logger.info(f"Failed: {summary.failed}")

    if summary.errors:
        logger.info("")
        logger.info("Errors:")
        for error in summary.errors[:10]:  # Show first 10 errors
            logger.info(f"  - {error}")
        if len(summary.errors) > 10:
            logger.info(f"  ... and {len(summary.errors) - 10} more errors")

    logger.info("")
    if summary.migrated > 0:
        logger.info("IMPORTANT: Migrated users must use 'Forgot Password' on first login.")


async def main(dry_run: bool = False, batch_size: int = 100, verbose: bool = False) -> int:
    """Execute migration.

    Args:
        dry_run: If True, only show what would be done
        batch_size: Number of users per batch
        verbose: Enable verbose logging

    Returns:
        0 on success, 1 on failure
    """
    logger.info("=" * 60)
    logger.info("Auth0 User Migration Script")
    logger.info("=" * 60)

    # Check configuration
    if not settings.auth0_m2m_configured:
        logger.error("Auth0 M2M is not configured. Please set:")
        logger.error("  - AUTH0_DOMAIN")
        logger.error("  - AUTH0_M2M_CLIENT_ID")
        logger.error("  - AUTH0_M2M_CLIENT_SECRET")
        return 1

    logger.info(f"Auth0 Domain: {settings.auth0_domain}")
    logger.info(f"Dry Run: {dry_run}")
    logger.info(f"Batch Size: {batch_size}")
    logger.info(f"Verbose: {verbose}")

    start_time = datetime.now()

    try:
        summary = await migrate_users(
            dry_run=dry_run,
            batch_size=batch_size,
            verbose=verbose,
        )

        duration = (datetime.now() - start_time).total_seconds()

        if not dry_run:
            _log_summary(summary, duration)

        if summary.failed > 0:
            logger.warning(f"Migration completed with {summary.failed} failures")
            return 1

        logger.info("Migration completed successfully!")
        return 0

    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        return 1


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Migrate existing users to Auth0.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Dry run (show what would be done)
    poetry run python scripts/migrate_users_to_auth0.py --dry-run

    # Full migration
    poetry run python scripts/migrate_users_to_auth0.py

    # With custom batch size
    poetry run python scripts/migrate_users_to_auth0.py --batch-size 50

    # Verbose output
    poetry run python scripts/migrate_users_to_auth0.py --verbose

Environment Variables:
    AUTH0_DOMAIN              Auth0 tenant domain
    AUTH0_M2M_CLIENT_ID       M2M application client ID
    AUTH0_M2M_CLIENT_SECRET   M2M application client secret

Notes:
    - Users are created WITHOUT passwords
    - Users must use 'Forgot Password' flow on first login
    - Script is idempotent (safe to re-run)
        """,
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes",
    )

    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Number of users to process in each batch (default: 100)",
    )

    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )

    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    exit_code = asyncio.run(
        main(
            dry_run=args.dry_run,
            batch_size=args.batch_size,
            verbose=args.verbose,
        )
    )
    sys.exit(exit_code)
