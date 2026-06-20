"""RED tests for LEXGEN-04-02: curated closed-class whitelist + no-attestation builder.

These tests are authored BEFORE the implementation exists.
Expected failure mode: ImportError on `src.scripts.cefr_closed_class` (module not yet created).
"""

import inspect

import pytest

# ---------------------------------------------------------------------------
# AC-18  test_whitelist_is_curated_and_sized
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_whitelist_is_curated_and_sized():
    """CLOSED_CLASS_LEMMAS is a finite explicit list of Greek lemmas.

    Invariants:
    - Length is in the sane curated range [50, 300].
    - Every entry is a non-empty string consisting only of Greek-script characters
      (Unicode block U+0370–U+03FF and combining/extended U+1F00–U+1FFF; also
      allows U+0300–U+036F combining diacritics and the middle dot U+00B7).
    - All entries are lowercase.
    - No duplicates.
    - A handful of must-have Greek function words are present.
    """
    from src.scripts.cefr_closed_class import CLOSED_CLASS_LEMMAS  # noqa: PLC0415

    # --- size ---
    assert (
        50 <= len(CLOSED_CLASS_LEMMAS) <= 300
    ), f"Expected 50–300 closed-class lemmas, got {len(CLOSED_CLASS_LEMMAS)}"

    # --- Greek-script content ---
    def _is_greek_script(word: str) -> bool:
        """Return True if every char is Greek-script, combining diacritics, or ·."""
        for ch in word:
            cp = ord(ch)
            if (
                0x0370 <= cp <= 0x03FF  # Greek and Coptic block
                or 0x1F00 <= cp <= 0x1FFF  # Greek Extended block
                or 0x0300 <= cp <= 0x036F  # Combining Diacritical Marks
                or cp == 0x00B7  # middle dot (·) used in Greek texts
            ):
                continue
            return False
        return True

    for lemma in CLOSED_CLASS_LEMMAS:
        assert (
            isinstance(lemma, str) and len(lemma) > 0
        ), f"Every entry must be a non-empty string; got {lemma!r}"
        assert _is_greek_script(
            lemma
        ), f"Lemma {lemma!r} contains non-Greek characters — Latin or other script"

    # --- lowercased ---
    for lemma in CLOSED_CLASS_LEMMAS:
        assert lemma == lemma.lower(), f"Lemma {lemma!r} is not lowercase"

    # --- deduped ---
    as_list = list(CLOSED_CLASS_LEMMAS)
    as_set = set(CLOSED_CLASS_LEMMAS)
    assert len(as_set) == len(
        as_list
    ), f"CLOSED_CLASS_LEMMAS has {len(as_list) - len(as_set)} duplicate(s)"

    # --- must-have words ---
    must_have = {"και", "ο", "σε", "να"}
    for word in must_have:
        assert (
            word in as_set
        ), f"Must-have closed-class word {word!r} missing from CLOSED_CLASS_LEMMAS"


# ---------------------------------------------------------------------------
# AC-15 / AC-18  test_closed_class_rows_built_a1_true
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_closed_class_rows_built_a1_true():
    """build_closed_class_rows() produces one row per whitelist lemma.

    Every row must have:
    - level == "A1"
    - closed_class is True
    - source == "closed_class"
    - lemma is one of CLOSED_CLASS_LEMMAS
    Row count == len(CLOSED_CLASS_LEMMAS).
    """
    from src.scripts.cefr_closed_class import (  # noqa: PLC0415
        CLOSED_CLASS_LEMMAS,
        build_closed_class_rows,
    )

    rows = build_closed_class_rows()

    whitelist_set = set(CLOSED_CLASS_LEMMAS)

    assert len(rows) == len(
        CLOSED_CLASS_LEMMAS
    ), f"Expected {len(CLOSED_CLASS_LEMMAS)} rows, got {len(rows)}"

    for i, row in enumerate(rows):
        # Support both dict rows and object rows with attribute access.
        if isinstance(row, dict):
            level = row["level"]
            closed_class = row["closed_class"]
            source = row["source"]
            lemma = row["lemma"]
        else:
            level = row.level
            closed_class = row.closed_class
            source = row.source
            lemma = row.lemma

        assert level == "A1", f"Row {i} (lemma={lemma!r}): expected level='A1', got {level!r}"
        assert (
            closed_class is True
        ), f"Row {i} (lemma={lemma!r}): expected closed_class=True, got {closed_class!r}"
        assert (
            source == "closed_class"
        ), f"Row {i} (lemma={lemma!r}): expected source='closed_class', got {source!r}"
        assert lemma in whitelist_set, f"Row {i}: lemma {lemma!r} is not in CLOSED_CLASS_LEMMAS"


