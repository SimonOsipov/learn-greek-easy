"""Integration tests for NADM-06: Situation.title_el column split.

Tests verify:
- Column exists in DB schema after migration
- Backfill: existing rows have title_el == scenario_el
- Distinct update: title_el can be updated independently of scenario_el
- Backward compat: updating scenario_el does not clobber title_el
"""

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import NewsItemFactory, SituationFactory


@pytest.mark.asyncio
class TestNadm06SchemaChanges:
    """AC6: Schema-level assertions for the nadm_06 migration."""

    async def test_situations_has_title_el_column(self, db_session: AsyncSession):
        """situations table must have a nullable title_el TEXT column after migration."""
        result = await db_session.execute(
            text(
                "SELECT column_name, is_nullable, data_type "
                "FROM information_schema.columns "
                "WHERE table_name = 'situations' AND column_name = 'title_el'"
            )
        )
        row = result.fetchone()
        assert row is not None, "title_el column must exist on situations table"
        assert row[1] == "YES", "title_el must be nullable"
        assert row[2] == "text", "title_el must be TEXT type"


@pytest.mark.asyncio
class TestNadm06Backfill:
    """AC6: Backfill assertion — existing rows have title_el == scenario_el post-migration."""

    async def test_factory_created_situation_has_title_el_set(self, db_session: AsyncSession):
        """Situations created via factory (after migration) get title_el from the DB.

        The backfill UPDATE in the migration sets title_el = scenario_el for all
        pre-existing rows. New rows created after migration start with title_el = NULL
        until explicitly set. This test verifies the column is readable.
        """
        situation = await SituationFactory.create(session=db_session)
        await db_session.refresh(situation)
        # title_el is nullable; the column must be accessible without AttributeError
        assert hasattr(situation, "title_el")
        # For a newly created situation, title_el starts NULL (no model-level default)
        assert situation.title_el is None

    async def test_backfill_sql_logic_matches_scenario_el(self, db_session: AsyncSession):
        """AC6: Simulate the migration backfill logic; verify title_el = scenario_el for all rows.

        This test explicitly runs the same UPDATE as the migration upgrade and
        checks the result, exercising the backfill assertion requirement.
        """
        s1 = await SituationFactory.create(session=db_session)
        s2 = await SituationFactory.create(session=db_session)
        await db_session.flush()

        # Execute backfill (mirrors the migration upgrade statement)
        await db_session.execute(
            text("UPDATE situations SET title_el = scenario_el WHERE title_el IS NULL")
        )
        await db_session.flush()

        await db_session.refresh(s1)
        await db_session.refresh(s2)

        assert s1.title_el == s1.scenario_el
        assert s2.title_el == s2.scenario_el


@pytest.mark.asyncio
class TestNadm06DistinctUpdate:
    """AC7: Distinct-update test — update title_el without touching scenario_el."""

    async def test_update_title_el_does_not_change_scenario_el(self, db_session: AsyncSession):
        """Updating title_el must not affect scenario_el."""
        situation = await SituationFactory.create(session=db_session)
        original_scenario_el = situation.scenario_el
        await db_session.flush()

        situation.title_el = "Ελληνικός τίτλος"
        await db_session.flush()
        await db_session.refresh(situation)

        assert situation.title_el == "Ελληνικός τίτλος"
        assert situation.scenario_el == original_scenario_el

    async def test_update_scenario_el_does_not_change_title_el(self, db_session: AsyncSession):
        """Updating scenario_el must not affect title_el once it has been set."""
        situation = await SituationFactory.create(session=db_session)
        situation.title_el = "Σταθερός τίτλος"
        await db_session.flush()

        situation.scenario_el = "Ενημερωμένο σενάριο"
        await db_session.flush()
        await db_session.refresh(situation)

        assert situation.scenario_el == "Ενημερωμένο σενάριο"
        assert situation.title_el == "Σταθερός τίτλος"

    async def test_both_fields_independently_readable(self, db_session: AsyncSession):
        """Both title_el and scenario_el hold independent values after individual updates."""
        situation = await SituationFactory.create(session=db_session)
        situation.title_el = "Μοναδικός τίτλος"
        await db_session.flush()
        await db_session.refresh(situation)

        assert situation.title_el != situation.scenario_el
        assert situation.scenario_el  # not empty


@pytest.mark.asyncio
class TestNadm06BackwardCompat:
    """AC8: Backward compatibility — callers that only set scenario_el continue to work."""

    async def test_situation_factory_works_without_title_el(self, db_session: AsyncSession):
        """SituationFactory (no title_el) must still create a valid Situation row."""
        situation = await SituationFactory.create(session=db_session)
        await db_session.flush()
        await db_session.refresh(situation)

        assert situation.scenario_el
        assert situation.title_el is None  # nullable default

    async def test_news_item_service_update_scenario_el_preserves_title_el(
        self, db_session: AsyncSession
    ):
        """NewsItemService.update(scenario_el=…) must not overwrite title_el.

        AC8: existing callers that only set scenario_el continue to work unchanged.
        """
        from unittest.mock import MagicMock

        from src.db.models import Situation as SituationModel
        from src.schemas.news_item import NewsItemUpdate
        from src.services.news_item_service import NewsItemService

        news_item = await NewsItemFactory.create(session=db_session)

        # Set title_el independently on the linked Situation
        situation = await db_session.get(SituationModel, news_item.situation_id)
        situation.title_el = "Ανεξάρτητος τίτλος"
        await db_session.flush()

        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/url"

        update_data = NewsItemUpdate(scenario_el="Νέο σενάριο")
        service = NewsItemService(db=db_session, s3_service=mock_s3)
        await service.update(news_item.id, update_data)

        await db_session.refresh(situation)
        assert situation.scenario_el == "Νέο σενάριο"
        assert situation.title_el == "Ανεξάρτητος τίτλος"

    async def test_news_item_service_update_title_el_independently(self, db_session: AsyncSession):
        """NewsItemService.update(title_el=…) sets title_el without touching scenario_el.

        AC7 via the service layer: the PATCH endpoint correctly routes title_el.
        """
        from unittest.mock import MagicMock

        from src.db.models import Situation as SituationModel
        from src.schemas.news_item import NewsItemUpdate
        from src.services.news_item_service import NewsItemService

        news_item = await NewsItemFactory.create(session=db_session)
        situation = await db_session.get(SituationModel, news_item.situation_id)
        original_scenario_el = situation.scenario_el

        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/url"

        update_data = NewsItemUpdate(title_el="Νέος τίτλος")
        service = NewsItemService(db=db_session, s3_service=mock_s3)
        result = await service.update(news_item.id, update_data)

        await db_session.refresh(situation)
        assert situation.title_el == "Νέος τίτλος"
        assert situation.scenario_el == original_scenario_el
        # Response must expose situation_title_el
        assert result.situation_title_el == "Νέος τίτλος"
