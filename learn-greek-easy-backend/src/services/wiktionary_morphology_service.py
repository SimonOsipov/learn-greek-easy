"""Wiktionary morphology data access service."""

from __future__ import annotations

import unicodedata

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import WiktionaryMorphology


class WiktionaryMorphologyService:
    """Per-request service for accessing reference.wiktionary_morphology data.

    Follows the same pattern as LexiconService: constructor takes AsyncSession,
    exposes async query methods, no singleton.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_entry(self, lemma: str, gender: str | None = None) -> WiktionaryMorphology | None:
        """Return the first WiktionaryMorphology row matching lemma (NFC-normalized).

        Args:
            lemma: Greek lemma to look up (NFC-normalized before query).
            gender: Optional gender filter ("masculine", "feminine", "neuter").

        Returns:
            WiktionaryMorphology ORM instance or None.
        """
        normalized = unicodedata.normalize("NFC", lemma)
        query = select(WiktionaryMorphology).where(WiktionaryMorphology.lemma == normalized)
        if gender is not None:
            query = query.where(WiktionaryMorphology.gender == gender)
        result = await self.db.execute(query)
        if gender is not None:
            # Gender-filtered: at most one row (unique on lemma+gender)
            return result.scalar_one_or_none()
        # No gender filter: multiple rows possible for homographs.
        # Return only if exactly one match exists; otherwise caller should retry with gender.
        entries = result.scalars().all()
        return entries[0] if len(entries) == 1 else None

    async def get_declensions(self, lemma: str, gender: str | None = None) -> dict[str, str] | None:
        """Return the forms JSONB dict for the matching entry, or None.

        Args:
            lemma: Greek lemma to look up (NFC-normalized before query).
            gender: Optional gender filter.

        Returns:
            Flat dict of declension forms or None if no entry found.
        """
        entry = await self.get_entry(lemma, gender=gender)
        if entry is None:
            return None
        return dict(entry.forms)
