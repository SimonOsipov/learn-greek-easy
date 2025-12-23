#!/usr/bin/env python
"""CLI script for manual E2E database seeding.

This script provides a command-line interface for seeding the database
with test data for E2E testing. It can be used in local development
or CI pipelines.

Usage:
    # Full seed (truncate + seed all data)
    poetry run python scripts/seed_e2e_data.py

    # Dry run (show what would be done)
    poetry run python scripts/seed_e2e_data.py --dry-run

    # Truncate only (clear all data)
    poetry run python scripts/seed_e2e_data.py --truncate-only

    # With environment variables
    TEST_SEED_ENABLED=true poetry run python scripts/seed_e2e_data.py

Requirements:
    - TEST_SEED_ENABLED=true (or APP_ENV != production)
    - Database must be initialized
    - Redis must be available (for init)

Exit codes:
    0 - Success
    1 - Failure (seeding not allowed or error occurred)
"""

import argparse
import asyncio
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# Add parent directory to path for imports
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from src.config import settings  # noqa: E402

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def _log_dry_run_info(truncate_only: bool) -> None:
    """Log what would be done in dry run mode."""
    logger.info("")
    logger.info("DRY RUN MODE - No changes will be made")
    logger.info("")
    logger.info("Would perform:")
    if truncate_only:
        logger.info("  - Truncate all tables")
    else:
        logger.info("  - Truncate all tables")
        logger.info("  - Create 4 test users:")
        logger.info("    - e2e_learner@test.com (Regular learner)")
        logger.info("    - e2e_beginner@test.com (New user)")
        logger.info("    - e2e_advanced@test.com (Advanced user)")
        logger.info("    - e2e_admin@test.com (Admin user)")
        logger.info("  - Create 6 CEFR-level decks (A1, A2, B1, B2, C1, C2)")
        logger.info("  - Create 60 Greek vocabulary cards (10 per deck)")
        logger.info("  - Create card statistics for learner user")
        logger.info("  - Create review history for learner user")
        logger.info("  - Create 8 feedback items (5 feature requests, 3 bug reports)")
        logger.info("  - Create votes (upvotes and downvotes) for feedback items")
        logger.info(
            "  - Create 5 culture decks (History, Geography, Politics, Culture, Traditions)"
        )
        logger.info("  - Create 50 Greek culture questions (10 per deck, trilingual: el/en/ru)")
        logger.info("  - Create culture question statistics for learner user (60% History)")
        logger.info("  - Create culture question statistics for advanced user (80% all decks)")
    logger.info("")
    logger.info("All test users have password: TestPassword123!")


def _log_result(operation: str, result: dict[str, Any], duration: float) -> None:
    """Log the result of the seeding operation."""
    logger.info("")
    logger.info("=" * 60)
    logger.info(f"Operation: {operation}")
    logger.info(f"Duration: {duration:.2f}s")
    logger.info("=" * 60)

    if operation == "truncate":
        tables = result.get("truncated_tables", [])
        logger.info(f"Tables truncated: {len(tables)}")
        for table in tables:
            logger.info(f"  - {table}")
    elif result.get("success"):
        users = result.get("users", {}).get("users", [])
        decks = result.get("content", {}).get("decks", [])
        cards = result.get("content", {}).get("cards", [])

        logger.info(f"Users created: {len(users)}")
        for user in users:
            logger.info(f"  - {user.get('email')}")

        logger.info(f"Decks created: {len(decks)}")
        logger.info(f"Cards created: {len(cards)}")

        # Log feedback results
        feedback_result = result.get("feedback", {})
        feedback_items = feedback_result.get("feedback", [])
        votes = feedback_result.get("votes", [])

        logger.info(f"Feedback items created: {len(feedback_items)}")
        if feedback_items:
            # Count by category
            feature_requests = sum(
                1 for f in feedback_items if f.get("category") == "feature_request"
            )
            bug_reports = sum(
                1 for f in feedback_items if f.get("category") == "bug_incorrect_data"
            )
            logger.info(f"  - Feature requests: {feature_requests}")
            logger.info(f"  - Bug reports: {bug_reports}")

        logger.info(f"Votes created: {len(votes)}")
        if votes:
            # Count upvotes and downvotes
            upvotes = sum(1 for v in votes if v.get("type") == "up")
            downvotes = sum(1 for v in votes if v.get("type") == "down")
            logger.info(f"  - Upvotes: {upvotes}")
            logger.info(f"  - Downvotes: {downvotes}")

        # Log culture results
        culture_result = result.get("culture", {})
        culture_decks = culture_result.get("decks", [])
        culture_questions = culture_result.get("questions", [])

        logger.info(f"Culture decks created: {len(culture_decks)}")
        if culture_decks:
            for deck in culture_decks:
                logger.info(f"  - {deck.get('category', 'Unknown')}")

        logger.info(f"Culture questions created: {len(culture_questions)}")

        # Log culture statistics
        culture_stats_result = result.get("culture_statistics", {})
        learner_stats = culture_stats_result.get("stats_created", 0)
        advanced_culture_stats = result.get("advanced_culture_statistics", [])
        advanced_total = sum(s.get("stats_created", 0) for s in advanced_culture_stats)

        if learner_stats or advanced_total:
            logger.info("Culture question statistics created:")
            if learner_stats:
                logger.info(f"  - Learner (60% History): {learner_stats} stats")
            if advanced_total:
                logger.info(f"  - Advanced (80% all decks): {advanced_total} stats")

        password = result.get("users", {}).get("password", "TestPassword123!")
        logger.info("")
        logger.info(f"Password for all users: {password}")


