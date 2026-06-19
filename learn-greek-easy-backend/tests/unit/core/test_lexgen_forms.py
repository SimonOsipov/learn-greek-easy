"""RED tests for strict flat-key ⇄ FormBundle converters (LEXGEN-02-03).

Authored test-first (RALPH Stage 2.5). The converters in
``src/core/lexgen_forms.py`` are STUBS that raise ``NotImplementedError``, so
every test that calls them is RED for the right reason (not-implemented), NOT a
collection error — the imports below resolve against the stub + the new
``UnknownFlatFormKey`` domain exception.

Test Specs (AC → test):
- AC-1 test_bundles_to_flat_keys_and_order
- AC-2 test_flat_to_bundles_reconstructs
- AC-2 test_flat_to_bundles_canonical_order
- AC-3 test_flat_to_bundles_raises_on_unknown_case
- AC-3 test_flat_to_bundles_raises_on_malformed_key
- AC-4 test_round_trip_noun_paradigm
- AC-5 test_no_flat_keys_outside_converter (guard — may PASS already)

Canonical paradigm order: number sg→pl OUTER, case nom→gen→acc→voc INNER, i.e.
nominative_singular, genitive_singular, accusative_singular, vocative_singular,
nominative_plural, genitive_plural, accusative_plural, vocative_plural.
"""

from pathlib import Path

import pytest

from src.core.exceptions import UnknownFlatFormKey
from src.core.lexgen_forms import bundles_to_flat, flat_to_bundles
from src.schemas.lexgen import FormBundle

# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

# The eight canonical flat keys in canonical paradigm order (sg→pl, nom→gen→acc→voc).
_CANONICAL_FLAT_KEYS: list[str] = [
    "nominative_singular",
    "genitive_singular",
    "accusative_singular",
    "vocative_singular",
    "nominative_plural",
    "genitive_plural",
    "accusative_plural",
    "vocative_plural",
]

# A representative 8-cell noun paradigm: το σπίτι ("the house", neuter). Features
# carry ONLY {case, number} (no gender) so bundles_to_flat (which drops gender,
# D-FlatKeyGenderDrop) round-trips byte-for-byte back to these exact bundles.
_HOUSE_FORMS: dict[str, str] = {
    "nominative_singular": "σπίτι",
    "genitive_singular": "σπιτιού",
    "accusative_singular": "σπίτι",
    "vocative_singular": "σπίτι",
    "nominative_plural": "σπίτια",
    "genitive_plural": "σπιτιών",
    "accusative_plural": "σπίτια",
    "vocative_plural": "σπίτια",
}


def _bundle(case: str, number: str, form: str) -> FormBundle:
    """Build a case+number-only FormBundle (no gender feature)."""
    return FormBundle(form=form, features={"case": case, "number": number})


def _canonical_house_bundles() -> list[FormBundle]:
    """The 8-cell house paradigm as FormBundles, in canonical paradigm order."""
    bundles: list[FormBundle] = []
    for number in ("singular", "plural"):
        for case in ("nominative", "genitive", "accusative", "vocative"):
            bundles.append(_bundle(case, number, _HOUSE_FORMS[f"{case}_{number}"]))
    return bundles


# ---------------------------------------------------------------------------
# AC-1 — bundles_to_flat: keys present + canonical order
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_bundles_to_flat_keys_and_order() -> None:
    """8-cell paradigm → 8 flat keys in canonical order, values are the forms."""
    bundles = _canonical_house_bundles()

    flat = bundles_to_flat(bundles)

    # All 8 canonical {case}_{number} keys present, in canonical insertion order.
    assert list(flat.keys()) == _CANONICAL_FLAT_KEYS
    # Values are the surface forms.
    assert flat == _HOUSE_FORMS


# ---------------------------------------------------------------------------
# AC-2 — flat_to_bundles: reconstruct features
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_flat_to_bundles_reconstructs() -> None:
    """Flat keys reconstruct FormBundles with the right {case, number} features."""
    flat = {
        "genitive_plural": "σπιτιών",
        "nominative_singular": "σπίτι",
    }

    bundles = flat_to_bundles(flat)

    by_form = {b.form: b.features for b in bundles}
    assert by_form["σπιτιών"] == {"case": "genitive", "number": "plural"}
    assert by_form["σπίτι"] == {"case": "nominative", "number": "singular"}


@pytest.mark.unit
def test_flat_to_bundles_canonical_order() -> None:
    """Scrambled input dict → output list in canonical paradigm order."""
    # Same 8 cells but in a deliberately scrambled key order.
    scrambled = {
        "vocative_plural": _HOUSE_FORMS["vocative_plural"],
        "nominative_singular": _HOUSE_FORMS["nominative_singular"],
        "accusative_plural": _HOUSE_FORMS["accusative_plural"],
        "genitive_singular": _HOUSE_FORMS["genitive_singular"],
        "nominative_plural": _HOUSE_FORMS["nominative_plural"],
        "vocative_singular": _HOUSE_FORMS["vocative_singular"],
        "genitive_plural": _HOUSE_FORMS["genitive_plural"],
        "accusative_singular": _HOUSE_FORMS["accusative_singular"],
    }

    bundles = flat_to_bundles(scrambled)

    produced_order = [(b.features["case"], b.features["number"]) for b in bundles]
    expected_order = [
        (case, number)
        for number in ("singular", "plural")
        for case in ("nominative", "genitive", "accusative", "vocative")
    ]
    assert produced_order == expected_order


# ---------------------------------------------------------------------------
# AC-3 — flat_to_bundles: strict rejection of unknown / malformed keys
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_flat_to_bundles_raises_on_unknown_case() -> None:
    """An unknown case segment (dative) → UnknownFlatFormKey."""
    with pytest.raises(UnknownFlatFormKey):
        flat_to_bundles({"dative_singular": "x"})


@pytest.mark.unit
def test_flat_to_bundles_raises_on_malformed_key() -> None:
    """Keys with no separator or a missing number segment → UnknownFlatFormKey."""
    # No underscore separator at all.
    with pytest.raises(UnknownFlatFormKey):
        flat_to_bundles({"genitiveplural": "x"})

    # Case segment present but no number segment.
    with pytest.raises(UnknownFlatFormKey):
        flat_to_bundles({"nominative": "x"})


# ---------------------------------------------------------------------------
# AC-4 — round trip
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_round_trip_noun_paradigm() -> None:
    """flat_to_bundles(bundles_to_flat(x)) == x for a canonical-order paradigm."""
    x = _canonical_house_bundles()

    round_tripped = flat_to_bundles(bundles_to_flat(x))

    assert round_tripped == x


# ---------------------------------------------------------------------------
# AC-5 — guard: flat-key literals live ONLY in the converter module
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_no_flat_keys_outside_converter() -> None:
    """src/schemas/lexgen.py must not hardcode flat-key literals.

    The converter module (lexgen_forms.py) is the only place that knows the
    flat-key grammar; the schema module must stay flat-key-free.
    """
    schema_path = Path(__file__).resolve().parents[3] / "src" / "schemas" / "lexgen.py"
    source = schema_path.read_text(encoding="utf-8")

    assert '"_singular"' not in source
    assert '"_plural"' not in source
