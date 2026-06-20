"""RED tests for LEXGEN-04-04: ΚΕΓ ΚΛΙΚ PDF→CSV glossary line parser.

These tests are authored BEFORE the implementation exists.
Expected failure mode: ImportError on `src.scripts.parse_keg_glossary`
(module not yet created).

Design seam the executor must implement exactly:

    parse_glossary_lines(lines: Iterable[str], level: str)
        -> tuple[list[dict], list[dict]]

        Pure core.  Takes pre-extracted text lines + the level string
        (already derived from the filename by the caller).

        Returns (rows, flagged):
          rows    — one dict per well-formed line:
                    {"lemma": <str lowercased+stripped>,
                     "level": <str>,
                     "source": "keg_glossary"}
                    Well-formed means a comma-separated form "<lemma>, <article> = <english>"
                    with an extractable non-empty lemma before the first comma.
          flagged — one dict per malformed/unparseable line (no extractable lemma,
                    e.g. page headers, empty-lemma lines, no-comma lines):
                    {"raw": <verbatim line>,
                     "level": <str>,
                     "source": "keg_glossary",
                     "reason": "malformed"}
                    Malformed lines are NEVER silently dropped and NEVER guessed
                    a lemma (F5 / D-MALFORMED-VERBATIM).

    level_from_filename(filename: str) -> str
        Maps KLIK_A1_* → "A1", KLIK_A2_* → "A2",
              KLIK_B1_* → "B1", KLIK_B2_* → "B2".
        Level comes from the FILENAME, not any per-line field.

NOTE: The executor also adds a thin PDF-reading wrapper parse_glossary_pdf(path)
that extracts raw text then calls parse_glossary_lines — that wrapper is NOT
tested here (it requires a PDF library that is not in committed deps).
"""

import inspect
import pathlib

import pytest

# ---------------------------------------------------------------------------
# AC-3  test_parses_glossary_line_to_lemma_level
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_parses_glossary_line_to_lemma_level():
    """A well-formed glossary line produces the correct row; level_from_filename works.

    Given:
        lines = ["σπίτι, το = house"]
        level = "A1"
    When:
        parse_glossary_lines(lines, level="A1") is called
    Then:
        rows contains exactly one dict:
            {"lemma": "σπίτι", "level": "A1", "source": "keg_glossary"}
        flagged is empty.

    Also asserts:
        level_from_filename("KLIK_A1_Ef_Glossary.pdf") == "A1"
        level_from_filename("KLIK_B1_Glossary.pdf")    == "B1"
    """
    from src.scripts.parse_keg_glossary import (  # noqa: PLC0415
        level_from_filename,
        parse_glossary_lines,
    )

    rows, flagged = parse_glossary_lines(["σπίτι, το = house"], level="A1")

    assert len(rows) == 1, f"Expected 1 row, got {len(rows)}: {rows}"
    assert len(flagged) == 0, f"Expected 0 flagged, got {len(flagged)}: {flagged}"

    row = rows[0]
    assert row["lemma"] == "σπίτι", (
        f"Expected lemma='σπίτι', got {row['lemma']!r}. "
        "Lemma must be lowercased and stripped from text before the first comma."
    )
    assert row["level"] == "A1", f"Expected level='A1', got {row['level']!r}"
    assert row["source"] == "keg_glossary", f"Expected source='keg_glossary', got {row['source']!r}"

    # level_from_filename contract
    assert (
        level_from_filename("KLIK_A1_Ef_Glossary.pdf") == "A1"
    ), "level_from_filename must return 'A1' for a KLIK_A1_* filename"
    assert (
        level_from_filename("KLIK_B1_Glossary.pdf") == "B1"
    ), "level_from_filename must return 'B1' for a KLIK_B1_* filename"


# ---------------------------------------------------------------------------
# AC-3  test_output_source_is_keg_glossary
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_output_source_is_keg_glossary():
    """Every row emitted by parse_glossary_lines has source == "keg_glossary".

    Given several well-formed glossary lines for level B2:
        ["βιβλίο, το = book", "μητέρα, η = mother", "τρώω, - = I eat"]
    When:
        parse_glossary_lines(lines, level="B2") is called
    Then:
        rows is non-empty
        EVERY row["source"] == "keg_glossary"
    """
    from src.scripts.parse_keg_glossary import parse_glossary_lines  # noqa: PLC0415

    well_formed = [
        "βιβλίο, το = book",
        "μητέρα, η = mother",
        "τρώω, - = I eat",
    ]
    rows, flagged = parse_glossary_lines(well_formed, level="B2")

    assert len(rows) > 0, (
        "Expected at least one row from well-formed glossary lines; got none. " f"flagged={flagged}"
    )

    for i, row in enumerate(rows):
        assert row["source"] == "keg_glossary", (
            f"Row {i} (lemma={row.get('lemma')!r}): "
            f"expected source='keg_glossary', got {row['source']!r}"
        )


