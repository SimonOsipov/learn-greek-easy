"""RED tests for LEXGEN-04-05: deck-export script.

These tests are authored BEFORE the implementation exists.
Expected failure mode: ModuleNotFoundError on `src.scripts.export_deck_lemmas`
(module does not yet exist).

===========================================================================
SEAM CONTRACT — the executor MUST implement these exact interfaces:
===========================================================================

MODULE: src/scripts/export_deck_lemmas.py

1. PURE CORE FUNCTION (unit-testable, no DB):
   resolve_deck_levels(rows: Iterable[tuple[str, str]]) -> tuple[list[dict], int]

   - Input: raw (lemma, deck_level) tuples — one per deck-membership; a lemma
     may repeat with different levels (one per deck it belongs to).
   - Output: (export_rows, b2_dropped_count)

   Level ordering (lowest wins): A1 < A2 < B1 < B2
   - For each lemma, the LOWEST level across its decks wins.
   - A lemma whose lowest level is B2 is DROPPED from export_rows but its count
     is accumulated in b2_dropped_count (D-B2-DROP-LOGGED / AC-16).
   - Kept lemmas appear exactly once in export_rows as:
       {"lemma": <lemma>, "level": <lowest A1/A2/B1>, "source": "deck_export"}

2. DB ENTRY POINT:
   export_deck_lemmas(out_path: str | Path, conn=None) -> dict
   main(argv=None) -> None

   - Queries raw (lemma, level) via psycopg2 (JOIN word_entries →
     deck_word_entries → decks); lowest-wins logic via resolve_deck_levels
     (NOT in SQL, to keep it unit-testable).
   - Writes kept rows as CSV: lemma,level,source under the default path
     data/cefr_lemma/ (gitignored).
   - Returns/logs a summary dict including b2_dropped count.

3. MODULE-LEVEL DEFAULT OUTPUT PATH CONSTANT:
   A module-level constant (e.g. DEFAULT_OUT_PATH or similar) whose resolved
   path falls under the gitignored data/cefr_lemma/ directory. Used by main()
   when no --out is provided.

4. DB-READ PRECEDENT (match load_cefr_lemma.py pattern):
   _get_connection() = psycopg2.connect(settings.database_url_sync)
   Unit tests mock _get_connection + cursor.fetchall (returning tuples).

===========================================================================
"""

from __future__ import annotations

import inspect
from pathlib import Path

import pytest

# ===========================================================================
# AC-4  test_level_from_parent_deck
# ===========================================================================


@pytest.mark.unit
def test_level_from_parent_deck():
    """A lemma in a single A2 deck → one export row with level='A2', source='deck_export'.

    Given: resolve_deck_levels receives one raw tuple (σπίτι, A2)
    When:  called
    Then:  export_rows == [{"lemma": "σπίτι", "level": "A2", "source": "deck_export"}]
           b2_dropped_count == 0
    """
    from src.scripts.export_deck_lemmas import resolve_deck_levels  # noqa: PLC0415

    rows = [("σπίτι", "A2")]
    export_rows, b2_dropped_count = resolve_deck_levels(rows)

    assert export_rows == [{"lemma": "σπίτι", "level": "A2", "source": "deck_export"}], (
        f"Single A2-deck lemma must export with level='A2' and source='deck_export'; "
        f"got export_rows={export_rows!r}"
    )
    assert (
        b2_dropped_count == 0
    ), f"No B2-only lemma in input; b2_dropped_count must be 0; got {b2_dropped_count!r}"


# ===========================================================================
# AC-4  test_lowest_level_wins_across_decks
# ===========================================================================


