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


# ===========================================================================
# EDGE / ADVERSARIAL TESTS (Mode B additions — not re-authoring the 9 ACs)
# ===========================================================================

# ---------------------------------------------------------------------------
# Edge 1 — empty word_source: no crash; early-exit before DB open
#
# Implementation note: when ranked == [] load_data returns early (line 271-273)
# BEFORE opening the DB connection.  Therefore _get_connection must NOT be
# called at all — we assert this by passing a sentinel side_effect so that
# any accidental call surfaces immediately.
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_empty_word_source_no_crash_and_no_db_open():
    """word_source returning [] must cause an early-exit with 0 inserts, no DB open.

    Behavioral contract: load_data returns None (no exception) and never
    calls _get_connection (the "if not ranked: return" guard fires first,
    before the connection is opened).  DELETE must therefore NOT be issued
    even when force=True.
    """
    from src.scripts.load_frequency_rank import load_data  # noqa: PLC0415

    connection_opened = []

    def sentinel_get_connection():
        connection_opened.append(True)
        raise AssertionError("_get_connection must NOT be called with an empty word_source")

    mock_normalize = MagicMock(return_value=_make_normalized("x", "x", confidence=1.0))

    with patch(
        "src.scripts.load_frequency_rank._get_connection", side_effect=sentinel_get_connection
    ):
        result = load_data(
            word_source=lambda: [],
            normalize=mock_normalize,
            force=True,
        )

    assert result is None, f"load_data must return None; got {result!r}"
    assert connection_opened == [], (
        "load_data must NOT open the DB connection when word_source is empty; "
        "_get_connection was called"
    )


# ---------------------------------------------------------------------------
# Edge 2 — all tokens dropped (confidence == 0.0 for every token):
# no crash; 0 rows inserted; early-exit before DB open.
#
# Same early-exit path as Edge 1: after _normalise_tokens all lemmas are
# None → lemma_freq_pairs is empty → ranked is [] → early return.
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_all_tokens_dropped_no_crash_and_no_db_open():
    """All tokens confidence==0.0 → 0 inserts, early-exit before DB is opened.

    The "dropped count == inputs" assertion verifies the normalise step runs
    fully (it isn't short-circuited) but produces no surviving pairs, so no
    DB access is needed.
    """
    from src.scripts.load_frequency_rank import _normalise_tokens, load_data  # noqa: PLC0415

    tokens = [("αβγδ", 0.001), ("εζηθ", 0.002), ("ικλμ", 0.003)]

    def all_fail_normalize(word: str) -> NormalizedLemma:
        return _make_normalized(word, word, confidence=0.0)

    connection_opened = []

    def sentinel_get_connection():
        connection_opened.append(True)
        raise AssertionError("_get_connection must NOT be called when all tokens are dropped")

    with patch(
        "src.scripts.load_frequency_rank._get_connection", side_effect=sentinel_get_connection
    ):
        result = load_data(
            word_source=lambda: iter(tokens),
            normalize=all_fail_normalize,
            force=True,
        )

    assert result is None, f"load_data must return None; got {result!r}"
    assert connection_opened == [], "load_data must NOT open the DB when all tokens are dropped"

    # Also verify the normalise helper itself: 3 inputs → 0 surviving, dropped == 3.
    pairs, dropped = _normalise_tokens(list(tokens), all_fail_normalize)
    assert pairs == [], f"No pairs should survive all-fail normalization; got {pairs!r}"
    assert dropped == len(tokens), f"dropped count must equal inputs ({len(tokens)}); got {dropped}"


