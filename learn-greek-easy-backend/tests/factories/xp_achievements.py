"""XP and Achievements model factories.

This module provides factories for XP and achievement-related models:
- UserXPFactory: User XP and level tracking
- XPTransactionFactory: XP transaction history
- AchievementFactory: Achievement definitions
- UserAchievementFactory: User's unlocked achievements

Usage:
    # Create user XP record
    xp = await UserXPFactory.create(user_id=user.id)

    # Create high-level user
    high_level = await UserXPFactory.create(user_id=user.id, high_level=True)

    # Create XP transaction
    transaction = await XPTransactionFactory.create(user_id=user.id)

    # Create achievement definition
    achievement = await AchievementFactory.create()

    # Create user achievement (unlocked)
    user_achievement = await UserAchievementFactory.create(
        user_id=user.id, achievement_id=achievement.id
    )
"""

from datetime import date, timedelta

import factory

from src.db.models import Achievement, AchievementCategory, UserAchievement, UserXP, XPTransaction
from tests.factories.base import BaseFactory, utc_now

# =============================================================================
# XP Constants
# =============================================================================

XP_PER_LEVEL = 100  # XP needed per level
XP_REASONS = {
    "correct_answer": 10,
    "daily_goal": 50,
    "streak_bonus": 25,
    "achievement": 100,
    "perfect_session": 30,
}


class UserXPFactory(BaseFactory):
    """Factory for UserXP model.

    Creates user XP and level tracking records.

    Traits:
        fresh: New user with no XP
        intermediate: User at level 5 with some XP
        high_level: User at level 10 with high XP
        daily_claimed: User who claimed daily bonus today

    Example:
        xp = await UserXPFactory.create(user_id=user.id)
        high_level = await UserXPFactory.create(user_id=user.id, high_level=True)
    """

    class Meta:
        model = UserXP

    # Required: Must be provided
    user_id = None  # Must be set explicitly

    # Default values
    total_xp = 150
    current_level = 2
    last_daily_bonus_date = None

    class Params:
        """Factory traits for common variations."""

        # Fresh user (no XP)
        fresh = factory.Trait(
            total_xp=0,
            current_level=1,
            last_daily_bonus_date=None,
        )

        # Intermediate user (level 5)
        intermediate = factory.Trait(
            total_xp=450,
            current_level=5,
            last_daily_bonus_date=factory.LazyFunction(lambda: date.today() - timedelta(days=1)),
        )

        # High level user (level 10)
        high_level = factory.Trait(
            total_xp=950,
            current_level=10,
            last_daily_bonus_date=factory.LazyFunction(lambda: date.today() - timedelta(days=1)),
        )

        # Already claimed daily bonus today
        daily_claimed = factory.Trait(
            last_daily_bonus_date=factory.LazyFunction(date.today),
        )


class XPTransactionFactory(BaseFactory):
    """Factory for XPTransaction model.

    Creates XP transaction history records for analytics.

    Traits:
        card_review: XP from correct card review
        daily_bonus: XP from daily first review bonus
        achievement: XP from unlocking achievement
        streak_bonus: XP from streak milestone

    Example:
        transaction = await XPTransactionFactory.create(user_id=user.id)
        daily = await XPTransactionFactory.create(user_id=user.id, daily_bonus=True)
    """

    class Meta:
        model = XPTransaction

    # Required: Must be provided
    user_id = None  # Must be set explicitly

    # Default values
    amount = 10
    reason = "correct_answer"
    source_id = None
    earned_at = factory.LazyFunction(utc_now)

    class Params:
        """Factory traits for XP sources."""

        # Card review XP
        card_review = factory.Trait(
            amount=XP_REASONS["correct_answer"],
            reason="correct_answer",
        )

        # Daily first review bonus
        daily_bonus = factory.Trait(
            amount=XP_REASONS["daily_goal"],
            reason="daily_goal",
        )

        # Achievement unlock XP
        achievement = factory.Trait(
            amount=XP_REASONS["achievement"],
            reason="achievement",
        )

        # Streak bonus XP
        streak_bonus = factory.Trait(
            amount=XP_REASONS["streak_bonus"],
            reason="streak_bonus",
        )

        # Perfect session bonus
        perfect_session = factory.Trait(
            amount=XP_REASONS["perfect_session"],
            reason="perfect_session",
        )