@pytest.mark.unit
def test_lowest_level_wins_across_decks():
    """A lemma in both a B1 deck and an A1 deck → exported at level='A1' (lowest wins).

    Given: resolve_deck_levels receives [("σπίτι", "B1"), ("σπίτι", "A1")]
    When:  called
    Then:  ONE export row with level='A1'
           b2_dropped_count == 0

    Also verifies the level ordering: A1 < A2 < B1 < B2 — A2 vs B1 gives A2.
    """
    from src.scripts.export_deck_lemmas import resolve_deck_levels  # noqa: PLC0415

    # B1 + A1 → A1 wins
    rows = [("σπίτι", "B1"), ("σπίτι", "A1")]
    export_rows, b2_dropped_count = resolve_deck_levels(rows)

    assert len(export_rows) == 1, (
        f"Duplicate lemma across two decks must collapse to ONE export row; "
        f"got {len(export_rows)} rows: {export_rows!r}"
    )
    assert (
        export_rows[0]["lemma"] == "σπίτι"
    ), f"Export row must carry the lemma 'σπίτι'; got {export_rows[0]!r}"
    assert (
        export_rows[0]["level"] == "A1"
    ), f"Lowest level must win: B1 vs A1 → A1; got level={export_rows[0]['level']!r}"
    assert (
        export_rows[0]["source"] == "deck_export"
    ), f"Source must always be 'deck_export'; got {export_rows[0]!r}"
    assert (
        b2_dropped_count == 0
    ), f"No B2-only lemma; b2_dropped_count must be 0; got {b2_dropped_count!r}"

    # Also verify A2 vs B1 ordering: A2 < B1 so A2 wins
    rows2 = [("βιβλίο", "B1"), ("βιβλίο", "A2")]
    export_rows2, _ = resolve_deck_levels(rows2)
    assert len(export_rows2) == 1
    assert (
        export_rows2[0]["level"] == "A2"
    ), f"B1 vs A2 → A2 must win (A2 < B1); got {export_rows2[0]['level']!r}"


# ===========================================================================
# AC-4 / AC-16  test_b2_only_word_dropped_and_counted
# ===========================================================================


@pytest.mark.unit
def test_b2_only_word_dropped_and_counted():
    """B2-only lemma → NOT in export_rows; b2_dropped_count reflects the drop.

    Sub-case 1: pure B2-only input
      Given: resolve_deck_levels([("ρήμα", "B2")])
      Then:  export_rows is empty, b2_dropped_count == 1

    Sub-case 2: mixed input — one B2-only lemma, one A1 lemma
      Given: resolve_deck_levels([("ρήμα", "B2"), ("σπίτι", "A1")])
      Then:  export_rows has ONLY σπίτι (level=A1), b2_dropped_count == 1

    Sub-case 3: lemma in BOTH B2 and A1 decks → lowest level is A1 → NOT dropped
      Given: resolve_deck_levels([("ρήμα", "B2"), ("ρήμα", "A1")])
      Then:  export_rows has ρήμα at A1, b2_dropped_count == 0

    AC-16 invariant: drops are COUNTED (never silent).
    """
    from src.scripts.export_deck_lemmas import resolve_deck_levels  # noqa: PLC0415

    # Sub-case 1: pure B2-only
    export_rows_1, b2_count_1 = resolve_deck_levels([("ρήμα", "B2")])
    assert (
        export_rows_1 == []
    ), f"B2-only lemma must NOT appear in export_rows; got {export_rows_1!r}"
    assert b2_count_1 == 1, f"b2_dropped_count must be 1 for one B2-only lemma; got {b2_count_1!r}"

    # Sub-case 2: mixed — B2-only ρήμα + A1 σπίτι
    export_rows_2, b2_count_2 = resolve_deck_levels([("ρήμα", "B2"), ("σπίτι", "A1")])
    lemmas_2 = [r["lemma"] for r in export_rows_2]
    assert (
        "ρήμα" not in lemmas_2
    ), f"B2-only 'ρήμα' must not be in export_rows; got lemmas={lemmas_2!r}"
    assert "σπίτι" in lemmas_2, f"A1 'σπίτι' must appear in export_rows; got lemmas={lemmas_2!r}"
    assert b2_count_2 == 1, f"b2_dropped_count must be 1 (ρήμα dropped); got {b2_count_2!r}"

    # Sub-case 3: ρήμα in BOTH B2 and A1 → lowest = A1 → kept, not dropped
    export_rows_3, b2_count_3 = resolve_deck_levels([("ρήμα", "B2"), ("ρήμα", "A1")])
    lemmas_3 = [r["lemma"] for r in export_rows_3]
    assert (
        "ρήμα" in lemmas_3
    ), f"'ρήμα' with lowest level A1 (also in B2 deck) must be KEPT; got {lemmas_3!r}"
    kept = [r for r in export_rows_3 if r["lemma"] == "ρήμα"]
    assert kept[0]["level"] == "A1", f"ρήμα kept row must be at level A1; got {kept[0]!r}"
    assert (
        b2_count_3 == 0
    ), f"ρήμα is NOT B2-only (lowest is A1); b2_dropped_count must be 0; got {b2_count_3!r}"


