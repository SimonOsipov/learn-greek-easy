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
from pydantic import ValidationError

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


# ===========================================================================
# Adversarial / edge / negative coverage (LEXGEN-02-03, MODE B).
#
# These EXTEND the AC tests above. They pin the converters' strict, no-normalize
# contract and the cross-module interaction with FormBundle's min_length=1 form.
# ===========================================================================


# ---------------------------------------------------------------------------
# Reverse round-trip — bundles_to_flat(flat_to_bundles(f)) == f
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_reverse_round_trip_canonical_flat() -> None:
    """bundles_to_flat(flat_to_bundles(f)) == f for a canonical 8-key flat dict.

    The AC-4 round-trip exercises bundles → flat → bundles. This pins the OTHER
    direction (flat → bundles → flat) for a canonically-ordered input dict.
    """
    f = dict(_HOUSE_FORMS)  # already in canonical key order

    round_tripped = bundles_to_flat(flat_to_bundles(f))

    assert round_tripped == f
    # Ordering, not just membership, survives the round trip.
    assert list(round_tripped.keys()) == _CANONICAL_FLAT_KEYS


@pytest.mark.unit
def test_reverse_round_trip_recanonicalizes_scrambled_flat() -> None:
    """A scrambled flat dict round-trips to the SAME values in canonical order.

    flat → bundles → flat is order-normalizing: even when the input keys are
    shuffled, the emitted dict is canonically ordered (and value-equal).
    """
    scrambled = {
        "vocative_plural": _HOUSE_FORMS["vocative_plural"],
        "nominative_singular": _HOUSE_FORMS["nominative_singular"],
        "genitive_plural": _HOUSE_FORMS["genitive_plural"],
        "accusative_singular": _HOUSE_FORMS["accusative_singular"],
        "genitive_singular": _HOUSE_FORMS["genitive_singular"],
        "nominative_plural": _HOUSE_FORMS["nominative_plural"],
        "vocative_singular": _HOUSE_FORMS["vocative_singular"],
        "accusative_plural": _HOUSE_FORMS["accusative_plural"],
    }

    round_tripped = bundles_to_flat(flat_to_bundles(scrambled))

    assert round_tripped == _HOUSE_FORMS
    assert list(round_tripped.keys()) == _CANONICAL_FLAT_KEYS


# ---------------------------------------------------------------------------
# bundles_to_flat determinism — output order independent of input list order
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_bundles_to_flat_input_order_independent() -> None:
    """Same bundles in a shuffled list → byte-identical ordered flat dict.

    bundles_to_flat must iterate the canonical grid, not the input list, so the
    emitted key sequence is invariant under input permutation.
    """
    canonical = _canonical_house_bundles()
    shuffled = list(reversed(canonical))

    flat_canonical = bundles_to_flat(canonical)
    flat_shuffled = bundles_to_flat(shuffled)

    # Equal as dicts AND equal key sequence (dict order is significant here).
    assert flat_shuffled == flat_canonical
    assert list(flat_shuffled.keys()) == list(flat_canonical.keys()) == _CANONICAL_FLAT_KEYS


# ---------------------------------------------------------------------------
# Partial paradigms — gaps don't break canonical ordering, both directions
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_partial_paradigm_two_cells_round_trip_and_order() -> None:
    """A 2-cell subset round-trips and stays canonically ordered.

    Cells supplied out of canonical order (plural before singular) must still
    emit singular-first.
    """
    # Supplied vocative_plural first, nominative_singular second.
    bundles = [
        _bundle("vocative", "plural", _HOUSE_FORMS["vocative_plural"]),
        _bundle("nominative", "singular", _HOUSE_FORMS["nominative_singular"]),
    ]

    flat = bundles_to_flat(bundles)

    # Singular cell precedes plural cell despite reversed input.
    assert list(flat.keys()) == ["nominative_singular", "vocative_plural"]
    # Round-trips byte-for-byte.
    assert flat_to_bundles(flat) == [
        _bundle("nominative", "singular", _HOUSE_FORMS["nominative_singular"]),
        _bundle("vocative", "plural", _HOUSE_FORMS["vocative_plural"]),
    ]


