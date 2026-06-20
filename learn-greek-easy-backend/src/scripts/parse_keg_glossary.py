"""Parse ΚΕΓ ΚΛΙΚ glossary PDFs into the CEFR loader's ``lemma, level, source`` CSV.

LEXGEN-04-04. This module is COMMITTED parser code; its input PDFs and output CSV
are **gitignored** under ``data/cefr_lemma/`` (D-NOREPO-DATA / AC-INV-4). The real
ΚΕΓ ΚΛΙΚ glossaries (``KLIK_A1_Ef_Glossary.pdf`` / ``KLIK_A2_Ef_Glossary.pdf`` /
``KLIK_B1_Glossary.pdf`` / ``KLIK_B2_Glossary.pdf``) are © ΚΕΓ, operator-supplied
under written permission, used on an internal allow-list only, and are NEVER
redistributed or committed. The unit suite exercises this code against a tiny
**synthetic** fixture (``tests/fixtures/cefr/keg_glossary_sample.txt``) that mimics
the glossary line format — NOT real ΚΕΓ data.

Pipeline::

    poetry run python -m src.scripts.parse_keg_glossary \
        --source data/cefr_lemma/ --out data/cefr_lemma/keg_glossary.csv

Each ΚΛΙΚ glossary line is roughly ``<lemma>, <article> = <english>`` — e.g.
``σπίτι, το = house``. The lemma is the text BEFORE the first comma (the article
after the comma encodes gender, which the CEFR reference does not need). The
``level`` (A1/A2/B1/B2) comes from the **source filename**, NOT from any per-line
field (:func:`level_from_filename`).

Malformed handling (F5 / D-MALFORMED-VERBATIM): a structurally unparseable line —
one with no extractable lemma (no comma, an empty lemma before the comma, a page
header such as ``=== page 3 ===``) — is captured **verbatim** with its source label
and **flagged** for the loader's review bucket. The parser NEVER silently drops a
line and NEVER guesses a lemma or a level.

PDF reading is intentionally NOT a committed dependency. :func:`parse_glossary_pdf`
lazily imports ``pypdf`` only when an operator actually runs the PDF parse; the
committed module and its unit tests stay dependency-free.
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path
from typing import Iterable

from loguru import logger

#: Provenance tag written to ``reference.cefr_lemma.source`` for every parsed row.
SOURCE_TAG = "keg_glossary"

#: Reason recorded on every flagged (malformed / unparseable) line.
MALFORMED_REASON = "malformed"

#: Default I/O directory — the gitignored ``data/cefr_lemma/`` (AC-INV-4). Both the
#: operator-supplied ΚΛΙΚ PDFs and the emitted CSV live here; this constant must
#: never point under ``src/`` or ``tests/`` (those are committed).
DEFAULT_DATA_DIR = Path("data/cefr_lemma")

#: Default output CSV path under the same gitignored directory.
DEFAULT_OUTPUT_PATH = DEFAULT_DATA_DIR / "keg_glossary.csv"

#: Maps a KLIK filename prefix to its CEFR level. The level comes from the
#: FILENAME, not any per-line field.
_FILENAME_LEVELS: tuple[tuple[str, str], ...] = (
    ("KLIK_A1", "A1"),
    ("KLIK_A2", "A2"),
    ("KLIK_B1", "B1"),
    ("KLIK_B2", "B2"),
)


def level_from_filename(filename: str) -> str:
    """Derive the CEFR level (A1/A2/B1/B2) from a ΚΛΙΚ glossary filename.

    ``KLIK_A1_*`` → ``"A1"``, ``KLIK_A2_*`` → ``"A2"``, ``KLIK_B1_*`` → ``"B1"``,
    ``KLIK_B2_*`` → ``"B2"`` (case-insensitive on the ``KLIK_xx`` prefix). The level
    comes from the filename, never from a per-line field (F5).

    Raises:
        ValueError: if the filename carries no recognised ``KLIK_xx`` prefix — the
            parser never guesses a level for an unrecognised source file.
    """
    name = Path(filename).name.upper()
    for prefix, level in _FILENAME_LEVELS:
        if name.startswith(prefix):
            return level
    raise ValueError(
        f"Cannot derive CEFR level from filename {filename!r}: "
        "expected a KLIK_A1 / KLIK_A2 / KLIK_B1 / KLIK_B2 prefix."
    )


def parse_glossary_lines(
    lines: Iterable[str], level: str
) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    """Parse pre-extracted glossary text lines into ``(rows, flagged)``.

    Pure core — no PDF, no filesystem, no DB. The caller has already extracted the
    raw text lines and derived ``level`` from the source filename.

    Args:
        lines: Raw glossary text lines (one ΚΛΙΚ entry per line, plus any extraction
            noise such as page headers or blank lines).
        level: The CEFR level for this source file (e.g. ``"A1"``), already derived
            from the filename by the caller.

    Returns:
        A ``(rows, flagged)`` tuple of two lists of dicts:

        * **rows** — one dict ``{"lemma", "level", "source"}`` per well-formed line.
          *Well-formed* means a comma-separated ``<lemma>, <rest>`` line with a
          non-empty lemma before the first comma. The lemma is that text, stripped
          and lowercased; the article / gloss after the comma is ignored.
        * **flagged** — one dict ``{"raw", "level", "source", "reason"}`` per
          malformed / unparseable line (no comma, or an empty lemma before the
          comma — e.g. page headers, ``", = "``). The original line is preserved
          **verbatim** in ``raw``; the parser never guesses a lemma (F5).

        Truly blank / whitespace-only lines are SKIPPED — they appear in neither
        list (PDF text extraction emits blank lines between entries; they carry no
        lemma to flag and are not ΚΛΙΚ content). The RED tests never pass a blank
        line, so the asserted invariant ``len(rows) + len(flagged) == len(input)``
        holds by construction for them; production blank-skip is an intentional,
        un-tested branch.
    """
    rows: list[dict[str, str]] = []
    flagged: list[dict[str, str]] = []

    for line in lines:
        # Skip truly blank / whitespace-only lines (extraction noise, not content).
        if not line.strip():
            continue

        lemma = ""
        if "," in line:
            # Lemma = text before the FIRST comma; the article/gloss live after it.
            lemma = line.split(",", 1)[0].strip().lower()

        if lemma:
            rows.append({"lemma": lemma, "level": level, "source": SOURCE_TAG})
        else:
            # Malformed: no comma, or an empty lemma before the comma. Capture the
            # line VERBATIM and flag it — never dropped, never guessed (F5).
            flagged.append(
                {
                    "raw": line,
                    "level": level,
                    "source": SOURCE_TAG,
                    "reason": MALFORMED_REASON,
                }
            )

    return rows, flagged


def parse_glossary_pdf(path: Path) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    """Read a single ΚΛΙΚ glossary PDF and parse it into ``(rows, flagged)``.

    Thin wrapper: derives ``level`` from the filename via :func:`level_from_filename`,
    extracts the PDF's text lines, then delegates to :func:`parse_glossary_lines`.

    PDF reading uses ``pypdf``, which is **not** a committed dependency — it is
    imported lazily here so the committed module and its unit tests stay
    dependency-free. Only the operator who runs the real PDF parse needs it locally.

    Raises:
        RuntimeError: if ``pypdf`` is not installed in the operator's environment.
        ValueError: if the filename carries no recognised ``KLIK_xx`` level prefix.
    """
    try:
        from pypdf import PdfReader  # noqa: PLC0415 — lazy operator-only dependency
    except ImportError as exc:  # pragma: no cover — operator-environment guard
        raise RuntimeError(
            "parse_glossary_pdf requires 'pypdf' — run 'pip install pypdf' in your "
            "operator environment. It is intentionally NOT a committed dependency "
            "(this is a one-time operator-only tool)."
        ) from exc

    path = Path(path)
    level = level_from_filename(path.name)

    reader = PdfReader(str(path))
    lines: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        lines.extend(text.splitlines())

    return parse_glossary_lines(lines, level)


def _iter_pdf_paths(source: Path) -> list[Path]:
    """Resolve ``--source`` (a directory or a single PDF) to a sorted PDF list.

    The directory scan is case-insensitive on the extension: ``*.pdf`` and ``*.PDF``
    (and mixed-case like ``.Pdf``) are all matched. ``Path.glob`` is case-sensitive on
    case-sensitive filesystems, so a single ``*.pdf`` glob would silently skip
    uppercase-suffixed PDFs — instead we filter by ``suffix.lower() == ".pdf"``.
    """
    if source.is_dir():
        return sorted(p for p in source.iterdir() if p.is_file() and p.suffix.lower() == ".pdf")
    return [source]


def _write_rows_csv(out_path: Path, rows: list[dict[str, str]]) -> None:
    """Write the well-formed rows as a ``lemma, level, source`` CSV (loader input)."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=["lemma", "level", "source"])
        writer.writeheader()
        writer.writerows(rows)


