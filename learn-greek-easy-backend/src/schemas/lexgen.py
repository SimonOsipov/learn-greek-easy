"""LEXGEN morphological form schemas.

STUB — intentionally minimal/non-functional for the RED test phase (LEXGEN-02-01).
The executor (Stage 3) replaces this with:
  - ``form: str = Field(..., min_length=1)``
  - the real 10-key ``FEATURE_KEYS`` frozenset
  - a ``@field_validator`` enforcing ``features`` keys ⊆ ``FEATURE_KEYS``
  - a module docstring describing the form-bundle / paradigm contract
"""

from pydantic import BaseModel

# Deliberately wrong: empty set so the exact-set test fails on assertion (not import).
FEATURE_KEYS: frozenset[str] = frozenset()


class FormBundle(BaseModel):
    """A single inflected form plus its morphological features.

    STUB: no ``min_length`` on ``form`` and no features-key validator yet.
    """

    form: str
    features: dict[str, str]
