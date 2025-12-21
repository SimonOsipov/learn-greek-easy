"""Achievement definitions matching PRD specification.

This module defines all available achievements, their thresholds, and XP rewards.
Achievement definitions are CODE-ONLY - they reference the AchievementCategory
enum from the database models but define metrics and hints in code.

Achievement Categories:
- STREAK: Consecutive days of study
- LEARNING: Cards learned/mastered
- SESSION: Single session achievements
- ACCURACY: Accuracy-based achievements
- CEFR: CEFR level completion
- SPECIAL: Special/misc achievements
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional

# Import AchievementCategory from models to reuse
from src.db.models import AchievementCategory


class AchievementMetric(str, Enum):
    """What metric triggers this achievement (CODE-ONLY, not in DB)."""

    # Core metrics
    STREAK_DAYS = "streak_days"
    CARDS_LEARNED = "cards_learned"
    CARDS_MASTERED = "cards_mastered"
    TOTAL_REVIEWS = "total_reviews"

    # Session metrics
    SESSION_CARDS = "session_cards"
    SESSION_ACCURACY = "session_accuracy"
    SESSION_SPEED = "session_speed"
    SESSION_TIME = "session_time"  # Hour of day

    # Accuracy metrics
    WEEKLY_ACCURACY = "weekly_accuracy"
    CONSECUTIVE_CORRECT = "consecutive_correct"

    # CEFR completion metrics
    CEFR_A1_COMPLETE = "cefr_a1_complete"
    CEFR_A2_COMPLETE = "cefr_a2_complete"
    CEFR_B1_COMPLETE = "cefr_b1_complete"
    CEFR_B2_COMPLETE = "cefr_b2_complete"
    CEFR_C1_COMPLETE = "cefr_c1_complete"
    CEFR_C2_COMPLETE = "cefr_c2_complete"

    # Special metrics
    FIRST_REVIEW = "first_review"
    INACTIVE_RETURN = "inactive_return"
    DAILY_GOAL_STREAK = "daily_goal_streak"
    DAILY_GOAL_EXCEEDED = "daily_goal_exceeded"


@dataclass(frozen=True)
class AchievementDef:
    """Definition of a single achievement (CODE-ONLY).

    Attributes:
        id: Unique identifier for the achievement
        name: Display name
        description: Description of the achievement
        category: Category from AchievementCategory enum
        icon: Emoji or icon identifier
        metric: What metric triggers this achievement
        threshold: Value required to unlock
        xp_reward: XP awarded when unlocked
        hint: Hint shown when achievement is locked
    """

    id: str
    name: str
    description: str
    category: AchievementCategory
    icon: str
    metric: AchievementMetric
    threshold: int
    xp_reward: int
    hint: str


# ============================================================================
# Achievement Definitions (35+ achievements)
# ============================================================================

ACHIEVEMENTS: list[AchievementDef] = [
    # === STREAK ACHIEVEMENTS (7) ===
    AchievementDef(
        "streak_first_flame",
        "First Flame",
        "Maintain a 3-day streak",
        AchievementCategory.STREAK,
        "fire",
        AchievementMetric.STREAK_DAYS,
        3,
        50,
        "Study for 3 days in a row",
    ),
    AchievementDef(
        "streak_warming_up",
        "Warming Up",
        "Maintain a 7-day streak",
        AchievementCategory.STREAK,
        "fire_double",
        AchievementMetric.STREAK_DAYS,
        7,
        100,
        "Study for a full week",
    ),
    AchievementDef(
        "streak_on_fire",
        "On Fire",
        "Maintain a 14-day streak",
        AchievementCategory.STREAK,
        "fire_triple",
        AchievementMetric.STREAK_DAYS,
        14,
        150,
        "Study for two weeks straight",
    ),
    AchievementDef(
        "streak_burning_bright",
        "Burning Bright",
        "Maintain a 30-day streak",
        AchievementCategory.STREAK,
        "star_fire",
        AchievementMetric.STREAK_DAYS,
        30,
        300,
        "Study for a full month",
    ),
    AchievementDef(
        "streak_unstoppable",
        "Unstoppable",
        "Maintain a 60-day streak",
        AchievementCategory.STREAK,
        "diamond_fire",
        AchievementMetric.STREAK_DAYS,
        60,
        500,
        "Study for two months",
    ),
    AchievementDef(
        "streak_eternal_flame",
        "Eternal Flame",
        "Maintain a 100-day streak",
        AchievementCategory.STREAK,
        "trophy_fire",
        AchievementMetric.STREAK_DAYS,
        100,
        1000,
        "Study for 100 days",
    ),
    AchievementDef(
        "streak_prometheus",
        "Prometheus",
        "Maintain a 365-day streak",
        AchievementCategory.STREAK,
        "crown_fire",
        AchievementMetric.STREAK_DAYS,
        365,
        5000,
        "Study every day for a year",
    ),
    # === LEARNING MILESTONES (7) ===
    AchievementDef(
        "learning_first_word",
        "First Word",
        "Learn your first card",
        AchievementCategory.LEARNING,
        "book",
        AchievementMetric.CARDS_LEARNED,
        1,
        10,
        "Complete your first flashcard",
    ),
    AchievementDef(
        "learning_vocabulary_builder",
        "Vocabulary Builder",
        "Learn 50 cards",
        AchievementCategory.LEARNING,
        "books",
        AchievementMetric.CARDS_LEARNED,
        50,
        100,
        "Learn 50 vocabulary words",
    ),
    AchievementDef(
        "learning_word_collector",
        "Word Collector",
        "Learn 100 cards",
        AchievementCategory.LEARNING,
        "books_double",
        AchievementMetric.CARDS_LEARNED,
        100,
        200,
        "Learn 100 vocabulary words",
    ),
    AchievementDef(
        "learning_lexicon",
        "Lexicon",
        "Learn 250 cards",
        AchievementCategory.LEARNING,
        "book_red",
        AchievementMetric.CARDS_LEARNED,
        250,
        400,
        "Learn 250 vocabulary words",
    ),
    AchievementDef(
        "learning_dictionary",
        "Dictionary",
        "Learn 500 cards",
        AchievementCategory.LEARNING,
        "book_green",
        AchievementMetric.CARDS_LEARNED,
        500,
        750,
        "Learn 500 vocabulary words",
    ),
    AchievementDef(
        "learning_encyclopedia",
        "Encyclopedia",
        "Learn 1,000 cards",
        AchievementCategory.LEARNING,
        "book_blue",
        AchievementMetric.CARDS_LEARNED,
        1000,
        1500,
        "Learn 1000 vocabulary words",
    ),
    AchievementDef(
        "learning_library",
        "Library",
        "Learn 2,500 cards",
        AchievementCategory.LEARNING,
        "library",
        AchievementMetric.CARDS_LEARNED,
        2500,
        3000,
        "Learn 2500 vocabulary words",
    ),
    # === SESSION ACHIEVEMENTS (6) ===
    AchievementDef(
        "session_quick_study",
        "Quick Study",
        "Complete 10 cards in one session",
        AchievementCategory.SESSION,
        "lightning",
        AchievementMetric.SESSION_CARDS,
        10,
        25,
        "Review 10 cards in a single session",
    ),
    AchievementDef(
        "session_marathon",
        "Marathon",
        "Complete 50 cards in one session",
        AchievementCategory.SESSION,
        "runner",
        AchievementMetric.SESSION_CARDS,
        50,
        100,
        "Review 50 cards in a single session",
    ),
    AchievementDef(
        "session_perfectionist",
        "Perfectionist",
        "100% accuracy in 20+ card session",
        AchievementCategory.SESSION,
        "hundred",
        AchievementMetric.SESSION_ACCURACY,
        100,
        150,
        "Get 100% accuracy in a 20+ card session",
    ),
    AchievementDef(
        "session_speed_demon",
        "Speed Demon",
        "Average < 3s per card (20+ cards)",
        AchievementCategory.SESSION,
        "lightning_double",
        AchievementMetric.SESSION_SPEED,
        3,
        150,
        "Answer quickly with high accuracy",
    ),
    AchievementDef(
        "session_night_owl",
        "Night Owl",
        "Study after 10 PM",
        AchievementCategory.SESSION,
        "owl",
        AchievementMetric.SESSION_TIME,
        22,
        50,
        "Study late at night",
    ),
    AchievementDef(
        "session_early_bird",
        "Early Bird",
        "Study before 7 AM",
        AchievementCategory.SESSION,
        "bird",
        AchievementMetric.SESSION_TIME,
        7,
        50,
        "Study early in the morning",
    ),
    # === ACCURACY ACHIEVEMENTS (4) ===
    AchievementDef(
        "accuracy_sharp_mind",
        "Sharp Mind",
        "80% weekly accuracy",
        AchievementCategory.ACCURACY,
        "target",
        AchievementMetric.WEEKLY_ACCURACY,
        80,
        100,
        "Maintain 80% accuracy over a week",
    ),
    AchievementDef(
        "accuracy_precision",
        "Precision",
        "90% weekly accuracy",
        AchievementCategory.ACCURACY,
        "target_double",
        AchievementMetric.WEEKLY_ACCURACY,
        90,
        200,
        "Maintain 90% accuracy over a week",
    ),
    AchievementDef(
        "accuracy_flawless",
        "Flawless",
        "95% weekly accuracy (50+ reviews)",
        AchievementCategory.ACCURACY,
        "diamond",
        AchievementMetric.WEEKLY_ACCURACY,
        95,
        500,
        "Maintain 95% accuracy with 50+ reviews",
    ),
    AchievementDef(
        "accuracy_master_memory",
        "Master Memory",
        "100 consecutive correct answers",
        AchievementCategory.ACCURACY,
        "brain",
        AchievementMetric.CONSECUTIVE_CORRECT,
        100,
        300,
        "Answer 100 cards correctly in a row",
    ),
    # === CEFR LEVEL ACHIEVEMENTS (6) ===
    AchievementDef(
        "cefr_a1_explorer",
        "A1 Explorer",
        "Complete all A1 deck cards",
        AchievementCategory.CEFR,
        "medal_bronze",
        AchievementMetric.CEFR_A1_COMPLETE,
        1,
        200,
        "Master the A1 vocabulary deck",
    ),
    AchievementDef(
        "cefr_a2_traveler",
        "A2 Traveler",
        "Complete all A2 deck cards",
        AchievementCategory.CEFR,
        "medal_bronze_double",
        AchievementMetric.CEFR_A2_COMPLETE,
        1,
        300,
        "Master the A2 vocabulary deck",
    ),
    AchievementDef(
        "cefr_b1_conversant",
        "B1 Conversant",
        "Complete all B1 deck cards",
        AchievementCategory.CEFR,
        "medal_silver",
        AchievementMetric.CEFR_B1_COMPLETE,
        1,
        400,
        "Master the B1 vocabulary deck",
    ),
    AchievementDef(
        "cefr_b2_proficient",
        "B2 Proficient",
        "Complete all B2 deck cards",
        AchievementCategory.CEFR,
        "medal_silver_double",
        AchievementMetric.CEFR_B2_COMPLETE,
        1,
        500,
        "Master the B2 vocabulary deck",
    ),
    AchievementDef(
        "cefr_c1_advanced",
        "C1 Advanced",
        "Complete all C1 deck cards",
        AchievementCategory.CEFR,
        "medal_gold",
        AchievementMetric.CEFR_C1_COMPLETE,
        1,
        750,
        "Master the C1 vocabulary deck",
    ),
    AchievementDef(
        "cefr_c2_mastery",
        "C2 Mastery",
        "Complete all C2 deck cards",
        AchievementCategory.CEFR,
        "crown",
        AchievementMetric.CEFR_C2_COMPLETE,
        1,
        1000,
        "Master the C2 vocabulary deck",
    ),
    # === SPECIAL ACHIEVEMENTS (5+) ===
    AchievementDef(
        "special_first_review",
        "First Steps",
        "Complete your first review",
        AchievementCategory.SPECIAL,
        "footprints",
        AchievementMetric.FIRST_REVIEW,
        1,
        25,
        "Start your learning journey",
    ),
    AchievementDef(
        "special_comeback_kid",
        "Comeback Kid",
        "Return after 7+ days inactive",
        AchievementCategory.SPECIAL,
        "refresh",
        AchievementMetric.INACTIVE_RETURN,
        7,
        100,
        "Come back after a break",
    ),
    AchievementDef(
        "special_dedicated",
        "Dedicated",
        "Hit daily goal 7 days in a row",
        AchievementCategory.SPECIAL,
        "star",
        AchievementMetric.DAILY_GOAL_STREAK,
        7,
        150,
        "Hit your daily goal every day for a week",
    ),
    AchievementDef(
        "special_consistent",
        "Consistent",
        "Hit daily goal 30 days in a row",
        AchievementCategory.SPECIAL,
        "star_double",
        AchievementMetric.DAILY_GOAL_STREAK,
        30,
        500,
        "Hit your daily goal every day for a month",
    ),
    AchievementDef(
        "special_overachiever",
        "Overachiever",
        "Exceed daily goal by 2x",
        AchievementCategory.SPECIAL,
        "rocket",
        AchievementMetric.DAILY_GOAL_EXCEEDED,
        200,
        100,
        "Double your daily goal",
    ),
]


# ============================================================================
# Helper Functions
# ============================================================================


def get_achievement_by_id(achievement_id: str) -> Optional[AchievementDef]:
    """Get achievement definition by ID.

    Args:
        achievement_id: The unique achievement identifier

    Returns:
        AchievementDef if found, None otherwise
    """
    for ach in ACHIEVEMENTS:
        if ach.id == achievement_id:
            return ach
    return None


def get_achievements_by_category(category: AchievementCategory) -> list[AchievementDef]:
    """Get all achievements in a category.

    Args:
        category: The achievement category

    Returns:
        List of matching AchievementDef objects
    """
    return [a for a in ACHIEVEMENTS if a.category == category]


def get_achievements_by_metric(metric: AchievementMetric) -> list[AchievementDef]:
    """Get all achievements that use a specific metric.

    Args:
        metric: The achievement metric

    Returns:
        List of matching AchievementDef objects
    """
    return [a for a in ACHIEVEMENTS if a.metric == metric]


# ============================================================================
# Module Exports
# ============================================================================

__all__ = [
    "AchievementCategory",
    "AchievementMetric",
    "AchievementDef",
    "ACHIEVEMENTS",
    "get_achievement_by_id",
    "get_achievements_by_category",
    "get_achievements_by_metric",
]