# ===========================================================================
# AC-INV-4  test_export_output_under_gitignored_data
# ===========================================================================


@pytest.mark.unit
def test_export_output_under_gitignored_data():
    """The module's default output path is under gitignored data/cefr_lemma/.

    Verifies:
    1. The module file itself lives under src/scripts/ (committed code, not data).
    2. A module-level constant for the default output path resolves to a path
       whose string contains 'data/cefr_lemma' — gitignored per .gitignore:17.
    3. The module-level constant is a Path (or str convertible to Path) pointing
       to data/cefr_lemma/ (relative to the project root / backend dir).

    Seam: inspect.getfile(module) verifies src/scripts/ placement.
          A module-level constant (DEFAULT_OUT_PATH, DEFAULT_OUTPUT_PATH, or similar)
          is checked for the 'data/cefr_lemma' substring.
    """
    import src.scripts.export_deck_lemmas as mod  # noqa: PLC0415

    # 1. The module source file must be under src/scripts/
    module_file = Path(inspect.getfile(mod))
    assert "src/scripts" in str(module_file).replace(
        "\\", "/"
    ), f"export_deck_lemmas must be under src/scripts/; found at {module_file}"
    assert (
        module_file.name == "export_deck_lemmas.py"
    ), f"Module file must be named export_deck_lemmas.py; found {module_file.name!r}"

    # 2. Find the default output path constant on the module.
    #    Accept any of: DEFAULT_OUT_PATH, DEFAULT_OUTPUT_PATH, DEFAULT_PATH,
    #    OUTPUT_DIR, EXPORT_DIR — the executor picks the name.
    candidate_names = [
        "DEFAULT_OUT_PATH",
        "DEFAULT_OUTPUT_PATH",
        "DEFAULT_PATH",
        "OUTPUT_DIR",
        "EXPORT_DIR",
        "DEFAULT_EXPORT_PATH",
        "OUT_PATH",
    ]
    found_constant = None
    for name in candidate_names:
        if hasattr(mod, name):
            found_constant = getattr(mod, name)
            break

    assert found_constant is not None, (
        f"Module src.scripts.export_deck_lemmas must expose a module-level default output "
        f"path constant (one of: {candidate_names}); none found. "
        f"The constant's value must resolve under gitignored data/cefr_lemma/."
    )

    # 3. The path must contain 'data/cefr_lemma' (gitignored per .gitignore line 17)
    constant_str = str(found_constant).replace("\\", "/")
    assert "data/cefr_lemma" in constant_str, (
        f"Default output path constant must resolve under 'data/cefr_lemma' "
        f"(gitignored); got {constant_str!r}"
    )


# ===========================================================================
# Adversarial coverage — QA-added (Mode B)
# ===========================================================================


