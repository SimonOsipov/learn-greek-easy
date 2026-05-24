"""WordOrderExercise factories for tests."""

import factory

from src.db.models import ExerciseStatus, ExerciseType, WordOrderExercise, WordOrderExerciseItem
from tests.factories.base import BaseFactory
from tests.factories.situation_description import SituationDescriptionFactory


class WordOrderExerciseFactory(BaseFactory):
    """Factory for WordOrderExercise model."""

    class Meta:
        model = WordOrderExercise

    exercise_type = ExerciseType.WORD_ORDER
    status = ExerciseStatus.DRAFT

    class Params:
        approved = factory.Trait(status=ExerciseStatus.APPROVED)
        pending = factory.Trait(status=ExerciseStatus.PENDING)

    @classmethod
    async def create(cls, session=None, **kwargs):
        if kwargs.get("description_id") is None:
            description = await SituationDescriptionFactory.create(session=session)
            kwargs["description_id"] = description.id
        return await super().create(session=session, **kwargs)


class WordOrderExerciseItemFactory(BaseFactory):
    """Factory for WordOrderExerciseItem model."""

    class Meta:
        model = WordOrderExerciseItem

    item_index = factory.Sequence(lambda n: n)
    payload = factory.LazyFunction(
        lambda: {
            "words": ["πάει", "Γιάννης", "ο", "σχολείο", "στο"],
            "correct_order": [2, 1, 0, 4, 3],
            "answer_el": "ο Γιάννης πάει στο σχολείο",
        }
    )

    @classmethod
    async def create(cls, session=None, **kwargs):
        if kwargs.get("word_order_exercise_id") is None:
            exercise = await WordOrderExerciseFactory.create(session=session)
            kwargs["word_order_exercise_id"] = exercise.id
        return await super().create(session=session, **kwargs)


__all__ = [
    "WordOrderExerciseFactory",
    "WordOrderExerciseItemFactory",
]
