"""Integration tests for CQMIG-02: Culture Question Migration."""

from __future__ import annotations

import importlib.util
import os
from unittest.mock import patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    DeckLevel,
    DescriptionExercise,
    DescriptionExerciseItem,
    Exercise,
    ExerciseSourceType,
    ExerciseStatus,
    ExerciseType,
)
from src.schemas.exercise_payload import SelectCorrectAnswerPayload
from tests.factories import (
    CultureDeckFactory,
    CultureQuestionFactory,
    NewsItemFactory,
    SituationDescriptionFactory,
    SituationFactory,
)

# ---------------------------------------------------------------------------
# Load migration module (filename starts with digit — not a valid Python identifier)
# ---------------------------------------------------------------------------
_MIGRATION_PATH = os.path.join(
    os.path.dirname(__file__),
    "../../../alembic/versions/20260330_1400_cqmig_02_culture_question_migration.py",
)
_spec = importlib.util.spec_from_file_location("cqmig_02", _MIGRATION_PATH)
_migration = importlib.util.module_from_spec(_spec)  # type: ignore[arg-type]
_spec.loader.exec_module(_migration)  # type: ignore[union-attr]

upgrade = _migration.upgrade
downgrade = _migration.downgrade


# ---------------------------------------------------------------------------
# Helper: run migration upgrade/downgrade against test session's sync connection
# ---------------------------------------------------------------------------
async def _run_upgrade(db_session: AsyncSession) -> None:
    connection = await db_session.connection()

    def _do_upgrade(sync_conn):
        with patch("alembic.op.get_bind", return_value=sync_conn):
            upgrade()

    await connection.run_sync(_do_upgrade)
    await db_session.flush()


async def _run_downgrade(db_session: AsyncSession) -> None:
    connection = await db_session.connection()

    def _do_downgrade(sync_conn):
        with patch("alembic.op.get_bind", return_value=sync_conn):
            downgrade()

    await connection.run_sync(_do_downgrade)
    await db_session.flush()


# ---------------------------------------------------------------------------
# Helper: build full factory chain for one eligible culture question
# ---------------------------------------------------------------------------
async def _create_eligible_question(
    db_session: AsyncSession,
    *,
    correct_option: int = 3,
):
    """Create full chain: situation + description + news_item + deck + question."""
    situation = await SituationFactory.create()
    await SituationDescriptionFactory.create(situation_id=situation.id)
    news_item = await NewsItemFactory.create(situation_id=situation.id)
    deck = await CultureDeckFactory.create()
    question = await CultureQuestionFactory.create(
        deck_id=deck.id,
        news_item_id=news_item.id,
        correct_option=correct_option,
    )
    await db_session.flush()
    return situation, news_item, deck, question


# ---------------------------------------------------------------------------
# TestCQMIGFullMigration
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
class TestCQMIGFullMigration:
    async def test_creates_two_description_exercises_per_question(
        self, db_session: AsyncSession
    ) -> None:
        await _create_eligible_question(db_session)
        await _run_upgrade(db_session)

        result = await db_session.execute(
            select(DescriptionExercise).where(
                DescriptionExercise.exercise_type == ExerciseType.SELECT_CORRECT_ANSWER
            )
        )
        exercises = result.scalars().all()
        assert len(exercises) == 2
        for ex in exercises:
            assert ex.status == ExerciseStatus.APPROVED
        levels = {ex.audio_level for ex in exercises}
        assert DeckLevel.B1 in levels
        assert DeckLevel.A2 in levels

    async def test_creates_one_item_per_container(self, db_session: AsyncSession) -> None:
        await _create_eligible_question(db_session)
        await _run_upgrade(db_session)

        result = await db_session.execute(
            select(DescriptionExercise).where(
                DescriptionExercise.exercise_type == ExerciseType.SELECT_CORRECT_ANSWER
            )
        )
        containers = result.scalars().all()
        assert len(containers) == 2
        for container in containers:
            items_result = await db_session.execute(
                select(DescriptionExerciseItem).where(
                    DescriptionExerciseItem.description_exercise_id == container.id
                )
            )
            items = items_result.scalars().all()
            assert len(items) == 1
            assert items[0].item_index == 0

    async def test_payload_is_valid_select_correct_answer_payload(
        self, db_session: AsyncSession
    ) -> None:
        await _create_eligible_question(db_session)
        await _run_upgrade(db_session)

        result = await db_session.execute(
            select(DescriptionExerciseItem)
            .join(
                DescriptionExercise,
                DescriptionExerciseItem.description_exercise_id == DescriptionExercise.id,
            )
            .where(DescriptionExercise.exercise_type == ExerciseType.SELECT_CORRECT_ANSWER)
        )
        items = result.scalars().all()
        assert len(items) > 0
        for item in items:
            # Should not raise ValidationError
            SelectCorrectAnswerPayload.model_validate(item.payload)

    async def test_correct_answer_index_is_zero_indexed(self, db_session: AsyncSession) -> None:
        # correct_option=3 (factory default) → correct_answer_index should be 2
        await _create_eligible_question(db_session, correct_option=3)
        await _run_upgrade(db_session)

        result = await db_session.execute(
            select(DescriptionExerciseItem)
            .join(
                DescriptionExercise,
                DescriptionExerciseItem.description_exercise_id == DescriptionExercise.id,
            )
            .where(DescriptionExercise.exercise_type == ExerciseType.SELECT_CORRECT_ANSWER)
        )
        items = result.scalars().all()
        assert len(items) > 0
        for item in items:
            assert item.payload["correct_answer_index"] == 2

    async def test_b1_and_a2_parity(self, db_session: AsyncSession) -> None:
        await _create_eligible_question(db_session)
        await _run_upgrade(db_session)

        result = await db_session.execute(
            select(DescriptionExercise).where(
                DescriptionExercise.exercise_type == ExerciseType.SELECT_CORRECT_ANSWER
            )
        )
        containers = result.scalars().all()
        b1_count = sum(1 for c in containers if c.audio_level == DeckLevel.B1)
        a2_count = sum(1 for c in containers if c.audio_level == DeckLevel.A2)
        assert b1_count == a2_count
        assert b1_count > 0

    async def test_exercises_supertable_rows_created(self, db_session: AsyncSession) -> None:
        await _create_eligible_question(db_session)
        await _run_upgrade(db_session)

        result = await db_session.execute(
            select(Exercise).where(Exercise.source_type == ExerciseSourceType.DESCRIPTION)
        )
        exercises = result.scalars().all()
        assert len(exercises) == 2

        de_result = await db_session.execute(
            select(DescriptionExercise).where(
                DescriptionExercise.exercise_type == ExerciseType.SELECT_CORRECT_ANSWER
            )
        )
        de_ids = {de.id for de in de_result.scalars().all()}
        for ex in exercises:
            assert ex.description_exercise_id in de_ids


