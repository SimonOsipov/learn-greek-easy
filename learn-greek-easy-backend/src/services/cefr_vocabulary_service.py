"""Closed-vocabulary lemma-set assembly from reference.cefr_lemma (LEXGEN-09-03).

This service is a PROMPT INPUT helper only — it assembles the allowed-lemma set
that the generator renders into the example-sentence constraint. It is NOT an
enforcement gate (that is LEXGEN-10).

Per-request service (not singleton), instantiated with an AsyncSession — same
pattern as FrequencyService (LEXGEN-05).
"""

from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CefrLemma

TARGET_LEVEL_DEFAULT = "B1"
CEFR_ORDER = ("A1", "A2", "B1")


class CefrVocabularyService:
    """Per-request assembly of the closed-vocabulary allowed-lemma set from
    reference.cefr_lemma (LEXGEN-09-03). Prompt INPUT only — NOT a gate (LEXGEN-10 enforces).

    The assembled set covers:
      - Level arm: all rows where level is in CEFR_ORDER and
        CEFR_ORDER.index(level) <= CEFR_ORDER.index(target_level).
        A level NOT in CEFR_ORDER is EXCLUDED (fail-safe narrower — D12).
      - Closed-class arm: all rows where closed_class is True, regardless of
        level (load-bearing for function words — D13).

    The target lemma itself is NOT added by this method — the caller
    (LexgenGeneratorService._assemble_allowed_lemmas) unions it in separately.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def allowed_lemmas(self, target_level: str = TARGET_LEVEL_DEFAULT) -> set[str]:
        """Return the closed-vocabulary allowed-lemma set.

        Args:
            target_level: The target CEFR level (default "B1" — hardcoded per D11/F2).
                          If the value is not in CEFR_ORDER the default is used
                          instead (fail-safe narrower — D12).

        Returns:
            A set[str] of lemmas from reference.cefr_lemma satisfying at least one arm.
            The target lemma itself is NOT included here; the generator adds it.
        """
        # D12 fail-safe: unknown levels default to TARGET_LEVEL_DEFAULT (narrower).
        if target_level not in CEFR_ORDER:
            target_level = TARGET_LEVEL_DEFAULT

        allowed_levels = CEFR_ORDER[: CEFR_ORDER.index(target_level) + 1]

        result = await self.db.execute(
            select(CefrLemma.lemma).where(
                or_(
                    CefrLemma.level.in_(allowed_levels),
                    CefrLemma.closed_class.is_(True),
                )
            )
        )
        return set(result.scalars().all())
