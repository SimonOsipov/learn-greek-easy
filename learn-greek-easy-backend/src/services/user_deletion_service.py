"""User Account Deletion Service for Danger Zone operations.

Provides complete account deletion including:
- All user progress data
- User database record
- Supabase identity (if configured)

IMPORTANT: This service orchestrates deletion across multiple systems.
Supabase deletion failures do NOT rollback local deletion per PRD decision.
"""

from dataclasses import dataclass
from typing import Optional
from uuid import UUID

import sentry_sdk
import stripe
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.cache import get_cache
from src.core.exceptions import SupabaseAdminError
from src.core.logging import get_logger
from src.core.stripe import get_stripe_client, is_stripe_configured
from src.core.supabase_admin import get_supabase_admin_client
from src.db.models import SubscriptionStatus
from src.repositories import UserRepository
from src.services.user_progress_reset_service import UserProgressResetService

logger = get_logger(__name__)


@dataclass
class DeletionResult:
    """Result of account deletion operation.

    Attributes:
        success: True if the core deletion (local DB) succeeded
        progress_deleted: True if all progress data was deleted
        user_deleted: True if user record was deleted from database
        supabase_deleted: True if Supabase user was deleted, None if admin not configured
        error_message: Human-readable error message for partial failures
    """

    success: bool
    progress_deleted: bool
    user_deleted: bool
    supabase_deleted: Optional[bool]
    error_message: Optional[str] = None


