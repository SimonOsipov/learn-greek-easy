"""Lemma normalization service for Greek words.

Composes MorphologyService and SpellcheckService into an 8-step pipeline
that produces a NormalizedLemma with lemma, gender, article, pos, and
a rule-based confidence score (0.0-1.0).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
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

NOMINATIVE_ARTICLES = frozenset({"ο", "η", "το", "οι", "τα"})


def detect_article(input_text: str) -> tuple[str | None, str]:
    """Detect and extract a Greek nominative article prefix from input text."""
    parts = input_text.strip().split(None, 1)
    if len(parts) == 2 and parts[0].lower() in NOMINATIVE_ARTICLES:
        return parts[0].lower(), parts[1].strip()
    if len(parts) == 1 and parts[0].lower() in NOMINATIVE_ARTICLES:
        return parts[0].lower(), ""
    return None, input_text.strip()


@dataclass
class NormalizationCandidate:
    """Single normalization candidate with its source strategy."""

    input_form: str
    strategy: str  # "direct" | "spellcheck" | "article_prefix"
    morphology: MorphologyResult
    confidence: float
    corrected_from: str | None


@dataclass
class SmartNormalizationResult:
    """Result of the smart normalization pipeline."""

    primary: NormalizationCandidate
    suggestions: list[NormalizationCandidate] = field(default_factory=list)
    detected_article: str | None = None


class LemmaNormalizationService:
    """Normalizes Greek word input into canonical dictionary form.

    Orchestrates MorphologyService and SpellcheckService through an 8-step
    pipeline. Returns a NormalizedLemma containing the lemma, gender, article,
    POS tag, and a confidence score (0.0-1.0).
    """

    _STRATEGY_PRIORITY: dict[str, int] = {
        "article_prefix": 0,
        "spellcheck": 1,
        "direct": 2,
    }

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

    def normalize_smart(self, word: str) -> SmartNormalizationResult:
        """Smart normalization with article detection, spellcheck correction, and multi-candidate ranking."""
        # Step 1-2: Article detection and validation
        detected_article, bare_word = detect_article(word)
        if not bare_word:
            raise ValueError(f"No word provided after article detection (input: {word!r})")

        # Step 3: Spellcheck correction
        corrected = self._spellcheck.correct(bare_word)

        # Step 4: Build candidate inputs (input_form, strategy, corrected_from)
        candidates_inputs: list[tuple[str, str, str | None]] = []
        candidates_inputs.append((bare_word, "direct", None))
        if corrected != bare_word:
            candidates_inputs.append((corrected, "spellcheck", bare_word))
        # Article-prefix retries: ONLY if user did NOT specify an article
        if detected_article is None:
            for art in ("ο", "η", "το"):
                art_form = f"{art} {corrected}"
                candidates_inputs.append(
                    (art_form, "article_prefix", None if corrected == bare_word else bare_word)
                )

        # Step 5: Deduplicate by input string
        seen: set[str] = set()
        unique_inputs: list[tuple[str, str, str | None]] = []
        for input_form, strategy, corr_from in candidates_inputs:
            if input_form not in seen:
                seen.add(input_form)
                unique_inputs.append((input_form, strategy, corr_from))

        # Step 6: Run morphology + confidence for each candidate
        candidates: list[NormalizationCandidate] = []
        for input_form, strategy, corr_from in unique_inputs:
            morph = self._morphology.analyze_in_context(input_form)
            input_sc = self._spellcheck.check(
                morph.lemma if morph.lemma != input_form else input_form
            )
            lemma_sc = (
                input_sc if morph.lemma == input_form else self._spellcheck.check(morph.lemma)
            )
            gender_raw = morph.morph_features.get("Gender")
            gender = _SPACY_GENDER_MAP.get(gender_raw) if gender_raw else None
            confidence = self._compute_confidence(morph, input_sc, lemma_sc, gender)
            candidates.append(
                NormalizationCandidate(
                    input_form=input_form,
                    strategy=strategy,
                    morphology=morph,
                    confidence=confidence,
                    corrected_from=corr_from,
                )
            )

        # Step 7: Rank and select
        primary, suggestions = self._deduplicate_and_rank(candidates)
        return SmartNormalizationResult(
            primary=primary,
            suggestions=suggestions,
            detected_article=detected_article,
        )

    def _deduplicate_and_rank(
        self,
        candidates: list[NormalizationCandidate],
    ) -> tuple[NormalizationCandidate, list[NormalizationCandidate]]:
        """Group candidates by (lemma, pos), pick best per group, rank for primary + suggestions."""
        groups: dict[tuple[str, str], list[NormalizationCandidate]] = {}
        for c in candidates:
            key = (c.morphology.lemma.lower(), c.morphology.pos)
            groups.setdefault(key, []).append(c)

        best_per_group: list[NormalizationCandidate] = []
        for group in groups.values():
            best = max(
                group,
                key=lambda c: (c.confidence, -self._STRATEGY_PRIORITY.get(c.strategy, 99)),
            )
            best_per_group.append(best)

        best_per_group.sort(
            key=lambda c: (-c.confidence, self._STRATEGY_PRIORITY.get(c.strategy, 99)),
        )

        primary = best_per_group[0]
        suggestions = [c for c in best_per_group[1:] if c.confidence >= 0.40][:3]

        return primary, suggestions

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
