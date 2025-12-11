"""Achievement definitions for gamification.

This module defines all available achievements and their thresholds.
Achievements are calculated in real-time based on user statistics.

Achievement Types:
- STREAK: Consecutive days of study
- MASTERED: Number of cards mastered
- REVIEWS: Total reviews completed
- STUDY_TIME: Total time spent studying (seconds)
- DECKS: Number of decks started
"""

from dataclasses import dataclass
from enum import Enum


class AchievementType(str, Enum):
    """Types of achievements based on different metrics."""

    STREAK = "streak"  # Consecutive days of study
    MASTERED = "mastered"  # Cards mastered
    REVIEWS = "reviews"  # Total reviews completed
    STUDY_TIME = "study_time"  # Time spent studying (seconds)
    DECKS = "decks"  # Decks started


@dataclass(frozen=True)
class AchievementDefinition:
    """Definition of a single achievement.

    Attributes:
        id: Unique identifier for the achievement
        name: Display name
        description: Description of how to unlock
        icon: Icon identifier for frontend display
        threshold: Value required to unlock
        type: Type of metric to track
        points: Points awarded when unlocked
    """

    id: str
    name: str
    description: str
    icon: str
    threshold: int
    type: AchievementType
    points: int


# ============================================================================
# Achievement Definitions
# ============================================================================

ACHIEVEMENTS: list[AchievementDefinition] = [
    # Streak Achievements
    AchievementDefinition(
        id="streak_3",
        name="Getting Started",
        description="Maintain a 3-day study streak",
        icon="fire",
        threshold=3,
        type=AchievementType.STREAK,
        points=25,
    ),
    AchievementDefinition(
        id="streak_7",
        name="Week Warrior",
        description="Maintain a 7-day study streak",
        icon="flame",
        threshold=7,
        type=AchievementType.STREAK,
        points=50,
    ),
    AchievementDefinition(
        id="streak_30",
        name="Monthly Master",
        description="Maintain a 30-day study streak",
        icon="trophy",
        threshold=30,
        type=AchievementType.STREAK,
        points=200,
    ),
    # Mastered Cards Achievements
    AchievementDefinition(
        id="mastered_10",
        name="First Steps",
        description="Master 10 flashcards",
        icon="star",
        threshold=10,
        type=AchievementType.MASTERED,
        points=20,
    ),
    AchievementDefinition(
        id="mastered_50",
        name="Growing Vocabulary",
        description="Master 50 flashcards",
        icon="stars",
        threshold=50,
        type=AchievementType.MASTERED,
        points=50,
    ),
    AchievementDefinition(
        id="mastered_100",
        name="Century Club",
        description="Master 100 flashcards",
        icon="medal",
        threshold=100,
        type=AchievementType.MASTERED,
        points=100,
    ),
    AchievementDefinition(
        id="mastered_500",
        name="Word Wizard",
        description="Master 500 flashcards",
        icon="crown",
        threshold=500,
        type=AchievementType.MASTERED,
        points=500,
    ),
    # Reviews Achievements
    AchievementDefinition(
        id="reviews_100",
        name="Dedicated Learner",
        description="Complete 100 reviews",
        icon="book",
        threshold=100,
        type=AchievementType.REVIEWS,
        points=30,
    ),
    AchievementDefinition(
        id="reviews_1000",
        name="Review Champion",
        description="Complete 1,000 reviews",
        icon="books",
        threshold=1000,
        type=AchievementType.REVIEWS,
        points=150,
    ),
    # Study Time Achievements (in seconds)
    AchievementDefinition(
        id="time_1hr",
        name="Hour of Power",
        description="Study for 1 hour total",
        icon="clock",
        threshold=3600,  # 1 hour in seconds
        type=AchievementType.STUDY_TIME,
        points=40,
    ),
    AchievementDefinition(
        id="time_10hr",
        name="Time Investor",
        description="Study for 10 hours total",
        icon="hourglass",
        threshold=36000,  # 10 hours in seconds
        type=AchievementType.STUDY_TIME,
        points=200,
    ),
    # Deck Achievements
    AchievementDefinition(
        id="decks_3",
        name="Explorer",
        description="Start studying 3 different decks",
        icon="layers",
        threshold=3,
        type=AchievementType.DECKS,
        points=30,
    ),
]


def get_achievement_by_id(achievement_id: str) -> AchievementDefinition | None:
    """Get an achievement definition by its ID.

    Args:
        achievement_id: The unique achievement identifier

    Returns:
        AchievementDefinition if found, None otherwise
    """
    for achievement in ACHIEVEMENTS:
        if achievement.id == achievement_id:
            return achievement
    return None


def get_achievements_by_type(achievement_type: AchievementType) -> list[AchievementDefinition]:
    """Get all achievements of a specific type.

    Args:
        achievement_type: The type of achievements to retrieve

    Returns:
        List of matching AchievementDefinition objects
    """
    return [a for a in ACHIEVEMENTS if a.type == achievement_type]


# ============================================================================
# Module Exports
# ============================================================================

__all__ = [
    "AchievementType",
    "AchievementDefinition",
    "ACHIEVEMENTS",
    "get_achievement_by_id",
    "get_achievements_by_type",
]
