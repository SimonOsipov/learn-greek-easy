"""Export live deck contents into the CEFR loader's ``lemma, level, source`` CSV.

LEXGEN-04-05. This module is COMMITTED export code; its output CSV is **gitignored**
under ``data/cefr_lemma/`` (D-NOREPO-DATA / AC-INV-4) — it is generated at runtime
from the live application database and is never committed. It reads the live
``word_entries`` joined through ``deck_word_entries`` to ``decks`` and emits the
loader's ``lemma, level, source=deck_export`` rows, which feed
:mod:`src.scripts.load_cefr_lemma`'s ``--source`` as the ``deck_export`` layer.

Run with::

    poetry run python -m src.scripts.export_deck_lemmas \
        --out data/cefr_lemma/deck_export.csv

Level derivation (AC-4): ``level`` comes from the parent ``Deck.level``
(``DeckLevel`` enum A1/A2/B1/B2 @ ``db/models.py:55``). ``WordEntry`` has NO CEFR
column (dropped in migration ``20260208``); ``Deck.level`` is the only level signal.
When a lemma appears in decks of multiple levels, the **lowest** level wins
(cumulative-gate semantics) — resolved by :data:`LEVEL_ORDER`, never by a raw string
compare.

B2-only drop (F7 / D-B2-DROP-LOGGED / AC-16): a lemma whose lowest level is B2 is out
of v1's A1–B1 band and is DROPPED from the export — but the drop is **counted and
logged** in the export summary, never silent. B2 is a legitimate, expected drop (not
an error) → reported as a counted drop, NOT routed to the review bucket (review is
for normalization / attestation failures, not out-of-band-but-valid levels).

The lowest-wins reduction lives in the PURE :func:`resolve_deck_levels` (no DB), so it
is unit-testable in isolation; the SQL only fetches the raw ``(lemma, level)`` rows.
"""

from __future__ import annotations

import argparse
import csv
from collections import Counter
from pathlib import Path
from typing import Iterable

import psycopg2
import psycopg2.extensions
from loguru import logger

from src.config import settings

#: Provenance tag written to ``reference.cefr_lemma.source`` for every exported row.
SOURCE_TAG = "deck_export"

#: CEFR level ordering, lowest first. Used to pick the lowest level a lemma appears
#: at across its decks (cumulative-gate semantics) — an explicit rank map, never a
#: string compare. Mirrors ``DeckLevel`` (A1/A2/B1/B2 @ ``db/models.py:55``).
LEVEL_ORDER: dict[str, int] = {"A1": 0, "A2": 1, "B1": 2, "B2": 3}

#: The level that is out of v1's A1–B1 band: a lemma whose LOWEST level is this is
#: dropped from the export and counted (F7 / D-B2-DROP-LOGGED).
DROPPED_LEVEL = "B2"

#: Default I/O directory — the gitignored ``data/cefr_lemma/`` (AC-INV-4). The emitted
#: CSV lives here; this constant must never point under ``src/`` or ``tests/`` (those
#: are committed).
DEFAULT_DATA_DIR = Path("data/cefr_lemma")

#: Default output CSV path under the same gitignored directory.
DEFAULT_OUTPUT_PATH = DEFAULT_DATA_DIR / "deck_export.csv"

#: The JOIN that yields one ``(lemma, level)`` raw tuple per deck-membership. The
#: lowest-wins reduction is done in :func:`resolve_deck_levels` (Python), NOT in SQL,
#: so it stays unit-testable. ``d.level`` is a PG enum; psycopg2 returns it as ``str``.
_DECK_LEMMAS_SQL = """
    SELECT we.lemma, d.level
    FROM word_entries we
    JOIN deck_word_entries dwe ON we.id = dwe.word_entry_id
    JOIN decks d ON dwe.deck_id = d.id
"""


def _get_connection() -> psycopg2.extensions.connection:
    """Open a psycopg2 connection (mirrors load_cefr_lemma.py:84)."""
    return psycopg2.connect(settings.database_url_sync)