# ---------------------------------------------------------------------------
# AC-5  test_malformed_line_emitted_verbatim_flagged_not_dropped
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_malformed_line_emitted_verbatim_flagged_not_dropped():
    """A structurally malformed line is captured verbatim and flagged — never dropped.

    Given a mixed batch:
        "σπίτι, το = house"   — well-formed
        "=== page 3 ==="      — malformed: page header, no extractable lemma
        ", = "                — malformed: empty lemma before the comma
    When:
        parse_glossary_lines(lines, level="A2") is called
    Then:
        The well-formed line appears in rows (lemma="σπίτι").
        Each malformed line appears verbatim in flagged["raw"] — exact string preserved.
        No malformed line appears in rows (no guessed lemma).
        flagged is non-empty (count >= 1 for the page-header alone; both malformed
            lines must each appear verbatim).
        No malformed line is silently dropped (len(rows) + len(flagged) == len(input)).
    """
    from src.scripts.parse_keg_glossary import parse_glossary_lines  # noqa: PLC0415

    page_header = "=== page 3 ==="
    empty_lemma = ", = "
    well_formed = "σπίτι, το = house"

    lines = [well_formed, page_header, empty_lemma]
    rows, flagged = parse_glossary_lines(lines, level="A2")

    # --- well-formed line parsed into rows ---
    row_lemmas = [r["lemma"] for r in rows]
    assert "σπίτι" in row_lemmas, (
        f"Well-formed line 'σπίτι, το = house' must produce lemma='σπίτι' in rows; "
        f"got row lemmas: {row_lemmas}"
    )

    # --- malformed lines appear verbatim in flagged ---
    flagged_raws = [f["raw"] for f in flagged]

    assert page_header in flagged_raws, (
        f"Page header {page_header!r} must appear verbatim in flagged['raw']; "
        f"got flagged raws: {flagged_raws}"
    )
    assert empty_lemma in flagged_raws, (
        f"Empty-lemma line {empty_lemma!r} must appear verbatim in flagged['raw']; "
        f"got flagged raws: {flagged_raws}"
    )

    # --- malformed lines NOT in rows (no guessed lemma) ---
    assert (
        page_header not in row_lemmas
    ), "Page header must NOT produce any row; parser must not guess a lemma"
    # The empty-lemma line should not produce a row either.
    for row in rows:
        assert row["lemma"] not in (
            "",
            " ",
            ",",
        ), f"Parser guessed an empty/whitespace lemma for a malformed line: {row!r}"

    # --- nothing silently dropped ---
    assert len(rows) + len(flagged) == len(lines), (
        f"No line may be silently dropped: "
        f"len(rows)={len(rows)} + len(flagged)={len(flagged)} "
        f"should equal len(lines)={len(lines)}"
    )

    # --- flagged count sanity ---
    assert len(flagged) >= 1, f"Expected at least 1 flagged entry, got {len(flagged)}"


