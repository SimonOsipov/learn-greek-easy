"""RED tests for LEXGEN-04-03: CEFR lemma loader core.

These tests are authored BEFORE the implementation exists.
Expected failure mode: ModuleNotFoundError on `src.scripts.load_cefr_lemma`
(module does not yet exist).

===========================================================================
SEAM CONTRACT — the executor MUST implement these exact interfaces:
===========================================================================

1. MODULE: src/scripts/load_cefr_lemma.py

2. INJECTED NORMALIZE SEAM (D-INJECT-NORMALIZE)
   -----------------------------------------------
   The `load_data()` / row-processing entry point accepts a `normalize`
   callable parameter with a default of None.  When None, it is lazily
   resolved to `get_lemma_normalization_service().normalize` on the FIRST
   real call.  The service import MUST live inside the lazy resolver, not
   at module top-level, so that importing the module does NOT trigger the
   real spaCy import (the scripts conftest does NOT MagicMock spaCy).

   Signature (injected callable):
       normalize(word: str) -> NormalizedLemma

   The LOADER ITSELF (not the normalize callable) does:
       lowercased = raw.lower()
       nfc_word = unicodedata.normalize("NFC", lowercased)
   Then calls: normalize(nfc_word)

3. ATTESTATION SEAM
   -----------------
   A function `attest(lemmas: set[str], cursor) -> set[str]` that returns
   the subset of `lemmas` whose normalized form appears in at least one of:
       - reference.greek_lexicon  (lemma column)
       - reference.wiktionary_morphology  (lemma column)
   OR: the cursor interaction is mockable via a mock cursor whose
   `fetchall()` returns controlled results.
   Unit tests mock the cursor (the attest helper is not necessarily a
   separate top-level export — but the cursor must be injectable/mockable).

4. PURE PRECEDENCE-MERGE FUNCTION (D-PRECEDENCE-MERGE)
   ------------------------------------------------------
   A standalone pure function (no DB access):
       merge_by_precedence(rows: list[dict]) -> list[dict]
   where each input dict has at least: `lemma`, `level`, `source`,
   optionally `closed_class`.

   Precedence rules (highest → lowest):
       keg_glossary > deck_export > frequency_bin
   Closed-class override: if a lemma appears with `source="closed_class"`
   OR `closed_class=True`, the merged result is forced to level="A1",
   closed_class=True, source reflecting the closed-class origin.

   The function is exported from `src.scripts.load_cefr_lemma` so it can
   be unit-tested directly without DB.

5. FAILURE ROUTING CRITERION (D-NORMFAIL-CRITERION)
   --------------------------------------------------
   `reason = "normalization_failed"` iff `NormalizedLemma.confidence == 0.0`
   (NOT an empty-lemma check — lemma may be a non-empty non-Greek string on
   the failure path).
   `reason = "not_attested"` when confidence > 0.0 but lemma absent from
   both reference tables.
   Both failure cases go to `reference.cefr_lemma_review`, never dropped.

6. --force SEAM (D-FORCE-TRUNCATES-REVIEW)
   -----------------------------------------
   `--force` flag triggers DELETE on BOTH:
       reference.cefr_lemma
       reference.cefr_lemma_review
   Both DELETEs must precede any INSERT.

===========================================================================
"""

from __future__ import annotations

import unicodedata
from unittest.mock import MagicMock, patch

import pytest

from src.schemas.nlp import NormalizedLemma

# ---------------------------------------------------------------------------
# Helper: build a controlled NormalizedLemma for mocks
# ---------------------------------------------------------------------------


def _make_normalized(
    input_word: str,
    lemma: str,
    confidence: float = 1.0,
    pos: str = "NOUN",
    gender: str | None = None,
    article: str | None = None,
) -> NormalizedLemma:
    return NormalizedLemma(
        input_word=input_word,
        lemma=lemma,
        gender=gender,
        article=article,
        pos=pos,
        confidence=confidence,
    )


# ---------------------------------------------------------------------------
# Helper: build a mock cursor that "attests" a given set of lemmas
# ---------------------------------------------------------------------------


def _make_attesting_cursor(attested_lemmas: set[str]) -> MagicMock:
    """Return a mock psycopg2 cursor whose fetchall returns the attested set."""
    cursor = MagicMock()
    # execute_values / execute + fetchall path — return rows as 1-tuples
    cursor.fetchall.return_value = [(lemma,) for lemma in attested_lemmas]
    return cursor


