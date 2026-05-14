#!/usr/bin/env python
"""Backfill picture-match exercises for Situations that already have both children ready.

Selects all Situations where:
- SituationPicture.status == GENERATED
- SituationDescription.status == AUDIO_READY

For each, calls ``ensure_picture_match_exercises_for_situation`` which is
idempotent — already-existing exercises are skipped.

Usage:
    # Dry run (show what would be processed)
    poetry run python scripts/backfill_picture_match_exercises.py --dry-run

    # Live run
    poetry run python scripts/backfill_picture_match_exercises.py
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Add backend root to path for imports when running as a script.
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from src.core.logging import get_logger, setup_logging  # noqa: E402

setup_logging()
logger = get_logger(__name__)


async def main(dry_run: bool = False) -> int:
    """Run the backfill.

    Args:
        dry_run: If True, log what would be processed without making changes.

    Returns:
        0 on success, 1 on failure.
    """
    from sqlalchemy import select

    from src.db import close_db, get_session_factory, init_db  # noqa: E402
    from src.db.models import (  # noqa: E402
        DescriptionStatus,
        PictureStatus,
        Situation,
        SituationDescription,
        SituationPicture,
    )
    from src.services.picture_match_exercise_service import (  # noqa: E402
        ensure_picture_match_exercises_for_situation,
    )

    logger.info("Starting picture-match exercise backfill")
    if dry_run:
        logger.info("DRY RUN — no changes will be made")

    try:
        await init_db()
        factory = get_session_factory()

        # Find all situation IDs where both children are at readiness.
        async with factory.begin() as session:
            stmt = (
                select(Situation.id)
                .join(SituationPicture, SituationPicture.situation_id == Situation.id)
                .join(SituationDescription, SituationDescription.situation_id == Situation.id)
                .where(SituationPicture.status == PictureStatus.GENERATED)
                .where(SituationDescription.status == DescriptionStatus.AUDIO_READY)
            )
            result = await session.execute(stmt)
            situation_ids = [row[0] for row in result.fetchall()]

        logger.info(f"Found {len(situation_ids)} situation(s) meeting readiness criteria")

        if dry_run:
            for sid in situation_ids:
                logger.info(f"  [dry-run] would process situation_id={sid}")
            return 0

        total_created = 0
        total_processed = 0

        for sid in situation_ids:
            async with factory.begin() as session:
                created = await ensure_picture_match_exercises_for_situation(session, sid)
                total_created += created
                total_processed += 1
                if created:
                    logger.info(f"  situation_id={sid}: created {created} exercise(s)")
                else:
                    logger.debug(
                        f"  situation_id={sid}: no new exercises (already exists or not ready)"
                    )

        logger.info(
            f"Backfill complete: processed={total_processed}, exercises_created={total_created}"
        )
        return 0

    except Exception:
        logger.exception("Backfill failed")
        return 1
    finally:
        await close_db()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill picture-match exercises for ready Situations.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Dry run
    poetry run python scripts/backfill_picture_match_exercises.py --dry-run

    # Live run
    poetry run python scripts/backfill_picture_match_exercises.py
        """,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be processed without making changes",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    exit_code = asyncio.run(main(dry_run=args.dry_run))
    sys.exit(exit_code)
