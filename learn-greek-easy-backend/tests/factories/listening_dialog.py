"""ListeningDialog factory for tests."""

import factory

from src.db.models import DeckLevel, DialogStatus, ListeningDialog
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
        if "situation_id" not in kwargs:
            situation = await SituationFactory.create(session=session)
            kwargs["situation_id"] = situation.id
        return await super().create(session=session, **kwargs)


__all__ = ["ListeningDialogFactory"]
