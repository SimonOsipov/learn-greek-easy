# -*- coding: utf-8 -*-
"""Shared fixtures for repository tests."""

import pytest
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from src.db.models import Deck, DeckLevel, User, UserSettings


@pytest.fixture
async def sample_user(db_session):
    """Create a sample user for testing."""
    user = User(
        email="test@example.com",
        full_name="Test User",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def sample_user_with_settings(db_session):
    """Create a sample user with settings."""
    user = User(
        email="user_with_settings@example.com",
        full_name="User With Settings",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()

    settings = UserSettings(
        user_id=user.id,
        daily_goal=25,
        email_notifications=True,
    )
    db_session.add(settings)
    await db_session.commit()

    # Reload user with settings using selectinload (required for lazy="raise")
    stmt = select(User).options(selectinload(User.settings)).where(User.id == user.id)
    result = await db_session.execute(stmt)
    user = result.scalar_one()
    return user


@pytest.fixture
async def sample_deck(db_session):
    """Create a sample deck for testing."""
    deck = Deck(
        name_el="Βασικά Ελληνικά A1",
        name_en="Greek Basics A1",
        name_ru="Греческий Основы A1",
        description_el="Βασικό ελληνικό λεξιλόγιο και φράσεις",
        description_en="Basic Greek vocabulary and phrases",
        description_ru="Базовая греческая лексика и фразы",
        level=DeckLevel.A1,
        is_active=True,
    )
    db_session.add(deck)
    await db_session.commit()
    await db_session.refresh(deck)
    return deck
