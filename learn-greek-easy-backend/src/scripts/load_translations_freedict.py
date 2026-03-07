"""Load Greek-Russian translations from FreeDict TEI XML into reference.translations.

Usage:
    poetry run python -m src.scripts.load_translations_freedict           # Normal load
    poetry run python -m src.scripts.load_translations_freedict --force    # Delete and reload
"""

import argparse
import sys
import time
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

import psycopg2
import psycopg2.extensions
import psycopg2.extras
from loguru import logger

from src.config import settings
from src.utils.gloss_cleaning import clean_gloss
from src.utils.pos_mapping import map_pos

DATA_FILE = Path(__file__).resolve().parent.parent.parent.parent / "data" / "ell-rus.tei"

TABLE = "reference.translations"
SOURCE = "freedict"
NS = {"tei": "http://www.tei-c.org/ns/1.0"}
BATCH_SIZE = 1000


def get_connection() -> psycopg2.extensions.connection:
    """Create psycopg2 connection using sync database URL."""
    return psycopg2.connect(settings.database_url_sync)


def get_row_count(cursor: psycopg2.extensions.cursor, source: str) -> int:
    """Get current row count in translations table for a given source."""
    cursor.execute(f"SELECT COUNT(*) FROM {TABLE} WHERE source = %s", (source,))
    row = cursor.fetchone()
    return int(row[0])


def _parse_entry(
    entry: "ET.Element",
) -> tuple[str | None, str | None, list[tuple[str, str, int, str, str | None, str]]]:
    """Parse a single TEI entry. Returns (lemma, upos, rows)."""
    orth_elem = entry.find("tei:form/tei:orth", NS)
    if orth_elem is None or not orth_elem.text:
        return None, None, []

    lemma = unicodedata.normalize("NFC", orth_elem.text)

    pos_elem = entry.find("tei:gramGrp/tei:pos", NS)
    upos: str | None = None
    if pos_elem is not None and pos_elem.text:
        upos = map_pos(pos_elem.text, source="freedict")

    rows: list[tuple[str, str, int, str, str | None, str]] = []
    for sense_index, sense in enumerate(entry.findall("tei:sense", NS)):
        for quote in sense.findall("tei:cit/tei:quote", NS):
            cleaned = clean_gloss(quote.text or "")
            if cleaned is not None:
                rows.append((lemma, "ru", sense_index, cleaned, upos, SOURCE))

    return lemma, upos, rows


def _parse_rows(
    cursor: psycopg2.extensions.cursor,
    insert_sql: str,
) -> tuple[int, int]:
    """Parse TEI XML and insert rows in batches. Returns (total_count, skipped_count)."""
    tree = ET.parse(DATA_FILE)  # noqa: S314
    root = tree.getroot()

    batch: list[tuple[str, str, int, str, str | None, str]] = []
    total_count = 0
    skipped_count = 0

    for entry in root.findall(".//tei:entry", NS):
        _, _, rows = _parse_entry(entry)
        skipped_count += len(entry.findall("tei:sense/tei:cit/tei:quote", NS)) - len(rows)
        batch.extend(rows)

        if len(batch) >= BATCH_SIZE:
            psycopg2.extras.execute_values(cursor, insert_sql, batch)
            total_count += len(batch)
            batch = []
            logger.debug(f"Inserted {total_count:,} rows so far...")

    if batch:
        psycopg2.extras.execute_values(cursor, insert_sql, batch)
        total_count += len(batch)

    return total_count, skipped_count


def _log_mismatch_report(cursor: psycopg2.extensions.cursor, source: str) -> None:
    """Log lemma mismatch rate against reference.greek_lexicon."""
    cursor.execute(
        """
        SELECT COUNT(DISTINCT t.lemma) AS unmatched
        FROM reference.translations t
        LEFT JOIN reference.greek_lexicon l ON t.lemma = l.lemma
        WHERE t.source = %s AND l.lemma IS NULL
        """,
        (source,),
    )
    unmatched_row = cursor.fetchone()
    unmatched = int(unmatched_row[0]) if unmatched_row else 0

    cursor.execute(
        "SELECT COUNT(DISTINCT lemma) FROM reference.translations WHERE source = %s",
        (source,),
    )
    total_row = cursor.fetchone()
    total = int(total_row[0]) if total_row else 0

    if total > 0:
        pct = unmatched / total * 100
        logger.info(
            f"Lemma mismatch: {unmatched}/{total} ({pct:.1f}%) lemmas not found in reference.greek_lexicon"
        )
        if pct > 2.0:
            logger.info("Consider accent-insensitive fallback for unmatched lemmas")


def load_data(force: bool = False) -> None:
    """Load Greek-Russian translations from FreeDict TEI XML into database.

    Args:
        force: If True, delete existing freedict rows before loading.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()

        count = get_row_count(cursor, SOURCE)
        logger.info(f"Current row count in {TABLE} for source='{SOURCE}': {count:,}")

        if count > 0 and not force:
            logger.info(
                f"Table already populated with {count:,} rows for source='{SOURCE}'. Use --force to reload."
            )
            return

        if count > 0 and force:
            logger.warning(f"Force mode: deleting {count:,} existing rows for source='{SOURCE}'...")
            cursor.execute(f"DELETE FROM {TABLE} WHERE source = %s", (SOURCE,))

        if not DATA_FILE.exists():
            logger.error(f"Data file not found: {DATA_FILE}")
            sys.exit(1)

        logger.info(f"Loading data from {DATA_FILE}...")
        start = time.monotonic()

        insert_sql = f"""
            INSERT INTO {TABLE} (lemma, language, sense_index, translation, part_of_speech, source)
            VALUES %s
        """

        total_count, skipped_count = _parse_rows(cursor, insert_sql)
        conn.commit()
        duration = time.monotonic() - start

        logger.info(
            f"Loaded {total_count:,} rows in {duration:.1f}s (skipped {skipped_count:,} glosses)"
        )
        _log_mismatch_report(cursor, SOURCE)

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
        description="Load Greek-Russian translations from FreeDict TEI XML into reference.translations"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Delete existing freedict rows and reload",
    )
    args = parser.parse_args()
    load_data(force=args.force)


if __name__ == "__main__":
    main()