class UserDeletionService:
    """Service for complete account deletion.

    Orchestrates the deletion of:
    1. All progress data (via UserProgressResetService, includes cache clearing)
    2. User database record
    3. Supabase identity (if admin configured)

    Important notes:
    - Commits the transaction internally once local deletion succeeds,
      before any external Supabase call - callers must NOT commit again
    - Supabase failures are logged but do not fail the operation
    - Local deletion proceeds even if Supabase deletion fails (per PRD)

    Usage:
        async with async_session() as db:
            service = UserDeletionService(db)
            result = await service.delete_account(user_id, supabase_id)
            # db.commit() already called internally by delete_account()
    """

    def __init__(self, db: AsyncSession):
        """Initialize the service with database session.

        Args:
            db: Async database session for persistence operations
        """
        self.db = db
        self.reset_service = UserProgressResetService(db)
        self.user_repository = UserRepository(db)

    async def _cancel_stripe_subscription_before_deletion(
        self,
        stripe_subscription_id: Optional[str],
        stripe_customer_id: Optional[str],
        subscription_status: SubscriptionStatus,
    ) -> None:
        """Cancel the user's Stripe subscription immediately, before any
        local mutation runs. [sequence-order]

        The guard is pointer-driven, not a status allowlist: a
        stripe_subscription_id present at all (even on a TRIALING row)
        means Stripe still has something to cancel. App-managed trials
        never get a stripe_subscription_id (src/core/dependencies.py
        :217-226), which is what makes this sufficient. [stripe-guard]

        Raises:
            stripe.StripeError: any StripeError other than
                InvalidRequestError propagates so the caller's outer
                handler fails closed - nothing local has been mutated yet,
                so there is nothing to roll back. [idempotency]
        """
        if (
            stripe_subscription_id is None
            or subscription_status == SubscriptionStatus.CANCELED
            or not is_stripe_configured()
        ):
            return

        client = get_stripe_client()
        try:
            # [no-refund-params]: bare call, no params - prorate/invoice_now
            # both default False in the installed SDK, so this is an
            # immediate cancel with no refund.
            await client.v1.subscriptions.cancel_async(stripe_subscription_id)
        except stripe.InvalidRequestError as e:
            # [idempotency]: non-blocking - covers the missed-webhook case
            # where our DB says active but Stripe already canceled the
            # subscription. Blocking here would permanently lock the user
            # out of deleting their account.
            logger.warning(
                "Stripe subscription already canceled or invalid, proceeding with deletion",
                stripe_subscription_id=stripe_subscription_id,
                stripe_customer_id=stripe_customer_id,
                error=str(e),
            )
        except stripe.StripeError as e:
            # [idempotency]: fail closed - re-raise so the caller's outer
            # handler flips success=False, the route 500s, and get_db rolls
            # back. Since this cancel precedes every mutation and the
            # commit, the rollback has nothing to undo. [log-style-kwargs]:
            # kwargs, not extra={...}, so sub_*/cus_* land flat at
            # record["extra"] top level - they're pseudonymous ids, not
            # PII, and are what lets an operator recover manually.
            logger.error(
                "Failed to cancel Stripe subscription during account deletion",
                stripe_subscription_id=stripe_subscription_id,
                stripe_customer_id=stripe_customer_id,
                error=str(e),
            )
            raise

    async def delete_account(
        self, user_id: UUID, supabase_id: Optional[str] = None
    ) -> DeletionResult:
        """Delete user account completely.

        Order of operations (per PRD):
        1. Fetch the user row and capture ids needed downstream (Supabase
           identity and Stripe ids here, avatar_url in PAY-05-03) before
           anything is destroyed
        2. Cancel the Stripe subscription immediately (if one exists and
           isn't already canceled) - before any local mutation, so a
           failure here leaves nothing to roll back
        3. Delete all progress data via UserProgressResetService (includes cache)
        4. Delete user record from database
        5. Commit the transaction - local destruction is now durable
        6. Delete user from Supabase (if supabase_id provided and admin
           configured) - post-commit and non-fatal

        Note: Supabase deletion failure does NOT rollback local deletion.
        The user is considered deleted locally; orphaned Supabase identity
        is logged to Sentry for manual cleanup.

        Args:
            user_id: UUID of the user to delete
            supabase_id: Optional Supabase user UUID

        Returns:
            DeletionResult indicating success/failure of each step
        """
        result = DeletionResult(
            success=False,
            progress_deleted=False,
            user_deleted=False,
            supabase_deleted=None,  # None = admin not configured or no supabase_id
        )

        try:
            logger.info(
                "Starting account deletion",
                extra={"user_id": str(user_id), "has_supabase_id": supabase_id is not None},
            )

            # Step 1: Fetch the user row first, before any destructive step,
            # so ids still needed downstream (Supabase identity and Stripe
            # ids here, avatar_url in PAY-05-03) are captured while the row
            # still exists. [sequence-order]
            user = await self.user_repository.get(user_id)
            if user is None:
                # User already deleted - this is an edge case but not an
                # error. Nothing to destroy, but progress data may still be
                # orphaned, so the reset still runs before returning.
                logger.warning(
                    "User not found during deletion (may already be deleted)",
                    extra={"user_id": str(user_id)},
                )
                await self.reset_service.reset_all_progress(user_id)
                result.progress_deleted = True
                result.user_deleted = True
                result.success = True
                return result

            avatar_url = user.avatar_url

            # Step 2: Cancel the Stripe subscription immediately, before any
            # local mutation, so a failure here leaves nothing to roll back.
            # [sequence-order]
            await self._cancel_stripe_subscription_before_deletion(
                user.stripe_subscription_id,
                user.stripe_customer_id,
                user.subscription_status,
            )

            # Step 3: Delete all progress data (reuses reset service)
            # This also clears Redis cache for the user
            await self.reset_service.reset_all_progress(user_id)
            result.progress_deleted = True
            logger.debug(
                "Progress data deleted",
                extra={"user_id": str(user_id)},
            )

            # Step 4: Delete user from database
            await self.user_repository.delete(user)
            result.user_deleted = True
            logger.info(
                "User record deleted from database",
                extra={"user_id": str(user_id), "has_avatar_url": avatar_url is not None},
            )

            # Step 5: commit local destruction before any external side
            # effect. The Supabase delete below cannot run before this
            # commit lands. [commit-ownership]
            await self.db.commit()

            # PERF-16-02: bust the identity cache for the deleted user. Without
            # this, a stale identity projection could let get_or_create_user's
            # cache-hit path re-provision a new user row for the same
            # supabase_id before the (now 900s) TTL expires.
            #
            # Post-commit, non-fatal per [post-commit-nonfatal]: local
            # deletion is already durable by this point, so a cache failure
            # (e.g. Redis down) must be logged and swallowed here rather than
            # falling through to the outer except and flipping
            # result.success to False for an already-committed delete.
            try:
                await get_cache().invalidate_user_identity(supabase_id, user_id)
            except Exception as e:
                # [log-migration-carveout]: kwargs (not extra={...}) so
                # user_id lands flat at record["extra"] top level per
                # docs/conventions.md's kwargs-logging convention.
                logger.warning(
                    "Cache invalidation failed after local deletion",
                    user_id=str(user_id),
                    error=str(e),
                )
                sentry_sdk.capture_exception(e)

            # Step 6: Delete from Supabase (if applicable) - post-commit,
            # non-fatal: local deletion is already durable by this point.
            # [post-commit-nonfatal]
            if supabase_id:
                supabase_client = get_supabase_admin_client()
                if supabase_client is None:
                    logger.warning(
                        "Supabase admin not configured, skipping Supabase deletion",
                        extra={
                            "user_id": str(user_id),
                            "supabase_id_prefix": supabase_id[:8],
                        },
                    )
                    # Leave supabase_deleted as None to indicate admin not configured
                else:
                    try:
                        await supabase_client.delete_user(supabase_id)
                        result.supabase_deleted = True
                        logger.info(
                            "Supabase user deleted successfully",
                            extra={
                                "user_id": str(user_id),
                                "supabase_id_prefix": supabase_id[:8],
                            },
                        )
                    except SupabaseAdminError as e:
                        # Log but don't fail - per PRD decision. Local
                        # deletion has already committed above.
                        result.supabase_deleted = False
                        result.error_message = (
                            "Account deleted locally but Supabase deletion failed. "
                            "Please contact support if you experience login issues."
                        )
                        # [log-migration-carveout]: kwargs (not extra={...})
                        # so supabase_id_prefix lands flat at record["extra"]
                        # top level per docs/conventions.md's kwargs-logging
                        # convention. Only this call site is migrated here.
                        logger.error(
                            "Supabase deletion failed after local deletion",
                            user_id=str(user_id),
                            supabase_id_prefix=supabase_id[:8],
                            error=str(e),
                        )
                        sentry_sdk.capture_exception(e)
            else:
                # No supabase_id - nothing to delete from Supabase
                logger.debug(
                    "No Supabase ID provided, skipping Supabase deletion",
                    extra={"user_id": str(user_id)},
                )

            result.success = True
            logger.info(
                "Account deletion completed successfully",
                extra={
                    "user_id": str(user_id),
                    "progress_deleted": result.progress_deleted,
                    "user_deleted": result.user_deleted,
                    "supabase_deleted": result.supabase_deleted,
                },
            )
            return result

        except Exception as e:
            logger.error(
                "Account deletion failed",
                extra={
                    "user_id": str(user_id),
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "progress_deleted": result.progress_deleted,
                    "user_deleted": result.user_deleted,
                },
            )
            sentry_sdk.capture_exception(e)
            result.error_message = "Failed to delete account. Please try again."
            return result


__all__ = ["UserDeletionService", "DeletionResult"]