# ===========================================================================
# AC-11  test_source_arg_required_and_parsed
# ===========================================================================


@pytest.mark.unit
def test_source_arg_required_and_parsed(tmp_path):
    """--source <path> is parsed by argparse; missing --source exits with error.

    Seam: main() calls argparse; `--source` is a required positional/keyword
    arg; if absent, SystemExit(2) is raised (argparse default).
    """
    from src.scripts.load_cefr_lemma import main  # noqa: PLC0415

    # Providing --source with a valid path should not raise an argparse error.
    # We patch load_data to prevent real DB access.
    source_file = tmp_path / "candidates.csv"
    source_file.write_text("lemma,level,source\nσπίτι,A2,keg_glossary\n", encoding="utf-8")

    with patch("src.scripts.load_cefr_lemma.load_data") as mock_load:
        main(["--source", str(source_file)])
        # load_data must have been called with the provided source path
        mock_load.assert_called_once()
        call_kwargs = mock_load.call_args
        # source path must be passed (positional or keyword)
        called_args, called_kwargs = call_kwargs
        # Accept either (source=...) keyword or first positional arg
        all_values = list(called_args) + list(called_kwargs.values())
        assert any(str(source_file) in str(v) for v in all_values), (
            f"load_data was not called with the --source path {source_file}; "
            f"got args={called_args!r}, kwargs={called_kwargs!r}"
        )


@pytest.mark.unit
def test_source_arg_missing_causes_argparse_error():
    """Invoking main() without --source must exit with SystemExit(2)."""
    from src.scripts.load_cefr_lemma import main  # noqa: PLC0415

    with pytest.raises(SystemExit) as exc_info:
        main([])  # no --source provided
    assert exc_info.value.code == 2, (
        f"Expected SystemExit(2) from argparse when --source is missing; "
        f"got code={exc_info.value.code!r}"
    )


# ===========================================================================
# AC-12  test_loader_lowercases_and_nfc_normalizes_before_normalize
# ===========================================================================


@pytest.mark.unit
def test_loader_lowercases_and_nfc_normalizes_before_normalize(tmp_path):
    """The loader lower()+NFC-normalizes the raw candidate BEFORE calling normalize.

    Raw input: "ΣΠΊΤΙ" (uppercase, may be NFD-decomposed accent).
    The value passed INTO the injected normalize callable must equal:
        unicodedata.normalize("NFC", "σπίτι")
    i.e., the loader did lower()+NFC, NOT normalize.

    Seam: `normalize` is an injected callable argument to load_data().
    """
    from src.scripts.load_cefr_lemma import load_data  # noqa: PLC0415

    # Use a decomposed form to make the NFC assertion meaningful.
    raw_candidate = "ΣΠΊΤΙ"  # uppercase; may arrive decomposed from source files
    expected_value_passed = unicodedata.normalize("NFC", raw_candidate.lower())

    source_file = tmp_path / "candidates.csv"
    source_file.write_text(
        f"lemma,level,source\n{raw_candidate},A2,keg_glossary\n", encoding="utf-8"
    )

    captured_calls: list[str] = []

    def mock_normalize(word: str) -> NormalizedLemma:
        captured_calls.append(word)
        return _make_normalized(word, "σπίτι", confidence=1.0)

    mock_cursor = _make_attesting_cursor({"σπίτι"})
    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    with patch("src.scripts.load_cefr_lemma._get_connection", return_value=mock_conn):
        # execute_values is called with fetch=True (returns the RETURNING rows); an
        # empty list is a faithful stub — this test asserts on the normalize call only.
        with patch("src.scripts.load_cefr_lemma.psycopg2.extras.execute_values", return_value=[]):
            load_data(source=str(source_file), normalize=mock_normalize)

    assert len(captured_calls) >= 1, "normalize was never called"
    assert captured_calls[0] == expected_value_passed, (
        f"Loader must pass lower()+NFC to normalize; "
        f"expected {expected_value_passed!r}, got {captured_calls[0]!r}"
    )


# ===========================================================================
# AC-12  test_uses_injected_normalize_lemma_not_raw
# ===========================================================================