class AchievementFactory(BaseFactory):
    """Factory for Achievement model.

    Creates achievement definition records.

    Traits:
        streak: Streak-based achievement
        learning: Learning milestone achievement
        session: Session-based achievement
        accuracy: Accuracy-based achievement
        cefr: CEFR level completion achievement
        special: Special achievement

    Example:
        achievement = await AchievementFactory.create()
        streak_achievement = await AchievementFactory.create(streak=True)
    """

    class Meta:
        model = Achievement

    # Default values
    id = factory.Sequence(lambda n: f"achievement_{n}")
    name = factory.Faker("word")
    description = factory.Faker("sentence")
    category = AchievementCategory.LEARNING
    icon = "star"
    threshold = 10
    xp_reward = 50
    sort_order = factory.Sequence(lambda n: n)

    class Params:
        """Factory traits for achievement categories."""

        # Streak achievement
        streak = factory.Trait(
            id=factory.Sequence(lambda n: f"streak_{n}"),
            name="Streak Master",
            description="Maintain a study streak",
            category=AchievementCategory.STREAK,
            icon="fire",
            threshold=7,
            xp_reward=100,
        )

        # Learning milestone
        learning = factory.Trait(
            id=factory.Sequence(lambda n: f"learning_{n}"),
            name="Word Collector",
            description="Learn new words",
            category=AchievementCategory.LEARNING,
            icon="book",
            threshold=100,
            xp_reward=150,
        )

        # Session achievement
        session = factory.Trait(
            id=factory.Sequence(lambda n: f"session_{n}"),
            name="Session Champion",
            description="Complete review sessions",
            category=AchievementCategory.SESSION,
            icon="target",
            threshold=10,
            xp_reward=75,
        )

        # Accuracy achievement
        accuracy = factory.Trait(
            id=factory.Sequence(lambda n: f"accuracy_{n}"),
            name="Perfect Score",
            description="Achieve high accuracy",
            category=AchievementCategory.ACCURACY,
            icon="checkmark",
            threshold=100,
            xp_reward=200,
        )

        # CEFR level achievement
        cefr = factory.Trait(
            id=factory.Sequence(lambda n: f"cefr_{n}"),
            name="Level Master",
            description="Complete a CEFR level",
            category=AchievementCategory.CEFR,
            icon="trophy",
            threshold=1,
            xp_reward=500,
        )

        # Special achievement
        special = factory.Trait(
            id=factory.Sequence(lambda n: f"special_{n}"),
            name="Special Achievement",
            description="A special milestone",
            category=AchievementCategory.SPECIAL,
            icon="sparkles",
            threshold=1,
            xp_reward=250,
        )


class UserAchievementFactory(BaseFactory):
    """Factory for UserAchievement model.

    Creates user achievement unlock records.

    Traits:
        seen: User has been notified about this achievement
        recent: Recently unlocked (today)
        old: Unlocked long ago

    Example:
        ua = await UserAchievementFactory.create(
            user_id=user.id, achievement_id=achievement.id
        )
        seen = await UserAchievementFactory.create(
            user_id=user.id, achievement_id=achievement.id, seen=True
        )
    """

    class Meta:
        model = UserAchievement

    # Required: Must be provided
    user_id = None  # Must be set explicitly
    achievement_id = None  # Must be set explicitly

    # Default values
    unlocked_at = factory.LazyFunction(utc_now)
    notified = False

    class Params:
        """Factory traits for common variations."""

        # User has been notified
        seen = factory.Trait(
            notified=True,
        )

        # Recently unlocked (today)
        recent = factory.Trait(
            unlocked_at=factory.LazyFunction(utc_now),
            notified=False,
        )

        # Old achievement (unlocked long ago)
        old = factory.Trait(
            unlocked_at=factory.LazyFunction(lambda: utc_now() - timedelta(days=30)),
            notified=True,
        )
