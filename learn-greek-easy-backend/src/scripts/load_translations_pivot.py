"""Generate Greek-to-Russian pivot translations via English bridge.

Chains Greek→English (from kaikki source in reference.translations)
with English→Russian (from ruwiktionary JSONL) to produce pivot rows.

Usage:
    poetry run python -m src.scripts.load_translations_pivot           # Normal load
    poetry run python -m src.scripts.load_translations_pivot --force    # Delete pivots and reload
"""

import argparse
import gzip
import json
import sys
import time
from collections import defaultdict
from pathlib import Path

import psycopg2
import psycopg2.extensions
import psycopg2.extras
from loguru import logger

from src.config import settings
from src.utils.pos_mapping import map_pos

DATA_FILE = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "data"
    / "kaikki.org-dictionary-Английский.jsonl.gz"
)

TABLE = "reference.translations"
SOURCE = "pivot"
BATCH_SIZE = 5000


def build_en_ru_dict(data_file: Path) -> dict[str, list[tuple[str, str]]]:
    """Build English→Russian in-memory dictionary from ruwiktionary JSONL.gz.

    Args:
        data_file: Path to gzipped JSONL file.

    Returns:
        Dict mapping lowercase English word to list of (russian_translation, upos) tuples.
    """
    en_ru: dict[str, list[tuple[str, str]]] = defaultdict(list)
    total_entries = 0
    total_senses = 0

    logger.info("Phase A: Loading English→Russian dictionary...")
    start = time.monotonic()

    with gzip.open(data_file, "rt", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError as e:
                logger.warning(f"Skipping malformed JSON line: {e}")
                continue

            word = entry.get("word", "")
            if not word:
                continue

            raw_pos = entry.get("pos", "")
            upos = map_pos(raw_pos) if raw_pos else "X"

            for sense in entry.get("senses", []):
                for gloss in sense.get("glosses", []):
                    if gloss and gloss.strip():
                        en_ru[word.lower()].append((gloss.strip(), upos))
                        total_senses += 1

            total_entries += 1

    duration = time.monotonic() - start
    logger.info(
        f"Phase A complete: {total_entries:,} English words, {total_senses:,} senses ({duration:.1f}s)"
    )
    return dict(en_ru)


def _get_max_sense_indices(cursor: psycopg2.extensions.cursor) -> dict[str, int]:
    """Get max sense_index per lemma for existing Russian translations."""
    cursor.execute(
        """
        SELECT lemma, COALESCE(MAX(sense_index), -1) AS max_idx
        FROM reference.translations
        WHERE language = 'ru'
        GROUP BY lemma
        """
    )
    return {row[0]: row[1] for row in cursor.fetchall()}


def generate_pivots(
    conn: psycopg2.extensions.connection,
    en_ru_dict: dict[str, list[tuple[str, str]]],
) -> tuple[int, int, int]:
    """Generate pivot translations and insert them.

    Args:
        conn: Active psycopg2 connection.
        en_ru_dict: English→Russian lookup dict from Phase A.

    Returns:
        (total_pivots, exact_pos_matches, fallback_matches)
    """
    cursor = conn.cursor()

    # Get existing English kaikki translations
    cursor.execute(
        """
        SELECT DISTINCT lemma, translation, part_of_speech
        FROM reference.translations
        WHERE language = 'en' AND source = 'kaikki'
        ORDER BY lemma
        """
    )
    en_rows = cursor.fetchall()

    if not en_rows:
        logger.error("No English kaikki translations found. Run TDICT-03 first.")
        sys.exit(1)

    logger.info(f"Phase B: Processing {len(en_rows):,} Greek→English pairs...")

    max_sense = _get_max_sense_indices(cursor)

    insert_sql = f"""
        INSERT INTO {TABLE} (lemma, language, sense_index, translation, part_of_speech, source)
        VALUES %s
    """

    batch: list[tuple[str, str, int, str, str | None, str]] = []
    total_pivots = 0
    exact_pos_matches = 0
    fallback_matches = 0
    seen: set[tuple[str, str]] = set()

    start = time.monotonic()

    for lemma, en_translation, upos in en_rows:
        lookup_key = en_translation.lower()
        ru_entries = en_ru_dict.get(lookup_key)
        if not ru_entries:
            continue

        # POS matching: prefer exact match, fall back to all
        exact = [(ru, ru_pos) for ru, ru_pos in ru_entries if upos and ru_pos == upos]
        if exact:
            candidates = exact
            exact_pos_matches += 1
        else:
            candidates = ru_entries
            fallback_matches += 1

        for ru_translation, ru_upos in candidates:
            dedup_key = (lemma, ru_translation)
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            next_sense = max_sense.get(lemma, -1) + 1
            max_sense[lemma] = next_sense

            batch.append((lemma, "ru", next_sense, ru_translation, ru_upos, SOURCE))
            total_pivots += 1

            if len(batch) >= BATCH_SIZE:
                psycopg2.extras.execute_values(cursor, insert_sql, batch)
                batch = []
                logger.debug(f"Inserted {total_pivots:,} pivot rows so far...")

    if batch:
        psycopg2.extras.execute_values(cursor, insert_sql, batch)

    duration = time.monotonic() - start
    logger.info(f"Phase B complete: {total_pivots:,} pivot rows inserted ({duration:.1f}s)")

    return total_pivots, exact_pos_matches, fallback_matches


def get_connection() -> psycopg2.extensions.connection:
    """Create psycopg2 connection using sync database URL."""
    return psycopg2.connect(settings.database_url_sync)


def get_row_count(cursor: psycopg2.extensions.cursor, source: str) -> int:
    """Get current row count in translations table for a given source."""
    cursor.execute(f"SELECT COUNT(*) FROM {TABLE} WHERE source = %s", (source,))
    row = cursor.fetchone()
    return int(row[0])


def load_data(force: bool = False) -> None:
    """Load pivot translations by chaining Greek→English→Russian.

    Args:
        force: If True, delete existing pivot rows before loading.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()

        count = get_row_count(cursor, SOURCE)
        logger.info(f"Current row count in {TABLE} for source='{SOURCE}': {count:,}")

        if count > 0 and not force:
            logger.info(
                f"Pivot translations already loaded ({count:,} rows). Use --force to reload."
            )
            return

        if count > 0 and force:
            logger.warning(f"Force mode: deleting {count:,} existing pivot rows...")
            cursor.execute(f"DELETE FROM {TABLE} WHERE source = %s", (SOURCE,))
            conn.commit()

        if not DATA_FILE.exists():
            logger.error(f"Data file not found: {DATA_FILE}")
            sys.exit(1)

        overall_start = time.monotonic()

        en_ru_dict = build_en_ru_dict(DATA_FILE)
        total_pivots, exact_pos, fallback = generate_pivots(conn, en_ru_dict)

        conn.commit()
        total_duration = time.monotonic() - overall_start

        total_matches = exact_pos + fallback
        if total_matches > 0:
            logger.info(
                f"POS matching: {exact_pos:,} exact ({exact_pos / total_matches * 100:.1f}%), "
                f"{fallback:,} fallback ({fallback / total_matches * 100:.1f}%)"
            )
        logger.info(f"Total time: {total_duration:.1f}s")

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
    """Parse arguments and run pivot translation loading."""
    parser = argparse.ArgumentParser(
        description="Generate Greek-to-Russian pivot translations via English bridge"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Delete existing pivot rows and reload",
    )
    args = parser.parse_args()
    load_data(force=args.force)


if __name__ == "__main__":
    main()
