"""Reverse lookup service — find Greek lemmas by English/Russian translation."""

from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import Float, and_, case, func, literal, or_, select, text
from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import GreekLexicon, Translation
from src.utils.greek_articles import GENDER_MAP, get_nominative_article

_SOURCE_PRIORITY = case(
    (Translation.source == "kaikki", 0),
    (Translation.source == "freedict", 1),
    (Translation.source == "pivot", 2),
    else_=3,
)

_GroupKey = tuple[str, str | None]


def _escape_pg_regex(text: str) -> str:
    """Escape PostgreSQL regex metacharacters."""
    return re.sub(r"([.+*?^${}()|[\]\\])", r"\\\1", text)


@dataclass(frozen=True)
class ReverseLookupResult:
    lemma: str
    pos: str
    gender: str | None
    article: str | None
    translations: list[str]
    actionable: bool
    score: float
    match_type: str
    inferred_gender: bool = False


def _group_rows(
    rows: Sequence[Row],
) -> tuple[
    dict[_GroupKey, list[str]],
    dict[_GroupKey, float],
    dict[_GroupKey, str],
]:
    """Group raw query rows by (lemma, part_of_speech).

    Returns:
        groups: translations per group (in order of first appearance)
        group_scores: highest score seen per group
        group_match_types: match_type corresponding to the highest score
    """
    groups: dict[_GroupKey, list[str]] = {}
    group_scores: dict[_GroupKey, float] = {}
    group_match_types: dict[_GroupKey, str] = {}

    for row in rows:
        translation_obj = row[0]
        row_score = float(row[1])
        row_match_type: str = row[2]
        key: _GroupKey = (translation_obj.lemma, translation_obj.part_of_speech)

        if key not in groups:
            groups[key] = []
            group_scores[key] = row_score
            group_match_types[key] = row_match_type
        elif row_score > group_scores[key]:
            group_scores[key] = row_score
            group_match_types[key] = row_match_type

        groups[key].append(translation_obj.translation)

    # Dedup translations per group (order-preserving)
    for key in groups:
        groups[key] = list(dict.fromkeys(groups[key]))

    return groups, group_scores, group_match_types


def _build_result(
    lemma: str,
    pos: str | None,
    translations: list[str],
    score: float,
    match_type: str,
    gender_map: dict[str, str],
) -> ReverseLookupResult:
    """Build a ReverseLookupResult from grouped data."""
    if pos == "NOUN":
        raw_gender = gender_map.get(lemma)
        gender_str = GENDER_MAP.get(raw_gender) if raw_gender else None
        raw_article = get_nominative_article(raw_gender) if raw_gender else None
        article = raw_article.strip() if raw_article else None
        actionable = True
    else:
        gender_str = None
        article = None
        actionable = False

    return ReverseLookupResult(
        lemma=lemma,
        pos=pos if pos is not None else "X",
        gender=gender_str,
        article=article,
        translations=translations,
        actionable=actionable,
        score=score,
        match_type=match_type,
        inferred_gender=False,
    )


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

        Uses regex word-boundary match for exact results (score 2.0) and
        pg_trgm word_similarity for fuzzy matches (score 0.0-1.0), combined
        in a single-pass query.

        Args:
            query: The translation string to search for (English or Russian).
            language: Language code, "en" or "ru".
            limit: Maximum number of results to return (default 15).

        Returns:
            List of ReverseLookupResult, sorted by score desc then NOUNs first
            then alphabetically.
        """
        escaped = _escape_pg_regex(query.lower())
        word_boundary_pattern = f"\\m{escaped}\\M"
        query_lower = query.lower()

        full_match_cond = func.lower(Translation.translation) == query_lower
        short_translation_cond = func.length(Translation.translation) <= 40
        word_boundary_cond = Translation.translation.op("~*")(word_boundary_pattern)

        fuzzy_base = func.word_similarity(query_lower, func.lower(Translation.translation))
        length_penalty = literal(30.0) / func.greatest(
            func.length(Translation.translation).cast(Float), literal(30.0)
        )
        penalized_fuzzy = fuzzy_base * length_penalty

        score_expr = case(
            (full_match_cond, literal(3.0)),
            (and_(word_boundary_cond, short_translation_cond), literal(2.0)),
            (word_boundary_cond, literal(1.0)),
            else_=penalized_fuzzy,
        ).label("score")

        match_type_expr = case(
            (full_match_cond, literal("full")),
            (and_(word_boundary_cond, short_translation_cond), literal("substring")),
            (word_boundary_cond, literal("incidental")),
            else_=literal("fuzzy"),
        ).label("match_type")

        await self.db.execute(text("SET pg_trgm.similarity_threshold = 0.75"))

        stmt = (
            select(Translation, score_expr, match_type_expr)
            .where(
                Translation.language == language,
                or_(
                    word_boundary_cond,
                    and_(
                        Translation.translation.op("%")(query_lower),
                        func.word_similarity(query_lower, func.lower(Translation.translation))
                        > 0.6,
                    ),
                ),
            )
            .order_by(_SOURCE_PRIORITY, Translation.sense_index)
        )
        result = await self.db.execute(stmt)
        rows = result.all()

        if not rows:
            return []

        groups, group_scores, group_match_types = _group_rows(rows)

        # Filter: only NOUNs with score >= 2.0
        filtered_keys = {k for k in groups if k[1] == "NOUN" and group_scores[k] >= 2.0}
        groups = {k: v for k, v in groups.items() if k in filtered_keys}
        group_scores = {k: v for k, v in group_scores.items() if k in filtered_keys}
        group_match_types = {k: v for k, v in group_match_types.items() if k in filtered_keys}

        if not groups:
            return []

        # Batch gender lookup for NOUN lemmas from greek_lexicon
        noun_lemmas = [lemma for (lemma, _pos) in groups]
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
                if lex_lemma not in gender_map:
                    gender_map[lex_lemma] = lex_gender

        results = [
            _build_result(
                lemma=lemma,
                pos=pos,
                translations=translations,
                score=group_scores[(lemma, pos)],
                match_type=group_match_types[(lemma, pos)],
                gender_map=gender_map,
            )
            for (lemma, pos), translations in groups.items()
        ]

        results.sort(key=lambda r: (-r.score, sum(len(t) for t in r.translations), r.lemma))
        return results[:limit]