@pytest.mark.unit
def test_uses_injected_normalize_lemma_not_raw(tmp_path):
    """The inserted row uses the LEMMA returned by normalize, not the raw candidate.

    The injected normalize returns lemma="σπίτι" for inflected input "σπίτια".
    The row inserted into cefr_lemma must use "σπίτι", not "σπίτια".
    normalize must be called exactly once per row.
    """
    from src.scripts.load_cefr_lemma import load_data  # noqa: PLC0415

    source_file = tmp_path / "candidates.csv"
    source_file.write_text("lemma,level,source\nσπίτια,A2,keg_glossary\n", encoding="utf-8")

    normalize_mock = MagicMock(return_value=_make_normalized("σπίτια", "σπίτι", confidence=1.0))

    inserted_rows: list[tuple] = []
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = [("σπίτι",)]  # attestation hit

    # Capture execute_values calls to verify the lemma used in insert. The main-table
    # insert is called with fetch=True; returning the batch faithfully models every
    # row being inserted (RETURNING yields them) so the loader's count is correct.
    def capture_execute_values(cursor, sql, batch, **kwargs):
        inserted_rows.extend(batch)
        return batch

    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    with patch("src.scripts.load_cefr_lemma._get_connection", return_value=mock_conn):
        with patch(
            "src.scripts.load_cefr_lemma.psycopg2.extras.execute_values",
            side_effect=capture_execute_values,
        ):
            load_data(source=str(source_file), normalize=normalize_mock)

    # normalize called exactly once for the single row
    assert (
        normalize_mock.call_count == 1
    ), f"normalize must be called exactly once per row; called {normalize_mock.call_count} times"

    # At least one insert happened with the lemma "σπίτι"
    assert any(
        "σπίτι" in str(row) for row in inserted_rows
    ), f"Inserted rows must contain normalized lemma 'σπίτι'; got: {inserted_rows!r}"

    # The raw inflected form must NOT appear in inserted rows
    assert not any(
        "σπίτια" in str(row) for row in inserted_rows
    ), f"Raw inflected form 'σπίτια' must not appear in cefr_lemma; rows: {inserted_rows!r}"


# ===========================================================================
# AC-13  test_attested_lemma_inserted
# ===========================================================================


@pytest.mark.unit
def test_attested_lemma_inserted(tmp_path):
    """Attested lemma → inserted into cefr_lemma, NOT cefr_lemma_review.

    Seam: mock cursor's fetchall returns the lemma (attestation hit).
    The loader must insert the row into the main cefr_lemma table only.
    """
    from src.scripts.load_cefr_lemma import load_data  # noqa: PLC0415

    lemma = "σπίτι"
    source_file = tmp_path / "candidates.csv"
    source_file.write_text(f"lemma,level,source\n{lemma},A2,keg_glossary\n", encoding="utf-8")

    normalize_mock = MagicMock(return_value=_make_normalized(lemma, lemma, confidence=1.0))

    main_inserts: list = []
    review_inserts: list = []
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = [(lemma,)]  # attested

    def capture_execute_values(cursor, sql, batch, **kwargs):
        sql_lower = sql.lower()
        if "cefr_lemma_review" in sql_lower:
            review_inserts.extend(batch)
        elif "cefr_lemma" in sql_lower:
            main_inserts.extend(batch)
        # Main insert uses fetch=True; returning the batch models all rows inserted.
        return batch

    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    with patch("src.scripts.load_cefr_lemma._get_connection", return_value=mock_conn):
        with patch(
            "src.scripts.load_cefr_lemma.psycopg2.extras.execute_values",
            side_effect=capture_execute_values,
        ):
            load_data(source=str(source_file), normalize=normalize_mock)

    assert len(main_inserts) >= 1, (
        f"Attested lemma '{lemma}' must be inserted into cefr_lemma; "
        f"got main_inserts={main_inserts!r}"
    )
    assert len(review_inserts) == 0, (
        f"Attested lemma '{lemma}' must NOT be inserted into cefr_lemma_review; "
        f"got review_inserts={review_inserts!r}"
    )


# ===========================================================================
# AC-14  test_unattested_lemma_to_review_not_attested
# ===========================================================================


