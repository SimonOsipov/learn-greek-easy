"""Situation factory for tests."""

import factory

from src.db.models import Situation, SituationStatus
from tests.factories.base import BaseFactory


class SituationFactory(BaseFactory):
    """Factory for Situation model."""

    class Meta:
        model = Situation

    scenario_el = factory.Sequence(lambda n: f"Ελληνικό σενάριο κατάστασης {n}")
    scenario_en = factory.Sequence(lambda n: f"English situation scenario {n}")
    scenario_ru = factory.Sequence(lambda n: f"Русский сценарий ситуации {n}")
    status = SituationStatus.DRAFT

    class Params:
        ready = factory.Trait(status=SituationStatus.READY)
        partial = factory.Trait(status=SituationStatus.PARTIAL_READY)


__all__ = ["SituationFactory"]