@pytest.mark.unit
def test_a1_b2_same_lemma_kept_at_a1_not_dropped():
    """Critical boundary: {A1, B2} same lemma → kept at A1; b2_dropped_count stays 0.

    This is the key interaction between lowest-wins and B2-drop:
    B2-drop applies only when B2 is the LOWEST level. When A1 co-exists with B2,
    the lowest is A1 → the lemma is KEPT (not dropped), and b2_dropped_count must be 0.

    Given: resolve_deck_levels([("γάτα", "A1"), ("γάτα", "B2")])
    Then:  export_rows == [{"lemma": "γάτα", "level": "A1", "source": "deck_export"}]
           b2_dropped_count == 0
    """
    from src.scripts.export_deck_lemmas import resolve_deck_levels  # noqa: PLC0415

    # A1 seen first, then B2
    export_rows, b2_count = resolve_deck_levels([("γάτα", "A1"), ("γάτα", "B2")])
    assert len(export_rows) == 1, (
        f"Lemma in {{A1, B2}} decks must produce ONE export row (lowest=A1); "
        f"got {len(export_rows)} rows: {export_rows!r}"
    )
    assert (
        export_rows[0]["level"] == "A1"
    ), f"A1 must beat B2 (lowest-wins); got level={export_rows[0]['level']!r}"
    assert (
        b2_count == 0
    ), f"b2_dropped_count must be 0: lowest level is A1, not B2; got {b2_count!r}"

    # Also check with B2 seen first (order must not affect outcome)
    export_rows2, b2_count2 = resolve_deck_levels([("γάτα", "B2"), ("γάτα", "A1")])
    assert len(export_rows2) == 1
    assert (
        export_rows2[0]["level"] == "A1"
    ), f"B2-first then A1: lowest must still be A1; got {export_rows2[0]['level']!r}"
    assert (
        b2_count2 == 0
    ), f"b2_dropped_count must be 0 regardless of input order; got {b2_count2!r}"


@pytest.mark.unit
def test_three_decks_lowest_of_three_wins():
    """A lemma in three decks {B1, A2, B1} → exported at A2 (the actual lowest).

    Given: resolve_deck_levels([("λέξη", "B1"), ("λέξη", "A2"), ("λέξη", "B1")])
    Then:  ONE export row, level="A2"
           b2_dropped_count == 0
    """
    from src.scripts.export_deck_lemmas import resolve_deck_levels  # noqa: PLC0415

    export_rows, b2_count = resolve_deck_levels([("λέξη", "B1"), ("λέξη", "A2"), ("λέξη", "B1")])
    assert len(export_rows) == 1, (
        f"Three deck-memberships for one lemma must collapse to ONE row; "
        f"got {len(export_rows)}: {export_rows!r}"
    )
    assert (
        export_rows[0]["level"] == "A2"
    ), f"Lowest of {{B1, A2, B1}} must be A2; got {export_rows[0]['level']!r}"
    assert b2_count == 0, f"No B2-only lemma in input; got b2_count={b2_count!r}"


@pytest.mark.unit
def test_empty_input_returns_empty_rows_and_zero_count():
    """resolve_deck_levels([]) must return ([], 0) — empty input is safe.

    Given: resolve_deck_levels([])
    Then:  export_rows == [], b2_dropped_count == 0
    """
    from src.scripts.export_deck_lemmas import resolve_deck_levels  # noqa: PLC0415

    export_rows, b2_count = resolve_deck_levels([])
    assert export_rows == [], f"Empty input must return empty export_rows; got {export_rows!r}"
    assert b2_count == 0, f"Empty input must return b2_dropped_count=0; got {b2_count!r}"


@pytest.mark.unit
def test_unrecognised_level_raises_value_error():
    """An unrecognised deck level must raise ValueError — never silently bucketed.

    Given: resolve_deck_levels([("αβγ", "C1")])
    Then:  ValueError is raised (C1 is not in A1/A2/B1/B2)
    """
    from src.scripts.export_deck_lemmas import resolve_deck_levels  # noqa: PLC0415

    with pytest.raises(ValueError, match="C1"):
        resolve_deck_levels([("αβγ", "C1")])
