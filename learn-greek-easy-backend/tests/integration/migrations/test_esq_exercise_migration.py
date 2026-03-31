"""Integration tests for ESQ-01 migration schema changes."""

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
class TestEsqMigrationSchema:
    """Verify ESQ-01 migration schema changes were applied correctly."""

    async def test_modality_column_exists_and_not_null(self, db_session: AsyncSession) -> None:
        result = await db_session.execute(
            text(
                "SELECT column_name, is_nullable "
                "FROM information_schema.columns "
                "WHERE table_name = 'description_exercises' "
                "AND column_name = 'modality'"
            )
        )
        row = result.fetchone()
        assert row is not None, "modality column should exist on description_exercises"
        assert row[1] == "NO", "modality column should be NOT NULL"

    async def test_exercisemodality_enum_exists(self, db_session: AsyncSession) -> None:
        result = await db_session.execute(
            text("SELECT typname FROM pg_type WHERE typname = 'exercisemodality'")
        )
        assert result.fetchone() is not None, "exercisemodality enum type should exist"

    async def test_new_unique_constraint_exists(self, db_session: AsyncSession) -> None:
        result = await db_session.execute(
            text(
                "SELECT constraint_name FROM information_schema.table_constraints "
                "WHERE table_name = 'description_exercises' "
                "AND constraint_name = 'uq_desc_exercise_type_level_modality'"
            )
        )
        assert result.fetchone() is not None, "new unique constraint should exist"

    async def test_old_unique_constraint_removed(self, db_session: AsyncSession) -> None:
        result = await db_session.execute(
            text(
                "SELECT constraint_name FROM information_schema.table_constraints "
                "WHERE table_name = 'description_exercises' "
                "AND constraint_name = 'uq_desc_exercise_type_level'"
            )
        )
        assert result.fetchone() is None, "old unique constraint should be removed"