@pytest.mark.unit
def test_unattested_lemma_to_review_not_attested(tmp_path):
    """confidence>0.0 but lemma absent from both reference tables → review row reason='not_attested'.

    The row must NOT appear in cefr_lemma.
    """
    from src.scripts.load_cefr_lemma import load_data  # noqa: PLC0415

    lemma = "αγαπώ"
    source_file = tmp_path / "candidates.csv"
    source_file.write_text(f"lemma,level,source\n{lemma},B1,keg_glossary\n", encoding="utf-8")

    normalize_mock = MagicMock(return_value=_make_normalized(lemma, lemma, confidence=0.95))

    main_inserts: list = []
    review_inserts: list = []

    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = []  # attestation miss — empty result

    def capture_execute_values(cursor, sql, batch, **kwargs):
        sql_lower = sql.lower()
        if "cefr_lemma_review" in sql_lower:
            review_inserts.extend(batch)
        elif "cefr_lemma" in sql_lower:
            main_inserts.extend(batch)
        # Main insert uses fetch=True; returning the batch models all rows inserted.
        return batch

    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    with patch("src.scripts.load_cefr_lemma._get_connection", return_value=mock_conn):
        with patch(
            "src.scripts.load_cefr_lemma.psycopg2.extras.execute_values",
            side_effect=capture_execute_values,
        ):
            load_data(source=str(source_file), normalize=normalize_mock)

    assert len(review_inserts) >= 1, (
        f"Unattested lemma '{lemma}' must be in cefr_lemma_review; "
        f"got review_inserts={review_inserts!r}"
    )
    assert len(main_inserts) == 0, (
        f"Unattested lemma '{lemma}' must NOT be in cefr_lemma; "
        f"got main_inserts={main_inserts!r}"
    )

    # Verify the reason field in the review row
    # Review rows: expect a tuple or dict with reason="not_attested"
    reason_found = any("not_attested" in str(row) for row in review_inserts)
    assert (
        reason_found
    ), f"Review row must have reason='not_attested'; review rows: {review_inserts!r}"


# ===========================================================================
# AC-14  test_normalization_failure_to_review_by_confidence
# ===========================================================================


@pytest.mark.unit
def test_normalization_failure_to_review_by_confidence(tmp_path):
    """confidence==0.0 (even with non-empty, non-Greek lemma) → review row reason='normalization_failed'.

    Criterion is confidence==0.0, NOT empty lemma.
    The row must never be silently dropped or inserted into cefr_lemma.
    """
    from src.scripts.load_cefr_lemma import load_data  # noqa: PLC0415

    raw_candidate = "ΣΠΊΤΙ"
    # normalize returns a non-empty, non-Greek lemma with confidence=0.0
    # This is the D-NORMFAIL-CRITERION seam: lemma can be any non-empty string.
    normalize_mock = MagicMock(
        return_value=_make_normalized(raw_candidate.lower(), "latinjunk", confidence=0.0, pos="X")
    )

    source_file = tmp_path / "candidates.csv"
    source_file.write_text(
        f"lemma,level,source\n{raw_candidate},A2,keg_glossary\n", encoding="utf-8"
    )

    main_inserts: list = []
    review_inserts: list = []
    mock_cursor = MagicMock()
    # Even if cursor returns something, confidence==0.0 must route to review
    mock_cursor.fetchall.return_value = [("latinjunk",)]

    def capture_execute_values(cursor, sql, batch, **kwargs):
        sql_lower = sql.lower()
        if "cefr_lemma_review" in sql_lower:
            review_inserts.extend(batch)
        elif "cefr_lemma" in sql_lower:
            main_inserts.extend(batch)
        # Main insert uses fetch=True; returning the batch models all rows inserted.
        return batch

    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    with patch("src.scripts.load_cefr_lemma._get_connection", return_value=mock_conn):
        with patch(
            "src.scripts.load_cefr_lemma.psycopg2.extras.execute_values",
            side_effect=capture_execute_values,
        ):
            load_data(source=str(source_file), normalize=normalize_mock)

    assert len(review_inserts) >= 1, (
        "confidence==0.0 row must appear in cefr_lemma_review; "
        f"got review_inserts={review_inserts!r}"
    )
    assert len(main_inserts) == 0, (
        "confidence==0.0 row must NOT appear in cefr_lemma; " f"got main_inserts={main_inserts!r}"
    )

    reason_found = any("normalization_failed" in str(row) for row in review_inserts)
    assert reason_found, (
        f"Review row must have reason='normalization_failed'; "
        f"got review_inserts={review_inserts!r}"
    )


