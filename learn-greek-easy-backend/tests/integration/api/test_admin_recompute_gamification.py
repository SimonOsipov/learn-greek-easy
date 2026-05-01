"""Integration test: admin recompute-gamification endpoint self-heals stuck state.

Scenario:
- A user has one card with status=LEARNING (cards_learned=1 in projection).
- The `learning_first_word` achievement should be unlocked but no UserAchievement
  row exists (simulating a stuck / missed write).
- POST /api/v1/admin/users/{user_id}/recompute-gamification as superuser must:
  1. Return 200 with `learning_first_word` in `newly_unlocked_ids`.
  2. Persist a UserAchievement row in the DB.
  3. Return an empty diff on a second call (idempotent).
"""

from __future__ import annotations

from datetime import date

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    Achievement,
    AchievementCategory,
    CardRecord,
    CardRecordStatistics,
    CardStatus,
    CardType,
    Deck,
    DeckLevel,
    DeckWordEntry,
    PartOfSpeech,
    User,
    UserAchievement,
    WordEntry,
)

# ---------------------------------------------------------------------------
# Local fixtures: create the minimal graph needed for the projection to see
# cards_learned=1 for a specific user.
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def achievement_catalog_learning_first_word(db_session: AsyncSession) -> Achievement:
    """Seed the achievements catalog row for learning_first_word.

    The reconciler uses pg_insert(UserAchievement) which requires the parent
    achievements.id row to exist (FK constraint). Integration tests start with
    an empty DB, so this fixture creates the required catalog entry.
    """
    achievement = Achievement(
        id="learning_first_word",
        name="First Word",
        description="Learn your first card",
        category=AchievementCategory.LEARNING,
        icon="book",
        threshold=1,
        xp_reward=10,
        sort_order=0,
    )
    db_session.add(achievement)
    await db_session.flush()
    return achievement


@pytest_asyncio.fixture
async def recompute_deck(db_session: AsyncSession) -> Deck:
    """Minimal V2 deck for the admin recompute integration test."""
    deck = Deck(
        name_en="Admin Recompute Test Deck",
        name_el="Τεστ Επαναυπολογισμού",
        name_ru="Тест Пересчёта",
        description_en="Test deck for admin recompute integration",
        description_el="Τεστ",
        description_ru="Тест",
        level=DeckLevel.A1,
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest_asyncio.fixture
async def recompute_word_entry(db_session: AsyncSession, recompute_deck: Deck) -> WordEntry:
    """Minimal WordEntry linked to the test deck."""
    entry = WordEntry(
        owner_id=None,
        lemma="γράμμα",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="letter, character",
        is_active=True,
    )
    db_session.add(entry)
    await db_session.flush()
    db_session.add(DeckWordEntry(deck_id=recompute_deck.id, word_entry_id=entry.id))
    await db_session.flush()
    await db_session.refresh(entry)
    return entry


@pytest_asyncio.fixture
async def recompute_card_record(
    db_session: AsyncSession,
    recompute_deck: Deck,
    recompute_word_entry: WordEntry,
) -> CardRecord:
    """CardRecord for the test word entry."""
    record = CardRecord(
        word_entry_id=recompute_word_entry.id,
        deck_id=recompute_deck.id,
        card_type=CardType.MEANING_EL_TO_EN,
        variant_key="admin_recompute_default",
        front_content={"card_type": "meaning_el_to_en", "prompt": "Translate", "main": "γράμμα"},
        back_content={"card_type": "meaning_el_to_en", "answer": "letter, character"},
    )
    db_session.add(record)
    await db_session.flush()
    await db_session.refresh(record)
    return record


# ---------------------------------------------------------------------------
# Integration tests
# ---------------------------------------------------------------------------


@pytest.mark.integration
class TestAdminRecomputeGamification:
    @pytest.mark.asyncio
    async def test_recompute_unlocks_learning_first_word(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        test_user: User,
        db_session: AsyncSession,
        recompute_card_record: CardRecord,
        achievement_catalog_learning_first_word: Achievement,
    ) -> None:
        """Admin recompute self-heals stuck learning_first_word achievement.

        Setup: test_user has cards_learned=1 (LEARNING card) but no
        UserAchievement row for learning_first_word (stuck state).

        Expected: endpoint returns 200 with `learning_first_word` in
        newly_unlocked_ids, and the DB row is persisted.
        """
        # Seed: one LEARNING card for the test user (cards_learned=1 in projection)
        stat = CardRecordStatistics(
            user_id=test_user.id,
            card_record_id=recompute_card_record.id,
            easiness_factor=2.36,
            interval=1,
            repetitions=2,
            next_review_date=date.today(),
            status=CardStatus.LEARNING,
        )
        db_session.add(stat)
        await db_session.flush()

        # Pre-condition: no UserAchievement row for learning_first_word
        pre_count = await db_session.scalar(
            select(func.count()).where(
                UserAchievement.user_id == test_user.id,
                UserAchievement.achievement_id == "learning_first_word",
            )
        )
        assert pre_count == 0, "Pre-condition: UserAchievement must not exist before test"

        # Call admin recompute endpoint as superuser
        response = await client.post(
            f"/api/v1/admin/users/{test_user.id}/recompute-gamification",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200

        body = response.json()
        assert (
            "learning_first_word" in body["newly_unlocked_ids"]
        ), f"Expected learning_first_word in newly_unlocked_ids, got: {body['newly_unlocked_ids']}"
        assert body["newly_locked_ids"] == []

        # Verify the UserAchievement row is persisted in DB
        await db_session.expire_all()
        post_count = await db_session.scalar(
            select(func.count()).where(
                UserAchievement.user_id == test_user.id,
                UserAchievement.achievement_id == "learning_first_word",
            )
        )
        assert (
            post_count == 1
        ), f"UserAchievement row must exist after recompute, found {post_count}"

    @pytest.mark.asyncio
    async def test_recompute_is_idempotent(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        test_user: User,
        db_session: AsyncSession,
        recompute_card_record: CardRecord,
        achievement_catalog_learning_first_word: Achievement,
    ) -> None:
        """Second call returns empty diff and does not create duplicate DB rows."""
        stat = CardRecordStatistics(
            user_id=test_user.id,
            card_record_id=recompute_card_record.id,
            easiness_factor=2.36,
            interval=1,
            repetitions=2,
            next_review_date=date.today(),
            status=CardStatus.LEARNING,
        )
        db_session.add(stat)
        await db_session.flush()

        # First call — heals the stuck state
        r1 = await client.post(
            f"/api/v1/admin/users/{test_user.id}/recompute-gamification",
            headers=superuser_auth_headers,
        )
        assert r1.status_code == 200
        assert "learning_first_word" in r1.json()["newly_unlocked_ids"]

        # Second call — user is already converged, diff should be empty
        r2 = await client.post(
            f"/api/v1/admin/users/{test_user.id}/recompute-gamification",
            headers=superuser_auth_headers,
        )
        assert r2.status_code == 200
        assert r2.json()["newly_unlocked_ids"] == []

        # No duplicate rows in DB
        await db_session.expire_all()
        row_count = await db_session.scalar(
            select(func.count()).where(
                UserAchievement.user_id == test_user.id,
                UserAchievement.achievement_id == "learning_first_word",
            )
        )
        assert row_count == 1, f"Expected exactly 1 row, got {row_count} (idempotency failure)"
