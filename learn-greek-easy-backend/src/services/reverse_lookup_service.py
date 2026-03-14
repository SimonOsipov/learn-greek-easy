"""Reverse lookup service — find Greek lemmas by English/Russian translation."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import GreekLexicon, Translation
from src.utils.greek_articles import GENDER_MAP, get_nominative_article

_SOURCE_PRIORITY = case(
    (Translation.source == "kaikki", 0),
    (Translation.source == "freedict", 1),
    (Translation.source == "pivot", 2),
    else_=3,
)


@dataclass(frozen=True)
class ReverseLookupResult:
    lemma: str
    pos: str
    gender: str | None
    article: str | None
    translations: list[str]
    actionable: bool


class ReverseLookupService:
    """Look up Greek lemmas by their English or Russian translation.

    Per-request service — instantiate with a database session for each request.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def search(
        self,
        query: str,
        language: str,
        limit: int = 15,
    ) -> list[ReverseLookupResult]:
        """Search for Greek lemmas matching the given translation query.

        Args:
            query: The translation string to search for (English or Russian).
            language: Language code, "en" or "ru".
            limit: Maximum number of results to return (default 15).

        Returns:
            List of ReverseLookupResult, sorted with NOUNs first then alphabetically.
        """
        # 1. Query translations with case-insensitive match (hits functional index)
        stmt = (
            select(Translation)
            .where(
                func.lower(Translation.translation) == query.lower(),
                Translation.language == language,
            )
            .order_by(_SOURCE_PRIORITY, Translation.sense_index)
        )
        result = await self.db.execute(stmt)
        rows = list(result.scalars().all())

        if not rows:
            return []

        # 2. Group by (lemma, part_of_speech) preserving source-priority order
        groups: dict[tuple[str, str | None], list[str]] = {}
        for row in rows:
            key = (row.lemma, row.part_of_speech)
            if key not in groups:
                groups[key] = []
            groups[key].append(row.translation)

        # 3. Dedup translations per group (order-preserving)
        for key in groups:
            groups[key] = list(dict.fromkeys(groups[key]))

        # 4. Batch gender lookup for NOUN lemmas from greek_lexicon
        noun_lemmas = [lemma for (lemma, pos) in groups if pos == "NOUN"]
        gender_map: dict[str, str] = {}
        if noun_lemmas:
            lexicon_stmt = (
                select(GreekLexicon.lemma, GreekLexicon.gender)
                .where(
                    GreekLexicon.lemma.in_(noun_lemmas),
                    GreekLexicon.pos == "NOUN",
                    GreekLexicon.gender.is_not(None),
                    GreekLexicon.ptosi == "Nom",
                    GreekLexicon.number == "Sing",
                )
                .distinct()
            )
            lex_result = await self.db.execute(lexicon_stmt)
            for lex_lemma, lex_gender in lex_result.all():
                if lex_lemma not in gender_map:  # take first result per lemma
                    gender_map[lex_lemma] = lex_gender

        # 5. Build result objects
        results: list[ReverseLookupResult] = []
        for (lemma, pos), translations in groups.items():
            if pos == "NOUN":
                raw_gender = gender_map.get(lemma)  # "Masc"/"Fem"/"Neut" or None
                gender_str = GENDER_MAP.get(raw_gender) if raw_gender else None
                raw_article = get_nominative_article(raw_gender) if raw_gender else None
                article = raw_article.strip() if raw_article else None
                actionable = True
            else:
                gender_str = None
                article = None
                actionable = False

            results.append(
                ReverseLookupResult(
                    lemma=lemma,
                    pos=pos if pos is not None else "X",
                    gender=gender_str,
                    article=article,
                    translations=translations,
                    actionable=actionable,
                )
            )

        # 6. Sort: NOUNs first, then alphabetically by lemma within each group
        results.sort(key=lambda r: (0 if r.pos == "NOUN" else 1, r.lemma))

        # 7. Cap at limit
        return results[:limit]
