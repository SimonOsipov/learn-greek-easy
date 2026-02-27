"""Lemma normalization service for Greek words.

Composes MorphologyService and SpellcheckService into an 8-step pipeline
that produces a NormalizedLemma with lemma, gender, article, pos, and
a rule-based confidence score (0.0-1.0).
"""

from __future__ import annotations

import re
from typing import Optional

from src.schemas.nlp import MorphologyResult, NormalizedLemma, SpellcheckResult
from src.services.morphology_service import MorphologyService, get_morphology_service
from src.services.spellcheck_service import SpellcheckService, get_spellcheck_service
from src.utils.greek_text import _strip_article  # noqa: WPS450 (private import by design)

_SPACY_GENDER_MAP: dict[str, str] = {
    "Masc": "masculine",
    "Fem": "feminine",
    "Neut": "neuter",
}
_GENDER_TO_ARTICLE: dict[str, str] = {
    "masculine": "ο",
    "feminine": "η",
    "neuter": "το",
}
_GREEK_SCRIPT_RE = re.compile(r"^[\u0370-\u03FF\u1F00-\u1FFF]+$")

_lemma_normalization_service: Optional["LemmaNormalizationService"] = None


class LemmaNormalizationService:
    """Normalizes Greek word input into canonical dictionary form.

    Orchestrates MorphologyService and SpellcheckService through an 8-step
    pipeline. Returns a NormalizedLemma containing the lemma, gender, article,
    POS tag, and a confidence score (0.0-1.0).
    """

    def __init__(
        self,
        morphology_service: MorphologyService,
        spellcheck_service: SpellcheckService,
    ) -> None:
        self._morphology = morphology_service
        self._spellcheck = spellcheck_service

    def normalize(self, word: str) -> NormalizedLemma:
        """Normalize a Greek word to its canonical dictionary form.

        Args:
            word: The input word (may include article, whitespace, inflected forms).

        Returns:
            NormalizedLemma with lemma, gender, article, pos, and confidence score.
        """
        # Step 1: Clean
        cleaned = word.strip()
        cleaned = _strip_article(cleaned)
        cleaned = cleaned.strip()

        # Step 2: Validate
        if not cleaned or not _GREEK_SCRIPT_RE.match(cleaned):
            return NormalizedLemma(
                input_word=word,
                lemma=cleaned,
                gender=None,
                article=None,
                pos="",
                confidence=0.0,
            )

        # Step 3: Spellcheck input
        input_sc = self._spellcheck.check(cleaned)

        # Step 4: Morphological analysis
        morph = self._morphology.analyze(cleaned)
        if not morph.analysis_successful:
            return NormalizedLemma(
                input_word=word,
                lemma=morph.lemma,
                gender=None,
                article=None,
                pos=morph.pos,
                confidence=0.0,
            )

        # Step 5: Spellcheck lemma (skip if same word to avoid double call)
        if morph.lemma == cleaned:
            lemma_sc = input_sc
        else:
            lemma_sc = self._spellcheck.check(morph.lemma)

        # Step 6: Extract gender
        gender_raw = morph.morph_features.get("Gender")
        gender = _SPACY_GENDER_MAP.get(gender_raw) if gender_raw else None

        # Step 7: Infer article
        article = _GENDER_TO_ARTICLE.get(gender) if gender else None

        # Step 8: Confidence scoring
        confidence = self._compute_confidence(morph, input_sc, lemma_sc, gender)

        return NormalizedLemma(
            input_word=word,
            lemma=morph.lemma,
            gender=gender,
            article=article,
            pos=morph.pos,
            confidence=confidence,
        )

    def _compute_confidence(
        self,
        morph: MorphologyResult,
        input_sc: SpellcheckResult,
        lemma_sc: SpellcheckResult,
        gender: str | None,
    ) -> float:
        """Compute confidence score using 7-tier cascade."""
        if not morph.analysis_successful:
            return 0.0  # Failed analysis
        if not lemma_sc.is_valid:
            return 0.2  # Lemma fails spellcheck
        # Lemma passes from here
        is_noun = morph.pos == "NOUN"
        has_gender = gender is not None
        input_ok = input_sc.is_valid
        if input_ok and is_noun and has_gender:
            return 1.0  # All signals positive
        if is_noun and has_gender:
            return 0.95  # NOUN+gender, input misspelled
        if is_noun and input_ok:
            return 0.8  # NOUN, no gender
        if input_ok:
            return 0.6  # Not NOUN, both pass spellcheck
        return 0.5  # Input fails, lemma passes (non-NOUN fallback)


def get_lemma_normalization_service() -> LemmaNormalizationService:
    """Return the singleton LemmaNormalizationService instance."""
    global _lemma_normalization_service
    if _lemma_normalization_service is None:
        _lemma_normalization_service = LemmaNormalizationService(
            morphology_service=get_morphology_service(),
            spellcheck_service=get_spellcheck_service(),
        )
    return _lemma_normalization_service