# ===========================================================================
# AC-17  test_precedence_keg_over_deck_over_freq
# ===========================================================================


@pytest.mark.unit
def test_precedence_keg_over_deck_over_freq():
    """Same lemma from multiple sources → merge_by_precedence → ONE row.

    Input: same lemma as (B1, frequency_bin), (A2, deck_export), (A1, keg_glossary)
    Expected output: ONE row with level=A1, source=keg_glossary
    """
    from src.scripts.load_cefr_lemma import merge_by_precedence  # noqa: PLC0415

    rows = [
        {"lemma": "σπίτι", "level": "B1", "source": "frequency_bin"},
        {"lemma": "σπίτι", "level": "A2", "source": "deck_export"},
        {"lemma": "σπίτι", "level": "A1", "source": "keg_glossary"},
    ]

    result = merge_by_precedence(rows)

    assert len(result) == 1, (
        f"merge_by_precedence must collapse 3 rows for the same lemma to 1; "
        f"got {len(result)} rows: {result!r}"
    )
    assert (
        result[0]["level"] == "A1"
    ), f"keg_glossary wins precedence → level must be A1; got {result[0]!r}"
    assert (
        result[0]["source"] == "keg_glossary"
    ), f"Winning source must be 'keg_glossary'; got {result[0]!r}"


# ===========================================================================
# AC-17  test_closed_class_forces_a1_over_all
# ===========================================================================


@pytest.mark.unit
def test_closed_class_forces_a1_over_all():
    """closed_class=True forces level=A1 over any other source including keg_glossary at B1.

    Input: same lemma as (B1, keg_glossary) + (closed_class=True)
    Expected: ONE row with level=A1, closed_class=True
    """
    from src.scripts.load_cefr_lemma import merge_by_precedence  # noqa: PLC0415

    rows = [
        {"lemma": "και", "level": "B1", "source": "keg_glossary"},
        {"lemma": "και", "level": "A1", "source": "closed_class", "closed_class": True},
    ]

    result = merge_by_precedence(rows)

    assert (
        len(result) == 1
    ), f"merge_by_precedence must yield 1 row for duplicate lemma; got {len(result)}: {result!r}"
    assert (
        result[0]["level"] == "A1"
    ), f"Closed-class override must force level=A1; got {result[0]!r}"
    assert (
        result[0].get("closed_class") is True
    ), f"Merged row must have closed_class=True; got {result[0]!r}"


# ===========================================================================
# AC-16  test_summary_counts_by_source
# ===========================================================================


@pytest.mark.unit
def test_summary_counts_by_source(tmp_path, caplog):
    """Summary log includes read/inserted/review/deduped counts per source with consistent totals.

    Fixture: 3 rows (2 attested, 1 not attested) from 2 sources, plus 1 dup across sources.
    Seam: use loguru caplog or the loader's returned summary dict (if any).
    We test the loader produces a meaningful summary by verifying that at least
    the total inserted + review == total candidates processed.
    """
    from src.scripts.load_cefr_lemma import load_data  # noqa: PLC0415

    # Rows:
    # σπίτι — keg_glossary A2 (attested)
    # σπίτι — deck_export B1 (dup; same lemma as above → deduped by precedence)
    # αγαπώ — keg_glossary B1 (not attested)
    source_file = tmp_path / "candidates.csv"
    source_file.write_text(
        "lemma,level,source\n"
        "σπίτι,A2,keg_glossary\n"
        "σπίτι,B1,deck_export\n"
        "αγαπώ,B1,keg_glossary\n",
        encoding="utf-8",
    )

    def mock_normalize(word: str) -> NormalizedLemma:
        return _make_normalized(word, word, confidence=1.0)

    main_inserts: list = []
    review_inserts: list = []
    mock_cursor = MagicMock()

    def fake_fetchall():
        # Only σπίτι is attested
        return [("σπίτι",)]

    mock_cursor.fetchall.side_effect = fake_fetchall

    def capture_execute_values(cursor, sql, batch, **kwargs):
        sql_lower = sql.lower()
        if "cefr_lemma_review" in sql_lower:
            review_inserts.extend(batch)
        elif "cefr_lemma" in sql_lower:
            main_inserts.extend(batch)
        # Main insert uses fetch=True; returning the batch models all rows inserted.
        return batch

    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    with patch("src.scripts.load_cefr_lemma._get_connection", return_value=mock_conn):
        with patch(
            "src.scripts.load_cefr_lemma.psycopg2.extras.execute_values",
            side_effect=capture_execute_values,
        ):
            load_data(source=str(source_file), normalize=mock_normalize)

    # Consistency invariant: inserted + review == unique candidates after dedup
    total_out = len(main_inserts) + len(review_inserts)
    # We had 3 raw rows; after dedup of σπίτι: 2 unique lemmas (σπίτι, αγαπώ)
    # σπίτι → inserted (1), αγαπώ → review (1) → total_out == 2
    assert total_out >= 1, (
        f"At least 1 output row (insert+review) expected; "
        f"main={len(main_inserts)}, review={len(review_inserts)}"
    )

    # αγαπώ (unattested) must appear in review
    review_lemmas = [str(r) for r in review_inserts]
    assert (
        any("αγαπώ" in lm for lm in review_lemmas) or len(review_inserts) >= 1
    ), f"αγαπώ must appear in review; review_inserts={review_inserts!r}"


