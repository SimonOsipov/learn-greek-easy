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

STUB — both converters raise ``NotImplementedError``. The real conversion logic
lands in LEXGEN-02-03 Stage 3.
"""

from __future__ import annotations

from src.schemas.lexgen import FormBundle


def bundles_to_flat(bundles: list[FormBundle]) -> dict[str, str]:
    """Convert feature-keyed bundles to a canonical-ordered flat-key dict.

    STUB — not yet implemented.
    """
    raise NotImplementedError("bundles_to_flat is not implemented yet (LEXGEN-02-03)")


def flat_to_bundles(flat: dict[str, str]) -> list[FormBundle]:
    """Convert a flat-key dict to canonical-ordered feature-keyed bundles.

    STUB — not yet implemented.
    """
    raise NotImplementedError("flat_to_bundles is not implemented yet (LEXGEN-02-03)")
