"""MorphologyService for Greek word morphological analysis using spaCy."""

import re
from typing import Optional

import spacy
from spacy.language import Language

from src.core.logging import get_logger
from src.schemas.nlp import MorphologyResult

logger = get_logger(__name__)

# Greek script regex: Basic Greek (U+0370-U+03FF) + Extended Greek (U+1F00-U+1FFF)
_GREEK_SCRIPT_RE = re.compile(r"^[\u0370-\u03FF\u1F00-\u1FFF]+$")


class MorphologyService:
    """Service for Greek word morphological analysis using spaCy el_core_news_sm.

    The spaCy model is loaded once at service initialization (~200-500ms)
    and reused across all calls (singleton pattern).
    """

    def __init__(self) -> None:
        """Load spaCy Greek model eagerly.

        Raises:
            OSError: If el_core_news_sm model is not installed.
        """
        self._nlp: Optional[Language] = None
        try:
            self._nlp = spacy.load("el_core_news_sm")
            logger.info(
                "MorphologyService initialized with spaCy el_core_news_sm",
                extra={"model": "el_core_news_sm"},
            )
        except OSError:
            logger.error(
                "Failed to load spaCy model — run: python -m spacy download el_core_news_sm",
                extra={"model": "el_core_news_sm"},
            )
            raise

    @staticmethod
    def _is_greek(text: str) -> bool:
        """Return True if text contains only Greek script characters."""
        return bool(_GREEK_SCRIPT_RE.match(text))

    def _empty_result(self, input_word: str) -> MorphologyResult:
        """Return a failed-analysis result."""
        return MorphologyResult(
            input_word=input_word,
            lemma="",
            pos="",
            morph_features={},
            is_known=False,
            analysis_successful=False,
        )

    def analyze(self, word: str) -> MorphologyResult:
        """Analyze morphology of a single Greek word.

        Args:
            word: A single Greek word to analyze.

        Returns:
            MorphologyResult. analysis_successful=False for empty,
            non-Greek, or processing errors.
        """
        # Empty / whitespace-only
        stripped = word.strip() if word else ""
        if not stripped:
            return self._empty_result(word or "")

        # Non-Greek script
        if not self._is_greek(stripped):
            return self._empty_result(stripped)

        # Model guard (should not happen with eager init)
        if self._nlp is None:
            return self._empty_result(stripped)

        # Process with spaCy
        doc = self._nlp(stripped)

        if len(doc) == 0:
            return self._empty_result(stripped)

        # Multi-token: use first token, log warning
        if len(doc) > 1:
            logger.warning(
                "MorphologyService received multi-token input, using first token",
                extra={
                    "input_word": stripped,
                    "token_count": len(doc),
                    "used_token": doc[0].text,
                },
            )

        token = doc[0]

        # is_known heuristic: spaCy returns word itself as lemma for unknown words.
        # Note: nominative singular nouns also have lemma==text (known limitation).
        is_known = token.lemma_ != token.text

        return MorphologyResult(
            input_word=stripped,
            lemma=token.lemma_,
            pos=token.pos_,
            morph_features=token.morph.to_dict(),
            is_known=is_known,
            analysis_successful=True,
        )


_morphology_service: Optional[MorphologyService] = None


def get_morphology_service() -> MorphologyService:
    """Get or create the singleton MorphologyService instance."""
    global _morphology_service
    if _morphology_service is None:
        _morphology_service = MorphologyService()
    return _morphology_service
