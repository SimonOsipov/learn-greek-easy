"""Load wordfreq frequency ranks into ``reference.frequency_rank`` (LEXGEN-05-02).

Run with::

    poetry run python -m src.scripts.load_frequency_rank [--force] [--limit N]

Pipeline (D1 / D3 decisions from the LEXGEN-05 architect spec):

1. Surface tokens are read from ``wordfreq.iter_wordlist("el")`` (lazy, via
   :func:`_resolve_word_source`). A ``--limit N`` cap is applied to bound run-time.

2. Each token is normalised: ``lower()`` → ``NFC`` → :func:`_final_sigma_unfold`
   → injected ``normalize`` callable (defaults to the spaCy entry point via
   :func:`_resolve_normalize`). Tokens whose ``normalize()`` returns
   ``confidence == 0.0`` are **silently dropped** (D4 drop criterion — identical
   to ``load_cefr_lemma.py:408``). There is NO review bucket.

3. Surviving ``(lemma, frequency)`` pairs are aggregated by :func:`aggregate_by_lemma`
   (sum per lemma) and ranked by :func:`dense_rank` (descending frequency;
   ties broken by lemma string ascending).

4. All lemmas are inserted into ``reference.frequency_rank`` without any
   attestation check (D-NO-ATTEST, verified by test 6).

5. ``--force`` deletes ``reference.frequency_rank`` before inserting.

Both lazy-resolve seams (:func:`_resolve_normalize` and :func:`_resolve_word_source`)
live INSIDE their functions, NOT at module top-level, so importing this module
never triggers wordfreq or spaCy (D4 lazy-import rule).
"""

from __future__ import annotations

import argparse
import sys
import unicodedata
from collections import defaultdict
from typing import Callable, Iterable

import psycopg2
import psycopg2.extensions
import psycopg2.extras
from loguru import logger

from src.config import settings
from src.schemas.nlp import NormalizedLemma

FREQUENCY_TABLE = "reference.frequency_rank"
SOURCE = "wordfreq"
BATCH_SIZE = 10_000

#: A type alias for the injected normalization callable (word -> NormalizedLemma).
NormalizeFn = Callable[[str], NormalizedLemma]

#: A type alias for the injected word-source callable (() -> iterable of (token, freq)).
WordSourceFn = Callable[[], Iterable[tuple[str, float]]]


def _get_connection() -> psycopg2.extensions.connection:
    """Open a psycopg2 connection (mirrors load_cefr_lemma.py:90)."""
    return psycopg2.connect(settings.database_url_sync)


def _resolve_normalize() -> NormalizeFn:
    """Lazily resolve the production normalization entry point.

    The ``from src.services...`` import lives HERE, inside the resolver, NOT at
    module top-level (D4): importing this module must never trigger the real
    spaCy import, because the scripts conftest does not MagicMock spaCy and
    the real import can raise ``ConfigError``. Unit tests always inject a mock
    ``normalize`` so this resolver is reached only at real runtime.
    """
    from src.services.lemma_normalization_service import (  # noqa: PLC0415
        get_lemma_normalization_service,
    )

    return get_lemma_normalization_service().normalize


def _resolve_word_source() -> WordSourceFn:
    """Lazily resolve the wordfreq word-source callable.

    ``import wordfreq`` lives HERE so that importing this module never
    triggers the wordfreq import (D4 lazy-import rule). Returns a zero-arg
    callable that yields ``(token, frequency)`` pairs for the Greek wordlist.
    """
    import wordfreq  # noqa: PLC0415

    def _source() -> Iterable[tuple[str, float]]:
        for token in wordfreq.iter_wordlist("el"):
            yield token, wordfreq.word_frequency(token, "el")

    return _source


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------


