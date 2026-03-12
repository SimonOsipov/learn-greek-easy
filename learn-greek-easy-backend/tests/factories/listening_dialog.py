"""ListeningDialog factory for tests."""

import factory

from src.db.models import DeckLevel, DialogStatus, ListeningDialog
from tests.factories.base import BaseFactory


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
        published = factory.Trait(status=DialogStatus.PUBLISHED)
        audio_ready = factory.Trait(status=DialogStatus.AUDIO_READY)
        exercises_ready = factory.Trait(status=DialogStatus.EXERCISES_READY)
        a1_level = factory.Trait(cefr_level=DeckLevel.A1)
        b2_level = factory.Trait(cefr_level=DeckLevel.B2)


__all__ = ["ListeningDialogFactory"]
