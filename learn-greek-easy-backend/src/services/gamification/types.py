from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import ItemsView, KeysView, Mapping
from uuid import UUID

from src.services.achievement_definitions import AchievementMetric


class ReconcileMode(str, Enum):
    IMMEDIATE = "immediate"
    QUIET = "quiet"
    SUMMARY = "summary"


class MetricValues:
    """Wrapper around dict[AchievementMetric, int] that raises KeyError instead
    of returning 0 for missing metrics. Forces exhaustive coverage in projection.
    Eliminates the silent-zero pattern that produced 26 unreachable achievements."""

    def __init__(self, values: Mapping[AchievementMetric, int]) -> None:
        self._values: dict[AchievementMetric, int] = dict(values)

    def __getitem__(self, key: AchievementMetric) -> int:
        if key not in self._values:
            raise KeyError(f"Metric {key} not computed by projection")
        return self._values[key]

    def __contains__(self, key: object) -> bool:
        return key in self._values

    def keys(self) -> KeysView[AchievementMetric]:
        return self._values.keys()

    def items(self) -> ItemsView[AchievementMetric, int]:
        return self._values.items()


@dataclass(frozen=True, slots=True)
class GamificationSnapshot:
    user_id: UUID
    metrics: MetricValues
    unlocked: frozenset[str]
    total_xp: int
    current_level: int
    projection_version: int
    computed_at: datetime