def _final_sigma_unfold(token: str) -> str:
    """Replace a word-final medial sigma (σ) with the correct final sigma (ς).

    Some corpora (including wordfreq) emit surface tokens where the last
    character is σ rather than ς. This one-character substitution fixes that
    before the token is passed to the spaCy lemmatiser.

    Only the LAST character is touched; interior σ characters are left as-is.
    """
    if token and token[-1] == "σ":
        return token[:-1] + "ς"
    return token


def _surface_to_lemma(token: str, normalize: NormalizeFn) -> str | None:
    """Normalise a surface token to its canonical lemma, or return None.

    Pipeline: ``lower()`` → ``NFC`` → :func:`_final_sigma_unfold` → ``normalize``.

    Returns ``None`` when ``normalize`` reports ``confidence == 0.0`` (the
    D4 drop criterion, identical to ``load_cefr_lemma.py:408``).
    """
    unfolded = _final_sigma_unfold(unicodedata.normalize("NFC", token.lower()))
    result = normalize(unfolded)
    if result.confidence == 0.0:
        return None
    return result.lemma


def aggregate_by_lemma(lemma_freq_pairs: list[tuple[str, float]]) -> dict[str, float]:
    """Sum wordfreq frequencies by lemma key.

    Pure function — no DB, no I/O.

    Args:
        lemma_freq_pairs: List of ``(lemma, frequency)`` pairs where the same
            lemma may appear multiple times (several surface forms mapping to
            the same lemma).

    Returns:
        Dict mapping each unique lemma to the sum of all its surface frequencies.
    """
    totals: dict[str, float] = defaultdict(float)
    for lemma, freq in lemma_freq_pairs:
        totals[lemma] += freq
    return dict(totals)


def dense_rank(freq_by_lemma: dict[str, float]) -> list[tuple[str, int]]:
    """Assign dense integer ranks (1..N) to lemmas ordered by descending frequency.

    Ties are broken by lemma string ascending (lexicographic). Every call with
    the same input produces identical output (deterministic).

    Pure function — no DB, no I/O.

    Args:
        freq_by_lemma: Dict mapping lemma → aggregated frequency.

    Returns:
        List of ``(lemma, rank)`` tuples, sorted descending by frequency
        (rank 1 = most frequent). Ranks are consecutive integers starting at 1.
    """
    sorted_items = sorted(freq_by_lemma.items(), key=lambda kv: (-kv[1], kv[0]))
    return [(lemma, rank) for rank, (lemma, _) in enumerate(sorted_items, start=1)]


# ---------------------------------------------------------------------------
# DB write helpers (extracted to keep load_data complexity ≤ 10)
# ---------------------------------------------------------------------------


def _insert_ranked_rows(
    cursor: psycopg2.extensions.cursor,
    ranked: list[tuple[str, int]],
) -> int:
    """Batch-INSERT ``(lemma, rank, source)`` rows. Returns count actually inserted.

    Uses ``ON CONFLICT (lemma) DO NOTHING RETURNING lemma`` so that duplicate
    lemmas are silently skipped and the true inserted count is the length of
    the RETURNING result set (mirrors ``load_cefr_lemma._insert_main_rows``).
    """
    if not ranked:
        return 0
    insert_sql = (
        f"INSERT INTO {FREQUENCY_TABLE} (lemma, rank, source) VALUES %s"
        f" ON CONFLICT (lemma) DO NOTHING RETURNING lemma"
    )
    batch: list[tuple[str, int, str]] = []
    inserted = 0
    for lemma, rank in ranked:
        batch.append((lemma, rank, SOURCE))
        if len(batch) >= BATCH_SIZE:
            returned = psycopg2.extras.execute_values(cursor, insert_sql, batch, fetch=True)
            inserted += len(returned)
            batch = []
    if batch:
        returned = psycopg2.extras.execute_values(cursor, insert_sql, batch, fetch=True)
        inserted += len(returned)
    return inserted


