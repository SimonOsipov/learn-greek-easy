"""Load Greek lexicon data into reference.greek_lexicon table.

Usage:
    poetry run python -m src.scripts.load_lexicon           # Normal load
    poetry run python -m src.scripts.load_lexicon --force    # Truncate and reload
"""

import argparse
import gzip
import sys
import time
from pathlib import Path

import psycopg2
import psycopg2.extensions
from loguru import logger

from src.config import settings

# Path to compressed CSV -- repo root / data / greek_lexicon.csv.gz
DATA_FILE = Path(__file__).resolve().parent.parent.parent.parent / "data" / "greek_lexicon.csv.gz"

TABLE = "reference.greek_lexicon"
EXPECTED_ROW_COUNT = 902_033

# Columns in CSV (must match header order, excludes auto-generated id)
COLUMNS = (
    "form",
    "lemma",
    "pos",
    "gender",
    "ptosi",
    "number",
    "person",
    "tense",
    "aspect",
    "mood",
    "verbform",
    "voice",
    "degree",
)


def get_connection() -> psycopg2.extensions.connection:
    """Create psycopg2 connection using sync database URL."""
    return psycopg2.connect(settings.database_url_sync)


def get_row_count(cursor: psycopg2.extensions.cursor) -> int:
    """Get current row count in greek_lexicon table."""
    cursor.execute(f"SELECT COUNT(*) FROM {TABLE}")
    row = cursor.fetchone()
    return int(row[0])


def load_data(force: bool = False) -> None:
    """Load Greek lexicon data from CSV into database.

    Args:
        force: If True, truncate existing data before loading.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()

        # Check existing data
        count = get_row_count(cursor)
        logger.info(f"Current row count in {TABLE}: {count:,}")

        if count > 0 and not force:
            logger.info(f"Table already populated with {count:,} rows. " "Use --force to reload.")
            return

        if count > 0 and force:
            logger.warning(f"Force mode: truncating {count:,} existing rows...")
            cursor.execute(f"TRUNCATE TABLE {TABLE}")

        # Validate file exists
        if not DATA_FILE.exists():
            logger.error(f"Data file not found: {DATA_FILE}")
            sys.exit(1)

        # Load via COPY
        columns_str = ", ".join(COLUMNS)
        copy_sql = f"COPY {TABLE} ({columns_str}) FROM STDIN WITH CSV HEADER"

        logger.info(f"Loading data from {DATA_FILE}...")
        start = time.monotonic()

        with gzip.open(DATA_FILE, "rt", encoding="utf-8") as f:
            cursor.copy_expert(copy_sql, f)

        conn.commit()
        duration = time.monotonic() - start

        # Verify
        final_count = get_row_count(cursor)
        logger.info(f"Loaded {final_count:,} rows in {duration:.1f}s")

    except psycopg2.Error as e:
        logger.error(f"Database error: {e}")
        conn.rollback()
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()


def main() -> None:
    """Parse arguments and run data loading."""
    parser = argparse.ArgumentParser(
        description="Load Greek lexicon data into reference.greek_lexicon"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Truncate existing data and reload",
    )
    args = parser.parse_args()
    load_data(force=args.force)


if __name__ == "__main__":
    main()
