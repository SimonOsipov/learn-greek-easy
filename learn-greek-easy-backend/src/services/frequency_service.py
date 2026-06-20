"""Async frequency-rank lookup service for the reference.frequency_rank table.

LEXGEN-05-03 — implements FrequencyService and the band_for_rank() helper.

Design decisions (per LEXGEN-05-03 D6):
- COMMON_MAX_RANK and MID_MAX_RANK are module-level constants so a future
  tuning patch has a single edit point.
- The service expects an already-normalised lemma (Unicode NFC + lowercase)
  and does NOT re-run spaCy normalisation.
- Per-request service (not singleton); instantiated with an AsyncSession,
  following the same pattern as LexiconService.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import FrequencyRank

COMMON_MAX_RANK = 2000
MID_MAX_RANK = 8000


def band_for_rank(rank: int | None) -> str | None:
    """Return the frequency band string for a given rank, or None if rank is None.

    Bands:
    - "common": rank <= COMMON_MAX_RANK (top 2 000 lemmas)
    - "mid":    rank <= MID_MAX_RANK    (ranks 2 001–8 000)
    - "rare":   rank > MID_MAX_RANK     (rank 8 001+)
    """
    if rank is None:
        return None
    if rank <= COMMON_MAX_RANK:
        return "common"
    if rank <= MID_MAX_RANK:
        return "mid"
    return "rare"


class FrequencyService:
    """Async lookup service for the frequency_rank reference table (LEXGEN-05).

    Per-request service (not singleton), instantiated with an AsyncSession — same
    pattern as LexiconService.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_frequency_rank(self, lemma: str) -> int | None:
        """Return the integer frequency rank for a lemma, or None if not found."""
        result = await self.db.execute(
            select(FrequencyRank.rank).where(FrequencyRank.lemma == lemma)
        )
        return result.scalar_one_or_none()

    async def get_frequency_band(self, lemma: str) -> str | None:
        """Return the frequency band ('common', 'mid', 'rare') for a lemma, or None."""
        return band_for_rank(await self.get_frequency_rank(lemma))
