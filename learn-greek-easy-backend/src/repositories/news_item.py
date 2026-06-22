"""NewsItem repository for news feed operations."""

from uuid import UUID

from sqlalchemy import cast, desc, func, or_, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import ColumnElement

from src.db.models import (
    ListeningDialog,
    NewsCountry,
    NewsItem,
    NewsItemStatus,
    Situation,
    SituationDescription,
    SituationPicture,
)
from src.repositories.base import BaseRepository


def _like_escape(q: str) -> str:
    """Escape LIKE special characters in a search term.

    Escapes ``\\``, ``%``, and ``_`` so a literal ``%`` in the user's
    query is not treated as a SQL wildcard by the ILIKE clause.
    The escape character is ``\\`` (passed to ``.ilike(..., escape='\\\\')``.
    """
    return q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _search_predicate(q: str) -> ColumnElement:
    """Build the OR search predicate for accent+case-insensitive substring match.

    Applies ``immutable_unaccent(col).ilike(immutable_unaccent('%<q>%'))``
    across: Situation.scenario_el, SituationDescription.text_el,
    SituationDescription.text_el_a2, and NewsItem.original_article_url.

    The search term is LIKE-escaped so ``%`` / ``_`` are treated as literals.
    """
    escaped = _like_escape(q)
    pattern = func.immutable_unaccent(f"%{escaped}%")
    return or_(
        func.immutable_unaccent(Situation.scenario_el).ilike(pattern, escape="\\"),
        func.immutable_unaccent(SituationDescription.text_el).ilike(pattern, escape="\\"),
        func.immutable_unaccent(SituationDescription.text_el_a2).ilike(pattern, escape="\\"),
        func.immutable_unaccent(NewsItem.original_article_url).ilike(pattern, escape="\\"),
    )