# ---------------------------------------------------------------------------
# TestCQMIGOrphanSkipping
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
class TestCQMIGOrphanSkipping:
    async def test_skips_question_without_news_item_id(self, db_session: AsyncSession) -> None:
        deck = await CultureDeckFactory.create()
        await CultureQuestionFactory.create(deck_id=deck.id, news_item_id=None)
        await db_session.flush()

        # No eligible questions — upgrade is a no-op (logs warning, returns)
        await _run_upgrade(db_session)

        result = await db_session.execute(
            select(DescriptionExercise).where(
                DescriptionExercise.exercise_type == ExerciseType.SELECT_CORRECT_ANSWER
            )
        )
        assert len(result.scalars().all()) == 0

    async def test_skips_question_without_situation_on_news_item(
        self, db_session: AsyncSession
    ) -> None:
        deck = await CultureDeckFactory.create()
        news_item = await NewsItemFactory.create(situation_id=None)
        await CultureQuestionFactory.create(deck_id=deck.id, news_item_id=news_item.id)
        await db_session.flush()

        # No eligible questions — upgrade is a no-op (logs warning, returns)
        await _run_upgrade(db_session)

        result = await db_session.execute(
            select(DescriptionExercise).where(
                DescriptionExercise.exercise_type == ExerciseType.SELECT_CORRECT_ANSWER
            )
        )
        assert len(result.scalars().all()) == 0


# ---------------------------------------------------------------------------
# TestCQMIGDowngrade
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
class TestCQMIGDowngrade:
    async def test_downgrade_removes_all_created_rows(self, db_session: AsyncSession) -> None:
        await _create_eligible_question(db_session)
        await _run_upgrade(db_session)

        # Verify rows were created
        de_result = await db_session.execute(
            select(DescriptionExercise).where(
                DescriptionExercise.exercise_type == ExerciseType.SELECT_CORRECT_ANSWER
            )
        )
        assert len(de_result.scalars().all()) == 2

        # Downgrade
        await _run_downgrade(db_session)

        de_result = await db_session.execute(
            select(DescriptionExercise).where(
                DescriptionExercise.exercise_type == ExerciseType.SELECT_CORRECT_ANSWER
            )
        )
        assert len(de_result.scalars().all()) == 0

        dei_result = await db_session.execute(select(DescriptionExerciseItem))
        assert len(dei_result.scalars().all()) == 0

        ex_result = await db_session.execute(
            select(Exercise).where(Exercise.source_type == ExerciseSourceType.DESCRIPTION)
        )
        assert len(ex_result.scalars().all()) == 0


# ---------------------------------------------------------------------------
# TestCQMIGMultipleQuestions (bonus)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
class TestCQMIGMultipleQuestions:
    async def test_multiple_questions_per_description_increment_item_index(
        self, db_session: AsyncSession
    ) -> None:
        # Two questions sharing the same Situation/Description
        situation = await SituationFactory.create()
        await SituationDescriptionFactory.create(situation_id=situation.id)
        news_item_1 = await NewsItemFactory.create(situation_id=situation.id)
        news_item_2 = await NewsItemFactory.create(situation_id=situation.id)
        deck = await CultureDeckFactory.create()
        await CultureQuestionFactory.create(deck_id=deck.id, news_item_id=news_item_1.id)
        await CultureQuestionFactory.create(deck_id=deck.id, news_item_id=news_item_2.id)
        await db_session.flush()

        await _run_upgrade(db_session)

        result = await db_session.execute(
            select(DescriptionExercise).where(
                DescriptionExercise.exercise_type == ExerciseType.SELECT_CORRECT_ANSWER,
                DescriptionExercise.audio_level == DeckLevel.B1,
            )
        )
        containers = result.scalars().all()
        assert len(containers) == 1
        container = containers[0]

        items_result = await db_session.execute(
            select(DescriptionExerciseItem)
            .where(DescriptionExerciseItem.description_exercise_id == container.id)
            .order_by(DescriptionExerciseItem.item_index)
        )
        items = items_result.scalars().all()
        assert len(items) == 2
        assert items[0].item_index == 0
        assert items[1].item_index == 1
