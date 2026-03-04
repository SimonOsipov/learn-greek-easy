"""Lexicon lookup service for the reference.greek_lexicon table."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import case, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import GreekLexicon

_CASE_ORDER = {"Nom": 0, "Gen": 1, "Acc": 2, "Voc": 3}


@dataclass(frozen=True)
class LexiconEntry:
    """A single row from the reference.greek_lexicon table."""

    form: str
    lemma: str
    pos: str
    gender: str | None
    ptosi: str | None
    number: str | None


class LexiconService:
    """Async lookup service for the Greek lexicon reference table.

    Per-request service (not singleton). Instantiated with an AsyncSession,
    following the same pattern as DuplicateDetectionService.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def lookup(self, form: str, pos: str | None = None) -> LexiconEntry | None:
        """Look up a single form in the lexicon.

        Prefers Nominative Singular when multiple cases match the same form.

        Args:
            form: The inflected word form to look up.
            pos: Optional POS filter (e.g., "NOUN", "ADJ").

        Returns:
            LexiconEntry if found, None otherwise.
        """
        query = (
            select(GreekLexicon)
            .where(GreekLexicon.form == form)
            .order_by(
                case((GreekLexicon.number == "Sing", 0), else_=1),
                case((GreekLexicon.ptosi == "Nom", 0), else_=1),
            )
            .limit(1)
        )

        if pos is not None:
            query = query.where(GreekLexicon.pos == pos)

        result = await self.db.execute(query)
        row = result.scalars().first()

        if row is None:
            return None

        return LexiconEntry(
            form=row.form,
            lemma=row.lemma,
            pos=row.pos,
            gender=row.gender,
            ptosi=row.ptosi,
            number=row.number,
        )

    async def get_declensions(self, lemma: str, pos: str = "NOUN") -> list[LexiconEntry]:
        """Get all inflected forms for a lemma.

        Returns forms ordered: Sing->Plur, then Nom->Gen->Acc->Voc.

        Args:
            lemma: The dictionary form to look up.
            pos: Part of speech filter (default: "NOUN").

        Returns:
            List of LexiconEntry objects, empty if lemma not found.
        """
        query = (
            select(GreekLexicon)
            .where(
                GreekLexicon.lemma == lemma,
                GreekLexicon.pos == pos,
            )
            .distinct()
            .order_by(
                case((GreekLexicon.number == "Sing", 0), else_=1),
                case(
                    (GreekLexicon.ptosi == "Nom", 0),
                    (GreekLexicon.ptosi == "Gen", 1),
                    (GreekLexicon.ptosi == "Acc", 2),
                    (GreekLexicon.ptosi == "Voc", 3),
                    else_=4,
                ),
            )
        )

        result = await self.db.execute(query)
        rows = result.scalars().all()

        return [
            LexiconEntry(
                form=row.form,
                lemma=row.lemma,
                pos=row.pos,
                gender=row.gender,
                ptosi=row.ptosi,
                number=row.number,
            )
            for row in rows
        ]
