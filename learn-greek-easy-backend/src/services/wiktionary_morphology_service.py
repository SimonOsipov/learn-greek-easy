"""Wiktionary morphology data access service."""

from __future__ import annotations

import unicodedata

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.lexgen_forms import bundles_to_flat
from src.db.models import WiktionaryMorphology
from src.schemas.lexgen import FormBundle


class WiktionaryMorphologyService:
    """Per-request service for accessing reference.wiktionary_morphology data.

    Follows the same pattern as LexiconService: constructor takes AsyncSession,
    exposes async query methods, no singleton.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_entry(
        self, lemma: str, pos: str = "noun", gender: str | None = None
    ) -> WiktionaryMorphology | None:
        """Return the first WiktionaryMorphology row matching lemma (NFC-normalized).

        Args:
            lemma: Greek lemma to look up (NFC-normalized before query).
            pos: Part-of-speech filter (default "noun"). Disambiguates homographs
                that differ only in POS (e.g. a noun/verb pair).
            gender: Optional gender filter ("masculine", "feminine", "neuter").

        Returns:
            WiktionaryMorphology ORM instance or None.
        """
        normalized = unicodedata.normalize("NFC", lemma)
        query = (
            select(WiktionaryMorphology)
            .where(WiktionaryMorphology.lemma == normalized)
            .where(WiktionaryMorphology.pos == pos)
        )
        if gender is not None:
            query = query.where(WiktionaryMorphology.gender == gender)
        result = await self.db.execute(query)
        if gender is not None:
            # Gender-filtered: at most one row (unique on (lemma, pos, gender))
            return result.scalar_one_or_none()
        # No gender filter: multiple rows possible for homographs (post pos filter).
        # Return only if exactly one match exists; otherwise caller should retry with gender.
        entries = result.scalars().all()
        return entries[0] if len(entries) == 1 else None

    async def get_form_bundles(
        self, lemma: str, pos: str = "noun", gender: str | None = None
    ) -> list[FormBundle] | None:
        """Return the stored forms as feature-keyed FormBundles, or None.

        Args:
            lemma: Greek lemma to look up (NFC-normalized before query).
            pos: Part-of-speech filter (default "noun").
            gender: Optional gender filter.

        Returns:
            list[FormBundle] deserialized from the row's bundle JSONB, or None
            when no row matches.
        """
        entry = await self.get_entry(lemma, pos=pos, gender=gender)
        if entry is None:
            return None
        return [FormBundle.model_validate(d) for d in entry.forms]

    async def get_declensions(
        self, lemma: str, pos: str = "noun", gender: str | None = None
    ) -> dict[str, str] | None:
        """Return the flat {case}_{number} declension dict for the entry, or None.

        The stored forms are feature-keyed FormBundles (post-backfill); this
        derives the legacy flat dict via ``bundles_to_flat`` so the legacy
        WiktionaryVerificationService consumer keeps its flat-dict contract.

        Args:
            lemma: Greek lemma to look up (NFC-normalized before query).
            pos: Part-of-speech filter (default "noun").
            gender: Optional gender filter.

        Returns:
            Flat {case}_{number} dict of declension forms or None if no entry found.
        """
        entry = await self.get_entry(lemma, pos=pos, gender=gender)
        if entry is None:
            return None
        return bundles_to_flat([FormBundle.model_validate(d) for d in entry.forms])
