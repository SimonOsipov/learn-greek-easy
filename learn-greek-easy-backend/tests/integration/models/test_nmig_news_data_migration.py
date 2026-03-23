"""Integration tests for NMIG news-to-situation data migration.

Tests verify schema changes applied correctly:
- Columns removed from situation_descriptions
- Column added to situation_descriptions
- Column added to news_items
- NewsItem.situation relationship and ON DELETE SET NULL behavior
"""

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import NewsItem
from tests.factories import NewsItemFactory, SituationFactory


@pytest.mark.asyncio
class TestNmigSchemaChanges:
    """Tests for NMIG migration schema changes."""

    async def test_situation_descriptions_removed_columns(self, db_session: AsyncSession):
        """Test 1: situation_descriptions no longer has full_article_text, news_date, original_language."""
        result = await db_session.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'situation_descriptions'"
            )
        )
        columns = {row[0] for row in result.fetchall()}

        assert "full_article_text" not in columns, "full_article_text should be removed"
        assert "news_date" not in columns, "news_date should be removed"
        assert "original_language" not in columns, "original_language should be removed"

    async def test_situation_descriptions_has_text_el_a2(self, db_session: AsyncSession):
        """Test 2: situation_descriptions has text_el_a2 column."""
        result = await db_session.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'situation_descriptions' AND column_name = 'text_el_a2'"
            )
        )
        row = result.fetchone()
        assert row is not None, "text_el_a2 column should exist on situation_descriptions"

    async def test_news_items_has_situation_id(self, db_session: AsyncSession):
        """Test 3: news_items has situation_id column."""
        result = await db_session.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'news_items' AND column_name = 'situation_id'"
            )
        )
        row = result.fetchone()
        assert row is not None, "situation_id column should exist on news_items"

    async def test_news_item_situation_relationship_loads(self, db_session: AsyncSession):
        """Test 4: NewsItem.situation relationship loads via selectinload."""
        situation = await SituationFactory.create(session=db_session)
        news_item = await NewsItemFactory.create(session=db_session, situation_id=situation.id)

        result = await db_session.execute(
            select(NewsItem)
            .options(selectinload(NewsItem.situation))
            .where(NewsItem.id == news_item.id)
        )
        fetched = result.scalar_one()

        assert fetched.situation is not None
        assert fetched.situation.id == situation.id

    async def test_on_delete_set_null_situation(self, db_session: AsyncSession):
        """Test 5: Deleting Situation sets news_item.situation_id to NULL (ON DELETE SET NULL)."""
        situation = await SituationFactory.create(session=db_session)
        news_item = await NewsItemFactory.create(session=db_session, situation_id=situation.id)
        news_item_id = news_item.id

        await db_session.delete(situation)
        await db_session.commit()

        # Use raw SQL to avoid stale ORM cache
        result = await db_session.execute(
            text("SELECT situation_id FROM news_items WHERE id = :id"),
            {"id": str(news_item_id)},
        )
        row = result.fetchone()
        assert row is not None, "news_item should still exist"
        assert row[0] is None, "situation_id should be NULL after situation deleted"
