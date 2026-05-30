"""One-shot bucket-wide Cache-Control backfill script.

Iterates every object in the configured S3 bucket and rewrites its metadata
so that the Cache-Control header matches the value that ``upload_object``
would assign today (via CONTENT_TYPE_TO_CACHE_CONTROL / _DEFAULT_CACHE_CONTROL
from src.services.s3_service).

Objects that pre-date the Cache-Control changes (SCACHE-03/04/05) were
uploaded without a Cache-Control directive and therefore receive no browser
caching.  This script back-fills them in place using a same-bucket copy with
MetadataDirective=REPLACE, which is the only S3 mechanism that can update
object metadata without re-uploading the body.

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
    - ContentType is always re-supplied in copy_object because MetadataDirective=REPLACE
      drops ALL existing metadata; omitting ContentType would collapse every object
      to application/octet-stream and break image/audio serving.
"""

import argparse
import sys

from botocore.exceptions import BotoCoreError, ClientError
from loguru import logger

from src.config import settings
from src.services.s3_service import (
    _DEFAULT_CACHE_CONTROL,
    CONTENT_TYPE_TO_CACHE_CONTROL,
    get_s3_service,
)


def backfill(dry_run: bool) -> None:
    """Scan every object in the bucket and rewrite Cache-Control metadata.

    Args:
        dry_run: When True, log planned changes without calling copy_object.
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

    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket):
        for obj in page.get("Contents", []):  # guard: empty pages have no Contents key
            key = obj["Key"]
            scanned += 1

            try:
                head = client.head_object(Bucket=bucket, Key=key)
                content_type = head.get("ContentType", "")

                if not content_type:
                    # Skipping is safer than forcing application/octet-stream onto the
                    # object — the missing content-type is itself a data quality issue.
                    logger.warning(f"Skipping {key!r} — ContentType missing in HEAD response")
                    skipped += 1
                    continue

                cache_control = CONTENT_TYPE_TO_CACHE_CONTROL.get(
                    content_type, _DEFAULT_CACHE_CONTROL
                )

                if dry_run:
                    logger.info(
                        f"[DRY RUN] {key!r}: content_type={content_type!r}"
                        f" → CacheControl={cache_control!r}"
                    )
                    rewritten += 1
                    continue

                # MetadataDirective=REPLACE drops ALL existing metadata.
                # ContentType MUST be re-supplied or S3 defaults to
                # application/octet-stream, breaking image/audio serving.
                client.copy_object(
                    Bucket=bucket,
                    Key=key,
                    CopySource={"Bucket": bucket, "Key": key},
                    MetadataDirective="REPLACE",
                    ContentType=content_type,
                    CacheControl=cache_control,
                )
                logger.info(
                    f"Rewrote {key!r}: content_type={content_type!r}"
                    f" CacheControl={cache_control!r}"
                )
                rewritten += 1

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
        f"skipped={skipped:,} errors={errors:,}"
    )

    if errors:
        logger.error(f"{errors:,} object(s) failed — review warnings above")
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
