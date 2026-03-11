"""Translation lookup service for reference.translations table."""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass

from sqlalchemy import case, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging import get_logger
from src.db.models import Translation

logger = get_logger(__name__)

_DIRECT_SOURCES = frozenset({"kaikki", "freedict"})
_SOURCE_PRIORITY = case(
    (Translation.source == "kaikki", 0),
    (Translation.source == "freedict", 1),
    (Translation.source == "pivot", 2),
    else_=3,
)


@dataclass(frozen=True)
class TranslationEntry:
    """A single translation row from reference.translations."""

    lemma: str
    language: str
    sense_index: int
    translation: str
    part_of_speech: str | None
    source: str


@dataclass(frozen=True)
class TranslationResult:
    """Result of a single-language translation lookup."""

    translations: list[TranslationEntry]
    source: str  # "dictionary" | "pivot" | "none"
    combined_text: str  # unique translations joined with ", "


class TranslationLookupService:
    """Per-request async lookup service for reference.translations.

    Uses three-tier source priority: kaikki/freedict (dictionary) > pivot > none.
    Instantiated with an AsyncSession, same pattern as LexiconService.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def lookup(
        self,
        lemma: str,
        language: str,
        pos: str | None = None,
    ) -> TranslationResult:
        """Look up translations for a Greek lemma in a single language.

        Applies NFC normalization, optional POS preference, and three-tier
        source priority (kaikki/freedict > pivot > none).

        Args:
            lemma: Greek lemma (dictionary form). NFC-normalized before query.
            language: Target language code ("en" or "ru").
            pos: Optional UPOS tag to prefer (e.g., "NOUN"). Falls back to all rows
                 if no POS-matched rows exist.

        Returns:
            TranslationResult with translations, source tier, and combined_text.
        """
        normalized = unicodedata.normalize("NFC", lemma)

        rows = await self._query_rows(normalized, language, pos)

        if not rows:
            return TranslationResult(translations=[], source="none", combined_text="")

        return self._build_result(rows)

    async def _query_rows(
        self,
        lemma: str,
        language: str,
        pos: str | None,
    ) -> list[Translation]:
        """Query translations with optional POS preference."""
        base_query = (
            select(Translation)
            .where(Translation.lemma == lemma, Translation.language == language)
            .order_by(_SOURCE_PRIORITY, Translation.sense_index)
        )

        if pos is not None:
            pos_query = base_query.where(Translation.part_of_speech == pos)
            result = await self.db.execute(pos_query)
            pos_rows = list(result.scalars().all())
            if pos_rows:
                return pos_rows

        result = await self.db.execute(base_query)
        return list(result.scalars().all())

    def _build_result(self, rows: list[Translation]) -> TranslationResult:
        """Build TranslationResult from a list of Translation ORM rows."""
        # Three-tier source resolution
        has_direct = any(r.source in _DIRECT_SOURCES for r in rows)
        has_pivot = any(r.source == "pivot" for r in rows)

        if has_direct:
            filtered = [r for r in rows if r.source in _DIRECT_SOURCES]
            source_tier = "dictionary"
        elif has_pivot:
            filtered = [r for r in rows if r.source == "pivot"]
            source_tier = "pivot"
        else:
            filtered = rows
            source_tier = "none"

        entries = [
            TranslationEntry(
                lemma=r.lemma,
                language=r.language,
                sense_index=r.sense_index,
                translation=r.translation,
                part_of_speech=r.part_of_speech,
                source=r.source,
            )
            for r in filtered
        ]

        # Order-preserving dedup for combined_text
        unique_translations = list(dict.fromkeys(e.translation for e in entries))
        combined_text = ", ".join(unique_translations)

        return TranslationResult(
            translations=entries,
            source=source_tier,
            combined_text=combined_text,
        )

    async def lookup_bilingual(
        self,
        lemma: str,
        pos: str | None = None,
    ) -> dict[str, TranslationResult]:
        """Look up translations in both English and Russian sequentially.

        Args:
            lemma: Greek lemma (dictionary form).
            pos: Optional UPOS tag to prefer for both languages.

        Returns:
            Dict with keys "en" and "ru", each mapping to a TranslationResult.
        """
        en_result = await self.lookup(lemma, "en", pos)
        ru_result = await self.lookup(lemma, "ru", pos)
        return {"en": en_result, "ru": ru_result}
