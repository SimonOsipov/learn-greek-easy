"""ListeningDialog factory for tests."""

import factory

from src.db.models import (
    DeckLevel,
    DialogExercise,
    DialogStatus,
    ExerciseItem,
    ExerciseStatus,
    ExerciseType,
    ListeningDialog,
)
from tests.factories.base import BaseFactory
from tests.factories.situation import SituationFactory


class ListeningDialogFactory(BaseFactory):
    """Factory for ListeningDialog model."""

    class Meta:
        model = ListeningDialog

    scenario_el = factory.Sequence(lambda n: f"Ελληνικό σενάριο {n}")
    scenario_en = factory.Sequence(lambda n: f"English scenario {n}")
    scenario_ru = factory.Sequence(lambda n: f"Русский сценарий {n}")
    cefr_level = DeckLevel.B1
    num_speakers = 2
    status = DialogStatus.DRAFT

    class Params:
        audio_ready = factory.Trait(status=DialogStatus.AUDIO_READY)
        exercises_ready = factory.Trait(status=DialogStatus.EXERCISES_READY)
        a1_level = factory.Trait(cefr_level=DeckLevel.A1)
        b2_level = factory.Trait(cefr_level=DeckLevel.B2)

    @classmethod
    async def create(cls, session=None, **kwargs):
        if kwargs.get("situation_id") is None:
            situation = await SituationFactory.create(session=session)
            kwargs["situation_id"] = situation.id
        return await super().create(session=session, **kwargs)


class DialogExerciseFactory(BaseFactory):
    """Factory for DialogExercise model."""

    class Meta:
        model = DialogExercise

    exercise_type = ExerciseType.FILL_GAPS
    status = ExerciseStatus.DRAFT

    class Params:
        approved = factory.Trait(status=ExerciseStatus.APPROVED)
        select_heard = factory.Trait(exercise_type=ExerciseType.SELECT_HEARD)
        true_false = factory.Trait(exercise_type=ExerciseType.TRUE_FALSE)

    @classmethod
    async def create(cls, session=None, **kwargs):
        if kwargs.get("dialog_id") is None:
            dialog = await ListeningDialogFactory.create(session=session)
            kwargs["dialog_id"] = dialog.id
        return await super().create(session=session, **kwargs)


class DialogExerciseItemFactory(BaseFactory):
    """Factory for ExerciseItem (dialog exercise items) model."""

    class Meta:
        model = ExerciseItem

    item_index = factory.Sequence(lambda n: n)
    payload = factory.LazyFunction(
        lambda: {
            "prompt": {
                "el": "Τι είπε ο Νίκος;",
                "en": "What did Nikos say?",
                "ru": "Что сказал Никос?",
            },
            "options": [
                {"el": "γεια", "en": "hello", "ru": "привет"},
                {"el": "αντίο", "en": "goodbye", "ru": "до свидания"},
                {"el": "ευχαριστώ", "en": "thank you", "ru": "спасибо"},
                {"el": "παρακαλώ", "en": "please", "ru": "пожалуйста"},
            ],
            "correct_answer_index": 0,
        }
    )

    @classmethod
    async def create(cls, session=None, **kwargs):
        if kwargs.get("exercise_id") is None:
            exercise = await DialogExerciseFactory.create(session=session)
            kwargs["exercise_id"] = exercise.id
        return await super().create(session=session, **kwargs)


__all__ = ["DialogExerciseFactory", "DialogExerciseItemFactory", "ListeningDialogFactory"]
