"""Exercise repository."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Exercise, ExerciseSourceType
from src.repositories.base import BaseRepository

_SOURCE_TYPE_TO_FK = {
    ExerciseSourceType.DESCRIPTION: Exercise.description_exercise_id,
    ExerciseSourceType.DIALOG: Exercise.dialog_exercise_id,
    ExerciseSourceType.PICTURE: Exercise.picture_exercise_id,
}


class ExerciseRepository(BaseRepository[Exercise]):
    """Repository for Exercise supertable rows."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Exercise, db)

    async def create_for_description(self, description_exercise_id: UUID) -> Exercise:
        """Create an Exercise linked to a DescriptionExercise."""
        obj = Exercise(
            source_type=ExerciseSourceType.DESCRIPTION,
            description_exercise_id=description_exercise_id,
        )
        self.db.add(obj)
        await self.db.flush()
        return obj

    async def create_for_dialog(self, dialog_exercise_id: UUID) -> Exercise:
        """Create an Exercise linked to a DialogExercise."""
        obj = Exercise(
            source_type=ExerciseSourceType.DIALOG,
            dialog_exercise_id=dialog_exercise_id,
        )
        self.db.add(obj)
        await self.db.flush()
        return obj

    async def create_for_picture(self, picture_exercise_id: UUID) -> Exercise:
        """Create an Exercise linked to a PictureExercise."""
        obj = Exercise(
            source_type=ExerciseSourceType.PICTURE,
            picture_exercise_id=picture_exercise_id,
        )
        self.db.add(obj)
        await self.db.flush()
        return obj

    async def get_by_source(
        self, source_type: ExerciseSourceType, source_id: UUID
    ) -> Exercise | None:
        """Return the Exercise for a given source type and source ID, or None."""
        fk_col = _SOURCE_TYPE_TO_FK[source_type]
        result = await self.db.execute(select(Exercise).where(fk_col == source_id))
        return result.scalar_one_or_none()
