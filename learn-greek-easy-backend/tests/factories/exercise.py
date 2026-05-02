"""Exercise system factories for tests."""

from datetime import date

import factory

from src.db.models import CardStatus, Exercise, ExerciseRecord, ExerciseReview, ExerciseSourceType
from tests.factories.base import BaseFactory, utc_now
from tests.factories.situation_description import DescriptionExerciseFactory


class ExerciseFactory(BaseFactory):
    """Factory for Exercise model.

    Defaults to using a DescriptionExercise as the source. If none of the three
    FK ids are provided, a DescriptionExercise is auto-created.

    Traits:
        from_dialog: Set source_type to DIALOG (caller must provide dialog_exercise_id)
        from_picture: Set source_type to PICTURE (caller must provide picture_exercise_id)

    Example:
        exercise = await ExerciseFactory.create(session=session)
        exercise = await ExerciseFactory.create(session=session, description_exercise_id=de.id)
    """

    class Meta:
        model = Exercise

    source_type = ExerciseSourceType.DESCRIPTION
    description_exercise_id = None
    dialog_exercise_id = None
    picture_exercise_id = None

    class Params:
        """Factory traits for exercise source types."""

        from_dialog = factory.Trait(source_type=ExerciseSourceType.DIALOG)
        from_picture = factory.Trait(source_type=ExerciseSourceType.PICTURE)

    @classmethod
    async def create(cls, session=None, **kwargs):
        if (
            kwargs.get("description_exercise_id") is None
            and kwargs.get("dialog_exercise_id") is None
            and kwargs.get("picture_exercise_id") is None
        ):
            description_exercise = await DescriptionExerciseFactory.create(
                session=session, approved=True
            )
            kwargs["description_exercise_id"] = description_exercise.id
            kwargs.setdefault("source_type", ExerciseSourceType.DESCRIPTION)
        return await super().create(session=session, **kwargs)


class ExerciseRecordFactory(BaseFactory):
    """Factory for ExerciseRecord model (SM-2 state per user-exercise pair).

    user_id must be provided explicitly. exercise_id is auto-created if not supplied.

    Traits:
        learning: Status LEARNING, interval=1
        mastered: Status MASTERED, interval=21, repetitions=3

    Example:
        record = await ExerciseRecordFactory.create(session=session, user_id=user.id)
        mastered = await ExerciseRecordFactory.create(
            session=session, user_id=user.id, mastered=True
        )
    """

    class Meta:
        model = ExerciseRecord

    # Required: must be provided
    user_id = None  # Must be set explicitly

    # Auto-created if not provided
    exercise_id = None

    # SM-2 defaults (NEW state)
    easiness_factor = 2.5
    interval = 0
    repetitions = 0
    next_review_date = factory.LazyFunction(date.today)
    status = CardStatus.NEW

    class Params:
        """Factory traits for SM-2 states."""

        learning = factory.Trait(
            status=CardStatus.LEARNING,
            interval=1,
        )

        mastered = factory.Trait(
            status=CardStatus.MASTERED,
            interval=21,
            repetitions=3,
        )

    @classmethod
    async def create(cls, session=None, **kwargs):
        if kwargs.get("exercise_id") is None:
            exercise = await ExerciseFactory.create(session=session)
            kwargs["exercise_id"] = exercise.id
        return await super().create(session=session, **kwargs)


class ExerciseReviewFactory(BaseFactory):
    """Factory for ExerciseReview model (immutable per-review audit log).

    user_id must be provided explicitly. exercise_record_id is auto-created if not supplied.

    Example:
        review = await ExerciseReviewFactory.create(session=session, user_id=user.id)
        review = await ExerciseReviewFactory.create(
            session=session, user_id=user.id, exercise_record_id=record.id
        )
    """

    class Meta:
        model = ExerciseReview

    # Auto-created if not provided
    exercise_record_id = None

    # Required: must be provided
    user_id = None  # Must be set explicitly

    # Default review values
    quality = 4
    score = 4
    max_score = 5
    easiness_factor_before = 2.5
    easiness_factor_after = 2.5
    interval_before = 0
    interval_after = 1
    repetitions_before = 0
    repetitions_after = 1
    reviewed_at = factory.LazyFunction(utc_now)

    @classmethod
    async def create(cls, session=None, **kwargs):
        if kwargs.get("exercise_record_id") is None:
            record = await ExerciseRecordFactory.create(
                session=session, user_id=kwargs.get("user_id")
            )
            kwargs["exercise_record_id"] = record.id
        return await super().create(session=session, **kwargs)


__all__ = [
    "ExerciseFactory",
    "ExerciseRecordFactory",
    "ExerciseReviewFactory",
]