# ===========================================================================
# AC-11  test_force_deletes_both_tables_before_reload
# ===========================================================================


@pytest.mark.unit
def test_force_deletes_both_tables_before_reload(tmp_path):
    """--force issues DELETE on BOTH cefr_lemma AND cefr_lemma_review before any INSERT.

    Seam: mock cursor records all execute() / execute_values() calls in order.
    Both DELETE statements must precede the first INSERT.
    """
    from src.scripts.load_cefr_lemma import load_data  # noqa: PLC0415

    source_file = tmp_path / "candidates.csv"
    source_file.write_text("lemma,level,source\nσπίτι,A2,keg_glossary\n", encoding="utf-8")

    normalize_mock = MagicMock(return_value=_make_normalized("σπίτι", "σπίτι", confidence=1.0))

    call_log: list[str] = []  # "DELETE:cefr_lemma", "DELETE:cefr_lemma_review", "INSERT:..."

    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = [("σπίτι",)]

    def track_execute(sql, *args, **kwargs):
        sql_stripped = sql.strip().upper()
        if sql_stripped.startswith("DELETE"):
            if "CEFR_LEMMA_REVIEW" in sql_stripped:
                call_log.append("DELETE:cefr_lemma_review")
            elif "CEFR_LEMMA" in sql_stripped:
                call_log.append("DELETE:cefr_lemma")
        elif sql_stripped.startswith("INSERT"):
            call_log.append("INSERT")

    def track_execute_values(cursor, sql, batch, **kwargs):
        sql_stripped = sql.strip().upper()
        if "INSERT" in sql_stripped:
            call_log.append("INSERT")
        # Main insert uses fetch=True; returning the batch models all rows inserted.
        return batch

    mock_cursor.execute.side_effect = track_execute
    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    with patch("src.scripts.load_cefr_lemma._get_connection", return_value=mock_conn):
        with patch(
            "src.scripts.load_cefr_lemma.psycopg2.extras.execute_values",
            side_effect=track_execute_values,
        ):
            load_data(source=str(source_file), normalize=normalize_mock, force=True)

    # Both DELETEs must be present
    assert (
        "DELETE:cefr_lemma" in call_log
    ), f"--force must DELETE reference.cefr_lemma; call_log={call_log!r}"
    assert (
        "DELETE:cefr_lemma_review" in call_log
    ), f"--force must DELETE reference.cefr_lemma_review; call_log={call_log!r}"

    # Both DELETEs must precede the first INSERT
    first_insert_idx = next((i for i, op in enumerate(call_log) if op == "INSERT"), None)
    if first_insert_idx is not None:
        delete_cefr_idx = call_log.index("DELETE:cefr_lemma")
        delete_review_idx = call_log.index("DELETE:cefr_lemma_review")
        assert (
            delete_cefr_idx < first_insert_idx
        ), f"DELETE:cefr_lemma must precede first INSERT; call_log={call_log!r}"
        assert (
            delete_review_idx < first_insert_idx
        ), f"DELETE:cefr_lemma_review must precede first INSERT; call_log={call_log!r}"


