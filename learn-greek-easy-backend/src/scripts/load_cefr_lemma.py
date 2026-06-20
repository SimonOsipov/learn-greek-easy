"""Load CEFR introduction-level lemmas into ``reference.cefr_lemma`` (LEXGEN-04-03).

Run with::

    poetry run python -m src.scripts.load_cefr_lemma --source data/cefr_lemma/ [--force]

Deviation from the other ``src/scripts`` loaders (D-RUNTIME-SOURCE-ARG): instead of
a baked-in ``DATA_FILE`` constant, this loader takes a runtime ``--source <path>``
pointing at a file OR directory of candidate ``lemma, level, source`` rows. The
candidate corpora (ΚΕΓ glossaries, deck exports, frequency bins) are
license-restricted and gitignored under ``data/`` (AC-INV-4 / AC-19); only this
loader code is committed, and production is backfilled post-deploy by a one-time
manual op (the mechanism INFRA-11 used).

Pipeline per candidate row (D-LOADER-DOES-NORMALIZE / D-INJECT-NORMALIZE):

1. The loader itself does ``raw.lower()`` then ``unicodedata.normalize("NFC", ...)``
   (the ``load_translations_kaikki.py`` idiom — NFC only; sources are already
   monotonic modern Greek and there is no accent-strip helper in the repo) BEFORE
   calling the **injected** ``normalize`` callable.  ``normalize`` defaults to
   ``None`` and is lazily resolved to ``get_lemma_normalization_service().normalize``
   only on first real use, so importing / unit-testing this module never triggers
   the real spaCy import (the scripts conftest does NOT MagicMock spaCy).
2. Attestation against ``reference.greek_lexicon.lemma`` ∪
   ``reference.wiktionary_morphology.lemma``.
3. Failures are routed to ``reference.cefr_lemma_review`` with a ``reason`` — never
   dropped.  ``reason = "normalization_failed"`` iff ``confidence == 0.0``
   (D-NORMFAIL-CRITERION; the lemma may be a non-empty non-Greek string on the
   failure branch, so an empty-lemma check is NOT the criterion);
   ``reason = "not_attested"`` when ``confidence > 0.0`` but the lemma is absent
   from both reference tables.
4. Survivors are collapsed to ONE canonical level per lemma by precedence
   ``keg_glossary > deck_export > frequency_bin`` (closed-class forced ``A1``
   overrides all); the winning ``source`` is recorded.
5. Survivors batch-inserted into ``reference.cefr_lemma``.
6. A loguru summary logs per-source counts (read / inserted / review / deduped).

``--force`` DELETEs BOTH ``reference.cefr_lemma`` AND ``reference.cefr_lemma_review``
before reload (D-FORCE-TRUNCATES-REVIEW) so re-runs do not accumulate duplicate
review rows.

Closed-class function words (``cefr_closed_class.build_closed_class_rows()``) are
folded in as an extra source layer ONLY when ``include_closed_class=True`` — which
``main()`` always passes for the real backfill.  They bypass normalization and
attestation (AC-15): they are forced in at ``A1`` with ``closed_class=True``.

Trust boundary: the normalize/attest bypass is granted STRICTLY by the explicit
``closed_class=True`` flag, which ONLY the curated in-code whitelist above ever sets.
``--source`` rows are never trusted to set it (``_parse_source_file`` does not), so an
external CSV row whose ``source`` column reads ``"closed_class"`` is still routed
through the normalize → attest pipeline and can never forge the A1 bypass.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Callable

import psycopg2
import psycopg2.extensions
import psycopg2.extras
from loguru import logger

from src.config import settings
from src.schemas.nlp import NormalizedLemma

CEFR_TABLE = "reference.cefr_lemma"
REVIEW_TABLE = "reference.cefr_lemma_review"
BATCH_SIZE = 10_000

#: Source-authority precedence, highest first. A lemma arriving from several
#: sources is resolved to the level carried by its highest-precedence source.
#: ``closed_class`` is not in this list — it is a hard override handled separately.
SOURCE_PRECEDENCE: tuple[str, ...] = ("keg_glossary", "deck_export", "frequency_bin")

#: The level closed-class function words are always forced to.
CLOSED_CLASS_LEVEL = "A1"

#: A type alias for the injected normalization callable (word -> NormalizedLemma).
NormalizeFn = Callable[[str], NormalizedLemma]


def _get_connection() -> psycopg2.extensions.connection:
    """Open a psycopg2 connection (mirrors load_wiktionary_morphology.py:42)."""
    return psycopg2.connect(settings.database_url_sync)


def _resolve_normalize() -> NormalizeFn:
    """Lazily resolve the production normalization entry point.

    The ``from src.services...`` import lives HERE, inside the resolver, NOT at
    module top-level (D-INJECT-NORMALIZE): importing this module must never trigger
    the real spaCy import, because the scripts conftest does not MagicMock spaCy and
    the real import can raise ``ConfigError`` on Python 3.14. Unit tests always
    inject a mock ``normalize`` so this resolver is reached only at real runtime.
    """
    from src.services.lemma_normalization_service import (  # noqa: PLC0415
        get_lemma_normalization_service,
    )

    return get_lemma_normalization_service().normalize


# ---------------------------------------------------------------------------
# Source parsing
# ---------------------------------------------------------------------------


def _parse_source_file(path: Path) -> list[dict]:
    """Parse a single candidate file (``.csv`` or ``.jsonl``) into raw row dicts.

    Each returned dict has at least ``lemma`` / ``level`` / ``source``. CSV files
    must have a ``lemma,level,source`` header; JSONL files are one JSON object per
    line with the same keys. Blank lines and rows missing a lemma are skipped.
    """
    rows: list[dict] = []
    suffix = path.suffix.lower()

    if suffix == ".jsonl":
        with path.open(encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                lemma = str(obj.get("lemma", "")).strip()
                if not lemma:
                    continue
                rows.append(
                    {
                        "lemma": lemma,
                        "level": str(obj.get("level", "")).strip(),
                        "source": str(obj.get("source", "")).strip(),
                    }
                )
        return rows

    # Default: CSV (``.csv`` or anything else treated as CSV).
    with path.open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for record in reader:
            lemma = str((record.get("lemma") or "")).strip()
            if not lemma:
                continue
            rows.append(
                {
                    "lemma": lemma,
                    "level": str((record.get("level") or "")).strip(),
                    "source": str((record.get("source") or "")).strip(),
                }
            )
    return rows


def _parse_source(source: str) -> list[dict]:
    """Parse ``--source`` (a file or directory) into a flat list of raw row dicts."""
    path = Path(source)
    if path.is_dir():
        rows: list[dict] = []
        for child in sorted(path.iterdir()):
            if child.is_file() and child.suffix.lower() in (".csv", ".jsonl"):
                rows.extend(_parse_source_file(child))
        return rows
    return _parse_source_file(path)


# ---------------------------------------------------------------------------
# Pure precedence-merge (D-PRECEDENCE-MERGE) — no DB access
# ---------------------------------------------------------------------------


def merge_by_precedence(rows: list[dict]) -> list[dict]:
    """Collapse candidate rows to ONE canonical row per lemma by source authority.

    Precedence (highest → lowest): ``keg_glossary > deck_export > frequency_bin``.
    Any unknown source ranks below all known ones (it only wins if it is the sole
    candidate for a lemma). Closed-class is a hard override: if ANY candidate for a
    lemma has ``closed_class is True``, the merged row is forced to ``level="A1"``,
    ``closed_class=True``, ``source="closed_class"`` regardless of the other candidates.

    Trust boundary: the closed-class bypass is keyed STRICTLY on the explicit
    ``closed_class is True`` flag, NOT on the ``source`` string. Only the curated
    in-code whitelist (``cefr_closed_class.build_closed_class_rows()``) ever sets that
    flag; ``--source`` rows are parsed by :func:`_parse_source_file`, which never sets
    ``closed_class``. So an external ``--source`` row whose ``source`` column happens
    to read ``"closed_class"`` is treated as an untrusted open-class candidate (ranked
    last, since "closed_class" is not in :data:`SOURCE_PRECEDENCE`) and still flows
    through the normalize → attest pipeline — it can never forge the A1 bypass.

    Pure function — no DB, no normalization, no attestation — so it is unit-testable
    in isolation. Returns one dict per unique lemma, input order preserved.
    """

    def _rank(source: str) -> int:
        try:
            return SOURCE_PRECEDENCE.index(source)
        except ValueError:
            return len(SOURCE_PRECEDENCE)  # unknown source ranks last

    best: dict[str, dict] = {}
    order: list[str] = []

    for row in rows:
        lemma = row["lemma"]
        # Bypass is keyed on the explicit flag ONLY — never the source string — so an
        # untrusted --source row cannot claim closed-class status (trust boundary).
        is_closed = row.get("closed_class") is True
        if lemma not in best:
            order.append(lemma)
            best[lemma] = {
                "lemma": lemma,
                "level": row["level"],
                "source": row["source"],
                "closed_class": is_closed,
            }
            if is_closed:
                best[lemma]["level"] = CLOSED_CLASS_LEVEL
                best[lemma]["source"] = "closed_class"
            continue

        current = best[lemma]
        if is_closed:
            # Hard override: closed-class wins outright and forces A1.
            current["level"] = CLOSED_CLASS_LEVEL
            current["source"] = "closed_class"
            current["closed_class"] = True
        elif not current["closed_class"] and _rank(row["source"]) < _rank(current["source"]):
            # Higher-authority open-class source supersedes the current pick.
            current["level"] = row["level"]
            current["source"] = row["source"]

    return [best[lemma] for lemma in order]


# ---------------------------------------------------------------------------
# Attestation
# ---------------------------------------------------------------------------


def _attest(lemmas: set[str], cursor: psycopg2.extensions.cursor) -> set[str]:
    """Return the subset of ``lemmas`` attested in either reference table.

    A lemma is attested if it appears in ``reference.greek_lexicon.lemma`` OR
    ``reference.wiktionary_morphology.lemma``. Each table is queried with a single
    ``WHERE lemma = ANY(%s)`` bulk SELECT; the attested set is the union of the
    ``row[0]`` values returned by both ``fetchall()`` calls.
    """
    if not lemmas:
        return set()

    candidates = list(lemmas)
    attested: set[str] = set()

    for table in ("reference.greek_lexicon", "reference.wiktionary_morphology"):
        cursor.execute(
            f"SELECT lemma FROM {table} WHERE lemma = ANY(%s)",  # noqa: S608 — table is a constant
            (candidates,),
        )
        for fetched in cursor.fetchall():
            attested.add(fetched[0])

    return attested


# ---------------------------------------------------------------------------
# Inserts
# ---------------------------------------------------------------------------


def _insert_main_rows(cursor: psycopg2.extensions.cursor, rows: list[dict]) -> int:
    """Batch-insert survivor rows into ``reference.cefr_lemma``. Returns count.

    The count is the number of rows ACTUALLY inserted, not attempted: under
    ``ON CONFLICT (lemma) DO NOTHING`` a duplicate lemma is silently skipped and must
    not be counted. ``cursor.rowcount`` is unreliable here — ``execute_values`` pages
    the VALUES list internally, so ``rowcount`` reflects only the last page — so the
    SQL is given a ``RETURNING lemma`` and ``fetch=True``, which collects the returned
    (= genuinely inserted) rows across all pages; their length is the true count.
    """
    if not rows:
        return 0
    insert_sql = f"""
        INSERT INTO {CEFR_TABLE} (lemma, level, source, closed_class)
        VALUES %s
        ON CONFLICT (lemma) DO NOTHING
        RETURNING lemma
    """
    batch: list[tuple] = []
    inserted = 0
    for row in rows:
        batch.append(
            (row["lemma"], row["level"], row["source"], bool(row.get("closed_class", False)))
        )
        if len(batch) >= BATCH_SIZE:
            returned = psycopg2.extras.execute_values(cursor, insert_sql, batch, fetch=True)
            inserted += len(returned)
            batch = []
    if batch:
        returned = psycopg2.extras.execute_values(cursor, insert_sql, batch, fetch=True)
        inserted += len(returned)
    return inserted


def _insert_review_rows(cursor: psycopg2.extensions.cursor, rows: list[dict]) -> int:
    """Batch-insert quarantined rows into ``reference.cefr_lemma_review``. Returns count."""
    if not rows:
        return 0
    insert_sql = f"""
        INSERT INTO {REVIEW_TABLE} (raw_lemma, normalized_lemma, level, source, reason)
        VALUES %s
    """
    batch: list[tuple] = []
    inserted = 0
    for row in rows:
        batch.append(
            (
                row["raw_lemma"],
                row.get("normalized_lemma"),
                row.get("level"),
                row.get("source"),
                row["reason"],
            )
        )
        if len(batch) >= BATCH_SIZE:
            psycopg2.extras.execute_values(cursor, insert_sql, batch)
            inserted += len(batch)
            batch = []
    if batch:
        psycopg2.extras.execute_values(cursor, insert_sql, batch)
        inserted += len(batch)
    return inserted


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


def load_data(
    source: str,
    normalize: NormalizeFn | None = None,
    force: bool = False,
    *,
    include_closed_class: bool = False,
) -> None:
    """Load CEFR candidate lemmas from ``source`` into ``reference.cefr_lemma``.

    Args:
        source: Path to a file or directory of ``lemma, level, source`` candidate rows.
        normalize: Injected ``(word) -> NormalizedLemma`` callable. ``None`` (the
            default) is lazily resolved to the production spaCy entry point on first
            real use — see :func:`_resolve_normalize`.
        force: When True, DELETE both ``cefr_lemma`` and ``cefr_lemma_review`` before
            inserting (D-FORCE-TRUNCATES-REVIEW).
        include_closed_class: When True (only the real backfill / ``main()`` sets
            this), fold ``build_closed_class_rows()`` in as an extra source layer.
            Closed-class rows bypass normalization and attestation (AC-15). Defaults
            to False so the deterministic unit suite drives a pure ``--source``-only
            path.
    """
    start = time.time()

    # 1. Parse the runtime --source corpus.
    raw_rows = _parse_source(source)

    # 2. Optionally fold in the curated closed-class whitelist as a source layer.
    if include_closed_class:
        from src.scripts.cefr_closed_class import build_closed_class_rows  # noqa: PLC0415

        raw_rows = raw_rows + build_closed_class_rows()

    read_by_source: Counter = Counter(r.get("source", "") for r in raw_rows)
    total_read = len(raw_rows)

    # 3. Collapse to one canonical row per lemma by source precedence.
    merged_rows = merge_by_precedence(raw_rows)
    deduped = total_read - len(merged_rows)

    # 4. Partition: closed-class rows bypass normalize + attest (AC-15); the rest
    #    flow through the normalize → attest pipeline.
    closed_rows = [r for r in merged_rows if r.get("closed_class")]
    open_rows = [r for r in merged_rows if not r.get("closed_class")]

    if normalize is None:
        normalize = _resolve_normalize()

    main_rows: list[dict] = list(closed_rows)  # closed-class go straight to main
    review_rows: list[dict] = []
    normalized_count = 0

    # 5. Normalize each open-class candidate (loader does lower() + NFC first).
    pending_attest: list[dict] = []  # rows that normalized OK, awaiting attestation
    for row in open_rows:
        raw_candidate = row["lemma"]
        nfc_word = unicodedata.normalize("NFC", raw_candidate.lower())
        result = normalize(nfc_word)

        if result.confidence == 0.0:
            # D-NORMFAIL-CRITERION: failure is confidence == 0.0, NOT empty lemma.
            review_rows.append(
                {
                    "raw_lemma": raw_candidate,
                    "normalized_lemma": result.lemma,
                    "level": row["level"],
                    "source": row["source"],
                    "reason": "normalization_failed",
                }
            )
            continue

        normalized_count += 1
        pending_attest.append(
            {
                "raw_lemma": raw_candidate,
                "lemma": result.lemma,
                "level": row["level"],
                "source": row["source"],
                "closed_class": False,
            }
        )

    conn = _get_connection()
    try:
        with conn.cursor() as cursor:
            # 6. --force: DELETE BOTH tables BEFORE any insert (D-FORCE-TRUNCATES-REVIEW).
            if force:
                logger.warning(f"--force: deleting all rows from {CEFR_TABLE} and {REVIEW_TABLE}")
                cursor.execute(f"DELETE FROM {CEFR_TABLE}")
                cursor.execute(f"DELETE FROM {REVIEW_TABLE}")

            # 7. Attestation for the normalized open-class lemmas.
            attested = _attest({r["lemma"] for r in pending_attest}, cursor)
            for row in pending_attest:
                if row["lemma"] in attested:
                    main_rows.append(row)
                else:
                    review_rows.append(
                        {
                            "raw_lemma": row["raw_lemma"],
                            "normalized_lemma": row["lemma"],
                            "level": row["level"],
                            "source": row["source"],
                            "reason": "not_attested",
                        }
                    )

            # 8. Batch insert survivors and review rows.
            inserted = _insert_main_rows(cursor, main_rows)
            reviewed = _insert_review_rows(cursor, review_rows)
            conn.commit()

            # 9. Per-source summary (AC-16).
            _log_summary(
                duration=time.time() - start,
                total_read=total_read,
                read_by_source=read_by_source,
                normalized=normalized_count,
                inserted=inserted,
                reviewed=reviewed,
                deduped=deduped,
                closed_class=len(closed_rows),
            )
    except psycopg2.Error as exc:
        conn.rollback()
        logger.error(f"Database error: {exc}")
        sys.exit(1)
    finally:
        conn.close()


def _log_summary(
    *,
    duration: float,
    total_read: int,
    read_by_source: Counter,
    normalized: int,
    inserted: int,
    reviewed: int,
    deduped: int,
    closed_class: int,
) -> None:
    """Emit the loguru import summary (AC-16)."""
    logger.info(f"CEFR lemma load finished in {duration:.1f}s")
    logger.info(f"  Rows read:                {total_read:,}")
    for src_name, count in sorted(read_by_source.items()):
        logger.info(f"    - {src_name or '(unknown)'}: {count:,}")
    logger.info(f"  Normalized (open-class):  {normalized:,}")
    logger.info(f"  Closed-class (forced A1): {closed_class:,}")
    logger.info(f"  Inserted → cefr_lemma:    {inserted:,}")
    logger.info(f"  Sent to review bucket:    {reviewed:,}")
    logger.info(f"  Deduped by precedence:    {deduped:,}")


def main(argv: list[str] | None = None) -> None:
    """CLI entry point. ``--source`` is required; ``--force`` is optional."""
    parser = argparse.ArgumentParser(
        description="Load CEFR introduction-level lemmas into reference.cefr_lemma"
    )
    parser.add_argument(
        "--source",
        required=True,
        help="Path to a file or directory of candidate 'lemma, level, source' rows",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="DELETE both cefr_lemma and cefr_lemma_review before reloading",
    )
    args = parser.parse_args(argv)
    # Real backfill seeds the curated closed-class function words (AC-15).
    load_data(source=args.source, force=args.force, include_closed_class=True)


if __name__ == "__main__":
    main()