def resolve_deck_levels(rows: Iterable[tuple[str, str]]) -> tuple[list[dict], int]:
    """Collapse raw ``(lemma, deck_level)`` deck-memberships to one export row per lemma.

    For each lemma the LOWEST level across its decks wins (cumulative-gate semantics),
    ranked by :data:`LEVEL_ORDER` — A1 < A2 < B1 < B2. A lemma whose lowest level is
    ``B2`` is DROPPED from ``export_rows`` (out of v1's A1–B1 band) but its count is
    accumulated in the returned ``b2_dropped_count`` (F7 / D-B2-DROP-LOGGED / AC-16).

    Args:
        rows: Raw ``(lemma, deck_level)`` tuples — one per deck-membership; a lemma
            may repeat with different levels (one per deck it belongs to). ``deck_level``
            may be a plain string or a ``DeckLevel`` enum (psycopg2 returns the enum as
            a ``str``, but the ``.value`` is unwrapped defensively).

    Returns:
        ``(export_rows, b2_dropped_count)`` where ``export_rows`` is one dict per KEPT
        lemma ``{"lemma": <lemma>, "level": <lowest A1/A2/B1>, "source": "deck_export"}``
        in first-seen lemma order, and ``b2_dropped_count`` is the number of distinct
        lemmas whose lowest level was B2.

    Raises:
        ValueError: if a level is not one of A1/A2/B1/B2 — an unrecognised level is
            never silently bucketed or guessed.
    """
    lowest: dict[str, str] = {}
    order: list[str] = []

    for lemma, raw_level in rows:
        level = getattr(raw_level, "value", raw_level)
        if level not in LEVEL_ORDER:
            raise ValueError(
                f"Unrecognised deck level {level!r} for lemma {lemma!r}; "
                f"expected one of {sorted(LEVEL_ORDER)}"
            )
        if lemma not in lowest:
            order.append(lemma)
            lowest[lemma] = level
        elif LEVEL_ORDER[level] < LEVEL_ORDER[lowest[lemma]]:
            lowest[lemma] = level

    export_rows: list[dict] = []
    b2_dropped_count = 0
    for lemma in order:
        level = lowest[lemma]
        if level == DROPPED_LEVEL:
            b2_dropped_count += 1
            continue
        export_rows.append({"lemma": lemma, "level": level, "source": SOURCE_TAG})

    return export_rows, b2_dropped_count


def export_deck_lemmas(
    out_path: str | Path,
    conn: psycopg2.extensions.connection | None = None,
) -> dict:
    """Export the live deck contents to ``out_path`` as ``lemma,level,source`` CSV.

    Runs :data:`_DECK_LEMMAS_SQL` (read-only), reduces the raw rows via
    :func:`resolve_deck_levels` (lowest-wins, B2-only dropped + counted), writes the
    kept rows to ``out_path``, and returns a summary dict (AC-16).

    Args:
        out_path: Destination CSV path (the parent dir is created if missing).
        conn: An open psycopg2 connection to reuse (tests inject a mock). When ``None``
            a connection is opened via :func:`_get_connection` and closed before return;
            an injected connection is left open for the caller to manage.

    Returns:
        A summary dict: ``{"rows_read", "exported", "b2_dropped", "by_level",
        "out_path"}``.
    """
    opened = conn is None
    if conn is None:
        conn = _get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(_DECK_LEMMAS_SQL)
            raw_rows = cursor.fetchall()
    finally:
        if opened:
            conn.close()

    export_rows, b2_dropped = resolve_deck_levels(raw_rows)
    by_level: Counter = Counter(row["level"] for row in export_rows)

    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=["lemma", "level", "source"])
        writer.writeheader()
        writer.writerows(export_rows)

    return {
        "rows_read": len(raw_rows),
        "exported": len(export_rows),
        "b2_dropped": b2_dropped,
        "by_level": dict(by_level),
        "out_path": str(out),
    }


def _log_summary(summary: dict) -> None:
    """Emit the loguru export summary (AC-16). The B2 drop is LOGGED, never silent."""
    # Log the basename only, never the full path — an operator-supplied --out path can
    # embed a home-dir username (PII). The filename alone is the useful signal.
    logger.info(f"Deck-export finished → {Path(summary['out_path']).name}")
    logger.info(f"  Deck-memberships read:    {summary['rows_read']:,}")
    logger.info(f"  Exported (A1–B1):         {summary['exported']:,}")
    for level in ("A1", "A2", "B1"):
        logger.info(f"    - {level}: {summary['by_level'].get(level, 0):,}")
    logger.info(f"  B2-only dropped (counted): {summary['b2_dropped']:,}")


def main(argv: list[str] | None = None) -> None:
    """CLI entry point. ``--out`` defaults to the gitignored :data:`DEFAULT_OUTPUT_PATH`."""
    parser = argparse.ArgumentParser(
        description=(
            "Export live deck contents (word_entries → deck_word_entries → decks) into "
            "the CEFR loader's 'lemma, level, source=deck_export' CSV"
        )
    )
    parser.add_argument(
        "--out",
        default=str(DEFAULT_OUTPUT_PATH),
        help=(
            "Destination CSV path (default: the gitignored "
            f"{DEFAULT_OUTPUT_PATH}); feeds load_cefr_lemma's --source"
        ),
    )
    args = parser.parse_args(argv)

    summary = export_deck_lemmas(args.out)
    _log_summary(summary)


if __name__ == "__main__":
    main()
