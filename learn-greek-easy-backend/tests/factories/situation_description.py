"""Situation description factories for tests."""

import factory

from src.db.models import (
    DeckLevel,
    DescriptionExercise,
    DescriptionExerciseItem,
    DescriptionSourceType,
    DescriptionStatus,
    ExerciseModality,
    ExerciseStatus,
    ExerciseType,
    SituationDescription,
)
from tests.factories.base import BaseFactory
from tests.factories.situation import SituationFactory


class SituationDescriptionFactory(BaseFactory):
    """Factory for SituationDescription model."""

    class Meta:
        model = SituationDescription

    text_el = factory.Sequence(lambda n: f"Ελληνική περιγραφή κατάστασης {n}")
    source_type = DescriptionSourceType.ORIGINAL
    status = DescriptionStatus.DRAFT

    class Params:
        audio_ready = factory.Trait(status=DescriptionStatus.AUDIO_READY)
        news = factory.Trait(
            source_type=DescriptionSourceType.NEWS,
            source_url="https://example.com/news/1",
        )

    @classmethod
    async def create(cls, session=None, **kwargs):
        if kwargs.get("situation_id") is None:
            situation = await SituationFactory.create(session=session)
            kwargs["situation_id"] = situation.id
        return await super().create(session=session, **kwargs)


class DescriptionExerciseFactory(BaseFactory):
    """Factory for DescriptionExercise model."""

    class Meta:
        model = DescriptionExercise

    exercise_type = ExerciseType.FILL_GAPS
    audio_level = DeckLevel.B2
    modality = ExerciseModality.LISTENING
    status = ExerciseStatus.DRAFT

    class Params:
        approved = factory.Trait(status=ExerciseStatus.APPROVED)
        a2_level = factory.Trait(audio_level=DeckLevel.A2)
        select_heard = factory.Trait(exercise_type=ExerciseType.SELECT_HEARD)
        true_false = factory.Trait(exercise_type=ExerciseType.TRUE_FALSE)

    @classmethod
    async def create(cls, session=None, **kwargs):
        if kwargs.get("description_id") is None:
            description = await SituationDescriptionFactory.create(session=session)
            kwargs["description_id"] = description.id
        return await super().create(session=session, **kwargs)


class DescriptionExerciseItemFactory(BaseFactory):
    """Factory for DescriptionExerciseItem model."""

    class Meta:
        model = DescriptionExerciseItem

    item_index = factory.Sequence(lambda n: n)
    payload = factory.LazyFunction(
        lambda: {
            "prompt": {
                "el": "Πού πήγε ο Γιάννης;",
                "en": "Where did Giannis go?",
                "ru": "Куда пошёл Яннис?",
            },
            "options": [
                {"el": "σχολείο", "en": "school", "ru": "школа"},
                {"el": "σπίτι", "en": "house", "ru": "дом"},
                {"el": "νοσοκομείο", "en": "hospital", "ru": "больница"},
                {"el": "αγορά", "en": "market", "ru": "рынок"},
            ],
            "correct_answer_index": 0,
        }
    )

    @classmethod
    async def create(cls, session=None, **kwargs):
        if kwargs.get("description_exercise_id") is None:
            exercise = await DescriptionExerciseFactory.create(session=session)
            kwargs["description_exercise_id"] = exercise.id
        return await super().create(session=session, **kwargs)


__all__ = [
    "DescriptionExerciseFactory",
    "DescriptionExerciseItemFactory",
    "SituationDescriptionFactory",
]