# ---------------------------------------------------------------------------
# AC-INV-4  test_no_real_keg_data_committed
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_no_real_keg_data_committed():
    """The parser module lives under src/scripts/ (committed), not gitignored data/.

    1. parse_keg_glossary resolves to a path under src/scripts/ — not data/.
    2. The synthetic committed fixture (tests/fixtures/cefr/keg_glossary_sample.txt)
       is present, clearly synthetic (contains the SYNTHETIC marker comment), and
       small (< 50 lines, i.e. not a real glossary dump).
    3. Any module-level default input/output paths defined in parse_keg_glossary
       point under 'data/cefr_lemma/' — the gitignored directory — NOT under
       tests/ or src/ (so real ΚΕΓ PDF data can never be accidentally committed
       via those defaults).
    """
    import src.scripts.parse_keg_glossary as pkm  # noqa: PLC0415

    # 1. Parser module is committed under src/scripts/
    module_file = inspect.getfile(pkm)
    module_path = module_file.replace("\\", "/")

    assert (
        "/src/scripts/" in module_path
    ), f"parse_keg_glossary should live under src/scripts/; found: {module_path}"
    assert "/data/" not in module_path, (
        f"parse_keg_glossary must NOT live under the gitignored data/ dir; " f"found: {module_path}"
    )

    # 2. Synthetic fixture: present, marked, small
    fixture_path = (
        pathlib.Path(__file__).parent.parent.parent  # tests/
        / "fixtures"
        / "cefr"
        / "keg_glossary_sample.txt"
    )
    assert fixture_path.exists(), (
        f"Synthetic fixture not found at {fixture_path}. "
        "Create tests/fixtures/cefr/keg_glossary_sample.txt with clearly synthetic data."
    )

    fixture_text = fixture_path.read_text(encoding="utf-8")
    assert "SYNTHETIC" in fixture_text, (
        "keg_glossary_sample.txt must contain a '# SYNTHETIC' marker "
        "to document that it is NOT real ΚΕΓ data."
    )

    fixture_lines = fixture_text.splitlines()
    assert len(fixture_lines) < 50, (
        f"Synthetic fixture has {len(fixture_lines)} lines — too large; "
        "must be obviously small and not a real glossary dump (< 50 lines)."
    )

    # 3. If the module exposes default I/O path constants, they must point into
    #    the gitignored data/cefr_lemma/ directory.
    default_path_attrs = [
        name
        for name in dir(pkm)
        if "path" in name.lower()
        or "dir" in name.lower()
        or "output" in name.lower()
        or "input" in name.lower()
    ]
    for attr in default_path_attrs:
        val = getattr(pkm, attr)
        if not isinstance(val, (str, pathlib.Path)):
            continue
        val_str = str(val).replace("\\", "/")
        # Any committed default I/O path must sit under data/cefr_lemma/ (gitignored).
        # It must NOT point into src/ or tests/ (those are committed).
        assert "/src/" not in val_str and "/tests/" not in val_str, (
            f"Module attribute {attr!r}={val_str!r} points into a committed directory. "
            "Default I/O paths for real ΚΕΓ data must be under gitignored data/cefr_lemma/."
        )


# ---------------------------------------------------------------------------
# ADVERSARIAL: extra-commas, whitespace+case, unknown filename
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_extra_commas_lemma_is_before_first_comma():
    """A line with multiple commas: lemma is the part before the FIRST comma only.

    Given:
        "σπίτι, το, επιπλέον = house, home"
    When:
        parse_glossary_lines([line], level="A1")
    Then:
        rows[0]["lemma"] == "σπίτι"   (not "σπίτι, το" or the full line)
        flagged is empty
    """
    from src.scripts.parse_keg_glossary import parse_glossary_lines  # noqa: PLC0415

    line = "σπίτι, το, επιπλέον = house, home"
    rows, flagged = parse_glossary_lines([line], level="A1")

    assert len(rows) == 1, f"Expected 1 row, got {len(rows)}: rows={rows} flagged={flagged}"
    assert rows[0]["lemma"] == "σπίτι", (
        f"Lemma must be text before the FIRST comma only; "
        f"got {rows[0]['lemma']!r} for line {line!r}"
    )
    assert len(flagged) == 0, f"No flagged entries expected; got {flagged}"


@pytest.mark.unit
def test_leading_trailing_whitespace_and_uppercase_lemma_normalised():
    """A line with leading/trailing whitespace and uppercase lemma is lowercased+stripped.

    Given:
        "  ΣΠΊΤΙ , το = House  "
    When:
        parse_glossary_lines([line], level="B1")
    Then:
        rows[0]["lemma"] == "σπίτι"   (lowercased, stripped)
        flagged is empty
    """
    from src.scripts.parse_keg_glossary import parse_glossary_lines  # noqa: PLC0415

    line = "  ΣΠΊΤΙ , το = House  "
    rows, flagged = parse_glossary_lines([line], level="B1")

    assert len(rows) == 1, f"Expected 1 row, got {len(rows)}: rows={rows} flagged={flagged}"
    assert rows[0]["lemma"] == "σπίτι", (
        f"Lemma must be lowercased and stripped; " f"got {rows[0]['lemma']!r} for line {line!r}"
    )
    assert len(flagged) == 0, f"No flagged entries expected; got {flagged}"


@pytest.mark.unit
def test_level_from_filename_raises_on_unknown():
    """level_from_filename raises ValueError for an unrecognised filename prefix.

    Given:
        filename = "UNKNOWN_glossary.pdf"
    When:
        level_from_filename("UNKNOWN_glossary.pdf")
    Then:
        ValueError is raised — the parser never silently defaults a level.
    """
    from src.scripts.parse_keg_glossary import level_from_filename  # noqa: PLC0415

    with pytest.raises(ValueError, match="KLIK_A1"):
        level_from_filename("UNKNOWN_glossary.pdf")
