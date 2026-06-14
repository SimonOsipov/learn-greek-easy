"""One-shot bucket-wide Cache-Control backfill script.

Iterates every object in the configured S3 bucket and rewrites its metadata
so that the Cache-Control header matches the value that ``upload_object``
would assign today (via CONTENT_TYPE_TO_CACHE_CONTROL / _DEFAULT_CACHE_CONTROL
from src.services.s3_service).

Objects that pre-date the Cache-Control changes (SCACHE-03/04/05) were
uploaded without a Cache-Control directive and therefore receive no browser
caching.  This script back-fills them by fetching the object body and
re-uploading via ``service.upload_object`` (which calls ``put_object`` with the
correct CacheControl).  A same-bucket ``copy_object(MetadataDirective=REPLACE)``
is NOT used because Tigris silently drops the CacheControl directive on
self-referential copies, reverting the header to ``no-cache``.

Usage:
    # Dry-run first — no writes, logs what would change
    railway run python -m src.scripts.backfill_s3_cache_control --dry-run

    # Live run — rewrites every object's Cache-Control
    railway run python -m src.scripts.backfill_s3_cache_control

Run MANUALLY from within the Railway environment after deployment.
NOT wired into the automated deploy pipeline / no GHA / no Dockerfile CMD.

Notes:
    - Idempotent: re-running re-applies the same metadata (safe).
    - Per-object error isolation: one bad key is logged and counted but does
      not abort the whole run (intentional deviation from load_translations_kaikki
      which calls sys.exit on first error — aborting mid-backfill on a bucket
      with thousands of objects would leave the job in a partial state that is
      hard to resume).
    - Verify-after-write: after each rewrite a ranged GET (bytes=0-0) is issued
      to confirm the stored CacheControl matches the intended directive.  Any
      mismatch is logged as a WARNING and counted as ``unverified``.  A non-zero
      ``unverified`` count causes a non-zero exit alongside ``errors``.
"""

import argparse
import sys
from typing import Any

from botocore.exceptions import BotoCoreError, ClientError
from loguru import logger

from src.config import settings
from src.services.s3_service import (
    _DEFAULT_CACHE_CONTROL,
    CONTENT_TYPE_TO_CACHE_CONTROL,
    S3Service,
    get_s3_service,
)


def _rewrite_and_verify(
    service: S3Service, client: Any, bucket: str, key: str, content_type: str
) -> bool:
    """Fetch, re-upload, then verify Cache-Control for one object.

    Returns True when the post-write verify GET confirms the intended directive,
    False when there is a mismatch (caller should increment ``unverified``).

    Uses ``service.upload_object`` (put_object) rather than copy_object because
    Tigris drops the CacheControl directive on self-referential copies.
    """
    intended = CONTENT_TYPE_TO_CACHE_CONTROL.get(content_type, _DEFAULT_CACHE_CONTROL)

    # Fetch body, re-upload with correct Cache-Control via put_object.
    obj_response = client.get_object(Bucket=bucket, Key=key)
    body = obj_response["Body"].read()
    upload_ok = service.upload_object(key, body, content_type)
    if not upload_ok:
        logger.warning(
            f"upload_object returned False for {key!r} — PUT failed, treating as unverified"
        )
        return False
    logger.info(f"Rewrote {key!r}: content_type={content_type!r} CacheControl={intended!r}")

    # Verify-after-write: ranged GET (bytes=0-0) is used instead of HEAD because
    # Tigris presigned GET returns 403 for HEAD requests.
    verify_resp = client.get_object(Bucket=bucket, Key=key, Range="bytes=0-0")
    actual = verify_resp.get("CacheControl")
    if actual != intended:
        logger.warning(f"Verify failed for {key!r}: expected={intended!r} actual={actual!r}")
        return False
    return True


def _process_object(
    service: S3Service, client: Any, bucket: str, key: str, dry_run: bool
) -> tuple[int, int, int]:
    """Process a single S3 object; return (rewritten, skipped, unverified) delta tuple.

    Raises BotoCoreError / ClientError so the caller can catch and count errors.
    """
    head = client.head_object(Bucket=bucket, Key=key)
    content_type = head.get("ContentType", "")

    if not content_type:
        # Skipping is safer than forcing application/octet-stream onto the
        # object — the missing content-type is itself a data quality issue.
        logger.warning(f"Skipping {key!r} — ContentType missing in HEAD response")
        return 0, 1, 0

    intended_cache_control = CONTENT_TYPE_TO_CACHE_CONTROL.get(content_type, _DEFAULT_CACHE_CONTROL)

    if dry_run:
        logger.info(
            f"[DRY RUN] {key!r}: content_type={content_type!r}"
            f" → CacheControl={intended_cache_control!r}"
        )
        return 1, 0, 0

    verified = _rewrite_and_verify(service, client, bucket, key, content_type)
    unverified_delta = 0 if verified else 1
    return 1, 0, unverified_delta


def backfill(dry_run: bool) -> None:
    """Scan every object in the bucket and rewrite Cache-Control metadata.

    Args:
        dry_run: When True, log planned changes without writing to S3 or
                 issuing verify GETs.
    """
    service = get_s3_service()
    client = service._get_client()
    if client is None:
        logger.error("S3 not configured — aborting")
        sys.exit(1)

    bucket = settings.effective_s3_bucket_name
    if not bucket:
        logger.error("S3 bucket name not configured — aborting")
        sys.exit(1)

    mode_label = "DRY RUN" if dry_run else "LIVE"
    logger.info(f"Starting Cache-Control backfill [{mode_label}] on bucket: {bucket}")

    scanned = 0
    rewritten = 0
    skipped = 0
    errors = 0
    unverified = 0

    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket):
        for obj in page.get("Contents", []):  # guard: empty pages have no Contents key
            key = obj["Key"]
            scanned += 1

            try:
                rw, sk, uv = _process_object(service, client, bucket, key, dry_run)
                rewritten += rw
                skipped += sk
                unverified += uv
            # Per-object isolation: one bad key must not abort a bucket-wide backfill.
            # This is an intentional deviation from load_translations_kaikki which
            # calls sys.exit on first error — a mid-run abort here is worse than
            # partial completion because there is no resume mechanism.
            except (BotoCoreError, ClientError) as exc:
                logger.warning(f"Error processing {key!r}: {exc}")
                errors += 1

    action = "would rewrite" if dry_run else "rewritten"
    logger.info(
        f"Backfill complete [{mode_label}]: "
        f"scanned={scanned:,} {action}={rewritten:,} "
        f"skipped={skipped:,} errors={errors:,} unverified={unverified:,}"
    )

    if errors or unverified:
        if errors:
            logger.error(f"{errors:,} object(s) failed — review warnings above")
        if unverified:
            logger.error(
                f"{unverified:,} object(s) did not verify — CacheControl mismatch after rewrite"
            )
        sys.exit(1)


def main() -> None:
    """Parse arguments and run Cache-Control backfill."""
    parser = argparse.ArgumentParser(
        description=(
            "Back-fill Cache-Control metadata on every object in the configured S3 bucket. "
            "Run with --dry-run first to preview changes."
        )
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Log planned changes without writing to S3 (default: live run)",
    )
    args = parser.parse_args()
    backfill(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