async def main(dry_run: bool = False, truncate_only: bool = False) -> int:
    """Execute seeding operation.

    Args:
        dry_run: If True, only show what would be done
        truncate_only: If True, only truncate tables

    Returns:
        0 on success, 1 on failure
    """
    logger.info("=" * 60)
    logger.info("E2E Database Seeding Script")
    logger.info("=" * 60)

    # Check if seeding is allowed
    if not settings.can_seed_database():
        errors = settings.get_seed_validation_errors()
        logger.error("Cannot seed database:")
        for error in errors:
            logger.error(f"  - {error}")
        logger.error("")
        logger.error("To enable seeding, set:")
        logger.error("  TEST_SEED_ENABLED=true")
        logger.error("  APP_ENV=development (or staging/test)")
        return 1

    logger.info(f"Environment: {settings.app_env}")
    logger.info(f"Seeding enabled: {settings.test_seed_enabled}")
    logger.info(f"Secret required: {settings.seed_requires_secret}")

    if dry_run:
        _log_dry_run_info(truncate_only)
        return 0

    # Import database modules
    from src.db import close_db, get_session_factory, init_db  # noqa: E402
    from src.services.seed_service import SeedService  # noqa: E402

    logger.info("")
    logger.info("Initializing database connection...")

    try:
        await init_db()

        session_factory = get_session_factory()
        async with session_factory() as db:
            service = SeedService(db)
            start_time = datetime.now()

            if truncate_only:
                logger.info("Truncating tables...")
                result = await service.truncate_tables()
                await db.commit()
                operation = "truncate"
            else:
                logger.info("Executing full seed...")
                result = await service.seed_all()
                operation = "all"

            duration = (datetime.now() - start_time).total_seconds()
            _log_result(operation, result, duration)

            logger.info("")
            logger.info("Seed completed successfully!")
            return 0

    except Exception as e:
        logger.error(f"Seeding failed: {e}", exc_info=True)
        return 1
    finally:
        await close_db()


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Seed E2E test database with deterministic test data.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Full seed
    poetry run python scripts/seed_e2e_data.py

    # Show what would be done
    poetry run python scripts/seed_e2e_data.py --dry-run

    # Clear all data
    poetry run python scripts/seed_e2e_data.py --truncate-only

    # Enable seeding via environment
    TEST_SEED_ENABLED=true poetry run python scripts/seed_e2e_data.py

Environment Variables:
    TEST_SEED_ENABLED   Set to 'true' to enable seeding
    APP_ENV             Must not be 'production'
    TEST_SEED_SECRET    Optional secret for API authentication
        """,
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes",
    )

    parser.add_argument(
        "--truncate-only",
        action="store_true",
        help="Only truncate tables, don't seed data",
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

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    exit_code = asyncio.run(main(dry_run=args.dry_run, truncate_only=args.truncate_only))
    sys.exit(exit_code)
