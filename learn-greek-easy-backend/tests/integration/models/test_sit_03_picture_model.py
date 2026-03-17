"""Integration tests for SIT-03 picture data model.

Tests verify constraints, cascade behavior, default values, and relationships
for SituationPicture, PictureExercise, and PictureExerciseItem.
"""

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    ExerciseType,
    PictureExercise,
    PictureExerciseItem,
    PictureStatus,
    Situation,
    SituationPicture,
)
from tests.factories import (
    PictureExerciseFactory,
    PictureExerciseItemFactory,
    SituationFactory,
    SituationPictureFactory,
)


@pytest.mark.asyncio
class TestSituationPictureModel:
    """Tests for SituationPicture, PictureExercise, and PictureExerciseItem models."""

    async def test_create_picture_linked_to_situation(self, db_session: AsyncSession):
        """Test 1: Create a SituationPicture linked to a Situation — verify all fields stored correctly."""
        situation = await SituationFactory.create(session=db_session)
        picture = await SituationPictureFactory.create(
            session=db_session,
            situation_id=situation.id,
            image_prompt="Ένα σπίτι στην Κύπρο",
        )

        result = await db_session.execute(
            select(SituationPicture).where(SituationPicture.id == picture.id)
        )
        fetched = result.scalar_one()

        assert fetched.situation_id == situation.id
        assert fetched.image_prompt == "Ένα σπίτι στην Κύπρο"
        assert fetched.image_s3_key is None
        assert fetched.status == PictureStatus.DRAFT
        assert fetched.id is not None
        assert fetched.created_at is not None
        assert fetched.updated_at is not None

    async def test_unique_constraint_situation_id(self, db_session: AsyncSession):
        """Test 2: Unique constraint on situation_id — second picture on same situation raises IntegrityError."""
        situation = await SituationFactory.create(session=db_session)
        await SituationPictureFactory.create(session=db_session, situation_id=situation.id)

        pic2 = SituationPicture(
            situation_id=situation.id,
            image_prompt="Δεύτερη εικόνα",
        )
        db_session.add(pic2)

        with pytest.raises(IntegrityError):
            await db_session.flush()

        await db_session.rollback()

    async def test_cascade_delete_situation_to_picture(self, db_session: AsyncSession):
        """Test 3: Deleting a Situation cascades to SituationPicture."""
        picture = await SituationPictureFactory.create(session=db_session)
        picture_id = picture.id

        situation = await db_session.get(Situation, picture.situation_id)

        await db_session.delete(situation)
        await db_session.commit()

        result = await db_session.execute(
            text("SELECT COUNT(*) FROM situation_pictures WHERE id = :id"),
            {"id": str(picture_id)},
        )
        assert result.scalar() == 0

    async def test_exercise_unique_constraint_type(self, db_session: AsyncSession):
        """Test 4: Unique constraint (picture_id, exercise_type) — duplicate raises IntegrityError."""
        picture = await SituationPictureFactory.create(session=db_session)
        await PictureExerciseFactory.create(
            session=db_session,
            picture_id=picture.id,
            exercise_type=ExerciseType.FILL_GAPS,
        )

        dup = PictureExercise(
            picture_id=picture.id,
            exercise_type=ExerciseType.FILL_GAPS,
        )
        db_session.add(dup)

        with pytest.raises(IntegrityError):
            await db_session.flush()

        await db_session.rollback()

    async def test_exercise_item_check_constraint_negative_index(self, db_session: AsyncSession):
        """Test 5: Check constraint item_index >= 0 — negative index raises IntegrityError."""
        exercise = await PictureExerciseFactory.create(session=db_session)

        item = PictureExerciseItem(
            picture_exercise_id=exercise.id,
            item_index=-1,
            payload={"type": "label", "text": "test", "answer": "test"},
        )
        db_session.add(item)

        with pytest.raises(IntegrityError):
            await db_session.flush()

        await db_session.rollback()

    async def test_exercise_item_unique_constraint_index(self, db_session: AsyncSession):
        """Test 6: Unique constraint (picture_exercise_id, item_index) — duplicate raises IntegrityError."""
        exercise = await PictureExerciseFactory.create(session=db_session)
        await PictureExerciseItemFactory.create(
            session=db_session,
            picture_exercise_id=exercise.id,
            item_index=0,
        )

        dup = PictureExerciseItem(
            picture_exercise_id=exercise.id,
            item_index=0,
            payload={"type": "label", "text": "dup", "answer": "dup"},
        )
        db_session.add(dup)

        with pytest.raises(IntegrityError):
            await db_session.flush()

        await db_session.rollback()

    async def test_default_values_status_draft(self, db_session: AsyncSession):
        """Test 7: Default values: status=draft when creating raw SituationPicture."""
        situation = await SituationFactory.create(session=db_session)

        picture = SituationPicture(
            situation_id=situation.id,
            image_prompt="Test prompt",
        )
        db_session.add(picture)
        await db_session.flush()
        await db_session.refresh(picture)

        assert picture.status == PictureStatus.DRAFT

    async def test_image_s3_key_is_nullable(self, db_session: AsyncSession):
        """Test 8: image_s3_key is nullable — factory-created picture has None by default."""
        picture = await SituationPictureFactory.create(session=db_session)

        assert picture.image_s3_key is None

    async def test_exercise_item_has_no_updated_at(self, db_session: AsyncSession):
        """Test 9: PictureExerciseItem has NO updated_at (TimestampMixin not used)."""
        item = await PictureExerciseItemFactory.create(session=db_session)

        assert hasattr(item, "created_at")
        assert item.created_at is not None
        assert not hasattr(item, "updated_at")