# ---------------------------------------------------------------------------
# Edge 3 — --limit is honored: only the first `limit` tokens are read from
# word_source, before normalization.
#
# The spec (D3 / load_data docstring) states: "limit is applied BEFORE
# normalisation; does NOT guarantee exactly limit inserted rows because
# some tokens may be dropped."  This test verifies the cap on raw token
# reads, not on inserted rows.
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_limit_caps_raw_token_read_before_normalisation():
    """--limit N: only the first N tokens are consumed from word_source.

    We inject 10 tokens but limit=3.  With all tokens normalize-OK, exactly
    3 rows must be inserted (3 tokens → 3 distinct lemmas).  The 4th-10th
    tokens must never reach the normalize callable.
    """
    from src.scripts.load_frequency_rank import load_data  # noqa: PLC0415

    # 10 tokens with distinct lemmas and strictly descending frequencies.
    tokens = [(f"word{i}", 0.1 / (i + 1)) for i in range(10)]
    limit = 3

    normalize_calls: list[str] = []

    def recording_normalize(word: str) -> NormalizedLemma:
        normalize_calls.append(word)
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
                normalize=recording_normalize,
                force=False,
                limit=limit,
            )

    all_rows = [row for _sql, batch in captured for row in batch]

    # Exactly `limit` tokens read → `limit` distinct lemmas → `limit` inserted rows.
    assert len(all_rows) == limit, (
        f"--limit {limit} with 10 tokens → expected {limit} inserted rows; "
        f"got {len(all_rows)}: {all_rows!r}"
    )

    # The normalize callable must be invoked at most `limit` times (tokens 4-10
    # were never consumed).
    assert len(normalize_calls) <= limit, (
        f"normalize was called {len(normalize_calls)} times (> limit={limit}); "
        f"tokens beyond the limit must not be consumed"
    )


# ---------------------------------------------------------------------------
# Edge 4 — aggregate_by_lemma and dense_rank with empty input
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_aggregate_by_lemma_empty_input_returns_empty_dict():
    """aggregate_by_lemma([]) must return {} (no crash, no default entries)."""
    from src.scripts.load_frequency_rank import aggregate_by_lemma  # noqa: PLC0415

    result = aggregate_by_lemma([])

    assert result == {}, f"aggregate_by_lemma([]) must return {{}}; got {result!r}"


@pytest.mark.unit
def test_dense_rank_empty_input_returns_empty_list():
    """dense_rank({}) must return [] (no crash, no default entries)."""
    from src.scripts.load_frequency_rank import dense_rank  # noqa: PLC0415

    result = dense_rank({})

    assert result == [], f"dense_rank({{}}) must return []; got {result!r}"


# ---------------------------------------------------------------------------
# Edge 5 — dense_rank is DENSE (consecutive 1,2,3) not competition-ranked (1,1,3)
# when ties are present.
#
# The existing AC test_dense_rank_ties_broken_deterministically checks
# consecutive ranks with three entries (two tied + one lower).  This
# adversarial test pins the same property with a more explicit 3-way equal-
# frequency scenario to guard against a future regression that re-introduces
# competition ranking (1, 2, 2, 4 instead of 1, 2, 3, 4).
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_dense_rank_is_dense_not_competition_ranked_under_ties():
    """dense_rank with ties must assign consecutive integers 1,2,3 — NOT 1,1,3.

    Contract: {"a": 0.5, "b": 0.5, "c": 0.1} → ranks [1, 2, 3] (consecutive,
    with "a" and "b" each getting distinct consecutive ranks since they share
    the top frequency, tie-broken by lemma string ascending).

    A competition/standard-competition rank (1, 1, 3) would fail this test.
    """
    from src.scripts.load_frequency_rank import dense_rank  # noqa: PLC0415

    # "a" and "b" share the highest frequency; "c" is lower.
    result = dense_rank({"a": 0.5, "b": 0.5, "c": 0.1})

    ranks = [r for _, r in result]

    # Must be exactly [1, 2, 3] — no skipped rank.
    assert ranks == [1, 2, 3], (
        f"dense_rank must assign consecutive 1,2,3 for two tied-top + one lower; "
        f"got {result!r} — if this is [1,1,3] the implementation is competition-ranked, not dense"
    )

    # Tie-break: "a" < "b" lexicographically → "a" gets rank 1.
    assert result[0] == ("a", 1), (
        f"Tie-break must be lemma ascending: 'a' (< 'b') should be rank 1; " f"got {result[0]!r}"
    )
    assert result[1] == ("b", 2), f"'b' (tied with 'a', > 'a') should be rank 2; got {result[1]!r}"
    assert result[2] == ("c", 3), (
        f"'c' (lowest frequency) must be rank 3 (consecutive after the tied pair); "
        f"got {result[2]!r}"
    )