def _normalise_tokens(
    raw_items: list[tuple[str, float]],
    normalize: NormalizeFn,
) -> tuple[list[tuple[str, float]], int]:
    """Map surface tokens to lemmas, dropping confidence==0.0 tokens.

    Returns:
        Tuple of (lemma_freq_pairs, dropped_count).
    """
    pairs: list[tuple[str, float]] = []
    dropped = 0
    for token, freq in raw_items:
        lemma = _surface_to_lemma(token, normalize)
        if lemma is None:
            dropped += 1
            continue
        pairs.append((lemma, freq))
    return pairs, dropped


# ---------------------------------------------------------------------------
# Main loader
# ---------------------------------------------------------------------------


def load_data(
    *,
    normalize: NormalizeFn | None = None,
    word_source: WordSourceFn | None = None,
    force: bool = False,
    limit: int | None = None,
) -> None:
    """Load wordfreq frequency ranks into ``reference.frequency_rank``.

    Args:
        normalize: Injected ``(word) -> NormalizedLemma`` callable. ``None``
            (the default) is lazily resolved to the production spaCy entry
            point on first real use — see :func:`_resolve_normalize`.
        word_source: Injected ``() -> Iterable[(token, freq)]`` callable.
            ``None`` (the default) is lazily resolved to the wordfreq Greek
            wordlist — see :func:`_resolve_word_source`.
        force: When True, DELETE ``reference.frequency_rank`` before inserting.
        limit: When set, cap the number of surface tokens read from
            ``word_source`` to this many (applied BEFORE normalisation;
            does NOT guarantee exactly ``limit`` inserted rows because some
            tokens may be dropped by the confidence==0.0 criterion).
    """
    if normalize is None:
        normalize = _resolve_normalize()
    if word_source is None:
        word_source = _resolve_word_source()

    # 1. Read surface tokens, applying limit.
    raw_items: list[tuple[str, float]] = []
    for i, (token, freq) in enumerate(word_source()):
        if limit is not None and i >= limit:
            break
        raw_items.append((token, freq))

    surface_count = len(raw_items)

    # 2. Normalise surface tokens → lemma; drop confidence==0.0 tokens.
    lemma_freq_pairs, dropped = _normalise_tokens(raw_items, normalize)

    # 3. Aggregate frequencies by lemma and compute dense ranks.
    ranked = dense_rank(aggregate_by_lemma(lemma_freq_pairs))
    total_lemmas = len(ranked)

    if not ranked:
        logger.warning("No lemmas to insert after normalisation — aborting.")
        return

    # 4. Open DB connection and write.
    conn = _get_connection()
    try:
        with conn.cursor() as cursor:
            if force:
                logger.warning(f"--force: deleting all rows from {FREQUENCY_TABLE}")
                cursor.execute(f"DELETE FROM {FREQUENCY_TABLE}")
            inserted = _insert_ranked_rows(cursor, ranked)

        conn.commit()

        # 5. Summary logging.
        max_rank = ranked[-1][1] if ranked else 0
        logger.info(f"Frequency rank load finished — source={SOURCE!r}")
        logger.info(f"  Surface tokens read:    {surface_count:,}")
        logger.info(f"  Dropped (confidence=0): {dropped:,}")
        logger.info(f"  Lemmas after agg:       {total_lemmas:,}")
        logger.info(f"  Rank range:             1 – {max_rank:,}")
        logger.info(f"  Inserted:               {inserted:,}")

    except psycopg2.Error as exc:
        conn.rollback()
        logger.error(f"Database error: {exc}")
        sys.exit(1)
    finally:
        conn.close()


def main(argv: list[str] | None = None) -> None:
    """CLI entry point. ``--force`` and ``--limit`` are optional."""
    parser = argparse.ArgumentParser(
        description="Load wordfreq frequency ranks into reference.frequency_rank"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="DELETE reference.frequency_rank before reloading",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Cap the number of surface tokens read from wordfreq (for testing/smoke runs)",
    )
    args = parser.parse_args(argv)
    load_data(force=args.force, limit=args.limit)


if __name__ == "__main__":
    main()
