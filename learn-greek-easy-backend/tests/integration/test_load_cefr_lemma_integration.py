"""Integration test for LEXGEN-04-03: real spaCy normalize smoke test.

AC-12 — test_integration_real_spacy_normalize_smoke

Requires the Greek spaCy model to be installed (el_core_news_sm or similar).
In CI the model is NOT installed → pytest.skip at collection time (importorskip).

Run locally:
    cd learn-greek-easy-backend
    PICTURE_HOUSE_STYLE_DEFAULT=test \\
    /Users/samosipov/.local/bin/poetry run pytest \\
        tests/integration/test_load_cefr_lemma_integration.py \\
        -v --no-cov -m integration

NOTE: This test imports src.services.lemma_normalization_service which triggers
the real spaCy import.  It must NOT be imported in the unit test suite.
"""

from __future__ import annotations

import unicodedata

import pytest


@pytest.mark.integration
def test_integration_real_spacy_normalize_smoke():
    """Real LemmaNormalizationService.normalize("σπίτια") returns lemma="σπίτι".

    Validates the full pipeline the loader uses:
    1. loader lower()+NFC → "σπίτια" (already lowercase/NFC in this case)
    2. get_lemma_normalization_service().normalize("σπίτια") → NormalizedLemma
    3. .lemma == "σπίτι"
    4. .confidence > 0.0 (successful normalization)

    SKIP: if spaCy Greek model is not installed (CI environment).
    """
    pytest.importorskip(
        "spacy",
        reason="spaCy not installed or model unavailable — skipping integration smoke test",
    )

    # Narrow skip-triggering excepts to the expected ENVIRONMENT failures only
    # (missing spaCy import / missing Greek model). A real code defect raises a
    # different exception type and must fail loudly, not be masked as a skip.
    try:
        from src.services.lemma_normalization_service import (  # noqa: PLC0415
            get_lemma_normalization_service,
        )
    except ImportError as exc:
        pytest.skip(f"Could not import lemma_normalization_service: {exc}")

    try:
        svc = get_lemma_normalization_service()
    except OSError as exc:
        # spaCy raises OSError when el_core_news_md is not installed.
        pytest.skip(f"Could not instantiate LemmaNormalizationService (model missing?): {exc}")

    # Simulate what the loader does: lower() + NFC before calling normalize
    raw = "σπίτια"
    preprocessed = unicodedata.normalize("NFC", raw.lower())

    result = svc.normalize(preprocessed)

    assert result.lemma == "σπίτι", (
        f"Real normalize('σπίτια') must return lemma='σπίτι'; got {result.lemma!r} "
        f"(confidence={result.confidence})"
    )
    assert result.confidence > 0.0, (
        f"Successful normalization of 'σπίτια' must have confidence > 0.0; "
        f"got {result.confidence}"
    )
