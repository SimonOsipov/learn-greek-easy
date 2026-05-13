"""Auto-create picture-match exercises when a Situation reaches dual readiness.

Called from two places:
- ``persist_picture_generation`` — when picture transitions to GENERATED.
- ``persist_description_audio`` — when description transitions to AUDIO_READY.

Both callers operate inside an already-open ``factory.begin()`` transaction and
pass the live ``AsyncSession`` directly.  This function participates in that
outer transaction via savepoints (``session.begin_nested()``) so that an
IntegrityError on a concurrent duplicate insert can be absorbed without
rolling back the outer transaction.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.logging import get_logger
from src.db.models import (
    DescriptionStatus,
    ExerciseStatus,
    ExerciseType,
    PictureExercise,
    PictureExerciseItem,
    PictureStatus,
    Situation,
    SituationPicture,
)
from src.repositories.exercise import ExerciseRepository

logger = get_logger(__name__)

# The two exercise types created per-situation.
_PICTURE_MATCH_EXERCISE_TYPES = [
    ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION,
    ExerciseType.SELECT_DESCRIPTION_FROM_PICTURE,
]


async def _insert_one_picture_exercise(
    session: AsyncSession,
    picture_id: UUID,
    description_id: UUID,
    exercise_type: ExerciseType,
    situation_id: UUID,
) -> bool:
    """Insert a single PictureExercise + item + supertable row inside a savepoint.

    Returns True if inserted, False if a duplicate race was absorbed.
    Re-raises IntegrityError for any constraint other than uq_pic_exercise_type.
    """
    try:
        async with session.begin_nested():
            pic_ex = PictureExercise(
                picture_id=picture_id,
                exercise_type=exercise_type,
                status=ExerciseStatus.APPROVED,
            )
            session.add(pic_ex)
            await session.flush()

            item = PictureExerciseItem(
                picture_exercise_id=pic_ex.id,
                item_index=0,
                payload={
                    "type": "matching",
                    "anchor_picture_id": str(picture_id),
                    "anchor_description_id": str(description_id),
                },
            )
            session.add(item)

            await ExerciseRepository(session).create_for_picture(pic_ex.id)

        logger.info(
            "ensure_picture_match_exercises: created exercise",
            extra={
                "situation_id": str(situation_id),
                "picture_id": str(picture_id),
                "exercise_type": exercise_type.value,
                "picture_exercise_id": str(pic_ex.id),
            },
        )
        return True
    except IntegrityError as exc:
        if "uq_pic_exercise_type" in str(exc):
            logger.debug(
                "ensure_picture_match_exercises: race lost, skipping duplicate",
                extra={
                    "situation_id": str(situation_id),
                    "exercise_type": exercise_type.value,
                },
            )
            return False
        raise


async def ensure_picture_match_exercises_for_situation(
    session: AsyncSession,
    situation_id: UUID,
) -> int:
    """Create picture-match exercises for *situation_id* if both children are ready.

    Preconditions (returns 0 immediately if any fails):
    - ``SituationPicture.status == GENERATED``
    - ``SituationDescription.status == AUDIO_READY``

    For each of the two ``ExerciseType`` values in
    ``_PICTURE_MATCH_EXERCISE_TYPES``:
    - Skips if a ``PictureExercise`` of that type already exists.
    - Otherwise wraps the insert in a savepoint so a concurrent race loses
      cleanly (``uq_pic_exercise_type`` constraint violation is swallowed).

    Returns:
        Number of newly created ``PictureExercise`` rows (0, 1, or 2).
    """
    stmt = (
        select(Situation)
        .where(Situation.id == situation_id)
        .options(
            selectinload(Situation.picture).selectinload(SituationPicture.exercises),
            selectinload(Situation.description),
        )
    )
    result = await session.execute(stmt)
    situation = result.scalar_one_or_none()

    if situation is None:
        logger.warning(
            "ensure_picture_match_exercises: Situation not found",
            extra={"situation_id": str(situation_id)},
        )
        return 0

    picture = situation.picture
    description = situation.description

    # Guard: both children must exist and be at readiness.
    if picture is None or description is None:
        return 0
    if picture.status != PictureStatus.GENERATED:
        return 0
    if description.status != DescriptionStatus.AUDIO_READY:
        return 0

    existing_types = {ex.exercise_type for ex in picture.exercises}
    created = 0

    for exercise_type in _PICTURE_MATCH_EXERCISE_TYPES:
        if exercise_type in existing_types:
            logger.debug(
                "ensure_picture_match_exercises: skipping existing type",
                extra={
                    "situation_id": str(situation_id),
                    "exercise_type": exercise_type.value,
                },
            )
            continue

        inserted = await _insert_one_picture_exercise(
            session=session,
            picture_id=picture.id,
            description_id=description.id,
            exercise_type=exercise_type,
            situation_id=situation_id,
        )
        if inserted:
            created += 1

    return created