# ---------------------------------------------------------------------------
# AC-15  test_closed_class_bypasses_attestation
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_closed_class_bypasses_attestation():
    """build_closed_class_rows() runs with no DB connection and no arguments.

    The function is pure: it requires no DB/connection argument and produces its
    full output without consulting attestation or normalization helpers.

    Structural proof:
    1. Calling build_closed_class_rows() with ZERO arguments succeeds.
    2. The function's signature has no required parameters (db/session/connection).
    3. The module exposes no reference to attestation/normalization callables that
       would be invoked during the build — verified by ensuring the builder does
       not import from known attestation modules at call time (we patch known
       attestation sentinel names at the module level if they happen to exist,
       then assert they were never called).
    """
    from unittest.mock import MagicMock, patch  # noqa: PLC0415

    import src.scripts.cefr_closed_class as ccm  # noqa: PLC0415
    from src.scripts.cefr_closed_class import build_closed_class_rows  # noqa: PLC0415

    # 1. Signature: no required parameters.
    sig = inspect.signature(build_closed_class_rows)
    required_params = [
        p
        for p in sig.parameters.values()
        if p.default is inspect.Parameter.empty
        and p.kind not in (inspect.Parameter.VAR_POSITIONAL, inspect.Parameter.VAR_KEYWORD)
    ]
    assert required_params == [], (
        f"build_closed_class_rows() must take no required args; found: "
        f"{[p.name for p in required_params]}"
    )

    # 2. Call succeeds with zero args and returns a non-empty sequence.
    result = build_closed_class_rows()
    assert len(result) > 0, "build_closed_class_rows() returned an empty sequence"

    # 3. No attestation call path: patch any sentinel names that might exist on the
    #    module, then call again and assert none were invoked.
    attestation_names = [
        "attest",
        "normalize",
        "get_attestation",
        "run_attestation",
        "lookup_attestation",
        "fetch_attestation",
    ]
    sentinels = {}
    for name in attestation_names:
        if hasattr(ccm, name):
            sentinels[name] = MagicMock()

    if sentinels:
        with patch.multiple("src.scripts.cefr_closed_class", **sentinels):
            build_closed_class_rows()
        for mock in sentinels.values():
            mock.assert_not_called()
    # If none of those names exist on the module, the builder is trivially
    # attestation-free — no patching needed, the zero-arg call above already proves it.


# ---------------------------------------------------------------------------
# AC-19  test_whitelist_committed_not_in_data_dir
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_whitelist_committed_not_in_data_dir():
    """The cefr_closed_class module resolves UNDER src/scripts/, NOT under data/.

    Uses importlib / inspect.getfile to find the actual file on disk.
    The gitignored data/ directory (.gitignore line 17: data/) must NOT appear
    in the resolved path.
    """
    import src.scripts.cefr_closed_class as ccm  # noqa: PLC0415

    module_file = inspect.getfile(ccm)
    module_path = module_file.replace("\\", "/")  # normalise on Windows

    assert (
        "/src/scripts/" in module_path
    ), f"cefr_closed_class should live under src/scripts/; found: {module_path}"
    assert "/data/" not in module_path, (
        f"cefr_closed_class must NOT live under the gitignored data/ dir; " f"found: {module_path}"
    )


# ---------------------------------------------------------------------------
# Adversarial: no empty/whitespace lemmas and all rows come from CLOSED_CLASS_LEMMAS
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_no_empty_lemmas_and_all_in_whitelist():
    """Every entry in CLOSED_CLASS_LEMMAS is a non-empty, non-whitespace string.

    Additionally, every lemma produced by build_closed_class_rows() must be a
    member of CLOSED_CLASS_LEMMAS — guards against the builder constructing rows
    for lemmas that were not in the curated list (e.g. a future refactor that
    reads from a different source).
    """
    from src.scripts.cefr_closed_class import (  # noqa: PLC0415
        CLOSED_CLASS_LEMMAS,
        build_closed_class_rows,
    )

    whitelist_set = set(CLOSED_CLASS_LEMMAS)

    # Every whitelist entry must be non-empty and non-whitespace.
    for lemma in CLOSED_CLASS_LEMMAS:
        assert (
            lemma and lemma.strip()
        ), f"CLOSED_CLASS_LEMMAS contains empty or whitespace-only entry: {lemma!r}"

    # Every row lemma must be drawn from the whitelist.
    rows = build_closed_class_rows()
    for row in rows:
        lemma = row["lemma"] if isinstance(row, dict) else row.lemma
        assert (
            lemma in whitelist_set
        ), f"build_closed_class_rows() produced lemma {lemma!r} not in CLOSED_CLASS_LEMMAS"


# ---------------------------------------------------------------------------
# Adversarial: build_closed_class_rows() is idempotent and returns a fresh list
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_build_closed_class_rows_is_pure_and_idempotent():
    """build_closed_class_rows() returns a fresh list object on each call.

    Two successive calls must:
    - Return objects with equal contents (idempotent / deterministic).
    - Be distinct list objects (not a shared mutable module-level singleton that
      a caller could corrupt by mutating the returned list).
    """
    from src.scripts.cefr_closed_class import build_closed_class_rows  # noqa: PLC0415

    rows_a = build_closed_class_rows()
    rows_b = build_closed_class_rows()

    # Same content.
    assert rows_a == rows_b, "build_closed_class_rows() returned different content on two calls"

    # Different list objects — not a shared reference.
    assert rows_a is not rows_b, (
        "build_closed_class_rows() returned the same list object on two calls; "
        "callers who mutate the result would corrupt subsequent calls"
    )
