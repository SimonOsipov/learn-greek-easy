"""Integration tests for SIT-02 description data model.

Tests verify constraints, cascade behavior, default values, and relationships
for SituationDescription, DescriptionExercise, and DescriptionExerciseItem.
"""

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    DeckLevel,
    DescriptionExercise,
    DescriptionExerciseItem,
    DescriptionSourceType,
    DescriptionStatus,
    ExerciseType,
    SituationDescription,
)
from tests.factories import (
    DescriptionExerciseFactory,
    DescriptionExerciseItemFactory,
    SituationDescriptionFactory,
    SituationFactory,
)


@pytest.mark.asyncio
class TestSituationDescriptionModel:
    """Tests for SituationDescription, DescriptionExercise, DescriptionExerciseItem models."""

    async def test_create_description_linked_to_situation(self, db_session: AsyncSession):
        """Test 1: Create a SituationDescription linked to a Situation — verify all fields stored correctly."""
        situation = await SituationFactory.create(session=db_session)
        desc = await SituationDescriptionFactory.create(
            session=db_session,
            situation_id=situation.id,
            text_el="Ο Γιάννης πήγε στο σχολείο.",
            source_type=DescriptionSourceType.NEWS,
            source_url="https://example.com/article",
        )

        result = await db_session.execute(
            select(SituationDescription).where(SituationDescription.id == desc.id)
        )
        fetched = result.scalar_one()

        assert fetched.situation_id == situation.id
        assert fetched.text_el == "Ο Γιάννης πήγε στο σχολείο."
        assert fetched.source_type == DescriptionSourceType.NEWS
        assert fetched.source_url == "https://example.com/article"
        assert fetched.id is not None
        assert fetched.created_at is not None
        assert fetched.updated_at is not None

    async def test_unique_constraint_situation_id(self, db_session: AsyncSession):
        """Test 2: Unique constraint on situation_id — second description on same situation raises IntegrityError."""
        situation = await SituationFactory.create(session=db_session)
        await SituationDescriptionFactory.create(session=db_session, situation_id=situation.id)

        desc2 = SituationDescription(
            situation_id=situation.id,
            text_el="Δεύτερη περιγραφή",
        )
        db_session.add(desc2)

        with pytest.raises(IntegrityError):
            await db_session.flush()

        await db_session.rollback()

    async def test_cascade_delete_situation_to_description(self, db_session: AsyncSession):
        """Test 3: Deleting a Situation cascades to SituationDescription."""
        situation = await SituationFactory.create(session=db_session)
        desc = await SituationDescriptionFactory.create(
            session=db_session, situation_id=situation.id
        )
        desc_id = desc.id

        await db_session.delete(situation)
        await db_session.commit()

        result = await db_session.execute(
            text("SELECT COUNT(*) FROM situation_descriptions WHERE id = :id"),
            {"id": str(desc_id)},
        )
        assert result.scalar() == 0

    async def test_exercise_unique_constraint_type_level(self, db_session: AsyncSession):
        """Test 4: Unique constraint (description_id, exercise_type, audio_level) — duplicate raises IntegrityError."""
        desc = await SituationDescriptionFactory.create(session=db_session)
        await DescriptionExerciseFactory.create(
            session=db_session,
            description_id=desc.id,
            exercise_type=ExerciseType.FILL_GAPS,
            audio_level=DeckLevel.B2,
        )

        dup = DescriptionExercise(
            description_id=desc.id,
            exercise_type=ExerciseType.FILL_GAPS,
            audio_level=DeckLevel.B2,
        )
        db_session.add(dup)

        with pytest.raises(IntegrityError):
            await db_session.flush()

        await db_session.rollback()

    async def test_exercise_item_check_constraint_negative_index(self, db_session: AsyncSession):
        """Test 5: Check constraint item_index >= 0 — negative index raises IntegrityError."""
        exercise = await DescriptionExerciseFactory.create(session=db_session)

        item = DescriptionExerciseItem(
            description_exercise_id=exercise.id,
            item_index=-1,
            payload={"type": "gap", "text": "test", "answer": "test"},
        )
        db_session.add(item)

        with pytest.raises(IntegrityError):
            await db_session.flush()

        await db_session.rollback()

    async def test_exercise_item_unique_constraint_index(self, db_session: AsyncSession):
        """Test 6: Unique constraint (description_exercise_id, item_index) — duplicate raises IntegrityError."""
        exercise = await DescriptionExerciseFactory.create(session=db_session)
        await DescriptionExerciseItemFactory.create(
            session=db_session,
            description_exercise_id=exercise.id,
            item_index=0,
        )

        dup = DescriptionExerciseItem(
            description_exercise_id=exercise.id,
            item_index=0,
            payload={"type": "gap", "text": "dup", "answer": "dup"},
        )
        db_session.add(dup)

        with pytest.raises(IntegrityError):
            await db_session.flush()

        await db_session.rollback()

    async def test_nullable_news_metadata_columns(self, db_session: AsyncSession):
        """Test 7: Nullable news metadata columns default to None."""
        desc = await SituationDescriptionFactory.create(session=db_session)

        result = await db_session.execute(
            select(SituationDescription).where(SituationDescription.id == desc.id)
        )
        fetched = result.scalar_one()

        assert fetched.source_url is None
        assert fetched.country is None

    async def test_default_values_status_and_source_type(self, db_session: AsyncSession):
        """Test 8: Default values: status=draft, source_type=original."""
        situation = await SituationFactory.create(session=db_session)

        desc = SituationDescription(
            situation_id=situation.id,
            text_el="Δοκιμή",
        )
        db_session.add(desc)
        await db_session.flush()
        await db_session.refresh(desc)

        assert desc.status == DescriptionStatus.DRAFT
        assert desc.source_type == DescriptionSourceType.ORIGINAL

    async def test_audio_level_stored_correctly(self, db_session: AsyncSession):
        """Test 9: audio_level stored and retrieved correctly (A2/B2)."""
        desc = await SituationDescriptionFactory.create(session=db_session)

        ex_a2 = await DescriptionExerciseFactory.create(
            session=db_session,
            description_id=desc.id,
            exercise_type=ExerciseType.FILL_GAPS,
            audio_level=DeckLevel.A2,
        )
        ex_b2 = await DescriptionExerciseFactory.create(
            session=db_session,
            description_id=desc.id,
            exercise_type=ExerciseType.FILL_GAPS,
            audio_level=DeckLevel.B2,
        )

        result_a2 = await db_session.execute(
            select(DescriptionExercise).where(DescriptionExercise.id == ex_a2.id)
        )
        result_b2 = await db_session.execute(
            select(DescriptionExercise).where(DescriptionExercise.id == ex_b2.id)
        )

        assert result_a2.scalar_one().audio_level == DeckLevel.A2
        assert result_b2.scalar_one().audio_level == DeckLevel.B2

    async def test_exercise_item_has_no_updated_at(self, db_session: AsyncSession):
        """Test 10: DescriptionExerciseItem has NO updated_at (TimestampMixin not used)."""
        item = await DescriptionExerciseItemFactory.create(session=db_session)

        assert hasattr(item, "created_at")
        assert item.created_at is not None
        assert not hasattr(item, "updated_at")