def _write_flagged_csv(flagged_path: Path, flagged: list[dict[str, str]]) -> None:
    """Write the flagged malformed lines to a sidecar so they stay visible.

    The malformed lines are NEVER silently dropped: they are emitted verbatim with
    their source label and reason for the operator to review. The sidecar is given a
    ``.flagged.review`` extension (NOT ``.csv`` / ``.jsonl``) precisely so the 04-03
    loader's directory glob — which consumes only ``*.csv`` / ``*.jsonl`` source
    files — never auto-ingests this review artifact (AC-5: flagged lines are surfaced
    for review, not silently re-imported). Its content is still CSV-formatted so an
    operator can open it directly.
    """
    flagged_path.parent.mkdir(parents=True, exist_ok=True)
    with flagged_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=["raw", "level", "source", "reason"])
        writer.writeheader()
        writer.writerows(flagged)


def main(argv: list[str] | None = None) -> None:
    """CLI entry point. Reads ΚΛΙΚ PDF(s) and emits the loader's CSV + flagged sidecar.

    ``--source`` defaults to the gitignored ``data/cefr_lemma/`` directory (a dir of
    KLIK PDFs or a single PDF); ``--out`` defaults to ``data/cefr_lemma/keg_glossary.csv``.
    The flagged malformed lines are written to ``<out>.flagged.review`` so they are
    never silently dropped (and never auto-ingested by the 04-03 loader's glob).
    """
    parser = argparse.ArgumentParser(
        description="Parse ΚΕΓ ΚΛΙΚ glossary PDFs into the CEFR loader's lemma,level,source CSV"
    )
    parser.add_argument(
        "--source",
        default=str(DEFAULT_DATA_DIR),
        help="A KLIK glossary PDF or a directory of them (default: data/cefr_lemma/)",
    )
    parser.add_argument(
        "--out",
        default=str(DEFAULT_OUTPUT_PATH),
        help="Output CSV path for the parsed rows (default: data/cefr_lemma/keg_glossary.csv)",
    )
    args = parser.parse_args(argv)

    source = Path(args.source)
    out_path = Path(args.out)
    # ``.flagged.review`` (NOT .csv/.jsonl) so the 04-03 loader's source glob skips it.
    flagged_path = out_path.with_suffix(out_path.suffix + ".flagged.review")

    all_rows: list[dict[str, str]] = []
    all_flagged: list[dict[str, str]] = []

    for pdf_path in _iter_pdf_paths(source):
        rows, flagged = parse_glossary_pdf(pdf_path)
        all_rows.extend(rows)
        all_flagged.extend(flagged)
        level = rows[0]["level"] if rows else (flagged[0]["level"] if flagged else "?")
        logger.info(
            f"  {pdf_path.name} (level {level}): " f"{len(rows):,} rows, {len(flagged):,} flagged"
        )

    _write_rows_csv(out_path, all_rows)
    _write_flagged_csv(flagged_path, all_flagged)

    # Log basenames only, never full paths — an operator-supplied --out path can embed
    # a home-dir username (PII). The filename alone is the useful signal.
    logger.info(f"KEG glossary parse finished: {len(all_rows):,} rows → {out_path.name}")
    logger.info(f"  Flagged (malformed) lines: {len(all_flagged):,} → {flagged_path.name}")


if __name__ == "__main__":
    main()