@pytest.mark.unit
def test_partial_paradigm_four_cells_canonical_order() -> None:
    """A 4-cell subset (singular-only) keeps nom→gen→acc→voc inner order."""
    flat = {
        "vocative_singular": _HOUSE_FORMS["vocative_singular"],
        "nominative_singular": _HOUSE_FORMS["nominative_singular"],
        "accusative_singular": _HOUSE_FORMS["accusative_singular"],
        "genitive_singular": _HOUSE_FORMS["genitive_singular"],
    }

    bundles = flat_to_bundles(flat)

    cases_in_order = [b.features["case"] for b in bundles]
    assert cases_in_order == ["nominative", "genitive", "accusative", "vocative"]
    assert all(b.features["number"] == "singular" for b in bundles)


# ---------------------------------------------------------------------------
# Empty inputs
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_bundles_to_flat_empty() -> None:
    """bundles_to_flat([]) == {}."""
    assert bundles_to_flat([]) == {}


@pytest.mark.unit
def test_flat_to_bundles_empty() -> None:
    """flat_to_bundles({}) == []."""
    assert flat_to_bundles({}) == []


# ---------------------------------------------------------------------------
# Gender-drop (D-FlatKeyGenderDrop) — no gender leakage into flat keys
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_bundles_to_flat_drops_gender() -> None:
    """A bundle carrying {case, number, gender} emits a {case}_{number} key only.

    Gender must not appear in the flat key in any form (not as a 3rd segment,
    not as a value suffix).
    """
    bundle = FormBundle(
        form="ο δάσκαλος",
        features={"case": "nominative", "number": "singular", "gender": "masculine"},
    )

    flat = bundles_to_flat([bundle])

    assert flat == {"nominative_singular": "ο δάσκαλος"}
    # No gender token leaked into any key.
    assert all("masculine" not in key for key in flat)
    assert list(flat) == ["nominative_singular"]


# ---------------------------------------------------------------------------
# Strict parsing — case-sensitivity, whitespace, segment count (no normalize)
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.parametrize(
    "bad_key",
    [
        "Nominative_singular",  # capitalized case
        "nominative_Singular",  # capitalized number
        "NOMINATIVE_SINGULAR",  # all caps
        " nominative_singular",  # leading whitespace on case
        "nominative_singular ",  # trailing whitespace on number
        "nominative _singular",  # internal whitespace
    ],
)
def test_flat_to_bundles_strict_no_normalization(bad_key: str) -> None:
    """Case-shifted / whitespace-padded keys are rejected — no normalization.

    The converter does not lower-case or strip; each of these must raise rather
    than silently coerce to a valid cell.
    """
    with pytest.raises(UnknownFlatFormKey):
        flat_to_bundles({bad_key: "x"})


@pytest.mark.unit
def test_flat_to_bundles_too_many_segments() -> None:
    """A 3-segment key (two underscores) → UnknownFlatFormKey (malformed)."""
    with pytest.raises(UnknownFlatFormKey):
        flat_to_bundles({"a_b_c": "x"})


@pytest.mark.unit
def test_flat_to_bundles_swapped_segments() -> None:
    """case/number in the wrong order (singular_nominative) → UnknownFlatFormKey.

    'singular' is not a valid case and 'nominative' is not a valid number, so a
    transposed key must be rejected (it is not silently re-ordered).
    """
    with pytest.raises(UnknownFlatFormKey):
        flat_to_bundles({"singular_nominative": "x"})


@pytest.mark.unit
def test_flat_to_bundles_empty_string_key() -> None:
    """An empty-string key has one segment → UnknownFlatFormKey (malformed)."""
    with pytest.raises(UnknownFlatFormKey):
        flat_to_bundles({"": "x"})


@pytest.mark.unit
def test_flat_to_bundles_strict_fails_whole_batch_on_one_bad_key() -> None:
    """A single bad key fails the entire conversion (strict, all-or-nothing).

    Even when every other key is valid, one unknown key raises — no partial
    bundle list is returned.
    """
    flat = {
        "nominative_singular": "σπίτι",
        "dative_singular": "x",  # the one poison key
        "genitive_plural": "σπιτιών",
    }
    with pytest.raises(UnknownFlatFormKey):
        flat_to_bundles(flat)


