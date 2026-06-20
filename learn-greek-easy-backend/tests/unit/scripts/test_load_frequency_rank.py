"""RED tests for LEXGEN-05-02: wordfreq frequency rank importer.

These tests are authored BEFORE the implementation exists.
Expected failure mode: ModuleNotFoundError on `src.scripts.load_frequency_rank`
(module does not yet exist).

===========================================================================
SEAM CONTRACT — the executor MUST implement these exact interfaces:
===========================================================================

1. MODULE: src/scripts/load_frequency_rank.py

2. PUBLIC API TARGETED BY THESE TESTS:
   - _final_sigma_unfold(token: str) -> str
   - _surface_to_lemma(token: str, normalize: NormalizeFn) -> str | None
   - aggregate_by_lemma(lemma_freq_pairs: list[tuple[str, float]]) -> dict[str, float]
   - dense_rank(freq_by_lemma: dict[str, float]) -> list[tuple[str, int]]
   - load_data(*, normalize, word_source, force, limit) -> None

3. LAZY RESOLUTION SEAM (D4)
   All real wordfreq / spaCy dependencies must be resolved lazily inside
   load_data() when the normalize / word_source args are None. Importing
   the module at the top of this test file must NOT trigger wordfreq or
   spaCy imports. If the test-module import itself fails on a missing
   `wordfreq`, that is an importer-design bug, not a test problem.

4. INJECTION SEAMS
   - normalize: Callable[[str], NormalizedLemma] — injected in tests
   - word_source: Callable[[], Iterable[tuple[str, float]]] — injected in tests
   - DB connection: patch("src.scripts.load_frequency_rank._get_connection", ...)
   - batch INSERT: patch("src.scripts.load_frequency_rank.psycopg2.extras.execute_values", ...)

5. DROP CRITERION (confidence == 0.0)
   Tokens whose normalize() returns confidence == 0.0 are silently dropped
   and counted but NOT inserted and NOT routed to a review table.

6. --force SEAM
   force=True triggers DELETE FROM reference.frequency_rank BEFORE any INSERT.

===========================================================================
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from src.schemas.nlp import NormalizedLemma

# ---------------------------------------------------------------------------
# Helper: build a controlled NormalizedLemma for mocks
# (mirrors test_load_cefr_lemma._make_normalized)
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
# Helper: build a mock psycopg2 connection with injectable cursor
# ---------------------------------------------------------------------------


def _make_mock_conn(cursor: MagicMock) -> MagicMock:
    """Wrap a mock cursor in a mock connection supporting context-manager protocol."""
    mock_conn = MagicMock()
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=False)
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    return mock_conn


def _make_capture_execute_values() -> tuple[list, object]:
    """Return (captured_batches_list, side_effect_fn).

    The side_effect records (sql, batch) and returns the batch so that any
    fetch=True path inside load_data gets back the rows it inserted (the
    psycopg2.extras.execute_values fetch=True contract returns inserted rows).
    """
    captured: list[tuple[str, list]] = []

    def _capture(cursor, sql, batch, **kw):
        captured.append((sql, list(batch)))
        # Returning the batch satisfies any `result = execute_values(... fetch=True)` pattern.
        return list(batch)

    return captured, _capture


# ===========================================================================
# Test 1 — AC: aggregate_by_lemma sums frequency per lemma key
# ===========================================================================


@pytest.mark.unit
def test_aggregate_sums_surface_freqs_per_lemma():
    """aggregate_by_lemma([("σπίτι",0.0005),("σπίτι",0.0002)]) == {"σπίτι": 0.0007}.

    The function takes ALREADY-LEMMATIZED (lemma, freq) pairs and sums by key.
    Two surface forms that both map upstream to the same lemma ("σπίτι") arrive
    here as two ("σπίτι", freq) entries; their frequencies must be summed.
    """
    from src.scripts.load_frequency_rank import aggregate_by_lemma  # noqa: PLC0415

    result = aggregate_by_lemma([("σπίτι", 0.0005), ("σπίτι", 0.0002)])

    assert set(result.keys()) == {
        "σπίτι"
    }, f"Expected exactly one lemma key 'σπίτι'; got keys={set(result.keys())!r}"
    assert result["σπίτι"] == pytest.approx(
        0.0007
    ), f"Expected 0.0005 + 0.0002 = 0.0007; got {result['σπίτι']!r}"


# ===========================================================================
# Test 2 — AC: dense_rank assigns descending rank by frequency
# ===========================================================================


@pytest.mark.unit
def test_dense_rank_descending_by_frequency():
    """dense_rank({"και":0.03,"σπίτι":0.0007,"άνθρωπος":0.0002}) == [("και",1),("σπίτι",2),("άνθρωπος",3)]."""
    from src.scripts.load_frequency_rank import dense_rank  # noqa: PLC0415

    result = dense_rank({"και": 0.03, "σπίτι": 0.0007, "άνθρωπος": 0.0002})

    assert result == [
        ("και", 1),
        ("σπίτι", 2),
        ("άνθρωπος", 3),
    ], f"Expected descending dense rank; got {result!r}"


# ===========================================================================
# Test 3 — AC: dense_rank tie-breaking is deterministic and consecutive
# ===========================================================================


@pytest.mark.unit
def test_dense_rank_ties_broken_deterministically():
    """Equal-frequency lemmas get consecutive ranks, broken by lemma string ascending.

    Calling twice must yield identical output (determinism).
    Ranks must be consecutive integers starting at 1.
    """
    from src.scripts.load_frequency_rank import dense_rank  # noqa: PLC0415

    # Two lemmas with equal frequency; α < β lexicographically in Greek ordering.
    # (Use ASCII letters here to guarantee platform-independent sort order in the test.)
    freq_by_lemma = {"beta": 0.005, "alpha": 0.005, "gamma": 0.001}

    result_1 = dense_rank(freq_by_lemma)
    result_2 = dense_rank(freq_by_lemma)

    # Determinism: both calls yield the same output.
    assert (
        result_1 == result_2
    ), f"dense_rank must be deterministic; got {result_1!r} then {result_2!r}"

    # Ranks are consecutive starting at 1.
    ranks = [r for _, r in result_1]
    assert ranks == list(range(1, len(ranks) + 1)), f"Ranks must be consecutive 1..N; got {ranks!r}"

    # The tied pair (alpha, beta) must be sorted ascending by lemma string.
    tied_pair = [(lemma, rank) for lemma, rank in result_1 if lemma in ("alpha", "beta")]
    assert len(tied_pair) == 2
    first_lemma = tied_pair[0][0]
    second_lemma = tied_pair[1][0]
    assert (
        first_lemma < second_lemma
    ), f"Tie-break must sort lemma ascending; got order {first_lemma!r} before {second_lemma!r}"

    # gamma (lower freq) must rank last.
    gamma_rank = next(r for lemma, r in result_1 if lemma == "gamma")
    assert gamma_rank == 3, f"gamma (lowest freq) must be rank 3; got {gamma_rank!r}"


# ===========================================================================
# Test 4 — AC: final sigma unfold applied before spaCy normalize
# ===========================================================================


@pytest.mark.unit
def test_final_sigma_unfold_before_spacy():
    """_surface_to_lemma passes a final-σ→ς-unfolded token into normalize.

    Token: "άνθρωποσ" (final σ instead of ς, as may appear in some corpora).
    After lower() + NFC + _final_sigma_unfold the value passed to normalize
    must be "άνθρωπος" (ς at the end), NOT the original "άνθρωποσ".
    """
    from src.scripts.load_frequency_rank import _surface_to_lemma  # noqa: PLC0415

    recorded_calls: list[str] = []

    def recording_normalize(word: str) -> NormalizedLemma:
        recorded_calls.append(word)
        return _make_normalized(word, "άνθρωπος", confidence=1.0)

    _surface_to_lemma("άνθρωποσ", recording_normalize)

    assert len(recorded_calls) >= 1, "_surface_to_lemma must call normalize at least once"
    assert recorded_calls[0] == "άνθρωπος", (
        f"normalize must receive final-σ→ς-unfolded input; "
        f"expected 'άνθρωπος', got {recorded_calls[0]!r}"
    )


# ===========================================================================
# Test 5 — AC: confidence==0.0 tokens are dropped; others are inserted
# ===========================================================================


@pytest.mark.unit
def test_normalize_failure_token_dropped_and_counted():
    """word_source with confidence-0 token: that token is dropped from the INSERT batch.

    word_source: [("και", 0.03), ("βαδ", 0.001)]
    normalize("και") -> confidence 1.0 (kept)
    normalize("βαδ") -> confidence 0.0 (dropped — D4 criterion)

    Expected: the INSERT batch contains the "και"-derived lemma row and has
    length 1 (== inputs − drops == 2 − 1).
    """
    from src.scripts.load_frequency_rank import load_data  # noqa: PLC0415

    def mock_normalize(word: str) -> NormalizedLemma:
        if word == "και":
            return _make_normalized(word, "και", confidence=1.0)
        # "βαδ" or whatever the unfold/lower produces for "βαδ"
        return _make_normalized(word, word, confidence=0.0)

    captured, capture_fn = _make_capture_execute_values()
    mock_cursor = MagicMock()
    mock_conn = _make_mock_conn(mock_cursor)

    with patch("src.scripts.load_frequency_rank._get_connection", return_value=mock_conn):
        with patch(
            "src.scripts.load_frequency_rank.psycopg2.extras.execute_values",
            side_effect=capture_fn,
        ):
            load_data(
                word_source=lambda: [("και", 0.03), ("βαδ", 0.001)],
                normalize=mock_normalize,
                force=True,
            )

    # Flatten all captured INSERT batches.
    all_inserted_rows = [row for _sql, batch in captured for row in batch]

    # The "και" lemma must be present.
    assert any(
        "και" in str(row) for row in all_inserted_rows
    ), f"'και' (confidence=1.0) must appear in INSERT batch; rows={all_inserted_rows!r}"

    # No "βαδ"-derived row (confidence=0.0) must be present.
    assert not any(
        "βαδ" in str(row) for row in all_inserted_rows
    ), f"'βαδ' (confidence=0.0) must NOT appear in INSERT batch; rows={all_inserted_rows!r}"

    # Batch length must equal inputs − drops == 1.
    assert len(all_inserted_rows) == 1, (
        f"INSERT batch length must be 1 (2 inputs − 1 drop); got {len(all_inserted_rows)}: "
        f"{all_inserted_rows!r}"
    )


# ===========================================================================
# Test 6 — AC: lemmas absent from reference tables are NOT filtered out
# ===========================================================================


@pytest.mark.unit
def test_lemmas_not_filtered_by_attestation():
    """A normalize-OK lemma absent from all reference tables must be inserted.

    The frequency-rank importer issues NO attestation SELECT. An unattested
    lemma (not in greek_lexicon or wiktionary_morphology) is still inserted
    into reference.frequency_rank. This test also asserts that no attestation
    SELECT query is executed at all.
    """
    from src.scripts.load_frequency_rank import load_data  # noqa: PLC0415

    unattested_lemma = "κβαντικός"  # clearly not in the lexicon

    normalize_mock = MagicMock(
        return_value=_make_normalized(unattested_lemma, unattested_lemma, confidence=1.0)
    )

    captured, capture_fn = _make_capture_execute_values()

    execute_calls: list[str] = []

    mock_cursor = MagicMock()

    def track_execute(sql, *args, **kwargs):
        execute_calls.append(sql.strip())

    mock_cursor.execute.side_effect = track_execute
    mock_conn = _make_mock_conn(mock_cursor)

    with patch("src.scripts.load_frequency_rank._get_connection", return_value=mock_conn):
        with patch(
            "src.scripts.load_frequency_rank.psycopg2.extras.execute_values",
            side_effect=capture_fn,
        ):
            load_data(
                word_source=lambda: [(unattested_lemma, 0.001)],
                normalize=normalize_mock,
                force=True,
            )

    all_inserted_rows = [row for _sql, batch in captured for row in batch]

    # The unattested lemma must be in the INSERT batch.
    assert any(unattested_lemma in str(row) for row in all_inserted_rows), (
        f"Unattested lemma '{unattested_lemma}' must be inserted (no attestation filter); "
        f"rows={all_inserted_rows!r}"
    )

    # No attestation SELECT must have been issued.
    attestation_selects = [
        sql
        for sql in execute_calls
        if sql.upper().startswith("SELECT")
        and any(tbl in sql.lower() for tbl in ("greek_lexicon", "wiktionary_morphology"))
    ]
    assert attestation_selects == [], (
        f"Frequency-rank importer must NOT issue attestation SELECTs; "
        f"found: {attestation_selects!r}"
    )


# ===========================================================================
# Test 7 — AC: force=True deletes the table before any INSERT
# ===========================================================================


@pytest.mark.unit
def test_force_truncates_before_reload():
    """force=True: DELETE FROM reference.frequency_rank must precede any INSERT.

    Track cursor.execute and execute_values calls in order; assert the DELETE
    appears before the first INSERT/execute_values call.
    """
    from src.scripts.load_frequency_rank import load_data  # noqa: PLC0415

    normalize_mock = MagicMock(return_value=_make_normalized("και", "και", confidence=1.0))

    call_log: list[str] = []  # "DELETE", "INSERT"

    mock_cursor = MagicMock()

    def track_execute(sql, *args, **kwargs):
        stripped = sql.strip().upper()
        if stripped.startswith("DELETE") and "FREQUENCY_RANK" in stripped:
            call_log.append("DELETE")

    mock_cursor.execute.side_effect = track_execute

    def track_execute_values(cursor, sql, batch, **kw):
        stripped = sql.strip().upper()
        if "INSERT" in stripped:
            call_log.append("INSERT")
        return list(batch)

    mock_conn = _make_mock_conn(mock_cursor)

    with patch("src.scripts.load_frequency_rank._get_connection", return_value=mock_conn):
        with patch(
            "src.scripts.load_frequency_rank.psycopg2.extras.execute_values",
            side_effect=track_execute_values,
        ):
            load_data(
                word_source=lambda: [("και", 0.03)],
                normalize=normalize_mock,
                force=True,
            )

    assert (
        "DELETE" in call_log
    ), f"force=True must issue DELETE FROM reference.frequency_rank; call_log={call_log!r}"

    first_insert_idx = next((i for i, op in enumerate(call_log) if op == "INSERT"), None)
    delete_idx = next((i for i, op in enumerate(call_log) if op == "DELETE"), None)

    if first_insert_idx is not None:
        assert (
            delete_idx is not None and delete_idx < first_insert_idx
        ), f"DELETE must precede the first INSERT; call_log={call_log!r}"


# ===========================================================================
# Test 8 — AC: INSERT SQL uses ON CONFLICT (lemma) DO NOTHING
# ===========================================================================


@pytest.mark.unit
def test_insert_uses_on_conflict_lemma_do_nothing():
    """The SQL passed to execute_values must contain ON CONFLICT (lemma) DO NOTHING."""
    from src.scripts.load_frequency_rank import load_data  # noqa: PLC0415

    normalize_mock = MagicMock(return_value=_make_normalized("και", "και", confidence=1.0))

    captured_sqls: list[str] = []

    def capture_sql(cursor, sql, batch, **kw):
        captured_sqls.append(sql)
        return list(batch)

    mock_cursor = MagicMock()
    mock_conn = _make_mock_conn(mock_cursor)

    with patch("src.scripts.load_frequency_rank._get_connection", return_value=mock_conn):
        with patch(
            "src.scripts.load_frequency_rank.psycopg2.extras.execute_values",
            side_effect=capture_sql,
        ):
            load_data(
                word_source=lambda: [("και", 0.03)],
                normalize=normalize_mock,
                force=True,
            )

    assert len(captured_sqls) >= 1, "execute_values must be called at least once"

    # At least one SQL must contain the conflict clause.
    conflict_sqls = [
        sql for sql in captured_sqls if "on conflict" in sql.lower() and "do nothing" in sql.lower()
    ]
    assert len(conflict_sqls) >= 1, (
        f"INSERT SQL must include 'ON CONFLICT (lemma) DO NOTHING'; "
        f"captured SQLs: {captured_sqls!r}"
    )
    # Verify the conflict target is specifically (lemma).
    for sql in conflict_sqls:
        assert "(lemma)" in sql.lower(), f"Conflict target must be '(lemma)'; got SQL: {sql!r}"


# ===========================================================================
# Test 9 — AC: inserted rows cover the full rank range 1..N, source == "wordfreq"
# ===========================================================================


@pytest.mark.unit
def test_inserted_rows_cover_full_rank_range():
    """N distinct tokens all normalize-OK → N rows, ranks exactly {1..N}, source='wordfreq'."""
    from src.scripts.load_frequency_rank import load_data  # noqa: PLC0415

    # 5 distinct surface tokens with distinct frequencies so there are no ties.
    tokens = [
        ("και", 0.05),
        ("το", 0.04),
        ("να", 0.03),
        ("σπίτι", 0.002),
        ("άνθρωπος", 0.001),
    ]
    N = len(tokens)

    def mock_normalize(word: str) -> NormalizedLemma:
        # Identity: surface == lemma for simplicity (distinct tokens → distinct lemmas)
        return _make_normalized(word, word, confidence=1.0)

    captured, capture_fn = _make_capture_execute_values()
    mock_cursor = MagicMock()
    mock_conn = _make_mock_conn(mock_cursor)

    with patch("src.scripts.load_frequency_rank._get_connection", return_value=mock_conn):
        with patch(
            "src.scripts.load_frequency_rank.psycopg2.extras.execute_values",
            side_effect=capture_fn,
        ):
            load_data(
                word_source=lambda: iter(tokens),
                normalize=mock_normalize,
                force=True,
            )

    all_rows = [row for _sql, batch in captured for row in batch]

    # Must have exactly N inserted rows.
    assert (
        len(all_rows) == N
    ), f"Expected {N} inserted rows (one per distinct lemma); got {len(all_rows)}: {all_rows!r}"

    # Every row's source must be "wordfreq".
    for row in all_rows:
        assert "wordfreq" in str(
            row
        ), f"Every inserted row must have source='wordfreq'; row={row!r}"

    # Extract the rank values (assume tuples are (lemma, rank, source) or similar;
    # locate rank as an integer in the row).
    def _extract_rank(row) -> int:
        """Find the rank integer inside a row tuple or dict."""
        if isinstance(row, dict):
            return row["rank"]
        # row is a tuple; find the integer field that could be a rank (1..N range).
        int_fields = [v for v in row if isinstance(v, int) and 1 <= v <= N]
        assert len(int_fields) >= 1, f"Could not find rank integer in row={row!r}"
        return int_fields[0]

    ranks = {_extract_rank(row) for row in all_rows}
    expected_ranks = set(range(1, N + 1))
    assert ranks == expected_ranks, f"Ranks must be exactly {{1..{N}}}; got {sorted(ranks)!r}"
