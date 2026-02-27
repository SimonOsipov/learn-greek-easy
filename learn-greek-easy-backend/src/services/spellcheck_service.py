"""SpellcheckService for Greek word spellchecking using phunspell."""

import re
from typing import Optional

from src.core.logging import get_logger
from src.schemas.nlp import SpellcheckResult

logger = get_logger(__name__)

# Greek script regex: Basic Greek (U+0370-U+03FF) + Extended Greek (U+1F00-U+1FFF)
_GREEK_PATTERN = re.compile(r"^[\u0370-\u03FF\u1F00-\u1FFF]+$")


class SpellcheckService:
    """Service for Greek word spellchecking using phunspell with el_GR dictionary.

    The el_GR Hunspell dictionary is loaded once at service initialization
    and reused across all calls (singleton pattern).
    """

    def __init__(self) -> None:
        import phunspell  # lazy import — dictionary loading is heavy

        self._pspell = phunspell.Phunspell("el_GR")
        logger.info("SpellcheckService initialized with el_GR dictionary")

    @staticmethod
    def _is_greek(text: str) -> bool:
        """Return True if text contains only Greek script characters."""
        return bool(_GREEK_PATTERN.match(text))

    def check(self, word: str) -> SpellcheckResult:
        """Check whether a Greek word is valid according to the el_GR dictionary.

        Args:
            word: A single Greek word to check. Multi-token input uses the
                first token only (warning logged). Non-Greek input returns
                is_valid=False.

        Returns:
            SpellcheckResult with is_valid flag and optional suggestions.
        """
        # Strip whitespace
        stripped = word.strip()

        # Empty / whitespace-only
        if not stripped:
            return SpellcheckResult(input_word=word, is_valid=False, suggestions=[])

        # Multi-token: use first token, log warning
        tokens = stripped.split()
        if len(tokens) > 1:
            logger.warning(
                "SpellcheckService received multi-token input, using first token",
                extra={"input": stripped, "token_used": tokens[0]},
            )
            stripped = tokens[0]

        # Non-Greek script
        if not self._is_greek(stripped):
            return SpellcheckResult(input_word=word, is_valid=False, suggestions=[])

        # Lookup
        is_valid = self._pspell.lookup(stripped)

        suggestions: list[str] = []
        if not is_valid:
            suggestions = list(self._pspell.suggest(stripped))

        return SpellcheckResult(
            input_word=word,
            is_valid=is_valid,
            suggestions=suggestions,
        )


_spellcheck_service: Optional[SpellcheckService] = None


def get_spellcheck_service() -> SpellcheckService:
    """Get or create the singleton SpellcheckService instance."""
    global _spellcheck_service
    if _spellcheck_service is None:
        _spellcheck_service = SpellcheckService()
    return _spellcheck_service