class NewsItemRepository(BaseRepository[NewsItem]):
    """Repository for news item operations.

    Provides database operations for news items including:
    - Get news items ordered by publication date
    - Check for duplicate articles by URL
    """

    def __init__(self, db: AsyncSession) -> None:
        """Initialize the NewsItem repository.

        Args:
            db: Async database session for persistence operations
        """
        super().__init__(NewsItem, db)

    async def get_list(
        self,
        *,
        skip: int = 0,
        limit: int = 20,
        country: NewsCountry | None = None,
        published_only: bool = True,
        q: str | None = None,
    ) -> list[Row]:
        """Get news items with situation/description/picture via JOIN, ordered by publication_date DESC.

        When ``published_only`` is True (the default, for the public feed), draft
        items are excluded. Admin callers pass False to see drafts too.

        When ``q`` is a non-blank string, results are filtered to items whose
        scenario_el, text_el, text_el_a2, or original_article_url contain the
        search term (accent+case-insensitive substring via immutable_unaccent+ilike).
        """
        query = (
            select(NewsItem, Situation, SituationDescription, SituationPicture)
            .join(Situation, Situation.id == NewsItem.situation_id)
            .join(SituationDescription, SituationDescription.situation_id == Situation.id)
            .outerjoin(SituationPicture, SituationPicture.situation_id == Situation.id)
        )
        if published_only:
            query = query.where(NewsItem.status == NewsItemStatus.PUBLISHED)
        if country is not None:
            query = query.where(SituationDescription.country == country)
        if q and q.strip():
            query = query.where(_search_predicate(q.strip()))
        query = (
            query.order_by(
                desc(NewsItem.publication_date),
                desc(NewsItem.created_at),
                desc(NewsItem.id),
            )
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.all())

    async def exists_by_url(self, url: str) -> bool:
        """Check if news item exists by original_article_url.

        Args:
            url: The original article URL to check

        Returns:
            True if a news item with this URL exists, False otherwise
        """
        return await self.exists(original_article_url=url)

    async def count_all(
        self,
        country: NewsCountry | None = None,
        *,
        published_only: bool = True,
        q: str | None = None,
    ) -> int:
        """Count news items (only those with situation/description via JOIN).

        Args:
            country: Optional country filter
            published_only: Exclude drafts (default True, for the public feed)
            q: Optional search term (accent+case-insensitive substring)

        Returns:
            Total number of news items in the database (filtered if country/q provided)
        """
        query = (
            select(func.count())
            .select_from(NewsItem)
            .join(Situation, Situation.id == NewsItem.situation_id)
            .join(SituationDescription, SituationDescription.situation_id == Situation.id)
        )
        if published_only:
            query = query.where(NewsItem.status == NewsItemStatus.PUBLISHED)
        if country is not None:
            query = query.where(SituationDescription.country == country)
        if q and q.strip():
            query = query.where(_search_predicate(q.strip()))
        result = await self.db.execute(query)
        return result.scalar_one()

    async def count_with_audio(
        self, country: NewsCountry | None = None, *, published_only: bool = True
    ) -> int:
        """Count news items that have base (B1) audio generated (via SituationDescription).

        Args:
            country: Optional country filter
            published_only: Exclude drafts (default True, for the public feed)

        Returns:
            Number of news items with a non-null audio_s3_key
        """
        query = (
            select(func.count())
            .select_from(NewsItem)
            .join(Situation, Situation.id == NewsItem.situation_id)
            .join(SituationDescription, SituationDescription.situation_id == Situation.id)
            .where(SituationDescription.audio_s3_key.isnot(None))
        )
        if published_only:
            query = query.where(NewsItem.status == NewsItemStatus.PUBLISHED)
        if country is not None:
            query = query.where(SituationDescription.country == country)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def count_with_b1_audio(self, *, published_only: bool = True) -> int:
        """Count news items where Situation.levels contains 'B1' AND audio_s3_key is non-null.

        Returns:
            Number of B1 news items with audio generated
        """
        query = (
            select(func.count())
            .select_from(NewsItem)
            .join(Situation, Situation.id == NewsItem.situation_id)
            .join(SituationDescription, SituationDescription.situation_id == Situation.id)
            .where(Situation.levels.contains(cast(["B1"], JSONB)))
            .where(SituationDescription.audio_s3_key.isnot(None))
        )
        if published_only:
            query = query.where(NewsItem.status == NewsItemStatus.PUBLISHED)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def count_b1_pending_regen(self, *, published_only: bool = True) -> int:
        """Count news items where Situation.levels contains 'B1' BUT audio_s3_key is null.

        Returns:
            Number of B1 news items awaiting audio generation
        """
        query = (
            select(func.count())
            .select_from(NewsItem)
            .join(Situation, Situation.id == NewsItem.situation_id)
            .join(SituationDescription, SituationDescription.situation_id == Situation.id)
            .where(Situation.levels.contains(cast(["B1"], JSONB)))
            .where(SituationDescription.audio_s3_key.is_(None))
        )
        if published_only:
            query = query.where(NewsItem.status == NewsItemStatus.PUBLISHED)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def count_by_country(
        self,
        *,
        published_only: bool = True,
        q: str | None = None,
    ) -> dict[str, int]:
        """Count news items grouped by SituationDescription.country.

        Filtered by ``q`` only (NOT by the selected country filter), so the
        country pills show per-country totals within the q-filtered set regardless
        of which country tab is currently selected (F2).

        Returns:
            Dict mapping country value strings to counts, e.g. {"cyprus": 5, "greece": 3, "world": 2}
        """
        query = (
            select(SituationDescription.country, func.count())
            .select_from(NewsItem)
            .join(Situation, Situation.id == NewsItem.situation_id)
            .join(SituationDescription, SituationDescription.situation_id == Situation.id)
            .group_by(SituationDescription.country)
        )
        if published_only:
            query = query.where(NewsItem.status == NewsItemStatus.PUBLISHED)
        if q and q.strip():
            query = query.where(_search_predicate(q.strip()))
        result = await self.db.execute(query)
        rows = result.all()
        counts = {c.value: 0 for c in NewsCountry}
        for country_enum, count in rows:
            if country_enum is not None:
                key = country_enum.value if hasattr(country_enum, "value") else str(country_enum)
                counts[key] = count
            else:
                counts[NewsCountry.CYPRUS.value] += count
        return counts

    async def get_by_id_with_joins(
        self, news_item_id: UUID, *, published_only: bool = True
    ) -> Row | None:
        """Fetch a single NewsItem with its Situation, SituationDescription, and SituationPicture via JOIN.

        When ``published_only`` is True (the default, for the public detail endpoint),
        a draft item is treated as not found (returns None → 404).
        """
        query = (
            select(NewsItem, Situation, SituationDescription, SituationPicture)
            .join(Situation, Situation.id == NewsItem.situation_id)
            .join(SituationDescription, SituationDescription.situation_id == Situation.id)
            .outerjoin(SituationPicture, SituationPicture.situation_id == Situation.id)
            .where(NewsItem.id == news_item_id)
        )
        if published_only:
            query = query.where(NewsItem.status == NewsItemStatus.PUBLISHED)
        result = await self.db.execute(query)
        return result.first()

    async def get_by_id_for_detail(
        self, news_item_id: UUID, *, published_only: bool = True
    ) -> tuple[NewsItem, Situation, SituationDescription, SituationPicture] | Row | None:
        """Fetch a single NewsItem for the admin detail view with full Situation graph.

        Returns the same (NewsItem, Situation, SituationDescription, SituationPicture)
        tuple shape as get_by_id_with_joins, but additionally eager-loads the Situation
        dialog graph (speakers, lines, exercises) so aggregate fields can be computed
        without N+1 queries.

        Args:
            news_item_id: UUID of the news item to fetch.

        Returns:
            4-tuple (NewsItem, Situation, SituationDescription, SituationPicture) where
            Situation.dialog (if not None) has speakers/lines/exercises pre-loaded,
            or None if the news item does not exist.
        """
        base_row = await self.get_by_id_with_joins(news_item_id, published_only=published_only)
        if base_row is None:
            return None

        # Separately eager-load NewsItem → Situation → dialog graph.
        query = (
            select(NewsItem)
            .where(NewsItem.id == news_item_id)
            .options(
                selectinload(NewsItem.situation).options(
                    selectinload(Situation.dialog).options(
                        selectinload(ListeningDialog.speakers),
                        selectinload(ListeningDialog.lines),
                        selectinload(ListeningDialog.exercises),
                    ),
                )
            )
        )
        result = await self.db.execute(query)
        news_item_with_graph = result.scalar_one_or_none()
        if news_item_with_graph is None:
            return None

        # Return the same 4-tuple shape; swap in the graph-loaded Situation.
        return (
            news_item_with_graph,
            news_item_with_graph.situation,
            base_row[2],  # SituationDescription from original JOIN
            base_row[3],  # SituationPicture from original JOIN
        )


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["NewsItemRepository"]