# ===========================================================================
# Multi-token-lemma adjudication (LEXGEN-05-02 design decision)
# ===========================================================================
#
# VERDICT: ACCEPT-AS-IS (known limitation, not a defect).
#
# Background: during the smoke run on the real wordfreq Greek list, spaCy
# occasionally emits a multi-token lemma for a surface contraction, e.g.
# "στο" → lemma "σε ο" (preposition + article).  These land in
# reference.frequency_rank with a lemma string that contains a space.
# They will NOT join single-token entries in cefr_lemma or greek_lexicon
# (since those tables contain canonical single-word lemmas).
#
# Why ACCEPT-AS-IS:
#
# 1. Spec (LEXGEN-05-02 AC-6 / D4): "Lemmas NOT filtered by attestation —
#    every normalize-OK lemma retained; only normalize-failures dropped."
#    A multi-token spaCy output has confidence > 0 so it passes the D4
#    criterion.  The spec has no requirement for single-token lemmas.
#
# 2. Spec (LEXGEN-05 User Story #2): frequency_rank "doubles as a weak
#    'lemma exists' attestation source."  Multi-token lemmas ('σε ο') are
#    harmless noise: they occupy early ranks (high-frequency contractions)
#    but will simply yield a miss when LEXGEN-06 looks them up in
#    greek_lexicon (the join misses → no attestation contribution, which is
#    safe and correct — the contraction "στο" is not a stand-alone lexicon
#    entry anyway).
#
# 3. Simplicity First: adding a single-token filter is not mandated by any
#    story AC and would silently drop valid lemmas like "να" or "δεν" that
#    the filter might incorrectly exclude.
#
# The test below pins the behavior: multi-token spaCy output is accepted and
# inserted (not filtered).  If a future story adds a single-token filter,
# this test should be UPDATED to reflect the new contract (not silently
# removed).
# ===========================================================================


@pytest.mark.unit
def test_multi_token_lemma_accepted_not_filtered():
    """spaCy multi-token lemmas (e.g. 'σε ο') are inserted without filtering.

    This is a KNOWN LIMITATION: multi-token lemmas will not join
    cefr_lemma/greek_lexicon (which contain single-word keys).  Per LEXGEN-05
    D4 / AC-6 there is no single-token filter; the spec's "every normalize-OK
    lemma retained" rule applies regardless of whether the lemma contains
    a space.

    See multi-token-lemma adjudication comment above for the full rationale.
    If a future story adds a single-token filter, update this test.
    """
    from src.scripts.load_frequency_rank import load_data  # noqa: PLC0415

    # Simulate spaCy returning "σε ο" (multi-token) for the contraction "στο".
    multi_token_lemma = "σε ο"

    def mock_normalize_with_multi_token(word: str) -> NormalizedLemma:
        if word == "στο":
            # spaCy produced a multi-token lemma — confidence > 0 (it's "valid").
            return _make_normalized(word, multi_token_lemma, confidence=1.0)
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
                word_source=lambda: [("στο", 0.04), ("και", 0.03)],
                normalize=mock_normalize_with_multi_token,
                force=False,
            )

    all_rows = [row for _sql, batch in captured for row in batch]

    # The multi-token lemma must be present in the INSERT batch (no filter applied).
    assert any(multi_token_lemma in str(row) for row in all_rows), (
        f"Multi-token lemma '{multi_token_lemma}' must be accepted and inserted "
        f"(no single-token filter per D4 / AC-6); rows={all_rows!r}"
    )

    # Both tokens must produce rows (2 inputs → 2 distinct lemmas → 2 rows).
    assert len(all_rows) == 2, f"Expected 2 inserted rows; got {len(all_rows)}: {all_rows!r}"