# ---------------------------------------------------------------------------
# Cross-module surface — FormBundle.form has min_length=1
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_flat_to_bundles_empty_value_raises_validation_error_not_domain_error() -> None:
    """PINS CURRENT BEHAVIOR (FINDING, advisory): an empty form VALUE surfaces a
    pydantic ``ValidationError``, NOT ``UnknownFlatFormKey``.

    The key ``nominative_singular`` parses fine, so flat_to_bundles proceeds to
    construct ``FormBundle(form="", ...)`` which trips ``form``'s
    ``min_length=1`` constraint. Callers that only catch ``UnknownFlatFormKey``
    will NOT catch this — the error class differs by which part of the entry is
    malformed (key vs value). Documented here so the behavior is not changed by
    accident; see the QA findings note.
    """
    with pytest.raises(ValidationError):
        flat_to_bundles({"nominative_singular": ""})

    # And specifically NOT the domain exception (proves the surface split).
    with pytest.raises(ValidationError):
        flat_to_bundles({"nominative_singular": ""})


# ---------------------------------------------------------------------------
# Duplicate cells — pin collision behavior
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_bundles_to_flat_duplicate_cells_rejected() -> None:
    """Two bundles for the same {case,number} cell → UnknownFlatFormKey.

    STRICT (D-Strict): a duplicate cell is an error, never a silent last-wins
    overwrite — symmetric with ``flat_to_bundles``'s fail-loud posture.
    """
    first = FormBundle(form="A", features={"case": "nominative", "number": "singular"})
    second = FormBundle(form="B", features={"case": "nominative", "number": "singular"})

    with pytest.raises(UnknownFlatFormKey):
        bundles_to_flat([first, second])


@pytest.mark.unit
def test_bundles_to_flat_non_canonical_value_rejected() -> None:
    """A well-formed bundle with a non-canonical case/number VALUE → raises.

    ``FormBundle`` validates feature KEYS, not VALUES, so ``case="dative"`` and
    ``number="dual"`` build valid bundles — but they are not canonical paradigm
    cells, so ``bundles_to_flat`` must reject them (not silently drop them in the
    canonical-order emit loop).
    """
    non_canonical_case = FormBundle(form="x", features={"case": "dative", "number": "singular"})
    with pytest.raises(UnknownFlatFormKey):
        bundles_to_flat([non_canonical_case])

    non_canonical_number = FormBundle(form="y", features={"case": "nominative", "number": "dual"})
    with pytest.raises(UnknownFlatFormKey):
        bundles_to_flat([non_canonical_number])


# ---------------------------------------------------------------------------
# bundles_to_flat — malformed bundle (missing case/number feature)
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_bundles_to_flat_missing_number_feature_raises() -> None:
    """A bundle whose features lack 'number' → UnknownFlatFormKey (not a silent drop)."""
    bundle = FormBundle(form="x", features={"case": "nominative"})
    with pytest.raises(UnknownFlatFormKey):
        bundles_to_flat([bundle])


@pytest.mark.unit
def test_bundles_to_flat_missing_case_feature_raises() -> None:
    """A bundle whose features lack 'case' → UnknownFlatFormKey."""
    bundle = FormBundle(form="x", features={"number": "singular"})
    with pytest.raises(UnknownFlatFormKey):
        bundles_to_flat([bundle])


@pytest.mark.unit
def test_bundles_to_flat_gender_only_feature_raises() -> None:
    """A bundle carrying only 'gender' (no case/number) → UnknownFlatFormKey.

    Gender alone cannot form a flat key; the malformed-bundle guard fires.
    """
    bundle = FormBundle(form="x", features={"gender": "masculine"})
    with pytest.raises(UnknownFlatFormKey):
        bundles_to_flat([bundle])


# ---------------------------------------------------------------------------
# UnknownFlatFormKey is a plain Exception (not HTTPException) + importable
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_unknown_flat_form_key_is_plain_exception() -> None:
    """UnknownFlatFormKey is a bare domain Exception, not a FastAPI HTTPException.

    Mirrors IllegalProposalTransition (LEXGEN-01): pure domain error, the caller
    maps it to HTTP. It must NOT subclass HTTPException (which would smuggle a
    status_code into a layer that has no business with HTTP).
    """
    from fastapi import HTTPException

    assert issubclass(UnknownFlatFormKey, Exception)
    assert not issubclass(UnknownFlatFormKey, HTTPException)

    err = UnknownFlatFormKey("boom")
    assert isinstance(err, Exception)
    assert not hasattr(err, "status_code")
