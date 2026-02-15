# -*- coding: utf-8 -*-
"""Shared fixtures for repository tests."""

from datetime import date, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from src.db.models import (
    Card,
    CardStatistics,
    CardStatus,
    CardSystemVersion,
    Deck,
    DeckLevel,
    Review,
    User,
    UserDeckProgress,
    UserSettings,
)


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
        card_system=CardSystemVersion.V1,
        is_active=True,
    )
    db_session.add(deck)
    await db_session.commit()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def sample_cards(db_session, sample_deck):
    """Create sample cards for testing."""
    cards = [
        Card(
            deck_id=sample_deck.id,
            front_text="Hello",
            back_text_en="Yeia sou",
            pronunciation="Yah soo",
        ),
        Card(
            deck_id=sample_deck.id,
            front_text="Goodbye",
            back_text_en="Adio",
            pronunciation="Adio",
        ),
        Card(
            deck_id=sample_deck.id,
            front_text="Thank you",
            back_text_en="Efharisto",
            pronunciation="Efharisto",
        ),
    ]
    for card in cards:
        db_session.add(card)
    await db_session.commit()
    for card in cards:
        await db_session.refresh(card)

    # Refresh the deck to update its cards relationship
    # This ensures selectinload will see the newly created cards
    db_session.expire(sample_deck, ["cards"])

    return cards


@pytest.fixture
async def sample_progress(db_session, sample_user, sample_deck):
    """Create sample user deck progress."""
    progress = UserDeckProgress(
        user_id=sample_user.id,
        deck_id=sample_deck.id,
        cards_studied=5,
        cards_mastered=2,
        last_studied_at=datetime.utcnow(),
    )
    db_session.add(progress)
    await db_session.commit()
    await db_session.refresh(progress)
    return progress


@pytest.fixture
async def sample_card_statistics(db_session, sample_user, sample_cards):
    """Create sample card statistics."""
    stats = CardStatistics(
        user_id=sample_user.id,
        card_id=sample_cards[0].id,
        easiness_factor=2.5,
        interval=1,
        repetitions=1,
        next_review_date=date.today(),
        status=CardStatus.LEARNING,
    )
    db_session.add(stats)
    await db_session.commit()
    await db_session.refresh(stats)
    return stats


@pytest.fixture
async def sample_review(db_session, sample_user, sample_cards):
    """Create sample review."""
    review = Review(
        user_id=sample_user.id,
        card_id=sample_cards[0].id,
        quality=4,
        time_taken=5,
        reviewed_at=datetime.utcnow(),
    )
    db_session.add(review)
    await db_session.commit()
    await db_session.refresh(review)
    return review
