"""XP system constants and level definitions."""

from dataclasses import dataclass
from typing import List

# XP Earning Amounts
XP_CORRECT_ANSWER = 10
XP_PERFECT_ANSWER = 15  # Alias for perfect recall (< 2 seconds response)
XP_DAILY_GOAL = 50
XP_SESSION_COMPLETE = 25
XP_FIRST_REVIEW = 20  # First review of the day bonus
XP_STREAK_MULTIPLIER = 10  # x streak_days

# Perfect recall threshold in seconds
PERFECT_RECALL_THRESHOLD_SECONDS = 2


@dataclass(frozen=True)
class LevelDefinition:
    """Level definition with Greek name."""

    level: int
    name_greek: str
    name_english: str
    xp_required: int  # XP needed to reach this level from previous
    total_xp: int  # Cumulative XP at this level


# 15-Level Progression System
# Greek names represent the learning journey from beginner to master
LEVELS: List[LevelDefinition] = [
    LevelDefinition(1, "Αρχάριος", "Beginner", 0, 0),
    LevelDefinition(2, "Μαθητής", "Student", 100, 100),
    LevelDefinition(3, "Σπουδαστής", "Learner", 250, 350),
    LevelDefinition(4, "Αναγνώστης", "Reader", 500, 850),
    LevelDefinition(5, "Γνώστης", "Knower", 750, 1600),
    LevelDefinition(6, "Ερευνητής", "Explorer", 1000, 2600),
    LevelDefinition(7, "Μελετητής", "Scholar", 1500, 4100),
    LevelDefinition(8, "Δάσκαλος", "Teacher", 2000, 6100),
    LevelDefinition(9, "Σοφός", "Sage", 3000, 9100),
    LevelDefinition(10, "Φιλόσοφος", "Philosopher", 5000, 14100),
    LevelDefinition(11, "Ποιητής", "Poet", 7500, 21600),
    LevelDefinition(12, "Ρήτορας", "Orator", 10000, 31600),
    LevelDefinition(13, "Ιστορικός", "Historian", 15000, 46600),
    LevelDefinition(14, "Μύστης", "Initiate", 20000, 66600),
    LevelDefinition(15, "Πολύγλωσσος", "Polyglot", 33400, 100000),
]

MAX_LEVEL = 15


def get_level_from_xp(total_xp: int) -> int:
    """Calculate level from total XP.

    Args:
        total_xp: The total XP accumulated by the user

    Returns:
        The level number (1-15)
    """
    if total_xp < 0:
        return 1

    for level_def in reversed(LEVELS):
        if total_xp >= level_def.total_xp:
            return level_def.level
    return 1


def get_level_definition(level: int) -> LevelDefinition:
    """Get level definition by level number.

    Args:
        level: The level number (1-15)

    Returns:
        The LevelDefinition for the specified level
    """
    if level < 1:
        level = 1
    if level > MAX_LEVEL:
        level = MAX_LEVEL
    return LEVELS[level - 1]


def get_xp_for_next_level(current_level: int) -> int:
    """Get total XP needed for next level.

    Args:
        current_level: The current level (1-15)

    Returns:
        The total XP threshold for the next level
    """
    if current_level >= MAX_LEVEL:
        return LEVELS[-1].total_xp
    return LEVELS[current_level].total_xp


def get_xp_progress_in_level(total_xp: int, current_level: int) -> tuple[int, int]:
    """Get (current_progress, xp_needed) within current level.

    Args:
        total_xp: The total XP accumulated
        current_level: The current level (1-15)

    Returns:
        Tuple of (progress_in_level, total_xp_needed_for_level)
        Returns (0, 0) if at max level
    """
    if current_level >= MAX_LEVEL:
        return (0, 0)  # Max level reached

    current_threshold = LEVELS[current_level - 1].total_xp
    next_threshold = LEVELS[current_level].total_xp

    progress = total_xp - current_threshold
    needed = next_threshold - current_threshold

    return (progress, needed)
