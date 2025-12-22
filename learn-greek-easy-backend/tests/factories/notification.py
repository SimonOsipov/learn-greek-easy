"""Notification model factory.

This module provides factories for notification-related models:
- NotificationFactory: User notifications with type traits

Usage:
    # Create a notification
    notification = await NotificationFactory.create(session=db_session, user_id=user.id)

    # Create achievement notification
    notification = await NotificationFactory.create(
        session=db_session, user_id=user.id, achievement=True
    )

    # Create read notification
    notification = await NotificationFactory.create(
        session=db_session, user_id=user.id, read_notification=True
    )
"""

import factory

from src.db.models import Notification, NotificationType
from tests.factories.base import BaseFactory, utc_now


class NotificationFactory(BaseFactory):
    """Factory for Notification model.

    Creates user notification records.

    Traits:
        achievement: Achievement unlocked notification
        level_up: Level up notification
        daily_goal: Daily goal complete notification
        streak_at_risk: Streak at risk notification
        streak_lost: Streak lost notification
        welcome: Welcome notification
        read_notification: Already read notification

    Example:
        notification = await NotificationFactory.create(session=db_session, user_id=user.id)
        achievement_notif = await NotificationFactory.create(
            session=db_session, user_id=user.id, achievement=True
        )
    """

    class Meta:
        model = Notification

    # Required: Must be provided
    user_id = None  # Must be set explicitly

    # Default values (welcome type)
    type = NotificationType.WELCOME
    title = factory.Faker("sentence", nb_words=4)
    message = factory.Faker("sentence", nb_words=10)
    icon = "info"
    action_url = None
    extra_data = None
    read = False
    read_at = None

    class Params:
        """Factory traits for notification types."""

        # Achievement unlocked
        achievement = factory.Trait(
            type=NotificationType.ACHIEVEMENT_UNLOCKED,
            title="Achievement Unlocked: First Flame",
            message="You earned 50 XP!",
            icon="trophy",
            action_url="/achievements",
            extra_data={"achievement_id": "streak_first_flame", "xp_reward": 50},
        )

        # Level up
        level_up = factory.Trait(
            type=NotificationType.LEVEL_UP,
            title="Level Up!",
            message="You reached Level 5: Intermediate",
            icon="arrow-up",
            action_url="/profile",
            extra_data={"new_level": 5, "level_name": "Intermediate"},
        )

        # Daily goal complete
        daily_goal = factory.Trait(
            type=NotificationType.DAILY_GOAL_COMPLETE,
            title="Daily Goal Complete!",
            message="You reviewed 20 cards today. Great job!",
            icon="check-circle",
            action_url="/",
            extra_data={"reviews_completed": 20},
        )

        # Streak at risk
        streak_at_risk = factory.Trait(
            type=NotificationType.STREAK_AT_RISK,
            title="Streak at Risk!",
            message="Study now to keep your 7-day streak going!",
            icon="flame",
            action_url="/decks",
            extra_data={"streak_days": 7},
        )

        # Streak lost
        streak_lost = factory.Trait(
            type=NotificationType.STREAK_LOST,
            title="Streak Lost",
            message="Your 14-day streak has ended. Start a new one today!",
            icon="broken-heart",
            action_url="/",
            extra_data={"lost_streak": 14},
        )

        # Welcome
        welcome = factory.Trait(
            type=NotificationType.WELCOME,
            title="Welcome to Greekly!",
            message="Start your Greek learning journey today. Choose a deck to begin!",
            icon="wave",
            action_url="/decks",
        )

        # Read notification
        read_notification = factory.Trait(
            read=True,
            read_at=factory.LazyFunction(utc_now),
        )