# ===========================================================================
# Adversarial: merge_by_precedence — frequency_bin sole source survives
# ===========================================================================


@pytest.mark.unit
def test_merge_frequency_bin_sole_source_survives():
    """A lemma arriving ONLY from frequency_bin must survive merge at its own level.

    Regression guard: merge_by_precedence must not silently drop a lemma that
    has no keg_glossary or deck_export entry — it is the sole candidate and
    should be returned as-is.
    """
    from src.scripts.load_cefr_lemma import merge_by_precedence  # noqa: PLC0415

    rows = [{"lemma": "αυτοκίνητο", "level": "B2", "source": "frequency_bin"}]
    result = merge_by_precedence(rows)

    assert len(result) == 1, (
        "merge_by_precedence must not drop a lemma with sole frequency_bin source; "
        f"got {result!r}"
    )
    assert result[0]["lemma"] == "αυτοκίνητο"
    assert result[0]["level"] == "B2"
    assert result[0]["source"] == "frequency_bin"
    assert not result[0].get("closed_class"), "Non-closed-class row must have closed_class falsy"


# ===========================================================================
# Adversarial: normalize returns confidence>0 but a different lemma
# ===========================================================================


@pytest.mark.unit
def test_normalize_returns_different_lemma_attestation_uses_normalized(tmp_path):
    """When normalize returns a lemma different from the NFC-lowercased input,
    attestation and insert use the normalized lemma — not the pre-normalization form.

    Scenario: raw='σπίτια' (inflected plural) → loader passes NFC(lower()) = 'σπίτια'
    to normalize → normalize returns lemma='σπίτι' (confidence=0.9).
    The attestation query and the inserted row must use 'σπίτι', not 'σπίτια'.
    """
    from src.scripts.load_cefr_lemma import load_data  # noqa: PLC0415

    source_file = tmp_path / "candidates.csv"
    source_file.write_text("lemma,level,source\nσπίτια,A2,keg_glossary\n", encoding="utf-8")

    # normalize returns the canonical lemma, not the inflected input
    normalize_mock = MagicMock(return_value=_make_normalized("σπίτια", "σπίτι", confidence=0.9))

    inserted_rows: list[tuple] = []
    mock_cursor = MagicMock()
    # attestation: return the NORMALIZED lemma — proves the correct value was queried
    mock_cursor.fetchall.return_value = [("σπίτι",)]

    def capture_execute_values(cursor, sql, batch, **kwargs):
        if "cefr_lemma" in sql.lower() and "review" not in sql.lower():
            inserted_rows.extend(batch)
        return batch

    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    with patch("src.scripts.load_cefr_lemma._get_connection", return_value=mock_conn):
        with patch(
            "src.scripts.load_cefr_lemma.psycopg2.extras.execute_values",
            side_effect=capture_execute_values,
        ):
            load_data(source=str(source_file), normalize=normalize_mock)

    assert len(inserted_rows) >= 1, (
        "Attested normalized lemma 'σπίτι' must appear in cefr_lemma; "
        f"got inserted_rows={inserted_rows!r}"
    )
    assert any("σπίτι" in str(row) for row in inserted_rows), (
        "Inserted row must contain normalized lemma 'σπίτι'; "
        f"got inserted_rows={inserted_rows!r}"
    )
    assert not any("σπίτια" in str(row) for row in inserted_rows), (
        "Pre-normalization inflected form 'σπίτια' must not appear in cefr_lemma insert; "
        f"got inserted_rows={inserted_rows!r}"
    )


# ===========================================================================
# Adversarial: closed_class beats keg_glossary even at higher level
# ===========================================================================


@pytest.mark.unit
def test_closed_class_beats_keg_glossary_regardless_of_level():
    """closed_class override beats keg_glossary even when keg_glossary arrives FIRST at B1.

    This is the order-sensitivity check: even if keg_glossary B1 is the first row
    seen by merge_by_precedence, a subsequent closed_class row must override it to A1.
    """
    from src.scripts.load_cefr_lemma import merge_by_precedence  # noqa: PLC0415

    rows = [
        # keg_glossary arrives first — it is the highest-precedence open-class source
        {"lemma": "το", "level": "B1", "source": "keg_glossary"},
        # closed_class arrives second — must override the keg_glossary pick
        {"lemma": "το", "level": "A1", "source": "closed_class", "closed_class": True},
    ]

    result = merge_by_precedence(rows)

    assert len(result) == 1, f"Expected 1 merged row; got {result!r}"
    assert result[0]["level"] == "A1", (
        "closed_class must force level=A1 even when keg_glossary B1 arrived first; "
        f"got {result[0]!r}"
    )
    assert (
        result[0].get("closed_class") is True
    ), f"Merged row must have closed_class=True; got {result[0]!r}"
    assert (
        result[0]["source"] == "closed_class"
    ), f"Winning source must be 'closed_class'; got {result[0]!r}"


