"""Strict flat-key ⇄ FormBundle converters (LEXGEN-02-03).

The ONLY site in the codebase that knows about flat, underscore-joined
morphology keys like ``genitive_plural``. Everything internal carries forms as
feature-keyed ``FormBundle``s (seam #1); flat keys exist only at the UI edge.

- ``bundles_to_flat``: ``list[FormBundle]`` → ``{"{case}_{number}": form}`` in
  canonical paradigm order. The ``gender`` feature is DROPPED
  (D-FlatKeyGenderDrop) — flat keys carry only case+number.
- ``flat_to_bundles``: ``{"{case}_{number}": form}`` → ``list[FormBundle]`` in
  canonical paradigm order, with ``features == {"case": ..., "number": ...}``.
  Any key that is not a known ``{case}_{number}`` pair raises
  ``UnknownFlatFormKey``.

No DB, HTTP, session, or ``GreekLexicon`` access happens here — these are pure
functions over the value types, mirroring ``src/core/word_proposal_state.py``.

Canonical paradigm order
------------------------
Both converters emit cells in the same deterministic order: number OUTER
(singular → plural), case INNER (nominative → genitive → accusative →
vocative). This makes the converter pair order-stable in both directions, so
``flat_to_bundles(bundles_to_flat(x)) == x`` holds whenever ``x`` is already in
canonical order.
"""

from __future__ import annotations

from src.core.exceptions import UnknownFlatFormKey
from src.schemas.lexgen import FormBundle

# Canonical orderings. Cases are emitted nominative → genitive → accusative →
# vocative (inner loop); numbers singular → plural (outer loop).
_CANONICAL_CASES: tuple[str, ...] = (
    "nominative",
    "genitive",
    "accusative",
    "vocative",
)
_CANONICAL_NUMBERS: tuple[str, ...] = ("singular", "plural")

_VALID_CASES: frozenset[str] = frozenset(_CANONICAL_CASES)
_VALID_NUMBERS: frozenset[str] = frozenset(_CANONICAL_NUMBERS)


def bundles_to_flat(bundles: list[FormBundle]) -> dict[str, str]:
    """Convert feature-keyed bundles to a canonical-ordered flat-key dict.

    For each bundle the flat key is ``f"{case}_{number}"`` (the ``gender``
    feature, if any, is DROPPED — D-FlatKeyGenderDrop). Keys are emitted in
    canonical paradigm order (number outer sg→pl, case inner nom→gen→acc→voc),
    independent of the input list order: we iterate the canonical grid and
    include a cell only when a matching bundle is present.

    STRICT (symmetric with ``flat_to_bundles``): a bundle is rejected with
    ``UnknownFlatFormKey`` when it

    - lacks ``case`` or ``number`` features (malformed paradigm),
    - carries a non-canonical ``case`` or ``number`` VALUE — e.g.
      ``case="dative"`` or ``number="dual"`` (``FormBundle`` validates feature
      KEYS, not VALUES, so such a bundle is well-formed yet not a valid
      paradigm cell), or
    - collides with another bundle on the same ``(case, number)`` cell
      (duplicate cells are an error, never silently overwritten).
    """
    # Index input bundles by their (case, number) cell. Validate each bundle
    # carries both required features, that those values are canonical, and that
    # no two bundles claim the same cell — a missing/non-canonical feature or a
    # duplicate cell must not silently drop or overwrite a form.
    by_cell: dict[tuple[str, str], str] = {}
    for bundle in bundles:
        case = bundle.features.get("case")
        number = bundle.features.get("number")
        if case is None or number is None:
            raise UnknownFlatFormKey(f"Bundle is missing case/number features: {bundle.features!r}")
        if case not in _VALID_CASES or number not in _VALID_NUMBERS:
            raise UnknownFlatFormKey(
                f"Non-canonical bundle cell (case={case!r}, number={number!r}): "
                f"case must be one of {_CANONICAL_CASES}, number one of {_CANONICAL_NUMBERS}."
            )
        cell = (case, number)
        if cell in by_cell:
            raise UnknownFlatFormKey(f"Duplicate (case, number) cell: {cell!r}.")
        by_cell[cell] = bundle.form

    flat: dict[str, str] = {}
    for number in _CANONICAL_NUMBERS:
        for case in _CANONICAL_CASES:
            cell = (case, number)
            if cell in by_cell:
                flat[f"{case}_{number}"] = by_cell[cell]
    return flat


def flat_to_bundles(flat: dict[str, str], pos: str = "noun") -> list[FormBundle]:
    """Convert a flat-key dict to canonical-ordered feature-keyed bundles.

    STRICT: each key must parse as exactly ``"{case}_{number}"`` with ``case``
    in :data:`_CANONICAL_CASES` and ``number`` in :data:`_CANONICAL_NUMBERS`.
    Anything else — an unknown case (``dative_singular``), a key with no
    separator or a missing segment (``genitiveplural``, ``nominative``) — raises
    ``UnknownFlatFormKey``.

    The returned list is in canonical paradigm order (number outer sg→pl, case
    inner nom→gen→acc→voc), identical to ``bundles_to_flat`` so the pair
    round-trips. ``pos`` is accepted for caller symmetry but does not affect the
    case/number-only feature bundles produced here.
    """
    # Parse + validate every key first, indexing surviving cells by (case,
    # number). A single bad key fails the whole conversion (strict).
    by_cell: dict[tuple[str, str], str] = {}
    for key, value in flat.items():
        parts = key.split("_")
        if len(parts) != 2:
            raise UnknownFlatFormKey(
                f"Malformed flat key {key!r}: expected exactly one '_' separator."
            )
        case, number = parts
        if case not in _VALID_CASES or number not in _VALID_NUMBERS:
            raise UnknownFlatFormKey(
                f"Unknown flat key {key!r}: case must be one of "
                f"{_CANONICAL_CASES}, number one of {_CANONICAL_NUMBERS}."
            )
        by_cell[(case, number)] = value

    bundles: list[FormBundle] = []
    for number in _CANONICAL_NUMBERS:
        for case in _CANONICAL_CASES:
            cell = (case, number)
            if cell in by_cell:
                bundles.append(
                    FormBundle(
                        form=by_cell[cell],
                        features={"case": case, "number": number},
                    )
                )
    return bundles
