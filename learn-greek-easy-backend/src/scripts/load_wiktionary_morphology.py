"""Load Wiktionary noun morphology from Kaikki JSONL into reference.wiktionary_morphology.

Run with: poetry run python -m src.scripts.load_wiktionary_morphology [--force]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

import psycopg2
import psycopg2.extensions
import psycopg2.extras
from loguru import logger

from src.config import settings

DATA_FILE = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "data"
    / "kaikki.org-dictionary-Greek.jsonl"
)
TABLE = "reference.wiktionary_morphology"
BATCH_SIZE = 10_000
GENDER_MAP = {"m": "masculine", "f": "feminine", "n": "neuter"}
INFLECTED_FORM_RE = re.compile(
    r"^(nominative|genitive|accusative|vocative)\s+(singular|plural)\s+of\s+\S+",
    re.IGNORECASE,
)
EXCLUDED_TAGS = {"inflection-template", "table-tags", "romanization"}
VALID_CASES = {"nominative", "genitive", "accusative", "vocative"}
VALID_NUMBERS = {"singular", "plural"}


def _get_connection() -> psycopg2.extensions.connection:
    return psycopg2.connect(settings.database_url_sync)


def _get_gender(entry: dict) -> str | None:
    for tmpl in entry.get("head_templates", []):
        args = tmpl.get("args", {})
        if "g" in args:
            return GENDER_MAP.get(args["g"])
    return None


def _is_inflected_form_only(entry: dict) -> bool:
    """Return True if ALL senses are inflected-form cross-references."""
    senses = entry.get("senses", [])
    if not senses:
        return False
    for sense in senses:
        glosses = sense.get("glosses", [])
        first_gloss = glosses[0] if glosses else ""
        if not INFLECTED_FORM_RE.match(first_gloss):
            return False
    return True


def _extract_forms(entry: dict) -> dict[str, str]:
    forms: dict[str, str] = {}
    for form in entry.get("forms", []):
        if form.get("source") != "declension":
            continue
        tags_set = set(form.get("tags", []))
        if tags_set & EXCLUDED_TAGS:
            continue
        case_set = tags_set & VALID_CASES
        number_set = tags_set & VALID_NUMBERS
        if len(case_set) == 1 and len(number_set) == 1:
            key = f"{next(iter(case_set))}_{next(iter(number_set))}"
            forms.setdefault(key, form.get("form", ""))
    return forms


def _extract_ipa(entry: dict) -> str | None:
    for sound in entry.get("sounds", []):
        if "ipa" in sound:
            return str(sound["ipa"])
    return None


def _extract_glosses(entry: dict) -> str | None:
    seen: list[str] = []
    for sense in entry.get("senses", []):
        glosses = sense.get("glosses", [])
        if glosses and glosses[0] not in seen:
            seen.append(glosses[0])
    return "; ".join(seen) if seen else None


def _merge_into(
    existing: dict, forms: dict[str, str], ipa: str | None, glosses: str | None
) -> None:
    """Merge duplicate entry data into an existing row (in-place)."""
    for k, v in forms.items():
        existing["forms"].setdefault(k, v)
    if glosses:
        existing_glosses = (
            set(existing["glosses_en"].split("; ")) if existing["glosses_en"] else set()
        )
        combined = existing_glosses | set(glosses.split("; "))
        existing["glosses_en"] = "; ".join(sorted(combined))
    if existing["pronunciation"] is None and ipa is not None:
        existing["pronunciation"] = ipa


def _process_noun_entry(
    entry: dict, merged: dict, filtered_ref: list[int], total_raw_ref: list[int]
) -> None:
    """Process a single noun entry, updating merged dict and counters."""
    total_raw_ref[0] += 1

    if _is_inflected_form_only(entry):
        filtered_ref[0] += 1
        return

    gender = _get_gender(entry)
    if gender is None:
        filtered_ref[0] += 1
        return

    lemma = entry.get("word", "")
    key = (lemma, gender)
    forms = _extract_forms(entry)
    ipa = _extract_ipa(entry)
    glosses = _extract_glosses(entry)

    if key in merged:
        _merge_into(merged[key], forms, ipa, glosses)
    else:
        merged[key] = {
            "lemma": lemma,
            "gender": gender,
            "forms": forms,
            "pronunciation": ipa,
            "glosses_en": glosses,
        }


def _parse_entries(path: Path) -> tuple[list[dict], int, int]:
    """Parse JSONL file, returning merged list of rows keyed by (lemma, gender)."""
    merged: dict[tuple[str, str], dict] = {}
    filtered_ref = [0]
    total_raw_ref = [0]

    with path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if entry.get("pos") != "noun":
                continue
            _process_noun_entry(entry, merged, filtered_ref, total_raw_ref)

    filtered = filtered_ref[0]
    total_raw = total_raw_ref[0]
    merged_count = max(0, total_raw - filtered - len(merged))
    logger.info(f"Parsed {total_raw:,} noun entries from JSONL")
    logger.info(f"  Filtered (inflected-form refs or no gender): {filtered:,}")
    logger.info(f"  Merged (duplicate lemma+gender): {merged_count:,}")
    return list(merged.values()), filtered, merged_count


def _log_mismatch_report(cursor: psycopg2.extensions.cursor) -> None:
    cursor.execute(
        """
        SELECT COUNT(DISTINCT w.lemma) AS unmatched
        FROM reference.wiktionary_morphology w
        LEFT JOIN reference.greek_lexicon l ON w.lemma = l.lemma
        WHERE l.lemma IS NULL
        """
    )
    row = cursor.fetchone()
    unmatched = row[0] if row else 0
    logger.info(
        f"Mismatch report: {unmatched:,} lemmas in wiktionary_morphology not found in greek_lexicon"
    )


def _insert_rows(cursor: psycopg2.extensions.cursor, rows: list[dict]) -> tuple[int, int, int]:
    """Batch-insert rows; return (with_forms, with_ipa, with_glosses) counts."""
    insert_sql = f"""
        INSERT INTO {TABLE} (lemma, gender, forms, pronunciation, glosses_en)
        VALUES %s
        ON CONFLICT DO NOTHING
    """
    with_forms = with_ipa = with_glosses = 0
    batch: list[tuple] = []

    for row in rows:
        if row["forms"]:
            with_forms += 1
        if row["pronunciation"]:
            with_ipa += 1
        if row["glosses_en"]:
            with_glosses += 1
        batch.append(
            (
                row["lemma"],
                row["gender"],
                psycopg2.extras.Json(row["forms"]),
                row["pronunciation"],
                row["glosses_en"],
            )
        )
        if len(batch) >= BATCH_SIZE:
            psycopg2.extras.execute_values(cursor, insert_sql, batch)
            batch = []

    if batch:
        psycopg2.extras.execute_values(cursor, insert_sql, batch)

    return with_forms, with_ipa, with_glosses


def load_data(force: bool = False) -> None:
    if not DATA_FILE.exists():
        logger.error(f"Data file not found: {DATA_FILE}")
        sys.exit(1)

    start = time.time()
    rows, filtered, merged = _parse_entries(DATA_FILE)

    conn = _get_connection()
    try:
        with conn.cursor() as cursor:
            if force:
                logger.warning(f"--force: deleting all rows from {TABLE}")
                cursor.execute(f"DELETE FROM {TABLE}")

            with_forms, with_ipa, with_glosses = _insert_rows(cursor, rows)
            conn.commit()

            duration = time.time() - start
            logger.info(f"Loaded {len(rows):,} rows in {duration:.1f}s")
            logger.info(f"  With declension forms: {with_forms:,}")
            logger.info(f"  With IPA: {with_ipa:,}")
            logger.info(f"  With glosses: {with_glosses:,}")
            logger.info(f"  Filtered (inflected-form refs): {filtered:,}")
            logger.info(f"  Merged (duplicate lemma+gender): {merged:,}")

            _log_mismatch_report(cursor)

    except psycopg2.Error as exc:
        conn.rollback()
        logger.error(f"Database error: {exc}")
        sys.exit(1)
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Load Wiktionary noun morphology from Kaikki JSONL into reference.wiktionary_morphology"
    )
    parser.add_argument("--force", action="store_true", help="Delete existing rows and reload")
    args = parser.parse_args()
    load_data(force=args.force)


if __name__ == "__main__":
    main()