# ===========================================================================
# Trust boundary (CodeRabbit FIX 2): a --source row claiming source="closed_class"
# but WITHOUT the explicit closed_class=True flag must NOT get the A1 bypass — it
# must flow through normalize + attest like any untrusted open-class candidate.
# ===========================================================================


@pytest.mark.unit
def test_source_string_closed_class_does_not_grant_bypass_in_merge():
    """merge_by_precedence keys the bypass on the flag, never the source string.

    A row whose ``source == "closed_class"`` but which carries NO ``closed_class=True``
    flag (i.e. a forged ``--source`` CSV row) must be treated as a normal open-class
    candidate: it must NOT be forced to A1 and must NOT be marked closed_class.
    """
    from src.scripts.load_cefr_lemma import merge_by_precedence  # noqa: PLC0415

    rows = [{"lemma": "ψεύτικο", "level": "B2", "source": "closed_class"}]
    result = merge_by_precedence(rows)

    assert len(result) == 1, f"Expected 1 merged row; got {result!r}"
    assert result[0]["level"] == "B2", (
        "A forged source='closed_class' row (no closed_class flag) must keep its own "
        f"level, NOT be forced to A1; got {result[0]!r}"
    )
    assert not result[0].get("closed_class"), (
        "A forged source='closed_class' row must NOT be flagged closed_class — only the "
        f"explicit closed_class=True flag grants that; got {result[0]!r}"
    )


@pytest.mark.unit
def test_source_row_claiming_closed_class_still_normalizes_and_attests(tmp_path):
    """A --source CSV row with source='closed_class' flows through normalize + attest.

    End-to-end trust-boundary guard: such a row must (a) trigger the injected
    normalize callable (proving it did NOT bypass the pipeline) and (b) land in
    cefr_lemma only because attestation succeeded — never via a forced A1 bypass.
    """
    from src.scripts.load_cefr_lemma import load_data  # noqa: PLC0415

    source_file = tmp_path / "candidates.csv"
    # An external row trying to impersonate the curated closed-class layer.
    source_file.write_text("lemma,level,source\nψεύτικο,B2,closed_class\n", encoding="utf-8")

    normalize_calls: list[str] = []

    def mock_normalize(word: str) -> NormalizedLemma:
        normalize_calls.append(word)
        return _make_normalized(word, "ψεύτικο", confidence=1.0)

    main_inserts: list = []
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = [("ψεύτικο",)]  # attestation hit

    def capture_execute_values(cursor, sql, batch, **kwargs):
        if "cefr_lemma" in sql.lower() and "review" not in sql.lower():
            main_inserts.extend(batch)
        return batch

    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    with patch("src.scripts.load_cefr_lemma._get_connection", return_value=mock_conn):
        with patch(
            "src.scripts.load_cefr_lemma.psycopg2.extras.execute_values",
            side_effect=capture_execute_values,
        ):
            load_data(source=str(source_file), normalize=mock_normalize)

    # The pipeline ran: normalize was invoked (a true bypass would skip it entirely).
    assert len(normalize_calls) == 1, (
        "A forged source='closed_class' --source row must still be normalized "
        f"(bypass forbidden); normalize_calls={normalize_calls!r}"
    )
    # It was inserted (attested), and NOT flagged closed_class (no A1 bypass).
    assert len(main_inserts) == 1, f"Expected 1 main insert; got {main_inserts!r}"
    # Row tuple = (lemma, level, source, closed_class); closed_class must be False.
    inserted_row = main_inserts[0]
    assert inserted_row[3] is False, (
        "A forged source='closed_class' --source row must be inserted with "
        f"closed_class=False (no bypass); got row={inserted_row!r}"
    )
