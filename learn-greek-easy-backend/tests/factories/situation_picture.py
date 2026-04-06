"""Situation picture factories for tests."""

import factory

from src.db.models import (
    ExerciseStatus,
    ExerciseType,
    PictureExercise,
    PictureExerciseItem,
    PictureStatus,
    SituationPicture,
)
from tests.factories.base import BaseFactory
from tests.factories.situation import SituationFactory


class SituationPictureFactory(BaseFactory):
    """Factory for SituationPicture model."""

    class Meta:
        model = SituationPicture

    image_prompt = factory.Sequence(lambda n: f"Εικόνα κατάστασης {n}")
    status = PictureStatus.DRAFT

    class Params:
        generated = factory.Trait(
            status=PictureStatus.GENERATED,
            image_s3_key=factory.Sequence(lambda n: f"situations/picture_{n}.jpg"),
        )

    @classmethod
    async def create(cls, session=None, **kwargs):
        if kwargs.get("situation_id") is None:
            situation = await SituationFactory.create(session=session)
            kwargs["situation_id"] = situation.id
        return await super().create(session=session, **kwargs)


class PictureExerciseFactory(BaseFactory):
    """Factory for PictureExercise model."""

    class Meta:
        model = PictureExercise

    exercise_type = ExerciseType.FILL_GAPS
    status = ExerciseStatus.DRAFT

    class Params:
        approved = factory.Trait(status=ExerciseStatus.APPROVED)
        select_heard = factory.Trait(exercise_type=ExerciseType.SELECT_HEARD)
        true_false = factory.Trait(exercise_type=ExerciseType.TRUE_FALSE)

    @classmethod
    async def create(cls, session=None, **kwargs):
        if kwargs.get("picture_id") is None:
            picture = await SituationPictureFactory.create(session=session)
            kwargs["picture_id"] = picture.id
        return await super().create(session=session, **kwargs)


class PictureExerciseItemFactory(BaseFactory):
    """Factory for PictureExerciseItem model."""

    class Meta:
        model = PictureExerciseItem

    item_index = factory.Sequence(lambda n: n)
    payload = factory.LazyFunction(
        lambda: {
            "prompt": {"el": "Τι βλέπεις;", "en": "What do you see?", "ru": "Что ты видишь?"},
            "options": [
                {"el": "σπίτι", "en": "house", "ru": "дом"},
                {"el": "δέντρο", "en": "tree", "ru": "дерево"},
                {"el": "αυτοκίνητο", "en": "car", "ru": "машина"},
                {"el": "γάτα", "en": "cat", "ru": "кошка"},
            ],
            "correct_answer_index": 0,
        }
    )

    @classmethod
    async def create(cls, session=None, **kwargs):
        if kwargs.get("picture_exercise_id") is None:
            exercise = await PictureExerciseFactory.create(session=session)
            kwargs["picture_exercise_id"] = exercise.id
        return await super().create(session=session, **kwargs)


__all__ = [
    "PictureExerciseFactory",
    "PictureExerciseItemFactory",
    "SituationPictureFactory",
]
